/**
 * Creator Foundation — CABINET TEMPLATES + STARTER LIBRARY (pure + cross-env).
 *
 * The generation CORE of the local Arcade Builder, extracted DOM-free so node tests can prove
 * every starter through the real importer gate. Three layers, all CLOSED:
 *
 *   1. parameter TOKENS  — accent/speed/difficulty/motion/juice/input-mode: the only values that ever
 *      reach generated source, each from a frozen table (no free text, no arbitrary JS).
 *   2. VARIANTS          — 14 tiny original procedural games, all the same SDK contract:
 *      host-mounted frame, closed input grammar (tap always works), hot-window scoring, proposal results.
 *   3. STARTERS          — 16 named, tuned, fully-described example cabinets (the starter
 *      library): variant + tokens + display metadata (pitch, 3-second rule, round target,
 *      mobile + reduced-motion notes). Metadata is static closed copy — screened by the
 *      same FORBIDDEN_TERMS_RE the importer applies to names and source.
 *
 * NOTHING here executes: this module only assembles strings and objects; the builder page
 * downloads them and the arcade-sandbox (closed-CSP iframe) is the only place creator code
 * runs. Every generated package still passes through importArcadePackage regardless.
 * No prizes, no tickets, no economy hooks — the server's award path is untouched.
 */
import { SIZE_BUDGET_MIN_BYTES, SCHEMA_VERSION, PACKAGE_KIND } from '../schemas/arcade-game-package-schema.mjs';

// ── closed parameter tables (the ONLY values that reach generated source) ─────
export const ACCENTS = Object.freeze({
  cyan: '#22e0ff', magenta: '#ff2d95', violet: '#b14aff', green: '#3df58b', amber: '#ff9e3f',
});
export const SPEEDS = Object.freeze({ slow: '1.2', medium: '2', fast: '3.2' });
/** Hot-window scale: how forgiving the timing window is. Bigger = easier. */
export const DIFFICULTY = Object.freeze({ chill: '1.5', standard: '1', sharp: '0.65' });
/** Motion amplitude scale: how far things travel/swell. Smaller = calmer screens. */
export const MOTION = Object.freeze({ calm: '0.7', standard: '1', vivid: '1.3' });
/**
 * JUICE — closed visual-feel level. off = essentials only; standard = hit flash +
 * burst + score pulse; vivid = bigger pool + bounded shake. Generated cabinets
 * CLAMP to off when prefers-reduced-motion is active (checked once at init; shake
 * never fires then). Levels resolve to FIXED pool sizes — never arbitrary counts.
 */
export const JUICE = Object.freeze({ off: '0', standard: '1', vivid: '2' });
const JUICE_POOL = Object.freeze({ off: '0', standard: '24', vivid: '48' });

/**
 * INPUT MODES — the closed verb grammar. Every mode ALSO accepts a plain 'tap' as a
 * degenerate press+release (keyboard Space and the sandbox harness both produce it),
 * so every generated cabinet stays drivable by touch, mouse, AND keyboard.
 */
export const INPUT_MODES = Object.freeze(['tap_window', 'hold_band', 'release_timing', 'swipe_lane', 'drag_track']);
/** 3-second instruction per mode — static closed copy (screened by tests). */
export const INPUT_MODE_COPY = Object.freeze({
  tap_window:     'Tap at the right moment.',
  hold_band:      'Hold while the moment is right.',
  release_timing: 'Hold, then let go at the right moment.',
  swipe_lane:     'Swipe across while the moment is right.',
  drag_track:     'Keep your pointer moving with it.',
});

export const VARIANTS = Object.freeze([
  'pulse-ring', 'drift-band', 'tri-light', 'orbit-catch', 'tide-gate',
  'split-pulse', 'rail-runner', 'echo-grid',
  'phase-lock', 'heat-sync', 'light-bloom', 'signal-climb', 'crosswalk-pulse', 'memory-echo',
]);

export const DEFAULT_FRAME = 'cabinet-360x640';

// ── generated sources (no template literals in OUTPUT — the importer scans them) ──
// Shared contract verbatim: init/tick/scene/onInput/proposeResult via the generated head/tail; zero capabilities.
const BODIES = Object.freeze({
  'pulse-ring': [
    '    hot() { return Math.abs(Math.sin(t * SPEED)) > 1 - 0.15 * WIN; },',
    '    scene(ctx) {',
    '      const w = this.w || 360, h = this.h || 640;',
    '      const r = 30 + 18 * MOT * Math.abs(Math.sin(t * SPEED));',
    '      ctx.clearRect(0, 0, w, h);',
    '      ctx.strokeStyle = ACCENT; ctx.lineWidth = 3;',
    '      ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.stroke();',
    '    },',
  ],
  'drift-band': [
    '    hot() { const x = (Math.sin(t * SPEED) + 1) / 2; return Math.abs(x - 0.5) < 0.1 * WIN; },',
    '    scene(ctx) {',
    '      const w = this.w || 360, h = this.h || 640;',
    '      ctx.clearRect(0, 0, w, h);',
    '      ctx.fillStyle = ACCENT; ctx.globalAlpha = 0.18;',
    '      ctx.fillRect(w * (0.5 - 0.1 * WIN), 0, w * 0.2 * WIN, h);',
    '      ctx.globalAlpha = 1;',
    '      const x = w * ((Math.sin(t * SPEED) * MOT * 0.9 + 1) / 2);',
    '      ctx.beginPath(); ctx.arc(x, h / 2, 14, 0, Math.PI * 2); ctx.fillStyle = ACCENT; ctx.fill();',
    '    },',
  ],
  'tri-light': [
    '    lit() { return Math.floor(t * SPEED) % 3; },',
    '    hot() { return this.lit() === 1; },',
    '    scene(ctx) {',
    '      const w = this.w || 360, h = this.h || 640;',
    '      ctx.clearRect(0, 0, w, h);',
    '      for (let i = 0; i < 3; i++) {',
    '        ctx.beginPath(); ctx.arc(w * (0.25 + i * 0.25), h / 2, 22, 0, Math.PI * 2);',
    '        ctx.strokeStyle = ACCENT; ctx.lineWidth = 3;',
    '        if (i === this.lit()) { ctx.fillStyle = ACCENT; ctx.fill(); } else { ctx.stroke(); }',
    '      }',
    '    },',
  ],
  'orbit-catch': [
    '    angle() { return (t * SPEED) % (Math.PI * 2); },',
    '    hot() { const a = this.angle(); return a > 4.75 - 0.35 * WIN && a < 4.75 + 0.35 * WIN; },',
    '    scene(ctx) {',
    '      const w = this.w || 360, h = this.h || 640;',
    '      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.3 * MOT;',
    '      ctx.clearRect(0, 0, w, h);',
    '      ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;',
    '      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();',
    '      ctx.globalAlpha = 0.2;',
    '      ctx.beginPath(); ctx.arc(cx, cy, R, 4.75 - 0.35 * WIN, 4.75 + 0.35 * WIN); ctx.lineWidth = 10; ctx.stroke();',
    '      ctx.globalAlpha = 1; ctx.lineWidth = 2;',
    '      const a = this.angle();',
    '      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 10, 0, Math.PI * 2);',
    '      ctx.fillStyle = ACCENT; ctx.fill();',
    '    },',
  ],
  'tide-gate': [
    '    level() { return (Math.sin(t * SPEED) + 1) / 2; },',
    '    hot() { return Math.abs(this.level() - 0.535) < 0.085 * WIN; },',
    '    scene(ctx) {',
    '      const w = this.w || 360, h = this.h || 640;',
    '      ctx.clearRect(0, 0, w, h);',
    '      ctx.fillStyle = ACCENT; ctx.globalAlpha = 0.16;',
    '      ctx.fillRect(0, h * (0.465 - 0.085 * WIN), w, h * 0.17 * WIN);',
    '      ctx.globalAlpha = 0.65;',
    '      const y = h * (1 - this.level());',
    '      ctx.fillRect(0, y, w, h - y);',
    '      ctx.globalAlpha = 1;',
    '      ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;',
    '      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();',
    '    },',
  ],
  'split-pulse': [
    '    phase() { return Math.sin(t * SPEED); },',
    '    hot() { return Math.abs(this.phase()) < 0.18 * WIN; },',
    '    scene(ctx) {',
    '      const w = this.w || 360, h = this.h || 640;',
    '      ctx.clearRect(0, 0, w, h);',
    '      ctx.strokeStyle = ACCENT; ctx.lineWidth = 3;',
    '      const p = this.phase();',
    '      const rA = 26 + 16 * MOT * Math.max(0, p);',
    '      const rB = 26 + 16 * MOT * Math.max(0, -p);',
    '      ctx.beginPath(); ctx.arc(w * 0.33, h / 2, rA, 0, Math.PI * 2); ctx.stroke();',
    '      ctx.beginPath(); ctx.arc(w * 0.67, h / 2, rB, 0, Math.PI * 2); ctx.stroke();',
    '      if (this.hot()) {',
    '        ctx.globalAlpha = 0.3; ctx.fillStyle = ACCENT;',
    '        ctx.fillRect(w * 0.45, h / 2 - 2, w * 0.1, 4);',
    '        ctx.globalAlpha = 1;',
    '      }',
    '    },',
  ],
  'rail-runner': [
    '    pos() { const x = (t * SPEED * 0.25) % 2; return x < 1 ? x : 2 - x; },',
    '    hot() { return Math.abs(this.pos() - 0.5) < 0.08 * WIN; },',
    '    scene(ctx) {',
    '      const w = this.w || 360, h = this.h || 640;',
    '      ctx.clearRect(0, 0, w, h);',
    '      ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;',
    '      ctx.beginPath(); ctx.moveTo(w * 0.1, h / 2); ctx.lineTo(w * 0.9, h / 2); ctx.stroke();',
    '      ctx.globalAlpha = 0.2; ctx.fillStyle = ACCENT;',
    '      ctx.fillRect(w * (0.5 - 0.08 * WIN) * 0.8 + w * 0.1, h / 2 - 12, w * 0.8 * 0.16 * WIN, 24);',
    '      ctx.globalAlpha = 1;',
    '      const x = w * (0.1 + 0.8 * this.pos());',
    '      ctx.beginPath(); ctx.arc(x, h / 2, 11, 0, Math.PI * 2); ctx.fillStyle = ACCENT; ctx.fill();',
    '    },',
  ],
  'echo-grid': [
    '    lit() { return Math.floor(t * SPEED) % 9; },',
    '    hot() { return this.lit() === 4; },',
    '    scene(ctx) {',
    '      const w = this.w || 360, h = this.h || 640;',
    '      ctx.clearRect(0, 0, w, h);',
    '      const s = Math.min(w, h) * 0.16, gap = s * 0.3;',
    '      const ox = w / 2 - 1.5 * s - gap, oy = h / 2 - 1.5 * s - gap;',
    '      for (let i = 0; i < 9; i++) {',
    '        const gx = i % 3, gy = Math.floor(i / 3);',
    '        const x = ox + gx * (s + gap), y = oy + gy * (s + gap);',
    '        ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;',
    '        if (i === this.lit()) { ctx.fillStyle = ACCENT; ctx.fillRect(x, y, s, s); }',
    '        else ctx.strokeRect(x, y, s, s);',
    '      }',
    '    },',
  ],
  'phase-lock': [
    '    diff() {',
    '      const d = Math.abs(((t * SPEED * 0.7 + t * SPEED * 0.53) % (Math.PI * 2)));',
    '      return Math.min(d, Math.PI * 2 - d);',
    '    },',
    '    hot() { return this.diff() < 0.3 * WIN; },',
    '    scene(ctx) {',
    '      const w = this.w || 360, h = this.h || 640;',
    '      const cx = w / 2, cy = h / 2;',
    '      const R1 = Math.min(w, h) * 0.3, R2 = Math.min(w, h) * 0.19;',
    '      ctx.clearRect(0, 0, w, h);',
    '      ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;',
    '      ctx.beginPath(); ctx.arc(cx, cy, R1, 0, Math.PI * 2); ctx.stroke();',
    '      ctx.beginPath(); ctx.arc(cx, cy, R2, 0, Math.PI * 2); ctx.stroke();',
    '      const a1 = t * SPEED * 0.7, a2 = -t * SPEED * 0.53;',
    '      ctx.fillStyle = ACCENT;',
    '      ctx.beginPath(); ctx.arc(cx + Math.cos(a1) * R1, cy + Math.sin(a1) * R1, 8, 0, Math.PI * 2); ctx.fill();',
    '      ctx.beginPath(); ctx.arc(cx + Math.cos(a2) * R2, cy + Math.sin(a2) * R2, 8, 0, Math.PI * 2); ctx.fill();',
    '      if (this.hot()) {',
    '        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a1) * R1, cy + Math.sin(a1) * R1);',
    '        ctx.lineTo(cx + Math.cos(a2) * R2, cy + Math.sin(a2) * R2); ctx.stroke();',
    '      }',
    '    },',
  ],
  'heat-sync': [
    '    level() { return (Math.sin(t * SPEED) * MOT * 0.9 + 1) / 2; },',
    '    hot() { return Math.abs(this.level() - 0.5) < 0.09 * WIN; },',
    '    scene(ctx) {',
    '      const w = this.w || 360, h = this.h || 640;',
    '      const cx = w / 2, cy = h * 0.62, R = Math.min(w, h) * 0.34;',
    '      ctx.clearRect(0, 0, w, h);',
    '      ctx.strokeStyle = ACCENT; ctx.lineWidth = 3;',
    '      ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, Math.PI * 2); ctx.stroke();',
    '      ctx.globalAlpha = 0.2; ctx.lineWidth = 12;',
    '      const mid = Math.PI * 1.5;',
    '      ctx.beginPath(); ctx.arc(cx, cy, R, mid - 0.28 * WIN, mid + 0.28 * WIN); ctx.stroke();',
    '      ctx.globalAlpha = 1; ctx.lineWidth = 3;',
    '      const a = Math.PI + this.level() * Math.PI;',
    '      ctx.beginPath(); ctx.moveTo(cx, cy);',
    '      ctx.lineTo(cx + Math.cos(a) * R * 0.85, cy + Math.sin(a) * R * 0.85); ctx.stroke();',
    '    },',
  ],
  'light-bloom': [
    '    bloom() { return (Math.sin(t * SPEED) + 1) / 2; },',
    '    hot() { return this.bloom() > 1 - 0.18 * WIN; },',
    '    scene(ctx) {',
    '      const w = this.w || 360, h = this.h || 640;',
    '      const cx = w / 2, cy = h / 2, b = this.bloom();',
    '      ctx.clearRect(0, 0, w, h);',
    '      ctx.strokeStyle = ACCENT;',
    '      for (let i = 1; i <= 3; i++) {',
    '        ctx.globalAlpha = 0.9 - i * 0.22;',
    '        ctx.lineWidth = 4 - i;',
    '        ctx.beginPath(); ctx.arc(cx, cy, 14 + b * MOT * 26 * i, 0, Math.PI * 2); ctx.stroke();',
    '      }',
    '      ctx.globalAlpha = 1;',
    '    },',
  ],
  'signal-climb': [
    '    rung() { return Math.floor(t * SPEED * 2) % 6; },',
    '    hot() { return this.rung() === 5; },',
    '    scene(ctx) {',
    '      const w = this.w || 360, h = this.h || 640;',
    '      ctx.clearRect(0, 0, w, h);',
    '      for (let i = 0; i < 6; i++) {',
    '        const y = h * 0.82 - i * h * 0.12;',
    '        ctx.strokeStyle = ACCENT; ctx.lineWidth = i === 5 ? 3 : 2;',
    '        ctx.beginPath(); ctx.arc(w / 2, y, i === 5 ? 16 : 11, 0, Math.PI * 2);',
    '        if (i === this.rung()) { ctx.fillStyle = ACCENT; ctx.fill(); } else { ctx.stroke(); }',
    '      }',
    '    },',
  ],
  'crosswalk-pulse': [
    '    frac() { return (t * SPEED * 0.5) % 1; },',
    '    hot() { const f = this.frac(); return f > 0.62 && f < 0.62 + 0.14 * WIN; },',
    '    scene(ctx) {',
    '      const w = this.w || 360, h = this.h || 640;',
    '      ctx.clearRect(0, 0, w, h);',
    '      ctx.fillStyle = ACCENT; ctx.globalAlpha = 0.14;',
    '      ctx.fillRect(0, h * 0.4, w, h * 0.2);',
    '      ctx.globalAlpha = 0.5;',
    '      for (let i = 0; i < 6; i++) ctx.fillRect(w * (0.08 + i * 0.15), h * 0.44, w * 0.07, h * 0.12);',
    '      ctx.globalAlpha = 1;',
    '      ctx.beginPath(); ctx.arc(w / 2, h * 0.25, 14, 0, Math.PI * 2);',
    '      ctx.strokeStyle = ACCENT; ctx.lineWidth = 3;',
    '      if (this.hot()) { ctx.fillStyle = ACCENT; ctx.fill(); } else { ctx.stroke(); }',
    '    },',
  ],
  'memory-echo': [
    '    phase() { return Math.floor(t * SPEED) % 8; },',
    '    cell() { const p = this.phase(); return p < 4 ? p : 7 - p; },',
    '    hot() { return this.phase() === 7; },',
    '    scene(ctx) {',
    '      const w = this.w || 360, h = this.h || 640;',
    '      ctx.clearRect(0, 0, w, h);',
    '      const s = w * 0.16, gap = s * 0.25;',
    '      const ox = w / 2 - 2 * s - 1.5 * gap;',
    '      const echo = this.phase() >= 4;',
    '      for (let i = 0; i < 4; i++) {',
    '        const x = ox + i * (s + gap), y = h / 2 - s / 2;',
    '        ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;',
    '        if (i === this.cell()) { ctx.fillStyle = ACCENT; ctx.fillRect(x, y, s, s); }',
    '        else ctx.strokeRect(x, y, s, s);',
    '        if (echo) { ctx.globalAlpha = 0.4; ctx.fillRect(x, y + s + 8, s, 4); ctx.globalAlpha = 1; }',
    '      }',
    '    },',
  ],
});

/**
 * PURE: assemble a complete game.mjs for a variant from CLOSED token values only.
 * Difficulty/motion/juice/input-mode arrive as token KEYS resolved through the frozen
 * tables here — raw values from callers are ignored (closed-parameter discipline).
 *
 * Juice is INLINE in the generated source (entry modules may not import): a fixed-size
 * particle pool, a decaying flash, and a bounded shake — no timers, no allocations
 * after init, clamped to OFF under prefers-reduced-motion (shake can never fire then).
 * Input modes are scored generically over each variant's hot() window; a plain 'tap'
 * always works as a degenerate press+release so keyboard/sandbox drive every mode.
 */
export function gameSource(variant, accentHex, speed, difficultyKey, motionKey, juiceKey, modeKey) {
  const win = DIFFICULTY[difficultyKey] || DIFFICULTY.standard;
  const mot = MOTION[motionKey] || MOTION.standard;
  const fx = JUICE[juiceKey] || JUICE.standard;
  const pool = JUICE_POOL[juiceKey in JUICE ? juiceKey : 'standard'];
  const mode = INPUT_MODES.includes(modeKey) ? modeKey : 'tap_window';
  const head = [
    '/** Generated by the local Arcade Builder — closed-parameter procedural cabinet.',
    ' * Contract: host-mounted frame, pointer/tap input, result is a PROPOSAL (server stays authority).',
    ' * Requests NO capabilities. Procedural drawing only — no assets, no I/O, no timers. */',
    'export function createGame() {',
    '  let t = 0;',
    '  let score = 0;',
    '  let running = false;',
    '  let held = false, heldHot = 0, downX = 0, moveAt = 0;',
    "  const ACCENT = '" + accentHex + "';",
    '  const SPEED = ' + speed + ';',
    '  const WIN = ' + win + ';   // hot-window scale (difficulty)',
    '  const MOT = ' + mot + ';   // motion amplitude scale (motion)',
    "  const MODE = '" + mode + "';",
    '  // visual feel: fixed pool, decay-only state, reduced-motion clamps to 0 (no shake ever)',
    '  const RM = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;',
    '  const FX = RM ? 0 : ' + fx + ';',
    '  const FXN = FX ? ' + pool + ' : 0;',
    '  const px = [], py = [], pvx = [], pvy = [], pl = [];',
    '  let fi = 0, flash = 0, shake = 0;',
    '  function fxBurst(cx, cy) {',
    '    if (!FXN) return;',
    '    for (let i = 0; i < 8; i++) {',
    '      const a = (i / 8) * Math.PI * 2;',
    '      px[fi] = cx; py[fi] = cy; pvx[fi] = Math.cos(a) * 90; pvy[fi] = Math.sin(a) * 90; pl[fi] = 0.5;',
    '      fi = (fi + 1) % FXN;',
    '    }',
    '    flash = 0.22;',
    '    if (FX > 1) shake = 0.28;',
    '  }',
    '  function fxStep(dt) {',
    '    for (let i = 0; i < FXN; i++) if (pl[i] > 0) { pl[i] -= dt; px[i] += pvx[i] * dt; py[i] += pvy[i] * dt; }',
    '    if (flash > 0) flash -= dt;',
    '    if (shake > 0) shake -= dt;',
    '  }',
    '  function fxDraw(ctx, w, h) {',
    '    if (!FXN) return;',
    '    ctx.save(); ctx.fillStyle = ACCENT;',
    '    for (let i = 0; i < FXN; i++) if (pl[i] > 0) { ctx.globalAlpha = Math.max(0, Math.min(1, pl[i] * 2)); ctx.fillRect(px[i] - 2, py[i] - 2, 4, 4); }',
    '    if (flash > 0) { ctx.globalAlpha = flash * 0.5; ctx.fillRect(0, 0, w, h); }',
    '    ctx.restore();',
    '  }',
    '  return {',
    '    init(f) {',
    '      this.w = f.width; this.h = f.height; running = true; t = 0; score = 0;',
    '      held = false; heldHot = 0; fi = 0; flash = 0; shake = 0;',
    '      for (let i = 0; i < FXN; i++) { px[i] = 0; py[i] = 0; pvx[i] = 0; pvy[i] = 0; pl[i] = 0; }',
    '    },',
    '    tick(dt) {',
    '      if (!running) return;',
    '      t += dt;',
    '      fxStep(dt);',
    "      if (MODE === 'hold_band' || MODE === 'drag_track') {",
    "        const engaged = MODE === 'hold_band' ? held : (held && (t - moveAt) < 0.35);",
    '        if (engaged && this.hot()) {',
    '          heldHot += dt;',
    '          if (heldHot >= 0.25) { heldHot -= 0.25; score += 1; fxBurst((this.w || 360) / 2, (this.h || 640) / 2); }',
    '        }',
    '      }',
    '    },',
  ].join('\n');
  const tail = [
    '    onInput(ev) {',
    '      if (!running || !ev) return;',
    '      const cx = typeof ev.x === "number" ? ev.x : (this.w || 360) / 2;',
    '      const cy = typeof ev.y === "number" ? ev.y : (this.h || 640) / 2;',
    '      const hit = () => { score += 1; fxBurst(cx, cy); };',
    "      if (ev.type === 'tap') { if (this.hot()) hit(); return; } // degenerate press+release: every mode",
    "      if (ev.type === 'press') {",
    '        held = true; downX = cx; moveAt = t;',
    "        if (MODE === 'tap_window' && this.hot()) hit();",
    '        return;',
    '      }',
    "      if (ev.type === 'move') { if (held) moveAt = t; return; }",
    "      if (ev.type === 'release') {",
    '        if (!held) return;',
    '        held = false;',
    "        if (MODE === 'release_timing' && this.hot()) hit();",
    "        if (MODE === 'swipe_lane' && Math.abs(cx - downX) >= 48 && this.hot()) hit();",
    '      }',
    '    },',
    '    render(ctx) {',
    '      const w = this.w || 360, h = this.h || 640;',
    '      ctx.save();',
    '      if (shake > 0) ctx.translate(Math.sin(t * 70) * shake * 8, Math.cos(t * 60) * shake * 6);',
    '      this.scene(ctx);',
    '      ctx.restore();',
    '      fxDraw(ctx, w, h);',
    '    },',
    '    proposeResult() { return { proposed_score: score, public_safe: true }; },',
    '  };',
    '}',
  ].join('\n');
  const body = BODIES[VARIANTS.includes(variant) ? variant : 'pulse-ring'] || BODIES['pulse-ring'];
  return head + '\n' + body.join('\n') + '\n' + tail;
}

/** PURE: the SDK reference adapter, verbatim contract (no parameters reach it). */
export function adapterSource() {
  return [
    '/** Generated by the local Arcade Builder — the SDK reference adapter, verbatim contract.',
    ' * The ONLY bridge between the sandboxed game and the host frame. No network, no storage,',
    ' * no authority — results are PROPOSED to the host; the server validates/awards. */',
    "import { createGame } from './game.mjs';",
    '',
    'export function createAdapter() {',
    '  const game = createGame();',
    '  return {',
    '    mount(frame) { game.init({ width: frame.width, height: frame.height }); },',
    '    frame(dt, ctx) { game.tick(dt); game.render(ctx); },',
    '    input(ev) { game.onInput(ev); },',
    '    result() { return game.result ? game.result() : game.proposeResult(); },',
    '    capabilities() { return []; },',
    '  };',
    '}',
  ].join('\n');
}

/**
 * PURE: assemble a full arcade_game package from params. Tokens resolve through the closed
 * tables; anything unknown falls back to defaults. The importer re-gates everything anyway.
 */
export function buildPackage(params) {
  const p = params && typeof params === 'object' ? params : {};
  const variant = VARIANTS.includes(p.variant) ? p.variant : VARIANTS[0];
  const accent = ACCENTS[p.accent] || ACCENTS.cyan;
  const speed = SPEEDS[p.speed] || SPEEDS.medium;
  const manifest = {
    schema_version: SCHEMA_VERSION,
    package_kind: PACKAGE_KIND,
    package_id: typeof p.package_id === 'string' ? p.package_id : '',
    display_name: (typeof p.display_name === 'string' && p.display_name.trim()) || 'Untitled Cabinet',
    frame_contract_id: typeof p.frame === 'string' ? p.frame : DEFAULT_FRAME,
    entry: 'game.mjs',
    adapter: 'adapter.mjs',
    assets: [],
    capabilities: [],
    size_budget_bytes: Number.isInteger(p.budget) ? p.budget : SIZE_BUDGET_MIN_BYTES * 16,
  };
  const files = {
    'game.mjs': gameSource(variant, accent, speed, p.difficulty, p.motion, p.juice, p.input_mode),
    'adapter.mjs': adapterSource(),
  };
  return { manifest, files, variant };
}

// ── the STARTER LIBRARY (16 named, tuned, fully-described example cabinets) ──
// Categories: Reflex / Pattern / Position / Puzzle / Atmosphere. All copy is static, closed,
// and clean of economy vocabulary (unit-screened). Every starter is importer-valid by test.
export const STARTERS = Object.freeze([
  // A — Reflex
  { id: 'neon-pulse', name: 'Neon Pulse', category: 'Reflex', tags: Object.freeze(['Reflex', 'Timing']),
    pitch: 'Tap the ring at the top of its pulse.',
    explain: 'A ring swells and shrinks. Tap at its widest.',
    input: 'tap', round_s: 30, result_note: 'Score counts clean taps inside the pulse window.',
    mobile_note: 'Single thumb, center screen.', reduced_motion_note: 'The calm motion setting keeps the swell shallow.',
    params: Object.freeze({ variant: 'pulse-ring', accent: 'cyan', speed: 'medium', difficulty: 'standard', motion: 'standard', input_mode: 'tap_window', juice: 'vivid' }) },
  { id: 'flash-three', name: 'Flash Three', category: 'Reflex', tags: Object.freeze(['Reflex', 'Timing']),
    pitch: 'Three lights cycle. Only the middle one counts.',
    explain: 'Lights step left to right. Tap while the middle is lit.',
    input: 'tap', round_s: 20, result_note: 'Score counts taps landed on the middle light.',
    mobile_note: 'Lights sized for thumbs at 360px.', reduced_motion_note: 'Discrete steps — no continuous motion.',
    params: Object.freeze({ variant: 'tri-light', accent: 'amber', speed: 'fast', difficulty: 'sharp', motion: 'standard', input_mode: 'tap_window', juice: 'standard' }) },
  { id: 'narrow-band', name: 'Narrow Band', category: 'Reflex', tags: Object.freeze(['Reflex', 'Timing']),
    pitch: 'Catch the drifter inside a thin band.',
    explain: 'A dot drifts side to side. Tap while it crosses the band.',
    input: 'tap', round_s: 30, result_note: 'Score counts taps while the dot is inside the band.',
    mobile_note: 'Band width tuned for small screens.', reduced_motion_note: 'Use the calm motion setting to slow the drift.',
    params: Object.freeze({ variant: 'drift-band', accent: 'violet', speed: 'fast', difficulty: 'sharp', motion: 'standard', input_mode: 'tap_window', juice: 'standard' }) },
  // B — Pattern
  { id: 'echo-four', name: 'Echo Four', category: 'Pattern', tags: Object.freeze(['Pattern', 'Memory']),
    pitch: 'Watch the run, then tap on the echo.',
    explain: 'Four cells light in order, then replay backward. Tap as the echo ends.',
    input: 'tap', round_s: 40, result_note: 'Score counts taps on the final echo step.',
    mobile_note: 'Four large cells in one row.', reduced_motion_note: 'Stepped lights only — nothing slides.',
    params: Object.freeze({ variant: 'memory-echo', accent: 'magenta', speed: 'medium', difficulty: 'standard', motion: 'standard', input_mode: 'release_timing', juice: 'standard' }) },
  { id: 'grid-walker', name: 'Grid Walker', category: 'Pattern', tags: Object.freeze(['Pattern', 'Timing']),
    pitch: 'A walker crosses the grid. Catch it at the center.',
    explain: 'One cell lights at a time. Tap when the center cell lights.',
    input: 'tap', round_s: 30, result_note: 'Score counts center-cell taps.',
    mobile_note: '3×3 grid fills the small frame.', reduced_motion_note: 'Discrete cell steps, no travel animation.',
    params: Object.freeze({ variant: 'echo-grid', accent: 'green', speed: 'medium', difficulty: 'standard', motion: 'standard', input_mode: 'tap_window', juice: 'standard' }) },
  // C — Position / movement
  { id: 'orbit-snag', name: 'Orbit Snag', category: 'Position', tags: Object.freeze(['Position', 'Timing']),
    pitch: 'Snag the satellite on the top arc.',
    explain: 'A dot orbits a ring. Tap while it crosses the marked arc.',
    input: 'tap', round_s: 30, result_note: 'Score counts taps inside the marked arc.',
    mobile_note: 'Orbit radius scales to the frame.', reduced_motion_note: 'The calm motion setting shrinks the orbit.',
    params: Object.freeze({ variant: 'orbit-catch', accent: 'cyan', speed: 'fast', difficulty: 'standard', motion: 'standard', input_mode: 'tap_window', juice: 'standard' }) },
  { id: 'rail-sprint', name: 'Rail Sprint', category: 'Position', tags: Object.freeze(['Position', 'Timing']),
    pitch: 'A runner ping-pongs the rail. Tag it mid-track.',
    explain: 'The runner bounces end to end. Tap inside the marked zone.',
    input: 'tap', round_s: 25, result_note: 'Score counts in-zone taps.',
    mobile_note: 'Horizontal rail suits landscape too.', reduced_motion_note: 'One axis of motion only.',
    params: Object.freeze({ variant: 'rail-runner', accent: 'amber', speed: 'fast', difficulty: 'standard', motion: 'standard', input_mode: 'swipe_lane', juice: 'standard' }) },
  { id: 'tide-keeper', name: 'Tide Keeper', category: 'Position', tags: Object.freeze(['Position', 'Timing']),
    pitch: 'Hold the line where the tide meets the gate.',
    explain: 'The water rises and falls. Tap while it sits in the gate band.',
    input: 'tap', round_s: 35, result_note: 'Score counts taps with the tide in the band.',
    mobile_note: 'Full-width water line reads at any size.', reduced_motion_note: 'The slow speed setting gives a long swell.',
    params: Object.freeze({ variant: 'tide-gate', accent: 'green', speed: 'slow', difficulty: 'standard', motion: 'standard', input_mode: 'hold_band', juice: 'standard' }) },
  // D — Puzzle micro-loop
  { id: 'phase-lock', name: 'Phase Lock', category: 'Puzzle', tags: Object.freeze(['Puzzle', 'Timing']),
    pitch: 'Two rings, two satellites — lock them into one line.',
    explain: 'The satellites drift apart and together. Tap when they align.',
    input: 'tap', round_s: 45, result_note: 'Score counts taps at alignment.',
    mobile_note: 'Concentric rings center on the thumb line.', reduced_motion_note: 'Chill difficulty widens the lock.',
    params: Object.freeze({ variant: 'phase-lock', accent: 'violet', speed: 'slow', difficulty: 'chill', motion: 'standard', input_mode: 'drag_track', juice: 'standard' }) },
  { id: 'heat-balance', name: 'Heat Balance', category: 'Puzzle', tags: Object.freeze(['Puzzle', 'Timing']),
    pitch: 'Keep the needle in the safe arc.',
    explain: 'The gauge needle swings. Tap while it crosses the marked arc.',
    input: 'tap', round_s: 30, result_note: 'Score counts in-arc taps.',
    mobile_note: 'Gauge sits low for one-hand reach.', reduced_motion_note: 'The calm motion setting narrows the swing.',
    params: Object.freeze({ variant: 'heat-sync', accent: 'amber', speed: 'medium', difficulty: 'standard', motion: 'standard', input_mode: 'hold_band', juice: 'standard' }) },
  // E — Atmosphere / city-themed (one per block)
  { id: 'spire-pulse', name: 'Spire Pulse', category: 'Atmosphere', tags: Object.freeze(['Atmosphere', 'Reflex']),
    pitch: 'Downtown after dark — answer the Signal Spire.',
    explain: 'The spire light swells. Tap on the bright beat.',
    input: 'tap', round_s: 30, result_note: 'Score counts taps on the bright beat.',
    mobile_note: 'Single centered ring.', reduced_motion_note: 'Vivid motion is optional; the default stays standard.',
    params: Object.freeze({ variant: 'pulse-ring', accent: 'magenta', speed: 'slow', difficulty: 'chill', motion: 'vivid', input_mode: 'tap_window', juice: 'vivid' }) },
  { id: 'crosswalk-window', name: 'Crosswalk Window', category: 'Atmosphere', tags: Object.freeze(['Atmosphere', 'Timing']),
    pitch: 'Catch the walk signal before it flips.',
    explain: 'The signal cycles. Tap during the open window.',
    input: 'tap', round_s: 25, result_note: 'Score counts taps in the open window.',
    mobile_note: 'Signal dot sits in the upper third.', reduced_motion_note: 'Stripes are static; only the signal changes.',
    params: Object.freeze({ variant: 'crosswalk-pulse', accent: 'cyan', speed: 'medium', difficulty: 'standard', motion: 'standard', input_mode: 'tap_window', juice: 'standard' }) },
  { id: 'crane-gate', name: 'Crane Gate', category: 'Atmosphere', tags: Object.freeze(['Atmosphere', 'Position']),
    pitch: 'Harborside — time the tide under the crane.',
    explain: 'The waterline breathes. Tap while it holds the gate band.',
    input: 'tap', round_s: 35, result_note: 'Score counts in-band taps.',
    mobile_note: 'Reads as a single horizon line.', reduced_motion_note: 'Slow swell by default.',
    params: Object.freeze({ variant: 'tide-gate', accent: 'cyan', speed: 'medium', difficulty: 'standard', motion: 'calm', input_mode: 'swipe_lane', juice: 'standard' }) },
  { id: 'beacon-climb', name: 'Beacon Climb', category: 'Atmosphere', tags: Object.freeze(['Atmosphere', 'Pattern']),
    pitch: 'Ride the signal up the Beacon Crown.',
    explain: 'A light climbs six rungs. Tap when it reaches the crown.',
    input: 'tap', round_s: 30, result_note: 'Score counts crown taps.',
    mobile_note: 'Vertical ladder fits portrait frames.', reduced_motion_note: 'Discrete rung steps only.',
    params: Object.freeze({ variant: 'signal-climb', accent: 'amber', speed: 'medium', difficulty: 'standard', motion: 'standard', input_mode: 'hold_band', juice: 'standard' }) },
  { id: 'ember-sync', name: 'Ember Sync', category: 'Atmosphere', tags: Object.freeze(['Atmosphere', 'Puzzle']),
    pitch: 'Foundry heat runs hot — hold the safe arc.',
    explain: 'The gauge surges. Tap inside the narrow safe arc.',
    input: 'tap', round_s: 30, result_note: 'Score counts safe-arc taps.',
    mobile_note: 'Gauge low and wide for thumbs.', reduced_motion_note: 'Sharp difficulty is the point here; pick Heat Balance for a calmer take.',
    params: Object.freeze({ variant: 'heat-sync', accent: 'magenta', speed: 'fast', difficulty: 'sharp', motion: 'standard', input_mode: 'release_timing', juice: 'standard' }) },
  { id: 'arbor-bloom', name: 'Arbor Bloom', category: 'Atmosphere', tags: Object.freeze(['Atmosphere', 'Reflex']),
    pitch: 'Garden lights bloom and fade. Meet them at full bloom.',
    explain: 'Rings bloom outward. Tap at the fullest bloom.',
    input: 'tap', round_s: 40, result_note: 'Score counts full-bloom taps.',
    mobile_note: 'Soft concentric rings, centered.', reduced_motion_note: 'Calm motion is the default here.',
    params: Object.freeze({ variant: 'light-bloom', accent: 'green', speed: 'slow', difficulty: 'chill', motion: 'calm', input_mode: 'hold_band', juice: 'standard' }) },
]);

/** PURE: a starter by id (or null). */
export function getStarter(id) {
  return STARTERS.find((s) => s.id === id) || null;
}

/** PURE: starters grouped by category in deterministic library order (fresh structure). */
export function startersByCategory() {
  const out = {};
  for (const s of STARTERS) (out[s.category] = out[s.category] || []).push(s);
  return out;
}

/** PURE: the full generated package for a starter (display metadata → manifest + files). */
export function buildStarterPackage(id) {
  const s = getStarter(id);
  if (!s) return null;
  return buildPackage({ ...s.params, package_id: s.id, display_name: s.name });
}
