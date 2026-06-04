/**
 * Neon Circuit — City Block scene orchestrator (browser entry).
 *
 * Wires input → client-side prediction → server reconciliation → rendering, plus the
 * arcade portal and HUD. The SERVER owns truth: the client predicts locally for
 * responsiveness using the SAME pure movement/collision functions the server runs,
 * then reconciles toward the authoritative snapshot (large divergence snaps back, so
 * the server visibly wins). Picks the Three.js renderer when available, else 2D.
 *
 * Scope + non-goals: docs/NEON_CIRCUIT_PHASE4_GTA80_CITY_BLOCK.md.
 */
import {
  publicLayout, MOVEMENT, normalizeInput, clampMovement, resolveCollision, resolveCityRoomId,
} from './city-block.mjs';
import { CityNet, resolveCityWsUrl } from './city-net.js';
import { createCanvas2DRenderer } from './city-render-canvas2d.js';
import { createThreeRenderer } from './city-render-three.js';

const params = new URLSearchParams(location.search);
const TEST = params.get('test') === '1';
const SEND_MS = 60;            // bounded client input rate (~16 Hz)
const SNAP_CORRECT = 0.12;     // gentle reconciliation toward the server position
const SNAP_HARD = 60;          // divergence beyond this (units) snaps to the server

const playerId = params.get('id') || `city-${Math.random().toString(36).slice(2, 8)}`;
const cityId = resolveCityRoomId(params.get('city')).cityId;

// ── DOM ──────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('cityCanvas');
const el = (id) => document.getElementById(id);
const statusDot = el('statusDot');
const statusTxt = el('statusTxt');
const portalPrompt = el('portalPrompt');
const portalBtn = el('portalBtn');
const rendererTag = el('rendererTag');
el('playerName').textContent = playerId;

// ── scene state ────────────────────────────────────────────────────────────
let layout = publicLayout();
let me = null;                       // server-confirmed identity {id,...}
let predicted = null;                // locally-predicted {x,y,facing}
let serverMe = null;                 // last authoritative position for me
const others = new Map();            // id -> { target:{x,y,facing}, render:{x,y,facing} }
const input = { dx: 0, dy: 0 };
let seq = 0;
let lastSentNonzero = false;
let status = 'connecting';
let activePortal = null;

// ── renderer (Three.js if present + working, else 2D) ─────────────────────────
let renderer;
const want = params.get('renderer');
if (want !== '2d' && want !== 'canvas2d' && window.THREE) {
  try { renderer = createThreeRenderer(canvas, layout); }
  catch (e) { console.warn('[city] three init failed, using 2D fallback:', e?.message); }
}
if (!renderer) renderer = createCanvas2DRenderer(canvas, layout);
rendererTag.textContent = renderer.name;
window.addEventListener('resize', () => renderer.resize());

// ── networking ────────────────────────────────────────────────────────────
const net = new CityNet({
  wsUrl: resolveCityWsUrl({ explicit: params.get('ws'), config: window.__NEON_ARCADE_CONFIG__, location }),
  playerId, cityId,
  handlers: {
    onStatus: setStatus,
    onWelcome: (m) => {
      if (m.layout) layout = m.layout;
      if (m.you) {
        me = m.you;
        predicted = { x: m.you.x, y: m.you.y, facing: m.you.facing };
        serverMe = { x: m.you.x, y: m.you.y, facing: m.you.facing };
      }
      for (const p of (m.players || [])) if (p.id !== playerId) upsertOther(p);
    },
    onSnapshot: (m) => {
      window.__neon_city.lastSnapshotAt = Date.now();
      const seen = new Set();
      for (const p of m.players) {
        seen.add(p.id);
        if (p.id === playerId) serverMe = { x: p.x, y: p.y, facing: p.facing };
        else upsertOther(p);
      }
      for (const id of [...others.keys()]) if (!seen.has(id)) others.delete(id);
    },
    onPlayerJoined: (m) => { if (m.id !== playerId) upsertOther({ id: m.id, x: m.x, y: m.y, facing: 0 }); },
    onPlayerLeft: (m) => { others.delete(m.id); },
    onPortalOk: (m) => {
      window.__neon_city.lastPortalOk = { portalId: m.portalId, target: m.target, at: Date.now() };
      if (!TEST) location.assign(m.target);
    },
    onError: (m) => { window.__neon_city.lastError = m; if (m.code !== 'portal_not_in_zone') console.warn('[city] server error:', m.code); },
  },
});

function upsertOther(p) {
  const cur = others.get(p.id);
  if (cur) { cur.target = { x: p.x, y: p.y, facing: p.facing }; }
  else others.set(p.id, { target: { x: p.x, y: p.y, facing: p.facing }, render: { x: p.x, y: p.y, facing: p.facing } });
}

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
  pad.addEventListener('pointerdown', (e) => { padId = e.pointerId; pad.setPointerCapture(padId); const r = pad.getBoundingClientRect(); padVec(r.left + r.width / 2, r.top + r.height / 2, e.clientX, e.clientY); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId !== padId) return; const r = pad.getBoundingClientRect(); padVec(r.left + r.width / 2, r.top + r.height / 2, e.clientX, e.clientY); });
  const end = (e) => { if (e.pointerId !== padId) return; padId = null; input.dx = 0; input.dy = 0; nub.style.transform = 'translate(0,0)'; };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
}

// ── portal ────────────────────────────────────────────────────────────────
function portalUnder(p) {
  if (!p) return null;
  for (const z of layout.portals) if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) return z;
  return null;
}
function tryPortal() { if (activePortal) net.enterPortal(activePortal.id); }
if (portalBtn) portalBtn.addEventListener('click', tryPortal);

// ── send loop (bounded) ──────────────────────────────────────────────────────
setInterval(() => {
  if (status !== 'live') return;
  const nonzero = input.dx !== 0 || input.dy !== 0;
  if (nonzero) { seq += 1; net.sendInput(seq, Date.now(), input.dx, input.dy); lastSentNonzero = true; }
  else if (lastSentNonzero) { seq += 1; net.sendInput(seq, Date.now(), 0, 0); lastSentNonzero = false; }
}, SEND_MS);

// ── predict + reconcile + render loop ─────────────────────────────────────────
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(now - lastT, MOVEMENT.MAX_DT_MS);
  lastT = now;

  if (predicted) {
    const intent = normalizeInput({ dx: input.dx, dy: input.dy });
    const next = resolveCollision({ x: predicted.x, y: predicted.y }, clampMovement({ x: predicted.x, y: predicted.y }, intent, dt));
    predicted.x = next.x; predicted.y = next.y;
    if (intent.dx !== 0 || intent.dy !== 0) predicted.facing = Math.atan2(intent.dy, intent.dx);
    // reconcile toward the authoritative server position
    if (serverMe) {
      const err = Math.hypot(serverMe.x - predicted.x, serverMe.y - predicted.y);
      if (err > SNAP_HARD) { predicted.x = serverMe.x; predicted.y = serverMe.y; }
      else { predicted.x += (serverMe.x - predicted.x) * SNAP_CORRECT; predicted.y += (serverMe.y - predicted.y) * SNAP_CORRECT; }
    }
  }

  // interpolate remote players
  const othersView = [];
  for (const [id, o] of others) {
    o.render.x += (o.target.x - o.render.x) * 0.25;
    o.render.y += (o.target.y - o.render.y) * 0.25;
    o.render.facing = o.target.facing;
    othersView.push({ id, x: o.render.x, y: o.render.y, facing: o.render.facing });
  }

  const meView = predicted ? { id: playerId, x: predicted.x, y: predicted.y, facing: predicted.facing } : null;
  activePortal = portalUnder(predicted);
  if (portalPrompt) portalPrompt.hidden = !activePortal;
  if (portalBtn) portalBtn.hidden = !activePortal;
  if (activePortal && portalPrompt) portalPrompt.querySelector('.pp-name').textContent = activePortal.label;

  renderer.draw({ me: meView, others: othersView });
  requestAnimationFrame(frame);
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
  get you() { return predicted ? { x: predicted.x, y: predicted.y, facing: predicted.facing } : null; },
  serverYou() { return serverMe ? { ...serverMe } : null; },
  players() { return [...others.keys()]; },
  layout() { return layout; },
  setInput(dx, dy) { input.dx = dx; input.dy = dy; },     // deterministic input for tests
  enterPortal() { tryPortal(); },
  client: net,
};

net.connect();
