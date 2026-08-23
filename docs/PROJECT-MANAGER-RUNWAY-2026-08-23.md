# Clove / Publishing Runway — Project Manager Plan

Date opened: 2026-08-23
Owner: Ryan Bardyla
Project manager: ChatGPT
Implementation support: Codex + repository tooling
Repository authority: `rbardyla-boop/Clove`

## Mission

Use the additional month of tool access to remove the reasons Ryan would need to come back online during a three-month digital detox.

We are no longer optimizing for "finished by tomorrow." We are optimizing for a system that is useful, boring, inspectable, recoverable and honest about what it can and cannot do.

The detox start date is now **gate-driven, not calendar-driven**.

## Non-negotiable operating rules

1. Repository artifacts are the source of truth.
2. Do not merge movement PR #172 or Relay PR #173 without Ryan's explicit approval.
3. Do not send external institutional emails without Ryan's explicit approval.
4. Do not publish or schedule an article merely because automation can do it.
5. Human judgment remains the final publication authority.
6. Claims that matter require receipts, counterevidence and a clear status.
7. A successful tool run is not evidence that every future run is safe.
8. Do not convert temporary dates, test fixtures or hypotheses into facts by repetition.

## Current baseline

### Clove Relay

Real-account dry-run path proved on Linux + Brave + Substack:

- authenticated Brave profile access: PASS
- publisher dashboard reachability: PASS
- article creation: PASS
- title insertion: PASS
- subtitle insertion: PASS
- body insertion: PASS
- post-rerender content read-back: PASS
- publish-settings navigation: PASS
- human fallback for ambiguous controls: PASS
- stop before final Schedule: PASS
- local receipt generation: PASS

Stable product decision:

`PREPARATION ASSISTANT / HUMAN FINAL SCHEDULE CLICK`

The fully automated final-click path remains experimental and is not required for launch.

### Detox season

- 26 essays exist in five paste-ready source packets.
- The original August 25-November 20 dates were created for the first detox plan.
- Those dates are now a frozen test fixture, not current publication authority.
- The November return essay remains intentionally unwritten.
- The season still requires a full source/URL/freshness audit before publication freeze.

## Definition of READY FOR DETOX

Detox does not begin until every required gate below is green.

### GATE A — Relay stable mode

Required:

- local tests pass;
- `dry-run` passes on the real account;
- new `prepare` command passes once with a real scheduled post when the final calendar is ready;
- human final-click ownership is documented;
- experimental automated scheduling cannot be confused with the stable path;
- recovery instructions exist for authentication/UI failure.

### GATE B — 26-post evidence audit

Every essay must have:

- external factual claims identified;
- exact source URL or primary document where practical;
- source quality checked;
- publication date/freshness checked;
- claim classified as ESTABLISHED / PROBABLE / HYPOTHESIS / PERSONAL EXPERIENCE;
- strongest material counterevidence retained;
- unsupported causal language removed or downgraded;
- no placeholder/homepage-only citation where an exact source can be recovered;
- no future-dependent factual claim likely to become stale during the detox.

High-risk audit order:

1. THE WEF CLIP WAS REAL. THE MATH WASN'T.
2. GOVERNMENT LIES. THAT DOESN'T MAKE EVERY CONSPIRACY TRUE.
3. DEMOCRACY, MY ASS
4. THE GOVERNMENT LEARNS TO LISTEN
5. CANADA TESTED THE MESSAGE
6. YOU DON'T GET TO KNOW ME WELL ENOUGH TO OPTIMIZE ME
7. MICROTARGETING IS NOT A SNIPER RIFLE
8. WHERE DID THE BOYS GO?
9. THE MARKET FOUND LOOKSMAXXING
10. DO MEN SOMETIMES NEED MEN?
11. MEN WHO WALKED AWAY
12. SCHOOL IS AN ENGINEERED ENVIRONMENT
13. EIGHTEEN IS NOT A NEUROLOGICAL SWITCH
14-26. remaining lower-risk essays

### GATE C — editorial quality

Every essay must survive:

- opening-five-lines test;
- one clear question or claim;
- one quotable line worth carrying away;
- no accidental repetition across the 26-post season;
- humor does not outrun the receipt;
- no AI sludge / generic transition language;
- no fake certainty;
- exact AI disclosure where used;
- no paid-tier, donation or engagement-bait CTA;
- no promise that Ryan will reply while offline.

### GATE D — CloveLearn public landing

Minimum useful public surface:

- what CloveLearn is;
- evidence-status legend;
- corrections policy;
- "show me what would prove you wrong" rule;
- Relay page with status and limitations;
- public evidence/receipt pattern;
- digital stewardship / New Temperance entry point;
- no tracking requirement for core use.

Do not build a giant portal before these pages work.

### GATE E — final season freeze

After the content audit:

- choose final detox start date;
- generate a new Tuesday/Friday calendar;
- rebase dates in manifest and source packets together;
- freeze clock time;
- validate 26/26;
- create final SHA-256/source inventory;
- schedule via Relay preparation-assistant mode;
- human performs every final Schedule click;
- verify all 26 scheduled entries;
- save receipts;
- perform one manual spot-check at beginning, middle and end of schedule.

### GATE F — offline handoff

Before disconnecting:

- one-page recovery note;
- local backup of final publication packet;
- GitHub branch/commit recorded;
- no pending external message requiring a reply;
- no draft claimed as published;
- no scheduled article dependent on future facts;
- return essay remains blank except working title;
- analytics/KDP/Substack checking removed from the detox operating loop.

Target verdict:

`READY_FOR_DETOX — SYSTEM FROZEN / HUMAN DECISIONS COMPLETE`

## Four-week runway

Dates are planning windows, not artificial deadlines.

### Phase 1 — Stabilize and inventory | Aug 23-30

Deliverables:

- freeze Relay preparation-assistant mode;
- add explicit `prepare` / `prepare-batch` commands;
- update Relay status/docs/PR;
- mark original detox dates as superseded launch dates;
- build 26-post evidence-audit ledger;
- inventory CloveLearn pages and movement assets;
- separate stable work from experimental automation.

Kill rule: do not spend more time chasing full autonomous Substack control unless stable preparation mode is blocked.

### Phase 2 — Evidence trench | Aug 31-Sep 6

Deliverables:

- audit high-risk political/institutional posts first;
- recover exact source pages/PDFs/archived versions where current URLs are weak;
- audit men/boys and looksmaxxing posts;
- build correction/counterevidence fields;
- flag claims that need rewriting rather than more research.

Kill rule: a claim that cannot earn support gets cut or explicitly labeled hypothesis.

### Phase 3 — Editorial + public infrastructure | Sep 7-13

Deliverables:

- full 26-post editorial pass;
- CloveLearn minimum public landing surface;
- Relay free-product documentation;
- evidence ledger/corrections templates public-ready;
- reader navigation from Substack -> CloveLearn receipts where useful.

Kill rule: do not add features that do not help a reader understand, verify or use the work.

### Phase 4 — Freeze and launch simulation | Sep 14-20

Deliverables:

- final calendar selected;
- all dates rebased and source packets re-frozen;
- final manifest validates;
- one `prepare` command real-world qualification;
- 26-post scheduling session using human final clicks;
- scheduled-area verification and receipt bundle;
- 48-hour no-change soak unless a material factual error is found;
- offline handoff document.

Detox begins only after the exit gates pass. If a gate is red, the start moves. No drama.

## Work allocation

### ChatGPT — project manager / editor / evidence controller

- choose next task;
- maintain gates and status;
- edit prose;
- run research and adversarial fact checks;
- update repo planning/status artifacts;
- prevent scope creep;
- decide when a technical experiment has stopped earning its time.

### Codex — implementation / test worker

Use for bounded repository tickets with explicit pass/fail gates:

- Relay CLI/tests/refactors;
- date-rebase tooling;
- CloveLearn page implementation;
- source-ledger tooling;
- link checker;
- static-site validation;
- packaging and release checks.

Codex does not decide claims, publication judgment, or whether a research conclusion is true.

### Ryan — human-only decisions

Ryan is needed for:

- lived-experience accuracy;
- whether a joke/line still sounds like him;
- final publication approval;
- final schedule click;
- external correspondence approval;
- deciding the actual detox start when the gates are green.

Everything else should be offloaded where possible.

## Scope-control rule

When a new idea appears, ask:

> Does this materially improve the three-month offline system, the evidence quality, or the reader's ability to verify/use the work?

If no, park it.

The month is not permission to create thirty new projects. It is time to make the existing machine dependable.
