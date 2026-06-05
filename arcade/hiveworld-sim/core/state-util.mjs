/**
 * World-state shape + immutable update helpers + fingerprinting.
 *
 * Reducers NEVER mutate the state they receive — they return a new object with
 * only the touched slices replaced. That keeps replay safe and lets the debug UI
 * hold past snapshots without them changing underfoot.
 */
import { canonicalStringify, hashString } from './hash.mjs';
import { createArcadeWorld } from './phase1/round-authority.mjs';

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
    arcade: createArcadeWorld(), // Phase 2 parity (v0.2): per-room isolated arcade partitions
    // v0.3 parity: the room-presence coordinator. Mirrors the product RoomRegistry DO —
    // latest heartbeat per room + admin status overrides + reset generations. Health +
    // stale-population eviction are DERIVED at query time (rooms.mjs), never folded.
    roomRegistry: { heartbeats: {}, statusOverrides: {}, generations: {} },
    // v1.0 (Phase 5A–5E city/district mirror): per-block reported public summaries, per-actor
    // current block, route status, a bounded public-safe district activity feed, and a rejected-route
    // counter. No economy/accounts/ownership is ever folded here. See core/reducers/district.mjs.
    district: {
      blocks: {}, actorBlock: {}, routes: {}, activity: [], rejectedRoutes: 0,
      // v1.1 (Phase 4C–4G city-systems mirror): append-only world log + per-block derived
      // pressure (non-authoritative) + non-cash host rank + constrained/reversible stewardship
      // overrides + instanced/non-destructive trials. See core/reducers/city-systems.mjs.
      cityLog: { events: [], seq: 0 }, pressure: {}, hostRank: {}, stewardship: {}, trials: {},
      // v1.2 (Phase 5C/5D/5E push cadence): `blocks` is the registry AGGREGATE; `pushedView[cityId]`
      // is what that block has PUSHED to its clients — its own entry immediate, others as of its last
      // alarm. See core/reducers/city-cadence.mjs + core/phase1/district-presence-push.mjs.
      pushedView: {},
    },
  };
}

/** Default fold context (tunable per scenario). */
export const DEFAULT_CTX = Object.freeze({
  economyTestMode: true, // grants only allowed in test mode
  presenceTtlTicks: 5,   // presence older than this is "stale" for liveness checks
  adminEnabled: false,   // v0.3: room-admin ops (status/reset) are OFF unless a scenario opts in
  eventPresentation: null, // v0.8: operator display-only presentation overrides (null → defaults)
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
    arcade: state.arcade,
    roomRegistry: state.roomRegistry,
    district: state.district, // v1.0: include the city/district slice in the convergence fingerprint
  };
  return hashString(canonicalStringify(view));
}
