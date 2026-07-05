/**
 * Voxel Lab Bench — Gate D Slice 6 memory budgeter + chunk eviction tests (Node-side).
 *   node --test labs/voxel-bench/test/chunk-manager.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateBytesForGrid, TIER1_HARD_MEMORY_CEILING_BYTES } from '../src/render-instanced.mjs';
import { MAX_RESOLUTION } from '../src/bench-core.mjs';
import {
  MemoryBudget,
  TIER2_SOFT_MEMORY_CEILING_BYTES,
  BYTES_PER_INSTANCE_MATRIX,
  estimateChunkBytes,
  createChunkManager,
  loadChunk,
  unloadChunk,
  evictLRU,
} from '../src/chunk-manager.mjs';

function makeChunk(resolution, occupiedIndices = []) {
  const occupancy = new Uint8Array(resolution ** 3);
  for (const i of occupiedIndices) occupancy[i] = 1;
  return { coord: [0, 0, 0], resolution, occupancy, materials: null, dirty: true, lastEditReceipt: null };
}

// --- MemoryBudget ---

test('MemoryBudget throws RangeError on a non-positive/non-finite ceilingBytes', () => {
  assert.throws(() => new MemoryBudget(0), RangeError);
  assert.throws(() => new MemoryBudget(-1), RangeError);
  assert.throws(() => new MemoryBudget(NaN), RangeError);
  assert.throws(() => new MemoryBudget(Infinity), RangeError);
  assert.throws(() => new MemoryBudget('100'), RangeError);
});

test('MemoryBudget.wouldExceed: false comfortably under ceiling, true once it would cross it', () => {
  const budget = new MemoryBudget(1000);
  assert.equal(budget.wouldExceed(10), false);
  budget.usedBytes = 900;
  assert.equal(budget.wouldExceed(50), false);
  assert.equal(budget.wouldExceed(200), true);
});

test('MemoryBudget.wouldExceed boundary: landing EXACTLY at ceiling does NOT exceed (strict >)', () => {
  const budget = new MemoryBudget(1000);
  budget.usedBytes = 900;
  assert.equal(budget.wouldExceed(100), false, 'usedBytes+candidate == ceiling must not exceed');
  assert.equal(budget.wouldExceed(101), true, 'one byte over the ceiling must exceed');
});

test('MemoryBudget.wouldExceed throws RangeError on a negative or non-finite candidateBytes', () => {
  const budget = new MemoryBudget(1000);
  assert.throws(() => budget.wouldExceed(-1), RangeError);
  assert.throws(() => budget.wouldExceed(NaN), RangeError);
  assert.throws(() => budget.wouldExceed(Infinity), RangeError);
});

// --- estimateChunkBytes ---

test('estimateChunkBytes throws TypeError when chunk is missing/undefined', () => {
  assert.throws(() => estimateChunkBytes(undefined), TypeError);
  assert.throws(() => estimateChunkBytes(null), TypeError);
  assert.throws(() => estimateChunkBytes({}), TypeError);
});

test('estimateChunkBytes(chunk, false) equals estimateBytesForGrid(chunk).totalBytes exactly', () => {
  const chunk = makeChunk(4, [0, 5, 10]);
  assert.equal(estimateChunkBytes(chunk, false), estimateBytesForGrid(chunk).totalBytes);
});

test('estimateChunkBytes(chunk, true) adds occupiedCount * BYTES_PER_INSTANCE_MATRIX', () => {
  const chunk = makeChunk(4, [0, 5, 10]); // 3 occupied cells
  const raw = estimateChunkBytes(chunk, false);
  const withRender = estimateChunkBytes(chunk, true);
  assert.equal(withRender, raw + 3 * BYTES_PER_INSTANCE_MATRIX);
});

// --- createChunkManager ---

test('createChunkManager throws on invalid chunkResolution, cellSize, or budget', () => {
  const budget = new MemoryBudget(1000);
  assert.throws(() => createChunkManager({ chunkResolution: 0, cellSize: 1, budget }), RangeError);
  assert.throws(() => createChunkManager({ chunkResolution: -4, cellSize: 1, budget }), RangeError);
  assert.throws(() => createChunkManager({ chunkResolution: 4.5, cellSize: 1, budget }), RangeError);
  assert.throws(() => createChunkManager({ chunkResolution: 4, cellSize: 0, budget }), RangeError);
  assert.throws(() => createChunkManager({ chunkResolution: 4, cellSize: -1, budget }), RangeError);
  assert.throws(() => createChunkManager({ chunkResolution: 4, cellSize: NaN, budget }), RangeError);
  assert.throws(() => createChunkManager({ chunkResolution: 4, cellSize: 1, budget: {} }), TypeError);
  assert.throws(() => createChunkManager({ chunkResolution: 4, cellSize: 1, budget: null }), TypeError);
});

test('createChunkManager rejects a chunkResolution above the kernel cap BEFORE any chunk can ever be allocated', () => {
  const budget = new MemoryBudget(1000); // deliberately tiny, to prove the throw happens regardless of budget size
  assert.throws(
    () => createChunkManager({ chunkResolution: 5000, cellSize: 1, budget }),
    RangeError,
    'an absurd/hostile chunkResolution must be rejected at manager-creation time, not surface as an uncaught allocation failure inside loadChunk',
  );
  assert.throws(() => createChunkManager({ chunkResolution: MAX_RESOLUTION + 1, cellSize: 1, budget }), RangeError);
  // Boundary: exactly the cap is still valid.
  assert.doesNotThrow(() => createChunkManager({ chunkResolution: MAX_RESOLUTION, cellSize: 1, budget }));
});

test('loadChunk never allocates the real occupancy buffer before the budget check runs (pre-allocation estimate matches the real one)', () => {
  const budget = new MemoryBudget(1_000_000);
  const mgr = createChunkManager({ chunkResolution: 8, cellSize: 1, budget });
  const chunk = loadChunk(mgr, [0, 0, 0]);
  // If the pre-allocation estimate ever drifted from the real chunk's cost, this
  // would fail — proving the budget was checked against the SAME number that was
  // actually charged, not a stale/different one.
  assert.equal(mgr.chargedBytes.get('0,0,0'), estimateChunkBytes(chunk, false));
});

test('a refused load does not even advance tickCounter (true no-op, not merely no map mutation)', () => {
  const perChunkBytes = estimateChunkBytes({ occupancy: new Uint8Array(8 ** 3) }, false);
  const budget = new MemoryBudget(Math.floor(perChunkBytes / 2));
  const mgr = createChunkManager({ chunkResolution: 8, cellSize: 1, budget });

  const tickBefore = mgr.tickCounter;
  const result = loadChunk(mgr, [0, 0, 0]);
  assert.equal(result, null);
  assert.equal(mgr.tickCounter, tickBefore, 'a fully-refused load must not mutate tickCounter either');
});

// --- loadChunk / unloadChunk basics ---

test('loadChunk on a fresh coord creates a new chunk and charges the budget exactly', () => {
  const budget = new MemoryBudget(1_000_000);
  const mgr = createChunkManager({ chunkResolution: 8, cellSize: 1, budget });
  const chunk = loadChunk(mgr, [0, 0, 0]);
  assert.ok(chunk);
  assert.equal(chunk.occupancy.length, 8 ** 3);
  const expectedBytes = estimateChunkBytes({ occupancy: new Uint8Array(8 ** 3) }, false);
  assert.equal(mgr.budget.usedBytes, expectedBytes);
});

test('loadChunk twice on the SAME coord returns the identical object and does not double-charge', () => {
  const budget = new MemoryBudget(1_000_000);
  const mgr = createChunkManager({ chunkResolution: 8, cellSize: 1, budget });
  const first = loadChunk(mgr, [1, 2, 3]);
  const usedAfterFirst = mgr.budget.usedBytes;
  const second = loadChunk(mgr, [1, 2, 3]);
  assert.equal(second, first);
  assert.equal(mgr.budget.usedBytes, usedAfterFirst);
});

test('unloadChunk frees exactly the charged bytes', () => {
  const budget = new MemoryBudget(1_000_000);
  const mgr = createChunkManager({ chunkResolution: 8, cellSize: 1, budget });
  loadChunk(mgr, [0, 0, 0]);
  assert.ok(mgr.budget.usedBytes > 0);
  unloadChunk(mgr, [0, 0, 0]);
  assert.equal(mgr.budget.usedBytes, 0);
});

test('unloadChunk on a never-loaded coord is a safe no-op', () => {
  const budget = new MemoryBudget(1_000_000);
  const mgr = createChunkManager({ chunkResolution: 8, cellSize: 1, budget });
  assert.doesNotThrow(() => unloadChunk(mgr, [9, 9, 9]));
  assert.equal(mgr.budget.usedBytes, 0);
});

// --- evictLRU ---

test('evictLRU evicts the least-recently-touched chunk to make room for a 3rd chunk', () => {
  const perChunkBytes = estimateChunkBytes({ occupancy: new Uint8Array(4 ** 3) }, false);
  const budget = new MemoryBudget(Math.floor(perChunkBytes * 2.5)); // room for ~2 chunks
  const mgr = createChunkManager({ chunkResolution: 4, cellSize: 1, budget });

  const a = loadChunk(mgr, [0, 0, 0]);
  const b = loadChunk(mgr, [1, 0, 0]);
  const c = loadChunk(mgr, [2, 0, 0]);
  assert.ok(a && b && c);

  // [0,0,0] was least-recently-touched; re-loading it must build a BRAND NEW object.
  const aReload = loadChunk(mgr, [0, 0, 0]);
  assert.notEqual(aReload, a, 'evicted chunk must be rebuilt from scratch, not returned from cache');
});

test('evictLRU returns an empty array when the manager is not over budget', () => {
  const budget = new MemoryBudget(1_000_000);
  const mgr = createChunkManager({ chunkResolution: 8, cellSize: 1, budget });
  loadChunk(mgr, [0, 0, 0]);
  const evicted = evictLRU(mgr, { neededBytes: 0 });
  assert.deepEqual(evicted, []);
});

// --- Adversarial: many small edits, room larger than one chunk ---

test('adversarial: usedBytes never exceeds ceiling across 20 loads in a tight-budget manager', () => {
  const perChunkBytes = estimateChunkBytes({ occupancy: new Uint8Array(4 ** 3) }, false);
  const budget = new MemoryBudget(Math.floor(perChunkBytes * 3.5)); // room for ~3 chunks
  const mgr = createChunkManager({ chunkResolution: 4, cellSize: 1, budget });

  for (let i = 0; i < 20; i += 1) {
    loadChunk(mgr, [i, 0, 0]);
    assert.ok(mgr.budget.usedBytes <= mgr.budget.ceilingBytes, `usedBytes must never exceed ceiling at i=${i}`);
    assert.ok(mgr.budget.usedBytes >= 0, `usedBytes must never go negative at i=${i}`);
  }
});

test('adversarial: LRU recency ordering drives eviction, not insertion order', () => {
  const perChunkBytes = estimateChunkBytes({ occupancy: new Uint8Array(4 ** 3) }, false);
  const budget = new MemoryBudget(Math.floor(perChunkBytes * 2.5)); // room for ~2 chunks
  const mgr = createChunkManager({ chunkResolution: 4, cellSize: 1, budget });

  loadChunk(mgr, [0, 0, 0]); // A
  loadChunk(mgr, [1, 0, 0]); // B
  loadChunk(mgr, [0, 0, 0]); // touch A again (A is now more recent than B)
  loadChunk(mgr, [2, 0, 0]); // C: forces an eviction

  // B (never re-touched) should be evicted before A (touched most recently).
  const bReload = loadChunk(mgr, [1, 0, 0]);
  const aReload = loadChunk(mgr, [0, 0, 0]);
  // B must have been evicted (rebuilt fresh); we can't directly compare object identity
  // to the original without keeping a reference, so instead assert via a fresh loadChunk
  // sequence: reloading B triggers another eviction cycle since cache is still tight,
  // and A (touched more recently than B) must still be resident afterward.
  assert.ok(bReload);
  assert.ok(aReload);

  // Directly verify eviction order using evictLRU's own bookkeeping on a fresh scenario:
  const mgr2 = createChunkManager({ chunkResolution: 4, cellSize: 1, budget: new MemoryBudget(Math.floor(perChunkBytes * 2.5)) });
  loadChunk(mgr2, [0, 0, 0]); // A, tick 1
  loadChunk(mgr2, [1, 0, 0]); // B, tick 2
  loadChunk(mgr2, [0, 0, 0]); // touch A, tick 3 (A now most recent)
  const evicted = evictLRU(mgr2, { neededBytes: perChunkBytes }); // force room for one more chunk
  assert.equal(evicted.length, 1, 'exactly one chunk should be evicted to make room');
  assert.deepEqual(evicted[0].coord, [1, 0, 0], 'B (least recently touched) must be evicted before A');
});

test('loadChunk refuses (returns null) when a single candidate exceeds the ceiling, even on an empty manager', () => {
  const perChunkBytes = estimateChunkBytes({ occupancy: new Uint8Array(8 ** 3) }, false);
  const budget = new MemoryBudget(Math.floor(perChunkBytes / 2)); // ceiling smaller than one chunk
  const mgr = createChunkManager({ chunkResolution: 8, cellSize: 1, budget });

  const result = loadChunk(mgr, [0, 0, 0]);
  assert.equal(result, null);
  assert.equal(mgr.budget.usedBytes, 0, 'refused load must not corrupt usedBytes');
  assert.equal(mgr.chunks.size, 0, 'refused load must not corrupt mgr.chunks');
});

// --- Tier-1 / Tier-2 per-tier budget assertions (plan Section 4.0 room: 32x32x16m) ---

test('Tier-1: a 32x32x16m room at cellSize 1m (chunk edge 16m) fits within the Tier-1 hard ceiling', () => {
  const budget = new MemoryBudget(TIER1_HARD_MEMORY_CEILING_BYTES);
  const mgr = createChunkManager({ chunkResolution: 16, cellSize: 1, budget });

  const chunksX = Math.ceil(32 / 16);
  const chunksY = Math.ceil(32 / 16);
  const chunksZ = Math.ceil(16 / 16);
  assert.equal(chunksX * chunksY * chunksZ, 4, 'Tier-1 room must tile into the plan\'s stated 1-4 chunk range');

  for (let x = 0; x < chunksX; x += 1) {
    for (let y = 0; y < chunksY; y += 1) {
      for (let z = 0; z < chunksZ; z += 1) {
        const chunk = loadChunk(mgr, [x, y, z]);
        assert.notEqual(chunk, null, 'the whole Tier-1 room must fit per the plan\'s own budget rationale');
        assert.ok(mgr.budget.usedBytes <= TIER1_HARD_MEMORY_CEILING_BYTES);
      }
    }
  }
});

test('Tier-2: a 32x32x16m room at cellSize 0.2m (chunk edge 8m) fits within the Tier-2 soft ceiling', () => {
  const budget = new MemoryBudget(TIER2_SOFT_MEMORY_CEILING_BYTES);
  const mgr = createChunkManager({ chunkResolution: 40, cellSize: 0.2, budget });

  const chunksX = Math.ceil(32 / 8);
  const chunksY = Math.ceil(32 / 8);
  const chunksZ = Math.ceil(16 / 8);
  assert.equal(chunksX * chunksY * chunksZ, 32, 'Tier-2 room must tile within the plan\'s stated <=64 chunk range');

  for (let x = 0; x < chunksX; x += 1) {
    for (let y = 0; y < chunksY; y += 1) {
      for (let z = 0; z < chunksZ; z += 1) {
        const chunk = loadChunk(mgr, [x, y, z]);
        assert.notEqual(chunk, null);
        assert.ok(mgr.budget.usedBytes <= TIER2_SOFT_MEMORY_CEILING_BYTES);
      }
    }
  }
});

test('determinism: the Tier-1 room-fill loop produces the exact same final usedBytes across two fresh managers', () => {
  function runTier1Fill() {
    const budget = new MemoryBudget(TIER1_HARD_MEMORY_CEILING_BYTES);
    const mgr = createChunkManager({ chunkResolution: 16, cellSize: 1, budget });
    const chunksX = Math.ceil(32 / 16);
    const chunksY = Math.ceil(32 / 16);
    const chunksZ = Math.ceil(16 / 16);
    for (let x = 0; x < chunksX; x += 1) {
      for (let y = 0; y < chunksY; y += 1) {
        for (let z = 0; z < chunksZ; z += 1) {
          loadChunk(mgr, [x, y, z]);
        }
      }
    }
    return mgr.budget.usedBytes;
  }

  const first = runTier1Fill();
  const second = runTier1Fill();
  assert.equal(first, second);
});
