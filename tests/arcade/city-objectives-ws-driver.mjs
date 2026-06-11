/**
 * Phase 7C — node-level city WebSocket DRIVER (test instrument; shared by the
 * two-client shim integration smoke and the staging smoke).
 *
 * A minimal honest client: it speaks ONLY the normal public protocol (city_join,
 * city_input, heartbeat — plus deliberate forgeries the tests assert are REJECTED).
 * Movement is driven exactly like the browser client: bounded dx/dy at ~16Hz with
 * dt matching the wall interval; the SERVER resolves every position. The driver
 * never fabricates state — `self()` reads back the server's own snapshots.
 */
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../workers/arcade/package.json', import.meta.url));
const WebSocket = require('ws');

const INPUT_INTERVAL_MS = 60; // > MIN_INPUT_INTERVAL_MS(33) — never rate-dropped

export function connectCityClient(url, playerId, cityId, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const state = {
      playerId, cityId,
      welcome: null,
      players: {},          // last server snapshot positions by id
      objective: null,      // last city_objective_state .objective
      objectiveStates: 0,   // count of hint pushes received
      events: [],           // server-authored world events (live + history)
      errors: [],           // city_error messages
      seq: 0,
      closed: false,
    };
    const timer = setTimeout(() => reject(new Error(`connect timeout: ${playerId}`)), timeoutMs);
    ws.on('error', (e) => { clearTimeout(timer); reject(new Error(`socket error (${playerId}): ${e.message}`)); });
    ws.on('close', () => { state.closed = true; clearInterval(hb); });
    let hb = 0;
    ws.on('open', () => {
      ws.send(JSON.stringify({ t: 'city_join', playerId, cityId, schema_version: 8 }));
      hb = setInterval(() => { try { ws.send(JSON.stringify({ t: 'heartbeat' })); } catch { /* closing */ } }, 10_000); // protocol fidelity: the real client heartbeats
    });
    ws.on('message', (buf) => {
      let m;
      try { m = JSON.parse(String(buf)); } catch { return; }
      if (m.t === 'city_welcome') { state.welcome = m; clearTimeout(timer); resolve(api); }
      else if (m.t === 'city_snapshot') { for (const p of m.players || []) state.players[p.id] = { x: p.x, y: p.y }; }
      else if (m.t === 'city_objective_state') { state.objective = m.objective || null; state.objectiveStates++; }
      else if (m.t === 'city_events') { for (const e of m.events || []) state.events.push(e); }
      else if (m.t === 'city_event') { if (m.event) state.events.push(m.event); }
      else if (m.t === 'city_error') { state.errors.push(m); }
    });

    const api = {
      state,
      self() { return state.players[playerId] || null; },
      acks(type = 'city_objective_completed') { return state.events.filter((e) => e.type === type); },
      send(obj) { ws.send(JSON.stringify(obj)); },
      /** Drive toward (tx,ty) with NORMAL inputs until within `near` or `maxMs`. Server owns the result. */
      async moveTo(tx, ty, { near = 14, maxMs = 20000 } = {}) {
        const deadline = Date.now() + maxMs;
        let last = Date.now();
        while (Date.now() < deadline) {
          const me = this.self();
          if (me && Math.hypot(me.x - tx, me.y - ty) <= near) { this.send({ t: 'city_input', seq: ++state.seq, ts: Date.now(), dx: 0, dy: 0, dt: 16 }); return true; }
          const dx = me ? Math.sign(Math.round(tx - me.x)) : 0;
          const dy = me ? Math.sign(Math.round(ty - me.y)) : 0;
          const now = Date.now();
          const dt = Math.min(200, now - last) || 60; // dt is MILLISECONDS (server clamps to real elapsed)
          last = now;
          this.send({ t: 'city_input', seq: ++state.seq, ts: now, dx, dy, dt });
          await new Promise((r) => setTimeout(r, INPUT_INTERVAL_MS));
        }
        return false;
      },
      /** Keep nudging in place (accepted inputs re-trigger server objective evaluation). */
      async dwell(ms) {
        const until = Date.now() + ms;
        let flip = 1;
        while (Date.now() < until) {
          flip = -flip;
          this.send({ t: 'city_input', seq: ++state.seq, ts: Date.now(), dx: flip, dy: 0, dt: 12 });
          await new Promise((r) => setTimeout(r, INPUT_INTERVAL_MS));
        }
      },
      async waitFor(pred, label, maxMs = 10000) {
        const deadline = Date.now() + maxMs;
        while (Date.now() < deadline) {
          if (pred(state)) return true;
          await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error(`waitFor timeout (${playerId}): ${label} — ${this.diag()}`);
      },
      diag() {
        const me = this.self();
        return `player=${playerId} pos=${me ? `${Math.round(me.x)},${Math.round(me.y)}` : 'none'} objective=${state.objective ? state.objective.objective_id + '/' + state.objective.kind : 'null'} hints=${state.objectiveStates} acks=${this.acks().length} errors=${state.errors.map((e) => e.code).join(',') || 'none'}`;
      },
      close() { clearInterval(hb); try { ws.close(); } catch { /* closing */ } },
    };
  });
}

/** Sweep any objective payload for value/economy-shaped fields (shared assertion). */
export const VALUE_FIELD_RE = /score|balance|ticket|prize|inventory|rank|streak|level|points|credit|currency|wealth|payout|reward|earn|bonus/i;
