# Neon Circuit — Phase 3 Launch Readiness Runbook

Phase 3 turns the validated Phase 2i release candidate into a **production-deployable, remotely-verifiable, public-playtest-ready** arcade. It adds **no new gameplay**. Everything here is configuration hardening, remote verification, client-deploy wiring, admin/playtest safety, and operator docs.

> This document is operator-facing. **Nothing here deploys, pushes, or mutates production on its own.** Deploys are explicit, separately-authorized operator actions.

Companion docs:
- [NEON_CIRCUIT_PHASE2I_RC_DEPLOYMENT.md](NEON_CIRCUIT_PHASE2I_RC_DEPLOYMENT.md) — release topology, DO migrations, RC validation.
- [NEON_CIRCUIT_REMOTE_SMOKE.md](NEON_CIRCUIT_REMOTE_SMOKE.md) — how to smoke a staging/production deploy.
- [NEON_CIRCUIT_PLAYTEST_RUNBOOK.md](NEON_CIRCUIT_PLAYTEST_RUNBOOK.md) — public playtest checklist + no-go conditions.

---

## 1. Release identity

| Field | Value |
|---|---|
| Base | `main` @ `52e023f` ( = RC `2d25728` + docs-only PR #21 ) |
| RC tag | `phase2i-arcade-rc1` → `2d25728` |
| Phase 3 branch | `feat/neon-circuit-phase3-launch-readiness` |
| Worker | `neon-arcade-mesh` (`workers/arcade/`) |
| Durable Objects | `ArcadeRoom` (per-room shard), `RoomRegistry` (coordinator) |
| DO migrations | `v1` ArcadeRoom, `v2` RoomRegistry |
| Static client | `arcade/*` on Cloudflare Pages (separate deploy) |

Scope guardrails (unchanged in Phase 3): internal arcade points only; **no money / crypto / transferable goods / wagering / marketplace**; all event/presentation features are **display-only**; server stays authoritative; HiveWorld simulator remains a separate project with no product bridge.

---

## 2. Deploy prerequisites

- Node **≥ 22** for Wrangler (the repo's default shell may be Node 18; use nvm/Volta).
- `wrangler` authenticated to the target Cloudflare account.
- The `ADMIN_TOKEN` secret is **never** committed. Configure it out-of-band only if you intend to run live-ops (see §4).
- Confirm DO migrations behavior per [the RC deployment doc](NEON_CIRCUIT_PHASE2I_RC_DEPLOYMENT.md) §3.

---

## 3. Production configuration override (the Phase 2i blocker — now closed)

The default `wrangler.toml [vars]` ships **`ENVIRONMENT = "development"`** and **`ADMIN_ENABLED = "true"`** for local dev. A production deploy **must not** ship those. Phase 3A adds a first-class production environment:

```toml
[env.production.vars]
ENVIRONMENT = "production"      # rejects the __test_set_event_now event-clock hook
ADMIN_ENABLED = "false"        # admin/live-ops surface OFF by default
EVENT_PREROLL_LEAD_MS = "120000"
EVENT_COUNTDOWN_REFRESH_MS = "1000"
EVENT_SHOW_NEXT = "true"
EVENT_SHOW_FEATURED = "true"
# DO bindings + migrations are RE-DECLARED under [env.production] because named
# Wrangler environments do not inherit them.
```

**Deploy production with the named environment:**

```bash
wrangler deploy --env production
```

**Pre-deploy safety gate (run this; it must print `PASS` / exit 0):**

```bash
node tests/arcade/check-production-config.mjs
```

This fails the deploy if **production _or_ staging** would leave `ENVIRONMENT=development`, enable admin by default, commit an `ADMIN_TOKEN`, ship out-of-range `EVENT_*`, drop a DO binding/migration, or un-gate the test clock. The same checks run in the unit gate (`tests/arcade/production-config.test.mjs`).

Checklist:
- [ ] `node tests/arcade/check-production-config.mjs` → PASS.
- [ ] `wrangler deploy --env production --dry-run` shows `ENVIRONMENT ("production")`, `ADMIN_ENABLED ("false")`, both DO bindings.
- [ ] Post-deploy, `GET /arcade/health` is reachable and `__test_set_event_now` is rejected (verified by remote smoke with `EXPECT_ENVIRONMENT=production`).

### 3a. Staging environment (pre-production smoke target)

`[env.staging]` is a **safe, separate** pre-production target. Deploy it with:

```bash
wrangler deploy --env staging
```

It ships `ENVIRONMENT="staging"` (a non-`development` value, so the `__test_set_event_now` hook is **rejected** — the code only honors `development`) and `ADMIN_ENABLED="false"`, and re-declares the DO bindings + migrations. **Never** use the default env (`wrangler deploy` with no `--env`) as public staging — it ships `ENVIRONMENT="development"` with the test hook live.

- [ ] `wrangler deploy --env staging --dry-run` shows `ENVIRONMENT ("staging")`, `ADMIN_ENABLED ("false")`, both DO bindings.
- [ ] Smoke staging green with `EXPECT_ENVIRONMENT=staging` (see §7) **before** any production deploy.

**Worker names (env-suffixed by Wrangler — point the client at the right one):**

| Command | Deployed Worker | Use |
|---|---|---|
| `wrangler deploy` | `neon-arcade-mesh` | local/default (development) — **not** public |
| `wrangler deploy --env staging` | `neon-arcade-mesh-staging` | pre-production smoke |
| `wrangler deploy --env production` | `neon-arcade-mesh-production` | production |

Each is a **distinct Worker + DO namespace** (no shared state). The static client's `WS_URL` must point at the *actual deployed* Worker for the target you are verifying.

---

## 4. Admin / live-ops both-gate

Admin (room reset/status + display-only presentation overrides) is an **operational** surface, not a user auth system. It is allowed only when **BOTH**:

1. `ADMIN_ENABLED === "true"` (off in production by default), **and**
2. the caller presents an `ADMIN_TOKEN` that matches a server-side secret.

If the token secret is unset, admin is OFF regardless of the flag. To enable live-ops on production later:

```bash
wrangler secret put ADMIN_TOKEN --env production
# and redeploy with ADMIN_ENABLED=true ONLY if you intend live-ops to be reachable
```

The operator UI (the lobby ⚙ panel) is **hidden from public players** (Phase 3E); it renders only with `?admin=1` or `window.__NEON_ARCADE_CONFIG__.showAdmin === true`. The server gate is the real control — the hidden UI just keeps admin out of a playtester's way. Admin ops are exactly seven (`reset`, `set_status`, `diagnostics`, `set_presentation`, `clear_presentation`, `preview_presentation`, `presentation_diagnostics`) — none can touch tickets/prizes/economy. Verified by `tests/arcade/admin.test.mjs` + `tests/arcade/admin-gate-safety.test.mjs`.

The admin token must **never** appear in client-visible payloads, logs, or test output — enforced by the gate (returns only `{ok, reason}`) and asserted live by the remote smoke.

---

## 5. Display-only event presentation config

`EVENT_PREROLL_LEAD_MS`, `EVENT_COUNTDOWN_REFRESH_MS`, `EVENT_SHOW_NEXT`, `EVENT_SHOW_FEATURED` tune **only** how scheduled events are presented (pre-roll lead, countdown refresh, preview/featured visibility). They are validated + clamped server-side and can never affect tickets, prizes, rewards, schedules, or authority. Per-room overrides are admin-only and display-only.

---

## 6. Static client → Worker endpoint setup

The Pages client (`arcade/*`) connects to the Worker WebSocket. Resolution precedence (Phase 3C):

1. `?ws=…` — test-only query override.
2. `window.__NEON_ARCADE_CONFIG__.wsUrl` — the deploy-time hook.
3. Same-origin `wss://<page host>/arcade/ws` — when the Worker is routed on the same custom domain.

Pick one:
- **Same-origin (simplest):** route the Worker at `/arcade/*` on the Pages custom domain → no client config needed.
- **Cross-origin Worker (`*.workers.dev` or a dedicated subdomain):** set the config hook. Inline in `arcade/index.html` (a commented template is already there) or copy `arcade/neon-arcade-config.example.js` → `neon-arcade-config.js`. **Transport config only — never put a secret here.**

Checklist:
- [ ] Decide same-origin vs cross-origin.
- [ ] If cross-origin, set `window.__NEON_ARCADE_CONFIG__.wsUrl` to the `wss://…/arcade/ws` URL.
- [ ] `https` pages must use `wss://` (mixed content otherwise).

---

## 7. Post-deploy verification

Run the remote smoke against the deployed Worker (and Pages site). Full usage in [NEON_CIRCUIT_REMOTE_SMOKE.md](NEON_CIRCUIT_REMOTE_SMOKE.md):

```bash
BASE_URL=https://<pages-host> \
WS_URL=wss://<worker-host>/arcade/ws \
EXPECT_ENVIRONMENT=production EXPECT_ADMIN_ENABLED=false \
bash tests/arcade/run-remote-smoke.sh
```

Expect: health/rooms/rooms-health OK + public-safe · occupy/round/ticket/ledger loop works · second client sees occupancy but not private balance/ledger · **`__test_set_event_now` rejected** · admin op rejected without the both-gate · presentation block present · no console/page errors. It is **non-destructive** and never calls a state-wiping admin op.

---

## 8. Rollback plan

- **Worker code:** Cloudflare keeps prior Worker versions. Roll back via the dashboard (Deployments → previous version → Rollback) or `wrangler rollback --env production`. The bundle is deterministic from this branch.
- **Durable Object state:** DO storage **persists** across Worker redeploys/rollbacks. Migrations `v1`/`v2` are additive class creations — a code rollback does **not** drop DO data and needs no down-migration. Never edit/remove a shipped migration tag; new DO classes require a new tag.
- **If a room's state is corrupt:** use the gated admin `reset` op for that single room (room-scoped; wipes only that room). This requires the both-gate; it is not a deploy action.
- **Static client:** roll back the Pages deployment independently; it is decoupled from the Worker.
- **Fast mitigation without rollback:** set `ADMIN_ENABLED=false` (already default) and/or `set_status` a room to `maintenance` (closes it to new joins) via admin.

---

## 9. Known limitations

- No production analytics/telemetry (intentionally not implemented; would need explicit approval).
- No global accounts, cross-room inventory, or cross-room economy (each room is isolated by design).
- Player identity is a local-storage id (no auth) — appropriate for an arcade playtest, not for cross-device continuity.
- `arcade/index.html` viewport sets `user-scalable=no` to keep rapid-tap games (Pulse Tap) from triggering double-tap zoom. This is a deliberate gameplay tradeoff; revisit if accessibility feedback requires pinch-zoom.
- Real `wrangler dev` requires Node ≥ 22; the repo's default shell may be Node 18.

---

## 10. Stale PR note

PR **#3** (Phase 1d, stacked on a feature branch) is already **CLOSED** — no action required. There are no open PRs against `main` at the time of this runbook.

---

## 11. Tag push policy

Tags and pushes are **explicit, separately-authorized** operator actions. The Phase 2i RC tag (`phase2i-arcade-rc1`) and any Phase 3 RC tag are created locally and pushed only on an explicit instruction. Never force-push; never rewrite history.

---

## 12. No-go conditions (do NOT deploy / do NOT open the playtest if any hold)

- `node tests/arcade/check-production-config.mjs` does not PASS.
- `wrangler deploy --env production --dry-run` shows `ENVIRONMENT ("development")` or `ADMIN_ENABLED ("true")`.
- The remote smoke fails any check, or `__test_set_event_now` is **not** rejected in production.
- An `ADMIN_TOKEN` (or any secret) appears in a committed file, client payload, or log.
- The unit gate or browser specs are red.
- The static client cannot reach the Worker (wrong `wsUrl` / mixed content).
- The admin ⚙ panel is visible to a public (no `?admin=1`) client.
