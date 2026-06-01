/**
 * A. Cabinet catalog tests + catalog-level parts of C (prize catalog).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CABINETS, PRIZES, ZONES, getCabinet, getCabinetByMachineId, getPrize, isPlayableCabinet,
  ticketedMachineIds, cabinetCatalogPayload, prizeCatalogPayload, EQUIP_SLOTS,
} from '../../workers/arcade/src/catalog.mjs';

test('catalog returns the Pulse Tap cabinet with a stable id + ruleset version', () => {
  const c = getCabinet('pulse-tap-01');
  assert.ok(c);
  assert.equal(c.cabinet_id, 'pulse-tap-01');
  assert.equal(c.machine_id, 'pulse');
  assert.equal(c.ruleset_version, 'pulse-tap/1');
  assert.equal(c.status, 'live');
  assert.equal(c.ticket_enabled, true);
});

test('Pulse Tap is playable; coming_soon cabinets are not', () => {
  assert.equal(isPlayableCabinet('pulse-tap-01'), true);
  for (const c of CABINETS.filter((x) => x.status === 'coming_soon')) {
    assert.equal(isPlayableCabinet(c.cabinet_id), false, `${c.cabinet_id} must not be playable`);
    assert.equal(c.ticket_enabled, false);
  }
});

test('unknown cabinet is rejected (null) and is not playable', () => {
  assert.equal(getCabinet('does-not-exist'), null);
  assert.equal(isPlayableCabinet('does-not-exist'), false);
});

test('Phase 1l: Neon Grid is an active, ticketed cabinet with stable id/type/ruleset (machine grid)', () => {
  const c = getCabinet('neon-grid-01');
  assert.ok(c);
  assert.equal(c.cabinet_id, 'neon-grid-01');
  assert.equal(c.machine_id, 'grid');
  assert.equal(c.cabinet_type, 'neon_grid');
  assert.equal(c.ruleset_version, 'neon-grid-v1');
  assert.equal(c.status, 'live');
  assert.equal(c.ticket_enabled, true);
  assert.equal(isPlayableCabinet('neon-grid-01'), true);
  assert.equal(getCabinetByMachineId('grid'), c);
  // the room creates one occupancy machine per live ticketed cabinet — grid included
  assert.ok(ticketedMachineIds().includes('grid'));
  assert.deepEqual(ticketedMachineIds().sort(), ['grid', 'pulse', 'signal'].sort());
});

test('cabinet catalog payload is deterministic', () => {
  assert.deepEqual(cabinetCatalogPayload(), cabinetCatalogPayload());
});

test('every cabinet belongs to a known zone', () => {
  const zoneIds = new Set(ZONES.map((z) => z.zone_id));
  for (const c of CABINETS) assert.ok(zoneIds.has(c.zone_id), `${c.cabinet_id} zone`);
});

test('prize catalog returns only enabled prizes, each with a positive cost + valid slot', () => {
  const { prizes } = prizeCatalogPayload();
  assert.ok(prizes.length >= 4);
  assert.ok(prizes.every((p) => p.enabled));
  assert.ok(!prizes.some((p) => p.prize_id === 'mystery-unit-soon')); // disabled excluded
  for (const p of prizes) {
    assert.ok(Number.isInteger(p.cost_tickets) && p.cost_tickets > 0, `${p.prize_id} cost`);
    assert.ok(EQUIP_SLOTS.includes(p.equip_slot), `${p.prize_id} slot`);
    assert.equal(p.bound_to, 'session'); // session-scoped, never an account/global good
  }
});

test('a disabled prize exists in the master list but not the public catalog', () => {
  assert.ok(PRIZES.some((p) => p.prize_id === 'mystery-unit-soon' && p.enabled === false));
  assert.equal(getPrize('mystery-unit-soon').enabled, false);
});

test('unknown prize id resolves to null', () => {
  assert.equal(getPrize('nope'), null);
});

test('prize catalog payload is deterministic', () => {
  assert.deepEqual(prizeCatalogPayload(), prizeCatalogPayload());
});
