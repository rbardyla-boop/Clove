/**
 * Phase 4A — City Block PURE helpers: layout, input normalization, speed clamp,
 * deterministic AABB collision, walkable/portal checks, snapshot shape, and the
 * city-room catalog resolver. These prove the SERVER-authoritative geometry the
 * CityRoom DO + dev shim share, with no transport involved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD, MOVEMENT, CITY_BLOCK, publicLayout, SPAWN_POINTS,
  CITY_ROOMS, CITY_IDS, DEFAULT_CITY_ID, resolveCityRoomId, sanitizeCityId, getCity, isValidPlayerId,
  normalizeInput, clampMovement, resolveCollision, isWalkable, predictStep,
  pickSpawn, seedPlayer, createCityState, citySnapshot,
} from '../../arcade/city/city-block.mjs';

const R = MOVEMENT.PLAYER_RADIUS;

// ── layout ────────────────────────────────────────────────────────────────────
test('world is a fixed native size and the layout is frozen', () => {
  assert.equal(WORLD.w, 1000);
  assert.equal(WORLD.h, 1000);
  assert.ok(Object.isFrozen(CITY_BLOCK));
  assert.throws(() => { CITY_BLOCK.world.w = 5; }, TypeError);
});

test('layout carries exactly one arcade-kind building + an arcade portal back to /arcade/', () => {
  const arcades = CITY_BLOCK.buildings.filter((b) => b.kind === 'arcade');
  assert.equal(arcades.length, 1);
  const portal = CITY_BLOCK.portals.find((p) => p.id === 'arcade');
  assert.ok(portal);
  assert.equal(portal.target, '/arcade/'); // connects to the existing arcade floor
});

test('static vehicle props are scaffold-only (present, labelled, non-driveable)', () => {
  const cars = CITY_BLOCK.props.filter((p) => p.kind === 'vehicle');
  assert.ok(cars.length >= 1);
  for (const c of cars) assert.equal(c.label, 'parked');
});

test('publicLayout is a plain deep clone (safe to send on the wire)', () => {
  const a = publicLayout();
  const b = publicLayout();
  assert.notEqual(a, b);
  assert.deepEqual(a.world, { w: 1000, h: 1000 });
  a.buildings[0].x = -999;
  assert.notEqual(publicLayout().buildings[0].x, -999); // mutating a copy never touches canonical
});

test('every spawn point is a legal walkable position', () => {
  for (const s of SPAWN_POINTS) {
    assert.ok(isWalkable(s.x, s.y), `spawn ${JSON.stringify(s)} must be walkable`);
  }
});

test('pickSpawn is deterministic and wraps by index', () => {
  assert.deepEqual(pickSpawn(0), SPAWN_POINTS[0]);
  assert.deepEqual(pickSpawn(SPAWN_POINTS.length), SPAWN_POINTS[0]);
  assert.deepEqual(pickSpawn(1), SPAWN_POINTS[1]);
});

// ── city-room catalog ───────────────────────────────────────────────────────
test('city catalog ships the Phase 8B district of nine blocks and resolves safely', () => {
  assert.equal(CITY_ROOMS.length, 9);
  assert.deepEqual(CITY_IDS, ['downtown-01', 'harbor-02', 'skyline-03', 'foundry-04', 'nexus-05', 'garden-06', 'aurora-07', 'relay-08', 'lumen-09']);
  assert.equal(DEFAULT_CITY_ID, 'downtown-01'); // a no-id client still lands downtown
  for (const id of CITY_IDS) {
    assert.equal(resolveCityRoomId(id).cityId, id);
    assert.equal(resolveCityRoomId(id).ok, true);
  }
  // every block carries its own identity; ids/themes are unique, capacity unchanged at 24
  assert.equal(new Set(CITY_ROOMS.map((c) => c.theme)).size, 9);
  for (const c of CITY_ROOMS) { assert.ok(c.display_name.length > 0); assert.equal(c.capacity, 24); }
});

test('an invalid/untrusted city id falls back to the default (never throws)', () => {
  assert.equal(resolveCityRoomId('').cityId, DEFAULT_CITY_ID);
  assert.equal(resolveCityRoomId(null).ok, true);
  const bad = resolveCityRoomId('../etc/passwd');
  assert.equal(bad.cityId, DEFAULT_CITY_ID);
  assert.equal(bad.ok, false);
  assert.equal(bad.fallback, true);
  assert.equal(sanitizeCityId('Down Town!'), '');
  assert.equal(getCity('nope'), null);
});

test('isValidPlayerId bounds length + charset (rejects giant/control-char ids)', () => {
  assert.equal(isValidPlayerId('player:a'), true);   // arcade-style colon id
  assert.equal(isValidPlayerId('city-abc_1'), true);
  assert.equal(isValidPlayerId(''), false);
  assert.equal(isValidPlayerId('a'.repeat(65)), false);
  assert.equal(isValidPlayerId('bad id!'), false);   // space + punctuation
  assert.equal(isValidPlayerId('a\u0000b'), false);
  assert.equal(isValidPlayerId(42), false);
});

// ── input normalization (no client authority over position) ───────────────────
test('normalizeInput reads ONLY direction/seq/ts and ignores any position field', () => {
  const n = normalizeInput({ dx: 1, dy: 0, seq: 4, ts: 123, x: 9999, y: 9999, tickets: 9999 });
  assert.deepEqual(Object.keys(n).sort(), ['dx', 'dy', 'seq', 'ts']);
  assert.equal(n.x, undefined);
  assert.equal(n.dx, 1);
  assert.equal(n.seq, 4);
});

test('normalizeInput clamps magnitude to the unit circle (diagonals are not faster)', () => {
  const n = normalizeInput({ dx: 1, dy: 1 });
  assert.ok(Math.abs(Math.hypot(n.dx, n.dy) - 1) < 1e-9);
  const big = normalizeInput({ dx: 50, dy: 0 });
  assert.equal(big.dx, 1); // 50 → clamped to 1
});

test('normalizeInput rejects NaN/Infinity and bad seq/ts to a safe zero/floor', () => {
  const n = normalizeInput({ dx: NaN, dy: Infinity, seq: -3, ts: 'x' });
  assert.equal(n.dx, 0);
  assert.equal(n.dy, 0);
  assert.equal(n.seq, 0);
  assert.equal(n.ts, 0);
  assert.equal(normalizeInput({ dx: 3.9, dy: 0, seq: 7.8 }).seq, 7);
  assert.deepEqual(normalizeInput(null), { dx: 0, dy: 0, seq: 0, ts: 0 });
});

// ── predictStep (shared by server applyInput + client replay) ─────────────────
test('predictStep advances by the clamped step, derives facing, and keeps facing when idle', () => {
  const moved = predictStep({ x: 500, y: 500, facing: 0 }, { dx: 1, dy: 0 }, 100);
  assert.ok(Math.abs(moved.x - (500 + MOVEMENT.MAX_SPEED * 0.1)) < 1e-9);
  assert.ok(Math.abs(moved.facing) < 1e-9); // facing east
  const idle = predictStep({ x: 500, y: 500, facing: 1.23 }, { dx: 0, dy: 0 }, 100);
  assert.equal(idle.x, 500);
  assert.equal(idle.facing, 1.23); // preserved when not moving
});

test('predictStep enforces collision (cannot replay through a building)', () => {
  // shove west into data-spire's right wall from just outside it
  const out = predictStep({ x: 430, y: 240, facing: 0 }, { dx: -1, dy: 0 }, 250);
  assert.ok(out.x > 400 + R - 1, 'replay is collision-bound, never inside the building');
});

// ── speed clamp ───────────────────────────────────────────────────────────────
test('clampMovement caps displacement at MAX_SPEED * dt', () => {
  const p = clampMovement({ x: 500, y: 500 }, { dx: 1, dy: 0 }, 100);
  assert.ok(Math.abs(p.x - (500 + MOVEMENT.MAX_SPEED * 0.1)) < 1e-9); // 522
  assert.equal(p.y, 500);
});

test('clampMovement clamps an oversized dt so a delayed input cannot teleport', () => {
  const p = clampMovement({ x: 500, y: 500 }, { dx: 1, dy: 0 }, 10_000);
  const maxStep = MOVEMENT.MAX_SPEED * (MOVEMENT.MAX_DT_MS / 1000); // 55
  assert.ok(Math.abs(p.x - (500 + maxStep)) < 1e-9);
  assert.ok(p.x < 560, 'must be clamped, not teleported across the map');
});

// ── deterministic AABB collision ───────────────────────────────────────────────
test('a player cannot move into a building (collision blocks the axis)', () => {
  // data-spire occupies x80..400,y80..400. Approach its right wall from x=430.
  const out = resolveCollision({ x: 430, y: 240 }, { x: 380, y: 240 });
  assert.ok(out.x > 400 + R - 1, 'blocked outside the building wall');
  assert.equal(out.y, 240);
});

test('movement slides along a wall (axis-separated resolution)', () => {
  // Push down-left into the spire's right wall: X blocked, Y allowed → slide down.
  const from = { x: 430, y: 240 };
  const out = resolveCollision(from, { x: 410, y: 300 });
  assert.equal(out.x, from.x, 'x blocked by the wall');
  assert.ok(out.y > from.y, 'y slides down the wall');
});

test('a player cannot leave the world bounds (inset by radius)', () => {
  const left = resolveCollision({ x: 20, y: 500 }, { x: -500, y: 500 });
  assert.equal(left.x, R);
  const corner = resolveCollision({ x: 20, y: 20 }, { x: 5000, y: 5000 });
  assert.ok(corner.x <= WORLD.w - R && corner.y <= WORLD.h - R);
});

test('isWalkable rejects positions inside buildings and out of bounds', () => {
  assert.equal(isWalkable(240, 240), false); // deep inside data-spire
  assert.equal(isWalkable(-5, 500), false);
  assert.equal(isWalkable(NaN, 500), false);
  assert.equal(isWalkable(500, 500), true);  // open plaza
});

// ── Phase 7B: collision-authority hardening (one shared geometry, no tunneling) ─
test('all nine blocks share byte-identical walkable geometry, portals, and spawns', () => {
  // Collision authority is ONE geometry for the whole district — per-block identity is
  // labels/theme only (city-identity.test covers the labels). If a future block drifts its
  // buildings/portals/spawns, collision/portal authority would silently differ per block.
  const base = publicLayout('downtown-01');
  const geom = (L) => L.buildings.map((b) => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, kind: b.kind }));
  const baseGeom = geom(base);
  for (const id of CITY_IDS) {
    const L = publicLayout(id);
    assert.deepEqual(geom(L), baseGeom, `${id} building geometry must be byte-identical to downtown`);
    assert.deepEqual(L.portals, base.portals, `${id} portals must be byte-identical`);
    assert.deepEqual(L.spawns, base.spawns, `${id} spawns must be byte-identical`);
    assert.deepEqual(L.world, base.world, `${id} world bounds must be byte-identical`);
    assert.deepEqual(L.props, base.props, `${id} collidable props must be byte-identical`);
  }
});

test('a single capped step cannot tunnel the thinnest solid obstacle (point-collision is safe)', () => {
  // resolveCollision tests the DESTINATION point (not the swept path), so it is tunnel-proof
  // ONLY while one capped step is shorter than the thinnest obstacle inflated by the player
  // radius. This guards the invariant: bumping MAX_SPEED/MAX_DT_MS past it would let a fast
  // mover skip across a thin prop in one step (then swept collision would be required).
  const maxStep = MOVEMENT.MAX_SPEED * (MOVEMENT.MAX_DT_MS / 1000);
  const collidables = [...CITY_BLOCK.buildings, ...CITY_BLOCK.props]; // server resolves vs buildings + props
  const thinnest = Math.min(...collidables.map((o) => Math.min(o.w, o.h)));
  const thinnestSpan = thinnest + 2 * MOVEMENT.PLAYER_RADIUS; // inflated blocking band
  assert.ok(maxStep < thinnestSpan,
    `one step (${maxStep}u) must stay below the thinnest obstacle span (${thinnestSpan}u) or point-collision can tunnel`);
});

// ── snapshot shape (public-safe) ────────────────────────────────────────────
test('citySnapshot exposes only id/x/y/facing/seq — no private liveness fields', () => {
  let s = createCityState();
  s = { ...s, players: { 'p:1': seedPlayer('p:1', { x: 500, y: 500 }, 1000) } };
  const snap = citySnapshot(s, 1234);
  assert.equal(snap.serverTime, 1234);
  assert.equal(snap.players.length, 1);
  assert.deepEqual(Object.keys(snap.players[0]).sort(), ['facing', 'id', 'seq', 'x', 'y']);
  const json = JSON.stringify(snap);
  assert.ok(!/lastInputAt|lastSeen/.test(json), 'snapshot must not leak private liveness fields');
});
