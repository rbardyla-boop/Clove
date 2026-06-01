/**
 * Phase 1 parity — sideband mapping: each arcade event rides its expected channel,
 * and private data never leaves on a public/ephemeral sideband.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASE1_EVENT_SIDEBAND, PHASE1_PRODUCT_MAP, sidebandForEvent, feedIsPublicSafe, PRIVATE_FIELD_RE } from '../../arcade/hiveworld-sim/core/phase1/sideband-map.mjs';
import { EVENT_SPECS } from '../../arcade/hiveworld-sim/core/events.mjs';
import { getHandler } from '../../arcade/hiveworld-sim/core/reducers/index.mjs';
import { isKnownSideband } from '../../arcade/hiveworld-sim/core/sidebands.mjs';
import { threeCabinetTour, prizeCounterLoop, roomHealthLifecycle } from '../../arcade/hiveworld-sim/scenarios/phase1.mjs';
import { roomPresenceListPayload } from '../../arcade/hiveworld-sim/core/phase1/rooms.mjs';

test('every mapped arcade event type rides the sideband the fabric assigns it', () => {
  for (const [type, sideband] of Object.entries(PHASE1_EVENT_SIDEBAND)) {
    if (!EVENT_SPECS[type]) continue; // documentation-only entries (e.g. zone_state) need no handler
    assert.equal(EVENT_SPECS[type].sideband, sideband, `${type} should ride ${sideband}`);
    assert.equal(sidebandForEvent(type), sideband);
  }
});

test('the actual arcade fabric event types are all registered with handlers + known sidebands', () => {
  for (const type of ['cabinet_catalog', 'arcade_round_start', 'arcade_round_submit', 'arcade_claim_challenge', 'arcade_redeem', 'arcade_equip', 'arcade_unequip']) {
    assert.ok(EVENT_SPECS[type], `${type} missing from EVENT_SPECS`);
    assert.ok(isKnownSideband(EVENT_SPECS[type].sideband));
  }
});

test('the conceptual product map references only known sidebands', () => {
  for (const sideband of Object.keys(PHASE1_PRODUCT_MAP)) assert.ok(isKnownSideband(sideband), sideband);
});

test('v0.3 room-health events ride presence/moderation and have handlers', () => {
  const expected = { room_heartbeat: 'presence', room_status_set: 'moderation', room_reset: 'moderation' };
  for (const [type, sb] of Object.entries(expected)) {
    assert.equal(EVENT_SPECS[type] && EVENT_SPECS[type].sideband, sb, type);
    assert.equal(sidebandForEvent(type), sb, type);
    assert.ok(getHandler(type), `${type} has a handler`);
  }
});

test('room-health traffic rides presence/moderation; the presence view leaks nothing private', () => {
  const { report } = roomHealthLifecycle({});
  const touched = Object.keys(report.sidebandTraffic);
  for (const sb of touched) assert.ok(isKnownSideband(sb), sb);
  assert.ok(touched.includes('presence'), 'heartbeats ride presence');
  assert.ok(touched.includes('moderation'), 'status/reset ride moderation');
  const reg = report.finalWorldState.roomRegistry;
  const presenceJson = JSON.stringify(roomPresenceListPayload(reg.heartbeats, reg.statusOverrides, 50));
  assert.equal(PRIVATE_FIELD_RE.test(presenceJson), false);
  assert.ok(!/agent:|token/i.test(presenceJson));
});

test('observed traffic in a scenario only touches expected sidebands; the feed leaks nothing private', () => {
  for (const fn of [threeCabinetTour, prizeCounterLoop]) {
    const { report } = fn({});
    const touched = Object.keys(report.sidebandTraffic);
    for (const sb of touched) assert.ok(isKnownSideband(sb), sb);
    // arcade flow only ever rides discovery / event_log / market / asset_sync (+ presence from announces)
    const allowed = new Set(['discovery', 'event_log', 'market', 'asset_sync', 'presence', 'occupancy']);
    for (const sb of touched) assert.ok(allowed.has(sb), `unexpected sideband ${sb}`);
    assert.equal(feedIsPublicSafe(report.finalWorldState.arcade.feed), true);
  }
});
