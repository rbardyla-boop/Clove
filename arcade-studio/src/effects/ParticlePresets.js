/**
 * Particle preset resolution — PURE, cross-env, no Three.js.
 *
 * Resolves a closed preset NAME into clamped, bounded, performance-aware parameters (hard count cap,
 * bounded lifetime/size/speed, closed spawn-shape + blend-mode + fade, palette resolved to a color
 * integer). No arbitrary shaders, no remote assets — only preset tokens and clamped numbers.
 */

import {
  PARTICLE_PRESETS, PARTICLE_NAMES, PARTICLE_BOUNDS, PARTICLE_SPAWN_SHAPES, PARTICLE_BLEND_MODES,
  PARTICLE_FADES, resolvePalette,
} from '../validation/tokens.js';
import { clamp, clampInt } from '../utils/math.js';

export { PARTICLE_NAMES };

/** Resolve a preset name → clamped numeric/closed parameters + a resolved color integer. */
export function resolveParticlePreset(name) {
  const p = PARTICLE_PRESETS[name];
  if (!p) return null; // 'none' or unknown → no system
  const colors = resolvePalette(p.palette);
  return {
    name,
    count: clampInt(p.count, PARTICLE_BOUNDS.count[0], PARTICLE_BOUNDS.count[1]),
    lifetime: clamp(p.lifetime, PARTICLE_BOUNDS.lifetime[0], PARTICLE_BOUNDS.lifetime[1]),
    size: clamp(p.size, PARTICLE_BOUNDS.size[0], PARTICLE_BOUNDS.size[1]),
    speed: clamp(p.speed, PARTICLE_BOUNDS.speed[0], PARTICLE_BOUNDS.speed[1]),
    gravity: clamp(p.gravity ?? 0, -8, 8),
    color: colors.glow,
    spawn: PARTICLE_SPAWN_SHAPES.includes(p.spawn) ? p.spawn : 'point',
    blend: PARTICLE_BLEND_MODES.includes(p.blend) ? p.blend : 'normal',
    fade: PARTICLE_FADES.includes(p.fade) ? p.fade : 'out',
  };
}

/** Total particle budget across an array of preset names (for the debug panel + perf guard). */
export function totalParticleBudget(names) {
  return names.reduce((sum, n) => {
    const r = resolveParticlePreset(n);
    return sum + (r ? r.count : 0);
  }, 0);
}
