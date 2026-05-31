# Neon Circuit — Room Authority Layer (Phase 1b+)

This directory contains the **client-side** pieces for the Neon Circuit Room Authority Mesh.

## Current Phase
**Phase 1b** — Only Pulse Tap occupancy in the "main" room is authoritative.

## Key Files
- `neon-circuit-room-client.js` — Thin client that speaks JSON to the Durable Object authority.
- `pulse-occupancy-test.html` — Minimal two-client validation harness (the proof that two browsers can agree on one shared fact).

## Running Locally
See `workers/arcade/LOCAL_DEV.md` for the full instructions.

The authority itself lives in `workers/arcade/` (separate Worker + Durable Object project).

## Non-Goals (Phase 1b)
No blockchain, no browser mesh, no tickets, no gameplay, no economy, no multiple rooms.

## Deployment
- Static files (this directory + the test harness) are served by the existing Cloudflare Pages project.
- The live authority is a separate Worker that handles only `/arcade/ws`.

See the approved Phase 1b plan for the full rationale.
