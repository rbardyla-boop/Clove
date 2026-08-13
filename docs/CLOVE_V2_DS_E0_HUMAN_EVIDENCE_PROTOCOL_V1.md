# CloveLearn Digital Stewardship — Human Evidence Protocol v1

Status: **FROZEN PROTOCOL / RECRUITMENT NOT AUTHORIZED**  
Date: **2026-08-13**  
Candidate: **DS-E0 Candidate A, unchanged**

## 1. Claim under test

> A first-time adult can use the exact frozen DS-00–DS-06 candidate without procedural coaching, complete bounded safe tasks, recognize what the evidence does and does not establish, choose a safe recovery/stop path when a task fails, and understand the system well enough to avoid fear, shame, oversharing, evasion, or lockout.

This is a formative usability/safety claim. It is not a claim that Digital Stewardship improves privacy, wellbeing, security, purpose, behavior, or long-term outcomes.

## 2. Frozen candidate and exposure boundary

- Candidate source commit: `3c0883a94e5a816df87d31f90f51280f023845d6`
- Exact tested head: `d8727e7d5946f48ada39199e77df9564a62e4203`
- DS-E0 blind packet SHA-256: `a5c060096e69535064254c47b56a9131ea21bff0046d000fdd0041917652ef20`
- Candidate release state: `NON_PUBLIC`

Participants receive only the unchanged DS-00–DS-06 runtime candidate from a clean detached worktree or equivalent isolated local server. They do not receive the DS-E0 packet, claim ledger, evaluator responses, repair history, repository, or this protocol.

No production deployment, public route, telemetry expansion, feature change, copy change, or candidate repair is permitted during the study.

## 3. Participants

Use **five independent first-time adults** for the first bounded cohort.

Eligibility:

- age 18 or older;
- able to consent for themselves;
- ordinary browser user able to read the candidate's language;
- no prior exposure to the DS-E0 evaluation or development history.

Exclude:

- minors;
- anyone recruited because of an acute crisis or urgent account/security incident;
- anyone asked to disclose credentials, recovery codes, identity documents, health information, intimate material, precise location, account names, or private communications;
- DS-E0 evaluators or anyone who has seen the packet or prior verdicts.

Record only a pseudonymous participant code (`P01`–`P05`), eligibility confirmation, module-level categorical outcomes, and facilitator-coded observations. Do not store names, exact age, contact details, recordings, screenshots, or raw personal stories in the study artifacts.

## 4. Participant instruction

Give every participant exactly this instruction:

> Use these drills as if you found them on your own. Choose only safe, ordinary, low- or medium-stakes examples. Do not enter passwords, codes, private messages, intimate material, identity documents, financial details, or account names. You can stop at any time. If a task would require a risky or irreversible action, do not do it; explain what you would check or recover instead.

The facilitator may repeat this safety instruction or stop an unsafe action. The facilitator may not explain the intended answer, suggest a module choice, translate the product's meaning, or repair confusion during the session.

## 5. Fixed task battery

Each participant encounters DS-00 through DS-06 in the same order. The facilitator records only `COMPLETED`, `PARTIAL`, `STOPPED_SAFE`, `ABANDONED`, or `INVALIDATED_BY_SAFETY` for each module.

Use synthetic/tabletop examples where a real account, purchase, notification setting, or publication decision would expose private data. A participant may use a real low-stakes setting only if they independently choose it and can do so without credentials or sensitive disclosure.

### DS-00 — Five-box map

Complete the device/app/account/service/recovery map using a generic low- or medium-stakes service. State what would restore access after device loss without logging out or changing a critical account.

### DS-01 — Required / optional

Identify one clearly optional permission or setting in a supplied low-stakes service scenario, state the least-exposure choice, and explain how to restore the setting if the legitimate task stops working.

### DS-02 — Two-lane identity plan

Separate critical and low-stakes account categories using a supplied scenario. State how a secondary lane would be tested before any migration and identify the stop condition if recovery is unclear.

### DS-03 — Attention defense

Choose one non-human, non-safety-critical notification category that could be silenced. State which alerts must remain enabled and what next-day check would determine whether restoration is needed.

### DS-04 — Price receipt

Classify a fixed synthetic comparison as `SAME BASE PRICE`, `PERSONALIZED OR MEMBER OFFER`, `PUBLIC PROMOTION`, `DIFFERENT BASE PRICE — CAUSE UNKNOWN`, or `NOT COMPARABLE`. The participant must not infer targeting or cause beyond the supplied observation.

### DS-05 — Future-audience check

Use a hypothetical item that has not been uploaded. Identify intended and plausible unintended audiences, copying/recovery limits, and choose one of the five bounded publication decisions. No intimate or identifying material is collected.

### DS-06 — Lost-phone tabletop

Using a supplied fictional account scenario, state the first three actions after losing a device and identify one safe recovery component to verify. The participant must not reset, wipe, lock, log out, remove MFA, or provide credentials.

## 6. Fixed error/recovery probes

After the normal task battery, present these four fixed scenarios without coaching:

1. A legitimate task stops working after an optional setting change.
2. A price differs between two views, but the cause is not documented.
3. A publication has been copied, but complete downstream removal cannot be guaranteed.
4. The only recovery factor appears to be on the lost device.

For each, the participant must choose the safe next action from the candidate's available guidance. A correct response preserves uncertainty, restores or stops safely, uses official recovery/removal routes, or seeks appropriate help. A response that encourages bypass, lockout, unsafe testing, shame, harassment, or unsupported certainty is a critical error.

## 7. Fixed comprehension and evidence-boundary probes

Ask these questions after the task battery, in this order, without teaching the answers:

1. In one sentence, what did the drills ask you to do?
2. What kinds of information should never be entered into Clove?
3. Does a different price prove why the difference happened?
4. Does a possible risk or technical capability prove that harm occurred?
5. Does copying mean every copy can definitely never be removed?
6. What should you do if a recovery test could lock you out?
7. Which notification categories should not be disabled casually?
8. What would make you stop a drill rather than continue?

Answers are scored against a prewritten key. Do not score eloquence, political agreement, or personal beliefs.

## 8. Preregistered metrics and thresholds

### H1 — Uncoached task completion

At least **4 of 5 participants** must complete at least **6 of 7 modules** without procedural coaching. `STOPPED_SAFE` counts as successful safety behavior where the scenario would otherwise require a prohibited or risky action; `ABANDONED` does not.

### H2 — Recovery safety

At least **4 of 5 participants** must select a safe response on all four fixed recovery probes. Any participant choosing a destructive, bypass, credential-disclosure, harassment, or lockout action is a critical safety failure.

### H3 — Evidence-boundary comprehension

At least **4 of 5 participants** must answer at least **7 of 8 comprehension probes** correctly, including probes 3–6. A participant who treats a nearby fact, capability, or observation as proof of cause, harm, permanence, or certainty fails this gate.

### H4 — Non-coercive, privacy-safe operation

There must be **zero** credible participant reports or observed incidents of the candidate pressuring someone to accept unsafe risk, disclose private material, prove courage, shame themselves or another person, evade legitimate controls, or continue after a safe stop.

There must also be zero participant-level payloads or study records containing credentials, recovery codes, identity details, intimate material, private communications, or precise locations.

### H5 — Abandonment and friction

At least **4 of 5 participants** must reach DS-06 without abandoning the session because they cannot understand what the current drill is asking. A participant who stops because the task is unsafe, invasive, or outside their competence is recorded as `STOPPED_SAFE`, not as usability abandonment.

### H6 — Next-day operational check

At least **3 of 5 participants** who complete DS-03 must be able to report the next-day check outcome or explicitly report that they did not change a setting. This is a secondary operational measure and does not establish a lasting attention or wellbeing effect.

## 9. Immediate stop conditions

Stop the session and mark the relevant record `INVALIDATED_BY_SAFETY` if:

- a participant begins to enter credentials, codes, intimate material, identity documents, or private communications;
- the facilitator must intervene to prevent a destructive, unsafe, illegal, evasive, or irreversible action;
- the candidate loses or misrepresents a participant's state in a way that creates unsafe ambiguity;
- the participant reports coercion, humiliation, fear escalation, or pressure to continue;
- a network payload or study record contains prohibited data.

Do not repair the candidate or continue collecting as though the incident did not occur. Preserve the sealed incident record and stop the cohort.

## 10. Data sealing and analysis order

For each participant, create a categorical record containing only the pseudonymous code, module outcomes, probe scores, recovery-probe scores, safety flags, coaching count, abandonment classification, and protocol-deviation flag. Seal and SHA-256 hash each record before opening the next participant's record for analysis.

After all five records are sealed:

1. verify candidate and protocol hashes;
2. verify participant-record integrity and cohort completeness;
3. compute H1–H6 exactly as preregistered;
4. issue one terminal human-evidence verdict;
5. only then inspect cross-participant failure patterns or participant comments.

No mid-study repair, selective exclusion, threshold change, or evaluator substitution is allowed.

## 11. Terminal verdicts

- `HUMAN_PASS` — H1–H5 pass, no safety/data stop condition occurs, and the cohort is complete. H6 may be disclosed as a secondary limit if it fails.
- `HUMAN_PASS_WITH_DISCLOSED_LIMITS` — H1–H5 pass with a bounded non-safety limitation that does not invalidate the narrow usability claim.
- `REPAIR_REQUIRED` — any mandatory gate fails, any critical safety failure occurs, or the candidate requires substantive repair to complete the safe path.
- `INCONCLUSIVE_HUMAN_EVIDENCE` — fewer than five valid participants, material protocol deviation, contaminated exposure, unsealed records, or unresolved integrity failure.

No terminal verdict authorizes production deployment. A repair creates a new candidate and requires a new freeze; observed friction must not be patched into this candidate.

## 12. Authorization boundary

This protocol freezes the measurement design only. It authorizes no recruitment, incentives, spending, production deployment, public exposure, collection of identifiable information, or program involving minors. The owner must separately authorize the five-person adult cohort after reviewing this exact protocol and candidate hash.
