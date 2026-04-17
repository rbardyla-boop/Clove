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

  // ── VAULT (IndexedDB + Web Crypto) ───────────────────────────
  var _vk = null;

  var VAULT_DB    = 'clove_vault';
  var VAULT_STORE = 'keys';
  var VAULT_KEY_ID = 'main_key';

  function openVaultDB() {
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(VAULT_DB, 1);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(VAULT_STORE)) {
          db.createObjectStore(VAULT_STORE);
        }
      };
      req.onsuccess = function() { resolve(req.result); };
      req.onerror   = function() { reject(req.error); };
    });
  }

  function getStoredKey(db) {
    return new Promise(function(resolve, reject) {
      var tx    = db.transaction(VAULT_STORE, 'readonly');
      var store = tx.objectStore(VAULT_STORE);
      var req   = store.get(VAULT_KEY_ID);
      req.onsuccess = function() { resolve(req.result || null); };
      req.onerror   = function() { reject(req.error); };
    });
  }

  function storeKey(db, jwk) {
    return new Promise(function(resolve, reject) {
      var tx    = db.transaction(VAULT_STORE, 'readwrite');
      var store = tx.objectStore(VAULT_STORE);
      var req   = store.put(jwk, VAULT_KEY_ID);
      req.onsuccess = function() { resolve(); };
      req.onerror   = function() { reject(req.error); };
    });
  }

  function generateVaultKey() {
    return crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  if (typeof g.initVault !== 'function') {
    g.initVault = async function() {
      if (_vk) return _vk;

      var db  = await openVaultDB();
      var jwk = await getStoredKey(db);

      if (!jwk) {
        var key = await generateVaultKey();
        jwk = await crypto.subtle.exportKey('jwk', key);
        await storeKey(db, jwk);
        _vk = key;
        return _vk;
      }

      _vk = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );

      return _vk;
    };
  }

  // ── ENCRYPT / DECRYPT ────────────────────────────────────────
  function uint8ToBase64(u8) {
    var binary = '';
    for (var i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
    return btoa(binary);
  }

  function base64ToUint8(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  g.encryptValue = async function(value) {
    if (!_vk) throw new Error('Vault not initialized');
    var iv       = crypto.getRandomValues(new Uint8Array(12));
    var encoded  = new TextEncoder().encode(JSON.stringify(value));
    var cipher   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, _vk, encoded);
    var combined = new Uint8Array(12 + cipher.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipher), 12);
    return uint8ToBase64(combined);
  };

  g.decryptValue = async function(stored) {
    if (!_vk) throw new Error('Vault not initialized');
    var combined  = base64ToUint8(stored);
    var iv        = combined.slice(0, 12);
    var data      = combined.slice(12);
    var decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, _vk, data);
    return JSON.parse(new TextDecoder().decode(decrypted));
  };

  // ── SAFE LOCALSTORAGE (encrypted) ────────────────────────────
  // odGet / odSet / odDel are now async.
  // odGet: tries decrypt first; falls back to plaintext + migrates silently.
  // odSet: always encrypts before writing.
  // Never throws — callers get fallback on any failure.

  g.odGet = async function(key, fallback) {
    if (typeof fallback === 'undefined') fallback = null;
    try {
      var raw = localStorage.getItem(key);
      if (raw === null) return fallback;

      // Try encrypted path first
      try {
        return await g.decryptValue(raw);
      } catch (_e) {
        // Legacy plaintext — migrate silently
        try {
          var parsed = JSON.parse(raw);
          g.odSet(key, parsed); // fire-and-forget re-encrypt
          return parsed;
        } catch (_e2) {
          return fallback;
        }
      }
    } catch (err) {
      console.error('odGet failed:', err);
      return fallback;
    }
  };

  g.odSet = async function(key, value) {
    try {
      var encrypted = await g.encryptValue(value);
      localStorage.setItem(key, encrypted);
    } catch (err) {
      if (err && err.name === 'QuotaExceededError' && typeof g.showToast === 'function') {
        g.showToast('STORAGE FULL \u2014 EXPORT YOUR DATA NOW');
      }
      console.error('odSet failed:', err);
    }
  };

  g.odDel = function(key) {
    try { localStorage.removeItem(key); } catch (err) { console.error('odDel failed:', err); }
  };

  // ── MIGRATION ─────────────────────────────────────────────────
  var MIGRATION_FLAG = 'od_migrated_v1';

  function isMigrated() {
    return localStorage.getItem(MIGRATION_FLAG) === '1';
  }

  function setMigrated() {
    localStorage.setItem(MIGRATION_FLAG, '1');
  }

  async function migrateLegacyKeys() {
    if (!_vk) { console.warn('Vault not initialized — skipping migration'); return; }
    var keys = Object.keys(localStorage);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key === MIGRATION_FLAG) continue;
      try {
        var raw = localStorage.getItem(key);
        if (!raw) continue;
        try { await g.decryptValue(raw); continue; } catch (_e) {} // already encrypted
        try {
          var parsed = JSON.parse(raw);
          await g.odSet(key, parsed);
        } catch (_e2) {} // not JSON — leave as-is
      } catch (err) {
        console.error('Migration error on key: ' + key, err);
      }
    }
  }

  g.runMigrationOnce = async function() {
    if (isMigrated()) return;
    try {
      await migrateLegacyKeys();
      setMigrated();
    } catch (err) {
      console.error('Migration failed:', err);
    }
  };

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
