/**
 * Creator Editor STANDALONE production bundle builder + guard (R8 remediation — LOCAL ONLY, NOT a deploy).
 *
 * Builds an EDITOR-ONLY production root (default /tmp/creator-editor-standalone-production-root) for a
 * DEDICATED, clean Cloudflare Pages project (e.g. clove-creator-editor-production) — NOT clovelearn.io,
 * NOT wild-hat-6257. The first production attempt failed because the clovelearn.io zone injects a
 * Cloudflare Web Analytics beacon into HTML, which the editor's strict CSP blocks (console errors +
 * external request). A separate Pages host has no such injection (proven by R6/R7), so this bundle is
 * the whole served surface: the editor and nothing else.
 *
 * It REUSES build-creator-editor-staging.mjs to assemble + guard the editor artifact, then:
 *   - overlays the editor (every file EXCEPT the staging manifest) into the standalone root,
 *   - renames the manifest → _CREATOR_EDITOR_MANIFEST.json (staging marker never ships),
 *   - generates an editor-strict deploy-bundle _headers (whole surface is editor: XFO DENY + strict
 *     referrer GLOBAL; per-entry CSP = page meta TIGHTENED with frame-ancestors 'none' — header-only,
 *     since browsers ignore frame-ancestors in <meta>),
 *   - fails closed on source leak, staging marker, sourcemap, Cloudflare beacon host, external host,
 *     missing frame-ancestors, or unsafe CSP.
 *
 * Boundary: no deploy, no push, no Cloudflare/Worker/DO/D1/R2/route/DNS change. CF-2 live loader stays
 * false (editor builder refuses otherwise). Denylisted from the curated production upload — see
 * FORBIDDEN_UPLOAD_FILES + tests/creator/curated-upload.test.mjs.
 *
 * Usage:  node scripts/build-creator-editor-standalone-production.mjs [--out <dir>]
 */
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep, relative, extname } from 'node:path';
import { homedir } from 'node:os';
import { workshopFileList } from './build-creator-workshop-bundle.mjs';
import { EXPECTED_ENTRY_HTML, SANDBOX_ENTRY, parseCsp, cspViolations } from './build-creator-editor-staging.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EDITOR_BUILDER = join(ROOT, 'scripts', 'build-creator-editor-staging.mjs');

const DEFAULT_OUT = '/tmp/creator-editor-standalone-production-root';
const EDITOR_SRC = '/tmp/creator-editor-standalone-src'; // temp editor artifact (separate from the default staging root)
const STAGING_MANIFEST = '_STAGING_MANIFEST.json';
const PRODUCTION_MANIFEST = '_CREATOR_EDITOR_MANIFEST.json';
// Editor canonical aggregate. frame-ancestors is added in the deploy-bundle _headers (it is HEADER-ONLY:
// the browser IGNORES + errors on frame-ancestors in a <meta>), so the editor HTML/artifact is unchanged.
// Re-pinned once for CR1B: the reviewed maker surfaces sandbox-runner.mjs (debug-hook gating) +
// import-arcade-package.mjs ((0,eval)/this[ scan hardening) changed. Security-reviewed re-bless of the
// reviewed bundle, not unreviewed drift.
const EXPECTED_EDITOR_AGGREGATE = '2ae2a90dfaf54c0b171396a635a3da1b8c9833790e269f555c99e7681909c1aa';
const HEADER_POLICY_MODE = 'editor-strict-standalone';

// Strings that must NEVER appear in the standalone surface (the production-zone analytics that broke deploy #1).
const FORBIDDEN_STRINGS = ['static.cloudflareinsights.com', 'beacon.min.js'];

const STUDIO_ALLOWED_EXT = new Set(['.html', '.js', '.css']);
const LEAK_PATTERNS = [
  /(^|\/)(src|test|tests|node_modules)\//, /(^|\/)vite\.config\./, /package(-lock)?\.json$/,
  /\.test\./, /\.spec\./, /\.map$/,
];

// Editor-only surface: every response carries these (whole surface is the editor — no preserve-live).
const GLOBAL_EDITOR_HEADERS = Object.freeze([
  'X-Frame-Options: DENY',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'X-Content-Type-Options: nosniff',
  'Permissions-Policy: camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security: max-age=31536000; includeSubDomains',
]);

const fails = [];
const fail = (m) => { fails.push(m); console.error(`FAIL: ${m}`); };
const ok = (m) => console.log(`  ok   ${m}`);

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = join(dir, d.name);
  return d.isDirectory() ? walk(p) : [p];
});

/** PURE: refuse dangerous --out (mirrors the other builders; subtree-safe vs the prod upload dir). */
export function isUnsafeOut(out, root = ROOT) {
  const abs = resolve(out);
  const prodUpload = resolve(join(homedir(), 'Downloads', 'clovelearn-phase6-client-upload'));
  const exact = [resolve('/'), resolve(homedir()), resolve(root), prodUpload];
  const isAncestorOfRepo = root === abs || root.startsWith(abs + sep);
  const underProdUpload = abs === prodUpload || abs.startsWith(prodUpload + sep);
  return exact.includes(abs) || isAncestorOfRepo || underProdUpload;
}

/** PURE: served path glob for an entry HTML rel path (arcade-studio/index.html → /arcade-studio/*). */
export function editorPathGlob(entryHtmlRel) {
  return '/' + dirname(entryHtmlRel) + '/*';
}

/** PURE: read an entry HTML's meta CSP (normalized whitespace). */
export function metaCspOf(html) {
  const m = html.match(/http-equiv=["']Content-Security-Policy["'][^>]*?content="([^"]+)"/i);
  return m ? m[1].trim().replace(/\s+/g, ' ') : null;
}

/** PURE: build the editor-only _headers text from [{glob, csp}] entries (global strict + per-entry CSP + cache). */
export function buildStandaloneHeaders(entries) {
  const lines = [
    '## Creator Editor STANDALONE production surface — editor-only (separate Pages project).',
    '## Deploy-bundle header overlay. Whole surface is the editor: strict headers are GLOBAL.',
    '',
    '/*',
    ...GLOBAL_EDITOR_HEADERS.map((h) => `  ${h}`),
    '',
    '## Per-entry CSP = page meta CSP TIGHTENED with frame-ancestors \'none\' (header-only directive).',
  ];
  for (const { glob, csp } of entries) {
    lines.push(glob, `  Content-Security-Policy: ${csp}`, '');
  }
  lines.push('/arcade-studio/assets/*', '  Cache-Control: public, max-age=31536000, immutable', '');
  lines.push('/*.html', '  Cache-Control: public, max-age=300, must-revalidate', '');
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  if (outIdx >= 0 && (!args[outIdx + 1] || args[outIdx + 1].startsWith('-'))) {
    console.error('refusing: --out requires a destination path'); process.exit(1);
  }
  const OUT = outIdx >= 0 ? resolve(args[outIdx + 1]) : DEFAULT_OUT;
  if (isUnsafeOut(OUT)) { console.error(`refusing unsafe --out: ${OUT}`); process.exit(1); }

  console.log('Creator Editor STANDALONE production bundle (LOCAL ONLY — separate Pages project, NOT clovelearn.io)');
  console.log(`  source     : ${ROOT}`);
  console.log(`  out        : ${OUT}`);

  // 1. Build + guard the editor artifact (reuses the staging assembler), verify the hardened aggregate.
  console.log('[standalone] building editor artifact …');
  execFileSync('node', [EDITOR_BUILDER, '--out', EDITOR_SRC], { cwd: ROOT, stdio: 'inherit' });
  const editorManifest = JSON.parse(readFileSync(join(EDITOR_SRC, STAGING_MANIFEST), 'utf8'));
  if (editorManifest.aggregate_sha256 !== EXPECTED_EDITOR_AGGREGATE) {
    fail(`editor aggregate mismatch: ${editorManifest.aggregate_sha256} != ${EXPECTED_EDITOR_AGGREGATE} (did the editor HTML/CSP change? update EXPECTED_EDITOR_AGGREGATE)`);
  } else ok(`editor aggregate verified (${EXPECTED_EDITOR_AGGREGATE.slice(0, 12)}…, ${editorManifest.file_count} files; framing hardened via _headers)`);

  // 2. Standalone root = the editor artifact MINUS the staging manifest (editor surface only).
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const editorFiles = walk(EDITOR_SRC)
    .map((f) => relative(EDITOR_SRC, f).split(sep).join('/'))
    .filter((f) => f !== STAGING_MANIFEST);
  const workshopSet = new Set(workshopFileList(ROOT));
  for (const rel of editorFiles) {
    if (rel.startsWith('arcade/creator/') && !workshopSet.has(rel)) { fail(`creator file outside reviewed set: ${rel}`); continue; }
    const dest = join(OUT, rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(EDITOR_SRC, rel), dest);
  }
  ok(`assembled editor-only surface (${editorFiles.length} files)`);

  // 3. Production manifest (deterministic — no timestamp/document_root; no staging name/URL/clovelearn claim).
  const manifest = {
    artifact: 'creator-editor standalone production surface (editor-only)',
    surface: 'standalone-production (dedicated Pages project; separate from the main production zone)',
    deployed: false,
    manifest_name: PRODUCTION_MANIFEST,
    main_commit: editorManifest.main_commit,
    header_policy_mode: HEADER_POLICY_MODE,
    selected_paths: editorManifest.selected_paths,
    editor_file_count: editorManifest.file_count,
    editor_aggregate_sha256: editorManifest.aggregate_sha256,
    files: editorManifest.files,
    boundary: editorManifest.boundary,
  };
  writeFileSync(join(OUT, PRODUCTION_MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
  rmSync(join(OUT, STAGING_MANIFEST), { force: true });
  ok(`wrote ${PRODUCTION_MANIFEST}; ${STAGING_MANIFEST} absent`);

  // 4. Editor-strict _headers. The header CSP = the page meta CSP TIGHTENED with frame-ancestors 'none'
  //    (header-only — invalid in <meta>), so it is the host-independent framing control that the failed
  //    wild-hat-6257 XFO override could not provide. Header mirrors meta + adds frame-ancestors.
  const entries = EXPECTED_ENTRY_HTML.map((rel) => {
    const meta = metaCspOf(readFileSync(join(OUT, rel), 'utf8'));
    if (!meta) { fail(`${rel}: no meta CSP`); return { glob: editorPathGlob(rel), csp: '' }; }
    cspViolations(rel, meta).forEach(fail);
    if (/frame-ancestors/.test(meta)) fail(`${rel}: frame-ancestors must NOT be in <meta> (header-only; browsers ignore + error on it)`);
    return { glob: editorPathGlob(rel), csp: `${meta}; frame-ancestors 'none'` };
  });
  writeFileSync(join(OUT, '_headers'), buildStandaloneHeaders(entries) + '\n');
  ok(`generated editor-strict _headers (global XFO DENY + strict referrer; ${entries.length} per-entry CSP blocks)`);

  // 5. Fail-closed guards over the assembled surface.
  const files = walk(OUT).map((f) => relative(OUT, f).split(sep).join('/'));

  if (files.includes(STAGING_MANIFEST)) fail(`${STAGING_MANIFEST} present`);
  if (!files.includes(PRODUCTION_MANIFEST)) fail(`${PRODUCTION_MANIFEST} missing`);
  for (const rel of EXPECTED_ENTRY_HTML) if (!files.includes(rel)) fail(`expected editor entry missing: ${rel}`);

  const studioLeak = files.filter((f) => f.startsWith('arcade-studio/')
    && f !== 'arcade-studio/index.html'
    && !(f.startsWith('arcade-studio/assets/') && STUDIO_ALLOWED_EXT.has(extname(f))));
  if (studioLeak.length) fail(`arcade-studio non-built-asset leak: ${studioLeak.slice(0, 8).join(', ')}`);
  else ok('arcade-studio = built index.html + assets only (no src/test/package/vite.config)');

  const creatorLeak = files.filter((f) => f.startsWith('arcade/creator/') && !workshopSet.has(f));
  if (creatorLeak.length) fail(`arcade/creator outside reviewed set: ${creatorLeak.slice(0, 8).join(', ')}`);
  else ok('arcade/creator ⊆ reviewed workshop set');

  // No sourcemaps / source paths, and CRITICALLY no Cloudflare analytics beacon anywhere on the surface.
  let leakHit = null, beaconHit = null;
  for (const f of files) {
    if (f === PRODUCTION_MANIFEST) continue;
    if (LEAK_PATTERNS.some((re) => re.test(f))) { leakHit = `${f} (source/dev/test/.map path)`; break; }
    const c = readFileSync(join(OUT, f), 'utf8');
    if (/sourcesContent/.test(c)) { leakHit = `${f} embeds sourcesContent`; break; }
    if (/sourceMappingURL=/.test(c)) { leakHit = `${f} has sourceMappingURL`; break; }
    for (const s of FORBIDDEN_STRINGS) if (c.includes(s)) { beaconHit = `${f} contains '${s}'`; break; }
    if (beaconHit) break;
  }
  if (leakHit) fail(`sourcemap / source path leak: ${leakHit}`);
  else ok('no .map / sourcesContent / sourceMappingURL / source path');
  if (beaconHit) fail(`Cloudflare analytics beacon string in surface: ${beaconHit}`);
  else ok('no Cloudflare Web Analytics beacon string (static.cloudflareinsights.com / beacon.min.js)');

  // _headers structure: global strict + per-entry CSP present; every editor CSP carries frame-ancestors.
  const hdr = readFileSync(join(OUT, '_headers'), 'utf8');
  if (!/^\s*X-Frame-Options: DENY\s*$/m.test(hdr)) fail('_headers global XFO not DENY');
  if (!/^\s*Referrer-Policy: strict-origin-when-cross-origin\s*$/m.test(hdr)) fail('_headers global referrer not strict-origin');
  for (const { glob, csp } of entries) {
    if (!hdr.includes(glob)) fail(`_headers missing block for ${glob}`);
    if (csp && !/frame-ancestors\s+'none'/.test(csp)) fail(`${glob}: header CSP missing frame-ancestors`);
  }
  if (fails.length === 0) ok('_headers valid (global strict + per-entry CSP with frame-ancestors)');

  if (fails.length) {
    console.error(`\nCREATOR EDITOR STANDALONE PRODUCTION: FAIL (${fails.length} issue(s)) — surface at ${OUT}, NOT for deploy`);
    process.exit(1);
  }

  // 6. Local-only report (OUTSIDE the deploy root → never uploaded). Timestamp lives here only.
  const prodFiles = walk(OUT).map((f) => relative(OUT, f).split(sep).join('/')).sort();
  const report = {
    main_commit: editorManifest.main_commit,
    editor_aggregate_sha256: editorManifest.aggregate_sha256,
    editor_file_count: editorManifest.file_count,
    standalone_root: OUT,
    standalone_root_file_count: prodFiles.length,
    manifest: PRODUCTION_MANIFEST,
    header_policy_mode: HEADER_POLICY_MODE,
    target: 'dedicated Cloudflare Pages project (e.g. clove-creator-editor-production) — NOT clovelearn.io',
    rollback_prerequisites: 'capture new Pages project deployment id before deploy; rollback = delete/rollback that Pages deployment (zero clovelearn.io blast radius)',
    deployed: false,
    generated: new Date().toISOString(),
  };
  writeFileSync('/tmp/creator-editor-standalone-production-report.json', JSON.stringify(report, null, 2) + '\n');

  console.log('\nCREATOR EDITOR STANDALONE PRODUCTION: PASS');
  console.log(`  surface root      : ${OUT}`);
  console.log(`  file count        : ${prodFiles.length}`);
  console.log(`  editor aggregate  : ${editorManifest.aggregate_sha256}`);
  console.log(`  manifest          : ${PRODUCTION_MANIFEST}  (staging marker absent)`);
  console.log(`  header policy     : ${HEADER_POLICY_MODE}  (global XFO DENY + strict referrer + frame-ancestors)`);
  console.log(`  report            : /tmp/creator-editor-standalone-production-report.json (local-only)`);
  console.log(`  NOT deployed / NOT uploaded / NOT pushed.`);
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
