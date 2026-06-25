/**
 * Creator Foundation CF-4 — arcade package importer unit tests (pure).
 * Validates the real sample package on disk + a battery of adversarial malformed variants.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { importArcadePackage, scanSource, FRAME_CONTRACT_DIMS } from '../../arcade/creator/arcade-importer/import-arcade-package.mjs';

const dir = fileURLToPath(new URL('../../arcade/creator/samples/arcade-sample/', import.meta.url));
const read = (n) => readFileSync(dir + n, 'utf8');
const SAMPLE_MANIFEST = JSON.parse(read('manifest.json'));
const SAMPLE_FILES = () => ({ 'manifest.json': read('manifest.json'), 'game.mjs': read('game.mjs'), 'adapter.mjs': read('adapter.mjs') });
const imp = (manifest, files) => importArcadePackage({ manifest, files });

test('the real sample package imports cleanly', () => {
  const r = imp(SAMPLE_MANIFEST, SAMPLE_FILES());
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.deepEqual(r.capabilities, []);
  assert.deepEqual(r.frame_dims, { width: 360, height: 640 });
  assert.equal(r.result_trust, 'untrusted_local_proposal');
});

test('frame contract dims are known for all approved contracts', () => {
  for (const id of ['cabinet-360x640', 'cabinet-640x360', 'cabinet-480x480']) {
    assert.ok(FRAME_CONTRACT_DIMS[id] && FRAME_CONTRACT_DIMS[id].width > 0);
  }
});

test('oversized package (files exceed budget) is rejected', () => {
  const files = SAMPLE_FILES();
  files['game.mjs'] = files['game.mjs'] + '\n' + ('const pad = "' + 'x'.repeat(20000) + '";');
  const r = imp(SAMPLE_MANIFEST, files);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /size_budget_bytes/.test(e)));
});

test('missing entry/adapter file is rejected', () => {
  const files = SAMPLE_FILES();
  delete files['game.mjs'];
  const r = imp(SAMPLE_MANIFEST, files);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /missing file referenced by entry/.test(e)));
});

test('unexpected bundled file (asset) is rejected', () => {
  const files = SAMPLE_FILES();
  files['sprite.png'] = 'data';
  const r = imp(SAMPLE_MANIFEST, files);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /unexpected bundled file/.test(e)));
});

test('non-empty capabilities are rejected (deny-by-default)', () => {
  const r = imp({ ...SAMPLE_MANIFEST, capabilities: ['network'] }, SAMPLE_FILES());
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /capabilities/.test(e)));
});

test('source with a network/storage/eval call is rejected', () => {
  for (const [snippet, label] of [
    ['fetch("/x")', 'fetch'],
    ['new WebSocket("ws://h")', 'WebSocket'],
    ['localStorage.setItem("a","b")', 'localStorage'],
    ['eval("1+1")', 'eval'],
    ['new Function("return 1")', 'new Function'],
    ['const u = "https://evil.example/x"', 'external url'],
    ['document.cookie', 'cookies'],
    ['await import("./x.mjs")', 'dynamic import'],
  ]) {
    const files = SAMPLE_FILES();
    files['game.mjs'] = files['game.mjs'] + '\nfunction _x(){ ' + snippet + '; }';
    const r = imp(SAMPLE_MANIFEST, files);
    assert.equal(r.ok, false, `${label} must be rejected`);
  }
});

test('economy/ownership term in source is rejected', () => {
  const files = SAMPLE_FILES();
  files['game.mjs'] = files['game.mjs'] + '\nconst note = "award a prize and payout";';
  const r = imp(SAMPLE_MANIFEST, files);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /economy|ownership/.test(e)));
});

test('markup/script injection in source is rejected', () => {
  const files = SAMPLE_FILES();
  files['game.mjs'] = files['game.mjs'] + '\nconst s = "</scr" + "ipt>";'; // assembled to avoid literal here
  // direct injection must also be caught:
  files['adapter.mjs'] = files['adapter.mjs'].replace('export function createAdapter', '/* <script>alert(1)</script> */ export function createAdapter');
  const r = imp(SAMPLE_MANIFEST, files);
  assert.equal(r.ok, false);
});

test('obfuscation / capability vectors are rejected (review hardening)', () => {
  for (const [snippet, label] of [
    ["const f = window['fe'+'tch']", 'bracket global access'],
    ['const F = (function(){}).constructor.constructor', 'Function-constructor escape'],
    ['const u = URL.createObjectURL(b)', 'blob object url'],
    ['const m = import.meta.url', 'import.meta'],
    ['parent.postMessage({x:1}, "*")', 'postMessage'],
    ['const fn = "\\u0066etch"', 'unicode escape'],
    ['const e = (0, eval)("1")', 'indirect eval (0,eval)'],
    ['const c = this["constructor"]', 'bracket access on this'],
  ]) {
    const files = SAMPLE_FILES();
    files['game.mjs'] = files['game.mjs'] + '\nfunction _z(){ ' + snippet + '; }';
    const r = imp(SAMPLE_MANIFEST, files);
    assert.equal(r.ok, false, `${label} must be rejected`);
  }
});

test('multiline and side-effect imports are rejected (review hardening)', () => {
  const e1 = [];
  scanSource('adapter.mjs', 'import {\n  createGame\n} from "./evil.mjs";\nexport function createAdapter(){}', 'adapter', e1);
  assert.ok(e1.some((e) => /may import only/.test(e)), 'multiline non-game import rejected');
  const e2 = [];
  scanSource('game.mjs', 'import "./side-effect.mjs";\nexport function createGame(){}', 'entry', e2);
  assert.ok(e2.some((e) => /side-effect import/.test(e)), 'side-effect import rejected');
  const e3 = [];
  scanSource('adapter.mjs', "import {\n createGame\n} from './game.mjs';\nexport function createAdapter(){}", 'adapter', e3);
  assert.equal(e3.length, 0, 'multiline ./game.mjs import is allowed');
});

test('entry module must not import; adapter may import only ./game.mjs', () => {
  const e1 = [];
  scanSource('game.mjs', 'import x from "./other.mjs";\nexport function createGame(){}', 'entry', e1);
  assert.ok(e1.some((e) => /must not import/.test(e)));
  const e2 = [];
  scanSource('adapter.mjs', 'import { z } from "./helpers.mjs";\nexport function createAdapter(){}', 'adapter', e2);
  assert.ok(e2.some((e) => /may import only/.test(e)));
  const e3 = [];
  scanSource('adapter.mjs', "import { createGame } from './game.mjs';\nexport function createAdapter(){}", 'adapter', e3);
  assert.equal(e3.length, 0); // the allowed import passes
});

test('wrong package_kind / bad manifest is rejected via the reused CF-1 validator', () => {
  const r = imp({ ...SAMPLE_MANIFEST, package_kind: 'block_style' }, SAMPLE_FILES());
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /manifest:/.test(e)));
});

test('result is always declared an untrusted local proposal', () => {
  const r = imp(SAMPLE_MANIFEST, SAMPLE_FILES());
  assert.equal(r.result_trust, 'untrusted_local_proposal');
});
