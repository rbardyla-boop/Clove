/**
 * Voxel Lab Bench — page boot entry point (Gate A Slice 2, extended Gate B Slices 3-5).
 *
 * Externalized (rather than an inline <script> in index.html) so index.html's strict
 * `script-src 'self'` CSP holds with no 'unsafe-inline'/hash/nonce carve-out — the same
 * externalized-entry-point shape arcade-studio/index.html uses for its own main.js.
 *
 * Builds a small, HAND-AUTHORED, fixed occupancy pattern (a "plus" cross via literal
 * setCell calls) and renders it. DEFAULT render strategy remains the unchanged Gate A
 * Tier-1 single-InstancedMesh path ('instanced-cubes'); Gate B Slice 3 adds an OPT-IN
 * Tier-2 greedy-quads path ('greedy-quads') toggled via window.__bench.setRenderStrategy
 * so the SAME occupancy grid can render either way and the readout panel shows the
 * live delta (draw calls / triangle count) between them (plan Section 4.1 item 2 /
 * Section 7 Slice 3 lesson framing). Gate B Slice 4 additively wires a SEPARATE
 * LOD-capable object (never touching the default fixture/instance-count contract) plus
 * a raw-pixel sampling hook so a headless harness can measure LOD-transition popping —
 * see src/lod.mjs and scripts/lod-pop-harness.mjs. Gate B Slice 5 additively wires a
 * coarse light volume (src/light-volume.mjs) over the SAME default fixture grid, driven
 * by window.__bench.setLightGridResolution(n) — this NEVER changes the active render
 * strategy or draw-call count (the light volume is CPU-side-only bookkeeping in Slice 5,
 * not yet sampled by the material/shader), which is itself the numeric proof that
 * lighting cost is decoupled from geometry cost (plan Section 4.3 / Section 7 Slice 5
 * Blocker #4 done-criteria). NO player movement — later slices. Gate E Slice 7
 * additively wires the "Export to second brain" Markdown artifact (src/export-
 * markdown.mjs) behind the #exportBtn button — a ONE-SAMPLE snapshot of the live
 * getMetricsRoom()/getLightMetrics() state, downloaded as a plain .md file via
 * Blob + URL.createObjectURL (plan Section 4.3/4.4), with NO persistent history added.
 *
 * Exposes window.__bench mirroring arcade-studio's window.__studio shape: ready,
 * step(dt), drawCalls(), exportState(), importState(state), roundTrip(), plus the
 * Slice 3 setRenderStrategy()/getRenderStrategy()/meshStats() members, the Slice 4
 * setCameraDistance()/getLodLevel()/samplePixels() members, the Slice 5
 * setLightGridResolution()/getLightMetrics() members, and the Slice 7 exportMarkdown()
 * member.
 */

import * as THREE from '../../../game/vendor/three/three.module-0.152.2.js';
import { VoxelGrid } from './bench-core.mjs';
import {
  buildInstancedVoxelMesh,
  exportGridState,
  importGridState,
} from './render-instanced.mjs';
import { greedyMesh } from './mesh-greedy.mjs';
import { buildGreedyVoxelMesh } from './render-greedy.mjs';
import { downsampleChunk, computeLodLevel, DEFAULT_LOD_TIER_CONFIG } from './lod.mjs';
import {
  createLightVolume,
  injectFromOccupancy,
  propagate,
  estimateLightVolumeBytes,
} from './light-volume.mjs';
import { buildMetricsRoomReport } from './metrics-room.mjs';
import { exportExperiment } from './export-markdown.mjs';

const RENDER_STRATEGIES = Object.freeze(['instanced-cubes', 'greedy-quads']);
const DEFAULT_RENDER_STRATEGY = 'instanced-cubes';

/** Pixel-sample region size for samplePixels() — small and cheap, plenty for a
 * frame-to-frame mean-abs-diff "popping magnitude" metric (Slice 4). */
const SAMPLE_REGION_SIZE = 64;

/** Default light-grid resolution before any setLightGridResolution() call (Slice 5) —
 * matches the Section 4.3 lesson's stated default (`lightGridResolution = 16^3`). The
 * four Section-5-cited tier resolutions (8/16/32/64) are all valid inputs to
 * setLightGridResolution(); this constant is only the initial value. */
const DEFAULT_LIGHT_GRID_RESOLUTION = 16;

/** Fixed propagation iteration count used for every light-volume rebuild — kept
 * constant across resolutions so the lesson's frame-time/byte comparison isolates
 * resolution as the ONE variable being changed (plan Section 4.3 step 2), not a second
 * hidden variable (iteration count) changing alongside it. */
const LIGHT_PROPAGATION_ITERATIONS = 6;

const readout = document.getElementById('readout');

/**
 * Hand-authored, fixed, deterministic occupancy fixture — a small "plus" cross made of
 * literal setCell calls through the grid's three central axes.
 */
function buildFixtureGrid() {
  const aabb = { min: { x: 0, y: 0, z: 0 }, max: { x: 4, y: 4, z: 4 } };
  const grid = new VoxelGrid(aabb, 8, { sourceId: 'gate-a-slice-2-fixture' });
  const mid = Math.floor(grid.nx / 2);
  for (let i = 0; i < grid.nx; i += 1) {
    grid.setOccupied(i, mid, mid, 1);
    grid.setOccupied(mid, i, mid, 1);
    grid.setOccupied(mid, mid, i, 1);
  }
  return grid;
}

/**
 * Hand-authored, fixed, deterministic occupancy fixture for the Slice 4 LOD-capable
 * object — a solid-ish 8x8x8 block (with a couple of holes so the downsampled LOD
 * level is visibly DIFFERENT geometry from the fine level, not just fewer of the same
 * cubes) positioned away from the default "plus" fixture so it never contends with
 * Gate A's drawCalls()/instanceCount() default-state contract. This is the fine (LOD
 * level 0) grid; downsampleChunk(fineGrid, 2) produces the coarse (LOD level 1) grid.
 */
function buildLodFixtureGrid() {
  const aabb = { min: { x: 8, y: 0, z: 0 }, max: { x: 16, y: 8, z: 8 } };
  const grid = new VoxelGrid(aabb, 8, { sourceId: 'gate-b-slice-4-lod-fixture' });
  for (let z = 0; z < grid.nz; z += 1) {
    for (let y = 0; y < grid.ny; y += 1) {
      for (let x = 0; x < grid.nx; x += 1) {
        // Punch a couple of deterministic holes (checkerboard on the bottom layer) so
        // the fine/coarse LOD levels are visibly distinguishable geometry, not merely
        // "same shape, fewer voxels".
        if (y === 0 && (x + z) % 2 === 0) continue;
        grid.setOccupied(x, y, z, 1);
      }
    }
  }
  return grid;
}

/**
 * Build the active renderable for a given strategy against a grid. Returns a shape
 * uniform enough for the boot loop to treat both strategies identically: always
 * { mesh, instanceCount, quadCount, triangleCount } — Tier-1 sets quadCount/
 * triangleCount to 0 (an InstancedMesh has no meaningful "quad" concept of its own),
 * Tier-2 sets instanceCount to 0 for the same reason in reverse. This keeps
 * window.__bench.instanceCount() returning EXACTLY what Gate A returned when the
 * active strategy is (still, by default) 'instanced-cubes'.
 */
function buildRenderableForStrategy(strategy, grid) {
  if (strategy === 'greedy-quads') {
    const meshResult = greedyMesh(grid);
    const built = buildGreedyVoxelMesh(meshResult);
    return { mesh: built.mesh, instanceCount: 0, quadCount: built.quadCount, triangleCount: built.triangleCount };
  }
  const built = buildInstancedVoxelMesh(grid);
  return { mesh: built.mesh, instanceCount: built.instanceCount, quadCount: 0, triangleCount: 0 };
}

function disposeRenderable(renderable) {
  renderable.mesh.geometry.dispose();
  renderable.mesh.material.dispose();
}

function boot() {
  const canvas = document.getElementById('viewport');
  const exportBtn = document.getElementById('exportBtn');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.info.autoReset = false; // reset once per frame so drawCalls() reads a stable value

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d12);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(6, 6, 6);
  camera.lookAt(2, 2, 2);

  // Slice 4's LOD object lives at a separate, non-overlapping AABB (x in [8,16]) so it
  // never contends with the default "plus" fixture's geometry/instance count. A second
  // camera framing looks at the LOD object's BOTTOM EDGE (y=0, where buildLodFixtureGrid
  // punches its deterministic checkerboard holes) so the silhouette difference between
  // the fine grid's jagged edge and the coarse (downsampled) grid's smoothed edge is
  // centered in frame — that edge is exactly what samplePixels() (a small region
  // centered on the canvas) reads, and it is the one part of this object where the two
  // LOD levels are visually distinguishable (both levels render the same flat color, so
  // an interior-only sample would see no difference at all). The lod-pop-harness
  // switches the active camera framing via aimAtLodObject() before driving
  // setCameraDistance() across the LOD boundary.
  const lodObjectBottomEdge = { x: 12, y: 0, z: 4 };
  function aimAtLodObject() {
    camera.position.set(12, 3, 22);
    camera.lookAt(lodObjectBottomEdge.x, lodObjectBottomEdge.y, lodObjectBottomEdge.z);
  }

  let grid = buildFixtureGrid();
  let strategy = DEFAULT_RENDER_STRATEGY;
  let current = buildRenderableForStrategy(strategy, grid);
  scene.add(current.mesh);

  // --- Gate B Slice 4: separate LOD-capable object, additive-only and OPT-IN. It is
  // built lazily and only added to the scene the first time setCameraDistance() is
  // called — until then the scene contains ONLY the default fixture, so Gate A's
  // drawCalls()===1 / instanceCount()===22 default-state contract is untouched (a
  // second always-on mesh in `scene` would make the default drawCalls() become 2).
  const lodFineGrid = buildLodFixtureGrid();
  const lodCoarseGrid = downsampleChunk(lodFineGrid, 2);
  let lodCameraDistance = 0;
  let lodLevel = computeLodLevel(lodCameraDistance, DEFAULT_LOD_TIER_CONFIG);
  let lodRenderable = null;
  let lodActive = false;

  function applyLodLevel(nextLevel) {
    if (lodRenderable) {
      scene.remove(lodRenderable.mesh);
      disposeRenderable(lodRenderable);
    }
    lodLevel = nextLevel;
    lodRenderable = buildInstancedVoxelMesh(lodLevel === 0 ? lodFineGrid : lodCoarseGrid);
    scene.add(lodRenderable.mesh);
  }

  /**
   * setCameraDistance(distance) -> { lodLevel, transitioned }
   *
   * Drives the LOD object's rendered level from a simulated camera distance, per the
   * plan's `computeLodLevel(distanceFromCamera, tierConfig)` contract (Section 3.2 /
   * Section 7 Slice 4). `transitioned` is true exactly on the frame the level actually
   * changes — this is the "one designated transition frame" the lod-pop-harness scripts
   * a camera path across (see scripts/lod-pop-harness.mjs). The LOD object is added to
   * the scene lazily on the FIRST call (opt-in — see comment above); `transitioned` is
   * also true on that first call so a caller can distinguish "object just appeared"
   * from "steady state, no level change".
   */
  function setCameraDistance(distance) {
    lodCameraDistance = distance;
    const nextLevel = computeLodLevel(distance, DEFAULT_LOD_TIER_CONFIG);
    const transitioned = !lodActive || nextLevel !== lodLevel;
    if (transitioned) applyLodLevel(nextLevel);
    lodActive = true;
    return { lodLevel, transitioned };
  }

  /**
   * samplePixels(size=SAMPLE_REGION_SIZE) -> Uint8Array (RGBA, size*size*4 bytes)
   *
   * Raw gl.readPixels() over a small region CENTERED on the canvas (not a corner —
   * the corner is background in every camera framing this bench uses; the center is
   * where aimAtLodObject() actually points the camera at the LOD object, so this is
   * where a real LOD-level geometry change shows up as a pixel delta), for a
   * dependency-free frame-to-frame pixel-difference "popping magnitude" metric (Slice 4
   * done-criteria). Requires the renderer to have been constructed with
   * preserveDrawingBuffer:true (done above) — otherwise the backbuffer would already be
   * cleared by the time this reads it. Caller is responsible for calling step()/
   * render() first so the region reflects the just-rendered frame.
   */
  function samplePixels(size = SAMPLE_REGION_SIZE) {
    const gl = renderer.getContext();
    const w = Math.min(size, canvas.width || size);
    const h = Math.min(size, canvas.height || size);
    const x0 = Math.max(0, Math.floor(((canvas.width || w) - w) / 2));
    const y0 = Math.max(0, Math.floor(((canvas.height || h) - h) / 2));
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixels;
  }

  // --- Gate B Slice 5: coarse lighting grid (LPV) over the DEFAULT fixture grid, driven
  // by setLightGridResolution(). This is CPU-side-only bookkeeping — building/rebuilding
  // the light volume and propagating it never touches `scene`, `current.mesh`, or
  // `strategy`, so the active render strategy and draw-call count are UNCHANGED by any
  // resolution change. That invariant (draw calls constant while resolution/frame-time/
  // memory move) is itself the numeric proof of Blocker #4's "lighting cost is decoupled
  // from voxel/draw-call count" claim (plan Section 4.3 / Section 7 Slice 5).
  let lightGridResolution = DEFAULT_LIGHT_GRID_RESOLUTION;
  let lightVolume = null;
  let lastLightBuildMs = 0;

  function rebuildLightVolume() {
    const buildStart = performance.now();
    lightVolume = createLightVolume(grid.aabb, lightGridResolution);
    injectFromOccupancy(lightVolume, [grid]);
    propagate(lightVolume, LIGHT_PROPAGATION_ITERATIONS);
    lastLightBuildMs = performance.now() - buildStart;
  }
  rebuildLightVolume();

  /**
   * setLightGridResolution(n) -> { resolution, buildTimeMs, lightVolumeBytes, drawCalls }
   *
   * Matches the plan's Section 4.3 Reproduction snippet's exact call shape
   * (`world.setLightGridResolution(32)`) on window.__bench. Rebuilds the light volume
   * at the requested resolution over the CURRENT default fixture grid (inject +
   * propagate, same fixed LIGHT_PROPAGATION_ITERATIONS every time so resolution is the
   * ONE variable under test) WITHOUT touching the active render strategy, scene
   * contents, or draw-call count. Returns the same fields getLightMetrics() reports, for
   * convenience at the call site (e.g. a headless harness driving a resolution sweep).
   */
  function setLightGridResolution(n) {
    lightGridResolution = Math.max(1, Math.trunc(Number(n) || 0) || 1);
    rebuildLightVolume();
    return getLightMetrics();
  }

  /**
   * getLightMetrics() -> { resolution, buildTimeMs, lightVolumeBytes, drawCalls }
   *
   * Readable-together metrics for the Section 4.3 lesson (lighting-grid resolution,
   * frame time, memory estimate) plus the CURRENT draw-call count, specifically so a
   * later slice (Gate C) can build the actual UI/export around this single call without
   * further plumbing changes (per this slice's task framing). `drawCalls` is read live
   * from `renderer.info.render.calls` (same accessor the rest of this file already uses)
   * rather than cached, so it always reflects the ACTIVE render strategy/geometry — the
   * light volume never contributes to it.
   */
  function getLightMetrics() {
    const bytes = estimateLightVolumeBytes(lightVolume);
    return {
      resolution: lightGridResolution,
      buildTimeMs: lastLightBuildMs,
      lightVolumeBytes: bytes.totalBytes,
      drawCalls: renderer.info.render.calls,
    };
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth || 1;
    const h = canvas.clientHeight || window.innerHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function render() {
    renderer.info.reset();
    renderer.render(scene, camera);
  }

  /**
   * meshStats() -> { instancedCubes: {drawCalls, triangleCount}, greedyQuads: {...} }
   *
   * Computes the SAME occupancy grid's stats for BOTH strategies on demand, without
   * mutating the currently-active render — the "readout panel shows the delta between
   * them" requirement (plan Section 7 Slice 3 done-criteria) does not require actually
   * switching the live scene to compute the comparison.
   */
  function computeStrategyDelta() {
    const instancedCount = countOccupiedForDelta(grid);
    const greedyResult = greedyMesh(grid);
    return {
      instancedCubes: { drawCalls: instancedCount > 0 ? 1 : 0, triangleCount: instancedCount * 12 },
      greedyQuads: { drawCalls: greedyResult.quadCount > 0 ? 1 : 0, triangleCount: greedyResult.triangleCount },
    };
  }

  function step(dt = 1 / 60) {
    render();
    if (readout) {
      const delta = computeStrategyDelta();
      const lightMetrics = getLightMetrics();
      readout.textContent =
        `Voxel Lab Bench — Gate B Slice 5\n` +
        `strategy: ${strategy}\n` +
        `instances: ${current.instanceCount}\n` +
        `quads: ${current.quadCount}  triangles: ${current.triangleCount}\n` +
        `drawCalls: ${renderer.info.render.calls}\n` +
        `— delta (same room, both strategies) —\n` +
        `instanced-cubes: ${delta.instancedCubes.drawCalls} draw / ${delta.instancedCubes.triangleCount} tris\n` +
        `greedy-quads:    ${delta.greedyQuads.drawCalls} draw / ${delta.greedyQuads.triangleCount} tris\n` +
        `— LOD object (watch the seam) —\n` +
        `active: ${lodActive}  cameraDistance: ${lodCameraDistance.toFixed(2)}  lodLevel: ${lodLevel}` +
        (lodRenderable ? `  instances: ${lodRenderable.instanceCount}` : '  instances: n/a (not yet activated)') +
        `\n— light volume (lighting-resolution cost lab) —\n` +
        `resolution: ${lightMetrics.resolution}^3  buildTimeMs: ${lightMetrics.buildTimeMs.toFixed(3)}  lightVolumeBytes: ${lightMetrics.lightVolumeBytes}  drawCalls: ${lightMetrics.drawCalls}`;
    }
  }
  step(0);

  function setRenderStrategy(nextStrategy) {
    if (!RENDER_STRATEGIES.includes(nextStrategy)) {
      throw new RangeError(`setRenderStrategy: unknown strategy "${nextStrategy}" (expected one of ${RENDER_STRATEGIES.join(', ')})`);
    }
    if (nextStrategy === strategy) {
      step(0);
      return;
    }
    scene.remove(current.mesh);
    disposeRenderable(current);
    strategy = nextStrategy;
    current = buildRenderableForStrategy(strategy, grid);
    scene.add(current.mesh);
    step(0);
  }

  /**
   * getMetricsRoom() -> report (see src/metrics-room.mjs)
   *
   * Gate C additive API: the "budget/readout room" — a single deterministic snapshot
   * combining instanced-cubes vs greedy-quads mesh stats, LOD fine/coarse instance
   * reduction, and light-volume resolution cost, ALL computed over the SAME grids this
   * bench is already using (the default fixture for mesh comparison, the Slice 4
   * lodFineGrid for LOD comparison) — never a second, parallel set of grids. That reuse
   * is what makes this room's numbers provably consistent with meshStats()/
   * strategyDelta()/getLightMetrics() rather than a second, potentially-diverging
   * source of truth (proven by scripts/metrics-room-headless.mjs). Never touches the
   * active render strategy, scene contents, or draw-call count.
   */
  function getMetricsRoom() {
    return buildMetricsRoomReport({ grid, lodFineGrid });
  }

  /**
   * buildExportInput() -> exportExperiment() input object
   *
   * Gate E Slice 7 additive helper: snapshots the CURRENT live bench state (render
   * strategy, light-grid metrics, and the getMetricsRoom() report already built above)
   * into the shape src/export-markdown.mjs's exportExperiment() expects. This is a
   * ONE-SAMPLE snapshot only — this bench has no history-tracking concept, and Slice 7
   * is explicitly scoped to NOT add one (see plan Section 7 Slice 7). Reuses
   * getMetricsRoom()/getLightMetrics() rather than recomputing anything.
   */
  function buildExportInput() {
    const metrics = getMetricsRoom();
    const lightMetrics = getLightMetrics();
    return {
      title: 'Voxel Lab Bench Experiment',
      metadata: {
        date: new Date().toISOString(),
        room: `${grid.aabb.max.x - grid.aabb.min.x}m x ${grid.aabb.max.y - grid.aabb.min.y}m x ${grid.aabb.max.z - grid.aabb.min.z}m, chunk resolution ${grid.resolution}`,
        renderStrategy: strategy,
      },
      changes: [
        `render strategy: ${strategy}`,
        `light grid resolution: ${lightMetrics.resolution}`,
      ],
      metricsHistory: [{
        strategy,
        instancedTriangles: metrics.instancedCubes.triangleCount,
        greedyTriangles: metrics.greedyQuads.triangleCount,
        meshReductionRatio: metrics.meshReduction.ratio,
        lodFineInstances: metrics.lod.fineInstanceCount,
        lodCoarseInstances: metrics.lod.coarseInstanceCount,
        lightGridResolution: lightMetrics.resolution,
        lightVolumeBytes: lightMetrics.lightVolumeBytes,
        drawCalls: lightMetrics.drawCalls,
      }],
      lesson: 'This export is a one-sample snapshot of the current Voxel Lab Bench state — render-strategy mesh cost, LOD reduction, and lighting-grid cost, all captured at the same instant. Compare exports across different render-strategy / light-grid-resolution settings to see how each cost axis moves independently of the others.',
      reproduction: [
        `window.__bench.setRenderStrategy('${strategy}');`,
        `window.__bench.setLightGridResolution(${lightMetrics.resolution});`,
      ],
    };
  }

  /**
   * triggerMarkdownDownload(markdown, filename)
   *
   * Plain-file-download mechanism (Blob + URL.createObjectURL + a transient <a
   * download> click), matching the plan's Section 4.4 "plain file download... landable
   * directly in an Obsidian vault" requirement. No account, no server round-trip — a
   * Blob-URL download via an <a download> click is not a CSP-monitored request type, so
   * this needs no CSP change.
   */
  function triggerMarkdownDownload(markdown, filename) {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * exportMarkdown() -> string (Markdown)
   *
   * Pure-string wrapper around buildExportInput() + exportExperiment(), exposed on
   * window.__bench so headless/Node callers can get the exact artifact string without
   * needing to intercept a real download (matching this file's own convention of
   * exposing every feature as a plain callable on window.__bench).
   */
  function exportMarkdown() {
    return exportExperiment(buildExportInput());
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      triggerMarkdownDownload(exportMarkdown(), 'voxel-lab-experiment.md');
    });
  }

  window.__bench = {
    THREE,
    renderer,
    scene,
    camera,
    step,
    drawCalls: () => renderer.info.render.calls,
    instanceCount: () => current.instanceCount,
    // Gate B Slice 3 additive API: opt-in render-strategy toggle + live delta readout.
    setRenderStrategy,
    getRenderStrategy: () => strategy,
    meshStats: () => ({ strategy, instanceCount: current.instanceCount, quadCount: current.quadCount, triangleCount: current.triangleCount, drawCalls: renderer.info.render.calls }),
    strategyDelta: computeStrategyDelta,
    // Gate B Slice 4 additive API: LOD-capable object driven by a simulated camera
    // distance, plus a raw-pixel sampling hook for the headless LOD-popping harness.
    setCameraDistance,
    getLodLevel: () => lodLevel,
    getLodCameraDistance: () => lodCameraDistance,
    lodInstanceCount: () => (lodRenderable ? lodRenderable.instanceCount : 0),
    aimAtLodObject,
    samplePixels,
    // Gate B Slice 5 additive API: coarse lighting grid (LPV) over the default fixture
    // grid — matches the plan's Section 4.3 Reproduction snippet call shape exactly
    // (`world.setLightGridResolution(32)`). Rebuilding never touches the active render
    // strategy/scene/draw-call count (see rebuildLightVolume/setLightGridResolution
    // above) — that invariant is this slice's numeric proof that lighting cost is
    // decoupled from geometry cost.
    setLightGridResolution,
    getLightMetrics,
    // Gate C additive API: the unified metrics/readout room (see getMetricsRoom above).
    getMetricsRoom,
    // Gate E Slice 7 additive API: the "Export to second brain" Markdown artifact — a
    // pure-string snapshot builder (see exportMarkdown/buildExportInput above), plus the
    // #exportBtn click handler wired above triggers the real Blob download.
    exportMarkdown,
    // Minimal in-memory export/import round-trip of grid occupancy state — NOT the
    // Markdown/JSON second-brain export feature (that is a later, separately gated
    // slice; see plan Section 4.1 item 8 / Slice 7).
    exportState: () => exportGridState(grid),
    importState: (state) => {
      grid = importGridState(state, VoxelGrid);
      scene.remove(current.mesh);
      disposeRenderable(current);
      current = buildRenderableForStrategy(strategy, grid);
      scene.add(current.mesh);
      rebuildLightVolume();
      step(0);
    },
    roundTrip: () => {
      const exported = exportGridState(grid);
      const before = exported.occupancy.slice();
      const reimported = importGridState(exported, VoxelGrid);
      const after = Array.from(reimported.occupancy);
      const stable = before.length === after.length && before.every((v, i) => v === after[i]);
      return { ok: true, stable, cellCount: after.length };
    },
    ready: true,
  };
}

/** Count occupied cells without allocating — used only for the on-demand delta readout. */
function countOccupiedForDelta(grid) {
  let count = 0;
  grid.forEachOccupied(() => { count += 1; });
  return count;
}

try {
  boot();
} catch (err) {
  if (readout) readout.textContent = `Boot error: ${err && err.message ? err.message : err}`;
  console.error('[voxel-bench] boot failed', err);
}
