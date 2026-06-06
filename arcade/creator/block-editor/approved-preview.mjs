/**
 * Creator Foundation CF-2 — approved LOCAL-PREVIEW wiring for the block editor (browser, no-submit).
 *
 * Lets the operator IMPORT a package JSON + its approval receipt JSON, recompute the canonical hash,
 * and — only if the receipt binds to that hash and says operator_approved_local — render an OFFLINE
 * approved preview. It runs the SAME approved-loader the (future) world loader will, in local_preview
 * mode, against an ephemeral local registry derived from the receipt. There is NO submit, NO upload
 * to a server, and NO live-world path: live_world mode is structurally closed
 * (LIVE_WORLD_LOADER_ENABLED = false). The page never writes to the live world.
 */
import { packageHash } from '../validator/package-hash.mjs';
import { validateReceipt, APPROVED_LOCAL } from '../approval/approval-receipt.mjs';
import { createRegistry } from '../approval/approved-package-registry.mjs';
import { loadApprovedPackage, LOADER_MODES } from '../approval/approved-loader.mjs';
import { drawBlock } from '../render/iso-renderer.mjs';

/** The single warning shown over every approved local preview. */
export const LOCAL_PREVIEW_WARNING = 'Local preview only — not authorized for live world.';

const $ = (id) => document.getElementById(id);
let importedPkg = null;
let importedReceipt = null;

async function readJsonFile(input) {
  const file = input.files && input.files[0];
  if (!file) return null;
  try { return JSON.parse(await file.text()); } catch { return null; }
}

/** Build the ephemeral LOCAL registry that vouches for this receipt's hash (preview only, never live). */
function registryFromReceipt(receipt) {
  if (!receipt || receipt.approval_status !== APPROVED_LOCAL) return createRegistry([]);
  return createRegistry([{
    package_hash: receipt.package_hash,
    package_kind: receipt.package_kind,
    display_name: 'imported (local preview)',
    approval_status: receipt.approval_status,
    approved_at: receipt.approved_at,
    validator_version: receipt.validator_version,
    live_world_authorized: false,
  }]);
}

function setStatus(text, ok) {
  const el = $('approvedStatus');
  el.textContent = text;
  el.className = `approved-status ${ok ? 'a-ok' : 'a-bad'}`;
}
function setWarning(show) {
  const el = $('approvedWarning');
  el.textContent = show ? LOCAL_PREVIEW_WARNING : '';
  el.style.display = show ? 'block' : 'none';
}
function clearPreview() {
  const cv = $('approvedPreview');
  if (cv) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
}

async function evaluate() {
  setWarning(false);
  clearPreview();
  $('approvedReceiptStatus').textContent = '';

  if (!importedPkg) { $('approvedHash').textContent = ''; setStatus('Import a package JSON to begin.', false); return; }

  const hash = await packageHash(importedPkg);
  $('approvedHash').textContent = hash;

  if (!importedReceipt) { setStatus('Package imported — import its approval receipt to preview.', false); return; }

  const rv = await validateReceipt(importedReceipt);
  $('approvedReceiptStatus').textContent =
    `receipt: ${rv.ok ? importedReceipt.approval_status : 'invalid'} · live_world_authorized=${importedReceipt.live_world_authorized}`;

  const result = await loadApprovedPackage({
    package: importedPkg,
    receipt: importedReceipt,
    registry: registryFromReceipt(importedReceipt),
    mode: LOADER_MODES.LOCAL_PREVIEW,
  });

  if (!result.ok) { setStatus(`Not loaded (${result.reason}).`, false); return; }

  if (importedPkg.package_kind === 'block_style') {
    const cv = $('approvedPreview');
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    drawBlock(ctx, importedPkg.style, { originX: cv.width / 2, originY: 150, height: 92 });
  }
  setStatus(`Approved local preview loaded (${result.status}).`, true);
  setWarning(true);
}

$('importPkg').addEventListener('change', async (e) => { importedPkg = await readJsonFile(e.currentTarget); await evaluate(); });
$('importReceipt').addEventListener('change', async (e) => { importedReceipt = await readJsonFile(e.currentTarget); await evaluate(); });

setStatus('Import a package JSON to begin.', false);
setWarning(false);
