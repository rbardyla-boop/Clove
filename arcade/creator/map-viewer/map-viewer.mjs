/**
 * Creator Foundation CF-5 — LOCAL tiled-isometric map viewer (trusted, offline).
 *
 * Loads an asset-pack + a CF-2 approved registry + a local package store, validates the pack
 * (approved-hash-only), resolves the approved package bodies (hash-verified), and renders the
 * composition on an iso grid using the EXISTING block renderers (drawBlock / drawLayeredBlock).
 *
 * DATA-ONLY: it renders approved package DATA — it never executes package code, never loads anything
 * into the live world, has no submit/upload/live control, and references packages BY APPROVED HASH ONLY
 * (a tile pointing at an unapproved hash is BLOCKED). Local creator tooling; excluded from production.
 */
import { validateAssetPack, resolveAssetPack } from '../validator/validate-asset-pack.mjs';
import { packageHash } from '../validator/package-hash.mjs';
import { worldToScreen } from '../render/iso-renderer.mjs';
import { drawBlock } from '../render/iso-renderer.mjs';
import { drawLayeredBlock } from '../render/layered-renderer.mjs';

const SAMPLE_DIR = '../samples/';

const state = { lastReport: null, tilesRendered: 0 };
const el = (id) => document.getElementById(id);
function setStatus(text, cls) { const s = el('mapStatus'); if (s) { s.textContent = text; s.className = 'mv-status ' + (cls || ''); } }

function clearCanvas(ctx, w, h) { ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, w, h); }

/** Render the resolved tiles on an iso grid. Returns the count drawn. */
function renderTiles(tiles) {
  const canvas = el('mapCanvas');
  const ctx = canvas.getContext('2d');
  clearCanvas(ctx, canvas.width, canvas.height);
  const baseX = canvas.width / 2;
  const baseY = 70;
  let drawn = 0;
  // back-to-front by (gx+gy) so nearer tiles overlap correctly
  const ordered = [...tiles].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
  for (const t of ordered) {
    const p = worldToScreen(t.gx, t.gy, { originX: baseX, originY: baseY }); // returns { sx, sy }
    const opts = { originX: p.sx, originY: p.sy };
    try {
      if (t.package_kind === 'block_style') drawBlock(ctx, t.package.style, opts);
      else if (t.package_kind === 'block_layered') drawLayeredBlock(ctx, t.package, opts);
      drawn++;
    } catch { /* a renderer error on one tile does not abort the rest */ }
  }
  return drawn;
}

/** Validate + resolve + render. Returns the validation report. */
export async function run(pack, registry, packageStore) {
  state.tilesRendered = 0;
  const report = validateAssetPack(pack, registry);
  state.lastReport = report;
  const rep = el('mapReport');
  if (rep) rep.textContent = report.ok ? `VALID — ${report.limits.tile_count} tile(s), approved hashes only` : ('BLOCKED:\n' + report.errors.join('\n'));
  if (!report.ok) { setStatus('BLOCKED — pack rejected', 'mv-bad'); const c = el('mapCanvas'); if (c) clearCanvas(c.getContext('2d'), c.width, c.height); return report; }
  const resolved = await resolveAssetPack(pack, registry, packageStore);
  if (!resolved.ok) { state.lastReport = { ...report, ok: false, errors: resolved.errors }; setStatus('BLOCKED — resolve failed', 'mv-bad'); if (rep) rep.textContent = 'BLOCKED (resolve):\n' + resolved.errors.join('\n'); return state.lastReport; }
  state.tilesRendered = renderTiles(resolved.tiles);
  setStatus(`rendered ${state.tilesRendered} approved tile(s) — local preview only`, 'mv-ok');
  return report;
}

/** Fetch the bundled sample pack + registry + the referenced package bodies (same-origin, local). */
export async function loadSample() {
  const base = new URL(SAMPLE_DIR, import.meta.url);
  const [pack, registry, block, layered] = await Promise.all([
    fetch(new URL('sample-asset-pack/pack.json', base)).then((r) => r.json()),
    fetch(new URL('sample-asset-pack/registry.json', base)).then((r) => r.json()),
    fetch(new URL('sample-block.package.json', base)).then((r) => r.json()),
    fetch(new URL('sample-layered.package.json', base)).then((r) => r.json()),
  ]);
  // build the local store keyed by each body's real canonical hash
  const packageStore = {};
  packageStore[await packageHash(block)] = block;
  packageStore[await packageHash(layered)] = layered;
  return { pack, registry, packageStore };
}

function wire() {
  el('runSampleBtn')?.addEventListener('click', async () => { const s = await loadSample(); run(s.pack, s.registry, s.packageStore); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();

window.__cf5_map = {
  get lastReport() { return state.lastReport; },
  get tilesRendered() { return state.tilesRendered; },
  run, loadSample,
  async loadSampleAndRun() { const s = await loadSample(); return run(s.pack, s.registry, s.packageStore); },
};
