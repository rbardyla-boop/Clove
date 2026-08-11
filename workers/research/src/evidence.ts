import {
  discoverQuestion,
  type DiscoveryCandidate,
  type DiscoveryContext,
  type DiscoveryResult,
} from './discovery/registry';
import { fetchJson, fetchText, nowIso, stripTags } from './discovery/normalize';
import {
  investigate,
  researchSpecFor,
  type EvidenceDatum,
  type Investigation,
  type Fetcher,
} from './research';
import {
  alignmentReportFor,
  preflightAlignment,
  researchIntentFor,
  type AlignmentReport,
  type ResearchIntent,
} from './alignment';
import { selectSourceRecipe } from './source-recipes';
import {
  parseAnnualSoftwoodBoardFeet,
  parseSoftwoodBoardFeet,
  parseStatsCanLumberContext,
  STATCAN_LUMBER_CONTEXT_WDS_URL,
} from './discovery/canadian-trade';
import { BOARD_FEET_TO_CUBIC_METRES, isSupportedSoftwoodTrade, tradeSpecificationFor } from './trade';

export type EvidenceClaimStatus =
  | 'ESTABLISHED'
  | 'QUALIFIED'
  | 'CONTESTED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'METADATA_ONLY';

export type ResearchExperienceStatus = EvidenceClaimStatus | 'RESEARCH_REQUIRED' | 'SOURCE_UNAVAILABLE' | 'RATE_LIMITED';

export interface EvidenceConversion {
  fromUnit: string;
  toUnit: string;
  factor: number;
  formula: string;
  originalValue: number;
  originalUnit: string;
  convertedValue: number;
}

export interface EvidenceClaim {
  id: string;
  proposition: string;
  value?: number | string;
  unit?: string;
  geography?: string;
  population?: string;
  measurementPeriod?: string;
  sourceId: string;
  sourceType: string;
  sourceLocation: {
    section?: string;
    table?: string;
    row?: string;
    column?: string;
    paragraph?: string;
    statuteSection?: string;
    page?: number;
  };
  sourceFragment?: string;
  evidenceRole: 'supports' | 'contradicts' | 'qualifies' | 'context' | 'metadata_only';
  extractionMethod: 'structured_data' | 'deterministic_parser' | 'model_assisted';
  validation: {
    geographyMatched: boolean | 'not_applicable';
    periodMatched: boolean | 'not_applicable';
    unitMatched: boolean | 'not_applicable';
    populationMatched: boolean | 'not_applicable';
  };
  status: EvidenceClaimStatus;
  retrievedAt: string;
  calculation?: {
    operands: string[];
    formula: string;
  };
  conversion?: EvidenceConversion;
}

export interface ResearchGraphNode {
  id: string;
  type: 'question' | 'answer' | 'claim' | 'source' | 'contradiction';
  label: string;
  claimId?: string;
  sourceId?: string;
}

export interface ResearchGraphEdge {
  from: string;
  to: string;
  relation: 'asks' | 'answers' | 'supports' | 'qualifies' | 'contradicts' | 'context' | 'derived_from' | 'published_by';
}

export interface ResearchGraph {
  nodes: ResearchGraphNode[];
  edges: ResearchGraphEdge[];
}

export interface ResearchTimelineItem {
  label: string;
  state: 'complete' | 'partial' | 'blocked';
  detail: string;
}

export interface ResearchChallenge {
  status: 'executed' | 'not_available' | 'incomplete';
  label: string;
  detail: string;
  claimIds: string[];
}

export interface ObsidianExportFile {
  path: string;
  content: string;
}

export interface ObsidianExport {
  rootPath: string;
  files: ObsidianExportFile[];
}

export interface LegalPresentation {
  officialText: string;
  interpretation: string;
  interpretationStatus: 'bounded_textual_reading' | 'INTERPRETATION_REQUIRES_FURTHER_RESEARCH';
}

export interface SciencePresentation {
  evidenceLevel: 'METADATA_ONLY' | 'ABSTRACT_EVIDENCE' | 'INSUFFICIENT_EVIDENCE';
  worksFound: number;
}

export interface ResearchExperience {
  status: ResearchExperienceStatus;
  question: string;
  recipeId: string;
  answer: {
    text: string;
    claimIds: string[];
  };
  whyThisAnswer: string;
  strongestDatapoint?: EvidenceClaim;
  claims: EvidenceClaim[];
  sources: DiscoveryCandidate[];
  challenge: ResearchChallenge;
  graph: ResearchGraph;
  unknowns: string[];
  timeline: ResearchTimelineItem[];
  generatedAt: string;
  alignment?: AlignmentReport;
  legal?: LegalPresentation;
  science?: SciencePresentation;
  export: ObsidianExport;
}

export interface EvidenceResearchOptions {
  fetcher?: Fetcher;
  now?: Date;
}

class EvidenceExtractionError extends Error {
  constructor(public readonly code: 'SOURCE_UNAVAILABLE' | 'RATE_LIMITED' | 'INSUFFICIENT_EVIDENCE', message: string) {
    super(message);
    this.name = 'EvidenceExtractionError';
  }
}

function discoveryContext(options: EvidenceResearchOptions): DiscoveryContext {
  return { fetcher: options.fetcher, now: options.now };
}

function claim(
  input: Omit<EvidenceClaim, 'retrievedAt'>,
  retrievedAt: string,
): EvidenceClaim {
  return { ...input, retrievedAt };
}

function sourceFromInvestigation(investigation: Investigation): DiscoveryCandidate[] {
  return investigation.sources.map((source) => ({
    sourceId: source.id,
    sourceClass: 'official_canadian_statistic',
    title: source.title,
    url: source.url,
    authority: source.role === 'primary' ? 'primary' : 'secondary',
    institution: source.publisher,
    measurementPeriod: source.evidence[0]?.period,
    identifiers: {
      authorityScore: String(source.authorityScore),
      role: source.role,
    },
    discoveryMethod: 'proven_electricity_catalog',
    queryUsed: investigation.spec.question,
    provenance: {
      provider: source.publisher,
      retrievedAt: investigation.generatedAt,
      endpoint: source.url,
    },
  }));
}

function validation(overrides: Partial<EvidenceClaim['validation']> = {}): EvidenceClaim['validation'] {
  return {
    geographyMatched: 'not_applicable',
    periodMatched: 'not_applicable',
    unitMatched: 'not_applicable',
    populationMatched: 'not_applicable',
    ...overrides,
  };
}

function graphFor(
  question: string,
  answerClaimIds: string[],
  claims: EvidenceClaim[],
  sources: DiscoveryCandidate[],
): ResearchGraph {
  const nodes: ResearchGraphNode[] = [
    { id: 'question', type: 'question', label: question },
    { id: 'answer', type: 'answer', label: 'Best supported answer' },
  ];
  const edges: ResearchGraphEdge[] = [{ from: 'question', to: 'answer', relation: 'asks' }];
  const sourceIds = new Set<string>();
  for (const source of sources) {
    const id = `source-${source.sourceId}`;
    nodes.push({ id, type: 'source', label: source.title, sourceId: source.sourceId });
    sourceIds.add(source.sourceId);
  }
  for (const item of claims) {
    const id = `claim-${item.id}`;
    nodes.push({ id, type: item.evidenceRole === 'qualifies' || item.evidenceRole === 'contradicts' ? 'contradiction' : 'claim', label: item.proposition, claimId: item.id, sourceId: item.sourceId });
    edges.push({ from: id, to: 'answer', relation: item.evidenceRole === 'qualifies' ? 'qualifies' : item.evidenceRole === 'contradicts' ? 'contradicts' : answerClaimIds.includes(item.id) ? 'supports' : 'context' as ResearchGraphEdge['relation'] });
    if (sourceIds.has(item.sourceId)) edges.push({ from: id, to: `source-${item.sourceId}`, relation: 'published_by' });
    if (item.calculation) {
      for (const operand of item.calculation.operands) {
        const operandClaim = claims.find((candidate) => candidate.id === operand);
        if (operandClaim) edges.push({ from: id, to: `claim-${operandClaim.id}`, relation: 'derived_from' });
      }
    }
  }
  return { nodes, edges };
}

function yaml(value: string): string {
  return JSON.stringify(value);
}

function fileSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'note';
}

function claimNote(item: EvidenceClaim, recipeId: string, checked: string): string {
  const source = `Sources/${fileSlug(item.sourceId)}`;
  const validationLines = Object.entries(item.validation).map(([key, value]) => `- ${key}: ${String(value)}`).join('\n');
  const conversion = item.conversion
    ? `\n## Unit conversion\n\n- Original value: ${item.conversion.originalValue} ${item.conversion.originalUnit}\n- Factor: ${item.conversion.factor} ${item.conversion.toUnit}/${item.conversion.fromUnit}\n- Converted value: ${item.conversion.convertedValue} ${item.conversion.toUnit}\n- Formula: ${item.conversion.formula}\n`
    : '';
  return `---\ntype: claim\nstatus: ${item.status.toLowerCase()}\nchecked: ${checked}\nrecipe: ${recipeId}\nsource: "[[${source}]]"\nmeasurement_period: ${yaml(item.measurementPeriod ?? 'not_reported')}\n---\n\n# ${item.proposition}\n\n${item.value !== undefined ? `**Value:** ${item.value}${item.unit ? ` ${item.unit}` : ''}\n\n` : ''}**Evidence role:** ${item.evidenceRole}\n\n## Provenance\n\n- Source location: ${Object.values(item.sourceLocation).filter(Boolean).join(' · ') || 'source-defined'}\n- Extraction method: ${item.extractionMethod}\n- Retrieved: ${item.retrievedAt}\n\n## Validation\n\n${validationLines}\n\n## Source fragment\n\n${item.sourceFragment ? `> ${item.sourceFragment}` : 'No source fragment was available; this claim is metadata-only.'}\n${conversion}`;
}

function sourceNote(source: DiscoveryCandidate): string {
  const identifiers = Object.entries(source.identifiers).map(([key, value]) => `- ${key}: ${value}`).join('\n');
  return `---\ntype: source\nsource_id: ${yaml(source.sourceId)}\nauthority: ${source.authority}\n---\n\n# ${source.title}\n\n- URL: ${source.url}\n- Institution: ${source.institution ?? 'not reported'}\n- Discovery method: ${source.discoveryMethod}\n- Query: ${source.queryUsed}\n- Provider: ${source.provenance.provider}\n- Retrieved: ${source.provenance.retrievedAt}\n- Endpoint: ${source.provenance.endpoint}\n\n## Identifiers\n\n${identifiers || '- none reported'}\n`;
}

function buildExport(experience: Omit<ResearchExperience, 'export'>): ObsidianExport {
  const checked = experience.generatedAt.slice(0, 10);
  const files: ObsidianExportFile[] = [];
  const claimLinks = experience.claims.map((item) => `- [[Claims/${fileSlug(item.id)}|${item.proposition}]]`).join('\n');
  const sourceLinks = experience.sources.map((source) => `- [[Sources/${fileSlug(source.sourceId)}|${source.title}]]`).join('\n');
  const calculationLinks = experience.claims.filter((item) => item.calculation).map((item) => `- [[Data/${fileSlug(item.id)}|${item.calculation?.formula}]]`).join('\n');
  const contradictionLinks = experience.claims.filter((item) => item.evidenceRole === 'qualifies' || item.evidenceRole === 'contradicts').map((item) => `- [[Contradictions/${fileSlug(item.id)}|${item.proposition}]]`).join('\n');
  const root = `---\ntype: investigation\nstatus: ${experience.status.toLowerCase()}\nchecked: ${checked}\nrecipe: ${experience.recipeId}\n---\n\n# ${experience.question}\n\n## Best supported answer\n\n${experience.answer.text}\n\n## Why Clove thinks that\n\n${experience.whyThisAnswer}\n\n## Claims\n\n${claimLinks || '- None established.'}\n\n## Sources\n\n${sourceLinks || '- None discovered.'}\n\n## Contradictions and qualifications\n\n${contradictionLinks || '- None recorded.'}\n\n## Calculations\n\n${calculationLinks || '- None.'}\n\n## What Clove still does not know\n\n${experience.unknowns.map((item) => `- ${item}`).join('\n') || '- Nothing recorded.'}\n\n## Evidence graph\n\n${experience.graph.edges.map((edge) => `- ${edge.from} —${edge.relation}→ ${edge.to}`).join('\n')}\n`;
  const alignment = experience.alignment;
  const alignmentSection = alignment
    ? `## Question–evidence alignment\n\n- Status: ${alignment.status}\n- Subject: ${alignment.intent.subject}\n- Requested measure: ${alignment.intent.requestedMeasure}\n- Required concepts: ${alignment.intent.requiredConcepts.join(', ') || 'none recorded'}\n- Rejected claims: ${alignment.rejectedClaimIds.join(', ') || 'none'}\n- Decision: ${alignment.reason}\n\n`
    : '';
  const rootWithAlignment = root.replace('\n## Claims\n', `\n${alignmentSection}## Claims\n`);
  files.push({ path: 'Research/Investigation.md', content: rootWithAlignment });
  for (const item of experience.claims) {
    files.push({ path: `Research/Claims/${fileSlug(item.id)}.md`, content: claimNote(item, experience.recipeId, checked) });
    if (item.evidenceRole === 'qualifies' || item.evidenceRole === 'contradicts') {
      files.push({ path: `Research/Contradictions/${fileSlug(item.id)}.md`, content: `---\ntype: contradiction\nstatus: ${item.status.toLowerCase()}\nchecked: ${checked}\nrecipe: ${experience.recipeId}\nclaim: "${item.id}"\n---\n\n# Qualification\n\n${item.proposition}\n\n${item.sourceFragment ?? ''}\n` });
    }
    if (item.calculation) {
      files.push({ path: `Research/Data/${fileSlug(item.id)}.md`, content: `---\ntype: data\nstatus: established\nchecked: ${checked}\nrecipe: ${experience.recipeId}\nclaim: "${item.id}"\n---\n\n# Calculation\n\n${item.calculation.formula}\n\nOperands:\n${item.calculation.operands.map((operand) => `- [[Claims/${fileSlug(operand)}]]`).join('\n')}\n` });
    }
  }
  for (const source of experience.sources) files.push({ path: `Research/Sources/${fileSlug(source.sourceId)}.md`, content: sourceNote(source) });
  return { rootPath: 'Research/Investigation.md', files };
}

function makeExperience(
  input: Omit<ResearchExperience, 'export'>,
): ResearchExperience {
  return { ...input, export: buildExport(input) };
}

function alignmentRequiredExperience(
  question: string,
  intentValue: ResearchIntent,
  reason: string,
  generatedAt: string,
  alignment?: AlignmentReport,
): ResearchExperience {
  const report = alignment ?? {
    status: 'RESEARCH_REQUIRED' as const,
    intent: intentValue,
    claims: [],
    survivingClaimIds: [],
    rejectedClaimIds: [],
    reason,
  };
  const ambiguities = intentValue.ambiguities.length > 0
    ? intentValue.ambiguities
    : ['The requested measure is not covered by the currently configured bounded source paths.'];
  return makeExperience({
    status: 'RESEARCH_REQUIRED',
    question,
    recipeId: 'question_evidence_alignment_firewall',
    answer: {
      text: `Clove recognized this as a ${intentValue.subject} question, but no configured evidence path measures ${intentValue.requestedMeasure}. No answer was synthesized from a different measure. Further research is required.`,
      claimIds: [],
    },
    whyThisAnswer: `The question–evidence alignment firewall stopped the investigation before discovery or extraction could promote an inapplicable result. ${reason}`,
    claims: [],
    sources: [],
    challenge: {
      status: 'not_available',
      label: 'Question-specific challenger',
      detail: 'A source adapter for the requested measure is not configured in this bounded unit.',
      claimIds: [],
    },
    graph: graphFor(question, [], [], []),
    unknowns: [
      ...ambiguities,
      'No answer claim survived the applicability boundary.',
    ],
    timeline: [
      { label: `Detected ${intentValue.subject} intent`, state: 'complete', detail: `Requested measure: ${intentValue.requestedMeasure}.` },
      { label: 'Question–evidence alignment', state: 'blocked', detail: reason },
      { label: 'Synthesis', state: 'blocked', detail: 'Stopped with RESEARCH_REQUIRED; no substitute measure was promoted.' },
    ],
    generatedAt,
    alignment: report,
  });
}

function applyAlignment(experience: ResearchExperience, intentValue: ResearchIntent): ResearchExperience {
  const report = alignmentReportFor(intentValue, experience.claims, experience.answer.claimIds);
  if (report.status === 'RESEARCH_REQUIRED') {
    return alignmentRequiredExperience(experience.question, intentValue, report.reason, experience.generatedAt, report);
  }
  const surviving = new Set(report.survivingClaimIds);
  const claims = experience.claims.filter((item) => surviving.has(item.id));
  const answerClaimIds = experience.answer.claimIds.filter((id) => surviving.has(id));
  const strongestDatapoint = experience.strongestDatapoint && surviving.has(experience.strongestDatapoint.id)
    ? experience.strongestDatapoint
    : undefined;
  const { export: _export, ...withoutExport } = experience;
  return makeExperience({
    ...withoutExport,
    claims,
    answer: { ...experience.answer, claimIds: answerClaimIds },
    strongestDatapoint,
    graph: graphFor(experience.question, answerClaimIds, claims, experience.sources),
    alignment: report,
  });
}

function timelineForDiscovery(discovery: DiscoveryResult): ResearchTimelineItem[] {
  return [
    { label: `Classified as ${discovery.recipeId}`, state: 'complete', detail: 'The existing deterministic source recipe matched the question.' },
    { label: 'Looking for primary sources', state: 'complete', detail: `${discovery.candidates.length} normalized candidate source(s) were returned.` },
    { label: 'Discovery status', state: discovery.status === 'DISCOVERY_COMPLETE' || discovery.status === 'RESEARCH_REQUIRED' ? 'complete' : 'partial', detail: discovery.status },
  ];
}

function sourceFor(discovery: DiscoveryResult, predicate: (source: DiscoveryCandidate) => boolean): DiscoveryCandidate | undefined {
  return discovery.candidates.find(predicate) ?? discovery.candidates[0];
}

function dateIsCompleteAnnual(value: string | undefined, now: Date): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return value <= now.toISOString().slice(0, 10);
}

function populationPoint(
  source: DiscoveryCandidate,
  point: Record<string, unknown>,
  retrievedAt: string,
): EvidenceClaim | null {
  const value = Number(point.value);
  const period = typeof point.refPerRaw === 'string' ? point.refPerRaw : undefined;
  if (!Number.isFinite(value) || !period) return null;
  return claim({
    id: `statcan-population-${period.slice(0, 4)}`,
    proposition: `Canada's population was ${value.toLocaleString('en-CA')} on July 1, ${period.slice(0, 4)}.`,
    value,
    unit: 'persons',
    geography: 'Canada',
    population: 'All ages; total gender',
    measurementPeriod: period,
    sourceId: source.sourceId,
    sourceType: 'Statistics Canada Web Data Service',
    sourceLocation: {
      section: 'getDataFromCubePidCoordAndLatestNPeriods',
      table: source.identifiers.productId,
      row: 'Canada · Total - gender · All ages',
      column: period,
    },
    sourceFragment: `vectorId=${point.vectorId ?? '466668'}; refPerRaw=${period}; value=${value}; frequencyCode=${point.frequencyCode ?? 12}`,
    evidenceRole: 'supports',
    extractionMethod: 'structured_data',
    validation: validation({ geographyMatched: true, periodMatched: true, unitMatched: true, populationMatched: true }),
    status: 'ESTABLISHED',
  }, retrievedAt);
}

async function extractPopulation(question: string, discovery: DiscoveryResult, options: EvidenceResearchOptions): Promise<ResearchExperience> {
  const retrievedAt = nowIso(options);
  const source = sourceFor(discovery, (candidate) => candidate.identifiers.frequency === 'Annual' && candidate.identifiers.productId === '17100005');
  if (!source?.identifiers.productId) throw new EvidenceExtractionError('INSUFFICIENT_EVIDENCE', 'population_source_not_found');
  const endpoint = 'https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods';
  let points: Array<Record<string, unknown>>;
  try {
    const response = await fetchJson<Array<{ object?: { vectorDataPoint?: Array<Record<string, unknown>> } }>>(
      endpoint,
      discoveryContext(options),
      { method: 'POST', body: JSON.stringify([{ productId: Number(source.identifiers.productId), coordinate: '1.1.1.0.0.0.0.0.0.0', latestN: 8 }]), maxBytes: 256 * 1024 },
    );
    points = response[0]?.object?.vectorDataPoint ?? [];
  } catch (error) {
    throw new EvidenceExtractionError(error instanceof Error && 'status' in error ? (error as { status: 'SOURCE_UNAVAILABLE' | 'RATE_LIMITED' }).status : 'SOURCE_UNAVAILABLE', error instanceof Error ? error.message : 'population_data_unavailable');
  }
  const now = options.now ?? new Date();
  const selected = [...points]
    .filter((point) => typeof point.refPerRaw === 'string' && dateIsCompleteAnnual(point.refPerRaw, now) && Number(point.frequencyCode) === 12)
    .sort((left, right) => String(right.refPerRaw).localeCompare(String(left.refPerRaw)))[0];
  if (!selected) throw new EvidenceExtractionError('INSUFFICIENT_EVIDENCE', 'no_complete_annual_population_point');
  const datapoint = populationPoint(source, selected, retrievedAt);
  if (!datapoint) throw new EvidenceExtractionError('INSUFFICIENT_EVIDENCE', 'population_point_invalid');
  const answer = `The latest complete annual period found is July 1, ${datapoint.measurementPeriod?.slice(0, 4)}: Canada had ${Number(datapoint.value).toLocaleString('en-CA')} people.`;
  const claims = [datapoint];
  const timeline = [
    ...timelineForDiscovery(discovery),
    { label: 'Retrieved Statistics Canada data', state: 'complete' as const, detail: `Vector 466668 from the total-Canada, all-ages, total-gender series.` },
    { label: 'Matched Canada / annual period', state: 'complete' as const, detail: `Selected ${datapoint.measurementPeriod}; rejected newer non-complete observations if present.` },
    { label: 'Challenger', state: 'partial' as const, detail: 'No independent population challenger is configured in this bounded unit.' },
  ];
  return makeExperience({
    status: 'QUALIFIED',
    question,
    recipeId: discovery.recipeId,
    answer: { text: answer, claimIds: [datapoint.id] },
    whyThisAnswer: 'The answer is taken from the exact annual Canada / total-gender / all-ages vector record. The period is selected from the source reference period, not from the latest release timestamp alone.',
    strongestDatapoint: datapoint,
    claims,
    sources: discovery.candidates,
    challenge: { status: 'not_available', label: 'Independent population challenger', detail: 'Not configured for this bounded path.', claimIds: [] },
    graph: graphFor(question, [datapoint.id], claims, discovery.candidates),
    unknowns: ['No independent non-Statistics Canada corroboration was run for this population datapoint.', 'This extraction does not answer age-specific, provincial, or projection questions.'],
    timeline,
    generatedAt: retrievedAt,
  });
}

function tradeFragment(text: string, needle: string): string {
  const normalized = stripTags(text);
  const index = normalized.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return normalized.slice(0, 600);
  return normalized.slice(Math.max(0, index - 120), Math.min(normalized.length, index + 900));
}

async function fetchTradeText(url: string, options: EvidenceResearchOptions, message: string): Promise<string> {
  try {
    return await fetchText(url, discoveryContext(options), { maxBytes: 512 * 1024 });
  } catch (error) {
    throw new EvidenceExtractionError(
      error instanceof Error && 'status' in error ? (error as { status: 'SOURCE_UNAVAILABLE' | 'RATE_LIMITED' }).status : 'SOURCE_UNAVAILABLE',
      error instanceof Error ? error.message : message,
    );
  }
}

async function extractTrade(question: string, discovery: DiscoveryResult, options: EvidenceResearchOptions): Promise<ResearchExperience> {
  const retrievedAt = nowIso(options);
  const specification = tradeSpecificationFor(question);
  if (!isSupportedSoftwoodTrade(specification)) throw new EvidenceExtractionError('INSUFFICIENT_EVIDENCE', 'trade_specification_not_supported');

  const annual = discovery.candidates.find((source) => source.identifiers.role === 'annual_primary_measurement');
  const aggregate = discovery.candidates.find((source) => source.identifiers.role === 'monthly_aggregate');
  const monthly = discovery.candidates.filter((source) => source.identifiers.role === 'monthly_primary_measurement');
  let originalValue: number | undefined;
  let originalSource: DiscoveryCandidate | undefined;
  let originalFragment: string | undefined;
  let measurementMode: 'annual_report' | 'monthly_aggregate' | undefined;
  const unknowns: string[] = [];

  if (annual) {
    try {
      const annualText = await fetchTradeText(annual.url, options, 'gac_annual_report_unavailable');
      const parsed = parseAnnualSoftwoodBoardFeet(annualText);
      if (parsed === null) throw new EvidenceExtractionError('INSUFFICIENT_EVIDENCE', 'gac_annual_board_feet_not_found');
      originalValue = parsed;
      originalSource = annual;
      originalFragment = tradeFragment(annualText, 'board feet');
      measurementMode = 'annual_report';
    } catch (error) {
      if (!(error instanceof EvidenceExtractionError) || error.code !== 'SOURCE_UNAVAILABLE') throw error;
      unknowns.push('The canonical Global Affairs Canada annual report was unavailable during this run; the monthly-report fallback is disclosed below.');
    }
  }
  if (originalValue === undefined) {
    if (monthly.length !== 12 || !aggregate) {
      throw new EvidenceExtractionError('INSUFFICIENT_EVIDENCE', 'complete_gac_annual_or_monthly_trade_path_not_found');
    }
    const monthlyValues: Array<{ source: DiscoveryCandidate; value: number }> = [];
    for (const source of monthly) {
      const monthlyText = await fetchTradeText(source.url, options, 'gac_monthly_report_unavailable');
      const parsed = parseSoftwoodBoardFeet(monthlyText);
      if (parsed === null) throw new EvidenceExtractionError('INSUFFICIENT_EVIDENCE', `gac_monthly_board_feet_not_found:${source.measurementPeriod}`);
      monthlyValues.push({ source, value: parsed });
    }
    originalValue = monthlyValues.reduce((sum, item) => sum + item.value, 0);
    originalSource = aggregate;
    originalFragment = monthlyValues
      .map((item) => `${item.source.measurementPeriod}: ${item.value.toLocaleString('en-CA')} FBM`)
      .join('; ');
    measurementMode = 'monthly_aggregate';
    unknowns.push('This value is the sum of the twelve retrieved monthly GAC reports and may differ from a later revised annual reconciliation.');
  }
  if (originalValue === undefined || !originalSource || !originalFragment || !measurementMode) {
    throw new EvidenceExtractionError('INSUFFICIENT_EVIDENCE', 'trade_datapoint_not_available');
  }

  const convertedValue = Math.round(originalValue * BOARD_FEET_TO_CUBIC_METRES);
  const originalClaim = claim({
    id: `gac-softwood-${specification.period}-board-feet`,
    proposition: `Global Affairs Canada recorded ${originalValue.toLocaleString('en-CA')} board feet of Canadian softwood-lumber products exported to the United States in ${specification.period}.`,
    value: originalValue,
    unit: 'board feet',
    geography: 'Canada',
    population: 'Defined softwood lumber products monitored by Global Affairs Canada',
    measurementPeriod: specification.period,
    sourceId: originalSource.sourceId,
    sourceType: 'Global Affairs Canada softwood-lumber export monitoring',
    sourceLocation: { section: measurementMode === 'annual_report' ? 'Annual report' : 'Region Exports (FBM)', table: measurementMode === 'annual_report' ? 'Annual total' : '2025 monthly report aggregation' },
    sourceFragment: originalFragment,
    evidenceRole: 'supports',
    extractionMethod: 'deterministic_parser',
    validation: validation({ geographyMatched: true, periodMatched: true, unitMatched: true, populationMatched: true }),
    status: 'ESTABLISHED',
  }, retrievedAt);
  const conversionFormula = `${originalValue.toLocaleString('en-CA')} board feet × ${BOARD_FEET_TO_CUBIC_METRES} m³/board foot = ${convertedValue.toLocaleString('en-CA')} m³`;
  const convertedClaim = claim({
    id: `gac-softwood-${specification.period}-cubic-metres`,
    proposition: `Canada exported approximately ${convertedValue.toLocaleString('en-CA')} cubic metres of softwood-lumber products to the United States in ${specification.period}.`,
    value: convertedValue,
    unit: 'cubic metres',
    geography: 'Canada',
    population: 'Defined softwood lumber products monitored by Global Affairs Canada',
    measurementPeriod: specification.period,
    sourceId: originalSource.sourceId,
    sourceType: 'Clove deterministic unit conversion from Global Affairs Canada data',
    sourceLocation: originalClaim.sourceLocation,
    sourceFragment: conversionFormula,
    evidenceRole: 'supports',
    extractionMethod: 'deterministic_parser',
    validation: validation({ geographyMatched: true, periodMatched: true, unitMatched: true, populationMatched: true }),
    status: 'ESTABLISHED',
    calculation: { operands: [originalClaim.id], formula: conversionFormula },
    conversion: {
      fromUnit: 'board feet',
      toUnit: 'cubic metres',
      factor: BOARD_FEET_TO_CUBIC_METRES,
      formula: conversionFormula,
      originalValue,
      originalUnit: 'board feet',
      convertedValue,
    },
  }, retrievedAt);
  const claims: EvidenceClaim[] = [originalClaim, convertedClaim];

  const scopeSource = discovery.candidates.find((source) => source.identifiers.role === 'scope_definition');
  if (scopeSource) {
    try {
      const scopeText = await fetchTradeText(scopeSource.url, options, 'gac_scope_definition_unavailable');
      const scopeFragment = tradeFragment(scopeText, 'softwood lumber');
      if (scopeFragment) claims.push(claim({
        id: 'gac-softwood-scope-definition',
        proposition: 'Global Affairs Canada’s monitoring path covers a defined category of softwood lumber products exported to the United States; it is not a claim about every product made from softwood.',
        geography: 'Canada',
        population: 'Defined softwood lumber products',
        sourceId: scopeSource.sourceId,
        sourceType: 'Global Affairs Canada H-1 commodity-scope definition',
        sourceLocation: { section: 'H-1 monitoring scope' },
        sourceFragment: scopeFragment,
        evidenceRole: 'qualifies',
        extractionMethod: 'deterministic_parser',
        validation: validation({ geographyMatched: true, populationMatched: true }),
        status: 'QUALIFIED',
      }, retrievedAt));
    } catch {
      unknowns.push('The Global Affairs Canada product-scope page was not retrieved during this run.');
    }
  }

  const contextSource = discovery.candidates.find((source) => source.identifiers.role === 'broader_context');
  if (contextSource) {
    try {
      let contextValue: number | null = null;
      let contextFragment = '';
      try {
        const response = await fetchJson<Array<{ object?: { vectorDataPoint?: Array<{ value?: number | string; refPerRaw?: string; vectorId?: number | string }> } }>>(
          contextSource.identifiers.dataEndpoint ?? STATCAN_LUMBER_CONTEXT_WDS_URL,
          discoveryContext(options),
          { maxBytes: 128 * 1024 },
        );
        const point = response[0]?.object?.vectorDataPoint?.find((item) => item.refPerRaw?.startsWith(specification.period));
        const value = Number(point?.value);
        if (Number.isFinite(value)) {
          contextValue = value;
          contextFragment = `vectorId=${point?.vectorId ?? contextSource.identifiers.vectorId}; refPerRaw=${point?.refPerRaw ?? specification.period}-01-01; value=${value}; unit=thousand cubic metres`;
        }
      } catch {
        const contextText = await fetchTradeText(contextSource.url, options, 'statcan_lumber_context_unavailable');
        contextValue = parseStatsCanLumberContext(contextText);
        contextFragment = tradeFragment(contextText, specification.period);
      }
      if (contextValue !== null) claims.push(claim({
        id: 'statcan-lumber-context-2025',
        proposition: `Statistics Canada reports ${contextValue.toLocaleString('en-CA')} thousand cubic metres of total Canadian lumber exports in ${specification.period}; the table covers all destinations and includes softwood and hardwood.`,
        value: contextValue,
        unit: 'thousand cubic metres',
        geography: 'Canada',
        population: 'Total lumber exports; softwood and hardwood; all destinations',
        measurementPeriod: specification.period,
        sourceId: contextSource.sourceId,
        sourceType: 'Statistics Canada official trade table',
        sourceLocation: { table: '1610001801', row: 'Total lumber exports', column: specification.period },
        sourceFragment: contextFragment,
        evidenceRole: 'context',
        extractionMethod: 'deterministic_parser',
        validation: validation({ geographyMatched: true, periodMatched: true, unitMatched: true }),
        status: 'QUALIFIED',
      }, retrievedAt));
    } catch {
      unknowns.push('The Statistics Canada broader-context table was not retrieved during this run.');
    }
  }

  const scopeClaim = claims.find((item) => item.evidenceRole === 'qualifies');
  const contextClaim = claims.find((item) => item.evidenceRole === 'context');
  const answerClaimIds = [convertedClaim.id, ...(scopeClaim ? [scopeClaim.id] : [])];
  const answer = measurementMode === 'annual_report'
    ? `Canada exported approximately ${convertedValue.toLocaleString('en-CA')} cubic metres of softwood-lumber products to the United States in ${specification.period}. The source value is ${originalValue.toLocaleString('en-CA')} board feet; Clove converted it using ${BOARD_FEET_TO_CUBIC_METRES} cubic metres per board foot.`
    : `The retrieved Global Affairs Canada monthly reports sum to approximately ${convertedValue.toLocaleString('en-CA')} cubic metres of defined softwood-lumber products exported from Canada to the United States in ${specification.period}. The source total is ${originalValue.toLocaleString('en-CA')} board feet; a later annual reconciliation may differ.`;
  return makeExperience({
    status: 'QUALIFIED',
    question,
    recipeId: discovery.recipeId,
    answer: { text: answer, claimIds: answerClaimIds },
    whyThisAnswer: `The trade recipe matched commodity, export direction, United States partner, calendar year, and requested physical unit. The original board-foot datapoint remains unchanged and the converted value is a linked derived claim. ${contextClaim ? 'The Statistics Canada figure is retained as broader all-destination context, not labeled a contradiction.' : ''}`,
    strongestDatapoint: convertedClaim,
    claims,
    sources: discovery.candidates,
    challenge: contextClaim
      ? { status: 'executed', label: 'Statistics Canada broader trade context', detail: 'The comparison covers total Canadian lumber exports to all destinations, including softwood and hardwood. It does not measure the same partner-specific softwood proposition and is retained as context rather than contradiction.', claimIds: [contextClaim.id] }
      : { status: 'incomplete', label: 'Statistics Canada broader trade context', detail: 'The broader context source was discovered but its value was not extracted in this run.', claimIds: [] },
    graph: graphFor(question, answerClaimIds, claims, discovery.candidates),
    unknowns: [
      ...unknowns,
      'The GAC category is defined softwood-lumber products, not every conceivable softwood-derived product.',
      'The Statistics Canada context table is all destinations and includes softwood and hardwood; it cannot independently corroborate the partner-specific softwood total.',
    ],
    timeline: [
      ...timelineForDiscovery(discovery),
      { label: 'Matched Canadian trade dimensions', state: 'complete', detail: `${specification.commodity}; ${specification.direction}; ${specification.partner}; ${specification.period}; ${specification.requestedUnit}.` },
      { label: 'Preserved original datapoint', state: 'complete', detail: `${originalValue.toLocaleString('en-CA')} board feet from the ${measurementMode === 'annual_report' ? 'annual report' : 'twelve monthly reports'}.` },
      { label: 'Converted requested unit', state: 'complete', detail: conversionFormula },
      { label: 'Challenger/context', state: contextClaim ? 'complete' : 'partial', detail: contextClaim ? 'Broader all-destination lumber context retained without false contradiction.' : 'No extracted broader context value.' },
      { label: 'Synthesized supported answer', state: 'complete', detail: 'The answer is bounded to the GAC product definition and visible conversion.' },
    ],
    generatedAt: retrievedAt,
  });
}

function findXmlParagraph(xml: string, phrase: string): { text: string; section?: string; paragraph?: string; ambiguous?: boolean } | null {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`<Paragraph\\b[^>]*>(?:(?!<\\/Paragraph>)[\\s\\S])*?<Text>(${escaped}[^<]*)<\\/Text>(?:(?!<\\/Paragraph>)[\\s\\S])*?<\\/Paragraph>`, 'i'));
  const phraseMatches = xml.match(new RegExp(`<Text>${escaped}`, 'gi')) ?? [];
  if (phraseMatches.length > 1) return { text: '', ambiguous: true };
  if (!match || match.index === undefined) return null;
  const sectionStart = xml.lastIndexOf('<Section', match.index);
  const sectionSlice = xml.slice(sectionStart, match.index);
  const section = sectionSlice.match(/<Label>([^<]+)<\/Label>/i)?.[1];
  const paragraphStart = xml.lastIndexOf('<Paragraph', match.index);
  const paragraphBody = xml.slice(paragraphStart, xml.indexOf('</Paragraph>', match.index));
  const paragraph = paragraphBody.match(/<Label>\(([^)]+)\)<\/Label>/i)?.[1];
  return { text: stripTags(match[1]), section, paragraph };
}

function findYoungPersonDefinition(xml: string): string | null {
  const index = xml.indexOf('<DefinedTermEn>young person</DefinedTermEn>');
  if (index < 0) return null;
  const start = xml.lastIndexOf('<Definition', index);
  const end = xml.indexOf('</Definition>', index);
  if (start < 0 || end < 0) return null;
  return stripTags(xml.slice(start, end + '</Definition>'.length));
}

async function extractLaw(question: string, discovery: DiscoveryResult, options: EvidenceResearchOptions): Promise<ResearchExperience> {
  const retrievedAt = nowIso(options);
  const source = sourceFor(discovery, (candidate) => candidate.identifiers.instrumentType === 'act' && candidate.identifiers.catalogCode === 'C-24.5');
  const xmlUrl = source?.identifiers.xmlUrl;
  if (!source || !xmlUrl) throw new EvidenceExtractionError('INSUFFICIENT_EVIDENCE', 'cannabis_act_xml_not_found');
  let xml: string;
  try {
    xml = await fetchText(xmlUrl, discoveryContext(options), { accept: 'application/xml,text/xml', maxBytes: 1_000_000 });
  } catch (error) {
    throw new EvidenceExtractionError(error instanceof Error && 'status' in error ? (error as { status: 'SOURCE_UNAVAILABLE' | 'RATE_LIMITED' }).status : 'SOURCE_UNAVAILABLE', error instanceof Error ? error.message : 'legislation_unavailable');
  }
  const possession = findXmlParagraph(xml, 'for a young person to possess cannabis of one or more classes of cannabis the total amount of which, as determined in accordance with Schedule 3, is equivalent to more than 5 g of dried cannabis;');
  const definition = findYoungPersonDefinition(xml);
  if (possession?.ambiguous) {
    const ambiguityClaim = claim({
      id: 'cannabis-act-interpretation-ambiguous',
      proposition: 'The current Cannabis Act XML returned more than one candidate paragraph for the requested young-person possession phrase, so Clove cannot select an interpretation safely.',
      sourceId: source.sourceId,
      sourceType: 'Justice Laws official XML',
      sourceLocation: {},
      sourceFragment: 'Multiple XML <Text> elements matched the requested phrase.',
      evidenceRole: 'qualifies',
      extractionMethod: 'deterministic_parser',
      validation: validation({ geographyMatched: true, populationMatched: true }),
      status: 'INSUFFICIENT_EVIDENCE',
    }, retrievedAt);
    return makeExperience({
      status: 'INSUFFICIENT_EVIDENCE',
      question,
      recipeId: discovery.recipeId,
      answer: { text: 'The official source was retrieved, but its matching statutory text is ambiguous. Further legal research is required.', claimIds: [ambiguityClaim.id] },
      whyThisAnswer: 'The extractor found multiple candidate paragraphs and stopped instead of inventing a section locator or choosing one silently.',
      claims: [ambiguityClaim],
      sources: discovery.candidates,
      challenge: { status: 'incomplete', label: 'Independent legal interpretation', detail: 'Interpretation requires further research because the official XML match was ambiguous.', claimIds: [] },
      graph: graphFor(question, [ambiguityClaim.id], [ambiguityClaim], discovery.candidates),
      unknowns: ['The exact statutory provision was not selected.', 'INTERPRETATION_REQUIRES_FURTHER_RESEARCH.'],
      timeline: [...timelineForDiscovery(discovery), { label: 'Interpretation boundary', state: 'blocked', detail: 'Multiple official XML matches prevented a safe section-level interpretation.' }],
      generatedAt: retrievedAt,
      legal: { officialText: 'The official XML contained multiple candidate matches; no single passage is promoted here.', interpretation: 'INTERPRETATION_REQUIRES_FURTHER_RESEARCH', interpretationStatus: 'INTERPRETATION_REQUIRES_FURTHER_RESEARCH' },
    });
  }
  if (!possession || !definition) throw new EvidenceExtractionError('INSUFFICIENT_EVIDENCE', 'statutory_target_not_found');
  const possessionClaim = claim({
    id: 'cannabis-act-section-8-possession',
    proposition: 'Cannabis Act section 8(1)(c) prohibits a young person from possessing cannabis above the five-gram dried-cannabis equivalent threshold.',
    value: 5,
    unit: 'g dried-cannabis equivalent threshold',
    geography: 'Canada',
    population: 'young person as defined for section 8',
    sourceId: source.sourceId,
    sourceType: 'Justice Laws official XML',
    sourceLocation: { section: possession.section ? `Section ${possession.section}` : undefined, paragraph: possession.paragraph, statuteSection: possession.section && possession.paragraph ? `${possession.section}(1)(${possession.paragraph})` : undefined },
    sourceFragment: possession.text,
    evidenceRole: 'supports',
    extractionMethod: 'deterministic_parser',
    validation: validation({ geographyMatched: true, unitMatched: true, populationMatched: true }),
    status: 'ESTABLISHED',
  }, retrievedAt);
  const definitionClaim = claim({
    id: 'cannabis-act-young-person-definition',
    proposition: 'For sections 8, 9, and 12, the Cannabis Act defines a young person as an individual who is 12 years of age or older but under 18 years of age.',
    geography: 'Canada',
    population: 'young person',
    sourceId: source.sourceId,
    sourceType: 'Justice Laws official XML',
    sourceLocation: { section: 'Interpretation', statuteSection: 'section 2' },
    sourceFragment: definition,
    evidenceRole: 'context',
    extractionMethod: 'deterministic_parser',
    validation: validation({ geographyMatched: true, populationMatched: true }),
    status: 'ESTABLISHED',
  }, retrievedAt);
  const interpretationClaim = claim({
    id: 'clove-interpretation-cannabis-possession',
    proposition: 'Clove’s bounded textual reading is that the federal statute governs this question through the Cannabis Act, section 8(1)(c), with the defined age category and threshold above.',
    geography: 'Canada',
    population: 'young person',
    sourceId: source.sourceId,
    sourceType: 'Clove interpretation',
    sourceLocation: { statuteSection: '2 and 8(1)(c)' },
    evidenceRole: 'qualifies',
    extractionMethod: 'deterministic_parser',
    validation: validation({ geographyMatched: true, periodMatched: true, populationMatched: true }),
    status: 'QUALIFIED',
  }, retrievedAt);
  const claims = [possessionClaim, definitionClaim, interpretationClaim];
  const answer = 'The federal source is the Cannabis Act. Its section 8(1)(c) text prohibits a defined “young person” from possessing cannabis above the equivalent of 5 g of dried cannabis. This is a source-grounded textual summary, not legal advice.';
  return makeExperience({
    status: 'QUALIFIED',
    question,
    recipeId: discovery.recipeId,
    answer: { text: answer, claimIds: claims.map((item) => item.id) },
    whyThisAnswer: 'The official text and Clove’s interpretation are deliberately separate. The extractor found the exact provision and the definition it relies on in the current consolidated XML.',
    claims,
    sources: discovery.candidates,
    challenge: { status: 'not_available', label: 'Independent legal interpretation', detail: 'No case-law or secondary interpretation was added; the result stays within the official statute.', claimIds: [] },
    graph: graphFor(question, claims.map((item) => item.id), claims, discovery.candidates),
    unknowns: ['Provincial or territorial age-of-sale rules were not researched.', 'Case-law interpretation and application were not researched.', 'This result should not be treated as individualized legal advice.'],
    timeline: [
      ...timelineForDiscovery(discovery),
      { label: 'Retrieved current consolidated XML', state: 'complete', detail: `${source.identifiers.xmlUrl}` },
      { label: 'Matched statutory provision', state: 'complete', detail: 'Found section 8(1)(c) and the section 2 young-person definition.' },
      { label: 'Separated text from interpretation', state: 'complete', detail: 'The UI will render official text and Clove’s reading in different panels.' },
    ],
    generatedAt: retrievedAt,
    legal: {
      officialText: `${possession.text}\n\n${definition}`,
      interpretation: 'The federal statute’s text establishes the threshold and defined age category shown above. This is a bounded textual reading, not legal advice.',
      interpretationStatus: 'bounded_textual_reading',
    },
  });
}

interface CrossrefWorkResponse {
  message?: {
    abstract?: string;
    title?: string[];
    DOI?: string;
  };
}

async function extractScience(question: string, discovery: DiscoveryResult, options: EvidenceResearchOptions): Promise<ResearchExperience> {
  const retrievedAt = nowIso(options);
  const claims: EvidenceClaim[] = [];
  let abstractCount = 0;
  for (const source of discovery.candidates.slice(0, 4)) {
    if (!source.doi) continue;
    let work: CrossrefWorkResponse = {};
    try {
      work = await fetchJson<CrossrefWorkResponse>(`https://api.crossref.org/works/${encodeURIComponent(source.doi)}`, discoveryContext(options), { maxBytes: 512 * 1024 });
    } catch {
      // The metadata candidate remains valid; unavailable detail is represented in the unknowns below.
    }
    const abstract = work.message?.abstract ? stripTags(work.message.abstract) : undefined;
    if (abstract) abstractCount += 1;
    claims.push(claim({
      id: `crossref-${source.doi.replace(/[^a-z0-9]+/gi, '-')}`,
      proposition: abstract
        ? `The Crossref record for “${source.title}” exposes an abstract; the abstract is evidence material but has not been independently synthesized into a general conclusion.`
        : `Crossref metadata identifies “${source.title}” as a potentially relevant work; metadata alone does not establish what the study found.`,
      sourceId: source.sourceId,
      sourceType: abstract ? 'Crossref abstract' : 'Crossref bibliographic metadata',
      sourceLocation: { section: abstract ? 'abstract' : 'work metadata' },
      sourceFragment: abstract ? abstract.slice(0, 2_000) : `DOI: ${source.doi}; title: ${source.title}; published: ${source.publishedAt ?? 'not reported'}; type: ${source.identifiers.workType ?? 'not reported'}`,
      evidenceRole: 'metadata_only',
      extractionMethod: 'deterministic_parser',
      validation: validation(),
      status: abstract ? 'QUALIFIED' : 'METADATA_ONLY',
    }, retrievedAt));
  }
  if (claims.length === 0) {
    return makeExperience({
      status: 'INSUFFICIENT_EVIDENCE',
      question,
      recipeId: discovery.recipeId,
      answer: { text: 'Crossref discovery returned no work record that can support a scientific claim. Further research is required.', claimIds: [] },
      whyThisAnswer: 'No bibliographic record was available to retrieve, so Clove does not assert a scientific result.',
      claims: [],
      sources: discovery.candidates,
      challenge: { status: 'incomplete', label: 'Independent scientific challenge', detail: 'There is no candidate work to challenge.', claimIds: [] },
      graph: graphFor(question, [], [], discovery.candidates),
      unknowns: ['No candidate study metadata was retrieved.', 'The scientific answer is research-required.'],
      timeline: [...timelineForDiscovery(discovery), { label: 'Result extraction', state: 'blocked', detail: 'No work record was available.' }],
      generatedAt: retrievedAt,
      science: { evidenceLevel: 'INSUFFICIENT_EVIDENCE', worksFound: 0 },
    });
  }
  const evidenceLevel = abstractCount > 0 ? 'ABSTRACT_EVIDENCE' : claims.length > 0 ? 'METADATA_ONLY' : 'INSUFFICIENT_EVIDENCE';
  const finalClaim = claim({
    id: 'science-result-not-established',
    proposition: claims.length > 0
      ? `Clove found ${claims.length} potentially relevant scholarly work(s), but the available source material does not establish whether creatine supplementation improves cognitive performance in healthy adults.`
      : 'Clove did not retrieve enough source material to establish the scientific finding.',
    sourceId: claims[0].sourceId,
    sourceType: 'Clove evidence boundary',
    sourceLocation: { section: 'synthesis boundary' },
    evidenceRole: 'qualifies',
    extractionMethod: 'deterministic_parser',
    validation: validation(),
    status: 'INSUFFICIENT_EVIDENCE',
  }, retrievedAt);
  claims.push(finalClaim);
  const status: ResearchExperienceStatus = claims.length > 1 ? 'RESEARCH_REQUIRED' : 'INSUFFICIENT_EVIDENCE';
  return makeExperience({
    status,
    question,
    recipeId: discovery.recipeId,
    answer: { text: finalClaim.proposition, claimIds: claims.map((item) => item.id) },
    whyThisAnswer: 'Crossref is being used as a bibliographic discovery system. The metadata and any returned abstract are preserved, but no study result is promoted into a general conclusion.',
    claims,
    sources: discovery.candidates,
    challenge: { status: 'incomplete', label: 'Independent scientific challenge', detail: 'Discovery found candidate works; result extraction and independent-study comparison remain required.', claimIds: [] },
    graph: graphFor(question, [finalClaim.id], claims, discovery.candidates),
    unknowns: ['Sample sizes, effect sizes, confidence intervals, corrections, and replication were not extracted from full study material.', 'A metadata record does not establish the direction or size of an effect.', 'The scientific answer remains research-required.'],
    timeline: [
      ...timelineForDiscovery(discovery),
      { label: 'Retrieved Crossref work metadata', state: claims.length > 1 ? 'complete' : 'partial', detail: `${claims.length - 1} candidate work record(s) inspected.` },
      { label: 'Result extraction', state: 'blocked', detail: evidenceLevel === 'METADATA_ONLY' ? 'No abstract or full-text result was available in the bounded source material.' : 'Abstract evidence requires further study-level validation.' },
      { label: 'Synthesis', state: 'complete', detail: 'Stopped at RESEARCH_REQUIRED rather than manufacturing a yes/no answer.' },
    ],
    generatedAt: retrievedAt,
    science: { evidenceLevel, worksFound: discovery.candidates.length },
  });
}

function claimFromDatum(item: EvidenceDatum, source: DiscoveryCandidate, retrievedAt: string): EvidenceClaim {
  return claim({
    id: item.id,
    proposition: `${item.label}: ${item.value} ${item.unit} for ${item.period}.`,
    value: item.value,
    unit: item.unit,
    geography: 'Canada',
    measurementPeriod: item.period,
    sourceId: source.sourceId,
    sourceType: source.institution ?? 'official source',
    sourceLocation: { section: item.locator },
    sourceFragment: item.exactQuote,
    evidenceRole: 'supports',
    extractionMethod: item.method === 'calculated' ? 'structured_data' : 'deterministic_parser',
    validation: validation({ geographyMatched: true, periodMatched: item.period === '2024', unitMatched: true }),
    status: 'ESTABLISHED',
  }, retrievedAt);
}

function completeElectricityClaim(
  strongest: EvidenceDatum,
  generatedAt: string,
): EvidenceClaim {
  const sourceId = strongest.sourceId;
  return claim({
    id: strongest.id,
    proposition: `Nuclear power supplied approximately ${strongest.value.toFixed(1)}% of Canada’s electricity generation in ${strongest.period}.`,
    value: strongest.value,
    unit: '%',
    geography: 'Canada',
    measurementPeriod: strongest.period,
    sourceId,
    sourceType: 'Statistics Canada calculation',
    sourceLocation: { section: strongest.locator },
    sourceFragment: strongest.exactQuote,
    evidenceRole: 'supports',
    extractionMethod: 'structured_data',
    validation: validation({ geographyMatched: true, periodMatched: true, unitMatched: true }),
    status: 'ESTABLISHED',
    calculation: { operands: strongest.supports, formula: strongest.exactQuote },
  }, generatedAt);
}

function fromInvestigation(investigation: Investigation): ResearchExperience {
  const generatedAt = investigation.generatedAt;
  const sources = sourceFromInvestigation(investigation);
  const sourceById = new Map(sources.map((source) => [source.sourceId, source]));
  const claims: EvidenceClaim[] = [];
  const total = investigation.evidence.find((item) => item.id === 'statcan-total-generation-2024');
  const nuclear = investigation.evidence.find((item) => item.id === 'statcan-nuclear-generation-2024');
  const strongest = investigation.strongestDatapoint;
  const totalSource = sourceById.get(total?.sourceId ?? '') ?? sources[0];
  const nuclearSource = sourceById.get(nuclear?.sourceId ?? '') ?? sources[0];
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
      unit: '%',
      geography: 'Canada',
      measurementPeriod: contradiction.challengerPeriod,
      sourceId: contradiction.challengerSourceId,
      sourceType: source.institution ?? 'challenger source',
      sourceLocation: { section: datum.locator },
      sourceFragment: datum.exactQuote,
      evidenceRole: 'qualifies',
      extractionMethod: 'deterministic_parser',
      validation: validation({ geographyMatched: true, periodMatched: false, unitMatched: true }),
      status: contradiction.status === 'unresolved' ? 'CONTESTED' : 'QUALIFIED',
    }, generatedAt));
  }
  const answerClaimIds = [calculated.id, ...claims.filter((item) => item.evidenceRole === 'qualifies').map((item) => item.id)];
  const status: ResearchExperienceStatus = investigation.unresolvedDisagreements.length > 0 ? 'CONTESTED' : investigation.contradictions.length > 0 ? 'QUALIFIED' : 'ESTABLISHED';
  return makeExperience({
    status,
    question: investigation.spec.question,
    recipeId: investigation.sourceRecipe.recipe.id,
    answer: { text: investigation.answer.text, claimIds: answerClaimIds },
    whyThisAnswer: 'The answer is calculated from two exact Statistics Canada datapoints. The independent challenger was executed and retained as a period-qualified comparison rather than silently treated as same-year corroboration.',
    strongestDatapoint: calculated,
    claims,
    sources,
    challenge: { status: investigation.independentSourceCheck.status === 'pass' ? 'executed' : 'incomplete', label: 'Canada Energy Regulator challenger', detail: investigation.independentSourceCheck.explanation, claimIds: claims.filter((item) => item.evidenceRole === 'qualifies').map((item) => item.id) },
    graph: graphFor(investigation.spec.question, answerClaimIds, claims, sources),
    unknowns: [
      ...investigation.contradictions.map((item) => item.explanation),
      ...(investigation.unresolvedDisagreements.length > 0 ? ['A same-period disagreement remains unresolved.'] : []),
    ],
    timeline: [
      { label: 'Classified as official Canadian statistic', state: 'complete', detail: 'Existing electricity research specification matched.' },
      { label: 'Looking for primary sources', state: 'complete', detail: `${investigation.sources.length} source records were retrieved and ranked.` },
      { label: 'Retrieved Statistics Canada data', state: 'complete', detail: 'Total and nuclear generation datapoints were parsed from the official page.' },
      { label: 'Matched Canada / annual period', state: 'complete', detail: '2024 national generation was used for the calculation.' },
      { label: 'Challenging the leading result', state: investigation.independentSourceCheck.status === 'pass' ? 'complete' : 'partial', detail: investigation.independentSourceCheck.explanation },
      { label: 'Synthesized supported answer', state: 'complete', detail: status },
    ],
    generatedAt,
  });
}

export async function runResearchExperience(question: string, options: EvidenceResearchOptions = {}): Promise<ResearchExperience> {
  const selectedRecipe = selectSourceRecipe(question);
  const intentValue = researchIntentFor(question);
  const preflight = preflightAlignment(intentValue, {
    selectedRecipeId: selectedRecipe?.recipe.id,
    boundedSpecification: Boolean(researchSpecFor(question)),
  });
  if (!preflight.allowed) {
    return alignmentRequiredExperience(question, intentValue, preflight.reason, nowIso(options));
  }
  if (researchSpecFor(question)) {
    const investigation = await investigate(question, {
      fetcher: options.fetcher,
      now: options.now,
    });
    return applyAlignment(fromInvestigation(investigation), intentValue);
  }
  const discovery = await discoverQuestion(question, discoveryContext(options));
  if (discovery.status === 'RECIPE_NOT_FOUND') throw new EvidenceExtractionError('INSUFFICIENT_EVIDENCE', 'RECIPE_NOT_FOUND');
  if (discovery.status === 'SOURCE_UNAVAILABLE' || discovery.status === 'RATE_LIMITED') {
    throw new EvidenceExtractionError(discovery.status, discovery.errors[0] ?? discovery.status);
  }
  if (discovery.recipeId === 'official_canadian_statistic') return applyAlignment(await extractPopulation(question, discovery, options), intentValue);
  if (discovery.recipeId === 'canadian_trade_statistic') return applyAlignment(await extractTrade(question, discovery, options), intentValue);
  if (discovery.recipeId === 'canadian_law') return applyAlignment(await extractLaw(question, discovery, options), intentValue);
  if (discovery.recipeId === 'scientific_finding') return applyAlignment(await extractScience(question, discovery, options), intentValue);
  throw new EvidenceExtractionError('INSUFFICIENT_EVIDENCE', 'unsupported_extraction_recipe');
}

export function isEvidenceExtractionError(error: unknown): error is EvidenceExtractionError {
  return error instanceof EvidenceExtractionError;
}

export function experienceErrorStatus(error: EvidenceExtractionError): ResearchExperienceStatus {
  if (error.code === 'RATE_LIMITED') return 'RATE_LIMITED';
  if (error.code === 'SOURCE_UNAVAILABLE') return 'SOURCE_UNAVAILABLE';
  return 'INSUFFICIENT_EVIDENCE';
}
