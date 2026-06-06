/**
 * Creator Foundation CF-1 — shared validation primitives + report/receipt, PURE + cross-env.
 *
 * Low-level safety scans reused by both package validators, plus the canonical report shape and the
 * approval-receipt STUB. The receipt is explicitly `local_validation_only` with
 * `live_world_authorized: false` — CF-1 never claims a package is approved for the live world.
 */

/** UTF-8 byte length, env-agnostic. */
export function utf8Bytes(str) {
  return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(str).length : Buffer.byteLength(str, 'utf8');
}

/** PURE: strictly JSON-plain data? Rejects functions, class instances, NaN/Infinity, over-nesting. */
export function isPlainData(v, depth = 0) {
  if (depth > 8) return false;
  if (v === null) return true;
  const t = typeof v;
  if (t === 'string' || t === 'boolean') return true;
  if (t === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.length <= 64 && v.every((x) => isPlainData(x, depth + 1));
  if (t === 'object') {
    const p = Object.getPrototypeOf(v);
    if (p !== Object.prototype && p !== null) return false;
    const keys = Object.keys(v);
    return keys.length <= 64 && keys.every((k) => isPlainData(v[k], depth + 1));
  }
  return false;
}

/** Anything resembling code, markup, a URL, or a template — banned from EVERY string field. */
export const FORBIDDEN_CONTENT_RE = /(<\/?[a-z!]|on\w+\s*=|https?:|data:|blob:|javascript:|vbscript:|file:|\$\{|=>|<%|%>|\bfunction\b|\beval\b|new\s+Function|import\s*\(|;\s*\}|`)/i;
/** Economy / ownership / gambling vocabulary — banned from public-facing ids/names. */
export const FORBIDDEN_TERMS_RE = /\b(buy|sell|trade|rent|rental|own|owner|ownership|profit|payout|payment|wager|bet|loot|raid|steal|stake|staking|yield|crypto|token|nft|market|marketplace|landlord|tenant|income|cashout|cash-?out|jackpot|multiplier|boost|boosted|reward|earn|prize|bonus|withdraw|price|for\s*sale)\b/i;
/** Keys implying private data / identity — have no place in a public package. */
export const FORBIDDEN_PRIVATE_KEY_RE = /(player_?id|account|email|secret|session|connection|\bip\b|geo|balance|ledger|inventory|password|auth)/i;

export function eachString(v, fn, path = '$') {
  if (typeof v === 'string') { fn(v, path); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => eachString(x, fn, `${path}[${i}]`)); return; }
  if (v && typeof v === 'object') for (const k of Object.keys(v)) eachString(v[k], fn, `${path}.${k}`);
}
export function eachKey(v, fn, path = '$') {
  if (Array.isArray(v)) { v.forEach((x, i) => eachKey(x, fn, `${path}[${i}]`)); return; }
  if (v && typeof v === 'object') for (const k of Object.keys(v)) { fn(k, `${path}.${k}`); eachKey(v[k], fn, `${path}.${k}`); }
}

/**
 * PURE: shared deep-safety scan applied to every package before kind-specific checks.
 * Pushes into `errors` and returns false on any violation. Catches code/markup/url/template
 * content and private/identity keys ANYWHERE in the package.
 */
export function scanSafety(pkg, errors) {
  let bad = null;
  eachString(pkg, (s, p) => { if (bad === null && FORBIDDEN_CONTENT_RE.test(s)) bad = `${p}`; });
  if (bad) { errors.push(`forbidden content (code/markup/url/template) at ${bad}`); }
  let badKey = null;
  eachKey(pkg, (k, p) => { if (badKey === null && FORBIDDEN_PRIVATE_KEY_RE.test(k)) badKey = `${p}`; });
  if (badKey) { errors.push(`private/identity key at ${badKey}`); }
  return !bad && !badKey;
}

/**
 * PURE: assemble the canonical validation report. `packageHash` is the caller-computed
 * `sha256:...` over canonical bytes. The receipt is always a LOCAL stub — never live authority.
 */
export function buildValidationReport({ validation, packageHash, now = Date.now() }) {
  return {
    ok: validation.ok,
    package_hash: packageHash,
    package_kind: validation.package_kind,
    errors: validation.errors,
    warnings: validation.warnings,
    limits: validation.limits,
    receipt: {
      status: 'local_validation_only',
      live_world_authorized: false,
      generated_at: new Date(now).toISOString(),
    },
  };
}
