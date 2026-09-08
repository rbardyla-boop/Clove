# Paper Firm beta status

Historical audit notes below. For the repaired build and current acceptance
status, read [PAPER_FIRM_BETA_HANDOFF.md](PAPER_FIRM_BETA_HANDOFF.md).

Audit target: Clove `da2abac7bb66dca612b7ab6ff96fd11b10d7bafd`, with RUG
`ba5a877ba0a508da4d9e1ece1bff55a57eebbfc7` as the unchanged authority reference.
Assessment is limited to graphics, First Shift playable loop, and First Shift
endgame. Existing user report that network services are good is recorded as
reported, not independently retested.

## Vision Lock coverage

This phase serves VL-01, VL-03, VL-04, VL-05, VL-06, VL-07, VL-08, VL-09,
VL-10, VL-13, VL-14, and VL-21. No behavior is proposed that weakens or
changes a Vision Lock law.

## Falsifiable filesystem checklist (created before final verification)

- [x] Current Clove head and RUG reference match the stated hashes.
- [~] The field page code contains ruled paper, warm ivory, blue contour,
      perspective/depth, two-direction hatch, visible rules under solids, Desk,
      three zones, Stain, Archive, Relay, Scout, and two human figures.
- [x] Desktop and 390x844 mobile QA-fixture renders have visible content, no
      horizontal overflow, and no uncaught browser errors.
- [~] The primary player path exposes FIND -> CARRY -> EXTRACT -> Desk evidence
      -> PACKAGE -> DELIVER -> OPERATE -> VERIFY/SIGN as gated actions.
- [~] R1 -> R2 replacement path is represented, old work is superseded, and
      RETURN precedes Human A SIGN.
- [~] Endgame code requires the exact tested tuple (artifact hash, R2, harness
      proof id), rejects late/expired invalid cases, and does not use timer
      progress or fake receipts; live execution is unchecked.
- [x] No test creates accounts, real worlds, network proof, or destructive
      reset state; fixtures are explicitly QA-only.

## Verification result

Evidence timestamps are UTC, 2026-09-08.

- 08:22:59 — direct source inspection at the stated Clove/RUG heads.
- 08:23:05 — initial worktree check: heads match; implementer changes were
  untracked; no RUG mutation.
- 08:27:41 — current transition check: `paper-firm.js` now dynamically imports
  the new renderer, but the renderer still requests a 2D context; the linked
  `paper-firm.css` is absent. These are intentional hard failures in the real
  3D browser/static gates below.
- 08:23:xx — pre-transition focused browser/field run: 11/11 passed on Node 22
  with Chromium against the legacy canvas path; this is superseded by the
  clarified real-3D contract and is not a final PASS.
- 08:27:xx — current focused run: play-loop model 6/6 passed; real-3D/field
  browser run 8 passed, 3 failed (missing stylesheet, Canvas2D/no WebGL gate).
- 08:27:xx — current `npm run test:unit`: 1,323 passed, 3 failed; failures are
  the same real-3D/stylesheet gates.
- Screenshot files were not produced: `/workspace/screenshots` was not
  writable. No screenshot evidence is claimed.
- User-reported healthy network services remain unverified; existing 8091/8093
  were not touched.

## Category verdicts

### Graphics — NOT-BETA (P1 contract failure)

Code-supported in the new module: `paper-renderer.mjs:153-222` provides ruled
ivory paper and two-direction hatch; `:255-298` projects depth faces;
`:352-400` draws stick figures/marks. However, the module currently uses
Canvas2D (`paper-renderer.mjs:74-77`) and the browser hard gate requires WebGL2;
the client’s import at `paper-firm.js:70-75` therefore cannot satisfy the
real-3D requirement. The linked stylesheet is also absent at
`index.html:8`. No screenshot visual inspection was possible.

### First Shift playable loop — UNKNOWN

Code-supported: `paper-firm.js:93-131` gates FIND/CARRY/EXTRACT and desk verbs;
`:399-449` gates evidence, packet delivery, offline/return, and SIGN;
`field-core.mjs:192-242` enforces ordered field extraction and archive position.
The QA browser fixture verified the initial disabled next-step and touch
controls only. A real two-authenticated-human run through source → extraction
receipt → desk → package/deliver → operate was not performed by this audit.

### Endgame — UNKNOWN (not live-validated)

Code-supported in the RUG reference: `state.ts:149-165` requires replacement,
offline rejection, ancestry, harness-before-MORNING, and the full spine;
`:304-317` binds READY_TO_SIGN/SIGN to the exact artifact/revision/proof tuple;
`server.ts:406-432` rejects post-deadline harnessing and writes the harness
proof/READY_TO_SIGN sequence; `server.ts:479-493` enforces rejoin-before-SIGN
and records late signatures. No real proof world, network mutation, harness,
or human SIGN was run here.

## Top three gaps

1. P1: replace the Canvas2D renderer with an actual WebGL2/Three.js scene,
   restore the linked stylesheet, and rerun WebGL context, near/design/far,
   no-post, hatch/rule, and orbit-change checks on desktop/mobile.
2. Run a permitted acceptance session with two distinct authenticated humans
   to prove the complete First Shift loop, including actual receipt acceptance,
   R2 replacement, and RETURN-before-SIGN.
3. Exercise endgame negative controls against an isolated QA world: wrong
   artifact/revision/proof tuple, late harness/expired MORNING, and late SIGN;
   verify no READY_TO_SIGN or completion is produced.

## Verification contract

The filesystem checklist above is complete for static/code/browser checks, but
the live-human and live-authority items remain explicitly unchecked. This is an
INCONCLUSIVE near-beta assessment, not a synthetic protocol PASS. The bounded
search stops here because further progress requires the missing renderer
integration and authorized real-world acceptance run.

## Production-upload QA (2026-09-08 08:33 UTC)

Claim tested: the existing production-upload packaging includes the new Paper
Firm renderer, play loop, Three.js vendor files, font, and licenses, and the
packaged output renders on desktop and mobile.

- Code-supported: `scripts/build-curated-client-upload.mjs:120-130` derives
  the upload from `git ls-files`; `scripts/build-production-upload.mjs:97-105`
  copies only that tracked set into an isolated output. The existing secret,
  denied-prefix, and hard-exclusion policy was not broadened.
- Observed: the new runtime files are present in the worktree but absent from
  `git ls-files`; the precise boundary guard at
  `tests/creator/curated-upload.test.mjs:52-73` reports
  `paper-renderer.mjs` as not tracked. The CSS was restored during this run,
  but the new renderer/play-loop/vendor/font/license files remain untracked.
- Observed: isolated `node scripts/build-production-upload.mjs --out
  /tmp/...` packaging completed after CSS restoration, but the packaged
  browser run found `404 /arcade/paper-firm/fonts/Caveat[wght].ttf` on desktop
  before mobile could pass. No deployment or existing service was touched.
- Observed: the focused run ended `11 passed, 4 failed`; failures were the
  source visual pixel gate, source QA-fixture gate, packaged font 404, and the
  precise asset-boundary guard. This is not a browser-render PASS.
- Browser checks implemented at
  `tests/arcade/paper-firm-beta-browser.test.mjs:139-205` cover packaged
  response status/MIME, console/page errors, WebGL2, canvas pixels, and mobile
  overflow. Because packaging is not yet complete, packaged desktop/mobile
  render verdict is NOT-BETA/UNVERIFIED, not a synthetic protocol result.

### Production verdicts

- Asset inclusion: NOT-BETA — new runtime assets are not all tracked, and the
  packaged font request is 404.
- Secret/exclusion boundary: PASS for the existing policy checks; no broad
  public filter change was made.
- Packaged browser desktop/mobile: NOT-BETA — no clean packaged render,
  missing-import/MIME-free result, or mobile completion was established.
- No deployment/network mutation: PASS by scope; no 8091/8093 service was
  started, stopped, or modified, and the user network-health report remains
  reported rather than independently retested.

Top three production gaps:

1. Track/include the renderer, play-loop, vendored Three.js files, font, and
   license assets in the intended release change; do not widen the upload
   filter.
2. Rerun the isolated production packager and packaged browser test after the
   CSS/renderer work settles, requiring clean status/MIME/import/console checks
   on desktop and 390x844 mobile.
3. Resolve the remaining source visual/fixture failures, then separately
   perform the authorized First Shift and endgame acceptance checks.

## Independent gameplay/endgame review (2026-09-08 08:35 UTC)

- `node --test tests/arcade/paper-firm-play-loop.test.mjs`: **6/6 passed**.
  The tests cover authoritative current-packet selection, fresh replacement
  R2 PACKAGE → DELIVER, RETURN-before-SIGN, awaiting/ready/won/late/expired,
  exact artifact/revision/proof invalidation, and non-synthetic return evidence
  (`tests/arcade/paper-firm-play-loop.test.mjs:65-128`).
- Field + play-loop suite: **14/15 passed**. The sole failure is the graphics
  contract’s intentional no-projected-2D gate in
  `tests/arcade/paper-firm-field.test.mjs:103-115`; the gameplay assertions
  pass.
- Client wiring is code-supported: field receipt intake/retry and idempotent
  acknowledgement are at `paper-firm.js:252-291`; ordered field actions are
  sent at `paper-firm.js:493-496`; Desk actions and packet delivery are wired
  at `paper-firm.js:508-531`; GO OFF SHIFT, RETURN, and SIGN are wired at
  `paper-firm.js:545-571`.
- The client UI derives its next action from the shared model at
  `paper-firm.js:411-489`; model gates for extraction, R1 delivery, R2,
  replacement, ancestry, proof, and SIGN are at `play-loop.mjs:118-180`.

### Gameplay verdicts

- First Shift model/gating: **BETA for unit-tested behavior; live browser
  loop unverified**. The required ordered gates are represented and tested,
  but no real two-human/network acceptance run was performed.
- Endgame model: **BETA for unit-tested behavior; live authoritative result
  unverified**. Exact tuple, late, expired, and retry behavior are tested;
  no real proof world or SIGN mutation was used.
- Browser functional fixture: **NOT-BETA/blocked**. The current focused
  browser run also failed the source visual pixel gate and the QA fixture did
  not expose `#field-controls` after connect; this is not treated as evidence
  against the play-loop model until the renderer/CSS transition settles.

Current independent conclusion: gameplay/endgame are ready for a builder-led
browser integration pass, not a final beta verdict. No deployment, account,
world, auth, or existing network service was touched.
