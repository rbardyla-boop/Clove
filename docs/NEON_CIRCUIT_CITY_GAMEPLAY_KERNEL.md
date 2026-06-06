# Neon Circuit — City Gameplay Kernel

**Status:** charter / specification. **Plan-only — describes the foundation; implements nothing.**
**Parent:** `docs/NEON_CIRCUIT_GAMEPLAY_CHARTER.md` (this doc expands Section 8–10 of the charter).

The **kernel** is the small set of foundational systems all future gameplay sits on. This document fixes,
for each system, the boundary that must never blur:

- **Client-owned display** — what the client may predict, render, animate, or remember for UX. Never
  canonical.
- **Server-owned truth** — what only the server may decide. The single source of authority.
- **Data model** — the canonical shape and the public-safe projection.
- **Latency risk** — where round-trips hurt, and the accepted mitigation.
- **Cheat risk** — what a malicious client could attempt, and why it fails.
- **Scale risk** — what breaks as players/blocks/packages grow.
- **Validation requirement** — what must be tested/enforced before the system is trusted.

**The kernel rule (binding):** *display may be predicted on the client; truth is always the server's,
projected through a fixed allowlist; the client may request and display but never author a canonical
fact.* Every row below is an instance of this rule. A Phase 7+ feature that cannot be expressed within
these rows needs a charter ADR before it is built — not a workaround.

Authority anchors (already implemented):

- **`CityRoom` DO** — per-block authority, one per block via `idFromName(cityId)`; owns position,
  membership, collision, portal gate, per-block event log, instanced Block Trial. Never touches arcade
  economy / `RoomRegistry`.
- **`CityRegistry` DO** — cross-block presence coordinator; DO-to-DO only; never client-reachable.
- **Pure cores** under `arcade/city/*.mjs` (movement, district, presence, activity, events, …) shared
  verbatim by the DO and a Node dev-shim, so headless tests exercise the same authority code.

> **Shipped vs. specified-for-build.** Rows 1–5 and 7–13 describe **verified-shipped** authority. Row 6
> (interaction zones) and the 7C objective authority are **Phase 7A targets — NOT yet implemented**
> (today `workers/arcade/src/city-room.ts` has no zone/objective message case). Their request/result
> message shapes are **proposed** Phase-7 wire surface subject to the `AUTHORIZED: IMPLEMENT PHASE 7A`
> gate, not existing contracts. They are specified here so Phase 7 builds *to* a written boundary.

---

## 1. Movement

- **Client-owned display.** Input capture (`dx, dy`), local prediction of own avatar, input-replay
  reconciliation from the last server-acked `seq`, eased correction, remote-avatar interpolation from
  buffered snapshots. All visual.
- **Server-owned truth.** Every accepted position. The server runs the single shared movement step
  (`predictStep`) from its own canonical state with `dt = clamp(min(clientDt, serverElapsed), 0,
  MAX_DT_MS)` and a speed clamp. (`arcade/city/city-block.mjs`, `city-reconcile.mjs`, `city-snapshots.mjs`.)
- **Data model.** Inbound: `{ dx, dy, seq, ts }` intent only. Outbound: canonical snapshot with self
  `seq` (the ack) + public positions. **No** message carries an absolute position, velocity, reward, or
  inventory.
- **Latency risk.** Perceived input lag → mitigated by client prediction + replay; corrections are eased
  and only snap past a threshold.
- **Cheat risk.** Teleport / speed-hack / position injection → impossible: the client cannot send a
  position, and the clamped server-clock `dt` means a lying `clientDt` can never exceed real elapsed
  time.
- **Scale risk.** Snapshot fan-out cost per block grows with occupancy → bounded by per-block DO
  sharding and snapshot cadence; revisit interest-management only if a single block's occupancy grows
  large.
- **Validation requirement.** Unit tests on the pure step (determinism, clamp, collision); a no-speed-hack
  test (inflated `clientDt` rejected); two-client browser smoke that remotes interpolate.

---

## 2. Collision

- **Client-owned display.** Rendering the layout; optional local collision *prediction* so prediction
  matches the server.
- **Server-owned truth.** The authoritative collision result inside `predictStep` — the accepted
  position is always post-collision on the server.
- **Data model.** A static, server-known block layout (walkable area, obstacles, portal cells). Phase 7B
  formalizes walkable-block boundaries; geometry stays **byte-identical across blocks** (per-block
  identity is labels/style only — proven by a Phase 5B test) so collision authority is shared.
- **Latency risk.** None beyond movement; collision is part of the same authoritative step.
- **Cheat risk.** Walking through walls / out of bounds → rejected server-side; a client that renders
  itself out of bounds is corrected on the next snapshot.
- **Scale risk.** More elaborate per-block collision (Phase 7B) must not diverge geometry between blocks
  or it breaks shared authority and per-block identity guarantees.
- **Validation requirement.** Pure collision tests (clamp into walkable area, obstacle rejection); a test
  asserting per-block geometry/portals/spawns stay byte-identical while only labels/style differ.

---

## 3. Routing (block-to-block)

- **Client-owned display.** The District panel (current + adjacent blocks), a "Travel" affordance, route
  status text. Choosing a target is a *request*.
- **Server-owned truth.** Route validity. The route **source** is the server-owned `boundCityId`; the
  **target** is untrusted and validated by `validateRouteRequest` (sanitize → known → adjacent →
  not-self). A route result authorizes only a reconnect; it does not move the player. (`city-district.mjs`.)
- **Data model.** `city_route_request{ target }` → `city_route_result{ ok, reason }`; adjacency from the
  static manifest (`ADJACENCY`, a 4-ring after Phase 6D). Public-safe block summaries carry no private
  data.
- **Latency risk.** Travel involves a reconnect to the target block's DO → acceptable (deliberate
  transition); covered by a "routing/arrival" UX state.
- **Cheat risk.** Forged cross-block membership → impossible: a route is a *confirmation only*; the
  target `CityRoom` admits the reconnecting client under its own authority. A non-adjacent or unknown
  target is rejected (`not_adjacent` / unknown).
- **Scale risk.** Adjacency is static config; growing to many blocks/districts means the manifest and
  adjacency graph must stay declarative and bounded (don't broadcast the full graph if it grows large).
- **Validation requirement.** Pure tests for every adjacency edge + rejection of non-adjacent/self/unknown
  routes; a district browser smoke that a blocked route leaves the player in place.

---

## 4. Block arrival

- **Client-owned display.** The arrival transition, "Arrived in <Block>" feed entry, refreshed labels/
  style for the new block.
- **Server-owned truth.** Membership in the arrived block — established when the client reconnects
  (`switchCity`) and the target `CityRoom` welcomes it; a cold DO seeds its **own** identity (the
  `boundCityId` is bound from the route *before* `ensureInitialized()`).
- **Data model.** `city_welcome` carries `publicLayout(cityId)` (labels over shared geometry) + schema
  version; arrival seeds exactly one activity item (decoupled from feed-emptiness via a `seededArrival`
  flag).
- **Latency risk.** Reconnect handshake cost → masked by the routing/arrival UX state; the WS subprotocol
  bug that aborted handshakes was fixed (PR #25).
- **Cheat risk.** Arriving in a block you were not routed to / spoofing identity → the target DO is the
  authority; identity is seeded server-side per block, not from the client.
- **Scale risk.** Cold-DO seed ordering must remain correct as blocks multiply; the seed must be O(1) per
  block, not a scan.
- **Validation requirement.** A travel-identity smoke (style + labels change across downtown→harbor→
  skyline) and a cold-DO seed test (harbor/skyline seed their own identity, not downtown's).

---

## 5. Presence

- **Client-owned display.** The live "N here" counts, a connection-based live/refresh/offline indicator,
  merged manifest after a delta.
- **Server-owned truth.** Per-block occupancy. `CityRoom` reports to `CityRegistry` on join/leave/alarm;
  `CityRegistry` holds the count + a registry-stamped freshness timestamp and is the cross-block
  authority. (`city-district-presence.mjs`, `city-registry.ts`.)
- **Data model.** Push delta `t:"city_district_presence"` re-projected through a
  `{ city_id, population, health, population_is_estimated }` allowlist — the public-safety choke point.
  Population is a **public aggregate** (like the arcade `RoomRegistry`), never a player list or identity.
- **Latency risk.** Cross-block changes surface within one ~30s alarm tick (the keepalive cadence);
  same-block join/leave deltas are immediate. Lowering cross-block latency would need registry→CityRoom
  reverse calls — deliberately out of scope.
- **Cheat risk.** Injecting presence / reading private presence → the delta is **outbound-only** (a
  client that sends it hits `unknown_type`); the projection can expose nothing the manifest cannot;
  health policy evicts stale counts so there are no "ghost" players.
- **Scale risk.** A single coordinator DO fronting all district clients would be a bottleneck — avoided
  by keeping `CityRegistry` DO-to-DO and pushing over per-block sockets. Many blocks → keep the heartbeat
  payload bounded and the freshness sweep O(blocks). This is the one stated-but-unbounded growth axis in
  the authority model. **Revisit trigger:** shard the registry / add presence interest-management when
  block count exceeds a set threshold or a single registry alarm sweep exceeds its time budget (Phase 8+
  map growth and CF-5 compositions are the events that approach this).
- **Validation requirement.** Two-client cross-block presence smoke (downtown sees harbor's count, drops
  to 0 on leave, public-safe); a push-without-polling test; a "no private data in the delta" assertion.

---

## 6. Interaction zones (Phase 7A — kernel addition)

- **Client-owned display.** An **action prompt** ("Enter arcade", "Read board") shown when the local
  prediction places the avatar inside a zone; prompt styling and the button.
- **Server-owned truth.** Whether the player is *actually* in the zone (tested against the canonical
  position) and whether the action's precondition holds. The prompt being visible does **not** authorize
  the action.
- **Data model.** Static, server-defined zones per block (id, region, action kind) sent as public layout
  data; an action *request* references a zone id; the server validates position-in-zone before emitting a
  result. **No** trusted "I did action X" message.
- **Latency risk.** A prompt may appear slightly before/after the server agrees at a zone edge → cosmetic;
  the *action* is server-gated so an early prompt cannot produce an early effect.
- **Cheat risk.** Triggering an action from outside the zone → rejected: the server re-checks the
  canonical position against the zone; the client cannot assert its own position.
- **Scale risk.** Zone count per block must stay small and static (config, not dynamic spawns) so the
  per-input zone test stays O(zones).
- **Validation requirement.** Pure tests: position-in-zone true/false, action rejected when outside zone,
  unknown zone id rejected; a browser smoke that the prompt appears in-zone and the action only resolves
  when the server confirms.

---

## 7. Arcade entry / return

- **Client-owned display.** The "entering arcade interior" overlay, the same-origin iframe to `/arcade/`,
  the close/return-to-city transition.
- **Server-owned truth.** Portal eligibility — the server is the sole authority on whether a portal may
  open (it confirms the request and emits `city_portal_ok` / a rejection). The arcade interior runs
  **isolated** (no postMessage authority mixing); arcade economy stays in `ArcadeRoom`/`RoomRegistry`,
  untouched.
- **Data model.** `city_portal_enter_request` / `city_portal_close_request` → server-confirmed result; the
  interior is an iframe overlay, not an authority bridge.
- **Latency risk.** Portal confirmation round-trip → masked by the deliberate "entering" overlay; Phase 7D
  polishes entry/return feel without changing authority.
- **Cheat risk.** Forcing entry / mixing city and arcade authority → the server gates eligibility and the
  iframe is isolated; the city DO never reads/writes arcade occupancy/tickets.
- **Scale risk.** Many concurrent interiors are just iframes on each client — no server cost beyond the
  existing arcade rooms; arcade scaling is the arcade's own (already-sharded) concern.
- **Validation requirement.** A portal smoke (server-confirmed entry, rejected feedback, return to city);
  a regression that arcade two-client/frame-contract behavior is unchanged by city entry/return.

---

## 8. District events

- **Client-owned display.** The event banner/card, active/pre-roll state, a live `m:ss` countdown
  (1s ticker that updates only text nodes), "Up next" — all display.
- **Server-owned truth.** The event schedule snapshot: `CityRoom` attaches
  `event: districtEventSnapshot(now, config)` to its `city_blocks` sends; the config is operator-tunable
  via env and clamped server-side. (`city-district-events.mjs`.)
- **Data model.** Public-safe `{ enabled, window_ms, show_next, server_time, current, next }`; events
  built through a field allowlist (`public_safe: true`, only a static block name interpolated);
  deterministic `(type, focus block)` per window index.
- **Latency risk.** None meaningful — clients compute live current/next from the shared deterministic
  schedule + published config; the countdown is local.
- **Cheat risk.** Authoring/forging an event → events are server-authored and display-only; a client
  cannot inject one, and an injected one would carry no authority (nothing canonical reads the feed back).
- **Scale risk.** More event *types* or per-block flavor must stay deterministic + bounded; do not turn
  events into a push storm (the snapshot rides the existing `city_blocks` payload).
- **Validation requirement.** Pure schedule tests (deterministic window/id, public-safe fields, bounded
  announcements, witnessed "ended"); a server-snapshot smoke; copy assertions: **no economy/ownership/
  gambling vocabulary**.

---

## 9. Public activity feed

- **Client-owned display.** The entire feed — it is a **client-side display projection** of facts the
  client already receives; bounded (≤16, coalesced, newest-first), ≤8 shown, resets on reload.
- **Server-owned truth.** The underlying facts only (presence deltas, route results, arrival, district
  events). The feed itself is not canonical and is never read back.
- **Data model.** `activityItem` is a single field-allowlist projection (the public-safety choke point);
  it fails safe on unknown types and interpolates only static display names. (`city-district-activity.mjs`.)
- **Latency risk.** None — derived locally from messages already in hand.
- **Cheat risk.** A client could fabricate its *own* local feed (harmless — it is display history, not
  authority) but cannot inject a feed item into another client (no client→server feed channel).
- **Scale risk.** Bounded history keeps memory flat regardless of session length; new item *types* must go
  through the same allowlist or they are dropped.
- **Validation requirement.** Pure tests for classify/derive/coalesce/bound; assertions that unknown types
  fail safe and no private/economic data appears; a browser smoke for the feed sub-section.
- **Forward note.** The interpolated block name is safe **today** because it is static city config
  (`city-block.mjs`), not player-supplied. If CF-7 lets a player package supply a block's `display_name`,
  that value inherits the CF-8 human-review obligation before it may appear in any public feed/label —
  the surface is not permanently static.

---

## 10. Block Trial (instanced)

- **Client-owned display.** The BLOCK TRIAL panel, a 2D signal-node overlay tinted with the (copied)
  block style accent.
- **Server-owned truth.** The trial lifecycle and score. One **ephemeral, in-memory** trial per block
  inside `CityRoom` (`this.trial`; not persisted, no new DO/migration). It latches signal nodes from
  **server-validated** member positions, recomputes a bounded score whose ceiling **equals the node
  count** (`SCORE_CAP = NODE_ANCHORS.length`, currently 3 — the invariant is "bounded by a fixed
  server-side node set", not the literal 3), and completes (`stabilized`/`timeout`). An active trial's
  `outcome` is always `null`, so a forged outcome cannot survive. (`city-battle-instance.mjs`.)
- **Data model.** Seven server-authored events (`city_block_trial_requested/started/joined/updated/
  completed/rejected/closed`); creation gated on `isStewardshipEligible` (Host Rank as one signal),
  rate-limited.
- **Latency risk.** Score updates ride existing movement authority; acceptable.
- **Cheat risk.** Forged score/outcome / griefing the public block → the trial reads server-validated
  positions only and **copies** a style snapshot, so it can never edit the live block (proven by a pure
  test: style byte-identical after create+step+close). Forged trial messages → `unknown_type`.
- **Scale risk.** One ephemeral trial per block bounds memory; it must remain non-persistent and
  non-destructive as it gains depth — never a save-game or an ownership stake.
- **Validation requirement.** Pure tests (latch from validated positions, bounded score, no live-block
  edit); a Block-Trial browser smoke.

---

## 11. Stewardship style layer

- **Client-owned display.** The BLOCK STEWARDSHIP editor panel (fixed options, no free text/upload/URL);
  the rendered accent via `applyBlockStyle`.
- **Server-owned truth.** The canonical block style. `CityRoom` owns it (persisted `cityStewardship`,
  hibernation-safe; no new DO/migration); `preview` never persists; `apply`/`reset` persist + broadcast.
  Eligibility = Host Rank as one signal. (`city-stewardship.mjs`.)
- **Data model.** A **closed enum manifest** (targets `arcade_front`/`street_lights`/`sidewalk_trim` ×
  palettes `cyan/magenta/amber/white` × sign variants × intensities). The sanitizer reads **only** those
  enum keys, so no css/html/js/url/text can survive into state, an event, the wire, or the renderer.
- **Latency risk.** None meaningful — apply/reset are deliberate, broadcast on change.
- **Cheat risk.** Injecting markup/script/URL via a style / griefing the public block → impossible: closed
  enum read-only sanitizer; every edit is **reversible** (reset restores the block's per-block default).
  Not ownership, not permanent, not account-bound.
- **Scale risk.** The closed manifest must stay closed as it grows richer; depth comes from **more closed
  tokens**, never free-form fields. (This is the same principle the creator pipeline scales on.)
- **Validation requirement.** Pure sanitizer tests (every non-enum field dropped); a reversibility test
  (reset → default); a stewardship browser smoke.

---

## 12. Creator package preview (local)

- **Client-owned display.** The offline editor preview rendered by the original procedural renderer
  (`iso-renderer.mjs` / CF-3 `layered-renderer.mjs`); the canonical hash and `local_validation_only`
  receipt shown in the editor.
- **Server-owned truth.** *None* — by design. Preview is **local-only and offline**; no server, no
  network, no live world. The "truth" here is the **validator's verdict**, which is deterministic and
  local.
- **Data model.** A **data-only** package whose **visual/style values are all closed-allowlist tokens**
  (block_style / block_layered / arcade), bounded in size (block_layered ≤12 KiB, arcade ≤64 KiB), no
  images/URLs/scripts; canonical JSON + SHA-256 hash. The exception is bounded **human-label text**
  (`display_name` ≤40 B, `package_id` slug, receipt `operator_note` ≤200 chars) — length-bounded and
  deny-regex-screened for markup/economy terms only, **not** allowlist-constrained and **not** screened
  for profanity/slurs/PII; these require CF-8 human review before any live use. (`arcade/creator/**`.)
- **Latency risk.** None — fully local.
- **Cheat risk.** Smuggling code/markup/URL/template, economy/NFT vocab, prototype pollution, DoS via
  counts → rejected deny-by-default by the validator (`scanSafety`, `FORBIDDEN_*`, strict key-sets,
  bounded arrays); unknown keys are rejected, never silent-dropped. A preview renders nothing that
  escapes the local page (restrictive CSP; `arcade/creator/**` excluded from the curated upload).
- **Scale risk.** Depth scales by **adding closed tokens**, not free values (CF-3 added ~65 tokens, kept
  `scale` a string enum to avoid a numeric arbitrary-value surface). The validator must stay exhaustive
  as kinds multiply.
- **Validation requirement.** The adversarial abuse checklists (CF-3 ships a 26-row one) + positive
  controls; editor browser smokes; the curated-upload exclusion test (creator tools never ship).

---

## 13. Approved package loading (gated)

- **Client-owned display.** *Nothing in the live world.* In CF-2/CF-3 the only consumer is the editor's
  **"Approved local preview"** card (operator imports package + receipt → offline render +
  "Local preview only — not authorized for live world").
- **Server-owned truth.** The trust decision. A loader trusts a package only when **all** hold:
  recomputed canonical hash == receipt `package_hash`; package valid for its kind; hash listed in the
  approved registry; both receipt and entry say `operator_approved_local`. (`approved-loader.mjs`,
  `approval-receipt.mjs`, `approved-package-registry.mjs`.)
- **Data model.** A static, local, hash-keyed **approved-package registry** (deny-by-default; empty is
  the safe default) + a hash-sealed **approval receipt** (`receipt_hash` covers the body → tamper-evident).
- **Latency risk.** None today (local). When CF-7 introduces a live loader, loading must be off the hot
  path (preload/validate before render), never a per-frame check.
- **Cheat risk.** Loading a modified/unapproved/wrong-receipt package, or reaching the live world →
  rejected: `LIVE_WORLD_LOADER_ENABLED = false` is checked first and the boundary is **double-locked**
  (`live_world_authorized: true` is itself a validation error). Every failed check returns a structured
  rejection; nothing is thrown into the live world.
- **Scale risk.** A single static registry does not scale to many authors → that is exactly what CF-6
  (Hive validation service) and CF-8 (moderation queue) generalize, **without** weakening
  deny-by-default or the human-in-the-loop-before-live rule.
- **Validation requirement.** Tests for every rejection path (`receipt_hash_mismatch`, `not_approved`,
  `missing_receipt`, `package_invalid`, `invalid_receipt`, `live_world_loader_not_enabled`,
  `receipt_not_approved`, `invalid_registry`, `unknown_loader_mode` — among the structured rejections in
  `approved-loader.mjs`); a test that a `live_world_authorized:true` receipt/entry is rejected; the
  live-world mode is rejected unconditionally.

---

## How this makes bolt-on hard

Each row above gives a Phase 7+ author a written answer to "where does truth live, and what's the attack
surface?" before they write code. The kernel therefore resists the three drift failure modes:

- **Latency bolt-on** — a feature that round-trips on the hot path is visible against the "latency risk"
  row (movement/zones already define the prediction-vs-truth split to reuse).
- **Security bolt-on** — a feature that lets the client author a canonical fact violates the kernel rule
  and the per-system "cheat risk" row; the allowlist choke points are named and reusable.
- **Moderation/scale bolt-on** — content that reaches players without validation violates rows 12–13; the
  creator pipeline (`docs/NEON_CIRCUIT_CREATOR_PIPELINE_ROADMAP.md`) is the only sanctioned path.

*This document is plan-only. It adds no gameplay, no Worker/DO code, no deploy, and no production change.*
