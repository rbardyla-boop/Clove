/**
 * Cabinet Juice — shared client-side feel layer for arcade cabinets.
 *
 * Tiny, dependency-free audio + haptic + motion convenience used by the cabinet
 * mini-games (Pulse Tap first; Signal Sprint and Neon Grid can reuse it). It
 * synthesizes short tones with the Web Audio API and fires light haptics.
 *
 * GUARDRAILS (by design):
 *  - PRESENTATION ONLY. This module never imports, reads, or affects scoring,
 *    tickets, balances, the ledger, prizes, the catalog, or any server code. It
 *    cannot change what a round is worth — it only makes a round feel better.
 *  - Client-only. No network, no persistence, no external assets, no deps.
 *  - Fail-safe. Every primitive is a no-op when its browser API is missing or
 *    throws (no AudioContext, no vibrate, headless/SSR) — it must never break a
 *    round.
 *
 * createJuice() -> { resume, tone, vibrate, available }
 *   resume()  : unlock/resume the AudioContext from a user gesture (e.g. Start).
 *   tone(freq, durMs?, opts?) : play one short synthesized tone.
 *   vibrate(pattern) : navigator.vibrate wrapper, safe when unsupported.
 *
 * prefersReducedMotion() -> boolean  (live check; callers gate big motion on it)
 */

export function prefersReducedMotion() {
  try {
    return typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function createJuice() {
  let ctx = null;
  let dead = false; // becomes true once we know audio is unavailable

  function audio() {
    if (dead) return null;
    if (ctx) return ctx;
    try {
      const AC = (typeof window !== 'undefined')
        && (window.AudioContext || window.webkitAudioContext);
      if (!AC) { dead = true; return null; }
      ctx = new AC();
    } catch {
      dead = true;
      return null;
    }
    return ctx;
  }

  /** Resume/unlock audio from inside a user gesture. Safe to call repeatedly. */
  function resume() {
    const c = audio();
    if (c && c.state === 'suspended') {
      try { c.resume(); } catch { /* non-fatal */ }
    }
  }

  /**
   * Play one short tone. `opts`:
   *   type    : oscillator type ('sine'|'triangle'|'square'|'sawtooth')
   *   gain    : peak gain (kept low; these are UI blips)
   *   attack  : seconds to reach peak
   *   slideTo : optional end frequency (glide for a livelier blip)
   */
  function tone(freq, durMs = 90, opts = {}) {
    const c = audio();
    if (!c) return;
    const { type = 'sine', gain = 0.06, attack = 0.005, slideTo = null } = opts;
    try {
      const now = c.currentTime;
      const dur = Math.max(0.02, durMs / 1000);
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(1, freq), now);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + dur);
      }
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g).connect(c.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch {
      /* non-fatal: a failed blip must never interrupt gameplay */
    }
  }

  /** Light haptic. Accepts a number or a [on,off,on,...] pattern. No-op if unsupported. */
  function vibrate(pattern) {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      /* non-fatal */
    }
  }

  return {
    resume,
    tone,
    vibrate,
    get available() { return !!audio(); },
  };
}
