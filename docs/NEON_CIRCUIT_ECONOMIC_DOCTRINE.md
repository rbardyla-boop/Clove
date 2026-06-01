# Neon Circuit — Economic Doctrine

**Status:** Doctrine LOCKED, parameters OPEN (deferred to simulator tuning).
**Date:** 2026-06-01
**Builds on:** [PROJECT_CHARTER.md](PROJECT_CHARTER.md) ADR-002 (HiveWorld bounded
simulator) and ADR-003 (this doctrine). Read those first for the hard guardrails.

This document is the canonical economic doctrine for the **Neon Circuit Arcade**.
It is deliberately split into a **public manifesto** (what players and creators
experience) and a **launch-constraints / enforcement** section (precise, auditable
claims about what the code actually does today). The defensive spine is:

> **Play = abundance. Governance = scarcity. Creators = contractual royalties.
> Agents = advisory only.**

### Scope & layering (do not blur these)

- **Parameters are tuned in the simulator**, not here. The HiveWorld testbed
  (`arcade/hiveworld-sim/`) is where ticket caps, multipliers, and royalty weights
  get modeled. This doctrine locks *shape*, never numbers — see §8.
- **The canonical product authority is the Cloudflare Worker + Durable Object**
  (`workers/arcade/`). The simulator **mirrors** it; it is not deployed and is not
  the source of truth (ADR-002).
- **No real money, crypto, token, NFT, cash-out, staking, yield, or resale** at any
  layer. This doctrine never relaxes the ADR-002 guardrails; it explains and extends
  them at the economic-design altitude.

---

## Part I — Public Architecture Nomenclature (the Manifesto layer)

The public-facing vocabulary intentionally drops crypto/agent jargon while the real
architecture underneath is unchanged. Internal names remain in code and ADR-002.

| Internal Architecture | Public-Facing Term | Player Experience |
| --- | --- | --- |
| Sideband CRDT Fabric | **The Public Event Feed** | "I see live arcade milestones happening in real time." |
| Agentic-Manager Project Pool | **Community Development Pool** | "I can see how surplus revenue funds the next cabinet." |
| Contractual Revenue Split | **Creator Royalty Pool** | "My favorite game creators get paid when I play their cabinets." |
| In-Game Closed Ledger | **Player Ticket Economy** | "I play games, earn tickets, and unlock cool gear." |
| Contribution Weight Log | **Builder Reputation** | "I helped fix a bug or write a guide, and gained status." |

---

## Part II — Launch Constraints & Forbidden Mechanics

> Stated **before** any incentive, on purpose. The economy is credible because the
> hard negatives are defined first.

Neon Circuit is **designed so the launch economy does not support** the following.
Where a constraint is already enforced in code, it is marked and mapped in §9 —
elsewhere "designed not to support" is a design commitment, not an enforcement claim.

1. **No cash-out gameplay loops.** Rewards cannot convert to real money, fiat
   accounting, or external tradable assets.
2. **No loot boxes or paid randomness.** Cosmetic acquisition is transparent and
   direct. No paid chance mechanics.
3. **No pay-to-win.** Premium or account-bound cosmetics never alter cabinet physics,
   scoring, or competitive advantage.
4. **No leverage, debt, or speculative pledges.** No borrowing, margin, or at-risk
   assets inside the world.
5. **No staking or yield commitments.** No passive-income claims, lockups, or
   investment terminology.
6. **No governance from play tickets.** Tickets cannot buy or direct ecosystem
   authority. This is the wall between play and power.
7. **No autonomous treasury movement.** The agent layer cannot move funds out of the
   community pool without a human gate.
8. **No tradable token at launch.** External tokenization is deferred indefinitely,
   pending product-market validation.

> **Enforcement language discipline.** We say **"designed not to support"** for
> product-level intent and reserve **"enforced at the economy event layer"** for
> constraints that are actually rejected in code. The simulator already enforces a
> subset (see §9); unmapped or prohibited event types are structurally refused at the
> fabric boundary (`validateEnvelope` → `forbidden_event_type`).

---

## Part III — Bounded Reward System (Player Protection)

Server-authoritative constraints ring-fence the ticket economy.

- **Infinite free play.** Unlimited rounds per day to master mechanics, climb
  leaderboards, and chase badges (e.g. `clean-grid`, `three-cabinet-tour`).
- **Player Daily Earning Cap.** A per-account, per-day ceiling on *ticket earnings*.
  Past the cap, play still advances leaderboards, achievements, mastery stats, and
  cosmetic XP — only ticket issuance halts. (Cap value is an OPEN parameter — §8.)
- **Deferred arcade budgeting.** A system-wide emission budget is intentionally
  **not** implemented at launch, so late-arriving players are never penalized by
  early-day high earners. Keep only the per-player cap for launch.
- **Bounded Proof-of-Rest.** A modest multiplier on the first few eligible rounds of
  the day. It scales **ticket rewards only** — never Builder Reputation, creator
  revenue, or governance weight. (Range is an OPEN parameter — §8.)
- **Tournament entries (non-cash only).** Tickets may enter special tournaments that
  yield **exclusively** non-cash prizes, badges, or aesthetic honors. Any real-money,
  gift-card, cash-equivalent, or tradable prize is out of scope and requires separate
  legal review.
- **Authoritative sync.** All time evaluation and milestone completion is validated
  server-side by the room authority — no client clock manipulation.

---

## Part IV — Blended Creator Royalty Model

Creator royalties are **accounting**, not yield.

```
[Blended Attribution Inputs] -> (Plays + Unique Players + Completion Quality
                                 + Retention + Favorites + Marketplace Revenue)
                                       |
                                       v
                          [Excluded as a primary driver: Raw Ticket Volume]
                                       |
                                       v
                             [Contractual Royalty Cut]
```

Payout is a composite of **verified plays, unique players, completion quality,
retention, cabinet favorites, and direct cabinet marketplace cosmetic revenue**.
**Raw ticket volume is explicitly excluded** as a primary payout driver, so automated
ticket-farming is economically useless to an exploiter.

- **Quality gates.** Imported games, music, and art must clear manual community
  verification before catalog activation, to block low-effort asset flooding.
- **Legal framing.** Copy frames payouts strictly as *contractual royalty accounting
  for shipped, accepted work*. Avoid "passive yield", "token dividends", "tokenholder
  profit share", or any speculative phrasing.
- **Weights are OPEN parameters** (§8) — present this as a *blended model*, not a
  fixed formula, until weights are simulator-tuned.

---

## Part V — Ecosystem Authority & Reputation Decay

The wall between **participation** (tickets) and **control** (reputation) prevents
whale capture and bot-farm dominance.

### Tier 1 — Player Ticket Economy (abundance)

- **Earned** elastically via performance-based cabinet play.
- **Spends on** character cosmetics, profile items, badges, floor effects, and
  non-cash tournament entries.
- **Constraints:** account-bound, non-transferable, **zero** governance/proposal
  weight.

### Tier 2 — Builder Reputation (scarcity)

- **Earned only** by shipping accepted code patches, verified cabinet art, fixing
  reproducible bugs, writing documentation, or system curation/moderation.
- **Anti-capture decay.** Reputation decays slowly unless refreshed by recent
  accepted contributions. **Major structural votes require recent-active reputation**,
  not stagnant lifetime status — so early contributors cannot ossify governance.
  (Decay rate is an OPEN parameter — §8.)

---

## Part VI — Threat Model: Abuse & Sybil Resistance

> **Core doctrine line:** *No single metric controls money, governance, or creator
> payout. All value-bearing decisions use blended signals, rate limits, review gates,
> and abuse checks.*

The architecture assumes an adversarial environment and names the vectors. (Most
mitigations below are **design intent**; only ticket non-transferability and the
forbidden-event boundary are code-enforced today — §9. Full Sybil resistance is
explicitly NOT implemented yet, per ADR-002.)

- **Account farms.** Bots cycling dormant accounts for the rest multiplier are bounded
  by the Player Daily Earning Cap and the total lack of ticket transferability.
- **Creator self-play.** Self-scripted engagement is diluted by the *unique players*
  and *sustained retention* attribution weights.
- **Collusion rings / fake favorites.** Mutual-boost rings are checked by
  reputation-weighted curation and anomalous-traffic-shape detection.
- **Agent-prompt injection.** Inputs that try to trick the advisory layer into
  recommending malicious code or budget moves are neutralized by **explicit human
  gating at every critical boundary** (Part VII).

---

## Part VII — The Advisory Agentic Pipeline

The agent layer is an **advisory** operating/simulation layer beneath human-directed
sign-off. Idea to production:

```
[Agent Proposal]
      |
      v
[Simulation & Automated Audit]  -> tests code, models economy impact, checks exploits
      |
      v
[Public Proposal Record]        -> logged permanently to the public archive
      |
      v
[Builder Reputation Review]     -> peer evaluation by active contributors
      |
      v
[Proposal Review + Budget Cap + Conflict Check] -> validates treasury allocation limits
      |
      v
[Human Safety / Legal Gate]     -> final manual review / compliance sign-off
      |
      v
[Payout / Production Release]
```

"Human Safety / Legal Gate" is a **safety brake**, not arbitrary centralized control:
it can stop a release; it is not a license to override the community at will.

---

## Part VIII — Doctrine Lock Status

We lock the foundational rules and **defer every number** to the simulator testbed.

### LOCKED — Architecture Doctrine

- Play tickets are non-transferable and account-bound.
- Tickets hold zero governance weight.
- No tradable token at launch.
- Creator compensation is contractual royalty accounting, never yield.
- Agents advise; humans + active community are the final approval gate.
- Absolute ban on cash-outs, loot boxes, staking, leverage, and pay-to-win.
- Builder Reputation derives solely from verified, accepted work.
- No single metric dictates value or governance; all decisions use blended signals.

### OPEN — Parameters (deferred to simulator tuning)

- Number of daily ticket-eligible scores per cabinet (e.g. top 3).
- Proof-of-Rest multiplier range (e.g. 1.25x–2.0x).
- Player Daily Earning Cap value.
- Creator royalty attribution weights.
- Community Development Pool percentage splits and caps.
- Builder Reputation decay rate.

---

## Part IX — Enforcement Status Map (auditable)

This is the honesty layer. Each locked claim is tagged with its **enforcement
status** and, where it exists, the code that enforces it and the test that proves it.
This prevents over-claiming "structurally incapable" for behavior that no code yet
rejects. Tags:

- **ENFORCED (sim)** — rejected/guaranteed in `arcade/hiveworld-sim/` today, with a test.
- **ENFORCED BY ABSENCE** — true now because no subsystem can express it; needs an
  explicit guard the day that subsystem is built.
- **DESIGN INTENT** — doctrine only; no code path enforces it yet (deferred).

| Doctrine claim | Status | Where | Proof |
| --- | --- | --- | --- |
| Tickets/goods non-transferable & account-bound | **ENFORCED (sim)** | `reducers/economy.mjs` `mint_bound_good` sets `bound:true`, no `transferable` flag, no transfer reducer | `tests/hiveworld/economy.test.mjs`: "no transfer path … stays with its owner across a fold" |
| No transfer / cash-out / withdraw / stake / yield / resale / token-trade | **ENFORCED (sim)** | `core/events.mjs` `FORBIDDEN_EVENT_TYPES` + `validateEnvelope` → `forbidden_event_type` (never reaches a reducer) | `economy.test.mjs`: "transfer / cashout / staking / yield / resale … all rejected" (`log.size === 0`) |
| Internal-only credits; no faucet outside test mode | **ENFORCED (sim)** | `economy.grant_credits` → `economy_locked` unless `ctx.economyTestMode` | `economy.test.mjs`: "grants are rejected when economyTestMode is off" |
| Bounded spend (no overdraw) | **ENFORCED (sim)** | `economy.spend_credits` → `insufficient_credits` | `economy.test.mjs`: "spending more than the balance is rejected" |
| Agents advise; no autonomous treasury movement | **ENFORCED (sim)** | `reducers/ambient.mjs` `agent_intent` writes only `state.intents`; sideband class `PROPOSAL`, authority `none` (`core/sidebands.mjs`) — can never touch occupancy/slots/economy | sideband authority model + agent-intent reducer (intent is recorded, never authoritative) |
| Tickets hold zero governance weight | **ENFORCED BY ABSENCE** | No governance subsystem exists; tickets are credits + ledger only | n/a — guard needed when governance ships |
| No loot boxes / paid randomness | **ENFORCED BY ABSENCE** | Good acquisition (`mint_bound_good`, `arcade_redeem`) is deterministic, direct-cost; no randomized-drop reducer | n/a — guard needed if any RNG drop ships |
| No tradable token at launch | **ENFORCED BY ABSENCE** | No token subsystem exists at any layer | n/a |
| No pay-to-win | **DESIGN INTENT** | Sim models no cabinet "physics" altered by goods; this is a product-design property | — |
| Builder Reputation from accepted work only | **DESIGN INTENT** | No reputation subsystem in sim or product | — |
| Reputation anti-capture decay | **DESIGN INTENT** | No reputation subsystem | — |
| Proof-of-Rest scoped to tickets only | **DESIGN INTENT** | No proof-of-rest subsystem | — |
| Blended creator royalty; raw ticket volume excluded | **DESIGN INTENT** | No royalty subsystem | — |
| Player Daily Earning Cap | **DESIGN INTENT** | Not implemented (also an OPEN parameter) | — |
| Full advisory gate chain (sim→record→review→budget→legal→payout) | **DESIGN INTENT** | Only the "proposal-only, never authoritative" leaf is in code; the gate chain is doctrine | — |
| Sybil / abuse resistance | **DESIGN INTENT** | ADR-002 lists Sybil resistance as explicitly NOT implemented | — |

**Promotion rule.** A DESIGN-INTENT row may only be re-tagged **ENFORCED** when the
subsystem exists *and* a rejection/guarantee test exists — and any such promotion
toward production requires a fresh security/compliance review (ADR-002).

**Validation run for this revision:** `node --test tests/hiveworld/*.test.mjs` →
113/113 pass; `tests/hiveworld/economy.test.mjs` → 6/6 pass (2026-06-01). No code
changed in this revision; the doctrine documents existing behavior.
