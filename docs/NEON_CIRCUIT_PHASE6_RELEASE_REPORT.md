# Neon Circuit — Phase 6 Release Report (RC1)

**RC tag:** `phase6-district-events-rc1` → `69764dc` (pushed).
**Branch:** `main` @ `69764dc`.
**Status:** Phase 6B–6D merged to `main`; deployed to **staging only** and smoke-verified.
**Production:** NOT deployed — gated behind `AUTHORIZED: DEPLOY PHASE 6 PRODUCTION`.

## Scope

Completed the post-launch Phase 6 sequence on top of the live, signed-off Phase 6A city:

| Phase | What | PR | Merge |
|---|---|---|---|
| 6B | Server-authored / operator-tunable district event snapshot (`city_blocks`) | #33 | `1f2e2c6` |
| 6C | Rich district event card + live countdown (active/pre-roll states) | #34 | `ee3308e` |
| 6D | Fourth block (Foundry) + non-linear ring topology | #35 | `69764dc` |

## Validation snapshot (at RC)

- **Unit:** 568 pass / 0 fail (`node --test tests/arcade/*.test.mjs`).
- **Browser smokes:** 14/14 city + arcade smokes PASS.
- **Production-config gate:** PASS.
- **Worker dry-run:** `195.09 KiB / 42.84 KiB gz`. **Staging dry-run** (`--env staging`): same, `ENVIRONMENT="staging"`.
- **Size (client):** ≈ `0.783 MB` / `0.212 MB` gz — within GTA-80 (80 MB) / GTA-34 (34 MB gz).

### Size / bundle trend across Phase 6

| Stage | Client (uncompressed / gz) | Worker upload (raw / gz) |
|---|---|---|
| 6A baseline | 0.773 / 0.209 MB | 187.10 / 40.74 KiB |
| 6B (server snapshot) | 0.779 / 0.212 MB | 194.47 / 42.71 KiB |
| 6C (card + countdown) | 0.782 / 0.212 MB | 194.47 / 42.71 KiB |
| 6D (fourth block) | 0.783 / 0.212 MB | 195.09 / 42.84 KiB |

The Worker grew ~187→195 KiB because the district-events module is now imported server-side (6B). All within budget.

## Worker / DO / migration summary

- **Worker code changed:** 6B only (CityRoom + dev-shim attach the event snapshot to `city_blocks`). 6C/6D added no new server message.
- **New Durable Objects:** none. **Migrations:** none added in Phase 6 (still v1–v4). **New routes:** none.
- **Schema:** no `SCHEMA_VERSION` bump (the 4-block manifest is the same shape as 3 blocks; downstream systems iterate the manifest).

## Staging deploy + smoke

- **Deploy:** `wrangler deploy --env staging` → `neon-arcade-mesh-staging.rbardyla.workers.dev`, Version `e9fa7c36-31c5-4fc7-a265-57581db1b143`. Token sourced ephemerally from gitignored `.env` (`Cloudflare_API` → `CLOUDFLARE_API_TOKEN` in a subshell); never printed; no `wrangler login`; no production touched.
- **Smoke (local RC client → real staging Worker):** 16/16 PASS (stable across repeated runs):
  - `/arcade/health` → 200, `ok:true`.
  - city client connects to the staging CityRoom (WS upgrade accepted).
  - **6D live:** district lists 4 blocks incl. Foundry.
  - **6B live:** server-authored event snapshot present + `public_safe`.
  - **6C live:** event card renders with state class; countdown renders in `m:ss` and advances.
  - District Activity feed receives an event announcement.
  - No economy/ownership copy; no private data; no console/page errors (desktop + phone).
  - Phone viewport (390×844): city loads, event card renders.

### Staging checks confirmed by construction (not separately live-probed)

- **`ENVIRONMENT=staging`:** confirmed by the deploy/dry-run output (`env.ENVIRONMENT ("staging")`), sourced from `[env.staging.vars]`.
- **`__test_set_event_now` rejected:** the dev-clock hook is guarded by `ENVIRONMENT === "development"` (proven by `check-production-config.mjs`); on staging it is silently ignored. Not separately live-probed (it is an absence-of-effect, brittle to assert over the network).
- **Cross-block 30 s presence cadence:** the push mechanism is proven by the local two-client / presence smokes (same deployed code); a 30 s cross-block staging run was not executed to avoid a slow/flaky network test.

## Product-safety / guardrails

- Every phase guardrail-grepped clean of economy/ownership/gambling/telemetry copy (only non-goal disclaimers, rendering terms, and server-owns-truth comments matched).
- No `innerHTML` / external scripts / telemetry / analytics added. `textContent` only.
- District events remain **display/atmosphere only**: no rewards, multipliers, tickets, Host Rank, Stewardship, or Block Trial changes. The fourth block is map topology only — no ownership/rent/economy.

## Production safety status

- **No production deploy.** No production dashboard mutation. No DNS / Pages / Web-Analytics change. No `wrangler login`. No secrets committed or printed. No history rewrite. No force-push.

## Known limitations

- Event schedule is wall-clock deterministic (not presence-aware); countdown ticks on the local clock (`server_time` available but not yet used for skew correction).
- Block geometry is shared across all four blocks (per the Phase 5B design); Foundry is distinguished by labels + default style, not bespoke geometry.
- Staging `ENVIRONMENT`/dev-clock verified by construction rather than a separate live WS probe (see above).

## Next recommended gate

```text
AUTHORIZED: DEPLOY PHASE 6 PRODUCTION
```

A production deploy would: re-upload the static client (incl. the 6B/6C/6D city) to `wild-hat-6257`,
then `wrangler deploy --env production` for the DO Worker. Validate on phone + PC as with the 6A launch.
Phase 7 not started.
