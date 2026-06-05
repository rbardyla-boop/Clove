# HiveWorld v1.1 — City Systems Deep Mirror

v1.0 laid the city/district substrate (blocks, topology, routing, public-safe presence, district
activity, deterministic replay). **v1.1 folds the product's per-block CITY SYSTEMS onto that
substrate** — a deterministic **lab / proof harness**, not a product bridge. It mirrors:

| Product phase | System | v1.1 mirror |
|---|---|---|
| 4C | append-only city event log | a bounded, monotonic, sanitized `cityLog` |
| 4D | Hive Scheduler pressure | non-authoritative per-block pressure/mood |
| 4E | non-cash Host Rank | a reputation tier + support signal (no economic field) |
| 4F | constrained Block Stewardship | closed-allowlist, host-rank-gated, reversible style override |
| 4G | non-destructive Block Trial | instanced, ephemeral trial that never touches the public block |

## What changed from v1.0

- **5 new sim-local pure modules** (`core/phase1/`, never importing `arcade/city/*`):
  `city-world-log.mjs`, `city-pressure.mjs`, `city-host-rank.mjs`, `city-stewardship.mjs`,
  `city-trial.mjs`.
- **New reducer** `core/reducers/city-systems.mjs` — folds all five onto `state.district`
  (`cityLog` / `pressure` / `hostRank` / `stewardship` / `trials`), with each safety invariant
  enforced in the fold.
- **9 new events** registered in all 3 places (`EVENT_SPECS` + `reducers/index` + `CITY_EVENT_SIDEBAND`):
  `city_world_event`, `city_pressure_observed`, `city_host_rank_evaluated`, `city_stewardship_applied`,
  `city_stewardship_reset`, `city_block_trial_opened`/`joined`/`stepped`/`closed`. They ride existing
  sidebands (`event_log` durable; `weather` ephemeral for pressure) — no new sideband classes.
- Scenarios (`scenarios/city-systems.mjs`), a testbed panel extension, and a UI-smoke check.

## Per-system model + safety invariant (enforced in the fold)

- **4C city world log** — `appendCityWorldEvent` stamps a monotonic `seq` + `event_id`, FIFO-bounds to
  `CITY_LOG_MAX = 50`, and re-projects each payload through a CLOSED public-key allowlist (scalars
  only; nested objects/arrays dropped). A caller cannot forge ids or smuggle private fields.
- **4D pressure** — `derivePressure({recentEvents, population})` → `{mood, score (0..100), population}`,
  bounded + deterministic. **Non-authoritative:** nothing reads pressure back to make an authority
  decision (Host Rank derives FROM it; location/route authority ignores it). No economic field.
- **4E host rank** — `deriveHostRank({recentEvents, pressure})` → `{tier, support_signal, score,
  score_cap}`. **Non-cash:** there is no credit/balance/payout/price field anywhere; the tier confers
  only a display-edit right (Stewardship eligibility), never money.
- **4F stewardship** — `sanitizeStyleOverride` keeps ONLY the closed allowlist (`palette` ∈ 5 named
  colours, `sign_variant` ∈ 3, `intensity` ∈ 3); free text / URLs / uploads are dropped. The apply is
  **gated** by `isStewardEligible(hostRank)` (host/steward tiers) and is **reversible** — `reset` drops
  the override so the effective style falls back to the block default. Display-only; no ownership/permanence.
- **4G block trial** — an INSTANCED state machine (`open → active → completed@cap → closed`) living in
  its own `state.district.trials[cityId]`. It is **non-destructive**: it never references or mutates the
  public block's identity, style, presence, or population — the block is byte-identical before and after.
  It grants no economy/tickets. The public trial payload carries a player COUNT only (no player ids).

## Authority / convergence model

Each block is an authority node (`addRoom({id: cityId})`, signs `actor_id === cityId`) for 4C/4D/4E/4F;
trials (4G) are driven by actors who must be in the block. The fold is a pure function of the
canonically-ordered event set (dedupe by content-addressed `event_id`, sort `tick→actor→seq→hash`), so
**delayed / duplicated / out-of-order delivery converges to the same fingerprint** (proven by refolding
reversed + duplicated event sets). `state.district` (incl. all v1.1 slices) is in `stateFingerprint`.

## Public-safety / privacy model

The world log, pressure, host rank, stewardship style, and trial payload are all allowlist-projected.
Injected private payload fields (player ids, balances, sockets, tokens, URLs) are stripped at the fold.
Host Rank carries no economic field; trial payloads carry a count, not player ids. Tests assert no
private/cash data survives the fold or reaches the testbed DOM.

## Validation commands

```bash
node --test tests/hiveworld/*.test.mjs        # 262 (248 v1.0 + 14 new city-systems)
bash tests/hiveworld/run-ui-smoke.sh           # testbed UI smoke incl. the v1.1 systems panel
```

## Known limitations

- The city world log (4C) records the v1.1 SYSTEM events (stewardship/trial/rank-change/world-notes); the
  v1.0 route/presence narration stays in the district activity feed. The two are complementary views.
- Pressure/Host Rank are evaluated when a block emits an observation/evaluation event (mirroring the
  product's periodic eval), not continuously; cadence/timing is a v1.2 concern.
- The trial mechanic is a minimal stabilize-to-cap counter, not the product's full signal-grid node math
  (the invariant that matters — non-destructiveness — is fully modelled).

## v1.2 / v1.3 roadmap

- **v1.2** — district presence-push + activity-feed CADENCE (mirror Phase 5C/5D/5E timing).
- **v1.3** — sideband / radio-fabric visualization for multi-block activity.

## Explicit non-goals

No product bridge, no live Worker/DO, no real networking/crypto/accounts, no money / blockchain / token /
NFT / staking / yield / resale / cash-out / gambling / wagering / marketplace / paid hosting /
transferable goods, no ownership / rent / income / payout / land / block sale, no unconstrained UGC or
upload (stewardship is a closed allowlist), no AR/geospatial, no real persistence beyond the harness, no
Phase 6, no changes to product ticket formulas / Host Rank scoring / Stewardship eligibility / Block
Trial rules.
