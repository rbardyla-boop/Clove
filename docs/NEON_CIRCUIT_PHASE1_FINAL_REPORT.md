# Neon Circuit — Phase 1 Final Report (Release Candidate)

Status: **RELEASE CANDIDATE — validated, staged as a clean PR sequence.** Not yet
merged to `main` (no merge authorization was given for this closure workflow).

## Phase 1 summary

Phase 1 builds the **Neon Circuit Arcade**: a server-authoritative, multi-player
arcade floor running on a Cloudflare Worker + Durable Object, with three playable
cabinets, an internal arcade-ticket economy (points only — never money), a Prize
Counter, a Challenge Board with achievement badges, a public event feed, a cabinet
frame contract that preserves each game's native size, and an adapter + dynamic
import platform that let the third cabinet (Neon Grid) enter the floor through a
validated import path instead of hand-wired code.

Everything that can affect a player's balance, occupancy, inventory, or challenge
progress is decided by the server. Clients render and estimate; they never grant
themselves tickets, occupy a busy cabinet, or force challenge completion.

## Branch stack

```
origin/main  a7dd926   (Phase 1b + 1c already merged via PR #1/#2)
└── PR #4 / feat/neon-circuit-phase1e-server-tickets
    ├── 763c889  Phase 1d — Pulse Tap gameplay
    └── 9b627ae  Phase 1e — server-authoritative tickets
        └── feat/neon-circuit-phase1f-arcade-loop          95c128b  Phase 1f
            └── feat/neon-circuit-phase1g-signal-sprint      6d6cf38  Phase 1g
                └── feat/neon-circuit-phase1h-challenge-board  b210c86  Phase 1h
                    └── feat/neon-circuit-phase1i-cabinet-frame-contract  2d858ce  Phase 1i
                        └── feat/neon-circuit-phase1j-cabinet-adapter-sdk   b66704c  Phase 1j
                            └── feat/neon-circuit-phase1k-dynamic-adapter-loader  3ed7b5a  Phase 1k
                                └── feat/neon-circuit-phase1l-neon-grid  1522a38  Phase 1l (HEAD)
```

`feat/hiveworld-v0-sideband-simulator` is a **separate** side-band branch and is
**not** part of this product stack.

## Commit list (product stack, `origin/main..1l`)

```
1522a38  feat(arcade): add Neon Grid cabinet
3ed7b5a  feat(arcade): add dynamic cabinet adapter loader
b66704c  feat(arcade): add cabinet adapter SDK
2d858ce  feat(arcade): enforce cabinet game frame contracts
b210c86  feat(arcade): add challenge board and achievements
6d6cf38  feat(arcade): add Signal Sprint cabinet
95c128b  feat(arcade): add prize counter and arcade loop
9b627ae  feat(arcade): add server-authoritative Pulse Tap tickets
763c889  feat(arcade): add Pulse Tap cabinet mini-game
```

(Phase 1b `a521781` + Phase 1c `a728edf` are already on `origin/main`.)

## Product features delivered

```
Pulse Tap
Signal Sprint
Neon Grid
server-authoritative occupancy
server-authoritative rounds
server-computed ticket awards
ticket ledger
Prize Counter
room/session-bound inventory
cosmetic equip/unequip
Challenge Board
achievement badges
public arcade event feed
cabinet native-size frame contract
adapter SDK
dynamic import loader
fail-closed unsupported adapters
```

## Server authority model

- **Worker + Durable Object** (`workers/arcade/`): the `ArcadeRoom` DO owns the
  authoritative room state — per-cabinet occupancy (one occupant per machine,
  monotonic `rev`, stale-lock alarm), ticket balances, rounds, ledger, inventory,
  equips, challenge progress, achievements, and the public event feed. Survives
  hibernation via the WebSocket Hibernation API.
- **Pure, transport-agnostic modules** under `workers/arcade/src/` are shared
  byte-for-byte by the DO, the local dev shim, and the Node unit tests, so what the
  tests validate is what production runs.
- **Round authority**: `round-authority.mjs` resolves the cabinet type + ruleset +
  ticket formula server-side from the catalog by `machine_id`. A client can never
  pick its own validator/formula, submit another cabinet's result, grant itself
  tickets, occupy a busy cabinet, double-submit, submit an expired/forged round, or
  force challenge completion.
- **Privacy**: balances, ledger, and full inventory are owner-only. Other clients
  see only public-safe state (occupancy, equipped cosmetics, the event feed).

## Cabinet list

| Cabinet | Type | Machine | Ruleset | Native | Entry path |
|---|---|---|---|---|---|
| Pulse Tap | `pulse_tap` | `pulse` | `pulse-tap/1` | 360×640 | hand-wired (built-in adapter) |
| Signal Sprint | `signal_sprint` | `signal` | `signal-sprint/1` | 360×640 | hand-wired (built-in adapter) |
| Neon Grid | `neon_grid` | `grid` | `neon-grid-v1` | 360×640 | **adapter/import path** |

`circuit-match-01` remains a `coming_soon` catalog placeholder (not playable).

## Ticket loop

Each cabinet has a pure, bounded, server-side ticket formula
(`tickets.mjs` / `signal-sprint.mjs` / `neon-grid.mjs`). On an accepted round the
server computes the award, updates the single shared room/session balance, appends
a ledger entry, drives challenge progress, and broadcasts a public-safe "earned
tickets" event. Client estimates are advisory only. **Tickets are internal arcade
points — no money, no cash value, not transferable off the session.**

## Prize Counter

`prize-authority.mjs` redeems tickets for session/room-bound cosmetics: cost comes
from the catalog (never the client), balance is checked + decremented server-side,
unique items can't be redeemed twice, you can only equip what you own, and there is
no path to move an entitlement off its owning session.

## Challenge Board

`challenges.mjs` tracks server-authoritative challenges driven only by accepted
rounds / ticket awards / redemptions: Pulse Rookie, First Signal, Two Cabinet Tour,
Clean Signal, Counter Regular, Ticket Starter, and the Phase 1l additions Grid
Rookie, Clean Grid, and Three Cabinet Tour. Rewards are internal-only (a badge
and/or a small server-computed ticket bonus).

## Achievements

`achievements.mjs` grants session-bound badge entitlements that reuse the Phase 1f
inventory (one inventory system, equip-compatible through the existing cosmetic
path). Idempotent: a badge is never duplicated. New Phase 1l badges: Grid Rookie,
Clean Grid, Circuit Voyager (all three cabinets).

## Public event feed

`events.mjs` keeps a bounded (≤50) room-wide feed of public-safe summaries (ticket
awards, challenge completions, achievement unlocks, cosmetic equips, redemptions).
Entries never carry a private balance, ledger detail, or hidden inventory.

## Cabinet Frame Contract

`cabinet-frame-contract.mjs` makes each game's native logical size a **contract**:
native `360×640`, `fit-contain` (uniform scale, never stretch/crop), and a clone
guard that fails if `current` size drifts from `original` without an explicit
migration flag. The frame runtime (`cabinet-frame.js`) measures, scales, centers
(letterbox/pillarbox), and maps input back into native coordinates.

## Adapter SDK

`cabinet-adapter-sdk.mjs` + `game-import-manifest.mjs` define the safe entry path:
every cabinet enters through an **adapter** that declares its identity, frame
contract, native size, authority/ticket/challenge modes, input schema, selectors,
lifecycle and clone policy, validated against the frame contract. Import manifests
pin original/current size, restrict code to arcade-local paths (never `game/*`),
and must request none of the forbidden capabilities (payments, external network,
real-money/transfer, global auth, DOM escape, crypto wallet).

## Dynamic Adapter Loader

`cabinet-adapter-registry.mjs` + `cabinet-import-loader.mjs` +
`cabinet-adapter-runtime.js` form the controlled registry and dynamic import rail:
built-in adapters are statically registered; imported adapters are validated,
hard-path-checked, dynamically imported, and registered **disabled** — playable
only after the server catalog activates them. Every step **fails closed**: an
unknown/invalid adapter renders *Unavailable* with no crash, and diagnostics
(test-only) never leak private state.

## Neon Grid import proof

Neon Grid is the first production cabinet to enter through the loader rather than
hand-wired floor code. Proven chain (each step fails closed):

```
server catalog activation (neon-grid-01 live + ticket_enabled)
→ loadImportedAdapter (manifest + adapter validation)
→ cabinet_type match
→ enableImportedAdapter (controlled registry)
→ resolveAdapterForCabinet (catalog → registry resolution)
→ mountImportedGame (frame contract preservation + lifecycle routing)
→ server-authoritative round validation → ticket award → ledger → challenge → feed
```

## Testing summary

- **214 / 214** unit tests pass (`node --test tests/arcade/*.test.mjs`).
- Coverage spans catalog, round authority (per cabinet + cross-cabinet rejection),
  ticket formulas, ledger, prize authority, challenges + integration, achievements,
  event feed, frame contract math + clone guard, adapter SDK, adapter loader, and
  multi-cabinet (now three-cabinet) shared balance/ledger/redemption.
- Browser: `frame-contract.spec.mjs` (frame preservation across viewports + round
  flow for all three cabinets) and `two-client.spec.mjs` (full product flow:
  occupancy, authority, privacy, three-cabinet ledger, combined-balance redemption,
  challenges, feed, reconnect).

## Real Worker/DO validation summary

Run under Node 22 with `wrangler dev` (local `workerd`) on `:8787` and a static
server on `:8080`:

- `two-client.spec.mjs` → **TWO-CLIENT VALIDATION: PASS**
- `frame-contract.spec.mjs` → **FRAME CONTRACT VALIDATION: PASS**
- **Zero console / page errors.**
- Worker/DO bundle clean (`wrangler deploy --dry-run`): 70.29 KiB / 14.00 KiB gzip,
  `ARCADE_ROOM` Durable Object binding present.

The same assertions pass against the local dev shim (Node 18), which reuses the
production authority modules.

## Guardrail summary

Guardrail grep across the product surface is **clean**. The only matches are:
false positives (`token` inside CSS "design tokens"; `stake` inside "mistakes"),
non-goal statements in docs/comments, and forbidden-capability constants
(`external_payments`, `resale`, `crypto_wallet`, …) used **only to reject** imports.
No enabled money/crypto mechanics, no money-like UI copy, no transferable goods, no
HiveWorld bridge.

## Non-goals held

```
no real money
no crypto
no blockchain
no token/NFT mechanics
no cash-out
no staking/yield/resale
no gambling/wagering
no HiveWorld bridge
no AR/geospatial layer
no land ownership
no production account inventory
no external payment support
```

## Known limitations

```
room/session-scoped balance/inventory/challenges/feed
single persistent main DO behavior in local workerd
not production account identity
adapter dynamic loading production path shaped but still conservative
imported production cabinet proven with Neon Grid, more games still need per-game rulesets
frame size fixed 360×640 for current games
DOM transform scaling may need DPR-specific work for future canvas/WebGL games
stack currently deep until PR sequence lands
```

## Release-candidate status

Phase 1 is a **release candidate**. It is fully validated locally (unit + dev-shim
browser + real Worker/DO browser) with clean guardrails and a clean Worker/DO
bundle. It is **staged as a clean, documented PR sequence** (see
`NEON_CIRCUIT_MERGE_SEQUENCE.md`); no merge to `main` has been performed because no
merge authorization was provided. Recommended next step before Phase 2:
land the PR sequence and tag `phase1-arcade-rc1` (see
`NEON_CIRCUIT_PHASE2_READINESS.md`).
