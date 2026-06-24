/**
 * Neon Grid — local cabinet mini-game (Phase 1l). PRODUCTION (adapter-loaded).
 *
 * A short (~25s) pattern-path game: a path lights up on a 4x4 neon grid and the
 * player repeats it by tapping the cells in order. Patterns get a little longer
 * as the round goes on. Tracks correct steps, completed patterns, mistakes, best
 * streak, duration and a final grade.
 *
 * This is an IMPORTED game: it does NOT build its own cabinet frame. It exposes
 * `getRoot()` so the Phase 1k import runtime can mount its panel inside a frame
 * built from the (server-activated) `neon_grid` contract (the runtime owns the
 * frame + its coordinate mapping), and it mirrors the Signal Sprint / Pulse Tap
 * floor interface so the floor can wire its server-authoritative round hooks the
 * same way.
 *
 * GUARDRAILS (by design):
 *  - Local session feedback ONLY — the round result is sent to the room authority
 *    for server-side validation + ticket award; nothing else leaves.
 *  - Tickets are SERVER-authoritative: this module never finalizes a ticket award.
 *  - Arcade points only — no money, no crypto, no transferable goods.
 *
 * createNeonGridGame({ accent, onLeave, onRoundStart, onRoundSubmit })
 *   -> { getRoot, open, close, isOpen, setBalance, roundAccepted, roundRejected }
 */

import { createJuice, prefersReducedMotion } from '../../cabinet-juice.mjs';

const ROUND_MS = 25000;
const GRID_N = 4;               // 4x4 grid (16 cells)
const CELLS = GRID_N * GRID_N;
const PATTERN_START = 3;        // first path length
const PATTERN_MAX = 6;          // longest path
const SHOW_STEP_MS = 460;       // per-cell reveal cadence
const SHOW_GAP_MS = 220;        // gap between reveals

// Per-cell Simon tones — a major-pentatonic scale across the 16 cells so a path
// sounds melodic and each cell has a distinct, recognizable pitch (feel only;
// no effect on scoring or which cells are correct).
const PENTATONIC = [0, 2, 4, 7, 9];
function cellFreq(i) {
  const deg = i % PENTATONIC.length;
  const oct = Math.floor(i / PENTATONIC.length);
  return 294 * Math.pow(2, (PENTATONIC[deg] + 12 * oct) / 12);
}

let cssInjected = false;
function ensureStyles() {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  // Self-contained import: load this cabinet's stylesheet relative to the module.
  const href = new URL('./neon-grid.css', import.meta.url).href;
  if (document.querySelector(`link[data-ngg-style="1"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.nggStyle = '1';
  document.head.appendChild(link);
}

export function createNeonGridGame({ accent = '#3df58b', onLeave = () => {}, onRoundStart = () => {}, onRoundSubmit = () => {} } = {}) {
  let root = null;       // the .ngg-panel (mounted into the cabinet frame by the runtime)
  let isOpen = false;

  // Client-only feel layer (audio/haptic/motion). No economy, no scoring impact.
  const juice = createJuice();

  let phase = 'ready';   // ready | show | input | grade
  let roundStart = 0;
  let tickTimer = 0;
  let showTimers = [];

  let pattern = [];      // current path: array of cell indices
  let patternLen = PATTERN_START;
  let inputIndex = 0;    // how far through the current pattern the player is
  let correctSteps = 0, mistakes = 0, streak = 0, best = 0, completed = 0;
  let ticketBalance = 0;
  let submittedThisRound = false;
  let keyListenerBound = false; // guard so build() can't double-register onKey

  const $ = (f) => root.querySelector(`[data-f="${f}"]`);
  const screen = (name) => root.querySelector(`[data-screen="${name}"]`);

  function build() {
    ensureStyles();
    root = document.createElement('div');
    root.className = 'ngg-panel';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Neon Grid mini-game');
    root.style.setProperty('--ngg-accent', accent);
    root.innerHTML = `
        <div class="ngg-head">
          <div class="ngg-title">NEON <span>GRID</span></div>
          <button class="ngg-leave" type="button" data-act="leave">✕ Leave</button>
        </div>
        <div class="ngg-hud">
          <div class="ngg-cell"><span class="k">Time</span><span class="v" data-f="time">25</span></div>
          <div class="ngg-cell"><span class="k">Paths</span><span class="v" data-f="patterns">0</span></div>
          <div class="ngg-cell"><span class="k">Streak</span><span class="v" data-f="streak">0</span></div>
          <div class="ngg-cell"><span class="k">Miss</span><span class="v" data-f="mistakes">0</span></div>
          <div class="ngg-cell"><span class="k">Tickets</span><span class="v" data-f="bal">0</span></div>
        </div>
        <div class="ngg-stage" data-act="stage" tabindex="0" aria-label="Watch the path, then tap the cells in the same order">
          <div class="ngg-grid" data-f="grid"></div>
          <div class="ngg-prompt" data-f="prompt" aria-live="polite"></div>
          <div class="ngg-ready" data-screen="ready">
            <div class="ngg-big">READY?</div>
            <p>Watch the path light up,<br>then tap the cells in order.</p>
            <button class="ngg-btn" type="button" data-act="start">▶ Start</button>
          </div>
          <div class="ngg-grade" data-screen="grade" hidden>
            <div class="ngg-grade-letter" data-f="grade">A</div>
            <div class="ngg-grade-rows">
              <span>Paths <b data-f="gpatterns">0</b></span>
              <span>Best streak <b data-f="gstreak">0</b></span>
              <span>Mistakes <b data-f="gmistakes">0</b></span>
            </div>
            <div class="ngg-award" data-f="award" aria-live="polite">—</div>
            <div class="ngg-actions">
              <button class="ngg-btn" type="button" data-act="again">↻ Play again</button>
              <button class="ngg-btn ghost" type="button" data-act="leave">Leave cabinet</button>
            </div>
          </div>
        </div>
        <div class="ngg-feedback" data-f="fb"></div>`;

    buildGrid();

    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'leave') onLeave();
      else if (act === 'start' || act === 'again') startRound();
    });
    // Cell taps (event-delegated; the grid scales with the frame so DOM hit-testing
    // already maps screen → native coordinates correctly).
    $('grid').addEventListener('click', (e) => {
      const tile = e.target.closest('.ngg-tile');
      if (tile) onCellTap(Number(tile.dataset.i));
    });
  }

  function buildGrid() {
    const host = $('grid');
    if (!host) return;
    host.style.setProperty('--ngg-n', String(GRID_N));
    // --h: a small per-cell hue offset (deg) so each lit cell reads as distinct
    // (visual identity to match the per-cell tone). Cosmetic only.
    host.innerHTML = Array.from({ length: CELLS }, (_, i) =>
      `<button class="ngg-tile" type="button" data-i="${i}" style="--h:${Math.round((i - 7.5) / 15 * 50)}" aria-label="cell ${i + 1}"></button>`).join('');
  }

  function onKey(e) {
    if (!isOpen) return;
    if ((e.key === 'Enter' || e.key === ' ') && phase === 'ready') { e.preventDefault(); startRound(); }
  }

  function tile(i) { return root.querySelector(`.ngg-tile[data-i="${i}"]`); }

  function clearTimers() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = 0; }
    for (const t of showTimers) clearTimeout(t);
    showTimers = [];
  }

  function showScreen(s) {
    screen('ready').hidden = s !== 'ready';
    screen('grade').hidden = s !== 'grade';
  }

  function setPrompt(text) {
    const p = $('prompt');
    if (p) p.textContent = text || '';
  }

  // ---- feel / juice (presentation only; nothing here affects scoring) ----
  function yourTurnCue() {
    const p = $('prompt');
    if (p && !prefersReducedMotion()) {
      p.classList.remove('cue'); void p.offsetWidth; p.classList.add('cue');
      setTimeout(() => { if (p) p.classList.remove('cue'); }, 600);
    }
    juice.tone(523, 120, { type: 'sine', gain: 0.05 });
    juice.vibrate(10);
  }
  function pathCompleteCue() {
    const grid = root && root.querySelector('.ngg-grid');
    if (grid && !prefersReducedMotion()) {
      grid.classList.remove('complete'); void grid.offsetWidth; grid.classList.add('complete');
      setTimeout(() => { if (grid) grid.classList.remove('complete'); }, 420);
    }
    [659, 784, 988].forEach((f, i) => setTimeout(() => juice.tone(f, 130, { type: 'triangle', gain: 0.06 }), i * 70));
    juice.vibrate([8, 30, 8]);
  }
  function gridShake() {
    const stage = root && root.querySelector('.ngg-stage');
    if (!stage || prefersReducedMotion()) return;
    stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake');
    setTimeout(() => { if (stage) stage.classList.remove('shake'); }, 300);
  }
  function gradeFlourish(g) {
    const notes = g === 'S' ? [523, 659, 784, 1047]
      : g === 'A' ? [523, 659, 784]
      : g === 'B' ? [466, 587]
      : g === 'F' ? [196, 165]
      : [440, 554];
    notes.forEach((f, i) => setTimeout(() => juice.tone(f, 150, { type: 'triangle', gain: 0.06 }), i * 110));
    juice.vibrate(g === 'S' || g === 'A' ? [10, 40, 10] : 12);
  }

  function flash(kind) {
    const fb = $('fb');
    if (!fb) return;
    fb.textContent = kind === 'good' ? '✓ PATH' : 'MISS!';
    fb.className = 'ngg-feedback show ' + kind;
  }

  function setAward(kind, text) {
    const el = root && $('award');
    if (!el) return;
    el.textContent = text;
    el.className = 'ngg-award ' + kind;
  }

  function setBalanceUI(n) {
    ticketBalance = n;
    if (root) { const b = $('bal'); if (b) b.textContent = n; }
  }

  function updateHud() {
    const remain = Math.max(0, ROUND_MS - (performance.now() - roundStart));
    const t = $('time'); if (t) t.textContent = Math.ceil(remain / 1000);
    const pp = $('patterns'); if (pp) pp.textContent = completed;
    const st = $('streak'); if (st) st.textContent = streak;
    const ms = $('mistakes'); if (ms) ms.textContent = mistakes;
    if (remain <= 0 && phase !== 'grade') endRound();
  }

  function nextPattern() {
    pattern = [];
    let last = -1;
    for (let k = 0; k < patternLen; k++) {
      let c = Math.floor(Math.random() * CELLS);
      if (c === last) c = (c + 1) % CELLS; // avoid immediate repeats so the path reads clearly
      pattern.push(c);
      last = c;
    }
    inputIndex = 0;
    showPattern();
  }

  function showPattern() {
    if (phase === 'grade') return;
    phase = 'show';
    setPrompt('Watch…');
    root.querySelector('.ngg-grid')?.classList.add('locked');
    let t = 0;
    pattern.forEach((cellIndex, k) => {
      showTimers.push(setTimeout(() => {
        const el = tile(cellIndex);
        if (el) {
          el.classList.add('lit');
          juice.tone(cellFreq(cellIndex), 230, { type: 'sine', gain: 0.06 }); // per-cell Simon tone
          showTimers.push(setTimeout(() => el && el.classList.remove('lit'), SHOW_STEP_MS - 60));
        }
      }, t));
      t += SHOW_STEP_MS + SHOW_GAP_MS;
      void k;
    });
    showTimers.push(setTimeout(() => {
      if (phase === 'grade') return;
      phase = 'input';
      setPrompt('Your turn — repeat the path');
      yourTurnCue();
      root.querySelector('.ngg-grid')?.classList.remove('locked');
    }, t + 120));
  }

  function onCellTap(cellIndex) {
    if (phase !== 'input') return;
    const expected = pattern[inputIndex];
    const el = tile(cellIndex);
    if (cellIndex === expected) {
      correctSteps++;
      streak++;
      best = Math.max(best, streak);
      inputIndex++;
      if (el) {
        el.classList.add('hit');                          // colour feedback (kept under reduced-motion)
        if (!prefersReducedMotion()) el.classList.add('pop'); // scale pop is motion — JS-gated like the rest
        setTimeout(() => el && el.classList.remove('hit', 'pop'), 220);
      }
      juice.tone(cellFreq(cellIndex), 150, { type: 'triangle', gain: 0.06 }); // tap echoes the cell's tone
      juice.vibrate(7);
      if (inputIndex >= pattern.length) {
        completed++;
        flash('good');
        pathCompleteCue();
        patternLen = Math.min(PATTERN_MAX, PATTERN_START + Math.floor(completed / 2));
        updateHud();
        setTimeout(() => { if (phase === 'input' || phase === 'show') nextPattern(); }, 260);
      }
    } else {
      mistakes++;
      streak = 0;
      if (el) { el.classList.add('miss'); setTimeout(() => el && el.classList.remove('miss'), 220); }
      flash('bad');
      juice.tone(140, 200, { type: 'square', gain: 0.05, slideTo: 90 }); // distinct error tone
      juice.vibrate([6, 28, 6]);
      gridShake();
      // Re-show the same path so the player can recover (does not advance difficulty).
      inputIndex = 0;
      setTimeout(() => { if (phase === 'input') showPattern(); }, 320);
    }
    updateHud();
  }

  function gradeFor() {
    const totalTaps = correctSteps + mistakes;
    const acc = totalTaps ? correctSteps / totalTaps : 0;
    if (completed === 0) return 'F';
    if (acc >= 0.95 && completed >= 6 && best >= 16) return 'S';
    if (acc >= 0.85 && completed >= 4) return 'A';
    if (acc >= 0.70 && completed >= 2) return 'B';
    if (acc >= 0.50) return 'C';
    return 'D';
  }

  function startRound() {
    juice.resume(); // unlock audio from the Start gesture (click/Enter/Space)
    correctSteps = mistakes = streak = best = completed = 0;
    patternLen = PATTERN_START;
    submittedThisRound = false;
    phase = 'show';
    roundStart = performance.now();
    clearTimers();
    showScreen('play');
    setPrompt('Watch the path…');
    updateHud();
    root.querySelector('.ngg-stage')?.focus?.();
    // Ask the server to register this round (issues the authoritative round id).
    onRoundStart();
    tickTimer = setInterval(updateHud, 120);
    nextPattern();
  }

  function endRound() {
    if (phase === 'grade') return;
    phase = 'grade';
    clearTimers();
    const g = gradeFor();
    if (root) {
      const gl = $('grade');
      gl.textContent = g;
      gl.className = 'ngg-grade-letter g-' + g; // per-grade glow + reveal animation
      void gl.offsetWidth;                      // restart the reveal each round
      gl.classList.add('reveal');
      $('gpatterns').textContent = completed;
      $('gstreak').textContent = best;
      $('gmistakes').textContent = mistakes;
      showScreen('grade');
      gradeFlourish(g);
    }
    // Tickets are SERVER-authoritative. Submit the result and wait for the award.
    const result = {
      grade: g,
      score: completed * 400 + correctSteps * 50 + best * 30,
      correctSteps,
      completedPatterns: completed,
      mistakes,
      bestStreak: best,
      durationMs: Math.round(performance.now() - roundStart),
    };
    if (!submittedThisRound) {
      submittedThisRound = true;
      setAward('submitting', 'submitting…');
      onRoundSubmit(result);
    }
  }

  return {
    // ── imported-game interface (the runtime mounts getRoot() into a frame) ──
    getRoot() { if (!root) build(); return root; },
    open() {
      if (!root) build();
      if (isOpen) return;
      isOpen = true;
      // Bind the window keydown listener for this open session. onKey is a stable
      // reference (named fn in this closure), so the matching remove in close()
      // detaches the same handler. The guard prevents double-registration.
      if (!keyListenerBound) { addEventListener('keydown', onKey); keyListenerBound = true; }
      phase = 'ready';
      showScreen('ready');
      setPrompt('');
      $('fb').className = 'ngg-feedback';
      setBalanceUI(ticketBalance);
      setAward('', '—');
    },
    close() {
      if (!root || !isOpen) return;
      isOpen = false;
      phase = 'ready';
      clearTimers();
      if (keyListenerBound) { removeEventListener('keydown', onKey); keyListenerBound = false; }
    },
    isOpen() { return isOpen; },
    // ── server-authoritative ticket hooks (called by the floor) ──
    setBalance(n) { setBalanceUI(n); },
    roundAccepted({ awarded = 0, balance = ticketBalance } = {}) {
      setBalanceUI(balance);
      setAward('accepted', `+${awarded} tickets · balance ${balance}`);
    },
    roundRejected({ reason = 'rejected' } = {}) {
      submittedThisRound = false; // allow a retry via Play again
      setAward('rejected', `not counted: ${reason}`);
    },
  };
}
