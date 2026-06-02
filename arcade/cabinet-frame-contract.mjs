/**
 * Cabinet Game Frame Contract — PURE, runtime-agnostic (Phase 1i).
 *
 * Makes "original game size" a CONTRACT, not a preference. Every arcade game
 * declares its native logical dimensions, aspect ratio, scale mode and clone
 * policy here. The frame runtime (cabinet-frame.js) and the tests both consume
 * this module, so a cloned/imported game cannot silently change its size,
 * aspect ratio, coordinate system or input area without the contract (and the
 * tests) failing.
 *
 * No DOM / Workers APIs are used here, so the same code runs in the browser
 * frame runtime AND in Node unit tests. See
 * docs/NEON_CIRCUIT_PHASE1I_CABINET_FRAME_CONTRACT.md for scope + non-goals.
 *
 * This is a platform-hardening module only: no gameplay, no server authority,
 * no economy, no money — arcade frames and pixels only.
 */

/** Scale modes a contract may declare. */
export const SCALE_MODES = Object.freeze(['native', 'fit-contain', 'fit-width', 'fit-height']);

/** Scale modes that distort or crop the game — never allowed. */
export const FORBIDDEN_SCALE_MODES = Object.freeze(['stretch', 'crop', 'fill-distort', 'fill']);

/** Default native logical size for the current portrait cabinet games. */
const NATIVE_W = 360;
const NATIVE_H = 640;

/**
 * Game frame registry. `native_*` are the logical game dimensions the game is
 * authored against; `original_*` is the immutable source size; `current_*` must
 * equal `original_*` unless a deliberate, declared migration changes it.
 */
export const GAME_CONTRACTS = Object.freeze({
  pulse_tap: Object.freeze({
    game_id: 'pulse_tap',
    cabinet_id: 'pulse-tap-01',
    display_name: 'Pulse Tap',
    native_width: NATIVE_W,
    native_height: NATIVE_H,
    aspect_ratio: NATIVE_W / NATIVE_H,
    scale_mode: 'fit-contain',
    input_mode: 'pointer+keyboard',
    safe_area: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 }), // gameplay uses the whole native box; chrome is a panel header
    allow_upscale: true,
    max_upscale: 2,
    min_scale: 0.25,
    chrome_policy: 'modal_overlay',     // game is a modal that supersedes the floor HUD
    hud_policy: 'in_panel_header',       // the game's own stats live in its header, outside the play stage
    orientation_policy: 'any',
    test_selectors: Object.freeze({ panel: '.ptg-panel', stage: '.ptg-stage', chrome: '.ptg-head' }),
    // clone / import guard
    source_kind: 'native_neon',
    original_width: NATIVE_W,
    original_height: NATIVE_H,
    current_width: NATIVE_W,
    current_height: NATIVE_H,
    clone_policy: 'preserve_original_size',
    allow_visual_skinning: true,
    allow_logic_resize: false,
    migrated: false,
  }),
  signal_sprint: Object.freeze({
    game_id: 'signal_sprint',
    cabinet_id: 'signal-sprint-01',
    display_name: 'Signal Sprint',
    native_width: NATIVE_W,
    native_height: NATIVE_H,
    aspect_ratio: NATIVE_W / NATIVE_H,
    scale_mode: 'fit-contain',
    input_mode: 'pointer+keyboard',
    safe_area: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 }),
    allow_upscale: true,
    max_upscale: 2,
    min_scale: 0.25,
    chrome_policy: 'modal_overlay',
    hud_policy: 'in_panel_header',
    orientation_policy: 'any',
    test_selectors: Object.freeze({ panel: '.ssg-panel', stage: '.ssg-stage', chrome: '.ssg-head' }),
    source_kind: 'native_neon',
    original_width: NATIVE_W,
    original_height: NATIVE_H,
    current_width: NATIVE_W,
    current_height: NATIVE_H,
    clone_policy: 'preserve_original_size',
    allow_visual_skinning: true,
    allow_logic_resize: false,
    migrated: false,
  }),
  // Phase 1l: Neon Grid. A first-class production frame contract (so the clone
  // guard + frame tests cover it), even though the cabinet ENTERS the floor via
  // the adapter/import path — the imported adapter REFERENCES this contract rather
  // than shipping a divergent copy of the native size.
  neon_grid: Object.freeze({
    game_id: 'neon_grid',
    cabinet_id: 'neon-grid-01',
    display_name: 'Neon Grid',
    native_width: NATIVE_W,
    native_height: NATIVE_H,
    aspect_ratio: NATIVE_W / NATIVE_H,
    scale_mode: 'fit-contain',
    input_mode: 'pointer+keyboard',
    safe_area: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 }),
    allow_upscale: true,
    max_upscale: 2,
    min_scale: 0.25,
    chrome_policy: 'modal_overlay',
    hud_policy: 'in_panel_header',
    orientation_policy: 'any',
    test_selectors: Object.freeze({ panel: '.ngg-panel', stage: '.ngg-stage', chrome: '.ngg-head' }),
    source_kind: 'adapter_import',
    original_width: NATIVE_W,
    original_height: NATIVE_H,
    current_width: NATIVE_W,
    current_height: NATIVE_H,
    clone_policy: 'preserve_original_size',
    allow_visual_skinning: true,
    allow_logic_resize: false,
    migrated: false,
  }),
});

// Phase 1k: dynamically-registered contracts for imported/test games. Production
// contracts in GAME_CONTRACTS are immutable and can never be overridden here.
const _dynamicContracts = new Map(); // game_id -> contract

export function getContract(gameId) {
  return GAME_CONTRACTS[gameId] || _dynamicContracts.get(gameId) || null;
}

/**
 * Register a frame contract for an imported/test game at runtime. Validates the
 * contract and REFUSES to override any built-in production contract. Returns
 * { ok, reason }.
 */
export function registerContract(contract) {
  if (!contract || typeof contract.game_id !== 'string' || !contract.game_id) return { ok: false, reason: 'bad_contract' };
  if (GAME_CONTRACTS[contract.game_id]) return { ok: false, reason: 'cannot_override_builtin' };
  const v = validateContract(contract);
  if (!v.ok) return { ok: false, reason: 'invalid_contract', errors: v.errors };
  _dynamicContracts.set(contract.game_id, contract);
  return { ok: true, reason: null };
}

/** Test helper: drop a dynamically-registered contract (never affects built-ins). */
export function unregisterContract(gameId) {
  return _dynamicContracts.delete(gameId);
}

export function listContracts() {
  return [...Object.values(GAME_CONTRACTS), ..._dynamicContracts.values()];
}

function isPosInt(n) {
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

/**
 * Clone / import guard. A game's CURRENT size must equal its ORIGINAL size unless
 * the contract is explicitly flagged `migrated: true` (a deliberate migration
 * that must also update docs + tests). Returns { ok, reason }.
 */
export function cloneGuard(contract) {
  if (!contract) return { ok: false, reason: 'missing_contract' };
  if (contract.clone_policy !== 'preserve_original_size') return { ok: false, reason: 'bad_clone_policy' };
  const sameW = contract.current_width === contract.original_width;
  const sameH = contract.current_height === contract.original_height;
  if ((!sameW || !sameH) && contract.migrated !== true) {
    return { ok: false, reason: 'size_changed_without_migration' };
  }
  return { ok: true, reason: null };
}

/**
 * Validate a frame contract. Returns { ok, errors:[...] }. Enforces positive
 * integer dimensions, that the declared aspect ratio matches width/height, an
 * allowed (non-forbidden) scale mode, sane scale bounds, and the clone guard.
 */
export function validateContract(contract) {
  const errors = [];
  if (!contract || typeof contract !== 'object') return { ok: false, errors: ['not_an_object'] };
  if (typeof contract.game_id !== 'string' || !contract.game_id) errors.push('bad_game_id');
  if (!isPosInt(contract.native_width)) errors.push('native_width_not_positive_int');
  if (!isPosInt(contract.native_height)) errors.push('native_height_not_positive_int');
  if (isPosInt(contract.native_width) && isPosInt(contract.native_height)) {
    const expected = contract.native_width / contract.native_height;
    if (Math.abs((contract.aspect_ratio || 0) - expected) > 1e-6) errors.push('aspect_ratio_mismatch');
  }
  if (FORBIDDEN_SCALE_MODES.includes(contract.scale_mode)) errors.push('forbidden_scale_mode');
  else if (!SCALE_MODES.includes(contract.scale_mode)) errors.push('unknown_scale_mode');
  if (typeof contract.min_scale === 'number' && contract.min_scale <= 0) errors.push('min_scale_not_positive');
  if (typeof contract.max_upscale === 'number' && contract.max_upscale < 1) errors.push('max_upscale_below_one');
  if (!isPosInt(contract.original_width) || !isPosInt(contract.original_height)) errors.push('original_dims_not_positive_int');
  const guard = cloneGuard(contract);
  if (!guard.ok) errors.push(guard.reason);
  return { ok: errors.length === 0, errors };
}

/**
 * Compute uniform-scale frame geometry. PURE — given native + frame sizes and a
 * scale mode, returns the scale and the centered, letterboxed/pillarboxed
 * display box. fit-contain never crops (display fits inside the frame); it never
 * distorts (a single uniform scale is applied to both axes).
 */
export function computeFrame({ nativeWidth, nativeHeight, frameWidth, frameHeight, scaleMode = 'fit-contain', allowUpscale = true, maxUpscale = Infinity, minScale = 0 }) {
  const nW = Math.max(1, nativeWidth);
  const nH = Math.max(1, nativeHeight);
  const fW = Math.max(0, frameWidth);
  const fH = Math.max(0, frameHeight);

  let scale;
  switch (scaleMode) {
    case 'native': scale = 1; break;
    case 'fit-width': scale = fW / nW; break;
    case 'fit-height': scale = fH / nH; break;
    case 'fit-contain':
    default:
      scale = Math.min(fW / nW, fH / nH);
      break;
  }
  if (!allowUpscale) scale = Math.min(scale, 1);
  if (typeof maxUpscale === 'number') scale = Math.min(scale, maxUpscale);
  if (typeof minScale === 'number') scale = Math.max(scale, minScale);
  if (!(scale > 0)) scale = minScale > 0 ? minScale : 0; // never negative / NaN

  const displayWidth = nW * scale;
  const displayHeight = nH * scale;
  const letterboxX = Math.max(0, (fW - displayWidth) / 2); // pillarbox bars (left/right)
  const letterboxY = Math.max(0, (fH - displayHeight) / 2); // letterbox bars (top/bottom)
  return {
    scale,
    displayWidth,
    displayHeight,
    letterboxX,
    letterboxY,
    offsetX: letterboxX,
    offsetY: letterboxY,
    // true when the display fits inside the frame with no crop (fit-contain guarantee)
    fits: displayWidth <= fW + 1e-6 && displayHeight <= fH + 1e-6,
  };
}

/**
 * Map an on-screen point to native game coordinates. `left`/`top` are the
 * on-screen top-left of the (already scaled) stage box; `scale` is the applied
 * uniform scale. PURE inverse of nativeToScreen.
 */
export function screenToNative({ clientX, clientY }, { left, top, scale }) {
  const s = scale || 1;
  return { x: (clientX - left) / s, y: (clientY - top) / s };
}

/** Map a native game coordinate to an on-screen point. PURE inverse of screenToNative. */
export function nativeToScreen({ x, y }, { left, top, scale }) {
  const s = scale || 1;
  return { clientX: left + x * s, clientY: top + y * s };
}
