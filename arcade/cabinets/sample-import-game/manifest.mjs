/**
 * Sample Import Game — manifest. TEST ONLY / DISABLED.
 *
 * A non-product fixture that exercises the Phase 1j import path: a valid manifest,
 * a self-contained frame contract at a DISTINCT native size (320x480, not the
 * 360x640 production size), and a deliberately minimal client-local game. It is
 * NOT in the server catalog, NOT registered in the production adapter registry,
 * and NOT rendered on the floor. Tests use it to prove manifest + adapter
 * validation, the clone guard, and forbidden-capability rejection.
 */
import { FORBIDDEN_CAPABILITIES } from '../../game-import-manifest.mjs';

export const SAMPLE_TEST_ONLY = true;
export const SAMPLE_ENABLED = false;

/** Self-contained frame contract for the fixture (not in the production registry). */
export const sampleImportContract = Object.freeze({
  game_id: 'sample_import_game',
  cabinet_id: 'sample-import-01',
  display_name: 'Sample Import (test)',
  native_width: 320,
  native_height: 480,
  aspect_ratio: 320 / 480,
  scale_mode: 'fit-contain',
  allow_upscale: true,
  max_upscale: 2,
  min_scale: 0.25,
  original_width: 320,
  original_height: 480,
  current_width: 320,
  current_height: 480,
  clone_policy: 'preserve_original_size',
  migrated: false,
});

export const sampleImportManifest = Object.freeze({
  manifest_version: 1,
  game_id: 'sample_import_game',
  source_name: 'Sample Import Game',
  source_kind: 'imported_html_js',
  original_width: 320,
  original_height: 480,
  current_width: 320,
  current_height: 480,
  aspect_ratio: 320 / 480,
  entry_file: 'arcade/cabinets/sample-import-game/sample-game.js',
  styles: [],
  scripts: ['arcade/cabinets/sample-import-game/sample-game.js'],
  input_methods: ['pointer'],
  authority_mode: 'client_local_only',
  ticket_mode: 'none',
  challenge_mode: 'none',
  allowed_asset_paths: ['arcade/cabinets/sample-import-game/'],
  forbidden_capabilities: [...FORBIDDEN_CAPABILITIES],
  requested_capabilities: [],
  clone_policy: 'preserve_original_size',
  migration_flag: false,
  test_selectors: { panel: '.sig-panel', stage: '.sig-stage', chrome: '.sig-head' },
  notes: 'Test-only import fixture; never enabled in production.',
});
