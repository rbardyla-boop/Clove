/**
 * Arcade Lobby panel (Phase 2a).
 *
 * Renders the public-safe room list and lets the player choose / switch rooms. It
 * forwards intent only — the server validates room joins, owns populations, and
 * scopes all state to the chosen room. The lobby never sees private player data:
 * it is fed only the room_list / room_joined / room_population envelopes.
 *
 * createArcadeLobby({ onSwitch, onRefresh })
 *   -> { open, close, isOpen, setRooms, setCurrentRoom, setConnection,
 *        setPopulation, showRejection, getRooms }
 *
 * Phase 2d: smart-lobby UX (recommendations, presence-driven sorting, activity
 * summaries, recovery hints) computed PURELY from the public room-presence list via
 * ./room-recommend.mjs — no server change, no private data.
 */
import { roomActivity, recommendRooms, sortRoomsForLobby, roomRecoveryHint } from './room-recommend.mjs';

export function createArcadeLobby({ onSwitch = () => {}, onRefresh = () => {}, onAdmin = () => {} } = {}) {
  let root = null;
  let open = false;
  let rooms = [];
  let currentRoomId = null;
  let connected = false;
  let lastReject = null;
  let adminOpen = false;
  let lastAdmin = null;
  let lastDiag = null; // Phase 2c: last admin diagnostics payload (admin panel only)

  const THEME_ICON = { neon: '🟣', training: '🟢', midnight: '🌙' };
  const STATUS_LABEL = { closed: 'Closed', maintenance: 'Maintenance' };
  // Phase 2c: public-safe room health → label + badge class.
  const HEALTH_LABEL = { healthy: 'Healthy', stale: 'Stale', offline: 'Offline', closed: 'Closed', maintenance: 'Maintenance', unknown: 'Unknown' };
  const HEALTH_WARN = new Set(['stale', 'offline']); // open but degraded: warn, still joinable

  function build() {
    root = document.createElement('div');
    root.className = 'lobby-overlay';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Arcade room lobby');
    root.innerHTML = `
      <div class="lobby-panel">
        <div class="lobby-head">
          <div class="lobby-title">CHOOSE A <span>ROOM</span></div>
          <div class="lobby-actions">
            <button class="lobby-refresh" type="button" data-act="admin" title="Room admin tools">⚙</button>
            <button class="lobby-refresh" type="button" data-act="refresh" title="Refresh room list">↻</button>
            <button class="lobby-close" type="button" data-act="close" title="Close">✕</button>
          </div>
        </div>
        <div class="lobby-sub" data-f="sub"></div>
        <div class="lobby-admin" data-f="admin" hidden>
          <label class="lobby-admin-lbl">Admin token <input class="lobby-admin-tok" data-f="token" type="password" placeholder="admin token (server-gated)" autocomplete="off"></label>
          <div class="lobby-admin-row">
            <button class="lr-adm" type="button" data-act="admin-diag">Diagnostics</button>
            <span class="lobby-admin-hint">Reset wipes a room's state; status closes it to new joins; diagnostics reads room health. Server validates the token.</span>
          </div>
          <div class="lobby-diag" data-f="diag" hidden></div>
        </div>
        <div class="lobby-recos" data-f="recos" hidden></div>
        <div class="lobby-rooms" data-f="rooms"></div>
        <div class="lobby-err" data-f="err" hidden></div>
        <div class="lobby-adminmsg" data-f="adminmsg" hidden></div>
        <p class="lobby-foot">Each room has its own tickets, inventory, challenges and feed. Nothing carries across rooms.</p>
      </div>`;
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      const act = btn?.dataset.act;
      const roomId = e.target.closest('[data-room]')?.dataset.room;
      if (act === 'close') close();
      else if (act === 'refresh') onRefresh();
      else if (act === 'admin') { adminOpen = !adminOpen; render(); }
      else if (act === 'join') { if (roomId && roomId !== currentRoomId) onSwitch(roomId); }
      else if (act === 'admin-reset') { if (roomId) onAdmin('reset', roomId, null, tokenValue()); }
      else if (act === 'admin-status') { if (roomId) onAdmin('set_status', roomId, btn.dataset.status, tokenValue()); }
      else if (act === 'admin-diag') { onAdmin('diagnostics', null, null, tokenValue()); }
      // click on the backdrop closes
      if (e.target === root) close();
    });
    document.body.appendChild(root);
    render();
  }

  function $(f) { return root.querySelector(`[data-f="${f}"]`); }
  function tokenValue() { const i = $('token'); return i ? i.value : ''; }

  // Per-room admin controls (shown only when the ⚙ admin panel is open).
  function adminRow(r) {
    return `
      <div class="lr-admin">
        <button class="lr-adm" type="button" data-act="admin-reset">Reset</button>
        <button class="lr-adm" type="button" data-act="admin-status" data-status="open">Open</button>
        <button class="lr-adm" type="button" data-act="admin-status" data-status="closed">Close</button>
        <button class="lr-adm" type="button" data-act="admin-status" data-status="maintenance">Maint.</button>
      </div>`;
  }

  function render() {
    if (!root) return;
    const sub = $('sub');
    sub.textContent = connected
      ? `Connected · current room: ${currentRoomName()}`
      : 'Connecting to the arcade…';
    sub.className = 'lobby-sub' + (connected ? ' ok' : '');

    renderRecos();

    const host = $('rooms');
    if (!rooms.length) {
      host.innerHTML = '<div class="lobby-empty">No rooms available right now.</div>';
    } else {
      // Phase 2d: presence-driven order (active healthy first … closed/maint last).
      // The stored `rooms` array is left untouched (getRooms stays as-received).
      host.innerHTML = sortRoomsForLobby(rooms).map((r) => {
        const isCurrent = r.room_id === currentRoomId;
        const full = typeof r.capacity === 'number' && r.population >= r.capacity;
        const closed = r.status && r.status !== 'open';
        const cabs = r.cabinet_summary ? r.cabinet_summary.count : 0;
        // Phase 2c: join gating is driven by STATUS (closed/maintenance disable),
        // never by health freshness — a stale/offline room is still configured open
        // and a fresh join re-instantiates its authority, so we WARN but allow it.
        const health = r.health || (closed ? r.status : 'unknown');
        const warn = HEALTH_WARN.has(health);
        const estimated = r.population_is_estimated === true;
        const profileLabel = r.profile_label;
        const activity = roomActivity(r);                 // Phase 2d public-safe activity
        const hint = isCurrent ? null : roomRecoveryHint(r); // Phase 2d actionable recovery
        const popText = `${estimated ? '~' : ''}${r.population}${typeof r.capacity === 'number' ? '/' + r.capacity : ''}`;
        const popTitle = estimated ? `Estimated — ${HEALTH_LABEL[health] || health} room (population not fresh)` : 'Live population';
        const joinLabel = closed ? (STATUS_LABEL[r.status] || 'Unavailable') : (full ? 'Full' : 'Enter →');
        return `
          <div class="lobby-room${isCurrent ? ' current' : ''}${closed ? ' closed' : ''}${warn ? ' degraded' : ''}" data-room="${r.room_id}" data-health="${health}" data-activity="${activity.level}">
            <div class="lr-top">
              <span class="lr-ico" aria-hidden="true">${THEME_ICON[r.theme] || '🎮'}</span>
              <span class="lr-name">${escapeHtml(r.display_name)}</span>
              ${profileLabel ? `<span class="lr-profile">${escapeHtml(profileLabel)}</span>` : ''}
              <span class="lr-health lr-health-${health}" title="Room health: ${HEALTH_LABEL[health] || health}">${HEALTH_LABEL[health] || health}</span>
              ${closed ? `<span class="lr-status">${STATUS_LABEL[r.status] || r.status}</span>` : ''}
              <span class="lr-pop" title="${popTitle}">${popText} <span class="lr-pop-k">players</span></span>
            </div>
            <div class="lr-desc">${escapeHtml(r.description || '')}</div>
            ${hint ? `<div class="lr-warn">${escapeHtml(hint)}</div>` : ''}
            <div class="lr-foot">
              <span class="lr-cabs">${cabs} cabinet${cabs === 1 ? '' : 's'}</span>
              <span class="lr-activity lr-activity-${activity.level}" title="Room activity">${activity.label}</span>
              ${isCurrent
                ? '<span class="lr-here">● You are here</span>'
                : `<button class="lr-join" type="button" data-act="join" ${full || closed ? 'disabled' : ''}>${joinLabel}</button>`}
            </div>
            ${adminOpen ? adminRow(r) : ''}
          </div>`;
      }).join('');
    }

    const err = $('err');
    if (lastReject) { err.hidden = false; err.textContent = lastReject; }
    else { err.hidden = true; }

    const adminEl = $('admin');
    if (adminEl) adminEl.hidden = !adminOpen;
    const am = $('adminmsg');
    if (am) { if (adminOpen && lastAdmin) { am.hidden = false; am.textContent = lastAdmin; } else { am.hidden = true; } }

    const diagEl = $('diag');
    if (diagEl) {
      if (adminOpen && Array.isArray(lastDiag) && lastDiag.length) {
        diagEl.hidden = false;
        diagEl.innerHTML = lastDiag.map((d) => `
          <div class="lobby-diag-row">
            <span class="ld-room">${escapeHtml(d.room_id)}</span>
            <span class="ld-h lr-health-${d.health}">${HEALTH_LABEL[d.health] || d.health}</span>
            <span class="ld-num" title="population">pop ${d.population}</span>
            <span class="ld-num" title="active connections">conn ${d.active_connection_count}</span>
            <span class="ld-num" title="active rounds">rnd ${d.active_round_count}</span>
            <span class="ld-num" title="occupied cabinets">cab ${d.occupied_cabinet_count}</span>
            <span class="ld-num" title="reset generation">gen ${d.reset_generation}</span>
          </div>`).join('');
      } else {
        diagEl.hidden = true;
      }
    }
  }

  // Phase 2d: smart recommendations banner — busiest healthy room, training room,
  // and a quiet room to revive. Targets are JOINABLE rooms only and never the
  // current room. Clicking a chip routes the player there (same join intent).
  function renderRecos() {
    const el = $('recos');
    if (!el) return;
    const { busiest, training, revive } = recommendRooms(rooms, { currentRoomId });
    const seen = new Set([currentRoomId]);
    const chips = [];
    const add = (kind, label, r) => {
      if (!r || seen.has(r.room_id)) return;
      seen.add(r.room_id);
      chips.push(`<button class="lr-reco lr-reco-${kind}" type="button" data-act="join" data-room="${r.room_id}" title="Join ${escapeHtml(r.display_name)}">
        <span class="lr-reco-k">${label}</span><span class="lr-reco-name">${escapeHtml(r.display_name)}</span></button>`);
    };
    add('busiest', '🔥 Busiest', busiest);
    add('training', '🎓 New? Try', training);
    add('revive', '✨ Revive', revive);
    if (!chips.length) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = `<div class="lr-reco-title">Recommended</div><div class="lr-reco-row">${chips.join('')}</div>`;
  }

  function currentRoomName() {
    const r = rooms.find((x) => x.room_id === currentRoomId);
    return r ? r.display_name : (currentRoomId || '—');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  return {
    open() { if (!root) build(); open = true; root.classList.add('show'); onRefresh(); render(); },
    close() { if (!root) return; open = false; root.classList.remove('show'); },
    isOpen() { return open; },
    setRooms(list) { rooms = Array.isArray(list) ? list : []; lastReject = null; render(); },
    setCurrentRoom(roomId) { currentRoomId = roomId; render(); },
    setConnection(isConnected) { connected = !!isConnected; render(); },
    setPopulation(roomId, population) {
      const r = rooms.find((x) => x.room_id === roomId);
      if (r) { r.population = Math.max(0, Number(population) || 0); render(); }
    },
    showRejection(reason, roomId) {
      lastReject = reason === 'room_full' ? `That room is full${roomId ? ` (${roomId})` : ''}.`
        : reason === 'invalid_room' ? 'That room does not exist.'
        : reason === 'room_closed' ? 'That room is closed.'
        : reason === 'room_maintenance' ? 'That room is under maintenance.'
        : `Could not join room: ${reason}`;
      render();
    },
    setAdminResult(result) {
      lastAdmin = result && result.ok
        ? `✓ ${result.op || 'admin'}${result.roomId ? ' · ' + result.roomId : ''}${result.status ? ' → ' + result.status : ''}`
        : `✕ admin: ${(result && result.reason) || 'failed'}`;
      // Phase 2c: capture diagnostics payload (admin-only). Cleared on failure.
      if (result && result.ok && result.op === 'diagnostics' && Array.isArray(result.diagnostics)) lastDiag = result.diagnostics;
      else if (result && !result.ok) lastDiag = null;
      adminOpen = true;
      render();
      if (!(result && result.op === 'diagnostics')) onRefresh();
    },
    getRooms() { return rooms.slice(); },
    get element() { return root; },
  };
}
