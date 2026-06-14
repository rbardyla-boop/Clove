/**
 * Export / import panel. Exports the layout (and the selected cabinet) to validated, canonical JSON
 * with a content hash, offers a LOCAL download (Blob → anchor; no network), and imports JSON back
 * through the deny-by-default validators. Includes a one-click round-trip self-test that proves
 * export → import reproduces an identical hash. Shows the live layout validation status.
 */

import { el, button, section, clear } from './dom.js';
import { exportArcadeLayout } from '../importExport/exportArcadeLayout.js';
import { importArcadeLayout } from '../importExport/importArcadeLayout.js';
import { exportArcadeAsset } from '../importExport/exportArcadeAsset.js';
import { importArcadeAsset } from '../importExport/importArcadeAsset.js';
import { addElement } from '../arcade/ArcadeLayout.js';
import { cabinetAtCell } from './GridSnap.js';
import { slugify } from '../utils/ids.js';

function download(filename, text) {
  if (typeof document === 'undefined') return;
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function findFreeCell(model) {
  for (let gy = 0; gy < model.grid.rows; gy++) {
    for (let gx = 0; gx < model.grid.cols; gx++) {
      if (!cabinetAtCell(model, gx, gy)) return { gx, gy };
    }
  }
  return { gx: 0, gy: 0 };
}

export class ExportPanel {
  constructor({ state, root }) {
    this.state = state;
    this.root = root;
    this.lastResult = null;
    state.on('model', () => this._refreshStatus());
    state.on('selection', () => this._refreshStatus());
    this.render();
  }

  render() {
    clear(this.root);
    this.root.appendChild(el('h2', { class: 'panel-heading', text: 'Export & Validation' }));

    this.statusLine = el('div', { class: 'status-line' });
    this.root.appendChild(this.statusLine);

    this.output = el('textarea', { class: 'json-output', rows: '10', readonly: 'true', spellcheck: 'false' });
    this.importInput = el('textarea', { class: 'json-input', rows: '5', placeholder: 'Paste layout or cabinet JSON to import…', spellcheck: 'false' });
    this.message = el('div', { class: 'export-msg' });

    this.root.appendChild(section('Export', [
      el('div', { class: 'btn-row' }, [
        button('Export Layout', () => this._exportLayout(), 'btn-primary'),
        button('Export Cabinet', () => this._exportCabinet()),
        button('Round-trip test', () => this._roundTrip()),
      ]),
      this.output,
      el('div', { class: 'btn-row' }, [
        button('Download JSON', () => this._downloadLast()),
        button('Copy', () => this._copyLast()),
      ]),
    ]));

    this.root.appendChild(section('Import', [
      this.importInput,
      el('div', { class: 'btn-row' }, [
        button('Import Layout', () => this._importLayout(), 'btn-primary'),
        button('Import Cabinet', () => this._importCabinet()),
      ]),
    ]));

    this.root.appendChild(this.message);
    this._refreshStatus();
  }

  _refreshStatus() {
    if (!this.statusLine) return;
    const v = this.state.validation;
    this.statusLine.className = `status-line ${v.ok ? 'ok' : 'bad'}`;
    this.statusLine.textContent = v.ok
      ? '✓ layout valid — schema-clean, no forbidden surface'
      : `✕ ${v.errors.length} issue(s): ${v.errors.slice(0, 3).join('; ')}`;
  }

  async _exportLayout() {
    const res = await exportArcadeLayout(this.state.getModel());
    this.lastResult = { name: `${slugify(this.state.getModel().layout_id)}.layout.json`, text: res.json, ok: res.ok };
    this.output.value = res.json;
    this._msg(res.ok ? `Layout exported · ${res.hash}` : `Invalid: ${res.report.errors.slice(0, 3).join('; ')}`, res.ok);
  }

  async _exportCabinet() {
    const sel = this.state.selection;
    if (!sel || sel.kind !== 'cabinets') {
      this._msg('Select a cabinet first to export it as a standalone asset.', false);
      return;
    }
    const m = this.state.getModel();
    const placement = m.cabinets[sel.index];
    const assetId = slugify(`${m.layout_id}-cab-${sel.index}`);
    const res = await exportArcadeAsset({
      asset_id: assetId,
      display_name: placement.cabinet.marquee_text || 'Arcade Cabinet',
      cabinet: placement.cabinet,
    });
    this.lastResult = { name: `${assetId}.cabinet.json`, text: res.json, ok: res.ok };
    this.output.value = res.json;
    this._msg(res.ok ? `Cabinet exported · ${res.hash}` : `Invalid: ${res.report.errors.slice(0, 3).join('; ')}`, res.ok);
  }

  async _roundTrip() {
    const exp = await exportArcadeLayout(this.state.getModel());
    if (!exp.ok) {
      this._msg(`Round-trip blocked — layout invalid: ${exp.report.errors[0]}`, false);
      return;
    }
    const imp = await importArcadeLayout(exp.json);
    const pass = imp.ok && imp.hash === exp.hash;
    this.output.value = exp.json;
    this._msg(pass ? `Round-trip PASS · hash stable ${exp.hash.slice(0, 22)}…` : `Round-trip FAIL: ${(imp.errors || []).join('; ')}`, pass);
  }

  async _importLayout() {
    const imp = await importArcadeLayout(this.importInput.value.trim());
    if (imp.ok) {
      this.state.loadModel(imp.layout, 'import');
      this._msg(`Layout imported · ${imp.hash}`, true);
    } else {
      this._msg(`Import rejected (${imp.errors.length}): ${imp.errors.slice(0, 4).join('; ')}`, false);
    }
  }

  async _importCabinet() {
    const imp = await importArcadeAsset(this.importInput.value.trim());
    if (!imp.ok) {
      this._msg(`Cabinet rejected (${imp.errors.length}): ${imp.errors.slice(0, 4).join('; ')}`, false);
      return;
    }
    const m = this.state.getModel();
    const cell = findFreeCell(m);
    const placement = { cabinet: imp.asset.cabinet, source_hash: imp.hash, gx: cell.gx, gy: cell.gy, rotation: 0, layer: 2 };
    this.state.commit(addElement(m, 'cabinets', placement), 'import cabinet');
    this._msg(`Cabinet imported + placed at ${cell.gx},${cell.gy}`, true);
  }

  _downloadLast() {
    if (this.lastResult) download(this.lastResult.name, this.lastResult.text);
  }

  async _copyLast() {
    if (this.lastResult && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(this.lastResult.text);
        this._msg('Copied to clipboard.', true);
      } catch {
        this._msg('Clipboard unavailable.', false);
      }
    }
  }

  _msg(text, ok) {
    this.message.className = `export-msg ${ok ? 'ok' : 'bad'}`;
    this.message.textContent = text;
  }
}
