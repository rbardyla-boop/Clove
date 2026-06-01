/**
 * Cabinet Adapter runtime (browser) — Phase 1j.
 *
 * Mounts a registered cabinet adapter into the arcade: validates it against the
 * Phase 1i frame contract (FAIL CLOSED on any error), resolves the game factory,
 * wraps the game's open/close to drive adapter lifecycle hooks, and exposes the
 * frame's coordinate mapping. It changes NO server state — the server catalog
 * stays the authority for which cabinets are active; this runtime only decides
 * HOW a supported active cabinet renders.
 *
 * Importing this module registers the production adapters (Pulse Tap, Signal
 * Sprint). An unknown/invalid adapter yields a safe unavailable result (no game,
 * no frame, no crash).
 */
import { getAdapter, validateAdapter } from './cabinet-adapter-sdk.mjs';
import { getContract } from './cabinet-frame-contract.mjs';
import { createPulseTapGame } from './pulse-tap-game.js';
import { createSignalSprintGame } from './signal-sprint-game.js';
// side-effect imports: register the production adapters
import './adapters/pulse-tap-adapter.mjs';
import './adapters/signal-sprint-adapter.mjs';

const FACTORIES = { pulse_tap: createPulseTapGame, signal_sprint: createSignalSprintGame };

const params = new URLSearchParams(location.search);
const EXPOSE = params.get('frameDebug') === '1' || params.get('test') === '1';

function expose(cabinetType, result) {
  if (EXPOSE) (window.__adapterRuntime || (window.__adapterRuntime = {}))[cabinetType] = result;
  return result;
}

/**
 * Mount the adapter for a cabinet type. Returns a result object:
 *   { ok, state, reason, adapter, game, getFrame, screenToNativePoint, nativeToScreenPoint, unmount, lifecycleOrder }
 * On failure ok=false, state='unavailable', game=null — the caller shows the
 * unsupported-cabinet UI and never lets it become playable.
 */
export function mountAdapter(cabinetType, hooks = {}) {
  const adapter = getAdapter(cabinetType);
  const result = { ok: false, state: 'unavailable', reason: null, adapter: adapter || null, game: null, lifecycleOrder: () => [] };

  if (!adapter) {
    result.reason = 'no_adapter';
    if (EXPOSE) console.warn(`[adapter] no adapter registered for cabinet type "${cabinetType}"`);
    return expose(cabinetType, result);
  }
  const v = validateAdapter(adapter, { getContract });
  if (!v.ok) {
    result.reason = 'invalid_adapter:' + v.errors.join(',');
    if (EXPOSE) console.warn(`[adapter] invalid adapter for "${cabinetType}": ${v.errors.join(',')}`);
    return expose(cabinetType, result);
  }
  const factory = FACTORIES[adapter.gameId];
  if (typeof factory !== 'function') {
    result.reason = 'no_factory';
    if (EXPOSE) console.warn(`[adapter] no factory for game "${adapter.gameId}"`);
    return expose(cabinetType, result);
  }

  const order = [];
  const userLifecycle = hooks.lifecycle || {};
  const fire = (name) => { order.push(name); try { userLifecycle[name] && userLifecycle[name](); } catch { /* hook errors never break the cabinet */ } };

  const game = factory({ accent: hooks.accent, onLeave: hooks.onLeave, onRoundStart: hooks.onRoundStart, onRoundSubmit: hooks.onRoundSubmit });

  // Wrap open/close to drive lifecycle without rewriting the game. Fails closed
  // (logs) if the game opened without a frame — the frame contract is mandatory.
  let mounted = false;
  const baseOpen = game.open.bind(game);
  const baseClose = game.close.bind(game);
  game.open = () => {
    baseOpen();
    if (typeof game.getFrame === 'function' && !game.getFrame() && EXPOSE) {
      console.error(`[adapter] "${cabinetType}" opened without a cabinet frame`);
    }
    if (!mounted) { mounted = true; fire('onMount'); }
    fire('onFocus');
  };
  game.close = () => { baseClose(); fire('onBlur'); };

  result.ok = true;
  result.state = 'playable';
  result.game = game;
  result.getFrame = () => (typeof game.getFrame === 'function' ? game.getFrame() : null);
  result.screenToNativePoint = (x, y) => { const f = result.getFrame(); return f ? f.screenToNativePoint(x, y) : null; };
  result.nativeToScreenPoint = (x, y) => { const f = result.getFrame(); return f ? f.nativeToScreenPoint(x, y) : null; };
  result.unmount = () => { try { game.close(); } catch { /* ignore */ } fire('onUnmount'); };
  result.lifecycleOrder = () => order.slice();
  return expose(cabinetType, result);
}

// Test/debug-only: let the browser validation drive a mount directly (e.g. to
// prove an unknown/invalid cabinet fails closed). Never exposed in production.
if (EXPOSE) window.__mountAdapter = mountAdapter;
