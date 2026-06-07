/**
 * Creator Foundation CF-7 — LIVE APPROVAL RECEIPT model, PURE + cross-env (Node 18.4+ / browser).
 *
 * The CF-2 `creator_approval_receipt` records a LOCAL operator decision and is structurally barred from
 * ever claiming live authority (`live_world_authorized` is always false there, and the CF-2 receipt/
 * registry validators reject a true value). CF-7 needs a SEPARATE artifact for the parallel live track:
 * a `creator_live_approval_receipt` that DOES carry `live_world_authorized: true` — but only when it
 * binds, by hash, the full safety chain the live loader will re-resolve at load time:
 *
 *   • the package (package_hash)                         — canonical identity
 *   • the CF-2 local approval receipt (local_receipt_hash) — operator approved it locally
 *   • the CF-6 hive validation verdict (hive_verdict_receipt_hash) — it validated
 *   • the CF-8 human review (free_text_digest + human_review block) — a human screened the free text
 *   • staging_verified — it was proven on staging (a fast-fail flag, NOT proof of record)
 *
 * A live receipt AUTHORIZES NOTHING ON ITS OWN. It is one input to the still-DISABLED CF-7 loader
 * (LIVE_WORLD_LOADER_ENABLED = false), which re-validates every binding and the registry before it would
 * ever render live. This module is PURE: no loader, no Worker/DO, no network. See
 * docs/CREATOR_FOUNDATION_CF7_LIVE_LOADER.md and the threat model it implements.
 */
import { canonicalize, sha256Hex } from '../validator/package-hash.mjs';

export const LIVE_RECEIPT_SCHEMA_VERSION = 1;
export const LIVE_RECEIPT_KIND = 'creator_live_approval_receipt';
export const LIVE_VALIDATOR_VERSION = 'creator-validator-cf7';

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const PACKAGE_KINDS = Object.freeze(['block_style', 'block_layered', 'arcade_game']);
const isHash = (h) => typeof h === 'string' && HASH_RE.test(h);
const isIso = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));

/** Live-receipt fields covered by `receipt_hash` (everything except the hash itself), declared order. */
const LIVE_BODY_KEYS = Object.freeze([
  'schema_version', 'receipt_kind', 'live_approval_id', 'package_hash', 'package_kind', 'validator_version',
  'local_receipt_hash', 'hive_verdict_receipt_hash', 'free_text_digest', 'human_review',
  'live_world_authorized', 'approved_live_at', 'expires_at', 'staging_verified',
]);

function liveBody(receipt) {
  const body = {};
  for (const k of LIVE_BODY_KEYS) body[k] = receipt[k];
  return body;
}

/** Async: deterministic live-receipt hash = canonical SHA-256 over the body (excludes receipt_hash). */
export async function liveReceiptHash(receipt) {
  return `sha256:${await sha256Hex(canonicalize(liveBody(receipt)))}`;
}

/**
 * Async PURE: mint a hash-sealed live approval receipt from a CF-8 approved candidate + the bound
 * artifact hashes. `live_world_authorized: true` is DERIVED here — and only from a record that is a real
 * `approved_for_live_candidate` with cleared free text + a true staging_verified flag. There is no
 * parameter to force it. The receipt still authorizes nothing until the (disabled) loader re-resolves it.
 */
export async function buildLiveApprovalReceipt({
  reviewRecord, localReceiptHash, hiveVerdictReceiptHash, stagingVerified,
  expiresAt = null, liveApprovalId, now = Date.now(),
}) {
  const errors = [];
  if (!reviewRecord || typeof reviewRecord !== 'object') errors.push('reviewRecord is required');
  else {
    if (reviewRecord.state !== 'approved_for_live_candidate') errors.push('reviewRecord must be approved_for_live_candidate');
    if (reviewRecord.free_text_cleared !== true) errors.push('reviewRecord.free_text_cleared must be true');
    if (reviewRecord.revoked_at != null) errors.push('reviewRecord must not be revoked');
    if (!isHash(reviewRecord.package_hash)) errors.push('reviewRecord.package_hash invalid');
    if (!isHash(reviewRecord.free_text_digest)) errors.push('reviewRecord.free_text_digest invalid');
    if (!PACKAGE_KINDS.includes(reviewRecord.package_kind)) errors.push('reviewRecord.package_kind invalid');
    if (typeof reviewRecord.reviewer_ref !== 'string' || !reviewRecord.reviewer_ref) errors.push('reviewRecord.reviewer_ref required');
  }
  if (!isHash(localReceiptHash)) errors.push('localReceiptHash must be sha256:<64hex>');
  if (!isHash(hiveVerdictReceiptHash)) errors.push('hiveVerdictReceiptHash must be sha256:<64hex>');
  if (stagingVerified !== true) errors.push('stagingVerified must be true');
  if (expiresAt != null && !isIso(expiresAt)) errors.push('expiresAt must be null or an ISO timestamp');
  if (errors.length) return { ok: false, errors };

  const body = {
    schema_version: LIVE_RECEIPT_SCHEMA_VERSION,
    receipt_kind: LIVE_RECEIPT_KIND,
    live_approval_id: liveApprovalId || `la_${reviewRecord.package_hash.slice(7, 19)}-${now}`,
    package_hash: reviewRecord.package_hash,
    package_kind: reviewRecord.package_kind,
    validator_version: LIVE_VALIDATOR_VERSION,
    local_receipt_hash: localReceiptHash,
    hive_verdict_receipt_hash: hiveVerdictReceiptHash,
    free_text_digest: reviewRecord.free_text_digest, // bind the EXACT screened strings (plan F3)
    human_review: {
      review_id: reviewRecord.review_id,
      reviewer_ref: reviewRecord.reviewer_ref,
      decision: 'approve_live',
      free_text_cleared: true,
      reviewed_at: reviewRecord.decided_at || new Date(now).toISOString(),
    },
    live_world_authorized: true, // DERIVED — only here, only from a valid approved candidate
    approved_live_at: new Date(now).toISOString(),
    expires_at: expiresAt,
    staging_verified: true,
  };
  return { ok: true, receipt: { ...body, receipt_hash: await liveReceiptHash(body) } };
}

/**
 * Async PURE: strict live-receipt validation, deny-by-default. `receipt_kind` is checked FIRST so a
 * receipt of the WRONG kind (a CF-2 local receipt, a CF-6 verdict) fails fast with `wrong_receipt_kind`
 * (threat-model F7 — type confusion). Unknown keys, a malformed binding hash, a missing/!approve_live
 * human_review block, a non-true `live_world_authorized` or `staging_verified`, or a `receipt_hash` that
 * does not recompute all FAIL. Validity here is NOT authorization — the loader still gates everything.
 */
export async function validateLiveApprovalReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return { ok: false, reason: 'not_an_object', errors: ['receipt is not an object'] };
  // F7: wrong kind fails fast, before any other interpretation.
  if (receipt.receipt_kind !== LIVE_RECEIPT_KIND) return { ok: false, reason: 'wrong_receipt_kind', errors: [`receipt_kind must be "${LIVE_RECEIPT_KIND}"`] };

  const errors = [];
  const allowed = new Set([...LIVE_BODY_KEYS, 'receipt_hash']);
  for (const k of Object.keys(receipt)) if (!allowed.has(k)) errors.push(`unknown receipt key: ${k}`);
  for (const k of allowed) if (!(k in receipt)) errors.push(`missing receipt key: ${k}`);

  if (receipt.schema_version !== LIVE_RECEIPT_SCHEMA_VERSION) errors.push(`schema_version must be ${LIVE_RECEIPT_SCHEMA_VERSION}`);
  if (typeof receipt.live_approval_id !== 'string' || !receipt.live_approval_id) errors.push('live_approval_id must be a non-empty string');
  if (!PACKAGE_KINDS.includes(receipt.package_kind)) errors.push(`package_kind must be one of ${PACKAGE_KINDS.join('|')}`);
  if (typeof receipt.validator_version !== 'string' || !receipt.validator_version) errors.push('validator_version must be a non-empty string');
  for (const h of ['package_hash', 'local_receipt_hash', 'hive_verdict_receipt_hash', 'free_text_digest']) {
    if (!isHash(receipt[h])) errors.push(`${h} must be sha256:<64hex>`);
  }
  // the human-review block (CF-8): a real approve_live decision with cleared free text.
  const hr = receipt.human_review;
  if (!hr || typeof hr !== 'object' || Array.isArray(hr)) errors.push('human_review must be an object');
  else {
    if (hr.decision !== 'approve_live') errors.push('human_review.decision must be approve_live');
    if (hr.free_text_cleared !== true) errors.push('human_review.free_text_cleared must be true');
    if (typeof hr.review_id !== 'string' || !hr.review_id) errors.push('human_review.review_id required');
    if (typeof hr.reviewer_ref !== 'string' || !hr.reviewer_ref) errors.push('human_review.reviewer_ref required');
    if (!isIso(hr.reviewed_at)) errors.push('human_review.reviewed_at must be an ISO timestamp');
  }
  if (receipt.live_world_authorized !== true) errors.push('live_world_authorized must be true on a live receipt');
  if (!isIso(receipt.approved_live_at)) errors.push('approved_live_at must be an ISO timestamp');
  if (receipt.expires_at != null && !isIso(receipt.expires_at)) errors.push('expires_at must be null or an ISO timestamp');
  if (receipt.staging_verified !== true) errors.push('staging_verified must be true (a fast-fail flag — not proof of record)');

  if (!isHash(receipt.receipt_hash)) errors.push('receipt_hash must be sha256:<64hex>');
  else if (receipt.receipt_hash !== await liveReceiptHash(receipt)) errors.push('receipt_hash does not match receipt body (tampered)');

  return { ok: errors.length === 0, errors };
}
