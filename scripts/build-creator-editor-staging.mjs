/**
 * Creator Editor STAGING artifact builder + guard (R3, Option A — LOCAL ONLY, NOT a deploy).
 *
 * Assembles ONE self-contained static staging root (default /tmp/creator-editor-staging-root) that is
 * the served document root for a later staging/production deploy. It contains:
 *   - the Creator Corner hub at  /arcade/creator/creator-corner/   (static, script-src 'none'),
 *   - the four approved Creator tools + their shared same-origin deps under /arcade/creator/… ,
 *   - the BUILT, stripped, guarded Arcade Studio candidate mounted at  /arcade-studio/  (built assets
 *     only — no source, no .map).
 *
 * It REUSES (does not duplicate) the two existing assemblers:
 *   - `workshopFileList()` + `isForbiddenInBundle()` from build-creator-workshop-bundle.mjs select the
 *     hub + four tools + shared deps and refuse live-floor / node-CLI surfaces, and
 *   - `arcade-studio/scripts/build-static-release.mjs` (shelled out with --out) builds + strips + guards
 *     the studio candidate.
 * Then it re-runs the UNION of guards over the whole root and emits a sha256 manifest for rollback.
 *
 * Boundary: no deploy, no push, no network/upload/live-loader surface. The CF-7 live loader must be
 * literally disabled (LIVE_WORLD_LOADER_ENABLED = false) or this refuses to build. This builder is
 * denylisted from the curated production upload (scripts/build-curated-client-upload.mjs) — see the
 * FORBIDDEN_UPLOAD_FILES coupling + tests/creator/curated-upload.test.mjs.
 *
 * Usage:  node scripts/build-creator-editor-staging.mjs [--out <dir>] [--list]
 */
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep, relative, extname } from 'node:path';
import { homedir } from 'node:os';
import { workshopFileList, isForbiddenInBundle } from './build-creator-workshop-bundle.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CREATOR = 'arcade/creator';
const HUB = `${CREATOR}/creator-corner/index.html`;
const LOADER = `${CREATOR}/approval/approved-loader.mjs`;
const STUDIO_RELEASE = join(ROOT, 'arcade-studio', 'scripts', 'build-static-release.mjs');

// The entry HTML pages that MUST be present and CSP-checked. Note: the guard does not trust this list
// alone — it discovers every served *.html in the assembled root and CSP-checks all of them, then
// asserts each expected entry is among them. So a future tool whose index.html is copied in (but not
// added here) is still CSP-checked, never silently bypassed.
const EXPECTED_ENTRY_HTML = Object.freeze([
  `${CREATOR}/creator-corner/index.html`,
  `${CREATOR}/arcade-builder/index.html`,
  `${CREATOR}/arcade-sandbox/index.html`,
  `${CREATOR}/block-editor/index.html`,
  `${CREATOR}/layered-editor/index.html`,
  'arcade-studio/index.html',
]);
// The ONLY entry permitted the looser sandbox CSP (script-src 'unsafe-inline' for its srcdoc bootstrap,
// frame-src 'self' for its hardened local iframe). Every other entry must be stricter.
const SANDBOX_ENTRY = `${CREATOR}/arcade-sandbox/index.html`;
// Only these extensions may appear in the mounted studio candidate (no .map — built output only).
const STUDIO_ALLOWED_EXT = new Set(['.html', '.js', '.css']);
// Belt-and-suspenders path patterns that must never appear anywhere in the staging root.
const LEAK_PATTERNS = [
  /(^|\/)(src|test|tests|node_modules|docs|\.claude)\//,
  /(^|\/)vite\.config\./, /package(-lock)?\.json$/, /\.test\./, /\.spec\./, /\.map$/,
];

const fails = [];
const fail = (m) => { fails.push(m); console.error(`FAIL: ${m}`); };
const ok = (m) => console.log(`  ok   ${m}`);

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = join(dir, d.name);
  return d.isDirectory() ? walk(p) : [p];
});

/**
 * PURE: is this --out destination dangerous? Refuses the filesystem root, home, the repo (or any
 * ancestor of it), and the production upload dir OR ANY SUBDIRECTORY of it — a child path must never
 * receive a staging artifact. `prodUpload + sep` matches only true children, so sibling names such as
 * `clovelearn-phase6-client-upload-old` are NOT falsely rejected.
 */
export function isUnsafeOut(out, root = ROOT) {
  const abs = resolve(out);
  const prodUpload = resolve(join(homedir(), 'Downloads', 'clovelearn-phase6-client-upload'));
  const exact = [resolve('/'), resolve(homedir()), resolve(root), prodUpload];
  const isAncestorOfRepo = root === abs || root.startsWith(abs + sep);
  const underProdUpload = abs === prodUpload || abs.startsWith(prodUpload + sep);
  return exact.includes(abs) || isAncestorOfRepo || underProdUpload;
}

/** Refuse dangerous destinations (mirrors the workshop/curated guards) — exact dir AND any subtree. */
function assertSafeOut(out) {
  if (isUnsafeOut(out)) { console.error(`refusing unsafe --out: ${resolve(out)}`); process.exit(1); }
}

/** The CF-2 live-loader kill-switch must be literally false (defense-in-depth, same check the workshop uses). */
function assertLiveLoaderDisabled() {
  const src = readFileSync(join(ROOT, LOADER), 'utf8');
  if (!/export\s+const\s+LIVE_WORLD_LOADER_ENABLED\s*=\s*false\s*;/.test(src)) {
    console.error('REFUSING: LIVE_WORLD_LOADER_ENABLED is not literally false in approved-loader.mjs');
    process.exit(1);
  }
}

/** Parse a CSP string into { directive: [tokens] }. */
function parseCsp(csp) {
  const map = {};
  for (const part of csp.split(';')) {
    const toks = part.trim().split(/\s+/).filter(Boolean);
    if (toks.length) map[toks[0].toLowerCase()] = toks.slice(1);
  }
  return map;
}

/**
 * PURE: return the list of CSP-policy violations for an entry page ([] = clean). Enforces, per page:
 *  - meta-CSP present; no 'unsafe-eval'; no external http(s) host anywhere;
 *  - script-src present; tokens ⊆ {'self','none'} (+ 'unsafe-inline' ONLY on the sandbox entry); no wildcard;
 *  - frame-src bounded: explicit ∈ {'none','self'} (sandbox may use 'self'); if ABSENT it falls back to
 *    default-src, which must itself be bounded (∈ {'none','self'}) — so block/layered (no frame-src,
 *    default-src 'self') pass without an artifact edit, while an unbounded default-src would fail;
 *  - connect-src ∈ {'self','none'}; object-src/base-uri/form-action = 'none'.
 * The sandbox exception is intentionally the ONLY relaxation and is keyed to its exact path.
 */
function cspViolations(relPath, csp, sandboxEntry = SANDBOX_ENTRY) {
  const out = [];
  if (/unsafe-eval/i.test(csp)) out.push(`${relPath}: CSP allows 'unsafe-eval'`);
  if (/https?:\/\//i.test(csp)) out.push(`${relPath}: CSP references an external http(s) host`);
  const d = parseCsp(csp);
  const isSandbox = relPath === sandboxEntry;
  const hasWildcard = (toks) => toks.some((t) => t.includes('*'));

  // script-src — must exist; bounded token set; sandbox alone may carry 'unsafe-inline'.
  const script = d['script-src'] || [];
  const scriptAllowed = isSandbox ? new Set(["'self'", "'none'", "'unsafe-inline'"]) : new Set(["'self'", "'none'"]);
  if (!script.length) out.push(`${relPath}: CSP missing script-src`);
  else {
    const bad = script.filter((t) => !scriptAllowed.has(t));
    if (bad.length) out.push(`${relPath}: script-src has disallowed token(s): ${bad.join(' ')}`);
    if (hasWildcard(script)) out.push(`${relPath}: script-src has a wildcard`);
  }

  // connect-src — same-origin static or none.
  const connect = d['connect-src'] || [];
  if (!connect.length) out.push(`${relPath}: CSP missing connect-src`);
  else if (!connect.every((t) => t === "'self'" || t === "'none'")) out.push(`${relPath}: connect-src beyond self/none → ${connect.join(' ')}`);

  // frame-src — bounded explicitly, or via a bounded default-src fallback.
  const frame = d['frame-src'];
  const dflt = d['default-src'] || [];
  if (frame && frame.length) {
    if (!frame.every((t) => t === "'none'" || t === "'self'")) out.push(`${relPath}: frame-src beyond none/self → ${frame.join(' ')}`);
  } else if (!(dflt.length && dflt.every((t) => t === "'self'" || t === "'none'"))) {
    out.push(`${relPath}: frame-src absent and default-src not bounded → ${dflt.join(' ') || '(absent)'}`);
  }

  // Hard-locked directives on every entry page.
  for (const dir of ['object-src', 'base-uri', 'form-action']) {
    const v = d[dir] || [];
    if (!(v.length === 1 && v[0] === "'none'")) out.push(`${relPath}: ${dir} is not 'none' → ${v.join(' ') || '(absent)'}`);
  }
  return out;
}

/** Read an entry page's meta-CSP and record violations (or an ok line). */
function checkEntryCsp(relPath, abs) {
  const html = readFileSync(abs, 'utf8');
  const m = html.match(/http-equiv=["']Content-Security-Policy["'][^>]*?content="([^"]+)"/i);
  if (!m) { fail(`${relPath}: no Content-Security-Policy meta`); return; }
  const violations = cspViolations(relPath, m[1]);
  if (violations.length) violations.forEach(fail);
  else { const d = parseCsp(m[1]); ok(`${relPath}: CSP strict (script-src ${(d['script-src'] || []).join(' ')}; connect ${(d['connect-src'] || []).join(' ')})`); }
}

function main() {
  const args = process.argv.slice(2);
  const listOnly = args.includes('--list');
  const outIdx = args.indexOf('--out');
  if (outIdx >= 0 && (!args[outIdx + 1] || args[outIdx + 1].startsWith('-'))) {
    console.error('refusing: --out requires a destination path'); process.exit(1);
  }
  const OUT = outIdx >= 0 ? resolve(args[outIdx + 1]) : '/tmp/creator-editor-staging-root';
  const STUDIO_MOUNT = join(OUT, 'arcade-studio');

  // 0. Live-floor kill-switch must be off before we assemble anything.
  assertLiveLoaderDisabled();

  // 1. Select the workshop file set (hub + four tools + shared deps; live-floor + node CLIs refused).
  const workshop = workshopFileList(ROOT);
  const workshopSet = new Set(workshop);
  if (!workshopSet.has(HUB)) { console.error(`REFUSING: hub missing from workshop set (${HUB})`); process.exit(1); }
  const forbidden = workshop.filter(isForbiddenInBundle);
  if (forbidden.length) {
    console.error(`REFUSING: ${forbidden.length} forbidden surface(s) in workshop set:`);
    for (const f of forbidden.slice(0, 12)) console.error(`  ✗ ${f}`);
    process.exit(1);
  }

  console.log('Creator Editor staging artifact (LOCAL ONLY — not a deploy, not the production upload)');
  console.log(`  source      : ${ROOT}`);
  console.log(`  destination : ${OUT}`);
  console.log(`  hub         : /arcade/creator/creator-corner/   studio: /arcade-studio/`);
  console.log(`  workshop files: ${workshop.length}   live loader: OFF (LIVE_WORLD_LOADER_ENABLED=false)`);

  if (listOnly) {
    for (const f of workshop) console.log(`  + ${f}`);
    console.log('  + arcade-studio/ (built+stripped candidate, mounted at /arcade-studio/)');
    process.exit(0);
  }

  assertSafeOut(OUT);

  // 2. Assemble: copy the workshop files at their repo-relative paths, then build the studio candidate
  //    into <OUT>/arcade-studio (the release builder rms/recreates only that subdir).
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  for (const rel of workshop) {
    const src = join(ROOT, rel);
    if (!existsSync(src)) continue;
    const dest = join(OUT, rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest);
  }
  console.log('[staging] building + mounting Arcade Studio candidate at /arcade-studio/ …');
  execFileSync('node', [STUDIO_RELEASE, '--out', STUDIO_MOUNT], { cwd: ROOT, stdio: 'inherit' });

  // 3. UNION guards over the whole assembled root.
  const files = walk(OUT).map((f) => relative(OUT, f).split(sep).join('/'));

  // 3a. Leak guard: every file must be the manifest, an approved workshop file, or a studio built asset.
  const leaks = files.filter((f) => {
    if (f === '_STAGING_MANIFEST.json') return false;
    if (f.startsWith(`${CREATOR}/`)) return !workshopSet.has(f);          // creator subtree = exactly the curated set
    if (f === 'arcade-studio/index.html') return false;                   // studio entry
    if (f.startsWith('arcade-studio/assets/') && STUDIO_ALLOWED_EXT.has(extname(f))) return false; // studio built assets
    return true;                                                          // anything else is a leak
  });
  if (leaks.length) fail(`unexpected/leaked files in staging root:\n    ${leaks.join('\n    ')}`);
  else ok(`only approved hub/tool/dep + studio built assets present (${files.length} files)`);

  // 3b. Belt: no source/dev/test/doc/config/.map path anywhere.
  const suspicious = files.filter((f) => LEAK_PATTERNS.some((re) => re.test(f)));
  if (suspicious.length) fail(`source/dev/test/.map paths in staging root:\n    ${suspicious.join('\n    ')}`);
  else ok('no src/test/docs/.claude/node_modules/config/.map paths');

  // 3c. Forbidden live-floor surfaces anywhere (defense-in-depth vs the workshop allowlist).
  const forbiddenRoot = files.filter(isForbiddenInBundle);
  if (forbiddenRoot.length) fail(`forbidden live-floor surface(s) in staging root: ${forbiddenRoot.join(', ')}`);
  else ok('no live-loader/registry/approval/moderation/district-editor/map-viewer/sdk surfaces');

  // 3d. No sourcemap pointer / embedded source anywhere (studio already stripped; re-verify whole root).
  let mapHit = null;
  for (const f of files) {
    if (f.endsWith('.map')) { mapHit = `${f} (sourcemap file)`; break; }
    const c = readFileSync(join(OUT, f), 'utf8');
    if (/sourcesContent/.test(c)) { mapHit = `${f} embeds sourcesContent`; break; }
    if (/sourceMappingURL=/.test(c)) { mapHit = `${f} has a sourceMappingURL pointer`; break; }
  }
  if (mapHit) fail(`sourcemap / embedded source in staging root: ${mapHit}`);
  else ok('no .map / sourcesContent / sourceMappingURL anywhere');

  // 3e. Per-entry CSP guards — DISCOVERED from the assembled root, not a hardcoded list. Every served
  //     *.html is CSP-checked (so a future-copied entry can never bypass), and each EXPECTED entry must
  //     be present among the discovered set.
  const discovered = files.filter((f) => f.endsWith('.html')).sort();
  for (const rel of EXPECTED_ENTRY_HTML) {
    if (!discovered.includes(rel)) fail(`expected entry page missing from staging root: ${rel}`);
  }
  for (const rel of discovered) checkEntryCsp(rel, join(OUT, rel));
  ok(`CSP-checked ${discovered.length} discovered entry page(s): ${discovered.join(', ')}`);

  if (fails.length) {
    console.error(`\nCREATOR EDITOR STAGING: FAIL (${fails.length} issue(s)) — artifact left at ${OUT} for inspection, no manifest written`);
    process.exit(1);
  }

  // 4. Manifest: per-file sha256 + reproducible aggregate (excludes the manifest itself).
  const commit = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const sorted = [...files].sort();
  const fileHashes = sorted.map((f) => ({ path: f, sha256: createHash('sha256').update(readFileSync(join(OUT, f))).digest('hex') }));
  const agg = createHash('sha256');
  for (const { path, sha256 } of fileHashes) agg.update(`${path}\0${sha256}\n`);
  const aggregate = agg.digest('hex');
  const manifest = {
    artifact: 'creator-editor staging root (Option A)',
    local_only: true,
    deployed: false,
    main_commit: commit,
    build_marker: `r3-staging-${aggregate.slice(0, 12)}`,
    generated: new Date().toISOString(),
    document_root: OUT,
    selected_paths: {
      hub: '/arcade/creator/creator-corner/',
      tools: ['/arcade/creator/arcade-builder/', '/arcade/creator/arcade-sandbox/',
        '/arcade/creator/block-editor/', '/arcade/creator/layered-editor/'],
      arcade_studio: '/arcade-studio/',
    },
    file_count: sorted.length,
    files: fileHashes,
    aggregate_sha256: aggregate,
    boundary: { live_world_loader: 'disabled', upload: 'none', network: 'none/self-static', economy: 'none' },
  };
  writeFileSync(join(OUT, '_STAGING_MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log(`\nCREATOR EDITOR STAGING: PASS`);
  console.log(`  files (incl. manifest) : ${sorted.length + 1}`);
  console.log(`  aggregate sha256       : ${aggregate}`);
  console.log(`  main commit            : ${commit}`);
  console.log(`  served root            : ${OUT}  (serve locally, then open /arcade/creator/creator-corner/)`);
  console.log(`  NOT deployed / NOT staged / NOT pushed.`);
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();

export { EXPECTED_ENTRY_HTML, SANDBOX_ENTRY, parseCsp, cspViolations };
