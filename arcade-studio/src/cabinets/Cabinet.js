/**
 * High-level cabinet: normalizes a config, builds materials + mesh, and animates attract-mode / glow.
 * The attract animation is a bounded emissive modulation (pulse/chase/cycle/flicker) — a PLACEHOLDER
 * for real attract video, never executable content. Respects a motion scale for reduced-motion safety.
 */

import * as THREE from 'three';
import { normalizeCabinet } from './CabinetConfig.js';
import { buildCabinetMaterials } from './CabinetMaterials.js';
import { buildCabinetMesh } from './CabinetGeometry.js';
import { disposeObject } from '../core/scene.js';

export class Cabinet {
  constructor(config) {
    this.config = normalizeCabinet(config);
    this.motionScale = 1;
    this._t = 0;
    this._build();
  }

  _build() {
    this.materials = buildCabinetMaterials(this.config);
    this.group = buildCabinetMesh(this.config, this.materials);
    this.group.userData.cabinet = this;
    this._screen = this._findRole('screen');
    this._marquee = this._findRole('marquee');
  }

  _findRole(role) {
    let found = null;
    this.group.traverse((n) => {
      if (!found && n.userData && n.userData.role === role) found = n;
    });
    return found;
  }

  /** Replace the cabinet's appearance from a new config (used by the inspector live-edit). */
  rebuild(config) {
    const parent = this.group.parent;
    this.group.updateMatrix(); // ensure the snapshot reflects current position/rotation, not a stale matrix
    const matrix = this.group.matrix.clone();
    disposeObject(this.group);
    if (parent) parent.remove(this.group);
    this.config = normalizeCabinet(config);
    this._build();
    this.group.applyMatrix4(matrix);
    if (parent) parent.add(this.group);
    return this.group;
  }

  setMotionScale(scale) {
    this.motionScale = Math.max(0, Math.min(1, scale));
  }

  update(dt) {
    this._t += dt;
    const t = this._t;
    const m = this.materials;
    const scale = this.motionScale;
    const glow = m.glowBase;

    // glow style modulation
    let glowMod = 1;
    if (this.config.glow_style === 'pulse') glowMod = 1 + 0.3 * Math.sin(t * 2.2) * scale;
    else if (this.config.glow_style === 'flicker') glowMod = 1 + 0.12 * (Math.sin(t * 31) + Math.sin(t * 17)) * scale;

    // attract mode modulation
    let screenMod = 1;
    let marqueeMod = 1;
    switch (this.config.attract_mode) {
      case 'slow-pulse': screenMod = 1 + 0.25 * Math.sin(t * 1.1) * scale; break;
      case 'marquee-chase': marqueeMod = 1 + 0.5 * (0.5 + 0.5 * Math.sin(t * 4)) * scale; break;
      case 'screen-cycle': screenMod = 1 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.8)) * scale; break;
      case 'demo-loop':
        screenMod = 1 + 0.3 * Math.sin(t * 2.5) * scale;
        marqueeMod = 1 + 0.3 * Math.sin(t * 3.1 + 1) * scale;
        break;
      default: break;
    }

    if (m.screen) m.screen.emissiveIntensity = m._baseScreenEmissive * glowMod * screenMod;
    if (m.marquee) m.marquee.emissiveIntensity = m._baseMarqueeEmissive * glowMod * marqueeMod;
  }

  /** Local-space bounding box (for placement spacing + collision footprint). */
  computeBox() {
    return new THREE.Box3().setFromObject(this.group);
  }

  dispose() {
    if (this.group.parent) this.group.parent.remove(this.group);
    disposeObject(this.group);
  }
}
