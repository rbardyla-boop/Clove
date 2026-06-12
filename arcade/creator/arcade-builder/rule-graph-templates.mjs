/**
 * Creator Foundation CF-4A — RULE-GRAPH BUILDER FOUNDATION (Reaction Lane only).
 *
 * Pure, local-only generation core. Creators author closed JSON rule graphs, not
 * arbitrary JavaScript. This module validates that graph, then deterministically
 * generates the existing CF-4 arcade package shape (manifest + game.mjs +
 * adapter.mjs) so the importer and local sandbox remain the authority.
 *
 * No live-world load, no network/storage/assets, no ticket/prize/ledger hooks.
 */
import { SIZE_BUDGET_MIN_BYTES, SCHEMA_VERSION, PACKAGE_KIND } from '../schemas/arcade-game-package-schema.mjs';
import { PACKAGE_ID_RE, DISPLAY_NAME_MAX, FRAME_CONTRACTS } from '../schemas/arcade-game-package-schema.mjs';
import { utf8Bytes, FORBIDDEN_TERMS_RE } from '../validator/validation-report.mjs';
import { ACCENTS, DEFAULT_FRAME, adapterSource } from './cabinet-templates.mjs';

export const RULE_GRAPH_KIND = 'arcade_rule_graph';
export const REACTION_LANE_TEMPLATE = 'reaction_lane';

export const LANE_COUNTS = Object.freeze([2, 3, 4, 5]);
export const SPAWN_CADENCE_MS = Object.freeze([450, 650, 850, 1100]);
export const HIT_WINDOW_MS = Object.freeze([120, 180, 240, 320]);
export const TARGET_COUNTS = Object.freeze([10, 16, 24, 32]);
export const COMBO_CAPS = Object.freeze([1, 3, 5, 8]);
export const MISS_LIMITS = Object.freeze([3, 5, 8, 10]);
export const DIFFICULTY_RAMPS = Object.freeze(['none', 'gentle', 'standard']);
export const PARTICLE_EFFECTS = Object.freeze(['off', 'soft', 'arcade']);
export const SCREEN_SHAKE = Object.freeze(['off', 'soft', 'arcade']);
export const CONTRAST = Object.freeze(['standard', 'high']);
export const MOBILE_CONTROLS = Object.freeze(['tap_lanes', 'tap_or_swipe_lanes']);

const ALLOWED_TOP_KEYS = Object.freeze([
  'schema_version', 'package_kind', 'game_kind', 'template', 'package_id', 'display_name',
  'frame_contract_id', 'rules', 'layout', 'visuals', 'accessibility', 'capabilities', 'size_budget_bytes',
]);
const REQUIRED_TOP_KEYS = Object.freeze([
  'schema_version', 'package_kind', 'game_kind', 'template', 'package_id', 'display_name',
  'frame_contract_id', 'rules', 'layout', 'visuals', 'accessibility', 'capabilities', 'size_budget_bytes',
]);
const RULE_KEYS = Object.freeze(['objective', 'input', 'scoring', 'timer', 'fail']);
const OBJECTIVE_KEYS = Object.freeze(['type', 'target_count']);
const INPUT_KEYS = Object.freeze(['grammar']);
const SCORING_KEYS = Object.freeze(['type', 'combo_cap']);
const TIMER_KEYS = Object.freeze(['round_length_s', 'spawn_cadence_ms', 'hit_window_ms', 'difficulty_ramp']);
const FAIL_KEYS = Object.freeze(['miss_limit']);
const LAYOUT_KEYS = Object.freeze(['frame', 'lane_count', 'spawn_pattern', 'ui_placement']);
const VISUAL_KEYS = Object.freeze(['palette', 'target_shape', 'background_pattern', 'particle_effects', 'screen_shake', 'contrast']);
const ACCESS_KEYS = Object.freeze(['reduced_motion', 'contrast', 'mobile_controls', 'keyboard_controls', 'color_independent_signals']);
const CAPABILITY_KEYS = Object.freeze([
  'network', 'storage', 'external_assets', 'dom_escape', 'arbitrary_code',
  'live_world_authorized', 'ticket_hooks', 'prize_hooks', 'ledger_hooks',
]);

function plain(o) { return !!o && typeof o === 'object' && !Array.isArray(o) && Object.getPrototypeOf(o) === Object.prototype; }
function unknownKeys(obj, allowed, at, errors) {
  if (!plain(obj)) { errors.push(`${at} must be an object`); return; }
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) errors.push(`${at}: unknown key ${k}`);
}
function inSet(value, set, label, errors) {
  if (!set.includes(value)) errors.push(`${label} must be one of ${set.join('|')}`);
}
function isCleanText(value, maxBytes, label, errors) {
  if (typeof value !== 'string' || utf8Bytes(value) > maxBytes || FORBIDDEN_TERMS_RE.test(value) || /https?:|wss?:|data:|blob:|javascript:/i.test(value)) {
    errors.push(`${label} must be clean text <= ${maxBytes} bytes`);
  }
}

function scanCreatorStrings(value, errors, path = 'graph') {
  if (typeof value === 'string') {
    if (/https?:|wss?:|data:|blob:|javascript:|fetch|WebSocket|localStorage|sessionStorage|indexedDB/i.test(value)
      || FORBIDDEN_TERMS_RE.test(value)) {
      errors.push(`${path} contains forbidden vocabulary`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => scanCreatorStrings(item, errors, `${path}[${i}]`));
    return;
  }
  if (plain(value)) {
    for (const [k, v] of Object.entries(value)) scanCreatorStrings(v, errors, `${path}.${k}`);
  }
}

/** PURE: a conservative default graph that exercises every required CF-4A rail. */
export function defaultReactionLaneGraph(overrides = {}) {
  const base = {
    schema_version: 1,
    package_kind: 'arcade_game_rule_graph',
    game_kind: RULE_GRAPH_KIND,
    template: REACTION_LANE_TEMPLATE,
    package_id: 'reaction-lane-demo',
    display_name: 'Reaction Lane Demo',
    frame_contract_id: DEFAULT_FRAME,
    rules: {
      objective: { type: 'clear_targets', target_count: 16 },
      input: { grammar: 'tap_or_swipe_lanes' },
      scoring: { type: 'bounded_combo', combo_cap: 5 },
      timer: { round_length_s: 45, spawn_cadence_ms: 650, hit_window_ms: 180, difficulty_ramp: 'gentle' },
      fail: { miss_limit: 5 },
    },
    layout: { frame: DEFAULT_FRAME, lane_count: 3, spawn_pattern: 'center_out', ui_placement: 'cabinet_safe' },
    visuals: { palette: 'cyan', target_shape: 'signal_rings', background_pattern: 'lane_grid', particle_effects: 'soft', screen_shake: 'soft', contrast: 'high' },
    accessibility: { reduced_motion: 'supported', contrast: 'high', mobile_controls: 'tap_or_swipe_lanes', keyboard_controls: 'lane_keys', color_independent_signals: true },
    capabilities: {
      network: false, storage: false, external_assets: false, dom_escape: false, arbitrary_code: false,
      live_world_authorized: false, ticket_hooks: false, prize_hooks: false, ledger_hooks: false,
    },
    size_budget_bytes: SIZE_BUDGET_MIN_BYTES * 32,
  };
  return deepMerge(base, overrides);
}

function deepMerge(a, b) {
  const out = { ...a };
  if (!plain(b)) return out;
  for (const [k, v] of Object.entries(b)) {
    out[k] = plain(v) && plain(a[k]) ? deepMerge(a[k], v) : v;
  }
  return out;
}

/** PURE: validate the creator-authored rule graph before generation. */
export function validateReactionLaneGraph(graph) {
  const errors = [];
  if (!plain(graph)) return { ok: false, errors: ['rule graph must be a plain object'] };
  unknownKeys(graph, ALLOWED_TOP_KEYS, 'graph', errors);
  for (const k of REQUIRED_TOP_KEYS) if (!(k in graph)) errors.push(`graph: missing key ${k}`);

  if (graph.schema_version !== 1) errors.push('schema_version must be 1');
  if (graph.package_kind !== 'arcade_game_rule_graph') errors.push('package_kind must be arcade_game_rule_graph');
  if (graph.game_kind !== RULE_GRAPH_KIND) errors.push(`game_kind must be ${RULE_GRAPH_KIND}`);
  if (graph.template !== REACTION_LANE_TEMPLATE) errors.push(`template must be ${REACTION_LANE_TEMPLATE}`);
  if (!(typeof graph.package_id === 'string' && PACKAGE_ID_RE.test(graph.package_id) && !FORBIDDEN_TERMS_RE.test(graph.package_id))) errors.push('package_id must be a clean kebab slug');
  isCleanText(graph.display_name, DISPLAY_NAME_MAX, 'display_name', errors);
  if (!FRAME_CONTRACTS.includes(graph.frame_contract_id)) errors.push(`frame_contract_id must be one of ${FRAME_CONTRACTS.join('|')}`);
  if (typeof graph.size_budget_bytes !== 'number' || !Number.isInteger(graph.size_budget_bytes) || graph.size_budget_bytes < SIZE_BUDGET_MIN_BYTES || graph.size_budget_bytes > 65536) errors.push('size_budget_bytes out of range');

  unknownKeys(graph.rules, RULE_KEYS, 'rules', errors);
  unknownKeys(graph.rules?.objective, OBJECTIVE_KEYS, 'rules.objective', errors);
  unknownKeys(graph.rules?.input, INPUT_KEYS, 'rules.input', errors);
  unknownKeys(graph.rules?.scoring, SCORING_KEYS, 'rules.scoring', errors);
  unknownKeys(graph.rules?.timer, TIMER_KEYS, 'rules.timer', errors);
  unknownKeys(graph.rules?.fail, FAIL_KEYS, 'rules.fail', errors);
  if (graph.rules?.objective?.type !== 'clear_targets') errors.push('objective.type must be clear_targets');
  inSet(graph.rules?.objective?.target_count, TARGET_COUNTS, 'objective.target_count', errors);
  inSet(graph.rules?.input?.grammar, MOBILE_CONTROLS, 'input.grammar', errors);
  if (graph.rules?.scoring?.type !== 'bounded_combo') errors.push('scoring.type must be bounded_combo');
  inSet(graph.rules?.scoring?.combo_cap, COMBO_CAPS, 'scoring.combo_cap', errors);
  const round = graph.rules?.timer?.round_length_s;
  if (!Number.isInteger(round) || round < 15 || round > 90) errors.push('timer.round_length_s must be 15..90');
  inSet(graph.rules?.timer?.spawn_cadence_ms, SPAWN_CADENCE_MS, 'timer.spawn_cadence_ms', errors);
  inSet(graph.rules?.timer?.hit_window_ms, HIT_WINDOW_MS, 'timer.hit_window_ms', errors);
  inSet(graph.rules?.timer?.difficulty_ramp, DIFFICULTY_RAMPS, 'timer.difficulty_ramp', errors);
  inSet(graph.rules?.fail?.miss_limit, MISS_LIMITS, 'fail.miss_limit', errors);

  unknownKeys(graph.layout, LAYOUT_KEYS, 'layout', errors);
  if (graph.layout?.frame !== graph.frame_contract_id) errors.push('layout.frame must match frame_contract_id');
  inSet(graph.layout?.lane_count, LANE_COUNTS, 'layout.lane_count', errors);
  inSet(graph.layout?.spawn_pattern, ['center_out', 'left_right', 'random_bag'], 'layout.spawn_pattern', errors);
  if (graph.layout?.ui_placement !== 'cabinet_safe') errors.push('layout.ui_placement must be cabinet_safe');

  unknownKeys(graph.visuals, VISUAL_KEYS, 'visuals', errors);
  if (!(graph.visuals?.palette in ACCENTS)) errors.push('visuals.palette must be a closed palette');
  inSet(graph.visuals?.target_shape, ['signal_rings', 'solid_tiles', 'chevrons'], 'visuals.target_shape', errors);
  inSet(graph.visuals?.background_pattern, ['lane_grid', 'soft_scanlines', 'plain'], 'visuals.background_pattern', errors);
  inSet(graph.visuals?.particle_effects, PARTICLE_EFFECTS, 'visuals.particle_effects', errors);
  inSet(graph.visuals?.screen_shake, SCREEN_SHAKE, 'visuals.screen_shake', errors);
  inSet(graph.visuals?.contrast, CONTRAST, 'visuals.contrast', errors);

  unknownKeys(graph.accessibility, ACCESS_KEYS, 'accessibility', errors);
  if (graph.accessibility?.reduced_motion !== 'supported') errors.push('accessibility.reduced_motion must be supported');
  inSet(graph.accessibility?.contrast, CONTRAST, 'accessibility.contrast', errors);
  inSet(graph.accessibility?.mobile_controls, MOBILE_CONTROLS, 'accessibility.mobile_controls', errors);
  if (graph.accessibility?.keyboard_controls !== 'lane_keys') errors.push('accessibility.keyboard_controls must be lane_keys');
  if (graph.accessibility?.color_independent_signals !== true) errors.push('accessibility.color_independent_signals must be true');

  unknownKeys(graph.capabilities, CAPABILITY_KEYS, 'capabilities', errors);
  for (const k of CAPABILITY_KEYS) if (graph.capabilities?.[k] !== false) errors.push(`capabilities.${k} must be false`);

  scanCreatorStrings(graph, errors);
  return { ok: errors.length === 0, errors };
}

function n(v) { return String(Number(v)); }
function q(v) { return JSON.stringify(String(v)); }

/** PURE: deterministic generated game source for a validated Reaction Lane graph. */
export function reactionLaneGameSource(graph) {
  const g = defaultReactionLaneGraph(graph);
  const lanes = g.layout.lane_count;
  const targetCount = g.rules.objective.target_count;
  const spawnMs = g.rules.timer.spawn_cadence_ms;
  const hitMs = g.rules.timer.hit_window_ms;
  const roundS = g.rules.timer.round_length_s;
  const missLimit = g.rules.fail.miss_limit;
  const comboCap = g.rules.scoring.combo_cap;
  const accent = ACCENTS[g.visuals.palette] || ACCENTS.cyan;
  const highContrast = g.visuals.contrast === 'high' || g.accessibility.contrast === 'high';
  const particleLevel = { off: 0, soft: 1, arcade: 2 }[g.visuals.particle_effects] || 0;
  const shakeLevel = { off: 0, soft: 1, arcade: 2 }[g.visuals.screen_shake] || 0;
  const swipe = g.rules.input.grammar === 'tap_or_swipe_lanes';
  const spawnPattern = g.layout.spawn_pattern;
  return [
    '/** Generated by CF-4A Reaction Lane rule graph. Local sandbox only. */',
    'export function createGame() {',
    '  let w = 360, h = 640, t = 0, score = 0, combo = 0, hits = 0, misses = 0, over = false;',
    '  let lane = 0, targetLane = 0, targetBorn = 0, spawnAt = 0, seed = 7, downX = 0;',
    '  const LANES = ' + n(lanes) + ', TARGETS = ' + n(targetCount) + ', SPAWN = ' + n(spawnMs / 1000) + ', HOT = ' + n(hitMs / 1000) + ';',
    '  const ROUND = ' + n(roundS) + ', MISS_LIMIT = ' + n(missLimit) + ', COMBO_CAP = ' + n(comboCap) + ';',
    '  const ACCENT = ' + q(accent) + ';',
    '  const HIGH = ' + (highContrast ? 'true' : 'false') + ';',
    '  const SWIPE = ' + (swipe ? 'true' : 'false') + ';',
    '  const PATTERN = ' + q(spawnPattern) + ';',
    '  const RM = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;',
    '  const FX = RM ? 0 : ' + n(particleLevel) + ', SHAKE = RM ? 0 : ' + n(shakeLevel) + ';',
    '  const MAXP = FX === 2 ? 48 : (FX === 1 ? 24 : 0);',
    '  const px = [], py = [], vx = [], vy = [], life = []; let pi = 0, flash = 0, shake = 0;',
    '  function rnd() { seed = (seed * 1103515245 + 12345) & 2147483647; return seed / 2147483647; }',
    '  function pickLane() {',
    '    if (PATTERN === "center_out") return Math.abs((hits + misses) % (LANES * 2 - 2) - (LANES - 1));',
    '    if (PATTERN === "left_right") return (hits + misses) % LANES;',
    '    return Math.floor(rnd() * LANES);',
    '  }',
    '  function spawn() { targetLane = pickLane(); targetBorn = t; spawnAt = t + SPAWN; }',
    '  function burst(x, y) {',
    '    if (!MAXP) return;',
    '    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; px[pi] = x; py[pi] = y; vx[pi] = Math.cos(a) * 80; vy[pi] = Math.sin(a) * 80; life[pi] = 0.45; pi = (pi + 1) % MAXP; }',
    '    flash = 0.18; if (SHAKE) shake = SHAKE === 2 ? 0.22 : 0.12;',
    '  }',
    '  function hit(l) {',
    '    if (over) return;',
    '    const timely = Math.abs(t - targetBorn) <= HOT;',
    '    if (l === targetLane && timely) { combo = Math.min(COMBO_CAP, combo + 1); score += 1 + combo; hits++; burst((targetLane + 0.5) * w / LANES, h * 0.48); if (hits >= TARGETS) over = true; spawn(); }',
    '    else { combo = 0; misses++; if (misses >= MISS_LIMIT) over = true; }',
    '  }',
    '  function laneFrom(x) { return Math.max(0, Math.min(LANES - 1, Math.floor((x / Math.max(1, w)) * LANES))); }',
    '  function stepFx(dt) { for (let i = 0; i < MAXP; i++) if (life[i] > 0) { life[i] -= dt; px[i] += vx[i] * dt; py[i] += vy[i] * dt; } if (flash > 0) flash -= dt; if (shake > 0) shake -= dt; }',
    '  return {',
    '    init(frame) { w = frame.width; h = frame.height; t = 0; score = 0; combo = 0; hits = 0; misses = 0; over = false; seed = 7; spawn(); },',
    '    tick(dt) { if (over) return; t += dt; stepFx(dt); if (t >= ROUND) over = true; if (t > spawnAt) { misses++; combo = 0; if (misses >= MISS_LIMIT) over = true; spawn(); } },',
    '    onInput(ev) {',
    '      if (!ev || over) return;',
    '      const x = typeof ev.x === "number" ? ev.x : w / 2;',
    '      if (ev.type === "press") { downX = x; lane = laneFrom(x); }',
    '      if (ev.type === "move" && SWIPE) lane = laneFrom(x);',
    '      if (ev.type === "tap") hit(laneFrom(x));',
    '      if (ev.type === "release") hit(SWIPE ? laneFrom(x) : lane);',
    '    },',
    '    render(ctx) {',
    '      ctx.save(); if (shake > 0) ctx.translate(Math.sin(t * 80) * shake * 12, Math.cos(t * 70) * shake * 8);',
    '      ctx.clearRect(0, 0, w, h); ctx.fillStyle = HIGH ? "#050505" : "#050816"; ctx.fillRect(0, 0, w, h);',
    '      for (let i = 0; i < LANES; i++) { const x = i * w / LANES; ctx.strokeStyle = HIGH ? "#ffffff" : ACCENT; ctx.globalAlpha = i === targetLane ? 0.95 : 0.25; ctx.lineWidth = i === targetLane ? 4 : 2; ctx.strokeRect(x + 4, h * 0.18, w / LANES - 8, h * 0.6); }',
    '      const cx = (targetLane + 0.5) * w / LANES, cy = h * 0.48, pulse = Math.max(0.3, 1 - Math.abs(t - targetBorn) / Math.max(HOT, 0.01));',
    '      ctx.globalAlpha = 1; ctx.fillStyle = HIGH ? "#ffffff" : ACCENT; ctx.beginPath(); ctx.arc(cx, cy, 14 + pulse * 16, 0, Math.PI * 2); ctx.fill();',
    '      ctx.strokeStyle = HIGH ? ACCENT : "#ffffff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI * 2); ctx.stroke();',
    '      ctx.fillStyle = HIGH ? "#ffffff" : ACCENT; ctx.font = "16px monospace"; ctx.fillText("hits " + hits + "/" + TARGETS + "  misses " + misses + "/" + MISS_LIMIT, 12, 28);',
    '      for (let i = 0; i < MAXP; i++) if (life[i] > 0) { ctx.globalAlpha = Math.max(0, life[i] * 2); ctx.fillRect(px[i] - 2, py[i] - 2, 4, 4); }',
    '      if (flash > 0) { ctx.globalAlpha = flash * 0.5; ctx.fillRect(0, 0, w, h); }',
    '      ctx.restore();',
    '    },',
    '    proposeResult() { return { proposed_score: score, public_safe: true }; },',
    '  };',
    '}',
  ].join('\n');
}

/** PURE: graph -> existing CF-4 arcade package. */
export function buildReactionLanePackage(graph) {
  const rule_graph = defaultReactionLaneGraph(graph);
  const validation = validateReactionLaneGraph(rule_graph);
  const manifest = {
    schema_version: SCHEMA_VERSION,
    package_kind: PACKAGE_KIND,
    package_id: rule_graph.package_id,
    display_name: rule_graph.display_name,
    frame_contract_id: rule_graph.frame_contract_id,
    entry: 'game.mjs',
    adapter: 'adapter.mjs',
    assets: [],
    capabilities: [],
    size_budget_bytes: rule_graph.size_budget_bytes,
  };
  const files = {
    'game.mjs': reactionLaneGameSource(rule_graph),
    'adapter.mjs': adapterSource(),
  };
  return { manifest, files, rule_graph, graphValidation: validation, template: REACTION_LANE_TEMPLATE };
}
