/**
 * Creator Freedom v1 — FREE SANDBOX editor controller (local, offline, DATA-ONLY).
 *
 * A structured, direct-manipulation editor over the Free Sandbox declarative schema: start blank / from a
 * mechanic / remix; edit arena, player, objective, scoring, entities, waves, WHEN->THEN rules, modifiers,
 * theme; live validation with readable errors; local fingerprint; one-click Test-in-sandbox + local share
 * code. Like the rest of the builder it NEVER executes the game — it only assembles closed-vocab DATA and
 * hands the gated package to the hardened sandbox. No network, no upload, no live world, no tickets.
 *
 * Pure graph-ops are exported for node tests; mountFreeSandboxEditor() builds + wires the DOM (browser).
 */
import {
  defaultFreeSandboxGraph, validateFreeSandboxGraph, runtimeGraph, CAPS,
  PALETTE_KEYS, SPEED_TIERS, SIZE_TIERS, SHAPES, BOUNDS_MODES, SCROLL_MODES, BACKGROUNDS, ZONE_KINDS,
  PLAYER_CONTROLS, ENTITY_KINDS, MOVEMENT_PATTERNS, COLLISION_BEHAVIORS, SPAWN_SIDES,
  OBJECTIVE_TYPES, RULE_EVENTS, RULE_ACTIONS, FX_KINDS, MODIFIER_KINDS, DIFFICULTY_RAMPS, FX_LEVELS, CONTRAST,
} from '../schemas/free-sandbox-schema.mjs';
import { FRAME_CONTRACTS } from '../schemas/arcade-game-package-schema.mjs';
import { buildFreeSandboxPackage, EXAMPLE_META, exampleGraph } from './free-sandbox-templates.mjs';
import { packageHash } from '../validator/package-hash.mjs';

// Keep these literals identical to arcade-builder.mjs / sandbox-runner.mjs (node tests assert the match).
const HANDOFF_KEY = 'cf_builder_sandbox_handoff_v1';
const SHARE_PREFIX = 'NCLOCAL1:';
const SHARE_CODE_MAX_CHARS = 200000;

// ── pure graph helpers (immutable) ────────────────────────────────────────────
const clone = (g) => JSON.parse(JSON.stringify(g));
let idSeq = 0;
function freshId(prefix, used) { let n = 1; let id = prefix + n; const set = new Set(used); while (set.has(id)) { n++; id = prefix + n; } return id; }

export function blankGraph() {
  return defaultFreeSandboxGraph({ template: 'blank', package_id: 'my-sandbox-game', display_name: 'My Sandbox Game', seed: 1 + (idSeq++ % 9000) });
}

export function defaultEntity(graph) {
  const used = (graph.entities || []).map((e) => e.id);
  return { id: freshId('thing', used), kind: 'enemy', shape: 'circle', color: 'magenta', size: 'medium', movement: 'fall', speed: 'medium', max_count: 6, collision: 'damage', lifetime_s: 0, score_value: 0 };
}
export function defaultWave(graph) {
  const used = (graph.waves || []).map((w) => w.id);
  const entity = (graph.entities[0] && graph.entities[0].id) || 'thing1';
  return { id: freshId('wave', used), at_s: 0, entity, count: 6, interval_s: 1, from: 'top', repeat: true };
}
export function defaultRule(graph) {
  const used = (graph.rules || []).map((r) => r.id);
  return { id: freshId('rule', used), when: { event: 'score_reached', score: 50 }, then: { action: 'show_message', text: 'nice!' } };
}
export function defaultZone(graph) {
  const used = ((graph.arena && graph.arena.zones) || []).map((z) => z.id);
  return { id: freshId('zone', used), kind: 'goal', x: 0.1, y: 0.1, w: 0.2, h: 0.12 };
}

export function addItem(graph, listPath, item) {
  const g = clone(graph);
  if (listPath === 'zones') { g.arena.zones = (g.arena.zones || []).concat([item]); }
  else { g[listPath] = (g[listPath] || []).concat([item]); }
  return g;
}
export function removeItem(graph, listPath, index) {
  const g = clone(graph);
  if (listPath === 'zones') g.arena.zones = (g.arena.zones || []).filter((_, i) => i !== index);
  else g[listPath] = (g[listPath] || []).filter((_, i) => i !== index);
  return g;
}

// dynamic WHEN/THEN parameter specs (drive the rule editor + keep params closed)
const EVENT_PARAMS = {
  timer_elapsed: [{ key: 'at_s', kind: 'num', min: 0, max: CAPS.MAX_ROUND_S, def: 10 }],
  score_reached: [{ key: 'score', kind: 'int', min: 1, max: CAPS.MAX_SCORE_THRESHOLD, def: 50 }],
  player_enters_zone: [{ key: 'zone', kind: 'zoneRef', def: '' }],
  collision_with: [{ key: 'entity', kind: 'entityRef', def: '' }],
  pickup_collected: [{ key: 'entity', kind: 'entityRefOpt', def: '' }],
  wave_cleared: [{ key: 'wave', kind: 'waveRef', def: '' }],
  lives_changed: [{ key: 'lives', kind: 'int', min: 0, max: CAPS.MAX_LIVES, def: 1 }],
  combo_reached: [{ key: 'combo', kind: 'int', min: 1, max: CAPS.MAX_COMBO, def: 5 }],
};
const ACTION_PARAMS = {
  add_score: [{ key: 'amount', kind: 'int', min: 1, max: CAPS.MAX_SCORE_VALUE, def: 10 }],
  sub_life: [{ key: 'amount', kind: 'int', min: 1, max: CAPS.MAX_LIVES, def: 1 }],
  add_life: [{ key: 'amount', kind: 'int', min: 1, max: CAPS.MAX_LIVES, def: 1 }],
  spawn: [{ key: 'entity', kind: 'entityRef', def: '' }, { key: 'count', kind: 'int', min: 1, max: CAPS.MAX_SPAWN_PER_WAVE, def: 3 }, { key: 'from', kind: 'enum', options: SPAWN_SIDES, def: 'random' }],
  despawn_kind: [{ key: 'kind', kind: 'enum', options: ENTITY_KINDS, def: 'enemy' }],
  set_player_speed: [{ key: 'speed', kind: 'enum', options: SPEED_TIERS, def: 'fast' }],
  trigger_fx: [{ key: 'fx', kind: 'enum', options: FX_KINDS, def: 'flash' }],
  start_wave: [{ key: 'wave', kind: 'waveRef', def: '' }],
  end_win: [], end_lose: [],
  show_message: [{ key: 'text', kind: 'text', max: CAPS.MAX_MESSAGE_LEN, def: 'nice!' }],
  apply_modifier: [{ key: 'modifier', kind: 'enum', options: MODIFIER_KINDS, def: 'slow_field' }],
};

// ── DOM mount (browser only) ──────────────────────────────────────────────────
export function mountFreeSandboxEditor(root, deps = {}) {
  const doc = deps.document || (typeof document !== 'undefined' ? document : null);
  const win = deps.window || (typeof window !== 'undefined' ? window : null);
  if (!doc || !root) return null;
  const store = deps.sessionStorage || (win && win.sessionStorage) || null;
  const nav = deps.navigate || ((href) => { if (win) win.location.href = href; });

  const state = { graph: exampleGraph('survival_dodge'), hashSeq: 0, lastPkg: null };

  const h = (tag, attrs, ...kids) => {
    const n = doc.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) n.setAttribute(k, v);
    }
    for (const kid of kids) if (kid != null) n.appendChild(typeof kid === 'string' ? doc.createTextNode(kid) : kid);
    return n;
  };
  const select = (value, options, onChange, labels) => {
    const s = h('select');
    for (const o of options) { const opt = h('option', { value: String(o) }, labels ? labels(o) : String(o)); if (String(o) === String(value)) opt.selected = true; s.appendChild(opt); }
    s.addEventListener('change', () => onChange(s.value));
    return s;
  };
  const numInput = (value, onChange, attrs) => {
    const i = h('input', { type: 'number', value: String(value), ...(attrs || {}) });
    i.addEventListener('input', () => onChange(i.value));
    return i;
  };
  const textInput = (value, onChange, attrs) => {
    const i = h('input', { type: 'text', value: String(value), ...(attrs || {}) });
    i.addEventListener('input', () => onChange(i.value));
    return i;
  };
  const field = (label, control) => h('div', { class: 'fs-field' }, h('label', { text: label }), control);

  // structural change -> full rebuild; scalar change -> set + revalidate (keeps input focus)
  function setGraph(g, structural) { state.graph = g; if (structural) rebuild(); else revalidate(); }
  function patch(mutator) { const g = clone(state.graph); mutator(g); return g; }

  let bodyEl, statusEl;

  function rebuild() {
    root.textContent = '';
    bodyEl = h('div', { class: 'fs-editor' });
    bodyEl.appendChild(renderControls());
    statusEl = h('div', { class: 'fs-status' });
    bodyEl.appendChild(statusEl);
    root.appendChild(bodyEl);
    revalidate();
  }

  function sectionCard(title, ...children) {
    return h('div', { class: 'fs-card' }, h('h3', { text: title }), ...children);
  }

  function renderControls() {
    const g = state.graph;
    const col = h('div', { class: 'fs-controls' });

    // Start
    col.appendChild(sectionCard('Start',
      field('Start from', select('', ['(keep current)', 'blank'].concat(EXAMPLE_META.map((m) => m.id)), (v) => {
        if (v === '(keep current)') return;
        setGraph(v === 'blank' ? blankGraph() : exampleGraph(v), true);
      }, (o) => (o === 'blank' ? 'Blank sandbox' : (o === '(keep current)' ? 'Pick a mechanic…' : (EXAMPLE_META.find((m) => m.id === o)?.name || o))))),
      field('Package id', textInput(g.package_id, (v) => setGraph(patch((x) => { x.package_id = v.slice(0, 48); }), false), { maxlength: 48 })),
      field('Display name', textInput(g.display_name, (v) => setGraph(patch((x) => { x.display_name = v.slice(0, 40); }), false), { maxlength: 40 })),
      field('Seed', numInput(g.seed, (v) => setGraph(patch((x) => { x.seed = Math.max(1, Math.min(999999, parseInt(v, 10) || 1)); }), false), { min: 1, max: 999999 })),
      field('Frame', select(g.frame_contract_id, FRAME_CONTRACTS, (v) => setGraph(patch((x) => { x.frame_contract_id = v; }), false))),
    ));

    // Arena
    col.appendChild(sectionCard('Arena',
      field('Edges', select(g.arena.bounds, BOUNDS_MODES, (v) => setGraph(patch((x) => { x.arena.bounds = v; }), false))),
      field('Scroll', select(g.arena.scroll, SCROLL_MODES, (v) => setGraph(patch((x) => { x.arena.scroll = v; }), false))),
      field('Background', select(g.arena.background, BACKGROUNDS, (v) => setGraph(patch((x) => { x.arena.background = v; }), false))),
      renderList('zones', g.arena.zones || [], ['id', 'kind', 'x', 'y', 'w', 'h'], () => setGraph(addItem(g, 'zones', defaultZone(g)), true)),
    ));

    // Player
    col.appendChild(sectionCard('Player',
      field('Control', select(g.player.control, PLAYER_CONTROLS, (v) => setGraph(patch((x) => { x.player.control = v; }), false))),
      field('Speed', select(g.player.speed, SPEED_TIERS, (v) => setGraph(patch((x) => { x.player.speed = v; }), false))),
      field('Lives', numInput(g.player.lives, (v) => setGraph(patch((x) => { x.player.lives = clampInt(v, 1, CAPS.MAX_LIVES); }), false), { min: 1, max: CAPS.MAX_LIVES })),
      field('Size', select(g.player.size, SIZE_TIERS, (v) => setGraph(patch((x) => { x.player.size = v; }), false))),
      field('Shape', select(g.player.shape, SHAPES, (v) => setGraph(patch((x) => { x.player.shape = v; }), false))),
    ));

    // Objective
    col.appendChild(sectionCard('Objective', renderObjective(g)));

    // Scoring
    col.appendChild(sectionCard('Scoring',
      field('Per pickup', numInput(g.scoring.on_pickup, (v) => setGraph(patch((x) => { x.scoring.on_pickup = clampInt(v, 0, CAPS.MAX_SCORE_VALUE); }), false))),
      field('Per enemy cleared', numInput(g.scoring.on_enemy_clear, (v) => setGraph(patch((x) => { x.scoring.on_enemy_clear = clampInt(v, 0, CAPS.MAX_SCORE_VALUE); }), false))),
      field('Per second alive', numInput(g.scoring.survive_per_s, (v) => setGraph(patch((x) => { x.scoring.survive_per_s = clampInt(v, 0, CAPS.MAX_SCORE_VALUE); }), false))),
      field('Combo cap', numInput(g.scoring.combo_cap, (v) => setGraph(patch((x) => { x.scoring.combo_cap = clampInt(v, 1, CAPS.MAX_COMBO); }), false))),
    ));

    // Entities
    col.appendChild(sectionCard('Entities',
      renderList('entities', g.entities, ['id', 'kind', 'shape', 'color', 'size', 'movement', 'speed', 'max_count', 'collision', 'lifetime_s', 'score_value'], () => {
        if (g.entities.length >= CAPS.MAX_ENTITY_TYPES) return; setGraph(addItem(g, 'entities', defaultEntity(g)), true);
      }),
    ));

    // Waves
    col.appendChild(sectionCard('Waves',
      renderList('waves', g.waves, ['id', 'at_s', 'entity', 'count', 'interval_s', 'from', 'repeat'], () => {
        if (g.waves.length >= CAPS.MAX_WAVES) return; setGraph(addItem(g, 'waves', defaultWave(g)), true);
      }),
    ));

    // Rules
    col.appendChild(sectionCard('Rules (WHEN → THEN)', renderRules(g)));

    // Modifiers + theme
    col.appendChild(sectionCard('Feel',
      field('Difficulty ramp', select(g.modifiers.difficulty_ramp, DIFFICULTY_RAMPS, (v) => setGraph(patch((x) => { x.modifiers.difficulty_ramp = v; }), false))),
      field('Palette', select(g.theme.palette, PALETTE_KEYS, (v) => setGraph(patch((x) => { x.theme.palette = v; }), false))),
      field('Particles', select(g.theme.particles, FX_LEVELS, (v) => setGraph(patch((x) => { x.theme.particles = v; }), false))),
      field('Shake', select(g.theme.shake, FX_LEVELS, (v) => setGraph(patch((x) => { x.theme.shake = v; }), false))),
      field('Contrast', select(g.theme.contrast, CONTRAST, (v) => setGraph(patch((x) => { x.theme.contrast = v; }), false))),
    ));

    return col;
  }

  // generic list renderer: editable rows + remove + add
  function renderList(listPath, items, fields, onAdd) {
    const wrap = h('div', { class: 'fs-list' });
    items.forEach((item, idx) => {
      const row = h('div', { class: 'fs-row' });
      for (const key of fields) row.appendChild(renderItemField(listPath, idx, item, key));
      row.appendChild(h('button', { class: 'fs-rm', type: 'button', text: '✕', title: 'remove', onclick: () => setGraph(removeItem(state.graph, listPath, idx), true) }));
      wrap.appendChild(row);
    });
    wrap.appendChild(h('button', { class: 'fs-add', type: 'button', text: '+ add', onclick: onAdd }));
    return wrap;
  }

  function renderItemField(listPath, idx, item, key) {
    const g = state.graph;
    const set = (mut) => setGraph(patch((x) => { const list = listPath === 'zones' ? x.arena.zones : x[listPath]; mut(list[idx]); }), false);
    const cell = (label, control) => h('label', { class: 'fs-cell' }, h('span', { text: label }), control);
    if (key === 'id') return cell('id', textInput(item.id, (v) => set((it) => { it.id = v; }), { maxlength: 32 }));
    if (key === 'kind' && listPath === 'entities') return cell('kind', select(item.kind, ENTITY_KINDS, (v) => set((it) => { it.kind = v; })));
    if (key === 'kind' && listPath === 'zones') return cell('kind', select(item.kind, ZONE_KINDS, (v) => set((it) => { it.kind = v; })));
    if (key === 'shape') return cell('shape', select(item.shape, SHAPES, (v) => set((it) => { it.shape = v; })));
    if (key === 'color') return cell('color', select(item.color, PALETTE_KEYS, (v) => set((it) => { it.color = v; })));
    if (key === 'size') return cell('size', select(item.size, SIZE_TIERS, (v) => set((it) => { it.size = v; })));
    if (key === 'movement') return cell('move', select(item.movement, MOVEMENT_PATTERNS, (v) => set((it) => { it.movement = v; })));
    if (key === 'speed') return cell('speed', select(item.speed, SPEED_TIERS, (v) => set((it) => { it.speed = v; })));
    if (key === 'collision') return cell('hit', select(item.collision, COLLISION_BEHAVIORS, (v) => set((it) => { it.collision = v; })));
    if (key === 'from') return cell('from', select(item.from, SPAWN_SIDES, (v) => set((it) => { it.from = v; })));
    if (key === 'entity') return cell('entity', select(item.entity, g.entities.map((e) => e.id), (v) => set((it) => { it.entity = v; })));
    if (key === 'repeat') return cell('loop', select(item.repeat ? 'yes' : 'no', ['yes', 'no'], (v) => set((it) => { it.repeat = v === 'yes'; })));
    // numeric fields
    return cell(key, numInput(item[key], (v) => set((it) => { it[key] = key === 'at_s' || key === 'interval_s' || key === 'x' || key === 'y' || key === 'w' || key === 'h' ? parseFloat(v) || 0 : (parseInt(v, 10) || 0); }), { step: (key === 'x' || key === 'y' || key === 'w' || key === 'h' || key === 'at_s' || key === 'interval_s') ? '0.05' : '1' }));
  }

  function renderObjective(g) {
    const wrap = h('div');
    wrap.appendChild(field('Type', select(g.objective.type, OBJECTIVE_TYPES, (v) => {
      setGraph(patch((x) => { x.objective = defaultObjectiveFor(v, x); }), true);
    })));
    const o = g.objective;
    const setO = (mut) => setGraph(patch((x) => { mut(x.objective); }), false);
    if ('duration_s' in o) wrap.appendChild(field('Duration (s)', numInput(o.duration_s, (v) => setO((x) => { x.duration_s = clampInt(v, CAPS.MIN_ROUND_S, CAPS.MAX_ROUND_S); }), { min: CAPS.MIN_ROUND_S, max: CAPS.MAX_ROUND_S })));
    if ('target_count' in o) wrap.appendChild(field('Targets', numInput(o.target_count, (v) => setO((x) => { x.target_count = clampInt(v, 1, CAPS.MAX_TARGET_COUNT); }))));
    if ('score_threshold' in o) wrap.appendChild(field('Score to reach', numInput(o.score_threshold, (v) => setO((x) => { x.score_threshold = clampInt(v, 1, CAPS.MAX_SCORE_THRESHOLD); }))));
    if ('combo_target' in o) wrap.appendChild(field('Combo to reach', numInput(o.combo_target, (v) => setO((x) => { x.combo_target = clampInt(v, 2, CAPS.MAX_COMBO); }))));
    if ('max_hits' in o) wrap.appendChild(field('Hits allowed', numInput(o.max_hits, (v) => setO((x) => { x.max_hits = clampInt(v, 0, CAPS.MAX_COMBO); }))));
    if ('route_zone_ids' in o) wrap.appendChild(field('Route zones (in order)', textInput((o.route_zone_ids || []).join(','), (v) => setO((x) => { x.route_zone_ids = v.split(',').map((s) => s.trim()).filter(Boolean); }), { placeholder: 'zone-a,zone-b,zone-c' })));
    return wrap;
  }

  function renderRules(g) {
    const wrap = h('div', { class: 'fs-list' });
    g.rules.forEach((r, idx) => {
      const row = h('div', { class: 'fs-row fs-rule' });
      const setR = (mut) => setGraph(patch((x) => { mut(x.rules[idx]); }), false);
      row.appendChild(h('span', { class: 'fs-when', text: 'WHEN' }));
      row.appendChild(select(r.when.event, RULE_EVENTS, (v) => setGraph(patch((x) => { x.rules[idx].when = withParams({ event: v }, EVENT_PARAMS[v], x); }), true)));
      for (const p of EVENT_PARAMS[r.when.event] || []) row.appendChild(renderParam(r.when, p, g, (mut) => setR((rr) => mut(rr.when))));
      row.appendChild(h('span', { class: 'fs-then', text: 'THEN' }));
      row.appendChild(select(r.then.action, RULE_ACTIONS, (v) => setGraph(patch((x) => { x.rules[idx].then = withParams({ action: v }, ACTION_PARAMS[v], x); }), true)));
      for (const p of ACTION_PARAMS[r.then.action] || []) row.appendChild(renderParam(r.then, p, g, (mut) => setR((rr) => mut(rr.then))));
      row.appendChild(h('button', { class: 'fs-rm', type: 'button', text: '✕', title: 'remove', onclick: () => setGraph(removeItem(state.graph, 'rules', idx), true) }));
      wrap.appendChild(row);
    });
    wrap.appendChild(h('button', { class: 'fs-add', type: 'button', text: '+ add rule', onclick: () => { if (g.rules.length < CAPS.MAX_RULES) setGraph(addItem(g, 'rules', defaultRule(g)), true); } }));
    return wrap;
  }

  function renderParam(obj, spec, g, apply) {
    const v = obj[spec.key];
    if (spec.kind === 'enum') return select(v, spec.options, (nv) => apply((o) => { o[spec.key] = nv; }));
    if (spec.kind === 'entityRef' || spec.kind === 'entityRefOpt') return select(v || '', (spec.kind === 'entityRefOpt' ? ['(any)'] : []).concat(g.entities.map((e) => e.id)), (nv) => apply((o) => { o[spec.key] = nv === '(any)' ? undefined : nv; }));
    if (spec.kind === 'zoneRef') return select(v || '', (g.arena.zones || []).map((z) => z.id), (nv) => apply((o) => { o[spec.key] = nv; }));
    if (spec.kind === 'waveRef') return select(v || '', g.waves.map((w) => w.id), (nv) => apply((o) => { o[spec.key] = nv; }));
    if (spec.kind === 'text') return textInput(v == null ? '' : v, (nv) => apply((o) => { o[spec.key] = nv.slice(0, spec.max); }), { maxlength: spec.max });
    return numInput(v == null ? spec.def : v, (nv) => apply((o) => { o[spec.key] = spec.kind === 'num' ? (parseFloat(nv) || 0) : (parseInt(nv, 10) || 0); }), { min: spec.min, max: spec.max, step: spec.kind === 'num' ? '0.5' : '1' });
  }

  // ── validation + status + actions ──────────────────────────────────────────
  function revalidate() {
    if (!statusEl) return;
    statusEl.textContent = '';
    const pkg = buildFreeSandboxPackage(state.graph);
    state.lastPkg = pkg;
    const ok = pkg.ok;
    const verdict = h('div', { class: 'fs-verdict ' + (ok ? 'ok' : 'bad'), text: ok ? 'VALID — local proposal' : 'BLOCKED' });
    const issues = h('pre', { class: 'fs-issues', text: ok ? '(no issues)' : pkg.errors.slice(0, 24).join('\n') });
    const fp = h('div', { class: 'fs-fp' }, h('span', { text: 'fingerprint: ' }), h('code', { id: 'fsHash', text: ok ? '…' : '—' }));
    const summary = h('div', { class: 'fs-summary', text: summaryLine(state.graph) });

    const testBtn = h('button', { class: 'fs-primary', type: 'button', text: '▶ Test in sandbox', onclick: testInSandbox });
    const shareBtn = h('button', { type: 'button', text: 'Copy local share code', onclick: copyShare });
    const blankBtn = h('button', { type: 'button', text: 'Start blank', onclick: () => setGraph(blankGraph(), true) });
    testBtn.disabled = !ok; shareBtn.disabled = !ok;
    const note = h('p', { class: 'fs-note', text: 'Local-only. Runs in the hardened sandbox. No live world. No tickets. No account. No upload.' });

    statusEl.appendChild(verdict);
    statusEl.appendChild(summary);
    statusEl.appendChild(h('div', { class: 'fs-actions' }, testBtn, shareBtn, blankBtn));
    statusEl.appendChild(h('p', { class: 'fs-label', text: 'Issues' }));
    statusEl.appendChild(issues);
    statusEl.appendChild(fp);
    statusEl.appendChild(note);

    if (ok) {
      const seq = ++state.hashSeq;
      packageHash({ manifest: pkg.manifest, files: pkg.files }).then((v) => {
        if (seq === state.hashSeq) { const c = statusEl.querySelector('#fsHash'); if (c) c.textContent = v; }
      }, () => {});
    }
  }

  function summaryLine(g) {
    return `${g.objective.type} · ${g.entities.length} entit${g.entities.length === 1 ? 'y' : 'ies'} · ${g.waves.length} wave${g.waves.length === 1 ? '' : 's'} · ${g.rules.length} rule${g.rules.length === 1 ? '' : 's'} · seed ${g.seed}`;
  }

  function testInSandbox() {
    const pkg = state.lastPkg; if (!pkg || !pkg.ok || !store) return;
    try { store.setItem(HANDOFF_KEY, JSON.stringify({ v: 1, manifest: pkg.manifest, files: pkg.files })); } catch { /* navigate anyway; sandbox stays idle */ }
    nav('../arcade-sandbox/');
  }

  function copyShare() {
    const pkg = state.lastPkg; if (!pkg || !pkg.ok) return;
    const code = SHARE_PREFIX + toBase64Utf8(JSON.stringify({ manifest: pkg.manifest, files: pkg.files }));
    if (code.length > SHARE_CODE_MAX_CHARS) return;
    try { if (win && win.navigator && win.navigator.clipboard) win.navigator.clipboard.writeText(code); } catch { /* clipboard optional */ }
    const c = statusEl && statusEl.querySelector('.fs-share-out');
    if (c) c.textContent = code;
    else statusEl && statusEl.appendChild(h('textarea', { class: 'fs-share-out', readonly: 'readonly', rows: '3' }, code));
  }

  rebuild();
  const api = {
    getGraph: () => clone(state.graph),
    setGraph: (g) => setGraph(clone(g), true),
    getPackage: () => state.lastPkg,
  };
  // test/automation hook (mirrors window.__cf_builder) — local tooling only, no user path depends on it.
  if (win) win.__cf_free_sandbox = api;
  return api;
}

// ── small pure utilities ──────────────────────────────────────────────────────
function clampInt(v, min, max) { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min; }

export function defaultObjectiveFor(type, graph) {
  switch (type) {
    case 'survive_timer': return { type, duration_s: 45 };
    case 'avoid_hits': return { type, duration_s: 40, max_hits: 3 };
    case 'reach_goal': return { type };
    case 'collect_targets': return { type, target_count: 10 };
    case 'clear_waves': return { type };
    case 'timed_route': return { type, duration_s: 30, route_zone_ids: ((graph.arena && graph.arena.zones) || []).slice(0, 3).map((z) => z.id) };
    case 'score_threshold': return { type, score_threshold: 100 };
    case 'combo_chain': return { type, combo_target: 10 };
    default: return { type: 'survive_timer', duration_s: 45 };
  }
}

function withParams(base, specs, graph) {
  const out = { ...base };
  for (const p of specs || []) {
    if (p.kind === 'entityRef') out[p.key] = (graph.entities[0] && graph.entities[0].id) || '';
    else if (p.kind === 'zoneRef') out[p.key] = (((graph.arena && graph.arena.zones) || [])[0] || {}).id || '';
    else if (p.kind === 'waveRef') out[p.key] = (graph.waves[0] && graph.waves[0].id) || '';
    else if (p.kind === 'entityRefOpt') { /* optional — leave undefined */ }
    else out[p.key] = p.def;
  }
  return out;
}

/** UTF-8-safe base64 (chunked) — mirror of the builder/sandbox share codec. */
function toBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = ''; const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}
