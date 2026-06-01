# Neon Circuit — Phase 1l: Neon Grid (First Adapter-Loaded Production Cabinet)

## Summary

Phase 1k built the dynamic Cabinet Adapter Loader. Phase 1l proves it on a real
cabinet. **Neon Grid** is the first production Neon Circuit cabinet that enters
the arcade floor through the Phase 1j/1k **adapter + dynamic-import path** instead
of being hand-wired into `arcade/neon-circuit-floor.js` like Pulse Tap and Signal
Sprint.

It exercises the full production chain end-to-end:

```
server catalog activation
→ adapter registry resolution
→ frame contract preservation
→ adapter runtime mount
→ server-authoritative round validation
→ ticket award
→ ledger entry
→ challenge progress compatibility
→ prize counter compatibility
→ event feed compatibility
→ two-client privacy/authority validation
```

## Branch / base

- Branch: `feat/neon-circuit-phase1l-neon-grid`
- Base: `feat/neon-circuit-phase1k-dynamic-adapter-loader` @ `3ed7b5a`
- **Stacked** behind PR #4 (`feat/neon-circuit-phase1e-server-tickets` → `main`)
  and Phases 1f–1k. It cannot open cleanly against `main` until those land. No
  merges, pushes, or PRs were performed in this phase.

## Scope

- One new production cabinet, **Neon Grid** (`neon-grid-01`, `cabinet_type:
  neon_grid`, `machine_id: grid`, `ruleset_version: neon-grid-v1`), activated
  through the server catalog and mounted via the dynamic adapter/import loader.
- A bounded, deterministic pattern-path mini-game (native `360×640`).
- Server-authoritative round validation + ticket formula for `neon_grid`.
- Neon Grid challenges + achievement badges, reusing the existing Challenge
  Board, Prize Counter, ledger and event feed without a second system.

## Non-goals (explicit)

- no real money
- no crypto
- no blockchain
- no token / NFT mechanics
- no cash-out
- no staking / yield / resale
- no gambling / wagering
- no HiveWorld bridge
- no AR / geospatial layer
- no land ownership
- no external payment support
- no production account inventory (entitlements stay session/room-bound)

## Why this proves the adapter/import path

Pulse Tap and Signal Sprint are wired directly into the floor (`mountAdapter` with
factories the runtime imports statically). Neon Grid is **not**:

1. The server catalog marks `neon-grid-01` active.
2. The floor receives the catalog and calls
   `loadAndActivateImportedCabinet(cabinet, neonGridManifest, hooks)`.
3. The import loader validates the **manifest** (identity, native size, modes,
   arcade-local paths, forbidden capabilities) *before* importing anything,
   dynamically imports the adapter module, validates the **adapter** against its
   frame contract, and registers it **disabled**.
4. Because the catalog activated it, the runtime **enables** it in the controlled
   registry and confirms `resolveAdapterForCabinet(cabinet)` now resolves to it
   (catalog → registry resolution).
5. The runtime builds a cabinet frame from the (preserved) `neon_grid` contract
   and mounts the imported game into it.

Every step **fails closed**: a cabinet missing from the catalog, an invalid
manifest/adapter, or a cabinet-type mismatch leaves the tile *Unavailable* with no
crash. A client adapter can **never** make itself playable — only the server
catalog can activate it.

## Neon Grid gameplay

A short (~25s) pattern-path game on a `4×4` neon grid. A path lights up; the
player repeats it by tapping the cells in order. Paths get a little longer as the
round goes on. Mobile-first; pointer / mouse / touch / keyboard compatible. Native
logical size `360×640`, preserved through the cabinet frame.

Tracked result (camelCase on the wire, matching the Pulse/Signal convention):

```
grade            S/A/B/C/D/F
score            0 .. 50_000
correctSteps     0 .. 256     (correct cell taps)
completedPatterns 0 .. 64     (full paths repeated)
mistakes         0 .. 128     (wrong-cell taps)
bestStreak       0 .. 256     (best uninterrupted correct-step streak)
durationMs       5_000 .. 35_000
```

## Manifest

`arcade/cabinets/neon-grid/manifest.mjs` (`neonGridManifest`):

- `manifest_version: 1`, `game_id: neon_grid`, `source_kind: native_neon_import`.
- `original/current` `360×640`, `clone_policy: preserve_original_size` (clone
  guard fails if a future edit resizes it without a migration flag).
- `authority_mode: server_round_authoritative`, `ticket_mode: server_awarded`,
  `challenge_mode: server_observed`.
- `entry_file` / `adapter_module` / `scripts` / `styles` all under
  `arcade/cabinets/neon-grid/` (never `game/*`, never absolute/`..`).
- `forbidden_capabilities` enumerates every barred capability; `requested_capabilities`
  is empty. No external network / payment / global-auth capability is requested.
- `test_selectors: { panel: .ngg-panel, stage: .ngg-stage, chrome: .ngg-head }`.

## Adapter behaviour

`arcade/cabinets/neon-grid/adapter.mjs` exports the import-loader trio
`{ adapter, contract, createGame }`:

- Validates against the Phase 1i frame contract (`frameContractId: neon_grid`,
  `360×640`) and **references** the built-in contract (re-exports
  `getContract('neon_grid')`) rather than shipping a divergent copy.
- Declares the full lifecycle (`onMount`/`onUnmount`/`onResize`/`onFocus`/`onBlur`/
  `onServerState` + `onRoundStarted`/`onRoundAccepted`/`onRoundRejected`).
- `createGame(options)` forwards the floor's round/leave hooks to the imported
  game factory (the runtime passes `hooks.gameOptions` through).
- Fails closed if the manifest/adapter is invalid.

The imported game (`neon-grid-game.mjs`) exposes `getRoot()` so the runtime owns
the cabinet frame (and its coordinate mapping); input is mapped to native space by
the frame, so DOM hit-testing on the scaled grid is already correct.

## Frame contract

`neon_grid` is added to `arcade/cabinet-frame-contract.mjs` `GAME_CONTRACTS` as a
first-class production contract:

```
native_width: 360, native_height: 640
scale_mode: fit-contain
clone_policy: preserve_original_size
allow_visual_skinning: true, allow_logic_resize: false
```

Tests fail if the current dimensions drift without a migration flag.

## Server catalog activation

`workers/arcade/src/catalog.mjs` adds `neon-grid-01` (`status: live`,
`ticket_enabled: true`, `machine_id: grid`). `ticketedMachineIds()` now includes
`grid`, so the Durable Object (and dev shim) create a `grid` occupancy machine
(one-occupant-per-machine, independent from `pulse`/`signal`; migration-safe for
existing rooms). The catalog is the authority — client adapter presence alone
never activates play.

## Round authority

`workers/arcade/src/round-authority.mjs` registers a `neon_grid` ruleset in the
existing registry (keyed by `cabinet_type`, resolved server-side from the catalog
by `machine_id`). The round record carries `round_id`, `cabinet_id`,
`cabinet_type`, `ruleset_version`, player/session id, start time, expiry,
submission status and the ticket award.

Server rejects: non-occupant start/submit, wrong cabinet, wrong cabinet type,
wrong ruleset version, unknown/duplicate/expired round, malformed or impossible
results (score / correctSteps / completedPatterns / mistakes / bestStreak /
duration out of bounds), client-supplied ticket amounts, and any cross-cabinet
result (a Pulse Tap or Signal Sprint result submitted to Neon Grid, or a Neon Grid
result submitted to another cabinet type).

## Ticket formula

`workers/arcade/src/neon-grid.mjs` `computeNeonGridTickets`:

```
base grade:  S=24  A=17  B=12  C=7  D=3  F=0
pattern bonus:  min(8, completedPatterns)
streak bonus:   bestStreak >= 32 → +5 ; >= 16 → +3 ; else 0
mistake penalty: -min(5, floor(mistakes / 4))
clamp:          [0, 38]   (the natural max is 24+8+5 = 37; 38 is a defensive ceiling)
```

The client may show an estimate; the server response is final. Internal arcade
points only.

## Challenge integration

`workers/arcade/src/challenges.mjs` adds three enabled challenges (rewards are
internal-only: a session-bound achievement badge and/or a server-computed ticket
bonus — never a transferable/external value):

- `grid-rookie` — complete one Neon Grid round → `grid-rookie` badge.
- `clean-grid` — finish a Neon Grid round with ≤ 2 mistakes → `clean-grid` badge.
- `three-cabinet-tour` — complete a Pulse Tap, Signal Sprint **and** Neon Grid
  round this session (`allCabinets` metric) → `circuit-voyager` badge.

`workers/arcade/src/achievements.mjs` adds the matching badges. Progress is driven
only by authoritative accepted rounds (the DO/dev-shim now pass `mistakes` to
`recordRoundAccepted`); a client cannot force progress or grant itself a badge.

## Ledger / feed integration

Neon Grid ticket awards create normal ledger entries (`source: grid`,
`cabinet_type: neon_grid`). The public event feed shows only safe summaries
("A earned tickets at Neon Grid", "A completed Three Cabinet Tour", "A unlocked
Circuit Voyager"). Private balances/ledger/inventory are never exposed to other
clients.

## Tests

- `tests/arcade/neon-grid.test.mjs` — ticket formula + result validation.
- `tests/arcade/neon-grid-round-authority.test.mjs` — round lifecycle + cross-game
  rejection.
- `tests/arcade/neon-grid-adapter.test.mjs` — manifest/adapter validation, frame
  contract + clone guard, catalog/registry activation + fail-closed.
- Extended: `catalog.test.mjs` (active cabinet + `grid` machine),
  `multi-cabinet.test.mjs` (three-cabinet shared balance/ledger/redemption),
  `challenges.test.mjs` (grid challenges + claims).
- Browser: `frame-contract.spec.mjs` (Neon Grid frame across viewports + round
  flow), `two-client.spec.mjs` (full product flow: activation, occupancy,
  authority, ledger, combined-balance redemption, challenges, feed, reconnect).

Total unit tests: **214** (was 173). Browser specs: frame-contract + two-client.

## Manual validation

```bash
# unit
node --test tests/arcade/*.test.mjs

# frame contract (dev shim + cached Playwright)
PW_REQUIRE_BASE=<playwright/package.json> bash tests/arcade/run-frame-contract.sh

# two-client (dev shim)
PW_REQUIRE_BASE=<playwright/package.json> bash tests/arcade/run-two-client.sh

# real Worker/DO (Node 22)
nvm use 22 && cd workers/arcade && npm run dev   # wrangler dev on :8787
# then, from repo root with a static server on :8080:
BASE_URL=http://localhost:8080 WS_URL=ws://localhost:8787/arcade/ws \
  bash tests/arcade/run-two-client.sh
```

## Known limitations

- The MAX_PAYOUT ceiling (38) is above the natural formula maximum (37); it is a
  defensive cap, not a reachable award.
- Neon Grid re-activates from scratch on a full page reload (fresh module state);
  within a single page session it activates once and persists across WebSocket
  reconnects.
- The mini-game is intentionally simple so server validation stays bounded and
  deterministic; it is a real, playable game (no placeholder wiring), but the
  automated round tests drive the server path directly (as Pulse/Signal do).

## Next phase options

- Generalize the per-cabinet `*_round_start/submit` messages into a single generic
  adapter round protocol (Neon Grid added them in the existing per-game style for
  backwards compatibility).
- Import a second cabinet through the same path to retire more hand-wired floor
  code.
- A small visual polish pass / reduced-motion audit on the grid reveal animation.
