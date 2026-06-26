/**
 * Creator Freedom v1 — FREE SANDBOX generator + example library (pure + cross-env).
 *
 * Turns a validated Free Sandbox graph into a STANDARD arcade_game package: the generated game.mjs is
 * `const GRAPH = {<runtime slice>}` + the FIXED interpreter source, and adapter.mjs is the reused SDK
 * adapter. The output passes the EXISTING importer gate (import-arcade-package.mjs) and runs in the
 * EXISTING null-origin sandbox — no changes to either. The creator authored DATA, never code.
 *
 * Also ships EXAMPLE_GRAPHS: five materially-different games (survival dodge, collect-and-escape,
 * wave clear, timed route, combo/score) proving the schema expresses distinct mechanics, not reskins.
 */
import { SCHEMA_VERSION, PACKAGE_KIND, SIZE_BUDGET_MAX_BYTES } from '../schemas/arcade-game-package-schema.mjs';
import { defaultFreeSandboxGraph, validateFreeSandboxGraph, runtimeGraph } from '../schemas/free-sandbox-schema.mjs';
import { freeSandboxInterpreterSource } from './free-sandbox-interpreter.mjs';
import { adapterSource } from './cabinet-templates.mjs';

/** PURE: the generated game.mjs source — embedded runtime graph + the fixed interpreter. */
export function freeSandboxGameSource(graph) {
  const rt = runtimeGraph(graph);
  return 'const GRAPH = ' + JSON.stringify(rt) + ';\n' + freeSandboxInterpreterSource() + '\n';
}

/**
 * PURE: validate a graph and assemble a standard arcade_game package from it.
 * Returns { ok, errors, manifest, files, graph }. When ok is false the package is still returned
 * (so the editor can show it) but the importer will also reject it — the gate stays the authority.
 */
export function buildFreeSandboxPackage(graphInput) {
  const graph = defaultFreeSandboxGraph(graphInput || {});
  const validation = validateFreeSandboxGraph(graph);
  const manifest = {
    schema_version: SCHEMA_VERSION,
    package_kind: PACKAGE_KIND, // the OUTPUT is a normal arcade_game package
    package_id: graph.package_id,
    display_name: graph.display_name,
    frame_contract_id: graph.frame_contract_id,
    entry: 'game.mjs',
    adapter: 'adapter.mjs',
    assets: [],
    capabilities: [],
    size_budget_bytes: graph.size_budget_bytes,
  };
  const files = {
    'game.mjs': freeSandboxGameSource(graph),
    'adapter.mjs': adapterSource(),
  };
  return { ok: validation.ok, errors: validation.errors, manifest, files, graph };
}

// ── example library (five materially-different games) ─────────────────────────
const ACCESS = { reduced_motion: 'supported', contrast: 'high', mobile_controls: 'pointer_or_lanes', keyboard_controls: 'arrows', color_independent_signals: true };

export const EXAMPLE_GRAPHS = Object.freeze({
  survival_dodge: defaultFreeSandboxGraph({
    template: 'survival-dodge', package_id: 'survival-dodge', display_name: 'Survival Dodge', seed: 101,
    frame_contract_id: 'cabinet-360x640',
    arena: { bounds: 'clamp', scroll: 'none', background: 'grid', zones: [] },
    player: { control: 'free_move', speed: 'fast', lives: 3, size: 'medium', shape: 'triangle' },
    objective: { type: 'survive_timer', duration_s: 40 },
    scoring: { on_pickup: 0, on_enemy_clear: 0, survive_per_s: 2, combo_cap: 8 },
    entities: [
      { id: 'faller', kind: 'enemy', shape: 'diamond', color: 'magenta', size: 'medium', movement: 'fall', speed: 'medium', max_count: 14, collision: 'damage', lifetime_s: 0, score_value: 0 },
      { id: 'hunter', kind: 'enemy', shape: 'circle', color: 'amber', size: 'small', movement: 'chase', speed: 'slow', max_count: 4, collision: 'damage', lifetime_s: 0, score_value: 0 },
    ],
    waves: [
      { id: 'rain', at_s: 0, entity: 'faller', count: 14, interval_s: 0.7, from: 'top', repeat: true },
      { id: 'hunt', at_s: 12, entity: 'hunter', count: 4, interval_s: 3, from: 'random', repeat: true },
    ],
    rules: [
      { id: 'half', when: { event: 'timer_elapsed', at_s: 20 }, then: { action: 'show_message', text: 'halfway!' } },
      { id: 'win', when: { event: 'timer_elapsed', at_s: 40 }, then: { action: 'end_win' } },
    ],
    modifiers: { difficulty_ramp: 'standard', replay_variation: false },
    theme: { palette: 'cyan', particles: 'soft', shake: 'soft', contrast: 'high' },
    accessibility: ACCESS,
  }),

  collect_and_escape: defaultFreeSandboxGraph({
    template: 'collect-and-escape', package_id: 'collect-and-escape', display_name: 'Collect and Escape', seed: 202,
    arena: { bounds: 'clamp', scroll: 'none', background: 'stars', zones: [{ id: 'danger', kind: 'hazard', x: 0.0, y: 0.0, w: 1.0, h: 0.12 }] },
    player: { control: 'follow_pointer', speed: 'fast', lives: 3, size: 'medium', shape: 'circle' },
    objective: { type: 'collect_targets', target_count: 12 },
    scoring: { on_pickup: 10, on_enemy_clear: 0, survive_per_s: 0, combo_cap: 10 },
    entities: [
      { id: 'orb', kind: 'pickup', shape: 'diamond', color: 'green', size: 'small', movement: 'fall', speed: 'medium', max_count: 8, collision: 'collect', lifetime_s: 0, score_value: 10 },
      { id: 'mine', kind: 'hazard', shape: 'square', color: 'magenta', size: 'medium', movement: 'sine', speed: 'medium', max_count: 5, collision: 'damage', lifetime_s: 0, score_value: 0 },
    ],
    waves: [
      { id: 'drops', at_s: 0, entity: 'orb', count: 12, interval_s: 1.1, from: 'top', repeat: true },
      { id: 'mines', at_s: 4, entity: 'mine', count: 5, interval_s: 2.5, from: 'top', repeat: true },
    ],
    rules: [
      { id: 'near', when: { event: 'score_reached', score: 100 }, then: { action: 'show_message', text: 'almost there!' } },
      { id: 'done', when: { event: 'combo_reached', combo: 8 }, then: { action: 'trigger_fx', fx: 'burst' } },
    ],
    modifiers: { difficulty_ramp: 'gentle', replay_variation: false },
    theme: { palette: 'green', particles: 'arcade', shake: 'soft', contrast: 'high' },
    accessibility: ACCESS,
  }),

  wave_clear: defaultFreeSandboxGraph({
    template: 'wave-clear', package_id: 'wave-clear', display_name: 'Wave Clear', seed: 303,
    arena: { bounds: 'wrap', scroll: 'none', background: 'scanlines', zones: [] },
    player: { control: 'free_move', speed: 'swift', lives: 4, size: 'large', shape: 'square' },
    objective: { type: 'clear_waves' },
    scoring: { on_pickup: 0, on_enemy_clear: 15, survive_per_s: 0, combo_cap: 12 },
    entities: [
      { id: 'spark', kind: 'enemy', shape: 'circle', color: 'amber', size: 'small', movement: 'wander', speed: 'medium', max_count: 12, collision: 'score', lifetime_s: 0, score_value: 15 },
      { id: 'rover', kind: 'enemy', shape: 'triangle', color: 'violet', size: 'medium', movement: 'patrol_x', speed: 'medium', max_count: 8, collision: 'score', lifetime_s: 0, score_value: 25 },
    ],
    waves: [
      { id: 'wave1', at_s: 0, entity: 'spark', count: 12, interval_s: 0.5, from: 'random', repeat: false },
      { id: 'wave2', at_s: 6, entity: 'rover', count: 8, interval_s: 0.7, from: 'left', repeat: false },
    ],
    rules: [
      { id: 'first', when: { event: 'wave_cleared', wave: 'wave1' }, then: { action: 'show_message', text: 'wave 2!' } },
      { id: 'combo', when: { event: 'combo_reached', combo: 6 }, then: { action: 'add_score', amount: 30 } },
    ],
    modifiers: { difficulty_ramp: 'none', replay_variation: false },
    theme: { palette: 'amber', particles: 'arcade', shake: 'arcade', contrast: 'high' },
    accessibility: ACCESS,
  }),

  timed_route: defaultFreeSandboxGraph({
    template: 'timed-route', package_id: 'timed-route', display_name: 'Timed Route', seed: 404,
    arena: {
      bounds: 'clamp', scroll: 'none', background: 'grid', zones: [
        { id: 'a', kind: 'goal', x: 0.06, y: 0.08, w: 0.22, h: 0.12 },
        { id: 'b', kind: 'goal', x: 0.7, y: 0.4, w: 0.22, h: 0.12 },
        { id: 'c', kind: 'goal', x: 0.1, y: 0.78, w: 0.22, h: 0.12 },
      ],
    },
    player: { control: 'follow_pointer', speed: 'swift', lives: 3, size: 'small', shape: 'triangle' },
    objective: { type: 'timed_route', duration_s: 30, route_zone_ids: ['a', 'b', 'c'] },
    scoring: { on_pickup: 0, on_enemy_clear: 0, survive_per_s: 0, combo_cap: 8 },
    entities: [
      { id: 'block', kind: 'hazard', shape: 'square', color: 'magenta', size: 'medium', movement: 'patrol_y', speed: 'medium', max_count: 5, collision: 'damage', lifetime_s: 0, score_value: 0 },
    ],
    waves: [
      { id: 'walls', at_s: 0, entity: 'block', count: 5, interval_s: 1.5, from: 'right', repeat: true },
    ],
    rules: [
      { id: 'go', when: { event: 'player_enters_zone', zone: 'a' }, then: { action: 'add_score', amount: 20 } },
      { id: 'win', when: { event: 'timer_elapsed', at_s: 30 }, then: { action: 'show_message', text: 'time up' } },
    ],
    modifiers: { difficulty_ramp: 'gentle', replay_variation: false },
    theme: { palette: 'violet', particles: 'soft', shake: 'soft', contrast: 'high' },
    accessibility: ACCESS,
  }),

  combo_score: defaultFreeSandboxGraph({
    template: 'combo-score', package_id: 'combo-score', display_name: 'Combo Score', seed: 505,
    arena: { bounds: 'clamp', scroll: 'none', background: 'stars', zones: [] },
    player: { control: 'follow_pointer', speed: 'swift', lives: 3, size: 'medium', shape: 'diamond' },
    objective: { type: 'combo_chain', combo_target: 12 },
    scoring: { on_pickup: 5, on_enemy_clear: 0, survive_per_s: 0, combo_cap: 20 },
    entities: [
      { id: 'spark', kind: 'score_orb', shape: 'circle', color: 'cyan', size: 'small', movement: 'fall', speed: 'fast', max_count: 10, collision: 'score', lifetime_s: 0, score_value: 8 },
      { id: 'dud', kind: 'hazard', shape: 'triangle', color: 'magenta', size: 'small', movement: 'fall', speed: 'fast', max_count: 4, collision: 'damage', lifetime_s: 0, score_value: 0 },
    ],
    waves: [
      { id: 'sparks', at_s: 0, entity: 'spark', count: 30, interval_s: 0.6, from: 'top', repeat: true },
      { id: 'duds', at_s: 3, entity: 'dud', count: 10, interval_s: 1.4, from: 'top', repeat: true },
    ],
    rules: [
      { id: 'roll', when: { event: 'combo_reached', combo: 6 }, then: { action: 'show_message', text: 'combo rolling!' } },
      { id: 'pop', when: { event: 'combo_reached', combo: 12 }, then: { action: 'trigger_fx', fx: 'flash' } },
    ],
    modifiers: { difficulty_ramp: 'standard', replay_variation: false },
    theme: { palette: 'cyan', particles: 'arcade', shake: 'soft', contrast: 'high' },
    accessibility: ACCESS,
  }),
});

/** Static, closed presentation copy for the editor "start from a mechanic" picker. */
export const EXAMPLE_META = Object.freeze([
  { id: 'survival_dodge', name: 'Survival Dodge', pitch: 'Stay alive as hazards rain down. Last the clock.', objective: 'survive_timer' },
  { id: 'collect_and_escape', name: 'Collect and Escape', pitch: 'Grab the orbs, dodge the mines.', objective: 'collect_targets' },
  { id: 'wave_clear', name: 'Wave Clear', pitch: 'Sweep every enemy in each wave to clear the board.', objective: 'clear_waves' },
  { id: 'timed_route', name: 'Timed Route', pitch: 'Hit each checkpoint in order before time runs out.', objective: 'timed_route' },
  { id: 'combo_score', name: 'Combo Score', pitch: 'Chain pickups to build a long combo. Skip the duds.', objective: 'combo_chain' },
]);

export function exampleGraph(id) {
  return EXAMPLE_GRAPHS[id] ? JSON.parse(JSON.stringify(EXAMPLE_GRAPHS[id])) : null;
}
