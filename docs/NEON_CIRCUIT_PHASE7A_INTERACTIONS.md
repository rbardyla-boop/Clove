# Neon Circuit — Phase 7A: Interaction Zones / Action Prompts

**Status:** implemented, local-only, **no deploy**. Second City Gameplay Kernel layer.
**Parents:** `docs/NEON_CIRCUIT_GAMEPLAY_CHARTER.md`, `docs/NEON_CIRCUIT_CITY_GAMEPLAY_KERNEL.md` §6.
**Not:** rewards · economy · ownership · accounts · shop/marketplace zones · combat.

## What 7A adds

A pure interaction-zone kernel (`arcade/city/city-interactions.mjs`) that makes the city loop legible:
a player near a zone sees an **action prompt** ("Enter arcade"). The prompt is **local display**; any
action that changes canonical state is **server-confirmed in Phase 7E**. 7A defines the model + the
`action_request` shape 7E will validate.

```
INTERACTION_KINDS        arcade_entry · block_travel · district_event · activity_board · block_preview
ACTION_REQUEST_TYPE      kind → arcade_entry_request / block_travel_request / district_event_ack /
                         activity_board_view / block_preview_view  (the 7E-confirmable vocabulary)
pointInZone              rectangle {x,y,w,h} or circle {cx,cy,radius}
validateInteractionZone  deny-by-default: rejects unknown/forbidden kinds, bad bounds/id, oversized or
                         economy/ownership/gambling/crime copy in label/prompt, non-public-safe zones
nearestInteractionZone   highest-priority VALID zone containing the point; stable tie-break by zone_id
actionRequestFor         { action_kind, action_request_type, zone_id, city_id, … } — no private fields
deriveInteractionZones   derive the canonical physical zones from a block's public layout
```

## Authority — a prompt authorizes nothing

The client detects nearby zones **for display only**. The server stays the authority for any action:
the arcade-entry zone is derived from the existing **server-gated portal** (`city-block.mjs`
`enterPortal`), so wiring this model to the live prompt changes **no authority** — the portal is still
server-gated, and an out-of-zone request is still denied server-side (verified by the city-authority
regression). Phase 7E adds explicit server-confirmed receipts for the full action set.

## How it wires to the existing client (no regression)

`deriveInteractionZones(cityId, layout)` yields one **arcade_entry** zone per portal — a
backward-compatible **superset** of the portal object (keeps `id/x/y/w/h/target/label`), plus the kernel
fields (`zone_id`, `kind`, `priority`, `action_request_type`, `public_safe`). `city-scene.js`'s
`portalUnder()` now resolves the active zone via `nearestInteractionZone(...)` filtered to
`arcade_entry`, so the existing prompt + `enterPortal(zone.id)` path behaves **exactly as before** — the
model now *powers* the live prompt. Zones are re-derived on every (re)connect/travel.

The other kinds (`block_travel`, `district_event`, `activity_board`, `block_preview`) are surfaced by
their **existing panels** (district / event / activity / stewardship); 7A defines their model +
`action_request` shapes so 7E can server-confirm them. No new floor content was placed and no new
prompt UI was added, keeping the proven portal/district/event flows intact.

## Forbidden by construction

Zone kinds and label/prompt text are screened against an economy/ownership/gambling/crime regex
(shop, market, buy/sell, rent, own, wager, bet, gambl, loot, raid, cashout, payout, crypto, token, nft,
stake, multiplier, weapon, police, wanted, crime, …). A forbidden kind or any such copy fails validation,
so a malformed or economy-laden zone can never drive a prompt or produce an action request.

## Validation

```
node --test tests/arcade/city-interactions.test.mjs    # 13 pure unit tests
bash  tests/arcade/run-city-interactions.sh            # 14-check browser smoke (model drives live prompt)
node --test tests/arcade/*.test.mjs                     # 598 arcade unit (585 + 13), green
bash  tests/arcade/run-city-authority.sh               # portal regression — green (portalUnder refactor safe)
node  scripts/check-city-build-size.mjs                 # 0.804 MB / 0.221 gz — GTA-80 within
cd workers/arcade && wrangler deploy --dry-run          # 195.09 KiB / 42.84 gz — byte-identical (no Worker change)
```

Files: `arcade/city/city-interactions.mjs` (new pure kernel), `arcade/city/city-scene.js` (portal prompt
now model-driven + test hooks), `tests/arcade/city-interactions.{test,spec}.mjs`,
`tests/arcade/run-city-interactions.sh`, this doc, `docs/PROJECT_CHARTER.md` (ADR-026). No Worker/DO, no
migration, no economy/ownership/accounts.
