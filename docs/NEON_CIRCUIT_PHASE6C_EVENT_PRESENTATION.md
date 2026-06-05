# Neon Circuit — Phase 6C: Rich District Event Cards + Live Countdown

**Status:** implemented on `feat/neon-circuit-phase6c-event-presentation`. Builds on Phase 6B
(`1f2e2c6`). **Client + CSS only** — no new server authority.

## Goal

Now that the event schedule is server-authored (6B), make its presentation richer and mobile-polished:
a proper event **card** with active / pre-roll visual states and a **live countdown**, plus a
countdown to the next event — without adding any server authority, assets, or economy copy.

## What changed from Phase 6B

| | Phase 6B | Phase 6C |
|---|---|---|
| Banner | name + chip + summary + "Up next: X" | **card** with state accent, summary, **live "ends in m:ss"**, and "Up next: X · in m:ss" |
| Visual states | one style | `is-active` (green accent) / `is-preroll` (amber accent + amber chip) |
| Countdown | none | 1 s in-place ticker (text-only update; flips the card when a window ends) |
| Server change | yes (6B) | **none** |

## Implementation

- **`city-district-events.mjs`**: add pure `formatCountdown(ms)` → compact `m:ss` (clamped at 0,
  garbage-safe). Deterministic, unit-tested, shared by the client.
- **`city-scene.js`**: the district-event card now renders a state class (`is-active`/`is-preroll`),
  an "ends in `m:ss`" meta row, and a next-event countdown. A separate **1 s** `updateEventCountdown()`
  ticker updates only the countdown text nodes in place (no panel rebuild); when the current window's
  time reaches 0 it calls `pollDistrictEvents()` to flip the card and fire announcements. A
  `tickEventCountdown(now)` test hook drives it deterministically.
- **`city.css`**: card state accents (green/amber left border), countdown styling
  (`font-variant-numeric: tabular-nums` so the timer doesn't jitter), amber pre-roll treatment. The
  chip pulse stays gated behind `@media (prefers-reduced-motion: no-preference)` — reduced-motion users
  see a static card.

No new server message/DO/migration/route. No new assets (CSS/procedural only). No third-party library,
external script, telemetry, or `innerHTML`. `textContent` only.

## Mobile / accessibility

- The card stays inside the existing district panel (which already has a `max-width: 560px` layout
  rule) and does not overlap arcade controls, route buttons, Block Trial, or Stewardship.
- Countdown uses tabular numerals to avoid horizontal jitter; verified at a 390×844 phone viewport.
- The fast-updating countdown deliberately carries **no** `aria-live` (it would spam screen readers);
  the activity feed retains its existing `aria-live="polite"` log for meaningful announcements.

## Validation

```bash
node --test tests/arcade/city-district-events.test.mjs   # 28 pure cases (+2 Phase 6C: formatCountdown)
node --test tests/arcade/*.test.mjs                       # full suite: 564 pass
bash tests/arcade/run-city-district-events.sh             # 28 checks incl. card state + live countdown
node scripts/check-city-build-size.mjs                    # ≈0.782 / 0.212 MB gz
( cd workers/arcade && wrangler deploy --dry-run --outdir dist )   # 194.47 KiB / 42.71 KiB gz
```

## Known limitations

- The countdown ticks on the local clock; `server_time` (from the 6B snapshot) is available for future
  cross-device alignment but is not yet used to offset the displayed timer (same-origin determinism
  already keeps clients within a second).

## Non-goals (unchanged)

No new server authority, no assets/third-party UI, no telemetry, no `innerHTML`, no economy/ownership
copy, no HiveWorld bridge, no `game/*` changes, no production deploy.
