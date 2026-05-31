/**
 * Neon Circuit Arcade — Level 1 Main Floor (Phase 1c shell).
 *
 * Renders the arcade floor and wires the one powered cabinet (Pulse Tap) to the
 * already-validated room authority via neon-circuit-room-client.js. The cabinet's
 * free / yours / in-use state is derived ONLY from the Durable Object's
 * authoritative `room_state` (occupiedBy + rev) — never assumed locally.
 *
 * Phase 1c/1d: product floor + occupancy-gated local Pulse Tap mini-game
 * (pulse-tap-game.js). No in-game economy; occupancy stays the only server-authoritative fact.
 * Validation identities: open with ?id=alpha / ?id=bravo (maps to test-alpha / test-bravo),
 * and ?ws=ws://localhost:8787/arcade/ws for local authority.
 */
import { NeonCircuitRoomClient } from './neon-circuit-room-client.js';
import { createPulseTapGame } from './pulse-tap-game.js';

const PULSE_ID = 'pulse';
const CABINETS = [
  { id: 'pulse',  name: 'PULSE TAP',     ico: '⚡',  color: '#ff2d95', powered: true },
  { id: 'claw',   name: 'CLAW DROP',     ico: '🪝',  color: '#19e3ff', powered: false },
  { id: 'hoops',  name: 'HYPER HOOPS',   ico: '🏀',  color: '#b14aff', powered: false },
  { id: 'racer',  name: 'CIRCUIT RACER', ico: '🏎️', color: '#ffd23f', powered: false },
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

// Authoritative Pulse Tap state, mirrored from the DO.
let pulse = { occupiedBy: null, rev: null };
let connected = false;
let hintTimer = 0;

// ---- build the cabinet row once ----
el('cabinets').innerHTML = CABINETS.map((c) => `
  <div class="cab ${c.powered ? 'powered selected' : 'coming-soon'}" style="--cab:${c.color}" data-id="${c.id}">
    <span class="occ" hidden></span>
    <div class="marquee">${c.name}</div>
    <div class="screen"><span class="ico">${c.ico}</span></div>
    <div class="panel"><span class="btn-dot"></span><span class="btn-dot"></span><span class="btn-dot"></span></div>
    <div class="status-led">${c.powered ? '● open' : '○ coming soon'}</div>
  </div>`).join('');

const pulseCab = document.querySelector('.cab[data-id="pulse"]');
const pulseOcc = pulseCab.querySelector('.occ');
const pulseLed = pulseCab.querySelector('.status-led');

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
function isMine() {
  return !!pulse.occupiedBy && pulse.occupiedBy === myId();
}
function isBusyByOther() {
  return !!pulse.occupiedBy && pulse.occupiedBy !== myId();
}
function toast(msg) {
  hint.textContent = msg;
  hint.classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hint.classList.remove('show'), 1800);
}

// ---- interaction: occupy / release, server-authoritative ----
function activate() {
  if (!connected) {
    toast('connecting to the floor…');
    return;
  }
  if (!pulse.occupiedBy) {
    client.occupy(PULSE_ID);
  } else if (isMine()) {
    client.release(PULSE_ID);
  } else {
    toast(`Pulse Tap is in use by ${shorten(pulse.occupiedBy)}`);
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
  statusTxt.textContent = connected
    ? (pulse.rev != null ? `live · rev ${pulse.rev}` : 'live')
    : 'connecting';
}

function renderFloor() {
  const mine = isMine();
  const busy = isBusyByOther();
  const occupied = mine || busy;

  pulseCab.classList.toggle('busy', busy);
  pulseCab.classList.toggle('mine', mine);

  // Only the server-confirmed occupant gets the local mini-game panel.
  if (mine) game.open();
  else game.close();

  pulseOcc.hidden = !occupied;
  if (occupied) pulseOcc.textContent = mine ? 'YOU · playing' : `${shorten(pulse.occupiedBy)} · playing`;
  pulseLed.textContent = mine ? '● you’re on' : busy ? '● in use' : '● open';

  if (mine) {
    interactKbd.hidden = false;
    interactLabel.textContent = 'Tap to Leave';
    interactTarget.textContent = 'PULSE TAP · YOU’RE ON';
    actIco.textContent = '⏹';
    interactKey.disabled = false;
    interactBtn.disabled = false;
  } else if (busy) {
    interactKbd.hidden = true;
    interactLabel.textContent = `In use by ${shorten(pulse.occupiedBy)}`;
    interactTarget.textContent = 'PULSE TAP · BUSY';
    actIco.textContent = '🔒';
    interactKey.disabled = true;
    interactBtn.disabled = true;
  } else {
    interactKbd.hidden = false;
    interactLabel.textContent = 'Tap to Play';
    interactTarget.textContent = 'PULSE TAP · OPEN';
    actIco.textContent = '⚡';
    interactKey.disabled = false;
    interactBtn.disabled = false;
  }
  renderStatus();
}

// ---- room authority client (validated Phase 1b client, unchanged) ----
const client = new NeonCircuitRoomClient({
  wsUrl: wsParam || undefined,
  playerIdOverride: idParam ? `test-${idParam}` : null,
  onConnected: () => {
    connected = true;
    renderIdentity();
    renderFloor();
  },
  onState: (s) => {
    const m = s.machines && s.machines.pulse;
    if (!m) return;
    pulse = { occupiedBy: m.occupiedBy, rev: m.rev };
    renderFloor();
  },
  onDenied: () => toast('Pulse Tap is busy'),
  onError: () => {
    connected = false;
    renderStatus();
  },
});

// Local-only Pulse Tap mini-game. Leaving the cabinet routes through the existing
// occupy/release path — the game itself sends nothing to the authority.
const game = createPulseTapGame({
  accent: '#ff2d95',
  onLeave: () => client.release(PULSE_ID),
});

// ---- bindings ----
pulseCab.addEventListener('click', activate);
interactKey.addEventListener('click', activate);
interactBtn.addEventListener('click', activate);
addEventListener('keydown', (e) => {
  if (game.isOpen()) return; // while playing, E/Space belong to the mini-game
  if ((e.key === 'e' || e.key === 'E' || e.key === 'Enter') && !e.repeat) {
    e.preventDefault();
    activate();
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
client.connect();
