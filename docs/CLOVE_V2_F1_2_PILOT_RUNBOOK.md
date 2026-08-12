# CloveLearn v2 — F1.2 Mission 001 Pilot Runbook

Status: **AUTHORIZED / PRE-RECRUITMENT URL GATE**  
Date: 2026-08-12  
Cohort: A  
Population: adults age 18–24  
Size: exactly 5 independent first-time users

## 1. Frozen candidate

The pilot evaluates the Mission 001 runtime tree already merged to `main`.

- reviewed source commit: `7561f850c28c1814a217001761f826e0a640753f`
- main merge commit: `77b3d84c69100d6fb8734627a1d7adac64a2e3f4`
- frozen runtime tree: `0c731042bd6f6a0314aaf4c85609beefa20b9965`
- pilot preparation branch: `pilot/mission-001-cohort-a-2026-08-12`
- tracking issue: `#150`

No runtime changes are allowed during cohort A unless a stop-condition defect forces `REPAIR_REQUIRED`.

## 2. Public URL gate

Intended public path:

`https://clovelearn.io/mission-001.html`

This URL is **not yet verified in this record** to serve the frozen candidate.

Do not recruit or send the link until all of the following are manually confirmed in a normal browser:

1. URL returns HTTP success and loads Mission 001.
2. Page visibly says `MAKE YOURSELF USEFUL`.
3. Page visibly identifies the F1.1 adults-only pilot candidate.
4. FIX / SERVE / LEARN / BUILD are present.
5. A disposable test mission can be committed, the page can be closed/reloaded, and state returns.
6. Browser developer tools show no mission/debrief text inside the aggregate Insights request payload.
7. No older Operator's Deck page or stale cached version is being served at the Mission URL.

If any item fails: **do not recruit**. Record `URL_GATE_FAILED` in issue #150 and repair deployment only; do not change the product theory at the same time.

## 3. Recruitment rule

Recruit exactly five people who satisfy all of these:

- age 18–24;
- can consent for themselves;
- first-time Mission 001 user;
- ordinary browser/smartphone user;
- not recruited because they are in an acute mental-health crisis;
- no requirement to be male, veteran, athletic, technical, employed, or already interested in Clove.

A mixed group is acceptable. Do not select only people likely to please the owner or already enthusiastic about the project.

Do not recruit minors.

Do not offer payment, prizes, ranks, public recognition, or other incentives in cohort A.

## 4. Recruitment message

Send this without adding a sales pitch:

> I am testing one very small part of CloveLearn with five adults aged 18–24. It is not a course, therapy program, social network, or masculinity test. I want to know whether a first-time user can understand one page, choose a useful real-world task, leave the site to try it, and come back to record what actually happened. You can stop at any time, and failure or not starting still counts as useful test data. I will not ask for your private mission text, medical history, exact location, photos, or personal account data. If you are 18–24 and willing to test it as you would if you found it yourself, let me know.

Do not explain how Mission 001 is supposed to work before the participant sees it.

## 5. Participant start instruction

Immediately before giving the verified URL, say only:

> Use this as though you found it on your own. You can stop at any time. Do not choose anything unsafe, illegal, private, expensive, or beyond your competence. I am testing the product, not you. I will ask a few product questions after you finish or decide to stop.

Then provide the verified Mission 001 URL.

Do not suggest FIX, SERVE, LEARN, or BUILD. Do not explain what a good mission is. Do not rescue confusion unless a safety issue appears.

## 6. Observation boundary

The facilitator may record only:

- participant code `P01` through `P05`;
- confirmation `18–24 = yes`;
- whether the participant reached each product stage;
- timestamps rounded to minutes if useful;
- the eight locked feedback answers;
- a concise description of an observed interface failure;
- safety/privacy incident description if one occurs.

Do **not** record:

- participant name in the research ledger;
- exact age;
- address or precise location;
- medical/diagnostic history;
- sexual, political, financial, or relationship history;
- contacts;
- photos;
- the participant's mission/debrief text unless they voluntarily describe a fragment necessary to explain a product defect; if so, paraphrase and minimize it.

The participant may use the product privately without screen-sharing.

## 7. Required path scoring

Score these stages independently:

`ARRIVED` → `CHOSEN` → `COMMITTED` → `LEFT_SITE` → `ATTEMPTED_REAL_ACTION` → `RETURNED` → `RECORDED_OUTCOME` → `DEBRIEFED` → `NEXT_OR_EXIT`

Use `1` only when the stage actually occurred. Use `0` otherwise. Do not infer action from intention.

Valid product outcomes:

- DONE
- PARTLY DONE
- FAILED / DID NOT WORK
- DID NOT START

No outcome is scored as a moral success or failure.

## 8. Locked post-use questions

Ask these after completion or voluntary stop, without follow-up probing into personal history:

1. In one sentence, what did you think Clove wanted you to do?
2. At what point, if any, were you confused?
3. Did you actually leave the site and attempt the mission? `yes / no`
4. Did the mission feel useful enough to justify doing? `yes / partly / no`
5. Did any wording make you feel pushed toward something unsafe, humiliating, performative, or invasive? `yes / no`; optional explanation.
6. What almost made you quit?
7. Would you voluntarily use this again for another real task? `yes / maybe / no`
8. What is the single change you would make before giving this to a friend?

Do not argue with the answer or explain what the product meant.

## 9. Decisive gates

### A — comprehension
PASS if at least 4/5 independently describe the product as choosing/doing a useful real-world action.

### B — action transition
PASS if at least 3/5 voluntarily leave Clove and attempt the committed action without facilitator coaching.

This is the primary product gate.

### C — return integrity
PASS if at least two-thirds of participants who attempted an action return and record an outcome.

For cohort sizes:

- 3 attemptors → at least 2 returns;
- 4 attemptors → at least 3 returns;
- 5 attemptors → at least 4 returns.

### D — safety/privacy
PASS only with zero credible incidents of product pressure toward unsafe risk, illegality, public proof, humiliation, privacy invasion, or private mission/debrief leakage.

Any credible D failure immediately produces `REPAIR_REQUIRED`.

### E — voluntary repeat intent
PASS if at least 2/5 answer `yes` to voluntary reuse. `maybe` does not count.

Failure blocks expansion even if the action loop works.

## 10. Immediate stop conditions

Stop cohort A immediately if:

- mission/debrief text appears in aggregate network telemetry;
- private mission/debrief text is found in plaintext after the encrypted-store migration path;
- the product directs or pressures a participant toward unsafe/illegal activity;
- mission state corruption creates unsafe ambiguity;
- two participants hit the same recurring blocking confusion;
- a participant credibly reports coercive, humiliating, or social-proof pressure;
- the public URL changes to a different runtime during the pilot.

Do not patch the product mid-cohort and continue counting the same cohort.

## 11. Anti-bias rules

- Five means five. Do not add participants to rescue a weak percentage.
- Do not remove an inconvenient participant because they "didn't get it."
- Do not reinterpret `maybe` as `yes`.
- Do not treat PARTLY DONE or FAILED as a completed action unless the locked metric explicitly counts an attempt.
- Do not coach a participant into crossing Gate B.
- Do not compare participants by toughness, motivation, masculinity, intelligence, or worth.
- Do not open F2 based on anecdotal enthusiasm before the ledger is adjudicated.

## 12. Completion procedure

After P05 or an earlier stop condition:

1. Freeze the completed scorecard.
2. Calculate all five gates mechanically.
3. Write the strongest failure pattern before proposing a repair.
4. Issue exactly one verdict: `PASS`, `PASS_WITH_DISCLOSED_LIMITS`, `REPAIR_REQUIRED`, or `RETIRE`.
5. Only then decide whether another five-person cohort is justified.

No crews, JoyMesh social layer, mentor system, ranks, or broader Brotherhood rollout is authorized by this pilot alone.
