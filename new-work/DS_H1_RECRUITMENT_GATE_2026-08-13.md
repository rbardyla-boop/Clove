# DS-H1 — Human Recruitment Authorization

Terminal ruling: **`DS_H1_RECRUITMENT_BLOCKED`**  
Date: **2026-08-13**

## Claim under test

The project currently has the conditions required to begin the frozen five-person human-evidence study for the externally cleared DS-E1 candidate.

## Gate results

| Requirement | Result | Evidence |
| --- | --- | --- |
| Candidate binding valid | PASS | Rebound protocol binds `bd85378c9f40b11bfd9ea943e7f86a9bb1c392cc`; DS-E1 packet is `2c54e87a123b8afe5d9719c45ad39655af896e0ebf3c51ccfdf89801f4c7c817`. |
| Protocol hash verified | PASS | Rebound protocol SHA-256: `54360b4bd549a4b458288733ccdcfcaf703826a468d647f8d44a1796b44d52c1`. |
| Five qualifying first-time adults available | BLOCKED | No qualifying outside-human cohort is currently available or authorized for recruitment. |
| Consent/instructions ready | PARTIAL | The frozen protocol contains eligibility/consent language and the exact participant instruction; no separate participant consent artifact is present. |
| Participant records isolated and sealable | PASS | Protocol requires pseudonymous categorical records and SHA-256 sealing before analysis. |
| Team members excluded as participants | PASS | Operating constraint explicitly excludes Ryan, ChatGPT, and Codex from manufacturing `HUMAN_PASS`. |
| Mid-study repair prohibited | PASS | Frozen protocol prohibits mid-study repair, selective exclusion, threshold changes, and evaluator substitution. |

## Terminal ruling

`DS_H1_RECRUITMENT_BLOCKED` applies because the required five-person independent adult cohort does not exist. No recruitment, outreach, incentives, participant collection, or study exposure was initiated.

The AI proxy sessions and external evaluator sessions are engineering/external-evaluation evidence only. They do not count as human participants.

## Authoritative state

```text
ENGINEERING VALIDATION   COMPLETE FOR CURRENT CANDIDATE
HUMAN PROTOCOL           FROZEN + REBOUND
HUMAN RECRUITMENT        BLOCKED
HUMAN EVIDENCE           PENDING
DEPLOYMENT               BLOCKED
```

No runtime, protocol, candidate, production, or deployment configuration changed during DS-H1. The next valid state change requires actual qualifying participants and separate authorization to begin the frozen procedure.
