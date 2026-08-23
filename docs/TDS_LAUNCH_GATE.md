# TDS — KDP × CloveLearn Synchronized Launch Gate

## Hard rule

**Do not publish/announce TDS on KDP until the CloveLearn TDS hub is ready to go live the same day.**

The book promises readers a live evidence system. That promise must be true at launch.

## Staging branch

`tds-launch-hub`

Current staged page:
- `/tds.html`
- `noindex,nofollow` by design
- purchase button disabled by design

## Launch dependencies

### BOOK
- [ ] Manuscript line edit complete
- [ ] Claim/legal pass complete
- [ ] Archive-level WEF/Poilievre/Trudeau closeouts complete or explicitly marked unresolved
- [ ] KDP interior final proof complete
- [ ] Print wrap frozen from final page count
- [ ] eBook proof complete
- [ ] KDP title/subtitle/byline exact: Ryan Bardyla
- [ ] KDP description/keywords/categories/pricing frozen
- [ ] KDP product URLs captured after listing exists

### CLOVELEARN TDS HUB
- [x] Staging branch created
- [x] Staging `/tds.html` created
- [ ] Final cover asset added
- [ ] Final KDP purchase links inserted
- [ ] Noindex removed at launch
- [ ] Author's Shelf updated with TDS card
- [ ] Claim ledger published in web-readable form
- [ ] Myths We Killed published
- [ ] Digital-archaeology notes published for contested/deleted-source claims
- [ ] Permanent corrections log created
- [ ] Reader tools have real URLs; no placeholder `#` links remain
- [ ] Mobile proof
- [ ] Desktop proof
- [ ] Accessibility/keyboard proof
- [ ] Link check
- [ ] Cloudflare deploy proof

### READER TOOLS REQUIRED AT LAUNCH
At minimum:
1. Swap the Jerseys
2. Show Me the Fucking Denominator
3. Who Picked This for Me?
4. Remove the Name

These may be lightweight static worksheets at launch. They do not need accounts, tracking, or cloud storage.

## Release sequencing

### T-14 to T-7 days
- Freeze manuscript except factual/legal corrections.
- Freeze cover creative.
- Populate TDS hub with final evidence summaries.
- Build correction log and archive registry.
- Build/verify reader tools.

### T-7 to T-2 days
- Upload KDP manuscript/cover as draft.
- Use KDP previewer and physical-proof workflow as applicable.
- Do not publicly announce a firm live URL until listing exists.
- Proof CloveLearn staging branch.

### T-1 day
- Confirm KDP listing/product URL availability state.
- Insert final purchase URL into staged TDS page.
- Final link crawl.
- Confirm CloveLearn page still has `noindex,nofollow` until release action.

### LAUNCH DAY
1. Make KDP listing live/confirm purchasable.
2. Merge/deploy `tds-launch-hub` changes.
3. Remove `noindex,nofollow` from `/tds.html` in launch commit.
4. Verify `https://clovelearn.io/tds.html` from an external browser.
5. Verify purchase button lands on the correct KDP listing.
6. Verify claim ledger, corrections, archive notes, and tools.
7. Publish Substack launch essay linking to both the book and CloveLearn evidence hub.
8. Only then publish broad social announcements.

### T+1 to T+7 days
- Watch for broken links and reader corrections.
- Log every correction publicly rather than silently changing claims.
- Add high-value reader questions to FAQ/evidence hub.
- Keep book sales copy separate from evidence-status language.

## Failure policy

If KDP is live and the CloveLearn hub is not ready:
- do not run the full launch campaign;
- fix/deploy the evidence hub first;
- then announce.

If CloveLearn is ready but KDP is delayed:
- keep `/tds.html` no-indexed on the staging branch;
- do not merge just to meet an arbitrary date.

If a major factual claim breaks during launch week:
- hold the relevant marketing claim;
- correct the manuscript/listing if necessary;
- publish the correction trail.

## Canonical public promise

> **The book is the story. CloveLearn is the receipt drawer.**

> **Don't fucking trust me either. Check the receipts.**
