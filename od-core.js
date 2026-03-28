/**
 * OD-CORE.JS — Operator's Deck Shared Utilities v1.0.0
 * ─────────────────────────────────────────────────────
 * Canonical implementations of repeated functions across 30+ pages.
 * Include via <script src="od-core.js"></script> in any sub-page.
 *
 * Does NOT overwrite existing globals — safe to load alongside legacy code.
 * Each function checks if it's already defined before declaring.
 *
 * Covers:
 *   - Sanitization (esc, san)
 *   - Toast notifications (showToast)
 *   - Safe localStorage (odGet, odSet, odDel, odKeys)
 *   - JSON parse safety (safeJSON)
 *   - Array/number validation (vArr, vNum)
 *   - Debounce / throttle
 *   - Navigation helpers
 *   - Storage quota reporting
 */

(function(g) {
  'use strict';

  // ── SANITIZATION ──────────────────────────────────────────────
  // HTML-escape a string. Prevents XSS in innerHTML contexts.
  if (typeof g.esc !== 'function') {
    g.esc = function(s) {
      if (typeof s !== 'string') return '';
      var d = document.createElement('div');
      d.appendChild(document.createTextNode(s));
      return d.innerHTML;
    };
  }

  // Strip HTML tags and cap length. For display-only sanitization.
  if (typeof g.san !== 'function') {
    g.san = function(s, max) {
      if (typeof s !== 'string') return '';
      return s.substring(0, max || 5000).replace(/<[^>]*>/g, '');
    };
  }

  // ── TOAST NOTIFICATIONS ───────────────────────────────────────
  if (typeof g.showToast !== 'function') {
    g.showToast = function(msg, opts) {
      opts = opts || {};
      var old = document.querySelector('.toast');
      if (old) old.remove();
      var t = document.createElement('div');
      t.className = 'toast';
      if (opts.bg) t.style.background = opts.bg;
      if (opts.color) t.style.color = opts.color;
      t.textContent = msg;
      document.body.appendChild(t);
      var dur = opts.duration || 2500;
      setTimeout(function() { if (t.parentNode) t.remove(); }, dur);
    };
  }

  // ── SAFE JSON PARSING ─────────────────────────────────────────
  // Returns fallback on any parse error. Never throws.
  if (typeof g.safeJSON !== 'function') {
    g.safeJSON = function(str, fallback) {
      if (typeof fallback === 'undefined') fallback = null;
      if (typeof str !== 'string' || !str) return fallback;
      try { return JSON.parse(str); }
      catch (e) { return fallback; }
    };
  }

  // ── ARRAY / NUMBER VALIDATORS ─────────────────────────────────
  // Validate parsed value is an array, cap length.
  if (typeof g.vArr !== 'function') {
    g.vArr = function(v, max) {
      if (!Array.isArray(v)) return [];
      return max ? v.slice(0, max) : v;
    };
  }

  // Validate parsed value is a finite number, return default otherwise.
  if (typeof g.vNum !== 'function') {
    g.vNum = function(v, def) {
      var n = Number(v);
      return isFinite(n) ? n : (typeof def === 'number' ? def : 0);
    };
  }

  // ── SAFE LOCALSTORAGE ─────────────────────────────────────────
  // Read a key from localStorage with safe JSON parsing.
  // Returns fallback on missing key or corrupt data.
  if (typeof g.odGet !== 'function') {
    g.odGet = function(key, fallback) {
      if (typeof fallback === 'undefined') fallback = null;
      try {
        var raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    };
  }

  // Write a value to localStorage as JSON. Returns true/false.
  if (typeof g.odSet !== 'function') {
    g.odSet = function(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    };
  }

  // Remove a key. Returns true/false.
  if (typeof g.odDel !== 'function') {
    g.odDel = function(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (e) {
        return false;
      }
    };
  }

  // List all OD-related keys (od_, od3, sp-plans, ops-, pd-).
  if (typeof g.odKeys !== 'function') {
    g.odKeys = function() {
      var keys = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && (
            k.indexOf('od') === 0 ||
            k.indexOf('sp-') === 0 ||
            k.indexOf('ops-') === 0 ||
            k.indexOf('pd-') === 0 ||
            k === 'kb-tasks'
          )) {
            keys.push(k);
          }
        }
      } catch (e) {}
      return keys.sort();
    };
  }

  // ── STORAGE QUOTA ─────────────────────────────────────────────
  // Estimate total bytes used by OD keys in localStorage.
  if (typeof g.odStorageSize !== 'function') {
    g.odStorageSize = function() {
      var total = 0;
      var keys = g.odKeys();
      for (var i = 0; i < keys.length; i++) {
        try {
          var v = localStorage.getItem(keys[i]);
          if (v) total += keys[i].length + v.length;
        } catch (e) {}
      }
      return total * 2; // UTF-16 = 2 bytes per char
    };
  }

  // ── DEBOUNCE / THROTTLE ───────────────────────────────────────
  if (typeof g.odDebounce !== 'function') {
    g.odDebounce = function(fn, ms) {
      var t;
      return function() {
        var ctx = this, args = arguments;
        clearTimeout(t);
        t = setTimeout(function() { fn.apply(ctx, args); }, ms);
      };
    };
  }

  if (typeof g.odThrottle !== 'function') {
    g.odThrottle = function(fn, ms) {
      var last = 0;
      return function() {
        var now = Date.now();
        if (now - last >= ms) {
          last = now;
          fn.apply(this, arguments);
        }
      };
    };
  }

  // ── NAVIGATION HELPERS ────────────────────────────────────────
  // Canonical back-to-deck navigation.
  if (typeof g.odBack !== 'function') {
    g.odBack = function() {
      window.location.href = './?tab=more';
    };
  }

  // Navigate to a sub-page with optional disclaimer gate.
  if (typeof g.odNav !== 'function') {
    g.odNav = function(href) {
      window.location.href = href;
    };
  }

  // ── DATE HELPERS ──────────────────────────────────────────────
  if (typeof g.odDate !== 'function') {
    g.odDate = function(d) {
      if (!d) d = new Date();
      if (typeof d === 'string') d = new Date(d);
      var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return m[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    };
  }

  if (typeof g.odTimestamp !== 'function') {
    g.odTimestamp = function() {
      return new Date().toISOString();
    };
  }

  // ── PERFORMANCE: requestAnimationFrame render batching ────────
  if (typeof g.odRender !== 'function') {
    var pending = false;
    g.odRender = function(fn) {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function() {
        pending = false;
        fn();
      });
    };
  }

  // ── INTEGRITY CHECK ───────────────────────────────────────────
  // Validate a localStorage key contains parseable JSON. Returns status object.
  if (typeof g.odCheckKey !== 'function') {
    g.odCheckKey = function(key) {
      var result = { key: key, exists: false, valid: false, size: 0, type: 'missing' };
      try {
        var raw = localStorage.getItem(key);
        if (raw === null) return result;
        result.exists = true;
        result.size = (key.length + raw.length) * 2;
        var parsed = JSON.parse(raw);
        result.valid = true;
        result.type = Array.isArray(parsed) ? 'array[' + parsed.length + ']' :
                      (parsed && typeof parsed === 'object') ? 'object' :
                      typeof parsed;
      } catch (e) {
        result.type = 'CORRUPT';
      }
      return result;
    };
  }

  // ── VERSION STAMP ─────────────────────────────────────────────
  g.OD_CORE_VERSION = '1.0.0';

})(typeof window !== 'undefined' ? window : this);
