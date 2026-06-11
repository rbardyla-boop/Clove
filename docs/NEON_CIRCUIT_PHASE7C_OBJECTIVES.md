# Phase 7C — Activity Objectives Without Rewards

**Status:** BUILT (local-only; no deploy, no push). Branch `feat/neon-circuit-phase7c-objectives`
(stacked on the floor-feel sprint — the two share `city-scene.js`; rebases clean once PR #68 merges).

## What it is

Lightweight, NON-REWARD movement/gathering objectives, per the Phase 7 plan §7C: a closed
two-step cycle per block — **reach_node** ("reach the beacon by the arcade walk") and
**gather_at_zone** ("two together on the plaza") — surfaced as one quiet hint line in the
district panel and acknowledged through the existing server-authored world log. Completion is
acknowledgment, not payout: no points, balances, prizes, ranks, streaks, persistence, or
anything accumulable (the projection tests pin the exact payload key sets and sweep them for
value-shaped vocabulary).

## Authority model (the binding kernel rule, applied)

- **Server-owned truth:** objective state and completion. `stepObjectives()` (pure,
  [city-objectives.mjs](../arcade/city/city-objectives.mjs), shared verbatim by CityRoom and
  the dev shim) evaluates ONLY the canonical player positions the server already authors —
  evaluation runs after **accepted** moves and on the alarm tick, exactly the Block Trial
  pattern.
- **No inbound message exists.** The client can only RECEIVE `city_objective_state` (hint) and
  the `city_objective_completed` world event. A forged completion attempt falls into the
  existing `unknown_type` rejection — smoke-proven (forge → `unknown_type`, zero acks, hint
  unchanged).
- **Projection:** the acknowledgment rides the existing append-only world log; its payload
  fields (`objective_id`, `kind`, `ack`, `count`) were added to the event-payload allowlist,
  so `sanitizeEventPayload` drops anything else by construction. The completion is actor-less —
  a block fact, never personal credit (per-player attribution stays deferred, ADR-009).
- **Ephemeral by design:** per-block state is three numbers (`index`, `activated_at`,
  `cooldown_until`), never persisted, never per-player. A DO restart restarts the cycle;
  nothing accumulable exists to lose.
- **Anti-flood:** one acknowledgment per activation (completion advances the cycle and arms a
  45s cooldown); the hint broadcast fires only when the active objective actually changes.

## Client display

One amber `.dist-objective` hint line (closed copy, textContent, no counter/progress styling)
plus the world-log acknowledgment label. The client never evaluates, claims, or predicts
completion.

## Geometry

Static config on PROVEN-WALKABLE ground (unit-tested against the server's own `isWalkable`):
the reach node sits on the portal-corridor plaza the existing smokes traverse; the gather zone
is the spawn plaza. Identical across blocks (blocks share canonical geometry by design).

## Validation

- `tests/arcade/city-objectives.test.mjs` — 8 pure tests: closed cycle/ids/copy screens,
  walkable geometry, reach/gather authority, garbage-position safety, exactly-once + cooldown,
  exact-allowlist projections with a value-vocabulary sweep, fail-safe unknowns, ephemeral
  state shape.
- `tests/arcade/run-city-objectives.sh` — 13-check smoke: hint render, **forged completion →
  `unknown_type` with zero effect**, real walk → server-authored actor-less ack, no
  value-shaped fields, single-ack cooldown, vocabulary-clean panel, zero storage.
- Full regression + Worker dry-run recorded in the 7C handoff.

## Honest limitations

- The **gather** objective has pure-test coverage only. A live two-client gather smoke would
  first have to complete the reach objective and then sit through the 45s cooldown — a
  wall-clock wait we refuse to fake with a test-only cooldown override (that would be an
  eval-shaped knob on a production module). If a staging multiplayer smoke is wanted, the
  honest instrument is a dev-gated clock override in the SHIM only, considered separately.
- Objectives restart on DO eviction (deliberate — ephemerality is the anti-accumulation
  property, not a bug).
- One cycle of two objectives. More variety (per-block flavored hints through the existing
  display layers) is deferrable polish.
