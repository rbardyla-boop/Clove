# HiveWorld Lab — Operator Surface (local-only)

This directory is the **operator-readable summary of the W-6 lab**: what the simulator has
proved, what it broke, what must never ship, and what could become a future production slice.
Everything here is documentation or a deterministic JSON artifact. **Nothing in this directory
or in `arcade/hiveworld-agents/` ships**: the lab directory is denylisted from the curated
client upload and is imported by no Worker/DO/client path. There are no live admin tools here
and none should ever be added.

## Artifacts

| File | What it is | Regenerate with |
|---|---|---|
| `attention-evidence-seed42.json` | The baseline W-6 evidence pack (claims C1–C10) at seed 42 — the pack the W-6 gate requires | `node arcade/hiveworld-agents/write-evidence-artifacts.mjs` |
| `attention-stress-suite.json` | The stress + adversarial suite (claims S1–S8) across seeds 42/1337/9001 at 2000-round scale | same script |

Artifacts are **seeded and timestamp-free**: re-running the script on the same code produces
byte-identical files, so a reviewer verifies an artifact by regenerating it and diffing.

## What the lab has PROVED (fold-level safety only)

- **Replay determinism & convergence** (C1/C2/C3, S1/S2): the attention fold reaches the same
  fingerprint under replay, arbitrary reorder, and duplicate delivery — at 240-round and
  2000-round scale, across independent seeds.
- **Conservation & bounds** (C4/C5/C6, S5): grants fully account for every attention level;
  over-cap grants/routes and overdraws are rejected; no level ever goes negative.
- **No exit, no person** (C7/C8): no event kind moves value out of the system (injected
  cash-out/withdraw shapes are rejected as `unknown_kind`); person-shaped agent ids are
  structurally rejected — agents are system nodes only.
- **Drain resistance** (C9): one route per (from, round) — replaying a settled round is rejected.
- **Audit-log convergence under hostile delivery** (S3/S4/S7): re-delivering already-REJECTED
  events any number of times changes neither state nor audit log; identity-less malformed
  floods collapse to a single `'?'` audit entry; a mixed storm (shuffle + valid-dup +
  rejected-dup + malformed) leaves the agent state byte-identical.
- **Surfacing discipline** (S8): the block-collective rollup counts bound CABINET nodes only —
  room bindings and unbound cabinets never contribute (per-person attribution stays deferred,
  ADR-009).

## What BROKE (and was fixed) — the lab's real findings

1. **Rejected-event audit divergence** (found by C3, fixed, then ported to W-4
   `agent-ledger.mjs`): re-delivering an already-rejected event re-logged the rejection, so
   the audit log and fingerprint diverged under duplication. Both lab folds now dedup
   rejections by event identity with first-seen-reason preserved.
2. **Attack-injection authoring trap** (found by C9): attacks must target the *realized*
   scenario (the room that actually routed round 0), not a schema-level guess — otherwise the
   "attack" is legitimate traffic and the claim silently weakens.

## What should NEVER ship (binding for any W-6 production plan)

- Any **exit kind** — cash-out, withdraw, redeem, sell, wallet. The fold rejects unknown kinds;
  production must too.
- Any **person-shaped account** — `player:*`, `user:*`, `account:*` and friends are
  structurally rejected. Attention attaches to system nodes (`arcade-room:*`, `city-room:*`,
  `city-registry:*`, `cabinet:sha256:*`) only.
- Any **balance/payment vocabulary** — it is an `attention_level`, never a balance; events
  grant/route, never pay/mint/transfer (C10 screens state keys for this).
- Any **free-text memo** — routing signals come from the closed token set.
- Any **per-person attribution or creator-receivable surface** — deferred by ADR-009 and the
  Phase 9 doctrine (AE-1…AE-13); block-collective rollups only.

## What MIGHT become a future production slice (operator decision, separately gated)

- **W-6 In-game Agent Attention Ledger** (ADR-041/ADR-042 ladder): the fold semantics proven
  here, wired server-side behind the existing DO authority. Requires: this evidence pack
  (exists), a dedicated production plan, and explicit operator authorization. NOT authorized
  by this branch.
- **Block surfacing from attention** (the S8 rollup): could one day inform which block gets
  `district_block_focus` events — display-only, no player-visible numbers, same closed-copy
  rules as the W-5 mood line.

## Evidence scope (honest limits)

Simulation evidence supports **fold-level safety claims only**. It says nothing about
production wiring, abuse economics at human scale, moderation load, or legal posture — those
are the W-7 (CF-7) and W-8 (counsel) gates. See `arcade/virtual-arcade/HIVE_WORLD_ALIGNMENT.md`
§6–§7 and `docs/PHASE_9_ECONOMY_DOCTRINE_PLAN.md`.
