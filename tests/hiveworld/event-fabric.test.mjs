/**
 * A. Event fabric tests — hashing, dedup, signature/sideband rejection, replay.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEvent, validateEnvelope, EVENT_SPECS } from '../../arcade/hiveworld-sim/core/events.mjs';
import { SidebandCRDTLog } from '../../arcade/hiveworld-sim/core/log.mjs';
import { fold } from '../../arcade/hiveworld-sim/core/world.mjs';
import { getHandler } from '../../arcade/hiveworld-sim/core/reducers/index.mjs';

const baseArgs = { actorId: 'agent:a', eventType: 'presence_ping', sideband: 'presence', logicalTick: 1, seq: 0 };

test('event hashes are deterministic', () => {
  const a = createEvent(baseArgs);
  const b = createEvent(baseArgs);
  assert.equal(a.content_hash, b.content_hash);
  assert.equal(a.event_id, b.event_id);
  assert.equal(a.signature, b.signature);
});

test('duplicate event IDs are ignored', () => {
  const log = new SidebandCRDTLog();
  const ev = createEvent(baseArgs);
  assert.equal(log.ingest(ev).status, 'accepted');
  assert.equal(log.ingest(ev).status, 'ignored_duplicate');
  assert.equal(log.size, 1);
});

test('invalid signatures are rejected', () => {
  const ev = createEvent(baseArgs);
  const forged = { ...ev, signature: 'mocksig1:deadbeefdeadbeef' };
  assert.equal(validateEnvelope(forged).reason, 'bad_signature');
  assert.equal(new SidebandCRDTLog().ingest(forged).status, 'rejected');
});

test('tampered content is rejected (bad_content_hash)', () => {
  const ev = createEvent({ ...baseArgs, eventType: 'occupy_cabinet', sideband: 'occupancy', roomId: 'room:main', payload: { machineId: 'pulse' } });
  const tampered = { ...ev, payload: { machineId: 'claw' } };
  assert.equal(validateEnvelope(tampered).reason, 'bad_content_hash');
});

test('unknown sidebands are rejected', () => {
  const ev = createEvent({ ...baseArgs, sideband: 'pirate_band' });
  assert.equal(validateEnvelope(ev).reason, 'unknown_sideband');
});

test('forbidden economy types are rejected at the fabric', () => {
  const ev = createEvent({ actorId: 'agent:a', eventType: 'cashout_credits', sideband: 'market', payload: { amount: 1 }, logicalTick: 1, seq: 0 });
  assert.equal(validateEnvelope(ev).reason, 'forbidden_event_type');
});

test('replay produces the same state regardless of ingest order', () => {
  const evs = [
    createEvent({ actorId: 'room:main', eventType: 'room_announce', sideband: 'discovery', payload: { roomId: 'room:main' }, logicalTick: 0, seq: 0 }),
    createEvent({ actorId: 'agent:a', eventType: 'agent_announce', sideband: 'discovery', payload: { role: 'player' }, logicalTick: 0, seq: 0 }),
    createEvent({ actorId: 'agent:a', eventType: 'occupy_cabinet', sideband: 'occupancy', roomId: 'room:main', payload: { machineId: 'pulse' }, logicalTick: 3, seq: 1 }),
  ];
  const inOrder = new SidebandCRDTLog();
  evs.forEach((e) => inOrder.ingest(e));
  const reversed = new SidebandCRDTLog();
  [...evs].reverse().forEach((e) => reversed.ingest(e));
  assert.equal(fold(inOrder.ordered()).fingerprint, fold(reversed.ordered()).fingerprint);
});

test('every known event_type has a reducer (coverage guard)', () => {
  for (const type of Object.keys(EVENT_SPECS)) {
    assert.ok(getHandler(type), `missing handler for ${type}`);
  }
});
