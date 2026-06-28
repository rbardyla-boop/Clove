# Turf Wars — Phase 0 Legal / Safety Counsel Checklist (BLOCKING)

**Status: OPEN — BLOCKING. NOT counsel-reviewed. NO approval is claimed or implied.** This document does
**not** constitute legal advice, a counsel ruling, a safety clearance, or a charter override. It is a
checklist of the questions **qualified legal/safety counsel must answer** before *any* live or
minors-facing Turf Wars use. Nothing in the roadmap proceeds past lab-only until **(a)** counsel issues a
written ruling on the items below and **(b)** a **charter-superseding ADR** records that ruling. Until then,
the live gameplay charter's hard non-goals (raiding / loot / economy / ownership / minors-facing UGC) stand,
and every Turf Wars artifact remains lab-only and prod-denylisted.

> This checklist neither softens nor removes any existing warning. Where it states a current technical
> property (e.g. "non-cash by construction"), that is an engineering fact about the lab code, **not** a legal
> conclusion that the property is sufficient — counsel must decide sufficiency.

## How to use this

Each item is a **question for counsel**, with *why it matters* and the *current lab posture* (what the code
does today, for context only). Counsel marks each **RULING: cleared / cleared-with-conditions / blocked**,
in a written record that the charter-superseding ADR then cites. An unanswered item is **blocked by default**.

## A. Minors safety (the dominant risk)

1. **Age assurance without accounts.** The substrate uses a per-device keypair and **no accounts / no
   login / no PII** (player id = hash of a public key). *Why it matters:* COPPA (US), the UK
   Age-Appropriate Design Code, GDPR-K, and similar regimes turn on whether minors are present and how age
   is assured — a no-accounts design has **no age gate**. *Question:* what age-assurance is legally required
   for a P2P, no-account game that minors can run, and is any compliant approach compatible with "no central
   server"?
2. **Parental consent.** *Question:* for users under the applicable age, what verifiable parental-consent
   mechanism is required, and how is it obtained without accounts or a central authority?
3. **Player-to-player contact & harassment.** Attacking another player's block is adversarial by design.
   *Current lab posture:* loss is **cosmetic, reversible, self-healing scorch only** — no chat, no free
   text, no DMs, no images, no URLs (closed vocabulary). *Question:* is reversible cosmetic "attack" between
   users (some of whom may be minors) acceptable, and what anti-harassment / blocking / reporting controls
   are required?
4. **The pure-P2P minors-safety limit.** A no-central-server design cannot, by itself, guarantee
   minors-safety moderation. The roadmap therefore keeps **one** non-central component — an **M-of-N safety
   quorum + render-gate (Phase 4)**. *Question:* is a quorum/render-gate a legally sufficient safety control
   for a minors-accessible product, and what are its required properties (independence, latency, takedown
   authority)?

## B. Content, moderation & illegal-content exposure (decentralized)

5. **UGC surface.** *Current lab posture:* a block is a **closed enum** — themes, structure kinds, grid
   positions; **no free text / URL / image / uploaded asset / arbitrary code** anywhere in the op or attack
   grammar. *Question:* does the closed-vocabulary UGC surface remove the obligations that attach to
   open-ended UGC, or do they still apply?
6. **Illegal-content propagation in P2P.** Even with a closed vocabulary, a gossip/availability fabric
   (Phase 3) relays signed data between peers. *Question:* what is the operator's exposure for
   illegal-content transit/storage in a peer relay, and what controls (the render-gate, content-addressed
   denylists, quorum) are legally required before any peer relay is enabled?
7. **Takedown / incident response with no central server.** *Question:* how must abusive or illegal blocks
   be removed when no server holds authority — is the Phase-4 render-gate an adequate takedown lever, and
   what response-time / due-process obligations apply?

## C. Economy, virtual goods & gambling

8. **Non-cash counters.** *Current lab posture:* `flux` / `cores` are **bounded, non-transferable,
   never-cashable** counters; there is **no transfer / trade / sell / cash-out / marketplace op in the
   grammar** (value cannot leave a block by construction); an attack's `attacker_reward` is a bounded
   non-cash number **credited to no persistent per-player balance** (block-collective recognition only, per
   ADR-009). *Question:* do these properties keep the system clear of virtual-currency, money-transmission,
   gambling, and loot-box regulation — and what, if anything, would cross a line (e.g. if recognition ever
   became transferable or cash-redeemable)?
9. **No IAP / monetization.** *Question:* confirm that no in-app purchase, paid advantage, or monetization
   may attach to Turf Wars without re-review.

## D. Data protection & privacy

10. **Is a device identity "personal data"?** *Current lab posture:* identity is a hash of a locally
    generated public key — no name, email, or account. *Question:* is a persistent device-derived identifier
    personal data under GDPR/CCPA, and what notice/consent/retention obligations attach?
11. **IP-address exposure in P2P.** A peer-to-peer transport (Phase 3) exposes participants' IP addresses to
    one another. *Why it matters:* IP exposure is a **real safety and privacy risk, acutely so for minors**,
    and IP can be personal data. *Question:* what transport-layer privacy controls (relays, address hiding)
    are legally required before any P2P transport involving minors is enabled?
12. **Data subject rights & retention.** *Question:* in a no-central-server system, how are access /
    deletion / rectification rights honored, and who is the controller/processor?

## E. Charter, liability & jurisdiction

13. **Charter override.** The live gameplay charter treats raiding / loot / economy / ownership as hard
    non-goals. *Question:* on what conditions may a **charter-superseding ADR** record a bounded clearance,
    and what scope limits must that ADR carry?
14. **Operator liability in a decentralized system.** *Question:* what is the operator's liability for
    user-hosted nodes, peer relays, and outcomes the operator does not control, and what disclaimers /
    terms / governance are required given there is **no traditional ToS-acceptance flow** without accounts?
15. **Jurisdiction & cross-border P2P.** *Question:* which jurisdictions' rules apply when players and hosts
    are distributed, and does any jurisdiction need to be geo-excluded?

## F. Phase-gating (what each phase may NOT do until cleared)

- **Phases 1–2 (substrate, foundation, settlement)** — lab-only, prod-denylisted, no transport, no live
  exposure. Buildable in parallel with this review; **may not** be exposed to any user or minor.
- **Phase 3 (availability fabric / P2P transport)** — **blocked** until items B6–B7, D11 are cleared.
- **Phase 4 (safety quorum / render-gate)** — its sufficiency is itself a counsel question (A4, B7).
- **Phase 5 (live pilot)** — **blocked** until **all** items above are ruled and a charter-superseding ADR
  is recorded. No minors-facing exposure before A1–A4 and D-section clearance.

## Sign-off (to be completed by counsel — not by engineering)

| # | Item | RULING | Conditions | Date |
|---|------|--------|-----------|------|
| A1–A4 | Minors safety | _open_ | | |
| B5–B7 | Content / moderation | _open_ | | |
| C8–C9 | Economy / gambling | _open_ | | |
| D10–D12 | Data protection | _open_ | | |
| E13–E15 | Charter / liability / jurisdiction | _open_ | | |

**Until every row above is ruled in a written counsel record and a charter-superseding ADR cites it, Turf
Wars stays lab-only and prod-denylisted, and no live or minors-facing use is authorized.**
