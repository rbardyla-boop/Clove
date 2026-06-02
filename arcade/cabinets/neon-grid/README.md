# Neon Grid — adapter-loaded production cabinet (Phase 1l)

Neon Grid is the **first production Neon Circuit cabinet that enters the floor
through the Phase 1j/1k cabinet-adapter + dynamic-import path** instead of being
hand-wired into `neon-circuit-floor.js`.

```
manifest.mjs        import manifest (identity, native size, modes, allowed paths,
                    forbidden capabilities) — validated BEFORE any import
adapter.mjs         { adapter, contract, createGame } the import loader consumes;
                    references the built-in `neon_grid` frame contract
neon-grid-game.mjs  the playable pattern-path game (exposes getRoot() so the
                    runtime mounts it inside a cabinet frame)
neon-grid.css       self-loaded stylesheet (authored at the native 360x640 box)
```

Activation chain (every step fails closed):

```
server catalog activation (neon-grid-01 = live + ticket_enabled)
  → loadImportedAdapter (manifest + adapter validation)
  → cabinet_type match
  → enableImportedAdapter (controlled registry)
  → resolveAdapterForCabinet (catalog → registry resolution)
  → mountImportedGame (frame contract preservation + lifecycle)
```

The cabinet can **never** make itself playable: the client adapter is registered
disabled and is only enabled after the server catalog activates it.

Scope + non-goals: `docs/NEON_CIRCUIT_PHASE1L_NEON_GRID.md`. Internal arcade
points only — no money, no crypto, no transferable goods.
