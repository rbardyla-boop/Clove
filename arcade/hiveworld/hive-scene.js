import { REGIONS, REGION_GRAPH, FACTIONS, GUIDES, BUILD_COST, COORDINATION_SIGNALS, SIGNAL_TTL_TICKS, MAX_REGROUPS_PER_CYCLE } from './hive-world.mjs';
import { resolveHiveWsUrl, createBrowserIdentity, HiveNet } from './hive-net.js';

const canvas = document.getElementById('hiveCanvas');
const ctx = canvas.getContext('2d');
const identity = createBrowserIdentity();
const params = new URLSearchParams(location.search);

const ui = {
  connectionDot: document.getElementById('connectionDot'),
  connectionText: document.getElementById('connectionText'),
  cycleText: document.getElementById('cycleText'),
  nextTitle: document.getElementById('nextTitle'),
  nextHint: document.getElementById('nextHint'),
  nextActionBtn: document.getElementById('nextActionBtn'),
  lastReading: document.getElementById('lastReading'),
  relayMeterFill: document.getElementById('relayMeterFill'),
  relayStatus: document.getElementById('relayStatus'),
  missionProgress: document.getElementById('missionProgress'),
  missionTitle: document.getElementById('missionTitle'),
  missionObjective: document.getElementById('missionObjective'),
  missionSteps: document.getElementById('missionSteps'),
  threadStatus: document.getElementById('threadStatus'),
  threadHint: document.getElementById('threadHint'),
  signalBoard: document.getElementById('signalBoard'),
  threadReceipts: document.getElementById('threadReceipts'),
  focusValue: document.getElementById('focusValue'),
  playerName: document.getElementById('playerName'),
  factionName: document.getElementById('factionName'),
  responsibilityName: document.getElementById('responsibilityName'),
  earnedValue: document.getElementById('earnedValue'),
  observationCount: document.getElementById('observationCount'),
  workCount: document.getElementById('workCount'),
  regionTitle: document.getElementById('regionTitle'),
  regionBlurb: document.getElementById('regionBlurb'),
  guideName: document.getElementById('guideName'),
  guideLine: document.getElementById('guideLine'),
  regionList: document.getElementById('regionList'),
  lawBoard: document.getElementById('lawBoard'),
  evidenceList: document.getElementById('evidenceList'),
  eventList: document.getElementById('eventList'),
  archiveList: document.getElementById('archiveList'),
  currentRegion: document.getElementById('currentRegion'),
  playerCount: document.getElementById('playerCount'),
  loopGuide: document.getElementById('loopGuide'),
  consoleInstruction: document.getElementById('consoleInstruction'),
  actionMessage: document.getElementById('actionMessage'),
  toast: document.getElementById('toast'),
  technicalDialog: document.getElementById('technicalDialog'),
  technicalToggle: document.getElementById('technicalToggle'),
  technicalClose: document.getElementById('technicalClose'),
  technicalAuthority: document.getElementById('technicalAuthority'),
  technicalRoot: document.getElementById('technicalRoot'),
};

const actionButtons = {
  observe: document.getElementById('observeBtn'),
  hypothesize: document.getElementById('hypothesizeBtn'),
  probe: document.getElementById('probeBtn'),
  share: document.getElementById('shareBtn'),
  build: document.getElementById('buildBtn'),
  authorize: document.getElementById('authorizeBtn'),
  repair: document.getElementById('repairBtn'),
  nextCycle: document.getElementById('nextCycleBtn'),
};

const scene = {
  width: 0,
  height: 0,
  dpr: 1,
  snapshot: null,
  selectedLaw: 'phase',
  selectedGuess: null,
  latestHypothesisId: null,
  latestItemId: null,
  nextAction: null,
  status: 'connecting',
  toastTimer: null,
  keys: new Set(),
  touch: null,
  startedAt: performance.now(),
};

const factionMap = Object.fromEntries(FACTIONS.map((faction) => [faction.id, faction]));
const regionMap = Object.fromEntries(REGIONS.map((region) => [region.id, region]));

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function currentSelf() { return scene.snapshot?.self || null; }
function currentRegion() { return regionMap[currentSelf()?.regionId] || regionMap['hive-hub']; }

const LOOP_STEPS = Object.freeze([
  ['observe', 'Observe'],
  ['hypothesize', 'Hypothesize'],
  ['probe', 'Probe'],
  ['regroup', 'Regroup'],
  ['share', 'Share'],
  ['build', 'Build'],
  ['authorize', 'Authorize'],
  ['repair', 'Repair'],
  ['return', 'Return'],
]);

function witnessState(snapshot) {
  const self = snapshot?.self;
  const evidence = self?.evidence || [];
  const claims = self?.claims || [];
  const sharedIds = new Set((snapshot?.evidence || []).map((item) => item.id));
  const observations = evidence.filter((item) => item.kind === 'observation');
  const probes = evidence.filter((item) => item.kind === 'probe');
  const latestObservation = observations.at(-1) || null;
  const latestProbe = probes.at(-1) || null;
  const latestClaim = claims.at(-1) || null;
  const selectedClaim = [...claims].reverse().find((claim) => claim.lawId === scene.selectedLaw) || latestClaim;
  const proofShared = !!selectedClaim?.evidenceIds?.some((id) => sharedIds.has(id) && probes.some((probe) => probe.id === id && probe.result === 'supported'));
  const selectedClaimReadyToShare = !!selectedClaim && (!selectedClaim.shared || !proofShared);
  // Sharing is a two-part handoff: the tested probe, then its claim. Do not
  // keep steering the player back to an optional raw observation after that
  // pair is public; the relay only needs the claim + supporting probe.
  const shareCandidates = latestProbe || latestClaim ? [latestProbe, latestClaim] : [latestObservation];
  const latestUnshared = shareCandidates.find((item) => item && !sharedIds.has(item.id) && !item.shared);
  const authorizedCount = Object.values(snapshot?.relay?.authorized || {}).filter(Boolean).length;
  return {
    self, evidence, claims, observations, probes, latestObservation, latestProbe, latestClaim,
    selectedClaim, proofShared, selectedClaimReadyToShare, latestUnshared, sharedIds, authorizedCount,
    regroupCount: Number.isInteger(self?.regroupCount) ? self.regroupCount : 0,
  };
}

function guideStep(snapshot) {
  const state = witnessState(snapshot);
  if (!state.self) return 'observe';
  if (snapshot.phase === 'sealed') return 'return';
  if (!state.observations.length) return 'observe';
  const needsProbe = !state.selectedClaim || state.selectedClaim.status === 'untested' || state.selectedClaim.status === 'disproved';
  if (needsProbe && (state.self.focus ?? 0) < 1 && state.regroupCount < MAX_REGROUPS_PER_CYCLE) return 'regroup';
  if (!state.selectedClaim || state.selectedClaim.status === 'disproved') return 'hypothesize';
  if (state.selectedClaim.status === 'untested') return 'probe';
  if (state.selectedClaimReadyToShare) return 'share';
  const hasWork = (snapshot.works || []).some((work) => work.actorId === state.self?.id);
  if (state.proofShared && !hasWork && (state.self?.focus ?? 0) >= BUILD_COST) return 'build';
  if (state.authorizedCount < 3) return 'authorize';
  return 'repair';
}

function renderLoopGuide(snapshot) {
  const current = guideStep(snapshot);
  const order = LOOP_STEPS.map(([id]) => id);
  const currentIndex = order.indexOf(current);
  ui.loopGuide.innerHTML = LOOP_STEPS.map(([id, label], index) => {
    const done = id === 'return' ? snapshot.phase === 'sealed' : index < currentIndex;
    const active = id === current;
    const state = done ? 'done' : active ? 'current' : '';
    const marker = done ? '✓' : String(index + 1);
    return `<span class="loop-step ${state}" data-loop-step="${id}"><span class="loop-mark">${marker}</span>${label}</span>`;
  }).join('');
}

function renderLastReading(snapshot) {
  const state = witnessState(snapshot);
  if (!state.latestObservation && !state.latestProbe) {
    ui.lastReading.textContent = 'No reading yet. Your first observation will appear here.';
    return;
  }
  if (state.latestProbe) {
    const probe = state.latestProbe;
    const result = probe.result === 'supported' ? 'The claim held.' : 'The claim failed; try another reading.';
    const visibility = state.sharedIds.has(probe.id) ? 'Shared with the Hive.' : 'Private until you share it.';
    ui.lastReading.textContent = `Latest probe · ${probe.lawId} → ${probe.reading} · ${result} ${visibility}`;
    return;
  }
  const reading = state.latestObservation;
  const visibility = state.sharedIds.has(reading.id) ? 'Shared with the Hive.' : 'Private until you share it.';
  ui.lastReading.textContent = `Latest reading · ${reading.regionName} returned ${reading.reading} (${reading.confidence}). ${visibility}`;
}

function renderNextStep(snapshot) {
  const state = witnessState(snapshot);
  const button = ui.nextActionBtn;
  let title = 'Join the frontier.';
  let hint = 'Enter as a witness to begin.';
  let action = { type: 'none' };
  if (state.self && snapshot.phase === 'sealed') {
    title = 'Carry the question forward.';
    hint = 'Read the archived consequence, then begin a new cycle when you are ready.';
    action = { type: 'next_cycle', label: 'Begin next cycle' };
  } else if (state.self && !state.observations.length) {
    if (state.self.regionId === 'hive-hub') {
      title = 'Reach the disturbance.';
      hint = 'Travel to Hollow Relay. That is where the relay answers twice.';
      action = { type: 'travel', regionId: 'hollow-relay', label: 'Travel to Hollow Relay' };
    } else {
      title = 'Take a reading.';
      hint = 'Observe the region before deciding what its signal means.';
      action = { type: 'observe', label: 'Observe this region' };
    }
  } else if (state.self && (state.self.focus ?? 0) < 1 && state.regroupCount < MAX_REGROUPS_PER_CYCLE
    && (!state.selectedClaim || state.selectedClaim.status === 'untested' || state.selectedClaim.status === 'disproved')) {
    if (state.self.regionId !== 'hive-hub') {
      title = 'Regroup your attention.';
      hint = 'Your Focus is spent. Return to Clove Hive; a bounded regroup can recover three Focus this cycle.';
      action = { type: 'travel', regionId: 'hive-hub', label: 'Return to Clove Hive' };
    } else {
      title = 'Regroup your attention.';
      hint = `Your Focus is spent. Recover three Focus at the Hive (${state.regroupCount}/${MAX_REGROUPS_PER_CYCLE} regroups used this cycle).`;
      action = { type: 'regroup', label: 'Regroup at Clove Hive · +3 Focus' };
    }
  } else if (state.self && (!state.selectedClaim || state.selectedClaim.status === 'disproved')) {
    title = state.selectedClaim?.status === 'disproved' ? 'Your claim was challenged.' : 'Name what you saw.';
    hint = state.selectedClaim?.status === 'disproved'
      ? 'Choose another visible reading. A failed probe is useful evidence, not a dead end.'
      : 'Select the law your reading touches, choose one visible option, then form a hypothesis.';
    action = { type: 'choose', label: 'Choose a reading below' };
  } else if (state.self && state.selectedClaim?.status === 'untested') {
    title = 'Test your claim.';
    hint = 'A probe costs one Focus and can support or disprove what you think is true.';
    action = { type: 'probe', hypothesisId: state.selectedClaim.id, label: 'Risk a probe · −1 Focus' };
  } else if (state.self && state.selectedClaimReadyToShare) {
    title = 'Let the Hive see it.';
    hint = 'Share the tested claim and its proof. Sharing creates a public trail; it does not create authority by itself.';
    action = { type: 'share', itemId: state.latestUnshared?.id || null, label: state.latestUnshared ? 'Share latest evidence' : 'Share evidence' };
  } else if (state.self && state.proofShared && !(snapshot.works || []).some((work) => work.actorId === state.self.id)
    && (state.self.focus ?? 0) >= BUILD_COST) {
    title = 'Leave a mark behind.';
    hint = 'Spend two Focus to build a public field beacon. It changes the place for every witness, but it never buys authority.';
    action = { type: 'build', label: 'Build a field beacon · −2 Focus' };
  } else if (state.self && state.authorizedCount < 3 && state.self.regionId !== 'hollow-relay') {
    title = 'Bring evidence to the relay.';
    hint = 'Travel to Hollow Relay, where the consequence will land.';
    action = { type: 'travel', regionId: 'hollow-relay', label: 'Travel to Hollow Relay' };
  } else if (state.self && state.authorizedCount < 3) {
    title = 'Ask for authority.';
    hint = `Select an unmarked law, then authorize it here. ${state.authorizedCount}/3 laws are ready.`;
    action = { type: 'authorize', hypothesisId: state.selectedClaim?.id || null, label: 'Authorize selected law' };
  } else if (state.self) {
    title = 'Make the repair hold.';
    hint = 'All three laws are current. Repair the relay and leave the next question behind.';
    action = { type: 'repair', label: 'Repair the relay' };
  }
  ui.nextTitle.textContent = title;
  ui.nextHint.textContent = hint;
  const instructions = {
    observe: 'Start with a reading. Select a region, then observe what the frontier returns.',
    travel: 'Choose a named region to travel there. The map keeps routes bounded; the relay is the place where authority lands.',
    choose: 'Select one law card and one reading. Your choice becomes a hypothesis you can test.',
    probe: 'Your selected claim is untested. Risk one Focus to learn whether it survives contact with the world.',
    regroup: 'Focus is finite, not fatal. Return to Clove Hive to recover a bounded amount before testing again.',
    share: 'Share the latest private trace. A claim needs its supporting probe in the public record before authority can follow.',
    build: 'A supported, shared proof can become a public field beacon. This is optional power, never authority.',
    authorize: 'Choose an unmarked law card, then authorize it at Hollow Relay. The Hive needs all three laws.',
    repair: 'All three laws are current. Repair the relay to seal this cycle and write the next question.',
    next_cycle: 'The archive holds what changed. Begin the next cycle when you are ready to ask a new question.',
    none: 'Waiting for a witness identity.',
  };
  ui.consoleInstruction.textContent = instructions[action.type] || instructions.none;
  button.textContent = action.label || 'Waiting for a witness';
  button.disabled = !state.self || action.type === 'none' || (action.type === 'share' && !action.itemId) || (action.type === 'authorize' && !action.hypothesisId);
  button.title = button.disabled ? 'Complete the current field step first.' : '';
  scene.nextAction = action;
}

function renderMission(snapshot) {
  const mission = snapshot?.mission;
  if (!mission) return;
  const completed = mission.steps.filter((step) => step.status === 'complete').length;
  ui.missionProgress.textContent = `${completed}/${mission.steps.length}`;
  ui.missionTitle.textContent = mission.title;
  ui.missionObjective.textContent = mission.objective;
  ui.missionSteps.innerHTML = mission.steps.map((step, index) => `<div class="mission-step ${step.status}" title="${escapeHtml(step.detail)}"><span>${step.status === 'complete' ? '✓' : step.status === 'current' ? '→' : '·'} ${escapeHtml(step.label)}</span><small>${index + 1}</small></div>`).join('');
}

function renderThread(snapshot) {
  const expedition = snapshot?.expedition || { phase: 'open', resonance: 0, signals: [], receipts: [] };
  const self = currentSelf();
  const atRelay = self?.regionId === 'hollow-relay';
  const signalCount = Number.isInteger(self?.signalCount) ? self.signalCount : 0;
  const resonant = expedition.resonance > 0;
  ui.threadStatus.textContent = resonant ? 'resonant · 2 witnesses' : `${Math.min(1, expedition.signals.length)} witness${expedition.signals.length === 1 ? '' : 'es'} listening`;
  ui.threadHint.textContent = resonant
    ? 'The thread is carrying two witnesses. Its receipt will change the next question.'
    : atRelay
      ? `Choose a signal to make your presence legible. Another witness has ${SIGNAL_TTL_TICKS} ticks to answer (${signalCount}/3 used).`
      : 'Reach Hollow Relay. Six short signals replace open chat; a second witness can answer your trace.';
  ui.signalBoard.innerHTML = COORDINATION_SIGNALS.map((signal) => `<button class="signal-choice" type="button" data-signal="${signal.id}" style="--accent:${signal.accent}" ${!atRelay || signalCount >= 3 || expedition.phase === 'complete' ? 'disabled' : ''} title="${escapeHtml(signal.verb)}">${escapeHtml(signal.label)}</button>`).join('');
  ui.signalBoard.querySelectorAll('[data-signal]').forEach((button) => button.addEventListener('click', () => net.signal(button.dataset.signal)));
  const receipts = expedition.receipts || [];
  ui.threadReceipts.innerHTML = receipts.length
    ? receipts.slice().reverse().slice(0, 2).map((receipt) => `<div class="thread-receipt"><strong>RESONANCE RECEIPT</strong><span>${escapeHtml(receipt.firstWitness)} + ${escapeHtml(receipt.secondWitness)} · ${escapeHtml(receipt.firstSignal)} / ${escapeHtml(receipt.secondSignal)}</span></div>`).join('')
    : '<span class="thread-empty">No second witness has answered this cycle.</span>';
}

function setStatus(status) {
  scene.status = status;
  const labels = {
    connecting: 'connecting to the frontier',
    syncing: 'syncing the frontier',
    live: 'live shared frontier',
    preview: 'local preview · not shared',
    offline: 'frontier unavailable',
  };
  ui.connectionText.textContent = labels[status] || status;
  ui.connectionDot.className = `connection-dot ${status === 'live' ? 'live' : status === 'preview' ? 'preview' : status === 'offline' ? 'error' : ''}`;
  ui.technicalAuthority.textContent = status === 'live' ? 'live Durable Object room' : status === 'preview' ? 'local browser preview' : labels[status] || status;
}

function showMessage(message, tone = 'normal') {
  ui.actionMessage.textContent = message || '';
  ui.actionMessage.style.color = tone === 'error' ? 'var(--pink)' : tone === 'good' ? 'var(--mint)' : '';
  if (!message) return;
  clearTimeout(scene.toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  scene.toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 3100);
}

function resize() {
  scene.dpr = Math.min(2, window.devicePixelRatio || 1);
  scene.width = window.innerWidth;
  scene.height = window.innerHeight;
  canvas.width = Math.floor(scene.width * scene.dpr);
  canvas.height = Math.floor(scene.height * scene.dpr);
  canvas.style.width = `${scene.width}px`;
  canvas.style.height = `${scene.height}px`;
}

function worldToScreen(x, y) {
  const self = currentSelf();
  const anchor = self || { x: 900, y: 500 };
  const zoom = Math.max(.53, Math.min(1.02, Math.min(scene.width / 1080, scene.height / 720)));
  const camX = Math.max(420, Math.min(1380, anchor.x));
  const camY = Math.max(300, Math.min(700, anchor.y));
  return { x: (x - camX) * zoom + scene.width / 2, y: (y - camY) * zoom + scene.height / 2, zoom };
}

function drawRoundedRect(x, y, w, h, r, fill, stroke = null, line = 1) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); }
}

function glowCircle(x, y, radius, color, alpha = .6) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`);
  gradient.addColorStop(.42, `${color}${Math.round(alpha * 90).toString(16).padStart(2, '0')}`);
  gradient.addColorStop(1, `${color}00`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function polygon(points, fill, stroke = null, line = 1) {
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1]));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); }
}

function line(points, stroke, width = 1, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1]));
  ctx.stroke();
  ctx.restore();
}

function drawStars(time) {
  ctx.fillStyle = '#041017';
  ctx.fillRect(0, 0, scene.width, scene.height);
  const gradient = ctx.createLinearGradient(0, 0, 0, scene.height);
  gradient.addColorStop(0, '#061924');
  gradient.addColorStop(1, '#02090f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, scene.width, scene.height);
  for (let i = 0; i < 120; i += 1) {
    const x = (i * 173.17 + 41) % scene.width;
    const y = (i * 97.31 + 23) % scene.height;
    const pulse = .25 + ((Math.sin(time * .0007 + i) + 1) * .18);
    ctx.fillStyle = `rgba(181,235,224,${pulse})`;
    ctx.fillRect(x, y, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
  }
  const horizon = ctx.createLinearGradient(0, scene.height * .25, 0, scene.height);
  horizon.addColorStop(0, 'rgba(20,81,87,0)');
  horizon.addColorStop(1, 'rgba(11,50,52,.24)');
  ctx.fillStyle = horizon;
  ctx.fillRect(0, 0, scene.width, scene.height);
}

function drawWorldPaths(time) {
  const points = Object.fromEntries(REGIONS.map((r) => [r.id, worldToScreen(r.center.x, r.center.y)]));
  for (const [from, targets] of Object.entries(REGION_GRAPH)) {
    for (const to of targets) {
      if (from > to) continue;
      const a = points[from];
      const b = points[to];
      const bend = Math.sin(time * .00035 + a.x) * 10;
      ctx.save();
      ctx.setLineDash([3, 12]);
      ctx.lineDashOffset = -time * .018;
      line([[a.x, a.y], [(a.x + b.x) / 2 + bend, (a.y + b.y) / 2 - bend], [b.x, b.y]], '#6aa8a5', 1, .28);
      ctx.restore();
      glowCircle((a.x + b.x) / 2, (a.y + b.y) / 2, 18, '#7de7ff', .12);
    }
  }
}

function regionFrame(r, time) {
  const topLeft = worldToScreen(r.bounds.x, r.bounds.y);
  const bottomRight = worldToScreen(r.bounds.x + r.bounds.w, r.bounds.y + r.bounds.h);
  const x = topLeft.x; const y = topLeft.y;
  const w = bottomRight.x - topLeft.x; const h = bottomRight.y - topLeft.y;
  ctx.save();
  ctx.globalAlpha = .92;
  drawRoundedRect(x, y, w, h, 30, 'rgba(5,19,25,.58)', `${r.accent}52`, 1.4);
  ctx.globalAlpha = .22;
  for (let i = 0; i < 6; i += 1) {
    const py = y + ((i + 1) / 7) * h + Math.sin(time * .0003 + i) * 4;
    line([[x + 12, py], [x + w - 12, py + Math.sin(i) * 8]], r.accent, 1, .42);
  }
  ctx.restore();
}

function drawHub(r, time) {
  const p = worldToScreen(r.center.x, r.center.y); const z = p.zoom;
  glowCircle(p.x, p.y, 190 * z, '#ffe09a', .12);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.sin(time * .00015) * .02);
  ctx.strokeStyle = '#ffe09a'; ctx.lineWidth = 2;
  ctx.globalAlpha = .55;
  ctx.beginPath(); ctx.arc(0, 0, 124 * z, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = .22;
  ctx.beginPath(); ctx.arc(0, 0, 160 * z, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = .65;
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2 + time * .00008;
    const x = Math.cos(angle) * 95 * z; const y = Math.sin(angle) * 95 * z;
    polygon([[x, y - 12 * z], [x + 11 * z, y], [x, y + 12 * z], [x - 11 * z, y]], 'rgba(255,224,154,.2)', '#ffe09a', 1);
  }
  ctx.fillStyle = '#122d2c'; ctx.beginPath(); ctx.arc(0, 0, 66 * z, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffe09a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 66 * z, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawOrchard(r, time) {
  const p = worldToScreen(r.center.x, r.center.y); const z = p.zoom;
  glowCircle(p.x, p.y, 200 * z, '#7de7ff', .12);
  for (let i = 0; i < 14; i += 1) {
    const angle = i * 2.41;
    const radius = (38 + (i % 4) * 29) * z;
    const x = p.x + Math.cos(angle) * radius;
    const y = p.y + Math.sin(angle) * radius * .66;
    const sway = Math.sin(time * .001 + i) * 4 * z;
    line([[x, y + 31 * z], [x + sway, y + 9 * z], [x - 7 * z, y - 13 * z]], '#436c71', 4 * z, .8);
    for (let j = 0; j < 4; j += 1) {
      const lx = x + sway + Math.cos(j * 1.7 + i) * 15 * z;
      const ly = y - 12 * z + Math.sin(j * 1.9 + i) * 13 * z;
      glowCircle(lx, ly, 21 * z, '#7de7ff', .12);
      polygon([[lx, ly - 12 * z], [lx + 8 * z, ly - 2 * z], [lx + 4 * z, ly + 13 * z], [lx - 7 * z, ly + 7 * z], [lx - 9 * z, ly - 5 * z]], 'rgba(125,231,255,.13)', '#7de7ff', 1);
    }
  }
}

function drawFen(r, time) {
  const p = worldToScreen(r.center.x, r.center.y); const z = p.zoom;
  glowCircle(p.x, p.y, 220 * z, '#8ff3c6', .1);
  for (let i = 0; i < 8; i += 1) {
    const x = p.x + (i - 3.5) * 55 * z;
    const y = p.y + Math.sin(i * 2.1) * 55 * z;
    ctx.fillStyle = `rgba(34,102,96,${.35 + (i % 3) * .08})`;
    ctx.beginPath(); ctx.ellipse(x, y, (58 + i * 4) * z, (28 + (i % 2) * 8) * z, i * .3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#69c9a8'; ctx.globalAlpha = .48;
    ctx.beginPath(); ctx.ellipse(x, y, (58 + i * 4) * z, (28 + (i % 2) * 8) * z, i * .3, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < 28; i += 1) {
    const x = p.x - 190 * z + ((i * 71) % 380) * z;
    const y = p.y - 120 * z + ((i * 43) % 250) * z;
    const bend = Math.sin(time * .0008 + i) * 8 * z;
    line([[x, y + 25 * z], [x + bend, y - 13 * z], [x + bend + (i % 2 ? 8 : -8) * z, y - 31 * z]], '#8ff3c6', 1.2 * z, .6);
    if (i % 5 === 0) glowCircle(x + bend, y - 38 * z, 16 * z, '#8ff3c6', .2);
  }
}

function drawRelay(r, time, snapshot) {
  const p = worldToScreen(r.center.x, r.center.y); const z = p.zoom;
  const repaired = snapshot?.relay?.status === 'repaired';
  const legible = snapshot?.relay?.status === 'legible';
  const color = repaired ? '#8ff3c6' : '#ff75c8';
  glowCircle(p.x, p.y, 260 * z, color, repaired ? .12 : .17);
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.strokeStyle = color; ctx.lineWidth = 2 * z; ctx.globalAlpha = .72;
  const pulse = 1 + Math.sin(time * .002) * .05;
  for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.arc(0, 0, (95 + i * 32) * z * pulse, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = .35;
  ctx.beginPath(); ctx.arc(0, 0, 180 * z, -Math.PI * .22, Math.PI * .48); ctx.stroke();
  ctx.globalAlpha = .8;
  polygon([[-35 * z, 96 * z], [12 * z, -112 * z], [44 * z, 96 * z]], 'rgba(255,117,200,.12)', color, 1.5 * z);
  polygon([[-19 * z, 74 * z], [12 * z, -74 * z], [29 * z, 74 * z]], 'rgba(5,18,25,.78)', color, 1 * z);
  ctx.globalAlpha = .9;
  const beam = Math.sin(time * .0014) * .42;
  line([[12 * z, -108 * z], [310 * z, (-200 + beam * 100) * z]], color, 3 * z, .18);
  line([[12 * z, -108 * z], [310 * z, (200 + beam * 100) * z]], '#ffe09a', 2 * z, .13);
  if (legible || repaired) { glowCircle(12 * z, -108 * z, 36 * z, '#8ff3c6', .33); }
  ctx.restore();
}

function drawCanopy(r, time) {
  const p = worldToScreen(r.center.x, r.center.y); const z = p.zoom;
  glowCircle(p.x, p.y, 200 * z, '#b9a0ff', .12);
  for (let i = 0; i < 7; i += 1) {
    const x = p.x - 170 * z + i * 56 * z;
    const y = p.y + Math.sin(i * 1.8) * 35 * z;
    polygon([[x - 42 * z, y + 58 * z], [x - 22 * z, y - 12 * z], [x + 16 * z, y - 42 * z], [x + 48 * z, y + 58 * z]], 'rgba(75,52,126,.38)', '#8c79d5', 1);
    line([[x + 8 * z, y + 5 * z], [x + 18 * z, y - 76 * z]], '#b9a0ff', 1, .6);
    glowCircle(x + 18 * z, y - 82 * z + Math.sin(time * .001 + i) * 5, 18 * z, '#b9a0ff', .28);
  }
  ctx.save(); ctx.globalAlpha = .26; ctx.strokeStyle = '#b9a0ff'; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) { ctx.beginPath(); ctx.arc(p.x, p.y + 30 * z, (90 + i * 22) * z, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  ctx.restore();
}

function drawRegionArt(snapshot, time) {
  for (const r of REGIONS) regionFrame(r, time);
  drawHub(regionMap['hive-hub'], time);
  drawOrchard(regionMap['glass-orchard'], time);
  drawFen(regionMap['memory-fen'], time);
  drawRelay(regionMap['hollow-relay'], time, snapshot);
  drawCanopy(regionMap['signal-canopy'], time);
  for (const r of REGIONS) {
    const p = worldToScreen(r.center.x, r.center.y);
    ctx.fillStyle = `${r.accent}cc`;
    ctx.font = `700 ${Math.max(10, 12 * p.zoom)}px Arial Narrow, sans-serif`;
    ctx.letterSpacing = '1px';
    ctx.fillText(r.name.toUpperCase(), p.x - 58 * p.zoom, p.y - (r.kind === 'relay' ? 145 : 116) * p.zoom);
  }
}

function drawEvidenceMarkers(snapshot, time) {
  const items = snapshot?.evidence || [];
  items.forEach((item, index) => {
    const r = regionMap[item.regionId] || regionMap['hive-hub'];
    const center = worldToScreen(r.center.x, r.center.y);
    const angle = index * 1.8 + time * .00015;
    const radius = (82 + (index % 4) * 14) * center.zoom;
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius * .62;
    const color = item.result === 'supported' ? '#8ff3c6' : item.result === 'disproved' ? '#ff75c8' : r.accent;
    glowCircle(x, y, 18 * center.zoom, color, .24);
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.globalAlpha = .9;
    ctx.beginPath(); ctx.arc(x, y, 6 * center.zoom, 0, Math.PI * 2); ctx.stroke();
    line([[x - 10 * center.zoom, y], [x + 10 * center.zoom, y]], color, 1, .65);
    line([[x, y - 10 * center.zoom], [x, y + 10 * center.zoom]], color, 1, .65);
    ctx.restore();
  });
}

function drawGuide(guide, time) {
  const region = regionMap[guide.regionId];
  if (!region) return;
  const p = worldToScreen(region.center.x - 78, region.center.y + 54); const z = p.zoom;
  const bob = Math.sin(time * .002 + guide.id.length) * 2 * z;
  glowCircle(p.x, p.y + bob, 30 * z, guide.accent, .16);
  ctx.save(); ctx.translate(p.x, p.y + bob); ctx.globalAlpha = .92;
  ctx.strokeStyle = guide.accent; ctx.lineWidth = 1.25 * z;
  ctx.beginPath(); ctx.arc(0, -14 * z, 7 * z, 0, Math.PI * 2); ctx.stroke();
  polygon([[-12 * z, 10 * z], [-8 * z, -8 * z], [0, -14 * z], [8 * z, -8 * z], [12 * z, 10 * z], [0, 16 * z]], `${guide.accent}24`, guide.accent, 1.2 * z);
  line([[-8 * z, 0], [-17 * z, 8 * z]], guide.accent, 1, .8);
  line([[8 * z, 0], [17 * z, 8 * z]], guide.accent, 1, .8);
  ctx.restore();
  if (z > .58) {
    ctx.fillStyle = `${guide.accent}dd`;
    ctx.font = `600 ${Math.max(9, 10 * z)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.fillText(guide.name, p.x, p.y + 31 * z); ctx.textAlign = 'start';
  }
}

function drawGuides(snapshot, time) {
  for (const guide of (snapshot?.guides || GUIDES)) drawGuide(guide, time);
}

function drawWorks(snapshot, time) {
  for (const [index, work] of (snapshot?.works || []).entries()) {
    const region = regionMap[work.regionId] || regionMap['hive-hub'];
    const center = worldToScreen(region.center.x + ((index % 3) - 1) * 48, region.center.y - 62 + Math.floor(index / 3) * 22);
    const z = center.zoom; const pulse = 1 + Math.sin(time * .002 + index) * .08;
    const color = work.kind === 'relay-repair' ? '#8ff3c6' : '#ffe09a';
    glowCircle(center.x, center.y - 16 * z, 32 * z * pulse, color, .25);
    line([[center.x, center.y + 20 * z], [center.x, center.y - 18 * z]], color, 2 * z, .9);
    polygon([[center.x - 10 * z, center.y - 18 * z], [center.x, center.y - 30 * z], [center.x + 10 * z, center.y - 18 * z]], `${color}30`, color, 1.2 * z);
    ctx.save(); ctx.globalAlpha = .7; ctx.setLineDash([2 * z, 5 * z]);
    ctx.beginPath(); ctx.arc(center.x, center.y - 18 * z, 23 * z * pulse, 0, Math.PI * 2); ctx.strokeStyle = color; ctx.stroke(); ctx.restore();
  }
}

function drawSignalFlares(snapshot, time) {
  const relay = regionMap['hollow-relay'];
  const center = worldToScreen(relay.center.x, relay.center.y); const z = center.zoom;
  const signals = snapshot?.expedition?.signals || [];
  signals.forEach((entry, index) => {
    const spec = COORDINATION_SIGNALS.find((signal) => signal.id === entry.signalId) || COORDINATION_SIGNALS[0];
    const angle = index * 1.7 + time * .00025;
    const radius = (126 + (index % 3) * 25) * z;
    const x = center.x + Math.cos(angle) * radius; const y = center.y + Math.sin(angle) * radius * .5;
    const pulse = 1 + Math.sin(time * .004 + index) * .12;
    glowCircle(x, y, 27 * z * pulse, spec.accent, .24);
    line([[center.x, center.y - 10 * z], [x, y]], spec.accent, 1 * z, .35);
    polygon([[x, y - 10 * z], [x + 8 * z, y], [x, y + 10 * z], [x - 8 * z, y]], `${spec.accent}32`, spec.accent, 1 * z);
  });
  if (snapshot?.expedition?.resonance > 0) {
    const braid = Math.sin(time * .001) * 12 * z;
    line([[center.x - 90 * z, center.y - 88 * z], [center.x + braid, center.y], [center.x + 90 * z, center.y + 88 * z]], '#8ff3c6', 2 * z, .5);
    line([[center.x + 90 * z, center.y - 88 * z], [center.x - braid, center.y], [center.x - 90 * z, center.y + 88 * z]], '#ffe09a', 1.5 * z, .45);
  }
}

function drawWitness(player, time) {
  const p = worldToScreen(player.x, player.y); const z = p.zoom;
  const color = factionMap[player.factionId]?.accent || '#7de7ff';
  const isSelf = player.id === identity.playerId;
  const bob = Math.sin(time * .004 + player.x) * 2 * z;
  glowCircle(p.x, p.y + bob, (isSelf ? 48 : 34) * z, color, isSelf ? .2 : .1);
  ctx.save(); ctx.translate(p.x, p.y + bob);
  ctx.globalAlpha = player.connected === false ? .35 : 1;
  ctx.strokeStyle = color; ctx.lineWidth = isSelf ? 2 : 1;
  ctx.beginPath(); ctx.ellipse(0, 10 * z, 19 * z, 8 * z, 0, 0, Math.PI * 2); ctx.stroke();
  polygon([[-14 * z, 8 * z], [-9 * z, -17 * z], [0, -27 * z], [10 * z, -17 * z], [14 * z, 8 * z], [0, 17 * z]], `${color}26`, color, isSelf ? 2 : 1);
  ctx.fillStyle = '#07151b'; ctx.beginPath(); ctx.arc(0, -17 * z, 7 * z, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  line([[-9 * z, -4 * z], [-22 * z, -12 * z]], color, 1, .85);
  line([[9 * z, -4 * z], [22 * z, -12 * z]], color, 1, .85);
  if (isSelf) { ctx.globalAlpha = .55; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(0, 0, 29 * z, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
  if (z > .62 || isSelf) {
    ctx.fillStyle = isSelf ? '#f0fff8' : '#a9c4bd';
    ctx.font = `600 ${Math.max(9, 11 * z)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(player.displayName, p.x, p.y + 38 * z);
    ctx.textAlign = 'start';
  }
}

function drawPlayers(snapshot, time) {
  const players = (snapshot?.players || []).filter((player) => player.regionId === currentSelf()?.regionId);
  for (const player of players) drawWitness(player, time);
}

function drawCanvas(snapshot, time) {
  ctx.save();
  ctx.scale(scene.dpr, scene.dpr);
  drawStars(time);
  drawWorldPaths(time);
  drawRegionArt(snapshot, time);
  drawGuides(snapshot, time);
  drawWorks(snapshot, time);
  drawSignalFlares(snapshot, time);
  drawEvidenceMarkers(snapshot, time);
  drawPlayers(snapshot, time);
  ctx.restore();
}

function renderRegions(snapshot) {
  const self = currentSelf();
  const here = currentRegion();
  ui.regionTitle.textContent = here.name;
  ui.regionBlurb.textContent = here.blurb;
  const guide = (snapshot?.guides || GUIDES).find((entry) => entry.regionId === here.id) || GUIDES[0];
  ui.guideName.textContent = `${guide.name} · ${guide.role}`;
  ui.guideLine.textContent = guide.line;
  ui.currentRegion.textContent = here.name;
  const adjacent = new Set(REGION_GRAPH[self?.regionId || 'hive-hub'] || []);
  ui.regionList.innerHTML = REGIONS.map((r) => {
    const active = r.id === self?.regionId;
    const available = active || adjacent.has(r.id);
    return `<button class="region-choice ${active ? 'active' : ''}" style="--accent:${r.accent}" data-region="${r.id}" ${available ? '' : 'disabled'}>
      <span class="region-dot"></span><span><strong>${escapeHtml(r.name)}</strong><small>${escapeHtml(r.terrain)} · ${active ? 'you are here' : available ? 'route open' : 'route closed'}</small></span><em>${active ? 'here' : available ? 'go' : '—'}</em>
    </button>`;
  }).join('');
  ui.regionList.querySelectorAll('[data-region]').forEach((button) => {
    button.addEventListener('click', () => net.travel(button.dataset.region));
  });
}

function renderLaws(snapshot) {
  const selfClaims = snapshot?.self?.claims || [];
  const selected = snapshot?.laws?.find((item) => item.id === scene.selectedLaw) || snapshot?.laws?.[0];
  const selectedClaims = selfClaims.filter((claim) => claim.lawId === selected?.id);
  const triedGuesses = new Set(selectedClaims.map((claim) => claim.guess));
  if (!scene.selectedGuess || !selected?.options?.includes(scene.selectedGuess) || triedGuesses.has(scene.selectedGuess)) {
    scene.selectedLaw = selected?.id || 'phase';
    scene.selectedGuess = selected?.options?.find((option) => !triedGuesses.has(option)) || null;
  }
  ui.lawBoard.innerHTML = (snapshot?.laws || []).map((law) => {
    const selected = scene.selectedLaw === law.id;
    const claim = [...selfClaims].reverse().find((item) => item.lawId === law.id);
    const tried = new Set(selfClaims.filter((item) => item.lawId === law.id).map((item) => item.guess));
    const value = selected ? scene.selectedGuess : null;
    return `<article class="law-card ${selected ? 'selected' : ''} ${law.authorized ? 'authorized' : ''}" data-law-card="${law.id}">
      <h3>${escapeHtml(law.name)}</h3><p>${escapeHtml(law.question)}</p>
      <div class="law-options">${law.options.map((option) => `<button class="law-option ${value === option ? 'selected' : ''} ${tried.has(option) ? 'tested' : ''}" data-law="${law.id}" data-guess="${option}" type="button" ${tried.has(option) ? 'disabled title="already tested this cycle"' : ''}>${escapeHtml(option)}${tried.has(option) ? ' · tested' : ''}</button>`).join('')}</div>
      ${law.authorized ? '<div class="law-result">authorized by the Hive</div>' : claim ? `<div class="law-result">your claim · ${escapeHtml(claim.status)}</div>` : ''}
    </article>`;
  }).join('');
  ui.lawBoard.querySelectorAll('[data-guess]').forEach((button) => {
    button.addEventListener('click', () => {
      scene.selectedLaw = button.dataset.law;
      scene.selectedGuess = button.dataset.guess;
      renderLaws(snapshot);
    });
  });
}

function renderEvidence(snapshot) {
  const evidence = snapshot?.evidence || [];
  const claims = snapshot?.claims || [];
  const rows = [
    ...claims.map((claim) => ({ ...claim, kind: 'claim', text: `The ${claim.lawId} law is ${claim.guess}.`, accent: claim.status === 'supported' ? '#8ff3c6' : '#ffe09a' })),
    ...evidence.map((item) => ({ ...item, kind: item.kind, text: item.text, accent: item.result === 'supported' ? '#8ff3c6' : item.result === 'disproved' ? '#ff75c8' : regionMap[item.regionId]?.accent || '#7de7ff' })),
  ].slice(-12).reverse();
  ui.evidenceList.innerHTML = rows.length ? rows.map((item) => `<div class="evidence-item" style="--accent:${item.accent}">
    <span class="mark"></span><div><strong>${escapeHtml(item.kind === 'claim' ? 'HYPOTHESIS' : item.kind.toUpperCase())} · ${escapeHtml(item.actorName || 'Witness')}</strong><p>${escapeHtml(item.text)}</p></div><small>${escapeHtml(item.regionName || item.status || '')}</small>
  </div>`).join('') : '<div class="empty">No public evidence yet. The first witness has to leave a trace.</div>';
}

function eventText(event, snapshot) {
  const actor = event.payload?.displayName || snapshot?.players?.find((p) => p.id === event.actorId)?.displayName || (event.actorId === identity.playerId ? 'You' : 'A witness');
  const regionName = regionMap[event.payload?.regionId]?.name || event.payload?.regionName || '';
  const texts = {
    witness_arrived: `${actor} entered the frontier.`,
    witness_travelled: event.payload?.moment ? `${actor} reached ${regionName}. ${event.payload.moment}` : `${actor} travelled to ${regionName}.`,
    field_observed: `${actor} left an observation from ${regionName}.`,
    hypothesis_formed: `${actor} formed a hypothesis about the ${event.payload?.lawId || 'unknown'} law.`,
    probe_supported: `${actor} found support for a claim.`,
    probe_disproved: `${actor} let a claim fail in public.`,
    evidence_shared: `${actor} shared evidence with the Hive.`,
    witness_regrouped: `${actor} regrouped at Clove Hive and recovered Focus.`,
    field_work_built: `${actor} left a public field beacon in ${regionName}. The frontier will remember it.`,
    coordination_signal: `${actor} sent a coordination signal at ${regionName}.`,
    relay_resonated: `${actor} answered another witness. A Relay Thread receipt was issued.`,
    law_authorized: `${actor} helped authorize the ${event.payload?.lawId || 'unknown'} law.`,
    relay_repaired: `${actor} repaired the relay. The next question survives.`,
    cycle_begun: `Cycle ${event.payload?.cycle ?? '?'} began with a new question.`,
  };
  return texts[event.type] || `${actor} changed the frontier.`;
}

function renderEvents(snapshot) {
  const events = snapshot?.events || [];
  ui.eventList.innerHTML = events.length ? events.slice().reverse().slice(0, 12).map((event) => `<div class="event-item"><small>#${event.tick}</small><span>${escapeHtml(eventText(event, snapshot))}</span></div>`).join('') : '<div class="empty">The public trace is waiting for its first deliberate action.</div>';
}

function renderArchive(snapshot) {
  const entries = snapshot?.archive || [];
  ui.archiveList.innerHTML = entries.length ? entries.slice().reverse().slice(0, 6).map((entry) => `<div class="archive-entry">
    <strong>CYCLE ${escapeHtml(entry.cycle)}</strong>
    <p>${escapeHtml(entry.finalQuestion || 'A consequence was carried forward.')}</p>
    <small>${escapeHtml(entry.relayStatus || 'sealed')}<br>${entry.authorizedLaws?.length || 0}/3 laws authorized · ${entry.observationCount || 0} readings<br>${entry.expeditionResonance ? `Relay Thread · ${entry.expeditionResonance} resonance` : 'Relay Thread · solo'}</small>
  </div>`).join('') : '<div class="empty">No cycle is archived yet. The first decision is still ahead of you.</div>';
}

function renderSnapshot(snapshot) {
  scene.snapshot = snapshot;
  const self = currentSelf();
  const relay = snapshot.relay || { authorized: {}, status: 'open' };
  const authorizedCount = Object.values(relay.authorized || {}).filter(Boolean).length;
  ui.cycleText.textContent = `CYCLE ${snapshot.cycle}`;
  ui.relayMeterFill.style.width = `${(authorizedCount / 3) * 100}%`;
  ui.relayStatus.textContent = `Relay status · ${relay.status} · ${authorizedCount}/3 laws authorized`;
  ui.focusValue.textContent = self?.focus ?? '—';
  ui.playerName.textContent = self?.displayName || identity.displayName;
  ui.factionName.textContent = self?.faction || identity.factionId;
  ui.responsibilityName.textContent = self?.responsibility || identity.responsibility;
  ui.earnedValue.textContent = self?.earned ?? 0;
  ui.observationCount.textContent = self?.evidence?.length ?? 0;
  ui.workCount.textContent = snapshot.works?.length ?? 0;
  ui.playerCount.textContent = `${snapshot.players?.filter((p) => p.connected !== false).length || 0} witness${(snapshot.players?.filter((p) => p.connected !== false).length || 0) === 1 ? '' : 'es'}`;
  ui.technicalRoot.textContent = `${snapshot.worldId} · c${snapshot.cycle} · t${snapshot.tick}`;

  // After the first reading, point the law board at the question that reading
  // actually touched. Once one law is authorized, move the selection to the
  // next open law so the repeated authorize step is visible rather than hidden.
  const beforeRender = witnessState(snapshot);
  if (beforeRender.latestObservation && !beforeRender.claims.length) {
    scene.selectedLaw = beforeRender.latestObservation.lawId;
    scene.selectedGuess = beforeRender.latestObservation.reading;
  }
  const selectedLaw = snapshot.laws?.find((law) => law.id === scene.selectedLaw);
  if (selectedLaw?.authorized) {
    const nextLaw = snapshot.laws.find((law) => !law.authorized);
    if (nextLaw) {
      scene.selectedLaw = nextLaw.id;
      scene.selectedGuess = nextLaw.options[0];
    }
  }

  renderRegions(snapshot);
  renderMission(snapshot);
  renderThread(snapshot);
  renderLaws(snapshot);
  renderEvidence(snapshot);
  renderEvents(snapshot);
  renderArchive(snapshot);

  const state = witnessState(snapshot);
  scene.latestHypothesisId = state.selectedClaim?.id || null;
  scene.latestItemId = state.latestUnshared?.id || null;
  renderLoopGuide(snapshot);
  renderLastReading(snapshot);
  renderNextStep(snapshot);

  const atRelay = self?.regionId === 'hollow-relay';
  actionButtons.observe.disabled = !self;
  actionButtons.hypothesize.disabled = !self || !scene.selectedGuess;
  actionButtons.probe.disabled = !self || !scene.latestHypothesisId || (self.focus ?? 0) < 1;
  actionButtons.share.disabled = !self || !scene.latestItemId;
  const hasCurrentWork = (snapshot.works || []).some((work) => work.actorId === self?.id);
  const canBuild = !!self && !hasCurrentWork && (self.focus ?? 0) >= BUILD_COST && witnessState(snapshot).proofShared;
  actionButtons.build.disabled = !canBuild;
  actionButtons.authorize.disabled = !self || !scene.latestHypothesisId || !atRelay;
  actionButtons.repair.disabled = !self || !atRelay || relay.status !== 'legible';
  actionButtons.repair.textContent = relay.status === 'repaired' ? 'Relay repaired' : 'Repair the relay';
  actionButtons.nextCycle.disabled = !self || snapshot.phase !== 'sealed';
  actionButtons.observe.title = self ? 'Record what this region returns.' : 'Waiting for your witness identity.';
  actionButtons.hypothesize.title = self ? 'Choose a law and one visible reading first.' : 'Waiting for your witness identity.';
  actionButtons.probe.title = actionButtons.probe.disabled
    ? ((self?.focus ?? 0) < 1 ? 'Your Focus is spent; use the guided regroup action at Clove Hive.' : 'Form an untested hypothesis first.')
    : 'Test your selected hypothesis.';
  actionButtons.share.title = actionButtons.share.disabled ? 'There is no new private evidence to share.' : 'Make the selected evidence public.';
  actionButtons.build.title = actionButtons.build.disabled ? 'Share a supported proof and keep two Focus to build.' : 'Leave a public field beacon for every witness.';
  actionButtons.authorize.title = actionButtons.authorize.disabled ? 'Stand at Hollow Relay with a shared supported claim.' : 'Ask the Hive to accept this law.';
}

function animate(time) {
  drawCanvas(scene.snapshot, time);
  requestAnimationFrame(animate);
}

function handleKeyboard() {
  const vector = { dx: 0, dy: 0 };
  if (scene.keys.has('ArrowUp') || scene.keys.has('w')) vector.dy -= 1;
  if (scene.keys.has('ArrowDown') || scene.keys.has('s')) vector.dy += 1;
  if (scene.keys.has('ArrowLeft') || scene.keys.has('a')) vector.dx -= 1;
  if (scene.keys.has('ArrowRight') || scene.keys.has('d')) vector.dx += 1;
  if (scene.touch) { vector.dx = scene.touch.dx; vector.dy = scene.touch.dy; }
  if (vector.dx || vector.dy) net.move(vector.dx, vector.dy, 80);
}

function setupInput() {
  window.addEventListener('keydown', (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(key)) {
      scene.keys.add(key); event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    scene.keys.delete(key);
  });
  setInterval(handleKeyboard, 80);
  let pointerId = null;
  const updateTouch = (event) => {
    if (pointerId !== event.pointerId) return;
    const rect = canvas.getBoundingClientRect();
    const dx = (event.clientX - rect.left - rect.width / 2) / (rect.width * .22);
    const dy = (event.clientY - rect.top - rect.height / 2) / (rect.height * .22);
    const magnitude = Math.hypot(dx, dy) || 1;
    scene.touch = { dx: Math.max(-1, Math.min(1, dx / magnitude)), dy: Math.max(-1, Math.min(1, dy / magnitude)) };
  };
  canvas.addEventListener('pointerdown', (event) => { pointerId = event.pointerId; canvas.setPointerCapture(pointerId); updateTouch(event); });
  canvas.addEventListener('pointermove', updateTouch);
  const clearTouch = () => { pointerId = null; scene.touch = null; };
  canvas.addEventListener('pointerup', clearTouch); canvas.addEventListener('pointercancel', clearTouch);
}

const net = new HiveNet({
  wsUrl: resolveHiveWsUrl({ explicit: params.get('ws'), config: window.__CLOVE_HIVE_CONFIG__, location }),
  identity,
  demo: params.get('demo') === '1',
  handlers: {
    onStatus: setStatus,
    onSnapshot: renderSnapshot,
    onEvent: (event) => {
      if (event.actorId === identity.playerId) showMessage(eventText(event, scene.snapshot), event.type === 'relay_repaired' ? 'good' : 'normal');
    },
    onError: (message) => showMessage(message.message || 'The Hive rejected that action.', 'error'),
    onNotice: (message) => showMessage(message),
  },
});

function runNextAction() {
  const action = scene.nextAction;
  if (!action || ui.nextActionBtn.disabled) return;
  switch (action.type) {
    case 'travel':
      net.travel(action.regionId);
      showMessage(`Travelling to ${regionMap[action.regionId]?.name || 'the next region'}.`);
      break;
    case 'observe':
      net.observe();
      showMessage('Reading requested — watch Latest reading for what the frontier returned.');
      break;
    case 'probe':
      net.probe(action.hypothesisId);
      break;
    case 'regroup':
      net.regroup();
      break;
    case 'share':
      net.share(action.itemId);
      break;
    case 'build':
      net.build();
      break;
    case 'authorize':
      net.authorize(action.hypothesisId);
      break;
    case 'repair':
      net.repair();
      break;
    case 'next_cycle':
      net.nextCycle();
      break;
    case 'choose':
      ui.lawBoard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showMessage('Choose a law and one reading, then form your hypothesis.');
      break;
    default:
      break;
  }
}

ui.nextActionBtn.addEventListener('click', runNextAction);
actionButtons.observe.addEventListener('click', () => { net.observe(); showMessage('Reading requested — watch Latest reading for what the frontier returned.'); });
actionButtons.hypothesize.addEventListener('click', () => {
  const evidenceIds = (currentSelf()?.evidence || []).filter((item) => item.lawId === scene.selectedLaw).slice(-4).map((item) => item.id);
  net.hypothesize(scene.selectedLaw, scene.selectedGuess, evidenceIds);
  showMessage(`Hypothesis formed: ${scene.selectedLaw} may be ${scene.selectedGuess}.`);
});
actionButtons.probe.addEventListener('click', () => { if (scene.latestHypothesisId) net.probe(scene.latestHypothesisId); });
actionButtons.share.addEventListener('click', () => { if (scene.latestItemId) net.share(scene.latestItemId); });
actionButtons.build.addEventListener('click', () => net.build());
actionButtons.authorize.addEventListener('click', () => { if (scene.latestHypothesisId) net.authorize(scene.latestHypothesisId); });
actionButtons.repair.addEventListener('click', () => net.repair());
actionButtons.nextCycle.addEventListener('click', () => net.nextCycle());

ui.technicalToggle.addEventListener('click', () => { ui.technicalDialog.showModal(); ui.technicalToggle.setAttribute('aria-expanded', 'true'); });
ui.technicalClose.addEventListener('click', () => { ui.technicalDialog.close(); ui.technicalToggle.setAttribute('aria-expanded', 'false'); });
ui.technicalDialog.addEventListener('click', (event) => { if (event.target === ui.technicalDialog) ui.technicalDialog.close(); });

window.addEventListener('resize', resize);
window.addEventListener('beforeunload', () => net.close());
resize();
setupInput();
setStatus('connecting');
net.connect();
requestAnimationFrame(animate);
