/**
 * Turf Wars Phase 1 lab — CONTENT-ADDRESSED, HOST-SIGNED SNAPSHOT tests.
 *   node --test tests/arcade/turf-wars-snapshot.test.mjs
 *
 * Proves: identical state → identical address; a changed op → a different address; a host-signed
 * snapshot verifies; a tampered snapshot fails (address + signature); a cached record verifies with NO
 * access to the signer (offline reachability). Lab-only — denylisted from the production upload.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identityFromSeed } from '../../arcade/hiveworld-agents/turf-wars/identity.mjs';
import { foldBlock } from '../../arcade/hiveworld-agents/turf-wars/block-log.mjs';
import {
  projectSnapshot, snapshotAddress, signSnapshot, verifySnapshot,
} from '../../arcade/hiveworld-agents/turf-wars/snapshot.mjs';
import { buildSignedChain, honestSteps, blockIdFor, structureId } from '../../arcade/hiveworld-agents/turf-wars/turf-evidence.mjs';
import { isContentAddress } from '../../arcade/hiveworld-agents/turf-wars/canonical.mjs';

const alice = identityFromSeed('alice');
const BLOCK = blockIdFor(alice);
const honestState = () => foldBlock(buildSignedChain(alice, BLOCK, honestSteps()));

test('identical state folds to an identical, well-formed snapshot address', () => {
  const a = snapshotAddress(projectSnapshot(honestState()));
  const b = snapshotAddress(projectSnapshot(honestState()));
  assert.equal(a, b);
  assert.ok(isContentAddress(a));
});

test('a different op set yields a different snapshot address', () => {
  const baseAddr = snapshotAddress(projectSnapshot(honestState()));
  const extra = [...honestSteps(), { type: 'build_structure', payload: { structure_id: structureId('extra'), kind: 'light_rig', x: 9, y: 9 }, tick: 7 }];
  const otherAddr = snapshotAddress(projectSnapshot(foldBlock(buildSignedChain(alice, BLOCK, extra))));
  assert.notEqual(baseAddr, otherAddr);
});

test('a host-signed snapshot record verifies', () => {
  const rec = signSnapshot(alice, honestState());
  assert.equal(verifySnapshot(rec), null);
  assert.equal(rec.owner, alice.publicRawHex);
  assert.equal(rec.owner_player_id, alice.playerId);
  assert.ok(isContentAddress(rec.address));
});

test('a tampered snapshot fails on the address (integrity)', () => {
  const rec = signSnapshot(alice, honestState());
  const tampered = { ...rec, snapshot: { ...rec.snapshot, counters: { ...rec.snapshot.counters, flux: rec.snapshot.counters.flux + 1 } } };
  assert.equal(verifySnapshot(tampered), 'address_mismatch');
});

test('a forged signature fails (origin)', () => {
  const rec = signSnapshot(alice, honestState());
  assert.equal(verifySnapshot({ ...rec, sig: '0'.repeat(128) }), 'bad_signature');
});

test('a snapshot signed by a non-owner key is rejected (owner binding)', () => {
  const mallory = identityFromSeed('mallory');
  const rec = signSnapshot(alice, honestState());
  // mallory re-signs the same address with her key and claims ownership
  const forged = { ...rec, owner: mallory.publicRawHex, owner_player_id: mallory.playerId, sig: signSnapshot(mallory, honestState()).sig };
  assert.notEqual(verifySnapshot(forged), null, 'owner mismatch / bad signature must reject');
});

test('a cached record verifies with NO access to the signer (offline reachability)', () => {
  // Serialize the record to JSON (as a peer would cache/serve it), drop all key objects, verify.
  const rec = signSnapshot(alice, honestState());
  const cached = JSON.parse(JSON.stringify(rec));
  assert.equal(verifySnapshot(cached), null, 'verification needs only the record bytes, not the host');
});

test('snapshot excludes volatile bookkeeping (stable across replay order)', () => {
  const ops = buildSignedChain(alice, BLOCK, honestSteps());
  const a = snapshotAddress(projectSnapshot(foldBlock(ops)));
  const b = snapshotAddress(projectSnapshot(foldBlock([...ops].reverse())));
  assert.equal(a, b, 'reordered delivery → identical snapshot address');
});
