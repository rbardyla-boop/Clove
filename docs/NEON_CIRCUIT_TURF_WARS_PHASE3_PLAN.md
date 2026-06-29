# Turf Wars — Phase 3 Plan: Non-Central Availability Fabric (lab-only)

**Status: PLAN — LAB-ONLY · PLAN-PHASE. No code is written by this gate.** This document is the detailed
design behind the roadmap's Phase 3 row ("Non-central availability fabric (lab→staged) — offline host's base
seeable/attackable via swappable helpers without recreating central authority", gate
`AUTHORIZED: NO-CENTRAL-AUTHORITY AVAILABILITY EXERCISED`). It authorizes nothing live. It does **not**
supersede the live gameplay charter, does **not** claim counsel approval, charter override, minors-safety
clearance, or production readiness, and does **not** satisfy or substitute for the **Phase 0 legal/safety
counsel review, which remains BLOCKING** for any live or minors-facing use. The eventual Phase 3 fabric stays
lab-only and prod-denylisted exactly like the Phase 1 substrate (ADR-050), the Phase 2 foundation (ADR-051,
merged `828f33c`), and the Phase 2 settlement layer (O1/O2, merged `4ead01d`).

> This is a **design + lab-mechanism plan**, written to the project research-evidence rule: it separates what
> a lab **would prove** from what it **assumes/defers**, and states a **falsifier** for each claim. Where it
> states a current technical property it is an engineering fact about the lab code, not a legal conclusion.

## Why Phase 3 exists — the three residuals settlement left open

The Phase 2 settlement layer is correct **in-process**: O1 (commit-reveal + the prior `attack_commit` op)
proves the seed-binding is grind-resistant **given a fair post-commit beacon**, and O2 proves the fraud-proof
is **delegable** — `verifySettlement(baseRecord, plan, claim)` and `proveFraud(baseRecord, plan, claim)`
([settlement.mjs](../arcade/hiveworld-agents/turf-wars/settlement.mjs)) are pure over public signed inputs, so
any third party catches a forged settlement against an offline victim. Settlement's own evidence pack
([settlement-evidence.mjs](../arcade/hiveworld-agents/turf-wars/settlement-evidence.mjs)) names exactly three
residuals it does **not** claim, verbatim:

1. **O1 beacon SOURCE.** The commit-before-settle *ordering* is enforced in-fold (`no_prior_commit`). The
   remaining residual is the **beacon**: it must be fixed **after** the commit and be **party-uncontrolled**.
   This **includes the bounded multi-commit (K-of-N) vector** — an attacker can plant several `attack_commit`
   ops with different seeds before the beacon and settle the best one — so the fair-beacon definition must
   also specify **when the commit window closes** relative to beacon publication.
2. **O2 availability.** That **≥1 honest peer watches within the challenge window** is the Phase-3
   availability fabric — it is assumed, not proven.
3. **O6 multi-writer.** **Which writer commits** the `attack_commit` / `settle_attack` ops into a shared log
   (single-writer here: the block owner), **concurrent-attack convergence**, and **applying a fraud-proof
   revocation against an offline owner** is Phase 3.

Phase 3 designs the **lab-only** mechanism for all three, with the honest residuals deferred to Phase 4 /
Phase 0 and **falsified**, never asserted closed.

## The seams Phase 3 plugs into (verified, unchanged)

Phase 3 attaches **above and around** the settlement layer without changing its signatures or purity:

- **`deriveSettlementSeed({base_address, plan_hash, seed_reveal, beacon})`** ([settlement.mjs:54]) takes
  `beacon` as an **input** (a closed hex token, `SEED_TOKEN_RE`); nothing manufactures it today (the evidence
  pack fakes it). Phase 3 supplies a party-uncontrolled, post-commit beacon **into this same boundary** — no
  signature change.
- **`verifySettlement` / `proveFraud`** are **pure over public inputs** — no defender key, no online
  requirement. Phase 3 builds the layer that **delivers** `(baseRecord, plan, claim)` to ≥1 honest watcher,
  and the cross-peer **application** of a produced fraud-proof. It must not alter their purity.
- **The challenge window is conceptual, not built.** The `settle_attack` fold
  ([block-log.mjs](../arcade/hiveworld-agents/turf-wars/block-log.mjs)) applies scorch and records the
  settlement **immediately**, with no provisional/final flag and no window counter. Phase 3 builds the
  finalization seam — flagged as **un-built**, not asserted closed (the D5 lesson).
- **Single-writer authority.** `assembleChain` binds `owner` from genesis and requires `op.actor === owner`
  for every `seq > 0`; a foreign-signed op is `not_owner` and **inert**. Phase 3 adds writers in a **separate
  settlement namespace** — it never relaxes `actor === owner` for the owner's own base chain.
- **`blockFingerprint` excludes the scorch overlay.** The convergence oracle includes `chain_head`,
  `seq_height`, counters, and sorted structures but **excludes** `s.scorch` — so settlement state is already
  structurally separable from base-state convergence. Phase 3 adds a **second** fingerprint for the overlay
  and leaves the base fingerprint untouched.
- **The snapshot is the offline replication unit.** `signSnapshot` / `verifySnapshot`
  ([snapshot.mjs](../arcade/hiveworld-agents/turf-wars/snapshot.mjs)) produce a content-addressed,
  owner-signed projection that verifies **fully offline** (no signer/server/network). This is the already-built
  "reachable when the host is down" primitive the availability fabric serves and replicates.

Authority stays exactly what it is today: **replay-determinism + the existing one-op delegable fraud-proof**.
No relay, holder, cache, discovery helper, or fingerprint introduced by Phase 3 holds a signing key or decides
correctness; every such helper is **optional and swappable**, and correctness must be byte-identical if it is
swapped out.

---

## Residual 1 — Fair, party-uncontrolled beacon source (closes the O1 beacon residual)

### Mechanism — commit-derived cross-block hash-chain checkpoint beacon, commit window closed at the beacon height

The beacon is derived from chains **outside both parties' control**, and the cohort is bound to the commit so
cohort-choice cannot be ground at settle time:

1. **Beacon height.** Each `attack_commit` names a future **logical seq-height** target `H_b`, strictly
   greater than the commit's own fold height (deterministic, no wall clock). The beacon is **undefined** until
   the cohort reaches `H_b`, so it provably did not exist at commit time — the post-commit property
   `deriveSettlementSeed` already assumes.
2. **Cohort derived from the commit.** The N foreign blocks are **not** chosen by the attacker at settle
   time; the cohort is a deterministic function of the commit's own bytes:
   `cohort = the N witnessed block-ids minimizing distance(block_id, sha256(seed_commit | plan_hash | H_b))`,
   **excluding** the attacker's and defender's blocks. Because the cohort is pinned by `seed_commit` (already
   locked before the beacon by the O1 ordering invariant), the attacker cannot re-pick a friendlier cohort
   after seeing heads, and cannot grind cohort selection independently of grinding `seed_commit`.
3. **Beacon value** = a deterministic hash-aggregate of the cohort's `chain_head` hashes at height ≥ `H_b`:
   `beacon = sha256(canonicalize(sortedByBlockId([{block_id, chain_head_at_H_b}, …]))).slice` to the
   `SEED_TOKEN_RE` width. This feeds the **unchanged** `deriveSettlementSeed` 4-input boundary.
4. **Window-close rule (bounds K-of-N).** A `settle_attack` is valid only if its referenced `attack_commit`
   was folded at height `< H_b`. Since `H_b` is defined by **foreign** heads the attacker cannot advance or
   stall on demand, the attacker cannot keep committing past the moment the beacon becomes computable. K is
   bounded by the number of `attack_commit` ops the attacker can fold before `H_b` — each costing a full
   signed chain op at a distinct seq on the attacker's own single-writer log. **The mechanism bounds K; it
   does not make K = 1.**

### Why no central server

The beacon is a **pure deterministic function of already-signed, content-addressed foreign block snapshots** —
the same records peers already cache to make an offline block attackable. No node mints, signs, or arbitrates
it; every peer recomputes the identical beacon (like `blockFingerprint` convergence). The cohort is derived
from the commit, not assigned by any coordinator, so there is no privileged selector. A peer that merely
serves the foreign snapshots gains no authority — correctness traces to the foreign owners' signing keys and
the deterministic aggregate, never to who relayed the bytes.

### Alternatives rejected

- **drand / external public-randomness beacon** — reintroduces a hosted external dependency the no-central
  invariant forbids; settlement liveness and integrity become hostage to a service the hive does not run.
- **VDF** — needs trusted setup / specialized prover infrastructure (centralizing), and cannot be evaluated
  deterministically/instantly in-process (its point is wall-clock delay), breaking the byte-identical
  regeneration rule.
- **Defender-contributed randomness (attacker XOR defender seed)** — the defender is offline by design;
  requiring a fresh defender contribution breaks O2's premise and re-opens last-revealer bias.
- **Static registry / key-Merkle root** — no freshness; identical before and after the commit, so zero
  post-commit unpredictability — fully precomputable. Fails the core O1 property.
- **Proof-of-Work pool** — reintroduces centralizing hashpower infrastructure and an energy/economy surface
  adjacent to the forbidden economy line; grindable by the best-resourced party.
- **Single foreign block (N=1)** — one foreign owner can collude or be a sock-puppet and grind their own head;
  a single stall deadlocks settlement. Kept only as the degenerate lower bound for the falsifier.
- **Phase-4 M-of-N quorum beacon** — *not rejected, deferred*: a legitimate stronger source, but it depends on
  the Phase-4 safety quorum (not built). The cross-block checkpoint is the Phase-3-buildable mechanism; the
  quorum beacon is the documented upgrade path, layered above the **same** `deriveSettlementSeed` boundary.

### What the lab would prove

- **Beacon determinism/convergence:** two honest peers with the same witnessed foreign-snapshot set recompute
  a byte-identical beacon for the same `(seed_commit, plan_hash, H_b)`.
- **Post-commit property:** the beacon is undefined before the cohort reaches `H_b` and defined after, so a
  seed locked at commit cannot have been chosen against a known beacon.
- **Cohort non-grindability:** with `seed_commit` fixed, the cohort cannot change — re-deriving it requires a
  different `seed_commit`, which the commit-reveal already locks.
- **Beacon-binds-outcome:** different witnessed foreign-head sets yield different `settlement_seed` /
  `outcome_digest`.
- **K-of-N bound is enforced, not just asserted:** a `settle_attack` referencing a commit at height ≥ `H_b` is
  econ-rejected; the achievable K equals exactly the pre-`H_b` chain-op budget (a measured bound, not
  unbounded enumeration), and the per-K outcome-improvement distribution is quantified.
- **Invariants preserved:** no value/transfer field added; base never mutated; only bounded reversible
  cosmetic scorch.

### Deferred residuals (Phase 3/4 / Phase 0 — disclosed, not closed)

- **Real-world entropy liveness** — that enough independent foreign blocks actually advance to `H_b` in
  bounded time, and that their heads carry real unpredictable entropy, is a live-network property (gated with
  real transport, B6/B7/D11).
- **Colluding / sybil cohort** — an attacker who controls or stuffs a quorum of the commit-derived cohort can
  bias the aggregate. The lab can **measure** the collusion fraction needed to flip an outcome; it cannot
  prove a real network resists sybil cohort-stuffing — that needs the Phase-4 quorum / identity-cost.
- **K bound is a bound, not K=1** — a residual bounded grind (try a handful of seeds, settle the best)
  survives; choosing `H_b` safely vs. attacker op-rate is Phase 3/4 + Phase 0.
- **Witnessed-set agreement** — convergence requires peers to agree on which foreign snapshots they hold at
  `H_b`; guaranteeing a common witnessed set is the availability fabric (Residual 2) + multi-writer (Residual
  3).

### Falsifiers

- Cohort changes without changing `seed_commit` → cohort non-grindability broken.
- A beacon computable from heads available at/before commit height → post-commit property broken.
- With `seed_commit` fixed, two different foreign-head sets yield the **same** outcome → beacon does not bind.
- A `settle_attack` whose commit folded at height ≥ `H_b` is **accepted** → window-close not enforced; K
  unbounded.
- Two honest peers with the same witnessed set compute **different** beacons → determinism broken.
- Introducing the beacon mutates the base, adds a value field, or makes scorch non-reversible → invariant
  broken (hard block).

---

## Residual 2 — Honest-peer availability within a deterministic challenge window (closes the O2 residual)

### Mechanism — seeded in-process holder-set + a finalization predicate (provisional → final iff no valid fraud-proof within W seq-heights)

Four composable pure `.mjs` lab modules; availability is modeled **deterministically in-process** (a seeded
peer set with seeded drop/delay/partition), **never over a wire**.

1. **Holder-set view-model.** A content-addressed holder index `snapshot_hash → Set<holderId>`, where each
   holder caches a **full signed snapshot record** re-validated only via the already-built `verifySnapshot`
   (`null` = valid; a tampered byte yields a non-null reason and the holder is **not** counted). The
   holder/discovery seam is a **swappable, signing-keyless** interface `{ has, holdersOf, put }`: it stores
   only signed public snapshots, holds no key, and cannot alter outcome — swap it for a single in-process map
   and outcomes are byte-identical, because authority traces to the owner key inside each record.
2. **Challenge-window finalization predicate** (builds the un-built Seam 3). A settlement folded by
   `settle_attack` is **provisional** at `open_height = s`; logical time is measured in **seq-heights**
   advanced by subsequent folded ops (not `op.tick`, not wall clock). `finalize(settlementRef, currentHeight,
   watcherVerdicts)` is a **pure** predicate: `final` iff `(currentHeight − open_height) ≥ W` **and** no valid
   `proveFraud` appeared in `[open_height, open_height+W)`; `refuted` iff **any** valid `proveFraud` lands at
   any in-window height (a single fraud-proof flips it, even at height 0); else `provisional`. It is a view
   **over** the fold output — it does **not** make the fold correctness-authoritative (the fold still trusts
   bounded carried scorch; correctness stays the delegable fraud-proof's job). Because `s.scorch` is outside
   `blockFingerprint`, provisional/final status never perturbs base-state convergence.
3. **Watcher model.** An honest watcher is any holder that holds a valid snapshot for `base_address` **and** is
   sampled watching within `[open_height, open_height+W)`. An **offline victim** is protected iff ≥1 **other**
   modeled honest peer both holds the snapshot and watches in-window — proven by constructing a holder set
   where the defender is offline yet a third holder refutes a forged settlement, and **falsified** by a
   partition that isolates every honest holder until `currentHeight − open_height ≥ W`.
4. **Availability evidence pack + partition/storm stress**, in the existing `build*EvidencePack({seed})` /
   `build*EvidenceSuite({seeds:[42,1337,9001]})` convention with `resolves[]` / `deferred_residuals[]` and a
   denylist self-check.

**Convergence under storm:** holder gossip is modeled as a delivery multiset over the **existing** `foldBlock`
op-set. Because `foldBlock` dedups by `op.hash`, resolves seq-forks by lowest op-hash, and `blockFingerprint`
excludes volatile bookkeeping, a seeded reorder/dup/drop storm folds to the **same** `blockFingerprint`
(mirrors `attention-stress` S1/S2/S7). Re-delivering already-rejected settle ops cannot grow audit state
(mirrors the `foldLedger` `rejectedIds` discipline / S3).

### Why no central server

No module holds a signing key or decides correctness. The holder index stores only owner-signed records
validated by `verifySnapshot`; the finalization predicate decides status **only** by replaying the already-
delegable pure `proveFraud` over public inputs — it adds no authority, it just **counts** whether a refutation
appeared in a logical-height window. The fold remains the only state-mutating authority and stays
non-correctness-authoritative. Single-writer per block is preserved verbatim — the holder set is a
read/replication overlay that cannot write or fork another owner's block.

### Alternatives rejected

- **Quorum acknowledgement / M-of-N attestation** — reintroduces a privileged committee whose signatures gate
  finalization (central-ish), needs holder keys (breaks the keyless seam), and collapses to the same
  honest-minority assumption it claims to remove. The M-of-N safety quorum is reserved for Phase 4
  (minors-safety render-gate), not availability.
- **Wall-clock window** — violates no-wall-clock / byte-identical regeneration and is non-deterministic.
- **Eager finalization (status quo)** — gives a forged settlement zero refutation window against an offline
  victim; this is exactly the residual.
- **Push-based liveness oracle** — needs real transport, IP exposure, and an availability guarantee Phase 0
  forbids; smuggles in a central liveness authority.
- **Self-attestation / forward re-broadcast** — a forging attacker would publish the forged digest; only an
  independent recompute catches forgery — the very assumption we must model and flag, not engineer away.

### What the lab would prove

- A settlement is provisional at `open_height` and `finalize()` returns `final` iff `W` seq-heights pass with
  no valid in-window `proveFraud` (Seam 3 built as a pure predicate over logical seq-heights).
- A single valid `proveFraud` from **any** holder flips a forged provisional settlement to `refuted` at any
  in-window height.
- An **offline victim** is protected when ≥1 other honest peer holds a valid snapshot and watches in-window.
- `verifySnapshot` is the replication unit verbatim — a tampered cached record is excluded; authority traces to
  the owner key, never the index (swap-the-index test: identical outcomes).
- Convergence under a seeded reorder/dup/drop storm (same `blockFingerprint`); rejected-settlement flood is
  bounded; base/counters/structures never mutate; scorch bounded reversible; `attacker_reward ≤ 25` credited
  to nothing; denylist self-check holds.

### Deferred residuals (Phase 3/4 / Phase 0 — disclosed, not closed)

- **Honest-minority assumption (the core residual):** "≥1 honest peer holds the snapshot **and** watches
  within the window" is an assumption the lab constructs-and-tests but cannot guarantee in deployment.
- **Real-network liveness, sybil/eclipse** — gated with real transport (B6/B7/D11).
- **Partition-past-window** — a partition isolating the victim and all honest holders until `W` elapses lets a
  forgery finalize; the lab **reproduces** this deterministically as the residual's witness.
- **Window-length calibration** — choosing a real `W` depends on real propagation characteristics; deferred.

### Falsifiers

- A partition that isolates victim + all honest holders past `W` shows **protection** → model wrong.
- Introducing provisional/final status changes `blockFingerprint` → overlay leaked into the convergence oracle.
- Swapping the holder index changes any finalization outcome → the seam is not keyless/swappable (central
  authority crept in).
- Two byte-for-byte replays of one seed produce different verdicts → time leaked from a non-deterministic
  source.
- `proveFraud` returns a fraud-proof against an **honest** settlement → finalization soundness broken.
- The finalization predicate causes the fold to recompute/reject on correctness → central authority re-entered
  the fold.

---

## Residual 3 — O6 multi-writer: shared-log authorship + revoking against an offline owner

### Mechanism — per-attacker settlement mini-log + content-addressed convergent overlay (PASCAL/CAO)

**One writer per mini-log, many mini-logs per block.** Single-writer authorship is preserved **per author**
across the whole system; the owner's chain is never touched.

- **Layer 1 — Attacker mini-log.** Each attacker `A` maintains a signed hash-chain
  `SettlementMiniLog(A, block_id, base_address)` with `mini_log_id = sha256("settlement-mini-log/v1|" +
  block_id + "|" + base_address + "|" + attacker_pubkey)` (content-derived, coordination-free). It carries only
  `settlement_commit` (mirrors `attack_commit`) and `settlement_reveal` (mirrors `settle_attack`), authored
  **solely** by `A`. `foldMiniLog` mirrors `assembleChain` with `actor === attacker` enforced at every seq
  (foreign op → `not_attacker`, inert) and the same lowest-op-hash fork tie-break. The
  `settlement_commit`-before-`settlement_reveal` ordering expresses D1's commit-before-beacon constraint
  **inside each attacker's own single-writer log**.
- **Layer 2 — Overlay DAG.** The overlay is a set of mini-log head entries `{mini_log_id, attacker_pubkey,
  head_hash, seq_height, outcome_digest, status}`. `foldOverlay` is pure over the entry set: dedup by
  `mini_log_id` keeping max `seq_height` (tie-break lowest `head_hash`, mirroring the existing fork rule),
  canonical-sort by `mini_log_id`, then apply revocations. **Cross-writer ordering needs no shared seq** — the
  merge is deterministic over the entry set, so two peers holding the same entries produce the same
  `overlayFingerprint`.
- **Layer 3 — Revocation.** Any peer who can compute `proveFraud` (pure over public inputs) emits an
  `overlay_revoke {mini_log_id, fraud_proof, revoker_pubkey, …}`. Any peer verifies it by **re-running
  `proveFraud`** over the attacker's `settlement_reveal` and checking `mismatch === true`. `foldOverlay`
  applies revocations in a second pass, setting `status = 'revoked'` and excluding that entry's scorch from the
  applied total. The revoker's signature is **informational only** — correctness depends on `proveFraud`
  purity, **not** on who signed; **the owner need not be online**. Re-delivery of the same `revoke_hash` is a
  no-op (mirrors the `rejectedIds` dedup).
- **Layer 4 — Second fingerprint.** `blockFingerprint` is **unmodified**. A separate `overlayFingerprint`
  covers the settlement overlay; peers may agree on base while overlays still converge — honoring the existing
  `s.scorch` exclusion. Concurrent attacks on one `base_address` are distinct `mini_log_id`s; their non-revoked
  scorch is applied additively via the already-bounded `applyScorch` in canonical `mini_log_id` order, so even
  simultaneous attacks are deterministic and per-structure-bounded by `SCORCH_CAP`.

**Composition:** D1's `beacon` is the same external input `settlement_reveal` already carries; the mini-log's
commit-before-reveal anchors D1's constraint. D2's finalization predicate **writes** `provisional/final/refuted`
into the overlay entry's `status` field — O6 provides the overlay structure; D2 provides the watcher model.

### Why no central server

`mini_log_id` is content-derived (no coordinator). Each attacker is the sole writer of their own mini-log.
`foldOverlay` is a pure deterministic function of the entry set. Revocations require no owner, no online
referee, and no trusted relay — any peer holding `baseRecord` and `plan` can produce and propagate one. A
relay/holder is optional and interchangeable; swapping it changes propagation speed, not correctness.

### Alternatives rejected

- **Fold attacker ops into the owner's chain (relax `actor === owner`)** — weakens the single most important
  invariant and conflates base authority with settlement evidence.
- **Single shared settlement log with a global seq** — a global seq needs a coordinator (central) or collides
  with no deterministic resolution; the per-attacker mini-log eliminates the global-seq problem.
- **Owner appends settlement after receiving evidence** — requires the owner online, the exact offline-victim
  case O6 must solve; wastes `proveFraud` delegability.
- **Owner-published Merkle settlement root** — requires the owner online at every settlement event; retained
  only as an optional future snapshot-compression optimization.
- **Append revocation to the owner's base chain** — the offline owner cannot sign it; defeats offline
  protection. The overlay revocation is deliberately keyless for the owner.

### What the lab would prove

- Single-writer per author: every foreign-signed mini-log op is rejected `not_attacker` (measured across a
  seeded peer set with cross-signed forgeries).
- Mini-log convergence: `foldMiniLog(shuffle(S)) === foldMiniLog(S)` (16 reorder/dup shuffles × seeds
  [42,1337,9001]; convergence is *structural* — guaranteed by the pure dedup + canonical-sort fold — so the
  shuffle count is illustrative, not load-bearing; the evidence pack reports the real count it runs).
- Overlay convergence (falsifiable): `foldOverlay(shuffle(E)) === foldOverlay(E)` with concurrent attackers +
  injected revocations.
- Offline-owner revocation: a fraudulent `settlement_reveal` is revoked by any peer without the owner's key;
  the revoked entry's scorch is excluded; **`blockFingerprint` is byte-identical before and after**.
- Concurrent-attack determinism: N distinct `mini_log_id`s, scorch applied in canonical order, no structure
  exceeds `SCORCH_CAP`.
- Base-fingerprint independence; revocation idempotency; relays swappable (partition/reconnect converges to
  equal fingerprints).

### Deferred residuals (Phase 4 / Phase 3 / Phase 0 — disclosed, not closed)

- **Safety-quorum membership & sybil resistance (Phase 4):** false revocations are self-detecting
  (`proveFraud = null` → discarded), but a sybil **flood** of revocation attempts is not bounded; the
  structural fix is a K-of-N co-signed revocation, which needs sybil-resistant identity — a Phase-4 problem.
- **Owner reconciliation on return (Phase 4):** how a returning owner's new base ops interact with outstanding
  overlay scorch is not designed here; safe to defer because scorch is bounded/reversible/cosmetic and base is
  never mutated.
- **Fair beacon source (Residual 1), watcher liveness (Residual 2), real P2P transport (Phase 0 B6/B7/D11)** —
  inherited, not re-solved here.

### Falsifiers

- Any op set + permutation where mini-log or overlay fingerprints diverge → non-deterministic merge.
- A non-fraudulent settlement (`proveFraud === null`) is marked `revoked` → revocation skips re-running
  `proveFraud`.
- Two peers with the same overlay entries produce different combined scorch totals → ordering not anchored to
  `mini_log_id` sort (hidden coordinator).
- Adding/revoking an overlay entry changes `blockFingerprint` → overlay leaked into the base fold.
- Re-delivering a `revoke_hash` changes `overlayFingerprint` → dedup absent.
- Any `foldMiniLog` path accepting `op.actor !== attacker_pubkey` → single-writer invariant broken.

---

## Sub-gate decomposition (the buildable Phase 3 plan)

Phase 3 is **not** a single build. Each sub-gate is its own bounded objective with its own evidence and its own
`AUTHORIZED:` line, mirroring how Phase 2 split into O1/O2. All modules land under
`arcade/hiveworld-agents/turf-wars/` so they auto-inherit the frozen `arcade/hiveworld-agents/` upload-denylist
prefix; every pack carries a denylist self-check; the prod-denylist test stays **predicate-based, not
count-based**.

| Sub-gate | Objective | New lab modules | Proposed gate line |
|---|---|---|---|
| **P3-a — Beacon source** | Commit-derived cross-block checkpoint beacon + window-close-at-`H_b`; bounds (does not eliminate) K-of-N; feeds the unchanged `deriveSettlementSeed`. | `beacon.mjs`, `beacon-evidence.mjs`; window-close predicate + bounded-int `H_b` field in the `attack_commit`/`settle_attack` schemas | `AUTHORIZED: BUILD PHASE 3a — BEACON SOURCE — LAB ONLY` |
| **P3-b — Availability + challenge window** | Seeded holder-set + finalization predicate; offline-victim-protected-iff-honest-watcher; partition-past-window reproduced as the residual witness. | `availability.mjs`, `challenge-window.mjs`, `availability-evidence.mjs`, `availability-stress.mjs` | `AUTHORIZED: BUILD PHASE 3b — AVAILABILITY + CHALLENGE WINDOW — LAB ONLY` |
| **P3-c — Multi-writer overlay (O6)** | Per-attacker mini-log + convergent overlay DAG + keyless revocation; base never mutated; second fingerprint. | `settlement-mini-log.mjs`, `overlay-dag.mjs` (+ `overlayFingerprint`), `overlay-evidence.mjs` | `AUTHORIZED: BUILD PHASE 3c — MULTI-WRITER SETTLEMENT OVERLAY — LAB ONLY` |
| **P3-d — Integration + fabric proof** | Wire P3-a/b/c into one deterministic in-process availability-fabric simulator; the roadmap's `NO-CENTRAL-AUTHORITY AVAILABILITY EXERCISED` evidence; full reorder/dup/drop/partition stress across seeds. | `availability-fabric.mjs`, `fabric-evidence.mjs`, `fabric-stress.mjs` | `AUTHORIZED: PROVE PHASE 3 — NO-CENTRAL-AUTHORITY AVAILABILITY EXERCISED — LAB ONLY` |

Recommended order is a→b→c→d (b and c both consume a's beacon and the same holder/replication seam; d
integrates all three). Each sub-gate is independently reviewable, independently denylist-checked, and writes
**no** ADR until a future `RECORD` gate. Each must keep the suite green and carry its residuals forward,
unclosed.

## D-matrix effect

- **D5 (seed grinding)** — settlement already promoted it to PASS **as a mechanism given a fair beacon**; P3-a
  supplies the beacon **source** and **bounds** the surviving K-of-N grind. D5's residual (K bound ≠ K=1, real
  entropy liveness, sybil cohort) stays **open**, disclosed.
- **D7 (offline-victim liveness)** — settlement promoted the **delegable detection**; P3-b supplies the
  **availability + challenge-window** mechanism. D7's residual (honest-minority assumption,
  partition-past-window) stays **open**, disclosed.
- **O6 (multi-writer)** — P3-c supplies the **mechanism** (shared-log authorship, concurrent convergence,
  offline revocation). Its residual (sybil-resistant quorum, owner reconciliation) is **deferred to Phase 4**.
- **Stays deferred to Phase 4 / Phase 0:** real P2P transport + IP privacy (B6/B7/D11), the M-of-N safety
  quorum + render-gate (the non-central minors-safety concession), and the live pilot — all behind the
  **BLOCKING** Phase 0 counsel ruling.

## Boundary (unchanged from Phase 1/2)

- **Lab-only / prod-denylisted.** Every Phase 3 module lands under `arcade/hiveworld-agents/turf-wars/`,
  inherits the frozen `FORBIDDEN_UPLOAD_PREFIXES` entry, is excluded from the curated upload, is not on
  `PUBLIC_CREATOR_ALLOW`, and is imported by **no** production path (`grep -c turf-wars` in the upload = 0).
  Predicate-based, never count-based.
- **No central authority.** Authority = replay-determinism + the existing delegable one-op fraud-proof. Every
  relay/holder/discovery helper is optional, swappable, and signing-keyless.
- **No new value surface.** No transfer/cash-out/sell/buy/trade/payout/marketplace/ownership/account/login op;
  the only new schema field across the whole plan is a bounded integer beacon height `H_b`. The defender base
  snapshot is never mutated/transferred/deleted; the sole settlement effect stays bounded, reversible,
  self-healing cosmetic scorch on the separate overlay; `attacker_reward` stays bounded non-cash credited to no
  persistent per-player balance (ADR-009).
- **No real transport.** Availability is modeled **deterministically in-process** (seeded peer sets with seeded
  drop/delay/partition), never over a wire; real P2P transport and IP exposure stay gated by Phase 0
  **B6/B7/D11**.
- **Determinism.** Zero-dep pure `.mjs`; `node:crypto` via `canonical.mjs`/`identity.mjs`; one `mulberry32
  lcg(seed)`; no `Date.now` / `Math.random` / wall clock — byte-identical artifact regeneration. `H_b` and the
  challenge window `W` are **logical seq-heights**, never timestamps.
- **Flags & infra.** `LIVE_WORLD_LOADER_ENABLED` stays literally `false`; no Worker/DO/D1/R2/migration/secret/
  config touched; no deploy/upload/Cloudflare mutation.

## Phase 0 / charter (BLOCKING — unchanged)

This plan does **not** supersede the live gameplay charter, does **not** claim counsel approval, charter
override, minors-safety clearance, or production readiness, and does **not** move Phase 0 legal/safety — which
remains **BLOCKING** for any live or minors-facing use. The charter's hard non-goals (raiding / loot / economy
/ ownership / minors-facing UGC) still stand. Phase 3's real P2P transport is specifically blocked by Phase 0
items **B6** (illegal-content propagation in a peer relay), **B7** (takedown with no central server), and
**D11** (IP-address exposure in P2P), all open. No `AUTHORIZED:` sub-gate above may be exercised as anything
but lab-only, and none authorizes live exposure. A future Phase 3 build records its own ADR (carrying these
disclaimers) only at a later `RECORD` gate; **this gate writes no ADR and no code.**
