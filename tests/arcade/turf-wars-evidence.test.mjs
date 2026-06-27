/**
 * Turf Wars Phase 1 lab — ADVERSARIAL EVIDENCE PACK C1–C10 tests.
 *   node --test tests/arcade/turf-wars-evidence.test.mjs
 *
 * Runs the hostile matrix and asserts every claim holds, across multiple seeds, with byte-identical
 * replay (determinism). Lab-only — denylisted from the production upload.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEvidencePack, buildEvidenceSuite, replayArtifact, LAB_MODULE_PATHS,
} from '../../arcade/hiveworld-agents/turf-wars/turf-evidence.mjs';
import { canonicalize } from '../../arcade/hiveworld-agents/turf-wars/canonical.mjs';

const EXPECTED_CLAIMS = [
  'C1_valid_chain_accepted', 'C2_payload_tamper_rejected', 'C3_signature_mismatch_rejected',
  'C4_overmint_rejected', 'C5_negative_balance_rejected', 'C6_unknown_op_rejected',
  'C7_fork_and_gap_rejected', 'C8_snapshot_tamper_rejected', 'C9_forbidden_content_rejected',
  'C10_production_denylist_proven',
];

test('every C1–C10 claim passes (seed 42)', () => {
  const pack = buildEvidencePack({ seed: 42 });
  assert.deepEqual(pack.claims.map((c) => c.id), EXPECTED_CLAIMS, 'all ten claims present, in order');
  for (const c of pack.claims) assert.equal(c.ok, true, `${c.id} — ${c.detail}`);
  assert.equal(pack.pass, true);
  assert.equal(pack.lab_only, true);
});

test('the matrix holds across independent seeds', () => {
  const suite = buildEvidenceSuite({ seeds: [42, 1337, 9001, 24601] });
  assert.equal(suite.pass, true);
  for (const pack of suite.packs) assert.equal(pack.pass, true, `seed ${pack.seed}`);
});

test('replay is byte-identical (deterministic; no Date.now / Math.random)', () => {
  for (const seed of [1, 7, 99]) {
    assert.equal(canonicalize(buildEvidencePack({ seed })), canonicalize(buildEvidencePack({ seed })));
  }
});

test('the replay artifact is self-describing and timestamp-free', () => {
  const art = replayArtifact(buildEvidencePack({ seed: 5 }));
  assert.equal(art.lab_only, true);
  assert.match(art.replay.module, /turf-wars\/turf-evidence\.mjs$/);
  assert.match(art.replay.call, /buildEvidencePack\(\{ seed: 5 \}\)/);
  assert.equal(JSON.stringify(art).includes('"timestamp"'), false);
});

test('the lab module list is exactly the six substrate files', () => {
  assert.equal(LAB_MODULE_PATHS.length, 6);
  for (const p of LAB_MODULE_PATHS) assert.match(p, /^arcade\/hiveworld-agents\/turf-wars\/[a-z-]+\.mjs$/);
});
