/**
 * E. Mesh tests — delayed/out-of-order/duplicate convergence, malicious rejection, recovery.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SidebandCRDTLog } from '../../arcade/hiveworld-sim/core/log.mjs';
import { fold } from '../../arcade/hiveworld-sim/core/world.mjs';
import { makeRng } from '../../arcade/hiveworld-sim/core/rng.mjs';
import { meshChurn, maliciousCabinetSteal, disconnectReplayConverge } from '../../arcade/hiveworld-sim/scenarios/canned.mjs';

// A representative event set drawn from a real run.
const SOURCE = meshChurn({ seed: 'mesh-src', ticks: 120 }).sim.canonicalLog.ordered();

function foldOf(events) {
  const log = new SidebandCRDTLog();
  events.forEach((e) => log.ingest(e));
  return fold(log.ordered()).fingerprint;
}

test('out-of-order delivery converges to the same state', () => {
  const shuffled = makeRng('shuffle').shuffle(SOURCE);
  assert.equal(foldOf(SOURCE), foldOf(shuffled));
});

test('duplicate delivery does not corrupt state', () => {
  const withDupes = [];
  const rng = makeRng('dupe');
  for (const e of SOURCE) {
    withDupes.push(e);
    if (rng.bool(0.3)) withDupes.push(e); // deliver some twice
  }
  assert.equal(foldOf(SOURCE), foldOf(withDupes));
});

test('delayed (reordered + duplicated) delivery still converges', () => {
  const messy = makeRng('delay').shuffle([...SOURCE, ...SOURCE.slice(0, 20)]);
  assert.equal(foldOf(SOURCE), foldOf(messy));
});

test('malicious events are visibly rejected and never alter authority', () => {
  const { report } = maliciousCabinetSteal({});
  const reasons = report.rejectedEvents.map((r) => r.reason);
  assert.ok(reasons.includes('forbidden_event_type'), 'forbidden transfer rejected');
  assert.ok(reasons.includes('bad_content_hash'), 'forged envelope rejected');
  assert.ok(reasons.includes('busy'), 'occupy-busy rejected');
  assert.ok(reasons.includes('not_moderator'), 'non-moderator suspend rejected');
  // The honest player keeps the cabinet despite all attacks.
  assert.equal(report.finalWorldState.rooms['room:main'].machines.pulse.occupiedBy, 'agent:honest');
});

test('a disconnected agent diverges, then converges after replay', () => {
  const { divergedWhileOffline, divergedAfter, report } = disconnectReplayConverge({});
  assert.ok(divergedWhileOffline >= 1, 'should diverge while offline');
  assert.equal(divergedAfter, 0, 'should converge after reconnect+replay');
  assert.equal(report.desyncReport.finalConverged, true);
});
