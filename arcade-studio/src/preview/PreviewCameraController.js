/**
 * Player-scale walkthrough controller: WASD/arrows to move at eye height, drag to look. Movement is
 * COLLISION-AWARE against an axis-aligned collider list (cabinets, props, walls) and clamped to the
 * world bounds, so the preview feels like standing in the arcade. No pointer-lock requirement.
 */

import * as THREE from 'three';
import { clamp } from '../utils/math.js';

const EYE_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.35;
const WALK_SPEED = 4.2;
const SPRINT_SPEED = 7.5;
const LOOK_SPEED = 0.0026;

export class PreviewCameraController {
  constructor(camera, input, { getColliders = () => [], getBounds = () => null } = {}) {
    this.camera = camera;
    this.input = input;
    this.getColliders = getColliders;
    this.getBounds = getBounds;
    this.enabled = false;
    this.yaw = 0;
    this.pitch = -0.05;
    this.position = new THREE.Vector3(0, EYE_HEIGHT, 8);
    this._dragging = false;
    this._last = new THREE.Vector2();
    this._tmp = new THREE.Vector3();

    this._offDown = input.on('pointerdown', (e) => {
      if (!this.enabled) return;
      this._dragging = true;
      this._last.set(e.clientX, e.clientY);
    });
    this._offUp = input.on('pointerup', () => {
      this._dragging = false;
    });
    this._offMove = input.on('pointermove', (e) => {
      if (!this.enabled || !this._dragging) return;
      const dx = e.clientX - this._last.x;
      const dy = e.clientY - this._last.y;
      this._last.set(e.clientX, e.clientY);
      this.yaw -= dx * LOOK_SPEED * 60 * 0.016;
      this.pitch = clamp(this.pitch - dy * LOOK_SPEED * 60 * 0.016, -1.2, 1.2);
    });
  }

  spawn(x, z, yaw = 0) {
    this.position.set(x, EYE_HEIGHT, z);
    this.yaw = yaw;
    this.pitch = -0.05;
    this._apply();
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) this._apply();
  }

  update(dt) {
    if (!this.enabled) return;
    const keys = this.input.keys;
    let fwd = 0;
    let strafe = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) fwd += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) fwd -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) strafe += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) strafe -= 1;
    if (keys.has('KeyQ')) this.yaw += dt * 1.6;
    if (keys.has('KeyE')) this.yaw -= dt * 1.6;

    if (fwd !== 0 || strafe !== 0) {
      const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? SPRINT_SPEED : WALK_SPEED) * dt;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      // forward is -Z when yaw=0
      const dirX = -sin * fwd + cos * strafe;
      const dirZ = -cos * fwd - sin * strafe;
      const len = Math.hypot(dirX, dirZ) || 1;
      this._tryMove(this.position.x + (dirX / len) * speed, this.position.z + (dirZ / len) * speed);
    }
    this._apply();
  }

  _tryMove(nx, nz) {
    const bounds = this.getBounds();
    let x = nx;
    let z = nz;
    if (bounds) {
      x = clamp(x, bounds.minX + PLAYER_RADIUS, bounds.maxX - PLAYER_RADIUS);
      z = clamp(z, bounds.minZ + PLAYER_RADIUS, bounds.maxZ - PLAYER_RADIUS);
    }
    // Resolve axes independently so the player slides along obstacles instead of sticking.
    if (!this._blocked(x, this.position.z)) this.position.x = x;
    if (!this._blocked(this.position.x, z)) this.position.z = z;
  }

  _blocked(x, z) {
    const colliders = this.getColliders();
    for (const b of colliders) {
      if (x > b.minX - PLAYER_RADIUS && x < b.maxX + PLAYER_RADIUS && z > b.minZ - PLAYER_RADIUS && z < b.maxZ + PLAYER_RADIUS) {
        return true;
      }
    }
    return false;
  }

  _apply() {
    this.camera.position.copy(this.position);
    this._tmp.set(
      this.position.x - Math.sin(this.yaw) * Math.cos(this.pitch),
      this.position.y + Math.sin(this.pitch),
      this.position.z - Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    this.camera.lookAt(this._tmp);
  }

  dispose() {
    this._offDown?.();
    this._offUp?.();
    this._offMove?.();
  }
}
