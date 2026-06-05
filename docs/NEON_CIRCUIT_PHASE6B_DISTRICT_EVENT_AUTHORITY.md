# Neon Circuit — Phase 6B: Server-Authored / Operator-Tunable District Events

**Status:** implemented on `feat/neon-circuit-phase6b-district-event-authority`. Builds on Phase 6A
(`a4dec5d`). Real Worker change (server now authors the snapshot); no new DO / migration / route.

## Goal

Turn Phase 6A's client-derived display schedule into a **server-authored, public-safe event
snapshot** carried in the existing `city_blocks` payload, while preserving the same non-economic
behavior. The schedule also becomes **operator-tunable** via env, with defaults that reproduce 6A.

## What changed from Phase 6A

| | Phase 6A | Phase 6B |
|---|---|---|
| Schedule source | client-derived only | **server-authored** snapshot in `city_blocks`; client adopts the config |
| Operator control | none | env: `DISTRICT_EVENT_{ENABLED,WINDOW_MS,SHOW_NEXT}` (clamped) |
| Worker change | none | CityRoom + dev-shim attach `event` snapshot |
| New DO / migration / route | none | none |
| Sync model | each client computes locally | server publishes config + snapshot; client runs the **same** pure schedule with the server's config |

## Architecture

The schedule stays a pure, deterministic function of the clock (`city-district-events.mjs`). Phase 6B
adds a **config layer**:

- `resolveDistrictEventConfig(env)` reads `DISTRICT_EVENT_ENABLED` / `DISTRICT_EVENT_WINDOW_MS` /
  `DISTRICT_EVENT_SHOW_NEXT`, clamps the window to `DISTRICT_EVENT_BOUNDS` (1 min … 1 hour), and
  falls back to the 6A defaults for anything absent/invalid. Never mutates input.
- `districtEventSnapshot(now, config)` builds the public-safe snapshot:

```js
{
  schema_version: 1,
  enabled: true,
  window_ms: 300000,
  show_next: true,
  server_time: <server clock ms>,   // lets clients align countdowns to the server
  current: { …allowlisted event… } | null,
  next:    { …allowlisted event… } | null
}
```

- **Server** (`workers/arcade/src/city-room.ts` + `workers/arcade/city-dev-shim.mjs`): both
  `city_blocks` send sites now include `event: districtEventSnapshot(now, resolveDistrictEventConfig(env))`.
  The CityRoom reads config from `this.env`; the dev-shim from `process.env` — exact DO parity.
- **Client** (`arcade/city/city-scene.js`): on `city_blocks`, `adoptServerEventSnapshot(m.event)`
  stores the server config and recomputes. Because server and client run the **same** pure schedule
  with the **same** config, current/next stay in sync without a per-transition push. If the snapshot
  is absent (old server), the client falls back to the 6A defaults. If `enabled:false`, the banner is
  hidden; if `show_next:false`, the "Up next" line is suppressed.

### Why no new push cadence

District events turn over on a deterministic time schedule. Publishing the **config** (window size)
plus a snapshot lets every client compute the live current/next from the shared pure module — so a
window flip needs no server message. This avoids a new DO alarm / push path (lower risk, no migration).

## Authority model

- The server is authoritative for the schedule **config** and publishes the snapshot; the client only
  displays. Clients cannot author canonical district facts. CityRoom / CityRegistry still own all
  presence / route / identity truth. The schedule remains **non-authoritative display** — nothing
  canonical reads it back; it gates no movement, routing, admission, or reward.

## Why no economy / no rewards

Unchanged from 6A: display/atmosphere only. No rewards, multipliers, Host Rank, Stewardship, or Block
Trial changes. Operator config only tunes window size / visibility — never incentives.

## Operator configuration (optional)

All optional; absent → 6A defaults. Set per-environment via `wrangler` vars (never secrets):

```text
DISTRICT_EVENT_ENABLED   = "true" | "false"     # default true
DISTRICT_EVENT_WINDOW_MS = "300000"             # clamped to 60000 … 3600000; default 300000
DISTRICT_EVENT_SHOW_NEXT = "true" | "false"     # default true
```

Not added to `wrangler.toml` (defaults are safe and self-documenting here); set them only if an
operator wants to retune. No admin UI, no dashboard mutation, no secret required.

## Validation

```bash
node --test tests/arcade/city-district-events.test.mjs   # 26 pure cases (17 + 9 Phase 6B)
node --test tests/arcade/*.test.mjs                       # full suite: 562 pass
bash tests/arcade/run-city-district-events.sh             # 23 checks incl. server-snapshot path
( cd workers/arcade && wrangler deploy --dry-run --outdir dist )   # 194.47 KiB / 42.71 KiB gz
node scripts/check-city-build-size.mjs                    # ≈0.779 / 0.212 MB gz
```

## Known limitations

- The schedule is still wall-clock-only (no presence awareness) — intentional.
- The Worker bundle grew (~187→194 KiB) because the events module is now imported server-side; this
  is the cost of server authorship and is expected (6B is a real Worker change, not byte-identical).

## Non-goals (unchanged)

No economy/ownership/accounts/marketplace/paid-hosting/rewards/multipliers; no new DO/migration/route;
no client→server authority path; no HiveWorld bridge; no `game/*` changes; no production deploy.
