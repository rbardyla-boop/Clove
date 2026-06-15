/**
 * Creator Foundation CF-2 — curated production client-upload builder.
 *
 * Builds a CLEAN static-upload tree for the production static-assets host (`wild-hat-6257`,
 * clovelearn.io). The production site is uploaded by the owner via the dashboard "Upload static
 * files" flow; the source of truth is the set of GIT-TRACKED files (so node_modules/.git/.env/
 * .wrangler/dist are excluded by construction), MINUS an explicit denylist of operator tooling,
 * tests, docs and server source. Most importantly it excludes `arcade/creator/**`, which CF-1 made
 * git-tracked and which must NOT be published until a gated loader phase deliberately exposes it.
 *
 *   node scripts/build-curated-client-upload.mjs                 # → ~/Downloads/clovelearn-phase6-client-upload
 *   node scripts/build-curated-client-upload.mjs --out /tmp/x    # custom destination
 *   node scripts/build-curated-client-upload.mjs --list          # print the curated file list, copy nothing
 *
 * Exits non-zero (and copies nothing) if any FORBIDDEN path would be included — a hard guard against
 * accidentally shipping the creator tools, the Worker source, or secrets. Changes no Worker/DO/route
 * and deploys nothing.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep } from 'node:path';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Path PREFIXES that must never reach the production static upload. Matched against POSIX-style
 * repo-relative paths. A trailing '/' means "this directory and everything under it".
 *
 * NOTE: `scripts/` is intentionally NOT excluded — the production city loads `/scripts/three.min.js`
 * (and other vendored libs) at runtime, so those assets must ship. The inert dev `.mjs`/`.py`/`.sh`
 * helpers in `scripts/` are harmless static files if served and are never fetched by any page.
 */
export const FORBIDDEN_UPLOAD_PREFIXES = Object.freeze([
  'arcade/creator/',   // creator/editor tooling — the CF-2 leak this script exists to prevent
  'arcade-studio/',    // standalone local Vite+Three.js creator studio — local/data-only dev tool, never ships
  'arcade/hiveworld-agents/', // W-4 simulator lab (agent ledger) — never ships until W-6 is authorized
  'arcade/virtual-arcade/',   // design docs + v0 prototype reference — not a production surface
  'tests/',            // test code
  'docs/',             // documentation
  'workers/',          // Worker/DO source (deployed separately via wrangler, not via static upload)
  'tools/',            // local operator tooling (e.g. asset station), if present
  'electron-app/',     // desktop wrapper, not the web client
  '.claude/',          // agent config
  '.powerplant/',      // dogfood tooling config
  '.github/',          // CI config
  '.git/',             // VCS (never tracked anyway; defensive)
  '.wrangler/',        // wrangler cache (gitignored; defensive)
  'node_modules/',     // deps (untracked; defensive)
  'dist/',             // build output (gitignored; defensive)
]);

/** Exact repo-relative files that must never be uploaded (secrets / dev manifests / local dev tooling). */
export const FORBIDDEN_UPLOAD_FILES = Object.freeze([
  '.gitignore', 'package.json', 'package-lock.json',
  // Local-only Creator Corner workshop bundler — dev tooling, must not ride along in the public payload.
  // (scripts/ is otherwise NOT excluded because the production city loads vendored libs like three.min.js.)
  'scripts/build-creator-workshop-bundle.mjs',
  // Local-only Creator Editor staging assembler (R3) — same reason; assembles a staging root, never ships.
  'scripts/build-creator-editor-staging.mjs',
  // Local-only Creator Editor PRODUCTION RELEASE assembler (R8) — same reason; assembles a deploy
  // bundle from the curated tree + reviewed editor overlay, never ships as a static asset itself.
  'scripts/build-creator-editor-production-release.mjs',
  // Local-only Creator Editor STANDALONE production assembler (R8 remediation) — same reason; builds the
  // editor-only surface for a separate Pages project, never ships in the clovelearn.io curated upload.
  'scripts/build-creator-editor-standalone-production.mjs',
]);

/** PURE: is this POSIX repo-relative path excluded from the curated client upload? */
export function isExcludedFromUpload(relPath) {
  const p = String(relPath).split('\\').join('/').replace(/^\.\//, '');
  if (FORBIDDEN_UPLOAD_FILES.includes(p)) return true;
  if (/^\.env(\.|$)/.test(p)) return true;                 // .env, .env.local, .env.production, …
  return FORBIDDEN_UPLOAD_PREFIXES.some((pre) =>
    pre.endsWith('/') ? (p === pre.slice(0, -1) || p.startsWith(pre)) : (p === pre || p.startsWith(pre + '/')));
}

/** List git-tracked repo-relative files (NUL-delimited; the clean production source set). */
export function gitTrackedFiles(root = ROOT) {
  return execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
}

/** PURE-ish: partition the tracked file set into the curated upload list and the excluded list. */
export function curatedUploadFileList(root = ROOT) {
  const included = [];
  const excluded = [];
  for (const f of gitTrackedFiles(root)) (isExcludedFromUpload(f) ? excluded : included).push(f);
  return { included, excluded };
}

/**
 * Refuse obviously-dangerous destinations so an errant --out can't nuke the repo / home / root.
 * Rejects '/', the home dir, the repo root, AND any directory that is an ANCESTOR of the repo root
 * (e.g. `--out ~/Downloads` when the repo lives under it) — `rmSync(out)` runs before the copy.
 */
function assertSafeOut(out) {
  if (!out || typeof out !== 'string' || out.startsWith('-')) { console.error('refusing: --out requires a destination path'); process.exit(1); }
  const abs = resolve(out);
  const exact = [resolve('/'), resolve(homedir()), resolve(ROOT)];
  const isAncestorOfRepo = ROOT === abs || ROOT.startsWith(abs + sep);     // abs contains the repo
  if (exact.includes(abs) || isAncestorOfRepo) { console.error(`refusing unsafe --out: ${abs}`); process.exit(1); }
}

function main() {
  const args = process.argv.slice(2);
  const listOnly = args.includes('--list');
  const outIdx = args.indexOf('--out');
  if (outIdx >= 0 && (!args[outIdx + 1] || args[outIdx + 1].startsWith('-'))) {
    console.error('refusing: --out requires a destination path'); process.exit(1);
  }
  const out = outIdx >= 0 ? args[outIdx + 1] : join(homedir(), 'Downloads', 'clovelearn-phase6-client-upload');

  const { included, excluded } = curatedUploadFileList(ROOT);

  // Hard guards (defense-in-depth — the predicate already filtered, but never trust one layer).
  const leaked = included.filter(isExcludedFromUpload);
  const creatorLeak = included.filter((f) => f.startsWith('arcade/creator/'));
  if (leaked.length || creatorLeak.length) {
    console.error(`REFUSING: ${leaked.length + creatorLeak.length} forbidden path(s) in upload set:`);
    for (const f of [...new Set([...leaked, ...creatorLeak])].slice(0, 12)) console.error(`  ✗ ${f}`);
    process.exit(1);
  }

  const hasCity = included.some((f) => f.startsWith('arcade/city/'));
  console.log('Curated client upload');
  console.log(`  source      : ${ROOT}`);
  console.log(`  destination : ${out}`);
  console.log(`  included    : ${included.length} files`);
  console.log(`  excluded    : ${excluded.length} files (arcade/creator + tests/docs/workers/…)`);
  console.log(`  arcade/creator excluded : ✓   arcade/city included : ${hasCity ? '✓' : '✗ MISSING'}`);

  if (listOnly) { for (const f of included) console.log(`  + ${f}`); process.exit(0); }
  if (!hasCity) { console.error('REFUSING: arcade/city is missing from the upload set.'); process.exit(1); }

  assertSafeOut(out);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const rel of included) {
    const src = join(ROOT, rel);
    if (!existsSync(src)) continue;
    const dest = join(out, rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest);
  }
  writeFileSync(join(out, '_UPLOAD_MANIFEST.json'), JSON.stringify({
    source: 'git ls-files (tracked) minus forbidden prefixes',
    file_count: included.length,
    excluded_count: excluded.length,
    arcade_creator_excluded: true,
    arcade_city_included: hasCity,
    forbidden_prefixes: FORBIDDEN_UPLOAD_PREFIXES,
  }, null, 2) + '\n');

  console.log(`\nWrote ${included.length} files + _UPLOAD_MANIFEST.json → ${out}`);
  process.exit(0);
}

// Run main() only as a CLI; importing for tests must not trigger a filesystem build.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
