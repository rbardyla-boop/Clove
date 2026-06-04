/**
 * Neon Circuit — City Block scene orchestrator (browser entry), Phase 4B.
 *
 * Wiring: input intent → per-input prediction buffer → SERVER snapshot (authority)
 * → input-replay reconciliation (local) + remote snapshot interpolation → render +
 * minimap + portal. The server owns truth: the client predicts by REPLAYING its own
 * still-unacknowledged inputs from the latest authoritative position (city-reconcile),
 * and large divergence snaps to the server. Remote players are interpolated from
 * buffered canonical snapshots (city-snapshots) at a small render delay. Picks the
 * Three.js renderer when available, else the 2D fallback.
 *
 * Scope + non-goals: docs/NEON_CIRCUIT_PHASE4B_CITY_AUTHORITY_POLISH.md.
 */
import { publicLayout, MOVEMENT, predictStep, resolveCityRoomId } from './city-block.mjs';
import {
  createInputBuffer, recordPendingInput, dropAcknowledgedInputs, reconcilePredictedState, DISPLAY_EASE,
} from './city-reconcile.mjs';
import { createSnapshotBuffer, pushSnapshot, sampleSnapshotAt, latestServerTime } from './city-snapshots.mjs';
import {
  defaultBlockStyle, normalizeBlockStyle, mergeBlockStyle, isStewardshipEligible,
  ALLOWED_TARGETS, ALLOWED_PALETTES, ALLOWED_SIGN_VARIANTS, ALLOWED_INTENSITY,
} from './city-stewardship.mjs';
import { CityNet, resolveCityWsUrl } from './city-net.js';
import { createCanvas2DRenderer } from './city-render-canvas2d.js';
import { createThreeRenderer } from './city-render-three.js';
import { createCityMinimap } from './city-minimap.js';

const params = new URLSearchParams(location.search);
const TEST = params.get('test') === '1';
const DEBUG = params.get('debug') === '1';
const SEND_MS = 50;            // client input tick (~20 Hz) — safely above the server 33ms gate
const RENDER_DELAY_MS = 100;   // remote interpolation delay

const playerId = params.get('id') || `city-${Math.random().toString(36).slice(2, 8)}`;
const cityId = resolveCityRoomId(params.get('city')).cityId;

// ── DOM ──────────────────────────────────────────────────────────────────────
const el = (id) => document.getElementById(id);
const canvas = el('cityCanvas');
const statusDot = el('statusDot');
const statusTxt = el('statusTxt');
const portalPrompt = el('portalPrompt');
const portalBtn = el('portalBtn');
const portalOverlay = el('portalOverlay');
const interiorFrame = el('interiorFrame');
const interiorClose = el('interiorClose');
const interiorFallback = el('interiorFallback');
const eventLogEl = el('cityEventLog');
const pressureEl = el('cityPressure');
const hostRankEl = el('cityHostRank');
const stewardshipEl = el('cityStewardship');
const rendererTag = el('rendererTag');
const debugPanel = el('debugPanel');
el('playerName').textContent = playerId;

// ── scene state ────────────────────────────────────────────────────────────
let layout = publicLayout();
let serverSelf = null;               // last authoritative position for me
let predicted = null;                // server pos + replay(pending) — what the client believes "now"
let displayed = null;                // eased visual position
let ackSeq = 0;                      // last input the server processed for me
let inputBuffer = createInputBuffer();
let snapBuf = createSnapshotBuffer({ delayMs: RENDER_DELAY_MS });
const remoteIds = new Set();         // ids currently present (drives render filter)
const serverClock = { lastServerTime: 0, lastPerf: 0 };
const input = { dx: 0, dy: 0 };
let lastSentNonzero = false;
let status = 'connecting';
let activePortal = null;
let portalState = 'idle';            // idle | in_zone | requesting | accepted | rejected
let dbg = { error: 0, snapped: false };
let lastOthers = [];                 // last sampled remote view (for tests/automation)
let interiorOpen = false;            // in-place arcade interior overlay state (4C)
const EVENT_UI_MAX = 14;             // bounded city-OS event panel
const eventList = [];                // recent public events (display only)
const seenEventIds = new Set();
let cityPressure = null;             // Phase 4D: last city pressure snapshot (display only)
let cityHostRank = null;             // Phase 4E: last non-cash host rank snapshot (display only)
let cityStewardship = defaultBlockStyle(); // Phase 4F: canonical block style (server-owned)
let stewardshipPreview = null;       // Phase 4F: local, non-persistent preview (until server-confirmed)
let stewardEligible = false;         // Phase 4F: current Host Rank confers stewardship eligibility?
const stewSel = { target: 'arcade_front', palette: 'magenta', sign_variant: 'classic', intensity: 'medium' }; // editor selection

// ── renderer (Three.js if present + working, else 2D) ─────────────────────────
let renderer;
const want = params.get('renderer');
if (want !== '2d' && want !== 'canvas2d' && window.THREE) {
  try { renderer = createThreeRenderer(canvas, layout); }
  catch (e) { console.warn('[city] three init failed, using 2D fallback:', e?.message); }
}
if (!renderer) renderer = createCanvas2DRenderer(canvas, layout);
rendererTag.textContent = renderer.name;
const minimap = createCityMinimap(el('cityMinimap'), layout);
window.addEventListener('resize', () => { renderer.resize(); minimap.resize(); });
if (DEBUG && debugPanel) debugPanel.hidden = false;

// ── networking ────────────────────────────────────────────────────────────
const net = new CityNet({
  wsUrl: resolveCityWsUrl({ explicit: params.get('ws'), config: window.__NEON_ARCADE_CONFIG__, location }),
  playerId, cityId,
  handlers: {
    onStatus: setStatus,
    onWelcome: (m) => {
      if (m.layout) layout = m.layout;
      if (m.you) {
        serverSelf = { x: m.you.x, y: m.you.y, facing: m.you.facing };
        predicted = { ...serverSelf };
        displayed = { ...serverSelf };
        ackSeq = m.you.seq || 0;
      }
      inputBuffer = createInputBuffer();
      net.requestSnapshot(); // populate remote interpolation buffer promptly
    },
    onSnapshot: (m) => {
      window.__neon_city.lastSnapshotAt = Date.now();
      if (Number.isFinite(m.serverTime)) {
        serverClock.lastServerTime = Math.max(serverClock.lastServerTime, m.serverTime);
        serverClock.lastPerf = performance.now();
      }
      const remotes = [];
      for (const p of m.players) {
        if (p.id === playerId) {
          serverSelf = { x: p.x, y: p.y, facing: p.facing };
          ackSeq = p.seq || 0;
          inputBuffer = dropAcknowledgedInputs(inputBuffer, ackSeq);
        } else {
          remotes.push(p);
          remoteIds.add(p.id);
        }
      }
      // ids present this snapshot define the live remote set
      const present = new Set(remotes.map((p) => p.id));
      for (const id of [...remoteIds]) if (!present.has(id)) remoteIds.delete(id);
      snapBuf = pushSnapshot(snapBuf, { serverTime: m.serverTime, players: remotes });
      // self reconciliation (replay pending from serverSelf) happens in the frame loop,
      // which runs ~16ms later from this same serverSelf + pending — no need to duplicate here.
    },
    onPlayerJoined: () => { /* the server's join broadcast snapshot populates the buffer */ },
    onPlayerLeft: (m) => { remoteIds.delete(m.id); },
    onPortalOk: (m) => {
      window.__neon_city.lastPortalOk = { portalId: m.portalId, target: m.target, at: Date.now() };
      portalState = 'accepted';
      // In-place arcade interior (Phase 4C): only a same-origin path is honored, and we
      // can only get here from a server city_portal_ok (which requires being in the zone).
      if (typeof m.target === 'string' && m.target.startsWith('/')) openInterior(m.target);
    },
    onEvents: (m) => { eventList.length = 0; seenEventIds.clear(); for (const e of (m.events || [])) pushEvent(e); renderEvents(); },
    onEvent: (m) => { if (m.event) { pushEvent(m.event); renderEvents(); } },
    onSchedulerState: (m) => { cityPressure = m; renderPressure(); },
    onHostRankState: (m) => { cityHostRank = m; stewardEligible = isStewardshipEligible(m && m.host_rank); renderHostRank(); updateStewardship(); },
    onStewardshipState: (m) => { cityStewardship = normalizeBlockStyle(m && m.stewardship); stewardshipPreview = null; applyEffectiveStyle(); updateStewardship(); },
    onStewardshipResult: (m) => { onStewardshipResult(m); },
    onError: (m) => {
      window.__neon_city.lastError = m;
      if (String(m.code).startsWith('portal_')) { portalState = 'rejected'; setTimeout(() => { if (portalState === 'rejected') portalState = 'idle'; }, 900); }
      else console.warn('[city] server error:', m.code);
    },
  },
});

function setStatus(s) {
  status = s;
  statusTxt.textContent = s === 'live' ? 'live' : s;
  statusDot.className = 'dot ' + (s === 'live' ? 'on' : s === 'offline' ? 'err' : 'wait');
}

// ── input: keyboard ─────────────────────────────────────────────────────────
const keys = new Set();
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
function recomputeInput() {
  input.dx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
  input.dy = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'Backquote') { if (debugPanel) debugPanel.hidden = !debugPanel.hidden; return; }
  if (e.code === 'KeyE' || e.code === 'Enter') { tryPortal(); return; }
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault(); keys.add(k); recomputeInput();
});
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (!k) return; keys.delete(k); recomputeInput(); });

// ── input: touch joystick ────────────────────────────────────────────────────
const pad = el('touchPad');
const nub = el('touchNub');
let padId = null;
function padVec(cx, cy, x, y) {
  const dx = x - cx; const dy = y - cy; const max = 46;
  const mag = Math.hypot(dx, dy) || 1; const k = Math.min(1, mag / max);
  nub.style.transform = `translate(${(dx / mag) * max * k}px, ${(dy / mag) * max * k}px)`;
  input.dx = (dx / mag) * k; input.dy = (dy / mag) * k;
}
if (pad) {
  const rect = () => pad.getBoundingClientRect();
  pad.addEventListener('pointerdown', (e) => { padId = e.pointerId; try { pad.setPointerCapture(padId); } catch { /* noop */ } const r = rect(); padVec(r.left + r.width / 2, r.top + r.height / 2, e.clientX, e.clientY); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId !== padId) return; const r = rect(); padVec(r.left + r.width / 2, r.top + r.height / 2, e.clientX, e.clientY); });
  const end = (e) => { if (e.pointerId !== padId) return; padId = null; input.dx = 0; input.dy = 0; nub.style.transform = 'translate(0,0)'; };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
}

// ── portal ────────────────────────────────────────────────────────────────
function portalUnder(p) {
  if (!p) return null;
  for (const z of layout.portals) if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) return z;
  return null;
}
function tryPortal() { if (activePortal) { portalState = 'requesting'; net.enterPortal(activePortal.id); } }
if (portalBtn) portalBtn.addEventListener('click', tryPortal);

// ── in-place arcade interior (server-confirmed; same-origin iframe shell) ──────
function openInterior(target) {
  if (interiorOpen) return; // idempotent: a re-sent city_portal_ok must not reload the iframe mid-session
  interiorOpen = true;
  if (interiorFallback) interiorFallback.hidden = true;
  if (portalOverlay) portalOverlay.hidden = false;
  if (interiorFrame) {
    // In tests we mount a tiny placeholder (the real /arcade/ needs the arcade WS and
    // would add cross-frame noise); real use loads the existing arcade floor unchanged.
    if (TEST) interiorFrame.srcdoc = '<!doctype html><meta charset="utf-8"><title>arcade interior</title><body style="margin:0;background:#080610;color:#9fb9c9;font:14px monospace;display:grid;place-items:center;height:100vh">ARCADE INTERIOR (test shell)</body>';
    else interiorFrame.src = target;
  }
}
function closeInterior() {
  if (!interiorOpen) return;
  interiorOpen = false;
  if (portalOverlay) portalOverlay.hidden = true;
  if (interiorFrame) { interiorFrame.removeAttribute('src'); interiorFrame.removeAttribute('srcdoc'); }
  net.closeInterior();
  portalState = activePortal ? 'in_zone' : 'idle';
}
if (interiorClose) interiorClose.addEventListener('click', closeInterior);
if (interiorFrame) interiorFrame.addEventListener('error', () => { if (interiorFallback) interiorFallback.hidden = false; });
window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && interiorOpen) closeInterior(); });

// ── city-OS event panel (public-safe, bounded, display-only) ──────────────────
function pushEvent(e) {
  if (!e || !e.event_id || seenEventIds.has(e.event_id)) return;
  seenEventIds.add(e.event_id);
  eventList.push(e);
  while (eventList.length > EVENT_UI_MAX) { const old = eventList.shift(); seenEventIds.delete(old.event_id); }
}
function eventLabel(e) {
  const who = e.actor_public_id || 'someone';
  switch (e.type) {
    case 'city_player_joined': return `${who} entered the block`;
    case 'city_player_left': return `${who} left the block`;
    case 'city_portal_enter_requested': return `${who} approached the arcade`;
    case 'city_portal_enter_accepted': return `${who} stepped into the arcade`;
    case 'city_portal_enter_rejected': return `${who} was turned away (${(e.payload && e.payload.reason) || 'denied'})`;
    case 'city_arcade_interior_opened': return `arcade interior opened · ${who}`;
    case 'city_arcade_interior_closed': return `arcade interior closed · ${who}`;
    case 'city_scheduler_tick': return `city pressure: ${(e.payload && e.payload.pressure) || 'stable'}`;
    case 'city_pressure_suggested': return `pressure signal · ${(e.payload && e.payload.reason) || 'activity'} (${(e.payload && e.payload.severity) || 'low'})`;
    case 'city_host_rank_evaluated': return `host rank: ${(e.payload && e.payload.tier) || 'observer'} · ${(e.payload && e.payload.support_signal) || 'quiet'}`;
    case 'city_host_rank_changed': return `host rank changed → ${(e.payload && e.payload.tier) || 'observer'} (${(e.payload && e.payload.support_signal) || 'quiet'})`;
    case 'city_stewardship_previewed': return `${who} previewed ${(e.payload && e.payload.target) || 'block'} style`;
    case 'city_stewardship_applied': return `${who} restyled ${(e.payload && e.payload.target) || 'block'} → ${(e.payload && e.payload.palette) || 'default'}`;
    case 'city_stewardship_rejected': return `${who}'s stewardship edit was declined (${(e.payload && e.payload.reason) || 'denied'})`;
    case 'city_stewardship_reset': return `${who} reset the block to city default`;
    default: return `${who} · ${e.type}`;
  }
}
function renderEvents() {
  if (!eventLogEl) return;
  eventLogEl.textContent = ''; // textContent only — never innerHTML (no injection)
  for (const e of eventList.slice(-EVENT_UI_MAX)) {
    const row = document.createElement('div');
    row.className = 'evt';
    row.textContent = eventLabel(e);
    eventLogEl.appendChild(row);
  }
  eventLogEl.scrollTop = eventLogEl.scrollHeight;
}

// ── city-OS pressure panel (Phase 4D; public-safe, display-only, textContent only) ──
function renderPressure() {
  if (!pressureEl || !cityPressure || !cityPressure.pressure) return;
  const p = cityPressure.pressure;
  const lines = [
    `CITY PRESSURE: ${String(p.scheduler_mood || 'stable').toUpperCase()}`,
    `portal ${p.portal_activity} · presence ${p.presence} · interior ${p.interior_activity}`,
  ];
  for (const s of (cityPressure.suggestions || []).slice(0, 2)) lines.push(`↳ ${s.reason} (${s.severity})`);
  pressureEl.textContent = '';
  for (let i = 0; i < lines.length; i++) {
    const row = document.createElement('div');
    row.className = i === 0 ? 'cp-mood' : 'cp-line';
    row.textContent = lines[i];
    pressureEl.appendChild(row);
  }
}

// ── city-OS Host Rank panel (Phase 4E; non-cash, public-safe, textContent only) ──
function renderHostRank() {
  if (!hostRankEl || !cityHostRank || !cityHostRank.host_rank) return;
  const h = cityHostRank.host_rank;
  const lines = [
    `HOST RANK: ${String(h.tier || 'observer').toUpperCase()}`,
    `Support signal: ${h.support_signal || 'quiet'}.`,
  ];
  for (const r of (h.reasons || []).slice(0, 2)) lines.push(`Reason: ${String(r).replace(/_/g, ' ')}.`);
  hostRankEl.textContent = '';
  for (let i = 0; i < lines.length; i++) {
    const row = document.createElement('div');
    row.className = i === 0 ? 'hr-tier' : 'hr-line';
    row.textContent = lines[i];
    hostRankEl.appendChild(row);
  }
}

// ── Block Stewardship constrained editor (Phase 4F; server-validated, non-cash) ──
// The client sends INTENT only. The server owns the canonical block style; here we show
// it, gate the controls on current Host Rank eligibility, and offer a fixed set of
// preview/apply/reset options (no free text, no uploads, no URLs). textContent only.
const TARGET_LABELS = { arcade_front: 'arcade', street_lights: 'street', sidewalk_trim: 'walk' };
let stewStatus = '';
let stewBuilt = false;
const stewEls = {};

function applyEffectiveStyle() {
  renderer.applyBlockStyle?.(stewardshipPreview || cityStewardship);
}
function styleForSelection() {
  const t = stewSel.target;
  const style = { palette: stewSel.palette };
  if (t === 'arcade_front') style.sign_variant = stewSel.sign_variant;
  if (t !== 'sidewalk_trim') style.intensity = stewSel.intensity;
  return style;
}
function stwLine(cls) { const d = document.createElement('div'); d.className = cls; return d; }
function stwRow(labelText, values, labels, onPick) {
  const row = document.createElement('div'); row.className = 'stw-row';
  const lab = document.createElement('span'); lab.className = 'stw-lab'; lab.textContent = labelText; row.appendChild(lab);
  const chips = new Map();
  for (const v of values) {
    const c = document.createElement('button'); c.type = 'button'; c.className = 'stw-chip';
    c.textContent = (labels && labels[v]) || v;
    c.addEventListener('click', () => { onPick(v); });
    chips.set(v, c); row.appendChild(c);
  }
  return { row, chips };
}
function stwBtn(label, onClick) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'stw-btn';
  b.textContent = label; b.addEventListener('click', onClick); return b;
}
function setActiveChip(chips, val) { for (const [v, c] of chips) c.classList.toggle('active', v === val); }

function buildStewardship() {
  if (!stewardshipEl || stewBuilt) return;
  stewBuilt = true;
  stewardshipEl.textContent = '';
  const head = stwLine('stw-head'); head.textContent = 'BLOCK STEWARDSHIP';
  stewEls.elig = stwLine('stw-elig');
  stewEls.cur = stwLine('stw-cur');
  stewEls.targets = stwRow('TARGET', ALLOWED_TARGETS, TARGET_LABELS, (v) => { stewSel.target = v; updateStewardship(); });
  stewEls.palettes = stwRow('PALETTE', ALLOWED_PALETTES, null, (v) => { stewSel.palette = v; updateStewardship(); });
  stewEls.signs = stwRow('SIGN', ALLOWED_SIGN_VARIANTS, null, (v) => { stewSel.sign_variant = v; updateStewardship(); });
  stewEls.intens = stwRow('GLOW', ALLOWED_INTENSITY, null, (v) => { stewSel.intensity = v; updateStewardship(); });
  const actions = document.createElement('div'); actions.className = 'stw-actions';
  stewEls.preview = stwBtn('Preview', () => requestStew('preview'));
  stewEls.apply = stwBtn('Apply', () => requestStew('apply'));
  stewEls.reset = stwBtn('Reset', () => requestStew('reset'));
  actions.append(stewEls.preview, stewEls.apply, stewEls.reset);
  stewEls.status = stwLine('stw-status');
  stewardshipEl.append(head, stewEls.elig, stewEls.cur, stewEls.targets.row, stewEls.palettes.row, stewEls.signs.row, stewEls.intens.row, actions, stewEls.status);
}

function updateStewardship() {
  if (!stewardshipEl) return;
  buildStewardship();
  stewEls.elig.textContent = stewardEligible ? 'Eligibility: stewardship signal active.' : 'Eligibility: locked — raise host rank.';
  stewEls.elig.classList.toggle('on', stewardEligible);
  const s = stewardshipPreview || cityStewardship;
  stewEls.cur.textContent = `Block style: arcade ${s.arcade_front.palette} · street ${s.street_lights.palette} · walk ${s.sidewalk_trim.palette}${stewardshipPreview ? ' (preview)' : ''}`;
  setActiveChip(stewEls.targets.chips, stewSel.target);
  setActiveChip(stewEls.palettes.chips, stewSel.palette);
  setActiveChip(stewEls.signs.chips, stewSel.sign_variant);
  setActiveChip(stewEls.intens.chips, stewSel.intensity);
  stewEls.signs.row.hidden = stewSel.target !== 'arcade_front';   // sign variant is arcade-only
  stewEls.intens.row.hidden = stewSel.target === 'sidewalk_trim'; // sidewalk has no glow
  for (const b of [stewEls.preview, stewEls.apply, stewEls.reset]) b.disabled = !stewardEligible;
  stewEls.status.textContent = stewStatus;
}

function requestStew(action) {
  if (action === 'reset') { stewStatus = 'Resetting to city default…'; net.requestStewardship('reset'); updateStewardship(); return; }
  const style = styleForSelection();
  if (action === 'preview') {
    // optimistic LOCAL preview (clearly marked) — the server still confirms or rejects it
    stewardshipPreview = mergeBlockStyle(cityStewardship, stewSel.target, style);
    applyEffectiveStyle();
    stewStatus = 'Preview (local) — Apply to make it the block style.';
  } else {
    stewStatus = 'Applying…';
  }
  net.requestStewardship(action, stewSel.target, style);
  updateStewardship();
}

function onStewardshipResult(m) {
  window.__neon_city.lastStewardshipResult = m;
  if (!m || !m.ok) {
    stewardshipPreview = null; applyEffectiveStyle();
    stewStatus = `Rejected: ${(m && m.reason) || 'unknown'}`;
  } else if (m.action === 'preview') {
    if (m.preview_style) { stewardshipPreview = normalizeBlockStyle(m.preview_style); applyEffectiveStyle(); }
    stewStatus = 'Preview confirmed (not yet applied).';
  } else if (m.action === 'apply') {
    stewardshipPreview = null; stewStatus = 'Applied to the block.'; // canonical arrives via city_stewardship_state
  } else if (m.action === 'reset') {
    stewardshipPreview = null; stewStatus = 'Reset to city default.';
  }
  updateStewardship();
}

// ── send loop (bounded input rate, records each input for replay) ─────────────
let lastSend = performance.now();
setInterval(() => {
  if (status !== 'live') return;
  const now = performance.now();
  const dt = Math.min(now - lastSend, MOVEMENT.MAX_DT_MS);
  lastSend = now;
  const nonzero = input.dx !== 0 || input.dy !== 0;
  if (!nonzero && !lastSentNonzero) return;            // idle: send nothing
  lastSentNonzero = nonzero;
  const r = recordPendingInput(inputBuffer, { dx: input.dx, dy: input.dy, dt });
  inputBuffer = r.buffer;
  if (r.overflow && serverSelf) { displayed = { ...serverSelf }; predicted = { ...serverSelf }; net.requestSnapshot(); }
  net.sendInput(r.input.seq, Date.now(), r.input.dx, r.input.dy, r.input.dt);
}, SEND_MS);

// ── predict + reconcile + render loop ─────────────────────────────────────────
function frame() {
  if (serverSelf) {
    // authoritative-predicted = server pos + replay of unacknowledged inputs
    const r = reconcilePredictedState({ serverPos: serverSelf, pending: inputBuffer.pending, displayed });
    predicted = r.predicted;
    dbg = { error: r.error, snapped: r.snapped };
    if (r.snapped) { displayed = { ...predicted }; }
    else {
      displayed.x += (predicted.x - displayed.x) * DISPLAY_EASE;
      displayed.y += (predicted.y - displayed.y) * DISPLAY_EASE;
      let df = predicted.facing - displayed.facing; // shortest-arc facing ease (no heading snap)
      while (df > Math.PI) df -= 2 * Math.PI;
      while (df < -Math.PI) df += 2 * Math.PI;
      displayed.facing += df * 0.3;
    }
  }

  // remote players: interpolate buffered snapshots at (estimated server now - delay)
  const estServerNow = serverClock.lastServerTime + (performance.now() - serverClock.lastPerf);
  const sampled = sampleSnapshotAt(snapBuf, estServerNow - RENDER_DELAY_MS);
  const othersView = sampled.filter((p) => remoteIds.has(p.id));

  lastOthers = othersView;
  const meView = displayed ? { id: playerId, x: displayed.x, y: displayed.y, facing: displayed.facing } : null;
  activePortal = portalUnder(displayed);
  if (portalState !== 'requesting' && portalState !== 'accepted' && portalState !== 'rejected') {
    portalState = activePortal ? 'in_zone' : 'idle';
  }
  updatePortalUI();

  renderer.draw({ me: meView, others: othersView });
  minimap.draw({ me: meView, others: othersView });
  if (debugPanel && !debugPanel.hidden) debugPanel.textContent = debugText();
  requestAnimationFrame(frame);
}

function updatePortalUI() {
  const inZone = !!activePortal;
  if (portalPrompt) {
    portalPrompt.hidden = !inZone || portalState === 'accepted';
    if (inZone) portalPrompt.querySelector('.pp-name').textContent = activePortal.label;
    portalPrompt.classList.toggle('rejected', portalState === 'rejected');
  }
  if (portalBtn) portalBtn.hidden = !inZone || portalState === 'accepted';
}

function debugText() {
  const d = window.__neon_city.debug();
  return `renderer ${d.renderer}  ack ${d.ackSeq}  pending ${d.pending}  err ${d.error.toFixed(1)}${d.snapped ? ' SNAP' : ''}\n`
    + `snaps ${d.bufferLen}  remotes ${d.remotes}  portal ${d.portalState}  status ${d.status}`;
}

requestAnimationFrame(frame);

// ── test/automation hook (mirrors arcade's window.__neon) ─────────────────────
window.__neon_city = {
  authority: 'server',
  lastSnapshotAt: 0,
  lastPortalOk: null,
  lastError: null,
  get connected() { return status === 'live'; },
  get renderer() { return renderer.name; },
  get status() { return status; },
  get you() { return displayed ? { x: displayed.x, y: displayed.y, facing: displayed.facing } : null; },
  serverYou() { return serverSelf ? { ...serverSelf } : null; },
  players() { return [...remoteIds]; },
  othersView() { return lastOthers.map((p) => ({ id: p.id, x: p.x, y: p.y })); },
  layout() { return layout; },
  setInput(dx, dy) { input.dx = dx; input.dy = dy; },     // deterministic input for tests
  enterPortal() { tryPortal(); },
  get interiorOpen() { return interiorOpen; },            // Phase 4C
  closeInterior() { closeInterior(); },
  events() { return eventList.map((e) => ({ event_id: e.event_id, type: e.type, seq: e.seq, actor_public_id: e.actor_public_id })); },
  pressure() { return cityPressure ? { ...cityPressure.pressure, suggestions: (cityPressure.suggestions || []).map((s) => s.reason) } : null; }, // Phase 4D
  requestScheduler() { net.requestScheduler(); },
  hostRank() { return cityHostRank ? { ...cityHostRank.host_rank } : null; }, // Phase 4E
  requestHostRank() { net.requestHostRank(); },
  // Phase 4F — block stewardship (display/visual only; the server owns canonical truth)
  stewardship() { return JSON.parse(JSON.stringify(cityStewardship)); },
  blockStyle() { return JSON.parse(JSON.stringify(stewardshipPreview || cityStewardship)); }, // effective applied style
  eligible() { return stewardEligible; },
  lastStewardshipResult: null,
  previewStewardship(target, style) { net.requestStewardship('preview', target, style); },
  applyStewardship(target, style) { net.requestStewardship('apply', target, style); },
  resetStewardship() { net.requestStewardship('reset'); },
  debug() {
    return {
      renderer: renderer.name, ackSeq, pending: inputBuffer.pending.length,
      error: Number.isFinite(dbg.error) ? dbg.error : 0, snapped: dbg.snapped,
      bufferLen: snapBuf.snaps.length, remotes: remoteIds.size,
      renderDelayMs: RENDER_DELAY_MS, estServerNow: serverClock.lastServerTime + (performance.now() - serverClock.lastPerf),
      latestServerTime: latestServerTime(snapBuf), portalState,
    };
  },
  client: net,
};

applyEffectiveStyle();   // apply the (default) block style to the renderer up front
updateStewardship();     // build the stewardship panel so it is visible before server state
net.connect();
