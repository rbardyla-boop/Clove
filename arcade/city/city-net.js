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
    // No WebSocket subprotocol: the deployed CityRoom DO returns a 101 without a
    // Sec-WebSocket-Protocol echo, so offering one makes browsers abort the handshake
    // (works against the Node `ws` dev-shim, fails on real workerd). Match the arcade
    // client, which connects without a subprotocol.
    try { ws = new WebSocket(this._url()); }
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
    // Guard on identity so a socket replaced by switchCity() can't trigger a reconnect to the old block.
    ws.addEventListener('close', () => { if (this.ws === ws) this._down(); });
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
      case 'city_stewardship_state': this.h.onStewardshipState?.(m); break;   // Phase 4F: canonical block style
      case 'city_stewardship_result': this.h.onStewardshipResult?.(m); break; // Phase 4F: preview/apply/reset outcome
      case 'city_block_trial_state': this.h.onTrialState?.(m); break;         // Phase 4G: Block Trial instance state
      case 'city_block_trial_result': this.h.onTrialResult?.(m); break;       // Phase 4G: trial request/join/close outcome
      case 'city_blocks': this.h.onBlocks?.(m); break;                        // Phase 5A: district manifest (discovery)
      case 'city_district_presence': this.h.onDistrictPresence?.(m); break;   // Phase 5D: push-on-change presence delta
      case 'city_route_result': this.h.onRouteResult?.(m); break;             // Phase 5A: server-validated route confirmation
      case 'city_interaction_receipt': this.h.onInteractionReceipt?.(m); break; // Phase 7E: server-confirmed interaction receipt
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
  // Phase 4F: request a constrained block-stewardship edit (intent only — the server validates
  // eligibility + the manifest and owns the canonical style). action: 'preview'|'apply'|'reset'.
  requestStewardship(action, target, style) { this.send({ t: 'city_stewardship_request', request_id: `s${Date.now().toString(36)}`, action, target, style }); }
  // Phase 4G: instanced, non-destructive Block Trial (intent only — the server owns all match truth).
  requestTrial() { this.send({ t: 'city_block_trial_request' }); }
  joinTrial() { this.send({ t: 'city_block_trial_join_request' }); }
  leaveTrial() { this.send({ t: 'city_block_trial_leave' }); }
  closeTrial() { this.send({ t: 'city_block_trial_close_request' }); }
  // Phase 5A: multi-block district. Discovery + a route request (intent only — the server
  // validates adjacency and owns the truth; the target block's authority admits the player).
  requestBlocks() { this.send({ t: 'city_blocks_request' }); }
  requestRoute(targetCityId) { this.send({ t: 'city_route_request', target_city_id: targetCityId }); }
  // Phase 7E: request a server-confirmed interaction receipt (display action → server gate).
  requestInteraction(actionKind, zoneId, targetCityId) {
    const msg = { t: 'city_interaction_request', action_kind: actionKind };
    if (zoneId != null) msg.zone_id = zoneId;
    if (targetCityId != null) msg.target_city_id = targetCityId;
    this.send(msg);
  }

  /**
   * Travel to another block: tear down the current socket (without auto-reconnecting to the
   * OLD block) and reconnect to the new block's CityRoom. Only call after a server
   * `city_route_result {ok:true}` — the target block's authority still admits the player.
   */
  switchCity(cityId) {
    if (typeof cityId !== 'string' || !cityId || cityId === this.cityId) return;
    this.cityId = cityId;
    if (this.hb) { clearInterval(this.hb); this.hb = null; }
    const old = this.ws;
    this.ws = null;          // so old's close handler (guarded on this.ws === ws) won't reconnect to the old block
    this.connected = false;
    if (old) { try { old.send(JSON.stringify({ t: 'city_leave' })); } catch { /* closing */ } try { old.close(); } catch { /* noop */ } }
    this.connect();          // opens a fresh socket bound to the new cityId
  }

  close() {
    this.closed = true;
    if (this.hb) { clearInterval(this.hb); this.hb = null; }
    try { this.send({ t: 'city_leave' }); this.ws?.close(); } catch { /* noop */ }
  }
}
