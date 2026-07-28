# CloveLearn Free Games — Return-Play Roadmap

- **Date:** 2026-07-28
- **Constraint:** every game and gameplay update stays free; no ads, premium
  currency, paid expansions, energy timers or account gate.
- **Care rule:** invite a healthy return; never punish absence or maximize time
  on site.

## Current suite

The public shelf now spans four useful play moods:

| Mood | Current games | Existing return strength |
| --- | --- | --- |
| Deep strategy | Singularity Inc., VibeCenter | Persistent runs, archetypes, rivals, many endings |
| Short arcade | Pulse Tap, Signal Sprint, Neon Grid, Node Hopper | Scores, grades, quick restarts |
| Puzzle / mental reset | Mind Machine, Operator's Deck | Daily puzzle, levels, six short games |
| Social / creative | Neon Circuit City, Arcade Maker Lab | Shared place, cabinets, local creation |

The catalog is not short on games. Its return problem is that each title keeps
its progress in a different shape and the landing page presents the shelf as a
flat list. Players cannot immediately answer:

1. What is new today?
2. Where was I?
3. What fits the ten minutes I have?

## The smallest strong loop

Create one dedicated `FREE GAMES` shelf page with three rows:

1. **CONTINUE** — at most two locally detected unfinished runs.
2. **TODAY'S CARTRIDGE** — one seeded daily run or featured cabinet.
3. **ALL GAMES** — the permanent catalog with 5 / 15 / 45+ minute, mobile,
   keyboard and offline badges.

The mental-health growth plan remains the site's front-door anchor. The games
page is the lounge: a clear destination for a break, not a competing identity.

## Return systems that fit the product

### 1. Local cartridge passport

Use one small `clove_games_profile_v1` localStorage record containing only:

- last game and last-played date;
- completed runs by stable game ID;
- daily challenge dates completed;
- locally earned cabinet stamps.

No name, email, device fingerprint, cloud sync or cross-site identifier.
Individual game saves remain owned by their games.

### 2. Daily, not disposable

- Singularity already has a date-seeded daily scenario.
- Mind Machine already has a daily puzzle.
- Add a daily contract seed to VibeCenter.
- Add a daily chamber seed to Node Hopper.
- Rotate one Neon Circuit cabinet as the daily cartridge.

Daily content must remain replayable after its feature day. No missed-day
penalty, streak reset or fear-of-missing-out copy.

### 3. End every run with a useful next choice

Every result screen should expose exactly:

- `PLAY AGAIN`
- `TODAY'S CARTRIDGE`
- `BACK TO FREE GAMES`
- `RETURN TO MY PLAN`

This fixes dead ends while preserving player agency.

### 4. A real new/retro cadence

Use two labels rather than inventing more brands:

- **NEW SIGNAL** — substantial new games and feature releases.
- **RETRO CARTRIDGE** — short score-driven games with immediate controls.

Feature one of each per week. Rotation changes presentation, never access;
everything stays in the permanent catalog.

### 5. Honest local milestones

Cross-game milestones should celebrate range, not grinding:

- finish one strategy run;
- solve one daily puzzle;
- earn one arcade grade;
- create one local cabinet;
- return to the growth plan after a break.

They unlock only local visual stamps and history. No spendable economy, random
rewards or exclusive gameplay.

## Ranked implementation

| Priority | Change | Why first | Proof |
| --- | --- | --- | --- |
| P0 | Steam-parity Singularity web build | Removes the largest catalog/content mismatch | Shared-source diff + 98 tests + browser parity harness |
| P1 | Dedicated free-games shelf with Continue / Today / All | Makes the suite legible in one visit | Fixed seeded-profile browser cases |
| P2 | Shared game-shell links and play-time/input badges | Removes dead ends and bad device choices | Link/layout audit at desktop and phone widths |
| P3 | Daily seeds for VibeCenter and Node Hopper | Gives returning players a fresh bounded reason | Same date = same challenge; next date differs |
| P4 | Local cartridge passport and end-screen routing | Connects separate games without accounts | Storage schema tests and cross-game browser replay |
| P5 | Weekly New Signal / Retro Cartridge rotation | Makes releases visible without hiding the archive | Date-fixture catalog tests |

## Do not build

- login rewards or cloud accounts;
- streak-loss warnings;
- loot boxes, random drops or premium currency;
- ads, sponsorship interruptions or paid skips;
- energy systems, cooldowns or artificial waiting;
- leaderboards that require identity or public profiles;
- endless notification prompts.

The suite can become memorable through authored variety, visible continuity and
a humane release rhythm. It does not need a monetization layer.

## Measurement without surveillance

The browser can show the player their own local history. Product-level traffic
can use aggregate, cookieless request counts already available at the hosting
edge. Do not add third-party behavioral analytics merely to optimize
engagement.

The falsifier is simple: if Continue / Today's Cartridge does not increase
second-game starts in controlled local usability sessions, stop adding
meta-progression and improve the individual games' first five minutes instead.
