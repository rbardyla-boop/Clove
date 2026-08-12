# DS-I4 gate history

1. Red baseline: tests/workflow existed before runtime; static gate failed because `digital-stewardship-04.html/js` were absent.
2. Minimum runtime then passed static, state-machine and mutation gates but failed the non-public production-boundary gate as designed.
3. Two-layer production exclusion was added: builder hard exclusion + independent preflight sentinel.
4. Controller inspection found a render-under-lock edge at the final commitment answer. Rendering was moved after lock release while preserving the single-flight transition guard.
5. Exact module head then passed static, state, mutation, release isolation, shared production preflight, syntax, Chromium and Firefox.

No public deployment is authorized by this record.
