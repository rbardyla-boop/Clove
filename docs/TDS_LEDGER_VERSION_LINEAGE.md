# TDS Evidence Ledger Version Lineage

Status: `TDS_LEDGER_V0_10_NOT_RECOVERABLE` as of 2026-08-24.

This is a provenance report, not a replacement claim ledger. The files below
were read from the local Obsidian vault. They are not Git-tracked artifacts,
so no repository commit can be assigned to them. Hashes identify the bytes
observed during this recovery pass; filesystem mtimes are included only as
local metadata and are not treated as authoring dates.

## Verified historical files

| Version | Vault-relative path | Claim blocks | Claim IDs | DO_NOT_RESURRECT sections / bullets | SHA-256 |
|---|---|---:|---|---:|---|
| v0.1 | `00_Inbox/Processed/EVIDENCE_CONSOLIDATION_LEDGER_v0.1.md` | 29 | EC-001–EC-029 | 1 / 13 | `8a88f4c81f6d2cbba5b675c019cfe81d1e0112edf741bc1618b08b5534c12d9c` |
| v0.2 | `03 - Knowledge/Literature/EVIDENCE_CONSOLIDATION_LEDGER_v0.2.md` | 35 | EC-001–EC-035 | 2 / 21 | `692881fcb60a41b5fae8c391d05170fe44bd601d9231c9b395da529686090450` |
| v0.3 | `00_Inbox/Processed/EVIDENCE_CONSOLIDATION_LEDGER_v0.3.md` | 46 | EC-001–EC-046 | 2 / 21 | `2057a4960a40f9baebd1ecd2a1b2b000f8231ac6e57d273d373106e2e96d4ebd` |
| v0.4 | `Memory/Permanent/EVIDENCE_CONSOLIDATION_LEDGER_v0.4.md` | 58 | EC-001–EC-058 | 3 / 33 | `cb3bbd0d26a1caa5b308da56968d358f6ff5022fbad62b2ae8e583bc0890f9c2` |
| v0.5 | `00_Inbox/EVIDENCE_CONSOLIDATION_LEDGER_v0.5.md` | 59 | EC-001–EC-058 plus EC-051A | 3 / 33 | `abdbfe6632639d3e10177624b5ef46f7bd1cdf1030c18504cf4d8fbadaafbe38` |
| v0.9 | `00_Inbox/EVIDENCE_CONSOLIDATION_LEDGER_v0.9.md` | 93 | EC-001–EC-092 plus EC-051A | 7 / 66 | `b2dd2052a9dcfc5f1b9f15b0815ae92d2c6c5eef5484a1fd765345e6054ab408` |

No v0.6, v0.7, or v0.8 file was found in the vault or repository surfaces
checked. No exact v0.10 file was found.

## Lineage changes observed

- v0.1 is the initial EC-001–EC-029 architecture, influence, Canadian
  behavioural/public-health, modern-system, and experimental-program ledger.
  Its explicit freeze is partial: architecture frozen, claims audited
  individually.
- v0.2 adds EC-030–EC-035, the direct algorithm-outcome layer: exposure,
  attitude effects, social norms, user selection, deep-attitude resistance, and
  the political-ad removal null.
- v0.3 adds EC-036–EC-046, covering campaign persuasion, ad benchmarks,
  microtargeting limits, the Online News Act, intermediary responses, and the
  reported Facebook-ban case.
- v0.4 adds EC-047–EC-058, covering WEF/elite-network evidence, the Schwab
  clip, cross-party participation, Canadian WEF relationships, the government
  deception rule, and the UAP evidentiary boundary.
- v0.5 adds EC-051A and changes some archival/practice status wording. It does
  not add a new sequential EC number.
- v0.9 adds EC-059–EC-092: Canada 1917 franchise engineering, U.S. founding
  architecture, smartphone/attention evidence, and the 2026 Canadian
  political-data/privacy closeout. It also expands the killed-claim sections.

The v0.9 document contains a `WORKING FREEZE`, but that is not equivalent to
an independently preserved v0.10 source packet or a Git-backed immutable
release.

## Exact v0.9 state

The deterministic parser found 93 claim blocks. Frozen-status distribution:

- ESTABLISHED: 66
- STRONG: 22
- PLAUSIBLE: 2
- invalid/non-frozen: 3

Audit distribution:

- GREEN: 76
- YELLOW: 16
- RED: 1

The three non-frozen records are:

| Claim | Line | Raw status | Why it fails the public builder gate |
|---|---:|---|---|
| EC-046 | 652 | `REPORTED / UNKNOWN CAUSATION` | not one of ESTABLISHED / STRONG / PLAUSIBLE / SPECULATIVE / REJECTED |
| EC-051A | 734 | `CONFLICTING_ARCHIVAL_RECORD / UNRESOLVED` | not one of the frozen statuses |
| EC-086 | 1121 | `CURRENT PRACTICE — PARTY SPECIFIC` | current-practice wording is not an evidence status |

These records were not repaired or silently upgraded.

## Recovery surfaces checked

- Obsidian vault filenames, filename variants, and content signatures.
- Repository tracked trees and all visible branches/tags.
- Git full-history path searches and string searches.
- Git reflogs, stashes, worktrees, and unreachable Git objects/blobs.
- Bounded Downloads, Documents, `/tmp`, Grok/new-ai directories, and likely
  TDS/Clove locations.
- Relevant ZIP/archive listings, including TDS project/KDP archives.
- Codex attachment text files available in the local environment.

The matching content signatures found in the vault belong to v0.9 and later
research/plan documents; no artifact had provenance sufficient to identify it
as the missing v0.10 file.
