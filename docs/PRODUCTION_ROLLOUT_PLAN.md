# Neon Circuit — Production Rollout Plan

**Status:** pre-flight complete; routing **architecture decided** (same-origin); **NOT deploy-ready.** This
is a **FULL feature launch** — production currently has NONE of the city feature: the **client is absent**
(production Pages is a stale build predating `arcade/`; all `/arcade/*` → 404, §7c), the **Worker is not
deployed**, and the **route is not configured**. The Worker artifact + config are green and low-risk; the
real gap is the **stale Pages deploy + routing**, which is operational, not code. **No production deploy has occurred.**

**Three components must land (in order):** (1) a **fresh Pages deploy** including `arcade/` so the city
client exists at `clovelearn.io/arcade/city/*`; (2) the **Worker** `neon-arcade-mesh` (`wrangler deploy
--env production`, provisions 4 DOs + v1→v4); (3) **narrow Workers routes** for the Worker's five API/WS
endpoints under `/arcade/` — **NOT** a broad `/arcade/*`, which would 404 the static client (see §0).

## 0. Routing resolution (decided)

**Production domain: `clovelearn.io`** (observed: `sitemap.xml` + `robots.txt`; the site is a Cloudflare
**Pages** project on this **custom domain**, i.e. a Cloudflare zone). Current probes (observed):
`https://clovelearn.io/arcade/health` → **404** and `https://neon-arcade-mesh.rbardyla.workers.dev/arcade/health`
→ **404** — i.e. nothing routes `/arcade/*` to the Worker today, and the production Worker is not deployed.

**Decision — PREFERRED same-origin (feasible because clovelearn.io is a Cloudflare zone):** add Workers
**routes** so only the Worker's API/WS endpoints under `/arcade/` hit the `neon-arcade-mesh` Worker, while
the static host serves everything else.

**CRITICAL — narrow routes only (the Worker has NO static serving).** The Worker
([workers/arcade/src/index.ts](../workers/arcade/src/index.ts)) handles exactly **five** paths —
`/arcade/ws`, `/arcade/city/ws`, `/arcade/rooms`, `/arcade/rooms/health`, `/arcade/health` — and returns
`404` for everything else (no `ASSETS` binding, no static files). The arcade/city **client**
(`/arcade/index.html`, `/arcade/city/*.{html,js,mjs,css}`) is **static and must stay on the static host**.
A broad `clovelearn.io/arcade/*` route would send every static client file to the Worker → `404` → **the
client breaks.** So the route set must be **narrow, per-endpoint.** The client's same-origin default
(`/arcade/city/ws`) then works **with no client change**. (Fallback
`window.__NEON_ARCADE_CONFIG__.cityWsUrl` is NOT needed.)

**Concrete change (applied at the DEPLOY-WORKER gate, not now):** add to `workers/arcade/wrangler.toml`:
```toml
[env.production]
# … existing name/vars/durable_objects/migrations …
routes = [
  { pattern = "clovelearn.io/arcade/ws",      zone_name = "clovelearn.io" },
  { pattern = "clovelearn.io/arcade/city/ws", zone_name = "clovelearn.io" },
  { pattern = "clovelearn.io/arcade/rooms*",  zone_name = "clovelearn.io" },
  { pattern = "clovelearn.io/arcade/health",  zone_name = "clovelearn.io" },
]
```
`rooms*` covers `/arcade/rooms` + `/arcade/rooms/health` and does **not** shadow the static
`room-recommend.mjs`; query strings (`?room=`/`?city=`) are ignored by route matching, so the bare `/ws`
paths still match. Then `wrangler deploy --env production` registers the routes against the **production**
Worker `neon-arcade-mesh` (do **NOT** bind to `neon-arcade-mesh-staging`). Production smoke `WS_URL` =
`wss://clovelearn.io/arcade/city/ws`.

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

## 7. Open items

### 7a. Client → Worker WebSocket wiring — ✅ RESOLVED (see §0)
**Narrow** same-origin routes (`/arcade/ws`, `/arcade/city/ws`, `/arcade/rooms*`, `/arcade/health`) →
`neon-arcade-mesh` (applied at the deploy-worker gate; **not** a broad `/arcade/*` — the Worker has no
static serving). Client unchanged; smoke `WS_URL = wss://clovelearn.io/arcade/city/ws`. The deployed DO
already accepts the handshake without a subprotocol (the Phase 4 fix), so the same-origin upgrade succeeds.

### 7b. Production Worker reachability — ✅ RESOLVED
`clovelearn.io/arcade/*` (the same-origin route, what the client uses) **and** `neon-arcade-mesh.rbardyla.
workers.dev` (the account subdomain; useful for an isolated Worker-only smoke before routing). The client
path is the custom-domain route.

### 7c. NO Pages project in this account; live site is a STALE build served elsewhere — ⛔ OPEN
**Evidence (Cloudflare API with the owner token + read-only HTTP):**
- `GET /accounts/bea9dc96…/pages/projects` → `success: true`, **`result: [] (0 projects)`**. The token
  **can** read Pages (no auth error) — there are genuinely **no Cloudflare Pages projects** in this account.
- No Workers routes on the zone (dashboard: "no routes configured").
- Yet `clovelearn.io` **is serving this repo**: the live `_redirects` rule (`/index.html → /deck.html`,
  observed `302`) and the live `_headers` `Permissions-Policy` (`…microphone=(self)…`) **byte-match this
  repo's root `_redirects`/`_headers`**. But **all `/arcade/* → 404`** — the deployed build **predates the
  `arcade/` directory**.
- The site is Cloudflare-proxied (root resolves to CF IPs `104.26.*`/`172.67.*`); the token **lacks
  Zone-DNS:Read** (`/dns_records` → auth error `10000`), so the origin host can't be read via API.

**Conclusion:** clovelearn.io is **not** a Pages project in the logged-in account. It is a **stale build of
this repo served from elsewhere** — most likely (a) a Cloudflare **Pages project under a different
account/email**, or (b) a **non-Cloudflare host that uses the same `_headers`/`_redirects` format (Netlify)**
proxied through this zone. **Identify it in the dashboard:** clovelearn.io → **DNS → Records** → the root
`clovelearn.io` record target: `*.pages.dev` = CF Pages (another account), `*.netlify.app` = Netlify,
`*.vercel.app`/IP = that host.

**Path forward (clean, account-local):** create a **new Cloudflare Pages project in THIS account** from the
repo (no build command; output dir = repo root; serves git-tracked files as-is), deploy current `main`, then
**attach `clovelearn.io` as the Pages custom domain** (Cloudflare repoints the zone's DNS to the new project).
After deploy, verify `clovelearn.io/arcade/city/index.html` → **200** BEFORE the Worker route step. (Direct
`wrangler pages deploy <clean-dir>` is viable — the token has Pages access; deploy git-tracked files only,
not the repo root with its `node_modules`/`atip/.venv`.)

**Implication:** launching the city feature requires a **fresh production Pages deploy** that includes
`arcade/` (and the Phase 5 `arcade/city/*` client). **Confirm + act (dashboard):**
- Pages project name; is auto-deploy from `main` actually **enabled**, and when did it last deploy?
- Either re-trigger the integration to rebuild current `main`, or run a manual `wrangler pages deploy`.
- After redeploy, verify `clovelearn.io/arcade/city/index.html` → **200** (client present) BEFORE relying
  on the Worker route.
- Workers-route-over-Pages precedence for `clovelearn.io/arcade/*` is documented Cloudflare behavior;
  verify at the deploy step (`clovelearn.io/arcade/health` → 200 from the Worker, `clovelearn.io/` still Pages).

### 7d. Deploy credential scope — partially mapped
The `.env` User API Token (rbardyla@gmail.com, account `bea9dc96…`): deploys **Workers** (proven on
staging); **can read Pages** (`/pages/projects` → `success:true`, 0 projects — so the scope is present, the
account simply has none); **lacks Zone-DNS:Read** (`/dns_records` → auth error `10000`). Pages **write/edit**
is unverified (read works; a `wrangler pages deploy` needs Pages:Edit). The Worker deploy + the narrow
Workers routes do not need Pages scope. Note the production site is **manually uploaded** by the owner (not
git-integrated, not GitHub Actions — no `.github/workflows`), to a destination **outside this account** (§7c).

### 7e. First-time DO provisioning acceptance — confirm
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
1. AUTHORIZED: RUN PRODUCTION PRE-FLIGHT        ✅ DONE (candidate pinned; validation green)
2. AUTHORIZED: RESOLVE PRODUCTION ROUTING PLAN  ✅ DONE (architecture decided: same-origin clovelearn.io/arcade/*)
3. Confirm §7c/§7d in the Cloudflare dashboard  ← remaining (Pages pipeline + token Pages-scope) — NOT code
4. AUTHORIZED: DEPLOY PRODUCTION WORKER         → add [env.production].routes + wrangler deploy --env production
5. AUTHORIZED: PRODUCTION WORKER SMOKE          → workers.dev health/clock-reject before routing flips
6. AUTHORIZED: DEPLOY/CONFIRM PRODUCTION CLIENT (Pages) + confirm the /arcade/* route is live
7. AUTHORIZED: FULL-ORIGIN PRODUCTION SMOKE (clovelearn.io) + SIGN-OFF
```

## 10. Bottom line
Worker side: **green, low-risk, ready.** Routing **architecture decided** — preferred same-origin
(`clovelearn.io/arcade/*` → `neon-arcade-mesh`, no client change), feasible because clovelearn.io is a
Cloudflare zone. Remaining before deploy are **two dashboard facts** (§7c Pages pipeline, §7d token
Pages-scope), not code. Do **not** run `AUTHORIZED: DEPLOY PRODUCTION WORKER` until §7c/§7d are confirmed
and you accept first-time DO provisioning (§7e). Production and the HiveWorld lab lineage are untouched;
this plan performs no deploy.
