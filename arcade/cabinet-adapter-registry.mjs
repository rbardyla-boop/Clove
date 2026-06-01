/**
 * Cabinet Adapter Registry — PURE, runtime-agnostic (Phase 1k).
 *
 * The controlled registry that replaces Phase 1j's fixed gameId→factory map.
 * Built-in adapters are statically registered (and kept in sync with the SDK
 * registry that cabinetRenderState() reads). Imported adapters are registered
 * only through the import loader, after manifest + adapter validation, and are
 * test-only/disabled unless the SERVER catalog activates them. Production
 * adapters can never be replaced at runtime; an imported adapter can never
 * shadow a built-in.
 *
 * Factories (the browser game constructors) are attached separately via
 * setBuiltInFactory / registerImportedAdapter, so this module stays DOM-free and
 * Node-testable. The server catalog remains the authority for which cabinets are
 * active; this registry only decides HOW a known cabinet type renders.
 */
import {
  getAdapter as sdkGetAdapter,
  hasAdapter as sdkHasAdapter,
  listAdapters as sdkListAdapters,
  registerAdapter as sdkRegisterAdapter,
  validateAdapter,
} from './cabinet-adapter-sdk.mjs';

// adapters[gameId] for IMPORTED games only; built-ins live in the SDK registry.
const _imported = new Map();        // gameId -> { adapter, manifest, contract, factory, kind:'imported', enabled }
const _builtinFactories = new Map(); // gameId -> factory (attached by the browser runtime)

/** Validate an adapter for registration (delegates to the SDK validator). */
export function validateAdapterRegistration(adapter, deps = {}) {
  return validateAdapter(adapter, deps);
}

/**
 * Register a built-in (shipped) adapter. Idempotent for the same frozen object;
 * a DIFFERENT adapter claiming an already-registered cabinet type is rejected
 * (production adapters cannot be replaced at runtime).
 */
export function registerBuiltInAdapter(adapter, deps = {}) {
  const v = validateAdapter(adapter, deps);
  if (!v.ok) return { ok: false, reason: 'invalid_adapter', errors: v.errors };
  const existing = sdkGetAdapter(adapter.cabinetType);
  if (existing && existing !== adapter) return { ok: false, reason: 'duplicate_builtin' };
  sdkRegisterAdapter(adapter); // keep the SDK (cabinetType-keyed) registry in sync
  return { ok: true, kind: 'builtin' };
}

/** Attach the browser factory for a built-in adapter (browser runtime only). */
export function setBuiltInFactory(gameId, factory) {
  if (typeof factory === 'function') _builtinFactories.set(gameId, factory);
}

/**
 * Register an IMPORTED adapter (via the import loader, after manifest + adapter
 * validation). Test-only/disabled unless `enabled` is set by the catalog. An
 * imported adapter can never shadow a built-in; a duplicate is rejected unless
 * it is replacing a still-disabled test fixture.
 */
export function registerImportedAdapter(manifest, adapter, { factory = null, contract = null, enabled = false, deps = {} } = {}) {
  const resolver = deps.getContract || ((id) => (id === adapter.frameContractId ? contract : undefined));
  const v = validateAdapter(adapter, { getContract: resolver });
  if (!v.ok) return { ok: false, reason: 'invalid_adapter', errors: v.errors };
  if (sdkHasAdapter(adapter.cabinetType)) return { ok: false, reason: 'cannot_shadow_builtin' };
  const existing = _imported.get(adapter.gameId);
  if (existing && existing.enabled) return { ok: false, reason: 'duplicate_imported_enabled' };
  _imported.set(adapter.gameId, { adapter, manifest, contract, factory, kind: 'imported', enabled: !!enabled });
  return { ok: true, kind: 'imported', enabled: !!enabled };
}

export function getRegistration(gameId) {
  const b = sdkGetAdapter(gameId);
  if (b) return { adapter: b, kind: 'builtin', enabled: true, factory: _builtinFactories.get(gameId) || null, contract: null };
  return _imported.get(gameId) || null;
}
export function getAdapter(gameId) { const r = getRegistration(gameId); return r ? r.adapter : null; }
export function hasAdapter(gameId) { return !!sdkGetAdapter(gameId) || _imported.has(gameId); }
export function getFactory(gameId) { const r = getRegistration(gameId); return r ? (r.factory || null) : null; }
export function isEnabled(gameId) { const r = getRegistration(gameId); return !!(r && r.enabled); }

export function listAdapters() {
  return [...sdkListAdapters(), ...[..._imported.values()].map((r) => r.adapter)];
}
export function listRegistrations() {
  const out = sdkListAdapters().map((a) => ({ gameId: a.gameId, kind: 'builtin', enabled: true }));
  for (const r of _imported.values()) out.push({ gameId: r.adapter.gameId, kind: 'imported', enabled: r.enabled });
  return out;
}

/**
 * Resolve the adapter for a SERVER catalog cabinet. Built-ins resolve by cabinet
 * type; imported adapters resolve only if explicitly enabled. The server catalog
 * stays the authority — this never invents a playable cabinet on its own.
 */
export function resolveAdapterForCabinet(cabinet) {
  if (!cabinet) return null;
  const b = sdkGetAdapter(cabinet.cabinet_type);
  if (b) return b;
  const imp = _imported.get(cabinet.cabinet_type);
  return imp && imp.enabled ? imp.adapter : null;
}

/**
 * Enable a previously-registered imported adapter (Phase 1l). The import loader
 * always registers imported adapters DISABLED; the runtime calls this only after
 * the SERVER catalog has activated the matching cabinet, so a client adapter can
 * never make itself playable on its own. Returns { ok, reason }.
 */
export function enableImportedAdapter(gameId) {
  const reg = _imported.get(gameId);
  if (!reg) return { ok: false, reason: 'not_imported' };
  if (sdkHasAdapter(reg.adapter.cabinetType)) return { ok: false, reason: 'cannot_shadow_builtin' };
  if (reg.enabled) return { ok: true, reason: null, already: true };
  _imported.set(gameId, { ...reg, enabled: true });
  return { ok: true, reason: null };
}

/** Test helper: drop an imported registration (never affects built-ins). */
export function unregisterImported(gameId) { return _imported.delete(gameId); }
