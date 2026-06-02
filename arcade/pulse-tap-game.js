/**
 * Pulse Tap — local cabinet mini-game (Phase 1d).
 *
 * A 30s neon rhythm/reflex round: tap (click / Space / E) the instant the
 * shrinking pulse ring aligns with the target ring. Tracks hits, misses,
 * streak, accuracy and a final grade.
 *
 * GUARDRAILS (by design):
 *  - Local session feedback ONLY — nothing leaves the browser: no network,
 *    no persistence, and no in-game economy of any kind.
 *  - Occupancy stays the only server-authoritative fact. This module sends NO
 *    messages anywhere; leaving the cabinet routes through the floor's existing path.
 *
 * createPulseTapGame({ accent, onLeave }) -> { open, close, isOpen }
 *
 * Phase 1i: the panel is mounted inside a Cabinet Frame that preserves the
 * game's native logical size (360x640) and uniformly scales it to fit.
 */
import { createCabinetFrame } from './cabinet-frame.js';

const ROUND_MS = 30000;
const BEAT_MS_START = 850;
const BEAT_MS_MIN = 560;
const HIT_PROGRESS = 0.74; // where the pulse meets the target
const HIT_WINDOW = 0.11; // tolerance around HIT_PROGRESS
const MAX_SCALE = 1.0; // pulse start size (× base ring)
const END_SCALE = 0.18; // pulse end size
const TARGET_SCALE = 0.4; // fixed target ring

export function createPulseTapGame({ accent = '#ff2d95', onLeave = () => {}, onRoundStart = () => {}, onRoundSubmit = () => {} } = {}) {
  let root = null;   // the .ptg-panel, mounted inside the cabinet frame
  let frame = null;  // cabinet frame runtime (owns the modal overlay + scaling)
  let raf = 0;
  let isOpen = false;
  let lastHud = 0;

  let phase = 'ready'; // ready | playing | grade
  let roundStart = 0;
  let beatStart = 0;
  let beatMs = BEAT_MS_START;
  let beatHandled = false;
  let hits = 0, misses = 0, streak = 0, best = 0;
  let ticketBalance = 0;          // server-authoritative; shown for display only
  let submittedThisRound = false; // double-submit guard (server also rejects dups)

  const $ = (f) => root.querySelector(`[data-f="${f}"]`);
  const screen = (name) => root.querySelector(`[data-screen="${name}"]`);

  function build() {
    // The panel IS the root now; the cabinet frame owns the modal overlay and
    // scales this panel uniformly within the declared native box (360x640).
    root = document.createElement('div');
    root.className = 'ptg-panel';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Pulse Tap mini-game');
    root.style.setProperty('--ptg-accent', accent);
    root.innerHTML = `
        <div class="ptg-head">
          <div class="ptg-title">PULSE <span>TAP</span></div>
          <button class="ptg-leave" type="button" data-act="leave">✕ Leave</button>
        </div>
        <div class="ptg-hud">
          <div class="ptg-cell"><span class="k">Time</span><span class="v" data-f="time">30</span></div>
          <div class="ptg-cell"><span class="k">Hits</span><span class="v" data-f="hits">0</span></div>
          <div class="ptg-cell"><span class="k">Streak</span><span class="v" data-f="streak">0</span></div>
          <div class="ptg-cell"><span class="k">Accuracy</span><span class="v" data-f="acc">—</span></div>
          <div class="ptg-cell"><span class="k">Tickets</span><span class="v" data-f="bal">0</span></div>
        </div>
        <div class="ptg-stage" data-act="tap" tabindex="0" aria-label="Tap when the ring meets the target">
          <div class="ptg-target"></div>
          <div class="ptg-pulse"></div>
          <div class="ptg-center"></div>
          <div class="ptg-ready" data-screen="ready">
            <div class="ptg-big">READY?</div>
            <p>Tap when the ring meets the target.<br>Chain hits to build your streak.</p>
            <button class="ptg-btn" type="button" data-act="start">▶ Start</button>
          </div>
          <div class="ptg-grade" data-screen="grade" hidden>
            <div class="ptg-grade-letter" data-f="grade">A</div>
            <div class="ptg-grade-rows">
              <span>Accuracy <b data-f="gacc">0%</b></span>
              <span>Best streak <b data-f="gstreak">0</b></span>
              <span>Hits <b data-f="ghits">0</b></span>
            </div>
            <div class="ptg-award" data-f="award" aria-live="polite">—</div>
            <div class="ptg-actions">
              <button class="ptg-btn" type="button" data-act="again">↻ Play again</button>
              <button class="ptg-btn ghost" type="button" data-act="leave">Leave cabinet</button>
            </div>
          </div>
        </div>
        <div class="ptg-feedback" data-f="fb"></div>`;

    // Mount the panel inside the cabinet frame (preserves native size + aspect).
    frame = createCabinetFrame('pulse_tap', { onLeave });
    frame.mount(root);

    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'leave') onLeave();
      else if (act === 'start' || act === 'again') startRound();
      else if (act === 'tap') tap();
    });
    addEventListener('keydown', (e) => {
      if (isOpen && phase === 'playing' && (e.key === ' ' || e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        tap();
      }
    });
  }

  function showScreen(s) {
    screen('ready').hidden = s !== 'ready';
    screen('grade').hidden = s !== 'grade';
  }

  function accuracy() {
    const total = hits + misses;
    return total ? Math.round((hits / total) * 100) : 0;
  }
  function grade(acc, bestStreak) {
    if (acc >= 92 && bestStreak >= 12) return 'S';
    if (acc >= 80) return 'A';
    if (acc >= 65) return 'B';
    if (acc >= 45) return 'C';
    return 'D';
  }

  function updateHud() {
    const remain = Math.max(0, ROUND_MS - (performance.now() - roundStart));
    $('time').textContent = Math.ceil(remain / 1000);
    $('hits').textContent = hits;
    $('streak').textContent = streak;
    $('acc').textContent = hits + misses ? accuracy() + '%' : '—';
  }

  function flash(kind) {
    const fb = $('fb');
    fb.textContent = kind === 'hit' ? 'PERFECT' : kind === 'good' ? 'NICE' : 'MISS';
    fb.className = 'ptg-feedback show ' + kind;
  }

  function setAward(kind, text) {
    if (!root) return; // game overlay not built (e.g. a non-occupant got a reject)
    const el = $('award');
    if (!el) return;
    el.textContent = text;
    el.className = 'ptg-award ' + kind;
  }

  function setBalanceUI(n) {
    ticketBalance = n;
    if (root) {
      const b = $('bal');
      if (b) b.textContent = n;
    }
  }

  function tap() {
    if (phase !== 'playing' || beatHandled) return;
    beatHandled = true;
    const progress = (performance.now() - beatStart) / beatMs;
    const d = Math.abs(progress - HIT_PROGRESS);
    if (d <= HIT_WINDOW) {
      hits++;
      streak++;
      best = Math.max(best, streak);
      beatMs = Math.max(BEAT_MS_MIN, BEAT_MS_START - streak * 12);
      flash(d <= HIT_WINDOW * 0.5 ? 'hit' : 'good');
    } else {
      misses++;
      streak = 0;
      flash('miss');
    }
    updateHud();
  }

  function loop() {
    const now = performance.now();
    if (now - roundStart >= ROUND_MS) {
      endRound();
      return;
    }
    let progress = (now - beatStart) / beatMs;
    if (progress >= 1) {
      if (!beatHandled) {
        misses++;
        streak = 0;
      }
      beatStart = now;
      beatHandled = false;
      progress = 0;
    }
    const scale = MAX_SCALE + (END_SCALE - MAX_SCALE) * progress;
    const pulse = root.querySelector('.ptg-pulse');
    pulse.style.transform = `translate(-50%,-50%) scale(${scale})`;
    pulse.classList.toggle('armed', Math.abs(progress - HIT_PROGRESS) <= HIT_WINDOW);
    if (now - lastHud > 120) {
      updateHud();
      lastHud = now;
    }
    raf = requestAnimationFrame(loop);
  }

  function startRound() {
    hits = misses = streak = best = 0;
    beatMs = BEAT_MS_START;
    phase = 'playing';
    roundStart = beatStart = performance.now();
    beatHandled = false;
    lastHud = 0;
    submittedThisRound = false;
    showScreen('play');
    updateHud();
    root.querySelector('.ptg-stage').focus();
    // Ask the server to register this round (issues the authoritative round id).
    onRoundStart();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function endRound() {
    phase = 'grade';
    cancelAnimationFrame(raf);
    const acc = accuracy();
    const g = grade(acc, best);
    $('grade').textContent = g;
    $('gacc').textContent = acc + '%';
    $('gstreak').textContent = best;
    $('ghits').textContent = hits;
    showScreen('grade');

    // Tickets are SERVER-authoritative. Submit the result and wait for the
    // server's award; the client never finalizes tickets on its own.
    const result = {
      grade: g,
      accuracy: acc,
      hits,
      bestStreak: best,
      score: hits * 100 + best * 25,
      durationMs: Math.round(performance.now() - roundStart),
    };
    if (!submittedThisRound) {
      submittedThisRound = true;
      setAward('submitting', 'submitting…');
      onRoundSubmit(result);
    }
  }

  return {
    open() {
      if (!root) build();
      if (isOpen) return;
      isOpen = true;
      phase = 'ready';
      showScreen('ready');
      root.querySelector('.ptg-target').style.transform = `translate(-50%,-50%) scale(${TARGET_SCALE})`;
      root.querySelector('.ptg-pulse').style.transform = `translate(-50%,-50%) scale(${MAX_SCALE})`;
      $('fb').className = 'ptg-feedback';
      setBalanceUI(ticketBalance);
      setAward('', '—');
      frame.open(); // the cabinet frame shows the modal + applies native-size scaling
    },
    close() {
      if (!root || !isOpen) return;
      isOpen = false;
      phase = 'ready';
      cancelAnimationFrame(raf);
      frame.close();
    },
    isOpen() {
      return isOpen;
    },
    getFrame() {
      return frame; // the cabinet frame runtime (Phase 1i); null until first open()
    },
    // ---- server-authoritative ticket hooks (called by the floor) ----
    setBalance(n) {
      setBalanceUI(n);
    },
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
