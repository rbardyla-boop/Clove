/**
 * Effect preview controller. Owns the live screen-shake instance and an optional ambient particle
 * system so the editor can preview a layout's chosen effects in-scene. Both respect the reduced-motion
 * scale. Exposes the active particle count for the debug panel.
 */

import * as THREE from 'three';
import { ScreenShake } from './ScreenShake.js';
import { ParticleSystem } from './ParticleSystem.js';

export class EffectPreview {
  constructor(fxGroup) {
    this.fxGroup = fxGroup;
    this.shake = new ScreenShake();
    this.particles = null;
    this.particleName = 'none';
    this.motionScale = 1;
  }

  setMotionScale(scale) {
    this.motionScale = scale;
    this.shake.setMotionScale(scale);
    if (this.particles) this.particles.setMotionScale(scale);
  }

  /** Trigger a one-shot screen shake by preset name. */
  triggerShake(name) {
    this.shake.trigger(name);
  }

  /** Set the ambient particle preset ('none' clears). origin defaults to hall center. */
  setParticle(name, origin = new THREE.Vector3(0, 1.2, 0)) {
    if (this.particles) {
      this.particles.dispose();
      this.particles = null;
    }
    this.particleName = name;
    if (name && name !== 'none') {
      this.particles = new ParticleSystem(name, origin);
      this.particles.setMotionScale(this.motionScale);
      this.fxGroup.add(this.particles.points);
    }
  }

  /** Per-frame: advance particles. Shake is applied separately (post-camera) via applyShake. */
  update(dt) {
    if (this.particles) this.particles.update(dt);
  }

  applyShake(camera, dt) {
    this.shake.apply(camera, dt);
  }

  get activeParticleCount() {
    return this.particles ? this.particles.count : 0;
  }

  dispose() {
    if (this.particles) this.particles.dispose();
  }
}
