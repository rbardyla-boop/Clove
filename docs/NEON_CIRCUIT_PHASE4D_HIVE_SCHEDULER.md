<!-- Follow-up: Phase 4E derives a non-cash Host Rank from these scheduler-reviewed events —
see docs/NEON_CIRCUIT_PHASE4E_HOST_RANK.md. -->

# Neon Circuit — Phase 4D: Hive Scheduler (non-authoritative city pressure)

**Status:** implemented, local-only (branch `feat/neon-circuit-phase4d-hive-scheduler`, off the Phase 4C
tip — `dfc7031` is an ancestor; branched from the current clean tip `30dfb49`).
**Goal:** add the first **Hive Scheduler** — a deterministic, subordinate layer that READS recent
server-authored city world events and produces **bounded, display-only city pressure** + optional
server-authored scheduler events. It is an atmosphere/pressure layer, not a god process.

Builds on [NEON_CIRCUIT_PHASE4C_WORLD_EVENT_LOG.md](NEON_CIRCUIT_PHASE4C_WORLD_EVENT_LOG.md).
Core rule unchanged: **players send intent, the server owns truth.**

> Note: `docs/PROJECT_CHARTER.md` was intentionally **not** edited in 4D — at the time of this work it
> held unrelated uncommitted Asset-Station ADR edits, so per scope discipline the 4D ADR lives here only.

## 1. What changed from 4C

| Area | 4C | 4D |
|---|---|---|
| World pressure | none | deterministic **Hive Scheduler** reads recent events → bounded pressure snapshot |
| New events | — | server-authored `city_scheduler_tick`, `city_pressure_suggested` (in the same append-only log) |
| New messages | — | `city_scheduler_state` (server→client), `city_scheduler_request` (client→server, rate-limited) |
| Client UI | world log | + **CITY PRESSURE** panel (public-safe, display-only) |
| `SCHEMA_VERSION` | 2 | **3** (additive) |

Additive + backward-compatible: no-dt inputs and the entire 4A/4B/4C message set remain valid; a client
that ignores scheduler state still works; unknown messages still fail safe.

## 2. Authority model

The scheduler is **subordinate** to `CityRoom`. It owns **no** physics, position, collision, portal truth,
rewards, tickets, inventory, economy, rank, or ownership — it grants nothing and moves no one. It reads only:
(a) the recent **server-authored** event log, and (b) the server's own occupancy count (distinct players).
It never reads a client-authored fact as authoritative, and a client cannot author scheduler facts — there
is no inbound handler that accepts an event/pressure; a forged `city_scheduler_tick`/`city_event` →
`unknown_type`. The pressure is **display-only**: it changes no player or arcade state.

## 3. Hive Scheduler (`arcade/city/city-scheduler.mjs`, pure)

`evaluatePressure({ cityId, now, recentEvents, occupancy })` → a deterministic snapshot. PURE: no
async/network/AI/LLM, no randomness, no input mutation, no money/economy/ownership fields.

### Inputs
- `recentEvents` — recent entries from the append-only city log (within `WINDOW_MS = 60_000`). Only
  **portal** (`requested/accepted/rejected`) and **interior** (`opened/closed`) events are counted;
  scheduler-authored events are deliberately **excluded**, so emitting a tick can never feed back into pressure.
- `occupancy` — a SERVER fact (distinct players), never a client claim.

### Output (pressure-state model)
```js
{
  schema_version: 3, city_id, evaluated_at,
  pressure: {
    portal_activity:   "quiet" | "active" | "surging",     // ≥2 / ≥4 portal events in window
    presence:          "empty" | "light"  | "busy",        // occupancy ≥1 / ≥4
    interior_activity: "idle"  | "open"   | "cycling",     // ≥1 / ≥3 interior events in window
    scheduler_mood:    "stable"| "watching"| "stirring"    // aggregate of elevated dimensions
  },
  suggestions: [ { type:"city_pressure_suggested", reason, severity:"low"|"medium", public_safe:true } ] // ≤2
}
```
Helpers: `pressureChanged(a,b)`, `suggestionReasons(s)`, `schedulerStatePayload(s)`.

### Scheduler event schema
Two server-authored types added to the existing append-only log (same shape as all city events; payload
allowlist extended with the public-safe scalars `pressure`, `severity`):
`city_scheduler_tick` `{ pressure: <mood>, reason }` and `city_pressure_suggested` `{ pressure, reason,
severity }`. `city_event_scheduled` is **documented and deferred** (not implemented — actual scheduled
actions would add complexity with no 4D payoff).

## 4. CityRoom integration (+ shim parity)

`evaluateScheduler()` builds a snapshot from the recent log + occupancy and **emits a tick / new suggestions
ONLY when the pressure snapshot changes** (dedup → bounded; the log can't be spammed), then broadcasts
`city_scheduler_state`. It is invoked **server-side only**, opportunistically + bounded:
- after the join event (and a `city_scheduler_state` is unicast to the joiner so a (re)connect immediately
  has current pressure);
- in `handlePortal` (accept + reject), `handlePortalClose`, and the disconnect/leave path;
- once per existing `alarm()` tick (~30 s) for decay (activity ages out of the window) — **no new cron**;
- on a rate-limited `city_scheduler_request` (250 ms per socket — clients can't flood evaluations).

The scheduler snapshot lives in memory (`this.pressure`), derived from the persisted event log, so it is
recomputed after a DO restart (the first eval emits a fresh tick). No new storage key, no background process.
The Node city dev shim mirrors all of this over the same pure module (per-city pressure store).

## 5. Client city-pressure UI

A small **CITY PRESSURE** panel (`#cityPressure`, public-safe, `textContent` only) shows the mood, a
portal/presence/interior line, and up to two suggestions. Updated from `city_scheduler_state`; scheduler
events also surface in the existing world-log panel with public-safe labels. `city-net.js` gains
`requestScheduler()` + `onSchedulerState`; `__neon_city` gains `pressure()`. Copy is atmosphere-only
("CITY PRESSURE: WATCHING / portal active · presence light · interior idle") — never money or AI-NPC framing.

## 6. Public-safety / privacy

Scheduler output carries only public-safe scalars (mood/activity classifications, reason, severity). No
private player data, balance, ledger, inventory, account, token, secret, or admin data — the event payload
allowlist (`portalId/target/reason/pressure/severity`, length-capped) enforces this. `actor_public_id` on
scheduler events is `null` (system-authored). No third-party telemetry/tracking.

## 7. Size-budget result (GTA-80)

`node scripts/check-city-build-size.mjs` → within GTA-80 (≤80 MB) and the GTA-34 (≤34 MB gz) stretch.
Procedural only (a small pure module + a little UI); no assets, no new client dependency.

## 8. Validation commands

```bash
node --test tests/arcade/*.test.mjs            # pure scheduler + event-log + all existing
node tests/arcade/check-production-config.mjs
node scripts/check-city-build-size.mjs
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-scheduler.sh   # NEW 4D smoke
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-event-log.sh   # 4C regression
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-authority.sh   # 4B regression
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-block.sh       # 4A regression
bash tests/arcade/run-two-client.sh ; bash tests/arcade/run-frame-contract.sh # arcade regression
cd workers/arcade && npx wrangler deploy --dry-run --outdir dist              # Node 22; no deploy
```

## 9. Known limitations

- Pressure is per-block, derived from the bounded (50-event) recent log + occupancy; it is not history- or
  cross-room-aware (intentional — 4E reads scheduler-reviewed events, not deep history).
- Evaluation is opportunistic (events + ~30 s alarm + rate-limited request), not a fast fixed tick; pressure
  decays at alarm cadence when a block goes quiet.
- `this.pressure` is in-memory; after a DO restart the first eval re-derives it from the persisted log.

## 10. Deferred roadmap — 4E–4G (forward seams, documented only; NOT built)

The scheduler events are the seam these later phases read from. None are implemented in 4D.
- **4E — Host Rank (non-cash):** derives a non-cash reputation from scheduler-reviewed city events; never
  client claims. No payout/staking/marketplace/account-economy.
- **4F — Block Stewardship + constrained editor:** constrained, manifest-validated, reversible, moderated
  customization rights — *stewardship, not ownership*; the public city cannot be griefed.
- **4G — Instanced, non-destructive block battles:** instanced; the live public city is never destructively
  edited; no gambling/wagering, no paid entry, no cash rewards.

## 11. Non-goals (4D)

No 4E–4G systems; no HiveWorld bridge; no map expansion, missions, police, combat, weapons, vehicles,
NPCs/AI/LLM; no crypto/cash-out/gambling/marketplace/paid-hosting/token/NFT/transferable goods; no
accounts/OAuth; no cross-room economy; no persistent inventory; no land ownership; no deploy/credentials/
push; no history rewrite. No change to arcade ticket formulas, prize costs, challenge rewards, event
schedules, or economy behavior. The scheduler grants nothing and moves no one.
