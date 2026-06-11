/**
 * Curated Starter Floor — the OPERATOR-CURATED manifest (production data; ADR-043).
 *
 * The single source of truth for which starter cabinets appear on the public floor.
 * Operator-authored, checked-in, STATIC: this is first-party content, not live
 * loading — it never touches the CF-7 loader (LIVE_WORLD_LOADER_ENABLED stays
 * false), creator approval receipts, or the server catalog. The server's cabinet
 * authority (occupy/round/ticket) is untouched: starters are client_local_only,
 * send no messages, and award nothing.
 *
 * Anti-drift: the per-starter game.mjs files under arcade/cabinets/starters/<id>/
 * are generated at AUTHOR TIME from the closed builder tables and BYTE-PINNED to
 * the generator by unit test — production code never imports arcade/creator/**.
 * Copy here is duplicated from the starter library on purpose (no creator import);
 * a unit test asserts it stays in sync.
 *
 * 6 starters: one landmark anchor per city block (ADR-043 selection). The two
 * downtown/central flex starters and per-block ordering are a separate, later PR.
 */
import { validateImportPath } from '../../cabinet-import-loader.mjs';
import { FORBIDDEN_CAPABILITIES, MANIFEST_VERSION } from '../../game-import-manifest.mjs';
import { STARTER_NATIVE_W, STARTER_NATIVE_H } from './starter-host.mjs';

/** Shelf header copy — static, shown BEFORE any interaction (pre-tap honesty). */
export const SHELF_TITLE = 'STARTER CORNER';
export const SHELF_SAFETY = 'session-local · no tickets';

export const GENRE_TAGS = Object.freeze(['REFLEX', 'PATTERN', 'POSITION', 'PUZZLE', 'ATMOSPHERE']);

/** Closed entry shape — anything outside this list fails validateCuratedFloor. */
export const ALLOWED_ENTRY_FIELDS = Object.freeze(['starter_id', 'game_id', 'label', 'pitch', 'genre_tag', 'home_block']);
/** Economy-shaped field names may never appear in a curated entry (defense in depth). */
export const FORBIDDEN_FIELD_RE = /prize|ticket|payout|owner|award|redeem|balance|ledger|wallet|cash|earn/i;

export const LABEL_MAX = 24;
export const PITCH_MAX = 72;

/** The first public floor set — one anchor per block. Data only; closed fields. */
export const CURATED_STARTERS = Object.freeze([
  Object.freeze({ starter_id: 'crosswalk-window', game_id: 'starter_crosswalk_window', label: 'Crosswalk Window', pitch: 'Catch the walk signal before it flips.',            genre_tag: 'ATMOSPHERE', home_block: 'downtown-01' }),
  Object.freeze({ starter_id: 'crane-gate',       game_id: 'starter_crane_gate',       label: 'Crane Gate',       pitch: 'Harborside — time the tide under the crane.',       genre_tag: 'ATMOSPHERE', home_block: 'harbor-02' }),
  Object.freeze({ starter_id: 'beacon-climb',     game_id: 'starter_beacon_climb',     label: 'Beacon Climb',     pitch: 'Ride the signal up the Beacon Crown.',              genre_tag: 'ATMOSPHERE', home_block: 'skyline-03' }),
  Object.freeze({ starter_id: 'ember-sync',       game_id: 'starter_ember_sync',       label: 'Ember Sync',       pitch: 'Foundry heat runs hot — hold the safe arc.',        genre_tag: 'ATMOSPHERE', home_block: 'foundry-04' }),
  Object.freeze({ starter_id: 'phase-lock',       game_id: 'starter_phase_lock',       label: 'Phase Lock',       pitch: 'Two rings, two satellites — lock them into one line.', genre_tag: 'PUZZLE',  home_block: 'nexus-05' }),
  Object.freeze({ starter_id: 'arbor-bloom',      game_id: 'starter_arbor_bloom',      label: 'Arbor Bloom',      pitch: 'Garden lights bloom and fade. Meet them at full bloom.', genre_tag: 'ATMOSPHERE', home_block: 'garden-06' }),
]);

/** The directory a curated entry's checked-in statics live in. */
export function starterDir(entry) {
  return `arcade/cabinets/starters/${entry.starter_id}/`;
}

/** PURE: the import-loader manifest for one curated entry (the gate re-validates it). */
export function starterManifest(entry) {
  const dir = starterDir(entry);
  return {
    manifest_version: MANIFEST_VERSION,
    game_id: entry.game_id,
    source_name: entry.label,
    source_kind: 'curated_starter_static',
    original_width: STARTER_NATIVE_W,
    original_height: STARTER_NATIVE_H,
    current_width: STARTER_NATIVE_W,
    current_height: STARTER_NATIVE_H,
    aspect_ratio: STARTER_NATIVE_W / STARTER_NATIVE_H,
    entry_file: dir + 'game.mjs',
    adapter_module: dir + 'adapter.mjs',
    styles: [],
    scripts: [dir + 'game.mjs'],
    input_methods: ['pointer'],
    authority_mode: 'client_local_only',
    ticket_mode: 'none',
    challenge_mode: 'none',
    allowed_asset_paths: [dir],
    forbidden_capabilities: [...FORBIDDEN_CAPABILITIES],
    requested_capabilities: [],
    clone_policy: 'preserve_original_size',
    migration_flag: false,
    test_selectors: { panel: '.st-panel', stage: '.st-stage', chrome: '.st-head' },
    notes: 'Operator-curated starter (ADR-043): static first-party content; client-local only; no tickets.',
  };
}

/**
 * PURE: validate the curated list before the floor renders ANY of it. Fail-quiet
 * contract: an invalid list renders an empty shelf, never a partial one.
 */
export function validateCuratedFloor(list) {
  const errors = [];
  if (!Array.isArray(list) || list.length < 1 || list.length > 8) errors.push('count_out_of_range');
  const ids = new Set();
  for (const e of (Array.isArray(list) ? list : [])) {
    const at = `entry ${e && e.starter_id}`;
    if (!e || typeof e !== 'object') { errors.push('entry_not_object'); continue; }
    for (const k of Object.keys(e)) {
      if (!ALLOWED_ENTRY_FIELDS.includes(k)) errors.push(`${at}: unknown field ${k}`);
      if (FORBIDDEN_FIELD_RE.test(k)) errors.push(`${at}: forbidden field ${k}`);
    }
    if (!/^[a-z0-9][a-z0-9-]{2,40}$/.test(String(e.starter_id))) errors.push(`${at}: bad starter_id`);
    if (!/^starter_[a-z0-9_]{3,48}$/.test(String(e.game_id))) errors.push(`${at}: bad game_id`);
    if (ids.has(e.starter_id)) errors.push(`${at}: duplicate id`); else ids.add(e.starter_id);
    if (typeof e.label !== 'string' || !e.label || e.label.length > LABEL_MAX) errors.push(`${at}: bad label`);
    if (typeof e.pitch !== 'string' || !e.pitch || e.pitch.length > PITCH_MAX) errors.push(`${at}: bad pitch`);
    if (!GENRE_TAGS.includes(e.genre_tag)) errors.push(`${at}: bad genre_tag`);
    if (typeof e.home_block !== 'string' || !/^[a-z]+-[0-9]{2}$/.test(e.home_block)) errors.push(`${at}: bad home_block`);
    const m = starterManifest(e);
    for (const p of [m.entry_file, m.adapter_module, ...m.scripts]) {
      const pv = validateImportPath(p);
      if (!pv.ok) errors.push(`${at}: bad path ${p} (${pv.reason})`);
    }
  }
  return { ok: errors.length === 0, errors };
}
