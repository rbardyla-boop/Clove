import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCleanText, normalizeForMatch } from '../src/validation/safety.js';
import { buildArcadeAsset } from '../src/importExport/exportArcadeAsset.js';
import { buildArcadeLayout } from '../src/importExport/exportArcadeLayout.js';
import { validateArcadeAsset } from '../src/validation/validateArcadeAsset.js';
import { validateArcadeLayout } from '../src/validation/validateArcadeLayout.js';
import { validAssetModel, validLayoutModel } from './fixtures.mjs';

/**
 * Regression for the verified LOW finding: fullwidth / compatibility Unicode must NOT bypass the
 * free-text deny regexes. Before the fix, ASCII `buy`/`jackpot` were blocked but fullwidth `ｂｕｙ`/
 * `ｊａｃｋｐｏｔ` slipped through. NFKC-folding before matching closes the lookalike-evasion class while
 * leaving plain-ASCII behaviour (and valid assets) unchanged.
 */

const clean = (s) => { const e = []; return { ok: isCleanText(s, 64, 'x', e), e }; };

test('isCleanText still rejects ASCII economy terms (no regression)', () => {
  assert.equal(clean('buy here').ok, false);
  assert.equal(clean('jackpot').ok, false);
  assert.equal(clean('for sale').ok, false);
});

test('isCleanText rejects FULLWIDTH economy terms (closes the bypass)', () => {
  assert.equal(clean('ｂｕｙ here').ok, false, 'fullwidth buy must be caught');
  assert.equal(clean('ｊａｃｋｐｏｔ').ok, false, 'fullwidth jackpot must be caught');
  assert.equal(clean('Ｃｒｙｐｔｏ Ｍａｒｋｅｔ').ok, false, 'fullwidth crypto/market must be caught');
});

test('isCleanText rejects FULLWIDTH url/markup evasion (content regex normalized too)', () => {
  assert.equal(clean('ｈｔｔｐｓ：//evil.example/x').ok, false, 'fullwidth https: must be caught');
});

test('isCleanText still accepts safe ordinary text', () => {
  assert.equal(clean('Neon Circuit Hall').ok, true);
  assert.equal(clean('Player One Arcade').ok, true);
  assert.equal(clean('').ok, true); // empty allowed by default
});

test('normalizeForMatch folds fullwidth and is a no-op on ASCII / non-strings', () => {
  assert.equal(normalizeForMatch('buy here'), 'buy here');
  assert.equal(normalizeForMatch('ｊａｃｋｐｏｔ'), 'jackpot');
  assert.equal(normalizeForMatch(42), 42);
});

test('validateArcadeAsset rejects fullwidth economy terms in display_name and marquee_text', () => {
  const a1 = buildArcadeAsset(validAssetModel());
  a1.display_name = 'ｊａｃｋｐｏｔ';
  assert.equal(validateArcadeAsset(a1).ok, false, 'display_name');
  const a2 = buildArcadeAsset(validAssetModel());
  a2.cabinet.marquee_text = 'ｂｕｙ';
  assert.equal(validateArcadeAsset(a2).ok, false, 'marquee_text');
});

test('validateArcadeLayout rejects fullwidth economy terms in sign text and metadata.note', () => {
  const l1 = buildArcadeLayout(validLayoutModel());
  l1.signs[0].text = 'ｊａｃｋｐｏｔ';
  assert.equal(validateArcadeLayout(l1).ok, false, 'sign text');
  const l2 = buildArcadeLayout(validLayoutModel());
  l2.metadata.note = 'ｂｕｙ now';
  assert.equal(validateArcadeLayout(l2).ok, false, 'metadata.note');
});

test('valid asset and layout still pass after normalization (no false positives)', () => {
  assert.equal(validateArcadeAsset(buildArcadeAsset(validAssetModel())).ok, true);
  assert.equal(validateArcadeLayout(buildArcadeLayout(validLayoutModel())).ok, true);
});
