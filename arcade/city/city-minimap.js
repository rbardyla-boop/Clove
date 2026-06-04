/**
 * Neon Circuit — City Block minimap / radar v1 (Phase 4B). Procedural Canvas-2D
 * overlay (no assets): block outline, simplified roads + building massing, the
 * arcade portal, remote players, and the local player with a facing tick. Pure
 * presentation — reads the shared layout + live positions, owns no state/authority.
 */
const PAL = {
  bg: 'rgba(6,4,16,.82)', edge: '#34465a', road: '#1a1a28', building: '#241a36',
  portal: '#ff2d95', me: '#22e0ff', other: '#ffb020',
};

export function createCityMinimap(canvas, layout) {
  const ctx = canvas.getContext('2d');
  const W = layout.world.w;
  const H = layout.world.h;
  let dpr = 1;
  let size = 0; // CSS px (square)

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = canvas.clientWidth || 150;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
  }
  resize();

  function draw(view) {
    if (!size) resize();
    const s = (canvas.width) / Math.max(W, H); // world units → device px
    const px = (x, y) => [x * s, y * s];
    const rect = (r, fill) => { const [x, y] = px(r.x, r.y); ctx.fillStyle = fill; ctx.fillRect(x, y, r.w * s, r.h * s); };

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const rd of layout.roads) rect(rd, PAL.road);
    for (const b of layout.buildings) rect(b, b.kind === 'arcade' ? '#3a1430' : PAL.building);

    // portal (glowing)
    for (const z of layout.portals) {
      const [x, y] = px(z.x, z.y);
      ctx.fillStyle = PAL.portal; ctx.fillRect(x - 1, y - 1, z.w * s + 2, z.h * s + 2);
    }

    // remote players
    for (const o of (view.others || [])) dot(o, PAL.other, 2.2);
    // local player + facing tick
    if (view.me) {
      dot(view.me, PAL.me, 3);
      const [mx, my] = px(view.me.x, view.me.y);
      ctx.strokeStyle = PAL.me; ctx.lineWidth = Math.max(1, 1 * dpr);
      ctx.beginPath(); ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(view.me.facing || 0) * 7 * dpr, my + Math.sin(view.me.facing || 0) * 7 * dpr);
      ctx.stroke();
    }

    // frame border
    ctx.strokeStyle = PAL.edge; ctx.lineWidth = Math.max(1, 1 * dpr);
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

    function dot(p, color, r) {
      const [x, y] = px(p.x, p.y);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r * dpr, 0, Math.PI * 2); ctx.fill();
    }
  }

  return { name: 'minimap', draw, resize };
}
