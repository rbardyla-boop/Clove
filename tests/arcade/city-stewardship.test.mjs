/**
 * Phase 4F — Block Stewardship + Constrained Editor (PURE). Proves stewardship is
 * deterministic, gated by current non-cash Host Rank eligibility, manifest-constrained
 * (only enum visual fields survive — never css/html/js/url/text), reversible
 * (preview never persists; reset returns the city default), immutable, and carries no
 * money/ownership/account fields.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateStewardship, isStewardshipEligible, sanitizeStyle, mergeBlockStyle,
  normalizeBlockStyle, defaultBlockStyle, styleToAccents, stewardshipStatePayload,
  blockStyleChanged, ALLOWED_TARGETS, ALLOWED_PALETTES, PALETTE_HEX,
} from '../../arcade/city/city-stewardship.mjs';
import { SCHEMA_VERSION } from '../../arcade/city/city-block.mjs';

const OBSERVER = { tier: 'observer', support_signal: 'quiet' };
const HELPER = { tier: 'helper', support_signal: 'steady' };
const SIGNALER = { tier: 'signaler', support_signal: 'active' };
const NOW = 7_000_000;
const reqApply = (target, style) => ({ request_id: 'r1', action: 'apply', target, style });

test('eligibility: observer/quiet is NOT eligible; helper/signaler/anchor or steady/active IS', () => {
  assert.equal(isStewardshipEligible(OBSERVER), false);
  assert.equal(isStewardshipEligible(HELPER), true);
  assert.equal(isStewardshipEligible(SIGNALER), true);
  assert.equal(isStewardshipEligible({ tier: 'anchor', support_signal: 'quiet' }), true);
  assert.equal(isStewardshipEligible({ tier: 'observer', support_signal: 'steady' }), true); // signal path
  assert.equal(isStewardshipEligible(null), false);
  // accepts the full Host Rank snapshot too
  assert.equal(isStewardshipEligible({ host_rank: HELPER }), true);
  assert.equal(isStewardshipEligible({ host_rank: OBSERVER }), false);
});

test('observer cannot preview / apply / reset (host_rank_too_low)', () => {
  for (const action of ['preview', 'apply', 'reset']) {
    const r = evaluateStewardship({ cityId: 'downtown-01', now: NOW, hostRank: OBSERVER, currentStewardship: null, request: { action, target: 'arcade_front', style: { palette: 'amber' } } });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'host_rank_too_low');
    assert.equal(r.public_safe, true);
  }
});

test('helper can apply an allowed visual edit → merged canonical style', () => {
  const r = evaluateStewardship({ cityId: 'downtown-01', now: NOW, hostRank: HELPER, currentStewardship: null, request: reqApply('arcade_front', { palette: 'amber', sign_variant: 'circuit', intensity: 'high' }) });
  assert.equal(r.ok, true);
  assert.equal(r.action, 'apply');
  assert.equal(r.target, 'arcade_front');
  assert.equal(r.canonical_style.arcade_front.palette, 'amber');
  assert.equal(r.canonical_style.arcade_front.sign_variant, 'circuit');
  assert.equal(r.canonical_style.arcade_front.intensity, 'high');
  // untouched targets keep their default
  assert.equal(r.canonical_style.street_lights.palette, 'cyan');
});

test('preview returns a preview_style but leaves canonical UNCHANGED (non-persistent)', () => {
  const current = defaultBlockStyle();
  const r = evaluateStewardship({ now: NOW, hostRank: HELPER, currentStewardship: current, request: { action: 'preview', target: 'street_lights', style: { palette: 'amber', intensity: 'high' } } });
  assert.equal(r.ok, true);
  assert.equal(r.action, 'preview');
  assert.equal(r.preview_style.street_lights.palette, 'amber');
  assert.equal(r.canonical_style.street_lights.palette, 'cyan'); // canonical is the unchanged default
});

test('reset returns the city default for every target', () => {
  const customized = mergeBlockStyle(defaultBlockStyle(), 'arcade_front', { palette: 'white' });
  const r = evaluateStewardship({ now: NOW, hostRank: SIGNALER, currentStewardship: customized, request: { action: 'reset' } });
  assert.equal(r.ok, true);
  assert.equal(r.action, 'reset');
  assert.deepEqual(r.canonical_style, defaultBlockStyle());
});

test('invalid action / target are rejected', () => {
  assert.equal(evaluateStewardship({ now: NOW, hostRank: HELPER, request: { action: 'nuke' } }).reason, 'bad_action');
  assert.equal(evaluateStewardship({ now: NOW, hostRank: HELPER, request: reqApply('the_whole_city', { palette: 'amber' }) }).reason, 'bad_target');
});

test('invalid palette/sign/intensity are dropped; an edit with no valid field is rejected', () => {
  // out-of-enum values are dropped by the sanitizer
  assert.deepEqual(sanitizeStyle('arcade_front', { palette: '#bada55', sign_variant: 'rainbow', intensity: 'ULTRA' }), {});
  // sign_variant/intensity are not applicable to sidewalk_trim → dropped
  assert.deepEqual(sanitizeStyle('sidewalk_trim', { palette: 'amber', sign_variant: 'circuit', intensity: 'high' }), { palette: 'amber' });
  // an apply whose every field is invalid → no_valid_style
  assert.equal(evaluateStewardship({ now: NOW, hostRank: HELPER, request: reqApply('arcade_front', { palette: 'gold' }) }).reason, 'no_valid_style');
});

test('arbitrary css/html/js/url/text/script fields can NEVER survive sanitize or output', () => {
  const malicious = {
    palette: 'amber',
    css: 'body{display:none}', html: '<img src=x onerror=alert(1)>', js: 'fetch("//evil")',
    url: 'https://evil.example', script: 'alert(1)', label: 'OWN THIS BLOCK', style_blob: '...',
    onclick: 'x', __proto__: { polluted: true },
  };
  const clean = sanitizeStyle('arcade_front', malicious);
  assert.deepEqual(Object.keys(clean), ['palette']); // ONLY the allowlisted enum field
  const r = evaluateStewardship({ now: NOW, hostRank: HELPER, request: reqApply('arcade_front', malicious) });
  const json = JSON.stringify(r);
  assert.ok(!/evil|onerror|alert|display:none|style_blob|OWN THIS|polluted/i.test(json));
});

test('output carries no money/economy/ownership fields', () => {
  const r = evaluateStewardship({ now: NOW, hostRank: SIGNALER, request: reqApply('arcade_front', { palette: 'magenta', intensity: 'high' }) });
  assert.ok(!/balance|ledger|inventory|ticket|token|cash|payout|reward|price|own(er|ership)|stake|wager|rent|income|market|land/i.test(JSON.stringify(r)));
});

test('evaluate does not mutate its inputs', () => {
  const current = defaultBlockStyle();
  const currentCopy = JSON.parse(JSON.stringify(current));
  const request = reqApply('arcade_front', { palette: 'white' });
  const requestCopy = JSON.parse(JSON.stringify(request));
  evaluateStewardship({ now: NOW, hostRank: HELPER, currentStewardship: current, request });
  assert.deepEqual(current, currentCopy);
  assert.deepEqual(request, requestCopy);
});

test('mergeBlockStyle is immutable and normalizes junk input', () => {
  const base = defaultBlockStyle();
  const merged = mergeBlockStyle(base, 'arcade_front', { palette: 'amber' });
  assert.notEqual(merged, base);
  assert.equal(base.arcade_front.palette, 'magenta');   // original untouched
  assert.equal(merged.arcade_front.palette, 'amber');
  // junk canonical normalizes back onto the default
  const fixed = normalizeBlockStyle({ arcade_front: { palette: 'evil', hack: 1 }, bogus: {} });
  assert.equal(fixed.arcade_front.palette, 'magenta');
  assert.equal(Object.keys(fixed).sort().join(','), [...ALLOWED_TARGETS].sort().join(','));
});

test('styleToAccents maps only allowlisted tokens to in-palette hex + glow multiplier', () => {
  const acc = styleToAccents(defaultBlockStyle());
  assert.equal(acc.arcade_front.color, PALETTE_HEX.magenta);
  assert.equal(acc.street_lights.color, PALETTE_HEX.cyan);
  assert.equal(acc.sidewalk_trim.color, PALETTE_HEX.cyan);
  assert.equal(typeof acc.arcade_front.blur, 'number');
  const amber = styleToAccents(mergeBlockStyle(defaultBlockStyle(), 'arcade_front', { palette: 'amber', intensity: 'high' }));
  assert.equal(amber.arcade_front.color, PALETTE_HEX.amber);
  assert.ok(amber.arcade_front.blur > acc.arcade_front.blur); // high > medium
  // every produced color is one of the four sanctioned hexes
  for (const t of ALLOWED_TARGETS) assert.ok(Object.values(PALETTE_HEX).includes(amber[t].color));
});

test('stewardshipStatePayload + blockStyleChanged are public-safe and correct', () => {
  const pl = stewardshipStatePayload(defaultBlockStyle());
  assert.equal(pl.schema_version, SCHEMA_VERSION);
  assert.deepEqual(pl.stewardship, defaultBlockStyle());
  assert.equal(blockStyleChanged(defaultBlockStyle(), defaultBlockStyle()), false);
  assert.equal(blockStyleChanged(defaultBlockStyle(), mergeBlockStyle(defaultBlockStyle(), 'arcade_front', { palette: 'amber' })), true);
  assert.ok(ALLOWED_PALETTES.length === 4);
});

test('deterministic: same inputs yield a deep-equal result', () => {
  const args = { cityId: 'downtown-01', now: NOW, hostRank: HELPER, currentStewardship: defaultBlockStyle(), request: reqApply('sidewalk_trim', { palette: 'white' }) };
  assert.deepEqual(evaluateStewardship(args), evaluateStewardship(args));
});
