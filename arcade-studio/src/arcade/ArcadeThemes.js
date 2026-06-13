/**
 * Theme resolution — PURE, cross-env, no Three.js.
 *
 * Resolves a closed THEME token into renderer-ready values: floor/wall material tokens, fog color
 * integer + density, and ambient/accent palette color sets. The Three.js scene + building builders
 * consume this; everything here is bounded and closed.
 */

import { THEME_DEF, THEMES, FOG_DENSITY, resolvePalette } from '../validation/tokens.js';
import { hexToInt } from '../utils/colors.js';

/** Resolve a theme name → { name, floor, wall, fogColor, fogDensity, ambient, accent }. */
export function resolveTheme(name) {
  const def = THEME_DEF[name] || THEME_DEF['neon-circuit'];
  return {
    name: THEMES.includes(name) ? name : 'neon-circuit',
    floor: def.floor,
    wall: def.wall,
    fogColor: hexToInt(def.fog),
    fogDensity: FOG_DENSITY[def.fogDensity] ?? FOG_DENSITY.low,
    ambient: resolvePalette(def.ambient),
    accent: resolvePalette(def.accent),
  };
}

export { THEMES };
