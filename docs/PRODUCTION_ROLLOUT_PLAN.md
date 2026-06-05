# Neon Circuit — Production Rollout Plan

**Status: 🟢 LAUNCHED & SIGNED OFF 2026-06-05.** The full city feature is live on `clovelearn.io` and
**validated by real cross-device multiplayer** (operator confirmed: phone + PC see each other and play all
games). City tab shows **● LIVE**; presence, Host Rank, City Pressure, and the World Log render live;
console clean except the benign CF `beacon.min.js` CSP block. Network path also verified: static client 200
(incl. `/arcade/city/`), DO Worker `neon-arcade-mesh-production` up, the 4 narrow routes win over the
`wild-hat-6257` custom domain, both `/arcade/city/ws?city=…` and `/arcade/ws?room=…` → `101`, static site
untouched. **No open items.**

_History (now done): this was a FULL feature launch from a baseline where production had none of it — the
static-assets Worker `wild-hat-6257` held a stale build predating `arcade/`, the DO Worker was undeployed,
and no routes existed. Closed by: clean 234-file re-upload (client), `wrangler deploy --env production`
(Worker + 4 DOs + v1→v4), and 4 narrow `/arcade/...*` routes._

**Three components must land (in order):** (1) a **fresh upload to `wild-hat-6257`** including `arcade/` so
the city client exists at `clovelearn.io/arcade/city/*`; (2) the **DO Worker** `neon-arcade-mesh`
(`wrangler deploy --env production`, provisions 4 DOs + v1→v4); (3) **narrow Workers routes** for the
Worker's five API/WS endpoints under `/arcade/` — **NOT** a broad `/arcade/*`, which would 404 the static
client (see §0).

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
  { pattern = "clovelearn.io/arcade/ws*",      zone_name = "clovelearn.io" },
  { pattern = "clovelearn.io/arcade/city/ws*", zone_name = "clovelearn.io" },
  { pattern = "clovelearn.io/arcade/rooms*",   zone_name = "clovelearn.io" },
  { pattern = "clovelearn.io/arcade/health*",  zone_name = "clovelearn.io" },
]
```
**Every pattern ends in `*` — required.** CORRECTION (verified live 2026-06-05): a Cloudflare route
WITHOUT a trailing `*` matches the path ONLY when there is no query string. The client connects to
`/arcade/city/ws?city=<id>` and `/arcade/ws?room=<id>`, so a bare `clovelearn.io/arcade/city/ws` route
**404s the real request** (it falls through to the `wild-hat-6257` static Worker) while a no-query probe
reaches the DO Worker — exactly the symptom observed. The trailing `*` absorbs the query. `rooms*` already
covers `/arcade/rooms` + `/arcade/rooms/health`; none of these patterns shadow a static asset (no file path
starts with `ws`/`city/ws`/`rooms`/`health`). `wrangler deploy --env production` registers them against the
**production** Worker `neon-arcade-mesh-production` (env-default name; do **NOT** bind to
`neon-arcade-mesh-staging`). Production smoke `WS_URL` = `wss://clovelearn.io/arcade/city/ws?city=downtown-01`.

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

### 7c. Production host IDENTIFIED: Workers static-assets Worker `wild-hat-6257` (this account) — stale build
**Resolved (dashboard + API).** clovelearn.io is served by a **Cloudflare Workers static-assets Worker**
named **`wild-hat-6257`** in THIS account (`bea9dc96…`), with **clovelearn.io attached as a Custom Domain**
(also `wild-hat-6257.rbardyla.workers.dev`). It is **assets-only** (Bindings 0, Workers 0; dashboard:
"Metrics is unavailable for Workers with only static assets"), deployed via the dashboard **"Upload static
files"** flow ("Automatic deployment on upload", last deploy ~9 days ago). This is **not** Cloudflare Pages
(hence 0 Pages projects), but it honors `_headers`/`_redirects` identically (live `/index.html → /deck.html`
302 + `Permissions-Policy` byte-match this repo). The deployed build **predates `arcade/`** → all
`/arcade/* → 404`.

**Fix — the owner's normal flow: re-upload the current build including `arcade/`.** The dashboard uploader
caps at **1000 files**; dragging the repo root fails (pulls in `node_modules`/`atip/.venv`/`.git` =
thousands). Use a **clean tree of git-tracked files only** — built at **`~/Downloads/clovelearn-upload`**
(**414 files**, 19 MB, `index.html` at root, `arcade/city/*` present) — drag that into "Upload static files"
→ Deploy. CLI alternative (uploads up to 20,000 files):
`wrangler deploy --name wild-hat-6257 --assets ~/Downloads/clovelearn-upload` — the token deploys Workers,
**but verify it preserves the clovelearn.io Custom Domain** before relying on it; the dashboard drag is the
zero-risk path. After deploy, confirm `clovelearn.io/arcade/city/index.html` → **200** BEFORE the Worker step.

**Routing implication for §0 (changed by this finding).** clovelearn.io is a **Custom Domain on
`wild-hat-6257`** (an implicit catch-all), not Pages. The narrow `/arcade/...` routes → `neon-arcade-mesh`
must be **more specific** than that catch-all to win. **Verify at the deploy step** that the narrow routes
take precedence over the `wild-hat-6257` custom domain for those exact paths (Cloudflare evaluates the most
specific match). If precedence does not hold, the fallback is `window.__NEON_ARCADE_CONFIG__.cityWsUrl =
wss://neon-arcade-mesh.rbardyla.workers.dev/arcade/city/ws` (re-enables §7a's override) — but that is
cross-origin, so prefer the route.

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
Workers routes do not need Pages scope. The production site is **manually uploaded** by the owner via the
dashboard "Upload static files" flow to the `wild-hat-6257` static-assets Worker **in this account** (§7c) —
not Pages, not git-integrated, no GitHub Actions.

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
2. AUTHORIZED: RESOLVE PRODUCTION ROUTING PLAN  ✅ DONE (narrow routes; host = wild-hat-6257 custom domain, §7c)
3. Identify host + DEPLOY CLIENT                ✅ DONE 2026-06-05 (uploaded clean 234-file build incl. arcade/
                                                   to wild-hat-6257 "Upload static files"; /arcade/city/ → 200
                                                   verified; no regression; infra stripped/not public)
4. DEPLOY PRODUCTION WORKER (no routes)         ✅ DONE 2026-06-05. `wrangler deploy --env production` →
                                                   Worker **neon-arcade-mesh-production** (env default suffix;
                                                   [env.production] sets no `name`). 187.10 KiB/40.74 gz;
                                                   4 DOs + v1→v4 provisioned. Version c63c4d8f-7944-44f1-a13b-
                                                   8df7161c9487. URL neon-arcade-mesh-production.rbardyla.workers.dev.
                                                   NO routes → clovelearn.io verified unchanged (/, client 200).
5. PRODUCTION WORKER SMOKE (workers.dev)        ✅ DONE. /arcade/health 200 (service neon-arcade-mesh) ·
                                                   POST /__test_set_event_now 404 · /arcade/rooms/health 200 ·
                                                   /arcade/rooms 200 · /arcade/city/ws → 101 over HTTP/1.1.
                                                   NOTE: a WS probe over HTTP/2 returns 500 "City DO fetch failed"
                                                   — a curl/h2 artifact (known-good STAGING behaves identically);
                                                   browsers use h1.1 → 101. Plain non-WS GET to /city/ws → 500
                                                   (pre-existing: DO expects an upgrade; matches staging; benign).
6. ADD NARROW ROUTES                            ✅ DONE 2026-06-05 (via dashboard Workers Routes, bound to
                                                   neon-arcade-mesh-production): /arcade/ws* · /arcade/city/ws* ·
                                                   /arcade/rooms* · /arcade/health. GOTCHA (verified live): a
                                                   route WITHOUT trailing `*` does NOT match a query string, so
                                                   the WS routes MUST be `…/ws*` (the client uses ?city=/?room=).
                                                   Precedence over the wild-hat-6257 custom domain CONFIRMED
                                                   (/arcade/health 200 from Worker; static paths still 200 static).
7. FULL-ORIGIN SMOKE (clovelearn.io)            ✅ DONE + SIGNED OFF. Network: /arcade/city/ws?city=downtown-01
                                                   → 101 · /arcade/ws?room=main-floor → 101 · /arcade/health 200 ·
                                                   / 200 · /arcade/city/ 200. Browser end-to-end: ● LIVE, presence/
                                                   Host Rank/City Pressure/World Log render; operator confirmed
                                                   CROSS-DEVICE play (phone+PC see each other, all games). Console
                                                   clean except benign CF beacon.min.js CSP block. 🟢 LAUNCH COMPLETE.
```

## 10. Bottom line
Worker side: **green, low-risk, ready.** Routing **architecture decided** — preferred same-origin
(`clovelearn.io/arcade/*` → `neon-arcade-mesh`, no client change), feasible because clovelearn.io is a
Cloudflare zone. Remaining before deploy are **two dashboard facts** (§7c Pages pipeline, §7d token
Pages-scope), not code. Do **not** run `AUTHORIZED: DEPLOY PRODUCTION WORKER` until §7c/§7d are confirmed
and you accept first-time DO provisioning (§7e). Production and the HiveWorld lab lineage are untouched;
this plan performs no deploy.
