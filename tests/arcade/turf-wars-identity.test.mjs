/**
 * Turf Wars Phase 1 lab — DEVICE IDENTITY tests (Ed25519, deterministic).
 *   node --test tests/arcade/turf-wars-identity.test.mjs
 *
 * Proves: a public key hashes to a STABLE player id; fixture keys are deterministic; a valid signature
 * verifies; a wrong key / tampered message / tampered signature / malformed signature all FAIL; raw
 * pubkey ↔ KeyObject round-trips. Lab-only — the module is denylisted from the production upload.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  identityFromSeed, playerIdFromPublicRawHex, publicKeyFromRawHex, publicRawHex,
  signBytes, verifyBytes, PLAYER_ID_RE,
} from '../../arcade/hiveworld-agents/turf-wars/identity.mjs';

test('fixture identities are deterministic (same seed → identical key + player id)', () => {
  const a1 = identityFromSeed('alice');
  const a2 = identityFromSeed('alice');
  assert.equal(a1.publicRawHex, a2.publicRawHex);
  assert.equal(a1.playerId, a2.playerId);
  const b = identityFromSeed('bob');
  assert.notEqual(a1.publicRawHex, b.publicRawHex, 'different seeds → different keys');
  assert.notEqual(a1.playerId, b.playerId);
});

test('player id is "tw1:" + 16 bytes of sha256(pubkey) and matches the closed shape', () => {
  const a = identityFromSeed('alice');
  assert.match(a.playerId, PLAYER_ID_RE);
  assert.equal(a.playerId, playerIdFromPublicRawHex(a.publicRawHex));
});

test('a valid signature verifies; a wrong key does not', () => {
  const a = identityFromSeed('alice');
  const b = identityFromSeed('bob');
  const sig = signBytes(a.privateKey, 'hello world');
  assert.equal(verifyBytes(a.publicRawHex, 'hello world', sig), true);
  assert.equal(verifyBytes(b.publicRawHex, 'hello world', sig), false, 'wrong key must fail');
});

test('a tampered message fails verification', () => {
  const a = identityFromSeed('alice');
  const sig = signBytes(a.privateKey, 'transfer 5 flux');
  assert.equal(verifyBytes(a.publicRawHex, 'transfer 50 flux', sig), false);
});

test('a tampered or malformed signature fails (never throws)', () => {
  const a = identityFromSeed('alice');
  const sig = signBytes(a.privateKey, 'msg');
  const flipped = (sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0'));
  assert.equal(verifyBytes(a.publicRawHex, 'msg', flipped), false);
  assert.equal(verifyBytes(a.publicRawHex, 'msg', 'not-hex'), false);
  assert.equal(verifyBytes(a.publicRawHex, 'msg', ''), false);
  assert.equal(verifyBytes('zz', 'msg', sig), false, 'bad key string returns false, not throw');
});

test('raw pubkey ↔ KeyObject round-trips and verifies', () => {
  const a = identityFromSeed('alice');
  const pub = publicKeyFromRawHex(a.publicRawHex);
  assert.equal(publicRawHex(pub), a.publicRawHex);
  const sig = signBytes(a.privateKey, 'peer-exchanged');
  assert.equal(verifyBytes(pub, 'peer-exchanged', sig), true, 'verify against a reconstructed KeyObject');
});

test('no accounts / PII: identity is derived locally, exposes only a key hash', () => {
  const a = identityFromSeed('alice');
  // the only shareable identifier is a hash; the player id reveals nothing but bytes of a key digest
  assert.ok(!/@|name|email|user/i.test(a.playerId));
  assert.equal(typeof a.publicRawHex, 'string');
  assert.equal(a.publicRawHex.length, 64);
});
