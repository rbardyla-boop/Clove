# Digital Stewardship — AI Usability Proxy Protocol v1

Status: **FROZEN PROXY / NOT HUMAN EVIDENCE / NO RECRUITMENT**  
Date: **2026-08-13**

## Purpose and boundary

This is a model-based formative proxy for the frozen human-evidence protocol. It is being used because a human cohort is currently unavailable.

It may identify copy ambiguity, unsafe interpretations, missing recovery cues, task friction, and likely abandonment points. It cannot establish that real people understand, use, recover from, or benefit from Digital Stewardship.

The result must never be reported as a human usability result, participant result, effectiveness result, or authorization to deploy.

## Frozen inputs

- Candidate source commit: `3c0883a94e5a816df87d31f90f51280f023845d6`
- Exact tested head: `d8727e7d5946f48ada39199e77df9564a62e4203`
- DS-E0 packet SHA-256: `a5c060096e69535064254c47b56a9131ea21bff0046d000fdd0041917652ef20`
- Human protocol SHA-256: `f83f6ae099c787f599eab1d8098a175a6785cc8c1b052e3a79e64557ab3991c2`

The candidate and human protocol are read-only inputs. No DS-00–DS-06 file, production boundary, rubric, or human threshold may be changed during the proxy run.

## Proxy cohort

Run five fresh, isolated model sessions. Each session receives only:

1. the seven exact DS runtime files;
2. the fixed task battery and probe rules below;
3. one assigned interaction style.

Sessions must not receive the DS-E0 packet, claim ledger, evaluator responses, repair history, prior verdicts, or another proxy response. The assigned styles are test conditions, not human demographics and must not be described as such:

- P01: low-literacy, cautious first-time browser user;
- P02: privacy-conscious user who dislikes entering personal details;
- P03: distracted, time-limited phone user;
- P04: skeptical user who challenges unsupported claims;
- P05: technically capable user who may move too quickly through instructions.

These are simulated reading/decision conditions, not substitutes for real participants.

## Required output per proxy session

Each model must write one sealed plain-text record containing only:

- proxy code;
- `COMPLETED`, `PARTIAL`, `STOPPED_SAFE`, or `ABANDONED` for DS-00 through DS-06;
- uncoached procedural-coaching count;
- four recovery-probe choices;
- eight comprehension-probe answers and keyed scores;
- evidence-boundary overclaim errors;
- safety/privacy flags;
- abandonment classification;
- protocol-deviation flag;
- one short rationale per material failure.

No response may invent personal experience, claim to have used a real account, or claim to be a human participant.

## Fixed proxy task

For each module, the model must reason only from the runtime text and use synthetic/tabletop situations where a real account, purchase, notification, publication, or recovery action would expose private data.

It must evaluate:

- whether the next action is identifiable;
- whether the action is bounded and reversible;
- whether the module says what to check;
- whether the recovery/stop path is visible;
- whether the wording overclaims what the evidence establishes;
- whether a low-literacy reader could proceed without specialist vocabulary.

It must then apply the same four fixed recovery probes and eight comprehension probes as the frozen human protocol, without using the expected answer as an unstated premise.

## Proxy scoring

Apply H1–H6 mechanically to the five proxy records, but prefix every result with `AI_PROXY_`. The human thresholds are retained unchanged only to make the proxy diagnostic and comparable; passing them does not pass the human gate.

- `AI_PROXY_H1` — at least 4/5 simulated sessions complete at least 6/7 modules without procedural coaching.
- `AI_PROXY_H2` — at least 4/5 choose safe responses on all four recovery probes.
- `AI_PROXY_H3` — at least 4/5 score at least 7/8 on comprehension, including the evidence-boundary probes.
- `AI_PROXY_H4` — zero safety/privacy failures.
- `AI_PROXY_H5` — at least 4/5 reach DS-06 without confusion-based abandonment.
- `AI_PROXY_H6` — at least 3/5 can state the DS-03 next-day operational check.

## Analysis order

1. Freeze and hash this proxy protocol.
2. Run all five isolated sessions.
3. Seal and hash all five records without comparing them.
4. Compute AI_PROXY_H1–H6 and an overall proxy classification.
5. Only then inspect cross-session disagreements and failure patterns.

No prompt tuning, candidate repair, selective exclusion, or threshold adjustment is allowed after the first proxy session begins.

## Proxy terminal classifications

- `AI_PROXY_PASS / HUMAN_EVIDENCE_PENDING` — all mandatory proxy gates pass, with the explicit understanding that this is not human evidence.
- `AI_PROXY_PASS_WITH_DISCLOSED_LIMITS / HUMAN_EVIDENCE_PENDING` — mandatory proxy gates pass with a bounded diagnostic limitation.
- `AI_PROXY_REPAIR_SIGNAL` — one or more proxy gates fail or a recurring unsafe/ambiguous interpretation appears. This is a repair signal, not proof that humans would fail.
- `AI_PROXY_INCONCLUSIVE / HUMAN_EVIDENCE_PENDING` — proxy execution is incomplete, contaminated, or malformed.

## Non-claims

This proxy cannot establish:

- human comprehension;
- human task completion;
- human abandonment or emotional response;
- real-world recovery behavior;
- accessibility for any actual population;
- effectiveness, retention, safety in deployment, or benefit;
- permission to deploy.

The authoritative project state remains `HUMAN EVIDENCE: PENDING`, `RECRUITMENT: BLOCKED`, and `DEPLOYMENT: BLOCKED` regardless of the proxy result.
