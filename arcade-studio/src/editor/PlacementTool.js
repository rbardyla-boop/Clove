/**
 * Placement tool. When the active tool is `{ type:'place', payload }`, a translucent ghost follows the
 * pointer snapped to the grid; it turns red where placement is blocked (collision-aware). Clicking on a
 * free cell adds the element to the model and commits it. Stays active for rapid repeat placement until
 * Escape (handled by the Studio).
 */

import * as THREE from 'three';
import { addElement } from '../arcade/ArcadeLayout.js';
import { cabinetPreset } from '../cabinets/CabinetPresets.js';
import { snapToCell, cellCenter, canPlaceAt } from './GridSnap.js';

const GHOST_SIZE = {
  cabinets: [1.4, 1.9, 1.0],
  props: [0.8, 1.0, 0.8],
  signs: [2.0, 1.0, 0.2],
  entrances: [1.8, 2.6, 0.3],
};

export class PlacementTool {
  constructor({ state, building, input, camera, helpersGroup }) {
    this.state = state;
    this.building = building;
    this.input = input;
    this.camera = camera;
    this.helpers = helpersGroup;
    this.ghost = null;
    this.payload = null;
    this._cell = { gx: 0, gy: 0 };
    this._dragStart = new THREE.Vector2();

    state.on('tool', (tool) => {
      if (tool.type === 'place') this._activate(tool.payload);
      else this._deactivate();
    });
    this._offMove = input.on('pointermove', () => this._updateGhost());
    this._offDown = input.on('pointerdown', (e) => this._dragStart.set(e.clientX, e.clientY));
    this._offUp = input.on('pointerup', (e) => {
      if (e.button !== 0 || !this.payload) return;
      if (Math.hypot(e.clientX - this._dragStart.x, e.clientY - this._dragStart.y) > 5) return;
      this._place();
    });
  }

  _activate(payload) {
    this._deactivate();
    this.payload = payload;
    const [w, h, d] = GHOST_SIZE[payload.kind] || GHOST_SIZE.props;
    const mat = new THREE.MeshBasicMaterial({ color: 0x36f5a2, transparent: true, opacity: 0.4, depthWrite: false });
    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    this.ghost.position.y = h / 2;
    this.ghost.name = 'placement-ghost';
    this.helpers.add(this.ghost);
    this._updateGhost();
  }

  _deactivate() {
    this.payload = null;
    if (this.ghost) {
      this.helpers.remove(this.ghost);
      this.ghost.geometry.dispose();
      this.ghost.material.dispose();
      this.ghost = null;
    }
  }

  _updateGhost() {
    if (!this.ghost || !this.payload) return;
    const ground = this.input.raycastGround(this.camera, 0);
    if (!ground) return;
    const model = this.state.getModel();
    const cell = snapToCell(ground.x, ground.z, model);
    this._cell = cell;
    const center = cellCenter(cell.gx, cell.gy, model);
    this.ghost.position.x = center.x;
    this.ghost.position.z = center.z;
    const free = canPlaceAt(model, this.payload.kind, cell.gx, cell.gy, this._defaultLayer());
    this.ghost.material.color.setHex(free ? 0x36f5a2 : 0xff5a5a);
  }

  _defaultLayer() {
    return this.payload.kind === 'cabinets' ? 2 : this.payload.kind === 'props' ? 1 : null;
  }

  _place() {
    const model = this.state.getModel();
    const { gx, gy } = this._cell;
    const element = this._makeElement(this.payload, gx, gy);
    if (!element) return;
    if (!canPlaceAt(model, this.payload.kind, gx, gy, element.layer ?? null)) return;
    this.state.commit(addElement(model, this.payload.kind, element), `place ${this.payload.kind}`);
  }

  _makeElement(payload, gx, gy) {
    switch (payload.kind) {
      case 'props':
        return { type: payload.type, gx, gy, rotation: 0, layer: 1 };
      case 'cabinets':
        return { cabinet: cabinetPreset(payload.preset), gx, gy, rotation: 0, layer: 2 };
      case 'signs':
        return { style: payload.style || 'blade', text: payload.text || 'ARCADE', placement: payload.placement || 'apex', gx, gy, palette: payload.palette || 'neon-cyan' };
      case 'entrances':
        return { style: payload.style || 'neon-portal', gx, gy, facing: payload.facing || 'south' };
      default:
        return null;
    }
  }

  dispose() {
    this._deactivate();
    this._offMove?.();
    this._offDown?.();
    this._offUp?.();
  }
}
