/**
 * Creator Foundation CF-1 — Local Block Editor logic (browser, LOCAL/no-submit).
 *
 * Composes a DATA-ONLY block_style package from closed allowlists, previews it with the procedural
 * isometric renderer, validates it with the SAME pure validator the CLI uses, and exports the
 * package + a local validation report. NO network, NO external assets, NO live submit. The hash is
 * canonical SHA-256 (Web Crypto) — identical to the CLI.
 */
import { PALETTES, ACCENTS, FACADE_PATTERNS, SIGN_VARIANTS, LIGHTINGS, TILE_ACCENTS, TARGET_CITY_IDS } from '../schemas/creator-tokens.mjs';
import { PACKAGE_KIND, SCHEMA_VERSION } from '../schemas/block-package-schema.mjs';
import { validateBlockPackage } from '../validator/validate-block-package.mjs';
import { packageHash } from '../validator/package-hash.mjs';
import { buildValidationReport } from '../validator/validation-report.mjs';
import { drawBlock } from '../render/iso-renderer.mjs';

const $ = (id) => document.getElementById(id);
const fill = (id, list, sel) => { $(id).innerHTML = list.map((v) => `<option${v === sel ? ' selected' : ''}>${v}</option>`).join(''); };

fill('target_city_id', TARGET_CITY_IDS, 'harbor-02');
fill('palette', PALETTES, 'neon-cyan');
fill('accent', ACCENTS, 'white-trim');
fill('facade_pattern', FACADE_PATTERNS, 'grid-window-tall');
fill('sign_variant', SIGN_VARIANTS, 'blade');
fill('lighting', LIGHTINGS, 'high');
fill('tile_accent', TILE_ACCENTS, 'circuit');

function assemble() {
  const display = $('display_name').value.trim();
  const pkg = {
    schema_version: SCHEMA_VERSION,
    package_kind: PACKAGE_KIND,
    package_id: $('package_id').value.trim(),
    target_city_id: $('target_city_id').value,
    style: {
      palette: $('palette').value,
      facade_pattern: $('facade_pattern').value,
      sign_variant: $('sign_variant').value,
      lighting: $('lighting').value,
      accent: $('accent').value,
      tile_accent: $('tile_accent').value,
    },
    constraints: { no_external_assets: true, no_scripts: true },
  };
  if (display) pkg.display_name = display;
  return pkg;
}

function preview(style) {
  const cv = $('preview'); const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  drawBlock(ctx, style, { originX: cv.width / 2, originY: 150, height: 92 });
}

let last = null;
async function render() {
  const pkg = assemble();
  last = pkg;
  preview(pkg.style);
  const v = validateBlockPackage(pkg);
  const hash = await packageHash(pkg);
  const report = buildValidationReport({ validation: v, packageHash: hash });

  const vEl = $('verdict');
  vEl.textContent = v.ok ? 'VALID (local)' : 'BLOCKED';
  vEl.className = `verdict ${v.ok ? 'v-ok' : 'v-bad'}`;
  const lines = [];
  lines.push(`<div class="lim">size ${v.limits.size_bytes} / ${v.limits.size_budget_bytes} bytes</div>`);
  for (const e of v.errors) lines.push(`<div class="err">✗ ${e}</div>`);
  for (const w of v.warnings) lines.push(`<div class="warn">! ${w}</div>`);
  if (v.ok && !v.errors.length) lines.push('<div>✓ all checks passed</div>');
  $('report').innerHTML = lines.join('');
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

$('exportPkg').addEventListener('click', () => { if (last) download(`${last.package_id || 'block'}.block.package.json`, last); });
$('exportReport').addEventListener('click', (e) => { const r = e.currentTarget.dataset.report; if (r) download(`${(last && last.package_id) || 'block'}.report.json`, JSON.parse(r)); });

for (const el of document.querySelectorAll('select,input')) el.addEventListener('input', render);
render();
