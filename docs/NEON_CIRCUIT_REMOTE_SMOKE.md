# Neon Circuit — Remote Smoke Harness

A repeatable, env-driven smoke test that drives the **same public client + protocol a real player uses**, against any deployment. It verifies the deployment is healthy, server-authoritative, public-safe, admin-gated, and that production test hooks are rejected.

Files:
- `tests/arcade/run-remote-smoke.sh` — runner (remote + local modes).
- `tests/arcade/remote-smoke.spec.mjs` — the checks (Playwright + `fetch`).

No hardcoded URLs. No secrets in the files. **Non-destructive by default.**

---

## Modes

### Remote (staging / production)

Provide the deployment URLs by environment; the spec runs as-is:

```bash
BASE_URL=https://<pages-host> \
WS_URL=wss://<worker-host>/arcade/ws \
EXPECT_ENVIRONMENT=production \
EXPECT_ADMIN_ENABLED=false \
bash tests/arcade/run-remote-smoke.sh
```

`API_URL` defaults to the `WS_URL` host over `http(s)`; override it if the Worker HTTP origin differs.

### Local / dry (default, no `WS_URL`)

Boots a static server **and the real Worker via `wrangler dev`** (needs Node ≥ 22) and smokes it with `EXPECT_ENVIRONMENT=development`. This exercises the production Worker + Durable Objects locally:

```bash
PW_REQUIRE_BASE=/path/to/node_modules-parent \
bash tests/arcade/run-remote-smoke.sh
```

If Node ≥ 22 is not on `PATH`, set `NODE22_BIN=/path/to/node22/bin`.

---

## Inputs

| Env var | Meaning |
|---|---|
| `BASE_URL` | Static client origin (serves `arcade/index.html`). |
| `WS_URL` | Worker WebSocket URL (`…/arcade/ws`). Presence of this selects remote mode. |
| `API_URL` | Worker HTTP origin. Default: derived from `WS_URL`. |
| `ADMIN_TOKEN` | Operational admin secret (optional). Never printed. |
| `EXPECT_ENVIRONMENT` | `development` asserts the test clock is *honored*; **any other value** (`production`, `staging`, …) asserts it is *rejected*. Unset → skipped. |
| `EXPECT_ADMIN_ENABLED` | `true` \| `false`. Gates the correct-token admin assertion. |
| `ALLOW_REMOTE_ADMIN_MUTATION` | `true` to permit state-changing admin ops. Default off; this harness still never calls `reset`. |
| `PW_REQUIRE_BASE` | `node_modules` parent that resolves `playwright`. |

---

## What it checks

- `GET /arcade/health` returns ok and names `neon-arcade-mesh` with 3 rooms.
- `GET /arcade/rooms` and `GET /arcade/rooms/health` return **public-safe** envelopes (no balance/ledger/token).
- A client connects, occupies a cabinet, starts + submits a round, and the **server awards internal tickets**; the ledger updates privately.
- A second client sees occupancy but **not** the first client's private balance/ledger.
- `__test_set_event_now` is **rejected** for any non-`development` `EXPECT_ENVIRONMENT` (`production`, `staging`, …) — and detectable when `development`, proving the check is real.
- An admin op is rejected with no token and with a wrong token; with the correct token it succeeds only when `EXPECT_ADMIN_ENABLED=true`.
- The admin token **never** appears in any server payload.
- The event `presentation` block is present, public-safe, and within clamp bounds.
- No console / page errors.

---

## Safety

- **Non-destructive by default:** it occupies a cabinet with a throwaway player id and releases it; it never calls a state-wiping admin op (`reset`/`set_*`) unless `ALLOW_REMOTE_ADMIN_MUTATION=true`.
- The display-only event-clock override used to prove the test hook is rejected is restored afterward (and is a no-op in production).
- The admin token is passed only as an env var and is asserted to never echo back.

---

## Interpreting results

- `REMOTE SMOKE: PASS` (exit 0) → the deployment satisfies the launch invariants for that `EXPECT_*` profile.
- Any `FAIL` line → a launch blocker; see [NEON_CIRCUIT_PHASE3_LAUNCH_READINESS.md](NEON_CIRCUIT_PHASE3_LAUNCH_READINESS.md) §12 no-go conditions.
- `skip` lines are expected when an optional input is omitted (e.g. no `ADMIN_TOKEN`, or `EXPECT_ENVIRONMENT` unset).
