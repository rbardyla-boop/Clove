# Neon Circuit HiveWorld — v0 Testbed / Simulator

> **This is a local protocol simulator and proof harness. It is NOT a production
> economy, NOT a product, and NOT a cryptocurrency.** It exists to answer one
> question on a workbench: *can a Sideband CRDT Log carry a decentralized living
> arcade world without falling apart under delay, duplication, disconnects and
> outright cheating?* Everything runs locally with zero dependencies.

- **Code:** [`arcade/hiveworld-sim/`](../arcade/hiveworld-sim/)
- **Tests:** [`tests/hiveworld/`](../tests/hiveworld/)
- **UI:** [`arcade/hiveworld-sim/hiveworld-testbed.html`](../arcade/hiveworld-sim/hiveworld-testbed.html)

---

## 1. What this simulator proves

When the test suite is green and the canned scenarios converge, the testbed has
demonstrated that the proposed architecture can support:

1. **A single append-only event fabric** (the Sideband CRDT Log) that every node
   reads and writes.
2. **Deterministic convergence** of world state under delayed, out-of-order and
   duplicated delivery — *by construction*, not by hand-tuned merge code.
3. **Room/base-station fast authority** for cabinet occupancy, with graceful
   degradation and full recovery-by-replay when a base station dies.
4. **Temporary world-space slots** (a game-layer permission, not land ownership)
   with lease / renew / expire / place / suspend semantics.
5. **An internal-only economy**: arcade credits + account-bound digital goods,
   with transfer / resale / cash-out / staking / yield **structurally impossible**.
6. **Logical "radio" sidebands** with distinct behaviour classes (ephemeral,
   persistent, authoritative, validated, proposal).
7. **Adversarial safety**: malicious events (busy-cabinet theft, forged
   envelopes, forbidden economy actions, unauthorized moderation) are visibly
   rejected and never alter authoritative state.
8. **Desync detection + replay recovery**: a disconnected node provably diverges,
   then converges after replaying the canonical log.

## 2. What this simulator does NOT prove (and never claims to)

- It is **not** a network stack. There is no real WebSocket/WebRTC/RF transport,
  no NAT traversal, no bandwidth model, no real latency distribution.
- It is **not** cryptographically secure. Signatures are deterministic **mocks**
  (`core/hash.mjs`) shaped so a real keypair scheme can drop in later. They prove
  shape, not identity.
- It is **not** a real economy. Credits are integers in a map. There is no money,
  no price discovery, no settlement, no custody.
- It is **not** AR, geolocation, or a map. "Cells" are opaque string ids.
- It does **not** model Sybil resistance, spam economics, storage limits, or
  long-term log compaction.
- It is **not** the canonical Neon Circuit authority. That remains the Phase-1b
  Cloudflare Worker + Durable Object in [`workers/arcade/`](../workers/arcade/).
  The simulator deliberately *mirrors* that occupancy model so the two can be
  compared, but it does not replace it.

## 3. The Sideband CRDT Log

The fabric is one **append-only set** of signed events, de-duplicated by
`event_id`. Each event carries:

| field | meaning |
|-------|---------|
| `event_id` | deterministic id = `hash(actor_id # seq # content_hash)` |
| `logical_tick` | logical clock (the canonical ordering key) |
| `timestamp` | mirror of `logical_tick` (kept for envelope shape) |
| `actor_id` | who authored it |
| `room_id` / `cell_id` | scope |
| `sideband` | which logical channel (see §6) |
| `event_type` | one type, bound to exactly one sideband |
| `payload` | event-specific data |
| `prev_hash` | content hash of the actor's previous event (source chain) |
| `seq` | per-actor sequence number |
| `signature` | **mock** signature over `(actor_id, content_hash)` |
| `content_hash` | content address of the canonicalized content |

**Convergence model.** A node never merges by replaying in arrival order.
Instead it (1) accumulates events into a set keyed by `event_id`, (2) sorts the
set into one canonical total order — `logical_tick → actor_id → seq →
content_hash` — and (3) folds it with deterministic reducers. Two nodes holding
the same accepted set therefore compute byte-identical state. Delay, reorder and
duplication cannot change the result because the result depends only on the set,
not on the order of arrival. (See [`core/log.mjs`](../arcade/hiveworld-sim/core/log.mjs)
and [`core/world.mjs`](../arcade/hiveworld-sim/core/world.mjs).)

**Two rejection points.** Structural rejection happens at the fabric boundary
(`SidebandCRDTLog.ingest`): bad signature, tampered hash, unknown sideband,
sideband/type mismatch, forbidden type. Those never enter the log. Authority /
semantic rejection happens during the fold: busy cabinet, expired slot,
insufficient credits, non-moderator suspend. Those events *are* on the fabric
(they were validly transmitted) but change no state, and appear in the rejected
feed with an explicit reason.

## 4. Player agent model

Every player carries a **node** ([`core/agent.mjs`](../arcade/hiveworld-sim/core/agent.mjs),
extending [`core/node.mjs`](../arcade/hiveworld-sim/core/node.mjs)) with: a stable
`id`, its own append-only **source chain** (`seq` + `prev_hash`), a subscription
filter, a local replica (`known`) of events it has heard, and a `trustScore`.

An agent is **not** authoritative. `emit()` only *proposes* an event; whether the
proposal changes world state is decided later by the canonical fold. `receive()`
does structural validation + de-dup only. Inventory and credits are **derived**
from the agent's own folded view — an agent cannot grant itself anything by fiat,
it can only emit market events the reducers may accept or refuse.

## 5. Room / base-station authority model

A room is also a node ([`core/room.mjs`](../arcade/hiveworld-sim/core/room.mjs)). It
provides **fast authority** for cabinet occupancy by keeping a cheap, incremental
occupancy projection (it folds only its own occupancy slice, only when it
changes) plus a liveness map of heartbeats. It signs `cabinet_timeout` events to
release stale locks.

**Graceful degradation + recovery.** When a base station goes offline it stops
issuing timeouts and its answers go stale — but the append-only log is untouched.
On `recover()` it replays the canonical snapshot and rebuilds its occupancy
mirror exactly. No authoritative truth is lost when the base station dies; the
log is the source of truth, the room is an accelerator over it. This mirrors the
Phase-1b Durable Object's stale-lock alarm, but proves it survives total node
loss.

## 6. Sidebands

`core/sidebands.mjs` defines eleven logical channels, each with a behaviour class:

| sideband | class | notes |
|----------|-------|-------|
| `discovery` | ephemeral | node + room announcements (builds the role registry) |
| `presence` | ephemeral | high-frequency heartbeats; only latest kept per actor |
| `occupancy` | authoritative | cabinet locks; room is fast authority; rev-based |
| `object_state` | authoritative | short-lived in-room object locks |
| `ar_anchor` | persistent | AR anchor placeholders (no real AR) |
| `asset_sync` | persistent | equip/unequip of account-bound cosmetics |
| `agent_intent` | proposal | proposals only — can **never** override authority |
| `market` | validated | internal credits + bound goods; slow, fully validated |
| `moderation` | authoritative | suspend slots/objects; moderator role only |
| `event_log` | persistent | durable world events (round results, slot lifecycle) |
| `weather` | ephemeral | ambient per-cell flavour |

The "radio" framing is a metaphor for state-class separation. **There is no RF.**

## 7. World-space slot model

A slot is a **temporary permission to place approved content in a simulated
cell** — explicitly not land ownership. Fields: `slot_id`, `cell_id`, `holder`,
`slot_type`, `start_tick`, `end_tick`, `allowed_actions`, `placed_objects`,
`moderation_status`. Lifecycle: `lease_slot`, `renew_slot`, `expire_slot`,
`place_object`, `remove_object`, plus moderator `suspend_slot`. Placement
authority vanishes the instant a slot expires (tick past `end_tick`) or is
suspended.

## 8. Internal credits / digital goods model

- `grant_credits` — a **test-mode-only** faucet (`economyTestMode`). Rejected
  with `economy_locked` otherwise.
- `spend_credits` — cannot overdraw (`insufficient_credits`).
- `mint_bound_good` — creates an **account-bound** good (`bound: true`). Optional
  internal cost.
- `equip_good` / `unequip_good` — only goods you own.
- Every credit movement writes a **mock-signed receipt**.

There is no `transferable` flag and no transfer reducer. The only transfer-like
event types (`transfer_good`, `cashout_credits`, `stake_credits`, `yield_credits`,
`list_for_resale`, `sell_good`, `token_trade`) live in `FORBIDDEN_EVENT_TYPES` and
are refused at the fabric boundary — they can be *received* (so we can test the
refusal) but are never applied.

## 9. Threat model (what v0 defends against, in-sim)

| attack | defence | reason surfaced |
|--------|---------|-----------------|
| steal a busy cabinet | fold occupancy rules | `busy` |
| forge / tamper an event | content-hash + mock-sig check at ingest | `bad_content_hash` / `bad_signature` |
| transfer / cash out a good | forbidden event types | `forbidden_event_type` |
| suspend someone's slot without rights | moderator role check | `not_moderator` |
| place on an expired/suspended slot | slot window + status check | `slot_expired` / `slot_suspended` |
| overdraw credits | balance check | `insufficient_credits` |
| "claim" authority on the intent channel | proposal sideband is inert | (no state change) |
| flood an unknown sideband | sideband allowlist | `unknown_sideband` |

Out of scope for v0: Sybil identities, spam economics, real signature forgery,
storage exhaustion, traffic analysis.

## 10. Known limitations

- Mock signatures (no real crypto); single-process in-memory fabric.
- Logical ticks, not wall-clock; no real latency/bandwidth model.
- Full immutability in reducers makes large folds O(n) per touched slice; fine at
  v0 scale (the 1000-tick scenario builds ~10k events in a few seconds) but not a
  production storage design.
- No log compaction / snapshotting; the fabric only grows.
- The UI runs `meshChurn` at 400 ticks for responsiveness; the **test** runs the
  full 1000-tick scenario.

## 11. How to run the tests

From the repo root (Node ≥ 18, no install needed):

```bash
node --test tests/hiveworld/*.test.mjs
# or
cd arcade/hiveworld-sim && npm test
```

Categories: event fabric (A), occupancy (B), slots (C), economy (D), mesh (E),
sidebands (F), full scenarios (G).

## 12. How to run the simulator UI

Serve the repo with any static server that sends `.mjs` as a JavaScript MIME
type, then open the testbed:

```bash
npx serve -p 5173 .
# open http://localhost:5173/arcade/hiveworld-sim/hiveworld-testbed.html
```

The UI lets you spawn agents, create rooms, join, occupy/release cabinets, play a
deterministic round, lease slots and place objects, grant test credits,
buy+equip account-bound goods, disconnect nodes, knock out base stations, fire
malicious events, replay the log, run any canned scenario, and export the full
report as JSON. The spectrum panel shows live per-sideband activity; the rejected
feed shows every refusal with its reason.

## 13. Next steps after v0 (NOT implemented)

These are explicitly future work and intentionally absent from this build:

- Replace mock signatures with real per-agent keypairs (ed25519) behind the same
  `sign`/`verify` interface.
- A real transport: bridge the fabric to the Phase-1b Worker + Durable Object, or
  a WebRTC/libp2p gossip layer, and re-run the same convergence tests over it.
- Log compaction / snapshots / state checkpoints for unbounded runtime.
- Sybil resistance and spam/rate economics for the sidebands.
- Persistence (file or IndexedDB) for replayable sessions.
- A genuine AR/geo layer once the slot + anchor model has been validated on real
  hardware.
- Promotion of any of the above into a product would require a fresh security and
  compliance review — none of it is greenlit by this testbed.
