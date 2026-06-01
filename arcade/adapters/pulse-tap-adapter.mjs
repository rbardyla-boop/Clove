/**
 * Pulse Tap cabinet adapter — PURE metadata (Phase 1j).
 *
 * Declares how Pulse Tap enters the arcade: its frame contract (Phase 1i),
 * native size, server authority/ticket/challenge modes, input schema, selectors
 * and clone policy. The browser factory wiring lives in cabinet-adapter-runtime.js
 * (this file stays DOM-free so it can be validated in Node tests).
 */
import { registerBuiltInAdapter } from '../cabinet-adapter-registry.mjs';

export const pulseTapAdapter = Object.freeze({
  gameId: 'pulse_tap',
  cabinetId: 'pulse-tap-01',
  cabinetType: 'pulse_tap',
  displayName: 'Pulse Tap',
  frameContractId: 'pulse_tap',
  nativeWidth: 360,
  nativeHeight: 640,
  rulesetVersion: 'pulse-tap/1',
  authorityMode: 'server_round_authoritative',
  ticketMode: 'server_awarded',
  challengeMode: 'server_observed',
  inputSchema: Object.freeze({ methods: ['pointer', 'keyboard'], primary: 'tap', keys: [' ', 'e', 'E'] }),
  lifecycle: Object.freeze(['onMount', 'onUnmount', 'onResize', 'onFocus', 'onBlur', 'onServerState', 'onRoundStarted', 'onRoundAccepted', 'onRoundRejected']),
  selectors: Object.freeze({ panel: '.ptg-panel', stage: '.ptg-stage', chrome: '.ptg-head' }),
  capabilities: Object.freeze({ tickets: true, challenges: true, prizes: true }),
  clonePolicy: 'preserve_original_size',
});

registerBuiltInAdapter(pulseTapAdapter);
