// Reuse the closed cost subsystem. This seam is intentionally small: a future
// AI or Browser Run callback must be passed to this helper after cache/public
// evidence checks and before the provider is invoked.
export { runReservedSpend, reserveBeforeSpend, authorityForDay } from '../../research-cost-authority/src/client';
