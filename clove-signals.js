(() => {
  'use strict';

  const OPT_OUT_KEY = 'clove_signals_optout_v1';
  const LAST_SEEN_KEY = 'clove_last_seen_day_v1';
  const DAY_MS = 86400000;
  const allowedEvents = new Set([
    'site_opened','returned','onboarding_started','onboarding_completed',
    'tool_started','tool_completed','game_opened','game_started',
    'game_completed','client_error',
    'feedback_helpful','feedback_not_for_me','feedback_broken',
  ]);
  let lastError = 'none';

  const disabled = () => {
    try {
      return localStorage.getItem(OPT_OUT_KEY) === '1'
        || navigator.globalPrivacyControl === true
        || navigator.doNotTrack === '1';
    } catch {
      return true;
    }
  };

  function surface() {
    const p = location.pathname.toLowerCase();
    if (p === '/' || p === '/index.html') return 'home';
    if (p.startsWith('/games/echo-bloom')) return 'echo_bloom';
    if (p === '/games/' || p === '/games/index.html') return 'games';
    if (p.startsWith('/wellbeing/')) return 'wellbeing';
    if (p.startsWith('/onboarding/')) return 'onboarding';
    if (p.includes('growth-plan')) return 'plan';
    if (p.startsWith('/game/vibecenter')) return 'vibecenter';
    if (p === '/game/' || p === '/game/index.html') return 'singularity';
    if (p.startsWith('/arcade/city') || p.includes('whats-live')) return 'neon_circuit';
    if (p.startsWith('/game/arcade')) return 'operators_deck';
    if (p.includes('nodehopper')) return 'node_hopper';
    if (p.includes('theincrediblemindmachine')) return 'mind_machine';
    if (p.includes('/creator/')) return 'maker';
    if (p.startsWith('/articles/')) return 'article';
    if (p.includes('feedback')) return 'feedback';
    if (p.endsWith('.html')) return 'tool';
    return 'other';
  }

  function device() {
    const width = Math.min(screen.width || innerWidth, innerWidth || screen.width);
    if (width <= 600) return 'phone';
    if (width <= 1024) return 'tablet';
    return 'desktop';
  }

  function referrerGroup() {
    if (!document.referrer) return 'direct';
    try {
      const host = new URL(document.referrer).hostname.toLowerCase();
      if (host === location.hostname) return 'direct';
      if (/(google|bing|duckduckgo|yahoo|brave|ecosia)\./.test(host)) return 'search';
      if (/(reddit|facebook|instagram|youtube|tiktok|bsky|twitter|x\.com|t\.co)/.test(host)) return 'social';
      return 'other';
    } catch {
      return 'other';
    }
  }

  function returnBucket() {
    const today = Math.floor(Date.now() / DAY_MS);
    try {
      const previous = Number(localStorage.getItem(LAST_SEEN_KEY));
      localStorage.setItem(LAST_SEEN_KEY, String(today));
      if (!Number.isFinite(previous) || previous <= 0) return 'new';
      const days = today - previous;
      if (days <= 0) return 'same_day';
      if (days <= 7) return '2_7d';
      if (days <= 30) return '8_30d';
      return '31d_plus';
    } catch {
      return 'none';
    }
  }

  const visitBucket = disabled() ? 'none' : returnBucket();

  function send(path, payload) {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      return navigator.sendBeacon(path, new Blob([body], { type: 'application/json' }));
    }
    fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => {});
    return true;
  }

  function track(event, options = {}) {
    if (disabled() || !allowedEvents.has(event)) return false;
    return send('/__clove/signal', {
      event,
      surface: options.surface || surface(),
      device: device(),
      returnBucket: visitBucket,
      referrerGroup: referrerGroup(),
      build: options.build || 'current',
      variant: options.variant || 'none',
      detail: options.detail || 'none',
      diagnostic: options.diagnostic || 'none',
    });
  }

  async function fingerprint(value) {
    if (!crypto?.subtle) return;
    const data = new TextEncoder().encode(String(value).replace(/\d+/g, '#').slice(0, 240));
    const hash = await crypto.subtle.digest('SHA-256', data);
    const code = [...new Uint8Array(hash)].slice(0, 6).map(byte => byte.toString(16).padStart(2, '0')).join('');
    lastError = code;
    track('client_error', { diagnostic: code });
  }

  window.addEventListener('error', event => {
    fingerprint(`${event.error?.name || 'Error'}:${event.message || 'unknown'}`);
  });
  window.addEventListener('unhandledrejection', event => {
    fingerprint(`UnhandledRejection:${event.reason?.name || typeof event.reason}`);
  });

  document.addEventListener('click', event => {
    const link = event.target.closest?.('[data-clove-event]');
    if (!link) return;
    track(link.dataset.cloveEvent, { detail: link.dataset.cloveDetail || 'none' });
  });

  function mountFeedback() {
    if (window.top !== window.self || surface() === 'feedback') return;
    const host = document.createElement('div');
    host.id = 'clove-feedback';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `
      <style>
        *{box-sizing:border-box}button,select,textarea{font:inherit}
        .open{position:fixed;z-index:2147483000;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));border:1px solid rgba(148,163,184,.45);border-radius:999px;background:#07111f;color:#dcecff;padding:9px 13px;font:800 10px/1 system-ui;letter-spacing:.08em;box-shadow:0 8px 30px rgba(0,0,0,.35);cursor:pointer}
        .box{position:fixed;z-index:2147483001;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));width:min(360px,calc(100vw - 24px));border:1px solid #32445c;border-radius:16px;background:#07111f;color:#edf5ff;padding:18px;box-shadow:0 22px 70px rgba(0,0,0,.65);font:14px/1.45 system-ui}
        .box[hidden]{display:none}.head{display:flex;justify-content:space-between;gap:12px}.head h2{font-size:18px;margin:0}.close{border:0;background:none;color:#9ab0c9;font-size:20px;cursor:pointer}
        p{color:#aebed0;font-size:12px;margin:7px 0 13px}label{display:grid;gap:6px;font-size:11px;font-weight:800;letter-spacing:.04em}
        select,textarea{width:100%;border:1px solid #32445c;border-radius:8px;background:#0d1c2d;color:#edf5ff;padding:9px}
        textarea{min-height:92px;resize:vertical}.hp{position:absolute;left:-9999px}
        .actions{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px}.send{border:0;border-radius:8px;background:#5eead4;color:#04120e;padding:10px 14px;font-weight:900;cursor:pointer}
        a{color:#8fc5ff;font-size:10px}.status{min-height:18px;color:#5eead4;font-size:11px;margin:8px 0 0}
      </style>
      <button class="open" type="button">FEEDBACK</button>
      <section class="box" role="dialog" aria-modal="true" aria-label="Send anonymous feedback" hidden>
        <div class="head"><h2>What happened?</h2><button class="close" type="button" aria-label="Close">×</button></div>
        <p>No account or identifier is attached. Please do not include names, contact details, or private health information.</p>
        <form>
          <label>Feedback
            <select name="category">
              <option value="helpful">This helped</option>
              <option value="not_for_me">Not for me</option>
              <option value="broken">Something is broken</option>
              <option value="idea">I have an idea</option>
              <option value="other">Something else</option>
            </select>
          </label>
          <label style="margin-top:10px">Optional note
            <textarea name="note" maxlength="700" placeholder="What should we know?"></textarea>
          </label>
          <label class="hp">Company<input name="company" tabindex="-1" autocomplete="off"></label>
          <div class="actions"><a href="/privacy-signals.html">What is collected?</a><button class="send" type="submit">SEND</button></div>
          <p class="status" role="status"></p>
        </form>
      </section>`;
    const open = root.querySelector('.open');
    const box = root.querySelector('.box');
    const close = root.querySelector('.close');
    const form = root.querySelector('form');
    open.addEventListener('click', () => { box.hidden = false; open.hidden = true; root.querySelector('select').focus(); });
    close.addEventListener('click', () => { box.hidden = true; open.hidden = false; });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const status = root.querySelector('.status');
      const button = root.querySelector('.send');
      const data = new FormData(form);
      const category = String(data.get('category'));
      const note = String(data.get('note')).trim();
      if (['broken','idea','other'].includes(category) && note.length < 3) {
        status.textContent = 'Please add a short note so this is actionable.';
        return;
      }
      button.disabled = true;
      status.textContent = 'Sending…';
      try {
        const response = await fetch('/__clove/feedback', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            category,
            note,
            surface: surface(),
            device: device(),
            diagnostic: category === 'broken' ? lastError : 'none',
            company: String(data.get('company') || ''),
          }),
        });
        if (!response.ok) throw new Error('send_failed');
        const eventName = {
          helpful: 'feedback_helpful',
          not_for_me: 'feedback_not_for_me',
          broken: 'feedback_broken',
        }[category];
        if (eventName) track(eventName);
        form.reset();
        status.textContent = 'Thank you. It reached the builder.';
      } catch {
        status.textContent = 'Could not send. Try the full feedback page.';
      } finally {
        button.disabled = false;
      }
    });
    document.body.appendChild(host);
  }

  window.cloveSignal = Object.freeze({
    track,
    optOut() {
      try { localStorage.setItem(OPT_OUT_KEY, '1'); } catch {}
    },
    optIn() {
      try { localStorage.removeItem(OPT_OUT_KEY); } catch {}
    },
    isDisabled: disabled,
  });

  track('site_opened');
  if (visitBucket !== 'new' && visitBucket !== 'none') track('returned');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountFeedback, { once: true });
  else mountFeedback();
})();
