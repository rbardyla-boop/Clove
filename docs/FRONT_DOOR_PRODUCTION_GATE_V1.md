# CloveLearn Front Door Production Gate v1

Status: **FROZEN FOR DEPLOYMENT**

Frozen at: `2026-08-09`

## Candidate identity

Candidate manifest SHA-256:

```text
cc53cc63e564320e14b9a6d8b44e107a6a13c81f77b1dcd4a237fcf3d209725a
```

The manifest is the sorted `sha256sum` record of the 308 regular files in the
static upload candidate:

- 307 committed static baseline files matching the live upload manifest;
- the preserved `_UPLOAD_MANIFEST.json`;
- current approved `index.html` overlay;
- current approved `hub.css` overlay.

Approved overlay hashes:

```text
index.html  dbd4909507f349c54ad637d498031227fadac0f09d08657f401d58feb3d16c16
hub.css     b63347ae242bf4137029d1132243337af764448b29852fb25778291f9c985543
```

The candidate excludes local `agent/`, `research/`, `docs/`, `tests/`,
`workers/`, `.env`, and dependency paths. No Research Worker, Insights Worker,
cost authority, schema, discovery, or evidence files are included.

## Deployment command

```bash
npx wrangler deploy \
  --name wild-hat-6257 \
  --assets /tmp/clove-front-door-v1-clean.7cjIU8 \
  --compatibility-date 2026-08-09
```

## Measurement boundary

`BETA_BASELINE_T0 = 2026-08-09 after Measurement Access Gate PASS` remains the
commissioning boundary. Since Insights stores daily aggregates, clean beta
queries begin with:

```sql
WHERE day > '2026-08-09'
```

