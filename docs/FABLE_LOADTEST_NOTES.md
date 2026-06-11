# Fable Load-Test Branch — Notes (experimental, local-only)

**Branch:** `feat/fable-loadtest-hive-world-next` (off `main` @ 92a2d19). **Status:** EXPERIMENTAL.
This branch is an intentionally higher-throughput build pass across four streams, validated hard
at the end rather than per-step. Nothing here is deployed, pushed, or production-gating; W-6
remains lab-only; CF-7 stays disabled; no real-money/cash-out/ownership/receivable mechanics exist.

## What was built

1. **W-6 LAB — attention-ledger evidence pack** (`arcade/hiveworld-agents/attention-ledger.mjs`,
   `attention-evidence.mjs`): the attention-framed successor to the W-4 agent ledger
   (grants/routes of "agent attention units" between system-shaped nodes; `attention_level`,
   never balance; closed coordination-signal tokens; no exit kind). A seeded, deterministic
   evidence harness builds a multi-room/multi-cabinet scenario with injected attacks and proves
   claims C1–C10 (replay determinism, reorder convergence, duplicate safety, conservation, caps,
   no-negative, no-exit, no-person, one-route-per-round, vocabulary cleanliness). SIMULATOR ONLY —
   the directory stays on the curated-upload denylist and is imported by nothing production-facing.
2. **City density pass** (display-only): per-block **landmarks** on the identity line (Signal
   Spire / Tide Crane / Beacon Crown / Ember Gantry / Junction Ring / Glass Arbor), **corridor
   wayfinding voice** under the Ring / New-corridor group headers (hidden on phones), and a
   phone-tray bound on the activity feed (scrollable, content stays in DOM). No new authority,
   no rewards, no counts.
3. **Creator tools**: district editor gains **import-an-existing-pack** (continue editing; the
   shared validator, not the UI, judges every tile), and the arcade builder gains two new closed
   procedural variants — **orbit-catch** and **tide-gate** (5 total, all CF-4 importer-clean,
   data-only generation as before).

## What broke (and what it taught)

- **REAL FINDING — fold convergence gap under duplicate delivery of REJECTED events.** The
  evidence pack's C3 probe caught that re-delivering an already-rejected event re-logs the
  rejection, so the audit log (and fingerprint) diverges under duplication. Fixed in the
  attention ledger (rejections now dedup by event_id like applications). **The merged W-4
  `agent-ledger.mjs` has the same gap** — its own convergence test only duplicated VALID events.
  Recommended cleanup-pass item: port the `rejectedIds` fix to `agent-ledger.mjs` (lab-only, low
  stakes, but the invariant should match).
- **Scenario authoring bug (mine):** the drain-replay attack initially targeted a random room
  rather than the room that actually routed round 0, so the "attack" was legitimate traffic and
  C9 reported MISSING. Fixed by pinning the attack to the recorded round-0 room. Lesson: attack
  injections must be constructed against the *realized* scenario, not the schema.
- **Shape-pinning test friction:** `city-block-identity.test.mjs` pins the exact identity object
  shape with deepEqual, so adding the `landmark` field required extending those literals. Cheap
  here, but worth knowing: identity-shape tests will fire on every additive field.

## Boundary gates held throughout

No deploy · no push · CF-7 `LIVE_WORLD_LOADER_ENABLED = false` untouched · `workers/**` untouched
(Worker byte-identical by construction) · W-6 lab-only (`hiveworld-agents/` denylisted +
unimported) · no real-money/cash-out/payout/person-receivable vocabulary anywhere new (greps in
the end-validation record) · per-player attribution still deferred (ADR-009).

## Deferred / not done on this branch

- W-4 `agent-ledger.mjs` rejection-dedup port (recommended next cleanup pass).
- This branch is based on main WITHOUT PR #62 (W-5 block mood); `city-scene.js` edits here will
  need a trivial merge against W-5's edits when both land (different regions of renderDistrict;
  expect clean or near-clean merge).
- No ADR added: nothing here changes an authority/economy boundary — the attention reframe is
  already recorded in ADR-042 and HIVE_WORLD_ALIGNMENT §6; this branch only builds the lab
  evidence behind it.
