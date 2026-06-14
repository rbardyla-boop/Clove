/**
 * Canonical editor state: the working layout model, current selection, camera mode, active tool, grid
 * snap, layer visibility, and live validation status. All model edits flow through `commit`, which
 * snapshots for undo and re-validates against the closed schema. A tiny event bus lets the Studio +
 * panels react. Editor (UI) state is intentionally separate from render state.
 */

import { UndoRedo } from './UndoRedo.js';
import { cloneLayout } from '../arcade/ArcadeLayout.js';
import { buildArcadeLayout } from '../importExport/exportArcadeLayout.js';
import { validateArcadeLayout } from '../validation/validateArcadeLayout.js';

export class EditorState {
  constructor(model) {
    this.model = model;
    this.selection = null; // { kind, index }
    this.cameraMode = 'orbit';
    this.tool = { type: 'select' };
    this.snap = true;
    this.layerVisibility = { environment: true, props: true, signs: true, cabinets: true, lights: true };
    this.history = new UndoRedo();
    this.validation = { ok: true, errors: [], kind: 'arcade_building_layout' };
    this._subs = new Map();
    this._revalidate();
  }

  on(event, fn) {
    if (!this._subs.has(event)) this._subs.set(event, new Set());
    this._subs.get(event).add(fn);
    return () => this._subs.get(event)?.delete(fn);
  }

  emit(event, data) {
    this._subs.get(event)?.forEach((fn) => fn(data));
    if (event !== 'any') this._subs.get('any')?.forEach((fn) => fn({ event, data }));
  }

  getModel() {
    return this.model;
  }

  _revalidate() {
    this.validation = validateArcadeLayout(buildArcadeLayout(this.model));
    return this.validation;
  }

  /** Commit a new whole-model state with undo support + revalidation. */
  commit(nextModel, label = 'edit') {
    this.history.push(this.model);
    this.model = nextModel;
    this._revalidate();
    this.emit('model', { reason: label });
  }

  /** Replace the model wholesale (load/import/new) — clears history + selection. */
  loadModel(nextModel, label = 'load') {
    this.history.clear();
    this.model = cloneLayout(nextModel);
    this.selection = null;
    this._revalidate();
    this.emit('model', { reason: label });
    this.emit('selection', null);
  }

  undo() {
    const prev = this.history.undo(this.model);
    if (prev) {
      this.model = prev;
      this._clampSelection();
      this._revalidate();
      this.emit('model', { reason: 'undo' });
      this.emit('selection', this.selection);
    }
  }

  redo() {
    const next = this.history.redo(this.model);
    if (next) {
      this.model = next;
      this._clampSelection();
      this._revalidate();
      this.emit('model', { reason: 'redo' });
      this.emit('selection', this.selection);
    }
  }

  _clampSelection() {
    if (!this.selection) return;
    const arr = this.model[this.selection.kind];
    if (!Array.isArray(arr) || this.selection.index >= arr.length) this.selection = null;
  }

  select(kind, index) {
    this.selection = kind == null ? null : { kind, index };
    this.emit('selection', this.selection);
  }

  clearSelection() {
    this.selection = null;
    this.emit('selection', null);
  }

  setCameraMode(mode) {
    if (mode !== 'orbit' && mode !== 'player') return;
    this.cameraMode = mode;
    this.emit('camera', mode);
  }

  toggleCameraMode() {
    this.setCameraMode(this.cameraMode === 'orbit' ? 'player' : 'orbit');
  }

  setTool(tool) {
    this.tool = tool;
    this.emit('tool', tool);
  }

  toggleSnap() {
    this.snap = !this.snap;
    this.emit('snap', this.snap);
  }

  setLayerVisible(group, visible) {
    this.layerVisibility[group] = visible;
    this.emit('layers', this.layerVisibility);
  }
}
