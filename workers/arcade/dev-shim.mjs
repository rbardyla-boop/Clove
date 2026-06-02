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
 * faithful, minimal re-implementation of the Phase-1b DO rules for transport
 * parity only; production occupancy authority remains the DO (unchanged).
 */
import { WebSocketServer } from 'ws';
import {
  createTicketState, startRound, submitRound, expirePlayerRounds, getBalance,
} from './src/round-authority.mjs';
import { cabinetCatalogPayload, prizeCatalogPayload } from './src/catalog.mjs';
import { redeemPrize, equipCosmetic, unequipCosmetic, getInventory, getEquips, publicCosmeticState } from './src/prize-authority.mjs';
import { getLedger } from './src/ledger.mjs';

const PORT = Number(process.env.PORT || 8787);
const ROOM_ID = 'main';
const MACHINE_ID = 'pulse';

const machine = { machineId: MACHINE_ID, occupiedBy: null, occupiedSince: null, rev: 0 };
let ticketState = createTicketState();
const sockets = new Map(); // ws -> { playerId }

const send = (ws, payload) => { try { ws.send(JSON.stringify(payload)); } catch { /* closing */ } };
const broadcast = (payload) => { for (const ws of sockets.keys()) send(ws, payload); };
const roomStatePayload = () => ({ t: 'room_state', roomId: ROOM_ID, machines: { [MACHINE_ID]: { ...machine } }, rev: machine.rev });
const broadcastRoomState = () => broadcast(roomStatePayload());

function ticketStatePayload() {
  const lp = ticketState.lastPublic;
  return {
    t: 'ticket_state', roomId: ROOM_ID, machineId: MACHINE_ID,
    occupied: machine.occupiedBy !== null, occupiedBy: machine.occupiedBy,
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

function releaseIfOwner(playerId) {
  if (machine.occupiedBy !== playerId) return;
  machine.occupiedBy = null;
  machine.occupiedSince = null;
  machine.rev += 1;
  ticketState = expirePlayerRounds(ticketState, playerId);
  broadcastRoomState();
  broadcast(ticketStatePayload());
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
        break;
      }
      case 'occupy_machine': {
        if (d.machineId !== MACHINE_ID) return send(ws, { t: 'occupy_denied', machineId: d.machineId, reason: 'invalid' });
        if (!playerId) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        if (typeof d.rev === 'number' && d.rev !== machine.rev) return send(ws, { t: 'occupy_denied', machineId: MACHINE_ID, reason: 'stale_rev', currentRev: machine.rev });
        if (machine.occupiedBy !== null) return send(ws, { t: 'occupy_denied', machineId: MACHINE_ID, reason: 'busy' });
        machine.occupiedBy = playerId;
        machine.occupiedSince = Date.now();
        machine.rev += 1;
        broadcastRoomState();
        send(ws, { t: 'machine_occupied', machineId: MACHINE_ID, playerId, occupiedSince: machine.occupiedSince, rev: machine.rev });
        break;
      }
      case 'release_machine': {
        if (d.machineId !== MACHINE_ID) return;
        if (!playerId || machine.occupiedBy !== playerId) return send(ws, { t: 'error', code: 'not_owner', message: 'only occupant' });
        releaseIfOwner(playerId);
        break;
      }
      case 'heartbeat': break;
      case 'pulse_round_start': {
        if (!playerId) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        const roundId = `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        const res = startRound(ticketState, { machineId: d.machineId, occupantId: machine.occupiedBy, playerId, roundId, now: Date.now() });
        ticketState = res.state;
        if (!res.ok) return send(ws, { t: 'pulse_round_rejected', machineId: d.machineId, reason: res.reason });
        send(ws, { t: 'pulse_round_started', roomId: ROOM_ID, ...res.started });
        break;
      }
      case 'pulse_round_submit': {
        if (!playerId) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        const res = submitRound(ticketState, { payload: d, senderId: playerId, occupantId: machine.occupiedBy, now: Date.now() });
        ticketState = res.state;
        if (!res.ok) return send(ws, { t: 'pulse_round_rejected', roundId: d.roundId, machineId: d.machineId, reason: res.reason });
        send(ws, { t: 'pulse_round_accepted', roundId: d.roundId, machineId: d.machineId, awarded: res.awarded, balance: res.balance, grade: d.grade, score: d.score });
        send(ws, { t: 'ticket_balance', playerId, balance: res.balance });
        broadcast({ t: 'ticket_awarded', roomId: ROOM_ID, ...res.publicAward });
        broadcast(ticketStatePayload());
        break;
      }
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
        const rid = `rd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const res = redeemPrize(ticketState, { prizeId: d.prizeId, playerId, now: Date.now(), redemptionId: rid });
        ticketState = res.state;
        if (!res.ok) { send(ws, { t: 'prize_rejected', prizeId: d.prizeId, reason: res.reason }); break; }
        send(ws, { t: 'prize_redeemed', prizeId: d.prizeId, balance: res.balance, item: res.item });
        send(ws, { t: 'ticket_balance', playerId, balance: res.balance });
        sendInventory(ws, playerId);
        send(ws, { t: 'ticket_ledger', playerId, entries: getLedger(ticketState, playerId) });
        break;
      }
      case 'cosmetic_equip': {
        if (!playerId) return send(ws, { t: 'error', code: 'no_identity', message: 'join first' });
        const res = equipCosmetic(ticketState, { playerId, prizeId: d.prizeId });
        ticketState = res.state;
        if (!res.ok) { send(ws, { t: 'prize_rejected', context: 'equip', prizeId: d.prizeId, reason: res.reason }); break; }
        send(ws, { t: 'cosmetic_equipped', prizeId: res.prizeId, slot: res.slot });
        sendInventory(ws, playerId);
        broadcast(cosmeticStatePayload());
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
      default: send(ws, { t: 'error', code: 'unknown_type', message: `Unknown: ${d.t}` });
    }
  });

  ws.on('close', () => {
    const meta = sockets.get(ws);
    sockets.delete(ws);
    if (meta?.playerId) { releaseIfOwner(meta.playerId); ticketState = expirePlayerRounds(ticketState, meta.playerId); }
  });
});

console.log(`[dev-shim] Neon arcade protocol shim on ws://127.0.0.1:${PORT}/arcade/ws (TEST ONLY)`);
