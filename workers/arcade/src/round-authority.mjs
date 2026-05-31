/**
 * Pulse Tap round + ticket authority — PURE state machine, transport-agnostic.
 *
 * Owns ONLY tickets + rounds. Cabinet OCCUPANCY remains owned by the Durable
 * Object (Phase 1b, unchanged); the current occupant is passed in as `occupantId`
 * so this module never weakens or duplicates occupancy authority.
 *
 * All transitions return a NEW state object (no mutation), so the DO can persist
 * the result and the tests can assert on snapshots. The server issues round ids;
 * clients never grant themselves tickets.
 */
import { computeTickets, validateScorePayload, LIMITS } from './tickets.mjs';
import { appendLedger } from './ledger.mjs';

/** Cabinets that award tickets in Phase 1e. */
export const TICKETED_MACHINES = Object.freeze(new Set(['pulse']));

export function createTicketState() {
  return {
    balances: {},   // playerId -> integer ticket balance (room/session scoped)
    rounds: {},     // roundId  -> { roundId, machineId, playerId, startedAt, expiresAt, status }
    submitted: {},  // roundId  -> true (dedup guard against double-award)
    lastPublic: null, // { machineId, playerId, score, grade, awarded, at } — safe to broadcast
    ledger: {},     // playerId  -> [ ledger entries ]        (Phase 1f, private)
    inventory: {},  // playerId  -> { prizeId -> entitlement } (Phase 1f, session-bound)
    equips: {},     // playerId  -> { slot -> prizeId }        (Phase 1f)
    redemptions: {},// redemptionId -> true                    (Phase 1f dedup)
  };
}

/** Ensure an arbitrary stored object has the ticket-state shape (migration-safe). */
export function ensureTicketState(maybe) {
  if (!maybe || typeof maybe !== 'object') return createTicketState();
  return {
    balances: maybe.balances || {},
    rounds: maybe.rounds || {},
    submitted: maybe.submitted || {},
    lastPublic: maybe.lastPublic || null,
    ledger: maybe.ledger || {},
    inventory: maybe.inventory || {},
    equips: maybe.equips || {},
    redemptions: maybe.redemptions || {},
  };
}

export function getBalance(state, playerId) {
  return state.balances[playerId] || 0;
}

/**
 * Register a new round for the current occupant. The DO supplies a freshly
 * generated roundId and the authoritative occupantId.
 */
export function startRound(state, { machineId, occupantId, playerId, roundId, now }) {
  if (!TICKETED_MACHINES.has(machineId)) return { state, ok: false, reason: 'invalid_cabinet' };
  if (!playerId) return { state, ok: false, reason: 'no_identity' };
  if (occupantId !== playerId) return { state, ok: false, reason: 'not_occupant' };
  if (typeof roundId !== 'string' || !roundId) return { state, ok: false, reason: 'malformed' };

  // Supersede any still-active round this player holds on this machine.
  const rounds = {};
  for (const [id, r] of Object.entries(state.rounds)) {
    rounds[id] = (r.status === 'active' && r.playerId === playerId && r.machineId === machineId)
      ? { ...r, status: 'expired' }
      : r;
  }
  rounds[roundId] = { roundId, machineId, playerId, startedAt: now, expiresAt: now + LIMITS.MAX_ROUND_MS, status: 'active' };

  const started = {
    roundId,
    machineId,
    startedAt: now,
    expiresAt: now + LIMITS.MAX_ROUND_MS,
    maxDurationMs: LIMITS.MAX_DURATION_MS,
    limits: { maxScore: LIMITS.MAX_SCORE, maxAccuracy: LIMITS.MAX_ACCURACY, minDurationMs: LIMITS.MIN_DURATION_MS, maxDurationMs: LIMITS.MAX_DURATION_MS },
  };
  return { state: { ...state, rounds }, ok: true, reason: null, started };
}

/**
 * Validate + award a submitted round. `senderId` is the socket's authoritative
 * identity (never client-supplied), `occupantId` is the current cabinet holder.
 */
export function submitRound(state, { payload, senderId, occupantId, now }) {
  const v = validateScorePayload(payload);
  if (!v.ok) return { state, ok: false, reason: v.reason };

  const round = state.rounds[payload.roundId];
  if (!round) return { state, ok: false, reason: 'unknown_round' };
  if (state.submitted[payload.roundId] || round.status === 'submitted') {
    return { state, ok: false, reason: 'duplicate_submission' };
  }
  if (round.status === 'expired') return { state, ok: false, reason: 'round_expired' };
  if (round.playerId !== senderId) return { state, ok: false, reason: 'wrong_session' };
  if (round.machineId !== payload.machineId) return { state, ok: false, reason: 'wrong_cabinet' };
  if (occupantId !== round.playerId) return { state, ok: false, reason: 'not_occupant' };
  if (now > round.expiresAt) {
    const rounds = { ...state.rounds, [round.roundId]: { ...round, status: 'expired' } };
    return { state: { ...state, rounds }, ok: false, reason: 'round_expired' };
  }

  // Server computes the award. Any payload.tickets is ignored entirely.
  const awarded = computeTickets({ grade: payload.grade, score: payload.score, accuracy: payload.accuracy });
  const balance = getBalance(state, round.playerId) + awarded;
  let next = {
    ...state,
    balances: { ...state.balances, [round.playerId]: balance },
    rounds: { ...state.rounds, [round.roundId]: { ...round, status: 'submitted' } },
    submitted: { ...state.submitted, [round.roundId]: true },
    lastPublic: { machineId: round.machineId, playerId: round.playerId, score: payload.score, grade: payload.grade, awarded, at: now },
  };
  // Ledger: one tickets_awarded entry per round (deduped by round id).
  next = appendLedger(next, {
    playerId: round.playerId, eventType: 'tickets_awarded', delta: awarded, balanceAfter: balance,
    source: round.machineId, refId: round.roundId, cabinetId: round.machineId,
    summary: `earned ${awarded} tickets at ${round.machineId}`, now,
  }).state;
  return {
    state: next,
    ok: true,
    reason: null,
    awarded,
    balance,
    publicAward: { playerId: round.playerId, awarded, machineId: round.machineId, roundId: round.roundId },
  };
}

/** Expire a player's active rounds (called on release / disconnect / stale timeout). */
export function expirePlayerRounds(state, playerId) {
  let changed = false;
  const rounds = {};
  for (const [id, r] of Object.entries(state.rounds)) {
    if (r.status === 'active' && r.playerId === playerId) {
      rounds[id] = { ...r, status: 'expired' };
      changed = true;
    } else {
      rounds[id] = r;
    }
  }
  return changed ? { ...state, rounds } : state;
}

/** Drop rounds (and their dedup entries) whose lifetime has fully elapsed. */
export function pruneExpired(state, now) {
  const rounds = {};
  const submitted = {};
  for (const [id, r] of Object.entries(state.rounds)) {
    if (r.expiresAt >= now) {
      rounds[id] = r;
      if (state.submitted[id]) submitted[id] = true;
    }
  }
  return { ...state, rounds, submitted };
}
