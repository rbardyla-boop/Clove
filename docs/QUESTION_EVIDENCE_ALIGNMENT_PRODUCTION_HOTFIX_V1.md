# Question–Evidence Alignment Production Hotfix v1

Status: **FROZEN FOR DEPLOYMENT**

Frozen at: `2026-08-09`

## Candidate identity

Candidate manifest SHA-256:

```text
28c484815cecb2f681753a9f1b89e1efdb6f265136a5fe07b4f0832f3ea974dc
```

The hash is the SHA-256 of the sorted `sha256sum` records for the exact
Research Worker deployment inputs:

- every file under `research/` used by the Worker Assets binding;
- every file under `workers/research/src/`;
- `workers/research/wrangler.jsonc`;
- `workers/research/package.json`;
- `workers/research/package-lock.json`.

Recompute from the repository root with:

```bash
{ find research workers/research/src -type f -print0; printf '%s\0' \
  workers/research/wrangler.jsonc \
  workers/research/package.json \
  workers/research/package-lock.json; } \
  | LC_ALL=C sort -z \
  | while IFS= read -r -d '' file; do sha256sum "$file"; done \
  | sha256sum
```

The candidate includes the already-deployed Research assets because Wrangler
deploys the configured Assets binding with the Worker. No homepage, Insights,
cost-authority, D1 schema, discovery adapter, or Cloudflare binding changes are
included in this hotfix.

## Approved production action

Deploy only:

```bash
cd workers/research
npx wrangler deploy
```

Target: `clove-research`, route `clovelearn.io/research/*`.

## Required production replay

The original defect query must return `RESEARCH_REQUIRED` with no population
claim or StatCan population source. The following bounded paths must continue
to behave as before:

- Canada population → population evidence succeeds;
- exact electricity nucleus → succeeds;
- Canadian law → succeeds;
- scientific discovery → remains bounded/research-required;
- unemployment, mortality, immigration, home ownership, conviction-count, and
  study-count questions → do not receive population or substitute evidence.
