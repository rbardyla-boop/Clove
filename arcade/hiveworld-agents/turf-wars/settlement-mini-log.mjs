/**
 * Turf Wars — Phase 3c MULTI-WRITER OVERLAY (O6, lab) · PER-ATTACKER SETTLEMENT MINI-LOG. Pure.
 *
 * ⚠️ LAB ONLY — see settlement.mjs / canonical.mjs headers. `arcade/hiveworld-agents/turf-wars/` is
 * denylisted from the curated production upload and imported by no Worker/DO/client path. This authorizes
 * nothing live: no live combat, no minors-facing use, no economy, no production exposure. The roadmap stays
 * DRAFT/DESIGN-ONLY and Phase 0 legal/safety counsel remains BLOCKING for any live or minors-facing use.
 *
 * This is Layer 1 of the O6 mechanism designed in docs/NEON_CIRCUIT_TURF_WARS_PHASE3_PLAN.md (Residual 3,
 * PASCAL/CAO). The owner's base chain (block-log.mjs `assembleChain`) is NEVER touched — `actor === owner`
 * there stays absolute, a foreign op there stays `not_owner`/inert. O6 adds writers in a SEPARATE namespace:
 * each attacker `A` is the SOLE writer of their OWN single-writer mini-log against one defender base.
 *
 * One writer per mini-log, many mini-logs per block. The mini-log id is CONTENT-DERIVED (coordination-free):
 *   mini_log_id = sha256("settlement-mini-log/v1|" + block_id + "|" + base_address + "|" + attacker_pubkey)
 * so two peers name the same attacker's mini-log identically with no coordinator. It carries exactly two op
 * types — `settlement_commit` (seq 0; mirrors the base `attack_commit`) and `settlement_reveal` (mirrors
 * `settle_attack`, carrying the FULL settlement). Both are authored SOLELY by the attacker.
 *
 * `foldMiniLog` MIRRORS `assembleChain` discipline exactly, in the mini-log's own namespace:
 *   - `actor === attacker` enforced at EVERY seq (foreign-signed op → rejected `not_attacker`, inert, never
 *     joins the chain) — the single-writer-of-own-chain invariant for this namespace;
 *   - dedup by op.hash (a re-delivered op is a no-op);
 *   - dense seq from 0, each op's `prev` referencing the previous accepted op's hash;
 *   - forks (two eligible ops at one seq) resolved by LOWEST op-hash; the loser is `fork_detected`;
 *   - a `settlement_reveal` requires a prior `settlement_commit` at a STRICTLY-LOWER seq in the same mini-log
 *     (else `no_prior_commit`) — D1's commit-before-beacon ordering, expressed inside the attacker's own log.
 *
 * Determinism: pure, zero-dep; node:crypto via canonical.mjs / identity.mjs (Ed25519 sign/verify); ONE lcg
 * lives only in the evidence pack; NO Date.now / Math.random / wall clock. `tick` is a logical clock.
 */
import { contentAddress, isContentAddress, sha256Hex } from './canonical.mjs';
import { signBytes, verifyBytes } from './identity.mjs';
import { SCORCH_CAP } from './scorch.mjs';
import { BEACON_HEIGHT_MAX, STRUCTURE_ID_RE } from './ops.mjs';
import { SEED_TOKEN_RE } from './settlement.mjs';

export const MINI_LOG_VERSION = 1;

/** The CLOSED top-level envelope of a mini-log op. `verifyMiniOp` rejects any unknown top-level key BEFORE
 * signature verification, so an extra unsigned field can never ride along on a "valid" op (same fail-closed
 * discipline as the base op envelope). The signable core commits to the first 7 keys only. */
export const MINI_OP_ENVELOPE_KEYS = Object.freeze([
  'v', 'mini_log_id', 'prev', 'seq', 'tick', 'actor', 'type', 'payload', 'hash', 'sig',
]);
const MINI_ENVELOPE_KEY_SET = new Set(MINI_OP_ENVELOPE_KEYS);

/** The CLOSED mini-log op vocabulary. Nothing outside this list folds. These are SEPARATE from OP_TYPES —
 * the base op grammar (ops.mjs) is unchanged. */
export const MINI_OP_TYPES = Object.freeze(['settlement_commit', 'settlement_reveal']);

const isInt = (v) => Number.isInteger(v);
const MINI_LOG_ID_RE = /^[0-9a-f]{64}$/; // a sha256 hex digest (no prefix) — the content-derived mini-log id

/**
 * PURE: the content-derived mini-log id for (block, base, attacker). Coordination-free: two peers compute
 * the same id with no coordinator. Returns a bare 64-hex sha256 digest.
 */
export function makeMiniLogId({ block_id, base_address, attacker_pubkey } = {}) {
  if (typeof block_id !== 'string' || typeof base_address !== 'string' || typeof attacker_pubkey !== 'string') {
    throw new Error('makeMiniLogId requires block_id, base_address, attacker_pubkey strings');
  }
  return sha256Hex(`settlement-mini-log/v${MINI_LOG_VERSION}|${block_id}|${base_address}|${attacker_pubkey}`);
}

/** PURE: the signable core of a mini-log op (everything the hash + signature commit to). */
export function miniOpCore({ mini_log_id, prev, seq, tick, actor, type, payload }) {
  return { v: MINI_LOG_VERSION, mini_log_id, prev, seq, tick, actor, type, payload };
}

/** PURE: the content-address hash of a mini-log op core. */
export function hashMiniOp(core) {
  return contentAddress(core);
}

/** PURE: strict per-type payload schema for a mini-log op. Returns null if EXACTLY shaped, else a reason.
 * `settlement_commit` mirrors attack_commit; `settlement_reveal` mirrors the full settle_attack payload. */
export function validateMiniPayload(type, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'payload_not_object';
  const keys = Object.keys(payload);
  const only = (allowed) => keys.every((k) => allowed.includes(k)) && allowed.every((k) => keys.includes(k));
  if (type === 'settlement_commit') {
    if (!only(['base_address', 'plan_hash', 'seed_commit', 'beacon_height'])) return 'settlement_commit_shape';
    if (!isContentAddress(payload.base_address)) return 'bad_base_address';
    if (!isContentAddress(payload.plan_hash)) return 'bad_plan_hash';
    if (typeof payload.seed_commit !== 'string' || !/^[0-9a-f]{64}$/.test(payload.seed_commit)) return 'bad_seed_commit';
    if (!isInt(payload.beacon_height) || payload.beacon_height < 1 || payload.beacon_height > BEACON_HEIGHT_MAX) return 'bad_beacon_height';
    return null;
  }
  if (type === 'settlement_reveal') {
    if (!only(['base_address', 'plan_hash', 'seed_commit', 'seed_reveal', 'beacon', 'beacon_height', 'scorch', 'outcome_digest'])) return 'settlement_reveal_shape';
    if (!isContentAddress(payload.base_address)) return 'bad_base_address';
    if (!isContentAddress(payload.plan_hash)) return 'bad_plan_hash';
    if (!isContentAddress(payload.outcome_digest)) return 'bad_outcome_digest';
    if (typeof payload.seed_commit !== 'string' || !/^[0-9a-f]{64}$/.test(payload.seed_commit)) return 'bad_seed_commit';
    if (typeof payload.seed_reveal !== 'string' || !SEED_TOKEN_RE.test(payload.seed_reveal)) return 'bad_seed_reveal';
    if (typeof payload.beacon !== 'string' || !SEED_TOKEN_RE.test(payload.beacon)) return 'bad_beacon';
    if (!isInt(payload.beacon_height) || payload.beacon_height < 1 || payload.beacon_height > BEACON_HEIGHT_MAX) return 'bad_beacon_height';
    const sc = payload.scorch;
    if (!sc || typeof sc !== 'object' || Array.isArray(sc)) return 'bad_scorch';
    for (const k of Object.keys(sc)) {
      if (!STRUCTURE_ID_RE.test(k)) return 'bad_scorch_key';
      const val = sc[k];
      if (!isInt(val) || val < 0 || val > SCORCH_CAP) return 'bad_scorch_value';
    }
    return null;
  }
  return 'unknown_mini_op';
}

/**
 * Build a fully-signed mini-log op from the attacker identity. The hash is derived from the core and the
 * signature is Ed25519 over the hash string (same scheme as the base op grammar; no second scheme).
 */
export function makeMiniOp(identity, { mini_log_id, prev = null, seq, tick, type, payload }) {
  const core = miniOpCore({ mini_log_id, prev, seq, tick, actor: identity.publicRawHex, type, payload });
  const hash = hashMiniOp(core);
  const sig = signBytes(identity.privateKey, hash);
  return { ...core, hash, sig };
}

/** Convenience: build a `settlement_commit` op (seq 0; the attacker's binding commitment). */
export function makeSettlementCommitOp(identity, { mini_log_id, prev, seq, tick }, { base_address, plan_hash, seed_commit, beacon_height }) {
  return makeMiniOp(identity, { mini_log_id, prev, seq, tick, type: 'settlement_commit', payload: { base_address, plan_hash, seed_commit, beacon_height } });
}

/** Convenience: build a `settlement_reveal` op from a full settlement record (settlement.mjs `settlement`). */
export function makeSettlementRevealOp(identity, { mini_log_id, prev, seq, tick }, settlement) {
  return makeMiniOp(identity, {
    mini_log_id, prev, seq, tick, type: 'settlement_reveal',
    payload: {
      base_address: settlement.base_address,
      plan_hash: settlement.plan_hash,
      seed_commit: settlement.seed_commit,
      seed_reveal: settlement.seed_reveal,
      beacon: settlement.beacon,
      beacon_height: settlement.beacon_height,
      scorch: settlement.scorch,
      outcome_digest: settlement.outcome_digest,
    },
  });
}

/**
 * PURE: cryptographic + structural verification of a single mini-log op, independent of any chain context.
 * Returns null if well-formed, hash-consistent, and correctly signed by `actor`; else a reason. ORIGIN +
 * INTEGRITY only — chain authority (single-writer, ordering) is enforced by foldMiniLog.
 */
export function verifyMiniOp(op) {
  if (!op || typeof op !== 'object' || Array.isArray(op)) return 'malformed_op';
  for (const k of Object.keys(op)) if (!MINI_ENVELOPE_KEY_SET.has(k)) return 'unknown_op_key';
  if (op.v !== MINI_LOG_VERSION) return 'bad_version';
  if (typeof op.mini_log_id !== 'string' || !MINI_LOG_ID_RE.test(op.mini_log_id)) return 'bad_mini_log_id';
  if (!(op.prev === null || isContentAddress(op.prev))) return 'bad_prev';
  if (!isInt(op.seq) || op.seq < 0) return 'bad_seq';
  if (!isInt(op.tick) || op.tick < 0) return 'bad_tick';
  if (typeof op.actor !== 'string' || !/^[0-9a-f]{64}$/.test(op.actor)) return 'bad_actor';
  if (!MINI_OP_TYPES.includes(op.type)) return 'unknown_mini_op';
  const shape = validateMiniPayload(op.type, op.payload);
  if (shape) return shape;
  if (hashMiniOp(miniOpCore(op)) !== op.hash) return 'hash_mismatch';
  if (!verifyBytes(op.actor, op.hash, op.sig)) return 'bad_signature';
  return null;
}

// ── chain assembly (mirrors assembleChain in the mini-log's own namespace) ────
/**
 * PURE: assemble the canonical mini-log chain from an op set. Returns
 * { chain, attacker, mini_log_id, rejected }. Convergent: depends only on the op set, never delivery order.
 * Single-writer: every op (incl. seq 0) must be signed by the SAME attacker; a foreign-signed op is
 * `not_attacker` and never joins. A settlement_reveal requires a prior settlement_commit at a strictly-lower
 * seq; an attacker may post at most one settlement_commit per mini-log (extra commits are `duplicate_commit`).
 */
function assembleMiniChain(ops) {
  const rejected = [];
  const refOf = (op) => (op && op.hash) || '?';
  // 1. crypto/structural validity; dedup replays by op-hash
  const validByHash = new Map();
  for (const op of Array.isArray(ops) ? ops : []) {
    const reason = verifyMiniOp(op);
    if (reason) { rejected.push({ ref: refOf(op), reason }); continue; }
    if (!validByHash.has(op.hash)) validByHash.set(op.hash, op);
  }
  // 2. index valid ops by seq
  const bySeq = new Map();
  for (const op of validByHash.values()) {
    if (!bySeq.has(op.seq)) bySeq.set(op.seq, []);
    bySeq.get(op.seq).push(op);
  }
  // 3. walk seq upward, choosing the lowest-hash eligible op at each level. The mini-log binds its writer at
  //    genesis (seq 0 = settlement_commit, prev null) and requires actor===attacker AND mini_log_id match at
  //    every seq. A settlement_reveal is eligible only after a commit was chosen at a lower seq.
  const chain = [];
  const chosen = new Set();
  let head = null;        // expected prev hash for the next op
  let attacker = null;    // bound from genesis
  let miniLogId = null;
  let commitSeen = false; // a settlement_commit has been chosen at a lower seq
  for (let seq = 0; bySeq.has(seq); seq++) {
    const candidates = bySeq.get(seq);
    const connects = (op) => seq === 0
      ? (op.type === 'settlement_commit' && op.prev === null)
      : (op.prev === head && op.mini_log_id === miniLogId && op.actor === attacker
         && (op.type !== 'settlement_reveal' || commitSeen));
    const eligible = candidates.filter(connects).sort((a, b) => a.hash.localeCompare(b.hash));
    if (eligible.length === 0) break; // gap / no authorized op at this seq — chain stops here
    const pick = eligible[0];
    chain.push(pick);
    chosen.add(pick.hash);
    if (seq === 0) { attacker = pick.actor; miniLogId = pick.mini_log_id; }
    if (pick.type === 'settlement_commit') commitSeen = true;
    head = pick.hash;
    for (const sib of eligible.slice(1)) { rejected.push({ ref: sib.hash, reason: 'fork_detected' }); chosen.add(sib.hash); }
  }
  // 4. classify every remaining valid-but-unchained op with a precise reason. Priority mirrors assembleChain:
  //    missing genesis → wrong mini-log → genesis-slot rules → NOT-attacker (single-writer) → reveal-without-
  //    prior-commit → duplicate commit → gap → chain break → fork.
  const heightSeq = chain.length;
  const chainHashAt = chain.map((op) => op.hash);
  for (const op of validByHash.values()) {
    if (chosen.has(op.hash)) continue;
    let reason;
    if (attacker === null) reason = 'no_genesis';
    else if (op.mini_log_id !== miniLogId) reason = 'wrong_mini_log';
    else if (op.seq === 0) reason = op.type === 'settlement_commit' ? 'fork_detected' : 'not_commit_at_zero';
    else if (op.actor !== attacker) reason = 'not_attacker';                 // single-writer of own mini-log
    else if (op.type === 'settlement_commit') reason = 'duplicate_commit';   // at most one commit per mini-log
    else if (op.seq > heightSeq) reason = 'seq_gap';
    else if (op.prev !== chainHashAt[op.seq - 1]) reason = 'chain_break';
    else reason = 'no_prior_commit'; // right slot+prev but no commit was chosen at a lower seq
    rejected.push({ ref: op.hash, reason });
  }
  return { chain, attacker, mini_log_id: miniLogId, rejected };
}

/**
 * PURE: fold a mini-log op set into mini-log state. Returns the head hash, seq height, the applied
 * settlement (if a reveal folded), the attacker, and rejected ops. Excludes nothing economic — the mini-log
 * applies no scorch itself (that is the overlay's job over base state); it produces the head ENTRY for the
 * overlay. Convergent: any reorder/dup of the same op set folds to the same fingerprint.
 */
export function foldMiniLog(ops) {
  const { chain, attacker, mini_log_id, rejected } = assembleMiniChain(ops);
  const state = {
    mini_log_id: mini_log_id || null,
    attacker: attacker || null,
    mini_log_head: null,
    seq_height: 0,
    commit: null,
    reveal: null,
    applied: [],
    rejected,
  };
  if (!chain.length) return state;
  for (const op of chain) {
    state.seq_height = op.seq;
    state.mini_log_head = op.hash;
    if (op.type === 'settlement_commit') {
      // record the binding commitment (the first/only commit; assembleMiniChain rejects extras upstream)
      if (!state.commit) {
        state.commit = {
          seq: op.seq, base_address: op.payload.base_address,
          plan_hash: op.payload.plan_hash, seed_commit: op.payload.seed_commit,
          beacon_height: op.payload.beacon_height,
        };
      }
      state.applied.push(op.hash);
    } else { // settlement_reveal (assembleMiniChain guarantees a prior commit exists)
      state.reveal = {
        seq: op.seq, ref: op.hash,
        base_address: op.payload.base_address, plan_hash: op.payload.plan_hash,
        seed_commit: op.payload.seed_commit, seed_reveal: op.payload.seed_reveal,
        beacon: op.payload.beacon, beacon_height: op.payload.beacon_height,
        scorch: op.payload.scorch, outcome_digest: op.payload.outcome_digest,
      };
      state.applied.push(op.hash);
    }
  }
  return state;
}

/**
 * PURE: deterministic fingerprint of a folded mini-log state — the per-author convergence oracle. Excludes
 * volatile bookkeeping (applied/rejected lists); includes the head + the reveal's outcome so divergent
 * histories never collide. Two peers with the same mini-log op set get the same fingerprint.
 */
export function miniLogFingerprint(state) {
  const r = state.reveal;
  return [
    `mini=${state.mini_log_id || '-'}`,
    `atk=${state.attacker || '-'}`,
    `head=${state.mini_log_head || '-'}`,
    `h=${state.seq_height}`,
    `commit=${state.commit ? state.commit.seed_commit : '-'}`,
    `reveal=${r ? `${r.ref}@${r.outcome_digest}` : '-'}`,
  ].join(';');
}

export { assembleMiniChain };
