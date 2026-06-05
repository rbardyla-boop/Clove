# HiveWorld v1.3 — Sideband / Radio-Fabric Visualization

v1.0–v1.2 built the district, the city systems, and the presence push CADENCE. v1.3 makes the fabric
VISIBLE: a **read-only diagnostic LENS** over what already exists. It is a lens, not a mechanism.

## The cardinal rule (read-only)

v1.3 adds **NO** new event type, reducer, authority, or fold/cadence behaviour, and changes **NO** state
shape. It computes deterministic VIEW-MODELS from data the simulator already produces (the report, the
canonical log, the folded state, the `SIDEBANDS` registry) and renders them. Attested by diff: every
fold/event/reducer/state file (`events.mjs`, `state-util.mjs`, `world.mjs`, `log.mjs`, `sidebands.mjs`, all
reducers, `city-events.mjs`) is **unchanged**, and a test asserts `EVENT_SPECS` is unchanged after running
the lens. The "radio/sideband" naming is the existing metaphor only — there is no real RF/networking here.

## What changed from v1.2

- **New pure module** `core/viz/fabric-view.mjs` — six read-only view-models (below). No new state.
- **Testbed** `hiveworld-debug.mjs` + `hiweworld-testbed.html`: a new `#hw-fabric` lens panel rendered when
  a city scenario runs (textContent/DOM only).
- Tests (`tests/hiveworld/phase6-fabric-viz.test.mjs`) + a UI-smoke check.

## The six view-models (all pure, deterministic, read-only)

1. **`sidebandChannels(report)`** — per sideband (stable order): name, behavioural class, traffic count,
   recent event types. From `SIDEBANDS` + `report.sidebandTraffic` + `report.eventLog`.
2. **`pushedViewTimeline(events)`** — the v2 cadence MADE VISIBLE OVER TIME. Re-folds canonical PREFIXES
   (read-only) and captures, at each tick boundary, the registry population per block and each block's
   pushed-view population of every block. Bounded to `maxSnapshots`. This is where same-block-immediate
   vs cross-block-alarm-bound shows up as a timeline (e.g. at the delta tick, the reporting block's own
   entry is fresh while another block's view of it is still stale until that block's alarm).
3. **`propagationTrace(events, cityId)`** — for a block's change: the tick it entered the registry vs the
   tick each block's pushed view reflected it, labelled `immediate` (same-block, lag 0) vs `delayed`
   (cross-block, lag ≤ `ALARM_INTERVAL_TICKS`).
4. **`activityBySideband(report)`** — the public-safe activity labels grouped by the sideband whose events
   drive them (`presence` for presence/cadence, `event_log` for route/arrival).
5. **`convergenceDemo(events)`** — the canonical fingerprint + a read-only demonstration that arrival vs
   reversed vs duplicated all fold to the SAME fingerprint (the convergence guarantee, visible).
6. **`rejectedSummary(report)`** — dropped/rejected events grouped by phase (ingest vs apply) + reason +
   sideband, as COUNTS only. It NEVER surfaces a stripped private value — only the machine reason, the
   phase, and the channel it was refused on. This makes the safety story legible without leaking anything.

`fabricView(report, events)` bundles all six.

## The fold-prefix replay (how the timeline stays read-only)

The timeline re-folds CANONICAL PREFIXES of the same event set — `fold(ordered.filter(tick ≤ T))` — to
snapshot `pushedView`/`blocks` at each tick boundary. This re-uses the existing `fold` purely as a
function; it never touches the live sim, and because `fold` is deterministic, the timeline is too. It is
bounded (a capped number of tick boundaries) so the lens stays lean.

## Public-safety / privacy

Every view-model is built from already-public-safe data (public block summaries, observational activity
labels, machine reasons). The rejected/stripped view-model is the sensitive one and is restricted by
construction to `{phase, reason, sideband, count}` — a test asserts no private value appears anywhere in
the lens output. No economy/ownership. No telemetry/tracking. No real RF.

## Validation commands

```bash
node --test tests/hiveworld/*.test.mjs        # 280 (271 v1.2 + 9 new lens)
bash tests/hiveworld/run-ui-smoke.sh           # testbed UI smoke incl. the #hw-fabric lens
```

## Known limitations

- The lens visualizes the LAST run city scenario's report + event list; it is a diagnostic snapshot, not a
  live streaming animation (a streaming spectrum is a possible later polish, still read-only).
- The pushed-view timeline is bounded to a capped number of tick boundaries for long runs (evenly sampled).
- The propagation trace follows a single target block's final-population change; richer multi-change traces
  are a later refinement.

## v1.4 roadmap

HiveWorld now has: district + city systems + presence cadence + a diagnostic lens over the whole fabric. A
sensible v1.4 would be a multi-district or richer-topology mirror **only if the product actually grows
one** — mirror what ships, do not invent product surface in the sim. (A live streaming visualization is a
read-only polish option that does not require new product surface.)

## Explicit non-goals

No new event/reducer/authority/fold change (read-only lens). No product bridge, live Worker/DO, real
networking, real radio/RF layer, crypto, accounts, money / blockchain / token / NFT / staking / yield /
resale / cash-out / gambling / wagering / marketplace / paid hosting / transferable goods, ownership /
rent / income / payout / land / block sale. No unconstrained UGC / upload / AR / real persistence / Phase
6. No private value rendered in the visualization. No changes to product ticket formulas / Host Rank
scoring / Stewardship eligibility / Block Trial rules.
