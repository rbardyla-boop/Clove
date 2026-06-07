/**
 * Neon Circuit — District VOICE flavor (Phase 8C-3), PURE + client-only.
 *
 * DISPLAY-ONLY per-block "voice": short, static, atmospheric copy that makes the district read as a living
 * place through surfaces the player already sees — the district event card and the activity board. It is
 * a CLIENT-SIDE OVERLAY: it does NOT change the server-authored event label/summary (city-district-events
 * .mjs is Worker-bundled and stays byte-identical), adds NO wire field, owns NO state, and grants NOTHING
 * economic. Garden and Nexus get corridor-specific tone so the new path has its own character.
 *
 * Every string is static and screened against the canonical FORBIDDEN_RE (economy/ownership/gambling/
 * reward vocabulary) — see the unit tests. Mood/wayfinding copy only ("calm", "the crossing runs hot");
 * never a buff, bonus, toll, or reward. Falls back to '' (renders nothing) for an unknown block/type.
 *
 * Imported by the browser scene (arcade/city/city-scene.js) + tests. See
 * docs/PHASE_8C_DISTRICT_CONTENT_DEPTH.md §2.
 */
import { FORBIDDEN_RE } from './city-interactions.mjs';

/** Bound for a single voice line (keeps the event card / activity board readable on a 360px phone). */
export const VOICE_LINE_MAX = 72;

/**
 * A short STANDING tone per block (the activity board's local voice — "you are reading <block>'s board").
 */
const BLOCK_VOICE = Object.freeze({
  'downtown-01': 'Downtown hums — every route starts here.',
  'harbor-02':   'Harbor is calm dockside — the waterfront leg.',
  'skyline-03':  'Skyline sits high and bright — both ways meet here.',
  'foundry-04':  'Foundry runs hot — the freight works.',
  'nexus-05':    'Nexus pulses — the crossing between corridors.',
  'garden-06':   'Garden keeps it calm — the green on-ramp.',
});

/**
 * Per-block, per-event-type VOICE for the district event card. `_` is the block's default; a type key
 * overrides it when that event type has a more specific tone for the block. The 5 event types are the
 * frozen set in city-district-events.mjs (district_signal_surge / _quiet_window / _route_warmup /
 * _arcade_hour / _block_focus).
 */
const EVENT_VOICE = Object.freeze({
  'downtown-01': Object.freeze({ _: 'Downtown is lively — the crossroads is busy.', district_block_focus: 'Downtown holds the focus — every route departs here.' }),
  'harbor-02':   Object.freeze({ _: 'Harbor stirs along the dockside.', district_route_warmup: 'Routes into Harbor are warming — the waterfront leg opens.' }),
  'skyline-03':  Object.freeze({ _: 'Skyline glows up high.', district_block_focus: 'Skyline holds the focus — where both corridors meet.' }),
  'foundry-04':  Object.freeze({ _: 'Foundry glows amber and busy.', district_signal_surge: 'Foundry surges — the forge works are loud this window.' }),
  'nexus-05':    Object.freeze({ _: 'Nexus crackles at the crossing.', district_signal_surge: 'Nexus surges — the pulse pivot is busy this window.', district_block_focus: 'Nexus holds the focus — the new corridor pivots here.' }),
  'garden-06':   Object.freeze({ _: 'Garden keeps a slow, green calm.', district_quiet_window: 'Garden hushes — a slow lap of the green suits this window.', district_block_focus: 'Garden holds the focus — the calm way across is lit.' }),
});

/** PURE: the standing activity-board voice for a block (fresh string). Unknown block → ''. */
export function blockVoice(cityId) {
  return (typeof cityId === 'string' && BLOCK_VOICE[cityId]) || '';
}

/** PURE: the event-card voice line for a focus block + event type. Type-specific override → block default → ''. */
export function eventVoiceLine(cityId, eventType) {
  const m = (typeof cityId === 'string' && EVENT_VOICE[cityId]) || null;
  if (!m) return '';
  return (typeof eventType === 'string' && m[eventType]) || m._ || '';
}

/** The block ids that carry voice copy (a fresh array). */
export function voiceBlockIds() {
  return Object.keys(BLOCK_VOICE);
}

/** PURE: true iff a voice string is non-empty, within bound, and clean of forbidden vocabulary. */
export function voiceIsClean(str) {
  return typeof str === 'string' && str.length > 0 && str.length <= VOICE_LINE_MAX && !FORBIDDEN_RE.test(str);
}
