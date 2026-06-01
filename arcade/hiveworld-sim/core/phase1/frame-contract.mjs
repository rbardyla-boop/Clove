/**
 * Phase 1i Cabinet Frame Contract — SIMULATOR-LOCAL PORT of
 * arcade/cabinet-frame-contract.mjs (metadata + validation + clone guard only).
 *
 * The testbed does not do DOM scaling, but it tests the CONTRACT: native size,
 * aspect ratio, fit-contain scale mode, preserve-original-size clone policy, and
 * the clone guard that fails if current size drifts from original without a
 * migration flag. Pure, deterministic, zero-dependency.
 */

export const SCALE_MODES = Object.freeze(['native', 'fit-contain', 'fit-width', 'fit-height']);
export const FORBIDDEN_SCALE_MODES = Object.freeze(['stretch', 'crop', 'fill-distort', 'fill']);

const NW = 360;
const NH = 640;

function contract(gameId, displayName) {
  return Object.freeze({
    game_id: gameId, display_name: displayName,
    native_width: NW, native_height: NH, aspect_ratio: NW / NH,
    scale_mode: 'fit-contain', allow_upscale: true, max_upscale: 2, min_scale: 0.25,
    original_width: NW, original_height: NH, current_width: NW, current_height: NH,
    clone_policy: 'preserve_original_size', allow_visual_skinning: true, allow_logic_resize: false, migrated: false,
  });
}

export const FRAME_CONTRACTS = Object.freeze({
  pulse_tap: contract('pulse_tap', 'Pulse Tap'),
  signal_sprint: contract('signal_sprint', 'Signal Sprint'),
  neon_grid: contract('neon_grid', 'Neon Grid'),
});

export function getContract(gameId) {
  return FRAME_CONTRACTS[gameId] || null;
}
export function listContracts() {
  return Object.values(FRAME_CONTRACTS);
}

function isPosInt(n) { return typeof n === 'number' && Number.isInteger(n) && n > 0; }

/** Clone/import guard: current size must equal original unless migrated:true. */
export function cloneGuard(c) {
  if (!c) return { ok: false, reason: 'missing_contract' };
  if (c.clone_policy !== 'preserve_original_size') return { ok: false, reason: 'bad_clone_policy' };
  const same = c.current_width === c.original_width && c.current_height === c.original_height;
  if (!same && c.migrated !== true) return { ok: false, reason: 'size_changed_without_migration' };
  return { ok: true, reason: null };
}

export function validateContract(c) {
  const errors = [];
  if (!c || typeof c !== 'object') return { ok: false, errors: ['not_an_object'] };
  if (typeof c.game_id !== 'string' || !c.game_id) errors.push('bad_game_id');
  if (!isPosInt(c.native_width)) errors.push('native_width_not_positive_int');
  if (!isPosInt(c.native_height)) errors.push('native_height_not_positive_int');
  if (isPosInt(c.native_width) && isPosInt(c.native_height)) {
    if (Math.abs((c.aspect_ratio || 0) - c.native_width / c.native_height) > 1e-6) errors.push('aspect_ratio_mismatch');
  }
  if (FORBIDDEN_SCALE_MODES.includes(c.scale_mode)) errors.push('forbidden_scale_mode');
  else if (!SCALE_MODES.includes(c.scale_mode)) errors.push('unknown_scale_mode');
  if (!isPosInt(c.original_width) || !isPosInt(c.original_height)) errors.push('original_dims_not_positive_int');
  const guard = cloneGuard(c);
  if (!guard.ok) errors.push(guard.reason);
  return { ok: errors.length === 0, errors };
}
