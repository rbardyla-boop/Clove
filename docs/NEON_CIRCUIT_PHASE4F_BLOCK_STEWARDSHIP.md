# Neon Circuit — Phase 4F: Block Stewardship + Constrained Editor

**Status:** implemented, local-only (branch `feat/neon-circuit-phase4f-block-stewardship`; Phase 4E `01e7ee0`,
4D `4598969`, 4C `dfc7031` are ancestors; branched off the current tip).
**Goal:** prove a player/community can **shape a city block within strict rules** — a few constrained,
reversible, server-validated VISUAL edits gated by non-cash Host Rank standing — **without griefing the
public city and without any ownership, land, rent, income, marketplace, or account mechanic.**

Builds on [NEON_CIRCUIT_PHASE4E_HOST_RANK.md](NEON_CIRCUIT_PHASE4E_HOST_RANK.md).
Core rule unchanged: **players send intent, the server owns truth.**

> Note: `docs/PROJECT_CHARTER.md` was intentionally **not** edited in 4F — it currently holds unrelated
> uncommitted ADR edits, so per scope discipline the 4F ADR lives here only.

## 1. What changed from 4E

| Area | 4E | 4F |
|---|---|---|
| Customization | none | **Block Stewardship** — constrained, reversible, manifest-validated visual edits |
| Eligibility | — | derived from non-cash **Host Rank** (one current signal, not a property right) |
| New events | host-rank evaluated/changed | server-authored `city_stewardship_previewed/applied/rejected/reset` |
| New messages | `city_host_rank_state/request` | `city_stewardship_state` + `city_stewardship_result` (server→client), `city_stewardship_request` (client→server, rate-limited) |
| Client UI | host-rank panel | + **BLOCK STEWARDSHIP** constrained editor (preview/apply/reset, fixed options) |
| Renderer | static palette | accent colors/glow driven by the canonical block style |
| `SCHEMA_VERSION` | 4 | **5** (additive) |

Additive + backward-compatible: no-dt inputs and the entire 4A/4B/4C/4D/4E message set remain valid; a
client that ignores stewardship state still works; unknown messages still fail safe.

## 2. Authority model

Stewardship is **subordinate** to city authority and Host Rank. The client may **preview** edits locally and
**request** an edit; it can never assert canonical style. The SERVER decides eligibility, the allowed edit type
+ target + bounds, manifest validity, the current canonical style, the apply/reset outcome, and authors every
event. A forged `city_stewardship_applied`/`city_event` gets `unknown_type`. Stewardship moves no player and
touches **no** collision, portal truth, tickets, inventory, arcade rewards, or economy.

## 3. Block Stewardship definition

Stewardship **is**: limited, non-cash, non-transferable, server-approved, manifest-constrained, block-scoped,
reversible, moderated by rules, public-safe, and derived from Host Rank as **one eligibility signal**. It is
**not**: ownership / land / rent / income / payout / staking / marketplace / token / NFT / asset sale / real
estate / account entitlement / permanent legal claim / free-form UGC / destructive griefing.

## 4. Eligibility model

`isStewardshipEligible(host_rank)` = Host Rank `tier ∈ {helper, signaler, anchor}` **OR** `support_signal ∈
{steady, active}`. Observer + quiet ⇒ ineligible (`host_rank_too_low`). Eligibility is a **current block
signal** — not permanent, not account-bound, not an ownership right. It gates **preview, apply, and reset**
(all author block-style facts). Host Rank still **grants nothing itself**; it is only read here.

## 5. Constrained editor manifest (`arcade/city/city-stewardship.mjs`, pure)

Closed enum allowlists — the sanitizer reads ONLY these keys, so any css/html/js/url/text/script field a client
sends is simply never copied out (it cannot reach canonical state, an event, the wire, or the renderer):

- `ALLOWED_TARGETS = ['arcade_front', 'street_lights', 'sidewalk_trim']`
- `ALLOWED_PALETTES = ['cyan', 'magenta', 'amber', 'white']` → mapped to the existing in-house neon hexes
- `ALLOWED_SIGN_VARIANTS = ['classic', 'circuit', 'signal']` (arcade_front only)
- `ALLOWED_INTENSITY = ['low', 'medium', 'high']`

`evaluateStewardship({ cityId, now, hostRank, currentStewardship, request })` → deterministic outcome. PURE:
no async/network/AI/randomness/mutation; no money/ownership/inventory/account fields; no file/URL/external refs.
Helpers: `defaultBlockStyle`, `sanitizeStyle`, `mergeBlockStyle` (immutable), `normalizeBlockStyle`,
`styleToAccents` (token → renderer hex + glow multiplier), `stewardshipStatePayload`, `blockStyleChanged`.

## 6. Allowed edits

arcade-front palette + sign variant + glow intensity; street-light/portal accent palette + intensity;
sidewalk-trim accent palette. **Nothing else** — no labels/URLs/CSS/HTML/JS/uploads, no collision/portal/
economy/map-topology changes.

## 7. Preview / apply / reset flow

`preview` → server validates (eligibility + manifest), returns a sanitized `preview_style`, emits
`city_stewardship_previewed`, and **does not persist** (canonical unchanged). The client may also show an
optimistic *local* preview, clearly marked, until the server confirms. `apply` → the validated style becomes
canonical (persisted) and is broadcast as `city_stewardship_state`; emits `city_stewardship_applied`. `reset`
→ canonical returns to `DEFAULT_BLOCK_STYLE` (the city default), broadcast + `city_stewardship_reset`. An
invalid/ineligible request emits `city_stewardship_rejected` and returns `{ ok:false, reason }` — no change.

## 8. CityRoom integration (+ shim parity)

The canonical block style lives in `this.stewardship` (CityRoom DO), loaded with `normalizeBlockStyle` and
persisted under the `ctx.storage` key `cityStewardship` (hibernation-safe; **no new DO, no new SQLite
migration** — the existing v3 CityRoom class covers it). `handleStewardshipRequest` is rate-limited per socket
(`SNAP_REQ_MIN_MS = 250`), reads `this.hostRank` for eligibility, runs the pure module, persists only on a
successful apply/reset, and broadcasts state. A (re)connect receives `city_stewardship_state` at join. The Node
city dev shim mirrors all of this over the same pure module (per-city canonical store).

## 9. Event schema (server-authored, public-safe)

Four types added to the existing append-only log: `city_stewardship_previewed`, `city_stewardship_applied`,
`city_stewardship_rejected`, `city_stewardship_reset`. Payload allowlist extended with the public-safe visual
tokens `palette`, `sign_variant`, `intensity` (`target`, `reason` already allowed). `actor_public_id` is the
requesting player's existing public id. No private/economy/ownership/URL/raw-style field can ride (allowlist +
finiteness guard enforce it).

## 10. Retention / bounding

Canonical block style is a tiny fixed-shape object (3 targets). Stewardship events ride the existing bounded
50-entry FIFO log. Requests are rate-limited per socket. No unbounded growth.

## 11. Client display

A compact **BLOCK STEWARDSHIP** city-OS panel (`#cityStewardship`, mobile-safe, `textContent` only, controls
built with `addEventListener` — no inline handlers, no free text, no uploads, no URLs): current block style,
an eligibility line, fixed target/palette/sign/intensity chips, and Preview / Apply / Reset. Copy is
stewardship-only ("Eligibility: stewardship signal active." / "Block style: arcade amber · street cyan · walk
cyan") — never ownership/money/rent/payout. The renderers (`city-render-canvas2d.js`, `city-render-three.js`)
expose `applyBlockStyle(style)`; the 2D fallback applies all three accents, the Three renderer applies the
arcade-front + street-light accents (sidewalk trim is a 2D nicety).

## 12. Public-safety / privacy

Stewardship output carries only enum tokens + bounded reason strings — no balance/ledger/inventory/account/
token/secret/admin/URL/custom-text. `actor_public_id` is the existing public id; no new identity. No
third-party telemetry/tracking. No money/ownership copy anywhere in the UI.

## 13. Size-budget result (GTA-80)

`node scripts/check-city-build-size.mjs` → **0.700 MB uncompressed / 0.185 MB gzipped** — within GTA-80
(≤80 MB) and the GTA-34 (≤34 MB gz) stretch. Procedural only (a small pure module + a little UI + a tiny
renderer change); no assets, no new client dependency.

## 14. Validation commands

```bash
node --test tests/arcade/*.test.mjs            # pure stewardship + host-rank + scheduler + event-log + all existing
node tests/arcade/check-production-config.mjs
node scripts/check-city-build-size.mjs
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-stewardship.sh   # NEW 4F smoke
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-host-rank.sh     # 4E regression
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-scheduler.sh     # 4D regression
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-event-log.sh     # 4C regression
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-authority.sh     # 4B regression
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-block.sh         # 4A regression
bash tests/arcade/run-two-client.sh ; bash tests/arcade/run-frame-contract.sh   # arcade regression
cd workers/arcade && npx wrangler deploy --dry-run --outdir dist                # Node 22; no deploy
```

## 15. Known limitations

- Stewardship is **block-scoped and collective** (the block's current style), authored per-request by the
  eligible requester; it is not a per-player property and confers no persistent claim. Eligibility decays with
  Host Rank (it is a current signal, not a deed).
- Visual application covers the three manifest targets; the Three renderer applies arcade + street-light
  accents (sidewalk trim is a 2D-canvas nicety). New geometry/props are out of scope.
- `this.stewardship` is persisted; an older DO build simply ignores the new storage key (forward/backward safe).

## 16. Deferred roadmap — 4G (forward seam, documented only; NOT built)

**Phase 4G — Instanced, non-destructive block battles:** battles run in **isolated instances**; the live public
city is **never destructively edited**; a block's stewardship style may be **copied** into an instance but never
damaged; **no gambling, no paid entry, no cash rewards, no ownership transfer**; outcomes may later affect
non-cash reputation/cosmetics only if approved. Not implemented in 4F.

## 17. Non-goals (4F)

No 4G block battles; no HiveWorld mirror/bridge; no free-form UGC; no image/file upload; no marketplace; no paid
hosting; no land ownership; no accounts/OAuth/persistent global profile; no real-money/crypto/blockchain/token/
NFT; no staking/yield/resale/cash-out/gambling/wager/payout; no rent/income; no arbitrary CSS/HTML/JS/URL
injection; no map expansion/missions/combat/weapons/vehicles/NPCs/AI; no change to arcade ticket formulas,
prize costs, challenge rewards, event schedules, or economy behavior; no deploy/credentials/`wrangler login`/
push/history-rewrite. Stewardship grants nothing economic and moves no one.
