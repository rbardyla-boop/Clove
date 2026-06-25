/**
 * Creator Editor PRODUCTION RELEASE assembly + guard (R8, Option A — LOCAL ONLY, NOT a deploy).
 *
 * Assembles ONE production deploy bundle (default /tmp/creator-editor-production-root) by OVERLAYING
 * the reviewed Creator Editor artifact onto the normal curated production upload tree. It changes no
 * source, deploys nothing, and keeps the curated denylist intact:
 *   1. build the curated production tree (build-curated-client-upload.mjs --out PROD_ROOT) — 270-ish
 *      git-tracked client files, with arcade/creator/** and arcade-studio/** STILL denylisted;
 *   2. build the reviewed editor artifact (build-creator-editor-staging.mjs) and verify its canonical
 *      aggregate, then overlay ONLY its built files (hub + 4 tools + built studio dist) into the holes
 *      the denylist left at /arcade/creator/** and /arcade-studio/** (no Vite source, no .map);
 *   3. rename the staging manifest → _CREATOR_EDITOR_MANIFEST.json (the staging marker never ships);
 *   4. regenerate the deploy-bundle _headers: the global /* block PRESERVES current live behavior
 *      (X-Frame-Options: SAMEORIGIN, Referrer-Policy: same-origin — do NOT flip the whole app), and
 *      each editor path gets stricter R7-mirrored headers (XFO DENY, Referrer strict-origin, exact
 *      per-page CSP derived from the page meta so header == meta by construction);
 *   5. fail closed on any source leak, staging marker, .map, live-loader, or CSP weakening.
 *
 * Boundary: no deploy, no push, no Cloudflare/Worker/DO/D1/R2/route/DNS change. The CF-2 live loader
 * must be literally false (the editor builder already refuses otherwise). This script is itself
 * denylisted from the curated production upload (FORBIDDEN_UPLOAD_FILES) — see curated-upload tests.
 *
 * Usage:  node scripts/build-creator-editor-production-release.mjs [--out <dir>]
 *
 * NOTE on header precedence: Cloudflare `_headers` applies the most specific matching rule per header,
 * but the production static host (wild-hat-6257, Workers static assets) also carries a global app CSP,
 * so the FINAL served header precedence MUST be proven live at the deploy/verify gate (R9). This script
 * guarantees only the generated FILE STRUCTURE (global preserves live; editor blocks strict + meta-mirrored).
 */
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep, relative, extname } from 'node:path';
import { homedir } from 'node:os';
import { workshopFileList } from './build-creator-workshop-bundle.mjs';
import { EXPECTED_ENTRY_HTML, SANDBOX_ENTRY, parseCsp, cspViolations } from './build-creator-editor-staging.mjs';
import { PUBLIC_CREATOR_ALLOW } from './build-curated-client-upload.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CURATED_BUILDER = join(ROOT, 'scripts', 'build-curated-client-upload.mjs');
const EDITOR_BUILDER = join(ROOT, 'scripts', 'build-creator-editor-staging.mjs');
const ROOT_HEADERS = join(ROOT, '_headers');

const DEFAULT_PROD_ROOT = '/tmp/creator-editor-production-root';
const EDITOR_STAGING_ROOT = '/tmp/creator-editor-production-staging-src'; // editor artifact source (separate temp)
const STAGING_MANIFEST = '_STAGING_MANIFEST.json';
const PRODUCTION_MANIFEST = '_CREATOR_EDITOR_MANIFEST.json';
// Re-pinned for CR1B (sandbox-runner.mjs debug-hook gating + import-arcade-package.mjs (0,eval)/this[
// scan hardening) and again for CR1C: the one-click builder→sandbox playtest handoff adds a same-origin
// sessionStorage write in arcade-builder.mjs + the auto-load consume in sandbox-runner.mjs (data handoff
// only; the sandbox re-gates via importArcadePackage + null-origin iframe). Re-pinned again for the maker-UX
// pass: PRESENTATION-ONLY restyle of the builder/sandbox HTML to the arcade identity + sandbox NOW PLAYING /
// Restart (no gate/CSP/boundary change). Security-reviewed re-bless of the reviewed bundle, not unreviewed drift.
const EXPECTED_EDITOR_AGGREGATE = 'a4ff5d23bc8ae76e734a1aa220aef06c2410912cafd8f76bd90e4bc310f2ea11';
const HEADER_POLICY_MODE = 'preserve-live-global-editor-strict';

// The two global headers that drifted (committed = stricter, live = looser). The operator decision for
// R8 is to PRESERVE LIVE for non-editor paths — i.e. NOT flip the whole site during the editor release.
const GLOBAL_LIVE_OVERRIDES = Object.freeze([
  { committed: 'X-Frame-Options: DENY', live: 'X-Frame-Options: SAMEORIGIN' },
  { committed: 'Referrer-Policy: strict-origin-when-cross-origin', live: 'Referrer-Policy: same-origin' },
]);

// Header-layer protections applied to EVERY editor path (CSP is added separately, per-page from meta).
const EDITOR_PATH_HEADERS = Object.freeze([
  'X-Frame-Options: DENY',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'X-Content-Type-Options: nosniff',
  'Permissions-Policy: camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security: max-age=31536000; includeSubDomains',
]);

const STUDIO_ALLOWED_EXT = new Set(['.html', '.js', '.css']);
const LEAK_PATTERNS = [
  /(^|\/)(src|test|tests|node_modules)\//, /(^|\/)vite\.config\./, /package(-lock)?\.json$/,
  /\.test\./, /\.spec\./, /\.map$/,
];

const fails = [];
const fail = (m) => { fails.push(m); console.error(`FAIL: ${m}`); };
const ok = (m) => console.log(`  ok   ${m}`);

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = join(dir, d.name);
  return d.isDirectory() ? walk(p) : [p];
});

/** PURE: refuse dangerous --out (mirrors the other builders; subtree-safe vs the prod upload dir). */
export function isUnsafeProdOut(out, root = ROOT) {
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

/**
 * PURE: take the committed root _headers text and return it with the global /* block reverted to the
 * current LIVE values for the two drifted headers (XFO, Referrer). Each committed line must appear
 * EXACTLY ONCE (it only lives in the global block) — 0 or >1 occurrences fail closed, so a future shape
 * change to _headers can't silently mis-apply.
 */
export function revertGlobalDriftHeaders(headersText) {
  let out = headersText;
  for (const { committed, live } of GLOBAL_LIVE_OVERRIDES) {
    const occ = out.split(committed).length - 1;
    if (occ !== 1) throw new Error(`expected exactly 1 '${committed}' in root _headers, found ${occ}`);
    out = out.replace(committed, live);
  }
  return out;
}

/** PURE: build the appended editor path-scoped _headers blocks from [{glob, csp}] entries + cache. */
export function editorHeaderBlocks(entries) {
  const lines = ['', '## ── R8 Creator Editor path-scoped headers (strict; mirror page meta CSP) ──'];
  for (const { glob, csp } of entries) {
    lines.push(glob);
    for (const h of EDITOR_PATH_HEADERS) lines.push(`  ${h}`);
    lines.push(`  Content-Security-Policy: ${csp}`);
    lines.push('');
  }
  // Hashed studio assets are immutable; editor HTML stays fresh.
  lines.push('/arcade-studio/assets/*', '  Cache-Control: public, max-age=31536000, immutable', '');
  return lines.join('\n');
}

/** Read an entry HTML's meta CSP (throws if absent — every editor entry must carry one). */
function readMetaCsp(absHtml, relForMsg) {
  const html = readFileSync(absHtml, 'utf8');
  const m = html.match(/http-equiv=["']Content-Security-Policy["'][^>]*?content="([^"]+)"/i);
  if (!m) throw new Error(`${relForMsg}: no Content-Security-Policy meta`);
  return m[1].trim().replace(/\s+/g, ' ');
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  if (outIdx >= 0 && (!args[outIdx + 1] || args[outIdx + 1].startsWith('-'))) {
    console.error('refusing: --out requires a destination path'); process.exit(1);
  }
  const PROD = outIdx >= 0 ? resolve(args[outIdx + 1]) : DEFAULT_PROD_ROOT;
  if (isUnsafeProdOut(PROD)) { console.error(`refusing unsafe --out: ${PROD}`); process.exit(1); }

  console.log('Creator Editor PRODUCTION RELEASE bundle (LOCAL ONLY — not a deploy, not an upload)');
  console.log(`  source       : ${ROOT}`);
  console.log(`  prod root    : ${PROD}`);
  console.log(`  model        : curated tree + reviewed editor overlay (Option A); denylist intact`);

  // 1. Curated production tree (builder rms/recreates PROD; ships committed _headers/_redirects + 270 files).
  console.log('[prod] building curated production tree …');
  execFileSync('node', [CURATED_BUILDER, '--out', PROD], { cwd: ROOT, stdio: 'inherit' });

  // 2. Reviewed editor artifact into a SEPARATE temp; verify canonical aggregate before overlaying.
  console.log('[prod] building reviewed editor artifact …');
  execFileSync('node', [EDITOR_BUILDER, '--out', EDITOR_STAGING_ROOT], { cwd: ROOT, stdio: 'inherit' });
  const stagingManifest = JSON.parse(readFileSync(join(EDITOR_STAGING_ROOT, STAGING_MANIFEST), 'utf8'));
  if (stagingManifest.aggregate_sha256 !== EXPECTED_EDITOR_AGGREGATE) {
    fail(`editor aggregate mismatch: ${stagingManifest.aggregate_sha256} != ${EXPECTED_EDITOR_AGGREGATE}`);
  } else ok(`editor canonical aggregate verified (${EXPECTED_EDITOR_AGGREGATE.slice(0, 12)}…, ${stagingManifest.file_count} files)`);

  // 3. Overlay the editor artifact (every file EXCEPT the staging manifest) into the holes the denylist left.
  const editorFiles = walk(EDITOR_STAGING_ROOT)
    .map((f) => relative(EDITOR_STAGING_ROOT, f).split(sep).join('/'))
    .filter((f) => f !== STAGING_MANIFEST);
  const workshopSet = new Set(workshopFileList(ROOT));
  let overlaid = 0;
  for (const rel of editorFiles) {
    // Defense-in-depth: every creator-tree file must be in the reviewed workshop set; studio = built assets only.
    if (rel.startsWith('arcade/creator/') && !workshopSet.has(rel)) { fail(`overlay creator file outside reviewed set: ${rel}`); continue; }
    if (rel.startsWith('arcade-studio/') && rel !== 'arcade-studio/index.html'
        && !(rel.startsWith('arcade-studio/assets/') && STUDIO_ALLOWED_EXT.has(extname(rel)))) {
      fail(`overlay studio file outside built-asset set: ${rel}`); continue;
    }
    const dest = join(PROD, rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(EDITOR_STAGING_ROOT, rel), dest);
    overlaid++;
  }
  ok(`overlaid ${overlaid} reviewed editor file(s) at /arcade/creator/** and /arcade-studio/**`);

  // 4. Production manifest (deterministic — NO timestamp/document_root; staging marker must be absent).
  const prodManifest = {
    artifact: 'creator-editor production release (Option A overlay)',
    deployed: false,
    manifest_name: PRODUCTION_MANIFEST,
    main_commit: stagingManifest.main_commit,
    header_policy_mode: HEADER_POLICY_MODE,
    selected_paths: stagingManifest.selected_paths,
    source_prefixes_excluded: ['arcade/creator/ (source — overlay ships built artifact only)', 'arcade-studio/ (Vite source)'],
    editor_file_count: stagingManifest.file_count,
    editor_aggregate_sha256: stagingManifest.aggregate_sha256,
    files: stagingManifest.files,
    boundary: stagingManifest.boundary,
  };
  writeFileSync(join(PROD, PRODUCTION_MANIFEST), JSON.stringify(prodManifest, null, 2) + '\n');
  rmSync(join(PROD, STAGING_MANIFEST), { force: true }); // defensive (overlay already excluded it)
  ok(`wrote ${PRODUCTION_MANIFEST}; ${STAGING_MANIFEST} absent`);

  // 5. Regenerate the deploy-bundle _headers: global preserves live; editor paths strict + meta-mirrored.
  let committedHeaders;
  try { committedHeaders = revertGlobalDriftHeaders(readFileSync(ROOT_HEADERS, 'utf8')); }
  catch (e) { fail(`cannot build production _headers: ${e.message}`); committedHeaders = null; }
  if (committedHeaders) {
    const entries = EXPECTED_ENTRY_HTML.map((rel) => {
      const csp = readMetaCsp(join(PROD, rel), rel);
      const v = cspViolations(rel, csp); // header == meta by construction; re-assert meta itself is clean
      if (v.length) v.forEach(fail);
      return { glob: editorPathGlob(rel), csp };
    });
    writeFileSync(join(PROD, '_headers'), committedHeaders.trimEnd() + '\n' + editorHeaderBlocks(entries) + '\n');
    ok(`generated _headers: global preserves live (SAMEORIGIN/same-origin) + ${entries.length} strict editor blocks`);
  }

  // 6. Fail-closed guards over the assembled production root.
  const files = walk(PROD).map((f) => relative(PROD, f).split(sep).join('/'));

  if (files.includes(STAGING_MANIFEST)) fail(`${STAGING_MANIFEST} present in production root`);
  if (!files.includes(PRODUCTION_MANIFEST)) fail(`${PRODUCTION_MANIFEST} missing from production root`);

  // Editor entry pages present + their built studio dist; no Vite source / test / package / config.
  for (const rel of EXPECTED_ENTRY_HTML) if (!files.includes(rel)) fail(`expected editor entry missing: ${rel}`);
  const studioLeak = files.filter((f) => f.startsWith('arcade-studio/')
    && f !== 'arcade-studio/index.html'
    && !(f.startsWith('arcade-studio/assets/') && STUDIO_ALLOWED_EXT.has(extname(f))));
  if (studioLeak.length) fail(`arcade-studio non-built-asset leak: ${studioLeak.slice(0, 8).join(', ')}`);
  else ok('arcade-studio overlay = built index.html + assets only (no src/test/package/vite.config)');

  // Every arcade/creator file in prod root must be reviewed: either in the editor workshop overlay set,
  // or in the enumerated CR1B public local-maker carve-out (the reviewed local-only maker loop the
  // curated upload ships separately from the editor overlay). No raw extra creator source.
  const creatorLeak = files.filter((f) => f.startsWith('arcade/creator/') && !workshopSet.has(f) && !PUBLIC_CREATOR_ALLOW.has(f));
  if (creatorLeak.length) fail(`arcade/creator file(s) outside reviewed set: ${creatorLeak.slice(0, 8).join(', ')}`);
  else ok('arcade/creator overlay ⊆ reviewed workshop set ∪ public local-maker carve-out');

  // .map / sourcesContent / sourceMappingURL anywhere in the EDITOR overlay subtrees (curated app trusted separately).
  const overlaySubtree = (f) => f.startsWith('arcade/creator/') || f.startsWith('arcade-studio/');
  let mapHit = null;
  for (const f of files.filter(overlaySubtree)) {
    if (f.endsWith('.map')) { mapHit = `${f} (sourcemap)`; break; }
    if (LEAK_PATTERNS.some((re) => re.test(f))) { mapHit = `${f} (source/dev/test path)`; break; }
    const c = readFileSync(join(PROD, f), 'utf8');
    if (/sourcesContent/.test(c)) { mapHit = `${f} embeds sourcesContent`; break; }
    if (/sourceMappingURL=/.test(c)) { mapHit = `${f} has sourceMappingURL`; break; }
  }
  if (mapHit) fail(`sourcemap / embedded source in editor overlay: ${mapHit}`);
  else ok('no .map / sourcesContent / sourceMappingURL / source path in editor overlay');

  // Generated _headers structure: global preserves live; editor blocks strict; no editor-path unsafe-eval.
  const hdrText = existsSync(join(PROD, '_headers')) ? readFileSync(join(PROD, '_headers'), 'utf8') : '';
  if (!/^\s*X-Frame-Options: SAMEORIGIN\s*$/m.test(hdrText)) fail('_headers global X-Frame-Options not preserved as SAMEORIGIN');
  if (!/^\s*Referrer-Policy: same-origin\s*$/m.test(hdrText)) fail('_headers global Referrer-Policy not preserved as same-origin');
  for (const rel of EXPECTED_ENTRY_HTML) {
    const glob = editorPathGlob(rel);
    if (!hdrText.includes(glob)) fail(`_headers missing editor block for ${glob}`);
  }
  if (fails.length === 0) ok('_headers structure valid (live global preserved + strict editor blocks)');

  if (fails.length) {
    console.error(`\nCREATOR EDITOR PRODUCTION RELEASE: FAIL (${fails.length} issue(s)) — bundle at ${PROD}, NOT for deploy`);
    process.exit(1);
  }

  // 7. Local-only report (OUTSIDE the deployed root → never uploaded). Timestamp lives here only.
  const prodFiles = walk(PROD).map((f) => relative(PROD, f).split(sep).join('/')).sort();
  const report = {
    main_commit: stagingManifest.main_commit,
    editor_aggregate_sha256: stagingManifest.aggregate_sha256,
    editor_file_count: stagingManifest.file_count,
    production_root: PROD,
    production_root_file_count: prodFiles.length,
    production_manifest: PRODUCTION_MANIFEST,
    paths_added: EXPECTED_ENTRY_HTML.map(editorPathGlob),
    source_prefixes_excluded: ['arcade/creator/', 'arcade-studio/', 'tests/', 'docs/', 'workers/'],
    header_policy_mode: HEADER_POLICY_MODE,
    rollback_prerequisites: 'capture current wild-hat-6257 version id + live headers BEFORE deploy; rollback = wrangler rollback or re-upload prior curated tree',
    deployed: false,
    generated: new Date().toISOString(),
  };
  writeFileSync('/tmp/creator-editor-production-release-report.json', JSON.stringify(report, null, 2) + '\n');

  console.log('\nCREATOR EDITOR PRODUCTION RELEASE: PASS');
  console.log(`  production root file count : ${prodFiles.length}`);
  console.log(`  editor aggregate          : ${stagingManifest.aggregate_sha256}`);
  console.log(`  manifest                  : ${PRODUCTION_MANIFEST}  (staging marker absent)`);
  console.log(`  header policy             : ${HEADER_POLICY_MODE}`);
  console.log(`  report                    : /tmp/creator-editor-production-release-report.json (local-only)`);
  console.log(`  NOT deployed / NOT uploaded / NOT pushed.`);
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
