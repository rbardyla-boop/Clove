/**
 * Creator Foundation CF-5 — asset-pack validator + resolver unit tests.
 * The core rule: a tile may reference ONLY an approved-local package hash; resolve verifies the body
 * matches the approved hash. Uses the real sample pack/registry + the real sample package bodies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { validateAssetPack, resolveAssetPack } from '../../arcade/creator/validator/validate-asset-pack.mjs';
import { EMPTY_REGISTRY } from '../../arcade/creator/approval/approved-package-registry.mjs';
import { packageHash } from '../../arcade/creator/validator/package-hash.mjs';

const root = fileURLToPath(new URL('../../arcade/creator/', import.meta.url));
const readJSON = (p) => JSON.parse(readFileSync(root + p, 'utf8'));
const PACK = readJSON('samples/sample-asset-pack/pack.json');
const REG = readJSON('samples/sample-asset-pack/registry.json');
const BLOCK = readJSON('samples/sample-block.package.json');
const LAYERED = readJSON('samples/sample-layered.package.json');
const clone = (o) => JSON.parse(JSON.stringify(o));

test('the sample pack validates against its approved registry', () => {
  const r = validateAssetPack(PACK, REG);
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.equal(r.limits.tile_count, 2);
});

test('a tile referencing an UNAPPROVED hash is rejected (approved hashes only)', () => {
  const p = clone(PACK);
  p.tiles[0].package_hash = 'sha256:' + '0'.repeat(64); // not in registry
  const r = validateAssetPack(p, REG);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /not approved-local/.test(e)));
});

test('an EMPTY registry approves nothing → every tile rejected', () => {
  const r = validateAssetPack(PACK, EMPTY_REGISTRY);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /not approved-local/.test(e)));
});

test('package_kind must match the registry entry kind', () => {
  const p = clone(PACK);
  p.tiles[0].package_kind = 'block_layered'; // registry says block_style for this hash
  const r = validateAssetPack(p, REG);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /!= registry entry kind/.test(e)));
});

test('grid bounds, tile-in-grid, and unique positions are enforced', () => {
  assert.equal(validateAssetPack({ ...clone(PACK), grid: { cols: 99, rows: 2 } }, REG).ok, false);     // cols > MAX
  const oob = clone(PACK); oob.tiles[0].gx = 5;                                                          // gx >= cols
  assert.equal(validateAssetPack(oob, REG).ok, false);
  const dup = clone(PACK); dup.tiles[1].gx = 0; dup.tiles[1].gy = 0;                                     // duplicate pos
  assert.ok(validateAssetPack(dup, REG).errors.some((e) => /duplicate tile position/.test(e)));
});

test('deny-by-default: unknown keys, bad kind, bad constraints, economy/markup/url all rejected', () => {
  assert.ok(validateAssetPack({ ...clone(PACK), evil: 1 }, REG).errors.some((e) => /unknown top key/.test(e)));
  const badKind = clone(PACK); badKind.tiles[0].package_kind = 'arcade_game';
  assert.ok(validateAssetPack(badKind, REG).errors.some((e) => /package_kind must be one of/.test(e)));
  const badConstraint = clone(PACK); badConstraint.constraints.no_live_world_load = false;
  assert.ok(validateAssetPack(badConstraint, REG).errors.some((e) => /no_live_world_load must be true/.test(e)));
  assert.equal(validateAssetPack({ ...clone(PACK), display_name: 'buy and sell blocks' }, REG).ok, false); // economy
  assert.equal(validateAssetPack({ ...clone(PACK), pack_id: 'see http://x' }, REG).ok, false);             // url/scan
});

test('an INVALID registry makes the pack invalid (cannot approve)', () => {
  const r = validateAssetPack(PACK, { schema_version: 1, registry_kind: 'wrong', packages: [] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /registry invalid/.test(e)));
});

test('resolveAssetPack resolves approved tiles whose body hash matches', async () => {
  // build the local package store keyed by the bodies' real hashes
  const store = {};
  store[await packageHash(BLOCK)] = BLOCK;
  store[await packageHash(LAYERED)] = LAYERED;
  // sanity: the sample hashes in the pack/registry match the real bodies
  assert.equal(await packageHash(BLOCK), PACK.tiles[0].package_hash);
  assert.equal(await packageHash(LAYERED), PACK.tiles[1].package_hash);
  const r = await resolveAssetPack(PACK, REG, store);
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.equal(r.tiles.length, 2);
  assert.deepEqual(r.tiles.map((t) => t.package_kind).sort(), ['block_layered', 'block_style']);
});

test('resolveAssetPack rejects a body that does not match the approved hash (tamper)', async () => {
  const tampered = clone(BLOCK); tampered.display_name = 'Mutated After Approval';
  const store = {};
  store[PACK.tiles[0].package_hash] = tampered;          // body under the approved hash, but mutated
  store[PACK.tiles[1].package_hash] = LAYERED;
  const r = await resolveAssetPack(PACK, REG, store);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /body hash .* != approved hash/.test(e)));
});

test('resolveAssetPack reports a missing body', async () => {
  const store = {};
  store[PACK.tiles[0].package_hash] = BLOCK; // omit the layered body
  const r = await resolveAssetPack(PACK, REG, store);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /missing from local store/.test(e)));
});
