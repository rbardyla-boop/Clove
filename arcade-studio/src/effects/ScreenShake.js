/**
 * Camera screen-shake. Applies a transient positional offset to the camera each frame based on a
 * closed preset (resolveShake). The rig re-sets camera.position every frame, so the offset is applied
 * post-rig and never accumulates. Amplitude is multiplied by the reduced-motion scale → fully safe.
 *
 * There is NO arbitrary animation surface: only preset tokens with clamped amplitude/frequency/
 * duration/falloff/axis.
 */

import * as THREE from 'three';
import { resolveShake, shakeEnvelope } from './ScreenShakePresets.js';

export class ScreenShake {
  constructor() {
    this.active = null;
    this.elapsed = 0;
    this.motionScale = 1;
    this._offset = new THREE.Vector3();
    this._seed = 1;
  }

  setMotionScale(scale) {
    this.motionScale = Math.max(0, Math.min(1, scale));
  }

  /** Start a shake by preset name. 'none' clears any active shake. */
  trigger(name) {
    const s = resolveShake(name);
    if (s.name === 'none' || s.amplitude <= 0 || s.duration <= 0) {
      this.active = null;
      return;
    }
    this.active = s;
    this.elapsed = 0;
    this._seed = 1;
  }

  /** Advance + apply to camera. Call AFTER the camera rig has positioned the camera this frame. */
  apply(camera, dt) {
    if (!this.active) return;
    this.elapsed += dt;
    const s = this.active;
    if (this.elapsed >= s.duration) {
      this.active = null;
      return;
    }
    const t = this.elapsed / s.duration;
    const env = shakeEnvelope(s.falloff, t);
    const amp = s.amplitude * env * this.motionScale;
    const phase = this.elapsed * s.frequency * Math.PI * 2;

    const ox = Math.sin(phase) * amp;
    const oy = Math.sin(phase * 1.3 + 1.1) * amp;
    const oz = Math.sin(phase * 0.7 + 2.2) * amp;

    this._offset.set(0, 0, 0);
    if (s.axis === 'x') this._offset.x = ox;
    else if (s.axis === 'y') this._offset.y = oy;
    else if (s.axis === 'xyz') this._offset.set(ox, oy, oz);
    else this._offset.set(ox, oy, 0); // 'xy'

    camera.position.add(this._offset);
  }

  get isActive() {
    return !!this.active;
  }
}
