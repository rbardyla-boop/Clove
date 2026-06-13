/**
 * Asset library panel: closed palettes of things you can add. Cabinet presets + props start the
 * placement tool (ghost-follow), signs/entrances start placement with defaults, and zones/walls are
 * appended with a safe default footprint (edited afterwards via the inspector list).
 */

import { el, button, section, clear } from './dom.js';
import { addElement } from '../arcade/ArcadeLayout.js';
import { CABINET_PRESET_NAMES } from '../cabinets/CabinetPresets.js';
import { PROP_TYPES, SIGN_STYLES, ENTRANCE_STYLES } from '../validation/tokens.js';

export class AssetLibraryPanel {
  constructor({ state, root }) {
    this.state = state;
    this.root = root;
    this.render();
  }

  _place(payload) {
    this.state.setTool({ type: 'place', payload });
  }

  _addZone(kind) {
    const model = this.state.getModel();
    const cols = Math.min(4, model.grid.cols);
    const rows = Math.min(3, model.grid.rows);
    const zone = kind === 'lighting'
      ? { kind: 'lighting', preset: 'neon-strip', palette: 'neon-cyan', gx: 0, gy: 0, cols, rows: 1, intensity: 'medium' }
      : { kind: 'ambience', preset: 'glow-pool', palette: 'neon-violet', gx: 0, gy: 0, cols, rows, intensity: 'low' };
    this.state.commit(addElement(model, 'zones', zone), 'add zone');
  }

  _addWall() {
    const model = this.state.getModel();
    const wall = { material: 'panel-dark', gx: 0, gy: 0, length: Math.min(4, model.grid.cols), orientation: 'north' };
    this.state.commit(addElement(model, 'walls', wall), 'add wall');
  }

  render() {
    clear(this.root);
    this.root.appendChild(el('h2', { class: 'panel-heading', text: 'Asset Library' }));

    const cabBtns = CABINET_PRESET_NAMES.map((name) =>
      button(name, () => this._place({ kind: 'cabinets', preset: name }), 'lib-btn'));
    this.root.appendChild(section('Cabinets', el('div', { class: 'lib-grid' }, cabBtns)));

    const propBtns = PROP_TYPES.map((type) =>
      button(type, () => this._place({ kind: 'props', type }), 'lib-btn'));
    this.root.appendChild(section('Props', el('div', { class: 'lib-grid' }, propBtns)));

    const signBtns = SIGN_STYLES.filter((s) => s !== 'none').map((style) =>
      button(style, () => this._place({ kind: 'signs', style }), 'lib-btn'));
    this.root.appendChild(section('Signs', el('div', { class: 'lib-grid' }, signBtns)));

    const entBtns = ENTRANCE_STYLES.filter((s) => s !== 'none').map((style) =>
      button(style, () => this._place({ kind: 'entrances', style }), 'lib-btn'));
    this.root.appendChild(section('Entrances', el('div', { class: 'lib-grid' }, entBtns)));

    this.root.appendChild(section('Zones & Structure', el('div', { class: 'lib-grid' }, [
      button('+ lighting zone', () => this._addZone('lighting'), 'lib-btn'),
      button('+ ambience zone', () => this._addZone('ambience'), 'lib-btn'),
      button('+ wall segment', () => this._addWall(), 'lib-btn'),
    ])));

    this.root.appendChild(el('p', { class: 'lib-hint', text: 'Click an item, then click a grid cell to place. Esc cancels. Arrows move, R rotates, Del deletes the selection.' }));
  }
}
