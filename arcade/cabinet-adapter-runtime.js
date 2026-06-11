/**
 * Cabinet Adapter runtime (browser) — Phase 1k.
 *
 * Mounts cabinet adapters into the arcade. Built-in games are mounted via
 * factories bound into the controlled registry (no more fixed map at the call
 * site); imported games are loaded through the dynamic import loader and mounted
 * into a cabinet frame built from their (runtime-registered) contract. All mounts
 * FAIL CLOSED on any validation error. Adapter lifecycle hooks
 * (onMount/onUnmount/onResize/onFocus/onBlur/onServerState) are routed here and
 * their exceptions are caught + recorded as adapter errors — never app crashes.
 *
 * It changes NO server state — the server catalog stays the authority. Structured
 * diagnostics are exposed ONLY under ?test=1 / ?frameDebug=1 and never include
 * private balance / ledger / inventory / challenge state.
 */
import {
  getAdapter, getFactory, setBuiltInFactory, getRegistration, listRegistrations, resolveAdapterForCabinet,
  enableImportedAdapter,
} from './cabinet-adapter-registry.mjs';
import { validateAdapter } from './cabinet-adapter-sdk.mjs';
import { getContract, registerContract } from './cabinet-frame-contract.mjs';
import { loadImportedAdapter } from './cabinet-import-loader.mjs';
import { createCabinetFrame } from './cabinet-frame.js';
import { createPulseTapGame } from './pulse-tap-game.js';
import { createSignalSprintGame } from './signal-sprint-game.js';
// side-effect imports: register the built-in adapters
import './adapters/pulse-tap-adapter.mjs';
import './adapters/signal-sprint-adapter.mjs';

// Bind the built-in factories into the registry (replaces the Phase 1j fixed map).
setBuiltInFactory('pulse_tap', createPulseTapGame);
setBuiltInFactory('signal_sprint', createSignalSprintGame);

const params = new URLSearchParams(location.search);
const EXPOSE = params.get('frameDebug') === '1' || params.get('test') === '1';

const diag = {
  mounts: [],
  lastMountResult: null,
  lastImportResult: null,
  lifecycleLog: [],
  unsupportedCabinets: [],
  adapterErrors: [],
};
function recordError(gameId, where, err) {
  diag.adapterErrors.push({ gameId, where, error: String((err && err.message) || err) });
  if (EXPOSE) console.warn(`[adapter] ${gameId} ${where}: ${err}`);
}
function makeFire(gameId, userLifecycle, order) {
  return (name, arg) => {
    order.push(name);
    diag.lifecycleLog.push({ gameId, name });
    try { if (userLifecycle && typeof userLifecycle[name] === 'function') userLifecycle[name](arg); }
    catch (e) { recordError(gameId, 'lifecycle:' + name, e); }
  };
}
function exposeLegacy(cabinetType, result) {
  if (EXPOSE) (window.__adapterRuntime || (window.__adapterRuntime = {}))[cabinetType] = result;
  return result;
}

/** Mount a BUILT-IN cabinet adapter (registry-backed factory). Fails closed. */
export function mountAdapter(cabinetType, hooks = {}) {
  const adapter = getAdapter(cabinetType);
  const result = { ok: false, state: 'unavailable', reason: null, adapter: adapter || null, game: null, lifecycleOrder: () => [] };
  if (!adapter) {
    result.reason = 'no_adapter';
    diag.unsupportedCabinets.push({ cabinetType, reason: 'no_adapter' });
    if (EXPOSE) console.warn(`[adapter] no adapter registered for cabinet type "${cabinetType}"`);
    diag.lastMountResult = result;
    return exposeLegacy(cabinetType, result);
  }
  const v = validateAdapter(adapter, { getContract });
  if (!v.ok) {
    result.reason = 'invalid_adapter:' + v.errors.join(',');
    diag.unsupportedCabinets.push({ cabinetType, reason: 'invalid_adapter' });
    if (EXPOSE) console.warn(`[adapter] invalid adapter for "${cabinetType}": ${v.errors.join(',')}`);
    diag.lastMountResult = result;
    return exposeLegacy(cabinetType, result);
  }
  const factory = getFactory(adapter.gameId);
  if (typeof factory !== 'function') {
    result.reason = 'no_factory';
    diag.unsupportedCabinets.push({ cabinetType, reason: 'no_factory' });
    diag.lastMountResult = result;
    return exposeLegacy(cabinetType, result);
  }

  const order = [];
  const fire = makeFire(adapter.gameId, hooks.lifecycle || {}, order);
  const game = factory({
    accent: hooks.accent, onLeave: hooks.onLeave, onRoundStart: hooks.onRoundStart, onRoundSubmit: hooks.onRoundSubmit,
    onResize: (geom) => fire('onResize', geom),
  });

  let mounted = false;
  const baseOpen = game.open.bind(game);
  const baseClose = game.close.bind(game);
  game.open = () => { baseOpen(); if (!mounted) { mounted = true; fire('onMount'); } fire('onFocus'); };
  game.close = () => { baseClose(); fire('onBlur'); };

  result.ok = true;
  result.state = 'playable';
  result.game = game;
  result.getFrame = () => (typeof game.getFrame === 'function' ? game.getFrame() : null);
  result.screenToNativePoint = (x, y) => { const f = result.getFrame(); return f ? f.screenToNativePoint(x, y) : null; };
  result.nativeToScreenPoint = (x, y) => { const f = result.getFrame(); return f ? f.nativeToScreenPoint(x, y) : null; };
  result.fireServerState = (state) => fire('onServerState', state);
  result.unmount = () => { try { game.close(); } catch { /* ignore */ } fire('onUnmount'); };
  result.lifecycleOrder = () => order.slice();
  diag.mounts.push({ cabinetType, gameId: adapter.gameId, kind: 'builtin' });
  diag.lastMountResult = result;
  return exposeLegacy(cabinetType, result);
}

/**
 * Mount an IMPORTED game (already loaded + registered as imported). The runtime
 * registers the imported frame contract, builds a cabinet frame, and mounts the
 * imported game's root into it. Fails closed.
 */
export function mountImportedGame(gameId, hooks = {}) {
  const reg = getRegistration(gameId);
  const result = { ok: false, state: 'unavailable', reason: null, game: null, frame: null, lifecycleOrder: () => [] };
  if (!reg || reg.kind !== 'imported') { result.reason = 'not_imported'; diag.lastMountResult = result; return result; }
  const { adapter, contract, factory } = reg;
  if (!contract || typeof factory !== 'function') { result.reason = 'incomplete_import'; diag.lastMountResult = result; return result; }

  const rc = registerContract(contract);
  if (!rc.ok && !getContract(gameId)) { result.reason = 'contract_register_failed:' + rc.reason; recordError(gameId, 'registerContract', rc.reason); diag.lastMountResult = result; return result; }
  const v = validateAdapter(adapter, { getContract });
  if (!v.ok) { result.reason = 'invalid_adapter:' + v.errors.join(','); diag.lastMountResult = result; return result; }

  const order = [];
  const fire = makeFire(gameId, hooks.lifecycle || {}, order);
  let frame; let game;
  try {
    // Phase 1l: a server-authoritative imported game needs its round/leave hooks.
    // The factory receives the floor-provided game options (the test fixture's
    // factory ignores them, so this stays backwards-compatible).
    game = factory(hooks.gameOptions || {});
    frame = createCabinetFrame(gameId, { onLeave: hooks.onLeave || (() => {}), onResize: (geom) => fire('onResize', geom) });
    frame.mount(game && typeof game.getRoot === 'function' ? game.getRoot() : document.createElement('div'));
  } catch (e) {
    result.reason = 'mount_failed';
    recordError(gameId, 'mount', e);
    diag.lastMountResult = result;
    return result;
  }

  let mounted = false;
  result.ok = true;
  result.state = 'playable';
  result.game = game;
  result.frame = frame;
  result.open = () => { try { game.open && game.open(); } catch (e) { recordError(gameId, 'open', e); } frame.open(); if (!mounted) { mounted = true; fire('onMount'); } fire('onFocus'); };
  result.close = () => { frame.close(); try { game.close && game.close(); } catch { /* ignore */ } fire('onBlur'); };
  result.unmount = () => { result.close(); fire('onUnmount'); try { frame.element && frame.element.remove && frame.element.remove(); } catch { /* ignore */ } };
  result.getFrame = () => frame;
  result.screenToNativePoint = (x, y) => frame.screenToNativePoint(x, y);
  result.nativeToScreenPoint = (x, y) => frame.nativeToScreenPoint(x, y);
  result.fireServerState = (state) => fire('onServerState', state);
  result.lifecycleOrder = () => order.slice();
  diag.mounts.push({ gameId, kind: 'imported' });
  diag.lastMountResult = result;
  return result;
}

/**
 * Mount a CURATED STARTER cabinet (ADR-043). The deliberate authority distinction:
 * the SERVER catalog gates TICKETED play (loadAndActivateImportedCabinet below);
 * the checked-in curated-floor manifest gates LOCAL SHOWCASE mounting only. This
 * path therefore fails closed unless the loaded adapter is STRICTLY local —
 * client_local_only authority, ticket/challenge modes 'none', and zero ticket/
 * challenge/prize capabilities. It sends no messages and can award nothing; a
 * starter that ever wants tickets must instead go through the server catalog.
 */
export async function mountStarterCabinet(manifest, hooks = {}) {
  const load = await loadImportedAdapter(manifest);
  diag.lastImportResult = load;
  if (!load.ok) {
    diag.unsupportedCabinets.push({ gameId: manifest && manifest.game_id, reason: load.reason });
    return { ok: false, reason: load.reason, load, mount: null };
  }
  const a = load.adapter;
  const caps = a.capabilities || {};
  if (a.authorityMode !== 'client_local_only' || a.ticketMode !== 'none' || a.challengeMode !== 'none'
    || caps.tickets === true || caps.challenges === true || caps.prizes === true) {
    diag.unsupportedCabinets.push({ gameId: a.gameId, reason: 'starter_not_local_only' });
    return { ok: false, reason: 'starter_not_local_only', load, mount: null };
  }
  const mount = mountImportedGame(manifest.game_id, hooks);
  return { ok: mount.ok, reason: mount.reason, load, mount };
}

/** Load an import manifest and mount the resulting imported game (test path). */
export async function loadAndMountImported(manifest, hooks = {}) {
  const load = await loadImportedAdapter(manifest);
  diag.lastImportResult = load;
  if (!load.ok) {
    diag.unsupportedCabinets.push({ gameId: manifest && manifest.game_id, reason: load.reason });
    return { ok: false, reason: load.reason, load, mount: null };
  }
  const mount = mountImportedGame(manifest.game_id, hooks);
  return { ok: mount.ok, reason: mount.reason, load, mount };
}

/**
 * PRODUCTION import path (Phase 1l). Activate + mount an imported cabinet the
 * SERVER catalog has marked active. This is the full proof chain a real cabinet
 * follows:
 *
 *   server catalog activation
 *   → load + validate manifest/adapter (fail closed)
 *   → cabinet_type match
 *   → enable in the controlled registry
 *   → resolveAdapterForCabinet (catalog → registry resolution)
 *   → frame contract preservation + adapter runtime mount
 *
 * Fails closed (state 'unavailable') at every step: a cabinet missing from the
 * catalog, an invalid manifest/adapter, or a cabinet-type mismatch never mounts.
 * It NEVER activates a cabinet the catalog has not marked active.
 */
export async function loadAndActivateImportedCabinet(cabinet, manifest, hooks = {}) {
  const fail = (reason) => {
    diag.unsupportedCabinets.push({ cabinetType: cabinet && cabinet.cabinet_type, gameId: manifest && manifest.game_id, reason });
    return { ok: false, reason, state: 'unavailable', load: null, mount: null, adapter: null };
  };
  // 1) the server catalog is the authority — only an active cabinet may activate.
  if (!cabinet || cabinet.status !== 'live' || cabinet.ticket_enabled !== true) return fail('not_active_in_catalog');

  // 2) load + validate the imported adapter (registers it DISABLED). Fails closed.
  const load = await loadImportedAdapter(manifest);
  diag.lastImportResult = load;
  if (!load.ok) return fail(load.reason);

  // 3) the imported adapter must claim the SAME cabinet type the catalog activated.
  if (load.adapter.cabinetType !== cabinet.cabinet_type) return fail('cabinet_type_mismatch');

  // 4) the catalog has authorized it → enable it in the controlled registry.
  const en = enableImportedAdapter(load.adapter.gameId);
  if (!en.ok) return fail('enable_failed:' + en.reason);

  // 5) confirm the catalog cabinet now RESOLVES to this adapter (catalog → registry).
  const resolved = resolveAdapterForCabinet(cabinet);
  if (!resolved || resolved.gameId !== load.adapter.gameId) return fail('resolve_failed');

  // 6) frame contract preservation + adapter runtime mount.
  const mount = mountImportedGame(load.adapter.gameId, hooks);
  if (!mount.ok) return fail('mount_failed:' + mount.reason);
  return { ok: true, reason: null, state: mount.state, load, mount, adapter: load.adapter };
}

/** Render-state for a server catalog cabinet, with diagnostics for unsupported ones. */
export function resolveCabinet(cabinet) {
  const adapter = resolveAdapterForCabinet(cabinet);
  if (cabinet && cabinet.status === 'live' && cabinet.ticket_enabled === true && !adapter) {
    diag.unsupportedCabinets.push({ cabinetType: cabinet.cabinet_type, reason: 'no_adapter' });
  }
  return adapter;
}

// Structured diagnostics — test/debug only. No private balance/ledger/inventory.
if (EXPOSE) {
  window.__cabinetAdapterRuntime = {
    registeredAdapters: () => listRegistrations(),
    mounts: () => diag.mounts.slice(),
    get lastMountResult() { return diag.lastMountResult; },
    get lastImportResult() { return diag.lastImportResult; },
    lifecycleLog: () => diag.lifecycleLog.slice(),
    unsupportedCabinets: () => diag.unsupportedCabinets.slice(),
    adapterErrors: () => diag.adapterErrors.slice(),
    mountAdapter,
    mountImportedGame,
    loadAndMountImported,
    loadAndActivateImportedCabinet,
    mountStarterCabinet,
  };
  window.__mountAdapter = mountAdapter; // back-compat with the Phase 1j browser spec
}
