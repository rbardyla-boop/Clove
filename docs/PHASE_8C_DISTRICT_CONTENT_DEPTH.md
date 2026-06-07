# Phase 8C — Six-Block District Content Depth

**Status:** **PLAN ONLY** — no code, no deploy, no migration, no config flip in this phase.
**Goal:** make the six-block district (downtown / harbor / skyline / foundry + Phase 8A **nexus-05** / **garden-06**) feel intentional and **worth exploring**, using **only existing kernel systems** — give Garden, Nexus, and the new route corridor *reasons to move*. Content depth, not scale infrastructure.
**Default:** **static config + display-only client derivation.** Zero Worker/DO authority change unless a surface separately justifies it as strictly necessary (and even then: no economy, no reward, no new authority).
**Hard exclusions:** no economy, ownership, rent, paid hosting, accounts, marketplace, **rewards, payouts, tokens, NFTs**, transfer, cash-out · **no CF-7 enablement; `LIVE_WORLD_LOADER_ENABLED` stays `false`** · no package-backed / live-loaded districts · no production deploy · HiveWorld untouched.
**Parents:** `docs/PROJECT_CHARTER.md` (ADR-036), `docs/PHASE_8_DISTRICT_SCALE_PLAN.md` (ADR-034), ADR-035 (Phase 8A six-block district).

---

## 0. Why content depth comes next

Phase 8A proved the city can scale **structurally** — six blocks, a richer adjacency graph, a new corridor, all static config, staging-proven on real workerd. But structural scale is not the same as *reasons to move*. Right now Garden and Nexus are real places on the map with no particular reason to visit them, and the new corridor (`downtown ⇄ garden ⇄ nexus ⇄ skyline`) is a second path with no character of its own.

8C closes that gap **using only systems that already exist** — landmark labels, per-block style, the activity feed, district events, Phase 7A interaction zones, the non-cash Block Trial / Host Rank, and the district panel / minimap. It adds **no new authority and nothing economic**: every objective is display/acknowledge-only, every flavor line is static copy at an existing public-safe choke point, every readability change is client-side over the existing manifest. The next value is not more blocks — it is making the six we have feel like places.

> **Grounding & honesty.** Every hook below is anchored to the real code (activity feed `ACTIVITY_FEED_MAX = 16` / `ACTIVITY_UI_MAX = 8`; district events `WINDOW_MS`, `ANNOUNCE_MAX = 8`; the wire allowlists; the 6 blocks + corridor). This plan was produced by a grounded multi-agent workflow with adversarial verification per section; where an exact label string, theme→hex mapping, or event-type semantic must be re-confirmed against the source at implementation time, the plan says so and lists it in *§7 — Open Items & Build-Time Confirmations* rather than asserting it as settled.

### What this plan delivers
1. **Per-Block Identity & Purpose** — a reason to go to each of the six blocks.
2. **District-Event & Activity-Board Flavor** — the district reads as a living place.
3. **Non-Reward Objectives & Things To Do** — built only on existing systems; grant nothing economic.
4. **Route & Readability Polish** — the six-block graph and the new corridor are legible.
5. **Static-Config vs Authority-Change Line** — default zero server change.
6. **Cross-Device Smoke Matrix Updates & Content Verification.**
7. **Open Items & Build-Time Confirmations** — citation/mapping items to confirm at implementation.
8. **Non-Goals, Sequencing & the Next Fork.**

---

## 1. Per-Block Identity & Purpose — a reason to go to each of the six blocks

### Goal and constraint frame

This section gives all six blocks (downtown-01, harbor-02, skyline-03, foundry-04, nexus-05, garden-06) a distinct "what is this place / why go there" expressed **only through systems that already exist and already ship to the client**. Nothing here proposes new authority, new wire fields, new DO behavior, economy, rewards, CF-7, a flag flip, a package load, or a production change. **Every identity affordance below is static config or pure client-side display derivation.** It grants nothing economic and changes no canonical state.

The five existing expression surfaces this plan reuses (no new ones invented):

| # | Surface | Real anchor | Nature |
|---|---------|-------------|--------|
| 1 | Landmark labels | `BLOCK_LABELS` in `arcade/city/city-block.mjs:137-143`; applied by `publicLayout(cityId)` at `:150-155` | Static config, display-only, already on the wire (welcome payload `layout`) |
| 2 | Theme token + display_name | `CITY_ROOMS` in `arcade/city/city-block.mjs:171-178` | Static config, already in `blockPublicSummary` |
| 3 | Default stewardship style (paint) | `BLOCK_DEFAULT_STYLES` in `arcade/city/city-stewardship.mjs:78-105` | Static config, display-only paint; "paint, not ownership/economy" per file comment `:76` |
| 4 | Activity-feed flavor | `labelFor(type, name)` in `arcade/city/city-district-activity.mjs:59-76` (Flavor Hook #1) | Pure client function; only static `name` interpolated; output clamped via `safeName()` to 40 chars |
| 5 | District-event flavor | `eventLabel`/`eventSummary` in `arcade/city/city-district-events.mjs:163-172, 174-184` (Flavor Hooks #3/#4) | Pure; only static `name` interpolated; `eventLabel` clamped to 40 chars, `eventSummary` unbounded in the pure function (propose ≤256 chars for UI) |

Two of these (landmark labels, default styles) are **already block-distinct for all six blocks in the shipped code** — confirmed by reading `city-block.mjs:137-143` and `city-stewardship.mjs:78-105`. The depth gap is not the data; it is that the **player is never told what those distinctions mean or why a block is worth the trip.** This section closes that gap with display copy only.

---

### Per-block identity table

For each block: **identity/vibe** (the "what is this place"), the **existing hooks** that already express it or can carry the copy, and the **"why go there"** affordance. All "why go there" hooks are display-only reasons to traverse; none grant tickets, Host Rank cash value, items, or any persistent benefit.

#### downtown-01 — Downtown Block (the hub / home)

| Field | Value (anchored) |
|---|---|
| Identity / vibe | Central hub. `DEFAULT_CITY_ID` (`city-block.mjs:160`); the block a no-id client lands in. Theme `neon-noir`. Default paint: magenta arcade (`classic`, `medium`), cyan lights (`medium`), cyan trim (`DEFAULT_INTERNAL`, `city-stewardship.mjs:64-68`). |
| Existing hooks | Theme `neon-noir` (`:172`); labels fall back to downtown's built-in set (`city-block.mjs:135`); adjacency `downtown↔[harbor-02, foundry-04, garden-06]` (`city-district.mjs:43`) — **the only 3-edge block**, structurally the crossroads. |
| Why go there | "Start here / everything connects from here." Express via activity-feed flavor on `block_arrived` (Flavor Hook #1) and event-summary flavor for `district_block_focus` (Hook #4): downtown as the block from which both corridors depart. |
| Economic note | Display-only. Grants nothing. No state change. |

#### harbor-02 — Harbor Block (maritime / dockside, original ring)

| Field | Value (anchored) |
|---|---|
| Identity / vibe | Maritime/dockside. Theme `tidal-cyan` (`:173`). Paint: cyan signal arcade (`signal`, `medium`), high cyan street lights (`cyan`, `high`), white trim (`city-stewardship.mjs:81-84`). |
| Existing hooks | Labels already maritime: `HARBOR CONTROL` / `DOCKSIDE NOODLES` / `FERRY TERMINAL` (`city-block.mjs:138`). Adjacency `harbor↔[downtown-01, skyline-03]` (`city-district.mjs:44`) — a leg of the **original ring** corridor. |
| Why go there | "The waterfront leg toward Skyline." Express via `eventSummary` flavor for `district_route_warmup` ("Routes into Harbor are warming up") and `district_arcade_hour`. The high-glow cyan-on-white paint already reads as a distinct maritime place. |
| Economic note | Display-only. Grants nothing. |

#### skyline-03 — Skyline Block (heights / the far junction)

| Field | Value (anchored) |
|---|---|
| Identity / vibe | Elevated/heights, warm amber. Theme token `sunset-violet` (`city-block.mjs:174`) is a renderer category; the block's visual character is defined by its stewardship defaults (`city-stewardship.mjs:85`, comment `// sunset-amber`): amber circuit arcade (`amber`, `circuit`, `high`), amber street lights (`amber`, `medium`), white trim. Player-facing copy should use the warm/amber/heights framing — this is what the block looks like. |
| Existing hooks | Labels: `SKY TOWER` / `CLOUD CAFE` / `SKY-TRAM HUB` (`city-block.mjs:139`). Adjacency `skyline↔[harbor-02, foundry-04, nexus-05]` (`city-district.mjs:45`) — **the far junction where both corridors re-converge**. Reachable via the original ring (harbor or foundry) or the new corridor (garden then nexus). |
| Why go there | "Where both ways across meet again." This is the structural payoff of the two-corridor topology: Skyline is the terminus that both paths reach, and its amber-glow ambiance reads as the elevated destination. Express the convergence via event-summary flavor leaning on "elevated/far junction" tone and a Travel-button `aria-label` "why go there" (readability surface from the identity hook map). |
| Economic note | Display-only. Grants nothing. |

#### foundry-04 — Foundry Block (industrial, original ring)

| Field | Value (anchored) |
|---|---|
| Identity / vibe | Industrial/forge. Theme `forge-ember` (`:176`). Paint: amber signal arcade (`amber`, `signal`, `high`), magenta forge-glow street lights (`magenta`, `high`), white trim (`city-stewardship.mjs:91-94`). The magenta street lights at high intensity while the arcade body is amber makes foundry the one block in the original ring with mismatched (contrasting) glow colours — industrial heat. |
| Existing hooks | Labels: `FORGE STACK` / `EMBER CANTEEN` / `FREIGHT LINE` (`city-block.mjs:140`). Adjacency `foundry↔[downtown-01, skyline-03]` (`city-district.mjs:46`) — the other leg of the original ring. |
| Why go there | "The freight/industrial leg toward Skyline." Distinct from Harbor's leg by paint (amber+magenta vs cyan) and labels (freight vs ferry). Express via `district_signal_surge` event flavor ("Cabinets in Foundry are lively"). |
| Economic note | Display-only. Grants nothing. |

#### nexus-05 — Nexus Block (the inner hinge, NEW corridor) ⭐

| Field | Value (anchored) |
|---|---|
| Identity / vibe | **Inner hinge of the new corridor.** Theme `pulse-magenta` (`:177`). Paint: magenta circuit arcade (`magenta`, `circuit`, `high`), magenta street lights (`magenta`, `high`), cyan trim (`city-stewardship.mjs:96-99`). What distinguishes nexus from downtown (which also has magenta arcade and cyan trim) is that nexus's **street lights are also magenta** at high intensity — the entire block glows a uniform high-intensity magenta, earning the "pulse" theme. It reads as a charged, wired node. |
| Existing hooks | Labels already say it: `NEXUS CORE` / `SYNAPSE BAR` / `TRANSIT NEXUS` (`city-block.mjs:141`) — the most transit-explicit label set of all six. Adjacency `nexus↔[skyline-03, garden-06]` (`city-district.mjs:47`) — the **last hop before Skyline** on the new corridor. |
| Why go there | "The pulse crossroads — the wired way up to Skyline." Nexus is the corridor's character anchor: where Garden's calm gives way to uniform high-magenta intensity just before the Skyline junction. Express via: (a) `eventSummary` flavor for `district_route_warmup`/`district_block_focus` leaning on "crossroads/transit" tone; (b) activity-feed `block_arrived` flavor; (c) Travel-button `aria-label` "why go there" copy. The `TRANSIT NEXUS` / `NEXUS CORE` labels already carry the meaning — the plan surfaces it in panel/event copy. |
| Economic note | **Display-only. Grants nothing economic.** "Crossroads" is narrative, not a toll, fee, or reward. No new field, no authority change. |

#### garden-06 — Garden Block (the calm on-ramp, NEW corridor) ⭐

| Field | Value (anchored) |
|---|---|
| Identity / vibe | **Calm / restorative / green.** Theme `bloom-cyan` (`:178`). Paint: cyan signal arcade (`cyan`, `signal`, `medium`), soft amber street lights (`amber`, `low`), white trim (`city-stewardship.mjs:101-104`). The amber street lights at `intensity: 'low'` make garden-06 the **only block in the entire district with a low-intensity lighting default** — the sole `low` in `BLOCK_DEFAULT_STYLES`. At `INTENSITY_MULT.low = 0.6×` glow (`city-stewardship.mjs:42`), it is literally the softest, quietest-looking block. The data already says "restful place." |
| Existing hooks | Labels already green: `BIODOME SPIRE` / `GREENHOUSE GRILL` / `GARDEN HALT` (`city-block.mjs:142`). Adjacency `garden↔[downtown-01, nexus-05]` (`city-district.mjs:48`) — the **entry to the new corridor from downtown**, the calm on-ramp. |
| Why go there | "The peaceful way across — slow down, then cross to Nexus." Garden is the tonal counterpoint to the bright ring: the new corridor reads as "the scenic/quiet route" vs the original ring's busier waterfront/industrial path. Express via: (a) `eventSummary` flavor for `district_quiet_window` (existing type — `city-district-events.mjs:178` already says "winding down") — Garden is the natural focus block for quiet-window flavor; (b) activity-feed `block_became_empty` flavor ("Garden is quiet now" at `city-district-activity.mjs:62` already reads well for this block); (c) Travel-button "why go there" copy: "Garden — the calm route across." |
| Economic note | **Display-only. Grants nothing economic.** "Restorative/calm" is mood copy, not a buff, rest bonus, or regeneration mechanic. No state change. |

---

### Making the new corridor feel purposeful (downtown ⇄ garden ⇄ nexus ⇄ skyline)

The topology already encodes "two ways across" — `city-district.mjs:42-49` gives **two distinct paths from downtown to skyline**: the original ring (harbor/foundry) and the new corridor (garden/nexus). The content job is to give the new corridor a *reason to exist* beyond redundancy:

- **Tonal contrast as the reason.** Original ring = busy/maritime/industrial (harbor cyan-high, foundry amber+magenta-high). New corridor = calm-then-charged: **Garden (sole `low`-intensity block, soft amber) → Nexus (uniform high-magenta)** — the calm/charged gradient is directly expressed by `BLOCK_DEFAULT_STYLES` and needs only copy to name it.
- **Express the gradient through existing event flavor.** `district_quiet_window` (existing type) is the natural fit for Garden; `district_signal_surge`/`district_route_warmup` fit Nexus. No new event type — reuse the 5 in `EVENT_TYPES` (`city-district-events.mjs:98-104`), choosing per-block flavor mood via Flavor Hook #4.
- **Express "the other way across" at the travel affordance.** The Travel-button `aria-label`/tooltip (readability hook, `city-scene.js` travel rows at `:523-524`) can carry a one-line "why" per adjacent block — display-only, no wire change, derived from a new static per-block `why_visit` config field consumed client-side.

---

### Recommended implementation shape (PLAN ONLY — no code here)

Default to **Option A (static config + client display derivation)** per the grounding facts' recommendation:

1. Add a static, frozen per-block identity map (e.g. `BLOCK_IDENTITY` in `city-block.mjs`, sibling to `BLOCK_LABELS`/`CITY_ROOMS`) carrying display-only fields: `tagline`, `vibe_tone`, `why_visit`. **To confirm at implementation:** exact field names and whether it co-locates in `city-block.mjs` or a new `city-block-identity.mjs` (file-organisation call).
2. Thread it into the **pure display functions only**: extend `labelFor`/`eventLabel`/`eventSummary` signatures to accept an optional flavor argument (Flavor Hooks #1/#3/#4), and read it in `city-scene.js` for the district-panel header subtitle, Travel-button `aria-label`, and event card — all client-side derivation paths already listed in the grounding facts.
3. **No wire/authority change.** This stays inside the existing welcome-payload `layout` and client-derived display. **No `blockPublicSummary` field add is required for taglines if rendered purely client-side from static config** (the client already has `CITY_IDS` and can map locally). Only if a tagline must be *server-authoritative per-block override* would a `blockPublicSummary` field be needed — that is **explicitly not justified here**; static client config is sufficient, so **no Worker authority change is proposed.**
4. **Safety reuse, not new guards.** All new copy strings must pass the existing FORBIDDEN vocabulary guard (defined in `arcade/city/city-interactions.mjs:42` — consult that source for the full regex; the test-spec variants at `tests/arcade/city-district-events.spec.mjs:59` and `tests/arcade/city-district-activity.spec.mjs:51` are narrower subsets of the same intent) and the `safeName`/`shortBlockName` clamps before they can ship. Add copy assertions to `tests/arcade/city-district-activity.spec.mjs` / `city-district-events.spec.mjs` rather than new regex.

---

### Explicit exclusions (restating the hard boundaries for this section)

- **Grants nothing economic.** No block identity confers tickets, currency, Host Rank cash value, items, ownership, rent, hosting, or any persistent/transferable benefit. "Crossroads," "calm," "industrial," "pulse," "wired" are mood/wayfinding copy only.
- **Display-only / static.** All identity is static config + pure client display derivation. No new DO, migration, message, wire field, or `LIVE_WORLD_LOADER`/CF-7 touch. `LIVE_WORLD_LOADER_ENABLED` stays false.
- **No new authority surface.** Reuses `BLOCK_LABELS`, `CITY_ROOMS`, `BLOCK_DEFAULT_STYLES`, and the pure `labelFor`/`eventLabel`/`eventSummary` hooks. Server authority for position/routing/health is untouched.
- **8B / scale stays out.** This is content depth on the existing six static blocks, not partial-manifest or a 7th block.

---

### Falsifiable / how we'd know it's wrong

This section's claims are wrong if any of the following turn out to be true on implementation:

1. **Hook reality check.** If `BLOCK_LABELS` (`city-block.mjs:137-143`) or `BLOCK_DEFAULT_STYLES` (`city-stewardship.mjs:78-105`) do **not** already contain block-distinct values for nexus-05 and garden-06, the "data already says it" premise is false. *(Verified true at time of writing — both maps contain all six blocks with distinct values.)*
2. **No-server-change check.** If rendering a per-block tagline/why-visit requires adding a field to `blockPublicSummary` (`city-district.mjs:106`) or any wire message, then "Option A static client config is sufficient" is false, and the change is **not** purely display — it would need separate justification (and would still be barred from any economy/reward/new-authority).
3. **Vocabulary-safety check.** If any proposed identity copy ("crossroads," "calm route," "freight leg," "elevated junction," "pulse," etc.) fails the FORBIDDEN vocabulary guard at `arcade/city/city-interactions.mjs:42` or the PRIVATE data regex in test specs, the copy is non-compliant and must be reworded. *(These specific terms do not match either regex, but each final string must be CI-asserted against both variants.)*
4. **Corridor-distinctness check.** If, after copy lands, a playtester cannot articulate a *different* reason to take garden⇄nexus vs harbor⇄foundry (cross-device smoke / qualitative), the "other way across has its own character" claim has failed and the calm→charged gradient framing needs rework.
5. **Clamp check.** If Garden/Nexus taglines exceed `safeName` (40 chars) on activity labels or `shortBlockName` (40 chars) on event labels and get truncated mid-word in the district panel on the 360×640 phone viewport, the copy is too long and the "readable, no overflow" assumption is false.
6. **Nexus distinction check.** If a player cannot distinguish Nexus from Downtown by visual appearance alone (both have magenta arcade + cyan trim), confirm that the magenta-on-magenta street lighting at high intensity is legible and sufficient. If not, this differentiator requires rework before it can carry the "wired junction" narrative.

---

## 2. District-Event & Activity-Board Flavor — the district reads as a living place

### Goal of this section

Today the district pulse is structurally alive but tonally flat: every event reads `"<Block> Signal Surge"` / `"<Block> is the focus block for this district window."` and every block sounds identical because the only interpolated value is the static `display_name`. The schedule already rotates `blockForWindow(index)` across all six `CITY_IDS` — so Garden and Nexus are *already in the rotation* — but they say nothing place-specific. This section gives each of the six blocks a **voice** (a character that shows up in its events and its activity-feed lines) using only STATIC CONFIG + the existing pure derivation functions, with **no new wire field, no new authority, no economy.**

This is PLAN-ONLY (Phase 8C). No code, no flag-flip, no deploy.

---

### Where flavor attaches (anchored to real choke points)

All four attach points are **pure functions already imported unchanged** by both the browser scene and the unit tests. We extend their *output text*, not their *shape*. The allowlists (`EVENT_FIELDS`, `ITEM_FIELDS`) and bounds (`ANNOUNCE_MAX`, `ACTIVITY_FEED_MAX`) stay byte-frozen.

| # | Function | File:line | What changes | What must NOT change |
|---|----------|-----------|--------------|----------------------|
| A | `eventLabel(type, name)` | `arcade/city/city-district-events.mjs:163-172` | per-block adjective/format → richer label string | clamp at build (`shortBlockName` ≤40), `EVENT_FIELDS` allowlist (`:110-113`) |
| B | `eventSummary(type, name)` | `arcade/city/city-district-events.mjs:174-184` | per-block prose tone → richer one-line summary | bound the prose (**propose ≤256 chars — "to confirm" as the exact cap is not currently enforced in code**) |
| C | `labelFor(type, name)` | `arcade/city/city-district-activity.mjs:59-76` | per-type observational copy variety | `safeName` clamp ≤40 (`:53-56`), `ITEM_FIELDS` allowlist (`:50`) |
| D | `eventLabel(e)` world-log switch | `arcade/city/city-scene.js:297-324` | per-event-type tone (client display only) | out of scope here; flagged for the world-log section, NOT this one |

This section owns **A, B, C**. (D is the world-event log, a separate surface; noted only so the next section does not collide.)

The flavor *source* is a new STATIC table. The natural home, matching the existing pattern, is alongside the block registry in `arcade/city/city-block.mjs` (where `CITY_ROOMS` `:171-178` and `BLOCK_LABELS` `:137-143` already live as frozen per-block config). Proposed name: `BLOCK_FLAVOR` — a frozen `Object.freeze({...})` keyed by `city_id`, each value a small closed record (e.g. `{ event_mood, event_prefix, activity_tone }`). The exact field set is a design choice to lock in the ADR; the **constraint** is that it is static config, deep-frozen, and read-only.

Why `city-block.mjs` and not the events module: `city-district-events.mjs` already `import { CITY_IDS, getCity } from './city-block.mjs'` (`:31`), and `buildDistrictEvent` already calls `getCity(cityId)` (`:194`) to resolve the display name. Flavor rides the **same resolution path that already exists** — `getCity` (or a sibling `getBlockFlavor(cityId)`) returns the static record, `eventLabel`/`eventSummary` take it as an *optional* third argument and fall back to today's generic copy when absent. Old behavior is the default; no caller is forced to change.

---

### How the schedule spans all six blocks with character

No schedule change is needed or proposed. `blockForWindow(index) = pick(CITY_IDS, index)` (`:153-155`) already cycles deterministically through `[downtown-01, harbor-02, skyline-03, foundry-04, nexus-05, garden-06]`, and `typeForWindow(index) = pick(EVENT_TYPES, index)` (`:148-150`) cycles the 5 event types. Because the block-list length (6) and type-list length (5) are coprime, the (type × block) pairing precesses — every block eventually wears every event type, and Garden/Nexus get equal airtime with Downtown. That rotation is the engine; **flavor is the paint.**

The only thing missing is that the *paint* is currently uniform. We give each block a tone so that when the deterministic schedule lands on it, the copy *sounds like that place*:

- **downtown-01 (`neon-noir`, "Downtown Block")** — dense, signal-heavy, the data hub. Default landmarks (no BLOCK_LABELS override): DATA SPIRE / RAMEN 24/7 / MAG-LEV STATION / NEON CIRCUIT ARCADE (`:65-68`). Tone: *charged / busy*.
- **harbor-02 (`tidal-cyan`, "Harbor Block")** — maritime, ferries, tides. Landmarks: HARBOR CONTROL / DOCKSIDE NOODLES / FERRY TERMINAL (`:138`). Tone: *steady / incoming*.
- **skyline-03 (`sunset-violet`, "Skyline Block")** — high, panoramic, calm-above-it-all. Landmarks: SKY TOWER / CLOUD CAFE / SKY-TRAM HUB (`:139`). Tone: *airy / elevated*.
- **foundry-04 (`forge-ember`, "Foundry Block")** — industrial, hot, productive. Landmarks: FORGE STACK / EMBER CANTEEN / FREIGHT LINE (`:140`). Tone: *working / forging*.
- **nexus-05 (`pulse-magenta`, "Nexus Block")** — the crossroads; both corridors meet here (adjacency `skyline↔nexus`, `nexus↔garden`, `:42-49`). Landmarks: NEXUS CORE / SYNAPSE BAR / TRANSIT NEXUS (`:141`). Tone: *connective / converging*.
- **garden-06 (`bloom-cyan`, "Garden Block")** — calm, green, restorative; the "go here to slow down" block. Landmarks: BIODOME SPIRE / GREENHOUSE GRILL / GARDEN HALT (`:142`). Tone: *serene / quiet*.

This gives Nexus and Garden a **reason to read as destinations**, not just nodes on a route. Nexus is "where paths meet"; Garden is "where you go to breathe." That reinforces the Phase 8A corridor topology *as flavor* without touching adjacency or routing authority.

---

### Example flavor lines (all six blocks)

Each line below is what the **pure function would emit** once it reads the static flavor record. `shortBlockName` strips the trailing `" Block"`, so labels interpolate "Downtown", "Garden", etc. — exactly as today. These are illustrative; the final wording goes in the ADR.

**Event labels — `eventLabel(type, name, flavor)` (Attach A).** Stays a short label (build-time clamp ≤40 unchanged):

| Block | `district_signal_surge` | `district_quiet_window` | `district_block_focus` |
|-------|--------------------------|--------------------------|--------------------------|
| downtown-01 | `Downtown Signal Surge` | `Downtown Cooldown` | `Downtown in Focus` |
| harbor-02 | `Harbor Tide Surge` | `Harbor Slack Tide` | `Harbor in Focus` |
| skyline-03 | `Skyline Updraft` | `Skyline Calm Air` | `Skyline in Focus` |
| foundry-04 | `Foundry Forge Surge` | `Foundry Banked Fires` | `Foundry in Focus` |
| nexus-05 | `Nexus Crossflow` | `Nexus Lull` | `Nexus in Focus` |
| garden-06 | `Garden Bloom Pulse` | `Garden Quiet Hour` | `Garden in Focus` |

**Event summaries — `eventSummary(type, name, flavor)` (Attach B).** One descriptive line, public-safe, ≤256 (proposed). Note: `district_signal_surge` currently maps to "is the focus block for this district window" (`:177`); `district_block_focus` maps to "is the spotlight block this window" (`:181`) — flavor must respect this type boundary and not swap the two:

- **downtown-01 / `district_arcade_hour`:** "Cabinets across Downtown are running hot this window — the data hub is busy."
- **harbor-02 / `district_route_warmup`:** "Ferries are queuing — routes into Harbor are warming up this window."
- **skyline-03 / `district_quiet_window`:** "Skyline is settling into calm air; a good window to take in the view."
- **foundry-04 / `district_signal_surge`:** "Signal levels are spiking at the Forge Stack — Foundry is surging this window."
- **nexus-05 / `district_block_focus`:** "Both corridors converge on Nexus this window — it is the spotlight crossroads."
- **garden-06 / `district_quiet_window`:** "Garden is winding down into its quiet hour — systems at rest, room to wander."

Note Garden's quiet-window line *embraces* low activity as a feature, not a dead state — that is the point of giving a calm block its own voice. Note the Foundry `district_signal_surge` example uses "surging/spiking" language (signal-surge semantics) rather than "focus block" phrasing, keeping it distinct from `district_block_focus` which uses "spotlight" language.

**Activity-feed lines — `labelFor(type, name, flavor?)` (Attach C).** These coalesce by `(type, city_id)` at the head (`appendActivity`, `:210-216`) and are clamped ≤40 by `safeName`, so they stay terse. The `district_event_*` activity types receive the **event's static label** as `name` (see `activityForDistrictEvent`, `:196-203`), so flavored event labels *automatically* flow into the feed with no change to the activity allowlist:

- `district_event_active` for Garden → `"Garden Quiet Hour is active."`
- `district_event_upcoming` for Nexus → `"Nexus Crossflow starts soon."`
- `block_arrived` at Harbor (could take an optional per-block tone) → today `"Arrived in Harbor."`; flavored option `"Arrived dockside in Harbor."` (still ≤40, still pure).
- `block_became_active` at Foundry → today `"Foundry became active."`; flavored `"Foundry fires up."`

The presence/route activity types (`block_*`, `route_*`) are driven by server-authored presence deltas and route confirms — flavoring their *labels* is pure client display and changes nothing on the wire. We keep these **subtle** so the feed stays scannable; the richer prose belongs in the event card, not the 8-item feed.

---

### Bounds and safety (unchanged, restated)

- **Activity feed:** `ACTIVITY_FEED_MAX = 16` buffer / 8 displayed, coalesce by `(type, city_id)` at head — all unchanged (`city-district-activity.mjs:28, 210-216`). Flavor adds *no items*; it only changes the text of items the schedule already produces.
- **Announcements:** `ANNOUNCE_MAX = 8` per batch, dedupe by `"{event_id}#{status}"`, `announcedEventKeys` bounded to 48 (`city-district-events.mjs:38, 262-304`; `city-scene.js:431-435`) — all unchanged. Flavored labels do not change `event_id` (`eventId` is `district:window:${index}:${type}:${cityId}`, `:158-159`), so dedupe identity is stable and a flavor edit cannot cause re-announcement.
- **Allowlists:** `EVENT_FIELDS` (`:110-113`) and `ITEM_FIELDS` (`:50`) are NOT touched. `label` and `summary` are *already* on the event allowlist; `label` is already on the activity allowlist. Flavor changes the *value* of an allowlisted text field, never adds a field.
- **Clamps:** event label via `shortBlockName` ≤40 at build (`:116-120`); activity label via `safeName` ≤40 (`:53-56`). `eventSummary` is currently **unclamped** in code — Phase 8C should add an explicit ≤256-char clamp at the build site inside `buildDistrictEvent` at the `summary:` assignment (`:208-209`) as a hardening step, since richer prose makes an over-long summary more likely. (This is a *tightening*, not a loosening.)
- **Interpolation:** the only value crossing into any string remains a **static block name** (and now a static flavor record), both from `city-block.mjs`. No player id, population count, health, balance, account, or admin field is ever interpolated — `buildDistrictEvent` reads only `getCity()` + computed window times (`:191-215`).
- **Forbidden vocabulary:** every flavor string must pass the existing FORBIDDEN regex (`/buy|sell|trade|rent|own|...|reward|boosted/i`, asserted in `tests/arcade/city-district-events.spec.mjs:59`, `city-district-activity.test.mjs:100`). "Surge", "Forge", "Bloom", "Crossflow", "Quiet Hour" are clear; words like "boost" (banned: `boosted`), "prize", "earn" are forbidden and excluded by construction.

---

### Grants nothing economic / display-only

- **No economy, no rewards, no ownership.** Flavor is text on a `label`/`summary` field that already exists. It grants no tickets, no Host Rank cash value, no items, no progression, no persistence. The district-events module header already states "It NEVER changes rewards, tickets, Host Rank, Stewardship, Block Trial, prize values, or any economy — there is no economy here at all" (`city-district-events.mjs:16-18`); flavor stays inside that guarantee.
- **No authority change.** The schedule remains a pure function of the wall clock + static manifest. Server and client run the **same pure functions** with the same config (`adoptServerEventSnapshot`, `city-scene.js:400-408`); flavor lives entirely in the static table both sides import. **No Worker/DO change is proposed or needed.** The server `districtEventSnapshot` method in `city-room.ts` (`:178-181`) already publishes the allowlisted `current`/`next` event objects whose `label`/`summary` are built by these same pure functions — when the static table is present at build time, flavored copy appears in that snapshot automatically, with **no new snapshot field** (`SNAPSHOT_FIELDS` `:309-311` unchanged). The Phase 6C "Option B" server-published-flavor path is explicitly NOT invoked; static config is strictly sufficient and lower-risk.
- **No CF-7, no flag-flip, no package/live load, no production deploy.** `LIVE_WORLD_LOADER_ENABLED` stays `false`. This is content copy in a checked-in static config file.
- **HiveWorld untouched.** No bridge, no mirror change.

---

### Falsifiable / how we'd know it is wrong

This plan is **wrong / must be reworked** if any of the following turns out true when implemented:

1. **Wire shape moved.** `JSON.stringify` of an event object or activity item gains/loses a key vs. today (existing allowlist tests in `tests/arcade/city-district-events.spec.mjs:60` and `city-district-activity.spec.mjs:74` would fail). Flavor must be value-only.
2. **A flavor string trips the FORBIDDEN or PRIVATE regex.** If any per-block label/summary matches the economy/ownership/marketplace regex (`city-district-events.spec.mjs:59`) or leaks a private token, it is a violation — the copy is wrong.
3. **`event_id` changed**, causing re-announcement or dedupe drift (`announcedEventKeys` would grow or repeat). `eventId(index, type, cityId)` must be untouched.
4. **Determinism broke.** Two clients at the same `now` derive different labels/summaries (flavor read from anything other than the frozen static table, e.g. accidentally from live manifest fields). A pure-function test feeding a fixed `now` + fixed config must yield identical strings on both sides.
5. **Bounds exceeded.** An event label exceeds 40 chars post-`shortBlockName`, an activity label exceeds 40 post-`safeName`, or a summary exceeds the proposed ≤256 cap — visible as truncation/overflow on the 360×640 phone viewport in the cross-device smoke matrix.
6. **A block has no voice.** If the implemented `BLOCK_FLAVOR` table is missing an entry for any of the six `CITY_IDS` (especially `nexus-05` / `garden-06`), the fallback must still produce today's generic-but-valid copy — never `undefined`/`null` in a label. A test asserting `getBlockFlavor` total coverage of `CITY_IDS` (mirroring the existing "all 6 CITY_IDS in ADJACENCY" check) catches a gap.
7. **The feed got noisier.** If flavor adds feed *items* (rather than re-wording existing ones) and the displayed feed exceeds 8 or stops coalescing, the change overstepped — flavor must not create new activity emissions.
8. **Type semantics mixed.** `district_signal_surge` flavor copy must use surge/signal framing; `district_block_focus` flavor copy must use spotlight/focus framing. The two types are distinct in today's code (`:177` vs `:181`). If an implementation assigns "focus block" prose to a signal_surge event, or "surging/spiking" prose to a block_focus event, the semantic contract is broken and existing FORBIDDEN/type tests will not catch it — only a per-type label assertion will. This assertion must be added to the test extensions listed below.

---

### Files / artifacts this section points at

- `arcade/city/city-district-events.mjs:163-172` (`eventLabel`), `:174-184` (`eventSummary`), `:191-215` (`buildDistrictEvent` build/clamp site), `:148-155` (schedule rotation), `:110-113` / `:309-311` (allowlists, untouched)
- `arcade/city/city-district-activity.mjs:59-76` (`labelFor`), `:50` / `:53-56` (allowlist + clamp), `:196-203` (`activityForDistrictEvent` — event label flows to feed)
- `arcade/city/city-block.mjs:171-178` (`CITY_ROOMS`), `:137-143` (`BLOCK_LABELS` pattern to mirror — note `downtown-01` has no override entry; its default labels are the BUILDINGS array defaults: DATA SPIRE / RAMEN 24/7 / MAG-LEV STATION / NEON CIRCUIT ARCADE at `:65-68`), `:181-183` (`getCity` resolution path) — proposed home of new frozen `BLOCK_FLAVOR`
- `arcade/city/city-scene.js:384-388` (`blockName`), `:400-437` (snapshot adopt + `pollDistrictEvents`) — display path, no change required
- Tests to extend (pure, no new files strictly required): `tests/arcade/city-district-events.test.mjs`, `tests/arcade/city-district-events.spec.mjs`, `tests/arcade/city-district-activity.test.mjs` — add per-block flavor assertions + per-type semantic boundary assertion (signal_surge ≠ block_focus framing) + re-assert FORBIDDEN/PRIVATE/allowlist/clamp; full coverage of all 6 `CITY_IDS`
- Docs: extend the Phase 8C plan doc + an ADR recording the `BLOCK_FLAVOR` static-config decision (per the project charter rule to record significant architectural decisions in `docs/PROJECT_CHARTER.md`)

---

## 3. Non-Reward Objectives & Things To Do

> **Phase 8C is PLAN-ONLY.** Nothing in this section ships code, deploys, migrates, flips a flag, or loads a package. `LIVE_WORLD_LOADER_ENABLED` stays `false`; CF-7 stays disabled; HiveWorld is untouched. Every objective below grants **nothing economic** — it is display, acknowledgement, or achievement-of-traversal only. The default carrier is **STATIC CONFIG + client-side display derivation**; no Worker/DO authority change is proposed (one optional, strictly-bounded server option is flagged and argued separately in §Open Items, and even it adds no economy/reward and no new authority surface).

### Design rule for this section

An objective qualifies as a *thing to do* only if it (a) gives one or more of the six blocks a concrete "why go there", (b) rides an **existing** system named in the grounding facts, and (c) produces at most a *display string, an ephemeral acknowledgement, or a local "seen it" marker*. The moment an objective would write a persistent player record, mint a count that survives reload as a balance, or hand back anything redeemable, it is out of scope and listed under §Temptations to Forbid.

The four existing carriers we attach to (no new ones invented):

1. **Phase 7A interaction zones / action prompts** — `arcade/city/city-interactions.mjs`. `INTERACTION_KINDS` is the **frozen 5-item set** `['arcade_entry','block_travel','district_event','activity_board','block_preview']` (lines 20-26). `FORBIDDEN_RE` (line 42) lexically rejects economy/ownership/gambling/crime copy in any zone `label`/`prompt`. **No new kind is proposed** — adding a kind needs a charter ADR, and 8C does not need one.
2. **Phase 7E server-confirmed receipts** — `arcade/city/city-interaction-receipts.mjs`. `buildInteractionReceipt()` answers an action request with an **ephemeral, public-safe** receipt. The base shape always carries `kind`, `receipt_id`, `action_kind`, `city_id`, `accepted`, `reason`, `issued_at`, and `public_safe:true`; action-specific fields (`zone_id`, `target`, `target_city_id`) are conditionally present (lines 49-94). It has **NO persistence, NO ledger**, and **NO coupling** to economy/Host-Rank/Block-Trial/Stewardship. We reuse it as-is for acknowledgement; we do not extend its allowlist.
3. **Block Trial (Phase 4G)** — `arcade/city/city-battle-instance.mjs`. `OBJECTIVE='signal_grid_trial'` (line 29), `SCORE_CAP=3` (= node count, line 38), `TRIAL_DURATION_MS=60_000` (line 25). Outcome `{result, stabilized, node_count, duration_ms}` is **ephemeral and display-only**; closing discards the instance; public city + stewardship are never mutated (lines 56-74).
4. **World Event Log (Phase 4C)** — `arcade/city/city-events.mjs`. Server-authored, `MAX_CITY_EVENTS=50` FIFO (line 20). Payload is filtered to the **frozen `ALLOWED_PAYLOAD_KEYS`** scalar allowlist (line 60) by `sanitizeEventPayload()` (lines 65-75). The trial already emits `city_block_trial_completed` with `instance_id/objective/status/node_count/stabilized_count/duration_ms` only (lines 44-51, 60) — a **non-cash, ephemeral, display-only** record. We reuse that existing record; we do not add account-scoped persistence.

Two supporting display surfaces that copy attaches to without any wire/authority change:

- **Activity feed** `arcade/city/city-district-activity.mjs` — `labelFor(type, name)` (lines 59-76) is a pure function; `ACTIVITY_FEED_MAX=16`, `ACTIVITY_UI_MAX=8` (defined in `arcade/city/city-scene.js:102`); `safeName()` clamps to 40 chars; the wire `ITEM_FIELDS` allowlist (line 50) is the choke point.
- **District events** `arcade/city/city-district-events.mjs` — `eventLabel`/`eventSummary` (lines 163-184) are pure; event `EVENT_FIELDS` allowlist (lines 110-113) is the choke point.

---

### Objective catalog

Each objective states: **Carrier** · **What it acknowledges** · **Where it attaches (grounded)** · **Per-block specifics (all six)** · **Grants-nothing-economic note** · **Falsifiable check**.

---

#### OBJ-1 — "District Tour": visit all six blocks (traversal-completion, client-display only)

- **Carrier:** Client-side display derived from existing route/arrival signals. The *acknowledgement* of arrival already exists: `activityForArrival` seeds a `block_arrived` activity item (`arcade/city/city-district-activity.mjs:146-203`; `arcade/city/city-scene.js:384-388`). The Tour is a **local, in-page** derived set of which of the six `CITY_IDS` the current session has arrived in.
- **What it acknowledges:** "You have set foot in N of 6 blocks this session." It is achievement-of-traversal, surfaced as a small readability badge in the district panel (`renderDistrict()`, `arcade/city/city-scene.js:451-546`) — e.g. a `3/6 blocks seen` line.
- **Attach point (grounded):** No wire change. The client already learns the canonical arrival via `block_arrived`; the Tour just unions the `city_id`s it has observed this session into a `Set` (bounded to the 6 known `CITY_IDS`). Copy passes through nothing server-side. Readability-polish slot is the existing district-panel "Readability Polish Attachment Point" (district header / sub-line).
- **Per-block specifics:** All six are first-class members: `downtown-01`, `harbor-02`, `skyline-03`, `foundry-04`, **`nexus-05`**, **`garden-06`**. Because `nexus-05` and `garden-06` sit on the *second* corridor (`downtown↔garden↔nexus↔skyline`, `arcade/city/city-district.mjs:42-49`), completing the Tour **structurally requires** using the new cross-path — you cannot reach all six on the original 4-block ring alone. That is the corridor's "reason to move."
- **Grants nothing economic / display-only:** No ticket, currency, item, Host-Rank cash value, or persistent unlock. The `Set` is **session-local and ephemeral** — it resets on reload and is never written to a DO, account, or ledger. Completing it changes one display string ("6/6 blocks seen") and nothing else. No `block_travel` adjacency rule is relaxed; the player still routes only to direct neighbors validated by `validateRouteRequest`.
- **Falsifiable / how we'd know it's wrong:** (a) If anything persists across reload, it is wrong — a smoke test reloads after `6/6` and asserts the counter is back to the count of blocks re-observed (not magically 6). (b) If the Tour text ever matches `FORBIDDEN_RE` or the PRIVATE-data regex, it is wrong (grep the rendered panel text in a spec, per the existing `city-district-activity.spec.mjs:74` pattern). (c) If completing it triggers any `city_*` event emission or any activity item *type* outside the 11 allowed `ACTIVITY_TYPES`, it is wrong.

---

#### OBJ-2 — "Landmark Check-In": use each block's signature landmark (district_event ack via existing receipt)

- **Carrier:** **Phase 7A `district_event` / `activity_board` / `block_preview` action prompts**, server-confirmed by the **existing Phase 7E receipt** (`buildInteractionReceipt()`), which for display acks merely "confirms the player is in a valid block context" (`arcade/city/city-interaction-receipts.mjs:49-94`). No new `INTERACTION_KIND` is added; we reuse `block_preview` (preview this block's style) or `district_event` (acknowledge the current event) as the ack vehicle, which the kernel already lists (lines 20-26) and 7E already validates.
- **What it acknowledges:** "You stood at and previewed `<LANDMARK>` in `<Block>`." A purely *I-was-here* acknowledgement, surfaced as a local check-in line. The landmark names already exist as static config in `BLOCK_LABELS` (`arcade/city/city-block.mjs:137-143`).
- **Attach point (grounded):** The acknowledgement is the existing 7E receipt — **ephemeral, public-safe, no persistence, no ledger** (confirmed at `city-interaction-receipts.mjs:49-94`). Display copy uses `block_preview`'s already-allowed prompt path. Optional readability flavor rides the existing FLAVOR HOOK #1 `labelFor(type, name)` extension (`city-district-activity.mjs:59-76`) — still 40-char clamped, still allowlist-validated at `activityItem()`.
- **Per-block specifics (the six landmarks, from `BLOCK_LABELS`):**
  - `downtown-01` — no `BLOCK_LABELS` entry; uses default `BUILDINGS` labels: **DATA SPIRE**, **RAMEN 24/7**, **NEON CIRCUIT ARCADE**, **MAG-LEV STATION** (confirm exact OBJ-2 copy against these before writing check-in text).
  - `harbor-02` — **HARBOR CONTROL** (data-spire), **DOCKSIDE NOODLES** (ramen), **FERRY TERMINAL** (maglev).
  - `skyline-03` — **SKY TOWER**, **CLOUD CAFE**, **SKY-TRAM HUB**.
  - `foundry-04` — **FORGE STACK**, **EMBER CANTEEN**, **FREIGHT LINE**.
  - **`nexus-05` — NEXUS CORE**, **SYNAPSE BAR**, **TRANSIT NEXUS**. Thematic "why go there": the crossroads block; its `NEXUS CORE` / `TRANSIT NEXUS` labels frame it as the cross-corridor pivot.
  - **`garden-06` — BIODOME SPIRE**, **GREENHOUSE GRILL**, **GARDEN HALT**. Thematic "why go there": the quiet/exploration block; copy leans "serene / time to explore" (matches the existing `eventSummary` "systems at rest" tone noted in the District-Events facts).
- **Grants nothing economic / display-only:** The 7E receipt is *transient* and explicitly carries **no ledger and no economy coupling**. A landmark check-in is a momentary "accepted" confirmation plus a local display line; it unlocks nothing, persists nothing, and is never converted to score, tickets, or Host-Rank value. Zone label/prompt text is force-validated against `FORBIDDEN_RE` (`city-interactions.mjs:42, 80`), so the copy *cannot* say earn/reward/prize by construction.
- **Falsifiable / how we'd know it's wrong:** (a) If a check-in produces a receipt with any fields beyond the documented shape — `{kind, receipt_id, action_kind, city_id, accepted, reason, issued_at, public_safe:true}` plus the action-conditional `zone_id`/`target`/`target_city_id` — it is wrong. Assert both that required base fields are present and that no economy/ledger field is present. (b) If we had to add a 6th interaction kind, it is wrong/out-of-scope (kinds are frozen; that needs a separate charter ADR, not 8C). (c) If any landmark string fails `FORBIDDEN_RE`, the zone is silently rejected by `validateInteractionZone` and no prompt shows — a spec must assert each of the six blocks' check-in prompts is *valid* (so we catch accidental forbidden words).

---

#### OBJ-3 — "Signal Grid Trial" per-block (existing Block Trial; ephemeral non-cash log entry)

- **Carrier:** **Block Trial (Phase 4G)** exactly as it exists — `createTrial()` / `stepTrial()` / `closeTrial()` (`arcade/city/city-battle-instance.mjs`). The trial is already instanced, non-destructive, 60 s, cooperative stabilization of 3 fixed nodes, `SCORE_CAP=3`. The *only* 8C content move is to make the trial a **reason to visit each of the six blocks** (the objective already runs per-block because it copies *that block's* stewardship style snapshot), and to surface a **per-block "trial seen here"** display drawn from the **already-emitted** `city_block_trial_completed` world-log event.
- **What it acknowledges:** "A Signal Grid Trial was completed in `<Block>` (stabilized X/3)." The completion already produces a public-safe, ephemeral world-log record (`city_block_trial_completed` with `instance_id/objective/status/node_count/stabilized_count/duration_ms`, `city-events.mjs:44-51,60`). We reuse that record as a *display-only* "this block has hosted a trial" marker — no new event type, no new payload key.
- **Attach point (grounded):** Eligibility to **start** reuses the existing Host-Rank gate `isStewardshipEligible` (defined at `arcade/city/city-stewardship.mjs:133`; applied at `workers/arcade/src/city-room.ts:690`). Gate condition: tier ∈ {helper, signaler, anchor} OR support_signal ∈ {steady, active}. *Joining stays open to any member* (no gate on join). Display copy rides FLAVOR HOOK #5 `eventLabel(e)` (`arcade/city/city-scene.js:297-324`, client-side, **no wire impact**) to give each block's trial-completed line a block-flavored phrasing.
- **Per-block specifics:** Nodes are fixed at `{500,250}/{250,500}/{750,500}` on byte-identical geometry, so the *task* is identical across all six blocks; the *flavor* differs by theme: `downtown-01` neon-noir, `harbor-02` tidal-cyan, `skyline-03` sunset-violet, `foundry-04` forge-ember, **`nexus-05` pulse-magenta** ("stabilize the crossroads"), **`garden-06` bloom-cyan** ("steady the biodome"). Because the trial copies *the current block's stewardship style* into `copied_style`, each block's trial *looks* like that block — that visual differentiation is the per-block "why do it here."
- **Grants nothing economic / display-only:** Proven non-reward by existing invariants: the trial **never writes** `cityStewardship`/`cityState`, **never touches** arcade economy / RoomRegistry / tickets / inventory, has **no payment/wager/entry fee**, and the outcome is **ephemeral and discarded on close** (`city-battle-instance.mjs:56-74`; `docs/NEON_CIRCUIT_PHASE4G_INSTANCED_BLOCK_BATTLES.md:84-96`). The `stabilized_count` is **not** a balance — it does not accumulate, does not persist to an account, and is FIFO-pruned out of the 50-event log. We add **no** "complete a trial in all six blocks → unlock" semantics that would persist (that is a forbidden temptation; see §Temptations).
- **Falsifiable / how we'd know it's wrong:** (a) The existing purity test — stewardship byte-identity before/after a trial — must stay green for all six blocks; if any block's trial mutates public state, it is wrong. (b) If `stabilized_count`/score is ever read back as a cumulative total or persisted past the 50-event FIFO window, it is wrong. (c) If trial completion grants tickets/inventory/Host-Rank cash, it is wrong (city DO is authority-isolated from RoomRegistry — assert no cross-call).

---

#### OBJ-4 — "Follow the Pulse": go to the current district focus block (display-only nudge)

- **Carrier:** **District Events (Phase 6A/6B)** display, unchanged authority. The schedule is deterministic and server-authored via `districtEventSnapshot()` (already in the `city_blocks` message, `workers/arcade/src/city-room.ts:178-181`); the client runs the same pure schedule locally (`arcade/city/city-scene.js:400-408`). The focus block rotates cyclically through `CITY_IDS`, so over a cycle **every block, including `nexus-05` and `garden-06`, becomes the focus** and gets a "go here now" moment.
- **What it acknowledges:** "Right now the district pulse is at `<Block>`." It is a *soft routing nudge*, not an objective with a record — it gives a reason to travel toward the currently-active focus block. Surfaced in the existing event card (`renderDistrict()` event card, `city-scene.js:451-546`) and optionally as an `activity_board` view ack via 7E (ephemeral).
- **Attach point (grounded):** Copy only — FLAVOR HOOK #3 `eventLabel(type, name)` and FLAVOR HOOK #4 `eventSummary(type, name)` (`city-district-events.mjs:163-184`), extended to vary per-block tone (Garden "serene", Nexus "crossroads busy"). `eventLabel` output stays `shortBlockName` 40-char clamped; `eventSummary` must adopt a **≤256-char bound** ("to confirm" — the brief proposes 256; pick and assert it). The `EVENT_FIELDS` allowlist (`city-district-events.mjs:110-113`) is unchanged.
- **Per-block specifics:** Garden + Nexus get distinct focus copy so the nudge feels intentional: e.g. `district_block_focus` on `garden-06` → "Garden is the quiet focus — good window to explore the BIODOME SPIRE"; on `nexus-05` → "Nexus is the focus — the crossroads is busy this window." Downtown/harbor/skyline/foundry keep their existing tone. All copy is **static-config-derived**; only the static `display_name` is interpolated.
- **Grants nothing economic / display-only:** The event card is read-only; following the pulse grants nothing — no reward for being in the focus block, no penalty for not. It changes a display string and (at most) seeds an ephemeral `activity_board` ack receipt. No `block_travel` adjacency is relaxed; the player still routes via valid neighbors.
- **Falsifiable / how we'd know it's wrong:** (a) If a player in the focus block receives *any* differential state (score, ticket, eligibility, rank bump) versus a player elsewhere, it is wrong — the focus is *display only*. (b) If `eventSummary` exceeds the chosen bound, it is wrong (assert the cap). (c) If focus copy matches `FORBIDDEN_RE`/PRIVATE regex, it is wrong (extend `city-district-events.spec.mjs:59-60` to cover Garden + Nexus copy specifically — the grounding facts note these are currently *untested*).

---

#### OBJ-5 — "Cross-Corridor Run": traverse the new `downtown↔garden↔nexus↔skyline` path (traversal acknowledgement)

- **Carrier:** Client-display derived from existing `route_requested` / `route_confirmed` / `block_arrived` activity items (`city-district-activity.mjs:146-203`) plus the existing adjacency graph (`city-district.mjs:42-49`). This objective exists specifically to give the **Phase 8A second corridor** a reason to be used.
- **What it acknowledges:** "You traversed the cross-corridor (downtown → garden → nexus → skyline)" — achievement-of-traversal across the *new* path, surfaced as a local district-panel line. It directly motivates movement through `garden-06` and `nexus-05`, the two blocks most likely to be ignored if players stay on the original ring.
- **Attach point (grounded):** No wire change; it unions observed `route_confirmed`/`block_arrived` `city_id`s along the known cross-corridor sequence (a fixed 4-node path from the static adjacency). The adjacency itself is *not* modified. Display rides the existing activity feed and/or the district-panel readability slot.
- **Per-block specifics:** Centers on `garden-06` and `nexus-05` (the corridor's middle), with `downtown-01` and `skyline-03` as the endpoints shared with the original ring. The original 4-block ring (`downtown-harbor-skyline-foundry`) is *not* a substitute — completing this run is impossible without entering Garden and Nexus, which is the whole point.
- **Grants nothing economic / display-only:** Session-local, ephemeral, resets on reload. No currency, no item, no persistent unlock, no Host-Rank cash. It is a *narrative acknowledgement of movement*. Routing stays bounded — no multi-hop, no non-adjacent jump; each leg is still `validateRouteRequest`-gated server-side.
- **Falsifiable / how we'd know it's wrong:** (a) If the run lets a client request a non-adjacent jump (e.g. downtown→skyline directly), it is wrong — assert `validateRouteRequest` still rejects `not_adjacent`. (b) If completion persists or grants anything redeemable, it is wrong. (c) Add the recommended `city-district-nexus-garden-routes.spec.mjs` (grounding facts §Recommended) to prove the corridor legs `downtown→garden`, `garden→nexus`, `nexus→skyline` actually fire presence-push + activity with no FORBIDDEN/PRIVATE leakage — currently **untested**.

---

### Summary table

| ID | Objective | Carrier (existing system + file) | Acknowledges | Persistence | Economic grant |
|----|-----------|----------------------------------|--------------|-------------|----------------|
| OBJ-1 | District Tour (6 blocks) | Client display from `block_arrived` (`city-district-activity.mjs`) | "N/6 blocks seen" | Session-only, resets on reload | **None** |
| OBJ-2 | Landmark Check-In | 7A prompt + 7E receipt (`city-interactions.mjs`, `city-interaction-receipts.mjs`) | "Stood at `<LANDMARK>`" | Ephemeral receipt only | **None** |
| OBJ-3 | Per-block Signal Grid Trial | Block Trial 4G (`city-battle-instance.mjs`) + world log | "Trial completed here (X/3)" | FIFO-pruned event, ephemeral | **None** |
| OBJ-4 | Follow the Pulse | District Events 6A/6B (`city-district-events.mjs`) | "Pulse is at `<Block>`" | None (display copy) | **None** |
| OBJ-5 | Cross-Corridor Run | Client display from route/arrival items + adjacency | "Traversed downtown↔garden↔nexus↔skyline corridor" | Session-only | **None** |

All five attach **without** a new DO, migration, ledger, economy field, or new interaction kind — consistent with the grounding fact "Adding a non-reward objective requires NO new DO… reuses zones (7A), Host Rank (4E), Block Trial (4G), Scheduler (4D), Events (4C)."

---

### Temptations to FORBID (enumerated so the plan bans them)

These are the seams where a "thing to do" silently becomes a reward/currency/item. Each is explicitly **out of scope for 8C and any future phase under the current charter**, and maps to an existing guard that would already catch it:

1. **Persisting "visit all six" / Tour completion to an account or DO** as an unlockable record. → FORBIDDEN. Tour state stays session-local. (Crosses the "persist objective completion in an account record with unlock/progression semantics" red flag.)
2. **Converting Block-Trial `stabilized_count`/score into cumulative XP, tickets, tokens, or any transferable/redeemable good.** → FORBIDDEN. Score is bounded 0-3, ephemeral, non-cumulative, FIFO-pruned. (Guarded by city-DO ↔ RoomRegistry authority isolation.)
3. **Entry fees, wagers, "pay to start a trial", or any cost to attempt an objective.** → FORBIDDEN. Trials are FREE and OPEN to join.
4. **Adding a 6th `INTERACTION_KIND`** (e.g. `quest`, `bounty`, `collect`) to carry objectives. → FORBIDDEN in 8C — the set is frozen and changing it needs a separate charter ADR, not a content phase. Reuse the existing 5 kinds.
5. **Reward/earn/prize/bonus/unlock copy in zone labels, event labels, activity labels, or landmark check-in text.** → STRUCTURALLY BLOCKED by `FORBIDDEN_RE` (`city-interactions.mjs:42`) and the test FORBIDDEN-vocabulary regex; any such string is silently rejected or fails the spec. Do not try to route around it.
6. **Turning Host Rank into a property right or a permanent profile** that an objective "levels up". → FORBIDDEN. Host Rank is a bounded (0-100), 60-second-window, non-cumulative **current signal** used only as an eligibility *gate* to start a trial — never a balance, never persistent, never tradeable.
7. **Marketplace / trading / leaderboard-with-payout for trial outcomes, landmarks collected, or Tour completion.** → FORBIDDEN. No ranking that confers anything; display-only at most.
8. **Coupling any objective outcome to the arcade economy** (tickets, Prize Counter, inventory). → FORBIDDEN. City DO stays authority-isolated from RoomRegistry; no cross-call.
9. **A Worker/DO authority change to "track" objectives.** → DEFAULT-FORBIDDEN. Every objective above is satisfied by static config + client display or by *existing* ephemeral receipts/events. Do not add server-side objective tracking. (See Open Items for the single narrow exception and why even it is unnecessary for 8C.)
10. **Smuggling 8B (partial-manifest / more blocks) or CF-7 staging in as "needed for objectives".** → FORBIDDEN and explicitly out of 8C scope.

A static CI gate should run the FORBIDDEN/PRIVATE regexes over **every** new objective string (Tour line, landmark check-in, focus copy, corridor copy) before merge — the grounding facts already list `grep for FORBIDDEN|PRIVATE in tests/arcade/*.spec.mjs` as the audit hook; extend it to the new copy and specifically to Garden + Nexus, which are currently uncovered.

---

### Open Items / to confirm

- **Downtown default landmark labels** — `BLOCK_LABELS` has no `downtown-01` entry; the default building labels from `CITY_BLOCK.buildings` apply: **DATA SPIRE**, **RAMEN 24/7**, **NEON CIRCUIT ARCADE**, **MAG-LEV STATION**. Write OBJ-2 check-in copy against these four strings exactly.
- **`eventSummary` length bound** — the brief proposes **≤256 chars**; this is currently unbounded. **To confirm and assert** before extending OBJ-4 copy.
- **Activity-feed `block_arrived` sufficiency for OBJ-1/OBJ-5** — confirm the client reliably observes a `block_arrived` for *each* of the six blocks on the cross-corridor. The corridor legs `downtown→garden`, `garden→nexus`, `nexus→skyline` are flagged **untested** in the grounding facts; the recommended `city-district-nexus-garden-routes.spec.mjs` should land first so the display objective has a verified signal to derive from. (`foundry-04` is not part of this corridor — it neighbors only `downtown-01` and `skyline-03` per `city-district.mjs:46`.)
- **Single narrow server option (explicitly argued, and rejected for 8C):** One could imagine the server *publishing* which blocks have hosted a trial this window (so OBJ-3's "trial seen here" survives a reconnect within the window). This is **not strictly necessary** — the existing `city_block_trial_completed` event already crosses the wire public-safe, and the marker is acceptably ephemeral/session-local. Because it would add a new field to a snapshot allowlist for *zero* user-path benefit and risks normalizing "objective state on the server," **8C does not propose it.** If a future phase wants it, it must be argued separately and still add no economy/reward and no new authority surface; it is not authorized here.

---

## 4. Route & Readability Polish — the six-block graph and new corridor are legible

### Goal and boundary

Make the six-block district readable at a glance: a player should be able to tell **where they are**, **which blocks are adjacent**, **what each adjacent block *is***, and **that there are now two ways to cross the district** (the original ring plus the new downtown⇄garden⇄nexus⇄skyline corridor). Every change in this section is **display-only client rendering over the existing public-safe manifest**. It grants nothing economic, persists nothing, and adds no server message, DO field, migration, schema bump, or authority. The data already on the wire (`districtManifest()` → `blockPublicSummary` per block + `adjacency` map) is sufficient; we are only rendering it better.

**Default posture: STATIC CONFIG + CLIENT DISPLAY.** No Worker authority change is proposed anywhere in this section, and none is justified as necessary — see "Server-change boundary" below.

### What the player sees today (grounding)

- `renderDistrict()` (`arcade/city/city-scene.js:451-546`) draws the top-right DISTRICT panel: header `DISTRICT · {display_name}` + live/offline/refresh indicator (lines 467-477), a current-block line `theme {theme} · {N} here` (line 479), the event card (lines 485-509), then a **flat list of adjacent blocks** each rendered as `{display_name} · {N} here` + a `Travel` button (lines 511-527), then the transient route status (lines 528-531) and the District Activity feed (lines 534-545). The top-bar sub-line (line 462) reads `display_name.toLowerCase() · prototype` — e.g. `"downtown block · prototype"`.
- The adjacency itself comes from `cur.adjacent` (line 511), which is the server-authored `adjacent` array inside `blockPublicSummary` (`arcade/city/city-district.mjs:115`), populated from the frozen `ADJACENCY` graph (`city-district.mjs:42-49`).
- The minimap (`arcade/city/city-minimap.js:12-67`) draws **one block's interior** (roads, building massing, portal, players) — it has **no district-graph view at all** and currently shows nothing about neighbors or corridors.
- Per-block identity that already exists statically: `display_name` per block in `CITY_ROOMS` (e.g. `'Downtown Block'`, `'Harbor Block'`, … `'Garden Block'`) and `theme` token (e.g. `'neon-noir'`, `'tidal-cyan'`, `'sunset-violet'`, `'forge-ember'`, `'pulse-magenta'`, `'bloom-cyan'`) — these are string identifiers only; none of the four non-primary themes (`sunset-violet`, `forge-ember`, `pulse-magenta`, `bloom-cyan`) have a corresponding CSS custom property in `city.css` (only `--cy`, `--mg`, `--am` are defined). Landmark `BLOCK_LABELS` per block (`city-block.mjs:137-143`): harbor→HARBOR CONTROL/DOCKSIDE NOODLES/FERRY TERMINAL; skyline→SKY TOWER/CLOUD CAFE/SKY-TRAM HUB; foundry→FORGE STACK/EMBER CANTEEN/FREIGHT LINE; nexus→NEXUS CORE/SYNAPSE BAR/TRANSIT NEXUS; garden→BIODOME SPIRE/GREENHOUSE GRILL/GARDEN HALT. Downtown-01 has no entry in BLOCK_LABELS and falls through to the geometry defaults: DATA SPIRE / RAMEN 24/7 / MAG-LEV STATION.

**Real ADJACENCY edges** (`city-district.mjs:42-49`):
- downtown-01: harbor-02, foundry-04, garden-06
- harbor-02: downtown-01, skyline-03
- skyline-03: harbor-02, foundry-04, nexus-05
- foundry-04: downtown-01, skyline-03
- nexus-05: skyline-03, garden-06
- garden-06: downtown-01, nexus-05

The two traversal paths downtown↔skyline: (A) downtown→harbor→skyline and (B) downtown→garden→nexus→skyline. Harbor and foundry are **not adjacent** to each other.

The legibility gaps: (1) the adjacent list is flat — a player can't tell the original ring-path from the new corridor-path; (2) `Travel` buttons say only a name and a count, never *why* a block is worth visiting or *what it is*; (3) the minimap shows local geometry but never the six-node graph; (4) there is no "you are here vs. there" framing beyond the header.

### Polish 1 — Per-block identity copy as STATIC CONFIG (the "what it is" layer)

Add a frozen, client-side identity table keyed by `city_id`, giving each block a short **tagline** (its character) and a one-line **why_visit** affordance. This is pure display config; it interpolates no runtime, player, or economic data.

**Where it lives:** a new frozen const in a dedicated client-display module `arcade/city/city-block-identity.mjs`, pure, importable by `city-scene.js`. This is the chosen approach; it does **not** touch the wire payload, allowlist, or schema version (no CITY_ROOMS change, no `blockPublicSummary` field added, schema stays at v8).

**Per-block content** (derived only from already-shipped `theme` + `BLOCK_LABELS`, so copy is consistent with signage the player already reads). Note: taglines and why_visit are supplementary strings rendered in separate UI elements alongside `display_name`; they must compose correctly with the full display_name value (e.g. "Downtown Block — the hub", not "Downtown — the hub"):

| block | display_name (existing) | landmark anchor (existing) | tagline (new, static) | why_visit (new, static) |
|---|---|---|---|---|
| downtown-01 | Downtown Block | DATA SPIRE / RAMEN 24/7 / MAG-LEV STATION | "the hub" | "Central crossroads — three ways out." |
| harbor-02 | Harbor Block | HARBOR CONTROL / DOCKSIDE NOODLES / FERRY TERMINAL | "the waterfront" | "Quiet dockside route toward Skyline." |
| skyline-03 | Skyline Block | SKY TOWER / CLOUD CAFE / SKY-TRAM HUB | "the heights" | "High ground where both corridors meet." |
| foundry-04 | Foundry Block | FORGE STACK / EMBER CANTEEN / FREIGHT LINE | "the works" | "Industrial spur on the original ring." |
| nexus-05 | Nexus Block | NEXUS CORE / SYNAPSE BAR / TRANSIT NEXUS | "the crossing" | "New corridor's pivot between Garden and Skyline." |
| garden-06 | Garden Block | BIODOME SPIRE / GREENHOUSE GRILL / GARDEN HALT | "the green" | "Calm new-corridor entry from Downtown." |

All copy above is **proposed and to confirm with the operator**; it is written to pass the FORBIDDEN/PRIVATE vocabulary guards (no buy/sell/own/reward/etc. per `tests/arcade/city-district-activity.test.mjs:100` and the PRIVATE regex). Garden and Nexus are deliberately framed around the **new corridor** so the copy itself teaches the topology.

**Grants nothing economic / display-only:** these are static strings rendered as text; no eligibility, no Host Rank value, no ticket, no persistence. All strings must be linted against the FORBIDDEN regex as a CI gate before shipping.

### Polish 2 — DISTRICT panel: group adjacency by corridor, label current-vs-adjacent

Restructure the adjacent-block loop in `renderDistrict()` (`city-scene.js:511-527`) so the flat list becomes **two labeled groups**, computed entirely client-side from the manifest adjacency the client already holds.

**Current-block framing:** extend the current line (line 479) to include the identity tagline — render `display_name` + tagline ("Downtown Block — the hub") above the existing `theme {theme} · {N} here`. A small "YOU ARE HERE" affordance (text or a left color-bar) distinguishes the current block from adjacent rows. Display-only; no new data.

**Corridor grouping:** the two traversal paths are derivable from the static `ADJACENCY` graph in the manifest. Group each adjacent block under a heading using a pure client function `corridorOf(currentId, adjacentId)` seeded by a small static edge-set constant. The ring path edges are: downtown↔harbor, harbor↔skyline, skyline↔foundry, foundry↔downtown. The new-corridor edges are: downtown↔garden, garden↔nexus, nexus↔skyline. Note: **foundry and harbor are not adjacent** — no edge between them exists.

From downtown-01 (degree 3): harbor-02 and foundry-04 appear under **Ring**; garden-06 appears under **New corridor**.
From skyline-03 (degree 3): harbor-02 and foundry-04 appear under **Ring**; nexus-05 appears under **New corridor**.
From harbor-02 (degree 2): downtown-01 and skyline-03 both appear under **Ring** only.
From foundry-04 (degree 2): downtown-01 and skyline-03 both appear under **Ring** only.
From nexus-05 (degree 2): skyline-03 and garden-06 both appear under **New corridor** only.
From garden-06 (degree 2): downtown-01 and nexus-05 both appear under **New corridor** only.

Downtown and Skyline are the shared endpoints of both paths; from those two blocks the panel shows both group headers. From harbor/foundry only the Ring heading appears; from garden/nexus only the New-corridor heading appears.

**Per-row identity:** each adjacent row keeps its existing `{display_name} · {N} here` + `Travel` button (the `net.requestRoute` call at line 523-524 is untouched), and appends the static tagline so the player reads *what* the neighbor is. The faded `dist-quiet` health treatment (line 522) is preserved.

### Polish 3 — Travel-control "why go there" affordance (per-adjacent identity, display-only)

Extend each `Travel` button row (`city-scene.js:511-527`) with the adjacent block's `why_visit` line and an accessible name:

- Render the `why_visit` string as a visible sub-line on desktop and always as the button's `aria-label` so screen readers and the mobile tray (which must keep ≥40px tap targets with accessible names per the mobile constraint) both benefit.
- Garden and Nexus specifically get corridor-aware phrasing so the new path is self-explanatory. These strings are static and do **not** vary by population, score, or any server value — no dynamic interpolation beyond the static tagline, matching the activity/event label safety model (`safeName`/`shortBlockName` projection).
- **Grants nothing economic:** the button still calls the identical `net.requestRoute(b.city_id)`; the affordance is pure prompt copy. No reward, no eligibility, no Host Rank coupling. Copy is lexically guarded by the FORBIDDEN regex.

### Polish 4 — Minimap district-graph inset (six nodes + two corridors)

Add a small, optional **district-graph inset** rendered as procedural Canvas-2D (consistent with the existing asset-free minimap in `city-minimap.js`), showing the six blocks as nodes and the adjacency as edges, with the two corridors visually distinguished.

**Source data:** the static `ADJACENCY` graph already present in the manifest the client holds — **no new server data**. Node identity (color) must be assigned as an explicit design decision: the CSS root (`city.css:3-11`) defines only three tokens (`--cy: #22e0ff`, `--mg: #ff2d95`, `--am: #ffb020`). The theme strings `sunset-violet`, `forge-ember`, `pulse-magenta`, and `bloom-cyan` are not mapped to hex anywhere in the codebase — they exist only as identifier strings in `CITY_ROOMS`. **The per-node hex colors for the graph inset are a required design decision that must be made before implementation; they cannot be auto-derived from existing code.** Proposed: map downtown→`--cy`, harbor→`--cy` (tidal variant, same family), skyline→a violet to assign, foundry→`--am` (amber/ember family), nexus→`--mg`, garden→`--cy` (bloom, cyan family) — but the exact values are **to confirm with design**.

**Corridor legibility:** draw ring-path edges in one treatment (e.g., solid) and new-corridor edges in another (e.g., dashed or a second accent), with the **current block** node highlighted and adjacent nodes emphasized.

**Layout:** a fixed static node layout (six positions) is fine. This should be a separate collapsible "DISTRICT MAP" inset rather than overlaying the existing local minimap, since the current minimap is intentionally a single-block interior radar. Must be lightweight and redraw-safe (six nodes, no spatial queries), and reduced-motion-safe.

**Grants nothing economic / display-only:** pure presentation reading static topology + the player's current block; owns no state or authority, exactly like the existing minimap.

### Polish 5 — Route status legibility (transient, no new state)

Polish the route status copy to name the **corridor** being traversed using the same static classifier from Polish 2. Two write sites must both be updated:
- `city-scene.js:524` — the Travel button click handler, which sets `routeStatus = \`routing to ${b.display_name}…\``.
- `city-scene.js:552` — inside `onRouteResult()`, which sets `routeStatus = \`traveling to ${blockName(m.target_city_id)}…\``.

The render site at lines 528-531 is read-only and requires no change. Proposed output: "Routing to Garden Block — new corridor…" / "Routing to Harbor Block — ring…". Blocked-route copy (`route blocked: {reason}` at line 556) stays as-is. No new timing, no `en route` animation, no Phase 8B momentum — that is explicitly out of scope. Display-only; resets on reconnect as today.

### Server-change boundary (explicitly: none proposed)

No Worker/DO/authority change is proposed or required. Everything above is derivable from data already on the wire:

- block identity copy → **static client config** (Polish 1, standalone `city-block-identity.mjs`), never crosses the wire;
- corridor grouping + current-vs-adjacent → pure client derivation over the `adjacency`/`adjacent` fields already in `districtManifest()`/`blockPublicSummary` (`city-district.mjs:106-145`);
- travel affordance copy → static client config;
- minimap graph → static `ADJACENCY` already in the manifest + the client's known current block.

The schema stays at v8; `blockPublicSummary`'s frozen allowlist (`city-district.mjs:110-118`) is unchanged; no field is added to any allowlist. The optional "Option B / Phase 6C" server-published-flavor path is explicitly not taken here.

### Non-economic invariants (restated for this section)

- **PLAN-ONLY:** no code, no deploy, no migration, no flag flip. `LIVE_WORLD_LOADER_ENABLED` stays false; CF-7 untouched; HiveWorld untouched.
- **Grants nothing:** no objective, no reward, no Host Rank cash value, no ticket, no persistence, no ownership. Block identity copy and corridor labels are inert text.
- **Vocabulary-guarded:** every new string (taglines, why_visit, corridor labels, map labels) must pass the FORBIDDEN regex (`tests/arcade/city-district-activity.test.mjs:100`) and contain no PRIVATE-data terms — enforced as a CI/lint gate before ship.
- **No new authority surface:** no new interaction kind (the closed 5-kind set in `city-interactions.mjs:20-26` is untouched), no new wire field, no allowlist change.

### Falsifiable / how we'd know it's wrong

This section is **wrong / must be revised** if any of the following turns out true:

1. **Adjacency mismatch:** the corridor classifier must produce, for every block, a grouped adjacent set whose union exactly equals `adjacentBlocks(cityId)`. Specifically: harbor-02 and foundry-04 must never appear as adjacent to each other (they are not in ADJACENCY); if a smoke check finds a "foundry" row displayed from harbor or vice versa, the edge-set constant is wrong. Verify per-block grouped unions match `cur.adjacent` for all six blocks.
2. **Wire creep:** if implementing any polish requires adding a field to `blockPublicSummary`/`districtManifest`, bumping `SCHEMA_VERSION` (8), or publishing server flavor, the "static client config" claim has failed and the design must be reworked to stay client-side.
3. **Vocabulary leak:** if any proposed string fails the FORBIDDEN/PRIVATE regex in `tests/arcade/*.spec.mjs`, the copy is non-compliant and must be rewritten.
4. **Mobile/readability regression:** if the grouped panel, why_visit sub-lines, or map inset cause horizontal overflow, drop a Travel tap target below 40px, or strip an accessible name on the `<560px` tray (mobile hardening constraint), the layout is wrong.
5. **Topology not legible:** if a usability/smoke pass shows a player still cannot distinguish the ring path from the new corridor (e.g., the two-corridor grouping or the dashed-edge map reads as one undifferentiated blob), the core goal is unmet and the visual treatment must change.
6. **Theme color unresolved:** the four non-primary theme tokens (`sunset-violet`, `forge-ember`, `pulse-magenta`, `bloom-cyan`) are not mapped to hex in the codebase. If the minimap graph inset proceeds without explicit hex assignments confirmed by design, node colors will be invented at implementation time, which is incorrect. This is a required pre-implementation decision.
7. **display_name + tagline composition:** if rendering a tagline alongside `display_name` produces awkward copy ("Downtown Block — the hub" must read naturally; the tagline should not duplicate the word "Block"). If the composition reads poorly in the panel, the tagline wording or placement must be adjusted.

**Cross-device smoke coverage for this section** (extends the existing matrix, no new authority): add an assertion in the district-events/presence specs (desktop + phone 390×844, per `tests/arcade/city-district-presence.spec.mjs:24-28`) that, from each of the six blocks, the panel renders the correct corridor group headers; that Garden-06 adjacent rows (downtown-01, nexus-05) appear under "New corridor"; that Nexus-05 adjacent rows (skyline-03, garden-06) appear under "New corridor"; that Harbor-02 adjacent rows appear under "Ring" only; that Harbor-02 and Foundry-04 are never shown as adjacent to each other; and that all rendered copy passes the FORBIDDEN/PRIVATE regex. This reuses the coverage gaps already flagged in the grounding facts (Nexus/Garden routes currently untested).

Relevant files: `/home/thebackhand/Downloads/clovelearn_v3_final_deploy/arcade/city/city-scene.js` (renderDistrict 451-546, Travel click 524, onRouteResult 549-559), `/home/thebackhand/Downloads/clovelearn_v3_final_deploy/arcade/city/city-district.mjs` (ADJACENCY 42-49, blockPublicSummary 106-120), `/home/thebackhand/Downloads/clovelearn_v3_final_deploy/arcade/city/city-block.mjs` (CITY_ROOMS 171-178, BLOCK_LABELS 137-143, downtown defaults BUILDINGS 65-68), `/home/thebackhand/Downloads/clovelearn_v3_final_deploy/arcade/city/city-minimap.js`, `/home/thebackhand/Downloads/clovelearn_v3_final_deploy/arcade/city/city.css` (palette tokens 3-11), proposed new `/home/thebackhand/Downloads/clovelearn_v3_final_deploy/arcade/city/city-block-identity.mjs`.

---

## 5. Static-Config vs Authority-Change Line (default: zero server change)

---

### Governing Principle

Every Phase 8C surface defaults to static config in client-side `.mjs` files or pure derivation from facts the server already publishes. A Worker/DO authority change is permitted only if: (a) the data physically does not exist anywhere the client can reach without it, AND (b) the change adds no economy, no reward, no new authority surface, and produces only public-safe, allowlist-projected output. That bar is high; by default the answer is "static config."

---

### Master Surface Table

| # | Content Surface | Implementation Layer | Files / Attach Points | Per-block specifics (all 6) | Grants nothing economic / display-only note | Server change? |
|---|---|---|---|---|---|---|
| 1 | Block taglines / "why go there" copy | **STATIC CONFIG** | `arcade/city/city-block.mjs` — extend `CITY_ROOMS` entries with optional `tagline` string | downtown-01: "data-spire hub, densest cross-traffic"; harbor-02: "maritime arcade, tidal-cyan identity"; skyline-03: "sunset canopy, elevated sightlines"; foundry-04: "forge-ember heavy industrial"; nexus-05: "pulse crossroads between two corridors"; garden-06: "bloom-cyan, quietest approach from downtown or nexus" | Display-only string, never leaves server, never crosses wire | **None** |
| 2 | Per-block landmark flavor labels | **STATIC CONFIG** | `arcade/city/city-block.mjs` `BLOCK_LABELS` dict — already keyed by `cityId`; all six blocks already have entries. Existing landmark names are the canonical source: nexus-05 has NEXUS CORE / SYNAPSE BAR / TRANSIT NEXUS; garden-06 has BIODOME SPIRE / GREENHOUSE GRILL / GARDEN HALT. Phase 8C may only add flavor copy on top of these; do not rename the existing labels. | nexus-05: NEXUS CORE / SYNAPSE BAR / TRANSIT NEXUS (all confirmed in code); garden-06: BIODOME SPIRE / GREENHOUSE GRILL / GARDEN HALT (all confirmed in code). downtown-01 uses built-in BUILDINGS defaults (no BLOCK_LABELS entry). | Geometry is byte-identical; only display strings change. `publicLayout()` already re-projects through `city-block.mjs:150-155` allowlist | **None** |
| 3 | Activity feed flavor copy — per-block arrival/departure prose | **STATIC CONFIG + CLIENT DISPLAY** | `arcade/city/city-district-activity.mjs` `labelFor(type, name)` lines 59-76 — extend signature to `labelFor(type, name, cityId?)` accepting optional lookup into a static `ACTIVITY_FLAVOR` map keyed by `(type, cityId)`. **Safety note:** `activityItem()` calls `labelFor(type, safeName(name, cityId))` — `safeName()` runs on the block `name` before it enters `labelFor()`. If a flavor entry returns a fully-replaced string rather than a `${name}` + suffix pattern, that returned string does not pass through the runtime `safeName()` 40-char clamp. Flavor map values are static config (not runtime-injected), but MUST be: (a) bounded to ≤80 chars as a pre-commit static lint assertion, and (b) run through the FORBIDDEN regex as part of the test suite extension for Phase 8C. | Example: `block_arrived` for garden-06 → "Arrived in Garden — quieter corner of the district." vs default "Arrived in Garden." For nexus-05 `block_became_active`: "Nexus is alive — cross-corridor pressure rising." | Pure function, no wire change, `safeName()` 40-char clamp still enforced on the interpolated block `name`, `activityItem()` allowlist (10 output fields: schema_version, kind, activity_id, district_id, city_id, type, occurred_at, label, severity, public_safe — with 5 variable fields in ITEM_FIELDS) unchanged, FORBIDDEN regex still applies to all output strings | **None** |
| 4 | District event flavor — per-type / per-block label adjectives | **STATIC CONFIG + CLIENT DISPLAY** | `arcade/city/city-district-events.mjs` `eventLabel(type, name)` lines 163-172 — extend with optional `BLOCK_EVENT_FLAVOR` lookup `(type, cityId)` → adjective prefix or override label | nexus-05 `district_signal_surge` → "Nexus Signal Surge — corridors converging"; garden-06 `district_quiet_window` → "Garden Quiet Window — serene systems"; foundry-04 `district_arcade_hour` → "Foundry Arcade Hour — furnace cabinets live" | `eventLabel()` output clamped via `shortBlockName()` 40 chars. `buildDistrictEvent()` re-projects through `EVENT_FIELDS` allowlist (line 110-113). FORBIDDEN regex applies | **None** |
| 5 | District event flavor — per-type / per-block summary prose | **STATIC CONFIG + CLIENT DISPLAY** | `arcade/city/city-district-events.mjs` `eventSummary(type, name)` lines 174-184 — extend with `BLOCK_EVENT_SUMMARY_FLAVOR` lookup `(type, cityId)` → prose string, bounded ≤256 chars | garden-06 `district_quiet_window`: "Garden systems are at rest. The approach from Downtown or Nexus is clear and unhurried."; nexus-05 `district_route_warmup`: "Routes into Nexus are warming — both the Skyline and Garden corridors show movement."; skyline-03 `district_block_focus`: "Skyline is the window focus. Foundry and Nexus corridors feed into this block." | `eventSummary()` currently has no clamping — Phase 8C must enforce ≤256 chars at the derivation site. FORBIDDEN regex applies to all prose. No wire change; `summary` field already in `EVENT_FIELDS` allowlist | **None** |
| 6 | World event log copy variations — per-event-type prose in client | **CLIENT DISPLAY ONLY** | `arcade/city/city-scene.js` `eventLabel(e)` lines 297-324 — extend switch cases with richer per-type prose fragments | "player-xyz stepped into the block" (arrived), "arcade interior powered up" (opened), "host rank shifted to Anchor — strong local support" (rank changed), "stewardship edit applied — forge-ember palette activated" (stewardship applied). Nexus/Garden: the wire event object has a `city_id` field (snake_case, not `cityId`); client can condition copy on `e.city_id` if present in the already-allowed `city_id` field. | Pure client-side switch. No server parsing. No wire change. All interpolated values come from public-safe event fields already on the wire (`actor_public_id`, `tier`, `support_signal`, `palette` — all in payload allowlist lines 65-75) | **None** |
| 7 | District panel top-bar subtitle "why go there" tagline | **CLIENT DISPLAY ONLY** | `arcade/city/city-scene.js` `currentBlock()` resolution path and `.sub` subtitle update on reconnect/travel | Client reads `cityId` from already-received `city_blocks` manifest, looks up static `CITY_ROOMS[cityId].tagline` (surface #1 above), renders as subtitle e.g. "nexus-05 · pulse crossroads". No new wire field needed | Pure local lookup from static config. No server change. tagline never crosses wire | **None** |
| 8 | Travel button "why go there" affordance — tooltip / aria-label | **CLIENT DISPLAY ONLY** | `arcade/city/city-scene.js` adjacent block row render (lines 511-527) — set `title` or `aria-label` on Travel button from static tagline lookup | "Travel to Garden — bloom-cyan, quietest approach"; "Travel to Nexus — pulse crossroads, connects Skyline and Garden corridors"; "Travel to Foundry — forge-ember, connects downtown and skyline" | No wire field. Pure static config lookup. `validateInteractionZone()` FORBIDDEN regex applies to tooltip copy. `aria-label` improves accessibility (≥40px tap target already required by mobile-playtest.spec.mjs) | **None** |
| 9 | Minimap block-name cardinal label overlay | **CLIENT DISPLAY ONLY** | `arcade/city/city-minimap.js` `createCityMinimap()` — add lightweight Canvas 2D `ctx.fillText()` calls after buildings render, positioned at minimap edges using static per-adjacency direction hints | Static directional hint map keyed by `cityId` pair — e.g. harbor-02 is "north" of downtown-01 on the minimap. Text: abbreviated block names ("HARBOR", "GARDEN", "NEXUS") at edges. 9px monospace, opacity 0.6, no layout reflow | Pure Canvas 2D rendering. No wire change. Static config positions. Redraw-safe (called in existing paint loop). Must not exceed 150×150px canvas boundary (104×104 on mobile). | **None** |
| 10 | Activity board non-reward objective flavor text (display prompt) | **STATIC CONFIG + CLIENT DISPLAY** | `arcade/city/city-interactions.mjs` interaction zone `label` / `prompt` fields for `activity_board` kind — provide per-block flavor within `validateInteractionZone()` 48-char label / 64-char prompt limits | downtown-01: prompt "See who's active across all six blocks."; garden-06: prompt "Quiet here — watch the cross-district pulse."; nexus-05: prompt "Cross-corridor traffic visible in this feed." | FORBIDDEN regex enforced by `validateInteractionZone()` lines 68-107. No economy/reward copy. `activity_board` kind is already in `INTERACTION_KINDS` closed set. No new kind needed | **None** |
| 11 | Block Trial objective flavor — per-block "signal node" context copy | **CLIENT DISPLAY ONLY (render-time lookup only; do not touch trialStatePayload)** | **Do not add `context_label` to `trialStatePayload()`.** Unlike `buildDistrictEvent()`, `trialStatePayload()` has no allowlist-deletion loop; any field added to the returned `trial` object is immediately broadcast on the existing `city_block_trial_state` message to all connected clients — that is a wire shape widening even though the message type name does not change. Instead: read a static `TRIAL_CONTEXT_LABELS` map keyed by `cityId` in `city-scene.js` at render time and display the flavor in the Block Trial panel via `textContent` only. `trialStatePayload()` and the DO broadcast are untouched. | downtown-01: "stabilize the data-spire grid nodes"; nexus-05: "stabilize the pulse crossroads signal nodes — both corridors feed here"; garden-06: "calm the bloom-sector signal nodes" | Trial outcome is ephemeral, non-persisted, non-economic. Flavor is display-only, client-local, zero wire impact. No ledger, no score persistence, no reward. Grants nothing | **None** |
| 12 | Route/readability polish — route status line copy | **CLIENT DISPLAY ONLY** | `arcade/city/city-scene.js` route status line render — extend transient feedback text with corridor-awareness from static adjacency | "Routing downtown → harbor corridor…" vs "Routing downtown → garden corridor…" — client already knows both `sourceCityId` (from `net.cityId`) and `targetCityId` (from the Travel button click) at click time; `cityDistrict.adjacency` (available from the already-received `city_blocks` manifest) lets it name the corridor. | Pure client text. No wire change. No new server message. Static adjacency lookup only | **None** |
| 13 | District event `eventSummary` ≤256-char bound enforcement | **CLIENT DISPLAY ONLY** | `arcade/city/city-district-events.mjs` `buildDistrictEvent()` — add `summary.slice(0, 256)` guard at event construction site before freeze | Applies to all 6 blocks uniformly. Currently no clamping exists (confirmed: `eventSummary()` has no length guard). This closes the unbounded prose risk identified in the CONSTRAINTS | Not a server change. `buildDistrictEvent()` is a pure module called by both DO and shim. The guard runs in the module, not in the Worker routing layer | **None** |

---

### Server / DO Authority Change Assessment

**Assessment: Zero server/DO authority changes are required or proposed for Phase 8C.**

Every surface in the table above is satisfied by one of three mechanisms:

1. **Static config extension** — adding fields to frozen config objects in `city-block.mjs`, `city-stewardship.mjs`, or `city-district.mjs` that are read locally by pure client-side derivation functions. No new wire field.
2. **Pure-function signature extension** — extending `labelFor()`, `eventLabel()`, `eventSummary()` with an optional `cityId` parameter that drives a local lookup. The output field (`label`, `summary`) already exists in the wire allowlist. The wire shape does not change.
3. **Client-side switch/render extension** — adding display logic to `city-scene.js` that reads already-received static-config fields or already-allowed wire fields.

No proposed surface requires a new `city_blocks` message field, a new DO endpoint, a new Durable Object migration, a new `city_route_request` shape change, a new presence delta field, or a new Worker environment variable. Surface #11 was revised specifically to remove the only path that would have silently widened the `city_block_trial_state` broadcast payload.

**If a later reviewer argues server change is needed for any surface above, the burden of proof is:** the data literally cannot be derived from (a) `CITY_ROOMS` / `BLOCK_LABELS` static config, (b) the already-received `city_blocks` manifest (`districtManifest()`), or (c) existing pure-function inputs — AND the change adds no economy, no reward, no new authority surface, and produces only public-safe allowlist-projected output.

---

### Public-Safe Projection + Forbidden-Vocabulary Guard Confirmation

**All new copy passes through existing guards without modification to those guards.**

| Guard | Where enforced | New surfaces that must pass it | Status |
|---|---|---|---|
| `safeName(name, cityId)` 40-char clamp | `city-district-activity.mjs:53-56` | Surface #3 (activity flavor) — clamp runs on the block `name` argument before `labelFor()` is called. Flavor map values that fully replace the label string (rather than embedding `${name}`) do not pass through this clamp at runtime; they must be bounded to ≤80 chars and FORBIDDEN-regex-validated as a static test-time assertion. | Holds for name interpolation; requires static lint for full-replacement flavor strings |
| `shortBlockName(name)` 40-char clamp | `city-district-events.mjs:116-120` | Surface #4 (event label flavor) — `eventLabel()` output clamps via `shortBlockName()` before `buildDistrictEvent()` | Holds — clamp precedes allowlist projection |
| `EVENT_FIELDS` allowlist freeze | `city-district-events.mjs:110-113` | Surface #4, #5 — `label` and `summary` are already in `EVENT_FIELDS`; flavor text goes into these existing fields only | Holds — no new field added to allowlist |
| `ITEM_FIELDS` allowlist | `city-district-activity.mjs:50` | Surface #3 — `label` is already in `ITEM_FIELDS` (5 variable fields); `activityItem()` produces 10 total output fields with a fixed envelope. Flavor goes into `label` only | Holds — no new field added to allowlist |
| FORBIDDEN vocabulary regex (`/buy\|sell\|trade\|rent\|own\|profit\|payout\|wager\|bet\|loot\|stake\|yield\|crypto\|token\|nft\|market\|marketplace\|landlord\|tenant\|income\|cashout\|jackpot\|multiplier\|boosted/i` in tests; broader FORBIDDEN_RE in `city-interactions.mjs:42` for zone copy) | `tests/arcade/city-district-activity.test.mjs:100`, `city-district-events.spec.mjs:59`, `city-district-activity.spec.mjs:74`, `city-interactions.mjs:40-42` | All new prose strings (surfaces #3-#12) — every new flavor string is static and auditable at write-time | Must be verified: all 6-block flavor strings in `ACTIVITY_FLAVOR`, `BLOCK_EVENT_FLAVOR`, `BLOCK_EVENT_SUMMARY_FLAVOR`, and taglines in `CITY_ROOMS` must be passed through FORBIDDEN regex as part of the test suite extension for Phase 8C |
| PRIVATE data regex (`/balance\|ledger\|inventory\|secret\|token\|economy\|payout\|owner\|player_id\|connection/i`) | `tests/arcade/city-district.test.mjs:18`, `city-district-events.spec.mjs:60` | Surfaces #3-#5 wire output (JSON.stringify of `activityItem()` and `buildDistrictEvent()` results) | Holds — new flavor strings contain no dynamic data; all interpolated values are from static `display_name` or closed-enum fields already on the allowlist |
| `validateInteractionZone()` FORBIDDEN_RE | `arcade/city/city-interactions.mjs:40-42, 68-107` | Surface #8 (Travel button tooltip), Surface #10 (activity_board prompt) | Must be verified: tooltip/aria-label copy and zone prompt strings must satisfy FORBIDDEN_RE at validation time. All proposed copy ("quietest approach", "pulse crossroads", "cross-corridor traffic") contains no forbidden terms — to be confirmed by running proposed strings through the regex before plan is implemented |
| `public_safe:true` presence on all broadcast payloads | `city-district-presence.mjs:86`, `city-district-activity.mjs:100-112`, `city-district-events.mjs:191-215` | No new broadcast payload proposed — all surfaces are client-local | Holds trivially — no new wire message |

---

### Falsifiable / How We Would Know It Is Wrong

**Surface #1-2 (taglines / landmark labels):** Wrong if `publicLayout()` output changes shape, or if a new `tagline` field is accidentally included in `blockPublicSummary()` projection without being added to a BLOCK_SUMMARY_FIELDS allowlist. Detection: `JSON.stringify(blockPublicSummary(...))` in the existing `city-district.test.mjs` private-data regex test would catch an unexpected field. Also: the correct landmark names for all six blocks are fixed in code (nexus-05 maglev is TRANSIT NEXUS; garden-06 maglev is GARDEN HALT) — any spec or test referencing other names fails immediately.

**Surface #3 (activity flavor):** Wrong if `labelFor()` flavor output exceeds 40 chars after the `safeName()` clamp on the block name — meaning a full-replacement flavor string was longer than 80 chars without being caught by the static lint assertion. Detection: extend `city-district-activity.test.mjs` with (a) a label-length assertion for all 6 blocks × all 13 activity types, and (b) a FORBIDDEN regex pass over all entries in `ACTIVITY_FLAVOR`.

**Surface #4-5 (event flavor):** Wrong if `eventSummary()` flavor prose exceeds 256 chars (surface #13 closes this), or if any flavor string contains a FORBIDDEN term. Detection: add a static-content lint step (or test assertion) that runs all entries in `BLOCK_EVENT_FLAVOR` and `BLOCK_EVENT_SUMMARY_FLAVOR` through the FORBIDDEN regex at test time.

**Surface #9 (minimap labels):** Wrong if Canvas `fillText()` calls cause text to overflow the 150×150px (or 104×104 mobile) canvas boundary. Detection: Playwright screenshot diff in `city-district-nexus-garden-routes.spec.mjs` (proposed smoke) at both desktop and phone-390 viewports.

**Surface #11 (trial context copy):** Wrong if `context_label` or any flavor field is added to `trialStatePayload()` instead of being looked up at render time in `city-scene.js`. Detection: `git diff main...feat/phase-8c -- arcade/city/city-battle-instance.mjs` must show no changes to `trialStatePayload()` or its returned object shape.

**Server-change assessment:** Wrong if any new `city_blocks` message field, new DO endpoint, new `wrangler.toml` env var, or new `SCHEMA_VERSION` bump is proposed or merged as part of Phase 8C content work. Detection: `git diff main...feat/phase-8c -- workers/` directory should show zero changes.

**Economy/reward boundary:** Wrong if any flavor string, tagline, zone label, or activity copy contains the words reward, earn, prize, bonus, grant, ticket, balance, ledger, inventory, cashout, or any FORBIDDEN_RE term. Detection: FORBIDDEN regex test assertions on all static flavor config objects, run as part of existing `city-district-activity.test.mjs` and `city-district-events.spec.mjs` suites.

---

## 6. Cross-Device Smoke Matrix Updates & Content Verification

### Scope and Hard Boundaries

This section covers additions to the existing Playwright smoke harness that verify the Phase 8C content depth changes are correct, public-safe, and render legibly across devices and blocks. No new Worker authority. No economy vocabulary. No CF-7 enablement. No production deploy. `LIVE_WORLD_LOADER_ENABLED` stays false. All proposed checks attach to **static config** or **client-derived display** surfaces only.

---

### Baseline Recap (What Already Exists)

The existing matrix, for reference:

| Spec file | Viewport(s) | Block(s) exercised | What it proves |
|---|---|---|---|
| `city-district-presence.spec.mjs` | desktop + phone-390 | downtown-01, harbor-02 | presence-push, 2-client delta, no ghosts |
| `city-district-events.spec.mjs` | desktop + phone-390 | harbor-02 | event banner, server snapshot, window crossing |
| `city-collision.spec.mjs` | phone-390 | downtown-01 only | walkability kernel loads, clamp works |
| `mobile-playtest.spec.mjs` | phone-360 | arcade main | tap targets, no overflow, reduced-motion |
| `remote-smoke.spec.mjs` | headless | protocol-level | admin both-gate, economy verb rejection, public-safe headers |

**Coverage gaps identified in grounding facts:** Nexus-05 and Garden-06 never exercised; cross-6-block collision not exhaustive; no 2-client route-transition across the cross-corridor; no label/flavor vocabulary guard run against live-rendered panel text; no host-rank display assertion; no interaction-receipt (Phase 7E) cross-viewport check.

---

### New Spec Files to Create

The following four spec files are the deliverables. Each one is described with enough precision that a developer can write it without ambiguity. All use the established pattern of the existing city specs — direct `page.evaluate(() => window.__neon_city.*)` calls — consistent with `city-district-presence.spec.mjs`, `city-district-events.spec.mjs`, and `city-collision.spec.mjs`. All use `BASE_URL`/`WS_URL` env, cached Playwright Chromium, and `?renderer=2d` query param where needed for headless rendering.

---

#### Spec 1: `city-district-block-identity.spec.mjs`

**Runner script:** `run-city-district-block-identity.sh` (same pattern as existing runners — sets `BASE_URL`, `WS_URL`, then invokes `playwright test --project city-district-block-identity`).

**Purpose:** Verify that every block's per-block identity surface (landmark labels, theme token, display_name, tagline/flavor copy if added by Phase 8C static config) renders correctly on each viewport, that no block defaults to downtown-01 labels, and that all rendered text passes the forbidden-vocabulary guard.

**Viewport matrix:**

| Viewport | Config |
|---|---|
| `desktop` | 1280×800, headless chromium |
| `phone-390` | 390×844, `isMobile:true`, `hasTouch:true`, `deviceScaleFactor:2` |
| `phone-360` | 360×640, `isMobile:true`, `hasTouch:true`, `deviceScaleFactor:2`, `reducedMotion:'reduce'` |

**Block matrix — all six blocks required:**

The six block `display_name` values from `CITY_ROOMS` (city-block.mjs:172-177) are: `Downtown Block`, `Harbor Block`, `Skyline Block`, `Foundry Block`, `Nexus Block`, `Garden Block`. The six theme tokens are: `neon-noir`, `tidal-cyan`, `sunset-violet`, `forge-ember`, `pulse-magenta`, `bloom-cyan`. All assertions below match against these exact values.

For each block (`downtown-01`, `harbor-02`, `skyline-03`, `foundry-04`, `nexus-05`, `garden-06`), on each viewport listed above, the spec asserts:

1. **Display name renders in district panel.** The `#cityDistrict` panel text contains the block's `display_name` from `CITY_ROOMS` (e.g., `/Downtown Block/i`, `/Harbor Block/i`, etc. — exact strings confirmed against city-block.mjs:172-177). The check uses `page.evaluate(() => document.getElementById('cityDistrict').textContent)` consistent with the pattern in `city-district-events.spec.mjs:42`.

2. **Theme token renders.** The district panel's current-block line (rendered by `renderDistrict()` in `city-scene.js:451-546`) contains the theme token for that block (e.g., `neon-noir`, `tidal-cyan`, `sunset-violet`, `forge-ember`, `pulse-magenta`, `bloom-cyan` — exact strings confirmed against city-block.mjs:172-177).

3. **Landmark labels are block-specific, not downtown defaults.** For blocks that have a `BLOCK_LABELS` entry (`city-block.mjs:137-143`), the rendered layout payload must include the per-block override. Specifically:
   - `harbor-02`: layout must contain `HARBOR CONTROL` (not `DATA SPIRE`).
   - `nexus-05`: must contain `NEXUS CORE`.
   - `garden-06`: must contain `BIODOME SPIRE`.
   - The check is: for each block, the landmark labels differ from the downtown-01 defaults. The test reads `BLOCK_LABELS` as the source of truth; if a block has no override entry, this assertion is skipped for that block.

4. **Top-bar subtitle contains block name.** The `.sub` element in the top bar (updated by `currentBlock()` in `city-scene.js:378-389`) must contain the lowercased block display name after connection (e.g., `downtown block`, `harbor block`, etc.). If Phase 8C adds a static tagline field to the subtitle, assert the tagline is present too — keyed to `CITY_ROOMS` static config, not server-derived.

5. **If Phase 8C adds `flavor_text` / `tagline` to `blockPublicSummary` or `CITY_ROOMS`:** Assert the rendered district panel contains the flavor text for the current block. Assert the flavor text for Nexus and Garden specifically contains at least one distinctive word (to confirm the blocks are not sharing copy). Do not assert economy vocabulary.

6. **No overflow on phone-360.** `document.documentElement.scrollWidth` must equal `document.documentElement.clientWidth`. The `#cityDistrict` panel must be within `clientWidth` bounds.

7. **Forbidden-vocabulary guard on all rendered panel text.** After the district panel has loaded (wait for `#cityDistrict` to be visible), extract the full `textContent` of `#cityDistrict` and assert it does NOT match:

   ```
   /\b(buy|sell|trade|rent|own|owner|ownership|profit|payout|wager|bet|loot|stake|staking|yield|crypto|token|nft|market|marketplace|landlord|tenant|income|cashout|jackpot|multiplier|boosted|reward|earn|prize|bonus|grant|redeem)\b/i
   ```

   This is the combined form of the FORBIDDEN_RE from `city-interactions.mjs:42` and the admin-gate economy-verb guard from `admin-gate-safety.test.mjs:60`, applied as a union content guard to live-rendered UI text. It catches any accidental economy copy that may have been introduced in flavor fields.

8. **Private-data guard on district JSON.** The spec intercepts the `city_blocks` WebSocket message via `page.evaluate` + message listener (consistent with the pattern in `city-district-events.spec.mjs`), and asserts the stringified payload does NOT match:

   ```
   /\b(balance|ledger|inventory|redemption|secret|player_id|connection|admin_token)\b/i
   ```

   This mirrors the private-data guard tested in `city-district.test.mjs:18`.

9. **`public_safe:true` present in district manifest.** The `blockPublicSummary` for each block in the `city_blocks` message must carry `public_safe:true`. No block summary may omit this field.

**Grants nothing economic / display-only note:** This spec only reads rendered text and WebSocket message contents. It performs no game action, sends no route request, and does not modify any server state. It is a passive observer of static config surfaces.

**Falsifiable / how we'd know it's wrong:** If any block renders downtown-01 labels instead of its own, assertion (3) fails. If flavor copy accidentally contains `reward` or `earn`, the forbidden-vocabulary guard (7) fails. If a new field carrying a player id leaks into `blockPublicSummary`, assertion (8) fails. If the top bar shows no block name, assertion (4) fails.

---

#### Spec 2: `city-district-nexus-garden-routes.spec.mjs`

**Runner script:** `run-city-district-nexus-garden-routes.sh`

**Purpose:** Exercise the two new Phase 8A adjacency paths that were previously untested: `downtown→garden`, `garden→nexus`, and `nexus→skyline`. Verify presence-push updates across these paths, that activity feed items use the correct block names, and that no forbidden vocabulary appears in feed items or event banners. This is the primary coverage for Garden-06 and Nexus-05 as live blocks.

**Viewport matrix:**

| Client | Viewport |
|---|---|
| Client A (anchor) | desktop 1280×800 |
| Client B (traveler) | phone-390 (390×844, `isMobile:true`, `hasTouch:true`) |

**Scenario — 5 steps:**

**Step 1: Establish baseline.** Client A connects to `downtown-01`. Client B connects to `garden-06`. Wait for both district panels to show respective `display_name`. Assert Client A's adjacent block list contains `Garden Block` (confirming Phase 8A adjacency `downtown↔garden` is live and manifest-derived — grounding fact: `city-district.mjs:42-49`). Assert Client B's adjacent block list contains `Downtown Block` and `Nexus Block` (confirming `garden↔downtown` and `garden↔nexus` both present).

**Step 2: Presence-push cross-path.** Client B is now on `garden-06`. Client A should see `garden-06` in its district manifest with `population >= 1`. Assert that Client A's `#cityDistrict` panel shows the Garden block (`Garden Block`) with a non-zero population indicator (the count that `renderDistrict()` renders as the `Xthere` label at `city-scene.js:511-527`). This proves `buildPresenceDelta()` + `broadcastDistrictPresence()` reach Client A for a non-adjacent block — the presence push is a full-district broadcast, not a hop-topology-scoped push. Uses `page.evaluate(() => window.__neon_city.district())` consistent with `city-district-presence.spec.mjs:43`.

**Step 3: Route Client B: garden→nexus.** Client B clicks the Travel button for `Nexus Block` in its district panel (the button is rendered by `renderDistrict()` and triggers `net.requestRoute('nexus-05')`, grounding fact: `city-scene.js:511-559`). Assert:
- Route status line on Client B shows a routing-in-progress indicator (e.g., text matching `/routing/i` or `/Nexus/i`) — transient, will clear on arrival.
- Client B reconnects and district panel shows `display_name` containing `Nexus Block` and theme = `pulse-magenta` (confirmed: city-block.mjs:176).
- Activity feed on Client B contains an item with label matching `/Nexus/i` and type `block_arrived` or `route_confirmed` (`labelFor` output, grounding fact: `city-district-activity.mjs:59-76`). Read via `page.evaluate(() => window.__neon_city.activity())`.
- `public_safe:true` on the activity item.

**Step 4: Route Client B: nexus→skyline.** Client B (now on nexus-05) routes to `skyline-03`. Assert same class of checks: `display_name` containing `Skyline Block`, theme = `sunset-violet` (confirmed: city-block.mjs:174), activity feed arrival label contains `Skyline`, public_safe present.

**Step 5: Non-adjacent route rejection.** From Client B's current position (skyline-03), instruct it to programmatically request a route to `harbor-02` (which is adjacent to skyline) and separately to `downtown-01` (which is NOT adjacent to skyline in the Phase 8A graph — grounding fact: skyline adjacency is `harbor-02, foundry-04, nexus-05` per `city-district.mjs:45`). Wait for route result. Assert:
- `harbor-02` route: accepted (or this assertion confirms adjacency is wired).
- `downtown-01` route from skyline: rejected with reason `not_adjacent`. The route status line must display a rejection indication (grounding fact: `validateRouteRequest` returns `{ok:false, reason:'not_adjacent'}`, surfaced in `city-scene.js` route-status area). No crash, no reconnect to downtown, Client B remains on skyline.

**At every step:** Extract `textContent` of the activity feed (via `window.__neon_city.activity()`) and assert it does NOT match the forbidden-vocabulary regex from Spec 1. Assert all activity items carry `public_safe:true`. Assert no `player_id`, `balance`, `ledger`, or `connection` field in any delta payload.

**Flavor check (if Phase 8C adds `eventSummary` flavor for Garden / Nexus):** After Client B arrives on garden-06, if the district event card is visible, assert the event summary text contains copy specific to Garden's identity (e.g., containing `Garden` or the garden-specific flavor word — exact strings TBD from Phase 8C static config additions). Assert the event summary does NOT exceed 256 characters (grounding fact: proposed bound for `eventSummary()`, `city-district-events.mjs:174-184`). Assert it does not match the forbidden-vocabulary regex. Read via `page.evaluate(() => window.__neon_city.districtEvent())` consistent with `city-district-events.spec.mjs:41`.

**Grants nothing economic / display-only note:** The Travel button triggers `net.requestRoute()` which is a routing-only server request with no economy, inventory, or ledger coupling. Route confirmation produces an ephemeral receipt (`city-interaction-receipts.mjs:49-94`, `public_safe:true`, no persistence). No Host Rank change, no trial, no stewardship edit occurs in this spec.

**Falsifiable / how we'd know it's wrong:** If `downtown→garden` adjacency is not wired in the manifest, Step 1 adjacent list assertion fails. If presence-push does not reach Client A for Garden-06's population, Step 2 fails. If the non-adjacent rejection does not fire, Step 5 fails — meaning the server's `validateRouteRequest` is not enforcing the Phase 8A adjacency graph. If any activity label contains economy vocabulary, the guard fires.

---

#### Spec 3: `city-district-objectives-display.spec.mjs`

**Purpose:** Verify that non-reward objective displays (Block Trial panel, Host Rank eligibility line, interaction zone prompts for `district_event` and `activity_board` kinds) render correctly on desktop and phone, that their copy contains no reward/economy vocabulary, and that the Block Trial outcome display is ephemeral and grants nothing persistent.

**Viewport matrix:**

| Viewport | Config |
|---|---|
| desktop | 1280×800, headless |
| phone-390 | 390×844, `isMobile:true`, `hasTouch:true`, `deviceScaleFactor:2` |

**Block:** `downtown-01` for this spec (trial kernel is block-scoped; Phase 8C content does not change trial mechanics, only the surrounding flavor context). Extend to a second run on `nexus-05` if the Phase 8C plan adds nexus-specific objective flavor copy.

**Checks:**

1. **Block Trial panel renders (if trial is active or startable).** The `.city-block-trial` panel (CSS: `city.css:232`; DOM element ID: `cityBlockTrial`, `city-scene.js:60`) must be visible on both viewports. Its `textContent` must contain `BLOCK TRIAL` (grounding fact: `city-scene.js:687`). Must contain `signal_grid_trial` objective label or equivalent rendered label. Must contain score display (e.g., `0 / 3` or `X/3`). Must NOT contain `reward`, `earn`, `prize`, `bonus`, `grant`, `payout`, `cash`, `token`, `NFT`, `ticket`, `inventory`, `unlock`, `progression`, or any term matching the forbidden-vocabulary regex.

2. **Block Trial outcome is ephemeral — no account ledger entry.** If a trial completes during the test (timeout path: 60 seconds — do not wait; instead use a short-circuit: if a trial is already in `closed` or `completed` state in the panel, read its outcome text), assert the outcome text (e.g., `stabilized`, `timeout`, `closed`) does NOT imply a persistent grant. Specifically: no `+XP`, no `+tickets`, no `you earned`, no `reward granted` text. Assert `public_safe:true` on the trial event payload received via `window.__neon_city.trial()` (`city_block_trial_*` event types, grounding fact: `city-battle-instance.mjs:56-74`).

3. **Host Rank eligibility line renders, is non-cash.** The stewardship editor panel (`.city-stewardship` CSS class, `city-scene.js:59` element ID `cityStewardship`, `city-scene.js:600-635`) eligibility line must be visible. It must contain one of: `observer`, `helper`, `signaler`, `anchor` (grounding fact: `city-host-rank.mjs:34-40`). It must NOT contain any of: `cash`, `pay`, `earn`, `reward`, `balance`, `XP`, `token`, `transfer`, `sell`, `buy`, `own`. The panel's `textContent` must pass the forbidden-vocabulary regex.

4. **Interaction zone prompts for `district_event` and `activity_board` kinds.** If Phase 8C adds explicit interaction zone affordances for these kinds (grounding fact: `city-interactions.mjs:20-26` — these kinds already exist in `INTERACTION_KINDS`), assert:
   - The zone `label` field (max 48 chars, grounding fact: `city-interactions.mjs:68-107`) is visible in the UI when the player is in the zone.
   - The zone `prompt` field (max 64 chars) is visible.
   - Both label and prompt pass `validateInteractionZone()` — which means they also pass `FORBIDDEN_RE` by construction. The spec asserts this by checking the rendered text against the same union regex.
   - If no new zone affordances are added in Phase 8C (i.e., these kinds remain panel-only), this check is skipped with a comment: "Phase 8C did not add new zone shapes for district_event/activity_board kinds — no new zone UI to assert."

5. **No horizontal overflow on phone-390.** The `.city-block-trial` and `.city-stewardship` panels must not cause `scrollWidth > clientWidth`. On phone, panels must fit in the `.hud-right` flex container or the mobile left-rail tray (grounding fact: `city.css:154-206`, `city.css:262-305`).

6. **Reduced-motion on phone-360.** If the trial panel has any animation (e.g., blinking node indicator), with `reducedMotion:'reduce'` it must not produce a CSS animation that violates `prefers-reduced-motion: reduce`. This is a passive check: assert no `animation` inline style is present on `.city-block-trial` child elements when the reduced-motion media query is active.

**Grants nothing economic / display-only note:** Block Trial outcome is display-only and ephemeral (grounding fact: `city-battle-instance.mjs:56-74`; no ledger, no persistence). Host Rank is non-cumulative, 60-second decay, non-cash (grounding fact: `city-host-rank.mjs:1-18`). Interaction zone receipts are ephemeral, public-safe, no ledger coupling (grounding fact: `city-interaction-receipts.mjs:1-100`).

**Falsifiable / how we'd know it's wrong:** If Block Trial panel shows `+reward` or `earned X tickets`, assertion (2) fails — meaning forbidden copy was added to trial outcome rendering. If Host Rank line shows `cash value`, assertion (3) fails. If any panel overflows on phone-390, assertion (5) fails. If `public_safe:true` is absent on a trial state, assertion (2) fails.

---

#### Spec 4: `city-district-content-flavor-guard.spec.mjs`

**Purpose:** A dedicated vocabulary-guard spec that exercises the flavor content hooks (`labelFor`, `eventLabel`, `eventSummary`, top-bar subtitle, landmark labels) on all six blocks and asserts that every user-visible string produced by Phase 8C content additions is public-safe, economy-free, and within prescribed length bounds. This is a content regression gate, not a functional test.

**Viewport:** desktop only (1280×800). This is a content correctness check; layout is covered by Specs 1-3.

**Approach:** For each of the six blocks, the spec connects to `/arcade/city/index.html?city_id=<block>&renderer=2d` and collects rendered text from:

- `#cityDistrict` (district panel — includes display_name, theme, event card label, event card summary, activity feed items, adjacent block names)
- `.top-bar .sub` (subtitle — includes block name, and any Phase 8C tagline)
- `.city-log` (world event log — left panel, server-authored event labels from `city-scene.js:297-324`)
- `.city-stewardship` (stewardship panel — eligibility and status text; CSS class from `city.css:209`)
- `.city-block-trial` (trial panel — objective and status text; CSS class from `city.css:232`)

All text is read via `page.evaluate(() => element.textContent)`. No `wsRoundtrip` — city specs use direct `window.__neon_city.*` evaluate calls consistent with existing city spec patterns.

**Checks applied to every collected string from every block:**

1. **FORBIDDEN_RE union guard (economy/reward).** The combined guard — a union of the zone `FORBIDDEN_RE` from `city-interactions.mjs:42` and the admin-gate economy-verb guard from `admin-gate-safety.test.mjs:60`:

   ```
   /\b(shop|store|market(place)?|buy|sell|sale|rent|rental|own(er|ed|ership)?|landlord|tenant|wager|bet|gambl\w*|jackpot|loot|raid|steal|theft|cash[-\s]?out|payout|payment|withdraw|profit|income|earn|price|cost|coin|crypto|token|nft|stake|staking|yield|trade|trading|multiplier|boost|bonus|prize|reward|weapon|gun|police|wanted|crime|ticket|balance|ledger|inventory|grant|award|redeem|challenge|cosmetic)\b/i
   ```

   This is a **union guard** — not a single existing constant — combining the zone validator's forbidden vocabulary and the admin-gate economy-verb filter, applied as a content regression gate. Applied to `textContent` of each panel, per block. Any match is a test failure with the matching word and block name reported.

2. **PRIVATE_DATA_RE (identity leak).** Applied to the JSON stringification of every WebSocket message received during the session:

   ```
   /\b(player_id|playerId|connection|socket|balance|ledger|inventory|secret|account|admin_token)\b/i
   ```

3. **Label length bounds.** For each activity item received via `window.__neon_city.activity()`:
   - `label` field length must be ≤ 40 characters after any trimming (grounding fact: `safeName()` in `city-district-activity.mjs:53-56`).
   - `severity` must be one of `info`, `good`, `warn`.
   - Note: `ACTIVITY_UI_MAX=8` is a local rendering constant in `city-scene.js:102` (not exported, not a wire constraint). The wire buffer bound is the exported `ACTIVITY_FEED_MAX=16`. The display slice of 8 is a rendering implementation detail and is not asserted here.

   For each district event object obtained via `window.__neon_city.districtEvent()`:
   - `label` field length ≤ 40 characters (grounding fact: `shortBlockName()` in `city-district-events.mjs:116-120`).
   - `summary` field length ≤ 256 characters (proposed bound; if Phase 8C enforces this in `eventSummary()`, assert it here; if not yet enforced, flag as a finding rather than failing the build).

4. **`public_safe:true` on all wire objects.** Every WebSocket message carrying `kind: district_activity`, `kind: district_presence_delta`, or a district event object must have `public_safe: true`. Messages without this field are flagged.

5. **Block-specific flavor distinctiveness (Garden and Nexus must differ from Downtown).** If Phase 8C adds flavor copy to `CITY_ROOMS` or `blockPublicSummary`, the spec asserts that the rendered text for `nexus-05` is not identical to `downtown-01` and that `garden-06` is not identical to `downtown-01`. This is the minimal anti-default check: it catches the case where a new flavor field was added but not populated for the new blocks (falling through to a downtown default).

6. **Event summary per-block (Garden and Nexus focus windows).** For the `district_block_focus` event type, the spec drives the city event window to a nexus or garden focus using `window.__neon_city.pollDistrictEvents(nowMs)` with a computed window-aligned timestamp (grounding fact: `city-scene.js:861` — `pollDistrictEvents(nowMs)` accepts an explicit time argument for deterministic testing; this is a client-side clock injection, not a server message). Compute `nowMs` such that `Math.floor(nowMs / WINDOW_MS) % CITY_IDS.length` lands on nexus-05's index in `CITY_IDS` (from `city-block.mjs:179`), then separately on garden-06's index. Assert:
   - `eventSummary()` output contains the block's `display_name` (e.g., `Nexus` or `Garden`), not `Downtown`.
   - Output does not match the union forbidden-vocabulary regex.
   - Output length ≤ 256 chars.
   - Note: `__test_set_event_now` is scoped to the arcade `ArcadeRoom` DO (`arcade-room.ts:342`) and is not available in the city path. The city client-side `pollDistrictEvents(nowMs)` is the correct mechanism for advancing the district event clock in tests.

**Grants nothing economic / display-only note:** This spec is entirely passive — it reads rendered text and WebSocket payloads, and injects a display-only client-side clock value. It sends no user actions and modifies no server state.

**Falsifiable / how we'd know it's wrong:** If any Phase 8C flavor copy introduces an economic term (e.g., a developer writes `"visit Nexus to earn bonus points"` in a tagline), assertion (1) fails on the Nexus block with the word `earn` reported. If a `blockPublicSummary` field inadvertently carries a `player_id`, assertion (2) fails. If Garden and Nexus still show downtown copy, assertion (5) fails — meaning the static config was not populated.

---

### Updated Existing Specs

These changes extend already-written specs without rewriting them:

#### `city-collision.spec.mjs` — add blocks 4, 5, 6

**Current state:** Only `downtown-01` and `foundry-04` safe-arrival points are tested (grounding fact: `city-collision.spec.mjs:63-64` — `downtownArrival` and `foundryArrival` are already in the spec).

**Addition:** Extend the existing `__cc` script-tag payload to include:
- `nexus-05`: assert `safeArrivalPoint('nexus-05')` returns a walkable coordinate; assert `isPointWalkable(200, 200, 'nexus-05')` returns false (building center blocked — geometry is shared, building positions are identical to downtown as confirmed by `city-block.mjs:150-155`).
- `garden-06`: same assertions for building center rejection + safe spawn walkable.

All geometry is byte-identical across blocks (grounding fact: `city-block.mjs:150-155` — geometry cloned, only labels overlaid). The check confirms the block-specific `publicLayout(cityId)` call does not accidentally alter geometry — i.e., the cloned geometry still produces walkable spawn and blocked buildings at the same absolute positions. If Phase 8C adds no geometry changes, all assertions should pass trivially, and that triviality is itself the proof of non-regression.

#### `city-district-events.spec.mjs` — extend to nexus-05 and garden-06 focus windows

**Addition:** After the existing harbor-02 window tests, add a pass for `nexus-05` and `garden-06` as the focus block for a `district_block_focus` event. Drive the client-side event window by calling `window.__neon_city.pollDistrictEvents(nowMs)` with a computed window-aligned timestamp (as described in Spec 4, check 6). Do NOT use `__test_set_event_now` — that message is scoped to the arcade `ArcadeRoom` DO and is not available in the city path. Assert:
- Event label contains `Nexus Block` or `Garden Block` respectively (matching the full `display_name`).
- Event summary contains the block name and does not match the union forbidden-vocabulary regex.
- Summary length ≤ 256 chars.
- Activity feed produces a `district_event_active` item with label containing the block name.
- `public_safe:true` on the event object.

---

### Matrix Summary Table

The following table consolidates every new or updated check, showing which spec file it lives in, the viewport(s), and the block(s) covered.

| Check ID | Spec file | Viewport(s) | Block(s) | What it asserts | Authority / wire change? |
|---|---|---|---|---|---|
| B-ID-01 | `city-district-block-identity.spec.mjs` | desktop, phone-390, phone-360 | all 6 | display_name (full, e.g. 'Downtown Block') and theme render in district panel | None — reads static config |
| B-ID-02 | `city-district-block-identity.spec.mjs` | desktop, phone-390, phone-360 | all 6 with BLOCK_LABELS entry | landmark labels are block-specific, not downtown defaults | None — reads publicLayout payload |
| B-ID-03 | `city-district-block-identity.spec.mjs` | desktop, phone-390, phone-360 | all 6 | top-bar subtitle contains block name | None — reads rendered DOM |
| B-ID-04 | `city-district-block-identity.spec.mjs` | phone-360 | all 6 | no horizontal overflow on smallest viewport | None — layout assertion |
| B-ID-05 | `city-district-block-identity.spec.mjs` | desktop, phone-390, phone-360 | all 6 | union forbidden-vocabulary regex passes on full district panel text | None — text check |
| B-ID-06 | `city-district-block-identity.spec.mjs` | desktop | all 6 | private-data regex passes on city_blocks WS message | None — passive intercept |
| B-ID-07 | `city-district-block-identity.spec.mjs` | desktop | all 6 | public_safe:true on every blockPublicSummary | None — passive intercept |
| B-ID-08 | `city-district-block-identity.spec.mjs` | desktop | all 6 | flavor_text / tagline (if added) renders and is block-distinct | None — reads static config field |
| RT-01 | `city-district-nexus-garden-routes.spec.mjs` | desktop (A), phone-390 (B) | downtown-01, garden-06 | Client A sees garden-06 in manifest; adjacent list includes 'Garden Block' | None — reads manifest |
| RT-02 | `city-district-nexus-garden-routes.spec.mjs` | desktop (A), phone-390 (B) | downtown-01, garden-06 | Client A receives presence-push for garden-06 population (full-district broadcast) | None — reads presence delta |
| RT-03 | `city-district-nexus-garden-routes.spec.mjs` | phone-390 | garden-06, nexus-05 | garden→nexus route accepted; arrival activity item correct | No new authority — reuses existing route validation |
| RT-04 | `city-district-nexus-garden-routes.spec.mjs` | phone-390 | nexus-05, skyline-03 | nexus→skyline route accepted; arrival correct | Same as RT-03 |
| RT-05 | `city-district-nexus-garden-routes.spec.mjs` | phone-390 | skyline-03 | skyline→downtown route rejected (not_adjacent) | None — validates server-side adjacency enforcement |
| RT-06 | `city-district-nexus-garden-routes.spec.mjs` | phone-390 | garden-06, nexus-05, skyline-03 | union forbidden-vocabulary regex passes on all activity feed items along route | None — text check |
| RT-07 | `city-district-nexus-garden-routes.spec.mjs` | phone-390 | garden-06 | event summary for garden-06 focus ≤ 256 chars, contains 'Garden', passes forbidden guard | None — reads static derived summary |
| OBJ-01 | `city-district-objectives-display.spec.mjs` | desktop, phone-390 | downtown-01 | .city-block-trial panel visible, union forbidden-vocabulary passes | None — reads rendered DOM |
| OBJ-02 | `city-district-objectives-display.spec.mjs` | desktop, phone-390 | downtown-01 | Trial outcome text contains no grant/reward/earn/+XP/tickets copy | None — text check |
| OBJ-03 | `city-district-objectives-display.spec.mjs` | desktop, phone-390 | downtown-01 | Trial state carries public_safe:true (via window.__neon_city.trial()) | None — evaluate call |
| OBJ-04 | `city-district-objectives-display.spec.mjs` | desktop, phone-390 | downtown-01 | Host Rank eligibility line shows tier, no cash vocabulary | None — reads rendered DOM |
| OBJ-05 | `city-district-objectives-display.spec.mjs` | phone-360 | downtown-01 | No overflow; reduced-motion: no animation violation on .city-block-trial panel | None — layout + CSS assertion |
| OBJ-06 | `city-district-objectives-display.spec.mjs` | desktop, phone-390 | nexus-05 (if Phase 8C adds nexus objective flavor) | Same checks as OBJ-01 through OBJ-04, nexus-specific copy | None — reads static config |
| FG-01 | `city-district-content-flavor-guard.spec.mjs` | desktop | all 6 | Union FORBIDDEN_RE passes on all panels (#cityDistrict, .top-bar .sub, .city-log, .city-stewardship, .city-block-trial) | None — text check |
| FG-02 | `city-district-content-flavor-guard.spec.mjs` | desktop | all 6 | PRIVATE_DATA_RE passes on all WS payloads | None — passive intercept |
| FG-03 | `city-district-content-flavor-guard.spec.mjs` | desktop | all 6 | Activity item label ≤ 40 chars; severity in {info, good, warn}. ACTIVITY_UI_MAX=8 is a rendering detail only — not asserted as a wire bound. | None — wire payload check |
| FG-04 | `city-district-content-flavor-guard.spec.mjs` | desktop | all 6 | Event label ≤ 40 chars; event summary ≤ 256 chars | None — wire payload check |
| FG-05 | `city-district-content-flavor-guard.spec.mjs` | desktop | all 6 | public_safe:true on all district_activity and district event objects | None — passive intercept |
| FG-06 | `city-district-content-flavor-guard.spec.mjs` | desktop | nexus-05, garden-06 | Flavor copy is block-distinct (not identical to downtown-01) | None — distinctiveness check |
| FG-07 | `city-district-content-flavor-guard.spec.mjs` | desktop | nexus-05, garden-06 | district_block_focus event summary contains block name, ≤ 256 chars [uses window.__neon_city.pollDistrictEvents(nowMs) for clock injection — NOT __test_set_event_now which is arcade-room-only] | None — reads static derived summary |
| COL-EXT-01 | `city-collision.spec.mjs` (extended) | phone-390 | nexus-05, garden-06 | Safe spawn walkable; building center blocked; geometry byte-identical to downtown | None — reads collision kernel |
| EVT-EXT-01 | `city-district-events.spec.mjs` (extended) | desktop | nexus-05, garden-06 | Focus window event label/summary correct per block, forbidden guard passes [uses pollDistrictEvents(nowMs)] | None — reads static derived event |

---

### Forbidden-Vocabulary Guard: Formal Definition

The following combined regex is the canonical union guard applied in every spec listed above. It is the **union** of the FORBIDDEN_RE from `city-interactions.mjs:42` (zone validator) and the admin-gate economy-verb guard from `admin-gate-safety.test.mjs:60`, applied as a content regression gate to all user-visible text. It is not a single existing constant — it must be defined as a local `UNION_FORBIDDEN` in each spec file:

```
/\b(shop|store|market(place)?|buy|sell|sale|rent|rental|own(er|ed|ership)?|landlord|tenant|wager|bet|gambl\w*|jackpot|loot|raid|steal|theft|cash[-\s]?out|payout|payment|withdraw|profit|income|earn|price|cost|coin|crypto|token|nft|stake|staking|yield|trade|trading|multiplier|boost|bonus|prize|reward|weapon|gun|police|wanted|crime|ticket|balance|ledger|inventory|grant|award|redeem|challenge|cosmetic)\b/i
```

Every spec extracts `textContent` from every panel element and asserts no match. Any match is reported as: `[FORBIDDEN VOCABULARY] word "<matched>" found in panel "<element selector>" on block "<city_id>" at viewport "<viewport>"`. This makes failures actionable: the developer can locate the offending copy from the report alone.

This guard is applied **before** each spec's layout and behavior assertions, so a vocabulary failure is reported independently of any rendering issue.

---

### Corridor Readability Legibility Checks

In addition to the spec-level assertions, the following legibility checks are embedded in Spec 1 (Block Identity) and Spec 2 (Nexus/Garden Routes):

1. **Adjacent block names visible without scroll on desktop.** The `#cityDistrict` panel on desktop (200px wide, `top:336px`, grounding fact: `city.css:156`) must render all adjacent block Travel buttons without requiring vertical scroll within the panel. For a block with 3 adjacent neighbors (downtown-01 has 3: harbor, foundry, garden), assert all three Travel button labels are within the panel's visible area.

2. **Adjacent block names legible on phone-360.** On phone-360, the district panel reflows to a left-rail tray (`city.css:262-305`). Assert that Travel buttons are present, have height ≥ 40px (tap target requirement, grounding fact: `mobile-playtest.spec.mjs:19-99`), and carry accessible names (`aria-label` or button text matching the block `display_name`).

3. **Cross-corridor route path is readable.** After Client B routes `garden→nexus→skyline` in Spec 2, assert that the activity feed shows items for each hop (route_confirmed + block_arrived for each transition). The sequence of items must contain `Garden`, `Nexus`, `Skyline` in that order when read newest-first-reversed. This verifies the feed communicates the traversal path legibly.

4. **Event card does not obscure Travel buttons on phone-390.** On phone-390, if the event card is visible in the district panel, assert that at least one Travel button is also visible and not z-index occluded. This guards against a layout regression where the event card expansion covers the travel affordances.

---

### Not Proposed (Hard Exclusions Restated)

The following were considered and explicitly excluded:

- No new Worker or DO message type is needed. All checks read existing wire payloads passively.
- No schema version bump is proposed here. If Phase 8C adds flavor fields to `blockPublicSummary`, that bump belongs in the content implementation plan, not here.
- No `LIVE_WORLD_LOADER_ENABLED` flag change. None of these checks require or test live package loading.
- No 8B partial-manifest or CF-7 surface is referenced. The smoke matrix covers the static 6-block topology only.
- No production deploy. All checks target `BASE_URL`/`WS_URL` env-configurable endpoints — local dev or staging, never hard-coded production URLs.
- No economy surface is tested positively (i.e., no check asserts that a reward exists). All economy-adjacent checks are negative assertions (vocabulary guards, field absence checks).
- `__test_set_event_now` is NOT used in any city spec. That message is scoped to `ArcadeRoom` (arcade-room.ts:342). City district event window injection uses `window.__neon_city.pollDistrictEvents(nowMs)` (city-scene.js:861).

---

## 7. Open Items & Build-Time Confirmations

Plan-only. The content surfaces above are grounded in the real code, but a handful of exact strings, mappings, and guards must be **confirmed against the source at implementation time** rather than trusted from this plan. None of these are boundary questions (the adversarial critic found **zero** exclusion violations and **zero** unjustified authority changes); they are accuracy/consistency items so 8C ships copy that matches behavior.

| # | Item | What to confirm at build (display-only; no authority/economy change) |
|---|------|----------------------------------------------------------------------|
| O-1 | **downtown-01 has no `BLOCK_LABELS` entry** | downtown falls through to the geometry-default landmark labels (`DATA SPIRE` / `RAMEN 24/7` / `MAG-LEV STATION`, `city-block.mjs`). 8C either adds a downtown `BLOCK_LABELS` entry for parity with the other five, or treats those defaults as downtown's canonical identity — decide explicitly so the per-block identity table is complete and the smoke can assert it. |
| O-2 | **Minimap theme→hex for the four non-primary themes** | `city.css` defines only `--cy`/`--mg`/`--am` (cyan/magenta/amber); the themes `sunset-violet`, `forge-ember`, `pulse-magenta`, `bloom-cyan` have no CSS custom property. The minimap district-graph inset (Polish 4) must map each block to a hex drawn from the **closed** `PALETTE_HEX` allowlist (cyan/magenta/amber/white) — confirm the per-block mapping; introduce no free-form color. |
| O-3 | **Event-type → flavor semantic mapping** | `eventSummary()` already assigns semantics per type (e.g. `district_signal_surge` / `district_block_focus`). Confirm each per-block flavor line attaches to the event type whose *meaning* it matches, so copy does not contradict behavior (`city-district-events.mjs`). |
| O-4 | **Activity bound used in assertions** | Assert against the correct constant: `ACTIVITY_FEED_MAX = 16` is the buffer bound; `ACTIVITY_UI_MAX = 8` is a client display cap, not a wire/exported API constraint. Smoke checks must not treat `ACTIVITY_UI_MAX` as a wire bound. |
| O-5 | **Trial context copy is render-time client lookup only** | The per-block Block Trial flavor (Surface #11) must be a client-side render-time label lookup — `trialStatePayload()` and the DO stay byte-unchanged. Falsifier: `git diff` shows no change to `city-battle-instance.mjs` payload shape / no new wire field. |
| O-6 | **OBJ-5 "Cross-Corridor Run" is session-local** | Derived purely from existing `route_confirmed` / `block_arrived` activity items in the client session; confirm it persists nothing and records no server state (acknowledge-only, no reward). |
| O-7 | **Public-safe vocabulary guard alignment** | The forbidden-vocabulary regex differs slightly between `city-district-activity.test.mjs` and the zone validator `FORBIDDEN_RE`. Align the guard used to check all new flavor copy so every new string is screened by one canonical economic/private-data filter. |
| O-8 | **Exact label strings** | Confirm new/edited landmark + flavor strings against `city-block.mjs` `BLOCK_LABELS` verbatim (e.g. nexus-05 maglev is `TRANSIT NEXUS`, garden-06 maglev is `GARDEN HALT`) so the plan's examples match shipped copy. |

These are implementation-time confirmations; none changes the boundary, the authority model, or the static-config default.

---

## 8. Non-Goals, Sequencing & the Next Fork

### Hard Exclusions

The following are **permanently out of scope for Phase 8C** and must not appear even as "future consideration" notes within this phase's plan, ADR, or any config comment:

**Economic surface, full stop.**
No economy, ownership, rent, paid hosting, accounts, marketplace, rewards, payouts, tokens, NFTs, transfer, or cash-out of any kind. This prohibition applies to every layer: `CITY_ROOMS` static config fields, `blockPublicSummary()` output, activity feed labels (`labelFor()` in `city-district-activity.mjs:59-76`), event summaries (`eventSummary()` in `city-district-events.mjs:174-184`), zone prompts validated by `validateInteractionZone()` in `city-interactions.mjs:68-107`, Block Trial outcome payloads from `city-battle-instance.mjs`, and Host Rank tier labels from `city-host-rank.mjs`. The FORBIDDEN vocabulary regex (`/\b(buy|sell|trade|rent|own|owner|ownership|profit|payout|wager|bet|loot|stake|staking|yield|crypto|token|nft|market|marketplace|landlord|tenant|income|cashout|jackpot|multiplier|boosted)\b/i`) and the admin gate economy verb guard (`/ticket|prize|reward|balance|ledger|grant|award|payout|credit|redeem|challenge|cosmetic|inventory|cashout|withdraw/i`) both apply to every string this phase introduces. Any proposed copy that would fail these regexes is rejected before implementation, not after.

Host Rank is **non-cash and non-cumulative**. Its tier signal (observer/helper/signaler/anchor) is a current block signal derived from a 60-second window in `city-host-rank.mjs:22-77`, bounded at score_cap 100, and decays naturally. Phase 8C does not convert tier to XP, unlock tokens, gate permanent content, or attach any persistent account record. Block Trial outcomes (`city-battle-instance.mjs`) are ephemeral and discarded on close; no ledger, no progression store, no reward shape.

**Creator Foundation CF-7 and live loader.**
`LIVE_WORLD_LOADER_ENABLED` stays `false`. The constant is defined in `arcade/creator/approval/approved-loader.mjs:31` and imported as the single gate by the CF-7 live loader module `arcade/creator/approval/live-loader.mjs`. Neither that constant nor any path through `live-loader.mjs` is touched in this phase. The CF-3 layered validator (`arcade/creator/validator/validate-block-layered-package.mjs`) and the approval receipt system (`arcade/creator/approval/approval-receipt.mjs`) are also untouched. Phase 8C content depth operates entirely on static config and client-derived display. No `arcade/creator/**` path is invoked.

**Production deploy.**
No wrangler deploy, no staging deploy, no migration, no route change, no DO alarm registration, no new Durable Object field. All verification in this phase is local smoke + existing CI.

**Worker/DO authority change.**
No new server message type, no new DO field, no new migration, no new protocol field added to the wire. If any specific flavor or label text requires a server-published config extension (e.g. a `flavor` block in `districtEventSnapshot()` analogous to the Phase 6B `DISTRICT_EVENT_WINDOW_MS` pattern), that is Option B (noted as future-only in the activity/events grounding facts) and is explicitly deferred beyond 8C. Phase 8C uses Option A only: pure static config derivation through existing pure functions. No server change is strictly necessary because `labelFor()`, `eventLabel()`, `eventSummary()`, and `blockName()` all accept static inputs and `CITY_ROOMS` in `city-block.mjs:171-178` is the established extension point for per-block config fields.

**HiveWorld.**
The HiveWorld simulator (`arcade/hiveworld-sim/**`, `tests/hiveworld/**`) is untouched. It mirrors product phases but does not drive them. No HiveWorld mirror for 8C is planned or needed.

**Phase 8B (partial manifest / more blocks).**
Adding a seventh block or a partial-manifest system is not part of 8C. The six-block topology from Phase 8A (`CITY_ROOMS` downtown-01 through garden-06, `ADJACENCY` graph in `city-district.mjs:42-49`) is frozen static config for this phase.

---

### Why Content Depth Comes First

Phase 8A proved **structural scale**: the six-block district exists, routes validate, adjacency is non-linear, and the cross-path (downtown→garden→nexus→skyline alongside the original downtown→harbor→skyline→foundry ring) passes smoke tests. The topology is functional.

What Phase 8A did not prove is that **Garden, Nexus, and the new corridor feel like places worth moving through**. Currently:

- `nexus-05` (pulse-magenta) has the `NEXUS CORE` data-spire landmark label (`BLOCK_LABELS` in `city-block.mjs:141`) and a default stewardship palette, but the district panel shows only its display_name and population count. There is no block-specific "why go here" copy anywhere in `renderDistrict()` (`city-scene.js:451-546`).
- `garden-06` (bloom-cyan) has `BIODOME SPIRE` as its data-spire landmark and `GREENHOUSE GRILL` as its ramen shop (`BLOCK_LABELS` in `city-block.mjs:142`), but the event card's `eventSummary()` returns the same template prose for all six blocks with only the display name interpolated.
- The new route corridor (downtown↔garden and garden↔nexus and nexus↔skyline) appears in the Travel button list for adjacent blocks, but the travel button row shows only `display_name` and a population label — no reason to prefer the garden→nexus path over the foundry→skyline path.
- District events (`city-district-events.mjs`) rotate focus blocks deterministically through all six `CITY_IDS`, meaning Nexus and Garden already receive event windows. But `eventSummary()` for a `district_block_focus` event on `nexus-05` currently returns `'Nexus is the spotlight block this window.'` — the same-shape string as for `downtown-01`, defeating the purpose of per-block identity. (Note: the `district_signal_surge` type produces a different summary, `'is the focus block for this district window.'`; these two event types map to distinct `eventSummary()` cases at `city-district-events.mjs:177` and `181` respectively, and both are candidates for per-block flavor.)

The core deficit is that the display layer treats all six blocks as structurally identical, even though the static config (`CITY_ROOMS` themes, `BLOCK_LABELS` per-building names, `BLOCK_DEFAULT_STYLES` palettes in `city-stewardship.mjs:78-105`) already contains the differentiation signal needed to generate distinct copy.

**8C addresses this before 8B because block count has no value if existing blocks have no identity.** Adding more blocks (8B, which would require partial-manifest infrastructure and new smoke coverage across a larger ADJACENCY graph) without first making the six-block set feel distinct would compound the problem. A seven-block city where all blocks feel interchangeable is strictly worse than a six-block city where each block has a readable reason to visit.

**8C addresses this before CF-7 staging because CF-7 enables package-backed, live-loaded districts — content authored outside the kernel.** That capability is only meaningful if players already have a reason to explore the districts the kernel itself provides. Staging CF-7 before the base district has flavor is a sequencing error: it introduces external content complexity before the native six-block experience is defensible. CF-7 staging belongs after 8C demonstrates that static config + client derivation can deliver content depth without a live loader.

---

### What 8C Is Proving

Phase 8C has one falsifiable claim: **the six-block city's existing kernel systems (static config, activity feed, district events, interaction zones, Host Rank eligibility, Block Trial) are sufficient to make each block feel distinct and worth visiting, without any economy, authority change, or external content.**

Falsifiable / how we would know it is wrong:

- If the only way to differentiate Nexus from Garden in the district panel is to add a new server-published field or a new message type, Option A fails and Option B (server config snapshot extension, already documented as a future path) must be activated — but this would be logged as a sequencing finding, not a reason to abandon the static approach before attempting it.
- If the FORBIDDEN regex fires on any copy written for Garden, Nexus, or any other block, that copy is wrong, not the regex.
- If adding per-block flavor text to `CITY_ROOMS` (as new optional fields alongside the existing `city_id`, `display_name`, `capacity`, `theme`) requires a `blockPublicSummary()` allowlist change to reach the client, that change would constitute a protocol field addition and must be evaluated against the no-Worker-authority-change constraint. Per the grounding facts, `blockPublicSummary()` output fields are hardcoded at `city-district.mjs:110-119`; extending them requires careful schema versioning. If the flavor text stays purely client-side (loaded from the same static module, not sent over the wire), no allowlist change is needed and the constraint holds. The plan must confirm which path is used before implementation begins.
- If smoke tests for Nexus-05 and Garden-06 routes (the cross-device gaps identified in the grounding facts — `city-collision.spec.mjs` currently exercises only downtown-01 collision logic and downtown-01 plus foundry-04 safe-arrival walkability; harbor-02, skyline-03, nexus-05, and garden-06 safe-arrival assertions are absent) reveal broken safe-arrival or walkability for these blocks, those are blocking findings for 8C regardless of content work.

---

### The Next Fork After 8C

After 8C lands, three paths are available. They are not equivalent and not concurrent.

**Path A — IMPLEMENT PHASE 8C (the content pass, this phase).**
Static config and display-only client derivation across all six blocks. Attachment points: `CITY_ROOMS` optional flavor fields, `labelFor()` / `eventLabel()` / `eventSummary()` flavor parameter extensions, per-block `BLOCK_LABELS` review for Garden and Nexus, cross-device smoke matrix extensions covering nexus-05/garden-06 routes and collision, and updated ADR. No economy, no server change, no deploy. Gate: all six blocks have a readable "why go here" signal visible in the district panel and event card, cross-device smoke matrix green for all six blocks.

**Path B — 8B (partial manifest / more blocks), parked.**
8B only becomes relevant when block utilization pressure is measurable — when real concurrent usage approaches the capacity ceiling of the six-block set (capacity 24 per block, to confirm whether concurrent population across all six is regularly exceeding 50–60% of total district capacity) or when manifest complexity justifies partial delivery. The grounding facts note that 8B requires partial-manifest infrastructure that is not part of 8A or 8C. This path should not open until 8C is complete and block identity is defensible. The trigger is measured population pressure, not calendar time.

**Path C — CF-7 staging, parked.**
CF-7 staging (enabling `LIVE_WORLD_LOADER_ENABLED` in `arcade/creator/approval/approved-loader.mjs:31` and activating the live loader path through `arcade/creator/approval/live-loader.mjs`) requires a real package-backed candidate — a creator-authored district package that has passed the CF-3 layered validator (`arcade/creator/validator/validate-block-layered-package.mjs`) and the approval receipt system (`arcade/creator/approval/approval-receipt.mjs`). That candidate does not exist yet. CF-7 staging is also only meaningful once the base six-block district demonstrates content depth; a live-loaded external district competing with a content-thin native district creates a misleading comparison. This path opens after 8C is complete and after a valid candidate package exists.

**Decision rule:** 8C is the only path that is unblocked now. 8B and CF-7 remain explicitly parked, with their respective preconditions stated above. Neither should be smuggled into 8C scope as "preparatory work" — the engineering rule (smallest coherent change, no fake wiring) applies.

---

### Per-Block Specificity: What "Feel Like a Place" Means for Each Block

All six blocks receive content attention in 8C, but Garden and Nexus receive the most because they are newest and least exercised by existing smoke coverage.

**downtown-01 (neon-noir):** Already the de-facto starting block; `blockName()` resolution works, activity feed seeds arrival correctly. Content work: confirm `eventSummary()` flavor extensions for both `district_signal_surge` (currently `'Downtown is the focus block for this district window.'`) and `district_block_focus` (currently `'Downtown is the spotlight block this window.'`) on downtown convey the data-hub character of the `DATA SPIRE` landmark (the default label in `BUILDINGS` at `city-block.mjs:65`) rather than generic focus prose.

**harbor-02 (tidal-cyan):** `HARBOR CONTROL` data-spire, `DOCKSIDE NOODLES` ramen, `FERRY TERMINAL` maglev (`BLOCK_LABELS` in `city-block.mjs:138`). Content work: `eventSummary()` flavor extensions for `district_route_warmup` events on harbor should reference maritime routing character. Activity feed arrival label (`block_arrived` → `'Arrived in {name}.'` via `labelFor()`) is already correct; flavor attaches at the `labelFor()` optional extension point, passing the result of `safeName(display_name, cityId)` which yields `'Harbor Block'` (not the short form `'Harbor'` — short-name stripping only happens in the events path via `shortBlockName()` in `city-district-events.mjs:116-119`).

**skyline-03 (sunset-violet):** `SKY TOWER` data-spire, `CLOUD CAFE` ramen, `SKY-TRAM HUB` maglev (`BLOCK_LABELS` in `city-block.mjs:139`). Content work: `district_quiet_window` events on skyline should reflect elevated/contemplative character distinct from harbor's maritime quiet. Skyline-03 has degree 3 in the ADJACENCY graph: neighbors are harbor-02, foundry-04, and nexus-05 (`city-district.mjs:45`). It is the convergence point for both the original ring (via harbor and foundry) and the new corridor (via nexus); this three-neighbor density is itself a "why go here" signal worth surfacing in event copy.

**foundry-04 (forge-ember):** `FORGE STACK` data-spire, `EMBER CANTEEN` ramen, `FREIGHT LINE` maglev (`BLOCK_LABELS` in `city-block.mjs:140`). Content work: `district_arcade_hour` events on foundry should reflect industrial-intensity character. Foundry is one of two blocks (alongside harbor) that connect downtown and skyline on the original ring, but foundry is on the opposite arc from harbor and is not adjacent to nexus or garden — its position is the "heavy-industry shortcut" between downtown and skyline while harbor is the maritime path. This distinction is its identity signal relative to harbor.

**nexus-05 (pulse-magenta):** `NEXUS CORE` data-spire, `SYNAPSE BAR` ramen, `TRANSIT NEXUS` maglev (`BLOCK_LABELS` in `city-block.mjs:141`). Adjacent to skyline-03 and garden-06 (`ADJACENCY` in `city-district.mjs:47`). This is the cross-corridor junction block. Content work: Nexus connects the new garden corridor to the original skyline hub. `eventSummary()` flavor extensions for any event type focused on nexus-05 should reflect its junction character. Activity feed labels for routes terminating at nexus use `safeName('Nexus Block', 'nexus-05')` → `'Nexus Block'` as the interpolated name argument to `labelFor()`.

**garden-06 (bloom-cyan):** `BIODOME SPIRE` data-spire, `GREENHOUSE GRILL` ramen, `GARDEN HALT` maglev (`BLOCK_LABELS` in `city-block.mjs:142`). Adjacent to downtown-01 and nexus-05 (`ADJACENCY` in `city-district.mjs:48`). This is the quieter entry point to the cross-corridor. Its bloom-cyan theme and biodome landmark give it a distinct low-intensity character. Content work: `district_quiet_window` events on garden should feel distinct from harbor quiet (maritime vs organic stillness). `eventSummary()` flavor extensions for `district_block_focus` on garden-06 should reference the biodome landmark. The travel button row for "Garden Block" in the downtown district panel is the primary discovery surface for new players — it is currently just a name and count. A non-reward `block_preview` interaction zone (one of the five closed kinds in `INTERACTION_KINDS` at `city-interactions.mjs:20-26`) is the correct attachment point for "why visit" copy on the floor, subject to `validateInteractionZone()` passing (label ≤48 chars, prompt ≤64 chars, FORBIDDEN regex clean).

All six blocks: the cross-device smoke matrix must be extended to cover harbor-02, skyline-03, nexus-05, and garden-06 safe-arrival walkability (extending `city-collision.spec.mjs` beyond its current downtown-01 collision + downtown-01/foundry-04 arrival coverage) and at least one two-client route scenario exercising the downtown→garden→nexus path. These are testing gaps identified in the grounding facts and are prerequisites for 8C sign-off regardless of content work completion.
