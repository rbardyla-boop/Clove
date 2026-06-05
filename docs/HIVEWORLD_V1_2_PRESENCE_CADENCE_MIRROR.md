# HiveWorld v1.2 — District Presence Push + Activity Cadence Mirror

v1.0 folds a CONVERGED district presence map; v1.1 added the 4C–4G city systems. Neither modelled the
product's Phase 5C/5D/5E **push cadence** — the fact that, at a given moment, a block's clients have a
**partial, alarm-bounded view** of OTHER blocks. v1.2 adds that timing dimension, deterministically, as
a lab / proof harness — NOT a product bridge.

## What changed from v1.1

- **New pure module** `core/phase1/district-presence-push.mjs`: `ALARM_INTERVAL_TICKS` (the 30s analog),
  `isAlarmTick` / `ticksToNextAlarm` (testbed countdown), `snapshotAllBlocks` (a public-safe registry
  snapshot), `diffPushedView` (bounded changed-block list). Reuses v1.0 `publicBlockSummary` +
  `activityForPresence` (no duplicated allowlist).
- **New reducer** `core/reducers/city-cadence.mjs` for `city_presence_alarm`, plus an additive extension
  to the v1.0 `district_presence_delta` reducer (the same-block immediate self-push). `state.district`
  gains `pushedView`.
- **1 new event** (`city_presence_alarm`, presence sideband) registered in all 3 places. Scenarios
  (`scenarios/presence-cadence.mjs`), a testbed cadence row, and a UI-smoke check.

## The cadence model

Two layers on `state.district`, both pure functions of the canonically-ordered log:

1. **Registry aggregate (5C)** — `state.district.blocks` (unchanged from v1.0): the authoritative public
   presence map, updated IMMEDIATELY when any block reports a `district_presence_delta`.
2. **Per-block pushed view (5D)** — `state.district.pushedView[cityId]`: what block `cityId` has PUSHED to
   its clients. A map of every block's public summary, where:
   - the block's OWN entry is **immediate** (updated on its own delta), and
   - other blocks are only as fresh as the block's **last alarm**.

A `city_presence_alarm` (a block's alarm boundary, the 30-tick analog) recomputes that block's pushed view
from the registry (`snapshotAllBlocks`) and derives the public-safe **5E activity** for the blocks that
changed since its last push. The first alarm is the baseline snapshot (no activity, like the product's
initial `city_blocks`); subsequent alarms behave like deltas.

### Worked tick timeline (the proof shape)

```
t1   downtown + harbor fire baseline alarms        → both pushedViews seeded (all 0)
t5   harbor reports population 2 (district_presence_delta)
       registry.blocks[harbor]            = 2      (aggregate, immediate)
       pushedView[harbor][harbor]         = 2      (5D SAME-block immediate)
       pushedView[downtown][harbor]       = 0      (5D CROSS-block STALE — downtown hasn't alarmed)
t31  downtown alarm (t1 + ALARM_INTERVAL_TICKS)
       pushedView[downtown][harbor]       = 2      (now fresh — cross-block bound by the alarm)
       activity                           += "Harbor became active."   (5E cadence)
```

A leave is symmetric: `district_presence_delta population 0` drops the registry + the block's own view to
0 immediately; other blocks reflect 0 within one alarm — **no lingering ghost**.

## Determinism / convergence

The pushed view + alarms are pure functions of (canonically-ordered deltas + alarms). The canonical
`SidebandCRDTLog` dedupes by content-addressed `event_id` and sorts (`tick → actor → seq → hash`) before
folding, so **delayed / duplicated / out-of-order cadence events fold to the same fingerprint** (proven by
refolding reversed + duplicated event sets). Only ticks are used — no wall clock. `state.district`
(including `pushedView`) is in `stateFingerprint`.

## Public-safety / privacy

The pushed view and cadence activity are built from `publicBlockSummary` + `activityForPresence` (the v1.0
allowlists): population + health + identity only. Injected private fields are stripped; no actor ids enter
a pushed summary or an activity label. No economy/ownership. Tests assert no private data in `pushedView`
or the activity feed.

## Validation commands

```bash
node --test tests/hiveworld/*.test.mjs        # 271 (262 v1.1 + 9 new cadence)
bash tests/hiveworld/run-ui-smoke.sh           # testbed UI smoke incl. the presence-cadence row
```

## Known limitations

- Alarms are EXPLICIT events a block emits at its boundary (the scenario drives the cadence); the model
  bounds cross-block lag by `ALARM_INTERVAL_TICKS` but does not auto-fire alarms — a deliberate choice so
  the fold stays a pure function of the log (no implicit time source).
- The activity feed is a single shared lab feed; in the product each client has its own. The cadence is
  proven rigorously on `pushedView` (the timed state); the shared feed shows the cadence-derived items.
- Health transitions over time (freshness decay) are out of scope here; presence is reported explicitly.

## v1.3 roadmap

- **v1.3** — sideband / radio-fabric visualization for multi-block activity (now that the cadence model
  exists, the spectrum UI can show per-block push timing).

## Explicit non-goals

No product bridge, no live Worker/DO, no real networking/crypto/accounts, no money / blockchain / token /
NFT / staking / yield / resale / cash-out / gambling / wagering / marketplace / paid hosting / transferable
goods, no ownership / rent / income / payout / land / block sale, no unconstrained UGC or upload, no
AR/geospatial, no real persistence beyond the harness, no Phase 6, no changes to product ticket formulas /
Host Rank scoring / Stewardship eligibility / Block Trial rules. No v1.3 sideband/radio visualization yet.
