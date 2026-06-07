# Creator Foundation CF-7 / CF-8 — Live Loader + Human-Review Gate (PLAN ONLY)

**Status:** **plan / design only. No code. No loader enablement. No deploy. No Phase 8.**
**Hard boundary (unchanged by this document):** `LIVE_WORLD_LOADER_ENABLED` **remains `false`.**
**Parents:** `docs/NEON_CIRCUIT_CREATOR_PIPELINE_ROADMAP.md` (CF-7/CF-8), `docs/CREATOR_FOUNDATION_CF2_APPROVED_LOADER.md` (the boundary this extends), `docs/NEON_CIRCUIT_GAMEPLAY_CHARTER.md` §15–17.

> This is the most dangerous gate in the program: the first time a player-authored package could render
> in the **live world**. It is written *before* any city-scale (Phase 8) work so that map scale is built
> around a **known** trust boundary, not a guessed one. This document defines the boundary; it changes no
> behavior. Implementation is a separate, explicitly-authorized phase.

---

## 1. Where CF-7/CF-8 sit (and the rules they must not weaken)

Today the live path is **triple-locked** (verified in `arcade/creator/approval/`):

1. `approved-loader.mjs` — `LIVE_WORLD_LOADER_ENABLED = false` (module constant, checked **first**;
   `live_world` mode → `live_world_loader_not_enabled`).
2. `approval-receipt.mjs` — `validateReceipt` **rejects** `live_world_authorized: true`.
3. `approved-package-registry.mjs` — `validateRegistry` **rejects** an entry with `live_world_authorized: true`.

Plus the standing rule chain: **local validate (CF-1) → local approve receipt (CF-2) → CF-6 verdict →
CF-5 composition** — *all local, all zero-live-trust.*

**CF-7/CF-8 must add a live track WITHOUT touching that chain.** The design principle:

> **A parallel, additionally-gated LIVE track.** The CF-2 local artifacts (local receipt, local registry,
> `local_preview` loader path) stay **byte-frozen** and keep rejecting `live_world_authorized:true`. The
> live path is a *separate* set of artifacts (live receipt, live registry, live loader path) with their
> *own* validators. Nothing in the local path is loosened; the live path is opt-in and triple-gated in
> its own right.

Two statements this plan makes load-bearing and repeats throughout:

- **A CF-6 Hive validation verdict is NOT live authorization.** `valid` means "passed the structural
  validators," nothing more. It is a *precondition*, never a sufficient cause.
- **CF-8 (human review) MUST exist and be operational before the FIRST live approval.** No live approval
  may be minted without a recorded human decision.

---

## 2. Exact semantics for `live_world_authorized: true`

`live_world_authorized: true` is the single most dangerous boolean in the codebase. Its semantics:

- It may appear on **exactly one artifact kind**: a **live approval receipt** (`creator_live_approval_receipt`,
  §4) and its mirror **live registry entry** (`creator_approved_live_packages`, §5). Nowhere else.
- The **CF-2 local artifacts continue to forbid it** (their validators are unchanged). A package, a local
  receipt, or a local registry entry carrying `live_world_authorized:true` is still rejected — so a
  package *author* can never assert it, and the local boundary never honors it.
- It is honored **only** by the new **live loader path** (§ live loader, below), and only when **all** of:
  the package hash is in the **approved-LIVE registry** with status `operator_approved_live`, the live
  receipt is hash-valid and binds to that exact package hash, a **human-review record (CF-8) is present
  and valid**, the approval is **not revoked** and **not expired**, the package **passes the canonical
  validators at load time** (re-validated, not trusted from approval), and the runtime **kill-switch is
  not engaged**.
- It is **derived, never asserted.** The live approval tool computes it from the human decision + the
  hash binding; there is no input field a human or package can set to force it true. (Mirrors CF-6, where
  `live_world_authorized` is a hard-coded literal, never read from input.)

`LIVE_WORLD_LOADER_ENABLED` flips from `false` to `true` **only** as a deliberate, separately-authorized
code change in the implementation phase — and even then the live path remains gated by everything above,
so flipping the constant alone authorizes nothing.

---

## 3. Trust-state machine (single source of truth for a package's reach)

```
unvalidated ──CF-1 validate──▶ valid(local)
valid(local) ──CF-2 operator approve (local)──▶ operator_approved_local      [live_world_authorized:false]
valid(local) ──CF-6 service verdict──▶ verdict:valid                          [live_world_authorized:false]   (NOT authorization)
operator_approved_local + CF-6 valid + CF-8 human review ──CF-7 live approve──▶ operator_approved_live  [live_world_authorized:TRUE]
operator_approved_live ──revoke / expire / kill-switch──▶ revoked            [live load denied]
```

Reach by state:

| State | Local preview | Live world |
|---|---|---|
| `valid(local)` / `verdict:valid` / `operator_approved_local` | ✅ (CF-2 `local_preview`) | ❌ |
| `operator_approved_live` (and not revoked/expired, kill-switch off, re-validates) | ✅ | ✅ (CF-7 live loader) |
| `revoked` / `expired` / kill-switch on | ✅ (still locally previewable) | ❌ |

**Monotonic safety:** a package can only reach the live world through `operator_approved_live`, and that
state is **revocable at any time** to deny live load without redeploy (§7, §9).

---

## 4. Live approval receipt schema (`creator_live_approval_receipt`)

A NEW receipt kind, distinct from the CF-2 local receipt. Hash-sealed; binds the package, the local
approval, the CF-6 verdict, and the CF-8 human review into one tamper-evident artifact.

```js
{
  schema_version: 1,
  receipt_kind: 'creator_live_approval_receipt',
  live_approval_id: 'la_<opaque>',           // unique, opaque, non-PII
  package_hash: 'sha256:…',                  // the EXACT approved package hash
  package_kind: 'block_style'|'block_layered'|'arcade_game',
  validator_version: 'creator-validator-cf7',
  // bindings — each names the artifact this live approval rests on:
  local_receipt_hash: 'sha256:…',            // the CF-2 operator_approved_local receipt's receipt_hash
  hive_verdict_receipt_hash: 'sha256:…',     // the CF-6 receipt whose verdict was 'valid'
  human_review: {                            // CF-8 — REQUIRED, see §10/§11
    review_id: 'rv_<opaque>',
    reviewer_ref: 'reviewer:<opaque-id>',    // opaque; NOT an email/PII
    decision: 'approve_live',                // approve_live | reject | needs_changes
    free_text_cleared: true,                 // display_name/package_id/operator_note screened (§11)
    content_attestation: '<reviewer note, bounded, screened>',
    reviewed_at: '<ISO>'
  },
  // the dangerous boolean — DERIVED from the above, never an input:
  live_world_authorized: true,               // valid ONLY on this kind, ONLY when §2 holds
  approved_live_at: '<ISO>',
  expires_at: '<ISO|null>',                  // optional TTL → forces periodic re-review
  staging_verified: true,                    // §8 — must be proven on staging before this is honored in prod
  receipt_hash: 'sha256:…'                    // canonical SHA-256 over the body (excludes receipt_hash)
}
```

`validateLiveApprovalReceipt(receipt)` (new, deny-by-default) requires: **`receipt_kind ===
'creator_live_approval_receipt'` checked FIRST** (a CF-6 `hive_validation_receipt` or a CF-2
`creator_approval_receipt` presented in the live slot is rejected immediately as `wrong_receipt_kind`,
never coerced — F7); known version; strict keys; `live_world_authorized === true`; a **well-formed
`human_review` block** with `decision === 'approve_live'` and `free_text_cleared === true`; both binding
hashes present + well-formed; `staging_verified === true`; a `receipt_hash` matching the recomputed body
(tamper detection). **This validator is the ONLY function in the codebase that accepts
`live_world_authorized:true`** — and it requires the human-review block, so a live receipt without a
recorded human approval is invalid by construction.

**Load-time binding resolution (REQUIRED — the bindings are checked, not decorative).** A
self-consistent live receipt can *name* any `local_receipt_hash` / `hive_verdict_receipt_hash`; the
`receipt_hash` only proves the receipt was not edited after minting. So the **live loader must be supplied
the referenced CF-2 local receipt and CF-6 verdict receipt at load time and RESOLVE the bindings** (F1):

1. recompute each referenced artifact's hash and require equality with the bound `local_receipt_hash` /
   `hive_verdict_receipt_hash`;
2. require **all three** artifacts (package, local receipt, live receipt) — and the CF-6 verdict — to name
   the **same** `package_hash`, equal to the loader's recomputed package hash;
3. require the referenced local receipt to validate as `operator_approved_local` **at load time** (not a
   stale/rejected one), and the referenced CF-6 receipt to validate as `verdict: valid` at load time.

Without this resolution step the bindings are a confused-deputy hole (the live approval *claims* to rest
on a local approval + Hive verdict the loader never actually checks). Binding resolution is mandatory; a
live receipt whose bindings do not resolve to real, matching, same-`package_hash` artifacts is **denied**.

---

## 5. Approved-LIVE registry shape (`creator_approved_live_packages`)

A NEW registry, **separate** from the CF-2 local registry, so the local registry validator stays frozen.

```js
{
  schema_version: 1,
  registry_kind: 'creator_approved_live_packages',
  packages: [
    {
      package_hash: 'sha256:…',
      package_kind: '…',
      live_approval_id: 'la_<opaque>',        // ↔ the live receipt
      approval_status: 'operator_approved_live',
      live_world_authorized: true,            // valid ONLY in THIS registry kind
      approved_live_at: '<ISO>',
      expires_at: '<ISO|null>',
      revoked: false,                         // §7 — the kill path for one package
      revoked_at: '<ISO|null>',
      revoke_reason: '<string|null>',
      reviewer_ref: 'reviewer:<opaque-id>',
      registry_signature: 'sha256:…'          // optional integrity stamp over the entry (§ threat: poisoning)
    }
  ],
  registry_hash: 'sha256:…'                    // integrity stamp over the whole registry body (anti-poisoning)
}
```

`validateLiveRegistry` (new) is strict/deny-by-default: unknown keys, duplicate hashes, a bad status, a
missing `live_approval_id`, or a `registry_hash` mismatch are rejections. `resolveLiveApprovedPackage(reg,
hash, now)` returns an entry **only** when `approval_status === 'operator_approved_live'`,
`live_world_authorized === true`, `revoked === false`, and (`expires_at === null || expires_at > now`).

The CF-2 `approved-package-registry.mjs` and its `live_world_authorized:false` rule are **unchanged** —
the live registry is a distinct artifact with its own validator.

---

## 6. Hash-bound approval + tamper rejection

Every link is bound by canonical SHA-256 (the existing `package-hash.mjs` `canonicalize` + `sha256Hex`):

- **Approval is for an exact hash.** The live receipt + live registry entry name `package_hash`. The
  live loader **recomputes** the canonical hash of the package at load time and rejects on mismatch — a
  package edited by even one byte after approval no longer matches and is denied (`receipt_hash_mismatch`).
- **Receipt tamper-evidence.** `receipt_hash` covers the whole body (minus itself); an edited live receipt
  (e.g. flipping `revoked`, extending `expires_at`, forging `human_review`) fails the recompute.
- **Registry tamper-evidence.** `registry_hash` (and optional per-entry `registry_signature`) cover the
  registry body; a poisoned/edited registry fails the recompute (§ threat: registry poisoning).
- **Re-validation at load.** The package is re-run through the canonical validators at load time — the
  loader never trusts "it was valid at approval."
- **Canonicalization must be unambiguous (F2).** The binding hash is SHA-256 over `canonicalize(...)`,
  and `canonicalize` **silently drops keys whose value is `undefined`** — so two structurally-different
  in-memory objects (one with `field: undefined`, one omitting it) can produce the **same hash with no
  SHA-256 break**. Therefore the live path must hash **plain JSON only**: every package/receipt reaching
  the loader is JSON-parsed (or JSON-round-tripped) first — JSON has no `undefined` — and any value that
  cannot survive a JSON round-trip is rejected before hashing. The loader hashes the JSON-parsed object,
  never an arbitrary in-memory object.
- **Collision assumption, stated.** Beyond canonicalization ambiguity (above), security rests on SHA-256
  second-pre-image resistance; the design adds no weaker check that could substitute for the hash, and
  load-time re-validation bounds what a colliding body could even contain.

---

## 7. Revocation model

- **Per-package revocation** sets `revoked: true` (+ `revoked_at`, `revoke_reason`) on the live registry
  entry and re-stamps `registry_hash`. `resolveLiveApprovedPackage` then returns null → live load denied
  on the next request. No redeploy required (the registry is read at request time).
- **TTL expiry** (`expires_at`) forces periodic re-review; an expired approval is denied until re-approved.
- **Revocation is irreversible without a fresh approval** — un-revoking requires minting a new live
  approval (new `live_approval_id`, new human review). There is no "un-revoke" toggle.
- **Monotonic revocation epoch (F4) — rollback resistance.** `registry_hash` only proves the *internal*
  consistency of whatever registry is presented; it does NOT stop an operator/attacker who can swap the
  registry file from **rolling back to an earlier version where the package was still `revoked:false`**
  and re-stamping that older body. So the live registry carries a monotonic `revocation_epoch` (a counter
  bumped on every revocation), and the **loader environment tracks the highest epoch it has seen** (and/or
  consults an append-only revocation audit, F6): a presented registry with a lower epoch than the
  highest-seen is **rejected**. A rolled-back registry therefore cannot resurrect a revoked package. The
  **kill-switch (§9) is the compensating control** if epoch tracking is ever unavailable; registry
  rollback is named as a residual risk in the threat table.
- Revocation is **auditable**: the entry retains `revoked_at`/`revoke_reason`/`reviewer_ref`, and the
  audit trail is append-only / hash-chained (F6) so revocation history is tamper-evident.

---

## 8. Staging-only proof path (before any production live load)

Mirrors the Phase 7E precedent (7E was proven on real `workerd`/staging before any production consideration):

1. The live loader ships **disabled** (`LIVE_WORLD_LOADER_ENABLED=false`); the live track is exercised on
   **staging only**, behind a staging env flag, against a staging live registry.
2. A live receipt is honored in production **only** if `staging_verified === true` — i.e. the exact hash
   was loaded + rendered + validated on staging first.
3. Staging acceptance (a new `run-live-loader-staging.*` smoke, plan §13) must pass before the constant is
   flipped in any production build.
4. **Production live load is a SEPARATE, explicitly-authorized gate** after staging is green — never a
   jump from local/staging to production.

**`staging_verified` is a fast-fail flag, not the proof of record (F9).** It is a boolean the minting
tool sets (covered by `receipt_hash`), bound to the same `package_hash`, and part of the human-review
attestation (the reviewer attests staging was proven for that exact hash). It is only as trustworthy as
the minting tool (see F6), so it serves as an early deny, **not** as the enforcement — the real
enforcement is the separate production gate (§14) plus the reviewer attestation.

---

## 9. Rollback / kill-switch path

- **Global kill-switch.** A runtime-readable flag (env var, e.g. `LIVE_WORLD_LOADER_KILL=true`, read at
  request time — NOT a build constant) makes the live loader **deny everything** regardless of approvals.
  This is the instant, no-redeploy rollback. The loader checks it **first** (like CF-2 checks
  `LIVE_WORLD_LOADER_ENABLED` first).
- **Fail-closed on every flag (F5).** Live load proceeds only when each gate flag is **explicitly and
  exactly its "allow" sentinel**. The kill-switch denies on absent / empty / malformed / **any** value
  that is not the explicit "off" sentinel (note: the string `"false"` is truthy in JS — a classic
  fail-open; the design treats anything but the exact off-sentinel as "kill engaged"). The same
  explicit-allow-only rule governs the staging flag and `LIVE_WORLD_LOADER_ENABLED`. Reading a flag must
  never default to "allow."
- **Build-level disable.** Reverting `LIVE_WORLD_LOADER_ENABLED` to `false` removes the live path entirely
  on the next deploy.
- **Per-package revoke** (§7) is the surgical path; the kill-switch is the blast-radius path.
- **Default-deny on error.** Any loader error (unreadable registry, validator throw, kill-switch unknown)
  resolves to **deny live load**, never "allow."

---

## 10. CF-8 — moderation / human-review workflow (must exist before first live approval)

CF-8 is **not optional** and **not after** CF-7 — the human-review queue must be operational before the
first live approval is minted.

- **Queue (deny-by-default, bounded — F8).** Submitted packages enter a review queue as `pending`.
  Unreviewed = not live. A package is never auto-promoted. The queue is **bounded** (a size cap mirroring
  the registry's `MAX_ENTRIES = 256` precedent) with **per-submitter rate-limiting and dedup-by-hash**, so
  the queue cannot be flooded into a denial of service or used to bury a malicious submission.
- **Reviewer decision** is one of `approve_live` / `reject` / `needs_changes`, recorded with `review_id`,
  `reviewer_ref` (opaque), `reviewed_at`, and the content attestation. Only `approve_live` can produce a
  live approval receipt.
- **Decisions are hash-bound** to the exact package hash; a re-submitted/edited package needs a new review
  (its hash changed).
- **Audit trail + revocation.** Every live approval traces to a recorded human decision; revocation
  (§7) is available to a reviewer and logged.
- **Reviewer authorization** is scoped (a reviewer can review/approve, not deploy or flip the loader
  constant); reviewer compromise is bounded by §12.
- **CF-7 → CF-8 acceptance gate:** *no live approval exists without a recorded `approve_live` human
  decision*, and *the queue is operational before the first live approval.*

---

## 11. Free-text review obligations

The only attacker-controllable free-text reaching players via a package is the bounded human-label set —
`display_name`, `package_id`, and the receipt `operator_note`. The CF-1/CF-3 deny-regex screens only
**markup/script/URL + economy vocabulary**; it does **not** screen profanity, slurs, harassment,
impersonation, or PII. Therefore CF-8 human review **MUST**:

- screen `display_name`, `package_id`, and `operator_note` for **profanity, slurs, harassment,
  impersonation, and PII** before `free_text_cleared` may be set true;
- treat the deny-regex as a **syntactic filter only**, never as content moderation;
- record `free_text_cleared: true` in the human-review block — and the live receipt validator (§4)
  **requires** it. A package whose free-text was not human-cleared cannot be live-approved.

**Bind the screened strings — no mint-time swap (F3).** `display_name` and `package_id` live in the
package body, so the package hash covers them: changing either changes the hash and forces a new review
(safe). But `operator_note` lives on the **receipt**, not the package — `receipt_hash` protects it from
edit-*after*-mint but not from **substitution at mint time** (a reviewer clears a benign note; a different
unscreened note is placed on the minted live receipt). Therefore the **human-review block must bind the
exact `display_name`, `package_id`, and `operator_note` strings that were screened** (by inclusion or by a
hash of them), and the minting tool must reject if the shipping `operator_note` differs from the screened
one. (Acceptance test §13: screened-note ≠ minted-note → live receipt invalid.)

The CF-5 forward note applies: once live, a package-supplied `display_name` can become an interpolated
feed/label value, so its review obligation is mandatory, not advisory.

---

## 12. Threat model

| Threat | Vector | Mitigation (this design) |
|---|---|---|
| **Malicious package** | A package designed to abuse the live renderer (DoS, smuggled markup, oversize, prototype pollution). | Canonical validators run at approval **and** re-run at load; deny-by-default; bounded sizes/tokens; CF-8 human review; arcade packages run only behind the CF-4 frame-contract sandbox (no live cabinet code path in CF-7). |
| **Stale approval replay** | Re-presenting an old live receipt/registry entry after the package changed or approval was withdrawn. | Load-time hash recompute (edited package ≠ approved hash); `revoked`/`expires_at` checked at request time; receipt `receipt_hash` + registry `registry_hash` tamper-evidence; kill-switch overrides all. |
| **Reviewer compromise** | A reviewer account is taken over and approves malicious content. | Reviewer scope is review-only (cannot deploy or flip the loader constant); every approval is hash-bound + audited + **revocable**; staging-verified gate adds a second checkpoint; optional dual-review (N-of-M) for higher-risk kinds; kill-switch blast-radius control. |
| **Hash collision assumption** | Forging a second package with the same canonical hash as an approved one. | Security rests on SHA-256 second-pre-image resistance (treated as the assumption); no weaker equality check substitutes for the hash; canonical JSON removes serialization ambiguity; re-validation limits what a colliding body could even be. |
| **Moderation bypass** | Getting a package live without human review (e.g. forging the `human_review` block, or a near-duplicate slipping the queue). | Live receipt validator **requires** a well-formed `human_review` block with `decision:approve_live` + `free_text_cleared:true`; the block is covered by `receipt_hash` (forgery breaks the hash); deny-by-default queue (unreviewed = not live); near-duplicates have different hashes → need their own review. |
| **Registry poisoning** | Editing/injecting a live registry entry to approve an unapproved hash. | `registry_hash` (+ optional per-entry `registry_signature`) tamper-evidence; `validateLiveRegistry` strict/deny-by-default; the registry is operator-owned + version-controlled/audited, never player-writable; load-time re-validation + receipt cross-check (entry must match a valid live receipt). |
| **Loader bypass** | Calling a render path that skips the live loader checks. | A SINGLE live loader function is the only sanctioned live path; the kill-switch + `LIVE_WORLD_LOADER_ENABLED` are checked first; the live world client has no alternate package-load entry point (enforced + tested); default-deny on any error. |
| **Confused-deputy / TOCTOU bindings** (F1) | A self-consistent live receipt names a `local_receipt_hash`/`hive_verdict_receipt_hash` the loader never checks; or the bound local receipt is stale/rejected by load time. | **Load-time binding resolution** (§4): the loader is given the referenced local + CF-6 receipts, recomputes their hashes, requires equality + identical `package_hash`, and re-validates the local receipt as `operator_approved_local` and the CF-6 receipt as `verdict:valid` AT load time. |
| **Canonicalization ambiguity** (F2) | Two structurally-different bodies hash identically via `canonicalize`'s `undefined`-key elision — a collision with no SHA-256 break. | Hash **plain JSON only** (JSON-parse/round-trip before hashing; reject non-round-trippable values) (§6); named as an assumption distinct from SHA-256 strength. |
| **Registry rollback replay** (F4) | Swap the live registry back to an older version where a revoked package was still `revoked:false`, re-stamping `registry_hash`. | **Monotonic `revocation_epoch`** + loader tracks highest-seen epoch / append-only revocation audit (§7); kill-switch is the compensating control. |
| **Type confusion (wrong receipt kind)** (F7) | Present a CF-6 `hive_validation_receipt` or CF-2 `creator_approval_receipt` in the live-receipt slot. | `validateLiveApprovalReceipt` checks `receipt_kind === 'creator_live_approval_receipt'` **first** → `wrong_receipt_kind`, never coerced (§4). |
| **Reviewer/minting-tool supply chain** (F6) | The tool that *derives* `live_world_authorized:true` is compromised at the source. | The loader trusts the **artifact**, never the tool: a compromised tool still cannot produce a receipt the loader accepts without the bound human-review block + resolvable bindings (§4); the deriving tool is version-controlled + its output independently re-validatable. |
| **Audit-log tampering** (F6) | Edit the approval/revocation history to hide a bad approval. | The audit trail is **append-only / hash-chained** (§7) so approval + revocation history is tamper-evident. |
| **Review-queue denial-of-service** (F8) | Flood the CF-8 queue to exhaust it or bury a malicious submission. | Bounded queue (cap ~`MAX_ENTRIES`) + per-submitter rate-limit + dedup-by-hash (§10); deny-by-default (a full/again queue never auto-promotes). |

---

## 13. Acceptance tests required BEFORE implementation is accepted

(Authored as the implementation lands; listed here so "done" is defined up front.)

- **Boundary unchanged:** the CF-2 local path still rejects `live_world_authorized:true` (local receipt +
  local registry validators unchanged); `local_preview` behavior byte-identical.
- **Live receipt validator:** accepts a well-formed live receipt **only** with `live_world_authorized:true`
  + valid `human_review(approve_live, free_text_cleared:true)` + both binding hashes + `staging_verified`
  + matching `receipt_hash`; rejects a forged `human_review`, a tampered body, a missing binding, a
  non-staging-verified receipt.
- **Live registry validator/resolver:** `resolveLiveApprovedPackage` returns null for revoked / expired /
  wrong-status / poisoned (`registry_hash` mismatch) entries.
- **Live loader:** denies on hash mismatch, package re-validation failure, not-in-live-registry, missing/
  invalid live receipt, revoked, expired, kill-switch on, or any error (default-deny); allows ONLY when
  every gate passes AND `LIVE_WORLD_LOADER_ENABLED` is true.
- **Binding resolution (F1):** a live receipt whose `local_receipt_hash`/`hive_verdict_receipt_hash` do not
  resolve to real, matching, same-`package_hash` artifacts — or whose bound local receipt is not
  `operator_approved_local` / CF-6 receipt is not `verdict:valid` at load time — is **denied**.
- **Type confusion (F7):** a CF-6 or CF-2 receipt presented in the live-receipt slot → `wrong_receipt_kind`.
- **Canonicalization (F2):** a package with an explicit `undefined`-valued key (or any non-JSON value) is
  rejected before hashing; two bodies differing only by `undefined`-vs-absent do not both load.
- **Free-text swap (F3):** a live receipt whose shipping `operator_note` ≠ the human-screened note is
  invalid; `free_text_cleared:false` → live receipt invalid.
- **Revocation rollback (F4):** a live registry presented with a `revocation_epoch` lower than the
  highest-seen is rejected; a revoked package cannot be resurrected by registry rollback.
- **Kill-switch fail-closed (F5):** kill-switch set to the string `"false"` / to garbage / unset → all live
  loads denied; only the exact off-sentinel permits load.
- **Quarantine:** CF-6 verdict alone never produces a live load (a `valid` verdict + no live approval →
  denied); a package claiming `live_world_authorized:true` is ignored.
- **Revocation:** revoke → next live load denied without redeploy; kill-switch → all live loads denied.
- **CF-8:** no live approval exists without a recorded `approve_live`; free-text-uncleared → live receipt
  invalid.
- **Staging-only:** the live path is exercised on staging first; production honors only
  `staging_verified` approvals; production enablement is a separate gate.

---

## 14. Phasing / gates

```
PLAN (this doc)                 — no code, no enablement, no deploy.                      ← you are here
AUTHORIZED: IMPLEMENT CF-8      — human-review queue + free-text review (no live loader). CF-8 first.
AUTHORIZED: IMPLEMENT CF-7      — live receipt + live registry + live loader, SHIPPED DISABLED
                                  (LIVE_WORLD_LOADER_ENABLED=false), exercised on STAGING only.
AUTHORIZED: STAGING LIVE-LOADER PROOF — prove the live path on staging; production stays gated.
AUTHORIZED: PRODUCTION LIVE LOADER    — separate, human-cleared gate AFTER staging green; kill-switch ready.
```

CF-8 precedes CF-7's first live approval. Production is never a jump from staging.

## 15. Non-goals (unchanged hard boundaries)

No economy, ownership, rent, accounts, marketplace, payout, token, NFT, transfer, or cash-out — none of
these are introduced or reopened by CF-7/CF-8. Live *rendering* of an approved, human-reviewed package is
the only new capability, and it remains gated by everything above.

**Hard scope exclusion — no live `arcade_game` code path (F8).** CF-7's live loader renders **`block_style`
and `block_layered` package DATA only** (via the existing procedural renderers — no code execution). A
live-rendered **`arcade_game` is explicitly out of CF-7 scope**: custom cabinet games remain
**sandbox-only (CF-4)** with no live cabinet code path. Executing player-authored cabinet code in the live
world is its own, later, separately-gated problem — not part of this live loader.

---

**This document is plan-only. It adds no code, flips no flag, deploys nothing, and starts no Phase 8.
`LIVE_WORLD_LOADER_ENABLED` remains `false`.** Recorded as ADR-031 in `docs/PROJECT_CHARTER.md`.
