/**
 * Creator Foundation CF-2 — approved package registry tests.
 *   node --test tests/creator/*.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRegistry, validateRegistry, findRegistryEntry, resolveApprovedPackage, isApprovedLocal,
  EMPTY_REGISTRY, REGISTRY_KIND,
} from '../../arcade/creator/approval/approved-package-registry.mjs';

const HASH = 'sha256:' + 'c'.repeat(64);
const entry = (over = {}) => ({
  package_hash: HASH, package_kind: 'block_style', display_name: 'Demo Neon Facade',
  approval_status: 'operator_approved_local', approved_at: '2026-06-06T00:00:00.000Z',
  validator_version: 'creator-validator-cf2', live_world_authorized: false, ...over,
});

test('a well-formed registry validates', () => {
  assert.equal(validateRegistry(createRegistry([entry()])).ok, true);
});

test('the EMPTY_REGISTRY is valid and approves nothing', () => {
  assert.equal(validateRegistry(EMPTY_REGISTRY).ok, true);
  assert.equal(resolveApprovedPackage(EMPTY_REGISTRY, HASH), null);
  assert.equal(EMPTY_REGISTRY.registry_kind, REGISTRY_KIND);
});

test('registry with an unknown TOP field is rejected', () => {
  const reg = createRegistry([entry()]);
  reg.live_world = true;
  assert.equal(validateRegistry(reg).ok, false);
});

test('registry with an unknown ENTRY field is rejected', () => {
  const reg = createRegistry([entry({ live_world_loader: 'on' })]);
  const v = validateRegistry(reg);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /unknown key/.test(e)));
});

test('entry with live_world_authorized:true is rejected', () => {
  const v = validateRegistry(createRegistry([entry({ live_world_authorized: true })]));
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /live_world_authorized must be false/.test(e)));
});

test('duplicate package_hash is rejected', () => {
  assert.equal(validateRegistry(createRegistry([entry(), entry()])).ok, false);
});

test('out-of-allowlist status and missing key are rejected', () => {
  assert.equal(validateRegistry(createRegistry([entry({ approval_status: 'production_approved' })])).ok, false);
  const e = entry(); delete e.validator_version;
  assert.equal(validateRegistry(createRegistry([e])).ok, false);
});

test('findRegistryEntry / resolveApprovedPackage / isApprovedLocal', () => {
  const reg = createRegistry([entry()]);
  assert.ok(findRegistryEntry(reg, HASH));
  assert.equal(findRegistryEntry(reg, 'sha256:' + 'd'.repeat(64)), null);
  assert.ok(resolveApprovedPackage(reg, HASH));
  assert.equal(isApprovedLocal(entry()), true);
});

test('a local_validation_only entry resolves as NOT approved', () => {
  const reg = createRegistry([entry({ approval_status: 'local_validation_only' })]);
  assert.equal(resolveApprovedPackage(reg, HASH), null);
  assert.equal(isApprovedLocal(entry({ approval_status: 'local_validation_only' })), false);
});
