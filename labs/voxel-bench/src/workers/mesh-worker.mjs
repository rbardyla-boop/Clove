/**
 * Voxel Lab Bench — greedy-quads mesh Worker entry (Gate B, Slice 3).
 *
 * Thin, dependency-light Web Worker wrapper around src/mesh-greedy.mjs's pure
 * greedyMesh(grid) function, so meshing can run off the main thread in the browser
 * page. The algorithm itself stays a plain synchronous function (directly
 * node:test-testable, see test/mesh-greedy.test.mjs) — this file's only job is the
 * message-in/transferable-buffers-out plumbing (plan Section 3.2's
 * RenderStrategy.buildRenderable "runs in a Web Worker; returns transferable buffers"
 * contract, Section 7 Slice 3).
 *
 * Request message shape (postMessage into this worker):
 *   {
 *     aabb: { min: {x,y,z}, max: {x,y,z} },
 *     resolution: number,
 *     occupancy: ArrayBuffer,   // transferred Uint8Array buffer, length nx*ny*nz
 *     nx: number, ny: number, nz: number,   // expected dims, verified against the
 *                                            // rebuilt grid's own dims (defense in depth)
 *   }
 *
 * Response message shape (postMessage back out of this worker):
 *   ok:    { ok: true, positions: ArrayBuffer, indices: ArrayBuffer,
 *            indexBpe: 2 | 4, quadCount: number, triangleCount: number }
 *   error: { ok: false, error: string }
 *
 * Both positions and indices buffers are transferred (not copied) back to the caller,
 * matching the plan's "transferable Float32Array/Uint16Array buffers" requirement.
 */

import { VoxelGrid } from '../bench-core.mjs';
import { greedyMesh } from '../mesh-greedy.mjs';

/**
 * rebuildGridFromMessage(data) -> VoxelGrid
 *
 * Rebuilds a real VoxelGrid instance from a transferred occupancy ArrayBuffer plus its
 * aabb/resolution, then copies the occupancy bytes in verbatim (same pattern
 * render-instanced.mjs's importGridState uses) so greedyMesh sees an identical grid to
 * the one the main thread holds.
 */
export function rebuildGridFromMessage(data) {
  if (!data || !data.aabb || !data.occupancy) {
    throw new TypeError('mesh-worker: message must include aabb and occupancy');
  }
  const grid = new VoxelGrid(data.aabb, data.resolution);
  const occupancyView = new Uint8Array(data.occupancy);
  if (grid.occupancy.length !== occupancyView.length) {
    throw new RangeError(
      `mesh-worker: rebuilt grid cell count ${grid.occupancy.length} does not match transferred occupancy length ${occupancyView.length}`,
    );
  }
  if (
    (typeof data.nx === 'number' && data.nx !== grid.nx) ||
    (typeof data.ny === 'number' && data.ny !== grid.ny) ||
    (typeof data.nz === 'number' && data.nz !== grid.nz)
  ) {
    throw new RangeError('mesh-worker: rebuilt grid dims do not match message dims');
  }
  grid.occupancy.set(occupancyView);
  return grid;
}

/**
 * handleMeshRequest(data) -> response object (see module doc for shape)
 *
 * Pure function separated from the postMessage/self plumbing below so it is directly
 * callable/testable from Node without a real Worker global.
 */
export function handleMeshRequest(data) {
  try {
    const grid = rebuildGridFromMessage(data);
    const result = greedyMesh(grid);
    return {
      ok: true,
      positions: result.positions.buffer,
      indices: result.indices.buffer,
      indexBpe: result.indices.BYTES_PER_ELEMENT,
      quadCount: result.quadCount,
      triangleCount: result.triangleCount,
    };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

// Only wire up the real Worker global when running inside an actual Worker context
// (self is a DedicatedWorkerGlobalScope). This keeps the module import-safe from
// Node (e.g. this file itself has zero side effects when imported by a test runner).
/* c8 ignore start */
if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  self.addEventListener('message', (event) => {
    const response = handleMeshRequest(event.data);
    if (response.ok) {
      self.postMessage(response, [response.positions, response.indices]);
    } else {
      self.postMessage(response);
    }
  });
}
/* c8 ignore stop */
