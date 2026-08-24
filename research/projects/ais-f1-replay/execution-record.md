# AIS F1-REPLAY — Execution Record

This file preserves the public execution facts from the August 11, 2026 replay record. It is intentionally not rewritten to hide failed first attempts.

## Local canonical-state replay

Command recorded:

```text
python fresh_context_recovery.py /mnt/data/AIS_F0_F1_v0.1
```

Result: **6/6 checks PASS**.

## GitHub Actions forensic run 31543273903

Historical source was checked out at exact SHAs.

- Cognitive LLAM: `cargo test -p cognitive-llam-episode` → **12 passed, 0 failed**.
- Cognitive PANORAMA terminal revision: `cargo test -p cognitive-demo --lib` → **794 passed, 0 failed**.
- Cognitive learner/session terminal revision: `cargo test -p cognitive-demo --lib` → **627 passed, 0 failed**.
- Cognitive SCORE/FAIL/promotion terminal revision: `cargo test -p cognitive-demo --lib` → **375 passed, 0 failed**.
- Clove resource budget: `node --test labs/voxel-bench/test/chunk-manager.test.mjs` → **23 passed, 0 failed**.

### Proto first attempt

- `python -m compileall -q harness cognitive-os` → PASS.
- `python -m pytest -q` → collection failure with **6 errors**.

That failure is preserved.

### Powerplant first full-suite attempt

- `npm ci` → PASS, with **8 dependency vulnerabilities disclosed**.
- `npm test` → **656 passed, 13 failed, 20 skipped**.

That result is preserved even though later, narrower source-unchanged replays passed.

## Powerplant focused run 31543633851

Pinned revision: `d024efa2bd0f0171c08eb1079983d81e77ab96b8`

AIS-relevant source-unchanged replay:

- 10 test files passed.
- 163 tests passed.
- `npm run build` passed.

## Poly replay attempt 31543708121

Requested revision: `bbe8fa1edae877f7a9f957adbaba3568c2b3ba45`

Checkout failed three times before code execution:

```text
remote: Repository not found.
fatal: repository 'https://github.com/rbardyla-boop/poly/' not found
```

The isolated Clove GitHub Actions token could not access the private archived repository. No trainer output was fabricated and the historical numerical result was not promoted.

## Powerplant later-state run 31543756145

Pinned revision: `8c0c8d7e8c77a51ec7bd4ae6f846482f72e9acf9`

Source-unchanged replay:

- 9 targeted test files passed.
- 173 tests passed.
- `npm run build` passed.
- Pinned dependency tree again disclosed 8 vulnerabilities: 3 moderate, 4 high, 1 critical.

## Cleanup boundary

The temporary replay workflow was removed from the isolated replay branch after the recorded runs. It was **not merged into `main`**.

Removal commit recorded by the replay package: `79915dc72dafa64ef87d0f415297eda3158e2e3d`.

## Interpretation boundary

The record establishes reproduction of a bounded AIS foundation. It does not establish adaptive routing, superior intelligence, AGI, recursive self-improvement, topology optimality, or the validity of unreproduced historical numerical claims.
