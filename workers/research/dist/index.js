var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../agent/source-recipes.json
var source_recipes_default = {
  name: "CLOVE_SOURCE_RECIPES",
  version: 1,
  recipes: {
    official_canadian_statistic: {
      label: "Official Canadian statistic",
      source_priority: [
        {
          rank: 1,
          source_class: "Statistics Canada",
          role: "primary_measurement"
        },
        {
          rank: 2,
          source_class: "Relevant federal department or regulator",
          role: "independent_check_or_context"
        },
        {
          rank: 3,
          source_class: "Provincial or territorial statistical agency",
          role: "jurisdictional_detail"
        }
      ],
      preferred_access: [
        "official_api",
        "official_table",
        "official_publication",
        "ordinary_fetch"
      ],
      mandatory_checks: [
        {
          id: "geography",
          required: true,
          description: "Confirm the national, provincial, or territorial geography matches the question."
        },
        {
          id: "measurement_period",
          required: true,
          description: "Record the reference period and distinguish latest complete year from latest month."
        },
        {
          id: "unit",
          required: true,
          description: "Verify the unit and denominator before calculating a percentage."
        },
        {
          id: "annual_vs_monthly",
          required: true,
          description: "Reject a monthly observation when the claim asks for an annual statistic."
        },
        {
          id: "preliminary_vs_final",
          required: true,
          description: "Label preliminary estimates and prefer final releases when available."
        },
        {
          id: "revised_vs_original",
          required: true,
          description: "Preserve revision status and do not mix original and revised series silently."
        }
      ],
      freshness: {
        rule: "Use the latest complete period explicitly available from the authoritative source.",
        must_label: ["reference_period", "release_status", "revision_status"]
      },
      challenge: {
        strategy: "Find another authoritative source and determine whether it derives from the same underlying dataset.",
        independence_check: "Repeated reporting of one table is not independent confirmation."
      },
      prohibited_source_roles: [
        "news_article_as_primary",
        "commercial_data_summary_as_primary",
        "AI_summary_as_primary"
      ],
      routing: {
        all_of: ["canada"],
        any_of: [
          "population",
          "electricity",
          "generation",
          "percentage",
          "percent",
          "statistic",
          "annual",
          "latest complete year",
          "how many"
        ],
        none_of: [
          "law",
          "statute",
          "regulation",
          "cannabis",
          "court",
          "supplementation",
          "randomized",
          "peer reviewed"
        ]
      }
    },
    canadian_law: {
      label: "Canadian legislation or regulation",
      source_priority: [
        {
          rank: 1,
          source_class: "Justice Laws Website",
          role: "federal_primary_law"
        },
        {
          rank: 2,
          source_class: "Official provincial or territorial legislation",
          role: "provincial_primary_law"
        },
        {
          rank: 3,
          source_class: "CanLII",
          role: "interpretation_and_case_context"
        }
      ],
      preferred_access: [
        "official_statute",
        "official_regulation",
        "official_legislation_search",
        "ordinary_fetch",
        "CanLII_interpretation"
      ],
      mandatory_checks: [
        {
          id: "jurisdiction",
          required: true,
          description: "Identify federal, provincial, territorial, or municipal authority before answering."
        },
        {
          id: "in_force_date",
          required: true,
          description: "Confirm the provision was in force on the relevant date."
        },
        {
          id: "amendment_status",
          required: true,
          description: "Check amendments, repeals, transitional provisions, and version status."
        },
        {
          id: "regulation_vs_statute",
          required: true,
          description: "Distinguish the enabling statute from regulations and subordinate instruments."
        }
      ],
      freshness: {
        rule: "Current and in-force status is mandatory; historical text cannot settle a present-tense claim.",
        must_label: ["jurisdiction", "in_force_date", "amendment_status", "instrument_type"]
      },
      challenge: {
        strategy: "Check the authoritative instrument and then seek independent legal interpretation without allowing commentary to replace the text.",
        independence_check: "A commentary source may explain ambiguity but cannot establish the law by repetition."
      },
      prohibited_source_roles: [
        "law_firm_blog_as_primary",
        "news_article_as_primary",
        "AI_summary_as_primary",
        "uncited_social_post"
      ],
      routing: {
        all_of: ["canada"],
        any_of: [
          "law",
          "legal",
          "statute",
          "regulation",
          "federal",
          "provincial",
          "territorial",
          "in force",
          "minimum age",
          "possession",
          "cannabis",
          "court"
        ],
        none_of: [
          "supplementation",
          "randomized",
          "sample size",
          "confidence interval"
        ]
      }
    },
    scientific_finding: {
      label: "Scientific finding",
      source_priority: [
        {
          rank: 1,
          source_class: "Systematic review or meta-analysis",
          role: "synthesis"
        },
        {
          rank: 2,
          source_class: "Original peer-reviewed study",
          role: "primary_result"
        },
        {
          rank: 3,
          source_class: "Trial registration",
          role: "protocol_and_outcome_context"
        },
        {
          rank: 4,
          source_class: "Underlying dataset",
          role: "reproducibility"
        }
      ],
      preferred_access: [
        "PubMed",
        "Crossref",
        "OpenAlex",
        "journal_full_text",
        "trial_registry",
        "underlying_dataset"
      ],
      mandatory_checks: [
        {
          id: "publication_date",
          required: true,
          description: "Record publication date and whether the evidence is current for the question."
        },
        {
          id: "sample_size",
          required: true,
          description: "Extract sample size and relevant population rather than relying on an abstracted conclusion."
        },
        {
          id: "effect_size",
          required: true,
          description: "Require an effect size or a clearly stated null/qualitative result."
        },
        {
          id: "confidence_interval",
          required: true,
          description: "Capture confidence intervals or uncertainty estimates where reported."
        },
        {
          id: "correction_retraction",
          required: true,
          description: "Check for corrections, expressions of concern, and retractions."
        },
        {
          id: "replication",
          required: true,
          description: "Search for independent replication or conflicting studies."
        },
        {
          id: "funding_conflict",
          required: true,
          description: "Record funding and declared conflicts of interest."
        }
      ],
      freshness: {
        rule: "Do not use age alone as a quality proxy; prefer current syntheses while retaining historically important primary studies.",
        must_label: ["publication_date", "evidence_status", "retraction_status"]
      },
      challenge: {
        strategy: "Find an independent review or study, compare populations and outcomes, and retain disagreement when methods or results do not reconcile.",
        independence_check: "Multiple papers using one dataset or author group do not count as independent replication."
      },
      prohibited_source_roles: [
        "press_release_as_primary",
        "news_article_as_primary",
        "blog_as_primary",
        "AI_summary_as_primary",
        "uncited_social_post"
      ],
      routing: {
        all_of: [],
        any_of: [
          "improve",
          "effect",
          "evidence",
          "study",
          "research",
          "supplementation",
          "healthy adults",
          "cognitive",
          "trial",
          "randomized",
          "peer reviewed",
          "association"
        ],
        none_of: [
          "statute",
          "regulation",
          "minimum age",
          "in force"
        ]
      }
    }
  }
};

// src/source-recipes.ts
var SOURCE_RECIPES = Object.freeze(
  Object.entries(source_recipes_default.recipes).map(([id, recipe]) => ({ id, ...recipe }))
);
var RECIPE_BY_ID = new Map(SOURCE_RECIPES.map((recipe) => [recipe.id, recipe]));
function normalizeQuestion(question) {
  return question.normalize("NFKC").toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9% ]/g, " ").replace(/\s+/g, " ").trim();
}
__name(normalizeQuestion, "normalizeQuestion");
function matchesSignal(question, signal) {
  return ` ${question} `.includes(` ${signal.toLowerCase()} `);
}
__name(matchesSignal, "matchesSignal");
function evaluateRecipe(question, recipe) {
  const matchedAllOf = recipe.routing.all_of.filter((signal) => matchesSignal(question, signal));
  const matchedAnyOf = recipe.routing.any_of.filter((signal) => matchesSignal(question, signal));
  const blockedByNoneOf = recipe.routing.none_of.filter((signal) => matchesSignal(question, signal));
  const allOfSatisfied = matchedAllOf.length === recipe.routing.all_of.length;
  const anyOfSatisfied = recipe.routing.any_of.length === 0 || matchedAnyOf.length > 0;
  const eligible = allOfSatisfied && anyOfSatisfied && blockedByNoneOf.length === 0;
  const score = eligible ? matchedAllOf.length * 5 + matchedAnyOf.length : 0;
  return { recipeId: recipe.id, score, matchedAllOf, matchedAnyOf, blockedByNoneOf, eligible };
}
__name(evaluateRecipe, "evaluateRecipe");
function selectSourceRecipe(question) {
  if (typeof question !== "string" || question.trim().length === 0) return null;
  const normalized = normalizeQuestion(question);
  const trace = SOURCE_RECIPES.map((recipe2) => evaluateRecipe(normalized, recipe2));
  const eligible = trace.filter((evaluation) => evaluation.eligible).sort((left, right) => right.score - left.score);
  const winner = eligible[0];
  if (!winner) return null;
  const recipe = RECIPE_BY_ID.get(winner.recipeId);
  if (!recipe) return null;
  const confidence = winner.score >= 8 ? "high" : "medium";
  return {
    recipe,
    confidence,
    matchedSignals: [...winner.matchedAllOf, ...winner.matchedAnyOf],
    trace
  };
}
__name(selectSourceRecipe, "selectSourceRecipe");
function buildResearchPlan(question, selection) {
  return {
    question,
    status: "recipe_selected",
    recipe: selection.recipe,
    confidence: selection.confidence,
    matchedSignals: selection.matchedSignals,
    routingTrace: selection.trace,
    answerStatus: "not_run",
    nextSteps: [
      "discover candidates using the recipe source priority",
      "retrieve through a preferred access method",
      "run every mandatory validation check",
      "execute the recipe challenge and independence check",
      "extract only supported claims or return an unresolved result"
    ]
  };
}
__name(buildResearchPlan, "buildResearchPlan");

// src/research.ts
var CANADA_NUCLEAR_QUESTION = "What percentage of Canada's electricity generation came from nuclear power in the latest complete year?";
var TARGET_YEAR = 2024;
var MAX_SOURCE_BYTES = 512e3;
var SOURCE_FETCH_TIMEOUT_MS = 8e3;
var PERCENT_TOLERANCE = 0.1;
var UnsupportedQuestionError = class extends Error {
  static {
    __name(this, "UnsupportedQuestionError");
  }
  constructor() {
    super("unsupported_question");
    this.name = "UnsupportedQuestionError";
  }
};
var ResearchSourceError = class extends Error {
  static {
    __name(this, "ResearchSourceError");
  }
  constructor(message) {
    super(message);
    this.name = "ResearchSourceError";
  }
};
function normalizeQuestion2(question) {
  return question.replace(/[’]/g, "'").toLowerCase().replace(/[^a-z0-9% ]/g, " ").replace(/\s+/g, " ").trim();
}
__name(normalizeQuestion2, "normalizeQuestion");
function sourceEvidence(sourceId, id, label, value, unit, period, method, exactQuote, locator, supports = []) {
  return { id, sourceId, label, value, unit, period, method, exactQuote, locator, supports };
}
__name(sourceEvidence, "sourceEvidence");
function visibleText(body) {
  return body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|#160|#xA0);/gi, " ").replace(/&amp;/gi, "&").replace(/&(?:#39|apos);/gi, "'").replace(/&(?:quot);/gi, '"').replace(/\s+/g, " ").trim();
}
__name(visibleText, "visibleText");
function parseStatCan(body) {
  const text = visibleText(body);
  const totalMatch = text.match(/Canada's total electricity generation in 2024 reached ([\d.]+) million megawatt-hours[^.]*\./i);
  const nuclearMatch = text.match(/Nuclear energy generation fell by [\d.]+% compared with the previous year to ([\d.]+) million MWh in 2024\./i);
  if (!totalMatch || !nuclearMatch) throw new Error("statcan_datapoints_not_found");
  const total = Number(totalMatch[1]);
  const nuclear = Number(nuclearMatch[1]);
  if (!Number.isFinite(total) || !Number.isFinite(nuclear) || total <= 0 || nuclear < 0) {
    throw new Error("statcan_datapoints_invalid");
  }
  return [
    sourceEvidence(
      "statcan-2024",
      "statcan-total-generation-2024",
      "Canada total electricity generation",
      total,
      "million_mwh",
      "2024",
      "reported",
      totalMatch[0],
      "The Daily > Electricity supply > opening national total",
      ["canada-nuclear-share-2024"]
    ),
    sourceEvidence(
      "statcan-2024",
      "statcan-nuclear-generation-2024",
      "Canada nuclear electricity generation",
      nuclear,
      "million_mwh",
      "2024",
      "reported",
      nuclearMatch[0],
      "The Daily > Electricity supply > nuclear generation paragraph",
      ["canada-nuclear-share-2024"]
    )
  ];
}
__name(parseStatCan, "parseStatCan");
function parseCer(body) {
  const match = visibleText(body).match(/Nationally, nuclear power generation made up (\d+)% of total electricity generation in 2021/i);
  if (!match) throw new Error("cer_challenger_datapoint_not_found");
  return [sourceEvidence(
    "cer-2021",
    "cer-nuclear-share-2021",
    "National nuclear share of electricity generation",
    Number(match[1]),
    "percent",
    "2021",
    "reported",
    match[0],
    "Canada Energy Future 2023 > Electricity > Nuclear",
    ["contradiction-canada-nuclear-share"]
  )];
}
__name(parseCer, "parseCer");
var SOURCE_CATALOG = [
  {
    id: "statcan-2024",
    title: "Electricity supply and disposition, 2024 (preliminary)",
    publisher: "Statistics Canada",
    url: "https://www150.statcan.gc.ca/n1/daily-quotidien/251022/dq251022c-eng.htm",
    authorityScore: 100,
    role: "primary",
    parse: parseStatCan
  },
  {
    id: "cer-2021",
    title: "Canada's Energy Future 2023: Results",
    publisher: "Canada Energy Regulator",
    url: "https://cer-rec.gc.ca/en/data-analysis/canada-energy-future/2023/results/",
    authorityScore: 85,
    role: "challenger",
    parse: parseCer
  }
];
function researchSpecFor(question) {
  if (normalizeQuestion2(question) !== normalizeQuestion2(CANADA_NUCLEAR_QUESTION)) return null;
  return {
    question,
    canonicalQuestion: CANADA_NUCLEAR_QUESTION,
    claim: "Canada's nuclear share of total electricity generation in the latest complete year",
    geography: "Canada",
    metric: "electricity_generation_share",
    target: "nuclear_power",
    targetYear: TARGET_YEAR,
    recipeId: "official_canadian_statistic",
    distinctionChecks: [
      "generation rather than installed capacity",
      "Canada national total rather than a provincial value",
      "latest complete annual data rather than the latest month or forecast"
    ],
    sourceIds: SOURCE_CATALOG.map((source) => source.id)
  };
}
__name(researchSpecFor, "researchSpecFor");
async function readBoundedText(response, maxBytes = MAX_SOURCE_BYTES) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("source_body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
__name(readBoundedText, "readBoundedText");
async function fetchSource(source, fetcher) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("source_timeout"), SOURCE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetcher(source.url, {
      headers: { accept: "text/html,application/xhtml+xml" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`source_http_${response.status}`);
    const evidence = source.parse(await readBoundedText(response));
    return { ...source, rank: 0, status: "available", evidence };
  } catch (error) {
    const message = error instanceof Error ? error.message : "source_fetch_failed";
    return { ...source, rank: 0, status: "unavailable", evidence: [], error: message };
  } finally {
    clearTimeout(timeout);
  }
}
__name(fetchSource, "fetchSource");
function rankSources(results) {
  return [...results].sort((left, right) => right.authorityScore - left.authorityScore).map((source, index) => ({ ...source, rank: index + 1 }));
}
__name(rankSources, "rankSources");
function roundedPercent(value) {
  return Math.round(value * 10) / 10;
}
__name(roundedPercent, "roundedPercent");
function classifyDisagreement(primary, challenger) {
  if (Math.abs(primary.value - challenger.value) <= PERCENT_TOLERANCE) return null;
  const periodMismatch = primary.period !== challenger.period;
  return {
    id: `contradiction-${challenger.sourceId}`,
    challengerSourceId: challenger.sourceId,
    primaryValue: primary.value,
    challengerValue: challenger.value,
    primaryPeriod: primary.period,
    challengerPeriod: challenger.period,
    status: periodMismatch ? "period_mismatch" : "unresolved",
    explanation: periodMismatch ? `The values use different periods (${primary.period} versus ${challenger.period}); this is a time-series difference, not a same-year contradiction.` : `Both values use ${primary.period}, but they differ beyond the ${PERCENT_TOLERANCE} percentage-point tolerance; the disagreement remains unresolved.`
  };
}
__name(classifyDisagreement, "classifyDisagreement");
function graphId(value) {
  return value.replace(/[^a-zA-Z0-9_]/g, "_");
}
__name(graphId, "graphId");
function graphLabel(value) {
  return value.replace(/[\[\]"()]/g, "").replace(/\n/g, " ").slice(0, 120);
}
__name(graphLabel, "graphLabel");
function buildEvidenceGraph(spec, sources, evidence, strongest, contradictions) {
  const nodes = [
    { id: "question", type: "question", label: spec.question },
    { id: "specification", type: "specification", label: `${spec.metric} / ${spec.targetYear}` },
    { id: graphId(strongest.id), type: "datapoint", label: `${strongest.label}: ${strongest.value.toFixed(1)}%` },
    { id: "answer", type: "answer", label: `Answer: ${strongest.value.toFixed(1)}%` }
  ];
  const edges = [
    { from: "question", to: "specification", relation: "specifies" },
    { from: graphId(strongest.id), to: "answer", relation: "supports" }
  ];
  for (const source of sources.filter((item) => item.status === "available")) {
    const sourceNode = `source_${graphId(source.id)}`;
    nodes.push({ id: sourceNode, type: "source", label: `${source.publisher}: ${source.title}` });
    edges.push({ from: "specification", to: sourceNode, relation: "publishes" });
    for (const item of source.evidence) {
      const evidenceNode = graphId(item.id);
      nodes.push({ id: evidenceNode, type: "datapoint", label: `${item.label}: ${item.value} ${item.unit}` });
      edges.push({ from: sourceNode, to: evidenceNode, relation: "supports" });
      if (item.supports.includes(strongest.id)) {
        edges.push({ from: evidenceNode, to: graphId(strongest.id), relation: "calculates" });
      }
    }
  }
  for (const contradiction of contradictions) {
    const node = graphId(contradiction.id);
    nodes.push({ id: node, type: "contradiction", label: `${contradiction.challengerValue}% (${contradiction.challengerPeriod})` });
    edges.push({ from: `source_${graphId(contradiction.challengerSourceId)}`, to: node, relation: "challenges" });
    edges.push({ from: node, to: "answer", relation: "qualifies" });
  }
  const lines = ["graph TD"];
  for (const node of nodes) lines.push(`  ${node.id}["${graphLabel(node.label)}"]`);
  for (const edge of edges) lines.push(`  ${edge.from} -->|${edge.relation}| ${edge.to}`);
  return { nodes, edges, mermaid: lines.join("\n") };
}
__name(buildEvidenceGraph, "buildEvidenceGraph");
function renderMarkdown(investigation) {
  const { spec, sourceRecipe, answer, strongestDatapoint, sources, independentSourceCheck, contradictions, evidenceGraph } = investigation;
  const sourceLines = sources.filter((source) => source.status === "available").map((source) => `- [${source.publisher}: ${source.title}](${source.url}) \u2014 authority rank ${source.rank}.`).join("\n");
  const contradictionLines = contradictions.length === 0 ? "- No material disagreement found." : contradictions.map((item) => `- **${item.status}**: ${item.explanation} Challenger: ${item.challengerValue}% (${item.challengerPeriod}); primary: ${item.primaryValue}% (${item.primaryPeriod}).`).join("\n");
  const claimLines = answer.claims.map((claim2) => `- ${claim2.text} _(evidence: ${claim2.evidenceIds.join(", ")})_`).join("\n");
  const quoteLines = sources.filter((source) => source.status === "available").flatMap((source) => source.evidence.map((item) => `> ${item.exactQuote}
> \u2014 ${source.publisher}, ${item.locator}`)).join("\n\n");
  return `---
title: "${spec.canonicalQuestion.replace(/"/g, '\\"')}"
question: "${spec.canonicalQuestion.replace(/"/g, '\\"')}"
answer_status: ${investigation.status}
target_year: ${spec.targetYear}
tags:
  - clove-research
  - evidence
---

# ${spec.canonicalQuestion}

## Answer

${answer.text}

The strongest datapoint is **${strongestDatapoint.value.toFixed(1)}%** for ${strongestDatapoint.period}, calculated from the cited generation values.

## Research specification

- Geography: ${spec.geography}
- Metric: ${spec.metric}
- Target: ${spec.target}
- Complete-year rule: ${spec.targetYear}, not a monthly or forecast value
- Distinction checks: ${spec.distinctionChecks.join("; ")}

## Source recipe

- Recipe: ${sourceRecipe.recipe.id} (${sourceRecipe.confidence} routing confidence)
- Matched signals: ${sourceRecipe.matchedSignals.join(", ")}
- Preferred access: ${sourceRecipe.recipe.preferred_access.join(", ")}
- Challenge: ${sourceRecipe.recipe.challenge.strategy}

## Supported claims

${claimLines}

## Independent-source check

**${independentSourceCheck.status}** \u2014 ${independentSourceCheck.explanation}

## Contradiction search

${contradictionLines}

## Evidence excerpts

${quoteLines}

## Evidence graph

\`\`\`mermaid
${evidenceGraph.mermaid}
\`\`\`

## Sources

${sourceLines}

## Portability note

This Markdown contains the answer, provenance, contradiction record, and graph without requiring Clove Research to remain available.
`;
}
__name(renderMarkdown, "renderMarkdown");
async function investigate(question, options = {}) {
  const sourceRecipe = selectSourceRecipe(question);
  if (!sourceRecipe) throw new UnsupportedQuestionError();
  const spec = researchSpecFor(question);
  if (!spec) throw new UnsupportedQuestionError();
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? /* @__PURE__ */ new Date();
  const definitions = options.sources ?? SOURCE_CATALOG;
  const ranked = rankSources(await Promise.all(definitions.map((source) => fetchSource(source, fetcher))));
  const primary = ranked.find((source) => source.id === "statcan-2024" && source.status === "available");
  if (!primary) throw new ResearchSourceError("primary_source_unavailable");
  const total = primary.evidence.find((item) => item.id === "statcan-total-generation-2024");
  const nuclear = primary.evidence.find((item) => item.id === "statcan-nuclear-generation-2024");
  if (!total || !nuclear) throw new ResearchSourceError("primary_datapoints_incomplete");
  const share = roundedPercent(nuclear.value / total.value * 100);
  const strongest = sourceEvidence(
    "statcan-2024",
    "canada-nuclear-share-2024",
    "Nuclear share of Canada electricity generation",
    share,
    "percent",
    String(spec.targetYear),
    "calculated",
    `${nuclear.value} / ${total.value} million MWh \xD7 100 = ${share.toFixed(1)}%`,
    "Calculated from the two Statistics Canada national generation datapoints",
    [total.id, nuclear.id]
  );
  const evidence = [...ranked.flatMap((source) => source.evidence), strongest];
  const challenger = ranked.find((source) => source.id === "cer-2021" && source.status === "available")?.evidence.find((item) => item.id === "cer-nuclear-share-2021");
  const contradictions = challenger ? [classifyDisagreement(strongest, challenger)].filter(Boolean) : [];
  const independentChallenger = ranked.find((source) => source.id === "cer-2021" && source.status === "available");
  const independentSourceCheck = independentChallenger ? {
    status: "pass",
    sourceIds: [primary.id, independentChallenger.id],
    explanation: `The independent Canada Energy Regulator source was retrieved and compared; its ${independentChallenger.evidence[0]?.value}% figure is explicitly retained as a ${independentChallenger.evidence[0]?.period} challenger, not treated as ${spec.targetYear} corroboration.`
  } : {
    status: "incomplete",
    sourceIds: [primary.id],
    explanation: "The primary source is available, but the independent corroborator could not be retrieved."
  };
  const unresolvedDisagreements = contradictions.filter((item) => item.status === "unresolved");
  const answerText = unresolvedDisagreements.length > 0 ? `The strongest matching source reports approximately ${share.toFixed(1)}% for ${spec.targetYear}, but a same-period disagreement remains unresolved.` : `In ${spec.targetYear}, nuclear power supplied approximately ${share.toFixed(1)}% of Canada's electricity generation (${nuclear.value} of ${total.value} million MWh).`;
  const answer = {
    text: answerText,
    claims: [{
      id: "claim-canada-nuclear-share",
      text: answerText,
      evidenceIds: [strongest.id, total.id, nuclear.id]
    }]
  };
  const evidenceGraph = buildEvidenceGraph(spec, ranked, evidence, strongest, contradictions);
  const base = {
    status: unresolvedDisagreements.length > 0 ? "needs_review" : "supported",
    sourceRecipe,
    spec,
    answer,
    strongestDatapoint: strongest,
    sources: ranked,
    evidence,
    independentSourceCheck,
    contradictions,
    unresolvedDisagreements,
    evidenceGraph,
    computePath: "public_source_only",
    generatedAt: now.toISOString()
  };
  return { ...base, markdown: renderMarkdown(base) };
}
__name(investigate, "investigate");

// src/discovery/independence.ts
function underlyingSourceKey(candidate) {
  const doi = candidate.doi ?? candidate.identifiers.doi;
  if (doi) return `doi:${doi.toLowerCase().replace(/^https?:\/\/doi.org\//, "")}`;
  const dataSource = candidate.identifiers.dataSourceId ?? candidate.identifiers.productId ?? candidate.identifiers.vectorId;
  if (dataSource) return `data:${candidate.sourceClass}:${dataSource}`;
  try {
    const url = new URL(candidate.url);
    return `url:${candidate.sourceClass}:${url.origin}${url.pathname}`;
  } catch {
    return `candidate:${candidate.sourceId}`;
  }
}
__name(underlyingSourceKey, "underlyingSourceKey");
function evaluateSourceIndependence(candidates) {
  const groupsByKey = /* @__PURE__ */ new Map();
  for (const candidate of candidates) {
    const key = underlyingSourceKey(candidate);
    const group = groupsByKey.get(key) ?? { key, candidateIds: [] };
    group.candidateIds.push(candidate.sourceId);
    groupsByKey.set(key, group);
  }
  const groups = [...groupsByKey.values()];
  if (groups.length === 0) {
    return {
      independentSupportCount: 0,
      totalCandidates: 0,
      groups,
      verdict: "no_candidates",
      explanation: "No candidates were discovered, so no independent support exists."
    };
  }
  if (groups.length === 1) {
    return {
      independentSupportCount: 1,
      totalCandidates: candidates.length,
      groups,
      verdict: "single_underlying_source",
      explanation: "The candidates collapse to one DOI, data product, vector, or canonical source URL."
    };
  }
  return {
    independentSupportCount: groups.length,
    totalCandidates: candidates.length,
    groups,
    verdict: "multiple_underlying_sources",
    explanation: `${groups.length} distinct underlying sources were discovered; repeated metadata records do not increase this count.`
  };
}
__name(evaluateSourceIndependence, "evaluateSourceIndependence");

// src/discovery/types.ts
var DiscoveryAdapterError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "DiscoveryAdapterError";
  }
  status;
  static {
    __name(this, "DiscoveryAdapterError");
  }
};

// src/discovery/normalize.ts
var DEFAULT_DISCOVERY_TIMEOUT_MS = 8e3;
var DEFAULT_DISCOVERY_MAX_BYTES = 1048576;
function normalizeText(value) {
  return value.normalize("NFKC").toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9% ]/g, " ").replace(/\s+/g, " ").trim();
}
__name(normalizeText, "normalizeText");
function decodeEntities(value) {
  return value.replace(/&nbsp;|&#160;|&#xA0;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))).replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}
__name(decodeEntities, "decodeEntities");
function stripTags(value) {
  return decodeEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}
__name(stripTags, "stripTags");
function absoluteUrl(value, base) {
  return new URL(value, base).toString();
}
__name(absoluteUrl, "absoluteUrl");
function dateParts(value) {
  if (!Array.isArray(value) || value.length === 0) return void 0;
  const [year, month, day] = value.map(Number);
  if (!Number.isInteger(year)) return void 0;
  if (!Number.isInteger(month)) return String(year).padStart(4, "0");
  if (!Number.isInteger(day)) return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
__name(dateParts, "dateParts");
function nowIso(context) {
  return (context?.now ?? /* @__PURE__ */ new Date()).toISOString();
}
__name(nowIso, "nowIso");
async function readBoundedText2(response, maxBytes) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new DiscoveryAdapterError("SOURCE_UNAVAILABLE", "response_body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
__name(readBoundedText2, "readBoundedText");
async function requestText(fetcher, url, init, context, maxBytes) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("discovery_timeout"), context?.timeoutMs ?? DEFAULT_DISCOVERY_TIMEOUT_MS);
  try {
    let response;
    try {
      response = await fetcher(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) throw new DiscoveryAdapterError("SOURCE_UNAVAILABLE", "source_timeout");
      throw new DiscoveryAdapterError("SOURCE_UNAVAILABLE", error instanceof Error ? error.message : "source_fetch_failed");
    }
    if (response.status === 429 || response.status === 420) {
      throw new DiscoveryAdapterError("RATE_LIMITED", `source_http_${response.status}`);
    }
    if (!response.ok) throw new DiscoveryAdapterError("SOURCE_UNAVAILABLE", `source_http_${response.status}`);
    return await readBoundedText2(response, maxBytes);
  } finally {
    clearTimeout(timeout);
  }
}
__name(requestText, "requestText");
async function fetchJson(url, context, options = {}) {
  const fetcher = context?.fetcher ?? fetch;
  const body = await requestText(
    fetcher,
    url,
    {
      method: options.method ?? "GET",
      body: options.body,
      headers: {
        accept: "application/json",
        ...options.body ? { "content-type": "application/json" } : {}
      }
    },
    context,
    options.maxBytes ?? DEFAULT_DISCOVERY_MAX_BYTES
  );
  try {
    return JSON.parse(body);
  } catch {
    throw new DiscoveryAdapterError("SOURCE_UNAVAILABLE", "invalid_json");
  }
}
__name(fetchJson, "fetchJson");
async function fetchText(url, context, options = {}) {
  const fetcher = context?.fetcher ?? fetch;
  return requestText(
    fetcher,
    url,
    { headers: { accept: options.accept ?? "text/html,application/xml,text/xml" } },
    context,
    options.maxBytes ?? DEFAULT_DISCOVERY_MAX_BYTES
  );
}
__name(fetchText, "fetchText");
function errorMessage(error) {
  return error instanceof DiscoveryAdapterError ? `${error.status}:${error.message}` : error instanceof Error ? error.message : "discovery_failed";
}
__name(errorMessage, "errorMessage");

// src/discovery/crossref.ts
var CROSSREF_ENDPOINT = "https://api.crossref.org/works";
var MAX_RESPONSE_BYTES = 512 * 1024;
var MAX_ROWS = 12;
function normalizeDoi(value) {
  if (!value) return void 0;
  return value.trim().replace(/^https?:\/\/doi.org\//i, "").replace(/^doi:/i, "").toLowerCase();
}
__name(normalizeDoi, "normalizeDoi");
function publishedAt(item) {
  return dateParts(item["published-print"]?.["date-parts"]?.[0]) ?? dateParts(item["published-online"]?.["date-parts"]?.[0]) ?? dateParts(item.published?.["date-parts"]?.[0]) ?? dateParts(item.issued?.["date-parts"]?.[0]);
}
__name(publishedAt, "publishedAt");
function publicationType(item, title) {
  const normalizedTitle = normalizeText(title);
  if (/systematic review|meta analysis|meta-analysis|scoping review|review of/.test(normalizedTitle)) return "review_or_meta_analysis";
  if (/randomized|randomised|trial|controlled study|pilot study/.test(normalizedTitle)) return "primary_study_or_trial";
  return item.type ?? "unclassified_crossref_work";
}
__name(publicationType, "publicationType");
function candidateFromItem(item, question, context, endpoint) {
  const title = item.title?.[0]?.trim();
  const doi = normalizeDoi(item.DOI);
  if (!title || !doi) return null;
  const authors = (item.author ?? []).map((author) => author.name ?? [author.given, author.family].filter(Boolean).join(" ")).filter(Boolean);
  const updates = item.update ?? [];
  const url = item.URL ?? `https://doi.org/${doi}`;
  return {
    sourceId: `crossref-doi-${doi}`,
    sourceClass: "scientific_finding",
    title,
    url,
    authority: "metadata",
    institution: item.publisher,
    publishedAt: publishedAt(item),
    doi,
    identifiers: {
      doi,
      workType: item.type ?? "not_reported",
      subtype: item.subtype ?? "not_reported",
      publicationType: publicationType(item, title),
      journal: item["container-title"]?.[0] ?? "not_reported",
      authorCount: String(authors.length),
      authors: authors.join("; "),
      funderCount: String(item.funder?.length ?? 0),
      funders: (item.funder ?? []).map((funder) => funder.name ?? funder.DOI ?? "unnamed").join("; ") || "none_deposited",
      updateCount: String(updates.length),
      updateLabels: updates.map((update) => update.label ?? update.type ?? "unlabelled_update").join("; ") || "none_deposited",
      retractionOrCorrectionMetadata: updates.some((update) => /retract|correct|expression/i.test(`${update.label ?? ""} ${update.type ?? ""}`)) ? "present" : "not_detected",
      evidenceStatus: "RESEARCH_REQUIRED"
    },
    discoveryMethod: "crossref_rest:/works",
    queryUsed: question,
    provenance: {
      provider: "Crossref REST API",
      retrievedAt: nowIso(context),
      endpoint
    }
  };
}
__name(candidateFromItem, "candidateFromItem");
function result(status, question, context, candidates, errors, endpoint) {
  return {
    recipeId: "scientific_finding",
    sourceClass: "scientific_finding",
    status,
    candidates,
    queryUsed: question,
    endpoints: [endpoint],
    independence: evaluateSourceIndependence(candidates),
    retrievedAt: nowIso(context),
    errors
  };
}
__name(result, "result");
var crossrefAdapter = {
  recipeId: "scientific_finding",
  sourceClass: "scientific_finding",
  async discover(question, context = {}) {
    const endpoint = `${CROSSREF_ENDPOINT}?query.bibliographic=${encodeURIComponent(question)}&rows=${MAX_ROWS}`;
    let response;
    try {
      response = await fetchJson(endpoint, context, { maxBytes: MAX_RESPONSE_BYTES });
    } catch (error) {
      const status = error instanceof Error && "status" in error ? error.status : "SOURCE_UNAVAILABLE";
      return result(status, question, context, [], [errorMessage(error)], endpoint);
    }
    const deduped = /* @__PURE__ */ new Map();
    for (const item of response.message?.items ?? []) {
      const candidate = candidateFromItem(item, question, context, endpoint);
      if (candidate && !deduped.has(candidate.sourceId)) deduped.set(candidate.sourceId, candidate);
    }
    const candidates = [...deduped.values()];
    return result(candidates.length > 0 ? "RESEARCH_REQUIRED" : "DISCOVERY_EMPTY", question, context, candidates, [], endpoint);
  }
};

// src/discovery/justice-laws.ts
var JUSTICE_BASE = "https://laws-lois.justice.gc.ca";
var LOOKUP_ENDPOINT = `${JUSTICE_BASE}/js/lookup_e.xml`;
var MAX_LOOKUP_BYTES = 1e6;
var MAX_LEGISLATION_BYTES = 1e6;
var MAX_MATCHES = 4;
function attribute(attributes, name) {
  return attributes.match(new RegExp(`${name}=["']([^"']*)["']`, "i"))?.[1];
}
__name(attribute, "attribute");
function tagText(block, tag) {
  const value = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))?.[1];
  return value ? stripTags(value) : void 0;
}
__name(tagText, "tagText");
function parseLookup(xml, question) {
  const query = normalizeText(question);
  const terms = ["cannabis", "possession", "young", "federal", "law", "regulation"].filter((term) => query.includes(term));
  const records = [];
  for (const match of xml.matchAll(/<D\b([^>]*)>([\s\S]*?)<\/D>/gi)) {
    const attributes = match[1];
    const block = match[2];
    const type = attribute(attributes, "t");
    if (type !== "a" && type !== "r") continue;
    const title = decodeEntities(tagText(block, "T") ?? "");
    const code = decodeEntities(tagText(block, "C") ?? "");
    if (!title || !code || !terms.some((term) => normalizeText(title).includes(term))) continue;
    records.push({ type, code, title, repealed: attribute(attributes, "rep") === "true" || /\[repealed\]/i.test(title) });
  }
  return records.filter((record) => !record.repealed).sort((left, right) => {
    const priority = /* @__PURE__ */ __name((record) => {
      const title = normalizeText(record.title);
      if (record.type === "a" && title === "cannabis act") return 100;
      if (record.type === "r" && title === "cannabis regulations") return 90;
      if (record.type === "r" && title.includes("cannabis")) return 50;
      return 10;
    }, "priority");
    return priority(right) - priority(left);
  }).slice(0, MAX_MATCHES);
}
__name(parseLookup, "parseLookup");
function legislationPath(record) {
  if (record.type === "a") return `/eng/acts/${record.code}/index.html`;
  return `/eng/regulations/${record.code.replaceAll("/", "-").replaceAll(" ", "_")}/index.html`;
}
__name(legislationPath, "legislationPath");
function parseHtml(html, record) {
  const title = stripTags(html.match(/<h1[^>]*id=["']wb-cont["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? record.title).replace(/\s+\([^)]*\)$/, "").trim();
  const currentTo = html.match(/(?:Act|Regulations?)\s+current to\s+(\d{4}-\d{2}-\d{2})/i)?.[1];
  const lastAmendedDate = html.match(/last amended\s+on\s+(\d{4}-\d{2}-\d{2})/i)?.[1];
  const xmlHref = html.match(/href=["']([^"']*\/XML\/[^"']+\.xml)["']/i)?.[1];
  const previousHref = html.match(/href=["']([^"']*PITIndex\.html)["']/i)?.[1];
  const relatedHref = html.match(/href=["']([^"']*rpdc\.html)["']/i)?.[1];
  return {
    title,
    currentTo,
    xmlUrl: xmlHref ? absoluteUrl(xmlHref, JUSTICE_BASE) : void 0,
    previousVersionsUrl: previousHref ? absoluteUrl(previousHref, JUSTICE_BASE) : void 0,
    relatedProvisionsUrl: relatedHref ? absoluteUrl(relatedHref, JUSTICE_BASE) : void 0,
    lastAmendedDate,
    hasNotInForceMarkers: /not in force|shaded provisions|in-force/i.test(html)
  };
}
__name(parseHtml, "parseHtml");
function parseXml(xml) {
  const root = xml.match(/^\s*<[^!?][^>]*>/)?.[0] ?? "";
  return {
    uniqueId: tagText(xml, "ConsolidatedNumber") ?? attribute(root, "lims:id"),
    title: tagText(xml, "ShortTitle"),
    currentTo: attribute(root, "lims:current-date") ?? attribute(root, "CurrentToDate"),
    hasPreviousVersion: attribute(root, "hasPreviousVersion"),
    inForce: attribute(root, "in-force")
  };
}
__name(parseXml, "parseXml");
function result2(status, question, context, candidates, errors) {
  return {
    recipeId: "canadian_law",
    sourceClass: "canadian_law",
    status,
    candidates,
    queryUsed: question,
    endpoints: [LOOKUP_ENDPOINT],
    independence: evaluateSourceIndependence(candidates),
    retrievedAt: nowIso(context),
    errors
  };
}
__name(result2, "result");
var justiceLawsAdapter = {
  recipeId: "canadian_law",
  sourceClass: "canadian_law",
  async discover(question, context = {}) {
    let lookup;
    try {
      lookup = await fetchText(LOOKUP_ENDPOINT, context, { accept: "application/xml,text/xml", maxBytes: MAX_LOOKUP_BYTES });
    } catch (error) {
      const status2 = error instanceof Error && "status" in error ? error.status : "SOURCE_UNAVAILABLE";
      return result2(status2, question, context, [], [errorMessage(error)]);
    }
    const records = parseLookup(lookup, question);
    if (records.length === 0) return result2("DISCOVERY_EMPTY", question, context, [], []);
    const candidates = [];
    const errors = [];
    for (const record of records) {
      const htmlUrl = absoluteUrl(legislationPath(record), JUSTICE_BASE);
      try {
        const html = await fetchText(htmlUrl, context, { accept: "text/html", maxBytes: MAX_LEGISLATION_BYTES });
        const htmlMetadata = parseHtml(html, record);
        if (!htmlMetadata.xmlUrl) {
          errors.push(`${record.code}:missing_xml_link`);
          continue;
        }
        const xml = await fetchText(htmlMetadata.xmlUrl, context, { accept: "application/xml,text/xml", maxBytes: MAX_LEGISLATION_BYTES });
        const xmlMetadata = parseXml(xml);
        const type = record.type === "a" ? "act" : "regulation";
        const currentTo = htmlMetadata.currentTo ?? xmlMetadata.currentTo;
        candidates.push({
          sourceId: `justice-${type}-${record.code.replaceAll("/", "-")}`,
          sourceClass: "canadian_law",
          title: htmlMetadata.title || xmlMetadata.title || record.title,
          url: htmlUrl,
          authority: "primary",
          institution: "Department of Justice Canada",
          publishedAt: xmlMetadata.currentTo,
          currentTo,
          identifiers: {
            uniqueId: xmlMetadata.uniqueId ?? record.code,
            catalogCode: record.code,
            instrumentType: type,
            versionStatus: "current_consolidated",
            inForceStatus: xmlMetadata.inForce ?? "source_defined",
            currentToDate: currentTo ?? "not_reported",
            xmlUrl: htmlMetadata.xmlUrl,
            previousVersionsUrl: htmlMetadata.previousVersionsUrl ?? "not_linked",
            relatedProvisionsUrl: htmlMetadata.relatedProvisionsUrl ?? "not_linked",
            amendmentsNotInForce: htmlMetadata.hasNotInForceMarkers ? "markers_present" : "not_detected",
            lastAmendedDate: htmlMetadata.lastAmendedDate ?? "not_reported",
            officialConsolidation: "true"
          },
          discoveryMethod: "justice_laws:lookup_e.xml+consolidated_html+canonical_xml",
          queryUsed: question,
          provenance: {
            provider: "Justice Laws Website / Department of Justice Canada",
            retrievedAt: nowIso(context),
            endpoint: LOOKUP_ENDPOINT
          }
        });
      } catch (error) {
        errors.push(`${record.code}:${errorMessage(error)}`);
      }
    }
    const status = candidates.length === 0 ? "DISCOVERY_PARTIAL" : errors.length > 0 ? "DISCOVERY_PARTIAL" : "DISCOVERY_COMPLETE";
    return result2(status, question, context, candidates, errors);
  }
};

// src/discovery/statcan.ts
var WDS_BASE = "https://www150.statcan.gc.ca/t1/wds/rest";
var CUBE_INDEX_ENDPOINT = `${WDS_BASE}/getAllCubesListLite`;
var CUBE_METADATA_ENDPOINT = `${WDS_BASE}/getCubeMetadata`;
var MAX_INDEX_BYTES = 8 * 1024 * 1024;
var MAX_METADATA_BYTES = 512 * 1024;
var MAX_METADATA_CANDIDATES = 3;
var FREQUENCIES = {
  1: "Daily",
  2: "Weekly",
  6: "Monthly",
  9: "Quarterly",
  11: "Semi-annual",
  12: "Annual"
};
function asProductId(value) {
  const productId = Number(value);
  return Number.isInteger(productId) && productId > 0 ? productId : null;
}
__name(asProductId, "asProductId");
function isCanadaPopulationCube(cube) {
  return normalizeText(cube.cubeTitleEn ?? "").includes("population");
}
__name(isCanadaPopulationCube, "isCanadaPopulationCube");
function scoreCube(cube) {
  const title = normalizeText(cube.cubeTitleEn ?? "");
  let score = 0;
  if (title.includes("population estimates on july 1")) score += 10;
  if (title.includes("population estimates")) score += 6;
  if (title.includes("canada")) score += 3;
  if (cube.frequencyCode === 12) score += 4;
  if (String(cube.archived) === "2") score += 2;
  if (title.includes("quarterly")) score -= 1;
  if (title.includes("projected")) score -= 5;
  if (title.includes("inactive")) score -= 8;
  return score;
}
__name(scoreCube, "scoreCube");
function hasCanadaGeography(metadata) {
  return (metadata.dimension ?? []).some(
    (dimension) => normalizeText(dimension.dimensionNameEn ?? "") === "geography" && (dimension.member ?? []).some((member) => normalizeText(member.memberNameEn ?? "") === "canada")
  );
}
__name(hasCanadaGeography, "hasCanadaGeography");
function result3(status, question, context, candidates, errors) {
  return {
    recipeId: "official_canadian_statistic",
    sourceClass: "official_canadian_statistic",
    status,
    candidates,
    queryUsed: question,
    endpoints: [CUBE_INDEX_ENDPOINT, CUBE_METADATA_ENDPOINT],
    independence: evaluateSourceIndependence(candidates),
    retrievedAt: nowIso(context),
    errors
  };
}
__name(result3, "result");
var statcanAdapter = {
  recipeId: "official_canadian_statistic",
  sourceClass: "official_canadian_statistic",
  async discover(question, context = {}) {
    let index;
    try {
      index = await fetchJson(CUBE_INDEX_ENDPOINT, context, { maxBytes: MAX_INDEX_BYTES });
    } catch (error) {
      return result3(error instanceof Error && "status" in error ? error.status : "SOURCE_UNAVAILABLE", question, context, [], [errorMessage(error)]);
    }
    const ranked = index.filter(isCanadaPopulationCube).sort((left, right) => scoreCube(right) - scoreCube(left)).slice(0, MAX_METADATA_CANDIDATES);
    if (ranked.length === 0) return result3("DISCOVERY_EMPTY", question, context, [], []);
    const candidates = [];
    const errors = [];
    for (const cube of ranked) {
      const productId = asProductId(cube.productId);
      if (!productId) {
        errors.push("invalid_product_id");
        continue;
      }
      try {
        const response = await fetchJson(
          CUBE_METADATA_ENDPOINT,
          context,
          { method: "POST", body: JSON.stringify([{ productId }]), maxBytes: MAX_METADATA_BYTES }
        );
        const metadata = response[0]?.object;
        if (!metadata || !hasCanadaGeography(metadata)) {
          errors.push(`geography_validation_failed:${productId}`);
          continue;
        }
        const frequency = FREQUENCIES[Number(metadata.frequencyCode ?? cube.frequencyCode)] ?? `code_${metadata.frequencyCode ?? cube.frequencyCode}`;
        const title = metadata.cubeTitleEn ?? cube.cubeTitleEn ?? `Statistics Canada cube ${productId}`;
        candidates.push({
          sourceId: `statcan-cube-${productId}`,
          sourceClass: "official_canadian_statistic",
          title,
          url: `https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${productId}01`,
          authority: "primary",
          institution: "Statistics Canada",
          publishedAt: metadata.issueDate ?? cube.issueDate ?? cube.releaseTime,
          measurementPeriod: `${frequency}; table_end=${(metadata.cubeEndDate ?? cube.cubeEndDate ?? "").slice(0, 10)}; reference_period_rule=${normalizeText(title).includes("july 1") ? "July 1" : "source_defined"}`,
          identifiers: {
            productId: String(productId),
            ...metadata.cansimId ?? cube.cansimId ? { cansimId: String(metadata.cansimId ?? cube.cansimId) } : {},
            frequencyCode: String(metadata.frequencyCode ?? cube.frequencyCode ?? ""),
            frequency,
            archiveStatusCode: String(metadata.archiveStatusCode ?? cube.archived ?? ""),
            archiveStatus: metadata.archiveStatusEn ?? "source_defined",
            geography: "Canada",
            metadataEndpoint: CUBE_METADATA_ENDPOINT,
            referencePeriodEndpointTemplate: `${WDS_BASE}/getDataFromVectorByReferencePeriodRange`,
            dataRetrievalMode: "metadata_then_reference_period_or_vector"
          },
          discoveryMethod: "statcan_wds:getAllCubesListLite+getCubeMetadata",
          queryUsed: question,
          provenance: {
            provider: "Statistics Canada Web Data Service",
            retrievedAt: nowIso(context),
            endpoint: CUBE_METADATA_ENDPOINT
          }
        });
      } catch (error) {
        errors.push(`${productId}:${errorMessage(error)}`);
      }
    }
    const status = candidates.length === 0 ? "DISCOVERY_PARTIAL" : errors.length > 0 ? "DISCOVERY_PARTIAL" : "DISCOVERY_COMPLETE";
    return result3(status, question, context, candidates, errors);
  }
};

// src/discovery/registry.ts
var DISCOVERY_REGISTRY = Object.freeze({
  official_canadian_statistic: statcanAdapter,
  canadian_law: justiceLawsAdapter,
  scientific_finding: crossrefAdapter
});
function adapterForRecipe(recipeId) {
  return DISCOVERY_REGISTRY[recipeId] ?? null;
}
__name(adapterForRecipe, "adapterForRecipe");
async function discoverQuestion(question, context = {}) {
  const selection = selectSourceRecipe(question);
  if (!selection) {
    return {
      recipeId: "unknown",
      sourceClass: "unknown",
      status: "RECIPE_NOT_FOUND",
      candidates: [],
      queryUsed: question,
      endpoints: [],
      independence: {
        independentSupportCount: 0,
        totalCandidates: 0,
        groups: [],
        verdict: "no_candidates",
        explanation: "No deterministic source recipe matched this question."
      },
      retrievedAt: (context.now ?? /* @__PURE__ */ new Date()).toISOString(),
      errors: []
    };
  }
  const adapter = adapterForRecipe(selection.recipe.id);
  if (!adapter) {
    return {
      recipeId: selection.recipe.id,
      sourceClass: selection.recipe.id,
      status: "RECIPE_NOT_FOUND",
      candidates: [],
      queryUsed: question,
      endpoints: [],
      independence: {
        independentSupportCount: 0,
        totalCandidates: 0,
        groups: [],
        verdict: "no_candidates",
        explanation: "The recipe exists but has no registered discovery adapter."
      },
      retrievedAt: (context.now ?? /* @__PURE__ */ new Date()).toISOString(),
      errors: ["adapter_not_registered"]
    };
  }
  return adapter.discover(question, context);
}
__name(discoverQuestion, "discoverQuestion");

// src/evidence.ts
var EvidenceExtractionError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "EvidenceExtractionError";
  }
  code;
  static {
    __name(this, "EvidenceExtractionError");
  }
};
function discoveryContext(options) {
  return { fetcher: options.fetcher, now: options.now };
}
__name(discoveryContext, "discoveryContext");
function claim(input, retrievedAt) {
  return { ...input, retrievedAt };
}
__name(claim, "claim");
function sourceFromInvestigation(investigation) {
  return investigation.sources.map((source) => ({
    sourceId: source.id,
    sourceClass: "official_canadian_statistic",
    title: source.title,
    url: source.url,
    authority: source.role === "primary" ? "primary" : "secondary",
    institution: source.publisher,
    measurementPeriod: source.evidence[0]?.period,
    identifiers: {
      authorityScore: String(source.authorityScore),
      role: source.role
    },
    discoveryMethod: "proven_electricity_catalog",
    queryUsed: investigation.spec.question,
    provenance: {
      provider: source.publisher,
      retrievedAt: investigation.generatedAt,
      endpoint: source.url
    }
  }));
}
__name(sourceFromInvestigation, "sourceFromInvestigation");
function validation(overrides = {}) {
  return {
    geographyMatched: "not_applicable",
    periodMatched: "not_applicable",
    unitMatched: "not_applicable",
    populationMatched: "not_applicable",
    ...overrides
  };
}
__name(validation, "validation");
function graphFor(question, answerClaimIds, claims, sources) {
  const nodes = [
    { id: "question", type: "question", label: question },
    { id: "answer", type: "answer", label: "Best supported answer" }
  ];
  const edges = [{ from: "question", to: "answer", relation: "asks" }];
  const sourceIds = /* @__PURE__ */ new Set();
  for (const source of sources) {
    const id = `source-${source.sourceId}`;
    nodes.push({ id, type: "source", label: source.title, sourceId: source.sourceId });
    sourceIds.add(source.sourceId);
  }
  for (const item of claims) {
    const id = `claim-${item.id}`;
    nodes.push({ id, type: item.evidenceRole === "qualifies" || item.evidenceRole === "contradicts" ? "contradiction" : "claim", label: item.proposition, claimId: item.id, sourceId: item.sourceId });
    edges.push({ from: id, to: "answer", relation: item.evidenceRole === "qualifies" ? "qualifies" : item.evidenceRole === "contradicts" ? "contradicts" : answerClaimIds.includes(item.id) ? "supports" : "context" });
    if (sourceIds.has(item.sourceId)) edges.push({ from: id, to: `source-${item.sourceId}`, relation: "published_by" });
    if (item.calculation) {
      for (const operand of item.calculation.operands) {
        const operandClaim = claims.find((candidate) => candidate.id === operand);
        if (operandClaim) edges.push({ from: id, to: `claim-${operandClaim.id}`, relation: "derived_from" });
      }
    }
  }
  return { nodes, edges };
}
__name(graphFor, "graphFor");
function yaml(value) {
  return JSON.stringify(value);
}
__name(yaml, "yaml");
function fileSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "note";
}
__name(fileSlug, "fileSlug");
function claimNote(item, recipeId, checked) {
  const source = `Sources/${fileSlug(item.sourceId)}`;
  const validationLines = Object.entries(item.validation).map(([key, value]) => `- ${key}: ${String(value)}`).join("\n");
  return `---
type: claim
status: ${item.status.toLowerCase()}
checked: ${checked}
recipe: ${recipeId}
source: "[[${source}]]"
measurement_period: ${yaml(item.measurementPeriod ?? "not_reported")}
---

# ${item.proposition}

${item.value !== void 0 ? `**Value:** ${item.value}${item.unit ? ` ${item.unit}` : ""}

` : ""}**Evidence role:** ${item.evidenceRole}

## Provenance

- Source location: ${Object.values(item.sourceLocation).filter(Boolean).join(" \xB7 ") || "source-defined"}
- Extraction method: ${item.extractionMethod}
- Retrieved: ${item.retrievedAt}

## Validation

${validationLines}

## Source fragment

${item.sourceFragment ? `> ${item.sourceFragment}` : "No source fragment was available; this claim is metadata-only."}
`;
}
__name(claimNote, "claimNote");
function sourceNote(source) {
  const identifiers = Object.entries(source.identifiers).map(([key, value]) => `- ${key}: ${value}`).join("\n");
  return `---
type: source
source_id: ${yaml(source.sourceId)}
authority: ${source.authority}
---

# ${source.title}

- URL: ${source.url}
- Institution: ${source.institution ?? "not reported"}
- Discovery method: ${source.discoveryMethod}
- Query: ${source.queryUsed}
- Provider: ${source.provenance.provider}
- Retrieved: ${source.provenance.retrievedAt}
- Endpoint: ${source.provenance.endpoint}

## Identifiers

${identifiers || "- none reported"}
`;
}
__name(sourceNote, "sourceNote");
function buildExport(experience) {
  const checked = experience.generatedAt.slice(0, 10);
  const files = [];
  const claimLinks = experience.claims.map((item) => `- [[Claims/${fileSlug(item.id)}|${item.proposition}]]`).join("\n");
  const sourceLinks = experience.sources.map((source) => `- [[Sources/${fileSlug(source.sourceId)}|${source.title}]]`).join("\n");
  const calculationLinks = experience.claims.filter((item) => item.calculation).map((item) => `- [[Data/${fileSlug(item.id)}|${item.calculation?.formula}]]`).join("\n");
  const contradictionLinks = experience.claims.filter((item) => item.evidenceRole === "qualifies" || item.evidenceRole === "contradicts").map((item) => `- [[Contradictions/${fileSlug(item.id)}|${item.proposition}]]`).join("\n");
  const root = `---
type: investigation
status: ${experience.status.toLowerCase()}
checked: ${checked}
recipe: ${experience.recipeId}
---

# ${experience.question}

## Best supported answer

${experience.answer.text}

## Why Clove thinks that

${experience.whyThisAnswer}

## Claims

${claimLinks || "- None established."}

## Sources

${sourceLinks || "- None discovered."}

## Contradictions and qualifications

${contradictionLinks || "- None recorded."}

## Calculations

${calculationLinks || "- None."}

## What Clove still does not know

${experience.unknowns.map((item) => `- ${item}`).join("\n") || "- Nothing recorded."}

## Evidence graph

${experience.graph.edges.map((edge) => `- ${edge.from} \u2014${edge.relation}\u2192 ${edge.to}`).join("\n")}
`;
  files.push({ path: "Research/Investigation.md", content: root });
  for (const item of experience.claims) {
    files.push({ path: `Research/Claims/${fileSlug(item.id)}.md`, content: claimNote(item, experience.recipeId, checked) });
    if (item.evidenceRole === "qualifies" || item.evidenceRole === "contradicts") {
      files.push({ path: `Research/Contradictions/${fileSlug(item.id)}.md`, content: `---
type: contradiction
status: ${item.status.toLowerCase()}
checked: ${checked}
recipe: ${experience.recipeId}
claim: "${item.id}"
---

# Qualification

${item.proposition}

${item.sourceFragment ?? ""}
` });
    }
    if (item.calculation) {
      files.push({ path: `Research/Data/${fileSlug(item.id)}.md`, content: `---
type: data
status: established
checked: ${checked}
recipe: ${experience.recipeId}
claim: "${item.id}"
---

# Calculation

${item.calculation.formula}

Operands:
${item.calculation.operands.map((operand) => `- [[Claims/${fileSlug(operand)}]]`).join("\n")}
` });
    }
  }
  for (const source of experience.sources) files.push({ path: `Research/Sources/${fileSlug(source.sourceId)}.md`, content: sourceNote(source) });
  return { rootPath: "Research/Investigation.md", files };
}
__name(buildExport, "buildExport");
function makeExperience(input) {
  return { ...input, export: buildExport(input) };
}
__name(makeExperience, "makeExperience");
function timelineForDiscovery(discovery) {
  return [
    { label: `Classified as ${discovery.recipeId}`, state: "complete", detail: "The existing deterministic source recipe matched the question." },
    { label: "Looking for primary sources", state: "complete", detail: `${discovery.candidates.length} normalized candidate source(s) were returned.` },
    { label: "Discovery status", state: discovery.status === "DISCOVERY_COMPLETE" || discovery.status === "RESEARCH_REQUIRED" ? "complete" : "partial", detail: discovery.status }
  ];
}
__name(timelineForDiscovery, "timelineForDiscovery");
function sourceFor(discovery, predicate) {
  return discovery.candidates.find(predicate) ?? discovery.candidates[0];
}
__name(sourceFor, "sourceFor");
function dateIsCompleteAnnual(value, now) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return value <= now.toISOString().slice(0, 10);
}
__name(dateIsCompleteAnnual, "dateIsCompleteAnnual");
function populationPoint(source, point, retrievedAt) {
  const value = Number(point.value);
  const period = typeof point.refPerRaw === "string" ? point.refPerRaw : void 0;
  if (!Number.isFinite(value) || !period) return null;
  return claim({
    id: `statcan-population-${period.slice(0, 4)}`,
    proposition: `Canada's population was ${value.toLocaleString("en-CA")} on July 1, ${period.slice(0, 4)}.`,
    value,
    unit: "persons",
    geography: "Canada",
    population: "All ages; total gender",
    measurementPeriod: period,
    sourceId: source.sourceId,
    sourceType: "Statistics Canada Web Data Service",
    sourceLocation: {
      section: "getDataFromCubePidCoordAndLatestNPeriods",
      table: source.identifiers.productId,
      row: "Canada \xB7 Total - gender \xB7 All ages",
      column: period
    },
    sourceFragment: `vectorId=${point.vectorId ?? "466668"}; refPerRaw=${period}; value=${value}; frequencyCode=${point.frequencyCode ?? 12}`,
    evidenceRole: "supports",
    extractionMethod: "structured_data",
    validation: validation({ geographyMatched: true, periodMatched: true, unitMatched: true, populationMatched: true }),
    status: "ESTABLISHED"
  }, retrievedAt);
}
__name(populationPoint, "populationPoint");
async function extractPopulation(question, discovery, options) {
  const retrievedAt = nowIso(options);
  const source = sourceFor(discovery, (candidate) => candidate.identifiers.frequency === "Annual" && candidate.identifiers.productId === "17100005");
  if (!source?.identifiers.productId) throw new EvidenceExtractionError("INSUFFICIENT_EVIDENCE", "population_source_not_found");
  const endpoint = "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods";
  let points;
  try {
    const response = await fetchJson(
      endpoint,
      discoveryContext(options),
      { method: "POST", body: JSON.stringify([{ productId: Number(source.identifiers.productId), coordinate: "1.1.1.0.0.0.0.0.0.0", latestN: 8 }]), maxBytes: 256 * 1024 }
    );
    points = response[0]?.object?.vectorDataPoint ?? [];
  } catch (error) {
    throw new EvidenceExtractionError(error instanceof Error && "status" in error ? error.status : "SOURCE_UNAVAILABLE", error instanceof Error ? error.message : "population_data_unavailable");
  }
  const now = options.now ?? /* @__PURE__ */ new Date();
  const selected = [...points].filter((point) => typeof point.refPerRaw === "string" && dateIsCompleteAnnual(point.refPerRaw, now) && Number(point.frequencyCode) === 12).sort((left, right) => String(right.refPerRaw).localeCompare(String(left.refPerRaw)))[0];
  if (!selected) throw new EvidenceExtractionError("INSUFFICIENT_EVIDENCE", "no_complete_annual_population_point");
  const datapoint = populationPoint(source, selected, retrievedAt);
  if (!datapoint) throw new EvidenceExtractionError("INSUFFICIENT_EVIDENCE", "population_point_invalid");
  const answer = `The latest complete annual period found is July 1, ${datapoint.measurementPeriod?.slice(0, 4)}: Canada had ${Number(datapoint.value).toLocaleString("en-CA")} people.`;
  const claims = [datapoint];
  const timeline = [
    ...timelineForDiscovery(discovery),
    { label: "Retrieved Statistics Canada data", state: "complete", detail: `Vector 466668 from the total-Canada, all-ages, total-gender series.` },
    { label: "Matched Canada / annual period", state: "complete", detail: `Selected ${datapoint.measurementPeriod}; rejected newer non-complete observations if present.` },
    { label: "Challenger", state: "partial", detail: "No independent population challenger is configured in this bounded unit." }
  ];
  return makeExperience({
    status: "QUALIFIED",
    question,
    recipeId: discovery.recipeId,
    answer: { text: answer, claimIds: [datapoint.id] },
    whyThisAnswer: "The answer is taken from the exact annual Canada / total-gender / all-ages vector record. The period is selected from the source reference period, not from the latest release timestamp alone.",
    strongestDatapoint: datapoint,
    claims,
    sources: discovery.candidates,
    challenge: { status: "not_available", label: "Independent population challenger", detail: "Not configured for this bounded path.", claimIds: [] },
    graph: graphFor(question, [datapoint.id], claims, discovery.candidates),
    unknowns: ["No independent non-Statistics Canada corroboration was run for this population datapoint.", "This extraction does not answer age-specific, provincial, or projection questions."],
    timeline,
    generatedAt: retrievedAt
  });
}
__name(extractPopulation, "extractPopulation");
function findXmlParagraph(xml, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(new RegExp(`<Paragraph\\b[^>]*>(?:(?!<\\/Paragraph>)[\\s\\S])*?<Text>(${escaped}[^<]*)<\\/Text>(?:(?!<\\/Paragraph>)[\\s\\S])*?<\\/Paragraph>`, "i"));
  const phraseMatches = xml.match(new RegExp(`<Text>${escaped}`, "gi")) ?? [];
  if (phraseMatches.length > 1) return { text: "", ambiguous: true };
  if (!match || match.index === void 0) return null;
  const sectionStart = xml.lastIndexOf("<Section", match.index);
  const sectionSlice = xml.slice(sectionStart, match.index);
  const section = sectionSlice.match(/<Label>([^<]+)<\/Label>/i)?.[1];
  const paragraphStart = xml.lastIndexOf("<Paragraph", match.index);
  const paragraphBody = xml.slice(paragraphStart, xml.indexOf("</Paragraph>", match.index));
  const paragraph = paragraphBody.match(/<Label>\(([^)]+)\)<\/Label>/i)?.[1];
  return { text: stripTags(match[1]), section, paragraph };
}
__name(findXmlParagraph, "findXmlParagraph");
function findYoungPersonDefinition(xml) {
  const index = xml.indexOf("<DefinedTermEn>young person</DefinedTermEn>");
  if (index < 0) return null;
  const start = xml.lastIndexOf("<Definition", index);
  const end = xml.indexOf("</Definition>", index);
  if (start < 0 || end < 0) return null;
  return stripTags(xml.slice(start, end + "</Definition>".length));
}
__name(findYoungPersonDefinition, "findYoungPersonDefinition");
async function extractLaw(question, discovery, options) {
  const retrievedAt = nowIso(options);
  const source = sourceFor(discovery, (candidate) => candidate.identifiers.instrumentType === "act" && candidate.identifiers.catalogCode === "C-24.5");
  const xmlUrl = source?.identifiers.xmlUrl;
  if (!source || !xmlUrl) throw new EvidenceExtractionError("INSUFFICIENT_EVIDENCE", "cannabis_act_xml_not_found");
  let xml;
  try {
    xml = await fetchText(xmlUrl, discoveryContext(options), { accept: "application/xml,text/xml", maxBytes: 1e6 });
  } catch (error) {
    throw new EvidenceExtractionError(error instanceof Error && "status" in error ? error.status : "SOURCE_UNAVAILABLE", error instanceof Error ? error.message : "legislation_unavailable");
  }
  const possession = findXmlParagraph(xml, "for a young person to possess cannabis of one or more classes of cannabis the total amount of which, as determined in accordance with Schedule 3, is equivalent to more than 5 g of dried cannabis;");
  const definition = findYoungPersonDefinition(xml);
  if (possession?.ambiguous) {
    const ambiguityClaim = claim({
      id: "cannabis-act-interpretation-ambiguous",
      proposition: "The current Cannabis Act XML returned more than one candidate paragraph for the requested young-person possession phrase, so Clove cannot select an interpretation safely.",
      sourceId: source.sourceId,
      sourceType: "Justice Laws official XML",
      sourceLocation: {},
      sourceFragment: "Multiple XML <Text> elements matched the requested phrase.",
      evidenceRole: "qualifies",
      extractionMethod: "deterministic_parser",
      validation: validation({ geographyMatched: true, populationMatched: true }),
      status: "INSUFFICIENT_EVIDENCE"
    }, retrievedAt);
    return makeExperience({
      status: "INSUFFICIENT_EVIDENCE",
      question,
      recipeId: discovery.recipeId,
      answer: { text: "The official source was retrieved, but its matching statutory text is ambiguous. Further legal research is required.", claimIds: [ambiguityClaim.id] },
      whyThisAnswer: "The extractor found multiple candidate paragraphs and stopped instead of inventing a section locator or choosing one silently.",
      claims: [ambiguityClaim],
      sources: discovery.candidates,
      challenge: { status: "incomplete", label: "Independent legal interpretation", detail: "Interpretation requires further research because the official XML match was ambiguous.", claimIds: [] },
      graph: graphFor(question, [ambiguityClaim.id], [ambiguityClaim], discovery.candidates),
      unknowns: ["The exact statutory provision was not selected.", "INTERPRETATION_REQUIRES_FURTHER_RESEARCH."],
      timeline: [...timelineForDiscovery(discovery), { label: "Interpretation boundary", state: "blocked", detail: "Multiple official XML matches prevented a safe section-level interpretation." }],
      generatedAt: retrievedAt,
      legal: { officialText: "The official XML contained multiple candidate matches; no single passage is promoted here.", interpretation: "INTERPRETATION_REQUIRES_FURTHER_RESEARCH", interpretationStatus: "INTERPRETATION_REQUIRES_FURTHER_RESEARCH" }
    });
  }
  if (!possession || !definition) throw new EvidenceExtractionError("INSUFFICIENT_EVIDENCE", "statutory_target_not_found");
  const possessionClaim = claim({
    id: "cannabis-act-section-8-possession",
    proposition: "Cannabis Act section 8(1)(c) prohibits a young person from possessing cannabis above the five-gram dried-cannabis equivalent threshold.",
    value: 5,
    unit: "g dried-cannabis equivalent threshold",
    geography: "Canada",
    population: "young person as defined for section 8",
    sourceId: source.sourceId,
    sourceType: "Justice Laws official XML",
    sourceLocation: { section: possession.section ? `Section ${possession.section}` : void 0, paragraph: possession.paragraph, statuteSection: possession.section && possession.paragraph ? `${possession.section}(1)(${possession.paragraph})` : void 0 },
    sourceFragment: possession.text,
    evidenceRole: "supports",
    extractionMethod: "deterministic_parser",
    validation: validation({ geographyMatched: true, unitMatched: true, populationMatched: true }),
    status: "ESTABLISHED"
  }, retrievedAt);
  const definitionClaim = claim({
    id: "cannabis-act-young-person-definition",
    proposition: "For sections 8, 9, and 12, the Cannabis Act defines a young person as an individual who is 12 years of age or older but under 18 years of age.",
    geography: "Canada",
    population: "young person",
    sourceId: source.sourceId,
    sourceType: "Justice Laws official XML",
    sourceLocation: { section: "Interpretation", statuteSection: "section 2" },
    sourceFragment: definition,
    evidenceRole: "context",
    extractionMethod: "deterministic_parser",
    validation: validation({ geographyMatched: true, populationMatched: true }),
    status: "ESTABLISHED"
  }, retrievedAt);
  const interpretationClaim = claim({
    id: "clove-interpretation-cannabis-possession",
    proposition: "Clove\u2019s bounded textual reading is that the federal statute governs this question through the Cannabis Act, section 8(1)(c), with the defined age category and threshold above.",
    geography: "Canada",
    population: "young person",
    sourceId: source.sourceId,
    sourceType: "Clove interpretation",
    sourceLocation: { statuteSection: "2 and 8(1)(c)" },
    evidenceRole: "qualifies",
    extractionMethod: "deterministic_parser",
    validation: validation({ geographyMatched: true, periodMatched: true, populationMatched: true }),
    status: "QUALIFIED"
  }, retrievedAt);
  const claims = [possessionClaim, definitionClaim, interpretationClaim];
  const answer = "The federal source is the Cannabis Act. Its section 8(1)(c) text prohibits a defined \u201Cyoung person\u201D from possessing cannabis above the equivalent of 5 g of dried cannabis. This is a source-grounded textual summary, not legal advice.";
  return makeExperience({
    status: "QUALIFIED",
    question,
    recipeId: discovery.recipeId,
    answer: { text: answer, claimIds: claims.map((item) => item.id) },
    whyThisAnswer: "The official text and Clove\u2019s interpretation are deliberately separate. The extractor found the exact provision and the definition it relies on in the current consolidated XML.",
    claims,
    sources: discovery.candidates,
    challenge: { status: "not_available", label: "Independent legal interpretation", detail: "No case-law or secondary interpretation was added; the result stays within the official statute.", claimIds: [] },
    graph: graphFor(question, claims.map((item) => item.id), claims, discovery.candidates),
    unknowns: ["Provincial or territorial age-of-sale rules were not researched.", "Case-law interpretation and application were not researched.", "This result should not be treated as individualized legal advice."],
    timeline: [
      ...timelineForDiscovery(discovery),
      { label: "Retrieved current consolidated XML", state: "complete", detail: `${source.identifiers.xmlUrl}` },
      { label: "Matched statutory provision", state: "complete", detail: "Found section 8(1)(c) and the section 2 young-person definition." },
      { label: "Separated text from interpretation", state: "complete", detail: "The UI will render official text and Clove\u2019s reading in different panels." }
    ],
    generatedAt: retrievedAt,
    legal: {
      officialText: `${possession.text}

${definition}`,
      interpretation: "The federal statute\u2019s text establishes the threshold and defined age category shown above. This is a bounded textual reading, not legal advice.",
      interpretationStatus: "bounded_textual_reading"
    }
  });
}
__name(extractLaw, "extractLaw");
async function extractScience(question, discovery, options) {
  const retrievedAt = nowIso(options);
  const claims = [];
  let abstractCount = 0;
  for (const source of discovery.candidates.slice(0, 4)) {
    if (!source.doi) continue;
    let work = {};
    try {
      work = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(source.doi)}`, discoveryContext(options), { maxBytes: 512 * 1024 });
    } catch {
    }
    const abstract = work.message?.abstract ? stripTags(work.message.abstract) : void 0;
    if (abstract) abstractCount += 1;
    claims.push(claim({
      id: `crossref-${source.doi.replace(/[^a-z0-9]+/gi, "-")}`,
      proposition: abstract ? `The Crossref record for \u201C${source.title}\u201D exposes an abstract; the abstract is evidence material but has not been independently synthesized into a general conclusion.` : `Crossref metadata identifies \u201C${source.title}\u201D as a potentially relevant work; metadata alone does not establish what the study found.`,
      sourceId: source.sourceId,
      sourceType: abstract ? "Crossref abstract" : "Crossref bibliographic metadata",
      sourceLocation: { section: abstract ? "abstract" : "work metadata" },
      sourceFragment: abstract ? abstract.slice(0, 2e3) : `DOI: ${source.doi}; title: ${source.title}; published: ${source.publishedAt ?? "not reported"}; type: ${source.identifiers.workType ?? "not reported"}`,
      evidenceRole: "metadata_only",
      extractionMethod: "deterministic_parser",
      validation: validation(),
      status: abstract ? "QUALIFIED" : "METADATA_ONLY"
    }, retrievedAt));
  }
  if (claims.length === 0) {
    return makeExperience({
      status: "INSUFFICIENT_EVIDENCE",
      question,
      recipeId: discovery.recipeId,
      answer: { text: "Crossref discovery returned no work record that can support a scientific claim. Further research is required.", claimIds: [] },
      whyThisAnswer: "No bibliographic record was available to retrieve, so Clove does not assert a scientific result.",
      claims: [],
      sources: discovery.candidates,
      challenge: { status: "incomplete", label: "Independent scientific challenge", detail: "There is no candidate work to challenge.", claimIds: [] },
      graph: graphFor(question, [], [], discovery.candidates),
      unknowns: ["No candidate study metadata was retrieved.", "The scientific answer is research-required."],
      timeline: [...timelineForDiscovery(discovery), { label: "Result extraction", state: "blocked", detail: "No work record was available." }],
      generatedAt: retrievedAt,
      science: { evidenceLevel: "INSUFFICIENT_EVIDENCE", worksFound: 0 }
    });
  }
  const evidenceLevel = abstractCount > 0 ? "ABSTRACT_EVIDENCE" : claims.length > 0 ? "METADATA_ONLY" : "INSUFFICIENT_EVIDENCE";
  const finalClaim = claim({
    id: "science-result-not-established",
    proposition: claims.length > 0 ? `Clove found ${claims.length} potentially relevant scholarly work(s), but the available source material does not establish whether creatine supplementation improves cognitive performance in healthy adults.` : "Clove did not retrieve enough source material to establish the scientific finding.",
    sourceId: claims[0].sourceId,
    sourceType: "Clove evidence boundary",
    sourceLocation: { section: "synthesis boundary" },
    evidenceRole: "qualifies",
    extractionMethod: "deterministic_parser",
    validation: validation(),
    status: "INSUFFICIENT_EVIDENCE"
  }, retrievedAt);
  claims.push(finalClaim);
  const status = claims.length > 1 ? "RESEARCH_REQUIRED" : "INSUFFICIENT_EVIDENCE";
  return makeExperience({
    status,
    question,
    recipeId: discovery.recipeId,
    answer: { text: finalClaim.proposition, claimIds: claims.map((item) => item.id) },
    whyThisAnswer: "Crossref is being used as a bibliographic discovery system. The metadata and any returned abstract are preserved, but no study result is promoted into a general conclusion.",
    claims,
    sources: discovery.candidates,
    challenge: { status: "incomplete", label: "Independent scientific challenge", detail: "Discovery found candidate works; result extraction and independent-study comparison remain required.", claimIds: [] },
    graph: graphFor(question, [finalClaim.id], claims, discovery.candidates),
    unknowns: ["Sample sizes, effect sizes, confidence intervals, corrections, and replication were not extracted from full study material.", "A metadata record does not establish the direction or size of an effect.", "The scientific answer remains research-required."],
    timeline: [
      ...timelineForDiscovery(discovery),
      { label: "Retrieved Crossref work metadata", state: claims.length > 1 ? "complete" : "partial", detail: `${claims.length - 1} candidate work record(s) inspected.` },
      { label: "Result extraction", state: "blocked", detail: evidenceLevel === "METADATA_ONLY" ? "No abstract or full-text result was available in the bounded source material." : "Abstract evidence requires further study-level validation." },
      { label: "Synthesis", state: "complete", detail: "Stopped at RESEARCH_REQUIRED rather than manufacturing a yes/no answer." }
    ],
    generatedAt: retrievedAt,
    science: { evidenceLevel, worksFound: discovery.candidates.length }
  });
}
__name(extractScience, "extractScience");
function claimFromDatum(item, source, retrievedAt) {
  return claim({
    id: item.id,
    proposition: `${item.label}: ${item.value} ${item.unit} for ${item.period}.`,
    value: item.value,
    unit: item.unit,
    geography: "Canada",
    measurementPeriod: item.period,
    sourceId: source.sourceId,
    sourceType: source.institution ?? "official source",
    sourceLocation: { section: item.locator },
    sourceFragment: item.exactQuote,
    evidenceRole: "supports",
    extractionMethod: item.method === "calculated" ? "structured_data" : "deterministic_parser",
    validation: validation({ geographyMatched: true, periodMatched: item.period === "2024", unitMatched: true }),
    status: "ESTABLISHED"
  }, retrievedAt);
}
__name(claimFromDatum, "claimFromDatum");
function completeElectricityClaim(strongest, generatedAt) {
  const sourceId = strongest.sourceId;
  return claim({
    id: strongest.id,
    proposition: `Nuclear power supplied approximately ${strongest.value.toFixed(1)}% of Canada\u2019s electricity generation in ${strongest.period}.`,
    value: strongest.value,
    unit: "%",
    geography: "Canada",
    measurementPeriod: strongest.period,
    sourceId,
    sourceType: "Statistics Canada calculation",
    sourceLocation: { section: strongest.locator },
    sourceFragment: strongest.exactQuote,
    evidenceRole: "supports",
    extractionMethod: "structured_data",
    validation: validation({ geographyMatched: true, periodMatched: true, unitMatched: true }),
    status: "ESTABLISHED",
    calculation: { operands: strongest.supports, formula: strongest.exactQuote }
  }, generatedAt);
}
__name(completeElectricityClaim, "completeElectricityClaim");
function fromInvestigation(investigation) {
  const generatedAt = investigation.generatedAt;
  const sources = sourceFromInvestigation(investigation);
  const sourceById = new Map(sources.map((source) => [source.sourceId, source]));
  const claims = [];
  const total = investigation.evidence.find((item) => item.id === "statcan-total-generation-2024");
  const nuclear = investigation.evidence.find((item) => item.id === "statcan-nuclear-generation-2024");
  const strongest = investigation.strongestDatapoint;
  const totalSource = sourceById.get(total?.sourceId ?? "") ?? sources[0];
  const nuclearSource = sourceById.get(nuclear?.sourceId ?? "") ?? sources[0];
  if (total && totalSource) claims.push(claimFromDatum(total, totalSource, generatedAt));
  if (nuclear && nuclearSource) claims.push(claimFromDatum(nuclear, nuclearSource, generatedAt));
  const calculated = completeElectricityClaim(strongest, generatedAt);
  claims.push(calculated);
  for (const contradiction of investigation.contradictions) {
    const datum = investigation.evidence.find((item) => item.sourceId === contradiction.challengerSourceId && item.value === contradiction.challengerValue);
    const source = sourceById.get(contradiction.challengerSourceId) ?? sources[0];
    if (!datum || !source) continue;
    claims.push(claim({
      id: contradiction.id,
      proposition: `The challenger reports ${contradiction.challengerValue}% for ${contradiction.challengerPeriod}.`,
      value: contradiction.challengerValue,
      unit: "%",
      geography: "Canada",
      measurementPeriod: contradiction.challengerPeriod,
      sourceId: contradiction.challengerSourceId,
      sourceType: source.institution ?? "challenger source",
      sourceLocation: { section: datum.locator },
      sourceFragment: datum.exactQuote,
      evidenceRole: "qualifies",
      extractionMethod: "deterministic_parser",
      validation: validation({ geographyMatched: true, periodMatched: false, unitMatched: true }),
      status: contradiction.status === "unresolved" ? "CONTESTED" : "QUALIFIED"
    }, generatedAt));
  }
  const answerClaimIds = [calculated.id, ...claims.filter((item) => item.evidenceRole === "qualifies").map((item) => item.id)];
  const status = investigation.unresolvedDisagreements.length > 0 ? "CONTESTED" : investigation.contradictions.length > 0 ? "QUALIFIED" : "ESTABLISHED";
  return makeExperience({
    status,
    question: investigation.spec.question,
    recipeId: investigation.sourceRecipe.recipe.id,
    answer: { text: investigation.answer.text, claimIds: answerClaimIds },
    whyThisAnswer: "The answer is calculated from two exact Statistics Canada datapoints. The independent challenger was executed and retained as a period-qualified comparison rather than silently treated as same-year corroboration.",
    strongestDatapoint: calculated,
    claims,
    sources,
    challenge: { status: investigation.independentSourceCheck.status === "pass" ? "executed" : "incomplete", label: "Canada Energy Regulator challenger", detail: investigation.independentSourceCheck.explanation, claimIds: claims.filter((item) => item.evidenceRole === "qualifies").map((item) => item.id) },
    graph: graphFor(investigation.spec.question, answerClaimIds, claims, sources),
    unknowns: [
      ...investigation.contradictions.map((item) => item.explanation),
      ...investigation.unresolvedDisagreements.length > 0 ? ["A same-period disagreement remains unresolved."] : []
    ],
    timeline: [
      { label: "Classified as official Canadian statistic", state: "complete", detail: "Existing electricity research specification matched." },
      { label: "Looking for primary sources", state: "complete", detail: `${investigation.sources.length} source records were retrieved and ranked.` },
      { label: "Retrieved Statistics Canada data", state: "complete", detail: "Total and nuclear generation datapoints were parsed from the official page." },
      { label: "Matched Canada / annual period", state: "complete", detail: "2024 national generation was used for the calculation." },
      { label: "Challenging the leading result", state: investigation.independentSourceCheck.status === "pass" ? "complete" : "partial", detail: investigation.independentSourceCheck.explanation },
      { label: "Synthesized supported answer", state: "complete", detail: status }
    ],
    generatedAt
  });
}
__name(fromInvestigation, "fromInvestigation");
async function runResearchExperience(question, options = {}) {
  if (researchSpecFor(question)) {
    const investigation = await investigate(question, {
      fetcher: options.fetcher,
      now: options.now
    });
    return fromInvestigation(investigation);
  }
  const discovery = await discoverQuestion(question, discoveryContext(options));
  if (discovery.status === "RECIPE_NOT_FOUND") throw new EvidenceExtractionError("INSUFFICIENT_EVIDENCE", "RECIPE_NOT_FOUND");
  if (discovery.status === "SOURCE_UNAVAILABLE" || discovery.status === "RATE_LIMITED") {
    throw new EvidenceExtractionError(discovery.status, discovery.errors[0] ?? discovery.status);
  }
  if (discovery.recipeId === "official_canadian_statistic") return extractPopulation(question, discovery, options);
  if (discovery.recipeId === "canadian_law") return extractLaw(question, discovery, options);
  if (discovery.recipeId === "scientific_finding") return extractScience(question, discovery, options);
  throw new EvidenceExtractionError("INSUFFICIENT_EVIDENCE", "unsupported_extraction_recipe");
}
__name(runResearchExperience, "runResearchExperience");
function isEvidenceExtractionError(error) {
  return error instanceof EvidenceExtractionError;
}
__name(isEvidenceExtractionError, "isEvidenceExtractionError");
function experienceErrorStatus(error) {
  if (error.code === "RATE_LIMITED") return "RATE_LIMITED";
  if (error.code === "SOURCE_UNAVAILABLE") return "SOURCE_UNAVAILABLE";
  return "INSUFFICIENT_EVIDENCE";
}
__name(experienceErrorStatus, "experienceErrorStatus");

// src/index.ts
var MAX_BODY_BYTES = 16384;
var JSON_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
});
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
__name(json, "json");
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
__name(isRecord, "isRecord");
async function readSmallJson(request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) throw new Error("body_too_large");
  if (!request.body) throw new Error("invalid_body");
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
__name(readSmallJson, "readSmallJson");
async function handleResearchRequest(request, env, dependencies = {}) {
  const pathname = new URL(request.url).pathname;
  const isResearchRoute = pathname === "/research" || pathname === "/research/";
  const isDiscoveryRoute = pathname === "/research/discover" || pathname === "/research/discover/";
  const isChallengeRoute = pathname === "/research/challenge" || pathname === "/research/challenge/";
  const isResearchAssetRoute = pathname.startsWith("/research/") && !isDiscoveryRoute && !isChallengeRoute;
  if (!isResearchRoute && !isDiscoveryRoute && !isChallengeRoute && !isResearchAssetRoute) return json({ ok: false, code: "not_found" }, 404);
  if (request.method === "GET" && (isResearchRoute || isResearchAssetRoute)) {
    if (!env.ASSETS) return json({ ok: false, code: "research_ui_not_configured" }, 503);
    const assetUrl = new URL(request.url);
    assetUrl.pathname = isResearchRoute ? "/" : pathname.slice("/research".length);
    return env.ASSETS.fetch(new Request(assetUrl, request));
  }
  if (request.method !== "POST") return json({ ok: false, code: "method_not_allowed" }, 405);
  if ((request.headers.get("content-type") || "").toLowerCase().startsWith("application/json") === false) {
    return json({ ok: false, code: "content_type_required" }, 415);
  }
  try {
    const body = await readSmallJson(request);
    if (!isRecord(body) || typeof body.question !== "string" || body.question.trim().length === 0) {
      return json({ ok: false, code: "question_required" }, 400);
    }
    const selection = selectSourceRecipe(body.question);
    if (!selection) return json({ ok: false, code: "RECIPE_NOT_FOUND" }, 422);
    if (isDiscoveryRoute) {
      const discovery = await discoverQuestion(body.question, {
        fetcher: dependencies.fetcher,
        now: dependencies.now?.()
      });
      if (discovery.status === "RECIPE_NOT_FOUND") return json({ ok: false, code: "RECIPE_NOT_FOUND" }, 422);
      return json({ ok: true, status: discovery.status, discovery });
    }
    if (isChallengeRoute || body.mode === "investigate") {
      const research = await runResearchExperience(body.question, {
        fetcher: dependencies.fetcher,
        now: dependencies.now?.()
      });
      if (isChallengeRoute) {
        return json({ ok: true, status: "challenge_executed", challenge: research.challenge, claims: research.claims });
      }
      return json({ ok: true, status: "research_complete", research });
    }
    if (!researchSpecFor(body.question)) {
      return json({
        ok: true,
        status: "recipe_selected",
        researchPlan: buildResearchPlan(body.question, selection)
      });
    }
    const investigation = await investigate(body.question, {
      fetcher: dependencies.fetcher,
      now: dependencies.now?.()
    });
    return json({ ok: true, investigation });
  } catch (error) {
    if (isEvidenceExtractionError(error)) {
      return json({
        ok: true,
        status: experienceErrorStatus(error),
        code: error.message,
        error: error.message
      });
    }
    if (error instanceof UnsupportedQuestionError) {
      return json({
        ok: false,
        code: "unsupported_question",
        supported_questions: [CANADA_NUCLEAR_QUESTION]
      }, 422);
    }
    if (error instanceof ResearchSourceError) {
      return json({ ok: false, code: error.message }, 502);
    }
    const code = error instanceof Error ? error.message : "research_failed";
    if (code === "body_too_large") return json({ ok: false, code }, 413);
    if (code === "invalid_body" || code === "Unexpected end of JSON input") {
      return json({ ok: false, code: "invalid_body" }, 400);
    }
    console.error(JSON.stringify({ code }));
    return json({ ok: false, code: "research_failed" }, 500);
  }
}
__name(handleResearchRequest, "handleResearchRequest");
var index_default = {
  async fetch(request, env) {
    return handleResearchRequest(request, env);
  }
};
export {
  index_default as default,
  handleResearchRequest
};
//# sourceMappingURL=index.js.map
