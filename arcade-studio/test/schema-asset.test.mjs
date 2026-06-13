import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArcadeAsset } from '../src/importExport/exportArcadeAsset.js';
import { validateArcadeAsset } from '../src/validation/validateArcadeAsset.js';
import { validAssetModel } from './fixtures.mjs';

test('a well-formed cabinet asset passes validation', () => {
  const r = validateArcadeAsset(buildArcadeAsset(validAssetModel()));
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.equal(r.kind, 'arcade_cabinet_asset');
});

test('unknown top-level key is rejected', () => {
  const asset = buildArcadeAsset(validAssetModel());
  asset.surprise = 1;
  const r = validateArcadeAsset(asset);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /unknown key "surprise"/);
});

test('unknown cabinet field is rejected', () => {
  const asset = buildArcadeAsset(validAssetModel());
  asset.cabinet.extra_widget = 'x';
  const r = validateArcadeAsset(asset);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /cabinet: unknown key "extra_widget"/);
});

test('out-of-vocabulary enum token is rejected', () => {
  const asset = buildArcadeAsset(validAssetModel());
  asset.cabinet.type = 'spaceship';
  const r = validateArcadeAsset(asset);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /cabinet\.type must be one of/);
});

test('missing required cabinet field is rejected', () => {
  const asset = buildArcadeAsset(validAssetModel());
  delete asset.cabinet.palette;
  const r = validateArcadeAsset(asset);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /missing key "palette"/);
});

test('bad asset_id (not a clean slug) is rejected', () => {
  const asset = buildArcadeAsset(validAssetModel());
  asset.asset_id = 'Neon Blaster!!';
  const r = validateArcadeAsset(asset);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /asset_id must be a clean kebab slug/);
});

test('over-long marquee text is rejected', () => {
  const asset = buildArcadeAsset(validAssetModel());
  asset.cabinet.marquee_text = 'X'.repeat(64);
  const r = validateArcadeAsset(asset);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /marquee_text exceeds/);
});

test('too many tags is rejected', () => {
  const asset = buildArcadeAsset(validAssetModel());
  asset.metadata.tags = Array.from({ length: 20 }, (_, i) => `tag-${i}`);
  const r = validateArcadeAsset(asset);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /tags must be an array of/);
});
