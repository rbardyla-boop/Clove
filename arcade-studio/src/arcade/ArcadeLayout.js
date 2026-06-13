/**
 * Arcade building layout MODEL — PURE, cross-env, no Three.js.
 *
 * The in-memory, schema-shaped editor state for a building (everything except the export envelope's
 * identity/constraints, which exportArcadeLayout adds). All mutation helpers are IMMUTABLE: they
 * return a NEW model, never modifying the input — which makes undo/redo snapshots trivial and safe.
 */

import { resolveTheme } from './ArcadeThemes.js';
import { cabinetPreset } from '../cabinets/CabinetPresets.js';
import { clampInt } from '../utils/math.js';
import { LIMITS } from '../validation/tokens.js';

export const ELEMENT_KINDS = Object.freeze(['walls', 'entrances', 'props', 'signs', 'cabinets', 'zones']);

/** Deep clone of plain layout data (safe: the model is JSON-plain by construction). */
export function cloneLayout(layout) {
  return JSON.parse(JSON.stringify(layout));
}

/** Create an empty, valid layout model for a theme + grid size. */
export function createEmptyLayout({ id = 'untitled-hall', theme = 'neon-circuit', cols = 16, rows = 12 } = {}) {
  const t = resolveTheme(theme);
  const C = clampInt(cols, LIMITS.GRID_MIN, LIMITS.GRID_MAX);
  const R = clampInt(rows, LIMITS.GRID_MIN, LIMITS.GRID_MAX);
  return {
    layout_id: id,
    display_name: 'Untitled Hall',
    theme: t.name,
    grid: { cols: C, rows: R },
    floor: { material: t.floor },
    walls: [],
    entrances: [],
    props: [],
    signs: [],
    cabinets: [],
    zones: [],
    lighting: { ambient: 'neon-blue', accent: 'neon-cyan', intensity: 'medium', bloom: true },
    effects: { screen_shake: 'subtle', particle: 'neon-motes' },
    metadata: { tags: [], note: '' },
  };
}

/** A characterful starter hall used as the editor's initial scene. Validates against the schema. */
export function defaultLayoutModel() {
  return {
    layout_id: 'neon-circuit-hall',
    display_name: 'Neon Circuit Hall',
    theme: 'neon-circuit',
    grid: { cols: 16, rows: 12 },
    floor: { material: 'neon-grid' },
    walls: [
      { material: 'panel-dark', gx: 0, gy: 0, length: 16, orientation: 'north' },
      { material: 'panel-dark', gx: 0, gy: 11, length: 16, orientation: 'south' },
      { material: 'panel-dark', gx: 0, gy: 0, length: 12, orientation: 'west' },
      { material: 'panel-dark', gx: 15, gy: 0, length: 12, orientation: 'east' },
    ],
    entrances: [{ style: 'neon-portal', gx: 8, gy: 11, facing: 'north' }],
    props: [
      { type: 'bench', gx: 3, gy: 8, rotation: 0, layer: 1 },
      { type: 'planter', gx: 12, gy: 8, rotation: 0, layer: 1 },
      { type: 'speaker-stack', gx: 1, gy: 1, rotation: 90, layer: 1 },
      { type: 'standee', gx: 14, gy: 2, rotation: 180, layer: 1 },
      { type: 'rope-post', gx: 7, gy: 10, rotation: 0, layer: 1 },
      { type: 'neon-arch', gx: 8, gy: 9, rotation: 0, layer: 1 },
    ],
    signs: [
      { style: 'blade', text: 'ARCADE', placement: 'apex', gx: 8, gy: 0, palette: 'neon-magenta' },
      { style: 'ticker', text: 'HIGH SCORES', placement: 'wall-left', gx: 0, gy: 3, palette: 'neon-cyan' },
    ],
    cabinets: [
      { cabinet: cabinetPreset('classic-upright'), gx: 4, gy: 4, rotation: 0, layer: 2 },
      { cabinet: cabinetPreset('candy-cab'), gx: 6, gy: 4, rotation: 0, layer: 2 },
      { cabinet: cabinetPreset('shmup-tate'), gx: 8, gy: 4, rotation: 0, layer: 2 },
      { cabinet: cabinetPreset('vector-cockpit'), gx: 10, gy: 4, rotation: 0, layer: 2 },
      { cabinet: cabinetPreset('racer-deluxe'), gx: 4, gy: 7, rotation: 180, layer: 2 },
      { cabinet: cabinetPreset('rhythm-deck'), gx: 6, gy: 7, rotation: 180, layer: 2 },
    ],
    zones: [
      { kind: 'lighting', preset: 'neon-strip', palette: 'neon-cyan', gx: 0, gy: 0, cols: 16, rows: 1, intensity: 'medium' },
      { kind: 'ambience', preset: 'glow-pool', palette: 'neon-violet', gx: 6, gy: 5, cols: 4, rows: 3, intensity: 'low' },
    ],
    lighting: { ambient: 'neon-blue', accent: 'neon-cyan', intensity: 'medium', bloom: true },
    effects: { screen_shake: 'subtle', particle: 'neon-motes' },
    metadata: { tags: ['starter', 'neon'], note: 'Starter arcade hall.' },
  };
}

/** Immutable: append an element to a collection. */
export function addElement(layout, kind, item) {
  if (!ELEMENT_KINDS.includes(kind)) throw new Error(`unknown element kind: ${kind}`);
  const next = cloneLayout(layout);
  next[kind] = [...(next[kind] || []), item];
  return next;
}

/** Immutable: remove element at index from a collection. */
export function removeElement(layout, kind, index) {
  if (!ELEMENT_KINDS.includes(kind)) throw new Error(`unknown element kind: ${kind}`);
  const next = cloneLayout(layout);
  next[kind] = (next[kind] || []).filter((_, i) => i !== index);
  return next;
}

/** Immutable: shallow-merge a patch into element at index. */
export function updateElement(layout, kind, index, patch) {
  if (!ELEMENT_KINDS.includes(kind)) throw new Error(`unknown element kind: ${kind}`);
  const next = cloneLayout(layout);
  const arr = next[kind] || [];
  if (index < 0 || index >= arr.length) return next;
  arr[index] = { ...arr[index], ...patch };
  next[kind] = arr;
  return next;
}

/** Immutable: set a top-level field (theme, lighting, effects, metadata, etc.). */
export function setLayoutField(layout, key, value) {
  const next = cloneLayout(layout);
  next[key] = value;
  return next;
}

/**
 * Immutable: resize the grid, clamping every placement (and zone/wall footprint) into the new bounds
 * so the result stays schema-valid. Duplicate cabinet cells created by clamping are de-duplicated.
 */
export function resizeGrid(layout, cols, rows) {
  const C = clampInt(cols, LIMITS.GRID_MIN, LIMITS.GRID_MAX);
  const R = clampInt(rows, LIMITS.GRID_MIN, LIMITS.GRID_MAX);
  const next = cloneLayout(layout);
  next.grid = { cols: C, rows: R };
  const clampCell = (e) => {
    if ('gx' in e) e.gx = Math.min(e.gx, C - 1);
    if ('gy' in e) e.gy = Math.min(e.gy, R - 1);
  };
  for (const kind of ['walls', 'entrances', 'props', 'signs', 'cabinets', 'zones']) {
    for (const e of next[kind] || []) clampCell(e);
  }
  // clamp extents to the (clamped) origin so origin+extent never spills past the grid edge
  for (const w of next.walls || []) {
    const axisMax = (w.orientation === 'north' || w.orientation === 'south') ? C - w.gx : R - w.gy;
    w.length = Math.max(1, Math.min(w.length, axisMax));
  }
  for (const z of next.zones || []) {
    z.cols = Math.max(1, Math.min(z.cols, C - z.gx));
    z.rows = Math.max(1, Math.min(z.rows, R - z.gy));
  }
  // de-dupe cabinet cells (clamping may collide two cabinets onto one cell)
  const seen = new Set();
  next.cabinets = (next.cabinets || []).filter((c) => {
    const key = `${c.gx},${c.gy}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return next;
}
