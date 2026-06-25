/**
 * Public Arcade v2 — STATIC official-cabinet discovery catalog (PURE, cross-env, no DOM / no network).
 *
 * A single static source of truth for the OFFICIAL, production-live arcade cabinets, used by the public
 * discovery surfaces (whats-live, landing). This is read-only metadata for visitor clarity — it grants no
 * authority. It lists ONLY shipped official cabinets; creator/local-maker packages are NEVER listed here
 * (they are local playtests and must not appear as official discovery entries). No accounts, no economy,
 * no server state: "tickets" are an in-game score, not money — see whats-live "About tickets".
 *
 * Pairs with tests/arcade/cabinet-catalog.test.mjs (shape + forbidden-term + same-origin-href validation).
 */

/** Allowed vocabulary — keeps the catalog closed + lintable. */
export const CATALOG_VOCAB = Object.freeze({
  genres: Object.freeze(['REFLEX', 'RHYTHM', 'LANE', 'COLLECTION', 'PATTERN', 'MEMORY', 'TIMING']),
  statuses: Object.freeze(['live']),
  sources: Object.freeze(['official']),
});

/**
 * The three production-live cabinets. `played_in_world: true` means you play them inside the live arcade
 * (enter the city/floor and step up to the cabinet) — there is no separate per-cabinet page. Fields are
 * presentation-only; nothing here is an authority or an economy hook.
 */
export const OFFICIAL_LIVE_CABINETS = Object.freeze([
  Object.freeze({
    id: 'pulse-tap',
    label: 'Pulse Tap',
    tagline: 'Tap when the ring meets the target.',
    genre_tags: Object.freeze(['REFLEX', 'RHYTHM']),
    input_hint: 'Tap / Space — pointer, keyboard or touch',
    round_seconds: 30,
    status: 'live',
    source: 'official',
    played_in_world: true,
    note: 'Neon rhythm reflex cabinet.',
  }),
  Object.freeze({
    id: 'signal-sprint',
    label: 'Signal Sprint',
    tagline: 'Ride the lane: collect pulses, dodge the static.',
    genre_tags: Object.freeze(['LANE', 'COLLECTION']),
    input_hint: 'Steer left / right — arrows, A/D or touch halves',
    round_seconds: 25,
    status: 'live',
    source: 'official',
    played_in_world: true,
    note: 'Lane-runner: collect + avoid.',
  }),
  Object.freeze({
    id: 'neon-grid',
    label: 'Neon Grid',
    tagline: 'Watch the path light up, then repeat it before time runs out.',
    genre_tags: Object.freeze(['PATTERN', 'MEMORY', 'TIMING']),
    input_hint: 'Tap the cells in order — pointer, keyboard or touch',
    round_seconds: 25,
    status: 'live',
    source: 'official',
    played_in_world: true,
    note: 'Pattern-memory cabinet.',
  }),
]);

/** Where a visitor goes to actually play these (they live inside the shared world). Same-origin only. */
export const PLAY_ENTRIES = Object.freeze([
  Object.freeze({ href: 'arcade/city/', label: 'Enter the city', primary: true }),
  Object.freeze({ href: 'arcade/', label: 'Classic arcade floor', primary: false }),
]);

/** All live cabinets (read-only). */
export function liveCabinets() {
  return OFFICIAL_LIVE_CABINETS.filter((c) => c.status === 'live');
}

/** Look up one cabinet by id, or null. */
export function getCabinet(id) {
  return OFFICIAL_LIVE_CABINETS.find((c) => c.id === id) || null;
}

/**
 * PURE validator — returns { ok, errors }. Used by the unit test (and safe to call anywhere). Enforces:
 * closed vocabulary, unique kebab ids, same-origin relative hrefs only, and NO economy/ownership/account
 * vocabulary anywhere in the catalog (this surface must never imply tickets-as-money / publishing / sale).
 */
const FORBIDDEN_CATALOG_RE = /\b(buy|sell|sale|rent|own(?:ership)?|trade|cash|payout|coin|token|crypto|nft|wallet|price|purchase|marketplace|account|login|sign[- ]?in|upload|publish|reward|prize|redeem|ledger|balance)\b/i;
const ID_RE = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;

/**
 * Fail-closed same-origin guard for static catalog hrefs. The catalog only ever points at LOCAL relative
 * paths (e.g. "arcade/city/"), so the safe rule is: no whitespace/control chars, no URI scheme at all, no
 * absolute-root or protocol-relative path, no backslashes. This rejects scheme-only `javascript:` / `data:` /
 * `vbscript:` URIs (which carry no "//" and so slipped past the old protocol-relative check), external
 * `https://` and protocol-relative `//host` links, and root-absolute `/x` paths — while preserving plain
 * relative paths. A leading colon-before-slash is treated as a scheme per RFC 3986 (a relative-ref's first
 * segment may not contain ":"), so "arcade/city/" passes but "javascript:alert(1)" does not.
 *
 * Whitespace/control-char rejection is load-bearing: browsers strip leading whitespace and intra-token C0
 * controls (TAB/LF/CR/NUL) before parsing, so " javascript:..." and "java\tscript:..." would normalize back
 * into an active scheme. We reject any C0/space/DEL/C1 char (and backslash) outright so the post-strip form
 * can never differ from what we validated.
 */
export function isSameOriginRelativeHref(href) {
  if (typeof href !== 'string' || href === '') return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0020\u007f-\u009f\\]/.test(href)) return false; // C0 controls + space, DEL/C1 controls, backslash
  // scheme = colon appearing before any "/", "?" or "#" (RFC 3986: a relative-ref first segment has no ":")
  if (/^[^/?#]*:/.test(href)) return false; // javascript:, data:, vbscript:, http(s):, mailto:, …
  if (href.startsWith('/')) return false; // absolute-root "/x" and protocol-relative "//host"
  return true;
}

export function validateCatalog(cabinets = OFFICIAL_LIVE_CABINETS, entries = PLAY_ENTRIES) {
  const errors = [];
  const seen = new Set();
  for (const c of cabinets) {
    if (!ID_RE.test(c.id)) errors.push(`bad cabinet id: ${c.id}`);
    if (seen.has(c.id)) errors.push(`duplicate cabinet id: ${c.id}`);
    seen.add(c.id);
    if (!CATALOG_VOCAB.statuses.includes(c.status)) errors.push(`${c.id}: bad status ${c.status}`);
    if (!CATALOG_VOCAB.sources.includes(c.source)) errors.push(`${c.id}: bad source ${c.source}`);
    if (!Array.isArray(c.genre_tags) || c.genre_tags.length === 0) errors.push(`${c.id}: missing genre_tags`);
    for (const g of c.genre_tags || []) if (!CATALOG_VOCAB.genres.includes(g)) errors.push(`${c.id}: unknown genre ${g}`);
    if (!Number.isInteger(c.round_seconds) || c.round_seconds <= 0) errors.push(`${c.id}: bad round_seconds`);
    if (typeof c.label !== 'string' || !c.label) errors.push(`${c.id}: missing label`);
    const blob = `${c.id} ${c.label} ${c.tagline} ${c.input_hint} ${c.note} ${(c.genre_tags || []).join(' ')}`;
    if (FORBIDDEN_CATALOG_RE.test(blob)) errors.push(`${c.id}: forbidden economy/account term in metadata`);
  }
  for (const e of entries) {
    if (!isSameOriginRelativeHref(e.href)) {
      errors.push(`play entry href must be a same-origin relative path: ${e.href}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
