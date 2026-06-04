# Neon Circuit — Phase 4B: City Authority, Reconciliation, Minimap & Portal Polish

**Status:** implemented, local-only (branch `feat/neon-circuit-phase4b-city-authority-polish`,
off Phase 4A `d4cd462`).
**Goal:** make the Phase 4A city block *feel and validate* like a serious multiplayer
foundation — without growing the map or adding gameplay systems. Core rule unchanged:
**players send intent, the server owns truth.**

Builds on [NEON_CIRCUIT_PHASE4_GTA80_CITY_BLOCK.md](NEON_CIRCUIT_PHASE4_GTA80_CITY_BLOCK.md).

---

## 1. What changed from Phase 4A

| Area | Phase 4A | Phase 4B |
|---|---|---|
| Local reconciliation | continuous-rAF predict + ease/snap toward server | **input-replay**: replay unacked inputs from the authoritative position |
| Remote players | single-target ease | **buffered snapshot interpolation** at a render delay |
| Authority dt | server-clock `now - lastInputAt` | **client-supplied dt, clamped to real elapsed** (deterministic replay, still anti-cheat) |
| Acknowledgement | implicit | per-player `seq` is the explicit **ack_seq**; `schema_version` added |
| Readability | renderer only | **minimap/radar v1** |
| Portal | enter/ok | **deliberate, server-confirmed entry** (overlay + rejected feedback) |
| Debugging | none | **debug overlay** (`?debug=1` / backtick) |

The whole change set is additive and backward-compatible. The DO + dev shim transports are
**unchanged** — the dt and `schema_version` flow through the shared pure core.

## 2. Authority model

Clients send **input intent only** (`city_input { seq, client_time, dx, dy, dt }`). The server
computes every accepted position itself in the shared pure core (`arcade/city/city-block.mjs`):

- **dt** = `clamp(min(clientDt, serverElapsed), 0, MAX_DT_MS)` — the client's dt makes replay
  deterministic, but a forged large dt can never exceed *real elapsed server time*, so it
  cannot speed-hack. No dt (4A clients/tests) → server clock (byte-identical 4A behavior).
- intent is unit-clamped; displacement is `MAX_SPEED * dt`; collision is server-resolved (AABB);
  portal entry requires the **canonical** position to be inside the zone.

`predictStep(pos, rawInput, dtMs)` is the single movement step shared by the server's `applyInput`
and the client's prediction/replay — so the client reproduces the server's path exactly.

## 3. Input-replay reconciliation (`arcade/city/city-reconcile.mjs`, pure)

- The client records every input it sends in a pending buffer keyed by `seq`
  (`recordPendingInput`, bounded by `MAX_INPUT_BACKLOG` → overflow clears + resyncs).
- The server snapshot's self entry carries `seq` = last processed input (the **ack**).
- On each snapshot the client `dropAcknowledgedInputs(ackSeq)`, then each frame computes
  `predicted = replayPendingInputs(serverSelf, pending)` and eases the **displayed** position
  toward it; a divergence beyond `SNAP_DIST` snaps (the server always wins).
- Replay is **visual only** — it never creates canonical truth (the origin is always `serverSelf`).

## 4. Snapshot buffering / remote interpolation (`arcade/city/city-snapshots.mjs`, pure)

- Remote players are rendered only from canonical snapshots, buffered by `serverTime`
  (`pushSnapshot`, dedup + out-of-order safe, pruned by `maxAgeMs`).
- Each frame the client samples `sampleSnapshotAt(estServerNow - RENDER_DELAY_MS)` and
  interpolates between the bracketing snapshots (`interpolatePlayerState`: lerp position,
  shortest-arc facing). Missing data → hold last; a player absent from a snapshot is dropped;
  one only in the newer snapshot appears. No private fields are ever stored.

## 5. Minimap / radar v1 (`arcade/city/city-minimap.js`)

Procedural Canvas-2D overlay (no assets): block outline, simplified roads + building massing,
the arcade portal, remote players, and the local player with a facing tick. Top-right, sized
down on small screens so it never overlaps the bottom-right touch joystick.

## 6. Portal polish

The portal zone glows; a prompt appears when the avatar's canonical position is inside it. The
client may *request* entry but cannot force it — the **server** validates the zone. On a
server-confirmed `city_portal_ok` the client shows a deliberate "ENTERING ARCADE INTERIOR"
overlay, then navigates to the existing arcade floor (`/arcade/`); a denied request flashes a
rejected state. Copy frames the arcade as an *interior*, not teleport magic.

## 7. Mobile / control polish

Touch joystick stabilized (guarded pointer-capture); minimap kept clear of the joystick;
status + debug readable on small screens; portal prompt + button reachable by touch;
`prefers-reduced-motion` disables the blinking status dot.

## 8. Size-budget result (GTA-80)

`node scripts/check-city-build-size.mjs` → **~0.65 MB uncompressed / ~0.17 MB gzipped** (the
three small new procedural modules add a few KB; the bulk remains the shared vendored Three.js).
Far within GTA-80 (≤80 MB) and the GTA-34 (≤34 MB gzip) stretch. No new dependencies, no assets.

## 9. Validation commands

```bash
node --test tests/arcade/*.test.mjs            # pure reconcile/snapshot/authority + all existing
node tests/arcade/check-production-config.mjs   # unchanged gate
node scripts/check-city-build-size.mjs          # GTA-80 advisory meter
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-authority.sh   # NEW 4B smoke
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-block.sh       # 4A smoke (regression)
bash tests/arcade/run-two-client.sh ; bash tests/arcade/run-frame-contract.sh # arcade regression
cd workers/arcade && npx wrangler deploy --dry-run --outdir dist              # Node 22; no deploy
```

## 10. Known limitations

- Replay matches the server only in the honest case (`clientDt ≈ serverElapsed`); under clock
  skew / dropped inputs a small residual is smoothed (or snapped past `SNAP_DIST`).
- Snapshots still broadcast on accepted input (bounded by the input rate), not a fixed
  coalescing tick; a fixed server tick is a later option.
- Headless WebGL is flaky, so browser smokes force the 2D renderer; Three.js is exercised in
  real browsers.
- Portal navigation is a full-page transition to `/arcade/`; an in-place arcade-interior
  transition is deferred.

## 11. Deferred / next phases

- **4C** — append-only world event log; in-place portal transition.
- **4D** — Hive Scheduler (city pressure / events).
- **4E** — Host Rank (non-cash node-support reputation).
- **4F** — Block Stewardship + constrained editor.
- **4G** — instanced (non-destructive) block battles.
- HiveWorld mirror remains deferred (docs-only TODO; no `hiveworld-sim` code touched).

## 12. Non-goals (4B)

No map expansion, missions, police, combat, weapons, vehicles, NPCs/AI, accounts,
economy/inventory, crypto/cash-out/gambling/marketplace/paid-hosting, Block Stewardship/Host
Rank/block-battles, HiveWorld mirror, deploy, credentials, or push. No change to arcade ticket
formulas, prize costs, challenge rewards, or event schedules.
