/**
 * Cabinet Frame runtime (browser) — Phase 1i.
 *
 * Wraps a game's panel in a standard frame that preserves the game's ORIGINAL
 * size: the native logical box is uniformly scaled (never distorted, never
 * cropped) to fit the cabinet viewport, centered, with letterbox/pillarbox bars.
 *
 * It reads the declared contract from ./cabinet-frame-contract.mjs (pure), so the
 * frame the player sees is the frame the tests validate. It changes NO server
 * state and NO gameplay authority — it only measures, scales, centers and maps
 * input coordinates back into native space.
 */
import { getContract, validateContract, computeFrame, screenToNative, nativeToScreen } from './cabinet-frame-contract.mjs';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('frameDebug') === '1';
const EXPOSE = DEBUG || params.get('test') === '1';

export function createCabinetFrame(gameId, { onLeave = () => {} } = {}) {
  const contract = getContract(gameId);
  if (!contract) throw new Error(`No frame contract for game "${gameId}"`);
  // Fail loudly in dev/test if a clone silently changed the native size.
  const v = validateContract(contract);
  if (!v.ok && EXPOSE) console.error(`[cabinet-frame] contract invalid for ${gameId}: ${v.errors.join(', ')}`);

  let overlay = null;
  let frameEl = null;
  let stageEl = null;
  let debugEl = null;
  let ro = null;
  let open = false;
  let geom = { scale: 1, displayWidth: 0, displayHeight: 0, letterboxX: 0, letterboxY: 0, frameWidth: 0, frameHeight: 0, fits: true };
  let pointerNative = { x: null, y: null };

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'cf-overlay';
    overlay.dataset.gameId = contract.game_id;
    overlay.dataset.cabinetId = contract.cabinet_id;
    overlay.dataset.nativeWidth = String(contract.native_width);
    overlay.dataset.nativeHeight = String(contract.native_height);
    overlay.dataset.aspectRatio = (contract.native_width / contract.native_height).toFixed(6);
    overlay.dataset.scaleMode = contract.scale_mode;
    overlay.innerHTML = `
      <div class="cf-frame" data-f="frame">
        <div class="cf-stage" data-f="stage"></div>
        <div class="cf-debug" data-f="debug" aria-hidden="true" hidden></div>
      </div>`;
    frameEl = overlay.querySelector('[data-f="frame"]');
    stageEl = overlay.querySelector('[data-f="stage"]');
    debugEl = overlay.querySelector('[data-f="debug"]');
    stageEl.style.width = contract.native_width + 'px';
    stageEl.style.height = contract.native_height + 'px';
    overlay.style.setProperty('--game-native-width', String(contract.native_width));
    overlay.style.setProperty('--game-native-height', String(contract.native_height));
    document.body.appendChild(overlay);

    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => recalc());
      ro.observe(frameEl);
    }
    addEventListener('resize', recalc);
    addEventListener('orientationchange', recalc);

    if (DEBUG) {
      debugEl.hidden = false;
      overlay.addEventListener('pointermove', (e) => {
        pointerNative = screenToNativePoint(e.clientX, e.clientY);
        renderDebug();
      });
    }
    if (EXPOSE) {
      (window.__cabinetFrames || (window.__cabinetFrames = {}))[gameId] = api;
    }
  }

  function recalc() {
    if (!frameEl) return;
    const frameWidth = frameEl.clientWidth;
    const frameHeight = frameEl.clientHeight;
    const r = computeFrame({
      nativeWidth: contract.native_width,
      nativeHeight: contract.native_height,
      frameWidth,
      frameHeight,
      scaleMode: contract.scale_mode,
      allowUpscale: contract.allow_upscale,
      maxUpscale: contract.max_upscale,
      minScale: contract.min_scale,
    });
    geom = { ...r, frameWidth, frameHeight };
    stageEl.style.transform = `scale(${r.scale})`;
    overlay.style.setProperty('--game-scale', String(r.scale));
    overlay.style.setProperty('--game-frame-width', frameWidth + 'px');
    overlay.style.setProperty('--game-frame-height', frameHeight + 'px');
    overlay.style.setProperty('--game-display-width', r.displayWidth + 'px');
    overlay.style.setProperty('--game-display-height', r.displayHeight + 'px');
    overlay.style.setProperty('--game-letterbox-x', r.letterboxX + 'px');
    overlay.style.setProperty('--game-letterbox-y', r.letterboxY + 'px');
    if (DEBUG) renderDebug();
  }

  function renderDebug() {
    if (!debugEl) return;
    const d = debug();
    debugEl.textContent = [
      `game: ${d.gameId}`,
      `native: ${d.nativeWidth}×${d.nativeHeight}  (ar ${d.aspectRatio.toFixed(4)})`,
      `frame: ${Math.round(d.frameWidth)}×${Math.round(d.frameHeight)}`,
      `scale: ${d.scale.toFixed(4)}  mode: ${d.scaleMode}`,
      `display: ${Math.round(d.displayWidth)}×${Math.round(d.displayHeight)}`,
      `letterbox: x ${Math.round(d.letterboxX)}  y ${Math.round(d.letterboxY)}`,
      `pointer→native: ${d.pointerNativeX == null ? '—' : Math.round(d.pointerNativeX)},${d.pointerNativeY == null ? '—' : Math.round(d.pointerNativeY)}`,
    ].join('\n');
  }

  function screenToNativePoint(clientX, clientY) {
    if (!stageEl) return { x: 0, y: 0 };
    const rect = stageEl.getBoundingClientRect();
    return screenToNative({ clientX, clientY }, { left: rect.left, top: rect.top, scale: geom.scale });
  }
  function nativeToScreenPoint(x, y) {
    if (!stageEl) return { clientX: 0, clientY: 0 };
    const rect = stageEl.getBoundingClientRect();
    return nativeToScreen({ x, y }, { left: rect.left, top: rect.top, scale: geom.scale });
  }

  function debug() {
    return {
      gameId: contract.game_id,
      cabinetId: contract.cabinet_id,
      nativeWidth: contract.native_width,
      nativeHeight: contract.native_height,
      aspectRatio: contract.native_width / contract.native_height,
      scaleMode: contract.scale_mode,
      scale: geom.scale,
      frameWidth: geom.frameWidth,
      frameHeight: geom.frameHeight,
      displayWidth: geom.displayWidth,
      displayHeight: geom.displayHeight,
      letterboxX: geom.letterboxX,
      letterboxY: geom.letterboxY,
      fits: geom.fits,
      pointerNativeX: pointerNative.x,
      pointerNativeY: pointerNative.y,
    };
  }

  const api = {
    /** Mount the game's panel element into the native-sized stage. */
    mount(panelEl) {
      if (!overlay) build();
      stageEl.appendChild(panelEl);
      recalc();
    },
    open() {
      if (!overlay) build();
      if (open) return;
      open = true;
      overlay.classList.add('show');
      // measure after layout
      recalc();
      requestAnimationFrame(recalc);
    },
    close() {
      if (!overlay || !open) return;
      open = false;
      overlay.classList.remove('show');
    },
    isOpen() { return open; },
    recalc,
    onLeave,
    screenToNativePoint,
    nativeToScreenPoint,
    debug,
    get contract() { return contract; },
    get element() { return overlay; },
  };
  return api;
}
