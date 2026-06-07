/**
 * Creator Foundation CF-7 — APPROVED-LIVE REGISTRY, PURE + cross-env (Node 18.4+ / browser).
 *
 * The parallel live-track allowlist. Where the CF-2 `creator_approved_packages` registry forbids a true
 * `live_world_authorized` entirely (it's the local-preview allowlist), this `creator_approved_live_packages`
 * registry is the ONE place a `live_world_authorized: true` entry is permitted — and only as an INPUT to
 * the still-DISABLED CF-7 loader, which re-resolves it. The registry is:
 *
 *   • hash-sealed         — `registry_hash` over the body detects any edit (added/removed/mutated entry).
 *   • monotonic-epoch'd   — `revocation_epoch` only ever increases; the loader rejects a registry whose
 *                           epoch is BELOW the highest epoch it has seen (threat-model F4 — a revoke
 *                           cannot be undone by serving an older registry snapshot).
 *   • revocable + TTL'd   — an entry may be `revoked` or `expires_at`-bounded; either makes it ineligible.
 *
 * PURE: no network, no Worker/DO, no loader. A listed entry authorizes NOTHING until the disabled loader
 * re-validates the package, every binding, the kill-switch, and this registry.
 */
import { canonicalize, sha256Hex } from '../validator/package-hash.mjs';

export const LIVE_REGISTRY_SCHEMA_VERSION = 1;
export const LIVE_REGISTRY_KIND = 'creator_approved_live_packages';
/** The single status that makes a live entry eligible (still gated by the disabled loader). */
export const APPROVED_LIVE = 'operator_approved_live';

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const PACKAGE_KINDS = Object.freeze(['block_style', 'block_layered', 'arcade_game']);
const MAX_ENTRIES = 256;
const isHash = (h) => typeof h === 'string' && HASH_RE.test(h);
const isIso = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));

const ENTRY_KEYS = Object.freeze([
  'package_hash', 'package_kind', 'live_approval_id', 'approval_status', 'live_world_authorized',
  'approved_live_at', 'expires_at', 'revoked', 'revoked_at', 'revoke_reason',
]);
const TOP_KEYS = Object.freeze(['schema_version', 'registry_kind', 'revocation_epoch', 'packages']);

function registryBody(registry) {
  return {
    schema_version: registry.schema_version,
    registry_kind: registry.registry_kind,
    revocation_epoch: registry.revocation_epoch,
    packages: registry.packages,
  };
}

/** Async: deterministic registry hash over the body (excludes registry_hash). */
export async function liveRegistryHash(registry) {
  return `sha256:${await sha256Hex(canonicalize(registryBody(registry)))}`;
}

/** Async PURE: assemble a hash-sealed live registry from entries at a given monotonic epoch. */
export async function buildLiveRegistry(packages = [], revocationEpoch = 0) {
  const body = {
    schema_version: LIVE_REGISTRY_SCHEMA_VERSION,
    registry_kind: LIVE_REGISTRY_KIND,
    revocation_epoch: revocationEpoch,
    packages: packages.map((p) => ({ ...p })),
  };
  return { ...body, registry_hash: await liveRegistryHash(body) };
}

function validateLiveEntry(entry, i, errors, seen) {
  const at = `packages[${i}]`;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { errors.push(`${at} is not an object`); return; }
  for (const k of Object.keys(entry)) if (!ENTRY_KEYS.includes(k)) errors.push(`${at} unknown key: ${k}`);
  for (const k of ENTRY_KEYS) if (!(k in entry)) errors.push(`${at} missing key: ${k}`);
  if (!isHash(entry.package_hash)) errors.push(`${at}.package_hash must be sha256:<64hex>`);
  else if (seen.has(entry.package_hash)) errors.push(`${at}.package_hash duplicate`);
  else seen.add(entry.package_hash);
  if (!PACKAGE_KINDS.includes(entry.package_kind)) errors.push(`${at}.package_kind invalid`);
  if (typeof entry.live_approval_id !== 'string' || !entry.live_approval_id) errors.push(`${at}.live_approval_id required`);
  if (entry.approval_status !== APPROVED_LIVE) errors.push(`${at}.approval_status must be ${APPROVED_LIVE}`);
  if (entry.live_world_authorized !== true) errors.push(`${at}.live_world_authorized must be true (live registry)`);
  if (!isIso(entry.approved_live_at)) errors.push(`${at}.approved_live_at must be an ISO timestamp`);
  if (entry.expires_at != null && !isIso(entry.expires_at)) errors.push(`${at}.expires_at must be null or an ISO timestamp`);
  if (typeof entry.revoked !== 'boolean') errors.push(`${at}.revoked must be a boolean`);
  if (entry.revoked_at != null && !isIso(entry.revoked_at)) errors.push(`${at}.revoked_at must be null or an ISO timestamp`);
  if (entry.revoke_reason != null && typeof entry.revoke_reason !== 'string') errors.push(`${at}.revoke_reason must be null or a string`);
  if (entry.revoked === true && entry.revoked_at == null) errors.push(`${at} revoked entry must record revoked_at`);
}

/** Async PURE: strict validation, deny-by-default. Unknown keys, a non-integer/negative epoch, a bad
 *  entry, or a `registry_hash` that does not recompute all FAIL. */
export async function validateLiveRegistry(registry) {
  const errors = [];
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return { ok: false, errors: ['registry is not an object'] };
  for (const k of Object.keys(registry)) if (!TOP_KEYS.includes(k) && k !== 'registry_hash') errors.push(`unknown top key: ${k}`);
  for (const k of [...TOP_KEYS, 'registry_hash']) if (!(k in registry)) errors.push(`missing top key: ${k}`);
  if (registry.schema_version !== LIVE_REGISTRY_SCHEMA_VERSION) errors.push(`schema_version must be ${LIVE_REGISTRY_SCHEMA_VERSION}`);
  if (registry.registry_kind !== LIVE_REGISTRY_KIND) errors.push(`registry_kind must be "${LIVE_REGISTRY_KIND}"`);
  if (!Number.isInteger(registry.revocation_epoch) || registry.revocation_epoch < 0) errors.push('revocation_epoch must be a non-negative integer');
  if (!Array.isArray(registry.packages)) errors.push('packages must be an array');
  else {
    if (registry.packages.length > MAX_ENTRIES) errors.push(`packages exceeds ${MAX_ENTRIES} entries`);
    const seen = new Set();
    registry.packages.forEach((e, i) => validateLiveEntry(e, i, errors, seen));
  }
  if (!isHash(registry.registry_hash)) errors.push('registry_hash must be sha256:<64hex>');
  else if (errors.length === 0 && registry.registry_hash !== await liveRegistryHash(registry)) errors.push('registry_hash does not match registry body (tampered)');
  return { ok: errors.length === 0, errors };
}

/** PURE: find a live entry by canonical package hash (any state), or null. */
export function findLiveEntry(registry, packageHash) {
  if (!registry || !Array.isArray(registry.packages)) return null;
  return registry.packages.find((e) => e && e.package_hash === packageHash) || null;
}

/**
 * PURE: resolve an ELIGIBLE live entry by hash, or null. Eligible = operator_approved_live AND
 * live_world_authorized AND not revoked AND not expired (`expires_at` null or strictly in the future).
 * `now` is explicit epoch-ms so expiry is deterministic for tests. Resolution alone is NOT a load — the
 * loader still checks the package body, the receipt, every binding, the epoch, and the kill-switch.
 */
export function resolveLiveApprovedPackage(registry, packageHash, now = Date.now()) {
  const entry = findLiveEntry(registry, packageHash);
  if (!entry) return null;
  if (entry.approval_status !== APPROVED_LIVE || entry.live_world_authorized !== true) return null;
  if (entry.revoked === true) return null;
  if (entry.expires_at != null && Date.parse(entry.expires_at) <= now) return null;
  return entry;
}
