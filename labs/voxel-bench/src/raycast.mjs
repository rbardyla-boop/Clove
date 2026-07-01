/**
 * Voxel Lab Bench — Amanatides-Woo DDA raycast (Gate A, Slice 1).
 *
 * Re-derived (not copy-pasted) from the behavioral contract described in
 * docs/VOXEL_LAB_BENCH_PLAN.md Section 3.2/7 (Slice 1), itself design-informed by the
 * sibling repo's Stage-16 Voxel Debug Lab (`webbroswer-assest-creator`) inspected
 * read-only for prior art. This module has NO runtime or build-time dependency on that
 * repo and copies none of its source.
 *
 * Scope: raycastVoxels(grid, origin, direction, opts) only, against a Slice-0
 * VoxelGrid (bench-core.mjs). Pure function: same grid+origin+direction always
 * produces the identical result. No RNG, no Date.now().
 */

const EPS = 1e-12;

/** Miss/edge-case reason strings — always one of these on a non-hit result. */
export const RAYCAST_REASON = Object.freeze({
  NON_FINITE_DIRECTION: 'non_finite_direction',
  ZERO_LENGTH_DIRECTION: 'zero_length_direction',
  NO_GRID: 'no_grid',
  MISS: 'miss', // ray never intersects the grid's world AABB
  BEHIND: 'behind', // grid AABB is entirely behind the ray origin
  BOUNDS_EXIT: 'bounds_exit', // ray traversed the grid but found no occupied cell
  MAX_STEPS: 'max_steps', // traversal budget exhausted before exit
});

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function miss(reason) {
  return { hit: false, reason };
}

/**
 * Ray/AABB slab test. Returns { tEnter, tExit } or null if the ray never intersects the
 * box. The entry FACE (as opposed to tEnter distance) is not derived here — it is
 * derived from the DDA stepping loop itself, per spec ("face crossed... on the axis
 * last stepped"), so this function only needs the clip distances.
 */
function slabClip(origin, direction, min, max) {
  let tEnter = -Infinity;
  let tExit = Infinity;

  const axes = ['x', 'y', 'z'];
  for (const axis of axes) {
    const o = origin[axis];
    const d = direction[axis];
    const lo = min[axis];
    const hi = max[axis];

    if (Math.abs(d) < EPS) {
      // Ray parallel to this axis' slabs: must already be within them, else it never hits.
      if (o < lo || o > hi) return null;
      continue;
    }

    let t0 = (lo - o) / d;
    let t1 = (hi - o) / d;
    if (t0 > t1) {
      const tmp = t0;
      t0 = t1;
      t1 = tmp;
    }

    if (t0 > tEnter) tEnter = t0;
    if (t1 < tExit) tExit = t1;

    if (tEnter > tExit) return null;
  }

  return { tEnter, tExit };
}

/**
 * raycastVoxels(grid, origin, direction, opts) -> RayHit | miss result
 *
 * grid: a Slice-0 VoxelGrid (bench-core.mjs) — reads grid.aabb, grid.cellSize,
 *   grid.nx/ny/nz, grid.isOccupied, grid.sourceId.
 * origin, direction: {x,y,z} world-space.
 * opts: { maxDist?: number }
 *
 * On hit: { hit:true, cell:[x,y,z], face:'+x'|'-x'|'+y'|'-y'|'+z'|'-z'|null,
 *           normal:{x,y,z}, distance:number, sourceId, inside:boolean }
 *   `face`/`normal` are null and `inside` is true when the origin started inside an
 *   occupied cell (no entry face to report).
 * On miss/exit/budget: { hit:false, reason: one of RAYCAST_REASON }.
 */
export function raycastVoxels(grid, origin, direction, opts = {}) {
  if (!grid) return miss(RAYCAST_REASON.NO_GRID);

  // Reject non-finite direction BEFORE the zero-length check: NaN/Infinity components
  // would otherwise slip past a naive `length < eps` guard (NaN comparisons are always
  // false, Infinity trivially satisfies length >= eps).
  if (
    !isFiniteNumber(direction?.x) ||
    !isFiniteNumber(direction?.y) ||
    !isFiniteNumber(direction?.z)
  ) {
    return miss(RAYCAST_REASON.NON_FINITE_DIRECTION);
  }

  const dirLenSq =
    direction.x * direction.x + direction.y * direction.y + direction.z * direction.z;
  if (dirLenSq < EPS) return miss(RAYCAST_REASON.ZERO_LENGTH_DIRECTION);

  const maxDist = isFiniteNumber(opts.maxDist) ? opts.maxDist : Infinity;

  const min = grid.aabb.min;
  const max = grid.aabb.max;

  const clip = slabClip(origin, direction, min, max);
  if (!clip) return miss(RAYCAST_REASON.MISS);
  if (clip.tExit < 0) return miss(RAYCAST_REASON.BEHIND);
  if (clip.tEnter > maxDist) return miss(RAYCAST_REASON.MISS);

  // Distance from origin to the point where traversal actually begins: if tEnter <= 0
  // the origin is already inside the grid (or exactly on its near face); start at 0 and
  // report `inside`, since there is no meaningful "entry face" to cross in that case.
  const startsInside = clip.tEnter <= EPS;
  const tStart = startsInside ? 0 : clip.tEnter;

  const startPoint = {
    x: origin.x + direction.x * tStart,
    y: origin.y + direction.y * tStart,
    z: origin.z + direction.z * tStart,
  };

  const cellSize = grid.cellSize;
  const toCell = (worldValue, minValue, n) => {
    const raw = Math.floor((worldValue - minValue) / cellSize);
    return Math.min(Math.max(raw, 0), n - 1);
  };

  let cx = toCell(startPoint.x, min.x, grid.nx);
  let cy = toCell(startPoint.y, min.y, grid.ny);
  let cz = toCell(startPoint.z, min.z, grid.nz);

  // Per-axis DDA setup (Amanatides-Woo). For a near-zero direction component, that axis
  // never steps: step=0, tMax=tDelta=Infinity, so it can never divide by zero and never
  // wins the "smallest tMax" comparison. tMax is computed directly from the true ray
  // origin (not tStart) so it stays correct whether or not the ray starts inside the grid.
  const axisState = (dirComponent, cellIndex, minValue, originComponent) => {
    if (Math.abs(dirComponent) < EPS) {
      return { step: 0, tMax: Infinity, tDelta: Infinity };
    }
    const step = dirComponent > 0 ? 1 : -1;
    const boundary = minValue + (cellIndex + (step > 0 ? 1 : 0)) * cellSize;
    const tMax = (boundary - originComponent) / dirComponent;
    return { step, tMax, tDelta: Math.abs(cellSize / dirComponent) };
  };

  const axisX = axisState(direction.x, cx, min.x, origin.x);
  const axisY = axisState(direction.y, cy, min.y, origin.y);
  const axisZ = axisState(direction.z, cz, min.z, origin.z);

  const maxSteps = grid.nx + grid.ny + grid.nz + 4;

  // If the origin starts inside an occupied cell, report the inside case immediately
  // (no entry face to cross).
  if (startsInside && grid.isOccupied(cx, cy, cz)) {
    return {
      hit: true,
      cell: [cx, cy, cz],
      face: null,
      normal: null,
      distance: 0,
      sourceId: grid.sourceId ?? null,
      inside: true,
    };
  }

  let lastAxis = null;
  for (let step = 0; step < maxSteps; step += 1) {
    // Advance to the next cell boundary: pick the axis with the smallest tMax.
    let axis;
    if (axisX.tMax <= axisY.tMax && axisX.tMax <= axisZ.tMax) {
      axis = 'x';
    } else if (axisY.tMax <= axisZ.tMax) {
      axis = 'y';
    } else {
      axis = 'z';
    }

    const state = axis === 'x' ? axisX : axis === 'y' ? axisY : axisZ;
    if (state.tMax === Infinity) {
      // All remaining axes are non-stepping (shouldn't happen given the zero-length
      // guard above, but guard defensively against an infinite loop anyway).
      return miss(RAYCAST_REASON.BOUNDS_EXIT);
    }

    const distance = state.tMax;
    if (distance > maxDist || distance > clip.tExit + EPS) {
      return miss(RAYCAST_REASON.BOUNDS_EXIT);
    }

    if (axis === 'x') {
      cx += axisX.step;
      axisX.tMax += axisX.tDelta;
    } else if (axis === 'y') {
      cy += axisY.step;
      axisY.tMax += axisY.tDelta;
    } else {
      cz += axisZ.step;
      axisZ.tMax += axisZ.tDelta;
    }
    lastAxis = axis;

    if (cx < 0 || cx >= grid.nx || cy < 0 || cy >= grid.ny || cz < 0 || cz >= grid.nz) {
      return miss(RAYCAST_REASON.BOUNDS_EXIT);
    }

    if (grid.isOccupied(cx, cy, cz)) {
      const stepSign = lastAxis === 'x' ? axisX.step : lastAxis === 'y' ? axisY.step : axisZ.step;
      // The face crossed opposes the step direction on the axis last stepped (we are
      // entering the cell from the side we stepped INTO, so the outward normal points
      // back the way we came, i.e. opposite the ray's travel direction on that axis).
      const normal = { x: 0, y: 0, z: 0 };
      normal[lastAxis] = stepSign > 0 ? -1 : 1;
      const face = `${stepSign > 0 ? '-' : '+'}${lastAxis}`;

      return {
        hit: true,
        cell: [cx, cy, cz],
        face,
        normal,
        distance,
        sourceId: grid.sourceId ?? null,
        inside: false,
      };
    }
  }

  return miss(RAYCAST_REASON.MAX_STEPS);
}
