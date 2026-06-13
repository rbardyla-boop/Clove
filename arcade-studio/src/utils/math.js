/**
 * Pure math helpers — no Three.js, no DOM. Safe to import in Node tests.
 */

export const TAU = Math.PI * 2;

/** Clamp `v` into [min, max]. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** Clamp then round to an integer (used to coerce untrusted numeric input into bounds). */
export function clampInt(v, min, max) {
  return Math.round(clamp(Number.isFinite(v) ? v : min, min, max));
}

/** Round to a fixed number of decimals so exported JSON stays deterministic + readable. */
export function roundTo(v, decimals = 3) {
  const f = 10 ** decimals;
  return Math.round((Number.isFinite(v) ? v : 0) * f) / f;
}

/** Linear interpolate. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Snap a scalar to the nearest multiple of `step` (step > 0). */
export function snap(v, step) {
  if (!(step > 0)) return v;
  return Math.round(v / step) * step;
}

/** Quantize an angle (radians) to the nearest `count` evenly-spaced rotations. */
export function snapAngle(rad, count = 4) {
  const stepAng = TAU / count;
  return Math.round(rad / stepAng) * stepAng;
}

/** Axis-aligned rectangle overlap test in grid/world units (half-open, touching edges allowed). */
export function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** Smooth exponential decay factor for frame-rate-independent damping. */
export function dampFactor(lambda, dt) {
  return 1 - Math.exp(-lambda * dt);
}
