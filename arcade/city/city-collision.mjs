/**
 * Neon Circuit — City walkable-boundary kernel (Phase 7B).
 *
 * PURE, deterministic, runtime-agnostic. This is the first explicit City Gameplay Kernel
 * layer (see docs/NEON_CIRCUIT_CITY_GAMEPLAY_KERNEL.md §2). It COMPOSES the existing
 * collision authority in city-block.mjs (WORLD, MOVEMENT, isWalkable, resolveCollision,
 * SPAWN_POINTS) — it does NOT reimplement collision — and adds the boundary layer the
 * kernel names:
 *
 *   - blocked zones        keep-out rectangles distinct from solid buildings
 *   - safe spawn / arrival  deterministic, guaranteed-walkable points per block
 *   - isPointWalkable       bounds + buildings (existing) AND not in a blocked zone
 *   - clampToWalkable       resolveCollision (bounds+buildings) then slide out of zones
 *   - segmentIntersectsBlocked  segment vs blocked zones (anti-tunnel test)
 *   - nearestSafePoint      push an unsafe point to the nearest walkable point
 *
 * AUTHORITY (Phase 7B): walkable BOUNDS + BUILDINGS are already server-authoritative
 * (city-block.mjs resolveCollision runs inside the server's predictStep). This module is
 * server-READY — the CityRoom DO may import it unchanged — but in 7B the new blocked-zone
 * layer is client-enforced for feel and verified by tests; the live BLOCKED_ZONES set is
 * intentionally EMPTY (the capability is proven; populating a block's set enforces it
 * consistently on server + client because both run the same shared step). The client never
 * becomes the permanent source of truth — see docs/NEON_CIRCUIT_PHASE7B_COLLISION.md.
 *
 * No combat, vehicles, pathfinding/navmesh, or physics engine — deterministic AABB only.
 */

import {
  WORLD, MOVEMENT, isWalkable, resolveCollision, SPAWN_POINTS, sanitizeCityId,
} from './city-block.mjs';

const R = MOVEMENT.PLAYER_RADIUS;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Blocked zones — keep-out rectangles {id, x, y, w, h, label} that are NOT solid
 * buildings (closed sectors, hazard areas, future event stages). Keyed by city id.
 * The LIVE set is intentionally empty in Phase 7B: the capability is implemented and
 * fixture-tested, and a block's zones can be populated later to enforce consistently on
 * server + client (both run the shared step). Frozen so callers cannot mutate it.
 */
export const BLOCKED_ZONES = Object.freeze({
  // 'downtown-01': Object.freeze([ Object.freeze({ id: 'closed-lot', x, y, w, h, label }) ]),
});

/** Resolve the blocked-zone context: an explicit zones array (tests/fixtures) or a city id. */
function zonesOf(ctx) {
  if (Array.isArray(ctx)) return ctx;
  const id = sanitizeCityId(ctx);
  return (id && BLOCKED_ZONES[id]) || [];
}

/** A circle (center x,y radius r) overlaps an AABB inflated by the radius. */
function circleHitsRect(x, y, r, rect) {
  return x > rect.x - r && x < rect.x + rect.w + r && y > rect.y - r && y < rect.y + rect.h + r;
}

/**
 * True if a player-sized circle at (x,y) is inside ANY blocked zone for `ctx`
 * (ctx = city id OR an explicit zones array).
 */
export function isInBlockedZone(x, y, ctx, r = R) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true; // garbage is never safe
  for (const z of zonesOf(ctx)) if (circleHitsRect(x, y, r, z)) return true;
  return false;
}

/**
 * True if (x,y) is a legal walkable position for the kernel: in-bounds + clear of
 * buildings (existing authority) AND clear of every blocked zone. `ctx` = city id or zones.
 */
export function isPointWalkable(x, y, ctx, r = R) {
  return isWalkable(x, y, r) && !isInBlockedZone(x, y, ctx, r);
}

/**
 * Clamp a desired move to a walkable destination. First resolves bounds + buildings via
 * the canonical resolveCollision (wall-sliding), then slides out of blocked zones
 * axis-separately. If both axes are blocked, the player does not move into the zone.
 * PURE — never mutates `from`/`to`.
 */
export function clampToWalkable(from, to, ctx, r = R) {
  const base = resolveCollision({ x: from.x, y: from.y }, { x: to.x, y: to.y }, r);
  if (!isInBlockedZone(base.x, base.y, ctx, r)) return base;
  // Blocked: axis-separated slide from the player's current position (no tunneling).
  let nx = from.x;
  let ny = from.y;
  if (!isInBlockedZone(base.x, ny, ctx, r) && isWalkable(base.x, ny, r)) nx = base.x;
  if (!isInBlockedZone(nx, base.y, ctx, r) && isWalkable(nx, base.y, r)) ny = base.y;
  return { x: nx, y: ny };
}

/** Standard segment vs axis-aligned-rect (slab) test; rect inflated by `r`. */
function segmentHitsRect(a, b, rect, r) {
  const minX = rect.x - r, minY = rect.y - r, maxX = rect.x + rect.w + r, maxY = rect.y + rect.h + r;
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - minX], [dx, maxX - a.x], [-dy, a.y - minY], [dy, maxY - a.y]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return t0 <= t1;
}

/**
 * True if the segment a→b crosses any blocked zone for `ctx` — the anti-tunnel test
 * (a fast mover should not skip through a thin zone). PURE.
 */
export function segmentIntersectsBlocked(a, b, ctx, r = R) {
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return true;
  for (const z of zonesOf(ctx)) if (segmentHitsRect(a, b, z, r)) return true;
  return false;
}

/**
 * Nearest walkable point to (x,y) for `ctx`. If already walkable, returns it (clamped to
 * bounds). Otherwise spirals outward on a fixed deterministic ring pattern and returns the
 * first walkable point; falls back to the block's safe spawn. PURE, bounded search.
 */
export function nearestSafePoint(x, y, ctx, r = R) {
  const cx = clamp(Number.isFinite(x) ? x : WORLD.w / 2, r, WORLD.w - r);
  const cy = clamp(Number.isFinite(y) ? y : WORLD.h / 2, r, WORLD.h - r);
  if (isPointWalkable(cx, cy, ctx, r)) return { x: cx, y: cy };
  const STEP = r; // probe at player-radius resolution
  for (let ring = 1; ring <= 64; ring++) {
    const d = ring * STEP;
    // 8 compass directions per ring — deterministic order (E, S, W, N, then diagonals).
    const cand = [
      [cx + d, cy], [cx, cy + d], [cx - d, cy], [cx, cy - d],
      [cx + d, cy + d], [cx - d, cy + d], [cx - d, cy - d], [cx + d, cy - d],
    ];
    for (const [px, py] of cand) {
      const qx = clamp(px, r, WORLD.w - r);
      const qy = clamp(py, r, WORLD.h - r);
      if (isPointWalkable(qx, qy, ctx, r)) return { x: qx, y: qy };
    }
  }
  return safeSpawnPoint(ctx);
}

/**
 * A guaranteed-walkable spawn point for `ctx`, chosen deterministically by `seed` (so two
 * joiners don't stack) but skipping any spawn that falls inside a blocked zone. Falls back
 * to the first walkable spawn, then to the clamped world centre.
 */
export function safeSpawnPoint(ctx, seed = 0) {
  const n = SPAWN_POINTS.length;
  const start = ((Number(seed) || 0) % n + n) % n;
  for (let i = 0; i < n; i++) {
    const s = SPAWN_POINTS[(start + i) % n];
    if (isPointWalkable(s.x, s.y, ctx)) return { x: s.x, y: s.y };
  }
  const c = { x: WORLD.w / 2, y: WORLD.h / 2 };
  return isPointWalkable(c.x, c.y, ctx) ? c : nearestSafePoint(c.x, c.y, ctx);
}

/**
 * The deterministic safe ARRIVAL point for a block — where a traveller materialises. Same
 * for every connection to a block (seed-independent), guaranteed walkable for that block.
 */
export function safeArrivalPoint(ctx) {
  return safeSpawnPoint(ctx, 0);
}
