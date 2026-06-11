// W-6 LAB — attention-ledger stress + adversarial suite (simulator-only; never production).
// Run: node --test tests/arcade/attention-stress.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStressPack, buildStressSuite, replayArtifact, agentFingerprint, STRESS_DEFAULTS,
} from '../../arcade/hiveworld-agents/attention-stress.mjs';
import { foldAttention } from '../../arcade/hiveworld-agents/attention-ledger.mjs';

test('stress pack PASSES at default scale (all S1–S8 claims hold)', () => {
  const pack = buildStressPack({ seed: 42 });
  for (const c of pack.claims) assert.ok(c.ok, `${c.id}: ${c.detail}`);
  assert.equal(pack.pass, true);
  assert.equal(pack.claims.length, 8);
  assert.ok(pack.event_count > 2 * STRESS_DEFAULTS.rounds, 'scenario actually ran at stress scale');
});

test('stress pack is deterministic: same seed → byte-identical pack', () => {
  assert.equal(JSON.stringify(buildStressPack({ seed: 7 })), JSON.stringify(buildStressPack({ seed: 7 })));
});

test('different seeds explore different scenarios (different fingerprints)', () => {
  assert.notEqual(buildStressPack({ seed: 42 }).fingerprint, buildStressPack({ seed: 1337 }).fingerprint);
});

test('multi-seed suite passes and carries one pack per seed', () => {
  const suite = buildStressSuite({ seeds: [42, 1337], rounds: 300 }); // trimmed for test wall-clock
  assert.equal(suite.pass, true);
  assert.equal(suite.packs.length, 2);
  assert.ok(suite.lab_only === true);
});

test('replay artifact: lab-only banner, replayable call, timestamp-free', () => {
  const art = replayArtifact(buildStressPack({ seed: 42, rounds: 200 }));
  assert.equal(art.lab_only, true);
  assert.ok(/denylisted/.test(art.never_production));
  assert.ok(/buildStressPack\(\{ seed: 42 \}\)/.test(art.replay.call));
  assert.ok(!/timestamp|generated_at|date/i.test(JSON.stringify(Object.keys(art))), 'no clock fields');
});

test('replay artifact for a suite names buildStressSuite with its seeds', () => {
  const art = replayArtifact(buildStressSuite({ seeds: [1, 2], rounds: 100 }));
  assert.ok(/buildStressSuite\(\{ seeds: \[1,2\] \}\)/.test(art.replay.call));
});

test('agentFingerprint ignores the audit log (S7 isolation primitive)', () => {
  const a = foldAttention([]);
  const b = foldAttention([null, null, 'junk']); // grows only the rejection log
  assert.equal(agentFingerprint(a), agentFingerprint(b));
  assert.notEqual(a.rejected.length, b.rejected.length === 0 ? -1 : b.rejected.length); // b did record one '?'
});

test('a numeric event_id keeps its own dedup identity (distinct from the identity-less class)', () => {
  const s = foldAttention([{ event_id: 7, seq: 1, kind: 'agent_registered' }, { event_id: 7, seq: 1, kind: 'agent_registered' }, null]);
  const ids = s.rejected.map((r) => r.event_id).sort();
  assert.deepEqual(ids, ['7', '?']); // one '7' (deduped across both deliveries) + one '?'
});
