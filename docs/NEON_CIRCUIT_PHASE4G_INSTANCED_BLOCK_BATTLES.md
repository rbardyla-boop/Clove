# Neon Circuit — Phase 4G: Instanced, Non-Destructive Block Battles (Block Trial)

**Status:** implemented, local-only (branch `feat/neon-circuit-phase4g-instanced-block-battles`; Phase 4F
`3fd125e`, 4E `01e7ee0` are ancestors; branched off the current tip).
**Goal:** prove the first **instanced, non-destructive Block Trial** — an eligible host opens a temporary,
isolated gameplay instance that **copies a safe snapshot of the block's stewardship style**, lets players
**cooperatively stabilize signal nodes** against a server timer, emits a public-safe ephemeral outcome, then
**discards the instance — the live public city and its canonical stewardship style are never edited.**

> Product surface = **"Block Trial"** running the **"Signal Grid Trial"** objective. The roadmap term
> "Block Battle" appears in this doc/roadmap only; the product copy never uses war/weapons/gambling language.

Builds on [NEON_CIRCUIT_PHASE4F_BLOCK_STEWARDSHIP.md](NEON_CIRCUIT_PHASE4F_BLOCK_STEWARDSHIP.md).
Core rule unchanged: **players send intent, the server owns truth.**

> Note: `docs/PROJECT_CHARTER.md` was intentionally **not** edited in 4G — it currently holds unrelated
> uncommitted ADR edits, so per scope discipline the 4G ADR lives here only.

## 1. What changed from 4F

| Area | 4F | 4G |
|---|---|---|
| Gameplay | constrained visual editing | **instanced, non-destructive Block Trial** (Signal Grid) |
| Instance | — | one temporary in-memory instance per city, copies the stewardship style, discarded on close |
| New events | stewardship preview/apply/reject/reset | `city_block_trial_requested/started/joined/updated/completed/rejected/closed` |
| New messages | stewardship state/result/request | `city_block_trial_state` + `city_block_trial_result` (server→client); `city_block_trial_request/join_request/leave/close_request` (client→server, rate-limited) |
| Client UI | stewardship editor | + **BLOCK TRIAL** panel + signal-node render overlay |
| `SCHEMA_VERSION` | 5 | **6** (additive) |

Additive + backward-compatible: no-dt inputs and the entire 4A/4B/4C/4D/4E/4F message set remain valid; a
client that ignores trial state still works; unknown messages still fail safe.

## 2. Authority model

The trial is **subordinate** to city authority. The SERVER owns instance creation, membership, the copied
style snapshot, start/end, the round timer (`ends_at`), node state, score, outcome, disconnect cleanup, and
every event. The CLIENT owns rendering/camera/input/UI/effects. **Players move with the existing authoritative
`city_input`** (no new movement path); the trial reads each member's server position from `this.state.players`
and latches nodes — so node stabilization uses server-validated positions for free, and the client can never
assert score or outcome. A forged `city_block_trial_*`/`city_event` → `unknown_type`.

## 3. Instanced / non-destructive doctrine

A Block Trial is an **isolated temporary gameplay instance** that **copies** a safe visual snapshot of the
block style, lets players compete/cooperate, then is **discarded without damaging the live public city**:
- the trial copies `normalizeBlockStyle(this.stewardship)` into `copied_style` — a fresh object, never an alias;
- the trial **never writes** `this.stewardship`, never mutates `this.state` players/collision/portal, and
  never touches the arcade economy;
- closing/expiring discards `this.trial`;
- the trial is **in-memory + ephemeral** (no new storage key, no new DO, no migration) — a cold DO simply has
  no trial. Phase 4G proves the instance *model*, not scale; a fully separate spatial instance is Phase 5.

## 4. What "block battle" means / does not mean

It **is**: an isolated, temporary, cooperative, non-violent, non-destructive practice instance with an
ephemeral, non-cash outcome. It is **not**: war / weapons / combat / damage / gambling / wagering / paid entry /
ownership conflict / a way to steal, damage, capture, buy, sell, rent, or transfer a public block. No economic
or ownership consequence results from a trial.

## 5. Match lifecycle

`active` → `complete` (all nodes stabilized = `stabilized`, or `now ≥ ends_at` = `timeout`) → `closed`.
`createTrial` (active, started_at/ends_at, nodes, copied_style); `stepTrial({now,positions})` latches nodes,
recomputes the bounded score, and completes (pure, immutable; an active trial has no outcome, so a client-
supplied outcome can never survive); `closeTrial` discards it. Outcome `{ result, stabilized, node_count,
duration_ms }` is display-only/ephemeral.

## 6. Instance state model (`arcade/city/city-battle-instance.mjs`, pure)

`{ schema_version, instance_id, city_id, status, objective:'signal_grid_trial', started_at, ends_at, players:{},
copied_style:{}, signal_nodes:[{id,x,y,stabilized}], score, score_cap, outcome, public_safe:true }`. Exports:
`createTrial`, `addTrialPlayer`, `removeTrialPlayer`, `stepTrial`, `closeTrial`, `isTrialActive`, `trialChanged`,
`trialStatePayload`, `nodesAreWalkable`, `TRIAL_DURATION_MS` (60s), `NODE_RADIUS` (48u), `SCORE_CAP` (3). PURE:
deterministic, bounded, no async/network/AI/randomness/mutation; no rewards/money/inventory/ownership.

## 7. Objective design (Signal Grid Trial)

3 fixed, deterministic, **walkable** signal nodes on the plaza/road (verified clear of buildings). A node
latches `stabilized` (monotonic) when ANY trial member's authoritative position is within `NODE_RADIUS`.
`score = stabilized count`, `score_cap = 3`. Cooperative, non-violent, non-destructive — no combat, damage, or
weapons. Eligibility to **start** = `isStewardshipEligible(host_rank)` (Host Rank as one signal; it grants
nothing itself); **join** is open to any city member (inclusive practice).

## 8. Public-city non-destruction guarantee

Proven by a pure test (the stewardship style object is byte-identical after create + step + close) and the
browser smoke (`stewardship().arcade_front.palette` is unchanged after a full trial). No trial path writes
`cityStewardship`/`cityState`; the trial only appends public-safe trial events to the bounded log.

## 9. Event schema (server-authored, public-safe)

Seven types added to the existing append-only log: `city_block_trial_requested/started/joined/updated/completed/
rejected/closed`. Payload allowlist extended with `instance_id`, `objective`, `status`, `node_count`,
`stabilized_count`, `duration_ms` (`score`, `score_cap`, `reason` already allowed). `actor_public_id` is the
requesting player's existing public id (system-authored for tick updates). No private/economy/ownership/URL/
raw-style/wager/entry-fee/reward-value field can ride (allowlist + finiteness guard enforce it).

## 10. Retention / bounding

One active trial per city; ≤3 nodes; bounded members; trial events ride the bounded 50-entry FIFO log; updates
emit only on a node-latch/status change (≤ node_count + a few). Requests rate-limited per socket
(`SNAP_REQ_MIN_MS = 250`). No persistence, no unbounded growth.

## 11. Client display

A compact **BLOCK TRIAL** city-OS panel (`#cityBlockTrial`, mobile-safe, `textContent` only, fixed buttons via
`addEventListener`): objective, status, score `n/3`, copied-style line, Start/Join/Close (Start gated on
eligibility), and a clear "No public block changes were made." note on completion. The 2D renderer draws the
signal nodes (rings; stabilized = filled) tinted with the copied street-lights accent. `city-net.js` gains
`requestTrial/joinTrial/leaveTrial/closeTrial` + `onTrialState/onTrialResult`; `__neon_city` gains `trial()`,
`requestTrial()`, `joinTrial()`, `closeTrial()`, `lastTrialResult`. Copy is trial-only — never money/wager/
entry-fee/ownership.

## 12. Product-safety / privacy model

Trial output carries only enum/scalar tokens (status, objective, bounded score/score_cap/node counts, copied
style tokens, node coords). No balances/inventory/account/token/secret/admin/URL/custom-text. No third-party
telemetry. No paid entry, no wager, no cash payout, no ownership transfer, no marketplace — a trial is a
non-destructive practice instance with an ephemeral, non-cash outcome.

## 13. Size-budget result (GTA-80)

`node scripts/check-city-build-size.mjs` → **0.716 MB uncompressed / 0.190 MB gzipped** — within GTA-80
(≤80 MB) and the GTA-34 (≤34 MB gz) stretch. Procedural only (a small pure module + a little UI + a tiny
renderer overlay); no assets, no new client dependency.

## 14. Validation commands

```bash
node --test tests/arcade/*.test.mjs            # pure trial + stewardship + host-rank + scheduler + event-log + all existing
node tests/arcade/check-production-config.mjs
node scripts/check-city-build-size.mjs
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-block-trial.sh   # NEW 4G smoke
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-stewardship.sh   # 4F regression
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-host-rank.sh     # 4E regression
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-scheduler.sh     # 4D regression
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-event-log.sh     # 4C regression
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-authority.sh     # 4B regression
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-block.sh         # 4A regression
bash tests/arcade/run-two-client.sh ; bash tests/arcade/run-frame-contract.sh   # arcade regression
cd workers/arcade && npx wrangler deploy --dry-run --outdir dist                # Node 22; no deploy
```

## 15. Known limitations

- The trial is a **state-level instance overlaid on the shared city movement space** (it owns isolated
  objective/score/node/style-snapshot state and is discarded on close); a fully separate spatial instance is a
  Phase-5 concern.
- `this.trial` is **in-memory + ephemeral** — a DO restart discards an in-progress trial (public city +
  stewardship are unaffected). One active trial per city.
- The Signal Grid objective is intentionally minimal (cooperative node stabilization, no competitive scoring
  beyond shared progress) — richer objectives are future work.
- The signal-node overlay is drawn by the 2D renderer (the robust, tested path); the Three renderer overlay is
  follow-up.

## 16. Phase 5 forward seam (docs-only; NOT built)

**Phase 5 — Multi-block District / Release Integration:** multiple city blocks, routing between blocks, a
shared registry/discovery layer, and trial instances per block. Stewardship stays constrained, Host Rank stays
non-cash, and there is **no economy expansion without a separate review.** Not implemented in 4G.

## 17. Non-goals (4G)

No Phase 5; no map expansion; no destructive city edits; no weapons/combat/damage/police/LLM-NPCs/vehicles; no
paid entry/hosting; no crypto/blockchain/token/NFT; no staking/yield/resale/cash-out/gambling/wager/marketplace/
prize-cash/transferable goods; no accounts/OAuth/global leaderboard/persistent inventory; no ownership transfer/
rent/income/payout/trading/asset-market; no free-form UGC/upload/arbitrary CSS-HTML-JS; no public-city griefing;
no HiveWorld bridge / `arcade/hiveworld-sim/`; no unrelated `game/*`; no change to arcade ticket formulas, prize
costs, challenge rewards, event schedules, Host Rank scoring, or stewardship eligibility; no break to 4A–4F
clients; no deploy/credentials/`wrangler login`/push/history-rewrite. A trial grants nothing economic and the
public city is never damaged.
