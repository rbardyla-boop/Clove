/**
 * Phase 1j/1k Adapter SDK + Import Loader — SIMULATOR-LOCAL PORT of
 * arcade/{cabinet-adapter-sdk,game-import-manifest,cabinet-import-loader,
 * cabinet-adapter-registry}.mjs.
 *
 * Models how a cabinet enters the floor: through a validated adapter referencing a
 * frame contract, gated by the server catalog. The simulator classifies every
 * cabinet into one adapter state and resolves render-state (playable / unavailable
 * / coming_soon / not_listed). Fail-closed by construction: an adapter never makes
 * a cabinet playable on its own — the catalog must activate it.
 */
import { getContract } from './frame-contract.mjs';
import { getCabinet } from './catalog.mjs';

export const AUTHORITY_MODES = Object.freeze(['client_local_only', 'server_round_authoritative', 'server_full_authoritative', 'coming_soon']);
export const TICKET_MODES = Object.freeze(['none', 'server_awarded', 'display_only_estimate', 'coming_soon']);
export const CHALLENGE_MODES = Object.freeze(['none', 'server_observed', 'server_claimable', 'coming_soon']);
export const REQUIRED_LIFECYCLE = Object.freeze(['onMount', 'onUnmount', 'onResize', 'onFocus', 'onBlur', 'onServerState']);

/** Capabilities an imported game may NEVER enable (used only to REJECT imports). */
export const FORBIDDEN_CAPABILITIES = Object.freeze([
  'external_payments', 'external_network', 'real_money', 'transfer', 'resale', 'dom_escape', 'global_auth', 'crypto_wallet',
]);
const ALLOWED_ROOT = 'arcade/cabinets/';

/** Hard path validation for any imported code path. */
export function validateImportPath(p) {
  if (typeof p !== 'string' || !p) return { ok: false, reason: 'empty_path' };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(p)) return { ok: false, reason: 'absolute_url' };
  if (/^(data|blob|javascript):/i.test(p)) return { ok: false, reason: 'data_or_blob_scheme' };
  if (p.startsWith('/')) return { ok: false, reason: 'absolute_path' };
  if (p.includes('..')) return { ok: false, reason: 'path_traversal' };
  if (/(^|\/)game\//.test(p)) return { ok: false, reason: 'game_path_forbidden' };
  if (!p.startsWith(ALLOWED_ROOT)) return { ok: false, reason: 'outside_allowed_root' };
  if (!/\.(mjs|js)$/.test(p)) return { ok: false, reason: 'bad_extension' };
  return { ok: true, reason: null };
}

function isPosInt(n) { return typeof n === 'number' && Number.isInteger(n) && n > 0; }

/** Validate an import manifest. Returns { ok, errors }. */
export function validateManifest(m, opts = {}) {
  const errors = [];
  if (!m || typeof m !== 'object') return { ok: false, errors: ['not_an_object'] };
  if (m.manifest_version !== 1) errors.push('bad_manifest_version');
  for (const f of ['game_id', 'source_name', 'source_kind', 'entry_file']) {
    if (typeof m[f] !== 'string' || !m[f]) errors.push(`bad_${f}`);
  }
  if (!isPosInt(m.original_width) || !isPosInt(m.original_height)) errors.push('original_dims_not_positive_int');
  if (!isPosInt(m.current_width) || !isPosInt(m.current_height)) errors.push('current_dims_not_positive_int');
  const sameSize = m.current_width === m.original_width && m.current_height === m.original_height;
  if (!sameSize && m.migration_flag !== true) errors.push('size_changed_without_migration');
  if (isPosInt(m.current_width) && isPosInt(m.current_height)) {
    if (Math.abs((m.aspect_ratio || 0) - m.current_width / m.current_height) > 1e-6) errors.push('aspect_ratio_mismatch');
  }
  if (!AUTHORITY_MODES.includes(m.authority_mode)) errors.push('bad_authority_mode');
  if (!TICKET_MODES.includes(m.ticket_mode)) errors.push('bad_ticket_mode');
  if (!CHALLENGE_MODES.includes(m.challenge_mode)) errors.push('bad_challenge_mode');
  if (validateImportPath(m.entry_file).ok !== true) errors.push('entry_file_outside_allowed_root');
  for (const s of (Array.isArray(m.scripts) ? m.scripts : [])) {
    if (!validateImportPath(s).ok) errors.push(`unsupported_script:${s}`);
  }
  const requested = Array.isArray(m.requested_capabilities) ? m.requested_capabilities : [];
  for (const cap of requested) {
    if (cap === 'external_network' && opts.approvedExternalNetwork === true) continue;
    if (FORBIDDEN_CAPABILITIES.includes(cap)) errors.push(`forbidden_capability:${cap}`);
  }
  if (!Array.isArray(m.forbidden_capabilities)) errors.push('missing_forbidden_capabilities');
  if (m.clone_policy !== 'preserve_original_size') errors.push('bad_clone_policy');
  return { ok: errors.length === 0, errors };
}

/** Validate an adapter against its frame contract. `resolve` is injectable for fixtures. */
export function validateAdapter(adapter, resolve = getContract) {
  const errors = [];
  if (!adapter || typeof adapter !== 'object') return { ok: false, errors: ['not_an_object'] };
  for (const f of ['gameId', 'cabinetType', 'frameContractId']) {
    if (typeof adapter[f] !== 'string' || !adapter[f]) errors.push(`bad_${f}`);
  }
  const contract = adapter.frameContractId ? resolve(adapter.frameContractId) : null;
  if (!contract) errors.push('unknown_frame_contract');
  else {
    if (adapter.nativeWidth !== contract.native_width) errors.push('native_width_mismatch');
    if (adapter.nativeHeight !== contract.native_height) errors.push('native_height_mismatch');
  }
  if (!AUTHORITY_MODES.includes(adapter.authorityMode)) errors.push('bad_authority_mode');
  if (!TICKET_MODES.includes(adapter.ticketMode)) errors.push('bad_ticket_mode');
  if (!CHALLENGE_MODES.includes(adapter.challengeMode)) errors.push('bad_challenge_mode');
  if (adapter.clonePolicy !== 'preserve_original_size') errors.push('bad_clone_policy');
  return { ok: errors.length === 0, errors };
}

// ── adapter registry (which adapters this client knows) ──────────────────────
function builtin(gameId, cabinetType) {
  return { gameId, cabinetType, frameContractId: gameId, nativeWidth: 360, nativeHeight: 640, authorityMode: 'server_round_authoritative', ticketMode: 'server_awarded', challengeMode: 'server_observed', clonePolicy: 'preserve_original_size', kind: 'builtin', enabled: true };
}

/** Self-contained fixture contract (320x480) — never in the production registry. */
export const sampleFixtureContract = Object.freeze({
  game_id: 'sample_import_game', native_width: 320, native_height: 480, aspect_ratio: 320 / 480,
  scale_mode: 'fit-contain', original_width: 320, original_height: 480, current_width: 320, current_height: 480,
  clone_policy: 'preserve_original_size', migrated: false,
});

export const ADAPTERS = Object.freeze({
  pulse_tap: builtin('pulse_tap', 'pulse_tap'),
  signal_sprint: builtin('signal_sprint', 'signal_sprint'),
  // imported production cabinet — disabled until the catalog activates it.
  neon_grid: { gameId: 'neon_grid', cabinetType: 'neon_grid', frameContractId: 'neon_grid', nativeWidth: 360, nativeHeight: 640, authorityMode: 'server_round_authoritative', ticketMode: 'server_awarded', challengeMode: 'server_observed', clonePolicy: 'preserve_original_size', kind: 'imported', enabled: false },
  // imported test-only fixture — validates only with its own contract; never enabled.
  sample_import_game: { gameId: 'sample_import_game', cabinetType: 'sample_import_game', frameContractId: 'sample_import_game', nativeWidth: 320, nativeHeight: 480, authorityMode: 'client_local_only', ticketMode: 'none', challengeMode: 'none', clonePolicy: 'preserve_original_size', kind: 'imported', enabled: false, testOnly: true },
  // imported but structurally INVALID (unknown frame contract) — always fails closed.
  glitch: { gameId: 'glitch', cabinetType: 'glitch', frameContractId: 'glitch', nativeWidth: 360, nativeHeight: 640, authorityMode: 'server_round_authoritative', ticketMode: 'server_awarded', challengeMode: 'server_observed', clonePolicy: 'preserve_original_size', kind: 'imported', enabled: false },
});

function adapterResolver(adapter) {
  return adapter.cabinetType === 'sample_import_game' ? () => sampleFixtureContract : getContract;
}

/** Is this adapter valid + enabled (or built-in)? Built-ins are always enabled. */
export function isAdapterPlayable(adapter, { activated = new Set() } = {}) {
  if (!adapter) return false;
  if (adapter.testOnly) return false; // a test-only fixture is never production-playable
  const v = validateAdapter(adapter, adapterResolver(adapter));
  if (!v.ok) return false;
  if (adapter.kind === 'builtin') return true;
  return adapter.enabled === true || activated.has(adapter.gameId);
}

/** Classify a catalog cabinet into one adapter state. */
export function adapterStateFor(cabinet, opts = {}) {
  if (!cabinet) return 'not_listed';
  if (cabinet.status !== 'live' || cabinet.ticket_enabled !== true) return 'coming_soon';
  const adapter = ADAPTERS[cabinet.cabinet_type];
  if (!adapter) return 'missing_adapter';
  if (adapter.testOnly) return 'valid_imported_test_only';
  const v = validateAdapter(adapter, adapterResolver(adapter));
  if (!v.ok) return 'invalid_adapter';
  if (adapter.kind === 'builtin') return 'valid_builtin';
  return isAdapterPlayable(adapter, opts) ? 'valid_imported_enabled' : 'valid_imported_disabled';
}

/**
 * Render-state for a catalog cabinet:
 *   playable     — live + ticketed AND a valid, enabled adapter exists
 *   unavailable  — live + ticketed but no valid/enabled adapter (fail closed)
 *   coming_soon  — listed but not live/ticketed
 *   not_listed   — not in the catalog (a client-only adapter is never playable)
 */
export function cabinetRenderState(cabinet, opts = {}) {
  if (!cabinet) return 'not_listed';
  if (cabinet.status !== 'live' || cabinet.ticket_enabled !== true) return 'coming_soon';
  const adapter = ADAPTERS[cabinet.cabinet_type];
  return isAdapterPlayable(adapter, opts) ? 'playable' : 'unavailable';
}

/** The cabinet ids that are playable on this client given the activated set. */
export function playableCabinetIds(cabinets, opts = {}) {
  return (Array.isArray(cabinets) ? cabinets : []).filter((c) => cabinetRenderState(c, opts) === 'playable').map((c) => c.cabinet_id);
}

/** A production-shaped Neon Grid import manifest (mirrors the real one). */
export const neonGridManifest = Object.freeze({
  manifest_version: 1, game_id: 'neon_grid', source_name: 'Neon Grid', source_kind: 'native_neon_import',
  original_width: 360, original_height: 640, current_width: 360, current_height: 640, aspect_ratio: 360 / 640,
  entry_file: 'arcade/cabinets/neon-grid/neon-grid-game.mjs', adapter_module: 'arcade/cabinets/neon-grid/adapter.mjs',
  scripts: ['arcade/cabinets/neon-grid/neon-grid-game.mjs'], styles: ['arcade/cabinets/neon-grid/neon-grid.css'],
  authority_mode: 'server_round_authoritative', ticket_mode: 'server_awarded', challenge_mode: 'server_observed',
  forbidden_capabilities: [...FORBIDDEN_CAPABILITIES], requested_capabilities: [], clone_policy: 'preserve_original_size', migration_flag: false,
});

/** A test-only fixture manifest (320x480, client-local). */
export const sampleManifest = Object.freeze({
  manifest_version: 1, game_id: 'sample_import_game', source_name: 'Sample Import', source_kind: 'imported_html_js',
  original_width: 320, original_height: 480, current_width: 320, current_height: 480, aspect_ratio: 320 / 480,
  entry_file: 'arcade/cabinets/sample-import-game/sample-game.mjs', scripts: ['arcade/cabinets/sample-import-game/sample-game.mjs'],
  authority_mode: 'client_local_only', ticket_mode: 'none', challenge_mode: 'none',
  forbidden_capabilities: [...FORBIDDEN_CAPABILITIES], requested_capabilities: [], clone_policy: 'preserve_original_size', migration_flag: false,
});

export { getCabinet };
