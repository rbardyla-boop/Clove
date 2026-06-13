/**
 * Click-selection + selection outline. On a pointer click (select tool), raycasts the building's
 * selectable objects, resolves the hit to a { kind, index } via building.resolvePick, and updates
 * editor state. Maintains a Box3-based wireframe outline in the helpers group that tracks the current
 * selection across scene rebuilds.
 */

import * as THREE from 'three';

export class SelectionManager {
  constructor({ state, building, input, camera, helpersGroup }) {
    this.state = state;
    this.building = building;
    this.input = input;
    this.camera = camera;
    this.helpers = helpersGroup;
    this.outline = null;
    this._dragStart = new THREE.Vector2();

    this._offDown = input.on('pointerdown', (e) => {
      if (e.button !== 0) return;
      this._dragStart.set(e.clientX, e.clientY);
    });
    this._offUp = input.on('pointerup', (e) => {
      if (e.button !== 0) return;
      if (this.state.cameraMode === 'player') return;
      if (this.state.tool.type !== 'select') return;
      // ignore if this was a camera drag (moved more than a few px)
      if (Math.hypot(e.clientX - this._dragStart.x, e.clientY - this._dragStart.y) > 5) return;
      this._pick();
    });

    this.state.on('selection', () => this.refreshOutline());
    this.state.on('model', () => this.refreshOutline());
  }

  _pick() {
    const hits = this.input.raycast(this.camera, this.building.getSelectables());
    for (const hit of hits) {
      const sel = this.building.resolvePick(hit);
      if (sel) {
        this.state.select(sel.kind, sel.index);
        return;
      }
    }
    this.state.clearSelection();
  }

  _findObject(sel) {
    for (const obj of this.building.getSelectables()) {
      const pick = obj.userData.pick;
      if (!pick || pick.kind !== sel.kind) continue;
      if (pick.instanced) return null; // instanced props → outline via element center
      if (pick.index === sel.index) return obj;
    }
    return null;
  }

  refreshOutline() {
    if (this.outline) {
      this.helpers.remove(this.outline);
      this.outline.geometry?.dispose();
      this.outline = null;
    }
    const sel = this.state.selection;
    if (!sel) return;

    let box;
    const obj = this._findObject(sel);
    if (obj) {
      box = new THREE.Box3().setFromObject(obj);
    } else {
      const c = this.building.worldCenterOf(sel.kind, sel.index);
      if (!c) return;
      box = new THREE.Box3(new THREE.Vector3(c.x - 0.7, 0, c.z - 0.7), new THREE.Vector3(c.x + 0.7, 1.4, c.z + 0.7));
    }
    const helper = new THREE.Box3Helper(box, new THREE.Color(0x36f5a2));
    helper.name = 'selection-outline';
    this.helpers.add(helper);
    this.outline = helper;
  }

  dispose() {
    this._offDown?.();
    this._offUp?.();
  }
}
