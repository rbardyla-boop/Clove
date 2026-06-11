/**
 * Phase W-5 — block mood unit tests (city-block-mood.mjs + city-block-mood-intake.mjs).
 * Proves: deterministic display-only derivation with EXACTLY four output keys; identity has
 * zero effect on output; the intake boundary dedups actor-bearing events 1-per-(actor,type)-
 * per-window, dedups null-actor events by event_id under the per-type clamp, drops payloads
 * and cross-block events, prunes by window; flood-safe saturation; and every one of the 18
 * copy cells passes every doctrine screen. Run: node --test tests/arcade/city-block-mood.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveBlockMood, moodBlockIds, moodCopyTable, moodCopyIsClean,
  MOOD_EVENT_TYPES, MOOD_WINDOW_MS, MOOD_PER_TYPE_CAP, MOOD_SCHEMA_VERSION,
} from '../../arcade/city/city-block-mood.mjs';
import { createMoodIntake, intakeCityEvent, moodTuples } from '../../arcade/city/city-block-mood-intake.mjs';
import { CITY_IDS, getCity } from '../../arcade/city/city-block.mjs';
import { FORBIDDEN_RE } from '../../arcade/city/city-interactions.mjs';
import { VOICE_LINE_MAX } from '../../arcade/city/city-district-flavor.mjs';

const NOW = 1_750_000_000_000;
const CITY = 'downtown-01';
const T_PORTAL = 'city_portal_enter_accepted';
const T_INTERIOR = 'city_arcade_interior_opened';
const T_TRIAL = 'city_block_trial_completed';

let seq = 0;
const ev = (over = {}) => ({
  schema_version: 5,
  event_id: `${over.city_id || CITY}:${++seq}:${over.type || T_PORTAL}`,
  seq,
  city_id: CITY,
  type: T_PORTAL,
  server_time: NOW,
  actor_public_id: null,
  payload: {},
  public_safe: true,
  ...over,
});
const feed = (events, city = CITY, now = NOW) => {
  let intake = createMoodIntake();
  for (const e of events) intake = intakeCityEvent(intake, e, city, now);
  return intake;
};
const mood = (events, city = CITY, now = NOW) => deriveBlockMood(moodTuples(feed(events, city, now)), city, now);

// ── output envelope ──────────────────────────────────────────────────────────
test('output carries EXACTLY four keys, public_safe always true (incl. empty input)', () => {
  for (const out of [mood([]), mood([ev()]), deriveBlockMood(null, 'mystery-99', NOW)]) {
    assert.deepEqual(Object.keys(out).sort(), ['atmospheric_text', 'city_id', 'public_safe', 'schema_version']);
    assert.equal(out.public_safe, true);
    assert.equal(out.schema_version, MOOD_SCHEMA_VERSION);
  }
});

test('deterministic: identical input → byte-identical output (no clock/randomness inside)', () => {
  const events = [ev(), ev({ type: T_TRIAL }), ev({ type: T_INTERIOR })];
  assert.deepEqual(JSON.stringify(mood(events)), JSON.stringify(mood(events)));
});

test('unknown/garbage input is safe: never throws, renders nothing', () => {
  assert.equal(deriveBlockMood(undefined, null, NaN).atmospheric_text, '');
  assert.equal(deriveBlockMood([{}, null, 'junk', 42], 'mystery-99', NOW).atmospheric_text, '');
  assert.equal(deriveBlockMood([ev()], '', NOW).atmospheric_text, '');
  const junkIntake = intakeCityEvent(createMoodIntake(), 'not-an-object', CITY, NOW);
  assert.deepEqual(moodTuples(junkIntake), []);
});

// ── identity: zero effect, stripped at the boundary ─────────────────────────
test('actor identity has ZERO effect on the model output (distinct actors)', () => {
  const a = mood([ev({ actor_public_id: 'guest-1' }), ev({ actor_public_id: 'guest-2' }), ev({ type: T_TRIAL })]);
  const b = mood([ev({ actor_public_id: 'guest-9' }), ev({ actor_public_id: 'guest-x' }), ev({ type: T_TRIAL })]);
  seq -= 6; // realign ids so tuples match exactly
  assert.deepEqual(a, b);
});

test('tuples leaving the intake carry NO identity and NO payload (the strip)', () => {
  const intake = feed([ev({ actor_public_id: 'guest-1', payload: { secret: 'x', balance: 999 } })]);
  const tuples = moodTuples(intake);
  assert.equal(tuples.length, 1);
  assert.deepEqual(Object.keys(tuples[0]).sort(), ['event_id', 'server_time', 'type']);
  assert.ok(!JSON.stringify(tuples).match(/actor|player|balance|secret|payload/i));
});

test('hostile extra fields are inert and the input event is never mutated', () => {
  const hostile = ev({ playerId: 'p1', balance: 100, ledger: [], inventory: {}, adminToken: 's3' });
  const snapshot = JSON.stringify(hostile);
  const out = mood([hostile]);
  assert.equal(JSON.stringify(hostile), snapshot);
  assert.ok(!JSON.stringify(out).match(/playerId|balance|ledger|inventory|adminToken/));
});

// ── intake dedup rules ───────────────────────────────────────────────────────
test('actor-bearing dedup: same (actor, type) caps at 1 per window', () => {
  const events = [1, 2, 3, 4].map(() => ev({ actor_public_id: 'guest-1' }));
  assert.equal(moodTuples(feed(events)).length, 1);
});

test('different actors / different types are NOT collapsed by the actor dedup', () => {
  const events = [
    ev({ actor_public_id: 'guest-1' }), ev({ actor_public_id: 'guest-2' }),
    ev({ actor_public_id: 'guest-1', type: T_INTERIOR }),
  ];
  assert.equal(moodTuples(feed(events)).length, 3);
});

test('null-actor events (trials) dedup by event_id only — N distinct trials admit N tuples', () => {
  const events = [1, 2, 3, 4, 5].map(() => ev({ type: T_TRIAL, actor_public_id: null }));
  assert.equal(moodTuples(feed(events)).length, 5);          // admitted: bounded later by the model clamp
});

test('duplicate event_id is a no-op (reconnect re-send self-dedup)', () => {
  const e = ev();
  let intake = createMoodIntake();
  intake = intakeCityEvent(intake, e, CITY, NOW);
  const again = intakeCityEvent(intake, e, CITY, NOW);
  assert.equal(moodTuples(again).length, 1);
});

test('cross-block events are dropped structurally', () => {
  const foreign = ev({ city_id: 'harbor-02', event_id: `harbor-02:${++seq}:${T_PORTAL}` });
  assert.equal(moodTuples(feed([foreign])).length, 0);
});

test('forged/unknown types are silently ignored', () => {
  const forged = ['block_sold', 'owner_changed', 'tickets_awarded', 'city_player_joined']
    .map((type) => ev({ type }));
  assert.equal(moodTuples(feed(forged)).length, 0);
});

test('future-stamped events are rejected at intake', () => {
  assert.equal(moodTuples(feed([ev({ server_time: NOW + 1 })])).length, 0);
});

test('seen-set and tuples prune by window: the same actor is admitted again after expiry', () => {
  let intake = createMoodIntake();
  intake = intakeCityEvent(intake, ev({ actor_public_id: 'guest-1' }), CITY, NOW);
  const later = NOW + MOOD_WINDOW_MS + 1;
  intake = intakeCityEvent(intake, ev({ actor_public_id: 'guest-1', server_time: later }), CITY, later);
  const tuples = moodTuples(intake);
  assert.equal(tuples.length, 1);                            // old tuple pruned, new one admitted
  assert.equal(tuples[0].server_time, later);
});

test('block switch = fresh intake: createMoodIntake() starts empty (clear path)', () => {
  const old = feed([ev(), ev({ type: T_TRIAL })]);
  assert.ok(moodTuples(old).length > 0);
  assert.deepEqual(moodTuples(createMoodIntake()), []);
});

// ── window math + tone behavior (tone itself is internal — assert via copy cell) ──
const cellOf = (cityId, want) => moodCopyTable()[cityId][want];

test('window math: age == WINDOW included; WINDOW+1 excluded; future excluded at derive too', () => {
  const inWin = { event_id: 'downtown-01:900:x', type: T_PORTAL, server_time: NOW - MOOD_WINDOW_MS };
  const out1 = deriveBlockMood([inWin, { ...inWin, event_id: 'downtown-01:901:x', type: T_TRIAL }], CITY, NOW);
  assert.equal(out1.atmospheric_text, cellOf(CITY, 'flow')); // 2 distinct in-window → mid tone
  const outOld = deriveBlockMood([{ ...inWin, server_time: NOW - MOOD_WINDOW_MS - 1 }], CITY, NOW);
  assert.equal(outOld.atmospheric_text, cellOf(CITY, 'ebb'));
  const outFuture = deriveBlockMood([{ ...inWin, server_time: NOW + 5 }], CITY, NOW);
  assert.equal(outFuture.atmospheric_text, cellOf(CITY, 'ebb'));
});

test('decay: a surging block re-evaluated after the window returns to baseline (non-cumulative)', () => {
  const events = [
    ev(), ev({ actor_public_id: 'guest-2' }), ev({ type: T_INTERIOR }),
    ev({ type: T_TRIAL }), ev({ type: T_TRIAL }),
  ];
  const intake = feed(events);
  assert.equal(deriveBlockMood(moodTuples(intake), CITY, NOW).atmospheric_text, cellOf(CITY, 'surge'));
  assert.equal(deriveBlockMood(moodTuples(intake), CITY, NOW + MOOD_WINDOW_MS + 1).atmospheric_text, cellOf(CITY, 'ebb'));
});

test('per-type clamp: portal flood alone saturates at the clamp and cannot reach the top tone', () => {
  const flood = Array.from({ length: 50 }, (_, i) => ({ event_id: `downtown-01:f${i}:p`, type: T_PORTAL, server_time: NOW }));
  const out = deriveBlockMood(flood, CITY, NOW);
  assert.equal(out.atmospheric_text, cellOf(CITY, 'flow'));  // min(50, CAP=3) = 3 → mid, never surge from one type
  assert.ok(MOOD_PER_TYPE_CAP < 5);
});

test('flood saturation: 500 mixed events → no throw, no extra keys, a valid table cell, ≤72 chars', () => {
  const flood = Array.from({ length: 500 }, (_, i) => ({
    event_id: `downtown-01:z${i}:m`, type: MOOD_EVENT_TYPES[i % 3], server_time: NOW,
  }));
  const out = deriveBlockMood(flood, CITY, NOW);
  assert.deepEqual(Object.keys(out).sort(), ['atmospheric_text', 'city_id', 'public_safe', 'schema_version']);
  assert.equal(out.atmospheric_text, cellOf(CITY, 'surge'));
  assert.ok(out.atmospheric_text.length <= VOICE_LINE_MAX);
});

test('immutability: mutating a returned envelope/tuple does not corrupt later calls', () => {
  const events = [ev()];
  const intake = feed(events);
  const t = moodTuples(intake); t[0].type = 'hacked';
  const out = deriveBlockMood(moodTuples(intake), CITY, NOW);
  assert.deepEqual(Object.keys(out).sort(), ['atmospheric_text', 'city_id', 'public_safe', 'schema_version']);
  const out2 = mood(events); out2.atmospheric_text = 'x';
  assert.notEqual(mood(events).atmospheric_text, 'x');
});

// ── the 18-cell copy table: every doctrine screen ────────────────────────────
const TONE_KEYS = ['ebb', 'flow', 'surge'];
// extended doctrine screens (test-local on purpose — shipped validator regexes stay untouched)
const SCREEN_QUANTITY = /\b(plenty|several|a few|many|lots|crowds?|crowded|packed|countless|counts?|busy with \w+ )\b/i;
const SCREEN_PERSON = /\byour?\b|\bplayers?\b|\bcreators?\b/i;
const SCREEN_RANK = /\b(rank|tier|level|top|best|first|last|streak|score|points?|wins?|winner|leader|beat|than|session|total|all.?time|record|high.?score|leaderboard)\b/i;
const SCREEN_TONE_WORDS = /\b(ebb|flow|surge|quiet|steady|lively|active|low|mid|high)\b/i;
const SCREEN_ECONOMY_INFLECTED = /\b(earn|reward|prize|coin|token|trade|bet|stake|sell|buy|payout|bonus|boost|multiplier|own|rent|profit|price|cost|ticket|mint|transfer|credit|debt|fee|wage|salary)(s|ed|ing|er|ers)?\b/i;
// the district browser-smoke economy guard (literal copy; sync-checked against city-block-identity.test.mjs)
const PANEL_FORBIDDEN = /\$|\bcash\b|\bpayout\b|\bbuy\b|\bsell\b|\brent\b|\bown\b|\bowner\b|\bclaim\b|\bprice\b|\bmarket\b|\bstake\b|\bprofit\b|\bincome\b|\breward\b|\btoken\b|\bunlock\b/i;

test('table structure: exactly the live 6-block roster × 3 tones, every cell present', () => {
  const table = moodCopyTable();
  assert.deepEqual(Object.keys(table).sort(), [...CITY_IDS].sort());
  for (const id of CITY_IDS) assert.deepEqual(Object.keys(table[id]).sort(), [...TONE_KEYS].sort());
});

test('every cell passes the canonical screens (FORBIDDEN_RE, length, no digits)', () => {
  for (const [id, cells] of Object.entries(moodCopyTable())) {
    for (const tone of TONE_KEYS) {
      const line = cells[tone];
      assert.ok(moodCopyIsClean(line), `${id}/${tone} clean: "${line}"`);
      assert.ok(!FORBIDDEN_RE.test(line) && !PANEL_FORBIDDEN.test(line), `${id}/${tone} vocab`);
      assert.ok(!/[0-9%]/.test(line), `${id}/${tone} no digits`);
      assert.ok(line.length <= VOICE_LINE_MAX, `${id}/${tone} length`);
    }
  }
});

test('every cell passes the extended doctrine screens (quantities, person, rank, tone words, inflected economy)', () => {
  for (const [id, cells] of Object.entries(moodCopyTable())) {
    for (const tone of TONE_KEYS) {
      const line = cells[tone];
      assert.ok(!SCREEN_QUANTITY.test(line), `${id}/${tone} prose-quantity: "${line}"`);
      assert.ok(!SCREEN_PERSON.test(line), `${id}/${tone} second-person/creator: "${line}"`);
      assert.ok(!SCREEN_RANK.test(line), `${id}/${tone} rank lexicon: "${line}"`);
      assert.ok(!SCREEN_TONE_WORDS.test(line), `${id}/${tone} tone/host-rank word: "${line}"`);
      assert.ok(!SCREEN_ECONOMY_INFLECTED.test(line), `${id}/${tone} inflected economy: "${line}"`);
    }
  }
});

test('no cell mentions another block (no cross-block comparison in copy)', () => {
  const names = Object.fromEntries(CITY_IDS.map((id) => [id, getCity(id).display_name.replace(/\s+Block$/, '')]));
  for (const [id, cells] of Object.entries(moodCopyTable())) {
    for (const tone of TONE_KEYS) {
      for (const [otherId, otherName] of Object.entries(names)) {
        if (otherId === id) continue;
        assert.ok(!cells[tone].includes(otherName), `${id}/${tone} mentions ${otherName}`);
      }
    }
  }
});

test('forbidden-name walk: no key anywhere in envelope or table matches value/identity vocabulary', () => {
  const FORBIDDEN_KEYS = /balance|transfer|payout|wallet|account|owner|creator|receivable|claim|reward|earn|revenue|share|royalty|marketplace|nft|kyc|score|rank|tier|level|points|streak|total|amount|player|actor|session|ledger|inventory/i;
  const walk = (v, path = '') => {
    if (!v || typeof v !== 'object') return;
    for (const [k, sub] of Object.entries(v)) {
      assert.ok(!FORBIDDEN_KEYS.test(k), `forbidden key "${k}" at ${path}`);
      walk(sub, path + '.' + k);
    }
  };
  walk(mood([ev()]));
  walk(moodCopyTable());
  walk(feed([ev({ actor_public_id: 'guest-1' })]).tuples, 'intake.tuples'); // tuples only — seen-set is the documented transient
});

test('tone taxonomy is never rendered: no output key or cell text leaks the internal enum', () => {
  const out = mood([ev(), ev({ type: T_TRIAL })]);
  assert.ok(!('tone' in out));
  for (const [, cells] of Object.entries(moodCopyTable())) {
    for (const tone of TONE_KEYS) assert.ok(!SCREEN_TONE_WORDS.test(cells[tone]));
  }
});

test('PANEL_FORBIDDEN literal stays in sync with the identity-test guard (copy-plus-sync pattern)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('./city-block-identity.test.mjs', import.meta.url), 'utf8');
  assert.ok(src.includes(PANEL_FORBIDDEN.source), 'identity test still carries the same guard literal');
});
