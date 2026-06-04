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

const PORT = Number(process.env.CITY_PORT || process.env.PORT || 8788);
const STALE_SWEEP_MS = 30_000;
const SNAP_REQ_MIN_MS = 250;

const cities = {};                 // cityId -> pure city state
const sockets = new Map();         // ws -> { playerId, cityId }

const cityState = (cityId) => (cities[cityId] ||= createCityState());
const send = (ws, p) => { try { ws.send(JSON.stringify(p)); } catch { /* closing */ } };
const broadcast = (cityId, p) => { for (const [ws, m] of sockets) if (m.cityId === cityId) send(ws, p); };
const broadcastExcept = (except, cityId, p) => { for (const [ws, m] of sockets) if (ws !== except && m.cityId === cityId) send(ws, p); };
const snapshot = (cityId, now) => broadcast(cityId, { t: 'city_snapshot', cityId, ...citySnapshot(cityState(cityId), now) });
function hasSocketFor(cityId, playerId) {
  for (const m of sockets.values()) if (m.cityId === cityId && m.playerId === playerId) return true;
  return false;
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
  broadcastExcept(ws, meta.cityId, { t: 'city_player_joined', id: playerId, x: res.player.x, y: res.player.y });
  snapshot(meta.cityId, now);
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
  const res = enterPortal(cityState(meta.cityId), meta.playerId, data.portalId);
  if (!res.ok) { send(ws, { t: 'city_error', code: `portal_${res.reason}`, message: 'portal entry denied' }); return; }
  send(ws, { t: 'city_portal_ok', portalId: data.portalId, target: res.target });
}

function drop(ws, announce = false) {
  const meta = sockets.get(ws);
  if (!meta) return;
  sockets.delete(ws);
  if (announce) { try { ws.close(1000, 'left'); } catch { /* closing */ } }
  if (!meta.playerId || hasSocketFor(meta.cityId, meta.playerId)) return;
  cities[meta.cityId] = removePlayer(cityState(meta.cityId), meta.playerId);
  broadcast(meta.cityId, { t: 'city_player_left', id: meta.playerId });
  snapshot(meta.cityId, Date.now());
}

function dispatch(ws, meta, data) {
  switch (data.t) {
    case 'city_join': join(ws, meta, data); break;
    case 'city_input': input(ws, meta, data); break;
    case 'city_snapshot_request': {
      const now = Date.now();
      if (now - (meta.lastSnapReqAt || 0) < SNAP_REQ_MIN_MS) break; // anti-spam
      meta.lastSnapReqAt = now;
      send(ws, { t: 'city_snapshot', cityId: meta.cityId, ...citySnapshot(cityState(meta.cityId), now) });
      break;
    }
    case 'city_portal_enter': portal(ws, meta, data); break;
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
      broadcast(cityId, { t: 'city_player_left', id });
      snapshot(cityId, now);
    }
  }
}, STALE_SWEEP_MS);

console.log(`[city-dev-shim] listening on ws://127.0.0.1:${PORT}/arcade/city/ws`);
