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
 *
 * Phase 2e: each room card surfaces its current scheduled event (name + short kind +
 * countdown), a next-event preview, and an event-aware warmup hint — all read from the
 * public `current_event`/`next_event` the server attaches to the room list. Events are
 * DISPLAY-ONLY: no ticket change, no reward, no economy. Joining stays exactly as before.
 */
import {
  roomActivity, recommendRooms, sortRoomsForLobby, roomRecoveryHint,
  roomEventBadge, roomNextEventLabel, roomEventWarmupHint, formatEventCountdown,
  roomUpcomingPreroll, formatPrerollCountdown,
} from './room-recommend.mjs';

export function createArcadeLobby({ onSwitch = () => {}, onRefresh = () => {}, onAdmin = () => {}, adminUi = false } = {}) {
  let root = null;
  let open = false;
  let rooms = [];
  let currentRoomId = null;
  let connected = false;
  let lastReject = null;
  let presentation = null; // Phase 2h: operator display flags (show_next_event / show_featured_chip)
  let adminOpen = false;
  let lastAdmin = null;
  let lastDiag = null; // Phase 2c: last admin diagnostics payload (admin panel only)
  let lastOps = null;  // Phase 2i: last presentation_diagnostics payload (admin panel only)
  let lastOpsResult = null; // Phase 2i: last preview/apply/clear effective config (admin panel only)

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
    // The operator live-ops (admin) entry point is HIDDEN for public players. It only
    // renders when explicitly enabled (?admin=1 or window.__NEON_ARCADE_CONFIG__.showAdmin).
    // The server still enforces the real both-gate; this only keeps the admin UI out of a
    // public playtester's way. The hidden admin panel markup is always present so render()
    // element lookups stay valid; without the gear there is no way to open it.
    const adminBtnHtml = adminUi
      ? '<button class="lobby-refresh" type="button" data-act="admin" aria-label="Room admin tools" title="Room admin tools">⚙</button>'
      : '';
    root.innerHTML = `
      <div class="lobby-panel">
        <div class="lobby-head">
          <div class="lobby-title">CHOOSE A <span>ROOM</span></div>
          <div class="lobby-actions">
            ${adminBtnHtml}
            <button class="lobby-refresh" type="button" data-act="refresh" aria-label="Refresh room list" title="Refresh room list">↻</button>
            <button class="lobby-close" type="button" data-act="close" aria-label="Close lobby" title="Close">✕</button>
          </div>
        </div>
        <div class="lobby-sub" data-f="sub"></div>
        <div class="lobby-admin" data-f="admin" hidden>
          <label class="lobby-admin-lbl">Admin token <input class="lobby-admin-tok" data-f="token" type="password" placeholder="admin token (server-gated)" autocomplete="off"></label>
          <div class="lobby-admin-row">
            <button class="lr-adm" type="button" data-act="admin-diag">Diagnostics</button>
            <button class="lr-adm" type="button" data-act="ops-diag">Presentation</button>
            <span class="lobby-admin-hint">Reset wipes a room's state; status closes it to new joins; diagnostics reads room health; presentation shows per-room display overrides. Server validates the token.</span>
          </div>
          <div class="lobby-diag" data-f="diag" hidden></div>
          <div class="lobby-ops" data-f="ops" hidden></div>
          <div class="lobby-opsmsg" data-f="opsmsg" hidden></div>
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
      // Phase 2i: live-ops, DISPLAY-ONLY per-room presentation overrides. The override is
      // gathered from this room's inputs; the server sanitizes/clamps + gates by token.
      else if (act === 'ops-preview') { if (roomId) onAdmin('preview_presentation', roomId, null, tokenValue(), opsOverrideFor(roomId)); }
      else if (act === 'ops-apply') { if (roomId) onAdmin('set_presentation', roomId, null, tokenValue(), opsOverrideFor(roomId)); }
      else if (act === 'ops-clear') { if (roomId) onAdmin('clear_presentation', roomId, null, tokenValue()); }
      else if (act === 'ops-diag') { onAdmin('presentation_diagnostics', null, null, tokenValue()); }
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
    // Phase 2i: pre-fill the live-ops inputs from this room's EFFECTIVE presentation
    // (base ⊕ override, server-resolved). `overridden` = effective differs from the
    // operator/base config, so the operator can see at a glance which rooms are tuned.
    const p = (r.presentation && typeof r.presentation === 'object') ? r.presentation : presentation || {};
    const base = presentation || {};
    const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const preroll = num(p.preroll_lead_ms, '');
    const refresh = num(p.countdown_refresh_ms, '');
    const showNext = p.show_next_event !== false;
    const showFeatured = p.show_featured_chip !== false;
    const overridden = base && (p.preroll_lead_ms !== base.preroll_lead_ms || p.countdown_refresh_ms !== base.countdown_refresh_ms
      || p.show_next_event !== base.show_next_event || p.show_featured_chip !== base.show_featured_chip);
    return `
      <div class="lr-admin">
        <div class="lr-admin-status">
          <button class="lr-adm" type="button" data-act="admin-reset">Reset</button>
          <button class="lr-adm" type="button" data-act="admin-status" data-status="open">Open</button>
          <button class="lr-adm" type="button" data-act="admin-status" data-status="closed">Close</button>
          <button class="lr-adm" type="button" data-act="admin-status" data-status="maintenance">Maint.</button>
        </div>
        <div class="lr-ops" data-ops-room="${r.room_id}">
          <span class="lr-ops-k">Live ops · presentation ${overridden ? '<em class="lr-ops-on">override</em>' : '<em class="lr-ops-off">base</em>'} <span class="lr-ops-note">display-only</span></span>
          <label class="lr-ops-f">Pre-roll <input class="lr-ops-i" data-f-ops="preroll_lead_ms" type="number" min="0" step="1000" value="${preroll}" placeholder="${num(base.preroll_lead_ms, '')}"><span class="lr-ops-u">ms</span></label>
          <label class="lr-ops-f">Countdown <input class="lr-ops-i" data-f-ops="countdown_refresh_ms" type="number" min="0" step="250" value="${refresh}" placeholder="${num(base.countdown_refresh_ms, '')}"><span class="lr-ops-u">ms</span></label>
          <label class="lr-ops-c"><input data-f-ops="show_next_event" type="checkbox" ${showNext ? 'checked' : ''}> Next</label>
          <label class="lr-ops-c"><input data-f-ops="show_featured_chip" type="checkbox" ${showFeatured ? 'checked' : ''}> Featured</label>
          <div class="lr-ops-btns">
            <button class="lr-adm" type="button" data-act="ops-preview">Preview</button>
            <button class="lr-adm lr-adm-go" type="button" data-act="ops-apply">Apply</button>
            <button class="lr-adm" type="button" data-act="ops-clear">Reset override</button>
          </div>
        </div>
      </div>`;
  }

  // Phase 2i: read a room's proposed presentation override from its inputs. Empty number
  // fields are omitted (→ fall through to base on the server); checkboxes always send a
  // bool. The server re-sanitizes/clamps regardless — this is purely the request payload.
  function opsOverrideFor(roomId) {
    const block = root && root.querySelector(`[data-ops-room="${roomId}"]`);
    if (!block) return {};
    const o = {};
    const pl = block.querySelector('[data-f-ops="preroll_lead_ms"]');
    const cr = block.querySelector('[data-f-ops="countdown_refresh_ms"]');
    const sn = block.querySelector('[data-f-ops="show_next_event"]');
    const sf = block.querySelector('[data-f-ops="show_featured_chip"]');
    if (pl && pl.value !== '') o.preroll_lead_ms = Number(pl.value);
    if (cr && cr.value !== '') o.countdown_refresh_ms = Number(cr.value);
    if (sn) o.show_next_event = sn.checked;
    if (sf) o.show_featured_chip = sf.checked;
    return o;
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
        // Phase 2e: event-aware warmup hint takes priority over the plain recovery hint.
        const hint = isCurrent ? null : (roomEventWarmupHint(r) || roomRecoveryHint(r));
        // Phase 2h: operator display flags (default = show everything).
        const showFeatured = !presentation || presentation.show_featured_chip !== false;
        const showNext = !presentation || presentation.show_next_event !== false;
        const ev = showFeatured ? roomEventBadge(r) : null; // Phase 2e current scheduled event
        const nextEv = showNext ? roomNextEventLabel(r) : null; // Phase 2e next-event preview
        const preroll = showNext ? roomUpcomingPreroll(r) : null; // Phase 2g pre-roll (next imminent)
        const popText = `${estimated ? '~' : ''}${r.population}${typeof r.capacity === 'number' ? '/' + r.capacity : ''}`;
        const popTitle = estimated ? `Estimated — ${HEALTH_LABEL[health] || health} room (population not fresh)` : 'Live population';
        const joinLabel = closed ? (STATUS_LABEL[r.status] || 'Unavailable') : (full ? 'Full' : 'Enter →');
        return `
          <div class="lobby-room${isCurrent ? ' current' : ''}${closed ? ' closed' : ''}${warn ? ' degraded' : ''}" data-room="${r.room_id}" data-health="${health}" data-activity="${activity.level}" data-event="${ev ? ev.kind : 'none'}">
            <div class="lr-top">
              <span class="lr-ico" aria-hidden="true">${THEME_ICON[r.theme] || '🎮'}</span>
              <span class="lr-name">${escapeHtml(r.display_name)}</span>
              ${profileLabel ? `<span class="lr-profile">${escapeHtml(profileLabel)}</span>` : ''}
              <span class="lr-health lr-health-${health}" title="Room health: ${HEALTH_LABEL[health] || health}">${HEALTH_LABEL[health] || health}</span>
              ${closed ? `<span class="lr-status">${STATUS_LABEL[r.status] || r.status}</span>` : ''}
              <span class="lr-pop" title="${popTitle}">${popText} <span class="lr-pop-k">players</span></span>
            </div>
            ${ev ? `<div class="lr-event lr-event-${ev.kind}" title="Scheduled room event (display-only)">
              <span class="lr-event-k">${escapeHtml(ev.kind_label)}</span>
              <span class="lr-event-name">${escapeHtml(ev.label)}</span>
              ${ev.ends_in_ms ? `<span class="lr-event-cd" title="Time left in this event">${escapeHtml(formatEventCountdown(ev.ends_in_ms))} left</span>` : ''}
            </div>` : ''}
            <div class="lr-desc">${escapeHtml(r.description || '')}</div>
            ${preroll
              ? `<div class="lr-event-next lr-event-preroll" data-preroll="1" title="Starting soon (display-only)">⏳ Up next in ${escapeHtml(formatPrerollCountdown(preroll.starts_in_ms))} · ${escapeHtml(preroll.label)}</div>`
              : (nextEv ? `<div class="lr-event-next">Next event · ${escapeHtml(nextEv)}</div>` : '')}
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

    // Phase 2i: per-room presentation override diagnostics (admin-only, display-only).
    const opsEl = $('ops');
    if (opsEl) {
      if (adminOpen && lastOps && Array.isArray(lastOps.presentation) && lastOps.presentation.length) {
        const fmtFlags = (e) => `${e.show_next_event === false ? '' : '⏭'}${e.show_featured_chip === false ? '' : '★'}` || '—';
        opsEl.hidden = false;
        opsEl.innerHTML = `<div class="lobby-ops-base">base · pre-roll ${lastOps.base?.preroll_lead_ms ?? '—'}ms · refresh ${lastOps.base?.countdown_refresh_ms ?? '—'}ms</div>`
          + lastOps.presentation.map((e) => {
            const eff = e.effective || {};
            return `<div class="lobby-ops-row${e.override ? ' overridden' : ''}">
              <span class="lo-room">${escapeHtml(e.room_id)}</span>
              <span class="lo-tag">${e.override ? 'override' : 'base'}</span>
              <span class="lo-num" title="pre-roll lead">pre ${eff.preroll_lead_ms ?? '—'}ms</span>
              <span class="lo-num" title="countdown refresh">ref ${eff.countdown_refresh_ms ?? '—'}ms</span>
              <span class="lo-flags" title="show next / show featured">${fmtFlags(eff)}</span>
            </div>`;
          }).join('');
      } else {
        opsEl.hidden = true;
      }
    }
    const opsMsg = $('opsmsg');
    if (opsMsg) {
      if (adminOpen && lastOpsResult) { opsMsg.hidden = false; opsMsg.textContent = lastOpsResult; }
      else { opsMsg.hidden = true; }
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
      const ev = roomEventBadge(r); // Phase 2e: event-aware reco sub-copy (display-only)
      chips.push(`<button class="lr-reco lr-reco-${kind}" type="button" data-act="join" data-room="${r.room_id}" title="Join ${escapeHtml(r.display_name)}${ev ? ` · ${escapeHtml(ev.label)}` : ''}">
        <span class="lr-reco-k">${label}</span><span class="lr-reco-name">${escapeHtml(r.display_name)}</span>${ev ? `<span class="lr-reco-ev">${escapeHtml(ev.label)}</span>` : ''}</button>`);
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
    setPresentation(p) { presentation = (p && typeof p === 'object') ? p : null; }, // Phase 2h display flags
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
      // Phase 2i: capture presentation diagnostics + preview/apply/clear effective config.
      if (result && result.ok && result.op === 'presentation_diagnostics' && Array.isArray(result.presentation)) lastOps = result;
      if (result && result.ok && (result.op === 'preview_presentation' || result.op === 'set_presentation' || result.op === 'clear_presentation')) {
        const eff = result.effective || {};
        const verb = result.op === 'preview_presentation' ? 'preview' : (result.op === 'set_presentation' ? 'applied' : 'cleared');
        const hasOv = result.override && Object.keys(result.override).length;
        lastOpsResult = `${verb} · ${result.roomId} → pre-roll ${eff.preroll_lead_ms ?? '—'}ms · refresh ${eff.countdown_refresh_ms ?? '—'}ms · next ${eff.show_next_event === false ? 'off' : 'on'} · featured ${eff.show_featured_chip === false ? 'off' : 'on'}${hasOv ? '' : ' (base)'}`;
      } else if (result && !result.ok) {
        lastOpsResult = null;
      }
      adminOpen = true;
      render();
      // Read-only ops do not change room state, so don't trigger a room-list refresh
      // (which would wipe operator-typed inputs). Mutating ops refresh to reflect the
      // new effective presentation in the room cards.
      const READ_OPS = new Set(['diagnostics', 'preview_presentation', 'presentation_diagnostics']);
      if (!(result && READ_OPS.has(result.op))) onRefresh();
    },
    getRooms() { return rooms.slice(); },
    get element() { return root; },
  };
}
