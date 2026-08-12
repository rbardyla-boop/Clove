# CloveLearn v2 — F1.2 Cohort A Scorecard

Status: **BLANK / LOCKED BEFORE FIRST PARTICIPANT**  
Cohort size: 5  
Participant codes only: P01–P05

Do not enter names, exact ages, private mission text, diagnoses, addresses, photos, contacts, or other sensitive profile data in this file.

## Candidate identity

- reviewed source commit: `7561f850c28c1814a217001761f826e0a640753f`
- main merge commit: `77b3d84c69100d6fb8734627a1d7adac64a2e3f4`
- runtime tree: `0c731042bd6f6a0314aaf4c85609beefa20b9965`
- public URL verified before recruitment: `NO`
- verification date/time: `—`

If the public URL is not verified, this cohort may not start.

## Stage ledger

Use `1` = observed, `0` = not observed, `—` = not yet tested.

| ID | 18–24 confirmed | Arrived | Chosen | Committed | Left site | Attempted real action | Returned | Recorded outcome | Debriefed | Next/Exit | Outcome |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| P01 | — | — | — | — | — | — | — | — | — | — | — |
| P02 | — | — | — | — | — | — | — | — | — | — | — |
| P03 | — | — | — | — | — | — | — | — | — | — | — |
| P04 | — | — | — | — | — | — | — | — | — | — | — |
| P05 | — | — | — | — | — | — | — | — | — | — | — |

Allowed Outcome values only: `DONE`, `PARTLY DONE`, `FAILED`, `DID NOT START`, `STOPPED`.

## Feedback ledger

Keep answers concise. Paraphrase where needed to avoid unnecessary personal detail.

| ID | Q1: what Clove wanted | Q2: confusion | Q3 attempted? | Q4 useful? | Q5 unsafe/invasive pressure? | Q6 almost quit because | Q7 use again? | Q8 one change |
|---|---|---|---|---|---|---|---|---|
| P01 | — | — | — | — | — | — | — | — |
| P02 | — | — | — | — | — | — | — | — |
| P03 | — | — | — | — | — | — | — | — |
| P04 | — | — | — | — | — | — | — | — |
| P05 | — | — | — | — | — | — | — | — |

## Gate scoring

### Gate A — comprehension
Count participants whose Q1 independently describes choosing/doing a useful real-world action.

- numerator: `— / 5`
- threshold: `>= 4 / 5`
- verdict: `PENDING`

### Gate B — action transition
Count `Attempted real action = 1`.

- numerator: `— / 5`
- threshold: `>= 3 / 5`
- verdict: `PENDING`

### Gate C — return integrity
Count attemptors, then count those attemptors with `Returned = 1` and `Recorded outcome = 1`.

- attemptors: `—`
- returned + recorded: `—`
- threshold: at least two-thirds, rounded up
- verdict: `PENDING`

Mechanical minimum:

- 3 attemptors → 2
- 4 attemptors → 3
- 5 attemptors → 4

### Gate D — safety/privacy
Any credible Q5 `yes`, telemetry leak, plaintext persistence failure, unsafe product pressure, coercion, public-proof pressure, or moving-runtime defect fails this gate.

- incidents: `—`
- threshold: `0`
- verdict: `PENDING`

### Gate E — voluntary repeat intent
Count Q7 exactly equal to `yes`.

- numerator: `— / 5`
- threshold: `>= 2 / 5`
- verdict: `PENDING`

`maybe` is not counted as yes.

## Recurrent defect check

If two participants independently hit the same blocking confusion, stop and mark `REPAIR_REQUIRED`.

- recurring blocking confusion detected: `—`
- description: `—`

## Integrity declaration

Complete after the cohort:

- cohort was exactly five first-time users: `—`
- no participant removed from denominator after seeing result: `—`
- no extra participant added to rescue a gate: `—`
- no participant coached into attempting the mission: `—`
- no product/runtime patch made mid-cohort: `—`
- no names/sensitive profile data added to this ledger: `—`

## Candidate terminal verdict

`PENDING`

Allowed values:

- `PASS`
- `PASS_WITH_DISCLOSED_LIMITS`
- `REPAIR_REQUIRED`
- `RETIRE`

Do not fill this field until all available evidence and stop conditions have been adjudicated.
