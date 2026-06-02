/**
 * Phase 1e/1g/1l round + ticket authority — SIMULATOR-LOCAL PORT of
 * workers/arcade/src/round-authority.mjs.
 *
 * Pure transitions over an `arcade` state slice. The cabinet type, ruleset and
 * ticket formula are resolved server-side from the catalog by machine id — a
 * client never picks its own validator or grants itself tickets. The server
 * computes the award; any client-supplied ticket amount is ignored. On an accepted
 * submit this also drives the ledger, challenge progress, and the public feed,
 * exactly like the production Durable Object.
 *
 * Occupancy is NOT owned here — `occupantId` is passed in (the canonical fold's
 * occupancy slice is the authority), so this never weakens occupancy authority.
 */
import { getCabinetByMachineId } from './catalog.mjs';
import { resolveRulesetByMachine, getRuleset } from './tickets.mjs';
import { appendLedger } from './ledger.mjs';
import { appendFeed } from './feed.mjs';
import { recordRoundAccepted } from './challenges.mjs';
import { initialRoomEventTracker } from './room-events.mjs';

/** Default room a room-less arcade event is scoped to (mirrors product main-floor). */
export const DEFAULT_SIM_ROOM = 'room:main';

/**
 * Phase 2a/2b parity: the arcade WORLD slice partitions the (single-room) arcade
 * substate by room id, so tickets/ledger/inventory/challenges/feed are ISOLATED
 * per room — exactly like the per-room product Durable Objects. `createArcade()`
 * stays the single-room substate (used by the pure unit tests + each partition).
 */
export function createArcadeWorld() {
  return { rooms: {} };
}

/**
 * Read a room's isolated arcade substate from the world slice. PURE — returns a
 * fresh empty substate for an unseen room (never mutates the world). Reducers run
 * the pure round/prize/challenge functions on this substate and write the result
 * back under the same room id, so rooms stay isolated + immutable.
 */
export function arcadeRoom(world, roomId) {
  const id = roomId || DEFAULT_SIM_ROOM;
  return (world && world.rooms && world.rooms[id]) || createArcade();
}

/** Immutably write a room's substate back into the world slice. */
export function withArcadeRoom(world, roomId, sub) {
  const id = roomId || DEFAULT_SIM_ROOM;
  return { ...world, rooms: { ...world.rooms, [id]: sub } };
}

/** The initial arcade state slice (lives inside the world view). */
export function createArcade(generation = 0) {
  return {
    rounds: {},            // roundId -> round record
    submitted: {},         // roundId -> true (dedup)
    balances: {},          // actor -> integer ticket balance (room/session scoped)
    ledger: {},            // actor -> [ private ledger entries ]
    inventory: {},         // actor -> { prizeId -> entitlement } (session-bound)
    equips: {},            // actor -> { slot -> prizeId }
    redemptions: {},       // redemptionId -> true (dedup)
    challengeStats: {},    // actor -> stats
    challengeProgress: {}, // actor -> { challengeId -> progress }
    achievements: {},      // actor -> { achievementId -> unlock } (kept for parity; badges live in inventory)
    feed: [],              // bounded public-safe event feed
    lastPublic: null,      // last public award summary
    // v0.6: per-room live room-event transition tracker (dedup state for the feed).
    // Reset-safe: a room_reset installs a fresh partition via createArcade(generation),
    // so an old event never replays. Public-safe (no actor ids / balances / ledger).
    eventTracker: initialRoomEventTracker(generation),
    // v0.9: per-room DISPLAY-ONLY presentation override (sanitized partial, or null = none).
    // The room presents base⊕override. Reset-safe: a fresh partition clears it (back to base).
    presentationOverride: null,
  };
}

export function getBalance(arcade, actor) {
  return arcade.balances[actor] || 0;
}

/**
 * PURE: count rounds still live (status 'active', not past expiry) at `tick`. Used
 * only for public-safe room HEARTBEAT diagnostics (v0.3) — reads the round registry
 * without mutating it and exposes no actor ids.
 */
export function activeRoundCount(arcade, tick = 0) {
  if (!arcade || typeof arcade.rounds !== 'object' || arcade.rounds === null) return 0;
  let n = 0;
  for (const r of Object.values(arcade.rounds)) {
    if (r && r.status === 'active' && (typeof r.expiresTick !== 'number' || r.expiresTick >= tick)) n += 1;
  }
  return n;
}

/** Register a new round for the current occupant. Returns { arcade, ok, reason, started }. */
export function startRound(arcade, { machineId, occupantId, actor, roundId, tick }) {
  const resolved = resolveRulesetByMachine(machineId);
  if (!resolved) return { arcade, ok: false, reason: 'invalid_cabinet' };
  if (!actor) return { arcade, ok: false, reason: 'no_identity' };
  if (occupantId !== actor) return { arcade, ok: false, reason: 'not_occupant' };
  if (typeof roundId !== 'string' || !roundId) return { arcade, ok: false, reason: 'malformed' };
  const { cabinet, ruleset } = resolved;
  const expiresTick = tick + ruleset.maxRoundTicks;

  const rounds = {};
  for (const [id, r] of Object.entries(arcade.rounds)) {
    rounds[id] = (r.status === 'active' && r.actor === actor && r.machineId === machineId) ? { ...r, status: 'expired' } : r;
  }
  rounds[roundId] = { roundId, machineId, cabinetId: cabinet.cabinet_id, cabinetType: cabinet.cabinet_type, rulesetVersion: cabinet.ruleset_version, actor, startedTick: tick, expiresTick, status: 'active' };
  const started = { roundId, machineId, cabinetId: cabinet.cabinet_id, cabinetType: cabinet.cabinet_type, rulesetVersion: cabinet.ruleset_version, startedTick: tick, expiresTick };
  return { arcade: { ...arcade, rounds }, ok: true, reason: null, started };
}

/**
 * Validate + award a submitted round. `senderId` is the socket's authoritative
 * identity (never client-supplied); `occupantId` is the current cabinet holder.
 * The validator + award are selected from the ROUND's server-recorded cabinet type.
 */
export function submitRound(arcade, { payload, senderId, occupantId, tick }) {
  if (!payload || typeof payload !== 'object') return { arcade, ok: false, reason: 'malformed' };
  if (typeof payload.roundId !== 'string' || !payload.roundId) return { arcade, ok: false, reason: 'malformed' };
  const round = arcade.rounds[payload.roundId];
  if (!round) return { arcade, ok: false, reason: 'unknown_round' };
  if (arcade.submitted[payload.roundId] || round.status === 'submitted') return { arcade, ok: false, reason: 'duplicate_submission' };
  if (round.status === 'expired') return { arcade, ok: false, reason: 'round_expired' };
  if (round.actor !== senderId) return { arcade, ok: false, reason: 'wrong_session' };
  if (round.machineId !== payload.machineId) return { arcade, ok: false, reason: 'wrong_cabinet' };
  if (payload.cabinetType != null && payload.cabinetType !== round.cabinetType) return { arcade, ok: false, reason: 'wrong_cabinet_type' };
  if (payload.rulesetVersion != null && payload.rulesetVersion !== round.rulesetVersion) return { arcade, ok: false, reason: 'wrong_ruleset' };
  if (occupantId !== round.actor) return { arcade, ok: false, reason: 'not_occupant' };
  if (tick > round.expiresTick) {
    const rounds = { ...arcade.rounds, [round.roundId]: { ...round, status: 'expired' } };
    return { arcade: { ...arcade, rounds }, ok: false, reason: 'round_expired' };
  }
  const ruleset = getRuleset(round.cabinetType);
  if (!ruleset) return { arcade, ok: false, reason: 'invalid_cabinet' };
  const v = ruleset.validate(payload);
  if (!v.ok) return { arcade, ok: false, reason: v.reason };

  const awarded = ruleset.compute(payload); // payload.tickets is ignored entirely
  const balance = getBalance(arcade, round.actor) + awarded;
  const cabinet = getCabinetByMachineId(round.machineId);
  const cabinetLabel = cabinet ? cabinet.display_name : round.machineId;

  let next = {
    ...arcade,
    balances: { ...arcade.balances, [round.actor]: balance },
    rounds: { ...arcade.rounds, [round.roundId]: { ...round, status: 'submitted' } },
    submitted: { ...arcade.submitted, [round.roundId]: true },
    lastPublic: { machineId: round.machineId, actor: round.actor, score: payload.score, grade: payload.grade, awarded, tick },
  };
  next = appendLedger(next, { actor: round.actor, eventType: 'tickets_awarded', delta: awarded, balanceAfter: balance, source: round.machineId, refId: round.roundId, cabinetId: round.cabinetId, cabinetType: round.cabinetType, summary: `earned ${awarded} tickets at ${cabinetLabel}`, tick });

  // Challenge progress (authoritative) from the accepted round.
  const rec = recordRoundAccepted(next, { actor: round.actor, cabinetType: round.cabinetType, noiseHits: payload.noiseHits, mistakes: payload.mistakes, awarded, tick });
  next = rec.arcade;

  // Public-safe feed: ticket award + any newly-completed challenges.
  next = appendFeed(next, { type: 'ticket_award', actor: round.actor, summary: `${round.actor} earned ${awarded} tickets at ${cabinetLabel}`, source: round.machineId, tick });
  for (const c of rec.newlyCompleted) {
    next = appendFeed(next, { type: 'challenge_completed', actor: round.actor, summary: `${round.actor} completed ${c.display_name}`, source: c.challenge_id, tick });
  }
  return { arcade: next, ok: true, reason: null, awarded, balance, cabinetType: round.cabinetType, newlyCompleted: rec.newlyCompleted };
}

/** Expire an actor's active rounds (called on release / disconnect / timeout). */
export function expireActorRounds(arcade, actor) {
  let changed = false;
  const rounds = {};
  for (const [id, r] of Object.entries(arcade.rounds)) {
    if (r.status === 'active' && r.actor === actor) { rounds[id] = { ...r, status: 'expired' }; changed = true; }
    else rounds[id] = r;
  }
  return changed ? { ...arcade, rounds } : arcade;
}
