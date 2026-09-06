// Paper Firm — First Shift field authority core.
// Pure and runtime-agnostic. The field authority owns movement/presence and
// extraction eligibility only. It never creates RUG observations or knowledge.

export const PF_PROTOCOL = 'PF-FIELD/1';
export const PF_WORLD = Object.freeze({ w: 1000, h: 700 });
export const PF_MOVE = Object.freeze({ maxSpeed: 220, maxDtMs: 250, minInputMs: 33 });
export const PF_PLAYER_RADIUS = 12;

export const PF_ZONES = Object.freeze([
  Object.freeze({ id: 'DESK', x: 70, y: 470, w: 240, h: 150, label: 'THE DESK' }),
  Object.freeze({ id: 'STAIN', x: 390, y: 70, w: 220, h: 220, label: 'THE STAIN' }),
  Object.freeze({ id: 'ARCHIVE', x: 690, y: 70, w: 230, h: 210, label: 'ARCHIVE' }),
]);

export const PF_RELAY = Object.freeze({ id: 'RELAY', x: 715, y: 455, w: 160, h: 170, label: 'RELAY' });
export const PF_PAGE = Object.freeze({ id: 'PAGE-7', sourceX: 500, sourceY: 170, archiveX: 805, archiveY: 175 });
export const PF_SPAWNS = Object.freeze([
  Object.freeze({ x: 145, y: 390 }),
  Object.freeze({ x: 220, y: 390 }),
  Object.freeze({ x: 300, y: 390 }),
]);

export function sanitizeMatchId(raw) {
  if (typeof raw !== 'string') return '';
  const value = raw.trim().toUpperCase();
  return /^[A-Z0-9_-]{2,32}$/.test(value) ? value : '';
}

export function validPlayerId(raw) {
  return typeof raw === 'string' && /^[A-Za-z0-9:_-]{1,96}$/.test(raw);
}

export function pointInRect(pos, rect) {
  if (!pos || !rect) return false;
  const x = Number(pos.x), y = Number(pos.y);
  return Number.isFinite(x) && Number.isFinite(y) && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function createFieldState() {
  return {
    players: {},
    sequence: 0,
    scout: { phase: 'idle', x: PF_PAGE.sourceX, y: PF_PAGE.sourceY, sequence: 0, findSequence: 0, findAt: 0, carrySequence: 0, carryAt: 0 },
    page: { id: PF_PAGE.id, phase: 'in_stain', x: PF_PAGE.sourceX, y: PF_PAGE.sourceY, extractedBy: '', pendingReceipt: null },
  };
}

export function addFieldPlayer(state, playerId, now = Date.now()) {
  if (!validPlayerId(playerId)) return { ok: false, reason: 'invalid_player', state };
  if (state.players[playerId]) {
    return {
      ok: true,
      reason: 'rejoined',
      state: {
        ...state,
        players: { ...state.players, [playerId]: { ...state.players[playerId], online: true, lastInputAt: now } },
      },
    };
  }
  const spawn = PF_SPAWNS[Object.keys(state.players).length % PF_SPAWNS.length];
  return {
    ok: true,
    reason: 'joined',
    state: {
      ...state,
      players: { ...state.players, [playerId]: { id: playerId, x: spawn.x, y: spawn.y, online: true, lastInputAt: now } },
    },
  };
}

export function removeFieldPlayer(state, playerId) {
  if (!state.players[playerId]) return state;
  return { ...state, players: { ...state.players, [playerId]: { ...state.players[playerId], online: false } } };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Solid furniture matching the drawn DESK / ARCHIVE / RELAY boxes.
// Soft collision: slide along edges so walls matter without hard stuck corners.
export const PF_SOLIDS = Object.freeze([
  Object.freeze({ id: 'desk_top', x: 105, y: 505, w: 170, h: 90 }),
  Object.freeze({ id: 'files', x: 708, y: 98, w: 70, h: 150 }),
  Object.freeze({ id: 'source', x: 820, y: 98, w: 70, h: 150 }),
  Object.freeze({ id: 'relay_base', x: 749, y: 510, w: 92, h: 95 }),
]);

function circleHitsSolid(cx, cy, r, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return (dx * dx + dy * dy) < (r * r);
}

function blockedAt(x, y) {
  return PF_SOLIDS.some((solid) => circleHitsSolid(x, y, PF_PLAYER_RADIUS, solid));
}

function resolveSoftMove(px, py, nx, ny) {
  const worldX = clamp(nx, PF_PLAYER_RADIUS, PF_WORLD.w - PF_PLAYER_RADIUS);
  const worldY = clamp(ny, PF_PLAYER_RADIUS, PF_WORLD.h - PF_PLAYER_RADIUS);
  if (!blockedAt(worldX, worldY)) return { x: worldX, y: worldY, bumped: false };
  const slideX = clamp(nx, PF_PLAYER_RADIUS, PF_WORLD.w - PF_PLAYER_RADIUS);
  if (!blockedAt(slideX, py)) return { x: slideX, y: py, bumped: true };
  const slideY = clamp(ny, PF_PLAYER_RADIUS, PF_WORLD.h - PF_PLAYER_RADIUS);
  if (!blockedAt(px, slideY)) return { x: px, y: slideY, bumped: true };
  return { x: px, y: py, bumped: true };
}

export function applyFieldInput(state, playerId, input, now = Date.now()) {
  const p = state.players[playerId];
  if (!p) return { ok: false, reason: 'not_joined', state };
  const dx = Number(input?.dx), dy = Number(input?.dy);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { ok: false, reason: 'bad_input', state };
  const elapsed = Math.max(0, now - Number(p.lastInputAt || now));
  if (elapsed < PF_MOVE.minInputMs) return { ok: false, reason: 'too_fast', state };
  const dt = Math.min(PF_MOVE.maxDtMs, elapsed) / 1000;
  const len = Math.hypot(dx, dy);
  const ux = len > 1 ? dx / len : dx;
  const uy = len > 1 ? dy / len : dy;
  const rawX = p.x + ux * PF_MOVE.maxSpeed * dt;
  const rawY = p.y + uy * PF_MOVE.maxSpeed * dt;
  const resolved = resolveSoftMove(p.x, p.y, rawX, rawY);
  const next = {
    ...p,
    x: resolved.x,
    y: resolved.y,
    lastInputAt: now,
    bumped: resolved.bumped,
  };
  return {
    ok: true,
    reason: resolved.bumped ? 'soft_bump' : 'ok',
    bumped: resolved.bumped,
    state: { ...state, players: { ...state.players, [playerId]: next } },
  };
}

export function advanceScout(state, verb, actor = {}, now = Date.now()) {
  const player = state.players?.[actor.playerId];
  const stain = PF_ZONES.find((zone) => zone.id === 'STAIN');
  if (actor.role !== 'lead') return { ok: false, reason: 'field_lead_required', state };
  if (!player) return { ok: false, reason: 'not_joined', state };
  if (!pointInRect(player, stain)) return { ok: false, reason: 'scout_requires_stain_position', state };
  const phase = state.scout?.phase || 'idle';
  if (verb === 'find' && phase === 'idle') {
    const sequence = Number(state.scout?.sequence || 0) + 1;
    return { ok: true, reason: 'found', state: { ...state, scout: { phase: 'found', x: PF_PAGE.sourceX, y: PF_PAGE.sourceY, sequence, findSequence: sequence, findAt: now, carrySequence: 0, carryAt: 0 } } };
  }
  if (verb === 'carry' && phase === 'found') {
    const sequence = Number(state.scout?.sequence || 0) + 1;
    return {
      ok: true,
      reason: 'carried',
      state: {
        ...state,
        scout: { ...state.scout, phase: 'ready', x: PF_PAGE.archiveX, y: PF_PAGE.archiveY, sequence, carrySequence: sequence, carryAt: now },
        page: { ...state.page, phase: 'at_archive', x: PF_PAGE.archiveX, y: PF_PAGE.archiveY },
      },
    };
  }
  return { ok: false, reason: 'scout_phase_mismatch', state };
}

export function canExtract(state, playerId) {
  const player = state.players[playerId];
  const archive = PF_ZONES.find((z) => z.id === 'ARCHIVE');
  if (!player) return { ok: false, reason: 'not_joined' };
  if (state.scout?.phase !== 'ready' || state.page?.phase !== 'at_archive' || !(state.scout?.findSequence > 0) || !(state.scout?.carrySequence > state.scout?.findSequence) || !(state.scout?.findAt > 0) || !(state.scout?.carryAt >= state.scout?.findAt)) return { ok: false, reason: 'page_not_delivered' };
  if (state.page?.extractedBy) return { ok: false, reason: 'page_already_extracted' };
  if (!pointInRect(player, archive)) return { ok: false, reason: 'not_in_archive' };
  return { ok: true, reason: 'ok' };
}

export function extractPage(state, playerId) {
  const check = canExtract(state, playerId);
  if (!check.ok) return { ...check, state };
  const sequence = Number(state.sequence || 0) + 1;
  return {
    ok: true,
    reason: 'ok',
    sequence,
    state: {
      ...state,
      sequence,
      page: { ...state.page, phase: 'extracted', extractedBy: playerId },
    },
  };
}

export function publicFieldSnapshot(state, matchId) {
  return {
    protocol: PF_PROTOCOL,
    match_id: matchId,
    world: PF_WORLD,
    zones: PF_ZONES,
    relay: PF_RELAY,
    players: Object.values(state.players).filter((p) => p.online !== false).map((p) => ({ id: p.id, x: p.x, y: p.y })),
    scout: { phase: state.scout.phase, x: state.scout.x, y: state.scout.y, findSequence: state.scout.findSequence, findAt: state.scout.findAt, carrySequence: state.scout.carrySequence, carryAt: state.scout.carryAt },
    page: { id: state.page.id, phase: state.page.phase, x: state.page.x, y: state.page.y, pendingReceipt: state.page.pendingReceipt || null },
    sequence: state.sequence,
  };
}
