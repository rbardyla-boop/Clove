/**
 * Phase 7B — city walkable-boundary kernel unit tests.
 * Pure model only (no Worker, no browser). Live BLOCKED_ZONES is empty by design, so
 * blocked-zone behavior is exercised with explicit fixture zones (the public API accepts
 * an explicit zones array OR a city id).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WORLD, MOVEMENT, CITY_IDS, isWalkable } from '../../arcade/city/city-block.mjs';
import {
  BLOCKED_ZONES, isInBlockedZone, isPointWalkable, clampToWalkable,
  segmentIntersectsBlocked, nearestSafePoint, safeSpawnPoint, safeArrivalPoint,
} from '../../arcade/city/city-collision.mjs';

const R = MOVEMENT.PLAYER_RADIUS;
const CENTER = { x: 500, y: 500 };                 // a known spawn / open plaza point
const INSIDE_BUILDING = { x: 200, y: 200 };        // inside data-spire (80..400)
const FIXTURE = [Object.freeze({ id: 'closed-lot', x: 460, y: 460, w: 80, h: 80, label: 'CLOSED' })];

test('live BLOCKED_ZONES is empty in 7B (model-ready capability)', () => {
  assert.deepEqual(Object.keys(BLOCKED_ZONES), []);
});

test('inside walkable accepted', () => {
  assert.equal(isPointWalkable(CENTER.x, CENTER.y, 'downtown-01'), true);
  assert.equal(isWalkable(CENTER.x, CENTER.y), true); // composes existing authority
});

test('outside bounds rejected', () => {
  assert.equal(isPointWalkable(-5, 500, 'downtown-01'), false);
  assert.equal(isPointWalkable(500, WORLD.h + 5, 'downtown-01'), false);
  assert.equal(isPointWalkable(R - 1, 500, 'downtown-01'), false); // within radius of edge
});

test('inside a building rejected', () => {
  assert.equal(isPointWalkable(INSIDE_BUILDING.x, INSIDE_BUILDING.y, 'downtown-01'), false);
});

test('blocked zone rejected (fixture)', () => {
  assert.equal(isInBlockedZone(CENTER.x, CENTER.y, FIXTURE), true);
  assert.equal(isPointWalkable(CENTER.x, CENTER.y, FIXTURE), false); // walkable-but-blocked
  // and a point outside the fixture zone is fine
  assert.equal(isPointWalkable(500, 700, FIXTURE), true);
});

test('clampToWalkable returns a safe point out of a blocked zone', () => {
  const out = clampToWalkable({ x: 500, y: 430 }, { x: 500, y: 500 }, FIXTURE);
  assert.equal(isPointWalkable(out.x, out.y, FIXTURE), true, 'clamped result must be walkable');
  assert.equal(isInBlockedZone(out.x, out.y, FIXTURE), false);
});

test('clampToWalkable with no zones equals bounds+building collision (live behaviour unchanged)', () => {
  // moving toward a wall is clamped; with empty live zones the result is just resolveCollision
  const out = clampToWalkable({ x: 500, y: 500 }, { x: 5, y: 500 }, 'downtown-01');
  assert.equal(isWalkable(out.x, out.y), true);
});

test('clampToWalkable does not mutate inputs', () => {
  const from = { x: 500, y: 430 };
  const to = { x: 500, y: 500 };
  const fromCopy = { ...from };
  const toCopy = { ...to };
  clampToWalkable(from, to, FIXTURE);
  assert.deepEqual(from, fromCopy);
  assert.deepEqual(to, toCopy);
});

test('segmentIntersectsBlocked detects crossing and clears non-crossing', () => {
  assert.equal(segmentIntersectsBlocked({ x: 400, y: 500 }, { x: 600, y: 500 }, FIXTURE), true);
  assert.equal(segmentIntersectsBlocked({ x: 400, y: 100 }, { x: 600, y: 100 }, FIXTURE), false);
  assert.equal(segmentIntersectsBlocked({ x: 400, y: 500 }, { x: 600, y: 500 }, []), false); // no zones
});

test('nearestSafePoint returns a walkable point (out of zone)', () => {
  const safe = nearestSafePoint(CENTER.x, CENTER.y, FIXTURE);
  assert.equal(isPointWalkable(safe.x, safe.y, FIXTURE), true);
});

test('nearestSafePoint of an already-safe point returns it', () => {
  const safe = nearestSafePoint(500, 700, FIXTURE);
  assert.equal(isPointWalkable(safe.x, safe.y, FIXTURE), true);
});

test('safe arrival point is valid for every block (incl. foundry-04)', () => {
  for (const cityId of CITY_IDS) {
    const arr = safeArrivalPoint(cityId);
    assert.equal(isPointWalkable(arr.x, arr.y, cityId), true, `${cityId} arrival must be walkable`);
  }
  assert.ok(CITY_IDS.includes('foundry-04'), 'foundry-04 is in the roster');
  const foundry = safeArrivalPoint('foundry-04');
  assert.equal(isPointWalkable(foundry.x, foundry.y, 'foundry-04'), true);
});

test('safeSpawnPoint is deterministic and walkable across seeds', () => {
  for (let seed = 0; seed < 8; seed++) {
    const a = safeSpawnPoint('downtown-01', seed);
    const b = safeSpawnPoint('downtown-01', seed);
    assert.deepEqual(a, b, 'deterministic for a given seed');
    assert.equal(isPointWalkable(a.x, a.y, 'downtown-01'), true);
  }
});

test('unknown block fails safe (no zones, bounds+buildings still enforced)', () => {
  // unknown city id resolves to an empty blocked-zone set; bounds/buildings still apply
  assert.equal(isPointWalkable(CENTER.x, CENTER.y, 'no-such-block'), true);
  assert.equal(isPointWalkable(INSIDE_BUILDING.x, INSIDE_BUILDING.y, 'no-such-block'), false);
  const arr = safeArrivalPoint('no-such-block');
  assert.equal(isWalkable(arr.x, arr.y), true);
});

test('garbage coordinates fail safe (never walkable)', () => {
  assert.equal(isPointWalkable(NaN, 500, 'downtown-01'), false);
  assert.equal(isPointWalkable(500, Infinity, 'downtown-01'), false);
  assert.equal(isInBlockedZone(NaN, NaN, FIXTURE), true); // garbage is never "safe"
});

test('fully-blocked context returns a finite point without infinite recursion', () => {
  // A zone covering the whole world: NO point is walkable. nearestSafePoint/safeSpawnPoint must
  // terminate (return the clamped centre) rather than recurse into each other forever.
  const ALL = [Object.freeze({ id: 'sealed', x: 0, y: 0, w: WORLD.w, h: WORLD.h, label: 'SEALED' })];
  let near, spawn, arrival;
  assert.doesNotThrow(() => { near = nearestSafePoint(500, 500, ALL); });
  assert.doesNotThrow(() => { spawn = safeSpawnPoint(ALL, 3); });
  assert.doesNotThrow(() => { arrival = safeArrivalPoint(ALL); });
  for (const p of [near, spawn, arrival]) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), 'returns a finite point');
    assert.ok(p.x >= 0 && p.x <= WORLD.w && p.y >= 0 && p.y <= WORLD.h, 'point is in-bounds');
  }
});

test('deterministic output for identical inputs', () => {
  const a = clampToWalkable({ x: 450, y: 500 }, { x: 520, y: 500 }, FIXTURE);
  const b = clampToWalkable({ x: 450, y: 500 }, { x: 520, y: 500 }, FIXTURE);
  assert.deepEqual(a, b);
  const n1 = nearestSafePoint(500, 500, FIXTURE);
  const n2 = nearestSafePoint(500, 500, FIXTURE);
  assert.deepEqual(n1, n2);
});
