/**
 * Creator Foundation CF-1 — Block Style Package validator, PURE + cross-env.
 *
 * `validateBlockPackage(pkg)` → { ok, package_kind, errors[], warnings[], limits }. Strict,
 * deny-by-default, closed-allowlist. Pair with packageHash + buildValidationReport for the full
 * report. NO I/O. The CLI and the editor run this identical logic.
 */
import {
  PACKAGE_KIND, SCHEMA_VERSION, SIZE_BUDGET_BYTES, PACKAGE_ID_RE, DISPLAY_NAME_MAX,
  ALLOWED_TOP_KEYS, REQUIRED_TOP_KEYS, STYLE_FIELDS, STYLE_KEYS, REQUIRED_CONSTRAINTS, TARGET_CITY_IDS,
} from '../schemas/block-package-schema.mjs';
import { canonicalize } from './package-hash.mjs';
import { isPlainData, utf8Bytes, scanSafety, FORBIDDEN_TERMS_RE, FORBIDDEN_CONTENT_RE } from './validation-report.mjs';

export function validateBlockPackage(pkg) {
  const errors = [];
  const warnings = [];
  const limits = { size_bytes: 0, size_budget_bytes: SIZE_BUDGET_BYTES };

  if (!isPlainData(pkg) || typeof pkg !== 'object' || Array.isArray(pkg)) {
    errors.push('package is not plain JSON data');
    return done('block_style', errors, warnings, limits);
  }
  limits.size_bytes = utf8Bytes(canonicalize(pkg));
  if (limits.size_bytes > SIZE_BUDGET_BYTES) errors.push(`oversize: ${limits.size_bytes}B > ${SIZE_BUDGET_BYTES}B`);
  scanSafety(pkg, errors);

  const keys = Object.keys(pkg);
  const unknown = keys.filter((k) => !ALLOWED_TOP_KEYS.includes(k));
  const missing = REQUIRED_TOP_KEYS.filter((k) => !keys.includes(k));
  if (unknown.length) errors.push(`unknown top key(s): ${unknown.join(', ')}`);
  if (missing.length) errors.push(`missing key(s): ${missing.join(', ')}`);

  if (pkg.package_kind !== PACKAGE_KIND) errors.push(`package_kind must be "${PACKAGE_KIND}"`);
  if (pkg.schema_version !== SCHEMA_VERSION) errors.push(`schema_version must be ${SCHEMA_VERSION}`);
  if (!(typeof pkg.package_id === 'string' && PACKAGE_ID_RE.test(pkg.package_id) && !FORBIDDEN_TERMS_RE.test(pkg.package_id))) {
    errors.push('package_id must be a clean kebab slug (3–48, no economy terms)');
  }
  if ('display_name' in pkg) {
    const dn = pkg.display_name;
    if (typeof dn !== 'string' || utf8Bytes(dn) > DISPLAY_NAME_MAX) errors.push(`display_name must be a string ≤ ${DISPLAY_NAME_MAX} bytes`);
    else if (FORBIDDEN_CONTENT_RE.test(dn) || FORBIDDEN_TERMS_RE.test(dn)) errors.push('display_name contains forbidden content or economy term');
  }
  if (!TARGET_CITY_IDS.includes(pkg.target_city_id)) errors.push(`target_city_id must be one of ${TARGET_CITY_IDS.join('|')}`);

  validateStyle(pkg.style, errors);
  validateConstraints(pkg.constraints, errors);

  return done('block_style', errors, warnings, limits);
}

function validateStyle(style, errors) {
  if (!style || typeof style !== 'object' || Array.isArray(style)) { errors.push('style must be an object'); return; }
  const sk = Object.keys(style);
  for (const k of sk) if (!STYLE_KEYS.includes(k)) errors.push(`style has unknown key: ${k}`);
  for (const k of STYLE_KEYS) {
    if (!(k in style)) { errors.push(`style missing key: ${k}`); continue; }
    if (!STYLE_FIELDS[k].includes(style[k])) errors.push(`style.${k} invalid (allowed: ${STYLE_FIELDS[k].join('|')})`);
  }
}

function validateConstraints(c, errors) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) { errors.push('constraints must be an object'); return; }
  const ck = Object.keys(c);
  for (const k of ck) if (!(k in REQUIRED_CONSTRAINTS)) errors.push(`constraints has unknown key: ${k}`);
  for (const [k, want] of Object.entries(REQUIRED_CONSTRAINTS)) {
    if (c[k] !== want) errors.push(`constraints.${k} must be ${want}`);
  }
}

function done(kind, errors, warnings, limits) {
  return { ok: errors.length === 0, package_kind: kind, errors, warnings, limits };
}
