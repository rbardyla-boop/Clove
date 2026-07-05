/**
 * Voxel Lab Bench — memory budgeter + chunk eviction (Gate D, Slice 6).
 *
 * Wires `MemoryBudget` enforcement into `loadChunk`/`evictLRU` per
 * docs/VOXEL_LAB_BENCH_PLAN.md Section 3.5/7 (Slice 6): "Break the budget on purpose" —
 * a room can outgrow a single chunk, and a session of many small edits must never let
 * `usedBytes` cross the tier ceiling, even transiently. The budget is charged AT LOAD
 * TIME (when a chunk's occupancy buffer is allocated), not after voxelization, because
 * the buffer itself — not what ends up written into it — is what actually holds memory;
 * charging early means eviction can run BEFORE the ceiling is crossed instead of after.
 *
 * Dependency-free by design beyond the shared Tier-1 constant/estimator: no THREE.*
 * import, no network code, no Worker/DO/D1/R2 reference — plain Map-backed bookkeeping,
 * trivially testable with plain `node --test`.
 */

import { estimateBytesForGrid } from './render-instanced.mjs';
import { MAX_RESOLUTION } from './bench-core.mjs';

/** Tier-2 soft memory ceiling (plan Section 5): laptop/desktop budget, 1 GB. */
export const TIER2_SOFT_MEMORY_CEILING_BYTES = 1024 * 1024 * 1024;

/**
 * Bytes per occupied cell if/when render buffers are also charged against the budget:
 * a THREE.InstancedMesh instance matrix is a 4x4 Float32 matrix (16 floats * 4 bytes).
 * This is a verifiable THREE.js fact, not a guess — used only for the optional
 * render-buffer cost term in estimateChunkBytes.
 */
export const BYTES_PER_INSTANCE_MATRIX = 64;

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function isPositiveFiniteNumber(n) {
  return isFiniteNumber(n) && n > 0;
}

function isPositiveInteger(n) {
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

/** Build the Map key for a chunk coordinate, e.g. [1,-2,0] -> "1,-2,0". */
function coordKey(coord) {
  return `${coord[0]},${coord[1]},${coord[2]}`;
}

function assertCoord(coord) {
  const bad =
    !Array.isArray(coord) ||
    coord.length !== 3 ||
    !coord.every((v) => typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v));
  if (bad) {
    throw new TypeError('chunk-manager: coord must be an array of exactly 3 finite integers');
  }
}

/**
 * Tracks how many bytes are currently charged against a fixed ceiling. Deliberately
 * dumb — it does not know about chunks, grids, or eviction; `loadChunk`/`evictLRU`
 * build the policy on top of this primitive so the "is this over budget?" question has
 * exactly one implementation, matching the ceiling used everywhere else.
 */
export class MemoryBudget {
  constructor(ceilingBytes) {
    if (!isPositiveFiniteNumber(ceilingBytes)) {
      throw new RangeError('MemoryBudget: ceilingBytes must be a positive finite number');
    }
    this.ceilingBytes = ceilingBytes;
    this.usedBytes = 0;
  }

  /**
   * Would charging `candidateBytes` on top of the current usage cross the ceiling?
   * Strict greater-than: landing EXACTLY at the ceiling is allowed, not a refusal —
   * the ceiling is the largest allowed footprint, not the smallest disallowed one.
   */
  wouldExceed(candidateBytes) {
    if (typeof candidateBytes !== 'number' || !Number.isFinite(candidateBytes) || candidateBytes < 0) {
      throw new RangeError('MemoryBudget.wouldExceed: candidateBytes must be a non-negative finite number');
    }
    return this.usedBytes + candidateBytes > this.ceilingBytes;
  }
}

/**
 * estimateChunkBytes(chunk, includeRenderBuffers?) -> number
 *
 * Reuses estimateBytesForGrid (render-instanced.mjs) by direct duck-typing: a Chunk's
 * `.occupancy` Uint8Array is exactly what that estimator reads, so no adapter is
 * needed. When includeRenderBuffers is true, also charges one instance-matrix's worth
 * of bytes per occupied cell — the optional render-buffer cost term callers can opt
 * into once a chunk is actually being drawn, not merely resident in the chunk cache.
 */
export function estimateChunkBytes(chunk, includeRenderBuffers = false) {
  if (!chunk || !chunk.occupancy) {
    throw new TypeError('estimateChunkBytes: chunk (with an occupancy buffer) is required');
  }

  const rawBytes = estimateBytesForGrid(chunk).totalBytes;
  if (!includeRenderBuffers) return rawBytes;

  let occupiedCount = 0;
  for (let i = 0; i < chunk.occupancy.length; i += 1) {
    if (chunk.occupancy[i] !== 0) occupiedCount += 1;
  }
  return rawBytes + occupiedCount * BYTES_PER_INSTANCE_MATRIX;
}

/**
 * createChunkManager({ chunkResolution, cellSize, budget }) -> ChunkManager
 *
 * A ChunkManager is a plain object, not a class: it is pure bookkeeping state
 * (Maps + a tick counter) manipulated by the free functions below, matching this
 * module's sibling kernels' preference for plain data over behavior-bearing objects
 * where no invariant needs enforcing beyond construction.
 *
 * `lastVisibleTick` drives LRU eviction (oldest tick = least recently touched);
 * `chargedBytes` remembers exactly what each resident chunk was charged, so
 * `unloadChunk` can refund the budget precisely without re-deriving an estimate that
 * may have gone stale (e.g. if the chunk was edited after load).
 */
export function createChunkManager({ chunkResolution, cellSize, budget }) {
  if (!isPositiveInteger(chunkResolution) || chunkResolution > MAX_RESOLUTION) {
    // Same kernel cap bench-core.mjs's VoxelGrid enforces (defense in depth per plan
    // Section 3.5: "enforced at every kernel boundary that accepts geometry"). Unlike
    // VoxelGrid's clampResolution (which silently clamps for caller convenience), this
    // throws: a caller computing world-space chunk tiling from cellSize*chunkResolution
    // needs to know up front if its resolution assumption is invalid, not have it
    // silently rewritten underneath a room-layout calculation.
    throw new RangeError(
      `createChunkManager: chunkResolution must be a positive integer <= ${MAX_RESOLUTION}`,
    );
  }
  if (!isPositiveFiniteNumber(cellSize)) {
    throw new RangeError('createChunkManager: cellSize must be a positive finite number');
  }
  if (!(budget instanceof MemoryBudget)) {
    throw new TypeError('createChunkManager: budget must be a MemoryBudget instance');
  }

  return {
    chunkResolution,
    cellSize,
    budget,
    chunks: new Map(),
    lastVisibleTick: new Map(),
    chargedBytes: new Map(),
    tickCounter: 0,
  };
}

/**
 * loadChunk(mgr, coord, opts?) -> chunk | null
 *
 * Checks the budget BEFORE allocating anything (plan Section 3.5: "checks
 * wouldExceed(...) before allocating... a labeled-break style, not a post-hoc GC
 * hope"): a freshly-loaded chunk always starts fully empty, so its cost is knowable
 * from chunkResolution alone (occupancyBytes = chunkResolution^3, one byte per cell) —
 * this lets the check run against that number BEFORE the real Uint8Array exists, so a
 * hostile/misconfigured resolution can never reach an actual (uncatchable,
 * budget-oblivious) allocation failure. If the candidate would exceed the ceiling,
 * eviction runs first to try to make room; if it STILL would not fit afterward
 * (nothing left to evict, or the candidate alone is bigger than the whole ceiling),
 * the load is refused (returns null) without mutating any manager state at all —
 * including `tickCounter` — so a refusal is a true no-op, not a partial one.
 */
export function loadChunk(mgr, coord, opts = {}) {
  assertCoord(coord);
  const includeRenderBuffers = opts.includeRenderBuffers ?? false;
  const key = coordKey(coord);
  const nextTick = mgr.tickCounter + 1;

  const existing = mgr.chunks.get(key);
  if (existing) {
    // Touch only: recency refresh, never re-charges the budget for an already-resident chunk.
    mgr.tickCounter = nextTick;
    mgr.lastVisibleTick.set(key, nextTick);
    return existing;
  }

  // Estimate what the candidate WOULD cost without allocating it — a fresh chunk is
  // always all-zero, so estimateChunkBytes' occupied-cell scan (the includeRenderBuffers
  // term) is provably 0 for it regardless of resolution; a duck-typed stand-in with only
  // `.byteLength` (no real backing buffer) is enough to reuse estimateChunkBytes/
  // estimateBytesForGrid here instead of re-deriving the arithmetic a second time.
  const preAllocationEstimate = { occupancy: { byteLength: mgr.chunkResolution ** 3 } };
  const candidateBytes = estimateChunkBytes(preAllocationEstimate, includeRenderBuffers);

  if (mgr.budget.wouldExceed(candidateBytes)) {
    evictLRU(mgr, { neededBytes: candidateBytes });
    if (mgr.budget.wouldExceed(candidateBytes)) {
      // Nothing left to evict (or even a fully-empty cache can't fit this candidate):
      // refuse the load rather than risking an allocation the budget can't afford.
      return null;
    }
  }

  // Only now, with room confirmed, allocate the real buffer.
  const candidate = {
    coord: [...coord],
    resolution: mgr.chunkResolution,
    occupancy: new Uint8Array(mgr.chunkResolution ** 3),
    materials: null,
    dirty: true,
    lastEditReceipt: null,
  };

  mgr.tickCounter = nextTick;
  mgr.chunks.set(key, candidate);
  mgr.chargedBytes.set(key, candidateBytes);
  mgr.lastVisibleTick.set(key, nextTick);
  mgr.budget.usedBytes += candidateBytes;
  return candidate;
}

/**
 * unloadChunk(mgr, coord) -> void
 *
 * Safe no-op on a coord that was never loaded (an eviction race or a stale caller
 * reference should never throw). Refunds exactly what was charged at load time —
 * not a fresh estimate — so the budget stays exact even if the chunk's occupancy was
 * mutated after load.
 */
export function unloadChunk(mgr, coord) {
  const key = coordKey(coord);
  if (!mgr.chunks.has(key)) return;

  const charged = mgr.chargedBytes.get(key) ?? 0;
  mgr.budget.usedBytes -= charged;
  mgr.chunks.delete(key);
  mgr.chargedBytes.delete(key);
  mgr.lastVisibleTick.delete(key);
}

/**
 * evictLRU(mgr, opts?) -> evicted chunk[]
 *
 * Evicts least-recently-touched chunks first, stopping as soon as both the ceiling is
 * satisfied AND the caller's pending candidate (opts.neededBytes) would fit — never
 * evicts more than necessary, and never evicts a chunk that is still needed (the
 * most-recently-touched chunks, which are the ones most likely to still be visible,
 * are always evicted last). Returns an empty array when nothing needs evicting, so
 * callers can treat the return value as "how much did we actually free" without a
 * separate before/after usedBytes diff.
 */
export function evictLRU(mgr, opts = {}) {
  const neededBytes = opts.neededBytes ?? 0;

  const candidates = Array.from(mgr.lastVisibleTick.entries()).sort((a, b) => a[1] - b[1]);
  const evicted = [];

  let cursor = 0;
  while (
    (mgr.budget.usedBytes > mgr.budget.ceilingBytes || mgr.budget.wouldExceed(neededBytes)) &&
    cursor < candidates.length
  ) {
    const [key] = candidates[cursor];
    cursor += 1;
    const chunk = mgr.chunks.get(key);
    if (!chunk) continue; // Already gone; keep scanning the sorted candidate list.
    unloadChunk(mgr, chunk.coord);
    evicted.push(chunk);
  }

  return evicted;
}
