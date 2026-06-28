/**
 * Turf Wars Phase 1 lab — PRODUCTION DENYLIST boundary test.
 *   node --test tests/creator/turf-wars-prod-denylist.test.mjs
 *
 * The substrate lives under `arcade/hiveworld-agents/turf-wars/`, already covered by the existing
 * `arcade/hiveworld-agents/` upload-denylist prefix (the W-4 simulator lab). This test pins the SAFETY
 * property: no Turf Wars lab file can ever reach the production static upload, none is on the public
 * allow-list, and the substrate is imported by no production surface. Forward-compatible — it asserts
 * the property, not a fixed file count.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  isExcludedFromUpload, curatedUploadFileList, PUBLIC_CREATOR_ALLOW,
} from '../../scripts/build-curated-client-upload.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TURF_PREFIX = 'arcade/hiveworld-agents/turf-wars/';

test('every Turf Wars lab module is excluded from the curated upload (predicate)', () => {
  for (const f of [
    // Phase 1 substrate
    'arcade/hiveworld-agents/turf-wars/canonical.mjs',
    'arcade/hiveworld-agents/turf-wars/identity.mjs',
    'arcade/hiveworld-agents/turf-wars/ops.mjs',
    'arcade/hiveworld-agents/turf-wars/block-log.mjs',
    'arcade/hiveworld-agents/turf-wars/snapshot.mjs',
    'arcade/hiveworld-agents/turf-wars/turf-evidence.mjs',
    // Phase 2 foundation (attack simulator + fraud-proof primitive)
    'arcade/hiveworld-agents/turf-wars/attack-plan.mjs',
    'arcade/hiveworld-agents/turf-wars/scorch.mjs',
    'arcade/hiveworld-agents/turf-wars/attack-sim.mjs',
    'arcade/hiveworld-agents/turf-wars/attack-evidence.mjs',
    // Phase 2 settlement (O1 commit-reveal + O2 delegable fraud-proof)
    'arcade/hiveworld-agents/turf-wars/settlement.mjs',
    'arcade/hiveworld-agents/turf-wars/settlement-evidence.mjs',
    // Phase 3a beacon source (commit-derived cross-block checkpoint + window-close)
    'arcade/hiveworld-agents/turf-wars/beacon.mjs',
    'arcade/hiveworld-agents/turf-wars/beacon-evidence.mjs',
  ]) {
    assert.equal(isExcludedFromUpload(f), true, `${f} must be excluded`);
    assert.equal(PUBLIC_CREATOR_ALLOW.has(f), false, `${f} must not be on the public allow-list`);
  }
});

test('real repo: no turf-wars file survives into the curated upload set', () => {
  const { included, excluded } = curatedUploadFileList();
  assert.equal(included.some((f) => f.startsWith(TURF_PREFIX)), false, 'turf-wars must not ship');
  assert.ok(excluded.some((f) => f.startsWith(TURF_PREFIX)), 'turf-wars lab files must be in the excluded set');
});

test('real repo: the whole hiveworld-agents lab (turf-wars included) stays denylisted', () => {
  const { included } = curatedUploadFileList();
  assert.equal(included.some((f) => f.startsWith('arcade/hiveworld-agents/')), false,
    'the entire simulator lab is denylisted from production');
});

test('no production surface imports the turf-wars substrate', () => {
  // grep the tracked tree for production-path imports of the lab. Only tests/ and the lab itself may
  // reference it; a hit anywhere else (workers/, arcade/city/, root pages) is an enabling leak.
  let hits = '';
  try {
    hits = execFileSync('git', ['-C', ROOT, 'grep', '-l', 'turf-wars/', '--', '.'], { encoding: 'utf8' });
  } catch (e) {
    // git grep exits 1 when there are no matches
    if (e.status === 1) hits = '';
    else throw e;
  }
  const offenders = hits.split('\n').map((s) => s.trim()).filter(Boolean).filter((f) =>
    !f.startsWith('arcade/hiveworld-agents/turf-wars/') &&
    !f.startsWith('tests/') &&
    !f.startsWith('docs/'));
  assert.deepEqual(offenders, [], `turf-wars referenced from a non-lab/test/doc path: ${offenders.join(', ')}`);
});
