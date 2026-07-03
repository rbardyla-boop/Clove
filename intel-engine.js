/**
 * INTEL-ENGINE.JS — CloveLearn Behavioral Intelligence Engine v1.0
 * ─────────────────────────────────────────────────────────────────
 * Sprint 4A: Pure aggregation layer. Zero AI. Zero external deps.
 * Consumer-only — reads existing od_ keys, never overwrites clinical data.
 * Own keys: od_intel_brief, od_intel_last_run, od_intel_config
 *
 * Exposes: window.IntelEngine
 */

(function (g) {
  'use strict';

  // ── DRILL REGISTRY ───────────────────────────────────────────────────────
  // Maps localStorage key → display label + href. Used for protocol ranking.
  var DRILL_REGISTRY = [
    { key: 'od_wgo_logs',         label: "WHAT'S GOING ON",    href: 'whats-going-on.html' },
    { key: 'od_tipp_full',        label: 'TIPP',               href: 'tipp-drill-full.html' },
    { key: 'od_improve_full',     label: 'IMPROVE',            href: 'improve-drill-full.html' },
    { key: 'od_mindfulness_full', label: 'MINDFULNESS',        href: 'mindfulness-drill-full.html' },
    { key: 'od_act_v1',           label: 'ACT',                href: 'act-drill.html' },
    { key: 'od_cbt_records',      label: 'CBT',                href: 'cbt-drill.html' },
    { key: 'od_dm_v1',            label: 'DEAR MAN',           href: 'dear-man-drill.html' },
    { key: 'od_chain_analysis',   label: 'CHAIN ANALYSIS',     href: 'chain-analysis-drill.html' },
    { key: 'od_rsd',              label: 'RSD SHIELD',         href: 'rsd-shield-drill.html' },
    { key: 'od_values_records',   label: 'VALUES',             href: 'values-drill.html' },
    { key: 'od_opposite_action',  label: 'OPPOSITE ACTION',    href: 'opposite-action-drill.html' },
    { key: 'od_intercepts',       label: 'THOUGHT INTERCEPTOR', href: 'thought-interceptor.html' },
    { key: 'od_redprotocol_log',  label: 'RED PROTOCOL',       href: 'red-protocol.html' },
    { key: 'od_clinical_scores',  label: 'CLINICAL SCREENING', href: 'clinical-assessments.html' },
    { key: 'od_meditation',       label: 'MEDITATION',         href: 'meditation-ops.html' },
    { key: 'od_aar_entries',      label: 'AFTER-ACTION',       href: 'after-action-review.html' },
  ];

  // ── INTERNAL HELPERS ─────────────────────────────────────────────────────
  // Read through od-core's warm-cache when available (handles the encrypted crisis
  // key transparently); fall back to a raw read so this engine still works standalone.
  function _load(key) {
    if (typeof window !== 'undefined' && typeof window.intelGet === 'function') {
      var v = window.intelGet(key, []);
      return Array.isArray(v) ? v : [];
    }
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
  }
  function _loadObj(key) {
    if (typeof window !== 'undefined' && typeof window.intelGet === 'function') {
      var v = window.intelGet(key, {});
      return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
    }
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return {}; }
  }
  function _save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  // Extract epoch ms from any entry regardless of field naming convention
  function _getTs(entry) {
    if (!entry) return 0;
    if (entry.ts && typeof entry.ts === 'number') return entry.ts;
    if (entry.timestamp && typeof entry.timestamp === 'number') return entry.timestamp;
    // Red Protocol stores ISO date string in entry.date
    if (entry.date) {
      var t = new Date(entry.date).getTime();
      return isNaN(t) ? 0 : t;
    }
    return 0;
  }

  // ── DISTORTION AGGREGATION ───────────────────────────────────────────────
  // Returns [{name, allTime, recent, recentPct}] sorted by allTime desc.
  // recentDays: how many days to consider "recent" (default 7)
  function aggregateDistortions(recentDays) {
    recentDays = recentDays || 7;
    var logs = _load('od_protocol_logs');
    var cutoff = Date.now() - (recentDays * 86400000);
    var allTime = {};
    var recent = {};

    logs.forEach(function (l) {
      var ts = l.timestamp || 0;
      (l.distortions || []).forEach(function (name) {
        if (!name) return;
        allTime[name] = (allTime[name] || 0) + 1;
        if (ts >= cutoff) recent[name] = (recent[name] || 0) + 1;
      });
    });

    var names = Object.keys(allTime);
    var maxAll = names.reduce(function (m, n) { return Math.max(m, allTime[n]); }, 1);

    return names
      .map(function (name) {
        return {
          name: name,
          allTime: allTime[name] || 0,
          recent: recent[name] || 0,
          allTimePct: Math.round(((allTime[name] || 0) / maxAll) * 100)
        };
      })
      .sort(function (a, b) { return b.allTime - a.allTime; });
  }

  // ── DRIFT DETECTION ──────────────────────────────────────────────────────
  // Compares current windowDays vs prior 4× rolling average.
  // Spike = ≥25% increase. Returns alerts sorted by severity.
  function detectDrift(windowDays) {
    windowDays = windowDays || 7;
    var logs = _load('od_protocol_logs');
    var now = Date.now();
    var windowMs = windowDays * 86400000;
    var recentCutoff = now - windowMs;
    var baselineCutoff = now - (5 * windowMs); // 4 prior windows

    var recentLogs   = logs.filter(function (l) { return (l.timestamp || 0) >= recentCutoff; });
    var baselineLogs = logs.filter(function (l) {
      var ts = l.timestamp || 0;
      return ts >= baselineCutoff && ts < recentCutoff;
    });

    if (baselineLogs.length < 5) {
      return { alerts: [], reason: 'INSUFFICIENT_BASELINE', recentCount: recentLogs.length, baselineCount: baselineLogs.length, totalProtocols: logs.length };
    }

    var recentCounts   = {};
    var baselineCounts = {};

    recentLogs.forEach(function (l) {
      (l.distortions || []).forEach(function (n) { recentCounts[n]   = (recentCounts[n]   || 0) + 1; });
    });
    baselineLogs.forEach(function (l) {
      (l.distortions || []).forEach(function (n) { baselineCounts[n] = (baselineCounts[n] || 0) + 1; });
    });

    // Normalize to per-session rate so window size differences don't skew
    function recentRate(n)   { return (recentCounts[n]   || 0) / recentLogs.length; }
    function baselineRate(n) { return (baselineCounts[n]  || 0) / (baselineLogs.length / 4); } // per-window avg

    var allNames = {};
    Object.keys(recentCounts).forEach(function (n) { allNames[n] = 1; });
    Object.keys(baselineCounts).forEach(function (n) { allNames[n] = 1; });

    var alerts = Object.keys(allNames)
      .map(function (name) {
        var r = recentRate(name);
        var b = baselineRate(name);
        var pctChange = b > 0 ? Math.round(((r - b) / b) * 100) : (r > 0 ? 999 : 0);
        return {
          name:      name,
          current:   recentCounts[name]   || 0,
          baseline:  Math.round((baselineCounts[name] || 0) / 4), // per-window avg
          pctChange: pctChange,
          direction: pctChange > 0 ? 'up' : 'down'
        };
      })
      .filter(function (a) { return Math.abs(a.pctChange) >= 25; })
      .sort(function (a, b) { return Math.abs(b.pctChange) - Math.abs(a.pctChange); });

    return {
      alerts:         alerts,
      recentCount:    recentLogs.length,
      baselineCount:  baselineLogs.length,
      totalProtocols: logs.length,
      windowDays:     windowDays
    };
  }

  // ── INTENSITY TREND ──────────────────────────────────────────────────────
  // Compares recent half-window vs prior half-window.
  // Returns {trend:'improving'|'stable'|'worsening'|'insufficient', ...}
  function getIntensityTrend(windowDays) {
    windowDays = windowDays || 14;
    var logs = _load('od_protocol_logs');
    var now  = Date.now();
    var half = (windowDays * 86400000) / 2;

    var recent = logs.filter(function (l) { return (l.timestamp || 0) >= now - half; });
    var prior  = logs.filter(function (l) {
      var ts = l.timestamp || 0;
      return ts >= now - (windowDays * 86400000) && ts < now - half;
    });

    if (recent.length < 3 || prior.length < 3) {
      return { trend: 'insufficient', avgRecent: 0, avgBaseline: 0, pctChange: 0 };
    }

    function avg(arr) { return arr.reduce(function (s, l) { return s + (l.intensity || 0); }, 0) / arr.length; }

    var avgRecent   = avg(recent);
    var avgBaseline = avg(prior);
    var pctChange   = avgBaseline > 0 ? Math.round(((avgRecent - avgBaseline) / avgBaseline) * 100) : 0;
    var trend       = pctChange <= -10 ? 'improving' : pctChange >= 15 ? 'worsening' : 'stable';

    return {
      trend:       trend,
      avgRecent:   Math.round(avgRecent   * 10) / 10,
      avgBaseline: Math.round(avgBaseline * 10) / 10,
      pctChange:   pctChange
    };
  }

  // ── PROTOCOL USAGE RANKING ───────────────────────────────────────────────
  // Returns drill registry sorted by usage count desc.
  function rankProtocols() {
    return DRILL_REGISTRY.map(function (drill) {
      var entries  = _load(drill.key);
      var lastUsed = 0;
      entries.forEach(function (e) {
        var ts = _getTs(e);
        if (ts > lastUsed) lastUsed = ts;
      });
      return { key: drill.key, label: drill.label, href: drill.href, count: entries.length, lastUsed: lastUsed };
    }).sort(function (a, b) { return b.count - a.count; });
  }

  // ── DATA FRESHNESS ───────────────────────────────────────────────────────
  function getDataFreshness() {
    var logs = _load('od_protocol_logs');
    if (!logs.length) return { lastSession: null, daysSince: null, totalSessions: 0 };
    var last = logs.reduce(function (m, l) { return Math.max(m, l.timestamp || 0); }, 0);
    var daysSince = last ? Math.floor((Date.now() - last) / 86400000) : null;
    return {
      lastSession:   last ? new Date(last).toLocaleDateString() : null,
      daysSince:     daysSince,
      totalSessions: logs.length
    };
  }

  // ── SITUATIONAL BRIEF ────────────────────────────────────────────────────
  // Generates a plain-text narrative brief. Zero AI — pure computed language.
  function generateBrief() {
    var logs = _load('od_protocol_logs');
    if (logs.length < 5) return null;

    var drift      = detectDrift(7);
    var intensity  = getIntensityTrend(14);
    var distorted  = aggregateDistortions(7);
    var protocols  = rankProtocols();
    var lines      = [];
    var now        = new Date();

    lines.push('SITUATIONAL BRIEF — ' + now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    lines.push('─'.repeat(48));

    // Intensity status
    if (intensity.trend === 'improving') {
      lines.push('STATUS: IMPROVING — Avg crisis intensity down ' + Math.abs(intensity.pctChange) + '% vs prior 7d (' + intensity.avgBaseline + ' → ' + intensity.avgRecent + '/10). Pattern stabilizing.');
    } else if (intensity.trend === 'worsening') {
      lines.push('STATUS: ELEVATED — Avg crisis intensity up ' + intensity.pctChange + '% vs prior 7d (' + intensity.avgBaseline + ' → ' + intensity.avgRecent + '/10). Increase protocol frequency.');
    } else if (intensity.trend === 'stable') {
      lines.push('STATUS: STABLE — Avg crisis intensity holding at ' + intensity.avgRecent + '/10. No significant trajectory detected.');
    } else {
      lines.push('STATUS: BASELINE COLLECTING — ' + logs.length + ' sessions logged. Need more data to establish trend.');
    }
    lines.push('');

    // Top distortions this week
    var topDist = distorted.filter(function (d) { return d.recent > 0; }).slice(0, 3);
    if (topDist.length > 0) {
      lines.push('TOP DISTORTIONS (last 7d): ' + topDist.map(function (d) { return d.name + ' (' + d.recent + ')'; }).join(' · '));
    } else {
      lines.push('TOP DISTORTIONS (last 7d): No sessions in window. Use What\'s Going On to log.');
    }
    lines.push('');

    // Drift alerts
    var spiking = drift.alerts.filter(function (a) { return a.pctChange > 0; }).slice(0, 3);
    var clearing = drift.alerts.filter(function (a) { return a.pctChange < 0; }).slice(0, 1);

    if (drift.reason === 'INSUFFICIENT_BASELINE') {
      lines.push('DRIFT: COLLECTING — Need ' + Math.max(0, 5 - drift.baselineCount) + ' more prior-week sessions to detect behavioral regression.');
    } else if (spiking.length === 0 && clearing.length === 0) {
      lines.push('DRIFT: NOMINAL — No significant distortion spikes vs 4-week baseline.');
    } else {
      spiking.forEach(function (a) {
        lines.push('⚠ SPIKE: ' + a.name + ' up ' + a.pctChange + '% vs baseline (' + a.baseline + ' → ' + a.current + ' this week).');
      });
      clearing.forEach(function (a) {
        lines.push('✓ CLEARING: ' + a.name + ' down ' + Math.abs(a.pctChange) + '% vs baseline.');
      });
    }
    lines.push('');

    // Most used protocol
    var top = protocols.filter(function (p) { return p.count > 0; })[0];
    if (top) {
      var lastDate = top.lastUsed ? new Date(top.lastUsed).toLocaleDateString() : 'unknown';
      lines.push('MOST DEPLOYED: ' + top.label + ' — ' + top.count + ' session' + (top.count !== 1 ? 's' : '') + '. Last used: ' + lastDate + '.');
    }

    lines.push('');
    lines.push('Source: ' + logs.length + ' protocol sessions. Auto-refreshes on each app open.');

    return lines.join('\n');
  }

  // ── NIGHT SHIFT RUNNER ───────────────────────────────────────────────────
  // Foreground catch-up — called on page load. 6-hour throttle prevents spam.
  // Phase 2 (PeriodicBackgroundSync from sw.js) will also call this entry point.
  function runNightShift() {
    var config     = _loadObj('od_intel_config');
    var lastAttempt = config.lastAttempt || 0;
    var now        = Date.now();

    if (now - lastAttempt < 6 * 3600000) return false; // throttle

    config.lastAttempt = now;
    _save('od_intel_config', config);

    try {
      var brief = generateBrief();
      if (brief) {
        _save('od_intel_brief', brief);
        _save('od_intel_last_run', now);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── STORAGE ESTIMATE ─────────────────────────────────────────────────────
  function getStorageEstimate(callback) {
    if (!navigator.storage || !navigator.storage.estimate) {
      callback(null);
      return;
    }
    navigator.storage.estimate().then(function (est) {
      callback({
        used:  est.usage  || 0,
        quota: est.quota  || 0,
        pct:   est.quota  ? Math.round(((est.usage || 0) / est.quota) * 100) : 0
      });
    }).catch(function () { callback(null); });
  }

  // ── PUBLIC API ───────────────────────────────────────────────────────────
  g.IntelEngine = {
    version:              '1.0.0',
    aggregateDistortions: aggregateDistortions,
    detectDrift:          detectDrift,
    getIntensityTrend:    getIntensityTrend,
    rankProtocols:        rankProtocols,
    getDataFreshness:     getDataFreshness,
    generateBrief:        generateBrief,
    runNightShift:        runNightShift,
    getStorageEstimate:   getStorageEstimate,
  };

})(window);
