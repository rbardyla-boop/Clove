// Public Arcade v2 — static official-cabinet discovery catalog contract.
// The catalog is read-only presentation metadata for the public discovery surfaces. It must list ONLY
// shipped official cabinets, carry no economy/account vocabulary, and use same-origin relative hrefs.
// Run: node --test tests/arcade/cabinet-catalog.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFICIAL_LIVE_CABINETS, PLAY_ENTRIES, CATALOG_VOCAB,
  liveCabinets, getCabinet, validateCatalog, isSameOriginRelativeHref,
} from '../../arcade/cabinet-catalog.mjs';

test('the catalog validates against its own closed rules', () => {
  const { ok, errors } = validateCatalog();
  assert.equal(ok, true, 'catalog invalid: ' + errors.join('; '));
});

test('the three production-live official cabinets are present', () => {
  const ids = liveCabinets().map((c) => c.id).sort();
  assert.deepEqual(ids, ['neon-grid', 'pulse-tap', 'signal-sprint']);
  for (const c of OFFICIAL_LIVE_CABINETS) {
    assert.equal(c.status, 'live');
    assert.equal(c.source, 'official'); // never a creator/local-maker package
    assert.ok(c.label && c.tagline && c.input_hint, `${c.id} has presentation copy`);
  }
});

test('getCabinet resolves ids and returns null for unknown', () => {
  assert.equal(getCabinet('pulse-tap').label, 'Pulse Tap');
  assert.equal(getCabinet('does-not-exist'), null);
});

test('NO economy / account / publish vocabulary anywhere in the catalog', () => {
  // a catalog that ever implies tickets-as-money, ownership, sale, accounts, or publishing is a boundary
  // regression — the validator rejects it, and we also assert the raw text directly here.
  const raw = JSON.stringify({ OFFICIAL_LIVE_CABINETS, PLAY_ENTRIES });
  assert.doesNotMatch(raw, /\b(buy|sell|sale|rent|cash|payout|coin|token|crypto|nft|wallet|purchase|marketplace|account|login|upload|publish|redeem|ledger)\b/i);
  // a deliberately economy-tainted entry must FAIL validateCatalog
  const tainted = [{ ...OFFICIAL_LIVE_CABINETS[0], tagline: 'buy more coins to win' }];
  assert.equal(validateCatalog(tainted).ok, false);
});

test('play entries are same-origin relative paths (no external links, no absolute roots)', () => {
  assert.ok(PLAY_ENTRIES.length >= 1);
  for (const e of PLAY_ENTRIES) {
    assert.doesNotMatch(e.href, /^(?:[a-z]+:)?\/\//i, `${e.href} is not external`);
    assert.ok(!e.href.startsWith('/'), `${e.href} is relative (not absolute-root)`);
    assert.equal(isSameOriginRelativeHref(e.href), true, `${e.href} is a safe same-origin relative path`);
  }
  // a tainted (external) entry must FAIL validation
  assert.equal(validateCatalog(OFFICIAL_LIVE_CABINETS, [{ href: 'https://evil.example', label: 'x' }]).ok, false);
});

test('href guard is fail-closed: rejects scheme-only (javascript:/data:/vbscript:), external + absolute hrefs', () => {
  // Hardening for the PR #99 LOW: the old protocol-relative check (`//`) let scheme-only URIs through.
  // The guard now rejects ANY URI scheme, so XSS-bearing href schemes can never reach a catalog consumer.
  const UNSAFE = [
    'javascript:alert(1)',
    'JavaScript:alert(1)', // case-insensitive
    'data:text/html,<svg/onload=alert(1)>',
    'vbscript:msgbox(1)',
    'https://evil.example',
    'http://evil.example/path',
    '//evil.example/path', // protocol-relative
    '/account', // absolute-root
    'mailto:x@y.z',
    '\\\\evil.example', // backslash protocol-relative
    '', // empty
  ];
  for (const href of UNSAFE) {
    assert.equal(isSameOriginRelativeHref(href), false, `must reject unsafe href: ${JSON.stringify(href)}`);
    // and a play entry carrying it must FAIL the whole catalog validation (non-vacuous)
    assert.equal(
      validateCatalog(OFFICIAL_LIVE_CABINETS, [{ href, label: 'x' }]).ok,
      false,
      `validateCatalog must reject entry href: ${JSON.stringify(href)}`,
    );
  }
  // the real relative hrefs the catalog actually uses still PASS (no regression)
  for (const href of ['arcade/', 'arcade/city/', 'arcade/city/index.html', 'pulse-tap']) {
    assert.equal(isSameOriginRelativeHref(href), true, `safe relative href must pass: ${href}`);
  }
  // a colon AFTER the first path segment is not a scheme (RFC 3986) and stays allowed
  assert.equal(isSameOriginRelativeHref('arcade/city:foo'), true);
});

test('href guard rejects whitespace / control-char scheme bypasses (PR #100 M1)', () => {
  // Browsers strip leading whitespace and intra-token C0 controls (TAB/LF/CR/NUL) before parsing, so these
  // would normalize back into an active javascript:/data:/vbscript: scheme. The guard must reject them
  // outright. Each is asserted through BOTH isSameOriginRelativeHref() and full validateCatalog() (non-vacuous).
  const BYPASS = [
    ' javascript:alert(1)', // leading space
    '\tjavascript:alert(1)', // leading TAB
    '\njavascript:alert(1)', // leading LF
    '\rjavascript:alert(1)', // leading CR
    '\u0000javascript:alert(1)', // leading NUL
    'java\tscript:alert(1)', // TAB inside the scheme
    'java\nscript:alert(1)', // LF inside the scheme
    'data\t:text/html,<svg/onload=alert(1)>', // TAB before the scheme colon
    'vbscript\n:msgbox(1)', // LF before the scheme colon
    'javascript:alert(1) ', // trailing space
    '\u007fjavascript:alert(1)', // leading DEL
    '\u0085javascript:alert(1)', // leading C1 (NEL)
  ];
  for (const href of BYPASS) {
    assert.equal(isSameOriginRelativeHref(href), false, `must reject whitespace/control bypass: ${JSON.stringify(href)}`);
    assert.equal(
      validateCatalog(OFFICIAL_LIVE_CABINETS, [{ href, label: 'x' }]).ok,
      false,
      `validateCatalog must reject bypass href: ${JSON.stringify(href)}`,
    );
  }
  // real relative hrefs (no whitespace/control chars) are unaffected
  for (const href of ['arcade/', 'arcade/city/', 'arcade/city/index.html', 'pulse-tap', 'arcade/city:foo']) {
    assert.equal(isSameOriginRelativeHref(href), true, `safe relative href must still pass: ${href}`);
  }
});

test('genre tags come only from the closed vocabulary', () => {
  for (const c of OFFICIAL_LIVE_CABINETS) {
    for (const g of c.genre_tags) assert.ok(CATALOG_VOCAB.genres.includes(g), `${c.id} genre ${g} is in vocab`);
  }
});
