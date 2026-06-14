/**
 * Shared safety primitives — PURE, cross-env (Node + browser), no Three.js.
 *
 * This mirrors the established CloveLearn creator pipeline (arcade/creator/validator/
 * validation-report.mjs) so the 3D studio inherits the SAME deny-by-default surface that the 2D
 * pipeline already enforces: no code/markup/URL/template content in any string, no economy/
 * ownership/gambling vocabulary in public-facing ids/names, no private/identity keys, and no
 * non-plain JSON data. Validators layer kind-specific rules on top of these.
 */

/** UTF-8 byte length, env-agnostic. */
export function utf8Bytes(str) {
  return typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(str).length
    : Buffer.byteLength(str, 'utf8');
}

/** Strictly JSON-plain data? Rejects functions, class instances, NaN/Infinity, over-nesting, over-width. */
export function isPlainData(v, depth = 0) {
  if (depth > 8) return false;
  if (v === null) return true;
  const t = typeof v;
  if (t === 'string' || t === 'boolean') return true;
  if (t === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.length <= 4096 && v.every((x) => isPlainData(x, depth + 1));
  if (t === 'object') {
    const p = Object.getPrototypeOf(v);
    if (p !== Object.prototype && p !== null) return false;
    const keys = Object.keys(v);
    return keys.length <= 256 && keys.every((k) => isPlainData(v[k], depth + 1));
  }
  return false;
}

/** Anything resembling code, markup, a URL, or a template — banned from EVERY string field. */
export const FORBIDDEN_CONTENT_RE =
  /(<\/?[a-z!]|on\w+\s*=|https?:|wss?:|data:|blob:|javascript:|vbscript:|file:|\$\{|=>|<%|%>|\bfunction\b|\beval\b|new\s+Function|import\s*\(|require\s*\(|;\s*\}|`)/i;

/** Economy / ownership / gambling vocabulary — banned from public-facing ids/names/text. */
export const FORBIDDEN_TERMS_RE =
  /\b(buy|sell|trade|rent|rental|own|owner|ownership|profit|payout|payment|wager|bet|loot|raid|steal|stake|staking|yield|crypto|token|nft|market|marketplace|landlord|tenant|income|cashout|cash-?out|jackpot|multiplier|withdraw|price|for\s*sale|airdrop|mint)\b/i;

/**
 * Normalize a string VALUE before forbidden-pattern matching. NFKC folds compatibility / fullwidth /
 * ligature / circled code points onto their canonical ASCII (e.g. `ｂｕｙ`→`buy`, `ｊａｃｋｐｏｔ`→`jackpot`),
 * so evasion via lookalike Unicode cannot slip economy/markup/url terms past the deny regexes.
 * Lowercased for consistency. NFKC is a no-op on plain ASCII, so existing matches are preserved
 * exactly — this only TIGHTENS detection. Used for MATCHING only; stored/exported text is never rewritten.
 */
export function normalizeForMatch(value) {
  return typeof value === 'string' ? value.normalize('NFKC').toLowerCase() : value;
}

/** Keys implying private data / identity — have no place in a public, shareable asset. */
export const FORBIDDEN_PRIVATE_KEY_RE =
  /(player_?id|account|email|secret|session|connection|\bip\b|geo|balance|ledger|inventory|password|auth|wallet)/i;

/**
 * Forbidden CAPABILITY flag names. If ANY of these appear as a key anywhere in an asset/layout,
 * the asset fails closed — regardless of the value. These are the dangerous surfaces the goal
 * explicitly forbids (live-world, tickets/prizes/ledger, upload/remote-submit, arbitrary script,
 * external assets), plus the pipeline's existing capability vocabulary.
 */
export const FORBIDDEN_CAPABILITY_KEYS = Object.freeze([
  'live_world_authorized',
  'live_world_load',
  'ticket_hooks',
  'prize_hooks',
  'ledger_hooks',
  'reward_hooks',
  'economy_hooks',
  'ownership',
  'upload_enabled',
  'remote_submit',
  'arbitrary_script',
  'arbitrary_code',
  'external_asset_url',
  'external_assets',
  'network',
  'dom_escape',
]);
const FORBIDDEN_CAPABILITY_SET = new Set(FORBIDDEN_CAPABILITY_KEYS);

export function eachString(v, fn, path = '$') {
  if (typeof v === 'string') {
    fn(v, path);
    return;
  }
  if (Array.isArray(v)) {
    v.forEach((x, i) => eachString(x, fn, `${path}[${i}]`));
    return;
  }
  if (v && typeof v === 'object') for (const k of Object.keys(v)) eachString(v[k], fn, `${path}.${k}`);
}

export function eachKey(v, fn, path = '$') {
  if (Array.isArray(v)) {
    v.forEach((x, i) => eachKey(x, fn, `${path}[${i}]`));
    return;
  }
  if (v && typeof v === 'object')
    for (const k of Object.keys(v)) {
      fn(k, `${path}.${k}`);
      eachKey(v[k], fn, `${path}.${k}`);
    }
}

/**
 * Deep-safety scan applied to every asset before kind-specific checks. Pushes into `errors` and
 * returns false on any violation. Catches code/markup/url/template content, private/identity keys,
 * and forbidden capability keys ANYWHERE in the object.
 */
export function scanSafety(obj, errors) {
  if (!isPlainData(obj)) {
    errors.push('not plain JSON data (functions, class instances, NaN/Infinity, or too large)');
    return false;
  }
  let bad = null;
  eachString(obj, (s, p) => {
    if (bad === null && FORBIDDEN_CONTENT_RE.test(normalizeForMatch(s))) bad = p;
  });
  if (bad) errors.push(`forbidden content (code/markup/url/template) at ${bad}`);

  let badKey = null;
  let badCap = null;
  eachKey(obj, (k, p) => {
    if (badKey === null && FORBIDDEN_PRIVATE_KEY_RE.test(k)) badKey = p;
    if (badCap === null && FORBIDDEN_CAPABILITY_SET.has(k)) badCap = `${p} (${k})`;
  });
  if (badKey) errors.push(`private/identity key at ${badKey}`);
  if (badCap) errors.push(`forbidden capability key at ${badCap}`);

  return !bad && !badKey && !badCap;
}

/** True only for a real, prototype-clean plain object (not array, not null). */
export function isPlainObject(o) {
  return !!o && typeof o === 'object' && !Array.isArray(o) && Object.getPrototypeOf(o) === Object.prototype;
}

/** Push an "unknown key" error for any key not in `allowed`. */
export function rejectUnknownKeys(obj, allowed, at, errors) {
  if (!isPlainObject(obj)) {
    errors.push(`${at} must be an object`);
    return false;
  }
  let ok = true;
  for (const k of Object.keys(obj))
    if (!allowed.includes(k)) {
      errors.push(`${at}: unknown key "${k}"`);
      ok = false;
    }
  return ok;
}

/** Require that every key in `required` is present. */
export function requireKeys(obj, required, at, errors) {
  if (!isPlainObject(obj)) return false;
  let ok = true;
  for (const k of required)
    if (!(k in obj)) {
      errors.push(`${at}: missing key "${k}"`);
      ok = false;
    }
  return ok;
}

/** Enum membership check. */
export function inSet(value, set, label, errors) {
  if (!set.includes(value)) {
    errors.push(`${label} must be one of: ${set.join(', ')}`);
    return false;
  }
  return true;
}

/** Bounded, clean text: a string within byte budget, no forbidden content, no economy terms. */
export function isCleanText(value, maxBytes, label, errors, { allowEmpty = true } = {}) {
  if (typeof value !== 'string') {
    errors.push(`${label} must be a string`);
    return false;
  }
  if (!allowEmpty && value.length === 0) {
    errors.push(`${label} must not be empty`);
    return false;
  }
  if (utf8Bytes(value) > maxBytes) {
    errors.push(`${label} exceeds ${maxBytes} bytes`);
    return false;
  }
  const matchable = normalizeForMatch(value);
  if (FORBIDDEN_CONTENT_RE.test(matchable)) {
    errors.push(`${label} contains code/markup/url/template content`);
    return false;
  }
  if (FORBIDDEN_TERMS_RE.test(matchable)) {
    errors.push(`${label} contains a forbidden economy/ownership term`);
    return false;
  }
  return true;
}

/** Integer within inclusive bounds. */
export function isIntInRange(value, min, max, label, errors) {
  if (!(Number.isInteger(value) && value >= min && value <= max)) {
    errors.push(`${label} must be an integer in [${min}, ${max}]`);
    return false;
  }
  return true;
}

/** Finite number within inclusive bounds. */
export function isNumInRange(value, min, max, label, errors) {
  if (!(Number.isFinite(value) && value >= min && value <= max)) {
    errors.push(`${label} must be a number in [${min}, ${max}]`);
    return false;
  }
  return true;
}
