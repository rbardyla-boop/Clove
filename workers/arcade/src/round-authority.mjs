/**
 * Round + ticket authority — PURE state machine, transport-agnostic.
 *
 * Owns ONLY tickets + rounds. Cabinet OCCUPANCY remains owned by the Durable
 * Object (Phase 1b, unchanged); the current occupant is passed in as `occupantId`
 * so this module never weakens or duplicates occupancy authority.
 *
 * Phase 1g generalizes the round engine to multiple cabinet types via a small
 * ruleset registry (pulse_tap, signal_sprint). The cabinet type, ruleset version
 * and ticket formula are resolved from the server-authoritative catalog by the
 * round's machine id — clients never choose their own validator or ticket award.
 * Pulse Tap behaviour and its ticket formula are unchanged (byte-equivalent):
 * the pulse_tap ruleset delegates to the original ./tickets.mjs functions.
 *
 * All transitions return a NEW state object (no mutation), so the DO can persist
 * the result and the tests can assert on snapshots. The server issues round ids;
 * clients never grant themselves tickets.
 */
import { computeTickets, validateScorePayload, LIMITS } from './tickets.mjs';
import { computeSignalTickets, validateSignalPayload, SIGNAL_LIMITS } from './signal-sprint.mjs';
import { computeNeonGridTickets, validateNeonGridPayload, NEON_GRID_LIMITS } from './neon-grid.mjs';
import { appendLedger } from './ledger.mjs';
import { getCabinetByMachineId } from './catalog.mjs';

/**
 * Ruleset registry keyed by cabinet_type. Each entry knows how to validate a
 * submitted result, compute the ticket award, how long a round may live, and the
 * limits block handed back to the client on round start.
 */
const RULESETS = Object.freeze({
  pulse_tap: {
    maxRoundMs: LIMITS.MAX_ROUND_MS,
    validate: validateScorePayload,
    compute: (p) => computeTickets({ grade: p.grade, score: p.score, accuracy: p.accuracy }),
    startedLimits: () => ({
      maxDurationMs: LIMITS.MAX_DURATION_MS,
      limits: { maxScore: LIMITS.MAX_SCORE, maxAccuracy: LIMITS.MAX_ACCURACY, minDurationMs: LIMITS.MIN_DURATION_MS, maxDurationMs: LIMITS.MAX_DURATION_MS },
    }),
  },
  signal_sprint: {
    maxRoundMs: SIGNAL_LIMITS.MAX_ROUND_MS,
    validate: validateSignalPayload,
    compute: (p) => computeSignalTickets({ grade: p.grade, distance: p.distance, maxStreak: p.maxStreak, noiseHits: p.noiseHits }),
    startedLimits: () => ({
      maxDurationMs: SIGNAL_LIMITS.MAX_DURATION_MS,
      limits: {
        maxScore: SIGNAL_LIMITS.MAX_SCORE, maxDistance: SIGNAL_LIMITS.MAX_DISTANCE,
        maxPulses: SIGNAL_LIMITS.MAX_PULSES, maxNoiseHits: SIGNAL_LIMITS.MAX_NOISE, maxStreak: SIGNAL_LIMITS.MAX_STREAK,
        minDurationMs: SIGNAL_LIMITS.MIN_DURATION_MS, maxDurationMs: SIGNAL_LIMITS.MAX_DURATION_MS,
      },
    }),
  },
  // Phase 1l: the first cabinet that enters the floor through the adapter/import
  // path. Its authority is identical in shape to the hand-wired cabinets above —
  // the validator + ticket formula are resolved server-side from the catalog.
  neon_grid: {
    maxRoundMs: NEON_GRID_LIMITS.MAX_ROUND_MS,
    validate: validateNeonGridPayload,
    compute: (p) => computeNeonGridTickets({ grade: p.grade, completedPatterns: p.completedPatterns, bestStreak: p.bestStreak, mistakes: p.mistakes }),
    startedLimits: () => ({
      maxDurationMs: NEON_GRID_LIMITS.MAX_DURATION_MS,
      limits: {
        maxScore: NEON_GRID_LIMITS.MAX_SCORE, maxCorrectSteps: NEON_GRID_LIMITS.MAX_CORRECT_STEPS,
        maxCompletedPatterns: NEON_GRID_LIMITS.MAX_PATTERNS, maxMistakes: NEON_GRID_LIMITS.MAX_MISTAKES,
        maxStreak: NEON_GRID_LIMITS.MAX_STREAK,
        minDurationMs: NEON_GRID_LIMITS.MIN_DURATION_MS, maxDurationMs: NEON_GRID_LIMITS.MAX_DURATION_MS,
      },
    }),
  },
});

/**
 * Resolve a playable cabinet + its ruleset from a machine id, using the
 * server-authoritative catalog. Returns null for unknown / coming-soon /
 * non-ticketed cabinets, or cabinet types with no registered ruleset.
 */
function resolveRuleset(machineId) {
  const cabinet = getCabinetByMachineId(machineId);
  if (!cabinet || cabinet.status !== 'live' || cabinet.ticket_enabled !== true) return null;
  const ruleset = RULESETS[cabinet.cabinet_type];
  if (!ruleset) return null;
  return { cabinet, ruleset };
}

export function createTicketState() {
  return {
    balances: {},   // playerId -> integer ticket balance (room/session scoped)
    rounds: {},     // roundId  -> { roundId, machineId, cabinetId, cabinetType, rulesetVersion, playerId, startedAt, expiresAt, status }
    submitted: {},  // roundId  -> true (dedup guard against double-award)
    lastPublic: null, // { machineId, playerId, score, grade, awarded, at } — safe to broadcast
    ledger: {},     // playerId  -> [ ledger entries ]        (Phase 1f, private)
    inventory: {},  // playerId  -> { prizeId -> entitlement } (Phase 1f, session-bound)
    equips: {},     // playerId  -> { slot -> prizeId }        (Phase 1f)
    redemptions: {},// redemptionId -> true                    (Phase 1f dedup)
    challengeStats: {},    // playerId -> { pulseRounds, signalRounds, signalCleanRounds, redemptions, ticketsEarned } (Phase 1h)
    challengeProgress: {}, // playerId -> { challengeId -> progress entry }  (Phase 1h)
    achievements: {},      // playerId -> { achievementId -> unlock record } (Phase 1h)
    events: [],            // bounded room-wide public-safe event feed       (Phase 1h)
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
    challengeStats: maybe.challengeStats || {},
    challengeProgress: maybe.challengeProgress || {},
    achievements: maybe.achievements || {},
    events: Array.isArray(maybe.events) ? maybe.events : [],
  };
}

export function getBalance(state, playerId) {
  return state.balances[playerId] || 0;
}

/**
 * Register a new round for the current occupant. The DO supplies a freshly
 * generated roundId and the authoritative occupantId. The cabinet type and
 * ruleset are resolved server-side from the catalog, never from the client.
 */
export function startRound(state, { machineId, occupantId, playerId, roundId, now }) {
  const resolved = resolveRuleset(machineId);
  if (!resolved) return { state, ok: false, reason: 'invalid_cabinet' };
  if (!playerId) return { state, ok: false, reason: 'no_identity' };
  if (occupantId !== playerId) return { state, ok: false, reason: 'not_occupant' };
  if (typeof roundId !== 'string' || !roundId) return { state, ok: false, reason: 'malformed' };
  const { cabinet, ruleset } = resolved;
  const expiresAt = now + ruleset.maxRoundMs;

  // Supersede any still-active round this player holds on this machine.
  const rounds = {};
  for (const [id, r] of Object.entries(state.rounds)) {
    rounds[id] = (r.status === 'active' && r.playerId === playerId && r.machineId === machineId)
      ? { ...r, status: 'expired' }
      : r;
  }
  rounds[roundId] = {
    roundId,
    machineId,
    cabinetId: cabinet.cabinet_id,
    cabinetType: cabinet.cabinet_type,
    rulesetVersion: cabinet.ruleset_version,
    playerId,
    startedAt: now,
    expiresAt,
    status: 'active',
  };

  const started = {
    roundId,
    machineId,
    cabinetId: cabinet.cabinet_id,
    cabinetType: cabinet.cabinet_type,
    rulesetVersion: cabinet.ruleset_version,
    startedAt: now,
    expiresAt,
    ...ruleset.startedLimits(),
  };
  return { state: { ...state, rounds }, ok: true, reason: null, started };
}

/**
 * Validate + award a submitted round. `senderId` is the socket's authoritative
 * identity (never client-supplied), `occupantId` is the current cabinet holder.
 *
 * The validator + ticket award are selected from the ROUND's server-recorded cabinet
 * type, so a client cannot submit a Signal Sprint result against a Pulse Tap
 * round (or vice-versa) to pick a more generous formula.
 */
export function submitRound(state, { payload, senderId, occupantId, now }) {
  if (!payload || typeof payload !== 'object') return { state, ok: false, reason: 'malformed' };
  if (typeof payload.roundId !== 'string' || !payload.roundId) return { state, ok: false, reason: 'malformed' };

  const round = state.rounds[payload.roundId];
  if (!round) return { state, ok: false, reason: 'unknown_round' };
  if (state.submitted[payload.roundId] || round.status === 'submitted') {
    return { state, ok: false, reason: 'duplicate_submission' };
  }
  if (round.status === 'expired') return { state, ok: false, reason: 'round_expired' };
  if (round.playerId !== senderId) return { state, ok: false, reason: 'wrong_session' };
  if (round.machineId !== payload.machineId) return { state, ok: false, reason: 'wrong_cabinet' };
  // Explicit cross-cabinet-type / ruleset guards (when the client labels its result).
  if (payload.cabinetType != null && payload.cabinetType !== round.cabinetType) {
    return { state, ok: false, reason: 'wrong_cabinet_type' };
  }
  if (payload.rulesetVersion != null && payload.rulesetVersion !== round.rulesetVersion) {
    return { state, ok: false, reason: 'wrong_ruleset' };
  }
  if (occupantId !== round.playerId) return { state, ok: false, reason: 'not_occupant' };
  if (now > round.expiresAt) {
    const rounds = { ...state.rounds, [round.roundId]: { ...round, status: 'expired' } };
    return { state: { ...state, rounds }, ok: false, reason: 'round_expired' };
  }

  // Pick the validator + ticket award from the round's server-recorded cabinet type.
  const ruleset = RULESETS[round.cabinetType];
  if (!ruleset) return { state, ok: false, reason: 'invalid_cabinet' };
  const v = ruleset.validate(payload);
  if (!v.ok) return { state, ok: false, reason: v.reason };

  // Server computes the award. Any payload.tickets is ignored entirely.
  const awarded = ruleset.compute(payload);
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
    source: round.machineId, refId: round.roundId, cabinetId: round.machineId, cabinetType: round.cabinetType,
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
