/**
 * Scene-level accent lighting derived from the layout's lighting model (ambient/accent palette,
 * intensity, bloom-ready flag). Sits on top of the base 3-point rig + zone lights. "Bloom-ready"
 * is approximated via tone-mapping exposure + emissive materials (no heavy post chain) for perf.
 */

import * as THREE from 'three';
import { resolvePalette } from '../validation/tokens.js';
import { INTENSITY_MUL } from './lightingScale.js';

/** Build a few corner accent lights that wash the hall in the layout's accent color. */
export function createAccentLights(lightingModel, bounds) {
  const group = new THREE.Group();
  group.name = 'accent-lights';
  const accent = resolvePalette(lightingModel?.accent || 'neon-cyan');
  const mul = INTENSITY_MUL[lightingModel?.intensity || 'medium'] ?? 1;

  const corners = [
    [bounds.minX + 1.5, bounds.minZ + 1.5],
    [bounds.maxX - 1.5, bounds.minZ + 1.5],
    [bounds.minX + 1.5, bounds.maxZ - 1.5],
    [bounds.maxX - 1.5, bounds.maxZ - 1.5],
  ];
  for (const [x, z] of corners) {
    const light = new THREE.PointLight(accent.glow, 0.5 * mul, 14, 1.5);
    light.position.set(x, 3.2, z);
    group.add(light);
  }
  return group;
}

/** Apply the bloom-ready exposure boost to the renderer (cheap stand-in for a bloom pass). */
export function applyBloomExposure(renderer, bloomEnabled) {
  renderer.toneMappingExposure = bloomEnabled ? 1.35 : 1.05;
}
