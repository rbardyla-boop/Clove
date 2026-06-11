/**
 * Curated Starter Cabinets — shared HOST (browser; production; ADR-043).
 *
 * One hand-written host wraps every curated starter's generated game module
 * (the CF-4 contract: createGame() → { init, tick, render, onInput, proposeResult })
 * into the floor's import-loader adapter contract ({ adapter, contract, createGame }
 * with a getRoot()/open()/close() game). The host owns the chrome — name, the
 * standing honesty line, a thumb-sized Leave button, and a live LOCAL score line —
 * so each starter's generated source stays pure drawing + scoring.
 *
 * AUTHORITY: none. Starters are client_local_only / ticket_mode 'none'. The host
 * sends NO messages, calls NO client API, and the score is a session-local
 * proposal that is never submitted anywhere. The honesty line is a STATIC
 * constant (never derived from game output) and renders before and during play.
 */

export const STARTER_NATIVE_W = 360;
export const STARTER_NATIVE_H = 640;
const STAGE_H = 552; // native height minus the host chrome band (header + score line)

/** The standing honesty line — static closed copy, shown on the shelf AND in the frame. */
export const STARTER_SAFETY_LINE = 'session-local · no tickets';

/** Frame contract for a starter (360×640, fit-contain — the production cabinet box). */
export function starterContract(gameId, displayName) {
  return Object.freeze({
    game_id: gameId,
    cabinet_id: gameId.replace(/_/g, '-'),
    display_name: displayName,
    native_width: STARTER_NATIVE_W,
    native_height: STARTER_NATIVE_H,
    aspect_ratio: STARTER_NATIVE_W / STARTER_NATIVE_H,
    scale_mode: 'fit-contain',
    allow_upscale: true,
    max_upscale: 2,
    min_scale: 0.25,
    original_width: STARTER_NATIVE_W,
    original_height: STARTER_NATIVE_H,
    current_width: STARTER_NATIVE_W,
    current_height: STARTER_NATIVE_H,
    clone_policy: 'preserve_original_size',
    migrated: false,
  });
}

/** Adapter descriptor for a starter — strictly local-only modes (the runtime re-checks). */
export function starterAdapter(gameId, displayName) {
  return Object.freeze({
    gameId,
    cabinetId: gameId.replace(/_/g, '-'),
    cabinetType: gameId,
    displayName,
    frameContractId: gameId,
    nativeWidth: STARTER_NATIVE_W,
    nativeHeight: STARTER_NATIVE_H,
    rulesetVersion: 'starter/1',
    authorityMode: 'client_local_only',
    ticketMode: 'none',
    challengeMode: 'none',
    inputSchema: Object.freeze({ methods: ['pointer'], primary: 'tap' }),
    lifecycle: Object.freeze(['onMount', 'onUnmount', 'onResize', 'onFocus', 'onBlur', 'onServerState']),
    selectors: Object.freeze({ panel: '.st-panel', stage: '.st-stage', chrome: '.st-head' }),
    capabilities: Object.freeze({ tickets: false, challenges: false, prizes: false }),
    clonePolicy: 'preserve_original_size',
  });
}

/**
 * Build the host game for one starter. `createCabinetGame` is the starter's generated
 * CF-4 factory; `onLeave` is the floor's unmount callback (the Leave button's action).
 * Returns the import-runtime game shape: { getRoot, open, close }.
 */
export function createStarterHostGame({ createCabinetGame, displayName, onLeave }) {
  const root = document.createElement('div');
  root.className = 'st-panel';
  root.innerHTML = `
    <div class="st-head">
      <span class="st-name"></span>
      <span class="st-safety"></span>
      <button class="st-leave" type="button" aria-label="Leave this cabinet">✕ Leave</button>
    </div>
    <canvas class="st-stage" width="${STARTER_NATIVE_W}" height="${STAGE_H}"></canvas>
    <div class="st-score" role="status"></div>`;
  root.querySelector('.st-name').textContent = displayName;
  root.querySelector('.st-safety').textContent = STARTER_SAFETY_LINE;

  const canvas = root.querySelector('.st-stage');
  const scoreEl = root.querySelector('.st-score');
  let game = null;
  let raf = 0;
  let last = 0;

  const renderScore = () => {
    const s = game ? game.proposeResult() : null;
    scoreEl.textContent = s ? `score ${s.proposed_score} · ${STARTER_SAFETY_LINE}` : STARTER_SAFETY_LINE;
  };
  const loop = (now) => {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (game) {
      game.tick(dt);
      game.render(canvas.getContext('2d'));
    }
    raf = requestAnimationFrame(loop);
  };

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!game) return;
    game.onInput({ type: 'tap' });
    renderScore();
  });
  root.querySelector('.st-leave').addEventListener('click', () => {
    if (typeof onLeave === 'function') onLeave();
  });

  return {
    getRoot() { return root; },
    open() {
      game = createCabinetGame();
      game.init({ width: STARTER_NATIVE_W, height: STAGE_H });
      renderScore();
      last = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    close() {
      cancelAnimationFrame(raf);
      raf = 0;
      game = null;
    },
  };
}
