# Production beta hotfix 001

Status: **LOCKED FOR REDEPLOY**  
Parent candidate: `b2e9b0bc48eeda8b214d034bfb6c13c909cb88e50b1c83a770490750b23b57fd`  
Hotfix candidate manifest SHA-256: `330e7e918abea43c52aadd99998011fdf2027c4f1bbfcf420f8616e35e1294f7`

## Defect proven in production

The deployed route `clovelearn.io/research/*` serves `/research/` and descendant
paths, but the research client submitted investigations to the bare `/research`
path. Production verification returned:

- `POST /research` → `404` with an empty body.
- `POST /research/` → `200`, with `QUALIFIED`, `QUALIFIED`, and
  `RESEARCH_REQUIRED` for the population, federal-law, and science paths.

## Minimal repair

`research/research.js` now posts investigations to `/research/`. No Worker
binding, route, research logic, cost logic, or signal vocabulary changed.

The browser regression fixture was updated to exercise the routed slash form.
The hotfix hash uses the original candidate manifest; test files and this record
are not part of the deployed Worker artifact.

Required action: redeploy only `clove-research` from this hotfix tree. The already
deployed cost authority remains unchanged.
