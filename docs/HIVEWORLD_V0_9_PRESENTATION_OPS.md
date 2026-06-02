# HiveWorld v0.9 — Live-Ops Per-Room Presentation Overrides Mirror

Status: **IMPLEMENTED** on `feat/hiveworld-v0-9-presentation-ops` (from v0.8
`feat/hiveworld-v0-8-event-presentation` @ `1838cd3`). Mirrors product **Phase 2i —
Live-Ops Per-Room Presentation Overrides** (`feat/neon-circuit-phase2i-presentation-ops`
@ `3a1dba7`, `docs/NEON_CIRCUIT_PHASE2I_PRESENTATION_OPS.md`) into the CRDT simulator.
This implements the product-branch `docs/HIVEWORLD_V0_9_PRESENTATION_OPS_TODO.md`.

The simulator is a **mirror, not a bridge** — it never imports or talks to the product
Worker/DO, and the product never imports the simulator. Local-only; no push/PR/merge.

## Relationship to Product Phase 2i

Phase 2i added a live-ops surface for **per-room** presentation overrides on top of the
Phase 2h env config (effective = env base ⊕ override), set/previewed/cleared by an admin
at runtime. v0.9 mirrors the **override state + semantics** on the tick clock: a room
carries a display-only override on top of the ctx base, applied via a room-authored fabric
event. The admin preview UI + live `m:ss` countdown are client-only concerns with no
simulator analog (noted out of scope).

## What changed from v0.8

- `core/phase1/room-events.mjs`:
  - `PRESENTATION_KEYS` — the four tunable fields an override may carry.
  - `sanitizeEventPresentationOverride(override)` — pure; keeps only the set + valid keys,
    each clamped; **drops invalid values** (so a bad key falls through to the base rather
    than persisting a default); empty/garbage → `{}` ("no override").
  - `mergeEventPresentation(base, override)` — pure; `effective = resolve({ …base,
    …sanitized })`, missing keys fall through to `base`, result re-validated + frozen.
  - `attachRoomEvents(list, nowTick, config)` is now **resolver-capable**: `config` may be
    a `(roomId) => config` resolver (each room reflects its EFFECTIVE config; the top-level
    `presentation` stays the base) or a plain config object (backward-compatible with the
    v0.5–v0.8 callers). Each room entry now also carries its own `presentation` block.
- `core/phase1/round-authority.mjs`: `createArcade(generation)` adds a per-room
  `presentationOverride: null` to the room substate — **reset-safe** (a `room_reset`
  installs a fresh partition, clearing any override back to the base).
- `core/reducers/arcade.mjs`:
  - new `room_presentation_override_set(state, ev)` reducer — room-authored
    (`actor_id === room_id`, like `room_event_transition_check`); sanitizes the payload
    override and stores it (empty → clears to `null`). Rejects a non-authoring actor
    (`not_authority`) / unknown room (`unknown_room`). Display-only.
  - `room_event_transition_check` now resolves `effective = mergeEventPresentation(
    eventPresentationFromCtx(ctx), sub.presentationOverride)` and threads that into
    `deriveRoomEventTransitions` — so a room's own override drives its pre-roll.
- `core/events.mjs` + `core/phase1/sideband-map.mjs`: register
  `room_presentation_override_set` on the `weather` sideband (fabric admission + mapping).
- `core/reducers/index.mjs`: register the new reducer.
- `core/room.mjs`: `setPresentationOverride(override, tick)` helper (room-authored emit;
  the live-ops analog of the product set/clear ops — pass `{}` to clear).

## Override model (per-room)

The override lives in the room's OWN arcade partition (like `eventTracker`), consistent
with the room-authored fabric-event model — each room owns its display config. The
effective config a room presents = `mergeEventPresentation(ctxBase, sub.presentationOverride)`.
Convergence is free from the canonical fold: the override is read from the same partition
the fold owns, and `room_presentation_override_set` events apply in canonical order.

| knob | default | bounds |
|------|---------|--------|
| `preroll_lead_ticks` | 2 | 1 … window−1 |
| `countdown_refresh_ms` | 1000 | 250 … 60000 (client hint; no sim live UI) |
| `show_next_event` | true | bool |
| `show_featured_chip` | true | bool |

## Scenario

`presentationOverrideShowcase` — two rooms observe the SAME pre-roll tick (4 out from
window 4). `neon-training` carries a display-only override widening its pre-roll lead to 5
ticks; `main-floor` stays on the base 2-tick lead. Only `neon-training` fires
`room_event_upcoming` — `main-floor` announces nothing at that tick. Proves a per-room
override changes that room's DISPLAY behaviour ONLY (and in isolation), with no
economy/authority/schedule effect. `finalConverged = true`; `canonicalFingerprint` stable
across reruns; it appears in the testbed scenario runner.

## Privacy / display-only

The override partial + the effective `presentation` block carry no actor/agent ids,
balances, ledger, inventory, tokens, or signatures. An override never changes a ticket
formula, reward, fold authority, or the deterministic schedule — proven by the
schedule-invariance test (an override yields identical transition types to the base) and
the per-room isolation test.

## Tests

`tests/hiveworld/phase2-presentation-overrides.test.mjs` — 18 tests: `PRESENTATION_KEYS`;
sanitize (set+valid only, drop invalid, clamp, empty→{}); merge (fall-through, non-default
base, frozen+clamped, garbage→base); the resolver-capable `attachRoomEvents` (per-room
effective vs base top-level; backward-compat); the `room_presentation_override_set` reducer
(set / clear / authority gate / unknown room); per-room isolation through the
`room_event_transition_check` reducer; schedule-invariance; privacy; and the
`presentationOverrideShowcase` scenario (+ fingerprint stability). Total simulator suite:
**231** (213 baseline + 18 new). The additive payload/field changes default to the v0.8
behaviour, so the existing tests are untouched.

## Known limitations

- An override is set via a room-authored fabric event (the analog of the product's admin
  set/clear ops); the admin preview UI, both-gate token, and live `m:ss` countdown are
  client/server concerns with no simulator analog (noted out of scope).
- The override lives in the room's partition (room-authored), whereas the product stores it
  in the RoomRegistry coordinator — the same effective semantics, modeled where the sim's
  authority lives.
- No reward / multiplier / payout effects (display-only).
- Product and simulator remain separate (mirror, not a bridge).

## Non-goals

- no product Worker/DO bridge; no HiveWorld V1
- no event rewards / ticket multipliers / payout changes; no schedule shifts
- no per-user / per-request tuning (room-scoped operator config only)
- no real money / crypto / blockchain / token / NFT
- no cash-out / staking / yield / resale / gambling / wagering
- no AR / geospatial / land ownership; no global accounts / cross-room economy

## Next mirror / product step

Simulator parity is now **CLOSED through product Phase 2i**. Per operator direction, the
next product step is a **stack landing / release-compression workflow** (the stack is now
deep enough that merge risk outweighs feature velocity), not more feature work — so there
is no immediate v0.10 mirror queued.
