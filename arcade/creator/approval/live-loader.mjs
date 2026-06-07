/**
 * Creator Foundation CF-7 — OPERATOR-APPROVED LIVE LOADER, PURE + cross-env (Node 18.4+ / browser).
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 *  SHIPPED DISABLED. `LIVE_WORLD_LOADER_ENABLED` is `false` (imported from the CF-2 loader — ONE gate,
 *  one source of truth) and is checked before any binding work. A perfect, fully-approved package CANNOT
 *  load through this function as shipped. Enabling live load is a deliberate, separately-authorized,
 *  human-cleared, staging-verified production change — NOT a config toggle reachable here.
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * This is the dangerous gate built as a CLOSED, TESTABLE MACHINE: every check is deny-by-default and the
 * fail-closed controls run first. When (and only when) it is explicitly enabled, a live load requires ALL
 * of, re-resolved AT LOAD TIME (never trusting a stored conclusion):
 *
 *   0. kill-switch OFF      — proceeds only when the kill-switch is EXACTLY the off-sentinel (F5).
 *   1. loader ENABLED       — `LIVE_WORLD_LOADER_ENABLED === true` (it is false; this is the hard stop).
 *   2. JSON-plain package   — reject undefined/function/NaN values (F2 — no canonical-elision collision).
 *   3. live receipt VALID   — `creator_live_approval_receipt`, wrong kind fails fast (F7).
 *   4. package body VALID   — re-run the canonical validators at load time (no trust in a past verdict).
 *   5. package hash BINDS   — recomputed canonical hash === the live receipt's package_hash.
 *   6. bindings RESOLVE     — the CF-2 local receipt, CF-6 hive verdict, and CF-8 human-review record are
 *                             each present, intact, valid, for THIS hash, and hash-match the live receipt
 *                             (F1 — binding resolution at load time; F3 — free_text_digest match).
 *   7. live registry VALID  — hash-sealed `creator_approved_live_packages`, this hash eligible (not
 *                             revoked, not expired) and pointing at THIS live_approval_id.
 *   8. epoch MONOTONIC      — registry.revocation_epoch >= the highest epoch seen (F4 — no rollback).
 *   9. staging VERIFIED     — staging_verified true (a fast-fail flag; the real proof is the prod gate).
 *
 * PURE: no network, no Worker/DO, no mutation of any input. Any failed check returns a structured
 * rejection — nothing is ever thrown into the live world. See docs/CREATOR_FOUNDATION_CF7_LIVE_LOADER.md.
 */
import { packageHash } from '../validator/package-hash.mjs';
import { validateBlockPackage } from '../validator/validate-block-package.mjs';
import { validateBlockLayeredPackage } from '../validator/validate-block-layered-package.mjs';
import { validateArcadePackage } from '../validator/validate-arcade-package.mjs';
import { LIVE_WORLD_LOADER_ENABLED } from './approved-loader.mjs';
import { validateReceipt, receiptHash, APPROVED_LOCAL } from './approval-receipt.mjs';
import { validateLiveApprovalReceipt } from './live-approval-receipt.mjs';
import { validateLiveRegistry, resolveLiveApprovedPackage } from './live-registry.mjs';
import { isReceiptIntact, recomputeReceiptHash, HIVE_RECEIPT_KIND } from '../hive-validation/hive-service.mjs';
import { isLiveCandidate } from '../moderation/review-queue.mjs';

// Re-export the single shared gate so consumers read the SAME constant (still false).
export { LIVE_WORLD_LOADER_ENABLED };

/** The off-sentinel for the kill-switch: live load proceeds ONLY when this exact boolean is passed. */
export const KILL_SWITCH_OFF = false;

function reject(reason, extra = {}) { return { ok: false, reason, ...extra }; }

/** Fail-closed: anything other than the exact off-sentinel (`false`) means the kill-switch is ENGAGED. */
export function killSwitchEngaged(killSwitch) { return killSwitch !== KILL_SWITCH_OFF; }

/**
 * True iff `v` survives a JSON round-trip with NO loss or transformation. Rejects values JSON.stringify
 * drops (undefined/function/symbol) or mangles (bigint throws; NaN/Infinity → null), AND non-plain objects
 * (Date/Map/Set/RegExp/class instances) that JSON.stringify silently transforms or collapses to `{}` —
 * only plain objects (prototype Object.prototype or null) and arrays of clean values pass.
 */
function isJsonClean(v, depth = 0) {
  if (depth > 64) return false;
  if (v === null) return true;
  const t = typeof v;
  if (t === 'string' || t === 'boolean') return true;
  if (t === 'number') return Number.isFinite(v);
  if (t === 'undefined' || t === 'function' || t === 'symbol' || t === 'bigint') return false;
  if (Array.isArray(v)) return v.every((x) => isJsonClean(x, depth + 1));
  if (t === 'object') {
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return false; // Date/Map/Set/RegExp/class instance
    return Object.values(v).every((x) => isJsonClean(x, depth + 1));
  }
  return false;
}

function revalidateByKind(pkg) {
  if (!pkg || typeof pkg !== 'object') return { ok: false };
  if (pkg.package_kind === 'block_style') return validateBlockPackage(pkg);
  if (pkg.package_kind === 'block_layered') return validateBlockLayeredPackage(pkg);
  if (pkg.package_kind === 'arcade_game') return validateArcadePackage(pkg);
  return { ok: false };
}

/**
 * Async: attempt to load a package into the LIVE world. Deny-by-default. As shipped this ALWAYS rejects
 * (`enabled` defaults to the false module constant). `enabled` is a parameter ONLY so the closed machine
 * is testable when explicitly driven — it never mutates the shipped `LIVE_WORLD_LOADER_ENABLED` constant.
 *
 * @param {{
 *   package:object, liveReceipt:object, liveRegistry:object,
 *   localReceipt:object, hiveReceipt:object, reviewRecord:object,
 *   killSwitch?:any, highestSeenEpoch?:number, now?:number, enabled?:boolean
 * }} input
 */
export async function loadLivePackage({
  package: pkg, liveReceipt, liveRegistry, localReceipt, hiveReceipt, reviewRecord,
  killSwitch, highestSeenEpoch, now = Date.now(), enabled = LIVE_WORLD_LOADER_ENABLED,
} = {}) {
  // 0. KILL-SWITCH first, fail-closed: proceed only on the exact off-sentinel.
  if (killSwitchEngaged(killSwitch)) return reject('kill_switch_engaged');

  // 1. THE LIVE WORLD IS CLOSED. Checked before any binding logic so nothing below can open it. As
  //    shipped, `enabled` is the false constant — a fully-valid approval still stops here.
  if (enabled !== true) return reject('live_world_loader_not_enabled');

  // 2. the package must survive a JSON round-trip (F2): undefined/NaN/function values are rejected so a
  //    canonical-elision collision can't make a different body hash-match the receipt. Hash/render `plain`.
  if (!isJsonClean(pkg)) return reject('package_not_json_clean');
  const plain = JSON.parse(JSON.stringify(pkg));

  // 3. the live receipt must be a VALID live receipt (wrong kind fails fast — F7).
  const lrv = await validateLiveApprovalReceipt(liveReceipt);
  if (!lrv.ok) return reject(lrv.reason === 'wrong_receipt_kind' ? 'wrong_receipt_kind' : 'invalid_live_receipt', { errors: lrv.errors });

  // 4. re-validate the package body at LOAD time (never trust a past verdict).
  if (!revalidateByKind(plain).ok) return reject('package_invalid');

  // 5. recomputed canonical hash must match the live receipt's package_hash.
  const hash = await packageHash(plain);
  if (hash !== liveReceipt.package_hash) return reject('package_hash_mismatch', { package_hash: hash });

  // 6. BINDING RESOLUTION (F1) — resolve each referenced artifact NOW, recompute its hash, bind to THIS hash.
  //   6a. CF-2 local approval receipt: valid, operator_approved_local, for this package, hash-matches.
  if (!localReceipt) return reject('missing_local_receipt');
  if (!(await validateReceipt(localReceipt)).ok) return reject('local_receipt_invalid');
  if (localReceipt.approval_status !== APPROVED_LOCAL) return reject('local_receipt_not_approved');
  if (localReceipt.package_hash !== hash) return reject('local_receipt_package_mismatch');
  if ((await receiptHash(localReceipt)) !== liveReceipt.local_receipt_hash) return reject('local_receipt_binding_mismatch');

  //   6b. CF-6 hive validation verdict: right kind, intact, verdict=valid, for this package, hash-matches.
  if (!hiveReceipt || hiveReceipt.kind !== HIVE_RECEIPT_KIND) return reject('hive_receipt_wrong_kind');
  if (!(await isReceiptIntact(hiveReceipt)) || hiveReceipt.verdict !== 'valid') return reject('hive_receipt_not_valid');
  if (hiveReceipt.package_hash !== hash) return reject('hive_receipt_package_mismatch');
  if ((await recomputeReceiptHash(hiveReceipt)) !== liveReceipt.hive_verdict_receipt_hash) return reject('hive_receipt_binding_mismatch');

  //   6c. CF-8 human-review record: a real live candidate, for this package, with the SAME screened-text
  //       digest the live receipt binds (F3) and the SAME review_id the human_review block names.
  if (!isLiveCandidate(reviewRecord)) return reject('not_a_live_candidate');
  if (reviewRecord.package_hash !== hash) return reject('review_record_package_mismatch');
  if (reviewRecord.free_text_digest !== liveReceipt.free_text_digest) return reject('free_text_digest_mismatch');
  if (reviewRecord.review_id !== liveReceipt.human_review.review_id) return reject('review_id_mismatch');

  // 7. the live registry must be valid and list THIS hash as eligible (not revoked, not expired).
  if (!(await validateLiveRegistry(liveRegistry)).ok) return reject('invalid_live_registry');
  const entry = resolveLiveApprovedPackage(liveRegistry, hash, now);
  if (!entry) return reject('not_live_approved');
  if (entry.live_approval_id !== liveReceipt.live_approval_id) return reject('live_approval_id_mismatch');

  // 8. monotonic revocation epoch (F4): an older registry snapshot can't resurrect a revoked approval.
  //    The caller MUST supply a PERSISTED highest-seen epoch — there is intentionally NO default, because
  //    defaulting to 0 would make this rollback control fail-OPEN (a stale registry that still shows a
  //    since-revoked package as live would be accepted). A missing/invalid epoch source is refused.
  if (!Number.isInteger(highestSeenEpoch) || highestSeenEpoch < 0) return reject('epoch_source_unavailable');
  if (!(Number.isInteger(liveRegistry.revocation_epoch) && liveRegistry.revocation_epoch >= highestSeenEpoch)) {
    return reject('registry_epoch_rollback', { revocation_epoch: liveRegistry.revocation_epoch, highest_seen_epoch: highestSeenEpoch });
  }

  // 9. staging_verified fast-fail. DEFENSE-IN-DEPTH: validateLiveApprovalReceipt (step 3) already requires
  //    staging_verified === true, so a false flag stops at step 3 and this line is unreachable in practice
  //    — kept so the gate is explicit at the loader layer and survives any future receipt-validator change.
  if (liveReceipt.staging_verified !== true) return reject('not_staging_verified');

  // SUCCESS — live render authorized. Only reachable with enabled === true, which the shipped constant is
  // NOT. Return a defensive copy of the hashed body so a consumer can't mutate what was just verified.
  return {
    ok: true,
    package_hash: hash,
    package: plain,
    live_world_authorized: true,
    revocation_epoch: liveRegistry.revocation_epoch,
    live_approval_id: liveReceipt.live_approval_id,
  };
}
