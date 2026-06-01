/**
 * Signal Sprint — local cabinet mini-game (Phase 1g).
 *
 * A ~25s lane-runner: ride the signal lane and steer (← →, A/D, on-screen pads,
 * or tap the left/right half of the stage on mobile) to COLLECT pulses while
 * dodging the static/noise. Tracks pulses, noise hits, streak, distance and a
 * final grade.
 *
 * GUARDRAILS (by design):
 *  - Local session feedback ONLY — the round result is sent to the room
 *    authority for server-side validation + ticket award; nothing else leaves.
 *  - Tickets are SERVER-authoritative: this module never finalizes a ticket award.
 *  - Arcade points only — no money, no crypto, no transferable goods.
 *
 * createSignalSprintGame({ accent, onLeave, onRoundStart, onRoundSubmit })
 *   -> { open, close, isOpen, setBalance, roundAccepted, roundRejected }
 *
 * Mirrors the createPulseTapGame() floor interface so the floor wires both
 * cabinets the same way.
 *
 * Phase 1i: the panel is mounted inside a Cabinet Frame that preserves the
 * game's native logical size (360x640) and uniformly scales it to fit.
 */
import { createCabinetFrame } from './cabinet-frame.js';

const ROUND_MS = 25000;
const LANES = 3;
const SPAWN_MS_START = 620;
const SPAWN_MS_MIN = 360;
const SCROLL_PX_START = 230;   // lane px / second
const SCROLL_PX_MAX = 430;
const HIT_BAND = 7;            // ± % of stage height where the rider collects

export function createSignalSprintGame({ accent = '#19e3ff', onLeave = () => {}, onRoundStart = () => {}, onRoundSubmit = () => {}, onResize = null } = {}) {
  let root = null;   // the .ssg-panel, mounted inside the cabinet frame
  let frame = null;  // cabinet frame runtime (owns the modal overlay + scaling)
  let raf = 0;
  let isOpen = false;

  let phase = 'ready'; // ready | playing | grade
  let roundStart = 0;
  let lastFrame = 0;
  let lastSpawn = 0;
  let spawnMs = SPAWN_MS_START;
  let scrollPx = SCROLL_PX_START;
  let lane = 1;                 // 0..LANES-1, rider starts centre
  let entities = [];           // { id, lane, pos(0..100), type:'pulse'|'noise', done }
  let nextId = 1;
  let pulses = 0, noise = 0, streak = 0, best = 0, distance = 0;
  let ticketBalance = 0;        // server-authoritative; display only
  let submittedThisRound = false;

  const $ = (f) => root.querySelector(`[data-f="${f}"]`);
  const screen = (name) => root.querySelector(`[data-screen="${name}"]`);

  function build() {
    // The panel IS the root now; the cabinet frame owns the modal overlay and
    // scales this panel uniformly within the declared native box (360x640).
    root = document.createElement('div');
    root.className = 'ssg-panel';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Signal Sprint mini-game');
    root.style.setProperty('--ssg-accent', accent);
    root.innerHTML = `
        <div class="ssg-head">
          <div class="ssg-title">SIGNAL <span>SPRINT</span></div>
          <button class="ssg-leave" type="button" data-act="leave">✕ Leave</button>
        </div>
        <div class="ssg-hud">
          <div class="ssg-cell"><span class="k">Time</span><span class="v" data-f="time">25</span></div>
          <div class="ssg-cell"><span class="k">Pulses</span><span class="v" data-f="pulses">0</span></div>
          <div class="ssg-cell"><span class="k">Streak</span><span class="v" data-f="streak">0</span></div>
          <div class="ssg-cell"><span class="k">Noise</span><span class="v" data-f="noise">0</span></div>
          <div class="ssg-cell"><span class="k">Tickets</span><span class="v" data-f="bal">0</span></div>
        </div>
        <div class="ssg-stage" data-act="stage" tabindex="0" aria-label="Steer left or right to collect pulses and dodge static">
          <div class="ssg-lanes" data-f="lanes" aria-hidden="true"></div>
          <div class="ssg-band" aria-hidden="true"></div>
          <div class="ssg-rider" data-f="rider" aria-hidden="true"></div>
          <div class="ssg-ready" data-screen="ready">
            <div class="ssg-big">READY?</div>
            <p>Steer with ← → (or A / D).<br>Catch the pulses, dodge the static.</p>
            <button class="ssg-btn" type="button" data-act="start">▶ Start</button>
          </div>
          <div class="ssg-grade" data-screen="grade" hidden>
            <div class="ssg-grade-letter" data-f="grade">A</div>
            <div class="ssg-grade-rows">
              <span>Pulses <b data-f="gpulses">0</b></span>
              <span>Best streak <b data-f="gstreak">0</b></span>
              <span>Noise hits <b data-f="gnoise">0</b></span>
            </div>
            <div class="ssg-award" data-f="award" aria-live="polite">—</div>
            <div class="ssg-actions">
              <button class="ssg-btn" type="button" data-act="again">↻ Play again</button>
              <button class="ssg-btn ghost" type="button" data-act="leave">Leave cabinet</button>
            </div>
          </div>
        </div>
        <div class="ssg-pads" aria-hidden="false">
          <button class="ssg-pad" type="button" data-act="left" aria-label="Steer left">◀</button>
          <button class="ssg-pad" type="button" data-act="right" aria-label="Steer right">▶</button>
        </div>
        <div class="ssg-feedback" data-f="fb"></div>`;

    // Mount the panel inside the cabinet frame (preserves native size + aspect).
    frame = createCabinetFrame('signal_sprint', { onLeave, onResize });
    frame.mount(root);

    buildLaneGuides();

    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'leave') onLeave();
      else if (act === 'start' || act === 'again') startRound();
      else if (act === 'left') steer(-1);
      else if (act === 'right') steer(1);
    });
    // Tap the left/right half of the stage (mobile-friendly steering).
    const stage = root.querySelector('.ssg-stage');
    stage.addEventListener('pointerdown', (e) => {
      if (phase !== 'playing') return;
      if (e.target.closest('[data-act]')) return; // buttons handle themselves
      const rect = stage.getBoundingClientRect();
      steer(e.clientX - rect.left < rect.width / 2 ? -1 : 1);
    });
    addEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (!isOpen || phase !== 'playing') return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); steer(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); steer(1); }
  }

  function buildLaneGuides() {
    const host = $('lanes');
    if (!host) return;
    host.innerHTML = Array.from({ length: LANES }, (_, i) =>
      `<span class="ssg-lane" style="left:${((i + 0.5) / LANES) * 100}%"></span>`).join('');
  }

  function laneX(l) {
    return ((l + 0.5) / LANES) * 100;
  }

  function steer(dir) {
    if (phase !== 'playing') return;
    lane = Math.max(0, Math.min(LANES - 1, lane + dir));
    positionRider();
  }

  function positionRider() {
    const rider = root.querySelector('.ssg-rider');
    if (rider) rider.style.left = laneX(lane) + '%';
  }

  function showScreen(s) {
    screen('ready').hidden = s !== 'ready';
    screen('grade').hidden = s !== 'grade';
  }

  function grade() {
    const seen = pulses + noise;
    const ratio = seen ? pulses / seen : 0;
    if (pulses === 0) return 'F';
    if (ratio >= 0.92 && best >= 20) return 'S';
    if (ratio >= 0.80) return 'A';
    if (ratio >= 0.62) return 'B';
    if (ratio >= 0.42) return 'C';
    return 'D';
  }

  function updateHud() {
    const remain = Math.max(0, ROUND_MS - (performance.now() - roundStart));
    $('time').textContent = Math.ceil(remain / 1000);
    $('pulses').textContent = pulses;
    $('streak').textContent = streak;
    $('noise').textContent = noise;
  }

  function flash(kind) {
    const fb = $('fb');
    if (!fb) return;
    fb.textContent = kind === 'pulse' ? '+ SIGNAL' : 'STATIC!';
    fb.className = 'ssg-feedback show ' + kind;
  }

  function setAward(kind, text) {
    if (!root) return;
    const el = $('award');
    if (!el) return;
    el.textContent = text;
    el.className = 'ssg-award ' + kind;
  }

  function setBalanceUI(n) {
    ticketBalance = n;
    if (root) {
      const b = $('bal');
      if (b) b.textContent = n;
    }
  }

  function spawn() {
    const l = Math.floor(Math.random() * LANES);
    const type = Math.random() < 0.66 ? 'pulse' : 'noise';
    const node = document.createElement('div');
    node.className = 'ssg-ent ' + type;
    node.style.left = laneX(l) + '%';
    node.style.top = '-6%';
    root.querySelector('.ssg-stage').appendChild(node);
    entities.push({ id: nextId++, lane: l, pos: -6, type, done: false, node });
  }

  function clearEntities() {
    for (const e of entities) e.node?.remove();
    entities = [];
  }

  function loop() {
    const now = performance.now();
    const dt = Math.min(50, now - lastFrame) / 1000; // clamp big gaps
    lastFrame = now;

    if (now - roundStart >= ROUND_MS) {
      endRound();
      return;
    }

    // difficulty ramps a little over the round
    const t = (now - roundStart) / ROUND_MS;
    scrollPx = SCROLL_PX_START + (SCROLL_PX_MAX - SCROLL_PX_START) * t;
    spawnMs = SPAWN_MS_START + (SPAWN_MS_MIN - SPAWN_MS_START) * t;
    distance += Math.round(scrollPx * dt);

    if (now - lastSpawn > spawnMs) {
      lastSpawn = now;
      spawn();
    }

    const dPos = (scrollPx * dt) / 4; // stage is ~ this tall in % terms
    for (const e of entities) {
      if (e.done) continue;
      e.pos += dPos;
      if (e.node) e.node.style.top = e.pos + '%';
      // collection band near the rider (bottom of stage)
      if (e.pos >= (100 - HIT_BAND) && e.pos <= 100 && e.lane === lane) {
        e.done = true;
        if (e.node) e.node.classList.add('caught');
        if (e.type === 'pulse') {
          pulses++; streak++; best = Math.max(best, streak); flash('pulse');
        } else {
          noise++; streak = 0; flash('noise');
        }
        updateHud();
      } else if (e.pos > 108) {
        e.done = true;
      }
    }
    // sweep finished nodes occasionally
    if (entities.length > 40) {
      for (const e of entities) if (e.done) e.node?.remove();
      entities = entities.filter((e) => !e.done);
    }

    raf = requestAnimationFrame(loop);
  }

  function startRound() {
    pulses = noise = streak = best = distance = 0;
    lane = 1;
    spawnMs = SPAWN_MS_START;
    scrollPx = SCROLL_PX_START;
    clearEntities();
    phase = 'playing';
    roundStart = lastFrame = lastSpawn = performance.now();
    submittedThisRound = false;
    showScreen('play');
    positionRider();
    updateHud();
    root.querySelector('.ssg-stage').focus();
    // Ask the server to register this round (issues the authoritative round id).
    onRoundStart();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function endRound() {
    phase = 'grade';
    cancelAnimationFrame(raf);
    clearEntities();
    const g = grade();
    $('grade').textContent = g;
    $('gpulses').textContent = pulses;
    $('gstreak').textContent = best;
    $('gnoise').textContent = noise;
    showScreen('grade');

    // Tickets are SERVER-authoritative. Submit the result and wait for the award.
    const result = {
      grade: g,
      score: pulses * 120 + best * 20 + Math.floor(distance / 10),
      distance,
      pulsesCollected: pulses,
      noiseHits: noise,
      maxStreak: best,
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
      positionRider();
      $('fb').className = 'ssg-feedback';
      setBalanceUI(ticketBalance);
      setAward('', '—');
      frame.open(); // the cabinet frame shows the modal + applies native-size scaling
    },
    close() {
      if (!root || !isOpen) return;
      isOpen = false;
      phase = 'ready';
      cancelAnimationFrame(raf);
      clearEntities();
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
