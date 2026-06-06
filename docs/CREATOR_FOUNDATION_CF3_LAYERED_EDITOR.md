# Creator Foundation CF-3 — Layered Block Customization Editor

**Status:** implemented, **local/operator-only, data-only, hash-addressed, validator-first.**
**Not:** public upload · open UGC · live-world load · marketplace · ownership · paid hosting · accounts.

CF-3 is the depth layer after CF-1 (authoring + validation) and CF-2 (the approved-hash boundary). It
adds a richer, **layered** block customization model — the first real step toward APB-level
customization depth — while staying inside the exact rails CF-1/CF-2 established: closed-allowlist
tokens, deny-by-default validation, bounded sizes, original procedural visuals, and **no** path to the
live world. It is a NEW package kind; the flat `block_style` (CF-1) contract is byte-frozen.

## North star vs. scope

APB-level customization *depth* is the north star — many distinct, alive-feeling blocks. CF-3 reaches
toward it with 6 composable layer dimensions and a ~65-token expansion, but every value is still a
closed token, every count is bounded, and nothing renders anywhere but a local/offline preview. Depth
was added only because the trust boundary (CF-2) was built first.

## A. The `block_layered` package (data-only)

`arcade/creator/schemas/block-layered-package-schema.mjs` — a NEW `package_kind: "block_layered"`
(own `schema_version: 1`). `layers` is a fixed-key object (not a free array), so every sub-schema is
statically known and exhaustively validatable:

```js
{
  schema_version: 1, package_kind: "block_layered",
  package_id: "downtown-neon-facade-01",        // kebab 3..48, economy-term-clean
  display_name: "Neon Downtown Facade",          // optional, ≤40 bytes
  target_city_id: "downtown-01",                 // ∈ TARGET_CITY_IDS
  palette_variant: "neon-arcade-v1",             // optional single recolor theme ∈ PALETTE_VARIANTS
  layers: {
    facade:  { pattern, primary_color, secondary_color, trim },     // REQUIRED
    windows: { grid_type, density, glow_color },                    // REQUIRED
    roof:    { accent_type, highlight, pattern },                   // REQUIRED
    lighting_zones: [ { zone_id, glow, flicker }, … ],              // REQUIRED, 1..4, unique zone_id
    sign:    { variant, color, placement },                        // optional
    symbols: [ { token, position, color, scale }, … ],             // optional, 0..6; scale is a STRING enum
  },
  constraints: { no_external_assets: true, no_scripts: true, no_live_world_load: true }
}
```

Every field draws from a closed token group in `creator-tokens.mjs`. **`scale` is a string enum**
(`"0.5".."1.5"`), not a free number — closing the arbitrary-value surface a numeric scale/opacity/offset
would open. Bounds: **12 KiB** size budget (a legal maximal package measures ~1–3 KiB), **≤6 symbols**,
**1–4 lighting zones** (unique). The 3rd constraint flag `no_live_world_load:true` is self-describing.

## B. Token taxonomy (closed, original, IP-safe)

`creator-tokens.mjs` gains ~65 new tokens (all **additive**; the existing `block_style` exports are
untouched): `FACADE_PATTERNS_LAYERED` (13 = 8 CF-1 + 5 new), `SIGN_PLACEMENTS` (5), `DECAL_TOKENS`
(16 procedural marks), `DECAL_POSITIONS` (9), `DECAL_SCALES` (5 strings), `WINDOW_GRID_TYPES` (7),
`WINDOW_DENSITIES` (4 → `WINDOW_DENSITY_GRID`), `ROOF_ACCENTS` (6), `ROOF_PATTERNS` (4),
`LIGHTING_ZONE_IDS` (4), `PALETTE_VARIANTS` (5 → `PALETTE_VARIANT_TRANSFORM`). Colors reuse the CF-1
`PALETTES`/`ACCENTS` hex. No free-form colors, numbers, images, or URLs — only closed-token lookup.

## C. Validation (deny-by-default, reuses CF-1 primitives)

`validator/validate-block-layered-package.mjs` → `{ ok, package_kind:'block_layered', errors[],
warnings[], limits }` — the same accumulate-then-done shape as the CF-1 block_style validator, reusing
`isPlainData`, `utf8Bytes`, `scanSafety`, `FORBIDDEN_TERMS_RE`, `FORBIDDEN_CONTENT_RE` verbatim. 18
ordered rules: plain-data gate → size → deep safety scan → strict top keys → kind/version → id/name →
target → palette_variant → per-layer strict key-set + token checks → zone count/uniqueness/boolean →
constraints. Unknown keys are rejected (never silent-dropped); arrays/depth are bounded.

The validator is covered by a **26-row adversarial abuse checklist** (`tests/creator/block-layered-validator.test.mjs`):
code/template/URL smuggling, economy/NFT vocab, private/identity keys, symbol/zone DoS, prototype
pollution, unknown/missing/spoofed fields, numeric-scale injection, non-boolean flicker, oversize
payloads, constraint downgrade, and a positive control — each → its expected rejection.

## D. Layered renderer (procedural, original)

`render/layered-renderer.mjs` draws a `block_layered` package on the SAME iso geometry as CF-1's
`drawBlock`, composing layers back-to-front (tile → box → facade → windows → decals → roof+sign →
per-zone lighting). It reuses the iso primitives (`worldToScreen`/`tileDiamond`/`poly`/`shade`/`faceQuad`
— the last three newly *exported*, with `drawBlock` left byte-identical). An optional `palette_variant`
recolors every resolved hex through a deterministic, clamped HSV transform (`applyPaletteVariant`,
unit-tested for gamut/NaN). All shapes, no images; single frame, no timers; `flicker` is a static hint.

## E. Layered editor (local, no-submit)

`arcade/creator/layered-editor/` — an offline, no-submit static page. It composes a `block_layered`
package from closed-allowlist controls across all 6 layer dimensions (data-driven symbol + zone rows),
previews it with the layered renderer, validates locally with the same validator the CLI uses, shows
the canonical hash + `local_validation_only` receipt, and exports the package + report. It also offers
the CF-2 **approved local preview** (import package + receipt → run the loader in `local_preview` →
offline render + "Local preview only — not authorized for live world"). No submit / upload / live-world
control; restrictive CSP; reuses the CF-1 editor stylesheet.

## F. Boundary + isolation (unchanged invariants)

- `block_layered` registers in `approval-receipt.PACKAGE_KINDS`, the loader's `validateByKind`, and the
  validator CLI — so it flows through the **CF-2 approved-hash loader** exactly like `block_style`:
  `local_preview` loads an approved-local package; **`live_world` is still always rejected**
  (`LIVE_WORLD_LOADER_ENABLED=false`); `live_world_authorized:true` is rejected by receipt + registry.
- All CF-3 files live under `arcade/creator/**`, which `scripts/build-curated-client-upload.mjs` excludes
  from the production static upload. The Worker/DO, economy, tickets, Host Rank, Stewardship, Block Trial,
  and live authority are untouched.

## Validation

```
node --test tests/creator/*.test.mjs                # 101 unit (CF-1 26 + CF-2 38 + CF-3 37)
node arcade/creator/validator/validate-package.mjs arcade/creator/samples/sample-layered.package.json
bash tests/creator/run-layered-editor.sh            # 20-check browser smoke
bash tests/creator/run-block-editor.sh              # CF-1/CF-2 editor unaffected (18 checks)
```

## Next Creator Foundation phase

```
CF-4  tiled isometric map viewer / multi-block compositions (local tile source; future R2 documented,
      not built) — OR arcade game package importer + local sandbox runner (separately gated).
CF-E  LIVE approved-hash loader — flips LIVE_WORLD_LOADER_ENABLED only behind a human-cleared,
      separately-authorized abuse review; requires live_world_authorized semantics CF-2/CF-3 forbid.
```

The boundary is unchanged: local first → packaged → hash-addressed → validated → explicitly approved →
loaded only from an approved registry. Richer packages (CF-3) now exist; the live world stays closed
until a phase deliberately, and reviewably, opens it.
