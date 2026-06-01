/**
 * Cabinet Adapter SDK — PURE, runtime-agnostic (Phase 1j).
 *
 * The safe import path for arcade games. Every cabinet game (native or cloned)
 * enters the arcade through an ADAPTER that declares its identity, frame
 * contract, native size, server authority/ticket/challenge modes, input schema,
 * selectors and clone policy. Adapters are validated against the Phase 1i
 * Cabinet Frame Contract (./cabinet-frame-contract.mjs) — they REFERENCE it, they
 * never duplicate or bypass it.
 *
 * No DOM is used here, so adapter validation runs in Node tests and in the
 * browser runtime alike. The SERVER catalog remains the authority for which
 * cabinets are active; this client registry only decides HOW a supported active
 * cabinet renders. Platform hardening only — no gameplay, no economy, no money.
 */
import { getContract } from './cabinet-frame-contract.mjs';

export const AUTHORITY_MODES = Object.freeze(['client_local_only', 'server_round_authoritative', 'server_full_authoritative', 'coming_soon']);
export const TICKET_MODES = Object.freeze(['none', 'server_awarded', 'display_only_estimate', 'coming_soon']);
export const CHALLENGE_MODES = Object.freeze(['none', 'server_observed', 'server_claimable', 'coming_soon']);

/** Lifecycle hooks every adapter must declare it understands. */
export const REQUIRED_LIFECYCLE = Object.freeze(['onMount', 'onUnmount', 'onResize', 'onFocus', 'onBlur', 'onServerState']);
/** Optional (server-authoritative round) lifecycle hooks. */
export const OPTIONAL_LIFECYCLE = Object.freeze(['onRoundStarted', 'onRoundAccepted', 'onRoundRejected']);

// ---- registry (client-side: how to render a supported cabinet type) ----
const _adapters = new Map(); // cabinetType -> adapter

export function registerAdapter(adapter) {
  if (adapter && typeof adapter.cabinetType === 'string') _adapters.set(adapter.cabinetType, adapter);
  return adapter;
}
export function getAdapter(cabinetType) { return _adapters.get(cabinetType) || null; }
export function hasAdapter(cabinetType) { return _adapters.has(cabinetType); }
export function listAdapters() { return [..._adapters.values()]; }

/**
 * Validate an adapter definition. Returns { ok, errors }. The adapter's native
 * dimensions MUST match its declared frame contract (so an adapter cannot quietly
 * disagree with the Phase 1i contract). `deps.getContract` is injectable for tests.
 */
export function validateAdapter(adapter, deps = {}) {
  const resolve = deps.getContract || getContract;
  const errors = [];
  if (!adapter || typeof adapter !== 'object') return { ok: false, errors: ['not_an_object'] };

  for (const f of ['gameId', 'cabinetId', 'cabinetType', 'displayName', 'frameContractId']) {
    if (typeof adapter[f] !== 'string' || !adapter[f]) errors.push(`bad_${f}`);
  }

  const contract = adapter.frameContractId ? resolve(adapter.frameContractId) : null;
  if (!contract) {
    errors.push('unknown_frame_contract');
  } else {
    if (adapter.nativeWidth !== contract.native_width) errors.push('native_width_mismatch');
    if (adapter.nativeHeight !== contract.native_height) errors.push('native_height_mismatch');
  }

  if (!AUTHORITY_MODES.includes(adapter.authorityMode)) errors.push('bad_authority_mode');
  if (!TICKET_MODES.includes(adapter.ticketMode)) errors.push('bad_ticket_mode');
  if (!CHALLENGE_MODES.includes(adapter.challengeMode)) errors.push('bad_challenge_mode');

  const sel = adapter.selectors;
  if (!sel || typeof sel !== 'object' || typeof sel.panel !== 'string' || typeof sel.stage !== 'string' || typeof sel.chrome !== 'string') {
    errors.push('bad_selectors');
  }

  const lc = Array.isArray(adapter.lifecycle) ? adapter.lifecycle : null;
  if (!lc) errors.push('bad_lifecycle');
  else for (const h of REQUIRED_LIFECYCLE) if (!lc.includes(h)) errors.push(`missing_lifecycle:${h}`);

  if (adapter.clonePolicy !== 'preserve_original_size') errors.push('bad_clone_policy');

  return { ok: errors.length === 0, errors };
}

/**
 * Render-state resolver. The SERVER catalog decides which cabinets are active;
 * the client decides whether it can render them. Returns one of:
 *   'playable'      — active in catalog AND a valid adapter exists
 *   'unavailable'   — active in catalog but NO client adapter (show "Unavailable")
 *   'coming_soon'   — listed but not active (cannot be played)
 *   'not_listed'    — not present in the server catalog (a client-only adapter
 *                     is NEVER playable on its own)
 */
export function cabinetRenderState(cabinet, hasAdapterFn = hasAdapter) {
  if (!cabinet) return 'not_listed';
  const supported = typeof hasAdapterFn === 'function' ? !!hasAdapterFn(cabinet.cabinet_type) : !!hasAdapterFn;
  const active = cabinet.status === 'live' && cabinet.ticket_enabled === true;
  if (!active) return 'coming_soon';
  return supported ? 'playable' : 'unavailable';
}

/** The cabinets from a server catalog that are currently playable on this client. */
export function playableCabinets(cabinets, hasAdapterFn = hasAdapter) {
  return (Array.isArray(cabinets) ? cabinets : []).filter((c) => cabinetRenderState(c, hasAdapterFn) === 'playable');
}

/**
 * Pure mount plan: validate (fail closed) + report the canonical lifecycle order.
 * DOM-free, so the runtime's fail-closed + ordering contract is unit-testable.
 */
export function planAdapterMount(adapter, deps = {}) {
  const v = validateAdapter(adapter, deps);
  if (!v.ok) return { ok: false, errors: v.errors, lifecycleOrder: [] };
  return { ok: true, errors: [], lifecycleOrder: ['onMount', 'onFocus', 'onBlur', 'onUnmount'] };
}
