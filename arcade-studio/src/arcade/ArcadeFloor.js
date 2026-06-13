/**
 * Procedural arcade floor. The floor material token selects a generated tiling pattern (neon grid,
 * glossy tile, hazard, circuit, retro carpet, sealed concrete). One CanvasTexture, tiled per cell —
 * no external image assets.
 */

import * as THREE from 'three';
import { CELL } from './grid.js';
import { intToHex } from '../utils/colors.js';

function canvas2d(size) {
  const c = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
  if (!c) return null;
  c.width = size;
  c.height = size;
  return c;
}

function floorTexture(material, theme) {
  const c = canvas2d(128);
  if (!c) return null;
  const ctx = c.getContext('2d');
  const base = theme.fogColor;
  const accent = theme.accent.accent;
  ctx.fillStyle = intToHex(base);
  ctx.fillRect(0, 0, 128, 128);

  const line = intToHex(accent);
  switch (material) {
    case 'neon-grid':
      ctx.strokeStyle = line;
      ctx.lineWidth = 3;
      ctx.strokeRect(1, 1, 126, 126);
      break;
    case 'glossy-tile':
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillRect(64, 64, 64, 64);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.strokeRect(0, 0, 128, 128);
      break;
    case 'hazard-grid':
      ctx.strokeStyle = '#ffb020';
      ctx.lineWidth = 6;
      for (let i = -128; i < 128; i += 24) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 128, 128);
        ctx.stroke();
      }
      break;
    case 'circuit-weave':
      ctx.strokeStyle = line;
      ctx.lineWidth = 1.5;
      for (let i = 16; i < 128; i += 32) {
        ctx.strokeRect(i, i, 128 - 2 * i, 128 - 2 * i);
      }
      break;
    case 'carpet-retro':
      for (let i = 0; i < 240; i++) {
        ctx.fillStyle = i % 3 === 0 ? line : 'rgba(255,255,255,0.08)';
        ctx.fillRect((i * 47) % 128, (i * 83) % 128, 3, 3);
      }
      break;
    case 'concrete-seal':
    default:
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let i = 0; i < 60; i++) ctx.fillRect((i * 71) % 128, (i * 53) % 128, 6, 6);
      break;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const ROUGHNESS = {
  'glossy-tile': 0.2, 'neon-grid': 0.4, 'hazard-grid': 0.6, 'circuit-weave': 0.5, 'carpet-retro': 0.95, 'concrete-seal': 0.85,
};

export function createFloor(material, theme, cols, rows) {
  const w = cols * CELL;
  const d = rows * CELL;
  const tex = floorTexture(material, theme);
  if (tex) tex.repeat.set(cols, rows);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex || null,
    roughness: ROUGHNESS[material] ?? 0.6,
    metalness: material === 'glossy-tile' ? 0.4 : 0.05,
    emissive: material === 'neon-grid' ? theme.accent.glow : 0x000000,
    emissiveMap: material === 'neon-grid' ? tex : null,
    emissiveIntensity: material === 'neon-grid' ? 0.35 : 0,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0;
  mesh.receiveShadow = true;
  mesh.name = 'floor';
  return mesh;
}
