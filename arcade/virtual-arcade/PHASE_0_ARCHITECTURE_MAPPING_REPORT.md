# PHASE 0: Neon Circuit Arcade Architecture Mapping Report

> 🔴 **HISTORICAL — DO NOT IMPLEMENT FROM THIS DOCUMENT.** This entire report maps the
> product onto the Hallucinate repo, which was demoted and is not the Phase 1b authority.
> The shipped authority is this repo's Cloudflare Worker + Durable Object hive
> (`workers/arcade/`), and most of the features mapped below (cabinets, occupancy, round
> scoring, tickets, prizes, emotes, presence, zones/portals) **already ship** there.
> The corrected mapping is [`HIVE_WORLD_ALIGNMENT.md`](./HIVE_WORLD_ALIGNMENT.md).
> Kept only as a record of the analysis method.

**Status:** Read-first analysis only. No code written or modified.  
**Base:** Hallucinate repo (`github.com/stagas/hallucinate`), cloned and inspected in full.  
**Product Inputs:** Design package at `game/Arcade/virtual-arcade/` (index.html, HANDOFF.md, WORLD_BIBLE.md, WORLD_MAP.svg).

---

## 1. Current Hallucinate Architecture

### Client/Server Structure
- **Server:** `server.ts` (1117 lines, Bun runtime)
  - Listens on port 3001 (configurable)
  - HTTP static file serving from `/dist` with cache headers
  - WebSocket upgrade on same connection, binary message routing
- **Client:** `src/main.ts` → `src/club-app.ts`
  - Vite-bundled entry point
  - WebGL2 renderer (no framework, vanilla TypeScript)
  - Real-time 3D scene with multiplayer synchronization
- **Build:** `tsc && vite build` (TypeScript → JavaScript → bundled `/dist`)

### Protocol Files
- **`src/protocol.ts`** (598 lines) — binary message encoding/decoding
  - Message types: 14 defined (C_MOTION, S_ROOM_STATE, MESSAGE, GRAFFITI, VIDEO_STATE, BEACH_BALLS, etc.)
  - Protocol version: hardcoded to 20; mismatch triggers reconnect
  - Encoding: ArrayBuffer with custom bit-packing (motion: 16 bytes, graffiti: 13 bytes per splat)

### Room Model
- **Three fixed rooms:** inside (room 1), outside (room 0), tent (room 2)
  - Mapped by world position via `roomAt()` in `scene.ts` (line 84)
  - Room change via `C_ROOM_CHANGE` message, server-authoritative
  - Each room maintains a `Set<Client>` of connected players
  - State sync on room change: full player list + selfId
- **Lifecycle:** Client joins → `addToRoom()` → broadcast `S_SPAWN` to room → heartbeat re-syncs every 10s

### Movement/Pose Sync
- **Client-side prediction:** Movement input buffered locally, interpolated on remote players
  - `updateRemotePlayers()` advances remote positions at 5 m/s if moving
  - Motion blending (~0.1s) smooths animation transition between idle/moving
- **Server authority:** `validateMotion()` checks
  - Position within world bounds
  - Speed clamped: max distance = `maxClientStep` (1.2) + delta × `maxClientSpeed` (8)
  - Height constrained to [-3, 2.5]
  - Seated validation: if mode = sitting, must be on valid seat
  - If invalid: message silently discarded, no broadcast
- **Sync frequency:** On-demand (`C_MOTION` when keys change) + 10s heartbeat resync
- **Encoding:** Position as int16 with scale factor 100 (1.5m = 150 units)

### Object Sync (Beach Balls & Graffiti)
- **Beach Balls:**
  - Three balls in memory, positions/velocities per ball
  - Client sends `BEACH_BALLS` packet with full state
  - Server validates bounds, applies physics, broadcasts to room
  - Authority timeout: 2s per ball per player (prevents rapid ownership swap)
  - No persistence; reset on server restart
- **Graffiti:**
  - Persistent splats stored in LMDB (up to 100k)
  - Each splat: 13 bytes (id, wall, x, y, seed, color, radius)
  - Procedural rendering from seed allows compact storage
  - Any client can create; server validates bounds/color, assigns ID, persists immediately
  - On join: send all splats via `S_ONLINE` message

### Avatar Customization & Emotes
- **Style:** 6-field structure (top, bottom, hair, hairColor, skin, accessory)
  - Sent with every `C_MOTION` packet (6 bytes)
  - Server validates indices; broadcast with motion to all in room
  - Persisted to `localStorage` by client on changes
- **Modes/Animation:** CharacterMode enum (stand/run/jump/sitting/wave/waveOut)
  - Mode sent in motion packet, synchronized per room
  - Idle clip index (0-3) randomized for variety
  - **No emote wheel or emoji system** (modes only)

### Build & Dev Commands
- **Dev:** `npm run dev` — concurrent Vite HMR + Bun --watch
- **Build:** `npm run build` — tsc + vite build → `/dist`
- **Start:** `npm run start` or `bun server.ts`
- **Testing:** None configured; no test framework in repo

---

## 2. Existing Patterns We Should Preserve

### **DO NOT BREAK:**

1. **Bun.serve() HTTP + WebSocket on same connection** (`server.ts` lines 28-291)
   - No separate WS server; upgrades from HTTP handler
   - Static file serving + dynamic routing unified
   - Port: 3001 (environment-configurable)

2. **Binary protocol with type-prefixed messages** (`protocol.ts`)
   - First byte = message type, rest = payload
   - Message types centralized as numeric constants
   - Version check on upgrade; mismatch = reconnect

3. **Room-scoped broadcast pattern** (`server.ts` lines 1102-1108)
   - `broadcast(room, data, except?)` sends to all in room except sender
   - Room number as routing key throughout codebase
   - Player join/leave: `S_SPAWN`/`S_LEAVE` to room, not global

4. **Server-authoritative validation** (`server.ts` lines 596-772)
   - Position, height, seat, speed checked before broadcast
   - Invalid messages discarded silently, not broadcast

5. **LMDB for persistent state** (`server.ts` lines 84-91)
   - Two databases: graffiti, bans
   - Loaded on startup
   - Immediate write on new splat (atomic per record)

6. **localStorage for client-side state** (`club-persistence.ts`)
   - Character customization, video state, camera position
   - Restored on page load

7. **Motion packet structure: int16 positions with scale factor** (`protocol.ts`)
   - Position scale: 100 (1m = 100 units)
   - Height, keys, angle, mode in 16 total bytes

8. **Heartbeat resync every 10 seconds** (`server.ts` line 1080+)
   - Guards against packet loss during client motion
   - Full room state re-sent to all clients

---

## 3. Neon Circuit Mapping to Hallucinate Architecture

### Arcade Floor (Main Floor / Level 1)

**Concept:** Single playable zone with 3-4 cabinets, prize counter, avatar customization UI.

**Mapping:**
- Use Hallucinate's **room 1 (inside)** as the arcade floor
- No need for multiple rooms in v0 (v1+ adds Retro Alley, Hyper Court, etc. as new rooms)
- Floor layout: Keep as fixed 3D scene in `src/` (models, layout already exist)
- Interaction range: Adopt Hallucinate's collision-distance pattern (e.g., `playerRadius + cabinets`)
- Avatar rendering: Reuse existing character mesh + style system

### Arcade Cabinets

**Concept:** Interactive 3D objects representing game machines (Pulse Tap, Claw Drop, Neon Hoops, Circuit Racer).

**Mapping:**
- Treat cabinets like beach balls: 3D objects with position + state in-memory
  - `type Cabinet = { id: number, position: Vec3, game: GameType, occupiedBy?: string }`
- **Server state:** Array of cabinets, occupancy tracking, interaction validation
- **Client state:** Visual representation (3D mesh), interaction prompt ("Press E to Play")
- **Persistence:** NOT persistent (reset on server restart); OK for v0
- **Synchronization:** 
  - Occupancy change → `C_CABINET_OCCUPIED` message (new type)
  - Server broadcasts cabinet state on join via extended `S_ROOM_STATE`

### Interaction Range / "Press E"

**Concept:** Player near cabinet → interaction prompt appears → E key starts game.

**Mapping:**
- Existing pattern: beach ball collision detection (`hitBeachBalls`, line 47-78 in beach-balls.ts)
  - Collision radius: `beachBallRadius + playerRadius`
  - Adapt for cabinets: `cabinetRadius + playerRadius` (e.g., 0.5m cabinet, 0.3m player = 0.8m range)
- Client-side: Raycast/distance check → show/hide interaction prompt
- Server-side: No validation needed for prompt (client-driven); only validate on game start

### Machine Occupancy

**Concept:** Player starts a game → cabinet is "busy" for that player's session.

**Mapping:**
- **Server model:** `Cabinet.occupiedBy: string | null` (player ID or null)
- **Message types:**
  - `C_CABINET_START` (new) — client sends cabinet ID; server validates range, locks cabinet
  - `S_CABINET_OCCUPIED` (new) — broadcast to room: cabinet ID + player name
  - `C_CABINET_RELEASE` (new) — on game end; server unlocks
- **Authority:** Server-authoritative; must validate that player is in range (prevent spoofing)
- **Conflict:** If two players try to start same cabinet simultaneously, server picks first received (timestamp)

### Game Session (Pulse Tap)

**Concept:** 20-second mini-game: tap nodes, earn score, get payout.

**Mapping:**
- **Server state:** `type GameSession = { playerId, cabinetId, screen: 'start'|'play'|'end', time, score, combo, bestCombo, hits, liveNodes }`
- **Client state:** Game board rendering, input handling (3×3 grid tap detection)
- **Synchronization:**
  - Start: `C_GAME_START` (cabinet ID) → server creates session, broadcasts `S_GAME_START` to room
  - Play: Local input on client, no server communication (client-side board state)
  - Every 1-2s: `C_GAME_SCORE_UPDATE` (score, combo, hits) → server validates, caches for results
  - End: On timeout or user exit → `C_GAME_END` → server calculates payout, saves session, broadcasts result
- **Authority:** Client drives board state (taps); server validates score progress (anti-cheat: cap combo, punish impossible scores)
- **Latency tolerance:** Game is turn-based (node spawn at fixed intervals), not real-time; OK to run client-side

### Ticket Balance

**Concept:** Server-authoritative currency; players earn on game end, spend on prizes.

**Mapping:**
- **Server state:** `Client.tickets: number` (in-memory during session; persisted after redemption)
- **Persistence:** Save to LMDB on redemption (new DB: `ticketsDb`); load on session init
- **Device identity:** Use existing Hallucinate pattern: IP-based + session cookie (client generates anonymous player ID)
  - Alternative: localStorage device token (less robust to IP changes)
- **Messages:**
  - `C_GAME_END` payload includes final score
  - `S_TICKETS_AWARDED` (new) — broadcast to room: player name + ticket delta
  - `C_PRIZE_REDEEM` (new) — client sends prize ID; server deducts tickets, broadcasts

### Prize Redemption

**Concept:** Player spends tickets for cosmetics (avatars, accessories) or physical rewards.

**Mapping:**
- **Server state:** `type Prize = { id, name, cost: number, available: boolean }`
  - Catalog: hardcoded array (no need for dynamic DB in v0)
- **Persistence:** Track redemptions in new DB: `redemptionsDb = open<Redemption>({ path: '...redemptions.lmdb' })`
  - `type Redemption = { id, prizeId, playerId, timestamp }`
  - On session init: query all redemptions for this player ID (cosmetics unlocked)
- **Messages:**
  - `C_PRIZE_REDEEM` → server validates (cost ≤ balance, prize exists)
  - On success: deduct tickets, save redemption, broadcast `S_PRIZE_REDEEMED`
  - On failure: send error message

### Emotes

**Concept:** Wave, celebrate, high-five, dance.

**Mapping:**
- Extend existing `CharacterMode` enum to include: `'wave' | 'celebrate' | 'dance'` (already present)
- Add explicit emote message: `C_EMOTE` (new) — player sends emote type
- Server broadcasts `S_EMOTE` to room: player ID + emote
- Lifespan: 1-2s animation, no persistence

### Avatar Customization

**Concept:** Color, hair, accessories.

**Mapping:**
- Reuse existing `PlayerStyle` (already in motion packet)
- Add customization UI overlay (same approach as graffiti spray tool)
- Persist to localStorage + optional LMDB for cosmetics purchased (redeemed prizes)
- Sync: Motion packet already carries style; no extra message needed

### Nearby-Player Presence

**Concept:** List of players in same room + their status.

**Mapping:**
- Existing: `S_ROOM_STATE` (message type 2) on room join
  - Includes all players + their style/mode
- Extend: Include status field in player entry
  - `status: 'idle' | 'playing' | 'redeeming'`
  - Set based on `GameSession` existence
- Client-side: Render presence panel from room state

---

## 4. Protocol Extension Plan

### New Message Types (proposed, not implemented yet)

**Client → Server:**

| Type | Name | Payload | Purpose |
|------|------|---------|---------|
| 16 | `C_CABINET_START` | cabinetId: uint8 | Initiate game on cabinet |
| 17 | `C_GAME_SCORE_UPDATE` | gameId: uint32, score: uint16, combo: uint8, hits: uint16 | Periodic score sync |
| 18 | `C_GAME_END` | gameId: uint32, finalScore: uint16, bestCombo: uint8, hits: uint16 | End game session |
| 19 | `C_CABINET_RELEASE` | cabinetId: uint8 | Release cabinet lock |
| 20 | `C_PRIZE_REDEEM` | prizeId: uint8 | Spend tickets |
| 21 | `C_EMOTE` | emoteIndex: uint8 | Send emote to room |

**Server → Client:**

| Type | Name | Payload | Purpose |
|------|------|---------|---------|
| 22 | `S_CABINET_OCCUPIED` | cabinetId: uint8, playerName: string, occupiedBy: string \| null | Cabinet state |
| 23 | `S_GAME_START` | gameId: uint32, cabinetId: uint8, playerName: string | Game started in room |
| 24 | `S_TICKETS_AWARDED` | playerId: string, delta: int16, newBalance: uint32 | Payout notification |
| 25 | `S_GAME_END` | gameId: uint32, playerName: string, finalScore: uint16, ticketsDelta: int16 | Results |
| 26 | `S_PRIZE_REDEEMED` | playerId: string, prizeId: uint8, playerName: string | Redemption broadcast |
| 27 | `S_EMOTE` | playerId: string, emoteIndex: uint8 | Emote action in room |

**Backwards Compatibility:**
- Protocol version incremented from 20 → 21
- Old clients (v20) disconnected on handshake

---

## 5. Persistence Plan

### What Goes Where

**Server-Side (LMDB, loaded on startup):**
1. **Ticket balances** (new DB)
   - Key: `playerId` (anonymous device token)
   - Value: `{ balance: number, lastUpdated: timestamp }`
   - Loaded on session init; updated immediately on redemption
   
2. **Redemptions** (new DB)
   - Key: auto-increment ID
   - Value: `{ id, playerId, prizeId, timestamp }`
   - Used to determine which cosmetics are unlocked for a player
   
3. **Graffiti** (existing DB, unchanged)
4. **Bans** (existing DB, unchanged)

**Client-Side (localStorage, per device):**
1. **Anonymous player ID** — generated once, persists across sessions
   - Key: `neon-arcade-player-id`
   - Value: UUID or `Player_<random>`
   
2. **Avatar customization** (already persists)
   - Key: `clubState.playerStyle`
   - Value: top, bottom, hair, hairColor, skin, accessory indices
   
3. **Redeemed cosmetics** (mirror of server)
   - Key: `neon-arcade-cosmetics`
   - Value: array of prizeIds player owns

**Ephemeral Only (Not Persisted):**
- Player positions (reset on server restart)
- Beach ball physics state
- Active game sessions (in-memory during play, results saved after)
- Occupancy locks (reset on restart)
- Chat messages

### Device Identity Without Login

**Pattern:** IP-based + localStorage token

1. Client generates anonymous player ID on first load:
   ```typescript
   let playerId = localStorage.getItem('neon-arcade-player-id')
   if (!playerId) {
     playerId = `Player_${Math.random().toString(36).slice(2, 9)}`
     localStorage.setItem('neon-arcade-player-id', playerId)
   }
   ```

2. On server session init:
   ```typescript
   const client: Client = {
     socket,
     ip: getClientIp(request),
     playerId: messageData.playerId,  // from handshake
     tickets: await loadTickets(playerId),
     room: null,
     ...
   }
   ```

3. Fallback: If localStorage cleared or new device, IP + random suffix serves as identity.

---

## 6. File-Change Forecast

### Likely Modifications (no changes yet)

**Server-Side (`server.ts` and new files):**
- `server.ts` — extend message router for new types (16-27), add cabinet/game session logic
- `src/protocol.ts` — add encoding/decoding for new message types
- `src/cabinets.ts` (new) — cabinet data structure, occupancy state
- `src/games.ts` (new) — game session management (Pulse Tap logic, scoring, payout)
- `src/tickets.ts` (new) — ticket balance, LMDB integration
- `src/prizes.ts` (new) — prize catalog, redemption logic
- `src/arcade-persistence.ts` (new) — LMDB wrappers (tickets, redemptions)

**Client-Side:**
- `src/club-app.ts` — arcade scene management, cabinet mesh loading
- `src/multiplayer.ts` — new message handlers for cabinet/game/tickets/emotes
- `src/ui/` (new) — overlay UI for interaction prompt, game board (Pulse Tap), prize counter, emote wheel
- `src/arcade/` (new) — cabinet model, game rendering, UI state

**Build:**
- `package.json` — no new dependencies expected (reuse Vite, Bun, LMDB)
- `vite.config.ts` — possible adjustments for larger bundle size (UI assets)
- `tsconfig.json` — no changes

**Data:**
- `data/tickets.lmdb` (new) — ticket balances
- `data/redemptions.lmdb` (new) — redemption history

---

## 7. MVP Sequencing (Safe Implementation Order)

### Phase 1a: Foundation (Server + Protocol)
1. **Add cabinet model** — in-memory array, no sync yet
   - File: `src/cabinets.ts`
   - Structure: `{ id, position, gameType, occupiedBy }`
   - Time: 0.5 day

2. **Extend protocol** — add message types 16-19 (cabinet start/release)
   - File: `src/protocol.ts` + `server.ts` message router
   - Start/release validation only, no game logic
   - Time: 0.5 day

3. **Render cabinets** — load 3D models, position on floor
   - File: `src/club-app.ts` + model asset loading
   - No interaction yet; just static meshes
   - Time: 1 day

### Phase 1b: Interaction (Cabinet → Game)
4. **Interaction prompt** — "Press E to Play" when player near cabinet
   - File: `src/ui/interaction-prompt.tsx` or `src/ui.ts`
   - Client-side distance check, prompt render
   - Time: 0.5 day

5. **Cabinet locking** — `C_CABINET_START` → `S_CABINET_OCCUPIED` broadcast
   - File: `server.ts` (lock logic), `src/cabinets.ts` (state)
   - Prevent simultaneous starts; server authority
   - Time: 1 day

6. **Game session init** — `C_GAME_START` creates session, broadcasts to room
   - File: `src/games.ts`, `server.ts`
   - Session state in memory only
   - Time: 1 day

### Phase 1c: First Game (Pulse Tap)
7. **Pulse Tap board** — 3×3 grid, node spawn, tap detection
   - File: `src/games/pulse-tap.ts` (game logic) + `src/ui/game-board.tsx`
   - Client-side loop (no server communication during play)
   - Time: 2 days

8. **Score validation & payout** — `C_GAME_END` → score capping, payout calculation
   - File: `src/games.ts` (payout formula), `server.ts`
   - Validation: combo ≤ 9, score ≤ reasonable ceiling
   - Time: 1 day

### Phase 1d: Economy (Tickets + Prizes)
9. **Ticket balance** — LMDB persistence, `S_TICKETS_AWARDED` broadcast
   - File: `src/tickets.ts`, `src/arcade-persistence.ts`
   - Load on session init, save on award
   - Time: 1 day

10. **Prize counter UI** — list prizes, locked/unlocked state, redeem button
    - File: `src/ui/prize-counter.tsx`
    - Client-side: query redeemed prizes from localStorage
    - Time: 1 day

11. **Prize redemption** — `C_PRIZE_REDEEM` → verify balance, persist, broadcast
    - File: `src/prizes.ts`, `server.ts`
    - LMDB write on redemption
    - Time: 1 day

### Phase 1e: Polish (Avatar + Emotes + Presence)
12. **Emote messages** — `C_EMOTE` → `S_EMOTE` broadcast
    - File: `server.ts` + `src/protocol.ts`
    - Reuse existing mode system; no new asset load
    - Time: 0.5 day

13. **Avatar customization UI** — color/hair/accessory picker overlay
    - File: `src/ui/avatar-customizer.tsx`
    - Persist to localStorage
    - Time: 1 day

14. **Presence panel** — list players in room + status
    - File: `src/ui/presence-panel.tsx`
    - Parse `S_ROOM_STATE`; no new protocol needed
    - Time: 0.5 day

### Total Estimated Time (Conservative)
- Phase 1a: 1 day
- Phase 1b: 2 days
- Phase 1c: 3 days
- Phase 1d: 3 days
- Phase 1e: 2 days
- **Total: ~11 days (1.5 weeks, with buffer)**

**Risk Mitigation:**
- Complete 1a + 1b before touching game loop (ensures cabinet model works)
- Test cabinet locking thoroughly before Phase 1c (anti-cheat foundation)
- Use mock payout formula until Phase 1d is complete

---

## 8. Risks & Unknowns

### Binary Protocol Complexity
**Risk:** Adding 12 new message types (16-27) increases encoding/decoding surface area.  
**Mitigation:**
- Encode/decode functions are template-driven in protocol.ts; easy to generate
- Test new types in isolation before integration
- Version bump (20 → 21) allows old clients to reconnect gracefully

### Ticket Fraud Prevention
**Risk:** Client-side score submission is unvalidated; client could claim high score → large payout.  
**Mitigation:**
- Server validates score sanity:
  - Combo capped at 9 (client-side enforced; server rejects if violated)
  - Score capped at reasonable max (e.g., 20 seconds × 10 pt/s × 9 combo = 1800 max)
  - Payout formula: `clamp(score / 12, min, max)` (not arbitrary)
  - Reject scores that imply impossible speed (e.g., node hit every 50ms on 3×3 grid)
- Log suspicious submissions for audit
- **Not required for v0:** Server-side physics validation (too complex initially)

### Server-Authoritative Game Scoring
**Risk:** 20-second round is played entirely client-side; if client disconnects, game state is lost.  
**Mitigation:**
- Acceptable for v0 (non-competitive, casual play)
- Score updates sent every 2-5s via `C_GAME_SCORE_UPDATE` as backup
- If disconnect before end, game result lost (same as current web game behavior)
- Future: Add server-side board state validation (Phase 2+)

### Multiplayer Mini-Game Synchronization
**Risk:** Later zones will have 2-player cabinets (e.g., Puck Clash, Gravity Pong); client-side physics will diverge.  
**Mitigation:**
- v0 is single-player only (Pulse Tap, Claw Drop, Neon Hoops solo)
- v2 (later) introduces multiplayer; design server-side physics then (not now)
- Plan: Use Hallucinate's beach-ball authority model as template

### Mobile Controls
**Risk:** Current Hallucinate has keyboard/mouse input; arcade needs touch-friendly controls.  
**Mitigation:**
- Pulse Tap is already tap-based (3×3 grid); naturally touch-friendly
- Emotes: button UI on-screen (no keyboard needed)
- Movement: keep WASD; add virtual joystick for mobile
- **Not needed for v0:** Full gesture support (swipe, pinch, etc.)

### Persistence Without Login
**Risk:** Player loses device token (localStorage cleared) → loses ticket history.  
**Mitigation:**
- Acceptable trade-off for v0 (no-login mandate; no auth server)
- IP-based fallback (server tracks IP + anonymous ID)
- **Future (v2+):** Optional "save code" system (player gets printable code to recover on new device)

### Occupancy Race Condition
**Risk:** Two clients send `C_CABINET_START` for same cabinet simultaneously.  
**Mitigation:**
- Server timestamps messages; first received wins
- Loser gets `S_CABINET_OCCUPIED` broadcast before their start completes
- Client-side: listen for broadcast, close game loop if cabinet was stolen

---

## 9. Phase 1 Recommendation

### Minimal, Reviewable MVP: "Arcade Floor + Pulse Tap"

**Scope:** Single playable game (Pulse Tap) on one cabinet, with ticket payout and basic UI.

**Must-Have:**
1. Cabinet object + occupancy lock
2. Game session + 20-second loop
3. Pulse Tap board (3×3 tap detection)
4. Score validation + payout formula
5. Ticket balance (LMDB) + award broadcast
6. Prize counter UI (locked/unlocked state, no redemption)
7. Interaction prompt

**Nice-to-Have (can defer):**
- Prize redemption (`C_PRIZE_REDEEM`)
- Emote wheel
- Avatar customization UI (persist style, but no unlock system)
- Presence panel (show other players)

**Why This Slice:**
- **Small:** 2-3 weeks of work (foundation is solid; Hallucinate patterns are proven)
- **Reviewable:** Each file change is isolated (cabinet, game, tickets, UI)
- **Unblocks:** Prize + emote system only depend on message router (already done)
- **Risk-safe:** No multiplayer sync, no physics validation, no anti-cheat complexity
- **Demo-ready:** Playable, fun, ticket economy visible

**Files Modified:**
- `server.ts` (+~300 lines for new messages, cabinet/game state)
- `src/protocol.ts` (+~100 lines for new message types)
- `src/cabinets.ts` (new, ~100 lines)
- `src/games.ts` (new, ~200 lines for Pulse Tap logic)
- `src/tickets.ts` (new, ~150 lines for LMDB + balance)
- `src/arcade-persistence.ts` (new, ~100 lines)
- `src/club-app.ts` (+~50 lines for cabinet scene)
- `src/ui/game-board.tsx` (new, ~300 lines for Pulse Tap UI)
- `src/ui/interaction-prompt.tsx` (new, ~100 lines)
- `src/ui/prize-counter.tsx` (new, ~200 lines, locked-only)

**Total Additions:** ~1500 lines new code, ~500 lines modified existing.

**Testing:** Manual play-through:
1. Walk to cabinet → see "Press E"
2. Press E → game starts, countdown begins
3. Tap nodes for 20 seconds → score accumulates
4. Game ends → see payout + ticket balance update
5. See prize counter with locked prizes

---

## SUMMARY

| Question | Answer |
|----------|--------|
| **Can we extend Hallucinate without rewriting?** | Yes. Message router, LMDB, room model, and motion sync are stable. Add new message types in-line. |
| **How do cabinets fit?** | Like beach balls: 3D object with server state, client sync, occupancy tracking. |
| **Where do tickets live?** | Server LMDB (persisted), client localStorage (cosmetics). |
| **How do we prevent cheating?** | Server-side score validation: combo cap, payout clamping, sanity checks. |
| **What's the minimum MVP?** | One cabinet, one game (Pulse Tap), ticket payout, prize counter UI. |
| **How long?** | ~2-3 weeks (Phase 1a + 1b + 1c + partial 1d). |
| **What's unknowable now?** | Multiplayer sync complexity (v2), touch UX polish, server-side game physics (defer to Phase 2). |

---

**Next Phase:** Phase 1 Implementation (after stakeholder approval of this architecture mapping).
