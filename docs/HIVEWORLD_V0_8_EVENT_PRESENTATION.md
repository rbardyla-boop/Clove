# HiveWorld v0.8 — Operator-Tunable Event Presentation Mirror

Status: **IMPLEMENTED** on `feat/hiveworld-v0-8-event-presentation` (from v0.7
`feat/hiveworld-v0-7-room-event-upcoming` @ `9a4b5dd`). Mirrors product **Phase 2h —
Operator-Tunable Event Presentation** (`feat/neon-circuit-phase2h-event-presentation`
@ `6367bea`, `docs/NEON_CIRCUIT_PHASE2H_EVENT_PRESENTATION.md`) into the CRDT simulator.
This implements the product-branch `docs/HIVEWORLD_V0_8_EVENT_PRESENTATION_TODO.md`.

The simulator is a **mirror, not a bridge** — it never imports or talks to the product
Worker/DO, and the product never imports the simulator. Local-only; no push/PR/merge.

## Relationship to Product Phase 2h

Phase 2h made the event system's presentation operator-tunable (validated config from
server env) + added a live `m:ss` floor countdown. v0.8 mirrors the **config** on the
tick clock; the live countdown is a client-only concern with no simulator analog
(noted out of scope), surfaced for payload parity only.

## What changed from v0.7

- `core/phase1/room-events.mjs`:
  - `DEFAULT_EVENT_PRESENTATION` (tick-based: `preroll_lead_ticks` = `PREROLL_LEAD_TICKS`,
    `countdown_refresh_ms` = 1000 client hint, `show_next_event`, `show_featured_chip`) +
    `PRESENTATION_BOUNDS`.
  - `resolveEventPresentation(overrides)` — pure, validates + clamps numeric values,
    coerces booleans, returns a **frozen** config; any bad/missing value → default.
  - `eventPresentationFromCtx(ctx)` — reads `ctx.eventPresentation` (the analog of the
    product DO env) with the same validation.
  - `publicPresentation(config)` — the public-safe display block.
  - threaded an optional `config` into `deriveRoomEventTransitions` /
    `roomEventPublic` / `roomEventListPayload` / `attachRoomEvents` (defaults reproduce
    v0.7, so existing tests stay green); the pre-roll uses `config.preroll_lead_ticks`;
    the payloads carry a public `presentation` block.
- `core/reducers/arcade.mjs`: `room_event_transition_check(state, ev, ctx)` now resolves
  the presentation config from `ctx` (`eventPresentationFromCtx`) and passes it to
  `deriveRoomEventTransitions` — so a scenario's operator lead drives the pre-roll.
- `core/state-util.mjs`: `DEFAULT_CTX` documents the `eventPresentation: null` knob.

## Operator config (via sim ctx)

A scenario opts in with `new HiveSimulator({ ctx: { eventPresentation: { … } } })`. The
sim's `applyEvent(state, ev, ctx)` already threads `ctx` to every reducer, so the
presentation config flows ctx → reducer → `deriveRoomEventTransitions`. Absent → defaults.

| knob | default | bounds |
|------|---------|--------|
| `preroll_lead_ticks` | 2 | 1 … window−1 |
| `countdown_refresh_ms` | 1000 | 250 … 60000 (client hint; no sim live UI) |
| `show_next_event` | true | bool |
| `show_featured_chip` | true | bool |

## Scenario

`eventPresentationShowcase` — runs with a WIDER operator pre-roll lead (5 ticks) via the
sim ctx, then observes 4 ticks before window 4: under the **default** 2-tick lead nothing
fires yet, but under the operator's 5-tick lead the pre-roll DOES fire (feed: `started` +
`upcoming`). Proves the presentation config changes display behaviour only, with no
economy/authority effect. `finalConverged = true`; `canonicalFingerprint` stable across
reruns; it appears in the testbed scenario runner (`sel-p1-scenario`).

## Privacy / display-only

The presentation config + the public `presentation` block carry no actor/agent ids,
balances, ledger, inventory, tokens, or signatures. A presentation value never changes a
ticket formula, reward, fold authority, or economy — proven by the validation + the
"default vs wider lead" feed comparison.

## Tests

`tests/hiveworld/phase2-event-presentation.test.mjs` — 11 tests: defaults, validation/
clamping, boolean coercion, frozen config, `eventPresentationFromCtx`, config-threaded
pre-roll (pure AND through the `room_event_transition_check` reducer via ctx), the
`event_upcoming` payload flag honoring the lead, the public `presentation` block +
privacy, and the `eventPresentationShowcase` scenario. Total simulator suite: **213**
(202 baseline + 11 new). The function-signature additions default to the v0.7 config, so
the existing tests are untouched.

## Known limitations

- Operator config is supplied via the sim ctx (the analog of the product's env) and is
  static per run — no live ops surface.
- The product's live `m:ss` client countdown has no simulator analog (the sim is a proof
  harness with no live UI clock); `countdown_refresh_ms` is surfaced for payload parity only.
- No reward / multiplier / payout effects (display-only).
- Product and simulator remain separate (mirror, not a bridge).

## Non-goals

- no product Worker/DO bridge; no HiveWorld V1
- no event rewards / ticket multipliers / payout changes
- no real money / crypto / blockchain / token / NFT
- no cash-out / staking / yield / resale / gambling / wagering
- no AR / geospatial / land ownership; no global accounts / cross-room economy

## Next mirror / product step

Simulator parity is now **CLOSED through product Phase 2h**. The next product sprint
(operator direction) would be **Phase 2i — Live Ops Surface / Per-Room Presentation
Overrides** (display-only); its simulator mirror would become HiveWorld v0.9. Not started here.
