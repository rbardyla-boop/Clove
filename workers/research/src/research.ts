import { selectSourceRecipe, type SourceRecipeSelection } from './source-recipes';

export const CANADA_NUCLEAR_QUESTION =
  "What percentage of Canada's electricity generation came from nuclear power in the latest complete year?";

const TARGET_YEAR = 2024;
const MAX_SOURCE_BYTES = 512_000;
const SOURCE_FETCH_TIMEOUT_MS = 8_000;
const PERCENT_TOLERANCE = 0.1;

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
export type EvidenceUnit = 'percent' | 'million_mwh';
export type EvidenceMethod = 'reported' | 'calculated';

export interface ResearchSpec {
  question: string;
  canonicalQuestion: string;
  claim: string;
  geography: 'Canada';
  metric: 'electricity_generation_share';
  target: 'nuclear_power';
  targetYear: number;
  recipeId: 'official_canadian_statistic';
  distinctionChecks: string[];
  sourceIds: string[];
}

export interface EvidenceDatum {
  id: string;
  sourceId: string;
  label: string;
  value: number;
  unit: EvidenceUnit;
  period: string;
  method: EvidenceMethod;
  exactQuote: string;
  locator: string;
  supports: string[];
}

export interface SourceDefinition {
  id: string;
  title: string;
  publisher: string;
  url: string;
  authorityScore: number;
  role: 'primary' | 'corroborator' | 'challenger';
  parse: (body: string) => EvidenceDatum[];
}

export interface SourceResult extends SourceDefinition {
  rank: number;
  status: 'available' | 'unavailable';
  evidence: EvidenceDatum[];
  error?: string;
}

export type ContradictionStatus = 'period_mismatch' | 'unresolved';

export interface Contradiction {
  id: string;
  challengerSourceId: string;
  primaryValue: number;
  challengerValue: number;
  primaryPeriod: string;
  challengerPeriod: string;
  status: ContradictionStatus;
  explanation: string;
}

export interface EvidenceGraphNode {
  id: string;
  type: 'question' | 'specification' | 'source' | 'datapoint' | 'answer' | 'contradiction';
  label: string;
}

export interface EvidenceGraphEdge {
  from: string;
  to: string;
  relation: 'specifies' | 'publishes' | 'supports' | 'calculates' | 'challenges' | 'qualifies';
}

export interface EvidenceGraph {
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
  mermaid: string;
}

export interface Investigation {
  status: 'supported' | 'needs_review';
  sourceRecipe: SourceRecipeSelection;
  spec: ResearchSpec;
  answer: {
    text: string;
    claims: Array<{ id: string; text: string; evidenceIds: string[] }>;
  };
  strongestDatapoint: EvidenceDatum;
  sources: SourceResult[];
  evidence: EvidenceDatum[];
  independentSourceCheck: {
    status: 'pass' | 'incomplete';
    sourceIds: string[];
    explanation: string;
  };
  contradictions: Contradiction[];
  unresolvedDisagreements: Contradiction[];
  evidenceGraph: EvidenceGraph;
  markdown: string;
  computePath: 'public_source_only';
  generatedAt: string;
}

export class UnsupportedQuestionError extends Error {
  constructor() {
    super('unsupported_question');
    this.name = 'UnsupportedQuestionError';
  }
}

export class ResearchSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResearchSourceError';
  }
}

function normalizeQuestion(question: string): string {
  return question
    .replace(/[’]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9% ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceEvidence(
  sourceId: string,
  id: string,
  label: string,
  value: number,
  unit: EvidenceUnit,
  period: string,
  method: EvidenceMethod,
  exactQuote: string,
  locator: string,
  supports: string[] = [],
): EvidenceDatum {
  return { id, sourceId, label, value, unit, period, method, exactQuote, locator, supports };
}

function visibleText(body: string): string {
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|#160|#xA0);/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&(?:#39|apos);/gi, "'")
    .replace(/&(?:quot);/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseStatCan(body: string): EvidenceDatum[] {
  const text = visibleText(body);
  const totalMatch = text.match(/Canada's total electricity generation in 2024 reached ([\d.]+) million megawatt-hours[^.]*\./i);
  const nuclearMatch = text.match(/Nuclear energy generation fell by [\d.]+% compared with the previous year to ([\d.]+) million MWh in 2024\./i);
  if (!totalMatch || !nuclearMatch) throw new Error('statcan_datapoints_not_found');

  const total = Number(totalMatch[1]);
  const nuclear = Number(nuclearMatch[1]);
  if (!Number.isFinite(total) || !Number.isFinite(nuclear) || total <= 0 || nuclear < 0) {
    throw new Error('statcan_datapoints_invalid');
  }

  return [
    sourceEvidence(
      'statcan-2024',
      'statcan-total-generation-2024',
      'Canada total electricity generation',
      total,
      'million_mwh',
      '2024',
      'reported',
      totalMatch[0],
      'The Daily > Electricity supply > opening national total',
      ['canada-nuclear-share-2024'],
    ),
    sourceEvidence(
      'statcan-2024',
      'statcan-nuclear-generation-2024',
      'Canada nuclear electricity generation',
      nuclear,
      'million_mwh',
      '2024',
      'reported',
      nuclearMatch[0],
      'The Daily > Electricity supply > nuclear generation paragraph',
      ['canada-nuclear-share-2024'],
    ),
  ];
}

function parseCer(body: string): EvidenceDatum[] {
  const match = visibleText(body).match(/Nationally, nuclear power generation made up (\d+)% of total electricity generation in 2021/i);
  if (!match) throw new Error('cer_challenger_datapoint_not_found');
  return [sourceEvidence(
    'cer-2021',
    'cer-nuclear-share-2021',
    'National nuclear share of electricity generation',
    Number(match[1]),
    'percent',
    '2021',
    'reported',
    match[0],
    'Canada Energy Future 2023 > Electricity > Nuclear',
    ['contradiction-canada-nuclear-share'],
  )];
}

export const SOURCE_CATALOG: SourceDefinition[] = [
  {
    id: 'statcan-2024',
    title: 'Electricity supply and disposition, 2024 (preliminary)',
    publisher: 'Statistics Canada',
    url: 'https://www150.statcan.gc.ca/n1/daily-quotidien/251022/dq251022c-eng.htm',
    authorityScore: 100,
    role: 'primary',
    parse: parseStatCan,
  },
  {
    id: 'cer-2021',
    title: "Canada's Energy Future 2023: Results",
    publisher: 'Canada Energy Regulator',
    url: 'https://cer-rec.gc.ca/en/data-analysis/canada-energy-future/2023/results/',
    authorityScore: 85,
    role: 'challenger',
    parse: parseCer,
  },
];

export function researchSpecFor(question: string): ResearchSpec | null {
  if (normalizeQuestion(question) !== normalizeQuestion(CANADA_NUCLEAR_QUESTION)) return null;
  return {
    question,
    canonicalQuestion: CANADA_NUCLEAR_QUESTION,
    claim: "Canada's nuclear share of total electricity generation in the latest complete year",
    geography: 'Canada',
    metric: 'electricity_generation_share',
    target: 'nuclear_power',
    targetYear: TARGET_YEAR,
    recipeId: 'official_canadian_statistic',
    distinctionChecks: [
      'generation rather than installed capacity',
      'Canada national total rather than a provincial value',
      'latest complete annual data rather than the latest month or forecast',
    ],
    sourceIds: SOURCE_CATALOG.map((source) => source.id),
  };
}

async function readBoundedText(response: Response, maxBytes = MAX_SOURCE_BYTES): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('source_body_too_large');
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

async function fetchSource(source: SourceDefinition, fetcher: Fetcher): Promise<SourceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('source_timeout'), SOURCE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetcher(source.url, {
      headers: { accept: 'text/html,application/xhtml+xml' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`source_http_${response.status}`);
    const evidence = source.parse(await readBoundedText(response));
    return { ...source, rank: 0, status: 'available', evidence };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'source_fetch_failed';
    return { ...source, rank: 0, status: 'unavailable', evidence: [], error: message };
  } finally {
    clearTimeout(timeout);
  }
}

function rankSources(results: SourceResult[]): SourceResult[] {
  return [...results]
    .sort((left, right) => right.authorityScore - left.authorityScore)
    .map((source, index) => ({ ...source, rank: index + 1 }));
}

function roundedPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

export function classifyDisagreement(
  primary: Pick<EvidenceDatum, 'value' | 'period' | 'sourceId'>,
  challenger: Pick<EvidenceDatum, 'value' | 'period' | 'sourceId'>,
): Contradiction | null {
  if (Math.abs(primary.value - challenger.value) <= PERCENT_TOLERANCE) return null;
  const periodMismatch = primary.period !== challenger.period;
  return {
    id: `contradiction-${challenger.sourceId}`,
    challengerSourceId: challenger.sourceId,
    primaryValue: primary.value,
    challengerValue: challenger.value,
    primaryPeriod: primary.period,
    challengerPeriod: challenger.period,
    status: periodMismatch ? 'period_mismatch' : 'unresolved',
    explanation: periodMismatch
      ? `The values use different periods (${primary.period} versus ${challenger.period}); this is a time-series difference, not a same-year contradiction.`
      : `Both values use ${primary.period}, but they differ beyond the ${PERCENT_TOLERANCE} percentage-point tolerance; the disagreement remains unresolved.`,
  };
}

function graphId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_');
}

function graphLabel(value: string): string {
  return value.replace(/[\[\]"()]/g, '').replace(/\n/g, ' ').slice(0, 120);
}

function buildEvidenceGraph(
  spec: ResearchSpec,
  sources: SourceResult[],
  evidence: EvidenceDatum[],
  strongest: EvidenceDatum,
  contradictions: Contradiction[],
): EvidenceGraph {
  const nodes: EvidenceGraphNode[] = [
    { id: 'question', type: 'question', label: spec.question },
    { id: 'specification', type: 'specification', label: `${spec.metric} / ${spec.targetYear}` },
    { id: graphId(strongest.id), type: 'datapoint', label: `${strongest.label}: ${strongest.value.toFixed(1)}%` },
    { id: 'answer', type: 'answer', label: `Answer: ${strongest.value.toFixed(1)}%` },
  ];
  const edges: EvidenceGraphEdge[] = [
    { from: 'question', to: 'specification', relation: 'specifies' },
    { from: graphId(strongest.id), to: 'answer', relation: 'supports' },
  ];

  for (const source of sources.filter((item) => item.status === 'available')) {
    const sourceNode = `source_${graphId(source.id)}`;
    nodes.push({ id: sourceNode, type: 'source', label: `${source.publisher}: ${source.title}` });
    edges.push({ from: 'specification', to: sourceNode, relation: 'publishes' });
    for (const item of source.evidence) {
      const evidenceNode = graphId(item.id);
      nodes.push({ id: evidenceNode, type: 'datapoint', label: `${item.label}: ${item.value} ${item.unit}` });
      edges.push({ from: sourceNode, to: evidenceNode, relation: 'supports' });
      if (item.supports.includes(strongest.id)) {
        edges.push({ from: evidenceNode, to: graphId(strongest.id), relation: 'calculates' });
      }
    }
  }
  for (const contradiction of contradictions) {
    const node = graphId(contradiction.id);
    nodes.push({ id: node, type: 'contradiction', label: `${contradiction.challengerValue}% (${contradiction.challengerPeriod})` });
    edges.push({ from: `source_${graphId(contradiction.challengerSourceId)}`, to: node, relation: 'challenges' });
    edges.push({ from: node, to: 'answer', relation: 'qualifies' });
  }

  const lines = ['graph TD'];
  for (const node of nodes) lines.push(`  ${node.id}["${graphLabel(node.label)}"]`);
  for (const edge of edges) lines.push(`  ${edge.from} -->|${edge.relation}| ${edge.to}`);
  return { nodes, edges, mermaid: lines.join('\n') };
}

function renderMarkdown(investigation: Omit<Investigation, 'markdown'>): string {
  const { spec, sourceRecipe, answer, strongestDatapoint, sources, independentSourceCheck, contradictions, evidenceGraph } = investigation;
  const sourceLines = sources
    .filter((source) => source.status === 'available')
    .map((source) => `- [${source.publisher}: ${source.title}](${source.url}) — authority rank ${source.rank}.`)
    .join('\n');
  const contradictionLines = contradictions.length === 0
    ? '- No material disagreement found.'
    : contradictions.map((item) => `- **${item.status}**: ${item.explanation} Challenger: ${item.challengerValue}% (${item.challengerPeriod}); primary: ${item.primaryValue}% (${item.primaryPeriod}).`).join('\n');
  const claimLines = answer.claims.map((claim) => `- ${claim.text} _(evidence: ${claim.evidenceIds.join(', ')})_`).join('\n');
  const quoteLines = sources
    .filter((source) => source.status === 'available')
    .flatMap((source) => source.evidence.map((item) => `> ${item.exactQuote}\n> — ${source.publisher}, ${item.locator}`))
    .join('\n\n');

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
- Distinction checks: ${spec.distinctionChecks.join('; ')}

## Source recipe

- Recipe: ${sourceRecipe.recipe.id} (${sourceRecipe.confidence} routing confidence)
- Matched signals: ${sourceRecipe.matchedSignals.join(', ')}
- Preferred access: ${sourceRecipe.recipe.preferred_access.join(', ')}
- Challenge: ${sourceRecipe.recipe.challenge.strategy}

## Supported claims

${claimLines}

## Independent-source check

**${independentSourceCheck.status}** — ${independentSourceCheck.explanation}

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

export async function investigate(
  question: string,
  options: { fetcher?: Fetcher; now?: Date; sources?: SourceDefinition[] } = {},
): Promise<Investigation> {
  const sourceRecipe = selectSourceRecipe(question);
  if (!sourceRecipe) throw new UnsupportedQuestionError();
  const spec = researchSpecFor(question);
  if (!spec) throw new UnsupportedQuestionError();

  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? new Date();
  const definitions = options.sources ?? SOURCE_CATALOG;
  const ranked = rankSources(await Promise.all(definitions.map((source) => fetchSource(source, fetcher))));
  const primary = ranked.find((source) => source.id === 'statcan-2024' && source.status === 'available');
  if (!primary) throw new ResearchSourceError('primary_source_unavailable');

  const total = primary.evidence.find((item) => item.id === 'statcan-total-generation-2024');
  const nuclear = primary.evidence.find((item) => item.id === 'statcan-nuclear-generation-2024');
  if (!total || !nuclear) throw new ResearchSourceError('primary_datapoints_incomplete');

  const share = roundedPercent((nuclear.value / total.value) * 100);
  const strongest = sourceEvidence(
    'statcan-2024',
    'canada-nuclear-share-2024',
    'Nuclear share of Canada electricity generation',
    share,
    'percent',
    String(spec.targetYear),
    'calculated',
    `${nuclear.value} / ${total.value} million MWh × 100 = ${share.toFixed(1)}%`,
    'Calculated from the two Statistics Canada national generation datapoints',
    [total.id, nuclear.id],
  );

  const evidence = [...ranked.flatMap((source) => source.evidence), strongest];
  const challenger = ranked
    .find((source) => source.id === 'cer-2021' && source.status === 'available')
    ?.evidence.find((item) => item.id === 'cer-nuclear-share-2021');
  const contradictions = challenger ? [classifyDisagreement(strongest, challenger)].filter(Boolean) as Contradiction[] : [];
  const independentChallenger = ranked.find((source) => source.id === 'cer-2021' && source.status === 'available');
  const independentSourceCheck = independentChallenger
    ? {
        status: 'pass' as const,
        sourceIds: [primary.id, independentChallenger.id],
        explanation: `The independent Canada Energy Regulator source was retrieved and compared; its ${independentChallenger.evidence[0]?.value}% figure is explicitly retained as a ${independentChallenger.evidence[0]?.period} challenger, not treated as ${spec.targetYear} corroboration.`,
      }
    : {
        status: 'incomplete' as const,
        sourceIds: [primary.id],
        explanation: 'The primary source is available, but the independent corroborator could not be retrieved.',
      };
  const unresolvedDisagreements = contradictions.filter((item) => item.status === 'unresolved');
  const answerText = unresolvedDisagreements.length > 0
    ? `The strongest matching source reports approximately ${share.toFixed(1)}% for ${spec.targetYear}, but a same-period disagreement remains unresolved.`
    : `In ${spec.targetYear}, nuclear power supplied approximately ${share.toFixed(1)}% of Canada's electricity generation (${nuclear.value} of ${total.value} million MWh).`;
  const answer = {
    text: answerText,
    claims: [{
      id: 'claim-canada-nuclear-share',
      text: answerText,
      evidenceIds: [strongest.id, total.id, nuclear.id],
    }],
  };
  const evidenceGraph = buildEvidenceGraph(spec, ranked, evidence, strongest, contradictions);
  const base = {
    status: unresolvedDisagreements.length > 0 ? 'needs_review' as const : 'supported' as const,
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
    computePath: 'public_source_only' as const,
    generatedAt: now.toISOString(),
  };
  return { ...base, markdown: renderMarkdown(base) };
}
