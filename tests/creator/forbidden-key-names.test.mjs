/**
 * R1 regression — block/layered key-name denylist (defense-in-depth GAP-1).
 *
 * scanSafety now rejects forbidden CAPABILITY / NETWORK / ECONOMY key NAMES anywhere in a package,
 * mirroring the Arcade Studio forbidden-surface floor. This is on top of the closed-allowlist schemas
 * (which already reject unknown keys); these tests prove the new scan fires independently AND that valid
 * packages are unaffected (no false positive).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanSafety, FORBIDDEN_KEY_NAMES } from '../../arcade/creator/validator/validation-report.mjs';
import { validateBlockPackage } from '../../arcade/creator/validator/validate-block-package.mjs';
import { validateBlockLayeredPackage } from '../../arcade/creator/validator/validate-block-layered-package.mjs';

const block = () => structuredClone({
  schema_version: 1, package_kind: 'block_style', package_id: 'harbor-tide-glass',
  display_name: 'Tide Glass Facade', target_city_id: 'harbor-02',
  style: { palette: 'neon-cyan', facade_pattern: 'grid-window-tall', sign_variant: 'blade', lighting: 'high', accent: 'white-trim', tile_accent: 'circuit' },
  constraints: { no_external_assets: true, no_scripts: true },
});
const layered = () => structuredClone({
  schema_version: 1, package_kind: 'block_layered', package_id: 'downtown-neon-facade-01',
  display_name: 'Neon Downtown Facade', target_city_id: 'downtown-01', palette_variant: 'neon-arcade-v1',
  layers: {
    facade: { pattern: 'neon-mesh', primary_color: 'neon-blue', secondary_color: 'neon-cyan', trim: 'cyan-trim' },
    sign: { variant: 'blade', color: 'neon-magenta', placement: 'apex' },
    symbols: [
      { token: 'decal-star-burst', position: 'upper-left', color: 'neon-amber', scale: '1.0' },
      { token: 'decal-circuit-path', position: 'center', color: 'neon-green', scale: '0.75' },
    ],
    windows: { grid_type: 'glass-bright', density: 'medium', glow_color: 'neon-cyan' },
    roof: { accent_type: 'ridge-sharp', highlight: 'white-trim', pattern: 'lights' },
    lighting_zones: [
      { zone_id: 'left-face', glow: 'high', flicker: false },
      { zone_id: 'right-face', glow: 'medium', flicker: false },
      { zone_id: 'roof', glow: 'low', flicker: false },
    ],
  },
  constraints: { no_external_assets: true, no_scripts: true, no_live_world_load: true },
});

const FORBIDDEN_SAMPLE = ['upload', 'fetch', 'webhook', 'remote', 'submit', 'marketplace', 'reward', 'prize', 'ticket', 'crypto', 'nft', 'ownership', 'price', 'live_world_load', 'arbitrary_script'];

test('FORBIDDEN_KEY_NAMES covers capability, network, and economy surfaces', () => {
  for (const k of FORBIDDEN_SAMPLE) assert.ok(FORBIDDEN_KEY_NAMES.includes(k), `denylist must contain ${k}`);
});

test('scanSafety rejects a forbidden key name at the top level', () => {
  for (const k of FORBIDDEN_SAMPLE) {
    const errs = [];
    const ok = scanSafety({ [k]: 'whatever' }, errs);
    assert.equal(ok, false, `top-level key ${k} must fail`);
    assert.match(errs.join('\n'), /forbidden capability\/economy\/network key/);
  }
});

test('scanSafety rejects a forbidden key name nested deep in the tree', () => {
  const errs = [];
  assert.equal(scanSafety({ style: { inner: { marketplace: { x: 1 } } } }, errs), false);
  assert.match(errs.join('\n'), /forbidden capability\/economy\/network key at .*marketplace/);
});

test('scanSafety passes a clean object (no false positive on ordinary keys)', () => {
  const errs = [];
  assert.equal(scanSafety({ palette: 'neon-cyan', facade_pattern: 'grid', constraints: { no_scripts: true } }, errs), true);
  assert.equal(errs.length, 0);
});

test('validateBlockPackage fails closed on an injected forbidden key (defense-in-depth)', () => {
  for (const k of ['upload', 'reward', 'marketplace']) {
    const p = block(); p.style[k] = 'x';
    assert.equal(validateBlockPackage(p).ok, false, `block + ${k}`);
  }
});

test('validateBlockLayeredPackage fails closed on an injected forbidden key (defense-in-depth)', () => {
  for (const k of ['fetch', 'crypto', 'ticket']) {
    const p = layered(); p.layers.facade[k] = 'x';
    assert.equal(validateBlockLayeredPackage(p).ok, false, `layered + ${k}`);
  }
});

test('valid block and layered packages still pass after the denylist (no regression)', () => {
  assert.equal(validateBlockPackage(block()).ok, true);
  assert.equal(validateBlockLayeredPackage(layered()).ok, true);
});
