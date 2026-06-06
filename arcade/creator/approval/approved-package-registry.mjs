/**
 * Creator Foundation CF-2 — APPROVED PACKAGE REGISTRY, PURE + cross-env (Node 18.4+ / browser).
 *
 * A registry is a STATIC, LOCAL list of packages an operator has reviewed, keyed by canonical
 * package hash. It is the allowlist the (future) loader consults: a package the registry does not
 * list is, by definition, unapproved. CF-2 keeps the registry inert — no network, no server, no
 * live-world load. Every entry's `live_world_authorized` MUST be false; a true value is rejected
 * because no live loader exists to honor it.
 */
import { APPROVAL_STATUSES, APPROVED_LOCAL, HASH_RE, PACKAGE_KINDS } from './approval-receipt.mjs';

export const REGISTRY_SCHEMA_VERSION = 1;
export const REGISTRY_KIND = 'creator_approved_packages';

const DISPLAY_NAME_MAX = 60;
const MAX_ENTRIES = 256;

const ENTRY_KEYS = Object.freeze([
  'package_hash', 'package_kind', 'display_name', 'approval_status', 'approved_at', 'validator_version', 'live_world_authorized',
]);
const TOP_KEYS = Object.freeze(['schema_version', 'registry_kind', 'packages']);

/** A frozen, empty registry — the safe default (approves nothing). */
export const EMPTY_REGISTRY = Object.freeze({
  schema_version: REGISTRY_SCHEMA_VERSION, registry_kind: REGISTRY_KIND, packages: Object.freeze([]),
});

/** PURE: assemble a registry from entries (shape only; pair with validateRegistry before trusting). */
export function createRegistry(packages = []) {
  return { schema_version: REGISTRY_SCHEMA_VERSION, registry_kind: REGISTRY_KIND, packages: [...packages] };
}

function validateEntry(entry, i, errors, seen) {
  const at = `packages[${i}]`;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { errors.push(`${at} is not an object`); return; }
  for (const k of Object.keys(entry)) if (!ENTRY_KEYS.includes(k)) errors.push(`${at} unknown key: ${k}`);
  for (const k of ENTRY_KEYS) if (!(k in entry)) errors.push(`${at} missing key: ${k}`);
  if (typeof entry.package_hash !== 'string' || !HASH_RE.test(entry.package_hash)) errors.push(`${at}.package_hash must be sha256:<64hex>`);
  else if (seen.has(entry.package_hash)) errors.push(`${at}.package_hash duplicate`);
  else seen.add(entry.package_hash);
  if (!PACKAGE_KINDS.includes(entry.package_kind)) errors.push(`${at}.package_kind must be one of ${PACKAGE_KINDS.join('|')}`);
  if (typeof entry.display_name !== 'string' || entry.display_name.length === 0 || entry.display_name.length > DISPLAY_NAME_MAX) errors.push(`${at}.display_name must be 1..${DISPLAY_NAME_MAX} chars`);
  if (!APPROVAL_STATUSES.includes(entry.approval_status)) errors.push(`${at}.approval_status must be one of ${APPROVAL_STATUSES.join('|')}`);
  if (typeof entry.approved_at !== 'string' || Number.isNaN(Date.parse(entry.approved_at))) errors.push(`${at}.approved_at must be an ISO timestamp`);
  if (typeof entry.validator_version !== 'string' || !entry.validator_version) errors.push(`${at}.validator_version must be a non-empty string`);
  if (entry.live_world_authorized !== false) errors.push(`${at}.live_world_authorized must be false (no live loader in CF-2)`);
}

/** PURE: strict registry validation; deny-by-default. Unknown top/entry keys are rejections. */
export function validateRegistry(registry) {
  const errors = [];
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return { ok: false, errors: ['registry is not an object'] };
  for (const k of Object.keys(registry)) if (!TOP_KEYS.includes(k)) errors.push(`unknown top key: ${k}`);
  for (const k of TOP_KEYS) if (!(k in registry)) errors.push(`missing top key: ${k}`);
  if (registry.schema_version !== REGISTRY_SCHEMA_VERSION) errors.push(`schema_version must be ${REGISTRY_SCHEMA_VERSION}`);
  if (registry.registry_kind !== REGISTRY_KIND) errors.push(`registry_kind must be "${REGISTRY_KIND}"`);
  if (!Array.isArray(registry.packages)) errors.push('packages must be an array');
  else {
    if (registry.packages.length > MAX_ENTRIES) errors.push(`packages exceeds ${MAX_ENTRIES} entries`);
    const seen = new Set();
    registry.packages.forEach((e, i) => validateEntry(e, i, errors, seen));
  }
  return { ok: errors.length === 0, errors };
}

/** PURE: find a registry entry by canonical package hash (any status), or null. */
export function findRegistryEntry(registry, packageHash) {
  if (!registry || !Array.isArray(registry.packages)) return null;
  return registry.packages.find((e) => e && e.package_hash === packageHash) || null;
}

/** PURE: is this entry operator-approved for LOCAL preview? (Still never live.) */
export function isApprovedLocal(entry) {
  return !!entry && entry.approval_status === APPROVED_LOCAL && entry.live_world_authorized === false;
}

/** PURE: resolve an APPROVED-LOCAL entry by hash, or null if absent / unapproved. */
export function resolveApprovedPackage(registry, packageHash) {
  const entry = findRegistryEntry(registry, packageHash);
  return isApprovedLocal(entry) ? entry : null;
}
