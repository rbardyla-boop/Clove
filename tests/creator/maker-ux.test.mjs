// Maker-UX pass — presentation/regression contract for the builder + sandbox restyle (source-read).
// Pure presentation: this guards the arcade identity + clarity changes AND, critically, that the restyle
// did NOT weaken the load-bearing CSPs or the local-only boundary copy.
// Run: node --test tests/creator/maker-ux.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const BUILDER = read('../../arcade/creator/arcade-builder/index.html');
const SANDBOX = read('../../arcade/creator/arcade-sandbox/index.html');
const FONTS_CSS = read('../../fonts/fonts.css');

const VENDORED = ['bungee-400', 'chakra-petch-400', 'chakra-petch-500', 'chakra-petch-600', 'chakra-petch-700'];

test('arcade fonts are self-hosted (same-origin) and valid wOF2', () => {
  for (const name of VENDORED) {
    const buf = readFileSync(new URL(`../../fonts/${name}.woff2`, import.meta.url));
    assert.equal(buf.slice(0, 4).toString('latin1'), 'wOF2', `${name}.woff2 must be a real woff2`);
    assert.match(FONTS_CSS, new RegExp(`url\\(/fonts/${name}\\.woff2\\)`), `fonts.css references /fonts/${name}.woff2`);
  }
  assert.match(FONTS_CSS, /font-family:\s*'Bungee'/);
  assert.match(FONTS_CSS, /font-family:\s*'Chakra Petch'/);
});

test('both maker pages link the same-origin fonts and adopt the arcade families', () => {
  for (const [name, html] of [['builder', BUILDER], ['sandbox', SANDBOX]]) {
    assert.match(html, /<link rel="stylesheet" href="\/fonts\/fonts\.css">/, `${name} links self-hosted fonts`);
    assert.match(html, /'Bungee'/, `${name} uses Bungee`);
    assert.match(html, /'Chakra Petch'/, `${name} uses Chakra Petch`);
    // self-hosted only — no external font network (keeps the local-only/offline property + CSP tight)
    assert.equal(/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html), false, `${name} must not fetch external fonts`);
  }
});

test('builder CSP is unchanged (no weakening by the restyle)', () => {
  assert.match(BUILDER, /script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'/);
  // tight default: same-origin only (allows the self-hosted /fonts and the module, nothing external)
  assert.match(BUILDER, /default-src 'self'/);
});

test('builder hides the generated code behind a details toggle + keeps the gated primary action', () => {
  // srcView (raw game.mjs) must sit INSIDE a <details> so it is collapsed by default
  const d0 = BUILDER.indexOf('<details>');
  const dEnd = BUILDER.indexOf('</details>');
  const src = BUILDER.indexOf('id="srcView"');
  assert.ok(d0 !== -1 && dEnd !== -1 && d0 < src && src < dEnd, 'generated game.mjs must be inside <details>');
  assert.match(BUILDER, /id="testInSandbox" class="btn-primary"[^>]*disabled/, 'Test in sandbox is the primary, gated action');
  // the flow is made explicit
  assert.match(BUILDER, /class="steps"/);
});

test('sandbox is reframed as a playtest (now-playing + restart) with dev panels collapsed', () => {
  assert.match(SANDBOX, /id="nowPlaying"/);
  assert.match(SANDBOX, /id="restartBtn"/);
  // the import report (dev detail) is tucked inside <details>, not front-and-centre
  const d0 = SANDBOX.indexOf('<details>');
  const dEnd = SANDBOX.indexOf('</details>');
  const rep = SANDBOX.indexOf('id="sandboxReport"');
  assert.ok(d0 !== -1 && d0 < rep && rep < dEnd, 'import report must be inside <details>');
});

test('sandbox CSP keeps the load-bearing unsafe-inline (srcdoc child needs it) — not weakened', () => {
  assert.match(SANDBOX, /script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'self'/);
});

test('local-only boundary copy survives the restyle on the sandbox', () => {
  assert.match(SANDBOX, /null-origin sandboxed iframe/i);
  assert.match(SANDBOX, /untrusted local proposals?|never a server ticket\/prize\/score/i);
  assert.match(SANDBOX, /Nothing is uploaded or published/i);
});
