/**
 * Deterministic hashing, content addressing and MOCK signatures.
 *
 * Everything here is deterministic so that:
 *  - the same event always produces the same content_hash and event_id, and
 *  - replaying a log on any node yields byte-identical state hashes.
 *
 * SIGNATURES ARE MOCK. They are NOT cryptography. They exist purely to give the
 * envelope the right shape so a real keypair scheme (e.g. ed25519) can replace
 * `mockSign`/`mockVerify` later without touching the rest of the protocol. A
 * mock signature only proves "this content was hashed with this actor_id" — it
 * does not prove identity or prevent forgery, and the docs say so loudly.
 */

/**
 * Stable JSON stringify: object keys are emitted in sorted order at every level
 * so the serialization (and therefore the hash) is independent of insertion
 * order. undefined is normalized to null so the shape is stable.
 */
export function canonicalStringify(value) {
  if (value === null || value === undefined) return 'null';
  const t = typeof value;
  if (t === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalStringify).join(',') + ']';
  }
  if (t === 'object') {
    const keys = Object.keys(value).sort();
    const parts = keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(value[k]));
    return '{' + parts.join(',') + '}';
  }
  // functions / symbols are never part of protocol content
  return 'null';
}

/** 32-bit FNV-1a over a string. */
function fnv1a32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 64-bit-ish content hash as 16 hex chars. We fold the string twice with
 * different priming so accidental collisions are vanishingly unlikely at v0
 * scale (thousands of events). This is a content hash, not a MAC.
 */
export function hashString(str) {
  const a = fnv1a32(str);
  const b = fnv1a32('' + str + '');
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/** Content-address any JSON-serializable value. */
export function hashContent(content) {
  return hashString(canonicalStringify(content));
}

const SIG_PREFIX = 'mocksig1:';

/**
 * MOCK signature over (actor_id, content_hash). Deterministic and verifiable,
 * but NOT secure. Replace with real asymmetric signing later; the call sites
 * only depend on this interface shape.
 */
export function mockSign(actorId, contentHash) {
  return SIG_PREFIX + hashString(actorId + '|' + contentHash);
}

/** Verify a MOCK signature. Returns boolean. */
export function mockVerify(actorId, contentHash, signature) {
  if (typeof signature !== 'string' || !signature.startsWith(SIG_PREFIX)) return false;
  return signature === mockSign(actorId, contentHash);
}

/** Deterministic event id from the source chain coordinates + content hash. */
export function makeEventId(actorId, seq, contentHash) {
  return 'ev_' + hashString(actorId + '#' + seq + '#' + contentHash);
}
