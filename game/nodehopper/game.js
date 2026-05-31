// Node Hopper — Main game engine
(() => {
  const { glowMesh, rectGeom, triGeom, diamondGeom, ringGeom, rectOutline } = window.NHRender;
  const W = window.CHAMBER_W, H = window.CHAMBER_H;
  const CHAMBERS = window.CHAMBERS;

  // ─── Color palette ─────────────────────────────────────
  const COL = {
    bg:          0x05060c,
    grid:        0x0e2030,
    player:      0x40faff,  // cyan
    wall:        0xc060ff,  // magenta
    thin:        0xff66cc,  // pink
    spike:       0xff3a5c,  // red
    disappear:   0xffe066,  // amber
    flip:        0x9affff,  // pale cyan-green
    hazard:      0xff2a4a,  // hot red
    node:        0xfff066,  // gold
    text:        0xc8f7ff,
  };

  // ─── Physics constants ─────────────────────────────────
  const PHYS = {
    PLAYER_W: 0.62,
    PLAYER_H: 0.86,
    MOVE_SPEED: 9.2,
    AIR_ACCEL: 28,
    GROUND_ACCEL: 60,
    FRICTION: 14,
    GRAVITY: 48,
    JUMP_VEL: 20,
    JUMP_CUT: 0.5,        // multiplier when releasing jump early
    MAX_FALL: 30,
    COYOTE: 0.09,
    JUMP_BUFFER: 0.12,
    HAZARD_SPEED: 4.2,    // moving hazard horizontal speed
    DISSOLVE_DELAY: 0.42, // disappearing platform: time to dissolve after step
    DISSOLVE_HIDE: 1.7,   // time invisible before respawn
    FLIP_COOLDOWN: 0.55,  // gravity flip pad cooldown
  };

  // ─── Three.js scene ────────────────────────────────────
  const canvas = document.getElementById('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(COL.bg, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);

  const camera = new THREE.OrthographicCamera(0, W, H, 0, -10, 10);
  camera.position.z = 5;

  // Chamber root group — everything in chamber coordinates
  const world = new THREE.Group();
  scene.add(world);

  // ─── Background grid ───────────────────────────────────
  function makeBackgroundGrid() {
    const lines = [];
    const margin = 8;
    for (let x = -margin; x <= W + margin; x++) {
      lines.push(x, -margin, 0,  x, H + margin, 0);
    }
    for (let y = -margin; y <= H + margin; y++) {
      lines.push(-margin, y, 0,  W + margin, y, 0);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    const mat = new THREE.LineBasicMaterial({ color: COL.grid, transparent: true, opacity: 0.45 });
    const grid = new THREE.LineSegments(geom, mat);
    grid.position.z = -2;
    return grid;
  }
  scene.add(makeBackgroundGrid());

  // Faint vignette-ish outer frame for the chamber
  function makeChamberFrame() {
    const ringMat = new THREE.LineBasicMaterial({ color: 0x1a3550, transparent: true, opacity: 0.8 });
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(W, 0, 0),
      new THREE.Vector3(W, H, 0),
      new THREE.Vector3(0, H, 0),
      new THREE.Vector3(0, 0, 0),
    ];
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const frame = new THREE.Line(geom, ringMat);
    frame.position.z = -1;
    return frame;
  }
  scene.add(makeChamberFrame());

  // ─── Resize / camera fit ───────────────────────────────
  function resize() {
    const wW = window.innerWidth, wH = window.innerHeight;
    renderer.setSize(wW, wH, false);
    const target = W / H;       // 1.778
    const actual = wW / wH;
    let cw, ch;
    if (actual > target) {
      ch = H;
      cw = H * actual;
    } else {
      cw = W;
      ch = W / actual;
    }
    // Some breathing room
    const pad = 1.4;
    cw += pad; ch += pad;
    const cx = W / 2, cy = H / 2;
    camera.left = cx - cw / 2;
    camera.right = cx + cw / 2;
    camera.top = cy + ch / 2;
    camera.bottom = cy - ch / 2;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => { resetTouch(); setTimeout(resize, 200); });

  // ─── Coordinate helper: grid (col, row) -> world (x, y) center ───
  // row 0 is top. World y up. tile center = (col + 0.5, H - row - 0.5)
  function tileCenter(col, row) { return [col + 0.5, H - row - 0.5]; }

  // ─── Tile / entity factories ───────────────────────────
  // Each returns an object { mesh, x, y, w, h, type, ... } added to world group.

  function makeSolid(col, row) {
    const [x, y] = tileCenter(col, row);
    const w = 1, h = 1;
    const g = glowMesh(rectOutline(w * 0.94, h * 0.94, 0.07), COL.wall, { haloOpacity: 0.18, haloScale: 1.35 });
    const inner = glowMesh(rectGeom(w * 0.78, h * 0.78), COL.wall, { coreOpacity: 0.18, haloOpacity: 0.08, haloScale: 1.2 });
    const grp = new THREE.Group();
    grp.add(inner); grp.add(g);
    grp.position.set(x, y, 0);
    world.add(grp);
    return { x, y, w, h, type: 'solid', mesh: grp };
  }

  function makeThin(col, row) {
    const [x, y] = tileCenter(col, row);
    const w = 1, h = 0.18;
    const g = glowMesh(rectGeom(w * 0.95, h), COL.thin, { coreOpacity: 1, haloOpacity: 0.45, haloScale: 2.5 });
    g.position.set(x, y + 0.32, 0); // align to top quarter of tile so player feet rest near top
    world.add(g);
    return {
      x, y: y + 0.32, w, h,
      type: 'thin',
      get top() { return this.y + this.h / 2; },
      get bottom() { return this.y - this.h / 2; },
      mesh: g,
    };
  }

  function makeSpike(col, row) {
    const [x, y] = tileCenter(col, row);
    const grp = new THREE.Group();
    // Three little triangles for a row of spikes
    for (let i = 0; i < 3; i++) {
      const t = glowMesh(triGeom(0.28, 0.5), COL.spike, { haloOpacity: 0.4, haloScale: 1.8 });
      t.position.set(-0.32 + i * 0.32, -0.18, 0);
      grp.add(t);
    }
    grp.position.set(x, y, 0);
    world.add(grp);
    return { x, y, w: 1, h: 0.7, type: 'spike', mesh: grp };
  }

  function makeDissolve(col, row) {
    const [x, y] = tileCenter(col, row);
    const grp = new THREE.Group();
    const outline = glowMesh(rectOutline(0.94, 0.4, 0.06), COL.disappear, { haloOpacity: 0.35, haloScale: 1.8 });
    outline.position.y = 0.25;
    const fill = glowMesh(rectGeom(0.82, 0.28), COL.disappear, { coreOpacity: 0.35, haloOpacity: 0.18, haloScale: 1.4 });
    fill.position.y = 0.25;
    grp.add(fill); grp.add(outline);
    grp.position.set(x, y, 0);
    world.add(grp);
    return {
      x, y: y + 0.25, w: 0.94, h: 0.4,
      type: 'dissolve',
      mesh: grp,
      state: 'solid',       // 'solid' | 'fading' | 'gone'
      timer: 0,
      fade: 1,              // visual alpha
    };
  }

  function makeFlipPad(col, row) {
    const [x, y] = tileCenter(col, row);
    const grp = new THREE.Group();
    const base = glowMesh(rectGeom(0.96, 0.18), COL.flip, { coreOpacity: 0.7, haloOpacity: 0.4, haloScale: 2.4 });
    base.position.y = -0.36;
    // two stacked chevrons
    const c1 = glowMesh(triGeom(0.5, 0.28), COL.flip, { coreOpacity: 0.8, haloOpacity: 0.35, haloScale: 1.6 });
    c1.position.y = -0.05;
    const c2 = glowMesh(triGeom(0.36, 0.22), COL.flip, { coreOpacity: 0.6, haloOpacity: 0.3, haloScale: 1.6 });
    c2.position.y = 0.22;
    grp.add(base); grp.add(c1); grp.add(c2);
    grp.position.set(x, y, 0);
    world.add(grp);
    return {
      x, y, w: 0.9, h: 1.0,
      type: 'flip',
      mesh: grp,
      cool: 0,
      chevrons: [c1, c2],
    };
  }

  function makeNode(col, row) {
    const [x, y] = tileCenter(col, row);
    const grp = new THREE.Group();
    const halo = glowMesh(diamondGeom(0.55, 0.65), COL.node, { coreOpacity: 0.4, haloOpacity: 0.35, haloScale: 2.6 });
    const core = glowMesh(diamondGeom(0.34, 0.42), COL.node, { coreOpacity: 1, haloOpacity: 0.45, haloScale: 1.4 });
    grp.add(halo); grp.add(core);
    grp.position.set(x, y, 0);
    world.add(grp);
    return { x, y, w: 0.5, h: 0.6, type: 'node', mesh: grp, halo, core, collected: false, t: Math.random() * Math.PI * 2 };
  }

  // Moving hazard: a glowing diamond sweeping horizontally
  function makeHazard(col, row, dir = 1) {
    const [x, y] = tileCenter(col, row);
    const grp = new THREE.Group();
    const halo = glowMesh(diamondGeom(0.9, 0.9), COL.hazard, { coreOpacity: 0.4, haloOpacity: 0.5, haloScale: 2.0 });
    const core = glowMesh(diamondGeom(0.5, 0.5), COL.hazard, { coreOpacity: 1, haloOpacity: 0.3, haloScale: 1.3 });
    grp.add(halo); grp.add(core);
    grp.position.set(x, y, 0);
    world.add(grp);
    return { x, y, w: 0.5, h: 0.5, type: 'hazard', mesh: grp, dir, halo, core, baseY: y };
  }

  // ─── Player ────────────────────────────────────────────
  function makePlayer() {
    const grp = new THREE.Group();
    const halo = glowMesh(triGeom(PHYS.PLAYER_W * 1.4, PHYS.PLAYER_H * 1.4), COL.player, { coreOpacity: 0.25, haloOpacity: 0.5, haloScale: 1.8 });
    const core = glowMesh(triGeom(PHYS.PLAYER_W, PHYS.PLAYER_H), COL.player, { coreOpacity: 1, haloOpacity: 0.6, haloScale: 1.3 });
    grp.add(halo); grp.add(core);
    grp.position.z = 1;
    world.add(grp);
    return {
      x: 0, y: 0, vx: 0, vy: 0,
      grav: 1,             // 1 = down, -1 = up
      onGround: false,
      coyote: 0,
      jumpBuffer: 0,
      jumpHeld: false,
      facing: 1,
      mesh: grp,
      core, halo,
      squash: 1, stretch: 1,
      hue: 0,
    };
  }

  // ─── Chamber state ─────────────────────────────────────
  const chamberState = {
    solids: [],           // {x,y,w,h,type}
    thins: [],
    spikes: [],
    dissolves: [],
    flips: [],
    nodes: [],
    hazards: [],
    bounds: { left: 0, right: W, top: H, bottom: 0 },
    spawn: { x: 2.5, y: 1.5 },
    name: '',
  };

  function clearChamber() {
    [...chamberState.solids, ...chamberState.thins, ...chamberState.spikes,
     ...chamberState.dissolves, ...chamberState.flips, ...chamberState.nodes,
     ...chamberState.hazards].forEach(e => world.remove(e.mesh));
    chamberState.solids = [];
    chamberState.thins = [];
    chamberState.spikes = [];
    chamberState.dissolves = [];
    chamberState.flips = [];
    chamberState.nodes = [];
    chamberState.hazards = [];
  }

  function loadChamber(idx) {
    clearChamber();
    const c = CHAMBERS[idx];
    chamberState.name = c.name;
    const grid = c.grid;
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      for (let col = 0; col < row.length; col++) {
        const ch = row[col];
        switch (ch) {
          case '#': chamberState.solids.push(makeSolid(col, r)); break;
          case '=': chamberState.thins.push(makeThin(col, r)); break;
          case '^': chamberState.spikes.push(makeSpike(col, r)); break;
          case 'D': chamberState.dissolves.push(makeDissolve(col, r)); break;
          case 'G': chamberState.flips.push(makeFlipPad(col, r)); break;
          case 'N': chamberState.nodes.push(makeNode(col, r)); break;
          case 'M': chamberState.hazards.push(makeHazard(col, r)); break;
          case 'P': {
            const [x, y] = tileCenter(col, r);
            chamberState.spawn = { x, y };
          } break;
        }
      }
    }
  }

  // ─── Player + physics ──────────────────────────────────
  const player = makePlayer();

  function resetPlayerToSpawn() {
    player.x = chamberState.spawn.x;
    player.y = chamberState.spawn.y;
    player.vx = 0; player.vy = 0;
    player.grav = 1;
    player.onGround = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    player.squash = 1; player.stretch = 1;
    player.jumpHeld = false;
    player.mesh.visible = true;
    player.mesh.scale.set(1, 1, 1);
    resetTouch();
  }

  // AABB overlap
  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return Math.abs(ax - bx) * 2 < (aw + bw) && Math.abs(ay - by) * 2 < (ah + bh);
  }

  // Collide & resolve player against solid rectangles. Returns landed direction (-1 up, 1 down) or 0
  function collidePlayer(dt) {
    const pw = PHYS.PLAYER_W, ph = PHYS.PLAYER_H;
    // Build active solids: walls + non-dissolved dissolves
    const blocks = [];
    chamberState.solids.forEach(b => blocks.push(b));
    chamberState.dissolves.forEach(d => { if (d.state !== 'gone') blocks.push(d); });

    // Apply X first, resolve
    player.x += player.vx * dt;
    for (const b of blocks) {
      if (rectsOverlap(player.x, player.y, pw, ph, b.x, b.y, b.w, b.h)) {
        if (player.vx > 0) player.x = b.x - b.w / 2 - pw / 2 - 0.0001;
        else if (player.vx < 0) player.x = b.x + b.w / 2 + pw / 2 + 0.0001;
        player.vx = 0;
      }
    }

    // Apply Y next
    const prevY = player.y;
    player.y += player.vy * dt;
    let landedDir = 0;
    for (const b of blocks) {
      if (rectsOverlap(player.x, player.y, pw, ph, b.x, b.y, b.w, b.h)) {
        if (player.vy < 0) {
          // moving down — push up; if grav==1 this is landing
          player.y = b.y + b.h / 2 + ph / 2 + 0.0001;
          if (player.grav === 1) { landedDir = 1; if (Math.abs(player.vy) > 6) SFX.land(); }
          if (player.grav === -1) { /* hit ceiling while flipped (falling up reversed) */ }
          player.vy = 0;
        } else if (player.vy > 0) {
          player.y = b.y - b.h / 2 - ph / 2 - 0.0001;
          if (player.grav === -1) { landedDir = -1; if (Math.abs(player.vy) > 6) SFX.land(); }
          player.vy = 0;
        }
      }
    }

    // Thin platforms (one-way) — only collide from above when moving down (or below when flipped + moving up)
    for (const t of chamberState.thins) {
      if (rectsOverlap(player.x, player.y, pw, ph, t.x, t.y, t.w, t.h)) {
        if (player.grav === 1 && player.vy < 0) {
          const prevBottom = prevY - ph / 2;
          if (prevBottom >= t.y + t.h / 2 - 0.02) {
            player.y = t.y + t.h / 2 + ph / 2 + 0.0001;
            player.vy = 0;
            landedDir = 1;
          }
        } else if (player.grav === -1 && player.vy > 0) {
          const prevTop = prevY + ph / 2;
          if (prevTop <= t.y - t.h / 2 + 0.02) {
            player.y = t.y - t.h / 2 - ph / 2 - 0.0001;
            player.vy = 0;
            landedDir = -1;
          }
        }
      }
    }

    return landedDir;
  }

  // ─── Particles ─────────────────────────────────────────
  const particles = [];
  function spawnParticle({ x, y, vx, vy, color, life = 0.6, size = 0.18, geom = 'tri', spin = 0 }) {
    let g;
    if (geom === 'tri') g = triGeom(size, size);
    else if (geom === 'dia') g = diamondGeom(size, size);
    else g = rectGeom(size, size);
    const m = glowMesh(g, color, { coreOpacity: 1, haloOpacity: 0.4, haloScale: 1.6 });
    m.position.set(x, y, 1.5);
    world.add(m);
    particles.push({ mesh: m, x, y, vx, vy, life, max: life, spin, color });
  }

  function burst(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 5;
      spawnParticle({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        color, life: 0.5 + Math.random() * 0.5,
        size: 0.1 + Math.random() * 0.18,
        spin: (Math.random() - 0.5) * 12,
        geom: ['tri', 'dia', 'rect'][Math.floor(Math.random() * 3)],
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        world.remove(p.mesh);
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 9 * dt;
      p.vx *= 0.97;
      p.mesh.position.set(p.x, p.y, 1.5);
      p.mesh.rotation.z += p.spin * dt;
      const k = p.life / p.max;
      const sc = 0.5 + 0.5 * k;
      p.mesh.scale.set(sc, sc, 1);
      p.mesh.userData.coreMat.opacity = k;
      p.mesh.userData.haloMat.opacity = 0.4 * k;
    }
  }

  // ─── Screen shake (offset on world group) ──────────────
  let shakeT = 0, shakeAmp = 0;
  function shake(amp = 0.4, dur = 0.35) {
    shakeAmp = Math.max(shakeAmp, amp);
    shakeT = Math.max(shakeT, dur);
  }
  function updateShake(dt) {
    if (shakeT > 0) {
      shakeT -= dt;
      const k = Math.max(0, shakeT);
      const a = shakeAmp * k;
      world.position.x = (Math.random() - 0.5) * a;
      world.position.y = (Math.random() - 0.5) * a;
      if (shakeT <= 0) { world.position.set(0, 0, 0); shakeAmp = 0; }
    }
  }

  // ─── Input ─────────────────────────────────────────────
  const input = { left: false, right: false, jump: false, jumpPressed: false };
  const keys = {};
  window.addEventListener('keydown', e => {
    if (['ArrowLeft','ArrowRight','ArrowUp','Space','KeyA','KeyD','KeyW'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') input.jumpPressed = true;
    if (e.code === 'KeyR') { if (game.state === 'playing') killPlayer('reset'); }
    if (e.code === 'KeyM') { audioMuted = !audioMuted; SFX.setVolume(audioMuted ? 0 : 0.5); updateHud(); }
    if (e.code === 'Enter' || e.code === 'Space') {
      if (game.state === 'title' || game.state === 'gameover') { startRun(); }
    }
    SFX.resume();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  function pollInput() {
    input.left = !!(keys.ArrowLeft || keys.KeyA);
    input.right = !!(keys.ArrowRight || keys.KeyD);
    input.jump = !!(keys.Space || keys.ArrowUp || keys.KeyW);
    // Touch buttons override
    if (touch.left) input.left = true;
    if (touch.right) input.right = true;
    if (touch.jump) input.jump = true;
    if (touch.jumpPressed) { input.jumpPressed = true; touch.jumpPressed = false; }
  }

  // ─── Touch controls ────────────────────────────────────
  const touch = { left: false, right: false, jump: false, jumpPressed: false };
  function resetTouch() {
    touch.left = false; touch.right = false; touch.jump = false; touch.jumpPressed = false;
  }
  function bindButton(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    const press = (e) => {
      e.preventDefault();
      if (e.pointerId != null && el.setPointerCapture) {
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      }
      touch[key] = true;
      if (key === 'jump') touch.jumpPressed = true;
      SFX.resume();
      if (game.state === 'title' || game.state === 'gameover') startRun();
    };
    const release = (e) => { e.preventDefault(); touch[key] = false; };
    // Pointer events subsume mouse + touch + pen, so separate touch/mouse
    // handlers are not needed. setPointerCapture keeps the release bound to
    // this button even if the finger slides off before lifting.
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  bindButton('btn-left', 'left');
  bindButton('btn-right', 'right');
  bindButton('btn-jump', 'jump');

  // Show touch UI on touch / coarse-pointer devices
  const coarse = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
  if (coarse) {
    document.getElementById('touch-ui').style.display = 'flex';
  }
  // Clear held movement if the window loses focus (alt-tab, app switch).
  window.addEventListener('blur', resetTouch);

  // ─── Game state machine ───────────────────────────────
  let audioMuted = false;
  const game = {
    state: 'title',     // 'title' | 'intro' | 'playing' | 'dying' | 'clear' | 'gameover'
    stateTime: 0,
    score: 0,
    best: parseInt(localStorage.getItem('nodehopper-best') || '0', 10),
    lives: 3,
    chambersCleared: 0,
    chamberOrder: [],
    chamberIdx: 0,
    chamberTimer: 0,
    nodesInChamber: 0,
    loopCount: 0,           // increments each time order is reshuffled
    deathReason: '',
  };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function makeOrder() {
    // First chamber always Boot Sequence (index 0). After that shuffled.
    const rest = [];
    for (let i = 1; i < CHAMBERS.length; i++) rest.push(i);
    return [0, ...shuffle(rest)];
  }

  function startRun() {
    SFX.start();
    document.getElementById('title-card').classList.remove('show');
    document.getElementById('gameover-card').classList.remove('show');
    document.getElementById('clear-card').classList.remove('show');
    game.score = 0;
    game.lives = 3;
    game.chambersCleared = 0;
    game.loopCount = 0;
    game.chamberOrder = makeOrder();
    game.chamberIdx = 0;
    enterChamber();
    updateHud();
  }

  function enterChamber() {
    const ci = game.chamberOrder[game.chamberIdx];
    loadChamber(ci);
    resetPlayerToSpawn();
    game.chamberTimer = 0;
    game.nodesInChamber = chamberState.nodes.length;
    game.state = 'intro';
    game.stateTime = 0;
    document.getElementById('chamber-card').classList.add('show');
    document.getElementById('chamber-card-name').textContent = chamberState.name;
    document.getElementById('chamber-card-num').textContent =
      `CHAMBER ${String(game.chambersCleared + 1).padStart(2, '0')}`;
    updateHud();
  }

  function killPlayer(reason) {
    if (game.state !== 'playing') return;
    game.deathReason = reason || 'hazard';
    SFX.hit();
    burst(player.x, player.y, COL.player, 22);
    burst(player.x, player.y, COL.spike, 10);
    shake(0.6, 0.5);
    player.mesh.visible = false;
    game.state = 'dying';
    game.stateTime = 0;
    game.lives--;
    updateHud();
  }

  function clearChamberWin() {
    SFX.clear();
    burst(player.x, player.y, COL.player, 16);
    game.state = 'clear';
    game.stateTime = 0;
    game.chambersCleared++;
    // Score: per-chamber base + time bonus
    const base = 100;
    const timeBonus = Math.max(0, Math.round((40 - game.chamberTimer) * 5));
    game.score += base + timeBonus;
    if (game.score > game.best) {
      game.best = game.score;
      localStorage.setItem('nodehopper-best', String(game.best));
    }
    updateHud();
    document.getElementById('clear-card').classList.add('show');
    document.getElementById('clear-bonus').textContent = `+${base + timeBonus}`;
  }

  function gameOver() {
    SFX.gameOver();
    game.state = 'gameover';
    game.stateTime = 0;
    document.getElementById('gameover-card').classList.add('show');
    document.getElementById('go-score').textContent = String(game.score);
    document.getElementById('go-best').textContent = String(game.best);
    document.getElementById('go-cleared').textContent = String(game.chambersCleared);
  }

  // ─── HUD ──────────────────────────────────────────────
  function updateHud() {
    document.getElementById('hud-score').textContent = String(game.score).padStart(6, '0');
    document.getElementById('hud-best').textContent = String(game.best).padStart(6, '0');
    document.getElementById('hud-lives').innerHTML = '<span class="life-pip"></span>'.repeat(Math.max(0, game.lives));
    document.getElementById('hud-chamber').textContent =
      String(game.chambersCleared + 1).padStart(2, '0');
    document.getElementById('hud-total').textContent =
      `×${game.loopCount > 0 ? (game.loopCount + 1) : 1}`;
    document.getElementById('hud-mute').textContent = audioMuted ? 'MUTED' : 'AUDIO';
  }

  // ─── Update loop ──────────────────────────────────────
  let last = performance.now() / 1000;
  // dt is clamped to 0.033 below (the real tunneling safeguard). This also
  // resets the clock on tab re-focus so resume produces no catch-up step,
  // and clears any held movement while the tab is hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetTouch();
    else last = performance.now() / 1000;
  });
  function frame() {
    const now = performance.now() / 1000;
    let dt = now - last;
    last = now;
    dt = Math.min(dt, 0.033); // clamp to 30fps minimum step

    pollInput();
    game.stateTime += dt;

    if (game.state === 'playing') {
      game.chamberTimer += dt;
      stepPlayer(dt);
      stepEntities(dt);
      checkCollisions();
    } else if (game.state === 'intro') {
      stepEntities(dt);
      if (game.stateTime > 0.85) {
        document.getElementById('chamber-card').classList.remove('show');
        game.state = 'playing';
        game.stateTime = 0;
      }
    } else if (game.state === 'dying') {
      stepEntities(dt);
      if (game.stateTime > 1.0) {
        if (game.lives <= 0) {
          gameOver();
        } else {
          resetPlayerToSpawn();
          // Reset dissolves & hazards to initial state for fairness
          chamberState.dissolves.forEach(d => { d.state = 'solid'; d.timer = 0; d.fade = 1; d.mesh.visible = true; });
          chamberState.hazards.forEach(h => { /* keep their position, ok */ });
          game.state = 'playing';
          game.stateTime = 0;
        }
      }
    } else if (game.state === 'clear') {
      stepEntities(dt);
      if (game.stateTime > 1.1) {
        document.getElementById('clear-card').classList.remove('show');
        game.chamberIdx++;
        if (game.chamberIdx >= game.chamberOrder.length) {
          game.loopCount++;
          game.chamberOrder = shuffle(makeOrder()); // reshuffle
          game.chamberIdx = 0;
        }
        enterChamber();
      }
    } else if (game.state === 'title' || game.state === 'gameover') {
      stepEntities(dt);
    }

    updateParticles(dt);
    updateShake(dt);
    renderer.render(scene, camera);

    // consume one-shot inputs
    input.jumpPressed = false;

    requestAnimationFrame(frame);
  }

  // ─── Player step (input + physics) ────────────────────
  function stepPlayer(dt) {
    // Horizontal acceleration
    const target = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const desired = target * PHYS.MOVE_SPEED;
    const accel = player.onGround ? PHYS.GROUND_ACCEL : PHYS.AIR_ACCEL;
    if (target !== 0) {
      player.vx += Math.sign(desired - player.vx) * accel * dt;
      if ((player.vx > desired && desired > 0) || (player.vx < desired && desired < 0)) player.vx = desired;
      player.facing = target;
    } else {
      const fric = player.onGround ? PHYS.FRICTION : PHYS.FRICTION * 0.3;
      const drop = fric * dt;
      if (Math.abs(player.vx) <= drop) player.vx = 0;
      else player.vx -= Math.sign(player.vx) * drop;
    }

    // Coyote & buffer
    if (player.onGround) player.coyote = PHYS.COYOTE; else player.coyote -= dt;
    if (input.jumpPressed) player.jumpBuffer = PHYS.JUMP_BUFFER;
    else player.jumpBuffer -= dt;

    // Jump
    if (player.jumpBuffer > 0 && player.coyote > 0) {
      player.vy = PHYS.JUMP_VEL * (player.grav === 1 ? 1 : -1);
      player.onGround = false;
      player.coyote = 0;
      player.jumpBuffer = 0;
      player.squash = 0.7; player.stretch = 1.25;
      SFX.jump();
    }

    // Jump cut on release — edge-triggered (fires once, on held→released)
    if (player.jumpHeld && !input.jump && player.vy * (player.grav === 1 ? 1 : -1) > 0) {
      player.vy *= PHYS.JUMP_CUT;
    }
    player.jumpHeld = input.jump;

    // Gravity
    player.vy -= PHYS.GRAVITY * player.grav * dt;
    const maxFall = PHYS.MAX_FALL;
    if (player.grav === 1 && player.vy < -maxFall) player.vy = -maxFall;
    if (player.grav === -1 && player.vy > maxFall) player.vy = maxFall;

    // Collide
    const landed = collidePlayer(dt);
    player.onGround = (landed === player.grav);

    // Out of bounds → death
    if (player.x < -1 || player.x > W + 1 || player.y < -2 || player.y > H + 2) {
      killPlayer('void'); return;
    }

    // Visuals: ease squash/stretch back
    player.squash = player.squash + (1 - player.squash) * Math.min(1, dt * 10);
    player.stretch = player.stretch + (1 - player.stretch) * Math.min(1, dt * 10);
    player.mesh.position.set(player.x, player.y, 1);
    const flip = player.grav === -1 ? -1 : 1;
    player.mesh.scale.set(player.squash * (player.facing < 0 ? -1 : 1), player.stretch * flip, 1);

    // Hue subtle pulse
    player.hue += dt * 2;
    const k = 0.5 + 0.5 * Math.sin(player.hue);
    player.halo.userData.haloMat.opacity = 0.4 + 0.25 * k;
  }

  // ─── Entity step (hazards, dissolves, nodes, flips animate) ───
  function stepEntities(dt) {
    // Moving hazards
    chamberState.hazards.forEach(h => {
      const speedMul = 1 + 0.15 * game.loopCount;
      h.x += h.dir * PHYS.HAZARD_SPEED * speedMul * dt;
      // Bounce off solid blocks or chamber walls
      const probe = 0.36;
      const willHit = chamberState.solids.some(b =>
        Math.abs((h.x + h.dir * probe) - b.x) * 2 < (b.w + 0.4) &&
        Math.abs(h.y - b.y) * 2 < (b.h + 0.5));
      if (willHit) {
        h.dir *= -1;
        h.x += h.dir * 0.02;
      }
      h.mesh.position.set(h.x, h.y + Math.sin(performance.now() * 0.003) * 0.08, 0);
      h.mesh.rotation.z = performance.now() * 0.003;
    });

    // Nodes pulse + rotate
    chamberState.nodes.forEach(n => {
      n.t += dt * 4;
      const s = 1 + Math.sin(n.t) * 0.12;
      n.mesh.scale.set(s, s, 1);
      n.mesh.rotation.z += dt * 1.4;
    });

    // Dissolves update
    chamberState.dissolves.forEach(d => {
      if (d.state === 'fading') {
        d.timer += dt;
        const k = d.timer / PHYS.DISSOLVE_DELAY;
        d.fade = 1 - k;
        d.mesh.children.forEach(c => {
          if (c.userData.coreMat) c.userData.coreMat.opacity = Math.max(0, d.fade);
          if (c.userData.haloMat) c.userData.haloMat.opacity = Math.max(0, 0.45 * d.fade);
        });
        if (d.timer >= PHYS.DISSOLVE_DELAY) {
          d.state = 'gone';
          d.timer = 0;
          d.mesh.visible = false;
          SFX.dissolve();
        }
      } else if (d.state === 'gone') {
        d.timer += dt;
        if (d.timer >= PHYS.DISSOLVE_HIDE) {
          d.state = 'solid'; d.timer = 0; d.fade = 1;
          d.mesh.visible = true;
          d.mesh.children.forEach(c => {
            if (c.userData.coreMat) c.userData.coreMat.opacity = 1;
            if (c.userData.haloMat) c.userData.haloMat.opacity = 0.35;
          });
        }
      } else if (d.state === 'solid') {
        // Pulse subtle
        const pulse = 0.85 + 0.15 * Math.sin(performance.now() * 0.005 + d.x);
        d.mesh.children.forEach(c => {
          if (c.userData.haloMat) c.userData.haloMat.opacity = 0.3 * pulse;
        });
      }
    });

    // Flip pad cooldown + animation
    chamberState.flips.forEach(f => {
      if (f.cool > 0) f.cool -= dt;
      const t = performance.now() * 0.004;
      f.chevrons.forEach((c, i) => {
        c.position.y = -0.05 + 0.25 * i + 0.06 * Math.sin(t + i);
        const op = (f.cool > 0) ? 0.2 : (0.8 - 0.3 * i);
        c.userData.coreMat.opacity = op;
      });
    });
  }

  // ─── Trigger / hazard checks ──────────────────────────
  function checkCollisions() {
    const pw = PHYS.PLAYER_W, ph = PHYS.PLAYER_H;
    const px = player.x, py = player.y;

    // Spikes: deadly
    for (const s of chamberState.spikes) {
      if (rectsOverlap(px, py, pw, ph, s.x, s.y, s.w * 0.85, s.h * 0.8)) { killPlayer('spike'); return; }
    }
    // Hazards: deadly
    for (const h of chamberState.hazards) {
      if (rectsOverlap(px, py, pw, ph, h.x, h.y, h.w, h.h)) { killPlayer('hazard'); return; }
    }
    // Nodes: collect
    for (const n of chamberState.nodes) {
      if (n.collected) continue;
      if (rectsOverlap(px, py, pw, ph, n.x, n.y, n.w, n.h)) {
        n.collected = true;
        world.remove(n.mesh);
        SFX.pickup();
        burst(n.x, n.y, COL.node, 10);
        game.score += 50;
        updateHud();
      }
    }
    // Flip pads
    for (const f of chamberState.flips) {
      if (f.cool > 0) continue;
      if (rectsOverlap(px, py, pw, ph, f.x, f.y, f.w, f.h)) {
        player.grav *= -1;
        // After flip, kick player away from the pad (toward new "down").
        // grav=1 means new "down" is world-down → kick vy negative.
        // grav=-1 means new "down" is world-up → kick vy positive.
        player.vy = -8 * player.grav;
        f.cool = PHYS.FLIP_COOLDOWN;
        shake(0.18, 0.18);
        SFX.flip();
        burst(f.x, f.y, COL.flip, 12);
      }
    }
    // Dissolves: trigger fade when standing on top
    for (const d of chamberState.dissolves) {
      if (d.state !== 'solid') continue;
      // Standing on top: player vy <= 0 (grav 1) and feet near top of d
      const onTop = (player.grav === 1)
        ? (Math.abs(player.y - ph / 2 - (d.y + d.h / 2)) < 0.04 && Math.abs(px - d.x) * 2 < (pw + d.w))
        : (Math.abs(player.y + ph / 2 - (d.y - d.h / 2)) < 0.04 && Math.abs(px - d.x) * 2 < (pw + d.w));
      if (onTop) { d.state = 'fading'; d.timer = 0; }
    }

    // All nodes collected?
    if (chamberState.nodes.every(n => n.collected)) {
      clearChamberWin();
    }
  }

  // ─── Title screen helper: ambient demo ────────────────
  function setupTitleDemo() {
    loadChamber(0);
    resetPlayerToSpawn();
    game.state = 'title';
    updateHud();
  }
  setupTitleDemo();

  // Overlay buttons
  document.getElementById('title-start').addEventListener('click', () => { SFX.resume(); startRun(); });
  document.getElementById('go-restart').addEventListener('click', () => { SFX.resume(); document.getElementById('gameover-card').classList.remove('show'); startRun(); });

  requestAnimationFrame(frame);

  // Expose for debugging
  window.__nh = { game, player, chamberState, PHYS };
})();
