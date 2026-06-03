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
 */
export function createArcadeLobby({ onSwitch = () => {}, onRefresh = () => {}, onAdmin = () => {} } = {}) {
  let root = null;
  let open = false;
  let rooms = [];
  let currentRoomId = null;
  let connected = false;
  let lastReject = null;
  let adminOpen = false;
  let lastAdmin = null;

  const THEME_ICON = { neon: '🟣', training: '🟢', midnight: '🌙' };
  const STATUS_LABEL = { closed: 'Closed', maintenance: 'Maintenance' };

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
          <span class="lobby-admin-hint">Reset wipes a room's state; status closes it to new joins. Server validates the token.</span>
        </div>
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

    const host = $('rooms');
    if (!rooms.length) {
      host.innerHTML = '<div class="lobby-empty">No rooms available right now.</div>';
    } else {
      host.innerHTML = rooms.map((r) => {
        const isCurrent = r.room_id === currentRoomId;
        const full = typeof r.capacity === 'number' && r.population >= r.capacity;
        const closed = r.status && r.status !== 'open';
        const cabs = r.cabinet_summary ? r.cabinet_summary.count : 0;
        const joinLabel = closed ? (STATUS_LABEL[r.status] || 'Unavailable') : (full ? 'Full' : 'Enter →');
        return `
          <div class="lobby-room${isCurrent ? ' current' : ''}${closed ? ' closed' : ''}" data-room="${r.room_id}">
            <div class="lr-top">
              <span class="lr-ico" aria-hidden="true">${THEME_ICON[r.theme] || '🎮'}</span>
              <span class="lr-name">${escapeHtml(r.display_name)}</span>
              ${closed ? `<span class="lr-status">${STATUS_LABEL[r.status] || r.status}</span>` : ''}
              <span class="lr-pop">${r.population}${typeof r.capacity === 'number' ? '/' + r.capacity : ''} <span class="lr-pop-k">players</span></span>
            </div>
            <div class="lr-desc">${escapeHtml(r.description || '')}</div>
            <div class="lr-foot">
              <span class="lr-cabs">${cabs} cabinet${cabs === 1 ? '' : 's'}</span>
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
      adminOpen = true;
      render();
      onRefresh();
    },
    getRooms() { return rooms.slice(); },
    get element() { return root; },
  };
}
