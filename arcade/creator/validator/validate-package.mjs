/**
 * Creator Foundation CF-1 — package validator CLI (Node, LOCAL operator tool).
 *
 *   node arcade/creator/validator/validate-package.mjs <package.json> [--report out.json]
 *
 * Reads a block_style or arcade_game package, dispatches to the matching pure validator, computes
 * the canonical hash, prints the report, and (with --report) writes it. NO network, NO live-world
 * write. Exit 0 if ok, 1 if invalid / usage error. Mirrors scripts/check-city-build-size.mjs style.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { packageHash } from './package-hash.mjs';
import { buildValidationReport } from './validation-report.mjs';
import { validateBlockPackage } from './validate-block-package.mjs';
import { validateArcadePackage } from './validate-arcade-package.mjs';
import { validateBlockLayeredPackage } from './validate-block-layered-package.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const reportIdx = args.indexOf('--report');
const reportOut = reportIdx >= 0 ? args[reportIdx + 1] : null;

if (!file) {
  console.error('usage: node arcade/creator/validator/validate-package.mjs <package.json> [--report out.json]');
  process.exit(1);
}

let pkg;
try { pkg = JSON.parse(readFileSync(file, 'utf8')); }
catch (e) { console.error(`creator validator: cannot read/parse ${file}: ${e.message}`); process.exit(1); }

const kind = pkg && pkg.package_kind;
const validate = kind === 'block_style' ? validateBlockPackage
  : kind === 'block_layered' ? validateBlockLayeredPackage
    : kind === 'arcade_game' ? validateArcadePackage
      : null;
if (!validate) { console.error(`creator validator: unknown package_kind ${JSON.stringify(kind)} (expected block_style|block_layered|arcade_game)`); process.exit(1); }

const validation = validate(pkg);
const hash = await packageHash(pkg);
const report = buildValidationReport({ validation, packageHash: hash });

console.log(`Creator Validator — ${file}\n`);
console.log(`  kind   : ${report.package_kind}`);
console.log(`  ok     : ${report.ok}`);
console.log(`  hash   : ${report.package_hash}`);
console.log(`  size   : ${report.limits.size_bytes} bytes${report.limits.size_budget_bytes ? ` / budget ${report.limits.size_budget_bytes}` : ''}`);
for (const e of report.errors) console.log(`    ✗ ${e}`);
for (const w of report.warnings) console.log(`    ! ${w}`);
console.log(`  receipt: ${report.receipt.status} (live_world_authorized=${report.receipt.live_world_authorized})`);

if (reportOut) { writeFileSync(reportOut, JSON.stringify(report, null, 2)); console.log(`  report : ${reportOut}`); }
process.exit(report.ok ? 0 : 1);
