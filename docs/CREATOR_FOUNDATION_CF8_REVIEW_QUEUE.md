# Creator Foundation CF-8 — Human-Review Queue + Moderation/Audit Layer

**Status:** implemented, **local/operator-only, ZERO live authority, no live loader, no deploy.**
**Not:** live authorization · loader enablement · auto-approval · public upload · economy · ownership · rent · accounts · marketplace.
**Parents:** `docs/CREATOR_FOUNDATION_CF7_CF8_LIVE_LOADER_PLAN.md` (the plan this implements §10–11), `docs/NEON_CIRCUIT_CREATOR_PIPELINE_ROADMAP.md` (CF-8).

## What CF-8 adds

The **human safety layer** the future live loader (CF-7, NOT BUILT) will depend on. Automated validation
(CF-1/CF-3 deny-regex) screens markup/script/URL + economy vocabulary, but **not** profanity, slurs,
harassment, impersonation, or PII in a package's free-text fields (`display_name`, `package_id`,
`operator_note`). CF-8 is where a **human** screens those and records a hash-bound decision in an
**append-only, hash-chained audit trail** — before any package could ever be live-approved.

> **CF-8 GRANTS ZERO LIVE AUTHORITY.** The most a package reaches here is `approved_for_live_candidate` —
> a human **recommendation**, not a live authorization. `live_world_authorized` is **always false** on
> every record, no loader is touched, and `LIVE_WORLD_LOADER_ENABLED` stays `false`. Only the separate,
> still-disabled CF-7 loader could turn a candidate into a live render, and only by re-checking its own
> live receipt/registry/flag. **A CF-6 validation verdict is NOT approval.**

## Review lifecycle (5 states, deny-by-default)

```
pending ──human decision──▶ needs_changes | rejected | approved_for_live_candidate
approved_for_live_candidate ──revoke──▶ revoked
rejected / revoked = terminal (a fresh submission/review is required to try again)
```

`approved_for_live_candidate` is reachable **only** through a human decision that passes the **free-text
review gate**. Nothing is ever auto-promoted; an unknown id can't be decided; illegal transitions are
rejected; the queue is bounded (`MAX_QUEUE = 256`).

## The free-text review gate (mandatory)

A package becomes a live **candidate** only when the human decision carries:

- `free_text_reviewed: true` — a human screened `display_name`, `package_id`, **and** `operator_note`;
- `free_text_cleared: true` — and cleared them; and
- `review_criteria` attesting **all** of `profanity`, `slurs`, `harassment`, `impersonation`, `pii`.

Missing any of these → the approval is **rejected**. The exact screened free-text strings are stored on
the record so a future CF-7 live receipt can bind them (plan F3 — no mint-time swap). The deny-regex is a
syntactic filter only; content appropriateness is the human's responsibility.

## What each record binds (hash-bound)

A review record records the **hashes** of the prior artifacts so the decision is bound to an exact
package + its local approval + its validation:

```
package_hash             the canonical package hash
receipt_hash             the CF-2 local approval receipt's hash (the package's local approval)
validator_report_hash    the CF-6 / validator report hash  (a verdict — NOT approval)
```

A different package (different hash) needs its own review. The record never carries
`live_world_authorized: true` — that boolean is hard-coded false and is not an input.

## Append-only, hash-chained audit trail

Every transition (`submit`, every `decide`, every `revoke`) appends an immutable entry hash-chained to
the prior one (`entry_hash = sha256(canonicalize({seq, at, from→to, review_id, package_hash, reviewer,
reason, prev_hash}))`). `verifyAudit(log)` recomputes the chain end-to-end; **editing or reordering any
entry breaks it** (plan F6 — tamper-evident audit). Revocation is recorded and **irreversible** without a
fresh approval.

## Quarantine (security control)

`review-queue.mjs` imports **only** the hash util (`package-hash.mjs`). It imports **no** approved-loader,
**no** live registry, **no** Worker/DO; it exposes **no** method that grants live authority, enables a
loader, or mints a live receipt. The deny-by-default queue never auto-promotes. (Mirrors the CF-6
quarantine: a verdict/decision authorizes nothing live by construction.)

## Files

```
arcade/creator/moderation/review-queue.mjs   pure core: states, records, decisions, revocation, audit, queue
arcade/creator/moderation/review-cli.mjs     local operator reference flow (submit→approve→revoke + audit)
```

No Worker/DO change. All under `arcade/creator/**` → excluded from the curated client upload (verified).

## Validation

```
node --test tests/creator/review-queue.test.mjs   # 11 unit: unreviewed/revoked never candidates,
                                                   #   CF-6 verdict ≠ approval, free-text gate, zero live
                                                   #   authority, append-only/hash-chained audit, deny-by-default
node arcade/creator/moderation/review-cli.mjs      # operator reference flow + audit verification
node --test tests/creator/*.test.mjs                # 147 creator unit (136 + 11), green
node --test tests/arcade/*.test.mjs                 # 608 arcade unit (unchanged), green
node --test tests/creator/curated-upload.test.mjs   # CF-8 excluded from curated upload
node tests/arcade/check-production-config.mjs        # PASS; node scripts/check-city-build-size.mjs — within budget
cd workers/arcade && wrangler deploy --dry-run      # byte-identical (200.81 KiB) — no Worker change
```

## Next Creator Foundation phase

```
CF-7 (= "CF-E")  operator-approved LIVE loader — now UNBLOCKED to implement (SHIPPED DISABLED, staging-only):
      a CF-8 `approved_for_live_candidate` + the bound free-text review is a PRECONDITION the CF-7 live
      receipt must carry; the loader stays closed (LIVE_WORLD_LOADER_ENABLED=false) until a separate,
      human-cleared, staging-verified production gate.
```

CF-8 exists; the human-review queue is real, not theoretical. The live world stays closed. Detail +
threat model: `docs/CREATOR_FOUNDATION_CF7_CF8_LIVE_LOADER_PLAN.md`.
