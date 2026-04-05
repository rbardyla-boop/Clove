/**
 * ODA-DB.JS — Directive Anchor local storage layer
 * ──────────────────────────────────────────────────
 * Uses localStorage to match the existing clovelearn storage pattern.
 * All existing keys use the od_ prefix; anchor keys follow the same convention.
 * Every operation is fail-open (returns null/false on error, never throws).
 *
 * Anchor record shape:
 * {
 *   id:               string,  // 'oda-' + Date.now()
 *   directiveText:    string,
 *   actionText:       string,
 *   cardKey:          string,  // matches POOLS[state][n].key
 *   cardTitle:        string,
 *   state:            string,  // e.g. 'discipline'
 *   stateLabel:       string,  // e.g. 'DISCIPLINE'
 *   anchoredAt:       number,  // ms timestamp
 *   scheduledFor:     number,  // ms timestamp (user-chosen)
 *   executed:         boolean,
 *   executedAt:       number|null,
 *   calendarExported: boolean
 * }
 *
 * Meta record shape:
 * {
 *   firstSessionAt: number,   // ms — set once on first session, never overwritten
 *   anchorCount:    number,
 *   executedCount:  number,
 *   skipStreak:     number    // consecutive sessions where anchor was skipped
 * }
 *
 * Exposes:
 *   odaSave, odaLoad, odaClear, odaCheckExpiry, odaExecute
 *   odaMeta, odaSaveMeta
 *   odaIsMandatory, odaRecordSaved, odaRecordSkipped
 *   odaMeterDismissed, odaDismissMeter
 */
(function (g) {
  'use strict';

  var K_ANCHOR = 'od_anchor';       // current anchor
  var K_META   = 'od_anchor_meta';  // usage metadata
  var K_NODIM  = 'od_anchor_nodim'; // permanent meter dismiss flag
  var TTL_30D  = 30 * 24 * 60 * 60 * 1000; // 30-day TTL for unexecuted anchor

  // ── ANCHOR CRUD ───────────────────────────────────────────────────────────

  g.odaSave = function (anchor) {
    try { localStorage.setItem(K_ANCHOR, JSON.stringify(anchor)); return true; }
    catch (e) { return false; }
  };

  g.odaLoad = function () {
    try {
      var raw = localStorage.getItem(K_ANCHOR);
      if (!raw) return null;
      var a = JSON.parse(raw);
      // Shape-validate: must have the key fields
      if (!a || typeof a.anchoredAt !== 'number' || typeof a.directiveText !== 'string') return null;
      return a;
    } catch (e) { return null; }
  };

  g.odaClear = function () {
    try { localStorage.removeItem(K_ANCHOR); return true; }
    catch (e) { return false; }
  };

  // ── 30-DAY EXPIRY ────────────────────────────────────────────────────────
  // Called on page load. Non-punitive: quietly clears expired anchor.
  // The meter simply disappears — no notice, no guilt.
  g.odaCheckExpiry = function () {
    var a = g.odaLoad();
    if (!a || a.executed) return;
    if (Date.now() - a.anchoredAt > TTL_30D) {
      g.odaClear();
    }
  };

  // ── MARK EXECUTED ─────────────────────────────────────────────────────────
  g.odaExecute = function () {
    var a = g.odaLoad();
    if (!a) return false;
    a.executed   = true;
    a.executedAt = Date.now();
    g.odaSave(a);
    var m = g.odaMeta();
    m.executedCount = (m.executedCount || 0) + 1;
    g.odaSaveMeta(m);
    return true;
  };

  // ── META CRUD ─────────────────────────────────────────────────────────────

  g.odaMeta = function () {
    try {
      var raw = localStorage.getItem(K_META);
      if (raw) {
        var m = JSON.parse(raw);
        if (m && typeof m === 'object') return m;
      }
    } catch (e) {}
    return { firstSessionAt: null, anchorCount: 0, executedCount: 0, skipStreak: 0 };
  };

  g.odaSaveMeta = function (m) {
    try { localStorage.setItem(K_META, JSON.stringify(m)); return true; }
    catch (e) { return false; }
  };

  // ── MANDATORY WINDOW ──────────────────────────────────────────────────────
  // Returns true during the 30-day onboarding window.
  // When mandatory: the skip button requires two clicks before it works.
  //
  // Adaptive friction: if skipStreak >= 3, mandatory is temporarily suspended.
  // Rationale: 3 consecutive skips signals friction fatigue — the user has
  // trained the step as "bureaucratic overhead." Reducing friction prevents
  // the pattern from cementing. skipStreak resets on next successful anchor.
  g.odaIsMandatory = function () {
    var m = g.odaMeta();
    if (!m.firstSessionAt) {
      // First ever session — initialize meta now, mandate is active
      m.firstSessionAt = Date.now();
      g.odaSaveMeta(m);
      return true;
    }
    // Adaptive suspension
    if ((m.skipStreak || 0) >= 3) return false;
    // 30-day window check
    var daysSince = (Date.now() - m.firstSessionAt) / 86400000;
    return daysSince <= 30;
  };

  g.odaRecordSaved = function () {
    var m = g.odaMeta();
    if (!m.firstSessionAt) m.firstSessionAt = Date.now();
    m.anchorCount = (m.anchorCount || 0) + 1;
    m.skipStreak  = 0; // reset streak on successful save
    g.odaSaveMeta(m);
  };

  g.odaRecordSkipped = function () {
    var m = g.odaMeta();
    if (!m.firstSessionAt) m.firstSessionAt = Date.now();
    m.skipStreak = (m.skipStreak || 0) + 1;
    g.odaSaveMeta(m);
  };

  // ── METER DISMISS ─────────────────────────────────────────────────────────
  // The philosopher's escape hatch: one click → meter gone permanently.
  // This is stored as a separate key so it survives anchor clears.
  g.odaMeterDismissed = function () {
    try { return localStorage.getItem(K_NODIM) === 'true'; }
    catch (e) { return false; }
  };

  g.odaDismissMeter = function () {
    try { localStorage.setItem(K_NODIM, 'true'); }
    catch (e) {}
  };

})(window);
