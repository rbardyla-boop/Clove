# Neon Circuit — Phase 1i: Cabinet Frame Contract

## Summary

Phase 1i makes **original game size a contract**, not a preference. Every arcade
cabinet game now declares its native logical dimensions, aspect ratio, scale mode,
input area and clone policy in one place, and runs inside a standard **cabinet
frame** that uniformly scales the native box to fit the viewport — centered, with
letterbox/pillarbox bars, **never stretched and never cropped**. A cloned or
imported game that silently changes its native size, aspect ratio or coordinate
system now fails tests until the change is made deliberately (contract + docs +
tests updated together).

This is a platform-hardening sprint: no gameplay rewrite, no server authority
change, no economy change. The Worker/Durable-Object bundle is byte-identical to
Phase 1h (the frame is entirely client-side).

## Branch / base

- Branch: `feat/neon-circuit-phase1i-cabinet-frame-contract`
- Base: `feat/neon-circuit-phase1h-challenge-board` (`b210c86`) — **stacked**.

PR #4 (Phase 1e), Phase 1f, 1g and 1h were all still open and unmerged during this
workflow (this workflow authorized no merges), so Phase 1i is a deliberate stacked
continuation and cannot be opened cleanly against `main` until the upstream
product branches land. See the stack note at the end.

## Scope

- A central, pure frame-contract module (`arcade/cabinet-frame-contract.mjs`):
  contracts/registry, scale modes, validation, clone guard, uniform-scale math,
  and pure coordinate mapping — Node- and browser-importable.
- A browser frame runtime (`arcade/cabinet-frame.js`) + styles
  (`arcade/cabinet-frame.css`) that measures the viewport, uniformly scales the
  native box, centers it, letterboxes/pillarboxes, exposes CSS vars + debug data,
  and maps input back into native coordinates.
- Pulse Tap and Signal Sprint wrapped in the frame at a declared native size.
- A `?frameDebug=1` visual debug overlay.
- Unit + browser tests; multi-viewport frame validation; full product regression.

## Non-goals (explicitly NOT in this phase)

- no gameplay rewrite
- no server authority changes
- no economy expansion
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

## Why original game size must be preserved

Cloned/imported HTML/JS games each ship an authored coordinate system and layout
tuned for a specific canvas/box. If a host arcade resizes that box non-uniformly
(stretch one axis), crops it, or silently swaps the coordinate system, gameplay
math, hitboxes, input regions and readability all break — quietly. Making the
native size a contract means any such change is caught by tests immediately
instead of shipping a subtly-broken game.

## Native game size vs displayed size

- **Native size**: the logical box the game is authored against (Pulse Tap and
  Signal Sprint: **360 × 640**, portrait 9:16). All gameplay/layout is relative to
  this box.
- **Displayed size**: native size × a single uniform `scale` chosen to fit the
  cabinet viewport. The displayed box is centered; the leftover space becomes
  letterbox (top/bottom) or pillarbox (left/right) bars.

The contract exposes both to CSS (`--game-native-width/height`, `--game-scale`,
`--game-frame-width/height`, `--game-display-width/height`, `--game-letterbox-x/y`).

## Aspect ratio policy

A single uniform scale is applied to BOTH axes, so the displayed aspect ratio
always equals the native aspect ratio. Validation rejects any contract whose
declared `aspect_ratio` does not equal `native_width / native_height`.

## Scaling policy

`scale_mode` (default **`fit-contain`**): `scale = min(frameW/nativeW, frameH/nativeH)`,
clamped by `allow_upscale` / `max_upscale` (2×) / `min_scale` (0.25×), never
negative. Supported modes: `native`, `fit-contain`, `fit-width`, `fit-height`.
Forbidden modes (`stretch`, `crop`, `fill-distort`, `fill`) fail validation.
`fit-contain` guarantees the display fits inside the frame (no crop).

## Clone / import policy

Each contract declares `original_width/height`, `current_width/height`,
`clone_policy: "preserve_original_size"`, `allow_visual_skinning`,
`allow_logic_resize` and a `migrated` flag. The clone guard requires
`current_* === original_*` unless `migrated: true`. So:

> A cloned/imported game preserves its original canvas/layout size unless a
> deliberate migration updates the contract, the docs, and the tests together.

If a game changes native size without the migration flag, `validateContract`
(and the contract unit test) fail.

## Current game contracts

| game_id | cabinet_id | native | aspect | scale_mode | clone_policy |
|---------|------------|--------|--------|-----------|--------------|
| `pulse_tap` | `pulse-tap-01` | 360×640 | 9:16 | fit-contain | preserve_original_size |
| `signal_sprint` | `signal-sprint-01` | 360×640 | 9:16 | fit-contain | preserve_original_size |

`allow_visual_skinning: true`, `allow_logic_resize: false` for both. Both games'
panels were converted to fill the native box (flex column; viewport-relative
`vh/vw` sizing removed) so their size is deterministic; gameplay math and input
handlers are unchanged.

## Debug overlay

`?frameDebug=1` shows a non-interactive overlay (game id, native size, frame size,
scale, aspect, letterbox dimensions, live pointer→native coordinate). It is off by
default, never affects gameplay, and never touches server state. A JS hook,
`window.__cabinetFrames[gameId].debug()`, is exposed only under `?frameDebug=1` or
`?test=1` for automated validation.

## Coordinate mapping

The runtime maps between screen and native space:
`screenToNativePoint(x, y)` and `nativeToScreenPoint(x, y)`, using the stage's
on-screen rect and the applied scale. Pure inverses (`screenToNative` /
`nativeToScreen`) are unit-tested for round-trip stability.

## Tests

Unit (`node --test tests/arcade/*.test.mjs`, 117 → **135** total):
`cabinet-frame.test.mjs` — A. contracts (existence, positive-int dims, aspect
match, default fit-contain, forbidden modes rejected, clone-policy default,
size-change-without-migration fails); B. scale math (fit-contain preserves aspect,
landscape pillarbox / portrait letterbox, no crop across viewports, no negative
scale, max-upscale + min-scale respected, fit-width/height, native coordinate
round-trip).

Browser (`tests/arcade/frame-contract.spec.mjs`, `run-frame-contract.sh`) — C/D/E
across 390×844, 844×390, 768×1024, 1280×720 for both games: frame data
attributes + native size, aspect preserved (no stretch), no crop, debug data
matches the pure frame math, scale within bounds, HUD/chrome outside the gameplay
safe area, native coordinate round-trip; plus round start/submit + ticket award
inside the frame.

Regression (`tests/arcade/two-client.spec.mjs`, group F) — full Pulse/Signal/Prize
Counter/Challenge Board/achievement/event-feed/reconnect flow, unchanged.

## Manual validation

- Runtime: Node v22.22.3; Wrangler 4.95.0; `wrangler dev` (local workerd).
- Unit: **135/135**. Worker/DO bundle clean (61.74 KiB, identical to Phase 1h).
- Dev-shim: frame contract validation PASS (all viewports), two-client regression
  **48/48 PASS**.
- Real Worker/Durable Object: two-client regression **PASS** and frame contract
  **PASS**; zero console/page errors (external font-CDN / transient network noise
  filtered as non-app errors).

## Known limitations

- Native size is fixed at 360×640 for the current portrait games; a different
  native aspect would need its own contract (and a migration if it changes an
  existing game).
- The frame is a modal overlay (one game at a time); it supersedes the floor HUD
  while open, so "HUD overlap" is prevented structurally rather than by reserving
  on-screen HUD space.
- `min_scale` is a hard floor: on an extremely small frame it can produce a
  display larger than the frame (a documented limitation); normal device
  viewports are far above this floor and never crop.
- Frame scaling is DOM `transform: scale()`; a future canvas/WebGL game may also
  want backing-store/DPR handling layered on top of this contract.

## Next phase options

- A landscape native contract + a game authored for it.
- Per-game `safe_area` insets honored by the frame (e.g. notches).
- A canvas/WebGL frame adapter (DPR-aware) on top of the same contract.
- Import pipeline that auto-generates a contract stub for a cloned game and fails
  until native dimensions are confirmed.

## Stack note

```
main
└── PR #4 / feat/neon-circuit-phase1e-server-tickets   (OPEN — not merged)
        └── feat/neon-circuit-phase1f-arcade-loop       (local, stacked, not merged)
                └── feat/neon-circuit-phase1g-signal-sprint  (local, stacked, not merged)
                        └── feat/neon-circuit-phase1h-challenge-board  (local, stacked, not merged)
                                └── feat/neon-circuit-phase1i-cabinet-frame-contract  (this branch)
```

Phase 1i is a deliberate stacked continuation. The product arcade path remains
entirely separate from HiveWorld.
