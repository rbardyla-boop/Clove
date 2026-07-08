# Voxel Lab Slice 8 — Threat Model / Design Review (DESIGN ONLY, BUILD UNAUTHORIZED)

Design and threat-model review for **Slice 8 — local-edit-receipt scaffolding** of the
Micro-Voxel Lab Bench (`labs/voxel-bench/`). This document is **design only**. It
authorizes no build, no code, no deploy, and no change to any trust boundary.

- **Status of Slice 8:** BLOCKED. Not implemented. Not authorized for build.
- **Verified (2026-07-08):** the symbols `buildLocalEditReceipt` and `computeChunkHash`
  exist **nowhere** in the repository (grep across all `.mjs`/`.js`/`.html`, excluding
  `node_modules`; only the plan and status docs *mention* them). No receipt, no hash
  code, no server seam, no IndexedDB/localStorage receipt persistence exists.
- **Design source of truth:** [`docs/VOXEL_LAB_BENCH_PLAN.md`](./VOXEL_LAB_BENCH_PLAN.md)
  §3.7 (kernel primitive), §4.4 (receipt + later server tier), §6 (authority boundary),
  §7 Slice 8 (unauthorized), §8 (no-deploy guarantee), Hard-Blocker #6 (network sync).
- **Merged-state record:** [`docs/VOXEL_LAB_STATUS.md`](./VOXEL_LAB_STATUS.md) (Gates A–E).

---

## 1. What Slice 8 is supposed to be (and is not)

Slice 8, *if it were ever authorized*, would add two **pure, local, client-side**
functions to the lab kernel:

- `computeChunkHash(packedOccupancy)` — an FNV-1a hash over a chunk's packed occupancy
  bytes (integrity/dedup fingerprint).
- `buildLocalEditReceipt(chunk, edit)` → `{ chunkHash, editOp, ts, public_safe: true }`
  — a small descriptor of a local edit, computed entirely in the browser, stored (if at
  all) only in local state.

Its **stated product purpose** (plan §4.1 item 7, §4.4) is a *teaching contrast*: show
the player that a would-be sync payload is tens of bytes (a hash + descriptor) versus the
kilobytes-to-megabytes of raw voxel data — making the "we never sync raw cells" lesson
visible **even though no server exists**.

**Slice 8 is explicitly:**

- a **future seam only** — a local primitive whose shape *could* later be consumed by a
  separately-gated server tier, named only to show the seam is safe;
- **NOT a trust boundary** — nothing about the receipt is trusted by anything;
- **NOT server authority** — it grants no authority, today or in any tier described here;
- **NOT a network feature** — no `fetch`/`XHR`/`WebSocket`; the plan's own Slice-8
  done-criteria require asserting *no* network symbol appears in the diff.

---

## 2. Assets

| Asset | Sensitivity | Where it lives |
|---|---|---|
| Raw voxel occupancy (cells) | Low (lab room geometry, not user PII) | Browser memory only; **never** serialized to any server, in any tier |
| Chunk hash (FNV-1a of packed occupancy) | Low — a non-secret fingerprint | Computed locally; would be the *only* voxel-derived value a future receipt could carry |
| Edit receipt `{ chunkHash, editOp, ts, public_safe }` | Low — a self-asserted local descriptor | Local state only; **no persistence shipped** |
| The lesson/measurement artifacts (Markdown/JSON export) | Low | Client-side `Blob` download (already shipped in Gate E; **out of Slice 8 scope**) |

There is **no** clinical, crisis, economy, ticket, account, or minors-facing data
anywhere in Slice 8's scope. (Contrast the sensitive `localStorage` keys hardened under
[ADR-052](#7-relation-to-adr-052--the-sealed-local-model); those are a *different*
subsystem — Slice 8 must not touch them and must not adopt their data.)

---

## 3. Trust boundaries

1. **Browser ↔ browser storage (local).** The receipt, hash, and raw cells all live on
   one side of this boundary. Crossing it (persisting to IndexedDB/localStorage) is
   **not shipped** and requires its own retention policy + tests (see §6).
2. **Client ↔ (hypothetical future) server.** This boundary **does not exist today** and
   is not authorized. If a later gate ever creates it, the invariant is absolute: the
   server **re-derives every trust-relevant claim independently** from its own canonical
   bench-room definition (a pure function), and treats *everything* the client sends —
   `chunkHash`, `editOp`, `public_safe` — as **untrusted input**, never as fact.
3. **Client ↔ another client.** Never. There is no peer channel, and ADR-052 binds this:
   peer / outside-origin / user-authored content does **not** render in another player's
   browser in this phase.

---

## 4. Attacker model

The relevant attacker is a **malicious client** (a user, or script, that fully controls
their own browser and can forge any value a client can produce):

- Can compute or **forge any `chunkHash`** — FNV-1a is not keyed and not a MAC; anyone can
  produce a valid-looking hash for any bytes, or a colliding one.
- Can set **`public_safe: true`** on anything — it is a client-authored boolean.
- Can replay, backdate (`ts`), or fabricate `editOp` values.
- Can craft an exported JSON/receipt file and re-import it (if any import path ever
  existed) with arbitrary contents.

The attacker model **excludes** transport/server compromise here, because no transport or
server exists. The whole point of the threat model is to ensure that *when* the seam is
built, a forging client gains nothing.

---

## 5. Misuse cases (and why each is neutralized by design)

| Misuse case | Neutralized by |
|---|---|
| Forge a `chunkHash` to claim an edit the client never made | Hash is **integrity/dedup only, never security**. A future server re-derives the canonical room state itself; the client hash is at most a dedup hint, never proof. |
| Set `public_safe: true` to smuggle unsafe content past a check | `public_safe` is **untrusted client input**; no code may branch on it as authority. A server independently classifies safety; the client flag is advisory metadata at most. |
| Import a hand-edited receipt/JSON to inject authoritative state | **No pass-through trust from client export/import.** Import (if ever built) validates and re-derives; it never adopts client-declared facts. Today, no import path exists. |
| Use the receipt as a covert sync channel for raw cells | Receipt schema carries **only** a hash + tiny descriptor; raw occupancy is **never** placed in it, by design (plan §6, Hard-Blocker #6). |
| Escalate the receipt into account/publish/economy actions | **No upload / publish / account path** is in scope; receipts touch no ledger, ticket, or economy module. |
| Fingerprint/track a user via receipt `ts`/hash persistence | No persistence is shipped; any future persistence needs a retention policy + tests (§6) under the ADR-052 discipline. |

---

## 6. Required future constraints (binding on any later Slice-8 build gate)

These are the non-negotiable rules a future `AUTHORIZED: BUILD VOXEL LAB SLICE 8` gate
inherits. They are design constraints, not an authorization.

1. **FNV-1a (or any simple hash) is integrity/dedup only — never security.** It is
   unkeyed and forgeable; the codebase already uses FNV-1a (`xfnv1a` in
   `arcade-studio/src/utils/random.js`) purely for seeding/PRNG, never for trust. Slice 8
   must keep it in that same non-security role.
2. **`public_safe: true` is untrusted client input — never authority.** No trust-relevant
   branch may key off it. (Mirrors the ephemeral-receipt shape in
   `arcade/city/city-interaction-receipts.mjs`, where `public_safe` is a label, not a
   grant.)
3. **A server tier (if ever gated) must re-derive all trust-relevant claims
   independently** from its own canonical bench-room definition (a pure function), and
   must **never receive or store the raw voxel array** — only a hash + small edit
   descriptor.
4. **No pass-through trust from client export/import.** Imported/exported receipts are
   inert data; nothing downstream may treat a client-declared field as canonical.
5. **No upload / publish / account path.** Slice 8 is local-only; it introduces no
   network egress and no identity.
6. **No Worker / Durable Object / D1 / R2 / live-loader implication.** Any future server
   receipt tier requires its **own new, isolated** Durable Object and its **own** gate;
   it is not implied, enabled, or pre-wired by Slice 8. `LIVE_WORLD_LOADER_ENABLED`
   (`arcade/creator/approval/approved-loader.mjs`) is untouched.
7. **No persistence unless separately authorized.** Slice 8's receipt lives in in-memory
   state by default.
8. **IndexedDB/localStorage retention requires a separate policy and tests.** If a future
   gate persists receipts, it must specify retention, caps, and — for anything that could
   become sensitive — encryption, under the [ADR-052](#7-relation-to-adr-052--the-sealed-local-model)
   sealed-local discipline, with tests proving ordering/caps.
9. **Any future receipt is local-only and non-authoritative** unless a later, explicit
   server gate says otherwise in writing.

---

## 7. Relation to ADR-052 — the sealed-local model

[ADR-052](./PROJECT_CHARTER.md) ("Sealed-local experiment model; decentralization deferred
to **verifiable package receipts, not peer-delivered content**", 2026-07-02) is directly
on point:

- ADR-052's binding kernel rule — *"client display may be predicted but truth is
  server-owned, allowlist-projected, and clients cannot author canonical facts"* — is
  exactly why a Slice-8 receipt (a client-computed hash + client-set `public_safe`) can
  **never** be authoritative. The receipt is a *prediction/fingerprint*, not a fact.
- ADR-052 defers decentralization to **verifiable package receipts** — precisely the
  category Slice 8's local receipt would belong to. Slice 8 must therefore stay a
  *verifiable, local, non-authoritative package receipt* and must never drift into a
  *peer-delivered-content* or authority channel (the exact thing ADR-052 forbids for this
  phase).
- Any future *persistence* of Slice-8 receipts inherits ADR-052's sealed-local storage
  discipline (retention, caps, encryption for sensitive data, tests) recorded in
  [`docs/LOCAL_STORAGE_HARDENING_STATUS.md`](./LOCAL_STORAGE_HARDENING_STATUS.md).

---

## 8. Non-goals

- No MMO, no multiplayer, no live cell sync, no peer channel.
- No server, no Worker/DO/D1/R2, no `wrangler` change.
- No account, login, publish, or upload path.
- No economy/ticket/minors-data coupling.
- No persistence shipped by default; no encryption scheme designed here (deferred to a
  retention gate).
- No change to Gate A–E code or to `LIVE_WORLD_LOADER_ENABLED`.

---

## 9. Required tests before any future build

Per plan §7 Slice 8 (Node-only; no browser needed for the primitive):

1. **Hash determinism** — same packed occupancy → identical hash across repeated runs
   (byte-stable), matching the kernel's existing determinism discipline (no `Date.now()`,
   no `Math.random()` inside kernel code).
2. **Receipt shape** — output strictly matches `{ chunkHash, editOp, ts, public_safe:true }`;
   no extra fields; `ts` supplied by the caller (deterministic), not read from the clock
   inside the function.
3. **No network symbol** — assert (e.g. `grep -L`) that the slice's source references no
   `fetch`/`XHR`/`WebSocket`/`EventSource`/`sendBeacon`.
4. **No forbidden coupling** — assert the slice imports no Worker/DO/D1/R2 module, no
   `approved-loader.mjs`, and no economy/ticket/receipt-ledger module.
5. **No-upload proof (unchanged)** —
   `node scripts/build-curated-client-upload.mjs --list | grep -c '^labs/'` → `0`.
6. **Non-authority assertion** — a test documenting that no code branches on `public_safe`
   or a client `chunkHash` as a trust decision (guards the design intent against drift).

---

## 10. Hard blockers before implementation

None of the following is cleared by this document; each must be resolved by an explicit
operator gate before Slice 8 code is written:

1. **Explicit `AUTHORIZED: BUILD VOXEL LAB SLICE 8` directive.** The plan authorizes no
   slice; Slice 8 is specifically called out as *not authorized*.
2. **Confirmed local-only scope for the initial build** — no persistence, no server, no
   network, in the first slice (persistence and any server tier are strictly later,
   strictly separate gates).
3. **A retention/encryption policy + tests** *before* any IndexedDB/localStorage
   persistence, under the ADR-052 discipline.
4. **A separate, isolated DO + its own gate** *before* any server receipt tier — never
   folded into Slice 8.
5. **Re-affirmation that no trust-relevant claim is derived from client input** — the
   non-authority assertion test (§9.6) must exist and pass.

---

## 11. Decision

- **Design/threat-model: COMPLETE.** The seam is characterized, the assets and boundaries
  are enumerated, the attacker/misuse cases are neutralized by design constraints, and the
  required tests and hard blockers are recorded.
- **Build: UNAUTHORIZED.** No Slice 8 code, receipt, hash, persistence, server seam, or
  runtime path is authorized by this document. Slice 8 remains **blocked**.

This document authorizes nothing beyond the design review it contains.
