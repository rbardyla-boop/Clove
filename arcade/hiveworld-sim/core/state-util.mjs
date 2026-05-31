/**
 * World-state shape + immutable update helpers + fingerprinting.
 *
 * Reducers NEVER mutate the state they receive — they return a new object with
 * only the touched slices replaced. That keeps replay safe and lets the debug UI
 * hold past snapshots without them changing underfoot.
 */
import { canonicalStringify, hashString } from './hash.mjs';

export function createInitialState() {
  return {
    tick: 0,
    registry: {},        // actorId -> { role: 'player'|'moderator'|'room', name }
    rooms: {},           // roomId  -> { machines: { machineId -> { occupiedBy, occupiedSince, rev } }, announcedBy }
    presence: {},        // actorId -> { roomId, cellId, lastTick }   (ephemeral)
    slots: {},           // slotId  -> slot record
    objects: {},         // objectId-> { lockedBy, roomId, tick, suspended }
    arAnchors: {},       // anchorId-> { actor, cellId, payload, tick }
    economy: {
      credits: {},       // actorId -> integer balance
      goods: {},         // goodId  -> { owner, type, bound: true }
      receipts: [],      // signed internal receipts
    },
    cosmetics: {},        // actorId -> { equipped: { goodId: true } }
    weather: {},          // cellId  -> { kind, lastTick }            (ephemeral)
    eventLog: [],         // durable world events (round results, slot lifecycle)
    intents: {},          // actorId -> { type, payload, tick }       (proposals only)
    moderationLog: [],    // { tick, actor, action, target }
  };
}

/** Default fold context (tunable per scenario). */
export const DEFAULT_CTX = Object.freeze({
  economyTestMode: true, // grants only allowed in test mode
  presenceTtlTicks: 5,   // presence older than this is "stale" for liveness checks
});

/** Return a shallow copy of obj with one key set (no mutation). */
export function withKey(obj, key, value) {
  return { ...obj, [key]: value };
}

/** Reducer result helpers. */
export function rej(state, reason) {
  return { state, accepted: false, reason };
}
export function ok(state) {
  return { state, accepted: true, reason: null };
}

/**
 * Order-independent fingerprint of a folded world view. Two nodes that folded the
 * same accepted event set produce the same fingerprint; any divergence (a missing
 * or extra event) changes it — that is how desync is detected.
 */
export function stateFingerprint(state) {
  // tick is excluded: it reflects the latest event seen, which can differ between
  // a synced and a lagging node even when their *authoritative* state matches.
  const view = {
    registry: state.registry,
    rooms: state.rooms,
    presence: state.presence,
    slots: state.slots,
    objects: state.objects,
    arAnchors: state.arAnchors,
    economy: state.economy,
    cosmetics: state.cosmetics,
    weather: state.weather,
    eventLog: state.eventLog,
    moderationLog: state.moderationLog,
  };
  return hashString(canonicalStringify(view));
}
