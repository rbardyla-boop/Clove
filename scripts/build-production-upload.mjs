import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { curatedUploadFileList } from './build-curated-client-upload.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const HARD_EXCLUDE_PREFIXES = Object.freeze([
  'agent/',
  'new-work/',
  // Editorial/publishing working files are repository records, not public site assets.
  'publishing/',
]);

export const HARD_EXCLUDE_FILES = Object.freeze(new Set([
  'master-map.md',
  'research/projects/BOOK_RESEARCH_RELEASE_NOTE.md',
  // Digital Stewardship implementation slices remain NON-PUBLIC until a later
  // release gate deliberately removes both the production lock and preflight sentinel.
  'digital-stewardship-00.html',
  'digital-stewardship-00.js',
  'digital-stewardship-01.html',
  'digital-stewardship-01.js',
  'digital-stewardship-02.html',
  'digital-stewardship-02.js',
  'digital-stewardship-03.html',
  'digital-stewardship-03.js',
  'digital-stewardship-04.html',
  'digital-stewardship-04.js',
  'digital-stewardship-05.html',
  'digital-stewardship-05.js',
  'digital-stewardship-06.html',
  'digital-stewardship-06.js',
  'arcade/README.md',
  'arcade/cabinets/neon-grid/README.md',
  'arcade/cabinets/sample-import-game/README.md',
  'arcade/neon-arcade-config.example.js',
  'arcade/pulse-occupancy-test.html',
  'clovelearn-test-harness.html',
  'scripts/build-curated-client-upload.mjs',
  'scripts/check-city-build-size.mjs',
  'scripts/embed-benefits.py',
  'scripts/product-audit.mjs',
  'scripts/release-preflight.mjs',
  'scripts/setup-semantic.sh',
]));

export function isHardExcluded(relPath) {
  const p = String(relPath).replaceAll('\\', '/').replace(/^\.\//, '');
  if (HARD_EXCLUDE_FILES.has(p)) return true;
  if (p.endsWith('/README.md') || p === 'README.md') return true;
  return HARD_EXCLUDE_PREFIXES.some((prefix) => p === prefix.slice(0, -1) || p.startsWith(prefix));
}

export function productionUploadFileList() {
  const base = curatedUploadFileList(ROOT);
  const additionallyExcluded = base.included.filter(isHardExcluded);
  const included = base.included.filter((p) => !isHardExcluded(p));
  return {
    included,
    excluded: [...base.excluded, ...additionallyExcluded],
    additionallyExcluded,
  };
}

function assertSafeOut(out) {
  const abs = resolve(out);
  if (!out || typeof out !== 'string' || out.startsWith('-')) throw new Error('unsafe_output_path');
  if ([resolve('/'), resolve(homedir()), resolve(ROOT)].includes(abs)) throw new Error(`unsafe_output_path:${abs}`);
  if (ROOT === abs || ROOT.startsWith(abs + sep)) throw new Error(`output_is_repo_ancestor:${abs}`);
}

function main() {
  const args = process.argv.slice(2);
  const listOnly = args.includes('--list');
  const outIdx = args.indexOf('--out');
  const out = outIdx >= 0 ? args[outIdx + 1] : join(homedir(), 'Downloads', 'clovelearn-production-upload');
  if (outIdx >= 0 && (!out || out.startsWith('-'))) throw new Error('--out requires a destination');

  const { included, excluded, additionallyExcluded } = productionUploadFileList();
  const required = ['index.html', 'mission-001.html', 'mission-001-app.js', 'mission-private-store.js'];
  for (const path of required) if (!included.includes(path)) throw new Error(`required_file_missing:${path}`);
  for (const path of included) if (isHardExcluded(path)) throw new Error(`hard_excluded_file_leaked:${path}`);

  console.log('Hardened production upload');
  console.log(`  included             : ${included.length}`);
  console.log(`  excluded             : ${excluded.length}`);
  console.log(`  hardening exclusions : ${additionallyExcluded.length}`);

  if (listOnly) {
    for (const path of included) console.log(`  + ${path}`);
    return;
  }

  assertSafeOut(out);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const rel of included) {
    const src = join(ROOT, rel);
    if (!existsSync(src)) throw new Error(`tracked_file_missing:${rel}`);
    const dest = join(out, rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest);
  }

  const sourceSha = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(join(out, '_UPLOAD_MANIFEST.json'), JSON.stringify({
    source_sha: sourceSha,
    policy: 'legacy curated list plus production hardening exclusions',
    file_count: included.length,
    excluded_count: excluded.length,
    hardening_excluded_count: additionallyExcluded.length,
    required_files: required,
    hard_exclude_prefixes: HARD_EXCLUDE_PREFIXES,
    hard_exclude_files: [...HARD_EXCLUDE_FILES],
  }, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
