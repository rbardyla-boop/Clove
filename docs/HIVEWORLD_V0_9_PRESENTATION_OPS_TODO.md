# HiveWorld v0.9 — Live-Ops Per-Room Presentation Overrides Mirror (TODO, deferred)

> **Status:** NOT implemented in the Phase 2i product workflow. This doc specifies how a
> later, separate HiveWorld workflow should mirror Neon Circuit **Phase 2i — Live-Ops Per-Room
> Presentation Overrides** into the CRDT simulator. Do **not** implement this on the product
> branch, and do **not** bridge HiveWorld into the product Worker/DO.

## Context

- Product source of truth: `feat/neon-circuit-phase2i-presentation-ops` (stacked on 2h
  `6367bea`), `docs/NEON_CIRCUIT_PHASE2I_PRESENTATION_OPS.md`.
- Simulator parity branch to fork from: `feat/hiveworld-v0-8-event-presentation` @ `1838cd3`
  (closes parity through Phase 2h). Suggested branch: `feat/hiveworld-v0-9-presentation-ops`.
- Simulator lives only under `arcade/hiveworld-sim/` + `tests/hiveworld/`. Mirror, not a bridge.

## What to mirror

### 1. Override model (pure, validated)

Port the override helpers from `workers/arcade/src/room-events.mjs` into the sim's
`core/phase1/room-events.mjs`:

- `PRESENTATION_KEYS`, `sanitizeEventPresentationOverride(override)` (keep only set + valid
  keys, clamp, **drop invalid** so they fall through to the base; empty/garbage → `{}`),
  `mergeEventPresentation(base, override)` (effective = re-validated `{ ...base, ...sanitized }`,
  frozen). These are clock-agnostic — they reuse the v0.8 `resolveEventPresentation` /
  `PRESENTATION_BOUNDS`, so they port almost verbatim (tick-lead vs ms-lead is just the key).

### 2. Per-room override store in the arcade partition

The v0.8 mirror reads presentation from `ctx` (the env analog). For v0.9, add a **per-room
override map** to the arcade partition state (the same place `statusOverrides` lives), so
`effective(roomId) = mergeEventPresentation(eventPresentationFromCtx(ctx), overrides[roomId])`.
Keep it reset-safe via `createArcade(generation)` (same pattern as the existing trackers).

### 3. Fabric event + reducer (the live-ops surface)

Add a room-authored fabric event — e.g. `room_presentation_override_set` (weather sideband,
like the other room-authored events) — carrying `{ roomId, override }`. Its reducer:

- `sanitizeEventPresentationOverride` the payload; if empty, **delete** the room's override;
  else store it. Validate/monotonic-noop/dedup consistent with the other reducers.
- Convergence is FREE from the canonical fold (same property the v0.6 transition reducer has).

Thread the per-room effective config into `deriveRoomEventTransitions` / `roomEventListPayload`
/ `attachRoomEvents` so each room reflects its effective config and the top-level stays the base
(the resolver-capable `attachRoomEvents` already exists from the v0.8 port — make it accept a
`(roomId) => config` resolver if it doesn't yet).

### 4. Scenario

Add `presentationOverrideShowcase`: set a per-room override (wider pre-roll lead +
`show_featured_chip: false`) on one room, assert that room's `upcoming` fires earlier at the
configured tick while a **different** room at the same tick does not (per-room isolation =
display-only proof); clear the override and assert the room returns to base. Assert the public
`presentation` block carries no private/economy data.

### 5. Privacy + validation tests

Mirror the unit tests: sanitize (set+valid only, drop invalid, clamp), merge (fall-through,
non-default base, frozen), per-room effective resolution, schedule-invariance (an override
never shifts transitions), and public-safety. (The live `m:ss` countdown + lobby panel are
client-only concerns with no simulator analog — note them as out of scope for the sim.)

## Guardrails

- Keep the product and simulator branches separate; never import HiveWorld into the product
  Worker/DO, and never touch `arcade/hiveworld-sim/` from a product branch.
- No economy changes, no rewards, no multipliers, no schedule shifts — mirror the display-only
  boundary; an override is presentation-only.
- Keep the existing simulator tests green (213 at v0.8); add the v0.9 override tests.

## Acceptance (when the v0.9 workflow runs)

- Sim override model parity-equivalent to product `sanitize`/`merge` (validated, clamp, drop-invalid).
- Per-room effective config resolution; a wider override lead fires `upcoming` earlier on that
  room only; clearing reverts to base.
- Deterministic showcase converges; fingerprint stable; no private fields.
- All sim tests + UI smoke green; product + game untouched; local-only commit.
