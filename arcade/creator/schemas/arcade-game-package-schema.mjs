/**
 * Creator Foundation CF-1 — Arcade Game Package SCHEMA, PURE + cross-env.
 *
 * Describes a tiny arcade cabinet package: a manifest pointing at a game module + adapter that
 * run inside the existing sandboxed cabinet frame (arcade/cabinet-frame-contract.mjs). The package
 * declares a STRICT size budget (the creative constraint — small games force optimization, not
 * bloat) and capabilities are DENY-BY-DEFAULT. The live runtime never trusts the game: ticket
 * results / score acceptance / anti-cheat / cabinet state stay server-authoritative (CF-1 changes
 * none of that — it only defines + validates the package and a size gate).
 */

export const PACKAGE_KIND = 'arcade_game';
export const SCHEMA_VERSION = 1;

/** Hard ceiling for any declared size budget (defense against bloat); a package may declare less. */
export const SIZE_BUDGET_MAX_BYTES = 65536;     // 64 KiB hard ceiling for a CF-1 cabinet
export const SIZE_BUDGET_MIN_BYTES = 1024;

export const PACKAGE_ID_RE = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;
export const DISPLAY_NAME_MAX = 40;
/** Safe relative module filename: no path traversal, no URL, ends .mjs. */
export const MODULE_FILE_RE = /^[a-z0-9](?:[a-z0-9._-]{0,46}[a-z0-9])\.mjs$/i;

/** Approved frame contracts (cabinet boxes) — reuse the production portrait box first. */
export const FRAME_CONTRACTS = Object.freeze(['cabinet-360x640', 'cabinet-640x360', 'cabinet-480x480']);

/**
 * Capabilities a package may REQUEST. CF-1 is deny-by-default: the allowlist is EMPTY, so any
 * non-empty `capabilities` array fails. (Future, explicitly-reviewed input/render capabilities are
 * added here — never network, storage, payments, auth, transfer, or DOM-escape.)
 */
export const ALLOWED_CAPABILITIES = Object.freeze([]);

export const ALLOWED_TOP_KEYS = Object.freeze([
  'schema_version', 'package_kind', 'package_id', 'display_name',
  'frame_contract_id', 'entry', 'adapter', 'assets', 'capabilities', 'size_budget_bytes',
]);
export const REQUIRED_TOP_KEYS = Object.freeze([
  'schema_version', 'package_kind', 'package_id',
  'frame_contract_id', 'entry', 'adapter', 'assets', 'capabilities', 'size_budget_bytes',
]);
