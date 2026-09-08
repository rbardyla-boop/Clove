# Paper Firm — 3D beta candidate

Date: 2026-09-08. Branch: `paper-firm-beta-20260908`.
Base: Clove `da2abac7bb66dca612b7ab6ff96fd11b10d7bafd`.
RUG reference: `ba5a877ba0a508da4d9e1ece1bff55a57eebbfc7`; unchanged.

## Current verdict

Local 3D/client beta candidate: ready for human acceptance. Not a live
organization proof and not a measured “95% complete” claim.

- Actual locally bundled Three.js/WebGL2 meshes and perspective orbit/zoom.
- Ruled paper continues through derivative-filtered blue crosshatching;
  no PBR lighting or sketch postprocessing. Desk, Archive, Stain, Relay,
  doodle actors, tape, verification/rejection and ancestry marks.
- Mobile layout, explicit objective/deadline, one next action, proof details,
  return receipt, and ready/won/late/expired outcomes.
- R2, fresh replacement PACKAGE → DELIVER, and RETURN before SIGN remain
  mandatory. “Open another world” leaves the original authoritative world intact.
- Missing renderer errors are visible. Runtime diagnostics measure actual
  geometry, camera, marks and resource counts instead of self-grading PASS flags.

## Reproduce local checks

Latest local combined run: **1,334 tests passed, 0 failed** (includes six
browser checks and the release-boundary suite). Git diff whitespace check passes.

```sh
npm ci
npx playwright install chromium
node --test tests/arcade/*.test.mjs tests/creator/*.test.mjs tests/static/ds-i1-release-boundary.test.mjs
```

The browser suite serves source and the real curated production package,
checks both desktop and 390×844 layouts, imports/MIME/errors, camera changes,
and actual mesh rendering. It also checks GPU resource counts remain stable
across forty repeated scene updates.

The six browser tests include **isolated synthetic fixtures** for human roles,
FIND, R2/replacement delivery, RETURN/SIGN and outcome screens. They do not
authenticate real humans, call models, kill workers, or mint live proof.

Screenshots are saved in `proof/screenshots/`. The art-evidence and endgame
images are explicitly fixtures, not receipts of a completed real match.

## Next action — human acceptance only

Use the laptop and Pixel 9 Pro XL with two distinct authenticated principals
against the intended real RUG/Clove test world. Verify actual movement, touch
comfort and device frame rate, finish the First Shift loop, disconnect/rejoin,
real worker kill/replacement, revised requirement, external harness and human
SIGN. Save the persisted ledger receipt, finish/state/artifact hashes and recording.

The user's network-good report remains user-reported, not independently
re-certified by this graphics pass. No network, authentication, worker authority
or RUG source was changed. No merge or deployment is authorized by this handoff.

## Efficient continuation

Read this file first, inspect Git status/latest diff, and run only affected
checks before the full release check. Preserve the older dirty worktrees.
Luna completed the initial split implementation; after its usage limit the
user authorized direct repairs. Token use was reduced through bounded file
inspection, targeted test reruns and compact reports; no reliable exact token
counter was available, so no token-savings number is claimed.
