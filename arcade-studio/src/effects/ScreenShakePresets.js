/**
 * Screen-shake preset resolution — PURE, cross-env, no Three.js.
 *
 * Resolves a closed preset NAME into clamped, bounded numeric parameters. The Three.js ScreenShake
 * module consumes these; validators reference the same closed name set. There is NO arbitrary
 * animation script surface — only preset tokens and numbers clamped into SHAKE_BOUNDS.
 */

import { SCREEN_SHAKE_PRESETS, SCREEN_SHAKE_NAMES, SHAKE_BOUNDS, SHAKE_AXES, SHAKE_FALLOFFS } from '../validation/tokens.js';
import { clamp } from '../utils/math.js';

export { SCREEN_SHAKE_NAMES };

/** Resolve a preset name → clamped { amplitude, frequency, duration, falloff, axis }. */
export function resolveShake(name) {
  const p = SCREEN_SHAKE_PRESETS[name] || SCREEN_SHAKE_PRESETS.none;
  return {
    name: SCREEN_SHAKE_NAMES.includes(name) ? name : 'none',
    amplitude: clamp(p.amplitude, SHAKE_BOUNDS.amplitude[0], SHAKE_BOUNDS.amplitude[1]),
    frequency: clamp(p.frequency, SHAKE_BOUNDS.frequency[0], SHAKE_BOUNDS.frequency[1]),
    duration: clamp(p.duration, SHAKE_BOUNDS.duration[0], SHAKE_BOUNDS.duration[1]),
    falloff: SHAKE_FALLOFFS.includes(p.falloff) ? p.falloff : 'linear',
    axis: SHAKE_AXES.includes(p.axis) ? p.axis : 'xy',
  };
}

/** Falloff envelope value in [0,1] for normalized progress t in [0,1]. */
export function shakeEnvelope(falloff, t) {
  const x = clamp(t, 0, 1);
  switch (falloff) {
    case 'ease-out':
      return 1 - x * x;
    case 'ease-in-out':
      return 0.5 - 0.5 * Math.cos((1 - x) * Math.PI);
    case 'bounce':
      return (1 - x) * Math.abs(Math.cos(x * Math.PI * 3));
    case 'linear':
    default:
      return 1 - x;
  }
}
