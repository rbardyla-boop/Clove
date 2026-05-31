/**
 * Ticket ledger — PURE, runtime-agnostic.
 *
 * Every ticket-affecting event appends one ledger entry to the owning player's
 * private ledger. Entries are de-duplicated by a deterministic ledger_id derived
 * from the source event (round id / redemption id), so a replayed network frame
 * can never create a second award/spend entry.
 *
 * The ledger is PRIVATE to its owner. Each entry also carries a
 * public_safe_summary that the server MAY broadcast (e.g. "earned tickets at
 * Pulse Tap") without leaking the balance or full history.
 */

export function makeLedgerId(eventType, refId) {
  return `led-${eventType}-${refId}`;
}

export function getLedger(state, playerId) {
  return state.ledger[playerId] ? state.ledger[playerId].slice() : [];
}

/**
 * Append a ledger entry (idempotent by ledger_id). Returns { state, entry, added }.
 * If an entry with the same ledger_id already exists for the player, this is a
 * no-op (added=false) — that is the duplicate-protection guarantee.
 */
export function appendLedger(state, { playerId, eventType, delta, balanceAfter, source, refId, cabinetId = null, cabinetType = null, prizeId = null, summary, now }) {
  const ledgerId = makeLedgerId(eventType, refId);
  const existing = state.ledger[playerId] || [];
  if (existing.some((e) => e.ledger_id === ledgerId)) {
    return { state, entry: existing.find((e) => e.ledger_id === ledgerId), added: false };
  }
  const entry = {
    ledger_id: ledgerId,
    player_id: playerId,
    server_time: now,
    event_type: eventType,
    delta,
    balance_after: balanceAfter,
    source,
    cabinet_id: cabinetId,
    cabinet_type: cabinetType,
    prize_id: prizeId,
    public_safe_summary: summary,
  };
  const ledger = { ...state.ledger, [playerId]: [...existing, entry] };
  return { state: { ...state, ledger }, entry, added: true };
}
