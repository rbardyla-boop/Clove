/**
 * Creator Foundation CF-3.5 — LOCAL District Asset Editor (top-world composer; trusted, offline).
 *
 * The missing EDITOR for the existing CF-5 `city_asset_pack` kind: compose a small tiled district
 * map by placing ALREADY-APPROVED, hash-addressed block packages (CF-2 registry) on a bounded grid,
 * validate live with the SAME validator the CLI/Hive use (validateAssetPack), preview with the SAME
 * renderers (drawBlock / drawLayeredBlock via resolveAssetPack), and export the pack JSON.
 *
 * DATA-ONLY + DENY-BY-DEFAULT, exactly like every CF editor: no submit, no upload, no network beyond
 * same-origin sample fetch, no live-world load (packs carry no_live_world_load), no code execution,
 * approved hashes only — an unapproved tile is BLOCKED by the validator, not by this UI.
 * See arcade/virtual-arcade/HIVE_WORLD_ALIGNMENT.md §4.
 */
import { PACK_KIND, PACK_SCHEMA_VERSION, MAX_COLS, MAX_ROWS, MAX_TILES, REQUIRED_CONSTRAINTS } from '../schemas/asset-pack-schema.mjs';
import { validateAssetPack, resolveAssetPack } from '../validator/validate-asset-pack.mjs';
import { packageHash } from '../validator/package-hash.mjs';
import { worldToScreen, drawBlock } from '../render/iso-renderer.mjs';
import { drawLayeredBlock } from '../render/layered-renderer.mjs';

const SAMPLE_DIR = '../samples/';
const el = (id) => document.getElementById(id);

// ── editor state (LOCAL only; nothing leaves this page except a user-initiated download) ──
const state = {
  registry: null,            // CF-2 approved registry (sample or imported)
  store: {},                 // hash → approved package body (sample or imported)
  palette: [],               // [{ hash, kind, label }] — placeable approved packages
  selected: 0,               // palette index
  cols: 4, rows: 4,
  tiles: new Map(),          // "gx,gy" → { package_hash, package_kind }
  lastReport: null,
  lastPack: null,
};

// ── pack assembly (pure from state) ───────────────────────────────────────────
function assemble() {
  const tiles = [...state.tiles.entries()]
    .map(([pos, t]) => {
      const [gx, gy] = pos.split(',').map(Number);
      return { gx, gy, package_hash: t.package_hash, package_kind: t.package_kind };
    })
    .sort((a, b) => (a.gy - b.gy) || (a.gx - b.gx));
  const pack = {
    schema_version: PACK_SCHEMA_VERSION,
    pack_kind: PACK_KIND,
    pack_id: String(el('packId').value || ''),
    grid: { cols: state.cols, rows: state.rows },
    tiles,
    constraints: { ...REQUIRED_CONSTRAINTS },
  };
  const dn = String(el('displayName').value || '').trim();
  if (dn) pack.display_name = dn;
  return pack;
}

// ── preview (same back-to-front iso composition as the CF-5 map viewer) ──────
async function renderPreview(pack) {
  const canvas = el('preview');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!state.lastReport || !state.lastReport.ok) return 0;
  const resolved = await resolveAssetPack(pack, state.registry, state.store);
  if (!resolved.ok) return 0;
  const ordered = [...resolved.tiles].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
  let drawn = 0;
  for (const t of ordered) {
    const p = worldToScreen(t.gx, t.gy, { originX: canvas.width / 2, originY: 70 });
    try {
      if (t.package_kind === 'block_style') drawBlock(ctx, t.package.style, { originX: p.sx, originY: p.sy });
      else if (t.package_kind === 'block_layered') drawLayeredBlock(ctx, t.package, { originX: p.sx, originY: p.sy });
      drawn++;
    } catch { /* one bad tile must not abort the composition */ }
  }
  return drawn;
}

// ── grid UI (buttons; place selected palette entry / clear) ──────────────────
function rebuildGrid() {
  const grid = el('grid');
  grid.textContent = '';
  grid.style.gridTemplateColumns = `repeat(${state.cols}, 34px)`;
  for (let gy = 0; gy < state.rows; gy++) {
    for (let gx = 0; gx < state.cols; gx++) {
      const key = `${gx},${gy}`;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      const t = state.tiles.get(key);
      if (t) {
        cell.classList.add(t.package_kind === 'block_layered' ? 'cell-layered' : 'cell-style');
        cell.textContent = t.package_kind === 'block_layered' ? 'L' : 'S';
      }
      cell.setAttribute('aria-label', t ? `Clear tile at ${gx},${gy}` : `Place tile at ${gx},${gy}`);
      cell.addEventListener('click', () => { toggleTile(key); });
      grid.appendChild(cell);
    }
  }
}

function toggleTile(key) {
  if (state.tiles.has(key)) state.tiles.delete(key);
  else {
    if (state.tiles.size >= MAX_TILES) return;          // the validator enforces this too
    const p = state.palette[state.selected];
    if (!p) return;
    state.tiles.set(key, { package_hash: p.hash, package_kind: p.kind });
  }
  refresh();
}

function rebuildPalette() {
  const sel = el('palette');
  sel.textContent = '';
  state.palette.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `${p.label} (${p.kind})`;
    sel.appendChild(o);
  });
  sel.value = String(state.selected);
}

// ── validate + report + preview + exports ─────────────────────────────────────
async function refresh() {
  rebuildGrid();
  const pack = assemble();
  state.lastPack = pack;
  const report = validateAssetPack(pack, state.registry);
  state.lastReport = report;
  const verdict = el('verdict');
  verdict.textContent = report.ok ? 'VALID (local only)' : 'BLOCKED';
  verdict.className = 'verdict ' + (report.ok ? 'v-ok' : 'v-bad');
  el('issues').textContent = report.errors.length ? report.errors.join('\n') : '(none)';
  el('counts').textContent = `${state.tiles.size}/${MAX_TILES} tiles · ${report.limits.size_bytes} bytes`;
  el('hash').textContent = await packageHash(pack);
  el('receiptNote').textContent = 'status=local_validation_only · live_world_authorized=false';
  el('exportPack').disabled = !report.ok;
  const drawn = await renderPreview(pack);
  el('previewNote').textContent = report.ok ? `rendered ${drawn} approved tile(s) — local preview only` : 'preview cleared — pack is blocked';
}

function download(name, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── approved inputs: bundled sample OR user-imported registry/package files ──
async function addBody(body) {
  const hash = await packageHash(body);
  state.store[hash] = body;
  if (!state.palette.some((p) => p.hash === hash)) {
    state.palette.push({ hash, kind: body.package_kind, label: body.display_name || body.package_id || hash.slice(7, 15) });
  }
}

async function loadSample() {
  const base = new URL(SAMPLE_DIR, import.meta.url);
  const [registry, block, layered] = await Promise.all([
    fetch(new URL('sample-asset-pack/registry.json', base)).then((r) => r.json()),
    fetch(new URL('sample-block.package.json', base)).then((r) => r.json()),
    fetch(new URL('sample-layered.package.json', base)).then((r) => r.json()),
  ]);
  state.registry = registry;
  state.store = {}; state.palette = []; state.selected = 0;
  await addBody(block);
  await addBody(layered);
  rebuildPalette();
  await refresh();
}

const readJsonFile = (file) => file.text().then((t) => JSON.parse(t));

function wire() {
  el('packId').addEventListener('input', refresh);
  el('displayName').addEventListener('input', refresh);
  el('cols').addEventListener('change', () => { state.cols = Math.min(MAX_COLS, Math.max(1, Number(el('cols').value) || 1)); state.tiles.clear(); refresh(); });
  el('rows').addEventListener('change', () => { state.rows = Math.min(MAX_ROWS, Math.max(1, Number(el('rows').value) || 1)); state.tiles.clear(); refresh(); });
  el('palette').addEventListener('change', () => { state.selected = Number(el('palette').value) || 0; });
  el('clearBtn').addEventListener('click', () => { state.tiles.clear(); refresh(); });
  el('exportPack').addEventListener('click', () => { if (state.lastPack && state.lastReport?.ok) download(`${state.lastPack.pack_id}.asset-pack.json`, state.lastPack); });
  el('importRegistry').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { state.registry = await readJsonFile(f); } catch { state.registry = null; }
    await refresh();
  });
  el('importPackage').addEventListener('change', async (e) => {
    for (const f of e.target.files || []) {
      try { await addBody(await readJsonFile(f)); } catch { /* unreadable file → skipped; validator still rules */ }
    }
    rebuildPalette();
    await refresh();
  });
  loadSample().catch(() => { el('verdict').textContent = 'BLOCKED'; el('issues').textContent = 'sample load failed — import a registry + packages'; });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();

// ── test/automation hook (mirrors the other CF editors) ──────────────────────
window.__cf35_editor = {
  get lastReport() { return state.lastReport; },
  get lastPack() { return state.lastPack; },
  get tileCount() { return state.tiles.size; },
  get paletteSize() { return state.palette.length; },
  selectPalette(i) { state.selected = i; },
  placeAt(gx, gy) { toggleTile(`${gx},${gy}`); },
  refresh,
};
