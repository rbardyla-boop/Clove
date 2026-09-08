import {
  currentPacketForRevision,
  derivePaperViewModel,
} from './play-loop.mjs';

const $ = (id) => document.getElementById(id);
const canvas = $('paper-world');

let dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
let angle = -0.68;
let zoom = 1;
let dragging = false;
let dragX = 0;
let connected = false;
let field = null;
let paper = null;
let gone = { relayRepair: 'OPEN', workerReplaced: 0, findingsRejected: 0, ready: 'OPEN' };
let role = '';
let principal = '';
let members = [];
let socket = null;
let rugBusy = false;
let lastReceipt = null;
let lastAcceptedReceiptId = '';
let lastReceiptAck = null;
let receiptAccepting = false;
let receiptRetryAt = 0;
let receiptRetryMs = 1_000;
let receiptRetryId = '';
let lastHead = '';
let heartbeatTimer = 0;
let snapshotTimer = 0;
let offlineLocal = false;
let lockedConfig = null;
const keys = new Set();
const log = [];
let moreOpen = false;
let statsOpen = false;
let deskOpen = false;
let bumpUntil = 0;
let primaryActionId = '';
let paperRenderer = null;


function resize() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  paperRenderer?.resize();
  draw();
}
window.addEventListener('resize', resize);

// Graphics are required; expose runtime measurements, never self-graded PASS flags.
import('./paper-renderer.mjs').then((module) => {
  if (typeof module.createPaperRenderer !== 'function') return;
  paperRenderer = module.createPaperRenderer(canvas);
  window.__paperFirmRenderer = paperRenderer.diagnostics;
  paperRenderer.resize();
  draw();
}).catch((error) => {
  console.error('Paper Firm 3D renderer failed', error);
  $('connection-status').textContent = '3D renderer unavailable. WebGL2 is required.';
});

function addLog(text, kind = '') {
  log.unshift({ text, kind, at: Date.now() });
  if (log.length > 12) log.length = 12;
  $('log-lines').innerHTML = log.slice(0, 8).map((x) => `<div class="log-entry ${x.kind}">${escapeHtml(x.text)}</div>`).join('');
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function setBlocked(btn, blocked, why = '') {
  if (!btn) return;
  btn.disabled = Boolean(blocked);
  const reason = blocked ? String(why || 'Not available yet') : '';
  btn.title = reason;
  if (reason) btn.dataset.why = reason;
  else delete btn.dataset.why;
  const base = btn.dataset.label || btn.textContent.trim();
  if (!btn.dataset.label) btn.dataset.label = base;
  btn.setAttribute('aria-label', reason ? `${base}. ${reason}` : base);
}

function nextStep() {
  return derivePaperViewModel({ paper, gone, field, role, principal }).next;
}

function viewModel() {
  return derivePaperViewModel({ paper, gone, field, role, principal, now: Date.now() });
}

function syncPrimaryCta() {
  const step = nextStep();
  primaryActionId = step.id || '';
  const btn = $('primary-cta');
  const hint = $('primary-hint');
  btn.textContent = step.label;
  btn.dataset.label = step.label;
  setBlocked(btn, !step.enabled, step.why);
  hint.textContent = step.why;
  hint.classList.toggle('is-blocked', !step.enabled);
  btn.classList.toggle('danger', step.id === 'go-offline' || step.id === 'change-requirement');
  btn.classList.toggle('signature', step.id === 'sign-relay');
}

function setPanelOpen(kind, open) {
  if (kind === 'more') {
    moreOpen = open;
    $('more-panel').classList.toggle('hidden', !moreOpen);
    $('toggle-more').setAttribute('aria-expanded', moreOpen ? 'true' : 'false');
  } else if (kind === 'stats') {
    statsOpen = open;
    $('desk').classList.toggle('hidden', !statsOpen);
    $('toggle-stats').setAttribute('aria-expanded', statsOpen ? 'true' : 'false');
  } else if (kind === 'desk') {
    deskOpen = open;
    $('overnight').classList.toggle('hidden', !deskOpen);
    $('toggle-desk').setAttribute('aria-expanded', deskOpen ? 'true' : 'false');
  }
  renderViewModel(viewModel());
}

function flashWallBump() {
  bumpUntil = Date.now() + 550;
  const el = $('wall-bump');
  el.classList.remove('hidden');
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
  clearTimeout(flashWallBump._t);
  flashWallBump._t = setTimeout(() => {
    if (Date.now() >= bumpUntil) el.classList.add('hidden');
  }, 560);
}


function config() {
  if (lockedConfig) return lockedConfig;
  const match = $('match-id').value.trim().toUpperCase();
  const rug = $('rug-url').value.trim().replace(/\/$/, '');
  let mesh = $('mesh-url').value.trim().replace(/\/$/, '');
  if (!mesh) {
    if (location.hostname === 'clovelearn.io') mesh = 'wss://clovelearn.io';
    else mesh = 'ws://localhost:8787';
  }
  mesh = mesh.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  // A production admission ticket is scoped to the canonical mesh. Ignore a
  // user-supplied endpoint there so a signed ticket cannot be redirected to an
  // attacker-controlled WebSocket origin.
  if (location.hostname === 'clovelearn.io' || location.hostname === 'www.clovelearn.io') mesh = 'wss://clovelearn.io';
  return { match, rug, mesh };
}

async function rugPost(action, extra = {}) {
  const { match, rug } = config();
  if (!match || !rug) throw new Error('RUG URL and WORLD are required');
  const res = await fetch(`${rug}/api/paper-firm`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, code: match, ...extra }),
  });
  const data = await res.json().catch(() => ({ ok: false, reason: `HTTP ${res.status}` }));
  if (!res.ok || data.ok === false) {
    const e = new Error(data.reason || `HTTP ${res.status}`);
    e.data = data;
    throw e;
  }
  applyRug(data);
  return data;
}

function applyRug(data) {
  if (data.me) principal = data.me;
  if (data.role) role = data.role;
  if (Array.isArray(data.members)) members = data.members;
  if (data.paper) paper = data.paper;
  if (data.whileYouWereGone) gone = data.whileYouWereGone;
  if (data.head) lastHead = data.head;
  updateUi();
  draw();
}

async function refreshRug() {
  if (!connected || rugBusy) return;
  rugBusy = true;
  try { await rugPost('snapshot'); }
  catch (err) { addLog(`RUG: ${err.message}`, 'reject'); }
  finally { rugBusy = false; }
}

async function openFieldSocket() {
  const { match, mesh } = config();
  if (!principal || !match) return;
  const admission = await rugPost('field_ticket');
  const ticket = admission.ticket;
  if (!ticket) throw new Error('field admission ticket missing');
  if (socket && socket.readyState <= 1) socket.close();
  socket = new WebSocket(`${mesh}/arcade/paper-firm/ws?match=${encodeURIComponent(match)}&ticket=${encodeURIComponent(ticket)}`);
  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({ t: 'pf_join', playerId: principal }));
    addLog('field link locked', 'pass');
  });
  socket.addEventListener('message', onFieldMessage);
  socket.addEventListener('close', () => addLog('field link closed'));
  socket.addEventListener('error', () => addLog('field link error', 'reject'));
}

async function onFieldMessage(event) {
  let msg;
  try { msg = JSON.parse(event.data); } catch { return; }
  if (msg.t === 'pf_welcome' || msg.t === 'pf_snapshot') {
    field = msg;
    draw();
    if (paper) syncPrimaryCta();
    if (role === 'hand' && msg.page?.pendingReceipt) await acceptReceipt(msg.page.pendingReceipt);
    return;
  }
  if (msg.t === 'pf_scout_event') {
    addLog(msg.verb === 'find' ? 'Scout found PAGE-7 in the stain' : 'Scout carried PAGE-7 to Archive', 'pass');
    return;
  }
  if (msg.t === 'pf_field_receipt') {
    lastReceipt = msg.receipt;
    addLog('signed extraction receipt reached the Desk', 'pass');
    if (role === 'hand') await acceptReceipt(msg.receipt);
    return;
  }
  if (msg.t === 'pf_extract_result') {
    if (msg.ok) {
      lastReceipt = msg.receipt;
      $('desk-pocket').textContent = 'PAGE-7 extracted';
      addLog('PAGE-7 extracted; waiting for Desk acceptance', 'pass');
    } else addLog(`extract rejected: ${msg.reason}`, 'reject');
    return;
  }
  if (msg.t === 'pf_bump') { flashWallBump(); return; }
  if (msg.t === 'pf_error') addLog(`field: ${msg.reason}`, 'reject');
}


async function acceptReceipt(receipt) {
  if (role !== 'hand' || !receipt?.receipt_id) return;
  lastReceipt = receipt;
  if (receiptRetryId !== receipt.receipt_id) {
    receiptRetryId = receipt.receipt_id;
    receiptRetryAt = 0;
    receiptRetryMs = 1_000;
    lastReceiptAck = null;
  }
  if (Date.now() < receiptRetryAt) return;
  if (lastAcceptedReceiptId === receipt.receipt_id) {
    if (lastReceiptAck && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: 'pf_receipt_ack', ack: lastReceiptAck }));
    return;
  }
  if (receiptAccepting) return;
  receiptAccepting = true;
  try {
    const accepted = await rugPost('intake_receipt', { receipt });
    if (!accepted.receiptAck) throw new Error('RUG did not return a receipt acknowledgement');
    lastAcceptedReceiptId = receipt.receipt_id;
    lastReceiptAck = accepted.receiptAck;
    receiptRetryAt = 0;
    receiptRetryMs = 1_000;
    addLog('Desk accepted receipt → OBS', 'pass');
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: 'pf_receipt_ack', ack: lastReceiptAck }));
  } catch (err) {
    const replayAck = err?.data?.receiptAck;
    if (replayAck) {
      lastAcceptedReceiptId = receipt.receipt_id;
      lastReceiptAck = replayAck;
      receiptRetryAt = 0;
      receiptRetryMs = 1_000;
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: 'pf_receipt_ack', ack: lastReceiptAck }));
    } else {
      receiptRetryAt = Date.now() + receiptRetryMs;
      receiptRetryMs = Math.min(30_000, receiptRetryMs * 2);
      addLog(`receipt rejected: ${err.message}`, 'reject');
    }
  } finally {
    receiptAccepting = false;
  }
}

async function connect() {
  const initialConfig = config();
  const { match } = initialConfig;
  if (!match) { $('connection-status').textContent = 'enter the RUG world code'; return; }
  $('connect-btn').disabled = true;
  try {
    const snap = await rugPost('snapshot');
    lockedConfig = initialConfig;
    for (const id of ['match-id', 'rug-url', 'mesh-url']) $(id).disabled = true;
    principal = snap.me;
    role = snap.role;
    connected = true;
    document.body.dataset.connected = 'true';
    $('connection-status').textContent = `${role === 'lead' ? 'Human A / field lead' : role === 'hand' ? 'Human B / desk lead' : role} · LOCKED`;
    $('field-controls').classList.remove('hidden');
    $('event-log').classList.remove('hidden');
    setPanelOpen('more', false);
    setPanelOpen('stats', false);
    setPanelOpen('desk', false);
    if (role === 'lead') $('human-a-actions').classList.remove('hidden');
    if (role === 'hand') $('human-b-actions').classList.remove('hidden');
    $('extract-page').classList.toggle('hidden', role !== 'lead');
    await openFieldSocket();
    startLoops();
    syncPrimaryCta();
    addLog('joined authoritative First Shift', 'pass');
    addLog('one next step on the face — MORE / STATS / DESK behind tabs');
  } catch (err) {
    $('connection-status').textContent = `RUG: ${err.message}`;
    addLog(`connect failed: ${err.message}`, 'reject');
  } finally {
    $('connect-btn').disabled = false;
  }
}

function startLoops() {
  clearInterval(heartbeatTimer);
  clearInterval(snapshotTimer);
  heartbeatTimer = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: 'heartbeat' }));
  }, 12_000);
  snapshotTimer = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: 'pf_snapshot_request' }));
    refreshRug();
  }, 12_000);
}

async function oneDeskAction(action, extra = {}) {
  const result = await rugPost(action, extra);
  addLog(`Desk: ${action.replaceAll('_', ' ')}`, result.ok === false ? 'reject' : 'pass');
  return result;
}

function setStateClasses(element, state) {
  if (!element) return;
  for (const className of ['is-awaiting', 'is-awaitingproof', 'is-ready', 'is-won', 'is-late', 'is-expired', 'is-complete']) {
    element.classList.remove(className);
  }
  element.classList.add(`is-${state}`);
  if (state === 'awaitingproof') element.classList.add('is-awaiting');
  if (state === 'won' || state === 'late') element.classList.add('is-complete');
}

function renderProofRows(rows, container) {
  if (!container) return;
  container.replaceChildren();
  for (const row of rows) {
    const item = document.createElement('div');
    item.className = `paper-proof-row is-${row.state}`;
    item.dataset.evidenceId = row.id;
    const label = document.createElement('span');
    label.className = 'paper-step';
    label.textContent = row.label;
    const value = document.createElement('b');
    value.className = 'paper-status';
    value.textContent = row.value;
    item.append(label, value);
    container.append(item);
  }
}

function renderViewModel(vm) {
  const state = $('paper-state');
  state.textContent = `${vm.status.label} · ${vm.status.detail}`;
  state.dataset.state = vm.status.id;
  state.dataset.deadlineAt = String(vm.deadline.at || '');
  setStateClasses(state, vm.status.id);
  $('paper-first-minute').textContent = vm.objective.help;
  $('paper-deadline').textContent = vm.deadline.label;
  $('paper-deadline').dataset.deadlineAt = String(vm.deadline.at || '');

  renderProofRows(vm.evidence.rows, $('paper-proof-rows'));
  $('paper-proof').classList.toggle('hidden', !statsOpen);
  const tuple = $('paper-proof-tuple');
  tuple.textContent = `EXACT TUPLE · ${vm.evidence.tupleText}`;
  tuple.dataset.valid = vm.evidence.exactTuple ? 'true' : 'false';

  const returnPanel = $('paper-return');
  returnPanel.classList.toggle('hidden', !vm.returnScreen.visible || !deskOpen);
  if (vm.returnScreen.visible && deskOpen) $('overnight').classList.add('hidden');
  $('paper-return-title').textContent = vm.returnScreen.title;
  renderProofRows(vm.returnScreen.lines, $('paper-return-lines'));
  $('paper-return-note').textContent = vm.returnScreen.visible
    ? 'No recap. These lines are the RUG return projection from events during the absence interval.'
    : 'No absence interval has been recorded yet.';

  const endgame = $('paper-endgame');
  endgame.classList.toggle('hidden', !vm.endgame.visible);
  endgame.dataset.state = vm.status.id;
  setStateClasses(endgame, vm.status.id);
  $('paper-endgame-title').textContent = vm.endgame.title;
  $('paper-endgame-body').textContent = vm.endgame.body;
  $('paper-endgame-tuple').textContent = vm.endgame.exactTuple
    ? `BOUND · ${vm.evidence.tupleText}`
    : 'No exact tuple is presented as proof.';
  document.body.dataset.contractState = vm.status.id;
}

function updateUi() {
  $('role-name').textContent = role === 'lead' ? 'HUMAN A — FIELD LEAD' : role === 'hand' ? 'HUMAN B — DESK LEAD' : role.toUpperCase();
  $('principal-id').textContent = principal ? principal.slice(0, 14) : '?';
  const vm = viewModel();
  renderViewModel(vm);
  if (!paper) {
    syncPrimaryCta();
    return;
  }

  $('desk-obs').textContent = paper.observationId || '—';
  $('desk-verified').textContent = paper.sourceVerified ? '✓ PAGE-7' : '—';
  $('desk-doctrine').textContent = paper.doctrineId || '—';
  $('desk-packet').textContent = vm.packet.current?.packetId || paper.currentPacketId || '—';
  $('desk-builder').textContent = paper.builderOperated ? (paper.workerReplacements ? 'replacement working' : 'working') : paper.workerOnline ? 'online' : 'waiting';
  $('desk-harness').textContent = paper.harnessPassed ? (paper.harnessBeforeMorning ? 'PASS' : 'LATE') : 'OPEN';
  $('desk-sign').textContent = vm.status.id === 'won' ? 'SIGNED' : vm.status.id === 'late' ? 'LATE' : vm.status.id === 'ready' ? 'READY' : vm.status.id === 'expired' ? 'EXPIRED' : 'blocked';
  $('scout-find').classList.toggle('hidden', role !== 'lead');
  $('scout-carry').classList.toggle('hidden', role !== 'lead');
  const deskActions = role === 'hand';
  $('human-b-actions').classList.toggle('hidden', !deskActions);
  $('finding-actions').classList.toggle('hidden', !deskActions);
  setBlocked(
    $('verify-source'),
    !paper.observationId || paper.sourceVerified,
    paper.sourceVerified ? 'PAGE-7 is already verified.' : 'Need an OBS receipt from extraction first.',
  );
  setBlocked(
    $('promote-source'),
    !paper.sourceVerified || Boolean(paper.doctrineId),
    paper.doctrineId ? 'Doctrine already promoted.' : 'Verify PAGE-7 before promoting doctrine.',
  );
  setBlocked(
    $('package-packet'),
    vm.next.id !== 'package-packet',
    vm.next.id === 'package-packet' ? '' : vm.next.why,
  );
  setBlocked(
    $('deliver-packet'),
    vm.next.id !== 'deliver-packet',
    vm.next.id === 'deliver-packet' ? '' : vm.next.why,
  );
  const findingId = $('finding-id').value.trim();
  setBlocked(
    $('reject-finding'),
    !paper.submittedFindings?.includes(findingId),
    findingId ? 'That finding id is not on the submitted list.' : 'Enter a submitted finding id first.',
  );
  const requirementButton = $('change-requirement');
  const canChangeRequirement = role === 'hand' && paper.requirementRevision === 'R1';
  requirementButton.classList.toggle('hidden', !canChangeRequirement);
  setBlocked(
    requirementButton,
    vm.next.id !== 'change-requirement',
    vm.next.id === 'change-requirement' ? '' : vm.next.why,
  );

  $('gone-relay').textContent = gone.relayRepair || 'OPEN';
  $('gone-worker').textContent = String(gone.workerReplaced ?? 0);
  $('gone-rejected').textContent = String(gone.findingsRejected ?? 0);
  $('gone-ready').textContent = gone.ready || 'OPEN';

  if (role === 'lead') {
    setBlocked(
      $('go-offline'),
      vm.next.id !== 'go-offline',
      vm.next.id === 'go-offline' ? '' : vm.next.why,
    );
    $('go-offline').classList.toggle('hidden', paper.humanOffline);
    $('return-shift').classList.toggle('hidden', !paper.humanOffline);
    $('sign-relay').classList.toggle('hidden', vm.next.id !== 'sign-relay');
    setBlocked($('sign-relay'), vm.next.id !== 'sign-relay', vm.next.id === 'sign-relay' ? '' : vm.next.why);
  }
  // Desk ledger + WHILE_YOU_WERE_GONE stay behind STATS/DESK toggles (never auto-face).
  if (deskOpen) $('overnight').classList.remove('hidden');
  else $('overnight').classList.add('hidden');
  if (statsOpen) $('desk').classList.remove('hidden');
  else $('desk').classList.add('hidden');
  syncPrimaryCta();
}


$('connect-btn').addEventListener('click', connect);
$('scout-find').addEventListener('click', () => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ t: 'pf_scout', verb: 'find' })));
$('scout-carry').addEventListener('click', () => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ t: 'pf_scout', verb: 'carry' })));
$('extract-page').addEventListener('click', () => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ t: 'pf_extract' })));

$('toggle-more').addEventListener('click', () => setPanelOpen('more', !moreOpen));
$('toggle-stats').addEventListener('click', () => setPanelOpen('stats', !statsOpen));
$('toggle-desk').addEventListener('click', () => setPanelOpen('desk', !deskOpen));

$('primary-cta').addEventListener('click', () => {
  if (!primaryActionId || $('primary-cta').disabled) return;
  const target = $(primaryActionId);
  if (target && !target.disabled) target.click();
});

$('change-requirement').addEventListener('click', async () => {
  try {
    await oneDeskAction('change_requirement', { revision: 'R2', requirement: 'Relay repair must include the revised grounding strap check.' });
    $('change-requirement').classList.add('hidden');
    addLog('Human B changed requirement R1 → R2', 'pass');
  } catch (err) { addLog(`requirement rejected: ${err.message}`, 'reject'); }
});

for (const [id, action, extra] of [
  ['verify-source', 'verify_source', {}],
  ['promote-source', 'promote_source', {}],
  ['package-packet', 'package', { lease: '20m' }],
]) {
  $(id).addEventListener('click', async () => {
    try { await oneDeskAction(action, extra); }
    catch (err) { addLog(`${action.replaceAll('_', ' ')} rejected: ${err.message}`, 'reject'); }
  });
}

$('deliver-packet').addEventListener('click', async () => {
  try {
    const packetId = currentPacketForRevision(paper)?.packetId || '';
    await oneDeskAction('deliver', packetId ? { packetId } : {});
  } catch (err) { addLog(`deliver packet rejected: ${err.message}`, 'reject'); }
});

$('finding-id').addEventListener('input', () => { if (paper) updateUi(); });
$('reject-finding').addEventListener('click', async () => {
  const findingId = $('finding-id').value.trim();
  const reason = $('finding-reason').value;
  try {
    await oneDeskAction('reject_finding', { findingId, reason });
    $('finding-id').value = '';
    updateUi();
  } catch (err) { addLog(`finding rejection rejected: ${err.message}`, 'reject'); }
});

$('go-offline').addEventListener('click', async () => {
  try {
    await rugPost('offline');
    offlineLocal = true;
    socket?.send(JSON.stringify({ t: 'pf_leave' }));
    socket?.close();
    addLog('Human A left. The organism keeps the job.', 'pass');
    updateUi();
  } catch (err) { addLog(`offline failed: ${err.message}`, 'reject'); }
});

$('return-shift').addEventListener('click', async () => {
  try {
    await rugPost('rejoin');
    offlineLocal = false;
    await openFieldSocket();
    await refreshRug();
    addLog('Human A returned. No recap loaded.', 'pass');
    addLog('Open DESK for WHILE YOU WERE GONE when you want the receipt.');
  } catch (err) { addLog(`rejoin failed: ${err.message}`, 'reject'); }
});

$('sign-relay').addEventListener('click', async () => {
  try {
    await rugPost('sign');
    addLog('Human A SIGNED. Relay is real.', 'pass');
  } catch (err) { addLog(`SIGN rejected: ${err.message}`, 'reject'); }
});

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement || e.target?.isContentEditable) return;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)) {
    keys.add(e.key.toLowerCase()); e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); dragging = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) keys.clear(); });
for (const button of document.querySelectorAll('[data-touch-key]')) {
  const key = button.dataset.touchKey;
  const press = (event) => { event.preventDefault(); keys.add(key); button.setPointerCapture?.(event.pointerId); };
  const release = (event) => { event.preventDefault(); keys.delete(key); };
  button.addEventListener('pointerdown', press, { passive: false });
  button.addEventListener('pointerup', release, { passive: false });
  button.addEventListener('pointercancel', release, { passive: false });
  button.addEventListener('pointerleave', release, { passive: false });
}
setInterval(() => {
  if (socket?.readyState !== WebSocket.OPEN || offlineLocal) return;
  const dx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const dy = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  if (dx || dy) socket.send(JSON.stringify({ t: 'pf_input', dx, dy }));
}, 50);

canvas.addEventListener('pointerdown', (e) => { dragging = true; dragX = e.clientX; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  angle += (e.clientX - dragX) * 0.006;
  dragX = e.clientX;
  draw();
});
canvas.addEventListener('pointerup', (e) => { dragging = false; canvas.releasePointerCapture(e.pointerId); });
canvas.addEventListener('pointercancel', () => { dragging = false; });
canvas.addEventListener('wheel', (e) => { zoom = Math.max(.65, Math.min(1.5, zoom - e.deltaY * .0008)); draw(); e.preventDefault(); }, { passive: false });

function draw() {
  if (!paperRenderer) return;
  paperRenderer.draw({ field, paper, gone, role, principal, angle, zoom });
}

// Query parameters can pre-fill a local match without turning configuration into game state.
const q = new URLSearchParams(location.search);
if (q.get('rug')) $('rug-url').value = q.get('rug');
if (q.get('match')) $('match-id').value = q.get('match').toUpperCase();
if (q.get('mesh')) $('mesh-url').value = q.get('mesh');

resize();
addLog('paper world ready');
