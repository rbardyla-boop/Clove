/**
 * Cabinet Import Loader — Phase 1k.
 *
 * The controlled path that turns a validated import MANIFEST into a registered
 * (test-only) adapter. It validates the manifest, hard-validates every import
 * path (arcade-local only; no game/*, no `..`, no absolute/`http(s)`/`data:`/
 * `blob:`), dynamically imports the adapter module ONLY after validation,
 * validates the imported adapter against its frame contract, and registers it as
 * imported/disabled. It returns a structured result and never throws to the app.
 *
 * `validateImportPath` is pure (Node-testable). `loadImportedAdapter` uses dynamic
 * import; an injectable `importer` lets tests exercise the post-import branches.
 * The SERVER catalog stays the authority — an imported adapter is test-only unless
 * the catalog activates it. No external network, no payments, no money.
 */
import { validateManifest } from './game-import-manifest.mjs';
import { validateAdapter } from './cabinet-adapter-sdk.mjs';
import { registerImportedAdapter } from './cabinet-adapter-registry.mjs';

/**
 * Hard path validation for any imported code path. Returns { ok, reason }.
 * Rejects absolute URLs, http(s)://, data:/blob:, absolute paths, `..` traversal,
 * `game/*`, anything outside `arcade/cabinets/`, and non-.js/.mjs files.
 */
export function validateImportPath(p) {
  if (typeof p !== 'string' || !p) return { ok: false, reason: 'empty_path' };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(p)) return { ok: false, reason: 'absolute_url' };       // http:// https:// ftp:// ...
  if (/^(data|blob|javascript):/i.test(p)) return { ok: false, reason: 'data_or_blob_scheme' };
  if (p.startsWith('/')) return { ok: false, reason: 'absolute_path' };
  if (p.includes('..')) return { ok: false, reason: 'path_traversal' };
  if (/(^|\/)game\//.test(p)) return { ok: false, reason: 'game_path_forbidden' };
  if (!p.startsWith('arcade/cabinets/')) return { ok: false, reason: 'outside_allowed_root' };
  if (!/\.(mjs|js)$/.test(p)) return { ok: false, reason: 'bad_extension' };
  return { ok: true, reason: null };
}

/** Convert a validated repo-relative arcade path to a specifier relative to this loader. */
function toSpecifier(repoPath) {
  return './' + repoPath.replace(/^arcade\//, '');
}

/**
 * Load + register an imported adapter from a manifest. Returns:
 *   { ok, adapter?, contract?, createGame?, manifest?, reason?, details? }
 * Fails closed (ok:false) on any validation/import/registration error.
 */
export async function loadImportedAdapter(manifest, opts = {}) {
  const out = { ok: false, reason: null, details: {} };

  // 1) manifest
  const mv = validateManifest(manifest, opts.manifestOpts || {});
  if (!mv.ok) { out.reason = 'invalid_manifest'; out.details.errors = mv.errors; return out; }

  // 2) paths (adapter module + every declared script) — BEFORE any import
  const modPath = manifest.adapter_module || manifest.entry_file;
  const pv = validateImportPath(modPath);
  if (!pv.ok) { out.reason = 'invalid_path:' + pv.reason; out.details.path = modPath; return out; }
  for (const s of (Array.isArray(manifest.scripts) ? manifest.scripts : [])) {
    const sv = validateImportPath(s);
    if (!sv.ok) { out.reason = 'invalid_script_path:' + sv.reason; out.details.path = s; return out; }
  }

  // 3) dynamic import (only after validation); never throw to the app
  let mod;
  try {
    const specifier = toSpecifier(modPath);
    mod = opts.importer ? await opts.importer(specifier, modPath) : await import(specifier);
  } catch (e) {
    out.reason = 'import_failed';
    out.details.error = String((e && e.message) || e);
    return out;
  }

  // 4) the module must export the adapter (+ optional contract + createGame)
  const adapter = mod.adapter || (mod.default && mod.default.adapter);
  const contract = mod.contract || (mod.default && mod.default.contract) || null;
  const createGame = mod.createGame || (mod.default && mod.default.createGame) || null;
  if (!adapter) { out.reason = 'no_adapter_export'; return out; }

  // 5) validate the imported adapter against its (imported) frame contract
  const resolver = (id) => (id === adapter.frameContractId ? contract : (opts.getContract ? opts.getContract(id) : undefined));
  const av = validateAdapter(adapter, { getContract: resolver });
  if (!av.ok) { out.reason = 'invalid_adapter'; out.details.errors = av.errors; return out; }

  // 6) register as imported/disabled (test-only unless the catalog activates it)
  const reg = registerImportedAdapter(manifest, adapter, {
    factory: createGame, contract, enabled: false,
    deps: { getContract: resolver },
  });
  if (!reg.ok) { out.reason = 'registration_failed:' + reg.reason; out.details.errors = reg.errors; return out; }

  out.ok = true;
  out.adapter = adapter;
  out.contract = contract;
  out.createGame = createGame;
  out.manifest = manifest;
  return out;
}
