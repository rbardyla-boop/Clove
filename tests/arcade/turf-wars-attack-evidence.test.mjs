/**
 * Turf Wars Phase 2 foundation (lab) — ATTACK EVIDENCE D-matrix tests.
 *   node --test tests/arcade/turf-wars-attack-evidence.test.mjs
 *
 * Runs the O1/O2-agnostic D-matrix across seeds with byte-identical replay, and pins that the two
 * O1/O2-dependent claims are explicitly DEFERRED (not silently dropped). Lab-only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAttackEvidencePack, buildAttackEvidenceSuite, attackReplayArtifact, PHASE2_LAB_MODULE_PATHS,
} from '../../arcade/hiveworld-agents/turf-wars/attack-evidence.mjs';
import { canonicalize } from '../../arcade/hiveworld-agents/turf-wars/canonical.mjs';

const EXPECTED = [
  'D1_valid_attack_deterministic', 'D2_forged_outcome_rejected', 'D3_tampered_base_rejected',
  'D4_bad_plan_rejected', 'D6_replay_deterministic', 'D8_scorch_bounded_reversible',
  'D9_no_value_transfer', 'D10_base_immutable', 'DRAR_combat_op_settlement_deferred',
];

test('every O1/O2-agnostic D-claim passes (seed 42)', () => {
  const pack = buildAttackEvidencePack({ seed: 42 });
  assert.deepEqual(pack.claims.map((c) => c.id), EXPECTED);
  for (const c of pack.claims) assert.equal(c.ok, true, `${c.id} — ${c.detail}`);
  assert.equal(pack.pass, true);
  assert.equal(pack.lab_only, true);
});

test('the matrix holds across independent seeds', () => {
  const suite = buildAttackEvidenceSuite({ seeds: [42, 1337, 9001, 24601] });
  assert.equal(suite.pass, true);
  for (const p of suite.packs) assert.equal(p.pass, true, `seed ${p.seed}`);
});

test('the O1/O2-dependent claims are explicitly DEFERRED, not faked', () => {
  const pack = buildAttackEvidencePack({ seed: 1 });
  assert.equal(pack.deferred.length, 2);
  assert.ok(pack.deferred.some((d) => /D5/.test(d) && /O1/.test(d)), 'D5 seed-grinding deferred to O1');
  assert.ok(pack.deferred.some((d) => /D7/.test(d) && /O2/.test(d)), 'D7 offline-victim liveness deferred to O2');
  // and they are NOT silently asserted as passing claims
  assert.ok(!pack.claims.some((c) => /D5|D7/.test(c.id)));
});

test('replay is byte-identical (deterministic; no Date.now / Math.random)', () => {
  for (const seed of [3, 11, 77]) {
    assert.equal(canonicalize(buildAttackEvidencePack({ seed })), canonicalize(buildAttackEvidencePack({ seed })));
  }
});

test('the replay artifact is self-describing, lists deferrals, and is timestamp-free', () => {
  const art = attackReplayArtifact(buildAttackEvidencePack({ seed: 5 }));
  assert.equal(art.lab_only, true);
  assert.equal(art.deferred.length, 2);
  assert.match(art.replay.module, /attack-evidence\.mjs$/);
  assert.equal(JSON.stringify(art).includes('"timestamp"'), false);
});

test('the Phase-2 lab module list is exactly the four foundation files', () => {
  assert.equal(PHASE2_LAB_MODULE_PATHS.length, 4);
  for (const p of PHASE2_LAB_MODULE_PATHS) assert.match(p, /^arcade\/hiveworld-agents\/turf-wars\/[a-z-]+\.mjs$/);
});
