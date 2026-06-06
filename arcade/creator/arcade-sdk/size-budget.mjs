/**
 * Creator Foundation CF-1 — arcade package SIZE GATE (Node, LOCAL tool).
 *
 *   node arcade/creator/arcade-sdk/size-budget.mjs <package-dir> [--strict]
 *
 * Sums the on-disk bytes of the shippable files in a cabinet package dir (everything except
 * README.md and *.receipt.json) and compares against `size_budget_bytes` declared in its
 * manifest.json. The budget is the creative constraint — a small cabinet forces optimization and
 * procedural art, not bloat. Advisory by default; `--strict` exits 1 when over budget.
 * Also re-checks the budget is within the schema's [MIN, MAX] ceiling.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SIZE_BUDGET_MAX_BYTES, SIZE_BUDGET_MIN_BYTES } from '../schemas/arcade-game-package-schema.mjs';

const dir = process.argv[2];
const strict = process.argv.includes('--strict');
if (!dir) { console.error('usage: node arcade/creator/arcade-sdk/size-budget.mjs <package-dir> [--strict]'); process.exit(1); }

let manifest;
try { manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')); }
catch (e) { console.error(`size-budget: cannot read ${join(dir, 'manifest.json')}: ${e.message}`); process.exit(1); }

const budget = manifest.size_budget_bytes;
const SKIP = (name) => name === 'README.md' || name.endsWith('.receipt.json');

function walk(abs) {
  const out = [];
  for (const name of readdirSync(abs)) {
    if (SKIP(name)) continue;
    const p = join(abs, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push({ path: p, bytes: st.size });
  }
  return out;
}

const files = walk(dir);
const total = files.reduce((n, f) => n + f.bytes, 0);

console.log(`Arcade package size gate — ${dir}\n`);
for (const f of files.sort((a, b) => b.bytes - a.bytes)) console.log(`  ${String(f.bytes).padStart(7)}B  ${f.path.replace(dir + '/', '')}`);
console.log(`\n  total declared budget : ${budget} bytes`);
console.log(`  total package bytes   : ${total} bytes`);

const budgetSane = Number.isInteger(budget) && budget >= SIZE_BUDGET_MIN_BYTES && budget <= SIZE_BUDGET_MAX_BYTES;
const over = total > budget;
if (!budgetSane) console.log(`  budget sanity         : OUT OF RANGE (must be ${SIZE_BUDGET_MIN_BYTES}..${SIZE_BUDGET_MAX_BYTES})`);
console.log(`  within budget         : ${over ? 'OVER ❌' : 'within ✓'}`);

if (strict && (over || !budgetSane)) { console.log('\nARCADE SIZE GATE: FAIL (--strict)'); process.exit(1); }
console.log(`\nARCADE SIZE GATE: ${over || !budgetSane ? 'WARN (advisory)' : 'PASS'}`);
process.exit(0);
