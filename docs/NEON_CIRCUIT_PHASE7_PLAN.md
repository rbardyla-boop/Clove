# Neon Circuit — Phase 7 Plan: City Gameplay Kernel

**Status:** plan. **Plan-only — defines the next sprint's shape; implements nothing.**
**Theme:** **City Gameplay Kernel** — harden the foundation, do not add features on top of it.
**Parents:** `docs/NEON_CIRCUIT_GAMEPLAY_CHARTER.md`, `docs/NEON_CIRCUIT_CITY_GAMEPLAY_KERNEL.md`.

## Why this theme

Phase 6 made the city **live and alive** (production, real cross-device multiplayer, a district pulse).
The temptation now is "more random features." That is exactly the drift this charter exists to prevent.
Phase 7 instead **makes the kernel real**: the systems every later feature leans on — interaction,
collision, server-confirmed actions, arcade entry/return, and a proven multiplayer baseline — built to
the written truth/display boundaries in the kernel doc.

**Phase 7 adds no reward, no economy, no ownership, no account, no violence, and no live UGC.** It is
kernel hardening. Each slice ships with a *server-owned-truth* definition copied from the kernel doc and
a test that the client cannot author the fact.

## Slices

### 7A — Interaction zones + action prompts

- **Goal.** Server-defined regions of a block that enable a context **action prompt** when a
  server-confirmed position is inside them ("Enter arcade", "Read board").
- **Server-owned truth.** Whether the canonical position is in the zone, and whether the action's
  precondition holds. The prompt being visible does **not** authorize the action.
- **Client display.** The prompt + button, shown on local prediction of zone entry.
- **Does NOT add.** Rewards, currency, unlocks, ownership, or any trusted "I did X" message.
- **Proof.** Pure tests (in-zone true/false, action rejected outside zone, unknown zone id rejected); a
  browser smoke that the prompt appears in-zone and the action only resolves on server confirmation.

### 7B — Collision / walkable-block boundaries

- **Goal.** Formalize walkable-area + obstacle collision as part of the authoritative movement step,
  with clearer block boundaries.
- **Server-owned truth.** The post-collision accepted position (already inside `predictStep`); geometry
  stays **byte-identical across blocks** so collision authority is shared and per-block identity remains
  labels/style only.
- **Client display.** Optional local collision prediction so prediction matches the server; rendering of
  boundaries.
- **Does NOT add.** Destructible terrain, locked areas tied to status/wealth, or per-block geometry
  divergence.
- **Proof.** Pure collision tests (clamp into walkable area, obstacle rejection); a test that per-block
  geometry/portals/spawns stay byte-identical while labels/style differ; a "walk into wall is corrected"
  smoke.

### 7C — Activity objectives without rewards

- **Goal.** Lightweight, **non-reward** objectives that give a reason to move and gather ("reach the
  Foundry signal node", "three players in the plaza") — pure presence/positional goals, surfaced in the
  activity feed.
- **Server-owned truth.** Objective completion, evaluated against server-validated positions/presence
  (the same authority Block Trial uses); objectives are display/atmosphere, like district events.
- **Client display.** An objective hint + completion acknowledgment in the bounded activity feed.
- **Does NOT add.** Points, currency, prizes, leaderboards, persistent score, or anything a player can
  accumulate as wealth. Completion is acknowledgment, not payout.
- **Proof.** Pure tests (objective completes only from server-validated state; no value emitted); a feed
  smoke; copy assertions — **no economy/ownership/gambling vocabulary**.

### 7D — Arcade entry polish + return-to-city flow

- **Goal.** Make portal entry and return-to-city feel deliberate and smooth (building on the existing
  server-confirmed portal + iframe interior).
- **Server-owned truth.** Portal eligibility (unchanged authority); the city DO never reads/writes arcade
  occupancy/tickets.
- **Client display.** Entry/return transitions, the interior overlay, the back-to-city affordance.
- **Does NOT add.** An authority bridge between city and arcade, postMessage trust mixing, or any
  economy hook between the two.
- **Proof.** A portal smoke (confirmed entry, rejected feedback, clean return); an arcade
  two-client/frame-contract regression proving city entry/return changed nothing in the arcade.

### 7E — Server-confirmed interaction receipts

- **Goal.** A uniform, server-authored **receipt** for an interaction (zone action, objective,
  portal) — the public-safe record that a thing happened, so the feed and other clients reflect it
  consistently.
- **Server-owned truth.** The receipt is a **server-authored event** — emitted like the existing
  `city_*` events / per-block event log, allowlist-projected outbound — and is the only trusted record;
  a client cannot mint one (a forged receipt message → `unknown_type`). The activity feed remains a
  **pure client-side projection** of that emitted event and is never itself canonical (kernel §9). This
  keeps the truth (server event) and display (feed) split explicit; the feed is not elevated to authority.
- **Client display.** Rendering the receipt in the bounded activity feed.
- **Does NOT add.** A value, balance, inventory, or transferable token inside the receipt; the receipt is
  an event record, not a credit. **A 7E receipt is never written to, derived from, or correlated with the
  arcade ticket ledger/balances** — the city DO does not read arcade ticket state (already guaranteed by
  `CityRoom` never touching `RoomRegistry`/`ArcadeRoom`), so the city-receipt and arcade-ledger
  public-safe summaries can never be merged into one reward record.
- **Proof.** Pure tests (receipt minted only on server-validated interaction; allowlist projection; forged
  inbound rejected); a feed smoke; an assertion the receipt carries no private/economic field.

### 7F — Phone / desktop multiplayer proof

- **Goal.** A repeatable, documented proof that the kernel holds across devices — phone + desktop see each
  other, move, interact, travel, and read consistent presence/feed/events (extending the production
  sign-off into a standing test).
- **Server-owned truth.** Everything above; this slice **verifies**, it does not add authority.
- **Client display.** N/A (a test/runbook, not a feature).
- **Does NOT add.** Any new capability — it is a cross-device regression/runbook.
- **Proof.** A documented multiplayer smoke/runbook (two devices, two browsers) covering movement,
  interaction zones, portal, travel, presence, and feed parity; staging-verified before any production
  consideration.

## Recommended slice order

```
7B  (collision/boundaries — foundational for zones)
7A  (interaction zones + prompts — the core new kernel surface)
7E  (server-confirmed receipts — the uniform record zones/objectives emit)
7C  (objectives without rewards — uses zones + receipts)
7D  (arcade entry/return polish — independent, can slot anywhere)
7F  (multiplayer proof — last; verifies the whole kernel)
```

7B and 7A are the load-bearing slices; 7E gives them a uniform output; 7C builds on both; 7D is
independent polish; 7F validates the lot.

**Slice classification (foundation vs. deferrable).** Not every slice carries equal bolt-on risk:

| Slice | Class | If skipped |
|---|---|---|
| 7B collision/boundaries | **Foundation** | Locks in bolt-on debt — zones/movement need it |
| 7A interaction zones | **Foundation** | The core new kernel surface; later interaction features depend on it |
| 7E server-confirmed receipts | **Foundation** | The uniform truth record zones/objectives emit |
| 7C objectives without rewards | Builds on foundation | Safely deferrable (needs 7A+7E first) |
| 7D arcade entry/return polish | Deferrable polish | Independent; no bolt-on debt if deferred |
| 7F multiplayer proof | Verification | Run last; verifies the kernel |

The three **Foundation** slices (7B, 7A, 7E) must not be skipped without incurring the exact bolt-on
debt this charter exists to prevent; 7C/7D/7F can be sequenced or deferred without that cost.

## Explicit exclusions (Phase 7 will NOT include)

```
economy            ownership            missions with violence / crime
cars / vehicles    weapons              accounts
marketplace        UGC live loading     rewards / currency / prizes / leaderboards
wanted level       theft / raids        real money / crypto / tokens
```

Any of these requires a charter ADR (`docs/PROJECT_CHARTER.md`) stating exactly how and behind which
gates — not a Phase 7 slice. UGC live loading specifically is the creator pipeline's CF-7/CF-8, not a
gameplay phase.

## Definition of done (Phase 7 overall)

- [ ] Each shipped slice has a written server-owned-truth definition and a test that the client cannot
      author the fact.
- [ ] No new reward, economy, ownership, account, or violence surface exists.
- [ ] Geometry stays byte-identical across blocks (per-block identity remains labels/style only).
- [ ] Full arcade + city regression green; Worker dry-run accounted for (byte-identical if a slice is
      client-only; an explained delta if a slice is a real Worker change).
- [ ] Public surfaces stay allowlist-projected and bounded; copy carries no economy/ownership/gambling
      vocabulary **and** no crime/wanted/theft/weapon/violence vocabulary **and** no prohibited IP names
      (GTA/APB/SimCity/RollerCoaster/Tycoon/Rockstar) — assert all three classes, not just economy.
- [ ] Cross-device multiplayer proof (7F) passes on staging before any production consideration.

*This plan is plan-only. It adds no gameplay, no Worker/DO code, no deploy, and no production change.
Phase 7 implementation begins only at the gate `AUTHORIZED: IMPLEMENT PHASE 7A`, which — per the slice
dependency analysis above — **starts with 7B** (collision/boundaries) that 7A builds on. See the handoff
section below.*

## Future gates (handoff)

All three gates below are **future, human-issued authorizations**. **None is exercised by this docs
sprint** (nothing is pushed/merged/tagged/deployed here).

```
AUTHORIZED: IMPLEMENT PHASE 7A          → begin Phase 7 kernel hardening, starting with 7B then 7A
AUTHORIZED: IMPLEMENT CF-3              → review/merge the EXISTING layered editor branch (commit 2f53645)
AUTHORIZED: PLAN HIVE VALIDATION SERVICE → begin the CF-6 service prototype design (still no live trust)
```

Recommended order:

```
1. Land the gameplay charter (this sprint).
2. CF-2 is on main; review/merge CF-3 (already committed on branch 2f53645 — it exists; do not rebuild).
3. Land CF-3's layered constrained block editor into main (review the branch).
4. Implement Phase 7: 7B collision/boundaries first, then 7A interaction zones.
5. Only then consider city-scale expansion (Phase 8+).
```
