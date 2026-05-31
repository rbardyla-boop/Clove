/**
 * Prize Counter — Neon Circuit Phase 1f UI panel (self-contained, like pulse-tap-game.js).
 *
 * Displays the server-authoritative arcade loop: ticket balance, prize catalog
 * (redeem), owned cosmetics (equip/unequip), recent ledger activity, the people
 * present and their PUBLIC equipped cosmetics, and zone labels.
 *
 * It never computes balances or mints goods — it only renders server state and
 * forwards intent (onRedeem / onEquip / onUnequip). Tickets are arcade points,
 * not money; this panel uses only redeem / unlock / equip wording.
 *
 * createPrizeCounter({ onRedeem, onEquip, onUnequip }) -> panel API
 */
export function createPrizeCounter({ onRedeem = () => {}, onEquip = () => {}, onUnequip = () => {} } = {}) {
  let root = null;
  let isOpen = false;

  let balance = 0;
  let prizes = [];
  let zones = [];
  let inventory = [];      // [{prize_id, display_name, category, equip_slot, ...}]
  let equips = {};         // { slot: prize_id }
  let ledger = [];         // recent entries
  let others = {};         // { playerId: { slot: {prize_id, display_name} } }
  let selfId = '';
  const pending = new Set(); // prizeIds mid-redeem (duplicate-click guard)

  const $ = (sel) => root && root.querySelector(sel);

  function build() {
    root = document.createElement('div');
    root.className = 'pc-overlay';
    root.innerHTML = `
      <div class="pc-panel" role="dialog" aria-label="Prize Counter">
        <div class="pc-head">
          <div class="pc-title">PRIZE <span>COUNTER</span> <em class="pc-zone-tag">prize_counter</em></div>
          <div class="pc-bal" title="Your arcade tickets (server-authoritative)">🎟 <b data-f="bal">0</b></div>
          <button class="pc-close" type="button" data-act="close">✕</button>
        </div>
        <div class="pc-body">
          <section class="pc-col">
            <h3>Redeem</h3>
            <div class="pc-list" data-f="prizes"></div>
          </section>
          <section class="pc-col">
            <h3>Your cosmetics</h3>
            <div class="pc-list" data-f="inventory"></div>
            <h3>Recent activity</h3>
            <div class="pc-ledger" data-f="ledger"></div>
          </section>
          <section class="pc-col">
            <h3>Players here</h3>
            <div class="pc-list" data-f="others"></div>
            <h3>Zones</h3>
            <div class="pc-zones" data-f="zones"></div>
          </section>
        </div>
        <div class="pc-feedback" data-f="fb" aria-live="polite"></div>
      </div>`;
    document.body.appendChild(root);
    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const a = act.dataset.act;
      if (a === 'close') close();
      else if (a === 'redeem') doRedeem(act.dataset.prize);
      else if (a === 'equip') onEquip(act.dataset.prize);
      else if (a === 'unequip') onUnequip({ slot: act.dataset.slot });
    });
  }

  function feedback(text, kind = '') {
    const fb = $('[data-f="fb"]');
    if (!fb) return;
    fb.textContent = text;
    fb.className = 'pc-feedback show ' + kind;
  }

  function doRedeem(prizeId) {
    if (pending.has(prizeId)) return; // duplicate-click guard
    pending.add(prizeId);
    onRedeem(prizeId);
    renderPrizes();
  }

  function owns(prizeId) {
    return inventory.some((i) => i.prize_id === prizeId);
  }

  function renderBalance() {
    const b = $('[data-f="bal"]');
    if (b) b.textContent = balance;
  }

  function renderPrizes() {
    const host = $('[data-f="prizes"]');
    if (!host) return;
    host.innerHTML = prizes.map((p) => {
      const ownedAlready = p.unique && owns(p.prize_id);
      const busy = pending.has(p.prize_id);
      const afford = balance >= p.cost_tickets;
      const disabled = ownedAlready || busy || !afford;
      const label = ownedAlready ? 'Owned' : busy ? 'Redeeming…' : `Redeem · ${p.cost_tickets}🎟`;
      return `<div class="pc-card ${ownedAlready ? 'owned' : ''}">
        <div class="pc-card-main"><span class="pc-name">${esc(p.display_name)}</span>
          <span class="pc-rar">${esc(p.rarity_label || '')}</span></div>
        <div class="pc-desc">${esc(p.description || '')}</div>
        <button class="pc-btn" type="button" data-act="redeem" data-prize="${esc(p.prize_id)}" ${disabled ? 'disabled' : ''}>${label}</button>
        ${!afford && !ownedAlready ? '<span class="pc-need">need more tickets</span>' : ''}
      </div>`;
    }).join('') || '<div class="pc-empty">catalog loading…</div>';
  }

  function renderInventory() {
    const host = $('[data-f="inventory"]');
    if (!host) return;
    if (!inventory.length) { host.innerHTML = '<div class="pc-empty">No cosmetics yet — redeem one!</div>'; return; }
    host.innerHTML = inventory.map((i) => {
      const equipped = equips[i.equip_slot] === i.prize_id;
      return `<div class="pc-card ${equipped ? 'equipped' : ''}">
        <div class="pc-card-main"><span class="pc-name">${esc(i.display_name)}</span>
          <span class="pc-slot">${esc(i.equip_slot)}</span></div>
        ${equipped
          ? `<button class="pc-btn ghost" type="button" data-act="unequip" data-slot="${esc(i.equip_slot)}">Unequip</button>`
          : `<button class="pc-btn" type="button" data-act="equip" data-prize="${esc(i.prize_id)}">Equip</button>`}
      </div>`;
    }).join('');
  }

  function renderLedger() {
    const host = $('[data-f="ledger"]');
    if (!host) return;
    if (!ledger.length) { host.innerHTML = '<div class="pc-empty">No activity yet.</div>'; return; }
    host.innerHTML = ledger.slice(-12).reverse().map((e) => {
      const sign = e.delta >= 0 ? '+' : '';
      return `<div class="pc-led ${e.delta >= 0 ? 'pos' : 'neg'}">
        <span class="pc-led-sum">${esc(e.public_safe_summary || e.event_type)}</span>
        <span class="pc-led-delta">${sign}${e.delta}🎟</span></div>`;
    }).join('');
  }

  function renderOthers() {
    const host = $('[data-f="others"]');
    if (!host) return;
    const ids = Object.keys(others);
    if (!ids.length) { host.innerHTML = '<div class="pc-empty">Just you so far.</div>'; return; }
    host.innerHTML = ids.map((pid) => {
      const slots = others[pid];
      const items = Object.values(slots).map((v) => esc(v.display_name)).join(', ') || '—';
      const mine = pid === selfId ? ' (you)' : '';
      return `<div class="pc-other"><span class="pc-other-id">${esc(short(pid))}${mine}</span>
        <span class="pc-other-items">${items}</span></div>`;
    }).join('');
  }

  function renderZones() {
    const host = $('[data-f="zones"]');
    if (!host) return;
    host.innerHTML = zones.map((z) => `<div class="pc-zone"><b>${esc(z.display_name)}</b><span>${esc(z.description || '')}</span></div>`).join('');
  }

  function renderAll() {
    if (!root) return;
    renderBalance(); renderPrizes(); renderInventory(); renderLedger(); renderOthers(); renderZones();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function short(id) {
    return id && id.length > 16 ? id.slice(0, 15) + '…' : id || '';
  }

  function open() {
    if (!root) build();
    if (isOpen) return;
    isOpen = true;
    renderAll();
    root.classList.add('show');
  }
  function close() {
    if (!root || !isOpen) return;
    isOpen = false;
    root.classList.remove('show');
  }

  return {
    open, close, isOpen() { return isOpen; },
    setSelfId(id) { selfId = id; if (isOpen) renderOthers(); },
    setBalance(n) { balance = n; renderBalance(); renderPrizes(); },
    setPrizes(list) { prizes = Array.isArray(list) ? list : []; renderPrizes(); },
    setZones(list) { zones = Array.isArray(list) ? list : []; renderZones(); },
    setInventory(inv, eq) { inventory = Array.isArray(inv) ? inv : []; equips = eq || {}; renderInventory(); renderPrizes(); },
    setLedger(entries) { ledger = Array.isArray(entries) ? entries : []; renderLedger(); },
    setPublicCosmetics(map) { others = map || {}; renderOthers(); },
    redeemed(msg) { pending.delete(msg.prizeId); feedback(`Redeemed ${displayOf(msg.prizeId, prizes, inventory)} ✓`, 'ok'); renderPrizes(); },
    redeemRejected(msg) { pending.delete(msg.prizeId); feedback(`Could not redeem: ${msg.reason}`, 'bad'); renderPrizes(); },
    cosmeticFeedback(text, kind) { feedback(text, kind); },
  };

  function displayOf(prizeId, list, inv) {
    const p = list.find((x) => x.prize_id === prizeId) || inv.find((x) => x.prize_id === prizeId);
    return p ? p.display_name : prizeId;
  }
}
