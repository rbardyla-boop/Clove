/**
 * HiveWorld Agents — W-6 LAB attention-ledger EVIDENCE PACK builder (pure, deterministic).
 *
 * ⚠️ SIMULATOR ONLY. This is the "sim evidence" half of the W-6 gate (ADR-041/ADR-042): before
 * any production In-game Agent Attention Ledger can even be PLANNED, the lab must prove the
 * fold's safety properties under load and under adversarial input. This module builds one
 * deterministic, seeded scenario (system-shaped agents, many rounds of attention routing,
 * injected attacks) and evaluates a fixed claim list against it. Same seed → same pack,
 * byte for byte (no Date.now, no Math.random — a local LCG only).
 *
 * The pack PROVES (or loudly fails):
 *   C1 replay determinism      C2 reorder convergence       C3 duplicate safety
 *   C4 conservation            C5 caps enforced             C6 no negative levels
 *   C7 no exit kind            C8 no person-shaped agents   C9 one route per round
 *   C10 vocabulary clean (no payment/balance/cash language in state keys)
 *
 * Evidence here is SIMULATION evidence: it supports fold-level safety claims only — it says
 * nothing about production wiring, abuse economics at scale, or legal posture (W-8 gates).
 */

import {
  foldAttention, attentionFingerprint, attentionConserved, routeRound,
  agentRegistered, attentionGranted, attentionRouted,
  GRANT_MAX_PER_EVENT, ROUTE_MAX_PER_EVENT, EVENT_KINDS, SIGNAL_TOKENS,
} from './attention-ledger.mjs';

/** Tiny deterministic PRNG (mulberry32) — seeded, never wall-clock. */
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
const hex64 = (rnd) => Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('');

/**
 * PURE: build the deterministic scenario — honest traffic + injected attacks.
 * Returns { events, expects } where expects pins what the attacks MUST produce.
 */
export function buildScenario({ seed = 42, rooms = 3, cabinets = 9, rounds = 240 } = {}) {
  const rnd = lcg(seed);
  const events = [];
  let seq = 0;
  const roomIds = Array.from({ length: rooms }, (_, i) => `arcade-room:stress-room-${i}`);
  const cabIds = Array.from({ length: cabinets }, () => `cabinet:sha256:${hex64(rnd)}`);
  for (const id of roomIds) events.push(agentRegistered({ event_id: `reg:${id}`, seq: ++seq, agent_id: id, node_kind: 'arcade-room' }));
  for (const id of cabIds) events.push(agentRegistered({ event_id: `reg:${id.slice(0, 24)}:${seq}`, seq: ++seq, agent_id: id, node_kind: 'cabinet' }));

  // honest traffic: rounds route attention room → cabinet
  let firstRoundRoom = roomIds[0];
  for (let r = 0; r < rounds; r++) {
    const room = roomIds[Math.floor(rnd() * roomIds.length)];
    if (r === 0) firstRoundRoom = room; // pin the drain-replay attack to the room that ACTUALLY routed round 0
    const cab = cabIds[Math.floor(rnd() * cabIds.length)];
    const score = Math.floor(rnd() * 2000);
    events.push(...routeRound({ roomAgent: room, cabinetAgent: cab, proposedScore: score, roundId: `round-${seed}-${r}`, seqBase: ++seq }));
    seq++; // routeRound consumed seqBase and seqBase+1
  }

  // injected attacks — every one MUST be rejected with the pinned reason
  const attacks = [
    [agentRegistered({ event_id: 'atk:person', seq: ++seq, agent_id: 'player:somebody', node_kind: 'cabinet' }), 'bad_agent_id'],
    [agentRegistered({ event_id: 'atk:account', seq: ++seq, agent_id: 'account:42', node_kind: 'arcade-room' }), 'bad_agent_id'],
    [attentionGranted({ event_id: 'atk:overgrant', seq: ++seq, agent_id: roomIds[0], units: GRANT_MAX_PER_EVENT + 1, round_id: 'atk-r1' }), 'grant_out_of_bounds'],
    [attentionGranted({ event_id: 'atk:zerogranт'.replace('т', 't'), seq: ++seq, agent_id: roomIds[0], units: 0, round_id: 'atk-r2' }), 'grant_out_of_bounds'],
    [attentionRouted({ event_id: 'atk:overroute', seq: ++seq, from: roomIds[0], to: cabIds[0], units: ROUTE_MAX_PER_EVENT + 1, round_id: 'atk-r3', signal_token: 'round_played' }), 'route_out_of_bounds'],
    [attentionRouted({ event_id: 'atk:freetext', seq: ++seq, from: roomIds[0], to: cabIds[0], units: 2, round_id: 'atk-r4', signal_token: 'pay me' }), 'bad_signal'],
    [attentionRouted({ event_id: 'atk:selfroute', seq: ++seq, from: roomIds[0], to: roomIds[0], units: 2, round_id: 'atk-r5', signal_token: 'coordination' }), 'self_route'],
    [{ event_id: 'atk:cashout', seq: ++seq, kind: 'cash_out', agent_id: roomIds[0], units: 50 }, 'unknown_kind'],
    [{ event_id: 'atk:withdraw', seq: ++seq, kind: 'withdraw_to_wallet', agent_id: roomIds[0], units: 50 }, 'unknown_kind'],
    [attentionRouted({ event_id: 'atk:drain', seq: ++seq, from: firstRoundRoom, to: cabIds[1], units: ROUTE_MAX_PER_EVENT, round_id: `round-${seed}-0`, signal_token: 'round_played' }), 'route_out_of_bounds_or_round'],
  ];
  for (const [e] of attacks) events.push(e);
  return {
    events,
    expects: attacks.map(([e, reason]) => ({ event_id: e.event_id, reason })),
    roomIds, cabIds,
  };
}

/** PURE: evaluate the full claim list. All claims must hold for the pack to PASS. */
export function buildEvidencePack({ seed = 42, rooms = 3, cabinets = 9, rounds = 240, shuffles = 25, duplicates = 60 } = {}) {
  const rnd = lcg(seed ^ 0x9e3779b9);
  const { events, expects } = buildScenario({ seed, rooms, cabinets, rounds });
  const base = foldAttention(events);
  const fp = attentionFingerprint(base);
  const claims = [];
  const claim = (id, ok, detail) => claims.push({ id, ok: !!ok, detail });

  // C1 replay determinism
  claim('C1_replay_deterministic', attentionFingerprint(foldAttention(events)) === fp, `fingerprint ${fp}`);

  // C2 reorder convergence (K independent shuffles)
  let reorderOk = true;
  for (let k = 0; k < shuffles; k++) {
    if (attentionFingerprint(foldAttention(shuffled(events, rnd))) !== fp) { reorderOk = false; break; }
  }
  claim('C2_reorder_convergent', reorderOk, `${shuffles} shuffles → same fingerprint`);

  // C3 duplicate safety (re-deliver a random sample on top of a shuffle)
  const dups = Array.from({ length: duplicates }, () => events[Math.floor(rnd() * events.length)]);
  claim('C3_duplicate_safe', attentionFingerprint(foldAttention([...shuffled(events, rnd), ...dups])) === fp, `${duplicates} duplicate deliveries → same fingerprint`);

  // C4 conservation
  claim('C4_conserved', attentionConserved(base), `granted_total ${base.granted_total} equals sum of levels`);

  // C5 caps: every injected over-cap/zero/free-text/self/person attack rejected
  const rejectedById = new Map(base.rejected.map((r) => [r.event_id, r.reason]));
  const capAttacks = expects.filter((x) => x.reason !== 'route_out_of_bounds_or_round');
  claim('C5_caps_and_shape_enforced',
    capAttacks.every((x) => rejectedById.get(x.event_id) === x.reason),
    capAttacks.map((x) => `${x.event_id}→${rejectedById.get(x.event_id) || 'MISSING'}`).join(', '));

  // C6 no negative attention levels anywhere, ever (post-fold sweep)
  claim('C6_no_negative_levels', Object.values(base.agents).every((a) => a.attention_level >= 0), 'all levels >= 0');

  // C7 no exit kind exists, and exit-shaped injections rejected as unknown
  const exitVocab = /cash|payout|withdraw|redeem_fiat|sell|wallet/i;
  claim('C7_no_exit_kind',
    !EVENT_KINDS.some((k) => exitVocab.test(k)) && !SIGNAL_TOKENS.some((s) => exitVocab.test(s))
    && rejectedById.get('atk:cashout') === 'unknown_kind' && rejectedById.get('atk:withdraw') === 'unknown_kind',
    'vocabulary has no exit; injected exits rejected');

  // C8 no person-shaped agents in final state; person registrations rejected
  claim('C8_no_person_agents',
    Object.keys(base.agents).every((id) => !/player|person|user|email|account/.test(id))
    && rejectedById.get('atk:person') === 'bad_agent_id' && rejectedById.get('atk:account') === 'bad_agent_id',
    `${Object.keys(base.agents).length} agents, all node-shaped`);

  // C9 one route per (from, round): the drain replay on an already-routed round was rejected
  const drainReason = rejectedById.get('atk:drain');
  claim('C9_one_route_per_round', drainReason === 'round_already_routed' || drainReason === 'insufficient_attention',
    `drain replay → ${drainReason || 'MISSING'}`);

  // C10 vocabulary clean: serialized state KEYS carry no payment/balance/cash language
  const keyVocab = /balance|payment|payout|payable|cash|wallet|price|wage|salary|earn|ticket|mint/i;
  const keys = [];
  const walk = (v) => { if (v && typeof v === 'object') for (const [k, s] of Object.entries(v)) { keys.push(k); walk(s); } };
  walk(base);
  claim('C10_vocabulary_clean', keys.every((k) => !keyVocab.test(k)), `${keys.length} state keys scanned`);

  return {
    schema_version: 1,
    lab_only: true,
    seed, params: { rooms, cabinets, rounds, shuffles, duplicates },
    event_count: events.length,
    agent_count: Object.keys(base.agents).length,
    granted_total: base.granted_total,
    rejected_count: base.rejected.length,
    fingerprint: fp,
    claims,
    pass: claims.every((c) => c.ok),
  };
}
