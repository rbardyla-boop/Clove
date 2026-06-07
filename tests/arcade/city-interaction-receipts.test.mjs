/**
 * Phase 7E — server-confirmed interaction receipts unit tests (pure builder).
 * Mirrors the validation the CityRoom DO + dev-shim perform; both import this builder.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInteractionReceipt, normalizeInteractionRequest, expectedRequestType, INTERACTION_RECEIPT_KIND,
} from '../../arcade/city/city-interaction-receipts.mjs';

const NOW = 1_700_000_000_000;
const IN_ARCADE = { x: 240, y: 580 };   // inside the downtown arcade portal zone (200..280, 560..600)
const OUTSIDE = { x: 500, y: 500 };       // open plaza, not in the portal zone
const RID = 'ix-test-1';
const mk = (request, playerPos = IN_ARCADE, cityId = 'downtown-01') =>
  buildInteractionReceipt({ playerPos, cityId, request, receiptId: RID, now: NOW });

test('receipt envelope is public-safe with no private fields', () => {
  const r = mk({ action_kind: 'arcade_entry' });
  assert.equal(r.kind, INTERACTION_RECEIPT_KIND);
  assert.equal(r.public_safe, true);
  assert.equal(r.receipt_id, RID);
  assert.equal(r.issued_at, NOW);
  for (const k of Object.keys(r)) assert.ok(!/player|secret|token|session|user|\bip\b|password/i.test(k), `field ${k} must not be private`);
});

test('arcade_entry accepted only when inside the zone', () => {
  const ok = mk({ action_kind: 'arcade_entry' }, IN_ARCADE);
  assert.equal(ok.accepted, true);
  assert.equal(ok.reason, 'ok');
  assert.equal(ok.target, '/arcade/');
  const no = mk({ action_kind: 'arcade_entry' }, OUTSIDE);
  assert.equal(no.accepted, false);
  assert.equal(no.reason, 'not_in_zone');
});

test('block_travel accepted for an adjacent block, rejected for non-adjacent', () => {
  const adj = mk({ action_kind: 'block_travel', target_city_id: 'harbor-02' }, OUTSIDE, 'downtown-01');
  assert.equal(adj.accepted, true);
  assert.equal(adj.target_city_id, 'harbor-02');
  const far = mk({ action_kind: 'block_travel', target_city_id: 'skyline-03' }, OUTSIDE, 'downtown-01');
  assert.equal(far.accepted, false); // downtown↔skyline are non-adjacent
  const self = mk({ action_kind: 'block_travel', target_city_id: 'downtown-01' }, OUTSIDE, 'downtown-01');
  assert.equal(self.accepted, false); // cannot travel to self
  const unknown = mk({ action_kind: 'block_travel', target_city_id: 'atlantis-99' }, OUTSIDE, 'downtown-01');
  assert.equal(unknown.accepted, false);
});

test('display acks (district_event / activity_board / block_preview) are accepted in a valid block', () => {
  for (const action_kind of ['district_event', 'activity_board', 'block_preview']) {
    const r = mk({ action_kind }, OUTSIDE);
    assert.equal(r.accepted, true, `${action_kind} accepted`);
    assert.equal(r.reason, 'ok');
  }
});

test('unknown / forbidden action kinds are rejected', () => {
  for (const action_kind of ['shop', 'buy_tickets', 'wager', '', 'arcade_exit']) {
    const r = mk({ action_kind });
    assert.equal(r.accepted, false, `${action_kind} rejected`);
    assert.equal(r.reason, 'unknown_action');
  }
});

test('not joined (no canonical position) is rejected', () => {
  assert.equal(buildInteractionReceipt({ playerPos: null, cityId: 'downtown-01', request: { action_kind: 'arcade_entry' }, receiptId: RID, now: NOW }).reason, 'not_joined');
  assert.equal(mk({ action_kind: 'arcade_entry' }, { x: NaN, y: 5 }).reason, 'not_joined');
});

test('the client cannot author position — only the server-supplied playerPos is used', () => {
  // a request carrying x/y/accepted is ignored; acceptance depends solely on the server playerPos
  const forged = mk({ action_kind: 'arcade_entry', x: 240, y: 580, accepted: true }, OUTSIDE);
  assert.equal(forged.accepted, false); // server position is OUTSIDE → rejected regardless of forged fields
});

test('normalizeInteractionRequest reads only safe fields', () => {
  const n = normalizeInteractionRequest({ action_kind: 'block_travel', zone_id: 'z', target_city_id: 'harbor-02', x: 1, evil: {} });
  assert.deepEqual(n, { action_kind: 'block_travel', zone_id: 'z', target_city_id: 'harbor-02' });
  assert.deepEqual(normalizeInteractionRequest(null), { action_kind: '', zone_id: '' });
});

test('deterministic + receipt carries no economy semantics', () => {
  const a = mk({ action_kind: 'arcade_entry' });
  const b = mk({ action_kind: 'arcade_entry' });
  assert.deepEqual(a, b);
  // no balance/credit/ticket/reward fields anywhere in the receipt
  for (const k of Object.keys(a)) assert.ok(!/ticket|prize|reward|balance|credit|coin|cash|payout|score/i.test(k));
});

test('expectedRequestType maps kinds to their 7A action_request_type', () => {
  assert.equal(expectedRequestType('arcade_entry'), 'arcade_entry_request');
  assert.equal(expectedRequestType('block_travel'), 'block_travel_request');
  assert.equal(expectedRequestType('nope'), null);
});
