# Neon Circuit — Phase 1j: Cabinet Import SDK + Game Adapter Harness

## Summary

Phase 1j turns the Phase 1i frame contract into an **arcade platform rule**:
future games enter through a **cabinet adapter** or they do not enter. Every
cabinet game (native or cloned/imported) now declares an adapter that pins its
identity, frame contract, native size, server authority/ticket/challenge modes,
input schema, selectors and clone policy — and an import manifest that pins the
original size and bars forbidden capabilities. Adapters are validated against the
Phase 1i Cabinet Frame Contract; an invalid or unsupported adapter **fails closed**
(the cabinet shows "Unavailable" and can never be played).

This is platform hardening: no new production game, no gameplay rewrite, no server
authority change, no economy change. The Worker/Durable-Object bundle is
byte-identical to Phase 1h/1i (the adapter layer is entirely client-side).

## Branch / base

- Branch: `feat/neon-circuit-phase1j-cabinet-adapter-sdk`
- Base: `feat/neon-circuit-phase1i-cabinet-frame-contract` (`2d858ce`) — **stacked**.

PR #4 (Phase 1e), Phase 1f, 1g, 1h and 1i were all still open and unmerged during
this workflow (this workflow authorized no merges), so Phase 1j is a deliberate
stacked continuation and cannot be opened cleanly against `main` until the
upstream product branches land.

## Scope

- A pure adapter SDK (`arcade/cabinet-adapter-sdk.mjs`): mode enums, `validateAdapter`
  (against the Phase 1i frame contract), `cabinetRenderState`/`playableCabinets`
  resolver, the client adapter registry, and `planAdapterMount` (fail-closed logic).
- A pure import manifest schema (`arcade/game-import-manifest.mjs`): `validateManifest`
  + `FORBIDDEN_CAPABILITIES`, enforcing the clone-size guard and arcade-local paths.
- Pure adapter definitions for the current games (`arcade/adapters/*.mjs`).
- A browser adapter runtime (`arcade/cabinet-adapter-runtime.js`) that mounts an
  adapter into the cabinet frame, drives lifecycle hooks, exposes coordinate
  mapping, and fails closed; plus unsupported-cabinet styling (`arcade/cabinet-adapter.css`).
- A test-only sample import fixture (`arcade/cabinets/sample-import-game/`).
- Unit + browser tests; full product + frame regression.

## Non-goals (explicitly NOT in this phase)

- no new production game unless separately scoped
- no gameplay rewrite
- no server authority weakening
- no economy expansion
- no real money
- no crypto
- no blockchain
- no token/NFT mechanics
- no cash-out
- no staking/yield/resale
- no gambling/wagering
- no HiveWorld bridge
- no AR/geospatial layer
- no land ownership
- no external payment support

## Relationship to the Phase 1i frame contract

The adapter SDK **references** the Phase 1i contract — it does not duplicate or
bypass it. `validateAdapter` resolves the adapter's `frameContractId` via
`cabinet-frame-contract.mjs#getContract` and requires the adapter's `nativeWidth`/
`nativeHeight` to match the contract exactly, so an adapter can never quietly
disagree with the frame's native size. The runtime mounts the game inside its
Phase 1i frame and exposes that frame's coordinate mapping.

## Adapter interface

```
gameId, cabinetId, cabinetType, displayName, frameContractId,
nativeWidth, nativeHeight, rulesetVersion,
authorityMode, ticketMode, challengeMode,
inputSchema, lifecycle, selectors, capabilities, clonePolicy
```

- `authorityMode` ∈ `client_local_only | server_round_authoritative | server_full_authoritative | coming_soon`
- `ticketMode` ∈ `none | server_awarded | display_only_estimate | coming_soon`
- `challengeMode` ∈ `none | server_observed | server_claimable | coming_soon`
- `lifecycle` must declare the required hooks `onMount, onUnmount, onResize, onFocus, onBlur, onServerState` (optional: `onRoundStarted, onRoundAccepted, onRoundRejected`).
- `clonePolicy` must be `preserve_original_size`.

`validateAdapter` rejects: bad/missing id fields, unknown frame contract,
native-size mismatch, bad authority/ticket/challenge mode, bad selectors, missing
required lifecycle hooks, bad clone policy.

## Import manifest schema

```
manifest_version, game_id, source_name, source_kind,
original_width, original_height, current_width, current_height, aspect_ratio,
entry_file, styles, scripts, input_methods,
authority_mode, ticket_mode, challenge_mode,
allowed_asset_paths, forbidden_capabilities, requested_capabilities,
clone_policy, migration_flag, test_selectors, notes
```

`validateManifest` enforces: positive-integer dims; `current_* === original_*`
unless `migration_flag: true`; aspect matches current dims; valid modes; entry
file / scripts / styles / assets under `arcade/cabinets/` (never `game/*`, never
`..`); and that no **forbidden capability** is requested. Forbidden capabilities:
`external_payments, external_network (unless explicitly approved), real_money,
transfer, resale, dom_escape, global_auth, crypto_wallet`.

## Clone / import size rules

Imported games preserve their original canvas/layout size. A size change requires
`migration_flag: true` in the manifest (and a migrated frame contract) — otherwise
`validateManifest` fails with `size_changed_without_migration`. This mirrors the
Phase 1i clone guard at the import boundary.

## Authority / ticket / challenge mode rules

The adapter declares how a game integrates with the server. The current games use
`server_round_authoritative` / `server_awarded` / `server_observed`. The SERVER
remains the sole authority for ticket awards and challenge completion — the
adapter only declares capability; it cannot grant anything. A `client_local_only`
game (like the sample fixture) declares `none` for tickets/challenges.

## Catalog integration

The server catalog (`workers/arcade/src/catalog.mjs`, unchanged) decides which
cabinets are active. The client adapter registry decides how a supported active
cabinet renders. `cabinetRenderState(cabinet, hasAdapter)` resolves:

- active in catalog + valid adapter → **playable**
- active in catalog + no adapter → **unavailable** (shown, not playable)
- listed but not active → **coming_soon** (not playable)
- not in the catalog → **not_listed** (a client-only adapter is never playable)

Client adapter metadata never overrides server catalog state.

## Unsupported cabinet behavior

If a cabinet is active in the catalog but this client has no valid adapter, the
floor renders it `Unavailable` (greyed, non-interactive, LED "● unavailable") and
`activate()` refuses to occupy it. The adapter runtime fails closed: an unknown or
invalid adapter returns `{ ok: false, state: 'unavailable', game: null }` with no
frame and no crash. (No production cabinet currently triggers this — both active
cabinets have valid adapters — but the path is wired and tested.)

## Testing strategy

Unit (`node --test tests/arcade/*.test.mjs`, 135 → **157** total):
`cabinet-adapter.test.mjs` — A. adapter schema (valid Pulse/Signal adapters,
native-size match, bad authority/ticket/challenge mode, missing lifecycle, bad
selectors, unknown frame contract, bad clone policy); B. import manifest (valid,
resize-without-migration rejected, migration allowed, aspect mismatch, each
forbidden capability rejected, external-network default-deny + explicit-approve,
entry/asset outside `arcade/cabinets/` and `game/*` rejected); C. mount-plan logic
(valid → ordered lifecycle, invalid → fail closed, sample fixture validates with
its injected resolver); D. catalog/adapter integration (playable / unavailable /
coming_soon / not_listed, `playableCabinets`, registry resolution).

Browser (`tests/arcade/frame-contract.spec.mjs`) — C/F: both games mounted through
adapters; adapter exposes the 360×640 frame + coordinate round-trip; unknown
adapter fails closed (no overlay, no crash); render-state resolver classification;
plus the existing 4-viewport frame contract checks and in-frame round/ticket flow.

Regression (`tests/arcade/two-client.spec.mjs`) — full Pulse/Signal/Prize/Challenge/
achievement/event-feed/reconnect flow, unchanged.

## Manual validation

- Runtime: Node v22.22.3; Wrangler 4.95.0; `wrangler dev` (local workerd).
- Unit: **157/157**. Worker/DO bundle clean (61.74 KiB, identical to Phase 1i — no server change).
- Dev-shim: frame+adapter validation PASS (all viewports + adapter checks),
  two-client regression **48/48 PASS**.
- Real Worker/Durable Object: two-client regression **PASS** and frame+adapter
  **PASS**; zero console/page errors (external font-CDN / transient network noise
  filtered as non-app errors).

## Known limitations

- No production cabinet currently resolves to `unavailable` (both active cabinets
  ship adapters); the unsupported path is wired + tested via the fail-closed
  runtime and the pure resolver, not via a live production cabinet.
- The browser runtime keeps a fixed `FACTORIES` map (gameId → factory); a truly
  dynamic import pipeline (loading a cloned game's `entry_file` at runtime) is a
  future phase. The sample fixture is validated, not dynamically loaded.
- The sample import fixture is test-only and never registered/enabled in
  production.
- Lifecycle hooks are driven by wrapping the game's open/close; `onResize`/
  `onServerState` are declared/supported but not yet routed from the frame/room
  client (future wiring).

## Next phase options

- A dynamic import loader that fetches a cloned game's `entry_file` under a
  manifest-approved sandbox and mounts it via the runtime.
- Route `onServerState` / `onRoundStarted` etc. from the room client through the
  adapter to the game.
- A CLI/CI check that validates every `arcade/cabinets/*/manifest.mjs` on commit.
- Promote a vetted imported game from fixture to a real (separately scoped) cabinet.

## Stack note

```
main
└── PR #4 / feat/neon-circuit-phase1e-server-tickets   (OPEN — not merged)
        └── feat/neon-circuit-phase1f-arcade-loop            (local, stacked)
                └── feat/neon-circuit-phase1g-signal-sprint      (local, stacked)
                        └── feat/neon-circuit-phase1h-challenge-board    (local, stacked)
                                └── feat/neon-circuit-phase1i-cabinet-frame-contract  (local, stacked)
                                        └── feat/neon-circuit-phase1j-cabinet-adapter-sdk  (this branch)
```

Phase 1j is a deliberate stacked continuation. The product arcade path remains
entirely separate from HiveWorld.
