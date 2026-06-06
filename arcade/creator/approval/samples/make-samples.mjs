/**
 * Creator Foundation CF-2 — deterministic generator for the approval sample artifacts.
 *
 *   node arcade/creator/approval/samples/make-samples.mjs
 *
 * Produces, from the existing sample block package, three LOCAL artifacts used by docs + the editor
 * smoke: an operator-approved-local receipt that BINDS to the package hash, a MISMATCH receipt (valid
 * receipt bound to a different hash, to prove the loader rejects it), and an approved registry listing
 * the package hash. All outputs are deterministic (fixed `approved_at`). LOCAL only — nothing live.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { packageHash } from '../../validator/package-hash.mjs';
import { buildApprovalReceipt } from '../approval-receipt.mjs';
import { createRegistry } from '../approved-package-registry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APPROVED_AT = Date.parse('2026-06-06T00:00:00.000Z');

const block = JSON.parse(readFileSync(join(HERE, '../../samples/sample-block.package.json'), 'utf8'));
const hash = await packageHash(block);

// A second, slightly-different package → a different hash, for the mismatch receipt.
const modified = { ...block, display_name: 'A Different Facade' };
const modifiedHash = await packageHash(modified);

const approvedReceipt = await buildApprovalReceipt({
  packageHash: hash, packageKind: 'block_style', status: 'operator_approved_local',
  operatorNote: 'Reviewed locally for offline preview. Not authorized for the live world.',
  now: APPROVED_AT,
});

const mismatchReceipt = await buildApprovalReceipt({
  packageHash: modifiedHash, packageKind: 'block_style', status: 'operator_approved_local',
  operatorNote: 'Bound to a different package hash on purpose (negative sample).',
  now: APPROVED_AT,
});

const registry = createRegistry([{
  package_hash: hash,
  package_kind: 'block_style',
  display_name: 'Tide Glass Facade (demo, local)',
  approval_status: 'operator_approved_local',
  approved_at: new Date(APPROVED_AT).toISOString(),
  validator_version: 'creator-validator-cf2',
  live_world_authorized: false,
}]);

const write = (name, obj) => { writeFileSync(join(HERE, name), JSON.stringify(obj, null, 2) + '\n'); console.log(`wrote ${name}`); };
write('sample-block.approved-receipt.json', approvedReceipt);
write('sample-block.mismatch-receipt.json', mismatchReceipt);
write('sample-approved-registry.json', registry);
console.log(`block_style package hash: ${hash}`);

// ── CF-3: layered package receipts (for the layered editor approved-preview smoke) ───────────────
const layered = JSON.parse(readFileSync(join(HERE, '../../samples/sample-layered.package.json'), 'utf8'));
const layeredHash = await packageHash(layered);
const layeredModified = { ...layered, display_name: 'A Different Layered Facade' };
const layeredModifiedHash = await packageHash(layeredModified);

const layeredApproved = await buildApprovalReceipt({
  packageHash: layeredHash, packageKind: 'block_layered', status: 'operator_approved_local',
  operatorNote: 'Reviewed locally for offline preview. Not authorized for the live world.', now: APPROVED_AT,
});
const layeredMismatch = await buildApprovalReceipt({
  packageHash: layeredModifiedHash, packageKind: 'block_layered', status: 'operator_approved_local',
  operatorNote: 'Bound to a different package hash on purpose (negative sample).', now: APPROVED_AT,
});
write('sample-layered.approved-receipt.json', layeredApproved);
write('sample-layered.mismatch-receipt.json', layeredMismatch);
console.log(`block_layered package hash: ${layeredHash}`);
