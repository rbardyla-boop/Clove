/**
 * Phase W-5 — BLOCK MOOD (display-only atmospheric line), PURE + cross-env.
 *
 * ONE atmospheric prose line about the CURRENT block — the block's collective "weather",
 * derived from recent, already-public, server-emitted city events. A CLIENT-SIDE OVERLAY in
 * the 8C flavor class: it adds NO wire field, owns NO canonical state, and grants NOTHING
 * economic. SESSION-LOCAL, NON-REWARD — display-only; resets on reload; never written to a
 * DO/account/ledger. Grants nothing. (Conventions carried verbatim from city-district-flavor
 * and the Phase 8C District Tour.)
 *
 * What this is NOT (binding, per ADR-042): not a score/rank/tier/count/meter; not per-player
 * (ADR-009 attribution deferral intact); not comparative (current block only — never the world
 * map, never discovery); not earned; not persistent; not a "this session" history claim (the
 * server event log is a rolling 50-event window re-sent on reconnect, so copy says "right
 * now"). The internal tone taxonomy is NEVER rendered, and no numeral ever appears in copy.
 *
 * This module receives ONLY anonymous tuples { event_id, type, server_time } — identity is
 * handled (deduped, then stripped) one file over in city-block-mood-intake.mjs and never
 * reaches this model: actor values cannot affect output by construction. NOTE: "mood" here
 * shares NO semantics with the W-4 agent-ledger 'recognition' memo token and may never
 * consume agent-ledger output (that module stays simulator-only).
 */

import { FORBIDDEN_RE } from './city-interactions.mjs';   // canonical player-facing vocab guard (reused, never forked)
import { CITY_IDS } from './city-block.mjs';              // live block roster (table must cover it exactly)
import { VOICE_LINE_MAX } from './city-district-flavor.mjs'; // canonical 72-char flavor bound

export const MOOD_SCHEMA_VERSION = 1;
/** Sliding evaluation window (ms). Matches the shipped 60s host-rank/AE-4 decay precedent. */
export const MOOD_WINDOW_MS = 60_000;
/** Per-type distinct-event clamp — saturation, not accumulation (part of the AE-8 answer). */
export const MOOD_PER_TYPE_CAP = 3;
/** The ONLY event types that may feed the mood (closed; all three are server-emitted). */
export const MOOD_EVENT_TYPES = Object.freeze([
  'city_portal_enter_accepted',
  'city_arcade_interior_opened',
  'city_block_trial_completed',
]);

/** INTERNAL tone taxonomy — never rendered, never exported into copy or output. */
const TONES = Object.freeze(['ebb', 'flow', 'surge']);
const TONE_THRESHOLDS = Object.freeze({ flow: 2, surge: 5 }); // 0-1 ebb · 2-4 flow · >=5 surge (uniform weights + clamp)

/**
 * The frozen 6×3 copy table — six blocks × three internal tones, nothing more. Authoring
 * rules (all mechanically screened in tests): block-name lead, present tense, place/crew as
 * subject, <=60 chars authored (hard cap VOICE_LINE_MAX=72), no numerals, no prose
 * quantities, no second person, no tone/host-rank vocabulary, no other block's name, ebb
 * cells neutral/positive — never deficit-framed.
 */
const MOOD_COPY = Object.freeze({
  'downtown-01': Object.freeze({
    ebb: 'Downtown idles easy — a soft lull at the crossroads.',
    flow: 'Downtown keeps a gentle hum at the crossroads.',
    surge: "Downtown's crossroads is alive with motion right now.",
  }),
  'harbor-02': Object.freeze({
    ebb: 'Harbor rests — slow water, slow boards.',
    flow: 'Harbor moves at an easy dockside rhythm right now.',
    surge: "Harbor's dockside hums with comings and goings.",
  }),
  'skyline-03': Object.freeze({
    ebb: 'Skyline sits calm above the city — clear, still air.',
    flow: 'Skyline carries a mild hum up on the heights.',
    surge: 'Skyline glows with motion up on the heights right now.',
  }),
  'foundry-04': Object.freeze({
    ebb: 'Foundry cools between pours — a slow spell at the works.',
    flow: 'Foundry ticks along at the works right now.',
    surge: "Foundry's floor is loud with the crew right now.",
  }),
  'nexus-05': Object.freeze({
    ebb: 'Nexus waits between corridors — a calm crossing.',
    flow: 'Nexus hums softly where the corridors meet.',
    surge: 'Nexus is humming — the crossing is in full swing right now.',
  }),
  'garden-06': Object.freeze({
    ebb: 'Garden keeps a soft hush — room for a slow lap.',
    flow: "Garden's paths see a gentle back-and-forth right now.",
    surge: "Garden's paths are well walked — the green is alive.",
  }),
});

/** PURE: block ids carrying mood copy (fresh array, for tests/tools). */
export function moodBlockIds() {
  return Object.keys(MOOD_COPY);
}

/** PURE: the full copy table as fresh data (tests screen every cell through every guard). */
export function moodCopyTable() {
  const out = {};
  for (const [id, cells] of Object.entries(MOOD_COPY)) out[id] = { ...cells };
  return out;
}

/** PURE: module-level copy hygiene — nonempty, within the canonical flavor bound, clean of
 * the canonical forbidden vocabulary, and never carrying a numeral. (Extended doctrine
 * screens — prose quantities, tone words, rank lexicon — live in the unit tests.) */
export function moodCopyIsClean(line) {
  return typeof line === 'string' && line.length > 0 && line.length <= VOICE_LINE_MAX
    && !FORBIDDEN_RE.test(line) && !/[0-9%]/.test(line);
}

const isTuple = (t) => t && typeof t === 'object'
  && typeof t.event_id === 'string' && t.event_id.length > 0
  && MOOD_EVENT_TYPES.includes(t.type)
  && Number.isFinite(t.server_time);

/** INTERNAL: clamped, deduplicated per-type activity within the window → tone. */
function toneFor(tuples, now) {
  const seenIds = new Set();
  const perType = {};
  for (const t of Array.isArray(tuples) ? tuples : []) {
    if (!isTuple(t) || seenIds.has(t.event_id)) continue;
    const age = now - t.server_time;
    if (age < 0 || age > MOOD_WINDOW_MS) continue;       // future-stamped or aged-out → excluded (inclusive at exactly the window)
    seenIds.add(t.event_id);
    perType[t.type] = (perType[t.type] || 0) + 1;
  }
  let sum = 0;
  for (const type of MOOD_EVENT_TYPES) sum += Math.min(perType[type] || 0, MOOD_PER_TYPE_CAP);
  if (sum >= TONE_THRESHOLDS.surge) return TONES[2];
  if (sum >= TONE_THRESHOLDS.flow) return TONES[1];
  return TONES[0];
}

/**
 * PURE: derive the block-mood envelope from anonymous tuples. Output carries EXACTLY four
 * keys and nothing else; unknown/empty/invalid input yields atmospheric_text '' (the panel
 * renders nothing) — never throws. Identity cannot influence this function: it never sees any.
 */
export function deriveBlockMood(tuples, cityId, now = 0) {
  const id = typeof cityId === 'string' ? cityId : '';
  const cells = MOOD_COPY[id];
  const text = cells && Number.isFinite(now) ? cells[toneFor(tuples, now)] : '';
  return {
    schema_version: MOOD_SCHEMA_VERSION,
    city_id: id,
    atmospheric_text: typeof text === 'string' ? text : '',
    public_safe: true,
  };
}

// roster sanity: every live block must have a full cell set (loud failure in tests, not here)
export const MOOD_COVERS_ROSTER = Object.freeze(CITY_IDS.map((id) => [id, !!MOOD_COPY[id]]));
