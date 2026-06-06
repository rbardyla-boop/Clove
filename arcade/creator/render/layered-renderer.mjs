/**
 * Creator Foundation CF-3 — LAYERED block renderer, PURE math + procedural draw.
 *
 * Draws a `block_layered` package on the SAME isometric geometry as iso-renderer.mjs's drawBlock,
 * composing the 6 layer dimensions back-to-front (tile → box → facade → windows → decals → roof+sign
 * → per-zone lighting). Original, procedural neon visuals only — NO external images/audio, NO copied
 * art. Reuses the iso geometry + draw primitives (worldToScreen/tileDiamond/poly/shade/faceQuad) and
 * the closed token vocab. An optional `palette_variant` recolors every resolved hex through a
 * deterministic HSV transform (`applyPaletteVariant`). Drawing only — no state, no I/O, single frame.
 */
import { ISO, tileDiamond, poly, shade, faceQuad } from './iso-renderer.mjs';
import {
  hexForColorSlot, hexForPalette, glowForLighting, decalScaleMul,
  WINDOW_DENSITY_GRID, PALETTE_VARIANT_TRANSFORM,
} from '../schemas/creator-tokens.mjs';

// ── pure color math (palette-variant HSV transform) ────────────────────────────────────────────
function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function rgbToHex(r, g, b) { const h = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'); return `#${h(r)}${h(g)}${h(b)}`; }
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx === 0 ? 0 : d / mx, mx];
}
function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** PURE: recolor a #rrggbb hex by a closed palette-variant token. Unknown variant / non-hex passes through. */
export function applyPaletteVariant(hex, variant) {
  if (typeof hex !== 'string' || hex[0] !== '#' || hex.length !== 7) return hex;
  const t = PALETTE_VARIANT_TRANSFORM[variant];
  if (!t) return hex;
  const [h, s, v] = rgbToHsv(...hexToRgb(hex));
  return rgbToHex(...hsvToRgb(h + t.hueShift, clamp(s * t.sat, 0, 1), clamp(v * t.val, 0, 1)));
}

/** PURE: resolve a color-slot token (palette or accent) → hex, then through the optional variant. */
export function resolveColor(token, variant) {
  const hex = hexForColorSlot(token);
  if (hex === 'transparent') return 'transparent';
  return applyPaletteVariant(hex, variant);
}

/** PURE: map a 3×3 position token to a fractional (fx,fy) anchor inside a face. */
export function decalAnchorFraction(position) {
  const col = position.includes('left') ? 0.25 : position.includes('right') ? 0.75 : 0.5;
  const row = position.startsWith('upper') ? 0.28 : position.startsWith('lower') ? 0.72 : 0.5;
  return { fx: col, fy: row };
}

// ── procedural draw ─────────────────────────────────────────────────────────────────────────────
/**
 * Draw one `block_layered` package. `ctx` is a 2D context; `opts` sets origin + scale.
 * Defensive: missing optional layers are skipped; a malformed package simply renders less.
 */
export function drawLayeredBlock(ctx, pkg, opts = {}) {
  const o = { tileW: ISO.tileW, tileH: ISO.tileH, originX: 0, originY: 0, height: 96, ...opts };
  const variant = pkg && pkg.palette_variant;
  const L = (pkg && pkg.layers) || {};
  const facade = L.facade || {};
  const primary = applyPaletteVariant(hexForPalette(facade.primary_color), variant);
  const secondary = applyPaletteVariant(hexForPalette(facade.secondary_color), variant);
  const trim = resolveColor(facade.trim, variant);
  const trimStroke = trim === 'transparent' ? shade(primary, 0.6) : trim;

  const dia = tileDiamond(0, 0, o);
  const h = o.height;
  const apex = { x: dia[0].x, y: dia[0].y - h };
  const right = { x: dia[1].x, y: dia[1].y - h };
  const left = { x: dia[3].x, y: dia[3].y - h };
  const back = { x: dia[2].x, y: dia[2].y - h };
  const leftFace = faceQuad(dia[3], dia[0], h);
  const rightFace = faceQuad(dia[0], dia[1], h);
  const roofFace = [apex, right, back, left];

  ctx.save();
  // 1. ground tile
  poly(ctx, dia); ctx.fillStyle = shade(primary, 0.18); ctx.fill();
  ctx.strokeStyle = trimStroke; ctx.lineWidth = 1.5; ctx.stroke();
  // 2. building box (left/right/roof faces)
  poly(ctx, leftFace); ctx.fillStyle = shade(primary, 0.55); ctx.fill();
  poly(ctx, rightFace); ctx.fillStyle = shade(secondary, 0.82); ctx.fill();
  poly(ctx, roofFace); ctx.fillStyle = shade(primary, 1); ctx.fill();
  // 3. facade pattern on both visible faces
  drawFacadePattern(ctx, leftFace, facade.pattern, trimStroke);
  drawFacadePattern(ctx, rightFace, facade.pattern, trimStroke);
  // 4. windows on both faces
  if (L.windows) { drawWindows(ctx, leftFace, L.windows, variant); drawWindows(ctx, rightFace, L.windows, variant); }
  // 5. symbols/decals on the most-visible (right) face
  if (Array.isArray(L.symbols)) for (const s of L.symbols) drawDecal(ctx, rightFace, s, variant);
  // 6. roof accent + sign
  if (L.roof) drawRoof(ctx, apex, left, right, L.roof, variant);
  if (L.sign) drawSign(ctx, apex, L.sign, variant);
  // 7. per-zone lighting glow
  const zones = Array.isArray(L.lighting_zones) ? L.lighting_zones : [];
  drawZoneGlows(ctx, zones, { leftFace, rightFace, roofFace, tile: dia }, primary);
  ctx.restore();
}

function clipFace(ctx, quad) { poly(ctx, quad); ctx.clip(); }

function patternGrid(pattern) {
  switch (pattern) {
    case 'lattice': case 'neon-mesh': return [6, 6];
    case 'grid-window-tall': case 'panel-stack': case 'stepped-terrace': return [4, 6];
    case 'pixel-columns': return [8, 1];
    case 'brutalist-block': return [2, 2];
    case 'ribbed': case 'wave-ribbed': return [5, 1];
    default: return [4, 4];
  }
}

function drawFacadePattern(ctx, quad, pattern, stroke) {
  if (!pattern) return;
  const [cols, rows] = patternGrid(pattern);
  const [a, b, , d] = [quad[0], quad[1], quad[2], quad[3]];   // a,b = base edge; d = top of a
  const topA = d, topB = quad[2];
  ctx.save(); clipFace(ctx, quad);
  ctx.strokeStyle = stroke; ctx.lineWidth = pattern === 'brutalist-block' ? 2 : 1;
  for (let c = 1; c < cols; c++) {
    const t = c / cols;
    const wob = pattern === 'wave-ribbed' ? Math.sin(t * Math.PI * 2) * 3 : 0;
    ctx.beginPath();
    ctx.moveTo(a.x + (b.x - a.x) * t + wob, a.y + (b.y - a.y) * t);
    ctx.lineTo(topA.x + (topB.x - topA.x) * t + wob, topA.y + (topB.y - topA.y) * t);
    ctx.stroke();
  }
  if (rows > 1) for (let r = 1; r < rows; r++) {
    const t = r / rows;
    ctx.beginPath();
    ctx.moveTo(a.x + (topA.x - a.x) * t, a.y + (topA.y - a.y) * t);
    ctx.lineTo(b.x + (topB.x - b.x) * t, b.y + (topB.y - b.y) * t);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWindows(ctx, quad, w, variant) {
  const [cols, rows] = WINDOW_DENSITY_GRID[w.density] || [4, 4];
  const glow = applyPaletteVariant(hexForPalette(w.glow_color), variant);
  const [a, b, , d] = [quad[0], quad[1], quad[2], quad[3]];
  const topA = d, topB = quad[2];
  ctx.save(); clipFace(ctx, quad);
  const lit = w.grid_type === 'glass-bright' || w.grid_type === 'glass-neon' || w.grid_type === 'neon-tube';
  ctx.fillStyle = lit ? glow : shade(glow, 0.3);
  ctx.strokeStyle = glow; ctx.lineWidth = 0.8; ctx.globalAlpha = lit ? 0.55 : 0.3;
  const shutter = w.grid_type.startsWith('shutter');
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const u = (c + 0.5) / cols, v = (r + 0.5) / rows;
    const px = a.x + (b.x - a.x) * u + (topA.x - a.x) * v + ((topB.x - topA.x) - (b.x - a.x)) * u * v;
    const py = a.y + (b.y - a.y) * u + (topA.y - a.y) * v + ((topB.y - topA.y) - (b.y - a.y)) * u * v;
    const s = Math.max(2, 22 / Math.max(cols, rows));
    if (shutter) { ctx.beginPath(); ctx.moveTo(px - s / 2, py); ctx.lineTo(px + s / 2, py); ctx.stroke(); }
    else if (w.grid_type === 'neon-tube') { ctx.beginPath(); ctx.moveTo(px, py - s / 2); ctx.lineTo(px, py + s / 2); ctx.stroke(); }
    else ctx.fillRect(px - s / 3, py - s / 3, s * 0.66, s * 0.66);
  }
  ctx.restore();
}

function drawDecal(ctx, quad, sym, variant) {
  if (!sym || sym.token === 'none') return;
  const { fx, fy } = decalAnchorFraction(sym.position || 'center');
  const [a, b, , d] = [quad[0], quad[1], quad[2], quad[3]];
  const topA = d, topB = quad[2];
  const px = a.x + (b.x - a.x) * fx + (topA.x - a.x) * fy + ((topB.x - topA.x) - (b.x - a.x)) * fx * fy;
  const py = a.y + (b.y - a.y) * fx + (topA.y - a.y) * fy + ((topB.y - topA.y) - (b.y - a.y)) * fx * fy;
  const r = 9 * decalScaleMul(sym.scale);
  const color = resolveColor(sym.color, variant);
  ctx.save(); clipFace(ctx, quad);
  ctx.strokeStyle = color === 'transparent' ? '#eaf6ff' : color;
  ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 1.4;
  decalShape(ctx, sym.token, px, py, r);
  ctx.restore();
}

function decalShape(ctx, token, x, y, r) {
  const ray = (n) => { ctx.beginPath(); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.stroke(); };
  const ngon = (n) => { ctx.beginPath(); for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; const fn = i ? 'lineTo' : 'moveTo'; ctx[fn](x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.stroke(); };
  const grid = (n) => { for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * r / n * 2, y - r); ctx.lineTo(x + i * r / n * 2, y + r); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - r, y + i * r / n * 2); ctx.lineTo(x + r, y + i * r / n * 2); ctx.stroke(); } };
  switch (token) {
    case 'decal-star-burst': return ray(8);
    case 'decal-light-burst': return ray(12);
    case 'decal-circuit-burst': return ray(6);
    case 'decal-grid-overlay': return grid(2);
    case 'decal-grid-sparse': return grid(1);
    case 'decal-neon-grid': return grid(3);
    case 'decal-chevron-up': { ctx.beginPath(); ctx.moveTo(x - r, y + r / 2); ctx.lineTo(x, y - r / 2); ctx.lineTo(x + r, y + r / 2); ctx.stroke(); return; }
    case 'decal-chevron-down': { ctx.beginPath(); ctx.moveTo(x - r, y - r / 2); ctx.lineTo(x, y + r / 2); ctx.lineTo(x + r, y - r / 2); ctx.stroke(); return; }
    case 'decal-diamond': return ngon(4);
    case 'decal-hexagon': return ngon(6);
    case 'decal-hazard-stripe': { for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * 4 - r / 2, y + r / 2); ctx.lineTo(x + i * 4 + r / 2, y - r / 2); ctx.stroke(); } return; }
    case 'decal-diagonal-stripe': { ctx.beginPath(); ctx.moveTo(x - r, y + r); ctx.lineTo(x + r, y - r); ctx.stroke(); return; }
    case 'decal-circuit-path': { ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x - r / 3, y); ctx.lineTo(x - r / 3, y - r / 2); ctx.lineTo(x + r / 3, y - r / 2); ctx.lineTo(x + r / 3, y + r / 2); ctx.lineTo(x + r, y + r / 2); ctx.stroke(); return; }
    case 'decal-dot-trail': { for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(x + i * (r / 2), y, 1.4, 0, 7); ctx.fill(); } return; }
    case 'decal-pixel-block': { ctx.strokeRect(x - r / 2, y - r / 2, r, r); return; }
    default: return;
  }
}

function drawRoof(ctx, apex, left, right, roof, variant) {
  const hi = resolveColor(roof.highlight, variant);
  ctx.save();
  ctx.strokeStyle = hi === 'transparent' ? '#eaf6ff' : hi;
  ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 1.5;
  const cx = apex.x, cy = apex.y;
  switch (roof.accent_type) {
    case 'ridge-sharp': ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(cx, cy - 14); ctx.lineTo(right.x, right.y); ctx.stroke(); break;
    case 'ridge-soft': ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.quadraticCurveTo(cx, cy - 18, right.x, right.y); ctx.stroke(); break;
    case 'dome-profile': ctx.beginPath(); ctx.arc(cx, cy, 10, Math.PI, 0); ctx.stroke(); break;
    case 'antenna-spike': ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 24); ctx.stroke(); break;
    case 'beacon-pod': ctx.beginPath(); ctx.arc(cx, cy - 16, 5, 0, 7); ctx.fill(); break;
    default: break;   // flat-parapet
  }
  if (roof.pattern && roof.pattern !== 'none') {
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      if (roof.pattern === 'lights') { ctx.arc(cx + i * 7, cy - 2, 1.4, 0, 7); ctx.fill(); }
      else { ctx.moveTo(cx + i * 6, cy); ctx.lineTo(cx + i * 6, cy - (roof.pattern === 'vents' ? 5 : 8)); ctx.stroke(); }
    }
  }
  ctx.restore();
}

function drawSign(ctx, apex, sign, variant) {
  if (!sign || sign.variant === 'none' || sign.placement === 'none') return;
  const color = applyPaletteVariant(hexForPalette(sign.color), variant);
  const off = sign.placement === 'upper-left' ? -20 : sign.placement === 'upper-right' ? 20 : 0;
  const x = apex.x + off, y = apex.y;
  ctx.save(); ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8;
  if (sign.variant === 'small-marquee') ctx.fillRect(x - 14, y - 14, 28, 8);
  else if (sign.variant === 'blade') ctx.fillRect(x - 3, y - 26, 6, 22);
  else if (sign.variant === 'halo') { ctx.beginPath(); ctx.arc(x, y - 14, 9, 0, 7); ctx.fill(); }
  else if (sign.variant === 'ticker') { for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * 8 - 2, y - 12, 4, 4); }
  ctx.restore();
}

function drawZoneGlows(ctx, zones, regions, primary) {
  for (const z of zones) {
    if (!z || z.glow === 'off') continue;
    const region = z.zone_id === 'left-face' ? regions.leftFace
      : z.zone_id === 'right-face' ? regions.rightFace
        : z.zone_id === 'roof' ? regions.roofFace
          : regions.tile;
    if (!region) continue;
    ctx.save();
    ctx.shadowColor = primary; ctx.shadowBlur = 16 * glowForLighting(z.glow);
    ctx.strokeStyle = shade(primary, 1.1); ctx.lineWidth = 1.5; ctx.globalAlpha = z.flicker ? 0.6 : 0.9;
    poly(ctx, region); ctx.stroke();
    ctx.restore();
  }
}
