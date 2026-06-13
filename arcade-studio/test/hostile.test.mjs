import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArcadeAsset } from '../src/importExport/exportArcadeAsset.js';
import { validateArcadeAsset } from '../src/validation/validateArcadeAsset.js';
import { importArcadeAsset } from '../src/importExport/importArcadeAsset.js';
import { validAssetModel } from './fixtures.mjs';

// Each hostile payload must fail CLOSED (ok:false) and never throw.
test('a function value is rejected as non-plain data', () => {
  const asset = buildArcadeAsset(validAssetModel());
  asset.cabinet.attract_mode = (() => 'off'); // not a string token, not plain data
  const r = validateArcadeAsset(asset);
  assert.equal(r.ok, false);
});

test('NaN / Infinity numbers are rejected', () => {
  const asset = buildArcadeAsset(validAssetModel());
  asset.cabinet.note = Number.POSITIVE_INFINITY;
  const r = validateArcadeAsset(asset);
  assert.equal(r.ok, false);
});

test('a class instance value is rejected', () => {
  const asset = buildArcadeAsset(validAssetModel());
  asset.metadata = new Map([['tags', []]]);
  const r = validateArcadeAsset(asset);
  assert.equal(r.ok, false);
});

test('script-like markup in any string is rejected', () => {
  const asset = buildArcadeAsset(validAssetModel());
  asset.cabinet.marquee_text = '<script>alert(1)</script>';
  const r = validateArcadeAsset(asset);
  assert.equal(r.ok, false);
});

test('arrow-function source text is rejected', () => {
  const asset = buildArcadeAsset(validAssetModel());
  asset.display_name = '() => fetch(0)';
  const r = validateArcadeAsset(asset);
  assert.equal(r.ok, false);
});

test('a __proto__ pollution key from JSON is rejected', async () => {
  const asset = buildArcadeAsset(validAssetModel());
  const json = JSON.stringify({ ...asset, ['__proto__']: { polluted: true } });
  const r = await importArcadeAsset(json);
  assert.equal(r.ok, false);
});

test('over-deep nesting is rejected', () => {
  const asset = buildArcadeAsset(validAssetModel());
  let deep = {};
  let cur = deep;
  for (let i = 0; i < 12; i++) {
    cur.child = {};
    cur = cur.child;
  }
  asset.metadata = deep;
  const r = validateArcadeAsset(asset);
  assert.equal(r.ok, false);
});

test('garbage JSON string is rejected without throwing', async () => {
  const r = await importArcadeAsset('{not valid json');
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /invalid JSON/);
});

test('a totally empty object is rejected', () => {
  const r = validateArcadeAsset({});
  assert.equal(r.ok, false);
});
