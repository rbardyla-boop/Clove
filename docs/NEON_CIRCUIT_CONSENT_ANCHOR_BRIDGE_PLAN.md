# Neon Circuit — Consent Anchor Bridge (PLAN ONLY)

> Read-only bridge doctrine between a user-authorized cognitive/evidence system
> (cognitive-os / "Vibe" / the Sovereign Agent OS doctrine layer) and Neon Circuit.
> **No code. No live authority. No deploy. No flag changes.** This file defines a
> boundary so that later, if a bridge is ever built, it cannot be built wrong.

## 1. Status

- **Plan-only.** This document is doctrine, not an implementation.
- **No code.** No module, schema, validator, route, Worker, or Durable Object is created or changed by this document.
- **No live authority.** Nothing here grants any external system the ability to mutate Neon state.
- **No deploy.** Nothing is shipped, uploaded, or staged.
- **No flag changes.** `LIVE_WORLD_LOADER_ENABLED` stays false; `MARKETPLACE_*`, `CHAT_*`, `PUBLIC_UGC_SUBMIT_*` stay off. This document changes none of them.
- **Supersedes nothing.** It sits alongside the existing receipt/validation doctrine (CF-2/CF-6/CF-7/CF-8, Phase-7E) and the Trust Stack framing; it does not replace any of it.

## 2. Purpose

The **Consent Anchor** is a *planned* read-only bridge. Its single job is to let a
**user-authorized** cognitive/evidence system expose **signed, hash-bound, revocable
evidence** to Neon Circuit's **human** review and audit surfaces — and nothing more.

The defining property is asymmetry: the cognitive system can *offer* evidence; Neon can
*read a public-safe projection* of it; **neither side gains the power to act on the other's
authoritative state.** The Anchor is a one-way, read-only window with a consent gate and a
revocation kill-switch — not an integration, not an API that writes, not an agent with hands.

This document exists because the cheapest time to get a trust boundary right is before any
code is written. It is the boundary spec a future implementation sprint must satisfy.

## 3. Problem

Neon will eventually want **trusted signals** it does not have today:

- **Creator trust** — is this creator's submission history credible?
- **Moderation evidence** — what supports a moderation or review decision?
- **Review history** — has this work been evaluated before, and how?
- **Identity-adjacent consent** — has a user explicitly authorized a specific, scoped use?
- **Platform safety** — can a reviewer see verifiable provenance instead of taking claims on faith?

The naive way to get these signals is to let an external agent or service reach into Neon and
write verdicts, approvals, ranks, or flags. That is exactly the failure this plan forbids. Neon's
authority model (server-owned `CityRoom` / `CityRegistry` state, allowlist-projected public
payloads, deny-by-default receipt validation) only holds if **no external system can author
canonical facts.** The Anchor must deliver trust signals **without ever becoming a write path.**

## 4. Non-goals

The Consent Anchor, as planned, explicitly does **NOT**:

- write `CityRoom` state (positions, presence, world log, events, trial, stewardship);
- write `CityRegistry` state (district presence, room registry, cross-block facts);
- write or influence economy / ownership state (tickets, prizes, Host Rank, balances, rent, payouts);
- approve, gate, or enable **live UGC** (no `creator_live_approval_receipt` minting, no live-loader authorization);
- bridge **account identity** (no login, no account linkage, no identity assertion into Neon) — out of scope here;
- automate **chat moderation** (no auto-mute, auto-ban, auto-delete of public chat);
- hold **marketplace authority** (no listing, pricing, transfer, or transaction power);
- perform **autonomous deploy / upload / push**;
- read or transit **secrets, tokens, keys, or private user data** beyond the scoped, consented evidence projection;
- **replace human review** (CF-8) anywhere it is required.

Each of these is a separate, later, explicitly-gated decision (its own ADR). The Anchor enables
*none* of them by existing.

## 5. Inputs

The read-only artifacts the Anchor would consume. Provenance is labelled honestly:

| Artifact | Status | Source / notes |
|----------|--------|----------------|
| `EpistemicLicense` | **REAL** | `prototype/cognitive-os/core/cip/epistemic_license.rs` (+ `permissions.rs`). The scoped, user-granted authorization object. The consent primitive. |
| `RecordedRun` | **REAL** | cognitive-os `vibe-run` crate. A captured, replayable run of work — the evidence body. |
| `run_hash` | **REAL** | cognitive-os content-hash binding (Sprint-29 "Artifact Content-Hash Binding"). Binds evidence to exact content; any edit changes the hash. |
| `revocation` record | **REAL** | cognitive-os revocation path. Withdraws a previously-granted license; future reliance must check it. |
| `signer` / signature | **REAL** | `prototype/cognitive-os/scripts/design_signing.py`. Signs artifacts so a reader can verify origin + integrity. |
| `EpistemicReceipt` | **PLANNED / INFERRED** | A consolidated "license + run + hash + signature, verified" receipt does not exist under that name yet. Treat as a name for the bridge's verified-evidence envelope to be designed. |
| Neon-side `hive_validation_receipt` (CF-6) | **REAL** | `docs/CREATOR_FOUNDATION_CF7_CF8_LIVE_LOADER_PLAN.md`. Existing Neon verdict artifact the Anchor may *reference for context*, never mint. |
| Neon-side CF-8 human-review record | **REAL** | The human decision record. The Anchor *assists* it; never produces it. |
| The **Consent Anchor** itself | **PLANNED / INFERRED** | Does not exist. This document is its boundary spec, not its implementation. |

> Naming note: the running system in `prototype/cognitive-os/` is "cognitive-os" / "Vibe".
> "Sovereign Agent OS" and "Trust Stack" are doctrine names for the same layer; "consent" is a
> doctrine framing — in code the consent primitive is the `EpistemicLicense`, not a literal
> `consent` type. `prototype/` is untracked and out of scope; this plan only *names* its artifacts.

## 6. Consent model

- **Explicit.** Evidence flows only under an `EpistemicLicense` the user actively granted. No implicit, inherited, or default consent.
- **Scoped.** A license authorizes a specific, narrow use (which evidence, for which Neon surface, for what purpose). Scope is enforced, not advisory.
- **Revocable.** A revocation record invalidates future reliance immediately. The Anchor must re-check revocation at read time, not just at grant time.
- **Not authority.** Consent to *read evidence* is **not** consent to *act*. A granted license never implies any ability to mutate gameplay, account, economy, or moderation state.
- **Asymmetric by construction.** The user can grant and revoke; neither the Anchor nor Neon can self-escalate a read license into a write capability.

## 7. Evidence model

- **Readable:** a public-safe projection of consented evidence — verdict summaries, provenance metadata, `run_hash`, signature-verification status, license scope, and revocation status. The same allowlist-projection discipline Neon already uses for wire payloads applies.
- **Not readable:** raw private run contents, secrets, tokens, keys, unrelated runs, or any field outside the granted scope. The projection is an allowlist, not a redaction.
- **Hash-bound:** evidence is bound by `run_hash` (and a signature). The reader recomputes the hash and verifies the signature; a mismatch means the evidence was altered → rejected. This mirrors Neon's existing "approval is for an exact hash" rule (CF-7 `receipt_hash` / `package_hash` resolution).
- **Replay / audit:** because a `RecordedRun` is replayable and hash-bound, a reviewer (or auditor) can confirm the evidence corresponds to a real, unedited run, and a decision can be hash-bound to the exact evidence it relied on.
- **Stale / revoked rejection:** evidence whose license is revoked, whose hash does not match, whose signature fails, or which is past a freshness bound is **rejected at read time**, deny-by-default — never "trusted because it was valid once".

## 8. Neon boundary

- The Anchor may read **public-safe Neon event summaries or approved audit exports only** — the same projections already exposed (e.g. Phase-7E ephemeral receipts, activity/announce feeds within their existing bounds).
- The Anchor **cannot call privileged `CityRoom` / `CityRegistry` mutation paths.** There is no Anchor-held write capability of any kind.
- The Anchor **cannot mint** receipts, positions, ranks, ownership, balances, reviews, approvals, or any canonical fact. Minting authority stays server-side and deny-by-default.
- The Anchor **cannot bypass allowlist projection.** It sees exactly what the public-safe projection exposes — no private liveness fields, no internal state.
- Direction is fixed: **evidence flows toward a human surface; authority never flows toward the Anchor.**

## 9. Human review boundary

- Anchor evidence **may assist a reviewer** — give a human more verifiable context for a decision.
- The Anchor **cannot replace CF-8 human review** wherever the existing doctrine requires a human-review record.
- The Anchor **cannot auto-approve live UGC** (no path to `creator_live_approval_receipt`; the CF-7/CF-8 chain — local validate → local approve → CF-6 verdict → human review → live approval — is untouched and still human-gated).
- The Anchor **cannot auto-ban or auto-moderate public chat** without a separate, later, explicit ADR. Evidence informs; humans decide.

## 10. Future architecture (illustrative flow, not a build order)

1. The user grants a scoped `EpistemicLicense` (explicit consent).
2. cognitive-os produces a `RecordedRun`, content-bound by `run_hash` and signed.
3. The Anchor reads the **signed, hash-bound** evidence and verifies license scope + revocation + signature + hash.
4. A Neon **reviewer** views a **public-safe evidence summary** (allowlist projection only).
5. The reviewer makes a **human** decision (CF-8), exactly as today.
6. The decision is **hash-bound and auditable** — recorded against the exact evidence `run_hash` it relied on.
7. A later **revocation** invalidates future reliance on that evidence; past decisions remain auditable but cannot be silently re-used as fresh consent.

At no step does the Anchor acquire a write capability over Neon, the economy, accounts, or moderation.

## 11. Threat model

| Threat | Mitigation the future bridge MUST enforce |
|--------|-------------------------------------------|
| **Forged evidence** | Verify signature + recompute `run_hash`; reject on mismatch. No unsigned evidence accepted. |
| **Stale evidence** | Enforce a freshness bound + re-check revocation at read time, not grant time. |
| **Revoked consent** | Re-resolve the `EpistemicLicense` revocation status at every read; revoked → reject. |
| **Signer compromise** | Bound trust to a verifiable signer set; support signer rotation + revocation; never hardcode a single eternal key. |
| **Replay attack** | Bind a decision to a specific `run_hash` + nonce/scope; a replayed receipt cannot be re-presented as new consent. |
| **Prompt injection / agent manipulation** | The reader/evidence path holds **no privileged tools** (quarantine pattern). Evidence content can never reach a write action; only a separate human/actor decides. |
| **Overbroad consent** | Enforce narrow license scope; reject evidence requests outside the granted scope. |
| **Privilege escalation into `CityRoom`/`CityRegistry`** | The Anchor has no mutation capability at all; there is no path to escalate a read into a write. |
| **Private data leakage** | Allowlist projection only; raw run contents / secrets / out-of-scope fields are never exposed. |
| **Reviewer overtrust** | Evidence is presented as *assistive context*, clearly provenance-labelled (verified / stale / revoked); the human decision remains required and recorded. |

## 12. Required tests before any code

A future implementation sprint must demonstrate (deny-by-default) at minimum:

1. A **revoked license** is rejected.
2. Evidence with a **wrong `run_hash`** is rejected.
3. **Unsigned** evidence is rejected.
4. **Stale** evidence (past freshness bound) is rejected.
5. The Anchor **cannot write `CityRoom`** (no such capability exists / is reachable).
6. The Anchor **cannot write `CityRegistry`**.
7. The Anchor **cannot approve a live package** (no `creator_live_approval_receipt` path).
8. The Anchor **cannot touch the economy** (tickets / prizes / ranks / balances).
9. **Human review remains required** wherever CF-8 requires it (no auto-approve / auto-moderate).
10. **Out-of-scope** evidence requests are rejected (scope enforcement).
11. **Allowlist projection** holds — no private/liveness/secret field crosses the boundary.

## 13. Acceptance criteria for future implementation

A future *code* sprint may begin only when **all** of:

- The cognitive-os artifact **schemas are identified** (concrete `EpistemicLicense` / `RecordedRun` / `run_hash` / signature / revocation shapes), not assumed.
- **Consent + revocation semantics are testable** (a fixture can grant, scope, and revoke, and the bridge observably honors each).
- **No live authority is granted** by the design — verified against §4 and §8.
- The **review UI path is separate from the validator** (a reader/evidence surface that holds no write tools; a distinct human/actor decision path).
- The **threat model (§11) is reviewed** and each mitigation has a named owner + test.

Until every item holds, the bridge stays plan-only.

## 14. Relationship to roadmap

This boundary *supports* later work without *enabling* any of it now:

- **CF-6 (Hive validation)** — the Anchor can *reference* a `hive_validation_receipt` for context; it never mints one. CF-6 authority is unchanged.
- **CF-8 (human review)** — the Anchor *assists* the reviewer with verifiable evidence; the human-review record and its requirement are unchanged.
- **Future accounts / identity** — explicit consent + revocation is the primitive a future identity bridge would need; this plan defines the consent shape but bridges no identity (§4).
- **Future moderation** — evidence can inform a human moderator later; no automation is authorized here.
- **Future economy / ownership audit** — hash-bound, replayable evidence is exactly what a future audit wants to read; the Anchor reads, it does not write or value anything.

The Anchor is the *read-only seam* these future tracks can attach to safely — and the reason none
of them can quietly acquire external write authority through the back door.

---

*Plan-only. No code, no live authority, no deploy, no flag changes. See ADR-046 in
`docs/PROJECT_CHARTER.md`. Companion doctrine: `docs/CREATOR_FOUNDATION_CF7_CF8_LIVE_LOADER_PLAN.md`
(receipt/hash-binding + human-review gate), `docs/NEON_CIRCUIT_PHASE7E_INTERACTION_RECEIPTS.md`
(ephemeral public-safe receipts).*
