/**
 * Creator Foundation CF-4 — LOCAL arcade sandbox runner (trusted host).
 *
 * Imports + vets a package (import-arcade-package.mjs), then runs it in a HARDENED, ISOLATED iframe:
 *   - sandbox="allow-scripts" only  → the frame is a NULL origin: no storage, no cookies, no
 *     same-origin access to this page, no top-navigation, no forms, no popups;
 *   - a strict CSP (default-src 'none'; NO connect-src → NO network of any kind; NO 'unsafe-eval'
 *     → eval/new Function blocked at runtime; img-src data: only → no external assets);
 *   - the package game+adapter source is inlined as ONE module (the importer guarantees the entry has
 *     no imports and the adapter imports only ./game.mjs, so concatenation is sound; the importer also
 *     rejects </script> + markup, so inlining is safe);
 *   - the ONLY host↔frame channel is a narrow postMessage frame contract (input in, result out).
 *
 * The host NEVER trusts the frame: a proposed result is surfaced as an UNTRUSTED LOCAL PROPOSAL with
 * `server_authorized:false`. No live cabinet registration, no ticket/prize/ledger authority, no network
 * from the frame. Local creator tooling only.
 */
import { importArcadePackage } from '../arcade-importer/import-arcade-package.mjs';

const SAMPLE_DIR = '../samples/arcade-sample/';

let currentFrame = null; // the active sandbox iframe

const state = {
  lastReport: null,
  ready: false,
  lastProposal: null,
  frameDims: null,
};

function el(id) { return document.getElementById(id); }
function setStatus(text, cls) {
  const s = el('sandboxStatus');
  if (s) { s.textContent = text; s.className = 'sb-status ' + (cls || ''); }
}

/** Strip the adapter's `import {...} from './game.mjs';` (multiline-tolerant) — createGame is
 *  concatenated in scope. The importer already guarantees the adapter's only import is './game.mjs'. */
function stripGameImport(adapterSource) {
  return adapterSource.replace(/import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/game\.mjs['"]\s*;?/g, '');
}

function buildSrcdoc(gameSource, adapterSource, dims) {
  const adapter = stripGameImport(adapterSource);
  // NOTE: built by concatenation (not a template literal) so package backticks cannot break it.
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'">',
    '<style>html,body{margin:0;background:#05060c}canvas{display:block;width:100%;height:100%}</style></head>',
    '<body><canvas id="stage" width="' + dims.width + '" height="' + dims.height + '"></canvas>',
    '<script type="module">',
    gameSource,
    '\n',
    adapter,
    '\n',
    'const __ctx = document.getElementById("stage").getContext("2d");',
    'const __adapter = createAdapter();',
    'try { __adapter.mount({ width: ' + dims.width + ', height: ' + dims.height + ' }); } catch (e) {}',
    'let __last = 0;',
    'function __loop(ts){ const dt = __last ? Math.min((ts - __last) / 1000, 0.05) : 0; __last = ts; try { __adapter.frame(dt, __ctx); } catch (e) {} requestAnimationFrame(__loop); }',
    'requestAnimationFrame(__loop);',
    'addEventListener("message", function (e) {',
    '  if (e.source !== parent) return;', // only accept the host channel
    '  const m = e.data || {};',
    '  if (m.type === "input") { try { __adapter.input(m.event); } catch (e2) {} }',
    '  else if (m.type === "request_result") {',
    '    let r = null; try { r = __adapter.result(); } catch (e3) { r = null; }',
    '    parent.postMessage({ type: "result_proposal", proposal: r, trust: "untrusted_local_proposal", server_authorized: false }, "*");',
    '  }',
    '});',
    'parent.postMessage({ type: "sandbox_ready" }, "*");',
    '</' + 'script></body></html>',
  ].join('\n');
}

function teardown() {
  if (currentFrame && currentFrame.parentNode) currentFrame.parentNode.removeChild(currentFrame);
  currentFrame = null;
  state.ready = false;
  state.lastProposal = null;
}

/** Import + vet a package and (if ok) run it in the hardened sandbox. Returns the import report. */
export function run(manifest, files) {
  teardown();
  const report = importArcadePackage({ manifest, files });
  state.lastReport = report;
  const reportEl = el('sandboxReport');
  if (reportEl) reportEl.textContent = report.ok ? 'IMPORT OK — running in local sandbox (untrusted)' : ('BLOCKED:\n' + report.errors.join('\n'));
  if (!report.ok) { setStatus('BLOCKED — package rejected', 'sb-bad'); return report; }

  const dims = report.frame_dims || { width: 360, height: 640 };
  state.frameDims = dims;
  const host = el('sandboxMount');
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts'); // null origin: no storage/same-origin/nav/popups
  frame.setAttribute('title', 'arcade package sandbox (local, untrusted)');
  frame.width = String(dims.width);
  frame.height = String(dims.height);
  frame.style.border = '0';
  frame.style.background = '#05060c';
  frame.srcdoc = buildSrcdoc(files[report.entry], files[report.adapter], dims);
  if (host) { host.innerHTML = ''; host.appendChild(frame); }
  currentFrame = frame;
  setStatus('running (local sandbox — results untrusted)', 'sb-run');
  return report;
}

/** Fetch the bundled sample package (same-origin local files; the FRAME still has no network). */
export async function loadSample() {
  const base = new URL(SAMPLE_DIR, import.meta.url);
  const [manifestText, game, adapter] = await Promise.all([
    fetch(new URL('manifest.json', base)).then((r) => r.text()),
    fetch(new URL('game.mjs', base)).then((r) => r.text()),
    fetch(new URL('adapter.mjs', base)).then((r) => r.text()),
  ]);
  const manifest = JSON.parse(manifestText);
  const files = { 'manifest.json': manifestText, [manifest.entry]: game, [manifest.adapter]: adapter };
  return { manifest, files };
}

function sendInput(event) { if (currentFrame && currentFrame.contentWindow) currentFrame.contentWindow.postMessage({ type: 'input', event }, '*'); }
function requestResult() { if (currentFrame && currentFrame.contentWindow) currentFrame.contentWindow.postMessage({ type: 'request_result' }, '*'); }

// host receives ONLY from the active frame; origin is null (sandbox) so we verify by source identity.
window.addEventListener('message', (e) => {
  if (!currentFrame || e.source !== currentFrame.contentWindow) return;
  const m = e.data || {};
  if (m.type === 'sandbox_ready') { state.ready = true; setStatus('ready (local sandbox)', 'sb-run'); }
  else if (m.type === 'result_proposal') {
    state.lastProposal = m;
    const out = el('sandboxResult');
    if (out) out.textContent = 'UNTRUSTED LOCAL PROPOSAL (not server-authorized): ' + JSON.stringify(m.proposal);
  }
});

// wire the page controls + expose a test/automation hook
function wire() {
  el('runSampleBtn')?.addEventListener('click', async () => { const p = await loadSample(); run(p.manifest, p.files); });
  el('tapBtn')?.addEventListener('click', () => sendInput({ type: 'tap' }));
  el('resultBtn')?.addEventListener('click', () => requestResult());
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();

// Test/automation hook — NOT part of the user path (the page buttons drive everything via wire()).
// Exposed only on local dev hosts or with ?__debug=1 so it is never a public global entrypoint once
// this surface ships in the curated upload. The real import/play flow uses the on-page buttons.
function debugHookAllowed() {
  try {
    const h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '' ||
      location.protocol === 'file:' || /[?&]__debug=1\b/.test(location.search);
  } catch { return false; }
}
if (debugHookAllowed()) {
  window.__cf4_sandbox = {
    get lastReport() { return state.lastReport; },
    get ready() { return state.ready; },
    get lastProposal() { return state.lastProposal; },
    get frameDims() { return state.frameDims; },
    run, loadSample, sendTap: () => sendInput({ type: 'tap' }), requestResult, teardown,
    async loadSampleAndRun() { const p = await loadSample(); return run(p.manifest, p.files); },
  };
}
