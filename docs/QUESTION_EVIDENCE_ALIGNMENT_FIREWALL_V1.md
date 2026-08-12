# Question–Evidence Alignment Firewall v1

Status: local repair implemented; production deployment requires separate authorization.

## Defect closed by this unit

The question:

> how many people did not vote in the last election in Canada

was previously routed through a broad official-statistics recipe and returned a valid population datapoint. The datapoint was real, but it did not answer the requested electoral-participation measure.

That is an alignment failure, not a source-provenance failure.

## Contract

Every investigation now performs deterministic semantic preflight before discovery or extraction. The preflight records:

- subject;
- requested measure;
- geography;
- event and time scope where present;
- population or denominator where present;
- required concepts;
- unresolved ambiguities.

A source-recipe match is not evidence that the question asks for that recipe's canonical measure.

Before a result is synthesized, every `EvidenceClaim` is checked for applicability against the intent. The check covers the requested subject and measure, geography, unit or denominator, and source domain. Claims used by the answer must survive. If they do not, synthesis stops with `RESEARCH_REQUIRED`.

## Election behavior

Election and voting questions are classified as `electoral_participation`. The current bounded unit has no election-result adapter, so it fails closed without calling discovery or extraction.

The result must:

- contain no population claim or population answer;
- preserve the election and denominator ambiguities;
- state that further research is required;
- export the alignment decision as portable Markdown.

The unit does not add an Elections Canada adapter.

## Supported bounded paths

The existing population, Canadian-law, scientific-discovery, and exact bounded electricity paths remain eligible only when their intent matches the selected path. Broad or unknown questions cannot inherit the population extractor merely because their wording contains `how many`, `annual`, or `Canada`.

Adversarial cases include unemployment, mortality, immigration, voting, home ownership, convictions, and scholarly-study counts. Each must fail closed rather than return the population example.

## Acceptance tests

- `POST /research/` with the election question returns `200` and a research result with `status: RESEARCH_REQUIRED`.
- The election path performs no source fetch before the alignment decision.
- The result has zero claims and does not contain the known population value.
- The alignment report identifies `electoral_participation` and records the jurisdiction and denominator ambiguities.
- Population, law, science, and the existing electricity nucleus retain their prior bounded behavior.
- The research test suite passes, including the adversarial regression cases.

