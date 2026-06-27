/**
 * Turf Wars — Phase 1 lab substrate · SIGNED HASH-CHAINED OP LOG + DETERMINISTIC FOLD (pure).
 *
 * ⚠️ LAB ONLY — see canonical.mjs header. No production exposure / economy / publishing / combat.
 *
 * This is the substrate's heart: a per-block, append-only log of SIGNED ops, hash-chained for tamper
 * evidence, folded into block state by a PURE deterministic function. Authority = REPLAY of this log,
 * not a server. Two honest peers that hold the same op set fold to the SAME state fingerprint
 * regardless of delivery order — that is what makes "no central server" tractable.
 *
 * Two layers, cleanly separated so the fold is deterministic AND convergent:
 *   1. CHAIN MEMBERSHIP (cryptographic + authority): an op joins the canonical chain iff it is
 *      well-formed + correctly signed (verifyOp), occupies the next seq, references the previous
 *      accepted op's hash via `prev`, targets this block, and (for seq>0) is signed by the block
 *      OWNER. Membership is a pure function of the op SET — independent of evaluation order — so a
 *      shuffled or duplicated delivery yields the same chain. Forks (two eligible ops at one seq) are
 *      resolved by lowest op-hash; the loser is rejected `fork_detected`. Gaps/breaks are rejected.
 *   2. ECONOMIC EFFECT (rule enforcement): chain ops are then applied IN SEQ ORDER. A chain op either
 *      APPLIES (mutates counters/structures within bounds) or is ECON-REJECTED (recorded, no mutation)
 *      — but it still occupies its seq. Bounds are enforced here: no negative balance, capped flux
 *      mint, one collect per (structure,tick), max levels, max structures. There is NO transfer op, so
 *      value cannot leave a block by construction.
 *
 * Single-writer in Phase 1: the block owner is the only writer; foreign-signed ops are `not_owner`
 * and never join the chain. Multi-writer crew gossip is a later phase (availability fabric).
 */
import { verifyOp, STRUCTURE_SPEC, STARTER_GRANT, FLUX_MINT_CAP, MAX_STRUCTURES } from './ops.mjs';
import { verifyBytes, playerIdFromPublicRawHex } from './identity.mjs';

/** PURE: deterministic upgrade cost for a structure currently at `level` (>=1). */
export function upgradeCost(kind, level) {
  const base = STRUCTURE_SPEC[kind].build;
  return { flux: base.flux * level, cores: base.cores * level };
}

/** PURE: per-collect flux yield for a resource_node at `level`. */
export function collectYield(kind, level) {
  const p = STRUCTURE_SPEC[kind].produces;
  return p.flux ? p.flux * level : 0;
}

// ── chain assembly (layer 1: membership) ─────────────────────────────────────
/**
 * PURE: assemble the canonical hash chain from a set of ops. Returns { chain, owner, block_id,
 * rejected } where `chain` is the ordered list of chain-included ops (seq 0..H) and `rejected` lists
 * crypto/authority/structure rejections with reasons. Convergent: depends only on the op set.
 */
function assembleChain(ops) {
  const rejected = [];
  const refOf = (op) => (op && op.hash) || '?';
  // 1. cryptographic + structural validity (origin + integrity), dedup replays by op-hash
  const validByHash = new Map();
  for (const op of Array.isArray(ops) ? ops : []) {
    const reason = verifyOp(op);
    if (reason) { rejected.push({ ref: refOf(op), reason }); continue; }
    if (!validByHash.has(op.hash)) validByHash.set(op.hash, op); // duplicate delivery → no-op
  }
  // 2. index valid ops by seq
  const bySeq = new Map();
  for (const op of validByHash.values()) {
    if (!bySeq.has(op.seq)) bySeq.set(op.seq, []);
    bySeq.get(op.seq).push(op);
  }
  // 3. walk seq upward, choosing the lowest-hash eligible op at each level
  const chain = [];
  const chosen = new Set();
  let head = null; // expected prev hash for the next op
  let owner = null;
  let blockId = null;
  for (let seq = 0; bySeq.has(seq); seq++) {
    const candidates = bySeq.get(seq);
    const connects = (op) => seq === 0
      ? (op.type === 'init_block' && op.prev === null)
      : (op.prev === head && op.block_id === blockId && op.actor === owner && op.type !== 'init_block');
    const eligible = candidates.filter(connects).sort((a, b) => a.hash.localeCompare(b.hash));
    if (eligible.length === 0) break; // gap / no authorized op at this seq — chain stops here
    const pick = eligible[0];
    chain.push(pick);
    chosen.add(pick.hash);
    if (seq === 0) { owner = pick.actor; blockId = pick.block_id; }
    head = pick.hash;
    // eligible-but-lost candidates at this seq are genuine forks
    for (const sib of eligible.slice(1)) { rejected.push({ ref: sib.hash, reason: 'fork_detected' }); chosen.add(sib.hash); }
  }
  // 4. classify every remaining valid-but-unchained op with a precise reason. Priority: missing
  //    genesis → wrong block → genesis-slot rules → authority → gap (seq beyond head) → chain break
  //    (wrong prev at the next/earlier seq) → fork (right prev, lost the hash tiebreak).
  const heightSeq = chain.length; // first absent seq (= chain length, since seqs are 0..height-1)
  const chainHashAt = chain.map((op) => op.hash); // index === seq
  for (const op of validByHash.values()) {
    if (chosen.has(op.hash)) continue;
    let reason;
    if (owner === null) reason = 'no_genesis';
    else if (op.block_id !== blockId) reason = 'wrong_block';
    else if (op.seq === 0) reason = op.type === 'init_block' ? 'fork_detected' : 'not_init_at_zero';
    else if (op.type === 'init_block') reason = 'duplicate_genesis';
    else if (op.actor !== owner) reason = 'not_owner';
    else if (op.seq > heightSeq) reason = 'seq_gap';            // beyond the head — an earlier seq is missing
    else reason = op.prev !== chainHashAt[op.seq - 1] ? 'chain_break' : 'fork_detected'; // seq 1..height
    rejected.push({ ref: op.hash, reason });
  }
  return { chain, owner, block_id: blockId, rejected };
}

// ── economic application (layer 2: effect) ───────────────────────────────────
const emptyState = () => ({
  block_id: null, owner: null, owner_player_id: null, theme: null,
  counters: { flux: 0, cores: 0 },
  minted: { flux: 0, cores: 0 },
  structures: {}, occupied: {}, collected_at: {},
  crew: null, published_snapshot: null,
  seq_height: 0, chain_head: null,
  applied: [], econ_rejected: [], rejected: [],
});

/**
 * PURE: fold an op set into block state. Canonical, convergent, bounds-enforced. Returns the full
 * state including `applied` (hashes that took effect), `econ_rejected` (chain ops that broke a rule),
 * and `rejected` (crypto/authority/structure rejections).
 */
export function foldBlock(ops) {
  const { chain, owner, block_id, rejected } = assembleChain(ops);
  const s = emptyState();
  s.rejected = rejected;
  if (!chain.length) return s;

  const econReject = (op, reason) => s.econ_rejected.push({ ref: op.hash, reason });
  const cell = (x, y) => `${x},${y}`;

  for (const op of chain) {
    s.seq_height = op.seq;
    s.chain_head = op.hash;
    const p = op.payload;
    switch (op.type) {
      case 'init_block': {
        s.block_id = block_id;
        s.owner = owner;
        s.owner_player_id = playerIdFromPublicRawHex(owner);
        s.theme = p.theme;
        s.counters = { flux: STARTER_GRANT.flux, cores: STARTER_GRANT.cores };
        s.minted = { flux: 0, cores: STARTER_GRANT.cores }; // cores are minted once at init and never again
        s.applied.push(op.hash);
        break;
      }
      case 'build_structure': {
        if (Object.keys(s.structures).length >= MAX_STRUCTURES) { econReject(op, 'max_structures'); break; }
        if (s.structures[p.structure_id]) { econReject(op, 'dup_structure_id'); break; }
        if (s.occupied[cell(p.x, p.y)]) { econReject(op, 'cell_occupied'); break; }
        const cost = STRUCTURE_SPEC[p.kind].build;
        if (s.counters.flux < cost.flux) { econReject(op, 'insufficient_flux'); break; }
        if (s.counters.cores < cost.cores) { econReject(op, 'insufficient_cores'); break; }
        s.counters.flux -= cost.flux;
        s.counters.cores -= cost.cores;
        s.structures[p.structure_id] = { kind: p.kind, level: 1, x: p.x, y: p.y };
        s.occupied[cell(p.x, p.y)] = p.structure_id;
        s.applied.push(op.hash);
        break;
      }
      case 'upgrade_structure': {
        const st = s.structures[p.structure_id];
        if (!st) { econReject(op, 'no_such_structure'); break; }
        if (st.level >= STRUCTURE_SPEC[st.kind].maxLevel) { econReject(op, 'max_level'); break; }
        const cost = upgradeCost(st.kind, st.level);
        if (s.counters.flux < cost.flux) { econReject(op, 'insufficient_flux'); break; }
        if (s.counters.cores < cost.cores) { econReject(op, 'insufficient_cores'); break; }
        s.counters.flux -= cost.flux;
        s.counters.cores -= cost.cores;
        st.level += 1;
        s.applied.push(op.hash);
        break;
      }
      case 'collect_resource': {
        const st = s.structures[p.structure_id];
        if (!st) { econReject(op, 'no_such_structure'); break; }
        const yld = collectYield(st.kind, st.level);
        if (yld <= 0) { econReject(op, 'not_collectable'); break; }
        if (s.collected_at[p.structure_id] === op.tick) { econReject(op, 'collect_cooldown'); break; }
        const remaining = FLUX_MINT_CAP - s.minted.flux;
        if (remaining <= 0) { econReject(op, 'flux_cap_reached'); break; }
        const grant = Math.min(yld, remaining); // clamp to the mint cap (deterministic)
        s.counters.flux += grant;
        s.minted.flux += grant;
        s.collected_at[p.structure_id] = op.tick;
        s.applied.push(op.hash);
        break;
      }
      case 'publish_base_snapshot': {
        // the owner must have signed the snapshot pointer (the address) — origin of the published base
        if (!verifyBytes(owner, p.snapshot_address, p.snapshot_sig)) { econReject(op, 'bad_snapshot_signature'); break; }
        s.published_snapshot = p.snapshot_address;
        s.applied.push(op.hash);
        break;
      }
      case 'join_crew': {
        s.crew = p.crew_id;
        s.applied.push(op.hash);
        break;
      }
      default:
        econReject(op, 'unreachable_unknown_op'); // verifyOp already excludes this
    }
  }
  return s;
}

/**
 * PURE: deterministic fingerprint of folded block state — the convergence primitive. Two peers AGREE
 * iff their fingerprints match. Excludes volatile bookkeeping (applied/rejected lists); includes the
 * chain head so divergent histories never collide.
 */
export function blockFingerprint(s) {
  const structs = Object.keys(s.structures).sort()
    .map((id) => `${id}:${s.structures[id].kind}@${s.structures[id].x},${s.structures[id].y}=L${s.structures[id].level}`);
  return [
    `block=${s.block_id || '-'}`,
    `owner=${s.owner_player_id || '-'}`,
    `theme=${s.theme || '-'}`,
    `flux=${s.counters.flux}`,
    `cores=${s.counters.cores}`,
    `minted_flux=${s.minted.flux}`,
    `crew=${s.crew || '-'}`,
    `snap=${s.published_snapshot || '-'}`,
    `head=${s.chain_head || '-'}`,
    `h=${s.seq_height}`,
    `struct=[${structs.join('|')}]`,
  ].join(';');
}

/** PURE: bounds-invariant self-check — no negative balance, flux mint within cap, cores never re-minted. */
export function boundsHold(s) {
  return s.counters.flux >= 0 && s.counters.cores >= 0
    && s.minted.flux >= 0 && s.minted.flux <= FLUX_MINT_CAP
    && s.minted.cores === (s.owner ? STARTER_GRANT.cores : 0)
    && Object.keys(s.structures).length <= MAX_STRUCTURES;
}

export { assembleChain };
