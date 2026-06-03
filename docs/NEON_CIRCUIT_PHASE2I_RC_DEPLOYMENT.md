# Neon Circuit — Phase 2i RC: Release Notes + Deployment Checklist

Release candidate: **`phase2i-arcade-rc1`** → `main` @ `2d25728` (local annotated tag `86b645e`, not yet pushed).

This document is **docs/deployment-readiness only**. It does not change product behavior. Deploying the Worker/DO is a separate, operator-driven action — nothing here deploys anything.

---

## 1. What this RC is

The first integrated release candidate for the Neon Circuit arcade **Worker + Durable Object mesh** (`workers/arcade/`, Worker name `neon-arcade-mesh`). It lands Phase 1d → Phase 2i on `main`:

- **Phase 1** (1d–1l): server-authoritative occupancy + tickets, the arcade loop (catalog/ledger/prize counter/cosmetics), three cabinets (Pulse Tap, Signal Sprint, Neon Grid), the challenge board + achievements + public feed, the cabinet frame contract, and the adapter SDK + dynamic loader.
- **Phase 2** (2a–2i): multi-room lobby → per-room DO sharding + RoomRegistry coordinator → room presence health → smart-lobby presence UX → scheduled room events → live event feed → pre-roll → operator-tunable presentation → per-room live-ops presentation overrides.

All Phase 2e–2i event/presentation features are **display-only**: no rewards, multipliers, ticket/prize/economy changes. Internal arcade points only — no money/crypto/transferable goods.

**Validation at the tag (`2d25728`):** 331/331 unit · 11/11 dev-shim browser specs · real `wrangler dev` Worker/DO (incl. DO-to-DO registry + per-room override) · esbuild bundle 116,047 B · guardrail grep clean · zero console/page errors.

> Note: this Worker/DO mesh is a **separate project from the static Cloudflare Pages site** that serves `arcade/*`. The Pages site connects to the Worker via the WebSocket URL.

---

## 2. Deployment topology

| Component | What it is | Deploy surface |
|---|---|---|
| `neon-arcade-mesh` Worker | `workers/arcade/src/index.ts` | `wrangler deploy` |
| `ArcadeRoom` DO | per-room shard (`idFromName(roomId)`) | DO migration `v1` |
| `RoomRegistry` DO | single coordinator (population, status, health, presentation overrides) | DO migration `v2` |
| Static arcade client | `arcade/*` (Pages) | separate Pages deploy; points at the Worker WS URL |

**Public Worker routes** (`index.ts`): `GET /arcade/ws` (WebSocket), `GET /arcade/rooms` (room list), `GET /arcade/rooms/health` (health envelope), `GET /arcade/health` (worker health). The `/registry/*` routes are internal DO-to-DO only (not externally routed).

---

## 3. Cloudflare DO migrations (`wrangler.toml`)

Two SQLite-backed DO classes are declared. On first deploy to a new environment **both** migrations apply automatically:

```toml
[durable_objects]
bindings = [
  { name = "ARCADE_ROOM",   class_name = "ArcadeRoom" },
  { name = "ROOM_REGISTRY", class_name = "RoomRegistry" }
]

[[migrations]]
tag = "v1"
new_sqlite_classes = ["ArcadeRoom"]

[[migrations]]
tag = "v2"
new_sqlite_classes = ["RoomRegistry"]
```

Checklist:

- [ ] First deploy: confirm wrangler reports applying migration tags `v1` **and** `v2` (creating `ArcadeRoom` + `RoomRegistry` SQLite classes).
- [ ] Re-deploys: no new migration tags should apply (the tag list is unchanged in this RC). Adding/removing a DO class later requires a **new** `[[migrations]]` tag — never edit a shipped tag.
- [ ] Do **not** rename `class_name` or `name` for an already-deployed DO without a rename migration — it would orphan existing DO state.

---

## 4. Environment configuration (CRITICAL — read before deploying)

`wrangler.toml [vars]` ships **local-development defaults**. These are correct for `wrangler dev`, but **must be reviewed/overridden for production**.

### 4.1 `ENVIRONMENT` — ⚠️ production gating

```toml
[vars]
ENVIRONMENT = "development"   # <-- committed default; DEV ONLY
```

The **test-only event-clock override** `__test_set_event_now` is accepted by `ArcadeRoom` **only when `env.ENVIRONMENT === "development"`** (`arcade-room.ts`). It fast-forwards the room-event schedule for deterministic tests. **If `ENVIRONMENT` stays `"development"` in production, this test hook is LIVE** and any client could shift the displayed event schedule (display-only, but still undesirable in prod).

- [ ] **Production deploy MUST set `ENVIRONMENT` to a non-`"development"` value** (e.g., `production`), via an `[env.production] vars` block or `--var ENVIRONMENT:production` at deploy. Verify `__test_set_event_now` is rejected post-deploy (see §7).

### 4.2 Admin both-gate: `ADMIN_ENABLED` + `ADMIN_TOKEN`

Room-lifecycle + presentation admin ops (`reset`, `set_status`, `diagnostics`, `set_presentation`, `clear_presentation`, `preview_presentation`, `presentation_diagnostics`) require **BOTH** guards (defense in depth, `admin.mjs`):

1. `ADMIN_ENABLED === "true"` (a var), **AND**
2. a caller token that matches the server-side `ADMIN_TOKEN` **secret**.

If the token secret is unset, **admin is OFF regardless of the flag** — a default deploy has no admin surface until you explicitly configure the secret.

```toml
[vars]
ADMIN_ENABLED = "true"        # committed default
# ADMIN_TOKEN is intentionally NOT in wrangler.toml — set out-of-band.
```

- [ ] Decide whether admin tooling should be enabled in this environment. If **not**, set `ADMIN_ENABLED = "false"` for prod (or leave the secret unset — admin stays off).
- [ ] If admin **is** wanted: `wrangler secret put ADMIN_TOKEN` (a strong random value). **Never** commit the token; never echo it into logs.
- [ ] Rotate `ADMIN_TOKEN` if it may have been exposed.
- [ ] Confirm post-deploy that a wrong/missing token is rejected (`bad_admin_token` / `missing_admin_token`) and only the correct token is accepted.

### 4.3 Operator-tunable event presentation (optional `EVENT_*` vars)

All **optional**, **display-only**, validated + clamped; absent or invalid → safe defaults (fail-safe). Set via `[vars]`/`[env.*.vars]` or `--var`.

| Var | Meaning | Default | Bounds (clamped) |
|---|---|---|---|
| `EVENT_PREROLL_LEAD_MS` | how far ahead the next event is announced "upcoming" | `120000` (2 min) | `10000` … `1199000` (10s … window−1s) |
| `EVENT_COUNTDOWN_REFRESH_MS` | floor live `m:ss` countdown refresh interval | `1000` | `250` … `60000` |
| `EVENT_SHOW_NEXT` | show the next-event preview line | `true` | bool (`true`/`false`/`1`/`0`) |
| `EVENT_SHOW_FEATURED` | show the featured-cabinet chip/tile | `true` | bool |

Notes: the event window is a fixed `EVENT_WINDOW_MS = 20 min` constant (not env-tunable). Per-room overrides on top of these env values are set at runtime via the both-gated `set_presentation` admin op (not via env). A bad value never breaks presentation — it falls back to the default.

- [ ] If you want non-default presentation, set the relevant `EVENT_*` var(s); otherwise omit them.
- [ ] Confirm `GET /arcade/rooms` (or a `room_events` payload) reflects the chosen `presentation` block post-deploy.

---

## 5. Pre-deploy: build + dry-run

Run from `workers/arcade/` with Node ≥ 20 (this RC's `wrangler dev`/real-DO validation used Node 22):

- [ ] `npm ci` (clean install of pinned deps).
- [ ] **Dry-run** (build + validate config without deploying):
  ```bash
  wrangler deploy --dry-run --outdir dist
  ```
  Expect: a clean bundle (~116 KB at this RC) and the two DO migrations (`v1`, `v2`) listed as pending on a fresh environment.
- [ ] Confirm `compatibility_date = "2026-05-31"` and Worker `name = "neon-arcade-mesh"` match the intended target account/environment.
- [ ] Re-run the local validation gate against the tagged commit (read-only):
  ```bash
  node --test tests/arcade/*.test.mjs            # 331/331
  # browser specs need a Playwright install (PW_REQUIRE_BASE) + the dev-shim
  ```

---

## 6. Deploy

- [ ] Deploy with the **production** environment overrides from §4 applied (do **not** ship `ENVIRONMENT=development`):
  ```bash
  # example — adapt to your env strategy ([env.production] block preferred over --var)
  wrangler deploy --var ENVIRONMENT:production
  ```
- [ ] If admin is wanted: ensure `ADMIN_TOKEN` secret is set **before** relying on admin ops.
- [ ] Capture the deployed version id / tag for traceability; associate it with `phase2i-arcade-rc1` (`2d25728`).

---

## 7. Post-deploy smoke validation

Minimum, public-safe checks against the deployed Worker:

- [ ] `GET /arcade/health` → ok.
- [ ] `GET /arcade/rooms` → the 3 rooms with `status`/`health`/`population`, and a top-level `presentation` block reflecting your `EVENT_*` config (or defaults).
- [ ] `GET /arcade/rooms/health` → public-safe health envelope; **no** balances/ledger/inventory/player-ids/token in the JSON.
- [ ] WebSocket connect to `/arcade/ws?room=main-floor`: join, occupy a cabinet, play a round, confirm a server-authoritative ticket award + ledger entry; a second client sees occupancy but **no** private balance/ledger leak.
- [ ] **Production gating:** send `__test_set_event_now` over the socket → it must be **ignored/rejected** (only honored when `ENVIRONMENT==="development"`). If the event schedule shifts, `ENVIRONMENT` is mis-set — fix before going live.
- [ ] **Admin gating:** a presentation/admin op with no token or a wrong token → denied (`missing_admin_token`/`bad_admin_token`); with the right token (if admin enabled) → accepted; diagnostics expose no private fields.
- [ ] Optional: drive the full Playwright browser suite (the 11 specs) against the deployed Worker by pointing `WS_URL`/`BASE_URL` at it (same harness used in validation). Run presence-sensitive specs (`room-health`, `multi-room`) first against a fresh DO namespace to avoid persisted-state test-order artifacts (see §9).

---

## 8. Rollback plan

DOs are stateful; prefer a **forward-safe** rollback (re-deploy the previous Worker version) over destructive state changes.

- [ ] **Worker code rollback:** `wrangler rollback` (or re-deploy the prior version id). This RC introduced **no destructive schema change** beyond adding the `RoomRegistry` class (migration `v2`); rolling the Worker code back to a build that still binds both DO classes is safe.
- [ ] **Do NOT delete or recreate DO classes** to roll back — that destroys live room/registry state. A code rollback that keeps the `ARCADE_ROOM` + `ROOM_REGISTRY` bindings is the safe path.
- [ ] If you must roll back to a **pre-RoomRegistry** Worker (before migration `v2`): that requires a deliberate migration plan (the registry coordinates population/health/overrides). Treat as a migration, not a quick rollback — out of scope for this RC.
- [ ] **Config rollback:** `ENVIRONMENT`, `ADMIN_ENABLED`, and `EVENT_*` are just vars/secrets — revert by re-deploying with the prior values or `wrangler secret delete ADMIN_TOKEN`. Admin fails safe-off without the secret.
- [ ] **Tag traceability:** `phase2i-arcade-rc1` marks the exact validated commit to roll forward/back to.

---

## 9. Known limitations / operational notes

- **Display-only event/presentation layer:** events, pre-roll, presentation config, and per-room overrides never change tickets/prizes/challenge rewards/formulas. Verified: 0 diff to any ticket/prize/cabinet formula across Phase 2e–2i.
- **Admin is operational tooling, not a product auth system:** there are no accounts and no auth provider. The both-gate (`ADMIN_ENABLED` + `ADMIN_TOKEN`) protects room-lifecycle + presentation ops only. Length-checked token equality (not constant-time) — acceptable for an operational secret in this edge/testbed context, not a user credential.
- **Per-room presentation overrides are admin-set + room-scoped** — not per-user/per-request. Stored in `RoomRegistry`; `ArcadeRoom` fetches its effective config DO-to-DO and **fails open to the env base** if the registry is briefly unreachable (display reverts to default; event *timing* is pure/deterministic and unaffected).
- **Real-DO test-order artifact (test harness only):** `wrangler dev` persists DO state to `.wrangler/state/`. Presence-sensitive specs (`room-health`'s "fresh registry", `multi-room`'s per-room balances) assume a pristine registry and can fail if run after other specs pollute state. Mitigation: run them first against a fresh DO (or clear `.wrangler/state`). On a pristine DO they pass fully (room-health 14/14). The dev-shim is pristine per process, so it never sees this.
- **Live `m:ss` countdown** is a client-side timer anchored to the latest `room_events` snapshot (no per-second server round-trips); the lobby room list is a registry snapshot at real time.
- **Stale population eviction** thresholds and health derivation live in the registry; tune only via code (not env) if needed.
- **HiveWorld is NOT part of this deploy.** The CRDT simulator (`arcade/hiveworld-sim/`, parity through `v0.9`) is a separate lab lineage, never bridged into the product Worker/DO. 0 `hiveworld-sim/` files exist on `main`.

---

## 10. Outstanding (non-blocking) cleanup

- **Stale PR #3** (`feat/neon-circuit-phase1d-pulse-tap-gameplay`) is still open on GitHub — its content (`763c889`) already landed via PR #4, so it is an empty-diff duplicate. Safe to close (gated: `AUTHORIZED: CLOSE STALE PR #3`).
- **RC tag push** — `phase2i-arcade-rc1` is **local only**. Push is gated (`AUTHORIZED: PUSH PHASE2I RC1 TAG`).

---

## 11. Go / no-go checklist (condensed)

- [ ] Dry-run clean; bundle ~116 KB; migrations `v1`+`v2` recognized.
- [ ] `ENVIRONMENT` overridden to non-`development` for prod (test hook off).
- [ ] Admin decision made: `ADMIN_ENABLED` set deliberately; `ADMIN_TOKEN` secret set (or admin intentionally off).
- [ ] `EVENT_*` set or intentionally defaulted.
- [ ] Post-deploy smoke (§7) green, incl. test-hook-off + admin-gate + no-private-leak.
- [ ] Rollback path confirmed (Worker code rollback keeping both DO bindings).
- [ ] Deployed version id recorded against `phase2i-arcade-rc1` / `2d25728`.
