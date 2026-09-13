# Node Hopper — bounded finishing review, 2026-09-13

## Claim under test

Twelve original, fixed-screen collection rooms support ladders, directional ropes,
node-triggered routes and a genuine campaign finish without requiring a death or teleport.
Jumpman is a room-design reference, not a source of copied maps or artwork.

## Check

`node --test tests/arcade/nodehopper.test.mjs`

Serve the repository (or the allowlisted release) at `127.0.0.1:8766`, then:
`node --test tests/arcade/nodehopper.browser.mjs`.
Optional `NH_BASE`, `CHROMIUM_PATH`, `NH_EVIDENCE` select server, browser and screenshots.

## Verdict

PASS for bounded automated acceptance: three unit tests and three browser tests.
Publication is separately evidenced by the deployed release receipt and PR comment.

## Criteria

- PASS: actual movement/physics replay clears 12 rooms, 48 nodes and 4 bridges with 7 lives.
- PASS: only collecting every node advances; idle input cannot complete a room.
- PASS: normal DOM buttons move left/right, climb up/down and jump.
- PASS: pause freezes play; seven respawns produce game over; restart restores the run.
- PASS: portrait 412×915 and landscape 915×412 have visible 44px-or-larger controls.
- PASS: keyboard A/D and Space exercised in the normal animation loop.
- PASS: independent Luna review found no blocking code/route findings.
- PASS: deterministic rope direction, dart warning/locked aim/reset, bridge-origin validation.

## Assumption register

- Verified: replay uses the runtime collision/collection rules. It sends movement, not grants.
- Verified: QA manual ticks change elapsed simulation time, not actor positions or win state.
- Verified: level renderer checked visually in desktop and emulated mobile browsers.
- Checkable but unchecked: physical Pixel performance, long sessions, alternative player routes.
- Unfalsifiable here: whether the difficulty feels right for every player.

## Credit assignment

Authored routes and traversal replace the shuffled campaign; bridge changes are caused by
specific collected nodes. The idle negative control cannot earn completion. No isolated
player study attributes enjoyment to a particular change.

## Verification gap

Not a physical-device playtest. The final added DOM-button test was self-verified after
the independent reviewer identified that earlier tests only checked button layout.
No claim of every possible route, frame-rate budget, or optimal difficulty.

## Stop/continue

Stop feature development. Publish only the allowlisted Node Hopper assets after staged
verification, then verify the same suite against the live files. No site-wide deployment or merge.

## Maturity status

The route/completion contract is defined, compact, testable, falsifiable, replayable and
comparable. Enjoyment and hardware performance remain outside that automated verdict.
