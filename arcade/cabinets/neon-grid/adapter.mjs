/**
 * Neon Grid — cabinet adapter (Phase 1l). PRODUCTION.
 *
 * The adapter is the metadata Neon Grid ships so it can enter the arcade through
 * the Phase 1j SDK + Phase 1k import loader. It declares Neon Grid's identity,
 * native size, server authority/ticket/challenge modes, input schema, selectors,
 * lifecycle and clone policy — and REFERENCES the Phase 1i frame contract rather
 * than shipping a divergent copy of the native size (it re-exports the built-in
 * `neon_grid` contract). The import-loader contract is the trio
 * { adapter, contract, createGame }.
 *
 * The runtime validates this adapter against its frame contract and FAILS CLOSED
 * on any mismatch. This file is DOM-free so it validates in Node tests too; the
 * actual game DOM lives in ./neon-grid-game.mjs.
 */
import { getContract } from '../../cabinet-frame-contract.mjs';
import { createNeonGridGame } from './neon-grid-game.mjs';

/** Neon Grid references the built-in production frame contract (no divergent copy). */
export const neonGridContract = getContract('neon_grid');

export const neonGridAdapter = Object.freeze({
  gameId: 'neon_grid',
  cabinetId: 'neon-grid-01',
  cabinetType: 'neon_grid',
  displayName: 'Neon Grid',
  frameContractId: 'neon_grid',
  nativeWidth: 360,
  nativeHeight: 640,
  rulesetVersion: 'neon-grid-v1',
  authorityMode: 'server_round_authoritative',
  ticketMode: 'server_awarded',
  challengeMode: 'server_observed',
  inputSchema: Object.freeze({ methods: ['pointer', 'keyboard', 'touch'], primary: 'tap', keys: ['1', '2', '3', '4', '5'] }),
  lifecycle: Object.freeze(['onMount', 'onUnmount', 'onResize', 'onFocus', 'onBlur', 'onServerState', 'onRoundStarted', 'onRoundAccepted', 'onRoundRejected']),
  selectors: Object.freeze({ panel: '.ngg-panel', stage: '.ngg-stage', chrome: '.ngg-head' }),
  capabilities: Object.freeze({ tickets: true, challenges: true, prizes: true }),
  clonePolicy: 'preserve_original_size',
});

// ── Import-loader contract: an imported adapter module exports { adapter, contract, createGame } ──
export const adapter = neonGridAdapter;
export const contract = neonGridContract;
/** The runtime passes the floor's game options (round/leave hooks) through to the factory. */
export function createGame(options = {}) { return createNeonGridGame(options); }
