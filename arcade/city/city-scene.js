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
import { publicLayout, MOVEMENT, predictStep, resolveCityRoomId, getCity } from './city-block.mjs';
import { isPointWalkable, nearestSafePoint } from './city-collision.mjs'; // Phase 7B walkable-boundary kernel
import { deriveInteractionZones, nearestInteractionZone, actionRequestFor, publicZone } from './city-interactions.mjs'; // Phase 7A interaction zones
import {
  createInputBuffer, recordPendingInput, dropAcknowledgedInputs, reconcilePredictedState, DISPLAY_EASE,
} from './city-reconcile.mjs';
import { createSnapshotBuffer, pushSnapshot, sampleSnapshotAt, latestServerTime } from './city-snapshots.mjs';
import {
  defaultBlockStyle, normalizeBlockStyle, mergeBlockStyle, isStewardshipEligible, styleToAccents,
  ALLOWED_TARGETS, ALLOWED_PALETTES, ALLOWED_SIGN_VARIANTS, ALLOWED_INTENSITY,
} from './city-stewardship.mjs';
import { CityNet, resolveCityWsUrl } from './city-net.js';
import { mergePresenceDelta } from './city-district-presence.mjs';
import {
  deriveActivitiesFromDelta, activityForRouteRequested, activityForRouteResult,
  activityForArrival, activityForDistrictEvent, appendActivity, ACTIVITY_FEED_MAX,
} from './city-district-activity.mjs';
import { districtEventWindow, deriveDistrictAnnouncements, formatCountdown } from './city-district-events.mjs';
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
const trialEl = el('cityBlockTrial');
const districtEl = el('cityDistrict');
const rendererTag = el('rendererTag');
const debugPanel = el('debugPanel');
el('playerName').textContent = playerId;

// ── scene state ────────────────────────────────────────────────────────────
let layout = publicLayout();
let interactionZones = deriveInteractionZones(cityId, layout); // Phase 7A: derived from public layout
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
let cityTrial = null;                 // Phase 4G: last Block Trial state from the server (display only)
let cityDistrict = null;              // Phase 5A: last district manifest (display only; server-owned)
let routeStatus = '';                 // Phase 5A: transient route feedback line
let districtLiveAt = 0;               // Phase 5D: last time district presence updated (full manifest OR push delta)
const DISTRICT_STALE_MS = 45000;      // Phase 5D: beyond this with no push → show degraded + safety re-request
let cityActivity = [];                // Phase 5E: derived district activity feed (display-only, local history)
let travelingTo = null;               // Phase 5E: target block of an in-flight travel (for arrival detection)
let seededArrival = false;            // Phase 5E/6A: have we seeded the initial arrival? (decoupled from feed contents)
const ACTIVITY_UI_MAX = 8;            // how many of the bounded buffer the district panel shows
let cityEvent = null;                 // Phase 6A: current district-event window view (display-only, client-derived)
const announcedEventKeys = new Set(); // Phase 6A: dedupe keys for already-announced district events
const ANNOUNCED_KEYS_MAX = 48;        // bound the dedupe set across many windows
const EVENT_TICK_MS = 20000;          // re-evaluate the schedule ~every 20s (catch window flips / pre-roll)
let serverEventSnapshot = null;       // Phase 6B: last server-authored public-safe district-event snapshot
let serverEventConfig = null;         // Phase 6B: adopted config {enabled,windowMs,showNext} (null → 6A defaults)

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
      if (m.layout) { layout = m.layout; renderer.setLayout?.(layout); interactionZones = deriveInteractionZones(net.cityId, layout); } // Phase 5B labels + Phase 7A zones on (re)connect/travel
      if (m.you) {
        serverSelf = { x: m.you.x, y: m.you.y, facing: m.you.facing };
        predicted = { ...serverSelf };
        displayed = { ...serverSelf };
        ackSeq = m.you.seq || 0;
      }
      inputBuffer = createInputBuffer();
      net.requestSnapshot(); // populate remote interpolation buffer promptly
      // Phase 5E: an arrival in a TRAVELED-to block (or the very first connect) logs an arrival.
      // A plain auto-reconnect to the same block logs nothing. Phase 6A: gate on an explicit
      // seededArrival flag (not feed emptiness — the feed may already carry a district-event item).
      if (travelingTo && net.cityId === travelingTo) { recordActivity(activityForArrival(net.cityId, blockName(net.cityId))); travelingTo = null; seededArrival = true; }
      else if (!seededArrival) { recordActivity(activityForArrival(net.cityId, blockName(net.cityId))); seededArrival = true; }
      pollDistrictEvents();   // Phase 6A: refresh the district-event pulse on (re)connect (also re-renders)
      renderDistrict();
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
    onTrialState: (m) => { cityTrial = m && m.trial; updateTrial(); },
    onTrialResult: (m) => { onTrialResult(m); },
    onBlocks: (m) => {                                                         // Phase 5A: full district manifest (initial snapshot)
      cityDistrict = m; districtLiveAt = Date.now();
      if (m && m.event && typeof m.event === 'object') adoptServerEventSnapshot(m.event); // Phase 6B: server-authored event snapshot
      renderDistrict();
    },
    onDistrictPresence: (m) => {                                              // Phase 5D: push-on-change presence delta
      if (window.__neon_city) { window.__neon_city.lastDistrictPresence = m; window.__neon_city.districtPushCount++; }
      if (!cityDistrict) return;                                             // wait for the full manifest baseline
      // Phase 5E: derive district activity from the change BEFORE merging (needs the prior summary).
      for (const a of deriveActivitiesFromDelta(m, cityDistrict, Date.now())) recordActivity(a);
      cityDistrict = mergePresenceDelta(cityDistrict, m);
      districtLiveAt = Date.now();
      renderDistrict();
    },
    onRouteResult: (m) => { onRouteResult(m); },                              // Phase 5A: route confirmation
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
  if (cityDistrict) renderDistrict(); // Phase 5D: reflect connect/disconnect in the live indicator at once
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
  // Phase 7A: the arcade prompt is driven by the interaction-zone kernel. The arcade_entry zone
  // is a backward-compatible SUPERSET of the portal object (keeps id/x/y/w/h/target/label), so
  // activePortal.id (tryPortal → enterPortal) and activePortal.label below behave exactly as
  // before — the server portal gate (city-block.mjs enterPortal) is unchanged.
  const z = nearestInteractionZone(p, interactionZones);
  return z && z.kind === 'arcade_entry' ? z : null;
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
    case 'city_block_trial_requested': return `${who} opened a block trial`;
    case 'city_block_trial_started': return `block trial started · ${(e.payload && e.payload.objective) || 'signal grid'}`;
    case 'city_block_trial_joined': return `${who} joined the block trial`;
    case 'city_block_trial_updated': return `block trial · ${(e.payload && e.payload.score) || 0}/${(e.payload && e.payload.score_cap) || 3} nodes`;
    case 'city_block_trial_completed': return `block trial complete · ${(e.payload && e.payload.reason) || 'done'} (${(e.payload && e.payload.stabilized_count) || 0}/${(e.payload && e.payload.score_cap) || 3})`;
    case 'city_block_trial_rejected': return `block trial unavailable (${(e.payload && e.payload.reason) || 'denied'})`;
    case 'city_block_trial_closed': return `block trial closed · public block unchanged`;
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

// ── city-OS District panel (Phase 5A; multi-block discovery + bounded routing) ──
// Shows the current block + adjacent blocks with a Travel control. The server owns the
// route truth; on a confirmed route_result the client reconnects to the target block,
// whose authority admits the player. Discovery/travel only — no ownership/rent/claim.
// textContent + button elements only (no innerHTML, no economy copy).
function currentBlock() {
  if (!cityDistrict) return null;
  return (cityDistrict.blocks || []).find((b) => b.city_id === cityDistrict.current_city_id) || null;
}
// Phase 5E: resolve a block's friendly name from the manifest, falling back to the static city
// config (so an arrival logged before the new manifest arrives still reads "Arrived in Skyline").
function blockName(cityId) {
  const b = cityDistrict && (cityDistrict.blocks || []).find((x) => x.city_id === cityId);
  if (b && b.display_name) return b.display_name;
  const c = getCity(cityId);
  return (c && c.display_name) || cityId;
}
// Phase 5E: record a derived, public-safe district activity item into the bounded local feed.
// Display-only: nothing canonical reads this back; the server still owns presence/route truth.
function recordActivity(item) {
  if (!item) return;
  cityActivity = appendActivity(cityActivity, item, ACTIVITY_FEED_MAX);
  if (window.__neon_city) window.__neon_city.lastDistrictActivity = item;
}
// Phase 6B: adopt the server-authored district-event snapshot (from city_blocks). The server is
// authoritative for the schedule CONFIG (enabled/window/show-next); the client runs the SAME pure
// schedule with that config so current/next stay in sync. Sanitized; old behavior if absent.
function adoptServerEventSnapshot(snap) {
  serverEventSnapshot = snap;
  serverEventConfig = {
    enabled: snap.enabled !== false,
    windowMs: Number.isFinite(snap.window_ms) ? snap.window_ms : undefined,
    showNext: snap.show_next !== false,
  };
  pollDistrictEvents();
}
// Phase 6A: recompute the deterministic district-event window for `now`, surface any NEW
// (deduped) public announcements into the activity feed, and refresh the district panel.
// Display-only + entirely client-derived: nothing canonical reads this; the schedule is a pure
// function of the clock + the static block manifest. Reconnect/reload recompute and dedupe.
function pollDistrictEvents(now = Date.now()) {
  // Phase 6B: prefer the server-authored config when present; both sides run the SAME pure schedule
  // so the client stays in sync with the server without a per-transition push. null → 6A defaults.
  const cfg = serverEventConfig || undefined;
  if (serverEventConfig && serverEventConfig.enabled === false) {
    cityEvent = null;                       // operator disabled district events → hide the pulse
    renderDistrict();
    return cityEvent;
  }
  cityEvent = districtEventWindow(now, cfg);
  if (serverEventConfig && serverEventConfig.showNext === false && cityEvent) cityEvent.next = null;
  const { events, keys } = deriveDistrictAnnouncements(now, announcedEventKeys, cfg);
  for (let i = 0; i < events.length; i++) {
    announcedEventKeys.add(keys[i]);
    recordActivity(activityForDistrictEvent(events[i], now));
    if (window.__neon_city) window.__neon_city.lastDistrictEventAnnounced = events[i];
  }
  // Bound the dedupe set so it can't grow unbounded across many windows (keep the newest keys).
  if (announcedEventKeys.size > ANNOUNCED_KEYS_MAX) {
    const kept = [...announcedEventKeys].slice(-Math.floor(ANNOUNCED_KEYS_MAX / 2));
    announcedEventKeys.clear();
    for (const k of kept) announcedEventKeys.add(k);
  }
  renderDistrict();
  return cityEvent;
}
// Phase 6C: lightweight 1s countdown ticker — updates only the countdown text in place (no panel
// rebuild). When the current window's time runs out, re-derive the schedule (flips the card + fires
// announcements). Display-only; reads only the clock + the already-derived cityEvent.
function updateEventCountdown(now = Date.now()) {
  if (!cityEvent || !cityEvent.current || !districtEl) return;
  const remaining = cityEvent.ends_at - now;
  if (remaining <= 0) { pollDistrictEvents(now); return; }  // window ended → re-derive + re-render
  const cdv = districtEl.querySelector('.dist-event-countdown');
  if (cdv) cdv.textContent = formatCountdown(remaining);
  const nxc = districtEl.querySelector('.dist-event-next-countdown');
  if (nxc && cityEvent.next) nxc.textContent = 'in ' + formatCountdown(cityEvent.next.starts_at - now);
}
function renderDistrict() {
  if (!districtEl) return;
  districtEl.textContent = '';
  if (!cityDistrict) {
    const wait = document.createElement('div'); wait.className = 'dist-line'; wait.textContent = 'DISTRICT · locating…';
    districtEl.appendChild(wait);
    return;
  }
  const cur = currentBlock();
  // keep the topbar honest after travel (the const cityId is construction-only)
  const sub = document.querySelector('.brand .sub');
  if (sub && cur) sub.textContent = `${cur.display_name.toLowerCase()} · prototype`;

  // Phase 5C: live, public-safe per-block presence (a count + health; never player data).
  const peopleLabel = (b) => `${b.population || 0} here`;

  const head = document.createElement('div'); head.className = 'dist-head';
  head.textContent = `DISTRICT · ${cur ? cur.display_name : cityDistrict.current_city_id}`;
  // Phase 5D: subtle live/degraded indicator. Presence is PUSHED on change, so "live" tracks the
  // connection (the stream that carries deltas). Disconnected → "offline"; connected but no
  // push/manifest within the stale window → "refresh" (the safety re-request is about to fire).
  const live = document.createElement('span'); live.className = 'dist-live';
  if (status !== 'live') { live.textContent = ' · offline'; live.classList.add('dist-quiet'); }
  else if (!districtLiveAt || (Date.now() - districtLiveAt) > DISTRICT_STALE_MS) { live.textContent = ' · refresh'; live.classList.add('dist-quiet'); }
  else { live.textContent = ' · ◦ live'; }
  head.appendChild(live);
  districtEl.appendChild(head);
  const line = document.createElement('div'); line.className = 'dist-line';
  line.textContent = cur ? `theme ${cur.theme} · ${peopleLabel(cur)}` : 'current block';
  districtEl.appendChild(line);

  // Phase 6A/6C: district PULSE — a richer (but still non-dominant) event CARD with a live countdown
  // and active/pre-roll visual states. textContent only; CSS-only visuals; reduced-motion safe.
  // Display/atmosphere only — no economy/ownership. The countdown ticks in updateEventCountdown().
  if (cityEvent && cityEvent.current) {
    const preroll = !!cityEvent.preroll;
    const ev = document.createElement('div'); ev.className = 'dist-event ' + (preroll ? 'is-preroll' : 'is-active');
    const title = document.createElement('div'); title.className = 'dist-event-title';
    const tt = document.createElement('span'); tt.className = 'dist-event-name'; tt.textContent = cityEvent.current.label;
    const chip = document.createElement('span'); chip.className = 'dist-event-chip'; chip.textContent = preroll ? 'soon' : 'now';
    title.appendChild(tt); title.appendChild(chip);
    ev.appendChild(title);
    const sum = document.createElement('div'); sum.className = 'dist-event-sum'; sum.textContent = cityEvent.current.summary;
    ev.appendChild(sum);
    // Phase 6C: live countdown to the end of the current window ("ends in m:ss").
    const meta = document.createElement('div'); meta.className = 'dist-event-meta';
    const ml = document.createElement('span'); ml.className = 'dist-event-meta-label'; ml.textContent = 'ends in ';
    const cdv = document.createElement('span'); cdv.className = 'dist-event-countdown'; cdv.textContent = formatCountdown(cityEvent.ends_at - Date.now());
    meta.appendChild(ml); meta.appendChild(cdv);
    ev.appendChild(meta);
    if (cityEvent.next && (!serverEventConfig || serverEventConfig.showNext !== false)) {
      const nx = document.createElement('div'); nx.className = 'dist-event-next' + (preroll ? ' dist-event-soon' : '');
      nx.appendChild(document.createTextNode(`Up next: ${cityEvent.next.label} · `));
      const nxc = document.createElement('span'); nxc.className = 'dist-event-next-countdown'; nxc.textContent = 'in ' + formatCountdown(cityEvent.next.starts_at - Date.now());
      nx.appendChild(nxc);
      ev.appendChild(nx);
    }
    districtEl.appendChild(ev);
  }

  const nearby = (cur ? cur.adjacent : [])
    .map((id) => (cityDistrict.blocks || []).find((b) => b.city_id === id))
    .filter(Boolean);
  if (!nearby.length) {
    const none = document.createElement('div'); none.className = 'dist-line dist-none'; none.textContent = 'no adjacent blocks';
    districtEl.appendChild(none);
  }
  for (const b of nearby) {
    const row = document.createElement('div'); row.className = 'dist-row';
    const name = document.createElement('span'); name.className = 'dist-name';
    name.textContent = `${b.display_name} · ${peopleLabel(b)}`;
    if (b.health && b.health !== 'healthy') name.classList.add('dist-quiet');
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'dist-travel'; btn.textContent = 'Travel';
    btn.addEventListener('click', () => { recordActivity(activityForRouteRequested(b.city_id, b.display_name)); routeStatus = `routing to ${b.display_name}…`; renderDistrict(); net.requestRoute(b.city_id); });
    row.appendChild(name); row.appendChild(btn);
    districtEl.appendChild(row);
  }
  if (routeStatus) {
    const st = document.createElement('div'); st.className = 'dist-status'; st.textContent = routeStatus;
    districtEl.appendChild(st);
  }
  // Phase 5E: District Activity feed — newest-first, public-safe, derived display (bounded).
  // textContent only; distinct from the World Log (which carries within-block server events).
  if (cityActivity.length) {
    const ah = document.createElement('div'); ah.className = 'dist-act-head'; ah.textContent = 'DISTRICT ACTIVITY';
    districtEl.appendChild(ah);
    const list = document.createElement('div'); list.className = 'dist-act-list'; list.setAttribute('role', 'log'); list.setAttribute('aria-live', 'polite');
    for (const a of cityActivity.slice(0, ACTIVITY_UI_MAX)) {
      const row = document.createElement('div');
      row.className = 'dist-act' + (a.severity === 'warn' ? ' dist-quiet' : a.severity === 'good' ? ' dist-good' : '');
      row.textContent = a.label;
      list.appendChild(row);
    }
    districtEl.appendChild(list);
  }
}
function onRouteResult(m) {
  window.__neon_city.lastRouteResult = m;
  if (m && m.ok && typeof m.target_city_id === 'string') {
    travelingTo = m.target_city_id;                                  // Phase 5E: expect an arrival in this block
    recordActivity(activityForRouteResult(m, blockName(m.target_city_id)));
    routeStatus = `traveling to ${blockName(m.target_city_id)}…`;
    renderDistrict();
    net.switchCity(m.target_city_id); // reconnect to the target block; its welcome re-pushes city_blocks
  } else {
    routeStatus = `route blocked: ${String((m && m.reason) || 'denied').replace(/_/g, ' ')}`;
    renderDistrict();
    setTimeout(() => { if (routeStatus.startsWith('route blocked')) { routeStatus = ''; renderDistrict(); } }, 1600);
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

// ── Block Trial (Phase 4G; instanced, non-destructive; server-owned match truth) ──
// The client shows the trial and sends intent (request/join/close); the server owns
// creation, the timer, node state, score, and outcome. Movement is the existing city
// authority. textContent only; fixed buttons; no money/ownership copy.
let trialBuilt = false;
let trialStatusMsg = '';
const trialEls = {};

function trialActive() { return !!cityTrial && cityTrial.status === 'active'; }
function trialView() {
  if (!cityTrial || !Array.isArray(cityTrial.signal_nodes) || cityTrial.status === 'closed') return null;
  const accent = cityTrial.copied_style ? styleToAccents(cityTrial.copied_style).street_lights.color : null;
  return { nodes: cityTrial.signal_nodes.map((n) => ({ x: n.x, y: n.y, stabilized: n.stabilized })), accent };
}

function buildTrial() {
  if (!trialEl || trialBuilt) return;
  trialBuilt = true;
  trialEl.textContent = '';
  const head = stwLine('bt-head'); head.textContent = 'BLOCK TRIAL';
  trialEls.obj = stwLine('bt-line');
  trialEls.status = stwLine('bt-line');
  trialEls.score = stwLine('bt-score');
  trialEls.style = stwLine('bt-line');
  const actions = document.createElement('div'); actions.className = 'bt-actions';
  trialEls.start = stwBtn('Start', () => { trialStatusMsg = 'Requesting trial…'; net.requestTrial(); updateTrial(); });
  trialEls.join = stwBtn('Join', () => { trialStatusMsg = 'Joining…'; net.joinTrial(); updateTrial(); });
  trialEls.close = stwBtn('Close', () => { trialStatusMsg = 'Closing…'; net.closeTrial(); updateTrial(); });
  actions.append(trialEls.start, trialEls.join, trialEls.close);
  trialEls.note = stwLine('bt-note');
  trialEls.msg = stwLine('bt-status');
  trialEl.append(head, trialEls.obj, trialEls.status, trialEls.score, trialEls.style, actions, trialEls.note, trialEls.msg);
}

function updateTrial() {
  if (!trialEl) return;
  buildTrial();
  const active = trialActive();
  const t = cityTrial;
  trialEls.obj.textContent = 'Objective: stabilize 3 signal nodes.';
  trialEls.status.textContent = `Status: ${t ? t.status : 'no trial'}.`;
  trialEls.score.textContent = t ? `Score: ${t.stabilized_count ?? t.score} / ${t.score_cap} nodes stabilized.` : 'Score: —';
  const cs = t && t.copied_style ? t.copied_style : null;
  trialEls.style.textContent = cs ? `Copied style: arcade ${cs.arcade_front.palette} · street ${cs.street_lights.palette}.` : 'Copied style: city default.';
  // Start needs stewardship eligibility + no active trial; Join needs an active trial; Close needs a trial.
  trialEls.start.disabled = !stewardEligible || active;
  trialEls.join.disabled = !active;
  trialEls.close.disabled = !t || t.status === 'closed';
  trialEls.note.textContent = (t && (t.status === 'complete' || t.status === 'closed')) ? 'No public block changes were made.' : '';
  trialEls.msg.textContent = trialStatusMsg;
}

function onTrialResult(m) {
  window.__neon_city.lastTrialResult = m;
  if (!m || !m.ok) trialStatusMsg = `Trial: ${(m && m.reason) || 'unavailable'}`;
  else if (m.action === 'request') trialStatusMsg = 'Trial started — stabilize the signal nodes.';
  else if (m.action === 'join') trialStatusMsg = 'Joined the trial.';
  else if (m.action === 'close') trialStatusMsg = 'Trial closed. No public block changes were made.';
  updateTrial();
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
    // Phase 7B: display-only walkable-boundary guard. The server position is already
    // collision-resolved; this keeps the EASED avatar from visually clipping into a wall or
    // (future) blocked zone, and wires the kernel boundary model into the client render path.
    // With the live BLOCKED_ZONES set empty this is a no-op in normal play.
    if (displayed && !isPointWalkable(displayed.x, displayed.y, net.cityId)) {
      const safe = nearestSafePoint(displayed.x, displayed.y, net.cityId);
      displayed.x = safe.x;
      displayed.y = safe.y;
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

  renderer.draw({ me: meView, others: othersView, trial: trialView() });
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
  // Phase 4G — instanced, non-destructive Block Trial (display only; server owns match truth)
  trial() { return cityTrial ? JSON.parse(JSON.stringify(cityTrial)) : null; },
  lastTrialResult: null,
  requestTrial() { net.requestTrial(); },
  joinTrial() { net.joinTrial(); },
  closeTrial() { net.closeTrial(); },
  // Phase 5A — multi-block district (display only; the server owns route truth)
  district() { return cityDistrict ? JSON.parse(JSON.stringify(cityDistrict)) : null; },
  lastRouteResult: null,
  // Phase 5D — push-on-change district presence (display only; server-derived)
  lastDistrictPresence: null,        // last presence delta received (for tests/automation)
  districtPushCount: 0,              // how many push deltas have been applied
  get districtLiveAt() { return districtLiveAt; },
  // Phase 5E — district activity feed (display only; client-derived from server-authored facts)
  activity() { return cityActivity.map((a) => ({ type: a.type, city_id: a.city_id, label: a.label, severity: a.severity, occurred_at: a.occurred_at, public_safe: a.public_safe })); },
  lastDistrictActivity: null,
  // Phase 6A — scheduled district events (display only; deterministic, client-derived from the clock)
  districtEvent() { return cityEvent ? JSON.parse(JSON.stringify(cityEvent)) : null; },
  lastDistrictEventAnnounced: null,
  pollDistrictEvents(nowMs) { const w = pollDistrictEvents(Number.isFinite(nowMs) ? nowMs : Date.now()); return w ? JSON.parse(JSON.stringify(w)) : null; },
  // Phase 6B — server-authored event snapshot (display only; server owns the schedule config)
  serverDistrictEvent() { return serverEventSnapshot ? JSON.parse(JSON.stringify(serverEventSnapshot)) : null; },
  // Phase 6C — drive the live countdown ticker deterministically (display only)
  tickEventCountdown(nowMs) { updateEventCountdown(Number.isFinite(nowMs) ? nowMs : Date.now()); },
  get cityId() { return net.cityId; },
  // Phase 7A: interaction-zone kernel surface (display model; server confirms actions in 7E)
  interactionZones() { return interactionZones.map(publicZone); },
  activeZone() { const z = displayed ? nearestInteractionZone(displayed, interactionZones) : null; return z ? publicZone(z) : null; },
  actionRequest() { const z = displayed ? nearestInteractionZone(displayed, interactionZones) : null; return z ? actionRequestFor(z) : null; },
  requestBlocks() { net.requestBlocks(); },
  routeTo(targetCityId) { net.requestRoute(targetCityId); },
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
updateTrial();           // build the Block Trial panel so it is visible before server state
pollDistrictEvents();    // Phase 6A: seed the district-event pulse before server state arrives
renderDistrict();        // show the district panel placeholder before server state arrives
net.connect();
// Phase 6A: keep the district-event pulse fresh — re-evaluate the deterministic schedule so the
// banner advances and pre-roll/active/ended announcements surface as windows turn over. Display-only.
setInterval(() => pollDistrictEvents(), EVENT_TICK_MS);
// Phase 6C: 1s countdown ticker (text-only in-place update; flips the card when a window ends).
setInterval(() => updateEventCountdown(), 1000);
// Phase 5D: district presence is now PUSHED on change (no steady polling). Keep only a slow
// degraded-state safety net — if connected but no push/manifest has arrived within the stale
// window, re-request once. renderDistrict also reflects this as a "refresh" indicator.
setInterval(() => {
  if (net.connected && (!districtLiveAt || Date.now() - districtLiveAt > DISTRICT_STALE_MS)) net.requestBlocks();
}, 15000);
