# Creator Foundation CF-5 — Tiled-Map / Asset-Pack Workflow

**Status:** implemented, **local/operator-only, offline, no live-world load, no deploy.**
**Not:** public upload · live map mutation · unapproved packages · external assets · economy · ownership · rent · accounts · marketplace.
**Parents:** `docs/NEON_CIRCUIT_CREATOR_PIPELINE_ROADMAP.md` (CF-5), `docs/CREATOR_FOUNDATION_CF2_APPROVED_LOADER.md` (the approved registry it builds on).

## What CF-5 adds

The bridge between *"we can validate/approve packages"* and *"we can later build bigger districts."* An
**asset pack** is a LOCAL tiled-isometric map **composition**: a small bounded grid whose tiles each
reference an **already-approved, hash-addressed** block package. It composes approved blocks locally and
renders them — with **no live-world reach**.

```
arcade/creator/schemas/asset-pack-schema.mjs           pack constants + bounds
arcade/creator/validator/validate-asset-pack.mjs       validator (approved-hash-only) + resolver
arcade/creator/map-viewer/{index.html, map-viewer.mjs} local tiled-iso map viewer (offline)
arcade/creator/samples/sample-asset-pack/{pack,registry}.json   sample composition
```

## A. The pack (data-only, approved-hash-only)

A `city_asset_pack` is a small grid of tiles, each pointing at a block package **by canonical hash**:

```js
{
  schema_version: 1, pack_kind: 'city_asset_pack',
  pack_id: 'downtown-mini-map',                 // kebab slug, economy-term-clean
  grid: { cols: 2, rows: 2 },                   // bounded: cols/rows ≤ 8
  tiles: [                                       // bounded: ≤ 32, unique (gx,gy), in-grid
    { gx, gy, package_hash: 'sha256:…', package_kind: 'block_style' | 'block_layered' },
  ],
  constraints: { no_external_assets: true, no_live_world_load: true, approved_hashes_only: true }
}
```

A tile carries **no package body and no URL** — only a hash. There is no way to reference an external
asset or inline arbitrary content.

## B. Validator — the CF-5 rule

`validateAssetPack(pack, registry)` is deny-by-default and reuses the CF-1 safety primitives
(`isPlainData`/`scanSafety`/`FORBIDDEN_TERMS_RE`). Beyond strict keys / bounds / unique positions /
size, the **core rule** is:

> **Every tile's `package_hash` must be APPROVED-LOCAL in the CF-2 registry**
> (`resolveApprovedPackage(registry, hash)` returns an `operator_approved_local`, `live_world_authorized:
> false` entry), and the tile's `package_kind` must match the registry entry.

The registry itself is validated first (`validateRegistry`); an invalid or **empty** registry approves
nothing, so every tile is rejected. A pack pointing at an unapproved hash is **BLOCKED**.

## C. Resolver — hash-verified bodies

`resolveAssetPack(pack, registry, packageStore)` (given a local store of package bodies keyed by hash)
returns renderable tiles **only** for tiles whose hash is approved, whose body is present, **and whose
recomputed canonical hash matches the referenced hash** (tamper check) with a matching kind. A body
mutated after approval no longer matches its hash and is dropped.

## D. Map viewer (local, data-only, no code execution)

`arcade/creator/map-viewer/` is an offline page that loads a pack + an approved registry + a local
package store, validates + resolves, and renders the composition on an iso grid using the **existing**
block renderers (`drawBlock` / `drawLayeredBlock`). It renders approved package **DATA** — it never
executes package code (so no sandbox is needed, unlike CF-4's arcade runner), has **no submit/upload/
live control**, and a strict CSP (`default-src 'self'`, no external, `frame-src 'none'`). An unapproved
hash → a BLOCKED report and an empty canvas.

## Isolation / non-goals

All CF-5 files live under `arcade/creator/**` → **excluded from the curated client upload** (verified:
no `map-viewer` / `asset-pack` / `sample-asset-pack` path in the curated `--list`). **No Worker/DO change**
(dry-run byte-identical, 200.81 KiB). No live map mutation, no public upload, no production, and **no
economy/ownership/rent/accounts/marketplace** — the near-term "scale" story is **local composition** of
approved blocks, not hosting or commerce.

## Validation

```
node --test tests/creator/asset-pack-validator.test.mjs   # 10 unit (approved-hash-only, bounds, tamper, deny-by-default)
bash  tests/creator/run-map-viewer.sh                      # 8-check browser smoke (render approved tiles + BLOCK unapproved + no off-host net)
node --test tests/creator/*.test.mjs                        # 136 creator unit (126 + 10), green
node --test tests/arcade/*.test.mjs                         # 608 arcade unit (unchanged), green
node --test tests/creator/curated-upload.test.mjs           # CF-5 excluded from curated upload
node tests/arcade/check-production-config.mjs                # PASS; node scripts/check-city-build-size.mjs — within budget
cd workers/arcade && wrangler deploy --dry-run              # byte-identical (200.81 KiB) — no Worker change
```

## Next Creator Foundation phase

```
CF-6  Hive validation SERVICE prototype — DONE (zero live trust). A pack's tiles reference CF-2-approved
      hashes; CF-6 verdicts and CF-5 approvals are both local-only and grant no live trust.
CF-7 (= "CF-E")  operator-approved LIVE loader — the first live-world render, only behind a human-cleared,
      separately-authorized review (flips LIVE_WORLD_LOADER_ENABLED, which is still false). A CF-5
      composition of approved blocks is a PRECONDITION shape for a future Hive-hosted district, never a
      sufficient cause for going live.
CF-8  moderation + human-review queue — content review before any live approval.
```

The live world stays closed. CF-5 proves local map composition of approved blocks; the live gate is CF-7.
Detail + lineage: `docs/NEON_CIRCUIT_CREATOR_PIPELINE_ROADMAP.md`.
