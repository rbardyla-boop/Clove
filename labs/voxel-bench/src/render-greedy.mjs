/**
 * Voxel Lab Bench — Tier-2 greedy-quads renderer (Gate B, Slice 3).
 *
 * Re-derived (not copy-pasted) from the behavioral contract described in
 * docs/VOXEL_LAB_BENCH_PLAN.md Section 3.3/5/7 (Slice 3). This is the render-side
 * counterpart of src/mesh-greedy.mjs's pure algorithm: takes a greedyMesh() result
 * (positions/indices buffers) and builds ONE THREE.Mesh from a single BufferGeometry —
 * the Tier-2 `greedy-quads` render strategy (plan Section 2b/3.3), rendered in a single
 * draw call just like Tier-1's InstancedMesh, but with far fewer triangles for the same
 * occupancy than one cube per occupied cell.
 *
 * Imports the same vendored Three.js r152 ES module already used by render-instanced.mjs
 * — no CDN reference, no other Three.js version, no new dependency.
 */

import * as THREE from '../../../game/vendor/three/three.module-0.152.2.js';

/**
 * buildGreedyVoxelMesh(meshResult, opts?) -> { mesh: THREE.Mesh, quadCount: number, triangleCount: number }
 *
 * meshResult: the { positions, indices, quadCount, triangleCount } object produced by
 *   mesh-greedy.mjs's greedyMesh(grid) (or an equivalent shape from the Worker wrapper).
 * opts: { color?: number }
 *
 * Builds a single non-indexed-free BufferGeometry (indexed via setIndex) with computed
 * vertex normals so the merged quads shade correctly despite having no per-face-normal
 * attribute of their own, and returns ONE THREE.Mesh — the whole room still renders in
 * a single draw call, matching Tier-1's single-draw-call contract, but via triangles
 * instead of instances.
 */
export function buildGreedyVoxelMesh(meshResult, opts = {}) {
  if (!meshResult) throw new TypeError('buildGreedyVoxelMesh: meshResult is required');
  const { positions, indices, quadCount, triangleCount } = meshResult;
  if (!(positions instanceof Float32Array)) {
    throw new TypeError('buildGreedyVoxelMesh: meshResult.positions must be a Float32Array');
  }
  if (!(indices instanceof Uint16Array) && !(indices instanceof Uint32Array)) {
    throw new TypeError('buildGreedyVoxelMesh: meshResult.indices must be a Uint16Array or Uint32Array');
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  if (positions.length > 0) {
    geometry.computeVertexNormals();
  }

  const material = new THREE.MeshBasicMaterial({ color: opts.color ?? 0x3fa9f5 });
  const mesh = new THREE.Mesh(geometry, material);

  return { mesh, quadCount: quadCount ?? 0, triangleCount: triangleCount ?? 0 };
}
