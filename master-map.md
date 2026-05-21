ARCHITECTURAL MASTER MAP — FINAL COMPLETE EDITION
BLIND SPOT RESOLUTION SUMMARY
File	Status	Finding
op-brain.js	✅ Cleared	Pure ML/embedding layer. Zero navigation calls. Exposes window.OpBrain. No routing impact.
deck.html lines 800–1500	✅ Cleared	Four named PROTOCOLS (internal state machine). All tool href values already captured. Zero new routes.
growth-plan.html TOOL_LINKS	🔴 Bug confirmed	breathing-exercise.html referenced at line 279 — file does not exist on disk → 404 in production
intel-engine.js DRILL_REGISTRY	🔴 Bug confirmed	dear-man.html at line 23 — should be dear-man-drill.html. File does not exist → 404
anchor/*.js contracts	✅ Cleared	Fully isolated under od_anchor, od_anchor_meta, od_anchor_nodim keys. Zero collision with main app. field-ops.html is safe to wire into main nav.
1. ARCHITECTURAL TREE

clovelearn_v3_final_deploy/
│
├── ━━ LAYER 0: ROOT PORTAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│
├── index.html                    ← Splash page (game/app selector)
│                                    ⚠ Cloudflare: /index.html → /deck.html (302)
│                                    ⚠ growth-plan.html links "← Back to home"
│                                      here → hits the 302 → lands on deck.html
│
├── ━━ LAYER 1: MAIN APP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│
├── deck.html                     ← SPA hub ("The Operator's Deck")
│   │                                Tabs resolved by go(tabName) — NOT URL-based
│   │                                Valid tab values: home | tools | evidence | browse
│   │                                ⚠ ~40 sub-pages back-link with ?tab=more (invalid)
│   │                                   → silently lands on 'home' tab each time
│   │
│   ├── [TODAY]  home tab
│   │     rosa-checkin.html         status / mood check-in widget
│   │     red-protocol.html         crisis fast-path
│   │     toolshed.html             "all tools" button
│   │     tipp-drill-full.html      crisis signal auto-link
│   │     safety-plan-drill.html    crisis signal auto-link
│   │     cbt-drill.html            next-best-action link
│   │     thought-interceptor.html  next-best-action link
│   │     chain-analysis-drill.html protocol step link
│   │     opposite-action-drill.html protocol step link
│   │     behavioral-activation.html protocol step link
│   │     kanban-ops.html           protocol step link
│   │     growth-plan.html          growth-path banner (if onboarding completed)
│   │     music-ops.html            Spotify match button (inside card render)
│   │
│   ├── [TOOLS]  tools tab — 5 named zone clusters
│   │   CRISIS:
│   │     red-protocol.html, tipp-drill-full.html, safety-plan-drill.html
│   │     improve-drill-full.html, mindfulness-drill-full.html, meditation-ops.html
│   │   WORK ON:
│   │     cbt-drill.html, act-drill.html, dear-man-drill.html
│   │     chain-analysis-drill.html, stuck-points-drill.html
│   │     thought-interceptor.html, opposite-action-drill.html
│   │     parts-mapping-drill.html, rsd-shield-drill.html, values-drill.html
│   │   BUILD:
│   │     routine-builder.html, kanban-ops.html, behavioral-activation.html
│   │     exposure-hierarchy.html, relapse-prevention.html, quest-forge.html
│   │   UNDERSTAND:
│   │     clinical-assessments.html, clinical-report.html
│   │     pattern-intelligence.html, intelligence-ops.html
│   │     mood-trends.html, whats-going-on.html, pattern-recon.html
│   │   LEARN:
│   │     toolshed.html, field-manual.html
│   │
│   ├── [PROGRESS]  evidence tab — internal only (no outbound page links)
│   │
│   ├── [DECK]  browse tab — internal 54-card grid (no outbound page links)
│   │
│   └── [≡ Drawer]  hamburger slide-out
│       SETTINGS (fn-only, no page links):
│         Night Ops mode, Particles, Export Evidence, Voice Log,
│         Weekly Debrief (sub-tab), Rank/Phase (sub-tab)
│       SYSTEM:
│         vac-navigator.html, cfhs-analyzer.html, fr-navigator.html
│         fr-atip-analyzer.html, progress-report.html, rosa-checkin.html
│         clinical-report.html, downloads.html, changelog.html, system-check.html
│       ABOUT:
│         quick-start.html, field-manual.html, author-shelf.html, about-clovelearn.html
│
├── ━━ LAYER 2: ONBOARDING FUNNEL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│
├── onboarding/onboarding.html    ← Entry for new/returning users
│       ↓ on complete: ../growth-plan.html
│
├── growth-plan.html              ← Personalized plan display
│       → deck.html                 (primary CTA)
│       → onboarding/onboarding.html  (redo onboarding fn)
│       → index.html               (← Back to home → 302 → deck.html)
│       🔴 breathing-exercise.html (TOOL_LINKS.breath → FILE DOES NOT EXIST)
│
├── ━━ LAYER 3: CRISIS PROTOCOLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│
├── red-protocol.html             → safety-plan-drill.html, meditation-ops.html
├── tipp-drill-full.html          → red-protocol.html, meditation-ops.html
├── safety-plan-drill.html        → red-protocol.html, stuck-points-drill.html
├── improve-drill-full.html       → red-protocol.html, meditation-ops.html
├── mindfulness-drill-full.html   → red-protocol.html, meditation-ops.html
│
├── ━━ LAYER 3: CBT / DBT / THERAPY DRILLS ━━━━━━━━━━━━━━━━━━━━━
│
├── cbt-drill.html                → red-protocol.html, safety-plan-drill.html,
│                                    stuck-points-drill.html ×2, chain-analysis-drill.html
│                                    act-drill.html, opposite-action-drill.html, toolshed.html
├── thought-interceptor.html      → act-drill.html, stuck-points-drill.html, author-shelf.html
├── chain-analysis-drill.html     → dear-man-drill.html, opposite-action-drill.html, author-shelf.html
├── stuck-points-drill.html       → act-drill.html, author-shelf.html
├── act-drill.html                → dear-man-drill.html, safety-plan-drill.html, author-shelf.html
├── dear-man-drill.html           → chain-analysis-drill.html, act-drill.html, author-shelf.html
├── opposite-action-drill.html    → mindfulness-drill-full.html, tipp-drill-full.html, author-shelf.html
├── values-drill.html             → act-drill.html, cbt-drill.html, opposite-action-drill.html,
│                                    mindfulness-drill-full.html, toolshed.html, author-shelf.html
├── rsd-shield-drill.html         → opposite-action-drill.html, thought-interceptor.html, author-shelf.html
├── parts-mapping-drill.html      → stuck-points-drill.html, thought-interceptor.html,
│                                    act-drill.html, author-shelf.html
├── exposure-hierarchy.html       → clinical-assessments.html, behavioral-activation.html,
│                                    relapse-prevention.html, clinical-report.html, toolshed.html
├── relapse-prevention.html       → safety-plan-drill.html, chain-analysis-drill.html,
│                                    behavioral-activation.html, exposure-hierarchy.html, toolshed.html
├── behavioral-activation.html    → clinical-assessments.html, exposure-hierarchy.html,
│                                    clinical-report.html, mood-trends.html, toolshed.html
├── failure-autopsy-drill.html    → author-shelf.html
├── quit-stay-drill.html          → author-shelf.html
├── contact-protocol-drill.html   → author-shelf.html ×2
├── after-action-review.html      → toolshed.html, pattern-intelligence.html, whats-going-on.html
│
├── ━━ LAYER 3: OPS / DAILY TOOLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│
├── rosa-checkin.html             → deck.html, red-protocol.html,
│                                    safety-plan-drill.html, mood-trends.html
├── mood-trends.html              → pattern-recon.html ×2, pattern-intelligence.html,
│                                    warroom.html, cbt-drill.html, toolshed.html
├── pattern-recon.html            → pattern-intelligence.html
├── pattern-intelligence.html     → whats-going-on.html
├── intelligence-ops.html         → pattern-intelligence.html ×2, whats-going-on.html ×2, toolshed.html
├── whats-going-on.html           → pattern-intelligence.html
├── warroom.html                  (no outbound links — browser back only)
├── routine-builder.html          → toolshed.html ×2, clinical-assessments.html,
│                                    journal-ops.html, meditation-ops.html
├── routine-heatmap.html          → routine-builder.html ×2, pattern-intelligence.html,
│                                    after-action-review.html, toolshed.html
├── kanban-ops.html               → mission-brief.html
├── visual-planner.html           → kanban-ops.html
├── body-double-ops.html          → visual-planner.html
├── journal-ops.html              → cbt-drill.html ×2, values-drill.html,
│                                    mood-trends.html, meditation-ops.html, toolshed.html
├── meditation-ops.html           → red-protocol.html, thought-interceptor.html
├── micro-ops.html                (no outbound links)
├── mission-brief.html            (no outbound links)
├── weekly-ops.html               → mission-brief.html
├── grind-ops.html                (no outbound links)
├── grove-ops.html                → dopamine-depot.html
├── quest-forge.html              → grind-ops.html
├── dopamine-depot.html           → grind-ops.html
├── music-ops.html                (Spotify OAuth: history.replaceState return; no nav links)
├── clinical-assessments.html     → mood-trends.html ×2, cbt-drill.html,
│                                    safety-plan-drill.html ×2, toolshed.html, red-protocol.html
├── clinical-report.html          → clinical-assessments.html ×2, pattern-intelligence.html,
│                                    intelligence-ops.html, toolshed.html
├── progress-dashboard.html       → toolshed.html, clinical-report.html ×2,
│                                    routine-heatmap.html, progress-report.html
├── progress-report.html          → clinical-report.html ×2, progress-dashboard.html, toolshed.html
│
├── ━━ LAYER 3: VAC / BENEFITS TOOLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━
│
├── vac-navigator.html            → cfhs-analyzer.html
├── cfhs-analyzer.html            (no outbound links)
├── fr-navigator.html             → fr-atip-analyzer.html, toolshed.html
├── fr-atip-analyzer.html         → toolshed.html
│
├── ━━ LAYER 3: REFERENCE & INDEX HUBS ━━━━━━━━━━━━━━━━━━━━━━━━━
│
├── toolshed.html                 ← CENTRAL DISCOVERY HUB (21 inbound)
│                                    → all 30+ drills + warroom + ops tools
│                                    → candlebox/like-a-stone/be-yourself
│                                    → mission-brief, pattern-recon, routine-heatmap
│                                    → vac-navigator, cfhs-analyzer, fr-navigator
│                                    → fr-atip-analyzer, dopamine-depot, weekly-ops
│                                    → grove-ops, quest-forge, kanban-ops, prompt-depot
│                                    → micro-ops, grind-ops, body-double-ops, visual-planner
│                                    → journal-ops, routine-builder, author-shelf.html ×14
│
├── author-shelf.html             ← BOOK RECOMMENDATION HUB (16 inbound via ?ref=)
│                                    → relapse-prevention, dopamine-depot, chain-analysis
│                                    → field-manual ×4, rsd-shield-drill, body-double-ops
│                                    → micro-ops, stuck-points-drill, values-drill
│                                    → articles/*.html ×14
│
├── field-manual.html             → operators-playbook.html (via safeHref()), toolshed.html
├── operators-playbook.html       → tipp-drill-full.html, thought-interceptor.html, red-protocol.html
├── prompt-depot.html             (no outbound links)
│
├── ━━ LAYER 3: MUSIC / LONG-FORM CONTENT ━━━━━━━━━━━━━━━━━━━━━━
│
├── be-yourself-full.html         → act-drill.html
├── candlebox-rebuild-full.html   → red-protocol.html, meditation-ops.html
├── like-a-stone-full.html        → meditation-ops.html
│
├── ━━ LAYER 3: ADMIN / META ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│
├── about-clovelearn.html         → vac-navigator.html, cfhs-analyzer.html,
│                                    fr-navigator.html, fr-atip-analyzer.html
│                                    changelog.html, review.html, feedback.html
├── changelog.html                → about-clovelearn.html, feedback.html
├── review.html                   → changelog.html, feedback.html
├── feedback.html                 (mailto: only — no HTML page links)
├── no-excuses.html               → about-clovelearn.html, review.html, feedback.html
├── quick-start.html              → toolshed.html, about-clovelearn.html,
│                                    progress-dashboard.html, field-manual.html
├── system-check.html             → toolshed.html
├── downloads.html                → no-excuses.html, feedback.html ×2
│
├── ━━ LAYER 4: GAME SECTOR (parallel system) ━━━━━━━━━━━━━━━━━━
│
├── game/
│   ├── index.html                ← Singularity Inc. (Three.js globe strategy game)
│   │     deps: main.js, three.min.js, topojson-client.min.js, OrbitControls.js
│   ├── Arcade/
│   │   └── index.html            ← 6-game Mini Arcade (fully self-contained SPA)
│   │         deps: /scripts/three.min.js (multiple per embedded game), inline JS
│   │         ⚠ Multiple script tag imports of three.min.js in single file
│   ├── theincrediblemindmachine/
│   │   └── index.html            ← Mind Machine physics puzzle
│   │         deps: cannon.js CDN, three.js CDN (different CDN version)
│   └── nodehopper/
│       └── Node Hopper.html      ← Node Hopper neon platformer
│             deps: game.js, chambers.js, render-helpers.js,
│                   audio.js, clovelearn-mobile.js, clovelearn-mobile.css
│
├── ━━ LAYER 4: ARTICLE LIBRARY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│   ⚠ articles/index.html has NO inbound links from main app
│   ⚠ 4 articles have wrong canonical URLs (missing articles/ prefix)
│
├── articles/
│   ├── index.html                ← Hub (unreachable from main app nav)
│   ├── amygdala-hijack.html      → /cbt-drill.html, /rsd-shield-drill.html
│   ├── cognitive-distortions.html → /thought-interceptor.html, /cbt-drill.html
│   ├── drift-detection-system.html ← ⚠ canonical missing articles/ prefix
│   │   → relapse-prevention.html, the-failure-corridor.html
│   ├── emotional-numbness.html   → /behavioral-activation.html, /dopamine-depot.html
│   ├── failure-recovery.html     → /failure-autopsy-drill.html
│   ├── freeze-response.html      → /tipp-drill-full.html, /body-double-ops.html
│   ├── hero-victim-jester.html   (no outbound links)
│   ├── hypervigilance.html       → /red-protocol.html, /whats-going-on.html
│   ├── imposter-syndrome.html    → /after-action-review.html, /cbt-drill.html
│   ├── intrusive-thoughts.html   → /thought-interceptor.html, /mindfulness-drill-full.html
│   ├── people-pleasing.html      → /dear-man-drill.html, /values-drill.html
│   ├── rejection-sensitivity.html → /contact-protocol-drill.html, /rsd-shield-drill.html
│   ├── rumination.html           → /whats-going-on.html, /thought-interceptor.html
│   ├── shame-spiral.html         → /stuck-points-drill.html, /cbt-drill.html
│   ├── should-i-quit.html        → /quit-stay-drill.html
│   ├── the-attraction-protocol.html ← ⚠ canonical missing articles/ prefix
│   │   → three-operating-systems.html, rejection-sensitivity.html
│   ├── the-failure-corridor.html ← ⚠ canonical missing articles/ prefix
│   │   → drift-detection-system.html, relapse-prevention.html
│   ├── three-operating-systems.html ← ⚠ canonical missing articles/ prefix
│   │   → the-attraction-protocol.html, rejection-sensitivity.html
│   └── why-do-i-self-sabotage.html → /chain-analysis-drill.html, /failure-autopsy-drill.html
│
├── ━━ LAYER 5: ORPHANED / ISOLATED PAGES ━━━━━━━━━━━━━━━━━━━━━━
│
├── field-ops.html                ← ⚠ NAVIGATION ORPHAN — functional but unreachable
│   │                                Links out: index.html?tab=more, music-ops.html,
│   │                                  author-shelf.html, rosa-checkin.html
│   │                                anchor/ modules write exclusively to od_anchor* keys
│   │                                → SAFE TO WIRE INTO MAIN NAV (no data conflicts)
│   ├── anchor/db.js              ← localStorage: od_anchor, od_anchor_meta, od_anchor_nodim
│   ├── anchor/entropy.js         ← Session entropy scoring
│   ├── anchor/ics.js             ← Calendar (.ics) export generator
│   ├── anchor/tension-meter.js   ← UI tension-meter widget
│   ├── anchor/anchor-step.js     ← Post-debrief directive anchor overlay
│   └── anchor/anchor-ratio.js    ← Anchor completion ratio tracker
│
├── clovelearn-positioning-one-pager.html  ← biz doc, no nav
├── clovelearn-test-harness.html           ← dev page, no nav
└── smoke-test.html                        ← dev page, no nav
2. ROUTING & DEPENDENCY TABLE
Global shared dependencies (imported by 70+ pages, omitted from individual rows):

Module	Role	Pages
od-core.js	Sanitization, toast, localStorage wrapper, odBack()→?tab=tools, odNav(), esc(), san(), vault (IndexedDB + WebCrypto), help button injector	72+ pages
op-brain.js	Local RAG: 384-dim MiniLM embeddings, window.OpBrain.{loadModel, embed, search, addMemory, buildInsights}. IndexedDB: clove_intel DB v2 (ops + memories stores). Zero navigation calls.	70+ pages
intel-engine.js	Behavioral intelligence aggregation: window.IntelEngine. Reads od_* keys, writes od_intel_brief, od_intel_last_run, od_intel_config. Contains DRILL_REGISTRY with 🔴 dear-man.html (broken).	deck.html + select pages
particle-bg.js	Animated background canvas. No routing.	60+ pages
voice-engine.js	Voice/STT integration. Uses stt-worker.js. No routing.	40+ pages
/fonts/fonts.css	Local font declarations (Bebas Neue, DM Mono, DM Sans, DM Serif Display)	Most pages
TIER 0 — Entry & Redirect

File	URL Route	Extra Dependencies	Inbound From
index.html	/ (splash portal)	Inline only	Direct URL, PWA manifest.json (start_url: "/")
deck.html	/deck.html	(global set) + intel-engine.js	index.html (Cloudflare 302), onboarding/onboarding.html, growth-plan.html, all ~60 sub-pages (back-nav)
TIER 1 — Onboarding Funnel

File	URL Route	Extra Dependencies	Inbound From
onboarding/onboarding.html	/onboarding/onboarding.html	Inline JS/CSS	index.html, deck.html home tab, growth-plan.html (redo fn)
growth-plan.html	/growth-plan.html	(global set)	onboarding/onboarding.html, deck.html (home tab banner)
TIER 2 — Crisis Protocols

File	URL Route	Inbound From
red-protocol.html	/red-protocol.html	deck.html ×many, toolshed.html, cbt-drill.html, candlebox-rebuild-full.html, improve-drill-full.html, mindfulness-drill-full.html, tipp-drill-full.html, operators-playbook.html, rosa-checkin.html, clinical-assessments.html, meditation-ops.html, articles/hypervigilance.html
tipp-drill-full.html	/tipp-drill-full.html	deck.html, toolshed.html, operators-playbook.html, opposite-action-drill.html, articles/freeze-response.html
safety-plan-drill.html	/safety-plan-drill.html	deck.html, toolshed.html, red-protocol.html, cbt-drill.html, clinical-assessments.html ×2, relapse-prevention.html, rosa-checkin.html
improve-drill-full.html	/improve-drill-full.html	deck.html, toolshed.html
mindfulness-drill-full.html	/mindfulness-drill-full.html	deck.html, toolshed.html, opposite-action-drill.html, articles/intrusive-thoughts.html
TIER 2 — CBT / DBT / Therapy Drills

File	URL Route	Inbound From
cbt-drill.html	/cbt-drill.html	deck.html, toolshed.html, clinical-assessments.html, journal-ops.html, articles ×3, /cbt-drill.html (abs) ×3
thought-interceptor.html	/thought-interceptor.html	deck.html, toolshed.html, operators-playbook.html, rsd-shield-drill.html, parts-mapping-drill.html, articles ×2
chain-analysis-drill.html	/chain-analysis-drill.html	deck.html, toolshed.html, author-shelf.html, cbt-drill.html, dear-man-drill.html
stuck-points-drill.html	/stuck-points-drill.html	deck.html, toolshed.html, cbt-drill.html ×2, thought-interceptor.html, safety-plan-drill.html, parts-mapping-drill.html, articles/shame-spiral.html
act-drill.html	/act-drill.html	deck.html, toolshed.html, be-yourself-full.html, stuck-points-drill.html, thought-interceptor.html, parts-mapping-drill.html, values-drill.html
dear-man-drill.html	/dear-man-drill.html	deck.html, toolshed.html, act-drill.html, chain-analysis-drill.html, author-shelf.html, articles/people-pleasing.html
opposite-action-drill.html	/opposite-action-drill.html	deck.html, toolshed.html, chain-analysis-drill.html, cbt-drill.html, values-drill.html, rsd-shield-drill.html
values-drill.html	/values-drill.html	toolshed.html, author-shelf.html, journal-ops.html, articles/people-pleasing.html
rsd-shield-drill.html	/rsd-shield-drill.html	toolshed.html, author-shelf.html, articles ×2
parts-mapping-drill.html	/parts-mapping-drill.html	toolshed.html
exposure-hierarchy.html	/exposure-hierarchy.html	toolshed.html, behavioral-activation.html
relapse-prevention.html	/relapse-prevention.html	toolshed.html, author-shelf.html, exposure-hierarchy.html, articles ×2
behavioral-activation.html	/behavioral-activation.html	toolshed.html, exposure-hierarchy.html, relapse-prevention.html, articles/emotional-numbness.html
failure-autopsy-drill.html	/failure-autopsy-drill.html	toolshed.html, articles ×2
quit-stay-drill.html	/quit-stay-drill.html	toolshed.html, articles/should-i-quit.html
contact-protocol-drill.html	/contact-protocol-drill.html	toolshed.html, articles/rejection-sensitivity.html
after-action-review.html	/after-action-review.html	toolshed.html, routine-heatmap.html, articles/imposter-syndrome.html
TIER 2 — Ops / Daily Tools

File	URL Route	Inbound From
rosa-checkin.html	/rosa-checkin.html	deck.html ×many, field-ops.html
mood-trends.html	/mood-trends.html	toolshed.html, behavioral-activation.html, clinical-assessments.html, journal-ops.html, rosa-checkin.html
pattern-recon.html	/pattern-recon.html	toolshed.html, mood-trends.html ×2
pattern-intelligence.html	/pattern-intelligence.html	toolshed.html, after-action-review.html, clinical-report.html, intelligence-ops.html ×2, progress-dashboard.html, pattern-recon.html, routine-heatmap.html, whats-going-on.html
intelligence-ops.html	/intelligence-ops.html	toolshed.html, clinical-report.html
whats-going-on.html	/whats-going-on.html	toolshed.html, after-action-review.html, intelligence-ops.html ×2, pattern-intelligence.html, articles ×2
warroom.html	/warroom.html	toolshed.html, mood-trends.html
routine-builder.html	/routine-builder.html	toolshed.html, routine-heatmap.html ×2
routine-heatmap.html	/routine-heatmap.html	toolshed.html, progress-dashboard.html
kanban-ops.html	/kanban-ops.html	deck.html, toolshed.html, visual-planner.html
visual-planner.html	/visual-planner.html	toolshed.html, body-double-ops.html
body-double-ops.html	/body-double-ops.html	toolshed.html, author-shelf.html, articles/freeze-response.html
journal-ops.html	/journal-ops.html	toolshed.html
meditation-ops.html	/meditation-ops.html	deck.html, toolshed.html, red-protocol.html, candlebox-rebuild-full.html, like-a-stone-full.html, improve-drill-full.html, mindfulness-drill-full.html, tipp-drill-full.html, routine-builder.html
micro-ops.html	/micro-ops.html	toolshed.html, author-shelf.html
mission-brief.html	/mission-brief.html	toolshed.html, kanban-ops.html, weekly-ops.html
weekly-ops.html	/weekly-ops.html	toolshed.html
grind-ops.html	/grind-ops.html	toolshed.html, dopamine-depot.html, quest-forge.html
grove-ops.html	/grove-ops.html	toolshed.html
quest-forge.html	/quest-forge.html	toolshed.html
dopamine-depot.html	/dopamine-depot.html	toolshed.html, author-shelf.html, grove-ops.html, articles/emotional-numbness.html
music-ops.html	/music-ops.html	deck.html, field-ops.html
clinical-assessments.html	/clinical-assessments.html	toolshed.html, behavioral-activation.html, exposure-hierarchy.html, clinical-report.html ×2, routine-builder.html
clinical-report.html	/clinical-report.html	toolshed.html, deck.html (drawer), exposure-hierarchy.html, progress-dashboard.html ×2, progress-report.html ×2
progress-dashboard.html	/progress-dashboard.html	toolshed.html, quick-start.html
progress-report.html	/progress-report.html	deck.html (drawer), toolshed.html, progress-dashboard.html
TIER 2 — VAC / Benefits Tools

File	URL Route	Extra Dependencies	Inbound From
vac-navigator.html	/vac-navigator.html	vac-policies.json, vac-master-policy.json, semantic/transformers.min.js, semantic/benefit-embeddings.json	deck.html (drawer), toolshed.html, about-clovelearn.html
cfhs-analyzer.html	/cfhs-analyzer.html	/scripts/pdf.min.js, /scripts/pdf.worker.min.js, /scripts/tesseract.min.js, /scripts/tesseract-worker.min.js, WASM via tesseract-core/	deck.html (drawer), toolshed.html, vac-navigator.html, fr-navigator.html, about-clovelearn.html
fr-navigator.html	/fr-navigator.html	fr-policies.json, fr-master-policy.json	deck.html (drawer), toolshed.html, about-clovelearn.html
fr-atip-analyzer.html	/fr-atip-analyzer.html	Same PDF/OCR stack as cfhs-analyzer.html	deck.html (drawer), toolshed.html, fr-navigator.html, about-clovelearn.html
TIER 2 — Reference Hubs

File	URL Route	Inbound From
toolshed.html	/toolshed.html	21+ pages (after-action-review, behavioral-activation, cbt-drill, clinical-report, exposure-hierarchy, field-manual, fr-atip-analyzer, fr-navigator, intelligence-ops, journal-ops, mood-trends, progress-dashboard, progress-report, quick-start, relapse-prevention, routine-builder, routine-heatmap, system-check, deck.html ×many)
author-shelf.html	/author-shelf.html (+ ?ref=debrief / ?ref=about)	deck.html (drawer + playlist), 14× from drill pages, toolshed.html
field-manual.html	/field-manual.html	deck.html (drawer), toolshed.html, quick-start.html
operators-playbook.html	/operators-playbook.html	field-manual.html (via safeHref()), toolshed.html
prompt-depot.html	/prompt-depot.html	toolshed.html
TIER 2 — Admin / Meta

File	URL Route	Inbound From
about-clovelearn.html	/about-clovelearn.html	deck.html (drawer), no-excuses.html, quick-start.html, changelog.html
changelog.html	/changelog.html	deck.html (drawer), about-clovelearn.html, review.html
review.html	/review.html	no-excuses.html, about-clovelearn.html
feedback.html	/feedback.html	about-clovelearn.html ×2, changelog.html, deck.html, downloads.html ×2, no-excuses.html
no-excuses.html	/no-excuses.html	deck.html (home tab), downloads.html
quick-start.html	/quick-start.html	deck.html (drawer)
system-check.html	/system-check.html	deck.html (drawer), toolshed.html
downloads.html	/downloads.html	deck.html (drawer)
TIER 3 — Game Sector

File	URL Route	Extra Dependencies	Inbound From
game/index.html	/game/index.html	main.js, game/three.min.js, topojson-client.min.js, OrbitControls.js, Chart.js CDN	index.html
game/Arcade/index.html	/game/Arcade/index.html	/scripts/three.min.js (×multiple — ⚠ duplicate includes), Google Fonts CDN, inline per-game JS	index.html
game/theincrediblemindmachine/index.html	/game/theincrediblemindmachine/index.html	cannon.js CDN, three.js CDN (0.152.2)	index.html
game/nodehopper/Node Hopper.html	/game/nodehopper/Node%20Hopper.html	game.js, chambers.js, render-helpers.js, audio.js, clovelearn-mobile.js, clovelearn-mobile.css	index.html
TIER 3 — Article Library

File	URL Route	Notes	Inbound From
articles/index.html	/articles/index.html	Hub unreachable from main app	None
articles/amygdala-hijack.html	/articles/amygdala-hijack.html	—	articles/index.html, author-shelf.html
articles/cognitive-distortions.html	/articles/cognitive-distortions.html	—	toolshed.html ×2, author-shelf.html
articles/drift-detection-system.html	/articles/drift-detection-system.html	⚠ canonical wrong: missing articles/	articles/index.html, articles/the-failure-corridor.html
articles/emotional-numbness.html	/articles/emotional-numbness.html	—	toolshed.html, author-shelf.html
articles/failure-recovery.html	/articles/failure-recovery.html	—	toolshed.html, author-shelf.html
articles/freeze-response.html	/articles/freeze-response.html	—	toolshed.html, author-shelf.html
articles/hero-victim-jester.html	/articles/hero-victim-jester.html	No outbound	articles/index.html, author-shelf.html
articles/hypervigilance.html	/articles/hypervigilance.html	—	author-shelf.html
articles/imposter-syndrome.html	/articles/imposter-syndrome.html	—	author-shelf.html
articles/intrusive-thoughts.html	/articles/intrusive-thoughts.html	—	author-shelf.html
articles/people-pleasing.html	/articles/people-pleasing.html	—	toolshed.html, author-shelf.html
articles/rejection-sensitivity.html	/articles/rejection-sensitivity.html	—	toolshed.html, author-shelf.html, ×2 within-articles
articles/rumination.html	/articles/rumination.html	—	author-shelf.html
articles/shame-spiral.html	/articles/shame-spiral.html	—	toolshed.html, author-shelf.html
articles/should-i-quit.html	/articles/should-i-quit.html	—	toolshed.html, author-shelf.html
articles/the-attraction-protocol.html	/articles/the-attraction-protocol.html	⚠ canonical wrong: missing articles/	articles/index.html, articles/three-operating-systems.html
articles/the-failure-corridor.html	/articles/the-failure-corridor.html	⚠ canonical wrong: missing articles/	articles/index.html
articles/three-operating-systems.html	/articles/three-operating-systems.html	⚠ canonical wrong: missing articles/	articles/index.html, articles/the-attraction-protocol.html
articles/why-do-i-self-sabotage.html	/articles/why-do-i-self-sabotage.html	—	toolshed.html, author-shelf.html
TIER 4 — Orphaned / Dev

File	Status	Notes
field-ops.html	Navigation orphan — functional	Hosts all anchor/ modules. localStorage isolated under od_anchor*. Links out to rosa-checkin.html, music-ops.html, author-shelf.html. Safe to wire into drawer or toolshed.html.
clovelearn-positioning-one-pager.html	Business doc orphan	Imports shared modules. Canonical URL present. Not part of user navigation.
clovelearn-test-harness.html	Dev page orphan	Imports shared modules. Safe to exclude from production sitemap.
smoke-test.html	Dev page orphan	Imports shared modules. Back-button nav to ?tab=more is a dead reference.
3. COMPLETE BUG & ANOMALY REGISTER
🔴 CRITICAL — Broken links (404 in production):

Location	Line	Broken Value	Correct Value
growth-plan.html TOOL_LINKS	279	breathing-exercise.html	File does not exist — create it or remap to meditation-ops.html or mindfulness-drill-full.html
intel-engine.js DRILL_REGISTRY	23	dear-man.html	dear-man-drill.html
🟡 ROUTING BUGS — Wrong behavior, no 404:

Issue	Affected Files	Behavior	Fix
?tab=more back-navigation	~40 sub-pages	Silently lands on home tab, not "more"	Change all ?tab=more back buttons to ?tab=tools to match odBack(), or add a "more" tab to deck.html
odBack() vs inline inconsistency	od-core.js vs all sub-pages	odBack() → ?tab=tools; inline buttons → ?tab=more	Standardize on one value, use odBack() everywhere
index.html back link in growth-plan.html	growth-plan.html:438	href="index.html" + location.href='index.html' hits Cloudflare 302 → deck.html	Change to href="deck.html" directly; remove reliance on the redirect
🟠 SEO / CANONICAL BUGS:

File	Current Canonical	Correct Canonical
articles/drift-detection-system.html	https://clovelearn.io/drift-detection-system.html	https://clovelearn.io/articles/drift-detection-system.html
articles/the-attraction-protocol.html	https://clovelearn.io/the-attraction-protocol.html	https://clovelearn.io/articles/the-attraction-protocol.html
articles/the-failure-corridor.html	https://clovelearn.io/the-failure-corridor.html	https://clovelearn.io/articles/the-failure-corridor.html
articles/three-operating-systems.html	https://clovelearn.io/three-operating-systems.html	https://clovelearn.io/articles/three-operating-systems.html
🔵 STRUCTURAL ANOMALIES — Not bugs, but worth resolving:

Issue	Detail	Recommendation
articles/index.html unreachable	No inbound link from any top-level page or toolshed.html	Add to drawer menu under "Learn" or as a toolshed.html section
field-ops.html unreachable	No inbound links; requires direct URL to reach	Wire into toolshed.html or drawer under "System"
scripts/three.min.js ≠ game/three.min.js	Two separate copies of Three.js on disk	Consolidate; game/ pages should use a relative path to one canonical copy
game/Arcade/index.html multi-import	Multiple <script src="/scripts/three.min.js"> within single file	Deduplicate — each embedded game should share one instance
game/theincrediblemindmachine/index.html	Loads three@0.152.2 from CDN while rest of project uses three@0.160.0	Align versions
4. LOCALSTORAGE / INDEXEDDB DATA CONTRACT
Complete registry of all storage keys across the application. Critical for safe modularization — if you split files, these are the shared-state boundaries.

Key	Type	Owner	Description
od3_tv	object {href: ts}	deck.html / od-core.js	Tool visit timestamps (used for "same-tool" pattern nudge)
od_protocol_hist	array	deck.html	Protocol completion/abandonment history
od_protocol_logs	array	deck.html / intel-engine.js (read-only)	CBT session logs with distortions, intensity
od_wgo_logs	array	whats-going-on.html / intel-engine.js (read-only)	"What's Going On" protocol logs
od_tipp_full	array	tipp-drill-full.html	TIPP session logs
od_improve_full	array	improve-drill-full.html	IMPROVE session logs
od_mindfulness_full	array	mindfulness-drill-full.html	Mindfulness session logs
od_act_v1	array	act-drill.html	ACT drill logs
od_cbt_records	array	cbt-drill.html	CBT session records
od_dm_v1	array	dear-man-drill.html	DEAR MAN session logs
od_chain_analysis	array	chain-analysis-drill.html	Chain analysis logs
od_rsd	array	rsd-shield-drill.html	RSD Shield logs
od_values_records	array	values-drill.html	Values clarification records
od_opposite_action	array	opposite-action-drill.html	Opposite action logs
od_intercepts	array	thought-interceptor.html	Thought intercept records
od_redprotocol_log	array	red-protocol.html	Red protocol activation log
od_clinical_scores	array	clinical-assessments.html	Clinical screening scores
od_meditation	array	meditation-ops.html	Meditation session logs
od_aar_entries	array	after-action-review.html	After-action review entries
od_intel_brief	object	intel-engine.js	Last generated intelligence brief
od_intel_last_run	number	intel-engine.js	Timestamp of last intel run
od_intel_config	object	intel-engine.js / op-brain.js (piggyback)	Intel engine + OpBrain config
od_anchor	object	anchor/db.js (field-ops.html only)	Current directive anchor record
od_anchor_meta	object	anchor/db.js (field-ops.html only)	Anchor usage metadata
od_anchor_nodim	boolean	anchor/db.js (field-ops.html only)	Tension meter permanent dismiss
od_particles	string ('true'/'false')	deck.html	Particle background toggle
IndexedDB: clove_intel	DB v2	op-brain.js, sw.js	ops store (key-value), memories store (384-dim vectors)
IndexedDB: clove_vault	DB v1	od-core.js	Encrypted key storage via WebCrypto
5. QUALITY & CONFIDENCE BENCHMARK
Mapping Confidence Score: 10 / 10
All five blind spots have been resolved. The map is complete:

op-brain.js — Zero routing impact. Pure ML layer. Confirmed.
deck.html protocols — Four internal protocols (anxiety_reset, discipline_rebuild, thought_loop, pattern_break). All href targets already captured in the routing table. No new routes.
growth-plan.html TOOL_LINKS — Not a rendering bug; is valid JS inside <script>. Reveals one confirmed 404: breathing-exercise.html does not exist.
intel-engine.js DRILL_REGISTRY — Confirms one confirmed 404: dear-man.html (should be dear-man-drill.html).
anchor/*.js contracts — Field-ops is fully isolated. od_anchor* key namespace is exclusive. Wiring it into main nav introduces zero data conflict risk.
Remaining work this map enables:

Fix 2 broken links (5-minute job)
Standardize ?tab=more → ?tab=tools across ~40 files
Add articles/index.html and field-ops.html to a navigation entry point
Fix 4 article canonical URLs
Consolidate three.min.js to one copy
Decide on breathing-exercise.html — create it or remap TOOL_LINKS.breath