# CloveLearn v2 — DS-I2 Build Log

Status: **ACTIVE / NON-PUBLIC**

## Red-first baseline

The DS-I2 static/state/mutation/browser/release contracts and CI workflow were committed before the runtime existed. The initial CI run failed at the first static gate because `digital-stewardship-02.html/js` did not exist. This is the intended red baseline.

## Runtime scope

The first implementation is deliberately narrow:
- inspect current critical vs low-stakes mixing;
- detect an already-existing secondary/alias lane;
- optionally test whether that existing lane receives a harmless message outside Clove;
- inspect recovery awareness without logout/reset/change;
- set a future low-stakes rule;
- never migrate a critical account.

## Release isolation

DS-I2 is required to remain non-public. Its two runtime files must be blocked in both the production hard-exclusion list and the independent release-preflight forbidden sentinels before terminal merge.

## Human evidence boundary

Automated/solo hardening cannot establish that a novice understands account compartmentalization or that the practice measurably improves security. Those claims remain human/outcome evidence pending.
