/**
 * Voxel Lab Bench — coarse lighting grid / LPV + dual-purpose occlusion (Gate B, Slice
 * 5, Blocker #4).
 *
 * Re-derived (not copy-pasted) from the behavioral contract described in
 * docs/VOXEL_LAB_BENCH_PLAN.md Section 3.2 ("--- Coarse lighting grid (NEW beyond Stage
 * 16) ---"), Section 3.4, Section 4.1 items 4/5, and Section 4.3/7 Slice 5. This module
 * is the "how much does lighting resolution actually cost?" lab: a deliberately small,
 * fixed-resolution 3D light volume, populated and propagated from the SAME occupancy
 * data already used for rendering (the Reddit-post "dual-purpose occupancy" idea —
 * occupancy is reused as BOTH an ambient-occlusion darkening term AND a light-
 * propagation energy limiter, not just a second unrelated data structure).
 *
 * Dependency-free by design (no THREE.*, no Worker) so it is directly node:test-testable
 * in isolation, matching the sibling Slice 3/4 modules (mesh-greedy.mjs, lod.mjs).
 *
 * There is no ChunkManager yet in this repo (that is Slice 6, out of scope for Gate B),
 * so `injectFromOccupancy` takes a plain array of VoxelGrid instances (e.g. `[grid]`),
 * not a chunk-manager object — matching the plan's pseudo-IDL parameter name (`chunks`)
 * in spirit but the real Slice-0..4 kernel type in practice.
 *
 * --- Representation (documented, not left implicit) ---
 * A LightVolume is a plain object:
 *   {
 *     bounds: { min: {x,y,z}, max: {x,y,z} },   // world-space AABB this volume covers
 *     resolution: number,                        // cells per axis (cubic grid, nx=ny=nz)
 *     nx, ny, nz: number,                         // == resolution, kept for indexOf() parity
 *                                                  // with VoxelGrid's own nx/ny/nz fields
 *     cellSize: { x, y, z },                      // world units per light-cell, per axis
 *                                                  // (NOT forced cubic like VoxelGrid's
 *                                                  // single cellSize — a light volume's
 *                                                  // bounds are usually the room's own
 *                                                  // AABB, which is rarely a cube, and
 *                                                  // Section 3.2's pseudo-IDL takes a
 *                                                  // per-axis resolution triple, so this
 *                                                  // module keeps per-axis cell size too)
 *     energy: Float32Array(nx*ny*nz*3),            // RGB light energy, x-fastest cell
 *                                                  // index then R,G,B channel-interleaved
 *                                                  // (channel-fastest within a cell:
 *                                                  // index = cellIndex*3 + channel)
 *     occlusion: Uint8Array(nx*ny*nz),             // 0 = fully open, 255 = fully occluded;
 *                                                  // dual-purpose: (a) an AO darkening
 *                                                  // term sampled alongside energy, and
 *                                                  // (b) a propagation energy limiter
 *                                                  // (occluded cells block/attenuate
 *                                                  // light flowing THROUGH them)
 *   }
 *
 * Cell indexing is the same x-fastest convention as bench-core.mjs's indexOf: for the
 * per-cell (non-channel) arrays, index = x + nx*(y + ny*z).
 */

/** Default light-source RGB: warm-white, matching a plausible single point light. */
const DEFAULT_SOURCE_COLOR = Object.freeze({ r: 1, g: 0.95, b: 0.85 });

/** Per-iteration decay applied during propagate() so energy doesn't grow unbounded. */
const PROPAGATION_DECAY = 0.92;

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function assertFiniteBounds(bounds) {
  const bad =
    !bounds || !bounds.min || !bounds.max ||
    !isFiniteNumber(bounds.min.x) || !isFiniteNumber(bounds.min.y) || !isFiniteNumber(bounds.min.z) ||
    !isFiniteNumber(bounds.max.x) || !isFiniteNumber(bounds.max.y) || !isFiniteNumber(bounds.max.z);
  if (bad) {
    throw new TypeError('createLightVolume: bounds.min/max must be finite {x,y,z} numbers');
  }
}

/** x-fastest flat cell index, matching bench-core.mjs's indexOf convention. */
function cellIndexOf(x, y, z, nx, ny) {
  return x + nx * (y + ny * z);
}

/**
 * createLightVolume(bounds, resolution) -> LightVolume
 *
 * `resolution` is a single integer applied to all three axes (matching the Section
 * 4.3 lesson's single "lighting-grid resolution" slider — 8/16/32/64 — and the plan's
 * `[int,int,int]` pseudo-IDL type, kept cubic here since every cited resolution in
 * Section 5's tier table and Section 4.3's example is itself cubic, e.g. "16^3").
 * Resolution is clamped to >= 1 (a degenerate 1^3 volume is still well-defined: a
 * single ambient cell) with no upper clamp of its own — Slice 5's whole point is to let
 * the caller freely dial resolution up to 64 (and beyond, for exploration) and observe
 * the resulting cost, so this module does not impose the render-kernel's MAX_RESOLUTION
 * ceiling from bench-core.mjs.
 */
export function createLightVolume(bounds, resolution) {
  assertFiniteBounds(bounds);
  const res = Math.max(1, Math.trunc(Number(resolution) || 0) || 1);

  const extentX = Math.max(bounds.max.x - bounds.min.x, 1e-6);
  const extentY = Math.max(bounds.max.y - bounds.min.y, 1e-6);
  const extentZ = Math.max(bounds.max.z - bounds.min.z, 1e-6);

  const cellCount = res * res * res;

  return {
    bounds: {
      min: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
      max: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
    },
    resolution: res,
    nx: res,
    ny: res,
    nz: res,
    cellSize: { x: extentX / res, y: extentY / res, z: extentZ / res },
    energy: new Float32Array(cellCount * 3),
    occlusion: new Uint8Array(cellCount),
  };
}

/** Map a world-space position to the nearest in-bounds light-cell coordinate. */
function worldToCell(volume, worldPos) {
  const { bounds, cellSize, nx, ny, nz } = volume;
  const fx = (worldPos.x - bounds.min.x) / cellSize.x;
  const fy = (worldPos.y - bounds.min.y) / cellSize.y;
  const fz = (worldPos.z - bounds.min.z) / cellSize.z;
  const cx = Math.min(nx - 1, Math.max(0, Math.floor(fx)));
  const cy = Math.min(ny - 1, Math.max(0, Math.floor(fy)));
  const cz = Math.min(nz - 1, Math.max(0, Math.floor(fz)));
  return { x: cx, y: cy, z: cz };
}

/** Center of a light-cell in world space (used to rasterize a VoxelGrid's occupancy). */
function cellCenterWorld(volume, cx, cy, cz) {
  return {
    x: volume.bounds.min.x + (cx + 0.5) * volume.cellSize.x,
    y: volume.bounds.min.y + (cy + 0.5) * volume.cellSize.y,
    z: volume.bounds.min.z + (cz + 0.5) * volume.cellSize.z,
  };
}

/**
 * injectFromOccupancy(volume, grids, opts?) -> void
 *
 * Populates `volume.occlusion` from one or more VoxelGrid instances' occupancy (nearest
 * light-cell rasterization: for every light-cell, sample the occupancy of whichever
 * source grid covers that light-cell's world-space center; a light-cell is marked
 * occluded (255) if ANY covering grid reports it occupied there), then injects initial
 * light ENERGY at a single source position into `volume.energy` — but ONLY into cells
 * that are not themselves occluded (an occupied/solid cell cannot itself hold injected
 * light energy; that is the "dual-purpose occupancy" contract: the same occupancy data
 * both darkens a cell via AO/occlusion and limits where/how energy can sit or flow).
 *
 * `grids`: array of VoxelGrid instances (bench-core.mjs). May be empty (no occluders —
 * light propagates through open space only).
 * `opts.source`: `{ worldPos: {x,y,z}, color?: {r,g,b}, intensity?: number }`. Defaults
 * to the volume's own center with DEFAULT_SOURCE_COLOR and intensity 1. The source is
 * injected as a single texel of energy (not yet spread — `propagate()` does that).
 *
 * Mutates `volume` in place (matching the plan's `-> void` pseudo-IDL signature) and
 * also returns `volume` for convenient chaining in tests/call sites.
 */
export function injectFromOccupancy(volume, grids, opts = {}) {
  if (!volume) throw new TypeError('injectFromOccupancy: volume is required');
  const sourceGrids = Array.isArray(grids) ? grids : [];

  const { nx, ny, nz } = volume;
  for (let z = 0; z < nz; z += 1) {
    for (let y = 0; y < ny; y += 1) {
      for (let x = 0; x < nx; x += 1) {
        const idx = cellIndexOf(x, y, z, nx, ny);
        const worldPos = cellCenterWorld(volume, x, y, z);
        let occluded = false;
        for (const grid of sourceGrids) {
          if (!grid) continue;
          const gx = Math.floor((worldPos.x - grid.aabb.min.x) / grid.cellSize);
          const gy = Math.floor((worldPos.y - grid.aabb.min.y) / grid.cellSize);
          const gz = Math.floor((worldPos.z - grid.aabb.min.z) / grid.cellSize);
          if (grid.inBounds(gx, gy, gz) && grid.isOccupied(gx, gy, gz)) {
            occluded = true;
            break;
          }
        }
        volume.occlusion[idx] = occluded ? 255 : 0;
      }
    }
  }

  const source = opts.source ?? {
    worldPos: {
      x: (volume.bounds.min.x + volume.bounds.max.x) / 2,
      y: (volume.bounds.min.y + volume.bounds.max.y) / 2,
      z: (volume.bounds.min.z + volume.bounds.max.z) / 2,
    },
  };
  const color = source.color ?? DEFAULT_SOURCE_COLOR;
  const intensity = isFiniteNumber(source.intensity) ? source.intensity : 1;

  const sourceCell = worldToCell(volume, source.worldPos);
  const sourceIdx = cellIndexOf(sourceCell.x, sourceCell.y, sourceCell.z, nx, ny);
  // Only inject into a non-occluded (open) cell — an occluded cell cannot hold energy,
  // matching the dual-purpose-occupancy contract above.
  if (volume.occlusion[sourceIdx] === 0) {
    volume.energy[sourceIdx * 3 + 0] = color.r * intensity;
    volume.energy[sourceIdx * 3 + 1] = color.g * intensity;
    volume.energy[sourceIdx * 3 + 2] = color.b * intensity;
  }

  return volume;
}

const NEIGHBOR_OFFSETS = Object.freeze([
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
]);

/**
 * propagate(volume, iterations) -> void
 *
 * Simple iterative diffusion pass, deliberately kept simple and correctness-testable
 * (relative brightness ordering) rather than physically exact: each iteration, every
 * OPEN (non-occluded) cell's new energy moves partway toward the average energy of its
 * open 6-connected neighbors (occluded neighbors contribute nothing and are skipped —
 * this is the "occupancy as light-propagation energy limiter" half of the dual-purpose
 * contract: light cannot flow through/from a solid cell), scaled down by a fixed
 * per-iteration decay (PROPAGATION_DECAY) so total energy strictly cannot grow run over
 * run and farther cells end up dimmer than nearer ones.
 *
 * Occluded cells are always forced to 0 energy after every iteration (a solid cell does
 * not itself glow) — this is the AO-darkening half of the dual-purpose contract.
 *
 * Uses a double-buffer (read from a snapshot, write into a fresh array, then swap) so
 * propagation within one iteration is order-independent, not order-dependent on the
 * x-fastest scan order.
 *
 * Mutates `volume.energy` in place; returns `volume`.
 */
export function propagate(volume, iterations) {
  if (!volume) throw new TypeError('propagate: volume is required');
  const iterCount = Math.max(0, Math.trunc(Number(iterations) || 0));
  const { nx, ny, nz, occlusion } = volume;
  const cellCount = nx * ny * nz;

  let current = volume.energy;
  let next = new Float32Array(cellCount * 3);

  for (let iter = 0; iter < iterCount; iter += 1) {
    for (let z = 0; z < nz; z += 1) {
      for (let y = 0; y < ny; y += 1) {
        for (let x = 0; x < nx; x += 1) {
          const idx = cellIndexOf(x, y, z, nx, ny);
          if (occlusion[idx] !== 0) {
            // Solid cell: no self-glow, and (per the loop below) contributes nothing to
            // neighbors either since we skip occluded cells when accumulating.
            next[idx * 3 + 0] = 0;
            next[idx * 3 + 1] = 0;
            next[idx * 3 + 2] = 0;
            continue;
          }

          let sumR = 0;
          let sumG = 0;
          let sumB = 0;
          let openNeighborCount = 0;
          for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
            const nxCoord = x + dx;
            const nyCoord = y + dy;
            const nzCoord = z + dz;
            if (nxCoord < 0 || nxCoord >= nx || nyCoord < 0 || nyCoord >= ny || nzCoord < 0 || nzCoord >= nz) continue;
            const nIdx = cellIndexOf(nxCoord, nyCoord, nzCoord, nx, ny);
            if (occlusion[nIdx] !== 0) continue; // blocked: contributes no energy
            sumR += current[nIdx * 3 + 0];
            sumG += current[nIdx * 3 + 1];
            sumB += current[nIdx * 3 + 2];
            openNeighborCount += 1;
          }

          const neighborAvgR = openNeighborCount > 0 ? sumR / openNeighborCount : 0;
          const neighborAvgG = openNeighborCount > 0 ? sumG / openNeighborCount : 0;
          const neighborAvgB = openNeighborCount > 0 ? sumB / openNeighborCount : 0;

          const selfR = current[idx * 3 + 0];
          const selfG = current[idx * 3 + 1];
          const selfB = current[idx * 3 + 2];

          // Move partway toward the open-neighbor average (blend factor 0.5), then apply
          // the fixed per-iteration decay so energy cannot grow unbounded.
          next[idx * 3 + 0] = ((selfR + neighborAvgR) / 2) * PROPAGATION_DECAY;
          next[idx * 3 + 1] = ((selfG + neighborAvgG) / 2) * PROPAGATION_DECAY;
          next[idx * 3 + 2] = ((selfB + neighborAvgB) / 2) * PROPAGATION_DECAY;
        }
      }
    }

    // Swap buffers for the next iteration.
    const tmp = current;
    current = next;
    next = tmp;
  }

  volume.energy = current;
  return volume;
}

/**
 * sampleLight(volume, worldPos) -> {r, g, b}
 *
 * Nearest-cell sampling (documented choice over trilinear): looks up the single
 * light-cell whose center is closest to `worldPos` (via worldToCell's floor-based
 * mapping, clamped to the volume's bounds) and returns its RGB energy directly. Chosen
 * over trilinear interpolation for Slice 5 because the lesson this slice teaches is
 * about RESOLUTION cost, not filtering quality — nearest-cell sampling makes the
 * resolution's blockiness directly visible/testable (exactly the coarse "soft shadows
 * get better as resolution goes up" visual the Section 4.3 lesson describes), and it
 * keeps sampleLight's cost O(1) with no additional neighbor reads. A future slice may
 * add a trilinear variant if smoother in-lab visuals are wanted.
 */
export function sampleLight(volume, worldPos) {
  if (!volume) throw new TypeError('sampleLight: volume is required');
  if (!worldPos || !isFiniteNumber(worldPos.x) || !isFiniteNumber(worldPos.y) || !isFiniteNumber(worldPos.z)) {
    throw new TypeError('sampleLight: worldPos must be a finite {x,y,z}');
  }
  const cell = worldToCell(volume, worldPos);
  const idx = cellIndexOf(cell.x, cell.y, cell.z, volume.nx, volume.ny);
  return {
    r: volume.energy[idx * 3 + 0],
    g: volume.energy[idx * 3 + 1],
    b: volume.energy[idx * 3 + 2],
  };
}

/**
 * estimateLightVolumeBytes(volume) -> { energyBytes, occlusionBytes, totalBytes }
 *
 * Mirrors estimateBytesForGrid's shape (render-instanced.mjs) so the bench's readout
 * panel and the Section 4.3 lesson's "memory estimate (bytes for the light volume)"
 * live readout can report a light volume's CPU-side footprint the same way a
 * VoxelGrid's footprint is already reported.
 */
export function estimateLightVolumeBytes(volume) {
  if (!volume) throw new TypeError('estimateLightVolumeBytes: volume is required');
  const energyBytes = volume.energy.byteLength;
  const occlusionBytes = volume.occlusion.byteLength;
  return {
    energyBytes,
    occlusionBytes,
    totalBytes: energyBytes + occlusionBytes,
  };
}
