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
export const OBJECTIVE_KINDS = Object.freeze(['reach_node', 'gather_at_zone', 'dwell_at_node', 'visit_in_order']);
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
  // 7C-V: dwell — stand WITH the place for a moment (continuous presence, server-tracked)
  Object.freeze({
    kind: 'dwell_at_node',
    x: 240, y: 520, radius: 44, dwell_s: 4, // the same proven-walkable corner, wider and patient
    hint: 'Objective: keep the beacon company a moment.',
    ack: 'A quiet moment at the beacon — the block settles.',
  }),
  // 7C-V: visit in order — touch A, then B (block-collective: ANY player may complete each leg)
  Object.freeze({
    kind: 'visit_in_order',
    x: 240, y: 520, bx: 500, by: 500, radius: 40, // arcade walk → plaza heart, both proven walkable
    hint: 'Objective: touch the beacon, then the plaza heart.',
    ack: 'Beacon to plaza, in order — the route remembers.',
  }),
]);

/**
 * 7C-V: per-block HINT flavor — sparse closed overrides keyed by city then cycle index
 * (the blockVoice pattern, server-side: the flavored line ships in the same hint push).
 * Acks stay universal per kind. Every string is screened by the same vocabulary tests.
 */
const BLOCK_HINTS = Object.freeze({
  'downtown-01': Object.freeze({ 0: 'Objective: answer the Signal Spire beacon by the arcade walk.' }),
  'harbor-02':   Object.freeze({ 2: 'Objective: keep the dockside beacon company a moment.' }),
  'skyline-03':  Object.freeze({ 0: 'Objective: reach the beacon under the Beacon Crown.' }),
  'foundry-04':  Object.freeze({ 3: 'Objective: touch the gantry beacon, then the works floor.' }),
  'nexus-05':    Object.freeze({ 1: 'Objective: two together at the Junction Ring crossing.' }),
  'garden-06':   Object.freeze({ 1: 'Objective: two together on the green.' }),
  'aurora-07':   Object.freeze({ 0: 'Objective: answer the Aurora Spire beacon on the arc.' }),
  'relay-08':    Object.freeze({ 0: 'Objective: answer the Relay Tower beacon at the junction.' }),
  'lumen-09':    Object.freeze({ 0: 'Objective: answer the Lumen Beacon on the outer loop.' }),
});

/** PURE: deterministic objective id from static config only. */
export function objectiveId(cityId, index) {
  return `obj:${cityId}:${index % CYCLE.length}`;
}

/**
 * PURE: fresh per-block objective state (EPHEMERAL — never persisted, never per-player).
 * `phase` is per-kind scratch, reset on every activation/completion: dwell uses it as the
 * continuous-presence start timestamp (0 = nobody inside); visit_in_order uses 0/1 legs.
 */
export function createObjectiveState(now) {
  return { index: 0, activated_at: now, cooldown_until: 0, phase: 0 };
}

/** PURE: the active objective definition for a block state, or null during cooldown. */
export function activeObjective(cityId, state, now) {
  if (typeof cityId !== 'string' || !CITY_IDS.includes(cityId)) return null;
  if (!state || now < state.cooldown_until) return null;
  const def = CYCLE[state.index % CYCLE.length];
  const flavored = (BLOCK_HINTS[cityId] || {})[state.index % CYCLE.length];
  return { objective_id: objectiveId(cityId, state.index), ...def, ...(flavored ? { hint: flavored } : {}) };
}

/**
 * PURE: does the canonical position set satisfy an objective? Positions only — plus, for the
 * stateful kinds (dwell/visit), the per-block `phase` scratch and `now`. Returns
 * { completed, count, phase } where `phase` is the NEXT scratch value to store.
 */
export function evaluateObjective(objective, positions, phase = 0, now = 0) {
  const pts = Object.values(positions || {}).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!objective) return { completed: false, count: 0, phase: 0 };
  const near = (x, y, r) => pts.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 <= r * r);
  if (objective.kind === 'reach_node') {
    const hit = near(objective.x, objective.y, objective.radius);
    return { completed: hit, count: hit ? 1 : 0, phase: 0 };
  }
  if (objective.kind === 'gather_at_zone') {
    const inside = pts.filter((p) => p.x >= objective.x && p.x <= objective.x + objective.w
      && p.y >= objective.y && p.y <= objective.y + objective.h).length;
    return { completed: inside >= objective.needed, count: inside, phase: 0 };
  }
  if (objective.kind === 'dwell_at_node') {
    // phase = timestamp when continuous presence began (0 = nobody inside).
    // Presence is sampled at evaluation ticks (accepted inputs + alarm) — leaving resets.
    if (!near(objective.x, objective.y, objective.radius)) return { completed: false, count: 0, phase: 0 };
    const since = phase > 0 ? phase : now;
    const done = now - since >= objective.dwell_s * 1000;
    return { completed: done, count: 1, phase: done ? 0 : since };
  }
  if (objective.kind === 'visit_in_order') {
    // phase 0: waiting for A; phase 1: A touched, waiting for B. Block-collective:
    // ANY canonical player may complete each leg (actor-less, like every acknowledgment).
    if (phase === 0) {
      return near(objective.x, objective.y, objective.radius)
        ? { completed: false, count: 1, phase: 1 }
        : { completed: false, count: 0, phase: 0 };
    }
    const done = near(objective.bx, objective.by, objective.radius);
    return { completed: done, count: done ? 1 : 0, phase: done ? 0 : 1 };
  }
  return { completed: false, count: 0, phase: 0 }; // unknown kind fails safe
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
  const r = evaluateObjective(obj, positions, s.phase || 0, now);
  if (!r.completed) {
    return { state: r.phase === (s.phase || 0) ? s : { ...s, phase: r.phase }, completed: null };
  }
  return {
    state: { index: (s.index + 1) % CYCLE.length, activated_at: now + OBJECTIVE_COOLDOWN_MS, cooldown_until: now + OBJECTIVE_COOLDOWN_MS, phase: 0 },
    completed: { objective_id: obj.objective_id, kind: obj.kind, ack: obj.ack, count: r.count },
  };
}

/** The ONLY fields the hint state ever carries (allowlist; exact-key-set tested). */
export const HINT_FIELDS = Object.freeze(['schema', 'objective_id', 'kind', 'hint', 'x', 'y', 'radius', 'w', 'h', 'needed', 'dwell_s', 'bx', 'by']);
/** PURE: public-safe hint projection (geometry is static config — display marker data). */
export function objectiveHintPayload(objective) {
  if (!objective) return { schema: OBJECTIVE_SCHEMA, objective: null };
  const out = { objective_id: objective.objective_id, kind: objective.kind, hint: objective.hint, x: objective.x, y: objective.y };
  if (objective.kind === 'reach_node') out.radius = objective.radius;
  if (objective.kind === 'gather_at_zone') { out.w = objective.w; out.h = objective.h; out.needed = objective.needed; }
  if (objective.kind === 'dwell_at_node') { out.radius = objective.radius; out.dwell_s = objective.dwell_s; }
  if (objective.kind === 'visit_in_order') { out.radius = objective.radius; out.bx = objective.bx; out.by = objective.by; }
  return { schema: OBJECTIVE_SCHEMA, objective: out };
}

/** The ONLY fields a completion event payload ever carries (allowlist; tested). */
export const COMPLETION_FIELDS = Object.freeze(['objective_id', 'kind', 'ack', 'count']);
/** PURE: public-safe completion projection — acknowledgment only, no value of any shape. */
export function objectiveCompletedPayload(completed) {
  return { objective_id: completed.objective_id, kind: completed.kind, ack: completed.ack, count: completed.count };
}

/** All copy in the closed cycle INCLUDING per-block flavor (fresh array; vocabulary screens). */
export function objectiveCopy() {
  return [
    ...CYCLE.flatMap((o) => [o.hint, o.ack]),
    ...Object.values(BLOCK_HINTS).flatMap((m) => Object.values(m)),
  ];
}

/** 7C-V: the cycle definitions + flavor map (read-only views for the bounds tests). */
export function cycleDefinitions() {
  return CYCLE.map((o, i) => ({ index: i, ...o }));
}
export function blockHintOverrides() {
  return Object.fromEntries(Object.entries(BLOCK_HINTS).map(([k, v]) => [k, { ...v }]));
}

/** PURE: copy screen — bounded and clean of economy/ownership/violence vocabulary. */
export function objectiveCopyIsClean(str) {
  return typeof str === 'string' && str.length > 0 && str.length <= OBJECTIVE_COPY_MAX && !FORBIDDEN_RE.test(str);
}
