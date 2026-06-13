/**
 * Base 3-point-ish lighting rig (ambient + hemisphere + key directional with shadows + cool fill).
 * Theme tints the ambient/key; arcade/ArcadeLighting adds the neon strip + zone accent lights on top.
 */

import * as THREE from 'three';
import { INTENSITY_MUL } from '../arcade/lightingScale.js';

export function createBaseLights(theme, intensityLevel = 'medium') {
  const group = new THREE.Group();
  group.name = 'base-lights';
  const mul = INTENSITY_MUL[intensityLevel] ?? 1;

  const ambient = new THREE.AmbientLight(theme.ambient.base, 0.5 * mul);
  ambient.name = 'ambient';

  const hemi = new THREE.HemisphereLight(theme.accent.glow, theme.ambient.base, 0.65 * mul);
  hemi.name = 'hemi';

  const key = new THREE.DirectionalLight(0xffffff, 1.0 * mul);
  key.name = 'key';
  key.position.set(8, 16, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 80;
  key.shadow.camera.left = -30;
  key.shadow.camera.right = 30;
  key.shadow.camera.top = 30;
  key.shadow.camera.bottom = -30;
  key.shadow.bias = -0.0005;

  const fill = new THREE.DirectionalLight(theme.ambient.accent, 0.35 * mul);
  fill.name = 'fill';
  fill.position.set(-10, 8, -6);

  group.add(ambient, hemi, key, fill);
  group.userData.handles = { ambient, hemi, key, fill };
  return group;
}

/** Retint + rescale an existing base-light group for a new theme/intensity (no rebuild). */
export function applyBaseLighting(group, theme, intensityLevel = 'medium') {
  const mul = INTENSITY_MUL[intensityLevel] ?? 1;
  const h = group.userData.handles;
  if (!h) return;
  h.ambient.color.setHex(theme.ambient.base);
  h.ambient.intensity = 0.5 * mul;
  h.hemi.color.setHex(theme.accent.glow);
  h.hemi.groundColor.setHex(theme.ambient.base);
  h.hemi.intensity = 0.65 * mul;
  h.key.intensity = 1.0 * mul;
  h.fill.color.setHex(theme.ambient.accent);
  h.fill.intensity = 0.35 * mul;
}
