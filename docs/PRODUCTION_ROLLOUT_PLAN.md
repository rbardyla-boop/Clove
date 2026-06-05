# Neon Circuit — Production Rollout Plan

**Status:** pre-flight complete; **NOT deploy-ready** — blocked on the production routing / client→Worker
wiring (§7). The Worker artifact and config are green and low-risk; the gap is infrastructure wiring, not
code. **No production deploy has occurred.**

## 1. Production candidate (pinned)

```text
phase5-city-district-prod-candidate-1 → 35c3569   (the exact commit to deploy = main HEAD)
phase5-city-district-rc5              → 4938b62   (product feature marker; unchanged)
```

`35c3569` = RC5 `4938b62` (Phase 5A–5E, staging-green) **+ the `.gitignore`/`.claude` housekeeping chore
only** — verified: no `workers/**` or `arcade/**` delta between `4938b62` and `35c3569`, so both ship the
identical product artifact. main HEAD is pinned because a git-integrated Pages project deploys from HEAD,
not a detached commit.

## 2. Pre-flight results (read-only, on `35c3569`, Node 22.22.3) — GREEN

| Check | Result |
|---|---|
| `node --test tests/arcade/*.test.mjs` | **536/536 pass** |
| `check-production-config.mjs` | **PASS** (ENVIRONMENT=production · ADMIN_ENABLED=false · no ADMIN_TOKEN · 4 DO bindings · v1–v4) |
| `check-city-build-size.mjs` | **PASS** |
| `wrangler deploy --env production --dry-run` | **PASS** — 187.10 KiB / 40.74 KiB gz (byte-identical to staging); bindings ArcadeRoom/RoomRegistry/CityRoom/CityRegistry; `ENVIRONMENT="production"`, `ADMIN_ENABLED="false"` |
| Deploy credential | valid User API Token (rbardyla@gmail.com); **Workers-deploy** capable (deployed staging). Pages-deploy scope **unverified**. |

The production Worker artifact is the same one staging proved on real `workerd` (Phase 5A–5E, cross-block
presence cadence, activity feed). First production deploy provisions ArcadeRoom/RoomRegistry/CityRoom/
CityRegistry fresh and runs migrations **v1→v4** once (additive `new_sqlite_classes`; empty state → no
data-loss risk).

## 3. Production config (`workers/arcade/wrangler.toml` `[env.production]`)
- Worker name: `neon-arcade-mesh` (top-level; staging used `neon-arcade-mesh-staging`).
- `ENVIRONMENT="production"` → rejects the `__test_set_event_now` event-clock hook.
- `ADMIN_ENABLED="false"`; `ADMIN_TOKEN` **not** in `wrangler.toml` (admin needs both the flag AND a
  separately-set secret).
- All 4 DO bindings + migrations v1–v4 re-declared (named envs don't inherit).

## 4. Components (a production cutover is TWO deploys + routing)
1. **Worker** (DO authority) — `neon-arcade-mesh`, serves `/arcade/*` incl. `/arcade/city/ws`.
2. **Client / PWA** (static, incl. the Phase 5E city client) — served by **Cloudflare Pages**.
3. **Routing** — what makes (2) reach (1).

## 5. Deploy sequence (each step its own gate; NONE executed)
```text
A. Worker:  cd workers/arcade && wrangler deploy --env production
            → provisions the 4 DOs + runs v1→v4 (first time); capture Version ID
B. Worker smoke (workers.dev or the chosen origin):
            /arcade/health 200 · POST /__test_set_event_now → 404 · /arcade/rooms/health 200
C. Client:  deploy the static PWA via the project's Pages pipeline (CONFIRM mechanism — §7)
D. Routing: make /arcade/* (incl. /arcade/city/ws) reachable from the client origin (§7)
E. Full-origin smoke: city page loads → connects → same-block immediate / cross-block ≤30s presence;
            5E activity feed renders; no private data; no console/page errors
F. Sign-off → production live
```

## 6. Post-deploy verification (production smoke — same shape as the RC5 staging proof)
`/arcade/health` 200 · `__test_set_event_now` → **404** (prod clock-hook rejection) · `/arcade/rooms/health`
200 · city page connects to `/arcade/city/ws` · presence push (same-block immediate, cross-block ≤30s real
alarm) · 5E District Activity feed renders, no private data · zero console/page errors.

## 7. ⛔ BLOCKING open items (resolve before `DEPLOY PRODUCTION WORKER`)

### 7a. Client → Worker WebSocket wiring (HARD BLOCKER — evidence-backed)
The Pages-served client tries **same-origin** `/arcade/city/ws` (`city-net.js` →
`${proto}//${location.host}/arcade/city/ws`), and `window.__NEON_ARCADE_CONFIG__.cityWsUrl` is **not set**
(only an example file). **No committed config routes `/arcade/*` from the Pages origin to the Worker** — no
`_routes.json`, no `functions/`, no `/arcade/*` rule in `_redirects`/`_headers`, and the Worker has **no
route/custom-domain** in `wrangler.toml` (→ `*.workers.dev` only unless a dashboard route exists). So in
production the city WebSocket would have nothing to connect to. **One of these must be chosen + applied:**
- **(Preferred) Same-origin routing:** a Cloudflare Workers **route** so the production domain that serves
  Pages sends `/arcade/*` → `neon-arcade-mesh`. Keeps the client's same-origin default working unchanged.
- **(Alternative) Explicit client config:** set `window.__NEON_ARCADE_CONFIG__.cityWsUrl =
  "wss://neon-arcade-mesh.<subdomain>.workers.dev/arcade/city/ws"` in the production client (public
  transport URL only — never a secret). Cross-origin to the Worker; the deployed DO already accepts the
  handshake without a subprotocol (the Phase 4 fix).

### 7b. Production Worker reachability (NEW gate)
**Confirm whether the production Worker is reachable at `*.workers.dev`, a custom domain, or both.** The
smoke's `WS_URL` (and 7a's choice) depend on this. No route config is committed → default is workers.dev
unless a dashboard route/custom-domain is configured out-of-band.

### 7c. Pages deploy mechanism
**Confirm the Pages project name + pipeline** (git-integrated auto-deploy from main vs `wrangler pages
deploy`). No `_routes.json`/`functions` committed; the static site appears git-integrated, but unconfirmed.

### 7d. Deploy credential scope
The `.env` User API Token deploys **Workers** (proven on staging). **Confirm it also has Pages deploy
permission** (separate), or use the appropriate path for the Pages pipeline.

### 7e. First-time DO provisioning acceptance
First deploy is a one-way provisioning of 4 DO classes + v1→v4. Low risk (empty state), but confirm
acceptance before cutover.

## 8. Rollback / recovery (honest for a FIRST production deploy)
**There is no prior production Worker version, so `wrangler rollback` is NOT a real first-deploy safety
net.** First-deploy recovery is:
1. **Route-disable / route away from `/arcade/*`** (kill switch — the rest of the site is unaffected), or
2. **Forward-fix** (redeploy a corrected Worker), or
3. **Pages**: redeploy the prior Pages build (Pages keeps deploy history).
Migrations are additive (new DO classes) and don't destroy data, so a code rollback needs no migration
rollback. Once a second production version exists, `wrangler rollback` becomes a valid fast revert.

## 9. Recommended gate order
```text
1. AUTHORIZED: RUN PRODUCTION PRE-FLIGHT        ✅ DONE (this document; candidate pinned; validation green)
2. RESOLVE §7 (routing model, Pages pipeline, client WS wiring, credential scope, DO acceptance)  ← BLOCKER
3. AUTHORIZED: DEPLOY PRODUCTION WORKER         → wrangler deploy --env production
4. AUTHORIZED: PRODUCTION WORKER SMOKE
5. AUTHORIZED: DEPLOY/CONFIRM PRODUCTION CLIENT (Pages) + routing
6. AUTHORIZED: FULL-ORIGIN PRODUCTION SMOKE + SIGN-OFF
```

## 10. Bottom line
Worker side: **green, low-risk, ready.** Blocker: **production routing + client→Worker wiring (§7a/7b)** —
infrastructure decisions, not code. Do **not** run `AUTHORIZED: DEPLOY PRODUCTION WORKER` until §7 is
resolved. Production and the HiveWorld lab lineage are untouched; this plan performs no deploy.
