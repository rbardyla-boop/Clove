/**
 * Turf Wars — Phase 1 lab substrate · DEVICE IDENTITY (Ed25519, deterministic, no accounts).
 *
 * ⚠️ LAB ONLY — see canonical.mjs header. No production exposure, no accounts, no login, no cloud
 * identity, no PII. A "player" is a per-DEVICE Ed25519 keypair generated locally; the public,
 * shareable id is a HASH of the public key. There is no server that issues or knows identities.
 *
 * Algorithm choice: Node's native Ed25519 (`node:crypto`) — synchronous sign/verify, so the whole
 * substrate fold stays pure-sync and deterministic. Deterministic FIXTURE keys are derived from a
 * seed by constructing the PKCS8 DER directly (the fixed Ed25519 prefix + 32-byte seed), so tests get
 * stable keys with no stored secrets. Browser parity (later phase): Web Crypto `subtle` also exposes
 * Ed25519 with interoperable signatures — not proven here.
 *
 * What is proven here: a public key hashes to a STABLE player id; a valid signature verifies; a wrong
 * key, a tampered message, or a tampered signature all FAIL. Signatures prove the ORIGIN of an op,
 * never its POLICY-COMPLIANCE — the roadmap's documented hard limit on what decentralization buys.
 */
import { createPrivateKey, createPublicKey, sign, verify, KeyObject } from 'node:crypto';
import { sha256Hex } from './canonical.mjs';

// Fixed DER scaffolding for raw Ed25519 keys (RFC 8410). Constructing these by hand lets us build a
// key from any 32-byte seed (PKCS8) and from any 32-byte public key (SPKI) with zero dependencies.
const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex'); // + 32-byte seed
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex'); // + 32-byte raw pubkey

export const PLAYER_ID_RE = /^tw1:[0-9a-f]{32}$/; // closed shape: "tw1:" + first 16 bytes of sha256(pubkey)

/** PURE: a deterministic 32-byte seed from a label (fixture keys) or a passthrough 32-byte buffer. */
function normalizeSeed(seed) {
  if (Buffer.isBuffer(seed) && seed.length === 32) return seed;
  if (seed instanceof Uint8Array && seed.length === 32) return Buffer.from(seed);
  // any label/string → stable 32-byte seed (test convenience; never a key-strength claim)
  return Buffer.from(sha256Hex(`turf-wars/seed/${String(seed)}`), 'hex').subarray(0, 32);
}

/** PURE: the raw 32-byte public key (hex) for a public KeyObject (last 32 bytes of SPKI DER). */
export function publicRawHex(publicKey) {
  const der = publicKey.export({ format: 'der', type: 'spki' });
  return Buffer.from(der.subarray(der.length - 32)).toString('hex');
}

/** PURE: the shareable player id = "tw1:" + first 16 bytes of sha256(raw public key). No PII. */
export function playerIdFromPublicRawHex(rawHex) {
  if (typeof rawHex !== 'string' || !/^[0-9a-f]{64}$/.test(rawHex)) throw new Error('bad raw public key');
  return `tw1:${sha256Hex(Buffer.from(rawHex, 'hex')).slice(0, 32)}`;
}

/** PURE: reconstruct a public KeyObject from a raw 32-byte pubkey hex (peers exchange raw keys). */
export function publicKeyFromRawHex(rawHex) {
  if (typeof rawHex !== 'string' || !/^[0-9a-f]{64}$/.test(rawHex)) throw new Error('bad raw public key');
  const der = Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(rawHex, 'hex')]);
  return createPublicKey({ key: der, format: 'der', type: 'spki' });
}

/**
 * Generate a DETERMINISTIC device identity from a seed/label. Returns the key objects plus the public
 * raw hex and derived player id. Same seed → byte-identical keys (fixtures); different seeds → distinct
 * identities. There is no network call and nothing is persisted.
 */
export function identityFromSeed(seed) {
  const der = Buffer.concat([PKCS8_ED25519_PREFIX, normalizeSeed(seed)]);
  const privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  const publicKey = createPublicKey(privateKey);
  const rawHex = publicRawHex(publicKey);
  return { privateKey, publicKey, publicRawHex: rawHex, playerId: playerIdFromPublicRawHex(rawHex) };
}

/** Sign raw bytes (Buffer/Uint8Array/string) with an Ed25519 private KeyObject → hex signature. */
export function signBytes(privateKey, message) {
  const data = typeof message === 'string' ? Buffer.from(message, 'utf8') : Buffer.from(message);
  return sign(null, data, privateKey).toString('hex');
}

/**
 * Verify a hex signature over `message` against a public key given as a raw-hex string OR a public
 * KeyObject. Returns a boolean; never throws on a malformed signature/key (returns false instead) so
 * the fold can treat verification as a pure predicate.
 */
export function verifyBytes(publicKeyOrRawHex, message, sigHex) {
  try {
    const publicKey = publicKeyOrRawHex instanceof KeyObject
      ? publicKeyOrRawHex
      : publicKeyFromRawHex(publicKeyOrRawHex);
    const data = typeof message === 'string' ? Buffer.from(message, 'utf8') : Buffer.from(message);
    if (typeof sigHex !== 'string' || !/^[0-9a-f]+$/.test(sigHex) || sigHex.length !== 128) return false;
    return verify(null, data, publicKey, Buffer.from(sigHex, 'hex'));
  } catch {
    return false;
  }
}
