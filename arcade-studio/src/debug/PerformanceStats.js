/**
 * Runtime stat sampling for the debug panel: FPS (from the loop), draw calls + triangles (from
 * renderer.info), and counts of visible objects + active lights derived from a scene traversal.
 * Sampling is meant to be throttled by the caller (e.g. every 0.25s) to avoid per-frame traversal cost.
 */

export class PerformanceStats {
  /** Walk the scene once: count visible meshes/points and active (intensity>0) lights. */
  static countScene(scene) {
    let visibleObjects = 0;
    let activeLights = 0;
    scene.traverseVisible((node) => {
      if (node.isMesh || node.isPoints || node.isInstancedMesh) visibleObjects += 1;
      if (node.isLight && (node.intensity === undefined || node.intensity > 0)) activeLights += 1;
    });
    return { visibleObjects, activeLights };
  }

  static sample(scene, renderer, loop) {
    const sceneCounts = PerformanceStats.countScene(scene);
    return {
      fps: loop.fps,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      visibleObjects: sceneCounts.visibleObjects,
      activeLights: sceneCounts.activeLights,
    };
  }
}
