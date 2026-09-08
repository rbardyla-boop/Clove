// Paper Firm graphics beta — real Three.js/WebGL renderer.
//
// Camera contract:
//   angle: orbit yaw in radians, matching the gameplay drag state.
//   zoom: 0.65..1.5, mapped to a perspective FOV (not orthographic scale).
//   world: approximately 1000 x 700 map units, +Y is up.
//
// Worker handoff:
//   import { createPaperRenderer } from './paper-renderer.mjs';
//   const renderer = createPaperRenderer(canvas);
//   renderer.resize();
//   renderer.draw({ field, paper, gone, role, principal, angle, zoom });
//   renderer.dispose();
//
// The canvas must be WebGL-owned. Do not call canvas.getContext('2d') before
// constructing this renderer. This module is presentation-only: it never
// mutates field/paper/gone and never advances gameplay state.

import * as THREE from './vendor/three.module.js';

const PAPER = 0xf5f0df;
const INK = 0x245da0;
const RED = 0xb53a3a;
const RULE = 0x6b9aca;
const TAPE = 0xdccc9d;
const HIGHLIGHT = 0xf4d850;
const WORLD_W = 1000;
const WORLD_H = 700;
const CX = WORLD_W / 2;
const CZ = WORLD_H / 2;
const FONT = 'Caveat';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const num = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function defaultField() {
  return {
    world: { w: WORLD_W, h: WORLD_H },
    zones: [
      { id: 'DESK', x: 70, y: 470, w: 240, h: 150, label: 'THE DESK' },
      { id: 'STAIN', x: 390, y: 70, w: 220, h: 220, label: 'THE STAIN' },
      { id: 'ARCHIVE', x: 690, y: 70, w: 230, h: 210, label: 'ARCHIVE' },
    ],
    relay: { id: 'RELAY', x: 715, y: 455, w: 160, h: 170, label: 'RELAY' },
    players: [],
    scout: { phase: 'idle', x: 500, y: 170 },
    page: { id: 'PAGE-7', phase: 'in_stain', x: 500, y: 170 },
  };
}

function mapPoint(x, y, height = 0) {
  return new THREE.Vector3(num(x, 0) - CX, num(height, 0), num(y, 0) - CZ);
}

function lineGeometry(points) {
  return new THREE.BufferGeometry().setFromPoints(points);
}

function updateLine(line, points) {
  const position = line.geometry.getAttribute('position');
  if (!position || position.count !== points.length) {
    line.geometry.dispose();
    line.geometry = lineGeometry(points);
    return;
  }
  points.forEach((point, index) => position.setXYZ(index, point.x, point.y, point.z));
  position.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

function circlePoints(radius, segments = 14, y = 0) {
  const points = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
  }
  return points;
}

function makeWedgeGeometry(width, depth, low, high) {
  const x = width / 2;
  const z = depth / 2;
  const vertices = new Float32Array([
    -x, 0, -z, x, 0, -z, x, 0, z, -x, 0, z,
    -x, low, -z, x, low, -z, x, high, z, -x, high, z,
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
    4, 7, 6, 4, 6, 5,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const floorVertex = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const floorFragment = `
  uniform vec3 uPaper;
  uniform vec3 uRule;
  varying vec3 vWorldPosition;
  float paperRule(float screenY) {
    float line = abs(fract(screenY / 29.0) - 0.5);
    return 1.0 - smoothstep(0.0, 0.055, line);
  }
  void main() {
    float lines = paperRule(gl_FragCoord.y);
    float margin = 1.0 - smoothstep(0.0, 2.2, abs(vWorldPosition.x + 442.0));
    vec3 color = mix(uPaper, uRule, lines * 0.40);
    color = mix(color, vec3(0.62, 0.24, 0.24), margin * 0.17);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const inkVertex = `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vViewDepth;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDepth = -viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const inkFragment = `
  uniform vec3 uPaper;
  uniform vec3 uInk;
  uniform vec3 uRule;
  uniform float uDensity;
  uniform float uAlpha;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vViewDepth;
  float hatchLine(vec2 point, vec2 direction, float density) {
    float phase = dot(point, direction) * density;
    float distanceToLine = abs(fract(phase) - 0.5);
    float footprint = fwidth(phase);
    float aa = clamp(footprint * 0.5, 0.012, 0.2);
    float stroke = 1.0 - smoothstep(0.045, 0.045 + aa, distanceToLine);
    return mix(stroke, 0.14, smoothstep(0.2, 0.55, footprint));
  }
  float paperRule(float screenY) {
    float line = abs(fract(screenY / 29.0) - 0.5);
    return 1.0 - smoothstep(0.0, 0.055, line);
  }
  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec2 point;
    if (abs(normal.y) > 0.6) point = vWorldPosition.xz;
    else if (abs(normal.x) > 0.6) point = vWorldPosition.zy;
    else point = vWorldPosition.xy;
    float farFade = clamp(vViewDepth / 2200.0, 0.0, 1.0);
    float density = uDensity * mix(1.32, 0.64, farFade);
    float first = hatchLine(point, normalize(vec2(0.88, 0.48)), density);
    float second = hatchLine(point, normalize(vec2(-0.42, 0.91)), density * 0.86);
    float hatch = max(first, second * 0.72);
    float faceVariation = 0.68 + abs(normal.x) * 0.22;
    vec3 paper = mix(uPaper, uRule, paperRule(gl_FragCoord.y) * 0.40);
    vec3 color = mix(paper, uInk, hatch * faceVariation);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createPaperRenderer(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('paper renderer needs a canvas');

  // Construction intentionally acquires WebGL directly. A prior 2D context
  // would make this fail by browser contract, which the caller must avoid.
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  renderer.setClearColor(PAPER, 1);
  renderer.setPixelRatio(clamp(globalThis.devicePixelRatio || 1, 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.sortObjects = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);
  const camera = new THREE.PerspectiveCamera(56, 1, 1, 3600);
  camera.name = 'PaperFirmPerspectiveOrbit';

  const shared = {
    floor: new THREE.ShaderMaterial({
      uniforms: {
        uPaper: { value: new THREE.Color(PAPER) },
        uRule: { value: new THREE.Color(RULE) },
        uRuleSpacing: { value: 29 },
      },
      vertexShader: floorVertex,
      fragmentShader: floorFragment,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    ink: new THREE.ShaderMaterial({
      uniforms: {
        uPaper: { value: new THREE.Color(PAPER) },
        uRule: { value: new THREE.Color(RULE) },
        uInk: { value: new THREE.Color(INK) },
        uDensity: { value: 0.19 },
        uAlpha: { value: 0.78 },
      },
      vertexShader: inkVertex,
      fragmentShader: inkFragment,
      transparent: false,
      depthTest: true,
      depthWrite: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    inkLine: new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.84, toneMapped: false }),
    faintLine: new THREE.LineDashedMaterial({ color: INK, transparent: true, opacity: 0.52, dashSize: 10, gapSize: 7, toneMapped: false }),
    redLine: new THREE.LineBasicMaterial({ color: RED, transparent: true, opacity: 0.9, toneMapped: false }),
    yellow: new THREE.MeshBasicMaterial({ color: HIGHLIGHT, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    tape: new THREE.MeshBasicMaterial({ color: TAPE, transparent: true, opacity: 0.74, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  };

  const worldRoot = new THREE.Group();
  worldRoot.name = 'PaperFirmWorld';
  const staticRoot = new THREE.Group();
  staticRoot.name = 'PaperFirmStatic';
  const dynamicRoot = new THREE.Group();
  dynamicRoot.name = 'PaperFirmDynamic';
  const marksRoot = new THREE.Group();
  marksRoot.name = 'PaperFirmAuthoritativeMarks';
  worldRoot.add(staticRoot, dynamicRoot, marksRoot);
  scene.add(worldRoot);

  let width = 1;
  let height = 1;
  let layoutKey = '';
  let disposed = false;
  let lastState = null;
  let lastAngle = -0.68;
  let lastZoom = 1;
  let playerAssemblies = new Map();
  let spriteLabels = [];
  let staticObjects = [];
  let marks = null;

  function resize() {
    const rect = canvas.getBoundingClientRect?.() || { width: canvas.clientWidth, height: canvas.clientHeight };
    width = Math.max(1, rect.width || canvas.clientWidth || 1);
    height = Math.max(1, rect.height || canvas.clientHeight || 1);
    renderer.setPixelRatio(clamp(globalThis.devicePixelRatio || 1, 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function setCamera(angle, zoom) {
    lastAngle = num(angle, lastAngle);
    lastZoom = clamp(num(zoom, lastZoom), 0.65, 1.5);
    const portraitCompensation = Math.max(0, 1 - camera.aspect) * 18;
    const fov = clamp(56 - (lastZoom - 1) * 18 + portraitCompensation, 42, 82);
    camera.fov = fov;
    camera.near = 1;
    camera.far = 3600;
    const frameScale = clamp(1 / Math.max(camera.aspect, 0.5), 1, 1.6);
    const orbit = 900 * frameScale;
    camera.position.set(Math.sin(lastAngle) * orbit, 620 * frameScale, Math.cos(lastAngle) * orbit);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function createLabel(text, color = INK, worldSize = 25) {
    if (typeof document === 'undefined') return null;
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 128;
    const labelContext = labelCanvas.getContext('2d');
    if (!labelContext) return null;
    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    const sprite = new THREE.Sprite(material);
    sprite.center.set(0.5, 0.5);
    const update = (nextText = text) => {
      text = nextText;
      labelContext.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
      labelContext.font = `600 54px ${FONT}, "Comic Sans MS", cursive`;
      labelContext.textAlign = 'center';
      labelContext.textBaseline = 'middle';
      labelContext.lineJoin = 'round';
      labelContext.lineWidth = 8;
      labelContext.strokeStyle = 'rgba(245,240,223,.9)';
      labelContext.strokeText(String(text), 256, 64);
      labelContext.fillStyle = `#${new THREE.Color(color).getHexString()}`;
      labelContext.fillText(String(text), 256, 64);
      texture.needsUpdate = true;
    };
    sprite.scale.set(worldSize * 9.2, worldSize * 2.2, 1);
    sprite.userData.updateLabel = update;
    spriteLabels.push(sprite);
    update();
    return sprite;
  }

  function addLabel(parent, text, position, color = INK, worldSize = 22) {
    const label = createLabel(text, color, worldSize);
    if (!label) return null;
    label.position.copy(position);
    parent.add(label);
    return label;
  }

  function createLine(points, material, dashed = false) {
    const line = new THREE.Line(lineGeometry(points), material);
    if (dashed) line.computeLineDistances();
    return line;
  }

  function addBox(parent, { x, y, w, d, h, label, ramp = false, elevation = 0 }) {
    const geometry = ramp ? makeWedgeGeometry(w, d, Math.max(8, h * 0.23), h) : new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geometry, shared.ink);
    mesh.position.set(num(x, 0) + w / 2 - CX, (ramp ? 0 : h / 2) + elevation, num(y, 0) + d / 2 - CZ);
    mesh.name = label || 'PaperFirmSolid';
    parent.add(mesh);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), shared.inkLine);
    edges.position.copy(mesh.position);
    edges.name = `${mesh.name}Contour`;
    parent.add(edges);
    const retraced = new THREE.LineSegments(edges.geometry.clone(), shared.faintLine);
    const positions = retraced.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      positions.setXYZ(i, positions.getX(i) + Math.sin(i * 2.7) * 0.65,
        positions.getY(i) + Math.cos(i * 1.9) * 0.5, positions.getZ(i) + Math.sin(i * 1.3) * 0.65);
    }
    retraced.position.copy(mesh.position);
    retraced.computeLineDistances();
    parent.add(retraced);
    staticObjects.push(mesh, edges);
    if (label) addLabel(parent, label, new THREE.Vector3(mesh.position.x, h + 7, mesh.position.z), INK, 19);
    return mesh;
  }

  function clearStatic() {
    disposeObject(staticRoot);
    disposeObject(marksRoot);
    disposeObject(dynamicRoot);
    staticRoot.clear();
    staticObjects = [];
    spriteLabels = [];
    marksRoot.clear();
    marks = null;
    playerAssemblies.forEach((assembly) => disposeObject(assembly));
    playerAssemblies = new Map();
    dynamicRoot.clear();
  }

  function disposeObject(object) {
    object.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (material.map) material.map.dispose();
          if (!Object.values(shared).includes(material)) material.dispose();
        });
      }
    });
  }

  function buildStatic(field) {
    const zones = Array.isArray(field.zones) ? field.zones : defaultField().zones;
    const relay = field.relay || defaultField().relay;
    clearStatic();

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), shared.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.name = 'RuledPaperGround';
    staticRoot.add(floor);
    staticObjects.push(floor);

    zones.forEach((zone) => {
      const corners = [
        mapPoint(zone.x, zone.y, 1), mapPoint(zone.x + zone.w, zone.y, 1),
        mapPoint(zone.x + zone.w, zone.y + zone.h, 1), mapPoint(zone.x, zone.y + zone.h, 1),
        mapPoint(zone.x, zone.y, 1),
      ];
      const outline = createLine(corners, shared.faintLine, true);
      outline.name = `${zone.id}ZoneFootprint`;
      staticRoot.add(outline);
      staticObjects.push(outline);
      addLabel(staticRoot, zone.label || zone.id, mapPoint(zone.x + zone.w / 2, zone.y - 15, 12), INK, 26);
    });

    const desk = zones.find((zone) => zone.id === 'DESK');
    const archive = zones.find((zone) => zone.id === 'ARCHIVE');
    const stain = zones.find((zone) => zone.id === 'STAIN');
    if (stain) {
      for (let ring = 0; ring < 18; ring++) {
        const points = [];
        for (let step = 0; step <= 48; step++) {
          const a = step / 48 * Math.PI * 2;
          const radius = 20 + ring * 3.5 + Math.sin(a * 7 + ring) * 7;
          points.push(mapPoint(stain.x + stain.w / 2 + Math.cos(a) * radius,
            stain.y + stain.h / 2 + Math.sin(a) * radius * .68, 1.5));
        }
        staticRoot.add(createLine(points, shared.faintLine));
      }
    }
    if (desk) {
      // Desk top footprint mirrors field-core: x=105,y=505,w=170,h=90.
      addBox(staticRoot, { x: desk.x + 35, y: desk.y + 35, w: desk.w - 70, d: desk.h - 60, h: 8, elevation: 50, label: '' });
      addBox(staticRoot, { x: desk.x + 75, y: desk.y + 45, w: 65, d: 28, h: 8, elevation: 58, label: '' });
      for (const legX of [desk.x + 42, desk.x + desk.w - 54]) {
        for (const legY of [desk.y + 42, desk.y + desk.h - 54]) {
          addBox(staticRoot, { x: legX, y: legY, w: 12, d: 12, h: 50, label: '' });
        }
      }
    }
    if (archive) {
      // Files/source footprints mirror field-core exactly: 70x150 each.
      addBox(staticRoot, { x: archive.x + 18, y: archive.y + 28, w: 70, d: archive.h - 60, h: 88, label: 'FILES' });
      addBox(staticRoot, { x: archive.x + 130, y: archive.y + 28, w: 70, d: archive.h - 60, h: 88, label: 'SOURCE' });
      addBox(staticRoot, { x: archive.x + 24, y: archive.y + 42, w: 58, d: 22, h: 104, label: '' });
      addBox(staticRoot, { x: archive.x + 136, y: archive.y + 42, w: 58, d: 22, h: 104, label: '' });
    }
    // Relay base footprint mirrors field-core: x=749,y=510,w=92,h=95.
    addBox(staticRoot, { x: relay.x + 34, y: relay.y + 55, w: relay.w - 68, d: relay.h - 75, h: 130, label: 'RELAY' });
    addBox(staticRoot, { x: relay.x + 41, y: relay.y + 66, w: 78, d: 36, h: 30, label: '', ramp: true });
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(5, 9, 170, 5), shared.ink);
    mast.position.set(relay.x + relay.w / 2 - CX, 170, relay.y + relay.h / 2 - CZ);
    mast.name = 'RelayMast';
    staticRoot.add(mast);
    staticObjects.push(mast);
    const mastContour = new THREE.LineSegments(new THREE.EdgesGeometry(mast.geometry), shared.inkLine);
    mastContour.position.copy(mast.position);
    staticRoot.add(mastContour);
    staticObjects.push(mastContour);
    const beacon = new THREE.Mesh(new THREE.ConeGeometry(12, 24, 5), shared.ink);
    beacon.position.set(mast.position.x, 258, mast.position.z);
    beacon.name = 'RelayBeacon';
    staticRoot.add(beacon);
    staticObjects.push(beacon);

    // A small blue-ink compass is part of the page, not a gameplay control.
    const compass = new THREE.Group();
    compass.name = 'PageCompassDoodle';
    compass.position.set(420, 3, -250);
    compass.add(createLine(circlePoints(26, 16, 0), shared.inkLine));
    compass.add(createLine([new THREE.Vector3(-18, 0, 0), new THREE.Vector3(18, 0, 0)], shared.inkLine));
    compass.add(createLine([new THREE.Vector3(0, 0, -18), new THREE.Vector3(0, 0, 18)], shared.inkLine));
    addLabel(compass, 'N', new THREE.Vector3(0, 16, -30), INK, 20);
    staticRoot.add(compass);

    marks = {
      check: createLine([
        new THREE.Vector3(-15, 0, 0), new THREE.Vector3(-4, 0, 11), new THREE.Vector3(17, 0, -12),
      ], shared.redLine),
      rejectX: new THREE.LineSegments(lineGeometry([
        new THREE.Vector3(-14, 0, -14), new THREE.Vector3(14, 0, 14),
        new THREE.Vector3(14, 0, -14), new THREE.Vector3(-14, 0, 14),
      ]), shared.redLine),
      ancestry: createLine([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 1), new THREE.Vector3(2, 0, 2)], shared.redLine),
      route: createLine([new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 1, 1), new THREE.Vector3(2, 1, 2)], shared.inkLine),
      tape: new THREE.Mesh(new THREE.BoxGeometry(64, 1.5, 16), shared.tape),
      highlighter: new THREE.Mesh(new THREE.PlaneGeometry(210, 46), shared.yellow),
    };
    marks.check.name = 'VerifiedRedCheck';
    marks.rejectX.name = 'RejectedRedX';
    marks.ancestry.name = 'AuthoritativeAncestryThread';
    marks.route.name = 'PhysicalScoutRoute';
    marksRoot.add(marks.check, marks.rejectX, marks.ancestry, marks.route, marks.tape, marks.highlighter);
    marks.highlighter.rotation.x = -Math.PI / 2;
    marks.check.visible = false;
    marks.rejectX.visible = false;
    marks.ancestry.visible = false;
    marks.route.visible = false;
    marks.tape.visible = false;
    marks.highlighter.visible = false;

    layoutKey = JSON.stringify({ zones: zones.map((zone) => [zone.id, zone.x, zone.y, zone.w, zone.h]), relay: [relay.x, relay.y, relay.w, relay.h] });
  }

  function createDoodle(label, roleColor = INK) {
    const assembly = new THREE.Group();
    assembly.name = `Doodle_${label}`;
    const lineMaterial = roleColor === RED ? shared.redLine : shared.inkLine;
    assembly.add(createLine(circlePoints(7, 12, 58), lineMaterial));
    assembly.add(createLine([
      new THREE.Vector3(0, 51, 0), new THREE.Vector3(0, 12, 0),
      new THREE.Vector3(-12, 34, 0), new THREE.Vector3(0, 43, 0), new THREE.Vector3(12, 34, 0),
      new THREE.Vector3(0, 12, 0), new THREE.Vector3(-10, 0, 0), new THREE.Vector3(0, 12, 0), new THREE.Vector3(10, 0, 0),
    ], lineMaterial));
    const labelSprite = addLabel(assembly, label, new THREE.Vector3(0, 77, 0), roleColor, 17);
    if (labelSprite) labelSprite.renderOrder = 10;
    dynamicRoot.add(assembly);
    return assembly;
  }

  function updateDoodle(assembly, actor, label) {
    assembly.visible = Boolean(actor);
    if (!actor) return;
    assembly.position.copy(mapPoint(actor.x, actor.y, 0));
    const labelSprite = assembly.children.find((child) => child.isSprite);
    if (labelSprite?.userData.updateLabel && labelSprite.userData.lastText !== label) {
      labelSprite.userData.lastText = label;
      labelSprite.userData.updateLabel(label);
    }
  }

  function updateDynamic(field, state) {
    const players = Array.isArray(field.players) ? field.players : Object.values(field.players || {});
    const activeIds = new Set();
    players.forEach((player) => {
      const id = String(player.id || 'human');
      activeIds.add(id);
      if (!playerAssemblies.has(id)) playerAssemblies.set(id, createDoodle('HUMAN'));
      const label = id === state.principal ? (state.role === 'lead' ? 'YOU · A' : 'YOU · B') : 'HUMAN';
      updateDoodle(playerAssemblies.get(id), player, label);
    });
    playerAssemblies.forEach((assembly, id) => {
      if (!activeIds.has(id)) assembly.visible = false;
    });

    if (!playerAssemblies.has('__scout')) playerAssemblies.set('__scout', createDoodle('SCOUT'));
    updateDoodle(playerAssemblies.get('__scout'), field.scout, 'SCOUT');

    let page = dynamicRoot.getObjectByName('Page7Finding');
    if (!page) {
      page = new THREE.Group();
      page.name = 'Page7Finding';
      const pageMesh = new THREE.Mesh(new THREE.PlaneGeometry(34, 22), new THREE.MeshBasicMaterial({ color: PAPER, transparent: true, opacity: .86, side: THREE.DoubleSide, toneMapped: false }));
      pageMesh.rotation.x = -Math.PI / 2;
      page.add(pageMesh);
      const pageLines = createLine([
        new THREE.Vector3(-12, 1, -5), new THREE.Vector3(12, 1, -5),
        new THREE.Vector3(-12, 1, 0), new THREE.Vector3(12, 1, 0),
        new THREE.Vector3(-12, 1, 5), new THREE.Vector3(8, 1, 5),
      ], shared.inkLine);
      page.add(pageLines);
      const pageLabel = addLabel(page, 'PAGE-7', new THREE.Vector3(0, 12, 0), INK, 15);
      if (pageLabel) pageLabel.renderOrder = 11;
      dynamicRoot.add(page);
    }
    page.visible = Boolean(field.page && field.page.phase !== 'extracted');
    if (page.visible) page.position.copy(mapPoint(field.page.x, field.page.y, 8));

    if (marks) {
      const archive = field.zones?.find((zone) => zone.id === 'ARCHIVE');
      const desk = field.zones?.find((zone) => zone.id === 'DESK');
      const relay = field.relay;
      marks.check.visible = Boolean(state.paper?.sourceVerified && archive);
      if (marks.check.visible) marks.check.position.copy(mapPoint(archive.x + archive.w - 22, archive.y + 18, 96));
      const rejected = Math.max(0, Number(state.gone?.findingsRejected || 0));
      marks.rejectX.visible = Boolean(rejected && desk);
      if (marks.rejectX.visible) marks.rejectX.position.copy(mapPoint(desk.x + 30, desk.y + 25, 77));
      marks.tape.visible = Boolean(state.paper?.harnessPassed && relay);
      if (marks.tape.visible) marks.tape.position.copy(mapPoint(relay.x + relay.w / 2, relay.y + relay.h / 2, 188));
      marks.highlighter.visible = Boolean(state.paper?.complete && relay);
      if (marks.highlighter.visible) marks.highlighter.position.copy(mapPoint(relay.x + relay.w / 2, relay.y + relay.h / 2, 2));
      marks.ancestry.visible = Boolean(state.paper?.ancestryRetrieved && archive && desk);
      if (marks.ancestry.visible) {
        const from = mapPoint(archive.x + archive.w / 2, archive.y + archive.h / 2, 104);
        const to = mapPoint(desk.x + desk.w / 2, desk.y + desk.h / 2, 74);
        const mid = from.clone().lerp(to, .5).add(new THREE.Vector3(0, 100, 0));
        updateLine(marks.ancestry, [from, mid, to]);
      }
      const scoutPhase = field.scout?.phase || 'idle';
      marks.route.visible = scoutPhase !== 'idle';
      if (marks.route.visible) {
        const from = mapPoint(500, 170, 10);
        const to = mapPoint(805, 175, 10);
        const mid = from.clone().lerp(to, .5).add(new THREE.Vector3(0, 16, 0));
        updateLine(marks.route, [from, mid, to]);
      }
    }
  }

  function ensureLayout(field) {
    const zones = Array.isArray(field.zones) ? field.zones : defaultField().zones;
    const relay = field.relay || defaultField().relay;
    const nextKey = JSON.stringify({ zones: zones.map((zone) => [zone.id, zone.x, zone.y, zone.w, zone.h]), relay: [relay.x, relay.y, relay.w, relay.h] });
    if (nextKey !== layoutKey) buildStatic(field);
  }

  function draw(state = {}) {
    if (disposed) return;
    lastState = state;
    resizeIfNeeded();
    setCamera(state.angle, state.zoom);
    const field = state.field || defaultField();
    ensureLayout(field);
    updateDynamic(field, state);
    renderer.render(scene, camera);
  }

  function resizeIfNeeded() {
    const rect = canvas.getBoundingClientRect?.();
    const nextWidth = Math.max(1, rect?.width || canvas.clientWidth || 1);
    const nextHeight = Math.max(1, rect?.height || canvas.clientHeight || 1);
    if (Math.abs(nextWidth - width) > 0.5 || Math.abs(nextHeight - height) > 0.5) resize();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    disposeObject(worldRoot);
    Object.values(shared).forEach((material) => material.dispose());
    renderer.dispose();
    playerAssemblies.clear();
    spriteLabels = [];
  }

  const diagnostics = {};
  Object.defineProperties(diagnostics, {
    backend: { enumerable: true, get: () => 'WebGLRenderer' },
    meshCount: { enumerable: true, get: () => scene.getObjectByProperty ? countObjects(scene, 'isMesh') : 0 },
    lineCount: { enumerable: true, get: () => countObjects(scene, 'isLine') },
    camera: { enumerable: true, get: () => Object.freeze({ mode: 'perspective-orbit', owner: 'paper-renderer', angle: lastAngle, zoom: lastZoom }) },
    projection: { enumerable: true, get: () => Object.freeze({ fov: camera.fov, near: camera.near, far: camera.far, aspect: camera.aspect }) },
    drawCalls: { enumerable: true, get: () => renderer.info.render.calls },
    triangles: { enumerable: true, get: () => renderer.info.render.triangles },
    resources: { enumerable: true, get: () => Object.freeze({ ...renderer.info.memory }) },
    marks: { enumerable: true, get: () => Object.freeze(Object.fromEntries(Object.entries(marks || {}).map(([key, object]) => [key, object.visible]))) },
  });

  function countObjects(root, property) {
    let count = 0;
    root.traverse((object) => { if (object[property]) count += 1; });
    return count;
  }

  resize();
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready.then(() => {
      spriteLabels.forEach((sprite) => sprite.userData.updateLabel?.());
      if (lastState) draw(lastState);
    }).catch(() => {});
  }

  return Object.freeze({ resize, draw, dispose, diagnostics });
}
