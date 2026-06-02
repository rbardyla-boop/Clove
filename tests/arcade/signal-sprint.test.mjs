/**
 * Phase 1g — Signal Sprint catalog (A) + ticket formula / validation (C).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CABINETS, getCabinet, getCabinetByMachineId, isPlayableCabinet, ticketedMachineIds,
  cabinetCatalogPayload,
} from '../../workers/arcade/src/catalog.mjs';
import {
  computeSignalTickets, validateSignalPayload, GRADE_BASE, SIGNAL_LIMITS,
} from '../../workers/arcade/src/signal-sprint.mjs';

// ── A. catalog ──────────────────────────────────────────────────────────────
test('Signal Sprint is an active, ticketed cabinet with a stable id/type/ruleset', () => {
  const c = getCabinet('signal-sprint-01');
  assert.ok(c);
  assert.equal(c.cabinet_id, 'signal-sprint-01');
  assert.equal(c.machine_id, 'signal');
  assert.equal(c.cabinet_type, 'signal_sprint');
  assert.equal(c.ruleset_version, 'signal-sprint/1');
  assert.equal(c.status, 'live');
  assert.equal(c.ticket_enabled, true);
  assert.equal(c.zone_id, 'cabinet_row');
});

test('Signal Sprint and Pulse Tap are both playable; coming-soon cabinets are not', () => {
  assert.equal(isPlayableCabinet('signal-sprint-01'), true);
  assert.equal(isPlayableCabinet('pulse-tap-01'), true);
  // circuit-match-01 stays a coming-soon, non-ticketed placeholder.
  assert.equal(isPlayableCabinet('circuit-match-01'), false);
  for (const c of CABINETS.filter((x) => x.status === 'coming_soon')) {
    assert.equal(isPlayableCabinet(c.cabinet_id), false, `${c.cabinet_id} must not be playable`);
    assert.equal(c.ticket_enabled, false);
  }
});

test('ticketedMachineIds includes both pulse and signal machines', () => {
  const ids = ticketedMachineIds();
  assert.ok(ids.includes('pulse'));
  assert.ok(ids.includes('signal'));
});

test('getCabinetByMachineId resolves signal + pulse, null otherwise', () => {
  assert.equal(getCabinetByMachineId('signal').cabinet_id, 'signal-sprint-01');
  assert.equal(getCabinetByMachineId('pulse').cabinet_id, 'pulse-tap-01');
  assert.equal(getCabinetByMachineId('claw'), null);
  assert.equal(getCabinetByMachineId(''), null);
});

test('catalog payload remains deterministic after adding Signal Sprint', () => {
  assert.deepEqual(cabinetCatalogPayload(), cabinetCatalogPayload());
});

// ── C. ticket formula ─────────────────────────────────────────────────────────
function base(grade) {
  return computeSignalTickets({ grade, distance: 0, maxStreak: 0, noiseHits: 0 });
}

test('grades map to their base ticket value (S=22 … F=0)', () => {
  assert.equal(base('S'), 22);
  assert.equal(base('A'), 16);
  assert.equal(base('B'), 11);
  assert.equal(base('C'), 6);
  assert.equal(base('D'), 3);
  assert.equal(base('F'), 0);
  for (const [grade, b] of Object.entries(GRADE_BASE)) assert.equal(base(grade), b, `grade ${grade}`);
});

test('distance bonus is +1 per 250 and capped at +8', () => {
  // grade F isolates the distance bonus (base 0, no streak/noise)
  assert.equal(computeSignalTickets({ grade: 'F', distance: 0, maxStreak: 0, noiseHits: 0 }), 0);
  assert.equal(computeSignalTickets({ grade: 'F', distance: 250, maxStreak: 0, noiseHits: 0 }), 1);
  assert.equal(computeSignalTickets({ grade: 'F', distance: 1000, maxStreak: 0, noiseHits: 0 }), 4);
  assert.equal(computeSignalTickets({ grade: 'F', distance: 2000, maxStreak: 0, noiseHits: 0 }), 8); // exactly cap
  assert.equal(computeSignalTickets({ grade: 'F', distance: 9999, maxStreak: 0, noiseHits: 0 }), 8); // capped
});

test('streak bonus is tiered (>=25 → +5, >=12 → +3, else +0)', () => {
  assert.equal(computeSignalTickets({ grade: 'F', distance: 0, maxStreak: 25, noiseHits: 0 }), 5);
  assert.equal(computeSignalTickets({ grade: 'F', distance: 0, maxStreak: 12, noiseHits: 0 }), 3);
  assert.equal(computeSignalTickets({ grade: 'F', distance: 0, maxStreak: 11, noiseHits: 0 }), 0);
});

test('noise penalty is -1 per 3 hits and capped at -5', () => {
  // grade A (16) isolates the penalty: 16 - floor(noise/3) capped at -5
  assert.equal(computeSignalTickets({ grade: 'A', distance: 0, maxStreak: 0, noiseHits: 0 }), 16);
  assert.equal(computeSignalTickets({ grade: 'A', distance: 0, maxStreak: 0, noiseHits: 3 }), 15);
  assert.equal(computeSignalTickets({ grade: 'A', distance: 0, maxStreak: 0, noiseHits: 15 }), 11); // -5 cap
  assert.equal(computeSignalTickets({ grade: 'A', distance: 0, maxStreak: 0, noiseHits: 999 }), 11); // still -5
});

test('absolute max payout per round is enforced (35)', () => {
  // S(22) + distance cap(8) + streak high(5) = 35, exactly the cap
  assert.equal(computeSignalTickets({ grade: 'S', distance: 9999, maxStreak: 999, noiseHits: 0 }), 35);
  assert.ok(computeSignalTickets({ grade: 'S', distance: Number.MAX_SAFE_INTEGER, maxStreak: 9999, noiseHits: 0 }) <= SIGNAL_LIMITS.MAX_PAYOUT);
});

test('ticket floor is zero — penalties never go negative', () => {
  assert.equal(computeSignalTickets({ grade: 'F', distance: 0, maxStreak: 0, noiseHits: 999 }), 0);
  assert.equal(computeSignalTickets({ grade: 'D', distance: 0, maxStreak: 0, noiseHits: 999 }), 0); // 3 - 5 → 0
});

function goodPayload(over = {}) {
  return {
    roundId: 'r1', machineId: 'signal', cabinetType: 'signal_sprint', rulesetVersion: 'signal-sprint/1',
    grade: 'A', score: 4200, distance: 1800, pulsesCollected: 42, noiseHits: 6, maxStreak: 14, durationMs: 25000, ...over,
  };
}

test('a well-formed Signal Sprint payload validates', () => {
  assert.deepEqual(validateSignalPayload(goodPayload()), { ok: true, reason: null });
});

test('malformed Signal Sprint payloads are rejected', () => {
  assert.equal(validateSignalPayload(null).reason, 'malformed');
  assert.equal(validateSignalPayload({}).reason, 'malformed');
  assert.equal(validateSignalPayload(goodPayload({ roundId: '' })).reason, 'malformed');
  assert.equal(validateSignalPayload(goodPayload({ score: 1.5 })).reason, 'malformed');
  assert.equal(validateSignalPayload(goodPayload({ pulsesCollected: -1 })).reason, 'malformed');
  assert.equal(validateSignalPayload(goodPayload({ noiseHits: -1 })).reason, 'malformed');
  assert.equal(validateSignalPayload(goodPayload({ maxStreak: -1 })).reason, 'malformed');
});

test('impossible / negative / out-of-bounds Signal Sprint values are rejected', () => {
  assert.equal(validateSignalPayload(goodPayload({ score: -5 })).reason, 'negative_score');
  assert.equal(validateSignalPayload(goodPayload({ score: SIGNAL_LIMITS.MAX_SCORE + 1 })).reason, 'score_out_of_bounds');
  assert.equal(validateSignalPayload(goodPayload({ distance: -1 })).reason, 'negative_distance');
  assert.equal(validateSignalPayload(goodPayload({ distance: SIGNAL_LIMITS.MAX_DISTANCE + 1 })).reason, 'distance_out_of_bounds');
  assert.equal(validateSignalPayload(goodPayload({ durationMs: 10 })).reason, 'duration_out_of_bounds');
  assert.equal(validateSignalPayload(goodPayload({ durationMs: 999999 })).reason, 'duration_out_of_bounds');
  assert.equal(validateSignalPayload(goodPayload({ grade: 'Z' })).reason, 'bad_grade');
});
