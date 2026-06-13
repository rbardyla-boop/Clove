/**
 * Undo/redo as a bounded stack of immutable model snapshots. The editor commits whole-model changes;
 * each commit pushes the PREVIOUS model so undo restores it. Simple, robust, and snapshot-based —
 * appropriate for a small layout model where structural-sharing complexity isn't worth it.
 */

import { cloneLayout } from '../arcade/ArcadeLayout.js';

const MAX_HISTORY = 60;

export class UndoRedo {
  constructor() {
    this._undo = [];
    this._redo = [];
  }

  /** Record a snapshot of the model state BEFORE a change. Clears the redo stack. */
  push(model) {
    this._undo.push(cloneLayout(model));
    if (this._undo.length > MAX_HISTORY) this._undo.shift();
    this._redo.length = 0;
  }

  /** Undo: returns the previous model given the current one (which is pushed to redo), or null. */
  undo(current) {
    if (!this._undo.length) return null;
    this._redo.push(cloneLayout(current));
    return this._undo.pop();
  }

  /** Redo: returns the next model given the current one (pushed to undo), or null. */
  redo(current) {
    if (!this._redo.length) return null;
    this._undo.push(cloneLayout(current));
    return this._redo.pop();
  }

  get canUndo() {
    return this._undo.length > 0;
  }
  get canRedo() {
    return this._redo.length > 0;
  }

  clear() {
    this._undo.length = 0;
    this._redo.length = 0;
  }
}
