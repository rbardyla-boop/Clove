# Sample Import Game — TEST ONLY / DISABLED

This directory is a **non-product fixture** for the Phase 1j Cabinet Adapter SDK.
It demonstrates the safe import path for a cloned/imported arcade game:

```
manifest.mjs   → import manifest (validated by game-import-manifest.mjs)
adapter.mjs    → cabinet adapter (validated by cabinet-adapter-sdk.mjs)
sample-game.mjs → minimal entry_file conforming to the cabinet game interface
```

It is intentionally:

- **not in the server catalog** (`workers/arcade/src/catalog.mjs`) — so it is never active;
- **not registered** in the production adapter registry (`adapter.mjs` never calls
  `registerAdapter`) — so it can never become playable;
- **not rendered** on the arcade floor;
- a **distinct native size (320×480)** from the production cabinets (360×640), to
  prove the frame/clone size contract is per-game.

Tests under `tests/arcade/cabinet-adapter.test.mjs` use it to prove manifest +
adapter validation, the clone guard (resize without a migration flag fails), and
forbidden-capability rejection. Do not enable it in production without a
deliberately scoped sprint.
