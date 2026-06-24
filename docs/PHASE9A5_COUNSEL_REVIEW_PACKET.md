# Phase 9A.5 — Counsel Review Packet (engineering evidence index)

> **This packet states no legal determinations and is not legal advice.** It is a clerical
> index that points qualified counsel to the engineering facts, exact `file:line` evidence,
> tests, and open questions assembled in the Phase 9A.5 economy audit. It does not assert that
> anything is permitted or prohibited. It changes no production code, copy, flag, or behavior.
> Legal determinations are out of scope and belong to counsel.

## 1. Status

- **Counsel review packet** — an index over the Phase 9A.5 audit, not a second analysis.
- **Engineering evidence index** — every entry resolves to a real `file:line`, test, or doc.
- **Not legal advice.** No determinations of permissibility are made or implied.
- **No production change.** Docs-only. No economy runtime, copy, flag, route, or deploy touched.
- Companion to `docs/PHASE9A5_ECONOMY_LEGAL_SAFETY_AUDIT.md` (the full record) and `docs/PROJECT_CHARTER.md`
  ADR-047 (CF-7 live loader stays disabled until this review resolves). All three are in PR #87.

## 2. Purpose

This packet consolidates the Phase 9A.5 audit evidence so external counsel can review the live,
persistent, **non-cash** arcade economy efficiently — without re-deriving the codebase. It:

- summarizes the eight counsel-question gates (§3),
- presents the verified engineering facts in one table with evidence + test columns (§4),
- gives a direct `file:line` evidence index to the most load-bearing code, copy, tests, and docs (§5),
- lists the controls already present (§6) and the open gaps (§7),
- enumerates the operator decisions that are **blocked pending counsel** (§8),
- provides a reproducible review checklist (§9) and the grep commands used (§10).

The authoritative detail lives in the audit; where this packet cites a section (e.g. "audit §7.A"),
read that section for full context. **The packet adds no new claims beyond the audit.**

## 3. Counsel questions summary (from audit §6–§7)

Counsel is asked to answer these; the packet does **not** answer them. For each, the audit records the
triggering repo fact, current mitigating facts, and a recommended safe default.

- **Minors / child privacy / age-appropriate design** (audit §6, §7.A) — Is the service "directed to
  children" or "likely to be accessed by children" (e.g. COPPA / GDPR Art. 8 / UK AADC) given it is
  public, account-less, educational-branded, and carries persistent per-pseudonym progress? What
  obligations follow?
- **Chance / prize / reward mechanics** (audit §7.B) — Do any current or planned mechanics implicate
  chance-based / loot-box rules? (Today: redemption is deterministic; the one "Mystery Unit" is
  disabled.)
- **Consumer protection / misleading design** (audit §7.C, §8) — Are the earn→spend→scarcity-label
  loop and the "Redeem / Owned / rarity" framing fair and transparent for a general (possibly young)
  audience?
- **Virtual currency / stored value / redeemability** (audit §7.D) — Does a durable, spendable,
  per-pseudonym balance redeemable only for cosmetics constitute "stored value" under any applicable
  regime? (Today: no cash-in, no cash-out, no transfer.)
- **KYC / money transmission** (audit §7.E) — *Conditional:* would arise only if a transfer or
  cash-out path were added. None exists today.
- **Securities / ownership language** (audit §7.F) — *Conditional:* would arise only with
  ownership-as-investment / profit / appreciation framing. None found today.
- **Data retention / deletion / access** (audit §7.G) — Retention-limitation and data-subject-access
  questions for a durable pseudonymous record that has **no per-player delete/export path** (only a
  room-wide admin reset).
- **Jurisdiction scope** (audit §7.H) — Which regimes apply, given public global reachability?

There is also a **positioning tension** for counsel (audit §6, §10): a public "no servers / nothing
leaves your device" marketing claim on the same domain as a server-side persistent per-player economy.

## 4. Engineering fact summary

All facts verified on `main @ 3c473b1` and re-verified on the working tree for this packet. "Verified"
means a direct `file:line` reference resolves; "tested" means a unit test exercises the behavior.

| Fact | Verified | Evidence (file:line) | Test coverage | Counsel relevance |
|---|---|---|---|---|
| Persistent DO-durable arcade state | yes | `workers/arcade/src/arcade-room.ts:156`, `:177` (`storage.put("arcadeState")`); reload `:166-177` | indirectly via ledger/prize tests | retention / stored-value / minors progress |
| State keyed by `playerId` | yes | `round-authority.mjs:85-100` (per-player maps); `arcade-room.ts:384-394` | `ledger.test.mjs`, `prize-authority.test.mjs` | identity, data-subject access |
| `playerId` is client-supplied / spoofable | yes | `arcade/neon-circuit-room-client.js:116-124` (localStorage `neon-arcade-player-id`); validated **format only** `arcade/city/city-block.mjs:201-203`, `arcade-room.ts:391` | — | identity integrity, record ownership |
| Ticket earn + per-round cap | yes | `workers/arcade/src/tickets.mjs:33` (`MAX_PAYOUT: 40`), `:21-52` | `tickets.test.mjs` | chance/consumer, payout bounding |
| Durable spendable balance | yes | `round-authority.mjs:87`; spend `prize-authority.mjs:42-45` | `ledger.test.mjs` | stored-value question |
| Ledger (append-only, idempotent) | yes | `workers/arcade/src/ledger.mjs` (idempotent by `ledger_id`) | `ledger.test.mjs` | record durability |
| Prize redemption flow | yes | `prize-authority.mjs:32-71` (`redeemPrize`); catalog `catalog.mjs:81-93` | `prize-authority.test.mjs` | prize mechanics, deterministic cost |
| Inventory / equips state | yes | `prize-authority.mjs` (owned cosmetics; equip own only) | `prize-authority.test.mjs` | durable per-player holdings |
| Achievements (badges) | yes | `workers/arcade/src/achievements.mjs` | `achievements.test.mjs` | durable per-player progress |
| Challenges (rewards) | yes | `workers/arcade/src/challenges.mjs` (badge or `+N tickets`) | `challenges.test.mjs` | reward mechanics |
| Cosmetics are `bound_to:'session'` (non-transferable) | yes | `prize-authority.mjs:4,10,14,51`; catalog `catalog.mjs:82-86` | `prize-authority.test.mjs` | non-transfer = mitigating fact |
| **No cash-out path** | yes (absent) | `prize-authority.mjs:14-15`; non-goals `NEON_CIRCUIT_PHASE1F_ARCADE_LOOP.md:33-47` | — | money-transmission gate inert |
| **No marketplace path** | yes (absent) | non-goals (Phase 1F/1H) | — | consumer/securities gate inert |
| **No player-to-player transfer** | yes (absent) | `prize-authority.mjs:14-15` | `prize-authority.test.mjs` | stored-value/KYC gate inert |
| **No account / login** | yes (absent) | `index.html:244` ("No accounts"); identity is local pseudonym | — | identity & minors analysis |
| Publicly reachable arcade (live) | yes | `PRODUCTION_ROLLOUT_PLAN.md` (live routes incl. `/arcade/ws`) | — | jurisdiction, minors reachability |
| **No age gate / no parental consent** | yes (absent) | none in repo; `index.html:244` | — | COPPA/Art.8/AADC analysis |
| Server-authoritative awards/spends | yes | `prize-authority.mjs:7-9` (client cost/balance ignored) | `prize-authority.test.mjs` | integrity, anti-tamper |
| Privacy-safe public projection | yes | `prize-authority.mjs:103-122` (balances/ledger never broadcast) | `prize-authority.test.mjs` | data-minimization |
| City (Phase 7C) is reward-free | yes | `NEON_CIRCUIT_PHASE7C_PRODUCTION_COMPLETION.md:32-34` | city-objectives tests | scopes economy to arcade floor only |
| CF-7 live loader disabled | yes | `arcade/creator/approval/approved-loader.mjs:31` (`LIVE_WORLD_LOADER_ENABLED = false`) | creator tests | creator UGC cannot touch economy |

## 5. File / line evidence index

**Persistence / Durable Object storage**

- `workers/arcade/src/arcade-room.ts:156`, `:177` — `ctx.storage.put("arcadeState", this.state)` (written per economy transaction).
- `workers/arcade/src/arcade-room.ts:166-177` — reload on init via `ctx.storage.get("arcadeState")`.
- `workers/arcade/src/round-authority.mjs:85-100` — persisted per-player state shape (`balances`, `ledger`, `inventory`, `equips`, `redemptions`, `challengeStats`, `challengeProgress`, `achievements`).
- Reset (room-wide only): `workers/arcade/src/arcade-room.ts:190-191,258-261` (`/admin/reset` → `newPartition`). **No per-player delete/export path.**

**Identity (`playerId`)**

- `arcade/neon-circuit-room-client.js:116-124` — localStorage `neon-arcade-player-id`, else random `'player_'+8` base36.
- `arcade/city/city-block.mjs:201-203` — `isValidPlayerId` (format only, 1–64 chars).
- `workers/arcade/src/arcade-room.ts:384-394`, `:391` — server validates format only; no auth/ownership binding.

**Ledger / balance / prize authority**

- `workers/arcade/src/tickets.mjs:21-52` — scoring bounds; `MAX_PAYOUT = 40` at `:33`.
- `workers/arcade/src/ledger.mjs` — append-only, idempotent by `ledger_id`.
- `workers/arcade/src/prize-authority.mjs:4-15` — header: server-authoritative, SESSION-BOUND, "never movable off it".
- `workers/arcade/src/prize-authority.mjs:32-71` — `redeemPrize` (server-authoritative spend, redemption dedup).
- `workers/arcade/src/prize-authority.mjs:103-122` — privacy-safe public projection (no balance/ledger leak).
- `workers/arcade/src/catalog.mjs:81-93` — 6 cosmetics, cost 10–50 tickets, `rarity_label` common→special, `bound_to:'session'`; `Mystery Unit` `enabled:false`.

**Client UI copy (tickets / redeem / prizes / owned / rarity)** — from audit §8 (verbatim, not edited here)

- `arcade/prize-counter.js:103,46,117,109` — `Redeem · {cost}🎟`, `Owned`, `Your cosmetics`, `No cosmetics yet — redeem one!`, `need more tickets`.
- `index.html:103` — `Your arcade tickets — server-authoritative`.
- `arcade/challenge-board.js:105,182` — `Claim` / `Claimed: {reward} ✓`.
- `workers/arcade/src/catalog.mjs:82-87,93` — `rarity_label` tiers; "Redeem arcade tickets for cosmetics."
- `arcade/arcade-lobby.js:87` — "Each room has its own tickets, inventory, challenges and feed. Nothing carries across rooms." (true **across rooms**; the within-room record is durable.)

**Tests proving non-cash / non-transfer / cap behavior**

- `tests/arcade/tickets.test.mjs` — payout bounds / `MAX_PAYOUT`.
- `tests/arcade/ledger.test.mjs` — durable balance, idempotent ledger.
- `tests/arcade/prize-authority.test.mjs` — server-authoritative redemption, session-bound (non-transfer), privacy projection.
- `tests/arcade/achievements.test.mjs`, `tests/arcade/challenges.test.mjs` — durable per-player progress.
- *(Note: tests verify behavior, not legal posture. Audit §12 recommends adding explicit negative tests asserting no transfer/cash-out/marketplace path exists before any expansion.)*

**Docs that describe economy assumptions**

- `NEON_CIRCUIT_PHASE1F_ARCADE_LOOP.md:33-47`, `NEON_CIRCUIT_PHASE1H_CHALLENGE_BOARD.md:51-66` — non-goals (no real money / crypto / cash-out / gambling).
- `PRODUCTION_ROLLOUT_PLAN.md` — live routes.
- `NEON_CIRCUIT_PHASE7C_PRODUCTION_COMPLETION.md:32-34` — city is reward-free.
- `docs/PROJECT_CHARTER.md` ADR-047 — CF-7 disabled until this review resolves.

**Docs that conflict with the verified persistence facts**

- `NEON_CIRCUIT_GAMEPLAY_CHARTER.md:150,261,269` — "session-scoped" / "no cross-session retention as wealth" (does **not** match the durable, playerId-keyed code).
- `PHASE_9_ECONOMY_DOCTRINE_PLAN.md:4,46` — already flags the cross-session durability as an "OPEN reconciliation question".

## 6. Current mitigations (verified facts only)

- **Non-cash** — prizes are cosmetics; no real-money value (`prize-authority.mjs`, catalog).
- **No cash-out** — no path to convert tickets/cosmetics to money (`prize-authority.mjs:14-15`).
- **No marketplace** — no buy/sell surface (Phase 1F/1H non-goals).
- **No transfer** — entitlements `bound_to:'session'`, "never movable off it" (`prize-authority.mjs:4,10,14`).
- **Capped payout** — `MAX_PAYOUT = 40` per round (`tickets.mjs:33`).
- **Server-authoritative balance changes** — client-supplied cost/discount/balance ignored (`prize-authority.mjs:7-9`).
- **Privacy-safe projection** — balances/ledger/full inventory never broadcast (`prize-authority.mjs:103-122`).
- **Pseudonymous** — no email/name/PII collected in the economy path.
- **Tests** — tickets/ledger/prize/achievements/challenges exercise the above behaviors.
- **CF-7 disabled by ADR-047** — `LIVE_WORLD_LOADER_ENABLED = false`; creator content cannot reach the live economy.

## 7. Known gaps for counsel

- **No documented legal review** of the economy (the audit + this packet are the escalation, not the review).
- **Public + minors reachability** — live, account-less, educational-branded, with persistent per-pseudonym progress; actual minor usage is **unmeasured** (no analytics).
- **No age gate** found.
- **No parental-consent mechanism** found.
- **No account identity** — identity is a spoofable local pseudonym (format-only validation).
- **No per-player reset / delete / export path** — only a room-wide admin reset.
- **Copy-risk terms** — "Redeem", "Owned", and rarity tiers borrow commerce/collectible framing (audit §8); whether any rewording is warranted is a counsel/product decision (not done in this sprint).
- **Charter ↔ code mismatch** — `NEON_CIRCUIT_GAMEPLAY_CHARTER.md` says "session-scoped"; the code is durable and playerId-keyed (audit §10).
- **Standing unknowns** (not in repo): Cloudflare DO idle-GC retention behavior; infrastructure-level connection logging.

## 8. Operator decisions blocked pending counsel

These are frozen until counsel answers §3 (audit §11–§12):

- **CF-7 live loader enablement** (currently disabled by ADR-047).
- **Economy-feature expansion** (no new persistence, identity, prize, or reward surface).
- **Marketplace / ownership / transfer / cash-out** (currently absent — must stay absent without counsel).
- **Public creator packages affecting rewards/economy.**
- **Copy-risk patch** to "Redeem / Owned / rarity" framing.
- **Per-player reset / delete path** + a documented retention policy.
- **Charter reconciliation** ("session-scoped" → verified persistent reality).

## 9. Evidence collection checklist (for counsel / operator)

- [ ] Clone / open PR #87 (`docs/phase9a5-economy-legal-safety-audit`).
- [ ] Read the full audit: `docs/PHASE9A5_ECONOMY_LEGAL_SAFETY_AUDIT.md`.
- [ ] Read this packet: `docs/PHASE9A5_COUNSEL_REVIEW_PACKET.md`.
- [ ] Inspect the linked files at the `file:line` anchors in §5 (optionally re-run §10 grep commands to reproduce).
- [ ] Answer the §3 counsel questions (A–H + positioning tension).
- [ ] Approve / reject / modify each blocked operator decision in §8.
- [ ] Record the outcome as an ADR in `docs/PROJECT_CHARTER.md` (and, if applicable, a legal memo).

## 10. Appendix — grep commands (reproduce the evidence)

Run from the repo root on `main @ 3c473b1` (or the audit branch):

```bash
# Persistence / DO storage
grep -rn 'storage.put("arcadeState"\|storage.get("arcadeState")' workers arcade

# Per-round cap
grep -rn "MAX_PAYOUT" workers/arcade/src/tickets.mjs

# Session-bound / non-transferable entitlements
grep -rn "bound_to\|SESSION-BOUND\|never movable" workers/arcade/src/prize-authority.mjs workers/arcade/src/catalog.mjs

# Client-supplied playerId + format-only validation
grep -rn "neon-arcade-player-id" arcade
grep -rn "isValidPlayerId" arcade workers

# Catalog (cosmetics, rarity, disabled Mystery Unit)
grep -rn "rarity_label\|Mystery Unit\|cost_tickets\|enabled" workers/arcade/src/catalog.mjs

# No accounts (public, account-less)
grep -rn "No accounts" index.html

# CF-7 live loader flag (stays false)
grep -rn "LIVE_WORLD_LOADER_ENABLED" arcade

# Doc ↔ code contradiction
grep -rn "session-scoped\|no cross-session retention" NEON_CIRCUIT_GAMEPLAY_CHARTER.md
grep -rn "OPEN reconciliation\|cross-session" PHASE_9_ECONOMY_DOCTRINE_PLAN.md
```

---
*Prepared as a read-only engineering evidence index for counsel. It contains no legal advice and makes
no determination of permissibility. Route the §3 questions to qualified counsel before any economy
expansion (audit §12 acceptance criteria gate all expansion).*
