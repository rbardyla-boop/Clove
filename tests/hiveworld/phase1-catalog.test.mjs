/**
 * Phase 1 parity — catalog + render-state (server catalog is the authority).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CABINETS, PRODUCT_CABINET_IDS, getCabinet, getCabinetByMachineId, isLiveTicketed,
  ticketedMachineIds, cabinetCatalogPayload, prizeCatalogPayload, getPrize,
} from '../../arcade/hiveworld-sim/core/phase1/catalog.mjs';
import { cabinetRenderState, adapterStateFor } from '../../arcade/hiveworld-sim/core/phase1/adapters.mjs';

test('catalog has the three product cabinets, stable id/type/ruleset', () => {
  for (const id of PRODUCT_CABINET_IDS) assert.ok(getCabinet(id), id);
  const grid = getCabinet('neon-grid-01');
  assert.equal(grid.cabinet_type, 'neon_grid');
  assert.equal(grid.ruleset_version, 'neon-grid-v1');
  assert.equal(grid.adapter_mode, 'imported');
  assert.equal(grid.frame_contract_id, 'neon_grid');
  assert.equal(getCabinetByMachineId('grid'), grid);
});

test('catalog payload is deterministic', () => {
  assert.deepEqual(cabinetCatalogPayload(), cabinetCatalogPayload());
});

test('three live ticketed machines (pulse, signal, grid) plus deliberately-broken cabinets', () => {
  assert.deepEqual(ticketedMachineIds().sort(), ['glx', 'grid', 'myx', 'pulse', 'signal'].sort());
  assert.equal(isLiveTicketed('pulse-tap-01'), true);
  assert.equal(isLiveTicketed('circuit-match-01'), false); // coming_soon
});

test('render-state: active+valid → playable; coming_soon → coming_soon; active+no/invalid adapter → unavailable', () => {
  const activated = new Set(['neon_grid']); // catalog activates the imported Neon Grid
  assert.equal(cabinetRenderState(getCabinet('pulse-tap-01'), { activated }), 'playable');
  assert.equal(cabinetRenderState(getCabinet('signal-sprint-01'), { activated }), 'playable');
  assert.equal(cabinetRenderState(getCabinet('neon-grid-01'), { activated }), 'playable');
  assert.equal(cabinetRenderState(getCabinet('circuit-match-01'), { activated }), 'coming_soon');
  assert.equal(cabinetRenderState(getCabinet('mystery-x-01'), { activated }), 'unavailable'); // no adapter
  assert.equal(cabinetRenderState(getCabinet('glitch-cab-01'), { activated }), 'unavailable'); // invalid adapter
  assert.equal(cabinetRenderState(null), 'not_listed');
});

test('an imported cabinet is NOT playable until the catalog activates its adapter', () => {
  assert.equal(cabinetRenderState(getCabinet('neon-grid-01'), { activated: new Set() }), 'unavailable');
  assert.equal(cabinetRenderState(getCabinet('neon-grid-01'), { activated: new Set(['neon_grid']) }), 'playable');
});

test('adapter states classify every cabinet', () => {
  const activated = new Set(['neon_grid']);
  assert.equal(adapterStateFor(getCabinet('pulse-tap-01')), 'valid_builtin');
  assert.equal(adapterStateFor(getCabinet('neon-grid-01'), { activated }), 'valid_imported_enabled');
  assert.equal(adapterStateFor(getCabinet('neon-grid-01')), 'valid_imported_disabled');
  assert.equal(adapterStateFor(getCabinet('mystery-x-01')), 'missing_adapter');
  assert.equal(adapterStateFor(getCabinet('glitch-cab-01')), 'invalid_adapter');
  assert.equal(adapterStateFor(getCabinet('circuit-match-01')), 'coming_soon');
});

test('prize catalog returns enabled prizes only; disabled prize excluded', () => {
  const { prizes } = prizeCatalogPayload();
  assert.ok(prizes.length >= 4);
  assert.ok(prizes.every((p) => p.enabled && p.bound_to === 'session'));
  assert.ok(!prizes.some((p) => p.prize_id === 'mystery-unit-soon'));
  assert.equal(getPrize('mystery-unit-soon').enabled, false);
});
