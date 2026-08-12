# CP-CDTT v0.3 Package Integrity Replay

**Status:** `PASS`
**Checks:** 33/33 passed

| Check | Result | Detail |
|---|---|---|
| 20 blinded cases | PASS | 20 rows, 20 unique |
| blind IDs opaque C01-C20 | PASS | C01,C02,C03,C04,C05,C06,C07,C08,C09,C10,C11,C12,C13,C14,C15,C16,C17,C18,C19,C20 |
| blind map bijective | PASS |  |
| gold/replay cover 20 cases | PASS | gold=20 replay_rows=100 replay_cases=20 |
| leak audit all PASS | PASS | [] |
| axis claims exactly cover evaluated axes | PASS | claims=75 expected=75 |
| axis summary exactly covers evaluated axes | PASS | summary=75 expected=75 |
| response template matches ontology obligation matrix | PASS | mismatches=0 |
| response template contains no evaluator answers | PASS |  |
| axis summary contains no evaluator answers | PASS |  |
| external zip exact allowlist | PASS | ['F2F3_EVALUATOR_AXIS_CLAIMS_v0.3.csv', 'F2F3_EVALUATOR_AXIS_SUMMARY_TEMPLATE_v0.3.csv', 'F2F3_EVALUATOR_PACKET_v0.3.csv', 'F2F3_EVALUATOR_RESPONSE_TEMPLATE_v0.3.csv', 'F2F3_INDEPENDENT_EVALUATOR_RUBRIC_v0.3.md', 'F2_CP-CDTT_EVALUATOR_SPEC_v0.3.md', 'F3_CP-CDTT_ONTOLOGY_v0.3.yaml'] |
| external zip contains no gold/map filenames | PASS |  |
| F2F3_EVALUATOR_PACKET_v0.3.csv no V/I internal IDs | PASS |  |
| F2F3_EVALUATOR_AXIS_CLAIMS_v0.3.csv no V/I internal IDs | PASS |  |
| F2F3_EVALUATOR_RESPONSE_TEMPLATE_v0.3.csv no V/I internal IDs | PASS |  |
| F2F3_EVALUATOR_AXIS_SUMMARY_TEMPLATE_v0.3.csv no V/I internal IDs | PASS |  |
| evaluator spec excludes Fick | PASS |  |
| evaluator spec excludes Hodgkin | PASS |  |
| evaluator spec excludes Turing | PASS |  |
| evaluator spec excludes Hopfield | PASS |  |
| evaluator spec excludes Chilton | PASS |  |
| evaluator spec excludes Black–Scholes | PASS |  |
| evaluator spec excludes Black-Scholes | PASS |  |
| evaluator spec excludes Lotka | PASS |  |
| evaluator spec excludes Faraday cage | PASS |  |
| evaluator spec excludes solar system | PASS |  |
| evaluator spec excludes classical atom | PASS |  |
| evaluator spec excludes worked-examples section | PASS |  |
| evaluator spec excludes internal replay section | PASS |  |
| formalism has PO-17 | PASS |  |
| formalism retires scalar max as primary | PASS |  |
| ontology has PO17 validation | PASS |  |
| ontology predictive/mechanistic are sibling branches | PASS |  |
