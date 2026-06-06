/**
 * Creator Foundation CF-1 — Arcade Game Package validator, PURE + cross-env.
 *
 * Validates a cabinet package MANIFEST: strict keys, approved frame contract, safe relative module
 * filenames, EMPTY assets (no bundled/external assets in v1), DENY-BY-DEFAULT capabilities, and a
 * declared size budget within [MIN, MAX]. The on-disk file total vs the declared budget is enforced
 * separately by size-budget.mjs. NO I/O here. Changes no server authority / ticket formula.
 */
import {
  PACKAGE_KIND, SCHEMA_VERSION, SIZE_BUDGET_MAX_BYTES, SIZE_BUDGET_MIN_BYTES,
  PACKAGE_ID_RE, DISPLAY_NAME_MAX, MODULE_FILE_RE, FRAME_CONTRACTS, ALLOWED_CAPABILITIES,
  ALLOWED_TOP_KEYS, REQUIRED_TOP_KEYS,
} from '../schemas/arcade-game-package-schema.mjs';
import { canonicalize } from './package-hash.mjs';
import { isPlainData, utf8Bytes, scanSafety, FORBIDDEN_TERMS_RE, FORBIDDEN_CONTENT_RE } from './validation-report.mjs';

export function validateArcadePackage(pkg) {
  const errors = [];
  const warnings = [];
  const limits = { size_bytes: 0, size_budget_bytes: 0 };

  if (!isPlainData(pkg) || typeof pkg !== 'object' || Array.isArray(pkg)) {
    errors.push('package is not plain JSON data');
    return done(errors, warnings, limits);
  }
  limits.size_bytes = utf8Bytes(canonicalize(pkg));   // manifest size (file total is checked by size-budget.mjs)
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
  if (!FRAME_CONTRACTS.includes(pkg.frame_contract_id)) errors.push(`frame_contract_id must be one of ${FRAME_CONTRACTS.join('|')}`);
  if (!(typeof pkg.entry === 'string' && MODULE_FILE_RE.test(pkg.entry))) errors.push('entry must be a safe relative *.mjs filename');
  if (!(typeof pkg.adapter === 'string' && MODULE_FILE_RE.test(pkg.adapter))) errors.push('adapter must be a safe relative *.mjs filename');

  // assets: empty in v1 (no bundled or external assets yet).
  if (!Array.isArray(pkg.assets)) errors.push('assets must be an array');
  else if (pkg.assets.length > 0) errors.push('assets must be empty in CF-1 (no bundled/external assets)');

  // capabilities: deny-by-default — anything not in the (empty) allowlist fails.
  if (!Array.isArray(pkg.capabilities)) errors.push('capabilities must be an array');
  else {
    const bad = pkg.capabilities.filter((c) => !ALLOWED_CAPABILITIES.includes(c));
    if (bad.length) errors.push(`capabilities not allowed in CF-1 (deny-by-default): ${bad.join(', ')}`);
  }

  // size budget: a finite number within bounds.
  const b = pkg.size_budget_bytes;
  if (typeof b !== 'number' || !Number.isInteger(b) || b < SIZE_BUDGET_MIN_BYTES || b > SIZE_BUDGET_MAX_BYTES) {
    errors.push(`size_budget_bytes must be an integer ${SIZE_BUDGET_MIN_BYTES}..${SIZE_BUDGET_MAX_BYTES}`);
  } else {
    limits.size_budget_bytes = b;
  }

  return done(errors, warnings, limits);
}

function done(errors, warnings, limits) {
  return { ok: errors.length === 0, package_kind: 'arcade_game', errors, warnings, limits };
}
