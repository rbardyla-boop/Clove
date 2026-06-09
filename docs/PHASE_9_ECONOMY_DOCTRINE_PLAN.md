# Phase 9 — Economy Doctrine & Anti-Extraction Preflight Plan

**Classification:** Doctrine + preflight (constitutional prose). The PLAN-ONLY sibling of ADR-034 / ADR-036, authored in the same shape: grounded plan, adversarial completeness critic, "zero exclusion violations."
**ECONOMY IS NOT BUILT — Phase 9 is doctrine-only.** (Scoped precisely: no CASH / transferable / marketplace / ownership / account economy is built or designed by Phase 9. One closed, capped, non-cash ticket→prize→ledger→inventory→achievement→challenge loop *already exists in shipped code*, is **DO-durable and keyed to a client-supplied playerId** (see §1, §4 AE-6, §11 rung 9A.5), and is governed below as a present surface to reconcile — not invented here, and **not** characterized as cleanly "session-bound.")

**Status:** **PLAN ONLY / DOCTRINE-ONLY** — no code, no economy designed, no deploy, no migration, no config flip in this phase. This document frames a future direction and reconciles an existing one; it opens nothing.
**Repo anchor (verified against git this pass):** `main` HEAD = `b030ebf` (`Merge pull request #59 …phase8c-remote-tour-smoke-timing`); no tag points at `main`; production **untouched**; CF-7 **disabled** (`LIVE_WORLD_LOADER_ENABLED = false`, `arcade/creator/approval/approved-loader.mjs:31`).
**Boundary:** **`LIVE_WORLD_LOADER_ENABLED` stays `false`; CF-7 is NOT enabled.** No production deploy. No new DO/migration. HiveWorld untouched.
**Hard non-goals / forbidden surfaces:** no real money, cash-out, payout, marketplace, ownership, rent, paid hosting, transferable/sellable goods, token, NFT, crypto, or user accounts — none introduced, planned for, or left as a hook/stub/placeholder by Phase 9.
**Parents:** `docs/PROJECT_CHARTER.md` (ADR-024 §4 canonical economic boundary; ADR-009 per-player-attribution deferred, line 1015; ADR-034 / ADR-036 PLAN-ONLY siblings), `docs/PHASE_8_DISTRICT_SCALE_PLAN.md` (§8.1 permanently-excluded surfaces), `docs/PHASE_8C_DISTRICT_CONTENT_DEPTH.md` (closest content/doctrine parallel), `docs/NEON_CIRCUIT_GAMEPLAY_CHARTER.md` (Section 19 hard non-goals; §258-279 the already-economy-shaped surface), `docs/NEON_CIRCUIT_PHASE1E_SERVER_TICKETS.md` / `PHASE1F_ARCADE_LOOP.md` / `PHASE1H_CHALLENGE_BOARD.md` (the existing ticket/prize/ledger/achievement/challenge loop).

> **Self-check (vocabulary):** this artifact was scanned against `FORBIDDEN_TERMS_RE` (`arcade/creator/validator/validation-report.mjs:34`). Banned terms (`earn`, `reward`, `prize`, `boost`, `multiplier`, `rent`, `own`/`owner`/`ownership`, etc.) appear in this doctrine's own prose **only** inside explicit prohibition lists, when naming the existing loop's real catalog/code IDENTIFIERS, **and** when quoting the shipped code's own comments. **Honest caveat:** the shipped code is itself closer to an "ownership" surface than a casual reader would assume — `prize-authority.mjs` describes the entitlement model in PROSE COMMENTS using ownership semantics ("item you actually own" `:12`; "Ownership is checked first", "a non-owner can never equip" `:78-79`; "OWNED inventory entitlement" `:78`; `getAchievements` is labelled "Owner-only" in `achievements.mjs:39`). The doctrine's *own* mechanics are described with `derive` / `recognize the block`, never `earn` / `reward` / `own`; but Phase 9 does not pretend the incumbent's source is ownership-neutral — it names that the existing cosmetic entitlement already carries ownership-flavored semantics in its own comments, and flags this for the G-SEC / rung 9A.5 reconciliation.

---

## 0. Why this document exists (and why it builds nothing)

The charter has carried one unbroken economic boundary from ADR-024 through ADR-039: *"economy/ownership remains a non-goal (no money/crypto/marketplace/paid hosting/land ownership/sellable or transferable goods) until a future charter ADR states exactly how, behind legal/safety gates."* That conditional gate — *a future charter ADR + legal/safety gates* — has never been opened. No such ADR exists (latest is ADR-039).

Phase 9 is **not** that future ADR. Phase 9 does two things and only two:

1. **Frames** what a future non-cash recognition loop here could be, what it must never become, and the gate ladder any real economic surface must climb.
2. **Reconciles** the economy-shaped surfaces that *already ship* (the Phase 1E/1F/1H arcade ticket→prize→ledger→inventory→achievement→challenge loop) against this doctrine and the legal gates — because doctrine that silently grandfathers an incumbent it never names, or mischaracterizes its persistence/identity model, is not doctrine (rung 9A.5, Section 11).

It writes **no economy code**, designs **no ledger**, and flips **no flag**. Like ADR-034 / ADR-036 it is PLAN-ONLY with an adversarial completeness critic reporting zero exclusion violations — one altitude lower: it plans the *boundary itself*.

---

## 1. Purpose & classification — the precise truth about what is built

**State plainly and precisely:**

- **No CASH / transferable / marketplace / account economy is built, designed, or planned by Phase 9.** No real money, cash-out, payout, marketplace, ownership, rent, paid hosting, transferable goods, token/NFT/crypto, or user accounts exist or are introduced.
- **A non-cash loop already ships across SIX shipped modules and is NOT invented here** (full inventory at rung 9A.5):
  - `workers/arcade/src/tickets.mjs` — skill-graded deterministic ticket award (`GRADE_BASE` S=25…F=0, server-computed, client count ignored).
  - `workers/arcade/src/round-authority.mjs` — the pure round + ticket state machine that drives `*_round_start` / `*_round_submit`; the server issues round ids and clients never grant themselves tickets.
  - `workers/arcade/src/ledger.mjs` — per-player **private** ledger, dedup'd by `ledger_id` (`makeLedgerId`), so a replayed frame cannot double-award (`balance_after` recorded per entry, `ledger.mjs:39`).
  - `workers/arcade/src/catalog.mjs` — the server-authoritative **prize cost catalog** + cabinets + zones (`cost_tickets`, `EQUIP_SLOTS`); "the catalog the client renders is the catalog the server validates against."
  - `workers/arcade/src/prize-authority.mjs` — `redeemPrize()` spends a **persisted, spendable ticket BALANCE** (`state.balances[playerId]`, `newBalance` `:45`) on the fixed-cost catalog for non-transferable cosmetic entitlements (`state.inventory[playerId][prizeId]`); its own comments use ownership language ("item you actually own" `:12`; "Ownership is checked first" `:78`).
  - `workers/arcade/src/achievements.mjs` — **persistent per-player achievement BADGES** (`state.achievements[playerId]`), reusing the same inventory map as equip-compatible cosmetics; `grantAchievement` writes both `state.achievements` and `state.inventory`. **These are persistent, per-player, status-shaped badge surfaces — exactly what AE-11 (no identity keying) and AE-13 (no per-person status surface) are written to forbid, yet they ALREADY SHIP.** Reconciled, not grandfathered (rung 9A.5).
  - `workers/arcade/src/challenges.mjs` — the **Challenge Board** with per-player progress (`getProgress`, `challenge_progress`), whose `reward` grants an achievement badge and/or a server-computed ticket bonus. Per-player progress is another status-shaped surface to reconcile against AE-11/AE-13.
  - These are live-wired in `arcade-room.ts` (`sendInventory`, `getAchievements`, `getProgress`, `challenge_progress`, `achievement_state` messages; the `prize_redeem` / `inventory_request` / `ticket_ledger_request` / `challenge_*` / `achievement_state_request` cases at `arcade-room.ts:323-334`).

  The gameplay charter (§258-279) names this "the one already-economy-shaped surface in the product." It is closed, capped, non-cash — and it is shipped to a minors-facing learning platform. **Phase 9 governs it (Sections 6, 11 rung 9A.5); it does not pretend it away and does not silently grandfather the achievement/challenge/badge surfaces.**

- **The persistence + identity model is an OPEN reconciliation question, NOT a settled "session-bound" fact.** This corrects the draft. The shipped state — `balances` + `inventory` + `equips` + `ledger` + `achievements`, all keyed by `playerId` — lives inside `this.state` and is written to durable storage via `this.ctx.storage.put("arcadeState", this.state)` (`arcade-room.ts:155`) and reloaded on init (`:165`). It survives DO hibernation/restart and is cleared only by an explicit, both-gated `/admin/reset` op (`admin.mjs`). The `playerId` is **client-supplied** on join (`data.playerId`, `arcade-room.ts:306-307,382`) and the default client sources it from **localStorage** (`neon-circuit-room-client.js:118-121` reads/writes the id; `getPlayerIdSource()` returns `"localStorage"`, `:617`). **A DO-persisted economic record keyed to a localStorage-stable, client-chosen id is, for a returning visitor, effectively a CROSS-SESSION, client-keyed, persistent economic record — not "session-bound."** The shipped code's own comments label entitlements "SESSION-BOUND" (`prize-authority.mjs:5`) and "account/session-bound" (`:4`), but that is a *non-transferability* claim about not moving an entitlement off its room, not a guarantee that the record is discarded between visits. Phase 9 therefore treats the `playerId` lifecycle and the DO-durability of `ticketState` as an **open reconciliation question (rung 9A.5)** and a **G-PRIVACY / G-MINORS / G-KYC input**, and does **not** assert "session-bound" as an established safety property.
- **The ADR-027 "no ledger / no balance/credit field" line is scoped to ONE city-side feature, not the repo.** Quoting it as repo-wide was the draft's error; corrected here. A spendable, persisted ledger and balance demonstrably exist in the arcade.
- **Phase 9 is doctrine-only.** It produces prose, a gate ladder, and a reconciliation rung. It writes, designs, and wires nothing.
- **CF-7 stays disabled:** `LIVE_WORLD_LOADER_ENABLED = false` (single module constant). A fully-approved chain still rejects with `live_world_loader_not_enabled`. Phase 9 does not touch this constant.
- **HiveWorld untouched and absent from product.** The CRDT-log mirror lineage lives only on separate, unmerged lab branches; it is not in product `main`. Nothing in Phase 9 alters or bridges it.

**What this document IS:** a constitution + preflight for a *hypothetical, deferred, non-cash, block-collective recognition* loop, an enumerated permanent-forbidden list, and a reconciliation of the existing ticket/prize/ledger/inventory/achievement/challenge loop and its true durability/identity model.

**What this document is NOT:** an authorization, a design, a schema, a flag flip, or legal advice. It frames gates; it does not clear them.

---

## 2. Economy doctrine — what a future loop would be FOR, and what it must NEVER become

### 2.1 What it would be FOR

A future loop, *if it were ever built behind the full gate ladder*, exists for one purpose: **to make a block feel more cared-for and more legible, and to acknowledge that a BLOCK is well-tended.** It is a *block-recognition and stewardship* loop, not a money loop and not a person-ranking loop.

**Block-collective by doctrine (not per-person).** This is load-bearing and corrects the draft. The existing Host Rank primitive (`arcade/city/city-host-rank.mjs`) is **system-authored** (`actor_public_id: null`), **block-scoped collective**, and ADR-009 (PROJECT_CHARTER.md:1015) states verbatim *"Block/city-scoped, system-authored (no per-player account/profile; per-player attribution deferred)."* Phase 9 **does not reverse that deferral.** Recognition attaches to a *block being well-tended* — a shared, anyone-can-contribute signal — never to an identifiable person. The fantasy is "the city is alive because people are in it," not "the city belongs to the few with standing."

*(Note the tension the existing arcade already embodies: achievements/challenges ARE per-player and persistent. Phase 9 does not extend them; rung 9A.5 reconciles whether the shipped per-player badge/progress surfaces are compatible with the block-collective direction or require remediation/counsel review.)*

The only things such a loop could ever circulate (all non-rivalrous, all block-scoped):
- **Block tendedness signal** — a current, decaying, **block-collective** signal that a block is actively cared for (extending the Phase 4E Host Rank gauge, which is non-cash, bounded, system-authored, and grants nothing itself). Reputation is **DERIVED from collective activity, never EARNED by a person.**
- **Block ambient richness** — presentation richness that benefits **everyone on that block equally** (extending Phase 4F Stewardship). Never a per-person allocation, never a gate on anyone.
- **Cosmetic / stewardship expression** — constrained, reversible, allowlisted visual expression (Phase 4F), available to any eligible participant of the block.

There is no per-host "capacity budget," no per-person reputation total, and no reputation-driven discovery prominence. (See Sections 2.2, AE-8, AE-9, AE-10 for why each was removed.)

> *Honoring the operator's sequencing.* PROJECT_CHARTER.md:13 records "voice before objectives (OBJ-2…OBJ-5), so the city's voice settles before any 'things to do'." Any recognition loop is **downstream of voice settling.** Phase 9 introduces no obligation and does not reorder that sequence; it documents the boundary the deferred loop must respect.

### 2.2 What it must NEVER become

It must never extract value *out* of the system or *off the backs* of other participants. Specifically never:

- A **store of value** or anything convertible to money, goods, or transferable claims. *(The persisted spendable ticket balance, §AE-6, is the single most stored-value-like field that already exists; the rule is that it must never become convertible/transferable/cross-account.)*
- A **rent / landlord** mechanism where a block's tendedness lets anyone tax, gate, or skim from others.
- A **pay-to-win** ladder where money or grind buys authority, advantage, or truth.
- A **dependency trap** where players need a specific host to play, or a host can hold a block hostage.
- A **per-host capacity allocation** — *deleted from this doctrine.* "How much world a host carries," scaling with reputation, IS the landlord/host-dependency lever renamed. Its sole prior framing in the repo (`docs/CREATOR_FOUNDATION_CF6_HIVE_VALIDATION_SERVICE.md:69`) is itself explicitly fenced "*never rent / paid hosting / marketplace — those remain hard non-goals.*" Phase 9 honors that fence by **not promoting it to a unit.** If any "richness varies by block" idea ever returns, it returns at the block level (AE-9), behind its own gate, with its own casual-equity proof.
- A **reputation-ranked discovery / attention** surface — *deleted.* Today discovery is **adjacency-based and static** (`city-district.mjs` summaries = `{city_id, display_name, theme, capacity, adjacent}`; it reads **no** host_rank). Reputation-ranked prominence is a winner-take-most amplifier (more standing → more eyeballs → a thing worth accumulating). Forbidden (AE-10).
- A **grind treadmill** coercing time-spend through escalating, never-satisfied progression. *(The shipped Challenge Board is bounded session-scoped progress today; it must never become an escalating cross-session treadmill — rung 9A.5.)*
- A **persistent global profile / account** aggregating a person across blocks into a tradable identity.
- A **per-person status surface** — no "you rank below them" display, ever (AE-13). *(The shipped per-player achievement badges are the existing closest surface; reconciled at 9A.5.)*

**Doctrinal smell test:** *if removing money/transfer/ownership/per-person-attribution from an idea makes it pointless, it was an extraction or status mechanic and is rejected* (mirrors Phase 8 §8.1: "If a design choice requires one of these, that is a signal the design is wrong").

---

## 3. Anti-extraction rules (each testable; each states the state it constrains)

Each rule names: the **product-side** guarantee (a *structural absence* enforceable by a code-presence check today) and the **simulator-side** guarantee (a runtime assertion the 9B lab must prove against a *populated* model). **An empty-economy pass is NOT a satisfied rule** — a test that passes only because the unit does not yet exist gives false assurance and is marked accordingly.

**AE-1 — No landlord / rent capture.**
*Product (structural):* No `charge` / `gate-on-standing` / `transfer-to-host` operation may exist in code (code-presence check).
*Simulator (populated):* In the 9B sim with units present, across every adversarial scenario, net transfer of any unit *from* any participant *to* any host is exactly zero. **(Trivially true today only because no transferable unit exists; this is NOT evidence the rule survives a populated economy — the sim assertion is the real test.)**

**AE-2 — No pay-to-win.**
*Product (structural):* No reputation/tendedness signal feeds movement, collision, portal, score, trial outcome, or routing authority (code-presence check; today none does).
*Simulator (populated):* A block with maximal tendedness confers byte-identical movement/collision/score authority to a brand-new participant on a plain block (extends the proven Phase 4G byte-identical non-destruction test).

**AE-3 — Reachability: no player dependency on any single host.**
*Simulator:* Remove/disconnect every host of a block; the block remains enterable, traversable, and public city + stewardship default are unaffected (extends the proven "DO restart discards in-progress trial, leaving public city + stewardship unaffected"). Assert `block.playable === true` with zero active hosts. *(Reachability only — soft-dependency is AE-9.)*

**AE-4 — No grind coercion.**
*Product (structural):* The signal is bounded (`SCORE_CAP=100`) and decays over a fixed window (`WINDOW_MS=60_000`, Phase 4E); no NEW reputation/tendedness state field is strictly cumulative across sessions (code-presence check). *(Scoped honestly: the existing arcade ALREADY persists cumulative-shaped state — ledger history, balance, inventory, achievements — across sessions via the localStorage-keyed playerId, §1/§AE-6. AE-4's "no cumulative field" applies to any FUTURE recognition signal, not retroactively to the incumbent, whose cross-session accumulation is a finding for rung 9A.5, not a property AE-4 already guarantees.)*
*Simulator:* The future signal is non-monotonic over inactivity (it falls). Decay must never surface as **punishment for absence** in any player-facing string (AE-12).

**AE-5 — No dark patterns (enumerated discrete checks, not a checklist).** Each is a sim-assertable predicate:
- (a) No countdown that **gates value** (countdowns may be display-only, server-derived, like Phase 4E/4F/4G outputs).
- (b) No **streak / loss-on-absence** mechanic.
- (c) No **variable-ratio / randomized** award schedule.
- (d) No **confirm-shaming** copy.
- (e) No **manufactured scarcity** ("limited slots", "expiring", "reserved for high-rank").
- (f) `FORBIDDEN_TERMS_RE` (`validation-report.mjs:34`) continues to block `wager|bet|jackpot|loot|multiplier|boost|reward|prize|earn|own|owner|ownership|…`; Phase 9 adds **no exceptions.** *(Note: this regex screens package-label text only; it provides ZERO structural gambling protection — see G-GAMBLING.)*

**AE-6 — Non-transferable; non-persistent for SIGNALS; persisted-and-cross-session-capable for the existing balance/inventory/badge state (named, ruled, and queued for counsel).** *(Scoped precisely after legal review; expanded to cover the persisted spendable balance.)*
- **Reputation / tendedness signals (future):** current, decaying, non-persistent, non-account-bound, never transferable. No `transfer`/`grant_to`/`assign` operation may exist on any signal (code-presence check).
- **Existing persisted ticket BALANCE** (`prize-authority.mjs:42-45,57,62`; `ledger.mjs:39`): a running, spendable, **DO-persisted** value (`state.balances[playerId]`, `balance_after` / `newBalance`) — the **single most stored-value-shaped field in the shipped product** and the natural seed of any future convertible unit. **Anti-extraction rule (NEW, the largest remaining drift seam):** the balance must **never** become convertible to money/goods/credit, never transferable between playerIds, never aggregated into a cross-block or global account, and never exposed as a number a third party can purchase, gift, or settle. It is closer to **G-MONEY / G-SEC** than to a transient signal or a cosmetic, and rung 9A.5 raises an **explicit G-MONEY/G-SEC reconciliation line** for it (the persisted balance is reviewed for stored-value/e-money characterization NOW, not only "if a convertible unit is proposed").
- **Existing cosmetic + badge entitlements** (`prize-authority.mjs`, `achievements.mjs`): **persisted, non-transferable**, and — because they key off a localStorage-stable playerId — **cross-session-capable in practice**, cleared only by `/admin/reset`. "No path to move an entitlement off its owning session" is a *non-transferability* guarantee, **not** a non-persistence one. The blanket "non-persistent" claim is **false** for these and is corrected. AE-6's non-persistence applies to *future signals*, not to the existing persisted balance/inventory/achievement state. *(A persisted collectible/badge sits closer to a "good"/"status object" than a transient signal — relevant to G-SEC / G-GAMBLING / G-MINORS.)*

**AE-7 — Reversibility & no permanent claim.**
*Simulator:* Reset returns canonical block style to its Phase-5B per-block default with no residue; the existing pure byte-identical test (stewardship style identical after create+step+close) is the template every economy scenario must satisfy.

**AE-8 — Per-actor-bounded reputation (corrects the Sybil claim).**
*Grounded problem:* the existing Host Rank scorer (`city-host-rank.mjs:68`) sums raw event weights with **no per-actor dedup** (`for (const e of inWindow) score += SUPPORT_WEIGHTS[e.type] || 0`); `SCORE_CAP=100` is reachable by ~10 portal-accepts in 60s — trivially saturable by one coordinated actor. "No accounts" is **not** a Sybil defense; it is the *enabling condition* for cheap inflation (nothing to rate-limit per actor).
*Rule:* Any reputation a future loop consumes must (a) dedup or cap contribution **per distinct connection/actor** within the window, and (b) the **current 4E gauge cannot be reused unchanged** as an input to any allocation. The doctrine must address per-actor bounding, never lean on the absence of accounts.

**AE-9 — No soft-dependency / influence concentration.**
*Simulator:* Removing the top-k tended blocks/hosts does not materially change where **new/casual** players end up; no routing is dominated by high-tendedness blocks; experience quality on a host-less block stays above a defined floor. The sim must **FAIL** when soft dependency forms, not only when literal reachability breaks. Tied to the Section 9 host-concentration metric.

**AE-10 — Discovery is reputation-neutral.**
*Rule + structural check:* Discovery/presence ordering is **independent of any reputation/tendedness signal.** The public delta allowlist stays exactly `{population, health, population_is_estimated}` (`city-district-presence.mjs:35`); discovery ranking must not be a monotonic function of reputation. Any visibility differentiation is **block-intrinsic** (theme/adjacency), never standing-derived. *(Separates "presence DATA is public-safe" — already allowlist-enforced — from "discovery RANKING is reputation-neutral" — the new rule.)*

**AE-11 — No identity keying (block-collective invariant).**
*Rule + structural check:* No reputation/richness/visibility value is keyed to a participant identity, ever. Reputation is never attributed to an identifiable person and never aggregated across blocks into a profile. Per-player attribution remains deferred per ADR-009; Phase 9 does not reverse it. *(Reconciliation note: the shipped `state.achievements[playerId]` and `state.balances[playerId]`/`inventory[playerId]`/`ledger[playerId]` ARE per-(client-)identity-keyed and persisted. AE-11 governs FUTURE recognition units; the existing per-player keying is a named finding for rung 9A.5 and a G-PRIVACY/G-MINORS input, not a property AE-11 retroactively guarantees.)*

**AE-12 — Decay is never framed as loss (player-experience).**
*Rule:* No player-facing surface presents decay/inactivity as a penalty, streak-break, or loss. Decay is the natural falloff of a *current* signal, displayed neutrally if at all.

**AE-13 — Casual experience is first-class and reputation-invariant (player-experience).**
*Simulator:* A zero-reputation participant's enjoyment surface (traversal, social presence, cooperative affordances) is byte-equivalent to a max-reputation block's for the same participant. `time-to-fun` is **reputation-invariant** — a new participant reaches play within the same bound regardless of any block's standing. **Casual retention must be ≥ host/contributor retention, or the loop is rejected.** Cooperative affordances (today: 4G trial JOIN open to any city member) stay open to all; no "reserved for high-rank" presentation (ties AE-5e). *(Reconciliation note: the shipped per-player badges/challenges are a present per-person status surface; rung 9A.5 assesses whether they create casual-vs-contributor status pressure that AE-13 would reject in a future design.)*

---

## 4. The (deferred) non-cash loop — built only on existing, non-rivalrous primitives

If — and only if — the full gate ladder (Section 11) is ever cleared, the **first and possibly only** future loop is a **block-recognition** loop assembled from primitives that already exist and already grant nothing of value. It **reuses**, it does not invent.

**The existing wired chain (today, grants nothing):**
> Host Rank (4E, **block-collective, system-authored** tendedness) → gates → Stewardship (4F, constrained reversible visual edit) → whose style is copied into → Block Trial (4G, instanced non-destructive). Shared gate: `isStewardshipEligible(host_rank)` (`city-room.ts:610, 690`).

**The two — and only two — non-rivalrous, block-scoped units the loop could circulate:**

| Unit | Built on | Hard limit |
|------|----------|-----------|
| **Block tendedness signal** | Phase 4E Host Rank (block-collective, `actor_public_id: null`) | Bounded gauge (`SCORE_CAP=100`), decays over `WINDOW_MS`, block-scoped **collective** (never per-player, no account/profile), system-authored, derived server-side. Must satisfy **AE-8** (per-actor bounding) before any consumption. Grants nothing itself. **Derived, never earned.** |
| **Block ambient richness + cosmetic/stewardship** | Phase 4F Stewardship (+ existing per-block defaults, Phase 5B) | Closed enum allowlists only (`arcade_front/street_lights/sidewalk_trim`; palettes `cyan/magenta/amber/white`; `sign_variant`; `intensity`). Sanitizer reads only enum keys — no css/html/js/url/text survives. Reversible. **Benefits everyone on the block equally; never a per-person allocation, never a gate on anyone, never rivalrous.** |

**Explicitly NOT the substrate (the shipped per-player surfaces):** the future block-collective loop must **not** be built by extending `achievements.mjs` / `challenges.mjs` / the persisted `balances`/`inventory`/`ledger`. Those are **per-player, persisted, cross-session-capable** surfaces (§1, §AE-6, §AE-11) — the opposite of the block-collective, non-persistent signal the future loop circulates. Reusing them as the recognition substrate would import exactly the identity-keying and cross-session persistence AE-11/AE-6 govern. The future loop builds on the block-collective Host Rank gauge + block-scoped stewardship richness, not on the arcade ledger/badge state.

**DELETED from the draft (each was a drift seam):**
- **"Capacity budget"** (per-host "amount of world a strong host may carry," scaling with reputation) — removed (Section 2.2; AE-1/AE-3 contradiction; ungrounded except as a fenced one-liner at CF-6:69).
- **"Discovery prominence / visibility standing"** as a reputation-linked unit — removed (AE-10; ungrounded; internally inconsistent with the frozen 3-field allowlist).
- **Per-person "hosting reputation" recognizing "the people"** — collapsed to block-collective (AE-11; ADR-009 deferral).

**Absolute constraint:** **block-collective tendedness + non-rivalrous block richness ONLY — never money, ownership, rent, payout, per-host capacity, reputation-ranked attention, per-person standing, a convertible balance, or a transferable badge.** Neither unit is convertible, transferable, persistent-as-asset, account-bound, rivalrous, or identity-keyed. Each preserves the existing per-primitive invariants: non-cash, server-authoritative derivation, display-only output, closed-allowlist, host-rank-gated, reversible, instanced/non-destructive, ephemeral-where-applicable, grants-nothing-of-value. No new authority. No ledger. A *recognition* loop layered on what already exists.

---

## 5. Hive hosting model — the city is carried by everyone; no one owns its truth

The doctrinal slogan Phase 9 authors (it does not yet exist; grep confirms zero hits), rebalanced toward the collective:

> **The city is carried by everyone in it. No one owns its truth, and no one needs status to belong. A block may be tended richer — but tendedness is shared, never owned, and never a claim on another player.**

The retained authority invariant (correct and grounded): **richness/tendedness may scale at the BLOCK level; AUTHORITY never scales with anything.** This is *already structurally enforced by live code* — Phase 9 only names it.

- **Truth is DO-canonical.** `CityRoom` is the sole authority for its one block: ephemeral player position/membership + an append-only server-authored event log. Clients send **input intent only** (unit direction + seq + client ts); no message carries an absolute position. The server resolves accepted positions from its own canonical position + server-clock dt + max-speed clamp + deterministic AABB collision. Forged dt cannot speed-hack; forged position/accepted fields are ignored.
- **Cross-block truth is DO-canonical.** `CityRegistry` is the single cross-block coordinator, reached only DO-to-DO (never a client), holds no private player data, fail-open. Routing is bounded/unforgeable: `validateRouteRequest` confirms a move only to a *known adjacent* block, mutates no state; the move is realized only when the client reconnects to the target DO, which admits via normal `city_join` — "a client can never forge cross-block membership."
- **Hosts already "carry world" without owning truth.** Host Rank grants nothing; Stewardship is a constrained, reversible, allowlisted *visual* edit touching no player/collision/portal/ticket/inventory/economy state; a Block Trial is instanced, non-destructive, ephemeral, discarded on close.

**Read-replica-only sole-writer invariant (closes fork/withhold/poison).** A host may only **carry a READ-REPLICA / cache** of canonical state. The **DO is the sole writer and sole source of truth.** No host-carried state is ever trusted back as input to canonical state (mirrors input-intent-only + DO-sole-writer). A host withholding or corrupting its carried copy can degrade only its **own** view — never the canonical log or another player's truth. **CRDT convergence is not a substitute for sole-writer authority:** the HiveWorld property "reorder/dup → same fingerprint" proves replicas *agree given the same log*; it says nothing about fork/withhold/poison of the log. The 9B simulator must test fork/withhold/poison scenarios (a host serves stale/divergent/poisoned carried state → assert canonical DO log and other players' truth unaffected).

**"Uptime" overclaim corrected.** `CityRegistry` measures **population** (a public count, self-stamped receive-clock, stale >90s → evicts to 0), **not host service.** "A host cannot self-assert uptime; the DO measures it" overclaims — the registry measures population, not whether a host renders anything. Any future service/uptime signal must be DO-measured per the **actual service rendered**, never inferred from population (which a Sybil ring inflates, AE-8).

---

## 6. Legal / safety gates (framed as OPEN QUESTIONS for counsel — NOT legal advice)

Per ADR-024 §4, *any* economy requires "a future charter ADR [that] states exactly how, behind legal/safety gates." **These gates govern BOTH (a) the EXISTING live ticket/prize/ledger/inventory/achievement/challenge loop — including its DO-persisted, client-id-keyed balance/inventory/badge state — and (b) any future loop.** They are open questions for qualified counsel, recorded in a future ADR before the corresponding surface may be designed or — for the existing loop — relied upon. Nothing here is pre-answered; conclusory phrasings ("moot", "one reason accounts stay forbidden") are removed.

| Gate | Open question counsel must answer (applies to existing loop AND future) |
|------|------------------------------------------------------------------------|
| **G-MONEY — Money transmission / stored value** | Does a **non-cash point/prize loop with a persisted, spendable BALANCE** (`state.balances[playerId]`, DO-durable, client-id-keyed) fall outside stored-value / e-money / money-transmission regulation in each target jurisdiction? **Do not assume non-cash = exempt** — some regimes regulate stored value regardless of cash-in, and a persisted spendable balance is the most stored-value-like field in the product (§AE-6). Applies now to the existing ledger/balance loop. Becomes acutely blocking the instant any convertible unit is proposed. |
| **G-TAX — Tax / reporting** | Could any participant-facing value (existing prize entitlements and persisted badges included) trigger income recognition or information-reporting obligations? |
| **G-GAMBLING — Gambling / loot-box (STRUCTURAL, not lexical)** | `FORBIDDEN_TERMS_RE` governs **package-label text only** and provides **ZERO structural gambling protection.** Counsel must analyze the actual mechanics of the **existing** loop: award is **chance or skill?** (today: skill-graded deterministic, `tickets.mjs`/`round-authority.mjs` from grade/score/accuracy — favorable); consideration? (today: no paid entry / no real money — favorable; is time-as-consideration relevant?); prize of value? (persisted, non-transferable cosmetic/badge — favorable, but persisted-across-sessions, not transient). Counsel must opine whether even this loop is loot-box/gambling-adjacent under EU/UK/US-state rules **before any randomized/chance-based award is ever introduced.** |
| **G-SEC — Securities** | Could any unit be deemed an investment contract / security? Note a **persisted, spendable balance** and a **persisted collectible/badge** (existing inventory + achievements) are closer to a "good"/"stored value" than a transient signal; any accruable per-block standing — or the existing per-player balance — must be argued *not* to be a stake. The shipped code's own ownership-flavored comments (`prize-authority.mjs:12,78`) are an input here, not a defense. |
| **G-KYC / AML — Identity** | What identity / AML obligations attach? **No formal user accounts exist** — but identity is **client-supplied and localStorage-persistent** (`playerId` from `data.playerId`, sourced from localStorage, `neon-circuit-room-client.js:118-121`), and `prize-authority.mjs:4` describes entitlements as "account/session-bound." Counsel must confirm the exact identity model — a stable, client-chosen, cross-session id that keys persistent economic state may itself constitute an identity for KYC/COPPA purposes even without a login. |
| **G-CONSUMER — Consumer protection / fairness** | Dark-pattern, fairness, refund, advertising rules (ties AE-5). For any future block-richness differentiation: does it create de-facto exclusivity/unfairness even without literal transfer? Do the existing persistent badges/challenges constitute child-directed reward mechanics under fairness rules? |
| **G-UGC — UGC liability / DMCA** | Hosting-liability and **notice-and-takedown (DMCA agent registration + takedown workflow)** for any user-contributed content. **CF-8 (`arcade/creator/moderation/review-queue.mjs`) is NOT a DMCA control** — it screens 3 short free-text fields (`FREE_TEXT_FIELDS` `:30` = `display_name`/`package_id`/`operator_note`) for the 5 criteria in `REQUIRED_REVIEW_CRITERIA` `:32` (`profanity`/`slurs`/`harassment`/`impersonation`/`pii`) only. A real DMCA gate is currently **absent** and must be built before any user-contributed content surface or CF-7 enablement. |
| **G-CSAM — Child-safety imagery (separate, blocking)** | **CF-8 provides NO CSAM detection, NO image/asset scanning, NO mandatory-reporting path** — verified `arcade/creator/moderation/review-queue.mjs`: `FREE_TEXT_FIELDS` (line 30) = 3 text fields, and `REQUIRED_REVIEW_CRITERIA` (line 32) = `['profanity','slurs','harassment','impersonation','pii']`. CSAM handling is **non-discretionary** (mandatory reporting in many jurisdictions). Before any user-contributed **image/asset** surface or CF-7 enablement: a documented mandatory-reporting/escalation procedure + counsel sign-off. **Do not characterize any existing control as covering CSAM.** |
| **G-PRIVACY — Privacy / GDPR / CCPA** | Mixed posture: district *presence* is a frozen public aggregate (count + timestamp), but the **existing ticket ledger/inventory/achievement state is per-player, persisted, and keyed to a localStorage-stable client id** — i.e. personal-data-shaped and cross-session, not aggregate. Counsel must assess the per-player, DO-durable ledger/inventory/badge state for personal-data handling, retention, and erasure obligations **now**; any future per-person economic record re-opens this. |
| **G-MINORS — COPPA / GDPR Art. 8 / UK AADC (PRESENT, not future)** | CloveLearn is a learning platform → presumptively minors-accessible → COPPA (US <13), GDPR Art. 8 (EU parental consent), UK Age-Appropriate Design Code, FTC dark-pattern scrutiny of child-facing reward mechanics. The **existing** collect-and-redeem ticket/prize loop AND the **persistent per-child achievement badges / challenge progress** are exactly the mechanics regulators scrutinize and must be reviewed **NOW**, independent of any future loop — especially given the state persists across sessions keyed to a stable client id. This gate alone can veto any monetary surface. |

**Rule:** no surface that touches a gate may be designed, prototyped, flagged, or — for the existing loop — assumed compliant, until that gate is answered by counsel and recorded in a future charter ADR. Gates are **blocking questions, not advisory**, and never self-answered.

---

## 7. Abuse threat model — vector → grounded doctrine mitigation

| Threat | Vector | Doctrine mitigation (testable, grounded) |
|--------|--------|------------------------------------------|
| **Sybil hosting** | One actor spins up many fake connections to inflate a block's tendedness. | **Corrected:** the existing scorer (`city-host-rank.mjs:68`) sums raw event weights with **no per-actor dedup** and is **NOT Sybil-resistant as built** (`SCORE_CAP=100` reachable by ~10 portal-accepts/60s). "No accounts" is the *enabling condition*, not a defense. Mitigation = **AE-8** (per-actor bounding) + cap/decay (AE-4) + the 4E gauge may not be reused unchanged as an allocation input. Sim must show N sybils cannot raise a block faster than honest activity. |
| **Endpoint flood / DoS / spam (NEW)** | An actor floods the live economy endpoints (`*_round_start`/`*_round_submit`, `prize_redeem`, `ticket_ledger_request`, `inventory_request`, `challenge_*`, `achievement_state_request`, `arcade-room.ts:316-335`) or spams host-rank support-event emission to exhaust DO CPU/storage or pump the un-deduplicated scorer. | **Required property (NEW):** the user's global security rule mandates **rate-limiting on all endpoints**. AE-8 bounds per-actor *contribution to the score* but says nothing about raw message volume; this row adds the resource-exhaustion vector explicitly. Doctrine rule: any live economy endpoint and any host-rank support-event emission path MUST enforce a per-connection/per-actor request-rate bound (token-bucket or equivalent), and the 9B sim MUST demonstrate that a flooding actor cannot (a) exhaust DO resources, (b) outpace honest tendedness accrual, or (c) defeat ledger/redemption dedup by volume. **This is a present finding for rung 9A.5 as well** (the shipped endpoints' current rate posture must be audited). |
| **Fake uptime / fake service** | A host claims service it isn't providing. | **Corrected:** `CityRegistry` measures **population**, not service. Any uptime/service signal must be DO-measured per actual service rendered (Section 5), never inferred from population. Sim asserts evicted/stale blocks confer no richness. |
| **Grief hosting** | Degrade a block to harm others, then squat. | All host effects reversible (AE-7) to per-block default; Trials instanced/non-destructive. AE-3 keeps the block playable with the griefer removed. Sim: inject griefing, assert public city byte-identical after reset. |
| **Collusion via amplification** | A ring trades support events to mutually pump standing. | **Corrected instrument:** AE-1 (zero unit transfer) is the *wrong* tool — collusion's payoff is **amplification** (tendedness/richness/attention), not unit flow. Mitigation = **AE-8** (per-actor bound) + **AE-9** (no soft-dependency) + **AE-10** (reputation-neutral discovery) + the Section 9 host-concentration metric. Bounded/decaying/sub-block-collective limits pump magnitude. |
| **Rent-seeking** | A host charges/gates access to "their" block. | AE-1 structural absence (no charge/gate-on-standing op may exist); `FORBIDDEN_TERMS_RE` blocks `rent/landlord/tenant/price/buy/sell/own/owner` at the validator boundary. Sim asserts no operation gates another player's entry/play on a block's standing. |
| **Review / approval capture** | A host captures moderation to self-approve. | Quarantine already enforced: CF-6 hive-service + CF-8 review-queue (`arcade/creator/moderation/review-queue.mjs`) import only pure hash + validators; neither can approve, enable live loading, flip `LIVE_WORLD_LOADER_ENABLED`, or mutate a registry. CF-8 max state = `approved_for_live_candidate` (human recommendation, zero live authority). "Decentralizing review never decentralizes trust." |
| **Creator-package abuse** | A package smuggles economy/ownership/script payloads. | Hash-bound identity (`sha256:` over canonical JSON), re-validation at load time, deny-by-default loaders, monotonic revocation epoch (fail-closed, no default), fail-closed kill-switch, `FORBIDDEN_TERMS_RE` at CF-1. Economy-flavored text fails before becoming any candidate. CF-7 stays disabled regardless. |
| **Balance/badge persistence abuse (NEW)** | An actor reuses a localStorage playerId (or forges another's id on join) to re-attach to a persisted balance/inventory/badge record across sessions, or to claim another player's persisted state. | **Named finding, not a solved threat:** because `playerId` is client-supplied (`arcade-room.ts:306-307,382`) and DO state persists keyed to it, the existing record is cross-session and only client-id-authenticated. Doctrine flags this for rung 9A.5 + G-KYC/G-PRIVACY/G-MINORS: any future identity hardening (or the existing posture) must be argued safe by counsel; Phase 9 does not assert it is. |
| **Casual exclusion (player-experience)** | The world becomes unfun for non-contributors. | **AE-13:** casual experience first-class + reputation-invariant; sim asserts a zero-standing participant's enjoyment surface == a max-standing block's, casual retention ≥ contributor retention. |
| **Obligation creep** | Optional becomes expected. | Objectives never block or degrade base play; sim asserts opting out of all objectives loses no core experience. Honors "voice before objectives" (PROJECT_CHARTER.md:13). |
| **Status anxiety / visible inequity** | Visible standing asymmetry drives unwanted grind. | **AE-11 + AE-13:** no per-person attribution in any FUTURE loop, no player-facing "you rank below them" surface; richness is block-level and benefits everyone on the block equally. *(Reconciliation: the shipped per-player badges are the existing closest status surface — rung 9A.5 assesses whether they already create status pressure.)* |
| **Vibe-hostage** | A tended block deliberately styled to alienate casuals. | Stewardship closed-allowlist already bounds content; doctrine names that a host cannot make a public block hostile to casuals (block stays casual-welcoming by allowlist + AE-13). |

Every mitigation above is a constraint the system already embodies, a *corrected* statement of what the substrate actually does, or a bounded property the simulator must prove — none requires building an economy. The rate-limiting and persistence rows are *present findings* the 9A.5 audit must check against the shipped endpoints, not future-only properties.

---

## 8. Simulator-first requirement (no live economy without a green sim — and no green sim of an unbuildable model)

**Hard rule:** **A LOCAL economy simulator MUST exist and pass all abuse scenarios before ANY future economy surface is designed, prototyped, or flagged.** No green sim → no future live economy. (This rule governs *future* surfaces; the *existing* ticket/prize/ledger/inventory/achievement/challenge loop is reconciled at rung 9A.5, Section 11.)

- **Substrate is OFF-REPO and UNMERGED.** The HiveWorld CRDT-log mirror lineage is **not in product `main`**; it lives only on separate unmerged lab branches (verified by absence — no `arcade/hiveworld-sim` / `tests/hiveworld` in this repo). **9B is a lab build that requires its own separate authorization even to reconstitute the substrate.** The product Worker/DO stay untouched; the sim mirrors product authority/economy/game and **never bridges** to live truth. Its defining property — convergence is *free from the canonical append-only log* (reorder/dup → same fingerprint) — is exactly what deterministic economy testing needs (but is **not** a substitute for sole-writer authority; Section 5).
- **Fidelity gate (prevents a false green light).** The simulator **may only model units that have a non-forbidden product-side representation.** It may **NOT** model per-host accounting, per-host capacity, or reputation-ranked discovery — because product cannot implement those without crossing the no-accounts / AE-10 / AE-11 lines. A green sim of a model the product cannot legally build is **not** clearance.
- **What it must encode:** the two block-scoped units (Section 4), the carry-not-own + read-replica invariants (Section 5), AE-1…AE-13 as machine checks (Section 3), all abuse vectors as failing-then-passing scenarios (Section 7) — **including endpoint flood / rate-limit exhaustion and the persistence/identity-reuse vectors** — and all metrics (Section 9).
- **Fairness metrics are SIMULATOR-ONLY.** Gini-of-capacity, host-concentration, casual-vs-host retention, net-transfer-to-host all require **per-actor data** that the product does not have and the no-accounts rule forbids. They are computed in the lab sim (synthetic per-actor data is fine there) and **CANNOT be computed in product without crossing the no-accounts line.** Explicit non-goal: **no per-host instrumentation in product; fairness metrics are simulator-only.** A metric that requires building the forbidden surface to measure it is not a guardrail.
- **Green bar:** every AE-* assertion holds across every abuse scenario; rate-limit/flood scenarios bounded; every metric in the HEALTHY band; public-city byte-identical after every reset. Anything red blocks promotion.
- **What it must NOT do:** touch the product critical path, flip `LIVE_WORLD_LOADER_ENABLED`, deploy, create accounts, or introduce any forbidden surface. A lab proof harness, not a product.

---

## 9. Metrics — HEALTHY vs DANGEROUS (with required data + where computable)

A loop is promotable only while every signal is HEALTHY. **Each metric names the data it needs and whether that data is product-available or simulator-only.** Metrics requiring per-actor identity are simulator-only by mandate (Section 8) — never an argument for building accounts.

| Signal | Data required | Where | HEALTHY | DANGEROUS |
|--------|---------------|-------|---------|-----------|
| **Gini of block richness** | per-block richness over time (no identity) | sim + product-safe (block-level) | Richness spread across many blocks | Concentrating into few blocks |
| **Host/contributor concentration** | per-actor contribution share | **simulator-only** (forbidden in product) | Top-k a bounded minority | A ring carries most of the world; soft dependency forming (AE-9) |
| **Casual-vs-contributor retention split** | per-actor retention | **simulator-only** | Casual retention ≥ contributor retention | Casuals churn unless they contribute/grind (AE-13 reject) |
| **Time-to-fun** | session timing vs block standing | sim + product-safe | **Reputation-INVARIANT** — rank-0 and rank-max reach play within the same bound | Rising with required standing/grind (AE-2/AE-4 drift) |
| **Coercion proxies** | session-length distribution around scarcity/countdown events | sim | Voluntary; no spikes; decay does not punish absence | FOMO/scarcity/loss-aversion spikes (AE-5) |
| **Net transfer to hosts** | per-actor unit flow | **simulator-only** | Exactly zero | Any non-zero transfer (AE-1) |
| **Authority delta by standing** | authority vs block standing | sim + product-safe (structural) | Zero — identical movement/collision/score for new vs tended | Non-zero — standing buying power (AE-2) |
| **Capacity-source integrity** | derivation provenance of any richness | sim | Richness not derivable from un-deduplicated population/reputation (AE-8) | Richness fed by un-bounded population/reputation |
| **Endpoint request-rate headroom (NEW)** | per-connection request rate vs cap | sim + product-safe (structural) | Bounded; a flooding actor is throttled and cannot outpace honest accrual or exhaust the DO | Unbounded message volume can saturate the scorer, the DO, or defeat dedup (Section 7 flood row) |

Any DANGEROUS reading is a stop condition: not promoted; doctrine revisited.

---

## 10. Hard forbidden surfaces (each NOT in Phase 9; each gated behind a future ADR + counsel)

Each marked permanently excluded from Phase 9 and gated behind both a future charter ADR *and* the relevant Section 6 gates. This prose list is, and must remain, a **superset** of the in-code `FORBIDDEN_TERMS_RE` deny-list (which screens label text only).

- **Real money / cash-out / payout / withdraw / payment** — NOT in Phase 9. Gate: G-MONEY + G-TAX + future ADR.
- **Marketplace / market / for-sale / buy / sell / trade / price** — NOT in Phase 9. Gate: G-MONEY + G-CONSUMER + future ADR.
- **Ownership / own / owner / land ownership** — NOT in Phase 9. Gate: G-SEC + future ADR. *(Note the incumbent: `prize-authority.mjs` already uses ownership semantics in its comments — a reconciliation input at 9A.5, not a license to keep extending the model.)*
- **Convertible / transferable / aggregated balance** — NOT in Phase 9. The existing persisted ticket balance must never become convertible to money/goods, transferable between ids, or aggregated into a global account. Gate: G-MONEY + G-SEC + future ADR. (Forbidden by AE-6.)
- **Rent / rental / landlord / tenant / paid hosting / income / profit** — NOT in Phase 9. Gate: G-MONEY + G-CONSUMER + future ADR. (Forbidden by AE-1.)
- **Per-host "capacity budget" / reputation-gated resource allocation** — NOT in Phase 9; **deleted from doctrine** as one mutation from paid hosting. If ever revisited: block-level only, bounded, sub-linear, non-purchasable by money OR grind, transparently operator-allocated. Gate: G-CONSUMER (fairness/exclusivity) + future ADR.
- **Reputation-ranked discovery / paid-for-attention / visibility standing** — NOT in Phase 9; **deleted.** Gate: G-CONSUMER + future ADR. (Forbidden by AE-10.)
- **Per-person reputation / persistent global profile / status surface** — NOT in Phase 9; **deleted** for any future loop. Per-player attribution stays deferred (ADR-009). Gate: G-KYC + G-PRIVACY + G-MINORS + G-SEC + future ADR. (Forbidden by AE-11.) *(The shipped per-player achievement badges / challenge progress are the existing closest surface — reconciled at 9A.5, not extended.)*
- **Transferable / sellable goods / transfer / resale** — NOT in Phase 9. Gate: G-SEC + G-MONEY + future ADR. (Forbidden by AE-6.)
- **Token / NFT / crypto / stake / staking / yield** — NOT in Phase 9. Gate: G-SEC + G-MONEY + future ADR.
- **User accounts / OAuth / persistent global profile** — NOT in Phase 9. Gate: G-KYC + G-PRIVACY + G-MINORS + future ADR. (No formal accounts exist today; but a localStorage-stable client-supplied playerId already keys persistent state — a load-bearing nuance, not a clean absence; see §1 + G-KYC.)
- **Gambling-adjacent: wager / bet / jackpot / loot / raid / steal / multiplier / boost / reward / earn / prize / bonus** — NOT in Phase 9 (blocked by `FORBIDDEN_TERMS_RE` as label text). Structural gate: G-GAMBLING + future ADR. **Any randomized/chance-based award is forbidden pending G-GAMBLING.**
- **Signature antagonistic mechanics: crime / weapons / police / wanted level / vehicular violence / theft / loot / gambling** — hard non-goals per ADR-024 §1; NOT in Phase 9; not gated for re-entry.
- **User-contributed image/asset surfaces without CSAM + DMCA gates** — NOT in Phase 9. Gate: G-CSAM + G-UGC (both currently absent) + future ADR.
- **CF-7 live loader enablement** (`LIVE_WORLD_LOADER_ENABLED` → `true`) — NOT in Phase 9. Separate, later, human-cleared, staging-verified operator gate; out of scope.
- **Production deploy / new DO migration / live package delivery routing** — NOT in Phase 9.

Phase 9 adds **no exceptions** to `FORBIDDEN_TERMS_RE` and relaxes nothing in `build-curated-client-upload.mjs` (`FORBIDDEN_UPLOAD_PREFIXES`).

---

## 11. Phase ladder (entry / exit gate per rung)

> Each rung is separately authorized. A rung may not begin until the prior rung's exit gate is met. Rungs above 9B cannot begin without a green simulator that respects the Section 8 fidelity gate. **No rung in this ladder authorizes any real-money / marketplace / ownership / per-host-capacity / per-person-reputation / convertible-balance surface** — those live strictly beyond the ladder, behind a future ADR + counsel. **No rung may proceed on a partial gate review when its design touches an unlisted gate.**

**9A — Doctrine only (this document).**
- *Entry:* operator authorization to author Phase 9 doctrine; `main` at `b030ebf`.
- *Work:* this plan + Charter ADR-040 recording the doctrine. No code.
- *Exit:* ADR-040 appended to the top of `docs/PROJECT_CHARTER.md` (newest-first); adversarial completeness critic reports zero exclusion violations; nothing built; CF-7 disabled; HiveWorld untouched.

**9A.5 — Reconcile existing surfaces (doctrine/audit only, no code).**
- *Entry:* 9A exit met.
- *Work:* inventory **every** already-shipped economy-shaped surface by name and assess each against AE-1…AE-13 and **every Section 6 gate (especially G-GAMBLING, G-CONSUMER, G-MINORS, G-MONEY, G-SEC, G-PRIVACY, G-KYC)**:
  - Phase 1E/1F ticket award (`tickets.mjs`) + round/ticket state machine (`round-authority.mjs`);
  - prize redeem + persisted **spendable balance** + inventory/equips (`prize-authority.mjs`, `state.balances`/`inventory`/`equips`);
  - prize **cost catalog** (`catalog.mjs`);
  - per-player **private ledger** (`ledger.mjs`);
  - **persistent per-player achievement badges** (`achievements.mjs`, `state.achievements`);
  - **Challenge Board per-player progress** (`challenges.mjs`, `challenge_progress`);
  - the **DO-durability + client-localStorage-id keying** of all the above (`arcade-room.ts:155,165,306-307,382`; `neon-circuit-room-client.js:118-121`), cleared only by `/admin/reset`;
  - the **rate-limit / endpoint-flood posture** of the live economy messages and host-rank emission (Section 7 NEW row).
  No code; an audit + findings recorded in the charter. **No incumbent is silently grandfathered, and none is characterized as cleanly "session-bound" — the cross-session, client-id-keyed durability is recorded as a present fact.**
- *Exit:* each existing surface mapped to gates with counsel questions raised; the persistence/identity model and the balance's stored-value characterization explicitly raised (G-MONEY/G-SEC/G-PRIVACY/G-KYC); rate-limit posture audited; the per-player badge/challenge surfaces' compatibility with the block-collective/AE-11/AE-13 direction assessed; any gap recorded as a finding (never silently grandfathered); minors-protection review of the existing loop is *opened* (a present compliance question, not deferred). **No surface is declared compliant by this rung — that requires counsel.**

**9B — Local economy simulator (lab only).**
- *Entry:* 9A.5 exit met; **separate explicit authorization to build the lab simulator** (off product critical path; substrate is off-repo/unmerged and must be reconstituted under its own authorization).
- *Work:* extend the HiveWorld CRDT-log mirror to encode the two block-scoped units, carry-not-own + read-replica invariants, all AE-* checks, all abuse scenarios (including fork/withhold/poison, endpoint flood/rate-limit, persistence/identity-reuse, and the player-experience threats), and all metrics — respecting the fidelity gate (no per-host accounting). No product change, no flag flip, no deploy.
- *Exit:* simulator green on every AE-* assertion and abuse scenario; every metric HEALTHY; public-city byte-identical after every reset; product Worker/DO unchanged; the model the sim proves is one the product can build without crossing any forbidden line.

**9C — Non-cash block recognition (still non-live, still non-cash, still block-collective).**
- *Entry:* 9B green; explicit authorization. Counsel gates relevant to a *non-cash, non-account, block-collective* recognition surface — at minimum **G-CONSUMER, G-PRIVACY, G-MINORS, G-UGC** — reviewed and cleared in a future ADR. *If any per-person attribution ever survives review (it should not), G-KYC and G-SEC become mandatory and the future ADR must justify why per-person standing is not a stake/identity surface.*
- *Work:* design only the non-cash, block-collective tendedness + non-rivalrous richness/stewardship recognition layer on existing block-collective primitives (NOT on the per-player ledger/badge substrate, §4), preserving every per-primitive invariant and AE-8/AE-10/AE-11. Still no money, accounts, transfer, marketplace, ownership, per-host capacity, reputation-ranked discovery, or convertible balance. CF-7 disabled.
- *Exit:* design re-proven against the same simulator with no AE-* regression; reviewer confirms block-collective tendedness + non-rivalrous richness ONLY; no forbidden surface introduced; no production.

**9D — Staging-only closed loop.**
- *Entry:* 9C exit met; explicit operator authorization; staging-only; the full Section 6 gate set re-reviewed for the staging context. CF-7 enablement (if a package use case demands it) follows its own separate, human-cleared, staging-verified gate — not assumed here.
- *Work:* a closed, staging-only validation of the non-cash block-recognition loop with real DO behavior. Still no production, money, accounts, transfer, marketplace, ownership, per-host capacity, per-person reputation, or convertible balance.
- *Exit:* staging green against all metrics over a sustained window; abuse scenarios (including rate-limit/flood) re-validated live-in-staging; explicit operator sign-off recorded. **No production deploy is part of this ladder.**

**LATER (beyond this ladder) — ANY real-money / marketplace / ownership / per-host-capacity / per-person-reputation / convertible-balance discussion.**
- *Entry gate:* a **new, explicit charter ADR** stating *exactly how*, **plus** written counsel clearance of every applicable Section 6 gate (G-MONEY, G-TAX, G-GAMBLING, G-SEC, G-KYC, G-CONSUMER, G-UGC, G-CSAM, G-PRIVACY, G-MINORS). Until that ADR and that clearance exist, every surface in Section 10 stays permanently forbidden. Phase 9 does not open this; it only names that the door requires both keys.

---

## 12. Validation & handoff

**Restate plainly: NOTHING was built — and state plainly what ALREADY EXISTS.**
- No economy module, ledger, balance/credit/inventory/achievement/challenge field, account, or marketplace was **created** by Phase 9. (The pre-existing Phase 1E/1F/1H ticket/prize/ledger/inventory/achievement/challenge loop is *named, fully inventoried, and reconciled*, Section 11 rung 9A.5 — not invented, not modified here.)
- **Corollary stated plainly (corrects "session-scoped" framing):** a **DURABLE, DO-persisted** economic record ALREADY EXISTS and persists across DO hibernation/restart — `state.balances` (a spendable balance) + `inventory` + `equips` + `ledger` + `achievements`, all keyed by a **client-supplied playerId** that the default client sources from **localStorage** (`neon-circuit-room-client.js:118-121`), written via `ctx.storage.put("arcadeState", …)` (`arcade-room.ts:155`), reloaded on init (`:165`), and cleared **only** by an explicit both-gated `/admin/reset`. For a returning visitor this is **cross-session and client-id-keyed**, not "session-bound." Phase 9 records this as a present, reconcilable fact (rung 9A.5) and a G-PRIVACY/G-MINORS/G-KYC/G-MONEY input — it does not minimize it.
- No code was written or modified; no economy was designed.
- `LIVE_WORLD_LOADER_ENABLED` remains `false`; CF-7 is not enabled.
- No production deploy; no new DO/migration; HiveWorld untouched.
- The prose forbidden-surface list remains a superset of `FORBIDDEN_TERMS_RE`; no exception was added to the regex or to `FORBIDDEN_UPLOAD_PREFIXES`.
- Repo anchor verified against git this pass: `main` HEAD = `b030ebf`; CF-8 review-queue path verified at `arcade/creator/moderation/review-queue.mjs` (`FREE_TEXT_FIELDS` line 30, `REQUIRED_REVIEW_CRITERIA` line 32).

**Artifacts this phase would produce (doctrine only):**
- This plan at `docs/PHASE_9_ECONOMY_DOCTRINE_PLAN.md` (parallels `docs/PHASE_8_DISTRICT_SCALE_PLAN.md`).
- A new **ADR-040** appended at the **top** of `docs/PROJECT_CHARTER.md` (newest-first; em-dash heading `## ADR-040 — Phase 9: economy doctrine & anti-extraction preflight (doctrine-only) (2026-06-07)`; body `**Context.** / **Decision.** / **Consequences.**`), recording the doctrine, the existing-loop reconciliation mandate (with the full six-module inventory and the durability/identity correction), and re-affirming every boundary verbatim.

**Handoff — explicit:**
> **Nothing was built. No economy was created by Phase 9.** What already exists is a closed, capped, non-cash arcade loop spanning six shipped modules (`tickets.mjs`, `round-authority.mjs`, `ledger.mjs`, `catalog.mjs`, `prize-authority.mjs`, `achievements.mjs`, plus the `challenges.mjs` Challenge Board) — and, stated plainly, its `balances`/`inventory`/`equips`/`ledger`/`achievements` state is **DO-durable and keyed to a localStorage-stable, client-supplied playerId**, persisting across sessions and cleared only by `/admin/reset`. It is **NOT** merely "session-scoped." Phase 9 reconciles this surface (rung 9A.5) rather than extending it. The next gate is **9A.5 — reconcile existing surfaces (audit/doctrine only)**, which must inventory all six modules, the persisted spendable balance, the per-player badges/challenges, the cross-session client-id keying, and the endpoint rate-limit posture — then **9B — the local economy simulator on the HiveWorld lab substrate**, which is off-repo, unmerged, and **requires its own separate authorization** even to reconstitute. No rung above 9B may begin without a green simulator that respects the fidelity gate, and no real-money / marketplace / ownership / per-host-capacity / per-person-reputation / convertible-balance surface may even be discussed without a future charter ADR plus counsel clearance of every Section 6 gate. Phase 9 opens none of these doors; it only documents that each requires both keys.