/**
 * CF-4 sample arcade adapter — the ONLY bridge between the sandboxed game and the host frame.
 * Imports only ./game.mjs. Performs NO network, NO storage; asserts NO authority. The host pulls a
 * PROPOSED result; the server (a future, separately-gated phase) would validate it — the adapter adds
 * no trust. Requests no capabilities (deny-by-default).
 */
import { createGame } from './game.mjs';

export function createAdapter() {
  const game = createGame();
  return {
    mount(frame) { game.init({ width: frame.width, height: frame.height }); },
    frame(dt, ctx) { game.tick(dt); game.render(ctx); },
    input(ev) { game.onInput(ev); },
    result() { return game.proposeResult(); },
    capabilities() { return []; },
  };
}
