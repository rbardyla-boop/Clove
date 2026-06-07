/**
 * Creator Foundation CF-6 — Hive validation service CLI/dev harness (Node, LOCAL operator tool).
 *
 *   node arcade/creator/hive-validation/hive-cli.mjs <pkg.json> [<pkg2.json> ...] [--lookup <hash>]
 *
 * Submits one or more local packages to an in-memory Hive validation service, prints each hash-bound
 * verdict, and (with --lookup) prints the recorded verdict for a hash. CLI-first by design: NO HTTP
 * server, NO network, NO live-world write, NO production. A localhost-only HTTP wrapper is documented
 * as a future option (bound to 127.0.0.1, explicit command) but intentionally NOT built here — a
 * verdict never authorizes a live load, so the service needs no exposed surface. Exit 1 if any package
 * is invalid (usable in CI); 0 otherwise.
 */
import { readFileSync } from 'node:fs';
import { createHiveService, VALIDATOR_VERSION } from './hive-service.mjs';

const args = process.argv.slice(2);
const lookupIdx = args.indexOf('--lookup');
const lookupHash = lookupIdx >= 0 ? args[lookupIdx + 1] : null;
const files = args.filter((a, i) => !a.startsWith('--') && (lookupIdx < 0 || i !== lookupIdx + 1));

if (!files.length && !lookupHash) {
  console.error('usage: node arcade/creator/hive-validation/hive-cli.mjs <pkg.json> [...] [--lookup <hash>]');
  process.exit(1);
}

const service = createHiveService();
let anyInvalid = false;

console.log(`Hive Validation Service (CF-6 prototype) — validator ${VALIDATOR_VERSION}\n`);

for (const file of files) {
  let pkg;
  try { pkg = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { console.error(`  ✗ cannot read/parse ${file}: ${e.message}`); anyInvalid = true; continue; }
  const r = await service.submit(pkg);
  if (r.verdict !== 'valid') anyInvalid = true;
  console.log(`  ${file}`);
  console.log(`    kind     : ${r.package_kind}`);
  console.log(`    hash     : ${r.package_hash}`);
  console.log(`    verdict  : ${r.verdict}`);
  console.log(`    status   : ${r.status}  (live_world_authorized=${r.live_world_authorized}, content_cleared=${r.content_cleared})`);
  for (const e of r.errors) console.log(`      ✗ ${e}`);
  console.log(`    receipt  : ${r.receipt_hash}`);
}

if (lookupHash) {
  const found = service.lookup(lookupHash);
  console.log(`\n  lookup ${lookupHash}: ${found ? `${found.verdict} (${found.status})` : 'not found'}`);
}

console.log(`\n  queue: ${service.size} submission(s) — NO verdict authorizes a live load (quarantine).`);
process.exit(anyInvalid ? 1 : 0);
