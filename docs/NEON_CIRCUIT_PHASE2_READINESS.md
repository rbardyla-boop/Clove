# Neon Circuit — Phase 2 Readiness & Roadmap

Phase 1 is a validated release candidate (see
`NEON_CIRCUIT_PHASE1_FINAL_REPORT.md`). This document defines what Phase 1 proves,
what it deliberately does not, the Phase 2 options, the recommended starting point,
and the safety gates that protect the product from premature money/crypto/AR/world
mechanics.

## What Phase 1 proves

- A **server-authoritative** arcade works end-to-end on a Worker + Durable Object:
  occupancy, rounds, ticket awards, ledger, inventory, equips, challenges,
  achievements, and a public event feed are all decided server-side.
- The **economy is internal points only** — bounded ticket formulas, no money, no
  cash value, no transfer off the session.
- Cross-client **privacy and authority** hold: a player cannot occupy a busy
  cabinet, submit another player's round, grant itself tickets, double-submit,
  forge/expire rounds, spend another player's tickets, or force challenge progress.
- A **cabinet platform** exists: native-size frame contract, adapter SDK, import
  manifest, and a dynamic, fail-closed import loader.
- That platform is **proven on a real cabinet**: Neon Grid entered the floor
  through the adapter/import path (catalog → registry → mount), not hand-wired.
- The whole thing is **reproducibly validated**: 214 unit tests, dev-shim and real
  Worker/DO browser flows, clean bundle, clean guardrails, zero console errors.

## What Phase 1 deliberately does not prove

- **Persistence beyond a room/session.** Balances, inventory, challenges, and the
  feed are scoped to the room/session lifetime, not to a durable player account.
- **Identity.** There is no login, no global account, no cross-device identity. The
  `playerId` is a local/session id (and a query override for test harnesses).
- **Multi-room scale.** Only the single `main` room is exercised. Room selection,
  reset, admin tooling, and state compaction are unbuilt.
- **Canvas/WebGL games.** The frame contract is proven for DOM games at a fixed
  `360×640`; DPR-correct scaling for canvas/WebGL surfaces is future work.
- **Any external value.** No money, crypto, marketplace, transfer, AR, or world
  space — by design.

## Phase 2 options

```
Track A — Product Arcade Expansion
- more adapter-loaded cabinets
- better cabinet row/floor UX
- cabinet rotation/events
- local player profile within room scope
- accessibility/mobile polish
- audio/visual polish

Track B — Server Authority Expansion
- multi-room support
- room selection
- room reset/admin tools
- state compaction/cleanup
- deterministic replay/audit logs
- stronger abuse/invalid-event handling

Track C — Phase 2 Prototype Lab
- HiveWorld remains separate
- bridge only read-only public event export first
- no economy bridge
- no inventory bridge
- no real-world AR bridge
- no crypto

Track D — Account/Identity Readiness
- optional local profile
- guest identity migration strategy
- export/import local save
- no global marketplace yet
```

## Recommended Phase 2 starting point

**Land Phase 1 first.** Before any Phase 2 implementation, execute the merge
sequence (`NEON_CIRCUIT_MERGE_SEQUENCE.md`), get the product stack onto `main`, run
the post-merge validation, and tag `phase1-arcade-rc1`. A deep unmerged stack is
the single biggest risk to Phase 2 velocity.

Then the recommended first Phase 2 sprint is:

```
Phase 2a — Multi-Room Arcade Lobby   (Track B)
```

Rationale: multi-room is the highest-leverage capability that is *also* a natural,
low-risk extension of the existing DO authority model (the room is already the unit
of authority — Phase 2a generalizes "the one `main` room" into "a room you select
and join"). It needs no identity, no money, and no new game code, and it unblocks
Tracks A/C/D later.

If the unmerged stack is judged too risky to extend, the correct first move is
instead:

```
Phase 1 Release Cleanup — Flatten, PR, merge, tag, deploy preview
```

i.e. do the closure landing before writing any Phase 2 code. **This document
recommends release cleanup before Phase 2 implementation in all cases.**

## Safety gates before HiveWorld

HiveWorld stays on its own branch (`feat/hiveworld-v0-sideband-simulator`) and out
of the product stack. Before any HiveWorld integration is even prototyped:

1. Phase 1 is merged to `main` and tagged.
2. Multi-room + room lifecycle (Track B) exists, so a HiveWorld experiment can live
   in its own room without touching the arcade.
3. A **read-only, public-safe** event export is the *only* first bridge — no
   economy, no inventory, no identity crosses the boundary.
4. A written threat model for the bridge (what data leaves, who can read it).

## When to bring back HiveWorld

Only after gates 1–4 above, and only as **Track C — Prototype Lab**: a separate
room consuming a read-only public event stream. No economy/inventory/identity
bridge. If HiveWorld ever needs player value, that requires its own scope/security
review — it does not inherit arcade tickets.

## When to add AR/geospatial experiments

Not in Phase 2 product. AR/geospatial is a research track only, isolated from the
arcade and the economy. Gate it behind: multi-room authority, a documented privacy
model for location data, and an explicit decision that it carries **no** land
ownership, leasing, or transferable value. Until then it is a non-goal.

## When to add creator / self-hosted rooms

After multi-room (Track B) and the adapter import path are hardened further. The
adapter SDK + import loader are the foundation, but creator rooms add a much larger
trust surface (untrusted imported code at scale). Gate behind: a stricter import
sandbox/threat model, per-room resource limits, and abuse handling — and still
**no** money/transfer/crypto.

## When to add account identity

Track D, after multi-room. Start with an **optional local profile** and a
guest→profile migration + export/import of local saves. Do **not** add a global
marketplace, transferable goods, or external payment alongside identity. Identity
unlocks durable persistence, not monetization.

## When NOT to add money / crypto

**Never, within Neon Circuit's current charter.** Tickets are internal arcade
points with no cash value. Real money, crypto, blockchain, tokens/NFTs, cash-out,
staking, yield, resale, gambling, wagering, prize cash value, and transferable
goods are permanent non-goals. Any future proposal to change this requires an
explicit, standalone product/legal/security decision recorded in the project
charter — it is out of scope for every engineering sprint.
