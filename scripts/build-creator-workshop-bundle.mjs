/**
 * Creator Corner public beta — STATIC/LOCAL workshop bundle builder.
 *
 * Assembles an ISOLATED static tree containing ONLY the Creator Corner hub and its four linked
 * local-workshop tools (arcade-builder, arcade-sandbox, block-editor, layered-editor) plus the
 * same-origin modules they import and the sandbox's fetched sample package. The output is a local
 * directory you can serve with a static file server for public-beta review.
 *
 *   node scripts/build-creator-workshop-bundle.mjs                 # → /tmp/creator-corner-workshop
 *   node scripts/build-creator-workshop-bundle.mjs --out /tmp/x    # custom destination
 *   node scripts/build-creator-workshop-bundle.mjs --list          # print the file list, copy nothing
 *
 * This is NOT a deploy and NOT the production client upload. It is decoupled from
 * scripts/build-curated-client-upload.mjs (which deliberately EXCLUDES arcade/creator/**). It changes
 * no Worker/DO/route/config, pushes nothing, and ships NO live-world loader: the CF-7 live-loader
 * machinery (live-loader/live-registry/live-approval), moderation, district-editor, map-viewer,
 * hive-validation, the SDK, and node-only author CLIs are all refused. Exits non-zero (copying
 * nothing) if any FORBIDDEN surface would be included or if the CF-2 loader kill-switch is not false.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync, statSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep, relative } from 'node:path';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CREATOR = 'arcade/creator';

/** Whole subtrees under arcade/creator/ that make up the public-beta workshop surface. */
export const WORKSHOP_DIRS = Object.freeze([
  'creator-corner',     // the hub (static, no JS)
  'arcade-builder',     // closed-control + Reaction Lane rule-graph authoring (data only)
  'arcade-sandbox',     // hardened local iframe runner
  'block-editor',       // data-only block authoring
  'layered-editor',     // layered block authoring
  'arcade-importer',    // shared: package import + code-aware scan
  'validator',          // shared: manifest/package validators
  'schemas',            // shared: closed schemas + tokens
  'render',             // shared: iso/layered preview renderers
]);

/** Specific shared files the workshop imports (the CF-2 LOCAL approval modules — live mode rejected). */
export const WORKSHOP_FILES = Object.freeze([
  'approval/approval-receipt.mjs',
  'approval/approved-package-registry.mjs',
  'approval/approved-loader.mjs',
]);

/** The sample package the sandbox fetches at runtime (SAMPLE_DIR in sandbox-runner.mjs). */
export const WORKSHOP_SAMPLE_DIR = 'samples/arcade-sample';

/** Node-only author CLIs / non-workshop files that sit inside allowlisted dirs and must NOT ship. */
export const WORKSHOP_FILE_DENY = Object.freeze([
  'arcade-builder/write-starter-statics.mjs', // node author tool (imports node:fs + ../../cabinets/…)
  'validator/validate-package.mjs',           // node CLI (imports node:fs)
  'validator/validate-asset-pack.mjs',        // asset-pack tooling — not a workshop surface
  'schemas/asset-pack-schema.mjs',            // asset-pack schema — not imported by the four tools
]);

/**
 * Substrings/patterns that must NEVER appear in the bundle (defense-in-depth, independent of the
 * allowlist). The CF-7 live loader is the critical one: the workshop must not ship a live-world path.
 */
export const FORBIDDEN_IN_BUNDLE = Object.freeze([
  /(^|\/)live-loader/, /(^|\/)live-registry/, /(^|\/)live-approval/,
  /(^|\/)moderation\//, /(^|\/)district-editor\//, /(^|\/)map-viewer\//,
  /(^|\/)hive-validation\//, /(^|\/)arcade-sdk\//,
  /write-starter-statics/, /validate-package\.mjs/, /validate-asset-pack/, /asset-pack-schema/,
]);

/** PURE: is this arcade/creator-relative path a denied node-only/non-workshop file? */
export function isDeniedWorkshopFile(creatorRel) {
  return WORKSHOP_FILE_DENY.includes(String(creatorRel).split('\\').join('/'));
}

/** PURE: does this repo-relative path match a forbidden surface? */
export function isForbiddenInBundle(repoRel) {
  const p = String(repoRel).split('\\').join('/');
  return FORBIDDEN_IN_BUNDLE.some((re) => re.test(p));
}

function walkFiles(absDir, out = []) {
  for (const e of readdirSync(absDir, { withFileTypes: true })) {
    const abs = join(absDir, e.name);
    if (e.isDirectory()) walkFiles(abs, out);
    else if (e.isFile()) out.push(abs);
  }
  return out;
}

/** Collect the repo-relative file list for the workshop bundle (POSIX-style, sorted, deduped). */
export function workshopFileList(root = ROOT) {
  const set = new Set();
  const add = (repoRel) => set.add(repoRel.split('\\').join('/'));
  for (const d of WORKSHOP_DIRS) {
    const abs = join(root, CREATOR, d);
    if (!existsSync(abs)) continue;
    for (const f of walkFiles(abs)) {
      const creatorRel = relative(join(root, CREATOR), f).split('\\').join('/');
      if (!isDeniedWorkshopFile(creatorRel)) add(join(CREATOR, creatorRel));
    }
  }
  for (const f of WORKSHOP_FILES) if (existsSync(join(root, CREATOR, f))) add(join(CREATOR, f));
  const sampleAbs = join(root, CREATOR, WORKSHOP_SAMPLE_DIR);
  if (existsSync(sampleAbs)) for (const f of walkFiles(sampleAbs)) add(join(CREATOR, relative(join(root, CREATOR), f)));
  return [...set].sort();
}

/** Refuse dangerous destinations (mirrors the curated-upload guard) + the production upload dir. */
function assertSafeOut(out) {
  if (!out || typeof out !== 'string' || out.startsWith('-')) { console.error('refusing: --out requires a destination path'); process.exit(1); }
  const abs = resolve(out);
  const prodUpload = resolve(join(homedir(), 'Downloads', 'clovelearn-phase6-client-upload'));
  const exact = [resolve('/'), resolve(homedir()), resolve(ROOT), prodUpload];
  const isAncestorOfRepo = ROOT === abs || ROOT.startsWith(abs + sep);
  if (exact.includes(abs) || isAncestorOfRepo) { console.error(`refusing unsafe --out: ${abs}`); process.exit(1); }
}

function main() {
  const args = process.argv.slice(2);
  const listOnly = args.includes('--list');
  const outIdx = args.indexOf('--out');
  if (outIdx >= 0 && (!args[outIdx + 1] || args[outIdx + 1].startsWith('-'))) {
    console.error('refusing: --out requires a destination path'); process.exit(1);
  }
  const out = outIdx >= 0 ? args[outIdx + 1] : join('/tmp', 'creator-corner-workshop');

  const included = workshopFileList(ROOT);

  // HARD GUARD 1 — no forbidden surface may be in the bundle (defense-in-depth vs the allowlist).
  const forbidden = included.filter(isForbiddenInBundle);
  if (forbidden.length) {
    console.error(`REFUSING: ${forbidden.length} forbidden surface(s) in workshop bundle:`);
    for (const f of forbidden.slice(0, 12)) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  // HARD GUARD 2 — the hub must be present, and the CF-2 loader kill-switch must be false.
  const hub = `${CREATOR}/creator-corner/index.html`;
  if (!included.includes(hub)) { console.error(`REFUSING: workshop hub missing (${hub})`); process.exit(1); }
  const loaderRel = `${CREATOR}/approval/approved-loader.mjs`;
  if (included.includes(loaderRel)) {
    const loaderSrc = readFileSync(join(ROOT, loaderRel), 'utf8');
    if (!/export\s+const\s+LIVE_WORLD_LOADER_ENABLED\s*=\s*false\s*;/.test(loaderSrc)) {
      console.error('REFUSING: LIVE_WORLD_LOADER_ENABLED is not literally false in approved-loader.mjs'); process.exit(1);
    }
  }

  console.log('Creator Corner workshop bundle (STATIC/LOCAL — not a deploy, not the production upload)');
  console.log(`  source      : ${ROOT}/${CREATOR}`);
  console.log(`  destination : ${out}`);
  console.log(`  files       : ${included.length}`);
  console.log(`  hub present : ✓   live loader: OFF (not shipped)   prod-upload coupling: none`);

  if (listOnly) { for (const f of included) console.log(`  + ${f}`); process.exit(0); }

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
  writeFileSync(join(out, '_WORKSHOP_MANIFEST.json'), JSON.stringify({
    surface: 'creator-corner public beta — static/local workshop',
    entry: `${CREATOR}/creator-corner/index.html`,
    file_count: included.length,
    live_world_loader: 'disabled (not shipped)',
    decoupled_from_production_upload: true,
    forbidden_surfaces_excluded: ['live-loader', 'live-registry', 'live-approval', 'moderation',
      'district-editor', 'map-viewer', 'hive-validation', 'arcade-sdk', 'asset-pack', 'node CLIs'],
  }, null, 2) + '\n');

  console.log(`\nWrote ${included.length} files + _WORKSHOP_MANIFEST.json → ${out}`);
  console.log(`Serve locally:  (cd ${out} && python3 -m http.server 8097)  →  /arcade/creator/creator-corner/`);
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
