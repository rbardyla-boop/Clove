/**
 * Turf Wars — Phase 1 lab substrate · CANONICALIZATION + CONTENT ADDRESSING (pure, deterministic).
 *
 * ⚠️ LAB ONLY. `arcade/hiveworld-agents/` is denylisted from the curated production upload and is
 * imported by NO Worker/DO/client path. This is Phase 1 of docs/NEON_CIRCUIT_TURF_WARS_ROADMAP.md —
 * a decentralized substrate prototype with ZERO production exposure. It does not enable a live
 * product, minors-facing release, territory combat, publishing, accounts, or economy. The roadmap is
 * DRAFT / DESIGN-ONLY and charter-illegal until Phase 0 counsel ruling + a superseding ADR.
 *
 * Identity-of-data, not identity-of-person: the whole substrate's trust model is "authority = replay
 * of signed, content-addressed data". That requires ONE canonical byte encoding so two honest peers
 * fold identical logs to a byte-identical snapshot hash. We REUSE the shipped canonical helper
 * (`canonicalize` from the creator validator's package-hash module — recursively key-sorted JSON) so
 * the lab and the production package hasher share a single canonicalization contract, and pair it with
 * a SYNCHRONOUS sha256 (node:crypto) so the fold stays pure-sync and deterministic.
 *
 * Browser parity (a later phase, not proven here): swap node:crypto `createHash('sha256')` for Web
 * Crypto `crypto.subtle.digest('SHA-256', …)` — same algorithm, interoperable digests. The shared
 * `canonicalize` is already cross-env.
 */
import { createHash } from 'node:crypto';
import { canonicalize } from '../../creator/validator/package-hash.mjs';

export { canonicalize };

/** PURE: lowercase hex sha256 of a string or Buffer/Uint8Array (synchronous; node:crypto). */
export function sha256Hex(input) {
  const data = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
  return createHash('sha256').update(data).digest('hex');
}

/**
 * PURE: content address of any JSON value — `sha256:` + sha256(canonical JSON). Same shape and prefix
 * as the shipped `packageHash`, so a Turf Wars snapshot address is interoperable with the package
 * hasher's address space. Identical logical value → identical address, regardless of key order.
 */
export function contentAddress(value) {
  return `sha256:${sha256Hex(canonicalize(value))}`;
}

/** PURE: true iff `addr` is a well-formed `sha256:<64-hex>` content address. */
export function isContentAddress(addr) {
  return typeof addr === 'string' && /^sha256:[0-9a-f]{64}$/.test(addr);
}
