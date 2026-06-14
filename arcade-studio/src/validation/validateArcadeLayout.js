/**
 * Validator for an ARCADE BUILDING LAYOUT — PURE, cross-env, no Three.js. Deny-by-default.
 *
 * Validates grid bounds, every placed element against closed tokens + bounded integers, ensures
 * placements stay inside the grid, cabinets don't share a cell, and the required safety constraints
 * hold. Reuses validateCabinetBlock so embedded cabinets get the full asset-level check. Never throws.
 */

import { LAYOUT_KIND, SCHEMA_VERSION, LIMITS, ID_RE, TAG_RE, HASH_RE } from './tokens.js';
import {
  LAYOUT_TOP_KEYS, LAYOUT_REQUIRED_KEYS, GRID_KEYS, FLOOR_KEYS, WALL_KEYS, ENTRANCE_KEYS,
  PROP_KEYS, SIGN_KEYS, CABINET_PLACEMENT_KEYS, ZONE_KEYS, LIGHTING_KEYS, EFFECTS_KEYS,
  METADATA_KEYS, ENUMS,
} from './ArcadeLayoutSchema.js';
import {
  scanSafety, rejectUnknownKeys, requireKeys, inSet, isCleanText, isPlainObject,
  isIntInRange, utf8Bytes, FORBIDDEN_TERMS_RE,
} from './safety.js';
import { checkForbiddenSurface, checkRequiredConstraints } from './forbiddenSurfaceChecks.js';
import { validateCabinetBlock } from './validateArcadeAsset.js';
import { canonicalize } from '../importExport/hashAsset.js';

function validateArray(arr, key, max, errors) {
  if (!Array.isArray(arr)) {
    errors.push(`${key} must be an array`);
    return null;
  }
  if (arr.length > max) errors.push(`${key} exceeds ${max} entries (${arr.length})`);
  return arr.slice(0, max + 1);
}

function inGrid(gx, gy, cols, rows, at, errors) {
  if (!isIntInRange(gx, 0, cols - 1, `${at}.gx`, errors)) return false;
  if (!isIntInRange(gy, 0, rows - 1, `${at}.gy`, errors)) return false;
  return true;
}

export function validateArcadeLayout(layout) {
  const errors = [];
  if (!scanSafety(layout, errors)) return done(errors);
  // scanSafety/isPlainData accept null + primitives; require a real object before dereferencing.
  if (!isPlainObject(layout)) {
    errors.push('layout must be a JSON object');
    return done(errors);
  }
  checkForbiddenSurface(layout, errors);

  const bytes = utf8Bytes(canonicalize(layout));
  if (bytes > LIMITS.LAYOUT_BYTES) errors.push(`layout exceeds ${LIMITS.LAYOUT_BYTES} bytes (${bytes})`);

  rejectUnknownKeys(layout, LAYOUT_TOP_KEYS, 'layout', errors);
  requireKeys(layout, LAYOUT_REQUIRED_KEYS, 'layout', errors);

  if (layout.schema_version !== SCHEMA_VERSION) errors.push(`schema_version must be ${SCHEMA_VERSION}`);
  if (layout.asset_kind !== LAYOUT_KIND) errors.push(`asset_kind must be "${LAYOUT_KIND}"`);
  if (typeof layout.layout_id !== 'string' || !ID_RE.test(layout.layout_id) || FORBIDDEN_TERMS_RE.test(layout.layout_id)) {
    errors.push('layout_id must be a clean kebab slug (3..48 chars, no economy terms)');
  }
  if ('display_name' in layout) isCleanText(layout.display_name, LIMITS.NAME_BYTES, 'display_name', errors, { allowEmpty: false });
  if ('theme' in layout) inSet(layout.theme, ENUMS.theme, 'theme', errors);

  // grid
  let cols = 0;
  let rows = 0;
  if (!isPlainObject(layout.grid)) {
    errors.push('grid must be an object { cols, rows }');
  } else {
    rejectUnknownKeys(layout.grid, GRID_KEYS, 'grid', errors);
    cols = layout.grid.cols;
    rows = layout.grid.rows;
    isIntInRange(cols, LIMITS.GRID_MIN, LIMITS.GRID_MAX, 'grid.cols', errors);
    isIntInRange(rows, LIMITS.GRID_MIN, LIMITS.GRID_MAX, 'grid.rows', errors);
  }
  const C = Number.isInteger(cols) ? cols : LIMITS.GRID_MAX;
  const R = Number.isInteger(rows) ? rows : LIMITS.GRID_MAX;

  // floor
  if (!isPlainObject(layout.floor)) {
    errors.push('floor must be an object { material }');
  } else {
    rejectUnknownKeys(layout.floor, FLOOR_KEYS, 'floor', errors);
    inSet(layout.floor.material, ENUMS.floorMaterial, 'floor.material', errors);
  }

  // walls
  if ('walls' in layout) {
    const walls = validateArray(layout.walls, 'walls', LIMITS.MAX_WALLS, errors);
    (walls || []).forEach((w, i) => {
      const at = `walls[${i}]`;
      if (!isPlainObject(w)) return void errors.push(`${at} must be an object`);
      rejectUnknownKeys(w, WALL_KEYS, at, errors);
      requireKeys(w, WALL_KEYS, at, errors);
      inSet(w.material, ENUMS.wallMaterial, `${at}.material`, errors);
      inSet(w.orientation, ENUMS.facing, `${at}.orientation`, errors);
      inGrid(w.gx, w.gy, C, R, at, errors);
      isIntInRange(w.length, 1, Math.max(C, R), `${at}.length`, errors);
      // origin + extent must stay inside the grid (a wall runs along X for north/south, Z for east/west)
      if (Number.isInteger(w.gx) && Number.isInteger(w.gy) && Number.isInteger(w.length)) {
        if ((w.orientation === 'north' || w.orientation === 'south') && w.gx + w.length > C) errors.push(`${at} extends past the grid edge (gx+length > cols)`);
        if ((w.orientation === 'east' || w.orientation === 'west') && w.gy + w.length > R) errors.push(`${at} extends past the grid edge (gy+length > rows)`);
      }
    });
  }

  // entrances
  if ('entrances' in layout) {
    const ents = validateArray(layout.entrances, 'entrances', LIMITS.MAX_WALLS, errors);
    (ents || []).forEach((e, i) => {
      const at = `entrances[${i}]`;
      if (!isPlainObject(e)) return void errors.push(`${at} must be an object`);
      rejectUnknownKeys(e, ENTRANCE_KEYS, at, errors);
      requireKeys(e, ENTRANCE_KEYS, at, errors);
      inSet(e.style, ENUMS.entranceStyle, `${at}.style`, errors);
      inSet(e.facing, ENUMS.facing, `${at}.facing`, errors);
      inGrid(e.gx, e.gy, C, R, at, errors);
    });
  }

  // props
  if ('props' in layout) {
    const props = validateArray(layout.props, 'props', LIMITS.MAX_PROPS, errors);
    (props || []).forEach((p, i) => {
      const at = `props[${i}]`;
      if (!isPlainObject(p)) return void errors.push(`${at} must be an object`);
      rejectUnknownKeys(p, PROP_KEYS, at, errors);
      requireKeys(p, PROP_KEYS, at, errors);
      inSet(p.type, ENUMS.propType, `${at}.type`, errors);
      inSet(p.rotation, ENUMS.rotation, `${at}.rotation`, errors);
      isIntInRange(p.layer, 0, LIMITS.MAX_LAYER, `${at}.layer`, errors);
      inGrid(p.gx, p.gy, C, R, at, errors);
    });
  }

  // signs
  if ('signs' in layout) {
    const signs = validateArray(layout.signs, 'signs', LIMITS.MAX_SIGNS, errors);
    (signs || []).forEach((s, i) => {
      const at = `signs[${i}]`;
      if (!isPlainObject(s)) return void errors.push(`${at} must be an object`);
      rejectUnknownKeys(s, SIGN_KEYS, at, errors);
      requireKeys(s, ['style', 'placement', 'gx', 'gy', 'palette'], at, errors);
      inSet(s.style, ENUMS.signStyle, `${at}.style`, errors);
      inSet(s.placement, ENUMS.signPlacement, `${at}.placement`, errors);
      inSet(s.palette, ENUMS.palette, `${at}.palette`, errors);
      if ('text' in s) isCleanText(s.text, LIMITS.MARQUEE_BYTES, `${at}.text`, errors);
      inGrid(s.gx, s.gy, C, R, at, errors);
    });
  }

  // cabinets (inline blocks; unique cells)
  if ('cabinets' in layout) {
    const cabs = validateArray(layout.cabinets, 'cabinets', LIMITS.MAX_CABINETS, errors);
    const seen = new Set();
    (cabs || []).forEach((c, i) => {
      const at = `cabinets[${i}]`;
      if (!isPlainObject(c)) return void errors.push(`${at} must be an object`);
      rejectUnknownKeys(c, CABINET_PLACEMENT_KEYS, at, errors);
      requireKeys(c, ['cabinet', 'gx', 'gy', 'rotation', 'layer'], at, errors);
      if (isPlainObject(c.cabinet)) validateCabinetBlock(c.cabinet, `${at}.cabinet`, errors);
      else errors.push(`${at}.cabinet must be an object`);
      if ('source_hash' in c && !(typeof c.source_hash === 'string' && HASH_RE.test(c.source_hash))) {
        errors.push(`${at}.source_hash must match sha256:<64hex>`);
      }
      inSet(c.rotation, ENUMS.rotation, `${at}.rotation`, errors);
      isIntInRange(c.layer, 0, LIMITS.MAX_LAYER, `${at}.layer`, errors);
      if (inGrid(c.gx, c.gy, C, R, at, errors)) {
        const cell = `${c.gx},${c.gy}`;
        if (seen.has(cell)) errors.push(`${at} duplicate cabinet cell (${cell})`);
        else seen.add(cell);
      }
    });
  }

  // zones
  if ('zones' in layout) {
    const zones = validateArray(layout.zones, 'zones', LIMITS.MAX_ZONES, errors);
    (zones || []).forEach((z, i) => {
      const at = `zones[${i}]`;
      if (!isPlainObject(z)) return void errors.push(`${at} must be an object`);
      rejectUnknownKeys(z, ZONE_KEYS, at, errors);
      requireKeys(z, ['kind', 'preset', 'gx', 'gy', 'cols', 'rows'], at, errors);
      const kindOk = inSet(z.kind, ENUMS.zoneKind, `${at}.kind`, errors);
      if (kindOk) {
        const presets = z.kind === 'lighting' ? ENUMS.lightingZonePreset : ENUMS.ambienceZonePreset;
        inSet(z.preset, presets, `${at}.preset`, errors);
      }
      if ('palette' in z) inSet(z.palette, ENUMS.palette, `${at}.palette`, errors);
      if ('intensity' in z) inSet(z.intensity, ENUMS.intensity, `${at}.intensity`, errors);
      isIntInRange(z.cols, 1, C, `${at}.cols`, errors);
      isIntInRange(z.rows, 1, R, `${at}.rows`, errors);
      inGrid(z.gx, z.gy, C, R, at, errors);
      // origin + footprint must stay inside the grid
      if (Number.isInteger(z.gx) && Number.isInteger(z.cols) && z.gx + z.cols > C) errors.push(`${at} footprint extends past the grid edge (gx+cols > cols)`);
      if (Number.isInteger(z.gy) && Number.isInteger(z.rows) && z.gy + z.rows > R) errors.push(`${at} footprint extends past the grid edge (gy+rows > rows)`);
    });
  }

  // lighting
  if ('lighting' in layout) {
    if (!isPlainObject(layout.lighting)) errors.push('lighting must be an object');
    else {
      rejectUnknownKeys(layout.lighting, LIGHTING_KEYS, 'lighting', errors);
      if ('ambient' in layout.lighting) inSet(layout.lighting.ambient, ENUMS.palette, 'lighting.ambient', errors);
      if ('accent' in layout.lighting) inSet(layout.lighting.accent, ENUMS.palette, 'lighting.accent', errors);
      if ('intensity' in layout.lighting) inSet(layout.lighting.intensity, ENUMS.intensity, 'lighting.intensity', errors);
      if ('bloom' in layout.lighting && typeof layout.lighting.bloom !== 'boolean') errors.push('lighting.bloom must be a boolean');
    }
  }

  // effects
  if ('effects' in layout) {
    if (!isPlainObject(layout.effects)) errors.push('effects must be an object');
    else {
      rejectUnknownKeys(layout.effects, EFFECTS_KEYS, 'effects', errors);
      if ('screen_shake' in layout.effects) inSet(layout.effects.screen_shake, ENUMS.screenShake, 'effects.screen_shake', errors);
      if ('particle' in layout.effects) inSet(layout.effects.particle, ENUMS.particle, 'effects.particle', errors);
    }
  }

  // metadata
  if ('metadata' in layout) {
    if (!isPlainObject(layout.metadata)) errors.push('metadata must be an object');
    else {
      rejectUnknownKeys(layout.metadata, METADATA_KEYS, 'metadata', errors);
      if ('tags' in layout.metadata) {
        if (!Array.isArray(layout.metadata.tags) || layout.metadata.tags.length > LIMITS.MAX_TAGS) {
          errors.push(`metadata.tags must be an array of <= ${LIMITS.MAX_TAGS} tags`);
        } else {
          layout.metadata.tags.forEach((t, i) => {
            if (typeof t !== 'string' || !TAG_RE.test(t) || FORBIDDEN_TERMS_RE.test(t)) {
              errors.push(`metadata.tags[${i}] must be a clean kebab tag`);
            }
          });
        }
      }
      if ('note' in layout.metadata) isCleanText(layout.metadata.note, LIMITS.NOTE_BYTES, 'metadata.note', errors);
    }
  }

  checkRequiredConstraints(layout.constraints, errors);
  return done(errors);
}

function done(errors) {
  return { ok: errors.length === 0, errors, kind: LAYOUT_KIND };
}
