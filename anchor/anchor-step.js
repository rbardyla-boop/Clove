/**
 * ODA-ANCHOR-STEP.JS — Post-debrief Directive Anchor overlay
 * ────────────────────────────────────────────────────────────
 * WIRING DEPENDENCIES (load before this file):
 *   entropy.js     → window.odaEntropy
 *   ics.js         → window.odaGenerateICS, window.odaDownloadICS
 *   db.js          → window.odaSave, window.odaLoad, ...
 *   tension-meter.js → window.odaInitMeter, window.odaRenderMeter
 *
 * RUNTIME DEPENDENCIES (provided by field-ops.html's global scope):
 *   sess           — in-memory session object { state, pool_offset, cards_seen, ... }
 *   POOLS          — card pool definitions
 *   STATES         — state metadata { lbl, ico, col, ... }
 *   SESSION_MAX    — cards per session (3)
 *   esc()          — HTML-escape helper
 *   toast()        — toast notification helper
 *   window.showDebrief — patched here via monkey-patch
 *
 * NOTE: sess, POOLS, STATES, SESSION_MAX are declared with let/const in
 * field-ops.html's classic script, which shares the global lexical scope.
 * They are accessible from this file as plain identifiers (not window.X).
 *
 * Exposes:
 *   window.odaShowOverlay() — shows the anchor selection overlay
 */
(function (g) {
  'use strict';

  // ── SESSION CARD EXTRACTION ───────────────────────────────────────────────
  // Reconstructs which 3 cards were shown during the just-completed session.
  // Uses the same index arithmetic as renderCard() in field-ops.html:
  //   idx = (pool_offset + i) % pool.length
  function getSessionCards() {
    try {
      /* jshint ignore:start */
      var s     = (typeof sess      !== 'undefined') ? sess      : null;
      var pools = (typeof POOLS     !== 'undefined') ? POOLS     : null;
      /* jshint ignore:end */
      if (!s || !pools || !s.state || typeof s.cards_seen !== 'number') return [];
      var pool = pools[s.state];
      if (!Array.isArray(pool) || !pool.length) return [];
      var out = [];
      for (var i = 0; i < s.cards_seen; i++) {
        var idx = (s.pool_offset + i) % pool.length;
        var card = pool[idx];
        if (card && card.dir) out.push(card);
      }
      return out;
    } catch (e) {
      return []; // fail-open: no overlay if session state is unavailable
    }
  }

  // ── DEFAULT SCHEDULE TIME ─────────────────────────────────────────────────
  // Between 6am–6pm: suggest +2h from now (rounded to hour).
  // Evening/night/early morning: suggest 09:00 tomorrow.
  // Returns a string in datetime-local format: 'YYYY-MM-DDTHH:MM'
  function defaultTime() {
    var now = new Date();
    var h   = now.getHours();
    var d;
    if (h >= 6 && h < 18) {
      d = new Date(Date.now() + 2 * 60 * 60 * 1000);
      d.setMinutes(0, 0, 0);
    } else {
      d = new Date(now);
      d.setDate(d.getDate() + (h >= 18 ? 1 : 0)); // if evening, next day; if pre-6am, same day
      if (h < 6) {
        // Pre-dawn: today at 9am
        d.setHours(9, 0, 0, 0);
      } else {
        // Evening: tomorrow at 9am
        d.setDate(d.getDate()); // already set above
        d.setHours(9, 0, 0, 0);
      }
    }
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
           'T' + pad(d.getHours()) + ':00';
  }

  // ── HTML ESCAPE ───────────────────────────────────────────────────────────
  // Use field-ops.html's esc() if available; otherwise inline fallback.
  // This handles any user-visible text inserted into innerHTML.
  function e(v) {
    /* jshint ignore:start */
    if (typeof esc === 'function') return esc(v);
    /* jshint ignore:end */
    var d = document.createElement('div');
    d.textContent = String(v == null ? '' : v);
    return d.innerHTML;
  }

  // ── BUILD OVERLAY ─────────────────────────────────────────────────────────
  g.odaShowOverlay = function () {
    // Idempotency guard: don't mount if already visible
    if (document.getElementById('oda-ov')) return;

    var cards = getSessionCards();
    if (!cards.length) return; // no valid session in memory — silent no-op

    /* jshint ignore:start */
    var s      = (typeof sess   !== 'undefined') ? sess   : null;
    var states = (typeof STATES !== 'undefined') ? STATES : null;
    /* jshint ignore:end */
    var state  = s ? s.state : '';
    var stLbl  = (states && states[state]) ? states[state].lbl : state.toUpperCase();

    var mandatory = g.odaIsMandatory();

    // ── BUILD CARD HTML ──────────────────────────────────────────────────
    var cardsHTML = cards.map(function (c, i) {
      var suitMeta = '';
      /* jshint ignore:start */
      if (typeof SUIT !== 'undefined' && SUIT && c.suit && SUIT[c.suit]) {
        suitMeta = SUIT[c.suit].name;
      }
      /* jshint ignore:end */
      return (
        '<label class="oda-opt" data-idx="' + i + '">' +
          '<input type="radio" name="oda-d" value="' + i + '"' +
          ' data-dir="'    + e(c.dir    || '') + '"' +
          ' data-action="' + e(c.action || '') + '"' +
          ' data-key="'    + e(c.key    || '') + '"' +
          ' data-title="'  + e(c.title  || '') + '">' +
          '<div class="oda-ot">' +
            (suitMeta ? e(suitMeta) : e((c.suit || '').toUpperCase())) +
            (c.n ? ' \u00B7 ' + e(c.n) : '') +
          '</div>' +
          '<div class="oda-od">' + e(c.dir    || '') + '</div>' +
          '<div class="oda-oa">' + e(c.action || '') + '</div>' +
        '</label>'
      );
    }).join('');

    // ── BUILD OVERLAY ────────────────────────────────────────────────────
    var ov = document.createElement('div');
    ov.id = 'oda-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Anchor one directive');

    ov.innerHTML =
      '<div class="oda-pnl">' +
        '<div class="oda-eye">ANCHOR ONE DIRECTIVE</div>' +
        '<div class="oda-h2">' + e(stLbl) + ' FIELD PROTOCOL</div>' +
        '<p class="oda-sub">BEFORE YOU LEAVE \u2014 WHICH ONE STAYS WITH YOU?</p>' +
        '<div class="oda-cards">' + cardsHTML + '</div>' +
        '<div class="oda-twrap">' +
          '<span class="oda-tlbl">EXECUTE AT</span>' +
          '<input type="datetime-local" id="oda-time" value="' + defaultTime() + '">' +
        '</div>' +
        '<button id="oda-xbtn" class="oda-xbtn" disabled>' +
          'EXPORT TO CALENDAR \u2192' +
        '</button>' +
        '<button id="oda-sbtn" class="oda-sbtn">' +
          (mandatory ? 'SKIP \u2014 FIELD PROTOCOL ACTIVE' : 'SKIP') +
        '</button>' +
      '</div>';

    document.body.appendChild(ov);

    // ── WIRE: CARD SELECTION ─────────────────────────────────────────────
    ov.querySelectorAll('input[name="oda-d"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        ov.querySelectorAll('.oda-opt').forEach(function (opt) {
          opt.classList.remove('oda-sel');
        });
        var parent = radio.closest ? radio.closest('.oda-opt') : radio.parentNode;
        if (parent) parent.classList.add('oda-sel');
        document.getElementById('oda-xbtn').disabled = false;
      });
    });

    // ── WIRE: EXPORT BUTTON ──────────────────────────────────────────────
    document.getElementById('oda-xbtn').addEventListener('click', function () {
      var sel = ov.querySelector('input[name="oda-d"]:checked');
      if (!sel) return;

      var timeVal  = document.getElementById('oda-time').value;
      var schFor   = timeVal ? new Date(timeVal).getTime() : (Date.now() + 7200000);

      // Validate: must be at least 1 minute in the future
      if (isNaN(schFor) || schFor < Date.now() - 60000) {
        /* jshint ignore:start */
        if (typeof toast === 'function') toast('SET A FUTURE TIME', 'var(--red)');
        /* jshint ignore:end */
        return;
      }

      var anchor = {
        id:               'oda-' + Date.now(),
        directiveText:    sel.dataset.dir    || '',
        actionText:       sel.dataset.action || '',
        cardKey:          sel.dataset.key    || '',
        cardTitle:        sel.dataset.title  || '',
        state:            state,
        stateLabel:       stLbl,
        anchoredAt:       Date.now(),
        scheduledFor:     schFor,
        executed:         false,
        executedAt:       null,
        calendarExported: false
      };

      var exported = g.odaDownloadICS(anchor);
      anchor.calendarExported = exported;

      g.odaSave(anchor);
      g.odaRecordSaved();
      ov.remove();

      // Refresh tension meter with the new anchor
      g.odaInitMeter();
      g.odaRenderMeter();

      /* jshint ignore:start */
      if (typeof toast === 'function') {
        if (!exported) {
          toast(
            'ANCHOR SAVED \u2014 CALENDAR EXPORT FAILED. CHECK DEVICE SETTINGS.',
            'var(--gld)'
          );
        } else {
          toast('ANCHOR SET', 'var(--grn)');
        }
      }
      /* jshint ignore:end */
    });

    // ── WIRE: SKIP BUTTON ────────────────────────────────────────────────
    // Mandatory: requires 2 clicks (field protocol copy on first click).
    // Non-mandatory: single click.
    // Adaptive: after 3 consecutive skips, mandatory is suspended (see db.js).
    var skipStep = 0;
    document.getElementById('oda-sbtn').addEventListener('click', function () {
      if (mandatory && skipStep === 0) {
        skipStep = 1;
        this.textContent = 'CONFIRM SKIP \u2014 DIRECTIVE EXPIRES THIS SESSION';
        this.classList.add('oda-warn');
        return;
      }
      g.odaRecordSkipped();
      ov.remove();
    });
  };

  // ── PATCH window.showDebrief ──────────────────────────────────────────────
  // showDebrief() is declared as a function statement in field-ops.html's
  // classic script, making it a window property (accessible here).
  // We wrap it: original runs first (stats render), then overlay fires after
  // a 120ms delay to let the debrief screen finish its DOM updates.
  (function patchShowDebrief() {
    var _orig = window.showDebrief;
    if (typeof _orig !== 'function') {
      console.warn('[ODA] showDebrief not found — anchor overlay will not fire.');
      return;
    }
    // Guard against double-patching if scripts are loaded twice
    if (_orig._odaPatched) return;

    window.showDebrief = function () {
      _orig.apply(this, arguments);
      // CFO measurement hook: inject anchor exec rate into debrief stats strip.
      // Fires at 50ms (before overlay at 120ms) so stat is visible after dismiss.
      setTimeout(function () {
        if (typeof g.odaRenderRatio === 'function') g.odaRenderRatio();
      }, 50);
      setTimeout(g.odaShowOverlay, 120);
    };
    window.showDebrief._odaPatched = true;
  }());

  // ── INIT TENSION METER ────────────────────────────────────────────────────
  // init() in field-ops.html ran synchronously before this script loaded.
  // The DOM is ready; inject and render the meter now.
  g.odaInitMeter();

})(window);
