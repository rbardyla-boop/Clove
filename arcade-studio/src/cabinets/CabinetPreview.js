/**
 * Standalone single-cabinet preview rig for the inspector. Owns a small renderer/scene/camera so the
 * creator sees the cabinet they're configuring in isolation, auto-rotating, while the main viewport
 * shows the whole hall. Self-contained; safe to mount/unmount.
 */

import * as THREE from 'three';
import { Cabinet } from './Cabinet.js';

export class CabinetPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    this.camera.position.set(2.2, 1.6, 3.0);
    this.camera.lookAt(0, 0.9, 0);

    this.scene.add(new THREE.AmbientLight(0x8090b0, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x4080ff, 0.5);
    rim.position.set(-3, 2, -3);
    this.scene.add(rim);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.cabinet = null;
    this._t = 0;
    this._raf = 0;
    this.running = false;
  }

  setConfig(cfg) {
    if (this.cabinet) this.cabinet.dispose();
    this.cabinet = new Cabinet(cfg);
    this.pivot.add(this.cabinet.group);
    this._resize();
  }

  _resize() {
    const w = this.canvas.clientWidth || 220;
    const h = this.canvas.clientHeight || 220;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  step(dt) {
    this._t += dt;
    this.pivot.rotation.y = this._t * 0.5;
    if (this.cabinet) this.cabinet.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const frame = (now) => {
      if (!this.running) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      this.step(dt);
      this._raf = requestAnimationFrame(frame);
    };
    this._raf = requestAnimationFrame(frame);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  dispose() {
    this.stop();
    if (this.cabinet) this.cabinet.dispose();
    this.renderer.dispose();
  }
}
