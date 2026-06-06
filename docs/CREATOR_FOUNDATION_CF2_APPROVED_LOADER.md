# Creator Foundation CF-2 — Approved Hash Loader + Curated Upload Exclusion

**Status:** implemented, **local/operator-only, no live-world loading, no deploy.**
**Not:** public upload · open UGC · marketplace · ownership · paid hosting · accounts.

CF-2 is the next safety layer after CF-1. CF-1 built the *local authoring + validation* foundation
(block editor, package schemas, pure validators, canonical hash, `local_validation_only` receipt,
procedural isometric preview, arcade SDK template, size gate). CF-2 builds the **approved-hash
boundary** — the structure that decides *whether a validated package may be trusted by a loader at
all* — plus the **curated upload exclusion** that keeps the creator tools out of the production
static site until that boundary is deliberately opened.

## North star vs. current scope

The long-term north star is APB-level customization *depth* — deep, expressive player customization —
but under the narrower Neon Circuit constraints: closed tokens, procedural composition, small files,
theme-safe palettes, isometric / top-down GTA-1 city readability, Hive validation, and **no** arbitrary
scripts/assets, **no** marketplace, **no** ownership, **no** paid hosting. CF-2 does not add depth; it
makes the *trust boundary* real so depth can be added safely later.

## Core doctrine (unchanged from CF-1, made structural in CF-2)

```
Nothing player-authored enters the live world directly.
Everything is: local first → packaged → hash-addressed → validated → approved by an explicit
receipt → loaded only from an approved registry.
```

CF-2 still does **not** make any user content live. It builds the approved-hash boundary and the
local/operator preview, and proves the boundary by **refusing** every live-world load.

## A. Approved package registry — `arcade/creator/approval/approved-package-registry.mjs`

A registry is a **static, local** allowlist of packages an operator has reviewed, keyed by canonical
package hash. A package the registry does not list is, by definition, unapproved.

```js
{
  schema_version: 1,
  registry_kind: "creator_approved_packages",
  packages: [
    {
      package_hash: "sha256:…",
      package_kind: "block_style",
      display_name: "Demo Neon Facade",
      approval_status: "operator_approved_local",
      approved_at: "2026-06-06T00:00:00.000Z",
      validator_version: "creator-validator-cf2",
      live_world_authorized: false        // CF-2: ALWAYS false. A true value is REJECTED.
    }
  ]
}
```

`validateRegistry` is strict / deny-by-default: unknown top or entry keys, a bad status, a duplicate
hash, or any `live_world_authorized: true` are rejections. `resolveApprovedPackage(registry, hash)`
returns an entry only when it is `operator_approved_local` (and `live_world_authorized: false`).
No network, no server, no live-world load. `EMPTY_REGISTRY` is the safe default (approves nothing).

## B. Approval receipt — `arcade/creator/approval/approval-receipt.mjs`

A receipt is the atomic, **hash-bound** approval artifact for one package. It records what an operator
decided locally about a package (identified by `package_hash`) and at what trust level. It is itself
hash-addressed (`receipt_hash` = canonical SHA-256 of the receipt body) so it cannot be silently
edited after sealing.

```js
{
  schema_version: 1,
  receipt_kind: "creator_approval_receipt",
  package_hash: "sha256:…",
  package_kind: "block_style",
  approval_status: "operator_approved_local",
  validator_version: "creator-validator-cf2",
  operator_note: "Reviewed locally for offline preview.",
  live_world_authorized: false,           // hard-wired false; there is NO parameter to set it true
  approved_at: "2026-06-06T00:00:00.000Z",
  receipt_hash: "sha256:…"                 // deterministic over the body
}
```

Allowed statuses — **none implies production authorization**:

```
local_validation_only      (validated locally; not approved to load anywhere)
operator_approved_local    (operator-cleared for an OFFLINE local preview; still not live)
rejected
```

`validateReceipt` rejects unknown keys, a bad status, a `live_world_authorized: true`, or a
`receipt_hash` that no longer matches the body (tamper detection). `buildApprovalReceipt` has no
way to produce a live-authorized receipt.

## C. Approved-hash loader — `arcade/creator/approval/approved-loader.mjs`

The loader is the trust boundary between a local package and anywhere it might render. It loads a
package only when **all** hold:

```
recomputed canonical hash == receipt.package_hash      (rejects a modified package / wrong receipt)
the package is valid data for its kind                 (reuses the CF-1 validators)
that hash is listed in the approved registry           (rejects an unapproved package)
the receipt AND the registry entry say operator_approved_local
```

Two modes:

```
local_preview : may load an approved-local package for an OFFLINE preview (never the live world).
live_world    : ALWAYS rejected in CF-2 → reason "live_world_loader_not_enabled".
```

`LIVE_WORLD_LOADER_ENABLED` is a **module constant set to `false`** and checked first, so no input —
even a perfectly approved package — can reach the live world through any code path here. The boundary
is double-locked: flipping the constant in a future phase would still require `live_world_authorized:
true`, which CF-2's receipt/registry validators reject. Deny-by-default: every failed check returns a
structured rejection (`receipt_hash_mismatch`, `not_approved`, `missing_receipt`, `package_invalid`,
`invalid_receipt`, `live_world_loader_not_enabled`, …); nothing is thrown into the live world.

## D. Local editor integration — `arcade/creator/block-editor/`

A new **Approved local preview (operator)** card lets the operator import a package JSON + its approval
receipt JSON. The editor recomputes the canonical hash, shows it and the receipt status, and runs the
**same approved-loader** in `local_preview` mode against an ephemeral local registry derived from the
receipt. On success it renders an offline procedural preview and shows:

```
Local preview only — not authorized for live world.
```

There is **no submit button, no upload button, no live-world button**. The live-world loader is
disabled in code, so the editor cannot, even by mistake, push anything live.

## E. Curated upload exclusion — `scripts/build-curated-client-upload.mjs`

The creator files live under `arcade/creator/**`. CF-1 made them git-tracked, which created a real
risk: the production static site (`wild-hat-6257`, clovelearn.io) is uploaded as a clean tree of
git-tracked files, so a naive upload would now publish the editor/loader tooling. This script builds
the curated tree explicitly:

```
source     = git-tracked files (node_modules/.git/.env/.wrangler/dist excluded by construction)
minus      = arcade/creator/ · tests/ · docs/ · workers/ · tools/ · electron-app/
             .claude/ · .powerplant/ · .github/ + defensive .env*/.git/node_modules/dist
keeps      = the live client: index + page HTML, arcade/, arcade/city/, fonts/, and the vendored
             libs the client loads (e.g. scripts/three.min.js, referenced by arcade/city/index.html)
```

```
node scripts/build-curated-client-upload.mjs                 # → ~/Downloads/clovelearn-phase6-client-upload
node scripts/build-curated-client-upload.mjs --out /tmp/x    # custom destination
node scripts/build-curated-client-upload.mjs --list          # print the curated file list, copy nothing
```

It **fails (and copies nothing)** if any forbidden path — above all `arcade/creator/**` — would be
included, or if `arcade/city` is missing. The pure `isExcludedFromUpload(relPath)` predicate is unit
tested; the builder writes an `_UPLOAD_MANIFEST.json` recording the file count and exclusions. On this
repo the curated tree is ~238 files, matching the documented production tree while now excluding the
creator tools. It deploys nothing and changes no Worker/DO/route.

## What CF-2 is NOT

```
public upload · open UGC · arbitrary image/audio/JS in packages · live-world player submit ·
marketplace · ownership · paid hosting · accounts/OAuth · real money/crypto/blockchain/token/NFT ·
staking/yield/resale/cash-out/gambling/wagering/prize value/payout/transferable goods ·
changes to arcade tickets/prizes/Host Rank/Stewardship/Block Trial/live authority · deploy ·
production Worker/DO mutation · HiveWorld · unrelated game/* · telemetry/analytics.
```

## Validation

```
node --test tests/creator/*.test.mjs
node --test tests/arcade/*.test.mjs
node tests/arcade/check-production-config.mjs
node scripts/check-city-build-size.mjs
bash tests/creator/run-block-editor.sh
node scripts/build-curated-client-upload.mjs --out /tmp/cf2-upload-check
```

Worker dry-run remains byte-identical (`cd workers/arcade && wrangler deploy --dry-run --outdir dist`).

## Next Creator Foundation phase

```
CF-3  layered block customization editor — IMPLEMENTED (data-only `block_layered` kind, 6 layer
      dimensions, no live load). See docs/CREATOR_FOUNDATION_CF3_LAYERED_EDITOR.md.
CF-4  tiled isometric map viewer / multi-block compositions (local tile source; future R2 documented,
      not built) — OR arcade game package importer + local sandbox runner (separately gated).
CF-E  LIVE approved-hash loader — flips LIVE_WORLD_LOADER_ENABLED only behind a human-cleared,
      separately-authorized review path; requires live_world_authorized semantics that CF-2 forbids.
```

Each later phase keeps the same boundary: local first → packaged → hash-addressed → validated →
explicitly approved → loaded only from an approved registry. The live world stays closed until a
phase deliberately, and reviewably, opens it.
