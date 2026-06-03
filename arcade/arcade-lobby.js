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
export function createArcadeLobby({ onSwitch = () => {}, onRefresh = () => {} } = {}) {
  let root = null;
  let open = false;
  let rooms = [];
  let currentRoomId = null;
  let connected = false;
  let lastReject = null;

  const THEME_ICON = { neon: '🟣', training: '🟢', midnight: '🌙' };

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
            <button class="lobby-refresh" type="button" data-act="refresh" title="Refresh room list">↻</button>
            <button class="lobby-close" type="button" data-act="close" title="Close">✕</button>
          </div>
        </div>
        <div class="lobby-sub" data-f="sub"></div>
        <div class="lobby-rooms" data-f="rooms"></div>
        <div class="lobby-err" data-f="err" hidden></div>
        <p class="lobby-foot">Each room has its own tickets, inventory, challenges and feed. Nothing carries across rooms.</p>
      </div>`;
    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'close') close();
      else if (act === 'refresh') onRefresh();
      else if (act === 'join') {
        const id = e.target.closest('[data-room]')?.dataset.room;
        if (id && id !== currentRoomId) onSwitch(id);
      }
      // click on the backdrop closes
      if (e.target === root) close();
    });
    document.body.appendChild(root);
    render();
  }

  function $(f) { return root.querySelector(`[data-f="${f}"]`); }

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
        const cabs = r.cabinet_summary ? r.cabinet_summary.count : 0;
        return `
          <div class="lobby-room${isCurrent ? ' current' : ''}" data-room="${r.room_id}">
            <div class="lr-top">
              <span class="lr-ico" aria-hidden="true">${THEME_ICON[r.theme] || '🎮'}</span>
              <span class="lr-name">${escapeHtml(r.display_name)}</span>
              <span class="lr-pop">${r.population}${typeof r.capacity === 'number' ? '/' + r.capacity : ''} <span class="lr-pop-k">players</span></span>
            </div>
            <div class="lr-desc">${escapeHtml(r.description || '')}</div>
            <div class="lr-foot">
              <span class="lr-cabs">${cabs} cabinet${cabs === 1 ? '' : 's'}</span>
              ${isCurrent
                ? '<span class="lr-here">● You are here</span>'
                : `<button class="lr-join" type="button" data-act="join" ${full ? 'disabled' : ''}>${full ? 'Full' : 'Enter →'}</button>`}
            </div>
          </div>`;
      }).join('');
    }

    const err = $('err');
    if (lastReject) { err.hidden = false; err.textContent = lastReject; }
    else { err.hidden = true; }
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
        : `Could not join room: ${reason}`;
      render();
    },
    getRooms() { return rooms.slice(); },
    get element() { return root; },
  };
}
