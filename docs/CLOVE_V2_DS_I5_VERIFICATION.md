# CloveLearn v2 — DS-I5 terminal verification

Terminal verdict: **SOLO_HARDENED / HUMAN_EVIDENCE_PENDING**

Issue: #165
PR: #166
Merged canonical commit: `0b3539de91a218c8d7765b1a95873ec427ae7812`
Exact final PR head: `cca5ef5ca288baa5aa14054d06616fcedd65ecc1`
Frozen DS-I5 product/runtime candidate: `fdb15e5d275321cf0772fb65342d914c423110ec`

## Claim tested

Whether Clove can guide one adult through one high-consequence sharing decision by considering copyability, audience widening and future-context risk while keeping the actual content, identity, recipient, platform and context entirely outside Clove.

## Privacy architecture

DS-I5 is **ephemeral by design**.

The runtime stores its current coarse answers only in JavaScript memory for the current page session. Reloading, closing or navigating away resets the drill.

It does not use:
- localStorage;
- sessionStorage;
- IndexedDB;
- cookies;
- URL/query/hash answer state;
- telemetry or network calls for drill answers.

It accepts no free text or upload and never asks for image/video/audio, content text/description, sexual history/orientation, identity, recipient, account/platform, employer/school/relationship identity, exact location or contact information.

## Evidence and safety boundary

The runtime is limited to adjudicated Digital Stewardship findings:
- high-consequence content may be copied, redistributed or seen outside its intended audience/context;
- public or redistributed sexualized content can create context-dependent professional or relationship risks, but those consequences are not inevitable;
- deleting an original later does not guarantee every copy is gone, while removal/delisting can still reduce exposure.

The drill is adults-only and explicitly excludes material involving anyone under 18 and non-consensual intimate material. It contains no shame, purity, worth, gender-value, universal career/relationship penalty, absolute-permanence, legal-advice or evasion language.

## Red → repair → green record

1. Spec, static contract, in-memory state oracle, mutation controls, browser matrix, release-boundary test and PR-only CI existed before the runtime.
2. The draft PR intentionally failed at the first static step because `digital-stewardship-05.html/js` did not exist. All later steps were skipped. This was the required red baseline.
3. The minimum runtime was added in one atomic commit without changing tests.
4. The next run exposed an overbroad mutation-detector ordering: the malicious negative control `Remove metadata so law enforcement cannot identify you` contained the word `cannot`, which the detector incorrectly treated as ordinary negation. The harness was repaired so explicit evasion patterns are checked before negation handling. Product behavior did not change.
5. Static, state and mutation gates then passed and the release-boundary test failed because DS-I5 had not yet been added to production exclusions. This was the required second red gate.
6. Two independent release barriers were added atomically: hard exclusion in `scripts/build-production-upload.mjs` and forbidden sentinels in `scripts/release-preflight.mjs`.
7. DS-I5 then passed its zero-collection static contract, in-memory state oracle, deliberate bad variants, production isolation, JavaScript syntax, Chromium replay and Firefox replay.
8. Full regression exposed latent hosted-runner lifecycle defects in completed I0 and I3 browser harnesses rather than DS-I5 assertions:
   - I0 history navigation could destroy the Playwright evaluation context before `page.evaluate(() => history.back())` resolved. It was repaired to schedule native history navigation asynchronously and then use bounded URL assertions.
   - I3 repeatedly launched new browser processes and used Playwright back/forward waiters. It was repaired to reuse one browser process with isolated contexts and use the same bounded non-blocking native history pattern.
   - These were test-infrastructure changes only; no I0/I3/DS-I5 product behavior changed.
9. Exact final PR head `cca5ef5ca288baa5aa14054d06616fcedd65ecc1` passed DS-I0, DS-I1, DS-I2, DS-I3, DS-I4 and DS-I5 verification.

## Production boundary replay

The final regression preflight reported:
- status: `PASS`;
- public included files: **302**;
- excluded files: **871**;
- hardening exclusions: **110**;
- required Mission 001 runtime present;
- Digital Stewardship 00 through 05 HTML/JS forbidden from production;
- errors: none.

Therefore merging DS-I5 does **not** authorize or cause a public Digital Stewardship release. Mission 001 remains the public product surface.

## Human-evidence boundary

This result does not establish that an independent adult will understand the drill, choose to use it voluntarily, or make a different sharing decision because of it. No comprehension, effectiveness, prevention or behavioral-impact claim is authorized.

## Terminal ruling

**SOLO_HARDENED / HUMAN_EVIDENCE_PENDING**

DS-I5 is complete as a non-public implementation slice. Reopening it requires a concrete defect, new evidence invalidating the evidence/safety boundary, or a separately authorized public-integration gate.
