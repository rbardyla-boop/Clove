/**
 * HiveWorld v1.1 — city-systems deep-mirror tests (product Phase 4C–4G).
 *
 * Verifies each system's product safety posture is ENFORCED IN THE FOLD: 4C append-only + bounded +
 * sanitized; 4D pressure NON-authoritative; 4E host rank NON-cash; 4F stewardship CONSTRAINED (closed
 * allowlist) + host-rank-gated + REVERSIBLE; 4G block trial INSTANCED + NON-destructive. Plus
 * deterministic convergence under reorder/dup. Pure modules tested directly; fold via scenarios.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { appendCityWorldEvent, createCityLog, recentCityEvents, CITY_LOG_MAX } from '../../arcade/hiveworld-sim/core/phase1/city-world-log.mjs';
import { derivePressure, PRESSURE_MOODS } from '../../arcade/hiveworld-sim/core/phase1/city-pressure.mjs';
import { deriveHostRank, HOST_TIERS } from '../../arcade/hiveworld-sim/core/phase1/city-host-rank.mjs';
import { defaultStyle, sanitizeStyleOverride, mergeStyle, isValidStyle, isStewardEligible, PALETTES } from '../../arcade/hiveworld-sim/core/phase1/city-stewardship.mjs';
import { createTrial, addTrialPlayer, stepTrial, closeTrial, isTrialActive, trialPayload, TRIAL_SCORE_CAP } from '../../arcade/hiveworld-sim/core/phase1/city-trial.mjs';
import { CITY_EVENT_SIDEBAND } from '../../arcade/hiveworld-sim/core/phase1/city-events.mjs';
import { EVENT_SPECS } from '../../arcade/hiveworld-sim/core/events.mjs';
import { getHandler } from '../../arcade/hiveworld-sim/core/reducers/index.mjs';
import {
  CITY_SYSTEMS_SCENARIOS, cityLogAppendBounded, pressureDerivesNonAuthoritative, hostRankNonCash,
  stewardshipConstrainedReversible, blockTrialNonDestructive, citySystemsReplayStable, refold,
} from '../../arcade/hiveworld-sim/scenarios/city-systems.mjs';

const PRIVATE_RE = /\b(player_id|playerId|balance|ledger|inventory|socket|connection|account|admin|secret|token|url|http)\b/i;
const CASH_RE = /\b(credit|credits|balance|payout|cashout|cash|wallet|price|cost|ticket|payment|profit|income)\b/i;

// ── 4C: city world log (pure) ────────────────────────────────────────────────────
test('4C cityLog: monotonic seq, FIFO-bounded, sanitized allowlist (private fields stripped)', () => {
  let log = createCityLog();
  for (let i = 0; i < CITY_LOG_MAX + 12; i++) {
    log = appendCityWorldEvent(log, { type: 'beacon', cityId: 'downtown-01', actorPublicId: 'downtown-01', payload: { reason: `r${i}`, balance: 9, playerId: 'p', nested: { x: 1 } }, tick: i });
  }
  assert.equal(log.events.length, CITY_LOG_MAX);                 // bounded FIFO
  assert.equal(log.seq, CITY_LOG_MAX + 12);                      // seq is monotonic (never resets)
  assert.deepEqual(log.events.map((e) => e.seq), log.events.map((e, i) => log.seq - CITY_LOG_MAX + 1 + i)); // contiguous tail
  const json = JSON.stringify(log.events);
  assert.equal(PRIVATE_RE.test(json), false);                   // balance/playerId/nested dropped
  assert.equal(/nested/.test(json), false);
  assert.equal(appendCityWorldEvent(log, { type: '', tick: 1 }).seq, log.seq); // malformed ignored
});

// ── 4D: pressure (pure, non-authoritative) ───────────────────────────────────────
test('4D pressure: derived, bounded 0..100, valid moods, only display fields (no authority)', () => {
  const p = derivePressure({ recentEvents: [{ type: 'city_block_trial_completed' }, { type: 'city_block_arrived' }], population: 3 });
  assert.ok(PRESSURE_MOODS.includes(p.mood));
  assert.ok(p.score >= 0 && p.score <= 100);
  assert.deepEqual(Object.keys(p).sort(), ['mood', 'population', 'score']);
  assert.equal(CASH_RE.test(JSON.stringify(p)), false);
  assert.equal(derivePressure({}).mood, 'dormant');
});

// ── 4E: host rank (pure, non-cash) ───────────────────────────────────────────────
test('4E host rank: non-cash tier/signal/score only — NO economic field', () => {
  const hr = deriveHostRank({ recentEvents: [{ type: 'city_block_trial_completed' }, { type: 'city_block_trial_completed' }], pressure: { mood: 'lively' } });
  assert.ok(HOST_TIERS.includes(hr.tier));
  assert.deepEqual(Object.keys(hr).sort(), ['score', 'score_cap', 'support_signal', 'tier']);
  assert.equal(CASH_RE.test(JSON.stringify(hr)), false);
  assert.equal(deriveHostRank({}).tier, 'observer');
});

// ── 4F: stewardship (pure, constrained + reversible + gated) ──────────────────────
test('4F stewardship: closed allowlist strips off-allowlist + free text; default is the reset target', () => {
  assert.deepEqual(sanitizeStyleOverride({ palette: 'violet', intensity: 'high', sign_variant: 'NOPE', evil: 'x', url: 'http://x' }), { palette: 'violet', intensity: 'high' });
  assert.deepEqual(sanitizeStyleOverride({ palette: 'not-a-color' }), {});      // invalid value dropped
  assert.equal(isValidStyle(mergeStyle(defaultStyle('downtown-01'), { palette: 'emerald' })), true);
  assert.equal(isValidStyle({ palette: 'rainbow', sign_variant: 'classic', intensity: 'low' }), false);
  assert.deepEqual(defaultStyle('harbor-02'), { palette: 'cyan', sign_variant: 'classic', intensity: 'medium' });
});

test('4F stewardship eligibility is conferred by host/steward host-rank only (a display right, not cash)', () => {
  assert.equal(isStewardEligible({ tier: 'host' }), true);
  assert.equal(isStewardEligible({ tier: 'steward' }), true);
  assert.equal(isStewardEligible({ tier: 'regular' }), false);
  assert.equal(isStewardEligible({ tier: 'observer' }), false);
  assert.equal(isStewardEligible(null), false);
});

// ── 4G: trial (pure, instanced + non-destructive) ─────────────────────────────────
test('4G trial: open → active → completed at the cap → closed; payload is public-safe (count only)', () => {
  let tr = createTrial('downtown-01', 'tr-1');
  assert.equal(tr.status, 'open');
  tr = addTrialPlayer(tr, 'agent:a');
  assert.equal(tr.status, 'active');
  for (let i = 0; i < TRIAL_SCORE_CAP; i++) tr = stepTrial(tr);
  assert.equal(tr.status, 'completed');
  assert.equal(tr.score, TRIAL_SCORE_CAP);
  const pay = trialPayload(tr);
  assert.equal(pay.player_count, 1);
  assert.equal(/agent:|player_id|playerId/i.test(JSON.stringify(pay)), false); // no player IDs — only a count
  assert.equal(closeTrial(tr).status, 'closed');
});

// ── coverage: 3-place registration ───────────────────────────────────────────────
test('every v1.1 city-system event rides its declared sideband and has a fold handler', () => {
  for (const t of ['city_world_event', 'city_pressure_observed', 'city_host_rank_evaluated', 'city_stewardship_applied', 'city_stewardship_reset', 'city_block_trial_opened', 'city_block_trial_joined', 'city_block_trial_stepped', 'city_block_trial_closed']) {
    assert.ok(EVENT_SPECS[t], `${t} in EVENT_SPECS`);
    assert.equal(EVENT_SPECS[t].sideband, CITY_EVENT_SIDEBAND[t], `${t} sideband`);
    assert.ok(getHandler(t), `${t} handler`);
  }
});

// ── fold behaviour via scenarios ─────────────────────────────────────────────────
test('4C fold: the world log stays bounded + sanitized under churn', () => {
  const d = cityLogAppendBounded().report.finalWorldState.district;
  assert.equal(d.cityLog.events.length, CITY_LOG_MAX);
  assert.equal(d.cityLog.seq, 60);
  assert.equal(PRIVATE_RE.test(JSON.stringify(d.cityLog.events)), false);
});

test('4D fold: pressure is derived display state — it carries no authority and no economy', () => {
  const { report } = pressureDerivesNonAuthoritative();
  const d = report.finalWorldState.district;
  const p = d.pressure['downtown-01'];
  assert.ok(p && PRESSURE_MOODS.includes(p.mood));
  assert.deepEqual(Object.keys(p).sort(), ['mood', 'population', 'score']);
  // non-authoritative: the actor's location authority is unaffected by pressure
  assert.equal(d.actorBlock['agent:a'], 'downtown-01');
  assert.equal(CASH_RE.test(JSON.stringify(p)), false);
});

test('4E fold: host rank reaches a tier and carries NO economic field', () => {
  const d = hostRankNonCash().report.finalWorldState.district;
  const hr = d.hostRank['downtown-01'];
  assert.ok(HOST_TIERS.includes(hr.tier));
  assert.equal(CASH_RE.test(JSON.stringify(hr)), false);
  assert.equal(CASH_RE.test(JSON.stringify(d.hostRank)), false);
});

test('4F fold: ineligible block rejected; eligible apply keeps only allowlist; reset is reversible', () => {
  const { report, reportAfterApply } = stewardshipConstrainedReversible();
  const dApply = reportAfterApply.finalWorldState.district;
  // ineligible harbor was rejected (no override stored)
  assert.equal(dApply.stewardship['harbor-02'], undefined);
  // eligible downtown apply kept only allowlisted fields (violet + high; sign_variant stayed default; NOPE/evil/url gone)
  const applied = dApply.stewardship['downtown-01'];
  assert.deepEqual(applied, { palette: 'violet', sign_variant: 'classic', intensity: 'high' });
  assert.ok(isValidStyle(applied));
  assert.equal(/evil|url|NOPE|http/i.test(JSON.stringify(applied)), false);
  // reset is reversible — the override is gone, so effective falls back to the default
  const dReset = report.finalWorldState.district;
  assert.equal(dReset.stewardship['downtown-01'], undefined);
  assert.ok(reportAfterApply.applyRejectionCount >= 1); // the ineligible harbor apply
});

test('4G fold: a trial is non-destructive — the public block style is byte-identical before/after', () => {
  const { report, beforeTrial } = blockTrialNonDestructive();
  const d = report.finalWorldState.district;
  assert.deepEqual(d.stewardship['downtown-01'], beforeTrial, 'block style untouched by the trial');
  assert.equal(d.trials['downtown-01'].status, 'closed');
  assert.equal(d.trials['downtown-01'].score, TRIAL_SCORE_CAP); // it completed before close
  // the public block presence summary is also untouched by the trial
  assert.equal(report.desyncReport.finalConverged, true);
});

test('city systems converge under reorder + duplicate delivery (same fingerprint)', () => {
  const { events, report } = citySystemsReplayStable();
  assert.equal(refold(events).fingerprint, refold([...events].reverse()).fingerprint);
  assert.equal(refold(events).fingerprint, refold([...events, ...events]).fingerprint);
  assert.equal(refold(events).fingerprint, report.canonicalFingerprint);
});

test('all city-systems scenarios are deterministic + converge', () => {
  for (const fn of Object.values(CITY_SYSTEMS_SCENARIOS)) {
    const a = fn(); const b = fn();
    assert.equal(a.report.canonicalFingerprint, b.report.canonicalFingerprint, fn.name);
    assert.equal(a.report.desyncReport.finalConverged, true, fn.name);
  }
});
