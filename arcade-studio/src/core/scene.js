/**
 * Scene container + theme application. Organizes the scene graph into named groups so the editor can
 * rebuild the building without touching effects/helpers, and so the debug panel can count by category.
 */

import * as THREE from 'three';

export function createSceneGraph() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);

  const groups = {
    environment: new THREE.Group(), // floor + walls + entrances
    props: new THREE.Group(),
    signs: new THREE.Group(),
    cabinets: new THREE.Group(),
    lights: new THREE.Group(),
    fx: new THREE.Group(), // particles
    helpers: new THREE.Group(), // grid, selection outline
  };
  for (const [name, g] of Object.entries(groups)) {
    g.name = `group:${name}`;
    scene.add(g);
  }
  return { scene, groups };
}

/** Apply a resolved theme (from ArcadeThemes.resolveTheme) to background + fog. */
export function applyTheme(scene, theme) {
  scene.background = new THREE.Color(theme.fogColor);
  scene.fog = theme.fogDensity > 0 ? new THREE.FogExp2(theme.fogColor, theme.fogDensity) : null;
}

/** Recursively dispose geometries/materials under a group and clear it (rebuild without leaks). */
export function clearGroup(group) {
  for (let i = group.children.length - 1; i >= 0; i--) {
    const child = group.children[i];
    disposeObject(child);
    group.remove(child);
  }
}

export function disposeObject(obj) {
  obj.traverse((node) => {
    // Skip geometry flagged shared (e.g. the cached, instanced prop geometry reused across rebuilds).
    if (node.geometry && !node.geometry.userData?.shared) node.geometry.dispose();
    if (node.material) {
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      for (const m of mats) {
        for (const key of Object.keys(m)) {
          const v = m[key];
          if (v && v.isTexture) v.dispose();
        }
        m.dispose();
      }
    }
  });
}
