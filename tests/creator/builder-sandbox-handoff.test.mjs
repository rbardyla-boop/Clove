// CR1C — one-click builder→sandbox playtest handoff contract (source-read; behavior is browser-smoked).
// The Local Arcade Builder hands its GATED build to the Arcade Sandbox via a same-origin sessionStorage
// key so a creator can playtest without a manual export/import. This test pins the safety contract:
//   - the handoff key literal is identical on both ends (no silent drift);
//   - the builder writes ONLY {manifest, files} and navigates (it stays DATA-ONLY — never runs a game);
//   - the sandbox reads the key ONCE, clears it, validates the shape, and routes through the EXISTING
//     run() gate (importArcadePackage + null-origin iframe) — a data handoff, not a trust transfer;
//   - no economy/eval/network surface is introduced by the handoff.
// Run: node --test tests/creator/builder-sandbox-handoff.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const BUILDER_HTML = read('../../arcade/creator/arcade-builder/index.html');
const BUILDER_JS = read('../../arcade/creator/arcade-builder/arcade-builder.mjs');
const SANDBOX_HTML = read('../../arcade/creator/arcade-sandbox/index.html');
const SANDBOX_JS = read('../../arcade/creator/arcade-sandbox/sandbox-runner.mjs');

const keyOf = (src) => (src.match(/HANDOFF_KEY\s*=\s*'([^']+)'/) || [])[1];

test('handoff key literal is defined and identical on both ends', () => {
  const bk = keyOf(BUILDER_JS);
  const sk = keyOf(SANDBOX_JS);
  assert.ok(bk && bk.length > 0, 'builder defines HANDOFF_KEY');
  assert.equal(sk, bk, 'sandbox HANDOFF_KEY must match the builder literal exactly');
});

test('builder exposes a "Test in sandbox" control', () => {
  assert.match(BUILDER_HTML, /id="testInSandbox"/);
  assert.match(BUILDER_JS, /el\('testInSandbox'\)\.addEventListener\('click'/);
});

test('builder control is gated on a VALID gated build (disabled until ok)', () => {
  assert.match(BUILDER_JS, /el\('testInSandbox'\)\.disabled\s*=\s*!state\.lastReport\.ok/);
  // the click handler itself also re-checks before acting
  assert.match(BUILDER_JS, /testInSandbox'\)\.addEventListener\('click',\s*\(\)\s*=>\s*\{\s*if\s*\(!state\.lastBuild\s*\|\|\s*!state\.lastReport\?\.ok\)\s*return;/s);
});

test('builder writes ONLY {manifest, files} to sessionStorage, then navigates to the sandbox', () => {
  assert.match(BUILDER_JS, /sessionStorage\.setItem\(HANDOFF_KEY,/);
  // payload is manifest + files from the gated build only — no score/ticket/token/prize fields
  const handler = BUILDER_JS.slice(BUILDER_JS.indexOf("testInSandbox')"));
  const payload = handler.slice(handler.indexOf('setItem'), handler.indexOf('location.href'));
  assert.match(payload, /manifest:\s*state\.lastBuild\.manifest/);
  assert.match(payload, /files:\s*state\.lastBuild\.files/);
  assert.equal(/ticket|prize|score|token|reward|ledger/i.test(payload), false, 'no economy field in the handoff payload');
  assert.match(BUILDER_JS, /location\.href\s*=\s*'\.\.\/arcade-sandbox\/'/);
});

test('builder stays DATA-ONLY — the handoff never executes a game', () => {
  const handler = BUILDER_JS.slice(BUILDER_JS.indexOf("testInSandbox')"), BUILDER_JS.length);
  const region = handler.slice(0, handler.indexOf('});') + 3);
  assert.equal(/\beval\s*\(|new Function|import\s*\(|srcdoc|createElement\('iframe'\)/.test(region), false,
    'builder handoff must not run/import code or build an iframe');
});

test('sandbox consumes the handoff once, clears it, and routes through the run() gate', () => {
  assert.match(SANDBOX_JS, /function consumeBuilderHandoff\(\)/);
  assert.match(SANDBOX_JS, /sessionStorage\.getItem\(HANDOFF_KEY\)/);
  assert.match(SANDBOX_JS, /sessionStorage\.removeItem\(HANDOFF_KEY\)/);
  // it must call run() (which re-gates via importArcadePackage) — not build a srcdoc itself
  const fn = SANDBOX_JS.slice(SANDBOX_JS.indexOf('function consumeBuilderHandoff'));
  const body = fn.slice(0, fn.indexOf('\n}\n') + 2);
  assert.match(body, /\brun\(manifest,\s*files\)/);
  assert.equal(/buildSrcdoc|createElement\('iframe'\)/.test(body), false, 'consume must delegate to run(), not bypass the gate');
});

test('sandbox validates the handoff shape (untrusted boundary input)', () => {
  const fn = SANDBOX_JS.slice(SANDBOX_JS.indexOf('function consumeBuilderHandoff'));
  const body = fn.slice(0, fn.indexOf('\n}\n') + 2);
  assert.match(body, /JSON\.parse\(raw\)/);
  assert.match(body, /typeof manifest !== 'object'|typeof manifest !== "object"/);
  assert.match(body, /typeof files !== 'object'|typeof files !== "object"/);
  // every early-out before run() returns false (malformed input never reaches the gate as a partial)
  assert.ok((body.match(/return false;/g) || []).length >= 4, 'defensive early-outs on malformed input');
});

test('sandbox auto-loads the handoff on init (wired in wire())', () => {
  const wire = SANDBOX_JS.slice(SANDBOX_JS.indexOf('function wire()'));
  const body = wire.slice(0, wire.indexOf('\n}\n') + 2);
  assert.match(body, /consumeBuilderHandoff\(\)/);
});

test('sandbox run() gate (importArcadePackage) is still mandatory and unchanged', () => {
  assert.match(SANDBOX_JS, /export function run\(manifest, files\)/);
  assert.match(SANDBOX_JS, /const report = importArcadePackage\(\{ manifest, files \}\)/);
  assert.match(SANDBOX_JS, /if \(!report\.ok\)/);
});

test('sandbox page explains the auto-load and keeps the no-upload/no-publish boundary copy', () => {
  assert.match(SANDBOX_HTML, /Test in sandbox/);
  assert.match(SANDBOX_HTML, /Nothing is uploaded or published|no.*upload|re-gated on arrival/i);
});
