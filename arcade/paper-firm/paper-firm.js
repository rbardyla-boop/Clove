const $ = (id) => document.getElementById(id);
const canvas = $('paper-world');
const ctx = canvas.getContext('2d');

const INK = '#245da0';
const RED = '#b53a3a';
const PAPER = '#f5f0df';
const RULE = 'rgba(91,135,176,.22)';
const YELLOW = 'rgba(244,216,80,.42)';

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
let receiptAccepting = false;
let lastHead = '';
let heartbeatTimer = 0;
let snapshotTimer = 0;
let offlineLocal = false;
const keys = new Set();
const log = [];

window.__paperFirmArtGate = Object.freeze({
  ruledPaperAcrossFrame: true,
  twoDirectionHatch: true,
  paperRulesRemainVisibleUnderHatch: true,
  contourWeightVariation: true,
  pbrLighting: false,
  repairUsesTape: true,
  rejectionUsesRedMark: true,
  verificationUsesRedCheck: true,
  ancestryUsesThreads: true,
});

function resize() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}
window.addEventListener('resize', resize);

function addLog(text, kind = '') {
  log.unshift({ text, kind, at: Date.now() });
  if (log.length > 12) log.length = 12;
  $('log-lines').innerHTML = log.slice(0, 8).map((x) => `<div class="log-entry ${x.kind}">${escapeHtml(x.text)}</div>`).join('');
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function config() {
  const match = $('match-id').value.trim().toUpperCase();
  const rug = $('rug-url').value.trim().replace(/\/$/, '');
  let mesh = $('mesh-url').value.trim().replace(/\/$/, '');
  if (!mesh) {
    if (location.hostname === 'clovelearn.io') mesh = 'wss://clovelearn.io';
    else mesh = 'ws://localhost:8787';
  }
  mesh = mesh.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
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
  if (msg.t === 'pf_error') addLog(`field: ${msg.reason}`, 'reject');
}

async function acceptReceipt(receipt) {
  if (role !== 'hand' || !receipt?.receipt_id) return;
  lastReceipt = receipt;
  if (lastAcceptedReceiptId === receipt.receipt_id) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: 'pf_receipt_ack', receipt_id: receipt.receipt_id }));
    return;
  }
  if (receiptAccepting) return;
  receiptAccepting = true;
  try {
    await rugPost('intake_receipt', { receipt });
    lastAcceptedReceiptId = receipt.receipt_id;
    addLog('Desk accepted receipt → OBS', 'pass');
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: 'pf_receipt_ack', receipt_id: receipt.receipt_id }));
  } catch (err) {
    if (err.message === 'receipt_replayed') {
      lastAcceptedReceiptId = receipt.receipt_id;
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: 'pf_receipt_ack', receipt_id: receipt.receipt_id }));
    } else addLog(`receipt rejected: ${err.message}`, 'reject');
  } finally {
    receiptAccepting = false;
  }
}

async function connect() {
  const { match } = config();
  if (!match) { $('connection-status').textContent = 'enter the RUG world code'; return; }
  $('connect-btn').disabled = true;
  try {
    const snap = await rugPost('snapshot');
    principal = snap.me;
    role = snap.role;
    connected = true;
    document.body.dataset.connected = 'true';
    $('connection-status').textContent = `${role === 'lead' ? 'Human A / field lead' : role === 'hand' ? 'Human B / desk lead' : role} · LOCKED`;
    $('field-controls').classList.remove('hidden');
    $('desk').classList.remove('hidden');
    $('event-log').classList.remove('hidden');
    if (role === 'lead') $('human-a-actions').classList.remove('hidden');
    if (role === 'hand') $('human-b-actions').classList.remove('hidden');
    await openFieldSocket();
    startLoops();
    addLog('joined authoritative First Shift', 'pass');
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

function updateUi() {
  $('role-name').textContent = role === 'lead' ? 'HUMAN A — FIELD LEAD' : role === 'hand' ? 'HUMAN B — DESK LEAD' : role.toUpperCase();
  $('principal-id').textContent = principal ? principal.slice(0, 14) : '?';
  if (!paper) return;

  $('desk-obs').textContent = paper.observationId || '—';
  $('desk-verified').textContent = paper.sourceVerified ? '✓ PAGE-7' : '—';
  $('desk-doctrine').textContent = paper.doctrineId || '—';
  $('desk-packet').textContent = paper.currentPacketId || '—';
  $('desk-builder').textContent = paper.builderOperated ? (paper.workerReplacements ? 'replacement working' : 'working') : 'idle';
  $('desk-harness').textContent = paper.harnessPassed ? 'PASS' : 'OPEN';
  $('desk-sign').textContent = paper.complete ? 'SIGNED' : paper.readyToSign ? 'READY' : 'blocked';

  $('gone-relay').textContent = gone.relayRepair || 'OPEN';
  $('gone-worker').textContent = String(gone.workerReplaced ?? 0);
  $('gone-rejected').textContent = String(gone.findingsRejected ?? 0);
  $('gone-ready').textContent = gone.ready || 'OPEN';

  if (role === 'lead') {
    const initialDone = paper.packets.some((p) => p.requirementRevision === 'R1' && p.delivered) && paper.builderOperated;
    $('go-offline').disabled = !initialDone || paper.humanOffline;
    $('go-offline').classList.toggle('hidden', paper.humanOffline || offlineLocal);
    $('return-shift').classList.toggle('hidden', !(paper.humanOffline || offlineLocal));
    $('sign-relay').classList.toggle('hidden', !paper.readyToSign || paper.complete);
    $('overnight').classList.toggle('hidden', !paper.humanOffline && !paper.rejoinedAtSeq && !paper.readyToSign);
  } else if (role === 'hand') {
    $('overnight').classList.remove('hidden');
  }
}

$('connect-btn').addEventListener('click', connect);
$('scout-find').addEventListener('click', () => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ t: 'pf_scout', verb: 'find' })));
$('scout-carry').addEventListener('click', () => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ t: 'pf_scout', verb: 'carry' })));
$('extract-page').addEventListener('click', () => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ t: 'pf_extract' })));

$('change-requirement').addEventListener('click', async () => {
  try {
    await oneDeskAction('change_requirement', { revision: 'R2', requirement: 'Relay repair must include the revised grounding strap check.' });
    $('change-requirement').classList.add('hidden');
    addLog('Human B changed requirement R1 → R2', 'pass');
  } catch (err) { addLog(`requirement rejected: ${err.message}`, 'reject'); }
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
    $('overnight').classList.remove('hidden');
  } catch (err) { addLog(`rejoin failed: ${err.message}`, 'reject'); }
});

$('sign-relay').addEventListener('click', async () => {
  try {
    await rugPost('sign');
    addLog('Human A SIGNED. Relay is real.', 'pass');
  } catch (err) { addLog(`SIGN rejected: ${err.message}`, 'reject'); }
});

window.addEventListener('keydown', (e) => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)) {
    keys.add(e.key.toLowerCase()); e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
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
canvas.addEventListener('wheel', (e) => { zoom = Math.max(.65, Math.min(1.5, zoom - e.deltaY * .0008)); draw(); e.preventDefault(); }, { passive: false });

function project(x, y, z = 0) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const dx = x - 500, dy = y - 350;
  const c = Math.cos(angle), s = Math.sin(angle);
  const rx = dx * c - dy * s;
  const ry = dx * s + dy * c;
  const scale = Math.min(w / 1180, h / 760) * zoom;
  return { x: w * .48 + rx * scale, y: h * .56 + ry * scale * .44 - z * scale * .82, depth: ry };
}

function paperBackground() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  for (let y = 18; y < h; y += 29) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(185,72,72,.16)';
  ctx.beginPath(); ctx.moveTo(58, 0); ctx.lineTo(58, h); ctx.stroke();
  // barely-there paper fibers
  ctx.strokeStyle = 'rgba(120,105,72,.035)';
  for (let i = 0; i < 90; i++) {
    const x = (i * 83) % Math.max(1, w), y = (i * 137) % Math.max(1, h);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8 + (i % 7), y + ((i % 3) - 1)); ctx.stroke();
  }
}

function polygon(points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function hatchFace(points, density = 7, alpha = .44) {
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) + 80;
  ctx.save();
  polygon(points); ctx.clip();
  ctx.strokeStyle = `rgba(36,93,160,${alpha})`;
  ctx.lineWidth = .75;
  for (let x = minX - span; x < maxX + span; x += density) {
    ctx.beginPath(); ctx.moveTo(x, maxY + 30); ctx.lineTo(x + span, minY - 30); ctx.stroke();
  }
  ctx.strokeStyle = `rgba(36,93,160,${alpha * .65})`;
  for (let x = minX - span; x < maxX + span; x += density + 2) {
    ctx.beginPath(); ctx.moveTo(x, minY - 30); ctx.lineTo(x + span, maxY + 30); ctx.stroke();
  }
  ctx.restore();
}

function inkOutline(points, width = 1.5) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  polygon(points); ctx.stroke();
  ctx.save(); ctx.translate(.55, -.35); ctx.globalAlpha = .34; ctx.lineWidth = Math.max(.6, width * .6); polygon(points); ctx.stroke(); ctx.restore();
}

function drawBox(x, y, w, h, z, label, emphasis = 0) {
  const a = project(x, y, 0), b = project(x + w, y, 0), c = project(x + w, y + h, 0), d = project(x, y + h, 0);
  const A = project(x, y, z), B = project(x + w, y, z), C = project(x + w, y + h, z), D = project(x, y + h, z);
  const depth = (a.depth + c.depth) / 2;
  const fade = Math.max(.24, Math.min(.58, .48 - depth / 2400));
  const density = Math.max(5, 8 + depth / 800);
  const faces = [[d,c,C,D], [b,c,C,B], [A,B,C,D]];
  for (const f of faces) { hatchFace(f, density, fade + emphasis); inkOutline(f, f === faces[2] ? 1.7 : 1.25); }
  const t = project(x + w * .5, y + h * .5, z + 8);
  ctx.fillStyle = INK; ctx.font = `700 ${Math.max(11, 14 * zoom)}px "Comic Sans MS", cursive`; ctx.textAlign = 'center';
  ctx.fillText(label, t.x, t.y);
}

function drawZone(zone) {
  const p1 = project(zone.x, zone.y), p2 = project(zone.x + zone.w, zone.y), p3 = project(zone.x + zone.w, zone.y + zone.h), p4 = project(zone.x, zone.y + zone.h);
  ctx.save(); ctx.setLineDash([7, 5]); ctx.strokeStyle = 'rgba(36,93,160,.55)'; ctx.lineWidth = 1.2; polygon([p1,p2,p3,p4]); ctx.stroke(); ctx.restore();
}

function drawStain(zone) {
  const center = project(zone.x + zone.w / 2, zone.y + zone.h / 2);
  ctx.save(); ctx.strokeStyle = 'rgba(36,93,160,.34)'; ctx.lineWidth = 2;
  for (let i = 0; i < 15; i++) {
    const r = (18 + i * 4) * zoom;
    ctx.beginPath();
    for (let k = 0; k <= 20; k++) {
      const a = k / 20 * Math.PI * 2;
      const rr = r * (1 + .16 * Math.sin(a * 3 + i));
      const x = center.x + Math.cos(a) * rr * 1.3, y = center.y + Math.sin(a) * rr * .55;
      if (!k) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function stickPerson(p, label, hue = 0) {
  const base = project(p.x, p.y, 0); const top = project(p.x, p.y, 58);
  ctx.save(); ctx.strokeStyle = INK; ctx.fillStyle = PAPER; ctx.lineWidth = 2;
  const headY = top.y + 8; ctx.beginPath(); ctx.arc(top.x, headY, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(top.x, headY + 6); ctx.lineTo(base.x, base.y - 11); ctx.moveTo(top.x, headY + 17); ctx.lineTo(top.x - 10, headY + 29); ctx.moveTo(top.x, headY + 17); ctx.lineTo(top.x + 10, headY + 29); ctx.moveTo(base.x, base.y - 11); ctx.lineTo(base.x - 8, base.y); ctx.moveTo(base.x, base.y - 11); ctx.lineTo(base.x + 8, base.y); ctx.stroke();
  ctx.font = '700 10px "Comic Sans MS", cursive'; ctx.textAlign = 'center'; ctx.fillStyle = INK; ctx.fillText(label, top.x, headY - 10);
  ctx.restore();
}

function drawScout(sc) {
  if (!sc) return;
  const p = { x: sc.x, y: sc.y };
  stickPerson(p, 'SCOUT');
  const eye = project(p.x + 12, p.y, 42);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(eye.x, eye.y, 9, 4); ctx.strokeRect(eye.x + 10, eye.y, 9, 4);
}

function drawPage(pg) {
  if (!pg || pg.phase === 'extracted') return;
  const p = project(pg.x, pg.y, 6);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-.12); ctx.fillStyle = 'rgba(245,240,223,.82)'; ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.fillRect(-12,-9,24,18); ctx.strokeRect(-12,-9,24,18); ctx.beginPath(); ctx.moveTo(-8,-4); ctx.lineTo(8,-4); ctx.moveTo(-8,1); ctx.lineTo(7,1); ctx.moveTo(-8,6); ctx.lineTo(4,6); ctx.stroke(); ctx.restore();
}

function redCheck(x, y) { ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x - 2, y + 7); ctx.lineTo(x + 11, y - 9); ctx.stroke(); ctx.restore(); }
function redX(x, y) { ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x-8,y-8); ctx.lineTo(x+8,y+8); ctx.moveTo(x+8,y-8); ctx.lineTo(x-8,y+8); ctx.stroke(); ctx.restore(); }

function tapeMark(x, y, rotation = -.15) {
  ctx.save(); ctx.translate(x,y); ctx.rotate(rotation); ctx.fillStyle = 'rgba(220,204,157,.55)'; ctx.strokeStyle = 'rgba(135,112,70,.35)'; ctx.fillRect(-22,-6,44,12); ctx.strokeRect(-22,-6,44,12); ctx.restore();
}

function ancestryThread(from, to) {
  ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 1.4; ctx.setLineDash([5,4]); ctx.beginPath(); ctx.moveTo(from.x, from.y); const mx = (from.x+to.x)/2; ctx.bezierCurveTo(mx, from.y-45, mx, to.y+45, to.x, to.y); ctx.stroke(); ctx.setLineDash([]); const a = Math.atan2(to.y-from.y,to.x-from.x); ctx.beginPath(); ctx.moveTo(to.x,to.y); ctx.lineTo(to.x-9*Math.cos(a-.5),to.y-9*Math.sin(a-.5)); ctx.moveTo(to.x,to.y); ctx.lineTo(to.x-9*Math.cos(a+.5),to.y-9*Math.sin(a+.5)); ctx.stroke(); ctx.restore();
}

function draw() {
  if (!ctx) return;
  paperBackground();
  const f = field || {
    zones: [
      {id:'DESK',x:70,y:470,w:240,h:150}, {id:'STAIN',x:390,y:70,w:220,h:220}, {id:'ARCHIVE',x:690,y:70,w:230,h:210},
    ],
    relay: {x:715,y:455,w:160,h:170}, players: [], scout: {phase:'idle',x:500,y:170}, page: {id:'PAGE-7',phase:'in_stain',x:500,y:170},
  };
  const desk = f.zones.find((z) => z.id === 'DESK');
  const stain = f.zones.find((z) => z.id === 'STAIN');
  const archive = f.zones.find((z) => z.id === 'ARCHIVE');
  if (paper?.complete && f.relay) {
    const a = project(f.relay.x - 20, f.relay.y - 20), b = project(f.relay.x + f.relay.w + 20, f.relay.y + f.relay.h + 20);
    ctx.save(); ctx.strokeStyle = YELLOW; ctx.lineWidth = 24; ctx.globalAlpha = .9; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); ctx.restore();
  }
  [desk, stain, archive].filter(Boolean).forEach(drawZone);
  if (stain) drawStain(stain);
  if (desk) drawBox(desk.x + 35, desk.y + 35, desk.w - 70, desk.h - 60, 58, 'DESK', .02);
  if (archive) {
    drawBox(archive.x + 18, archive.y + 28, 70, archive.h - 60, 88, 'FILES', .02);
    drawBox(archive.x + 130, archive.y + 28, 70, archive.h - 60, 88, 'SOURCE', .02);
  }
  if (f.relay) {
    drawBox(f.relay.x + 34, f.relay.y + 55, f.relay.w - 68, f.relay.h - 75, 130, 'RELAY', .06);
    const mast = project(f.relay.x + f.relay.w/2, f.relay.y + f.relay.h/2, 220);
    const foot = project(f.relay.x + f.relay.w/2, f.relay.y + f.relay.h/2, 125);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(foot.x,foot.y); ctx.lineTo(mast.x,mast.y); ctx.stroke();
    if (paper?.harnessPassed) tapeMark((foot.x+mast.x)/2, (foot.y+mast.y)/2);
  }
  drawScout(f.scout); drawPage(f.page);
  for (const p of f.players || []) stickPerson(p, p.id === principal ? (role === 'lead' ? 'YOU · A' : 'YOU · B') : 'HUMAN');

  if (paper?.sourceVerified && archive) { const p = project(archive.x + archive.w - 22, archive.y + 18, 95); redCheck(p.x,p.y); }
  const rejected = gone.findingsRejected || 0;
  if (rejected && desk) { const p = project(desk.x + 28, desk.y + 25, 75); redX(p.x,p.y); if (rejected > 1) redX(p.x+18,p.y+7); }
  if (paper?.ancestryRetrieved && archive && desk) {
    ancestryThread(project(archive.x+archive.w/2,archive.y+archive.h/2,100), project(desk.x+desk.w/2,desk.y+desk.h/2,70));
  }
  if (paper?.harnessPassed && f.relay) { const p = project(f.relay.x+f.relay.w-18,f.relay.y+18,150); redCheck(p.x,p.y); }

  ctx.fillStyle = INK; ctx.font = '700 12px "Comic Sans MS", cursive'; ctx.textAlign = 'left';
  ctx.fillText('ruled paper = world · blue pen = matter · red pen = authority', 76, canvas.clientHeight - 12);
}

// Query parameters can pre-fill a local match without turning configuration into game state.
const q = new URLSearchParams(location.search);
if (q.get('rug')) $('rug-url').value = q.get('rug');
if (q.get('match')) $('match-id').value = q.get('match').toUpperCase();
if (q.get('mesh')) $('mesh-url').value = q.get('mesh');

resize();
addLog('paper world ready');
