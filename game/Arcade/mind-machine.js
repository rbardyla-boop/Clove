/* Operator's Deck: an input-dependent, deterministic circuit in a 3D tray. */
"use strict";
let immScene, immCamera, immRenderer;
let immLevel = 1,
  immBoard,
  immGroup,
  immPulse,
  immRun = null,
  immLastFrame = 0,
  immSet = 0;
const immContainer = document.getElementById("imm-container");
const immButtons = document.getElementById("imm-nodes");
const immHelp = document.getElementById("imm-help");
const immAction = document.getElementById("imm-action-btn");
const immTiles = new Map();
const immAt = (cell) =>
  new THREE.Vector3((cell.x - 2) * 2.2, 0.4, (cell.y - 2) * 2.2);
const immNames = ["right", "down", "left", "up"];
const immFrameA = new THREE.Vector3(),
  immFrameB = new THREE.Vector3(),
  immPulseTarget = new THREE.Vector3();
const immEffectOff = new URLSearchParams(location.search).get("immFx") === "0";
let immMetrics = {
  draws: 0,
  activeTrail: 0,
  latched: 0,
  pooledFx: 0,
  disposedResets: 0,
};
let immFx = { trail: [], contacts: [], hit: null, hitAge: 1, failAge: 1 };
Object.defineProperty(window, "__immRenderDebug", {
  configurable: false,
  enumerable: false,
  get() {
    return Object.freeze({
      ...immMetrics,
      effectsOff: immEffectOff,
      reducedMotion: Boolean(typeof deckCalm !== "undefined" && deckCalm),
      fullFX: !immEffectOff && !(typeof deckCalm !== "undefined" && deckCalm),
    });
  },
});
function immCalm() {
  return immEffectOff || (typeof deckCalm !== "undefined" && deckCalm);
}
function immState(state, message) {
  immContainer.dataset.state = state;
  if (message) immHelp.textContent = message;
  immAction.disabled = state === "running" || state === "won";
  immAction.textContent =
    state === "running"
      ? "FOLLOW THE PULSE…"
      : state === "won"
        ? "CONNECTED"
        : "TEST ROUTE";
  for (const b of immButtons.querySelectorAll("button"))
    b.disabled = state === "running" || state === "won";
}
function immMaterial(color, roughness = 0.65, emissive = 0x000000) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.12,
    emissive,
  });
}
function immAddBox(parent, geometry, material, y) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
  parent.add(mesh);
  return mesh;
}
function immUpdateConductor(cell, t) {
  const dir = MindRoute.directions[cell.direction],
    y = cell.kind === "source" ? 0.84 : 0.56;
  for (const line of [t.conductor, t.hot]) {
    if (!line) continue;
    const a = line.geometry.getAttribute("position");
    a.setXYZ(0, dir[0] * 0.08, y, dir[1] * 0.08);
    a.setXYZ(1, dir[0] * 0.84, y, dir[1] * 0.84);
    a.needsUpdate = true;
  }
}
function immClearRouteVisuals() {
  for (const t of immTiles.values()) {
    t.latch = 0;
    t.tile.position.y = t.restY;
    t.tile.material.emissive.setHex(0x000000);
    t.tile.material.emissiveIntensity = 1;
    if (t.hot) t.hot.visible = false;
  }
  immFx.hit = null;
  immFx.hitAge = 1;
  immFx.failAge = 1;
  for (const effect of [...immFx.trail, ...immFx.contacts])
    effect.visible = false;
  immMetrics.activeTrail = 0;
  immMetrics.latched = 0;
}
function immTileTargetY(tile) {
  return tile.latch ? tile.restY - 0.03 : tile.restY;
}
function immRouteSpeed() {
  return 3;
}
function immResetEffects() {
  immFx = { trail: [], contacts: [], hit: null, hitAge: 1, failAge: 1 };
  if (!immGroup || immEffectOff) return;
  const trailGeo = new THREE.SphereGeometry(0.105, 8, 6),
    trailMat = new THREE.MeshBasicMaterial({
      color: 0xffb84c,
      transparent: true,
      opacity: 0.72,
    });
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(trailGeo, trailMat);
    m.visible = false;
    immGroup.add(m);
    immFx.trail.push(m);
  }
  const contactGeo = new THREE.TorusGeometry(0.28, 0.035, 6, 18),
    contactMat = new THREE.MeshBasicMaterial({
      color: 0xffd67a,
      transparent: true,
      opacity: 0.9,
    });
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(contactGeo, contactMat);
    m.rotation.x = Math.PI / 2;
    m.visible = false;
    immGroup.add(m);
    immFx.contacts.push(m);
  }
  immMetrics.pooledFx = 9;
}
function initIMM() {
  try {
    immScene = new THREE.Scene();
    immScene.background = new THREE.Color(
      currentTheme === "light" ? 0xecebe5 : 0x0a0a12,
    );
    immCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 150);
    immRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    immRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    document.getElementById("imm-canvas").appendChild(immRenderer.domElement);
    immScene.add(new THREE.HemisphereLight(0xfff4dc, 0x11131d, 1.5));
    const light = new THREE.DirectionalLight(0xffedc5, 2.3);
    light.position.set(2, 14, 8);
    immScene.add(light);
    buildIMMLevel();
    new ResizeObserver(resizeIMM).observe(immContainer);
    requestAnimationFrame(animateIMM);
  } catch (error) {
    immAction.disabled = true;
    immHelp.textContent =
      "The 3D circuit could not start. Other arcade tabs are still available.";
    console.error("Mind Machine initialization:", error);
  }
}
function buildIMMLevel() {
  immRun = null;
  if (immGroup) {
    immScene.remove(immGroup);
    immGroup.traverse((object) => {
      object.geometry?.dispose();
      if (object.material)
        for (const m of [].concat(object.material)) m.dispose();
    });
    immMetrics.disposedResets++;
  }
  immGroup = new THREE.Group();
  immScene.add(immGroup);
  immTiles.clear();
  immButtons.replaceChildren();
  immBoard = MindRoute.makeBoard(immLevel, currentSeed + immSet * 113);
  const trayMat = immMaterial(0x282a35, 0.82),
    rimMat = immMaterial(0x555866, 0.72),
    grooveMat = immMaterial(0x171923, 0.9);
  immAddBox(immGroup, new THREE.BoxGeometry(12.5, 0.32, 12.5), trayMat, -0.58);
  immAddBox(immGroup, new THREE.BoxGeometry(12.05, 0.12, 12.05), rimMat, -0.38);
  immAddBox(
    immGroup,
    new THREE.BoxGeometry(11.62, 0.08, 11.62),
    grooveMat,
    -0.3,
  );
  for (const s of [-5.48, 5.48]) {
    immAddBox(
      immGroup,
      new THREE.BoxGeometry(0.08, 0.12, 11.2),
      rimMat,
      -0.19,
    ).position.x = s;
    immAddBox(
      immGroup,
      new THREE.BoxGeometry(11.2, 0.12, 0.08),
      rimMat,
      -0.19,
    ).position.z = s;
  }
  const conductorMat = new THREE.LineBasicMaterial({
    color: 0x6c5428,
    transparent: true,
    opacity: 0.62,
  });
  const activeConductorMat = new THREE.LineBasicMaterial({
    color: 0xf0bb58,
    transparent: true,
    opacity: 0.94,
  });
  for (const cell of immBoard.cells) {
    const pos = immAt(cell),
      group = new THREE.Group();
    group.position.copy(pos);
    immGroup.add(group);
    const color =
      cell.kind === "source"
        ? 0xb7832c
        : cell.kind === "goal"
          ? 0x25865b
          : cell.kind === "wall"
            ? 0x373945
            : 0x4b5360;
    const base = immAddBox(
      group,
      new THREE.BoxGeometry(1.94, 0.18, 1.94),
      grooveMat,
      0,
    );
    const tile = immAddBox(
      group,
      new THREE.BoxGeometry(1.76, cell.kind === "wall" ? 1.05 : 0.28, 1.76),
      immMaterial(color, 0.56),
      cell.kind === "wall" ? 0.57 : 0.18,
    );
    const inset = immAddBox(
      group,
      new THREE.BoxGeometry(1.55, 0.06, 1.55),
      immMaterial(cell.kind === "wall" ? 0x242630 : 0x697181, 0.7),
      cell.kind === "wall" ? 1.12 : 0.34,
    );
    if (cell.kind === "wall") inset.rotation.y = Math.PI / 4;
    let arrow = null;
    if (cell.kind === "node" || cell.kind === "source") {
      const pivot = new THREE.Group();
      pivot.position.y = 0.38;
      group.add(pivot);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.64, 0.72, 0.11, 12),
        immMaterial(cell.kind === "source" ? 0x9a6920 : 0x3a414e, 0.62),
      );
      cap.position.y = 0.03;
      pivot.add(cap);
      arrow = new THREE.Group();
      arrow.userData.target = (-cell.direction * Math.PI) / 2;
      arrow.userData.pop = 0;
      pivot.add(arrow);
      const shaft = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.08, 0.13),
        immMaterial(
          cell.kind === "source" ? 0xffd477 : 0xe6edf2,
          0.38,
          cell.kind === "source" ? 0x8b5e15 : 0x10151d,
        ),
      );
      shaft.position.set(0.02, 0.15, 0);
      arrow.add(shaft);
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.42, 4),
        immMaterial(cell.kind === "source" ? 0xffe5a0 : 0xf3f6fa, 0.32),
      );
      tip.rotation.z = -Math.PI / 2;
      tip.position.set(0.57, 0.15, 0);
      arrow.add(tip);
      arrow.rotation.y = arrow.userData.target;
    }
    const dir = MindRoute.directions[cell.direction];
    if (cell.kind !== "wall" && cell.kind !== "goal") {
      const from = new THREE.Vector3(
          dir[0] * 0.08,
          cell.kind === "source" ? 0.84 : 0.56,
          dir[1] * 0.08,
        ),
        to = new THREE.Vector3(dir[0] * 0.84, from.y, dir[1] * 0.84);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([from, to]),
        conductorMat,
      );
      group.add(line);
      const hot = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([from, to]),
        activeConductorMat,
      );
      hot.visible = false;
      group.add(hot);
    }
    if (cell.kind === "goal") {
      const socket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.66, 0.13, 16),
        immMaterial(0x1e6b4b, 0.5, 0x0b2e20),
      );
      socket.position.y = 0.38;
      group.add(socket);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.075, 8, 28),
        new THREE.MeshBasicMaterial({ color: 0x9fffc1 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.49;
      group.add(ring);
    }
    const button =
      cell.kind === "node"
        ? document.createElement("button")
        : cell.kind !== "wall"
          ? document.createElement("span")
          : null;
    if (button) {
      button.className =
        cell.kind === "node" ? "imm-node" : `imm-landmark ${cell.kind}`;
      button.textContent =
        cell.kind === "node"
          ? `${String.fromCharCode(65 + cell.x)}${cell.y + 1}`
          : cell.kind === "source"
            ? "SOURCE"
            : "GOAL";
      if (cell.kind === "node") {
        button.type = "button";
        button.dataset.node = cell.id;
        button.addEventListener("click", () => rotateIMM(cell.id));
      }
      immButtons.appendChild(button);
    }
    immTiles.set(cell.id, {
      tile,
      arrow,
      button,
      base,
      conductor: null,
      hot: null,
      restY: cell.kind === "wall" ? 0.57 : 0.18,
      latch: 0,
    });
    const lines = group.children.filter((o) => o.isLine);
    if (lines.length) {
      const t = immTiles.get(cell.id);
      t.conductor = lines[0];
      t.hot = lines.at(-1);
      immUpdateConductor(cell, t);
    }
  }
  immPulse = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffdc7f }),
  );
  immGroup.add(immPulse);
  immPulse.position.copy(immAt(immBoard.cells[immBoard.source])).y = 0.91;
  immResetEffects();
  document.getElementById("imm-overlay").classList.remove("active");
  document.getElementById("imm-level-num").textContent = `${immLevel} / 20`;
  document.getElementById("imm-energy").textContent = "0";
  document.getElementById("imm-timer").textContent = "0";
  document.getElementById("imm-status-title").textContent = "CIRCUIT HELD";
  document.getElementById("imm-next-btn").textContent = "NEXT CIRCUIT";
  immState(
    "ready",
    "Turn the arrows from the amber source toward the green goal. Then test your route.",
  );
  updateIMMLabels();
  resizeIMM();
}
function updateIMMLabels() {
  for (const cell of immBoard.cells) {
    const t = immTiles.get(cell.id),
      arrow = t.arrow;
    if (arrow) arrow.userData.target = (-cell.direction * Math.PI) / 2;
    immUpdateConductor(cell, t);
    if (cell.kind === "node")
      t.button.setAttribute(
        "aria-label",
        `Node ${String.fromCharCode(65 + cell.x)}${cell.y + 1}, points ${immNames[cell.direction]}. Rotate clockwise.`,
      );
  }
}
function rotateIMM(id) {
  if (immRun || immContainer.dataset.state === "won") return;
  if (!MindRoute.rotateNode(immBoard, id)) return;
  immClearRouteVisuals();
  const t = immTiles.get(id);
  if (t.arrow) t.arrow.userData.pop = 1;
  document.getElementById("imm-timer").textContent = immBoard.moves;
  immState(
    "ready",
    "Arrow turned. Follow the arrows from SOURCE to GOAL, then test.",
  );
  updateIMMLabels();
  soundClick();
}
function resizeIMM() {
  if (!immRenderer || !immContainer.clientWidth) return;
  const w = immContainer.clientWidth,
    h = immContainer.clientHeight;
  immCamera.aspect = w / h;
  immCamera.updateProjectionMatrix();
  // Fit the physical tray, including its closest perspective corners, inside
  // the visible canvas. An aspect-only estimate clipped the front phone tiles.
  const top = Math.max(92, immHelp.getBoundingClientRect().bottom - immContainer.getBoundingClientRect().top + 12);
  const corners = [];
  for (const x of [-6.25, 6.25]) for (const y of [-0.75, 2]) for (const z of [-6.25, 6.25])
    corners.push(new THREE.Vector3(x, y, z));
  let distance = 17;
  for (;;) {
    immCamera.position.set(0, distance, distance * 0.65);
    immCamera.lookAt(0, 0, 0);
    immCamera.updateMatrixWorld();
    const fits = corners.every(corner => {
      const p = corner.clone().project(immCamera);
      const x = (p.x + 1) * w / 2, y = (1 - p.y) * h / 2;
      return x >= 12 && x <= w - 12 && y >= top && y <= h - 12;
    });
    if (fits || distance >= 100) break;
    distance *= 1.025;
  }
  immRenderer.setSize(w, h);
  for (const cell of immBoard.cells) {
    const el = immTiles.get(cell.id).button;
    if (!el) continue;
    const p = immAt(cell).project(immCamera);
    el.style.left = `${((p.x + 1) * w) / 2}px`;
    el.style.top = `${((1 - p.y) * h) / 2}px`;
  }
}
function finishIMM() {
  if (!immRun) return;
  const result = immRun.result;
  immRun = null;
  if (
    result.won &&
    result.path.at(-1) === immBoard.goal &&
    MindRoute.traceRoute(immBoard).won
  ) {
    immState("won", result.reason);
    document.getElementById("imm-status-desc").textContent =
      `${result.path.length} nodes connected in ${immBoard.moves} turns. You built that route.`;
    if (immLevel === 20) {
      document.getElementById("imm-status-title").textContent =
        "ALL 20 CIRCUITS CONNECTED";
      document.getElementById("imm-next-btn").textContent = "PLAY A NEW SET";
    }
    document.getElementById("imm-overlay").classList.add("active");
    triggerWinCelebration(immContainer);
  } else {
    immState("failed", result.reason);
    immFx.hit = result.path.at(-1);
    immFx.failAge = 0;
    immTiles.get(result.path.at(-1))?.tile.material.emissive.setHex(0x75180d);
    soundFail();
  }
}
function immAnimateEffects(dt) {
  const calm = immCalm();
  for (let i = 0; i < immFx.trail.length; i++) {
    const m = immFx.trail[i];
    if (!immRun || calm) {
      m.visible = false;
      continue;
    }
    const path = immRun.result.path,
      at = Math.max(0, immRun.progress - i * 0.32),
      idx = Math.min(path.length - 1, Math.floor(at));
    m.visible = at >= 0;
    immFrameA.copy(immAt(immBoard.cells[path[idx]]));
    immFrameB.copy(
      immAt(immBoard.cells[path[Math.min(idx + 1, path.length - 1)]]),
    );
    m.position.copy(immFrameA).lerp(immFrameB, at % 1);
    m.position.y = 0.91;
    m.scale.setScalar(Math.max(0.35, 1 - i * 0.13));
  }
  immMetrics.activeTrail = immFx.trail.filter((m) => m.visible).length;
  for (const m of immFx.contacts) m.visible = false;
  if (immRun && !calm) {
    const path = immRun.result.path,
      idx = Math.min(path.length - 1, Math.floor(immRun.progress));
    const c = immFx.contacts[idx % immFx.contacts.length];
    c.visible = true;
    c.position.copy(immAt(immBoard.cells[path[idx]]));
    c.position.y = 0.91;
    c.scale.setScalar(1 + (immRun.progress % 1) * 0.7);
    c.material.opacity = 0.8 - (immRun.progress % 1) * 0.5;
  }
  if (immFx.failAge < 1) {
    immFx.failAge = Math.min(1, immFx.failAge + dt * 2.4);
    const t = immTiles.get(immFx.hit);
    if (t) t.tile.material.emissiveIntensity = 1 - immFx.failAge;
  }
}
function animateIMM(time) {
  requestAnimationFrame(animateIMM);
  const dt = Math.min(
    0.05,
    Math.max(0, (time - (immLastFrame || time)) / 1000),
  );
  immLastFrame = time;
  if (
    document.hidden ||
    !document.getElementById("panel-imm").classList.contains("active")
  )
    return;
  for (const t of immTiles.values()) {
    if (t.arrow) {
      const d =
        ((t.arrow.userData.target - t.arrow.rotation.y + Math.PI * 3) %
          (Math.PI * 2)) -
        Math.PI;
      if (immCalm()) {
        t.arrow.rotation.y = t.arrow.userData.target;
        t.arrow.userData.pop = 0;
      } else {
        t.arrow.rotation.y += d * (1 - Math.exp(-18 * dt));
        t.arrow.userData.pop = Math.max(0, t.arrow.userData.pop - dt * 6);
      }
      const s = 1 + t.arrow.userData.pop * 0.12;
      t.arrow.scale.set(s, 1, s);
    }
    const targetY = immTileTargetY(t);
    t.tile.position.y += (targetY - t.tile.position.y) * Math.min(1, dt * 16);
  }
  if (immRun) {
    immRun.progress += dt * immRouteSpeed();
    const path = immRun.result.path;
    const i = Math.min(path.length - 1, Math.floor(immRun.progress));
    immFrameA.copy(immAt(immBoard.cells[path[i]]));
    immFrameB.copy(
      immAt(immBoard.cells[path[Math.min(i + 1, path.length - 1)]]),
    );
    immPulseTarget.copy(immFrameA).lerp(immFrameB, immRun.progress % 1);
    immPulse.position.lerp(immPulseTarget, 1 - Math.exp(-18 * dt));
    immPulse.position.y = 0.91;
    for (let n = 0; n <= i; n++) {
      const t = immTiles.get(path[n]);
      t.latch = 1;
      t.tile.material.emissive.setHex(0x174b35);
      if (t.hot) t.hot.visible = true;
    }
    document.getElementById("imm-energy").textContent = String(i + 1);
    immMetrics.latched = immRun.result.path.filter(
      (id) => immTiles.get(id)?.latch,
    ).length;
    if (immRun.progress >= path.length) finishIMM();
  }
  immAnimateEffects(dt);
  immMetrics.draws = immRenderer.info.render.calls;
  immRenderer.render(immScene, immCamera);
}
function suspendIMM() {
  if (!immRun) return;
  immRun = null;
  immState(
    "ready",
    "Test paused when you left. Your arrows are saved here; test again when ready.",
  );
}
immAction.addEventListener("click", () => {
  if (!immBoard || immRun || immContainer.dataset.state === "won") return;
  soundClick();
  immClearRouteVisuals();
  immRun = { result: MindRoute.traceRoute(immBoard), progress: 0 };
  immState(
    "running",
    "Follow the pulse. A stopped route shows the arrow to adjust.",
  );
});
document.getElementById("imm-reset-btn").addEventListener("click", () => {
  if (immScene) buildIMMLevel();
});
document.getElementById("imm-next-btn").addEventListener("click", () => {
  if (immContainer.dataset.state !== "won") return;
  if (immLevel === 20) {
    immSet++;
    immLevel = 1;
  } else immLevel++;
  buildIMMLevel();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) suspendIMM();
});
initIMM();
