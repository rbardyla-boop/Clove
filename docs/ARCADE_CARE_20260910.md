# Arcade care pass — 10 September 2026

## Claim under test

Operator's Deck's first tab is a playable, input-dependent 3D routing puzzle;
the deck explains all 15 goals and supports touch input. Standalone Mind Machine
keeps its ball, goal and instructions visible in portrait layouts.

## Scope

- Replace the deck's unconditional three-second win with 20 deterministic circuits.
- Turn arrows → test pulse → correct a stopped route → connect goal → next circuit.
- Source, goal and walls cannot be rotated; reset/tab leave cannot grant stale wins.
- Add goal/control briefs, touch keys, sound and calm-effects preferences.
- Repair standalone perspective framing, foreground fog and mobile overlay spacing.
- Preserve both games' existing palettes and other tabs' rules.
- No changes to Echo Bloom, the catalog, Paper Firm, multiplayer, accounts or data.

## Replayable checks

```sh
npm ci
npm ci --prefix arcade-studio
npm ci --prefix workers/arcade
npx playwright install --with-deps chromium
npm run test:unit
node --test tests/static/ds-i1-release-boundary.test.mjs
npm --prefix workers/arcade run check
node scripts/build-arcade-care-release.mjs
workers/arcade/node_modules/.bin/wrangler deploy --dry-run --config workers/arcade-care/wrangler.jsonc
```

Browser checks can target the actual staged bundle or production without altering game state:

```sh
ARCADE_CARE_ORIGIN=https://clovelearn.io node --test tests/arcade/arcade-care-browser.test.mjs
ARCADE_MIND_ORIGIN=https://clovelearn.io node --test tests/arcade/standalone-mind-polish.test.mjs
node scripts/verify-arcade-care-campaign.cjs https://clovelearn.io
```

The browser solver reads the current board and operates its actual buttons. It
does not call a win function, mutate game state or submit QA analytics.

## Verdict and criteria

Local focused checks and an independent Luna review passed:

| Criterion | Evidence |
| --- | --- |
| No-input start fails | 20 circuits × 40 seeds; browser checks no streak awarded |
| Boards are solvable | Independent flood search solves 800 boards through rotate API |
| Win is earned | Browser rotates real buttons, traces goal, checks streak and next level |
| No stale reward | Leave tab during solved trace; return without credit; retest to earn win |
| Clear, reachable controls | All 15 panels render goals/controls; phone button and input checks |
| Portrait framing | Actual source camera-fit tests, 360/390px browser checks, screenshot inspection |
| Fog remains readable | Actual integration executed against camera double at four aspect ratios |
| Calm effects preserve rules | Reduced-motion win has identical reward without particles |

## Assumption register / verification gap

- Verified: Chrome desktop and emulated phone rendering, actual input, source rules,
  current same-origin runtime assets and narrow release boundaries.
- Checkable but unchecked: physical Pixel/iOS ergonomics, the standalone physics
  campaign's full 20-level completion, cross-browser audio behavior and actual
  device GPU frame times. The deck's entire 20-circuit campaign was browser-tested.
- Not established: that every arcade title is now equally fun. This is the first
  bounded care pass, not a blanket quality claim.

## Credit assignment

The baseline first tab awarded a win after a timer without routing input. The
replacement rejects that same input and succeeds only after arrow changes. Camera
framing uses the actual viewport aspect; fog normalization removes a separate
portrait-only visibility regression. Other game logic is unchanged.

## Deep polish — 13 September 2026

- The circuit board now has a layered 3D tray, raised rotors, direction-matched
  conductors, contact rings and a bounded pulse-trail pool. Calm effects retain
  the same routing speed and outcomes; `?immFx=0` isolates the base rendering.
- Touch keys repeat while held and release on cancellation, blur, hidden page
  or tab change. Goals and control briefs cover all 15 existing deck tabs.
- Standalone objectives follow the current level. A fallen or genuinely stalled
  ball gives a deliberate edit/retry choice without destroying construction.
  Retry runs the preserved layout. Moving constructions have no time deadline.
- Phone overlays use measured layout; instructions and inventory clear each
  other and the real Feedback launcher. Level 20 has an explicit campaign end.
- Local full suite: 1,345 passing tests. Release-boundary tests: 3 passing.
  Worker dry-run passes. These are automated evidence, not a physical-phone claim.
- Full browser campaign at seed 20260913: circuits 1–20 earned through real
  buttons, streak 1–20, `ALL 20 CIRCUITS CONNECTED`, then a new set at circuit 1;
  no uncaught errors. Observed 129–178 draws and 2,568–3,432 triangles across
  those boards; these counts are not a measured FPS claim.

This pass does not redesign the other 14 deck mechanics or establish that all
arcade games are equally polished. It improves this bounded pair of surfaces.

## Release boundary

The static asset allowlist is `scripts/build-arcade-care-release.mjs`. It requires
committed runtime inputs, rejects unexpected staged files, and writes file hashes.
Only `/game/Arcade` and `/game/theincrediblemindmachine` plus their descendants are
routed by `workers/arcade-care/wrangler.jsonc`. No whole-site upload or merge is needed.
`X-Arcade-Care-Source` identifies the exact committed runtime release.

The existing vendor and analytics URLs remain served by the existing host. Copies
in the staged bundle allow isolated browser verification, not new public routes.
The catalog is deliberately excluded because live has newer entries than this base.

For an initial-release rollback, remove only this worker's four exact routes to
restore the untouched previous host. For subsequent releases use Wrangler's
version rollback. Never change the site's other route mappings.

## Stop / maturity

Stop at verified publication of this bounded pass. The mechanics are defined,
compact, tested, falsifiable, replayable and comparable to the baseline. Wider
fun/retention claims remain open and should come from play, not further architecture.
