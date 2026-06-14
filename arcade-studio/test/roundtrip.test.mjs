import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportArcadeAsset } from '../src/importExport/exportArcadeAsset.js';
import { importArcadeAsset } from '../src/importExport/importArcadeAsset.js';
import { exportArcadeLayout } from '../src/importExport/exportArcadeLayout.js';
import { importArcadeLayout } from '../src/importExport/importArcadeLayout.js';
import { validAssetModel, validLayoutModel } from './fixtures.mjs';

test('cabinet asset export → import round-trips identically', async () => {
  const exp = await exportArcadeAsset(validAssetModel());
  assert.equal(exp.ok, true, exp.report.errors.join('; '));
  assert.match(exp.hash, /^sha256:[0-9a-f]{64}$/);

  const imp = await importArcadeAsset(exp.json);
  assert.equal(imp.ok, true, imp.errors.join('; '));
  assert.deepEqual(imp.asset, exp.asset, 'imported asset must equal exported asset');
  assert.equal(imp.hash, exp.hash, 'content hash must survive the round-trip');
});

test('building layout export → import round-trips identically', async () => {
  const exp = await exportArcadeLayout(validLayoutModel());
  assert.equal(exp.ok, true, exp.report.errors.join('; '));
  assert.match(exp.hash, /^sha256:[0-9a-f]{64}$/);

  const imp = await importArcadeLayout(exp.json);
  assert.equal(imp.ok, true, imp.errors.join('; '));
  assert.deepEqual(imp.layout, exp.layout);
  assert.equal(imp.hash, exp.hash);
});

test('re-exporting an imported asset yields byte-identical JSON', async () => {
  const exp1 = await exportArcadeAsset(validAssetModel());
  const imp = await importArcadeAsset(exp1.json);
  const exp2 = await exportArcadeAsset({
    asset_id: imp.asset.asset_id,
    display_name: imp.asset.display_name,
    cabinet: imp.asset.cabinet,
    effects: imp.asset.effects,
    metadata: imp.asset.metadata,
  });
  assert.equal(exp2.json, exp1.json, 'export must be deterministic across a round-trip');
});

test('importing tampered JSON (unknown key added) fails closed', async () => {
  const exp = await exportArcadeAsset(validAssetModel());
  const tampered = JSON.parse(exp.json);
  tampered.injected = { live_world_authorized: true };
  const imp = await importArcadeAsset(JSON.stringify(tampered));
  assert.equal(imp.ok, false);
});
