# Neon Circuit — Phase 1 Merge Sequence

This document is the **landing plan** for the Phase 1 product stack. It is
descriptive only: this closure workflow performed **no merges, pushes, rebases, or
PR opens**. Execute the steps below only with explicit authorization.

> **Warning:** Do not open Phase 1l directly against `main` until the upstream
> phases land, unless you intentionally want one giant stacked PR. Each phase is a
> single commit; landing them in order keeps the history reviewable.

## Current stack map

```
origin/main  a7dd926   ← real integration target (Phase 1b+1c merged via PR #1/#2)
local  main  6318921   ← BEHIND origin/main by the PR #2 merge; update before integrating

PR #4 (OPEN, base main, mergeStateStatus: CLEAN)
  head feat/neon-circuit-phase1e-server-tickets  9b627ae
    763c889  Phase 1d — Pulse Tap gameplay
    9b627ae  Phase 1e — server-authoritative tickets

Local-only branches stacked above PR #4 (NOT pushed):
  feat/neon-circuit-phase1f-arcade-loop          95c128b  Phase 1f
  feat/neon-circuit-phase1g-signal-sprint        6d6cf38  Phase 1g
  feat/neon-circuit-phase1h-challenge-board      b210c86  Phase 1h
  feat/neon-circuit-phase1i-cabinet-frame-contract  2d858ce  Phase 1i
  feat/neon-circuit-phase1j-cabinet-adapter-sdk  b66704c  Phase 1j
  feat/neon-circuit-phase1k-dynamic-adapter-loader  3ed7b5a  Phase 1k
  feat/neon-circuit-phase1l-neon-grid            1522a38  Phase 1l (HEAD; +1 docs commit added by closure)
```

Each phase branch is exactly **one commit** on top of the previous, so the stack is
linear and rebases cleanly.

## Branch location (local vs remote)

| Branch | Pushed to origin? | PR |
|---|---|---|
| phase1d / phase1e | yes (`origin/feat/...`) | **PR #4 (open)** |
| phase1f | no (local only) | none |
| phase1g | no (local only) | none |
| phase1h | no (local only) | none |
| phase1i | no (local only) | none |
| phase1j | no (local only) | none |
| phase1k | no (local only) | none |
| phase1l (+ docs) | no (local only) | none |

Opening PRs for 1f–1l requires pushing those branches first — **not done here, not
authorized.**

## Validation required before each PR

Before merging any phase PR, the branch (or `main` after the merge) must show:

```
node --test tests/arcade/*.test.mjs            → all pass (214/214 at 1l)
bash tests/arcade/run-frame-contract.sh        → FRAME CONTRACT VALIDATION: PASS
bash tests/arcade/run-two-client.sh            → TWO-CLIENT VALIDATION: PASS   (dev shim)
# Node 22 real Worker/DO:
wrangler dev (workers/arcade)  +  static :8080
BASE_URL=... WS_URL=ws://localhost:8787/arcade/ws bash tests/arcade/run-two-client.sh → PASS
wrangler deploy --dry-run                      → bundle clean
guardrail grep                                 → clean
zero console/page errors
```

The full stack at Phase 1l already meets all of these (see
`NEON_CIRCUIT_PHASE1_FINAL_REPORT.md`).

## Recommended PR order

```
0. Update local main to origin/main (fast-forward only; no push).
1. Merge PR #4: Phase 1d + Phase 1e.
2. Rebase Phase 1f onto main, validate, push, open PR, merge.
3. Rebase Phase 1g onto main, validate, push, open PR, merge.
4. Rebase Phase 1h onto main, validate, push, open PR, merge.
5. Rebase Phase 1i onto main, validate, push, open PR, merge.
6. Rebase Phase 1j onto main, validate, push, open PR, merge.
7. Rebase Phase 1k onto main, validate, push, open PR, merge.
8. Rebase Phase 1l onto main, validate, push, open PR, merge.
9. Final Phase 1 validation on main.
10. Optional tag: phase1-arcade-rc1.
```

### Exact rebase/merge plan (per phase, after PR #4 lands)

For each subsequent phase `N` (1f → 1l), once the previous phase is on `main`:

```bash
git fetch origin
git checkout feat/neon-circuit-phase1<N>
git rebase origin/main            # linear single-commit rebase; resolve only if upstream changed shared files
node --test tests/arcade/*.test.mjs
bash tests/arcade/run-frame-contract.sh
# (Node 22) wrangler dev + run-two-client.sh against the real DO
git push -u origin feat/neon-circuit-phase1<N>      # AUTHORIZATION REQUIRED
gh pr create --base main --head feat/neon-circuit-phase1<N> --title "<title>" --body-file <body>
# after green CI + review:
gh pr merge --merge feat/neon-circuit-phase1<N>     # AUTHORIZATION REQUIRED
```

Use a plain merge (or rebase-merge) — **no squash that loses the per-phase commit
boundaries** unless you intend a single Phase 1 commit on `main`.

Alternative (faster, less granular): retarget by merging the whole stack in one
PR `feat/neon-circuit-phase1l-neon-grid → main`. This produces one large but
coherent Phase 1 PR. Only do this deliberately (see warning above).

## Follow-up PR titles (in landing order)

```
feat(arcade): add server-authoritative Pulse Tap tickets   (PR #4, already open)
feat(arcade): add prize counter and arcade loop
feat(arcade): add Signal Sprint cabinet
feat(arcade): add challenge board and achievements
feat(arcade): enforce cabinet game frame contracts
feat(arcade): add cabinet adapter SDK
feat(arcade): add dynamic cabinet adapter loader
feat(arcade): add Neon Grid cabinet
docs(arcade): close Phase 1 and prepare Phase 2
```

## Rollback plan

- Each phase lands as its own merge commit → revert a single phase with
  `git revert -m 1 <merge-commit>` without disturbing the others.
- Because authority logic is server-side and the cabinets are additive, reverting a
  later cabinet (e.g. Neon Grid) leaves earlier cabinets fully functional.
- No destructive history operations are part of this plan. Never force-push `main`.
- If a real-DO regression appears post-merge, revert the offending phase's merge
  commit, re-run the validation suite, and re-open the phase PR with a fix.

## Post-merge validation plan

After the full sequence lands on `main`:

```
git checkout main && git pull
node --test tests/arcade/*.test.mjs              → 214/214
bash tests/arcade/run-frame-contract.sh          → PASS
# Node 22 real Worker/DO:
wrangler dev + static :8080 + run-two-client.sh   → PASS
wrangler deploy --dry-run                          → bundle clean
guardrail grep                                     → clean
```

Then optionally tag `phase1-arcade-rc1` and build a Pages/preview deploy for
manual smoke testing. HiveWorld stays out of all of the above.
