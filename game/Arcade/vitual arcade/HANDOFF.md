# Neon Circuit Arcade — Implementation Handoff Pack

**Source:** `index.html` (v0 visual/product prototype, mocked state, no backend)
**Status:** v0 visual + product direction **accepted**
**Purpose:** Translate the accepted prototype into an engineering-ready reference for the coding agent.

> ⚠️ **Read section 7 before writing code.** This prototype is a *visual & state reference only* — not the source architecture.

---

## 1. Screen / state inventory

The prototype is a **single persistent floor** with overlays layered on top. There is no page navigation — every "screen" is a view state over the same scene.

| # | State | How it's reached | Key elements | Notes |
|---|-------|------------------|--------------|-------|
| 1 | **Floor / default** | App load; `Esc`; bottom-nav "Floor"; closing any overlay | Scene (grid floor, cabinets, prize booth, avatars), HUD, presence panel, bottom controls, interaction prompt | The home/base state. Always rendered underneath overlays. |
| 2 | **Machine select** | Bottom-nav "Games"; `interact()` with no/occupied machine | Grid of 4 machine cards | Modal overlay over floor. |
| 3 | **Pulse Tap — Start** | "Play now" on Pulse Tap card; `E`/⚡ at the Pulse Tap cabinet | Title, rules, START button | Game overlay, screen = `start`. |
| 4 | **Pulse Tap — Playing** | START | Game HUD (time/score/combo), time bar, 3×3 node board | Screen = `play`. 20s session, node spawn loop. |
| 5 | **Pulse Tap — Results** | Timer reaches 0 | Ticket payout (animated), final score / best combo / hits, Play-again + Back | Screen = `end`. Awards tickets → balance. |
| 6 | **Prize counter** | Bottom-nav "Prizes"; tapping the in-world prize booth | Balance header, prize grid (locked/unlocked), redeem | Modal overlay. Triggers celebration on redeem. |
| 7 | **Avatar customization** | Tapping the player chip | Live avatar preview, color swatches, accessory picker, quick-emote bar | Modal overlay. Edits sync live to scene + chip. |
| 8 | **Emote wheel** | ⚡-emote action button; `T` key | Radial wheel of 6 emotes + center hub | Lightweight overlay (not a full modal). Tap-to-dismiss. |
| 9 | **Mobile controls** | Viewport < 720px | Virtual joystick (bottom-left), action cluster (emote + interact), compacted bottom-nav | Joystick is hidden on desktop; keyboard takes over there. |

**View router contract:** one base state (`floor`) + a mutually-exclusive overlay set (`machines`, `game`, `prizes`, `avatar`) + two independent lightweight layers (`emoteWheel`, `celebrate`). Opening any overlay closes the others.

---

## 2. Component breakdown

| Component | Class / id | Responsibility | Variants / states |
|-----------|------------|----------------|-------------------|
| **HUD (top bar)** | `.hud-top` | Container for chip + brand + tickets | fixed, safe-area aware |
| **Ticket balance** | `.ticket-hud` `#ticketVal` | Show + animate ticket count | `.bump` on change; count-up animation |
| **Player chip** | `.player-chip` `#chipAv` `#chipName` | Identity affordance → opens avatar editor | reflects current color + accessory |
| **Presence panel** | `.presence` `#presenceList` | List nearby players + their status | desktop only (hidden < 720px); per-player color dot + status |
| **Arcade cabinet** | `.cab` (`--cab` accent) | In-world machine; click to walk up | `.selected` (nearby), `.busy` (occupied), `.occ` badge, `.status-led` |
| **Machine card** | `.mcard` (`--mc` accent) | Browsable machine entry | `.state-pill .open/.busy`, `.diff` pips, `.reward`, `.play-btn` / `.play-btn.locked`, `.occ-by` |
| **Interaction prompt** | `.interact` `#interactPrompt` | "Press E / Tap to Play" near a machine | `.show` toggle; shows target machine name + occupied suffix |
| **Mini-game board** | `.grid-board` / `.node` | Pulse Tap play surface | node states `.live`, `.gold`; `.float-pts` feedback |
| **Game HUD** | `.game-hud` / `.timebar` | Time / score / combo readout | live during `play` |
| **Prize card** | `.prize` | Redeemable reward | `.locked` / `.unlocked`, `.redeem .can/.cant`, `.lockbadge`, `.need` |
| **Avatar editor** | `#overlay-avatar` / `.big-av` | Color + accessory + quick emotes | live preview; `.swatch.sel`, `.acc-opt.sel` |
| **Emote wheel** | `.emote-wheel` / `.emote-opt` | Radial emote picker | `.open`; positions computed on a circle |
| **Toast** | `.hint-toast` `#hint` | Transient hints / blocked actions | `.show`, auto-dismiss ~2.6s |
| **Celebration** | `.celebrate` `#celebrate` | Redemption reward moment | `.show`; emoji burst + label |
| **Confetti** | `.confetti` (`confettiBurst(n)`) | Particle burst | used by game-end + redeem |
| **Avatar (in-world)** | `.avatar` / `.av-body` | Player figure in scene | `.me` variant; `bob` animation; `.emote-bubble` overlay |

---

## 3. State model (client/server shape)

Plain JSON-like shape the prototype implies. Use as a target contract — **not** a schema to impose over the existing repo's structures (see §7).

```jsonc
{
  // --- the local player ---
  "player": {
    "id": "string",
    "name": "Player_88",
    "color": "#19e3ff",          // body color (token value)
    "accessory": "🎧",           // "" = none
    "position": { "x": 0, "y": 0 }, // floor coords
    "nearbyMachine": "pulse" | null,
    "currentEmote": "wave" | null
  },

  // --- other players visible on this floor ---
  "playersNearby": [
    {
      "id": "string",
      "name": "Vex_22",
      "color": "#19e3ff",
      "accessory": "🎧",
      "position": { "x": 24, "y": 30 },
      "status": "playing" | "idle" | "browsing_prizes",
      "machineId": "claw" | null
    }
  ],

  // --- machine catalog (static-ish) ---
  "machines": [
    {
      "id": "pulse",
      "name": "PULSE TAP",
      "icon": "⚡",
      "color": "#ff2d95",        // accent token
      "difficulty": 1,            // 1=Easy 2=Medium 3=Hard
      "reward": { "min": 10, "max": 60 },
      "playable": true            // false = preview-only in v0
    }
  ],

  // --- live occupancy (separate from catalog; changes often) ---
  "machineOccupancy": {
    "pulse": { "occupiedBy": null },
    "claw":  { "occupiedBy": "Vex_22" }
  },

  // --- active mini-game session (null when not playing) ---
  "gameSession": {
    "machineId": "pulse",
    "screen": "start" | "play" | "end",
    "timeRemaining": 20.0,
    "score": 0,
    "combo": 1,
    "bestCombo": 1,
    "hits": 0,
    "liveNodes": [ { "cell": 4, "gold": false, "spawnedAt": 0 } ]
  },

  // --- economy ---
  "tickets": 120,

  // --- redemption ---
  "prizes": [
    { "id": "sticker", "name": "Sticker Pack", "img": "🌟", "cost": 40 }
  ],
  "redemptions": [
    { "prizeId": "sticker", "at": "timestamp" }
  ],

  // --- emote definitions ---
  "emotes": [
    { "key": "wave", "emoji": "👋", "label": "Wave" }
  ]
}
```

**Derived (not stored):** prize `locked` = `tickets < cost`; payout = `clamp(round(score / 12), reward.min, reward.max)`; combo cap = 9.

---

## 4. Suggested network events

Conceptual only — express these in the repo's existing binary-protocol style; do not introduce a new transport.

| Event | Direction | Payload (conceptual) | Triggers in UI |
|-------|-----------|----------------------|----------------|
| `player_move` | client → server → peers | `{ id, x, y }` | avatar position; nearbyMachine recompute |
| `player_emote` | client → server → peers | `{ id, emoteKey }` | emote bubble over avatar |
| `machine_enter_range` | client (local) | `{ machineId }` | interaction prompt `.show` |
| `machine_start` | client → server | `{ machineId }` | opens game session; requests lock |
| `machine_occupied` | server → peers | `{ machineId, occupiedBy }` | cabinet `.busy`, card state-pill, presence status |
| `game_score_update` | client → server (throttled) | `{ sessionId, score, combo }` | game HUD; optional live spectating |
| `game_end` | client → server | `{ sessionId, score, bestCombo, hits }` | results screen; releases machine lock |
| `tickets_awarded` | server → client | `{ delta, balance }` | ticket HUD `.bump` + count-up |
| `prize_redeemed` | client → server, confirm → client | `{ prizeId, cost, balance }` | celebration + balance update + re-lock |

**Server is authoritative** on: occupancy locks, ticket balance, redemption validity. Client predicts movement/emotes; reconciles ticket/occupancy from server.

---

## 5. Design tokens

Final values, pulled from `:root` in `index.html`.

### Colors
| Token | Hex | Role |
|-------|-----|------|
| `--void` | `#080411` | base background |
| `--void-2` | `#0f0822` | background gradient stop |
| `--panel` | `#160c2b` | surface |
| `--panel-2` | `#1f1140` | raised surface |
| `--panel-3` | `#2a1a55` | highest surface / inert control |
| `--line` | `rgba(177,74,255,.22)` | hairline border |
| `--line-strong` | `rgba(177,74,255,.45)` | emphasized border |
| `--pink` | `#ff2d95` | primary accent / active nav |
| `--cyan` | `#19e3ff` | secondary accent / interact |
| `--violet` | `#b14aff` | tertiary / structural glow |
| `--gold` | `#ffd23f` | **tickets & rewards only** |
| `--good` | `#3df58b` | available / success |
| `--danger` | `#ff5a5a` | error |
| `--text` | `#f3ecff` | primary text |
| `--muted` | `#9d8fc4` | secondary text |
| `--muted-2` | `#6b5e91` | tertiary / disabled text |

### Typography
| Token | Value | Use |
|-------|-------|-----|
| `--font-display` | `'Bungee'` | logo, marquees, scores, big numbers |
| `--font-ui` | `'Chakra Petch'` | all body / UI text |
| `.mono-num` | `font-variant-numeric: tabular-nums` | any changing number (tickets, score, timer) |

### Spacing
`--s1` 4 · `--s2` 8 · `--s3` 12 · `--s4` 16 · `--s5` 24 · `--s6` 32 · `--s7` 48 (px)

### Radius
`--r-sm` 8 · `--r-md` 14 · `--r-lg` 22 · `--r-pill` 999 (px)

### Glow / shadow
| Token | Value |
|-------|-------|
| `--glow-pink` | `0 0 14px rgba(255,45,149,.55), 0 0 36px rgba(255,45,149,.25)` |
| `--glow-cyan` | `0 0 14px rgba(25,227,255,.55), 0 0 36px rgba(25,227,255,.25)` |
| `--glow-gold` | `0 0 14px rgba(255,210,63,.55), 0 0 30px rgba(255,210,63,.3)` |

Per-element accent glow uses a local `--cab` / `--mc` / `--ac` custom property so each cabinet, card, and avatar carries its own colored shadow.

### Interaction states
| State | Convention |
|-------|------------|
| Hover | lift (`translateY(-4..6px)`) + intensified glow |
| Press | `:active { transform: scale(.88–.97) }` |
| Selected (cabinet) | `.selected` — lift + scale + full glow |
| Machine availability | `.open` (green) / `.busy` (gold) on `.state-pill` + `.status-led` |
| Game node | `.live` (pink pulse) / `.gold` (double value) |
| Prize | `.locked` (grayscale + 🔒 + "N more") vs `.unlocked` (green border, redeemable) |
| Ticket change | `.bump` keyframe + count-up |
| Transient feedback | toast `.show` (auto-dismiss), `.float-pts`, confetti, celebration pop |
| Reduced reliance on color | states pair color with text/icon (pill labels, LED dots, lock badge) |

---

## 6. MVP boundaries

### ✅ In v0
- One arcade floor (single room).
- 4 cabinets: **Pulse Tap** (playable), **Claw Drop** (occupied demo), **Hyper Hoops** & **Circuit Racer** (preview-only).
- **Pulse Tap** mini-game loop (start → play → results → payout).
- Ticket HUD with earn/spend animation.
- Prize counter with locked/unlocked states + redemption.
- Avatar customization (color + accessory) and emotes (wave, celebrate, high-five, dance + 2).
- Mocked social presence — **to be replaced by real multiplayer** using the repo's existing networking.

### 🚫 Out of v0
- Multiple zones / rooms.
- Real-money economy or any monetization.
- **Dave & Buster's name, logo, colors, mascot, slogans, or trade dress** (use the original "Neon Circuit Arcade" identity only).
- Wallets / logins / auth.
- Persistent leaderboards.
- Complex moderation tooling.
- Backend auth flows.

Keep the instant-join, no-login magic: enter straight onto the floor.

---

## 7. Coding-agent warning

**This prototype is NOT the source architecture.** `index.html` is a single-file, mocked, frontend-only **visual and state reference**. Its DOM structure, vanilla-JS view router, and inline state object exist to communicate *product intent and UI states* — not to dictate how the real app is built.

Before writing any code:

1. **Inspect the Hallucinate repo first** (`https://github.com/stagas/hallucinate`).
2. **Preserve its existing patterns** — the `Bun.serve` HTTP/WebSocket setup, room system, motion-sync + validation, custom binary protocol, and LMDB persistence.
3. **Extend, don't replace.** New concepts here (machines, occupancy, mini-game sessions, tickets, prizes, emotes) should map onto the repo's existing message/room/state conventions and binary-protocol style — not introduce a parallel stack.
4. **Treat the JSON in §3 and events in §4 as targets to translate**, expressed in the repo's idioms, with the server authoritative on occupancy locks, ticket balances, and redemptions.

Use this pack to know *what to build and how it should look/behave*. Use the repo to know *how to build it*.
