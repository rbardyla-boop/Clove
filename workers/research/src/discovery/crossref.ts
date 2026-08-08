import { evaluateSourceIndependence } from './independence';
import {
  dateParts,
  errorMessage,
  fetchJson,
  normalizeText,
  nowIso,
} from './normalize';
import type {
  DiscoveryAdapter,
  DiscoveryCandidate,
  DiscoveryContext,
  DiscoveryResult,
} from './types';

const CROSSREF_ENDPOINT = 'https://api.crossref.org/works';
const MAX_RESPONSE_BYTES = 512 * 1024;
const MAX_ROWS = 12;

interface CrossrefAuthor {
  given?: string;
  family?: string;
  name?: string;
}

interface CrossrefItem {
  DOI?: string;
  title?: string[];
  author?: CrossrefAuthor[];
  published?: { 'date-parts'?: unknown[][] };
  'published-print'?: { 'date-parts'?: unknown[][] };
  'published-online'?: { 'date-parts'?: unknown[][] };
  issued?: { 'date-parts'?: unknown[][] };
  type?: string;
  subtype?: string;
  'container-title'?: string[];
  publisher?: string;
  funder?: Array<{ name?: string; DOI?: string }>;
  update?: Array<{ label?: string; DOI?: string; type?: string }>;
  URL?: string;
}

interface CrossrefResponse {
  status?: string;
  message?: { items?: CrossrefItem[] };
}

function normalizeDoi(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .trim()
    .replace(/^https?:\/\/doi.org\//i, '')
    .replace(/^doi:/i, '')
    .toLowerCase();
}

function publishedAt(item: CrossrefItem): string | undefined {
  return dateParts(item['published-print']?.['date-parts']?.[0])
    ?? dateParts(item['published-online']?.['date-parts']?.[0])
    ?? dateParts(item.published?.['date-parts']?.[0])
    ?? dateParts(item.issued?.['date-parts']?.[0]);
}

function publicationType(item: CrossrefItem, title: string): string {
  const normalizedTitle = normalizeText(title);
  if (/systematic review|meta analysis|meta-analysis|scoping review|review of/.test(normalizedTitle)) return 'review_or_meta_analysis';
  if (/randomized|randomised|trial|controlled study|pilot study/.test(normalizedTitle)) return 'primary_study_or_trial';
  return item.type ?? 'unclassified_crossref_work';
}

function candidateFromItem(item: CrossrefItem, question: string, context: DiscoveryContext, endpoint: string): DiscoveryCandidate | null {
  const title = item.title?.[0]?.trim();
  const doi = normalizeDoi(item.DOI);
  if (!title || !doi) return null;
  const authors = (item.author ?? []).map((author) => author.name ?? [author.given, author.family].filter(Boolean).join(' ')).filter(Boolean);
  const updates = item.update ?? [];
  const url = item.URL ?? `https://doi.org/${doi}`;
  return {
    sourceId: `crossref-doi-${doi}`,
    sourceClass: 'scientific_finding',
    title,
    url,
    authority: 'metadata',
    institution: item.publisher,
    publishedAt: publishedAt(item),
    doi,
    identifiers: {
      doi,
      workType: item.type ?? 'not_reported',
      subtype: item.subtype ?? 'not_reported',
      publicationType: publicationType(item, title),
      journal: item['container-title']?.[0] ?? 'not_reported',
      authorCount: String(authors.length),
      authors: authors.join('; '),
      funderCount: String(item.funder?.length ?? 0),
      funders: (item.funder ?? []).map((funder) => funder.name ?? funder.DOI ?? 'unnamed').join('; ') || 'none_deposited',
      updateCount: String(updates.length),
      updateLabels: updates.map((update) => update.label ?? update.type ?? 'unlabelled_update').join('; ') || 'none_deposited',
      retractionOrCorrectionMetadata: updates.some((update) => /retract|correct|expression/i.test(`${update.label ?? ''} ${update.type ?? ''}`)) ? 'present' : 'not_detected',
      evidenceStatus: 'RESEARCH_REQUIRED',
    },
    discoveryMethod: 'crossref_rest:/works',
    queryUsed: question,
    provenance: {
      provider: 'Crossref REST API',
      retrievedAt: nowIso(context),
      endpoint,
    },
  };
}

function result(
  status: DiscoveryResult['status'],
  question: string,
  context: DiscoveryContext | undefined,
  candidates: DiscoveryCandidate[],
  errors: string[],
  endpoint: string,
): DiscoveryResult {
  return {
    recipeId: 'scientific_finding',
    sourceClass: 'scientific_finding',
    status,
    candidates,
    queryUsed: question,
    endpoints: [endpoint],
    independence: evaluateSourceIndependence(candidates),
    retrievedAt: nowIso(context),
    errors,
  };
}

export const crossrefAdapter: DiscoveryAdapter = {
  recipeId: 'scientific_finding',
  sourceClass: 'scientific_finding',
  async discover(question, context = {}) {
    const endpoint = `${CROSSREF_ENDPOINT}?query.bibliographic=${encodeURIComponent(question)}&rows=${MAX_ROWS}`;
    let response: CrossrefResponse;
    try {
      response = await fetchJson<CrossrefResponse>(endpoint, context, { maxBytes: MAX_RESPONSE_BYTES });
    } catch (error) {
      const status = error instanceof Error && 'status' in error
        ? (error as { status: DiscoveryResult['status'] }).status
        : 'SOURCE_UNAVAILABLE';
      return result(status, question, context, [], [errorMessage(error)], endpoint);
    }

    const deduped = new Map<string, DiscoveryCandidate>();
    for (const item of response.message?.items ?? []) {
      const candidate = candidateFromItem(item, question, context, endpoint);
      if (candidate && !deduped.has(candidate.sourceId)) deduped.set(candidate.sourceId, candidate);
    }
    const candidates = [...deduped.values()];
    return result(candidates.length > 0 ? 'RESEARCH_REQUIRED' : 'DISCOVERY_EMPTY', question, context, candidates, [], endpoint);
  },
};
