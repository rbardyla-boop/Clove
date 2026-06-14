/**
 * Render loop with registered updaters + FPS tracking. `step(dt)` advances exactly one frame and is
 * exposed for DETERMINISTIC headless testing (drive it from a test harness with a fixed dt instead of
 * relying on requestAnimationFrame). `start()/stop()` drive the live rAF loop in the browser.
 */

const MAX_DT = 0.05; // clamp huge gaps (tab refocus) so physics/effects never explode

export class RenderLoop {
  constructor(renderFn) {
    this._render = renderFn;
    this._updaters = new Set();
    this._raf = 0;
    this._last = 0;
    this.running = false;
    this.fps = 0;
    this._fpsAccum = 0;
    this._fpsFrames = 0;
  }

  /** Register a per-frame updater fn(dt). Returns an unsubscribe fn. */
  add(fn) {
    this._updaters.add(fn);
    return () => this._updaters.delete(fn);
  }

  /** Advance one frame by dt seconds: run updaters, then render. Safe to call manually (headless). */
  step(dt) {
    const clamped = Math.min(Math.max(dt, 0), MAX_DT);
    for (const u of this._updaters) u(clamped);
    this._render(clamped);
    this._trackFps(clamped);
  }

  _trackFps(dt) {
    this._fpsAccum += dt;
    this._fpsFrames += 1;
    if (this._fpsAccum >= 0.5) {
      this.fps = Math.round(this._fpsFrames / this._fpsAccum);
      this._fpsAccum = 0;
      this._fpsFrames = 0;
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = now();
    const frame = (t) => {
      if (!this.running) return;
      const dt = (t - this._last) / 1000;
      this._last = t;
      this.step(dt);
      this._raf = requestAnimationFrame(frame);
    };
    this._raf = requestAnimationFrame((t) => {
      this._last = t;
      frame(t);
    });
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
