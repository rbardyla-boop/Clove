/**
 * Closed prop library. Each prop type is a MERGED single geometry (base at y=0) so the building can
 * render many copies of one prop type as a single InstancedMesh — the main perf win for repeated set
 * dressing. Materials are neutral; neon-arch is emissive. No external models or textures.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function box(w, h, d, x = 0, y = 0, z = 0) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}
function cyl(rt, rb, h, x = 0, y = 0, z = 0, seg = 12) {
  return new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y, z);
}
function cone(r, h, x = 0, y = 0, z = 0) {
  return new THREE.ConeGeometry(r, h, 12).translate(x, y, z);
}
function sphere(r, x = 0, y = 0, z = 0) {
  return new THREE.SphereGeometry(r, 12, 10).translate(x, y, z);
}

function legs(w, d, h) {
  const r = 0.03;
  return [
    cyl(r, r, h, w, h / 2, d),
    cyl(r, r, h, -w, h / 2, d),
    cyl(r, r, h, w, h / 2, -d),
    cyl(r, r, h, -w, h / 2, -d),
  ];
}

const PARTS = {
  stool: () => [cyl(0.18, 0.18, 0.06, 0, 0.5, 0), ...legs(0.13, 0.13, 0.5)],
  bench: () => [box(1.0, 0.08, 0.4, 0, 0.45, 0), box(1.0, 0.4, 0.06, 0, 0.68, -0.17), ...legs(0.42, 0.16, 0.45)],
  planter: () => [box(0.5, 0.4, 0.5, 0, 0.2, 0), cone(0.34, 0.55, 0, 0.68, 0)],
  'speaker-stack': () => [box(0.5, 0.6, 0.4, 0, 0.3, 0), box(0.45, 0.5, 0.35, 0, 0.85, 0)],
  'rope-post': () => [cyl(0.04, 0.05, 0.9, 0, 0.45, 0), sphere(0.08, 0, 0.95, 0)],
  standee: () => [box(0.5, 0.05, 0.3, 0, 0.03, 0), box(0.5, 1.4, 0.04, 0, 0.75, 0)],
  pillar: () => [cyl(0.22, 0.24, 2.6, 0, 1.3, 0, 16)],
  'trash-bin': () => [cyl(0.2, 0.18, 0.7, 0, 0.35, 0)],
  'neon-arch': () => [box(0.1, 1.6, 0.1, -0.6, 0.8, 0), box(0.1, 1.6, 0.1, 0.6, 0.8, 0), box(1.3, 0.12, 0.12, 0, 1.6, 0)],
  'crate-stack': () => [box(0.6, 0.6, 0.6, 0, 0.3, 0), box(0.5, 0.5, 0.5, 0.05, 0.85, 0.05)],
  'info-kiosk': () => [box(0.6, 1.2, 0.4, 0, 0.6, 0), box(0.62, 0.06, 0.5, 0, 1.2, 0.05).rotateX(0.3)],
  'water-cooler': () => [box(0.4, 0.9, 0.4, 0, 0.45, 0), cyl(0.15, 0.15, 0.3, 0, 1.05, 0)],
};

const PROP_LOOK = {
  'neon-arch': { color: 0x141a2a, metalness: 0.3, roughness: 0.4, emissive: 0x22e0ff, emissiveIntensity: 0.9 },
  standee: { color: 0x2a2440, metalness: 0.1, roughness: 0.6, emissive: 0xa06bff, emissiveIntensity: 0.35 },
  'speaker-stack': { color: 0x16181d, metalness: 0.2, roughness: 0.7, emissive: 0, emissiveIntensity: 0 },
  planter: { color: 0x223322, metalness: 0.0, roughness: 0.8, emissive: 0, emissiveIntensity: 0 },
  pillar: { color: 0x2b2d33, metalness: 0.3, roughness: 0.6, emissive: 0, emissiveIntensity: 0 },
};
const DEFAULT_LOOK = { color: 0x33363d, metalness: 0.25, roughness: 0.6, emissive: 0, emissiveIntensity: 0 };

const geometryCache = new Map();

/** Merged, cached geometry for a prop type (base at y=0). */
export function propGeometry(type) {
  if (geometryCache.has(type)) return geometryCache.get(type);
  const make = PARTS[type] || PARTS.stool;
  const parts = make();
  const merged = mergeGeometries(parts, false) || parts[0];
  parts.forEach((p) => p !== merged && p.dispose && p.dispose());
  merged.computeVertexNormals();
  // Flagged shared: this geometry is reused across scene rebuilds and InstancedMeshes, so the scene
  // teardown (disposeObject) must NOT dispose it — see core/scene.js.
  merged.userData.shared = true;
  geometryCache.set(type, merged);
  return merged;
}

export function propMaterial(type) {
  const look = PROP_LOOK[type] || DEFAULT_LOOK;
  return new THREE.MeshStandardMaterial({
    color: look.color,
    metalness: look.metalness,
    roughness: look.roughness,
    emissive: look.emissive || 0x000000,
    emissiveIntensity: look.emissiveIntensity || 0,
  });
}

/** A single (non-instanced) prop mesh — used for the placement ghost + single previews. */
export function buildPropMesh(type) {
  const mesh = new THREE.Mesh(propGeometry(type), propMaterial(type));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = `prop:${type}`;
  return mesh;
}
