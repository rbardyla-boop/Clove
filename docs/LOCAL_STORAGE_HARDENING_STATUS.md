# Local Storage Hardening Status

**Date:** 2026-07-04
**Main commit at time of status:** `eeb8da7` (== `origin/main`)

## Completed chain

| Step | PR | Merge commit |
|---|---|---|
| ADR-052 sealed-local threat model | #125 | `35e5c37` |
| CFHS analyzer import XSS fix | #126 | `43dd264` |
| CSP `form-action 'self'` hardening | #128 | `4775f8e` |
| `od_redprotocol_log` encryption (crisis-key hygiene) | #129 | `80f5bba` |
| `intelligence-ops` warm-cache compatibility | #130 | `0055686` |
| `system-check.html` encrypted-key protection | #131 | `57beb8e` |
| `od_clinical_scores` compatibility (plaintext stage) | #132 | `448a1eb` |
| `od_clinical_scores` encrypted-mode proof (proof-only, never merged) | — | `61f773c` |
| `od_clinical_scores` production encryption | #133 | `eeb8da7` |

## Current encrypted keys

`od-core.js`'s `ENCRYPT_KEYS` (closed, intentional list):

- `od_redprotocol_log`
- `od_clinical_scores`

Both are AES-GCM-encrypted at rest via the same warm-cache mechanism (synchronous in-memory cache populated by an async decrypt-on-load, with a `whenIntelReady()` barrier for pages that display an encrypted key on first paint).

## Current guarantees

- Legacy plaintext migrates to ciphertext losslessly on first load after a key joins `ENCRYPT_KEYS`.
- Encrypted reads survive reload (ciphertext-at-rest is stable, not re-migrated or corrupted on repeat loads).
- Crisis display (`red-protocol.html`) never blanks — reads are gated behind `whenIntelReady()`.
- Clinical pages (`clinical-assessments.html`, `clinical-report.html`, `progress-report.html`, `progress-dashboard.html`, `toolshed.html`) render and export correctly from ciphertext.
- Retention keeps the newest entries by identity/content, not just by count — writer order differs per key (`od_redprotocol_log` unshifts newest-first; `od_clinical_scores` pushes newest-last), and `RETENTION_NEWEST_LAST` accounts for this per key.
- Corrupt values are preserved on disk, never silently deleted — both by `intelGet`'s fallback path and by `system-check.html`'s `purgeCorrupt()`.
- `system-check.html`'s purge does not delete known ciphertext for either encrypted key.

## Explicit limits

- This is sealed-local device hygiene, not protection against full device compromise or active session XSS. An attacker with arbitrary JS execution on the page, or physical/malware access to the unlocked device, can still read decrypted data in memory.
- No sync/cloud/peer/account storage exists for any of this data — it never leaves the browser.
- Other `INTEL_KEYS` (roughly 20 remaining registry keys) remain unchanged — still plaintext, not in scope of this chain.
- No deploy has been performed as part of this chain. All work landed on `main`/`origin/main` only.

## Validation suites now covering the chain

All under `tests/security/`:

- `crisis-key-hygiene.spec.mjs` (+ runner)
- `intelligence-ops-warm-cache.spec.mjs` (+ runner)
- `system-check-ciphertext.spec.mjs` (+ runner) — covers both encrypted keys
- `clinical-scores-compat.spec.mjs` (+ runner)
- `clinical-scores-encrypted.spec.mjs` (+ runner) — production encrypted-mode regression, successor to the never-merged Gate 2 proof (`61f773c`)
- `cfhs-analyzer-xss.spec.mjs` (+ runner)

## Next optional work

- Decide whether any of the remaining, non-sensitive `INTEL_KEYS` need retention-only hygiene (no encryption implied).
- Gate C, only if separately authorized.
- Deploy, only under a separate deployment gate.
