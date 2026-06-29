# Turf Wars — Phase 4 — Non-central safety gate + red-team — LAB-ONLY PLAN

**Status: PLAN — LAB-ONLY · PLAN-PHASE. No code is written by this gate.** This document is the detailed design behind the roadmap's Phase 4 row ("Non-central safety gate + red-team (lab) — M-of-N signed clearance token + render-gate + gossiped revocation; adversarial red-team; honest residual-risk report", gate `AUTHORIZED: SAFETY MODEL RED-TEAMED + COUNSEL RE-SIGN`). It authorizes nothing live. It does **not** supersede the live gameplay charter, does **not** claim counsel approval, charter override, minors-safety clearance, or production readiness, and does **not** satisfy or substitute for the **Phase 0 legal/safety counsel review, which remains BLOCKING** for any live or minors-facing use. The eventual Phase 4 safety layer stays lab-only and prod-denylisted exactly like the Phase 1 substrate (ADR-050), the Phase 2 foundation (ADR-051) and settlement layer (O1/O2), and the Phase 3 availability fabric.

> This is a **design + lab-mechanism plan**, written to the project research-evidence rule: it separates what a lab **would prove** (the deterministic MECHANISM) from what it **assumes/defers** (the RESIDUALS), and states a **falsifier** for each residual. Phase 4 is the **minors-safety layer**. The safety *policy* — the values of M and N, who counts as a vetted reviewer, what content counts as "cleared", what exactly the render-gate blocks, what a takedown legally requires — is a **COUNSEL-DEFINED INPUT, not an engineering choice**. This plan never claims that a working mechanism equals safety.

---

## Context — what Phase 4 is

### The roadmap's 4-layer safety design

Turf Wars' minors-safety posture is a stacked, fail-closed defense (roadmap, "the 4-layer safety design"). Phase 4 builds layers 3 and 4; layers 1 and 2 are structural properties already enforced by the closed-vocabulary creator pipeline and the validator's `FORBIDDEN_TERMS_RE` boundary:

1. **Closed-vocabulary by construction** — data-only, enum tokens; no free text, URLs, images, or arbitrary JS. (Already enforced upstream.)
2. **No P2P chat / DMs / free text** — crew comms are canned tokens only. (Already enforced upstream.)
3. **Dark-by-default client render-gate** (Phase 4) — the client refuses to *draw* any snapshot lacking a valid, hash-bound, non-revoked, fresh M-of-N clearance token for that exact content hash. **Deny-by-default, fail-closed.**
4. **Signed moderation as a non-central M-of-N quorum** (Phase 4) — the CF-8 review queue + Consent Anchor pattern generalize from a single operator to *k-of-n* vetted reviewer keys issuing a signed, revocable, hash-bound "cleared for minors-facing visibility" token; revocation propagates as a signed gossip op; default visibility is **opt-in / default-deny**.

### This is the minors-safety layer

Phases 1–3 produced the **authority substrate**: replay-determinism plus the delegable one-op fraud-proof (`settlement.mjs:110-123`), the availability fabric, and the multi-writer convergent overlay with **keyless, quorum-free** fraud-proof revocation (`overlay-dag.mjs:104-123`). That revocation is correct *because the authority source is the pure function `proveFraud`, not the revoker's identity* — any honest peer recomputes the same verdict byte-for-byte. Phase 4 does **not** touch that path.

Phase 4 adds the orthogonal layer that the substrate deliberately left open: a **safety/takedown** decision is a *policy assertion* ("this content should not be rendered in minors-facing contexts"), not a re-derivable computation. No pure function can produce it; it requires a vetted human judgment. That asymmetry is the whole reason Phase 4 needs a *quorum of signing keys* where Phase 3 needed *none*.

### What Phase 4 closes, and what it explicitly does not

Phase 4 closes the **owner-reconciliation residual** Phase 3 deferred (`fabric-evidence.mjs:216`: `'sybil-resistant revocation quorum + owner reconciliation (Phase 4)'`) and adds the **safety/sybil layers** the substrate never had:

- **P4-a** — the M-of-N signed clearance token (generalizes the single-operator CF-8 clearance model into a k-of-n threshold of vetted reviewer keys).
- **P4-b** — the dark-by-default client render-gate (a pure, fail-closed `renderDecision` predicate).
- **P4-c** — the sybil-resistant **clearance**-revocation quorum (a *new, key-gated* revocation kind, kept permanently separate from the Phase 3 keyless fraud-proof revocation).
- **P4-d** — owner reconciliation after third-party revocation (a deterministic, referee-free fold the returning offline owner runs, identical to any watcher peer).

**The lab proves MECHANISM; counsel defines POLICY.** Every component below states, in its own words, exactly where that line falls. A correctly-implemented M-of-N predicate is not a safety guarantee: an M of 1 is a single-operator gate, an N of 1 is not a quorum, a `max_age` of MAX_INT is no freshness bound, and a colluding sub-quorum at threshold can authorize harmful content. The mechanism enforces a predicate over whatever policy values counsel supplies; it cannot choose safe values, and it does not pretend to.

---

## The seams Phase 4 plugs into (verified, unchanged)

Phase 4 **wires proven parts, not net-new invention.** It reuses, without modifying, the deny-by-default safety/approval infrastructure already shipped:

- **`/arcade/creator/approval/approved-loader.mjs`** (CF-2 double-lock): `LIVE_WORLD_LOADER_ENABLED = false` is a module constant (line 31); the first check rejects live mode if the flag is not enabled (line 53); the second check requires the receipt itself to say `operator_approved_local` (line 75) — even a flipped flag fails a receipt that does not carry local approval. Phase 4's render-gate is the **same structural shape**: two independent checks that must both pass, either of which fails closed.
- **`/arcade/creator/moderation/review-queue.mjs`** (CF-8 human review): a deny-by-default approval-state machine, a `freeTextDigest` binding (lines 62-65), and an append-only, **hash-chained, tamper-evident audit trail** (lines 173-197). `live_world_authorized` is hard-coded `false` on every record (line 109) and is never input-settable. Phase 4's quorum token state machine (`pending → partial → cleared → revoked`) and signed revocation log are modeled on this chain.
- **`/arcade/creator/hive-validation/hive-service.mjs`** (CF-6 validation service): emits a hash-bound verdict (`valid|invalid`) with **hard invariants** `status: 'local_validation_only'`, `live_world_authorized: false`, `content_cleared: false` (lines 66-70). Its keystone principle (lines 13-14): **"Decentralizing REVIEW must never decentralize TRUST by default."** Phase 4 encodes this directly: each reviewer is a **credential issuer, not a voter**; the validator runs first and its verdict hash is bound into the token; automated validation is **not** clearance — clearance requires human attestation on top, and finality lives only in the M-of-N threshold + revocation, never in any single reviewer.

Phase 4 also reuses the Phase 1–3 deterministic substrate verbatim: `identity.mjs` (`identityFromSeed`, lines 60-66; player-ID derivation, lines 43-45), `canonical.mjs` (`sha256(canonicalize(value))`, lines 22, 37-39), `challenge-window.mjs` (`CHALLENGE_WINDOW_HEIGHTS`, line 33), `availability.mjs` (the Mulberry32 `lcg(seed)` family, lines 34-42), `overlay-dag.mjs` (the dual-Set dedup fold, lines 162-174), `settlement.mjs` (`proveFraud`, lines 110-123), and `fabric-evidence.mjs` (the frozen `LAB_MODULE_PATHS` + `isExcludedFromUpload` denylist self-check / claim F0, lines 59, 198-201).

---

## P4-a — M-of-N non-central safety quorum (signed clearance token)

### Goal

Generalize the single-operator CF-8 review-queue clearance model into a k-of-n threshold of vetted reviewer keys, where no single reviewer can authorize visibility, and a valid clearance token requires exactly M-of-N independent Ed25519 signatures over an identical content hash. The mechanism is parameterized: M, N, and the set of enrolled reviewer public keys are COUNSEL-DEFINED inputs supplied at lab instantiation. The design proves only the enforcement predicate — it does not define safety policy.

### Lab mechanism

**Module to create:** `turf-wars/quorum-clearance.mjs`

Depends on existing modules (no new external dependencies):

- `/arcade/hiveworld-agents/turf-wars/identity.mjs` — `identityFromSeed(label)`, `PLAYER_ID_RE`, deterministic Ed25519 derivation (identity.mjs:60-66, 43-45). All reviewer fixture keys in the lab are derived from `identityFromSeed('reviewer-N')` for N in {0..N_MAX}. No random key generation.
- `/arcade/creator/approval/approved-loader.mjs` — the double-lock render-gate pattern (lines 31, 53, 75). The clearance token is the additional credential the loader would check; `LIVE_WORLD_LOADER_ENABLED` remains literally `false` throughout P4-a; the render-gate wiring is design-only at this sub-gate.
- `/arcade/creator/moderation/review-queue.mjs` — the hash-chained audit trail and `freeTextDigest` binding (lines 62-65, 173-197). The quorum token record mirrors the review-queue state machine: `pending` -> `partial` (0 < votes < M) -> `cleared` (votes >= M) -> `revoked`. Each reviewer signature is an entry in the chain; the chain is the audit log.
- `/arcade/creator/hive-validation/hive-service.mjs` — the validation/approval separation principle (lines 13-14, 66-70). The validator runs first and its verdict hash is bound into the clearance token; a reviewer's signature attests the validator passed, not the reviewer's own content judgment. Automated validation is NOT clearance; clearance requires human attestation on top.
- `canonical.mjs:22, 37-39` — `sha256(canonicalize(value))` for all content addressing. The token's `content_hash` field and the `token_id` are both produced by this function. Byte-identical across all peers.
- `overlay-dag.mjs` dual-Set dedup pattern (lines 162-174) — the quorum token store uses the same `appliedTokens` + `rejectedTokens` Set pair to make duplicate or redelivered token parts idempotent.
- `availability.mjs:34-42` lcg family — all deterministic fixture generation (reviewer key seeds, package content seeds) uses the same Mulberry32 lcg; no `Math.random()` or `Date.now()` anywhere in the module.

**Token structure (pure data, no execution):**

```
ClearanceToken {
  token_id:         sha256(canonicalize({ content_hash, quorum_public_keys, min_signers }))
  content_hash:     sha256(canonicalize(package))   // from canonical.mjs; binds exact bytes
  validator_hash:   sha256(canonicalize(validatorVerdict))  // hive-service verdict bound in
  quorum_public_keys: [pubkey_hex, ...]              // N enrolled reviewer keys; ordered, deduplicated
  min_signers:      M                                // threshold; COUNSEL-DEFINED input
  signatures: [
    {
      reviewer_id:   "tw1:" + sha256(pubkey)[:32]   // identity.mjs derivation
      pubkey_hex:    string
      sig_hex:       string   // Ed25519 signature over sha256(canonicalize({ token_id, reviewer_id, seq }))
      seq:           integer  // reviewer's local monotonic counter; prevents replay within same quorum
    }, ...
  ]
  issued_logical_height: integer  // from challenge-window.mjs logical seq-height; NOT wall-clock
  max_age_heights:       integer  // COUNSEL-DEFINED freshness bound; token stale after this many heights
  revoked:               false    // mutable only by a valid revocation entry (see P4-c)
}
```

**Key predicates (pure functions, deterministic, zero side-effects):**

`verifyClearanceToken(token, enrolledKeys, M, currentHeight) -> { valid: bool, reason: string }`

Fold logic:

1. Recompute `token_id` from `{ content_hash, quorum_public_keys, min_signers }` using `canonical.mjs`; reject if mismatch.
2. Assert `token.quorum_public_keys` is a subset of `enrolledKeys`; reject any signature whose `pubkey_hex` is not in the enrolled set.
3. For each entry in `token.signatures`: verify Ed25519 signature over `sha256(canonicalize({ token_id, reviewer_id, seq }))` using the matching enrolled key. Collect the set of distinct `reviewer_id` values with valid signatures.
4. Assert `|distinct valid reviewer_ids| >= M`; reject if threshold not met.
5. Assert `currentHeight - token.issued_logical_height <= token.max_age_heights`; reject if stale.
6. Assert `token.revoked === false`; reject if revoked.
7. Return `{ valid: true }` only when all six assertions pass; otherwise `{ valid: false, reason: <specific failing assertion> }`.

`addReviewerSignature(token, reviewerIdentity, seq) -> ClearanceToken`

Immutable update (mirrors the coding-style immutability rule): returns a new token record with the reviewer's signature appended. Does not mutate the input. The reviewer signs `sha256(canonicalize({ token_id, reviewer_id, seq }))` using their Ed25519 private key. The result is a partial token until `|distinct valid reviewer_ids| >= M`.

`isClearedForVisibility(token, enrolledKeys, M, currentHeight, revokedSet) -> bool`

Composes `verifyClearanceToken` with a lookup into `revokedSet` (a Set of `token_id` values, the same dual-Set dedup pattern from `overlay-dag.mjs`). Returns `true` only when the token is structurally valid, threshold-met, fresh, and not in `revokedSet`. This is the predicate the render-gate (P4-b) will call.

`defaultVisibility(token, enrolledKeys, M, currentHeight, revokedSet) -> 'visible' | 'dark'`

Returns `'dark'` on any failure mode: missing token, invalid token, threshold not met, stale, revoked. Returns `'visible'` only on `isClearedForVisibility === true`. Default is `'dark'`; visibility is opt-in and must be earned by a valid threshold clearance.

**Evidence harness:** `turf-wars/quorum-evidence.mjs`

Mirrors the structure of `fabric-evidence.mjs`: defines a frozen `LAB_MODULE_PATHS` array covering all new P4-a modules, runs `isExcludedFromUpload` and `!PUBLIC_CREATOR_ALLOW.has(p)` self-checks on each path (claim F0 boundary proof), then runs the deterministic test scenarios below.

### What the lab PROVES

The lab proves the following claims about the deterministic mechanism, no more:

1. `verifyClearanceToken` accepts a token if and only if it carries at least M distinct valid Ed25519 signatures from the enrolled key set, was issued within `max_age_heights` logical heights of the current height, and has not been revoked.
2. A token with fewer than M valid signatures is rejected regardless of how many total signature entries are present (duplicate reviewer or non-enrolled key cannot cross the threshold).
3. A stale token (age > `max_age_heights`) is rejected deterministically by the freshness assertion, independently of signature count.
4. All fixture reviewer identities are regenerated byte-identically from `identityFromSeed('reviewer-N')` across independent lab runs (no randomness).
5. Duplicate or redelivered partial token signatures are idempotent (the dual-Set dedup pattern from `overlay-dag.mjs` prevents the threshold from being crossed by redelivery).
6. No P4-a module is reachable from the curated prod upload (LAB_MODULE_PATHS denylist self-check passes — claim F0).
7. `LIVE_WORLD_LOADER_ENABLED` remains `false` (the lab module does not read or alter it).

The lab does NOT prove: sybil resistance of the enrolled key set, gossip propagation of revocation (P4-c), client render-gate enforcement (P4-b), legal sufficiency of the quorum for any jurisdiction, or that M-of-N threshold prevents harm in a real network.

### Deferred residuals + falsifiers

**R-a1 — Enrolled key set sybil resistance.** The mechanism enforces k-of-n over a given enrolled set but cannot prevent a single actor from enrolling multiple reviewer keys if key enrollment has no cost or identity binding. M-of-N becomes meaningless if one entity controls M keys.
FALSIFIER: Construct a lab fixture where one `identityFromSeed` owner generates M distinct reviewer keys, populates all M signatures, and call `verifyClearanceToken`; it returns `valid: true` despite one real actor. This is the admitted breach.

**R-a2 — Revocation freshness + gossip latency.** The `max_age_heights` window is a logical height bound, not a wall-clock bound. A client that has not received recent blocks cannot distinguish a stale token from a fresh one if its local height counter is behind.
FALSIFIER: Simulate a client whose `currentHeight` is frozen at the token's `issued_logical_height` (partition); `verifyClearanceToken` returns `valid: true` indefinitely because the staleness check is `currentHeight - issued >= max_age_heights` and a frozen height never triggers it.

**R-a3 — Revocation propagation gap.** A revoked token is rejected only if the local `revokedSet` contains its `token_id`. A client that has not yet received the revocation gossip renders content it should not.
FALSIFIER: Issue a valid token, add its `token_id` to a revocation set, call `isClearedForVisibility` with an empty `revokedSet`; it returns `true` despite revocation. The gap is the propagation window.

**R-a4 — Render-gate bypassed by patched client.** `defaultVisibility` is a pure function that a cooperating client runs. A patched client binary ignores it entirely and renders any snapshot.
FALSIFIER: This cannot be demonstrated within the lab module; it is a deployment-layer falsifier. The honest-report (P4-d integration) must state it explicitly. Publishing-side filtering (gossiping only cleared snapshots) is the complementary control, but it is also bypassable at the transport layer.

**R-a5 — Counsel-defined policy inputs (M, N, enrolled set, max_age_heights, "what is cleared").** The mechanism is parameterized. The safety outcome depends entirely on the values of these parameters. An M of 1 is a single-operator gate. An N of 1 is not a quorum. A `max_age_heights` of MAX_INT is no freshness bound.
FALSIFIER: Call `verifyClearanceToken` with M=1, N=1, a single enrolled key, and a single valid signature; it returns `valid: true` and the entire quorum collapses to a single-authority model. The values are COUNSEL-DEFINED inputs; the mechanism cannot enforce their safety.

**R-a6 — "Cleared" does not mean "safe."** A token attests that M reviewers attested the content at a specific hash. It does not attest that the content is legally compliant, developmentally appropriate, or free of harm in every jurisdiction.
FALSIFIER: This is not a code falsifier; it is the honest acknowledgement that mechanism != safety policy. Phase 0 counsel must define what "cleared for minors-facing visibility" legally requires (A1–A4, B5–B7 in the Phase 0 checklist).

### Red-team cases

The evidence harness (`quorum-evidence.mjs`) must exercise all of the following deterministically:

**RT-a1 — Forged token (non-enrolled key signs).** Generate a key via `identityFromSeed('attacker')` not in `enrolledKeys`. Construct a token with M signatures all from this key. Assert `verifyClearanceToken` returns `{ valid: false, reason: <non-enrolled key> }`.

**RT-a2 — Insufficient signature count.** Construct a token with M-1 valid enrolled signatures. Assert `verifyClearanceToken` returns `{ valid: false, reason: <threshold not met> }` regardless of whether the partial signers are valid.

**RT-a3 — Duplicate reviewer inflating count.** Construct a token where the same enrolled reviewer appears M times (same `reviewer_id`, different `seq` values, all valid signatures). Assert that the distinct-reviewer-id check reduces this to a count of 1, not M, and the token is rejected.

**RT-a4 — Replayed old token (staleness).** Issue a token at `issued_logical_height = 0` with `max_age_heights = 8` (matching `CHALLENGE_WINDOW_HEIGHTS` from `challenge-window.mjs:33`). Call `verifyClearanceToken` at `currentHeight = 9`. Assert rejection with `{ valid: false, reason: <stale> }`.

**RT-a5 — Revoked token with valid signatures.** Issue a valid M-of-N token, add its `token_id` to `revokedSet`. Call `isClearedForVisibility`. Assert `false` regardless of signature validity or freshness.

**RT-a6 — Content hash mismatch (token does not match package).** Compute a valid clearance token for `package_A`. Change one byte to produce `package_B`. Recompute `content_hash` for `package_B`. Assert that `verifyClearanceToken` with the original token and the recomputed hash yields `{ valid: false, reason: <token_id mismatch> }` because `token_id` is bound to the original `content_hash`.

**RT-a7 — Colluding sub-quorum below threshold.** With M=3, N=5: construct a token where reviewers {0,1} collude, both sign, but reviewer {2} does not. Assert threshold not met.

**RT-a8 — Colluding sub-quorum at threshold.** With M=3, N=5: construct a token where reviewers {0,1,2} collude, all sign, and the content violates `FORBIDDEN_TERMS_RE`. Assert the mechanism accepts the token (the colluding quorum crossed the threshold). This RT-a8 is an **ADMITTED BREACH**: it documents that a sufficiently large colluding group of enrolled reviewers can authorize harmful content. The honest-report (P4-d integration) must state this as a residual requiring the counsel-defined enrollment vetting process to be the **outer** control, not the mechanism itself.

**RT-a9 — Token id recomputation mismatch (tampered quorum_public_keys).** Take a valid token. Replace `quorum_public_keys[0]` with an attacker key. Recompute nothing else. Assert `verifyClearanceToken` fails at the `token_id` recomputation check (step 1 of the fold).

**RT-a10 — Zero enrolled keys.** Call `verifyClearanceToken` with an empty `enrolledKeys` array and M=0. Assert rejection. The mechanism must not permit a vacuously true clearance from an empty quorum.

### Boundary + Phase 0 dependency

**What stays lab-only at this sub-gate:**

- `quorum-clearance.mjs` and `quorum-evidence.mjs` are added to the frozen `LAB_MODULE_PATHS` denylist and verified by the evidence harness self-check (claim F0). They are not in `PUBLIC_CREATOR_ALLOW` and are excluded from curated prod upload by the existing `isExcludedFromUpload` check.
- `LIVE_WORLD_LOADER_ENABLED` remains literally `false` in `approved-loader.mjs`. P4-a does not touch it.
- No Worker, Durable Object, D1, R2, KV, or Cloudflare deployment artifact is produced.
- No wall-clock time (`Date.now()`), no `Math.random()`, no network I/O, no account or login system.
- The values of M, N, `max_age_heights`, and the enrolled reviewer key set are lab fixture constants only. They are not operator-tunable runtime parameters at this sub-gate. Parameterization is the design; the lab instantiates them with specific fixture values to exercise the predicate.

**What counsel must define before P4-a (or any Phase 4 sub-gate) is used in a live or minors-facing context:**

- A1/A2: Age assurance and parental consent mechanism compatible with a keypair-only design. P4-a's `defaultVisibility` defaults to `'dark'` (deny-by-default) but cannot enforce age-gating without a verifiable age signal, which does not exist in the current architecture.
- A3/A4: Whether M-of-N render-gate + token revocation is a legally sufficient control for minors-facing P2P content. The mechanism proves the predicate; sufficiency is a legal question.
- B5: Whether closed-vocabulary-only packages exempt P4-a from open-ended-UGC regulatory obligations. The validator runs first but cannot substitute for a regulatory ruling.
- B6/B7: What controls are legally required for illegal content propagation in peer relay, and whether render-gate revocation (without central-server hard-delete) satisfies takedown obligations.
- E13: Charter override authorization. The gameplay charter bans a defined set of terms; the clearance token cannot authorize a package that violates `FORBIDDEN_TERMS_RE`. If counsel rules a charter-superseding ADR is required for any extension of what is "clearable," that ADR must be in place before any reviewer exercises their key on non-charter content.
- Enrollment policy: who qualifies as a vetted reviewer, what the identity-cost or vetting process is, and what M and N must be for each content category. These are the outer controls that make the inner mechanism meaningful. The lab proves the predicate over whatever enrollment policy counsel defines; it does not choose the policy.

**Phase 4 BUILD gate (separate, future):** A separate `AUTHORIZED: BUILD PHASE 4a — SAFETY QUORUM — LAB ONLY` line from the operator is required before any code is written. This PLAN does not constitute that authorization. Phase 0 counsel remains BLOCKING for any live or minors-facing use. The mechanism and the safety claim are not the same thing, and this document does not conflate them.

---

## P4-b — Dark-by-default client render-gate

### Goal

Design a deterministic, fail-closed predicate that a client runs before drawing any Turf Wars snapshot. The predicate answers a single yes/no question: does this content hash carry a valid, non-revoked, fresh M-of-N clearance token? If the answer is anything other than a confident yes, the client renders nothing — it goes dark. The mechanism is a pure function over local state; it never calls out at draw time. This document describes that mechanism. It does not claim the mechanism equals safety.

### Lab mechanism

**Design identity.** The render-gate is a single pure function `renderDecision(contentHash, tokenStore, revocationStore, clockHeight)` that returns one of three enum values: `DRAW`, `DARK_NO_TOKEN`, or `DARK_REVOKED`. No other return value is possible. The function has no side effects, no I/O, and no wall-clock access. `clockHeight` is a logical sequence-height integer threaded in from the same deterministic counter already used by `challenge-window.mjs` and `availability.mjs`, NOT `Date.now()`.

**Existing modules and patterns this reuses.**

- `approved-loader.mjs` (double-lock pattern, lines 31, 53, 75): the render-gate borrows the same structural shape — two independent checks that must both pass, either of which can fail closed. Here the analogue is: (1) a clearance token exists for this exact `contentHash`, AND (2) the token has not been revoked and its freshness window has not expired. Failing either collapses to dark.
- `identity.mjs` (`identityFromSeed`, lines 60-66; player ID derivation, lines 43-45): all reviewer key fixtures in the lab harness are derived from `identityFromSeed(label)`. No random key generation. The token's reviewer signatures are Ed25519, same as the existing turf-wars identity fabric.
- `canonical.mjs` (`contentAddress`, lines 37-39; `canonicalize`, line 22): the clearance token is bound to `contentAddress(snapshot)` — SHA-256 of canonical JSON. A one-byte change to the snapshot produces a different hash and invalidates the existing token. The render-gate compares this hash directly; no looser matching is permitted.
- `challenge-window.mjs` (`CHALLENGE_WINDOW_HEIGHTS`): the max-age expiry of a clearance token is expressed in the same logical-height units as the challenge window. The lab adopts a separate constant `RENDER_GATE_MAX_AGE_HEIGHTS` (a positive integer; its value is a policy input, not an engineering choice — see Deferred Residuals below). Freshness check: `clockHeight - token.issuedAtHeight <= RENDER_GATE_MAX_AGE_HEIGHTS`.
- `overlay-dag.mjs` dual-Set dedup pattern (lines 162-174): the revocation store uses the same `appliedRevokes` + `rejectedRevokes` dual-Set structure. A revocation delivered twice is a no-op. A revocation that fails signature verification goes to `rejectedRevokes` and is logged as evidence but does not affect draw decisions.
- `review-queue.mjs` hash-chained audit trail (lines 173-197): each revocation entry appended to the client's local log is entry-hashed and prev-linked, mirroring the CF-8 audit chain. The lab harness verifies chain integrity as part of the evidence pack.
- `fabric-evidence.mjs` frozen `LAB_MODULE_PATHS` + denylist self-check (lines 59, 198-201): the Phase 4-b evidence pack defines its own frozen `LAB_MODULE_PATHS_P4B` array. The evidence pack asserts `isExcludedFromUpload(p)` for every path in that array before reporting green (claim F0 analogue for Phase 4-b).

**Key function and type signatures the build would add (names, not implementations).**

```
// Enum (no behaviour, data only)
RenderVerdict ::= 'DRAW' | 'DARK_NO_TOKEN' | 'DARK_REVOKED'

// Core predicate — pure, deterministic, no I/O
renderDecision(
  contentHash: string,          // canonical SHA-256 hex of the snapshot
  tokenStore: Map<contentHash, ClearanceToken>,
  revocationStore: RevocationStore,
  clockHeight: number           // logical seq-height, no wall-clock
) -> RenderVerdict

// Clearance token structure (schema, not encoding)
ClearanceToken {
  contentHash: string,          // bound field — identifies exact snapshot
  issuedAtHeight: number,       // logical height at which k-of-n threshold was crossed
  reviewerSignatures: Array<{ reviewerPubkeyHex: string, sigHex: string }>,
  // count of valid signatures >= policy threshold M is verified at check time, not stored
}

// Revocation entry structure (mirrors overlay-dag revocation entry shape)
RevocationEntry {
  contentHash: string,
  revokerPubkeyHex: string,
  sigHex: string,
  revokedAtHeight: number,
  prevEntryHash: string,        // hash-chained; first entry uses zero hash
}

// Revocation store (dual-Set dedup, append-only log)
RevocationStore {
  applied: Set<contentHash>,
  rejected: Set<contentHash>,
  log: Array<RevocationEntry>,  // hash-chained
}

// Token verification helper (called inside renderDecision)
verifyToken(
  token: ClearanceToken,
  reviewerRegistry: Map<pubkeyHex, ReviewerRecord>,
  thresholdM: number,
  thresholdN: number,
  clockHeight: number,
  maxAgeHeights: number
) -> { valid: boolean, reason: string }
```

**The `renderDecision` predicate fold (prose, not code).** The function evaluates three gates in order, stopping at the first failure:

1. Token existence: look up `contentHash` in `tokenStore`. If absent, return `DARK_NO_TOKEN`.
2. Token validity: call `verifyToken`. This checks that at least M of the token's reviewer signatures are (a) present in the reviewer registry and (b) produce a valid Ed25519 signature over `contentHash || issuedAtHeight`, AND that `clockHeight - token.issuedAtHeight <= RENDER_GATE_MAX_AGE_HEIGHTS`. If either subcheck fails, return `DARK_NO_TOKEN` (stale or invalid token is treated identically to an absent token — no distinction exposed to the caller).
3. Revocation check: look up `contentHash` in `revocationStore.applied`. If present, return `DARK_REVOKED`.
4. All gates passed: return `DRAW`.

There is no `DRAW_WITH_WARNING` or partial state. The only affirmative return is `DRAW` after all three gates pass.

### What the lab PROVES

Precisely and modestly: the lab proves that the pure function `renderDecision`, given the described inputs, enforces the deny-by-default predicate deterministically. Specifically:

- A snapshot with no token in `tokenStore` always produces `DARK_NO_TOKEN`, regardless of other state.
- A snapshot with a token whose revocation entry appears in `revocationStore.applied` always produces `DARK_REVOKED`, regardless of token validity.
- A snapshot whose token carries fewer than M valid reviewer signatures always produces `DARK_NO_TOKEN`.
- A snapshot whose token's `issuedAtHeight` is more than `RENDER_GATE_MAX_AGE_HEIGHTS` behind `clockHeight` always produces `DARK_NO_TOKEN`.
- A snapshot meeting all three positive gates always produces `DRAW`.
- The revocation store's dual-Set dedup guarantees that replaying the same revocation entry is a no-op and does not alter the audit log length beyond the first delivery.
- The hash-chained revocation log detects any retrospective tampering with a prior entry (the chain breaks).
- The denylist self-check asserts no Phase 4-b lab module path appears in the curated upload (claim F0 analogue).

The lab does NOT prove: that patched clients respect this predicate (they do not have to), that the reviewer registry is sybil-resistant, that the gossip transport delivers tokens or revocations before a draw attempt, or that the freshness window is legally adequate for any jurisdiction.

### Deferred residuals + falsifiers

**R-b1 — Patched-client bypass.** Any client-side gate is bypassable by a client that omits the check. The lab mechanism is sound for honest clients; it is not enforcement against a modified binary. Publishing must ALSO restrict gossip to approved-snapshot hashes only, so a patched client that bypasses the render-gate still only receives snapshots that passed the clearance process. Whether that dual control (render-gate + gossip restriction) is legally sufficient is exactly Phase 0 question Q9.
FALSIFIER: a harness that patches `renderDecision` to always return `DRAW` and confirms that a snapshot without a valid token is drawn, reported as a disclosed bypass-witness in the evidence pack (mirroring Phase 3's `runPartitionPastWindow` disclosure).

**R-b2 — Gossip latency vs. offline play.** A client that has not received a revocation entry yet will draw a snapshot that has been revoked. The freshness window (`RENDER_GATE_MAX_AGE_HEIGHTS`) sets an upper bound on how stale a clearance can be before it expires on its own, but during that window an undelivered revocation is invisible to the gate. The width of that window and whether it is legally tolerable is a counsel-defined policy input, not an engineering choice.
FALSIFIER: a harness that delivers a revocation after the client has already called `renderDecision` and confirms the gate passed (drew), then confirms subsequent calls after the revocation is ingested return `DARK_REVOKED`.

**R-b3 — Reviewer quorum sybil resistance.** The M-of-N threshold is enforced, but the reviewer registry that backs it has no sybil-cost mechanism in Phase 4-b. An attacker who compromises or fabricates M reviewer keys can issue a fraudulent clearance token. How reviewer identities are made sybil-resistant (stake, proof-of-work, operator-signed roster) is Phase 4-a/P4-c's concern and remains open at Phase 4-b scope.
FALSIFIER: a harness that inserts M fabricated reviewer keypairs into the reviewer registry and verifies that `renderDecision` returns `DRAW` for a snapshot with a token signed by those fabricated keys — confirming the gate does not itself detect sybil identities and that sybil resistance must come from the registry layer.

**R-b4 — Counsel-defined policy inputs.** The values of M, N, `RENDER_GATE_MAX_AGE_HEIGHTS`, the definition of "cleared for minors-facing visibility", and what content categories the gate blocks are all policy inputs. The mechanism is agnostic to their values; the lab harness parameterizes them. Counsel must define them before any live use.
FALSIFIER: not applicable as a technical experiment — this residual is disclosed as a governance dependency, not a mechanical one.

**R-b5 — Token revocation finality gap.** Revocation is signed and gossiped, but there is no global consensus on when a revocation has "fully propagated". A client that accepted a `DRAW` verdict before a revocation arrived has already rendered content that is now revoked. The render-gate cannot retroactively un-draw. Whether this constitutes a harmful exposure and what mitigation (re-render on revocation receipt, black-screen overlay on live revocation) counsel requires is a Phase 0 B7 question.
FALSIFIER: a harness that calls `renderDecision` (returns `DRAW`), then injects a revocation, then calls again (returns `DARK_REVOKED`), demonstrating the gap between the two calls is a window of unblocked rendering.

### Red-team cases

The Phase 4-b evidence pack must exercise all of the following as discrete named test runs, each reporting PASS/FAIL with evidence:

1. **No token — always dark.** Submit a snapshot with no entry in `tokenStore`. Assert `DARK_NO_TOKEN` on every call regardless of revocation store state.
2. **Revoked token — always dark.** Insert a valid clearance token, confirm `DRAW`, then inject a valid revocation entry for the same content hash. Assert subsequent call returns `DARK_REVOKED`. Repeat with revocation arriving before token — assert `DARK_REVOKED`.
3. **Insufficient reviewers.** Construct a token with M-1 valid reviewer signatures and additional fabricated or unknown signatures. Assert `DARK_NO_TOKEN`.
4. **Stale token.** Construct a token with `issuedAtHeight = 0` and call `renderDecision` with `clockHeight = RENDER_GATE_MAX_AGE_HEIGHTS + 1`. Assert `DARK_NO_TOKEN`.
5. **One-byte content hash mutation.** Produce a valid token for hash H. Call `renderDecision` with hash H' (H with one hex digit changed). Assert `DARK_NO_TOKEN`. This confirms content-address binding.
6. **Revocation dedup (dual-Set).** Deliver the same revocation entry three times. Assert the revocation log length increments exactly once and subsequent deliveries are no-ops.
7. **Revocation chain tamper detection.** Build a revocation log of length 3. Mutate the second entry's `prevEntryHash`. Assert the chain-integrity verifier flags the breach.
8. **Patched-gate bypass witness (disclosed).** Instrument the evidence pack with a variant that skips the `renderDecision` call entirely and records that the snapshot is drawn without a token. Report this as a disclosed bypass-witness, not a failure of the mechanism. This is the explicit red-team disclosure mirroring `runPartitionPastWindow`.
9. **Fabricated reviewer sybil witness (disclosed).** Register M fabricated keypairs in the reviewer registry. Issue a token signed by those keys. Assert `renderDecision` returns `DRAW`. Report as a disclosed sybil-registry-bypass witness confirming sybil resistance must live in the registry layer (P4-a/P4-c), not in the gate predicate.
10. **Revocation-after-draw gap witness (disclosed).** Call `renderDecision` (returns `DRAW`). Inject revocation. Call again (returns `DARK_REVOKED`). Record the gap as a disclosed finality-gap witness.
11. **Denylist self-check.** Assert `isExcludedFromUpload(p)` for every path in the frozen `LAB_MODULE_PATHS_P4B` array. Assert `!PUBLIC_CREATOR_ALLOW.has(p)` for each. This is claim F0 for Phase 4-b.
12. **LCG determinism check.** Seed the lab harness with a fixed integer. Run the full token-issuance and revocation sequence. Re-run from the same seed. Assert byte-identical outputs. This confirms the harness uses the same `lcg(seed)` family from `availability.mjs:34-42` and introduces no `Math.random()` or `Date.now()`.

### Boundary + Phase 0 dependency

This is a docs-only design plan. No code is written at this gate. Phase 4-b BUILD is a separate future gate requiring its own `AUTHORIZED:` line. All of the following remain unchanged:

- `LIVE_WORLD_LOADER_ENABLED` stays literally `false` in `approved-loader.mjs`. The render-gate mechanism described here does not flip that constant, does not modify `approved-loader.mjs`, and does not grant any package live-world authority.
- No Worker, Durable Object, D1 binding, R2 bucket, Cloudflare service, migration, secret, or deployment is touched.
- No accounts, login, sessions, age-assurance mechanism, parental-consent flow, or personal data collection is introduced.
- No economy surface (IAP, transfer, cash-out, marketplace, player-to-player trade, wager, ownership) is introduced.
- No chat, free text, URLs, images, or arbitrary JS is introduced. The closed-vocabulary constraint from the gameplay charter (`FORBIDDEN_TERMS_RE`) stays in force. A clearance token cannot authorize a package that violates the charter vocabulary boundary; the validator runs before the clearance is even considered.
- All lab modules are pure zero-dependency `.mjs` files. No `Date.now()`, `Math.random()`, or wall-clock access in core logic. One `lcg(seed)` family, matching `availability.mjs:34-42`. All fixtures use `identityFromSeed(label)` from `identity.mjs:60-66`.
- The authority model is unchanged: replay-determinism plus the delegable one-op fraud-proof from `settlement.mjs:110-123`. The render-gate is additive evidence; it does not replace or supersede that authority model.

**What counsel must define before any live or minors-facing use:** the values of M and N and what makes a reviewer eligible (Phase 0, A4); the width of `RENDER_GATE_MAX_AGE_HEIGHTS` and whether token-expiry-without-renewal is an adequate takedown mechanism (Phase 0, B7); whether the dual control (render-gate + gossip restriction to approved hashes) is a legally sufficient substitute for a central content-removal authority under UK AADC / COPPA / GDPR-K (Phase 0, A1–A3, B5–B7); whether the patched-client bypass residual (R-b1) requires additional enforcement controls (Phase 0, Q9); and whether the revocation-after-draw gap (R-b5) is a harmful exposure window requiring retroactive mitigation (Phase 0, B7).

**Phase 4 BUILD gate (separate, future):** `AUTHORIZED: BUILD PHASE 4b — DARK-BY-DEFAULT RENDER-GATE — LAB ONLY`. A charter-superseding ADR citing a written counsel ruling is required before Phase 4-b leaves lab status.

---

## P4-c — Sybil-resistant revocation quorum

### Goal

Phase 3's revocation mechanism is deliberately keyless and quorum-free: any peer re-runs `proveFraud` and the deterministic output is its own authority. That design is correct for fraud-proof revocation because the authority source is the pure function, not the revoker's identity.

Safety/takedown revocation of a clearance token is structurally different. It is a policy assertion — "this content should not be rendered in minors-facing contexts" — not a re-derivable computation. No pure function can produce that conclusion; it requires a vetted human judgment. This means two things follow:

1. A flood of fake peer identities can neither forge a legitimate fraud-proof revocation (proveFraud is deterministic; a false mismatch doesn't exist) nor block one (any honest peer suffices). Sybil attacks on fraud-proof revocation are already closed.
2. A flood of fake peer identities CAN attack clearance-revocation in two directions: (a) forge a takedown to censor a legitimately cleared block, or (b) drown/block a legitimate safety takedown by flooding the gossip layer with conflicting signals that consume dedup capacity or delay propagation.

P4-c designs the lab mechanism that closes both attack directions. It introduces a distinct, explicitly sybil-resistant revocation quorum for clearance takedowns, reuses the existing dual-Set dedup fold from `overlay-dag.mjs`, and keeps the fraud-proof revocation path from Phase 3 entirely unchanged.

**Hard boundary:** This is a DOCS-ONLY PLAN. No code is written at this gate. The distinction between what the lab mechanism proves and what counsel must define is maintained throughout. A working mechanism is not safety.

### Lab mechanism

**Two revocation kinds, permanently separated**

The existing `overlay-dag.mjs` `verifyRevocationEntry` path handles fraud-proof revocation and is not touched. A new type discriminant — call it `revocation_kind` — distinguishes the two kinds at the data level:

```
revocation_kind: 'FRAUD_PROOF'   // Phase 3; keyless; any peer; stays as-is
revocation_kind: 'CLEARANCE'     // Phase 4; quorum-gated; vetted keys only
```

A client processing a revocation entry checks `revocation_kind` first. `FRAUD_PROOF` entries follow the existing `verifyRevocationEntry` path without modification. `CLEARANCE` entries are rejected outright if processed by the fraud-proof path and vice versa. The two kinds are never interchangeable.

**Reviewer key set (the sybil-resistance assumption)**

The lab mechanism does not invent its own sybil-resistance root. It assumes a fixed, externally-defined, operator-seeded set of N vetted reviewer public keys. In the lab harness this set is derived deterministically from `identityFromSeed` labels (reusing `identity.mjs:60-66`) — for example `identityFromSeed('reviewer-0')` through `identityFromSeed('reviewer-N-1')`.

The sybil-resistance assumption is explicit: the vetted reviewer set is the trust boundary. A peer not in the set cannot contribute a clearance-revocation. How a reviewer earns entry into the set (age verification, employment, identity assurance) is a counsel-defined policy input (see Deferred residuals). The lab only models the cryptographic enforcement of membership; it does not model the membership process itself.

**Clearance-revocation entry structure**

A clearance-revocation op is a signed object with these fields (all serialized via `canonical.mjs:22,37-39`):

```
{
  revocation_kind:    'CLEARANCE',
  target_hash:        <content_address of the clearance token being revoked>,
  reason_code:        <enum — one of a fixed closed-vocabulary set>,
  reviewer_id:        <player ID per identity.mjs:43-45>,
  reviewer_pubkey:    <raw Ed25519 public key bytes>,
  signature:          <Ed25519 signature over canonical(rest of fields)>,
  seq:                <logical sequence number from the mini-log>,
  timestamp_logical:  <logical height, not wall-clock — no Date.now>,
}
```

`reason_code` is a closed-vocabulary enum (e.g., `POLICY_VIOLATION`, `CHARTER_BREACH`, `OPERATOR_RECALL`). Free text is not permitted in the entry. This preserves the closed-vocabulary constraint from the gameplay charter and the validator's `FORBIDDEN_TERMS_RE` boundary.

**Signature verification predicate**

A new pure function — call it `verifyReviewerSignature(entry, reviewerKeySet)` — performs:

1. Confirm `entry.revocation_kind === 'CLEARANCE'`.
2. Confirm `entry.reviewer_pubkey` is a member of the known `reviewerKeySet` (exact byte match against the seeded set).
3. Confirm `entry.reviewer_id === playerIdFromPubkey(entry.reviewer_pubkey)` (reusing `identity.mjs:43-45` derivation).
4. Recompute `canonical(entry minus signature field)` and verify the Ed25519 signature using the pubkey.

This function is pure and deterministic. It takes no network state and has no side effects. It reuses `canonical.mjs:22,37-39` for serialization and `identity.mjs:43-45` for ID derivation exactly as Phase 3 does.

**k-of-n threshold predicate**

A second pure function — call it `thresholdMet(target_hash, verifiedRevocations, k)` — performs:

1. Filter `verifiedRevocations` to entries where `target_hash` matches and `verifyReviewerSignature` passes.
2. Deduplicate by `reviewer_id` (one vote per reviewer, last-write-wins on sequence number).
3. Return `true` if the count of distinct verified reviewer IDs is `>= k`.

The values of k and N are inputs to the function, not hardcoded. The lab harness seeds them from a config object. The policy values of k and N (what threshold is sufficient for minors-facing safety) are a counsel-defined input; the lab can only prove the threshold enforcement is correct for whatever k and N are provided.

**Dedup fold (existing dual-Set)**

Clearance-revocation entries are folded into the existing dual-Set structure from `overlay-dag.mjs:162-174` (`appliedRevokes` + `rejectedRevokes`), extended to track by `(revocation_kind, target_hash, reviewer_id)` tuple. A duplicate delivery from the same reviewer for the same target is a no-op. This means a gossip flood of repeated identical entries cannot grow audit state, reusing the existing dedup invariant.

`appliedRevokes` accumulates entries that have passed `verifyReviewerSignature`. The `thresholdMet` check is evaluated lazily when a client decides whether to render — it is not a state transition at gossip-receipt time. This avoids a TOCTOU gap where a revocation appears applied before the threshold is met.

**Gossip propagation model**

The lab models gossip as a pure function over an ordered message sequence (reusing the stress-test pattern from `fabric-stress.mjs`). Each message in the sequence is either a `CLEARANCE` entry, a duplicate, a reorder, or a fabricated entry from a non-reviewer identity. The lab runs the dedup fold over the sequence and verifies the threshold predicate holds exactly when it should and fails when it should. No real network transport is used; transport is deferred.

**Revocation invalidation of a clearance token**

A clearance token (from P4-a) for a given `target_hash` is considered valid for rendering only if `thresholdMet(target_hash, gossipedRevocations, k)` returns false. If it returns true, the render-gate (P4-b) refuses to render regardless of the token's own signature. This is the deny-by-default, fail-closed enforcement: a valid clearance token is overridden by a k-of-n revocation.

**Modules this component would ADD (lab-only, prod-denylisted)**

- `revocation-quorum.mjs` — `verifyReviewerSignature`, `thresholdMet`, `makeRevocationEntry`; pure, zero-dep, no Date.now, uses `canonical.mjs` and `identity.mjs` directly.
- `revocation-quorum-evidence.mjs` — evidence harness; defines frozen `LAB_MODULE_PATHS` including `revocation-quorum.mjs`; runs the full claim set; verifies denylist boundary via `isExcludedFromUpload` per the `fabric-evidence.mjs:59,198-201` convention.

**Existing modules this component reuses without modification**

- `overlay-dag.mjs` — dual-Set dedup fold extended to `(revocation_kind, target_hash, reviewer_id)` tuples; fraud-proof revocation path untouched.
- `canonical.mjs:22,37-39` — all entry serialization.
- `identity.mjs:43-45,60-66` — reviewer ID derivation and deterministic key generation for lab fixtures.
- `settlement.mjs:110-123` — `proveFraud` path is NOT called by clearance-revocation; separation is enforced at the kind discriminant.

### What the lab PROVES

The lab proves the following claims, each checkable by the evidence harness:

**C1 — Kind separation is enforced.** A `CLEARANCE` entry processed by the `verifyRevocationEntry` (fraud-proof) path is rejected. A `FRAUD_PROOF` entry processed by `verifyReviewerSignature` is rejected. The two paths do not accept each other's entries.

**C2 — Non-member entries are rejected.** An entry signed by a key not in the reviewer key set fails `verifyReviewerSignature` regardless of signature validity. A fabricated reviewer ID that is not derivable from a key in the set fails step 3 of the predicate.

**C3 — Threshold enforcement is exact.** For any k and N provided, `thresholdMet` returns false with k-1 distinct verified reviewers and true with exactly k. Adding a k+1-th reviewer does not change the outcome. Removing one verified reviewer below k returns false.

**C4 — Dedup prevents state growth under flood.** Delivering M copies of the same entry from the same reviewer produces exactly one entry in `appliedRevokes`. State size is bounded by the reviewer set size times the number of distinct target hashes, not by message volume.

**C5 — Sybil flood (forge-takedown direction) fails.** Delivering entries signed by N+1 fabricated keys (not in the reviewer set) does not satisfy the threshold. `thresholdMet` returns false. The render-gate does not revoke a legitimately cleared token.

**C6 — Sybil flood (block-takedown direction) fails.** Delivering a flood of malformed, duplicate, or non-member entries alongside k legitimate revocation entries does not prevent the threshold from being met. The dedup fold isolates legitimate entries correctly.

**C7 — Denylist boundary holds.** No module in `LAB_MODULE_PATHS` appears in the curated upload set. The `isExcludedFromUpload` check passes for all lab modules. This mirrors the F0 claim from `fabric-evidence.mjs:198-201`.

**C8 — Content addressing is stable.** The `target_hash` in a revocation entry is the canonical sha256 of the clearance token it targets. Changing any byte of the clearance token produces a different hash. A revocation for the original hash does not match the mutated token.

**C9 — Logical sequencing holds.** Revocation entries with `seq` values reordered or replayed are deduped correctly. The gossip fold is order-independent for the purpose of threshold counting (per-reviewer last-write-wins on seq number).

The lab does NOT prove: that the reviewer key set is sybil-resistant in the real world; that k and N are sufficient values for minors safety; that gossip reaches all peers within any real-time bound; that a revoked clearance is unreachable on a device that already holds it; that the render-gate cannot be bypassed by a patched client.

### Deferred residuals + falsifiers

**R-c1 — Real-world sybil resistance of the reviewer set.** The lab assumes the reviewer set is an externally-defined, operator-seeded list of vetted keys. How a key earns entry (employment, identity assurance, age verification of the reviewer themselves) is outside the lab. The lab mechanism proves threshold enforcement over a given set; it does not prove the set is sybil-resistant.
FALSIFIER: Construct a scenario where an attacker can register N+1 reviewer keys in the set (via the real-world onboarding process) without the operator's knowledge. If this is possible, the k-of-n threshold provides no sybil resistance at all. The lab cannot run this experiment; it requires a real onboarding process.

**R-c2 — Gossip latency and propagation completeness.** The lab models gossip as a synchronous fold over an ordered message sequence. Real gossip has unknown latency. A legitimate safety takedown that does not propagate to a client within the client's freshness window (defined in P4-b/P4-d) does not protect that client.
FALSIFIER: In a real network with Byzantine routing, partition k legitimate reviewer revocation entries such that no client receives k of them before the freshness window expires. The render-gate fails closed (renders nothing) or fails open (renders the unrevoked content) depending on its offline policy. The lab cannot bound real propagation latency.

**R-c3 — Revocation does not guarantee byte-level deletion.** A client that received and cached a clearance token before revocation may hold the token in local storage. The render-gate checks the revocation list at render time, but the bytes of the cleared content may already be on the device.
FALSIFIER: A client that caches aggressively, ignores the freshness window, and never re-queries gossip will render revoked content indefinitely. The lab cannot enforce deletion of bytes already on a device.

**R-c4 — Reviewer key compromise.** If a reviewer key is compromised, an attacker can issue revocations on behalf of that reviewer. If k is small relative to N, a single compromise may be sufficient to forge a k-of-n revocation (if the attacker also controls other reviewer keys) or to participate in a legitimate-looking takedown of a valid clearance.
FALSIFIER: Reduce N to k and compromise one reviewer key. The attacker can now forge a complete k-of-n revocation unilaterally. The lab can prove the mechanism enforces the threshold; it cannot prove key storage is secure.

**R-c5 — Policy values of k and N are counsel-defined, not engineering choices.** What threshold is legally sufficient for a minors-facing safety takedown (COPPA, UK AADC, GDPR-K contexts) is a regulatory and policy question. The lab can prove that a threshold of k is enforced; it cannot prove k=2 or k=5 or k=N constitutes legally adequate protection.
FALSIFIER: Counsel rules that a single-operator takedown authority is legally required (i.e., k must equal N, meaning unanimity, or k must equal 1 with a specific named authority). If so, the M-of-N mechanism is not the right shape regardless of whether it is correctly implemented.

**R-c6 — reason_code enum coverage is counsel-defined.** The closed-vocabulary `reason_code` enum defines what categories of safety takedown are permitted. What categories are legally required (e.g., must CSAM have a separate mandatory-report pathway rather than a revocation op?) is a counsel-defined input. The lab can prove the enum is closed and the entry is well-formed; it cannot prove the enum covers all legally required categories.
FALSIFIER: Counsel identifies a legally mandated takedown category (e.g., mandatory NCMEC reporting pathway for CSAM) that cannot be satisfied by a gossip-propagated revocation op. If so, the closed-enum approach is insufficient for that category.

**R-c7 — Phase 0 items A1–A4, B5–B7, D10–D12, E13–E15 remain BLOCKING.** This component does not resolve any Phase 0 counsel items. The sufficiency of the k-of-n quorum for minors safety (A4), the adequacy of render-gate for takedown without a central server (B7), and all other checklist items remain open and blocking for any live or minors-facing use.
FALSIFIER: Phase 0 counsel rules the k-of-n quorum model is not legally sufficient as a minors-safety control. If so, this entire component's design must be revisited before any live use, regardless of whether the lab mechanism is correctly implemented.

### Red-team cases

The P4-c evidence harness must exercise all of the following adversarial cases. Each case must produce a checkable PASS/FAIL result from the deterministic fold; no case may require real network behavior.

**RT-c1 — Forge-takedown flood (sybil censor attack).** Deliver M entries signed by M distinct keys, none of which are in the reviewer set. Assert `thresholdMet` returns false. Assert `appliedRevokes` contains zero valid clearance-revocation entries for the target. Assert the clearance token remains valid for rendering.

**RT-c2 — Block-takedown flood (sybil drowning attack).** Pre-populate the dedup fold with a large number of malformed, duplicate, and non-member entries targeting the same `target_hash`. Then deliver exactly k legitimate reviewer-signed entries. Assert `thresholdMet` returns true. Assert the flood entries do not prevent the legitimate threshold from being reached. Assert state size (entries in `appliedRevokes`) is bounded by reviewer set size, not by flood volume.

**RT-c3 — Threshold boundary at k-1.** Deliver exactly k-1 distinct, valid reviewer-signed revocation entries. Assert `thresholdMet` returns false. Assert the render-gate does not revoke the clearance token. Assert adding one more valid entry flips the result.

**RT-c4 — Replay attack.** Deliver the same valid revocation entry from reviewer-i exactly 100 times (simulating gossip amplification). Assert it is counted once. Assert state does not grow. Assert this does not help reach the threshold if fewer than k distinct reviewers have signed.

**RT-c5 — Reorder attack.** Deliver k valid revocation entries in reverse sequence-number order, then in random order, then with interleaved non-member entries. Assert `thresholdMet` is true in all orderings and that the result is identical across orderings (order-independence of the fold).

**RT-c6 — Kind confusion attack.** Deliver a `FRAUD_PROOF` revocation entry with a `reviewer_id` that is in the reviewer key set. Assert `verifyReviewerSignature` rejects it (wrong kind). Assert the fraud-proof path also rejects it if `revocation_kind` is not `FRAUD_PROOF`. Assert neither path accepts the wrong kind.

**RT-c7 — Mutated target hash.** Construct a valid k-of-n revocation for `target_hash` T1. Change one byte of the clearance token to produce T2. Assert the revocation for T1 does not match T2. Assert the render-gate treats the clearance token for T2 as unrevoked.

**RT-c8 — Reviewer key impersonation.** Construct an entry where `reviewer_id` is derived from a legitimate reviewer pubkey but the `reviewer_pubkey` field contains a different (attacker-controlled) key. Assert step 3 of `verifyReviewerSignature` (ID-pubkey consistency check) rejects it. Assert the attacker cannot contribute a threshold vote by impersonating a known reviewer ID.

**RT-c9 — Concurrent revocation and re-clearance race (logical).** Deliver a revocation reaching the threshold, then deliver a new clearance token for the same content hash from P4-a. Assert the revocation of the original token does not automatically revoke the new token (each clearance token has its own `target_hash` derived from its own content; if the new token is a new signing event, it has a different hash and requires a fresh revocation). Assert the quorum must re-vote to revoke the new token.

**RT-c10 — Empty reviewer set.** Invoke `thresholdMet` with an empty `reviewerKeySet` and any k > 0. Assert it returns false. Assert no entry can pass `verifyReviewerSignature` against an empty set. Assert the render-gate fails closed (no clearance can be valid if the reviewer set is empty or uninitialized).

### Boundary + Phase 0 dependency

**What stays lab-only (hard, non-negotiable):**

- `revocation-quorum.mjs` and `revocation-quorum-evidence.mjs` are denylisted from the curated upload set. They must appear in the frozen `LAB_MODULE_PATHS` array of the evidence harness and must pass the `isExcludedFromUpload` check, mirroring the F0 claim convention from `/arcade/hiveworld-agents/turf-wars/fabric-evidence.mjs:59,198-201`.
- `LIVE_WORLD_LOADER_ENABLED` in `/arcade/creator/approval/approved-loader.mjs` stays literally `false`. Nothing in P4-c changes it or creates a pathway to change it.
- No Worker, Durable Object, D1, R2, KV, real network socket, real gossip transport, real clock (no `Date.now`, no `Math.random`), and no deployment artifact is produced.
- The reviewer key set in the lab harness is seeded deterministically from `identityFromSeed` labels. No real identity verification, no real key ceremony, no real onboarding process is modeled or implied.
- The closed-vocabulary `reason_code` enum is a lab placeholder. The actual enum values that would be legally required are a counsel-defined input and are not finalized at this gate.

**What counsel must define before this is live or minors-facing:**

- The values of k and N that constitute legally adequate protection under COPPA, UK AADC, GDPR-K, and any other applicable regime (Phase 0 item A4).
- The real-world process by which a reviewer key earns entry into the vetted set (Phase 0 item A1 — age assurance of the reviewer; A2 — parental consent mechanisms; Q7 — identity/age-assurance root).
- Whether the render-gate revocation model satisfies the takedown obligation without a central server (Phase 0 item B7 / Q4).
- Whether the closed `reason_code` enum covers all legally mandated content categories, or whether additional mandatory-report pathways (e.g., NCMEC for CSAM) are required outside the gossip revocation mechanism (Phase 0 item B6 / Q3 / Q5).
- Whether gossip-propagated revocation constitutes adequate notice and execution of a takedown (Phase 0 items B5, B7, D11).
- Whether the device-keypair reviewer identity model constitutes personal data under D10–D12 (GDPR, PIPEDA, or equivalent), and if so, what data-minimization obligations apply to the gossip log.
- A written counsel record and a charter-superseding ADR citing that record are prerequisites for any live or minors-facing use.

**Phase 4 BUILD gate (separate, future):** `AUTHORIZED: BUILD PHASE 4c — SYBIL-RESISTANT REVOCATION QUORUM — LAB ONLY`. The lab mechanism proving threshold enforcement is not a safety claim.

---

## P4-d — Owner reconciliation after third-party revocation

### Goal

Phase 3 established that any peer holding three public inputs — a defender's signed base record, an attacker's signed plan, and a settlement reveal — can independently execute `verifyRevocationEntry` (`overlay-dag.mjs:104-123`) and emit a valid revocation without the owner's signature or any quorum. This is correct and intentional: authority traces to the purity of `proveFraud` (`settlement.mjs:110-123`), not to revoker identity.

The residual Phase 3 left open (`fabric-evidence.mjs:216`): when the owner was offline during the challenge window and returns to find one or more revocations applied against their settlement entries, they have no deterministic, referee-free procedure to fold the gossiped overlay, decide which revocations to accept as canonical, and determine whether they hold a counter-proof that entitles them to contest via the challenge window. Without this procedure, an owner's local view may diverge from every other honest peer's view — not because of Byzantine behavior, but simply because the owner lacks a specified reconciliation algorithm.

This component designs that algorithm as a deterministic, pure `.mjs` lab mechanism. It extends the patterns in `overlay-dag.mjs` without adding a central referee, without breaking the keyless fraud-proof revocation model, and without granting the owner any special veto power over a verified fraud-proof.

### Lab mechanism

**Reused modules and patterns:**

- `overlay-dag.mjs` — the dual-Set dedup (`appliedRevokes` / `rejectedRevokes`, lines 162-174) and entry revocation flow (lines 185-193) are the direct structural model. Reconciliation is a fold over the same data structures.
- `settlement.mjs:110-123` — `proveFraud(baseRecord, plan, claim)` is the canonical authority function. The owner re-executes it identically to any other peer; the owner receives no special short-circuit.
- `overlay-dag.mjs:104-123` — `verifyRevocationEntry(entry, baseRecord, plan, claim)` is the predicate the owner applies to each gossiped revocation. No new predicate is introduced; the owner's reconciliation loop is exactly this predicate, applied in deterministic sort order.
- `canonical.mjs:22, 37-39` — `sha256(canonicalize(value))` content-addresses every overlay entry, revocation entry, and base record. The owner's reconcile fold uses content addresses as its deduplication keys, identical to the gossip layer.
- `identity.mjs:60-66, 43-45` — `identityFromSeed(label)` derives all fixture identities deterministically. The owner identity in the lab is `identityFromSeed('owner')`, no random key generation.
- `challenge-window.mjs:33` — `CHALLENGE_WINDOW_HEIGHTS` (W = 8 logical seq-heights) defines the window within which a counter-proof is valid. The owner's contest predicate checks whether the owner's counter-proof logical height falls within this window relative to the revoked entry's anchor height.
- `availability.mjs:34-42` — the `lcg(seed)` Mulberry32 PRNG is reused for any seeded fixture state; the reconcile algorithm itself contains no `Math.random` or `Date.now`.
- `fabric-evidence.mjs:58-63` — the frozen `LAB_MODULE_PATHS` boundary is extended by one new file; the denylist self-check (`isExcludedFromUpload`) is run over the new file name.

**New module: `owner-reconcile.mjs`** (lab-only, prod-denylisted, zero external deps)

This module exports two pure functions and one predicate. All inputs are plain JavaScript values (content-addressed strings, sorted arrays, sets). No I/O, no clock, no network.

```
reconcileOwnerView(
  localEntries:   OverlayEntry[],       // owner's local DAG snapshot before reconcile
  gossipedEntries: OverlayEntry[],      // entries received from peers (may overlap)
  gossipedRevocations: RevocationEntry[], // revocations received from peers
  baseRecord: SignedSnapshot,           // defender's signed base — same object used in verifyRevocationEntry
  plan: SignedPlan,                     // attacker's signed plan — same object
  claim: SettlementReveal               // settlement reveal — same object
) → ReconcileResult
```

`ReconcileResult` contains:

- `canonicalEntries`: the content-addressed, dedup-sorted union of `localEntries` and `gossipedEntries`, processed identically to `overlay-dag.mjs`'s existing merge logic.
- `acceptedRevocations`: the subset of `gossipedRevocations` for which `verifyRevocationEntry` returns `true`.
- `rejectedRevocations`: the subset for which `verifyRevocationEntry` returns `false`, stored for audit (mirroring `rejectedRevokes` in `overlay-dag.mjs:162-174`).
- `contestable`: the subset of `acceptedRevocations` where the owner holds a counter-proof whose logical height falls within `CHALLENGE_WINDOW_HEIGHTS` of the revoked entry's anchor height AND whose `proveFraud` output contradicts the revocation's `fraud.mismatch` claim — meaning the owner's local inputs produce a different, non-fraudulent settlement output. This set is informational; it identifies entries the owner may submit as a challenge, but submission itself is a future transport concern.
- `applied_scorch_delta`: the net scorch change after folding accepted revocations, computed via the same bounded `applyScorch` path in `scorch.mjs`.

```
canContest(
  revocationEntry: RevocationEntry,
  ownerCounterProof: { baseRecord, plan, claim },
  currentLogicalHeight: number
) → boolean
```

Returns `true` only when ALL hold:

1. `verifyRevocationEntry(revocationEntry, ownerCounterProof.baseRecord, ownerCounterProof.plan, ownerCounterProof.claim)` returns `false` — meaning the owner's inputs, run through the same `proveFraud`, do not reproduce the fraud mismatch that the revocation claims.
2. The revocation entry's anchor logical height is within `CHALLENGE_WINDOW_HEIGHTS` of `currentLogicalHeight`.

If either condition fails, `canContest` returns `false`. A closed challenge window is closed; the owner cannot reopen it by returning late.

```
foldRevocations(
  entries: OverlayEntry[],
  revocations: RevocationEntry[],
  baseRecord: SignedSnapshot,
  plan: SignedPlan,
  claim: SettlementReveal
) → { finalEntries: OverlayEntry[], appliedRevokes: Set<string>, rejectedRevokes: Set<string> }
```

This is the core fold. It applies accepted revocations to entries in deterministic content-address sort order (same ordering as `overlay-dag.mjs`), marks revoked entries with `status: 'REVOKED'`, excludes their scorch from `applied_scorch`, and deduplicates using the same dual-Set pattern (`appliedRevokes` / `rejectedRevokes`). Duplicate delivery of a revocation is a no-op. The output is byte-identical to what any other honest peer produces from the same inputs.

**Determinism guarantee:** `reconcileOwnerView` is a pure function. Given the same four public inputs (`localEntries`, `gossipedEntries`, `gossipedRevocations`, and the triple `{baseRecord, plan, claim}`), every peer — including the returning owner — produces the same `ReconcileResult`. There is no owner-specific branch, no clock, no random seed, and no special-case for the owner's own entries. The owner is structurally identical to any watcher peer running the same fold.

### What the lab PROVES

The lab proves these specific, checkable claims about the mechanism. It does not prove safety, sufficiency for minors protection, or real-network behavior.

1. **Convergence under fold**: Given a fixed set of `gossipedRevocations` and a fixed triple `{baseRecord, plan, claim}`, any two peers — one of which was online throughout and one of which was the owner and offline during the challenge window — produce byte-identical `foldRevocations` output when given the same inputs. Proved by running both from a common fixture and asserting `deepEqual` on `finalEntries`, `appliedRevokes`, and `applied_scorch_delta`.
2. **Accepted/rejected split matches verifyRevocationEntry**: Every entry in `acceptedRevocations` satisfies `verifyRevocationEntry(entry, baseRecord, plan, claim) === true`. Every entry in `rejectedRevocations` satisfies the same predicate returning `false`. No revocation is silently dropped. Proved by running the predicate explicitly over both sets in the evidence harness.
3. **Challenge window predicate is bounded and closed**: `canContest` returns `true` only when both conditions hold. The lab exercises a fixture where the owner holds a valid counter-proof but the challenge window has closed (`currentLogicalHeight > revocationEntry.anchorHeight + CHALLENGE_WINDOW_HEIGHTS`), and asserts `canContest` returns `false`. The window cannot be extended by the owner's return timing.
4. **Dual-Set dedup**: Delivering the same revocation entry twice to `foldRevocations` produces the same output as delivering it once. The `appliedRevokes` and `rejectedRevokes` sets grow by at most one entry per unique content address. Proved by a duplicate-delivery stress fixture.
5. **Owner suppression cannot alter fold output**: An owner who withholds local entries from `localEntries` produces a `canonicalEntries` set that is a subset of the honest output, not a superset. Peers who gossip the full entry set converge to the superset. The owner's local omission does not propagate to other peers' folds because gossip is independent of the owner's local state. This is not a security proof against withholding — it is a mechanistic proof that the fold is not owner-privileged.

The lab does not prove: that gossip latency is bounded in real P2P, that revocation reaches all peers before the challenge window closes, that the owner cannot acquire the triple `{baseRecord, plan, claim}` from peers after the window closes and fabricate a retroactive contest, or that device-cached content is deleted. These are deferred residuals.

### Deferred residuals + falsifiers

**R-d1 (Gossip latency vs. challenge window):** The lab assumes gossiped revocations arrive at the owner before `CHALLENGE_WINDOW_HEIGHTS` elapses. In real P2P, a network partition may prevent the owner from receiving the revocation until after the window closes. The `foldRevocations` fold accepts a late revocation identically to an in-window one — there is no freshness gate on the revocation itself, only on the owner's contest eligibility. The owner may therefore lose the right to contest a revocation they never received in time, through no fault of their own.
FALSIFIER: construct a fixture where a valid counter-proof exists, the owner is partitioned for exactly `CHALLENGE_WINDOW_HEIGHTS + 1` logical heights, then reconnects. Assert that `canContest` returns `false` and the revocation is accepted as canonical despite the owner holding a valid counter-proof. If the build fails to reproduce this outcome deterministically, the latency-window interaction is not correctly implemented.

**R-d2 (No hard delete of cached content):** A revocation applied by `foldRevocations` marks an entry `REVOKED` and excludes its scorch from `applied_scorch`. It does not and cannot delete bytes already stored on a peer's device from a prior successful gossip. An owner whose settlement entry was gossiped before revocation cannot force peers to purge cached copies. This is a structural property of the content-addressed, decentralized design.
FALSIFIER: after `foldRevocations` marks an entry `REVOKED`, assert that a peer which cached the entry's payload before the revocation still holds the payload bytes unchanged. If any lab mechanism claims to delete the bytes, the claim is false; flag it for Phase 0 counsel Q4/Q5 review.

**R-d3 (Owner retroactive counter-proof acquisition):** The `canContest` predicate checks only that the owner's inputs produce a non-fraudulent `proveFraud` output and that the challenge window is open. It does not check when the owner acquired `{baseRecord, plan, claim}`. An owner who was offline during the challenge window but later acquires the triple from peers could, if the window were not closed, submit a retroactive contest. The window closure (`CHALLENGE_WINDOW_HEIGHTS`) prevents this — but only mechanistically. Whether this is a sufficient temporal boundary for any live governance purpose is a counsel-defined policy question, not an engineering determination.
FALSIFIER: construct a fixture where the owner acquires the triple after the window closes. Assert `canContest` returns `false`. Then relax `currentLogicalHeight` to within the window and assert `canContest` returns `true`. If the predicate does not respect both cases correctly, the window boundary is broken.

**R-d4 (Counsel-defined policy: what "contested" means):** The `contestable` set in `ReconcileResult` identifies entries where the owner holds a mechanically valid counter-proof within the window. The lab proves only that the predicate is correctly evaluated. What the owner is permitted to do with a `contestable` entry — whether a successful contest restores the entry, triggers a re-vote, or alerts a human reviewer — is a governance and policy decision. The mechanism is inert without a policy layer. This is a counsel-defined input, not an engineering choice.
FALSIFIER: there is no technical falsifier for the policy gap. The falsifier is the absence of a written counsel ruling on Phase 0 A4 that specifies what "contest" means in a minors-facing context. If Phase 4 proceeds to live use without that ruling, the mechanism is deployed without policy grounding.

**R-d5 (Sybil-flooded revocations):** `foldRevocations` accepts any revocation that passes `verifyRevocationEntry`. A Sybil attacker controlling many keypairs cannot forge a revocation for an honest settlement (because `proveFraud` is pure and will return `fraud.mismatch === false` for an honest entry), but can flood the gossip layer with revocation entries for entries that do not exist or that are already revoked. The dual-Set dedup absorbs duplicate content addresses, but the flood of novel-but-invalid revocations adds entries to `rejectedRevokes` unboundedly. A bounded `rejectedRevokes` set (with a max cardinality and an eviction policy) is deferred — it is a property of the integration harness (P4 red-team) and the P4-c quorum store, not of the reconcile fold alone.
FALSIFIER: construct a fixture that floods `foldRevocations` with 10,000 distinct invalid revocation entries (each with a unique content address, each failing `verifyRevocationEntry`). Assert that the `rejectedRevokes` set grows to 10,000 entries and measure the memory footprint. If the growth is unbounded without a cardinality cap, the flooding residual is real and must be addressed before the integration harness passes.

### Red-team cases

The evidence pack for P4-d must exercise all of the following adversarial scenarios deterministically, with deterministic fixtures derived from `identityFromSeed` and `lcg(seed)`:

**RT-d1 — Owner withholds local entry, attempts to suppress revocation.** Fixture: owner's `localEntries` omits the entry that was revoked. The gossiped overlay (from peers) includes both the entry and the revocation. `reconcileOwnerView` must include the gossiped entry in `canonicalEntries` and the revocation in `acceptedRevocations`. Assert: the owner's omission does not cause the revocation to be dropped; the fold output is identical to a peer that received both.

**RT-d2 — Owner submits a fabricated counter-proof.** Fixture: owner calls `canContest` with a `{baseRecord, plan, claim}` triple that has been modified such that `proveFraud` returns `fraud.mismatch === false` not because the settlement was honest, but because the owner tampered with `claim`. Since `proveFraud` is a pure function over content-addressed inputs, and since the revocation entry was generated from the original `claim`, the owner's modified triple produces a different content address than the revocation's anchor. Assert: `canContest` evaluates the owner's modified triple against the owner's inputs, and returns `true` — but the owner's contest is against a different content address than the revocation, so the contest does not apply to the revocation. The lab must assert this mismatch explicitly: `ownerCounterProof.claim` content-addressed does not match the revocation entry's anchored claim address.

**RT-d3 — Owner attempts late contest after window closure.** Fixture: owner holds a genuine counter-proof (the settlement entry was not actually fraudulent; a different attacker submitted a false revocation that nonetheless passed `verifyRevocationEntry` due to a fixture configuration error — this tests the window boundary in isolation). Set `currentLogicalHeight = revocationEntry.anchorHeight + CHALLENGE_WINDOW_HEIGHTS + 1`. Assert: `canContest` returns `false`. Then set `currentLogicalHeight = revocationEntry.anchorHeight + CHALLENGE_WINDOW_HEIGHTS - 1`. Assert: `canContest` returns `true`. The boundary must be exact.

**RT-d4 — Duplicate revocation delivery storm.** Fixture: deliver the same valid revocation entry 1,000 times to `foldRevocations`. Assert: `appliedRevokes` contains exactly one entry for the revocation's content address; `finalEntries` contains the revoked entry exactly once with `status: 'REVOKED'`; `applied_scorch_delta` is computed once, not 1,000 times.

**RT-d5 — Conflicting revocations for the same entry.** Fixture: two distinct revocation entries both target the same overlay entry content address, but were emitted by different peers (different revoker signatures, same `fraud.mismatch === true` verdict from `proveFraud`). Assert: `foldRevocations` accepts the first (by deterministic content-address sort order) and deduplicates the second via `appliedRevokes`. The second is not placed in `rejectedRevokes` (it is valid) but is silently deduplicated. The lab must assert that the dedup path is exercised for valid-but-duplicate revocations, not only for invalid ones.

**RT-d6 — Owner reconciles against an empty gossip set.** Fixture: owner returns after a long partition; `gossipedEntries` and `gossipedRevocations` are both empty (peers were unreachable). Assert: `reconcileOwnerView` returns `localEntries` unchanged in `canonicalEntries`, `acceptedRevocations` is empty, `rejectedRevocations` is empty, `contestable` is empty. The owner's local view is preserved unchanged. This is the correct behavior: without gossip, the owner cannot know about revocations that were applied during their absence, and the fold does not fabricate knowledge.

**RT-d7 — Owner receives gossip after challenge window closes but revocation is still valid.** This is the latency-window residual (R-d1) made concrete as a red-team case. Assert: `foldRevocations` accepts the late revocation (it passes `verifyRevocationEntry`); `canContest` returns `false` for the same entry. The owner's revocation is canonical; the owner's right to contest is extinguished. This is the expected and honest outcome. The evidence pack must log this explicitly as a red-team disclosure, not hide it.

### Boundary + Phase 0 dependency

**Lab-only boundary (all of the following apply without exception):**

- `owner-reconcile.mjs` is added to the frozen `LAB_MODULE_PATHS` array in the integration evidence pack. `isExcludedFromUpload('arcade/hiveworld-agents/turf-wars/owner-reconcile.mjs')` must return `true` before the integration harness can claim the denylist boundary (claim F0, `fabric-evidence.mjs:198-201`).
- No Worker, Durable Object, D1, R2, KV, or Cloudflare binding is touched. No migration, no deploy, no upload, no config change.
- `LIVE_WORLD_LOADER_ENABLED` in `/arcade/creator/approval/approved-loader.mjs` remains the literal constant `false`. This component does not reference it, does not flip it, and does not provide a path to flip it.
- No `Date.now`, `Math.random`, or wall-clock reference in `owner-reconcile.mjs`. All seeded state uses `lcg(seed)` from `availability.mjs:34-42`.
- No accounts, login, chat, free text, URLs, images, or arbitrary JS surfaces are introduced or implied by this design.
- No economy, IAP, transfer, cash-out, marketplace, ownership, or player-to-player trade logic is introduced.
- The gameplay charter bans (`NEON_CIRCUIT_GAMEPLAY_CHARTER.md` Section 19, `FORBIDDEN_TERMS_RE`) remain in force. The reconcile algorithm operates over content-addressed overlay entries; it does not inspect or generate free-text fields. A clearance token bound to a package whose hash matches a forbidden-term violation is void; the reconcile algorithm does not override validator judgments.

**What counsel must define before any live or minors-facing use:**

- **Phase 0 A4**: Is M-of-N safety quorum plus render-gate (the broader Phase 4 architecture that P4-d integrates into) a legally sufficient control for minors-facing visibility? The reconcile algorithm's `contestable` output feeds into this gate. If counsel rules the quorum insufficient, the contest mechanism has no authorized live role.
- **Phase 0 Q4/Q5** (residual R-d2): Revocation marks entries `REVOKED` in the fold but cannot delete bytes from peer caches. What is the legally required takedown behavior in a jurisdiction where the operator has no technical means to force deletion from devices? The lab discloses this gap honestly; it does not claim deletion.
- **Phase 0 B7**: Is render-gate adequacy — a client refusing to render a snapshot lacking valid clearance — a sufficient content moderation control without a central server that can hard-delete? Counsel must rule on this before P4-d's output (the reconciled owner view) is used to drive any rendering decision in a live context.
- **Temporal boundary for contest (residual R-d4)**: The `CHALLENGE_WINDOW_HEIGHTS` constant is an engineering-defined parameter from `challenge-window.mjs:33`. Whether this window is a legally meaningful period — whether a content creator has a right to contest a revocation within some human-scale time period rather than a logical-height-based window — is a policy and legal question, not an engineering determination. Counsel must define what "timely contest" means in any live governance regime.
- **Phase 0 D10–D12**: The owner's identity is a deterministic Ed25519 keypair with no account linkage. Whether the keypair hash (`identity.mjs:43-45`) constitutes personal data under applicable data protection law, and whether the gossip layer's propagation of signed revocations constitutes processing of personal data, are open Phase 0 items that Phase 4 does not resolve.

**This plan does not claim that a working reconcile mechanism equals safety.** The mechanism proves convergence and deterministic fold correctness under the lab's assumptions. Whether those assumptions hold in real networks, whether the challenge window is a legally meaningful protection, whether gossiped revocations constitute adequate takedown, and whether the overall system is safe for minors are questions that belong to Phase 0 counsel and have not been resolved.

**Phase 4 BUILD gate (separate, future):** `AUTHORIZED: BUILD PHASE 4d — OWNER RECONCILIATION — LAB ONLY`. That gate does not authorize live use. Live use requires a Phase 0 counsel ruling plus a charter-superseding ADR citing the written record.

---

## Sub-gate decomposition (the buildable Phase 4 plan)

Phase 4 is **not** a single build. Each sub-gate is its own bounded objective with its own evidence pack and its own `AUTHORIZED:` line, mirroring how Phase 3 split into 3a/3b/3c/3d. All modules land under `arcade/hiveworld-agents/turf-wars/` so they auto-inherit the frozen `arcade/hiveworld-agents/` upload-denylist prefix; every pack carries a denylist self-check (claim F0); the prod-denylist test stays **predicate-based, not count-based**. Each sub-gate is independently reviewable, independently denylist-checked, keeps the suite green, carries its residuals forward unclosed, and writes **no** ADR until a future `RECORD` gate.

| Sub-gate | Goal | New lab modules | Proposed gate line |
|---|---|---|---|
| **P4-a — M-of-N safety quorum** | Signed k-of-n clearance token; no single reviewer authorizes visibility; validator-hash bound; `defaultVisibility` deny-by-default; M/N/enrolled-set/max-age are COUNSEL-DEFINED fixture inputs. | `quorum-clearance.mjs`, `quorum-evidence.mjs` | `AUTHORIZED: BUILD PHASE 4a — SAFETY QUORUM — LAB ONLY` |
| **P4-b — Dark-by-default render-gate** | Pure fail-closed `renderDecision` → `DRAW` / `DARK_NO_TOKEN` / `DARK_REVOKED`; double-lock shape; freshness + revocation + content-bind checks; disclosed patched-client / sybil / finality-gap witnesses. | `render-gate.mjs`, `render-gate-evidence.mjs` | `AUTHORIZED: BUILD PHASE 4b — DARK-BY-DEFAULT RENDER-GATE — LAB ONLY` |
| **P4-c — Sybil-resistant revocation quorum** | New `CLEARANCE` revocation kind permanently separated from Phase 3 keyless `FRAUD_PROOF`; `verifyReviewerSignature` + `thresholdMet`; dual-Set dedup absorbs sybil floods both directions; k/N/reason-enum COUNSEL-DEFINED. | `revocation-quorum.mjs`, `revocation-quorum-evidence.mjs` | `AUTHORIZED: BUILD PHASE 4c — SYBIL-RESISTANT REVOCATION QUORUM — LAB ONLY` |
| **P4-d — Owner reconciliation** | Deterministic referee-free `reconcileOwnerView` / `foldRevocations` / `canContest`; offline owner converges byte-identically to any watcher; closed challenge window cannot be reopened by late return; closes the `fabric-evidence.mjs:216` residual. | `owner-reconcile.mjs`, `owner-reconcile-evidence.mjs` | `AUTHORIZED: BUILD PHASE 4d — OWNER RECONCILIATION — LAB ONLY` |
| **P4-e — Integration + red-team + honest residual report** | Wire P4-a/b/c/d into one deterministic in-process safety-fabric simulator; full adversarial red-team (forge/flood/replay/reorder/partition/patched-client/colluding-quorum) across seeds; emit the honest residual-risk report; the roadmap's safety-model red-team evidence. | `safety-fabric.mjs`, `safety-fabric-evidence.mjs`, `safety-fabric-stress.mjs` | `AUTHORIZED: SAFETY MODEL RED-TEAMED + COUNSEL RE-SIGN` |

Recommended order is a→b→c→d→e (b consumes a's token; c is the revocation authority b and d both consult; d folds a/c revocations; e integrates and red-teams all four). The P4-e row maps to the roadmap's Phase 4 gate `AUTHORIZED: SAFETY MODEL RED-TEAMED + COUNSEL RE-SIGN`: it is the integration + adversarial-red-team + honest-residual-report milestone, and — uniquely among the sub-gates — its gate line names `COUNSEL RE-SIGN`, because the safety-model sufficiency claim it surfaces is a counsel question, not a lab pass/fail. **No `AUTHORIZED:` sub-gate above may be exercised as anything but lab-only, and none authorizes live exposure.** A future Phase 4 build records its own ADR (carrying these disclaimers) only at a later `RECORD` gate; **this gate writes no ADR and no code.**

---

## What this does NOT do / boundary

The hard boundary below applies to **every** sub-gate without exception. It mirrors the Phase 1/2/3 boundary verbatim, extended for the safety layer:

- **Lab-only / docs-only PLAN.** No code is written by this gate. Phase 4 BUILD is a SEPARATE future gate (one `AUTHORIZED:` line per sub-gate, above). This PLAN constitutes none of those authorizations.
- **Prod-denylisted.** Every Phase 4 module lands under `arcade/hiveworld-agents/turf-wars/`, inherits the frozen `FORBIDDEN_UPLOAD_PREFIXES` entry, is excluded from the curated upload, is not on `PUBLIC_CREATOR_ALLOW`, and is imported by **no** production path (`grep -c turf-wars` in the upload = 0). Every evidence pack carries a frozen `LAB_MODULE_PATHS` array and an `isExcludedFromUpload` self-check (claim F0). Predicate-based, never count-based.
- **Flag stays false.** `LIVE_WORLD_LOADER_ENABLED` in `/arcade/creator/approval/approved-loader.mjs` stays literally `false`. No Phase 4 module reads, flips, or creates a pathway to flip it. No Worker / DO / D1 / R2 / KV / migration / secret / config is touched; no deploy / upload / Cloudflare mutation.
- **No new value surface.** No economy / IAP / transfer / cash-out / sell / buy / trade / payout / marketplace / ownership / accounts / login / sessions op. No chat / free text / URLs / images / arbitrary JS. The only new data is the closed clearance-token / revocation-entry schemas (data-only, content-addressed, bounded-integer logical heights — never timestamps).
- **Authority model unchanged.** Authority = replay-determinism + the delegable one-op fraud-proof (`settlement.mjs:110-123`) ONLY. The keyless, quorum-free Phase 3 fraud-proof revocation (`overlay-dag.mjs:104-123`) is **not** touched: the new `CLEARANCE` revocation kind is permanently separated from it at the discriminant. Every relay / holder / reviewer-discovery helper is optional, swappable, and signing-keyless where possible; the clearance quorum's signing keys gate a *policy* assertion, never the substrate's *computational* authority.
- **Determinism.** Zero-dep pure `.mjs`; `node:crypto` via `canonical.mjs` / `identity.mjs`; one `mulberry32 lcg(seed)` (`availability.mjs:34-42`); no `Date.now` / `Math.random` / wall clock — byte-identical artifact regeneration. M, N, `max_age_heights`, `RENDER_GATE_MAX_AGE_HEIGHTS`, k, the enrolled reviewer set, and the `reason_code` enum are **lab fixture constants** at every sub-gate, never operator-tunable runtime parameters.
- **No charter override.** The live gameplay charter (`docs/NEON_CIRCUIT_GAMEPLAY_CHARTER.md`) bans (chat / free-text, irreversible loss, raiding / loot / economy / ownership / minors-facing UGC, etc.) stay in force. A clearance token **cannot** authorize a package that violates `FORBIDDEN_TERMS_RE`; the validator runs first, clearance second. Only a counsel-ruled charter-superseding ADR can change what is "clearable."

---

## Phase 0 BLOCKING (unchanged)

This plan does **not** supersede the live gameplay charter, does **not** claim counsel approval, charter override, minors-safety clearance, or production readiness, and does **not** satisfy or substitute for the **Phase 0 legal/safety counsel review, which remains BLOCKING** for any live or minors-facing use. Phase 4 **surfaces** the residuals below; it does **not** resolve them. The roadmap's own framing is explicit: "Phase 4 (safety quorum / render-gate) — its sufficiency is itself a counsel question (A4, B7)."

The exact Phase 0 questions counsel must clear, with their Phase 4 dependency:

- **Q1** — Is a no-central-server, minors-facing UGC + competitive network defensible at all, and under what mandatory controls? *(Phase 4 IS the proposed control stack; sufficiency is Q1/Q2.)*
- **Q2** — Does a signed-reviewer-quorum + dark-by-default render-gate satisfy COPPA / UK AADC / DSA-style duty-of-care given no central server? *(This is the direct sufficiency ruling on the entire P4-a + P4-b + P4-c architecture. The lab proves the predicate; Q2 rules on whether the predicate is enough.)*
- **Q3** — Who is the legally responsible controller for takedown/CSAM when content lives on minors' own devices?
- **Q4** — Is gossiped signed-revocation + freshness-expiry an adequate takedown, or does the law require a **hard guaranteed delete we cannot provide in P2P**? *(P4-d residual R-d2 / P4-c residual R-c3 disclose honestly that the fold marks `REVOKED` but cannot delete bytes already on a device. The render-gate refuses to draw; it cannot un-cache.)*
- **Q5** — CSAM / illegal-content liability for content-addressed data cached on peers we don't control.
- **Q6** — Is a decaying non-cash territory ladder a regulated economy / addictive pattern for minors?
- **Q7** — Is keypair-only identity compatible with required **age-assurance**? *(P4-a/P4-c assume an age-gated default-deny visibility and a vetted reviewer set, but no age signal exists in the keypair-only design; the sybil-resistance root of the reviewer enrollment is exactly this question. Residuals R-a1, R-b3, R-c1.)*
- **Q8** — Does *any* attack/raid/loss framing survive, or must even reversible/cosmetic loss go?
- **Q9** — Liability for a **patched client that bypasses the render-gate**. *(P4-b residual R-b1 discloses this is a deployment-layer falsifier the lab cannot close; publishing-side gossip-restriction to approved hashes is the complementary control, itself bypassable at the transport layer.)*
- **Q10** — Cross-border: snapshots replicated to peers in unknown jurisdictions.

The blocking groups stay open: **A1–A4** (minors safety), **B5–B7** (content / moderation), **D10–D12** (data protection), **E13–E15** (charter / liability / jurisdiction). Per the Phase 0 checklist (`TURF_WARS_PHASE0_LEGAL_SAFETY_CHECKLIST.md`): "No minors-facing exposure before A1–A4 and D-section clearance." Phase 4 reuses the charter's closed-vocab boundary and does not extend it. **No `AUTHORIZED:` sub-gate authorizes live exposure**, and a future Phase 4 build records its own ADR only at a later `RECORD` gate. Live use requires **a counsel memo + a charter-superseding ADR citing the written record** (Phase 0 deliverable) — until then, Turf Wars stays lab-only, prod-denylisted, and no live or minors-facing use is authorized. **This gate writes no ADR and no code.**

---

## Honest residual-risk summary

The union of every component's deferred residuals, each with its falsifier. None is closed by this plan; each is carried forward, disclosed, falsifiable.

| ID | Residual (the honest gap) | Component | Falsifier (the experiment / disclosure that proves the gap is real) |
|---|---|---|---|
| **R-a1 / R-b3 / R-c1** | **Sybil resistance of the reviewer/enrolled key set.** M-of-N is meaningless if one actor controls M keys; the lab assumes a vetted set but does not model how keys earn entry. | P4-a, P4-b, P4-c | One `identityFromSeed` owner mints M reviewer keys, signs all M; `verifyClearanceToken` / `renderDecision` return valid/`DRAW`. Real-world: an attacker registers N+1 keys via the onboarding process the lab cannot model. |
| **R-a2 / R-b2 / R-c2** | **Freshness vs. gossip latency.** `max_age_heights` is a logical-height bound; a client whose height counter is frozen by partition never sees a token go stale, and an undelivered revocation is invisible during the window. | P4-a, P4-b, P4-c | Freeze `currentHeight` at `issued_logical_height`; the staleness check never fires and the token stays valid indefinitely. Partition k legitimate revocations past the freshness window; the client never fails closed in time. |
| **R-a3 / R-b5 / R-c2** | **Revocation propagation gap (revocation-after-draw).** A client that drew before a revocation arrived has already rendered now-revoked content; the gate cannot un-draw. | P4-a, P4-b | `renderDecision` returns `DRAW`; inject revocation; next call returns `DARK_REVOKED`. The window between the two calls is unblocked rendering. |
| **R-a4 / R-b1** | **Patched-client bypass.** A modified client ignores the pure gate entirely and renders anything. Deployment-layer; not closable inside the lab. | P4-a, P4-b | Patch `renderDecision` to always return `DRAW`; a tokenless snapshot is drawn. Disclosed bypass-witness in the evidence pack (mirrors `runPartitionPastWindow`). Publishing-side gossip-restriction is the complementary — also bypassable — control. |
| **R-a5 / R-b4 / R-c5** | **Counsel-defined policy inputs (M, N, k, max-age, enrolled set, "what is cleared").** The safety outcome is entirely determined by parameter values the mechanism cannot choose. | P4-a, P4-b, P4-c | Call the predicate with M=1, N=1, single key, single signature → valid; the quorum collapses to single-authority. The values are inputs; the mechanism cannot enforce their safety. |
| **R-a6** | **"Cleared" ≠ "safe."** A token attests M reviewers signed a hash; it does not attest legal compliance, developmental appropriateness, or absence of harm. | P4-a | Not a code falsifier — the honest acknowledgement that mechanism != policy. Phase 0 (A1–A4, B5–B7) must define what "cleared for minors-facing visibility" legally requires. |
| **R-c3 / R-d2** | **No hard delete of cached bytes.** Revocation marks `REVOKED` and excludes scorch but cannot purge bytes already gossiped to a device. Structural property of the content-addressed P2P design. | P4-c, P4-d | After `foldRevocations` marks an entry `REVOKED`, a peer that cached the payload before revocation still holds the bytes unchanged. Flag for Phase 0 Q4/Q5. |
| **R-c4** | **Reviewer key compromise.** With k small relative to N, one compromise (plus other controlled keys, or N reduced to k) can forge a complete k-of-n revocation. | P4-c | Set N=k, compromise one key → the attacker forges a unilateral k-of-n revocation. The lab proves threshold enforcement; it cannot prove key storage is secure. |
| **R-c6** | **`reason_code` enum coverage.** The closed enum may not cover legally mandated takedown categories (e.g., a mandatory NCMEC/CSAM reporting pathway distinct from a gossip revocation op). | P4-c | Counsel identifies a mandated category (e.g., NCMEC report) unsatisfiable by a gossip-propagated revocation. If so, the closed-enum approach is insufficient for that category. |
| **RT-a8 (admitted breach)** | **Colluding sub-quorum at threshold.** A sufficiently large colluding group of *enrolled* reviewers can cross the threshold and authorize harmful content — including content violating `FORBIDDEN_TERMS_RE` if collusion plus a validator gap aligns. | P4-a | M=3, N=5, reviewers {0,1,2} collude and sign; the mechanism accepts the token. The enrollment vetting process must be the **outer** control; the threshold mechanism alone does not stop collusion. |
| **R-d1 / R-d3** | **Challenge-window vs. owner liveness.** A partitioned owner can lose the right to contest a revocation they never received in time; the closed window cannot be reopened by late return, and late counter-proof acquisition is mechanistically barred but its temporal sufficiency is a policy question. | P4-d | Partition the owner for `CHALLENGE_WINDOW_HEIGHTS + 1`, then reconnect: `canContest` returns `false` though a valid counter-proof exists. Boundary test: in-window → `true`, out-of-window → `false`. |
| **R-d4** | **What "contested" means is policy.** The `contestable` set identifies a valid in-window counter-proof, but what the owner may *do* with it (restore / re-vote / alert reviewer) is a governance decision; the mechanism is inert without it. | P4-d | No technical falsifier. The falsifier is the **absence** of a written Phase 0 A4 ruling defining "contest" in a minors-facing context. Proceeding to live use without it deploys the mechanism without policy grounding. |
| **R-d5** | **Unbounded `rejectedRevokes` under invalid-revocation flood.** Dedup absorbs duplicates, but a flood of novel-but-invalid revocations grows the rejected set unboundedly without a cardinality cap/eviction policy (owned by the integration harness + P4-c store, not the reconcile fold). | P4-d | Flood `foldRevocations` with 10,000 distinct invalid revocations; `rejectedRevokes` grows to 10,000. If unbounded without a cap, the residual is real and must be addressed before the P4-e integration harness passes. |
| **Transport / IP / honest-minority (carried from Phase 3)** | **Real P2P transport, IP exposure, honest-minority assumption, partition-past-window.** Phase 4 is transport-agnostic (relay or P2P, swappable) but inherits Phase 3's disclosed-not-closed transport residuals. | all (integration) | `runPartitionPastWindow`-style disclosure: under partition, no honest watcher reaches the window and a forged settlement finalizes. Protection is CONDITIONAL on the honest-minority assumption a partition breaks. Blocked by Phase 0 **B6/B7/D11**. |

**Bottom line:** Phase 4 wires proven parts — the CF-2 double-lock render-gate pattern, the CF-8 hash-chained state-machine + free-text human gate, the CF-6 validation/approval separation and its keystone ("decentralizing review must never decentralize trust by default") — into the roadmap's 4-layer minors-safety design, and closes the Phase 3 owner-reconciliation residual with a deterministic referee-free fold. The lab proves the **mechanism**: the predicates are correct, fail-closed, deterministic, and byte-identical across peers. The lab does **not** prove **safety**: the values of M, N, k, freshness, the enrolled set, the `reason_code` enum, and the very definition of "cleared for minors-facing visibility" are **counsel-defined inputs**, and the patched-client, sybil-enrollment, no-hard-delete, colluding-quorum, and propagation-gap residuals above are disclosed and falsifiable, never asserted closed. Phase 0 counsel remains **BLOCKING**. This document is a PLAN; it writes no ADR and no code.
