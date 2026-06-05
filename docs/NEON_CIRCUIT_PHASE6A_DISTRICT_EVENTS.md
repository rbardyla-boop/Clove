# Neon Circuit — Phase 6A: Scheduled District Events + Live Public Announcements

**Status:** implemented local-only on `feat/neon-circuit-phase6a-district-events`; **not pushed,
merged, tagged, or deployed.** Client-only (no Worker/DO/migration/route change).

## Goal

The city is live in production and signed off by real cross-device multiplayer (see
[PRODUCTION_ROLLOUT_PLAN.md](PRODUCTION_ROLLOUT_PLAN.md)). Phase 5 made the district *functional*;
Phase 6A adds the first post-launch "world feels alive" feature — a **district pulse**: a current
event, a next event, and live public announcements that feed the District Activity panel and a small
event banner. It is strictly **display / atmosphere**.

User-visible examples:

```text
Downtown Signal Surge is active.
Harbor Quiet Window starts soon.
Skyline Focus ended.
Up next: Harbor Arcade Hour.
```

## Production baseline this builds on

- Production Pages/static (`wild-hat-6257` custom domain) + DO Worker `neon-arcade-mesh-production`
  (ArcadeRoom, RoomRegistry, CityRoom, CityRegistry; migrations v1→v4); four narrow `/arcade/...*`
  routes. **LAUNCHED & SIGNED OFF 2026-06-05.**
- The baseline-lock commit (`chore: lock production launch baseline`) recorded the signoff + the
  narrow routes as config-as-code in `workers/arcade/wrangler.toml`, and untracked the local
  `.wrangler/` account-id cache. Phase 6A branches from there.

## What changed from Phase 5E

Phase 5E derives a **reactive** District Activity feed from server-authored presence/route facts.
Phase 6A adds a **proactive, scheduled** layer on top, with no new server surface:

| | Phase 5E | Phase 6A |
|---|---|---|
| Source | server presence deltas / route results | deterministic clock + static manifest |
| New server surface | none | none |
| Feed types added | — | `district_event_{upcoming,active,ended}` (additive) |
| New UI | DISTRICT ACTIVITY sub-section | district-event banner (current + next) |

## Event schedule model

Pure module: [`arcade/city/city-district-events.mjs`](../arcade/city/city-district-events.mjs).

- Time is bucketed into fixed **`WINDOW_MS` = 5 minutes** windows: `index = floor(now / WINDOW_MS)`.
- Each window has one **type** and one **focus block**, chosen by deterministic rotation on the
  window index (`EVENT_TYPES[index % 5]`, `CITY_IDS[index % 3]`), so **every client computes the same
  current/next event and the same stable `event_id`**.
- Types (display/atmosphere only): `district_signal_surge`, `district_quiet_window`,
  `district_route_warmup`, `district_arcade_hour`, `district_block_focus`.
- `currentDistrictEvent(now)` / `nextDistrictEvent(now)` / `districtEventWindow(now)` expose the
  active event, the upcoming event, time remaining, and a `preroll` flag (true within
  `PREROLL_LEAD_MS` = 1 min of the next window).

Event shape (every field is allowlisted; only a static block name is interpolated):

```js
{
  schema_version: 1,
  event_id: "district:window:<index>:<type>:<cityId>",
  district_id: "neon-district-01",
  city_id: "downtown-01",
  type: "district_signal_surge",
  status: "upcoming" | "active" | "ended",
  starts_at, ends_at,
  label: "Downtown Signal Surge",
  summary: "Downtown is the focus block for this district window.",
  public_safe: true
}
```

## Announcement model

`deriveDistrictAnnouncements(now, announcedKeys)` returns the **new** announcements due at `now`,
skipping anything already announced (the caller owns the key set):

- **active** — the current window (announced once on entry).
- **upcoming** — the next window, but only once `now` is within the pre-roll lead.
- **ended** — the immediately-previous window, **only if its `active` was already witnessed** (so a
  cold load / reconnect never surfaces a stale "ended").

Properties: deduped by `event_id#status`, bounded (`ANNOUNCE_MAX`), input set never mutated, and
reconnect/reload recompute from the current time without restoring local history as canonical.
Announcements are projected into the existing feed via `activityForDistrictEvent` — the **same
allowlist choke point** as every other activity item.

## Client UI

- A small, non-dominant **district-event banner** above the DISTRICT ACTIVITY feed: current event
  label + a `now` chip, a one-line summary, and an `Up next:` line (highlighted amber in pre-roll).
- `textContent` only (no `innerHTML`); CSS-only visuals; the chip pulse is gated behind
  `@media (prefers-reduced-motion: no-preference)`; verified usable at a 390×844 phone viewport; does
  not overlap arcade controls or the Block Trial / Stewardship panels.
- Polled on (re)connect and on a 20 s tick so the banner advances and pre-roll/active/ended
  announcements surface as windows turn over.

## Public-safety policy

- Every event/announcement is built through a field allowlist; the only interpolated value is a
  block's **static display name** (city config). No player ids, socket/connection/account ids,
  balances, ledger, inventory, admin, or tokens can reach the wire-safe object.
- Labels/summaries are observational. A unit test scans 120 windows × 3 statuses and the browser
  smoke scans the rendered panel for forbidden economy/ownership/gambling copy and private fields.

## Authority model

- The schedule is **non-authoritative display**: nothing canonical reads it back; CityRoom /
  CityRegistry still own all presence/route/identity truth. The schedule never gates movement,
  routing, admission, rewards, or any server decision.

## Why no economy / no rewards

Phase 6A is explicitly display/atmosphere. It does **not** change rewards, tickets, Host Rank,
Stewardship eligibility, Block Trial rules, prize values, or add any multiplier/boost — there is no
economy in the system and Phase 6A introduces none. "Events", "activity", "rank", and "players" are
used observationally, never as incentive/payout language.

## Validation commands

```bash
# unit (pure)
node --test tests/arcade/city-district-events.test.mjs        # 17 pure cases
node --test tests/arcade/*.test.mjs                            # full suite: 553 pass

# browser smoke (city dev shim; set PW_REQUIRE_BASE to a Playwright install if not local)
bash tests/arcade/run-city-district-events.sh                 # 20 checks: PASS
bash tests/arcade/run-city-district-activity.sh               # 5E regression: PASS

# config / size / Worker dry-run (client-only ⇒ byte-identical)
node tests/arcade/check-production-config.mjs                  # PASS
node scripts/check-city-build-size.mjs                        # within GTA-80/34 (≈0.773/0.209 MB gz)
( cd workers/arcade && wrangler deploy --dry-run --outdir dist )  # 187.10 KiB / 40.74 KiB gz (unchanged)
```

## Known limitations

- The schedule is deterministic on wall-clock time only — it does not react to live presence (a
  "Signal Surge" can name a quiet block). That is intentional for Phase 6A (no new server surface);
  presence-aware scheduling is a Phase 6B candidate and would likely need server authorship.
- The banner countdown is coarse (20 s tick), not a live per-second timer, to avoid brittle timing.
- Announcement history is local display state (resets on reload); the current window is deduped so a
  reload does not re-spam.

## Deferred to Phase 6B (not started)

- Presence-aware or operator-tunable district event schedules (would likely be server-authored).
- Per-block event variety / richer event cards.
- Any of these remains gated and must stay display-only + non-economic.

## Explicit non-goals (unchanged from the launch charter)

No deploy/staging/login/credentials. No accounts/OAuth/global identity. No money/crypto/blockchain/
token/NFT/staking/yield/resale/cash-out/gambling/wagering/marketplace/paid-hosting/transferable goods.
No ownership/rent/income/payout/land/block sale/block claim. No cross-block economy or inventory. No
change to arcade ticket/prize/challenge/Host Rank/Stewardship/Block Trial mechanics. No HiveWorld
bridge, no `arcade/hiveworld-sim/` or unrelated `game/*` changes. No new DO/migration/route/server
message. Not pushed, merged, tagged, or deployed.
```
