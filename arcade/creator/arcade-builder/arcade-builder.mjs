/**
 * Creator Foundation — LOCAL Arcade Builder (cabinet composer; trusted, offline).
 *
 * The assembled-builder UX over the EXISTING CF pipeline. The generation core (closed token
 * tables, 14 procedural variants, the 16-starter library) lives DOM-free in
 * cabinet-templates.mjs so node tests prove every starter through the importer; this page is
 * only the picker + controls + gate report + export shell around it.
 *
 * DATA-ONLY by design: this page NEVER executes the generated game (no eval, no dynamic
 * import) — running creator code is the arcade-sandbox's job (srcdoc iframe + closed CSP).
 * All substitution values come from CLOSED token tables, and the importer's scan re-checks
 * the output regardless. No submit, no upload, no live registration.
 * See arcade/virtual-arcade/HIVE_WORLD_ALIGNMENT.md §5.
 */
import { importArcadePackage, FRAME_CONTRACT_DIMS } from '../arcade-importer/import-arcade-package.mjs';
import { FRAME_CONTRACTS, SIZE_BUDGET_MIN_BYTES, SIZE_BUDGET_MAX_BYTES } from '../schemas/arcade-game-package-schema.mjs';
import { explainIssues } from '../validator/issue-explainer.mjs'; // throughput: friendly hints (explanatory only — importer stays the gate)
import {
  ACCENTS, SPEEDS, DIFFICULTY, MOTION, JUICE, INPUT_MODES, INPUT_MODE_COPY, VARIANTS, STARTERS,
  getStarter, startersByCategory, buildPackage,
} from './cabinet-templates.mjs';
import {
  COMBO_CAPS,
  CONTRAST,
  defaultReactionLaneGraph,
  DIFFICULTY_RAMPS,
  HIT_WINDOW_MS,
  LANE_COUNTS,
  MISS_LIMITS,
  MOBILE_CONTROLS,
  PARTICLE_EFFECTS,
  SCREEN_SHAKE,
  SPAWN_CADENCE_MS,
  TARGET_COUNTS,
  buildReactionLanePackage,
} from './rule-graph-templates.mjs';

const el = (id) => document.getElementById(id);

// ── build + gate + report ─────────────────────────────────────────────────────
const state = { lastReport: null, lastBuild: null, lastGraph: null };

function currentParams() {
  return {
    builder_mode: el('builderMode')?.value || 'preset',
    package_id: String(el('packageId').value || ''),
    display_name: String(el('displayName').value || ''),
    variant: el('variant').value, accent: el('accent').value, speed: el('speed').value,
    difficulty: el('difficulty').value, motion: el('motion').value,
    juice: el('juice').value, input_mode: el('inputMode').value,
    frame: el('frame').value, budget: Number(el('budget').value) || SIZE_BUDGET_MIN_BYTES,
    rl_lane_count: Number(el('rlLaneCount')?.value) || 3,
    rl_spawn_cadence_ms: Number(el('rlSpawnCadence')?.value) || 650,
    rl_hit_window_ms: Number(el('rlHitWindow')?.value) || 180,
    rl_target_count: Number(el('rlTargetCount')?.value) || 16,
    rl_combo_cap: Number(el('rlComboCap')?.value) || 5,
    rl_miss_limit: Number(el('rlMissLimit')?.value) || 5,
    rl_difficulty_ramp: el('rlDifficultyRamp')?.value || 'gentle',
    rl_particle_effects: el('rlParticles')?.value || 'soft',
    rl_screen_shake: el('rlShake')?.value || 'soft',
    rl_contrast: el('rlContrast')?.value || 'high',
    rl_mobile_controls: el('rlMobileControls')?.value || 'tap_or_swipe_lanes',
  };
}

/** Restore CLOSED controls from a params object — unknown values fall back to defaults; refresh re-gates. */
function applyParams(p) {
  if (!p || typeof p !== 'object') return;
  if (p.builder_mode === 'reaction_lane' || p.builder_mode === 'preset') el('builderMode').value = p.builder_mode;
  if (typeof p.package_id === 'string') el('packageId').value = p.package_id.slice(0, 48);
  if (typeof p.display_name === 'string') el('displayName').value = p.display_name.slice(0, 40);
  if (VARIANTS.includes(p.variant)) el('variant').value = p.variant;
  if (p.accent in ACCENTS) el('accent').value = p.accent;
  if (p.speed in SPEEDS) el('speed').value = p.speed;
  if (p.difficulty in DIFFICULTY) el('difficulty').value = p.difficulty;
  if (p.motion in MOTION) el('motion').value = p.motion;
  if (p.juice in JUICE) el('juice').value = p.juice;
  if (INPUT_MODES.includes(p.input_mode)) el('inputMode').value = p.input_mode;
  if (FRAME_CONTRACTS.includes(p.frame)) el('frame').value = p.frame;
  const b = Number(p.budget);
  if (Number.isInteger(b) && b >= SIZE_BUDGET_MIN_BYTES && b <= SIZE_BUDGET_MAX_BYTES) el('budget').value = String(b);
  setIfClosed('rlLaneCount', p.rl_lane_count, LANE_COUNTS);
  setIfClosed('rlSpawnCadence', p.rl_spawn_cadence_ms, SPAWN_CADENCE_MS);
  setIfClosed('rlHitWindow', p.rl_hit_window_ms, HIT_WINDOW_MS);
  setIfClosed('rlTargetCount', p.rl_target_count, TARGET_COUNTS);
  setIfClosed('rlComboCap', p.rl_combo_cap, COMBO_CAPS);
  setIfClosed('rlMissLimit', p.rl_miss_limit, MISS_LIMITS);
  setIfClosed('rlDifficultyRamp', p.rl_difficulty_ramp, DIFFICULTY_RAMPS);
  setIfClosed('rlParticles', p.rl_particle_effects, PARTICLE_EFFECTS);
  setIfClosed('rlShake', p.rl_screen_shake, SCREEN_SHAKE);
  setIfClosed('rlContrast', p.rl_contrast, CONTRAST);
  setIfClosed('rlMobileControls', p.rl_mobile_controls, MOBILE_CONTROLS);
  updateModePanels();
  refresh();
}

function setIfClosed(id, value, allowed) {
  const target = el(id);
  if (target && allowed.includes(value)) target.value = String(value);
}

function reactionLaneGraphFromParams(p) {
  const contrast = CONTRAST.includes(p.rl_contrast) ? p.rl_contrast : 'high';
  const mobile = MOBILE_CONTROLS.includes(p.rl_mobile_controls) ? p.rl_mobile_controls : 'tap_or_swipe_lanes';
  return defaultReactionLaneGraph({
    package_id: p.package_id,
    display_name: p.display_name.trim() || 'Reaction Lane Demo',
    frame_contract_id: p.frame,
    rules: {
      objective: { target_count: p.rl_target_count },
      input: { grammar: mobile },
      scoring: { combo_cap: p.rl_combo_cap },
      timer: { spawn_cadence_ms: p.rl_spawn_cadence_ms, hit_window_ms: p.rl_hit_window_ms, difficulty_ramp: p.rl_difficulty_ramp },
      fail: { miss_limit: p.rl_miss_limit },
    },
    layout: { frame: p.frame, lane_count: p.rl_lane_count },
    visuals: {
      palette: p.accent,
      particle_effects: p.rl_particle_effects,
      screen_shake: p.rl_screen_shake,
      contrast,
    },
    accessibility: { contrast, mobile_controls: mobile },
    size_budget_bytes: Number.isInteger(p.budget) ? p.budget : SIZE_BUDGET_MIN_BYTES,
  });
}

function build() {
  const p = currentParams();
  if (p.builder_mode === 'reaction_lane') {
    return buildReactionLanePackage(reactionLaneGraphFromParams(p));
  }
  return buildPackage({
    ...p,
    display_name: p.display_name.trim() || 'Untitled Cabinet',
    budget: Number.isInteger(p.budget) ? p.budget : SIZE_BUDGET_MIN_BYTES,
  });
}

function drawFramePreview(report, buildOut) {
  const canvas = el('framePreview');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const dims = report.frame_dims || FRAME_CONTRACT_DIMS[buildOut.manifest.frame_contract_id];
  if (!dims) return;
  const scale = Math.min((canvas.width - 24) / dims.width, (canvas.height - 24) / dims.height);
  const w = dims.width * scale, h = dims.height * scale;
  const x = (canvas.width - w) / 2, y = (canvas.height - h) / 2;
  const accent = ACCENTS[el('accent').value] || ACCENTS.cyan;
  ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = accent; ctx.font = '11px monospace'; ctx.textAlign = 'center';
  ctx.fillText(`${dims.width}×${dims.height} · ${buildOut.variant || buildOut.template}`, canvas.width / 2, y + h + 14);
}

/** Starter METADATA preview — static closed copy from the library (textContent only). */
function renderStarterMeta(starterId) {
  const meta = el('starterMeta');
  if (!meta) return;
  meta.textContent = '';
  const s = getStarter(starterId);
  if (!s) { meta.hidden = true; return; }
  meta.hidden = false;
  const line = (cls, text) => {
    const d = document.createElement('div'); d.className = cls; d.textContent = text; meta.appendChild(d);
  };
  line('sm-pitch', s.pitch);
  line('sm-explain', s.explain);
  line('sm-tags', `${s.tags.join(' · ')} · ~${s.round_s}s rounds · ${s.params.input_mode}`);
  line('sm-note', INPUT_MODE_COPY[s.params.input_mode] || '');
  line('sm-note', s.result_note);
  line('sm-note', `Mobile: ${s.mobile_note}`);
  line('sm-note', `Reduced motion: ${s.reduced_motion_note}`);
}

function refresh() {
  const out = build();
  state.lastBuild = out;
  state.lastGraph = out.rule_graph || null;
  const report = importArcadePackage({ manifest: out.manifest, files: out.files });
  const graphErrors = out.graphValidation?.errors || [];
  state.lastReport = graphErrors.length ? { ...report, ok: false, errors: [...graphErrors, ...report.errors] } : report;
  const verdict = el('verdict');
  verdict.textContent = state.lastReport.ok ? 'VALID (untrusted local proposal)' : 'BLOCKED';
  verdict.className = 'verdict ' + (state.lastReport.ok ? 'v-ok' : 'v-bad');
  el('issues').textContent = state.lastReport.errors.length
    ? explainIssues(state.lastReport.errors).map(({ error, hint }) => (hint ? `${error}\n  → ${hint}` : error)).join('\n')
    : '(none)';
  el('sizes').textContent = `${report.limits.total_bytes} / ${report.limits.size_budget_bytes} bytes · trust=${report.result_trust}`;
  el('exportAll').disabled = !state.lastReport.ok;
  el('exportBundle').disabled = !state.lastReport.ok;
  el('srcView').textContent = out.files['game.mjs'];
  el('graphView').textContent = out.rule_graph ? JSON.stringify(out.rule_graph, null, 2) : '(preset builder: no rule graph)';
  drawFramePreview(report, out);
}

function download(name, text, type) {
  const blob = new Blob([text], { type: type || 'text/javascript' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Apply a STARTER: parameters + naming from the library; the importer re-gates as always. */
function applyStarter(id) {
  const s = getStarter(id);
  renderStarterMeta(id);
  if (!s) return;
  applyParams({ ...currentParams(), ...s.params, package_id: s.id, display_name: s.name });
}

function updateModePanels() {
  const isReaction = el('builderMode').value === 'reaction_lane';
  el('presetControls').hidden = isReaction;
  el('presetTokenControls').hidden = isReaction;
  el('reactionLaneControls').hidden = !isReaction;
}

function addOptions(id, values) {
  for (const v of values) {
    const o = document.createElement('option');
    o.value = String(v);
    o.textContent = String(v);
    el(id).appendChild(o);
  }
}

function wire() {
  for (const id of ['packageId', 'displayName']) el(id).addEventListener('input', refresh);
  for (const id of ['variant', 'accent', 'speed', 'difficulty', 'motion', 'juice', 'inputMode', 'frame', 'budget']) el(id).addEventListener('change', refresh);
  el('builderMode').addEventListener('change', () => { updateModePanels(); refresh(); });
  for (const id of ['rlLaneCount', 'rlSpawnCadence', 'rlHitWindow', 'rlTargetCount', 'rlComboCap', 'rlMissLimit', 'rlDifficultyRamp', 'rlParticles', 'rlShake', 'rlContrast', 'rlMobileControls']) {
    el(id).addEventListener('change', refresh);
  }
  el('exportAll').addEventListener('click', () => {
    if (!state.lastBuild || !state.lastReport?.ok) return;
    const { manifest, files } = state.lastBuild;
    download('manifest.json', JSON.stringify(manifest, null, 2), 'application/json');
    download('game.mjs', files['game.mjs']);
    download('adapter.mjs', files['adapter.mjs']);
  });
  // starter picker: named presets from the closed library — picking one re-runs the full gate
  el('template').addEventListener('change', () => applyStarter(el('template').value));
  // bundle export: ONE json file carrying params + the gated build (for sharing / re-editing)
  el('exportBundle').addEventListener('click', () => {
    if (!state.lastBuild || !state.lastReport?.ok) return;
    const bundle = {
      schema_version: 1,
      bundle_kind: 'arcade_builder_bundle',
      builder_params: currentParams(),
      rule_graph: state.lastBuild.rule_graph || null,
      graph_validation: state.lastBuild.graphValidation || null,
      manifest: state.lastBuild.manifest,
      files: state.lastBuild.files,
    };
    download(`${bundle.builder_params.package_id || 'cabinet'}.builder.json`, JSON.stringify(bundle, null, 2), 'application/json');
  });
  // bundle import: PARAMS ONLY are restored — bundled manifest/files are deliberately IGNORED
  // (the builder regenerates from closed tables and the importer re-gates; imported source never runs).
  el('importBundle').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try {
      const bundle = JSON.parse(await f.text());
      applyParams(bundle && typeof bundle === 'object' ? bundle.builder_params : null);
    } catch { /* unreadable file → nothing restored; the panel keeps its current state */ }
  });
  // closed select options come from the closed tables — single source of truth
  { const o = document.createElement('option'); o.value = ''; o.textContent = '(custom)'; el('template').appendChild(o); }
  for (const [category, starters] of Object.entries(startersByCategory())) {
    const g = document.createElement('optgroup'); g.label = category;
    for (const s of starters) { const o = document.createElement('option'); o.value = s.id; o.textContent = s.name; g.appendChild(o); }
    el('template').appendChild(g);
  }
  for (const v of VARIANTS) { const o = document.createElement('option'); o.value = v; o.textContent = v; el('variant').appendChild(o); }
  for (const k of Object.keys(ACCENTS)) { const o = document.createElement('option'); o.value = k; o.textContent = k; el('accent').appendChild(o); }
  for (const k of Object.keys(SPEEDS)) { const o = document.createElement('option'); o.value = k; o.textContent = k; el('speed').appendChild(o); }
  for (const k of Object.keys(DIFFICULTY)) { const o = document.createElement('option'); o.value = k; o.textContent = k; el('difficulty').appendChild(o); }
  for (const k of Object.keys(MOTION)) { const o = document.createElement('option'); o.value = k; o.textContent = k; el('motion').appendChild(o); }
  for (const k of Object.keys(JUICE)) { const o = document.createElement('option'); o.value = k; o.textContent = k; el('juice').appendChild(o); }
  for (const m of INPUT_MODES) { const o = document.createElement('option'); o.value = m; o.textContent = m; el('inputMode').appendChild(o); }
  for (const f of FRAME_CONTRACTS) { const o = document.createElement('option'); o.value = f; o.textContent = f; el('frame').appendChild(o); }
  addOptions('rlLaneCount', LANE_COUNTS);
  addOptions('rlSpawnCadence', SPAWN_CADENCE_MS);
  addOptions('rlHitWindow', HIT_WINDOW_MS);
  addOptions('rlTargetCount', TARGET_COUNTS);
  addOptions('rlComboCap', COMBO_CAPS);
  addOptions('rlMissLimit', MISS_LIMITS);
  addOptions('rlDifficultyRamp', DIFFICULTY_RAMPS);
  addOptions('rlParticles', PARTICLE_EFFECTS);
  addOptions('rlShake', SCREEN_SHAKE);
  addOptions('rlContrast', CONTRAST);
  addOptions('rlMobileControls', MOBILE_CONTROLS);
  el('speed').value = 'medium';
  el('difficulty').value = 'standard';
  el('motion').value = 'standard';
  el('juice').value = 'standard';
  el('inputMode').value = 'tap_window';
  el('rlLaneCount').value = '3';
  el('rlSpawnCadence').value = '650';
  el('rlHitWindow').value = '180';
  el('rlTargetCount').value = '16';
  el('rlComboCap').value = '5';
  el('rlMissLimit').value = '5';
  el('rlDifficultyRamp').value = 'gentle';
  el('rlParticles').value = 'soft';
  el('rlShake').value = 'soft';
  el('rlContrast').value = 'high';
  el('rlMobileControls').value = 'tap_or_swipe_lanes';
  updateModePanels();
  renderStarterMeta('');
  refresh();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();

// ── test/automation hook (mirrors the other CF tools) ────────────────────────
window.__cf_builder = {
  get lastReport() { return state.lastReport; },
  get lastBuild() { return state.lastBuild; },
  get lastGraph() { return state.lastGraph; },
  get starterCount() { return STARTERS.length; },
  refresh,
  currentParams,
  applyParams,
  applyStarter,
};
