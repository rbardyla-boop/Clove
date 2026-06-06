# Sample Tiny Cabinet (CF-1 template)

Original, procedural "tap the pulse" mini-cabinet. No assets, no capabilities, server stays the
authority. Copy this folder to start a new cabinet; keep total bytes under `size_budget_bytes`.

- `manifest.json` — package descriptor (validated by the creator validator)
- `game.mjs` — the game (frame/input/result contract methods; proposes results only)
- `adapter.mjs` — the only bridge to the host frame; requests no capabilities

Not wired into the live runtime in CF-1.
