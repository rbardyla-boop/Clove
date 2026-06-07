/**
 * Neon Circuit — City Block authority + layout (Phase 4A).
 *
 * PURE, deterministic, runtime-agnostic. Imported UNCHANGED by:
 *   - the CityRoom Durable Object         (workers/arcade/src/city-room.ts)
 *   - the local city dev shim             (workers/arcade/city-dev-shim.mjs)
 *   - the unit tests                      (tests/arcade/city-block*.test.mjs)
 *   - the browser scene + renderers       (arcade/city/city-scene.js, *-render-*.js)
 *
 * This is the city analogue of round-authority.mjs: the SERVER owns the truth.
 * Clients send INPUT INTENT only (a unit direction vector). The server resolves
 * every accepted position itself from its own last canonical position, the server
 * clock, a max-speed clamp, and deterministic AABB collision. No code path here
 * accepts a client-supplied absolute position, velocity, or collision result.
 *
 * Coordinate space: a fixed NATIVE world (units), origin top-left, y increases
 * downward (screen-like). Renderers map world units to pixels; the server never
 * deals in pixels.
 *
 * Scope + non-goals: docs/NEON_CIRCUIT_PHASE4_CITY_BLOCK.md.
 */

// ===================== world dimensions =====================

/** The fixed native world the block lives in (units). */
export const WORLD = Object.freeze({ w: 1000, h: 1000 });

/** Movement + networking limits. The SERVER enforces all of these. */
export const MOVEMENT = Object.freeze({
  MAX_SPEED: 220,            // world units / second (server-clamped displacement)
  MAX_DT_MS: 250,            // dt is clamped to this, so a paused/backgrounded tab can never teleport
  MIN_INPUT_INTERVAL_MS: 33, // server drops inputs arriving faster than this per player (~30 Hz cap)
  PLAYER_RADIUS: 12,         // collision radius (units)
});

/** Snapshot cadence hint surfaced to clients (bounded by the server input gate). */
export const SNAPSHOT_INTERVAL_MS = 50;
/** A player with no heartbeat/input for this long is evicted by the coarse alarm. */
export const PLAYER_STALE_MS = 45_000;
/** City protocol schema version — bump when the city_* wire shape changes.
 *  v1 (4B): dt + ack on inputs/snapshots. v2 (4C): additive append-only event log +
 *  in-place portal/interior messages. v3 (4D): additive Hive-Scheduler pressure events
 *  + city_scheduler_state/request. v4 (4E): additive non-cash Host Rank events +
 *  city_host_rank_state/request. v5 (4F): additive constrained Block-Stewardship events
 *  + city_stewardship_state/result + city_stewardship_request. v6 (4G): additive instanced
 *  Block-Trial events + city_block_trial_state/result + city_block_trial_request/join/leave/
 *  close messages. v7 (5A): additive multi-block district discovery + bounded routing —
 *  city_blocks (district manifest, pushed on join) + city_blocks_request + city_route_request/
 *  city_route_result. All additions are backward-compatible — no-dt inputs and the 4A–4G
 *  message set remain valid; a client that ignores district/trial state still works, and a
 *  no-id client still lands in the default block. v8 (7E): additive server-confirmed interaction
 *  receipts — city_interaction_request → city_interaction_receipt (ephemeral, public-safe; no new
 *  DO, no migration, no persisted ledger). A client that ignores the new message still works. */
export const SCHEMA_VERSION = 8;
/** Max pending client inputs before the client resyncs (bounds replay cost; Phase 4B). */
export const MAX_INPUT_BACKLOG = 120;

// ===================== static block layout =====================

/**
 * Buildings — solid AABB obstacles {id, x, y, w, h, label, kind}. The arcade
 * building (kind 'arcade') carries the portal door back into the existing arcade.
 */
const BUILDINGS = Object.freeze([
  { id: 'data-spire',   x: 80,  y: 80,  w: 320, h: 320, label: 'DATA SPIRE',           kind: 'tower' },
  { id: 'ramen',        x: 600, y: 80,  w: 320, h: 320, label: 'RAMEN 24/7',           kind: 'shop' },
  { id: 'arcade-bldg',  x: 80,  y: 600, w: 320, h: 320, label: 'NEON CIRCUIT ARCADE',  kind: 'arcade' },
  { id: 'maglev',       x: 600, y: 600, w: 320, h: 320, label: 'MAG-LEV STATION',      kind: 'tower' },
]);

/**
 * Roads — DECORATIVE strips for the renderer (collision is buildings + props +
 * world bounds; the open road/plaza is walkable by absence of an obstacle).
 */
const ROADS = Object.freeze([
  { id: 'road-v', x: 440, y: 0,   w: 120, h: 1000, orient: 'v' },
  { id: 'road-h', x: 0,   y: 440, w: 1000, h: 120, orient: 'h' },
]);

/** Sidewalk borders — DECORATIVE framing around each building. */
const SIDEWALKS = Object.freeze(
  BUILDINGS.map((b) => ({ id: `walk-${b.id}`, x: b.x - 24, y: b.y - 24, w: b.w + 48, h: b.h + 48 }))
);

/**
 * Static props — SCAFFOLD ONLY. Parked vehicles are decorative, NON-interactive
 * obstacles (you cannot drive them in Phase 4A — full vehicle physics is deferred
 * to Phase 4B). They block movement so the world reads as solid.
 */
const PROPS = Object.freeze([
  { id: 'car-n', x: 470, y: 120, w: 60, h: 96, kind: 'vehicle', label: 'parked' },
  { id: 'car-s', x: 470, y: 800, w: 60, h: 96, kind: 'vehicle', label: 'parked' },
]);

/**
 * Portals — server-validated transition zones {id, x, y, w, h, target, label}. A
 * client may only transition when its CANONICAL (server-owned) position is inside
 * the zone; the server gates it (enterPortal). The target is a same-origin path.
 */
const PORTALS = Object.freeze([
  { id: 'arcade', x: 200, y: 560, w: 80, h: 40, target: '/arcade/', label: 'ENTER ARCADE' },
]);

/** Walkable spawn points (on the open plaza/road, away from obstacles). */
export const SPAWN_POINTS = Object.freeze([
  { x: 500, y: 500 }, { x: 480, y: 520 }, { x: 520, y: 480 },
  { x: 500, y: 560 }, { x: 460, y: 500 }, { x: 540, y: 520 },
]);

/** All solid obstacles the server resolves collision against (buildings + props). */
const OBSTACLES = Object.freeze([
  ...BUILDINGS.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h })),
  ...PROPS.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h })),
]);

/**
 * The full, public-safe layout the client renderer needs. PURE data — no private
 * state, no player data. Frozen so callers cannot mutate the canonical layout.
 */
export const CITY_BLOCK = Object.freeze({
  world: WORLD,
  buildings: BUILDINGS,
  roads: ROADS,
  sidewalks: SIDEWALKS,
  props: PROPS,
  portals: PORTALS,
  spawns: SPAWN_POINTS,
});

/**
 * Phase 5B — per-block landmark LABELS (display-only). Every block shares the SAME
 * canonical geometry (so collision/spawn/portal authority is identical and unchanged);
 * only the building labels differ, giving each block its own identity. The arcade
 * building keeps its label everywhere (it is the portal home). Unknown/missing cityId →
 * downtown's built-in labels.
 */
const BLOCK_LABELS = Object.freeze({
  'harbor-02': Object.freeze({ 'data-spire': 'HARBOR CONTROL', 'ramen': 'DOCKSIDE NOODLES', 'maglev': 'FERRY TERMINAL' }),
  'skyline-03': Object.freeze({ 'data-spire': 'SKY TOWER', 'ramen': 'CLOUD CAFE', 'maglev': 'SKY-TRAM HUB' }),
  'foundry-04': Object.freeze({ 'data-spire': 'FORGE STACK', 'ramen': 'EMBER CANTEEN', 'maglev': 'FREIGHT LINE' }),
  'nexus-05': Object.freeze({ 'data-spire': 'NEXUS CORE', 'ramen': 'SYNAPSE BAR', 'maglev': 'TRANSIT NEXUS' }),
  'garden-06': Object.freeze({ 'data-spire': 'BIODOME SPIRE', 'ramen': 'GREENHOUSE GRILL', 'maglev': 'GARDEN HALT' }),
});

/**
 * Public-safe layout payload for the client (deep-cloned so the wire copy is plain).
 * Phase 5B: `cityId` overlays that block's landmark labels onto the shared geometry; no
 * cityId → the default (downtown) labels. Geometry is byte-identical across blocks.
 */
export function publicLayout(cityId) {
  const layout = JSON.parse(JSON.stringify(CITY_BLOCK));
  const labels = (typeof cityId === 'string' && BLOCK_LABELS[cityId]) || null;
  if (labels) for (const b of layout.buildings) if (labels[b.id]) b.label = labels[b.id];
  return layout;
}

// ===================== city room catalog =====================

/** The default city block a no-id client lands in. */
export const DEFAULT_CITY_ID = 'downtown-01';

/**
 * Static, configured city block set. Phase 4A shipped exactly one; Phase 5A expanded to a
 * small district of three; Phase 6D added a fourth (Foundry) and a non-linear topology;
 * Phase 8A grows the SINGLE district to six (Nexus + Garden) — still STATIC CONFIG, still one
 * district, geometry byte-identical (only display_name/theme/labels differ). Each block is its
 * OWN CityRoom DO (idFromName(city_id)), so adding blocks adds no DO class and needs no
 * migration. The district topology (adjacency/routing) lives in the pure city-district.mjs
 * layer on top of this catalog.
 */
export const CITY_ROOMS = Object.freeze([
  { city_id: 'downtown-01', display_name: 'Downtown Block', capacity: 24, theme: 'neon-noir' },
  { city_id: 'harbor-02',   display_name: 'Harbor Block',   capacity: 24, theme: 'tidal-cyan' },
  { city_id: 'skyline-03',  display_name: 'Skyline Block',  capacity: 24, theme: 'sunset-violet' },
  { city_id: 'foundry-04',  display_name: 'Foundry Block',  capacity: 24, theme: 'forge-ember' },
  { city_id: 'nexus-05',    display_name: 'Nexus Block',    capacity: 24, theme: 'pulse-magenta' },
  { city_id: 'garden-06',   display_name: 'Garden Block',   capacity: 24, theme: 'bloom-cyan' },
]);
export const CITY_IDS = Object.freeze(CITY_ROOMS.map((c) => c.city_id));

export function getCity(cityId) {
  return CITY_ROOMS.find((c) => c.city_id === cityId) || null;
}

/**
 * Validate an untrusted player id. Bounded length + a conservative charset (the
 * arcade uses ids like "player:a"), so a giant or control-character id can never
 * become a Record key, a storage write, or a broadcast field. Reject — never
 * silently rewrite — an identity.
 */
export function isValidPlayerId(id) {
  return typeof id === 'string' && id.length >= 1 && id.length <= 64 && /^[A-Za-z0-9:_-]+$/.test(id);
}

/** Sanitize an untrusted city id: lowercase, [a-z0-9-] only, bounded, no traversal. */
export function sanitizeCityId(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > 48) return '';
  if (!/^[a-z0-9-]+$/.test(trimmed)) return '';
  return trimmed;
}

/**
 * Resolve an untrusted city id to a VALID one. Returns { cityId, ok, fallback };
 * `ok` is false when the input was missing/invalid and we fell back to the default.
 */
export function resolveCityRoomId(raw) {
  if (raw == null || raw === '') return { cityId: DEFAULT_CITY_ID, ok: true, fallback: false };
  const sane = sanitizeCityId(raw);
  if (CITY_IDS.includes(sane)) return { cityId: sane, ok: true, fallback: false };
  return { cityId: DEFAULT_CITY_ID, ok: false, fallback: true };
}

// ===================== geometry helpers (pure) =====================

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const round1 = (v) => Math.round(v * 10) / 10;
const round3 = (v) => Math.round(v * 1000) / 1000;

/** A circle (center x,y radius r) overlaps an AABB inflated by the radius. */
function circleHitsRect(x, y, r, rect) {
  return x > rect.x - r && x < rect.x + rect.w + r && y > rect.y - r && y < rect.y + rect.h + r;
}

/** True if a player-sized circle at (x,y) overlaps ANY solid obstacle. */
function hitsObstacle(x, y, r = MOVEMENT.PLAYER_RADIUS) {
  for (const rect of OBSTACLES) if (circleHitsRect(x, y, r, rect)) return true;
  return false;
}

/** True if a player-sized circle at (x,y) is a legal (walkable) position. */
export function isWalkable(x, y, r = MOVEMENT.PLAYER_RADIUS) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x < r || y < r || x > WORLD.w - r || y > WORLD.h - r) return false;
  return !hitsObstacle(x, y, r);
}

/** Clamp a point to the in-bounds region (inset by the player radius). */
function clampToBounds(x, y, r = MOVEMENT.PLAYER_RADIUS) {
  return { x: clamp(x, r, WORLD.w - r), y: clamp(y, r, WORLD.h - r) };
}

/**
 * PURE: deterministic AABB collision with wall-sliding (axis-separated). Moves from
 * `from` toward `to`, accepting each axis only if it keeps the player circle clear.
 * This is the minimal collision layer; Rapier is deferred to Phase 4B.
 */
export function resolveCollision(from, to, r = MOVEMENT.PLAYER_RADIUS) {
  const target = clampToBounds(to.x, to.y, r);
  let nx = from.x;
  let ny = from.y;
  // Try X first, then Y from the resolved X — yields natural wall sliding.
  if (!hitsObstacle(target.x, ny, r)) nx = target.x;
  if (!hitsObstacle(nx, target.y, r)) ny = target.y;
  return { x: nx, y: ny };
}

// ===================== input + movement (pure) =====================

/**
 * PURE: normalize an UNTRUSTED client input message into a safe intent. Reads ONLY
 * the direction (dx, dy), an optional sequence number, and an optional client
 * timestamp. Any `x`/`y`/position/velocity fields are IGNORED — the client can
 * never assert a position. NaN/Infinity are rejected (zero vector). The magnitude
 * is clamped to the unit circle so diagonal input is not faster than straight.
 */
export function normalizeInput(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  let dx = Number(r.dx);
  let dy = Number(r.dy);
  if (!Number.isFinite(dx)) dx = 0;
  if (!Number.isFinite(dy)) dy = 0;
  const mag = Math.hypot(dx, dy);
  if (mag > 1) { dx /= mag; dy /= mag; }
  let seq = Number(r.seq);
  seq = Number.isFinite(seq) && seq >= 0 ? Math.floor(seq) : 0;
  let ts = Number(r.ts);
  ts = Number.isFinite(ts) ? ts : 0;
  return { dx, dy, seq, ts };
}

/**
 * PURE: the proposed (pre-collision) position from a position + unit intent over a
 * dt. dt is clamped to MAX_DT_MS and displacement to MAX_SPEED * dt, so no input —
 * however large or however delayed — can move a player faster than the cap.
 */
export function clampMovement(pos, intent, dtMs) {
  const dt = clamp(Number(dtMs) || 0, 0, MOVEMENT.MAX_DT_MS) / 1000;
  const step = MOVEMENT.MAX_SPEED * dt;
  return { x: pos.x + intent.dx * step, y: pos.y + intent.dy * step };
}

/**
 * PURE: advance one position by one untrusted input over dtMs — normalize intent,
 * clamp displacement, resolve collision, derive facing. This is the SINGLE step
 * function shared by the server (applyInput) and the client's prediction + replay
 * (city-reconcile.mjs), so a client replay reproduces the server's math exactly.
 * `pos` may carry a `facing` that is preserved when the intent is zero.
 */
export function predictStep(pos, rawInput, dtMs) {
  const intent = normalizeInput(rawInput);
  const proposed = clampMovement({ x: pos.x, y: pos.y }, intent, dtMs);
  const resolved = resolveCollision({ x: pos.x, y: pos.y }, proposed);
  const moving = intent.dx !== 0 || intent.dy !== 0;
  return {
    x: resolved.x,
    y: resolved.y,
    facing: moving ? Math.atan2(intent.dy, intent.dx) : (Number.isFinite(pos.facing) ? pos.facing : 0),
  };
}

// ===================== player + world state (pure reducers) =====================

/** A fresh, empty city world. */
export function createCityState() {
  return { players: {}, generation: 0 };
}

/** Pick a spawn point (deterministic by player count so two joiners don't stack). */
export function pickSpawn(seed = 0) {
  const i = ((Number(seed) || 0) % SPAWN_POINTS.length + SPAWN_POINTS.length) % SPAWN_POINTS.length;
  return SPAWN_POINTS[i];
}

/** Build a canonical player object seeded at a spawn. */
export function seedPlayer(playerId, spawn, now) {
  return { id: playerId, x: spawn.x, y: spawn.y, facing: 0, lastSeq: 0, lastInputAt: now, lastSeen: now };
}

/**
 * Reducer: add a player at a spawn. Idempotent — re-adding an existing player
 * returns the player unchanged (a reconnect keeps its canonical position, and is
 * allowed even at capacity). Rejects invalid identities and full blocks. `capacity`
 * (optional) caps distinct players; omit it for an unbounded test world.
 */
export function addPlayer(state, playerId, { now, capacity } = {}) {
  if (!isValidPlayerId(playerId)) return { state, player: null, ok: false, reason: 'no_identity' };
  if (state.players[playerId]) {
    return { state, player: state.players[playerId], ok: true, reason: null };
  }
  if (Number.isFinite(capacity) && Object.keys(state.players).length >= capacity) {
    return { state, player: null, ok: false, reason: 'city_full' };
  }
  const spawn = pickSpawn(Object.keys(state.players).length);
  const player = seedPlayer(playerId, spawn, now);
  return { state: { ...state, players: { ...state.players, [playerId]: player } }, player, ok: true, reason: null };
}

/** Reducer: remove a player (leave / disconnect / stale eviction). */
export function removePlayer(state, playerId) {
  if (!state.players[playerId]) return state;
  const players = { ...state.players };
  delete players[playerId];
  return { ...state, players };
}

/**
 * Reducer: apply an UNTRUSTED input for a joined player. The server computes the
 * accepted position from the player's OWN last canonical position + the server
 * clock dt + the speed clamp + collision. Returns the new state and the resolved
 * player. Inputs faster than MIN_INPUT_INTERVAL_MS per player are dropped.
 */
export function applyInput(state, playerId, rawInput, now) {
  const prev = state.players[playerId];
  if (!prev) return { state, player: null, accepted: false, reason: 'not_joined' };

  if (now - prev.lastInputAt < MOVEMENT.MIN_INPUT_INTERVAL_MS) {
    // Rate-limited: do not move, but STILL acknowledge the seq (advance lastSeq) so
    // the client drops this input from its replay buffer instead of re-applying it
    // and over-predicting — the server "consumed" it, it just produced no movement.
    const seq = normalizeInput(rawInput).seq;
    const player = { ...prev, lastSeq: Math.max(prev.lastSeq, seq), lastSeen: now };
    return { state: { ...state, players: { ...state.players, [playerId]: player } }, player, accepted: false, reason: 'rate_limited' };
  }

  // dt source (Phase 4B): honor the client-supplied per-input dt so the client's
  // replay reproduces the server step — but NEVER exceed real elapsed server time,
  // so a forged large dt cannot speed-hack. No dt (4A clients/tests) → server clock.
  const serverElapsed = now - prev.lastInputAt;
  const clientDt = Number(rawInput && rawInput.dt);
  const dtMs = (Number.isFinite(clientDt) && clientDt >= 0) ? Math.min(clientDt, serverElapsed) : serverElapsed;

  const intent = normalizeInput(rawInput);
  const stepped = predictStep({ x: prev.x, y: prev.y, facing: prev.facing }, rawInput, dtMs);

  const player = {
    ...prev,
    x: stepped.x,
    y: stepped.y,
    facing: stepped.facing,
    lastSeq: Math.max(prev.lastSeq, intent.seq),
    lastInputAt: now,
    lastSeen: now,
  };
  return { state: { ...state, players: { ...state.players, [playerId]: player } }, player, accepted: true, reason: null };
}

/** Reducer-ish: refresh a player's liveness (heartbeat). */
export function touchPlayer(state, playerId, now) {
  const prev = state.players[playerId];
  if (!prev) return state;
  return { ...state, players: { ...state.players, [playerId]: { ...prev, lastSeen: now } } };
}

/** PURE: ids of players with no input/heartbeat since `now - PLAYER_STALE_MS`. */
export function stalePlayerIds(state, now) {
  const out = [];
  for (const p of Object.values(state.players)) {
    if (now - p.lastSeen > PLAYER_STALE_MS) out.push(p.id);
  }
  return out;
}

/**
 * PURE: server-validated portal entry. Allowed ONLY when the player's CANONICAL
 * position is inside the portal zone. Returns { ok, target, reason }.
 */
export function enterPortal(state, playerId, portalId) {
  const p = state.players[playerId];
  if (!p) return { ok: false, target: null, reason: 'not_joined' };
  if (typeof portalId !== 'string') return { ok: false, target: null, reason: 'unknown_portal' };
  const portal = PORTALS.find((z) => z.id === portalId);
  if (!portal) return { ok: false, target: null, reason: 'unknown_portal' };
  const inside = p.x >= portal.x && p.x <= portal.x + portal.w && p.y >= portal.y && p.y <= portal.y + portal.h;
  if (!inside) return { ok: false, target: null, reason: 'not_in_zone' };
  return { ok: true, target: portal.target, reason: null };
}

// ===================== public-safe wire payloads =====================

/** One public-safe player entry (id + rounded position + facing + last seq). */
function publicPlayer(p) {
  return { id: p.id, x: round1(p.x), y: round1(p.y), facing: round3(p.facing), seq: p.lastSeq };
}

/**
 * PURE: public-safe snapshot of every player. NEVER includes lastInputAt/lastSeen
 * or any private field — only id, rounded position, facing, and the last accepted
 * sequence number (so a client can reconcile its prediction).
 */
export function citySnapshot(state, serverTime = Date.now()) {
  return { schema_version: SCHEMA_VERSION, serverTime, players: Object.values(state.players).map(publicPlayer) };
}

/** PURE: the welcome payload sent to a newly joined player. */
export function welcomePayload(state, playerId, cityId, serverTime = Date.now()) {
  const you = state.players[playerId] || null;
  return {
    schema_version: SCHEMA_VERSION,
    cityId,
    self_player_id: playerId,
    you: you ? publicPlayer(you) : null,
    players: citySnapshot(state, serverTime).players,
    layout: publicLayout(cityId), // Phase 5B: per-block landmark labels (same geometry)
    tick: { snapshotIntervalMs: SNAPSHOT_INTERVAL_MS, maxSpeed: MOVEMENT.MAX_SPEED },
  };
}
