/**
 * Sample Tiny Cabinet — CF-1 arcade game TEMPLATE (procedural, no assets, tiny).
 *
 * Contract (CF-1, doc-level — not wired into the live runtime in this phase):
 *   - The host mounts the game inside the sandboxed cabinet frame for `frame_contract_id`.
 *   - FRAME : the game renders into a host-provided 2D context sized to the frame contract.
 *   - INPUT : the host forwards normalized input events (pointer/keyboard/touch) via the adapter.
 *   - RESULT: the game proposes a round result via the adapter; the SERVER remains the authority —
 *             it accepts/awards/anti-cheats. The game NEVER asserts tickets, scores, or economy.
 *   - The game requests NO capabilities (no network, storage, payments, auth, transfer, DOM escape).
 *
 * This template is original + procedural: a pulse you tap in rhythm. Keep edits under the declared
 * size budget (the creative constraint) — prefer math + shapes over assets.
 */
export function createGame() {
  let t = 0;
  let score = 0;
  let running = false;

  return {
    /** Called once with the frame size. Pure setup; no I/O. */
    init({ width, height }) { this.w = width; this.h = height; running = true; t = 0; score = 0; },

    /** Advance simulation by dt seconds. Deterministic given inputs. */
    tick(dt) { if (running) t += dt; },

    /** Render the current frame into a 2D context. Drawing only. */
    render(ctx) {
      const cx = (this.w || 360) / 2;
      const cy = (this.h || 640) / 2;
      const r = 30 + 18 * Math.abs(Math.sin(t * 2));
      ctx.clearRect(0, 0, this.w || 360, this.h || 640);
      ctx.strokeStyle = '#22e0ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    },

    /** Host forwards a normalized input. The game only proposes intent. */
    onInput(ev) {
      if (!running || ev.type !== 'tap') return;
      const phase = Math.abs(Math.sin(t * 2));
      if (phase > 0.85) score += 1;          // proposes a point; SERVER decides if it counts
    },

    /** Proposed round result — advisory only; the server is authoritative. */
    proposeResult() { return { proposed_score: score, public_safe: true }; },
  };
}
