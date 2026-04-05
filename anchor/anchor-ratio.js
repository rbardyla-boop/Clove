/**
 * ODA-ANCHOR-RATIO.JS — Post-Launch Measurement: Anchor Execution Rate
 * ──────────────────────────────────────────────────────────────────────
 * Appends a 4th stat block — ANCHOR EXEC RATE — to the debrief stats strip
 * every time showDebrief() fires. Reads od_anchor_meta. Writes nothing.
 * Uses existing .db-stat / .db-sv / .db-sl CSS — no new styles needed.
 * Called by anchor-step.js's patched showDebrief at t=50ms.
 *
 * CFO signal: executedCount / anchorCount over the lifetime of this device.
 * When this ratio stays flat while anchorCount rises → compliance theater.
 * When this ratio tracks > 50% → the tool is working.
 *
 * Exposes: window.odaRenderRatio()
 */
(function (g) {
  'use strict';

  g.odaRenderRatio = function () {
    var m      = (typeof g.odaMeta === 'function') ? g.odaMeta() : null;
    var stats  = document.querySelector('.db-stats');
    if (!stats) return; // debrief not in DOM — safe no-op

    // Idempotent: remove prior injection before re-rendering
    var prev = document.getElementById('oda-ratio-stat');
    if (prev) prev.remove();

    // Nothing to show until the first anchor has been saved
    if (!m || !(m.anchorCount > 0)) return;

    var pct = Math.round(((m.executedCount || 0) / m.anchorCount) * 100);
    var col = pct >= 75 ? 'var(--grn)' : pct >= 50 ? 'var(--gld)' : 'var(--red)';

    var el      = document.createElement('div');
    el.id        = 'oda-ratio-stat';
    el.className = 'db-stat';
    // font-size 20px (vs native 26px) keeps 3-char "XX%" from overflowing on small screens
    el.innerHTML =
      '<div class="db-sv" style="font-size:20px;color:' + col + '">' + pct + '%</div>' +
      '<div class="db-sl">ANCHOR<br>EXEC RATE</div>';

    stats.appendChild(el);
  };

})(window);
