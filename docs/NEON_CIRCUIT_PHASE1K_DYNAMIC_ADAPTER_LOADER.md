# Neon Circuit — Phase 1k: Adapter Runtime Hardening + Dynamic Import Loader

## Summary

Phase 1k closes the known Phase 1j limitations: the fixed `gameId → factory` map
is replaced by a controlled adapter **registry**; the sample import fixture is now
**dynamically loaded and mounted** through a safe import **loader**; adapter
**lifecycle hooks** (`onMount/onUnmount/onResize/onFocus/onBlur/onServerState`)
are actually routed; structured **runtime diagnostics** are exposed under test/
debug flags; and unsupported/invalid cabinets **fail closed**.

This is platform hardening for safe future cabinet imports: no new production
game, no gameplay change, no server authority change. The Worker/Durable-Object
bundle is byte-identical to Phase 1h–1j (the adapter layer is entirely
client-side).

## Branch / base

- Branch: `feat/neon-circuit-phase1k-dynamic-adapter-loader`
- Base: `feat/neon-circuit-phase1j-cabinet-adapter-sdk` (`b66704c`) — **stacked**.

PR #4 and Phases 1f–1j were all open and unmerged during this workflow (no merges
authorized), so Phase 1k is a deliberate stacked continuation and cannot be opened
cleanly against `main` until the upstream product branches land.

## Scope

- A controlled adapter registry (`arcade/cabinet-adapter-registry.mjs`).
- A safe dynamic import loader (`arcade/cabinet-import-loader.mjs`).
- Runtime hardening (`arcade/cabinet-adapter-runtime.js`): registry-backed
  factories, lifecycle routing, imported-game mounting, diagnostics, fail-closed.
- Frame additions: `registerContract` (runtime-registered contracts for imported
  games) + an `onResize` hook in the frame runtime.
- The sample fixture is dynamically loaded + mounted on a test-only path.
- Unit + browser tests; full product + frame regression.

## Non-goals (explicitly NOT in this phase)

- no new production game
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

## Relationship to Phase 1i and Phase 1j

Phase 1i made native game size a **frame contract**. Phase 1j added the **adapter
SDK + import manifest** rail. Phase 1k makes that rail **usable**: imported games
flow through `loadImportedAdapter` → registry → `mountImportedGame`, which builds a
Phase 1i frame from a runtime-registered contract. Adapters still validate against
the frame contract; the SDK validators are unchanged.

## Adapter registry (`cabinet-adapter-registry.mjs`)

Replaces the fixed factory map. Keeps the SDK registry (used by
`cabinetRenderState`) in sync. Functions: `registerBuiltInAdapter`,
`setBuiltInFactory`, `registerImportedAdapter`, `getAdapter`, `hasAdapter`,
`getRegistration`, `getFactory`, `isEnabled`, `listAdapters`, `listRegistrations`,
`resolveAdapterForCabinet`, `validateAdapterRegistration`.

Rules: built-in adapters validate + register statically; a **different** adapter
claiming a registered cabinet type is rejected (`duplicate_builtin` — production
cannot be replaced at runtime); imported adapters register only after validation,
**disabled/test-only** by default, can never **shadow a built-in**, and a
duplicate **enabled** import is rejected (replacing a still-disabled fixture is
allowed). `resolveAdapterForCabinet` only returns an imported adapter if the
server catalog cabinet is active **and** the import is enabled.

## Import loader (`cabinet-import-loader.mjs`)

`validateImportPath(path)` (pure) + `loadImportedAdapter(manifest, opts)` (async).
Order: validate manifest → validate every import path → dynamic `import()` the
adapter module → validate the imported adapter against its contract → register as
imported/disabled. Returns a structured `{ ok, adapter?, contract?, createGame?,
manifest?, reason?, details? }` and never throws to the app. `opts.importer` is
injectable for tests.

### Allowed import paths

- `arcade/cabinets/<game_id>/*.mjs` / `*.js` (arcade-local cabinet code only).

### Rejected import paths

- absolute URLs (`scheme://…`), `http(s)://`
- `data:` / `blob:` / `javascript:` schemes
- absolute paths (`/…`)
- `..` path traversal
- `game/*`
- anything outside `arcade/cabinets/`
- non-`.js`/`.mjs` files

External network scripts, external payments, real-money/transfer/resale, DOM
escape, global auth and crypto-wallet capabilities are rejected at manifest
validation (`FORBIDDEN_CAPABILITIES`); `external_network` is denied by default and
only allowed with an explicit `approvedExternalNetwork` opt.

## Lifecycle hook routing

The runtime wraps a game's open/close and the frame's recalc to route:
`onMount` (once, first open), `onFocus` (open), `onBlur` (close), `onUnmount`
(once, unmount), `onResize` (frame recalc / viewport change), `onServerState`
(public room/cabinet state, routed from the floor's `onState`). Hook exceptions
are caught and recorded as adapter errors — never app crashes. Imported games are
mounted by the runtime into a frame (`getRoot()` → `frame.mount`), so they get the
same lifecycle without self-managing a frame.

## Runtime diagnostics

`window.__cabinetAdapterRuntime` is exposed **only** under `?test=1` or
`?frameDebug=1`: `registeredAdapters()`, `mounts()`, `lastMountResult`,
`lastImportResult`, `lifecycleLog()`, `unsupportedCabinets()`, `adapterErrors()`,
and the mount/load functions for tests. It exposes **no** private balance, ledger,
inventory or challenge state. In normal mode none of these globals exist.

## Unsupported cabinet behavior

Unknown active cabinet type, invalid adapter, invalid manifest and dynamic-import
failure all resolve to **unavailable**: the floor renders the tile greyed +
non-interactive, `activate()` refuses to occupy it, no round can start, no crash,
and (only in test/debug) a console warning + a diagnostics entry are recorded.

## Catalog authority boundary

The server catalog (`workers/arcade/src/catalog.mjs`, unchanged) decides which
cabinets are active and their cabinet type. The client registry only decides how a
known cabinet type renders. An imported adapter without a catalog entry is
test-only; a `coming_soon` catalog entry is never made playable by adapter
presence; an active catalog entry with a missing/invalid adapter shows
unavailable. Client-only adapters can never create a playable cabinet.

## Tests

Unit (`node --test tests/arcade/*.test.mjs`, 157 → **173** total):
`cabinet-adapter-loader.test.mjs` — A. registry (built-in register, idempotent
re-register, duplicate/production-protection, invalid rejected, imported
test-only/disabled, cannot-shadow-builtin, duplicate-enabled rejected,
disabled-not-playable); B. import loader (path allow/reject matrix, valid fixture
load, invalid manifest/forbidden-capability rejected before import,
traversal/`game/*` rejected, structured `import_failed`, post-import
`invalid_adapter`/`no_adapter_export`).

Browser (`tests/arcade/frame-contract.spec.mjs`, `run-frame-contract.sh`) — C/D/E:
dynamic loader mounts the fixture in a frame at native 320×480 (no crop, aspect
preserved); lifecycle onMount/onFocus/onResize/onUnmount routed; lifecycle
exception caught + recorded; diagnostics exposed under test only + no private
leak; failed import fails closed + appears in diagnostics; normal mode exposes no
diagnostics globals — plus the existing Phase 1i/1j frame + adapter checks.

Regression (`tests/arcade/two-client.spec.mjs`) — full Pulse/Signal/Prize/
Challenge/achievement/event-feed/reconnect flow, unchanged.

## Manual validation

- Runtime: Node v22.22.3; Wrangler 4.95.0; `wrangler dev` (local workerd).
- Unit: **173/173**. Worker/DO bundle clean (61.74 KiB, identical to Phase 1j — no
  server change).
- Dev-shim: frame+adapter+fixture validation **78/78 PASS**; two-client
  regression **48/48 PASS**.
- Real Worker/Durable Object: two-client regression **PASS** and frame+adapter+
  fixture **PASS**; zero console/page errors (external font-CDN / transient
  network noise filtered as non-app errors).
- Reviews: inline security review of the loader (no CRITICAL/HIGH; fail-closed,
  arcade-local-only, no remote/data/blob, no authority change) + a local
  code-review pass (APPROVE, no CRITICAL/HIGH). The dedicated review sub-agents
  could not be spawned (account weekly agent limit reached); reviews were
  performed inline instead.

## Known limitations

- Dynamic mounting is wired for **local test fixtures** only; the production code
  path is shaped correctly but no production cabinet is dynamically loaded yet
  (server catalog must activate an imported adapter first).
- `validateImportPath` rejects literal `..`; URL-encoded traversal is not
  normalized but fails closed (resolves to a non-existent module → `import_failed`).
- `onServerState` is routed for built-in cabinets from public room state; built-in
  games do not yet consume it (declared/forwarded, ready for future games).
- Imported games are `client_local_only` in this phase; a server-authoritative
  imported game would need catalog + authority wiring (future).

## Next phase options

- Activate a vetted imported game through the server catalog (end-to-end import).
- A CI check that validates every `arcade/cabinets/*/manifest.mjs` on commit.
- Sandbox/iframe isolation for imported game code.
- Route `onServerState`/round hooks into built-in games that want them.

## Stack note

```
main
└── PR #4 / feat/neon-circuit-phase1e-server-tickets   (OPEN — not merged)
        └── …1f → …1g → …1h → …1i → …1j (all local, stacked)
                                          └── feat/neon-circuit-phase1k-dynamic-adapter-loader (this branch)
```

Phase 1k is a deliberate stacked continuation. The product arcade path remains
entirely separate from HiveWorld.
