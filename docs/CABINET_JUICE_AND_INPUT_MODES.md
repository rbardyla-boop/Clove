# Cabinet Juice + Input Modes

How starter cabinets get game feel without the server trusting anything more.
Source of truth: `arcade/creator/arcade-builder/cabinet-templates.mjs` (the closed
tables) and the generated `game.mjs` head/tail. Everything below is client-local
drawing and input interpretation inside already-gated cabinet code — no Worker/DO
change, no ticket/prize change, no new messages.

## Juice (closed visual-feel token)

| Token | What you get | Pool |
|---|---|---|
| `off` | essentials only — no flash, no particles, no shake | 0 |
| `standard` (default) | hit flash + 8-particle ring burst per scoring hit | fixed 24 |
| `vivid` | bigger pool + bounded screen shake (≤8px, 0.28s decay) | fixed 48 |

Rules baked into the generated source (unit-pinned, not conventions):
- **Reduced motion clamps to off, structurally.** `const FX = RM ? 0 : <level>` where
  `RM` reads `prefers-reduced-motion` once at module scope. Shake only ever sets at
  `FX > 1`, so it cannot fire under reduced motion.
- **No arbitrary counts.** Pool sizes come from a frozen table; the particle write is a
  ring buffer (`fi = (fi + 1) % FXN`) — bounded by construction, no growth, no
  allocations after `init()`.
- **No timers.** Effects are decay-only state advanced by the host's single rAF loop;
  closing the cabinet cancels the loop and nothing leaks.
- **Closed colors.** Effects draw only in the cabinet's accent token.

## Input modes (closed verb grammar)

| Mode | 3-second rule | Scores when |
|---|---|---|
| `tap_window` | Tap at the right moment. | press lands inside `hot()` |
| `hold_band` | Hold while the moment is right. | held during `hot()` — +1 per 0.25s |
| `release_timing` | Hold, then let go at the right moment. | release lands inside `hot()` |
| `swipe_lane` | Swipe across while the moment is right. | ≥48px horizontal press→release inside `hot()` |
| `drag_track` | Keep your pointer moving with it. | held AND moved within 0.35s, during `hot()` |

- **Every mode also accepts a plain `tap`** as a degenerate press+release — so the
  sandbox harness, keyboard Space, and any single-pointer fallback drive every cabinet.
- **Host event vocabulary:** the starter host translates pointer events into native-space
  `press` / `move` / `release` (pointer-captured, released and cleaned up on close) and
  provides keyboard fallbacks: Space = press/release, Arrow keys = a synthesized swipe.
  Listeners are removed in `close()` — no leaks across mounts.
- Modes are scored **generically over each variant's `hot()` window** — adding a mode
  never touches variant drawing code, and vice versa.

## Choosing feel for a starter

Pick the mode that matches the variant's read: continuous swells suit `hold_band`
(Beacon Climb, Arbor Bloom, Heat Balance), build-and-commit suits `release_timing`
(Ember Sync, Echo Four), travel suits `swipe_lane` (Crane Gate, Rail Sprint), pursuit
suits `drag_track` (Phase Lock), instants suit `tap_window`. Reserve `vivid` for
celebration pieces (Neon Pulse, Spire Pulse); `standard` everywhere else; `off` is for
operators who want a still cabinet — and is what every cabinet becomes under reduced
motion regardless.

## What is forbidden (unchanged, restated)

Arbitrary JS or numbers through any token (hostile values fall back through the frozen
tables — unit-proven), network/storage/eval/dynamic-import/timers in generated source
(SOURCE_FORBIDDEN sweep at every token combo), economy vocabulary anywhere, prize/
ticket fields, audio/external assets (not in this pass), unbounded arrays, pointer
capture without cleanup.

## Testing

`tests/creator/cabinet-juice-modes.test.mjs` pins all of the above (11 tests: token
resolution, RM clamp, fixed pools, no-timer/no-alloc, mode fallback, tap-degenerate,
library coverage, importer validity, forbidden sweep at every combo, copy screens,
adversarial injection). The sandbox smoke runs representative starters end-to-end;
the starter-floor smoke proves the curated six still mount, score locally, and send
zero occupy/round/ticket messages.
