/**
 * dev-shim.mjs — TEST / DEV ONLY. NOT production.
 *
 * A tiny Node WebSocket server that speaks the exact Neon Circuit arcade protocol
 * so the browser client + multi-client Playwright validation can run locally under
 * Node 18 (wrangler dev needs Node >=22 here). Ticket/round authority is the SAME
 * code the production DO uses; occupancy is a faithful re-implementation for
 * transport parity only.
 *
 * Phase 2a: the shim hosts MULTIPLE rooms as isolated state namespaces, mirroring
 * the Durable Object — a socket is bound to one room and all state/broadcasts are
 * room-scoped.
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
import { DEFAULT_ROOM_ID, resolveRoomId, roomListPayload, roomMetaPayload, hasCapacity } from './src/rooms.mjs';

const PORT = Number(process.env.PORT || 8787);
const PULSE_ID = 'pulse';

// roomId -> { machines, ticketState } — one isolated partition per room.
const rooms = {};
function room(roomId) {
  let r = rooms[roomId];
  if (!r) {
    const machines = {};
    for (const machineId of ticketedMachineIds()) machines[machineId] = { machineId, occupiedBy: null, occupiedSince: null, rev: 0 };
    r = rooms[roomId] = { machines, ticketState: createTicketState() };
  }
  return r;
}
const sockets = new Map(); // ws -> { playerId, roomId }

const send = (ws, payload) => { try { ws.send(JSON.stringify(payload)); } catch { /* closing */ } };
const broadcastRoom = (roomId, payload) => { for (const [ws, meta] of sockets) if (meta.roomId === roomId) send(ws, payload); };
const snapshot = (m) => Object.fromEntries(Object.entries(m).map(([id, x]) => [id, { ...x }]));

function populations() {
  const byRoom = {};
  for (const meta of sockets.values()) { if (!meta.playerId) continue; (byRoom[meta.roomId] ||= new Set()).add(meta.playerId); }
  const out = {};
  for (const [r, set] of Object.entries(byRoom)) out[r] = set.size;
  return out;
}
const roomPopulation = (roomId) => populations()[roomId] || 0;
function distinctPlayers(roomId, exclude) {
  const set = new Set();
  for (const meta of sockets.values()) if (meta.playerId && meta.roomId === roomId && meta.playerId !== exclude) set.add(meta.playerId);
  return set.size;
}

const roomStatePayload = (roomId) => ({ t: 'room_state', roomId, machines: snapshot(room(roomId).machines), rev: room(roomId).machines[PULSE_ID].rev });
const broadcastRoomState = (roomId) => broadcastRoom(roomId, roomStatePayload(roomId));
const broadcastPopulation = (roomId) => broadcastRoom(roomId, { t: 'room_population', roomId, population: roomPopulation(roomId) });

function ticketStatePayload(roomId) {
  const part = room(roomId);
  const lp = part.ticketState.lastPublic;
  const pulse = part.machines[PULSE_ID];
  return { t: 'ticket_state', roomId, machineId: PULSE_ID, occupied: pulse.occupiedBy !== null, occupiedBy: pulse.occupiedBy, lastScore: lp ? lp.score : null, lastGrade: lp ? lp.grade : null, lastAwardBy: lp ? lp.playerId : null, lastAwardAmount: lp ? lp.awarded : null };
}
const cosmeticStatePayload = (roomId) => ({ t: 'cosmetic_state', roomId, equipped: publicCosmeticState(room(roomId).ticketState) });
const sendInventory = (ws, roomId, playerId) => send(ws, { t: 'inventory_state', playerId, items: getInventory(room(roomId).ticketState, playerId), equips: getEquips(room(roomId).ticketState, playerId) });

function pushEvent(roomId, evt) {
  const part = room(roomId);
  const r = appendEvent(part.ticketState, evt);
  part.ticketState = r.state;
  return r.event;
}
const broadcastEvent = (roomId, event) => broadcastRoom(roomId, { t: 'arcade_event', event });

function leaveRoomInternal(playerId, roomId) {
  const part = room(roomId);
  let released = false;
  for (const m of Object.values(part.machines)) {
    if (m.occupiedBy === playerId) { m.occupiedBy = null; m.occupiedSince = null; m.rev += 1; released = true; }
  }
  part.ticketState = expirePlayerRounds(part.ticketState, playerId);
  if (released) broadcastRoomState(roomId);
  broadcastRoom(roomId, ticketStatePayload(roomId));
}

function handleJoin(ws, rawRoomId, playerId, lobby) {
  if (!playerId) return send(ws, { t: 'error', code: 'missing_player', message: 'playerId required' });
  const resolved = resolveRoomId(rawRoomId);
  if (!resolved.ok && rawRoomId != null && rawRoomId !== '') return send(ws, { t: 'room_join_rejected', roomId: String(rawRoomId), reason: 'invalid_room' });
  const roomId = resolved.roomId;
  const prev = sockets.get(ws);
  if (prev && prev.playerId && prev.roomId !== roomId) leaveRoomInternal(prev.playerId, prev.roomId);
  if (!hasCapacity(roomId, distinctPlayers(roomId, playerId))) return send(ws, { t: 'room_join_rejected', roomId, reason: 'room_full' });
  sockets.set(ws, { playerId, roomId });
  const part = room(roomId);
  if (lobby) send(ws, { t: 'room_joined', room: roomMetaPayload(roomId, roomPopulation(roomId)) });
  send(ws, roomStatePayload(roomId));
  send(ws, { t: 'ticket_balance', playerId, balance: getBalance(part.ticketState, playerId) });
  send(ws, ticketStatePayload(roomId));
  send(ws, cosmeticStatePayload(roomId));
  send(ws, { t: 'challenge_progress', playerId, challenges: getProgress(part.ticketState, playerId) });
  send(ws, { t: 'achievement_state', playerId, achievements: getAchievements(part.ticketState, playerId) });
  send(ws, { t: 'arcade_event_feed', roomId, ...eventFeedPayload(part.ticketState) });
  broadcastPopulation(roomId);
}

function handleRoundStart(ws, d, meta, startedType, rejectedType) {
  if (!meta) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
  const { playerId, roomId } = meta;
  const part = room(roomId);
  const machine = part.machines[d.machineId];
  const roundId = `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const res = startRound(part.ticketState, { machineId: d.machineId, occupantId: machine ? machine.occupiedBy : null, playerId, roundId, now: Date.now() });
  part.ticketState = res.state;
  if (!res.ok) return send(ws, { t: rejectedType, machineId: d.machineId, reason: res.reason });
  send(ws, { t: startedType, roomId, ...res.started });
}
function handleRoundSubmit(ws, d, meta, acceptedType, rejectedType) {
  if (!meta) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
  const { playerId, roomId } = meta;
  const part = room(roomId);
  const machine = part.machines[d.machineId];
  const res = submitRound(part.ticketState, { payload: d, senderId: playerId, occupantId: machine ? machine.occupiedBy : null, now: Date.now() });
  part.ticketState = res.state;
  if (!res.ok) return send(ws, { t: rejectedType, roundId: d.roundId, machineId: d.machineId, reason: res.reason });
  const now = Date.now();
  const cabinet = getCabinetByMachineId(d.machineId);
  const cabinetType = cabinet ? cabinet.cabinet_type : null;
  const cabinetLabel = cabinet ? cabinet.display_name : d.machineId;
  const rec = recordRoundAccepted(part.ticketState, { playerId, cabinetType, noiseHits: d.noiseHits, mistakes: d.mistakes, awarded: res.awarded, now });
  part.ticketState = rec.state;
  const feedEvents = [pushEvent(roomId, { type: 'ticket_award', actorPublicId: playerId, summary: `${playerId} earned ${res.awarded} tickets at ${cabinetLabel}`, source: d.machineId, now })];
  for (const c of rec.newlyCompleted) feedEvents.push(pushEvent(roomId, { type: 'challenge_completed', actorPublicId: playerId, summary: `${playerId} completed ${c.display_name}`, source: c.challenge_id, now }));
  send(ws, { t: acceptedType, roundId: d.roundId, machineId: d.machineId, awarded: res.awarded, balance: res.balance, grade: d.grade, score: d.score });
  send(ws, { t: 'ticket_balance', playerId, balance: res.balance });
  broadcastRoom(roomId, { t: 'ticket_awarded', roomId, ...res.publicAward });
  broadcastRoom(roomId, ticketStatePayload(roomId));
  for (const c of rec.newlyCompleted) send(ws, { t: 'challenge_completed', challenge_id: c.challenge_id, display_name: c.display_name });
  if (rec.newlyCompleted.length) send(ws, { t: 'challenge_progress', playerId, challenges: getProgress(part.ticketState, playerId) });
  for (const ev of feedEvents) broadcastEvent(roomId, ev);
}

const wss = new WebSocketServer({ port: PORT, path: '/arcade/ws' });

wss.on('connection', (ws) => {
  sockets.set(ws, { playerId: null, roomId: DEFAULT_ROOM_ID });

  ws.on('message', (raw) => {
    let d;
    try { d = JSON.parse(raw.toString()); } catch { send(ws, { t: 'error', code: 'bad_json', message: 'Invalid JSON' }); return; }
    const meta = sockets.get(ws);
    const bound = meta && meta.playerId ? meta : null;

    switch (d.t) {
      case 'room_list_request': return void send(ws, { t: 'room_list', ...roomListPayload(populations()) });
      case 'join_room': return void handleJoin(ws, d.roomId, meta?.playerId ?? d.playerId, false);
      case 'room_join_request': return void handleJoin(ws, d.roomId, meta?.playerId ?? d.playerId, true);
      case 'room_leave_request': {
        if (!bound) return;
        leaveRoomInternal(bound.playerId, bound.roomId);
        send(ws, { t: 'room_left', roomId: bound.roomId });
        return;
      }
      case 'room_state_request': return void send(ws, roomStatePayload((bound || meta).roomId));
      case 'occupy_machine': {
        if (!bound) return void send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        const part = room(bound.roomId); const machine = part.machines[d.machineId];
        if (!machine) return void send(ws, { t: 'occupy_denied', machineId: d.machineId, reason: 'invalid' });
        if (typeof d.rev === 'number' && d.rev !== machine.rev) return void send(ws, { t: 'occupy_denied', machineId: d.machineId, reason: 'stale_rev', currentRev: machine.rev });
        if (machine.occupiedBy !== null) return void send(ws, { t: 'occupy_denied', machineId: d.machineId, reason: 'busy' });
        machine.occupiedBy = bound.playerId; machine.occupiedSince = Date.now(); machine.rev += 1;
        broadcastRoomState(bound.roomId);
        send(ws, { t: 'machine_occupied', machineId: d.machineId, playerId: bound.playerId, occupiedSince: machine.occupiedSince, rev: machine.rev });
        return;
      }
      case 'release_machine': {
        if (!bound) return;
        const machine = room(bound.roomId).machines[d.machineId];
        if (!machine || machine.occupiedBy !== bound.playerId) return void send(ws, { t: 'error', code: 'not_owner', message: 'only occupant' });
        machine.occupiedBy = null; machine.occupiedSince = null; machine.rev += 1;
        room(bound.roomId).ticketState = expirePlayerRounds(room(bound.roomId).ticketState, bound.playerId);
        broadcastRoomState(bound.roomId); broadcastRoom(bound.roomId, ticketStatePayload(bound.roomId));
        return;
      }
      case 'heartbeat': return;
      case 'pulse_round_start': return void handleRoundStart(ws, d, bound, 'pulse_round_started', 'pulse_round_rejected');
      case 'pulse_round_submit': return void handleRoundSubmit(ws, d, bound, 'pulse_round_accepted', 'pulse_round_rejected');
      case 'signal_sprint_round_start': return void handleRoundStart(ws, d, bound, 'signal_sprint_round_started', 'signal_sprint_round_rejected');
      case 'signal_sprint_round_submit': return void handleRoundSubmit(ws, d, bound, 'signal_sprint_round_accepted', 'signal_sprint_round_rejected');
      case 'neon_grid_round_start': return void handleRoundStart(ws, d, bound, 'neon_grid_round_started', 'neon_grid_round_rejected');
      case 'neon_grid_round_submit': return void handleRoundSubmit(ws, d, bound, 'neon_grid_round_accepted', 'neon_grid_round_rejected');
      case 'ticket_balance_request': {
        if (!bound) return void send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        return void send(ws, { t: 'ticket_balance', playerId: bound.playerId, balance: getBalance(room(bound.roomId).ticketState, bound.playerId) });
      }
      case 'cabinet_catalog_request': return void send(ws, { t: 'cabinet_catalog', roomId: (bound || meta).roomId, ...cabinetCatalogPayload() });
      case 'prize_catalog_request': return void send(ws, { t: 'prize_catalog', ...prizeCatalogPayload() });
      case 'ticket_ledger_request': {
        if (!bound) return void send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        return void send(ws, { t: 'ticket_ledger', playerId: bound.playerId, entries: getLedger(room(bound.roomId).ticketState, bound.playerId) });
      }
      case 'inventory_request': {
        if (!bound) return void send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        return void sendInventory(ws, bound.roomId, bound.playerId);
      }
      case 'prize_redeem': {
        if (!bound) return void send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        const { playerId, roomId } = bound; const part = room(roomId);
        const now = Date.now(); const rid = `rd-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const res = redeemPrize(part.ticketState, { prizeId: d.prizeId, playerId, now, redemptionId: rid });
        part.ticketState = res.state;
        if (!res.ok) return void send(ws, { t: 'prize_rejected', prizeId: d.prizeId, reason: res.reason });
        const rec = recordRedemption(part.ticketState, { playerId, now });
        part.ticketState = rec.state;
        const prizeName = res.publicSummary ? res.publicSummary.display_name : d.prizeId;
        const feed = [pushEvent(roomId, { type: 'prize_redeem', actorPublicId: playerId, summary: `${playerId} redeemed ${prizeName}`, source: 'prize-counter', now })];
        for (const c of rec.newlyCompleted) feed.push(pushEvent(roomId, { type: 'challenge_completed', actorPublicId: playerId, summary: `${playerId} completed ${c.display_name}`, source: c.challenge_id, now }));
        send(ws, { t: 'prize_redeemed', prizeId: d.prizeId, balance: res.balance, item: res.item });
        send(ws, { t: 'ticket_balance', playerId, balance: res.balance });
        sendInventory(ws, roomId, playerId);
        send(ws, { t: 'ticket_ledger', playerId, entries: getLedger(part.ticketState, playerId) });
        for (const c of rec.newlyCompleted) send(ws, { t: 'challenge_completed', challenge_id: c.challenge_id, display_name: c.display_name });
        if (rec.newlyCompleted.length) send(ws, { t: 'challenge_progress', playerId, challenges: getProgress(part.ticketState, playerId) });
        for (const ev of feed) broadcastEvent(roomId, ev);
        return;
      }
      case 'cosmetic_equip': {
        if (!bound) return void send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        const { playerId, roomId } = bound; const part = room(roomId);
        const res = equipCosmetic(part.ticketState, { playerId, prizeId: d.prizeId });
        part.ticketState = res.state;
        if (!res.ok) return void send(ws, { t: 'prize_rejected', context: 'equip', prizeId: d.prizeId, reason: res.reason });
        const owned = part.ticketState.inventory[playerId] && part.ticketState.inventory[playerId][res.prizeId];
        const ev = pushEvent(roomId, { type: 'cosmetic_equip', actorPublicId: playerId, summary: `${playerId} equipped ${owned ? owned.display_name : res.prizeId}`, source: res.slot, now: Date.now() });
        send(ws, { t: 'cosmetic_equipped', prizeId: res.prizeId, slot: res.slot });
        sendInventory(ws, roomId, playerId);
        broadcastRoom(roomId, cosmeticStatePayload(roomId));
        broadcastEvent(roomId, ev);
        return;
      }
      case 'cosmetic_unequip': {
        if (!bound) return void send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        const { playerId, roomId } = bound; const part = room(roomId);
        const res = unequipCosmetic(part.ticketState, { playerId, slot: d.slot, prizeId: d.prizeId });
        part.ticketState = res.state;
        if (!res.ok) return void send(ws, { t: 'prize_rejected', context: 'unequip', slot: d.slot, reason: res.reason });
        send(ws, { t: 'cosmetic_unequipped', slot: res.slot });
        sendInventory(ws, roomId, playerId);
        broadcastRoom(roomId, cosmeticStatePayload(roomId));
        return;
      }
      case 'challenge_catalog_request': return void send(ws, { t: 'challenge_catalog', ...challengeCatalogPayload() });
      case 'challenge_progress_request': {
        if (!bound) return void send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        return void send(ws, { t: 'challenge_progress', playerId: bound.playerId, challenges: getProgress(room(bound.roomId).ticketState, bound.playerId) });
      }
      case 'achievement_state_request': {
        if (!bound) return void send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        return void send(ws, { t: 'achievement_state', playerId: bound.playerId, achievements: getAchievements(room(bound.roomId).ticketState, bound.playerId) });
      }
      case 'arcade_event_feed_request': return void send(ws, { t: 'arcade_event_feed', roomId: (bound || meta).roomId, ...eventFeedPayload(room((bound || meta).roomId).ticketState) });
      case 'challenge_reward_claim': {
        if (!bound) return void send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        const { playerId, roomId } = bound; const part = room(roomId);
        const now = Date.now();
        const res = claimReward(part.ticketState, { playerId, challengeId: d.challengeId, now });
        part.ticketState = res.state;
        if (!res.ok) return void send(ws, { t: 'challenge_rejected', challengeId: d.challengeId, reason: res.reason });
        const feed = [];
        if (res.badge && res.achievement) {
          feed.push(pushEvent(roomId, { type: 'achievement_unlocked', actorPublicId: playerId, summary: `${playerId} ${res.achievement.public_safe_summary}`, source: res.achievement.achievement_id, now }));
          send(ws, { t: 'achievement_unlocked', achievement_id: res.achievement.achievement_id, badge: res.badge });
        }
        send(ws, { t: 'challenge_rewarded', challengeId: d.challengeId, badge: res.badge || null, achievement_id: res.achievement ? res.achievement.achievement_id : null, ticketBonus: res.ticketBonus, balance: res.balance });
        if (res.ticketBonus > 0) {
          send(ws, { t: 'ticket_balance', playerId, balance: res.balance });
          send(ws, { t: 'ticket_ledger', playerId, entries: getLedger(part.ticketState, playerId) });
        }
        sendInventory(ws, roomId, playerId);
        send(ws, { t: 'challenge_progress', playerId, challenges: getProgress(part.ticketState, playerId) });
        send(ws, { t: 'achievement_state', playerId, achievements: getAchievements(part.ticketState, playerId) });
        for (const ev of feed) broadcastEvent(roomId, ev);
        return;
      }
      default: send(ws, { t: 'error', code: 'unknown_type', message: `Unknown: ${d.t}` });
    }
  });

  ws.on('close', () => {
    const meta = sockets.get(ws);
    sockets.delete(ws);
    if (meta?.playerId) { leaveRoomInternal(meta.playerId, meta.roomId); broadcastPopulation(meta.roomId); }
  });
});

console.log(`[dev-shim] Neon arcade protocol shim on ws://127.0.0.1:${PORT}/arcade/ws (TEST ONLY) — multi-room`);
