// CR1D — LOCAL share / import-export contract (source-read; behavior is browser-smoked).
// A creator can copy a LOCAL share code from the builder and paste/import it into the sandbox on ANOTHER
// browser, with NO server, upload, or account. This test pins the safety contract:
//   - the NCLOCAL1: prefix literal is identical on both ends (no silent drift);
//   - the builder ENCODES {manifest, files} only (data) and never executes the game;
//   - the sandbox DECODES untrusted text, shape-validates it, rejects malformed input BEFORE any run, and
//     routes valid packages through the EXISTING run()→importArcadePackage gate (null-origin iframe);
//   - .builder.json / pasted data is used for manifest+files ONLY — builder_params is never executable state;
//   - the local package fingerprint uses the existing packageHash and is labelled neutrally (not ownership/
//     token/receipt/approval);
//   - NO server/network/economy surface is introduced (local-only).
// Run: node --test tests/creator/local-share.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const BUILDER_HTML = read('../../arcade/creator/arcade-builder/index.html');
const BUILDER_JS = read('../../arcade/creator/arcade-builder/arcade-builder.mjs');
const SANDBOX_HTML = read('../../arcade/creator/arcade-sandbox/index.html');
const SANDBOX_JS = read('../../arcade/creator/arcade-sandbox/sandbox-runner.mjs');

const prefixOf = (src) => (src.match(/SHARE_PREFIX\s*=\s*'([^']+)'/) || [])[1];
// grab a function body by name (tolerates an `export ` prefix); mirrors the sandbox-input contract test.
const fnBody = (src, name) => { const i = src.indexOf('function ' + name + '('); return i === -1 ? '' : src.slice(i, src.indexOf('\n}\n', i) + 2); };

test('NCLOCAL1 share-code prefix is defined and identical on both ends', () => {
  const b = prefixOf(BUILDER_JS);
  const s = prefixOf(SANDBOX_JS);
  assert.equal(b, 'NCLOCAL1:', 'builder SHARE_PREFIX is NCLOCAL1:');
  assert.equal(s, b, 'sandbox SHARE_PREFIX must match the builder literal exactly');
  // a local share code, not a link: the prefix must not look like a URL scheme
  assert.doesNotMatch(b, /\/\//);
});

test('builder ENCODES {manifest, files} as a local code and never executes the game', () => {
  // share code = NCLOCAL1: + UTF-8-safe base64 of JSON {manifest, files}
  assert.match(BUILDER_JS, /function toBase64Utf8\(/);
  assert.match(fnBody(BUILDER_JS, 'toBase64Utf8'), /new TextEncoder\(\)\.encode|btoa\(/);
  const share = fnBody(BUILDER_JS, 'shareCodeFor');
  assert.match(share, /SHARE_PREFIX \+ toBase64Utf8\(JSON\.stringify\(\{ manifest: build\.manifest, files: build\.files \}\)\)/);
  // DATA-ONLY: the builder must not gain an executor (no eval/new Function/dynamic import anywhere)
  assert.doesNotMatch(BUILDER_JS, /\beval\s*\(|new\s+Function\b|\bimport\s*\(/);
});

test('builder Share-locally panel exists and is gated to a VALID build', () => {
  assert.match(BUILDER_HTML, /id="sharePanel"[^>]*hidden/);
  for (const id of ['shareCode', 'copyShareBtn', 'copySummaryBtn', 'packageHash']) {
    assert.match(BUILDER_HTML, new RegExp('id="' + id + '"'), `builder HTML defines #${id}`);
  }
  // panel is shown only when the gate passes
  assert.match(BUILDER_JS, /sharePanel\.hidden = !state\.lastReport\.ok/);
});

test('builder copy-summary carries the local-only boundary line', () => {
  assert.match(fnBody(BUILDER_JS, 'summaryText'), /Local-only\. No tickets\. No live publishing\./);
});

test('builder share copy is local-only (no upload/publish/tickets) and uses existing packageHash', () => {
  assert.match(BUILDER_JS, /import \{ packageHash \} from '\.\.\/validator\/package-hash\.mjs'/);
  const html = BUILDER_HTML.toLowerCase();
  assert.match(html, /no server upload/);
  assert.match(html, /no live publishing/);
  assert.match(html, /no tickets\/rewards/);
  // fingerprint must be labelled neutrally — never ownership/token/receipt/approval
  assert.match(BUILDER_HTML, /Not proof of ownership, not a token/);
});

test('sandbox import panel exists (paste + file + error + fingerprint)', () => {
  for (const id of ['importCode', 'importCodeBtn', 'importFile', 'importError', 'importHash']) {
    assert.match(SANDBOX_HTML, new RegExp('id="' + id + '"'), `sandbox HTML defines #${id}`);
  }
  assert.match(SANDBOX_HTML, /Import a shared cabinet/);
  // file input accepts LOCAL files only — no remote source
  assert.match(SANDBOX_HTML, /accept="\.nclocal,\.json,application\/json,text\/plain"/);
  const html = SANDBOX_HTML.toLowerCase();
  assert.match(html, /nothing is uploaded/);
  assert.match(html, /nothing is published/);
  assert.match(html, /no tickets/);
});

test('sandbox DECODES untrusted text and shape-validates before any run', () => {
  const parse = fnBody(SANDBOX_JS, 'parseSharedText');
  assert.ok(parse, 'parseSharedText exists');
  // NCLOCAL1 → atob/TextDecoder; raw JSON also accepted
  assert.match(SANDBOX_JS, /function fromBase64Utf8\(/);
  assert.match(fnBody(SANDBOX_JS, 'fromBase64Utf8'), /atob\(|new TextDecoder\(\)/);
  assert.match(parse, /t\.slice\(0, SHARE_PREFIX\.length\) === SHARE_PREFIX/);
  // requires BOTH manifest and files to be objects (rejects params-only / junk)
  assert.match(parse, /json\.manifest/);
  assert.match(parse, /json\.files/);
  assert.match(parse, /typeof manifest !== 'object'[\s\S]*typeof files !== 'object'/);
  // oversized + empty inputs are rejected
  assert.match(parse, /SHARE_CODE_MAX_CHARS/);
  assert.match(parse, /Paste a share code or package JSON first/);
});

test('sandbox import routes through the EXISTING gate; malformed input never runs', () => {
  const imp = fnBody(SANDBOX_JS, 'importSharedText');
  assert.ok(imp, 'importSharedText exists');
  // malformed: catch sets the error and RETURNS before run() is called
  assert.match(imp, /catch \(e\) \{[\s\S]*errEl\.textContent = e\.message[\s\S]*return false;/);
  // valid: re-gates by calling run(), which still calls importArcadePackage
  assert.match(imp, /const report = run\(pkg\.manifest, pkg\.files\)/);
  assert.match(SANDBOX_JS, /const report = importArcadePackage\(\{ manifest, files \}\)/);
  // run() must reject the package before mounting the iframe
  assert.match(SANDBOX_JS, /if \(!report\.ok\) \{ setStatus\([^)]*'sb-bad'\)[\s\S]*return report; \}/);
});

test('imported builder_params is NEVER treated as executable state', () => {
  // the sandbox only ever pulls manifest/files out of shared data; builder_params is not read into run
  assert.doesNotMatch(SANDBOX_JS, /run\([^)]*builder_params/);
  assert.doesNotMatch(SANDBOX_JS, /pkg\.builder_params|json\.builder_params/);
});

test('sandbox shows a neutral local fingerprint via the existing packageHash', () => {
  assert.match(SANDBOX_JS, /import \{ packageHash \} from '\.\.\/validator\/package-hash\.mjs'/);
  assert.match(SANDBOX_HTML, /Local package fingerprint/);
  // fingerprint helper is labelled as NOT ownership/token/receipt/approval
  assert.match(SANDBOX_JS, /NOT proof of ownership, a token, a receipt, or approval/i);
});

test('the local share/import code introduces NO network or economy surface', () => {
  // the NEW share/import helpers must not fetch, open sockets, or hit a URL
  for (const name of ['toBase64Utf8', 'shareCodeFor', 'summaryText']) {
    const body = fnBody(BUILDER_JS, name);
    assert.doesNotMatch(body, /\bfetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\//i, `${name} stays local`);
  }
  for (const name of ['fromBase64Utf8', 'parseSharedText', 'importSharedText', 'showFingerprint']) {
    const body = fnBody(SANDBOX_JS, name);
    assert.doesNotMatch(body, /\bfetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\//i, `${name} stays local`);
  }
  // the share code itself is local data, never a URL/link
  assert.doesNotMatch(fnBody(BUILDER_JS, 'shareCodeFor'), /https?:\/\/|location\.|window\.open/i);
});
