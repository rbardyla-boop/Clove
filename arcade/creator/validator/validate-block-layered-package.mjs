/**
 * Creator Foundation CF-3 — Layered Block Package validator, PURE + cross-env.
 *
 * `validateBlockLayeredPackage(pkg)` → { ok, package_kind:'block_layered', errors[], warnings[], limits }.
 * Strict, deny-by-default, closed-allowlist — the same accumulate-then-done shape as the CF-1
 * block_style validator, reusing its safety primitives (isPlainData, utf8Bytes, scanSafety,
 * FORBIDDEN_TERMS_RE, FORBIDDEN_CONTENT_RE) verbatim. Every rule pushes a clear error and continues
 * (no throw), so the report lists ALL problems. NO I/O. The CLI and the editor run this identical logic.
 */
import {
  PACKAGE_KIND, SCHEMA_VERSION, SIZE_BUDGET_BYTES, PACKAGE_ID_RE, DISPLAY_NAME_MAX,
  ALLOWED_TOP_KEYS, REQUIRED_TOP_KEYS, ALLOWED_LAYER_KINDS, REQUIRED_LAYER_KINDS,
  FACADE_KEYS, FACADE_FIELDS, SIGN_KEYS, SIGN_FIELDS, SYMBOL_KEYS, SYMBOL_FIELDS, MAX_SYMBOLS,
  WINDOW_KEYS, WINDOW_FIELDS, ROOF_KEYS, ROOF_FIELDS, ZONE_KEYS, ZONE_FIELDS, MAX_ZONES,
  REQUIRED_CONSTRAINTS, PALETTE_VARIANTS, TARGET_CITY_IDS,
} from '../schemas/block-layered-package-schema.mjs';
import { canonicalize } from './package-hash.mjs';
import { isPlainData, utf8Bytes, scanSafety, FORBIDDEN_TERMS_RE, FORBIDDEN_CONTENT_RE } from './validation-report.mjs';

export function validateBlockLayeredPackage(pkg) {
  const errors = [];
  const warnings = [];
  const limits = { size_bytes: 0, size_budget_bytes: SIZE_BUDGET_BYTES };

  // R1 — plain-data gate (rejects functions/NaN/Infinity/proto chains/over-nesting/>64 arrays).
  if (!isPlainData(pkg) || typeof pkg !== 'object' || Array.isArray(pkg)) {
    errors.push('package is not plain JSON data');
    return done(errors, warnings, limits);
  }
  // R2 — size budget.
  limits.size_bytes = utf8Bytes(canonicalize(pkg));
  if (limits.size_bytes > SIZE_BUDGET_BYTES) errors.push(`oversize: ${limits.size_bytes}B > ${SIZE_BUDGET_BYTES}B`);
  // R3 — deep safety scan (code/markup/url/template anywhere; private/identity keys anywhere).
  scanSafety(pkg, errors);

  // R4 — top keys.
  const keys = Object.keys(pkg);
  const unknown = keys.filter((k) => !ALLOWED_TOP_KEYS.includes(k));
  const missing = REQUIRED_TOP_KEYS.filter((k) => !keys.includes(k));
  if (unknown.length) errors.push(`unknown top key(s): ${unknown.join(', ')}`);
  if (missing.length) errors.push(`missing key(s): ${missing.join(', ')}`);

  // R5 — kind + version.
  if (pkg.package_kind !== PACKAGE_KIND) errors.push(`package_kind must be "${PACKAGE_KIND}"`);
  if (pkg.schema_version !== SCHEMA_VERSION) errors.push(`schema_version must be ${SCHEMA_VERSION}`);

  // R6 — package_id.
  if (!(typeof pkg.package_id === 'string' && PACKAGE_ID_RE.test(pkg.package_id) && !FORBIDDEN_TERMS_RE.test(pkg.package_id))) {
    errors.push('package_id must be a clean kebab slug (3–48, no economy terms)');
  }
  // R7 — display_name (optional).
  if ('display_name' in pkg) {
    const dn = pkg.display_name;
    if (typeof dn !== 'string' || utf8Bytes(dn) > DISPLAY_NAME_MAX) errors.push(`display_name must be a string ≤ ${DISPLAY_NAME_MAX} bytes`);
    else if (FORBIDDEN_CONTENT_RE.test(dn) || FORBIDDEN_TERMS_RE.test(dn)) errors.push('display_name contains forbidden content or economy term');
  }
  // R8 — target_city_id.
  if (!TARGET_CITY_IDS.includes(pkg.target_city_id)) errors.push(`target_city_id must be one of ${TARGET_CITY_IDS.join('|')}`);
  // R9 — palette_variant (optional).
  if ('palette_variant' in pkg && !PALETTE_VARIANTS.includes(pkg.palette_variant)) {
    errors.push(`palette_variant invalid (allowed: ${PALETTE_VARIANTS.join('|')})`);
  }

  // R10–R16 — layers.
  validateLayers(pkg.layers, errors);
  // R17 — constraints.
  validateConstraints(pkg.constraints, errors);

  return done(errors, warnings, limits);
}

function validateLayers(layers, errors) {
  if (!layers || typeof layers !== 'object' || Array.isArray(layers)) { errors.push('layers must be an object'); return; }
  for (const k of Object.keys(layers)) if (!ALLOWED_LAYER_KINDS.includes(k)) errors.push(`layers has unknown key: ${k}`);
  for (const k of REQUIRED_LAYER_KINDS) if (!(k in layers)) errors.push(`layers missing required layer: ${k}`);

  if ('facade' in layers) validateFixedLayer('facade', layers.facade, FACADE_KEYS, FACADE_FIELDS, errors);   // R11
  if ('sign' in layers) validateFixedLayer('sign', layers.sign, SIGN_KEYS, SIGN_FIELDS, errors);             // R12
  if ('symbols' in layers) validateSymbols(layers.symbols, errors);                                          // R13
  if ('windows' in layers) validateFixedLayer('windows', layers.windows, WINDOW_KEYS, WINDOW_FIELDS, errors);// R14
  if ('roof' in layers) validateFixedLayer('roof', layers.roof, ROOF_KEYS, ROOF_FIELDS, errors);             // R15
  if ('lighting_zones' in layers) validateLightingZones(layers.lighting_zones, errors);                      // R16
}

/** A fixed-key layer object: keys must EXACTLY equal `keyList`, each value an allowlisted token. */
function validateFixedLayer(name, obj, keyList, fields, errors) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { errors.push(`${name} must be an object`); return; }
  for (const k of Object.keys(obj)) if (!keyList.includes(k)) errors.push(`${name} has unknown key: ${k}`);
  for (const k of keyList) {
    if (!(k in obj)) { errors.push(`${name} missing key: ${k}`); continue; }
    if (!fields[k].includes(obj[k])) errors.push(`${name}.${k} invalid (allowed: ${fields[k].join('|')})`);
  }
}

function validateSymbols(symbols, errors) {
  if (!Array.isArray(symbols)) { errors.push('symbols must be an array'); return; }
  if (symbols.length > MAX_SYMBOLS) errors.push(`symbols exceeds max (${MAX_SYMBOLS})`);
  symbols.forEach((s, i) => {
    if (!s || typeof s !== 'object' || Array.isArray(s)) { errors.push(`symbols[${i}] must be an object`); return; }
    for (const k of Object.keys(s)) if (!SYMBOL_KEYS.includes(k)) errors.push(`symbols[${i}] has unknown key: ${k}`);
    for (const k of SYMBOL_KEYS) {
      if (!(k in s)) { errors.push(`symbols[${i}] missing key: ${k}`); continue; }
      if (!SYMBOL_FIELDS[k].includes(s[k])) errors.push(`symbols[${i}].${k} invalid (allowed: ${SYMBOL_FIELDS[k].join('|')})`);
    }
  });
}

function validateLightingZones(zones, errors) {
  if (!Array.isArray(zones)) { errors.push('lighting_zones must be an array'); return; }
  if (zones.length < 1 || zones.length > MAX_ZONES) errors.push(`lighting_zones must have 1–${MAX_ZONES} zones`);
  const seen = new Set();
  zones.forEach((z, i) => {
    if (!z || typeof z !== 'object' || Array.isArray(z)) { errors.push(`lighting_zones[${i}] must be an object`); return; }
    for (const k of Object.keys(z)) if (!ZONE_KEYS.includes(k)) errors.push(`lighting_zones[${i}] has unknown key: ${k}`);
    for (const k of ZONE_KEYS) if (!(k in z)) errors.push(`lighting_zones[${i}] missing key: ${k}`);
    if ('zone_id' in z) {
      if (!ZONE_FIELDS.zone_id.includes(z.zone_id)) errors.push(`lighting_zones[${i}].zone_id invalid (allowed: ${ZONE_FIELDS.zone_id.join('|')})`);
      else if (seen.has(z.zone_id)) errors.push(`duplicate lighting zone: ${z.zone_id}`);
      else seen.add(z.zone_id);
    }
    if ('glow' in z && !ZONE_FIELDS.glow.includes(z.glow)) errors.push(`lighting_zones[${i}].glow invalid (allowed: ${ZONE_FIELDS.glow.join('|')})`);
    if ('flicker' in z && z.flicker !== true && z.flicker !== false) errors.push(`lighting_zones[${i}].flicker must be a boolean`);
  });
}

function validateConstraints(c, errors) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) { errors.push('constraints must be an object'); return; }
  for (const k of Object.keys(c)) if (!(k in REQUIRED_CONSTRAINTS)) errors.push(`constraints has unknown key: ${k}`);
  for (const [k, want] of Object.entries(REQUIRED_CONSTRAINTS)) {
    if (c[k] !== want) errors.push(`constraints.${k} must be ${want}`);
  }
}

function done(errors, warnings, limits) {
  return { ok: errors.length === 0, package_kind: 'block_layered', errors, warnings, limits };
}
