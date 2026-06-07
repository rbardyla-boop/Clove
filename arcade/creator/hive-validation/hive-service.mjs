/**
 * Creator Foundation CF-6 — Hive validation SERVICE prototype (pure core, local/dev only).
 *
 * Generalizes the CF-2 single static approved-registry into a reviewable VALIDATION SERVICE: accept a
 * package, recompute its canonical hash, run the SAME validators the CLI uses (verbatim), and emit a
 * hash-bound verdict — while granting ZERO live trust. It keeps an in-memory submission queue and a
 * read-only verdict lookup.
 *
 * QUARANTINE (security control): this module imports ONLY the pure validators + the hash util. It does
 * NOT import the approved-loader, the approved-package-registry mutators, or anything Worker/DO. It
 * exposes NO method to approve, to enable live loading, to flip LIVE_WORLD_LOADER_ENABLED, to register a
 * cabinet, or to mutate any registry. A verdict is NEVER approval, NEVER live authorization, and NEVER
 * content clearance (automated validation cannot judge free-text appropriateness — that is CF-8's human
 * job). Decentralizing REVIEW must never decentralize TRUST by default.
 *
 * No production, no Cloudflare deploy, no network (a verdict is computed locally). See
 * docs/CREATOR_FOUNDATION_CF6_HIVE_VALIDATION_SERVICE.md.
 */

import { packageHash, sha256Hex, canonicalize } from '../validator/package-hash.mjs';
import { validateBlockPackage } from '../validator/validate-block-package.mjs';
import { validateBlockLayeredPackage } from '../validator/validate-block-layered-package.mjs';
import { validateArcadePackage } from '../validator/validate-arcade-package.mjs';

/** Pins the validator set this service runs (so a verdict records WHICH validators produced it). */
export const VALIDATOR_VERSION = 'creator-validator-cf6';
export const HIVE_RECEIPT_KIND = 'hive_validation_receipt';

/** The SAME package_kind → validator dispatch the CLI (validate-package.mjs) uses. */
const DISPATCH = Object.freeze({
  block_style: validateBlockPackage,
  block_layered: validateBlockLayeredPackage,
  arcade_game: validateArcadePackage,
});

/**
 * Run the canonical validators for a package. IDENTICAL routing to the CLI — equivalence is by
 * construction (same functions). Unknown kinds fail closed.
 */
export function validatePackage(pkg) {
  const kind = pkg && typeof pkg === 'object' ? pkg.package_kind : null;
  const validate = DISPATCH[kind] || null;
  if (!validate) {
    return { ok: false, package_kind: typeof kind === 'string' ? kind : null, errors: [`unknown package_kind: ${JSON.stringify(kind)}`], warnings: [], limits: {} };
  }
  return validate(pkg);
}

/**
 * Build a hash-bound Hive validation receipt: "this exact package hash got this exact validator
 * verdict." PURE. The hard invariants below are NON-NEGOTIABLE and ignore anything the package itself
 * claims (a package carrying live_world_authorized:true is still recorded false).
 */
export async function buildHiveReceipt(pkg, now = Date.now()) {
  const validation = validatePackage(pkg);
  const hash = await packageHash(pkg);
  const body = {
    kind: HIVE_RECEIPT_KIND,
    package_hash: hash,
    package_kind: validation.package_kind || null,
    validator_version: VALIDATOR_VERSION,
    verdict: validation.ok ? 'valid' : 'invalid',
    errors: validation.errors || [],
    warnings: validation.warnings || [],
    limits: validation.limits || {},
    // ── HARD INVARIANTS: a verdict authorizes NOTHING beyond local validation ──
    status: 'local_validation_only',   // never operator_approved_local, never live
    live_world_authorized: false,       // the service has NO live capability — always false
    content_cleared: false,             // automated validation is NOT content review (CF-8 human job)
    validated_at: new Date(now).toISOString(),
  };
  const receipt_hash = 'sha256:' + (await sha256Hex(canonicalize(body)));
  return { ...body, receipt_hash };
}

/** Re-derive a receipt's hash over its body (minus receipt_hash) — tamper detection. */
export async function recomputeReceiptHash(receipt) {
  if (!receipt || typeof receipt !== 'object') return null;
  const body = { ...receipt };
  delete body.receipt_hash;
  return 'sha256:' + (await sha256Hex(canonicalize(body)));
}

/** True iff the receipt is intact AND records no live authorization (defensive read-side check). */
export async function isReceiptIntact(receipt) {
  if (!receipt || receipt.kind !== HIVE_RECEIPT_KIND) return false;
  if (receipt.live_world_authorized !== false || receipt.content_cleared !== false || receipt.status !== 'local_validation_only') return false;
  const recomputed = await recomputeReceiptHash(receipt);
  return recomputed === receipt.receipt_hash;
}

/**
 * Create an in-memory Hive validation service: submit() validates + records a hash-bound verdict;
 * lookup()/queue() are READ-ONLY. There is intentionally NO approve / enable-live / register method —
 * the service is a validation boundary, not an authority.
 */
export function createHiveService() {
  const order = [];              // submission order (public-safe entries)
  const byHash = new Map();      // package_hash → full receipt (latest)

  return {
    async submit(pkg) {
      const receipt = await buildHiveReceipt(pkg, Date.now());
      order.push({
        package_hash: receipt.package_hash,
        package_kind: receipt.package_kind,
        verdict: receipt.verdict,
        status: receipt.status,
        live_world_authorized: receipt.live_world_authorized, // always false; surfaced for auditing
        validated_at: receipt.validated_at,
      });
      byHash.set(receipt.package_hash, receipt);
      return receipt;
    },
    /** Read-only: a COPY of the recorded verdict for an exact package hash, or null (no mutation leak). */
    lookup(packageHashStr) { const r = byHash.get(packageHashStr); return r ? { ...r } : null; },
    /** Read-only: a copy of the submission queue (no package bodies, no private data). */
    queue() { return order.map((e) => ({ ...e })); },
    get size() { return order.length; },
  };
}
