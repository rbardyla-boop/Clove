# Neon Circuit Arcade — World Bible & Expansion Map

**Status:** Vision document for v1+ expansion. **v0 is locked and accepted** (see [`HANDOFF.md`](./HANDOFF.md)).
**Source of truth for look/feel/state:** [`index.html`](./index.html) (DOM-based faux-3D floor, `openView()` router, `:root` tokens).
**Scope of this document:** Frontend/product design only. **No backend code.** Server contracts are described as *targets to translate* into the existing repo's idioms (Bun.serve + WebSocket rooms + binary protocol + LMDB), exactly as `HANDOFF.md §7` instructs.

> ⚠️ **Original brand only.** This is **Neon Circuit Arcade**. Do **not** use Dave & Buster's name, logo, colors, mascot, slogans, or trade dress anywhere in this world.

---

## 0. How to read this document

This bible answers one question: **"How does the accepted single-floor prototype grow into a believable arcade *world* without betraying its founding ethos?"**

The founding ethos — non-negotiable across every zone, game, and feature:

1. **Instant join.** You land on a floor. No login, no auth, no wallet, no onboarding wall.
2. **No real money. Ever.** Tickets are earned by playing. Nothing is purchasable. No pay-to-win.
3. **Server-authoritative where it counts.** Occupancy locks, ticket balances, and redemptions are validated server-side. Movement and emotes are client-predicted.
4. **It should feel like a place, not a menu.** Zones are walked into, landmarks are seen, other people are present.
5. **Mobile is first-class**, not a port.

Everything below is built on the v0 router (`openView('floor' | 'machines' | 'game' | 'prizes' | 'avatar')` + lightweight `emoteWheel` / `celebrate` layers) and the v0 token system (`:root`). Expansion **extends** these primitives; it does not replace them.

---

## 1. Design council notes (pressure-tested tradeoffs)

Before the spec, the five hard scoping calls, each stress-tested from five angles (Contrarian / First-Principles / Expansionist / Outsider / Executor). These are the decisions a coding agent must not relitigate.

| Decision | The tension | Resolution |
|---|---|---|
| **How many zones?** | Expansionist wants 8 now; Contrarian says 8 empty rooms feels hollow; Executor says each zone is a re-themed scene + a content backlog. | **Design all 8. Ship them in waves.** A zone is cheap to *theme* (CSS custom-property swap on the existing scene) but expensive to *fill* (games). Never ship a zone that has fewer than 2 playable machines. Empty rooms are the #1 way this feels like a tech demo. |
| **Spectating/queueing depth?** | Outsider: "If I walk up to a busy machine and nothing happens, I assume it's broken." First-Principles: the core verb is *play*, not *watch*. | **Minimum viable social, maximal clarity.** Queueing + lightweight spectating ship early because they *unblock* the core verb (you're never stuck staring at a locked cabinet). Deep spectator features (full live mirroring) wait until there's an audience to justify them. |
| **Progression hook without money?** | Contrarian: cosmetics-only gets boring fast; First-Principles: what makes someone come back tomorrow with no account? | **Three stacked loops:** (a) session loop = play → tickets → prize; (b) collection loop = cosmetics + zone discovery; (c) return loop = a daily rotating "Featured Machine" with a ticket multiplier. The return loop is what survives the no-login constraint. |
| **Instant vs animated travel?** | Expansionist wants immersive walking everywhere; Executor warns every animated transition is a load-screen you have to make not-boring; mobile users want speed. | **Hybrid, user's choice.** Portals = short animated transition (immersion, desktop-leaning). Map overlay = instant fade fast-travel (efficiency, mobile-leaning). Same destination, two doors. |
| **12–20 games for v1?** | Contrarian: 20 mediocre games < 4 great ones; Executor: each game is a full mini-app. | **Catalog 20, gate hard by version.** v0 has exactly 1 playable. v1 adds ~5. The catalog is a *backlog with a quality bar*, not a v1 commitment. A game ships only when its loop is as tight as Pulse Tap's. |

**The one blind spot the council caught:** *persistence without login.* "No wallet, no auth, but progression must persist" is a contradiction unless solved deliberately. Resolution in [§4.7](#47-identity--persistence-without-login).

---

## 2. World map

Eight connected zones across two levels, plus one hidden zone. The **Main Floor** is the hub; everything else branches from it.

```
                          ┌─────────────────────┐
                          │   COSMIC LOUNGE      │   (Level 2 · chill / social)
                          │   ambient · social   │
                          └──────────┬──────────┘
                                escalator ▲▼
   ┌──────────────┐   portal   ┌───────┴────────┐   portal   ┌──────────────┐
   │ RETRO ALLEY  │◀──────────▶│   MAIN FLOOR    │◀──────────▶│ HYPER COURT  │
   │ CRT / 8-bit  │            │   (Level 1 hub) │            │ sports / vs  │
   └──────┬───────┘            └───┬────────┬────┘            └──────┬───────┘
          │ portal                 │        │ portal                 │ portal
   ┌──────┴───────┐         ┌──────┴───┐  ┌─┴──────────────┐  ┌──────┴───────┐
   │ RHYTHM       │         │  PRIZE   │  │  CIRCUIT       │  │  (returns to │
   │ REACTOR      │         │  BAZAAR  │  │  RACEWAY       │  │   Main Floor)│
   │ music / beat │         │ rewards  │  │  speed / race  │  └──────────────┘
   └──────────────┘         └────┬─────┘  └────────────────┘
                                 │ hidden seam
                          ┌──────┴───────┐
                          │  THE BACKROOM │   (Secret · discovered, not signposted)
                          │  glitch / hard│
                          └──────────────┘
```

**Adjacency (what's reachable from where):**

| Zone | Connects directly to | Discovery |
|---|---|---|
| Main Floor (L1 hub) | Retro Alley, Hyper Court, Prize Bazaar, Circuit Raceway, Cosmic Lounge (escalator) | Default spawn |
| Retro Alley | Main Floor, Rhythm Reactor | Visible portal |
| Hyper Court | Main Floor | Visible portal |
| Prize Bazaar | Main Floor, **Backroom (hidden seam)** | Visible portal |
| Circuit Raceway | Main Floor | Visible portal |
| Rhythm Reactor | Retro Alley | Visible portal |
| Cosmic Lounge (L2) | Main Floor (escalator) | Visible escalator |
| The Backroom | Prize Bazaar (hidden) | **Unlocked by discovery** (see [§4.3](#43-zone-discovery)) |

**Token rule that governs the whole map:** `--gold (#ffd23f)` stays **reserved for tickets & rewards** everywhere (the v0 rule). Each zone gets its own *zone accent* layered over the shared surface tokens (`--void`, `--panel*`, `--text`, `--muted`). New accents are added as CSS custom properties (`--retro-amber`, `--court-lime`, etc.) — they **extend** `:root`, they do not overwrite the core palette.

---

## 3. Zone-by-zone breakdown

Each zone is the **same DOM scene** (`.scene` → `.floor` faux-3D grid + `.cabinets` + `#players`) re-skinned via a zone token set and re-populated with that zone's machines. The `.wall-sign` / `.wall-tag` pattern (`"NEON CIRCUIT" · "— level 1 · main floor —"`) becomes each zone's signature marquee.

### 3.1 Main Floor / Level 1 — *the hub*

| Field | Detail |
|---|---|
| **Visual mood** | The canonical Neon Circuit look. Confident, welcoming, "you have arrived." The reference everything else riffs on. |
| **Color accents** | `--pink #ff2d95` + `--cyan #19e3ff` + `--violet #b14aff` (existing). |
| **Lighting** | Even neon wash, animated scrolling floor grid (`floorscroll`), soft ceiling glow. Balanced — no single dramatic light source. |
| **Machines/games** | Pulse Tap (playable v0), Claw Drop, Neon Hoops, Circuit Racer teaser cabinet. A curated "best of" sampler — one taste of each neighboring zone's genre. |
| **Social behavior** | Highest density. The plaza/town-square. Presence panel busiest here. Default place to find people and emote. |
| **Reward/ticket role** | Baseline reward rates (Pulse Tap 10–60). The **Featured Machine of the day** lives here with its multiplier. |
| **Distinct because** | It's the only zone you can reach *every* other zone from. It is the brand's "cover photo." Never theme it weird — it's the constant. |

### 3.2 Retro Alley — *the museum that's still alive*

| Field | Detail |
|---|---|
| **Visual mood** | Nostalgic, narrow, slightly grimy-in-a-good-way. CRT scanlines, pixel signage, a back-alley-of-classics feeling. |
| **Color accents** | `--good #3df58b` (phosphor green) + **`--retro-amber #ff9e3f`** (NEW — warmer/oranger than gold, so it never reads as "tickets"). |
| **Lighting** | Flickering tube-light buzz, per-cabinet CRT bloom, occasional scanline sweep across the scene. Dimmer overall than Main Floor. |
| **Machines/games** | Pixel-era styles: Pixel Drop (stacker), Blaster Row (fixed shooter), Ghost Maze (chase). Cabinets render with chunky bezels and a faux-CRT screen filter. |
| **Social behavior** | "Show me how it's done" energy — high-score bragging, spectators clustered around the hard classics. Lots of queueing. |
| **Reward/ticket role** | Skill-gated. Lower base payout, higher *ceiling* — mastery pays. Good home for high-score streak bonuses. |
| **Distinct because** | The only zone that *looks like a different era*. The CRT filter is its signature and appears nowhere else. |

### 3.3 Hyper Court — *the sweat zone*

| Field | Detail |
|---|---|
| **Visual mood** | Bright, kinetic, competitive. Painted court lines, scoreboards, the feeling of a packed gym. |
| **Color accents** | `--cyan #19e3ff` + **`--court-lime #b6ff3f`** (NEW) + court-line white. |
| **Lighting** | High-key, stadium-flood bright (the brightest zone — deliberate contrast with Retro Alley). Scoreboard glow. |
| **Machines/games** | Physical/sports: Neon Hoops (basketball), Skee Roll (roll-to-target), Puck Clash (air hockey, 2P). Cabinets are wider, "station"-shaped, some with two seats. |
| **Social behavior** | **Head-to-head.** The first zone with true 2-player cabinets. Spectators react loudly (emote bursts over the station). Queue = "winner stays / next up." |
| **Reward/ticket role** | Competitive payouts — winning a head-to-head pays more than the solo variant. Streak/winner bonuses. |
| **Distinct because** | First home of multiplayer *cabinet* states (1/2, 2/2) and versus play. Loud, social, fast. |

### 3.4 Prize Bazaar — *the prize counter, grown into a marketplace*

| Field | Detail |
|---|---|
| **Visual mood** | Warm, abundant, a little carnival. Stalls and shelves of redeemables, plushies, collectibles. The v0 prize booth expanded into a whole street. |
| **Color accents** | `--gold #ffd23f` (justified here — this *is* the rewards zone) + `--pink #ff2d95` warmth. |
| **Lighting** | Warm marquee bulbs, shelf spotlights on featured prizes, a celebratory shimmer on redemption. |
| **Machines/games** | Not arcade machines — *redemption stalls* + a couple of "spend-to-play" reward games: Lucky Spin (daily wheel, tickets-only) and Token Toss (ring/coin-pusher). |
| **Social behavior** | Browsing, comparing, the public celebration moment when someone redeems a big prize (group confetti). Lower-intensity, social-shopping. |
| **Reward/ticket role** | The **sink.** This is where tickets *leave* the economy. Houses the full cosmetic catalog + collectible prizes. |
| **Distinct because** | The only zone built around *spending*, not earning. Contains the hidden seam to The Backroom. |

### 3.5 Circuit Raceway — *speed*

| Field | Detail |
|---|---|
| **Visual mood** | Fast, dark-with-streaks, motion-blur energy. Checkered accents, neon trails, a tunnel-of-light feeling. |
| **Color accents** | `--danger #ff5a5a` (used as *racing red*, not error) + `--cyan #19e3ff` speed-trails. |
| **Lighting** | Low ambient + bright moving light streaks; the floor grid scrolls faster here (reuse `floorscroll` at higher speed). |
| **Machines/games** | Driving/racing: Circuit Racer (time-trial), Drift Dash (endless runner). Seated/cockpit-style cabinets, some multi-seat for races. |
| **Social behavior** | Ghost-racing and live multi-racer lobbies. Spectators watch the leaderboard tick. Queue = "next heat." |
| **Distinct because** | Motion is the theme — faster floor scroll, light-trail FX, the only zone where the *environment itself* reads as moving. |
| **Reward/ticket role** | Time/placement-based. Beating your own ghost pays a small "personal best" bonus (no global leaderboards — see ethos). |

### 3.6 Rhythm Reactor — *the room that breathes*

| Field | Detail |
|---|---|
| **Visual mood** | Pulsing, reactive, club-without-the-club-baggage. Everything throbs on a shared beat. |
| **Color accents** | `--violet #b14aff` + `--pink #ff2d95`, strobing. |
| **Lighting** | Beat-synced — the whole scene pulses to a zone-wide BPM. The most animated lighting in the world. Honors `prefers-reduced-motion` with a calm fallback. |
| **Machines/games** | Rhythm: Beat Runner (lane tapper), Sync Squad (co-op group rhythm). Cabinets visualize the beat even when idle. |
| **Social behavior** | The dance floor. Emotes auto-sync to the beat here. **Group mini-game** home (Sync Squad pulls in nearby players). |
| **Reward/ticket role** | Accuracy/combo-based, echoing Pulse Tap's combo system (familiar to v0 players). Group games split a shared pot. |
| **Distinct because** | A single shared BPM drives lighting, idle cabinets, and emotes simultaneously. No other zone is *temporally* unified. |

### 3.7 Cosmic Lounge — *the exhale*

| Field | Detail |
|---|---|
| **Visual mood** | Calm, spacious, deep-space. Soft, low-saturation, a place to *be* rather than grind. Level 2, reached by escalator (literal sense of "up and away"). |
| **Color accents** | `--violet #b14aff` muted + deep-cyan, low saturation, starfield. |
| **Lighting** | Ambient, slow-drifting, gentle parallax stars. The dimmest, softest zone. |
| **Machines/games** | Low-stakes/social: Gravity Pong (chill 2P physics), Star Sketch (collaborative draw-and-guess). Lounge seating as social props. |
| **Social behavior** | Hang out, customize avatars together, casual emote chatter. The "between sessions" zone. Lowest pressure. |
| **Reward/ticket role** | Minimal/flat payouts by design — you don't come here to farm. Optional cosmetic-unlock previews ("try on" mirrors). |
| **Distinct because** | The only zone that is *not* about winning tickets. Its job is to make the world feel inhabited, not just played. |

### 3.8 The Backroom — *the secret*

| Field | Detail |
|---|---|
| **Visual mood** | Hidden, off-grid, intriguing-not-scary. Looks like a maintenance space the arcade forgot — exposed wiring, glitch artifacts, experimental cabinets. |
| **Color accents** | `--good #3df58b` (terminal green) + `--danger #ff5a5a` glitch flickers, over near-black. |
| **Lighting** | Single dramatic source + intermittent glitch strobes + datamosh artifacts on the walls. |
| **Machines/games** | Experimental/hard: Glitch Gauntlet (endless survival), Co-op Vault (group puzzle). Cabinets look prototype/unfinished on purpose. |
| **Social behavior** | "How did you even find this?" — discovery bragging, co-op problem solving. Small, in-the-know crowd. |
| **Reward/ticket role** | Highest risk/reward. Rare cosmetic drops only available here. The flex zone. |
| **Distinct because** | You can't reach it from the map until you've *found* it. It is the only zone gated by discovery, not navigation. |

---

## 4. World progression model

**Non-monetized, no-login, no-wallet, no pay-to-win.** Progression is built from three stacked loops, all powered by the v0 ticket system.

### 4.1 Tickets (the only currency)

- **Earned exclusively by playing.** Payout formula stays the v0 contract: `clamp(round(score / divisor), reward.min, reward.max)`. Pulse Tap = `score/12`, range 10–60. Each new game declares its own divisor + range (see [§5](#5-mini-game-catalog)).
- **Never purchasable.** There is no top-up, no IAP, no bundle. The word "buy" does not appear in this product.
- **Server-authoritative balance** (per `HANDOFF.md §4`): the server validates awards and redemptions; the client predicts and reconciles.
- **HUD unchanged:** the v0 `.ticket-hud` `.bump` + count-up animation is the canonical earn/spend feedback everywhere.

### 4.2 Cosmetic unlocks (the collection loop)

All cosmetic, zero gameplay effect. Unlocked two ways: **ticket spend** (Prize Bazaar) or **milestones** (free, for doing things).

| Cosmetic category | Examples | Unlock path |
|---|---|---|
| Avatar color | extends v0 swatch set | Bazaar spend / starter-free |
| Accessory | extends v0 `🎧 👑 🕶️` set — hats, visors, auras | Bazaar spend |
| Trail / footstep FX | neon trail behind avatar | Milestone (zones visited) |
| Emote packs | themed sets per zone (rhythm pack, retro pack) | Mixed |
| Nameplate styles | font/glow treatments on `.av-name` | Milestone (games played) |
| "Skins" | full avatar restyle | Bazaar spend (premium ticket cost) + rare Backroom drops |

**Rule:** no cosmetic ever changes hitboxes, payouts, speed, or visibility-of-game-state. Cosmetics are seen by others (that's the point) but confer no advantage.

### 4.3 Zone discovery

- Zones are **unlocked by exploration, not payment.** Walking through a portal the first time "discovers" it (small celebration, added to the map overlay).
- **Milestone gates** keep early players from drowning: e.g., Cosmic Lounge escalator appears after first prize redemption; Circuit Raceway portal lights up after N games played. These are *soft* reveals (the portal is visible but dormant), never paywalls.
- **The Backroom is found, not unlocked by counter:** a hidden interactable in the Prize Bazaar (e.g., a mislabeled stall / a cabinet that glitches when emoted at) opens the seam. Once found, it pins to that device's map. This is the world's one true secret — keep it word-of-mouth.

### 4.4 Prize redemption

- v0 prize counter logic is the contract: `locked = tickets < cost`; redeem → server validates → `.celebrate` + balance re-lock.
- Prize Bazaar expands this into categories (cosmetics, collectibles, profile flair). Same locked/unlocked/redeem states, just more shelves.
- **Public celebration:** redeeming a high-cost prize triggers a *group* celebration visible to nearby players (social proof without leaderboards).

### 4.5 Daily / rotating machines (the return loop)

This is the engine that makes a no-login world worth coming back to:

- **Featured Machine of the Day:** one machine (rotates daily) carries a **ticket multiplier** (e.g., ×1.5). Lives on the Main Floor with a distinct marquee.
- **Daily Challenge:** one rotating objective ("hit 30 gold nodes," "win a Puck Clash") grants a one-time bonus ticket payout.
- **Rotation is server-driven** (a daily seed), so everyone sees the same featured machine — shared talking point, drives the social plaza.
- Strictly **opt-in and additive.** Miss a day, lose nothing but that day's bonus. No streak punishment, no FOMO mechanics, no "login to claim."

### 4.6 What progression explicitly is NOT

- ❌ No real-money economy, IAP, currency packs, or "premium" tier.
- ❌ No wallet, no balance you can cash out, no trading.
- ❌ No pay-to-win — nothing purchasable affects gameplay outcomes.
- ❌ No global leaderboards (personal bests / ghosts only — keeps it pressure-free and avoids a moderation/anti-cheat tarpit).
- ❌ No energy/stamina timers that gate play behind waiting or paying.

### 4.7 Identity & persistence without login

*The blind spot the council flagged: "persist progress, but no login" is a contradiction unless designed.*

- **Device-scoped identity.** On first load, mint an anonymous device token (client-side, `localStorage`), generate the `Player_##` name + default avatar. No email, no password, no friction. This is what "instant join" already implies in v0.
- **Client-persisted progression** (tickets, cosmetics owned, zones discovered, daily-challenge state) lives in `localStorage`, keyed to the device token, so it survives refreshes and return visits.
- **Server stays authoritative *during a session*** for the things that must not be forgeable: live occupancy locks, in-session ticket awards, redemption validity (`HANDOFF.md §4`). The server is the referee of a live room; `localStorage` is the player's personal save file between visits.
- **Graceful, honest about its limits:** clearing browser storage = fresh start. That's an acceptable, clearly-communicated tradeoff for a no-account product. (An *optional* "carry my arcade across devices" code can be a *later* nicety — never a wall, never required.)
- **No PII, ever.** Anonymous tokens only. This keeps the security boundary clean (no credentials to leak) and the join instant.

---

## 5. Mini-game catalog

20 games, gated hard by version. **A game ships only when its core loop is as tight as Pulse Tap's** — the catalog is a quality-barred backlog, not a v1 promise. Reward ranges are tuned around the v0 Pulse Tap baseline (10–60). Solo unless noted.

| # | Name | Zone | Genre | Players | Difficulty | Ticket range | Core interaction loop | Version |
|---|---|---|---|---|---|---|---|---|
| 1 | **Pulse Tap** | Main Floor | Reaction / grid | Solo | ◆ Easy | 10–60 | Tap live nodes on a 3×3 grid before they fade; gold = 2×; combo to 9; miss resets combo. *(The v0 reference loop.)* | **v0 ✅** |
| 2 | **Claw Drop** | Main Floor | Skill / timing | Solo | ◆◆ Med | 5–80 | Position claw on X then Z axis, drop, grab. Forgiving-but-fickle. | **v1** |
| 3 | **Neon Hoops** | Hyper Court | Sports / arcade | Solo or 2P | ◆◆ Med | 10–70 | Flick/aim-and-release free-throws against a shrinking clock; streaks multiply. | **v1** |
| 4 | **Pixel Drop** | Retro Alley | Puzzle / stacker | Solo | ◆◆ Med | 10–90 | Falling blocks, clear lines, speed ramps. Skill ceiling = payout ceiling. | **v1** |
| 5 | **Skee Roll** | Hyper Court | Aim / roll | Solo or turn-based 2P | ◆ Easy | 10–60 | Swipe to roll a ball up a lane into scoring rings; risk far rings for more. | **v1** |
| 6 | **Lucky Spin** | Prize Bazaar | Daily / chance | Solo | ◆ Easy | 5–50 (daily) | One free spin per day (tickets-only wheel). Pure return-loop sugar — **never** real-money gacha. | **v1** |
| 7 | **Blaster Row** | Retro Alley | Fixed shooter | Solo | ◆◆ Med | 10–80 | Move along the bottom, shoot descending rows, don't get hit. 8-bit homage. | **v2** |
| 8 | **Puck Clash** | Hyper Court | Versus / reflex | **2P MP** | ◆◆ Med | 15–80 (winner) | Air-hockey: defend your goal, score on theirs. First true head-to-head cabinet. | **v2** |
| 9 | **Circuit Racer** | Circuit Raceway | Racing / time-trial | Solo or MP | ◆◆◆ Hard | 10–90 | Steer a neon racer through gates; beat the clock / your ghost / live rivals. | **v2** |
| 10 | **Beat Runner** | Rhythm Reactor | Rhythm | Solo | ◆◆ Med | 10–80 | Tap lanes on the beat; accuracy + combo (echoes Pulse Tap combo). | **v2** |
| 11 | **Token Toss** | Prize Bazaar | Skill / chance | Solo | ◆ Easy | 5–60 | Toss/ring-aim at pegs or a coin-pusher ledge; satisfying near-misses. | **v2** |
| 12 | **Ghost Maze** | Retro Alley | Maze / chase | Solo | ◆◆◆ Hard | 15–90 | Clear a maze of pips while dodging chasers; power-pips flip the threat. | **v2** |
| 13 | **Gravity Pong** | Cosmic Lounge | Physics / casual | 2P MP | ◆ Easy | 5–50 | Pong with a gravity well bending the ball. Chill, social, low-stakes. | **v2** |
| 14 | **Hoop Streak** | Hyper Court | Sports / endurance | Solo | ◆◆◆ Hard | 10–100 | Endless free-throw streak; spacing/angle drift over time. Mastery flex. | **later** |
| 15 | **Drift Dash** | Circuit Raceway | Endless runner | Solo | ◆◆ Med | 10–80 | Lane-shift + drift through endless traffic; distance = score. | **later** |
| 16 | **Sync Squad** | Rhythm Reactor | Co-op rhythm | **Group MP** | ◆◆ Med | shared pot | Nearby players join a shared beat chart; collective accuracy fills a group meter and splits a pot. | **later** |
| 17 | **Star Sketch** | Cosmic Lounge | Social / draw-guess | **Group MP** | ◆ Easy | 5–40 | One draws, others guess via emote/quick-pick. Pure social glue. | **later** |
| 18 | **Glitch Gauntlet** | The Backroom | Survival / endless | Solo | ◆◆◆◆ Brutal | 20–120 | Escalating glitch-hazard survival; rules subtly break as you go. Backroom flex. | **later** |
| 19 | **Co-op Vault** | The Backroom | Puzzle / co-op | **Group MP** | ◆◆◆ Hard | shared rare | Two+ players solve a synchronized lock puzzle; rare cosmetic drops. | **later** |
| 20 | **Reactor Rush** | Rhythm Reactor | Rhythm / versus | 2P MP | ◆◆◆ Hard | 15–90 (winner) | Head-to-head rhythm duel; steal combo from your rival. | **later** |

**Catalog rules for the coding agent:**
- Every game reuses the v0 `game` overlay router state (`start → play → end`) and the end-screen payout/count-up flow. New game = new board renderer + loop, **same shell**.
- Multiplayer games introduce cabinet seat states (`1/2`, `2/2`) — a new cabinet variant, not a new view system.
- Reward ranges are *targets*; tune each divisor so a competent run pays mid-range and mastery approaches the cap (mirrors Pulse Tap's `score/12`).

---

## 6. Social interaction design

The goal: make the world feel **inhabited**, while keeping the core verb *playing*. Layered from "ships early because it unblocks play" to "ships later because it's flavor."

### 6.1 Emotes (extend v0)

- v0 ships the radial wheel + 6 emotes (`wave, celebrate, high-five, dance, +2`) on `T` / ⚡ button. Keep it.
- **Expand to emote packs** (cosmetic unlock): zone-themed sets (retro pack, rhythm pack). Wheel stays 6-at-a-time; equipped pack swaps the set.
- **Contextual auto-emotes:** in Rhythm Reactor, emotes snap to the beat; on a big win, a celebrate auto-fires (cancelable).

### 6.2 High-five / group celebration (v1)

- **High-five:** two avatars within proximity both emote-high-five → a shared FX + small mutual flourish. Proximity-gated, client-predicted.
- **Group celebration:** triggered by shared moments — a big prize redemption, a daily-challenge clear, a multiplayer win. Nearby players get a synchronized confetti/emoji burst (reuses v0 `confettiBurst` + `.celebrate`). Social proof without a leaderboard.

### 6.3 Watching someone play (v1 lightweight → later rich)

- **v1 (lightweight, ships with queueing):** walk up to an occupied cabinet → the interaction prompt shows *who's playing + their live score* (mirror the player's `game_score_update`, already a planned event in `HANDOFF.md §4`). You see the cabinet "lit up busy" with a live number. Cheap, and it answers the Outsider's "is this broken?" instantly.
- **later (rich spectating):** a full spectator view mirroring the board. Gated until there's enough of an audience to justify the bandwidth/complexity.

### 6.4 Queueing at occupied machines (v1 — ships early on purpose)

- Occupied cabinet → "Join queue" instead of a dead end. Queue position shown (`#2 in line`).
- When the machine frees, the next player is prompted to step up (short grace window, then auto-skip).
- **Why early:** it directly unblocks the core verb. A world where popular machines are just *locked* feels broken; a queue makes "busy" feel *alive*. Maps onto the v0 `.busy` / `.occ` cabinet states — extend the occupancy object with a `queue` array (`HANDOFF.md §3` already foreshadows this).

### 6.5 Spectator reactions (v1)

- While watching, spectators can fire reaction emotes (`👏 🔥 😮`) that **float over the cabinet** toward the player — lightweight, reuses the `.float-pts` / `.emote-bubble` FX.
- Gives the player live crowd feedback and gives spectators something to *do* while queued. This is what turns a queue from waiting into watching.

### 6.6 Multiplayer cabinet states (v2)

- Cabinets that seat 2+ gain seat indicators (`1/2`, `2/2`, `0/2 open`) on the in-world cabinet and the machine card.
- States: `open` (join freely) · `filling` (1 seat taken, "join") · `full` (spectate/queue) · `in-progress`.
- Head-to-head result screens show both players + winner; payouts favor the winner but losers still earn (no shut-outs — keeps it friendly).

### 6.7 Group mini-games (later)

- Zone-anchored shared sessions: **Sync Squad** (Rhythm Reactor) and **Co-op Vault** (Backroom). Nearby players opt in; a shared meter/goal; rewards split or shared-rare.
- These are the "this is a *world*" payoff — but they depend on real multiplayer presence (v1) and multiplayer cabinets (v2) existing first. Hence: later.

**Social layer ship order (the minimum-viable-world spine):**
`real presence (v1)` → `queue + lightweight spectate + reactions (v1)` → `high-five/group celebrate (v1)` → `MP cabinets (v2)` → `group games (later)`.

---

## 7. Navigation model

Two ways to the same place — immersion *or* speed — so neither desktop wanderers nor mobile tappers feel punished.

### 7.1 Physical portals / doors / escalators (the immersive path)

- Each zone edge has a **portal** (archway/door) or **escalator** (between Level 1 and the Level 2 Cosmic Lounge). Walking into it triggers a **short animated transition** (~400–700ms): a brief walk-through + zone-load wipe themed to the destination (e.g., CRT power-on into Retro Alley, light-tunnel into Circuit Raceway).
- Portals carry the destination's **signature marquee** (the `.wall-sign` pattern) so you always know where a door goes before you take it.
- This is the desktop-leaning, "I'm exploring a place" path.

### 7.2 Map overlay (the efficient path)

- A new **World Map** entry in the bottom-nav (alongside Floor / Games / Prizes) opens a full-screen map overlay — a new mutually-exclusive `openView('map')` state, slotting cleanly into the v0 router.
- Map shows all discovered zones, **live player counts per zone**, your current location, and the Featured Machine's home zone.
- **Tap a zone → instant fast-travel** (a quick ~300ms fade, no walk animation).
- Undiscovered zones render as silhouettes/`???` (the Backroom doesn't appear at all until found).
- This is the mobile-leaning, "take me there now" path.

### 7.3 Clear visual landmarks

- Every zone has one **unmistakable landmark** visible the moment you arrive (Retro Alley's giant CRT marquee, Hyper Court's scoreboard, the Bazaar's prize tower, the Raceway's start-line arch). Landmarks double as the map icons.
- The Main Floor's `"NEON CIRCUIT"` wall-sign is the anchor landmark — every zone's marquee is a *variation* on it, so the world feels like one brand.

### 7.4 Mobile-friendly zone switching

- On mobile, the **map overlay is the primary navigation** (tap-to-travel) — no precise joystick-walking-into-a-doorway required.
- Portals still work on mobile (walk up, tap "Enter") but the map is the fast default.
- Zone switches must not relayout the HUD or lose the player's ticket/avatar state — only the scene + machine set re-theme.

### 7.5 What's instant vs animated

| Action | Treatment | Why |
|---|---|---|
| Map fast-travel | **Instant** (~300ms fade) | Efficiency; respects mobile + repeat travel. |
| Walking through a portal | **Animated** (~400–700ms themed transition) | Immersion; sells the sense of moving between places. |
| Discovering a zone first time | **Animated + celebration** | A moment worth marking once. |
| Re-entering a known zone | **Fast** (light fade) | Don't make familiar travel tedious. |
| Opening an overlay (games/prizes/avatar/map) | **Instant** (v0 behavior) | These are UI, not travel. |
| `prefers-reduced-motion` | All transitions collapse to a simple fade | Accessibility, non-negotiable. |

---

## 8. Engineering boundary

Three tiers. The coding agent should treat the v0 tier as **frozen** and build outward. **No backend code is authored from this document** — server-side concepts are expressed as targets to translate into the existing repo's Bun.serve + WebSocket + binary-protocol + LMDB idioms (`HANDOFF.md §7`).

### 8.1 v0 — implemented & accepted (FROZEN — do not rebuild)

- Single Main Floor scene (DOM faux-3D), `openView()` router (`floor / machines / game / prizes / avatar` + `emoteWheel` / `celebrate`).
- 4 cabinets: **Pulse Tap** (playable), Claw Drop (occupied demo), Neon Hoops + Circuit Racer (preview-only cards).
- Pulse Tap loop (start → play → end), ticket HUD (`.bump` + count-up), prize counter (locked/unlocked + redeem), avatar customization (color + accessory), emote wheel (6 emotes).
- **Mocked** social presence (`PLAYERS` array) — explicitly the first thing v1 replaces.
- `:root` design tokens; `--gold` reserved for tickets/rewards.

### 8.2 v1 — first expansion (the "it's a small world now" release)

**Foundation work (do first):**
- **Replace mocked presence with real multiplayer** via the repo's existing room/motion-sync/binary protocol. This is the keystone — everything social depends on it.
- **Device-token identity + `localStorage` persistence** (tickets, cosmetics, discoveries, daily state) — see [§4.7](#47-identity--persistence-without-login).
- **Map overlay** as a new `openView('map')` state + bottom-nav entry.
- **Multi-zone scene system:** parameterize the scene by a zone token set + machine list. One scene engine, swappable theme/content. Portals + animated transitions.

**Content:**
- **3 new zones:** Retro Alley, Hyper Court, Prize Bazaar (each ≥2 playable machines — never an empty room).
- **~5 new playable games:** Claw Drop, Neon Hoops, Pixel Drop, Skee Roll, Lucky Spin.
- **Social:** queueing (occupancy `queue` array), lightweight spectating (live score on busy cabinet), spectator reactions, high-five + group celebration.
- **Progression:** daily Featured Machine (multiplier) + Daily Challenge; expanded cosmetic catalog + milestone unlocks; zone discovery celebrations.

### 8.3 v2 — deeper world

- **Remaining mapped zones:** Circuit Raceway, Rhythm Reactor, Cosmic Lounge (escalator to Level 2).
- **Multiplayer cabinets** (seat states, head-to-head): Puck Clash, Circuit Racer (live races), Gravity Pong.
- **More games:** Blaster Row, Beat Runner, Token Toss, Ghost Maze.
- **Rich spectating** (board mirroring) where audience justifies it.
- Rhythm Reactor's zone-wide shared BPM system (lighting + idle cabinets + emotes synced).

### 8.4 later — world-building & long tail

- **The Backroom** (discovery mechanic in Prize Bazaar; rare-drop cosmetics).
- **Group mini-games:** Sync Squad, Co-op Vault, Star Sketch.
- Long-tail games: Hoop Streak, Drift Dash, Glitch Gauntlet, Reactor Rush.
- Optional cross-device "carry code" (never required), seasonal cosmetic rotations, deeper emote packs.

### 8.5 Hard boundaries that never move (any tier)

- ❌ No backend code authored from this doc — translate to existing repo idioms only.
- ❌ No real-money economy, wallet, auth wall, or PII.
- ❌ No pay-to-win; cosmetics never affect gameplay.
- ❌ No global leaderboards (personal bests / ghosts only).
- ❌ **No Dave & Buster's** name, logo, colors, mascot, slogans, or trade dress — Neon Circuit Arcade is original throughout.
- ✅ Instant join, server-authoritative on occupancy/tickets/redemptions, mobile first-class, `prefers-reduced-motion` honored.

---

## 9. Quick reference — what a coding agent inherits

| Need | Where it's defined |
|---|---|
| Visual tokens, exact hex/fonts/spacing/glows | `index.html` `:root` + `HANDOFF.md §5` |
| View router contract (extend, don't replace) | `HANDOFF.md §1` + `openView()` in `index.html` |
| State shape (player, machines, occupancy, session, tickets, prizes, emotes) | `HANDOFF.md §3` |
| Network events to translate into repo idioms | `HANDOFF.md §4` |
| Game loop reference (start/play/end, payout) | Pulse Tap in `index.html` |
| Zone themes, accents, moods | This doc §3 |
| Game backlog + version gates | This doc §5 |
| Progression rules (no-money, no-login) | This doc §4 |
| Social ship order | This doc §6 |
| Navigation (instant vs animated) | This doc §7 |
| What to build when | This doc §8 |

**Golden rule:** *Extend the v0 primitives. A new zone is a re-themed scene; a new game is a new board inside the existing `game` overlay; a new social feature maps onto existing presence/occupancy/emote events. When in doubt, do less, but make it as tight as Pulse Tap.*
