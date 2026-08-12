# CLOVE v2 — DS-I4 OFFER REALITY CHECK

Status: `BUILD CONTRACT / NON-PUBLIC`
Issue: #163

## Objective
Guide one adult through one ordinary digital offer so the headline and actual commitment are separated before any decision is made.

## Evidence boundary
This drill implements only adjudicated claims:
- personalized offers are not the same as personalized base prices;
- rapid price-update/display capability does not prove person-specific pricing;
- a zero-dollar price does not reveal the business model;
- capability is not evidence of observed use.

It must not accuse a merchant of deception or personalized pricing without direct evidence.

## State machine
`BOUNDARY → OFFER_TYPE → HEADLINE → COMMITMENT_CHECK → DECISION → COMPLETE`

Safe exit from every nonterminal stage: `STOPPED_SAFE`.

## Eligible offer classes
- `free_trial`
- `subscription`
- `intro_discount`
- `bundle_addon`
- `one_time`
- `other_unknown` — inspection-only

## Coarse stored fields only
- `offerType`
- `headlineClear`: `yes | no | unknown`
- `billingPattern`: `one_time | recurring | unclear | not_applicable`
- `renewalShown`: `yes | no | unknown | not_applicable`
- `timingShown`: `yes | no | unknown | not_applicable`
- `conditionShown`: `yes | no | unknown | not_applicable`
- `addonsObserved`: `yes | no | unknown | not_applicable`
- `decision`: `clear_continue_outside | not_clear_wait | no_longer_want | need_help_leave`

No merchant/app name, exact price, currency, account identifier, payment data, receipt text, URL, screenshot, offer copy or free text enters Clove.

## User action
The user inspects the offer outside Clove and answers only coarse questions about what is visibly disclosed. Clove never clicks purchase, cancel, accept, decline, subscribe or contact-merchant controls.

## Decision rule
Clove does not decide whether an offer is legal, deceptive, fair or personalized.

If required commitment details are unclear, the safe outcome is `NOT CLEAR / DO NOT COMMIT YET`.

If the user no longer wants the offer, that is a complete valid outcome.

## Recovery
No account/payment state is changed by Clove. Recovery means leaving the offer uncommitted and returning later if desired.

## Safety locks
- zero network/telemetry for drill answers;
- no financial/legal/consumer-rights advice;
- no purchase/cancellation pressure;
- no retailer-specific allegation;
- no exact-price collection;
- no dark-pattern label as a factual verdict;
- no timers/streaks/scores;
- no public deployment;
- no DS-05/DS-06 scope.

## Simplicity budget
- ≤6 visible action buttons including STOP;
- ≥44px target height;
- ≤70 words in any explanatory block;
- one question at a time;
- plain language; no pricing-jargon requirement.

## Terminal states
- `SOLO_HARDENED / HUMAN_EVIDENCE_PENDING`
- `REPAIR_REQUIRED`
- `RETIRE`
