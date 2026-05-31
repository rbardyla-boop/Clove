# Phase 1b Implementation — Completed Artifacts

**Status:** Code-complete per reviewed + amended plan + scoped B-only validation improvements.  
**Classification:** IMPLEMENTED / UNVALIDATED  
**Validation:** Must be performed by the developer on a machine with Node.js ≥ 20 using the exact ?id=alpha / ?id=bravo URLs.

## What Was Built

**Scoped validation-quality improvements (B only, per user instruction):**
- `arcade/pulse-occupancy-test.html`: Prominent identity banner, `?id=` override support, collision warning, rich structured logging + copy button.
- `arcade/neon-circuit-room-client.js`: Added `playerIdOverride` + provenance helpers. No behavior change for normal use.

These changes exist **only** to make the 8-point two-client authority proof trustworthy. They do not affect the Durable Object or protocol.

### Authority Layer (`workers/arcade/`)
- `wrangler.toml` — includes `[[migrations]]` with `new_sqlite_classes = ["ArcadeRoom"]`
- `src/arcade-room.ts` — Durable Object using:
  - `ctx.acceptWebSocket()` + hibernation handlers (`webSocketMessage`, `webSocketClose`, `webSocketError`)
  - `ctx.storage` persistence for only the current `MachineState` ("pulse")
  - Alarm used **exclusively** for stale lock cleanup (never closes healthy sockets)
- `src/index.ts` — Minimal Worker that routes `/arcade/ws` to the DO
- `package.json` + `LOCAL_DEV.md`

### Client Layer (`arcade/`)
- `neon-circuit-room-client.js` (explicitly **not** named "mesh")
- `pulse-occupancy-test.html` — self-contained two-client validation harness
- `README.md`

### Platform Changes
- `_headers` — added WebSocket origins to `connect-src` (localhost + production patterns)
- `.gitignore` — wrangler local state + DO SQLite files

## How to Validate (Mandatory Before Commit)

On a machine with Node 20+:

```bash
# Terminal 1
cd workers/arcade
npx wrangler dev --local

# Terminal 2 (from repo root)
npx serve -p 5173 .

# Then open in two tabs:
# http://localhost:5173/arcade/pulse-occupancy-test.html?ws=ws://localhost:8787/arcade/ws
```

Run the full 8-step procedure documented in `workers/arcade/LOCAL_DEV.md`.

**Only commit when both clients always agree on the authoritative state** (including disconnect + stale alarm release).

## Commit Command (exact title required)

```bash
git add \
  arcade/ \
  workers/arcade/ \
  _headers \
  .gitignore \
  docs/NEON_CIRCUIT_PHASE1B_IMPLEMENTATION.md \
  docs/NEON_CIRCUIT_PHASE1B_PLAN.md

git commit -m "feat(arcade): add room-authoritative Pulse Tap occupancy"
```

Do **not** include the unrelated changes in `game/nodehopper/` or `game/theincrediblemindmachine/`.

## Known Environment Limitation

The current shell only has Node 18. Wrangler 4+ requires Node 20. All validation and any final tweaks must be done on a capable workstation.

## Next After This Commit

- Deploy the Worker (separate from Pages)
- Configure route or subdomain for `/arcade/ws`
- Only then expand beyond the single "pulse" machine in "main".
