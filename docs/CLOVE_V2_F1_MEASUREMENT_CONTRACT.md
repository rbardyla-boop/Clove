# CloveLearn v2 — F1 Measurement Contract

Status: **SPECIFICATION ONLY / NON-PRODUCTION**  
Applies to: **Mission 001 — MAKE YOURSELF USEFUL**

## Measurement purpose

Measure whether Clove causes a real-world action loop to occur without introducing invasive tracking or pretending aggregate events are unique-user conversion.

The core question is:

> Did a person arrive, commit to a bounded mission, leave Clove, return, and record an observable outcome?

Secondary questions concern failure, return, and whether the action was useful beyond the user.

## Event vocabulary

Minimum aggregate event set:

```text
mission_viewed
mission_class_selected
mission_committed
mission_exit_prompt_seen
mission_returned
mission_done
mission_partly_done
mission_failed
mission_not_started
mission_debrief_completed
mission_helped_other_yes
mission_helped_other_no
mission_helped_other_unsure
mission_retry_selected
mission_smaller_selected
mission_help_requested
mission_abandoned_reasoned
```

Optional aggregate dimensions, only if they remain coarse and non-identifying:

```text
mission_class = fix | serve | learn | build
result = done | partly_done | failed | not_started
estimated_duration_bucket = <30m | 30-60m | 1-2h | 2-4h
return_bucket = same_session | same_day | later
surface = mission001
```

Do not collect mission text, photos, names, exact timestamps tied to individuals, precise location, contacts, IP-derived identity, device fingerprint, or persistent cross-session user identifier in Insights.

Private mission records may remain local to the user's device under the existing local-first privacy model. Aggregate product measurement and private mission content are separate systems.

---

# 1. Primary funnel

```text
mission_viewed
  → mission_class_selected
  → mission_committed
  → mission_returned
  → outcome_recorded
  → mission_debrief_completed
```

Where:

```text
outcome_recorded =
  mission_done
  + mission_partly_done
  + mission_failed
  + mission_not_started
```

These are aggregate event counts, not unique-user conversion rates unless a future privacy-approved identity mechanism explicitly changes that contract.

Do not write "X% of users completed" from event-count ratios.

Use wording such as:

> "For every 100 mission commitments recorded, 42 completion events and 18 explicit failure/not-started events were recorded. Because Insights is aggregate-only, this is a funnel signal rather than a unique-user conversion rate."

---

# 2. F1 product metrics

## M1 — Commitment signal

`mission_committed / mission_viewed`

Interpretation: does the proposition lead to a concrete commitment event?

Failure interpretation: low commitment suggests the mission offer, examples, scope, or entry proposition is not compelling/clear.

## M2 — Return signal

`mission_returned / mission_committed`

Interpretation: do commitment events produce later returns to record an outcome?

Limit: without identity, repeated sessions and multiple missions can distort the ratio.

## M3 — Recorded real-world completion signal

`mission_done / mission_committed`

This is the central descriptive signal, but it is self-reported and aggregate-only.

Do not call it a verified behavioural effect.

## M4 — Honest failure capture

`(mission_failed + mission_not_started) / outcome_recorded`

A non-zero value is desirable. If almost nobody ever reports failure, investigate whether the interface is creating social desirability or completion inflation.

## M5 — Debrief completion

`mission_debrief_completed / outcome_recorded`

Tests whether users are willing to extract a lesson after the outcome rather than merely tick a box.

## M6 — Service spillover

`mission_helped_other_yes / mission_debrief_completed`

Descriptive only. A FIX/LEARN mission may legitimately help only the user.

## M7 — Reintegration signal

`(mission_retry_selected + mission_smaller_selected + mission_help_requested) / (mission_failed + mission_not_started)`

Tests whether failure leads into another legitimate action state.

---

# 3. Metrics explicitly rejected

F1 must not optimize for:

- time on site;
- number of pages viewed;
- notification opens;
- daily streak length;
- public posts;
- follower growth;
- likes/reactions;
- number of missions generated;
- number of AI responses;
- raw Cloudflare request volume.

High engagement with Clove can be a failure if it replaces real-world action.

---

# 4. Qualitative test before public release

Before production implementation is considered validated, expose the Mission 001 paper/UI prototype to at least five target-age adults who did not help design it.

Ask only after they inspect it:

1. What do you think this site wants you to do?
2. Which mission, if any, would you actually choose?
3. What would stop you from doing it?
4. Is any part embarrassing, preachy, fake, patronizing, therapy-coded, or unclear?
5. What evidence would you naturally record afterward?
6. Would you come back to record failure? Why or why not?

Do not lead them with the intended answer.

Primary comprehension gate:

At least 4 of 5 independently describe the central behavior as doing something real/offline and returning to record what happened.

This tiny sample is a usability gate, not scientific validation.

---

# 5. Initial pilot decision rules

These thresholds are provisional product gates, not population-effect estimates.

## GO

Continue to F2 exploration if, during the first bounded pilot:

- the ten-second comprehension gate passes;
- there are genuine mission commitments;
- at least some users return with `DONE`, `PARTLY DONE`, or honest `FAILED` outcomes;
- failure paths are actually used without trapping users;
- no material safety/privacy incident appears;
- qualitative feedback indicates the product feels like action rather than another advice feed.

## REPAIR

Repair F1 if:

- users understand the concept but do not know what mission to choose;
- commitments occur but returns are near-zero;
- people report missions are too large, artificial, embarrassing, or unclear;
- failure is rarely recorded because it feels punitive;
- private evidence requests feel invasive;
- the page keeps people browsing instead of leaving.

## RETIRE / REFRAME

Do not add crews, mentors, JoyMesh, ranks, AI companions, or gamification to rescue a failed core proposition.

If repeated bounded tests show that target users will not voluntarily perform and return from one useful real-world mission, the F1 concept must be reframed before social complexity is authorized.

---

# 6. Research separation

Mission product analytics are not a clinical or academic study.

Do not infer that Mission 001 causes:

- reduced loneliness;
- improved depression/anxiety;
- increased purpose;
- reduced extremism/gang involvement;
- stronger masculinity;
- improved mental health.

Those require separate research designs, validated outcome measures, appropriate ethics review where humans are recruited for generalizable research, and stronger causal methods.

F1 measures product behavior only.

---

# 7. Existing Insights compatibility

The existing Clove Insights design is aggregate-only and already distinguishes descriptive funnels from unique-user conversion. F1 should extend that same philosophy rather than add identity tracking.

Implementation must preserve the current cost/privacy contract and existing retention rules unless a later independently reviewed change explicitly supersedes them.

No production instrumentation is authorized by this document.
