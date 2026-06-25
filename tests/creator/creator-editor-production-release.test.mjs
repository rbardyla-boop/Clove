/**
 * R8 — Creator Editor PRODUCTION RELEASE assembly tests.
 *   node --test tests/creator/creator-editor-production-release.test.mjs
 *
 * Proves the production deploy bundle (curated tree + reviewed editor overlay) is correctly assembled:
 * curated app present, editor overlaid at the right paths, staging manifest renamed, NO source/.map
 * leak, header policy = preserve-live-global + strict-editor (header CSP mirrors page meta), denylist
 * coupling intact, boundary closed, and deterministic. Builds a real bundle to a temp dir (shells the
 * curated + editor builders; the editor builder runs the studio Vite build), so it needs ~a few seconds.
 * LOCAL ONLY — asserts nothing is deployed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, relative, sep, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isUnsafeProdOut, editorPathGlob, revertGlobalDriftHeaders, editorHeaderBlocks,
} from '../../scripts/build-creator-editor-production-release.mjs';
import { EXPECTED_ENTRY_HTML, SANDBOX_ENTRY, parseCsp, cspViolations } from '../../scripts/build-creator-editor-staging.mjs';
import { isExcludedFromUpload } from '../../scripts/build-curated-client-upload.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUILDER = join(REPO, 'scripts', 'build-creator-editor-production-release.mjs');
// Re-pinned once for CR1B (security-reviewed maker hardening: sandbox-runner hook gate + importer scan).
const EXPECTED_EDITOR_AGGREGATE = '48ac852d3e6b4546d066c92fe40a44aafdbfd9c9d2d955e1e597362f6a27d174';
const OUT_A = '/tmp/cep-test-prod-A';
// build-static-release shells `npm run build` into the SHARED arcade-studio/dist, so two build-heavy
// test files Vite-building in parallel collide there. Serialize the build across test processes.
const STUDIO_BUILD_LOCK = '/tmp/cei-studio-build.lock';
const buildTo = (out) => execFileSync('flock', [STUDIO_BUILD_LOCK, 'node', BUILDER, '--out', out], { cwd: REPO, stdio: 'pipe' });

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = join(dir, d.name);
  return d.isDirectory() ? walk(p) : [p];
});
const relFiles = (root) => walk(root).map((f) => relative(root, f).split(sep).join('/'));
const metaCsp = (absHtml) => {
  const m = readFileSync(absHtml, 'utf8').match(/http-equiv=["']Content-Security-Policy["'][^>]*?content="([^"]+)"/i);
  return m ? m[1].trim().replace(/\s+/g, ' ') : null;
};

// Build the production bundle ONCE for the inspection tests.
let buildOk = false, buildErr = null, files = [];
try {
  buildTo(OUT_A);
  buildOk = true;
  files = relFiles(OUT_A);
} catch (e) { buildErr = e.stderr ? e.stderr.toString() : e.message; }

test('production bundle assembles successfully', () => {
  assert.ok(buildOk, `builder must succeed:\n${buildErr || ''}`);
});

test('1. assembly: curated app present + editor overlaid at expected paths + studio', () => {
  assert.ok(files.includes('index.html'), 'curated root index.html present');
  assert.ok(files.some((f) => f.startsWith('arcade/city/')), 'curated live city present');
  for (const rel of EXPECTED_ENTRY_HTML) assert.ok(files.includes(rel), `editor entry present: ${rel}`);
  assert.ok(files.includes('arcade-studio/index.html'), '/arcade-studio/ present');
  assert.ok(files.some((f) => f.startsWith('arcade-studio/assets/')), 'studio built assets present');
});

test('2. manifest: staging marker renamed to production manifest; aggregate + count correct', () => {
  assert.equal(files.includes('_STAGING_MANIFEST.json'), false, '_STAGING_MANIFEST.json must be absent');
  assert.ok(files.includes('_CREATOR_EDITOR_MANIFEST.json'), '_CREATOR_EDITOR_MANIFEST.json must be present');
  const m = JSON.parse(readFileSync(join(OUT_A, '_CREATOR_EDITOR_MANIFEST.json'), 'utf8'));
  assert.equal(m.editor_aggregate_sha256, EXPECTED_EDITOR_AGGREGATE, 'canonical editor aggregate preserved');
  // staging manifest file_count = CONTENT files only (excludes the manifest itself); 36 content + 1
  // manifest = the canonical "37 files incl. manifest" used in gate language.
  assert.equal(m.editor_file_count, 36, 'editor canonical content file count = 36 (37 incl. manifest)');
  assert.equal(m.deployed, false, 'manifest must not claim deployed');
  assert.equal(m.header_policy_mode, 'preserve-live-global-editor-strict');
  assert.ok(!('generated' in m), 'production manifest must be deterministic (no timestamp)');
  assert.ok(!('document_root' in m), 'production manifest must not embed an absolute /tmp path');
});

test('3. source-leak guard: no Vite source / tests / package / node_modules / .map in editor overlay', () => {
  const overlay = files.filter((f) => f.startsWith('arcade/creator/') || f.startsWith('arcade-studio/'));
  for (const f of overlay) {
    assert.ok(!/\.map$/.test(f), `no .map: ${f}`);
    assert.ok(!/(^|\/)(src|test|tests|node_modules)\//.test(f), `no source/test dir: ${f}`);
    assert.ok(!/vite\.config\./.test(f), `no vite config: ${f}`);
    assert.ok(!/package(-lock)?\.json$/.test(f), `no package json: ${f}`);
  }
  // arcade-studio overlay is built index.html + assets/* only.
  const studio = files.filter((f) => f.startsWith('arcade-studio/'));
  for (const f of studio) {
    assert.ok(f === 'arcade-studio/index.html' || (f.startsWith('arcade-studio/assets/') && ['.js', '.css'].includes(extname(f))),
      `studio overlay is built-assets-only: ${f}`);
  }
  // No embedded sourcemaps in served editor JS.
  for (const f of overlay.filter((x) => /\.(js|mjs|css|html)$/.test(x))) {
    const c = readFileSync(join(OUT_A, f), 'utf8');
    assert.ok(!/sourcesContent/.test(c), `no sourcesContent: ${f}`);
    assert.ok(!/sourceMappingURL=/.test(c), `no sourceMappingURL: ${f}`);
  }
});

test('4a. header policy: global /* preserves CURRENT LIVE behavior (not flipped to committed strict)', () => {
  const h = readFileSync(join(OUT_A, '_headers'), 'utf8');
  assert.match(h, /^\s*X-Frame-Options: SAMEORIGIN\s*$/m, 'global XFO preserved as SAMEORIGIN');
  assert.match(h, /^\s*Referrer-Policy: same-origin\s*$/m, 'global Referrer preserved as same-origin');
  // The committed strict values must NOT appear as the global default (they are the editor-path values only,
  // but the GLOBAL block must not carry DENY): ensure SAMEORIGIN exists and the committed global pair is gone
  // from the global context. (DENY still appears in editor blocks — that is expected.)
  assert.ok(!/^\s*Referrer-Policy: strict-origin-when-cross-origin\s*$/m.test(h.split('## ── R8')[0]),
    'global block must not carry the committed strict referrer');
});

test('4b. header policy: each editor path has a strict block whose CSP mirrors the page meta CSP', () => {
  const h = readFileSync(join(OUT_A, '_headers'), 'utf8');
  for (const rel of EXPECTED_ENTRY_HTML) {
    const glob = editorPathGlob(rel);
    assert.ok(h.includes(glob), `editor block present: ${glob}`);
    const meta = metaCsp(join(OUT_A, rel));
    assert.ok(meta, `meta CSP present on ${rel}`);
    assert.ok(h.includes(`Content-Security-Policy: ${meta}`), `header CSP mirrors meta for ${rel}`);
    assert.deepEqual(cspViolations(rel, meta), [], `meta CSP is clean for ${rel}`);
  }
});

test('4c. header policy: sandbox is the ONLY unsafe-inline script-src; studio has no inline/eval', () => {
  const sandboxMeta = parseCsp(metaCsp(join(OUT_A, SANDBOX_ENTRY)));
  assert.ok((sandboxMeta['script-src'] || []).includes("'unsafe-inline'"), 'sandbox keeps its exact-path inline exception');
  const studioMeta = parseCsp(metaCsp(join(OUT_A, 'arcade-studio/index.html')));
  assert.ok(!(studioMeta['script-src'] || []).includes("'unsafe-inline'"), 'studio script-src has no unsafe-inline');
  assert.ok(!/unsafe-eval/.test(metaCsp(join(OUT_A, 'arcade-studio/index.html'))), 'studio CSP has no unsafe-eval');
  // No non-sandbox editor entry carries unsafe-inline in script-src.
  for (const rel of EXPECTED_ENTRY_HTML.filter((r) => r !== SANDBOX_ENTRY)) {
    assert.ok(!(parseCsp(metaCsp(join(OUT_A, rel)))['script-src'] || []).includes("'unsafe-inline'"),
      `${rel} script-src must not allow unsafe-inline`);
  }
});

test('5. denylist coupling: production + staging builders excluded; source trees excluded', () => {
  assert.equal(isExcludedFromUpload('scripts/build-creator-editor-production-release.mjs'), true);
  assert.equal(isExcludedFromUpload('scripts/build-creator-editor-staging.mjs'), true);
  assert.equal(isExcludedFromUpload('arcade-studio/src/main.js'), true);
  assert.equal(isExcludedFromUpload('arcade/creator/block-editor/block-editor.mjs'), true);
});

test('6. boundary: no Worker/DO/config emitted into prod root; no enabling write/loader in editor overlay', () => {
  assert.equal(files.some((f) => f.startsWith('workers/')), false, 'no Worker source in prod root');
  assert.equal(files.includes('wrangler.toml'), false, 'no wrangler.toml in prod root');
  // Live loader literally false in the served approved-loader.
  const loader = readFileSync(join(OUT_A, 'arcade/creator/approval/approved-loader.mjs'), 'utf8');
  assert.match(loader, /export\s+const\s+LIVE_WORLD_LOADER_ENABLED\s*=\s*false\s*;/);
  // No real fetch/XHR write endpoint construction in editor HTML (sandbox same-origin sample fetch is in its .mjs, allowed).
  for (const rel of EXPECTED_ENTRY_HTML) {
    const html = readFileSync(join(OUT_A, rel), 'utf8');
    assert.ok(!/\b(action|formaction)\s*=\s*["']https?:/i.test(html), `${rel}: no external form submission`);
  }
});

test('7. determinism: rebuild yields identical editor aggregate + identical prod file list', () => {
  const OUT_B = '/tmp/cep-test-prod-B';
  try {
    buildTo(OUT_B);
    const mB = JSON.parse(readFileSync(join(OUT_B, '_CREATOR_EDITOR_MANIFEST.json'), 'utf8'));
    assert.equal(mB.editor_aggregate_sha256, EXPECTED_EDITOR_AGGREGATE, 'editor aggregate stable across rebuilds');
    assert.deepEqual(relFiles(OUT_B).sort(), [...files].sort(), 'production file list stable across rebuilds');
  } finally { rmSync(OUT_B, { recursive: true, force: true }); }
});

test('unit: isUnsafeProdOut refuses repo/home/prod-upload, allows /tmp', () => {
  assert.equal(isUnsafeProdOut('/tmp/creator-editor-production-root'), false);
  assert.equal(isUnsafeProdOut(REPO), true);
  assert.equal(isUnsafeProdOut(join(REPO, '..')), true); // ancestor of repo
});

test('unit: revertGlobalDriftHeaders flips both drifted headers exactly once; fails if shape changes', () => {
  const sample = '/*\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n';
  const out = revertGlobalDriftHeaders(sample);
  assert.match(out, /X-Frame-Options: SAMEORIGIN/);
  assert.match(out, /Referrer-Policy: same-origin/);
  assert.ok(!/X-Frame-Options: DENY/.test(out));
  assert.throws(() => revertGlobalDriftHeaders('no relevant headers here'), /expected exactly 1/);
});

test('unit: editorHeaderBlocks emits a glob + CSP per entry + immutable studio-asset cache', () => {
  const blocks = editorHeaderBlocks([{ glob: '/arcade-studio/*', csp: "default-src 'self'; script-src 'self'" }]);
  assert.match(blocks, /\/arcade-studio\/\*/);
  assert.match(blocks, /Content-Security-Policy: default-src 'self'; script-src 'self'/);
  assert.match(blocks, /\/arcade-studio\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
});
