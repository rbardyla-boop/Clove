# Turf Wars — Phase 0 Live / Minors Unblock Packet (REVIEW RECORD — NOT AN APPROVAL)

**Status: DRAFT REVIEW PACKET — Phase 0 remains OPEN and BLOCKING. No approval, clearance, charter
override, or production readiness is claimed or granted by this document.** This packet does **not** approve
live use, does **not** approve minors-facing use, does **not** supersede the gameplay charter, does **not**
satisfy Phase 0, and is **not legal advice**. It converts the current blocker from *ambiguity* into a
*concrete review record*: what qualified counsel must decide, what the operator must choose, what Phase 4
must prove in lab, and what charter language would be required **if** clearance is later granted. Until
counsel issues a written ruling **and** a charter-superseding ADR cites that ruling, Turf Wars stays
**lab-only / prod-denylisted**, `LIVE_WORLD_LOADER_ENABLED` stays literally `false`, the curated-upload
turf-wars count stays `0`, and **no live or minors-facing use is authorized**.

> **What this sits on top of (and does not replace or soften):**
> - `docs/TURF_WARS_PHASE0_LEGAL_SAFETY_CHECKLIST.md` — the **question layer** (counsel items A1–A4, B5–B7,
>   C8–C9, D10–D12, E13–E15; sign-off all `open`). This packet references those item IDs; it does not
>   re-rule them.
> - `docs/NEON_CIRCUIT_TURF_WARS_PHASE4_PLAN.md` — the **engineering layer** (P4-a quorum, P4-b render-gate,
>   P4-c sybil-resistant revocation, P4-d owner reconciliation, P4-e red-team), each lab-only, each its own
>   future `AUTHORIZED:` build gate.
> - `docs/NEON_CIRCUIT_GAMEPLAY_CHARTER.md` — the live charter whose hard non-goals (raiding / loot / economy
>   / ownership / minors-facing UGC) **stand** until a charter-superseding ADR records a counsel ruling.

> **Not legal advice; legal landscape for counsel's convenience only.** This packet names regulatory regimes
> so counsel can scope the review; it makes **no** representation that any regime is satisfied, and it is
> **not** a compliance assessment. At minimum, counsel should rule under (and is not limited to): **COPPA**
> (US — child-directed services, or actual knowledge of under-13 data collection, regardless of whether money
> changes hands); the **UK Age-Appropriate Design Code / Children's Code** (services *likely to be accessed*
> by under-18s, including games, even if not aimed at children); the **EU Digital Services Act** minor-
> protection duties (privacy/safety/security for services accessible to minors); and **Canada (OPC)** evolving
> children's-privacy expectations. Where this packet states a current technical property of the lab code, that
> is an **engineering fact for context only — not a legal conclusion that the property is sufficient.**

---

## A. Executive decision summary

1. **No real money narrows, but does not clear, the obligation set.** The substrate is non-cash by
   construction (`flux`/`cores` are bounded, non-transferable, never-cashable; no transfer/trade/sell/cash-out/
   marketplace op exists in the grammar; an attack's `attacker_reward` is credited to no persistent
   per-player balance, per ADR-009). Removing real money removes the **financial-transfer / cash-out /
   money-transmission / gambling** risk *surface* — but it does **not** clear the **minors / privacy / UGC /
   moderation / takedown / harassment / safety** obligations, because COPPA, the UK Children's Code, the EU
   DSA, and Canadian children's-privacy expectations turn on **the presence of minors, the collection of data,
   and safety duties — not on whether money changes hands.** Counsel must decide sufficiency; engineering
   cannot.

2. **Turf Wars stays lab-only until the listed questions are explicitly resolved.** This packet does not move
   the project out of lab-only. It makes the decision *reviewable*. The project is no longer "blocked by
   ambiguity"; after this, it is blocked **only by explicit human decisions** — a counsel ruling, an operator
   release-mode choice, and Phase 4 lab evidence.

3. **Phase 4 may be built lab-only now, but lab evidence is not public clearance.** The five Phase 4 sub-gates
   (P4-a…P4-e) may each be built **lab-only / prod-denylisted** in parallel with this review (they enable
   nothing live). But a passing Phase 4 lab proof demonstrates the **mechanism** (the predicate is correct,
   fail-closed, deterministic, byte-identical across peers) — it is **not** a demonstration that the mechanism
   is a **legally sufficient safety control**. Mechanism ≠ policy. Whether the quorum + render-gate is
   *enough* is counsel question A4 / B7 / Q2, not a lab pass/fail.

---

## B. Mode decision tree (exactly three release modes)

There are exactly three possible modes. The project is in **Mode 1 today**. Movement to Mode 2 or Mode 3 is
gated as shown and is **not** authorized by this packet.

### Mode 1 — Lab-only / private developer testing  *(allowed now)*
- **Allowed now**, no new authorization required beyond existing lab-only gates.
- **No public access.** No public discovery, no public URL, no public pilot.
- **No minors-facing positioning** in any copy, listing, or store page.
- **No live loader** — `LIVE_WORLD_LOADER_ENABLED` stays `false`.
- **No creator ingestion into production** — every Turf Wars module stays prod-denylisted; curated-upload
  turf-wars count stays `0`.

### Mode 2 — Adults-only closed pilot  *(requires operator decision + counsel review)*
- Requires an **operator decision** to pursue it and a **counsel review** before any exposure.
- Requires an explicit **age / eligibility stance** (how "adults-only" is asserted and assured).
- Requires **reporting / revocation / render-gate controls** to be built and proven (Phase 4) and operating.
- **Still makes no minors-facing claims.** ⚠️ *The "likely to be accessed by minors" trap:* the UK Children's
  Code and the EU DSA can apply to a service **likely to be accessed by** under-18s **even if it is not aimed
  at children**. "Adults-only intent" is **not** by itself a finding that minors are absent — counsel must
  rule on whether the design is nonetheless likely-to-be-accessed by minors, and what that requires.

### Mode 3 — Minors-accessible (or likely-to-be-accessed) public mode  *(requires the full gate)*
- Requires **counsel sign-off** (a written ruling on the checklist items).
- Requires a **charter-superseding ADR** recording that ruling (see Section F).
- Requires the **Phase 4 safety / render gate** built, red-teamed, and operating.
- Requires a **privacy / minors / moderation / takedown process** (people + process, not only code).
- Requires **explicit operator acceptance** of the residual risks counsel could not eliminate.

---

## C. Counsel question matrix

Questions qualified counsel must answer, grouped by topic, cross-referenced to the existing checklist item
IDs where one already exists. Default **RULING for every question is `open` (blocked-by-default)**; counsel
marks each `cleared / cleared-with-conditions / blocked` in a written record the ADR will cite.

| Group | Question (for counsel) | Maps to | RULING |
|---|---|---|---|
| **Child privacy / data collection** | Is a persistent device-derived keypair identifier "personal data," and what notice/consent/retention/age-assurance applies given no accounts? Is keypair-only identity compatible with required age-assurance at all? | A1, D10, Q7 | open |
| **User-generated content** | Does the closed-vocabulary (enum-only; no free text/URL/image/asset/code) UGC surface remove open-UGC obligations, or do they still apply? | B5 | open |
| **Peer-to-peer / decentralized state** | What is operator exposure for signed data relayed between peers, and what controls are required before any peer relay involving minors is enabled? Does cross-jurisdiction P2P replication change the analysis? | B6, D11, Q5, Q10 | open |
| **Takedown & revocation** | Is gossiped signed-revocation + freshness-expiry an adequate takedown, or does the law require a hard guaranteed delete that P2P cannot provide? What response-time / due-process obligations apply? | B7, Q4 | open |
| **Reports & appeals** | What reporting intake, human-review, and appeal path are legally required, and can they exist without accounts or a central server? | *(new — not yet in checklist)* | open |
| **Moderation responsibility** | Who is the legally responsible controller / moderator for takedown/CSAM when content lives on users' own devices and no server holds authority? | B7, Q3 | open |
| **Age-gating / adults-only stance** | Can an "adults-only" stance be legally relied on for a P2P game with no accounts, and what assurance is required, given "likely to be accessed by minors" tests? | A1, Mode-2 | open |
| **Caching & re-rendering of revoked content** | Once a peer has cached bytes, revocation marks `REVOKED` but cannot purge them. Is "refuse to render" an adequate remedy, or is hard deletion legally required? | B7, Q4, Q5 | open |
| **Harassment / bullying / targeting** | Is reversible cosmetic "attack" between users (some possibly minors) acceptable, and what anti-harassment / blocking / reporting controls are required? | A3, Q8 | open |
| **Cross-border availability** | Which jurisdictions' rules apply with distributed players/hosts, and must any jurisdiction be geo-excluded? | E15, Q10 | open |
| **Retention / logging / evidence** | In a no-central-server system, what retention, logging, and evidence-preservation obligations attach (e.g. mandatory reporting pathways), and who holds them? | D12, C6/reason_code | open |
| **Likely-to-be-accessed-by-minors** | Independent of intent, is the design "likely to be accessed by" minors under AADC/DSA tests, and what does that finding require? | A1–A4 | open |
| **"Cosmetic loss only" sufficiency** | Does any attack/raid/loss framing survive, or must even reversible/cosmetic loss go? Is cosmetic-only enough to reduce harm to an acceptable level? | A3, Q8 | open |
| **Prohibited public wording** | What words/claims must be prohibited in any public-facing copy before clearance (see Section G for the engineering-proposed list to ratify or amend)? | E13 | open |

---

## D. Operator decision matrix

Decisions only the operator can make. Each defaults to the **most restrictive** option until the operator
records a choice; none is pre-decided here.

| # | Decision | Options | Default (until operator records) |
|---|---|---|---|
| D-1 | Target release mode | Lab-only · Adults-only closed pilot · Minors-accessible public | **Lab-only** |
| D-2 | Are minors excluded? | Excluded · Not excluded (minors-accessible) | **Excluded** *(but see "likely-to-be-accessed" — counsel must confirm exclusion is achievable)* |
| D-3 | Public discovery | Disabled · Enabled | **Disabled** |
| D-4 | Remote rendering default | Dark-by-default (render only cleared+fresh+non-revoked) · Permissive | **Dark-by-default** |
| D-5 | Creator blocks scope | Local-only · Ingested into shared/production | **Local-only** |
| D-6 | Peer content before render | Allowlisted before render · Rendered then filtered | **Allowlisted before render** |
| D-7 | Revocation behavior | Instant darkening · Delayed/best-effort | **Instant darkening** |
| D-8 | Appeal path | Exists (defined) · None | **None (so launch blocked until defined)** |
| D-9 | Reports require human review | Yes (human-in-loop) · Automated-only | **Yes (human review)** |
| D-10 | Cache lifetime | Must expire / be purgeable · Unbounded | **Must expire / be purgeable** |

> These defaults are deliberately the safest option, so that *not deciding* keeps the project safe. A move to
> any less-restrictive option is an explicit operator act recorded in the go/no-go table (Section H) and, for
> Mode 2/3, gated on counsel.

---

## E. Phase 4 acceptance criteria (blocker → engineering requirements)

Each criterion states **(i)** what must be **proven in lab**, **(ii)** what would **falsify** the claim, and
**(iii)** what remains a **legal/policy decision** the lab cannot settle. These map directly to the Phase 4
plan; the residual/falsifier IDs (R-*, RT-*) are defined there.

| Criterion | Prove in lab | Falsifier | Remains legal / policy |
|---|---|---|---|
| **M-of-N safety quorum (P4-a)** | `verifyClearanceToken` accepts iff ≥ M distinct valid enrolled signatures over the exact content hash, within freshness, not revoked; deterministic; byte-identical across runs. | M=1/N=1 collapses to single authority; one owner mints M keys (R-a1). | Values of M, N, "who is a vetted reviewer," what "cleared" means (A4, B5–B7, Q2). |
| **Render-gate (P4-b)** | Pure fail-closed `renderDecision` → `DRAW` only on cleared+fresh+non-revoked; else `DARK_*`; reuses CF-2 double-lock shape. | Patched client ignores the gate and draws anything (R-b1 / Q9) — a disclosed deployment-layer falsifier. | Whether a client-side gate + publish-side gossip-restriction is a legally adequate control (Q2, Q9). |
| **Sybil-resistant revocation quorum (P4-c)** | New `CLEARANCE` revocation kind (key-gated, k-of-n), permanently separated from the Phase 3 keyless `FRAUD_PROOF` revocation; dual-Set dedup absorbs floods both directions. | Sybil enrollment forges/blocks a takedown (R-c1); N=k + one key compromise forges a unilateral revocation (R-c4). | The sybil-resistance root needs an identity/age-assurance source the lab cannot model (Q7). |
| **Owner reconciliation (P4-d)** | Deterministic referee-free `reconcileOwnerView`/`foldRevocations`/`canContest`; offline owner converges byte-identically; closed challenge window cannot be reopened by late return. | Partition owner past `CHALLENGE_WINDOW_HEIGHTS`+1 → `canContest` false though a valid counter-proof exists (R-d1). | What "contest" *means* and whether the window is a legally meaningful protection (A4). |
| **Offline-owner protection** | A third party can revoke a forged settlement against an offline owner with no owner key/online presence (keyless fraud-proof path), base byte-identical throughout. | (Phase 3, proven.) Honest-minority/partition residual disclosed (carried). | Whether offline-owner protection meets duty-of-care for minors (A4, B6/B7). |
| **Report / prove / revoke flow** | A peer can report → re-run the public predicate / present quorum → emit a signed revocation that propagates and darkens. | Withholding attempt fails (RT-d1); invalid-revocation flood grows `rejectedRevokes` unbounded without a cap (R-d5). | Whether reports need human review, an appeal path, and mandated reporting categories (reports/appeals, C6/reason_code, Q3). |
| **Dark-by-default rendering** | With no valid token, the gate renders nothing (deny-by-default). | A tokenless snapshot renders (would falsify; not expected in lab). | Whether dark-by-default is sufficient given cached bytes already on devices (Q4/Q5). |
| **No central authority gameplay settlement** | Settlement authority stays replay-determinism + the delegable one-op fraud-proof; the clearance quorum gates *policy* visibility, never *computational* settlement. | A reviewer key able to alter a settlement outcome (would falsify separation). | n/a (engineering invariant) — but who the reviewers are is policy. |
| **No arbitrary UGC rendering** | Only closed-vocabulary, content-addressed, cleared snapshots are renderable; no free text/URL/image/code path. | Any free-text/asset path reaching render (would falsify). | Whether closed-vocab UGC removes open-UGC obligations (B5). |
| **No live-loader enablement** | No Phase 4 module reads, flips, or creates a path to flip `LIVE_WORLD_LOADER_ENABLED`; it stays `false`. | Any module enabling the loader (would falsify). | n/a — live enablement is Phase 5, gated on counsel + ADR. |
| **No minors / public claims** | Lab artifacts and copy make no minors-facing or public claim (Section G). | Any such claim in lab copy (would falsify). | What public copy is permissible post-clearance (Section G, E13). |
| **No economy / value transfer** | No transfer/trade/sell/cash-out/marketplace/IAP op exists; rewards non-cash, credited to no balance. | Any transferable/cashable value path (would falsify). | Whether non-cash recognition stays clear of virtual-currency/gambling rules (C8–C9). |

---

## F. Charter-superseding ADR — draft *requirements* (this packet does NOT author the ADR)

**This section specifies what a future charter-superseding ADR must contain. It is not an ADR, not an
approval, and authorizes nothing.** No ADR is written by this packet. A future `RECORD` gate, *after* a
written counsel ruling and an explicit operator decision, may author the ADR — and that ADR must contain at
least:

1. **Counsel ruling reference** — a citation to the written counsel record (date, author, scope) being relied on.
2. **Operator decision** — the recorded release-mode choice and the Section D matrix selections.
3. **Allowed release mode** — exactly one of Mode 1 / 2 / 3, with its scope.
4. **Prohibited release modes** — the modes explicitly *not* authorized.
5. **Safety controls required before launch** — the specific Phase 4 controls (quorum / render-gate /
   revocation / reconciliation) that must be built, red-teamed, and operating first.
6. **Render-gate invariant** — dark-by-default, fail-closed, hash-bound, freshness-bounded.
7. **Revocation invariant** — signed, sybil-resistant clearance revocation; instant darkening; dedup-safe.
8. **Privacy / minors invariant** — the age-assurance, data-minimization, and IP-exposure controls counsel requires.
9. **Rollback plan** — how to revert to lab-only (flip the loader off, halt gossip, denylist) if a control fails.
10. **Audit evidence** — the lab evidence packs + red-team report that substantiate the mechanism claims.
11. **Explicit supersession scope** — a statement that the ADR supersedes **only the specifically listed
    parts** of the current gameplay charter (the enumerated non-goals it relaxes), and **nothing else**; all
    other charter non-goals remain in force.

> The ADR may **authorize a bounded version** (naming the mandatory controls) **or kill the live direction**.
> Either outcome is counsel + operator's to record — not engineering's, and not this packet's.

---

## G. Public-copy restrictions

**Engineering-proposed lists for counsel/operator to ratify or amend.** Until clearance, the following must
**not** appear in any public-facing copy, listing, store page, or marketing for Turf Wars:

**Prohibited before clearance:**
- "live decentralized world"
- "open to kids"
- "public Turf Wars"
- "attack other players live"
- "own territory"
- "earn rewards"
- "marketplace"
- "cash out"
- "upload anything"
- "uncensored creator blocks"
- "no moderation"
- "irreversible loss"
- "no takedown"

**Acceptable lab-only wording (accurate to current status):**
- "experimental lab"
- "local-only"
- "no live publishing"
- "no public pilot"
- "no real money"
- "no transferable rewards"
- "safety review pending"
- "counsel review pending"

---

## H. Go / no-go checklist (sign-off)

**Every row defaults to `OPEN`. No row is pre-approved. No row may be marked `APPROVED` by engineering — only
by the named owner (counsel or operator) in a written record.**

| # | Item | Owner | Evidence required | Status | Date | Notes |
|---|---|---|---|---|---|---|
| G-1 | Counsel ruling on checklist A1–A4 (minors safety) | Counsel | Written ruling | **OPEN** | | |
| G-2 | Counsel ruling on B5–B7 (content / moderation / takedown) | Counsel | Written ruling | **OPEN** | | |
| G-3 | Counsel ruling on C8–C9 (economy / gambling) | Counsel | Written ruling | **OPEN** | | |
| G-4 | Counsel ruling on D10–D12 (data protection / IP exposure) | Counsel | Written ruling | **OPEN** | | |
| G-5 | Counsel ruling on E13–E15 (charter / liability / jurisdiction) | Counsel | Written ruling | **OPEN** | | |
| G-6 | Counsel ruling: quorum + render-gate sufficiency (Q2 / A4 / B7) | Counsel | Written ruling | **OPEN** | | |
| G-7 | Counsel ruling: takedown adequacy w/o hard delete (Q4 / Q5) | Counsel | Written ruling | **OPEN** | | |
| G-8 | Counsel ruling: age-assurance for no-account P2P (Q7) | Counsel | Written ruling | **OPEN** | | |
| G-9 | Operator release-mode decision (D-1) | Operator | Recorded decision | **OPEN** | | |
| G-10 | Operator Section-D matrix (D-2…D-10) recorded | Operator | Recorded matrix | **OPEN** | | |
| G-11 | Phase 4a–4e built + red-teamed (lab) | Engineering | Evidence packs + red-team report | **OPEN** | | |
| G-12 | Reports / appeals process defined (people + process) | Operator + Counsel | Written process | **OPEN** | | |
| G-13 | Charter-superseding ADR authored + citing G-1…G-8 | Operator + Counsel | Recorded ADR | **OPEN** | | |
| G-14 | Rollback-to-lab-only plan verified | Engineering | Tested runbook | **OPEN** | | |
| G-15 | Public-copy list (Section G) ratified | Operator + Counsel | Ratified list | **OPEN** | | |

**No live or minors-facing use is authorized until every applicable row above is `APPROVED` in a written
record and the charter-superseding ADR (G-13) cites the counsel rulings.**

---

## I. Phase 4 build dependency map

**Can proceed lab-only NOW (each still its own explicit `AUTHORIZED:` build gate; none enables anything
live):**
- **P4-a — safety quorum** — lab-only allowed.
- **P4-b — render-gate** — lab-only allowed.
- **P4-c — sybil-resistant revocation quorum** — lab-only allowed.
- **P4-d — owner reconciliation** — lab-only allowed.
- **P4-e — red-team / integration** — lab-only allowed.

**Cannot proceed without counsel ruling + operator decision + charter-superseding ADR (NOT unlocked by any
Phase 4 lab pass):**
- Public pilot.
- Minors-facing mode.
- Live loader (`LIVE_WORLD_LOADER_ENABLED` stays `false`).
- Production upload (curated-upload turf-wars count stays `0`).
- Public-facing copy.
- Charter override.
- Counsel sign-off (it is counsel's act, never engineering's).

> Building P4-a…P4-e lab-only is the **most** the engineering track can advance before the human decisions.
> A green Phase 4 lab proof is **input** to the counsel/operator decision, never a substitute for it.

---

## J. Final hard boundary statement

- This packet does **not** approve live use.
- This packet does **not** approve minors-facing use.
- This packet does **not** supersede the gameplay charter.
- This packet does **not** satisfy Phase 0.
- This packet **prepares the review record** needed for the counsel/operator decision — and nothing more.

Until a written counsel ruling exists **and** a charter-superseding ADR cites it, Turf Wars remains
**lab-only / prod-denylisted**, `LIVE_WORLD_LOADER_ENABLED` stays `false`, the curated-upload turf-wars count
stays `0`, and **no live or minors-facing use is authorized**.
