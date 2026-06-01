/**
 * Phase 1 parity — privacy boundaries: public state leaks no private balance/ledger/inventory.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicCosmeticState } from '../../arcade/hiveworld-sim/core/phase1/prize.mjs';
import { feedIsPublicSafe, PRIVATE_FIELD_RE } from '../../arcade/hiveworld-sim/core/phase1/sideband-map.mjs';
import { phase1QuickStart, privacyBoundaryLoop, threeCabinetTour } from '../../arcade/hiveworld-sim/scenarios/phase1.mjs';

const A = 'agent:a';
const B = 'agent:b';

test('public cosmetic state shows only equipped prize_id + display_name (no balance/ledger)', () => {
  const { report } = phase1QuickStart({});
  const pub = publicCosmeticState(report.finalWorldState.arcade);
  assert.ok(pub[A] && pub[A].badge);
  assert.equal(pub[A].badge.display_name, 'Founder Badge');
  const json = JSON.stringify(pub);
  assert.ok(!PRIVATE_FIELD_RE.test(json), json);
});

test('the public feed never carries private balance / ledger / inventory', () => {
  const { report } = threeCabinetTour({});
  assert.equal(feedIsPublicSafe(report.finalWorldState.arcade.feed), true);
});

test('cross-actor isolation: B sees A public cosmetics but no private state, and cannot equip A items', () => {
  const { report } = privacyBoundaryLoop({});
  const arcade = report.finalWorldState.arcade;
  // A owns + equipped the founder badge; B owns nothing.
  assert.ok(Object.values(arcade.inventory[A]).some((i) => i.prize_id === 'founder-badge-local'));
  assert.equal(arcade.inventory[B], undefined);
  // B's equip of an unowned item was rejected (no equip recorded for B).
  assert.equal(arcade.equips[B], undefined);
  assert.ok(report.rejectedEvents.some((r) => r.reason === 'not_owned'));
  // The public projection over the whole arcade exposes no private fields.
  assert.ok(!PRIVATE_FIELD_RE.test(JSON.stringify(publicCosmeticState(arcade))));
});

test('private slices (balances/ledger/inventory) exist but are NEVER part of any public projection', () => {
  const { report } = threeCabinetTour({});
  const arcade = report.finalWorldState.arcade;
  // they exist privately...
  assert.ok(arcade.balances[A] > 0 && arcade.ledger[A].length > 0);
  // ...but the public cosmetic + feed projections carry none of it.
  const publicJson = JSON.stringify({ cosmetics: publicCosmeticState(arcade), feed: arcade.feed });
  assert.ok(!PRIVATE_FIELD_RE.test(publicJson));
});
