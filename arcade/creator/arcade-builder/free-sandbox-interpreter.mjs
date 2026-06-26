/**
 * Creator Freedom v1 — FREE SANDBOX fixed INTERPRETER (pure + cross-env).
 *
 * `createGameFromGraph(GRAPH)` is a SELF-CONTAINED deterministic arcade engine: given a validated
 * Free Sandbox runtime graph (see schemas/free-sandbox-schema.mjs), it simulates arena + entities +
 * movement patterns + WHEN->THEN rules + objectives + waves on a SEEDED rng and renders to a 2D canvas.
 * It NEVER executes creator code — the graph is pure data. Everything the engine needs is a nested
 * helper or a benign global (Math, matchMedia); it touches NO network/storage/DOM-escape API.
 *
 * The same function is emitted verbatim (.toString()) into a generated package's game.mjs as the FIXED
 * interpreter, AFTER a `const GRAPH = {...}` literal. So the package's only "code" is this reviewed
 * engine; only the closed-vocab DATA varies. The existing importer gate + null-origin sandbox stay the
 * authority, unchanged. Because it is embedded by source text, this function must remain self-contained
 * (no module-scope references) and free of any forbidden token (fetch/eval/storage/url/economy vocab).
 */

/**
 * SELF-CONTAINED deterministic engine. Returns the createGame() contract the SDK adapter bridges:
 * { init(frame), tick(dt), onInput(ev), render(ctx), proposeResult(), status() }.
 */
export function createGameFromGraph(GRAPH) {
  // palette + tier tables are INLINED (this function is emitted standalone — no module imports survive)
  var PALETTE = { cyan: '#22e0ff', magenta: '#ff2d95', violet: '#b14aff', green: '#3df58b', amber: '#ff9e3f' };
  var TIER_SPEED = { still: 0, slow: 42, medium: 84, fast: 150, swift: 230 };
  var TIER_RADIUS = { small: 8, medium: 14, large: 22 };
  var FX_LEVEL = { off: 0, soft: 1, arcade: 2 };
  var MAX_LIVE = 80;

  var G = GRAPH && typeof GRAPH === 'object' ? GRAPH : {};
  var arena = G.arena || {};
  var theme = G.theme || {};
  var obj = G.objective || {};
  var scoring = G.scoring || {};
  var mods = G.modifiers || {};
  var pcfg = G.player || {};
  var types = Array.isArray(G.entities) ? G.entities : [];
  var typeIndex = {};
  for (var ti = 0; ti < types.length; ti++) typeIndex[types[ti].id] = ti;
  var waves = Array.isArray(G.waves) ? G.waves : [];
  var rules = Array.isArray(G.rules) ? G.rules : [];
  var zones = Array.isArray(arena.zones) ? arena.zones : [];

  var accent = PALETTE[theme.palette] || PALETTE.cyan;
  var HIGH = theme.contrast === 'high';
  var RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PARTICLES = RM ? 0 : (FX_LEVEL[theme.particles] || 0);
  var SHAKE = RM ? 0 : (FX_LEVEL[theme.shake] || 0);
  var MAXP = PARTICLES === 2 ? 60 : (PARTICLES === 1 ? 30 : 0);

  function tierSpeed(k) { var v = TIER_SPEED[k]; return typeof v === 'number' ? v : 84; }
  function tierRadius(k) { var v = TIER_RADIUS[k]; return typeof v === 'number' ? v : 14; }

  var w = 360, h = 640;
  var seed = (G.seed | 0) || 1;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  function pick(n) { return Math.floor(rnd() * n); }

  // ── player ──────────────────────────────────────────────────────────────────
  var pradius = tierRadius(pcfg.size || 'medium');
  var pcontrol = pcfg.control || 'free_move';
  var pshape = pcfg.shape || 'triangle';
  var pspeedKey = pcfg.speed || 'medium';
  var plives = typeof pcfg.lives === 'number' ? pcfg.lives : 3;
  var px = 180, py = 540, ptx = 180, pty = 540;
  var lane = 0, laneCount = 3;
  var pHurt = 0; // i-frames after a hit

  // ── live entities ─────────────────────────────────────────────────────────
  var ents = []; // each: { ti, x, y, vx, vy, r, born, phase, cx, cy, alive }
  var wstate = []; for (var wi = 0; wi < waves.length; wi++) wstate.push({ started: false, spawned: 0, next: 0, done: false });
  var fired = {}; // one-shot rule latches by rule id

  // ── run state ───────────────────────────────────────────────────────────────
  var t = 0, score = 0, combo = 0, comboBest = 0, hitCount = 0, collected = 0, wavesCleared = 0;
  var routeIdx = 0, over = false, won = false, surviveAcc = 0, ramp = 1, slowT = 0, hasteT = 0;
  var flash = 0, shakeAmt = 0, msg = '', msgT = 0;
  var part = []; var ppi = 0;

  function rampScale() {
    var base = { none: 0, gentle: 0.1, standard: 0.25, hard: 0.5 }[mods.difficulty_ramp] || 0;
    var s = 1 + base * (t / 60);
    return s > 2.5 ? 2.5 : s;
  }

  function spawnPos(from) {
    if (from === 'top') return { x: rnd() * w, y: -20 };
    if (from === 'bottom') return { x: rnd() * w, y: h + 20 };
    if (from === 'left') return { x: -20, y: rnd() * h };
    if (from === 'right') return { x: w + 20, y: rnd() * h };
    if (from === 'center') return { x: w / 2, y: h / 2 };
    var side = pick(4);
    if (side === 0) return { x: rnd() * w, y: -20 };
    if (side === 1) return { x: rnd() * w, y: h + 20 };
    if (side === 2) return { x: -20, y: rnd() * h };
    return { x: w + 20, y: rnd() * h };
  }

  function makeEntity(tindex, from) {
    if (ents.length >= MAX_LIVE) return;
    var ty = types[tindex];
    if (!ty) return;
    var live = 0;
    for (var i = 0; i < ents.length; i++) if (ents[i].ti === tindex && ents[i].alive) live++;
    if (live >= (ty.max_count || 1)) return;
    var p = spawnPos(from);
    var sp = tierSpeed(ty.speed) * ramp;
    var e = { ti: tindex, x: p.x, y: p.y, vx: 0, vy: 0, r: tierRadius(ty.size), born: t, phase: rnd() * 6.283, cx: p.x, cy: p.y, alive: true, dir: rnd() < 0.5 ? -1 : 1 };
    var mv = ty.movement;
    if (mv === 'fall') e.vy = sp || 60;
    else if (mv === 'rise') e.vy = -(sp || 60);
    else if (mv === 'patrol_x') e.vx = (sp || 50) * e.dir;
    else if (mv === 'patrol_y') e.vy = (sp || 50) * e.dir;
    else if (mv === 'zigzag') { e.vx = (sp || 60) * e.dir; e.vy = (sp || 60) * 0.5; }
    else if (mv === 'sine') e.vy = sp || 60;
    else if (mv === 'burst') { var a = rnd() * 6.283; e.vx = Math.cos(a) * (sp || 80); e.vy = Math.sin(a) * (sp || 80); }
    ents.push(e);
  }

  function moveEntity(e, dt) {
    var ty = types[e.ti];
    var mv = ty.movement;
    var sp = tierSpeed(ty.speed) * ramp * (slowT > 0 ? 0.5 : 1);
    if (mv === 'chase') { var dx = px - e.x, dy = py - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1; e.vx = dx / d * sp; e.vy = dy / d * sp; }
    else if (mv === 'flee') { var fx = e.x - px, fy = e.y - py, fd = Math.sqrt(fx * fx + fy * fy) || 1; e.vx = fx / fd * sp; e.vy = fy / fd * sp; }
    else if (mv === 'wander') { if (rnd() < 0.03) { var wa = rnd() * 6.283; e.vx = Math.cos(wa) * sp; e.vy = Math.sin(wa) * sp; } }
    else if (mv === 'orbit') { var ang = e.phase + (t - e.born) * (0.6 + sp / 200); var R = 40 + (e.r * 2); e.x = e.cx + Math.cos(ang) * R; e.y = e.cy + Math.sin(ang) * R; return; }
    else if (mv === 'sine') { e.x = e.cx + Math.sin((t - e.born) * 3 + e.phase) * 60; e.y += e.vy * dt; }
    else if (mv === 'stationary') { return; }
    e.x += e.vx * dt; e.y += e.vy * dt;
    var bm = arena.bounds;
    if (mv === 'patrol_x') { if (e.x < e.r) { e.x = e.r; e.vx = Math.abs(e.vx); } else if (e.x > w - e.r) { e.x = w - e.r; e.vx = -Math.abs(e.vx); } }
    if (mv === 'patrol_y') { if (e.y < e.r) { e.y = e.r; e.vy = Math.abs(e.vy); } else if (e.y > h - e.r) { e.y = h - e.r; e.vy = -Math.abs(e.vy); } }
    if (mv === 'zigzag') { if (e.x < e.r) { e.x = e.r; e.vx = Math.abs(e.vx); } else if (e.x > w - e.r) { e.x = w - e.r; e.vx = -Math.abs(e.vx); } }
    if (mv === 'wander') { if (e.x < e.r || e.x > w - e.r) e.vx = -e.vx; if (e.y < e.r || e.y > h - e.r) e.vy = -e.vy; e.x = clampN(e.x, e.r, w - e.r); e.y = clampN(e.y, e.r, h - e.r); }
    if (bm === 'wrap') { if (e.x < -30) e.x = w + 20; if (e.x > w + 30) e.x = -20; if (e.y < -30) e.y = h + 20; if (e.y > h + 30) e.y = -20; }
    else { if (e.x < -40 || e.x > w + 40 || e.y < -40 || e.y > h + 40) e.alive = false; }
    if (ty.lifetime_s && (t - e.born) >= ty.lifetime_s) e.alive = false;
  }

  function clampN(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // ── particles + fx ────────────────────────────────────────────────────────
  function burst(cx, cy) {
    if (!MAXP) { flash = 0.16; return; }
    for (var i = 0; i < 8; i++) { var a = i / 8 * 6.283; part[ppi] = { x: cx, y: cy, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, l: 0.45 }; ppi = (ppi + 1) % MAXP; }
    flash = 0.18; if (SHAKE) shakeAmt = SHAKE === 2 ? 0.22 : 0.12;
  }
  function stepFx(dt) {
    for (var i = 0; i < part.length; i++) { var p = part[i]; if (p && p.l > 0) { p.l -= dt; p.x += p.vx * dt; p.y += p.vy * dt; } }
    if (flash > 0) flash -= dt; if (shakeAmt > 0) shakeAmt -= dt;
    if (slowT > 0) slowT -= dt; if (hasteT > 0) hasteT -= dt; if (pHurt > 0) pHurt -= dt; if (msgT > 0) msgT -= dt;
  }
  function showMsg(text) { msg = String(text || '').slice(0, 48); msgT = 1.6; }

  // ── scoring + objective ─────────────────────────────────────────────────────
  function addScore(n) { score += n | 0; if (score < 0) score = 0; }
  function bumpCombo() { var cap = scoring.combo_cap || 8; combo = combo + 1 > cap ? cap : combo + 1; if (combo > comboBest) comboBest = combo; }
  function resetCombo() { combo = 0; }
  function loseLife(n) {
    if (pHurt > 0) return;
    plives -= (n || 1); pHurt = 0.8; resetCombo(); hitCount++;
    if (obj.type === 'avoid_hits' && hitCount > (obj.max_hits || 0)) endGame(false);
    if (plives <= 0) endGame(false);
  }
  function endGame(winFlag) { if (over) return; over = true; won = !!winFlag; showMsg(winFlag ? 'win!' : 'out'); }

  function checkObjective() {
    if (over) return;
    var ty = obj.type;
    if (ty === 'survive_timer' && t >= (obj.duration_s || 30)) endGame(true);
    else if (ty === 'avoid_hits' && t >= (obj.duration_s || 30)) endGame(true);
    else if (ty === 'collect_targets' && collected >= (obj.target_count || 1)) endGame(true);
    else if (ty === 'score_threshold' && score >= (obj.score_threshold || 1)) endGame(true);
    else if (ty === 'combo_chain' && comboBest >= (obj.combo_target || 2)) endGame(true);
    else if (ty === 'clear_waves') {
      var allDone = waves.length > 0;
      for (var i = 0; i < wstate.length; i++) if (!wstate[i].done) allDone = false;
      var liveEnemies = 0;
      for (var j = 0; j < ents.length; j++) if (ents[j].alive && types[ents[j].ti].kind === 'enemy') liveEnemies++;
      if (allDone && liveEnemies === 0) endGame(true);
    } else if (ty === 'timed_route') {
      var rz = obj.route_zone_ids || [];
      if (routeIdx >= rz.length) endGame(true);
      else if (t >= (obj.duration_s || 30)) endGame(false);
    }
  }

  // ── rules engine ─────────────────────────────────────────────────────────────
  function runAction(then) {
    var a = then.action;
    if (a === 'add_score') addScore(then.amount || 0);
    else if (a === 'sub_life') loseLife(then.amount || 1);
    else if (a === 'add_life') plives += (then.amount || 1);
    else if (a === 'spawn') { var idx = typeIndex[then.entity]; if (idx !== undefined) for (var i = 0; i < (then.count || 1); i++) makeEntity(idx, then.from || 'random'); }
    else if (a === 'despawn_kind') { for (var j = 0; j < ents.length; j++) if (ents[j].alive && types[ents[j].ti].kind === then.kind) ents[j].alive = false; }
    else if (a === 'set_player_speed') pspeedKey = then.speed || pspeedKey;
    else if (a === 'trigger_fx') { if (then.fx === 'flash') flash = 0.2; else if (then.fx === 'shake') { if (SHAKE) shakeAmt = 0.2; } else burst(px, py); }
    else if (a === 'start_wave') { for (var k = 0; k < waves.length; k++) if (waves[k].id === then.wave) { wstate[k].started = true; wstate[k].next = t; } }
    else if (a === 'end_win') endGame(true);
    else if (a === 'end_lose') endGame(false);
    else if (a === 'show_message') showMsg(then.text);
    else if (a === 'apply_modifier') { if (then.modifier === 'slow_field') slowT = 4; else if (then.modifier === 'speed_up') hasteT = 4; else ramp = ramp < 2.5 ? ramp + 0.3 : ramp; }
  }
  function fireOnce(rule) { if (fired[rule.id]) return; fired[rule.id] = true; runAction(rule.then); }
  function evalTimedAndScoreRules() {
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i], wcond = r.when;
      if (wcond.event === 'timer_elapsed' && t >= (wcond.at_s || 0)) fireOnce(r);
      else if (wcond.event === 'score_reached' && score >= (wcond.score || 0)) fireOnce(r);
      else if (wcond.event === 'combo_reached' && comboBest >= (wcond.combo || 0)) fireOnce(r);
      else if (wcond.event === 'lives_changed' && plives <= (wcond.lives || 0)) fireOnce(r);
      else if (wcond.event === 'wave_cleared') { var idx = waveIndexById(wcond.wave); if (idx >= 0 && wstate[idx].done) fireOnce(r); }
    }
  }
  function fireEventRules(eventName, ctx) {
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i], wc = r.when;
      if (wc.event !== eventName) continue;
      if (eventName === 'collision_with' && wc.entity !== ctx.entityId) continue;
      if (eventName === 'pickup_collected' && wc.entity !== undefined && wc.entity !== ctx.entityId) continue;
      if (eventName === 'player_enters_zone' && wc.zone !== ctx.zoneId) continue;
      runAction(r.then);
    }
  }
  function waveIndexById(id) { for (var i = 0; i < waves.length; i++) if (waves[i].id === id) return i; return -1; }

  // ── waves ─────────────────────────────────────────────────────────────────
  function stepWaves(dt) {
    for (var i = 0; i < waves.length; i++) {
      var wv = waves[i], st = wstate[i];
      if (st.done) continue;
      if (!st.started && t >= wv.at_s) { st.started = true; st.next = t; }
      if (!st.started) continue;
      var interval = (wv.interval_s || 1) / ramp;
      while (t >= st.next && st.spawned < wv.count) {
        var idx = typeIndex[wv.entity];
        if (idx !== undefined) makeEntity(idx, wv.from);
        st.spawned++; st.next += interval;
      }
      if (st.spawned >= wv.count) {
        if (wv.repeat) { st.spawned = 0; st.next = t + interval; }
        else { st.done = true; wavesCleared++; }
      }
    }
  }

  // ── zones ──────────────────────────────────────────────────────────────────
  var inZone = {};
  function zoneRect(z) { return { x: z.x * w, y: z.y * h, w: z.w * w, h: z.h * h }; }
  function pointInZone(zr) { return px >= zr.x && px <= zr.x + zr.w && py >= zr.y && py <= zr.y + zr.h; }
  function stepZones() {
    for (var i = 0; i < zones.length; i++) {
      var z = zones[i], inside = pointInZone(zoneRect(z));
      if (inside && !inZone[z.id]) { inZone[z.id] = true; fireEventRules('player_enters_zone', { zoneId: z.id }); enterZone(z); }
      else if (!inside) inZone[z.id] = false;
      if (inside && z.kind === 'hazard') loseLife(1);
    }
  }
  function enterZone(z) {
    if (z.kind === 'goal' && obj.type === 'reach_goal') endGame(true);
    if (obj.type === 'timed_route') { var rz = obj.route_zone_ids || []; if (rz[routeIdx] === z.id) { routeIdx++; bumpCombo(); burst(px, py); } }
  }

  // ── collisions (player vs entities) ─────────────────────────────────────────
  function stepCollisions() {
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i]; if (!e.alive) continue;
      var ty = types[e.ti];
      var dx = e.x - px, dy = e.y - py, rr = e.r + pradius;
      if (dx * dx + dy * dy > rr * rr) continue;
      var beh = ty.collision;
      if (beh === 'collect') { e.alive = false; collected++; addScore(scoring.on_pickup || ty.score_value || 0); bumpCombo(); burst(e.x, e.y); fireEventRules('pickup_collected', { entityId: ty.id }); }
      else if (beh === 'score') { e.alive = false; addScore(ty.score_value || scoring.on_pickup || 0); bumpCombo(); burst(e.x, e.y); }
      else if (beh === 'damage') { loseLife(1); fireEventRules('collision_with', { entityId: ty.id }); }
      else if (beh === 'goal') { if (obj.type === 'reach_goal') endGame(true); fireEventRules('collision_with', { entityId: ty.id }); }
      else if (beh === 'block') { var d = Math.sqrt(dx * dx + dy * dy) || 1; px -= dx / d * (rr - d); py -= dy / d * (rr - d); fireEventRules('collision_with', { entityId: ty.id }); }
      else if (beh === 'none') fireEventRules('collision_with', { entityId: ty.id });
    }
  }

  // ── player control ───────────────────────────────────────────────────────────
  function movePlayer(dt) {
    var sp = tierSpeed(pspeedKey) * (hasteT > 0 ? 1.6 : 1);
    if (pcontrol === 'follow_pointer' || pcontrol === 'free_move' || pcontrol === 'tap_move') {
      var dx = ptx - px, dy = pty - py, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) { var step = Math.min(d, sp * dt); px += dx / d * step; py += dy / d * step; }
    } else if (pcontrol === 'dodge_horizontal') {
      var ddx = ptx - px; if (Math.abs(ddx) > 1) px += (ddx > 0 ? 1 : -1) * Math.min(Math.abs(ddx), sp * dt);
    } else if (pcontrol === 'lane_switch') {
      laneCount = 3; var laneW = w / laneCount; var target = (lane + 0.5) * laneW;
      var lx = target - px; if (Math.abs(lx) > 1) px += (lx > 0 ? 1 : -1) * Math.min(Math.abs(lx), sp * 1.4 * dt);
    }
    px = clampN(px, pradius, w - pradius); py = clampN(py, pradius, h - pradius);
  }

  // ── rendering ─────────────────────────────────────────────────────────────
  function drawShape(ctx, shape, x, y, r, color) {
    ctx.fillStyle = color; ctx.strokeStyle = color;
    if (shape === 'circle') { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }
    else if (shape === 'square') ctx.fillRect(x - r, y - r, r * 2, r * 2);
    else if (shape === 'triangle') { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r); ctx.lineTo(x - r, y + r); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); }
  }
  function drawBackground(ctx) {
    ctx.fillStyle = HIGH ? '#04060a' : '#070a14'; ctx.fillRect(0, 0, w, h);
    var bg = arena.background;
    if (bg === 'grid') { ctx.strokeStyle = HIGH ? '#1a2740' : '#121a2c'; ctx.lineWidth = 1; for (var x = 0; x < w; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); } for (var y = 0; y < h; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); } }
    else if (bg === 'scanlines') { ctx.strokeStyle = HIGH ? '#11203a' : '#0d1626'; for (var sy = 0; sy < h; sy += 4) { ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke(); } }
    else if (bg === 'stars') { ctx.fillStyle = HIGH ? '#26324a' : '#1a2336'; for (var i = 0; i < 40; i++) { var sx = (i * 73 % w), syy = ((i * 131) % h); ctx.fillRect(sx, syy, 2, 2); } }
  }
  function drawZones(ctx) {
    for (var i = 0; i < zones.length; i++) {
      var z = zones[i], zr = zoneRect(z);
      var c = z.kind === 'goal' ? '#3df58b' : (z.kind === 'hazard' ? '#ff2d95' : (z.kind === 'safe' ? '#22e0ff' : '#b14aff'));
      ctx.globalAlpha = 0.18; ctx.fillStyle = c; ctx.fillRect(zr.x, zr.y, zr.w, zr.h);
      ctx.globalAlpha = 0.6; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.strokeRect(zr.x, zr.y, zr.w, zr.h);
      ctx.globalAlpha = 1;
    }
  }
  function drawHud(ctx) {
    ctx.globalAlpha = 1; ctx.fillStyle = HIGH ? '#ffffff' : accent; ctx.font = '15px monospace'; ctx.textAlign = 'left';
    ctx.fillText('score ' + score, 10, 22);
    ctx.fillText('lives ' + (plives < 0 ? 0 : plives), 10, 42);
    var label = objectiveLabel();
    ctx.textAlign = 'right'; ctx.fillText(label, w - 10, 22); ctx.textAlign = 'left';
  }
  function objectiveLabel() {
    var ty = obj.type;
    if (ty === 'survive_timer' || ty === 'avoid_hits') return 'time ' + Math.max(0, Math.ceil((obj.duration_s || 0) - t));
    if (ty === 'collect_targets') return collected + '/' + (obj.target_count || 0);
    if (ty === 'score_threshold') return score + '/' + (obj.score_threshold || 0);
    if (ty === 'combo_chain') return 'combo ' + comboBest + '/' + (obj.combo_target || 0);
    if (ty === 'clear_waves') return 'clear waves';
    if (ty === 'timed_route') return 'route ' + routeIdx + '/' + ((obj.route_zone_ids || []).length);
    if (ty === 'reach_goal') return 'reach goal';
    return '';
  }

  return {
    init: function (frame) {
      w = (frame && frame.width) || 360; h = (frame && frame.height) || 640;
      px = w / 2; py = h - pradius - 20; ptx = px; pty = py;
      seed = (G.seed | 0) || 1; t = 0; score = 0; combo = 0; comboBest = 0; hitCount = 0; collected = 0;
      wavesCleared = 0; routeIdx = 0; over = false; won = false; surviveAcc = 0; ramp = 1; slowT = 0; hasteT = 0;
      plives = typeof pcfg.lives === 'number' ? pcfg.lives : 3; pHurt = 0; flash = 0; shakeAmt = 0; msg = ''; msgT = 0;
      ents.length = 0; part.length = 0; ppi = 0; fired = {}; inZone = {};
      for (var i = 0; i < wstate.length; i++) { wstate[i].started = false; wstate[i].spawned = 0; wstate[i].next = 0; wstate[i].done = false; }
    },
    tick: function (dt) {
      if (over) { stepFx(dt); return; }
      if (typeof dt !== 'number' || dt <= 0) return;
      if (dt > 0.05) dt = 0.05;
      t += dt; ramp = rampScale();
      if (scoring.survive_per_s) { surviveAcc += scoring.survive_per_s * dt; if (surviveAcc >= 1) { var add = Math.floor(surviveAcc); score += add; surviveAcc -= add; } }
      stepWaves(dt);
      movePlayer(dt);
      for (var i = 0; i < ents.length; i++) if (ents[i].alive) moveEntity(ents[i], dt);
      stepCollisions();
      stepZones();
      // compact dead entities (bounded)
      var k = 0; for (var j = 0; j < ents.length; j++) if (ents[j].alive) ents[k++] = ents[j]; ents.length = k;
      evalTimedAndScoreRules();
      stepFx(dt);
      checkObjective();
    },
    onInput: function (ev) {
      if (!ev || over) return;
      var x = typeof ev.x === 'number' ? ev.x : w / 2;
      var y = typeof ev.y === 'number' ? ev.y : py;
      if (ev.type === 'press' || ev.type === 'move' || ev.type === 'tap') {
        ptx = clampN(x, 0, w); pty = clampN(y, 0, h);
        if (pcontrol === 'lane_switch') { laneCount = 3; lane = clampN(Math.floor(x / (w / laneCount)), 0, laneCount - 1); }
      }
    },
    render: function (ctx) {
      if (!ctx) return;
      ctx.save();
      if (shakeAmt > 0 && SHAKE) ctx.translate(Math.sin(t * 80) * shakeAmt * 10, Math.cos(t * 70) * shakeAmt * 8);
      drawBackground(ctx); drawZones(ctx);
      for (var i = 0; i < ents.length; i++) { var e = ents[i]; if (!e.alive) continue; var ty = types[e.ti]; drawShape(ctx, ty.shape, e.x, e.y, e.r, PALETTE[ty.color] || accent); }
      ctx.globalAlpha = pHurt > 0 ? 0.5 : 1; drawShape(ctx, pshape, px, py, pradius, HIGH ? '#ffffff' : accent); ctx.globalAlpha = 1;
      ctx.fillStyle = accent; for (var p = 0; p < part.length; p++) { var pt = part[p]; if (pt && pt.l > 0) { ctx.globalAlpha = Math.max(0, Math.min(1, pt.l * 2)); ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4); } }
      if (flash > 0) { ctx.globalAlpha = flash * 0.5; ctx.fillStyle = accent; ctx.fillRect(0, 0, w, h); }
      ctx.globalAlpha = 1; ctx.restore();
      drawHud(ctx);
      if (msgT > 0 && msg) { ctx.globalAlpha = Math.min(1, msgT); ctx.fillStyle = HIGH ? '#ffffff' : accent; ctx.font = '28px monospace'; ctx.textAlign = 'center'; ctx.fillText(msg, w / 2, h / 2); ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
    },
    proposeResult: function () { return { proposed_score: score, public_safe: true, won: won, lives: plives < 0 ? 0 : plives, elapsed: Math.round(t * 1000) / 1000 }; },
    status: function () { return { over: over, won: won, score: score, lives: plives < 0 ? 0 : plives, combo_best: comboBest, collected: collected, hits: hitCount, live_entities: ents.length, waves_cleared: wavesCleared, route: routeIdx, elapsed: Math.round(t * 1000) / 1000 }; },
  };
}

/**
 * PURE: the FIXED interpreter as source text — `export function createGame()` that runs the embedded
 * `GRAPH` const through createGameFromGraph (emitted verbatim via .toString(), so the package's only
 * code is this reviewed engine). Self-contained: no external identifiers survive the emission.
 */
export function freeSandboxInterpreterSource() {
  return [
    '/** Creator Freedom v1 — generated arcade_game. Local sandbox only; data-driven by the fixed interpreter.',
    ' * The creator authored DATA (the GRAPH const above); this engine is fixed/reviewed. No network, no storage,',
    ' * no eval, no assets. Result is a PROPOSAL — the host/server stays the authority. */',
    'export function createGame() {',
    '  var __impl = ' + createGameFromGraph.toString() + ';',
    '  return __impl(GRAPH);',
    '}',
  ].join('\n');
}
