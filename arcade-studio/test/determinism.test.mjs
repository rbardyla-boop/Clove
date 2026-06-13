import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalize, canonicalPretty, hashAsset } from '../src/importExport/hashAsset.js';
import { buildArcadeAsset } from '../src/importExport/exportArcadeAsset.js';
import { validAssetModel } from './fixtures.mjs';

function shuffleKeys(obj) {
  if (Array.isArray(obj)) return obj.map(shuffleKeys);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj).reverse()) out[k] = shuffleKeys(obj[k]);
    return out;
  }
  return obj;
}

test('canonicalize is independent of key order', () => {
  const a = buildArcadeAsset(validAssetModel());
  const b = shuffleKeys(a);
  assert.equal(canonicalize(a), canonicalize(b));
});

test('content hash is independent of key order', async () => {
  const a = buildArcadeAsset(validAssetModel());
  const b = shuffleKeys(a);
  assert.equal(await hashAsset(a), await hashAsset(b));
});

test('canonical pretty output is stable and human-readable', () => {
  const a = buildArcadeAsset(validAssetModel());
  const out = canonicalPretty(a);
  assert.equal(out, canonicalPretty(buildArcadeAsset(validAssetModel())));
  assert.match(out, /\n {2}"asset_id"/); // 2-space indented, sorted keys
});

test('the same model exported twice is byte-identical (no time/random in output)', () => {
  assert.equal(canonicalPretty(buildArcadeAsset(validAssetModel())), canonicalPretty(buildArcadeAsset(validAssetModel())));
});
