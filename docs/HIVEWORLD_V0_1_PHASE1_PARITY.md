# HiveWorld v0.1 — Phase 1 Arcade Parity Update

## Summary

The HiveWorld v0 sideband simulator was built before the full Neon Circuit Phase 1
arcade stack existed. This update teaches the simulator/testbed the **real Phase 1
arcade rules** — three cabinets, server-authoritative rounds, ticket formulas,
ledger, Prize Counter, Challenge Board, achievements, public event feed, the
Cabinet Frame Contract, and the Adapter SDK / dynamic import loader — so the
testbed mirrors what the product actually does.

It is a **simulator/testbed update only**. It does not start Phase 2, does not
bridge HiveWorld into the production Worker/Durable Object path, and adds no
money/crypto/AR mechanics.

## Relationship to the Phase 1 product stack

The product Phase 1 stack lives on `feat/neon-circuit-phase1l-neon-grid`
(`workers/arcade/` + `arcade/`). It is **not merged to `main`**, and the HiveWorld
branch forked before Phase 1d–1l landed, so the product Phase 1 modules are **not
present on this branch**. The Phase 1 semantics are therefore **ported** into
self-contained simulator modules under `arcade/hiveworld-sim/core/phase1/` — a
deterministic, zero-dependency mirror. The simulator **mirrors** the product
authority model; it never replaces it and is never deployed.

## What changed from HiveWorld V0

V0 proved: Sideband CRDT Log, player/room nodes, occupancy authority, world-space
slots, internal credits + bound goods, a Pulse-Tap-*like* round, mesh churn,
failure/replay/desync detection, the spectrum UI, and 38 tests.

V0.1 **adds an arcade layer** that mirrors Phase 1:

- a new world-state `arcade` slice (rounds, balances, ledger, inventory, equips,
  challenge stats/progress, achievements, public feed);
- new fabric event types + reducers (`reducers/arcade.mjs`) for the round / ticket
  / prize / challenge / equip flow, expressed as **pure authoritative fold
  reducers** (authority lives in the canonical fold, exactly like occupancy);
- ported pure product semantics (`core/phase1/*.mjs`);
- 8 Phase 1 scenarios, 9 new test files (107 unit tests total, up from 38), a
  Playwright UI smoke, and a Phase 1 panel in the testbed.

## Cabinet parity

`core/phase1/catalog.mjs` models the three product cabinets plus deliberately
broken ones to exercise fail-closed paths:

| cabinet | type | machine | ruleset | adapter_mode | state |
|---|---|---|---|---|---|
| Pulse Tap | `pulse_tap` | `pulse` | `pulse-tap/1` | builtin | playable |
| Signal Sprint | `signal_sprint` | `signal` | `signal-sprint/1` | builtin | playable |
| Neon Grid | `neon_grid` | `grid` | `neon-grid-v1` | imported | playable (after catalog activation) |
| Circuit Match | `match` | — | — | none | coming_soon |
| Mystery X | `mystery_x` | `myx` | `mystery-x/1` | builtin | unavailable (no adapter) |
| Glitch Cab | `glitch` | `glx` | `glitch/1` | imported | unavailable (invalid adapter) |

The **server catalog is the authority**: an adapter never makes a cabinet playable
on its own; the imported Neon Grid adapter is disabled until the catalog activates
it. Render-state resolves to `playable` / `unavailable` / `coming_soon` /
`not_listed`, and every cabinet classifies into one adapter state
(`valid_builtin`, `valid_imported_enabled/disabled`, `valid_imported_test_only`,
`missing_adapter`, `invalid_adapter`, `coming_soon`).

## Ticket formula parity

`core/phase1/tickets.mjs` is byte-faithful to the product formulas:

- **Pulse Tap**: base S25/A18/B12/C7/D3/F0 + min(10, ⌊score/750⌋) + accuracy(≥98→5,≥90→3), cap 40.
- **Signal Sprint**: base S22/A16/B11/C6/D3/F0 + min(8, ⌊distance/250⌋) + streak(≥25→5,≥12→3) − min(5, ⌊noise/3⌋), cap 35, floor 0.
- **Neon Grid**: base S24/A17/B12/C7/D3/F0 + min(8, patterns) + streak(≥32→5,≥16→3) − min(5, ⌊mistakes/4⌋), cap 38, floor 0.

The validator + formula are resolved server-side from the catalog by machine id; a
client cannot pick its own validator or supply its own ticket amount.

## Round authority parity

`core/phase1/round-authority.mjs` mirrors the product `startRound` / `submitRound`.
Rounds track id / cabinet / type / ruleset / actor / start+expiry tick / status /
award. Rejections cover: `not_occupant`, `unknown_round`, `duplicate_submission`,
`round_expired`, `wrong_session`, `wrong_cabinet`, `wrong_cabinet_type`,
`wrong_ruleset`, `malformed`, `bad_grade`, the out-of-bounds/negative validator
reasons, and cross-game results (a Pulse result submitted to a Grid round, etc.).
In the simulator, occupancy comes from the canonical fold's occupancy slice, so
the reducer never weakens occupancy authority.

## Ledger / prize / challenge / feed parity

- **Ledger** (`ledger.mjs`): one entry per ticket-affecting event, deduped by a
  deterministic `ledger_id`, private to its owner, with a public-safe summary.
  All three cabinet awards land in one shared balance.
- **Prize Counter** (`prize.mjs`): catalog-priced redemption, server-checked
  balance, session-bound entitlements, unique-item + duplicate-redemption guards,
  owner-only equip. No transfer/resale/cash-out path.
- **Challenges + achievements** (`challenges.mjs`): the Phase 1h + 1l challenges
  (incl. `grid-rookie`, `clean-grid`, `three-cabinet-tour` via the `allCabinets`
  metric) and badges; progress driven only by accepted rounds/redemptions; claims
  grant a session-bound badge and/or a server-computed ticket bonus.
- **Feed** (`feed.mjs`): bounded to 50 public-safe summaries; never carries a
  private balance, ledger, or inventory.

## Frame / adapter parity

`frame-contract.mjs` carries the three 360×640 `fit-contain`
`preserve_original_size` contracts with a clone guard (size drift without a
migration flag fails) and forbidden scale-mode rejection. `adapters.mjs` ports the
adapter SDK + import manifest + path validation: arcade-local paths only (no
`game/*`, no `..`, no external URL / `data:`), forbidden capabilities
(`external_payments`, `crypto_wallet`, …) rejected, and the render-state /
adapter-state resolver.

## Sideband mapping

`sideband-map.mjs` maps the arcade flow onto the existing 11 sidebands. The actual
fabric event types: `cabinet_catalog` → discovery; `arcade_round_start` /
`arcade_round_submit` / `arcade_claim_challenge` → event_log; `arcade_redeem` →
market; `arcade_equip` / `arcade_unequip` → asset_sync. Ticket awards, ledger
entries, challenge completions and achievement unlocks are **derived state**
(the fold computes them) reflected in the `arcade` slice + public feed. Private
data never rides a public sideband; the feed is checked public-safe.

## Scenarios

`scenarios/phase1.mjs`: `phase1QuickStart`, `threeCabinetTour`, `prizeCounterLoop`,
`challengeBoardLoop`, `adapterFailureLoop`, `reconnectReplayLoop`,
`privacyBoundaryLoop`, `meshChurnPhase1` (10 agents × 3 cabinets under
delay/dup/disconnect + a malicious cross-game submit). All converge and are
byte-for-byte deterministic.

## Tests

- 38 original simulator tests remain green.
- 9 new Phase 1 parity test files: catalog, tickets, round-authority, ledger,
  prize, challenges, event-feed, frame-contract, adapter, sideband-map, scenarios,
  privacy. **Total: 107 unit tests.**
- `tests/hiveworld/phase1-ui-smoke.spec.mjs` (Playwright) + `run-ui-smoke.sh`:
  loads the testbed, drives a real arcade round + Phase 1 scenario through the UI,
  asserts zero console errors.

```bash
node --test tests/hiveworld/*.test.mjs            # 107 pass
PW_REQUIRE_BASE=<playwright/package.json> bash tests/hiveworld/run-ui-smoke.sh
```

## Manual validation

Open `arcade/hiveworld-sim/hiveworld-testbed.html` (any static server). The Phase 1
panel shows the cabinet catalog with render-states, the selected agent's tickets /
inventory / challenge progress, and the public feed. Controls: play an arcade round
per cabinet, redeem + equip a badge, claim a challenge, and run any Phase 1
scenario.

## Known limitations

- Room/session-scoped balance/inventory/challenges/feed; not durable account state.
- The simulator mirrors product semantics; it is not the canonical authority and is
  never deployed. The ported modules must be kept in sync if product formulas change.
- Tick-based round expiry (the sim clock is logical ticks); the validators still
  check the product's `durationMs` bounds.
- The frame contract is metadata/policy only here (no DOM scaling).
- HiveWorld remains a separate branch; nothing here bridges into the product
  Worker/DO.

## Phase 2 lab role

With Phase 1 parity, the simulator becomes the **Phase 2 laboratory**: a safe place
to prototype multi-room arcade authority, deterministic replay/audit, and abuse
handling against realistic arcade rules — *before* any of it touches production.
HiveWorld integration stays gated behind a read-only, public-safe event export
first (see `docs/NEON_CIRCUIT_PHASE2_READINESS.md`).

## Non-goals (explicit)

```
no production Worker/DO bridge
no HiveWorld V1
no AR/geospatial layer
no real money
no crypto
no blockchain
no token/NFT mechanics
no cash-out
no staking/yield/resale
no gambling/wagering
no land ownership
no production account inventory
```
