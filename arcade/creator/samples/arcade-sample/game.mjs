/**
 * CF-4 sample arcade game — original, procedural, tiny, deterministic. No assets, no imports.
 * Renders a pulsing ring; a tap near the pulse peak PROPOSES a point. The game asserts no authority:
 * proposeResult() is advisory only — the host/server never trusts it (CF-4 local sandbox).
 * Requests NO capabilities (no network, storage, eval, DOM-escape).
 */
export function createGame() {
  let t = 0;
  let score = 0;
  let running = false;
  let w = 360;
  let h = 640;
  return {
    init(frame) { w = frame.width; h = frame.height; running = true; t = 0; score = 0; },
    tick(dt) { if (running) t += dt; },
    render(ctx) {
      const cx = w / 2;
      const cy = h / 2;
      const phase = Math.abs(Math.sin(t * 2));
      const r = 28 + 18 * phase;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#22e0ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    },
    onInput(ev) {
      if (!running || !ev || ev.type !== 'tap') return;
      if (Math.abs(Math.sin(t * 2)) > 0.5) score += 1;
    },
    proposeResult() { return { proposed_score: score, public_safe: true }; },
  };
}
