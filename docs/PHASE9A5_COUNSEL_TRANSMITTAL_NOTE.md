# Phase 9A.5 Economy Legal/Safety Review — Counsel Transmittal Note

> **This is a transmittal note, not legal advice.** It points to the review materials and lists
> the operator's questions. It makes no determination of permissibility and changes no production
> behavior. **PR #87 is not merged.** CF-7 live loading remains disabled (ADR-047) pending this review.

**PR:** https://github.com/rbardyla-boop/Clove/pull/87 (open · docs-only · not merged)

## Materials for review (all in PR #87)

1. **`PHASE9A5_ECONOMY_LEGAL_SAFETY_AUDIT.md`** — engineering fact record and counsel-escalation memo
   (verified facts cited to `file:line`; counsel questions separated from facts).
2. **`PHASE9A5_COUNSEL_REVIEW_PACKET.md`** — evidence index with `file:line` anchors, a fact table,
   and reproducibility (grep) commands.
3. **`PROJECT_CHARTER.md` / ADR-047** — records that CF-7 live loading remains disabled until the
   Phase 9A.5 review is resolved.

## Review context (facts only)

The arcade economy is live, **non-cash**, **persistent**, `playerId`-keyed, publicly reachable, and
currently has no documented legal review. The audit records verified mitigations: **no cash-out, no
marketplace, no player-to-player transfer, capped payout, and server-authoritative balance changes.**
Counsel is asked to review the risk gates and advise the operator decisions below.

## Six questions for counsel

1. **Can the current non-cash persistent ticket/prize economy remain live as-is?**
   Pointers: audit §7.D; packet §8.

2. **Does the public/minors-reachable arcade need an age gate, parental-consent posture, or copy change?**
   Pointers: audit §6 and §7.A; packet §3 and §7.

3. **Does the language around "tickets," "prizes," "redeem," "owned," or "rarity" create avoidable
   consumer, gambling, or stored-value risk?**
   Pointers: audit §8; audit §7.B/§7.C; packet §3.

4. **Is a per-player reset/delete path required or strongly recommended?**
   Pointers: audit §7.G; packet §7.

5. **Can CF-7 live loading ever touch reward/economy surfaces?**
   Pointers: ADR-047; packet §8.

6. **What exact conditions must be satisfied before any economy expansion, marketplace, ownership,
   transfer, or public creator loading?**
   Pointers: audit §12; packet §8.

## Requested output from counsel

For each question, please mark: **YES / NO / MODIFY / MORE FACTS NEEDED**.
For **MODIFY** or **MORE FACTS NEEDED**, please identify the required product, copy, data-retention,
age-positioning, or engineering condition.

## Current operator freeze

Until counsel responds, the following remain frozen: economy expansion, CF-7 live loading, copy-risk
edits, reset/delete implementation, marketplace/ownership/transfer work, and charter reconciliation.

---
*Transmittal note only. No legal advice, no determination of permissibility, no production change.
Route the six questions to qualified counsel before any economy expansion.*
