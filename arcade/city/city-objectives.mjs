/**
 * Neon Circuit — Phase 7C: ACTIVITY OBJECTIVES WITHOUT REWARDS (pure + cross-env).
 *
 * Lightweight, NON-REWARD movement/gathering objectives — a reason to move and meet
 * ("reach the portal-plaza beacon", "two players on the west walk"), per the Phase 7
 * plan §7C. Completion is acknowledgment, NOT payout: no points, no balances, no
 * prizes, no ranks, no streaks, no persistence, nothing a player can accumulate.
 *
 * AUTHORITY (binding kernel rule): completion is SERVER-OWNED truth, evaluated here
 * purely from the canonical player positions the CityRoom/dev-shim already own — the
 * same authority Block Trial uses. There is NO inbound objective message of any kind:
 * the client can only ever RECEIVE the hint state and the completion event, so a
 * forged completion is structurally impossible (an attempted inbound type falls into
 * the existing unknown_type rejection).
 *
 * SHAPE: one static CLOSED objective cycle per block (deterministic ids from static
 * config only), exactly one objective active at a time, a completion cooldown so
 * movement spam can never flood the feed, and allowlist-projected payloads (exact
 * key sets, tested). All geometry sits on PROVEN-WALKABLE ground (the spawn plaza
 * and the portal corridor the existing smokes traverse).
 *
 * Shared verbatim by the Worker CityRoom and the dev shim. See
 * docs/NEON_CIRCUIT_PHASE7C_OBJECTIVES.md.
 */
import { CITY_IDS } from './city-block.mjs';
import { FORBIDDEN_RE } from './city-interactions.mjs';

export const OBJECTIVE_SCHEMA = 1;
export const OBJECTIVE_KINDS = Object.freeze(['reach_node', 'gather_at_zone']);
/** Quiet period after a completion before the next objective activates (anti-flood). */
export const OBJECTIVE_COOLDOWN_MS = 45_000;
/** Bound for hint/ack copy (same readability budget as the district flavor lines). */
export const OBJECTIVE_COPY_MAX = 72;

/**
 * The CLOSED objective cycle — identical geometry for every block (the blocks share
 * canonical geometry by design), block-flavored only through the existing display
 * layers. All values static; ids derive from (city, index) deterministically.
 *   reach_node      : one canonical player within `radius` of the node completes it.
 *   gather_at_zone  : at least `needed` canonical players inside the rect completes it.
 */
const CYCLE = Object.freeze([
  Object.freeze({
    kind: 'reach_node',
    x: 240, y: 520, radius: 36, // portal-corridor plaza — proven walkable by the portal smokes
    hint: 'Objective: reach the beacon by the arcade walk.',
    ack: 'Beacon reached — the block takes note.',
  }),
  Object.freeze({
    kind: 'gather_at_zone',
    x: 440, y: 440, w: 160, h: 160, needed: 2, // spawn plaza — where players actually are
    hint: 'Objective: two together on the plaza.',
    ack: 'Plaza gathering noted — good company.',
  }),
]);

/** PURE: deterministic objective id from static config only. */
export function objectiveId(cityId, index) {
  return `obj:${cityId}:${index % CYCLE.length}`;
}

/** PURE: fresh per-block objective state (EPHEMERAL — never persisted, never per-player). */
export function createObjectiveState(now) {
  return { index: 0, activated_at: now, cooldown_until: 0 };
}

/** PURE: the active objective definition for a block state, or null during cooldown. */
export function activeObjective(cityId, state, now) {
  if (typeof cityId !== 'string' || !CITY_IDS.includes(cityId)) return null;
  if (!state || now < state.cooldown_until) return null;
  const def = CYCLE[state.index % CYCLE.length];
  return { objective_id: objectiveId(cityId, state.index), ...def };
}

/** PURE: does the canonical position set satisfy an objective? Positions only — nothing else. */
export function evaluateObjective(objective, positions) {
  const pts = Object.values(positions || {}).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!objective) return { completed: false, count: 0 };
  if (objective.kind === 'reach_node') {
    const r2 = objective.radius * objective.radius;
    const hit = pts.some((p) => (p.x - objective.x) ** 2 + (p.y - objective.y) ** 2 <= r2);
    return { completed: hit, count: hit ? 1 : 0 };
  }
  if (objective.kind === 'gather_at_zone') {
    const inside = pts.filter((p) => p.x >= objective.x && p.x <= objective.x + objective.w
      && p.y >= objective.y && p.y <= objective.y + objective.h).length;
    return { completed: inside >= objective.needed, count: inside };
  }
  return { completed: false, count: 0 }; // unknown kind fails safe
}

/**
 * PURE: one evaluation step. Returns { state, completed } where `completed` is the
 * completion record to acknowledge (or null). Dedupe by construction: a completion
 * advances the cycle and arms the cooldown, so one activation acknowledges at most
 * once and nothing re-fires until the cooldown lapses.
 */
export function stepObjectives(cityId, state, positions, now) {
  const s = state || createObjectiveState(now);
  const obj = activeObjective(cityId, s, now);
  if (!obj) return { state: s, completed: null };
  const r = evaluateObjective(obj, positions);
  if (!r.completed) return { state: s, completed: null };
  return {
    state: { index: (s.index + 1) % CYCLE.length, activated_at: now + OBJECTIVE_COOLDOWN_MS, cooldown_until: now + OBJECTIVE_COOLDOWN_MS },
    completed: { objective_id: obj.objective_id, kind: obj.kind, ack: obj.ack, count: r.count },
  };
}

/** The ONLY fields the hint state ever carries (allowlist; exact-key-set tested). */
export const HINT_FIELDS = Object.freeze(['schema', 'objective_id', 'kind', 'hint', 'x', 'y', 'radius', 'w', 'h', 'needed']);
/** PURE: public-safe hint projection (geometry is static config — display marker data). */
export function objectiveHintPayload(objective) {
  if (!objective) return { schema: OBJECTIVE_SCHEMA, objective: null };
  const out = { objective_id: objective.objective_id, kind: objective.kind, hint: objective.hint, x: objective.x, y: objective.y };
  if (objective.kind === 'reach_node') out.radius = objective.radius;
  if (objective.kind === 'gather_at_zone') { out.w = objective.w; out.h = objective.h; out.needed = objective.needed; }
  return { schema: OBJECTIVE_SCHEMA, objective: out };
}

/** The ONLY fields a completion event payload ever carries (allowlist; tested). */
export const COMPLETION_FIELDS = Object.freeze(['objective_id', 'kind', 'ack', 'count']);
/** PURE: public-safe completion projection — acknowledgment only, no value of any shape. */
export function objectiveCompletedPayload(completed) {
  return { objective_id: completed.objective_id, kind: completed.kind, ack: completed.ack, count: completed.count };
}

/** All copy in the closed cycle (fresh array; for the vocabulary screens). */
export function objectiveCopy() {
  return CYCLE.flatMap((o) => [o.hint, o.ack]);
}

/** PURE: copy screen — bounded and clean of economy/ownership/violence vocabulary. */
export function objectiveCopyIsClean(str) {
  return typeof str === 'string' && str.length > 0 && str.length <= OBJECTIVE_COPY_MAX && !FORBIDDEN_RE.test(str);
}
