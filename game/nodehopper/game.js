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
    MOVE_SPEED: 6.4,
    AIR_ACCEL: 28,
    GROUND_ACCEL: 60,
    FRICTION: 22,
    GRAVITY: 40,
    JUMP_VEL: 15.8,
    CLIMB_SPEED: 5,
    JUMP_CUT: 0.5,        // multiplier when releasing jump early
    MAX_FALL: 30,
    COYOTE: 0.09,
    JUMP_BUFFER: 0.12,
    HAZARD_SPEED: 4.2,    // moving hazard horizontal speed
    DISSOLVE_DELAY: 0.42, // disappearing platform: time to dissolve after step
    DISSOLVE_HIDE: 1.7,   // time invisible before respawn
    FLIP_COOLDOWN: 0.55,  // gravity flip pad cooldown
  };

  // ─── Motion preference (accessibility) ─────────────────
  // Respect prefers-reduced-motion: suppress screen shake and heavy particle
  // bursts (the CSS title pulse is gated in the stylesheet) for photosensitive
  // users. Tracked live so an OS-level change takes effect without reload.
  const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduceMotion = !!(motionQuery && motionQuery.matches);
  if (motionQuery && motionQuery.addEventListener) {
    motionQuery.addEventListener('change', (e) => { reduceMotion = e.matches; });
  }

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
    // Reserve actual HUD / touch space: no node may hide behind a button.
    const short=wH<=500&&wW>520;
    const top=short?110:(wW<520?200:150);
    const bottom=short?62:(wW<520?175:65);
    const scale=Math.min(wW/(W+1.4),Math.max(160,wH-top-bottom)/(H+1.4));
    const cw=wW/scale,ch=wH/scale;
    const cx=W/2,cy=H/2+(top-bottom)/2/scale;
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
    outline.position.y = 0.21;
    const fill = glowMesh(rectGeom(0.82, 0.28), COL.disappear, { coreOpacity: 0.35, haloOpacity: 0.18, haloScale: 1.4 });
    fill.position.y = 0.21;
    grp.add(fill); grp.add(outline);
    grp.position.set(x, y, 0);
    world.add(grp);
    return {
      x, y: y + 0.21, w: 0.94, h: 0.4,
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
    return { col,row,x, y, w: 0.5, h: 0.6, type: 'node', mesh: grp, halo, core, collected: false, t: (col*7+row)%6 };
  }

  function makeClimb(col,row,type) {
    const [x,y]=tileCenter(col,row),group=new THREE.Group();
    const color=type==='L'?COL.player:COL.thin;
    for(const dx of type==='L'?[-.28,.28]:[0]) {
      const rail=glowMesh(rectGeom(.065,1.05),color,{haloOpacity:.13,haloScale:1.8});
      rail.position.x=dx;group.add(rail);
    }
    for(const dy of [-.32,0,.32]) {
      const rung=glowMesh(type==='L'?rectGeom(.6,.055):triGeom(.28,.17),color,{haloOpacity:.1});
      rung.position.y=dy;if(type==='V')rung.rotation.z=Math.PI;group.add(rung);
    }
    group.position.set(x,y,.12);world.add(group);
    return{x,y,type,mesh:group};
  }

  function disposeMesh(mesh) {
    if(!mesh)return;
    world.remove(mesh);
    const geometries=new Set(),materials=new Set();
    mesh.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const m of [].concat(object.material||[]))materials.add(m);});
    for(const geometry of geometries)geometry.dispose();
    for(const material of materials)material.dispose();
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
    return { x, y, w: 0.5, h: 0.5, type: 'hazard', mesh: grp, dir, halo, core, baseY: y, spawnX: x, spawnDir: dir };
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
    climbs: [],
    bridges: [],
    bounds: { left: 0, right: W, top: H, bottom: 0 },
    spawn: { x: 2.5, y: 1.5 },
    name: '',
  };

  function clearChamber() {
    // Flush in-flight particles so the previous chamber's sparks don't bleed
    // into the next one's first frame.
    for (const p of particles) disposeMesh(p.mesh);
    particles.length = 0;
    [...chamberState.solids, ...chamberState.thins, ...chamberState.spikes,
     ...chamberState.dissolves, ...chamberState.flips, ...chamberState.nodes,
     ...chamberState.hazards,...chamberState.climbs].forEach(e => disposeMesh(e.mesh));
    chamberState.solids = [];
    chamberState.thins = [];
    chamberState.spikes = [];
    chamberState.dissolves = [];
    chamberState.flips = [];
    chamberState.nodes = [];
    chamberState.hazards = [];
    chamberState.climbs = [];
    chamberState.bridges = [];
  }

  function loadChamber(idx) {
    clearChamber();
    const c = CHAMBERS[idx];
    chamberState.name = c.name;
    chamberState.hint = c.hint || 'Collect every gold node. Plan your climb.';
    chamberState.bridges = (c.bridges||[]).map(bridge=>({...bridge,active:false}));
    // Ladders cross girders without turning the walkable deck into a hole.
    for(const [col,row] of c.underlays||[])chamberState.thins.push(makeThin(col,row));
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
          case 'T': {
            const dart=makeHazard(col,r);dart.type='dart';dart.phase='patrol';dart.timer=0;
            chamberState.hazards.push(dart);break;
          }
          case 'L': case 'U': case 'V': chamberState.climbs.push(makeClimb(col,r,ch));break;
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
    player.climbing = null;
    player.climbCooldown = 0;
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
    if(particles.length>=96)return;
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
    if (reduceMotion) count = Math.min(count, 2); // calm feedback, no spray, for reduced-motion
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
        disposeMesh(p.mesh);
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
    if (reduceMotion) return; // no screen shake under prefers-reduced-motion
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
  const input = { left: false, right: false, up:false,down:false,jump: false, jumpPressed: false };
  const keys = {};
  window.addEventListener('keydown', e => {
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyA','KeyD','KeyW','KeyS'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'Space') input.jumpPressed = true;
    if (e.code === 'KeyP' || e.code==='Escape') togglePause();
    if (e.code === 'KeyR') { if (game.state === 'playing') killPlayer('reset'); }
    if (e.code === 'KeyM') { toggleMute(); }
    if (e.code === 'Enter' || e.code === 'Space') {
      if (game.state === 'title' || game.state === 'gameover'||game.state==='complete') { startRun(); }
    }
    SFX.resume();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  function pollInput() {
    input.left = !!(keys.ArrowLeft || keys.KeyA);
    input.right = !!(keys.ArrowRight || keys.KeyD);
    input.up = !!(keys.ArrowUp || keys.KeyW || touch.up);
    input.down = !!(keys.ArrowDown || keys.KeyS || touch.down);
    input.jump = !!keys.Space;
    // Touch buttons override
    if (touch.left) input.left = true;
    if (touch.right) input.right = true;
    if (touch.jump) input.jump = true;
    if (touch.jumpPressed) { input.jumpPressed = true; touch.jumpPressed = false; }
  }

  // ─── Touch controls ────────────────────────────────────
  const touch = { left: false, right: false, up:false,down:false,jump: false, jumpPressed: false };
  function resetTouch() {
    for(const key of Object.keys(touch))touch[key]=false;
    for(const key of Object.keys(keys))keys[key]=false;
    input.jumpPressed=false;
    document.querySelectorAll('.touch-btn.is-held').forEach(el=>el.classList.remove('is-held'));
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
      el.classList.add('is-held');
      if (key === 'jump') touch.jumpPressed = true;
      SFX.resume();
      if (game.state === 'title' || game.state === 'gameover') startRun();
    };
    const release = (e) => { e.preventDefault(); touch[key] = false;el.classList.remove('is-held'); };
    // Pointer events subsume mouse + touch + pen, so separate touch/mouse
    // handlers are not needed. setPointerCapture keeps the release bound to
    // this button even if the finger slides off before lifting.
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
    el.addEventListener('pointerleave', release);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  bindButton('btn-left', 'left');
  bindButton('btn-right', 'right');
  bindButton('btn-up', 'up');
  bindButton('btn-down', 'down');
  bindButton('btn-jump', 'jump');

  // Tap-style buttons (respawn, mute) — single action, not a held control.
  function bindTap(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    const onTap = (e) => { e.preventDefault(); SFX.resume(); fn(); };
    el.addEventListener('pointerdown', onTap);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(e); } });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  bindTap('btn-respawn', requestRespawn);
  bindTap('btn-mute', toggleMute);
  bindTap('btn-pause', togglePause);
  bindTap('hud-mute', toggleMute); // desktop AUDIO indicator is clickable too

  // Show touch UI on touch / coarse-pointer devices
  const coarse = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
  if (coarse) {
    document.getElementById('touch-ui').style.display = 'flex';
    const tu = document.getElementById('touch-util');
    if (tu) tu.style.display = 'flex';
  }
  // Clear held movement if the window loses focus (alt-tab, app switch).
  window.addEventListener('blur', resetTouch);

  // ─── Game state machine ───────────────────────────────
  let audioMuted = false;
  function toggleMute() {
    audioMuted = !audioMuted;
    SFX.setVolume(audioMuted ? 0 : 0.5);
    updateHud();
  }
  // Touch-reachable respawn: same path as the keyboard 'R', so a player who
  // soft-locks in a sealed chamber can always recover without a keyboard.
  function requestRespawn() {
    if (game.state === 'playing'&&!game.paused) killPlayer('reset');
  }
  function togglePause() {
    if(game.state!=='playing')return;
    game.paused=!game.paused;resetTouch();
    document.getElementById('btn-pause').textContent=game.paused?'RESUME':'PAUSE';
    updateHud();
  }
  const game = {
    state: 'title',     // title | intro | playing | dying | clear | gameover | complete
    stateTime: 0,
    score: 0,
    best: parseInt(localStorage.getItem('nodehopper-best') || '0', 10),
    lives: 7,
    paused:false,
    chambersCleared: 0,
    chamberOrder: [],
    chamberIdx: 0,
    chamberTimer: 0,
    nodesInChamber: 0,
    deathReason: '',
  };

  function makeOrder() {
    return CHAMBERS.map((_,index)=>index);
  }

  function startRun() {
    SFX.start();
    document.getElementById('title-card').classList.remove('show');
    document.getElementById('gameover-card').classList.remove('show');
    document.getElementById('clear-card').classList.remove('show');
    game.score = 0;
    game.lives = 7;
    game.paused=false;
    document.getElementById('btn-pause').textContent='PAUSE';
    game.chambersCleared = 0;
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
    document.getElementById('chamber-hint').textContent=chamberState.hint;
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
    if(game.state!=='playing'||!chamberState.nodes.length||chamberState.nodes.some(n=>!n.collected))return;
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

  function gameOver(won=false) {
    if(won)SFX.clear();else SFX.gameOver();
    game.state = 'gameover';
    game.stateTime = 0;
    document.getElementById('gameover-card').classList.add('show');
    document.getElementById('go-score').textContent = String(game.score);
    document.getElementById('go-best').textContent = String(game.best);
    document.getElementById('go-cleared').textContent = String(game.chambersCleared);
    document.getElementById('go-title').textContent='KERNEL TERMINATED';
    document.getElementById('go-message').textContent='Your route is learned. Take another run.';
  }

  function completeRun() {
    gameOver(true);game.state='complete';
    document.getElementById('go-title').textContent='NETWORK RESTORED';
    document.getElementById('go-message').textContent=`All ${CHAMBERS.length} rooms cleared. Every node recovered. You made the route.`;
  }

  // ─── HUD ──────────────────────────────────────────────
  function updateHud() {
    document.getElementById('hud-score').textContent = String(game.score).padStart(6, '0');
    document.getElementById('hud-best').textContent = String(game.best).padStart(6, '0');
    document.getElementById('hud-lives').innerHTML = '<span class="life-pip"></span>'.repeat(Math.max(0, game.lives));
    document.getElementById('hud-chamber').textContent =
      String(Math.min(CHAMBERS.length,game.chambersCleared + 1)).padStart(2, '0');
    document.getElementById('hud-total').textContent =
      `/ ${CHAMBERS.length}`;
    document.getElementById('hud-mute').textContent = audioMuted ? 'MUTED' : 'AUDIO';
    document.getElementById('room-objective').textContent=game.paused?'PAUSED — press P or Resume':chamberState.hint;
    document.getElementById('node-count').textContent=`${chamberState.nodes.filter(n=>n.collected).length} / ${chamberState.nodes.length} NODES`;
  }

  // ─── Update loop ──────────────────────────────────────
  let last = performance.now() / 1000;
  let accumulator=0;
  // Fixed 1/60 physics; hidden tabs discard accumulated time and held inputs.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {resetTouch();if(game.state==='playing'&&!game.paused)togglePause();}
    last = performance.now() / 1000;accumulator=0;
  });
  function simulate(dt) {
    if(game.paused)return;
    pollInput();
    game.stateTime += dt;

    if (game.state === 'playing') {
      game.chamberTimer += dt;
      stepPlayer(dt);
      stepEntities(dt);
      checkCollisions();
    } else if (game.state === 'intro') {
      stepEntities(dt);
      if (game.stateTime > 1.8) {
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
          // Reset dissolves & hazards to initial state so a retry is deterministic
          // (matters more now that respawn is reachable from the touch UI).
          chamberState.dissolves.forEach(d => { d.state = 'solid'; d.timer = 0; d.fade = 1; d.mesh.visible = true; });
          chamberState.hazards.forEach(h => { h.x = h.spawnX; h.dir = h.spawnDir;h.phase='patrol';h.timer=0; });
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
          completeRun();
        } else {
          enterChamber();
        }
      }
    } else if (game.state === 'title' || game.state === 'gameover') {
      stepEntities(dt);
    }

    updateParticles(dt);
    updateShake(dt);
    // consume one-shot inputs
    input.jumpPressed = false;
  }
  function frame() {
    const now=performance.now()/1000;
    accumulator+=Math.min(now-last,.1);last=now;
    while(accumulator>=1/60){simulate(1/60);accumulator-=1/60;}
    renderer.render(scene,camera);
    requestAnimationFrame(frame);
  }

  // ─── Player step (input + physics) ────────────────────
  function stepPlayer(dt) {
    player.climbCooldown=Math.max(0,(player.climbCooldown||0)-dt);
    const near=chamberState.climbs.find(c=>Math.abs(player.x-c.x)<.48&&Math.abs(player.y-c.y)<.95);
    if(player.climbing&&(!near||input.left||input.right))player.climbing=null;
    if(!player.climbing&&!player.climbCooldown&&!input.left&&!input.right&&near&&(input.up||input.down)&&NHTraversal.climbDirection(near.type,input.up,input.down))player.climbing=near;
    if(player.climbing&&input.jumpPressed) {
      player.climbing=null;player.climbCooldown=.25;player.coyote=PHYS.COYOTE;player.onGround=true;
    }
    if(player.climbing) {
      const c=near||player.climbing;
      const column=chamberState.climbs.filter(r=>r.x===c.x);
      const low=Math.min(...column.map(r=>r.y))-.45,high=Math.max(...column.map(r=>r.y))+.45;
      player.x=c.x;player.vx=0;player.vy=0;player.onGround=false;
      player.y=Math.max(low,Math.min(high,player.y+NHTraversal.climbDirection(c.type,input.up,input.down)*PHYS.CLIMB_SPEED*dt));
      player.mesh.position.set(player.x,player.y,1);player.mesh.scale.set(.86,1.1,1);
      return;
    }
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
      if(game.state!=='playing')return;
      if(h.type==='dart') {
        NHTraversal.advanceDart(h,player,dt);
        h.mesh.position.set(h.x,h.y,0);
        h.mesh.scale.set(h.phase==='charge'?1.8:1,h.phase==='charge'?.45:1,1);
        h.core.userData.coreMat.color.setHex(h.phase==='warning'?COL.node:COL.hazard);
        return;
      }
      h.x += h.dir * PHYS.HAZARD_SPEED * dt;
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
    if(game.state!=='playing')return;
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
        shake(0.06, 0.08); // tiny tactile pop on pickup (no-op under reduced-motion)
        game.score += 50;
        for(const bridge of chamberState.bridges) {
          if(!bridge.active&&bridge.trigger[0]===n.col&&bridge.trigger[1]===n.row) {
            bridge.active=true;
            for(const [col,row] of bridge.cells)chamberState.thins.push(makeThin(col,row));
            chamberState.hint='ROUTE OPENED — the new bridge is yours. Recover the remaining nodes.';
          }
        }
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
    if (chamberState.nodes.length && chamberState.nodes.every(n => n.collected)) {
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

  const qaMode=new URLSearchParams(location.search).get('qa')==='1';
  const manual=qaMode&&new URLSearchParams(location.search).get('manual')==='1';
  if(!manual)requestAnimationFrame(frame);

  // Expose for debugging / headless verification
  window.__nh = {
    game, player, chamberState, PHYS,
    toggleMute, requestRespawn,
    get reduceMotion() { return reduceMotion; },
    get muted() { return audioMuted; },
    get particleCount() { return particles.length; },
    get renderInfo(){return{draws:renderer.info.render.calls,geometries:renderer.info.memory.geometries};},
  };
  if(qaMode)window.__nh.qa={
    tick(frames=1) {
      for(let i=0;i<Math.min(600,frames);i++)simulate(1/60);
      renderer.render(scene,camera);
    },
    step(actions={},frames=1,render=true) {
      const wasJump=Boolean(keys.Space);resetTouch();
      keys.ArrowLeft=!!actions.left;keys.ArrowRight=!!actions.right;
      keys.ArrowUp=!!actions.up;keys.ArrowDown=!!actions.down;keys.Space=!!actions.jump;
      input.jumpPressed=!!actions.jump&&!wasJump;
      for(let i=0;i<Math.min(600,frames);i++)simulate(1/60);
      if(render)renderer.render(scene,camera);
      return{state:game.state,x:player.x,y:player.y,nodes:chamberState.nodes.filter(n=>n.collected).length,lives:game.lives};
    },
  };
})();
