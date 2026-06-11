/**
 * city-dev-shim.mjs — TEST / DEV ONLY. NOT production.
 *
 * A tiny Node WebSocket server that speaks the exact Phase 4A city protocol so the
 * browser city scene + Playwright smoke can run locally under Node (wrangler dev
 * needs Node >=22 here). It is the parity twin of the CityRoom Durable Object: both
 * are thin transports over the SAME pure authority core (arcade/city/city-block.mjs),
 * so movement clamping, collision, and the portal gate are identical by construction.
 *
 * Isolated from the arcade dev shim (workers/arcade/dev-shim.mjs) on its own port +
 * path (/arcade/city/ws), so the arcade transport is untouched.
 */
import { WebSocketServer } from 'ws';
import {
  resolveCityRoomId, getCity, isValidPlayerId, createCityState, addPlayer, applyInput, removePlayer,
  touchPlayer, stalePlayerIds, enterPortal, welcomePayload, citySnapshot,
} from '../../arcade/city/city-block.mjs';
import { createEventLog, appendCityEvent, cityEventsPayload, recentEvents } from '../../arcade/city/city-events.mjs';
import { evaluatePressure, pressureChanged, suggestionReasons, schedulerStatePayload, isBaselinePressure } from '../../arcade/city/city-scheduler.mjs';
import { evaluateHostRank, hostRankChanged, hostRankTierChanged, isBaselineHostRank, hostRankStatePayload } from '../../arcade/city/city-host-rank.mjs';
import { evaluateStewardship, defaultBlockStyle, normalizeBlockStyle, stewardshipStatePayload, isStewardshipEligible } from '../../arcade/city/city-stewardship.mjs';
import { createTrial, addTrialPlayer, removeTrialPlayer, stepTrial, closeTrial, isTrialActive, trialStatePayload } from '../../arcade/city/city-battle-instance.mjs';
import { districtManifest, validateRouteRequest } from '../../arcade/city/city-district.mjs';
import { deriveDistrictPresenceDelta } from '../../arcade/city/city-district-presence.mjs';
import { districtEventSnapshot, resolveDistrictEventConfig } from '../../arcade/city/city-district-events.mjs';
import { buildInteractionReceipt } from '../../arcade/city/city-interaction-receipts.mjs'; // Phase 7E
import { createObjectiveState, activeObjective, stepObjectives, objectiveHintPayload, objectiveCompletedPayload } from '../../arcade/city/city-objectives.mjs'; // Phase 7C

// Phase 6B: the SAME server-authored, public-safe district-event snapshot the DO ships in
// city_blocks. Operator config comes from env (clamped); absent → Phase 6A defaults. DO parity.
const districtEventConfig = resolveDistrictEventConfig(process.env);
const districtEventSnapshotShim = (now = Date.now()) => districtEventSnapshot(now, districtEventConfig);

const PORT = Number(process.env.CITY_PORT || process.env.PORT || 8788);
const STALE_SWEEP_MS = 30_000;
const SNAP_REQ_MIN_MS = 250;

const cities = {};                 // cityId -> pure city state
const eventLogs = {};              // cityId -> append-only world event log (Phase 4C)
const pressures = {};              // cityId -> last Hive-Scheduler snapshot (Phase 4D)
const hostRanks = {};              // cityId -> last Host Rank snapshot (Phase 4E)
const rankChangedLast = {};        // cityId -> did the last host-rank eval broadcast (join dedup)
const stewardships = {};           // cityId -> canonical block style (Phase 4F)
const trials = {};                 // cityId -> active Block Trial instance (Phase 4G; in-memory, ephemeral)
// Phase 7C: per-city objective cycle state (EPHEMERAL — DO parity; never persisted, never per-player).
const objectiveStates = {};
const lastObjectiveIds = {};
function tickObjectives(cityId) {
  const now = Date.now();
  if (!objectiveStates[cityId]) objectiveStates[cityId] = createObjectiveState(now);
  const positions = {};
  for (const [pid, p] of Object.entries(cityState(cityId).players || {})) positions[pid] = { x: p.x, y: p.y };
  const r = stepObjectives(cityId, objectiveStates[cityId], positions, now);
  objectiveStates[cityId] = r.state;
  if (r.completed) emit(cityId, 'city_objective_completed', null, objectiveCompletedPayload(r.completed));
  const active = activeObjective(cityId, objectiveStates[cityId], now);
  const id = active ? active.objective_id : null;
  if (id !== lastObjectiveIds[cityId] || r.completed) {
    lastObjectiveIds[cityId] = id;
    broadcast(cityId, { t: 'city_objective_state', ...objectiveHintPayload(active) });
  }
}
const sockets = new Map();         // ws -> { playerId, cityId, interiorOpen, ... }

const cityState = (cityId) => (cities[cityId] ||= createCityState());
// Phase 5C: single-process presence parity with the CityRegistry DO. The shim sees every
// block's state directly, so it builds the district presence map locally (always-fresh
// heartbeats). Population is the live player count; an untouched block is absent → unknown/0.
const cityPresenceMap = () => {
  const now = Date.now();
  const map = {};
  for (const cityId of Object.keys(cities)) map[cityId] = { population: Object.keys(cityState(cityId).players).length, last_seen_at: now };
  return map;
};
// Phase 5D: push-on-change district presence. Single-process — the global presence view drives
// ONE delta fan-out to every socket (each client merges by city_id). Coalesced: emit only on change.
let lastDistrictPresence = {};
function broadcastDistrictPresence() {
  const r = deriveDistrictPresenceDelta(lastDistrictPresence, cityPresenceMap(), Date.now());
  lastDistrictPresence = r.snapshot;
  if (r.delta) for (const ws of sockets.keys()) send(ws, { t: 'city_district_presence', ...r.delta });
}
const eventLog = (cityId) => (eventLogs[cityId] ||= createEventLog());
const stewardship = (cityId) => (stewardships[cityId] ||= defaultBlockStyle(cityId)); // Phase 5B: per-block default identity
const send = (ws, p) => { try { ws.send(JSON.stringify(p)); } catch { /* closing */ } };
const broadcast = (cityId, p) => { for (const [ws, m] of sockets) if (m.cityId === cityId) send(ws, p); };
const broadcastExcept = (except, cityId, p) => { for (const [ws, m] of sockets) if (ws !== except && m.cityId === cityId) send(ws, p); };
const snapshot = (cityId, now) => broadcast(cityId, { t: 'city_snapshot', cityId, ...citySnapshot(cityState(cityId), now) });
// Append a SERVER-AUTHORED public-safe world event + broadcast it live (DO parity).
function emit(cityId, type, actorPublicId, payload = {}) {
  const r = appendCityEvent(eventLog(cityId), { type, cityId, actorPublicId, payload, now: Date.now() });
  eventLogs[cityId] = r.log;
  broadcast(cityId, { t: 'city_event', event: r.event });
}
function hasSocketFor(cityId, playerId) {
  for (const m of sockets.values()) if (m.cityId === cityId && m.playerId === playerId) return true;
  return false;
}

// Phase 4D: re-evaluate non-authoritative city pressure (DO parity). Emits a tick /
// new suggestions only on change (bounded), broadcasts scheduler state, returns changed.
function evaluateScheduler(cityId) {
  const now = Date.now();
  const occupancy = Object.keys(cityState(cityId).players).length;
  const snap = evaluatePressure({ cityId, now, recentEvents: recentEvents(eventLog(cityId)), occupancy });
  const prev = pressures[cityId];
  const meaningful = pressureChanged(prev, snap) && !(!prev && isBaselinePressure(snap)); // first idle eval is not news
  if (meaningful) {
    emit(cityId, 'city_scheduler_tick', null, { pressure: snap.pressure.scheduler_mood, reason: 'pressure_update' });
    const prevReasons = new Set(suggestionReasons(prev));
    for (const s of snap.suggestions) if (!prevReasons.has(s.reason)) emit(cityId, 'city_pressure_suggested', null, { pressure: snap.pressure.scheduler_mood, reason: s.reason, severity: s.severity });
    broadcast(cityId, { t: 'city_scheduler_state', ...schedulerStatePayload(snap) });
  }
  pressures[cityId] = snap;
  tickHostRank(cityId); // Phase 4E: host rank always follows the scheduler review
  return meaningful;
}
function schedulerRequest(ws, meta) {
  if (!meta.playerId) return; // parity with the DO: only joined sockets can request
  const now = Date.now();
  if (now - (meta.lastSchedReqAt || 0) < SNAP_REQ_MIN_MS) return; // anti-spam
  meta.lastSchedReqAt = now;
  evaluateScheduler(meta.cityId);
  send(ws, { t: 'city_scheduler_state', ...schedulerStatePayload(pressures[meta.cityId]) });
}

// Phase 4E: re-derive the block's non-cash Host Rank (DO parity). Emits on change only;
// returns whether it changed. Uses the imported pure evaluateHostRank().
function tickHostRank(cityId) {
  const snap = evaluateHostRank({ cityId, now: Date.now(), recentEvents: recentEvents(eventLog(cityId)), schedulerState: pressures[cityId] });
  const prev = hostRanks[cityId];
  const meaningful = hostRankChanged(prev, snap) && !(!prev && isBaselineHostRank(snap));
  if (meaningful) {
    const hr = snap.host_rank;
    emit(cityId, 'city_host_rank_evaluated', null, { tier: hr.tier, support_signal: hr.support_signal, score: hr.score, score_cap: hr.score_cap, reason: hr.reasons[0] || 'activity' });
    if (hostRankTierChanged(prev, snap)) emit(cityId, 'city_host_rank_changed', null, { tier: hr.tier, support_signal: hr.support_signal, score: hr.score, score_cap: hr.score_cap });
    broadcast(cityId, { t: 'city_host_rank_state', ...hostRankStatePayload(snap) });
  }
  hostRanks[cityId] = snap;
  rankChangedLast[cityId] = meaningful;
  return meaningful;
}
function hostRankRequest(ws, meta) {
  if (!meta.playerId) return;
  const now = Date.now();
  if (now - (meta.lastRankReqAt || 0) < SNAP_REQ_MIN_MS) return; // anti-spam
  meta.lastRankReqAt = now;
  tickHostRank(meta.cityId);
  send(ws, { t: 'city_host_rank_state', ...hostRankStatePayload(hostRanks[meta.cityId]) });
}

// Phase 4F: server-validated, manifest-constrained block stewardship (DO parity). The
// client sends intent only; the pure module gates on current Host Rank eligibility +
// the closed allowlist. preview never persists; apply/reset update + broadcast canonical.
function stewardshipRequest(ws, meta, data) {
  if (!meta.playerId) { send(ws, { t: 'city_error', code: 'no_identity', message: 'Must city_join first' }); return; }
  const now = Date.now();
  if (now - (meta.lastStewReqAt || 0) < SNAP_REQ_MIN_MS) return; // anti-spam
  meta.lastStewReqAt = now;
  const request = { request_id: data.request_id, action: data.action, target: data.target, style: data.style };
  const res = evaluateStewardship({ cityId: meta.cityId, now, hostRank: hostRanks[meta.cityId]?.host_rank, currentStewardship: stewardship(meta.cityId), request });
  if (!res.ok) {
    emit(meta.cityId, 'city_stewardship_rejected', meta.playerId, { target: typeof data.target === 'string' ? data.target : undefined, reason: res.reason });
    send(ws, { t: 'city_stewardship_result', ok: false, action: res.action, reason: res.reason, public_safe: true });
    return;
  }
  if (res.action === 'preview') {
    emit(meta.cityId, 'city_stewardship_previewed', meta.playerId, { target: res.target, palette: res.preview_style[res.target]?.palette });
    send(ws, { t: 'city_stewardship_result', ok: true, action: 'preview', target: res.target, preview_style: res.preview_style, reason: res.reason, public_safe: true });
    return;
  }
  stewardships[meta.cityId] = normalizeBlockStyle(res.canonical_style);
  if (res.action === 'reset') emit(meta.cityId, 'city_stewardship_reset', meta.playerId, {});
  else { const st = stewardships[meta.cityId][res.target] || {}; emit(meta.cityId, 'city_stewardship_applied', meta.playerId, { target: res.target, palette: st.palette, sign_variant: st.sign_variant, intensity: st.intensity }); }
  broadcast(meta.cityId, { t: 'city_stewardship_state', ...stewardshipStatePayload(stewardships[meta.cityId]) });
  send(ws, { t: 'city_stewardship_result', ok: true, action: res.action, target: res.target, reason: res.reason, public_safe: true });
}

// Phase 4G: instanced, non-destructive Block Trial (DO parity). Players move via the
// existing city_input authority; the trial reads server positions + latches nodes. Never
// mutates public city/stewardship state. trials[] is in-memory + ephemeral (no persistence).
function broadcastTrial(cityId) { broadcast(cityId, { t: 'city_block_trial_state', ...trialStatePayload(trials[cityId]) }); }
function tickTrial(cityId) {
  if (!isTrialActive(trials[cityId])) return false;
  const now = Date.now();
  const positions = {};
  for (const pid of Object.keys(trials[cityId].players)) { const p = cityState(cityId).players[pid]; if (p) positions[pid] = { x: p.x, y: p.y }; }
  const r = stepTrial(trials[cityId], { now, positions });
  trials[cityId] = r.state;
  if (!r.changed) return false;
  if (r.completed) { const o = trials[cityId].outcome || {}; emit(cityId, 'city_block_trial_completed', null, { instance_id: trials[cityId].instance_id, objective: trials[cityId].objective, status: trials[cityId].status, score: trials[cityId].score, score_cap: trials[cityId].score_cap, node_count: o.node_count, stabilized_count: o.stabilized, duration_ms: o.duration_ms, reason: o.result }); }
  else { emit(cityId, 'city_block_trial_updated', null, { instance_id: trials[cityId].instance_id, status: trials[cityId].status, score: trials[cityId].score, score_cap: trials[cityId].score_cap, stabilized_count: trials[cityId].score }); }
  broadcastTrial(cityId);
  return true;
}
function trialRequest(ws, meta) {
  if (!meta.playerId) { send(ws, { t: 'city_error', code: 'no_identity', message: 'Must city_join first' }); return; }
  const now = Date.now();
  if (now - (meta.lastTrialReqAt || 0) < SNAP_REQ_MIN_MS) return; // anti-spam
  meta.lastTrialReqAt = now;
  if (isTrialActive(trials[meta.cityId]) && now < trials[meta.cityId].ends_at) { emit(meta.cityId, 'city_block_trial_rejected', meta.playerId, { reason: 'trial_active' }); send(ws, { t: 'city_block_trial_result', ok: false, reason: 'trial_active', public_safe: true }); return; }
  if (!isStewardshipEligible(hostRanks[meta.cityId]?.host_rank)) { emit(meta.cityId, 'city_block_trial_rejected', meta.playerId, { reason: 'host_rank_too_low' }); send(ws, { t: 'city_block_trial_result', ok: false, reason: 'host_rank_too_low', public_safe: true }); return; }
  const instanceId = `trial-${meta.cityId}-${now}`;
  let trial = createTrial({ cityId: meta.cityId, instanceId, now, copiedStyle: stewardship(meta.cityId) });
  trial = addTrialPlayer(trial, meta.playerId, now);
  trials[meta.cityId] = trial;
  emit(meta.cityId, 'city_block_trial_requested', meta.playerId, { instance_id: instanceId, objective: trial.objective });
  emit(meta.cityId, 'city_block_trial_started', meta.playerId, { instance_id: instanceId, objective: trial.objective, status: trial.status, node_count: trial.signal_nodes.length, score_cap: trial.score_cap });
  broadcastTrial(meta.cityId);
  send(ws, { t: 'city_block_trial_result', ok: true, action: 'request', instance_id: instanceId, public_safe: true });
}
function trialJoin(ws, meta) {
  if (!meta.playerId) { send(ws, { t: 'city_error', code: 'no_identity', message: 'Must city_join first' }); return; }
  const now = Date.now();
  if (now - (meta.lastTrialReqAt || 0) < SNAP_REQ_MIN_MS) return;
  meta.lastTrialReqAt = now;
  if (!isTrialActive(trials[meta.cityId])) { send(ws, { t: 'city_block_trial_result', ok: false, reason: 'no_active_trial', public_safe: true }); return; }
  if (!trials[meta.cityId].players[meta.playerId]) { trials[meta.cityId] = addTrialPlayer(trials[meta.cityId], meta.playerId, now); emit(meta.cityId, 'city_block_trial_joined', meta.playerId, { instance_id: trials[meta.cityId].instance_id }); broadcastTrial(meta.cityId); }
  send(ws, { t: 'city_block_trial_result', ok: true, action: 'join', instance_id: trials[meta.cityId].instance_id, public_safe: true });
}
function trialLeave(ws, meta) {
  if (!meta.playerId || !trials[meta.cityId] || !trials[meta.cityId].players[meta.playerId]) return;
  trials[meta.cityId] = removeTrialPlayer(trials[meta.cityId], meta.playerId);
  broadcastTrial(meta.cityId);
}
function trialClose(ws, meta) {
  if (!meta.playerId || !trials[meta.cityId]) return;
  if (isTrialActive(trials[meta.cityId]) && !trials[meta.cityId].players[meta.playerId]) { send(ws, { t: 'city_block_trial_result', ok: false, reason: 'not_a_member', public_safe: true }); return; }
  const now = Date.now();
  trials[meta.cityId] = closeTrial(trials[meta.cityId], now);
  const o = trials[meta.cityId].outcome || {};
  emit(meta.cityId, 'city_block_trial_closed', meta.playerId, { instance_id: trials[meta.cityId].instance_id, status: trials[meta.cityId].status, score: trials[meta.cityId].score, node_count: o.node_count, stabilized_count: o.stabilized, duration_ms: o.duration_ms, reason: o.result });
  broadcastTrial(meta.cityId);
  send(ws, { t: 'city_block_trial_result', ok: true, action: 'close', instance_id: trials[meta.cityId].instance_id, public_safe: true });
  trials[meta.cityId] = null; // discard the instance
}

function join(ws, meta, data) {
  const playerId = data.playerId;
  if (!isValidPlayerId(playerId)) { send(ws, { t: 'city_error', code: 'no_identity', message: 'a valid playerId is required' }); return; }
  // meta.cityId is fixed from the connection URL; the join payload cannot re-bind it.
  meta.playerId = playerId;
  const now = Date.now();
  const capacity = getCity(meta.cityId)?.capacity;
  const res = addPlayer(cityState(meta.cityId), playerId, { now, capacity });
  if (!res.ok) { send(ws, { t: 'city_error', code: res.reason, message: 'join rejected' }); return; }
  cities[meta.cityId] = res.state;
  send(ws, { t: 'city_welcome', ...welcomePayload(cities[meta.cityId], playerId, meta.cityId, now) });
  send(ws, { t: 'city_events', ...cityEventsPayload(eventLog(meta.cityId)) }); // recent history on (re)join
  broadcastExcept(ws, meta.cityId, { t: 'city_player_joined', id: playerId, x: res.player.x, y: res.player.y }); // legacy
  emit(meta.cityId, 'city_player_joined', playerId, {}); // canonical append-only event
  snapshot(meta.cityId, now);
  // Phase 4D: if the eval broadcast a state change it already reached this socket; only
  // send explicitly when it did not, so a (re)connect sees current pressure exactly once.
  if (!evaluateScheduler(meta.cityId)) send(ws, { t: 'city_scheduler_state', ...schedulerStatePayload(pressures[meta.cityId]) });
  // Phase 4E: evaluateScheduler() also ran the host-rank eval; send host-rank state once.
  if (!rankChangedLast[meta.cityId]) send(ws, { t: 'city_host_rank_state', ...hostRankStatePayload(hostRanks[meta.cityId]) });
  // Phase 4F: a (re)connect always sees the current canonical block style.
  send(ws, { t: 'city_stewardship_state', ...stewardshipStatePayload(stewardship(meta.cityId)) });
  // Phase 4G: a (re)connect sees an in-progress Block Trial, if any.
  if (trials[meta.cityId]) send(ws, { t: 'city_block_trial_state', ...trialStatePayload(trials[meta.cityId]) });
  // Phase 7C: a (re)connect always sees the current objective hint (display state; server truth).
  if (!objectiveStates[meta.cityId]) objectiveStates[meta.cityId] = createObjectiveState(Date.now());
  send(ws, { t: 'city_objective_state', ...objectiveHintPayload(activeObjective(meta.cityId, objectiveStates[meta.cityId], Date.now())) });
  // Phase 5A: a (re)connect always sees the public-safe district manifest for discovery.
  send(ws, { t: 'city_blocks', ...districtManifest(meta.cityId, cityPresenceMap()), event: districtEventSnapshotShim() });
  // Phase 5D: push the +1 as a delta so other connected clients update live (no polling).
  broadcastDistrictPresence();
}

// Phase 5A: multi-block district discovery + bounded routing (DO parity). Discovery is
// public-safe static config; a route is a server-VALIDATED confirmation the client then
// reconnects on (the target block's authority admits it). Never mutates any block state.
function blocksRequest(ws, meta) {
  if (!meta.playerId) return;
  const now = Date.now();
  if (now - (meta.lastBlocksReqAt || 0) < SNAP_REQ_MIN_MS) return; // anti-spam
  meta.lastBlocksReqAt = now;
  send(ws, { t: 'city_blocks', ...districtManifest(meta.cityId, cityPresenceMap()), event: districtEventSnapshotShim() });
}
function routeRequest(ws, meta, data) {
  if (!meta.playerId) { send(ws, { t: 'city_error', code: 'no_identity', message: 'Must city_join first' }); return; }
  const now = Date.now();
  if (now - (meta.lastRouteReqAt || 0) < SNAP_REQ_MIN_MS) return; // anti-spam
  meta.lastRouteReqAt = now;
  // The SOURCE block is server-owned (meta.cityId, fixed by the connection URL); the target is untrusted.
  const res = validateRouteRequest(meta.cityId, data.target_city_id);
  if (!res.ok) { send(ws, { t: 'city_route_result', ok: false, reason: res.reason, public_safe: true }); return; }
  send(ws, { t: 'city_route_result', ok: true, from_city_id: meta.cityId, target_city_id: res.target_city_id, ws_hint: res.ws_hint, public_safe: true });
}

// Phase 7E — server-confirmed interaction receipt (DO parity; reuses the shared pure builder).
let interactionSeq = 0;
function interactionRequest(ws, meta, data) {
  if (!meta.playerId) { send(ws, { t: 'city_error', code: 'no_identity', message: 'Must city_join first' }); return; }
  const now = Date.now();
  if (now - (meta.lastInteractionReqAt || 0) < SNAP_REQ_MIN_MS) return; // anti-spam
  meta.lastInteractionReqAt = now;
  const player = cityState(meta.cityId).players[meta.playerId];
  const receiptId = `ix-${meta.cityId}-${now}-${++interactionSeq}`;
  const receipt = buildInteractionReceipt({
    playerPos: player ? { x: player.x, y: player.y } : null,
    cityId: meta.cityId,
    request: data,
    receiptId,
    now,
  });
  send(ws, { t: 'city_interaction_receipt', ...receipt });
}

function input(ws, meta, data) {
  if (!meta.playerId) { send(ws, { t: 'city_error', code: 'no_identity', message: 'Must city_join first' }); return; }
  const now = Date.now();
  const res = applyInput(cityState(meta.cityId), meta.playerId, data, now);
  cities[meta.cityId] = res.state;
  if (res.accepted) { snapshot(meta.cityId, now); tickTrial(meta.cityId); tickObjectives(meta.cityId); } // Phase 4G trial step + Phase 7C objective eval — canonical moves only
}

function portal(ws, meta, data) {
  if (!meta.playerId) { send(ws, { t: 'city_error', code: 'no_identity', message: 'Must city_join first' }); return; }
  const portalId = data.portalId;
  emit(meta.cityId, 'city_portal_enter_requested', meta.playerId, { portalId });
  const res = enterPortal(cityState(meta.cityId), meta.playerId, portalId);
  if (!res.ok) { emit(meta.cityId, 'city_portal_enter_rejected', meta.playerId, { portalId, reason: res.reason }); send(ws, { t: 'city_error', code: `portal_${res.reason}`, message: 'portal entry denied' }); evaluateScheduler(meta.cityId); return; }
  emit(meta.cityId, 'city_portal_enter_accepted', meta.playerId, { portalId, target: res.target });
  if (!meta.interiorOpen) { meta.interiorOpen = true; emit(meta.cityId, 'city_arcade_interior_opened', meta.playerId, { portalId }); }
  send(ws, { t: 'city_portal_ok', portalId, target: res.target });
  evaluateScheduler(meta.cityId);
}

function portalClose(ws, meta) {
  if (!meta.playerId || !meta.interiorOpen) return;
  meta.interiorOpen = false;
  emit(meta.cityId, 'city_arcade_interior_closed', meta.playerId, {});
  evaluateScheduler(meta.cityId);
}

function eventsRequest(ws, meta) {
  const now = Date.now();
  if (now - (meta.lastEvReqAt || 0) < SNAP_REQ_MIN_MS) return; // anti-spam
  meta.lastEvReqAt = now;
  send(ws, { t: 'city_events', ...cityEventsPayload(eventLog(meta.cityId)) });
}

function drop(ws, announce = false) {
  const meta = sockets.get(ws);
  if (!meta) return;
  sockets.delete(ws);
  if (announce) { try { ws.close(1000, 'left'); } catch { /* closing */ } }
  if (meta.interiorOpen && meta.playerId) { meta.interiorOpen = false; emit(meta.cityId, 'city_arcade_interior_closed', meta.playerId, {}); }
  if (!meta.playerId || hasSocketFor(meta.cityId, meta.playerId)) return;
  cities[meta.cityId] = removePlayer(cityState(meta.cityId), meta.playerId);
  broadcast(meta.cityId, { t: 'city_player_left', id: meta.playerId }); // legacy
  emit(meta.cityId, 'city_player_left', meta.playerId, {});             // canonical append-only event (once)
  snapshot(meta.cityId, Date.now());
  // Phase 4G: a leaver also leaves any active trial (the instance is non-destructive).
  if (trials[meta.cityId] && trials[meta.cityId].players && trials[meta.cityId].players[meta.playerId]) {
    trials[meta.cityId] = removeTrialPlayer(trials[meta.cityId], meta.playerId);
    broadcastTrial(meta.cityId);
  }
  evaluateScheduler(meta.cityId);
  broadcastDistrictPresence(); // Phase 5D: occupancy dropped — push the delta live (no polling)
}

function dispatch(ws, meta, data) {
  switch (data.t) {
    case 'city_join': join(ws, meta, data); break;
    case 'city_input': input(ws, meta, data); break;
    case 'city_scheduler_request': schedulerRequest(ws, meta); break;
    case 'city_host_rank_request': hostRankRequest(ws, meta); break;
    case 'city_stewardship_request': stewardshipRequest(ws, meta, data); break;
    case 'city_block_trial_request': trialRequest(ws, meta); break;
    case 'city_block_trial_join_request': trialJoin(ws, meta); break;
    case 'city_block_trial_leave': trialLeave(ws, meta); break;
    case 'city_block_trial_close_request': trialClose(ws, meta); break;
    case 'city_blocks_request': blocksRequest(ws, meta); break;
    case 'city_route_request': routeRequest(ws, meta, data); break;
    case 'city_interaction_request': interactionRequest(ws, meta, data); break;
    case 'city_snapshot_request': {
      const now = Date.now();
      if (now - (meta.lastSnapReqAt || 0) < SNAP_REQ_MIN_MS) break; // anti-spam
      meta.lastSnapReqAt = now;
      send(ws, { t: 'city_snapshot', cityId: meta.cityId, ...citySnapshot(cityState(meta.cityId), now) });
      break;
    }
    case 'city_events_request': eventsRequest(ws, meta); break;
    case 'city_portal_enter':
    case 'city_portal_enter_request': portal(ws, meta, data); break;
    case 'city_portal_close_request': portalClose(ws, meta); break;
    case 'city_leave': drop(ws, true); break;
    case 'heartbeat': { if (meta.playerId) cities[meta.cityId] = touchPlayer(cityState(meta.cityId), meta.playerId, Date.now()); break; }
    default: send(ws, { t: 'city_error', code: 'unknown_type', message: `Unknown message type: ${data.t}` });
  }
}

const wss = new WebSocketServer({ port: PORT, path: '/arcade/city/ws' });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  sockets.set(ws, { playerId: null, cityId: resolveCityRoomId(url.searchParams.get('city')).cityId });
  ws.on('message', (buf) => {
    let data;
    try { data = JSON.parse(buf.toString()); } catch { send(ws, { t: 'city_error', code: 'bad_json', message: 'Invalid JSON' }); return; }
    dispatch(ws, sockets.get(ws), data);
  });
  ws.on('close', () => drop(ws));
  ws.on('error', () => drop(ws));
});

// Coarse stale-player sweep — parity with the CityRoom DO alarm.
setInterval(() => {
  const now = Date.now();
  for (const cityId of Object.keys(cities)) {
    for (const id of stalePlayerIds(cities[cityId], now)) {
      if (hasSocketFor(cityId, id)) continue;
      cities[cityId] = removePlayer(cities[cityId], id);
      broadcast(cityId, { t: 'city_player_left', id }); // legacy
      emit(cityId, 'city_player_left', id, {});         // canonical append-only event
      snapshot(cityId, now);
    }
    evaluateScheduler(cityId); // Phase 4D: periodic decay
  }
  broadcastDistrictPresence(); // Phase 5D: periodic refresh — push any population/health delta live
}, STALE_SWEEP_MS);

console.log(`[city-dev-shim] listening on ws://127.0.0.1:${PORT}/arcade/city/ws`);
