/**
 * Input manager: tracks pointer position (NDC), buttons, and keyboard state, and offers a raycast
 * helper for click-selection. Editor tools read this; the player-preview controller reads keys.
 */

import * as THREE from 'three';

export class InputManager {
  constructor(domElement) {
    this.dom = domElement;
    this.pointer = new THREE.Vector2(0, 0); // NDC [-1,1]
    this.keys = new Set();
    this.buttons = new Set();
    this._raycaster = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // reused; only `constant` changes
    this._groundHit = new THREE.Vector3();
    this._listeners = { pointerdown: new Set(), pointerup: new Set(), pointermove: new Set() };
    this._bound = {};
    this._attach();
  }

  on(type, fn) {
    this._listeners[type]?.add(fn);
    return () => this._listeners[type]?.delete(fn);
  }

  _attach() {
    const setPointer = (e) => {
      const rect = this.dom.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    this._bound.down = (e) => {
      setPointer(e);
      this.buttons.add(e.button);
      this._listeners.pointerdown.forEach((fn) => fn(e, this.pointer));
    };
    this._bound.up = (e) => {
      this.buttons.delete(e.button);
      this._listeners.pointerup.forEach((fn) => fn(e, this.pointer));
    };
    this._bound.move = (e) => {
      setPointer(e);
      this._listeners.pointermove.forEach((fn) => fn(e, this.pointer));
    };
    this._bound.keydown = (e) => this.keys.add(e.code);
    this._bound.keyup = (e) => this.keys.delete(e.code);
    this._bound.blur = () => this.keys.clear();

    this.dom.addEventListener('pointerdown', this._bound.down);
    globalThis.addEventListener('pointerup', this._bound.up);
    this.dom.addEventListener('pointermove', this._bound.move);
    globalThis.addEventListener('keydown', this._bound.keydown);
    globalThis.addEventListener('keyup', this._bound.keyup);
    globalThis.addEventListener('blur', this._bound.blur);
  }

  /** Raycast from the current pointer through `camera` against `objects` (recursive). */
  raycast(camera, objects) {
    this._raycaster.setFromCamera(this.pointer, camera);
    return this._raycaster.intersectObjects(objects, true);
  }

  /** Raycast against an infinite horizontal plane at y=height; returns the world hit or null.
   *  Reuses a preallocated plane + hit vector (called on every pointermove during placement). */
  raycastGround(camera, height = 0) {
    this._raycaster.setFromCamera(this.pointer, camera);
    this._groundPlane.constant = -height;
    return this._raycaster.ray.intersectPlane(this._groundPlane, this._groundHit) ? this._groundHit : null;
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this._bound.down);
    globalThis.removeEventListener('pointerup', this._bound.up);
    this.dom.removeEventListener('pointermove', this._bound.move);
    globalThis.removeEventListener('keydown', this._bound.keydown);
    globalThis.removeEventListener('keyup', this._bound.keyup);
    globalThis.removeEventListener('blur', this._bound.blur);
  }
}
