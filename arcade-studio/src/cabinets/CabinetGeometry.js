/**
 * Procedural cabinet geometry. The body is an EXTRUDED side silhouette (the iconic arcade profile)
 * with a bevel controlled by bevel_style; a tilted emissive screen, marquee, sloped control deck with
 * per-panel controls, edge trim, and an optional side decal are mounted in the final frame (front +Z).
 * Cabinet shape varies by type via a dimensions table + two special forms (cocktail table, cockpit).
 *
 * Returns a THREE.Group whose userData records the screen/marquee meshes so Cabinet.js can animate them.
 */

import * as THREE from 'three';

const DIMENSIONS = {
  upright: { D: 0.82, H: 1.85, W: 0.72, profile: 'tall' },
  cabaret: { D: 0.76, H: 1.5, W: 0.66, profile: 'tall' },
  cocktail: { D: 1.1, H: 0.66, W: 0.72, profile: 'table' },
  deluxe: { D: 1.0, H: 1.72, W: 1.0, profile: 'wide' },
  cockpit: { D: 1.3, H: 1.5, W: 1.0, profile: 'cockpit' },
  candy: { D: 0.82, H: 1.56, W: 0.74, profile: 'box' },
  slim: { D: 0.7, H: 1.92, W: 0.54, profile: 'tall' },
  widebody: { D: 0.86, H: 1.72, W: 1.12, profile: 'wide' },
};

const BEVEL = {
  hard: { thickness: 0.0, size: 0.0, segments: 1 },
  soft: { thickness: 0.02, size: 0.02, segments: 2 },
  chamfer: { thickness: 0.04, size: 0.035, segments: 1 },
  rounded: { thickness: 0.05, size: 0.05, segments: 3 },
};

export function cabinetDimensions(type) {
  return DIMENSIONS[type] || DIMENSIONS.upright;
}

/** Side silhouette points [x=depth, y=height], front at large x. Closed automatically by THREE.Shape. */
function silhouette(profile, D, H) {
  if (profile === 'box') {
    return [[0, 0], [D, 0], [D, 0.52 * H], [0.74 * D, 0.6 * H], [0.74 * D, 0.86 * H], [D, 0.9 * H], [D, H], [0, H]];
  }
  if (profile === 'wide') {
    return [[0, 0], [D, 0], [D, 0.4 * H], [0.58 * D, 0.54 * H], [0.58 * D, 0.6 * H], [0.9 * D, 0.84 * H], [0.9 * D, 0.92 * H], [D, 0.95 * H], [D, H], [0, H]];
  }
  // 'tall' (and fallback)
  return [[0, 0], [D, 0], [D, 0.42 * H], [0.6 * D, 0.55 * H], [0.6 * D, 0.6 * H], [0.86 * D, 0.85 * H], [0.86 * D, 0.93 * H], [D, 0.96 * H], [D, H], [0, H]];
}

function makeBody(dims, bevel, mat) {
  const shape = new THREE.Shape();
  const pts = silhouette(dims.profile, dims.D, dims.H);
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();

  const b = BEVEL[bevel] || BEVEL.soft;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: dims.W - b.thickness * 2,
    bevelEnabled: b.size > 0,
    bevelThickness: b.thickness,
    bevelSize: b.size,
    bevelSegments: b.segments,
    curveSegments: 2,
  });
  // center on width (local Z) + depth (local X), base at y=0
  geo.translate(-dims.D / 2, 0, -(dims.W - b.thickness * 2) / 2);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = Math.PI / 2; // front (large depth) → world +Z; width → world X
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function plane(w, h, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.castShadow = false;
  return m;
}

function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  return m;
}

/** Build the control set for a given panel token onto a deck at (y, z). */
function buildControls(panel, mats, W, deckY, deckZ) {
  const g = new THREE.Group();
  const addStick = (x) => {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.14, 10), mats.control);
    base.position.set(x, deckY + 0.07, deckZ);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), mats.control);
    ball.position.set(x, deckY + 0.16, deckZ);
    g.add(base, ball);
  };
  const addButtons = (cx, n) => {
    for (let i = 0; i < n; i++) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 12), mats.control);
      btn.position.set(cx + (i % 3) * 0.08 - 0.08, deckY + 0.02, deckZ - Math.floor(i / 3) * 0.08 + 0.04);
      g.add(btn);
    }
  };
  switch (panel) {
    case 'single-stick': addStick(-0.12); addButtons(0.14, 3); break;
    case 'dual-stick': addStick(-0.16); addStick(0.16); break;
    case 'six-button': addStick(-0.18); addButtons(0.12, 6); break;
    case 'trackball': {
      const tb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), mats.control);
      tb.position.set(0, deckY + 0.03, deckZ); g.add(tb); addButtons(0.2, 2); break;
    }
    case 'spinner': {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 20), mats.control);
      sp.position.set(0, deckY + 0.03, deckZ); g.add(sp); break;
    }
    case 'flight-yoke': {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 10), mats.control);
      stem.position.set(0, deckY + 0.09, deckZ);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.05), mats.control);
      bar.position.set(0, deckY + 0.18, deckZ); g.add(stem, bar); break;
    }
    case 'dance-pad': {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(W * 1.1, 0.04, 0.9), mats.panel);
      pad.position.set(0, 0.02, deckZ + 0.7);
      for (let i = 0; i < 4; i++) {
        const arrow = new THREE.Mesh(new THREE.CircleGeometry(0.12, 4), mats.control);
        arrow.rotation.x = -Math.PI / 2;
        arrow.position.set([-0.3, 0, 0.3, 0][i], 0.05, deckZ + 0.7 + [0, -0.3, 0, 0.3][i]);
        pad.add(arrow);
      }
      g.add(pad); break;
    }
    case 'none':
    default:
      break;
  }
  return g;
}

/** Assemble a full cabinet group from a normalized config + prebuilt materials. */
export function buildCabinetMesh(cfg, mats) {
  const dims = cabinetDimensions(cfg.type);
  const group = new THREE.Group();
  group.name = 'cabinet';

  if (cfg.type === 'cocktail') return buildCocktail(cfg, mats, dims, group);

  group.add(makeBody(dims, cfg.bevel_style, mats.body));

  const frontZ = dims.D / 2;

  // tilted emissive screen, recessed into the front upper area
  const screen = plane(dims.W * 0.78, dims.H * 0.34, mats.screen);
  screen.rotation.x = -0.32;
  screen.position.set(0, dims.H * 0.72, frontZ * 0.62);
  screen.userData.role = 'screen';
  group.add(screen);

  // screen bezel
  const bezel = box(dims.W * 0.84, dims.H * 0.4, 0.04, mats.trim);
  bezel.rotation.x = -0.32;
  bezel.position.set(0, dims.H * 0.72, frontZ * 0.6);
  group.add(bezel);

  // marquee
  if (cfg.marquee_style !== 'none') {
    const marquee = box(dims.W * 0.92, dims.H * 0.12, 0.08, mats.marquee);
    marquee.position.set(0, dims.H * 0.94, frontZ * 0.66);
    marquee.userData.role = 'marquee';
    if (cfg.marquee_style === 'halo') marquee.position.y += 0.04;
    group.add(marquee);
  }

  // sloped control deck + controls
  const deckY = dims.H * 0.55;
  const deckZ = frontZ * 0.9;
  const deck = box(dims.W * 0.9, 0.06, dims.D * 0.34, mats.panel);
  deck.rotation.x = 0.28;
  deck.position.set(0, deckY, deckZ);
  group.add(deck);
  if (cfg.type !== 'cockpit') group.add(buildControls(cfg.control_panel, mats, dims.W, deckY + 0.06, deckZ));

  // cockpit gets a seat behind
  if (cfg.type === 'cockpit') {
    const seat = box(dims.W * 0.7, 0.1, 0.5, mats.body);
    seat.position.set(0, 0.45, -dims.D * 0.5);
    const back = box(dims.W * 0.7, 0.6, 0.1, mats.body);
    back.position.set(0, 0.75, -dims.D * 0.7);
    group.add(seat, back);
    group.add(buildControls(cfg.control_panel, mats, dims.W, deckY + 0.06, deckZ));
  }

  // edge trim accents along the front vertical edges
  const trimL = box(0.04, dims.H * 0.8, 0.04, mats.trim);
  trimL.position.set(-dims.W / 2 + 0.02, dims.H * 0.45, frontZ - 0.05);
  const trimR = trimL.clone();
  trimR.position.x = dims.W / 2 - 0.02;
  group.add(trimL, trimR);

  // optional side decal accent
  if (cfg.decal !== 'none') {
    const decal = plane(dims.D * 0.5, dims.H * 0.3, mats.marquee);
    decal.rotation.y = Math.PI / 2;
    decal.position.set(-dims.W / 2 - 0.001, dims.H * 0.55, 0);
    group.add(decal);
  }

  group.userData.dims = dims;
  return group;
}

function buildCocktail(cfg, mats, dims, group) {
  const body = box(dims.W, dims.H, dims.D, mats.body);
  body.position.y = dims.H / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // top-facing screen inset
  const screen = plane(dims.W * 0.7, dims.D * 0.55, mats.screen);
  screen.rotation.x = -Math.PI / 2;
  screen.position.set(0, dims.H + 0.001, 0);
  screen.userData.role = 'screen';
  group.add(screen);

  const rim = box(dims.W * 0.92, 0.04, dims.D * 0.92, mats.trim);
  rim.position.set(0, dims.H, 0);
  group.add(rim);

  group.add(buildControls(cfg.control_panel, mats, dims.W, dims.H, dims.D * 0.32));
  group.userData.dims = dims;
  return group;
}
