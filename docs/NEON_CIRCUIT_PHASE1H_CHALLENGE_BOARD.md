# Neon Circuit — Phase 1h: Challenge Board, Achievements & Arcade Event Feed

## Summary

Phase 1h adds a server-authoritative **Challenge Board**, an **achievement badge**
system, and a safe public **Arcade Event Feed** — a reason to keep playing with no
money mechanics. The validated retention loop:

```
play Pulse Tap / Signal Sprint
  → earn server tickets
  → complete a server-tracked challenge
  → unlock a session-bound achievement badge
  → equip the badge through the existing cosmetic system
  → a public-safe event appears in the arcade feed
  → Prize Counter and ledger still work
```

Challenge progress is driven ONLY by authoritative server events (accepted rounds,
ticket awards, redemptions). Clients can never force progress, claim before
completion, re-claim a one-shot reward, supply a reward amount, or grant a badge.

## Branch / base

- Branch: `feat/neon-circuit-phase1h-challenge-board`
- Base: `feat/neon-circuit-phase1g-signal-sprint` (`6d6cf38`) — **stacked**.

PR #4 (Phase 1e), Phase 1f and Phase 1g were all still open and unmerged during
this workflow (no standalone merge-authorization lines were present), so Phase 1h
is a deliberate stacked continuation and cannot be opened cleanly against `main`
until PR #4, Phase 1f and Phase 1g land. See the stack note at the end.

## Scope

Included:

- Server-authoritative challenge catalog (`challenges.mjs`).
- Per-player/session challenge progress under room authority (in the shared
  ticket state, so it persists in the Durable Object and survives reconnect).
- Achievement badges (`achievements.mjs`) that REUSE the Phase 1f inventory and
  the existing cosmetic equip path (no second inventory system).
- Bounded, public-safe Arcade Event Feed (`events.mjs`).
- Challenge Board UI (`challenge-board.js` / `.css`) with challenges, achievements
  and the live feed.
- New protocol messages, server-side completion checks, and reward claims.
- New unit tests (catalog, progress, claim, achievements, feed, integration) and
  an extended two-client browser validation.

## Non-goals (explicitly NOT in this phase)

- no real money
- no crypto
- no blockchain
- no token/NFT mechanics
- no cash-out
- no staking/yield/resale
- no gambling/wagering
- no HiveWorld bridge
- no AR/geospatial layer
- no land ownership
- no production account inventory
- no external value
- no transferable goods

Tickets are internal, room/session-scoped arcade points; badges are session-bound
cosmetics with no cash value and no transfer path.

## Challenge catalog

`workers/arcade/src/challenges.mjs` — enabled challenges (plus a disabled
`marathon-soon` placeholder to prove disabled challenges are excluded):

| challenge_id | criteria | reward |
|--------------|----------|--------|
| `pulse-rookie` | 1 Pulse Tap round | badge `pulse-rookie` |
| `first-signal` | 1 Signal Sprint round | +5 arcade tickets |
| `two-cabinet-tour` | a Pulse Tap **and** a Signal Sprint round (same session) | badge `circuit-tourist` |
| `signal-clean-run` | a Signal Sprint round with ≤ 3 noise hits | badge `clean-signal` |
| `first-redemption` | redeem any Prize Counter item | badge `counter-regular` |
| `ticket-starter` | earn ≥ 25 arcade tickets (gameplay) this session | badge `ticket-starter` |

Rewards are internal-only: each is an `{ achievement_id, ticket_bonus }` pair
(badge grant and/or a small, server-computed ticket award). `ticket-starter`
counts only tickets earned from gameplay rounds, never reward bonuses, so there is
no self-reinforcing loop.

## Challenge progress model

Per player, the server keeps session counters in the shared ticket state:

```
challengeStats[playerId] = { pulseRounds, signalRounds, signalCleanRounds, redemptions, ticketsEarned }
challengeProgress[playerId][challengeId] = { progress, target, completed, completed_at, reward_claimed, reward_granted }
```

`recordRoundAccepted` and `recordRedemption` bump the counters from authoritative
events and re-evaluate every challenge, returning the set that JUST completed (for
`challenge_completed` + a public feed event). Completion is sticky.

## Achievement badge model

`workers/arcade/src/achievements.mjs`. Each achievement maps to a `badge`-slot
cosmetic (`badge-<id>`). `grantAchievement` is idempotent and writes BOTH:

- `state.achievements[playerId][achievementId]` (the unlock record), and
- `state.inventory[playerId][badgeCosmeticId]` (an equip-compatible entitlement,
  same shape the Prize Counter uses).

`equipCosmetic` now derives the slot from the **owned inventory entitlement**, so
an achievement badge equips through the exact same path as a Prize Counter
cosmetic — ownership is checked first, so a non-owner can never equip one.

## Arcade event feed

`workers/arcade/src/events.mjs`. A bounded (`MAX_EVENTS = 50`) room-wide feed of
PUBLIC-SAFE events. Each entry is a plain summary string with a monotonic
`logical_time`; it never carries a private balance, ledger detail, hidden
inventory, or `redemption_id`. Emitted for: ticket awards, challenge completions,
achievement unlocks, cosmetic equips, and prize redemptions.

## Protocol messages

Client → server:

- `challenge_catalog_request`
- `challenge_progress_request`
- `challenge_reward_claim` (`{ challengeId }`)
- `achievement_state_request`
- `arcade_event_feed_request`

Server → client:

- `challenge_catalog` (public)
- `challenge_progress` (owner-only)
- `challenge_completed` (owner-only signal)
- `challenge_rewarded` (owner-only)
- `challenge_rejected` (owner-only)
- `achievement_state` (owner-only)
- `achievement_unlocked` (owner-only)
- `arcade_event_feed` (public, bounded)
- `arcade_event` (public broadcast)

Phase 1e/1f/1g messages are unchanged and fully backwards-compatible.

## Server authority model

On an accepted Pulse Tap / Signal Sprint round (already validated by
`round-authority.mjs`): tickets awarded → ledger entry → `recordRoundAccepted`
updates progress → any newly-completed challenges emit `challenge_completed` +
public `arcade_event`; a public ticket-award event is also appended.

On an accepted prize redemption: tickets spent → inventory + ledger updated →
`recordRedemption` updates progress → completions emitted; a public redemption
event is appended.

On `challenge_reward_claim`: the server validates the challenge exists + is enabled
+ completed + not already claimed, then grants the badge (idempotent) and/or a
server-computed ticket bonus (with a `challenge_reward` ledger entry), marks it
claimed, and emits a public `achievement_unlocked` event when a new badge is
granted. On equip, a public `cosmetic_equip` event is appended.

## Privacy model

- Public (broadcast): room occupancy, ticket-award summaries, cosmetic state,
  the arcade event feed, achievement-unlock summaries.
- Owner-only (never sent to others): ticket balance, ledger, full inventory,
  challenge progress, achievement state, reward-claim controls.

Event summaries reference the actor's already-public room id and contain no
private balance/ledger/redemption data.

## Rejection reasons

| reason | when |
|--------|------|
| `malformed` | missing/empty `challengeId` |
| `no_identity` | request before `join_room` |
| `unknown_challenge` | no such challenge |
| `challenge_disabled` | challenge not enabled |
| `not_completed` | claim before completion |
| `already_claimed` | second claim of a one-shot reward |

Client-supplied reward amounts / badge ownership are ignored entirely.

## Test plan

Unit (`node --test tests/arcade/*.test.mjs`, 81 → **117** total):

- `challenges.test.mjs` — catalog determinism, internal-only rewards, progress per
  metric, sticky completion, claim grants badge / server-computed ticket bonus,
  incomplete/duplicate/unknown/disabled claims rejected, client reward ignored.
- `achievements.test.mjs` — grant creates inventory badge, idempotent, equip via
  existing path, non-owner cannot equip, public state safe.
- `event-feed.test.mjs` — ordering + monotonic logical_time, public_safe, bounded,
  unique ids.
- `challenge-integration.test.mjs` — full play→complete→claim→equip chain,
  cross-player isolation, reconnect persistence (`ensureTicketState` round-trip),
  no client-forced completion.

Two-client browser (`tests/arcade/two-client.spec.mjs`, group G appended).

## Manual validation

- Runtime: Node v22.22.3; Wrangler 4.95.0; `wrangler dev` (local workerd).
- Real Worker/Durable-Object two-client validation: **PASS**, zero console/page
  errors. Dev-shim two-client validation: **48/48 PASS**.
- Validated flow: A plays both cabinets → Two Cabinet Tour completes → A opens the
  Challenge Board, claims the reward (Circuit Tourist badge) and equips it → B
  sees A's public badge and the unlock in the feed → B cannot claim A's reward and
  sees none of A's private state → A reconnects and the board state (completed +
  claimed + equipped badge) is restored.

## Known limitations

- Challenge progress, achievements, inventory, balances and the event feed are all
  **room/session-scoped** to the single persistent `main` room Durable Object —
  not a production account inventory or external economy.
- The event feed is bounded to the last 50 events and lives in room state; it is
  not a durable audit log.
- Achievement badges all use the single `badge` equip slot (equipping a new badge
  replaces the previous one), matching the Phase 1f cosmetic model.
- The Challenge Board renders a fixed catalog from the server; the floor still
  uses a fixed set of powered cabinet tiles (catalog confirms status).

## Next phase options

- Repeatable / daily challenges with reset windows.
- Data-drive floor cabinet tiles fully from the catalog.
- Additional achievement slots / badge tiers.
- A compact on-floor "latest event" ticker fed by `arcade_event`.

## Stack note

```
main
└── PR #4 / feat/neon-circuit-phase1e-server-tickets   (OPEN — not merged)
        └── feat/neon-circuit-phase1f-arcade-loop       (local, stacked, not merged)
                └── feat/neon-circuit-phase1g-signal-sprint  (local, stacked, not merged)
                        └── feat/neon-circuit-phase1h-challenge-board  (this branch)
```

Phase 1h is a deliberate stacked continuation. The product arcade path remains
entirely separate from HiveWorld.
