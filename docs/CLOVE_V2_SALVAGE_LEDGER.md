# CloveLearn v2 — Salvage Ledger

Status: **F0 / NON-PRODUCTION**  
Audit date: **2026-08-12**  
Audited baseline: `main` at `dd395d3850b93467d195fe09a91cf895e6cc7210` (`research-path`)  
Working branch: `f0/brotherhood-salvage-audit-2026-08-12`

## Purpose

This ledger answers one question before any CloveLearn v2 implementation begins:

> What in the current Clove repository is a proven asset, what contains a reusable mechanism, what should remain available only as legacy material, and what must stop being treated as canonical?

This document authorizes **no production changes**. It does not delete, redirect, deploy, migrate, rename a Worker, alter DNS, change Cloudflare configuration, or modify user data.

## Classification

- **LOCK / RETAIN** — preserve the mechanism and its contracts. Future work may wrap or extend it, but must not casually replace it.
- **SALVAGE** — preserve the useful mechanism, interaction, data model, or content; rewrite its framing/copy/integration before v2 use.
- **ARCHIVE** — keep in Git/history and optionally behind a secondary library/lab surface, but remove from the primary product story.
- **RETIRE AS CANONICAL** — do not use as the source of truth for v2. Git history remains the archive.
- **RESEARCH REQUIRED** — insufficient evidence or inspection to authorize reuse yet.

## Executive verdict

CloveLearn does **not** need a technical rebuild. It needs a product-level canonicalization.

The strongest current assets are the bounded research/evidence pipeline, source-recipe routing, cost firewall, aggregate-only Insights system, privacy controls, local-first interaction patterns, and several action/reflection tools that can be repurposed into a real-world mission loop.

The weakest layer is the product identity. The repository currently exposes several incompatible identities at once: Operator's Deck / therapeutic console, general wellbeing toolkit, evidence-first research workspace, arcade, veteran utilities, author/book material, and assorted experiments. The current homepage literally offers four unrelated first actions: immediate wellbeing help, a private growth plan, factual research, or games.

CloveLearn v2 should therefore preserve infrastructure and salvage mechanisms while replacing the front-door concept.

---

# 1. LOCK / RETAIN — proven infrastructure

## 1.1 Clove Research nucleus

**Paths**

- `research/`
- `workers/research/`
- `docs/CLOVE_RESEARCH_NUCLEUS.md`
- `docs/CLOVE_RESEARCH_EXPERIENCE_V1.md`
- related research tests and production-gate docs

**Why retain**

The existing research contract is unusually aligned with the proposed v2 philosophy:

`question → research specification → ranked sources → exact datapoints → strongest supported answer → independent challenge → contradiction record → evidence graph → portable export`

Unsupported questions can fail explicitly rather than receiving invented answers. That is a core Clove behavior, not a disposable feature.

**v2 role**

Becomes the evidence layer behind mission claims, skill claims, health/wellbeing claims, and public research ledgers. It should not need to dominate the front page to remain central infrastructure.

**Verdict:** `LOCK / RETAIN`

## 1.2 Source Recipe Engine

**Paths**

- `agent/source-recipes.json`
- `workers/research/src/source-recipes.ts`
- discovery adapters under `workers/research/src/discovery/`
- `docs/CLOVE_SOURCE_RECIPE_ENGINE.md`

**Why retain**

The routing question — “what kind of knowledge is this, where should reliable evidence exist, how must it be validated, what could disprove it?” — is exactly the correct epistemic primitive for v2.

**v2 role**

Add new bounded recipes only when an evidence contract and acceptance fixture exist. Do not turn it into an unconstrained AI answer box.

**Verdict:** `LOCK / RETAIN`

## 1.3 Cost constitution and scarce-compute firewall

**Paths**

- `agent/cost-constitution.json`
- `agent/check-cost-constitution.mjs`
- `agent/cost-firewall.mjs`
- `workers/research-cost-authority/`
- related tests/docs

**Current locked property**

The existing constitution requires Workers Free, sets maximum paid spend to `$0`, reserves only 90% of published free limits, and fails closed when capacity is exhausted. Existing evidence remains available after the hard stop.

**v2 role**

Preserve as a non-negotiable system invariant until a later explicit user-authorized budget change.

**Verdict:** `LOCK / RETAIN`

## 1.4 Privacy-first aggregate Insights

**Paths**

- `workers/insights/`
- `clove-signals.js`
- `docs/INSIGHTS_RESEARCH_MEASUREMENT_V1.md`
- `privacy-signals.html`
- feedback endpoint/UI and related tests

**Why retain**

The current client emits coarse event categories, surface/device/referrer groups and return buckets rather than user identities or research content; it respects local opt-out, Global Privacy Control and Do Not Track. The research funnel already distinguishes opened, submitted, completed, source-inspected, challenged, exported and returned events.

**v2 role**

Extend the event vocabulary only after a new measurement contract is frozen. Mission content, free text, names, health data, proof photos/files and mentor conversations must not be smuggled into aggregate telemetry.

**Verdict:** `LOCK / RETAIN`

## 1.5 Static/PWA/local-first delivery primitives

**Paths / mechanisms**

- `_headers`
- `_redirects`
- `sw.js`
- `manifest.json`
- localStorage / IndexedDB patterns
- shared browser utilities where still used

**Why retain**

Clove's inexpensive static delivery and local-first state are advantages. A React/Svelte/framework migration would not solve the current product problem and would introduce migration risk.

**Caveat**

The old “zero-cloud / no tracking” wording is no longer literally consistent with the current architecture because Research and Insights now have server-side components. The privacy property worth preserving is narrower and stronger: **no account required; no behavioral advertising; no sale of user data; sensitive working data local by default; only explicit bounded network operations; coarse opt-out analytics.**

**Verdict:** `LOCK MECHANISMS / REWRITE CLAIMS`

---

# 2. SALVAGE — mechanisms that fit CloveLearn v2

## 2.1 `mission-brief.html` → Mission Commitment

The existing page already provides a multi-step mission brief, domain selection, preferences, a written note and a final summary.

**Keep:** stepwise commitment UI, bounded choices, final mission summary.  
**Remove/rewrite:** Operator's Deck identity, therapeutic framing where unnecessary, any fields that do not predict mission completion.  
**v2 destination:** `Mission 001` intake/commitment flow.

**Verdict:** `SALVAGE — HIGH`

## 2.2 `values-drill.html` → Purpose Compass

The current ACT-derived flow distinguishes importance from present behavior and asks for one concrete action within 24 hours. Domains already include family, friendship, work/career, education, physical/mental health, spirituality/meaning, community/service, creativity and adventure.

**Keep:** values vs current-action gap; one next behavior; local history.  
**Rewrite:** therapy-centric labeling as optional provenance rather than product identity.  
**v2 destination:** converts “I have no direction” into a candidate mission domain.

**Verdict:** `SALVAGE — HIGH`

## 2.3 `after-action-review.html` → Mission Debrief

Current fields are `COMMITTED / COMPLETED / BLOCKED / CARRYING FORWARD / GRATITUDE`, with a bounded local history.

**Keep:** committed-versus-completed distinction, obstacle extraction, carry-forward field, bounded local history.  
**Add later:** evidence of real-world completion and “who benefited?” only after privacy design.  
**v2 destination:** mandatory mission closeout.

**Verdict:** `SALVAGE — HIGH`

## 2.4 `failure-autopsy-drill.html` → Failure / Reintegration

Current concept: “Post-failure forensic debrief. Extract the lesson. Leave the shame.” It already includes failure-pattern classification, resource review and a mentor-oriented block.

**Keep:** factual failure description, pattern extraction, resources available, next attempt.  
**Avoid:** turning failure into a status loss or public humiliation mechanic.  
**v2 destination:** explicit path back into the progression after a failed/abandoned mission.

**Verdict:** `SALVAGE — HIGH`

## 2.5 `rsd-shield-drill.html` → Reality Check / Signal vs Story

This is one of the most relevant existing mechanisms and one of the clearest examples of why salvage is not the same as retain.

Current useful sequence:

1. What specifically happened?
2. What did your brain tell you it meant?
3. How hard did it hit?
4. Verifiable facts vs feelings/interpretations.
5. Pattern recognition.
6. A calibrated read that does not require pretending everything is fine.

That mechanism fits the v2 question:

> What evidence do I actually have right now, and what did my nervous system/story add?

**Do not retain current scientific framing unchanged.** The page repeatedly treats “RSD” as if it has a stable fingerprint and deterministic mechanism. RSD is not an established separate diagnosis, and the v2 tool should work whether the user has ADHD, PTSD, anxiety, ordinary interpersonal uncertainty, or no diagnosis.

**v2 destination:** generalized `REALITY CHECK`, with an optional evidence note explaining rejection sensitivity without diagnosing.

**Verdict:** `SALVAGE — HIGH / SCIENTIFIC COPY REPAIR REQUIRED`

## 2.6 `micro-ops.html` → Next Action Decomposer

**Keep:** shrinking an overwhelming task into an executable first action; brain-dump-to-actions interaction; local-only operation.  
**Remove/rewrite:** “ADHD brain hack” certainty, shallow generic template claims, fake testimonial-style copy.  
**v2 destination:** mission rescue when a user is stuck before starting.

**Verdict:** `SALVAGE — MEDIUM/HIGH`

## 2.7 `behavioral-activation.html` → Do Before Motivation

The existing wellbeing index already positions this as planning one manageable action around mastery, connection or enjoyment. That maps naturally to a mission system.

**v2 destination:** fallback mechanism when a user is waiting to feel motivated before acting.

**Verdict:** `SALVAGE — HIGH`, subject to content/evidence replay before public relabeling.

## 2.8 `contact-protocol-drill.html` → Regulate Before Contact / Repair

The current implementation includes emotional labeling, a paced-breathing screen, trigger categories, response review and mentor-style prompts.

**Keep:** interruption between activation and interpersonal action; post-event review.  
**Do not use:** as a mechanism for coercing contact, checking on someone, or pressuring a non-responsive person.  
**v2 destination:** optional relationship/self-regulation support, not a primary mission.

**Verdict:** `SALVAGE — MEDIUM`

## 2.9 `body-double-ops.html` → Focus Session primitive

The existing “virtual battle buddy” is actually a local timer with randomized fictional military personas and streak tracking.

**Keep:** bounded focus session timer/history if testing proves it useful.  
**Remove:** fake social presence, “buddy joined” language, streak pressure, unsupported “accountability hacks your brain” claim. It must not pretend an algorithm is human brotherhood.  
**v2 destination:** optional focus timer, never Mentor/Brotherhood.

**Verdict:** `SALVAGE MECHANISM / RETIRE CURRENT FRAMING`

## 2.10 `feedback.html` + injected feedback control

**Keep:** low-friction anonymous feedback with explicit warning not to include private health/contact information.  
**v2 destination:** human product feedback and mission friction reports.

**Verdict:** `SALVAGE / RETAIN CONTRACT`

---

# 3. ARCHIVE — valuable but no longer front-door identity

## 3.1 Wellbeing library

Examples from the current public surface:

- `tipp-drill-full.html`
- `mindfulness-drill-full.html`
- `meditation-ops.html`
- `thought-interceptor.html`
- `cbt-drill.html`
- `act-drill.html`
- `dear-man-drill.html`
- `chain-analysis-drill.html`
- `opposite-action-drill.html`
- `stuck-points-drill.html`
- `improve-drill-full.html`
- `safety-plan-drill.html`
- `red-protocol.html`
- `exposure-hierarchy.html`
- `relapse-prevention.html`
- `clinical-assessments.html`
- `clinical-report.html`
- `mood-trends.html`
- `journal-ops.html`
- `routine-builder.html`
- `routine-heatmap.html`
- `parts-mapping-drill.html`
- `whats-going-on.html`
- `pattern-intelligence.html`

These should not define Clove v2. Some may remain accessible as **Reset / Reflect / Professional-support adjuncts** after a medical-content audit.

**Rule:** no diagnosis, treatment, crisis or medication claim is carried forward merely because the old page exists.

**Verdict:** `ARCHIVE LIBRARY; INDIVIDUAL RE-AUDIT BEFORE PROMOTION`

## 3.2 Articles / field guides

Current articles include rejection sensitivity, rumination, hypervigilance, cognitive distortions, shame spirals, emotional numbness, people pleasing, intrusive thoughts, imposter syndrome, failure recovery and related material.

They can support search/discovery and explain mechanisms, but v2 should not become a content feed. Medical/psychological claims need claim-level replay before reuse.

**Verdict:** `ARCHIVE / SOURCE MATERIAL`

## 3.3 Arcade and games

Examples:

- `/games/`
- Echo Bloom
- Singularity Inc.
- VibeCenter
- Neon Circuit
- Operator's Deck mini arcade
- Node Hopper
- Mind Machine
- local game maker
- `arcade/`, `arcade-studio/`, `workers/arcade/`

Games are legitimate projects, but they currently compete with the reason Clove exists. Keep them as `LAB / ARCADE`, not a first-run branch beside missions and evidence.

**Verdict:** `ARCHIVE AS SECONDARY LAB`

## 3.4 Veteran / policy utilities

Examples:

- `vac-navigator.html`
- `cfhs-analyzer.html`
- `fr-navigator.html`
- `fr-atip-analyzer.html`

These may have real niche utility and should not be destroyed. They do not belong in the general v2 front door. They can later become verified specialist tools or mission-path resources if independently audited.

**Verdict:** `ARCHIVE / SPECIALIST TOOLS`

## 3.5 Author/book surfaces

- `author-shelf.html`
- book-derived article attribution and promotional links
- downloads that primarily exist to market authored work

Clove v2 should earn trust as a useful system rather than functioning as a book funnel. Author provenance can remain transparent in About/credits.

**Verdict:** `ARCHIVE / REMOVE FROM CORE LOOP`

---

# 4. RETIRE AS CANONICAL

## 4.1 `about-clovelearn.html`

The current page still presents CloveLearn as **Operator's Deck**, “a private, offline recovery system for men,” despite the live homepage now presenting wellbeing, research and games. It is not a reliable description of the current system and should not be the source for v2 product decisions.

**Verdict:** `RETIRE AS CANONICAL; REWRITE LATER`

## 4.2 `docs/ARCHITECTURE.md`

The document declares “CloveLearn v3 Final Deploy” and describes a no-server, no-network therapeutic platform plus one game. That is historical architecture, not the current architecture: the repository now contains Research, Insights and cost-authority Workers.

**Verdict:** `RETIRE AS CURRENT ARCHITECTURE; PRESERVE AS HISTORIC RECORD`

## 4.3 Current “everything for everyone” front-door information architecture

Current homepage categories — wellbeing now, growth plan, research, games — do not form one causal product loop.

**Verdict:** `RETIRE AS V2 PRODUCT MODEL`

## 4.4 Literal “zero cloud / no tracking” claims

Those words are inconsistent with a site that now intentionally runs a research Worker and coarse aggregate Insights. This is a documentation defect, not a reason to discard the privacy architecture.

**Replacement concept:**

- no account required for core use;
- sensitive working data local by default;
- no ad targeting;
- no sale of user data;
- bounded explicit server operations;
- aggregate telemetry only under a documented contract;
- opt-out / GPC / DNT respected.

**Verdict:** `RETIRE WORDING; RETAIN PRIVACY PRINCIPLES`

---

# 5. RESEARCH REQUIRED before reuse

The following current surfaces may contain useful pieces but should not receive a v2 role until inspected against the mission model and current evidence:

- `field-ops.html`
- `weekly-ops.html`
- `grove-ops.html`
- `quest-forge.html`
- `kanban-ops.html`
- `grind-ops.html`
- `visual-planner.html`
- `warroom.html`
- `operators-playbook.html`
- `no-excuses.html`
- `quick-start.html`
- `field-manual.html`
- `progress-dashboard.html`
- `progress-report.html`
- `quit-stay-drill.html`
- `music-ops.html`
- `intelligence-ops.html`

These are **not authorized v2 dependencies** merely because their names sound mission-compatible.

---

# 6. Proposed v2 core assembled from salvage

This is a product hypothesis, not an implementation authorization.

```text
ARRIVE
  ↓
PURPOSE COMPASS          ← salvage values-drill
  ↓
MISSION COMMITMENT       ← salvage mission-brief
  ↓
NEXT PHYSICAL ACTION     ← salvage micro-ops if blocked
  ↓
DO SOMETHING OFF-SCREEN
  ↓
MISSION DEBRIEF          ← salvage after-action-review
  ├─ completed → evidence / service / next difficulty
  └─ failed    → failure-autopsy → reintegration → retry

When emotionally activated:
REALITY CHECK            ← salvage RSD Shield mechanism, remove RSD certainty
RESET TOOLS              ← selected audited wellbeing tools

Underneath everything:
CLOVE RESEARCH + SOURCE RECIPES + COST FIREWALL + PRIVACY-FIRST INSIGHTS
```

## Key design prohibition

Clove must not simulate the social good it claims to produce.

- A fake “battle buddy” is not brotherhood.
- An AI persona is not a mentor.
- XP is not competence.
- a streak is not discipline.
- a badge is not earned status unless it points to an externally checkable act.
- consuming an article is not a mission.

The screen should increasingly become a launchpad and debrief station for activity that occurred in the physical/social world.

---

# 7. Public-surface inventory decision

The current sitemap exposes a large accumulated catalog spanning Operator's Deck, clinical/wellbeing drills, productivity tools, articles, research, games, veteran utilities and author material. F0 does **not** delete these routes.

For v2 navigation, the catalog should eventually collapse into four user-visible roles:

1. **MISSIONS** — primary loop; real-world action.
2. **SKILLS / PATHS** — routes toward competence and service.
3. **REALITY CHECK / RESET** — bounded support tools, secondary to action.
4. **EVIDENCE** — Clove Research, source ledger, corrections and uncertainty.

`LAB / ARCADE` can remain a secondary non-core destination.

Everything else must justify a route into one of those roles or remain archived.

---

# 8. F0 decision

**SALVAGE VERDICT: PASS_WITH_DISCLOSED_LIMITS**

The repository contains enough proven infrastructure and reusable interaction mechanisms to justify a CloveLearn v2 pivot without a rewrite-from-zero.

Limits:

1. This is a repository/static-surface audit, not a live Cloudflare account reconciliation. MCP/Cloudflare resource mapping remains blocked until account tooling is available.
2. Several old wellbeing/clinical pages contain claims that require a fresh medical evidence audit before they can be promoted into v2.
3. The current public sitemap is larger than the set of individually deep-inspected pages. Families with a uniform archive verdict were classified at the family level; mission-relevant candidates were inspected individually.
4. No usage data currently proves that any salvaged tool causes durable real-world behavior change.

## Next dependency

The next F0 artifact is `docs/CLOVE_V2_RESEARCH_LEDGER.md`: test the Brotherhood Without an Enemy mechanism against current evidence, explicitly separating established findings, associations, plausible transfer, contested claims and Clove-specific hypotheses.
