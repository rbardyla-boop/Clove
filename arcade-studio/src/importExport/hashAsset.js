/**
 * Canonical asset hashing — PURE, cross-env (modern Node + browser via Web Crypto).
 *
 * An asset's identity is the SHA-256 of its CANONICAL JSON (object keys sorted recursively, arrays
 * kept in order), so the same logical asset always hashes the same regardless of key/author order.
 * Mirrors arcade/creator/validator/package-hash.mjs so the 3D studio speaks the same `sha256:` dialect.
 */

/** Deterministic canonical JSON: recursively sorted keys, arrays preserved. */
export function canonicalize(value) {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortDeep(v[k]);
    return out;
  }
  return v;
}

/** Pretty, deterministic JSON for human-readable export files (sorted keys, 2-space indent). */
export function canonicalPretty(value) {
  return JSON.stringify(sortDeep(value), null, 2);
}

/** Hex SHA-256 of a string via Web Crypto. */
export async function sha256Hex(str) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new Error('Web Crypto subtle digest unavailable in this environment');
  const data = new TextEncoder().encode(str);
  const buf = await subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Canonical asset hash, prefixed `sha256:`. */
export async function hashAsset(value) {
  return `sha256:${await sha256Hex(canonicalize(value))}`;
}
