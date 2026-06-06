/**
 * Sample Tiny Cabinet — CF-1 adapter TEMPLATE.
 *
 * The adapter is the ONLY bridge between the sandboxed game and the host cabinet frame. In the live
 * runtime (a later phase) the game runs inside a sandboxed iframe and the adapter speaks a narrow
 * postMessage contract; here it is a thin, dependency-free reference that wires host calls to the
 * game's contract methods. It performs NO network, NO storage, and asserts NO authority — round
 * results are PROPOSED to the host, never finalized by the game.
 */
import { createGame } from './game.mjs';

export function createAdapter() {
  const game = createGame();
  return {
    mount(frame) { game.init({ width: frame.width, height: frame.height }); },
    frame(dt, ctx) { game.tick(dt); game.render(ctx); },
    input(ev) { game.onInput(ev); },
    // Host pulls a proposed result; the server validates/awards. The adapter adds no trust.
    result() { return game.proposeResult(); },
    capabilities() { return []; },   // deny-by-default: this cabinet requests nothing
  };
}
