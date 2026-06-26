/**
 * Creator Freedom v1 — FREE SANDBOX declarative game SCHEMA + validator. PURE + cross-env.
 *
 * The authoring artifact a creator composes: a CLOSED, capability-limited JSON graph describing an
 * arcade game out of declarative blocks — arena, player control, objective, scoring, entities,
 * movement/AI patterns, WHEN->THEN rules, waves, timers, modifiers, theme. NO arbitrary JavaScript,
 * NO network/storage/assets, NO economy/ownership/live-world hooks.
 *
 * This module ONLY describes + validates the graph. A separate fixed interpreter
 * (arcade-builder/free-sandbox-interpreter.mjs) renders the validated graph as DATA — the package's
 * generated game.mjs is `const GRAPH = {...} ; <fixed interpreter>`, so the EXISTING importer gate
 * (import-arcade-package.mjs) and null-origin sandbox stay the authority, unchanged. Deny-by-default:
 * every capability flag must be false; unknown keys, over-cap counts, URLs and forbidden vocabulary fail.
 */
import { utf8Bytes, FORBIDDEN_TERMS_RE } from '../validator/validation-report.mjs';
import {
  PACKAGE_ID_RE, DISPLAY_NAME_MAX, FRAME_CONTRACTS, SIZE_BUDGET_MIN_BYTES, SIZE_BUDGET_MAX_BYTES,
} from './arcade-game-package-schema.mjs';

export const FREE_SANDBOX_PACKAGE_KIND = 'arcade_game_free_sandbox';
export const FREE_SANDBOX_GAME_KIND = 'free_sandbox';
export const FREE_SANDBOX_SCHEMA_VERSION = 1;

// ── hard caps (bounded freedom) ───────────────────────────────────────────────
export const CAPS = Object.freeze({
  MAX_ENTITY_TYPES: 8,
  MAX_LIVE_ENTITIES: 80,        // global live-instance ceiling (the interpreter also clamps to this)
  MAX_RULES: 16,
  MAX_WAVES: 12,
  MAX_ZONES: 8,
  MAX_SPAWN_PER_WAVE: 40,
  MIN_SPAWN_INTERVAL_S: 0.2,
  MAX_SPAWN_INTERVAL_S: 30,
  MAX_MESSAGE_LEN: 48,
  MIN_ROUND_S: 10,
  MAX_ROUND_S: 180,
  MAX_LIVES: 9,
  MAX_PER_TYPE_COUNT: 40,
  MAX_SCORE_VALUE: 1000,
  MAX_TARGET_COUNT: 200,
  MAX_SCORE_THRESHOLD: 100000,
  MAX_COMBO: 50,
});

// ── closed vocabularies (the ONLY values a graph may use) ─────────────────────
export const PALETTE_KEYS = Object.freeze(['cyan', 'magenta', 'violet', 'green', 'amber']);
export const SPEED_TIERS = Object.freeze(['still', 'slow', 'medium', 'fast', 'swift']);
export const SIZE_TIERS = Object.freeze(['small', 'medium', 'large']);
export const SHAPES = Object.freeze(['circle', 'square', 'triangle', 'diamond']);

export const BOUNDS_MODES = Object.freeze(['wrap', 'clamp', 'lethal']);
export const SCROLL_MODES = Object.freeze(['none', 'up', 'down', 'left', 'right']);
export const BACKGROUNDS = Object.freeze(['plain', 'grid', 'scanlines', 'stars']);
export const ZONE_KINDS = Object.freeze(['goal', 'hazard', 'safe', 'spawn']);

export const PLAYER_CONTROLS = Object.freeze(['free_move', 'lane_switch', 'dodge_horizontal', 'follow_pointer', 'tap_move']);
export const ENTITY_KINDS = Object.freeze(['enemy', 'obstacle', 'pickup', 'projectile', 'hazard', 'goal_marker', 'score_orb']);
export const MOVEMENT_PATTERNS = Object.freeze([
  'stationary', 'patrol_x', 'patrol_y', 'chase', 'flee', 'wander', 'orbit', 'zigzag', 'sine', 'fall', 'rise', 'burst',
]);
export const COLLISION_BEHAVIORS = Object.freeze(['none', 'block', 'damage', 'collect', 'score', 'goal']);
export const SPAWN_SIDES = Object.freeze(['top', 'bottom', 'left', 'right', 'random', 'center']);

export const OBJECTIVE_TYPES = Object.freeze([
  'survive_timer', 'reach_goal', 'collect_targets', 'clear_waves', 'timed_route', 'score_threshold', 'combo_chain', 'avoid_hits',
]);
export const RULE_EVENTS = Object.freeze([
  'timer_elapsed', 'score_reached', 'player_enters_zone', 'collision_with', 'pickup_collected', 'wave_cleared', 'lives_changed', 'combo_reached',
]);
export const RULE_ACTIONS = Object.freeze([
  'add_score', 'sub_life', 'add_life', 'spawn', 'despawn_kind', 'set_player_speed', 'trigger_fx', 'start_wave', 'end_win', 'end_lose', 'show_message', 'apply_modifier',
]);
export const FX_KINDS = Object.freeze(['flash', 'shake', 'burst']);
export const MODIFIER_KINDS = Object.freeze(['difficulty_up', 'slow_field', 'speed_up']);
export const DIFFICULTY_RAMPS = Object.freeze(['none', 'gentle', 'standard', 'hard']);
export const FX_LEVELS = Object.freeze(['off', 'soft', 'arcade']);
export const CONTRAST = Object.freeze(['standard', 'high']);
export const MOBILE_CONTROLS = Object.freeze(['pointer', 'lanes', 'pointer_or_lanes']);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/; // entity/zone/wave/rule ids: short kebab slugs

// ── tiny validation helpers (shared shape with rule-graph-templates) ──────────
function plain(o) { return !!o && typeof o === 'object' && !Array.isArray(o) && Object.getPrototypeOf(o) === Object.prototype; }
function unknownKeys(obj, allowed, at, errors) {
  if (!plain(obj)) { errors.push(`${at} must be an object`); return false; }
  let ok = true;
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) { errors.push(`${at}: unknown key '${k}'`); ok = false; }
  return ok;
}
function inSet(value, set, label, errors) {
  if (!set.includes(value)) { errors.push(`${label} must be one of: ${set.join(', ')}`); return false; }
  return true;
}
function intInRange(value, min, max, label, errors) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    errors.push(`${label} must be an integer ${min}..${max}`); return false;
  }
  return true;
}
function numInRange(value, min, max, label, errors) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    errors.push(`${label} must be a number ${min}..${max}`); return false;
  }
  return true;
}
function cleanText(value, maxLen, label, errors) {
  if (typeof value !== 'string' || utf8Bytes(value) > maxLen || value.trim() === ''
    || FORBIDDEN_TERMS_RE.test(value) || /https?:|wss?:|data:|blob:|javascript:|[<>{}`$]/i.test(value)) {
    errors.push(`${label} must be clean text (<= ${maxLen} bytes, no urls/code/economy terms)`); return false;
  }
  return true;
}
/** Recursively reject forbidden vocabulary / urls / capability terms in ANY string value. */
function scanStrings(value, errors, path = 'graph') {
  if (typeof value === 'string') {
    if (/https?:|wss?:|data:|blob:|javascript:|fetch|WebSocket|localStorage|sessionStorage|indexedDB|eval|Function/i.test(value)
      || FORBIDDEN_TERMS_RE.test(value)) errors.push(`${path}: forbidden vocabulary in string value`);
    return;
  }
  if (Array.isArray(value)) { value.forEach((v, i) => scanStrings(v, errors, `${path}[${i}]`)); return; }
  if (plain(value)) for (const [k, v] of Object.entries(value)) scanStrings(v, errors, `${path}.${k}`);
}

const TOP_KEYS = Object.freeze([
  'schema_version', 'package_kind', 'game_kind', 'template', 'package_id', 'display_name', 'frame_contract_id',
  'seed', 'arena', 'player', 'objective', 'scoring', 'entities', 'waves', 'rules', 'modifiers', 'theme',
  'accessibility', 'capabilities', 'size_budget_bytes',
]);
const CAPABILITY_KEYS = Object.freeze([
  'network', 'storage', 'external_assets', 'dom_escape', 'arbitrary_code',
  'live_world_authorized', 'ticket_hooks', 'prize_hooks', 'ledger_hooks',
]);

// ── canonical default graph (a minimal valid survive-the-timer game) ──────────
export function defaultFreeSandboxGraph(overrides = {}) {
  const base = {
    schema_version: FREE_SANDBOX_SCHEMA_VERSION,
    package_kind: FREE_SANDBOX_PACKAGE_KIND,
    game_kind: FREE_SANDBOX_GAME_KIND,
    template: 'blank',
    package_id: 'free-sandbox-demo',
    display_name: 'Free Sandbox Demo',
    frame_contract_id: 'cabinet-360x640',
    seed: 1337,
    arena: { bounds: 'clamp', scroll: 'none', background: 'grid', zones: [] },
    player: { control: 'free_move', speed: 'medium', lives: 3, size: 'medium', shape: 'triangle' },
    objective: { type: 'survive_timer', duration_s: 45 },
    scoring: { on_pickup: 10, on_enemy_clear: 0, survive_per_s: 1, combo_cap: 8 },
    entities: [
      { id: 'drifter', kind: 'enemy', shape: 'circle', color: 'magenta', size: 'medium', movement: 'wander', speed: 'slow', max_count: 6, collision: 'damage', lifetime_s: 0, score_value: 0 },
    ],
    waves: [
      { id: 'w1', at_s: 1, entity: 'drifter', count: 6, interval_s: 1.5, from: 'random', repeat: true },
    ],
    rules: [
      { id: 'r1', when: { event: 'timer_elapsed', at_s: 45 }, then: { action: 'end_win' } },
    ],
    modifiers: { difficulty_ramp: 'gentle', replay_variation: false },
    theme: { palette: 'cyan', particles: 'soft', shake: 'soft', contrast: 'high' },
    accessibility: { reduced_motion: 'supported', contrast: 'high', mobile_controls: 'pointer_or_lanes', keyboard_controls: 'arrows', color_independent_signals: true },
    capabilities: {
      network: false, storage: false, external_assets: false, dom_escape: false, arbitrary_code: false,
      live_world_authorized: false, ticket_hooks: false, prize_hooks: false, ledger_hooks: false,
    },
    size_budget_bytes: SIZE_BUDGET_MAX_BYTES,
  };
  return deepMerge(base, overrides);
}

function deepMerge(a, b) {
  if (!plain(b)) return Array.isArray(b) ? b.slice() : a;
  const out = Array.isArray(a) ? a.slice() : { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (plain(v) && plain(a && a[k])) ? deepMerge(a[k], v) : v;
  return out;
}

// ── section validators ────────────────────────────────────────────────────────
function validateArena(arena, errors) {
  if (!unknownKeys(arena, ['bounds', 'scroll', 'background', 'zones'], 'arena', errors)) return;
  inSet(arena.bounds, BOUNDS_MODES, 'arena.bounds', errors);
  inSet(arena.scroll, SCROLL_MODES, 'arena.scroll', errors);
  inSet(arena.background, BACKGROUNDS, 'arena.background', errors);
  const zones = arena.zones;
  if (!Array.isArray(zones)) { errors.push('arena.zones must be an array'); return; }
  if (zones.length > CAPS.MAX_ZONES) errors.push(`arena.zones exceeds cap (${CAPS.MAX_ZONES})`);
  const ids = new Set();
  zones.forEach((z, i) => {
    const at = `arena.zones[${i}]`;
    if (!unknownKeys(z, ['id', 'kind', 'x', 'y', 'w', 'h'], at, errors)) return;
    if (typeof z.id !== 'string' || !SLUG_RE.test(z.id)) errors.push(`${at}.id must be a short slug`);
    else if (ids.has(z.id)) errors.push(`${at}.id duplicate '${z.id}'`); else ids.add(z.id);
    inSet(z.kind, ZONE_KINDS, `${at}.kind`, errors);
    numInRange(z.x, 0, 1, `${at}.x`, errors);
    numInRange(z.y, 0, 1, `${at}.y`, errors);
    numInRange(z.w, 0.02, 1, `${at}.w`, errors);
    numInRange(z.h, 0.02, 1, `${at}.h`, errors);
  });
}

function validatePlayer(player, errors) {
  if (!unknownKeys(player, ['control', 'speed', 'lives', 'size', 'shape'], 'player', errors)) return;
  inSet(player.control, PLAYER_CONTROLS, 'player.control', errors);
  inSet(player.speed, SPEED_TIERS, 'player.speed', errors);
  intInRange(player.lives, 1, CAPS.MAX_LIVES, 'player.lives', errors);
  inSet(player.size, SIZE_TIERS, 'player.size', errors);
  inSet(player.shape, SHAPES, 'player.shape', errors);
}

function validateObjective(obj, zoneIds, waveIds, errors) {
  if (!unknownKeys(obj, ['type', 'target_count', 'score_threshold', 'duration_s', 'combo_target', 'max_hits', 'route_zone_ids'], 'objective', errors)) return;
  if (!inSet(obj.type, OBJECTIVE_TYPES, 'objective.type', errors)) return;
  switch (obj.type) {
    case 'survive_timer': intInRange(obj.duration_s, CAPS.MIN_ROUND_S, CAPS.MAX_ROUND_S, 'objective.duration_s', errors); break;
    case 'reach_goal': break; // satisfied by a 'goal' zone or goal_marker collision (validated below)
    case 'collect_targets': intInRange(obj.target_count, 1, CAPS.MAX_TARGET_COUNT, 'objective.target_count', errors); break;
    case 'clear_waves': break; // satisfied when all waves are exhausted
    case 'timed_route': {
      intInRange(obj.duration_s, CAPS.MIN_ROUND_S, CAPS.MAX_ROUND_S, 'objective.duration_s', errors);
      if (!Array.isArray(obj.route_zone_ids) || obj.route_zone_ids.length < 2 || obj.route_zone_ids.length > CAPS.MAX_ZONES) {
        errors.push('objective.route_zone_ids must be 2..' + CAPS.MAX_ZONES + ' zone ids');
      } else for (const zid of obj.route_zone_ids) if (!zoneIds.has(zid)) errors.push(`objective.route_zone_ids references unknown zone '${zid}'`);
      break;
    }
    case 'score_threshold': intInRange(obj.score_threshold, 1, CAPS.MAX_SCORE_THRESHOLD, 'objective.score_threshold', errors); break;
    case 'combo_chain': intInRange(obj.combo_target, 2, CAPS.MAX_COMBO, 'objective.combo_target', errors); break;
    case 'avoid_hits': {
      intInRange(obj.max_hits, 0, CAPS.MAX_COMBO, 'objective.max_hits', errors);
      intInRange(obj.duration_s, CAPS.MIN_ROUND_S, CAPS.MAX_ROUND_S, 'objective.duration_s', errors);
      break;
    }
    default: break;
  }
}

function validateScoring(s, errors) {
  if (!unknownKeys(s, ['on_pickup', 'on_enemy_clear', 'survive_per_s', 'combo_cap'], 'scoring', errors)) return;
  intInRange(s.on_pickup, 0, CAPS.MAX_SCORE_VALUE, 'scoring.on_pickup', errors);
  intInRange(s.on_enemy_clear, 0, CAPS.MAX_SCORE_VALUE, 'scoring.on_enemy_clear', errors);
  intInRange(s.survive_per_s, 0, CAPS.MAX_SCORE_VALUE, 'scoring.survive_per_s', errors);
  intInRange(s.combo_cap, 1, CAPS.MAX_COMBO, 'scoring.combo_cap', errors);
}

function validateEntities(entities, errors) {
  const ids = new Set();
  if (!Array.isArray(entities)) { errors.push('entities must be an array'); return ids; }
  if (entities.length > CAPS.MAX_ENTITY_TYPES) errors.push(`entities exceeds type cap (${CAPS.MAX_ENTITY_TYPES})`);
  let liveTotal = 0;
  entities.forEach((e, i) => {
    const at = `entities[${i}]`;
    if (!unknownKeys(e, ['id', 'kind', 'shape', 'color', 'size', 'movement', 'speed', 'max_count', 'collision', 'lifetime_s', 'score_value'], at, errors)) return;
    if (typeof e.id !== 'string' || !SLUG_RE.test(e.id)) errors.push(`${at}.id must be a short slug`);
    else if (ids.has(e.id)) errors.push(`${at}.id duplicate '${e.id}'`); else ids.add(e.id);
    inSet(e.kind, ENTITY_KINDS, `${at}.kind`, errors);
    inSet(e.shape, SHAPES, `${at}.shape`, errors);
    inSet(e.color, PALETTE_KEYS, `${at}.color`, errors);
    inSet(e.size, SIZE_TIERS, `${at}.size`, errors);
    inSet(e.movement, MOVEMENT_PATTERNS, `${at}.movement`, errors);
    inSet(e.speed, SPEED_TIERS, `${at}.speed`, errors);
    inSet(e.collision, COLLISION_BEHAVIORS, `${at}.collision`, errors);
    if (intInRange(e.max_count, 1, CAPS.MAX_PER_TYPE_COUNT, `${at}.max_count`, errors)) liveTotal += e.max_count;
    intInRange(e.lifetime_s, 0, 60, `${at}.lifetime_s`, errors);
    intInRange(e.score_value, 0, CAPS.MAX_SCORE_VALUE, `${at}.score_value`, errors);
  });
  if (liveTotal > CAPS.MAX_LIVE_ENTITIES) errors.push(`sum of entities.max_count (${liveTotal}) exceeds live cap (${CAPS.MAX_LIVE_ENTITIES})`);
  return ids;
}

function validateWaves(waves, entityIds, errors) {
  const ids = new Set();
  if (!Array.isArray(waves)) { errors.push('waves must be an array'); return ids; }
  if (waves.length > CAPS.MAX_WAVES) errors.push(`waves exceeds cap (${CAPS.MAX_WAVES})`);
  waves.forEach((w, i) => {
    const at = `waves[${i}]`;
    if (!unknownKeys(w, ['id', 'at_s', 'entity', 'count', 'interval_s', 'from', 'repeat'], at, errors)) return;
    if (typeof w.id !== 'string' || !SLUG_RE.test(w.id)) errors.push(`${at}.id must be a short slug`);
    else if (ids.has(w.id)) errors.push(`${at}.id duplicate '${w.id}'`); else ids.add(w.id);
    numInRange(w.at_s, 0, CAPS.MAX_ROUND_S, `${at}.at_s`, errors);
    if (!entityIds.has(w.entity)) errors.push(`${at}.entity references unknown entity '${w.entity}'`);
    intInRange(w.count, 1, CAPS.MAX_SPAWN_PER_WAVE, `${at}.count`, errors);
    numInRange(w.interval_s, CAPS.MIN_SPAWN_INTERVAL_S, CAPS.MAX_SPAWN_INTERVAL_S, `${at}.interval_s`, errors);
    inSet(w.from, SPAWN_SIDES, `${at}.from`, errors);
    if (typeof w.repeat !== 'boolean') errors.push(`${at}.repeat must be a boolean`);
  });
  return ids;
}

function validateRuleWhen(when, ctx, at, errors) {
  if (!unknownKeys(when, ['event', 'at_s', 'score', 'zone', 'entity', 'wave', 'lives', 'combo'], at, errors)) return;
  if (!inSet(when.event, RULE_EVENTS, `${at}.event`, errors)) return;
  switch (when.event) {
    case 'timer_elapsed': numInRange(when.at_s, 0, CAPS.MAX_ROUND_S, `${at}.at_s`, errors); break;
    case 'score_reached': intInRange(when.score, 1, CAPS.MAX_SCORE_THRESHOLD, `${at}.score`, errors); break;
    case 'player_enters_zone': if (!ctx.zoneIds.has(when.zone)) errors.push(`${at}.zone references unknown zone '${when.zone}'`); break;
    case 'collision_with': if (!ctx.entityIds.has(when.entity)) errors.push(`${at}.entity references unknown entity '${when.entity}'`); break;
    case 'pickup_collected': if (when.entity !== undefined && !ctx.entityIds.has(when.entity)) errors.push(`${at}.entity references unknown entity '${when.entity}'`); break;
    case 'wave_cleared': if (!ctx.waveIds.has(when.wave)) errors.push(`${at}.wave references unknown wave '${when.wave}'`); break;
    case 'lives_changed': intInRange(when.lives, 0, CAPS.MAX_LIVES, `${at}.lives`, errors); break;
    case 'combo_reached': intInRange(when.combo, 1, CAPS.MAX_COMBO, `${at}.combo`, errors); break;
    default: break;
  }
}

function validateRuleThen(then, ctx, at, errors) {
  if (!unknownKeys(then, ['action', 'amount', 'entity', 'count', 'from', 'kind', 'speed', 'fx', 'wave', 'text', 'modifier'], at, errors)) return;
  if (!inSet(then.action, RULE_ACTIONS, `${at}.action`, errors)) return;
  switch (then.action) {
    case 'add_score': intInRange(then.amount, 1, CAPS.MAX_SCORE_VALUE, `${at}.amount`, errors); break;
    case 'sub_life': case 'add_life': intInRange(then.amount, 1, CAPS.MAX_LIVES, `${at}.amount`, errors); break;
    case 'spawn': {
      if (!ctx.entityIds.has(then.entity)) errors.push(`${at}.entity references unknown entity '${then.entity}'`);
      intInRange(then.count, 1, CAPS.MAX_SPAWN_PER_WAVE, `${at}.count`, errors);
      inSet(then.from, SPAWN_SIDES, `${at}.from`, errors);
      break;
    }
    case 'despawn_kind': inSet(then.kind, ENTITY_KINDS, `${at}.kind`, errors); break;
    case 'set_player_speed': inSet(then.speed, SPEED_TIERS, `${at}.speed`, errors); break;
    case 'trigger_fx': inSet(then.fx, FX_KINDS, `${at}.fx`, errors); break;
    case 'start_wave': if (!ctx.waveIds.has(then.wave)) errors.push(`${at}.wave references unknown wave '${then.wave}'`); break;
    case 'end_win': case 'end_lose': break;
    case 'show_message': cleanText(then.text, CAPS.MAX_MESSAGE_LEN, `${at}.text`, errors); break;
    case 'apply_modifier': inSet(then.modifier, MODIFIER_KINDS, `${at}.modifier`, errors); break;
    default: break;
  }
}

function validateRules(rules, ctx, errors) {
  if (!Array.isArray(rules)) { errors.push('rules must be an array'); return; }
  if (rules.length > CAPS.MAX_RULES) errors.push(`rules exceeds cap (${CAPS.MAX_RULES})`);
  const ids = new Set();
  rules.forEach((r, i) => {
    const at = `rules[${i}]`;
    if (!unknownKeys(r, ['id', 'when', 'then'], at, errors)) return;
    if (typeof r.id !== 'string' || !SLUG_RE.test(r.id)) errors.push(`${at}.id must be a short slug`);
    else if (ids.has(r.id)) errors.push(`${at}.id duplicate '${r.id}'`); else ids.add(r.id);
    if (!plain(r.when)) errors.push(`${at}.when must be an object`); else validateRuleWhen(r.when, ctx, `${at}.when`, errors);
    if (!plain(r.then)) errors.push(`${at}.then must be an object`); else validateRuleThen(r.then, ctx, `${at}.then`, errors);
  });
}

function validateModifiers(m, errors) {
  if (!unknownKeys(m, ['difficulty_ramp', 'replay_variation'], 'modifiers', errors)) return;
  inSet(m.difficulty_ramp, DIFFICULTY_RAMPS, 'modifiers.difficulty_ramp', errors);
  if (typeof m.replay_variation !== 'boolean') errors.push('modifiers.replay_variation must be a boolean');
}

function validateTheme(t, errors) {
  if (!unknownKeys(t, ['palette', 'particles', 'shake', 'contrast'], 'theme', errors)) return;
  inSet(t.palette, PALETTE_KEYS, 'theme.palette', errors);
  inSet(t.particles, FX_LEVELS, 'theme.particles', errors);
  inSet(t.shake, FX_LEVELS, 'theme.shake', errors);
  inSet(t.contrast, CONTRAST, 'theme.contrast', errors);
}

function validateAccessibility(a, errors) {
  if (!unknownKeys(a, ['reduced_motion', 'contrast', 'mobile_controls', 'keyboard_controls', 'color_independent_signals'], 'accessibility', errors)) return;
  if (a.reduced_motion !== 'supported') errors.push('accessibility.reduced_motion must be supported');
  inSet(a.contrast, CONTRAST, 'accessibility.contrast', errors);
  inSet(a.mobile_controls, MOBILE_CONTROLS, 'accessibility.mobile_controls', errors);
  if (a.keyboard_controls !== 'arrows') errors.push("accessibility.keyboard_controls must be 'arrows'");
  if (a.color_independent_signals !== true) errors.push('accessibility.color_independent_signals must be true');
}

/** Cross-section reachability: every objective must have a way to be satisfied by the graph. */
function validateObjectiveReachable(graph, entityIds, errors) {
  const obj = graph.objective || {};
  const collisions = (graph.entities || []).map((e) => e.collision);
  const kinds = (graph.entities || []).map((e) => e.kind);
  const zoneKinds = ((graph.arena && graph.arena.zones) || []).map((z) => z.kind);
  const ruleActions = (graph.rules || []).map((r) => r.then && r.then.action);
  const hasWinRule = ruleActions.includes('end_win');
  if (obj.type === 'reach_goal' && !(zoneKinds.includes('goal') || collisions.includes('goal') || kinds.includes('goal_marker'))) {
    errors.push("objective 'reach_goal' needs a 'goal' zone, a goal_marker entity, or an entity with collision 'goal'");
  }
  if (obj.type === 'collect_targets' && !collisions.includes('collect')) {
    errors.push("objective 'collect_targets' needs at least one entity with collision 'collect'");
  }
  if (obj.type === 'clear_waves' && (graph.waves || []).length === 0) {
    errors.push("objective 'clear_waves' needs at least one wave");
  }
  // survive_timer / avoid_hits / timed_route end via their own timer; an explicit end_win rule is optional.
  void hasWinRule;
}

/**
 * PURE: validate a creator-authored Free Sandbox graph. Returns { ok, errors }. Fail-closed:
 * deny-by-default capabilities, closed enums, hard caps, no urls/code/economy vocabulary, reachable objective.
 */
export function validateFreeSandboxGraph(graph) {
  const errors = [];
  if (!plain(graph)) return { ok: false, errors: ['graph must be a plain object'] };
  unknownKeys(graph, TOP_KEYS, 'graph', errors);
  for (const k of TOP_KEYS) if (!(k in graph)) errors.push(`graph: missing key '${k}'`);

  if (graph.schema_version !== FREE_SANDBOX_SCHEMA_VERSION) errors.push(`schema_version must be ${FREE_SANDBOX_SCHEMA_VERSION}`);
  if (graph.package_kind !== FREE_SANDBOX_PACKAGE_KIND) errors.push(`package_kind must be ${FREE_SANDBOX_PACKAGE_KIND}`);
  if (graph.game_kind !== FREE_SANDBOX_GAME_KIND) errors.push(`game_kind must be ${FREE_SANDBOX_GAME_KIND}`);
  if (typeof graph.template !== 'string' || !SLUG_RE.test(graph.template)) errors.push('template must be a short slug');
  if (!(typeof graph.package_id === 'string' && PACKAGE_ID_RE.test(graph.package_id) && !FORBIDDEN_TERMS_RE.test(graph.package_id))) errors.push('package_id must be a clean kebab slug (3-48 chars)');
  cleanText(graph.display_name, DISPLAY_NAME_MAX, 'display_name', errors);
  if (!FRAME_CONTRACTS.includes(graph.frame_contract_id)) errors.push(`frame_contract_id must be one of: ${FRAME_CONTRACTS.join(', ')}`);
  intInRange(graph.seed, 1, 999999, 'seed', errors);
  if (typeof graph.size_budget_bytes !== 'number' || !Number.isInteger(graph.size_budget_bytes)
    || graph.size_budget_bytes < SIZE_BUDGET_MIN_BYTES || graph.size_budget_bytes > SIZE_BUDGET_MAX_BYTES) {
    errors.push(`size_budget_bytes must be ${SIZE_BUDGET_MIN_BYTES}..${SIZE_BUDGET_MAX_BYTES}`);
  }

  if (!plain(graph.arena)) errors.push('arena must be an object'); else validateArena(graph.arena, errors);
  if (!plain(graph.player)) errors.push('player must be an object'); else validatePlayer(graph.player, errors);
  if (!plain(graph.scoring)) errors.push('scoring must be an object'); else validateScoring(graph.scoring, errors);
  const entityIds = plain(graph.entities) || Array.isArray(graph.entities) ? validateEntities(graph.entities, errors) : (errors.push('entities must be an array'), new Set());
  const zoneIds = new Set((plain(graph.arena) && Array.isArray(graph.arena.zones) ? graph.arena.zones : []).map((z) => z && z.id).filter(Boolean));
  const waveIds = validateWaves(graph.waves, entityIds, errors);
  if (!plain(graph.objective)) errors.push('objective must be an object'); else validateObjective(graph.objective, zoneIds, waveIds, errors);
  validateRules(graph.rules, { entityIds, zoneIds, waveIds }, errors);
  if (!plain(graph.modifiers)) errors.push('modifiers must be an object'); else validateModifiers(graph.modifiers, errors);
  if (!plain(graph.theme)) errors.push('theme must be an object'); else validateTheme(graph.theme, errors);
  if (!plain(graph.accessibility)) errors.push('accessibility must be an object'); else validateAccessibility(graph.accessibility, errors);

  // capabilities: deny-by-default — every flag must be present and false
  if (!plain(graph.capabilities)) errors.push('capabilities must be an object');
  else {
    unknownKeys(graph.capabilities, CAPABILITY_KEYS, 'capabilities', errors);
    for (const k of CAPABILITY_KEYS) if (graph.capabilities[k] !== false) errors.push(`capabilities.${k} must be false`);
  }

  if (errors.length === 0) validateObjectiveReachable(graph, entityIds, errors);
  scanStrings(graph, errors);
  return { ok: errors.length === 0, errors };
}

/**
 * PURE: the minimal RUNTIME slice of a graph the interpreter needs, with metadata + capabilities
 * stripped. This is what gets embedded as `const GRAPH = {...}` in the generated game.mjs, so the
 * embedded source carries only closed-vocab gameplay data (no capability key names, no free metadata).
 */
export function runtimeGraph(graph) {
  return {
    seed: graph.seed,
    arena: graph.arena,
    player: graph.player,
    objective: graph.objective,
    scoring: graph.scoring,
    entities: graph.entities,
    waves: graph.waves,
    rules: graph.rules,
    modifiers: graph.modifiers,
    theme: graph.theme,
  };
}
