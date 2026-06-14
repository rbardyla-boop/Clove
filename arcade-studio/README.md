# Arcade Studio

A browser-based **Three.js + Vite** creator studio for designing arcade buildings and producing
**game-ready, validated, data-only** arcade assets: cabinets, signage, lighting, props, zones,
particles, and screen-shake presets. It is the foundation for a real creator pipeline — the output is
exportable, schema-validated, reusable JSON, not a one-off visual demo.

It is **local-only and data-only by design**: no network, no upload, no remote submission, no
live-world loading, and no economy / ownership / reward / prize / ticket / marketplace / crypto / NFT
mechanics. Every authorable option is a **closed token** or bounded-clean text — there is no
free-form runtime surface.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build    # production bundle → dist/
npm run preview  # serve the built bundle (port 4173)
npm test         # Node test suite (pure validation/import-export/presets — no browser)
```

Headless browser smoke (uses cached Playwright chromium; run from the repo root):

```bash
npm run build && npm run preview &        # in one shell
node scripts/smoke-headless.mjs http://localhost:4173
# or: bash scripts/run-smoke.sh
```

## Using the editor

- **Asset Library (left):** click a cabinet preset / prop / sign / entrance, then click a grid cell to
  place it. Zones and walls are added with a default footprint and edited in the inspector.
- **Inspector (right):** with something selected, every property is a closed dropdown (cabinet shape,
  screen, marquee, control panel, trim, bevel, palette, glow, scanline, decal, attract mode, …) plus
  placement (rotation / layer). With nothing selected it shows layout settings (theme, floor, grid,
  lighting, effects, metadata) and lists of zones/walls.
- **Toolbar (top):** camera mode (orbit ↔ player), grid snap, undo/redo, screen-shake test, particle
  preset, reduced-motion override, layer visibility, new hall.
- **Export panel (right-lower):** export the layout or the selected cabinet to validated canonical
  JSON with a `sha256:` hash, download it, run a round-trip self-test, or import JSON back (rejected
  if it fails validation).
- **Debug panel (bottom-left):** FPS, draw calls, triangles, visible objects, active lights, particle
  count, selected object, exported object count, camera mode, and live validation status.
- **Keyboard:** `P` toggle camera · arrows move selection · `R` rotate · `[`/`]` layer · `Del` delete ·
  `G` grid · `Ctrl/Cmd+Z` undo · `Ctrl/Cmd+Shift+Z` redo · `Esc` cancel placement. In player mode:
  `WASD`/arrows move, drag to look, `Shift` sprint.

## Architecture

```
src/
  main.js                  bootstrap: renderer + scene + camera + building + loop + Studio
  core/                    renderer, scene, camera (orbit+player rig), lights, input, loop
  validation/              tokens (closed vocab), safety, schemas, validators, forbidden-surface
  importExport/            canonical hash, export/import for cabinet + layout
  cabinets/                Cabinet, geometry, materials, presets, config (normalize), preview
  arcade/                  ArcadeBuilding, layout model, themes, floor, wall, props, zones, lighting, grid
  effects/                 screen-shake (presets + applier), particles (presets + system), reduced-motion
  editor/                  EditorState, undo/redo, selection, placement, transform, grid-snap, panels, Studio
  preview/                 player-scale capsule + camera controller
  debug/                   DebugPanel, PerformanceStats
  utils/                   math, seeded random, ids, colors
test/                      Node tests (validation/round-trip/hostile/determinism/presets/tokens/grid)
scripts/                   headless smoke
```

The **pure data spine** (`validation/`, `importExport/`, `effects/*Presets`, `cabinets/CabinetConfig`,
`cabinets/CabinetPresets`, `arcade/ArcadeLayout`, `arcade/ArcadeThemes`, `utils/`) imports **no
Three.js** and is fully testable in Node. The render/editor layer consumes it.

## Security model (deny-by-default)

- Two closed schemas: `arcade_cabinet_asset`, `arcade_building_layout`. Validators reject unknown keys,
  out-of-vocabulary tokens, out-of-bounds numbers, non-plain JSON, and any string containing
  code/markup/URL/template content or economy/ownership terms.
- A forbidden-surface scan fails an asset closed if **any** capability/economy/network key name appears
  anywhere (`live_world_authorized`, `ticket_hooks`, `prize_hooks`, `ledger_hooks`, `upload_enabled`,
  `remote_submit`, `arbitrary_script`, `external_asset_url`, `url`, `submit`, `crypto`, `nft`, …).
- Every export must assert `constraints: { no_external_assets, no_scripts, no_live_world_load,
  local_only }` all `true`.
- Exports are deterministic (canonical sorted-key JSON) and content-addressed (`sha256:`).

Hostile inputs (functions, prototype pollution, script strings, capability flags, deep nesting,
garbage JSON) are proven to fail closed by `test/hostile.test.mjs` and `test/forbidden-surface.test.mjs`.
