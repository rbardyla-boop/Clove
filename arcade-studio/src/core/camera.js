/**
 * Camera rig with two modes:
 *   - 'orbit'  : editor orbit camera (OrbitControls) for designing the arcade from outside.
 *   - 'player' : first-person, player-scale walkthrough (PreviewCameraController) to inspect at scale.
 * One PerspectiveCamera is shared; switching modes hands control to the right driver and restores a
 * sensible view. World bounds + colliders are injected by the building so player mode is collision-aware.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PreviewCameraController } from '../preview/PreviewCameraController.js';

export class CameraRig {
  constructor(domElement, input) {
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
    this.camera.position.set(18, 16, 22);

    this.orbit = new OrbitControls(this.camera, domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.maxPolarAngle = Math.PI * 0.495; // don't go under the floor
    this.orbit.minDistance = 4;
    this.orbit.maxDistance = 90;
    this.orbit.target.set(0, 1, 0);

    this.player = new PreviewCameraController(this.camera, input, {
      getColliders: () => this._colliders,
      getBounds: () => this._bounds,
    });

    this.mode = 'orbit';
    this._colliders = [];
    this._bounds = null;
    this._spawn = { x: 0, z: 8, yaw: 0 };
    this._savedOrbit = null;
  }

  setColliders(list) {
    this._colliders = list || [];
  }
  setBounds(bounds) {
    this._bounds = bounds;
  }
  setSpawn(x, z, yaw = 0) {
    this._spawn = { x, z, yaw };
  }

  setMode(mode) {
    if (mode === this.mode) return;
    if (mode === 'player') {
      this._savedOrbit = { pos: this.camera.position.clone(), target: this.orbit.target.clone() };
      this.orbit.enabled = false;
      this.player.spawn(this._spawn.x, this._spawn.z, this._spawn.yaw);
      this.player.setEnabled(true);
    } else {
      this.player.setEnabled(false);
      this.orbit.enabled = true;
      if (this._savedOrbit) {
        this.camera.position.copy(this._savedOrbit.pos);
        this.orbit.target.copy(this._savedOrbit.target);
      }
    }
    this.mode = mode;
  }

  toggleMode() {
    this.setMode(this.mode === 'orbit' ? 'player' : 'orbit');
  }

  update(dt) {
    if (this.mode === 'orbit') this.orbit.update();
    else this.player.update(dt);
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Frame the orbit camera on a world-space box center + radius. */
  frame(center, radius) {
    this.orbit.target.copy(center);
    const dist = Math.max(radius * 1.25, 7);
    this.camera.position.set(center.x + dist, center.y + radius * 0.8 + 4, center.z + dist);
    this.orbit.update();
  }
}
