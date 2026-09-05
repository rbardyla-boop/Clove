/**
 * Clove Hive World — pure world rules.
 *
 * This module is deliberately runtime-agnostic. The Durable Object, the local
 * preview, replay tests, and the browser all use the same command reducer. The
 * server owns the hidden laws in production; the browser only receives the
 * public projection returned by publicSnapshot().
 */

export const HIVE_SCHEMA_VERSION = 1;

export const WORLD = Object.freeze({ w: 1800, h: 1000 });

export const MOVE = Object.freeze({
  maxSpeed: 280,
  maxDtMs: 250,
  playerRadius: 18,
});

export const MAX_REGROUPS_PER_CYCLE = 3;
export const REGROUP_FOCUS = 3;

export const FACTIONS = Object.freeze([
  Object.freeze({ id: 'surveyors', name: 'Surveyors', verb: 'map what is there', accent: '#7de7ff' }),
  Object.freeze({ id: 'keepers', name: 'Keepers', verb: 'protect what survives', accent: '#ffd27d' }),
  Object.freeze({ id: 'menders', name: 'Menders', verb: 'repair what can hold', accent: '#ff8fc9' }),
]);

export const RESPONSIBILITIES = Object.freeze([
  'Witness', 'Cartographer', 'Builder', 'Mediator', 'Archivist', 'Field Operator',
]);

// Public call signs are intentionally closed vocabulary in this first online
// slice. There is no chat or uploaded content, and an untrusted client cannot
// inject arbitrary display text into the shared world trace.
export const WITNESS_NAMES = Object.freeze([
  'Morrow', 'Iris', 'Tarn', 'Sable', 'Juniper', 'Vale', 'Kestrel', 'Rowan',
  'Aster', 'Bramble', 'Cairn', 'Dawn', 'Ember', 'Fallow', 'Hearth', 'Lumen',
  'Test Witness', 'Other Witness', 'Witness',
]);

// Named inhabitants give the frontier a human texture without introducing
// unbounded chat or client-authored shared text. Their lines and discoveries
// are deterministic, public, and replay-safe.
export const GUIDES = Object.freeze([
  Object.freeze({ id: 'morrow', name: 'Morrow', regionId: 'hive-hub', factionId: 'menders', role: 'hive tender', accent: '#ffe09a', line: 'Bring back a reading the Hive can repair around.', moment: 'The Hive bell gives one soft note: begin with what you can check.' }),
  Object.freeze({ id: 'iris', name: 'Iris', regionId: 'glass-orchard', factionId: 'surveyors', role: 'path reader', accent: '#7de7ff', line: 'The glass remembers paths. Walk the bright edge and compare what repeats.', moment: 'A crystal fruit turns toward your footsteps. The Orchard is recording your route.' }),
  Object.freeze({ id: 'tarn', name: 'Tarn', regionId: 'memory-fen', factionId: 'keepers', role: 'archive keeper', accent: '#8ff3c6', line: 'Old evidence sinks slowly. Share what can still be checked.', moment: 'Tarn lifts a sealed memory from the water; its seal is intact, but its story is not.' }),
  Object.freeze({ id: 'sable', name: 'Sable', regionId: 'hollow-relay', factionId: 'menders', role: 'relay tender', accent: '#ff75c8', line: 'Two answers occupy one wire. Only tested claims can separate them.', moment: 'The relay answers your arrival twice—amber, then silence. Someone is listening.' }),
  Object.freeze({ id: 'vale', name: 'Vale', regionId: 'signal-canopy', factionId: 'surveyors', role: 'storm listener', accent: '#b9a0ff', line: 'Distant witnesses see the same storm from different heights.', moment: 'Above the canopy, a second horizon flickers into view. The frontier is larger than this room.' }),
]);

export const BUILD_COST = 2;
export const MAX_BUILDS_PER_CYCLE = 1;

export const SIGNAL_TTL_TICKS = 8;
export const MAX_SIGNAL_USES_PER_CYCLE = 3;
export const COORDINATION_SIGNALS = Object.freeze([
  Object.freeze({ id: 'hold', label: 'Hold the line', verb: 'stay with this signal', accent: '#ff75c8' }),
  Object.freeze({ id: 'compare', label: 'Compare readings', verb: 'bring another reading', accent: '#7de7ff' }),
  Object.freeze({ id: 'repair', label: 'Ready to repair', verb: 'prepare a shared repair', accent: '#8ff3c6' }),
  Object.freeze({ id: 'question', label: 'Ask again', verb: 'keep the question open', accent: '#ffe09a' }),
  Object.freeze({ id: 'witness', label: 'I witnessed this', verb: 'mark a checked moment', accent: '#b9a0ff' }),
  Object.freeze({ id: 'follow', label: 'Follow my trace', verb: 'follow this field trace', accent: '#9fe9de' }),
]);

export const REGIONS = Object.freeze([
  Object.freeze({
    id: 'hive-hub', name: 'Clove Hive', kind: 'hub', accent: '#ffe09a',
    blurb: 'A settlement built around shared witness and repair.',
    terrain: 'settlement', center: Object.freeze({ x: 900, y: 500 }),
    bounds: Object.freeze({ x: 700, y: 300, w: 400, h: 400 }),
    spawn: Object.freeze({ x: 900, y: 500 }),
  }),
  Object.freeze({
    id: 'glass-orchard', name: 'Glass Orchard', kind: 'orchard', accent: '#7de7ff',
    blurb: 'A bright edge where phase shifts leave visible traces.',
    terrain: 'crystal grove', center: Object.freeze({ x: 330, y: 250 }),
    bounds: Object.freeze({ x: 90, y: 80, w: 480, h: 340 }),
    spawn: Object.freeze({ x: 330, y: 250 }),
  }),
  Object.freeze({
    id: 'memory-fen', name: 'Memory Fen', kind: 'fen', accent: '#8ff3c6',
    blurb: 'A wetland of old evidence, contested lineage, and patient archivists.',
    terrain: 'shallow water', center: Object.freeze({ x: 330, y: 760 }),
    bounds: Object.freeze({ x: 90, y: 580, w: 480, h: 340 }),
    spawn: Object.freeze({ x: 330, y: 760 }),
  }),
  Object.freeze({
    id: 'hollow-relay', name: 'Hollow Relay', kind: 'relay', accent: '#ff75c8',
    blurb: 'A broken signal station answering two questions at once.',
    terrain: 'signal ruins', center: Object.freeze({ x: 1470, y: 500 }),
    bounds: Object.freeze({ x: 1230, y: 300, w: 480, h: 400 }),
    spawn: Object.freeze({ x: 1470, y: 500 }),
  }),
  Object.freeze({
    id: 'signal-canopy', name: 'Signal Canopy', kind: 'canopy', accent: '#b9a0ff',
    blurb: 'A high garden where distant communities compare the shape of a storm.',
    terrain: 'wind garden', center: Object.freeze({ x: 1230, y: 820 }),
    bounds: Object.freeze({ x: 990, y: 690, w: 480, h: 260 }),
    spawn: Object.freeze({ x: 1230, y: 820 }),
  }),
]);

export const REGION_GRAPH = Object.freeze({
  'hive-hub': Object.freeze(['glass-orchard', 'memory-fen', 'hollow-relay', 'signal-canopy']),
  'glass-orchard': Object.freeze(['hive-hub', 'memory-fen']),
  'memory-fen': Object.freeze(['hive-hub', 'glass-orchard', 'signal-canopy']),
  'hollow-relay': Object.freeze(['hive-hub', 'signal-canopy']),
  'signal-canopy': Object.freeze(['hive-hub', 'memory-fen', 'hollow-relay']),
});

export const LAW_SPECS = Object.freeze([
  Object.freeze({
    id: 'phase', name: 'Path law', question: 'Which paths keep their shape?',
    options: Object.freeze(['orthogonal', 'diagonal', 'spiral']),
    hint: 'The Orchard leaves a geometry in the air. Do not call it a route until you have walked it.',
  }),
  Object.freeze({
    id: 'echo', name: 'Relay law', question: 'Which signal does the relay return?',
    options: Object.freeze(['amber', 'indigo', 'white']),
    hint: 'The Hollow Relay is answering twice. A clean repeat is still not the same as a true one.',
  }),
  Object.freeze({
    id: 'growth', name: 'Repair law', question: 'What lets a shared work hold?',
    options: Object.freeze(['witness', 'balance', 'silence']),
    hint: 'The Fen remembers who carried the weight. A repair that cannot be explained will not last.',
  }),
]);

const REGION_LAW = Object.freeze({
  'glass-orchard': 'phase',
  'memory-fen': 'growth',
  'hollow-relay': 'echo',
  'signal-canopy': 'phase',
  'hive-hub': 'growth',
});

const PUBLIC_EVENT_LIMIT = 80;
const PUBLIC_EVIDENCE_LIMIT = 48;
const PUBLIC_CLAIM_LIMIT = 36;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function stableHash(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(options, seed, cycle, salt) {
  return options[stableHash(`${seed}|${cycle}|${salt}`) % options.length];
}

function safeSeed(raw) {
  const text = typeof raw === 'string' && raw.trim() ? raw.trim() : 'frontier-remembered';
  return text.slice(0, 96).replace(/[^A-Za-z0-9:_-]/g, '-');
}

function safeId(raw, fallback = 'witness') {
  const text = typeof raw === 'string' ? raw.trim() : '';
  return /^[A-Za-z0-9:_-]{1,64}$/.test(text) ? text : fallback;
}

export function isValidHivePlayerId(raw) {
  return typeof raw === 'string' && /^[A-Za-z0-9:_-]{1,64}$/.test(raw.trim());
}

function safeText(raw, fallback, max = 42) {
  const text = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f<>]/g, '').trim() : '';
  return (text || fallback).slice(0, max);
}

function safeDisplayName(raw, playerId, fallback = '') {
  const requested = safeText(raw, '');
  if (WITNESS_NAMES.includes(requested)) return requested;
  if (WITNESS_NAMES.includes(fallback)) return fallback;
  return WITNESS_NAMES[stableHash(`${playerId}|callsign`) % WITNESS_NAMES.length];
}

function factionById(id) {
  return FACTIONS.find((f) => f.id === id) || FACTIONS[0];
}

function regionById(id) {
  return REGIONS.find((r) => r.id === id) || REGIONS[0];
}

function lawById(id) {
  return LAW_SPECS.find((law) => law.id === id) || null;
}

function optionIsValid(lawId, value) {
  const law = lawById(lawId);
  return !!law && law.options.includes(value);
}

export function deriveLaws(seed, cycle = 0) {
  return Object.freeze(Object.fromEntries(
    LAW_SPECS.map((law) => [law.id, pick(law.options, safeSeed(seed), cycle, law.id)]),
  ));
}

export function region(id) {
  return regionById(id);
}

export function isAdjacentRegion(from, to) {
  return !!REGION_GRAPH[from]?.includes(to);
}

export function createInitialWorld({ seed = 'frontier-remembered' } = {}) {
  const cleanSeed = safeSeed(seed);
  return {
    schema: HIVE_SCHEMA_VERSION,
    worldId: `clove-frontier-${stableHash(cleanSeed).toString(16)}`,
    seed: cleanSeed,
    cycle: 0,
    tick: 0,
    phase: 'open',
    laws: deriveLaws(cleanSeed, 0),
    relay: {
      status: 'open',
      authorized: {},
      repairedBy: null,
      nextQuestion: 'Which signal deserves the Hive’s next careful attention?',
    },
    expedition: {
      id: 'relay-thread',
      phase: 'open',
      resonance: 0,
      signals: [],
      receipts: [],
      outcome: null,
    },
    players: {},
    observations: [],
    hypotheses: [],
    works: [],
    events: [],
    archive: [],
    nextId: 1,
  };
}

function nextId(world, prefix) {
  const id = `${prefix}-${world.cycle}-${world.nextId}`;
  world.nextId += 1;
  return id;
}

function pushEvent(world, type, actorId, payload = {}) {
  const event = {
    id: nextId(world, 'evt'),
    seq: world.nextId,
    tick: world.tick,
    type,
    actorId: actorId || 'system',
    payload: clone(payload),
  };
  world.events.push(event);
  if (world.events.length > PUBLIC_EVENT_LIMIT) world.events.splice(0, world.events.length - PUBLIC_EVENT_LIMIT);
  return event;
}

function playerSpawn(world, actorId, regionId = 'hive-hub') {
  const r = regionById(regionId);
  const n = stableHash(`${world.worldId}|${actorId}`) % 5;
  return { x: r.spawn.x + ((n % 3) - 1) * 38, y: r.spawn.y + (Math.floor(n / 3) - 1) * 38 };
}

export function addPlayer(worldInput, { playerId, displayName, factionId, responsibility } = {}) {
  const world = clone(worldInput);
  const id = safeId(playerId, 'witness');
  const faction = factionById(factionId);
  const existing = world.players[id];
  if (existing) {
    existing.connected = true;
    existing.displayName = safeDisplayName(displayName, id, existing.displayName || 'Witness');
    existing.factionId = faction.id;
    existing.responsibility = RESPONSIBILITIES.includes(responsibility) ? responsibility : existing.responsibility;
    if (!Number.isInteger(existing.regroupCount)) existing.regroupCount = 0;
    if (!Number.isInteger(existing.buildCount)) existing.buildCount = 0;
    if (!Array.isArray(existing.visitedRegions)) existing.visitedRegions = ['hive-hub'];
    if (!Number.isInteger(existing.signalCount)) existing.signalCount = 0;
    world.players[id] = existing;
    return { world, player: clone(existing), event: null };
  }
  const spawn = playerSpawn(world, id);
  const player = {
    id,
    displayName: safeDisplayName(displayName, id),
    factionId: faction.id,
    responsibility: RESPONSIBILITIES.includes(responsibility) ? responsibility : 'Witness',
    regionId: 'hive-hub',
    x: spawn.x,
    y: spawn.y,
    focus: 6,
    regroupCount: 0,
    buildCount: 0,
    visitedRegions: ['hive-hub'],
    signalCount: 0,
    earned: 0,
    connected: true,
    lastMoveTick: 0,
  };
  world.players[id] = player;
  world.tick += 1;
  const event = pushEvent(world, 'witness_arrived', id, {
    displayName: player.displayName,
    faction: faction.name,
    regionId: player.regionId,
  });
  return { world, player: clone(player), event };
}

export function markPlayerDisconnected(worldInput, playerId) {
  const world = clone(worldInput);
  const player = world.players[playerId];
  if (player) player.connected = false;
  return world;
}

function currentPlayer(world, playerId) {
  return world.players[playerId] || null;
}

function normalizeVector(raw) {
  const dx = Number(raw?.dx) || 0;
  const dy = Number(raw?.dy) || 0;
  const magnitude = Math.hypot(dx, dy);
  if (!Number.isFinite(magnitude) || magnitude === 0) return { dx: 0, dy: 0 };
  return { dx: dx / magnitude, dy: dy / magnitude };
}

export function applyMove(worldInput, playerId, rawInput = {}, dtMs = 50) {
  const world = clone(worldInput);
  const player = currentPlayer(world, playerId);
  if (!player) return { world, ok: false, reason: 'unknown_player' };
  const { dx, dy } = normalizeVector(rawInput);
  const dt = clamp(Number(dtMs) || 0, 0, MOVE.maxDtMs);
  const bounds = regionById(player.regionId).bounds;
  player.x = clamp(player.x + dx * MOVE.maxSpeed * (dt / 1000), bounds.x + MOVE.playerRadius, bounds.x + bounds.w - MOVE.playerRadius);
  player.y = clamp(player.y + dy * MOVE.maxSpeed * (dt / 1000), bounds.y + MOVE.playerRadius, bounds.y + bounds.h - MOVE.playerRadius);
  player.lastMoveTick = world.tick;
  return { world, ok: true, reason: null, moved: dx !== 0 || dy !== 0 };
}

export function travel(worldInput, playerId, targetRegionId) {
  const world = clone(worldInput);
  const player = currentPlayer(world, playerId);
  if (!player) return { world, ok: false, reason: 'unknown_player' };
  const target = safeId(targetRegionId, '');
  if (!regionById(target) || !isAdjacentRegion(player.regionId, target)) {
    return { world, ok: false, reason: 'route_not_adjacent' };
  }
  const firstVisit = !Array.isArray(player.visitedRegions) || !player.visitedRegions.includes(target);
  if (!Array.isArray(player.visitedRegions)) player.visitedRegions = ['hive-hub'];
  if (firstVisit) player.visitedRegions.push(target);
  player.regionId = target;
  const spawn = playerSpawn(world, playerId, target);
  player.x = spawn.x;
  player.y = spawn.y;
  world.tick += 1;
  const event = pushEvent(world, 'witness_travelled', playerId, {
    regionId: target,
    regionName: regionById(target).name,
    discoveryId: firstVisit ? `${target}-arrival` : null,
    guideId: firstVisit ? (GUIDES.find((guide) => guide.regionId === target)?.id || null) : null,
    moment: firstVisit ? (GUIDES.find((guide) => guide.regionId === target)?.moment || null) : null,
  });
  return { world, ok: true, reason: null, event };
}

function readingFor(world, playerId, regionId, sequence, kind) {
  const lawId = REGION_LAW[regionId] || 'echo';
  const law = lawById(lawId);
  const truth = world.laws[lawId];
  const noise = stableHash(`${world.seed}|${world.cycle}|${playerId}|${sequence}|${kind}`) % 5 === 0;
  const index = law.options.indexOf(truth);
  const reading = noise ? law.options[(index + 1) % law.options.length] : truth;
  return { lawId, reading, confidence: noise ? 'uncertain' : 'clear', noise };
}

export function observe(worldInput, playerId) {
  const world = clone(worldInput);
  const player = currentPlayer(world, playerId);
  if (!player) return { world, ok: false, reason: 'unknown_player' };
  world.tick += 1;
  const reading = readingFor(world, playerId, player.regionId, world.nextId, 'observe');
  const id = nextId(world, 'obs');
  const r = regionById(player.regionId);
  const observation = {
    id,
    cycle: world.cycle,
    actorId: playerId,
    actorName: player.displayName,
    regionId: player.regionId,
    regionName: r.name,
    lawId: reading.lawId,
    reading: reading.reading,
    confidence: reading.confidence,
    kind: 'observation',
    shared: false,
    tick: world.tick,
    text: `${r.name} returned ${reading.reading}; the reading is ${reading.confidence}.`,
  };
  world.observations.push(observation);
  const event = pushEvent(world, 'field_observed', playerId, {
    observationId: id,
    regionId: player.regionId,
    lawId: reading.lawId,
    reading: reading.reading,
    confidence: reading.confidence,
  });
  return { world, ok: true, reason: null, observation: clone(observation), event };
}

export function hypothesize(worldInput, playerId, { lawId, guess, evidenceIds = [] } = {}) {
  const world = clone(worldInput);
  const player = currentPlayer(world, playerId);
  if (!player) return { world, ok: false, reason: 'unknown_player' };
  if (!optionIsValid(lawId, guess)) return { world, ok: false, reason: 'invalid_law_guess' };
  if (world.hypotheses.some((claim) => claim.actorId === playerId && claim.cycle === world.cycle && claim.lawId === lawId && claim.guess === guess)) {
    return { world, ok: false, reason: 'duplicate_hypothesis' };
  }
  const ownEvidence = world.observations.filter((o) => o.actorId === playerId && evidenceIds.includes(o.id));
  if (ownEvidence.some((o) => o.cycle !== world.cycle || o.lawId !== lawId)) {
    return { world, ok: false, reason: 'evidence_does_not_match_law' };
  }
  world.tick += 1;
  const id = nextId(world, 'claim');
  const claim = {
    id,
    cycle: world.cycle,
    actorId: playerId,
    actorName: player.displayName,
    lawId,
    guess,
    evidenceIds: ownEvidence.map((o) => o.id),
    status: 'untested',
    shared: false,
    tick: world.tick,
  };
  world.hypotheses.push(claim);
  const event = pushEvent(world, 'hypothesis_formed', playerId, { claimId: id, lawId, guess });
  return { world, ok: true, reason: null, hypothesis: clone(claim), event };
}

export function probe(worldInput, playerId, hypothesisId) {
  const world = clone(worldInput);
  const player = currentPlayer(world, playerId);
  if (!player) return { world, ok: false, reason: 'unknown_player' };
  const claim = world.hypotheses.find((h) => h.id === hypothesisId && h.actorId === playerId);
  if (!claim) return { world, ok: false, reason: 'unknown_hypothesis' };
  if (claim.cycle !== world.cycle) return { world, ok: false, reason: 'stale_hypothesis' };
  if (player.focus < 1) return { world, ok: false, reason: 'no_focus' };
  player.focus -= 1;
  world.tick += 1;
  const truth = world.laws[claim.lawId];
  const supported = truth === claim.guess;
  claim.status = supported ? 'supported' : 'disproved';
  const id = nextId(world, 'probe');
  const law = lawById(claim.lawId);
  const evidence = {
    id,
    cycle: world.cycle,
    actorId: playerId,
    actorName: player.displayName,
    regionId: player.regionId,
    regionName: regionById(player.regionId).name,
    lawId: claim.lawId,
    reading: claim.guess,
    confidence: 'tested',
    kind: 'probe',
    result: supported ? 'supported' : 'disproved',
    claimId: claim.id,
    shared: false,
    tick: world.tick,
    text: supported
      ? `The probe supports ${law.name.toLowerCase()}: ${claim.guess}.`
      : `The probe disproves ${law.name.toLowerCase()}: ${claim.guess}.`,
  };
  world.observations.push(evidence);
  claim.evidenceIds.push(id);
  const event = pushEvent(world, supported ? 'probe_supported' : 'probe_disproved', playerId, {
    claimId: claim.id,
    evidenceId: id,
    lawId: claim.lawId,
    result: evidence.result,
    focusAfter: player.focus,
  });
  return { world, ok: true, reason: null, evidence: clone(evidence), hypothesis: clone(claim), event };
}

export function regroup(worldInput, playerId) {
  const world = clone(worldInput);
  const player = currentPlayer(world, playerId);
  if (!player) return { world, ok: false, reason: 'unknown_player' };
  if (player.regionId !== 'hive-hub') return { world, ok: false, reason: 'regroup_at_hub' };
  const regroupCount = Number.isInteger(player.regroupCount) ? player.regroupCount : 0;
  if (regroupCount >= MAX_REGROUPS_PER_CYCLE) return { world, ok: false, reason: 'regroup_limit' };
  if (player.focus >= 6) return { world, ok: false, reason: 'regroup_not_needed' };
  player.focus = Math.min(6, player.focus + REGROUP_FOCUS);
  player.regroupCount = regroupCount + 1;
  world.tick += 1;
  const event = pushEvent(world, 'witness_regrouped', playerId, {
    regionId: player.regionId,
    focusAfter: player.focus,
    regroupCount: player.regroupCount,
  });
  return { world, ok: true, reason: null, event };
}

// A proof can become a physical promise. Building is deliberately separate
// from authority: it costs Focus and leaves a public marker, but can never
// authorize a law or bypass the relay's evidence gate.
export function build(worldInput, playerId, { kind = 'field-beacon' } = {}) {
  const world = clone(worldInput);
  const player = currentPlayer(world, playerId);
  if (!player) return { world, ok: false, reason: 'unknown_player' };
  if (world.phase === 'sealed') return { world, ok: false, reason: 'cycle_sealed' };
  const buildCount = Number.isInteger(player.buildCount) ? player.buildCount : 0;
  if (buildCount >= MAX_BUILDS_PER_CYCLE) return { world, ok: false, reason: 'build_limit' };
  if (player.focus < BUILD_COST) return { world, ok: false, reason: 'build_needs_focus' };
  const supportedClaims = world.hypotheses.filter((claim) => claim.actorId === playerId && claim.cycle === world.cycle && claim.status === 'supported' && claim.shared);
  const supportedIds = new Set(supportedClaims.map((claim) => claim.id));
  const sharedProof = world.observations.find((item) => item.actorId === playerId && item.cycle === world.cycle
    && item.kind === 'probe' && item.result === 'supported' && item.shared && supportedIds.has(item.claimId));
  if (!sharedProof) return { world, ok: false, reason: 'build_needs_shared_proof' };
  player.focus -= BUILD_COST;
  player.buildCount = buildCount + 1;
  world.tick += 1;
  const guide = GUIDES.find((entry) => entry.regionId === player.regionId);
  const work = {
    id: nextId(world, 'work'),
    cycle: world.cycle,
    actorId: playerId,
    regionId: player.regionId,
    kind: kind === 'signal-marker' ? 'signal-marker' : 'field-beacon',
    label: player.regionId === 'hollow-relay' ? 'A witness beacon steadies the relay' : `${guide?.name || 'Witness'} leaves a field beacon`,
    tick: world.tick,
  };
  world.works.push(work);
  const event = pushEvent(world, 'field_work_built', playerId, {
    workId: work.id,
    regionId: work.regionId,
    kind: work.kind,
    focusAfter: player.focus,
  });
  return { world, ok: true, reason: null, work: clone(work), event };
}

function coordinationState(world) {
  if (!world.expedition || typeof world.expedition !== 'object') {
    world.expedition = { id: 'relay-thread', phase: 'open', resonance: 0, signals: [], receipts: [], outcome: null };
  }
  if (!Array.isArray(world.expedition.signals)) world.expedition.signals = [];
  if (!Array.isArray(world.expedition.receipts)) world.expedition.receipts = [];
  return world.expedition;
}

function activeSignals(world) {
  const expedition = world.expedition;
  if (!expedition || !Array.isArray(expedition.signals)) return [];
  return expedition.signals.filter((signal) => Number(signal.expiresTick) > world.tick);
}

function coordinationSignalById(signalId) {
  return COORDINATION_SIGNALS.find((signal) => signal.id === signalId) || null;
}

export function sendSignal(worldInput, playerId, signalId) {
  const world = clone(worldInput);
  const player = currentPlayer(world, playerId);
  if (!player) return { world, ok: false, reason: 'unknown_player' };
  if (player.regionId !== 'hollow-relay') return { world, ok: false, reason: 'signal_at_relay' };
  const signal = coordinationSignalById(signalId);
  if (!signal) return { world, ok: false, reason: 'invalid_signal' };
  const expedition = coordinationState(world);
  if (expedition.phase === 'complete') return { world, ok: false, reason: 'expedition_complete' };
  const signalCount = Number.isInteger(player.signalCount) ? player.signalCount : 0;
  if (signalCount >= MAX_SIGNAL_USES_PER_CYCLE) return { world, ok: false, reason: 'signal_limit' };

  world.tick += 1;
  const activeBefore = activeSignals(world).filter((entry) => entry.actorId !== playerId);
  player.signalCount = signalCount + 1;
  const active = {
    id: nextId(world, 'signal'),
    cycle: world.cycle,
    actorId: playerId,
    actorName: player.displayName,
    signalId: signal.id,
    label: signal.label,
    regionId: player.regionId,
    tick: world.tick,
    expiresTick: world.tick + SIGNAL_TTL_TICKS,
  };
  expedition.signals.push(active);
  if (expedition.signals.length > 24) expedition.signals.splice(0, expedition.signals.length - 24);

  const partner = activeBefore[0] || null;
  const alreadyResonated = expedition.receipts.some((receipt) => receipt.cycle === world.cycle);
  let receipt = null;
  if (partner && !alreadyResonated) {
    expedition.resonance += 1;
    expedition.phase = 'resonant';
    receipt = {
      id: nextId(world, 'receipt'),
      cycle: world.cycle,
      firstWitness: partner.actorName,
      secondWitness: player.displayName,
      firstSignal: partner.label,
      secondSignal: signal.label,
      regionId: player.regionId,
      tick: world.tick,
    };
    expedition.receipts.push(receipt);
  }
  const event = pushEvent(world, receipt ? 'relay_resonated' : 'coordination_signal', playerId, {
    signalId: signal.id,
    label: signal.label,
    regionId: player.regionId,
    expiresTick: active.expiresTick,
    receiptId: receipt?.id || null,
    resonance: expedition.resonance,
  });
  return { world, ok: true, reason: null, signal: clone(active), receipt: clone(receipt), event };
}

export function share(worldInput, playerId, itemId) {
  const world = clone(worldInput);
  const observation = world.observations.find((o) => o.id === itemId && o.actorId === playerId);
  const claim = world.hypotheses.find((h) => h.id === itemId && h.actorId === playerId);
  const item = observation || claim;
  if (!item) return { world, ok: false, reason: 'unknown_evidence' };
  if (item.cycle !== world.cycle) return { world, ok: false, reason: 'stale_evidence' };
  if (item.shared) return { world, ok: true, reason: null, alreadyShared: true, item: clone(item) };
  item.shared = true;
  world.tick += 1;
  const event = pushEvent(world, 'evidence_shared', playerId, {
    itemId,
    itemType: observation ? 'observation' : 'hypothesis',
  });
  return { world, ok: true, reason: null, item: clone(item), event };
}

export function authorize(worldInput, playerId, hypothesisId) {
  const world = clone(worldInput);
  const player = currentPlayer(world, playerId);
  if (!player) return { world, ok: false, reason: 'unknown_player' };
  if (player.regionId !== 'hollow-relay') return { world, ok: false, reason: 'stand_at_hollow_relay' };
  const claim = world.hypotheses.find((h) => h.id === hypothesisId);
  if (!claim || claim.cycle !== world.cycle) return { world, ok: false, reason: 'unknown_hypothesis' };
  if (!claim.shared) return { world, ok: false, reason: 'share_claim_first' };
  if (claim.status !== 'supported') return { world, ok: false, reason: 'claim_not_supported' };
  if (world.laws[claim.lawId] !== claim.guess) return { world, ok: false, reason: 'authority_rule_rejected' };
  const sharedProof = claim.evidenceIds.some((id) => world.observations.some((o) => o.id === id && o.kind === 'probe' && o.result === 'supported' && o.shared));
  if (!sharedProof) return { world, ok: false, reason: 'share_tested_evidence_first' };
  if (world.relay.authorized[claim.lawId]) return { world, ok: true, reason: null, alreadyAuthorized: true };

  world.tick += 1;
  world.relay.authorized[claim.lawId] = {
    claimId: claim.id,
    actorId: playerId,
    tick: world.tick,
  };
  const allAuthorized = LAW_SPECS.every((law) => world.relay.authorized[law.id]);
  if (allAuthorized) {
    world.relay.status = 'legible';
    world.relay.nextQuestion = 'The signal is legible. What should the Hive repair together?';
  }
  player.earned += 1;
  const event = pushEvent(world, 'law_authorized', playerId, {
    lawId: claim.lawId,
    claimId: claim.id,
    relayStatus: world.relay.status,
  });
  return { world, ok: true, reason: null, authorized: claim.lawId, relayStatus: world.relay.status, event };
}

export function repair(worldInput, playerId) {
  const world = clone(worldInput);
  const player = currentPlayer(world, playerId);
  if (!player) return { world, ok: false, reason: 'unknown_player' };
  if (player.regionId !== 'hollow-relay') return { world, ok: false, reason: 'stand_at_hollow_relay' };
  if (world.relay.status !== 'legible') return { world, ok: false, reason: 'relay_not_legible' };
  if (world.phase === 'sealed') return { world, ok: true, reason: null, alreadyRepaired: true };
  world.tick += 1;
  world.phase = 'sealed';
  world.relay.status = 'repaired';
  world.relay.repairedBy = playerId;
  const expedition = coordinationState(world);
  const threaded = expedition.resonance > 0;
  world.works.push({
    id: nextId(world, 'work'),
    cycle: world.cycle,
    actorId: playerId,
    regionId: 'hollow-relay',
    kind: 'relay-repair',
    label: 'The relay answers once',
    tick: world.tick,
  });
  if (threaded) {
    world.works.push({
      id: nextId(world, 'work'),
      cycle: world.cycle,
      actorId: playerId,
      regionId: 'hollow-relay',
      kind: 'relay-thread',
      label: 'A relay thread carries two witnesses',
      tick: world.tick,
    });
    expedition.phase = 'complete';
    expedition.outcome = 'threaded-repair';
  } else {
    expedition.outcome = 'solo-repair';
  }
  player.earned += 2;
  world.relay.nextQuestion = threaded
    ? 'Two witnesses carried one thread. What can the next cycle hear together?'
    : 'The relay is quiet for one breath. What will the next cycle ask?';
  const event = pushEvent(world, 'relay_repaired', playerId, {
    cycle: world.cycle,
    nextQuestion: world.relay.nextQuestion,
    expeditionOutcome: expedition.outcome,
  });
  return { world, ok: true, reason: null, event };
}

export function beginNextCycle(worldInput, playerId) {
  const world = clone(worldInput);
  const player = currentPlayer(world, playerId);
  if (!player) return { world, ok: false, reason: 'unknown_player' };
  if (world.phase !== 'sealed') return { world, ok: false, reason: 'seal_current_cycle_first' };
  const archiveEntry = {
    cycle: world.cycle,
    relayStatus: world.relay.status,
    authorizedLaws: Object.keys(world.relay.authorized),
    observationCount: world.observations.length,
    hypothesisCount: world.hypotheses.length,
    works: clone(world.works),
    expedition: clone(coordinationState(world)),
    finalQuestion: world.relay.nextQuestion,
  };
  world.archive.push(archiveEntry);
  world.cycle += 1;
  world.tick += 1;
  world.phase = 'open';
  world.laws = deriveLaws(world.seed, world.cycle);
  world.relay = {
    status: 'open',
    authorized: {},
    repairedBy: null,
    nextQuestion: 'Which signal deserves the Hive’s next careful attention?',
  };
  world.expedition = {
    id: 'relay-thread',
    phase: 'open',
    resonance: 0,
    signals: [],
    receipts: [],
    outcome: null,
  };
  world.observations = [];
  world.hypotheses = [];
  world.works = [];
  for (const nextPlayer of Object.values(world.players)) {
    nextPlayer.focus = Math.min(6, nextPlayer.focus + 2);
    nextPlayer.regroupCount = 0;
    nextPlayer.buildCount = 0;
    nextPlayer.signalCount = 0;
    nextPlayer.visitedRegions = ['hive-hub'];
    nextPlayer.regionId = 'hive-hub';
    const spawn = playerSpawn(world, nextPlayer.id, 'hive-hub');
    nextPlayer.x = spawn.x;
    nextPlayer.y = spawn.y;
  }
  const event = pushEvent(world, 'cycle_begun', playerId, {
    cycle: world.cycle,
    archiveCount: world.archive.length,
  });
  return { world, ok: true, reason: null, event };
}

function publicRegion(r) {
  return {
    id: r.id, name: r.name, kind: r.kind, accent: r.accent, blurb: r.blurb,
    terrain: r.terrain, center: r.center, bounds: r.bounds,
  };
}

function publicPlayer(player) {
  const faction = factionById(player.factionId);
  return {
    id: player.id,
    displayName: player.displayName,
    faction: faction.name,
    factionId: faction.id,
    accent: faction.accent,
    responsibility: player.responsibility,
    regionId: player.regionId,
    x: Math.round(player.x * 10) / 10,
    y: Math.round(player.y * 10) / 10,
    connected: !!player.connected,
  };
}

function publicEvidence(observation) {
  return {
    id: observation.id,
    cycle: observation.cycle,
    actorName: observation.actorName,
    regionId: observation.regionId,
    regionName: observation.regionName,
    lawId: observation.lawId,
    reading: observation.reading,
    confidence: observation.confidence,
    kind: observation.kind,
    result: observation.result || null,
    claimId: observation.claimId || null,
    text: observation.text,
    tick: observation.tick,
  };
}

function publicClaim(claim) {
  return {
    id: claim.id,
    cycle: claim.cycle,
    actorName: claim.actorName,
    lawId: claim.lawId,
    guess: claim.guess,
    evidenceIds: claim.evidenceIds.slice(-8),
    status: claim.status,
    shared: !!claim.shared,
    tick: claim.tick,
  };
}

function publicExpedition(world) {
  const expedition = world.expedition || { id: 'relay-thread', phase: 'open', resonance: 0, signals: [], receipts: [], outcome: null };
  return {
    id: expedition.id,
    phase: expedition.phase,
    resonance: expedition.resonance,
    outcome: expedition.outcome,
    signals: expedition.phase === 'complete' ? [] : activeSignals(world).map((signal) => ({
      id: signal.id,
      cycle: signal.cycle,
      actorName: signal.actorName,
      signalId: signal.signalId,
      label: signal.label,
      regionId: signal.regionId,
      tick: signal.tick,
      expiresTick: signal.expiresTick,
    })),
    receipts: (expedition.receipts || []).slice(-12).map((receipt) => ({
      id: receipt.id,
      cycle: receipt.cycle,
      firstWitness: receipt.firstWitness,
      secondWitness: receipt.secondWitness,
      firstSignal: receipt.firstSignal,
      secondSignal: receipt.secondSignal,
      regionId: receipt.regionId,
      tick: receipt.tick,
    })),
  };
}

function missionFor(world, player) {
  const ownObservations = world.observations.filter((item) => item.actorId === player?.id && item.cycle === world.cycle);
  const ownClaims = world.hypotheses.filter((item) => item.actorId === player?.id && item.cycle === world.cycle);
  const supportedClaim = ownClaims.find((claim) => claim.status === 'supported' && claim.shared);
  const supportedProbe = world.observations.find((item) => item.actorId === player?.id && item.cycle === world.cycle
    && item.kind === 'probe' && item.result === 'supported' && item.shared && item.claimId === supportedClaim?.id);
  const visitedRelay = !!player?.visitedRegions?.includes('hollow-relay');
  const worked = world.works.some((work) => work.actorId === player?.id && work.cycle === world.cycle);
  const authorized = Object.keys(world.relay.authorized).length;
  const done = [visitedRelay, ownObservations.length > 0, ownClaims.length > 0, !!supportedProbe, !!supportedProbe, worked, authorized >= 3, world.phase === 'sealed'];
  const labels = ['Reach Hollow Relay', 'Observe the disturbance', 'Name a hypothesis', 'Prove one reading', 'Share the proof', 'Leave a field beacon', 'Authorize the three laws', 'Repair the relay'];
  const details = [
    'Find the place where the signal answers twice.',
    'Record a reading before you decide what it means.',
    'Turn one reading into a claim the Hive can challenge.',
    'Risk Focus and let the world answer.',
    'Make the tested claim public.',
    'Spend 2 Focus to leave something useful behind.',
    `${authorized}/3 laws currently hold authority.`,
    'Seal the cycle and carry its question forward.',
  ];
  const firstOpen = done.findIndex((value) => !value);
  return {
    id: 'relay-answers-twice',
    title: 'Make the relay legible',
    objective: 'Turn two incompatible signals into one safe repair.',
    completion: done.filter(Boolean).length / done.length,
    steps: labels.map((label, index) => ({ id: `mission-${index + 1}`, label, detail: details[index], status: done[index] ? 'complete' : index === firstOpen ? 'current' : 'locked' })),
  };
}

function nextHint(world, player) {
  if (!player) return 'Enter as a witness to begin.';
  if (world.phase === 'sealed') return 'The cycle is sealed. Read the archive, then begin the next question.';
  if (!world.observations.some((o) => o.actorId === player.id && o.cycle === world.cycle)) {
    return player.regionId === 'hive-hub'
      ? 'Your next step: travel to Hollow Relay, then observe the disturbance.'
      : 'Your next step: observe the region before you decide what it means.';
  }
  const latestClaim = [...world.hypotheses].reverse().find((claim) => claim.actorId === player.id && claim.cycle === world.cycle);
  const needsProbe = !latestClaim || latestClaim.status === 'untested' || latestClaim.status === 'disproved';
  const regroupCount = Number.isInteger(player.regroupCount) ? player.regroupCount : 0;
  if (needsProbe && player.focus < 1 && regroupCount < MAX_REGROUPS_PER_CYCLE) {
    return player.regionId === 'hive-hub'
      ? 'Your Focus is spent. Regroup at Clove Hive to recover three Focus.'
      : 'Your Focus is spent. Return to Clove Hive and regroup before risking another probe.';
  }
  if (!world.hypotheses.some((h) => h.actorId === player.id && h.cycle === world.cycle)) {
    return 'Turn one reading into a hypothesis. A claim is not authority yet.';
  }
  if (player.focus > 0 && !world.observations.some((o) => o.actorId === player.id && o.kind === 'probe' && o.cycle === world.cycle)) {
    return 'Spend one Focus on a probe. The world may disprove you, and that is useful.';
  }
  if (player.regionId !== 'hollow-relay' && Object.keys(world.relay.authorized).length < LAW_SPECS.length) {
    return 'Bring tested evidence to Hollow Relay. Authority belongs where the consequence lands.';
  }
  if (player.regionId === 'hollow-relay' && world.expedition?.resonance === 0 && world.expedition?.phase !== 'complete') {
    return 'A second witness can join the Relay Thread. Choose one of the six short signals.';
  }
  if (Object.keys(world.relay.authorized).length < LAW_SPECS.length) {
    return 'Share tested evidence, then authorize a supported law at Hollow Relay.';
  }
  return 'The relay is legible. Repair it and leave a consequence for the next cycle.';
}

export function publicSnapshot(worldInput, playerId) {
  const world = worldInput;
  const self = world.players[playerId] || null;
  const sharedEvidence = world.observations.filter((o) => o.shared && o.cycle === world.cycle).slice(-PUBLIC_EVIDENCE_LIMIT).map(publicEvidence);
  const ownEvidence = world.observations.filter((o) => o.actorId === playerId && o.cycle === world.cycle).slice(-24).map(publicEvidence);
  const sharedClaims = world.hypotheses.filter((h) => (h.shared || h.actorId === playerId) && h.cycle === world.cycle).slice(-PUBLIC_CLAIM_LIMIT).map(publicClaim);
  const authorized = Object.fromEntries(LAW_SPECS.map((law) => [law.id, !!world.relay.authorized[law.id]]));
  return {
    schema: HIVE_SCHEMA_VERSION,
    worldId: world.worldId,
    cycle: world.cycle,
    phase: world.phase,
    tick: world.tick,
    regions: REGIONS.map(publicRegion),
    graph: REGION_GRAPH,
    factions: FACTIONS,
    responsibilities: RESPONSIBILITIES,
    laws: LAW_SPECS.map((law) => ({ id: law.id, name: law.name, question: law.question, options: law.options, hint: law.hint, authorized: authorized[law.id] })),
    relay: { status: world.relay.status, authorized, nextQuestion: world.relay.nextQuestion },
    players: Object.values(world.players).map(publicPlayer),
    evidence: sharedEvidence,
    claims: sharedClaims,
    works: world.works.filter((work) => work.cycle === world.cycle).map(clone),
    expedition: publicExpedition(world),
    guides: GUIDES.map((guide) => ({ id: guide.id, name: guide.name, regionId: guide.regionId, factionId: guide.factionId, role: guide.role, accent: guide.accent, line: guide.line })),
    mission: missionFor(world, self),
    events: world.events.slice(-24).map(clone),
    archive: world.archive.map((entry) => ({ cycle: entry.cycle, relayStatus: entry.relayStatus, authorizedLaws: entry.authorizedLaws, observationCount: entry.observationCount, expeditionOutcome: entry.expedition?.outcome || null, expeditionResonance: entry.expedition?.resonance || 0, finalQuestion: entry.finalQuestion })),
    self: self ? {
      ...publicPlayer(self),
      focus: self.focus,
      regroupCount: Number.isInteger(self.regroupCount) ? self.regroupCount : 0,
      buildCount: Number.isInteger(self.buildCount) ? self.buildCount : 0,
      signalCount: Number.isInteger(self.signalCount) ? self.signalCount : 0,
      visitedRegions: Array.isArray(self.visitedRegions) ? self.visitedRegions.slice() : ['hive-hub'],
      earned: self.earned,
      evidence: ownEvidence,
      claims: world.hypotheses.filter((h) => h.actorId === playerId && h.cycle === world.cycle).slice(-16).map(publicClaim),
    } : null,
    nextHint: nextHint(world, self),
  };
}

function fail(world, reason) {
  return { world, ok: false, reason, event: null };
}

/** Apply one client intent. Mutating commands return a new serializable world. */
export function applyCommand(worldInput, playerId, command = {}) {
  const type = command?.type;
  switch (type) {
    case 'move': return applyMove(worldInput, playerId, command, command.dt);
    case 'travel': return travel(worldInput, playerId, command.regionId);
    case 'observe': return observe(worldInput, playerId);
    case 'hypothesize': return hypothesize(worldInput, playerId, command);
    case 'probe': return probe(worldInput, playerId, command.hypothesisId);
    case 'regroup': return regroup(worldInput, playerId);
    case 'build': return build(worldInput, playerId, command);
    case 'signal': return sendSignal(worldInput, playerId, command.signalId);
    case 'share': return share(worldInput, playerId, command.itemId);
    case 'authorize': return authorize(worldInput, playerId, command.hypothesisId);
    case 'repair': return repair(worldInput, playerId);
    case 'next_cycle': return beginNextCycle(worldInput, playerId);
    default: return fail(clone(worldInput), 'unknown_command');
  }
}

export function stateFingerprint(worldInput) {
  const world = clone(worldInput);
  for (const player of Object.values(world.players)) {
    delete player.connected;
    delete player.lastMoveTick;
  }
  const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  };
  const canonical = JSON.stringify(canonicalize(world));
  return stableHash(canonical).toString(16).padStart(8, '0');
}

export function replayCommands({ seed = 'frontier-remembered', playerId = 'witness', commands = [] } = {}) {
  let world = createInitialWorld({ seed });
  let joined = addPlayer(world, { playerId, displayName: 'Replay Witness' });
  world = joined.world;
  const results = [];
  for (const command of commands) {
    const result = applyCommand(world, playerId, command);
    world = result.world;
    results.push({ ok: !!result.ok, reason: result.reason || null, event: result.event || null });
  }
  return { world, results, fingerprint: stateFingerprint(world) };
}

export { clone as cloneWorld };
