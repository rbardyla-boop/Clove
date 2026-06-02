# Neon Circuit — Phase 1e: Server-Authoritative Pulse Tap Tickets

Phase 1e makes Pulse Tap **tickets** server-authoritative. The client plays the
local reflex round, but the **server** registers each round, validates the
submitted result against strict rules, computes the ticket award, and owns the
balance. The client only displays what the server confirms.

This is a **product-track** feature. It is intentionally separate from the
HiveWorld protocol lab and does not depend on it.

## Scope

- One room (`main`), one ticketed cabinet (`pulse`) — same surface as Phase 1b/1c/1d.
- Server-issued round ids; server-validated submissions; server-computed awards.
- Ticket balance stored in the room/Durable Object, keyed by session/player id.
- Public cabinet/award state for other clients; private balance for the owner.
- Occupancy authority (Phase 1b) is **unchanged** and still gates everything.

## Non-goals (explicitly NOT in this phase)

- **No crypto, no blockchain, no token mechanics, no NFTs.**
- **No real money, no cash-out, no withdrawal.**
- **No staking, no yield, no resale, no gambling, no wagering.**
- **No HiveWorld bridge / no HiveWorld integration** (that track stays separate;
  `arcade/hiveworld-sim/` is not touched).
- **No accounts / no global inventory** — tickets are room/session scoped only.
- **No production economy** — tickets are internal arcade points, nothing more.
- No land ownership, no marketplace, no trading.

## Protocol messages

Existing Phase 1b occupancy messages are unchanged: `join_room`, `occupy_machine`,
`release_machine`, `heartbeat` → `room_state`, `machine_occupied`, `occupy_denied`,
`error`.

New in Phase 1e:

**Client → server**
| message | payload | meaning |
|---|---|---|
| `pulse_round_start` | `{ machineId }` | ask the server to register a round + issue a round id |
| `pulse_round_submit` | `{ roundId, machineId, score, accuracy, grade, hits, bestStreak, durationMs }` | submit a finished round for validation + award |
| `ticket_balance_request` | `{}` | request the authoritative balance (used on reconnect) |

**Server → client**
| message | payload | visibility |
|---|---|---|
| `pulse_round_started` | `{ roomId, roundId, machineId, startedAt, expiresAt, maxDurationMs, limits }` | owner |
| `pulse_round_accepted` | `{ roundId, machineId, awarded, balance, grade, score }` | owner |
| `pulse_round_rejected` | `{ roundId?, machineId, reason }` | owner |
| `ticket_balance` | `{ playerId, balance }` | owner (private) |
| `ticket_awarded` | `{ roomId, playerId, awarded, machineId, roundId }` | **public broadcast** (no balance) |
| `ticket_state` | `{ roomId, machineId, occupied, occupiedBy, lastScore, lastGrade, lastAwardBy, lastAwardAmount }` | **public broadcast** |

Every message carries enough identifiers (room, cabinet, session/player, round id,
server time) to be unambiguous. The submitter's identity for ticket operations is
the **socket's** joined `playerId` — never a client-supplied field.

## Authority model

- **Occupancy (Phase 1b):** the Durable Object remains the sole authority — one
  occupant per cabinet, monotonic `rev`, stale-lock timeout. Unchanged.
- **Rounds + tickets (Phase 1e):** a pure, transport-agnostic state machine,
  `workers/arcade/src/round-authority.mjs` (+ `tickets.mjs`), owns ticket balances
  and round records. The DO passes in the **current occupant** so the authority
  never duplicates or weakens occupancy. The DO is the only writer of ticket
  state; it persists to DO storage and broadcasts.
- A round is bound to: room, cabinet, occupying session, server start time, a max
  lifetime (`MAX_ROUND_MS = 90s`), and accepted scoring limits.
- The **same** authority module is reused by the local dev shim and the unit
  tests, so there is no logic drift between what is tested and what ships.

## Ticket formula (server-computed; deterministic)

```
base(grade):  S=25  A=18  B=12  C=7  D=3  F=0
scoreBonus  = min(10, floor(score / 750))
accBonus    = accuracy>=98 ? 5 : accuracy>=90 ? 3 : 0
award       = clamp(base + scoreBonus + accBonus, 0, 40)   // hard cap 40 / round
```

`score = hits*100 + bestStreak*25`. The client may show an estimate during play,
but the **awarded** value comes only from `pulse_round_accepted`. Any `tickets`
field a client includes in a submission is ignored.

## Rejection reasons

**Payload / score validation** (`tickets.validateScorePayload`):
`malformed`, `bad_grade`, `negative_score`, `score_out_of_bounds`,
`accuracy_out_of_bounds`, `duration_out_of_bounds`.

**Round / authority** (`round-authority`):
`no_identity`, `invalid_cabinet`, `not_occupant`, `unknown_round`,
`duplicate_submission`, `round_expired`, `wrong_session`, `wrong_cabinet`.

A release, a disconnect, or a stale-lock timeout expires the holder's active round
(`expirePlayerRounds`), so a later submission for it is rejected `round_expired`.

## Persistence limits

- Ticket balances + round records live in the Durable Object's `roomState`
  (`ticketState`), keyed by session/player id. **Room/session scoped only.**
- Older stored rooms are migrated on load (`ensureTicketState`).
- Fully-elapsed rounds (and their dedup entries) are pruned in the existing alarm
  (`pruneExpired`) to keep state bounded.
- Balances are retained for the room's lifetime (no eviction); there is no global
  or cross-room persistence and no account system.

## Test plan

- **A. Ticket formula** (`tests/arcade/tickets.test.mjs`): grade mapping, score
  bonus cap, accuracy bonus tiers/cap, max-payout cap, F=0, payload validation.
- **B. Round lifecycle** (`tests/arcade/round-authority.test.mjs`): start by
  occupant, non-occupant rejected, unknown cabinet, accept-once, duplicate,
  expired, wrong session, wrong cabinet.
- **C. Authority**: client-supplied tickets ignored, impossible/negative
  score/accuracy/duration rejected.
- **D. Occupancy integration**: occupant submits; non-occupant cannot exploit the
  active round; release/disconnect expires the round.
- **E. Reconnect/state**: balance persists; duplicate network frame does not
  double-award; prune keeps balances.
- **F. Two-client browser** (`tests/arcade/two-client.spec.mjs` + `run-two-client.sh`):
  see manual steps below.

Run unit tests:
```bash
node --test tests/arcade/*.test.mjs
```

## Manual validation steps (two clients)

`wrangler dev` requires Node ≥ 22; under Node 18 use the local dev shim
(`workers/arcade/dev-shim.mjs`), which reuses the production ticket authority:

```bash
# terminal 1 — protocol shim (TEST ONLY)
PORT=8787 node workers/arcade/dev-shim.mjs
# terminal 2 — static files
npx serve -p 8080 .
# open two tabs:
#   http://localhost:8080/arcade/index.html?id=alpha&ws=ws://127.0.0.1:8787/arcade/ws
#   http://localhost:8080/arcade/index.html?id=bravo&ws=ws://127.0.0.1:8787/arcade/ws
```
Or run the scripted Playwright validation:
```bash
# requires a Playwright install; set PW_REQUIRE_BASE if not project-local
bash tests/arcade/run-two-client.sh
```

Expected: A occupies → B sees busy → A plays/earns server tickets → B cannot
submit for A's cabinet → A releases → B occupies and earns its own tickets → no
console errors.

Against a real deploy (Node ≥ 22): `cd workers/arcade && npm run dev`, then point
`?ws=` at the Worker. The same protocol and assertions hold (the DO uses the same
authority module).

## Known limitations

- Mock-free but transport-limited locally: the **real Durable Object cannot be run
  here** because wrangler needs Node ≥ 22 (this box is on Node 18). The DO is
  verified by (a) esbuild bundle compile and (b) sharing its exact ticket-authority
  module with the unit tests and the dev shim used for the browser validation.
- The two-client browser test drives the ticket path through a small gated client
  hook (`?test=1`) because real rounds are 30s and a non-occupant has no game UI;
  the hook only invokes existing client request methods and never grants tickets.
- Ticket balances are not evicted within a room's lifetime.
- Single room / single ticketed cabinet, matching the current product surface.

## Next phase recommendations (NOT in scope here)

- Run the real DO under Node ≥ 22 (wrangler dev / `vitest-pool-workers`) and add
  a DO-level integration test to complement the authority unit tests.
- Optional balance eviction / TTL if rooms get long-lived.
- Additional ticketed cabinets reuse the same `round-authority` with a wider
  `TICKETED_MACHINES` set.
- Any move toward cross-session retention would require a deliberate identity
  design + security review — explicitly out of scope for 1e.
