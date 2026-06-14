/**
 * Wall segments + entrance features. A wall is a box along a grid edge (orientation = which side).
 * Entrances are simple framed openings (closed style set). Wall material token tints + textures the box.
 */

import * as THREE from 'three';
import { CELL, cellToWorld } from './grid.js';
import { resolvePalette } from '../validation/tokens.js';

const WALL_HEIGHT = 2.8;
const WALL_THICK = 0.2;

const WALL_LOOK = {
  'panel-dark': { color: 0x1a1f2b, metalness: 0.2, roughness: 0.7, emissive: 0 },
  'brick-neon': { color: 0x241420, metalness: 0.1, roughness: 0.8, emissive: 0x2b5cff },
  'glass-tint': { color: 0x10242e, metalness: 0.6, roughness: 0.15, emissive: 0 },
  'ribbed-metal': { color: 0x2a2c30, metalness: 0.8, roughness: 0.45, emissive: 0 },
  'mural-abstract': { color: 0x201a2e, metalness: 0.1, roughness: 0.6, emissive: 0xa06bff },
  'concrete-seal': { color: 0x2b2d31, metalness: 0.05, roughness: 0.9, emissive: 0 },
};

function wallMaterial(material) {
  const look = WALL_LOOK[material] || WALL_LOOK['panel-dark'];
  return new THREE.MeshStandardMaterial({
    color: look.color,
    metalness: look.metalness,
    roughness: look.roughness,
    emissive: look.emissive || 0x000000,
    emissiveIntensity: look.emissive ? 0.25 : 0,
  });
}

/** Build a wall segment mesh from a layout wall element. */
export function createWall(wall, cols, rows) {
  const { material, gx, gy, length, orientation } = wall;
  const start = cellToWorld(gx, gy, cols, rows);
  const span = Math.max(1, length) * CELL;
  const mat = wallMaterial(material);

  let geo;
  let cx = start.x;
  let cz = start.z;
  const half = (length - 1) * CELL / 2;

  if (orientation === 'north' || orientation === 'south') {
    geo = new THREE.BoxGeometry(span, WALL_HEIGHT, WALL_THICK);
    cx = start.x + half;
    cz = start.z + (orientation === 'north' ? -CELL / 2 : CELL / 2);
  } else {
    geo = new THREE.BoxGeometry(WALL_THICK, WALL_HEIGHT, span);
    cz = start.z + half;
    cx = start.x + (orientation === 'west' ? -CELL / 2 : CELL / 2);
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, WALL_HEIGHT / 2, cz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'wall';
  return mesh;
}

const ENTRANCE_ACCENT = {
  'open-arch': 'neon-cyan', 'glass-doors': 'neon-blue', 'turnstile-gate': 'neon-amber',
  'neon-portal': 'neon-magenta', none: 'mono-white',
};

/** Build a framed entrance feature (visual only). */
export function createEntrance(entrance, cols, rows) {
  const { style, gx, gy } = entrance;
  if (style === 'none') return null;
  const pos = cellToWorld(gx, gy, cols, rows);
  const pal = resolvePalette(ENTRANCE_ACCENT[style] || 'neon-cyan');
  const group = new THREE.Group();
  group.name = 'entrance';

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.5, roughness: 0.4 });
  const glowMat = new THREE.MeshStandardMaterial({ color: pal.accent, emissive: pal.glow, emissiveIntensity: 1.0, roughness: 0.4 });

  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.18), frameMat);
  postL.position.set(-0.9, 1.3, 0);
  const postR = postL.clone();
  postR.position.x = 0.9;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.2, 0.22), glowMat);
  lintel.position.set(0, 2.5, 0);
  group.add(postL, postR, lintel);

  if (style === 'neon-portal') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.06, 8, 24), glowMat);
    ring.position.set(0, 1.3, 0);
    group.add(ring);
  } else if (style === 'glass-doors') {
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.4, 0.04), new THREE.MeshStandardMaterial({ color: pal.screen, transparent: true, opacity: 0.25, metalness: 0.6, roughness: 0.1 }));
    glass.position.set(0, 1.2, 0);
    group.add(glass);
  }

  group.position.set(pos.x, 0, pos.z);
  return group;
}
