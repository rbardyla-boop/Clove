/**
 * Neon Circuit — City Block network client (browser).
 *
 * Thin WebSocket transport to the CityRoom authority. Sends INPUT INTENT only and
 * surfaces server messages via callbacks. The server owns every canonical position;
 * this client never asserts one. Auto-reconnects and heartbeats while connected.
 */
import { SCHEMA_VERSION } from './city-block.mjs';

/** Resolve the city WebSocket URL (precedence: ?ws= → config hook → same-origin). */
export function resolveCityWsUrl({ explicit, config, location } = {}) {
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  const configured = config && typeof config.cityWsUrl === 'string' ? config.cityWsUrl.trim() : '';
  if (configured) return configured;
  if (location && location.host) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/arcade/city/ws`;
  }
  return null;
}

const HEARTBEAT_MS = 10_000;
const RECONNECT_MS = 1500;

export class CityNet {
  constructor({ wsUrl, playerId, cityId, handlers = {} }) {
    this.wsUrl = wsUrl;
    this.playerId = playerId;
    this.cityId = cityId;
    this.h = handlers;
    this.ws = null;
    this.hb = null;
    this.closed = false;
    this.connected = false;
  }

  _url() {
    const sep = this.wsUrl.includes('?') ? '&' : '?';
    return `${this.wsUrl}${sep}city=${encodeURIComponent(this.cityId)}`;
  }

  connect() {
    this.closed = false;
    if (typeof this.wsUrl !== 'string' || !this.wsUrl) { this._status('offline'); return; } // unresolvable endpoint — fail loud, no crash
    this._status('connecting');
    let ws;
    try { ws = new WebSocket(this._url(), 'arcade'); }
    catch { this._scheduleReconnect(); return; }
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.connected = true;
      this._status('syncing');
      this.send({ t: 'city_join', playerId: this.playerId, cityId: this.cityId, schema_version: SCHEMA_VERSION });
      this.hb = setInterval(() => this.send({ t: 'heartbeat' }), HEARTBEAT_MS);
    });
    ws.addEventListener('message', (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      this._route(m);
    });
    ws.addEventListener('close', () => { this._down(); });
    ws.addEventListener('error', () => { try { ws.close(); } catch { /* noop */ } });
  }

  _route(m) {
    switch (m.t) {
      case 'city_welcome': this.h.onWelcome?.(m); this._status('live'); break;
      case 'city_snapshot': this.h.onSnapshot?.(m); break;
      case 'city_player_joined': this.h.onPlayerJoined?.(m); break;
      case 'city_player_left': this.h.onPlayerLeft?.(m); break;
      case 'city_portal_ok': this.h.onPortalOk?.(m); break;
      case 'city_events': this.h.onEvents?.(m); break;   // Phase 4C: recent world-event history
      case 'city_event': this.h.onEvent?.(m); break;     // Phase 4C: a single live world event
      case 'city_scheduler_state': this.h.onSchedulerState?.(m); break; // Phase 4D: city pressure snapshot
      case 'city_host_rank_state': this.h.onHostRankState?.(m); break;  // Phase 4E: non-cash host rank
      case 'city_error': this.h.onError?.(m); break;
      default: break;
    }
  }

  _down() {
    this.connected = false;
    if (this.hb) { clearInterval(this.hb); this.hb = null; }
    this._status('offline');
    if (!this.closed) this._scheduleReconnect();
  }
  _scheduleReconnect() { setTimeout(() => { if (!this.closed) this.connect(); }, RECONNECT_MS); }
  _status(s) { this.h.onStatus?.(s); }

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify(obj)); } catch { /* closing */ }
    }
  }
  // Phase 4B: carry per-input dt so the server can reproduce the client's predicted
  // step (and the client can replay it). `ts` is the client timestamp — used only for
  // ordering/debugging, never for movement authority, and never sent off-server.
  sendInput(seq, clientTime, dx, dy, dt) { this.send({ t: 'city_input', seq, ts: clientTime, dx, dy, dt }); }
  enterPortal(portalId) { this.send({ t: 'city_portal_enter', portalId }); }
  closeInterior() { this.send({ t: 'city_portal_close_request' }); } // Phase 4C: leave the arcade interior
  requestSnapshot() { this.send({ t: 'city_snapshot_request' }); }
  requestEvents() { this.send({ t: 'city_events_request' }); }
  requestScheduler() { this.send({ t: 'city_scheduler_request' }); } // Phase 4D: ask for current city pressure
  requestHostRank() { this.send({ t: 'city_host_rank_request' }); }  // Phase 4E: ask for current host rank

  close() {
    this.closed = true;
    if (this.hb) { clearInterval(this.hb); this.hb = null; }
    try { this.send({ t: 'city_leave' }); this.ws?.close(); } catch { /* noop */ }
  }
}
