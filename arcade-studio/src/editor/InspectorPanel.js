/**
 * Inspector panel. With a selection, shows closed dropdowns for that element (cabinet config, sign,
 * prop, entrance, zone, wall) + placement (rotation/layer) + delete. With no selection, shows
 * layout-level settings (name, theme, floor, grid, lighting, effects, metadata) and lists of
 * non-clickable elements (zones/walls) so they can be selected/edited. Every control is a closed
 * option set or bounded text — there is no free-form runtime input.
 */

import { el, dropdown, textField, button, section, clear } from './dom.js';
import { updateElement, removeElement, setLayoutField, resizeGrid } from '../arcade/ArcadeLayout.js';
import { CABINET_ENUMS, CABINET_KEYS } from '../validation/ArcadeAssetSchema.js';
import { ENUMS, INTENSITY_LEVELS, ROTATIONS } from '../validation/ArcadeLayoutSchema.js';
import { THEMES, PALETTES, LIMITS, SCREEN_SHAKE_NAMES, PARTICLE_NAMES } from '../validation/tokens.js';
import { slugify } from '../utils/ids.js';

function numberDropdown(label, min, max, value, onChange) {
  const opts = [];
  for (let i = min; i <= max; i++) opts.push(String(i));
  return dropdown(label, opts, String(value), (v) => onChange(parseInt(v, 10)));
}

function checkbox(label, checked, onChange) {
  const input = el('input', { type: 'checkbox', class: 'field-check', onChange: (e) => onChange(e.target.checked) });
  if (checked) input.checked = true;
  return el('label', { class: 'field field-inline' }, [el('span', { class: 'field-label', text: label }), input]);
}

export class InspectorPanel {
  constructor({ state, root }) {
    this.state = state;
    this.root = root;
    state.on('selection', () => this.render());
    state.on('model', () => this.render());
    this.render();
  }

  _model() {
    return this.state.getModel();
  }

  _commitEl(patch, label) {
    const sel = this.state.selection;
    this.state.commit(updateElement(this._model(), sel.kind, sel.index, patch), label);
  }

  _commitCabinet(field, value) {
    const sel = this.state.selection;
    const el0 = this._model()[sel.kind][sel.index];
    this._commitEl({ cabinet: { ...el0.cabinet, [field]: value } }, `cabinet ${field}`);
  }

  _delete() {
    const sel = this.state.selection;
    this.state.commit(removeElement(this._model(), sel.kind, sel.index), 'delete');
    this.state.clearSelection();
  }

  _setField(key, value, label) {
    this.state.commit(setLayoutField(this._model(), key, value), label || key);
  }

  render() {
    clear(this.root);
    this.root.appendChild(el('h2', { class: 'panel-heading', text: 'Inspector' }));
    const sel = this.state.selection;
    if (sel) this._renderSelection(sel);
    else this._renderLayout();
  }

  _renderSelection(sel) {
    const m = this._model();
    const e = (m[sel.kind] || [])[sel.index];
    if (!e) {
      this.root.appendChild(el('p', { class: 'lib-hint', text: 'Selection no longer exists.' }));
      return;
    }
    this.root.appendChild(el('p', { class: 'sel-tag', text: `${sel.kind.slice(0, -1)} #${sel.index}` }));

    if (sel.kind === 'cabinets') this._renderCabinet(e);
    else if (sel.kind === 'props') this._renderProp(e);
    else if (sel.kind === 'signs') this._renderSign(e);
    else if (sel.kind === 'entrances') this._renderEntrance(e);
    else if (sel.kind === 'zones') this._renderZone(e);
    else if (sel.kind === 'walls') this._renderWall(e);

    this.root.appendChild(button('Delete', () => this._delete(), 'btn-danger'));
  }

  _renderCabinet(e) {
    const fields = CABINET_KEYS.filter((k) => k !== 'marquee_text').map((field) =>
      dropdown(field, CABINET_ENUMS[field], e.cabinet[field], (v) => this._commitCabinet(field, v)));
    this.root.appendChild(section('Cabinet', [
      ...fields,
      textField('marquee_text', e.cabinet.marquee_text || '', LIMITS.MARQUEE_BYTES, (v) => this._commitCabinet('marquee_text', v)),
    ]));
    this._renderPlacement(e, true);
  }

  _renderProp(e) {
    this.root.appendChild(section('Prop', [
      dropdown('type', ENUMS.propType, e.type, (v) => this._commitEl({ type: v }, 'prop type')),
    ]));
    this._renderPlacement(e, true);
  }

  _renderSign(e) {
    this.root.appendChild(section('Sign', [
      dropdown('style', ENUMS.signStyle, e.style, (v) => this._commitEl({ style: v }, 'sign')),
      textField('text', e.text || '', LIMITS.MARQUEE_BYTES, (v) => this._commitEl({ text: v }, 'sign text')),
      dropdown('placement', ENUMS.signPlacement, e.placement, (v) => this._commitEl({ placement: v }, 'sign placement')),
      dropdown('palette', ENUMS.palette, e.palette, (v) => this._commitEl({ palette: v }, 'sign palette')),
    ]));
  }

  _renderEntrance(e) {
    this.root.appendChild(section('Entrance', [
      dropdown('style', ENUMS.entranceStyle, e.style, (v) => this._commitEl({ style: v }, 'entrance')),
      dropdown('facing', ENUMS.facing, e.facing, (v) => this._commitEl({ facing: v }, 'entrance facing')),
    ]));
  }

  _renderZone(e) {
    const presets = e.kind === 'lighting' ? ENUMS.lightingZonePreset : ENUMS.ambienceZonePreset;
    const m = this._model();
    this.root.appendChild(section('Zone', [
      dropdown('kind', ENUMS.zoneKind, e.kind, (v) => {
        const preset = v === 'lighting' ? 'neon-strip' : 'glow-pool';
        this._commitEl({ kind: v, preset }, 'zone kind');
      }),
      dropdown('preset', presets, e.preset, (v) => this._commitEl({ preset: v }, 'zone preset')),
      dropdown('palette', ENUMS.palette, e.palette || 'neon-cyan', (v) => this._commitEl({ palette: v }, 'zone palette')),
      dropdown('intensity', INTENSITY_LEVELS, e.intensity || 'medium', (v) => this._commitEl({ intensity: v }, 'zone intensity')),
      numberDropdown('cols', 1, Math.max(1, m.grid.cols - e.gx), e.cols, (v) => this._commitEl({ cols: v }, 'zone cols')),
      numberDropdown('rows', 1, Math.max(1, m.grid.rows - e.gy), e.rows, (v) => this._commitEl({ rows: v }, 'zone rows')),
    ]));
  }

  _renderWall(e) {
    const m = this._model();
    const lenMax = (e.orientation === 'north' || e.orientation === 'south') ? m.grid.cols - e.gx : m.grid.rows - e.gy;
    this.root.appendChild(section('Wall', [
      dropdown('material', ENUMS.wallMaterial, e.material, (v) => this._commitEl({ material: v }, 'wall material')),
      dropdown('orientation', ENUMS.facing, e.orientation, (v) => this._commitEl({ orientation: v }, 'wall orientation')),
      numberDropdown('length', 1, Math.max(1, lenMax), e.length, (v) => this._commitEl({ length: v }, 'wall length')),
    ]));
  }

  _renderPlacement(e, withLayer) {
    const children = [
      dropdown('rotation', ROTATIONS.map(String), String(e.rotation), (v) => this._commitEl({ rotation: parseInt(v, 10) }, 'rotation')),
    ];
    if (withLayer) children.push(numberDropdown('layer', 0, LIMITS.MAX_LAYER, e.layer, (v) => this._commitEl({ layer: v }, 'layer')));
    this.root.appendChild(section('Placement', children));
  }

  _renderLayout() {
    const m = this._model();
    this.root.appendChild(section('Layout', [
      textField('name', m.display_name || '', LIMITS.NAME_BYTES, (v) => this._setField('display_name', v, 'name')),
      dropdown('theme', THEMES, m.theme, (v) => this._setField('theme', v, 'theme')),
      dropdown('floor', ENUMS.floorMaterial, m.floor.material, (v) => this._setField('floor', { material: v }, 'floor')),
      numberDropdown('grid cols', LIMITS.GRID_MIN, LIMITS.GRID_MAX, m.grid.cols, (v) => this.state.commit(resizeGrid(m, v, m.grid.rows), 'grid')),
      numberDropdown('grid rows', LIMITS.GRID_MIN, LIMITS.GRID_MAX, m.grid.rows, (v) => this.state.commit(resizeGrid(m, m.grid.cols, v), 'grid')),
    ]));

    const lighting = m.lighting || {};
    this.root.appendChild(section('Lighting', [
      dropdown('ambient', PALETTES, lighting.ambient || 'neon-blue', (v) => this._setField('lighting', { ...lighting, ambient: v }, 'lighting')),
      dropdown('accent', PALETTES, lighting.accent || 'neon-cyan', (v) => this._setField('lighting', { ...lighting, accent: v }, 'lighting')),
      dropdown('intensity', INTENSITY_LEVELS, lighting.intensity || 'medium', (v) => this._setField('lighting', { ...lighting, intensity: v }, 'lighting')),
      checkbox('bloom', lighting.bloom !== false, (c) => this._setField('lighting', { ...lighting, bloom: c }, 'lighting')),
    ]));

    const effects = m.effects || {};
    this.root.appendChild(section('Effects', [
      dropdown('screen_shake', SCREEN_SHAKE_NAMES, effects.screen_shake || 'subtle', (v) => this._setField('effects', { ...effects, screen_shake: v }, 'effects')),
      dropdown('particle', ['none', ...PARTICLE_NAMES], effects.particle || 'none', (v) => this._setField('effects', { ...effects, particle: v }, 'effects')),
    ]));

    const meta = m.metadata || {};
    this.root.appendChild(section('Metadata', [
      textField('tags (comma)', (meta.tags || []).join(', '), 120, (v) => {
        const tags = v.split(',').map((t) => slugify(t, LIMITS.TAG_BYTES)).filter((t) => t && t !== 'untitled').slice(0, LIMITS.MAX_TAGS);
        this._setField('metadata', { ...meta, tags }, 'tags');
      }),
      textField('note', meta.note || '', LIMITS.NOTE_BYTES, (v) => this._setField('metadata', { ...meta, note: v }, 'note')),
    ]));

    this._renderElementList('Zones', 'zones', m.zones || [], (z, i) => `${z.kind}:${z.preset} @${z.gx},${z.gy}`);
    this._renderElementList('Walls', 'walls', m.walls || [], (w, i) => `${w.material} ${w.orientation} ×${w.length}`);
  }

  _renderElementList(title, kind, list, labelFn) {
    if (!list.length) return;
    const rows = list.map((item, i) =>
      el('div', { class: 'list-row' }, [
        button(labelFn(item, i), () => this.state.select(kind, i), 'list-btn'),
      ]));
    this.root.appendChild(section(title, rows));
  }
}
