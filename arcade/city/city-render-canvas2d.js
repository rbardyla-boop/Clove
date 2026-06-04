/**
 * Neon Circuit — City Block 2D canvas renderer (the robust fallback).
 *
 * Renders the top-down block from the shared layout with a camera that follows the
 * local player. Used when Three.js is absent or its WebGL context fails to init, so
 * the city is always playable. Pure presentation — no authority, no network.
 */

const VIEWPORT_UNITS = 560; // world units visible vertically (orthographic feel)
const PAL = {
  asphalt: '#080610', road: '#14141f', roadLine: '#2b2b3d', sidewalk: '#1c1c2a',
  building: '#191324', buildingEdge: '#3a2a55', arcade: '#ff2d95', arcadeGlow: 'rgba(255,45,149,.35)',
  portal: '#22e0ff', portalGlow: 'rgba(34,224,255,.45)', vehicle: '#2a2030', vehicleEdge: '#52406a',
  me: '#22e0ff', other: '#ffb020', text: '#9fb9c9', border: '#34465a',
};

export function createCanvas2DRenderer(canvas, layout) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let cssW = 0;
  let cssH = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = canvas.clientWidth || window.innerWidth;
    cssH = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  resize();

  function draw(view) {
    const me = view.me || { x: layout.world.w / 2, y: layout.world.h / 2, facing: 0 };
    const scale = (cssH * dpr) / VIEWPORT_UNITS;
    const camX = me.x;
    const camY = me.y;
    const w2s = (x, y) => [(x - camX) * scale + canvas.width / 2, (y - camY) * scale + canvas.height / 2];
    const rect = (r, fill, stroke) => {
      const [sx, sy] = w2s(r.x, r.y);
      ctx.fillStyle = fill;
      ctx.fillRect(sx, sy, r.w * scale, r.h * scale);
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, 1.5 * dpr); ctx.strokeRect(sx, sy, r.w * scale, r.h * scale); }
    };

    // backdrop
    ctx.fillStyle = PAL.asphalt;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // roads + centre dashes
    for (const rd of layout.roads) rect(rd, PAL.road);
    ctx.strokeStyle = PAL.roadLine;
    ctx.lineWidth = Math.max(1, 2 * dpr);
    ctx.setLineDash([14 * scale * 0.02 + 6, 10]);
    for (const rd of layout.roads) {
      ctx.beginPath();
      if (rd.orient === 'v') { const [cx, y0] = w2s(rd.x + rd.w / 2, rd.y); const [, y1] = w2s(rd.x, rd.y + rd.h); ctx.moveTo(cx, y0); ctx.lineTo(cx, y1); }
      else { const [x0, cy] = w2s(rd.x, rd.y + rd.h / 2); const [x1] = w2s(rd.x + rd.w, rd.y); ctx.moveTo(x0, cy); ctx.lineTo(x1, cy); }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // sidewalks (drawn under buildings)
    for (const s of layout.sidewalks) rect(s, PAL.sidewalk, null);

    // buildings (arcade gets the glow)
    for (const b of layout.buildings) {
      if (b.kind === 'arcade') {
        ctx.save(); ctx.shadowColor = PAL.arcade; ctx.shadowBlur = 24 * dpr;
        rect(b, PAL.building, PAL.arcade); ctx.restore();
        label(b, b.label, PAL.arcade);
      } else {
        rect(b, PAL.building, PAL.buildingEdge);
        label(b, b.label, PAL.text);
      }
    }

    // parked vehicles (scaffold props)
    for (const p of layout.props) rect(p, PAL.vehicle, PAL.vehicleEdge);

    // portals (glowing doorway)
    for (const z of layout.portals) {
      ctx.save(); ctx.shadowColor = PAL.portal; ctx.shadowBlur = 22 * dpr;
      rect(z, PAL.portalGlow, PAL.portal); ctx.restore();
      label({ x: z.x, y: z.y, w: z.w, h: z.h }, z.label, PAL.portal, true);
    }

    // remote players
    for (const o of (view.others || [])) marker(o, PAL.other, false);
    // local player on top
    if (view.me) marker(view.me, PAL.me, true);

    // world border
    const [bx, by] = w2s(0, 0);
    ctx.strokeStyle = PAL.border; ctx.lineWidth = Math.max(1, 2 * dpr);
    ctx.strokeRect(bx, by, layout.world.w * scale, layout.world.h * scale);

    function marker(p, color, isSelf) {
      const [sx, sy] = w2s(p.x, p.y);
      const r = (isSelf ? 11 : 9) * scale * 0.9 + 4;
      ctx.save();
      ctx.shadowColor = color; ctx.shadowBlur = (isSelf ? 16 : 8) * dpr;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // facing tick
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, 2 * dpr);
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(p.facing || 0) * r * 1.7, sy + Math.sin(p.facing || 0) * r * 1.7); ctx.stroke();
    }
    function label(b, text, color, center) {
      if (!text) return;
      const [sx, sy] = w2s(center ? b.x + b.w / 2 : b.x, b.y);
      ctx.fillStyle = color;
      ctx.font = `${Math.round(11 * dpr)}px "Chakra Petch", ui-monospace, monospace`;
      ctx.textAlign = center ? 'center' : 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(text, center ? sx : sx + 6 * dpr, sy - 6 * dpr);
    }
  }

  return { name: 'canvas2d', draw, resize };
}
