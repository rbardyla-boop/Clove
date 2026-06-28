/**
 * Turf Wars — Phase 1 lab substrate · CLOSED OP + STRUCTURE VOCABULARY (pure, deterministic).
 *
 * ⚠️ LAB ONLY — see canonical.mjs header. No production exposure / economy / publishing.
 *
 * Everything a block can ever express is a CLOSED enum. There is no free text, no URL, no image, no
 * uploaded asset, and no code field anywhere in the op space — a strict per-type payload schema only
 * admits the exact keys with the exact primitive/enum/int types, and a defense-in-depth scan rejects
 * any string that smells like a URL or a code/markup field name. There is NO transfer / trade / sell /
 * cash-out op: those are not "guarded", they are ABSENT from the grammar, so value cannot leave a
 * block by construction. `record_attack_result` is, as of the Phase-2 foundation, a STRUCTURALLY
 * VALIDATED op (closed schema + signature) whose SETTLEMENT is DEFERRED: the fold records it as
 * settlement-deferred rather than applying it, because live settlement depends on Phase-2 O1 (the
 * settlement seed / commit-reveal) and O2 (fraud-proof liveness vs. an offline victim) — both still
 * open. It still carries no transfer/cash semantics; an attack yields cosmetic, reversible scorch only.
 *
 * Each op carries: v, block_id, prev (content-address of the previous op | null at genesis), seq,
 * tick (logical clock), actor (raw Ed25519 pubkey hex), type, payload, hash (content-address of the
 * signable core), sig (Ed25519 over the hash). `verifyOp` re-derives the hash from the core (integrity)
 * and verifies the signature against the actor key (origin) — a tampered payload OR a tampered hash OR
 * a wrong/forged signature all fail.
 */
import { contentAddress, isContentAddress } from './canonical.mjs';
import { signBytes, verifyBytes, PLAYER_ID_RE } from './identity.mjs';
import { SCORCH_CAP } from './scorch.mjs';

export const OP_VERSION = 1;

/**
 * The CLOSED top-level op envelope. An op record may carry EXACTLY these keys — `verifyOp` rejects any
 * op with an unknown top-level key (`unknown_op_key`) BEFORE signature verification, so an extra field
 * can never ride along on a "valid" op. This matters because `opCore` (and therefore the hash and
 * signature) only commit to the 8 signable keys; without this guard an extra unsigned top-level field
 * would be inert in the Phase-1 fold but could be picked up unverified by a future consumer that reads
 * the raw op object (e.g. a Phase-3 gossip/availability layer). Fail closed now, not later.
 */
export const OP_ENVELOPE_KEYS = Object.freeze([
  'v', 'block_id', 'prev', 'seq', 'tick', 'actor', 'type', 'payload', 'hash', 'sig',
]);
const ENVELOPE_KEY_SET = new Set(OP_ENVELOPE_KEYS);

/** Accepted op vocabulary. `record_attack_result` (Phase-2 foundation) is structurally valid but
 * settlement-deferred in the fold; everything else folds normally. Nothing outside this list folds. */
export const OP_TYPES = Object.freeze([
  'init_block', 'build_structure', 'upgrade_structure', 'collect_resource',
  'publish_base_snapshot', 'join_crew', 'record_attack_result', 'attack_commit', 'settle_attack',
]);

/** Reserved for later phases — the fold REJECTS these with `reserved_for_phase2` (schema reservation
 * only). Empty since the Phase-2 foundation promoted `record_attack_result` to a structurally-validated,
 * settlement-deferred op; the mechanism stays for any genuinely-future reserved op type. */
export const RESERVED_OP_TYPES = Object.freeze([]);

/** Closed structure model. Each kind has a deterministic build cost, production, and max level — no
 * free-form fields. `produces` is per-collect output BEFORE the per-level multiplier. */
export const STRUCTURE_SPEC = Object.freeze({
  // resource_node caps at level 3 so its ceiling is REACHABLE within the starter grant (build 5 cores +
  // upgrade 5 + upgrade 10 = exactly 20 starter cores). A reachable cap is an enforceable, testable cap;
  // the other kinds' core costs exceed the starter grant before level 5, so their ceilings stay latent.
  resource_node: { build: { flux: 0, cores: 5 }, produces: { flux: 10 }, maxLevel: 3 },
  signage: { build: { flux: 8, cores: 2 }, produces: {}, maxLevel: 5 },
  light_rig: { build: { flux: 12, cores: 4 }, produces: {}, maxLevel: 5 },
  crowd_beacon: { build: { flux: 20, cores: 8 }, produces: {}, maxLevel: 5 },
  defense_decoy: { build: { flux: 15, cores: 6 }, produces: {}, maxLevel: 5 },
});
export const STRUCTURE_KINDS = Object.freeze(Object.keys(STRUCTURE_SPEC));

/** Closed cosmetic theme set for a block (replaces any free-text "name"). */
export const BLOCK_THEMES = Object.freeze(['neon', 'noir', 'sunrise', 'toxic', 'chrome']);

/** Non-cash counters. Both are bounded, non-transferable, never cashable. */
export const COUNTERS = Object.freeze(['flux', 'cores']);

// ── bounds (small on purpose; non-cash) ──────────────────────────────────────
export const STARTER_GRANT = Object.freeze({ flux: 40, cores: 20 }); // minted once, at init_block
export const FLUX_MINT_CAP = 500;   // cumulative flux a block can ever collect (mint ceiling)
export const GRID = Object.freeze({ min: 0, max: 15 }); // structure position bounds
export const MAX_STRUCTURES = 32;   // a block cannot grow unbounded

// ── id shapes (closed) ───────────────────────────────────────────────────────
export const BLOCK_ID_RE = /^block:[0-9a-f]{16}$/;
export const STRUCTURE_ID_RE = /^s:[0-9a-f]{8}$/;
export const CREW_ID_RE = /^crew:[0-9a-f]{12}$/;

const isInt = (v) => Number.isInteger(v);
const inGrid = (v) => isInt(v) && v >= GRID.min && v <= GRID.max;

/**
 * PURE: deterministic deep scan for forbidden content — URLs, data URIs, code/markup field names, and
 * over-long strings. Defense-in-depth UNDER the strict per-type schema (which already only admits known
 * keys). Returns null if clean, or a reason string for the first violation.
 */
export function scanForbidden(value) {
  const FORBIDDEN_KEY = /^(url|href|src|script|js|code|html|img|image|eval|fn|onload|onclick|style|link|embed|iframe)$/i;
  const URLISH = /(https?:\/\/|data:|javascript:|<\/?[a-z]|on\w+\s*=)/i;
  const walk = (v, depth) => {
    if (depth > 6) return 'too_deep';
    if (typeof v === 'string') {
      // Cap free-text length, but allow long HEX / content-address strings — the closed schema already
      // pins those fields (e.g. `sha256:<64hex>` content addresses = 71 chars, Ed25519 sigs = 128 hex),
      // and a hex/content-address string carries no free text. Long NON-hex strings are still rejected.
      if (v.length > 64 && !/^(sha256:)?[0-9a-f]+$/.test(v)) return 'string_too_long';
      if (URLISH.test(v)) return 'url_or_markup';
      return null;
    }
    if (typeof v === 'number' || typeof v === 'boolean' || v === null) return null;
    if (Array.isArray(v)) {
      for (const x of v) { const r = walk(x, depth + 1); if (r) return r; }
      return null;
    }
    if (typeof v === 'object') {
      for (const k of Object.keys(v)) {
        if (FORBIDDEN_KEY.test(k)) return `forbidden_key:${k}`;
        if (k.length > 32) return 'key_too_long';
        const r = walk(v[k], depth + 1); if (r) return r;
      }
      return null;
    }
    return 'bad_type'; // functions, symbols, undefined
  };
  return walk(value, 0);
}

/**
 * PURE: strict per-type payload schema. Returns null if the payload is EXACTLY shaped for `type`, else
 * a reason. Only the enumerated keys are allowed; an unknown extra key is rejected.
 */
export function validatePayload(type, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'payload_not_object';
  const keys = Object.keys(payload);
  const only = (allowed) => keys.every((k) => allowed.includes(k)) && allowed.every((k) => keys.includes(k));
  switch (type) {
    case 'init_block':
      if (!only(['theme'])) return 'init_block_shape';
      if (!BLOCK_THEMES.includes(payload.theme)) return 'bad_theme';
      return null;
    case 'build_structure':
      if (!only(['structure_id', 'kind', 'x', 'y'])) return 'build_structure_shape';
      if (!STRUCTURE_ID_RE.test(payload.structure_id)) return 'bad_structure_id';
      if (!STRUCTURE_KINDS.includes(payload.kind)) return 'bad_structure_kind';
      if (!inGrid(payload.x) || !inGrid(payload.y)) return 'off_grid';
      return null;
    case 'upgrade_structure':
      if (!only(['structure_id'])) return 'upgrade_structure_shape';
      if (!STRUCTURE_ID_RE.test(payload.structure_id)) return 'bad_structure_id';
      return null;
    case 'collect_resource':
      if (!only(['structure_id'])) return 'collect_resource_shape';
      if (!STRUCTURE_ID_RE.test(payload.structure_id)) return 'bad_structure_id';
      return null;
    case 'publish_base_snapshot':
      if (!only(['snapshot_address', 'snapshot_sig'])) return 'publish_shape';
      if (!isContentAddress(payload.snapshot_address)) return 'bad_snapshot_address';
      if (typeof payload.snapshot_sig !== 'string' || !/^[0-9a-f]{128}$/.test(payload.snapshot_sig)) return 'bad_snapshot_sig';
      return null;
    case 'join_crew':
      if (!only(['crew_id'])) return 'join_crew_shape';
      if (!CREW_ID_RE.test(payload.crew_id)) return 'bad_crew_id';
      return null;
    case 'record_attack_result':
      // Phase-2 foundation: closed schema only. References to the three public attack inputs (the
      // defender's base snapshot, the attacker's plan, the settlement seed) plus the claimed outcome
      // digest. Structurally validated here; the FOLD defers settlement (see block-log.mjs). The seed
      // FORMAT is fixed (closed hex token); its provenance/binding is O1, deferred.
      if (!only(['base_address', 'plan_hash', 'seed', 'outcome_digest'])) return 'record_attack_result_shape';
      if (!isContentAddress(payload.base_address)) return 'bad_base_address';
      if (!isContentAddress(payload.plan_hash)) return 'bad_plan_hash';
      if (!isContentAddress(payload.outcome_digest)) return 'bad_outcome_digest';
      if (typeof payload.seed !== 'string' || !/^[0-9a-f]{16,64}$/.test(payload.seed)) return 'bad_seed';
      return null;
    case 'attack_commit':
      // Phase-2 SETTLEMENT (O1): the attacker's BINDING COMMITMENT, folded at an EARLIER seq than the
      // settle_attack that reveals it. It carries seed_commit = sha256(attacker_seed) but NO reveal and
      // NO beacon — so the attacker is locked to one seed BEFORE the post-commit beacon is known. The fold
      // (block-log.mjs) records it; a settle_attack with no matching prior attack_commit fails to fold.
      if (!only(['base_address', 'plan_hash', 'seed_commit'])) return 'attack_commit_shape';
      if (!isContentAddress(payload.base_address)) return 'bad_base_address';
      if (!isContentAddress(payload.plan_hash)) return 'bad_plan_hash';
      if (typeof payload.seed_commit !== 'string' || !/^[0-9a-f]{64}$/.test(payload.seed_commit)) return 'bad_seed_commit';
      return null;
    case 'settle_attack': {
      // Phase-2 SETTLEMENT (O1/O2): the optimistic, fold-applied settlement op. Closed schema only —
      // the public attack inputs (base snapshot + plan), the commit-reveal seed (seed_commit/seed_reveal),
      // the post-commit beacon (O1), a BOUNDED cosmetic scorch map, and the claimed outcome digest. The
      // fold verifies commit↔reveal and applies the bounded scorch; correctness-vs-recompute is the
      // delegable fraud-proof's job (settlement.mjs). No transfer/cash field exists; scorch is the only
      // effect, bounded to [0, SCORCH_CAP] integers over existing structures only.
      if (!only(['base_address', 'plan_hash', 'seed_commit', 'seed_reveal', 'beacon', 'scorch', 'outcome_digest'])) return 'settle_attack_shape';
      if (!isContentAddress(payload.base_address)) return 'bad_base_address';
      if (!isContentAddress(payload.plan_hash)) return 'bad_plan_hash';
      if (!isContentAddress(payload.outcome_digest)) return 'bad_outcome_digest';
      if (typeof payload.seed_commit !== 'string' || !/^[0-9a-f]{64}$/.test(payload.seed_commit)) return 'bad_seed_commit';
      if (typeof payload.seed_reveal !== 'string' || !/^[0-9a-f]{16,64}$/.test(payload.seed_reveal)) return 'bad_seed_reveal';
      if (typeof payload.beacon !== 'string' || !/^[0-9a-f]{16,64}$/.test(payload.beacon)) return 'bad_beacon';
      const sc = payload.scorch;
      if (!sc || typeof sc !== 'object' || Array.isArray(sc)) return 'bad_scorch';
      const sk = Object.keys(sc);
      if (sk.length > MAX_STRUCTURES) return 'scorch_too_many';
      for (const k of sk) {
        if (!STRUCTURE_ID_RE.test(k)) return 'bad_scorch_key';
        const val = sc[k];
        if (!isInt(val) || val < 0 || val > SCORCH_CAP) return 'bad_scorch_value';
      }
      return null;
    }
    default:
      return 'unknown_op';
  }
}

/** PURE: the signable core of an op (everything the hash and signature commit to). */
export function opCore({ block_id, prev, seq, tick, actor, type, payload }) {
  return { v: OP_VERSION, block_id, prev, seq, tick, actor, type, payload };
}

/** PURE: the content-address hash of an op's core. */
export function hashOp(core) {
  return contentAddress(core);
}

/**
 * Build a fully-signed op from an identity. The hash is derived from the core and the signature is
 * Ed25519 over the hash string. Does NOT validate economic legality (that is the fold's job) but DOES
 * stamp a structurally-correct, signed record.
 */
export function makeOp(identity, { block_id, prev = null, seq, tick, type, payload }) {
  const core = opCore({ block_id, prev, seq, tick, actor: identity.publicRawHex, type, payload });
  const hash = hashOp(core);
  const sig = signBytes(identity.privateKey, hash);
  return { ...core, hash, sig };
}

/**
 * PURE: cryptographic + structural verification of a single op, independent of any chain context.
 * Returns null if the op is well-formed, hash-consistent, and correctly signed by `actor`; else a
 * reason. This is ORIGIN + INTEGRITY only — economic/authority legality is enforced by the fold.
 */
export function verifyOp(op) {
  if (!op || typeof op !== 'object' || Array.isArray(op)) return 'malformed_op';
  // fail-closed envelope: reject any unknown top-level key BEFORE verification (missing/malformed
  // known keys are still caught by the per-field checks below, preserving their specific reasons).
  for (const k of Object.keys(op)) if (!ENVELOPE_KEY_SET.has(k)) return 'unknown_op_key';
  if (op.v !== OP_VERSION) return 'bad_version';
  if (!BLOCK_ID_RE.test(op.block_id || '')) return 'bad_block_id';
  if (!(op.prev === null || isContentAddress(op.prev))) return 'bad_prev';
  if (!isInt(op.seq) || op.seq < 0) return 'bad_seq';
  if (!isInt(op.tick) || op.tick < 0) return 'bad_tick';
  if (typeof op.actor !== 'string' || !/^[0-9a-f]{64}$/.test(op.actor)) return 'bad_actor';
  if (RESERVED_OP_TYPES.includes(op.type)) return 'reserved_for_phase2';
  if (!OP_TYPES.includes(op.type)) return 'unknown_op';
  const shape = validatePayload(op.type, op.payload);
  if (shape) return shape;
  const dirty = scanForbidden(op.payload);
  if (dirty) return `forbidden_content:${dirty}`;
  // integrity: the hash must be exactly the content-address of the reconstructed core
  const core = opCore(op);
  if (hashOp(core) !== op.hash) return 'hash_mismatch';
  // origin: the signature must verify against the actor's public key over the hash
  if (!verifyBytes(op.actor, op.hash, op.sig)) return 'bad_signature';
  return null;
}

// Re-export for callers that want the player-id regex without importing identity directly.
export { PLAYER_ID_RE };
