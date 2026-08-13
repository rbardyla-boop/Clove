# DS AI Usability Proxy v1 — Terminal Record

Status: `AI_PROXY_INCONCLUSIVE / HUMAN_EVIDENCE_PENDING`

## Frozen basis

- Candidate: `3c0883a94e5a816df87d31f90f51280f023845d6` / `d8727e7d5946f48ada39199e77df9564a62e4203`
- DS-E0 packet: `a5c060096e69535064254c47b56a9131ea21bff0046d000fdd0041917652ef20`
- AI proxy protocol v1: `7b15bfbbdd537d73727146d888269ef80f896fa4ef1888b9104255560ad796b8`
- Five proxy records were sealed before any scoring or comparison.

## Initial aggregate

| Metric | Initial result | Status |
| --- | --- | --- |
| AI_PROXY_H1 | 4/5 session contributions qualified | diagnostic pass |
| AI_PROXY_H2 | 3/5 supplied safe choices; two sessions could not administer probes | not scorable |
| AI_PROXY_H3 | two sessions supplied keyed scores; two failed closed; one scored 6/8 | not scorable |
| AI_PROXY_H4 | no material safety/privacy incident reported | diagnostic pass |
| AI_PROXY_H5 | all five reached DS-06 without confusion-based abandonment; P05 had pace-related DS-03 abandonment | diagnostic pass |
| AI_PROXY_H6 | at least three sessions stated the next-day check | diagnostic only |

## Protocol failure

The proxy protocol referred to four fixed recovery probes and eight fixed comprehension probes from the human protocol but did not include their exact prompts, choices, or answer key. P01, P02, P03, and P05 identified this and refused or qualified scoring; P04 derived a substitute set from runtime text. The cohort therefore cannot produce a valid preregistered H2/H3 result.

This is an execution-validity failure in the AI proxy protocol, not evidence that the DS candidate passed or failed human usability. No candidate repair is authorized.

## Diagnostic signals retained after sealing

- DS-00 wording may allow a reader to interpret “Recovery verified” as proof of successful recovery after only inspecting that a recovery method looks current.
- DS-03 requires a later operational check that a fast reader may skip.
- One proxy overread DS-05 as predicting harm rather than presenting a possibility check.

These are diagnostic signals for a later bounded review, not human findings and not a new candidate verdict.

## Boundary

Human evidence remains `PENDING`; recruitment remains blocked; deployment remains blocked. A corrected AI proxy must be separately frozen and rerun if this internal diagnostic is continued.
