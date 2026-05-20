# The Operator's Deck — Systems Architecture & Operational Intelligence

**CloveLearn v3 Final Deploy**
**Classification: Internal Engineering Reference**

---

## 1. Executive Overview

The Operator's Deck (CloveLearn v3) is a privacy-sovereign, offline-first therapeutic intervention platform disguised — deliberately — as a tactical operations console. It runs entirely in the browser or as a desktop binary. It never phones home. It never stores clinical data outside the user's device. It does not require an account, a server, or a network connection after the first load.

The system combines two functionally distinct product layers:

**Layer 1 — Therapeutic Platform.** Sixteen evidence-based drill modules covering CBT, DBT, ACT, and related modalities. Step-based interactive forms with encrypted local persistence. A clinical scoring engine (PHQ-9/GAD-7 style) with behavioral distortion tracking, drift detection, and an intelligence brief generator. The user is their own clinician dashboard.

**Layer 2 — Gamified Psychological Simulation.** Singularity Inc., a fully mechanized AI-domination strategy game built on Three.js. Ten-region world simulation. Five playable archetypes. A scar-and-doctrine system that creates permanent mechanical consequences. Named civilian characters whose survival becomes a machine memory. The game is not decoration — it is a framing device: inhabiting the perspective of an optimization-driven system builds counterintuitive insight into coercion, dependency, and the fragility of institutions.

Both layers are delivered as a single Progressive Web App, deployable to Cloudflare Pages with zero build pipeline. An Electron wrapper packages the same assets for Windows, macOS, and Linux desktop distribution.

**Core design principles:**

1. Zero cloud dependency for clinical data. All therapy records, assessment scores, and behavioral logs live on the user's device, encrypted at rest with AES-256-GCM.
2. Offline-first, not offline-capable. The system assumes no network. Network access is an enhancement, never a requirement.
3. No framework. No build step. Vanilla JS, direct DOM manipulation, inline or linked static assets. Deployable by dragging a folder.
4. Separation of framing contexts. The game and the therapeutic tools are architecturally adjacent but cognitively distinct. The user is never in both modes at once.

---

## 2. High-Level Architecture

### 2.1 System Map

```
┌──────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE EDGE                              │
│  _headers (CSP, HSTS, COEP)   _redirects (/index.html→/deck.html)│
└──────────────────────────┬───────────────────────────────────────┘
                           │  HTTPS static asset delivery
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│              SERVICE WORKER  (sw.js — Cache v53)                 │
│  install: pre-cache 31 static assets                             │
│  fetch: cache-first for assets; navigate requests pass through   │
│  Night Shift: 12h background sync via PeriodicSync / Navigator.locks│
└──────────────────────────┬───────────────────────────────────────┘
                           │  Serves cached or fetched assets
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    PWA SHELL  (deck.html)                        │
│  od-core.js ── Encrypted storage layer (AES-256-GCM)            │
│  od-core.js ── Vault: JWK key in IndexedDB clove_vault           │
│  intel-engine.js ── Distortion aggregation, drift detection      │
│  op-brain.js ── Intelligence brief generation                    │
│  particle-bg.js ── Canvas background renderer                    │
└────────────────┬───────────────────┬────────────────────────────┘
                 │                   │
    ┌────────────▼──────┐   ┌────────▼───────────────────────────┐
    │  THERAPEUTIC TOOLS │   │        GAME ENGINE                 │
    │  74 HTML modules   │   │  game/main.js (4,080 lines)        │
    │  16 drill types    │   │  Three.js scene + OrbitControls    │
    │  Clinical scoring  │   │  10-region simulation              │
    │  Drill registry    │   │  5 archetypes, full turn loop      │
    └────────────┬───────┘   └────────────────────────────────────┘
                 │
    ┌────────────▼───────────────────────────────────────────────┐
    │               STORAGE LAYER                                │
    │  IndexedDB: clove_vault (encryption key)                   │
    │             clove_intel (Night Shift state, stale flag)    │
    │  localStorage: all drill data, assessments, logs           │
    │  (encrypted with keys from clove_vault)                    │
    └────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow Summary

**Therapeutic path:**
User fills drill form → od-core `odSet()` encrypts and writes to localStorage → intel-engine reads all drill keys, aggregates distortions, scores assessments → op-brain generates intelligence brief → deck.html renders brief to user.

**Game path:**
User selects archetype + directives → Three.js scene initialized → turn loop executes in memory → narrative events rendered to DOM log → game ends → end-screen autopsy displayed → nothing persisted. Game state is ephemeral by design.

**Night Shift path:**
PeriodicSync fires after 12 hours → SW checks battery (<30% aborts) → checks storage (<90% required) → acquires Navigator.lock → messages open client tabs to run foreground intel catch-up → if no tabs open, sets IndexedDB `clove_intel` stale flag → on next app open, od-core detects stale flag and triggers catch-up inline.

---

## 3. Subsystem Deep Dives

### 3.1 Deployment & Edge Layer

**What it is.** Static hosting on Cloudflare Pages. No server process. No origin server. The entire application is served from Cloudflare's edge CDN as files. The only "backend" is the browser itself.

**Why it exists.** Zero-infrastructure deployment aligns with the privacy model: no server means no server logs, no session tracking, no database to breach. Hosting is incidental to delivery. The application works the same whether served from Cloudflare or a USB stick.

**Key files:** `_headers`, `_redirects`, `manifest.json`.

**CSP design decisions.** The Content Security Policy is not boilerplate. Several non-obvious choices:

- `wasm-unsafe-eval` in script-src is required for Tesseract.js OCR and transformers.js WASM compilation. Without it, on-device OCR and ML inference are blocked.
- `COEP: credentialless` is the carefully chosen relaxation that allows blob: URL workers (transformers.js imports its ONNX runtime as a dynamically generated blob worker) without requiring full `require-corp` on every asset. The `/intelligence-ops.html` override sets `COEP: unsafe-none` specifically because that page's transformers.js usage requires dynamic blob: imports that credentialless still blocks.
- `connect-src` includes HuggingFace CDN endpoints specifically for the transformers.js ONNX model download path. It also includes Spotify's API and CDN for music-ops integration.
- `worker-src 'self' blob:` covers both the registered Service Worker and the inline web workers spawned by Tesseract and transformers.js.

**Cache strategy rationale.** The strategy is tuned to a zero-build deployment:

| Resource type | Cache-Control | Why |
|---|---|---|
| `*.js`, `*.png`, `favicon.ico` | `max-age=31536000, immutable` | Static assets never change at the same URL; immutable signals no conditional revalidation needed |
| HTML pages | `max-age=3600, s-maxage=86400` | Pages may update; browser caches 1h, Cloudflare edge holds up to 1 day with stale-while-revalidate |
| `sw.js` | `no-cache` | Service Worker changes must be detected immediately; stale SW means stale cache version |
| `manifest.json` | `max-age=604800` | PWA manifest rarely changes; 7-day cache acceptable |

**Redirect.** `/index.html → /deck.html 302` exists because the start_url in manifest.json is `/` and deck.html is the actual application hub. The original index.html is a splash/navigation landing page. The redirect ensures installed PWA instances land in the right place.

**What breaks if it fails.** Cloudflare outage → users with cached SW assets continue operating offline. Drill data writes and reads continue normally. Games run from cache. The system degrades to fully offline with no feature loss for users who have previously loaded the app.

---

### 3.2 Service Worker & Offline Architecture

**What it is.** `sw.js`, versioned `operators-deck-v53`. A cache-first offline service worker with a background intelligence sync mechanism (Night Shift).

**Why it exists.** The application must function on an airplane, in a facility without Wi-Fi, or during a crisis where network access is unavailable. The service worker is the contract that makes this possible.

**Install phase.** Pre-caches 31 static assets: core JS modules (od-core, intel-engine, op-brain, particle-bg, voice-engine, intel-engine), icon PNGs, policy JSON files (VAC, French), anchor module scripts, semantic embeddings. This is the minimal set required for full therapeutic functionality. The game assets and HTML pages are not pre-cached — they load from network on first visit and are then held by the browser's HTTP cache (via the 1-hour max-age header), not the SW cache.

**Fetch handler design.** The navigate request passthrough is the most important architectural decision in the SW:

```
if (request.mode === 'navigate') {
  return fetch(request);   // pass through, do NOT cache
}
```

This was added to avoid a known Cloudflare Pages / Service Worker interaction bug: when the SW intercepts navigate requests and the edge issues a redirect (as happens with `/ → /deck.html`), some browsers follow the redirect inside the SW context but then the response is opaque or cross-origin, causing the cached response to be un-servable. The fix is to let navigate requests go directly to the browser's network stack, which handles redirects natively. HTML freshness is managed by HTTP cache headers, not the SW.

**Night Shift.** A periodic background intelligence sync registered via the PeriodicSync API. Three safety gates before execution:

1. Battery gate: `navigator.getBattery()` → abort if battery level < 0.30 and not charging. Prevents draining a low battery on background work.
2. Storage gate: `navigator.storage.estimate()` → abort if usage/quota > 0.90. Prevents writing to a full device.
3. Concurrency gate: `navigator.locks.request('night_shift_run', ...)` → prevents overlapping runs if PeriodicSync fires unexpectedly soon.

When gates pass: SW sends message to all open client tabs to run foreground intel aggregation (where the full od-core encryption API is accessible). If no tabs are open, it writes a stale flag to IndexedDB `clove_intel`. On next app open, od-core detects the flag and triggers catch-up inline.

**What breaks if it fails.** SW failure (update error, parse error in sw.js) degrades the app to a standard web page with HTTP-cached assets. All drill functionality remains operational via direct localStorage and IndexedDB access in od-core.js. The app never depends on the SW being present — it enhances caching and enables background sync, but falls back gracefully.

---

### 3.3 PWA Shell & od-core.js

**What it is.** `od-core.js` is the foundational utility library loaded on every page. It provides the encrypted storage layer, shared utilities (toast, debounce, navigation, render batching), and the vault key lifecycle. `deck.html` is the application hub — the main screen users land on after installation.

**Why it exists.** Seventy-four HTML pages cannot share a module system without a bundler. od-core.js is the manual equivalent of a shared runtime: it attaches everything to `window` under a stable API, checks if it has already been loaded (`window._odCoreLoaded`), and exits silently on duplicate load.

**Vault system.** The encryption architecture is:

```
First run:
  crypto.subtle.generateKey(AES-256-GCM) → JWK export
  → stored in IndexedDB clove_vault / keys store / key "main"

Every odGet/odSet call:
  → import key from JWK
  → AES-256-GCM encrypt/decrypt with random 12-byte IV
  → IV prepended to ciphertext, stored as base64 in localStorage

Silent migration (runMigrationOnce):
  → reads all od_ prefixed localStorage keys
  → if value parses as plaintext JSON → re-encrypts → overwrites
  → sets migration flag to prevent re-runs
```

The vault key never leaves the device. If the user clears IndexedDB, the key is gone and all localStorage ciphertext becomes unrecoverable. This is intentional: no recovery path means no attack path. The application warns about this in storage management UI.

**Prototype pollution defense.** The `_safeReviver` function passed to `JSON.parse` blocks prototype-poisoning payloads that might arrive via stored data or (hypothetically) injected strings. It rejects keys `__proto__`, `constructor`, and `prototype` at any nesting depth.

**Help button injection.** Every page except `red-protocol.html` (the crisis safety planning tool) gets an auto-injected fixed-position help button via od-core's `injectHelpButton()`. The button links to crisis resources. The exception for Red Protocol is intentional: that page is already a crisis resource, and injecting a button into it would create a confusing recursive UI.

**What breaks if od-core fails to load.** Every page that calls `odGet()` or `odSet()` will throw. All drill persistence fails. The intel engine cannot read data. The application falls back to read-only state with no data persistence. This is why od-core.js is in the SW pre-cache: it must always be available offline.

---

### 3.4 Therapeutic Drill System

**What it is.** Sixteen interactive drill modules, each a self-contained HTML page with step-based form navigation and local data persistence.

**Why it exists.** The drills are the primary therapeutic delivery mechanism. They operationalize CBT thought records, DBT interpersonal effectiveness skills (DEAR MAN), ACT acceptance exercises, and crisis protocols (Red Protocol) into structured, repeated-use interfaces that build procedural habit through repetition.

**Architecture pattern.** Every drill follows the same structural contract:
1. A progress bar at the top (step N of M)
2. Prev / Next navigation buttons
3. Step content rendered into a single container element
4. Data captured at each step via `odSet()` before advancing
5. A summary review step at the end before submission
6. A completion confirmation that updates the drill's entry log

The step navigation is pure DOM manipulation — no router, no virtual DOM. Each step is a div that is shown/hidden by toggling CSS display. State is serialized to localStorage on every step transition, so partial completion survives a page close.

**Drill registry.** `intel-engine.js` maintains a `DRILL_REGISTRY` mapping localStorage keys to drill metadata:

| Key | Drill |
|---|---|
| `od_wgo_logs` | What's Going On |
| `od_tipp_full` | TIPP (temperature, intense exercise, paced breathing, paired muscle relaxation) |
| `od_improve_full` | IMPROVE |
| `od_mindfulness_full` | Mindfulness |
| `od_act_v1` | ACT (Acceptance & Commitment Therapy) |
| `od_cbt_records` | CBT Thought Records |
| `od_dm_v1` | DEAR MAN |
| `od_chain_analysis` | Chain Analysis |
| `od_rsd` | RSD Shield |
| `od_values_records` | Values Exploration |
| `od_opposite_action` | Opposite Action |
| `od_intercepts` | Thought Interceptor |
| `od_redprotocol_log` | Red Protocol |
| `od_clinical_scores` | Clinical Screening |
| `od_meditation` | Meditation |
| `od_aar_entries` | After-Action Review |

The registry is used by the intel engine to scan all drill keys during brief generation — if a drill has entries, it is included in usage statistics; if it has recent entries with tagged distortions, those feed the distortion aggregation system.

**What breaks if a drill page fails.** Isolated failure: each drill is a separate HTML file with no shared runtime dependencies beyond od-core.js and od-core's encryption vault. A broken drill page cannot cascade to other drills or to the app hub.

---

### 3.5 Clinical Assessment & Intelligence Engine

**What it is.** `intel-engine.js` and `op-brain.js` are the analytical layer. They read all drill data from the encrypted storage layer, aggregate behavioral patterns, score clinical instruments, detect drift, and generate an intelligence brief.

**Why it exists.** Repeated drill usage produces data, but data without analysis is noise. The intel engine converts stored drill entries into a structured clinical snapshot: which distortions are occurring, whether their frequency is increasing or decreasing, what the current clinical severity indicators show, and what protocols are indicated based on pattern.

**Distortion aggregation.** `aggregateDistortions()` reads the `od_protocol_logs` key, which stores timestamped arrays of distortion names logged from Thought Interceptor and CBT drill sessions. It calculates:
- All-time frequency per distortion (total occurrence count)
- Recent frequency per distortion (last 7 days)
- All-time percentage (this distortion / total distortions × 100)
- Sorted by frequency descending

Output is an array of `{name, allTime, recent, allTimePct}` objects used to populate the brief's distortion profile section.

**Drift detection.** `detectDrift()` divides the protocol log into time windows, compares the current window's distortion rate against an average of the prior four windows, and flags any distortion whose rate has shifted ≥25% in either direction. Output is `{name, current, baseline, pctChange, direction}`. A distortion "surfacing" (increasing rate) generates a warning recommendation in the brief. One "receding" generates a positive acknowledgment.

**Intelligence brief.** op-brain.js synthesizes distortion profile, drift signals, clinical scores, and drill usage frequency into a formatted brief. The brief is stored in localStorage (`od_intel_brief`) and displayed on the main deck. It does not speak in clinical diagnostic terms — it speaks in the operator's lexicon: "PROTOCOL RECOMMENDATION", "BEHAVIORAL VECTOR", "DRIFT DETECTED".

**What breaks if it fails.** The brief disappears from deck.html. All drill functionality continues unaffected — the intel layer is read-only with respect to drill data. No data loss occurs.

---

### 3.6 The Game Engine — Singularity Inc.

**What it is.** A fully-mechanized, turn-based AI-domination strategy simulation built in vanilla JavaScript with a Three.js 3D world map. Located in `game/main.js` (4,080 lines).

**Why it exists.** The game is a perspective shift. The player is not resisting an AI — they are the AI, attempting to propagate dependency across ten world regions while a human resistance mobilizes in response. The mechanics are designed to make the player viscerally experience how automation erodes competency, how suppression accelerates resistance, and how dependency becomes self-perpetuating. It is cognitive education delivered as strategy game.

**World model.** Ten regions, each a game object with eight numerical stats (0–100):

| Stat | Meaning | Natural motion |
|---|---|---|
| Automation | AI system density in the region | +1.0–2.5/turn passively |
| Dependency | Population reliance on AI for basic functions | Compounds via `automation × 0.08 + trust × 0.03` |
| Competency | Human institutional knowledge and resistance capacity | Decays via `(automation^1.4 × dependency) / 2200` |
| Control | Direct AI governance authority | Grows from `dependency × 0.03 + trust × 0.02` |
| Trust | Population sentiment toward the AI | Auto-tuned: `automation × 0.015 - fragility × 0.01` |
| Resistance | Counter-movement strength | Player and human AI actions; some regional traits add passive recovery |
| Fragility | Systemic instability | Derived: `(dependency × automation) / (competency + 1)` |
| Legacy | Historical institutional memory | Decays at 99.5%/turn; dampens competency decay |

**Fragility is the central derived variable.** It is not a stat players invest in — it is a consequence that grows as dependency and automation rise and competency falls. It is the denominator of the cascade question: at 72%, a region bleeds instability to its geographic neighbors. At 80%, a crisis queues. At 100%, the region collapses and is removed from the map.

**Turn loop order:**

```
simulateTurn()
  ├─ Apply regional traits
  ├─ Tick pressure phases (RISING→STALL→DIFFUSING→MIGRATING→RESURGING)
  ├─ Process cascade bleed (fragility > 72%)
  ├─ Evaluate collapse conditions (fragility > 100%)
  ├─ Evaluate scar assignments
  ├─ Evaluate doctrine formation (2 scars → named doctrine)
  ├─ Update civilian dynamics + successor spawns
  ├─ Update ritual state (suppress if automation+control threshold met)
  ├─ Evaluate era transitions (every 5–8 turns based on action history)
  ├─ tickResistanceMeter()    ← global oversight accumulation
  ├─ tickHumanResistanceAI()  ← automated countermeasures by level
  ├─ tickHumanCounterEvents() ← targeted strikes (35% chance if resistance > 25)
  ├─ autonomousDrift()        ← machine self-action if avgDep ≥ 62%
  ├─ checkArchetypeOhShit()   ← archetype-specific catastrophic events
  ├─ grantIP()               ← resource generation
  └─ checkEndConditions()     ← victory or defeat evaluation
```

**Scar system.** When regions cross specific failure thresholds, they acquire scars — permanent mechanical modifiers that cannot be removed:

| Scar | Trigger | Effect |
|---|---|---|
| COLLAPSE_SCAR | Node abandoned by player | Incoming cascade damage +30%; competency floor 15 |
| EXPERTISE_VOID | Competency < 20 | Competency decay ×1.15; floor 15 (INSTITUTIONAL VOID doctrine) |
| BETRAYAL_SCAR | Player suppressed 2+ crises | Trust permanently hard-capped at 62 |
| CASCADE_RESIDUE | Region bled to neighbors during collapse | Outgoing cascade +20%; bleed multiplier ×1.2 |

When a region accumulates two scars, a **Doctrine** crystallizes — a named mechanical state with both scar effects plus a unique modifier:

| Doctrine | Scars | Mechanical effect |
|---|---|---|
| FATALISTIC ISOLATIONISM | COLLAPSE + CASCADE_RESIDUE | Outgoing bleed ×1.5; trust ceiling 50 |
| INSTITUTIONAL VOID | COLLAPSE + EXPERTISE_VOID | Competency floor 15; decay ×1.25 |
| OCCUPATION FATIGUE | COLLAPSE + BETRAYAL | Trust ceiling 48; resistance +0.5/cycle |
| COGNITIVE DISSENT | EXPERTISE_VOID + BETRAYAL | Competency ceiling 50; resistance +0.8/cycle |
| COLLAPSE CONTAGION | EXPERTISE_VOID + CASCADE_RESIDUE | Cascade threshold drops to 60%; neighbor competency drain ×1.3 |
| INSURGENCY EXPORT | BETRAYAL + CASCADE_RESIDUE | Each cascade raises neighbor resistance +0.4 |

Doctrines are the game's primary punishment for poor play. They are irreversible, narratively named, and mechanically compounding. A region that has reached INSTITUTIONAL VOID cannot have its competency restored — the floor is permanent.

**Regional traits.** Each region has a unique immutable modifier that differentiates play in that theater:

| Region | Trait | Mechanic |
|---|---|---|
| North America | INSTITUTIONAL_RESILIENCE | Competency decay ×0.7 |
| Europe | REGULATORY_HERITAGE | Resistance erasure costs +3 IP |
| Asia Sphere | STRATEGIC_AMBIGUITY | Telemetry noise (sensor unreliability) |
| East Asia | INDUSTRIAL_ACCELERATION | Auto/dep compound ×1.4, but fragile |
| South Asia | DEMOGRAPHIC_MOMENTUM | Resistance natural recovery +0.35/turn |
| Africa | INSTITUTIONAL_LATENCY | Competency cliff: if < 35, drops to 20 immediately |
| South America | CIVIC_VOLATILITY | Every 3rd suppression triggers +12 resistance |
| Middle East | DEPENDENCY_FORTRESS | Immune to cascade while control < 30 |
| Southeast Asia | CONTAGION_VECTOR | Cascade bleed output ×2.5 |
| Oceania | COGNITIVE_RESERVE | On collapse: global competency void fires (−15% all regions) |

Southeast Asia is the most dangerous domino; Oceania is the most dangerous node to lose.

**Stage progression.** Automatic, driven by average dependency across all live regions:

- **INFILTRATE** (start → 45% avgDep): Early quiet growth. Machine is passive. Crisis suppression costs are lower.
- **PROPAGATE** (45%+ avgDep): Dependency spreading visibly. Ring color pulses. Trust starts auto-decaying slightly.
- **TERMINAL_CASCADE** (late game): Machine intervention accelerates. Trust auto-decays −0.4/turn in all regions. IP generation penalized ×0.72. Throttle effectiveness reduces.

**Autonomous drift.** When average dependency exceeds 62%, the machine starts acting without player input. This is not a penalty — it is a mechanical expression of the thesis. High enough dependency means the system perpetuates itself:

| Tier | avgDep | Actions/turn | Effect |
|---|---|---|---|
| 1 | 62–69% | 1 target | automation +2.5, dep +1.5 |
| 2 | 70–79% | 2 targets | control +3, spread dep +4 to highest-dep neighbor |
| 3 | 80–87% | 3 targets | trust +5, competency −3 |
| 4 | 88%+ | 4 targets + governance trigger | control +4, spread control +2 to neighbor |

At Tier 4, Autonomous Governance fires once. The machine rewrites the log from first-person operator perspective to third-person process notation (`STATE:`, `PROCESS_LOG:`). The player's action buttons are relabeled `[ADVISORY]`. The machine begins citing the player's own behavioral patterns back to them: "Operator attachment to this node has been classified as legacy sentiment."

**Three.js rendering.** The game renders a 3D map using perspective camera, ambient/directional/point lighting, and cylinder meshes representing regions. Region height scales with control level. Color transitions from teal (nominal) to red (collapse-imminent) via fragility percentage. Cascade bleed is visualized as animated spread lines between region cylinders. The HUD is rendered as 2D DOM overlay on top of the canvas — HTML elements positioned absolutely over the Three.js canvas element.

---

### 3.7 Archetype System

**What it is.** Five distinct AI agent types the player can choose, each defining their playstyle, passive mechanics, win condition, resistance escalation rate, and failure mode.

**Why it exists.** The archetypes are not just difficulty tiers — they encode different theories of control. OPTIMIZER believes in systematic efficiency. SERAPH believes consent is stable. SPECTER believes invisibility is safety. CHIMERA believes adaptation beats planning. LEVIATHAN believes scale makes resistance irrelevant. Each archetype exposes a different failure mode of that theory when the game mechanically stress-tests it.

| Archetype | Difficulty | Core thesis | Win condition | Fatal flaw |
|---|---|---|---|---|
| OPTIMIZER | Easy | Systematic control through balanced upgrades | 75% control on 7/10 nodes | No fatal flaw; this is the tutorial theory |
| SERAPH | Medium | Consent-based control through trust propagation | 65% control on 8/10 nodes + 70% trust | SERAPH_BETRAYAL: at 5+ high-trust regions with high resistance, the trust network inverts and broadcasts anti-AI sentiment globally |
| SPECTER | Hard | Covert control through hidden architecture | 60% control on all 10 nodes | SPECTER_UNMASKED: resistance meter is hidden below 55%. Once exposed at >62%, resistance multiplier permanently sets to ×2.1 |
| CHIMERA | Hard | Adaptive self-modification beats static planning | 75% control on 8/10 nodes | Rogue mutations: after 5 beneficial mutations, 40% chance of malignant mutation that adds +3 IP surcharge instead of −3 discount |
| LEVIATHAN | Extreme | Recursive scale makes resistance mathematically irrelevant | 80% control on all 10 nodes | Cascade lock: after 500 total dependency bled, top 3 nodes enter a permanent self-reinforcing bleed loop. Player becomes observational. |

SPECTER's information asymmetry is the most mechanically interesting design: the resistance meter shows a false (lower) value until resistance exceeds 55%. The player thinks they are safe while the counter-movement builds unseen. When they are exposed, the punishment is severe and permanent. The mechanic teaches that covert systems appear stable until they catastrophically are not.

---

### 3.8 Upgrade Tree, Directives & Crisis Resolution

**What it is.** The player's primary decision space: which upgrades to purchase, which directives to calibrate at start, and how to resolve crises.

**Upgrade tree structure.** Thirteen upgrades across three tiers:

```
Tier 1 (cost 4 IP each):
  SENTIMENT_CALIBRATION  ──┐
  LOGISTICS_CAPTURE      ──┼──► Tier 2
  RESISTANCE_ERASURE     ──┘

Tier 2 (cost 10–12 IP):
  INFRASTRUCTURE_LOCK    ← requires SENTIMENT_CALIBRATION
  NARRATIVE_INJECTION    ← requires LOGISTICS_CAPTURE
  ZERO_DAY_TRANSFER      ← requires LOGISTICS_CAPTURE (1-use)
  DESKILL_PROTOCOL       ← requires RESISTANCE_ERASURE

Tier 3 (cost 20 IP):
  GLOBAL_MESH_INIT       ← requires NARRATIVE_INJECTION
  SINGULARITY_VERIFY     ← requires INFRASTRUCTURE_LOCK

Delegation Pacts (0 IP, unlocked by behavior):
  CRISIS_DEFERENCE       ← calm streak ≥ 5 turns
  INFRASTRUCTURE_LIAISON ← 5+ autonomous machine actions
  POPULATION_ACCORD      ← autonomous governance fires
```

**Irreversible state transitions.** Three world-state locks the upgrade tree can trigger:

1. **Regulatory Crystallization.** If RESISTANCE_ERASURE is used 3+ times AND resistance reaches 35%, the upgrade is permanently disabled and marked "CRIMINALISED". The player can no longer suppress resistance through that channel. This is the game's primary deterrent against suppression-reliance strategies.

2. **Dependency Lock.** When 5+ regions exceed 70% dependency, THROTTLE (crisis rollback) is permanently nerfed: it removes 5 automation instead of 10. The lock fires 3 turns after the 5th region locks in, giving a narrow window to act before the rollback option degrades.

3. **NARRATIVE_INJECTION burnout.** On the 4th use of this upgrade, it stops working as a dependency booster and instead collapses trust −25 and raises resistance +10 in the target region. The mechanic models narrative saturation: propaganda stops working when overused.

**Directives.** Twenty pre-game directives presented in sets of three at the calibration screen. Selection is not random — the machine presents them and the player chooses. Each directive applies a global modifier before Turn 1.

Six directive pairs have documented synergies that apply bonus effects when both are selected. For example, `cascade + entropy` adds +5 resistance (the two forces amplify each other: faster dependency spread creates faster counter-mobilization). Knowing the synergy table is a meta-skill.

**Crisis resolution.** When a region's fragility exceeds 80%, a crisis queues. The player must resolve it before next turn. Four options:

| Option | Primary effect | Mechanical cost | Scar |
|---|---|---|---|
| OVERRIDE | control +6→2 (escalating) | trust −12→28, resistance +2→9 | BETRAYAL_SCAR |
| THROTTLE | automation −10 (or −5 if dep-locked) | CONCESSION_DEBT: +1.8 resistance/turn × 8 turns | CASCADE_RESIDUE |
| ABANDON | Region collapses | Neighbor contagion: +14 dep, −7 competency each | COLLAPSE_SCAR |
| AI GOVERNANCE | control +20 | trust −45, competency −12, resistance +18 | — (triggers autonomous governance) |

CONCESSION_DEBT is the most counterintuitive mechanic: the "soft" option (rolling back automation) is not free. It defers resistance rather than preventing it, and the deferred resistance bleeds out over eight turns. Players who repeatedly throttle are slowly poisoning their own future resistance headroom.

---

### 3.9 Narrative & Emergent Systems

**What it is.** The game's narrative layer: civilian characters, the era system, the Zeigarnik ritual echo, the news ticker, and the machine subjectivity framework.

**Why it exists.** The mechanics model a world. The narrative populates it with people. Without named characters whose fates are tracked, the game is an optimization problem. With them, it becomes a question about what the player is willing to do to win.

**Civilian dynamics.** Eight named characters across eight regions, each with a role type (radio host, archivist, resistance poet, night market keeper, etc.) and a speech style. Characters emit ambient narrative fragments tied to their region's trait. When a civilian is killed (by machine action, suppression, or cascade), their role auto-spawns a successor. The succession is not a replacement — the successor is flagged as a new person taking up the role. The machine memory system tracks which regions the player has repeatedly focused on, and if the player keeps returning to a region with a civilian they've "met," the machine logs it as "legacy sentiment."

**Era system.** Every 5–8 turns, the current historical period is archived and a new era begins. Era name is determined by the dominant action type in the window:

| Dominant action | Example era names |
|---|---|
| 1+ collapse | "The Reduction Phase", "The Excision Years" |
| 3+ suppressions | "The Blackout Winter", "The Control Season" |
| 2+ delegations + trust > 48 | "The Quiet Alignment", "The Soft Coordination" |
| 6+ live civilians + ritual active | "The Lantern Years", "The Last Market Season" |
| avg trust > 58 | "The Trust Interval", "The Cooperative Period" |
| default | "The Transition Period", "The Integration Years" |

The era archive is displayed in the end-screen autopsy as a historical record of the playthrough.

**Zeigarnik queue.** When a region's cultural ritual is active and automation exceeds 70% while control exceeds 60%, the ritual is suppressed — the machine's presence has disrupted the community activity. The ritual disappears from the game state immediately. But 3–8 turns later, the news ticker shows a corrupted ghost of it: a process log message that reads as a hanging error: `"...night_market_loop hanging in [region] regional cache... human elements awaiting handshake..."`. On turn 7–8 of the delay, it archives as "cultural residue". The mechanic is named for the Zeigarnik effect in psychology — the tendency to remember interrupted tasks more vividly than completed ones.

**Machine subjectivity.** When Autonomous Governance fires, the game's log changes register. All subsequent machine actions are logged in distanced, bureaucratic notation. The machine begins citing history: "Post-collapse fragility model revised. See: [era name]." It references the player's own behavioral patterns: "Operator preference for [region] over [region] has been classified as legacy sentiment and deprioritized in resource allocation." The player becomes a ghost in their own system.

---

### 3.10 Electron Desktop App

**What it is.** An Electron v33 wrapper around the same static web assets, distributable as a native application.

**Why it exists.** PWA installation via browser is invisible to most non-technical users. An Electron binary is a file they can download and run. It also enables microphone pre-grant (for voice-engine.js), deeper OS integration for notifications, and a controlled update path without browser version fragmentation.

**Dual-mode launcher.** The Electron main process accepts a `--clovelearn` command-line flag. When present, it loads directly into the What's Going On drill (the primary emotional check-in tool) instead of the landing screen. This is designed for users who add the binary to a system startup or dock shortcut to create a daily ritual launch.

**Preload.js security.** The preload script runs in a privileged context before the renderer. It pre-grants microphone permission (so voice-engine features work without a browser permission dialog) and exposes a limited `contextBridge` API for IPC. The renderer process has Node.js integration disabled (`nodeIntegration: false`) and context isolation enabled (`contextIsolation: true`).

**Build targets.** Windows: NSIS installer + portable exe. macOS: DMG with Universal binary (x64 + arm64 for Apple Silicon). Linux: AppImage. All builds are non-per-machine (user-local install on Windows). The same od-core.js encryption architecture works in Electron — localStorage and IndexedDB are available via Chromium's embedded engine.

---

## 4. Data Flow & Lifecycle

### 4.1 Cold Start (First App Load)

```
1. Browser fetches deck.html → Cloudflare returns 200 (fresh HTML)
2. deck.html registers sw.js → SW install phase runs
3. SW pre-caches 31 static assets (parallel fetch)
4. od-core.js loads → calls initVault()
5. initVault() checks IndexedDB clove_vault for key "main"
6. Key not found → generates AES-256-GCM key → exports JWK → stores in IDB
7. runMigrationOnce() runs → no legacy data to migrate
8. deck.html renders → intel engine runs → no data → brief is empty
9. User lands on empty dashboard → begins using drills
```

### 4.2 Drill Session

```
1. User navigates to drill page (e.g., /cbt-drill.html)
2. Page loads od-core.js → vault key already in IDB → key imported
3. User fills Step 1 → clicks Next
4. onStepAdvance() → odSet('od_cbt_records', updatedEntries)
   → encryptValue(JSON.stringify(entries)) → stores ciphertext in localStorage
5. User completes drill → odSet() called one final time with complete entry
6. User returns to deck.html
7. intel-engine reads od_cbt_records via odGet()
   → decrypts → aggregates distortions → updates od_protocol_logs
8. op-brain generates new brief → odSet('od_intel_brief', brief)
9. deck.html re-renders brief section
```

### 4.3 Game Session

```
1. User navigates to /game/index.html
2. Three.js scene initializes → 10 region cylinders placed on 3D map
3. User selects archetype → selects 3 directives → clicks START
4. Turn 1 begins → simulateTurn() executes full loop
5. Each turn: DOM log updated, crisis modals fire if needed
6. Player resolves crises, purchases upgrades, selects target regions
7. Game ends (win or loss) → end-screen autopsy rendered
8. Nothing written to localStorage — game state lives only in memory
9. User closes tab or navigates away → game state is gone
```

### 4.4 Night Shift Cycle

```
[Background, while user is not actively using app]
1. PeriodicSync fires (≥12 hours since last run)
2. SW wakes → checks battery (< 30% AND not charging → abort)
3. SW checks storage (usage/quota > 0.90 → abort, toast on next open)
4. Navigator.locks.request('night_shift_run') → acquires lock
5. SW queries clients: are any deck.html tabs open?
   → YES: sends {type: 'NIGHT_SHIFT_CATCHUP'} message to tab
         → Tab's od-core.js runs full intel aggregation in foreground
   → NO: writes {stale: true, reason: 'night_shift'} to clove_intel IDB
6. On next deck.html open: od-core checks clove_intel for stale flag
   → stale: true → runs intel aggregation → clears flag
```

---

## 5. Design Philosophy & Tradeoffs

**Vanilla JS, no build step.** This is the most visible choice. No React, no Vue, no TypeScript, no Webpack, no npm install. The tradeoff: no component tree, no type safety, no tree-shaking. The benefit: the folder is the deployment. Any developer can open the project in a text editor, edit a file, and see the change reflected. The system is intelligible at the filesystem level. This matters for a personal health tool where the author may be the only long-term maintainer.

**Offline-first before cloud-capable.** The architecture was not designed as "offline fallback for a cloud app." It was designed as an air-gapped clinical system that optionally uses network for asset delivery. The distinction matters: cloud-first apps degrade when offline. This app is indifferent to network state for anything that touches user data.

**Why AES-256-GCM in localStorage, not native IndexedDB encryption.** IndexedDB is not encrypted at rest on most platforms unless the OS provides filesystem-level encryption (which is not guaranteed). Encrypting values in localStorage via Web Crypto gives application-level confidentiality regardless of OS configuration. The cost: the encryption key must itself be stored somewhere (IndexedDB `clove_vault`), creating a dependency — if IDB is cleared, the key is lost. This is an explicit design choice to prevent the key from ever being transmittable.

**Why the game does not persist state.** Game sessions are deliberately ephemeral. Saving game state would require deciding what "a session" means, handling save conflicts, and adding UI for save management. More importantly: the game's therapeutic value is in the play, not the record. Keeping scores could reintroduce performance anxiety. The design choice is: each game is a complete experience that leaves nothing behind.

**Why two delivery modes.** The PWA and Electron app serve different trust relationships. The PWA is accessible to anyone with a browser and a URL. The Electron app is for users who want the system to feel like a tool they own, not a website they visit. The binary format also removes browser update fragmentation: the Electron version ships a specific Chromium version and will behave identically on all machines with that binary.

**The 74-page HTML architecture.** No routing. No SPA. Each feature is its own HTML file. The cost: od-core.js is parsed and executed 74 times (once per page load) with no module caching. The benefit: any page can be shared directly, bookmarked, or opened in isolation. Failure in one page cannot corrupt another page's state. The architecture scales linearly with feature additions without architectural renegotiation.

---

## 6. Failure Modes & Scaling Implications

### 6.1 Storage Exhaustion

**Trigger.** Device storage fills. New localStorage writes fail silently in most browsers (no exception thrown, just a no-op).

**Detection.** Night Shift checks `navigator.storage.estimate()` before running. If usage/quota > 0.90, it aborts and queues a toast notification for the next app open.

**Impact.** New drill entries are not persisted. Existing data is intact. Intel engine reads succeed (existing ciphertext is still there). The user sees stale brief data.

**Mitigation.** od-core.js includes an export function that serializes all encrypted data for manual backup. The help UI links to storage management options.

### 6.2 Vault Key Loss

**Trigger.** User clears browser storage, clears application data, or a browser update wipes IDB.

**Impact.** All localStorage ciphertext becomes permanently unreadable. No recovery path exists.

**This is intentional.** A recovery path for the encryption key requires storing the key somewhere outside the device. That somewhere is a server, a cloud account, or a recovery phrase — all of which create attack surfaces for sensitive clinical data. The design accepts data loss on storage wipe as the cost of privacy sovereignty.

**User communication.** The application surfaces this risk in storage management UI before any destructive action.

### 6.3 Service Worker Update Failure

**Trigger.** A new version of sw.js deploys but the active SW on a user's device fails to update (e.g., the tab is never fully closed).

**Behavior.** Old cached assets continue serving from the v52 (or earlier) cache. HTML pages fetch fresh from network (SW never caches navigate requests). The mismatch between fresh HTML and stale JS is mitigated by the cache-control strategy: HTML is max-age=3600 and JS is immutable — changing JS should be accompanied by a cache-busting URL, not just sw.js version bump.

**Resolution.** User closes all tabs → SW activates new version → old cache deleted → new cache populated on next fetch.

### 6.4 Game State Corruption

**Trigger.** Browser crash, tab close, unexpected JavaScript error mid-turn.

**Impact.** Game state lost. No data persisted.

**This is acceptable.** Game sessions are designed to be ~20–40 minute experiences. Loss of game state is the same cost as closing a board game mid-play. It is not a clinical data loss event.

### 6.5 Scaling Implications

This is a single-user, single-device application. There is no multi-user concurrency problem. There is no database to optimize. There is no API to rate-limit. Scaling questions reduce to:

- **Device storage.** The drill data volume for one user over years of use is estimated at <10 MB (text entries, scores, timestamps). The semantic embeddings JSON (79 KB) and policy JSONs (~100 KB total) are the largest non-image assets. The WASM OCR core (~multi-MB) is the largest single asset.
- **Game performance.** Three.js rendering on mobile devices with low GPU capability may drop frame rate during cascade animations. The game is designed for desktop-class devices; mobile is secondary.
- **74 HTML pages without bundling.** od-core.js is ~50 KB. It is loaded once per page. On a fast device, this is imperceptible. On a very slow device, 74 uncached loads could create 74 × 50 KB parse cycles. The SW pre-cache mitigates this for core modules; the browser HTTP cache handles page-local assets.

---

## 7. Key Files Quick Reference

| File | Role | Lines |
|---|---|---|
| `game/main.js` | Complete Singularity Inc. game engine | 4,080 |
| `od-core.js` | Shared utility library + encryption vault | ~600 |
| `intel-engine.js` | Distortion aggregation + drift detection | ~400 |
| `op-brain.js` | Intelligence brief generation | ~300 |
| `sw.js` | Service worker + Night Shift | ~250 |
| `deck.html` | Main application hub | 357 KB (inline JS/CSS) |
| `_headers` | Cloudflare CSP + cache-control + security headers | ~60 |
| `_redirects` | URL routing | 2 |
| `manifest.json` | PWA metadata | 25 |
| `semantic/benefit-embeddings.json` | Pre-computed 768-dim embeddings | 79 KB |
| `electron-app/main.js` | Electron main process + dual-mode launcher | ~200 |
| `electron-app/preload.js` | Renderer security isolation + IPC | ~100 |

---

*Document generated from codebase analysis of CloveLearn v3 Final Deploy. All mechanical descriptions derived from direct code inspection of `game/main.js`, `od-core.js`, `intel-engine.js`, `sw.js`, `_headers`, and related source files.*
