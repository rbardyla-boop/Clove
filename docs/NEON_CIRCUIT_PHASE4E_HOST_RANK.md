# Neon Circuit — Phase 4E: Host Rank (non-cash, scheduler-reviewed city reputation)

**Status:** implemented, local-only (branch `feat/neon-circuit-phase4e-host-rank`; Phase 4D `4598969` and
4C `dfc7031` are ancestors; branched off the current tip).
**Goal:** prove the city can recognize positive hosting/support activity via a **non-cash, block-scoped
reputation signal** — with **no** financial, ownership, account, or transferable mechanic of any kind.

Builds on [NEON_CIRCUIT_PHASE4D_HIVE_SCHEDULER.md](NEON_CIRCUIT_PHASE4D_HIVE_SCHEDULER.md).
Core rule unchanged: **players send intent, the server owns truth.**

> Note: `docs/PROJECT_CHARTER.md` was intentionally **not** edited in 4E — it currently holds unrelated
> uncommitted ADR edits, so per scope discipline the 4E ADR lives here only.

## 1. What changed from 4D

| Area | 4D | 4E |
|---|---|---|
| Reputation | none | deterministic **Host Rank v0** from recent events + scheduler-reviewed pressure |
| New events | scheduler tick/suggested | server-authored `city_host_rank_evaluated`, `city_host_rank_changed` |
| New messages | `city_scheduler_state`/`request` | `city_host_rank_state` (server→client), `city_host_rank_request` (client→server, rate-limited) |
| Client UI | pressure panel | + **HOST RANK** panel (non-cash, display-only) |
| `SCHEMA_VERSION` | 3 | **4** (additive) |

Additive + backward-compatible: no-dt inputs and the entire 4A/4B/4C/4D message set remain valid; a client
that ignores host-rank state still works; unknown messages still fail safe.

## 2. Authority model

Host Rank is **subordinate** to city authority and scheduler review. It is derived **server-side only** from
(a) the recent **server-authored** event log and (b) the scheduler's pressure snapshot. It never reads a
client-authored fact, never moves a player, and touches no collision/portal/ticket/inventory/economy state.
The client may request a view and display it; it can **never** claim rank, progress, rewards, ownership,
payout, or contribution — a forged `city_host_rank_*`/`city_event` gets `unknown_type`.

## 3. Host Rank definition (v0)

A local, **non-cash, block/city-scoped** reputation signal — one per city block (the block's collective
recent support standing), parallel to city pressure. Host-rank events are **system-authored**
(`actor_public_id: null`). It **is**: bounded, DO-resident, public-safe, display-only, derived from recent
server + scheduler-reviewed events, and a future seam for Block Stewardship. It is **not**: money / cash
value / token / NFT / staking / yield / resale / ownership / account identity / transferable good /
marketplace reputation / paid hosting / server-rental payout / legal land claim / persistent global profile.

**Per-player host attribution is deferred** (4F, carefully) — there is no account or persistent player
profile here.

## 4. Host Rank module (`arcade/city/city-host-rank.mjs`, pure)

`evaluateHostRank({ cityId, now, recentEvents, schedulerState })` → deterministic snapshot. PURE: no
async/network/AI/randomness/mutation; no money/economy/ownership fields.

### Inputs
- `recentEvents` — recent **support** events within `WINDOW_MS = 60_000`: `city_portal_enter_accepted`,
  `city_arcade_interior_opened/closed`, `city_player_joined`. (Scheduler/host-rank events are not counted.)
- `schedulerState` — the scheduler-reviewed pressure snapshot (the "scheduler-reviewed" tie-in).

### Output
```js
{
  schema_version: 4, city_id, evaluated_at,
  host_rank: {
    tier: "observer" | "helper" | "signaler" | "anchor",   // by bounded score thresholds
    score: 0,                                               // bounded display gauge…
    score_cap: 100,                                         // …non-cash, non-cumulative (decays)
    support_signal: "quiet" | "steady" | "active",          // from scheduler mood (stable/watching/stirring)
    reasons: ["portal_presence", "interior_support", "sustained_presence", "scheduler_active"], // ≤3, public-safe
    public_safe: true
  }
}
```
The `score` is a **bounded display gauge** computed from the recent window (weighted support events + a small
scheduler-pressure bonus), capped at `score_cap` — **not** cumulative XP, so there is no grind or
persistence-based progression. Helpers: `hostRankChanged`, `hostRankTierChanged`, `isBaselineHostRank`,
`hostRankStatePayload`.

### Event schema
Two server-authored types in the existing append-only log: `city_host_rank_evaluated`
`{ tier, support_signal, score, score_cap, reason }` and `city_host_rank_changed`
`{ tier, support_signal, score, score_cap }` (`city_host_signal_observed` documented + deferred). Payload
allowlist extended with the public-safe scalars `tier`, `support_signal`, `score`, `score_cap`.

## 5. CityRoom integration (+ shim parity)

`evaluateHostRank()` runs **immediately after** the scheduler eval at every existing hook (join / portal
accept+reject / interior close / leave / ~30 s alarm / rate-limited `city_host_rank_request`). It consumes
`this.pressure` + the recent log, emits `city_host_rank_evaluated` only when the headline display changes
(tier|support|reasons; cold-start idle guard) and `city_host_rank_changed` when tier|support changes (dedup →
bounded, no log spam), and broadcasts `city_host_rank_state`. Join sends `city_host_rank_state` once
(explicit only if the eval didn't broadcast). `this.hostRank` is in-memory, derived from the persisted log
→ recomputed after a DO restart. The Node dev shim mirrors all of this over the same pure module.

## 6. Client Host Rank UI

A small **HOST RANK** panel (`#cityHostRank`, public-safe, `textContent` only): tier + support signal + ≤2
reasons. Updated from `city_host_rank_state`; host-rank events also surface in the world-log panel with
**non-monetary** labels. `city-net.js` gains `requestHostRank()` + `onHostRankState`; `__neon_city` gains
`hostRank()`. Copy is reputation-only ("HOST RANK: HELPER / Support signal: steady / Reason: portal
presence") — never money/ownership/rent/payout/account framing.

## 7. Public-safety / privacy

Host Rank output carries only public-safe classifications (tier, support_signal, bounded score/score_cap,
reason strings). No private player data, balance, ledger, inventory, account, token, secret, ownership, or
admin data — the payload allowlist enforces it. `actor_public_id` on host-rank events is `null`
(system-authored). No third-party telemetry/tracking.

## 8. Size-budget result (GTA-80)

`node scripts/check-city-build-size.mjs` → within GTA-80 (≤80 MB) and the GTA-34 (≤34 MB gz) stretch.
Procedural only (a small pure module + a little UI); no assets, no new client dependency.

## 9. Validation commands

```bash
node --test tests/arcade/*.test.mjs            # pure host-rank + scheduler + event-log + all existing
node tests/arcade/check-production-config.mjs
node scripts/check-city-build-size.mjs
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-host-rank.sh   # NEW 4E smoke
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-scheduler.sh   # 4D regression
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-event-log.sh   # 4C regression
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-authority.sh   # 4B regression
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-block.sh       # 4A regression
bash tests/arcade/run-two-client.sh ; bash tests/arcade/run-frame-contract.sh # arcade regression
cd workers/arcade && npx wrangler deploy --dry-run --outdir dist              # Node 22; no deploy
```

## 10. Known limitations

- Host Rank is block-scoped and a recent-window display gauge (decays); it is not history-, per-player-, or
  cross-room-aware (intentional — per-player attribution is deferred to 4F with care).
- Evaluation is opportunistic (events + ~30 s alarm + rate-limited request), not a fast fixed tick.
- `this.hostRank` is in-memory; after a DO restart the first eval re-derives it from the persisted log.

## 11. Deferred roadmap — 4F–4G (forward seams, documented only; NOT built)

- **4F — Block Stewardship + constrained editor:** Host Rank may become **one eligibility signal**;
  stewardship is **not** ownership; editor changes are manifest-validated, reversible, moderated; no public-
  city griefing; no marketplace.
- **4G — Instanced, non-destructive block battles:** battles run in isolated instances; the live public city
  is never destructively edited; no gambling, no paid entry, no cash rewards; outcomes may later affect
  non-cash reputation/cosmetics only if approved.

## 12. Non-goals (4E)

No 4F/4G systems; no per-player accounts/profiles/global leaderboard; no HiveWorld bridge; no map expansion,
missions, police, combat, weapons, vehicles, NPCs/AI; no crypto/cash-out/gambling/marketplace/paid-hosting/
token/NFT/transferable goods/staking/yield/resale; no ownership/rent/rental/income; no cross-room economy; no
persistent inventory; no deploy/credentials/push; no history rewrite. No change to arcade economy. Host Rank
grants nothing, moves no one, and is display/reputation only.
