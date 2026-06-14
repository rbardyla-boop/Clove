/**
 * Keyboard transform of the current selection: move by grid cell (arrows), rotate 90° (R), change
 * layer ([ / ]), delete (Delete/Backspace). Each action commits an immutable model change (undoable)
 * and respects collision rules for cabinets. Returns true when it handled a key so the Studio can
 * preventDefault.
 */

import { updateElement, removeElement } from '../arcade/ArcadeLayout.js';
import { ROTATIONS } from '../validation/ArcadeLayoutSchema.js';
import { LIMITS } from '../validation/tokens.js';
import { canPlaceAt } from './GridSnap.js';

export class TransformTool {
  constructor({ state }) {
    this.state = state;
  }

  _selected() {
    const sel = this.state.selection;
    if (!sel) return null;
    const el = (this.state.model[sel.kind] || [])[sel.index];
    return el ? { sel, el } : null;
  }

  handleKey(code) {
    const ctx = this._selected();
    if (!ctx) return false;
    const { sel, el } = ctx;
    switch (code) {
      case 'ArrowUp': return this._move(sel, el, 0, -1);
      case 'ArrowDown': return this._move(sel, el, 0, 1);
      case 'ArrowLeft': return this._move(sel, el, -1, 0);
      case 'ArrowRight': return this._move(sel, el, 1, 0);
      case 'KeyR': return this._rotate(sel, el);
      case 'BracketRight': return this._layer(sel, el, 1);
      case 'BracketLeft': return this._layer(sel, el, -1);
      case 'Delete':
      case 'Backspace': return this._delete(sel);
      default: return false;
    }
  }

  _move(sel, el, dx, dy) {
    if (!('gx' in el)) return false;
    const model = this.state.model;
    const gx = Math.max(0, Math.min(model.grid.cols - 1, el.gx + dx));
    const gy = Math.max(0, Math.min(model.grid.rows - 1, el.gy + dy));
    if (gx === el.gx && gy === el.gy) return true;
    if (sel.kind === 'cabinets' && !canPlaceAt(model, 'cabinets', gx, gy)) return true;
    this.state.commit(updateElement(model, sel.kind, sel.index, { gx, gy }), 'move');
    return true;
  }

  _rotate(sel, el) {
    if (!('rotation' in el)) return false;
    const idx = (ROTATIONS.indexOf(el.rotation) + 1) % ROTATIONS.length;
    this.state.commit(updateElement(this.state.model, sel.kind, sel.index, { rotation: ROTATIONS[idx] }), 'rotate');
    return true;
  }

  _layer(sel, el, d) {
    if (!('layer' in el)) return false;
    const layer = Math.max(0, Math.min(LIMITS.MAX_LAYER, el.layer + d));
    this.state.commit(updateElement(this.state.model, sel.kind, sel.index, { layer }), 'layer');
    return true;
  }

  _delete(sel) {
    this.state.commit(removeElement(this.state.model, sel.kind, sel.index), 'delete');
    this.state.clearSelection();
    return true;
  }
}
