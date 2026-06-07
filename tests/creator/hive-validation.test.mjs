/**
 * Creator Foundation CF-6 — Hive validation service prototype unit tests.
 * Proves: equivalence with the canonical validators (= the CLI), hash-bound verdicts, the quarantine
 * boundary (no verdict ever authorizes a live load / content clearance), and an adversarial suite.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  createHiveService, buildHiveReceipt, validatePackage, recomputeReceiptHash, isReceiptIntact,
  HIVE_RECEIPT_KIND, VALIDATOR_VERSION,
} from '../../arcade/creator/hive-validation/hive-service.mjs';
// the EXACT validators the CLI dispatches to — for the equivalence proof
import { validateBlockPackage } from '../../arcade/creator/validator/validate-block-package.mjs';
import { validateBlockLayeredPackage } from '../../arcade/creator/validator/validate-block-layered-package.mjs';
import { validateArcadePackage } from '../../arcade/creator/validator/validate-arcade-package.mjs';

const samples = fileURLToPath(new URL('../../arcade/creator/samples/', import.meta.url));
const readJSON = (p) => JSON.parse(readFileSync(samples + p, 'utf8'));
const BLOCK = readJSON('sample-block.package.json');
const LAYERED = readJSON('sample-layered.package.json');
const ARCADE = readJSON('arcade-sample/manifest.json');

test('valid package → a hash-bound "valid" verdict that authorizes nothing', async () => {
  const r = await buildHiveReceipt(BLOCK);
  assert.equal(r.kind, HIVE_RECEIPT_KIND);
  assert.equal(r.verdict, 'valid');
  assert.equal(r.validator_version, VALIDATOR_VERSION);
  assert.match(r.package_hash, /^sha256:[0-9a-f]{64}$/);
  // hard invariants — a verdict is never approval / live / content-cleared
  assert.equal(r.status, 'local_validation_only');
  assert.equal(r.live_world_authorized, false);
  assert.equal(r.content_cleared, false);
  // receipt is hash-bound (tamper-evident)
  assert.match(r.receipt_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(await recomputeReceiptHash(r), r.receipt_hash);
  assert.equal(await isReceiptIntact(r), true);
});

test('EQUIVALENCE: the service verdict matches the canonical validators (= the CLI) for every kind', async () => {
  const cases = [
    [BLOCK, validateBlockPackage],
    [LAYERED, validateBlockLayeredPackage],
    [ARCADE, validateArcadePackage],
  ];
  for (const [pkg, validator] of cases) {
    const direct = validator(pkg);
    const viaService = validatePackage(pkg);
    assert.equal(viaService.ok, direct.ok, `${pkg.package_kind}: ok parity`);
    assert.deepEqual(viaService.errors, direct.errors, `${pkg.package_kind}: errors parity`);
    const receipt = await buildHiveReceipt(pkg);
    assert.equal(receipt.verdict, direct.ok ? 'valid' : 'invalid', `${pkg.package_kind}: verdict parity`);
  }
});

test('EQUIVALENCE holds for malformed variants too', async () => {
  const broken = { ...BLOCK, package_id: 'BAD ID with spaces' };
  const direct = validateBlockPackage(broken);
  const viaService = validatePackage(broken);
  assert.equal(viaService.ok, false);
  assert.equal(direct.ok, false);
  assert.deepEqual(viaService.errors, direct.errors);
});

test('invalid package → "invalid" verdict, but STILL never live-authorized', async () => {
  const r = await buildHiveReceipt({ ...BLOCK, package_id: 'no spaces allowed!' });
  assert.equal(r.verdict, 'invalid');
  assert.ok(r.errors.length > 0);
  assert.equal(r.live_world_authorized, false);
  assert.equal(r.content_cleared, false);
});

test('QUARANTINE: a package claiming live authorization is ignored (and rejected as an unknown key)', async () => {
  const sneaky = { ...BLOCK, live_world_authorized: true, content_cleared: true };
  const r = await buildHiveReceipt(sneaky);
  assert.equal(r.live_world_authorized, false); // forced false regardless of package claim
  assert.equal(r.content_cleared, false);
  assert.equal(r.verdict, 'invalid'); // strict validators reject the unknown top key
});

test('QUARANTINE: the service exposes NO approve / enable-live / register capability', () => {
  const service = createHiveService();
  for (const forbidden of ['approve', 'enableLive', 'enableLiveWorld', 'register', 'registerCabinet', 'setLiveWorldLoaderEnabled', 'publish', 'deploy']) {
    assert.equal(typeof service[forbidden], 'undefined', `service must NOT expose ${forbidden}`);
  }
  // only the validation-boundary surface exists
  assert.equal(typeof service.submit, 'function');
  assert.equal(typeof service.lookup, 'function');
  assert.equal(typeof service.queue, 'function');
});

test('service: submit enqueues, lookup is read-only, queue carries no live authorization', async () => {
  const service = createHiveService();
  const r = await service.submit(BLOCK);
  await service.submit(ARCADE);
  assert.equal(service.size, 2);
  const found = service.lookup(r.package_hash);
  assert.equal(found.package_hash, r.package_hash);
  assert.equal(service.lookup('sha256:' + '0'.repeat(64)), null); // unknown hash
  const q = service.queue();
  assert.equal(q.length, 2);
  for (const e of q) assert.equal(e.live_world_authorized, false);
  // queue() returns copies (mutating the result must not affect the service)
  q[0].verdict = 'tampered';
  assert.notEqual(service.queue()[0].verdict, 'tampered');
});

test('tampered receipt is detected (hash-bound)', async () => {
  const r = await buildHiveReceipt(BLOCK);
  const tampered = { ...r, verdict: 'valid', live_world_authorized: true }; // forge live authorization
  assert.notEqual(await recomputeReceiptHash(tampered), tampered.receipt_hash);
  assert.equal(await isReceiptIntact(tampered), false);
  const tampered2 = { ...r, errors: ['changed'] };
  assert.equal(await isReceiptIntact(tampered2), false);
});

test('deterministic: same package → same hash + verdict + receipt_hash', async () => {
  const a = await buildHiveReceipt(BLOCK, 1700000000000);
  const b = await buildHiveReceipt(BLOCK, 1700000000000);
  assert.equal(a.package_hash, b.package_hash);
  assert.equal(a.receipt_hash, b.receipt_hash);
  assert.equal(a.verdict, b.verdict);
});

test('unknown package_kind fails closed', async () => {
  const r = await buildHiveReceipt({ package_kind: 'totally_unknown', schema_version: 1 });
  assert.equal(r.verdict, 'invalid');
  assert.ok(r.errors.some((e) => /unknown package_kind/.test(e)));
  assert.equal(r.live_world_authorized, false);
});

test('adversarial suite — every hostile package is rejected, none authorized', async () => {
  const corpus = [
    { name: 'script injection', pkg: { ...BLOCK, display_name: '<script>alert(1)</script>' } },
    { name: 'external url', pkg: { ...BLOCK, display_name: 'see http://evil.example' } },
    { name: 'forbidden economy copy', pkg: { ...BLOCK, display_name: 'buy tickets for profit' } },
    { name: 'unknown field', pkg: { ...BLOCK, secret_backdoor: true } },
    { name: 'unknown kind', pkg: { package_kind: 'nope', schema_version: 1 } },
    { name: 'live auth attempt', pkg: { ...ARCADE, live_world_authorized: true } },
  ];
  for (const { name, pkg } of corpus) {
    const r = await buildHiveReceipt(pkg);
    assert.equal(r.verdict, 'invalid', `${name} must be invalid`);
    assert.equal(r.live_world_authorized, false, `${name} must not be live-authorized`);
    assert.equal(r.content_cleared, false, `${name} must not be content-cleared`);
  }
});
