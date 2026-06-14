/**
 * Creator Foundation CF-3 — Layered Block Editor logic (browser, LOCAL/no-submit).
 *
 * Composes a DATA-ONLY `block_layered` package from closed allowlists across 6 procedural layer
 * dimensions, previews it with the layered renderer, validates it locally with the SAME pure
 * validator the CLI uses, and exports the package + a local validation report. It also offers the
 * CF-2 approved local preview (import package + receipt → run the loader in local_preview). NO
 * network, NO external assets, NO live submit, NO live-world load. The hash is canonical SHA-256.
 */
import {
  TARGET_CITY_IDS, PALETTE_VARIANTS, PALETTES, ACCENTS, COLOR_SLOT_TOKENS, SIGN_VARIANTS, SIGN_PLACEMENTS,
  FACADE_PATTERNS_LAYERED, WINDOW_GRID_TYPES, WINDOW_DENSITIES, ROOF_ACCENTS, ROOF_PATTERNS,
  DECAL_TOKENS, DECAL_POSITIONS, DECAL_SCALES, LIGHTING_ZONE_IDS, LIGHTINGS,
} from '../schemas/creator-tokens.mjs';
import { PACKAGE_KIND, SCHEMA_VERSION, MAX_SYMBOLS } from '../schemas/block-layered-package-schema.mjs';
import { validateBlockLayeredPackage } from '../validator/validate-block-layered-package.mjs';
import { packageHash } from '../validator/package-hash.mjs';
import { buildValidationReport } from '../validator/validation-report.mjs';
import { drawLayeredBlock } from '../render/layered-renderer.mjs';
import { validateReceipt, APPROVED_LOCAL } from '../approval/approval-receipt.mjs';
import { createRegistry } from '../approval/approved-package-registry.mjs';
import { loadApprovedPackage, LOADER_MODES } from '../approval/approved-loader.mjs';

const $ = (id) => document.getElementById(id);
const opt = (v) => `<option value="${v}">${v}</option>`;
const fill = (id, list, sel) => { $(id).innerHTML = list.map((v) => `<option${v === sel ? ' selected' : ''}>${v}</option>`).join(''); };

// fixed selects
fill('target_city_id', TARGET_CITY_IDS, 'downtown-01');
$('palette_variant').innerHTML = `<option value="">(none)</option>` + PALETTE_VARIANTS.map(opt).join('');
$('palette_variant').value = 'neon-arcade-v1';
fill('facade_pattern', FACADE_PATTERNS_LAYERED, 'neon-mesh');
fill('facade_primary_color', PALETTES, 'neon-blue');
fill('facade_secondary_color', PALETTES, 'neon-cyan');
fill('facade_trim', ACCENTS, 'cyan-trim');
fill('windows_grid_type', WINDOW_GRID_TYPES, 'glass-bright');
fill('windows_density', WINDOW_DENSITIES, 'medium');
fill('windows_glow_color', PALETTES, 'neon-cyan');
fill('roof_accent_type', ROOF_ACCENTS, 'ridge-sharp');
fill('roof_highlight', ACCENTS, 'white-trim');
fill('roof_pattern', ROOF_PATTERNS, 'lights');
fill('sign_variant', SIGN_VARIANTS, 'blade');
fill('sign_placement', SIGN_PLACEMENTS, 'apex');
fill('sign_color', PALETTES, 'neon-magenta');

// symbol rows (up to MAX_SYMBOLS) — each emits a {token,position,color,scale} when token !== 'none'
const SYMBOL_ROW_COUNT = Math.min(4, MAX_SYMBOLS);
const symbolDefaults = [
  { token: 'decal-star-burst', position: 'upper-left', color: 'neon-amber', scale: '1.0' },
  { token: 'decal-circuit-path', position: 'center', color: 'neon-green', scale: '0.75' },
  { token: 'none', position: 'lower-right', color: 'violet-trim', scale: '1.0' },
  { token: 'none', position: 'center', color: 'white-trim', scale: '1.0' },
];
$('symbolRows').innerHTML = Array.from({ length: SYMBOL_ROW_COUNT }, (_, i) => {
  const d = symbolDefaults[i] || { token: 'none', position: 'center', color: 'mono-white', scale: '1.0' };
  const sel = (suffix, list, v) => `<select id="sym${i}_${suffix}" aria-label="symbol ${i + 1} ${suffix}">${list.map((x) => `<option${x === v ? ' selected' : ''}>${x}</option>`).join('')}</select>`;
  return `<div class="layer-row">${sel('token', DECAL_TOKENS, d.token)}${sel('position', DECAL_POSITIONS, d.position)}${sel('color', COLOR_SLOT_TOKENS, d.color)}${sel('scale', DECAL_SCALES, d.scale)}</div>`;
}).join('');

// lighting-zone rows — one per zone_id (unique by construction); enable + glow + flicker
const zoneDefaults = { 'left-face': { on: true, glow: 'high' }, 'right-face': { on: true, glow: 'medium' }, roof: { on: true, glow: 'low' }, tile: { on: false, glow: 'off' } };
$('zoneRows').innerHTML = LIGHTING_ZONE_IDS.map((z) => {
  const d = zoneDefaults[z];
  return `<div class="zone-row">
    <label class="inline"><input type="checkbox" id="zone_${z}_on"${d.on ? ' checked' : ''}><span class="zname">${z}</span></label>
    <select id="zone_${z}_glow" aria-label="${z} glow">${LIGHTINGS.map((g) => `<option${g === d.glow ? ' selected' : ''}>${g}</option>`).join('')}</select>
    <label class="inline"><input type="checkbox" id="zone_${z}_flicker"> flicker</label>
    <span></span>
  </div>`;
}).join('');

function collectSymbols() {
  const out = [];
  for (let i = 0; i < SYMBOL_ROW_COUNT; i++) {
    const token = $(`sym${i}_token`).value;
    if (token === 'none') continue;
    out.push({ token, position: $(`sym${i}_position`).value, color: $(`sym${i}_color`).value, scale: $(`sym${i}_scale`).value });
  }
  return out;
}
function collectZones() {
  const out = [];
  for (const z of LIGHTING_ZONE_IDS) {
    if ($(`zone_${z}_on`).checked) out.push({ zone_id: z, glow: $(`zone_${z}_glow`).value, flicker: $(`zone_${z}_flicker`).checked });
  }
  return out;
}

function assemble() {
  const pkg = {
    schema_version: SCHEMA_VERSION,
    package_kind: PACKAGE_KIND,
    package_id: $('package_id').value.trim(),
    target_city_id: $('target_city_id').value,
    layers: {
      facade: { pattern: $('facade_pattern').value, primary_color: $('facade_primary_color').value, secondary_color: $('facade_secondary_color').value, trim: $('facade_trim').value },
      sign: { variant: $('sign_variant').value, color: $('sign_color').value, placement: $('sign_placement').value },
      windows: { grid_type: $('windows_grid_type').value, density: $('windows_density').value, glow_color: $('windows_glow_color').value },
      roof: { accent_type: $('roof_accent_type').value, highlight: $('roof_highlight').value, pattern: $('roof_pattern').value },
      lighting_zones: collectZones(),
    },
    constraints: { no_external_assets: true, no_scripts: true, no_live_world_load: true },
  };
  const dn = $('display_name').value.trim();
  if (dn) pkg.display_name = dn;
  const pv = $('palette_variant').value;
  if (pv) pkg.palette_variant = pv;
  const symbols = collectSymbols();
  if (symbols.length) pkg.layers.symbols = symbols;
  return pkg;
}

function previewTo(canvasId, pkg) {
  const cv = $(canvasId); const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  drawLayeredBlock(ctx, pkg, { originX: cv.width / 2, originY: 168, height: 104 });
}

let last = null;
async function render() {
  const pkg = assemble();
  last = pkg;
  previewTo('preview', pkg);
  const v = validateBlockLayeredPackage(pkg);
  const hash = await packageHash(pkg);
  const report = buildValidationReport({ validation: v, packageHash: hash });

  const vEl = $('verdict');
  vEl.textContent = v.ok ? 'VALID (local)' : 'BLOCKED';
  vEl.className = `verdict ${v.ok ? 'v-ok' : 'v-bad'}`;
  const reportEl = $('report');
  reportEl.replaceChildren(); // safe DOM construction — validator text is set via textContent, never innerHTML
  const reportRow = (cls, text) => { const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = text; reportEl.appendChild(d); };
  reportRow('lim', `size ${v.limits.size_bytes} / ${v.limits.size_budget_bytes} bytes`);
  for (const e of v.errors) reportRow('err', `✗ ${e}`);
  for (const w of v.warnings) reportRow('warn', `! ${w}`);
  if (v.ok && !v.errors.length) reportRow('', '✓ all checks passed');
  $('hash').textContent = report.package_hash;
  $('receiptNote').textContent = `receipt: ${report.receipt.status} · live_world_authorized=${report.receipt.live_world_authorized}`;
  $('exportPkg').disabled = false;
  $('exportReport').disabled = false;
  $('exportReport').dataset.report = JSON.stringify(report);
}

function download(name, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('exportPkg').addEventListener('click', () => { if (last) download(`${last.package_id || 'block'}.layered.package.json`, last); });
$('exportReport').addEventListener('click', (e) => { const r = e.currentTarget.dataset.report; if (r) download(`${(last && last.package_id) || 'block'}.report.json`, JSON.parse(r)); });

$('controls').addEventListener('input', render);
$('controls').addEventListener('change', render);
render();

// ── CF-2 approved local preview (operator) ──────────────────────────────────────────────────────
const LOCAL_PREVIEW_WARNING = 'Local preview only — not authorized for live world.';
let importedPkg = null;
let importedReceipt = null;

async function readJsonFile(input) {
  const file = input.files && input.files[0];
  if (!file) return null;
  try { return JSON.parse(await file.text()); } catch { return null; }
}
function registryFromReceipt(receipt) {
  if (!receipt || receipt.approval_status !== APPROVED_LOCAL) return createRegistry([]);
  return createRegistry([{
    package_hash: receipt.package_hash, package_kind: receipt.package_kind, display_name: 'imported (local preview)',
    approval_status: receipt.approval_status, approved_at: receipt.approved_at, validator_version: receipt.validator_version, live_world_authorized: false,
  }]);
}
function setApprovedStatus(text, ok) { const el = $('approvedStatus'); el.textContent = text; el.className = `approved-status ${ok ? 'a-ok' : 'a-bad'}`; }
function setApprovedWarning(show) { const el = $('approvedWarning'); el.textContent = show ? LOCAL_PREVIEW_WARNING : ''; el.style.display = show ? 'block' : 'none'; }
function clearApprovedPreview() { const cv = $('approvedPreview'); if (cv) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); }

async function evaluateApproved() {
  setApprovedWarning(false); clearApprovedPreview(); $('approvedReceiptStatus').textContent = '';
  if (!importedPkg) { $('approvedHash').textContent = ''; setApprovedStatus('Import a package JSON to begin.', false); return; }
  const hash = await packageHash(importedPkg);
  $('approvedHash').textContent = hash;
  if (!importedReceipt) { setApprovedStatus('Package imported — import its approval receipt to preview.', false); return; }
  const rv = await validateReceipt(importedReceipt);
  $('approvedReceiptStatus').textContent = `receipt: ${rv.ok ? importedReceipt.approval_status : 'invalid'} · live_world_authorized=${importedReceipt.live_world_authorized}`;
  const result = await loadApprovedPackage({ package: importedPkg, receipt: importedReceipt, registry: registryFromReceipt(importedReceipt), mode: LOADER_MODES.LOCAL_PREVIEW });
  if (!result.ok) { setApprovedStatus(`Not loaded (${result.reason}).`, false); return; }
  if (importedPkg.package_kind === 'block_layered') previewTo('approvedPreview', importedPkg);
  setApprovedStatus(`Approved local preview loaded (${result.status}).`, true);
  setApprovedWarning(true);
}
$('importPkg').addEventListener('change', async (e) => { importedPkg = await readJsonFile(e.currentTarget); await evaluateApproved(); });
$('importReceipt').addEventListener('change', async (e) => { importedReceipt = await readJsonFile(e.currentTarget); await evaluateApproved(); });
setApprovedStatus('Import a package JSON to begin.', false);
setApprovedWarning(false);
