# Neon Circuit — Phase 7F Multiplayer Proof Runbook (phone + desktop)

> Companion to `NEON_CIRCUIT_PHASE7_PLAN.md` §7F. This is the **proof artifact** that slice
> calls for: a repeatable, documented cross-device verification of the already-shipped City
> Gameplay Kernel. See also the per-slice docs `NEON_CIRCUIT_PHASE7A_INTERACTIONS.md`,
> `NEON_CIRCUIT_PHASE7B_COLLISION.md`, `NEON_CIRCUIT_PHASE7C_OBJECTIVES.md`,
> `NEON_CIRCUIT_PHASE7E_INTERACTION_RECEIPTS.md`, and `PRODUCTION_ROLLOUT_PLAN.md`.

## 1. Status

- **Phase 7F proof runbook.** Verification only.
- **Adds no authority, no message types, no gameplay.** It exercises the kernel that 7A/7B/7C/7D/7E
  already ship; it does not change it.
- **This document deploys nothing.** Running the runbook against production is a read-only
  observation of the live service; any deploy/upload remains a separately authorized step.
- **Phase 7F is otherwise the only unbuilt Phase-7 slice** (per the 2026-06-24 reality audit:
  7A/7B/7C/7D/7E shipped; 7C live on production since 2026-06-11).

## 2. Purpose

Prove, with two **real devices** (a desktop browser and a phone browser), that the shipped City
Gameplay Kernel holds end-to-end across devices: two players see each other, move under
server-authoritative collision, travel between blocks, trigger interaction-zone actions that the
server confirms against canonical position, enter and return from the arcade, and read consistent
presence / activity feed / district events — with no private or economic data leaking to either
client. Automated smokes already cover each subsystem in isolation against the dev shim and a
staging Durable Object; this runbook is the **consolidated, cross-device, human-observed** proof
that the automated harnesses cannot fully substitute for.

## 3. Preconditions

Record all of these in the evidence table (§8) before starting.

- **Under test:** branch / PR number / commit SHA (e.g. `origin/main @ <sha>`), and the bundle hash
  if testing a deployed environment.
- **Target environment** — pick one and state it explicitly:
  - **Local:** static server + city dev shim (`tests/arcade/run-city-*.sh` style). Lowest fidelity for
    cross-device (both devices must reach the host on the LAN).
  - **Staging:** the staging Worker / Durable Object URL (per `PRODUCTION_ROLLOUT_PLAN.md`). Preferred
    for a pre-production proof.
  - **Production:** `https://clovelearn.io/arcade/city/` — the live service. Read-only play only; no
    admin/test hooks (see §11).
- **Two devices:** one **desktop** browser and one **phone** browser (state OS + browser + version for
  each). Use the same origin URL on both.
- **Same origin:** both devices load the **same** city URL and the **same** block id, e.g.
  `…/arcade/city/?city=downtown-01`. The client derives its socket as
  `wss://<host>/arcade/city/ws?city=<id>` from `location.host` (no WebSocket subprotocol; the
  CityRoom DO answers a bare `101`).
- **Fresh sessions:** use private/incognito windows (or distinct profiles) so the two clients get
  distinct `player:` identities and do not share a session.
- **Network:** both devices online; if testing local/staging, both must be able to reach the host
  (same LAN or a tunnel). Note any VPN/firewall that could block the WS upgrade.
- **DevTools:** desktop devtools available (Console + Network). On phone, use remote debugging if
  available; otherwise rely on on-screen behaviour + screenshots.
- **No admin/test hooks in production:** do not enable `__neon_city` test affordances, debug query
  params, or any flag flip against production.

## 4. Systems covered

The runbook must exercise the full kernel path (each maps to a shipped slice):

| # | System | Slice | Server-owned truth |
|---|---|---|---|
| S1 | Movement (intent-only input) | 7B | `applyInput` clamps dt + speed; client sends `dx/dy/seq/ts/dt` only |
| S2 | Collision / no visible escape | 7B | `resolveCollision` (bounds + buildings); accepted position is post-collision |
| S3 | Cross-block presence | 5C/7F | District presence registry; each client sees the other's block/presence |
| S4 | Interaction-zone prompt | 7A | client display from `nearestInteractionZone`; prompt authorises nothing |
| S5 | Server-confirmed interaction result | 7E | `city_interaction_request` → `city_interaction_receipt`, gated on canonical position |
| S6 | Objective hint / completion (if visible) | 7C | server-authoritative; **no inbound objective message** exists |
| S7 | Portal enter | 7D | `enterPortal` gates on canonical position → `city_portal_ok` |
| S8 | Arcade iframe / interior | 7D | same-origin iframe; **no postMessage trust-mixing** |
| S9 | Return to city | 7D | `history.pushState`/`popstate`, Escape/close button |
| S10 | Activity feed parity | 4C/7C | both clients converge on the same public feed/events |
| S11 | District event / presence display | 6x | scheduled event + presence surfaces render consistently |
| S12 | No private/economic data in public surfaces | all | snapshot exposes `id/x/y/facing/seq` only; no `lastInputAt/lastSeen`, no value-shaped fields |

## 5. Manual phone + desktop test procedure

Perform in order. Record PASS/FAIL + observed values per step in §6/§8. "Desktop" = device A,
"Phone" = device B.

1. **Open city on desktop (A).** Load `…/arcade/city/?city=downtown-01`. Confirm the canvas renders
   and an avatar spawns on the plaza. (S1)
2. **Open city on phone (B).** Same URL/block in a private window. Confirm canvas renders, controls
   are reachable (on-screen/touch), and an avatar spawns. (S1, mobile layout)
3. **Confirm both are live.** Desktop Network tab shows the `/arcade/city/ws` request as `101
   Switching Protocols`. Both avatars are present in the same block.
4. **Confirm shared presence.** Each client sees the other player's avatar (or the shared presence
   count/roster updates). Move A and watch B's view update, then move B and watch A's. (S3)
5. **Move both avatars.** Drive each into a building wall and a world edge. Confirm neither passes
   through a wall or leaves the bounds on **either** screen (server-authoritative collision, S2).
6. **Travel one client to an adjacent block.** On phone (B), use the in-client world map / District
   Tour to travel to a block the map shows as reachable (adjacency is server-validated). Confirm the
   route is accepted and B arrives; confirm A's cross-block presence reflects B's new block. (S3)
7. **Confirm route result + presence update.** B's block label changes; A sees B leave the shared
   block. Travel B back; confirm presence reconverges.
8. **Trigger an interaction-zone action.** Walk a client into the arcade-entry zone; confirm the
   action prompt appears (S4). Activate it. (Do the same for any other visible zone prompt.)
9. **Confirm server-confirmed result / receipt / feed entry.** The action only resolves on a server
   `city_interaction_receipt` / `city_portal_ok` — not merely because the prompt was visible (S5).
   Record `accepted` + `reason`. Confirm any resulting feed entry appears.
10. **Negative check (authority).** Stand a client **just outside** a zone and attempt the action
    (e.g. via the prompt edge or a rapid move-out). Confirm the server **rejects** it
    (`not_in_zone`) — the prompt's visibility never authorises the action. (S5)
11. **Enter the arcade.** From inside the arcade-entry zone, enter; confirm the same-origin interior
    iframe loads with the block's arcade house name. (S7, S8)
12. **Return to city.** Use Escape / the close control; confirm a smooth return to the same city
    position with no full reload, and that the other client stayed connected throughout. (S9)
13. **Trigger / read objective / event / feed.** Move to satisfy a visible objective hint (e.g.
    reach a node) and/or observe a district event; confirm the hint/event/feed render and that
    objective progress is **reward-free** (no points/currency/credit shown). (S6, S10, S11)
14. **Confirm both clients remain connected with no console errors.** Desktop Console shows no
    errors/warnings from the city client across the whole session; both sockets stayed open. (all)
15. **Public-safety check.** Inspect a snapshot/welcome payload (desktop Network/WS frames): confirm
    player entries carry only `id/x/y/facing/seq` and that **no** `lastInputAt`/`lastSeen` or any
    value-shaped field (ticket/prize/reward/balance/credit/coin/price) appears. (S12)

## 6. Expected results (checklist)

Record PASS / FAIL and the observed value for each.

- [ ] **S1** Both devices connect (`101`), avatars spawn, controls reachable (incl. touch on phone).
- [ ] **S2** No wall pass-through and no out-of-bounds escape on either screen.
- [ ] **S3** Each client sees the other / shared presence updates on movement; cross-block presence
  updates on travel.
- [ ] **S4** Interaction prompt appears **only** in-zone and clears when leaving.
- [ ] **S5** Action resolves **only** on a server receipt/`city_portal_ok`; record `accepted`+`reason`.
- [ ] **S5-neg** Outside-zone action is rejected (`not_in_zone`).
- [ ] **S6** Objective hint/progress renders and is reward-free.
- [ ] **S7** Portal entry succeeds only from inside the zone.
- [ ] **S8** Arcade interior loads (same-origin iframe; correct house name).
- [ ] **S9** Return-to-city is smooth, no full reload, peer stays connected.
- [ ] **S10/S11** Activity feed + district event/presence are consistent across both clients.
- [ ] **S12** Snapshot exposes only `id/x/y/facing/seq`; no private/economic fields.
- [ ] **Global** No console/page errors; both WebSockets stay open for the session.

**Evidence to collect per run:** the values above, plus screenshots/short video of (a) both avatars
in one block, (b) the in-zone prompt, (c) the arcade interior, (d) the WS `101` + a sample snapshot
frame, (e) presence after a cross-block travel.

## 7. Failure taxonomy

If any of these occur, mark the run FAILED and record the step + evidence. Severity guidance in
parentheses.

- **One device cannot connect** — no `101`, socket closes immediately (**blocker**).
- **WebSocket route failure** — `/arcade/city/ws` returns non-101 / 404 / 426; check trailing-path
  routing and `?city=` query (**blocker**).
- **Stale presence** — a client never sees the other, or presence never updates on move/travel
  (**high**).
- **Prompt appears but server rejects a legitimate in-zone action** — false-negative gating (**high**).
- **Server accepts an outside-zone action** — authority hole; the canonical-position gate failed
  (**blocker — security**).
- **Portal opens from the wrong position** — entered while not canonically in the zone (**blocker —
  security**).
- **Iframe fails to load** — arcade interior blank/blocked (CSP, origin) (**high**).
- **Return-to-city fails** — stuck in interior, full reload, or lost position (**high**).
- **Feed/event mismatch** — clients disagree on feed/event state (**medium**).
- **Private/economic data appears** — any `lastInputAt`/`lastSeen` or value-shaped field on the wire
  (**blocker — charter violation**).
- **Mobile layout blocks controls** — touch targets unreachable / canvas mis-sized on phone
  (**high**).

## 8. Evidence template (copy per run)

| Field | Value |
|---|---|
| Date / time (UTC) | |
| Commit / bundle hash under test | |
| Environment | local / staging / production |
| Environment URL | |
| Desktop device (OS + browser + version) | |
| Phone device (OS + browser + version) | |
| Steps passed (S1–S12 + negatives) | |
| Failures (step #, taxonomy, severity) | |
| Screenshots / video links | |
| Console/Network notes (WS 101, snapshot fields) | |
| Operator initials | |

## 9. Automated adjacent coverage (does not replace this proof)

These already exist and each proves a subsystem — but all run a single browser/node context against
the **dev shim** or a **staging DO**, not two real devices. They are necessary but **not sufficient**
for the 7F proof.

- `tests/arcade/city-collision.spec.mjs` (+ `run-city-collision.sh`) — 7B boundary kernel + server
  bounds clamp in-browser.
- `tests/arcade/city-interactions.spec.mjs` (+ `run-city-interactions.sh`) — 7A zone prompt drives the
  live arcade prompt; public-safe request shape.
- `tests/arcade/city-interaction-receipts.spec.mjs` — 7E receipt path.
- `tests/arcade/city-objectives.spec.mjs`, `city-objectives-two-client.spec.mjs` (two **websocket**
  clients vs the shim, ~75s w/ the real 45s cooldown), `city-objectives-staging.spec.mjs` (real
  workerd Durable Object, negative case included).
- `tests/arcade/city-presence.spec.mjs` — 5C cross-block presence (single client per block).
- `tests/arcade/city-loop-mobile.spec.mjs` (+ `run-city-loop-mobile.sh`) — 7D walk → see → enter →
  play → return on a phone viewport.
- `tests/arcade/remote-smoke.spec.mjs`, `two-client.spec.mjs`, `city-objectives-ws-driver.mjs` —
  arcade two-browser / two-client / honest public-protocol driver (Phase 1e/3B lineage).

**Honest gap they leave:** none drives a real phone **and** a real desktop together through the
whole kernel path with human observation. That is exactly what §5 covers.

## 10. Production sign-off gate

Production sign-off for the cross-device proof requires **all** of:

- This runbook completed end-to-end (§5) on the target environment.
- Evidence captured (§8) including screenshots/video and the WS/snapshot checks.
- **No blocker or high-severity failure** open (§7).
- **No private/economic/public-safety leak** observed (S12).
- No deploy, upload, flag flip, or admin/test hook was used — or, if a deploy is desired as a result,
  it is raised as a **separate, explicitly authorized** step (this document authorizes none).

This complements (does not replace) the still-optional, operator-manual
`AUTHORIZED: RUN PHASE 7C TWO-DEVICE PRODUCTION GATHER PLAYTEST` gate recorded in
`NEON_CIRCUIT_PHASE7C_PRODUCTION_COMPLETION.md`.

## 11. Non-goals

This runbook explicitly does **not**:

- Add any new gameplay, capability, message type, or authority.
- Add economy, currency, rewards, ownership, marketplace, accounts, chat, or UGC.
- Change collision, interaction, objective, portal, presence, or feed behaviour.
- Enable any admin/test hook, debug flag, or `LIVE_WORLD_LOADER_ENABLED` against production.
- Substitute an automated browser smoke for the real phone + desktop proof. An automated harness
  (a possible follow-up "Sprint 5B") may **supplement** this runbook but never stands in for the
  human cross-device observation it defines.
