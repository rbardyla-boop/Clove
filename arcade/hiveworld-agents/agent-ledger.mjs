/**
 * HiveWorld Agents — node-as-agent ticket LEDGER (W-4 SIMULATOR LAB, pure + cross-env).
 *
 * ⚠️ SIMULATOR ONLY. This module is the Phase-9-doctrine "simulator-first" rung for the agent
 * payment idea: every hive node (a Durable Object in production — arcade room, city block,
 * approved cabinet package) is modeled as an AGENT with an account, and "payment" is a bounded,
 * non-cash TICKET transfer between agent accounts on an append-only event log. It is imported by
 * NOTHING in the production Worker/DO/client paths and must stay that way until W-6 is authorized
 * (sim evidence + operator sign-off). Cash never appears here — there is no cash-out event kind,
 * and the fold rejects any kind it does not know. See arcade/virtual-arcade/HIVE_WORLD_ALIGNMENT.md §6.
 *
 * Anti-extraction invariants (AE — each one is fold-enforced and unit-tested):
 *   AE-CONSERVE     transfers conserve total supply; only bounded mints create tickets.
 *   AE-NO-NEGATIVE  an overdrawing transfer is REJECTED; no balance ever goes below zero.
 *   AE-MINT-BOUND   a mint must be an integer 1..MINT_MAX_PER_EVENT and carry a round_id.
 *   AE-XFER-CAP     a transfer is capped at TRANSFER_MAX_PER_EVENT.
 *   AE-ONE-PER-ROUND at most ONE transfer per (from_agent, round_id) — no per-round drain loops.
 *   AE-NO-CASHOUT   no event kind moves value out of the system; unknown kinds are REJECTED.
 *   AE-NO-PERSON    agent ids are NODE-shaped only; person/player/account-shaped ids are REJECTED.
 *   AE-CLOSED-MEMO  transfer memos come from a closed token set (no free text).
 *
 * Convergence: like every HiveWorld fold, the ledger folds a CANONICAL ordering of the event log
 * (sort by seq, then event_id; duplicates by event_id are no-ops), so any reordered/duplicated
 * delivery of the same events folds to the SAME state (same fingerprint).
 */

// ── closed vocabulary ─────────────────────────────────────────────────────────
export const NODE_KINDS = Object.freeze(['arcade-room', 'city-room', 'city-registry', 'cabinet']);
export const AGENT_ID_RE = /^(arcade-room|city-room|city-registry):[a-z0-9][a-z0-9-]{1,62}$|^cabinet:sha256:[0-9a-f]{64}$/;
export const EVENT_KINDS = Object.freeze(['agent_registered', 'tickets_minted', 'agent_transfer']);
export const MEMO_TOKENS = Object.freeze(['round_played', 'event_spotlight', 'recognition']);

/** Bounds — mirror the shipped payout clamp scale; SMALL on purpose. */
export const MINT_MAX_PER_EVENT = 120;     // ceiling of the shipped round payout range
export const TRANSFER_MAX_PER_EVENT = 12;  // a fixed small fraction, never a jackpot

const isInt = (v) => Number.isInteger(v);
const isId = (v) => typeof v === 'string' && /^[a-z0-9][a-z0-9:._-]{1,120}$/.test(v);

/** PURE: is this a node-shaped agent id (and NEVER a person-shaped one)? */
export function isAgentId(v) {
  if (typeof v !== 'string' || !AGENT_ID_RE.test(v)) return false;
  return !/player|person|user|email|account/.test(v); // AE-NO-PERSON belt over the shape braces
}

// ── event constructors (conveniences; the fold re-validates everything) ──────
export function agentRegistered({ event_id, seq, agent_id, node_kind }) {
  return { event_id, seq, kind: 'agent_registered', agent_id, node_kind };
}
export function ticketsMinted({ event_id, seq, agent_id, amount, round_id }) {
  return { event_id, seq, kind: 'tickets_minted', agent_id, amount, round_id };
}
export function agentTransfer({ event_id, seq, from, to, amount, round_id, memo_token }) {
  return { event_id, seq, kind: 'agent_transfer', from, to, amount, round_id, memo_token };
}

// ── canonical fold ────────────────────────────────────────────────────────────
/**
 * PURE: fold an event log into ledger state. Canonical order = (seq asc, event_id asc); duplicate
 * event_ids are no-ops. Invalid events are REJECTED with a reason (never partially applied).
 * Returns { agents: { [id]: { node_kind, balance } }, minted_total, rejected: [{event_id,reason}] }.
 */
export function foldLedger(events) {
  const list = Array.isArray(events) ? [...events] : [];
  list.sort((a, b) => ((a?.seq ?? 0) - (b?.seq ?? 0)) || String(a?.event_id).localeCompare(String(b?.event_id)));
  const state = { agents: {}, minted_total: 0, rejected: [] };
  const applied = new Set();
  const rejectedIds = new Set(); // a duplicate of an already-REJECTED event is also a no-op —
  // without this, re-delivery grows the rejection log and the audit fingerprint diverges under
  // duplication (found by the W-6 lab evidence pack's C3 probe; ported from attention-ledger).
  // First-seen invalid evidence is kept: the FIRST rejection of an event id is recorded with
  // its reason; only re-deliveries of the SAME id are silenced (identity-less events collapse
  // to one identical '?' entry — no distinct evidence exists to lose). Same semantics as
  // attention-ledger.mjs so both lab folds share one audit-convergence contract.
  const roundTransfers = new Set(); // "<from>|<round_id>" — AE-ONE-PER-ROUND
  const reject = (e, reason) => {
    const id = String(e?.event_id ?? '?');
    if (rejectedIds.has(id)) return;
    rejectedIds.add(id);
    state.rejected.push({ event_id: id, reason });
  };

  for (const e of list) {
    if (!e || typeof e !== 'object' || !isId(e.event_id) || !isInt(e.seq)) { reject(e, 'malformed_event'); continue; }
    if (applied.has(e.event_id) || rejectedIds.has(e.event_id)) continue; // duplicate delivery → no-op
    if (!EVENT_KINDS.includes(e.kind)) { reject(e, 'unknown_kind'); continue; } // AE-NO-CASHOUT

    if (e.kind === 'agent_registered') {
      if (!isAgentId(e.agent_id)) { reject(e, 'bad_agent_id'); continue; }
      if (!NODE_KINDS.includes(e.node_kind)) { reject(e, 'bad_node_kind'); continue; }
      if (!e.agent_id.startsWith(e.node_kind + ':')) { reject(e, 'kind_id_mismatch'); continue; }
      if (state.agents[e.agent_id]) { reject(e, 'already_registered'); continue; }
      state.agents[e.agent_id] = { node_kind: e.node_kind, balance: 0 };
      applied.add(e.event_id);
      continue;
    }

    if (e.kind === 'tickets_minted') {
      if (!state.agents[e.agent_id]) { reject(e, 'unknown_agent'); continue; }
      if (!isInt(e.amount) || e.amount < 1 || e.amount > MINT_MAX_PER_EVENT) { reject(e, 'mint_out_of_bounds'); continue; } // AE-MINT-BOUND
      if (!isId(e.round_id)) { reject(e, 'missing_round'); continue; }
      state.agents[e.agent_id].balance += e.amount;
      state.minted_total += e.amount;
      applied.add(e.event_id);
      continue;
    }

    // agent_transfer
    if (!state.agents[e.from] || !state.agents[e.to]) { reject(e, 'unknown_agent'); continue; }
    if (e.from === e.to) { reject(e, 'self_transfer'); continue; }
    if (!isInt(e.amount) || e.amount < 1 || e.amount > TRANSFER_MAX_PER_EVENT) { reject(e, 'transfer_out_of_bounds'); continue; } // AE-XFER-CAP
    if (!isId(e.round_id)) { reject(e, 'missing_round'); continue; }
    if (!MEMO_TOKENS.includes(e.memo_token)) { reject(e, 'bad_memo'); continue; }   // AE-CLOSED-MEMO
    const rk = `${e.from}|${e.round_id}`;
    if (roundTransfers.has(rk)) { reject(e, 'round_already_transferred'); continue; } // AE-ONE-PER-ROUND
    if (state.agents[e.from].balance < e.amount) { reject(e, 'insufficient_balance'); continue; } // AE-NO-NEGATIVE
    state.agents[e.from].balance -= e.amount;
    state.agents[e.to].balance += e.amount;
    roundTransfers.add(rk);
    applied.add(e.event_id);
  }
  return state;
}

/** PURE: deterministic fingerprint of a folded state (convergence checks). */
export function ledgerFingerprint(state) {
  const agents = Object.keys(state.agents).sort().map((id) => `${id}=${state.agents[id].balance}`);
  return `m${state.minted_total}|${agents.join(',')}|r${state.rejected.length}`;
}

/** PURE: AE-CONSERVE checker — accepted mints fully account for all balances. */
export function supplyConserved(state) {
  const sum = Object.values(state.agents).reduce((a, x) => a + x.balance, 0);
  return sum === state.minted_total;
}

/**
 * PURE: one played round as agent payments — the W-4 shape of "a cabinet earns when played":
 * the room agent mints the (clamped) round payout, then routes a FIXED SMALL fraction to the
 * cabinet agent. Non-cash, bounded, attributed to nodes — never to a person.
 */
export function simulateRound({ roomAgent, cabinetAgent, proposedScore, roundId, seqBase }) {
  const payout = Math.max(1, Math.min(MINT_MAX_PER_EVENT, Math.round((Number(proposedScore) || 0) / 12)));
  const share = Math.max(1, Math.min(TRANSFER_MAX_PER_EVENT, Math.round(payout / 10)));
  return [
    ticketsMinted({ event_id: `${roundId}:mint`, seq: seqBase, agent_id: roomAgent, amount: payout, round_id: roundId }),
    agentTransfer({ event_id: `${roundId}:share`, seq: seqBase + 1, from: roomAgent, to: cabinetAgent, amount: share, round_id: roundId, memo_token: 'round_played' }),
  ];
}

/**
 * PURE: Phase-9 Rung-1 rollup — BLOCK-COLLECTIVE recognition. Cabinet-agent balances roll up to
 * the BLOCK each cabinet is bound to (bindings: { [cabinetAgentId]: blockCityId }). Display-only;
 * per-person attribution stays deferred (ADR-009).
 */
export function blockRecognition(state, bindings) {
  const out = {};
  for (const [agentId, agent] of Object.entries(state.agents)) {
    if (agent.node_kind !== 'cabinet') continue;
    const block = bindings && typeof bindings === 'object' ? bindings[agentId] : null;
    if (typeof block !== 'string' || !block) continue;
    out[block] = (out[block] || 0) + agent.balance;
  }
  return out;
}
