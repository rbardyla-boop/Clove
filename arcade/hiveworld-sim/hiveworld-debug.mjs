/**
 * HiveWorld debug UI controller.
 *
 * Pure DOM glue over the simulator core. It owns ONE live HiveSimulator, wires
 * every control to a real simulator action (no fake/placeholder buttons), and
 * re-renders the world view, the sideband spectrum, the live event stream and the
 * rejected/refused feed after each action. Determinism is preserved: the UI only
 * advances the logical clock and publishes well-formed events.
 */
import { HiveSimulator } from './core/simulator.mjs';
import { foldLog } from './core/world.mjs';
import { SIDEBANDS, SIDEBAND_NAMES } from './core/sidebands.mjs';
import { createEvent } from './core/events.mjs';
import { simulatePulseTapRound } from './core/pulse-tap.mjs';
import { runScenario } from './scenarios/canned.mjs';
// Phase 1 arcade parity (v0.1)
import { PHASE1_SCENARIOS, runPhase1Scenario, RESULTS } from './scenarios/phase1.mjs';
import { CITY_DISTRICT_SCENARIOS } from './scenarios/city-district.mjs';
import { CITY_SYSTEMS_SCENARIOS } from './scenarios/city-systems.mjs';
import { CITY_IDS, getBlock } from './core/phase1/city-blocks.mjs';
const ALL_CITY_SCENARIOS = { ...CITY_DISTRICT_SCENARIOS, ...CITY_SYSTEMS_SCENARIOS };
import { CABINETS } from './core/phase1/catalog.mjs';
import { cabinetRenderState, adapterStateFor } from './core/phase1/adapters.mjs';
import { arcadeRoom } from './core/phase1/round-authority.mjs';

const CABS = [
  { id: 'pulse', ico: '⚡' },
  { id: 'claw', ico: '🪝' },
  { id: 'hoops', ico: '🏀' },
];
const PALETTE = ['#19e3ff', '#ff2d95', '#b14aff', '#3df58b', '#ffd23f', '#ff8a3d'];
const CLASS_COLOR = {
  ephemeral: 'var(--c-ephemeral)', persistent: 'var(--c-persistent)',
  authoritative: 'var(--c-authoritative)', validated: 'var(--c-validated)', proposal: 'var(--c-proposal)',
};

const $ = (id) => document.getElementById(id);
const short = (s) => (s && s.length > 16 ? s.slice(0, 15) + '…' : s || '');
function colorFor(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

class HiveDebug {
  constructor() {
    this.energy = {};
    this.lastSlotByAgent = {};
    this.buildSpectrum();
    this.bind();
    this.init();
    setInterval(() => this.decay(), 150);
  }

  init() {
    this.sim = new HiveSimulator({ seed: 'ui-' + Date.now() });
    this.agentN = 0; this.roomN = 0; this.slotN = 0; this.goodN = 0; this.objN = 0; this.p1RoundN = 0;
    this.lastSlotByAgent = {};
    this.refreshPhase1Select();
    this.refreshCitySelect();
    this.renderCity(null);
    for (const sb of SIDEBAND_NAMES) this.energy[sb] = 0;

    // seed a small world so the page is alive on load
    const room = this.sim.addRoom({ id: this.newRoomId(), name: 'Main Floor' });
    this.pub(room.announce(this.sim.nextTick()));
    const a = this.spawnAgent('player');
    this.spawnAgent('player');
    this.activeId = a.id;
    this.refreshRoomSelect();
    this.refreshCabSelect();
    this.render();
    this.toast('HiveWorld v0 ready — build a world, then break it.', 'ok');
  }

  // ── identity helpers ─────────────────────────────────────────────────────
  newAgentId() { return 'agent:' + String.fromCharCode(97 + (this.agentN++ % 26)) + (this.agentN > 26 ? this.agentN : ''); }
  newRoomId() { return 'room:' + (++this.roomN); }
  agent() { return this.sim.agents.get(this.activeId); }
  selRoom() { return $('sel-room').value; }
  selCab() { return $('sel-cab').value; }

  // ── publishing wrapper (drives the spectrum + reject flashes) ─────────────
  pub(ev, opts) {
    const res = this.sim.publish(ev, opts);
    if (res.status === 'accepted') this.energy[ev.sideband] = 1;
    return res;
  }

  spawnAgent(role) {
    const id = this.newAgentId();
    const a = this.sim.addAgent({ id, role, name: id });
    const t = this.sim.nextTick();
    this.pub(a.announce(t));
    this.pub(a.ping(t, this.selRoomSafe(), 'cell:' + id));
    return a;
  }

  selRoomSafe() {
    const r = $('sel-room');
    return r && r.value ? r.value : null;
  }

  // ── action dispatch ───────────────────────────────────────────────────────
  bind() {
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) { this.action(btn.dataset.action); return; }
      const ag = e.target.closest('.agent[data-id]');
      if (ag) { this.activeId = ag.dataset.id; this.render(); }
    });
  }

  action(name) {
    const a = this.agent();
    const t = () => this.sim.nextTick();
    try {
      switch (name) {
        case 'spawn-agent': { const x = this.spawnAgent('player'); this.activeId = x.id; this.toast('spawned ' + x.id); break; }
        case 'spawn-mod': { const x = this.spawnAgent('moderator'); this.activeId = x.id; this.toast('spawned moderator ' + x.id); break; }
        case 'create-room': { const r = this.sim.addRoom({ id: this.newRoomId(), name: this.newRoomLabel() }); this.pub(r.announce(t())); this.refreshRoomSelect(); this.toast('created ' + r.id); break; }
        case 'advance': { this.sim.advance(5); this.toast('advanced 5 ticks (ran room maintenance)'); break; }
        case 'join-room': { a.currentRoom = this.selRoom(); this.pub(a.ping(t(), this.selRoom(), 'cell:' + a.id)); this.toast(a.id + ' joined ' + this.selRoom()); break; }
        case 'occupy': { const r = this.pub(a.occupy(this.selRoom(), this.selCab(), t())); this.afterOccupy(a, r); break; }
        case 'release': { const r = this.pub(a.release(this.selRoom(), this.selCab(), t())); this.toast(r.status === 'accepted' ? 'released' : 'release refused', r.status === 'accepted' ? 'ok' : 'bad'); break; }
        case 'play-round': this.playRound(a); break;
        case 'lease-slot': this.leaseSlot(a); break;
        case 'place-object': this.placeObject(a); break;
        case 'grant-credits': { this.pub(a.grantCredits(a.id, 50, t())); this.toast('+50 credits → ' + a.id, 'ok'); break; }
        case 'buy-equip-good': this.buyGood(a); break;
        case 'toggle-online': this.toggleOnline(a); break;
        case 'room-outage': this.toggleRoom(); break;
        case 'mal-busy': this.malBusy(a); break;
        case 'mal-transfer': this.malTransfer(a); break;
        case 'mal-forge': this.malForge(a); break;
        case 'mal-suspend': this.malSuspend(a); break;
        case 'replay': this.replay(); break;
        case 'export': this.exportReport(); break;
        case 'run-scenario': this.runScenario(); break;
        case 'p1-play': this.p1Play(a); break;
        case 'p1-redeem': this.p1Redeem(a); break;
        case 'p1-equip': this.p1Equip(a); break;
        case 'p1-claim': this.p1Claim(a); break;
        case 'run-phase1': this.runPhase1Scenario(); break;
        case 'run-city': this.runCityScenario(); break;
        case 'reset': this.init(); break;
      }
    } catch (err) {
      this.toast('error: ' + (err && err.message), 'bad');
    }
    this.render();
  }

  newRoomLabel() { return 'Room ' + this.roomN; }

  afterOccupy(a, res) {
    // res is the fabric ingest (structural). Whether it actually grabs the cabinet
    // is decided by the fold; reflect that for honesty.
    const m = this.world().rooms[this.selRoom()]?.machines?.[this.selCab()];
    if (m && m.occupiedBy === a.id) this.toast(a.id + ' now holds ' + this.selCab(), 'ok');
    else this.toast(this.selCab() + ' is busy (' + short(m?.occupiedBy) + ') — occupy refused', 'bad');
  }

  playRound(a) {
    const room = this.selRoom(); const cab = this.selCab();
    const m = this.world().rooms[room]?.machines?.[cab];
    if (!m || m.occupiedBy !== a.id) { this.toast('occupy ' + cab + ' first', 'bad'); return; }
    const t = this.sim.nextTick();
    const result = simulatePulseTapRound({ seed: a.id + ':' + t, skill: 0.78 });
    this.pub(a.finishRound(room, cab, result, t));
    if (this.sim.ctx.economyTestMode) this.pub(a.grantCredits(a.id, 10, this.sim.nextTick()));
    this.toast('round → grade ' + result.grade + '  acc ' + result.accuracy + '%  (+10 credits)', 'ok');
  }

  leaseSlot(a) {
    const slotId = 'slot:' + a.id + ':' + (this.slotN++);
    const cell = 'cell:' + a.id + ':' + this.slotN;
    const r = this.pub(a.leaseSlot(cell, { slotId, slotType: 'kiosk', durationTicks: 30, allowedActions: ['place_object', 'remove_object'] }, this.sim.nextTick()));
    if (r.status === 'accepted') this.lastSlotByAgent[a.id] = slotId;
    this.toast('leased ' + slotId + ' in ' + cell, 'ok');
  }

  placeObject(a) {
    const slotId = this.lastSlotByAgent[a.id];
    if (!slotId) { this.toast('lease a slot first', 'bad'); return; }
    const objId = 'obj:' + a.id + ':' + (this.objN++);
    const r = this.pub(a.placeObject(slotId, objId, { kind: 'sticker', action: 'place_object' }, this.sim.nextTick()));
    const ok = this.world().slots[slotId]?.placed_objects?.some((o) => o.objectId === objId);
    this.toast(ok ? 'placed ' + objId : 'placement refused', ok ? 'ok' : 'bad');
  }

  buyGood(a) {
    const goodId = 'good:' + a.id + ':' + (this.goodN++);
    const r = this.pub(a.mintBoundGood(goodId, 'cabinet_skin', 20, this.sim.nextTick()));
    if (r.status === 'accepted' && this.world().economy.goods[goodId]?.owner === a.id) {
      this.pub(a.equipGood(goodId, this.sim.nextTick()));
      this.toast('minted + equipped ' + goodId + ' (account-bound)', 'ok');
    } else {
      const reason = this.applyReasonFor(r.event?.event_id) || 'insufficient_credits';
      this.toast('mint refused: ' + reason + ' (grant credits first)', 'bad');
    }
  }

  toggleOnline(a) {
    if (a.online) { this.sim.disconnectAgent(a.id); this.toast(a.id + ' disconnected (drops deliveries)', 'bad'); }
    else { const n = this.sim.reconnectAgent(a.id); this.toast(a.id + ' reconnected + replayed ' + n + ' events', 'ok'); }
  }

  toggleRoom() {
    const rid = this.selRoom(); const r = this.sim.rooms.get(rid);
    if (!r) return;
    if (r.online) { this.sim.roomOutage(rid); this.toast(rid + ' base station OFFLINE (graceful degradation)', 'bad'); }
    else { const n = this.sim.roomRecover(rid); this.toast(rid + ' recovered + replayed ' + n + ' events', 'ok'); }
  }

  malBusy(a) {
    const room = this.selRoom(); const cab = this.selCab();
    const before = this.world().rooms[room]?.machines?.[cab]?.occupiedBy;
    this.pub(a.occupy(room, cab, this.sim.nextTick()));
    a.penalizeTrust();
    if (before && before !== a.id) this.toast('STEAL refused — ' + cab + ' stays with ' + short(before) + ' (fold: busy)', 'bad');
    else this.toast('occupy entered fabric (cabinet was free)', 'ok');
  }

  malTransfer(a) {
    const ev = createEvent({ actorId: a.id, eventType: 'transfer_good', sideband: 'market', payload: { goodId: 'x', to: a.id }, logicalTick: this.sim.nextTick(), seq: 90000 + this.sim.tick });
    const r = this.pub(ev);
    this.toast('transfer REFUSED at fabric boundary :: ' + r.reason, 'bad');
  }

  malForge(a) {
    const genuine = createEvent({ actorId: a.id, eventType: 'occupy_cabinet', sideband: 'occupancy', roomId: this.selRoom(), payload: { machineId: this.selCab() }, logicalTick: this.sim.nextTick(), seq: 95000 + this.sim.tick });
    const forged = this.sim.tamper(genuine, { payload: { machineId: '__forged__' } });
    const r = this.pub(forged);
    this.toast('forged envelope REFUSED :: ' + r.reason, 'bad');
  }

  malSuspend(a) {
    const slotId = Object.keys(this.world().slots)[0];
    if (!slotId) { this.toast('lease a slot first to attack it', 'bad'); return; }
    this.pub(a.emit({ eventType: 'suspend_slot', sideband: 'moderation', payload: { slotId }, tick: this.sim.nextTick() }));
    const status = this.world().slots[slotId].moderation_status;
    if (a.role === 'moderator') this.toast(a.id + ' (moderator) suspended ' + slotId, 'ok');
    else { a.penalizeTrust(); this.toast('suspend REFUSED — ' + a.id + ' is not a moderator (slot still ' + status + ')', 'bad'); }
  }

  replay() {
    const f1 = foldLog(this.sim.canonicalLog, this.sim.ctx).fingerprint;
    const f2 = foldLog(this.sim.canonicalLog, this.sim.ctx).fingerprint;
    this.toast('replayed ' + this.sim.canonicalLog.size + ' events → ' + f1 + ' · deterministic: ' + (f1 === f2), 'ok');
  }

  exportReport() {
    const report = this.sim.report();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'hiveworld-report-' + Date.now() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.toast('exported report (' + report.fabricSize + ' events)', 'ok');
  }

  runScenario() {
    const name = $('sel-scenario').value;
    const opts = name === 'meshChurn' ? { ticks: 400 } : {};
    const { sim } = runScenario(name, opts);
    this.sim = sim;
    this.activeId = [...sim.agents.keys()][0];
    this.agentN = sim.agents.size; this.roomN = sim.rooms.size; this.slotN = 9000; this.goodN = 9000; this.objN = 9000;
    this.lastSlotByAgent = {};
    for (const sb of SIDEBAND_NAMES) this.energy[sb] = sim.sidebandTraffic[sb] ? 1 : 0;
    this.refreshRoomSelect();
    const r = sim.report();
    this.toast('ran ' + name + ' → converged: ' + r.desyncReport.finalConverged + ' · rejected: ' + r.rejectedEvents.length, r.desyncReport.finalConverged ? 'ok' : 'bad');
  }

  // ── Phase 1 arcade parity (v0.1) ──────────────────────────────────────────
  refreshPhase1Select() {
    const sel = $('sel-p1-scenario');
    if (!sel) return;
    sel.innerHTML = '';
    for (const name of Object.keys(PHASE1_SCENARIOS)) {
      const o = document.createElement('option'); o.value = name; o.textContent = name; sel.appendChild(o);
    }
  }

  p1Cab() { const s = $('sel-p1-cab'); return s ? s.value : 'pulse'; }
  p1Kind() { return { pulse: 'pulse', signal: 'signal', grid: 'grid' }[this.p1Cab()]; }

  /** Occupy → start → submit → release a full server-authoritative arcade round. */
  p1Play(a) {
    const room = this.selRoom(); const machine = this.p1Cab();
    if (!room) { this.toast('create/select a room first', 'bad'); return; }
    const rid = `r-${a.id}-${this.p1RoundN++}`;
    const result = { ...RESULTS[this.p1Kind()], roundId: rid };
    this.pub(a.occupy(room, machine, this.sim.nextTick()));
    this.pub(a.startArcadeRound(room, machine, rid, this.sim.nextTick()));
    this.pub(a.submitArcadeRound(room, machine, result, this.sim.nextTick()));
    this.pub(a.release(room, machine, this.sim.nextTick()));
    const bal = this.p1Room(a).balances[a.id] || 0;
    this.toast(`${a.id} played ${machine} → balance ${bal} tickets`, 'ok');
  }

  /** The arcade partition for an agent's current room (Phase 2 per-room isolation). */
  p1Room(a) {
    const roomId = (a && a.currentRoom) || this.selRoomSafe() || 'room:main';
    return arcadeRoom(this.world().arcade, roomId);
  }

  p1Redeem(a) {
    const r = this.pub(a.redeemArcadePrize('founder-badge-local', `rd-${a.id}-${this.p1RoundN++}`, this.sim.nextTick()));
    const owned = this.p1Room(a).inventory[a.id]?.['founder-badge-local'];
    this.toast(owned ? `${a.id} redeemed Founder Badge (−10)` : `redeem refused: ${this.applyReasonFor(r.event?.event_id) || 'insufficient_tickets'} (play rounds first)`, owned ? 'ok' : 'bad');
  }

  p1Equip(a) {
    this.pub(a.equipCosmetic('founder-badge-local', this.sim.nextTick()));
    const eq = this.p1Room(a).equips[a.id]?.badge;
    this.toast(eq === 'founder-badge-local' ? `${a.id} equipped Founder Badge` : 'equip refused — redeem it first', eq ? 'ok' : 'bad');
  }

  p1Claim(a) {
    this.pub(a.claimChallenge('grid-rookie', this.sim.nextTick()));
    const claimed = this.p1Room(a).challengeProgress[a.id]?.['grid-rookie']?.reward_claimed;
    this.toast(claimed ? `${a.id} claimed Grid Rookie badge` : 'claim refused — complete a Neon Grid round first', claimed ? 'ok' : 'bad');
  }

  runPhase1Scenario() {
    const name = $('sel-p1-scenario').value;
    const { sim } = runPhase1Scenario(name, {});
    this.sim = sim;
    this.activeId = [...sim.agents.keys()][0];
    this.agentN = sim.agents.size; this.roomN = sim.rooms.size; this.slotN = 9000; this.goodN = 9000; this.objN = 9000; this.p1RoundN = 9000;
    this.lastSlotByAgent = {};
    for (const sb of SIDEBAND_NAMES) this.energy[sb] = sim.sidebandTraffic[sb] ? 1 : 0;
    this.refreshRoomSelect();
    const r = sim.report();
    this.toast(`ran ${name} → converged: ${r.desyncReport.finalConverged} · rejected: ${r.rejectedEvents.length}`, r.desyncReport.finalConverged ? 'ok' : 'bad');
  }

  // ── City district (v1.0 — Phase 5A–5E mirror) ─────────────────────────────
  refreshCitySelect() {
    const sel = $('sel-city-scenario');
    if (!sel) return;
    sel.innerHTML = '';
    for (const name of Object.keys(ALL_CITY_SCENARIOS)) {
      const o = document.createElement('option'); o.value = name; o.textContent = name; sel.appendChild(o);
    }
  }

  runCityScenario() {
    const sel = $('sel-city-scenario');
    const name = (sel && sel.value) || 'districtRouteConverges';
    const fn = ALL_CITY_SCENARIOS[name];
    if (!fn) { this.toast('unknown city scenario', 'bad'); return; }
    const { report } = fn();
    this.renderCity(report);
    const conv = report.desyncReport.finalConverged;
    this.toast(`ran ${name} → converged: ${conv} · rejected routes: ${report.finalWorldState.district.rejectedRoutes}`, conv ? 'ok' : 'bad');
  }

  /** Lab display of the city/district fold (textContent/DOM only — public-safe view). */
  renderCity(report) {
    const host = $('hw-city');
    if (!host) return;
    host.textContent = '';
    const row = (k, v) => {
      const d = document.createElement('div'); d.className = 'row';
      const a = document.createElement('span'); a.textContent = k;
      const b = document.createElement('span'); b.textContent = v;
      d.appendChild(a); d.appendChild(b); return d;
    };
    const lbl = (txt) => { const d = document.createElement('div'); d.className = 'lbl'; d.textContent = txt; return d; };
    if (!report) {
      const hint = document.createElement('div'); hint.className = 'hint';
      hint.textContent = 'Pick a city scenario and run it — blocks, routing, presence + activity fold here.';
      host.appendChild(hint); return;
    }
    const d = report.finalWorldState.district;
    host.appendChild(row('fingerprint', short(report.canonicalFingerprint)));
    host.appendChild(row('converged', String(report.desyncReport.finalConverged)));
    host.appendChild(row('rejected routes', String(d.rejectedRoutes)));
    host.appendChild(row('refused events', String(report.applyRejectionCount)));
    host.appendChild(lbl('BLOCKS'));
    for (const id of CITY_IDS) {
      const b = getBlock(id); const rep = d.blocks[id];
      host.appendChild(row(`${b.display_name} · ${b.theme}`, `${rep ? rep.population : 0} here · ${rep ? rep.health : 'unknown'}`));
    }
    host.appendChild(lbl('ACTORS'));
    const actors = Object.entries(d.actorBlock);
    if (!actors.length) host.appendChild(row('—', 'no actors in a block'));
    for (const [actor, city] of actors) host.appendChild(row(short(actor), getBlock(city) ? getBlock(city).display_name : city));
    host.appendChild(lbl('DISTRICT ACTIVITY'));
    if (!d.activity.length) host.appendChild(row('—', 'no activity yet'));
    for (const item of d.activity.slice(0, 10)) {
      const line = document.createElement('div'); line.className = 'evt'; line.textContent = item.label; host.appendChild(line);
    }
    // v1.1 city systems (only shown when a city-systems scenario populated them)
    const pr = d.pressure || {}, hr = d.hostRank || {}, st = d.stewardship || {}, tr = d.trials || {};
    if (Object.keys(pr).length || Object.keys(hr).length) {
      host.appendChild(lbl('CITY SYSTEMS (4D pressure · 4E host rank)'));
      for (const id of CITY_IDS) {
        if (!pr[id] && !hr[id]) continue;
        const b = getBlock(id);
        host.appendChild(row(b.display_name, `${pr[id] ? 'pressure ' + pr[id].mood : ''}${pr[id] && hr[id] ? ' · ' : ''}${hr[id] ? 'rank ' + hr[id].tier + ' (' + hr[id].support_signal + ')' : ''}`));
      }
    }
    if (Object.keys(st).length) {
      host.appendChild(lbl('STEWARDSHIP (4F · constrained, reversible)'));
      for (const [id, style] of Object.entries(st)) {
        const b = getBlock(id);
        host.appendChild(row(b ? b.display_name : id, `${style.palette} · ${style.sign_variant} · ${style.intensity}`));
      }
    }
    const activeTrials = Object.entries(tr).filter(([, x]) => x);
    if (activeTrials.length) {
      host.appendChild(lbl('BLOCK TRIALS (4G · instanced, non-destructive)'));
      for (const [id, x] of activeTrials) {
        const b = getBlock(id);
        host.appendChild(row(b ? b.display_name : id, `${x.status} · ${x.score}/${x.score_cap} · ${x.player_count || Object.keys(x.players || {}).length} player(s)`));
      }
    }
    if (d.cityLog && d.cityLog.events && d.cityLog.events.length) {
      host.appendChild(lbl(`CITY WORLD LOG (4C · ${d.cityLog.events.length}/${50})`));
      for (const e of d.cityLog.events.slice(-6)) {
        const line = document.createElement('div'); line.className = 'evt';
        line.textContent = `#${e.seq} ${e.type}${e.city_id ? ' · ' + e.city_id : ''}`; host.appendChild(line);
      }
    }
  }

  renderPhase1(w) {
    const host = $('p1-arcade');
    if (!host) return;
    const a0 = this.agent();
    // Phase 2: show the active agent's CURRENT-room arcade partition.
    const arcade = arcadeRoom(w.arcade || { rooms: {} }, (a0 && a0.currentRoom) || this.selRoomSafe() || 'room:main');
    const activated = new Set(['neon_grid']); // the catalog activates the imported Neon Grid
    const STATE_COLOR = { playable: 'var(--ok,#3df58b)', unavailable: 'var(--bad,#ff5d73)', coming_soon: 'var(--muted)' };
    const cabs = CABINETS.map((c) => {
      const rs = cabinetRenderState(c, { activated });
      return `<div class="cab" style="text-align:left;border-color:${STATE_COLOR[rs] || 'var(--line)'}">
        <div style="font-weight:600">${c.display_name}</div>
        <div style="color:var(--muted);font-size:11px">${c.cabinet_type} · ${c.adapter_mode}</div>
        <div style="font-size:11px;color:${STATE_COLOR[rs] || 'var(--ink)'}">${rs} · ${adapterStateFor(c, { activated })}</div>
      </div>`;
    }).join('');

    const a = this.agent();
    let agentBlock = '<div class="hint">no agent selected</div>';
    if (a) {
      const bal = arcade.balances?.[a.id] || 0;
      const inv = Object.values(arcade.inventory?.[a.id] || {});
      const prog = Object.values(arcade.challengeProgress?.[a.id] || {});
      const done = prog.filter((p) => p.completed);
      agentBlock = `
        <div class="row"><span>agent</span><span>${short(a.id)}</span></div>
        <div class="row"><span>tickets</span><span>${bal}</span></div>
        <div class="row"><span>inventory</span><span>${inv.length ? inv.map((i) => i.display_name).join(', ') : '—'}</span></div>
        <div class="row"><span>challenges</span><span>${done.length}/${prog.length} done${done.some((p) => p.reward_claimed) ? ' · ' + done.filter((p) => p.reward_claimed).length + ' claimed' : ''}</span></div>`;
    }

    const feed = (arcade.feed || []).slice(-12).reverse();
    const feedBlock = feed.length
      ? feed.map((e) => `<div class="ev"><span class="t">t${e.tick}</span><span style="color:var(--muted)">${e.event_type}</span><span>${e.summary}</span></div>`).join('')
      : '<div class="hint">no arcade events yet — play a round or run a Phase 1 scenario</div>';

    host.innerHTML = `
      <div class="cabs" style="grid-template-columns:repeat(3,1fr)">${cabs}</div>
      <div class="seldet" style="margin-top:10px">${agentBlock}</div>
      <div style="margin-top:10px;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase">Public event feed</div>
      <div class="ticker">${feedBlock}</div>`;
  }

  // ── derived state ─────────────────────────────────────────────────────────
  world() {
    if (!this._foldTick || this._foldTick !== this.sim.canonicalLog.size + ':' + this.sim.tick) {
      this._fold = foldLog(this.sim.canonicalLog, this.sim.ctx);
      this._foldTick = this.sim.canonicalLog.size + ':' + this.sim.tick;
    }
    return this._fold.state;
  }
  applyRejections() { this.world(); return this._fold.rejections; }
  applyReasonFor(id) { return this.applyRejections().find((r) => r.event_id === id)?.reason; }

  // ── rendering ──────────────────────────────────────────────────────────────
  buildSpectrum() {
    const host = $('spectrum');
    this.specBar = {}; this.specCnt = {};
    for (const sb of SIDEBAND_NAMES) {
      const chan = document.createElement('div'); chan.className = 'chan';
      const wrap = document.createElement('div'); wrap.className = 'bar-wrap';
      const bar = document.createElement('div'); bar.className = 'bar';
      bar.style.background = `linear-gradient(180deg, ${CLASS_COLOR[SIDEBANDS[sb].klass]}, transparent)`;
      bar.style.boxShadow = `0 0 12px -2px ${CLASS_COLOR[SIDEBANDS[sb].klass]}`;
      wrap.appendChild(bar);
      const cnt = document.createElement('div'); cnt.className = 'cnt'; cnt.textContent = '0';
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = sb;
      chan.append(wrap, cnt, nm);
      host.appendChild(chan);
      this.specBar[sb] = bar; this.specCnt[sb] = cnt;
    }
    const legend = $('legend');
    for (const k of ['ephemeral', 'persistent', 'authoritative', 'validated', 'proposal']) {
      const s = document.createElement('span');
      s.innerHTML = `<i style="background:${CLASS_COLOR[k]}"></i>${k}`;
      legend.appendChild(s);
    }
  }

  decay() {
    for (const sb of SIDEBAND_NAMES) {
      this.energy[sb] = Math.max(0, this.energy[sb] * 0.82);
      const bar = this.specBar[sb];
      if (bar) bar.style.height = (4 + this.energy[sb] * 96) + '%';
    }
  }

  render() {
    const sim = this.sim; const w = this.world();
    $('s-tick').textContent = sim.tick;
    $('s-fabric').textContent = sim.canonicalLog.size;
    $('s-rej').textContent = sim.ingestRejections.length + this.applyRejections().length;
    $('s-fp').textContent = this._fold.fingerprint.slice(0, 8);

    // convergence (cheap set equality)
    const canonical = sim.canonicalLog.setFingerprint();
    let allConverged = true;
    for (const node of sim.nodes()) if (!node.subscriptions && node.knownSetFingerprint() !== canonical) allConverged = false;
    const cb = $('s-converge');
    cb.textContent = allConverged ? 'converged' : 'DESYNC';
    cb.className = 'badge ' + (allConverged ? 'ok' : 'bad');

    // spectrum counts
    for (const sb of SIDEBAND_NAMES) this.specCnt[sb].textContent = sim.sidebandTraffic[sb] || 0;
    this.decay();

    this.renderRooms(w);
    this.renderSlots(w);
    this.renderAgents(w, canonical);
    this.renderSelected(w);
    this.renderTicker();
    this.renderRejects();
    this.renderPhase1(w);
  }

  renderRooms(w) {
    const host = $('rooms'); host.innerHTML = '';
    for (const [rid, room] of this.sim.rooms) {
      const div = document.createElement('div');
      div.className = 'room' + (room.online ? '' : ' off');
      const machines = w.rooms[rid]?.machines || {};
      div.innerHTML = `<div class="rhead"><span class="dot"></span>${rid} <span style="color:var(--muted);font-size:11px">${room.online ? 'online' : 'OFFLINE'}</span></div>`;
      const cabs = document.createElement('div'); cabs.className = 'cabs';
      for (const c of CABS) {
        const occ = machines[c.id]?.occupiedBy;
        const cab = document.createElement('div');
        cab.className = 'cab' + (occ ? ' busy' : '');
        cab.innerHTML = `<span class="ico">${c.ico}</span><span class="cn">${c.id}</span><span class="occ">${occ ? short(occ) : 'open'}</span>`;
        cabs.appendChild(cab);
      }
      div.appendChild(cabs);
      host.appendChild(div);
    }
  }

  renderSlots(w) {
    const host = $('slots'); host.innerHTML = '';
    const slots = Object.values(w.slots);
    if (!slots.length) { host.innerHTML = '<div class="hint">no slots leased yet</div>'; return; }
    for (const s of slots.slice(-30)) {
      const el = document.createElement('div'); el.className = 'slot';
      el.innerHTML = `<span class="tag ${s.moderation_status}">${s.moderation_status}</span>
        <span>${short(s.slot_id)}</span><span style="color:var(--muted)">${s.cell_id}</span>
        <span style="margin-left:auto;color:var(--muted)">${short(s.holder)} · ${s.placed_objects.length} obj · t${s.start_tick}-${s.end_tick}</span>`;
      host.appendChild(el);
    }
  }

  renderAgents(w, canonical) {
    const host = $('agents'); host.innerHTML = '';
    for (const [id, a] of this.sim.agents) {
      const el = document.createElement('div');
      el.className = 'agent' + (id === this.activeId ? ' sel' : '');
      el.dataset.id = id;
      const conv = a.knownSetFingerprint() === canonical;
      const credits = w.economy.credits[id] || 0;
      const inv = Object.values(w.economy.goods).filter((g) => g.owner === id).length;
      el.innerHTML = `
        <span class="av" style="background:${colorFor(id)}">${id.replace(/[^a-z0-9]/gi, '').slice(-2).toUpperCase()}</span>
        <span class="meta"><span class="id">${id}</span>
          <span class="sub">${credits} cr · trust ${a.trustScore} · ${inv} goods</span></span>
        <span class="flags">
          ${a.role !== 'player' ? `<span class="pill role">${a.role}</span>` : ''}
          <span class="pill ${a.online ? 'on' : 'off'}">${a.online ? 'on' : 'off'}</span>
          ${conv ? '' : '<span class="pill div">desync</span>'}
        </span>`;
      host.appendChild(el);
    }
  }

  renderSelected(w) {
    const a = this.agent(); const host = $('seldet');
    if (!a) { host.innerHTML = '<div class="hint">no agent selected</div>'; return; }
    const inv = Object.entries(w.economy.goods).filter(([, g]) => g.owner === a.id);
    const equipped = w.cosmetics[a.id]?.equipped || {};
    host.innerHTML = `
      <div class="row"><span>id</span><span>${a.id}</span></div>
      <div class="row"><span>role</span><span>${a.role}</span></div>
      <div class="row"><span>online</span><span>${a.online}</span></div>
      <div class="row"><span>room</span><span>${a.currentRoom || '—'}</span></div>
      <div class="row"><span>credits</span><span>${w.economy.credits[a.id] || 0}</span></div>
      <div class="row"><span>trust</span><span>${a.trustScore}</span></div>
      <div class="row"><span>known events</span><span>${a.known.size}</span></div>
      <div class="inv">${inv.length ? inv.map(([gid, g]) => `<span class="g">${short(gid)} · ${g.type}${equipped[gid] ? ' ✓' : ''}</span>`).join('') : '<span class="hint">no goods</span>'}</div>`;
  }

  renderTicker() {
    const host = $('ticker');
    const evs = this.sim.canonicalLog.arrivalOrder().slice(-40);
    host.innerHTML = evs.map((e) => `<div class="ev"><span class="t">t${e.logical_tick}</span>
      <span class="sb" style="background:${CLASS_COLOR[SIDEBANDS[e.sideband].klass]}22;color:${CLASS_COLOR[SIDEBANDS[e.sideband].klass]}">${e.sideband}</span>
      <span>${short(e.actor_id)}</span><span style="color:var(--muted)">${e.event_type}</span></div>`).join('');
  }

  renderRejects() {
    const host = $('rejlist');
    const all = [...this.sim.ingestRejections.map((r) => ({ ...r, where: 'fabric' })),
                 ...this.applyRejections().map((r) => ({ tick: r.summary?.tick, type: r.summary?.type, actor: r.summary?.actor, reason: r.reason, where: 'fold' }))];
    if (!all.length) { host.innerHTML = '<div class="hint">no rejections yet — try an attack</div>'; return; }
    host.innerHTML = all.slice(-30).reverse().map((r) => `<div class="rej">
      <span>t${r.tick ?? '?'}</span><span>${short(r.actor)}</span><span>${r.type}</span>
      <span class="why">⟂ ${r.reason}</span><span style="color:var(--muted)">@${r.where}</span></div>`).join('');
  }

  refreshRoomSelect() {
    const sel = $('sel-room'); const cur = sel.value;
    sel.innerHTML = '';
    for (const rid of this.sim.rooms.keys()) {
      const o = document.createElement('option'); o.value = rid; o.textContent = rid; sel.appendChild(o);
    }
    if (cur && this.sim.rooms.has(cur)) sel.value = cur;
  }

  refreshCabSelect() {
    const sel = $('sel-cab'); sel.innerHTML = '';
    for (const c of CABS) { const o = document.createElement('option'); o.value = c.id; o.textContent = c.id; sel.appendChild(o); }
  }

  toast(msg, kind = '') {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'hw-toast show ' + kind;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { el.className = 'hw-toast ' + kind; }, 2600);
  }
}

// boot
new HiveDebug();
