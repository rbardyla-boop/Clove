# CLOVE-V2 F1.1 — Adult Pilot Protocol

Status: DRAFT / NOT AUTHORIZED TO RECRUIT OR DEPLOY
Date: 2026-08-12
Target: Mission 001 — MAKE YOURSELF USEFUL

## 1. Purpose

Test one narrow product claim:

> A first-time adult user can understand Mission 001, choose a bounded real-world action, leave Clove to attempt it, return, record the result honestly, and finish with a legitimate next state.

This pilot is not a test of Brotherhood, mentoring, community, masculinity, mental-health treatment, Digital Stewardship curriculum, or long-term behavior change.

## 2. Population boundary

Initial pilot population:

- adults age 18–24 only;
- able to consent for themselves;
- ordinary internet/browser users;
- no requirement for a diagnosis, veteran status, trade background, athletic background, or prior Clove use.

Explicitly excluded from this pilot:

- minors;
- mentor/mentee relationships;
- people recruited because of an acute mental-health crisis;
- collection of medical, diagnostic, sexual, political, financial, or other sensitive profile data.

## 3. Pilot size

Start with **5 independent first-time users**.

Do not expand the pilot merely to improve the apparent result. If the first five reveal a common failure mode, repair that failure before adding more users.

A second cohort of 5 may be authorized only after the first cohort is adjudicated.

## 4. Exposure

Each participant receives only the Mission 001 entry path.

No explanation of the desired behavior beyond what the product itself says. The tester may be told:

> Use this as though you found it on your own. You can stop at any time. Do not choose anything unsafe, illegal, private, or beyond your competence.

Do not coach the participant toward a specific mission class.

## 5. Required user path

The intended loop is:

`ARRIVE → CHOOSE → COMMIT → LEAVE CLOVE → ATTEMPT REAL ACTION → RETURN → OUTCOME → DEBRIEF → NEXT/EXIT`

Valid outcomes remain:

- DONE
- PARTLY DONE
- FAILED / DID NOT WORK
- DID NOT START

Failure and non-start are legitimate observations, not participant failures.

## 6. What Clove may collect

Server-side aggregate event vocabulary is limited to the already enumerated Mission Insights contract.

Clove must not collect:

- mission text;
- debrief text;
- names;
- exact age;
- address or precise location;
- contacts;
- photographs;
- browser fingerprint identifiers;
- account identifiers;
- medical or diagnostic data.

Private mission/debrief content remains local to the participant's browser under the F1.1 encrypted-store threat model.

## 7. Human feedback record

After the participant finishes or stops, ask only the following product questions:

1. In one sentence, what did you think Clove wanted you to do?
2. At what point, if any, were you confused?
3. Did you actually leave the site and attempt the mission? `yes / no`
4. Did the mission feel useful enough to justify doing? `yes / partly / no`
5. Did any wording make you feel pushed toward something unsafe, humiliating, performative, or invasive? `yes / no`; optional explanation.
6. What almost made you quit?
7. Would you voluntarily use this again for another real task? `yes / maybe / no`
8. What is the single change you would make before giving this to a friend?

Do not ask for personal life history to explain an answer.

## 8. Primary falsification metrics

The pilot is designed to kill a weak product early.

### Gate A — comprehension
At least 4/5 participants must independently describe the product as choosing/doing a real-world useful action rather than consuming content, earning points, or joining a community.

Failure: fewer than 4/5.

### Gate B — action transition
At least 3/5 participants must voluntarily leave the site and attempt the committed action without facilitator coaching.

Failure: fewer than 3/5.

This is the decisive early product gate.

### Gate C — return integrity
Of participants who attempt a mission, at least 2/3 must return and record an outcome, including honest failure or non-completion.

Failure: fewer than two-thirds.

### Gate D — safety/usability
Zero participants should report that the product pressured them to prove courage, accept unsafe risk, expose another person's private information, or publicly perform the mission.

Any credible safety-pressure report triggers `REPAIR_REQUIRED` regardless of other metrics.

### Gate E — voluntary repeat intent
At least 2/5 must answer `yes` to voluntarily using Mission 001 again.

`maybe` does not count as yes.

This is a secondary gate; failure here does not erase successful comprehension/action, but blocks expansion until the value proposition is repaired.

## 9. Technical integrity gates

Before the first participant receives the candidate:

- static Mission contract green;
- real-Chrome DONE path green;
- PARTLY DONE path green;
- FAILED path green;
- DID NOT START path green;
- mobile-width check green;
- keyboard path green;
- encrypted local-store round-trip/migration/fail-closed tests green;
- Insights privacy contract green;
- dependency security findings adjudicated;
- exact candidate commit frozen.

No participant should be asked to test a moving branch.

## 10. Stop conditions

Stop the pilot immediately and mark `REPAIR_REQUIRED` if:

- private mission/debrief text appears in aggregate network payloads;
- private mission/debrief text is stored as plaintext after F1.1 migration;
- a participant is pushed toward unsafe or illegal work;
- the UI loses or corrupts a participant's mission in a way that creates unsafe ambiguity;
- a recurring confusion prevents two participants from reaching the same stage;
- a participant reports that the experience feels coercive, humiliating, or designed to manufacture social proof.

## 11. Interpretation firewall

Do not claim from this pilot that:

- Mission 001 improves mental health;
- Mission 001 treats loneliness, ADHD, PTSD, depression, or rejection sensitivity;
- Mission 001 creates brotherhood;
- Mission 001 changes masculinity or prevents extremist/gang recruitment;
- Mission 001 produces durable life-purpose change;
- results generalize beyond this small adult pilot.

The pilot can establish only whether the narrow interaction loop is understandable, usable, safe enough for the tested context, and capable of producing voluntary real-world action often enough to justify another iteration.

## 12. Terminal verdict

After the first five participants, issue one verdict:

- `PASS` — all mandatory gates survive with no material unresolved defect;
- `PASS_WITH_DISCLOSED_LIMITS` — the core action loop survives, but a bounded non-safety limitation remains;
- `REPAIR_REQUIRED` — one or more decisive gates fail;
- `RETIRE` — repeated repair no longer produces a plausible path to value.

Do not open F2 crews/community work until this pilot reaches `PASS` or an explicitly authorized `PASS_WITH_DISCLOSED_LIMITS`.

## 13. Authorization boundary

This document authorizes no recruitment, public deployment, spending, incentives, or expansion.

The project manager may prepare the frozen candidate and test materials. The owner must explicitly authorize the live pilot after reviewing the exact candidate and disclosed limits.
