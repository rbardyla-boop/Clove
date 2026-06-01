# HiveWorld v0.4 — Smart Lobby Presence UX Mirror

Status: **IMPLEMENTED** on `feat/hiveworld-v0-4-presence-ux` (from v0.3
`feat/hiveworld-v0-3-room-health` @ `0add2af`). Mirrors product Phase 2d
(`feat/neon-circuit-phase2d-presence-ux` @ `9ed77df`,
`docs/NEON_CIRCUIT_PHASE2D_PRESENCE_UX.md`) into the simulator, per the parity rule
(product step → simulator mirror → next product step).

The simulator is a **mirror, not a bridge** — it never imports or talks to the
product Worker/DO, and the product never imports the simulator.

## What it mirrors

Product Phase 2d added pure, client-side smart-lobby helpers that derive behaviour
from the (already-public) Phase 2c room-presence list. v0.4 ports them verbatim into
the simulator as `arcade/hiveworld-sim/core/phase1/room-recommend.mjs`:

- `isJoinable` — open status only.
- `roomActivity` — public-safe liveliness label (busy / lively / active / empty /
  stale / offline / unknown / closed / maintenance) from health + population/capacity.
- `recommendRooms` — busiest healthy+open+not-full room (excludes current), the
  training-profile room, and a healthy-but-empty room to revive. Deterministic
  tiebreaks by `room_id`.
- `sortRoomsForLobby` — active healthy → empty → stale/unknown → offline →
  closed/maintenance; population desc within rank.
- `roomRecoveryHint` — actionable hint for joinable degraded/empty rooms.

These read the v0.3 presence entries (`roomPresenceListPayload` in
`core/phase1/rooms.mjs`). The sim entry carries `last_seen_age_ticks` where the
product has `_ms`, but the recommendation helpers never read that field, so the
behaviour matches the product byte-for-byte.

## Why this is faithful + safe

Recommendations are **pure functions of public room health/population/profile** — no
fold authority, no private state (no actor ids, balances, ledger, inventory,
occupied-cabinet counts, or tokens). The same presence list yields the same
recommendations on every node, so nothing needs to be folded or coordinated. The
fold (`roomRegistry`) is unchanged from v0.3.

## Scenario

`scenarios/phase1.mjs` adds `roomRecommendationShowcase`: three healthy rooms report
heartbeats with distinct populations (main-floor 5, neon-training 1, late-night 0).
The recommendation helpers are then proven against the **canonical fold's** presence
list (deterministic + convergent), not hand-fed data.

## Tests

`tests/hiveworld/phase2-room-recommend.test.mjs` (10): pure activity/recommendation/
sort/recovery behaviour, exclude-current / full / closed handling, determinism, a
privacy proof (`PRIVATE_FIELD_RE` + no `agent:`/token/occupied/connection leakage),
and a scenario-derived test that recommendations come purely from the folded presence
list. Full sim suite **142 green** (132 prior + 10); UI smoke PASS.

## Non-goals

no product Worker/DO touch · no dynamic room creation · no accounts/identity · no
cross-room inventory/economy · no real money/crypto/blockchain/token/NFT ·
no cash-out/staking/yield/resale · no gambling/wagering · no HiveWorld→product bridge ·
no AR/geospatial · no land ownership · **did not start Phase 2e.**

## Next

Parity gap closed through Phase 2d. The next product sprint (operator's call) is
Phase 2e — recommended: **Room Events / Scheduled Cabinet Rotations** (builds on lobby
presence without introducing identity/account complexity), with a v0.5 sim mirror to
follow.
