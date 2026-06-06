/**
 * Creator Foundation CF-2 — APPROVED-HASH LOADER skeleton, PURE + cross-env (Node 18.4+ / browser).
 *
 * The loader is the trust boundary between a local package and anywhere it might render. It loads a
 * package ONLY when ALL of the following hold: the recomputed canonical hash matches the accompanying
 * receipt, the package is valid data for its kind, that same hash is listed in the approved registry,
 * and both the receipt and the registry entry say `operator_approved_local`. Two modes:
 *
 *   local_preview : may load an approved-local package for an OFFLINE preview (never the live world).
 *   live_world    : ALWAYS rejected in CF-2 — there is no live loader yet (LIVE_WORLD_LOADER_ENABLED
 *                   is false), so no package can reach the live world through any code path here.
 *
 * This proves the boundary without opening the world. Deny-by-default: any failed check returns a
 * structured rejection; nothing is ever thrown into the live world.
 */
import { packageHash } from '../validator/package-hash.mjs';
import { validateBlockPackage } from '../validator/validate-block-package.mjs';
import { validateArcadePackage } from '../validator/validate-arcade-package.mjs';
import { validateReceipt } from './approval-receipt.mjs';
import { validateRegistry, resolveApprovedPackage } from './approved-package-registry.mjs';

export const LOADER_MODES = Object.freeze({ LOCAL_PREVIEW: 'local_preview', LIVE_WORLD: 'live_world' });

/**
 * CF-2 HARD BOUNDARY: the live-world loader does not exist. This is a module constant, not a runtime
 * flag — flipping it is a deliberate, separately-gated future phase. Even then the loader would
 * additionally require `live_world_authorized: true`, which CF-2's receipt/registry validators reject,
 * so the boundary is double-locked.
 */
export const LIVE_WORLD_LOADER_ENABLED = false;

function reject(reason, extra = {}) { return { ok: false, reason, ...extra }; }

function validateByKind(pkg) {
  if (!pkg || typeof pkg !== 'object') return { ok: false };
  if (pkg.package_kind === 'block_style') return validateBlockPackage(pkg);
  if (pkg.package_kind === 'arcade_game') return validateArcadePackage(pkg);
  return { ok: false };
}

/**
 * Async: attempt to load a package under an explicit mode.
 * @param {{package:object, receipt:object, registry:object, mode:string}} input
 * @returns {Promise<{ok:boolean, mode?:string, package_hash?:string, status?:string, package?:object, reason?:string, errors?:string[]}>}
 */
export async function loadApprovedPackage({ package: pkg, receipt, registry, mode } = {}) {
  // 0. mode must be known.
  if (mode !== LOADER_MODES.LOCAL_PREVIEW && mode !== LOADER_MODES.LIVE_WORLD) return reject('unknown_loader_mode');

  // 1. LIVE WORLD is closed in CF-2, unconditionally. Checked FIRST so no later logic can open it.
  if (mode === LOADER_MODES.LIVE_WORLD && !LIVE_WORLD_LOADER_ENABLED) return reject('live_world_loader_not_enabled');

  // 2. a receipt is required and must be internally valid (and live_world_authorized:false).
  if (!receipt) return reject('missing_receipt');
  const rv = await validateReceipt(receipt);
  if (!rv.ok) return reject('invalid_receipt', { errors: rv.errors });

  // 3. the recomputed canonical hash must match the receipt — rejects a modified package or a wrong receipt.
  const hash = await packageHash(pkg);
  if (hash !== receipt.package_hash) return reject('receipt_hash_mismatch', { package_hash: hash });

  // 4. the package must be valid data for its declared kind.
  const pv = validateByKind(pkg);
  if (!pv.ok) return reject('package_invalid');

  // 5. the registry must be valid and must list this hash as operator-approved-local.
  const regv = validateRegistry(registry);
  if (!regv.ok) return reject('invalid_registry', { errors: regv.errors });
  const entry = resolveApprovedPackage(registry, hash);
  if (!entry) return reject('not_approved');

  // 6. the receipt itself must say operator_approved_local (belt-and-suspenders with the registry).
  if (receipt.approval_status !== 'operator_approved_local') return reject('receipt_not_approved');

  // local_preview success — an OFFLINE preview only. live_world never reaches this line.
  // Return a defensive copy so a consumer cannot mutate the object whose hash was just verified.
  return { ok: true, mode, package_hash: hash, status: entry.approval_status, package: structuredClone(pkg) };
}
