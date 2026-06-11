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
export function createStarterHostGame({ createCabinetGame, displayName, instruction, onLeave }) {
  const root = document.createElement('div');
  root.className = 'st-panel';
  root.innerHTML = `
    <div class="st-head">
      <span class="st-titles"><span class="st-name"></span><span class="st-instruction"></span></span>
      <span class="st-safety"></span>
      <button class="st-leave" type="button" aria-label="Leave this cabinet">✕ Leave</button>
    </div>
    <canvas class="st-stage" width="${STARTER_NATIVE_W}" height="${STAGE_H}"></canvas>
    <div class="st-score" role="status"></div>`;
  root.querySelector('.st-name').textContent = displayName;
  root.querySelector('.st-instruction').textContent = instruction || '';
  root.querySelector('.st-safety').textContent = STARTER_SAFETY_LINE;

  const canvas = root.querySelector('.st-stage');
  const scoreEl = root.querySelector('.st-score');
  let game = null;
  let raf = 0;
  let last = 0;
  let pointerId = null;

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
      renderScore();
    }
    raf = requestAnimationFrame(loop);
  };

  // pointer → NATIVE coordinates (the frame scales the whole panel; map back through the rect)
  const nativePoint = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: r.width ? (e.clientX - r.left) * (STARTER_NATIVE_W / r.width) : STARTER_NATIVE_W / 2,
      y: r.height ? (e.clientY - r.top) * (STAGE_H / r.height) : STAGE_H / 2,
    };
  };
  const send = (type, p) => { if (game) { game.onInput({ type, ...p }); } };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pointerId = e.pointerId;
    try { canvas.setPointerCapture(pointerId); } catch { /* capture unsupported */ }
    send('press', nativePoint(e));
  });
  canvas.addEventListener('pointermove', (e) => { if (e.pointerId === pointerId) send('move', nativePoint(e)); });
  const endPointer = (e) => {
    if (e.pointerId !== pointerId) return;
    try { canvas.releasePointerCapture(pointerId); } catch { /* already released */ }
    pointerId = null;
    send('release', nativePoint(e));
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  // keyboard fallback (cleaned up on close): Space = press/release at center;
  // ArrowLeft/Right = a synthesized full swipe (press → move → release across the lane).
  const center = { x: STARTER_NATIVE_W / 2, y: STAGE_H / 2 };
  let spaceDown = false;
  const onKeyDown = (e) => {
    if (!game) return;
    if (e.code === 'Space' && !spaceDown) { spaceDown = true; e.preventDefault(); send('press', center); }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault();
      const dir = e.code === 'ArrowRight' ? 1 : -1;
      send('press', { x: center.x - dir * 60, y: center.y });
      send('move', { x: center.x, y: center.y });
      send('release', { x: center.x + dir * 60, y: center.y });
    }
  };
  const onKeyUp = (e) => {
    if (e.code === 'Space' && spaceDown) { spaceDown = false; e.preventDefault(); send('release', center); }
  };

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
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
    },
    close() {
      cancelAnimationFrame(raf);
      raf = 0;
      game = null;
      pointerId = null;
      spaceDown = false;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
}
