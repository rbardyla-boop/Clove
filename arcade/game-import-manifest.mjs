/**
 * Game Import Manifest schema — PURE, runtime-agnostic (Phase 1j).
 *
 * Every cloned/imported arcade game ships a manifest that is validated BEFORE it
 * can become an adapter. The manifest pins the original/native size (so a clone
 * cannot silently resize — see Phase 1i clone guard), declares its authority and
 * capability modes, and must NOT request any forbidden capability (payments,
 * external network, real-money/transfer mechanics, global auth, DOM escape).
 *
 * Imported games must live under arcade/cabinets/<game_id>/ and must never touch
 * game/* . No DOM here — Node tests validate the schema directly.
 */
import { AUTHORITY_MODES, TICKET_MODES, CHALLENGE_MODES } from './cabinet-adapter-sdk.mjs';

export const MANIFEST_VERSION = 1;

/** Capabilities an imported game may NEVER enable. Used only to REJECT imports. */
export const FORBIDDEN_CAPABILITIES = Object.freeze([
  'external_payments',
  'external_network',     // unless explicitly approved (see allowExternalNetwork)
  'real_money',
  'transfer',
  'resale',
  'dom_escape',
  'global_auth',
  'crypto_wallet',
]);

/** Imported games must live under one of these arcade-local roots. */
export const ALLOWED_ENTRY_ROOTS = Object.freeze(['arcade/cabinets/']);
const ALLOWED_SCRIPT_EXT = Object.freeze(['.js', '.mjs']);
const ALLOWED_STYLE_EXT = Object.freeze(['.css']);

function isPosInt(n) { return typeof n === 'number' && Number.isInteger(n) && n > 0; }
function underAllowedRoot(p) {
  return typeof p === 'string' && ALLOWED_ENTRY_ROOTS.some((r) => p.startsWith(r)) && !p.includes('..') && !/(^|\/)game\//.test(p);
}

/**
 * Validate an import manifest. Returns { ok, errors }. `opts.approvedExternalNetwork`
 * may be set true to explicitly allow the (otherwise forbidden) external_network
 * capability for a vetted import.
 */
export function validateManifest(manifest, opts = {}) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['not_an_object'] };

  if (manifest.manifest_version !== MANIFEST_VERSION) errors.push('bad_manifest_version');
  for (const f of ['game_id', 'source_name', 'source_kind', 'entry_file']) {
    if (typeof manifest[f] !== 'string' || !manifest[f]) errors.push(`bad_${f}`);
  }

  // dimensions + clone guard
  if (!isPosInt(manifest.original_width) || !isPosInt(manifest.original_height)) errors.push('original_dims_not_positive_int');
  if (!isPosInt(manifest.current_width) || !isPosInt(manifest.current_height)) errors.push('current_dims_not_positive_int');
  const sameSize = manifest.current_width === manifest.original_width && manifest.current_height === manifest.original_height;
  if (!sameSize && manifest.migration_flag !== true) errors.push('size_changed_without_migration');
  if (isPosInt(manifest.current_width) && isPosInt(manifest.current_height)) {
    const expected = manifest.current_width / manifest.current_height;
    if (Math.abs((manifest.aspect_ratio || 0) - expected) > 1e-6) errors.push('aspect_ratio_mismatch');
  }

  // modes
  if (!AUTHORITY_MODES.includes(manifest.authority_mode)) errors.push('bad_authority_mode');
  if (!TICKET_MODES.includes(manifest.ticket_mode)) errors.push('bad_ticket_mode');
  if (!CHALLENGE_MODES.includes(manifest.challenge_mode)) errors.push('bad_challenge_mode');

  // entry path + assets must be arcade-local
  if (!underAllowedRoot(manifest.entry_file)) errors.push('entry_file_outside_allowed_root');
  for (const s of (Array.isArray(manifest.scripts) ? manifest.scripts : [])) {
    if (!underAllowedRoot(s) || !ALLOWED_SCRIPT_EXT.some((e) => s.endsWith(e))) errors.push(`unsupported_script:${s}`);
  }
  for (const s of (Array.isArray(manifest.styles) ? manifest.styles : [])) {
    if (!underAllowedRoot(s) || !ALLOWED_STYLE_EXT.some((e) => s.endsWith(e))) errors.push(`unsupported_style:${s}`);
  }
  for (const p of (Array.isArray(manifest.allowed_asset_paths) ? manifest.allowed_asset_paths : [])) {
    if (!underAllowedRoot(p)) errors.push(`asset_outside_allowed_root:${p}`);
  }

  // forbidden capabilities must not be REQUESTED (declaring them in forbidden list is fine)
  const requested = Array.isArray(manifest.requested_capabilities) ? manifest.requested_capabilities : [];
  for (const cap of requested) {
    if (cap === 'external_network' && opts.approvedExternalNetwork === true) continue;
    if (FORBIDDEN_CAPABILITIES.includes(cap)) errors.push(`forbidden_capability:${cap}`);
  }
  // the manifest must explicitly enumerate the forbidden capabilities it bars
  if (!Array.isArray(manifest.forbidden_capabilities)) errors.push('missing_forbidden_capabilities');

  if (manifest.clone_policy !== 'preserve_original_size') errors.push('bad_clone_policy');

  return { ok: errors.length === 0, errors };
}
