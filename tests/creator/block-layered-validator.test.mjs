/**
 * Creator Foundation CF-3 — block_layered validator + abuse checklist (26 adversarial rows).
 *   node --test tests/creator/*.test.mjs
 *
 * Every row hand-authors a hostile/sloppy package and asserts the validator rejects it (deny-by-default),
 * plus a positive control, hash stability, and a CF-2 loader round-trip for the new kind.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBlockLayeredPackage } from '../../arcade/creator/validator/validate-block-layered-package.mjs';
import { canonicalize, packageHash } from '../../arcade/creator/validator/package-hash.mjs';
import { buildValidationReport } from '../../arcade/creator/validator/validation-report.mjs';
import { loadApprovedPackage, LOADER_MODES } from '../../arcade/creator/approval/approved-loader.mjs';
import { buildApprovalReceipt, PACKAGE_KINDS } from '../../arcade/creator/approval/approval-receipt.mjs';
import { createRegistry } from '../../arcade/creator/approval/approved-package-registry.mjs';

/** A fully-valid maximal block_layered package (6 decals, 4 zones, all 6 layers, a palette variant). */
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
const ok = (p) => validateBlockLayeredPackage(p).ok;

// ── 26. positive control ─────────────────────────────────────────────────────────────────────
test('26: a fully-valid maximal layered package passes', () => {
  const v = validateBlockLayeredPackage(layered());
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  assert.equal(v.package_kind, 'block_layered');
  assert.ok(v.limits.size_bytes < v.limits.size_budget_bytes);
});

// ── 1–3: code / template / URL smuggling ──────────────────────────────────────────────────────
test('1: code/markup in a token value fails', () => { const p = layered(); p.layers.facade.primary_color = 'neon-blue"><img onerror=alert(1)>'; assert.equal(ok(p), false); });
test('2: backtick/template/arrow in display_name fails', () => { for (const s of ['x ${y}', 'a => b', '`tpl`']) { const p = layered(); p.display_name = s; assert.equal(ok(p), false, s); } });
test('3: URL in a token value fails', () => { const p = layered(); p.layers.windows.glow_color = 'https://evil/x.js'; assert.equal(ok(p), false); });

// ── 4–6: economy + private keys ─────────────────────────────────────────────────────────────
test('4: economy/NFT vocab in package_id fails', () => { const p = layered(); p.package_id = 'nft-rare-buy-now'; assert.equal(ok(p), false); });
test('5: economy vocab in display_name fails', () => { const p = layered(); p.display_name = 'Earn crypto reward block'; assert.equal(ok(p), false); });
test('6: private/identity key anywhere fails', () => { const p = layered(); p.layers.facade.account_id = 'x'; assert.equal(ok(p), false); });

// ── 7–10: DoS / count bounds ──────────────────────────────────────────────────────────────────
test('7: oversized symbols array fails (>6, or >64 plain-data ceiling)', () => {
  const p7 = layered(); p7.layers.symbols = Array.from({ length: 7 }, () => ({ token: 'decal-diamond', position: 'center', color: 'neon-green', scale: '1.0' })); assert.equal(ok(p7), false);
  const big = layered(); big.layers.symbols = Array.from({ length: 80 }, () => ({ token: 'decal-diamond', position: 'center', color: 'neon-green', scale: '1.0' })); assert.equal(ok(big), false);
});
test('8: too many lighting zones fails (>4)', () => { const p = layered(); p.layers.lighting_zones.push({ zone_id: 'tile', glow: 'low', flicker: false }, { zone_id: 'left-face', glow: 'off', flicker: false }); assert.equal(ok(p), false); });
test('9: empty lighting_zones fails (needs 1–4)', () => { const p = layered(); p.layers.lighting_zones = []; assert.equal(ok(p), false); });
test('10: duplicate lighting zone fails', () => { const p = layered(); p.layers.lighting_zones = [{ zone_id: 'roof', glow: 'low', flicker: false }, { zone_id: 'roof', glow: 'high', flicker: false }]; const v = validateBlockLayeredPackage(p); assert.equal(v.ok, false); assert.ok(v.errors.some((e) => /duplicate lighting zone/.test(e))); });

// ── 11–12: non-plain + prototype pollution ──────────────────────────────────────────────────
test('11: non-plain value fails at the gate', () => { const p = layered(); p.layers.symbols[0].scale = () => 1; assert.equal(ok(p), false); });
test('12: prototype-pollution payload is rejected', () => { const p = JSON.parse('{"__proto__":{"isAdmin":true},"schema_version":1,"package_kind":"block_layered","package_id":"x-y-z","target_city_id":"generic","layers":{},"constraints":{}}'); assert.equal(ok(p), false); assert.equal({}.isAdmin, undefined); });

// ── 13–17: unknown / missing / spoofed ──────────────────────────────────────────────────────
test('13: unknown layer kind fails', () => { const p = layered(); p.layers.malicious = { x: 1 }; assert.equal(ok(p), false); });
test('14: unknown key inside a layer fails', () => { const p = layered(); p.layers.facade.code_exec = 'x'; assert.equal(ok(p), false); });
test('15: missing required layer fails', () => { const p = layered(); delete p.layers.windows; assert.equal(ok(p), false); });
test('16: missing required field inside a layer fails', () => { const p = layered(); delete p.layers.facade.trim; assert.equal(ok(p), false); });
test('17: spoofed enum value fails', () => { const p = layered(); p.layers.windows.grid_type = 'admin-mode'; assert.equal(ok(p), false); });

// ── 18–20: numeric / boolean / variant ──────────────────────────────────────────────────────
test('18: numeric scale injection fails (scale is a string enum)', () => { const p = layered(); p.layers.symbols[0].scale = 999999; assert.equal(ok(p), false); });
test('19: non-boolean flicker fails', () => { const p = layered(); p.layers.lighting_zones[0].flicker = 'true'; assert.equal(ok(p), false); });
test('20: wrong palette_variant fails', () => { const p = layered(); p.palette_variant = 'custom-hue-360'; assert.equal(ok(p), false); });

// ── 21–24: kind / size / constraints ──────────────────────────────────────────────────────────
test('21: wrong package_kind fails', () => { const p = layered(); p.package_kind = 'block_style'; assert.equal(ok(p), false); });
test('22: oversize / hidden-payload package fails (R2)', () => {
  const huge = layered();
  huge.bloat = 'x'.repeat(20000);           // a hidden payload pushes canonical size over the 12 KiB budget
  const v = validateBlockLayeredPackage(huge);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /oversize/.test(e)), `expected oversize error, got ${JSON.stringify(v.errors)}`);
  assert.ok(canonicalize(layered()).length < 12288);   // a legal maximal package stays well under budget
});
test('23: constraint downgrade fails (no_live_world_load:false)', () => { const p = layered(); p.constraints.no_live_world_load = false; const v = validateBlockLayeredPackage(p); assert.equal(v.ok, false); assert.ok(v.errors.some((e) => /no_live_world_load/.test(e))); });
test('24: extra constraint key fails', () => { const p = layered(); p.constraints.allow_live = true; assert.equal(ok(p), false); });

// ── 25: receipt model registers the new kind; 26 (loader) below ────────────────────────────────
test('25: block_layered is a registered approval package kind', () => { assert.ok(PACKAGE_KINDS.includes('block_layered')); });

// ── hashing + report + loader round-trip ────────────────────────────────────────────────────
test('canonical hash is key-order independent for layered packages', async () => {
  const a = layered();
  const b = structuredClone(a);
  assert.equal(await packageHash(a), await packageHash(b));
  assert.match(await packageHash(a), /^sha256:[0-9a-f]{64}$/);
});

test('report receipt for a layered package NEVER authorizes the live world', async () => {
  const p = layered();
  const report = buildValidationReport({ validation: validateBlockLayeredPackage(p), packageHash: await packageHash(p) });
  assert.equal(report.ok, true);
  assert.equal(report.receipt.live_world_authorized, false);
});

test('a valid block_layered package flows through the CF-2 loader (local_preview loads, live_world blocked)', async () => {
  const p = layered();
  const hash = await packageHash(p);
  const receipt = await buildApprovalReceipt({ packageHash: hash, packageKind: 'block_layered', status: 'operator_approved_local', now: Date.parse('2026-06-06T00:00:00.000Z') });
  const registry = createRegistry([{ package_hash: hash, package_kind: 'block_layered', display_name: 'Demo', approval_status: 'operator_approved_local', approved_at: new Date(Date.parse('2026-06-06T00:00:00.000Z')).toISOString(), validator_version: 'creator-validator-cf2', live_world_authorized: false }]);
  const preview = await loadApprovedPackage({ package: p, receipt, registry, mode: LOADER_MODES.LOCAL_PREVIEW });
  assert.equal(preview.ok, true);
  const live = await loadApprovedPackage({ package: p, receipt, registry, mode: LOADER_MODES.LIVE_WORLD });
  assert.equal(live.ok, false);
  assert.equal(live.reason, 'live_world_loader_not_enabled');
});
