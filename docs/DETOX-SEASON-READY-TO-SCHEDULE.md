# Detox Season — Publication Packet Status

Status: `26 ESSAYS DRAFTED / ORIGINAL DATES FROZEN AS TEST FIXTURE / EVIDENCE AUDIT + FINAL REBASE REQUIRED`
Original freeze date: 2026-08-23
Original cadence: Tuesday + Friday
Current launch authority: **NONE — detox start deferred until readiness gates pass**

## Important change on 2026-08-23

The original plan assumed the digital detox would begin immediately. That constraint changed: the build/research runway now continues for roughly another month.

Therefore the dates embedded in these five source packets and in `relay/examples/detox-season.yml` must **not** be treated as the final publication calendar.

They remain useful as:

- a frozen test fixture for Relay;
- proof that the 26-post sequence is internally complete;
- the baseline from which a final calendar can later be rebased.

Before final scheduling, the dates in the manifest and source packets must be changed together and revalidated.

## Already published — do not schedule again

- Rub Dirt on It Is Not a Health Strategy
- My Red Hand
- The Degree Is Not an Infinity Stone

## Frozen source packets

1. `DETOX-SEASON-01-WEEKS-1-3-PASTE-READY.txt`
   - Where Did the Boys Go?
   - The Market Found Looksmaxxing
   - Equal Does Not Mean Identical
   - Do Men Sometimes Need Men?
   - The Library of Alexandria Is 24 Inches From Your Nuts
   - The Vanishing Pause

2. `DETOX-SEASON-02-WEEKS-4-6-PASTE-READY.txt`
   - We Lost the Denominator
   - The Crowd You Think Exists
   - Democracy, My Ass
   - The Outvoted Person
   - The Government Learns to Listen
   - Canada Tested the Message

3. `DETOX-SEASON-03-WEEKS-7-9-PASTE-READY.txt`
   - You Don't Get to Know Me Well Enough to Optimize Me
   - Microtargeting Is Not a Sniper Rifle
   - The Algorithm Didn't Brainwash You
   - The Worst Five Minutes
   - The WEF Clip Was Real. The Math Wasn't.
   - Government Lies. That Doesn't Make Every Conspiracy True.

4. `DETOX-SEASON-04-WEEKS-10-11-PASTE-READY.txt`
   - What Do I Mean When I Say I Made Up My Own Mind?
   - The Person Gets Veto Power Over the Stereotype
   - I Think I Was Collecting Evidence From a Rigged Experiment
   - Don't Just Tell a Boy He Matters

5. `DETOX-SEASON-05-WEEKS-12-13-PASTE-READY.txt`
   - School Is an Engineered Environment
   - Eighteen Is Not a Neurological Switch
   - Men Who Walked Away
   - The New Temperance

## Return slot

Do **not** prewrite a fabricated detox result.

Working title only:

> I DISAPPEARED FROM THE INTERNET FOR THREE MONTHS. HERE'S WHAT ACTUALLY HAPPENED.

Write it after the experiment using the actual lived result.

## Required work before final freeze

### 1. Evidence audit

Every external factual claim must be checked against the strongest reasonably available source. Exact article/PDF/statute/report URLs are preferred over homepages or search results. Where deletion/scrubbing is plausible, use the digital-archaeology standard: archived pages, historical URLs, mirrored documents and contemporaneous references before concluding evidence is absent.

Each material claim should end in one of:

- ESTABLISHED
- PROBABLE
- HYPOTHESIS
- PERSONAL EXPERIENCE
- CUT

### 2. Editorial audit

Each article must keep:

- strong opening;
- one clear argument/question;
- counterevidence where material;
- joke/analogy separated from literal factual claim;
- exact AI disclosure where used;
- no paid/donation CTA;
- no promise of replies while offline.

### 3. Calendar rebase

After the final detox start is chosen:

- preserve the Tuesday/Friday rhythm unless deliberately changed;
- update source-packet `SCHEDULE` dates;
- update `relay/examples/detox-season.yml` dates;
- freeze the clock time;
- rerun validation;
- create final hashes.

### 4. Scheduling mode

Stable Relay v0.1 operating mode is preparation assistant + human final Schedule click.

For one post:

```bash
clove-relay prepare examples/detox-season.yml \
  --post 1 \
  --default-time 09:00 \
  --browser brave
```

For the final batch:

```bash
clove-relay prepare-batch examples/detox-season.yml \
  --default-time 09:00 \
  --browser brave
```

Do not run the final batch against the old fixture dates.

## Evidence freeze rule

The original drafts were written against sources available by 2026-08-23. The final freeze will move that boundary forward. At final audit, any claim that can materially change during the three-month offline period must either:

- be rewritten as a dated historical statement;
- be sourced to a stable primary record;
- be removed;
- or be explicitly bounded so later events cannot silently make the scheduled copy false.

## Digital-detox integrity

Scheduled publishing does not require monitoring publishing.

No essay should require checking views, likes, comments, X, KDP or Substack analytics during the detox.

The goal is not to automate being online. The goal is to finish the human decisions before going offline.
