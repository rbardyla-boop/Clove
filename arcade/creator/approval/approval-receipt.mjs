/**
 * Creator Foundation CF-2 — approval RECEIPT model, PURE + cross-env (Node 18.4+ / browser).
 *
 * A receipt is the atomic, hash-bound approval artifact for ONE package. It records what an operator
 * decided LOCALLY about a package (identified by its canonical `package_hash`) and at what level of
 * trust. In CF-2 the only trust a receipt may carry is local: `live_world_authorized` is ALWAYS
 * false — no receipt can claim production / live-world approval, because no live loader exists yet.
 * The receipt is itself hash-addressed (`receipt_hash` = canonical SHA-256 of the receipt body) so
 * it cannot be silently edited after the fact. Reuses the CF-1 canonical hashing primitives.
 */
import { canonicalize, sha256Hex } from '../validator/package-hash.mjs';

export const RECEIPT_SCHEMA_VERSION = 1;
export const RECEIPT_KIND = 'creator_approval_receipt';
export const VALIDATOR_VERSION = 'creator-validator-cf2';

/** The ONLY approval statuses. None of them implies live-world / production authorization. */
export const APPROVAL_STATUSES = Object.freeze(['local_validation_only', 'operator_approved_local', 'rejected']);
/** The single status that lets the loader render an APPROVED LOCAL PREVIEW (still never live). */
export const APPROVED_LOCAL = 'operator_approved_local';

/** Shared primitives (re-used by the registry + loader so the rules never drift). */
export const HASH_RE = /^sha256:[0-9a-f]{64}$/;
export const PACKAGE_KINDS = Object.freeze(['block_style', 'block_layered', 'arcade_game']);
const NOTE_MAX = 200;

/** Receipt fields covered by `receipt_hash` (everything except the hash itself), in declared order. */
const RECEIPT_BODY_KEYS = Object.freeze([
  'schema_version', 'receipt_kind', 'package_hash', 'package_kind',
  'approval_status', 'validator_version', 'operator_note', 'live_world_authorized', 'approved_at',
]);

function receiptBody(receipt) {
  const body = {};
  for (const k of RECEIPT_BODY_KEYS) body[k] = receipt[k];
  return body;
}

/** Async: deterministic receipt hash = canonical SHA-256 over the receipt body (excludes receipt_hash). */
export async function receiptHash(receipt) {
  return `sha256:${await sha256Hex(canonicalize(receiptBody(receipt)))}`;
}

/**
 * Async: build a complete, hash-sealed receipt. `live_world_authorized` is hard-wired false — there
 * is intentionally NO parameter to set it true in CF-2. `now` is an explicit epoch-ms timestamp so
 * the receipt (and its hash) are deterministic for tests and reproducible operator runs.
 */
export async function buildApprovalReceipt({
  packageHash, packageKind, status, operatorNote = '',
  validatorVersion = VALIDATOR_VERSION, now = Date.now(),
}) {
  const body = {
    schema_version: RECEIPT_SCHEMA_VERSION,
    receipt_kind: RECEIPT_KIND,
    package_hash: packageHash,
    package_kind: packageKind,
    approval_status: status,
    validator_version: validatorVersion,
    operator_note: String(operatorNote || '').slice(0, NOTE_MAX),
    live_world_authorized: false,        // CF-2 INVARIANT: always false. No live loader exists to honor true.
    approved_at: new Date(now).toISOString(),
  };
  return { ...body, receipt_hash: await receiptHash(body) };
}

/**
 * Async PURE: strict receipt validation, deny-by-default. Unknown keys, a bad status, a malformed
 * hash, a true `live_world_authorized`, or a `receipt_hash` that does not match the body all FAIL.
 * @returns {Promise<{ok:boolean, errors:string[]}>}
 */
export async function validateReceipt(receipt) {
  const errors = [];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return { ok: false, errors: ['receipt is not an object'] };

  const allowed = new Set([...RECEIPT_BODY_KEYS, 'receipt_hash']);
  for (const k of Object.keys(receipt)) if (!allowed.has(k)) errors.push(`unknown receipt key: ${k}`);
  for (const k of allowed) if (!(k in receipt)) errors.push(`missing receipt key: ${k}`);

  if (receipt.schema_version !== RECEIPT_SCHEMA_VERSION) errors.push(`schema_version must be ${RECEIPT_SCHEMA_VERSION}`);
  if (receipt.receipt_kind !== RECEIPT_KIND) errors.push(`receipt_kind must be "${RECEIPT_KIND}"`);
  if (typeof receipt.package_hash !== 'string' || !HASH_RE.test(receipt.package_hash)) errors.push('package_hash must be sha256:<64hex>');
  if (!PACKAGE_KINDS.includes(receipt.package_kind)) errors.push(`package_kind must be one of ${PACKAGE_KINDS.join('|')}`);
  if (!APPROVAL_STATUSES.includes(receipt.approval_status)) errors.push(`approval_status must be one of ${APPROVAL_STATUSES.join('|')}`);
  if (typeof receipt.validator_version !== 'string' || !receipt.validator_version) errors.push('validator_version must be a non-empty string');
  if (typeof receipt.operator_note !== 'string' || receipt.operator_note.length > NOTE_MAX) errors.push(`operator_note must be a string ≤ ${NOTE_MAX} chars`);
  if (receipt.live_world_authorized !== false) errors.push('live_world_authorized must be false (no live loader exists in CF-2)');
  if (typeof receipt.approved_at !== 'string' || Number.isNaN(Date.parse(receipt.approved_at))) errors.push('approved_at must be an ISO timestamp');
  if (typeof receipt.receipt_hash !== 'string' || !HASH_RE.test(receipt.receipt_hash)) errors.push('receipt_hash must be sha256:<64hex>');
  else if (receipt.receipt_hash !== await receiptHash(receipt)) errors.push('receipt_hash does not match receipt body (tampered)');

  return { ok: errors.length === 0, errors };
}

/** Async: does this (valid) receipt bind to `packageHash`? (Hash binding only — not approval level.) */
export async function receiptBindsTo(receipt, packageHash) {
  const v = await validateReceipt(receipt);
  return v.ok && receipt.package_hash === packageHash;
}
