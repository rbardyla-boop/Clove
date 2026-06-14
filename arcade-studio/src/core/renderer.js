/**
 * WebGL renderer setup. ACES tone mapping + sRGB output gives the neon scene a "bloom-ready" look
 * without a full post-processing chain (kept lean for perf). Exposes a resize helper and a draw-call
 * estimate read from renderer.info for the debug panel.
 */

import * as THREE from 'three';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false; // we reset once per frame so the debug panel reads a stable value
  return renderer;
}

/** Resize renderer + camera to a CSS pixel size. Returns true if the size actually changed. */
export function resizeRenderer(renderer, camera, width, height) {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const size = renderer.getSize(new THREE.Vector2());
  if (size.x === w && size.y === h) return false;
  renderer.setSize(w, h, false);
  if (camera) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  return true;
}

/** Per-frame render stats for the debug panel (call after render()). */
export function readRenderStats(renderer) {
  const info = renderer.info;
  return {
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
  };
}
