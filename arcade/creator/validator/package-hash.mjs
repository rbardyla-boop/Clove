/**
 * Creator Foundation CF-1 — canonical package hashing, PURE + cross-env (Node 18.4+ / browser).
 *
 * A package's identity is the SHA-256 of its CANONICAL JSON (object keys sorted recursively, so the
 * same logical package always hashes the same regardless of authoring/key order). The live loader
 * (a future, separately-gated phase) will trust a package only if its recomputed canonical hash
 * matches an approved receipt. Uses Web Crypto (`globalThis.crypto.subtle`), available in modern
 * Node and browsers, so the CLI and the editor produce identical hashes.
 */

/** PURE: deterministic canonical JSON (recursively sorted keys; arrays keep order). */
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

/** Async: hex SHA-256 of a string via Web Crypto. */
export async function sha256Hex(str) {
  const data = new TextEncoder().encode(str);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Async: canonical package hash, prefixed `sha256:`. */
export async function packageHash(value) {
  return `sha256:${await sha256Hex(canonicalize(value))}`;
}
