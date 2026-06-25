// Public Arcade v2 — static official-cabinet discovery catalog contract.
// The catalog is read-only presentation metadata for the public discovery surfaces. It must list ONLY
// shipped official cabinets, carry no economy/account vocabulary, and use same-origin relative hrefs.
// Run: node --test tests/arcade/cabinet-catalog.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFICIAL_LIVE_CABINETS, PLAY_ENTRIES, CATALOG_VOCAB,
  liveCabinets, getCabinet, validateCatalog,
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
  }
  // a tainted (external) entry must FAIL validation
  assert.equal(validateCatalog(OFFICIAL_LIVE_CABINETS, [{ href: 'https://evil.example', label: 'x' }]).ok, false);
});

test('genre tags come only from the closed vocabulary', () => {
  for (const c of OFFICIAL_LIVE_CABINETS) {
    for (const g of c.genre_tags) assert.ok(CATALOG_VOCAB.genres.includes(g), `${c.id} genre ${g} is in vocab`);
  }
});
