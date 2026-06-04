/**
 * city-dev-shim.mjs — TEST / DEV ONLY. NOT production.
 *
 * A tiny Node WebSocket server that speaks the exact Phase 4A city protocol so the
 * browser city scene + Playwright smoke can run locally under Node (wrangler dev
 * needs Node >=22 here). It is the parity twin of the CityRoom Durable Object: both
 * are thin transports over the SAME pure authority core (arcade/city/city-block.mjs),
 * so movement clamping, collision, and the portal gate are identical by construction.
 *
 * Isolated from the arcade dev shim (workers/arcade/dev-shim.mjs) on its own port +
 * path (/arcade/city/ws), so the arcade transport is untouched.
 */
import { WebSocketServer } from 'ws';
import {
  resolveCityRoomId, getCity, isValidPlayerId, createCityState, addPlayer, applyInput, removePlayer,
  touchPlayer, stalePlayerIds, enterPortal, welcomePayload, citySnapshot,
} from '../../arcade/city/city-block.mjs';
import { createEventLog, appendCityEvent, cityEventsPayload, recentEvents } from '../../arcade/city/city-events.mjs';
import { evaluatePressure, pressureChanged, suggestionReasons, schedulerStatePayload, isBaselinePressure } from '../../arcade/city/city-scheduler.mjs';

const PORT = Number(process.env.CITY_PORT || process.env.PORT || 8788);
const STALE_SWEEP_MS = 30_000;
const SNAP_REQ_MIN_MS = 250;

const cities = {};                 // cityId -> pure city state
const eventLogs = {};              // cityId -> append-only world event log (Phase 4C)
const pressures = {};              // cityId -> last Hive-Scheduler snapshot (Phase 4D)
const sockets = new Map();         // ws -> { playerId, cityId, interiorOpen, ... }

const cityState = (cityId) => (cities[cityId] ||= createCityState());
const eventLog = (cityId) => (eventLogs[cityId] ||= createEventLog());
const send = (ws, p) => { try { ws.send(JSON.stringify(p)); } catch { /* closing */ } };
const broadcast = (cityId, p) => { for (const [ws, m] of sockets) if (m.cityId === cityId) send(ws, p); };
const broadcastExcept = (except, cityId, p) => { for (const [ws, m] of sockets) if (ws !== except && m.cityId === cityId) send(ws, p); };
const snapshot = (cityId, now) => broadcast(cityId, { t: 'city_snapshot', cityId, ...citySnapshot(cityState(cityId), now) });
// Append a SERVER-AUTHORED public-safe world event + broadcast it live (DO parity).
function emit(cityId, type, actorPublicId, payload = {}) {
  const r = appendCityEvent(eventLog(cityId), { type, cityId, actorPublicId, payload, now: Date.now() });
  eventLogs[cityId] = r.log;
  broadcast(cityId, { t: 'city_event', event: r.event });
}
function hasSocketFor(cityId, playerId) {
  for (const m of sockets.values()) if (m.cityId === cityId && m.playerId === playerId) return true;
  return false;
}

// Phase 4D: re-evaluate non-authoritative city pressure (DO parity). Emits a tick /
// new suggestions only on change (bounded), broadcasts scheduler state, returns changed.
function evaluateScheduler(cityId) {
  const now = Date.now();
  const occupancy = Object.keys(cityState(cityId).players).length;
  const snap = evaluatePressure({ cityId, now, recentEvents: recentEvents(eventLog(cityId)), occupancy });
  const prev = pressures[cityId];
  const meaningful = pressureChanged(prev, snap) && !(!prev && isBaselinePressure(snap)); // first idle eval is not news
  if (meaningful) {
    emit(cityId, 'city_scheduler_tick', null, { pressure: snap.pressure.scheduler_mood, reason: 'pressure_update' });
    const prevReasons = new Set(suggestionReasons(prev));
    for (const s of snap.suggestions) if (!prevReasons.has(s.reason)) emit(cityId, 'city_pressure_suggested', null, { pressure: snap.pressure.scheduler_mood, reason: s.reason, severity: s.severity });
    broadcast(cityId, { t: 'city_scheduler_state', ...schedulerStatePayload(snap) });
  }
  pressures[cityId] = snap;
  return meaningful;
}
function schedulerRequest(ws, meta) {
  if (!meta.playerId) return; // parity with the DO: only joined sockets can request
  const now = Date.now();
  if (now - (meta.lastSchedReqAt || 0) < SNAP_REQ_MIN_MS) return; // anti-spam
  meta.lastSchedReqAt = now;
  evaluateScheduler(meta.cityId);
  send(ws, { t: 'city_scheduler_state', ...schedulerStatePayload(pressures[meta.cityId]) });
}

function join(ws, meta, data) {
  const playerId = data.playerId;
  if (!isValidPlayerId(playerId)) { send(ws, { t: 'city_error', code: 'no_identity', message: 'a valid playerId is required' }); return; }
  // meta.cityId is fixed from the connection URL; the join payload cannot re-bind it.
  meta.playerId = playerId;
  const now = Date.now();
  const capacity = getCity(meta.cityId)?.capacity;
  const res = addPlayer(cityState(meta.cityId), playerId, { now, capacity });
  if (!res.ok) { send(ws, { t: 'city_error', code: res.reason, message: 'join rejected' }); return; }
  cities[meta.cityId] = res.state;
  send(ws, { t: 'city_welcome', ...welcomePayload(cities[meta.cityId], playerId, meta.cityId, now) });
  send(ws, { t: 'city_events', ...cityEventsPayload(eventLog(meta.cityId)) }); // recent history on (re)join
  broadcastExcept(ws, meta.cityId, { t: 'city_player_joined', id: playerId, x: res.player.x, y: res.player.y }); // legacy
  emit(meta.cityId, 'city_player_joined', playerId, {}); // canonical append-only event
  snapshot(meta.cityId, now);
  // Phase 4D: if the eval broadcast a state change it already reached this socket; only
  // send explicitly when it did not, so a (re)connect sees current pressure exactly once.
  if (!evaluateScheduler(meta.cityId)) send(ws, { t: 'city_scheduler_state', ...schedulerStatePayload(pressures[meta.cityId]) });
}

function input(ws, meta, data) {
  if (!meta.playerId) { send(ws, { t: 'city_error', code: 'no_identity', message: 'Must city_join first' }); return; }
  const now = Date.now();
  const res = applyInput(cityState(meta.cityId), meta.playerId, data, now);
  cities[meta.cityId] = res.state;
  if (res.accepted) snapshot(meta.cityId, now);
}

function portal(ws, meta, data) {
  if (!meta.playerId) { send(ws, { t: 'city_error', code: 'no_identity', message: 'Must city_join first' }); return; }
  const portalId = data.portalId;
  emit(meta.cityId, 'city_portal_enter_requested', meta.playerId, { portalId });
  const res = enterPortal(cityState(meta.cityId), meta.playerId, portalId);
  if (!res.ok) { emit(meta.cityId, 'city_portal_enter_rejected', meta.playerId, { portalId, reason: res.reason }); send(ws, { t: 'city_error', code: `portal_${res.reason}`, message: 'portal entry denied' }); evaluateScheduler(meta.cityId); return; }
  emit(meta.cityId, 'city_portal_enter_accepted', meta.playerId, { portalId, target: res.target });
  if (!meta.interiorOpen) { meta.interiorOpen = true; emit(meta.cityId, 'city_arcade_interior_opened', meta.playerId, { portalId }); }
  send(ws, { t: 'city_portal_ok', portalId, target: res.target });
  evaluateScheduler(meta.cityId);
}

function portalClose(ws, meta) {
  if (!meta.playerId || !meta.interiorOpen) return;
  meta.interiorOpen = false;
  emit(meta.cityId, 'city_arcade_interior_closed', meta.playerId, {});
  evaluateScheduler(meta.cityId);
}

function eventsRequest(ws, meta) {
  const now = Date.now();
  if (now - (meta.lastEvReqAt || 0) < SNAP_REQ_MIN_MS) return; // anti-spam
  meta.lastEvReqAt = now;
  send(ws, { t: 'city_events', ...cityEventsPayload(eventLog(meta.cityId)) });
}

function drop(ws, announce = false) {
  const meta = sockets.get(ws);
  if (!meta) return;
  sockets.delete(ws);
  if (announce) { try { ws.close(1000, 'left'); } catch { /* closing */ } }
  if (meta.interiorOpen && meta.playerId) { meta.interiorOpen = false; emit(meta.cityId, 'city_arcade_interior_closed', meta.playerId, {}); }
  if (!meta.playerId || hasSocketFor(meta.cityId, meta.playerId)) return;
  cities[meta.cityId] = removePlayer(cityState(meta.cityId), meta.playerId);
  broadcast(meta.cityId, { t: 'city_player_left', id: meta.playerId }); // legacy
  emit(meta.cityId, 'city_player_left', meta.playerId, {});             // canonical append-only event (once)
  snapshot(meta.cityId, Date.now());
  evaluateScheduler(meta.cityId);
}

function dispatch(ws, meta, data) {
  switch (data.t) {
    case 'city_join': join(ws, meta, data); break;
    case 'city_input': input(ws, meta, data); break;
    case 'city_scheduler_request': schedulerRequest(ws, meta); break;
    case 'city_snapshot_request': {
      const now = Date.now();
      if (now - (meta.lastSnapReqAt || 0) < SNAP_REQ_MIN_MS) break; // anti-spam
      meta.lastSnapReqAt = now;
      send(ws, { t: 'city_snapshot', cityId: meta.cityId, ...citySnapshot(cityState(meta.cityId), now) });
      break;
    }
    case 'city_events_request': eventsRequest(ws, meta); break;
    case 'city_portal_enter':
    case 'city_portal_enter_request': portal(ws, meta, data); break;
    case 'city_portal_close_request': portalClose(ws, meta); break;
    case 'city_leave': drop(ws, true); break;
    case 'heartbeat': { if (meta.playerId) cities[meta.cityId] = touchPlayer(cityState(meta.cityId), meta.playerId, Date.now()); break; }
    default: send(ws, { t: 'city_error', code: 'unknown_type', message: `Unknown message type: ${data.t}` });
  }
}

const wss = new WebSocketServer({ port: PORT, path: '/arcade/city/ws' });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  sockets.set(ws, { playerId: null, cityId: resolveCityRoomId(url.searchParams.get('city')).cityId });
  ws.on('message', (buf) => {
    let data;
    try { data = JSON.parse(buf.toString()); } catch { send(ws, { t: 'city_error', code: 'bad_json', message: 'Invalid JSON' }); return; }
    dispatch(ws, sockets.get(ws), data);
  });
  ws.on('close', () => drop(ws));
  ws.on('error', () => drop(ws));
});

// Coarse stale-player sweep — parity with the CityRoom DO alarm.
setInterval(() => {
  const now = Date.now();
  for (const cityId of Object.keys(cities)) {
    for (const id of stalePlayerIds(cities[cityId], now)) {
      if (hasSocketFor(cityId, id)) continue;
      cities[cityId] = removePlayer(cities[cityId], id);
      broadcast(cityId, { t: 'city_player_left', id }); // legacy
      emit(cityId, 'city_player_left', id, {});         // canonical append-only event
      snapshot(cityId, now);
    }
    evaluateScheduler(cityId); // Phase 4D: periodic decay
  }
}, STALE_SWEEP_MS);

console.log(`[city-dev-shim] listening on ws://127.0.0.1:${PORT}/arcade/city/ws`);
