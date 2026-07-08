# Voxel Lab Bench — Status (Gates A–E COMPLETE / arc CLOSED; Slice 8 blocked)

Consolidated status record for the **Micro-Voxel Lab Bench** (`labs/voxel-bench/`).
This document records the **real merged state** of Gates A–E and the current block on
Slice 8. It is a status record, not an authorization: it authorizes no build, no
deploy, and no change to any trust or upload boundary.

- **As of main commit:** `86cdd8d` (Merge PR #144 — this status doc + product fixes shipped
  to `main`; the original A–E gates landed by `692bae7` / PR #143). **The Voxel Lab A–E arc
  is CLOSED** — see the "Project closeout" section (§7) at the end of this document.
- **Design source of truth:** [`docs/VOXEL_LAB_BENCH_PLAN.md`](./VOXEL_LAB_BENCH_PLAN.md)
  (the plan; Section 7 slices, Section 8 no-deploy guarantee, "Operator Decisions"
  recorded 2026-07-01).
- **Slice 8 threat model / design:** [`docs/VOXEL_LAB_SLICE8_THREAT_MODEL.md`](./VOXEL_LAB_SLICE8_THREAT_MODEL.md)
  (design/threat-model only; build remains unauthorized).

---

## 1. As-delivered gate structure (differs from the plan's original batching)

The plan's Operator Decision #5 (2026-07-01) originally batched the work into **three**
build gates — Gate A = Slices 0–2, Gate B = Slices 3–5, Gate C = Slices 6–8. In
delivery this was re-split into **five** finer gates (A–E), and **Slice 8 was held
back** rather than shipped inside the plan's original "Gate C = Slices 6–8":

| Delivered gate | Plan slices | What it delivered | PR |
|---|---|---|---|
| Gate A | Slices 0–2 | Kernel + voxelize/raycast + Tier-1 instanced render + headless smoke | #124 |
| Gate B | Slices 3–5 | Greedy mesh + row-packing + LOD + coarse light volume | #127 (+ #137) |
| Gate C | — | Metrics/readout room (aggregates A/B measurement primitives) | #140 |
| Gate D | Slice 6 | Memory budgeter + LRU chunk eviction | #141 |
| Gate E | Slice 7 | Markdown + JSON export + shared readout component | #142, repaired by #143 |
| Slice 8 | Slice 8 | **NOT BUILT — blocked, unauthorized** (design/threat-model only) | — |

The plan document's own text is left intact as the historical record; this table is the
authoritative map of what actually merged.

---

## 2. Per-gate summary

### Gate A — lab foundation (Slices 0–2) — PR #124 (merge `5dfd493`)

- **Slice 0 — kernel scaffolding + denylist entry.** `VoxelGrid` occupancy primitive
  (`bench-core.mjs`: `setCell`/`getCell`/`indexOf`, resolution clamp, non-finite AABB
  rejection). `labs/` added to `FORBIDDEN_UPLOAD_PREFIXES` in
  `scripts/build-curated-client-upload.mjs` **first**, so the denylist entry lands
  proven-empty and stays empty as code is added.
- **Slice 1 — voxelization + raycast.** `voxelize.mjs` (13-axis Akenine-Möller
  triangle-box SAT surface voxelization, deterministic) and `raycast.mjs`
  (Amanatides-Woo DDA, all edge cases). Re-derived from the sibling repo's Stage-16
  design contract; **no runtime or build-time dependency on that repo, no copied
  source.**
- **Slice 2 — Tier-1 render.** `render-instanced.mjs` wires occupancy to a single
  `THREE.InstancedMesh` (one draw call) using the vendored Three.js **r152 ES module**
  — no CDN reference, no version bump, no new dependency. Boot (`bench-boot.mjs`),
  page (`index.html`), and headless smoke (`scripts/bench-headless.mjs`).

### Gate B — meshing / LOD / lighting (Slices 3–5) — PR #127 (merge `34ca9d6`)

- **Slice 3 — greedy mesher + row-packing.** `mesh-greedy.mjs` (0fps/Lysenko greedy
  quads, exposed faces only), `pack-rows.mjs` (zeux row-packing, round-trips
  byte-identical), `render-greedy.mjs` (Tier-2 single-draw-call `THREE.Mesh`), and a
  Web Worker entry `src/workers/mesh-worker.mjs`.
- **Slice 4 — LOD transition + popping harness.** `lod.mjs` (`downsampleChunk`,
  `computeLodLevel` — pure) plus a dedicated `scripts/lod-pop-harness.mjs` that
  *measures* LOD popping rather than asserting "LOD exists" (Blocker #3).
- **Slice 5 — coarse lighting grid.** `light-volume.mjs` (fixed low-resolution LPV,
  dual-purpose occupancy reused as both AO term and light-propagation limiter,
  Blocker #4). The headless light-volume proof script (`scripts/light-volume-headless.mjs`)
  was landed separately, immediately after Gate B, via **PR #137** (merge `d8d8a2a`,
  branch `test/voxel-light-volume-headless`).

### Gate C — metrics / readout room — PR #140 (merge `0f4ea41`)

- `metrics-room.mjs` aggregates the Gate A/B measurement primitives (instanced-vs-greedy
  mesh stats, LOD fine/coarse instance reduction, light-volume resolution cost) into
  **one deterministic report over the same occupancy grid**. This is the "budget/readout
  room" teaching surface: which lever (render strategy / LOD level / lighting resolution)
  moves which cost (draw calls / triangles / instances / bytes). Pure and dependency-free
  (`node:test`-able); headless view via `scripts/metrics-room-headless.mjs`.

### Gate D — memory budgeter + chunk eviction (Slice 6) — PR #141 (merge `0677ff9`)

- `chunk-manager.mjs` wires `MemoryBudget` enforcement into `loadChunk`/`evictLRU`.
  Budget is charged **at load time** (buffer allocation), so eviction runs *before* the
  tier ceiling is crossed, not after. "Break the budget on purpose" hostile-input
  regression protection: a session of many small edits must never let `usedBytes` cross
  the tier ceiling, even transiently. Plain Map-backed bookkeeping — no THREE, no Worker,
  no network.

### Gate E — export + shared readout (Slice 7) — PR #142 (merge `0ce1552`), repaired by PR #143 (merge `692bae7`)

- **Deterministic Markdown export** (`export-markdown.mjs`): reproduces the plan's
  Section 4.3 worked-example artifact byte-for-byte from live bench data. Never calls
  `Date.now()`/`new Date()`/`Math.random()` internally — a caller passes `metadata.date`
  explicitly, so output is 100% deterministic given the same input.
- **JSON sibling export** (same module): closes Operator Decision #7 (Markdown for the
  Obsidian "second brain" use case; JSON for replay/tests/receipts/future import-export
  validation).
- **Shared readout component** (`readout-panel.mjs`): closes Operator Decision #3 —
  `renderReadoutText()` is pure/DOM-free (`node:test`-able); `mountReadoutPanel()` is the
  single DOM-touching wrapper. Scoped to the `labs/` namespace, **not** wired into Neon
  Circuit city UI or general arcade UI.
- **Repair (PR #143):** completed the Gate E export and readout commitments
  (`fix(voxel): complete Gate E export and readout commitments`, `1a6a043`) so the
  delivered gate fully satisfies its plan-stated done-criteria.

---

## 3. Invariants (hold as of `692bae7`)

- **No deploy.** No slice's done-criteria runs `wrangler deploy`, `wrangler pages
  deploy`, or any production upload script.
- **No network.** No `fetch`/`XHR`/`WebSocket`/`EventSource`/`sendBeacon` in any bench
  module; kernel modules are pure and dependency-free.
- **No persistence.** No IndexedDB/localStorage writes are shipped. (The plan *mentions*
  IndexedDB only as a future local-only option; nothing under `labs/` persists today.)
- **No Worker/DO/D1/R2/live-loader.** No Cloudflare Worker, Durable Object, D1, or R2
  edits; no `wrangler.*` change; `LIVE_WORLD_LOADER_ENABLED`
  (`arcade/creator/approval/approved-loader.mjs`) is untouched. (`src/workers/mesh-worker.mjs`
  is a **browser Web Worker** for meshing — not a Cloudflare Worker.)
- **No economy/ticket/minors-data coupling.** No slice touches
  `arcade/city/city-interaction-receipts.mjs` or any ledger/ticket module; Section 6 only
  *references* their shape as a future-seam design note.
- **`labs/` excluded from curated upload.** `labs/` is in `FORBIDDEN_UPLOAD_PREFIXES`;
  the curated-upload builder ships **0** files under `labs/` (proof below).
- **No dependency additions.** All render code uses the already-vendored Three.js r152 ES
  module.

---

## 4. Slice 8 status — BLOCKED

- **Blocked. Not implemented. Not authorized for build.** No `buildLocalEditReceipt`, no
  `computeChunkHash`, no receipts, no hash code, no IndexedDB/localStorage, no server
  seam exists in the repo.
- Slice 8 is scoped by the plan (Section 7) to a **local-only edit-receipt primitive** —
  a *future seam only*, explicitly **not a trust boundary and not server authority**.
- **Design / threat-model only** has been produced separately in
  [`docs/VOXEL_LAB_SLICE8_THREAT_MODEL.md`](./VOXEL_LAB_SLICE8_THREAT_MODEL.md). Any
  build remains gated behind its own explicit `AUTHORIZED:` directive.

---

## 5. Validation snapshot

**Re-run this session (2026-07-07), deterministic:**

- **Voxel Lab unit suite:** `node --test labs/voxel-bench/test/*.test.mjs` →
  **164 pass / 0 fail** (13 test modules), on **Node v22.22.3**.
- **Curated upload proof:**
  `node scripts/build-curated-client-upload.mjs --list | grep -c '^labs/'` → **`0`**
  (296 curated live files; none under `labs/`).
- **`git diff --check`:** clean.

**Headless proof scripts present in repo** (Playwright + cached chromium + served root;
**not re-executed in this docs-only phase** — listed as existing artifacts):

| Script | Gate | Purpose |
|---|---|---|
| `scripts/bench-headless.mjs` | A | Tier-1 render smoke (`__bench.ready`, one draw call, no console errors) |
| `scripts/lod-pop-harness.mjs` | B (Slice 4) | LOD-popping measurement (frame-time spike + pixel delta) |
| `scripts/light-volume-headless.mjs` | B (Slice 5) | Lighting-resolution cost proof (landed via PR #137) |
| `scripts/metrics-room-headless.mjs` | C | Aggregated readout-room view |
| `scripts/export-markdown-headless.mjs` | E | Markdown/JSON export from a live bench run |

> Per the research-evidence rule: the 164/164 unit count and the `0` curated-upload count
> above were **executed this session**; the headless scripts are recorded as **present,
> not re-run** in this pass.

---

## 6. Next gates (none authorized here)

- `AUTHORIZED: BUILD VOXEL LAB SLICE 8` — local-edit-receipt primitive (blocked; see the
  threat-model doc for the hard blockers that must clear first).
- Any server-receipt tier — a strictly later, strictly separate gate requiring its own
  new isolated Durable Object and its own authorization; **not** implied by anything above.

This document authorizes none of the above.

---

## 7. Project closeout (Voxel Lab A–E arc — DONE)

Recorded so future sessions do not reopen completed gates.

**Done (complete, shipped to `main`):**

- Gates **A, B, C, D, E** — all merged (see §1–2). **Gate E repair (PR #143) complete.**
- This status doc, the Slice 8 threat model, and 3 audit-surfaced product fixes shipped via
  **PR #144** (`86cdd8d`).
- **Product-audit closure:** the `deck.html` audit-harness recovery-race false positive was
  fixed in `scripts/product-audit.mjs` (a control click that legitimately navigates the page
  is now recorded as an *environment note*, not a page error). Post-fix full audit →
  **1 flagged run**, which is a non-shipped page (`turf-wars-tech-showcase.html`, out of
  curated scope); the transient `ERR_NETWORK_CHANGED` noise class did not recur.
- **Release readiness** documented in
  [`docs/PRODUCTION_RELEASE_READINESS.md`](./PRODUCTION_RELEASE_READINESS.md) (manual
  dashboard upload only; no deploy performed).

**Intentionally NOT done (must stay that way absent a new gate):**

- **Slice 8 is NOT part of the completed A–E arc.** It is blocked, unimplemented, and
  design-only (see [`docs/VOXEL_LAB_SLICE8_THREAT_MODEL.md`](./VOXEL_LAB_SLICE8_THREAT_MODEL.md)).
- **Gate F** — does not exist; no scope; not started.
- **No deploy** from any lab work; `labs/` is **excluded from curated upload** (verified 0)
  and never ships.
- No Worker/DO/D1/R2/live-loader, no persistence, no network, no new dependencies.

**What would REOPEN the project (each its own explicit `AUTHORIZED:` gate):**

- `AUTHORIZED: BUILD VOXEL LAB SLICE 8` — only after the threat-model hard blockers clear.
- Any Gate F / new lab surface — requires its own plan + gate.
- Any server-receipt tier — its own isolated Durable Object + its own gate.

**What must NOT be inferred from the current state:**

- The existence of the Slice 8 threat model does **not** authorize building Slice 8.
- A merged `main` does **not** mean production ships this — production is unchanged; deploy
  is a separate manual gate.
- `labs/` being present in the repo does **not** mean it ships — it is denylisted from upload.

**Final validation snapshot (closure sprint, 2026-07-08):**

- Voxel Lab unit suite: **164 / 164** (`node --test labs/voxel-bench/test/*.test.mjs`).
- Product audit: **1 flagged run** (non-shipped page only); `deck.html` harness false
  positive resolved; **0 regressions** on the 3 PR #144 product pages.
- Curated upload: **296 live files**; `labs/` = **0** (verified by `find` on the built
  package plus the `--list` proof).
- `npm run test:unit`: **1297 / 1297**.

This document authorizes none of the above gates.
