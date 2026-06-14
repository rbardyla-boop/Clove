/**
 * Validator for an ARCADE CABINET ASSET — PURE, cross-env, no Three.js. Deny-by-default.
 *
 * Order of checks: plain-data + deep safety scan → forbidden-surface scan → byte budget → strict
 * top keys → identity → id/name text → cabinet block (closed enums) → effects → metadata →
 * required safety constraints. Returns { ok, errors, kind }. Never throws on hostile input.
 */

import {
  ASSET_KIND, SCHEMA_VERSION, LIMITS, ID_RE, TAG_RE,
} from './tokens.js';
import {
  ASSET_TOP_KEYS, ASSET_REQUIRED_KEYS, CABINET_KEYS, CABINET_REQUIRED_KEYS, CABINET_ENUMS,
  EFFECTS_KEYS, EFFECTS_ENUMS, METADATA_KEYS,
} from './ArcadeAssetSchema.js';
import {
  scanSafety, rejectUnknownKeys, requireKeys, inSet, isCleanText, isPlainObject,
  utf8Bytes, FORBIDDEN_TERMS_RE,
} from './safety.js';
import { checkForbiddenSurface, checkRequiredConstraints } from './forbiddenSurfaceChecks.js';
import { canonicalize } from '../importExport/hashAsset.js';

/** Validate a cabinet sub-object (shared by the asset validator and the layout validator). */
export function validateCabinetBlock(cab, at, errors) {
  if (!isPlainObject(cab)) {
    errors.push(`${at} must be an object`);
    return false;
  }
  rejectUnknownKeys(cab, CABINET_KEYS, at, errors);
  requireKeys(cab, CABINET_REQUIRED_KEYS, at, errors);
  for (const field of Object.keys(CABINET_ENUMS)) {
    if (field in cab) inSet(cab[field], CABINET_ENUMS[field], `${at}.${field}`, errors);
  }
  if ('marquee_text' in cab) {
    isCleanText(cab.marquee_text, LIMITS.MARQUEE_BYTES, `${at}.marquee_text`, errors);
  }
  return true;
}

/** Validate the optional effects block (screen_shake + particle tokens). */
export function validateEffectsBlock(fx, at, errors) {
  if (!isPlainObject(fx)) {
    errors.push(`${at} must be an object`);
    return false;
  }
  rejectUnknownKeys(fx, EFFECTS_KEYS, at, errors);
  for (const field of EFFECTS_KEYS) {
    if (field in fx) inSet(fx[field], EFFECTS_ENUMS[field], `${at}.${field}`, errors);
  }
  return true;
}

/** Validate the optional metadata block (bounded clean tags + note). */
export function validateMetadataBlock(meta, at, errors) {
  if (!isPlainObject(meta)) {
    errors.push(`${at} must be an object`);
    return false;
  }
  rejectUnknownKeys(meta, METADATA_KEYS, at, errors);
  if ('tags' in meta) {
    if (!Array.isArray(meta.tags) || meta.tags.length > LIMITS.MAX_TAGS) {
      errors.push(`${at}.tags must be an array of <= ${LIMITS.MAX_TAGS} tags`);
    } else {
      meta.tags.forEach((t, i) => {
        if (typeof t !== 'string' || !TAG_RE.test(t) || FORBIDDEN_TERMS_RE.test(t)) {
          errors.push(`${at}.tags[${i}] must be a clean kebab tag (no economy terms)`);
        }
      });
    }
  }
  if ('note' in meta) isCleanText(meta.note, LIMITS.NOTE_BYTES, `${at}.note`, errors);
  return true;
}

export function validateArcadeAsset(asset) {
  const errors = [];
  if (!scanSafety(asset, errors)) return done(errors);
  // scanSafety/isPlainData accept null + primitives; require a real object before dereferencing.
  if (!isPlainObject(asset)) {
    errors.push('asset must be a JSON object');
    return done(errors);
  }
  checkForbiddenSurface(asset, errors);

  const bytes = utf8Bytes(canonicalize(asset));
  if (bytes > LIMITS.ASSET_BYTES) errors.push(`asset exceeds ${LIMITS.ASSET_BYTES} bytes (${bytes})`);

  rejectUnknownKeys(asset, ASSET_TOP_KEYS, 'asset', errors);
  requireKeys(asset, ASSET_REQUIRED_KEYS, 'asset', errors);

  if (asset.schema_version !== SCHEMA_VERSION) errors.push(`schema_version must be ${SCHEMA_VERSION}`);
  if (asset.asset_kind !== ASSET_KIND) errors.push(`asset_kind must be "${ASSET_KIND}"`);

  if (typeof asset.asset_id !== 'string' || !ID_RE.test(asset.asset_id) || FORBIDDEN_TERMS_RE.test(asset.asset_id)) {
    errors.push('asset_id must be a clean kebab slug (3..48 chars, no economy terms)');
  }
  if ('display_name' in asset) {
    isCleanText(asset.display_name, LIMITS.NAME_BYTES, 'display_name', errors, { allowEmpty: false });
  }

  if (isPlainObject(asset.cabinet)) validateCabinetBlock(asset.cabinet, 'cabinet', errors);
  else errors.push('cabinet block missing or not an object');

  if ('effects' in asset) validateEffectsBlock(asset.effects, 'effects', errors);
  if ('metadata' in asset) validateMetadataBlock(asset.metadata, 'metadata', errors);

  checkRequiredConstraints(asset.constraints, errors);

  return done(errors);
}

function done(errors) {
  return { ok: errors.length === 0, errors, kind: ASSET_KIND };
}
