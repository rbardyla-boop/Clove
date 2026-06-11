# Fable Next City-Arcade Build — Findings (local-only)

**Branch:** `feat/fable-next-city-arcade-density` (off `main` @ 07cfac2, the PR #63 merge).
**Status:** BUILT. Five streams, validated at the end via the full ladder. Nothing deployed;
no Worker/DO/wire/migration change (workers diff vs main = 0 lines by construction); CF-7
stays disabled; the lab stays denylisted and production-unimported.

## What was built

1. **City street life** (`arcade/city/city-street-life.mjs`): one ambient scenery line per
   block ("A tram hums through the crossroads…"), rotated deterministically on a coarse
   90-second client-time bucket — closed 6×3 copy table, FORBIDDEN_RE-screened, no numbers,
   no tone-vocabulary overlap with the W-5 mood screens. Rendered under the mood line on
   desktop, hidden on phones (the narrow tray keeps its budget). Pure function of
   (city_id, now): two clients in the same bucket read the same street.
2. **Cabinet variant stress pack**: three new closed procedural variants in the arcade
   builder — `split-pulse`, `rail-runner`, `echo-grid` (8 total). Same head/tail SDK
   contract, tap-only input, proposal-only results, zero capabilities; every variant passes
   the CF-4 importer scan.
3. **Creator throughput**:
   - `arcade/creator/validator/issue-explainer.mjs` — a closed pattern→hint table that
     renders one friendly, actionable line under each validator error in BOTH editors.
     Strictly explanatory: the shared validators remain the only gate; unknown errors
     simply render without a hint.
   - Builder **templates** — five named parameter presets; picking one just sets the closed
     controls and re-runs the importer gate.
   - Builder **bundle export/import** — one `.builder.json` carrying params + the gated
     build. Import restores PARAMETERS ONLY; bundled source/manifest are deliberately
     ignored and everything regenerates through the closed tables + importer (the smoke
     proves a malicious bundled `game.mjs` never reaches the generated output).
4. **W-6 lab stress harness** (`arcade/hiveworld-agents/attention-stress.mjs`): claims S1–S8
   at 2000-round / 6-room / 24-cabinet scale across seeds 42/1337/9001 — scaled
   replay/reorder determinism, rejected-event flood convergence (the C3-class defect stays
   pinned), identity-less malformed-flood collapse to one `'?'` audit entry, mixed-storm
   stability, conservation, attack completeness, and block-surfacing rollup discipline
   (bound cabinets only). Plus `write-evidence-artifacts.mjs`, which regenerates the
   checked-in, byte-stable JSON artifacts under `docs/lab/`.
5. **Operator surface** (`docs/lab/README.md`): what the lab proved, what broke, what must
   never ship, and the candidate future production slices — all local Markdown/JSON; no
   live admin tooling.

## What broke (and what it taught)

- **My own tone screen caught my copy, twice.** Street lines "rolls in low" and "high
  walkways" tripped the no-mood-tone-vocabulary test (the words `low`/`high` belong to the
  W-5 internal tone enum). Reworded. Lesson: the cross-surface vocabulary screens are doing
  exactly their job — new flavor surfaces must be written against ALL existing screens, not
  just FORBIDDEN_RE.
- **Bucket-alignment test bug (mine):** the determinism test compared `now` and
  `now + BUCKET − 1` without aligning `now` to a bucket boundary. Test fixed, module was
  correct.
- **Explainer phrasing drift:** the arcade manifest validator says "forbidden content or
  economy term" while the asset-pack validator says "forbidden economy term" — the hint
  pattern initially matched only the latter. Caught by the builder smoke; pattern widened.
  Lesson: hints must target each validator's REAL phrasing; the unit test now pins both.
- **Audit-identity subtlety (design note, not a bug):** an event with a NUMERIC id
  (`event_id: 7`) is malformed but still carries dedup identity (`'7'`), unlike identity-less
  events which collapse to `'?'`. The stress flood is therefore strictly identity-less, and a
  unit test pins the numeric-id behavior separately.

## Validation (all run on the final tree)

- arcade units: **722 pass / 0 fail** (708 + 6 street-life + 8 stress)
- creator units: **175 pass / 0 fail** (169 + 6 issue-explainer)
- browser smokes: block-mood (21 checks, incl. 3 new street-life), city-district,
  world-map, district-activity, arcade-builder (incl. 8-variant sweep + template + hostile
  bundle import + hint), district-editor (incl. hint) — **all PASS**
- evidence: seed-42 pack C1–C10 **pass**, stress suite S1–S8 × 3 seeds **pass**; artifacts
  regenerate byte-identically (diff-verified)
- production config check: **PASS** · city size check: **PASS**
- curated upload: creator/lab/virtual-arcade excluded; `city-street-life.mjs` included
  (it ships with the city page)
- boundaries: no production import of `hiveworld-agents/`; lab imports nothing from
  `workers/`; forbidden-language grep over public city surfaces clean
- workers: **diff vs main = 0 lines** (no dry-run needed — nothing changed)

## What should never ship (unchanged, restated)

Exit kinds, person-shaped accounts, balance/payment vocabulary, free-text memos, per-person
attribution, creator-receivable surfaces. See `docs/lab/README.md` for the binding list.

## Recommended cleanup pass

- None blocking. Optional polish: the street-life table could grow to 4–5 lines per block
  if the city should read less repetitive across a long session; and the explainer could
  cover the remaining rare validator phrasings (hints are optional by design, so gaps are
  cosmetic).

## Next gate

Operator review + merge of this branch, then (separately) the W-6 production PLAN gate:
the required sim evidence now exists at two scales (`attention-evidence-seed42.json`,
`attention-stress-suite.json`), but planning, building, or wiring any production attention
ledger remains operator-authorized work — not started here.
