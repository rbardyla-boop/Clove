# Neon Circuit — Phase 7E: Server-Confirmed Interaction Receipts

**Status:** implemented, local-only, **no deploy**. First canonical Worker/DO protocol change of Phase 7.
**Parents:** `docs/NEON_CIRCUIT_GAMEPLAY_CHARTER.md`, `docs/NEON_CIRCUIT_CITY_GAMEPLAY_KERNEL.md` §6,
`docs/NEON_CIRCUIT_PHASE7A_INTERACTIONS.md`.
**Not:** economy · inventory · rewards · accounts · persistent ledger · ticket/Host-Rank/Stewardship/Trial coupling.

## What 7E adds

7A made interaction prompts *legible* (display only). 7E **closes the authority loop**: an action is only
real when the **server confirms it** against the player's CANONICAL position + the block's zones +
(for travel) adjacency, and answers with an **ephemeral, public-safe receipt**.

```
client → city_interaction_request { action_kind, zone_id?, target_city_id? }
server ← city_interaction_receipt { kind, receipt_id, action_kind, city_id,
                                    [zone_id|target|target_city_id], accepted, reason,
                                    issued_at, public_safe:true }
```

`SCHEMA_VERSION` 7 → 8 (additive). A client that ignores the new message still works.

## Authority model

The client sends an action *request*. The server validates:

- the action is a known interaction kind (deny-by-default);
- the player is joined with a canonical position (`this.state.players[playerId]` — **server-owned**);
- **arcade_entry**: the canonical position is inside the arcade zone (same inclusive rect test as the
  server portal gate `enterPortal`, on the same `PORTALS` geometry);
- **block_travel**: the target is a known block ADJACENT to the server-owned source
  (`validateRouteRequest` — the *same* gate as routing; no arbitrary teleport);
- **district_event / activity_board / block_preview**: display acknowledgments (well-formed view request
  in a valid block context; no state change).

A **forged position or `accepted` field in the request is ignored** — only `this.state` is authoritative
(proved by a unit test and the browser smoke: a request claiming `x:9999` is judged on the real server
position). The receipt is a direct reply to the requester.

## Single source of validation truth (no duplication)

The pure builder `arcade/city/city-interaction-receipts.mjs` is imported **unchanged** by the CityRoom DO
(`workers/arcade/src/city-room.ts`) and the dev-shim (`workers/arcade/city-dev-shim.mjs`), so both produce
byte-identical receipts. It **reuses the existing validators** rather than copying them: `validateRouteRequest`
for travel adjacency, `pointInZone` over the portal-derived arcade zone for entry. No divergent authority.

## What 7E deliberately does NOT do

- **No persistence / no ledger.** Receipts are ephemeral — computed and replied, never stored. No new DO,
  **no migration** (config-check still v1–v4).
- **No coupling.** The receipt never reads or writes tickets, prizes, Host Rank, Stewardship, or Block
  Trial; it carries no balance/credit/score field (asserted by tests).
- **No new authority for existing flows.** The proven `enterPortal` / `city_route_request` flows are
  unchanged and still work; 7E is the uniform server-confirmation primitive the kernel + future gameplay
  build on. (block_travel/arcade_entry receipts share the same validators as those flows.)
- **No economy / ownership / accounts.**

## Validation

```
node --test tests/arcade/city-interaction-receipts.test.mjs   # 10 pure unit tests
bash  tests/arcade/run-city-interaction-receipts.sh           # 12-check browser smoke (request → accepted/rejected)
node --test tests/arcade/*.test.mjs                            # 608 arcade unit (598 + 10), green
bash  tests/arcade/run-city-authority.sh                       # city client regression — green
bash  tests/arcade/run-two-client.sh                           # multi-client regression — green
bash  tests/arcade/run-frame-contract.sh                       # arcade cabinet regression — green
node  tests/arcade/check-production-config.mjs                 # PASS (DO bindings v1–v4; NO new migration)
node  scripts/check-city-build-size.mjs                        # 0.810 MB / 0.223 gz — GTA-80 within
cd workers/arcade && wrangler deploy --dry-run                 # compiles; 200.81 KiB / 44.25 gz (real Worker change, no migration)
```

Files: `arcade/city/city-interaction-receipts.mjs` (new pure builder), `arcade/city/city-block.mjs`
(SCHEMA 7→8), `workers/arcade/src/city-room.ts` + `workers/arcade/city-dev-shim.mjs` (additive handler,
parity), `arcade/city/city-net.js` + `arcade/city/city-scene.js` (client send/receive + test hooks),
`tests/arcade/city-interaction-receipts.{test,spec}.mjs`, `tests/arcade/run-city-interaction-receipts.sh`,
this doc, `docs/PROJECT_CHARTER.md` (ADR-027). No new DO, no migration, no economy/ownership/accounts.
**Local-only; not deployed.**
