// W-6 LAB — evidence pack: the seeded stress scenario must prove every claim, deterministically.
// Run: node --test tests/arcade/attention-evidence.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildEvidencePack, buildScenario } from '../../arcade/hiveworld-agents/attention-evidence.mjs';

test('the default evidence pack PASSES every claim (C1–C10)', () => {
  const pack = buildEvidencePack();
  for (const c of pack.claims) assert.ok(c.ok, `${c.id}: ${c.detail}`);
  assert.equal(pack.pass, true);
  assert.equal(pack.claims.length, 10);
  assert.equal(pack.lab_only, true);
});

test('the pack is deterministic: same seed → byte-identical pack', () => {
  assert.equal(JSON.stringify(buildEvidencePack({ seed: 7 })), JSON.stringify(buildEvidencePack({ seed: 7 })));
});

test('different seeds change the scenario but never the verdict', () => {
  const a = buildEvidencePack({ seed: 1, rounds: 120 });
  const b = buildEvidencePack({ seed: 2, rounds: 120 });
  assert.notEqual(a.fingerprint, b.fingerprint);
  assert.equal(a.pass && b.pass, true);
});

test('scale probe: a larger scenario still passes and stays conserved', () => {
  const pack = buildEvidencePack({ seed: 99, rooms: 6, cabinets: 24, rounds: 800, shuffles: 10, duplicates: 200 });
  assert.equal(pack.pass, true);
  assert.ok(pack.event_count > 1600);
  assert.ok(pack.agent_count === 30);
});

test('the scenario really contains the attack injections (the pack is not vacuous)', () => {
  const { events, expects } = buildScenario({ seed: 42 });
  assert.ok(expects.length >= 10);
  const ids = new Set(events.map((e) => e.event_id));
  for (const x of expects) assert.ok(ids.has(x.event_id), `${x.event_id} present in scenario`);
});

test('pack output vocabulary stays attention-framed (no payment/cash/ticket keys)', () => {
  const pack = buildEvidencePack({ seed: 5, rounds: 60 });
  const bad = /balance|payment|payout|cash|wallet|ticket|mint|earn/i;
  const keys = [];
  const walk = (v) => { if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.push(k); walk(x); } };
  walk(pack);
  assert.ok(keys.every((k) => !bad.test(k)), keys.filter((k) => bad.test(k)).join(','));
});
