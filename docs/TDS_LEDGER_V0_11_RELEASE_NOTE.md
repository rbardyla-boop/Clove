# TDS Ledger v0.11 Release Note

Status: `SCHEMA-NORMALIZED SUCCESSOR RECONSTRUCTED FROM VERIFIED v0.9`

Created: 2026-08-24

v0.11 is a schema-normalized successor reconstructed from verified v0.9. It
is not a recovered copy of historical v0.10.

Historical v0.10 remains a reserved version identifier. If that separate
source artifact is recovered later, it may be archived without conflicting
with v0.11.

## Parent and artifact

- Parent artifact: `Obsidian Vault/00_Inbox/EVIDENCE_CONSOLIDATION_LEDGER_v0.9.md`
- Parent SHA-256: `b2dd2052a9dcfc5f1b9f15b0815ae92d2c6c5eef5484a1fd765345e6054ab408`
- Pre-rename reconstructed content SHA-256: `fda0437251577b989dab8275b8673ea8e12d38b38f696821377d5e11651df3b4`
- Canonical v0.11 path: `research/source-packets/tds/EVIDENCE_CONSOLIDATION_LEDGER_v0.11.md`
- Canonical v0.11 SHA-256: `f48e04f186550057762a504ef1ad0bd9d2bf4555f25b934e89569bfbeb7d9e59`
- Canonical v0.11 bytes: `88062`

## Ledger inventory

- Claims: `93`
- IDs: `EC-001` through `EC-092`, plus `EC-051A`
- Frozen status distribution: `ESTABLISHED 66`, `STRONG 23`, `PLAUSIBLE 3`, `SPECULATIVE 1`
- Audit distribution: `GREEN 76`, `YELLOW 16`, `RED 1`
- Source URLs observed: `11`
- DO_NOT_RESURRECT bullets: `66`

## The three repairs

### EC-046

- Old status: `REPORTED / UNKNOWN CAUSATION`
- New frozen status: `SPECULATIVE`
- Qualifier preserved: `REPORTED / UNKNOWN CAUSATION`
- Rationale: the preserved evidence is an author recollection without an
  enforcement notice, date, policy category, or appeal record. The RED audit
  remains unchanged.

### EC-051A

- Old status: `CONFLICTING_ARCHIVAL_RECORD / UNRESOLVED`
- New frozen status: `PLAUSIBLE`
- Qualifier preserved: `CONFLICTING_ARCHIVAL_RECORD / UNRESOLVED`
- Rationale: later compiled lists and public WEF association support the
  possibility, while the missing original WEF 2005 cohort/profile record and
  contrary archival presentation leave formal cohort status unresolved. The
  YELLOW audit remains unchanged.

### EC-086

- Old status: `CURRENT PRACTICE — PARTY SPECIFIC`
- New frozen status: `STRONG`
- Qualifier preserved: `CURRENT PRACTICE — PARTY SPECIFIC`
- Rationale: the broader claim that parties can build richer political
  profiles is supported, while any claim about a particular party's current
  purchase of broad commercial datasets still requires party-specific proof.
  The YELLOW-GREEN audit remains unchanged.

## v0.9 → v0.11 diff boundary

The diff is limited to:

1. the v0.11 provenance header (replacing the parent's stale opening version
   line and reserving historical v0.10);
2. the three frozen-status normalizations above; and
3. one qualifier line after each repaired status, preserving the original
   wording.

No claim prose, IDs, ordering, citations, source text, effect-size language,
jurisdictional boundary, CANNOT CLAIM text, audit state, or
DO_NOT_RESURRECT material was intentionally changed.

## Derived public bundle

The fail-closed builder derived the local bundle at:

`research/projects/tds/ledger/`

Its `source-manifest.json` and `TDS_LEDGER_RELEASE_LOCK.json` bind the bundle
to the v0.11 filename, final byte count, and final SHA-256. The release lock
also requires 93 claims and fails closed on any mismatch.
