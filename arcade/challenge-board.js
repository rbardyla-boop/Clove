/**
 * Challenge Board — Neon Circuit Phase 1h UI panel (self-contained, like
 * prize-counter.js / pulse-tap-game.js).
 *
 * Shows the server-authoritative retention loop:
 *  - Challenges: progress, completed state, and a Claim button when completed+unclaimed.
 *  - Achievements: unlocked badges (equip through the existing cosmetic path).
 *  - Arcade Feed: a public-safe stream of room events.
 *
 * It never computes progress or grants rewards — it only renders server state and
 * forwards intent (onClaim / onEquip). Tickets are arcade points, not money; this
 * panel uses only complete / unlock / claim / equip wording.
 *
 * createChallengeBoard({ onClaim, onEquip }) -> panel API
 */
export function createChallengeBoard({ onClaim = () => {}, onEquip = () => {} } = {}) {
  let root = null;
  let isOpen = false;

  let catalog = [];     // [{ challenge_id, display_name, description, reward, ... }]
  let progress = {};    // { challenge_id: { progress, target, completed, reward_claimed } }
  let inventory = [];    // owned cosmetics (badges filtered for the achievements column)
  let equips = {};       // { slot: prize_id }
  let feed = [];         // public-safe events
  let selfId = '';
  const claiming = new Set(); // challengeIds mid-claim (duplicate-click guard)

  const $ = (sel) => root && root.querySelector(sel);

  function build() {
    root = document.createElement('div');
    root.className = 'cb-overlay';
    root.innerHTML = `
      <div class="cb-panel" role="dialog" aria-label="Challenge Board">
        <div class="cb-head">
          <div class="cb-title">CHALLENGE <span>BOARD</span></div>
          <button class="cb-close" type="button" data-act="close">✕</button>
        </div>
        <div class="cb-body">
          <section class="cb-col">
            <h3>Challenges</h3>
            <div class="cb-list" data-f="challenges"></div>
          </section>
          <section class="cb-col">
            <h3>Achievements</h3>
            <div class="cb-list" data-f="achievements"></div>
          </section>
          <section class="cb-col">
            <h3>Arcade feed</h3>
            <div class="cb-feed" data-f="feed"></div>
          </section>
        </div>
        <div class="cb-feedback" data-f="fb" aria-live="polite"></div>
      </div>`;
    document.body.appendChild(root);
    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const a = act.dataset.act;
      if (a === 'close') close();
      else if (a === 'claim') doClaim(act.dataset.cid);
      else if (a === 'equip') onEquip(act.dataset.prize);
    });
  }

  function feedback(text, kind = '') {
    const fb = $('[data-f="fb"]');
    if (!fb) return;
    fb.textContent = text;
    fb.className = 'cb-feedback show ' + kind;
  }

  function doClaim(challengeId) {
    if (claiming.has(challengeId)) return;
    claiming.add(challengeId);
    onClaim(challengeId);
    renderChallenges();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function short(id) {
    return id && id.length > 16 ? id.slice(0, 15) + '…' : id || '';
  }

  function rewardLabel(reward) {
    if (!reward) return '';
    const parts = [];
    if (reward.achievement_id) parts.push('badge');
    if (reward.ticket_bonus > 0) parts.push(`+${reward.ticket_bonus}🎟`);
    return parts.join(' · ') || 'reward';
  }

  function renderChallenges() {
    const host = $('[data-f="challenges"]');
    if (!host) return;
    if (!catalog.length) { host.innerHTML = '<div class="cb-empty">Loading challenges…</div>'; return; }
    host.innerHTML = catalog.map((c) => {
      const p = progress[c.challenge_id] || { progress: 0, target: c.criteria ? c.criteria.target : 1, completed: false, reward_claimed: false };
      const pct = p.target ? Math.min(100, Math.round((p.progress / p.target) * 100)) : 0;
      const busy = claiming.has(c.challenge_id);
      let action;
      if (p.reward_claimed) action = '<span class="cb-claimed">Claimed ✓</span>';
      else if (p.completed) action = `<button class="cb-btn" type="button" data-act="claim" data-cid="${esc(c.challenge_id)}" ${busy ? 'disabled' : ''}>${busy ? 'Claiming…' : 'Claim'}</button>`;
      else action = `<span class="cb-prog-num">${p.progress}/${p.target}</span>`;
      return `<div class="cb-card ${p.completed ? 'done' : ''}">
        <div class="cb-card-main"><span class="cb-name">${esc(c.display_name)}</span>
          <span class="cb-reward">${esc(rewardLabel(c.reward))}</span></div>
        <div class="cb-desc">${esc(c.description || '')}</div>
        <div class="cb-row">
          <div class="cb-bar"><span style="width:${pct}%"></span></div>
          ${action}
        </div>
      </div>`;
    }).join('');
  }

  function renderAchievements() {
    const host = $('[data-f="achievements"]');
    if (!host) return;
    const badges = inventory.filter((i) => i.source === 'achievement');
    if (!badges.length) { host.innerHTML = '<div class="cb-empty">Complete challenges to unlock badges.</div>'; return; }
    host.innerHTML = badges.map((b) => {
      const equipped = equips[b.equip_slot] === b.prize_id;
      return `<div class="cb-card ${equipped ? 'equipped' : ''}">
        <div class="cb-card-main"><span class="cb-name">🏅 ${esc(b.display_name)}</span></div>
        ${equipped
          ? '<span class="cb-claimed">Equipped ✓</span>'
          : `<button class="cb-btn" type="button" data-act="equip" data-prize="${esc(b.prize_id)}">Equip</button>`}
      </div>`;
    }).join('');
  }

  function renderFeed() {
    const host = $('[data-f="feed"]');
    if (!host) return;
    if (!feed.length) { host.innerHTML = '<div class="cb-empty">No arcade activity yet.</div>'; return; }
    host.innerHTML = feed.slice(-25).reverse().map((e) => {
      const mine = e.actor_public_id === selfId;
      return `<div class="cb-ev ${mine ? 'mine' : ''}">
        <span class="cb-ev-dot" data-k="${esc(e.event_type)}"></span>
        <span class="cb-ev-sum">${esc(e.summary)}</span></div>`;
    }).join('');
  }

  function renderAll() {
    if (!root) return;
    renderChallenges(); renderAchievements(); renderFeed();
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
    setSelfId(id) { selfId = id; if (isOpen) renderFeed(); },
    setChallenges(list) { catalog = Array.isArray(list) ? list : []; renderChallenges(); },
    setProgress(list) {
      progress = {};
      for (const p of (Array.isArray(list) ? list : [])) progress[p.challenge_id] = p;
      renderChallenges();
    },
    setInventory(items, eq) { inventory = Array.isArray(items) ? items : []; equips = eq || {}; renderAchievements(); },
    setFeed(events) { feed = Array.isArray(events) ? events : []; renderFeed(); },
    addEvent(event) { if (event) { feed = [...feed, event].slice(-50); renderFeed(); } },
    challengeRewarded(msg) {
      claiming.delete(msg.challengeId);
      const bits = [];
      if (msg.achievement_id) bits.push('badge unlocked');
      if (msg.ticketBonus > 0) bits.push(`+${msg.ticketBonus} tickets`);
      feedback(`Claimed: ${bits.join(' · ') || 'reward'} ✓`, 'ok');
      renderChallenges();
    },
    challengeRejected(msg) {
      if (msg && msg.challengeId) claiming.delete(msg.challengeId);
      feedback(`Could not claim: ${msg ? msg.reason : 'rejected'}`, 'bad');
      renderChallenges();
    },
  };
}
