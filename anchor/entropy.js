/**
 * ODA-ENTROPY.JS — Operator Directive Anchor: entropy math
 * ──────────────────────────────────────────────────────────
 * Formula: f(t) = 1 − e^(−t / τ)
 *   τ = 24h (time constant)
 *   t = time elapsed since anchor creation
 *
 * This is thermodynamic saturation — not gamification.
 * The directive's ordered-state potential decays toward
 * maximum entropy as un-executed time accumulates.
 *
 * Half-entropy time (t₁/₂): τ × ln(2) ≈ 16.6h
 * At  24h: f = 0.63   At  48h: f = 0.86
 * At  72h: f = 0.95   At 120h: f = 0.99
 *
 * Exposes: window.odaEntropy(anchoredAtMs) → number [0, 1)
 */
(function (g) {
  'use strict';

  var TAU_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  /**
   * Compute entropy (tension) for an un-executed anchor.
   * @param  {number} anchoredAtMs  Date.now() at anchor creation
   * @returns {number}              value in [0, 1)
   */
  g.odaEntropy = function (anchoredAtMs) {
    var elapsed = Math.max(0, Date.now() - (anchoredAtMs || 0));
    return 1 - Math.exp(-elapsed / TAU_MS);
  };

})(window);
