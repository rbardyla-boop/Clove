/**
 * Phase 1h — D. Achievement badges (grant + equip integration via existing inventory).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACHIEVEMENTS, getAchievement, getAchievementByBadge, achievementCatalogPayload,
  grantAchievement, getAchievements, hasAchievement,
} from '../../workers/arcade/src/achievements.mjs';
import { equipCosmetic, getInventory, getEquips, publicCosmeticState } from '../../workers/arcade/src/prize-authority.mjs';
import { createTicketState } from '../../workers/arcade/src/round-authority.mjs';

const NOW = 6_000_000;
const A = 'player:a';
const B = 'player:b';

test('achievement catalog is deterministic and badge ids do not collide with prizes', () => {
  assert.deepEqual(achievementCatalogPayload(), achievementCatalogPayload());
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.badge_cosmetic_id.startsWith('badge-'), `${a.achievement_id} badge id`);
    assert.equal(a.equip_slot, 'badge');
  }
});

test('granting an achievement creates a badge entitlement in the owner inventory', () => {
  const r = grantAchievement(createTicketState(), { playerId: A, achievementId: 'circuit-tourist', now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.granted, true);
  assert.ok(hasAchievement(r.state, A, 'circuit-tourist'));
  assert.ok(getInventory(r.state, A).some((i) => i.prize_id === 'badge-circuit-tourist' && i.source === 'achievement'));
  assert.equal(getAchievements(r.state, A).length, 1);
});

test('a duplicate grant does not duplicate the badge', () => {
  let state = grantAchievement(createTicketState(), { playerId: A, achievementId: 'circuit-tourist', now: NOW }).state;
  const again = grantAchievement(state, { playerId: A, achievementId: 'circuit-tourist', now: NOW + 1 });
  assert.equal(again.granted, false);
  assert.equal(getInventory(again.state, A).filter((i) => i.prize_id === 'badge-circuit-tourist').length, 1);
});

test('an unknown achievement is rejected', () => {
  const r = grantAchievement(createTicketState(), { playerId: A, achievementId: 'nope', now: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown_achievement');
});

test('an achievement badge equips through the existing cosmetic equip path', () => {
  let state = grantAchievement(createTicketState(), { playerId: A, achievementId: 'clean-signal', now: NOW }).state;
  const eq = equipCosmetic(state, { playerId: A, prizeId: 'badge-clean-signal' });
  assert.equal(eq.ok, true);
  assert.equal(eq.slot, 'badge');
  assert.equal(getEquips(eq.state, A).badge, 'badge-clean-signal');
});

test('a non-owner cannot equip an achievement badge', () => {
  const state = grantAchievement(createTicketState(), { playerId: A, achievementId: 'clean-signal', now: NOW }).state;
  const eq = equipCosmetic(state, { playerId: B, prizeId: 'badge-clean-signal' });
  assert.equal(eq.ok, false);
  assert.equal(eq.reason, 'not_owned');
});

test('public cosmetic state shows the achievement badge display name, no private data', () => {
  let state = grantAchievement(createTicketState(), { playerId: A, achievementId: 'circuit-tourist', now: NOW }).state;
  state = equipCosmetic(state, { playerId: A, prizeId: 'badge-circuit-tourist' }).state;
  const pub = publicCosmeticState(state);
  assert.deepEqual(pub[A].badge, { prize_id: 'badge-circuit-tourist', display_name: 'Circuit Tourist' });
  const serialized = JSON.stringify(pub);
  assert.ok(!/balance|ledger|redemption/i.test(serialized));
});

test('getAchievementByBadge resolves the achievement for an inventory badge id', () => {
  assert.equal(getAchievementByBadge('badge-ticket-starter').achievement_id, 'ticket-starter');
  assert.equal(getAchievementByBadge('nope'), null);
});
