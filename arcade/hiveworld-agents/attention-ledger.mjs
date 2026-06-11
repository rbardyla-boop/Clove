/**
 * HiveWorld Agents — in-game AGENT ATTENTION ledger (W-6 LAB, pure + cross-env).
 *
 * ⚠️ SIMULATOR ONLY — imported by NOTHING in the production Worker/DO/client paths, and the
 * curated upload denylists this whole directory. This is the attention-framed successor to
 * agent-ledger.mjs (W-4), renamed per the operator's clarification: the long-term economy is
 * an in-game ATTENTION-ROUTING system between SYSTEM-OWNED hive agents — non-cash game units
 * that route attention/coordination so the city can decide what gets surfaced, maintained,
 * featured, or amplified. It is never money, never income, never a human balance.
 *
 * Vocabulary rules (binding for any future W-6 production plan):
 *   - units are "agent attention units" — never tickets, never currency, never earnings;
 *   - events GRANT or ROUTE attention — never pay, mint, transfer, cash out, or withdraw;
 *   - an agent has an attention_level — never a balance;
 *   - agents are system-shaped nodes ONLY (arcade-room:* | city-room:* | city-registry:* |
 *     cabinet:sha256:*) — person-shaped identifiers are structurally rejected;
 *   - there is NO event kind that moves value out of the system, and the fold rejects any
 *     kind it does not know.
 *
 * Attention invariants (AA — each fold-enforced and unit-tested; mirrors the W-4 AE set):
 *   AA-CONSERVE   routing conserves total attention; only bounded grants create units.
 *   AA-NO-NEG     an over-routing event is REJECTED; no attention_level ever goes negative.
 *   AA-GRANT-CAP  a grant is an integer 1..GRANT_MAX_PER_EVENT and carries a round_id.
 *   AA-ROUTE-CAP  a route is capped at ROUTE_MAX_PER_EVENT.
 *   AA-ONE-ROUTE  at most ONE route per (from_agent, round_id) — no per-round drain loops.
 *   AA-NO-EXIT    no exit kind exists; unknown kinds (incl. any cash-out shape) are REJECTED.
 *   AA-NO-PERSON  person-shaped agent ids are REJECTED at registration.
 *   AA-CLOSED-SIG route signals come from a closed token set (no free text).
 *
 * Convergence: the fold consumes a CANONICAL ordering (seq asc, then event_id asc; duplicate
 * event_ids are no-ops), so reordered/duplicated delivery of the same events folds to the
 * SAME state. See ADR-041 (W-4) and HIVE_WORLD_ALIGNMENT.md §6 (attention framing).
 */

export const NODE_KINDS = Object.freeze(['arcade-room', 'city-room', 'city-registry', 'cabinet']);
export const AGENT_ID_RE = /^(arcade-room|city-room|city-registry):[a-z0-9][a-z0-9-]{1,62}$|^cabinet:sha256:[0-9a-f]{64}$/;
export const EVENT_KINDS = Object.freeze(['agent_registered', 'attention_granted', 'attention_routed']);
/** Closed routing-signal tokens — in-game coordination signals, never free text. */
export const SIGNAL_TOKENS = Object.freeze(['round_played', 'event_spotlight', 'coordination']);

export const GRANT_MAX_PER_EVENT = 120;  // mirrors the shipped round-payout clamp ceiling
export const ROUTE_MAX_PER_EVENT = 12;   // a fixed small fraction — attention, not a jackpot

const isInt = (v) => Number.isInteger(v);
const isId = (v) => typeof v === 'string' && /^[a-z0-9][a-z0-9:._-]{1,120}$/.test(v);

/** PURE: node-shaped agent id check; person-shaped names never pass (AA-NO-PERSON). */
export function isAgentId(v) {
  if (typeof v !== 'string' || !AGENT_ID_RE.test(v)) return false;
  return !/player|person|user|email|account/.test(v);
}

// event constructors (conveniences; the fold re-validates everything)
export function agentRegistered({ event_id, seq, agent_id, node_kind }) {
  return { event_id, seq, kind: 'agent_registered', agent_id, node_kind };
}
export function attentionGranted({ event_id, seq, agent_id, units, round_id }) {
  return { event_id, seq, kind: 'attention_granted', agent_id, units, round_id };
}
export function attentionRouted({ event_id, seq, from, to, units, round_id, signal_token }) {
  return { event_id, seq, kind: 'attention_routed', from, to, units, round_id, signal_token };
}

/**
 * PURE: fold an event log into attention state. Canonical order = (seq asc, event_id asc);
 * duplicate event_ids are no-ops; invalid events are REJECTED with a reason, never partially
 * applied. Returns { agents: { [id]: { node_kind, attention_level } }, granted_total,
 * rejected: [{ event_id, reason }] }.
 */
export function foldAttention(events) {
  const list = Array.isArray(events) ? [...events] : [];
  list.sort((a, b) => ((a?.seq ?? 0) - (b?.seq ?? 0)) || String(a?.event_id).localeCompare(String(b?.event_id)));
  const state = { agents: {}, granted_total: 0, rejected: [] };
  const applied = new Set();
  const rejectedIds = new Set(); // a duplicate of an already-REJECTED event is also a no-op —
  // without this, re-delivery grows the rejection log and the audit fingerprint diverges
  // under duplication (found by the evidence pack's C3 probe; the W-4 module has this gap).
  const roundRoutes = new Set(); // "<from>|<round_id>" — AA-ONE-ROUTE
  const reject = (e, reason) => {
    const id = String(e?.event_id ?? '?');
    if (rejectedIds.has(id)) return;
    rejectedIds.add(id);
    state.rejected.push({ event_id: id, reason });
  };

  for (const e of list) {
    if (!e || typeof e !== 'object' || !isId(e.event_id) || !isInt(e.seq)) { reject(e, 'malformed_event'); continue; }
    if (applied.has(e.event_id) || rejectedIds.has(e.event_id)) continue; // duplicate delivery → no-op
    if (!EVENT_KINDS.includes(e.kind)) { reject(e, 'unknown_kind'); continue; } // AA-NO-EXIT

    if (e.kind === 'agent_registered') {
      if (!isAgentId(e.agent_id)) { reject(e, 'bad_agent_id'); continue; }
      if (!NODE_KINDS.includes(e.node_kind)) { reject(e, 'bad_node_kind'); continue; }
      if (!e.agent_id.startsWith(e.node_kind + ':')) { reject(e, 'kind_id_mismatch'); continue; }
      if (state.agents[e.agent_id]) { reject(e, 'already_registered'); continue; }
      state.agents[e.agent_id] = { node_kind: e.node_kind, attention_level: 0 };
      applied.add(e.event_id);
      continue;
    }

    if (e.kind === 'attention_granted') {
      if (!state.agents[e.agent_id]) { reject(e, 'unknown_agent'); continue; }
      if (!isInt(e.units) || e.units < 1 || e.units > GRANT_MAX_PER_EVENT) { reject(e, 'grant_out_of_bounds'); continue; } // AA-GRANT-CAP
      if (!isId(e.round_id)) { reject(e, 'missing_round'); continue; }
      state.agents[e.agent_id].attention_level += e.units;
      state.granted_total += e.units;
      applied.add(e.event_id);
      continue;
    }

    // attention_routed
    if (!state.agents[e.from] || !state.agents[e.to]) { reject(e, 'unknown_agent'); continue; }
    if (e.from === e.to) { reject(e, 'self_route'); continue; }
    if (!isInt(e.units) || e.units < 1 || e.units > ROUTE_MAX_PER_EVENT) { reject(e, 'route_out_of_bounds'); continue; } // AA-ROUTE-CAP
    if (!isId(e.round_id)) { reject(e, 'missing_round'); continue; }
    if (!SIGNAL_TOKENS.includes(e.signal_token)) { reject(e, 'bad_signal'); continue; }   // AA-CLOSED-SIG
    const rk = `${e.from}|${e.round_id}`;
    if (roundRoutes.has(rk)) { reject(e, 'round_already_routed'); continue; }             // AA-ONE-ROUTE
    if (state.agents[e.from].attention_level < e.units) { reject(e, 'insufficient_attention'); continue; } // AA-NO-NEG
    state.agents[e.from].attention_level -= e.units;
    state.agents[e.to].attention_level += e.units;
    roundRoutes.add(rk);
    applied.add(e.event_id);
  }
  return state;
}

/** PURE: deterministic fingerprint of a folded state (convergence checks). */
export function attentionFingerprint(state) {
  const agents = Object.keys(state.agents).sort().map((id) => `${id}=${state.agents[id].attention_level}`);
  return `g${state.granted_total}|${agents.join(',')}|r${state.rejected.length}`;
}

/** PURE: AA-CONSERVE checker — accepted grants fully account for all attention levels. */
export function attentionConserved(state) {
  const sum = Object.values(state.agents).reduce((a, x) => a + x.attention_level, 0);
  return sum === state.granted_total;
}

/**
 * PURE: one played round as attention routing — the room node grants the (clamped) round
 * attention, then routes a FIXED SMALL coordination share to the cabinet node. Non-cash,
 * bounded, attributed to NODES — never to a person.
 */
export function routeRound({ roomAgent, cabinetAgent, proposedScore, roundId, seqBase }) {
  const grant = Math.max(1, Math.min(GRANT_MAX_PER_EVENT, Math.round((Number(proposedScore) || 0) / 12)));
  const share = Math.max(1, Math.min(ROUTE_MAX_PER_EVENT, Math.round(grant / 10)));
  return [
    attentionGranted({ event_id: `${roundId}:grant`, seq: seqBase, agent_id: roomAgent, units: grant, round_id: roundId }),
    attentionRouted({ event_id: `${roundId}:route`, seq: seqBase + 1, from: roomAgent, to: cabinetAgent, units: share, round_id: roundId, signal_token: 'round_played' }),
  ];
}

/**
 * PURE: block-collective surfacing rollup — cabinet-node attention rolls up to the BLOCK each
 * cabinet is bound to (bindings: { [cabinetAgentId]: blockCityId }). The city would use this
 * to decide what gets featured; per-person attribution stays deferred (ADR-009).
 */
export function blockSurfacing(state, bindings) {
  const out = {};
  for (const [agentId, agent] of Object.entries(state.agents)) {
    if (agent.node_kind !== 'cabinet') continue;
    const block = bindings && typeof bindings === 'object' ? bindings[agentId] : null;
    if (typeof block !== 'string' || !block) continue;
    out[block] = (out[block] || 0) + agent.attention_level;
  }
  return out;
}
