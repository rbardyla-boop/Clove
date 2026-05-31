/**
 * Neon Circuit Arcade — Level 1 Main Floor.
 *
 * Renders the arcade floor and wires the powered cabinets (Pulse Tap, Signal
 * Sprint) to the already-validated room authority via neon-circuit-room-client.js.
 * Each cabinet's free / yours / in-use state is derived ONLY from the Durable
 * Object's authoritative `room_state` (per-machine occupiedBy + rev) — never
 * assumed locally. Occupancy is one-occupant-per-machine and independent per
 * cabinet, so A can hold Signal Sprint while B holds Pulse Tap.
 *
 * Phase 1g: a second ticketed cabinet (Signal Sprint) proves the arcade loop is
 * not hardcoded around Pulse Tap. Tickets/rounds stay server-authoritative; the
 * local mini-games send NO economy messages — leaving a cabinet routes through
 * the existing occupy/release path.
 *
 * Validation identities: open with ?id=alpha / ?id=bravo (maps to test-alpha /
 * test-bravo), and ?ws=ws://localhost:8787/arcade/ws for local authority.
 */
import { NeonCircuitRoomClient } from './neon-circuit-room-client.js';
import { createPulseTapGame } from './pulse-tap-game.js';
import { createSignalSprintGame } from './signal-sprint-game.js';
import { createPrizeCounter } from './prize-counter.js';

// Powered (playable) cabinets, keyed by their occupancy machine id. The room
// authority drives free/yours/in-use; the catalog confirms they are live.
const POWERED = [
  { id: 'pulse',  name: 'PULSE TAP',     ico: '⚡',  color: '#ff2d95' },
  { id: 'signal', name: 'SIGNAL SPRINT', ico: '📡', color: '#19e3ff' },
];
// Flavour-only "coming soon" cabinets (no authority, cannot be occupied).
const COMING_SOON = [
  { id: 'claw',  name: 'CLAW DROP',   ico: '🪝', color: '#b14aff' },
  { id: 'hoops', name: 'HYPER HOOPS', ico: '🏀', color: '#ffd23f' },
];

const params = new URLSearchParams(location.search);
const wsParam = params.get('ws');
const idParam = params.get('id'); // alpha / bravo -> test-alpha / test-bravo (validation only)

const el = (id) => document.getElementById(id);
const interactKey = el('interactKey');
const interactKbd = el('interactKbd');
const interactLabel = el('interactLabel');
const interactTarget = el('interactTarget');
const interactBtn = el('interactBtn');
const actIco = el('actIco');
const chipName = el('chipName');
const chipSub = el('chipSub');
const chipAv = el('chipAv');
const statusDot = el('statusDot');
const statusTxt = el('statusTxt');
const hint = el('hint');

let connected = false;
let hintTimer = 0;
let focused = 'pulse';        // which powered cabinet the interact bar / keyboard targets
let currentRoundId = null;        // server-issued Pulse Tap round id
let currentSignalRoundId = null;  // server-issued Signal Sprint round id
let myTickets = 0;            // server-authoritative ticket balance for this session
let lastReject = null;        // last round-rejection reason (test introspection)
let myLedger = [];            // private ledger entries (test introspection)
let prizeCounter = null;      // Prize Counter panel (assigned below)
let myInventory = [];         // owned cosmetics (test introspection)
let myEquips = {};            // equipped slots
let publicCosmetics = {};     // others' safe public equips
let lastPrizeReject = null;   // last prize/equip rejection reason

// Per-cabinet authoritative state mirrored from the DO. game is wired below.
const cabs = {
  pulse:  { occupiedBy: null, rev: null, el: null, occEl: null, ledEl: null, game: null },
  signal: { occupiedBy: null, rev: null, el: null, occEl: null, ledEl: null, game: null },
};

// ---- build the cabinet row once (powered first, then coming-soon) ----
el('cabinets').innerHTML = [
  ...POWERED.map((c) => `
    <div class="cab powered${c.id === focused ? ' selected' : ''}" style="--cab:${c.color}" data-id="${c.id}">
      <span class="occ" hidden></span>
      <div class="marquee">${c.name}</div>
      <div class="screen"><span class="ico">${c.ico}</span></div>
      <div class="panel"><span class="btn-dot"></span><span class="btn-dot"></span><span class="btn-dot"></span></div>
      <div class="status-led">● open</div>
    </div>`),
  ...COMING_SOON.map((c) => `
    <div class="cab coming-soon" style="--cab:${c.color}" data-id="${c.id}">
      <span class="occ" hidden></span>
      <div class="marquee">${c.name}</div>
      <div class="screen"><span class="ico">${c.ico}</span></div>
      <div class="panel"><span class="btn-dot"></span><span class="btn-dot"></span><span class="btn-dot"></span></div>
      <div class="status-led">○ coming soon</div>
    </div>`),
].join('');

for (const c of POWERED) {
  const node = document.querySelector(`.cab[data-id="${c.id}"]`);
  cabs[c.id].el = node;
  cabs[c.id].occEl = node.querySelector('.occ');
  cabs[c.id].ledEl = node.querySelector('.status-led');
}

// ---- helpers ----
const PALETTE = ['#19e3ff', '#ff2d95', '#b14aff', '#3df58b', '#ffd23f'];
function colorFor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function shorten(id) {
  return id.length > 14 ? id.slice(0, 13) + '…' : id;
}
function initials(id) {
  const seg = id.split(/[-_]/).pop() || id;
  return (seg.slice(0, 2) || '★').toUpperCase();
}
function myId() {
  return client.getPlayerId();
}
function isMine(machineId) {
  const c = cabs[machineId];
  return !!c.occupiedBy && c.occupiedBy === myId();
}
function isBusyByOther(machineId) {
  const c = cabs[machineId];
  return !!c.occupiedBy && c.occupiedBy !== myId();
}
function labelFor(machineId) {
  return (POWERED.find((c) => c.id === machineId) || {}).name || machineId.toUpperCase();
}
function toast(msg) {
  hint.textContent = msg;
  hint.classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hint.classList.remove('show'), 1800);
}

// ---- interaction: occupy / release a specific cabinet, server-authoritative ----
function activate(machineId) {
  if (!connected) {
    toast('connecting to the floor…');
    return;
  }
  const c = cabs[machineId];
  if (!c.occupiedBy) {
    client.occupy(machineId);
  } else if (isMine(machineId)) {
    client.release(machineId);
  } else {
    toast(`${labelFor(machineId)} is in use by ${shorten(c.occupiedBy)}`);
  }
}

// ---- render ----
function renderIdentity() {
  const id = myId();
  chipName.textContent = shorten(id);
  chipSub.textContent = client.isUsingPlayerIdOverride()
    ? `test identity · ${client.getPlayerIdSource()}`
    : 'instant join · no login';
  chipAv.style.setProperty('--ac', colorFor(id));
  chipAv.textContent = initials(id);
}

function renderStatus() {
  statusDot.classList.toggle('off', !connected);
  const rev = cabs[focused]?.rev;
  statusTxt.textContent = connected
    ? (rev != null ? `live · rev ${rev}` : 'live')
    : 'connecting';
}

function renderTickets() {
  const n = el('ticketCount');
  if (n) n.textContent = myTickets;
}

function renderCabinet(machineId) {
  const c = cabs[machineId];
  if (!c.el) return;
  const mine = isMine(machineId);
  const busy = isBusyByOther(machineId);
  const occupied = mine || busy;

  c.el.classList.toggle('busy', busy);
  c.el.classList.toggle('mine', mine);

  // Only the server-confirmed occupant gets the local mini-game panel.
  if (mine) c.game.open();
  else c.game.close();

  c.occEl.hidden = !occupied;
  if (occupied) c.occEl.textContent = mine ? 'YOU · playing' : `${shorten(c.occupiedBy)} · playing`;
  c.ledEl.textContent = mine ? '● you’re on' : busy ? '● in use' : '● open';
}

function renderInteract() {
  const machineId = focused;
  const mine = isMine(machineId);
  const busy = isBusyByOther(machineId);
  const name = labelFor(machineId);

  for (const c of POWERED) cabs[c.id].el?.classList.toggle('selected', c.id === focused);

  if (mine) {
    interactKbd.hidden = false;
    interactLabel.textContent = 'Tap to Leave';
    interactTarget.textContent = `${name} · YOU’RE ON`;
    actIco.textContent = '⏹';
    interactKey.disabled = false;
    interactBtn.disabled = false;
  } else if (busy) {
    interactKbd.hidden = true;
    interactLabel.textContent = `In use by ${shorten(cabs[machineId].occupiedBy)}`;
    interactTarget.textContent = `${name} · BUSY`;
    actIco.textContent = '🔒';
    interactKey.disabled = true;
    interactBtn.disabled = true;
  } else {
    interactKbd.hidden = false;
    interactLabel.textContent = 'Tap to Play';
    interactTarget.textContent = `${name} · OPEN`;
    actIco.textContent = (POWERED.find((c) => c.id === machineId) || {}).ico || '⚡';
    interactKey.disabled = false;
    interactBtn.disabled = false;
  }
}

function renderFloor() {
  for (const c of POWERED) renderCabinet(c.id);
  renderInteract();
  renderStatus();
}

// ---- room authority client (validated Phase 1b client) ----
const client = new NeonCircuitRoomClient({
  wsUrl: wsParam || undefined,
  playerIdOverride: idParam ? `test-${idParam}` : null,
  onConnected: () => {
    connected = true;
    renderIdentity();
    renderFloor();
    prizeCounter?.setSelfId(myId());
  },
  onState: (s) => {
    if (!s.machines) return;
    for (const c of POWERED) {
      const m = s.machines[c.id];
      if (m) cabs[c.id] = { ...cabs[c.id], occupiedBy: m.occupiedBy, rev: m.rev };
    }
    renderFloor();
  },
  onDenied: (msg) => toast(`${labelFor(msg.machineId) || 'Cabinet'} is busy`),
  onError: () => {
    connected = false;
    renderStatus();
  },
  // ---- Pulse Tap (Phase 1e) ----
  onRoundStarted: (msg) => { currentRoundId = msg.roundId; },
  onRoundAccepted: (msg) => { myTickets = msg.balance; cabs.pulse.game.roundAccepted(msg); renderTickets(); },
  onRoundRejected: (msg) => { lastReject = msg.reason; cabs.pulse.game.roundRejected(msg); toast(`round not counted: ${msg.reason}`); },
  // ---- Signal Sprint (Phase 1g) ----
  onSignalRoundStarted: (msg) => { currentSignalRoundId = msg.roundId; },
  onSignalRoundAccepted: (msg) => { myTickets = msg.balance; cabs.signal.game.roundAccepted(msg); renderTickets(); },
  onSignalRoundRejected: (msg) => { lastReject = msg.reason; cabs.signal.game.roundRejected(msg); toast(`round not counted: ${msg.reason}`); },
  // ---- shared ticket flow ----
  onTicketBalance: (msg) => {
    myTickets = msg.balance;
    cabs.pulse.game.setBalance(msg.balance);
    cabs.signal.game.setBalance(msg.balance);
    prizeCounter?.setBalance(msg.balance);
    renderTickets();
  },
  onTicketAwarded: (msg) => { if (msg.playerId !== myId()) toast(`${shorten(msg.playerId)} won ${msg.awarded} tickets`); },
  onTicketState: () => { /* public cabinet/last-score; occupancy already drives renderFloor */ },
  // ---- Phase 1f: arcade loop (catalog / prizes / cosmetics) ----
  onCabinetCatalog: (m) => { prizeCounter?.setZones(m.zones || []); },
  onPrizeCatalog: (m) => { prizeCounter?.setPrizes(m.prizes || []); },
  onInventoryState: (m) => { myInventory = m.items || []; myEquips = m.equips || {}; prizeCounter?.setInventory(m.items || [], m.equips || {}); },
  onTicketLedger: (m) => { myLedger = m.entries || []; prizeCounter?.setLedger(m.entries || []); },
  onPrizeRedeemed: (m) => { myTickets = m.balance; prizeCounter?.setBalance(m.balance); prizeCounter?.redeemed(m); renderTickets(); },
  onPrizeRejected: (m) => { lastPrizeReject = m.reason; prizeCounter?.redeemRejected(m); toast(`prize: ${m.reason}`); },
  onCosmeticEquipped: () => { prizeCounter?.cosmeticFeedback('Equipped ✓', 'ok'); },
  onCosmeticUnequipped: () => { prizeCounter?.cosmeticFeedback('Unequipped', ''); },
  onCosmeticState: (m) => { publicCosmetics = m.equipped || {}; prizeCounter?.setPublicCosmetics(m.equipped || {}); },
});

// ---- local mini-games (occupancy-gated; they send no economy messages) ----
cabs.pulse.game = createPulseTapGame({
  accent: '#ff2d95',
  onLeave: () => client.release('pulse'),
  onRoundStart: () => client.startPulseRound('pulse'),
  onRoundSubmit: (result) => {
    if (!currentRoundId) { cabs.pulse.game.roundRejected({ reason: 'round not registered' }); return; }
    client.submitPulseRound({ roundId: currentRoundId, machineId: 'pulse', ...result });
    currentRoundId = null; // one submit per server-registered round
  },
});

cabs.signal.game = createSignalSprintGame({
  accent: '#19e3ff',
  onLeave: () => client.release('signal'),
  onRoundStart: () => client.startSignalRound('signal'),
  onRoundSubmit: (result) => {
    if (!currentSignalRoundId) { cabs.signal.game.roundRejected({ reason: 'round not registered' }); return; }
    client.submitSignalRound({ roundId: currentSignalRoundId, machineId: 'signal', ...result });
    currentSignalRoundId = null; // one submit per server-registered round
  },
});

// Phase 1f: Prize Counter panel. It only forwards intent; the server validates,
// computes cost, and owns balances/inventory.
prizeCounter = createPrizeCounter({
  onRedeem: (prizeId) => client.redeemPrize(prizeId),
  onEquip: (prizeId) => client.equipCosmetic(prizeId),
  onUnequip: ({ slot }) => client.unequipCosmetic({ slot }),
});
const prizeBtn = el('prizeBtn');
if (prizeBtn) prizeBtn.addEventListener('click', () => (prizeCounter.isOpen() ? prizeCounter.close() : prizeCounter.open()));

// ---- bindings ----
for (const c of POWERED) {
  cabs[c.id].el.addEventListener('click', () => { focused = c.id; activate(c.id); });
}
interactKey.addEventListener('click', () => activate(focused));
interactBtn.addEventListener('click', () => activate(focused));
addEventListener('keydown', (e) => {
  if (cabs.pulse.game.isOpen() || cabs.signal.game.isOpen()) return; // while playing, keys belong to the mini-game
  if ((e.key === 'e' || e.key === 'E' || e.key === 'Enter') && !e.repeat) {
    e.preventDefault();
    activate(focused);
  }
});

// keep the status pill honest across reconnects (client owns isConnected)
setInterval(() => {
  if (connected !== client.isConnected) {
    connected = client.isConnected;
    renderStatus();
  }
}, 1500);

// ---- boot: show identity immediately (instant join), then connect ----
renderIdentity();
renderFloor();
renderTickets();
client.connect();

// Test-only hook (gated by ?test=1): lets the two-client browser validation drive
// the server-authoritative ticket path for BOTH cabinets. It only invokes existing
// client REQUEST methods — it never grants tickets or moves authority client-side.
if (params.get('test') === '1') {
  window.__neon = {
    client,
    state: () => ({
      playerId: myId(),
      roundId: currentRoundId,
      signalRoundId: currentSignalRoundId,
      tickets: myTickets,
      balance: myTickets,
      lastReject,
      ledger: myLedger,
      inventory: myInventory,
      equips: myEquips,
      publicCosmetics,
      lastPrizeReject,
    }),
  };
}
