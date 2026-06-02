# HiveWorld v0.8 — Operator-Tunable Event Presentation Mirror (TODO, deferred)

> **Status:** NOT implemented in the Phase 2h product workflow. This doc specifies how a
> later, separate HiveWorld workflow should mirror Neon Circuit **Phase 2h — Operator-Tunable
> Event Presentation** into the CRDT simulator. Do **not** implement this on the product
> branch, and do **not** bridge HiveWorld into the product Worker/DO.

## Context

- Product source of truth: `feat/neon-circuit-phase2h-event-presentation` (stacked on 2g
  `5f5015e`), `docs/NEON_CIRCUIT_PHASE2H_EVENT_PRESENTATION.md`.
- Simulator parity branch to fork from: `feat/hiveworld-v0-7-room-event-upcoming` @ `9a4b5dd`
  (closes parity through Phase 2g). Suggested branch: `feat/hiveworld-v0-8-event-presentation`.
- Simulator lives only under `arcade/hiveworld-sim/` + `tests/hiveworld/`. Mirror, not a bridge.

## What to mirror

### 1. Presentation config model (pure, validated)

Port the config model from `workers/arcade/src/room-events.mjs` into the sim's
`core/phase1/room-events.mjs`, tick-clocked:

- `DEFAULT_EVENT_PRESENTATION` (preroll_lead_ticks, countdown_refresh_ticks (or ms — the sim
  has no live UI clock, so this is a passthrough hint), show_next_event, show_featured_chip).
- `PRESENTATION_BOUNDS`, `resolveEventPresentation(overrides)` (validate + clamp + freeze),
  `eventPresentationFromConfig(simConfig)` (the sim has a ctx/config object rather than env —
  read the knobs from there), `publicPresentation(config)`.

### 2. Config-threaded pre-roll

Thread the config into `deriveRoomEventTransitions(prev, roomId, observeTick, config)` (pre-roll
uses `config.preroll_lead_ticks`) and `roomEventPublic` / `roomEventListPayload` /
`attachRoomEvents` (add `event_upcoming` honoring the lead + a public `presentation` block).
Defaults must reproduce v0.7 behaviour so existing tests stay green.

### 3. Reducer + fold

The `room_event_transition_check` reducer should read the presentation config from the sim's
ctx/config (the analog of env) and pass it to `deriveRoomEventTransitions`. Prove a wider
operator lead makes the pre-roll fire earlier in a deterministic scenario.

### 4. Scenario

Add `eventPresentationShowcase` (or parameterize `roomEventPrerollShowcase`): run with a custom
pre-roll lead and assert the `upcoming` fires at the configured tick; assert the public
`presentation` block is surfaced + carries no private/economy data.

### 5. Privacy + validation tests

Mirror the unit tests: validation/clamping, boolean coercion, frozen config, config-threaded
pre-roll, public `presentation` block public-safety. (The live `m:ss` countdown is a client-only
concern with no simulator analog — note it as out of scope for the sim.)

## Guardrails

- Keep the product and simulator branches separate; never import HiveWorld into the product
  Worker/DO, and never touch `arcade/hiveworld-sim/` from a product branch.
- No economy changes, no rewards, no multipliers — mirror the display-only boundary.
- Keep the existing simulator tests green (202 at v0.7); add the v0.8 presentation tests.

## Acceptance (when the v0.8 workflow runs)

- Sim presentation config parity-equivalent to product `resolveEventPresentation` (validated/clamped).
- Config-threaded pre-roll lead changes when `upcoming` fires; public `presentation` surfaced.
- Deterministic showcase converges; fingerprint stable; no private fields.
- All sim tests + UI smoke green; product + game untouched; local-only commit.
