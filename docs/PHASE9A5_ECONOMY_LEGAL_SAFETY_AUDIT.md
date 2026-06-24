# Phase 9A.5 — Economy Legal / Safety Audit (engineering fact record + counsel-escalation memo)

> **This document states no legal conclusions.** It does not assert that anything is legal,
> illegal, compliant, or non-compliant. It records what the shipped code, docs, and tests
> actually do (each fact cited to `file:line`), separates engineering facts from questions for
> qualified counsel, and recommends safe operator defaults. Legal determinations are out of scope
> and belong to counsel.

## 1. Status

- Read-only audit. **No production change.** No code, flag, balance, ledger, route, or deploy was
  touched by this document.
- Two artifacts in one: (a) an **engineering fact record** of the live arcade economy; (b) a
  **counsel-escalation memo** posing the questions a qualified reviewer should answer.
- Branch: `docs/phase9a5-economy-legal-safety-audit` off `main @ 3c473b1`. Docs-only.

## 2. Executive finding (facts, not conclusions)

Verified by code/docs/tests on `main @ 3c473b1`:

- **The arcade ticket→prize economy is implemented and deployed.** It is server-authoritative in a
  Cloudflare Durable Object and reachable behind the live `/arcade/ws` route
  (`PRODUCTION_ROLLOUT_PLAN.md`). *(Note the separation in §6: the GTA-style **city** at
  `/arcade/city/` is reward-free per Phase 7C; the economy lives on the **arcade floor**.)*
- **It is persistent, not session-ephemeral.** State is written to DO storage under key
  `arcadeState` (`arcade-room.ts:156`) and reloaded on init (`arcade-room.ts:166-177`); it survives
  disconnect, reconnect, and page reload.
- **It is keyed by a client-supplied `playerId`.** The id is generated/stored in browser
  localStorage as `neon-arcade-player-id` (`neon-circuit-room-client.js:116-124`), sent by the
  client in `join_room`, and validated only for format (1–64 chars, `isValidPlayerId`) — there is
  **no account, login, or ownership check**, so the id is spoofable
  (`arcade-room.ts:384-394`). For a returning visitor on the same device + room, balance,
  inventory, ledger, challenges, and achievements **persist across sessions**.
- **It is non-cash and non-transferable, with no cash-out or marketplace.** Prizes are cosmetics;
  entitlements are `bound_to:'session'` with no move/resale path (`prize-authority.mjs:4-15,46-54`);
  the Phase 1F/1H non-goals explicitly exclude real money, crypto, token/NFT, cash-out,
  staking/yield/resale, and gambling/wagering (`NEON_CIRCUIT_PHASE1F_ARCADE_LOOP.md:33-47`).
- **It is publicly reachable with no age gate and no accounts.** The product is live on
  `clovelearn.io`, brands itself as a learning platform, requires no signup ("All free. No
  accounts." `index.html:244`), and has **no age verification or parental-consent mechanism**
  anywhere in the repo.
- **It has not been through a documented legal review.** No counsel sign-off, ADR, or legal memo
  for the economy exists in the repo; `PHASE_9_ECONOMY_DOCTRINE_PLAN.md` itself flags the
  cross-session durability as an "OPEN reconciliation question" (`:4,:46`).

"Persistent + non-transferable" is the precise shape: **`bound_to:'session'` means the entitlement
cannot be moved to another player/session (non-transferable); it does *not* mean the state is wiped
on disconnect.** The state is durable and playerId-keyed. Prior "session-scoped" framing conflated
these two.

## 3. Scope

**Included (audited):** arcade tickets, prizes/redemption, balances, ledger, badges (achievements),
challenges, the round authority, the Durable Object persistence path, the client UI copy, and the
economy doctrine/charter docs.

**Excluded (verified absent in the economy path, unless noted):** real-money payment, crypto/NFT,
cash-out, player-to-player transfer, marketplace, accounts/login. The Phase 7C **city objectives**
are reward-free and excluded from the economy (`NEON_CIRCUIT_PHASE7C_PRODUCTION_COMPLETION.md:32-34`).
Live creator UGC is excluded (CF-7 `LIVE_WORLD_LOADER_ENABLED=false`).

## 4. Economy surface inventory

| Surface | File(s) | User-facing? | Persistent? | PlayerId-keyed? | Transferable? | Cash/redeemable for value? | Test coverage | Risk note (for counsel) |
|---|---|---|---|---|---|---|---|---|
| Tickets (earn) | `workers/arcade/src/tickets.mjs` | yes (HUD) | yes (in `arcadeState`) | yes | no | no (in-game only) | `tickets.test.mjs` | skill-graded; per-round cap `MAX_PAYOUT=40` (`tickets.mjs:33`) |
| Ticket balance | `round-authority.mjs:87` | yes | **yes** | yes | no | no | `ledger.test.mjs` | durable spendable balance per playerId |
| Ledger | `ledger.mjs` | "Recent activity" | **yes** | yes | no | no | `ledger.test.mjs` | append-only, idempotent by `ledger_id` |
| Prize redemption | `prize-authority.mjs`, `catalog.mjs` | yes ("Redeem") | yes | yes | no | no (cosmetics) | `prize-authority.test.mjs` | 6 cosmetics, cost 10–50 tickets, `rarity_label` common→special |
| Inventory / equips | `prize-authority.mjs` | yes ("Your cosmetics") | **yes** | yes | no | no | `prize-authority.test.mjs` | owned cosmetics; equip own only |
| Challenges | `challenges.mjs` | yes ("Claim") | yes | yes | no | no | `challenges.test.mjs` | rewards = badge or `+N tickets` |
| Achievements (badges) | `achievements.mjs` | yes (badges) | **yes** | yes | no | no | `achievements.test.mjs` | 8 badges; equip-compatible |
| Identity (`playerId`) | `neon-circuit-room-client.js`, `arcade-room.ts` | no | yes (localStorage + DO) | n/a | n/a | n/a | — | client-supplied, spoofable, no auth |

## 5. Persistence and identity facts

- **Storage path/key:** `ctx.storage.put("arcadeState", this.state)` (`arcade-room.ts:156`), written on
  every economy transaction; reloaded via `ctx.storage.get("arcadeState")` on init
  (`arcade-room.ts:166-177`).
- **What persists, keyed by playerId:** `balances`, `ledger`, `inventory`, `equips`, `redemptions`,
  `challengeStats`, `challengeProgress`, `achievements` (`round-authority.mjs:85-100`).
- **playerId source:** browser localStorage `neon-arcade-player-id`, else `'player_'+8` random base36
  (`neon-circuit-room-client.js:116-124`); client-sent in `join_room`; validated **format only**
  (`isValidPlayerId`, 1–64 chars) — no authentication or ownership binding (`arcade-room.ts:384-394`).
- **Lifetime:** survives disconnect/reconnect/reload for the same playerId + room; **indefinite**
  while the DO is live. *Unknown:* exact retention after DO idle (Cloudflare DO GC policy — not in repo).
- **Reset / deletion:** the **only** clear path is room-wide `/admin/reset` → `newPartition()` →
  `createTicketState()` (wipes all players) (`arcade-room.ts:190-191,258-261`). **There is no
  per-player delete/clear/export path.**
- **Spoofing / rotation:** any well-formed playerId is accepted; a user can present another's id
  (no ownership proof), or rotate by clearing localStorage (losing access to the prior record).
- **Scope:** per-room (rooms keyed in `state.rooms[roomId]`); lobby copy says "Nothing carries
  across rooms" (`arcade-lobby.js:87`).

## 6. Public / minors exposure (facts + counsel questions)

Facts:
- **Public + live:** `clovelearn.io` arcade/city is live (`PRODUCTION_ROLLOUT_PLAN.md`); live routes
  include `/arcade/ws` (arcade-floor economy DO) and `/arcade/city/ws` (reward-free city).
- **No age gate, no accounts, no parental consent** anywhere in the repo ("All free. No accounts. No
  ads." `index.html:244`).
- **Two distinct natures on one domain:** (a) static, localStorage-only self-help "drill" pages that
  market **"No servers. No analytics. No telemetry. Every byte stays in your browser"**
  (`clovelearn-positioning-one-pager.html`); (b) the **server-backed** arcade/city with a
  **DO-persistent, playerId-keyed economy**. The economy is **not** localStorage-only.
- **Audience signals are mixed:** branded "CloveLearn / mental growth / learning platform"; the
  deeper self-help content targets adults (trauma/addiction/therapist-matching —
  `no-excuses.html`, `mission-brief.html`); the arcade is a general-audience game.
- **No app-level analytics/PII collection** found in the economy path; identity is a local pseudonym.
  *Unknown:* infrastructure-level (Cloudflare) connection logging; any server-side logging of
  playerId.

Counsel questions (do **not** answer here): Is the service "directed to children" or "likely to be
accessed by children" under COPPA / GDPR Art. 8 / UK AADC, given it is public, account-less, branded
educational, and contains a game with persistent per-pseudonym progress? Does a public "nothing
leaves your device / no servers" positioning, shown on the same domain as a server-side persistent
per-player economic record, create a consumer-expectations or transparency concern?

## 7. Legal / safety review gates (questions for counsel)

For each: the repo fact that triggers it, the counsel question, current mitigating facts, unknowns,
and a recommended **safe default**. None of these is a legal conclusion.

**A. Minors / child privacy / age-appropriate design.** *Trigger:* public, no age gate/accounts,
educational branding, persistent per-pseudonym progress. *Question:* COPPA/Art.8/AADC applicability
and obligations. *Mitigating:* no PII collected; pseudonymous local id; non-cash. *Unknown:* actual
minor usage (unmeasured — no analytics). *Safe default:* freeze economy expansion; get counsel before
any new persistence or identity feature.

**B. Gambling / chance / prize mechanics.** *Trigger:* "prize", `rarity_label` (common→special), a
disabled "Mystery Unit" (`catalog.mjs:87`). *Question:* whether any current or planned mechanic
implicates chance-based/loot-box rules. *Mitigating:* redemption is **deterministic** (fixed
`cost_tickets`, no randomized draw); "Mystery Unit" is `enabled:false`. *Safe default:* keep
randomized/"mystery" prizes disabled until counsel reviews; avoid loot-box patterns.

**C. Consumer protection / dark patterns.** *Trigger:* earn→spend→scarcity-label loop targeting a
general (possibly young) audience. *Question:* fairness/transparency of the loop and labels.
*Mitigating:* non-cash, capped, no purchase pressure, no real-money sink. *Safe default:* counsel
review of copy + a plain-language explanation that tickets/cosmetics have no cash value.

**D. Virtual currency / stored value / redeemability.** *Trigger:* a durable, spendable
per-pseudonym `balance` (`prize-authority.mjs:42-45`). *Question:* whether a persistent in-game
balance redeemable only for cosmetics constitutes "stored value" under any applicable regime.
*Mitigating:* no cash-in, no cash-out, no transfer, no real-world goods. *Safe default:* never add a
cash-in/out or transfer path without counsel.

**E. KYC / money transmission.** *Trigger:* would arise only with a transfer or cash-out path.
*Question:* n/a unless such a path is added. *Mitigating:* none exists today
(`prize-authority.mjs:14-15`). *Safe default:* do not add transfer/cash-out/wallet.

**F. Securities / investment.** *Trigger:* would arise only with ownership/profit/appreciation
language. *Question:* n/a unless added. *Mitigating:* no ownership-as-investment or profit language
found. *Safe default:* avoid "own/invest/appreciate/resale" framing.

**G. Data retention / deletion / access.** *Trigger:* durable per-pseudonym economic record with
**no per-player delete/export path** (§5). *Question:* retention-limitation and data-subject-access
obligations for a pseudonymous persistent record, if a subject regime applies. *Mitigating:*
pseudonymous, local id, no contact data. *Safe default:* define a retention/reset policy and consider
a per-player clear path (engineering follow-up, post-counsel).

**H. Jurisdiction.** *Trigger:* public global reachability. *Question:* which regimes apply.
*Safe default:* counsel scopes jurisdictions before any expansion.

## 8. Copy and UX risk scan (verbatim, for counsel — not edited in this sprint)

Value/ownership/scarcity-adjacent strings currently shipped:
- `Redeem · {cost}🎟`, `Owned`, `Your cosmetics`, `No cosmetics yet — redeem one!`, `need more tickets`
  (`prize-counter.js:103,46,117,109`)
- `Your arcade tickets — server-authoritative` (`index.html:103`), HUD ticket count
- `Claim` / `Claimed: {reward} ✓` (`challenge-board.js:105,182`)
- catalog `rarity_label`: `common / uncommon / rare / special`; disabled `Mystery Unit`
  (`catalog.mjs:82-87,93` "Redeem arcade tickets for cosmetics.")
- lobby: `Each room has its own tickets, inventory, challenges and feed. Nothing carries across
  rooms.` (`arcade-lobby.js:87`) — note this asserts non-carryover, which is true **across rooms**
  but the within-room record is durable.

Observation for counsel (not a conclusion): the words "Redeem", "Owned", and rarity tiers borrow
commerce/collectible framing; whether any rewording is warranted is a counsel/product decision.
**No code is changed by this audit.**

## 9. Engineering controls already present (confirmed)

- **Non-cash, no cash-out, no marketplace, no player-to-player transfer** (`prize-authority.mjs:14-15`;
  Phase 1F/1H non-goals).
- **No real-money purchase path** anywhere in the economy.
- **Per-round cap** `MAX_PAYOUT=40`; scoring bounds reject impossible inputs (`tickets.mjs:21-70`).
- **Server-authoritative** awards/spends; client cost/discount/balance ignored
  (`prize-authority.mjs:7-9`).
- **Idempotent** ledger + redemption dedup (`ledger.mjs`, `prize-authority.mjs:39`).
- **Privacy-safe public projection** — balances/ledger/full inventory never broadcast
  (`prize-authority.mjs:103-122`).
- **Pseudonymous** identity; no email/name/PII collected in the economy path.
- **Tests** exist for tickets/ledger/prize/achievements/challenges — but tests verify *behavior*, not
  legal posture.

## 10. Gaps

- **No documented legal review** of the economy (this memo is the escalation, not the review).
- **No age gate / no accounts / no parental-consent** mechanism (fact; the *need* is a counsel
  question).
- **Doc↔code contradiction:** `NEON_CIRCUIT_GAMEPLAY_CHARTER.md:150,261,269` ("session-scoped",
  "no cross-session retention as wealth") does not match the durable, playerId-keyed code;
  `PHASE_9_ECONOMY_DOCTRINE_PLAN.md:4,46` already flags this as open. The charter copy should be
  reconciled to the code reality (engineering follow-up).
- **No per-player data retention / reset / export policy or path** (only room-wide admin reset).
- **Positioning tension:** "no servers / nothing leaves your device" marketing on the same domain as a
  server-side persistent per-player economy.
- **Identity is spoofable** (format-only validation, no ownership) — a design fact counsel + product
  should weigh for a persistent record.

## 11. Recommended operator decisions

1. **Freeze economy-feature expansion** until counsel review (no new persistence, identity, prize, or
   reward surface).
2. **Do not add** marketplace, ownership, player-to-player transfer, cash-in/out, wallet, or trading.
3. **Keep CF-7 live loader disabled** (`LIVE_WORLD_LOADER_ENABLED=false`) until the economy/legal
   review decides whether creator content may ever touch rewards/economy. (Record as an ADR — see
   §next.)
4. **Decide** whether user-facing economy copy ("Redeem/Owned/rarity") should be reviewed/reworded
   pending counsel.
5. **Decide** whether a public, plain-language child-safety / age-positioning statement is needed.
6. **Decide** whether to add a **per-player reset/delete** path and a documented retention policy.
7. **Reconcile the charter** ("session-scoped") to the verified persistent reality.

## 12. Acceptance criteria before any economy expansion

No further economy expansion until **all** of:
- [ ] counsel review completed and recorded (ADR or legal memo);
- [ ] user-facing economy copy reviewed;
- [ ] data retention / reset policy defined (and, if decided, a per-player clear path shipped);
- [ ] minors-exposure decision made (age gate / positioning / "directed to children" determination by
      counsel);
- [ ] tests prove no transfer / cash-out / marketplace path exists (extend current suite with explicit
      negative tests);
- [ ] `NEON_CIRCUIT_GAMEPLAY_CHARTER.md` updated to match the actual persistent economy facts.

## 13. Appendix: evidence (short references)

- Persistence: `arcade-room.ts:156` `ctx.storage.put("arcadeState", this.state)`; reload
  `arcade-room.ts:166-177`; state shape `round-authority.mjs:85-100`.
- Identity: `neon-circuit-room-client.js:116-124` (localStorage `neon-arcade-player-id`);
  validation `arcade-room.ts:384-394`, `city-block.mjs:201-203`.
- Redemption authority: `prize-authority.mjs:7-15` (server-authoritative, session-bound,
  no-move), `:32-71` (`redeemPrize`), `:103-122` (privacy-safe projection).
- Caps: `tickets.mjs:21-35` (`MAX_PAYOUT=40`).
- Catalog: `catalog.mjs:81-93` (6 cosmetics 10–50 tickets; `Mystery Unit` `enabled:false`).
- Reset: `arcade-room.ts:190-191,258-261` (`/admin/reset` → `newPartition`).
- Non-goals: `NEON_CIRCUIT_PHASE1F_ARCADE_LOOP.md:33-47`, `NEON_CIRCUIT_PHASE1H_CHALLENGE_BOARD.md:51-66`.
- Doc↔code: `NEON_CIRCUIT_GAMEPLAY_CHARTER.md:150,261,269` vs `PHASE_9_ECONOMY_DOCTRINE_PLAN.md:4,46`.
- Exposure: `PRODUCTION_ROLLOUT_PLAN.md` (live routes); `index.html:244` ("No accounts");
  `NEON_CIRCUIT_PHASE7C_PRODUCTION_COMPLETION.md:32-34` (city reward-free).

---
*Prepared as a read-only engineering + escalation record. It contains no legal advice and makes no
legal determination. Route §7 questions to qualified counsel before any economy expansion.*
