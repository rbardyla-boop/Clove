/**
 * Studio — top-level editor orchestrator. Owns editor state, the tools (select/placement/transform),
 * the camera+preview controller, the effect preview, the panels (library/inspector/export/debug), the
 * toolbar, and the per-frame update order. Rebuilds the scene from the model on every commit and keeps
 * the debug panel fed. Editor (UI) state is kept separate from render state; the model is the single
 * source of truth that flows into both the scene and the validated exports.
 */

import * as THREE from 'three';
import { EditorState } from './EditorState.js';
import { SelectionManager } from './SelectionManager.js';
import { PlacementTool } from './PlacementTool.js';
import { TransformTool } from './TransformTool.js';
import { AssetLibraryPanel } from './AssetLibraryPanel.js';
import { InspectorPanel } from './InspectorPanel.js';
import { ExportPanel } from './ExportPanel.js';
import { el, button, dropdown } from './dom.js';
import { PreviewController } from '../preview/PreviewController.js';
import { EffectPreview } from '../effects/EffectPreview.js';
import { ReducedMotion } from '../effects/ReducedMotion.js';
import { DebugPanel } from '../debug/DebugPanel.js';
import { PerformanceStats } from '../debug/PerformanceStats.js';
import { resolveTheme } from '../arcade/ArcadeThemes.js';
import { defaultLayoutModel, setLayoutField } from '../arcade/ArcadeLayout.js';
import { SCREEN_SHAKE_NAMES, PARTICLE_NAMES } from '../validation/tokens.js';

const PLACED_KINDS = ['cabinets', 'props', 'signs', 'walls', 'zones', 'entrances'];

export class Studio {
  constructor(ctx, model) {
    this.ctx = ctx;
    this.state = new EditorState(model);
    this.effects = new EffectPreview(ctx.groups.fx);
    this.reducedMotion = new ReducedMotion();
    this._gridHelper = null;
    this._debugAccum = 0;

    const camera = ctx.rig.camera;
    const helpers = ctx.groups.helpers;
    this.selection = new SelectionManager({ state: this.state, building: ctx.building, input: ctx.input, camera, helpersGroup: helpers });
    this.placement = new PlacementTool({ state: this.state, building: ctx.building, input: ctx.input, camera, helpersGroup: helpers });
    this.transform = new TransformTool({ state: this.state });
    this.preview = new PreviewController({ rig: ctx.rig, helpersGroup: helpers });

    this.library = new AssetLibraryPanel({ state: this.state, root: document.getElementById('library-panel') });
    this.inspector = new InspectorPanel({ state: this.state, root: document.getElementById('inspector-panel') });
    this.exportPanel = new ExportPanel({ state: this.state, root: document.getElementById('export-panel') });
    this.debug = new DebugPanel(document.getElementById('debug-panel'));
    this._buildToolbar(document.getElementById('toolbar'));

    this.state.on('model', () => this.rebuildScene());
    this.state.on('camera', (mode) => { this.preview.setMode(mode); this._syncToolbar(); });
    this.state.on('layers', () => this.applyLayers());
    this.state.on('snap', () => { if (this._gridHelper) this._gridHelper.visible = this.state.snap; this._syncToolbar(); });
    this.state.on('tool', (tool) => { if (tool.type === 'place') this.state.clearSelection(); });
    this.state.on('selection', () => this._syncToolbar());
    this.reducedMotion.subscribe(() => this.applyMotion());

    this.rebuildScene();
    this.preview.setMode('orbit');
    this._frameCamera();
    this._attachKeys();
    this._syncToolbar();
  }

  rebuildScene() {
    const m = this.state.getModel();
    const theme = resolveTheme(m.theme);
    this.ctx.building.setMotionScale(this.reducedMotion.motionScale());
    this.ctx.building.build(m);
    this.ctx.applyTheme(this.ctx.scene, theme);
    this.ctx.applyBaseLighting(this.ctx.baseLights, theme, m.lighting?.intensity || 'medium');
    this.ctx.applyBloomExposure(this.ctx.renderer, m.lighting?.bloom !== false);
    this.ctx.postfx?.setBloom(m.lighting?.bloom !== false);
    this.preview.refresh(this.ctx.building);
    this.effects.setMotionScale(this.reducedMotion.motionScale());
    this.effects.setParticle(m.effects?.particle || 'none');
    this._rebuildGrid(m);
    this.applyLayers();
    this.selection.refreshOutline();
  }

  _rebuildGrid(m) {
    if (this._gridHelper) {
      this.ctx.groups.helpers.remove(this._gridHelper);
      this._gridHelper.geometry.dispose();
      this._gridHelper.material.dispose();
    }
    const size = Math.max(m.grid.cols, m.grid.rows) * 2;
    const grid = new THREE.GridHelper(size, Math.max(m.grid.cols, m.grid.rows), 0x2b5cff, 0x182030);
    grid.position.y = 0.02;
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    grid.visible = this.state.snap;
    this._gridHelper = grid;
    this.ctx.groups.helpers.add(grid);
  }

  applyLayers() {
    const L = this.state.layerVisibility;
    this.ctx.groups.environment.visible = L.environment;
    this.ctx.groups.props.visible = L.props;
    this.ctx.groups.signs.visible = L.signs;
    this.ctx.groups.cabinets.visible = L.cabinets;
    this.ctx.groups.lights.visible = L.lights;
  }

  applyMotion() {
    const s = this.reducedMotion.motionScale();
    this.ctx.building.setMotionScale(s);
    this.effects.setMotionScale(s);
  }

  _frameCamera() {
    const b = this.ctx.building.getBounds();
    this.ctx.rig.frame(new THREE.Vector3(0, 1, 0), Math.max(b.maxX, b.maxZ));
  }

  update(dt) {
    this.preview.update(dt); // positions the camera (orbit or player)
    this.effects.applyShake(this.ctx.rig.camera, dt); // transient post-camera offset
    this.ctx.building.update(dt); // cabinet attract animation
    this.effects.update(dt); // particles

    this._debugAccum += dt;
    if (this._debugAccum >= 0.25) {
      this._debugAccum = 0;
      this._sampleDebug();
    }
  }

  _sampleDebug() {
    const stats = PerformanceStats.sample(this.ctx.scene, this.ctx.renderer, this.ctx.loop);
    const m = this.state.getModel();
    const exportedCount = PLACED_KINDS.reduce((n, k) => n + (m[k]?.length || 0), 0);
    const sel = this.state.selection;
    const v = this.state.validation;
    this.debug.update({
      ...stats,
      particleCount: this.effects.activeParticleCount,
      exportedCount,
      selected: sel ? `${sel.kind.slice(0, -1)} #${sel.index}` : 'none',
      cameraMode: this.state.cameraMode,
      validation: v.ok ? 'valid' : `${v.errors.length} issue(s)`,
      validationOk: v.ok,
    });
  }

  _buildToolbar(root) {
    root.appendChild(el('span', { class: 'brand', text: 'ARCADE STUDIO' }));

    this._camBtn = button('Camera: Orbit', () => this.state.toggleCameraMode());
    this._snapBtn = button('Grid: On', () => this.state.toggleSnap());
    root.appendChild(el('div', { class: 'tb-group' }, [
      this._camBtn,
      this._snapBtn,
      button('Undo', () => this.state.undo()),
      button('Redo', () => this.state.redo()),
      button('Select', () => this.state.setTool({ type: 'select' })),
    ]));

    const motion = dropdown('motion', ['auto', 'on', 'off'], this.reducedMotion.override, (v) => this.reducedMotion.setOverride(v));

    const shakeSel = el('select', { class: 'field-select' }, SCREEN_SHAKE_NAMES.map((n) => el('option', { value: n, text: n })));
    const shakeTest = button('Test shake', () => this.effects.triggerShake(shakeSel.value));
    this._shakeSel = shakeSel;

    const particleSel = el('select', { class: 'field-select' },
      ['none', ...PARTICLE_NAMES].map((n) => el('option', { value: n, text: n })));
    particleSel.addEventListener('change', () => {
      const m = this.state.getModel();
      this.state.commit(setLayoutField(m, 'effects', { ...m.effects, particle: particleSel.value }), 'particle');
    });
    this._particleSel = particleSel;

    root.appendChild(el('div', { class: 'tb-group' }, [
      el('label', { class: 'tb-mini' }, ['shake', shakeSel]),
      shakeTest,
      el('label', { class: 'tb-mini' }, ['particles', particleSel]),
      el('label', { class: 'tb-mini' }, ['motion', motion.querySelector('select')]),
    ]));

    const layerToggles = ['environment', 'props', 'signs', 'cabinets', 'lights'].map((g) => {
      const cb = el('input', { type: 'checkbox', onChange: (e) => this.state.setLayerVisible(g, e.target.checked) });
      cb.checked = true;
      return el('label', { class: 'tb-layer' }, [cb, g]);
    });
    root.appendChild(el('div', { class: 'tb-group' }, [el('span', { class: 'tb-mini-label', text: 'layers' }), ...layerToggles]));

    root.appendChild(el('div', { class: 'tb-group' }, [
      button('New Hall', () => this.state.loadModel(defaultLayoutModel(), 'reset'), 'btn-primary'),
    ]));
  }

  _syncToolbar() {
    if (this._camBtn) this._camBtn.textContent = `Camera: ${this.state.cameraMode === 'orbit' ? 'Orbit' : 'Player'}`;
    if (this._snapBtn) this._snapBtn.textContent = `Grid: ${this.state.snap ? 'On' : 'Off'}`;
    const m = this.state.getModel();
    if (this._particleSel) this._particleSel.value = m.effects?.particle || 'none';
    if (this._shakeSel && m.effects?.screen_shake) this._shakeSel.value = m.effects.screen_shake;
  }

  _attachKeys() {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
      if (e.key === 'Escape') { this.state.setTool({ type: 'select' }); this.state.clearSelection(); return; }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) this.state.redo(); else this.state.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); this.state.redo(); return; }
      if (e.code === 'KeyG') { this.state.toggleSnap(); return; }
      if (e.code === 'KeyP') { e.preventDefault(); this.state.toggleCameraMode(); return; }
      if (this.state.cameraMode === 'orbit' && this.state.selection) {
        if (this.transform.handleKey(e.code)) e.preventDefault();
      }
    });
  }
}
