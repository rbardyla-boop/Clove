/**
 * Phase 7A — city interaction zones / action prompts unit tests (pure model).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { publicLayout, CITY_IDS } from '../../arcade/city/city-block.mjs';
import {
  INTERACTION_KINDS, ACTION_REQUEST_TYPE, pointInZone, validateInteractionZone,
  nearestInteractionZone, actionRequestFor, publicZone, deriveInteractionZones,
} from '../../arcade/city/city-interactions.mjs';

const ARCADE = Object.freeze({
  zone_id: 'arcade', city_id: 'downtown-01', kind: 'arcade_entry',
  x: 200, y: 560, w: 80, h: 40, target: '/arcade/', label: 'ENTER ARCADE',
  prompt: 'Enter arcade', priority: 10, action_request_type: 'arcade_entry_request', public_safe: true,
});
const TRAVEL = Object.freeze({
  zone_id: 'travel-harbor', city_id: 'downtown-01', kind: 'block_travel',
  cx: 600, cy: 680, radius: 40, target_city_id: 'harbor-02',
  label: 'Travel to Harbor', prompt: 'Travel to Harbor', priority: 5,
  action_request_type: 'block_travel_request', public_safe: true,
});

test('allowed kinds + action request types are aligned', () => {
  assert.deepEqual(INTERACTION_KINDS.slice().sort(),
    ['activity_board', 'arcade_entry', 'block_preview', 'block_travel', 'district_event']);
  for (const k of INTERACTION_KINDS) assert.equal(typeof ACTION_REQUEST_TYPE[k], 'string');
});

test('pointInZone handles rectangles and circles', () => {
  assert.equal(pointInZone({ x: 240, y: 580 }, ARCADE), true);
  assert.equal(pointInZone({ x: 500, y: 500 }, ARCADE), false);
  assert.equal(pointInZone({ x: 600, y: 680 }, TRAVEL), true);   // circle center
  assert.equal(pointInZone({ x: 600, y: 740 }, TRAVEL), false);  // > radius
  assert.equal(pointInZone({ x: NaN, y: 1 }, ARCADE), false);
});

test('valid zones pass validation', () => {
  assert.equal(validateInteractionZone(ARCADE).ok, true);
  assert.equal(validateInteractionZone(TRAVEL).ok, true);
});

test('unknown / forbidden kinds are rejected', () => {
  for (const kind of ['shop', 'marketplace', 'buy', 'sell', 'rent', 'wager', 'loot', 'raid', 'cashout', 'nonsense']) {
    const r = validateInteractionZone({ ...ARCADE, kind });
    assert.equal(r.ok, false, `kind ${kind} must be rejected`);
    assert.ok(r.errors.includes('forbidden_or_unknown_kind'));
  }
});

test('economy/ownership/gambling copy in label or prompt is rejected', () => {
  assert.ok(validateInteractionZone({ ...ARCADE, label: 'Buy Tickets' }).errors.includes('forbidden_copy_in_label'));
  assert.ok(validateInteractionZone({ ...ARCADE, prompt: 'Own this block' }).errors.includes('forbidden_copy_in_prompt'));
  assert.ok(validateInteractionZone({ ...ARCADE, prompt: 'Place a wager' }).errors.includes('forbidden_copy_in_prompt'));
  // review hardening: word-suffix + space-separated economy terms must also be rejected
  for (const bad of ['Gambling den', 'Cash out here', 'Earn rewards', 'For sale', 'Boost income']) {
    assert.equal(validateInteractionZone({ ...ARCADE, label: bad }).ok, false, `"${bad}" must be rejected`);
  }
});

test('garbage / malformed zones are rejected (deny-by-default)', () => {
  assert.equal(validateInteractionZone(null).ok, false);
  assert.equal(validateInteractionZone({}).ok, false);
  assert.ok(validateInteractionZone({ ...ARCADE, x: NaN, w: 0, cx: undefined }).errors.includes('invalid_bounds'));
  assert.ok(validateInteractionZone({ ...ARCADE, zone_id: 'bad id!' }).errors.includes('invalid_zone_id'));
  assert.ok(validateInteractionZone({ ...ARCADE, public_safe: false }).errors.includes('not_public_safe'));
  assert.ok(validateInteractionZone({ ...ARCADE, label: 'x'.repeat(99) }).errors.includes('invalid_label'));
  assert.ok(validateInteractionZone({ ...ARCADE, action_request_type: 'wrong' }).errors.includes('action_request_type_mismatch'));
});

test('nearestInteractionZone picks highest priority among containing zones', () => {
  const overlap = { ...TRAVEL, cx: 240, cy: 580, radius: 60, zone_id: 'travel-overlap' }; // overlaps the arcade point, lower priority
  const z = nearestInteractionZone({ x: 240, y: 580 }, [overlap, ARCADE]);
  assert.equal(z.zone_id, 'arcade'); // priority 10 > 5
});

test('nearestInteractionZone breaks ties stably by zone_id', () => {
  const a = { ...ARCADE, zone_id: 'aaa', priority: 7 };
  const b = { ...ARCADE, zone_id: 'bbb', priority: 7 };
  assert.equal(nearestInteractionZone({ x: 240, y: 580 }, [b, a]).zone_id, 'aaa');
});

test('nearestInteractionZone returns null outside all zones and ignores invalid zones', () => {
  assert.equal(nearestInteractionZone({ x: 5, y: 5 }, [ARCADE, TRAVEL]), null);
  const bad = { ...ARCADE, kind: 'shop' };
  assert.equal(nearestInteractionZone({ x: 240, y: 580 }, [bad]), null); // invalid ignored
});

test('actionRequestFor produces the 7E-confirmable shape with no private fields', () => {
  const req = actionRequestFor(ARCADE);
  assert.deepEqual(req, { action_kind: 'arcade_entry', action_request_type: 'arcade_entry_request', zone_id: 'arcade', city_id: 'downtown-01', target: '/arcade/' });
  const treq = actionRequestFor(TRAVEL);
  assert.equal(treq.action_request_type, 'block_travel_request');
  assert.equal(treq.target_city_id, 'harbor-02');
  assert.equal(actionRequestFor({ ...ARCADE, kind: 'shop' }), null); // invalid → null
  // no private identifiers
  for (const k of Object.keys(req)) assert.ok(!/player|secret|token|session|ip|user/i.test(k));
});

test('publicZone exposes only public-safe fields', () => {
  const pz = publicZone(ARCADE);
  assert.deepEqual(Object.keys(pz).sort(), ['action_request_type', 'city_id', 'kind', 'label', 'priority', 'prompt', 'public_safe', 'zone_id']);
  assert.equal(pz.public_safe, true);
});

test('deriveInteractionZones yields a valid arcade_entry zone for every block (incl. foundry-04)', () => {
  for (const cityId of CITY_IDS) {
    const zones = deriveInteractionZones(cityId, publicLayout(cityId));
    assert.ok(zones.length >= 1, `${cityId} has at least one interaction zone`);
    const arcade = zones.find((z) => z.kind === 'arcade_entry');
    assert.ok(arcade, `${cityId} has an arcade_entry zone`);
    assert.equal(validateInteractionZone(arcade).ok, true);
    // back-compat superset of the portal object (existing portal code reads these)
    assert.equal(typeof arcade.id, 'string');
    assert.equal(typeof arcade.target, 'string');
    assert.ok([arcade.x, arcade.y, arcade.w, arcade.h].every((v) => Number.isFinite(v)));
  }
  const foundry = deriveInteractionZones('foundry-04', publicLayout('foundry-04'));
  assert.ok(foundry.some((z) => z.kind === 'arcade_entry'));
});

test('deriveInteractionZones is safe on garbage layout', () => {
  assert.deepEqual(deriveInteractionZones('downtown-01', null), []);
  assert.deepEqual(deriveInteractionZones('downtown-01', { portals: 'nope' }), []);
});
