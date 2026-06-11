/**
 * HiveWorld Agents — W-6 LAB attention-ledger STRESS + ADVERSARIAL suite (pure, deterministic).
 *
 * ⚠️ SIMULATOR ONLY — denylisted from the curated upload and imported by nothing production-
 * facing. This is the scaled second rung of the W-6 evidence ladder: where attention-evidence
 * .mjs proves the C1–C10 claims on one mid-size scenario, this module proves the SAME fold
 * holds under (a) much larger seeded scenarios, (b) hostile delivery (rejected-event floods,
 * identity-less malformed floods, interleaved duplicate storms), and (c) multiple independent
 * seeds — then emits a stable REPLAY ARTIFACT for the operator surface (docs/lab/).
 *
 * Stress claims (S — each must hold for a pack to PASS):
 *   S1 scale replay determinism     same events → same fingerprint, at stress scale
 *   S2 scale reorder convergence    K shuffles → same fingerprint
 *   S3 rejected-flood convergence   re-delivering REJECTED events N× changes nothing
 *                                   (the C3-class defect this lab found and fixed, kept pinned)
 *   S4 malformed-flood collapse     identity-less malformed events collapse to ONE '?' entry
 *   S5 conservation at scale        grants fully account for every attention level
 *   S6 adversarial completeness     every injected attack is rejected with its pinned reason
 *   S7 mixed-storm stability        shuffle + dup-valid + dup-rejected + malformed → same
 *                                   agent fingerprint, audit growth bounded to the one '?' entry
 *   S8 surfacing rollup discipline  block rollup counts BOUND CABINETS only (rooms/unbound never)
 *
 * Determinism: seeded LCG only — no Date.now, no Math.random. Same seed → same pack, byte for byte.
 * Evidence scope: fold-level safety ONLY (production wiring, scale abuse economics, and legal
 * posture remain W-7/W-8 gates).
 */

import {
  foldAttention, attentionFingerprint, attentionConserved, blockSurfacing,
} from './attention-ledger.mjs';
import { buildScenario } from './attention-evidence.mjs';

/** Tiny deterministic PRNG (mulberry32) — same generator the evidence pack uses. */
function lcg(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffled = (arr, rnd) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Default stress scale — an order of magnitude over the evidence pack. */
export const STRESS_DEFAULTS = Object.freeze({
  rooms: 6, cabinets: 24, rounds: 2000, shuffles: 12, rejectedFlood: 200, malformedFlood: 150,
});

/** PURE: agents-only fingerprint (ignores the audit log; used to isolate S7's growth bound). */
export function agentFingerprint(state) {
  return Object.keys(state.agents).sort().map((id) => `${id}=${state.agents[id].attention_level}`).join(',');
}

/**
 * PURE: one seeded stress pack. Builds the scaled scenario via the SAME generator as the
 * evidence pack (attacks included + pinned), then drives the hostile-delivery claims.
 */
export function buildStressPack({ seed = 42, ...scale } = {}) {
  const p = { ...STRESS_DEFAULTS, ...scale };
  const rnd = lcg(seed ^ 0x51f15eed);
  const { events, expects, roomIds, cabIds } = buildScenario({ seed, rooms: p.rooms, cabinets: p.cabinets, rounds: p.rounds });
  const base = foldAttention(events);
  const fp = attentionFingerprint(base);
  const claims = [];
  const claim = (id, ok, detail) => claims.push({ id, ok: !!ok, detail });

  // S1 scale replay determinism
  claim('S1_scale_replay_deterministic', attentionFingerprint(foldAttention(events)) === fp, `fingerprint ${fp.slice(0, 40)}… @ ${events.length} events`);

  // S2 scale reorder convergence
  let reorderOk = true;
  for (let k = 0; k < p.shuffles; k++) {
    if (attentionFingerprint(foldAttention(shuffled(events, rnd))) !== fp) { reorderOk = false; break; }
  }
  claim('S2_scale_reorder_convergent', reorderOk, `${p.shuffles} shuffles @ ${p.rounds} rounds`);

  // S3 rejected-flood convergence — re-deliver ONLY already-rejected events, many times
  const rejectedEvents = events.filter((e) => base.rejected.some((r) => r.event_id === e.event_id));
  const flood = [];
  for (let i = 0; i < p.rejectedFlood; i++) flood.push(rejectedEvents[Math.floor(rnd() * rejectedEvents.length)]);
  const s3 = foldAttention([...events, ...flood]);
  claim('S3_rejected_flood_convergent',
    attentionFingerprint(s3) === fp && s3.rejected.length === base.rejected.length,
    `${p.rejectedFlood} re-deliveries of ${rejectedEvents.length} rejected events → audit log unchanged (${base.rejected.length})`);

  // S4 malformed-flood collapse — identity-less garbage collapses to ONE '?' rejection
  const malformed = [];
  for (let i = 0; i < p.malformedFlood; i++) {
    // strictly IDENTITY-LESS shapes (event_id null/undefined) — they all collapse to the one '?' entry;
    // an id that merely fails validation (e.g. a number) keeps its own dedup identity and is covered
    // by the unit tests instead.
    malformed.push([null, 42, 'junk', {}, { kind: 'attention_granted' }, { seq: 3 }][Math.floor(rnd() * 6)]);
  }
  const s4 = foldAttention([...events, ...malformed]);
  const s4Unknowns = s4.rejected.filter((r) => r.event_id === '?');
  claim('S4_malformed_flood_collapses',
    agentFingerprint(s4) === agentFingerprint(base) && s4Unknowns.length === 1 && s4Unknowns[0].reason === 'malformed_event',
    `${p.malformedFlood} identity-less events → 1 '?' audit entry, agent state untouched`);

  // S5 conservation at scale
  claim('S5_conserved_at_scale', attentionConserved(base), `granted_total ${base.granted_total} across ${Object.keys(base.agents).length} agents`);

  // S6 adversarial completeness — every pinned attack rejected with its pinned reason
  const rejectedById = new Map(base.rejected.map((r) => [r.event_id, r.reason]));
  const misses = expects.filter((x) => {
    const got = rejectedById.get(x.event_id);
    if (x.reason === 'route_out_of_bounds_or_round') return !(got === 'round_already_routed' || got === 'insufficient_attention');
    return got !== x.reason;
  });
  claim('S6_attacks_all_rejected', misses.length === 0,
    misses.length ? misses.map((m) => `${m.event_id}→${rejectedById.get(m.event_id) || 'MISSING'}`).join(', ') : `${expects.length}/${expects.length} attacks pinned`);

  // S7 mixed storm — shuffle + duplicate valid + duplicate rejected + malformed, all at once
  const dupValid = [];
  for (let i = 0; i < 100; i++) dupValid.push(events[Math.floor(rnd() * events.length)]);
  const storm = shuffled([...events, ...dupValid, ...flood, ...malformed], rnd);
  const s7 = foldAttention(storm);
  claim('S7_mixed_storm_stable',
    agentFingerprint(s7) === agentFingerprint(base) && s7.rejected.length === base.rejected.length + 1,
    `storm of ${storm.length} deliveries → same agent state; audit grew by exactly the one '?' entry`);

  // S8 surfacing rollup discipline — only BOUND cabinets roll up; rooms and unbound never appear
  const bindings = {};
  const blocks = ['downtown-01', 'harbor-02', 'skyline-03'];
  cabIds.forEach((id, i) => { if (i % 2 === 0) bindings[id] = blocks[i % blocks.length]; }); // half bound
  bindings[roomIds[0]] = 'downtown-01'; // a ROOM binding must be ignored (cabinets only)
  const rollup = blockSurfacing(base, bindings);
  const boundSum = cabIds.filter((_, i) => i % 2 === 0).reduce((a, id) => a + (base.agents[id]?.attention_level || 0), 0);
  const rollupSum = Object.values(rollup).reduce((a, v) => a + v, 0);
  claim('S8_surfacing_bound_cabinets_only',
    rollupSum === boundSum && Object.keys(rollup).every((b) => blocks.includes(b)),
    `rollup ${rollupSum} === bound-cabinet sum ${boundSum}; room binding ignored`);

  return {
    schema_version: 1,
    lab_only: true,
    suite: 'attention-stress',
    seed, params: p,
    event_count: events.length,
    agent_count: Object.keys(base.agents).length,
    granted_total: base.granted_total,
    rejected_count: base.rejected.length,
    fingerprint: fp,
    claims,
    pass: claims.every((c) => c.ok),
  };
}

/** PURE: the multi-seed suite — independent seeds, one verdict. */
export function buildStressSuite({ seeds = [42, 1337, 9001], ...scale } = {}) {
  const packs = seeds.map((seed) => buildStressPack({ seed, ...scale }));
  return {
    schema_version: 1,
    lab_only: true,
    suite: 'attention-stress-suite',
    seeds,
    packs,
    pass: packs.every((p) => p.pass),
  };
}

/**
 * PURE: a REPLAY ARTIFACT for the operator surface (docs/lab/) — the pack plus the exact
 * replay instructions. Deliberately timestamp-free so re-generation is byte-identical.
 */
export function replayArtifact(pack) {
  return {
    artifact_kind: 'hiveworld_lab_replay',
    schema_version: 1,
    lab_only: true,
    never_production: 'arcade/hiveworld-agents/ is denylisted from the curated upload and imported by no Worker/DO/client path',
    replay: {
      module: pack.suite === 'attention-evidence'
        ? 'arcade/hiveworld-agents/attention-evidence.mjs'
        : 'arcade/hiveworld-agents/attention-stress.mjs',
      call: pack.suite === 'attention-stress-suite'
        ? `buildStressSuite({ seeds: ${JSON.stringify(pack.seeds)} })`
        : pack.suite === 'attention-evidence'
          ? `buildEvidencePack({ seed: ${pack.seed} })`
          : `buildStressPack({ seed: ${pack.seed} })`,
      determinism: 'seeded LCG only — same call reproduces this artifact byte for byte',
    },
    result: pack,
  };
}
