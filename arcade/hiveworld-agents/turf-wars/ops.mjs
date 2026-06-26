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
 * block by construction. `record_attack_result` is RESERVED for Phase 2 and the fold rejects it — the
 * schema reserves the name without implementing combat settlement.
 *
 * Each op carries: v, block_id, prev (content-address of the previous op | null at genesis), seq,
 * tick (logical clock), actor (raw Ed25519 pubkey hex), type, payload, hash (content-address of the
 * signable core), sig (Ed25519 over the hash). `verifyOp` re-derives the hash from the core (integrity)
 * and verifies the signature against the actor key (origin) — a tampered payload OR a tampered hash OR
 * a wrong/forged signature all fail.
 */
import { contentAddress, isContentAddress } from './canonical.mjs';
import { signBytes, verifyBytes, PLAYER_ID_RE } from './identity.mjs';

export const OP_VERSION = 1;

/** Phase-1 accepted op vocabulary. Nothing else folds. */
export const OP_TYPES = Object.freeze([
  'init_block', 'build_structure', 'upgrade_structure', 'collect_resource',
  'publish_base_snapshot', 'join_crew',
]);

/** Reserved for later phases — the fold REJECTS these with `reserved_for_phase2` (schema reservation
 * only; combat settlement is NOT implemented in Phase 1). */
export const RESERVED_OP_TYPES = Object.freeze(['record_attack_result']);

/** Closed structure model. Each kind has a deterministic build cost, production, and max level — no
 * free-form fields. `produces` is per-collect output BEFORE the per-level multiplier. */
export const STRUCTURE_SPEC = Object.freeze({
  resource_node: { build: { flux: 0, cores: 5 }, produces: { flux: 10 }, maxLevel: 5 },
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
      if (v.length > 64) return 'string_too_long';
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
  if (!op || typeof op !== 'object') return 'malformed_op';
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
