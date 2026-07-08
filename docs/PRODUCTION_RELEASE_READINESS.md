# Production Release Readiness — current `main`

Release-prep record for a **manual dashboard upload** of the current curated client
package. **No deploy is performed by this document or the sprint that produced it.**

## Source

- **Live-facing content:** `main` @ `86cdd8d` (PR #144 — Voxel status doc + 3 product
  fixes + Slice 8 threat model). The three product fixes are already merged into `main`.
- **This closure sprint (`finish/project-closure-release-prep`) adds only non-live-facing
  changes** — an audit-harness fix (`scripts/product-audit.mjs`, a Node dev tool never
  loaded in the browser) and documentation (`docs/`, excluded from the upload). Therefore
  the **deployable surface is byte-identical to `86cdd8d`**; deploying "current main" ships
  exactly the PR #144 live fixes and nothing new.

## Package

- **Build command (reproducible, rebuild at deploy time):**
  ```bash
  node scripts/build-curated-client-upload.mjs --out <dest-dir>
  ```
  Optional dry list: `node scripts/build-curated-client-upload.mjs --list`.
- **File count:** **296** live files + `_UPLOAD_MANIFEST.json` (verified this sprint;
  583 files excluded by the curated denylist).
- The builder `rm`s and recreates `<dest-dir>`, copies the curated tree, and writes
  `_UPLOAD_MANIFEST.json` (keys: `source`, `file_count`, `excluded_count`,
  `arcade_creator_excluded`, `arcade_city_included`, `forbidden_prefixes`).

## Included live-facing fixes (from PR #144)

| Page | Fix |
|---|---|
| `opposite-action-drill.html` | null-safe emotion-label helper (fixes `charAt` null-deref) |
| `cfhs-analyzer.html` | guarded clipboard writes + `fbCopy` fallback (no unhandled rejection) |
| `mindfulness-drill-full.html` | mobile `@media` breakpoint (fixes 54px h1 overflow) |

All three are pure defensive hardening — no happy-path behavior change, no new surface.

## Excluded surfaces (verified 0 files each in the built package)

- `labs/` (Voxel Lab — **curated `labs/` count = 0**), `docs/`, `tests/`, `workers/`
  (Cloudflare Worker/DO source — deployed separately via wrangler, **not** in this static
  upload), `arcade/creator/` (except the enumerated public local-maker allowlist),
  `arcade-studio/`, `arcade/hiveworld-agents/`, `arcade/virtual-arcade/`, `atip/`,
  `.foundry/`, `.claude/`, `.github/`, `node_modules/`, `dist/`.
- Enumerated dev bundlers excluded by exact filename (`build-creator-workshop-bundle.mjs`,
  `build-creator-editor-*.mjs`), plus `package.json`/`package-lock.json`/`.gitignore`.

**Known, accepted, pre-existing package characteristic:** `scripts/` **does** ship, because
the production city loads vendored browser libraries from it (`three.min.js`, `pdf.min.js`,
`tesseract*`, and browser Web Workers `pdf.worker.min.js` / `tesseract-worker.min.js` /
`stt-worker.js`). A handful of inert Node dev scripts (`product-audit.mjs`,
`check-city-build-size.mjs`, `embed-benefits.py`, `setup-semantic.sh`,
`build-curated-client-upload.mjs`) ride along as **dead weight** — never referenced by any
HTML, never executed client-side. This is unchanged from prior releases. Trimming them is a
separate, optional packaging-hygiene gate (not done here to avoid risking exclusion of a
real browser asset). The `*worker*` filenames above are **browser Web Workers**, not
Cloudflare Workers/DO.

## Manual dashboard upload steps

Production is **dashboard-upload-only — there is no verified CLI deploy path** for this
static host. Steps:

1. Rebuild the package fresh from the commit to deploy:
   `node scripts/build-curated-client-upload.mjs --out /tmp/clove-upload`.
2. Confirm the package before uploading:
   - `find /tmp/clove-upload -path '*/labs/*' | wc -l` → **0**
   - the 3 fixed pages exist under the package root
   - `_UPLOAD_MANIFEST.json` `file_count` = 296
3. Open the Cloudflare Pages dashboard for the clovelearn.io project.
4. Create a new deployment and upload the **contents** of `/tmp/clove-upload` (the files
   at the package root — do not nest the folder).
5. Wait for the deployment to finish and note the new deployment ID.

## Post-upload verification checklist

- Load `opposite-action-drill.html`: advancing/saving without selecting an emotion does
  **not** throw (no `charAt` console error).
- Load `cfhs-analyzer.html`: a COPY action either copies or silently falls back — **no**
  unhandled-rejection console error.
- Load `mindfulness-drill-full.html` at 390px width: **no horizontal scroll**; hero title
  fits.
- Confirm a freshness marker / hard-refresh (query-string cache-bust) reflects the new
  upload — a byte-identical result across repeat cache-purge cycles means the upload never
  landed, not a stubborn cache.
- Spot-check an unaffected page (e.g. `deck.html`) still loads and navigates.
- Confirm `labs/*` is **not** reachable (the lab never ships).

## Rollback

Cloudflare Pages retains prior deployments. To roll back, open the project's Deployments
list in the dashboard and **Rollback** to the previous deployment (the one before this
upload). No repo change is required to roll back.

## No deploy performed

This sprint built and verified the package locally only. **No `wrangler`, no Pages upload,
no production mutation was executed.** Production remains on its prior deployment until an
operator performs the manual upload above.
