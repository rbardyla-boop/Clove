/**
 * Debug panel: renders the runtime stat rows required for a creator-tool foundation — FPS, draw-call
 * estimate, triangles, visible objects, active lights, particle count, selected object, exported object
 * count, camera mode, and validation status. Updated on a throttle from the Studio loop.
 */

import { el, clear } from '../editor/dom.js';

const ROWS = [
  ['fps', 'FPS'],
  ['drawCalls', 'Draw calls'],
  ['triangles', 'Triangles'],
  ['visibleObjects', 'Visible objects'],
  ['activeLights', 'Active lights'],
  ['particleCount', 'Particles'],
  ['exportedCount', 'Exported objects'],
  ['selected', 'Selected'],
  ['cameraMode', 'Camera'],
  ['validation', 'Validation'],
];

export class DebugPanel {
  constructor(root) {
    this.root = root;
    this.cells = {};
    this.render();
  }

  render() {
    clear(this.root);
    this.root.appendChild(el('h2', { class: 'panel-heading', text: 'Debug' }));
    const table = el('div', { class: 'debug-grid' });
    for (const [key, label] of ROWS) {
      const value = el('span', { class: 'debug-val', text: '—' });
      this.cells[key] = value;
      table.appendChild(el('div', { class: 'debug-row' }, [el('span', { class: 'debug-key', text: label }), value]));
    }
    this.root.appendChild(table);
  }

  update(data) {
    for (const [key] of ROWS) {
      if (key in data && this.cells[key]) this.cells[key].textContent = String(data[key]);
    }
    if (this.cells.validation) {
      this.cells.validation.className = `debug-val ${data.validationOk ? 'ok' : 'bad'}`;
    }
    if (this.cells.fps) {
      const fps = data.fps || 0;
      this.cells.fps.className = `debug-val ${fps >= 50 ? 'ok' : fps >= 30 ? 'warn' : 'bad'}`;
    }
  }
}
