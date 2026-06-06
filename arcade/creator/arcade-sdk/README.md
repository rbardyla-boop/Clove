# Arcade Game SDK (Creator Foundation CF-1 — skeleton)

A cabinet package is a tiny, sandboxed game described by a `manifest.json` and built from a
`game.mjs` + `adapter.mjs`. CF-1 defines the **package shape, the size gate, and the contracts**;
it does **not** load packages into the live world.

## Contracts (doc-level in CF-1)

- **Frame contract** — the game renders into a host-provided 2D context sized to `frame_contract_id`
  (e.g. `cabinet-360x640`). It never resizes itself (the manifest pins the box).
- **Input contract** — the host forwards normalized input (pointer/keyboard/touch) through the adapter.
- **Result contract** — the game *proposes* a round result; the **server is authoritative** for ticket
  results, score acceptance, and anti-cheat. The game asserts no tickets/score/economy.
- **Capability manifest** — deny-by-default. CF-1 allows **no** capabilities; the package's
  `capabilities: []`. Never network, storage, payments, auth, transfer, or DOM escape.

## Size budget = the creative constraint

`size_budget_bytes` is declared per package (≤ 64 KiB ceiling in CF-1). A small cabinet forces
optimization and procedural art, not bloat. Check it:

```
node arcade/creator/arcade-sdk/size-budget.mjs arcade/creator/arcade-sdk/package-template --strict
```

## Validate the manifest

```
node arcade/creator/validator/validate-package.mjs arcade/creator/arcade-sdk/package-template/manifest.json
```

## Template

`package-template/` is an original, procedural "tap the pulse" cabinet with no assets. Copy it,
keep it under budget, request no capabilities. It is a reference, not a live cabinet.
