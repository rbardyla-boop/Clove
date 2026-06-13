/**
 * Arcade Studio entry point. Wires the renderer, scene, camera rig, base lights, and the arcade
 * building into a render loop, then mounts the editor (selection, placement, inspector, panels,
 * effects, debug). Exposes a deterministic `window.__studio` harness for headless verification.
 *
 * Local-only: no network, no remote submission, no live-world load. Everything authored here is
 * validated JSON data that the creator exports/imports on their own machine.
 */

import * as THREE from 'three';
import { createRenderer, resizeRenderer } from './core/renderer.js';
import { createSceneGraph, applyTheme } from './core/scene.js';
import { PostFX } from './core/post.js';
import { CameraRig } from './core/camera.js';
import { createBaseLights, applyBaseLighting } from './core/lights.js';
import { InputManager } from './core/input.js';
import { RenderLoop } from './core/loop.js';
import { ArcadeBuilding } from './arcade/ArcadeBuilding.js';
import { resolveTheme } from './arcade/ArcadeThemes.js';
import { defaultLayoutModel } from './arcade/ArcadeLayout.js';
import { applyBloomExposure } from './arcade/ArcadeLighting.js';
import { Studio } from './editor/Studio.js';
import { exportArcadeLayout } from './importExport/exportArcadeLayout.js';
import { importArcadeLayout } from './importExport/importArcadeLayout.js';

function boot() {
  const canvas = document.getElementById('viewport');
  const renderer = createRenderer(canvas);
  const { scene, groups } = createSceneGraph();
  const input = new InputManager(canvas);
  const rig = new CameraRig(canvas, input);

  const model = defaultLayoutModel();
  const theme = resolveTheme(model.theme);
  applyTheme(scene, theme);

  const baseLights = createBaseLights(theme, model.lighting.intensity);
  scene.add(baseLights);
  applyBloomExposure(renderer, !!model.lighting.bloom);

  const building = new ArcadeBuilding(groups);
  const postfx = new PostFX(renderer, scene, rig.camera);
  postfx.setBloom(!!model.lighting.bloom);

  const ctx = { THREE, canvas, renderer, scene, groups, input, rig, baseLights, building, postfx, applyTheme, applyBaseLighting, applyBloomExposure };

  const render = () => {
    renderer.info.reset();
    postfx.render();
  };
  const loop = new RenderLoop(render);
  ctx.loop = loop;

  // The Studio owns editor state + UI; it builds the initial model into the scene.
  const studio = new Studio(ctx, model);
  loop.add((dt) => studio.update(dt));

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    resizeRenderer(renderer, rig.camera, w, h);
    rig.setAspect(w / Math.max(1, h));
    postfx.setSize(w, h);
  };
  window.addEventListener('resize', resize);
  resize();
  loop.start();

  // Deterministic headless harness (drive step(dt) manually instead of rAF).
  window.__studio = {
    THREE,
    renderer,
    scene,
    camera: rig.camera,
    loop,
    rig,
    building,
    studio,
    step: (dt = 1 / 60) => loop.step(dt),
    getModel: () => studio.state.getModel(),
    getValidation: () => studio.state.validation,
    setCameraMode: (m) => studio.state.setCameraMode(m),
    drawCalls: () => renderer.info.render.calls,
    // In-page export → import round-trip proof (returns { ok, stable }).
    roundTrip: async () => {
      const exp = await exportArcadeLayout(studio.state.getModel());
      if (!exp.ok) return { ok: false, stable: false, errors: exp.report.errors };
      const imp = await importArcadeLayout(exp.json);
      return { ok: imp.ok, stable: imp.ok && imp.hash === exp.hash, hash: exp.hash };
    },
    ready: true,
  };
}

try {
  boot();
} catch (err) {
  console.error('[arcade-studio] boot failed', err);
  const el = document.getElementById('boot-error');
  if (el) {
    el.hidden = false;
    el.textContent = `Boot error: ${err && err.message ? err.message : err}`;
  }
}
