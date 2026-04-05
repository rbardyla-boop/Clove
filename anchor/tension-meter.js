/**
 * ODA-TENSION-METER.JS — Field Tension Meter + Anchor Overlay CSS
 * ─────────────────────────────────────────────────────────────────
 * Injects the meter into #s-entry immediately after #status-bar.
 * Renders entropy-driven tension: width only, no color judgment.
 *
 * CSS for BOTH the meter and the anchor overlay is injected here
 * so tension-meter.js + anchor-step.js share one style block.
 *
 * Exposes:
 *   window.odaInitMeter()    — inject meter HTML + wire events
 *   window.odaRenderMeter()  — update meter values from stored anchor
 */
(function (g) {
  'use strict';

  // ── CSS INJECTION ─────────────────────────────────────────────────────────
  // Injected once. Reuses the CSS custom properties already defined in
  // field-ops.html: --bg, --bg2, --bg3, --bg4, --red, --grn, --gld,
  // --dim, --dim2, --dim3. Fonts: DM Mono, Bebas Neue (already loaded).

  var _cssInjected = false;

  function injectCSS() {
    if (_cssInjected || document.getElementById('oda-css')) return;
    _cssInjected = true;

    var s = document.createElement('style');
    s.id = 'oda-css';

    // Using array + join for readability in this context
    s.textContent = [

      /* ══ TENSION METER (entry screen) ═════════════════════════════════ */
      '#oda-meter{',
      '  margin:8px 20px 0;',
      '  background:var(--bg2);',
      '  border:1px solid var(--dim3);',
      '  border-radius:10px;',
      '  padding:10px 14px;',
      '  flex-shrink:0;',
      '  font-family:"DM Mono",monospace;',
      '}',

      '.oda-m-row{',
      '  display:flex;align-items:center;justify-content:space-between;',
      '  margin-bottom:6px;',
      '}',
      '.oda-m-lbl{font-size:7.5px;letter-spacing:2.5px;color:var(--gld)}',
      '.oda-m-x{',
      '  background:none;border:none;color:var(--dim2);cursor:pointer;',
      '  font-size:12px;padding:0 0 0 12px;min-height:28px;min-width:28px;',
      '  line-height:1;',
      '}',
      '.oda-m-x:active{color:#fff}',

      /* Width-only meter: no color coding, pure entropy visualization */
      '.oda-track{height:2px;background:var(--dim3);border-radius:1px;margin-bottom:8px;overflow:hidden}',
      '.oda-fill{height:100%;background:#fff;border-radius:1px;transition:width 1.4s ease-out;width:0}',

      '.oda-m-dir{',
      '  font-family:Georgia,serif;font-style:italic;',
      '  font-size:9px;color:var(--dim);line-height:1.4;margin-bottom:8px;',
      '}',
      '.oda-m-bot{display:flex;align-items:center;justify-content:space-between}',
      '.oda-m-age{font-size:7px;letter-spacing:1.5px;color:var(--dim2)}',
      '.oda-m-exec{',
      '  background:none;border:1px solid var(--dim2);color:var(--dim);',
      '  font-family:"DM Mono",monospace;font-size:7px;letter-spacing:1.5px;',
      '  padding:5px 11px;border-radius:5px;cursor:pointer;',
      '  transition:color .15s,border-color .15s;',
      '}',
      '.oda-m-exec:active{color:#fff;border-color:var(--grn)}',

      /* ══ ANCHOR OVERLAY (full-screen, fixed) ═══════════════════════════ */
      '#oda-ov{',
      '  position:fixed;inset:0;',
      '  background:var(--bg);',
      '  z-index:9000;',
      '  overflow-y:auto;',
      '  display:flex;flex-direction:column;',
      '}',

      '.oda-pnl{',
      '  max-width:480px;width:100%;margin:0 auto;',
      '  padding:max(env(safe-area-inset-top),24px) 20px max(env(safe-area-inset-bottom),28px);',
      '  flex:1;display:flex;flex-direction:column;',
      '}',

      '.oda-eye{',
      '  font-size:8px;letter-spacing:4px;color:var(--red);',
      '  font-family:"DM Mono",monospace;margin-bottom:10px;',
      '}',
      '.oda-h2{',
      '  font-family:"Bebas Neue",monospace;font-size:28px;',
      '  letter-spacing:.5px;margin-bottom:4px;',
      '}',
      '.oda-sub{',
      '  font-size:8px;font-family:"DM Mono",monospace;',
      '  letter-spacing:2px;color:var(--dim);margin-bottom:20px;',
      '}',

      /* Card option list */
      '.oda-cards{display:flex;flex-direction:column;gap:8px;flex:1;margin-bottom:18px}',
      '.oda-opt{',
      '  display:block;cursor:pointer;',
      '  background:var(--bg2);border:1px solid var(--dim3);border-radius:10px;',
      '  padding:14px;transition:border-color .15s;',
      '}',
      /* Radio visually hidden — label itself is the click target */
      '.oda-opt input[type="radio"]{position:absolute;opacity:0;pointer-events:none;width:0;height:0}',
      '.oda-opt.oda-sel{border-color:var(--gld)}',
      '.oda-ot{font-size:8px;font-family:"DM Mono",monospace;letter-spacing:2px;color:var(--dim);margin-bottom:4px}',
      '.oda-od{font-family:Georgia,serif;font-size:12px;line-height:1.5;color:#fff}',
      '.oda-oa{',
      '  font-size:8.5px;font-family:"DM Mono",monospace;letter-spacing:1px;',
      '  color:var(--gld);margin-top:7px;padding-top:7px;border-top:1px solid var(--dim3);',
      '}',

      /* Time picker */
      '.oda-twrap{margin-bottom:14px}',
      '.oda-tlbl{display:block;font-size:7.5px;letter-spacing:2px;font-family:"DM Mono",monospace;color:var(--dim);margin-bottom:6px}',
      '#oda-time{',
      '  width:100%;background:var(--bg2);border:1px solid var(--dim3);',
      '  color:#fff;font-family:"DM Mono",monospace;font-size:11px;',
      '  padding:10px 12px;border-radius:8px;color-scheme:dark;',
      '}',
      '#oda-time:focus{outline:none;border-color:var(--gld)}',

      /* Export button — disabled state is muted; enabled state invites action */
      '.oda-xbtn{',
      '  width:100%;padding:16px;',
      '  background:var(--bg2);border:1px solid var(--dim3);color:var(--dim2);',
      '  font-family:"DM Mono",monospace;font-size:10px;letter-spacing:2.5px;',
      '  border-radius:10px;cursor:pointer;transition:all .15s;margin-bottom:10px;',
      '}',
      '.oda-xbtn:not([disabled]){color:#fff;border-color:var(--gld)}',
      '.oda-xbtn:not([disabled]):active{background:var(--gld);color:#000}',

      /* Skip button — equal visual weight (not deemphasized — philosopher's requirement) */
      '.oda-sbtn{',
      '  width:100%;padding:12px;',
      '  background:none;border:none;',
      '  color:var(--dim2);font-family:"DM Mono",monospace;',
      '  font-size:8px;letter-spacing:1.5px;cursor:pointer;transition:color .15s;',
      '}',
      '.oda-sbtn:active{color:var(--dim)}',
      '.oda-sbtn.oda-warn{color:var(--red)}',

    ].join('');

    document.head.appendChild(s);
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  g.odaRenderMeter = function () {
    g.odaCheckExpiry();

    var el = document.getElementById('oda-meter');
    if (!el) return;

    // Philosopher's escape: permanently dismissed
    if (g.odaMeterDismissed()) { el.style.display = 'none'; return; }

    var anchor = g.odaLoad();

    // No anchor, or already executed → hide
    if (!anchor || anchor.executed) { el.style.display = 'none'; return; }

    var tension = g.odaEntropy(anchor.anchoredAt);
    var pct     = Math.round(tension * 100);
    var hrs     = Math.floor((Date.now() - anchor.anchoredAt) / 3600000);
    var stLbl   = anchor.stateLabel || (anchor.state || '').toUpperCase();

    el.style.display = '';
    el.querySelector('.oda-fill').style.width = pct + '%';
    el.querySelector('.oda-m-lbl').textContent =
      'FIELD TENSION \u00B7 ' + stLbl + ' \u00B7 ' + hrs + 'h';
    el.querySelector('.oda-m-dir').textContent =
      '\u201C' +
      anchor.directiveText.slice(0, 72) +
      (anchor.directiveText.length > 72 ? '\u2026' : '') +
      '\u201D';
    el.querySelector('.oda-m-age').textContent = pct + '% ENTROPY';
  };

  // ── INIT ──────────────────────────────────────────────────────────────────
  // Injects meter HTML once into #s-entry, immediately after #status-bar.
  // Safe to call multiple times — will only inject once.
  g.odaInitMeter = function () {
    injectCSS();

    var statusBar = document.getElementById('status-bar');
    if (!statusBar) return; // guard: entry screen not in DOM

    // Already injected — just refresh values
    if (document.getElementById('oda-meter')) {
      g.odaRenderMeter();
      return;
    }

    var el = document.createElement('div');
    el.id = 'oda-meter';
    el.style.display = 'none'; // odaRenderMeter() decides visibility

    el.innerHTML =
      '<div class="oda-m-row">' +
        '<span class="oda-m-lbl">FIELD TENSION</span>' +
        '<button class="oda-m-x" id="oda-m-x" aria-label="Dismiss meter permanently">\u00D7</button>' +
      '</div>' +
      '<div class="oda-track"><div class="oda-fill"></div></div>' +
      '<div class="oda-m-dir"></div>' +
      '<div class="oda-m-bot">' +
        '<span class="oda-m-age"></span>' +
        '<button class="oda-m-exec" id="oda-m-exec">MARK EXECUTED \u2192</button>' +
      '</div>';

    // Position: immediately after #status-bar in the flex column.
    // Visible on both hook (first visit) and checkpoint (return visit) views.
    statusBar.insertAdjacentElement('afterend', el);

    // Wire: MARK EXECUTED
    document.getElementById('oda-m-exec').addEventListener('click', function () {
      g.odaExecute();
      g.odaRenderMeter();
      // Use field-ops.html's own toast function
      if (typeof toast === 'function') toast('DIRECTIVE EXECUTED', 'var(--grn)');
    });

    // Wire: permanent dismiss (philosopher's one-click escape)
    document.getElementById('oda-m-x').addEventListener('click', function () {
      g.odaDismissMeter();
      el.style.display = 'none';
    });

    g.odaRenderMeter();
  };

})(window);
