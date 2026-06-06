# Neon Circuit — Gameplay Charter

**Status:** charter / constitution. **Plan-only — defines intent and boundaries; implements no gameplay.**
**Scope:** the long-term gameplay foundation for the Neon Circuit virtual-arcade city.
**Authority:** this document is the gameplay constitution. Where a future phase appears to conflict with
it, the phase is wrong until this charter is amended by an ADR in `docs/PROJECT_CHARTER.md`.

Companion documents:

- `docs/NEON_CIRCUIT_CITY_GAMEPLAY_KERNEL.md` — the per-system foundation (client/server split, data,
  latency/cheat/scale risk, validation requirement).
- `docs/NEON_CIRCUIT_CREATOR_PIPELINE_ROADMAP.md` — CF-1…CF-8 block/arcade-package creator path.
- `docs/NEON_CIRCUIT_PHASE7_PLAN.md` — the next sprint theme (City Gameplay Kernel).
- `docs/PROJECT_CHARTER.md` — ADR-024 records this charter.

---

## 1. Purpose

Neon Circuit grew from an arcade shell (Phase 1) into a multiplayer top-down city that is **live in
production** (`clovelearn.io`, signed off 2026-06-05 with real cross-device multiplayer — see
`docs/PRODUCTION_ROLLOUT_PLAN.md`). It has districts, routing, presence, scheduled district events, a
public activity feed, four blocks, and a local creator foundation (CF-1/CF-2 merged to `main`; CF-3
layered editor on its branch).

The product is now at the point where the **next risk is architectural drift**, not missing features.
If "GTA-style gameplay," block customization, arcade-game packages, creator assets, and decentralized
("Hive") validation are bolted on later as afterthoughts, they create latency, security, moderation,
and design problems that are expensive to undo.

This charter exists to **freeze the gameplay constitution before the map grows deeper**: what the game
*is*, what it is explicitly *not*, the player loop, and which systems must be kernel-first rather than
bolt-on. It is a fence built before the field is planted.

---

## 2. What "GTA-style" means here

"GTA-style" in Neon Circuit is a **camera, spatial, and social** reference — the readability of a
top-down city — not a content or IP reference. The project already encodes this: ADR-004 named the
Phase 4 effort the **"GTA-80 Challenge"** — fit a networked, living, top-down, edge-authoritative city
inside the footprint of the original 1997 *GTA* (~80 MB). The inspiration is the *legibility* of GTA 1
/ top-down city games, and the size discipline of a 1997 cartridge, nothing else.

Concretely, "GTA-style" means:

```
top-down / isometric city navigation
walkable city blocks
players visible to each other in a shared urban space
district traversal between adjacent blocks
arcades and block activities as destinations
street-level events
a public activity feed
shared world presence
route choice and local discovery
emergent gatherings and street-level social energy
```

It is a **city you walk through with other real people**, where the camera reads the street clearly and
the world feels inhabited.

---

## 3. What "GTA-style" explicitly does NOT mean

Neon Circuit does **not** copy GTA's (or APB's, SimCity's, RollerCoaster Tycoon's) intellectual
property, content, names, assets, or signature antagonistic systems. The genre is the reference; the
content is original. The following are **not** part of the game and must never be added under the banner
of "making it more GTA-like":

```
crime simulator            guns / weapons              police / wanted level
vehicle violence            theft / stealing            raiding / loot
mission structure (heists)  gambling                    real money
named-IP characters/places  copied map/assets/branding  violence against civilians
```

The spatial readability of GTA 1 is the **only** thing borrowed, and only as camera/gameplay framing.
Maintaining an original Neon Circuit identity (Section 18) is a hard requirement, not a nicety.

---

## 4. Core player fantasy

> *You inhabit a living neon city. You can walk its streets with other real people, discover arcades and
> street-level happenings, and — over time — earn recognition that lets you help shape how a block looks
> and feels.*

The fantasy is **presence, discovery, and quiet authorship** — not power, domination, extraction, or
violence. The player is a *resident and visitor* of a shared world, not a predator in it. Status, where
it exists, is **non-cash recognition for positive presence** (Host Rank), and authorship is
**constrained, reversible, non-owning** (Block Stewardship; later, validated creator packages).

This is deliberately the inverse of the antagonist fantasy in the sibling Singularity Inc. game
(`game/main.js`): Neon Circuit's emotional register is *belonging in a place*, not *optimizing a system
toward collapse*.

**Staging the fantasy (be honest about what ships when).** The three pillars do not arrive together:

- **Presence — live now.** Co-presence, discovery, cabinets, district events, and travel exist in
  production today; this is what a first-time player actually experiences in the Phase 7 window.
- **Discovery — live now, growing.** New blocks/topology (Foundry ring) and the shifting event pulse.
- **Quiet authorship — staged.** Near-term it is **Block Stewardship** (Host-Rank-gated, reversible);
  full creator authorship is **long-horizon and gated behind CF-7** (the human-reviewed live loader). The
  headline fantasy is aspirational on this third pillar — the charter must not let it read as shipping
  next.

---

## 5. Core minute-to-minute loop

What a player does in any given minute, all of which exists today:

1. **Move** through the block — the server computes every accepted position from input intent (no
   client-authored teleport).
2. **See** other live players move in real time (server-authoritative snapshots, interpolated for
   display).
3. **Approach** a destination — an arcade cabinet portal or (Phase 7) an interaction zone.
4. **Enter** an arcade interior (a same-origin iframe overlay over the city) and play a cabinet
   mini-game (e.g. Pulse Tap, Signal Sprint), then **return** to the city.
5. **Read** the district activity feed and the current/next district event.
6. **Travel** to an adjacent block (a server-validated route confirmation), changing the block's
   identity and population around them.

The loop is **legible, non-violent, and social**. Phase 7 sharpens steps 3–4 (interaction zones,
action prompts, server-confirmed interaction receipts, smoother arcade entry/return) without adding any
new reward or economy.

**Where the first fun lives (a positive target, not just guardrails).** The intended primary source of
delight in the pre-economy loop is **co-presence and legibility**: recognizing other real people moving
through a readable street, and the small social moments and gatherings that emerge around cabinets and
events. The cabinet mini-games are the secondary hook; the event pulse is the texture. Every Phase 7
slice should be designed to *increase* this co-presence/legibility, not merely to avoid bad mechanics —
"fun = the absence of an economy" is a guardrail, not a fantasy.

---

## 6. Session loop

A session targets roughly a **20–40 minute** visit as a design intent — the city imposes no minimum
commitment and leaving costs nothing:

```
arrive in a block  →  see who is here  →  traverse one or two blocks  →
play a cabinet or two  →  catch a district event / read the feed  →
maybe join a Block Trial (instanced, non-destructive)  →  leave
```

City presence is **ephemeral** — leaving drops you from presence with no penalty and no lost progress,
because there is no progress to lose. Arcade cabinet tickets/prizes are **session-scoped, non-cash
counters** (a score, not a currency); they do not transfer, persist as wealth, or buy anything.

---

## 7. Long-term loop

What brings a player back across a week, without accounts, ownership, or economy:

- **The pulse changes.** District events run on a deterministic, server-authored, operator-tunable
  schedule — the city is never the same two visits running.
- **Recognition accrues (non-cash).** Host Rank is a bounded, **decaying** display gauge
  (observer → helper → signaler → anchor) earned by positive presence/support. It decays, so it is a
  *current* signal of behavior, not hoardable wealth or a permanent title. (The concrete earn signals,
  decay cadence, and per-tier visible affordances are defined in the relevant phase plan — today Host
  Rank gates only stewardship/Block-Trial *eligibility*; see `arcade/city/city-host-rank.mjs`.) **Forward
  fence:** Host Rank may gate a non-destructive *authoring capability* (stewardship/trial creation) but
  must never gate *access* to a block, be spendable, be transferable, persist as an account-bound title,
  or stop decaying. It is a behavior signal, not an asset.
- **Blocks gain identity.** Recognized hosts may apply **reversible, allowlist-constrained** visual
  stewardship to a block (never ownership). Later, validated creator packages (CF-3+) add depth.
- **The map grows.** New blocks and non-linear topology (the ring added a fourth block, Foundry, in
  Phase 6D) give new places to discover.
- **Eventually, community authorship.** Once the creator pipeline reaches a human-reviewed live loader
  (CF-7/CF-8), approved player-authored blocks change how the city looks — under validation, never as
  open UGC.

No loop in this list pays out money, grants ownership, or creates a thing a player can sell. Retention
comes from **a place worth returning to**, not from a treadmill or a market.

---

## 8. City gameplay kernel

The **kernel** is the small set of foundational systems every future gameplay feature sits on. They
must be built and hardened *first* so that later features extend them rather than work around them. Full
specification is in `docs/NEON_CIRCUIT_CITY_GAMEPLAY_KERNEL.md`; the members are:

```
movement              collision             routing / block arrival
presence              interaction zones     arcade entry / return
district events       public activity feed  block trial (instanced)
stewardship style     creator package preview (local)   approved package loading (gated)
```

For each, the kernel doc fixes the **client-owned display vs. server-owned truth** split, the data
model, and the latency / cheat / scale / validation requirements. The rule the kernel enforces:
**display may be predicted on the client; truth is always the server's, projected through an
allowlist.**

---

## 9. Server authority model

This model is already implemented and must be preserved by every future phase:

- **`CityRoom` Durable Object = per-block authority.** One DO per block (`idFromName(cityId)`), so
  adding blocks adds no DO class and no migration. It owns ephemeral player position/membership,
  movement clamp, collision, portal gate, the per-block event log, and (instanced) Block Trial. It
  **never** talks to the arcade `RoomRegistry` and **never** touches arcade occupancy/ticket/economy
  state — the strongest guarantee the arcade cannot regress.
- **`CityRegistry` Durable Object = cross-block presence coordinator.** DO-to-DO only, never
  client-reachable, no private data; holds a per-block occupancy heartbeat (a count + freshness
  stamp) for live district presence.
- **Clients send input intent only.** Messages carry `dx, dy, seq, ts` — never an absolute position,
  velocity, reward, or inventory. The server computes every accepted position from its own canonical
  state, a server-clock `dt` clamped so it can never exceed real elapsed time (no speed-hack), and
  collision. Client-side reconciliation/interpolation is **visual only**, never canonical.
- **Routing is a confirmation, not a teleport.** The route *source* is the server-owned `boundCityId`;
  the *target* is untrusted and validated (`validateRouteRequest`: sanitize → known → adjacent →
  not-self). A route result only authorizes the client to reconnect (`switchCity`); the target block's
  own authority admits it. Cross-block membership can never be forged.
- **Everything public is allowlist-projected.** Presence deltas, the activity feed, district events,
  and stewardship all pass through a fixed field allowlist (the public-safety choke point) and fail
  safe on unknown types. The client can request and display, but **never author**, canonical facts;
  a forged inbound canonical message resolves to `unknown_type`.

Future gameplay **must not** introduce a message that carries authoritative state from client to server,
must not give a reader DO a privileged actor capability, and must not bypass the allowlist projection.

---

## 10. Block interaction model

A block is a shared, server-authoritative space. Interactions follow one shape:

```
client expresses intent  →  server validates against canonical state  →
server emits a public-safe, allowlist-projected result  →  all clients display it
```

Today this covers movement, portal entry, routing, Block Trial participation, and stewardship
apply/reset. Phase 7 adds **interaction zones**: server-defined regions of a block that, when a
server-confirmed player position is inside them, enable an **action prompt** (e.g. "Enter arcade",
"Read board"). The zone test runs on the server against the canonical position; the prompt is client
display. There is **no** client message that says "I performed action X" and is trusted — the server
confirms the precondition and emits the receipt (see 7E in the Phase 7 plan).

Interactions never damage, lock, steal, or permanently alter the public block. The only persistent
block change is **reversible stewardship** within a closed allowlist.

---

## 11. Arcade cabinet role

Arcades are **destinations**, not economies. A cabinet is reached by a server-confirmed portal and
opens the existing arcade as a same-origin iframe interior (isolated; no postMessage authority mixing).
Cabinet mini-games (Pulse Tap, Signal Sprint, and any future cabinet via the cabinet adapter SDK / frame
contract) are **server-authoritative for their scored outcome** (Phase 1E server tickets). Be precise
about the one already-economy-shaped surface in the product: the arcade ticket loop is a **closed,
capped, non-cash, room/session-scoped point system** (`workers/arcade/src/{ledger,prize-authority,
tickets}.mjs`). Tickets are awarded by graded, server-validated scoring; a balance is kept per player
**within a room/DO**; and `redeemPrize()` spends tickets — server-side cost check + decrement + ledger
entry — on a **fixed, operator-owned in-cabinet prize catalog** that mints a cosmetic in-cabinet
entitlement. Its hard boundaries:

- tickets are spendable **only** on the fixed in-cabinet prize catalog, with server-authoritative cost
  and a server-checked-and-decremented balance;
- **no accounts, no cross-room/cross-session retention as wealth, no player-to-player transfer, no
  cash-out, no real-money/marketplace** path (see `docs/NEON_CIRCUIT_PHASE1E_SERVER_TICKETS.md`);
- the prize catalog is **operator-owned, never package-owned**.

**Forward fence:** any move toward persistent, transferable, or cross-session balances, player-to-player
trade, or cash-out is a non-goal requiring a charter ADR. **A custom cabinet package (CF-4) may NOT
define prizes, prize costs, ticket-award rules beyond the server-validated bounds, balances, or any
spend/redeem/inventory hook** — ticket scoring stays server-owned. Custom cabinet games are otherwise a
**creator-pipeline** concern (CF-4: arcade-package importer + local sandbox runner), gated behind the
same validate→approve→load boundary as blocks; no player-authored cabinet code runs in the live world
without the human-reviewed loader (CF-7).

---

## 12. District event role

District events are the city's **pulse** — atmosphere, not mechanics. They are a deterministic function
of the wall clock and the static block manifest, **server-authored** as a public-safe snapshot
(`event` inside the `city_blocks` payload) and **operator-tunable** via env
(`DISTRICT_EVENT_WINDOW_MS`, `…_ENABLED`, `…_SHOW_NEXT`). They:

- are display/atmosphere only — they grant no reward, move no player, and touch no Host Rank,
  Stewardship, Block Trial, ticket, or prize;
- are public-safe by construction (field allowlist; only a static block name is interpolated);
- feed the activity feed through the same allowlist choke point as every other item.

Future events may add variety (new event *types*, richer copy, per-block flavor) but must remain
non-economic, public-safe, and server-authored. An event that paid out, unlocked ownership, or gated
access by wealth would violate this charter.

---

## 13. Public activity feed role

The activity feed makes the multi-block district **understandable** — "Downtown became active.",
"Routing to Skyline confirmed.", "Arrived in Skyline.", "Harbor Quiet Window starts soon." It is a
**client-side display projection** derived from facts the client already receives (presence deltas,
route results, arrival, district events). It is:

- bounded (≤16 items, coalesced, newest-first), local display history (resets on reload);
- built through a single `activityItem` field-allowlist (the public-safety choke point); it fails safe
  on unknown types and interpolates only static display names;
- never a client→server channel and never carries private or economic data.

The feed is the model for how *all* future "what's happening" surfaces should work: derive from
canonical facts, project through an allowlist, bound the history, display only.

**Forward note.** The feed's interpolated block name is safe **today** because it comes from static city
config (`arcade/city/city-block.mjs`), not from any player package. If/when CF-7 lets a player-authored
package supply a block's `display_name`, that value becomes a user-text surface and inherits the CF-8
human-review obligation before it may appear in any public feed or label.

---

## 14. Creator editor role

The creator editor is where players (and, today, operators) **author block/arcade content locally**.
Its non-negotiable shape (CF-1/CF-2/CF-3):

- **Offline, no-submit, no-upload, no live-world control.** The editor composes a **data-only** package
  whose **visual/style values are all closed-allowlist tokens** (no free-form colors/numbers/geometry, no
  images, no URLs, no scripts), previews it with an original procedural renderer, validates it locally
  with the same validator the CLI uses, and shows the canonical hash + a `local_validation_only` receipt.
- **Bounded human-label text is the one exception, and it is not allowlist-constrained.** Packages do
  carry a few short human-label fields — `display_name` (≤40 bytes), `package_id` (kebab slug), and the
  approval receipt's `operator_note` (≤200 chars). These are length-bounded and screened by a deny-regex
  for **markup/script/URL and economy vocabulary only** (`FORBIDDEN_CONTENT_RE`/`FORBIDDEN_TERMS_RE`);
  that regex does **not** screen profanity, slurs, harassment, impersonation, or PII. So these fields
  require **human content review (CF-8) before any live use** — they are the package's real free-text
  attack surface.
- **Constraint is the creative medium.** Bounded sizes (e.g. CF-3 `block_layered` ≤12 KiB, ≤6 symbols,
  1–4 lighting zones; arcade packages ≤64 KiB), closed taxonomies, original procedural visuals.
- **Isolated from production.** All of `arcade/creator/**` is excluded from the curated client upload
  (`scripts/build-curated-client-upload.mjs`) until a phase deliberately opens the boundary.

The editor's depth grows (CF-3 layered customization, CF-4 arcade-package import, CF-5 tiled-map
compositions) but its boundary never weakens: **nothing authored here reaches the live world except
through the validate → hash → approve → load pipeline.**

---

## 15. Hive validation role

"Hive validation" is the **distributed validation and approval** layer that decides whether an authored
package may ever be trusted by a loader. It generalizes the CF-2 boundary (a single operator's static,
hash-keyed approved-package registry + hash-sealed receipt) into a reviewable service (CF-6 prototype,
CF-8 moderation queue). Its invariants, inherited from CF-2 and never to be weakened:

```
deny-by-default                          a package not approved is, by definition, unapproved
hash-bound approval                      approval is for an exact canonical hash; edit → re-review
no live load without explicit authority  LIVE_WORLD_LOADER_ENABLED is false and double-locked;
                                         live_world_authorized:true is a validation error today
human in the loop before live            CF-7/CF-8 require a human-cleared review path
```

Hive validation is a **safety boundary, not a feature accelerator**. Decentralizing *review* must never
decentralize *trust by default*. The reader/validator must hold no privileged live-world capability; a
separate, deliberately-authorized actor flips the live loader (quarantine pattern).

**The automated validator is a structural/safety-vocab filter only.** It rejects code/markup/URL/template
smuggling, economy/NFT/identity vocabulary, prototype pollution, and DoS-by-count — but it makes **no
judgement about the appropriateness of free-text human labels** (`display_name`/`package_id`/
`operator_note`). A CF-6 "valid" verdict is therefore **never** content-cleared; content appropriateness
is solely a CF-8 human responsibility.

---

## 16. Custom arcade game package role

A custom arcade game is the highest-risk creator artifact because it implies behavior, not just data.
Its role is therefore the most tightly gated:

- A custom cabinet game is a **package** (CF-4) that declares capabilities **deny-by-default** (empty
  allowlist), empty assets by default, and a strict size budget — never arbitrary JS executed in the
  live world.
- It runs first only in a **local sandbox runner** (CF-4), behind the cabinet **frame contract** and
  the **cabinet adapter SDK** (Phase 1I/1J) that already constrain how a cabinet game talks to the
  arcade.
- It reaches the live world only via the same human-reviewed approved-hash loader (CF-7), never as open
  UGC and never as an unvalidated upload.
- **It may NOT define prizes, prize costs, ticket-award rules (beyond server-validated bounds), balances,
  or any spend/redeem/inventory hook.** Ticket scoring stays server-owned (Phase 1E bounds); the prize
  catalog is operator-owned. This closes the one creator path that could touch the existing points loop.

Until that pipeline exists and is reviewed, custom arcade games are a **local-only, sandboxed** concern.

---

## 17. Safety / abuse boundaries

The product carries clinical-grade safety expectations (it ships alongside a therapeutic platform).
Gameplay must hold these lines:

- **Public surfaces are allowlist-projected and bounded.** No private data, identity, or free-form
  user text reaches another player through presence, the feed, events, or stewardship. The one
  exception is package **human-label text** (`display_name`/`package_id`/`operator_note`): these are
  length-bounded and deny-regex-screened for markup/economy terms only — **not** for profanity, slurs,
  harassment, impersonation, or PII — so they require human content review (below) before any live use.
- **No open UGC, no arbitrary uploads, no arbitrary scripts.** Player content is data-only, closed-token
  (for all visual/style values), validated, and hash-approved before it can render anywhere but a local
  preview.
- **Human review before anything user-authored goes public** (CF-8 moderation/human-review queue). The
  reviewer **must** screen the free-text fields (`display_name`, `package_id`, `operator_note`) for
  profanity, slurs, harassment, impersonation, and PII; the deny-regex is a syntactic filter, **not** a
  content-moderation control. "No free-text field is live-approved without human content review" is a
  hard CF-7→CF-8 gate.
- **Rate limiting and deny-by-default** on every interaction message, as today.
- **Reversible, non-destructive** world changes only (stewardship resets to a block's default; Block
  Trial copies a style snapshot and never edits the live block).

What is rejected by construction: code/markup/URL/template smuggling, economy/NFT/identity vocabulary in
packages, prototype-pollution payloads, DoS via symbol/zone/asset counts, and any attempt to author a
canonical fact from the client.

---

## 18. IP originality boundaries

Allowed as **genre / camera / spatial** inspiration only:

```
top-down / isometric city camera readability (GTA 1 era)
the "fit it in 80 MB" size discipline of a 1997 cartridge (the GTA-80 framing)
the general idea of a shared, walkable urban space (the open-world-city genre)
```

Prohibited — never copied, referenced by name, or reproduced:

```
GTA / APB / SimCity / RollerCoaster Tycoon assets, maps, characters, names, logos, music, UI
those games' signature antagonistic mechanics (crime, wanted level, vehicular violence, theft)
any branding or copy that implies affiliation with those titles
```

Originality is maintained by: original procedural visuals (no imported art), a closed and **original**
token vocabulary, original block/event/character naming ("Neon Circuit", "Pulse Tap", "Signal Sprint",
"Block Trial", "Foundry"), and a distinct non-violent emotional register. The package validator today
scans for forbidden **economy/gambling** vocabulary (`FORBIDDEN_TERMS_RE`); it does **not** yet scan for
IP names. **Recommended (not yet implemented):** add a `FORBIDDEN_IP_RE` scan over code/docs/tokens for
GTA/APB/SimCity/RollerCoaster/Tycoon/Rockstar names (allowlisting the internal `GTA-80` framing label),
so IP originality is enforced, not just asserted.

---

## 19. Non-goals (hard)

Neon Circuit will **not** define or implement, under any phase, without a new charter ADR that states
exactly how and behind which legal/safety gates:

```
crime simulator · weapons · police · wanted level · vehicle combat · stealing · raiding · loot
gambling · wager / bet · real money · crypto · blockchain · token / NFT mechanics · staking · yield
cash-out · marketplace · player-to-player trade · paid hosting · land ownership · rent · income · payout
sellable blocks · transferable goods · reward multipliers / boosts · open UGC · arbitrary player scripts
unvalidated asset uploads
```

> These prose non-goals must remain a **superset** of the validator's enforced ban list
> (`arcade/creator/validator/validation-report.mjs` `FORBIDDEN_TERMS_RE`, which already rejects
> buy/sell/trade/rent/own/profit/payout/wager/bet/loot/raid/steal/stake/yield/crypto/token/nft/market/
> income/cashout/jackpot/multiplier/boost/reward/earn/prize/bonus/withdraw/price/for-sale at the data
> boundary). If the regex bans a term, the charter must too.

Standing rules this charter must not weaken:

```
no economy until doctrine says exactly how
no ownership until legal/safety gates exist
no player-created package enters the live world without validation
no live loader without an approved-hash receipt
no arbitrary external asset URL
no arbitrary JS in block packages
```

These are not "not yet" features waiting in a backlog. They are **out of scope by design**; several are
the explicit inverse of what this product is for.

---

## 20. Phase roadmap

High-level order (detail in the Phase 7 plan and the creator-pipeline roadmap):

| Phase | Theme | Status |
|---|---|---|
| 1–3 | Arcade: cabinets, rooms, events, launch readiness | Done; live |
| 4 | First city block (`CityRoom`, authority, log, scheduler, Host Rank, Stewardship, Block Trial) | Done |
| 5 | Multi-block district (identity, live presence, push, activity feed) | Done |
| 6 | District pulse (server-authored events, rich cards, fourth block / ring) | Done; **live in production** |
| **CF-1…CF-3** | **Creator foundation (local editor, approved-hash boundary, layered depth)** | CF-1/CF-2 on `main`; CF-3 on branch |
| **7** | **City Gameplay Kernel** (interaction zones, collision, objectives w/o rewards, arcade entry polish, server-confirmed receipts, multiplayer proof) | **Next** |
| CF-4 | Arcade-package importer + local sandbox runner | Planned |
| CF-5 | Tiled-map viewer / multi-block compositions + city asset-pack workflow | Planned |
| CF-6 | Hive validation **service** prototype | Planned |
| CF-7 | Operator-approved **live** loader (the gate CF-2 calls "CF-E") | Gated |
| CF-8 | Moderation + human-review queue | Gated |
| 8–10 | City scale (more blocks/districts), richer non-economic social systems, community authorship — **only after** the kernel and creator gates exist | Future |

The ordering principle: **kernel and creator gates before scale.** Growing the map before the kernel is
foundational would lock in bolt-on debt.

---

## 21. Acceptance criteria before Phase 7

Phase 7 (City Gameplay Kernel) may begin when:

- [ ] This charter, the kernel doc, and the creator-pipeline roadmap are landed (this sprint).
- [ ] The server-authority model (Section 9) is restated in the kernel doc with explicit per-system
      client/server splits — so every Phase 7 slice has a written truth/display boundary to build to.
- [ ] CF-2 is on `main` (it is) and CF-3's boundary semantics are documented (they are).
- [ ] The non-goals (Section 19) are explicit and referenced by the Phase 7 plan, so no slice can drift
      into economy/ownership/violence.
- [ ] Phase 7 slices (7A–7F) are scoped as **kernel hardening with no new reward/economy**, each with a
      server-owned-truth definition.

Phase 7 implementation begins **only** at the gate `AUTHORIZED: IMPLEMENT PHASE 7A` (which, per the
Phase 7 plan's dependency analysis, starts with the **7B** collision groundwork that 7A builds on). The
numbered list below is post-authorization sequencing, **not** a go-ahead to write code now.

Recommended order out of this sprint (also in the handoff section of the Phase 7 plan):

```
1. Land this gameplay charter.
2. CF-2 is on main; review/merge CF-3 (already committed on branch 2f53645).
3. Land CF-3's layered constrained block editor into main (review the branch — it exists; do not rebuild).
4. Implement Phase 7: 7B collision/boundaries first, then 7A interaction zones (gate: AUTHORIZED: IMPLEMENT PHASE 7A).
5. Only then consider city-scale expansion (Phase 8+).
```

---

*This charter is plan-only. It adds no gameplay, no Worker/DO code, no deploy, and no production change.
It is recorded as ADR-024 in `docs/PROJECT_CHARTER.md`.*
