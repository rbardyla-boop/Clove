/**
 * Phase 1h — E. Arcade event feed (bounded, public-safe).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendEvent, eventFeedPayload, MAX_EVENTS } from '../../workers/arcade/src/events.mjs';
import { createTicketState } from '../../workers/arcade/src/round-authority.mjs';

const NOW = 7_000_000;

test('appended events appear in the feed in order with monotonic logical_time', () => {
  let state = createTicketState();
  state = appendEvent(state, { type: 'ticket_award', actorPublicId: 'a', summary: 'a earned 20 tickets at Pulse Tap', source: 'pulse', now: NOW }).state;
  state = appendEvent(state, { type: 'achievement_unlocked', actorPublicId: 'a', summary: 'a unlocked Circuit Tourist', source: 'achievement', now: NOW + 1 }).state;
  const { events } = eventFeedPayload(state);
  assert.equal(events.length, 2);
  assert.equal(events[0].logical_time, 1);
  assert.equal(events[1].logical_time, 2);
  assert.equal(events[1].event_type, 'achievement_unlocked');
});

test('every event is marked public_safe and carries only a summary string', () => {
  const { state, event } = appendEvent(createTicketState(), { type: 'ticket_award', actorPublicId: 'a', summary: 'a earned 13 tickets at Signal Sprint', source: 'signal', now: NOW });
  assert.equal(event.public_safe, true);
  assert.equal(typeof event.summary, 'string');
  // no private fields leak into the event
  const serialized = JSON.stringify(eventFeedPayload(state));
  assert.ok(!/balance|ledger|redemption_id|inventory/i.test(serialized));
});

test('the feed is bounded to MAX_EVENTS (oldest dropped)', () => {
  let state = createTicketState();
  for (let i = 0; i < MAX_EVENTS + 20; i++) {
    state = appendEvent(state, { type: 'ticket_award', actorPublicId: 'a', summary: `event ${i}`, now: NOW + i }).state;
  }
  const { events } = eventFeedPayload(state);
  assert.equal(events.length, MAX_EVENTS);
  // the very first events were trimmed; ordering is preserved
  assert.equal(events[0].summary, `event ${20}`);
  assert.equal(events[events.length - 1].summary, `event ${MAX_EVENTS + 20 - 1}`);
});

test('event ids are unique across a burst', () => {
  let state = createTicketState();
  for (let i = 0; i < 10; i++) state = appendEvent(state, { type: 't', actorPublicId: 'a', summary: `s${i}`, now: NOW + i }).state;
  const ids = new Set(eventFeedPayload(state).events.map((e) => e.event_id));
  assert.equal(ids.size, 10);
});
