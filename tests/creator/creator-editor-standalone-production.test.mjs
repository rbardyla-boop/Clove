/**
 * R8 remediation — Creator Editor STANDALONE production surface tests.
 *   node --test tests/creator/creator-editor-standalone-production.test.mjs
 *
 * Proves the editor-only production surface (for a separate clean Pages project — NOT clovelearn.io) is
 * correctly assembled: editor surface only (no curated app), staging marker renamed, every entry carries
 * frame-ancestors 'none', editor-strict _headers (global XFO DENY + strict referrer), no Cloudflare
 * analytics beacon string, no source/.map leak, denylist coupling intact, deterministic. Builds a real
 * surface to a temp dir (shells the editor builder which runs the studio Vite build) — needs ~a few seconds.
 * LOCAL ONLY — asserts nothing is deployed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, relative, sep, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isUnsafeOut, editorPathGlob, metaCspOf, buildStandaloneHeaders,
} from '../../scripts/build-creator-editor-standalone-production.mjs';
import { EXPECTED_ENTRY_HTML, SANDBOX_ENTRY, parseCsp, cspViolations } from '../../scripts/build-creator-editor-staging.mjs';
import { isExcludedFromUpload } from '../../scripts/build-curated-client-upload.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUILDER = join(REPO, 'scripts', 'build-creator-editor-standalone-production.mjs');
// Re-pinned for Creator Freedom v1 / Free Sandbox: +5 reviewed DATA-ONLY modules in the builder (schema, fixed
// interpreter, generator, editor, host-only retention). Output = a standard arcade_game package gated by the
// unchanged importArcadePackage scan; builder never runs the game; sandbox stays null-origin.
const EXPECTED_AGGREGATE = 'b1a5734d2812e5313643996f9b1717f7848f2b64a8371ef79b272e79d3e325d6';
const OUT_A = '/tmp/ces-test-standalone-A';
// build-static-release shells `npm run build` into the SHARED arcade-studio/dist, so two build-heavy
// test files Vite-building in parallel collide there. Serialize the build across test processes.
const STUDIO_BUILD_LOCK = '/tmp/cei-studio-build.lock';
const buildTo = (out) => execFileSync('flock', [STUDIO_BUILD_LOCK, 'node', BUILDER, '--out', out], { cwd: REPO, stdio: 'pipe' });

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = join(dir, d.name);
  return d.isDirectory() ? walk(p) : [p];
});
const relFiles = (root) => walk(root).map((f) => relative(root, f).split(sep).join('/'));
const metaOf = (root, rel) => metaCspOf(readFileSync(join(root, rel), 'utf8'));

let buildOk = false, buildErr = null, files = [];
try {
  buildTo(OUT_A);
  buildOk = true;
  files = relFiles(OUT_A);
} catch (e) { buildErr = e.stderr ? e.stderr.toString() : e.message; }

test('standalone surface assembles successfully', () => {
  assert.ok(buildOk, `builder must succeed:\n${buildErr || ''}`);
});

test('1. editor-only surface: 6 entries + studio present; NO curated clovelearn.io app', () => {
  for (const rel of EXPECTED_ENTRY_HTML) assert.ok(files.includes(rel), `editor entry present: ${rel}`);
  assert.ok(files.includes('arcade-studio/index.html'), 'studio present');
  assert.ok(files.some((f) => f.startsWith('arcade-studio/assets/')), 'studio assets present');
  // editor-ONLY: the curated main app must NOT be here.
  assert.equal(files.includes('index.html'), false, 'no clovelearn root index.html');
  assert.equal(files.some((f) => f.startsWith('arcade/city/')), false, 'no arcade/city app');
  assert.equal(files.some((f) => f === 'scripts/three.min.js'), false, 'no vendored main-app libs');
  // top-level: only the editor subtrees + _headers + manifest.
  const top = [...new Set(files.map((f) => f.split('/')[0]))].sort();
  assert.deepEqual(top, ['_CREATOR_EDITOR_MANIFEST.json', '_headers', 'arcade', 'arcade-studio'], `top-level = ${top.join(',')}`);
});

test('2. manifest: staging marker renamed; aggregate updated; no staging/clovelearn labels', () => {
  assert.equal(files.includes('_STAGING_MANIFEST.json'), false, '_STAGING_MANIFEST.json absent');
  assert.ok(files.includes('_CREATOR_EDITOR_MANIFEST.json'), '_CREATOR_EDITOR_MANIFEST.json present');
  const m = JSON.parse(readFileSync(join(OUT_A, '_CREATOR_EDITOR_MANIFEST.json'), 'utf8'));
  assert.equal(m.editor_aggregate_sha256, EXPECTED_AGGREGATE, 'frame-ancestors-hardened aggregate recorded');
  assert.equal(m.editor_file_count, 41, 'editor content file count = 41 (+5 vs prior 36: Creator Freedom v1 free-sandbox schema, interpreter, templates, editor + sandbox retention)');
  assert.equal(m.deployed, false);
  assert.equal(m.header_policy_mode, 'editor-strict-standalone');
  assert.ok(!('generated' in m) && !('document_root' in m), 'deterministic (no timestamp / document_root)');
  const blob = JSON.stringify(m);
  assert.ok(!/clovelearn\.io/.test(blob), 'no clovelearn.io production claim');
  assert.ok(!/pages\.dev/.test(blob) && !/clove-creator-editor-staging/.test(blob), 'no staging URL/project name');
});

test('3. frame-ancestors: in the HEADER CSP for every entry (NOT in meta — it is header-only)', () => {
  const h = readFileSync(join(OUT_A, '_headers'), 'utf8');
  for (const rel of EXPECTED_ENTRY_HTML) {
    const meta = metaOf(OUT_A, rel);
    assert.ok(meta, `meta CSP present: ${rel}`);
    // frame-ancestors is ignored (and errors) in a <meta>, so it must NOT be there...
    assert.ok(!/frame-ancestors/.test(meta), `${rel} meta must NOT carry frame-ancestors`);
    // ...and MUST be appended to the HTTP header CSP (header tightens meta).
    assert.ok(h.includes(`Content-Security-Policy: ${meta}; frame-ancestors 'none'`),
      `header CSP for ${rel} = meta + frame-ancestors 'none'`);
  }
});

test('4. _headers: global XFO DENY + strict referrer; per-entry CSP mirrors meta (with frame-ancestors)', () => {
  const h = readFileSync(join(OUT_A, '_headers'), 'utf8');
  assert.match(h, /^\s*X-Frame-Options: DENY\s*$/m, 'global XFO DENY');
  assert.match(h, /^\s*Referrer-Policy: strict-origin-when-cross-origin\s*$/m, 'global strict referrer');
  assert.match(h, /^\s*X-Content-Type-Options: nosniff\s*$/m);
  assert.match(h, /^\s*Strict-Transport-Security:/m);
  for (const rel of EXPECTED_ENTRY_HTML) {
    const meta = metaOf(OUT_A, rel);
    assert.ok(h.includes(editorPathGlob(rel)), `header block for ${rel}`);
    assert.ok(h.includes(`Content-Security-Policy: ${meta}`), `header CSP mirrors meta for ${rel}`);
    assert.deepEqual(cspViolations(rel, meta), [], `meta CSP clean for ${rel}`);
  }
});

test('5. CSP safety: sandbox is the ONLY unsafe-inline script-src; studio has no inline/eval', () => {
  assert.ok((parseCsp(metaOf(OUT_A, SANDBOX_ENTRY))['script-src'] || []).includes("'unsafe-inline'"), 'sandbox keeps exact-path inline');
  const studio = parseCsp(metaOf(OUT_A, 'arcade-studio/index.html'));
  assert.ok(!(studio['script-src'] || []).includes("'unsafe-inline'"), 'studio no unsafe-inline');
  assert.ok(!/unsafe-eval/.test(metaOf(OUT_A, 'arcade-studio/index.html')), 'studio no unsafe-eval');
  for (const rel of EXPECTED_ENTRY_HTML.filter((r) => r !== SANDBOX_ENTRY)) {
    assert.ok(!(parseCsp(metaOf(OUT_A, rel))['script-src'] || []).includes("'unsafe-inline'"), `${rel} no unsafe-inline`);
  }
});

test('6. NO Cloudflare analytics beacon string anywhere on the surface', () => {
  for (const f of files) {
    const c = readFileSync(join(OUT_A, f), 'utf8');
    assert.ok(!c.includes('static.cloudflareinsights.com'), `no cloudflareinsights host in ${f}`);
    assert.ok(!c.includes('beacon.min.js'), `no beacon.min.js in ${f}`);
  }
});

test('7. source-leak guard: no Vite source / tests / package / .map / sourcemaps; no external host', () => {
  for (const f of files) {
    assert.ok(!/\.map$/.test(f), `no .map: ${f}`);
    assert.ok(!/(^|\/)(src|test|tests|node_modules)\//.test(f), `no source/test dir: ${f}`);
    assert.ok(!/vite\.config\./.test(f), `no vite config: ${f}`);
    assert.ok(!/package(-lock)?\.json$/.test(f), `no package json: ${f}`);
  }
  // arcade-studio overlay = built index.html + assets only.
  for (const f of files.filter((x) => x.startsWith('arcade-studio/'))) {
    assert.ok(f === 'arcade-studio/index.html' || (f.startsWith('arcade-studio/assets/') && ['.js', '.css'].includes(extname(f))),
      `studio = built assets only: ${f}`);
  }
  for (const f of files.filter((x) => /\.(js|mjs|css|html)$/.test(x))) {
    const c = readFileSync(join(OUT_A, f), 'utf8');
    assert.ok(!/sourcesContent/.test(c), `no sourcesContent: ${f}`);
    assert.ok(!/sourceMappingURL=/.test(c), `no sourceMappingURL: ${f}`);
    const hosts = (c.match(/https?:\/\/[^"'` )]+/g) || []).filter((u) => !/w3\.org/.test(u) && !u.startsWith('http://,'));
    assert.deepEqual(hosts, [], `no connectable external host in ${f}: ${hosts.join(' ')}`);
  }
});

test('8. boundary: live loader false; no upload/submit/publish form action; no Worker/config files', () => {
  assert.equal(files.some((f) => f.startsWith('workers/')), false, 'no Worker source');
  assert.equal(files.includes('wrangler.toml'), false, 'no wrangler.toml');
  const loader = readFileSync(join(OUT_A, 'arcade/creator/approval/approved-loader.mjs'), 'utf8');
  assert.match(loader, /export\s+const\s+LIVE_WORLD_LOADER_ENABLED\s*=\s*false\s*;/);
  for (const rel of EXPECTED_ENTRY_HTML) {
    const html = readFileSync(join(OUT_A, rel), 'utf8');
    assert.ok(!/\b(action|formaction)\s*=\s*["']https?:/i.test(html), `${rel}: no external form submission`);
  }
});

test('9. denylist coupling: standalone + overlay + staging builders excluded; source trees excluded', () => {
  assert.equal(isExcludedFromUpload('scripts/build-creator-editor-standalone-production.mjs'), true);
  assert.equal(isExcludedFromUpload('scripts/build-creator-editor-production-release.mjs'), true);
  assert.equal(isExcludedFromUpload('scripts/build-creator-editor-staging.mjs'), true);
  assert.equal(isExcludedFromUpload('arcade-studio/src/main.js'), true);
  assert.equal(isExcludedFromUpload('arcade/creator/block-editor/block-editor.mjs'), true);
});

test('10. determinism: rebuild yields identical aggregate + identical surface file list', () => {
  const OUT_B = '/tmp/ces-test-standalone-B';
  try {
    buildTo(OUT_B);
    const mB = JSON.parse(readFileSync(join(OUT_B, '_CREATOR_EDITOR_MANIFEST.json'), 'utf8'));
    assert.equal(mB.editor_aggregate_sha256, EXPECTED_AGGREGATE, 'aggregate stable');
    assert.deepEqual(relFiles(OUT_B).sort(), [...files].sort(), 'surface file list stable');
  } finally { rmSync(OUT_B, { recursive: true, force: true }); }
});

test('unit: isUnsafeOut refuses repo/home/prod-upload, allows /tmp; buildStandaloneHeaders shape', () => {
  assert.equal(isUnsafeOut('/tmp/creator-editor-standalone-production-root'), false);
  assert.equal(isUnsafeOut(REPO), true);
  const h = buildStandaloneHeaders([{ glob: '/arcade-studio/*', csp: "default-src 'self'; frame-ancestors 'none'" }]);
  assert.match(h, /X-Frame-Options: DENY/);
  assert.match(h, /\/arcade-studio\/\*/);
  assert.match(h, /Content-Security-Policy: default-src 'self'; frame-ancestors 'none'/);
  assert.match(h, /\/arcade-studio\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
});
