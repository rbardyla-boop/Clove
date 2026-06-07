/**
 * Creator Foundation CF-8 — human-review queue + moderation/audit layer (PURE core, local/operator).
 *
 * The human safety layer the live loader (CF-7, NOT YET BUILT) will depend on. A reviewer screens a
 * package's free-text fields (display_name / package_id / operator_note) for profanity, slurs,
 * harassment, impersonation, and PII — which the automated deny-regex does NOT catch — and records a
 * hash-bound decision in an append-only, hash-chained audit trail.
 *
 * CF-8 GRANTS ZERO LIVE AUTHORITY. The most a record can reach is `approved_for_live_candidate` — a human
 * RECOMMENDATION, not a live authorization: `live_world_authorized` is ALWAYS false on every record, no
 * loader is touched, and `LIVE_WORLD_LOADER_ENABLED` stays false. Only a future, separately-gated CF-7
 * live loader could ever turn a candidate into a live render, and only by ALSO re-checking its own live
 * receipt/registry/flag. A CF-6 validation verdict is NOT approval, and an unreviewed/revoked package is
 * never a candidate. See docs/CREATOR_FOUNDATION_CF8_REVIEW_QUEUE.md + the CF-7/CF-8 plan.
 *
 * Quarantine: this module imports ONLY the hash util — no approved-loader, no live registry, no Worker/DO.
 */

import { canonicalize, sha256Hex } from '../validator/package-hash.mjs';

export const RECORD_KIND = 'creator_review_record';
export const REVIEW_SCHEMA_VERSION = 1;

/** The review lifecycle. `approved_for_live_candidate` is a human recommendation, NOT live authorization. */
export const REVIEW_STATES = Object.freeze([
  'pending', 'needs_changes', 'rejected', 'approved_for_live_candidate', 'revoked',
]);

/** Free-text fields a human MUST screen before a package may become a live candidate. */
export const FREE_TEXT_FIELDS = Object.freeze(['display_name', 'package_id', 'operator_note']);
/** The criteria a human must attest were checked (the deny-regex does NOT cover these). */
export const REQUIRED_REVIEW_CRITERIA = Object.freeze(['profanity', 'slurs', 'harassment', 'impersonation', 'pii']);

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const PACKAGE_KINDS = Object.freeze(['block_style', 'block_layered', 'arcade_game']);
const NOTE_MAX = 280;
const MAX_QUEUE = 256;

/** Allowed state transitions (deny-by-default). Terminal: rejected, revoked. */
const TRANSITIONS = Object.freeze({
  pending: ['needs_changes', 'rejected', 'approved_for_live_candidate'],
  needs_changes: ['needs_changes', 'rejected', 'approved_for_live_candidate'],
  approved_for_live_candidate: ['revoked'],
  rejected: [],
  revoked: [],
});

const isHash = (h) => typeof h === 'string' && HASH_RE.test(h);
const isStr = (s, max) => typeof s === 'string' && s.length > 0 && (max ? s.length <= max : true);

/**
 * Return a copy callers can never use to mutate the internally-stored record: the nested `free_text` and
 * `review_criteria` are cloned too (a shallow `{...record}` would alias them). Used at EVERY return
 * boundary so a returned record/queue entry can't corrupt internal candidacy state (review finding F1).
 */
const cloneRecord = (r) => (r ? { ...r, free_text: { ...r.free_text }, review_criteria: [...r.review_criteria] } : r);

/**
 * Digest of the EXACT screened free-text strings (display_name/package_id/operator_note). Stored on the
 * record and written into the append-only audit, so a post-review swap of the screened strings is
 * tamper-evident, and a future CF-7 live receipt can bind this exact digest (plan F3 — no mint-time swap).
 */
async function freeTextDigest(ft) {
  return 'sha256:' + (await sha256Hex(canonicalize({ display_name: ft.display_name, package_id: ft.package_id, operator_note: ft.operator_note })));
}

/** Validate a submission to the queue. Returns { ok, errors }. */
export function validateSubmission(sub) {
  const errors = [];
  if (!sub || typeof sub !== 'object') return { ok: false, errors: ['submission is not an object'] };
  if (!isHash(sub.package_hash)) errors.push('package_hash must be sha256:<64hex>');
  if (!PACKAGE_KINDS.includes(sub.package_kind)) errors.push(`package_kind must be one of ${PACKAGE_KINDS.join('|')}`);
  if (!isHash(sub.receipt_hash)) errors.push('receipt_hash must be sha256:<64hex> (the CF-2 local approval receipt)');
  if (!isHash(sub.validator_report_hash)) errors.push('validator_report_hash must be sha256:<64hex>');
  const ft = sub.free_text;
  if (!ft || typeof ft !== 'object') errors.push('free_text must be an object of the human-label fields');
  else for (const f of FREE_TEXT_FIELDS) if (typeof ft[f] !== 'string') errors.push(`free_text.${f} must be a string (the exact value to screen)`);
  return { ok: errors.length === 0, errors };
}

function newReviewId(seed) { return 'rv_' + seed; }

/** Build a fresh PENDING review record from a submission. PURE (async for the free-text digest).
 *  live_world_authorized is ALWAYS false. Returns a clone (callers cannot reach internal state). */
export async function createReviewRecord(sub, { now = Date.now(), id } = {}) {
  const v = validateSubmission(sub);
  if (!v.ok) return { ok: false, errors: v.errors };
  const free_text = { display_name: sub.free_text.display_name, package_id: sub.free_text.package_id, operator_note: sub.free_text.operator_note };
  const record = {
    schema_version: REVIEW_SCHEMA_VERSION,
    record_kind: RECORD_KIND,
    review_id: newReviewId(id || `${sub.package_hash.slice(7, 19)}-${now}`),
    package_hash: sub.package_hash,
    package_kind: sub.package_kind,
    receipt_hash: sub.receipt_hash,
    validator_report_hash: sub.validator_report_hash,
    state: 'pending',
    free_text,
    free_text_digest: await freeTextDigest(free_text), // binds the EXACT screened strings (tamper-evident)
    free_text_reviewed: false,
    free_text_cleared: false,
    review_criteria: [],
    reviewer_ref: null,
    decided_at: null,
    note: null,
    revoked_at: null,
    revoke_reason: null,
    // CF-8 INVARIANT — hard-coded, never an input: CF-8 grants no live authority.
    live_world_authorized: false,
  };
  return { ok: true, record: cloneRecord(record) };
}

/**
 * A record is a LIVE CANDIDATE (a human recommendation) only when a human approved it for live AND screened
 * the free text AND it is not revoked. THIS IS NOT LIVE AUTHORIZATION — live render requires the separate,
 * still-disabled CF-7 loader. `live_world_authorized` remains false regardless.
 */
export function isLiveCandidate(record) {
  return !!record
    && record.state === 'approved_for_live_candidate'
    && record.free_text_reviewed === true
    && record.free_text_cleared === true
    && record.revoked_at === null
    && record.live_world_authorized === false;
}

/** Apply a human decision to a record (immutably). Deny-by-default; approval requires free-text review. */
export function decideReview(record, decision, { now = Date.now() } = {}) {
  if (!record || !REVIEW_STATES.includes(record.state)) return { ok: false, errors: ['record invalid'], record: cloneRecord(record) };
  const to = decision && decision.to_state;
  if (!REVIEW_STATES.includes(to)) return { ok: false, errors: [`unknown to_state: ${to}`], record: cloneRecord(record) };
  if (!TRANSITIONS[record.state].includes(to)) return { ok: false, errors: [`illegal transition ${record.state} -> ${to}`], record: cloneRecord(record) };
  if (!isStr(decision.reviewer_ref)) return { ok: false, errors: ['reviewer_ref is required'], record: cloneRecord(record) };
  if (decision.note != null && !isStr(decision.note, NOTE_MAX)) return { ok: false, errors: [`note must be a string <= ${NOTE_MAX}`], record: cloneRecord(record) };

  const next = { ...record, free_text: { ...record.free_text }, review_criteria: [...record.review_criteria], reviewer_ref: decision.reviewer_ref, decided_at: new Date(now).toISOString(), note: decision.note ?? null };

  if (to === 'approved_for_live_candidate') {
    // THE FREE-TEXT GATE: a human must have screened the free-text fields and cleared them, attesting the
    // required criteria. The automated validators do NOT cover slurs/harassment/impersonation/PII.
    const reviewed = decision.free_text_reviewed === true;
    const cleared = decision.free_text_cleared === true;
    const crit = Array.isArray(decision.review_criteria) ? decision.review_criteria : [];
    const missing = REQUIRED_REVIEW_CRITERIA.filter((c) => !crit.includes(c));
    if (!reviewed) return { ok: false, errors: ['approval requires free_text_reviewed: true (human screen of display_name/package_id/operator_note)'], record: cloneRecord(record) };
    if (!cleared) return { ok: false, errors: ['approval requires free_text_cleared: true'], record: cloneRecord(record) };
    if (missing.length) return { ok: false, errors: [`approval must attest all review criteria; missing: ${missing.join(', ')}`], record: cloneRecord(record) };
    next.free_text_reviewed = true;
    next.free_text_cleared = true;
    next.review_criteria = [...REQUIRED_REVIEW_CRITERIA];
  } else {
    // reject / needs_changes: record that the free text was looked at (cleared stays false; not a candidate)
    next.free_text_reviewed = decision.free_text_reviewed === true;
    next.free_text_cleared = false;
    next.review_criteria = Array.isArray(decision.review_criteria) ? decision.review_criteria.filter((c) => REQUIRED_REVIEW_CRITERIA.includes(c)) : [];
  }
  next.state = to;
  // live_world_authorized stays false — never settable here.
  next.live_world_authorized = false;
  return { ok: true, record: cloneRecord(next) };
}

/** Revoke a candidate (immutably). Irreversible — un-revoking needs a fresh submission/review. */
export function revokeReview(record, { reviewer_ref, reason, now = Date.now() } = {}) {
  if (!record) return { ok: false, errors: ['no record'] };
  if (!TRANSITIONS[record.state].includes('revoked')) return { ok: false, errors: [`cannot revoke from ${record.state}`], record: cloneRecord(record) };
  if (!isStr(reviewer_ref)) return { ok: false, errors: ['reviewer_ref required'], record: cloneRecord(record) };
  const next = { ...record, free_text: { ...record.free_text }, review_criteria: [...record.review_criteria], state: 'revoked', revoked_at: new Date(now).toISOString(), revoke_reason: isStr(reason, NOTE_MAX) ? reason : 'revoked', reviewer_ref, live_world_authorized: false };
  return { ok: true, record: cloneRecord(next) };
}

// ===================== append-only, hash-chained audit =====================

const GENESIS_PREV = 'sha256:' + '0'.repeat(64);

/** Append an audit entry hash-chained to the prior one. Tamper-evident. PURE (async for the hash). */
export async function appendAudit(log, { review_id, package_hash, from_state, to_state, reviewer_ref, reason, free_text_digest = null, now = Date.now() }) {
  const prev = log.length ? log[log.length - 1].entry_hash : GENESIS_PREV;
  const body = { seq: log.length, at: new Date(now).toISOString(), review_id, package_hash, from_state: from_state ?? null, to_state, reviewer_ref: reviewer_ref ?? null, reason: reason ?? null, free_text_digest: free_text_digest ?? null, prev_hash: prev };
  const entry_hash = 'sha256:' + (await sha256Hex(canonicalize(body)));
  return [...log, { ...body, entry_hash }];
}

/** Verify the audit chain is intact (every entry's hash + prev linkage recompute). PURE. */
export async function verifyAudit(log) {
  if (!Array.isArray(log)) return false;
  let prev = GENESIS_PREV;
  for (let i = 0; i < log.length; i++) {
    const e = log[i];
    if (e.seq !== i || e.prev_hash !== prev) return false;
    const body = { seq: e.seq, at: e.at, review_id: e.review_id, package_hash: e.package_hash, from_state: e.from_state, to_state: e.to_state, reviewer_ref: e.reviewer_ref, reason: e.reason, free_text_digest: e.free_text_digest ?? null, prev_hash: e.prev_hash };
    if (('sha256:' + (await sha256Hex(canonicalize(body)))) !== e.entry_hash) return false;
    prev = e.entry_hash;
  }
  return true;
}

/** Deterministic, public-safe report for a review record (no PII beyond the opaque reviewer_ref). */
export function reviewReport(record) {
  return {
    review_id: record.review_id,
    package_hash: record.package_hash,
    package_kind: record.package_kind,
    receipt_hash: record.receipt_hash,
    validator_report_hash: record.validator_report_hash,
    state: record.state,
    free_text_reviewed: record.free_text_reviewed,
    free_text_cleared: record.free_text_cleared,
    free_text_digest: record.free_text_digest, // binds the screened strings (tamper-evident)
    review_criteria: [...record.review_criteria],
    is_live_candidate: isLiveCandidate(record),
    live_world_authorized: false, // ALWAYS — CF-8 grants no live authority
    decided_at: record.decided_at,
    revoked_at: record.revoked_at,
  };
}

// ===================== in-memory queue (operator tooling) =====================

/**
 * An in-memory, bounded, deny-by-default review queue with an append-only hash-chained audit trail.
 * submit → pending; decide → transition (approval gated on free-text review); revoke → revoked. No
 * auto-approval; nothing is ever promoted without a recorded human decision. Grants ZERO live authority.
 */
export function createReviewQueue() {
  const byId = new Map();
  const byHash = new Map(); // package_hash → latest review_id
  let audit = [];

  // store a record the caller can NEVER reach by reference: clone + freeze the screened strings.
  const store = (rec) => {
    const c = cloneRecord(rec);
    Object.freeze(c.free_text); Object.freeze(c.review_criteria);
    byId.set(c.review_id, c);
    byHash.set(c.package_hash, c.review_id);
    return c;
  };

  return {
    async submit(sub, opts = {}) {
      if (byId.size >= MAX_QUEUE) return { ok: false, errors: ['queue is full (bounded; deny-by-default)'] };
      const r = await createReviewRecord(sub, opts);
      if (!r.ok) return r;
      const c = store(r.record);
      audit = await appendAudit(audit, { review_id: c.review_id, package_hash: c.package_hash, from_state: null, to_state: 'pending', reviewer_ref: null, reason: 'submitted', free_text_digest: c.free_text_digest, now: opts.now });
      return { ok: true, record: cloneRecord(c) };
    },
    async decide(reviewId, decision, opts = {}) {
      const rec = byId.get(reviewId);
      if (!rec) return { ok: false, errors: ['unknown review_id'] };
      const d = decideReview(rec, decision, opts);
      if (!d.ok) return d;
      const c = store(d.record);
      audit = await appendAudit(audit, { review_id: reviewId, package_hash: rec.package_hash, from_state: rec.state, to_state: c.state, reviewer_ref: decision.reviewer_ref, reason: decision.note || decision.to_state, free_text_digest: c.free_text_digest, now: opts.now });
      return { ok: true, record: cloneRecord(c) };
    },
    async revoke(reviewId, opts = {}) {
      const rec = byId.get(reviewId);
      if (!rec) return { ok: false, errors: ['unknown review_id'] };
      const r = revokeReview(rec, opts);
      if (!r.ok) return r;
      const c = store(r.record);
      audit = await appendAudit(audit, { review_id: reviewId, package_hash: rec.package_hash, from_state: rec.state, to_state: 'revoked', reviewer_ref: opts.reviewer_ref, reason: c.revoke_reason, free_text_digest: c.free_text_digest, now: opts.now });
      return { ok: true, record: cloneRecord(c) };
    },
    get(reviewId) { return cloneRecord(byId.get(reviewId) || null); },
    byPackageHash(hash) { const id = byHash.get(hash); return id ? cloneRecord(byId.get(id)) : null; },
    list(state) { const out = []; for (const r of byId.values()) if (!state || r.state === state) out.push(reviewReport(r)); return out; },
    /** Read-only: is the package (by hash) currently a live candidate? Still NOT live authorization. */
    isLiveCandidateHash(hash) { const id = byHash.get(hash); return id ? isLiveCandidate(byId.get(id)) : false; },
    audit() { return audit.map((e) => ({ ...e })); },
    verifyAudit() { return verifyAudit(audit); },
    get size() { return byId.size; },
  };
}
