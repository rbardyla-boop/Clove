/**
 * Sample Import Game — adapter. TEST ONLY / DISABLED.
 *
 * Demonstrates the adapter an imported game would ship. It is NOT registered in
 * the production adapter registry (it never calls registerAdapter), so it can
 * never become playable in production — tests validate it with an injected
 * contract resolver. See manifest.mjs.
 */
import { sampleImportContract } from './manifest.mjs';

/** Contract resolver for tests (the fixture's contract is intentionally not in the production registry). */
export function sampleContractResolver(id) {
  return id === 'sample_import_game' ? sampleImportContract : null;
}

export const sampleImportAdapter = Object.freeze({
  gameId: 'sample_import_game',
  cabinetId: 'sample-import-01',
  cabinetType: 'sample_import_game',
  displayName: 'Sample Import (test)',
  frameContractId: 'sample_import_game',
  nativeWidth: 320,
  nativeHeight: 480,
  rulesetVersion: 'sample/1',
  authorityMode: 'client_local_only',
  ticketMode: 'none',
  challengeMode: 'none',
  inputSchema: Object.freeze({ methods: ['pointer'], primary: 'tap' }),
  lifecycle: Object.freeze(['onMount', 'onUnmount', 'onResize', 'onFocus', 'onBlur', 'onServerState']),
  selectors: Object.freeze({ panel: '.sig-panel', stage: '.sig-stage', chrome: '.sig-head' }),
  capabilities: Object.freeze({ tickets: false, challenges: false, prizes: false }),
  clonePolicy: 'preserve_original_size',
});
