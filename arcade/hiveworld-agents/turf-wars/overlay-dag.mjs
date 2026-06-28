/**
 * Turf Wars — Phase 3c MULTI-WRITER OVERLAY (O6, lab) · CONTENT-ADDRESSED CONVERGENT OVERLAY + KEYLESS
 * REVOCATION + SECOND FINGERPRINT. Pure.
 *
 * ⚠️ LAB ONLY — see settlement-mini-log.mjs / settlement.mjs headers. `arcade/hiveworld-agents/turf-wars/`
 * is denylisted from the curated production upload and imported by no Worker/DO/client path. This authorizes
 * nothing live. The roadmap stays DRAFT/DESIGN-ONLY and Phase 0 legal/safety counsel remains BLOCKING.
 *
 * Layers 2–4 of the O6 mechanism (docs/NEON_CIRCUIT_TURF_WARS_PHASE3_PLAN.md, Residual 3):
 *
 *  Layer 2 — Overlay DAG. The overlay is a SET of mini-log head entries
 *    { mini_log_id, attacker_pubkey, head_hash, seq_height, outcome_digest, status }.
 *  `foldOverlay` is PURE over the entry set: dedup by mini_log_id keeping MAX seq_height (tie-break LOWEST
 *  head_hash, mirroring the existing fork rule), canonical-sort by mini_log_id. Cross-writer ordering needs
 *  NO shared seq — the merge is deterministic over the entry set, so two peers holding the same entries
 *  produce the same overlayFingerprint, in any delivery order, with duplicates.
 *
 *  Layer 3 — Revocation. Any peer who can compute proveFraud (settlement.mjs, PURE over public inputs) emits
 *  a revocation { mini_log_id, fraud_proof, revoker_pubkey, sig? }. Any peer verifies it by RE-RUNNING
 *  proveFraud over the attacker's settlement_reveal and checking mismatch === true. `foldOverlay` applies
 *  revocations in a SECOND pass, setting status = 'revoked' and EXCLUDING that entry's scorch from the
 *  applied total. The revoker's signature is INFORMATIONAL only — correctness depends on proveFraud purity,
 *  NOT on who signed; THE OWNER NEED NOT BE ONLINE OR SIGN. A dual-Set dedup (applied-id + rejected-id,
 *  mirroring agent-ledger.mjs) makes a re-delivered / duplicate / invalid revocation a no-op so a revocation
 *  flood cannot grow audit state.
 *
 *  Layer 4 — Second fingerprint. blockFingerprint (block-log.mjs) is UNMODIFIED; a SEPARATE
 *  `overlayFingerprint` covers the settlement overlay. Concurrent attacks on one base are distinct
 *  mini_log_ids; their NON-REVOKED scorch is applied additively via the already-bounded applyScorch
 *  (scorch.mjs) in canonical mini_log_id order, so even simultaneous attacks are deterministic and
 *  per-structure-bounded by SCORCH_CAP.
 *
 * No central authority: mini_log_id is content-derived; foldOverlay is a pure deterministic function of the
 * entry set; revocation needs no owner, no online referee, no trusted relay. Any relay/holder is optional and
 * swappable — swapping it changes propagation speed, not correctness.
 *
 * Determinism: pure, zero-dep; node:crypto via canonical.mjs / identity.mjs; NO Date.now / Math.random.
 */
import { sha256Hex } from './canonical.mjs';
import { signBytes } from './identity.mjs';
import { applyScorch, SCORCH_CAP } from './scorch.mjs';
import { proveFraud } from './settlement.mjs';

export const OVERLAY_VERSION = 1;

/** The closed overlay-entry status set. 'settled' = a folded reveal stands; 'revoked' = a valid fraud-proof
 * struck it (its scorch is excluded). (D2's provisional/final ride the SAME field in a later integration.) */
export const ENTRY_STATUS = Object.freeze({ SETTLED: 'settled', REVOKED: 'revoked' });

const HASH64 = /^[0-9a-f]{64}$/;       // content-derived mini_log_id / sha256 digest
const PUBKEY_RE = /^[0-9a-f]{64}$/;    // raw Ed25519 pubkey hex
const isInt = (v) => Number.isInteger(v);

/**
 * PURE: build an overlay entry from a folded mini-log state (settlement-mini-log.mjs `foldMiniLog`). An entry
 * exists only once a reveal has folded (a bare commit produces no settlement to overlay). Returns null if the
 * mini-log has no folded reveal.
 */
export function overlayEntryFromMiniLog(miniState) {
  if (!miniState || !miniState.reveal || !miniState.mini_log_id || !miniState.attacker) return null;
  return {
    mini_log_id: miniState.mini_log_id,
    attacker_pubkey: miniState.attacker,
    head_hash: miniState.mini_log_head,
    seq_height: miniState.seq_height,
    outcome_digest: miniState.reveal.outcome_digest,
    scorch: { ...miniState.reveal.scorch }, // the reveal's per-structure scorch map (bounded by schema)
    status: ENTRY_STATUS.SETTLED,
  };
}

/** PURE: structural validity of an overlay entry. Returns null if well-formed, else a reason. */
export function validateEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return 'malformed_entry';
  if (typeof entry.mini_log_id !== 'string' || !HASH64.test(entry.mini_log_id)) return 'bad_mini_log_id';
  if (typeof entry.attacker_pubkey !== 'string' || !PUBKEY_RE.test(entry.attacker_pubkey)) return 'bad_attacker_pubkey';
  if (typeof entry.head_hash !== 'string' || entry.head_hash.length === 0) return 'bad_head_hash';
  if (!isInt(entry.seq_height) || entry.seq_height < 0) return 'bad_seq_height';
  if (typeof entry.outcome_digest !== 'string' || entry.outcome_digest.length === 0) return 'bad_outcome_digest';
  if (entry.scorch && (typeof entry.scorch !== 'object' || Array.isArray(entry.scorch))) return 'bad_scorch';
  return null;
}

/**
 * PURE: build a revocation entry. `fraud_proof` is the object proveFraud returned (mismatch === true). The
 * revoker signs the revocation's own content address — INFORMATIONAL ONLY (correctness traces to proveFraud,
 * not the signer); the OWNER need not be involved. The revoker may be ANY peer holding baseRecord + plan.
 */
export function makeRevocationEntry({ mini_log_id, fraud_proof, revoker_identity } = {}) {
  const body = {
    v: OVERLAY_VERSION,
    kind: 'overlay_revoke',
    mini_log_id,
    fraud_proof,
    revoker_pubkey: revoker_identity ? revoker_identity.publicRawHex : null,
  };
  // a stable content-addressed id so re-delivery of the SAME revocation dedups (mirrors rejectedIds)
  const revoke_id = sha256Hex(`overlay-revoke/v${OVERLAY_VERSION}|${mini_log_id}|${fraud_proof && fraud_proof.mismatch}|${fraud_proof && (fraud_proof.honest_digest || fraud_proof.reason || '')}|${fraud_proof && fraud_proof.claimed_digest || ''}`);
  const sig = revoker_identity ? signBytes(revoker_identity.privateKey, revoke_id) : null;
  return { ...body, revoke_id, sig };
}

/**
 * PURE, KEYLESS for the owner: verify a revocation by RE-RUNNING proveFraud over the attacker's settlement
 * (reconstructable from the overlay entry's claim) against the public inputs. Returns true iff the settlement
 * really is fraudulent. The revoker's signature is NOT checked here — correctness depends on proveFraud
 * purity, not on who signed.
 *
 *   @param entry   the overlay entry being revoked (its claim is reconstructed via `claim`)
 *   @param baseRecord  the defender's signed snapshot (public; the OWNER need not be online)
 *   @param plan    the attacker's signed attack plan (public)
 *   @param claim   the attacker's settlement_reveal payload (the claimed settlement) — the actual data
 *                  proveFraud re-checks. Must bind to the same mini_log_id as `entry`.
 */
export function verifyRevocationEntry(entry, baseRecord, plan, claim) {
  if (!entry || typeof entry !== 'object') return false;
  if (typeof entry.mini_log_id !== 'string' || !HASH64.test(entry.mini_log_id)) return false;
  if (!claim || typeof claim !== 'object') return false;
  // the claim must concern the SAME settlement the entry points at (digest binding — MANDATORY).
  // verifyRevocationEntry is exported and may be called directly, so it does NOT assume an upstream
  // validateEntry has run: the entry must itself carry a non-empty digest the claim has to match.
  if (typeof entry.outcome_digest !== 'string' || entry.outcome_digest.length === 0) return false;
  if (claim.outcome_digest !== entry.outcome_digest) return false;
  const fraud = proveFraud(baseRecord, plan, claim);
  return !!fraud && fraud.mismatch === true;
}

/**
 * PURE: fold an overlay entry set (+ optional verified revocations) into a deterministic overlay state.
 *
 * Pass 1 (dedup): keep ONE entry per mini_log_id — MAX seq_height wins, tie-break LOWEST head_hash (the same
 *   fork rule the base chain uses). Canonical-sort survivors by mini_log_id.
 * Pass 2 (revoke): apply revocations. A revocation is APPLIED iff it has not been seen before (dual-Set
 *   dedup: applied-id + rejected-id) AND `isVerified(rev)` is true; it sets the matching entry's status to
 *   'revoked'. A revoked entry's scorch is EXCLUDED from the applied total. A duplicate / unverifiable /
 *   no-match revocation is a no-op and cannot grow audit state.
 *
 * `isVerified` is supplied by the caller (it wraps verifyRevocationEntry over the public inputs the caller
 * holds) so this fold stays pure over its arguments. When omitted, a revocation must carry
 * `fraud_proof.mismatch === true` (already-verified form) to apply — never trusted blindly otherwise.
 *
 * Returns { entries (canonical), by_id, revoked (set of mini_log_ids), applied_scorch (additive, bounded),
 * applied_total, rejected_revocations }.
 */
export function foldOverlay(entries, revocations = [], { isVerified } = {}) {
  // ── pass 1: dedup by mini_log_id (max seq_height; tie-break lowest head_hash) ──
  const list = Array.isArray(entries) ? entries : [];
  const best = new Map(); // mini_log_id -> entry
  const rejectedEntries = [];
  for (const raw of list) {
    const reason = validateEntry(raw);
    if (reason) { rejectedEntries.push({ ref: (raw && raw.head_hash) || '?', reason }); continue; }
    const e = { ...raw, scorch: { ...(raw.scorch || {}) }, status: ENTRY_STATUS.SETTLED };
    const prev = best.get(e.mini_log_id);
    if (!prev) { best.set(e.mini_log_id, e); continue; }
    if (e.seq_height > prev.seq_height
      || (e.seq_height === prev.seq_height && e.head_hash.localeCompare(prev.head_hash) < 0)) {
      best.set(e.mini_log_id, e); // higher seq, or same seq + lower head hash, wins
    }
  }
  // canonical order by mini_log_id
  const canonical = [...best.values()].sort((a, b) => a.mini_log_id.localeCompare(b.mini_log_id));

  // ── pass 2: revocations (dual-Set dedup; mirror agent-ledger.mjs rejectedIds) ──
  const revoked = new Set();
  const appliedRevokes = new Set();
  const rejectedRevokes = new Set();
  const rejected_revocations = [];
  const verify = (rev) => (typeof isVerified === 'function'
    ? !!isVerified(rev)
    : !!(rev && rev.fraud_proof && rev.fraud_proof.mismatch === true)); // already-verified form
  const rejectRev = (rev, reason) => {
    const id = String((rev && rev.revoke_id) || '?');
    if (rejectedRevokes.has(id) || appliedRevokes.has(id)) return; // first-seen kept; re-delivery silenced
    rejectedRevokes.add(id);
    rejected_revocations.push({ revoke_id: id, reason });
  };
  for (const rev of Array.isArray(revocations) ? revocations : []) {
    const id = String((rev && rev.revoke_id) || '?');
    if (appliedRevokes.has(id) || rejectedRevokes.has(id)) continue; // duplicate delivery → no-op
    if (!rev || typeof rev !== 'object' || typeof rev.mini_log_id !== 'string') { rejectRev(rev, 'malformed_revocation'); continue; }
    if (!best.has(rev.mini_log_id)) { rejectRev(rev, 'no_such_mini_log'); continue; }
    if (!verify(rev)) { rejectRev(rev, 'fraud_proof_not_verified'); continue; } // false revocation discarded
    appliedRevokes.add(id);
    revoked.add(rev.mini_log_id);
  }

  // ── apply: status + additive bounded scorch over NON-REVOKED entries, in canonical mini_log_id order ──
  let applied_scorch = {};
  const by_id = {};
  for (const e of canonical) {
    const isRevoked = revoked.has(e.mini_log_id);
    e.status = isRevoked ? ENTRY_STATUS.REVOKED : ENTRY_STATUS.SETTLED;
    by_id[e.mini_log_id] = e;
    if (!isRevoked) applied_scorch = applyScorch(applied_scorch, e.scorch || {}); // bounded by SCORCH_CAP
  }
  const applied_total = Object.values(applied_scorch).reduce((a, v) => a + v, 0);

  return {
    entries: canonical,
    by_id,
    revoked,
    rejected_entries: rejectedEntries,
    rejected_revocations,
    applied_scorch,
    applied_total,
  };
}

/**
 * PURE: a SEPARATE convergence oracle for the overlay — NOT a change to blockFingerprint. Two peers with the
 * same overlay entry set (and verified revocations) get the same overlayFingerprint, regardless of delivery
 * order or duplicates. Excludes volatile bookkeeping (rejected lists). Includes each entry's status so a
 * revocation is reflected; includes the additive applied scorch total so divergent scorch never collides.
 */
export function overlayFingerprint(overlayState) {
  const entries = (overlayState.entries || [])
    .map((e) => `${e.mini_log_id}:${e.attacker_pubkey}:${e.head_hash}@${e.seq_height}=${e.outcome_digest}/${e.status}`);
  const scorch = Object.keys(overlayState.applied_scorch || {}).sort()
    .map((id) => `${id}=${overlayState.applied_scorch[id]}`);
  return [
    `overlay/v${OVERLAY_VERSION}`,
    `n=${entries.length}`,
    `revoked=${overlayState.revoked ? overlayState.revoked.size : 0}`,
    `entries=[${entries.join('|')}]`,
    `scorch=[${scorch.join('|')}]`,
    `total=${overlayState.applied_total}`,
  ].join(';');
}

/** PURE: bounds-invariant self-check — every applied scorch value is an integer in [0, SCORCH_CAP]. */
export function overlayBoundsHold(overlayState) {
  const sc = overlayState.applied_scorch || {};
  for (const id of Object.keys(sc)) {
    const v = sc[id];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > SCORCH_CAP) return false;
  }
  return true;
}
