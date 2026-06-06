/**
 * Creator Foundation CF-1 — package validator + schema + hash + receipt tests.
 *   node --test tests/creator/*.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalize, packageHash } from '../../arcade/creator/validator/package-hash.mjs';
import { buildValidationReport } from '../../arcade/creator/validator/validation-report.mjs';
import { validateBlockPackage } from '../../arcade/creator/validator/validate-block-package.mjs';
import { validateArcadePackage } from '../../arcade/creator/validator/validate-arcade-package.mjs';

const block = () => structuredClone({
  schema_version: 1, package_kind: 'block_style', package_id: 'harbor-tide-glass',
  display_name: 'Tide Glass Facade', target_city_id: 'harbor-02',
  style: { palette: 'neon-cyan', facade_pattern: 'grid-window-tall', sign_variant: 'blade', lighting: 'high', accent: 'white-trim', tile_accent: 'circuit' },
  constraints: { no_external_assets: true, no_scripts: true },
});
const arcade = () => structuredClone({
  schema_version: 1, package_kind: 'arcade_game', package_id: 'sample-pulse-variant',
  display_name: 'Sample Tiny Cabinet', frame_contract_id: 'cabinet-360x640',
  entry: 'game.mjs', adapter: 'adapter.mjs', assets: [], capabilities: [], size_budget_bytes: 32768,
});

// ── block packages ───────────────────────────────────────────────────────────────────────
test('valid block package passes', () => assert.equal(validateBlockPackage(block()).ok, true));

test('invalid palette fails', () => { const p = block(); p.style.palette = 'rainbow'; assert.equal(validateBlockPackage(p).ok, false); });

test('unknown top-level field fails (no silent drop)', () => { const p = block(); p.script = 'x'; assert.equal(validateBlockPackage(p).ok, false); });

test('unknown style key fails', () => { const p = block(); p.style.texture = 'x'; assert.equal(validateBlockPackage(p).ok, false); });

test('external URL anywhere fails', () => { const p = block(); p.display_name = 'see http://evil.test'; assert.equal(validateBlockPackage(p).ok, false); });

test('script-like content fails', () => { for (const s of ['<script>', 'x => 1', '${e}', 'new Function', 'eval(1)']) { const p = block(); p.display_name = s; assert.equal(validateBlockPackage(p).ok, false, s); } });

test('forbidden economy term fails (id and name)', () => {
  const a = block(); a.package_id = 'sell-this-block';
  const b = block(); b.display_name = 'for sale';
  assert.equal(validateBlockPackage(a).ok, false);
  assert.equal(validateBlockPackage(b).ok, false);
});

test('missing required constraint fails', () => { const p = block(); p.constraints.no_scripts = false; assert.equal(validateBlockPackage(p).ok, false); });

test('private/identity key anywhere fails', () => { const p = block(); p.style.player_id = 'x'; assert.equal(validateBlockPackage(p).ok, false); });

test('non-plain data fails at the gate', () => { const p = block(); p.style.fn = () => 1; assert.equal(validateBlockPackage(p).ok, false); });

// ── arcade packages ──────────────────────────────────────────────────────────────────────
test('valid arcade package passes', () => assert.equal(validateArcadePackage(arcade()).ok, true));

test('non-empty capability list fails (deny-by-default)', () => { const p = arcade(); p.capabilities = ['network']; assert.equal(validateArcadePackage(p).ok, false); });

test('non-empty assets fail in CF-1', () => { const p = arcade(); p.assets = ['x.png']; assert.equal(validateArcadePackage(p).ok, false); });

test('unknown frame contract fails', () => { const p = arcade(); p.frame_contract_id = 'cabinet-9999'; assert.equal(validateArcadePackage(p).ok, false); });

test('unsafe entry filename fails', () => { for (const e of ['../escape.mjs', 'game.js', '/abs.mjs', 'http://x/g.mjs']) { const p = arcade(); p.entry = e; assert.equal(validateArcadePackage(p).ok, false, e); } });

test('oversized / out-of-range size budget fails', () => {
  const a = arcade(); a.size_budget_bytes = 999999;     // over 64 KiB ceiling
  const b = arcade(); b.size_budget_bytes = 10;          // under floor
  const c = arcade(); c.size_budget_bytes = 1024.5;      // not integer
  assert.equal(validateArcadePackage(a).ok, false);
  assert.equal(validateArcadePackage(b).ok, false);
  assert.equal(validateArcadePackage(c).ok, false);
});

// ── hashing + report ─────────────────────────────────────────────────────────────────────
test('canonical JSON order is stable', () => {
  const a = block();
  const b = { constraints: a.constraints, style: { tile_accent: a.style.tile_accent, palette: a.style.palette, accent: a.style.accent, lighting: a.style.lighting, sign_variant: a.style.sign_variant, facade_pattern: a.style.facade_pattern }, target_city_id: a.target_city_id, display_name: a.display_name, package_id: a.package_id, package_kind: a.package_kind, schema_version: a.schema_version };
  assert.equal(canonicalize(a), canonicalize(b));
});

test('package hash is stable + key-order independent', async () => {
  const a = block();
  const b = structuredClone(a);
  assert.equal(await packageHash(a), await packageHash(b));
  assert.match(await packageHash(a), /^sha256:[0-9a-f]{64}$/);
});

test('report receipt NEVER authorizes the live world', async () => {
  const p = block();
  const report = buildValidationReport({ validation: validateBlockPackage(p), packageHash: await packageHash(p) });
  assert.equal(report.ok, true);
  assert.equal(report.receipt.status, 'local_validation_only');
  assert.equal(report.receipt.live_world_authorized, false);
});
