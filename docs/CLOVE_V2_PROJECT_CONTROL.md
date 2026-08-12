# CloveLearn v2 — Project Control

Status: **ACTIVE / PROJECT-MANAGER CONTROL**  
Control date: **2026-08-12**  
Active branch: `f0/brotherhood-salvage-audit-2026-08-12`  
Active issue: **#146 — CLOVE-V2 F1: prove one real-world mission loop**

## Product objective

Build CloveLearn into a research-led system that helps people take useful action in the real world rather than consume another feed of advice.

The current flagship hypothesis is **Brotherhood Without an Enemy**, but the first product gate does not require brotherhood, a social network, or mentoring. It requires one person to complete one real-world action loop.

## Decision hierarchy

When priorities conflict, use this order:

1. safety and safeguarding;
2. privacy and user control;
3. evidence honesty;
4. whether Clove causes useful real-world action;
5. failure/reintegration without shame or exile;
6. simplicity and reliability;
7. cost discipline;
8. growth, aesthetics, novelty, and engagement.

No growth metric may override items 1–7.

## Single-active-milestone rule

Only one implementation milestone may be ACTIVE at a time.

New ideas are classified as:

- **INVALIDATES CURRENT WORK** — must be investigated immediately because the active premise may be wrong or unsafe;
- **SUPPORTS CURRENT WORK** — may be incorporated if it does not expand the acceptance boundary;
- **PARKED** — recorded for a later milestone and not implemented now.

Interesting is not a reason to interrupt the active milestone.

## Delegated project-manager authority

Without asking for routine approval, the project manager may:

- inspect the repository and evidence base;
- create non-production branches, docs, tests, issues, and prototypes;
- classify existing components as retain/salvage/archive/retire;
- narrow implementation scope;
- reject features that fail the locked claim or acceptance tests;
- add verification infrastructure that does not affect production;
- repair defects on the active non-production branch;
- keep later ideas in the parking lot.

The following remain explicit user/external gates:

- production deployment or changing the live front door;
- DNS/domain changes;
- paid Cloudflare resources or any paid-service commitment;
- destructive deletion of production data/resources;
- collecting new identifiable or sensitive user data;
- programs involving minors;
- launching human mentor matching or private adult-to-youth communication;
- material public medical/mental-health claims;
- merging a new social-network architecture into the product;
- a major brand/name change.

## Current state

### F0 — research + salvage

**Verdict:** `PASS_WITH_DISCLOSED_LIMITS`

Completed:

- Clove v2 salvage ledger;
- Brotherhood evidence ledger;
- existing research/privacy/cost infrastructure preserved;
- old multi-product front-door identity marked non-canonical;
- JoyMesh inspected and parked as a later social-substrate candidate.

### F1 — one-person real-world mission loop

**Status:** `ACTIVE`

Locked claim:

> A first-time user can choose one bounded real-world mission, leave the site, complete or honestly fail an observable action, return, record what happened, and leave with a legitimate next state.

Required path:

`ARRIVE → CHOOSE → COMMIT → DO OFFLINE → RETURN → EVIDENCE → DEBRIEF → NEXT`

F1 explicitly excludes:

- social feeds;
- crews;
- mentor matching;
- JoyMesh integration;
- ranks, XP, streaks, likes, followers, or leaderboards;
- AI companions;
- minors;
- payment;
- autonomous mission assignment;
- homepage overhaul.

## Gate after automated verification

F1 cannot receive final PASS from static/code tests alone.

After automated tests pass, the next independently judgeable unit is a **manual browser acceptance replay** of the exact branch candidate:

1. fresh state → choose each of FIX / SERVE / LEARN / BUILD;
2. commit validation and safety gate;
3. explicit leave-site state;
4. reload/return recovery;
5. DONE path;
6. PARTLY DONE path;
7. FAILED path and reintegration;
8. DID NOT START path and reintegration;
9. mobile-width usability;
10. keyboard-only navigation;
11. privacy inspection: no mission/debrief content in aggregate signal payload;
12. deliberate unsafe-mission fixture is redirected by copy/safety gate rather than framed as courage.

If any path traps the user, loses the mission, rewards browsing over action, leaks private content, or produces a shame/exile state, verdict is `REPAIR_REQUIRED`.

## Roadmap locks

### F2 — small crew

`LOCKED` until F1 passes and a small real-user pilot shows that people voluntarily attempt the mission loop.

Candidate question: can 3–6 adults perform a shared useful mission without turning Clove into a status feed?

### F3 — social substrate

`LOCKED` until F2 passes.

JoyMesh mechanisms may be evaluated here. No wholesale merge is presumed.

### F4 — human mentoring

`LOCKED` until earlier gates pass and safeguarding/mentor-quality architecture is independently reviewed.

Initial work remains adults-only. Minors require a separate institutional/safeguarding gate.

## Parking lot

Recorded but not active:

- JoyMesh Ambient Pulse, Growth Mirror, Cool-Off Valve, firehose/event model, moderation/trust components;
- crews and shared missions;
- earned responsibility/rank concepts;
- mentor progression;
- broader Clove front-door redesign;
- Reality Check scientific-copy repair;
- encrypted mission persistence using the existing Clove vault;
- mission-library expansion beyond Mission 001.

## Terminal discipline

Every active unit ends in exactly one state:

- `PASS`
- `PASS_WITH_DISCLOSED_LIMITS`
- `REPAIR_REQUIRED`
- `BLOCKED`
- `RETIRE`

No unit advances because it feels promising.
