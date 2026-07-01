# Micro-Voxel Lab Bench — Plan (Voxel Lab 0: Micro World Bench)

**Status:** PLAN / DOCS ONLY. No code, no deploy, no production mutation. This document
authorizes nothing beyond itself — each implementation slice in Section 7 needs its own
explicit `AUTHORIZED: BUILD ...` gate before any file under `labs/` is created.

**Product thesis this plan serves:** games as LABORATORIES — a bounded space where a
player walks into a 3D model of an idea, changes one variable, sees the result, and
exports the lesson to their second brain. The engine itself is exposed as part of the
lesson: draw calls, frame time, memory, lighting-grid resolution are live readouts, not
hidden implementation detail. Every engineering slice below must also *be* a learning
lab — engine work that doesn't teach something is out of scope (Blocker #8).

---

## 1. Source Summary — the Reddit micro-voxel engine

**Provenance flag:** the source post (r/GraphicsProgramming, u/MGMishMash) could not be
fetched directly (Reddit blocked the fetch tool on both `www` and `old` subdomains,
three attempts). Everything in this section is **OPERATOR-SUMMARY** — reported by the
operator, not independently verified against the live thread. Treat as directionally
useful, not as ground truth to cite externally.

### Reported numbers (claimed, not independently measured by us)

| Metric | Reported value |
|---|---|
| Voxel size | 0.1 m |
| World size cap | 16 km × 16 km (author states this is an arbitrary/chosen cap, not an engine ceiling) |
| FPS | 40–100 FPS on Apple M1 Pro |
| Memory footprint | ~3.2 GB stable (shared-memory), at the author's current view distance |
| Lighting pass cost | ~0.3 ms on M1 Pro |

### Techniques claimed (design commentary, not benchmarked head-to-heads)

- **Chunking** implied by the world cap + view-distance-dependent memory number; no
  chunk-size figure given.
- **Colored light propagation** via a light-volume field spreading through voxel
  occupancy — not per-voxel raytracing.
- **Dual-purpose occupancy**: the same occupancy data drives both ambient occlusion
  *and* acts as an energy limiter/attenuator for the light-propagation pass — one
  structure, two jobs, rather than separate AO and lighting passes.
- **LOD via marching cubes at LOD+2** (coarsest distant tier) — author admits this
  "looks bad" (visible blockiness at range); **unresolved**.
- **Intentional blockiness retained at LOD+1** on purpose, to soften the transition
  between tiers rather than hide it — implies the LOD seam is still an active tuning
  concern, not a solved problem (Blocker #3).
- **DDA raymarching tried and abandoned** for the full-scene case: looked good in
  isolation, lost once depth-buffer/overdraw entered the picture. No ms figure given
  for the comparison — qualitative claim only.
- **Infinite terrain called out as a perf-difficulty multiplier** — motivates the
  16 km cap as a tradeoff, not a technical wall (Blocker #5).

### Author's open caveats (explicitly unresolved per the operator brief)

1. Distant-LOD blockiness from marching cubes "looks bad" — unresolved.
2. LOD+1 blockiness is a deliberate compromise, implying the seam itself is still
   being tuned.
3. DDA was tried and set aside for realistic scenes — the current approach is an
   empirical choice, not a proven optimum.
4. Infinite terrain is flagged as harder, implying the engine doesn't (or chooses not
   to) support truly unbounded worlds at the stated performance numbers.

### Native vs. browser

The author's profile is reported (uncorroborated inference, not a quoted statement) to
suggest a **native/Metal-adjacent** engine, not a browser/WebGL/WebGPU engine. This
matters directly: **none of the raw numbers above (3.2 GB, 40-100 FPS, 0.1 m voxels at
16 km) are safe assumptions for a public, minors-facing browser tab.** They are a
native-engine data point, not a browser budget (see Blocker #1, #2, #7, Section 5).

---

## 2. Technique Comparison

### 2a. Four-way comparison

| Approach | What it is | Browser-fit today | Verdict for this lab |
|---|---|---|---|
| **Old npm `voxel-engine` / voxel.js** (maxogden, ~2013) | ~200 loosely-glued npm modules (Browserify-era) around a three.js render loop; naive/culled meshing, 32³ chunks, main-thread only | Poor — no workers, no typed-array-first data model, stale three.js API surface, no LOD | **Do not reuse code.** Reuse two *ideas*: (1) the naive→culled→greedy meshing teaching progression, (2) modular plugin separation (mesher / chunk-store / physics / controls as swappable units) as a lab architecture shape |
| **Micro-voxel high-density terrain (Reddit engine + modern SVDAG state-of-art, e.g. Aokana 2025)** | Voxels as pure data (typed-array occupancy + material bytes), chunked, per-chunk shallow SVDAGs, density-thresholded octree LOD, Hi-Z hierarchical occlusion, coarse light-volume GI | Poor as literally described (full SVDAG is research-grade, hard to build/debug/serialize in JS) | **Reuse the pattern, not the data structure**: small voxels as flat-typed-array DATA (not DAG), chunked (32³–128³), LOD via density-thresholded downsample, occlusion via a coarse hierarchical depth/occupancy pre-pass. This is the right ambition level for a teaching lab |
| **Zeux / Kapoulkine efficient meshing & row-packing** | Greedy meshing (0fps/Lysenko) for triangle-count reduction; per-row RLE packing for memory (2.97 → 0.49 bytes/voxel measured); physics deliberately decoupled from render mesh (8³ physics chunks vs. full greedy-meshed render chunks) | Excellent — pure CPU/worker-friendly, standard indexed-triangle output, no exotic GPU features | **Adopt directly.** Greedy meshing + row-packing are the two highest-leverage, lowest-risk techniques available; steal both verbatim as the Tier-2 default |
| **Browser constraints (WebGL2/WebGPU, mobile memory, workers)** | WebGPU is Baseline-ish in 2026 but Firefox ships it off by default; WebGL2 is the universal floor; iOS Safari is documented unstable above ~300 MB; `MAX_3D_TEXTURE_SIZE` defaults to 256 on many devices; worker + transferable `ArrayBuffer` meshing is the standard modern pattern voxel.js lacked | N/A — this is the constraint set itself | **Design floor = WebGL2 + Web Workers + transferable buffers.** WebGPU is an optional Tier-3 upgrade path (Three.js auto-falls-back), never a requirement |

### 2b. Meshing-method matrix (for the render-strategy interface, Section 3)

| Method | Browser-fit | LOD-fit | Cost | Visual character | Kernel role |
|---|---|---|---|---|---|
| Cube / `InstancedMesh` | Excellent, trivial, native to Three.js | Poor (no natural coarsening) | Cheapest CPU, GPU scales with visible-instance count | Maximally blocky (intentional Minecraft-classic look) | **Tier-1 default renderer** |
| Greedy quads | Excellent, pure worker-side meshing, standard indexed triangles | Good (pairs with density-thresholded downsample) | Cheap-moderate, O(voxels) per chunk, once per edit | Blocky but far fewer triangles | **Tier-2 default renderer** |
| Marching cubes | Good, well-documented in Three.js | Moderate (needs seam-stitching across LOD, e.g. Transvoxel) | Moderate-high (interpolation per cell) | Smooth, rounds off sharp features | **Tier-2/3 optional "smooth terrain" module** — this is exactly the technique the Reddit author used for distant LOD and flagged as visually bad; the kernel must budget an explicit LOD-seam test for it (Blocker #3, Slice 4) |
| Dual contouring | Fair, more complex (QEF solve per cell) | Moderate, published seam-handling exists | Higher | Best sharp-feature fidelity, can be non-manifold | **Advanced/optional module, not a default path** |

### 2c. Coarse-lighting-grid options (for Blocker #4)

| Approach | WebGL2 feasibility | Cost | Fit |
|---|---|---|---|
| Light Propagation Volumes (LPV) | High — low-res (32³-64³) 3D texture, ping-pong updates | Cheap, fixed-size regardless of scene complexity | **Kernel default** — matches "occupancy grid doubles as light-injection source" pattern from both the Reddit post and Aokana |
| Voxel Cone Tracing | Moderate — mipmapped 3D radiance texture, per-pixel cone march | Higher, amortized by updating every 3-5 frames | Optional Tier-3 module |
| Baked/precomputed + coarse ambient grid | Trivial | Near-zero | Tier-1 fallback / lowest-fidelity floor |

### 2d. Key lessons for a browser-first lab

1. **Steal ideas, not implementations** from voxel.js — the ecosystem is dead code, but
   the naive→culled→greedy pedagogy is exactly right for a *lab* (Section 4 uses this
   directly as the "change one variable" story).
2. **Steal patterns, not data structures** from SVDAG-class engines — a full SVDAG is
   the wrong investment for a teaching tool; density-thresholded LOD + hierarchical
   occlusion pre-pass is the right *shape* at a much smaller scale.
3. **Greedy meshing + row-packing are the two techniques worth adopting verbatim** —
   both are well-documented, CPU-cheap, and directly measurable (draw-call count,
   bytes/voxel) which makes them ideal *readouts* for the lab's own lesson.
4. **The sibling repo's Stage-16 Voxel Debug Lab (see Section 3) is stronger evidence
   than the Reddit post** — independently inspected this session (read-only, 2026-07-01):
   commit `428a823` (tag `world-builder-stage16-voxel-lab`) and hardening commit
   `3beb468` exist in `webbroswer-assest-creator`, with source at
   `src/voxels/{VoxelGrid,Voxelizer,VoxelRaycast,VoxelTypes}.js` and node-side test
   assertions at `scripts/world-document-regression.mjs:1920-2046`. This session read
   the source and the test assertions directly; it did **not** execute the sibling
   repo's test suite live, so "currently passing" is not independently confirmed here —
   only that the cited tests exist and assert the claimed properties. Treat as
   **inspected, cited prior art**, not as this repo's own tested code — reuse still
   requires porting and re-testing inside this codebase (Slice 1).
5. **WebGL2 + Web Workers + transferable ArrayBuffers is the floor**, not WebGPU — this
   repo has no WebGPU today and no lib-upgrade gate is open; Three.js's own
   WebGPU-with-WebGL2-fallback path is a *future*, not *this*, option.

---

## 3. Voxel Lab Kernel — reusable core + public API surface

### 3.0 What the kernel ports from the sibling project's Stage 16, and what it must add

The sibling repo `webbroswer-assest-creator` (a separate Three.js project — not this
repo) shipped **"Stage 16 — Voxel Debug Lab"** (tag `world-builder-stage16-voxel-lab`,
commit `428a823`, hardening follow-up `3beb468`), a CPU voxelizer + Amanatides-Woo (A-W)
DDA ray traversal debug surface.

**Independently verified this session** (read-only inspection of that repo's working
tree and git history, 2026-07-01): the tag and both commits exist; the source files
`src/voxels/{VoxelGrid,Voxelizer,VoxelRaycast,VoxelTypes,VoxelDebugMesh,
VoxelDebugPanel}.js` exist; node-side assertions covering resolution-cap clamping,
deterministic voxelization, hollow-surface behavior, object/triangle-budget
truncation, non-finite (NaN/Infinity) rejection, and every A-W DDA edge case (miss,
bounds-exit, parallel axis, negative direction, zero-length/non-finite direction,
start-inside-grid) exist at `scripts/world-document-regression.mjs:1920-2046`; a
browser-side proof asserting single-draw-call rendering and cross-run determinism
exists at `scripts/browser-voxel-proof.mjs` (`npm run test:voxel`). **This session
read the source and the test assertions directly; it did not execute the sibling
repo's test suite live**, so "currently green" is not independently confirmed here —
only that the cited tests exist and assert the claimed properties. This is the
single strongest piece of prior art available for this kernel — stronger than the
Reddit post's unverified native-engine claims, and cited rather than merely asserted.

**Directly ported (cited, low-risk — reuse as-is, re-test inside this repo before
relying on it):**

| Stage-16 technique | Where it lands in this kernel |
|---|---|
| Bounded uniform-cubic-cell occupancy grid (`Uint8`/`Uint16`, x-fastest index `x + nx*(y + ny*z)`) | `VoxelGrid` primitive — the per-chunk occupancy store (Section 3.2) |
| Hard resolution/object/triangle caps + a labeled-`break outer` dual-budget abort checked at loop top | The Memory Budgeter's chunk-build guard (Section 3.5) — this is the concrete mechanism that resolves Blocker #1, not just a policy statement |
| Non-finite (NaN/Infinity) input rejection before any allocation | Boundary validation on every public kernel entry point that takes external geometry/params |
| Single capped `InstancedMesh` draw call for occupancy (never mesh-per-voxel) | Tier-1 render strategy (Section 3.3) |
| Amanatides-Woo DDA with every edge case handled explicitly (miss, bounds-exit, parallel axis, negative direction, start-inside, zero-length reject) | The kernel's `raycast()` traversal primitive (Section 3.2) — used for both player interaction picking and (optionally) a Tier-3 raymarch renderer |
| Deterministic occupancy (no RNG/clock in voxel code; byte-identical across runs) | The kernel's tick-determinism contract (Section 3.6) — the exact discipline the headless test harness (Section 7) depends on |
| Isolation via dynamic-import from an editor-only entry point + grep/runtime-flag verification of absence from the shipped bundle | The exact shape of Section 8's "denylisted prefix + upload-list test" guarantee |

**What the kernel must add beyond Stage 16** (Stage 16 has none of these — it is a
single bounded debug grid, not a chunked open world):

- **Chunking across many grids** — Stage 16 is one bounded `VoxelGrid`; the kernel
  needs a chunk manager holding N grids with load/unload/eviction.
- **LOD** — Stage 16 has no coarsening; the kernel adds density-thresholded downsample
  levels per chunk (Section 3.4).
- **Lighting propagation** — Stage 16 has no lighting; the kernel adds the coarse
  light-volume module (Section 3.4), reusing occupancy as the injection source exactly
  as the Reddit post's dual-purpose-occupancy idea describes.
- **Cross-chunk edit receipts** — Stage 16 is single-grid and non-networked; the
  kernel adds the (gated, optional) chunk-hash receipt (Section 4, Section 6).

### 3.1 Data model

Voxels are **internal grid DATA, not mandatory cube meshes.** A chunk owns:

```
Chunk {
  coord: [cx, cy, cz]                // chunk-space integer coordinate
  resolution: int                   // cells per axis, <= kernel cap (see 3.5)
  cellSize: number                  // world units per cell
  occupancy: Uint8Array             // one byte per cell: 0 = empty, >0 = material id (ports Stage-16 VoxelGrid)
  materials: Uint8Array | null      // optional separate material layer (row-packed, see 3.2)
  dirty: boolean                    // needs remesh
  lastEditReceipt: EditReceipt|null // local-only, see 3.7
}
```

This mirrors the Stage-16 `VoxelGrid` shape (occupancy first-class, material data
optional/separate) and the zeux row-packing insight that occupancy and material should
be decoupled so each can be tuned/compressed independently.

### 3.2 Reusable primitives (language-agnostic pseudo-IDL)

```
// --- Grid + occupancy (ports Stage-16 VoxelGrid) ---
createVoxelGrid(aabb: AABB, resolution: int, opts?: { maxResolutionPerAxis?: int }) -> VoxelGrid
  // REJECTS non-finite aabb components before any allocation (Stage-16 rule)
  // CLAMPS resolution to kernel cap (Section 3.5)

setCell(grid: VoxelGrid, x: int, y: int, z: int, materialId: int) -> void
getCell(grid: VoxelGrid, x: int, y: int, z: int) -> int
indexOf(x: int, y: int, z: int, nx: int, ny: int) -> int   // x + nx*(y + ny*z), x-fastest

voxelizeMesh(grid: VoxelGrid, triangles: TriangleList, opts?: { triBudget?: int }) -> VoxelizeResult
  // per-triangle clamped cell-AABB -> triangle-box SAT test (13-axis Akenine-Moller form)
  // inner loop iterates ONLY the triangle's own clamped cell-AABB, never the whole grid
  // aborts via labeled dual-budget break (object cap AND global SAT-test-count cap)

raycast(grid: VoxelGrid, origin: Vec3, dir: Vec3, maxDist: number) -> RayHit | null
  // Amanatides-Woo DDA; handles miss / bounds-exit / parallel-axis (step=0, tMax=tDelta=Infinity)
  // / negative direction / start-inside-grid / zero-length-direction-reject explicitly
  // RayHit = { cell: [x,y,z], face: Vec3, normal: Vec3, distance: number, chunkCoord }

// --- Row-packing (zeux pattern) ---
packRow(row: Uint8Array) -> PackedRow   // 1 byte if uniform, else 2-byte header + full row
unpackRow(packed: PackedRow) -> Uint8Array

// --- Chunking (NEW beyond Stage 16) ---
createChunkManager(opts: { chunkResolution: int, cellSize: number, budget: MemoryBudget }) -> ChunkManager
loadChunk(mgr: ChunkManager, coord: [int,int,int]) -> Chunk
unloadChunk(mgr: ChunkManager, coord: [int,int,int]) -> void
evictLRU(mgr: ChunkManager) -> Chunk[]   // called when budget.usedBytes > budget.ceilingBytes
visibleChunks(mgr: ChunkManager, cameraFrustum, viewDistance) -> Chunk[]

// --- Render strategy (pluggable) ---
interface RenderStrategy {
  name: 'instanced-cubes' | 'greedy-quads' | 'marching-cubes-lod'
  buildRenderable(chunk: Chunk) -> Renderable   // runs in a Web Worker; returns transferable buffers
  drawCallCost(chunk: Chunk) -> int             // used by the live readout panel
}
selectRenderStrategy(tier: 'phone'|'laptop'|'desktop', lodLevel: int) -> RenderStrategy

// --- LOD (NEW beyond Stage 16) ---
downsampleChunk(chunk: Chunk, factor: 2) -> Chunk
  // density-threshold merge (e.g. >=2 of 8 children non-empty => keep), NOT box-filter averaging
computeLodLevel(distanceFromCamera: number, tierConfig) -> int

// --- Coarse lighting grid (NEW beyond Stage 16) ---
createLightVolume(bounds: AABB, resolution: [int,int,int]) -> LightVolume  // e.g. 32^3-64^3
injectFromOccupancy(volume: LightVolume, chunks: Chunk[]) -> void
  // reuses occupancy as BOTH the AO source and the light-propagation energy limiter (dual-purpose, per Reddit post)
propagate(volume: LightVolume, iterations: int) -> void
sampleLight(volume: LightVolume, worldPos: Vec3) -> RGB

// --- Memory budgeter (resolves Blocker #1) ---
interface MemoryBudget {
  ceilingBytes: number
  usedBytes: number
  wouldExceed(candidateBytes: number) -> boolean
}
estimateChunkBytes(chunk: Chunk, includeRenderBuffers: boolean) -> number

// --- Deterministic tick (headless-test contract) ---
tick(world: WorldBench, dt: number) -> void         // NO RNG, NO wall-clock reads inside
getMetrics(world: WorldBench) -> Metrics            // visibleCells, chunkCount, meshCount, drawCalls, frameTimeMs, memBytes, lightGridRes, netPayloadEstBytes
exportExperiment(world: WorldBench) -> string       // Markdown artifact, Section 4

// --- Local-only edit receipt (Section 3.7 / Section 4 / Section 6) ---
computeChunkHash(chunk: Chunk) -> string            // e.g. FNV-1a over packed occupancy (reuses Mind Machine's seeded-hash pattern)
buildLocalEditReceipt(chunk: Chunk, edit: EditOp) -> EditReceipt   // { chunkHash, editOp, ts, public_safe: true }
```

### 3.3 Render-strategy interface — tier-agnostic, pluggable

The kernel does not hard-code a mesher. `selectRenderStrategy(tier, lodLevel)` returns
one of the three strategies from Section 2b's matrix. Tier 1 always gets
`instanced-cubes`. Tier 2 defaults to `greedy-quads` for near LOD and may use
`marching-cubes-lod` for the coarsest tier (this is deliberately the same choice the
Reddit engine made, so Slice 4's LOD-popping harness measures the *exact* failure mode
the author flagged).

### 3.4 Coarse lighting-grid module

A single low-resolution 3D texture (or a 2D-tiled atlas fallback if 3D-texture support
is inconstant — relevant given `MAX_3D_TEXTURE_SIZE` defaults to 256 on many devices),
updated via `injectFromOccupancy` + `propagate`, sampled per-pixel or per-vertex at
render time. This resolves Blocker #4 by construction: lighting cost is fixed by grid
resolution, not by voxel count.

### 3.5 Memory budgeter + chunk eviction (resolves Blocker #1)

Directly ports Stage 16's dual-budget-abort pattern, generalized across chunks:

- Every chunk load/build checks `MemoryBudget.wouldExceed(estimateChunkBytes(...))`
  *before* allocating; if true, the load is refused (labeled-break style, not a
  post-hoc GC hope).
- `evictLRU` runs whenever the budget is exceeded, unloading the least-recently-visible
  chunks first.
- Per-tier ceilings are fixed numbers from Section 5's table — never derived from
  device sniffing (device memory APIs are unreliable / not universally available).
- **Non-finite / hostile-input rejection** is enforced at every kernel boundary that
  accepts geometry, exactly as Stage 16 rejects non-finite AABBs before allocating.

### 3.6 Deterministic tick API (headless-test contract)

`tick(world, dt)` must be pure with respect to time and randomness: no `Date.now()`,
no `Math.random()`, no implicit rAF coupling inside kernel code. This is the same
discipline Stage 16 uses for byte-identical voxelization and the same pattern Node
Hopper/Mind Machine/arcade-studio already use for their own `window.__nh.tick` /
`window.__studio.step` headless harnesses (Section 7 reuses this verbatim).

### 3.7 Local-only edit receipt (kernel-level primitive, product-level meaning in Section 4)

`buildLocalEditReceipt` computes a hash of the affected chunk's packed occupancy
(FNV-1a, same seeded-hash technique already used in Mind Machine) and stamps it with
`public_safe: true`, `ts`, and the edit operation — entirely client-side, no network
call. This is the primitive the optional server tier (Section 6) would later consume
without ever live-syncing raw cells.

---

## 4. Micro World Bench Slice — "Voxel Lab 0: Micro World Bench"

### 4.0 The bounded room

A single finite lab room (e.g. 32m × 32m × 16m, well inside Tier-1/2 budgets), loaded
entirely client-side, no server round-trip to enter. This is a **lab bench**, not a
level — its purpose is to expose the engine as the lesson.

### 4.1 The 8 sub-features (all in-scope for Voxel Lab 0)

1. **Cube-per-cell render** (Tier-1 `instanced-cubes` strategy) — the baseline,
   maximally-blocky, cheapest-possible render path.
2. **Meshed-chunk render** (`greedy-quads` strategy) — same occupancy data, radically
   fewer triangles; the player can toggle between (1) and (2) live and watch draw
   calls / triangle count change in the readout panel.
3. **LOD transition** — swap render strategy or downsample level as the player backs
   away from a chunk; visibly instrumented (Slice 4's dedicated harness measures this).
4. **Coarse lighting grid** — a single light source, propagated through the occupancy
   grid at a fixed low resolution; readout shows grid resolution and update cadence.
5. **Occupancy-occlusion approximation** — reuse the same occupancy data for a cheap
   AO term (dual-purpose pattern from the Reddit post), instrumented as its own
   before/after toggle.
6. **Memory-per-cell estimate** — live `estimateChunkBytes` readout, comparing raw
   (unpacked) vs. row-packed bytes/voxel, directly surfacing the zeux 2.97→0.49
   bytes/voxel result as something the player *sees happen* to their own room.
7. **Server-confirmed edit receipt (gated/optional)** — OFF by default; when a
   separately-gated Tier exists, an edit produces a `buildLocalEditReceipt` locally,
   and *optionally* a server confirms it reusing the city-stewardship
   ephemeral-receipt shape (Section 6). No live cell sync ever.
8. **Obsidian export of the experiment** — a downloadable `.md` artifact (Section 4.3).

### 4.2 Live readouts (the lesson, shown as UI, not hidden)

| Readout | Source |
|---|---|
| Visible cells | `visibleChunks(...)` × cells-per-chunk at current LOD |
| Chunk count (loaded / visible) | `ChunkManager` state |
| Mesh count | Render-strategy output count |
| Draw calls | `RenderStrategy.drawCallCost` summed, or Three.js `renderer.info.render.calls` (same accessor pattern as arcade-studio's `window.__studio.drawCalls()`) |
| Frame time (ms) | `performance.now()` delta around `tick()`, exposed via `getMetrics()` |
| Memory estimate | `estimateChunkBytes` summed across loaded chunks |
| Lighting-grid resolution | `LightVolume` dimensions + update cadence (every N frames) |
| Network payload estimate | Size of the *receipt* (hash + metadata), NOT raw voxel data — shown as ~tens of bytes to make the "we never sync raw cells" lesson visible by contrast |

### 4.3 One concrete first lesson (physics lab)

**Lab: "How much does lighting resolution actually cost?"**

> **Illustrative, not measured.** Nothing under `labs/` exists yet — no slice in
> Section 7 is authorized by this document. The walkthrough and sample artifact below
> describe the *intended lesson design*, not a report from a running system. Every
> numeric value shown (frame time, bytes, draw calls) is a **target-budget example**
> chosen to be consistent with Section 5's tier budgets, not a measurement. Slice 5's
> headless harness (Section 7) will produce the real numbers once built.

1. Player enters the bounded room. Default state: `lightGridResolution = 16³`,
   greedy-quads render, LOD off (room is small enough to stay at full resolution).
2. Player drags a single slider: **lighting-grid resolution** (e.g. 8³ → 16³ → 32³ →
   64³) — the ONE variable being changed.
3. Live readouts update in real time: lighting-grid resolution, frame time (ms),
   memory estimate (bytes for the light volume). The player *watches* frame time climb
   and memory climb as resolution goes up, with the visual quality gain (softer
   shadows, better color bleed) shown side-by-side.
4. Player clicks **Export to second brain**. This calls `exportExperiment(world)`,
   producing a Markdown artifact (pattern below, adapted from Mind Machine's existing
   JSON export seam at `game/theincrediblemindmachine/index.html:1241-1282`, but as
   `.md` not `.json`):

```markdown
# Voxel Lab 0 Experiment — Lighting Resolution Cost

## Metadata
- Date: 2026-07-01T00:00:00Z
- Room: 32m x 32m x 16m, chunk resolution 32
- Render strategy: greedy-quads

## What I changed
- lightGridResolution: 16 -> 64 (one variable)

## What I measured (ILLUSTRATIVE TARGET-BUDGET EXAMPLE — not yet measured)
| lightGridResolution | frameTimeMs | lightVolumeBytes | drawCalls |
|---|---|---|---|
| 16 | 4.1 | 4,096 | 212 |
| 32 | 6.8 | 32,768 | 212 |
| 64 | 14.2 | 262,144 | 212 |

## The lesson
Draw calls didn't change — only frame time and memory did. Lighting cost scales with
grid RESOLUTION, not with how many voxels are visible. This is why the coarse-grid
trick works: you buy most of the visual quality at 32^3 for a fraction of the cost of
64^3.

## Reproduction
    world.setLightGridResolution(32);
```

   (Again: the `frameTimeMs` / `lightVolumeBytes` values above — 4.1 / 6.8 / 14.2 ms —
   are illustrative target-budget placeholders consistent with Section 5's Tier-2
   table, not results measured from a running implementation. This plan does not
   claim they exist yet; Slice 5 will produce the real numbers once built.)

5. This artifact is a plain file download (`Blob` + `URL.createObjectURL`, same
   mechanism as the existing JSON export), landable directly in an Obsidian vault by
   the player. No account, no server round-trip.

### 4.4 The local-only edit receipt, and how a server tier attaches later (without live cell sync)

- **Today (Tier 1/2, this plan):** every edit (place/remove voxel) produces
  `buildLocalEditReceipt(chunk, edit)` = `{ chunkHash, editOp, ts, public_safe: true }`,
  stored only in local state / IndexedDB. Nothing leaves the browser.
- **Later (separately gated, optional):** a server tier could reuse the *exact* shape
  of `arcade/city/city-interaction-receipts.mjs` — client sends `{ chunkHash, editOp }`,
  server validates against its own canonical bench-room definition (pure function,
  no live world state), and returns an ephemeral receipt
  `{ receipt_id, accepted, reason, issued_at, public_safe: true }`. The server **never
  receives or stores the raw voxel array** — only a hash and a small edit descriptor,
  exactly mirroring how `city-interaction-receipts.mjs` never mutates a ledger or
  economy. This is a strictly later, strictly optional, strictly separate gate — it is
  named here only to show the seam exists and is safe, not to authorize building it.

---

## 5. Fidelity Tiers + Performance Budgets

### Tier 1 — Browser-safe voxel-look lab (phone, incl. mobile Safari)

| Budget | Value | Rationale |
|---|---|---|
| Total JS+WASM+GPU memory | ≤ 150 MB target, 250 MB hard ceiling | iOS Safari documented unstable above ~300 MB; WASM `maximum` near 2GB fails outright on iOS 16.2. Silent tab-reload is the failure mode, not a catchable error — budget well under the wall |
| Max visible cells | ≤ 65,536 (e.g. one 32³ chunk fully resolved, or several coarser) | Keeps `InstancedMesh` instance count small and cheap |
| Max loaded chunks | 1–4 | Bounded room fits in 1; margin for LOD parent/child |
| Render strategy | `instanced-cubes` only | Cheapest possible; no worker meshing required |
| Draw-call cap | ≤ 50 | Mobile GPUs are draw-call-sensitive; one `InstancedMesh` per material class |
| Target FPS | 30 (floor), 60 (target) | Conservative for older phone GPUs |
| Lighting-grid resolution | 8³–16³ | Cheapest LPV tier; baked/precomputed fallback if even this is too costly |
| Voxel size / world extent | 0.5–1 m voxels, room-scale only (tens of meters) | 0.1 m at 16 km is explicitly NOT phone-grade (Blocker #7) — this tier does not attempt that scale at all |

### Tier 2 — Micro-voxel-data / meshed-render (laptop/desktop browser)

| Budget | Value | Rationale |
|---|---|---|
| Total JS+WASM+GPU memory | ≤ 500 MB target, 1 GB soft ceiling | Avoids background-tab eviction risk on 8GB-RAM machines; still one browser tab, not a native process |
| Max visible cells | ≤ 2,000,000 (post row-packing, across all loaded chunks) | zeux's ~0.49-2 bytes/voxel packed rate keeps this inside the memory ceiling |
| Max loaded chunks | ≤ 64 (e.g. 32³ chunks tiling the bounded room + margin) | Bench room is finite (Blocker #5) — no streaming-shard system yet |
| Render strategy | `greedy-quads` default; `marching-cubes-lod` optional for coarsest tier only | Matches Section 2b/3.3 |
| Draw-call cap | ≤ 300 | Desktop-class integrated GPUs handle this comfortably |
| Target FPS | 60 | |
| Lighting-grid resolution | 32³–64³ | LPV, updated every 3-5 frames, not every frame |
| Voxel size / micro-detail | 0.1–0.2 m voxels, room/bench scale (tens of meters), NOT kilometers | Reddit engine's 0.1 m figure is reused only at bench scale, never at 16 km scale in-browser |

### Tier 3 — Native / WebGPU / WASM (explicitly later, not this plan)

| Budget | Value | Rationale |
|---|---|---|
| Status | Out of scope for this plan | No WebGPU in repo today (ground truth); any adoption is a separate lib-upgrade gate |
| Placeholder budget | 1-2 GB+ VRAM, compute-driven chunk streaming | For future reference only, informed by Aokana's ~424 MB VRAM / tens-of-billions-of-voxels figure — NOT a commitment |

---

## 6. Authority Boundary — LOCAL-ONLY vs SERVER-AUTHORITATIVE

| Concern | LOCAL-ONLY (this plan, default) | SERVER-AUTHORITATIVE (later, separately gated) |
|---|---|---|
| Voxel occupancy data (raw cells) | ✅ Lives only in browser memory / IndexedDB | ❌ NEVER sent or stored server-side, in this plan or any later tier |
| Chunk hash (FNV-1a over packed occupancy) | ✅ Computed locally | Could optionally be sent to a future receipt endpoint — hash only, never raw cells |
| Edit receipts | ✅ `buildLocalEditReceipt` is a pure local function | Optional future tier reuses `city-interaction-receipts.mjs` ephemeral-receipt shape (ACK-only, `public_safe: true`, no ledger) |
| Experiment measurements (frame time, memory, draw calls) | ✅ Local, exported as Markdown | Never server-side in any tier described here |
| Obsidian export artifact | ✅ Client-side `Blob` download | Never touches a server |
| World event log (append-only, city-style) | Optional local-only log of experiment events, mirroring `city-events.mjs` shape, in-memory/IndexedDB only | Not server-side in this plan |
| Live world loader | Untouched | `LIVE_WORLD_LOADER_ENABLED` stays `false`; this plan never proposes flipping it, and no slice in Section 7 touches `arcade/creator/approval/approved-loader.mjs` |
| Economy / tickets / minors data | Out of scope entirely | Out of scope entirely, in this plan and any later tier described here |
| Cloudflare Worker / Durable Object / D1 / R2 config | Untouched | Any future server-receipt tier would need its own DO (new, isolated) and its own gate — not authorized by this document |

**Default posture: everything is local-only.** The server column exists only to show
the seam is safe *if and when* a future gate authorizes it — it grants nothing today.

---

## 7. Implementation Plan — small GATED slices, each with tests

All code in this section lives under a **denylisted lab-only prefix**:
`labs/voxel-bench/` (new prefix; see Section 8 for exactly how it becomes denylisted).
Each slice is its own branch, its own PR, its own `AUTHORIZED: BUILD SLICE N` gate —
**this document authorizes none of them**. Every slice is also framed as a standalone
learning lab per Blocker #8 — none of them are "pure engine work with no lesson."

Test infrastructure reused as-is:
- **Node 22 unit tests**: `node --test` against pure `.mjs` kernel modules (mirrors
  `arcade/city/city-block.mjs`'s dual-run pure-function pattern).
- **Headless browser tests**: Playwright + cached chromium, swiftshader flags
  (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
  --ignore-gpu-blocklist`), `NODE_PATH=$PWD/node_modules`, serving `game/` (or
  `labs/voxel-bench/`) as web root so `../vendor/` resolves — same recipe as
  `arcade-studio/scripts/smoke-headless.mjs`.
- **Deterministic tick hook**: `window.__bench.tick(dt)` / `window.__bench.getMetrics()`
  / `window.__bench.roundTrip()`, mirroring `window.__nh.tick` and
  `window.__studio.step`.

### Slice 0 — Kernel scaffolding + denylist entry (prerequisite, no rendering yet)

- **Goal:** Add `labs/` to `FORBIDDEN_UPLOAD_PREFIXES`; scaffold
  `labs/voxel-bench/src/bench-core.mjs` with `VoxelGrid`, `setCell`, `getCell`,
  `indexOf` only (port of Stage-16's occupancy primitive, no voxelization/raycast yet).
- **Lesson framing:** "What does a voxel actually cost in bytes?" — a Node-only CLI
  demo printing raw-vs-packed byte counts for a hand-built grid.
- **Files:** `scripts/build-curated-client-upload.mjs` (one-line denylist addition),
  `labs/voxel-bench/src/bench-core.mjs`, `labs/voxel-bench/test/bench-core.test.mjs`.
- **Tests:**
  - `node --test labs/voxel-bench/test/bench-core.test.mjs`: `setCell`/`getCell`
    round-trip; non-finite AABB input rejected before allocation; resolution clamp
    enforced (mirrors Stage-16's config-cap test).
  - `node scripts/build-curated-client-upload.mjs --list | grep -c '^labs/'` → asserts
    `0` (proves the new prefix ships nothing, before any bench file exists).
- **Done-criteria:** both tests pass; `git diff` touches only the two named files plus
  new test-only additions; no `game/`, `workers/`, or `arcade/` files touched.

### Slice 1 — Voxelization + A-W raycast (direct Stage-16 port)

- **Goal:** Port `voxelizeMesh` (triangle-box SAT, clamped per-triangle cell-AABB,
  labeled dual-budget abort) and `raycast` (Amanatides-Woo DDA, all edge cases) from
  the sibling repo's Stage 16, adapted to this repo's module conventions.
- **Lesson framing:** "Turn any shape into voxels, then shoot a ray at it" — a debug
  page where the player voxelizes a simple mesh and clicks to raycast-highlight cells,
  watching hit/miss/edge-case behavior directly.
- **Files:** `labs/voxel-bench/src/voxelize.mjs`, `labs/voxel-bench/src/raycast.mjs`,
  `labs/voxel-bench/test/voxelize.test.mjs`, `labs/voxel-bench/test/raycast.test.mjs`.
- **Tests (ported from the assertions cited at `scripts/world-document-regression.mjs:1920-2046`
  in the sibling repo — re-verify against this repo's own port before relying on them):**
  - Byte-identical voxelization across repeated runs (determinism).
  - Hollow-surface case produces expected interior-empty result.
  - Object-count / resolution-cap / triangle-budget enforcement (labeled-break abort
    fires, does not exceed budget under adversarial input).
  - Non-finite geometry guard (rejected, no allocation, no crash).
  - Every A-W DDA edge case against a hand-built single-voxel grid: miss, bounds-exit,
    parallel axis (no divide-by-zero), negative direction, start-inside-grid,
    zero-length-direction reject.
- **Done-criteria:** all listed tests pass; no dependency on chunking/LOD/lighting
  (none exist yet, matching Stage 16's own scope).

### Slice 2 — Instanced-cube render + headless smoke (Tier-1 renderer)

- **Goal:** Wire `VoxelGrid` occupancy to a single `THREE.InstancedMesh` (r152 ES
  module, matching Mind Machine / arcade-studio's version choice — see Ground Truth
  correction in prior-art scan), one draw call for the whole bounded room at Tier-1
  budgets.
- **Lesson framing:** the Section 4.3-style lab, but scoped down to "why is instancing
  one draw call instead of thousands?" — toggle instancing on/off, watch draw calls.
- **Files:** `labs/voxel-bench/index.html`, `labs/voxel-bench/src/render-instanced.mjs`,
  `labs/voxel-bench/scripts/bench-headless.mjs` (adapted from
  `arcade-studio/scripts/smoke-headless.mjs`).
- **Tests:**
  - Headless: `window.__bench.ready === true`; WebGL2 context obtained; `drawCalls()
    === 1` (or the fixed material-class count) at full room occupancy; no console
    errors; `roundTrip()` (export→reimport of room state) is stable.
  - Node: `estimateChunkBytes` for the fixed bench room stays under the Tier-1 memory
    budget (Section 5) — assert numerically, not just "seems fine."
- **Done-criteria:** headless smoke green; memory assertion passes; zero CDN references
  in the served HTML (`grep -c 'cdn\.' labs/voxel-bench/index.html` → 0), matching the
  repo's existing vendoring discipline.

### Slice 3 — Greedy-quads mesher + row-packing (Tier-2 renderer)

- **Goal:** Implement greedy meshing (0fps algorithm) as a Web Worker producing
  transferable `Float32Array`/`Uint16Array` buffers; implement row-packing
  (`packRow`/`unpackRow`) per zeux's scheme.
- **Lesson framing:** the direct "cube-per-cell vs. meshed" toggle from Section 4.1
  item 2 — same occupancy, radically different triangle/draw-call count, shown live.
- **Files:** `labs/voxel-bench/src/mesh-greedy.mjs`,
  `labs/voxel-bench/src/pack-rows.mjs`, corresponding `.test.mjs` files, a Web Worker
  entry `labs/voxel-bench/src/workers/mesh-worker.mjs`.
- **Tests:**
  - Node: greedy-mesh quad count matches known fixtures (simple shape, sphere-ish
    fixture) within the published ~8×-of-optimal bound; row-packing round-trips
    (`unpackRow(packRow(row))` byte-identical); packed-bytes/voxel measured on a
    fixture and asserted below a threshold (proves the ~6× reduction claim on *this*
    codebase, not just cited from zeux).
  - Headless: draw-call count strictly lower than Slice 2's instanced baseline for the
    same room at the same LOD; frame time within Tier-2 budget.
- **Done-criteria:** both toggles (instanced vs. greedy) render the same visual room;
  readout panel shows the delta; tests above green.

### Slice 4 — LOD transition + LOD-popping visual/measurement harness (Blocker #3, early per operator instruction)

- **Goal:** Implement `downsampleChunk` (density-threshold merge) and
  `computeLodLevel`; build a **dedicated harness that measures LOD popping**, not just
  "LOD exists." This directly targets the Reddit author's unresolved complaint.
- **Lesson framing:** "Watch the seam" — the bench deliberately puts a LOD boundary in
  the player's view and lets them walk across it while the readout panel shows current
  LOD level per visible chunk; this *is* the lesson (LOD transitions have a real,
  visible cost/quality tradeoff, not a hidden one).
- **Files:** `labs/voxel-bench/src/lod.mjs`,
  `labs/voxel-bench/scripts/lod-pop-harness.mjs` (headless, captures per-frame
  screenshots or pixel-diff across a scripted camera path crossing an LOD boundary),
  `labs/voxel-bench/test/lod.test.mjs`.
- **Tests:**
  - Node: `downsampleChunk` density-threshold merge matches fixtures (e.g. "≥2 of 8
    children non-empty ⇒ keep" produces the expected coarse grid for a known fine
    grid).
  - Headless LOD-pop harness: scripted camera crosses a chunk boundary over N frames;
    assert (a) frame time stays within Tier-2 budget through the transition (no spike
    beyond a fixed multiple of baseline), (b) a pixel-difference metric between
    consecutive frames stays under a fixed threshold except at the one designated
    transition frame (i.e., "popping" is measured as an unexpected large frame-to-frame
    delta, and the test fails if it occurs anywhere *other* than the expected LOD
    switch point).
- **Done-criteria:** LOD-pop harness runs headlessly in CI-equivalent (`npm run
  test:*`), produces a numeric popping-magnitude readout, and that number is recorded
  in the slice's PR description as a baseline for future comparison — this is
  deliberately the harness the Reddit engine never showed us it had.

### Slice 5 — Coarse lighting grid (LPV) + dual-purpose occlusion (Blocker #4)

- **Goal:** Implement `createLightVolume`, `injectFromOccupancy`, `propagate`,
  `sampleLight`; wire occupancy to double as both AO input and light-propagation
  limiter.
- **Lesson framing:** exactly the Section 4.3 worked example ("how much does lighting
  resolution actually cost") — this slice *is* that lab.
- **Files:** `labs/voxel-bench/src/light-volume.mjs`,
  `labs/voxel-bench/test/light-volume.test.mjs`.
- **Tests:**
  - Node: `injectFromOccupancy` + `propagate` on a fixture grid produces expected
    relative brightness ordering (cells nearer the light source brighter than farther
    ones, occluded cells darker) — a correctness smoke test, not exact-value matching.
  - Headless: at each of the Section 5 tier resolutions (8³/16³/32³/64³), measure and
    assert frame time stays within that tier's budget; assert draw-call count is
    *unchanged* by lighting-resolution changes (proves the "lighting cost is decoupled
    from draw calls" lesson numerically).
- **Done-criteria:** the four-row table in Section 4.3's example is reproducible by
  running this slice's headless script and matches (numerically, not exactly) the
  qualitative shape shown there.

### Slice 6 — Memory budgeter + chunk eviction (Blocker #1, hardening pass)

- **Goal:** Wire `MemoryBudget` enforcement into `ChunkManager.loadChunk` /
  `evictLRU`; add adversarial tests (many small edits, room larger than one chunk).
- **Lesson framing:** "Break the budget on purpose" — a debug control that lets the
  player force-load chunks until the budget refuses, watching the eviction readout.
- **Files:** `labs/voxel-bench/src/chunk-manager.mjs`,
  `labs/voxel-bench/test/chunk-manager.test.mjs`.
- **Tests:**
  - Node: adversarial load sequence exceeding `ceilingBytes` triggers `evictLRU`
    before the ceiling is crossed, never after (assert `usedBytes <= ceilingBytes` at
    every step, not just at the end).
  - Per-tier budget assertion: running the full bench room at Tier-1 config never
    exceeds 250 MB estimated; at Tier-2 config never exceeds 1 GB estimated (numeric
    assertions against Section 5's table, not descriptive claims).
- **Done-criteria:** budget invariant holds under the adversarial sequence; both tier
  ceilings pass numerically.

### Slice 7 — Obsidian Markdown export (Section 4.3 artifact)

- **Goal:** Implement `exportExperiment(world)` producing the Markdown shape shown in
  Section 4.3; wire a UI export button.
- **Lesson framing:** this slice *is* the "second brain" seam — no separate lesson
  needed, it is the closing step of every other lab.
- **Files:** `labs/voxel-bench/src/export-markdown.mjs`,
  `labs/voxel-bench/test/export-markdown.test.mjs`.
- **Tests:**
  - Node: given a fixed metrics-history fixture, `exportExperiment` produces
    byte-identical Markdown across repeated calls (determinism, same discipline as
    Stage-16 voxelization); output contains required sections (Metadata, What I
    changed, What I measured, The lesson, Reproduction) via string/section assertions.
  - Headless: clicking export in the bench triggers a `Blob` download event (assert
    `download` attribute set, MIME type `text/markdown`, no network request fired
    during export — i.e., assert local-only by observing zero XHR/fetch during the
    export action).
- **Done-criteria:** export is fully client-side (network-silence assertion passes);
  Markdown is valid GFM (lint-checkable).

### Slice 8 (optional, separately gated, NOT authorized by this plan) — local-edit-receipt scaffolding only

- **Goal:** Implement `buildLocalEditReceipt` / `computeChunkHash` as pure local
  functions (Section 3.7) — **no network call, no server code, no DO.** This slice
  stops at the local primitive; wiring it to any server endpoint is explicitly a
  separate future gate, not part of this plan.
- **Lesson framing:** "What would we send if we ever synced this?" — the bench can
  display the *would-be* receipt payload size (tens of bytes) next to the actual raw
  voxel data size (kilobytes-megabytes), making the "we never sync raw cells" lesson
  visible even before any server exists.
- **Tests:** Node-only; hash determinism (same chunk → same hash); receipt shape
  matches `{ chunkHash, editOp, ts, public_safe: true }`; assert no `fetch`/`XHR`
  symbol is referenced anywhere in this slice's source (`grep -L`).
- **Done-criteria:** entirely local; zero network code exists in the diff.

---

## 8. Lab-Only / No-Deploy Guarantee

1. **Denylisted prefix.** `labs/` is added to `FORBIDDEN_UPLOAD_PREFIXES` in
   `scripts/build-curated-client-upload.mjs` as Slice 0's *first* change, before any
   bench code exists — the denylist entry lands empty and stays proven-empty as code
   is added.
2. **No `PUBLIC_CREATOR_ALLOW` carve-out.** Nothing under `labs/` is added to the
   exact-match allow-list; the existing script already fails the build if a denylisted
   path is force-included, so this is enforced by the tool that already exists, not by
   a new one.
3. **The upload-denylist test that proves it** (run at the end of every slice):
   ```bash
   node scripts/build-curated-client-upload.mjs --list | grep -c '^labs/'
   ```
   Expected output: `0`, in every slice from Slice 0 onward. This is the same
   verification pattern already used for `arcade-studio/` (confirmed present, per
   Section on repo prior art) and the sibling repo's Stage-16 isolation check.
4. **No Worker/DO/D1/R2 edits.** No slice in Section 7 touches anything under
   `workers/`, no new Durable Object class, no `wrangler.toml`/`wrangler.jsonc` change.
   Slice 8 (the only slice that even mentions a server) explicitly stops at a local
   pure function.
5. **`LIVE_WORLD_LOADER_ENABLED` untouched.** No slice edits
   `arcade/creator/approval/approved-loader.mjs`; grep-verify at the end of the full
   sequence: `git diff main...HEAD -- arcade/creator/approval/approved-loader.mjs`
   produces no output.
6. **No economy/ticket/minors-data code.** No slice touches
   `arcade/city/city-interaction-receipts.mjs` or any ledger/ticket module — Section 6
   only *references* their shape as a future-seam design note, never imports or
   modifies them.
7. **Test-suite non-regression.** The existing 1297/1297 Node test count must remain
   1297 + (new bench tests) / all passing — no existing test is modified or deleted by
   any slice.
8. **No deploy commands run.** No slice's done-criteria includes `wrangler deploy`,
   `wrangler pages deploy`, or any production upload script invocation. Verification is
   local: `npm run test:unit`, `node labs/voxel-bench/scripts/bench-headless.mjs
   <local-dev-server-url>`.

---

## Hard-Blocker Resolution Table

| # | Blocker | Resolution in this plan |
|---|---|---|
| 1 | Memory: 3.2 GB not public-browser-safe | Hard per-tier ceilings (Section 5: 250 MB phone / 1 GB laptop-desktop), enforced by `MemoryBudget` + `evictLRU` (Section 3.5), tested adversarially (Slice 6). Never budget off the Reddit engine's native 3.2 GB figure |
| 2 | GPU API: native/Metal-adjacent, not browser JS | WebGL2 + Three.js r152 (already vendored ES module) is the mandatory floor for every tier in this plan; WebGPU is explicitly out of scope (Section 5, Tier 3 placeholder only), no lib-upgrade gate opened |
| 3 | LOD popping: transition popping remains unresolved even by the source author | Slice 4 builds a dedicated headless LOD-pop measurement harness (frame-time-spike + pixel-delta assertions) BEFORE claiming LOD "works" — the popping magnitude becomes a tracked, numeric baseline, not a hidden defect |
| 4 | Lighting cost: good lighting needs tricks | Coarse light-volume (LPV) module (Section 3.4, Slice 5) fixed at 8³-64³ resolution depending on tier; cost is decoupled from voxel/draw-call count by design, and Slice 5's tests assert that decoupling numerically |
| 5 | Infinite terrain: perf-difficulty multiplier | Finite bounded lab room only (Section 4.0: ~32×32×16 m); Section 7/Section 8 explicitly list "no infinite terrain" as NOT in scope; active shards/streaming are a named future gate, not this plan |
| 6 | Network sync: micro-voxel deltas can explode | Section 6's authority table: raw occupancy NEVER server-side, ever, in this plan; only chunk hashes + small edit descriptors in the optional future receipt tier (Section 3.7, Section 4.4, Slice 8), reusing the city-stewardship ephemeral-receipt shape which already proves this pattern works without a ledger |
| 7 | Phone support: 0.1 m voxels at 16 km not phone-grade | Section 5's fidelity tiers: Tier 1 (phone) uses 0.5-1 m voxels at room scale only; the Reddit engine's 0.1 m/16 km numbers are never applied below Tier 2, and even Tier 2 caps micro-detail at room/bench scale, not kilometers |
| 8 | Product drift: engine work can consume everything | Every slice in Section 7 has an explicit "Lesson framing" line stating what the player learns from that exact slice; Slice 8 (the closest thing to "pure infra") is scoped to a local-only primitive whose stated purpose is illustrating the network-payload lesson, not shipping a server |

---

## NOT in scope / NO

- No MMO / no persistent multiplayer voxel world.
- No infinite or unbounded terrain generation.
- No live cell sync of any kind (server never receives raw occupancy data, in this plan
  or the described future tier).
- No phone-grade micro-voxel-at-kilometer-scale rendering (Tier 1 stays at
  room-scale, coarse voxels).
- No economy, ticket, or minors-data coupling anywhere in this plan.
- No WebGPU adoption or Three.js version upgrade (r152 ES module, already vendored, is
  the target for all new code in this plan).
- No Worker/Durable Object/D1/R2/wrangler config changes.
- No flipping of `LIVE_WORLD_LOADER_ENABLED`.
- No production deploy, upload, or Cloudflare Pages/Workers release of any kind.

---

## Open Questions for the Operator

1. **Lesson domain for Voxel Lab 0's launch example** — this plan used "lighting
   resolution cost" (a physics/perf lab) as the concrete first lesson (Section 4.3).
   Should the launch lesson instead be biology/networking/history/mental-state themed
   per the product's broader catalog, with the lighting-cost lab held as a *second*
   example?
2. **Room authoring** — should the bounded 32×32×16 m room be hand-authored (fixed
   geometry, like Mind Machine's 20 hand-tuned levels) or procedurally voxelized from
   an existing arcade-studio asset (reusing Slice 1's `voxelizeMesh` on, say, an
   existing cabinet model)?
3. **UI ownership** — does the readout panel (draw calls / frame time / memory / LOD /
   lighting-grid resolution) get its own reusable component shared with future labs, or
   is it scoped to `labs/voxel-bench/` only for now?
4. **`labs/` as a new standing prefix** — this plan proposes `labs/` (not
   `arcade/hiveworld-agents/`-style naming) as a new denylisted top-level prefix for
   *all* future experimental engine labs, not just voxels. Confirm this naming/scope
   choice before Slice 0, since it's a durable repo convention, not a one-off.
   Alternatively, `arcade/labs/` would nest under the existing `arcade/` denylist
   namespace instead of adding a new top-level prefix — operator preference?
5. **Slice granularity approval** — should Slices 0-7 be gated individually (8 separate
   `AUTHORIZED: BUILD SLICE N` approvals) or batched into 2-3 larger gates (e.g.
   "kernel + Tier-1 render" as one gate, "LOD + lighting" as another)?
6. **Sibling-repo code reuse mechanics** — Stage 16 lives in a *separate* repository
   (`webbroswer-assest-creator`). Should Slice 1 literally copy/adapt its source files
   (with attribution in a comment), or re-derive the same algorithm independently to
   avoid any cross-repo dependency/licensing ambiguity? Confirm before Slice 1.
7. **Export format scope** — Section 4.3's Markdown export is proposed as the only
   export format. Should Slice 7 also offer a JSON sibling (matching Mind Machine's
   existing pattern) for programmatic reuse, or stay Markdown-only per the "second
   brain" framing?
8. **Test-count target** — should each slice's done-criteria include a specific
   minimum new-test count (e.g. "≥8 new node:test cases"), or is "tests as specified
   per slice above, all green" sufficient without a numeric floor?

---

## Operator Decisions (Recorded 2026-07-01)

The eight open questions above are answered. These answers are binding on Section 7
and any future `BUILD` gate; they supersede the corresponding open question rather
than removing it, so the historical record above stays intact.

1. **Launch lesson domain:** keep "lighting-resolution cost" (Section 4.3) as the
   launch lesson. It teaches the engine itself, gives measurable performance output,
   and validates the micro-voxel thesis before domain lessons (biology / networking /
   history / mental-state) are attempted.
2. **Room authoring:** hand-authored first. Slice 0/2 must not depend on procedural
   voxelization of an existing arcade-studio asset — a hand-authored room gives
   deterministic fixtures, smaller tests, easier visual regression, and fewer
   unknowns. Procedural voxelization (Slice 1's `voxelizeMesh` applied to a real
   asset) is a later lab, not part of the launch slice.
3. **Readout panel:** a shared component scoped to the `labs/` namespace — built so
   future labs can reuse it, but **not** wired into Neon Circuit city UI or general
   arcade UI at this time.
4. **Prefix naming:** top-level `labs/` (not nested under `arcade/`), since `arcade/`
   sits closer to production upload paths and `labs/` is cleaner as a dedicated
   denylisted research/prototype namespace. A curated-upload assertion that `labs/`
   never ships is required (Section 8 already specifies this test).
5. **Slice-gating granularity:** 3 batched build gates, not 8 individual approvals:
   - `AUTHORIZED: BUILD VOXEL LAB GATE A` — Slices 0–2 (repo placement, schema, static
     fixtures, basic renderer shell, test harness).
   - `AUTHORIZED: BUILD VOXEL LAB GATE B` — Slices 3–5 (meshing/row-packing,
     LOD-popping harness, coarse lighting-grid measurement).
   - `AUTHORIZED: BUILD VOXEL LAB GATE C` — Slices 6–8 (readout panel,
     Markdown/JSON export, docs, final regression, no-upload proof).
6. **Sibling-repo reuse mechanics:** re-derive first; copy/adapt only after exact
   source/test verification. This session already inspected the sibling repo and
   cited exact files/tests (Section 2d item 4, Section 3.0) — that inspection is
   evidence for design purposes, not a license/dependency decision. Slice 1 must not
   create a runtime or build-time dependency on the sibling repo; if source is
   copied/adapted, it is copied as inert text with attribution in an internal
   doc/comment, re-typed and re-tested inside this codebase.
7. **Export format:** Markdown plus a JSON sibling. Markdown serves the Obsidian /
   "second brain" use case; JSON serves replay, tests, receipts, and future
   import/export validation. Slice 7's done-criteria now includes both formats.
8. **Test-count floor:** no numeric minimum. A numeric floor invites junk tests.
   Each slice instead requires these test categories, all green: schema/config
   invariants, bounds/non-finite rejection, renderer sanity, no-upload assertion,
   export validity (where applicable), and browser smoke (where UI exists).

---

## Plan Authority

This document authorizes **no build, no deploy, no live-world-loader change, no
production mutation, and no change to the creator/live-world approval boundary.**
Nothing under `labs/` exists yet. Section 7's slices and Section 5's tier budgets are
a design, not a commitment; each slice/gate below requires its own explicit
`AUTHORIZED:` directive before any file is created. `LIVE_WORLD_LOADER_ENABLED`
(`arcade/creator/approval/approved-loader.mjs`) is not touched by this document and
is not proposed to change by any slice in Section 7.

---

## Next Gate

This document's own next steps, gated individually per the Operator Decisions above
(Section "Operator Decisions," item 5). None of the three is authorized by this
document — each requires its own explicit approval when the operator is ready:

- `AUTHORIZED: BUILD VOXEL LAB GATE A`
- `AUTHORIZED: BUILD VOXEL LAB GATE B`
- `AUTHORIZED: BUILD VOXEL LAB GATE C`
