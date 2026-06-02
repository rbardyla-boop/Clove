/**
 * dev-shim.mjs — TEST / DEV ONLY. NOT production.
 *
 * A tiny Node WebSocket server that speaks the exact Neon Circuit arcade protocol
 * so the real browser client + two-client Playwright validation can run locally
 * under Node 18 (wrangler dev needs Node >=22 here, so the real Durable Object
 * cannot be run locally).
 *
 * Ticket/round authority is the SAME code the production DO uses
 * (./src/round-authority.mjs) — no divergence on the new logic. Occupancy is a
 * faithful, minimal re-implementation of the Phase-1b/1g DO rules for transport
 * parity only; production occupancy authority remains the DO (unchanged).
 *
 * Phase 1g: multiple ticketed cabinets (pulse + signal), each with independent
 * one-occupant-per-machine occupancy, and shared round/ticket authority.
 */
import { WebSocketServer } from 'ws';
import {
  createTicketState, startRound, submitRound, expirePlayerRounds, getBalance,
} from './src/round-authority.mjs';
import { cabinetCatalogPayload, prizeCatalogPayload, ticketedMachineIds, getCabinetByMachineId } from './src/catalog.mjs';
import { redeemPrize, equipCosmetic, unequipCosmetic, getInventory, getEquips, publicCosmeticState } from './src/prize-authority.mjs';
import { getLedger } from './src/ledger.mjs';
import { challengeCatalogPayload, getProgress, recordRoundAccepted, recordRedemption, claimReward } from './src/challenges.mjs';
import { getAchievements } from './src/achievements.mjs';
import { appendEvent, eventFeedPayload } from './src/events.mjs';

const PORT = Number(process.env.PORT || 8787);
const ROOM_ID = 'main';
const PULSE_ID = 'pulse'; // canonical machine used for back-compat room_state.rev / ticket_state

// One occupancy machine per live, ticket-enabled cabinet (pulse + signal).
const machines = {};
for (const machineId of ticketedMachineIds()) {
  machines[machineId] = { machineId, occupiedBy: null, occupiedSince: null, rev: 0 };
}
let ticketState = createTicketState();
const sockets = new Map(); // ws -> { playerId }

const send = (ws, payload) => { try { ws.send(JSON.stringify(payload)); } catch { /* closing */ } };
const broadcast = (payload) => { for (const ws of sockets.keys()) send(ws, payload); };
const machinesSnapshot = () => Object.fromEntries(Object.entries(machines).map(([id, m]) => [id, { ...m }]));
const roomStatePayload = () => ({ t: 'room_state', roomId: ROOM_ID, machines: machinesSnapshot(), rev: machines[PULSE_ID].rev });
const broadcastRoomState = () => broadcast(roomStatePayload());

function ticketStatePayload() {
  const lp = ticketState.lastPublic;
  const pulse = machines[PULSE_ID];
  return {
    t: 'ticket_state', roomId: ROOM_ID, machineId: PULSE_ID,
    occupied: pulse.occupiedBy !== null, occupiedBy: pulse.occupiedBy,
    lastScore: lp ? lp.score : null, lastGrade: lp ? lp.grade : null,
    lastAwardBy: lp ? lp.playerId : null, lastAwardAmount: lp ? lp.awarded : null,
  };
}

function cosmeticStatePayload() {
  return { t: 'cosmetic_state', roomId: ROOM_ID, equipped: publicCosmeticState(ticketState) };
}
function sendInventory(ws, playerId) {
  send(ws, { t: 'inventory_state', playerId, items: getInventory(ticketState, playerId), equips: getEquips(ticketState, playerId) });
}

// Phase 1h: append a public-safe event to the bounded feed (state mutation only).
function pushEvent(evt) {
  const r = appendEvent(ticketState, evt);
  ticketState = r.state;
  return r.event;
}
const broadcastEvent = (event) => broadcast({ t: 'arcade_event', event });

function releaseAll(playerId) {
  let released = false;
  for (const m of Object.values(machines)) {
    if (m.occupiedBy === playerId) {
      m.occupiedBy = null;
      m.occupiedSince = null;
      m.rev += 1;
      released = true;
    }
  }
  if (released) {
    ticketState = expirePlayerRounds(ticketState, playerId);
    broadcastRoomState();
    broadcast(ticketStatePayload());
  }
}

// Shared round-start / round-submit handlers (one per cabinet, message-type only differs).
function handleRoundStart(ws, d, playerId, startedType, rejectedType) {
  if (!playerId) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
  const machine = machines[d.machineId];
  const roundId = `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const res = startRound(ticketState, { machineId: d.machineId, occupantId: machine ? machine.occupiedBy : null, playerId, roundId, now: Date.now() });
  ticketState = res.state;
  if (!res.ok) return send(ws, { t: rejectedType, machineId: d.machineId, reason: res.reason });
  send(ws, { t: startedType, roomId: ROOM_ID, ...res.started });
}
function handleRoundSubmit(ws, d, playerId, acceptedType, rejectedType) {
  if (!playerId) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
  const machine = machines[d.machineId];
  const res = submitRound(ticketState, { payload: d, senderId: playerId, occupantId: machine ? machine.occupiedBy : null, now: Date.now() });
  ticketState = res.state;
  if (!res.ok) return send(ws, { t: rejectedType, roundId: d.roundId, machineId: d.machineId, reason: res.reason });
  const now = Date.now();
  const cabinet = getCabinetByMachineId(d.machineId);
  const cabinetType = cabinet ? cabinet.cabinet_type : null;
  const cabinetLabel = cabinet ? cabinet.display_name : d.machineId;
  // Phase 1h: accepted round → challenge progress + public feed.
  const rec = recordRoundAccepted(ticketState, { playerId, cabinetType, noiseHits: d.noiseHits, awarded: res.awarded, now });
  ticketState = rec.state;
  const feedEvents = [pushEvent({ type: 'ticket_award', actorPublicId: playerId, summary: `${playerId} earned ${res.awarded} tickets at ${cabinetLabel}`, source: d.machineId, now })];
  for (const c of rec.newlyCompleted) feedEvents.push(pushEvent({ type: 'challenge_completed', actorPublicId: playerId, summary: `${playerId} completed ${c.display_name}`, source: c.challenge_id, now }));

  send(ws, { t: acceptedType, roundId: d.roundId, machineId: d.machineId, awarded: res.awarded, balance: res.balance, grade: d.grade, score: d.score });
  send(ws, { t: 'ticket_balance', playerId, balance: res.balance });
  broadcast({ t: 'ticket_awarded', roomId: ROOM_ID, ...res.publicAward });
  broadcast(ticketStatePayload());
  for (const c of rec.newlyCompleted) send(ws, { t: 'challenge_completed', challenge_id: c.challenge_id, display_name: c.display_name });
  if (rec.newlyCompleted.length) send(ws, { t: 'challenge_progress', playerId, challenges: getProgress(ticketState, playerId) });
  for (const ev of feedEvents) broadcastEvent(ev);
}

const wss = new WebSocketServer({ port: PORT, path: '/arcade/ws' });

wss.on('connection', (ws) => {
  sockets.set(ws, { playerId: null });

  ws.on('message', (raw) => {
    let d;
    try { d = JSON.parse(raw.toString()); } catch { send(ws, { t: 'error', code: 'bad_json', message: 'Invalid JSON' }); return; }
    const meta = sockets.get(ws);
    const playerId = meta?.playerId ?? d.playerId;

    switch (d.t) {
      case 'join_room': {
        if (d.roomId !== ROOM_ID) return send(ws, { t: 'error', code: 'invalid_room', message: 'only main' });
        if (!playerId) return send(ws, { t: 'error', code: 'missing_player', message: 'playerId required' });
        sockets.set(ws, { playerId });
        send(ws, roomStatePayload());
        send(ws, { t: 'ticket_balance', playerId, balance: getBalance(ticketState, playerId) });
        send(ws, ticketStatePayload());
        send(ws, cosmeticStatePayload());
        send(ws, { t: 'challenge_progress', playerId, challenges: getProgress(ticketState, playerId) });
        send(ws, { t: 'achievement_state', playerId, achievements: getAchievements(ticketState, playerId) });
        send(ws, { t: 'arcade_event_feed', ...eventFeedPayload(ticketState) });
        break;
      }
      case 'occupy_machine': {
        const machine = machines[d.machineId];
        if (!machine) return send(ws, { t: 'occupy_denied', machineId: d.machineId, reason: 'invalid' });
        if (!playerId) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        if (typeof d.rev === 'number' && d.rev !== machine.rev) return send(ws, { t: 'occupy_denied', machineId: d.machineId, reason: 'stale_rev', currentRev: machine.rev });
        if (machine.occupiedBy !== null) return send(ws, { t: 'occupy_denied', machineId: d.machineId, reason: 'busy' });
        machine.occupiedBy = playerId;
        machine.occupiedSince = Date.now();
        machine.rev += 1;
        broadcastRoomState();
        send(ws, { t: 'machine_occupied', machineId: d.machineId, playerId, occupiedSince: machine.occupiedSince, rev: machine.rev });
        break;
      }
      case 'release_machine': {
        const machine = machines[d.machineId];
        if (!machine) return;
        if (!playerId || machine.occupiedBy !== playerId) return send(ws, { t: 'error', code: 'not_owner', message: 'only occupant' });
        machine.occupiedBy = null;
        machine.occupiedSince = null;
        machine.rev += 1;
        ticketState = expirePlayerRounds(ticketState, playerId);
        broadcastRoomState();
        broadcast(ticketStatePayload());
        break;
      }
      case 'heartbeat': break;
      case 'pulse_round_start': handleRoundStart(ws, d, playerId, 'pulse_round_started', 'pulse_round_rejected'); break;
      case 'pulse_round_submit': handleRoundSubmit(ws, d, playerId, 'pulse_round_accepted', 'pulse_round_rejected'); break;
      case 'signal_sprint_round_start': handleRoundStart(ws, d, playerId, 'signal_sprint_round_started', 'signal_sprint_round_rejected'); break;
      case 'signal_sprint_round_submit': handleRoundSubmit(ws, d, playerId, 'signal_sprint_round_accepted', 'signal_sprint_round_rejected'); break;
      case 'ticket_balance_request': {
        if (!playerId) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        send(ws, { t: 'ticket_balance', playerId, balance: getBalance(ticketState, playerId) });
        break;
      }
      case 'cabinet_catalog_request': {
        send(ws, { t: 'cabinet_catalog', roomId: ROOM_ID, ...cabinetCatalogPayload() });
        break;
      }
      case 'prize_catalog_request': {
        send(ws, { t: 'prize_catalog', ...prizeCatalogPayload() });
        break;
      }
      case 'ticket_ledger_request': {
        if (!playerId) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        send(ws, { t: 'ticket_ledger', playerId, entries: getLedger(ticketState, playerId) });
        break;
      }
      case 'inventory_request': {
        if (!playerId) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        sendInventory(ws, playerId);
        break;
      }
      case 'prize_redeem': {
        if (!playerId) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        const now = Date.now();
        const rid = `rd-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const res = redeemPrize(ticketState, { prizeId: d.prizeId, playerId, now, redemptionId: rid });
        ticketState = res.state;
        if (!res.ok) { send(ws, { t: 'prize_rejected', prizeId: d.prizeId, reason: res.reason }); break; }
        const rec = recordRedemption(ticketState, { playerId, now });
        ticketState = rec.state;
        const prizeName = res.publicSummary ? res.publicSummary.display_name : d.prizeId;
        const feed = [pushEvent({ type: 'prize_redeem', actorPublicId: playerId, summary: `${playerId} redeemed ${prizeName}`, source: 'prize-counter', now })];
        for (const c of rec.newlyCompleted) feed.push(pushEvent({ type: 'challenge_completed', actorPublicId: playerId, summary: `${playerId} completed ${c.display_name}`, source: c.challenge_id, now }));
        send(ws, { t: 'prize_redeemed', prizeId: d.prizeId, balance: res.balance, item: res.item });
        send(ws, { t: 'ticket_balance', playerId, balance: res.balance });
        sendInventory(ws, playerId);
        send(ws, { t: 'ticket_ledger', playerId, entries: getLedger(ticketState, playerId) });
        for (const c of rec.newlyCompleted) send(ws, { t: 'challenge_completed', challenge_id: c.challenge_id, display_name: c.display_name });
        if (rec.newlyCompleted.length) send(ws, { t: 'challenge_progress', playerId, challenges: getProgress(ticketState, playerId) });
        for (const ev of feed) broadcastEvent(ev);
        break;
      }
      case 'cosmetic_equip': {
        if (!playerId) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        const res = equipCosmetic(ticketState, { playerId, prizeId: d.prizeId });
        ticketState = res.state;
        if (!res.ok) { send(ws, { t: 'prize_rejected', context: 'equip', prizeId: d.prizeId, reason: res.reason }); break; }
        const owned = ticketState.inventory[playerId] && ticketState.inventory[playerId][res.prizeId];
        const ev = pushEvent({ type: 'cosmetic_equip', actorPublicId: playerId, summary: `${playerId} equipped ${owned ? owned.display_name : res.prizeId}`, source: res.slot, now: Date.now() });
        send(ws, { t: 'cosmetic_equipped', prizeId: res.prizeId, slot: res.slot });
        sendInventory(ws, playerId);
        broadcast(cosmeticStatePayload());
        broadcastEvent(ev);
        break;
      }
      case 'cosmetic_unequip': {
        if (!playerId) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        const res = unequipCosmetic(ticketState, { playerId, slot: d.slot, prizeId: d.prizeId });
        ticketState = res.state;
        if (!res.ok) { send(ws, { t: 'prize_rejected', context: 'unequip', slot: d.slot, reason: res.reason }); break; }
        send(ws, { t: 'cosmetic_unequipped', slot: res.slot });
        sendInventory(ws, playerId);
        broadcast(cosmeticStatePayload());
        break;
      }
      case 'challenge_catalog_request': {
        send(ws, { t: 'challenge_catalog', ...challengeCatalogPayload() });
        break;
      }
      case 'challenge_progress_request': {
        if (!playerId) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        send(ws, { t: 'challenge_progress', playerId, challenges: getProgress(ticketState, playerId) });
        break;
      }
      case 'achievement_state_request': {
        if (!playerId) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        send(ws, { t: 'achievement_state', playerId, achievements: getAchievements(ticketState, playerId) });
        break;
      }
      case 'arcade_event_feed_request': {
        send(ws, { t: 'arcade_event_feed', ...eventFeedPayload(ticketState) });
        break;
      }
      case 'challenge_reward_claim': {
        if (!playerId) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        const now = Date.now();
        const res = claimReward(ticketState, { playerId, challengeId: d.challengeId, now });
        ticketState = res.state;
        if (!res.ok) { send(ws, { t: 'challenge_rejected', challengeId: d.challengeId, reason: res.reason }); break; }
        const feed = [];
        if (res.badge && res.achievement) {
          feed.push(pushEvent({ type: 'achievement_unlocked', actorPublicId: playerId, summary: `${playerId} ${res.achievement.public_safe_summary}`, source: res.achievement.achievement_id, now }));
          send(ws, { t: 'achievement_unlocked', achievement_id: res.achievement.achievement_id, badge: res.badge });
        }
        send(ws, { t: 'challenge_rewarded', challengeId: d.challengeId, badge: res.badge || null, achievement_id: res.achievement ? res.achievement.achievement_id : null, ticketBonus: res.ticketBonus, balance: res.balance });
        if (res.ticketBonus > 0) {
          send(ws, { t: 'ticket_balance', playerId, balance: res.balance });
          send(ws, { t: 'ticket_ledger', playerId, entries: getLedger(ticketState, playerId) });
        }
        sendInventory(ws, playerId);
        send(ws, { t: 'challenge_progress', playerId, challenges: getProgress(ticketState, playerId) });
        send(ws, { t: 'achievement_state', playerId, achievements: getAchievements(ticketState, playerId) });
        for (const ev of feed) broadcastEvent(ev);
        break;
      }
      default: send(ws, { t: 'error', code: 'unknown_type', message: `Unknown: ${d.t}` });
    }
  });

  ws.on('close', () => {
    const meta = sockets.get(ws);
    sockets.delete(ws);
    if (meta?.playerId) { releaseAll(meta.playerId); ticketState = expirePlayerRounds(ticketState, meta.playerId); }
  });
});

console.log(`[dev-shim] Neon arcade protocol shim on ws://127.0.0.1:${PORT}/arcade/ws (TEST ONLY)`);
