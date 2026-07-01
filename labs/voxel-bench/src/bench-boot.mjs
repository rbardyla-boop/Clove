/**
 * Voxel Lab Bench — page boot entry point (Gate A, Slice 2).
 *
 * Externalized (rather than an inline <script> in index.html) so index.html's strict
 * `script-src 'self'` CSP holds with no 'unsafe-inline'/hash/nonce carve-out — the same
 * externalized-entry-point shape arcade-studio/index.html uses for its own main.js.
 *
 * Builds a small, HAND-AUTHORED, fixed occupancy pattern (a "plus" cross via literal
 * setCell calls) and renders it through the Tier-1 single-InstancedMesh render path.
 * NOT a voxelized mesh, NOT the full lesson room, NO lighting, NO LOD, NO player
 * movement — this is a renderer shell proving the instanced-cube path works
 * end-to-end and is headlessly testable (plan Section 7, Slice 2).
 *
 * Exposes window.__bench mirroring arcade-studio's window.__studio shape: ready,
 * step(dt), drawCalls(), exportState(), importState(state), roundTrip().
 */

import * as THREE from '../../../game/vendor/three/three.module-0.152.2.js';
import { VoxelGrid } from './bench-core.mjs';
import {
  buildInstancedVoxelMesh,
  exportGridState,
  importGridState,
} from './render-instanced.mjs';

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

function boot() {
  const canvas = document.getElementById('viewport');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.info.autoReset = false; // reset once per frame so drawCalls() reads a stable value

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d12);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(6, 6, 6);
  camera.lookAt(2, 2, 2);

  let grid = buildFixtureGrid();
  let current = buildInstancedVoxelMesh(grid);
  scene.add(current.mesh);

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

  function step(dt = 1 / 60) {
    render();
    if (readout) {
      readout.textContent =
        `Voxel Lab Bench — Gate A Slice 2\n` +
        `instances: ${current.instanceCount}\n` +
        `drawCalls: ${renderer.info.render.calls}`;
    }
  }
  step(0);

  window.__bench = {
    THREE,
    renderer,
    scene,
    camera,
    step,
    drawCalls: () => renderer.info.render.calls,
    instanceCount: () => current.instanceCount,
    // Minimal in-memory export/import round-trip of grid occupancy state — NOT the
    // Markdown/JSON second-brain export feature (that is a later, separately gated
    // slice; see plan Section 4.1 item 8 / Slice 7).
    exportState: () => exportGridState(grid),
    importState: (state) => {
      grid = importGridState(state, VoxelGrid);
      scene.remove(current.mesh);
      current.mesh.geometry.dispose();
      current.mesh.material.dispose();
      current = buildInstancedVoxelMesh(grid);
      scene.add(current.mesh);
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

try {
  boot();
} catch (err) {
  if (readout) readout.textContent = `Boot error: ${err && err.message ? err.message : err}`;
  console.error('[voxel-bench] boot failed', err);
}
