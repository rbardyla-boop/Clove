# Neon Circuit — Phase 1g: Signal Sprint (Second Ticketed Cabinet)

## Summary

Phase 1g adds a **second ticketed arcade cabinet — Signal Sprint** — to prove the
Neon Circuit arcade system is not hardcoded around Pulse Tap. The round/ticket
engine, occupancy authority, ledger and Prize Counter are now genuinely
multi-cabinet: a player can earn tickets at either cabinet into one shared
room/session balance, and redeem prizes against the combined total.

The new product loop:

```
choose cabinet → occupy cabinet → play cabinet-specific round → server validates round
  → tickets awarded → ledger records award → Prize Counter redeems combined balance
```

## Branch / base

- Branch: `feat/neon-circuit-phase1g-signal-sprint`
- Base: `feat/neon-circuit-phase1f-arcade-loop` (`95c128b`) — **stacked** on the
  still-open Phase 1f branch (which is itself stacked on PR #4 / Phase 1e). PR #4
  was not merged in this workflow (no merge authorization present), so Phase 1g
  could not be opened cleanly against `main` yet and is a deliberate stacked
  continuation. See the stack note at the end.

## Scope

Included:

- Signal Sprint cabinet promoted to **live / ticket-enabled** in the catalog.
- Generalized round authority via a small ruleset registry (`pulse_tap`,
  `signal_sprint`), resolved server-side from the catalog by machine id.
- Bounded Signal Sprint result schema + deterministic server ticket formula.
- Signal Sprint client mini-game (keyboard + touch, ~25s lane runner).
- Multi-cabinet occupancy in the Durable Object + dev shim (one occupant per
  machine, independent per cabinet, migration-safe for older single-cabinet rooms).
- Shared ledger + balance across cabinets; `cabinet_type` on award ledger entries.
- New unit tests (catalog, round authority, ticket formula, multi-cabinet) and an
  extended two-client browser validation.

## Non-goals (explicitly NOT in this phase)

- no real money
- no crypto
- no blockchain
- no token/NFT mechanics
- no cash-out
- no staking/yield/resale
- no gambling/wagering
- no prize cash value or transferable goods
- no HiveWorld bridge
- no AR/geospatial layer
- no land ownership / world-space leasing
- no production account inventory (balances/inventory remain room/session-scoped)
- no global accounts, login/auth providers
- no unrelated `game/*` changes

Tickets are internal, room/session-scoped arcade points only.

## Cabinet catalog changes

`workers/arcade/src/catalog.mjs` — the `signal-sprint-01` coming-soon placeholder
was promoted to an active cabinet:

| field | value |
|-------|-------|
| `cabinet_id` | `signal-sprint-01` |
| `machine_id` | `signal` |
| `display_name` | `Signal Sprint` |
| `cabinet_type` | `signal_sprint` |
| `zone_id` | `cabinet_row` |
| `status` | `live` |
| `ticket_enabled` | `true` |
| `ruleset_version` | `signal-sprint/1` |

Two helpers were added: `getCabinetByMachineId(machineId)` and
`ticketedMachineIds()` (the set of occupiable machines, derived from the catalog).

> **Naming note.** The brief suggested `status: active` and
> `ruleset_version: signal-sprint-v1`. To stay consistent with the existing
> codebase conventions — `isPlayableCabinet()` gates on `status === 'live'`, and
> Pulse Tap uses `ruleset_version: 'pulse-tap/1'` — Signal Sprint uses
> `status: 'live'` and `ruleset_version: 'signal-sprint/1'`. The cabinet is fully
> active and ticketed; only the literal token values differ from the brief.

## Round authority changes

`workers/arcade/src/round-authority.mjs` was generalized **without changing Pulse
Tap behaviour or its ticket formula** (byte-equivalent):

- A `RULESETS` registry keyed by `cabinet_type` provides each cabinet's validator,
  ticket formula, round lifetime and the start-time limits block. `pulse_tap`
  delegates to the original `./tickets.mjs` functions verbatim.
- The cabinet type / ruleset / payout are resolved **server-side** from the
  catalog by machine id — a client never selects its own validator or payout.
- Each round record now carries `cabinetId`, `cabinetType` and `rulesetVersion`.
- `submitRound` selects the validator + formula from the **round's** recorded
  cabinet type, so a client cannot submit a Signal Sprint result against a Pulse
  Tap round (or vice-versa) to pick a more generous formula.

Rejection reasons enforced by the server:

| reason | when |
|--------|------|
| `invalid_cabinet` | unknown / coming-soon / non-ticketed machine |
| `not_occupant` | starting/submitting without holding the cabinet |
| `unknown_round` | no such round id |
| `duplicate_submission` | round already submitted |
| `round_expired` | round status expired, or submit after `expiresAt` |
| `wrong_session` | submitter is not the round owner |
| `wrong_cabinet` | payload machine id ≠ round machine id |
| `wrong_cabinet_type` | labelled cabinet type ≠ round cabinet type |
| `wrong_ruleset` | labelled ruleset version ≠ round ruleset version |
| `malformed` / `bad_grade` / `negative_*` / `*_out_of_bounds` | schema/bounds failures |

## Signal Sprint gameplay

`arcade/signal-sprint-game.js` + `arcade/signal-sprint-game.css`. A ~25-second
lane runner: the rider holds a lane; pulses (collect) and static/noise (avoid)
scroll toward a collection band at the bottom.

- Controls: `← →` / `A` `D` (desktop), on-screen pads + tap left/right half of the
  stage (mobile). `touch-action: none` keeps steering crisp on touch.
- HUD: time, pulses, streak, noise, tickets.
- Reduced-motion respected; server-confirmed award + clear rejected state; a
  duplicate-submit guard (the server also rejects duplicates).
- The module sends **no** economy messages — it only reports the finished round
  to the room client, which forwards it for server validation.

## Ticket formula (server-authoritative)

`workers/arcade/src/signal-sprint.mjs`. Inputs are validated against
`SIGNAL_LIMITS` first (impossible / negative / out-of-bounds → rejected).

```
base[grade]:   S=22  A=16  B=11  C=6  D=3  F=0
distance bonus: min(8, floor(distance / 250))
streak bonus:   max_streak >= 25 → +5 ; >= 12 → +3 ; else 0
noise penalty:  -min(5, floor(noise_hits / 3))
award = clamp(0, 35, base + distance_bonus + streak_bonus - noise_penalty)
```

The client may estimate score/tickets, but the server response is final; any
client-supplied ticket count is ignored.

## Protocol messages

New, parallel to the Pulse Tap messages (Phase 1e messages are unchanged and
fully backwards-compatible):

Client → server:

- `signal_sprint_round_start`
- `signal_sprint_round_submit` (carries `cabinetType` + `rulesetVersion` labels)

Server → client:

- `signal_sprint_round_started`
- `signal_sprint_round_accepted`
- `signal_sprint_round_rejected`

The Durable Object and dev shim route both cabinets through one shared
round-start / round-submit handler; only the message-type names differ, so the
two cabinets cannot diverge in authority.

`occupy_machine` / `release_machine` / `room_state` are now multi-machine: the
room advertises one occupancy machine per ticketed cabinet (`pulse`, `signal`),
each with independent `occupiedBy` + `rev`.

## Ledger integration

Signal Sprint awards create normal `tickets_awarded` ledger entries. Entries now
include a `cabinet_type` field (`pulse_tap` / `signal_sprint`); `source` and
`cabinet_id` remain the machine id (`pulse` / `signal`), consistent with the
existing Pulse Tap entries. Balance is shared across cabinets within the same
room/session, so the Prize Counter redeems against the combined total and shows
activity from both cabinets.

## Two-client validation (browser)

The two-client browser spec (`tests/arcade/two-client.spec.mjs`,
`run-two-client.sh`) was extended with a Signal Sprint + multi-cabinet section:

1. Signal Sprint renders as an active/powered cabinet.
2. A occupies Signal Sprint **while** B still holds Pulse Tap (independent
   occupancy per cabinet).
3. B sees Signal Sprint busy and cannot start/submit A's Signal Sprint round.
4. A plays a valid Signal Sprint round → server-computed tickets land in the
   **shared** balance (10 + 24 = 34); the ticket HUD reflects it.
5. The ledger records the Signal Sprint award (`source: signal`,
   `cabinet_type: signal_sprint`) **and** still has the Pulse Tap award.
6. A releases Signal Sprint; B sees it free; B's public view still leaks no
   private balance/ledger.
7. No console / page errors.

## Known limitations

- Inventory, ledger and balances remain **room/session-scoped** (one persistent
  `main` room Durable Object). This is not a production account inventory or an
  external economy.
- The arcade floor renders a fixed set of powered tiles (`pulse`, `signal`) plus
  flavour-only coming-soon tiles; the live catalog confirms cabinet status but the
  floor does not yet fully data-drive tile creation from the catalog.
- The Signal Sprint client grade is computed locally for display; the server
  validates bounds and computes the payout from grade/distance/streak/noise (it
  does not recompute the grade from raw inputs — same trust model as Pulse Tap).

## Next phase options

- Data-drive the floor's cabinet tiles entirely from `cabinet_catalog`.
- A third cabinet type to exercise the ruleset registry further.
- Per-cabinet leaderboards from `lastPublic` (still privacy-safe, room-scoped).
- Promote `circuit-match-01` from its coming-soon placeholder.

## Stack note

```
main
└── PR #4 / feat/neon-circuit-phase1e-server-tickets   (OPEN — not merged)
        └── feat/neon-circuit-phase1f-arcade-loop       (local, stacked, not merged)
                └── feat/neon-circuit-phase1g-signal-sprint  (this branch)
```

Phase 1g is a deliberate stacked continuation on Phase 1f. It cannot be opened as
a clean PR against `main` until PR #4 and Phase 1f are merged. The product arcade
path remains entirely separate from HiveWorld.
