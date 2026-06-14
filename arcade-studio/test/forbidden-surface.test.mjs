import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArcadeAsset } from '../src/importExport/exportArcadeAsset.js';
import { buildArcadeLayout } from '../src/importExport/exportArcadeLayout.js';
import { validateArcadeAsset } from '../src/validation/validateArcadeAsset.js';
import { validateArcadeLayout } from '../src/validation/validateArcadeLayout.js';
import { FORBIDDEN_CAPABILITY_KEYS } from '../src/validation/safety.js';
import { FORBIDDEN_KEY_NAMES } from '../src/validation/forbiddenSurfaceChecks.js';
import { validAssetModel, validLayoutModel } from './fixtures.mjs';

test('every forbidden capability flag is rejected when injected into an asset', () => {
  for (const cap of FORBIDDEN_CAPABILITY_KEYS) {
    const asset = buildArcadeAsset(validAssetModel());
    asset.cabinet[cap] = false; // even false must fail closed — the KEY is the surface
    const r = validateArcadeAsset(asset);
    assert.equal(r.ok, false, `expected rejection for capability key: ${cap}`);
  }
});

test('the dangerous flag names from the goal are all rejected', () => {
  const required = ['live_world_authorized', 'ticket_hooks', 'prize_hooks', 'ledger_hooks', 'upload_enabled', 'remote_submit', 'arbitrary_script', 'external_asset_url'];
  for (const k of required) {
    assert.ok(FORBIDDEN_KEY_NAMES.includes(k), `forbidden key list must contain ${k}`);
    const layout = buildArcadeLayout(validLayoutModel());
    layout.metadata[k] = true;
    const r = validateArcadeLayout(layout);
    assert.equal(r.ok, false, `expected rejection for ${k}`);
  }
});

test('an economy/ownership term in a public id is rejected', () => {
  const asset = buildArcadeAsset(validAssetModel());
  asset.asset_id = 'rare-nft-cabinet';
  const r = validateArcadeAsset(asset);
  assert.equal(r.ok, false);
});

test('a URL anywhere in the asset is rejected', () => {
  const asset = buildArcadeAsset(validAssetModel());
  asset.metadata.note = 'see https://example.com/art.png';
  const r = validateArcadeAsset(asset);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /code\/markup\/url\/template|economy/i);
});

test('a private/identity key is rejected', () => {
  const layout = buildArcadeLayout(validLayoutModel());
  layout.metadata.player_id = 'abc';
  const r = validateArcadeLayout(layout);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /private\/identity key|unknown key/);
});

test('a constraints flag set to false fails closed', () => {
  const asset = buildArcadeAsset(validAssetModel());
  asset.constraints.no_scripts = false;
  const r = validateArcadeAsset(asset);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /constraints\.no_scripts must be true/);
});

test('missing constraints block fails closed', () => {
  const asset = buildArcadeAsset(validAssetModel());
  delete asset.constraints;
  const r = validateArcadeAsset(asset);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /constraints block missing|missing key "constraints"/);
});
