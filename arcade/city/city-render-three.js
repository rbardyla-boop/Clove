/**
 * Neon Circuit — City Block Three.js renderer (orthographic top-down).
 *
 * Uses the globally-loaded THREE (vendored /scripts/three.min.js — no bundler). The
 * scene orchestrator only calls this when window.THREE exists; if the WebGL context
 * fails to initialize this throws and the orchestrator falls back to the 2D renderer.
 * Pure presentation — no authority, no network. 3D-capable foundation for the Phase
 * 4B verticality/vehicle work.
 *
 * Phase 4F: `applyBlockStyle(style)` retints the arcade-front edge + portal glow from
 * the server-validated canonical block style. Visual only; geometry/collision untouched.
 * (The sidewalk-trim accent is a 2D-canvas nicety; the 3D sidewalk planes are left as-is.)
 */
import { styleToAccents } from './city-stewardship.mjs';

const VIEWPORT_UNITS = 560;
const COL = {
  asphalt: 0x080610, road: 0x14141f, sidewalk: 0x1c1c2a, building: 0x191324,
  arcade: 0xff2d95, portal: 0x22e0ff, vehicle: 0x2a2030, me: 0x22e0ff, other: 0xffb020,
};

export function createThreeRenderer(canvas, layout) {
  const THREE = window.THREE;
  if (!THREE) throw new Error('THREE not loaded');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setClearColor(COL.asphalt, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 4000);
  camera.up.set(0, 0, -1); // world +y (south) renders downward on screen

  const W = layout.world.w;
  const H = layout.world.h;

  const plane = (w, h, color, y) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; return m;
  };
  const box = (w, hh, d, color, y) => new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), new THREE.MeshBasicMaterial({ color }));

  // ground + roads + sidewalks
  const ground = plane(W, H, COL.asphalt, 0); ground.position.set(W / 2, 0, H / 2); scene.add(ground);
  for (const rd of layout.roads) { const p = plane(rd.w, rd.h, COL.road, 0.5); p.position.set(rd.x + rd.w / 2, 0.5, rd.y + rd.h / 2); scene.add(p); }
  for (const s of layout.sidewalks) { const p = plane(s.w, s.h, COL.sidewalk, 0.3); p.position.set(s.x + s.w / 2, 0.3, s.y + s.h / 2); scene.add(p); }

  // buildings (extruded for a readable silhouette)
  const arcadeEdges = []; // Phase 4F: arcade-front meshes the steward style retints
  for (const b of layout.buildings) {
    const isArcade = b.kind === 'arcade';
    const hh = isArcade ? 26 : 40;
    const m = box(b.w, hh, b.h, isArcade ? COL.building : COL.building);
    m.position.set(b.x + b.w / 2, hh / 2, b.y + b.h / 2);
    scene.add(m);
    // accent edge for the arcade
    const edge = new THREE.Mesh(new THREE.BoxGeometry(b.w + 6, 4, b.h + 6), new THREE.MeshBasicMaterial({ color: isArcade ? COL.arcade : 0x3a2a55 }));
    edge.position.set(b.x + b.w / 2, hh + 2, b.y + b.h / 2);
    scene.add(edge);
    if (isArcade) arcadeEdges.push(edge);
  }

  // parked vehicles (scaffold)
  for (const p of layout.props) { const m = box(p.w, 10, p.h, COL.vehicle); m.position.set(p.x + p.w / 2, 5, p.y + p.h / 2); scene.add(m); }

  // portals (glowing pad)
  const portalMeshes = []; // Phase 4F: street-light accent retints these
  for (const z of layout.portals) { const p = plane(z.w, z.h, COL.portal, 1.0); p.position.set(z.x + z.w / 2, 1.0, z.y + z.h / 2); scene.add(p); portalMeshes.push(p); }

  // Phase 4F: retint accents from the server-validated canonical block style (visual only).
  function applyBlockStyle(style) {
    if (!style) return;
    const a = styleToAccents(style);
    for (const m of arcadeEdges) m.material.color.set(a.arcade_front.color);
    for (const m of portalMeshes) m.material.color.set(a.street_lights.color);
  }

  // dynamic player markers: id -> group
  const markers = new Map();
  function ensureMarker(id, color, isSelf) {
    let g = markers.get(id);
    if (!g) {
      g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(isSelf ? 13 : 11, 16, 12), new THREE.MeshBasicMaterial({ color }));
      body.position.y = 14;
      const nub = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 4), new THREE.MeshBasicMaterial({ color }));
      nub.name = 'nub'; nub.position.set(16, 14, 0);
      g.add(body); g.add(nub);
      scene.add(g);
      markers.set(id, g);
    }
    return g;
  }
  function syncMarker(p, color, isSelf) {
    const g = ensureMarker(p.id, color, isSelf);
    g.position.set(p.x, 0, p.y);
    g.rotation.y = -(p.facing || 0); // face the movement direction (XZ)
  }

  let cssW = 0;
  let cssH = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = canvas.clientWidth || window.innerWidth;
    cssH = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(cssW, cssH, false);
    const aspect = cssW / Math.max(1, cssH);
    const halfH = VIEWPORT_UNITS / 2;
    const halfW = halfH * aspect;
    camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  }
  resize();

  function draw(view) {
    const me = view.me || { x: W / 2, y: H / 2 };
    camera.position.set(me.x, 800, me.y);
    camera.lookAt(me.x, 0, me.y);

    const present = new Set();
    if (view.me) { syncMarker(view.me, COL.me, true); present.add(view.me.id); }
    for (const o of (view.others || [])) { syncMarker(o, COL.other, false); present.add(o.id); }
    for (const [id, g] of markers) { if (!present.has(id)) { scene.remove(g); markers.delete(id); } }

    renderer.render(scene, camera);
  }

  return { name: 'three', draw, resize, applyBlockStyle };
}
