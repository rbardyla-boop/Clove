/**
 * Phase 4A — GTA-80 Challenge build-size meter (ADVISORY).
 *
 * The original 1997 Grand Theft Auto listed an 80 MB hard-disk footprint. Phase 4
 * adopts that as the budget for the production static *playable city client*:
 *
 *     node scripts/check-city-build-size.mjs        # advisory report (always exits 0)
 *     node scripts/check-city-build-size.mjs --strict  # exit 1 if over the 80 MB budget
 *
 * Scope = the static assets a browser actually downloads to play the city block:
 * everything under arcade/city/ plus the shared vendored Three.js it loads. It does
 * NOT count source/tests/docs/node_modules/git/dev tooling or the Worker — those are
 * not shipped to the player. Reports uncompressed + gzipped totals so the GTA-80
 * (<=80 MB uncompressed) budget and the GTA-34 (<=34 MB gzipped) stretch are visible.
 *
 * This is deliberately advisory: the repo has no hard size CI gate, so this does not
 * become one unless you opt in with --strict.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET_MB = 80;          // GTA-80: uncompressed playable client
const STRETCH_GZIP_MB = 34;    // GTA-34: compressed stretch goal
const MB = 1024 * 1024;

/** The static assets the playable city client downloads. */
const ASSET_ROOTS = [
  'arcade/city',             // the whole city scene (html/js/css/mjs)
  'scripts/three.min.js',    // shared vendored renderer the city page loads
];

function walk(abs) {
  const out = [];
  const st = statSync(abs);
  if (st.isFile()) { out.push(abs); return out; }
  for (const name of readdirSync(abs)) out.push(...walk(join(abs, name)));
  return out;
}

const files = [];
for (const rel of ASSET_ROOTS) {
  try { files.push(...walk(join(ROOT, rel))); }
  catch { /* asset root absent — skip (reported as 0 bytes) */ }
}

let raw = 0;
let gz = 0;
const rows = [];
for (const f of files.sort()) {
  const buf = readFileSync(f);
  const g = gzipSync(buf).length;
  raw += buf.length; gz += g;
  rows.push({ path: relative(ROOT, f), bytes: buf.length, gzip: g });
}

const fmt = (b) => `${(b / MB).toFixed(3)} MB`;
const pad = (s, n) => String(s).padEnd(n);

console.log('Neon Circuit — GTA-80 city client size report\n');
for (const r of rows) {
  console.log(`  ${pad(r.path, 46)} ${pad(fmt(r.bytes), 12)} (gzip ${fmt(r.gzip)})`);
}
console.log(`\n  ${pad('TOTAL (uncompressed)', 46)} ${fmt(raw)}`);
console.log(`  ${pad('TOTAL (gzipped)', 46)} ${fmt(gz)}`);

const overBudget = raw > BUDGET_MB * MB;
const overStretch = gz > STRETCH_GZIP_MB * MB;
console.log(`\n  GTA-80 budget   : ${BUDGET_MB} MB uncompressed  → ${overBudget ? 'OVER ❌' : 'within ✓'} (${fmt(raw)})`);
console.log(`  GTA-34 stretch  : ${STRETCH_GZIP_MB} MB gzipped       → ${overStretch ? 'over (stretch, advisory)' : 'within ✓'} (${fmt(gz)})`);
console.log(`  files counted   : ${files.length}`);

const strict = process.argv.includes('--strict');
if (strict && overBudget) {
  console.log('\nGTA-80 SIZE CHECK: FAIL (--strict, over 80 MB)');
  process.exit(1);
}
console.log(`\nGTA-80 SIZE CHECK: ${overBudget ? 'WARN (over budget, advisory)' : 'PASS'}`);
process.exit(0);
