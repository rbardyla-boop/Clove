# TDS Public Proof Ledger Build

Status: `READY — CANONICAL V0.11 SOURCE LOCKED`

The public proof ledger is derived only from:

`research/source-packets/tds/EVIDENCE_CONSOLIDATION_LEDGER_v0.11.md`

The historical v0.10 identifier is reserved and is never used as the
canonical source filename.

## Source gate

The builder requires exactly one file named:

`EVIDENCE_CONSOLIDATION_LEDGER_v0.11.md`

The source directory must also contain `TDS_LEDGER_RELEASE_LOCK.json` with the
exact v0.11 filename, SHA-256, and claim count. Missing, duplicate, renamed,
hash-mismatched, or claim-count-mismatched inputs fail closed.

Run:

```sh
node scripts/build-tds-ledger.mjs \
  --search-root . \
  --canonical research/source-packets/tds/EVIDENCE_CONSOLIDATION_LEDGER_v0.11.md \
  --inventory-out docs/TDS_LEDGER_SOURCE_INVENTORY_V0_11.md \
  --out research/projects/tds/ledger
```

## Derived outputs

The bundle contains:

- public-safe claim records with evidence status, audit state, counterevidence,
  CANNOT CLAIM boundaries, and provenance;
- a source registry and per-claim source-resolution coverage;
- PUBLIC / CAUTION / HOLD classification;
- a stable 12-dossier index;
- 66 structured killed-claim entries;
- coverage, provenance, book-crosswalk, and publication-firewall reports.

No claim body is repaired inside generated output. The only status repairs are
in the canonical v0.11 source and preserve the old wording as qualifiers.

## Public routes

- `/research/projects/tds/ledger/`
- `/research/projects/tds/ledger/claims/`
- `/research/projects/tds/ledger/dossiers/`
- `/research/projects/tds/ledger/killed/`
- `/research/projects/tds/ledger/sources/`

The static pages contain no account gate, payment/donation requirement,
tracking endpoint, or external script. They use text-safe rendering for
ledger-supplied content and display unresolved source identity as unresolved.
