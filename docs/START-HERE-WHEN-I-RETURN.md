# Start Here When I Return

Status: `HANDOFF SCAFFOLD / DETOX NOT STARTED`

This note is deliberately honest about unfinished gates. It is a recovery map, not evidence that the detox is ready or that any article was published.

## Current project state

- Branch: `product/clove-relay-v0.1`
- Final freeze commit: **PENDING — record the exact SHA after all human decisions and final source-packet hashing.**
- Detox start: **NOT CHOSEN**. The start remains gate-driven and requires Ryan's decision.
- Publication schedule: **NONE is current launch authority.** `relay/examples/detox-season.yml` and the five source packets retain the original dates as a test fixture.
- Return essay: **UNWRITTEN.** Working title only: `I DISAPPEARED FROM THE INTERNET FOR THREE MONTHS. HERE'S WHAT ACTUALLY HAPPENED.`

## Gate snapshot at handoff

- Relay preparation path: qualified on a real Linux + Brave + Substack account.
- Stable `prepare` / `prepare-batch`: implemented; a final real `prepare` smoke test remains pending for the final calendar.
- Final Schedule click: human-owned in stable mode.
- Automated final-click modes: experimental only (`qualify`, `schedule`).
- Evidence audit: incomplete; do not infer that an essay is source-checked because it has a URL.
- Editorial audit: incomplete.
- Calendar freeze: not performed.
- 26-post scheduling: not performed.
- Scheduled-area verification: not performed for the final season.

## Relay state and receipts

- Relay version: `0.1.0`.
- Local auth/session state: `.relay-auth/` (git-ignored; do not copy into chat or commit it).
- Local receipts: `.relay-receipts/` (git-ignored; archive the final bundle locally before disconnecting).
- Stable receipt result: `HUMAN_SCHEDULE_VERIFIED`, with `final_action=human_schedule_click`.
- Experimental receipt result: `EXPERIMENTAL_RELAY_SCHEDULE_VERIFIED`, with `final_action=relay_schedule_click`.
- No receipt result means “published” unless a separate, explicit platform verification establishes that fact.

## Final-freeze procedure

1. Finish the evidence and editorial gates; cut or downgrade claims that cannot earn support.
2. Ryan chooses the actual detox start date and clock-time policy.
3. Preview the calendar with `clove-relay calendar-rebase ... --dry-run`.
4. Review the preview, then explicitly apply it and run `--check`.
5. Record SHA-256 hashes of the final five source packets and manifest here.
6. Run one real `clove-relay prepare` against the final calendar. Ryan performs the final Schedule click and visible date/time/audience confirmation.
7. Run the final `prepare-batch` only after that gate is green. Stop on any ambiguity.
8. Verify all 26 scheduled titles and archive the receipts.

## Emergency recovery

From the repository checkout:

```bash
cd relay
source .venv/bin/activate
python -m pytest -q
clove-relay validate examples/detox-season.yml
```

For a browser/session problem, close Brave completely and run `clove-relay brave-check ...`. Do not delete browser lock files, paste credentials into Relay, use the experimental scheduler, or fall back to immediate publication. If a scheduled post is wrong or missing, record the title, visible state, screenshot/receipt path and exact failure before touching the next post.

## Things not to infer from silence

- No reply does not mean an institution agreed, received a message, or resolved a request.
- No receipt does not mean a post was published.
- A scheduled title does not by itself prove the date, time, audience or delivery setting was correct.
- A URL does not mean an essay's claim was source-checked or current.
- A quiet analytics dashboard is not a detox result and does not require monitoring.

## Deliberately left unresolved

- actual detox start date and final Tuesday/Friday calendar;
- final evidence/editorial status of all 26 essays;
- final real-account `prepare` qualification on the frozen calendar;
- final 26-post human scheduling and verification;
- final packet hashes and receipt archive;
- the lived result and return essay.

Do not write the return essay until Ryan has actually returned and can describe what happened.
