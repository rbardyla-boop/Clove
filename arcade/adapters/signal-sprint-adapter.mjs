/**
 * Signal Sprint cabinet adapter — PURE metadata (Phase 1j). See pulse-tap-adapter.mjs.
 */
import { registerBuiltInAdapter } from '../cabinet-adapter-registry.mjs';

export const signalSprintAdapter = Object.freeze({
  gameId: 'signal_sprint',
  cabinetId: 'signal-sprint-01',
  cabinetType: 'signal_sprint',
  displayName: 'Signal Sprint',
  frameContractId: 'signal_sprint',
  nativeWidth: 360,
  nativeHeight: 640,
  rulesetVersion: 'signal-sprint/1',
  authorityMode: 'server_round_authoritative',
  ticketMode: 'server_awarded',
  challengeMode: 'server_observed',
  inputSchema: Object.freeze({ methods: ['pointer', 'keyboard', 'touch'], primary: 'steer', keys: ['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'] }),
  lifecycle: Object.freeze(['onMount', 'onUnmount', 'onResize', 'onFocus', 'onBlur', 'onServerState', 'onRoundStarted', 'onRoundAccepted', 'onRoundRejected']),
  selectors: Object.freeze({ panel: '.ssg-panel', stage: '.ssg-stage', chrome: '.ssg-head' }),
  capabilities: Object.freeze({ tickets: true, challenges: true, prizes: true }),
  clonePolicy: 'preserve_original_size',
});

registerBuiltInAdapter(signalSprintAdapter);
