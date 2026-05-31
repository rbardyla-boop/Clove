# Neon Circuit — Phase 1f: Arcade Loop Expansion

Phase 1f expands Neon Circuit from "one validated cabinet with server-authoritative
tickets" into a small but coherent arcade loop:

```
occupy cabinet → play Pulse Tap → earn server tickets → visit Prize Counter
→ redeem an account/session-bound cosmetic → equip it → other clients see the
safe public cosmetic state
```

It is a product-path sprint. It is **not** a HiveWorld task, not a crypto/economy
task, and not a real-money task.

## Summary

- Server-authoritative **cabinet catalog** + room-visible registry.
- Per-session server **ticket ledger** (every ticket-affecting event recorded).
- Server-authoritative **Prize Counter**: redeem arcade tickets for cosmetics.
- **Account/session-bound cosmetic inventory** + equip/unequip.
- A small **arcade zone shell** (groundwork for future multi-floor work).
- Full unit tests + a two-client browser validation of the whole loop.
- Phase 1b occupancy and Phase 1e ticket award math are unchanged.

## Scope

Included: cabinet catalog/registry, ticket ledger, Prize Counter, redemption,
session-bound inventory, cosmetic equip/unequip, public cosmetic state, zone
shell, Prize Counter UI, tests, two-client validation, this doc.

## Non-goals (explicitly NOT in this phase)

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
- no production account inventory

Arcade tickets are internal, room/session-scoped points. Prizes are cosmetics
with no cash value and no transfer/resale path. "Redeem", "unlock" and "equip"
are used throughout — never "buy/sell/trade".

## Branch dependency on PR #4

This work is branched off **PR #4** (`feat/neon-circuit-phase1e-server-tickets`,
HEAD `9b627ae`), which is open and not yet merged into `main`. Phase 1f is on
`feat/neon-circuit-phase1f-arcade-loop` and is therefore **stacked on PR #4** — it
cannot be opened cleanly against `main` until PR #4 lands (it would otherwise also
carry Phase 1d + 1e). No push/PR is performed in this phase.

## Cabinet catalog (`workers/arcade/src/catalog.mjs`)

Server-authoritative. Fields: `cabinet_id, machine_id, display_name, cabinet_type,
zone_id, position_hint, status, ticket_enabled, min_players, max_players,
ruleset_version, public_description`.

- `pulse-tap-01` — live, ticket-enabled, `machine_id: pulse` (links to Phase 1b occupancy).
- `circuit-match-01`, `signal-sprint-01` — `coming_soon`, not playable, not ticketed.

`isPlayableCabinet()` returns true only for live + ticket-enabled cabinets, so
coming-soon cabinets can never be occupied/played.

## Ticket ledger (`workers/arcade/src/ledger.mjs`)

Per-session, owner-private. Each entry: `ledger_id, player_id, server_time,
event_type, delta, balance_after, source, cabinet_id, prize_id, public_safe_summary`.
Events: `tickets_awarded`, `tickets_spent`. Entries are idempotent by a
deterministic `ledger_id`, so a replayed network frame cannot double-record an
award or spend. Owners may request their full ledger; other clients never see it.

## Prize Counter (`workers/arcade/src/prize-authority.mjs` + catalog)

Prizes: `prize_id, display_name, category, equip_slot, cost_tickets, bound_to
(session), rarity_label, unique, enabled, description`. Initial: `founder-badge-local`
(10), `pioneer-badge-local` (15), `neon-visor` (20), `cabinet-glow-blue` (25),
`pulse-jacket` (35), plus one disabled placeholder.

Server rules: validates the prize, reads **cost from the catalog** (client cost/
discount/balance ignored), checks + decrements the balance, creates a
session-bound entitlement, rejects duplicate unique purchases, and records a
`tickets_spent` ledger entry. The client cannot mint, transfer, sell, or cash out
goods, cannot spend negative tickets, and cannot set its own balance.

## Inventory / equip model

One equipped item per slot: `avatar_head, avatar_body, badge, cabinet_skin`. You
can only equip an item you own; equipping replaces the prior item in that slot;
unequip clears the slot. Inventory + equips are **session/room-scoped** (clearly
not a production account inventory). On reconnect the owner re-requests inventory
and equips and the server restores them.

## Zone shell

Zones: `main_floor, cabinet_row, prize_counter, lounge`. Each cabinet belongs to a
zone; the Prize Counter belongs to `prize_counter`. Zones are surfaced in the
catalog payload and shown in the Prize Counter panel. No multi-floor travel yet.

## Protocol messages

Client → server: `cabinet_catalog_request`, `prize_catalog_request`,
`ticket_ledger_request`, `inventory_request`, `prize_redeem`, `cosmetic_equip`,
`cosmetic_unequip`.

Server → client: `cabinet_catalog`, `prize_catalog`, `ticket_ledger`,
`inventory_state`, `prize_redeemed`, `prize_rejected`, `cosmetic_equipped`,
`cosmetic_unequipped`, `cosmetic_state` (public broadcast).

(All Phase 1b occupancy + Phase 1e ticket messages are unchanged.)

## Privacy model

- **Private to owner:** ticket balance, full ledger, full inventory. The submitter
  identity for every owner action is the socket's joined player id — never a
  client-supplied field.
- **Public broadcast (`cosmetic_state`):** per-player equipped cosmetics as
  `{ slot: { prize_id, display_name } }` only — no balance, no ledger, no full
  inventory. Other clients see what you have equipped, nothing more.

## Rejection reasons

Catalog/prize: `malformed`, `unknown_prize`, `prize_disabled`, `bad_cost`.
Redemption: `insufficient_tickets`, `duplicate_redemption`, `already_owned`,
`no_identity`. Equip/unequip: `unknown_prize`, `not_owned`, `bad_slot`,
`not_equipped`. (Phase 1e round/ticket reasons still apply.)

## Tests (`tests/arcade/`)

- `catalog.test.mjs` — A (cabinet catalog) + catalog parts of C.
- `ledger.test.mjs` — B (ledger record/dedup/balance match/privacy-by-player).
- `prize-authority.test.mjs` — D (redemption) + E (inventory/equip) + cross-player isolation (F).
- `two-client.spec.mjs` / `run-two-client.sh` — G (browser, see below).
- Phase 1e suites unchanged and still green.

Run: `node --test tests/arcade/*.test.mjs`.

## Manual validation

`wrangler dev` needs Node ≥ 22; under Node 18 use the dev shim (reuses the same
authority modules):

```bash
PORT=8787 node workers/arcade/dev-shim.mjs        # terminal 1 (TEST ONLY)
npx serve -p 8080 .                               # terminal 2
# open two tabs with ?id=alpha / ?id=bravo and ?ws=ws://127.0.0.1:8787/arcade/ws
bash tests/arcade/run-two-client.sh               # scripted Playwright run
```

Two-client flow validated: A occupies + earns tickets; B cannot steal/submit;
A redeems + equips a cosmetic; B sees A's public badge but not A's balance/ledger;
B spends only its own tickets; A reconnects and balance/inventory/equip are
restored; no console errors.

## Known limitations

- Inventory/ledger/balances are room/session-scoped and retained for the room's
  lifetime — **not a production account inventory**, no eviction.
- The two-client browser test drives the loop through a gated `?test=1` client
  hook (real rounds are 30s; non-occupants have no game UI). The hook only invokes
  existing client request methods; it never grants tickets or moves authority
  client-side.
- Single ticketed cabinet (`pulse-tap-01`); the other cabinets are `coming_soon`.
- Floor cabinet row keeps the Phase 1c visual cabinets; catalog integration is
  intentionally small (zones + Prize Counter panel) to avoid destabilising 1d/1e.

## Next phase options (not started)

- Land + merge PR #4, then open Phase 1f against `main`.
- Additional ticketed cabinets reuse `round-authority` + a wider `TICKETED_MACHINES`.
- Multi-floor zone travel once the zone shell proves out.
- A deliberate identity design (still no external accounts) if cross-session
  retention is ever wanted — would require its own security review.
