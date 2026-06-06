# Creator Foundation CF-1 — Local Block Editor + Package Schema + Hive Validation + Arcade Size Gate

**Status:** implemented, **local/operator-only, no live-world loading, no deploy.**
**Not:** public UGC · marketplace · ownership · paid hosting · accounts.

CF-1 lays the *safety foundation* before Phase 7 so block customization, arcade games, and custom
assets never become a bolted-on latency / security / moderation / file-bloat problem. It is a
controlled creator pipeline, not a feature launch.

## Why creator tooling must be foundational

If player-created blocks/games/assets are added after gameplay expansion, they arrive as live
mutations with no validation, no size discipline, and no isolation. CF-1 inverts that: authoring is
local, output is an immutable validated package, and only approved hashes may *later* reach the live
world through a separately-gated loader.

## Core doctrine

```
Nothing player-authored enters the live world directly.
Everything is created locally / in an isolated editor first.
Everything becomes a package.
Every package is validated.
Only approved, immutable, hash-addressed packages may be allowed into the live world later.
```

CF-1 stops at local validation. It does **not** load any package into production.

## Visual direction (original, not copied)

2D isometric / top-down, low-file-size **procedural** neon-arcade style with old top-down/isometric
*readability*. All shapes, palettes, facades, signs, tiles, and lighting are original closed tokens
(`arcade/creator/schemas/creator-tokens.mjs`). **No** GTA / SimCity / RollerCoaster Tycoon assets,
no copyrighted sprites, no franchise names in tokens or copy, no external image/audio.

The token space is deliberately rich (8 palettes × 8 facades × 5 signs × 5 lighting × 7 accents ×
5 tile accents) so authored blocks feel **alive and distinct** — never a template world — while
staying a closed, validatable set.

## Block editor model

`arcade/creator/block-editor/` — an offline, no-submit static page. It composes a data-only
`block_style` package from dropdowns (closed allowlists), previews it with the procedural isometric
renderer (`arcade/creator/render/iso-renderer.mjs`), validates it locally with the same validator
the CLI uses, and exports the package + a local validation report. No network, no external assets,
no live submit.

## Arcade game package model

`arcade/creator/arcade-sdk/` — a cabinet package is a `manifest.json` + `game.mjs` + `adapter.mjs`
that run inside the existing sandboxed cabinet frame. Contracts (doc-level in CF-1): frame, input,
result (**server-authoritative** — the game only *proposes* results), and a deny-by-default
capability manifest. A strict `size_budget_bytes` (≤ 64 KiB ceiling) is the creative constraint.

## Package validation model

`arcade/creator/validator/` — pure, cross-env (Node + browser):

- `validate-block-package.mjs` / `validate-arcade-package.mjs` → `{ ok, package_kind, errors[], warnings[], limits }`
- `package-hash.mjs` → canonical JSON + SHA-256 (`packageHash` → `sha256:…`)
- `validation-report.mjs` → the report shape + a receipt **stub**:

```js
{
  ok: true,
  package_hash: "sha256:…",
  package_kind: "block_style",
  errors: [], warnings: [],
  limits: { size_bytes: 361, size_budget_bytes: 8192 },
  receipt: { status: "local_validation_only", live_world_authorized: false }
}
```

The receipt **never** claims live-world approval. Validation is strict / deny-by-default: unknown
keys are rejected (not dropped), only allowlisted tokens pass, numbers are bounded, and a deep scan
rejects code/markup/URL/template strings and private/identity keys anywhere.

## Size-budget doctrine

`scripts/check-city-build-size.mjs` (city client) + `arcade/creator/arcade-sdk/size-budget.mjs`
(per-cabinet) keep budgets visible and enforceable. Small is the point — optimization and
procedural art over bloat. The block package itself is ≤ 8 KiB; cabinets ≤ 64 KiB.

## IP-safety doctrine

Original procedural visuals only; closed token vocab; no external asset URLs; no franchise asset
copies; labels/ids scanned for economy/ownership terms and franchise-naming avoided.

## Security model

- Block packages are **data-only** — no JS, no functions, no URLs, no external assets.
- Arcade packages declare capabilities **deny-by-default** (CF-1 allowlist is empty), no network/
  storage/payments/auth/transfer/DOM-escape; games run sandboxed and assert no authority.
- No `eval` / `new Function` / dynamic remote import; deep content scan blocks them in data.
- No secrets, no telemetry, no live-world writes, no upload path.

## Explicit non-goals

public upload · live-world loading of user packages · marketplace · ownership · paid hosting ·
accounts/OAuth · real money/crypto/blockchain/token/NFT · staking/yield/resale/cash-out/gambling/
wagering/prize-value/payout/transferable goods · user-uploaded images/audio/code in the live world ·
remote execution · third-party telemetry · external asset URLs · production/staging deploy ·
dashboard mutation · Java production framework (reference-only) · Phase 7.

## Validation commands

```
node --test tests/creator/*.test.mjs
node arcade/creator/validator/validate-package.mjs arcade/creator/samples/sample-block.package.json
node arcade/creator/validator/validate-package.mjs arcade/creator/arcade-sdk/package-template/manifest.json
node arcade/creator/arcade-sdk/size-budget.mjs arcade/creator/arcade-sdk/package-template --strict
bash tests/creator/run-block-editor.sh
```

## Deploy / bundle note

`arcade/creator/**` is operator tooling. It must be **excluded from the curated live-client upload**
to `wild-hat-6257` (alongside `tests/`, `docs/`, `workers/`, `tools/`) until a gated loader phase
deliberately exposes any of it. CF-1 uploads nothing and changes no Worker/DO/route.

## Next phases

```
CF-2  binary asset parser harness — ONLY if legal, test-owned fixtures exist (ask first)
CF-3  tiled isometric map viewer (local tile source; future R2 documented, not built)
CF-4  arcade game package importer + live sandbox runner (separately gated)
CF-E  approved-hash loader: live world trusts a package only via a human-cleared approved receipt
```

A **Java** 2D/isometric framework is treated as an **architecture reference only**; the production
stack stays TypeScript + Canvas + package validation + Cloudflare Worker/DO. No Java build tooling
is added in CF-1.
