/**
 * Phase 1 ticket ledger — SIMULATOR-LOCAL PORT of workers/arcade/src/ledger.mjs.
 *
 * Every ticket-affecting event appends one entry to the owner's PRIVATE ledger,
 * de-duplicated by a deterministic ledger_id (so a replayed/duplicated fabric
 * event can never create a second entry). Each entry also carries a
 * public_safe_summary the feed MAY show without leaking the balance/history.
 * Operates on an `arcade` slice with a `ledger` map.
 */

export function makeLedgerId(eventType, refId) {
  return `led-${eventType}-${refId}`;
}

export function getLedger(arcade, actor) {
  return arcade.ledger[actor] ? arcade.ledger[actor].slice() : [];
}

/** Append a ledger entry (idempotent by ledger_id). Returns the new arcade slice. */
export function appendLedger(arcade, { actor, eventType, delta, balanceAfter, source, refId, cabinetId = null, cabinetType = null, challengeId = null, prizeId = null, summary, tick }) {
  const ledgerId = makeLedgerId(eventType, refId);
  const existing = arcade.ledger[actor] || [];
  if (existing.some((e) => e.ledger_id === ledgerId)) return arcade; // duplicate-protection
  const entry = {
    ledger_id: ledgerId, actor_id: actor, tick, event_type: eventType, delta, balance_after: balanceAfter,
    source, cabinet_id: cabinetId, cabinet_type: cabinetType, challenge_id: challengeId, prize_id: prizeId,
    public_safe_summary: summary,
  };
  return { ...arcade, ledger: { ...arcade.ledger, [actor]: [...existing, entry] } };
}
