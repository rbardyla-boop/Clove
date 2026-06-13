/**
 * Lighting + ambience zones. A zone has a rectangular footprint and a closed preset; it contributes
 * lights and/or a subtle floor-glow surface. Each zone is capped at <= 2 lights so a hall full of
 * zones stays within a sane active-light budget.
 */

import * as THREE from 'three';
import { CELL, cellToWorld } from './grid.js';
import { resolvePalette } from '../validation/tokens.js';
import { INTENSITY_MUL } from './lightingScale.js';

function rectWorld(zone, cols, rows) {
  const center = cellToWorld(zone.gx + (zone.cols - 1) / 2, zone.gy + (zone.rows - 1) / 2, cols, rows);
  return { x: center.x, z: center.z, w: zone.cols * CELL, d: zone.rows * CELL };
}

function glowDisc(pal, w, d, opacity) {
  const mat = new THREE.MeshBasicMaterial({
    color: pal.glow,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  return mesh;
}

export function createZone(zone, theme, cols, rows) {
  const pal = resolvePalette(zone.palette || theme.name);
  const mul = INTENSITY_MUL[zone.intensity || 'medium'] ?? 1;
  const r = rectWorld(zone, cols, rows);
  const group = new THREE.Group();
  group.name = `zone:${zone.kind}:${zone.preset}`;
  group.userData.zone = true;

  if (zone.kind === 'lighting') {
    switch (zone.preset) {
      case 'neon-strip': {
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(r.w, 0.08, 0.12),
          new THREE.MeshStandardMaterial({ color: pal.accent, emissive: pal.glow, emissiveIntensity: 1.2 * mul }),
        );
        strip.position.set(r.x, 2.6, r.z);
        const light = new THREE.PointLight(pal.glow, 0.8 * mul, Math.max(r.w, r.d) * 2.2, 2);
        light.position.set(r.x, 2.4, r.z);
        group.add(strip, light);
        break;
      }
      case 'spotlight': {
        const spot = new THREE.SpotLight(pal.glow, 2.2 * mul, Math.max(r.w, r.d) * 3, Math.PI / 6, 0.4, 1.2);
        spot.position.set(r.x, 4.2, r.z);
        spot.target.position.set(r.x, 0, r.z);
        group.add(spot, spot.target);
        break;
      }
      case 'wash': {
        const light = new THREE.PointLight(pal.glow, 1.0 * mul, Math.max(r.w, r.d) * 3, 1.5);
        light.position.set(r.x, 3.6, r.z);
        group.add(light, glowDisc(pal, r.w, r.d, 0.06));
        break;
      }
      case 'accent': {
        const light = new THREE.PointLight(pal.accent, 1.4 * mul, Math.max(r.w, r.d) * 1.6, 2);
        light.position.set(r.x, 1.2, r.z);
        group.add(light);
        break;
      }
      case 'ambient-fill':
      default: {
        const light = new THREE.PointLight(pal.glow, 0.5 * mul, Math.max(r.w, r.d) * 4, 1);
        light.position.set(r.x, 3.0, r.z);
        group.add(light);
        break;
      }
    }
  } else {
    // ambience
    switch (zone.preset) {
      case 'glow-pool':
        group.add(glowDisc(pal, r.w, r.d, 0.16));
        group.add(pointSoft(pal, r, 0.5 * mul, 1.0));
        break;
      case 'fog-light':
        group.add(pointSoft(pal, r, 0.6 * mul, 2.5));
        break;
      case 'haze':
        group.add(glowDisc(pal, r.w, r.d, 0.1));
        group.add(pointSoft(pal, r, 0.3 * mul, 2.0));
        break;
      case 'calm':
        group.add(pointSoft(pal, r, 0.2 * mul, 1.5));
        break;
      case 'none':
      default:
        break;
    }
  }
  return group;
}

function pointSoft(pal, r, intensity, height) {
  const light = new THREE.PointLight(pal.glow, intensity, Math.max(r.w, r.d) * 2.5, 1);
  light.position.set(r.x, height, r.z);
  return light;
}
