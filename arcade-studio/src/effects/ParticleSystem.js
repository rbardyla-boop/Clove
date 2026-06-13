/**
 * Bounded, performance-aware particle system built on THREE.Points. Driven entirely by a closed,
 * clamped preset (resolveParticlePreset): a HARD count cap, bounded lifetime/size/speed, closed spawn
 * shape + blend mode + fade. Typed arrays are pre-allocated once; the update loop does NO allocations.
 * Particles recycle continuously, so this works as both a one-shot accent and an ambient emitter.
 */

import * as THREE from 'three';
import { resolveParticlePreset } from './ParticlePresets.js';
import { SeededRandom } from '../utils/random.js';

export class ParticleSystem {
  constructor(presetName, origin = new THREE.Vector3(0, 1, 0), seed = 'fx') {
    this.preset = resolveParticlePreset(presetName);
    this.name = presetName;
    this.origin = origin.clone();
    this.motionScale = 1;
    this._rng = new SeededRandom(`${presetName}:${seed}`);

    const n = this.preset ? this.preset.count : 0;
    this.count = n;
    this._pos = new Float32Array(n * 3);
    this._vel = new Float32Array(n * 3);
    this._age = new Float32Array(n);
    this._life = new Float32Array(n);
    this._col = new Float32Array(n * 3);

    const c = this.preset ? this.preset.color : 0xffffff;
    this._baseR = ((c >> 16) & 255) / 255;
    this._baseG = ((c >> 8) & 255) / 255;
    this._baseB = (c & 255) / 255;

    for (let i = 0; i < n; i++) {
      this._spawn(i, this._rng.range(0, this.preset.lifetime)); // stagger initial ages
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this._pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this._col, 3).setUsage(THREE.DynamicDrawUsage));

    this.material = new THREE.PointsMaterial({
      size: this.preset ? this.preset.size : 0.05,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: this.preset && this.preset.blend === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.name = `particles:${presetName}`;
  }

  setMotionScale(scale) {
    this.motionScale = Math.max(0, Math.min(1, scale));
  }

  _spawn(i, startAge = 0) {
    const p = this.preset;
    const i3 = i * 3;
    const r = this._rng;
    let x = 0;
    let y = 0;
    let z = 0;
    let vx = 0;
    let vy = 0;
    let vz = 0;
    const sp = p.speed;
    switch (p.spawn) {
      case 'disc': {
        const a = r.range(0, Math.PI * 2);
        const rad = Math.sqrt(r.next()) * 0.8;
        x = Math.cos(a) * rad;
        z = Math.sin(a) * rad;
        vy = sp * r.range(0.2, 1);
        break;
      }
      case 'ring': {
        const a = r.range(0, Math.PI * 2);
        x = Math.cos(a) * 0.8;
        z = Math.sin(a) * 0.8;
        vx = Math.cos(a) * sp * 0.5;
        vz = Math.sin(a) * sp * 0.5;
        vy = sp * r.range(-0.2, 0.6);
        break;
      }
      case 'box':
        x = r.range(-0.8, 0.8);
        y = r.range(0, 1.6);
        z = r.range(-0.8, 0.8);
        vx = r.range(-1, 1) * sp * 0.2;
        vy = r.range(-0.5, 0.5) * sp * 0.2;
        vz = r.range(-1, 1) * sp * 0.2;
        break;
      case 'cone': {
        const a = r.range(0, Math.PI * 2);
        const spread = r.range(0, 0.5);
        vx = Math.cos(a) * spread * sp;
        vz = Math.sin(a) * spread * sp;
        vy = sp * r.range(0.6, 1);
        break;
      }
      case 'column':
        x = r.range(-0.5, 0.5);
        z = r.range(-0.5, 0.5);
        y = r.range(0, 2);
        vy = sp * r.range(0.3, 1);
        break;
      case 'point':
      default: {
        const a = r.range(0, Math.PI * 2);
        const el = r.range(0, Math.PI);
        vx = Math.sin(el) * Math.cos(a) * sp;
        vy = Math.cos(el) * sp;
        vz = Math.sin(el) * Math.sin(a) * sp;
        break;
      }
    }
    this._pos[i3] = this.origin.x + x;
    this._pos[i3 + 1] = this.origin.y + y;
    this._pos[i3 + 2] = this.origin.z + z;
    this._vel[i3] = vx;
    this._vel[i3 + 1] = vy;
    this._vel[i3 + 2] = vz;
    this._life[i] = p.lifetime * (0.7 + this._rng.next() * 0.6);
    this._age[i] = startAge;
  }

  _fade(t) {
    const f = this.preset.fade;
    if (f === 'in') return t;
    if (f === 'out') return 1 - t;
    if (f === 'inout') return 1 - Math.abs(t * 2 - 1);
    return 1; // 'none'
  }

  update(dt) {
    if (!this.preset || this.count === 0) return;
    const step = dt * this.motionScale;
    const p = this.preset;
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      this._age[i] += step;
      if (this._age[i] >= this._life[i]) this._spawn(i, 0);
      this._vel[i3 + 1] += p.gravity * step;
      this._pos[i3] += this._vel[i3] * step;
      this._pos[i3 + 1] += this._vel[i3 + 1] * step;
      this._pos[i3 + 2] += this._vel[i3 + 2] * step;
      const f = this._fade(this._age[i] / this._life[i]);
      this._col[i3] = this._baseR * f;
      this._col[i3 + 1] = this._baseG * f;
      this._col[i3 + 2] = this._baseB * f;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  dispose() {
    if (this.points.parent) this.points.parent.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
