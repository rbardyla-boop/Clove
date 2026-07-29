(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const startPanel = document.getElementById('startPanel');
  const overPanel = document.getElementById('gameOverPanel');
  const startButton = document.getElementById('startButton');
  const restartButton = document.getElementById('restartButton');
  const muteButton = document.getElementById('muteButton');
  const toastEl = document.getElementById('toast');
  const finalStats = document.getElementById('finalStats');
  const gameOverTitle = document.getElementById('gameOverTitle');
  const touchControls = document.getElementById('touchControls');

  const W = canvas.width;
  const H = canvas.height;
  const TAU = Math.PI * 2;
  const QUALITY = {
    ECHO_SECONDS: 7,
    REWIND_SECONDS: 2.5,
    RUN_SECONDS: 180,
  };

  const palette = {
    bg: '#070812',
    paper: '#f5f0df',
    mint: '#7dffc7',
    violet: '#9a7dff',
    coral: '#ff7d9c',
    gold: '#ffe27d',
    cyan: '#72d9ff',
  };

  const NOTE_TYPES = [
    { key: 'MINT', colour: palette.mint, freq: 261.63, glyph: 'I' },
    { key: 'VIOLET', colour: palette.violet, freq: 329.63, glyph: 'II' },
    { key: 'CORAL', colour: palette.coral, freq: 392.00, glyph: 'III' },
  ];

  const keys = new Set();
  function safeStorageGet(key, fallback = '0') { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
  function safeStorageSet(key, value) { try { localStorage.setItem(key, value); } catch {} }
  let audio = null;
  let muted = false;
  let toastTimer = 0;
  let last = performance.now();

  const state = {
    mode: 'menu',
    time: 0,
    score: 0,
    combo: 1,
    high: Number(safeStorageGet('echoBloomHigh', '0') || 0),
    echoesMade: 0,
    blooms: 0,
    rewinds: 0,
    kills: 0,
    bentEnemies: 0,
    firstBendShown: false,
    beatClock: 0,
    beatStep: 0,
    shake: 0,
    flash: 0,
    echoClock: 0,
    spawnClock: 0,
    noteClock: 0,
    patternIndex: 0,
    pattern: [],
    harmonyCount: 0,
    rewindReady: true,
    introStage: 0,
    introClock: 0,
    paused: false,
    particles: [],
    enemies: [],
    notes: [],
    vines: [],
    echoes: [],
    history: [],
    route: [],
    ripples: [],
    floatingText: [],
    player: null,
  };

  function randomPattern() {
    const pattern = [];
    let lastType = -1;
    for (let i = 0; i < 3; i++) {
      const options = NOTE_TYPES.map((_, idx) => idx).filter(idx => idx !== lastType || Math.random() < 0.35);
      const pick = options[(Math.random() * options.length) | 0];
      pattern.push(pick);
      lastType = pick;
    }
    return pattern;
  }

  function resetGame() {
    state.mode = 'playing';
    state.time = 0;
    state.score = 0;
    state.combo = 1;
    state.echoesMade = 0;
    state.blooms = 0;
    state.rewinds = 0;
    state.kills = 0;
    state.bentEnemies = 0;
    state.firstBendShown = false;
    state.beatClock = 0;
    state.beatStep = 0;
    state.shake = 0;
    state.flash = 0;
    state.echoClock = 0;
    state.spawnClock = 0;
    state.noteClock = 0;
    state.patternIndex = 0;
    state.pattern = randomPattern();
    state.harmonyCount = 0;
    state.rewindReady = true;
    state.introStage = 0;
    state.introClock = 0;
    state.paused = false;
    state.particles = [];
    state.enemies = [];
    state.notes = [];
    state.vines = [];
    state.echoes = [];
    state.history = [];
    state.route = [];
    state.ripples = [];
    state.floatingText = [];
    state.player = {
      x: W * 0.5,
      y: H * 0.54,
      vx: 0,
      vy: 0,
      radius: 9,
      facingX: 1,
      facingY: 0,
      dashCooldown: 0,
      invincible: 1.2,
      petals: 0,
    };
    spawnNote(state.pattern[0], false, true);
    spawnNote((state.pattern[0] + 1) % 3, true);
    spawnNote((state.pattern[0] + 2) % 3, true);
    overPanel.classList.remove('show');
    startPanel.classList.remove('show');
    toast('MOVE. LEAVE A MEMORY.', palette.mint);
    beginAudio();
    recordGameActivity(false);
    window.cloveSignal?.track('game_started', { surface: 'echo_bloom' });
  }

  function recordGameActivity(completed) {
    const now = Date.now();
    try {
      const profile = JSON.parse(safeStorageGet('clove_games_profile_v1', '{"games":{}}'));
      profile.games = profile.games && typeof profile.games === 'object' ? profile.games : {};
      const previous = profile.games['echo-bloom'] || {};
      profile.games['echo-bloom'] = {
        lastPlayed: now,
        plays: Math.max(0, Number(previous.plays) || 0) + (completed ? 0 : 1),
        completions: Math.max(0, Number(previous.completions) || 0) + (completed ? 1 : 0),
        highScore: Math.max(state.high, Number(previous.highScore) || 0),
      };
      localStorage.setItem('clove_games_profile_v1', JSON.stringify(profile));
      localStorage.setItem('clove_last_activity_v1', JSON.stringify({
        kind: 'game',
        slug: 'echo-bloom',
        title: 'Echo Bloom',
        href: '/games/echo-bloom/',
        at: now,
      }));
    } catch {}
  }

  function beginAudio() {
    if (!audio) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ac = new AudioCtx();
      const master = ac.createGain();
      master.gain.value = muted ? 0 : 0.16;
      master.connect(ac.destination);
      audio = { ac, master };
    }
    if (audio.ac.state === 'suspended') audio.ac.resume().catch(() => {});
  }

  function tone(freq, duration = 0.16, type = 'sine', gain = 0.18, offset = 0) {
    if (!audio || muted) return;
    const t = audio.ac.currentTime + offset;
    const osc = audio.ac.createOscillator();
    const g = audio.ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(t);
    osc.stop(t + duration + 0.03);
  }

  function chord(pattern = state.pattern) {
    pattern.forEach((idx, i) => tone(NOTE_TYPES[idx].freq * (i === 2 ? 2 : 1), 0.5, i === 1 ? 'triangle' : 'sine', 0.13, i * 0.055));
  }

  function noiseBurst() {
    if (!audio || muted) return;
    const len = Math.floor(audio.ac.sampleRate * 0.14);
    const buffer = audio.ac.createBuffer(1, len, audio.ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ac.createBufferSource();
    const g = audio.ac.createGain();
    g.gain.value = 0.11;
    src.buffer = buffer;
    src.connect(g);
    g.connect(audio.master);
    src.start();
  }

  function toast(text, colour = palette.paper) {
    toastEl.textContent = text;
    toastEl.style.background = colour;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1150);
  }

  function spawnNote(forcedType = null, wide = false, nearPlayer = false) {
    const type = forcedType === null ? (Math.random() * NOTE_TYPES.length) | 0 : forcedType;
    const margin = 78;
    let x, y;
    for (let tries = 0; tries < 30; tries++) {
      if (nearPlayer && state.player) {
        const a = Math.random() * TAU;
        const d0 = 90 + Math.random() * 55;
        x = Math.max(margin, Math.min(W - margin, state.player.x + Math.cos(a) * d0));
        y = Math.max(95, Math.min(H - 55, state.player.y + Math.sin(a) * d0));
      } else {
        x = margin + Math.random() * (W - margin * 2);
        y = 95 + Math.random() * (H - 145);
      }
      const d = Math.hypot(x - (state.player?.x || 0), y - (state.player?.y || 0));
      if (nearPlayer || wide || d > 150) break;
    }
    state.notes.push({ x, y, type, radius: 13, phase: Math.random() * TAU, born: state.time });
  }

  function spawnEnemy() {
    const edge = (Math.random() * 4) | 0;
    let x, y;
    if (edge === 0) { x = -20; y = Math.random() * H; }
    if (edge === 1) { x = W + 20; y = Math.random() * H; }
    if (edge === 2) { x = Math.random() * W; y = -20; }
    if (edge === 3) { x = Math.random() * W; y = H + 20; }
    const tier = Math.min(3, 1 + Math.floor(state.time / 48));
    state.enemies.push({
      x, y,
      vx: 0, vy: 0,
      radius: 9 + Math.random() * 4,
      speed: 42 + Math.random() * 22 + state.time * 0.13,
      phase: Math.random() * TAU,
      hp: tier === 3 && Math.random() < 0.18 ? 2 : 1,
      tint: tier === 3 ? palette.coral : palette.violet,
      railInfluence: 0, railX: 0, railY: 0,
    });
  }

  function recordPath(dt) {
    const p = state.player;
    const sample = { x: p.x, y: p.y, t: state.time, vx: p.vx, vy: p.vy };
    state.history.push(sample);
    state.route.push(sample);
    const historyCut = state.time - 7.5;
    while (state.history.length && state.history[0].t < historyCut) state.history.shift();
    const routeCut = state.time - QUALITY.ECHO_SECONDS;
    while (state.route.length && state.route[0].t < routeCut) state.route.shift();
  }

  function makeEcho() {
    if (state.route.length < 25) return;
    const points = simplifyPath(state.route.map(p => ({ x: p.x, y: p.y })), 5);
    if (points.length < 5) return;
    const vine = {
      id: `${Date.now()}-${Math.random()}`,
      points,
      life: 28,
      maxLife: 28,
      pulse: 0,
    };
    state.vines.push(vine);
    state.echoes.push({ points, index: 0, progress: 0, speed: Math.max(18, points.length / QUALITY.ECHO_SECONDS), life: 28, colour: state.echoesMade % 2 ? palette.violet : palette.mint });
    state.echoesMade++;
    state.ripples.push({ x: points[0].x, y: points[0].y, r: 10, life: 0.9, max: 0.9, colour: palette.mint });
    burst(points[0].x, points[0].y, palette.mint, 22, 95);
    tone(196, 0.42, 'triangle', 0.2);
    tone(392, 0.3, 'sine', 0.11, 0.08);
    toast('YOUR ROUTE RETURNED AS AN ECHO', palette.mint);
  }

  function simplifyPath(points, minDist) {
    if (points.length <= 2) return points;
    const out = [points[0]];
    let last = points[0];
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= minDist) {
        out.push(p);
        last = p;
      }
    }
    out.push(points[points.length - 1]);
    return out;
  }

  function nearestPointOnVines(x, y) {
    let best = null;
    let bestDist = Infinity;
    state.vines.forEach((vine, vi) => {
      for (let i = 0; i < vine.points.length - 1; i++) {
        const a = vine.points[i];
        const b = vine.points[i + 1];
        const abx = b.x - a.x, aby = b.y - a.y;
        const len2 = abx * abx + aby * aby || 1;
        const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / len2));
        const px = a.x + abx * t, py = a.y + aby * t;
        const d = Math.hypot(x - px, y - py);
        if (d < bestDist) {
          bestDist = d;
          best = { x: px, y: py, dist: d, vine, vineIndex: vi, segment: i };
        }
      }
    });
    return best;
  }

  function dash() {
    if (state.mode !== 'playing' || state.paused) return;
    const p = state.player;
    if (p.dashCooldown > 0) return;
    const near = nearestPointOnVines(p.x, p.y);
    p.dashCooldown = 0.72;
    p.invincible = Math.max(p.invincible, 0.22);
    const boost = 280;
    p.vx += p.facingX * boost;
    p.vy += p.facingY * boost;
    if (near && near.dist < 31) {
      bloomCut(near);
    } else {
      burst(p.x, p.y, palette.paper, 9, 70);
      tone(124, 0.08, 'square', 0.08);
    }
  }

  function bloomCut(hit) {
    const vine = hit.vine;
    const centre = { x: hit.x, y: hit.y };
    const radius = 86 + Math.min(60, vine.points.length * 0.25);
    state.vines.splice(hit.vineIndex, 1);
    const echoIndex = state.echoes.findIndex(e => e.points === vine.points);
    if (echoIndex >= 0) state.echoes.splice(echoIndex, 1);
    let killed = 0;
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      if (Math.hypot(e.x - centre.x, e.y - centre.y) < radius + e.radius) {
        e.hp--;
        if (e.hp <= 0) {
          killed++;
          state.enemies.splice(i, 1);
          burst(e.x, e.y, palette.coral, 12, 120);
        }
      }
    }
    state.blooms++;
    state.kills += killed;
    state.combo = Math.min(8, state.combo + 0.5 + killed * 0.2);
    const gain = Math.round((220 + killed * 120) * state.combo);
    state.score += gain;
    state.shake = Math.min(15, 5 + killed * 1.8);
    state.flash = 0.5;
    state.ripples.push({ x: centre.x, y: centre.y, r: 18, life: 0.65, max: 0.65, colour: palette.gold, target: radius });
    state.floatingText.push({ x: centre.x, y: centre.y - 24, text: `BLOOM CUT +${gain}`, life: 1.2, colour: palette.gold });
    burst(centre.x, centre.y, palette.gold, 34, 175);
    noiseBurst();
    tone(130.81, 0.28, 'sawtooth', 0.13);
    tone(523.25, 0.5, 'triangle', 0.15, 0.03);
    toast(killed ? `BLOOM CUT — ${killed} CAUGHT` : 'BLOOM CUT — BUILD THE MULTIPLIER', palette.gold);
  }

  function collectNote(note, index) {
    const expected = state.pattern[state.patternIndex];
    if (note.type === expected) {
      state.patternIndex++;
      state.score += Math.round(80 * state.combo);
      state.combo = Math.min(8, state.combo + 0.18);
      tone(NOTE_TYPES[note.type].freq, 0.28, 'sine', 0.2);
      burst(note.x, note.y, NOTE_TYPES[note.type].colour, 17, 90);
      state.floatingText.push({ x: note.x, y: note.y - 12, text: `${state.patternIndex}/3`, life: 0.8, colour: NOTE_TYPES[note.type].colour });
      if (state.patternIndex >= state.pattern.length) completeHarmony();
    } else {
      state.combo = Math.max(1, state.combo - 0.7);
      state.patternIndex = 0;
      tone(92, 0.18, 'square', 0.12);
      toast('WRONG NOTE — THE PATTERN RESTARTED', palette.coral);
    }
    state.notes.splice(index, 1);
    const nextType = state.pattern[state.patternIndex] ?? state.pattern[0];
    const expectedPresent = state.notes.some(n => n.type === nextType);
    spawnNote(expectedPresent ? null : nextType, false, !expectedPresent);
  }

  function completeHarmony() {
    state.harmonyCount++;
    state.player.petals = Math.min(8, state.player.petals + 1);
    state.rewindReady = true;
    const reward = Math.round(650 * state.combo);
    state.score += reward;
    state.patternIndex = 0;
    chord();
    state.ripples.push({ x: state.player.x, y: state.player.y, r: 20, life: 1.1, max: 1.1, colour: palette.mint, target: 220 });
    burst(state.player.x, state.player.y, palette.mint, 42, 160);
    state.flash = 0.8;
    toast(`HARMONY COMPLETE +${reward} — REWIND RESTORED`, palette.mint);
    setTimeout(() => { state.pattern = randomPattern(); }, 280);
  }

  function hitPlayer(enemyIndex) {
    const p = state.player;
    if (p.invincible > 0) return;
    if (state.rewindReady) {
      state.rewindReady = false;
      state.rewinds++;
      const targetTime = state.time - QUALITY.REWIND_SECONDS;
      let sample = state.history[0];
      for (const h of state.history) {
        if (h.t <= targetTime) sample = h;
        else break;
      }
      if (sample) {
        p.x = sample.x; p.y = sample.y; p.vx = -sample.vx * 0.25; p.vy = -sample.vy * 0.25;
      }
      p.invincible = 1.35;
      state.enemies.splice(enemyIndex, 1);
      state.shake = 13;
      state.flash = 1;
      state.combo = Math.max(1, state.combo - 1);
      state.ripples.push({ x: p.x, y: p.y, r: 20, life: 0.9, max: 0.9, colour: palette.cyan, target: 240 });
      burst(p.x, p.y, palette.cyan, 40, 180);
      noiseBurst();
      tone(440, 0.55, 'sine', 0.16);
      tone(220, 0.55, 'triangle', 0.13, 0.04);
      toast('HIT REWOUND — COMPLETE A HARMONY TO RECHARGE', palette.cyan);
    } else {
      endGame(false);
    }
  }

  function burst(x, y, colour, count = 10, speed = 80) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const s = speed * (0.25 + Math.random() * 0.75);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35 + Math.random() * 0.65, max: 1, colour, size: 1.2 + Math.random() * 3.2 });
    }
  }

  function endGame(completed) {
    state.mode = 'over';
    if (state.score > state.high) {
      state.high = state.score;
      safeStorageSet('echoBloomHigh', String(state.high));
    }
    gameOverTitle.textContent = completed ? 'Three minutes. One living score.' : 'The second hit stayed real.';
    finalStats.innerHTML = [
      ['SCORE', state.score.toLocaleString('en-GB')],
      ['HARMONIES', state.harmonyCount],
      ['BLOOM CUTS', state.blooms],
      ['ECHOES', state.echoesMade],
      ['RAIL BENDS', state.bentEnemies],
      ['REWINDS', state.rewinds],
    ].map(([label, value]) => `<div><b>${value}</b><span>${label}</span></div>`).join('');
    overPanel.classList.add('show');
    chord();
    recordGameActivity(completed);
    window.cloveSignal?.track('game_completed', {
      surface: 'echo_bloom',
      detail: completed ? 'timer_complete' : 'second_hit',
    });
  }

  function update(dt) {
    if (state.mode !== 'playing' || state.paused) return;
    state.time += dt;
    if (state.time >= QUALITY.RUN_SECONDS) {
      endGame(true);
      return;
    }
    state.introClock += dt;
    state.flash = Math.max(0, state.flash - dt * 1.8);
    state.shake = Math.max(0, state.shake - dt * 18);

    const p = state.player;
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.invincible = Math.max(0, p.invincible - dt);

    let ix = 0, iy = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) ix -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) ix += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) iy -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) iy += 1;
    const ilen = Math.hypot(ix, iy) || 1;
    ix /= ilen; iy /= ilen;
    const accel = 520;
    p.vx += ix * accel * dt;
    p.vy += iy * accel * dt;
    const drag = Math.pow(0.00065, dt);
    p.vx *= drag;
    p.vy *= drag;
    const maxSpeed = 155;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > maxSpeed) { p.vx = p.vx / speed * maxSpeed; p.vy = p.vy / speed * maxSpeed; }
    if (speed > 12) { p.facingX = p.vx / speed; p.facingY = p.vy / speed; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const pad = 20;
    if (p.x < pad) { p.x = pad; p.vx = Math.abs(p.vx) * 0.5; }
    if (p.x > W - pad) { p.x = W - pad; p.vx = -Math.abs(p.vx) * 0.5; }
    if (p.y < 72) { p.y = 72; p.vy = Math.abs(p.vy) * 0.5; }
    if (p.y > H - pad) { p.y = H - pad; p.vy = -Math.abs(p.vy) * 0.5; }

    recordPath(dt);

    state.echoClock += dt;
    if (state.echoClock >= QUALITY.ECHO_SECONDS) {
      state.echoClock -= QUALITY.ECHO_SECONDS;
      makeEcho();
    }

    state.spawnClock += dt;
    const spawnEvery = Math.max(0.58, 1.55 - state.time * 0.0047);
    if (state.spawnClock >= spawnEvery) {
      state.spawnClock = 0;
      spawnEnemy();
    }

    state.noteClock += dt;
    if (state.notes.length < 4 && state.noteClock > 1.4) {
      state.noteClock = 0;
      spawnNote();
    }

    state.beatClock += dt;
    if (state.beatClock >= 0.58) {
      state.beatClock -= 0.58;
      const heard = Math.max(1, state.patternIndex);
      const noteIndex = state.pattern[state.beatStep % heard];
      tone(NOTE_TYPES[noteIndex].freq * 0.5, 0.16, 'triangle', 0.035);
      state.beatStep++;
    }

    for (let i = state.notes.length - 1; i >= 0; i--) {
      const n = state.notes[i];
      n.phase += dt * 2.4;
      if (Math.hypot(n.x - p.x, n.y - p.y) < n.radius + p.radius + 4) collectNote(n, i);
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      e.phase += dt * 3;
      let tx = p.x, ty = p.y;
      const echo = state.echoes.length ? state.echoes[(i + state.echoesMade) % state.echoes.length] : null;
      if (echo && i % 4 === 0) {
        const ep = echo.points[Math.min(echo.points.length - 1, echo.index | 0)];
        if (ep) { tx = ep.x; ty = ep.y; }
      }
      let dx = tx - e.x, dy = ty - e.y;
      let d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      e.vx += dx * e.speed * dt * 1.9;
      e.vy += dy * e.speed * dt * 1.9;

      const near = nearestPointOnVines(e.x, e.y);
      e.railInfluence = Math.max(0, (e.railInfluence || 0) - dt * 2.4);
      if (near && near.dist < 52) {
        let rx = e.x - near.x, ry = e.y - near.y;
        const rd = Math.hypot(rx, ry) || 1;
        rx /= rd; ry /= rd;
        const force = (52 - near.dist) * 9.2;
        e.vx += rx * force * dt;
        e.vy += ry * force * dt;
        e.railInfluence = Math.min(1, e.railInfluence + dt * 7);
        e.railX = near.x; e.railY = near.y;
        near.vine.pulse = 1;
        if (!e.wasBent) {
          e.wasBent = true;
          state.bentEnemies++;
          if (!state.firstBendShown) {
            state.firstBendShown = true;
            toast('LIVING RAILS BEND ENEMY PATHS', palette.violet);
            tone(293.66, 0.18, 'triangle', 0.1);
          }
        }
      } else if (!near || near.dist > 70) { e.wasBent = false; }
      const edrag = Math.pow(0.04, dt);
      e.vx *= edrag; e.vy *= edrag;
      const es = Math.hypot(e.vx, e.vy);
      if (es > e.speed) { e.vx = e.vx / es * e.speed; e.vy = e.vy / es * e.speed; }
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.radius + p.radius) hitPlayer(i);
    }

    for (let i = state.vines.length - 1; i >= 0; i--) {
      const v = state.vines[i];
      v.life -= dt;
      v.pulse = Math.max(0, v.pulse - dt * 2.5);
      if (v.life <= 0) state.vines.splice(i, 1);
    }
    for (let i = state.echoes.length - 1; i >= 0; i--) {
      const e = state.echoes[i];
      e.life -= dt;
      e.progress += e.speed * dt;
      e.index = Math.floor(e.progress) % Math.max(1, e.points.length);
      if (e.life <= 0) state.echoes.splice(i, 1);
    }
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const q = state.particles[i];
      q.life -= dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= Math.pow(0.05, dt); q.vy *= Math.pow(0.05, dt);
      if (q.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.ripples.length - 1; i >= 0; i--) {
      const r = state.ripples[i];
      r.life -= dt;
      r.r += ((r.target || 150) - r.r) * dt * 4;
      if (r.life <= 0) state.ripples.splice(i, 1);
    }
    for (let i = state.floatingText.length - 1; i >= 0; i--) {
      const f = state.floatingText[i];
      f.life -= dt; f.y -= dt * 26;
      if (f.life <= 0) state.floatingText.splice(i, 1);
    }
  }

  function draw() {
    ctx.save();
    const sx = state.shake ? (Math.random() - 0.5) * state.shake : 0;
    const sy = state.shake ? (Math.random() - 0.5) * state.shake : 0;
    ctx.translate(sx, sy);
    drawBackground();
    if (state.player) {
      drawVines();
      drawRoute();
      drawNotes();
      drawEnemies();
      drawEchoes();
      drawEffects();
      drawPlayer();
      drawHUD();
    } else drawMenuBackdrop();
    if (state.paused && state.mode === 'playing') drawPause();
    if (state.flash > 0) {
      ctx.globalAlpha = Math.min(0.18, state.flash * 0.2);
      ctx.fillStyle = state.rewindReady ? palette.mint : palette.cyan;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    ctx.restore();
  }

  function drawBackground() {
    const t = state.time || performance.now() / 1000;
    const grad = ctx.createRadialGradient(W * 0.5, H * 0.48, 30, W * 0.5, H * 0.48, W * 0.65);
    grad.addColorStop(0, '#121229');
    grad.addColorStop(0.55, '#080913');
    grad.addColorStop(1, '#04050a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = 'rgba(154,125,255,0.075)';
    ctx.lineWidth = 1;
    const spacing = 42;
    const drift = (t * 8) % spacing;
    for (let x = -spacing + drift; x < W + spacing; x += spacing) {
      ctx.beginPath();
      for (let y = 55; y <= H; y += 12) {
        const wobble = Math.sin(y * 0.026 + t * 0.7) * 4;
        if (y === 55) ctx.moveTo(x + wobble, y); else ctx.lineTo(x + wobble, y);
      }
      ctx.stroke();
    }
    for (let y = 65; y < H; y += spacing) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 12) {
        const wobble = Math.sin(x * 0.02 - t * 0.55) * 3;
        if (x === 0) ctx.moveTo(x, y + wobble); else ctx.lineTo(x, y + wobble);
      }
      ctx.stroke();
    }
    ctx.restore();

    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, W * 0.7);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,.48)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  function drawMenuBackdrop() {
    const t = performance.now() / 1000;
    ctx.save();
    ctx.translate(W * 0.5, H * 0.55);
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      for (let i = 0; i < 120; i++) {
        const a = i / 119 * TAU;
        const r = 70 + k * 25 + Math.sin(a * (3 + k) + t * (0.4 + k * 0.08)) * 12;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r * 0.45;
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.globalAlpha = 0.12 - k * 0.015;
      ctx.strokeStyle = k % 2 ? palette.violet : palette.mint;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRoute() {
    if (state.route.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      state.route.forEach((p, i) => {
        if (!i) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = pass ? 'rgba(245,240,223,.68)' : 'rgba(125,255,199,.18)';
      ctx.lineWidth = pass ? 1.4 : 8;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawVines() {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    state.vines.forEach((v, vi) => {
      const fade = Math.min(1, v.life / 2);
      ctx.globalAlpha = fade;
      ctx.beginPath();
      v.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.strokeStyle = vi % 2 ? 'rgba(154,125,255,.20)' : 'rgba(125,255,199,.20)';
      ctx.lineWidth = 12 + v.pulse * 5;
      ctx.stroke();
      ctx.beginPath();
      v.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.strokeStyle = vi % 2 ? palette.violet : palette.mint;
      ctx.lineWidth = 2.2 + v.pulse * 1.4;
      ctx.stroke();
      for (let i = 6; i < v.points.length; i += 11) {
        const p = v.points[i];
        const prev = v.points[i - 1];
        const a = Math.atan2(p.y - prev.y, p.x - prev.x) + Math.PI / 2;
        const s = 5 + Math.sin(state.time * 3 + i) * 1.5;
        ctx.fillStyle = vi % 2 ? palette.violet : palette.mint;
        ctx.globalAlpha = fade * 0.5;
        ctx.beginPath();
        ctx.ellipse(p.x + Math.cos(a) * 4, p.y + Math.sin(a) * 4, s, 2.2, a, 0, TAU);
        ctx.fill();
      }
    });
    ctx.restore();
  }

  function drawEchoes() {
    ctx.save();
    state.echoes.forEach((e, i) => {
      const p = e.points[Math.min(e.points.length - 1, e.index)];
      if (!p) return;
      ctx.globalAlpha = Math.min(0.85, e.life / 1.8);
      ctx.fillStyle = e.colour;
      ctx.shadowBlur = 18;
      ctx.shadowColor = e.colour;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6 + Math.sin(state.time * 7 + i) * 1.2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha *= 0.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 15, 0, TAU);
      ctx.strokeStyle = e.colour;
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawNotes() {
    ctx.save();
    state.notes.forEach((n) => {
      const type = NOTE_TYPES[n.type];
      const expected = n.type === state.pattern[state.patternIndex];
      const pulse = 1 + Math.sin(n.phase) * (expected ? 0.18 : 0.08);
      if (expected) {
        const beam = ctx.createLinearGradient(0, 66, 0, n.y - 20);
        beam.addColorStop(0, 'rgba(125,255,199,0)'); beam.addColorStop(1, 'rgba(125,255,199,.22)');
        ctx.fillStyle = beam; ctx.fillRect(n.x - 1, 63, 2, Math.max(0, n.y - 80));
        ctx.fillStyle = type.colour; ctx.globalAlpha = .72; ctx.font = '900 8px system-ui'; ctx.textAlign='center';
        ctx.fillText('NEXT', n.x, n.y - 30); ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = expected ? 1 : 0.72;
      ctx.translate(n.x, n.y);
      ctx.rotate(n.phase * 0.22);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = type.colour;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU;
        const r = (i % 2 ? 19 : 25) * pulse;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#080913';
      ctx.strokeStyle = type.colour;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 13 * pulse, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.rotate(-n.phase * 0.22);
      ctx.fillStyle = type.colour;
      ctx.font = '900 9px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(type.glyph, 0, 0.5);
      ctx.setTransform(1,0,0,1,0,0);
    });
    ctx.restore();
  }

  function drawEnemies() {
    ctx.save();
    state.enemies.forEach((e) => {
      if (e.railInfluence > 0.03) {
        ctx.save();
        ctx.globalAlpha = e.railInfluence * .8;
        ctx.strokeStyle = palette.violet; ctx.lineWidth = 1.5; ctx.setLineDash([3,4]);
        ctx.beginPath(); ctx.moveTo(e.x,e.y); ctx.lineTo(e.railX,e.railY); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = palette.violet; ctx.beginPath(); ctx.arc(e.railX,e.railY,2.5,0,TAU); ctx.fill();
        ctx.restore();
      }
      ctx.translate(e.x, e.y);
      ctx.rotate(e.phase * 0.35);
      ctx.fillStyle = 'rgba(255,125,156,.12)';
      ctx.strokeStyle = e.hp > 1 ? palette.gold : e.tint;
      ctx.lineWidth = e.hp > 1 ? 2.4 : 1.5;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU;
        const r = e.radius * (i % 2 ? 0.52 : 1 + Math.sin(e.phase + i) * 0.09);
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = e.hp > 1 ? palette.gold : palette.coral;
      ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, TAU); ctx.fill();
      ctx.setTransform(1,0,0,1,0,0);
    });
    ctx.restore();
  }

  function drawPlayer() {
    const p = state.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    const flicker = p.invincible > 0 && Math.floor(p.invincible * 14) % 2 === 0;
    ctx.globalAlpha = flicker ? 0.45 : 1;
    for (let i = 0; i < p.petals; i++) {
      const a = i / Math.max(1, p.petals) * TAU + state.time * 0.35;
      ctx.fillStyle = i % 2 ? palette.violet : palette.mint;
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 19, Math.sin(a) * 19, 7, 2.8, a, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = flicker ? 0.45 : 1;
    ctx.shadowBlur = 24;
    ctx.shadowColor = state.rewindReady ? palette.mint : palette.cyan;
    ctx.fillStyle = palette.paper;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = state.rewindReady ? palette.mint : palette.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 13 + Math.sin(state.time * 5) * 1.5, 0, TAU); ctx.stroke();
    const echoPct = state.echoClock / QUALITY.ECHO_SECONDS;
    ctx.globalAlpha = .72; ctx.strokeStyle = palette.violet; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0,0,17,-Math.PI/2,-Math.PI/2 + TAU * echoPct); ctx.stroke();
    ctx.globalAlpha = flicker ? .45 : 1;
    ctx.fillStyle = state.rewindReady ? palette.mint : palette.cyan;
    ctx.beginPath(); ctx.moveTo(p.facingX * 19, p.facingY * 19); ctx.lineTo(p.facingX * 12 - p.facingY * 4, p.facingY * 12 + p.facingX * 4); ctx.lineTo(p.facingX * 12 + p.facingY * 4, p.facingY * 12 - p.facingX * 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawEffects() {
    ctx.save();
    state.ripples.forEach(r => {
      ctx.globalAlpha = Math.max(0, r.life / r.max) * 0.6;
      ctx.strokeStyle = r.colour;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
    });
    state.particles.forEach(q => {
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.fillStyle = q.colour;
      ctx.fillRect(q.x - q.size/2, q.y - q.size/2, q.size, q.size);
    });
    state.floatingText.forEach(f => {
      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.fillStyle = f.colour;
      ctx.font = '900 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.restore();
  }

  function drawHUD() {
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,12,.78)';
    ctx.fillRect(0, 0, W, 60);
    ctx.strokeStyle = 'rgba(255,255,255,.09)';
    ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(W, 60); ctx.stroke();

    ctx.fillStyle = palette.paper;
    ctx.font = '950 23px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(state.score.toLocaleString('en-GB'), 22, 31);
    ctx.fillStyle = '#938ea8'; ctx.font = '800 9px system-ui'; ctx.fillText('SCORE', 23, 46);

    ctx.fillStyle = state.combo > 1.1 ? palette.gold : '#7f7a91';
    ctx.font = '950 17px system-ui';
    ctx.fillText(`×${state.combo.toFixed(1)}`, 128, 30);
    ctx.fillStyle = '#938ea8'; ctx.font = '800 9px system-ui'; ctx.fillText('BLOOM MULTIPLIER', 129, 46);

    const cx = W * 0.46;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#aaa5bb'; ctx.font = '900 9px system-ui';
    ctx.fillText('HARMONY', cx, 15);
    state.pattern.forEach((typeIdx, i) => {
      const x = cx - 42 + i * 42;
      const active = i < state.patternIndex;
      ctx.fillStyle = active ? NOTE_TYPES[typeIdx].colour : 'rgba(255,255,255,.06)';
      ctx.strokeStyle = NOTE_TYPES[typeIdx].colour;
      ctx.lineWidth = active ? 0 : 1.5;
      ctx.beginPath(); ctx.arc(x, 34, 11, 0, TAU); ctx.fill(); if (!active) ctx.stroke();
      ctx.fillStyle = active ? '#070812' : NOTE_TYPES[typeIdx].colour;
      ctx.font = '900 8px system-ui'; ctx.fillText(NOTE_TYPES[typeIdx].glyph, x, 37);
    });

    const echoRemain = Math.max(0, QUALITY.ECHO_SECONDS - state.echoClock);
    ctx.textAlign = 'right';
    ctx.fillStyle = palette.mint; ctx.font = '950 17px system-ui';
    ctx.fillText(`${echoRemain.toFixed(1)}s`, W - 155, 30);
    ctx.fillStyle = '#938ea8'; ctx.font = '800 9px system-ui'; ctx.fillText('UNTIL YOUR ROUTE ECHOES', W - 155, 46);

    ctx.fillStyle = state.rewindReady ? palette.cyan : '#5e5c6c';
    ctx.font = '950 13px system-ui';
    ctx.fillText(state.rewindReady ? 'REWIND READY' : 'REWIND SPENT', W - 22, 27);
    ctx.fillStyle = '#938ea8'; ctx.font = '800 9px system-ui';
    ctx.fillText('RESTORE WITH HARMONY', W - 22, 44);

    const remain = QUALITY.RUN_SECONDS - state.time;
    const min = Math.floor(remain / 60);
    const sec = Math.floor(remain % 60).toString().padStart(2, '0');
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(245,240,223,.72)'; ctx.font = '800 10px system-ui';
    ctx.fillText(`${min}:${sec}`, 16, H - 14);
    ctx.fillStyle = '#77738a';
    ctx.fillText(`RAILS ${state.vines.length}   BENDS ${state.bentEnemies}   BLOOMS ${state.blooms}`, 58, H - 14);

    const dashPct = 1 - Math.min(1, state.player.dashCooldown / 0.72);
    ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fillRect(W - 145, H - 22, 125, 5);
    ctx.fillStyle = dashPct >= 1 ? palette.gold : palette.violet; ctx.fillRect(W - 145, H - 22, 125 * dashPct, 5);
    ctx.textAlign = 'right'; ctx.fillStyle = '#aaa5bb'; ctx.fillText('SPACE: DASH / CUT VINE', W - 20, H - 29);
    ctx.restore();
  }

  function drawPause() {
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,12,.72)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center'; ctx.fillStyle=palette.paper; ctx.font='950 44px system-ui'; ctx.fillText('PAUSED',W/2,H/2);
    ctx.fillStyle='#aaa5bb'; ctx.font='800 12px system-ui'; ctx.fillText('PRESS P TO RETURN',W/2,H/2+28);
    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) {
      if (e.code === 'Space') dash();
      if (e.code === 'KeyP' && state.mode === 'playing') state.paused = !state.paused;
      if (e.code === 'KeyR') resetGame();
      if (e.code === 'KeyM') toggleMute();
      if (e.code === 'Enter' && state.mode !== 'playing') resetGame();
    }
    keys.add(e.code);
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); if (state.mode === 'playing') state.paused = true; });

  const activePointers = new Map();
  touchControls?.querySelectorAll('[data-code]').forEach((button) => {
    const release = (event) => {
      const code = activePointers.get(event.pointerId);
      if (code) keys.delete(code);
      activePointers.delete(event.pointerId);
      button.classList.remove('active');
      try { button.releasePointerCapture(event.pointerId); } catch {}
    };
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      beginAudio();
      activePointers.set(event.pointerId, button.dataset.code);
      keys.add(button.dataset.code);
      button.classList.add('active');
      try { button.setPointerCapture(event.pointerId); } catch {}
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
  });
  touchControls?.querySelector('[data-action="dash"]')?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    beginAudio();
    dash();
  });
  touchControls?.querySelector('[data-action="pause"]')?.addEventListener('click', () => {
    if (state.mode === 'playing') state.paused = !state.paused;
  });

  function toggleMute() {
    muted = !muted;
    muteButton.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    if (audio) audio.master.gain.value = muted ? 0 : 0.16;
  }

  startButton.addEventListener('click', resetGame);
  restartButton.addEventListener('click', resetGame);
  muteButton.addEventListener('click', toggleMute);

  window.__echoBloom = {
    state,
    resetGame,
    makeEcho,
    spawnEnemy,
    spawnNote,
    forceHarmony() {
      state.patternIndex = state.pattern.length;
      completeHarmony();
    },
    forceRailBend() {
      if (!state.vines.length) makeEcho();
      const v=state.vines[0], m=v.points[Math.floor(v.points.length/2)] || v.points[0];
      state.enemies.push({x:m.x+8,y:m.y+8,vx:0,vy:0,radius:10,speed:18,phase:0,hp:1,tint:palette.violet,railInfluence:0,railX:0,railY:0});
    },
    forceBloom() {
      if (!state.vines.length) makeEcho();
      const near = nearestPointOnVines(state.player.x, state.player.y);
      if (near) bloomCut(near);
    },
    setTime(t) { state.time = t; },
  };

  requestAnimationFrame(loop);
})();
