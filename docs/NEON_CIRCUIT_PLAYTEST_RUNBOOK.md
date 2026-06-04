# Neon Circuit — Public Playtest Runbook

How to run a controlled public playtest of the Neon Circuit arcade safely. This assumes the Worker + Pages client are deployed and the remote smoke is green (see [NEON_CIRCUIT_PHASE3_LAUNCH_READINESS.md](NEON_CIRCUIT_PHASE3_LAUNCH_READINESS.md)).

The arcade uses **internal arcade points only** — no money, no crypto, no transferable goods, no wagering. Set player expectations accordingly.

---

## Pre-playtest gate (all must be true)

- [ ] `node tests/arcade/check-production-config.mjs` → PASS.
- [ ] Remote smoke green with `EXPECT_ENVIRONMENT=production EXPECT_ADMIN_ENABLED=false`.
- [ ] `__test_set_event_now` rejected on the deployed Worker.
- [ ] Admin ⚙ panel **not** visible on a normal `https://<pages-host>/arcade/` load (no `?admin=1`).
- [ ] `ADMIN_ENABLED=false` in production (admin off); `ADMIN_TOKEN` known only to operators, if set at all.
- [ ] Static client reaches the Worker (cabinets show live occupancy; status reads "live").
- [ ] Unit gate + browser specs + mobile playtest spec green on the release commit.

---

## Playtester happy-path (verify on a real phone AND desktop)

1. Open `https://<pages-host>/arcade/` → status reaches **live**.
2. Lobby (`#roomBtn`) → choose a room → join. Each room is isolated (own tickets/inventory/challenges/feed).
3. Walk up to a cabinet (Pulse Tap / Signal Sprint / Neon Grid) → occupy → play → submit.
4. Tickets are awarded by the server; the HUD updates.
5. Prize Counter → redeem a cosmetic with earned tickets → equip it.
6. Challenge Board → complete a challenge → claim the badge.
7. Event banner / pre-roll countdown renders (display-only).
8. A second player sees your occupancy + public cosmetics, but **not** your private balance/ledger.

---

## Mobile checklist (Phase 3E)

Covered by `tests/arcade/run-mobile-playtest.sh` (360×640 + reduced-motion). Spot-check on a device:

- [ ] No horizontal overflow at ~360px width (floor, lobby, prize counter).
- [ ] Header action buttons (room / prize / challenges / interact / identity) are comfortably tappable (≥ 40px).
- [ ] Event/pre-roll text is readable.
- [ ] `prefers-reduced-motion` users get no broken animation / no console errors.
- [ ] The full loop (lobby → room → cabinet → prize/challenge) is reachable by touch.
- [ ] No console / page errors.

---

## Operator live-ops (only if you deliberately enable admin)

Admin is off by default in production. If you must run live-ops:

1. `wrangler secret put ADMIN_TOKEN --env production`; redeploy with `ADMIN_ENABLED=true` only if you intend the surface reachable.
2. Open the arcade with `?admin=1` to reveal the ⚙ live-ops panel; enter the token (server validates).
3. Available ops: per-room `reset` / `set_status` (open/closed/maintenance) / `diagnostics`, and **display-only** presentation `set`/`clear`/`preview`/`diagnostics`. None touch tickets/prizes/economy.
4. Close a room to new joins during an incident with `set_status … maintenance`.
5. Turn admin back off (`ADMIN_ENABLED=false` + redeploy, and/or remove the secret) when done.

---

## Incident handling

| Symptom | First action |
|---|---|
| A room's state looks corrupt | Admin `reset` that single room (room-scoped; both-gated). |
| Abuse / need to pause a room | Admin `set_status … maintenance` (closes to new joins). |
| Worker regression | `wrangler rollback --env production` (DO state persists; no down-migration). |
| Client can't connect | Check `wsUrl` config (§6 of the launch doc) + `wss://` on https. |
| Suspected secret exposure | Rotate `ADMIN_TOKEN` immediately (`wrangler secret put`); review logs. |

---

## No-go / stop-the-playtest conditions

- Admin ⚙ panel visible to public players, or any admin op reachable without the both-gate.
- `__test_set_event_now` accepted on production.
- Any secret/admin token visible in client payloads, logs, or the repo.
- Server authority bypassed (client-side ticket/prize/score acceptance).
- Console/page errors on the core loop.
- Money-like / wagering / transferable-goods copy or mechanics anywhere.

---

## Known limitations to communicate

- Identity is per-browser (local storage), not a cross-device account.
- No cross-room economy/inventory; rooms are isolated by design.
- No analytics/telemetry collected.
- Event presentation is display-only — it never changes rewards or odds.
