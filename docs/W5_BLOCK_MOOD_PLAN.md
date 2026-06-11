# W-5 — City Block Mood (display-only block-collective recognition)

**Status:** IMPLEMENTED per ADR-042 (see `docs/PROJECT_CHARTER.md`). This file is the concise
canonical record of the adversarially-reviewed plan (5 reviewers + 3 red-team lenses, all
approve-with-changes; every required change folded in).

## Product

ONE atmospheric prose line about the **current block only**, in the district panel between
the identity tagline and the District Tour — the block's collective "weather":

> "Harbor's dockside hums with comings and goings."

It means *this place feels alive right now*. It is **not** a score, rank, tier, count, meter,
reward, earning, balance, or anything comparative or persistent. No numeral ever renders.
Per-player attribution stays deferred (ADR-009). The feature is named **mood**, not
"recognition" — "recognition" is a W-4 agent-ledger memo token, and the production surface
must not share vocabulary with a value-transfer primitive.

## Architecture (all client-side; Worker byte-identical)

| Layer | File | Role |
|---|---|---|
| Boundary | `arcade/city/city-block-mood-intake.mjs` | dedup-then-strip: type allowlist (3 server-emitted event types), current-block filter (`city_id`), future-stamp reject, **1-per-(actor,type)-per-window transient dedup** for actor-bearing events, null-actor (trial) events dedup by `event_id` only, payload+identity dropped — only `{event_id, type, server_time}` survives |
| Model | `arcade/city/city-block-mood.mjs` | 60s window, per-type clamp (3), internal tone enum `ebb/flow/surge` (never rendered), frozen 6×3 copy table, exact 4-key envelope `{schema_version, city_id, atmospheric_text, public_safe}` |
| Wiring | `arcade/city/city-scene.js` | feeds intake at onEvents/onEvent; intake reset on every welcome (block switch/reconnect); one `textContent` write in `renderDistrict()` |
| Style | `arcade/city/city.css` `.dist-mood` | ONE constant treatment across tones (a tone→color map would itself be a gauge); wraps, never truncates; no new aria-live |

**Inputs (closed):** `city_portal_enter_accepted`, `city_arcade_interior_opened`,
`city_block_trial_completed`. **Excluded by design:** Host Rank (data-layer exclusion — note
the honest caveat: trial events are *indirectly* host-rank-gated server-side at creation),
presence, pressure, the activity feed, all arcade/room data (**no room→block binding exists**;
this absence is the structural anti-creator-receivable fence — the moment cabinet-play events
feed block mood, rung-1 becomes the accrual leg of a payment chain), tickets/ledger/prizes/
achievements/challenges/playerId, and `arcade/hiveworld-agents/` (simulator-only).

**Named AE-8 trade-off:** identity stripping forfeits per-actor dedup in the pure model; the
design substitutes **saturation for dedup** (boundary dedup + per-type clamp + 3-tone
saturating output + no rendered numeral + a surface that grants nothing). The client id is
URL-overridable (`?id=`), so dedup keys are attacker-chosen; the defense is the clamp +
quantization. Worst-case manipulation buys one adjective on the attacker's own block.

**Honesty rules:** copy is present-tense ("right now") — never "this session"/"this hour"
(the server event log is a rolling 50-event window re-sent on reconnect). Visible windowed
counts were **rejected** (grind invitation per AE-4; ordinal → cross-block ranking per AE-10;
numeric decay reads as loss per AE-12; dishonest under the 50-event trim; the repo itself
suppresses its one windowed number in `renderHostRank`; "community plays" would be fabricated
absent a room→block binding).

## Copy rules (all 18 cells mechanically screened in tests)

Block-name lead · present tense · place/crew as subject · ≤72 chars (authored ≤60) · no
digits/`%` · no prose quantities (plenty/several/many/crowds/packed) · no second person, no
"player"/"creator" · no rank/comparison lexicon (top/best/than/streak/score/win/record…) · no
tone or host-rank vocabulary (ebb/flow/surge/quiet/steady/lively/active/low/mid/high) · no
inflected economy stems (earns/rewards/payouts/minted/transfers…) · no other block's name ·
ebb cells neutral/positive, never deficit-framed.

## W-5b (server-authored aggregate): DEFERRED

Technically cheap (additive field on the 6B snapshot path) but doctrinally blocked three
ways: the AE-8 host-rank scorer is un-deduplicated; `city_blocks` is the discovery manifest
(AE-10 reputation-ranked-discovery seam); widening the frozen `SNAPSHOT_FIELDS` allowlist
needs its own charter ADR + doctrine amendment.

## W-6 framing (future, separate plan — NOT authorized here)

Per operator clarification: W-6 is the **In-game Agent Attention Ledger** — non-cash
attention units routed between system-shaped node agents (`arcade-room:*`, `city-room:*`,
`cabinet:sha256:*`) so the city decides what gets surfaced/featured. Never human balances,
receivables, ownership, cash claims, or withdrawal paths. The W-4 simulator's *structure*
already matches; its *vocabulary* is queued for rename at W-6 planning (`tickets_minted` →
attention-grant framing, per-agent `balance` → attention level, "payment/payout" comments →
attention flow). W-8 cash earning remains blocked on counsel (G-MINORS/G-MONEY/G-UGC/G-CSAM).

## Validation (see tests for the living gate)

`tests/arcade/city-block-mood.test.mjs` (27 unit tests: envelope exactness, identity
zero-effect, dedup/null-actor/clamp/window/decay/flood, all 18 cells × every screen,
forbidden-key walk, PANEL_FORBIDDEN sync) · `tests/arcade/run-city-block-mood.sh` (19-check
browser smoke incl. real-event tone shift, block-switch reset, zero web storage, 360px wrap)
· grep guards G1–G8 + import-boundary B1–B4 recorded in ADR-042 and the PR.
