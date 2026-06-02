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
import { createPrizeCounter } from './prize-counter.js';
import { createChallengeBoard } from './challenge-board.js';
// Phase 1j: games enter through adapters (which reference the Phase 1i frame
// contract); the runtime imports the game factories, so the floor does not.
// Phase 1l: Neon Grid enters through the dynamic adapter/import path, gated by
// the server catalog (loadAndActivateImportedCabinet) — not hand-wired here.
import { mountAdapter, loadAndMountImported, loadAndActivateImportedCabinet } from './cabinet-adapter-runtime.js';
import { cabinetRenderState, getAdapter } from './cabinet-adapter-sdk.mjs';

// Powered (playable) cabinets, keyed by their occupancy machine id. The room
// authority drives free/yours/in-use; the catalog confirms they are live.
const POWERED = [
  { id: 'pulse',  name: 'PULSE TAP',     ico: '⚡',  color: '#ff2d95' },
  { id: 'signal', name: 'SIGNAL SPRINT', ico: '📡', color: '#19e3ff' },
  { id: 'grid',   name: 'NEON GRID',     ico: '▦',  color: '#3df58b' }, // Phase 1l: adapter-loaded
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
let currentGridRoundId = null;    // server-issued Neon Grid round id (Phase 1l)
let gridActivationStarted = false; // Neon Grid is activated once, from the server catalog
let myTickets = 0;            // server-authoritative ticket balance for this session
let lastReject = null;        // last round-rejection reason (test introspection)
let myLedger = [];            // private ledger entries (test introspection)
let prizeCounter = null;      // Prize Counter panel (assigned below)
let myInventory = [];         // owned cosmetics (test introspection)
let myEquips = {};            // equipped slots
let publicCosmetics = {};     // others' safe public equips
let lastPrizeReject = null;   // last prize/equip rejection reason
let challengeBoard = null;    // Phase 1h Challenge Board panel (assigned below)
let myChallenges = [];        // Phase 1h: my challenge progress (test introspection)
let myAchievements = [];      // Phase 1h: my unlocked achievements
let myFeed = [];              // Phase 1h: public arcade event feed
let lastChallengeReject = null;   // Phase 1h: last challenge claim rejection reason
let lastChallengeReward = null;   // Phase 1h: last challenge reward result

// Per-cabinet authoritative state mirrored from the DO. game is wired below.
// Neon Grid starts 'unavailable' until the server catalog activates its imported
// adapter (Phase 1l) — adapter presence alone never makes it playable.
const cabs = {
  pulse:  { occupiedBy: null, rev: null, el: null, occEl: null, ledEl: null, game: null },
  signal: { occupiedBy: null, rev: null, el: null, occEl: null, ledEl: null, game: null },
  grid:   { occupiedBy: null, rev: null, el: null, occEl: null, ledEl: null, game: null, adapterState: 'unavailable', controller: null },
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
  if (!c.game || c.adapterState !== 'playable') {
    toast(`${labelFor(machineId)} is unavailable`);
    return;
  }
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

  // Phase 1j: a cabinet with no valid adapter renders "Unavailable" and cannot
  // be occupied/played (fail safe — the server may list a cabinet this client
  // has no adapter for).
  if (!c.game || c.adapterState !== 'playable') {
    c.el.classList.add('unavailable');
    c.el.classList.remove('busy', 'mine');
    c.occEl.hidden = true;
    c.ledEl.textContent = '● unavailable';
    return;
  }
  c.el.classList.remove('unavailable');

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
    challengeBoard?.setSelfId(myId());
    // Phase 1h: pull challenge catalog/progress, achievements and the public feed.
    client.requestChallengeCatalog();
    client.requestChallengeProgress();
    client.requestAchievementState();
    client.requestEventFeed();
  },
  onState: (s) => {
    if (!s.machines) return;
    for (const c of POWERED) {
      const m = s.machines[c.id];
      if (!m) continue;
      cabs[c.id] = { ...cabs[c.id], occupiedBy: m.occupiedBy, rev: m.rev };
      // Phase 1k: route PUBLIC cabinet state to the adapter's onServerState lifecycle hook.
      cabs[c.id].controller?.fireServerState?.({ machineId: c.id, occupiedBy: m.occupiedBy, rev: m.rev, mine: m.occupiedBy === myId() });
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
  // ---- Neon Grid (Phase 1l, adapter-loaded cabinet) ----
  onNeonGridRoundStarted: (msg) => { currentGridRoundId = msg.roundId; },
  onNeonGridRoundAccepted: (msg) => { myTickets = msg.balance; cabs.grid.game?.roundAccepted(msg); renderTickets(); },
  onNeonGridRoundRejected: (msg) => { lastReject = msg.reason; cabs.grid.game?.roundRejected(msg); toast(`round not counted: ${msg.reason}`); },
  // ---- shared ticket flow ----
  onTicketBalance: (msg) => {
    myTickets = msg.balance;
    cabs.pulse.game.setBalance(msg.balance);
    cabs.signal.game.setBalance(msg.balance);
    cabs.grid.game?.setBalance(msg.balance);
    prizeCounter?.setBalance(msg.balance);
    renderTickets();
  },
  onTicketAwarded: (msg) => { if (msg.playerId !== myId()) toast(`${shorten(msg.playerId)} won ${msg.awarded} tickets`); },
  onTicketState: () => { /* public cabinet/last-score; occupancy already drives renderFloor */ },
  // ---- Phase 1f: arcade loop (catalog / prizes / cosmetics) ----
  // Phase 1l: the server catalog is the authority that activates Neon Grid — the
  // imported adapter is only enabled + mounted once the catalog lists it active.
  onCabinetCatalog: (m) => { prizeCounter?.setZones(m.zones || []); activateNeonGrid(m.cabinets || []); },
  onPrizeCatalog: (m) => { prizeCounter?.setPrizes(m.prizes || []); },
  onInventoryState: (m) => {
    myInventory = m.items || []; myEquips = m.equips || {};
    prizeCounter?.setInventory(m.items || [], m.equips || {});
    challengeBoard?.setInventory(m.items || [], m.equips || {});
  },
  onTicketLedger: (m) => { myLedger = m.entries || []; prizeCounter?.setLedger(m.entries || []); },
  onPrizeRedeemed: (m) => { myTickets = m.balance; prizeCounter?.setBalance(m.balance); prizeCounter?.redeemed(m); renderTickets(); },
  onPrizeRejected: (m) => { lastPrizeReject = m.reason; prizeCounter?.redeemRejected(m); toast(`prize: ${m.reason}`); },
  onCosmeticEquipped: () => { prizeCounter?.cosmeticFeedback('Equipped ✓', 'ok'); },
  onCosmeticUnequipped: () => { prizeCounter?.cosmeticFeedback('Unequipped', ''); },
  onCosmeticState: (m) => { publicCosmetics = m.equipped || {}; prizeCounter?.setPublicCosmetics(m.equipped || {}); },
  // ---- Phase 1h: challenge board / achievements / event feed ----
  onChallengeCatalog: (m) => { challengeBoard?.setChallenges(m.challenges || []); },
  onChallengeProgress: (m) => { myChallenges = m.challenges || []; challengeBoard?.setProgress(m.challenges || []); },
  onChallengeCompleted: (m) => { toast(`Challenge complete: ${m.display_name}`); },
  onChallengeRewarded: (m) => { lastChallengeReward = m; if (typeof m.balance === 'number') { myTickets = m.balance; renderTickets(); } challengeBoard?.challengeRewarded(m); },
  onChallengeRejected: (m) => { lastChallengeReject = m.reason; challengeBoard?.challengeRejected(m); toast(`challenge: ${m.reason}`); },
  onAchievementState: (m) => { myAchievements = m.achievements || []; },
  onAchievementUnlocked: (m) => { toast(`Badge unlocked!`); },
  onArcadeEventFeed: (m) => { myFeed = m.events || []; challengeBoard?.setFeed(m.events || []); },
  onArcadeEvent: (m) => { if (m.event) { myFeed = [...myFeed, m.event].slice(-50); challengeBoard?.addEvent(m.event); } },
});

// ---- local mini-games, mounted through the Cabinet Adapter SDK (Phase 1j) ----
// The adapter runtime validates each adapter against its frame contract and
// fails closed (game = null) if the adapter is invalid/unsupported.
const pulseMount = mountAdapter('pulse_tap', {
  accent: '#ff2d95',
  onLeave: () => client.release('pulse'),
  onRoundStart: () => client.startPulseRound('pulse'),
  onRoundSubmit: (result) => {
    if (!currentRoundId) { cabs.pulse.game?.roundRejected({ reason: 'round not registered' }); return; }
    client.submitPulseRound({ roundId: currentRoundId, machineId: 'pulse', ...result });
    currentRoundId = null; // one submit per server-registered round
  },
});
cabs.pulse.game = pulseMount.game;
cabs.pulse.adapterState = pulseMount.state;
cabs.pulse.controller = pulseMount;

const signalMount = mountAdapter('signal_sprint', {
  accent: '#19e3ff',
  onLeave: () => client.release('signal'),
  onRoundStart: () => client.startSignalRound('signal'),
  onRoundSubmit: (result) => {
    if (!currentSignalRoundId) { cabs.signal.game?.roundRejected({ reason: 'round not registered' }); return; }
    client.submitSignalRound({ roundId: currentSignalRoundId, machineId: 'signal', ...result });
    currentSignalRoundId = null; // one submit per server-registered round
  },
});
cabs.signal.game = signalMount.game;
cabs.signal.adapterState = signalMount.state;
cabs.signal.controller = signalMount;

// ---- Neon Grid (Phase 1l): the FIRST cabinet activated through the dynamic ----
// adapter/import path. It is NOT hand-wired like the cabinets above: the server
// catalog activates it, the import loader validates + enables its adapter, the
// runtime resolves + mounts it inside its frame, and only then does it become
// playable. Any failure leaves the tile 'unavailable' (fail closed, no crash).
async function activateNeonGrid(catalogCabinets) {
  if (gridActivationStarted) return; // catalog can arrive on every (re)connect
  gridActivationStarted = true;
  const cabinet = (catalogCabinets || []).find((c) => c.cabinet_type === 'neon_grid') || null;
  let res;
  try {
    const mod = await import('./cabinets/neon-grid/manifest.mjs');
    res = await loadAndActivateImportedCabinet(cabinet, mod.neonGridManifest, {
      // Public server state already drives renderFloor; the lifecycle hook exists
      // so the runtime can route it (and prove lifecycle routing for an imported,
      // server-authoritative cabinet).
      lifecycle: { onServerState: () => {} },
      // The runtime forwards these game options to the imported factory so the
      // imported game can drive the server-authoritative round flow.
      gameOptions: {
        accent: '#3df58b',
        onLeave: () => client.release('grid'),
        onRoundStart: () => client.startNeonGridRound('grid'),
        onRoundSubmit: (result) => {
          if (!currentGridRoundId) { cabs.grid.game?.roundRejected({ reason: 'round not registered' }); return; }
          client.submitNeonGridRound({ roundId: currentGridRoundId, machineId: 'grid', ...result });
          currentGridRoundId = null; // one submit per server-registered round
        },
      },
    });
  } catch (e) {
    res = { ok: false, reason: 'activation_threw' };
  }
  if (res && res.ok) {
    const inner = res.mount.game; // the imported game instance (round/balance hooks)
    cabs.grid.game = {
      open: () => res.mount.open(),
      close: () => res.mount.close(),
      isOpen: () => { const f = res.mount.getFrame(); return !!(f && f.isOpen()); },
      setBalance: (n) => inner.setBalance(n),
      roundAccepted: (m) => inner.roundAccepted(m),
      roundRejected: (m) => inner.roundRejected(m),
      getFrame: () => res.mount.getFrame(),
    };
    cabs.grid.adapterState = 'playable';
    cabs.grid.controller = res.mount;
    cabs.grid.game.setBalance(myTickets);
  } else {
    cabs.grid.adapterState = 'unavailable';
    gridActivationStarted = false; // allow a retry if the catalog had not listed it active yet
  }
  if (typeof window !== 'undefined' && window.__neon) window.__neon.adapters.neon_grid = res;
  renderFloor();
}

// Phase 1f: Prize Counter panel. It only forwards intent; the server validates,
// computes cost, and owns balances/inventory.
prizeCounter = createPrizeCounter({
  onRedeem: (prizeId) => client.redeemPrize(prizeId),
  onEquip: (prizeId) => client.equipCosmetic(prizeId),
  onUnequip: ({ slot }) => client.unequipCosmetic({ slot }),
});
const prizeBtn = el('prizeBtn');
if (prizeBtn) prizeBtn.addEventListener('click', () => (prizeCounter.isOpen() ? prizeCounter.close() : prizeCounter.open()));

// Phase 1h: Challenge Board panel. Forwards intent only; the server validates
// completion, grants rewards/badges, and owns the public event feed.
challengeBoard = createChallengeBoard({
  onClaim: (challengeId) => client.claimChallengeReward(challengeId),
  onEquip: (prizeId) => client.equipCosmetic(prizeId),
});
const challengeBtn = el('challengeBtn');
if (challengeBtn) challengeBtn.addEventListener('click', () => (challengeBoard.isOpen() ? challengeBoard.close() : challengeBoard.open()));

// ---- bindings ----
for (const c of POWERED) {
  cabs[c.id].el.addEventListener('click', () => { focused = c.id; activate(c.id); });
}
interactKey.addEventListener('click', () => activate(focused));
interactBtn.addEventListener('click', () => activate(focused));
addEventListener('keydown', (e) => {
  if (cabs.pulse.game.isOpen() || cabs.signal.game.isOpen() || cabs.grid.game?.isOpen?.()) return; // while playing, keys belong to the mini-game
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
      gridRoundId: currentGridRoundId,
      tickets: myTickets,
      balance: myTickets,
      lastReject,
      ledger: myLedger,
      inventory: myInventory,
      equips: myEquips,
      publicCosmetics,
      lastPrizeReject,
      challenges: myChallenges,
      achievements: myAchievements,
      feed: myFeed,
      lastChallengeReject,
      lastChallengeReward,
    }),
    // Phase 1j/1k/1l: adapter introspection for browser validation. neon_grid is
    // filled in by activateNeonGrid() once the server catalog activates it.
    adapters: { pulse_tap: pulseMount, signal_sprint: signalMount, neon_grid: null },
    adapterState: (cabinetType) => (getAdapter(cabinetType) ? 'has_adapter' : 'no_adapter'),
    renderState: (cabinet) => cabinetRenderState(cabinet),
    fixtureLifecycle: [],
    fixtureMount: null,
  };

  // Phase 1k: dynamically load + mount the test-only sample import fixture
  // (?test=1&adapterFixture=sample-import-game). It is NEVER loaded in production.
  if (params.get('adapterFixture') === 'sample-import-game') {
    import('./cabinets/sample-import-game/manifest.mjs').then((m) => {
      const lifecycle = {};
      for (const name of ['onMount', 'onUnmount', 'onResize', 'onFocus', 'onBlur', 'onServerState']) {
        lifecycle[name] = () => window.__neon.fixtureLifecycle.push(name);
      }
      return loadAndMountImported(m.sampleImportManifest, { lifecycle }).then((res) => {
        window.__neon.fixtureMount = res;
        if (res.ok) res.mount.open(); // mount + show inside the cabinet frame
      });
    }).catch((e) => { window.__neon.fixtureMount = { ok: false, reason: 'load_threw', error: String(e && e.message || e) }; });
  }
}
