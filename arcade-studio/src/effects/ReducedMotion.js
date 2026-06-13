/**
 * Reduced-motion store. Reads the OS `prefers-reduced-motion` setting and exposes a user override.
 * `motionScale()` returns 0 when motion should be suppressed, 1 otherwise — every animated effect
 * (cabinet attract, screen shake, particles) multiplies its amplitude by this, so accessibility is a
 * single source of truth rather than scattered checks.
 */

export class ReducedMotion {
  constructor() {
    this._system = false;
    this._override = 'auto'; // 'auto' | 'on' | 'off'
    this._subs = new Set();
    if (typeof matchMedia !== 'undefined') {
      const mq = matchMedia('(prefers-reduced-motion: reduce)');
      this._system = mq.matches;
      mq.addEventListener?.('change', (e) => {
        this._system = e.matches;
        this._emit();
      });
    }
  }

  /** Effective reduced-motion state after applying the override. */
  get reduced() {
    if (this._override === 'on') return true;
    if (this._override === 'off') return false;
    return this._system;
  }

  /** 0 when motion is reduced, 1 otherwise. */
  motionScale() {
    return this.reduced ? 0 : 1;
  }

  setOverride(mode) {
    if (['auto', 'on', 'off'].includes(mode)) {
      this._override = mode;
      this._emit();
    }
  }

  get override() {
    return this._override;
  }

  subscribe(fn) {
    this._subs.add(fn);
    return () => this._subs.delete(fn);
  }

  _emit() {
    for (const fn of this._subs) fn(this.reduced);
  }
}
