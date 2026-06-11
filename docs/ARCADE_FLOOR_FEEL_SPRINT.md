# Arcade Floor Feel Sprint (local-only)

**Branch:** `feat/arcade-floor-feel-sprint` (off `main` @ eb797ea, the PR #67 merge).
**Scope:** player-facing floor polish — verb tuning, flex placement, per-block ordering,
audio-lite, mobile gesture proofs. No Worker/DO/wire/migration change (diff = 0 by
construction); CF-7 stays false; no economy surface anywhere. No ADR: no authority
boundary changed (audio is host-local behind a closed token; ordering is display-only).

## Public starter set (8 cabinets — six anchors + two flex; the other 8 stay builder-only)

| Cabinet | Role | Block | Mode | Speed/Difficulty | Juice |
|---|---|---|---|---|---|
| Crosswalk Window | anchor | downtown | tap_window | medium/standard | standard |
| Crane Gate | anchor | harbor | swipe_lane | medium/standard | standard |
| Beacon Climb | anchor | skyline | hold_band | **slow**/standard | standard |
| Ember Sync | anchor | foundry | release_timing | fast/sharp | standard |
| Phase Lock | anchor | nexus | drag_track | slow/chill | standard |
| Arbor Bloom | anchor | garden | hold_band | slow/chill | calm motion |
| Spire Pulse | flex | downtown | tap_window | slow/chill | **vivid** |
| Flash Three | flex | (central) | tap_window | fast/sharp | standard |

Flex tiles render dashed, always AFTER the six anchors, with "quick run" in their
aria-labels. The manifest validator caps the shelf at 8 and structurally rejects
economy-shaped fields; an invalid list still renders an empty shelf (fail-quiet).

## Input tuning table (`MODE_TUNING`, one closed source of feel numbers)

| Knob | Value | Why |
|---|---|---|
| `hold_cadence_s` | 0.3 | +1 per 0.3s held-hot — slower than the juice branch's 0.25 first pass (less over-scoring in 30–60s rounds) |
| `drag_cadence_s` | 0.35 | drag scores slower than hold (movement is its own difficulty) |
| `drag_move_window_s` | 0.4 | pointer must have moved this recently to count as dragging |
| `swipe_min_px` | 64 | up from 48 — fewer accidental phone swipes |
| `swipe_max_s` | 0.6 | a press→release slower than this is a hold, not a swipe |

Two behavior fixes landed with the table:
- **drag_track requires REAL movement** — a stationary press never engages (the juice
  branch allowed one banked point before the recency window expired);
- **no fraction banking** — leaving a hold/drag resets partial accrual, so pumping
  short holds can't accumulate hidden credit.

All of this is pinned by `tests/creator/mode-behavior.test.mjs` (7 tests), which
EXECUTES generated games deterministically via `data:` imports — hot/cold presses,
cadence accrual, short/slow/real swipes, stationary vs tracked drags.

## What the gesture proofs caught (the sprint's real finding)

**Beacon Climb could never score.** signal-climb at medium speed has a 0.25s hot
window — *shorter than the 0.3s hold cadence*, so hold_band was structurally
unsatisfiable on it. Found by the new phone-gesture smoke (a real held pointer on the
real floor), not by unit tests. Fix: Beacon Climb moves to slow speed (0.417s window).
Lesson recorded: **any hold_band starter needs hot-window ≥ hold cadence** — the
sprint report is the current home of that rule; promote it into a validator check if
the library grows more hold starters.

A second smoke correction: the floor's join-time HUD bootstrap (`ticket_balance_request`,
`prize_catalog_request`) is connection traffic, not starter traffic — the mobile WS-spy
now baselines after connect, exactly like the desktop one. The starter flows themselves
send zero new messages (proven on desktop AND in the gesture context).

## Per-block ordering (`?from=`)

`city-scene` appends `?from=<cityId>` to the interior target only when `getCity()`
validates it; the floor passes the raw param ONLY into `orderShelf()`, which validates
membership against the manifest's own closed `home_block` set. Anything else — hostile
strings, unknown blocks — yields the default order and never reaches the DOM (smoke
asserts both the ordering for valid blocks and the non-leak for hostile values). No
storage, no tracking, no server messages; ordering only — all 8 tiles always present.

## Audio decision: IMPLEMENTED as host-side closed audio-lite, shipped OFF

- Closed token `off | soft | arcade` (host-level, `starter-host.mjs` — NOT in generated
  cabinet code and NOT a builder/bundle param; the curated statics pass `sound: 'off'`).
- Web Audio oscillator blips only: hit blip (660Hz soft / 880→1100Hz arcade), every
  voice `stop()`-bounded at 70ms, master gain hard-capped at 0.08, context created
  ONLY inside a pointer/key gesture handler, `close()`/Leave closes the context.
- The public set ships **silent**: the smoke proves zero `AudioContext` constructions
  across a full play flow. Turning sound on for the floor is a one-line manifest-level
  operator decision later (future gate), with the safety properties already tested.

## Mobile findings

- `.st-stage` moved to `touch-action: none` — drag/swipe can no longer scroll the page
  mid-play (was `manipulation`).
- Phone gesture proofs (360×640 touch context, real pointer drives): swipe scores on
  Crane Gate, hold scores on Beacon Climb (post-fix), drag scores on Phase Lock.
- Landscape 640×360: the frame letterboxes without crop (`fits === true`) and Leave
  stays reachable.
- Existing mobile-playtest geometry checks (44px tiles, discovery-by-default,
  no-overlap, sheet fit) all still pass with 8 tiles.

## Validation (final tree)

Arcade units **725/725** · creator units **237/237** (7 new behavioral + manifest/order
updates) · starter-floor smoke **34 checks PASS** (flex, audio spy, 4 ?from= cases ×2,
3 gesture proofs, landscape, WS spies, ticketed-pulse regression) · mobile-playtest,
frame-contract, arcade-sandbox, arcade-builder, block-mood, city-district, city-loop-
mobile **PASS** · production-config PASS · size PASS · curated upload (statics ×8) ·
vocabulary + import-boundary greps CLEAN · `workers/` diff **0** · CF-7 **false**.

## Known limitations

- Gesture smokes are wall-clock retry loops (deterministic in outcome, not in timing).
- `drag_track` keyboard fallback is the synthesized-swipe arrows + Space — playable but
  not equivalent; acceptable for an optional showcase shelf.
- Sound exists but ships off — a deliberate operator gate, not a gap.

## Rollback

One revert; or empty the manifest array (empty shelf, nothing else affected); flex
starters can be removed by deleting their two entries + statics (validator keeps the
six anchors coherent).

## Next recommended branch

Operator playtest of the tuned floor on a real phone, then either: enable `soft` audio
for the public set (one-line + smoke flip), promote the hold-window ≥ cadence rule into
the manifest validator, or open the W-6 production planning gate — all separately
authorized.
