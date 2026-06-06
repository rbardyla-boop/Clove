/**
 * Creator Foundation CF-1 — isometric/top-down block renderer, PURE math + procedural draw.
 *
 * Original, procedural neon visuals — NO external images/audio, NO copied franchise art. The look
 * evokes old top-down/isometric city readability, drawn entirely from shapes + the closed token
 * vocab (creator-tokens.mjs). `worldToScreen` is pure + deterministic (unit-testable without a
 * canvas); `drawBlock` paints a single block from a block-style `style` object onto a 2D context.
 */
import { hexForPalette, hexForAccent, glowForLighting } from '../schemas/creator-tokens.mjs';

/** Default isometric tile metrics. */
export const ISO = Object.freeze({ tileW: 96, tileH: 48 });

/**
 * PURE: isometric world (grid) → screen projection. Deterministic; no rounding surprises.
 * @returns {{sx:number, sy:number}}
 */
export function worldToScreen(gx, gy, { tileW = ISO.tileW, tileH = ISO.tileH, originX = 0, originY = 0 } = {}) {
  return {
    sx: originX + (gx - gy) * (tileW / 2),
    sy: originY + (gx + gy) * (tileH / 2),
  };
}

/** PURE: the 4 screen-space corners of one iso tile diamond at grid (gx,gy). */
export function tileDiamond(gx, gy, opts = {}) {
  const { tileW = ISO.tileW, tileH = ISO.tileH } = opts;
  const c = worldToScreen(gx, gy, opts);
  return [
    { x: c.sx, y: c.sy - tileH / 2 },          // top
    { x: c.sx + tileW / 2, y: c.sy },          // right
    { x: c.sx, y: c.sy + tileH / 2 },          // bottom
    { x: c.sx - tileW / 2, y: c.sy },          // left
  ];
}

/** PURE: trace a closed path through points (exported so the CF-3 layered renderer can reuse it). */
export function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}
/** PURE: multiply a #rrggbb hex by factor f, clamped to [0,255] → rgb() string. Exported for reuse. */
export const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
};
/** PURE: the 4 screen-space corners of a vertical face rising height `h` from base edge a→b. */
export function faceQuad(a, b, h) {
  return [a, b, { x: b.x, y: b.y - h }, { x: a.x, y: a.y - h }];
}

/**
 * Draw one procedural neon block from a block-style `style` (palette/facade_pattern/sign_variant/
 * lighting/accent/tile_accent). `ctx` is a 2D context; `opts` sets origin + scale. Drawing only —
 * no state, no I/O.
 */
export function drawBlock(ctx, style, opts = {}) {
  const o = { tileW: ISO.tileW, tileH: ISO.tileH, originX: 0, originY: 0, height: 86, ...opts };
  const base = hexForPalette(style.palette);
  const accent = hexForAccent(style.accent);
  const glow = glowForLighting(style.lighting);

  // ground tile (diamond) with optional tile accent
  const dia = tileDiamond(0, 0, o);
  ctx.save();
  poly(ctx, dia);
  ctx.fillStyle = shade(base, 0.18);
  ctx.fill();
  ctx.strokeStyle = accent === 'transparent' ? shade(base, 0.5) : accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawTileAccent(ctx, dia, style.tile_accent, base);

  // building box rising from the tile (two visible faces + top)
  const top = dia[0];
  const h = o.height;
  const left = { x: dia[3].x, y: dia[3].y - h };
  const right = { x: dia[1].x, y: dia[1].y - h };
  const apex = { x: dia[0].x, y: dia[0].y - h };
  const back = { x: dia[2].x, y: dia[2].y - h };
  // left face
  poly(ctx, [dia[3], dia[0], apex, left]); ctx.fillStyle = shade(base, 0.55); ctx.fill();
  // right face
  poly(ctx, [dia[0], dia[1], right, apex]); ctx.fillStyle = shade(base, 0.8); ctx.fill();
  // roof
  poly(ctx, [apex, right, back, left]); ctx.fillStyle = shade(base, 1); ctx.fill();

  drawFacade(ctx, dia[3], dia[0], h, style.facade_pattern, accent, base);  // on the left face
  drawFacade(ctx, dia[0], dia[1], h, style.facade_pattern, accent, base);  // on the right face

  // sign + glow
  if (glow > 0) { ctx.shadowColor = base; ctx.shadowBlur = 16 * glow; }
  drawSign(ctx, apex, style.sign_variant, base, accent);
  ctx.restore();
  void top;
}

function drawTileAccent(ctx, dia, accent, base) {
  if (!accent || accent === 'none' || accent === 'plain') return;
  ctx.save(); poly(ctx, dia); ctx.clip();
  ctx.strokeStyle = shade(base, 0.7); ctx.lineWidth = 1;
  const cx = dia[0].x, cy = (dia[0].y + dia[2].y) / 2;
  if (accent === 'hazard-stripe') { for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 12, dia[0].y); ctx.lineTo(cx + i * 12 + 24, dia[2].y); ctx.stroke(); } }
  else if (accent === 'dotmatrix') { for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.arc(cx + i * 14, cy + j * 10, 1.5, 0, 7); ctx.stroke(); } }
  else if (accent === 'circuit') { ctx.beginPath(); ctx.moveTo(dia[3].x, cy); ctx.lineTo(cx, cy - 6); ctx.lineTo(dia[1].x, cy); ctx.stroke(); }
  ctx.restore();
}

function drawFacade(ctx, a, b, h, pattern, accent, base) {
  if (!pattern) return;
  ctx.save();
  poly(ctx, [a, b, { x: b.x, y: b.y - h }, { x: a.x, y: a.y - h }]); ctx.clip();
  ctx.strokeStyle = accent === 'transparent' ? shade(base, 1.2) : accent;
  ctx.lineWidth = 1;
  const cols = pattern === 'lattice' ? 6 : 4;
  const rows = pattern === 'grid-window-tall' || pattern === 'panel-stack' ? 6 : 4;
  for (let c = 1; c < cols; c++) { const t = c / cols; ctx.beginPath(); ctx.moveTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); ctx.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - h); ctx.stroke(); }
  if (pattern !== 'ribbed') for (let r = 1; r < rows; r++) { const y = -h * (r / rows); ctx.beginPath(); ctx.moveTo(a.x, a.y + y); ctx.lineTo(b.x, b.y + y); ctx.stroke(); }
  ctx.restore();
}

function drawSign(ctx, apex, variant, base, accent) {
  if (!variant || variant === 'none') return;
  ctx.fillStyle = accent === 'transparent' ? base : accent;
  if (variant === 'small-marquee') ctx.fillRect(apex.x - 14, apex.y - 14, 28, 8);
  else if (variant === 'blade') ctx.fillRect(apex.x - 3, apex.y - 26, 6, 22);
  else if (variant === 'halo') { ctx.beginPath(); ctx.arc(apex.x, apex.y - 14, 9, 0, 7); ctx.fill(); }
  else if (variant === 'ticker') { for (let i = -2; i <= 2; i++) ctx.fillRect(apex.x + i * 8 - 2, apex.y - 12, 4, 4); }
}
