/**
 * Neon Grid — import manifest (Phase 1l). PRODUCTION cabinet.
 *
 * Unlike the test-only sample-import fixture, Neon Grid is a real cabinet that
 * enters the Neon Circuit floor through the Phase 1j/1k adapter + dynamic-import
 * path. It declares server-authoritative authority, server-awarded tickets and
 * server-observed challenges. The manifest only describes the cabinet — it can
 * NEVER make itself playable: the runtime enables + mounts it ONLY after the
 * SERVER catalog activates the matching `neon-grid-01` cabinet.
 *
 * The manifest pins the original/native size (360x640 — the production portrait
 * box) so the clone guard fails if a future edit silently resizes it, declares
 * only arcade-local code/asset paths (never game/*), and requests NO forbidden
 * capability (payments, external network, real-money/transfer, global auth, DOM
 * escape). Internal arcade points only — no money, no crypto, no transfer.
 */
import { FORBIDDEN_CAPABILITIES } from '../../game-import-manifest.mjs';

export const NEON_GRID_NATIVE_WIDTH = 360;
export const NEON_GRID_NATIVE_HEIGHT = 640;

export const neonGridManifest = Object.freeze({
  manifest_version: 1,
  game_id: 'neon_grid',
  source_name: 'Neon Grid',
  source_kind: 'native_neon_import',
  original_width: NEON_GRID_NATIVE_WIDTH,
  original_height: NEON_GRID_NATIVE_HEIGHT,
  current_width: NEON_GRID_NATIVE_WIDTH,
  current_height: NEON_GRID_NATIVE_HEIGHT,
  aspect_ratio: NEON_GRID_NATIVE_WIDTH / NEON_GRID_NATIVE_HEIGHT,
  entry_file: 'arcade/cabinets/neon-grid/neon-grid-game.mjs',
  adapter_module: 'arcade/cabinets/neon-grid/adapter.mjs',
  styles: ['arcade/cabinets/neon-grid/neon-grid.css'],
  scripts: ['arcade/cabinets/neon-grid/neon-grid-game.mjs'],
  allowed_asset_paths: ['arcade/cabinets/neon-grid/'],
  input_methods: ['pointer', 'keyboard', 'touch'],
  // Server is the authority — the client only renders + estimates.
  authority_mode: 'server_round_authoritative',
  ticket_mode: 'server_awarded',
  challenge_mode: 'server_observed',
  // The capabilities this cabinet bars; it requests NONE of them.
  forbidden_capabilities: [...FORBIDDEN_CAPABILITIES],
  requested_capabilities: [],
  clone_policy: 'preserve_original_size',
  migration_flag: false,
  ruleset_version: 'neon-grid-v1',
  test_selectors: { panel: '.ngg-panel', stage: '.ngg-stage', chrome: '.ngg-head' },
  notes: 'First production cabinet activated through the adapter/import path (Phase 1l).',
});
