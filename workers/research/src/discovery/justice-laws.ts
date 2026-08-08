import { evaluateSourceIndependence } from './independence';
import {
  absoluteUrl,
  decodeEntities,
  errorMessage,
  fetchText,
  normalizeText,
  nowIso,
  stripTags,
} from './normalize';
import type {
  DiscoveryAdapter,
  DiscoveryCandidate,
  DiscoveryContext,
  DiscoveryResult,
} from './types';

const JUSTICE_BASE = 'https://laws-lois.justice.gc.ca';
const LOOKUP_ENDPOINT = `${JUSTICE_BASE}/js/lookup_e.xml`;
const MAX_LOOKUP_BYTES = 1_000_000;
const MAX_LEGISLATION_BYTES = 1_000_000;
const MAX_MATCHES = 4;

interface TitleRecord {
  type: 'a' | 'r';
  code: string;
  title: string;
  repealed: boolean;
}

function attribute(attributes: string, name: string): string | undefined {
  return attributes.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'))?.[1];
}

function tagText(block: string, tag: string): string | undefined {
  const value = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))?.[1];
  return value ? stripTags(value) : undefined;
}

function parseLookup(xml: string, question: string): TitleRecord[] {
  const query = normalizeText(question);
  const terms = ['cannabis', 'possession', 'young', 'federal', 'law', 'regulation']
    .filter((term) => query.includes(term));
  const records: TitleRecord[] = [];
  for (const match of xml.matchAll(/<D\b([^>]*)>([\s\S]*?)<\/D>/gi)) {
    const attributes = match[1];
    const block = match[2];
    const type = attribute(attributes, 't');
    if (type !== 'a' && type !== 'r') continue;
    const title = decodeEntities(tagText(block, 'T') ?? '');
    const code = decodeEntities(tagText(block, 'C') ?? '');
    if (!title || !code || !terms.some((term) => normalizeText(title).includes(term))) continue;
    records.push({ type, code, title, repealed: attribute(attributes, 'rep') === 'true' || /\[repealed\]/i.test(title) });
  }
  return records
    .filter((record) => !record.repealed)
    .sort((left, right) => {
      const priority = (record: TitleRecord): number => {
        const title = normalizeText(record.title);
        if (record.type === 'a' && title === 'cannabis act') return 100;
        if (record.type === 'r' && title === 'cannabis regulations') return 90;
        if (record.type === 'r' && title.includes('cannabis')) return 50;
        return 10;
      };
      return priority(right) - priority(left);
    })
    .slice(0, MAX_MATCHES);
}

function legislationPath(record: TitleRecord): string {
  if (record.type === 'a') return `/eng/acts/${record.code}/index.html`;
  return `/eng/regulations/${record.code.replaceAll('/', '-') .replaceAll(' ', '_')}/index.html`;
}

function parseHtml(html: string, record: TitleRecord): {
  title: string;
  currentTo?: string;
  xmlUrl?: string;
  previousVersionsUrl?: string;
  relatedProvisionsUrl?: string;
  lastAmendedDate?: string;
  hasNotInForceMarkers: boolean;
} {
  const title = stripTags(html.match(/<h1[^>]*id=["']wb-cont["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? record.title)
    .replace(/\s+\([^)]*\)$/, '')
    .trim();
  const currentTo = html.match(/(?:Act|Regulations?)\s+current to\s+(\d{4}-\d{2}-\d{2})/i)?.[1];
  const lastAmendedDate = html.match(/last amended\s+on\s+(\d{4}-\d{2}-\d{2})/i)?.[1];
  const xmlHref = html.match(/href=["']([^"']*\/XML\/[^"']+\.xml)["']/i)?.[1];
  const previousHref = html.match(/href=["']([^"']*PITIndex\.html)["']/i)?.[1];
  const relatedHref = html.match(/href=["']([^"']*rpdc\.html)["']/i)?.[1];
  return {
    title,
    currentTo,
    xmlUrl: xmlHref ? absoluteUrl(xmlHref, JUSTICE_BASE) : undefined,
    previousVersionsUrl: previousHref ? absoluteUrl(previousHref, JUSTICE_BASE) : undefined,
    relatedProvisionsUrl: relatedHref ? absoluteUrl(relatedHref, JUSTICE_BASE) : undefined,
    lastAmendedDate,
    hasNotInForceMarkers: /not in force|shaded provisions|in-force/i.test(html),
  };
}

function parseXml(xml: string): {
  uniqueId?: string;
  title?: string;
  currentTo?: string;
  hasPreviousVersion?: string;
  inForce?: string;
} {
  const root = xml.match(/^\s*<[^!?][^>]*>/)?.[0] ?? '';
  return {
    uniqueId: tagText(xml, 'ConsolidatedNumber') ?? attribute(root, 'lims:id'),
    title: tagText(xml, 'ShortTitle'),
    currentTo: attribute(root, 'lims:current-date') ?? attribute(root, 'CurrentToDate'),
    hasPreviousVersion: attribute(root, 'hasPreviousVersion'),
    inForce: attribute(root, 'in-force'),
  };
}

function result(
  status: DiscoveryResult['status'],
  question: string,
  context: DiscoveryContext | undefined,
  candidates: DiscoveryCandidate[],
  errors: string[],
): DiscoveryResult {
  return {
    recipeId: 'canadian_law',
    sourceClass: 'canadian_law',
    status,
    candidates,
    queryUsed: question,
    endpoints: [LOOKUP_ENDPOINT],
    independence: evaluateSourceIndependence(candidates),
    retrievedAt: nowIso(context),
    errors,
  };
}

export const justiceLawsAdapter: DiscoveryAdapter = {
  recipeId: 'canadian_law',
  sourceClass: 'canadian_law',
  async discover(question, context = {}) {
    let lookup: string;
    try {
      lookup = await fetchText(LOOKUP_ENDPOINT, context, { accept: 'application/xml,text/xml', maxBytes: MAX_LOOKUP_BYTES });
    } catch (error) {
      const status = error instanceof Error && 'status' in error
        ? (error as { status: DiscoveryResult['status'] }).status
        : 'SOURCE_UNAVAILABLE';
      return result(status, question, context, [], [errorMessage(error)]);
    }

    const records = parseLookup(lookup, question);
    if (records.length === 0) return result('DISCOVERY_EMPTY', question, context, [], []);
    const candidates: DiscoveryCandidate[] = [];
    const errors: string[] = [];

    for (const record of records) {
      const htmlUrl = absoluteUrl(legislationPath(record), JUSTICE_BASE);
      try {
        const html = await fetchText(htmlUrl, context, { accept: 'text/html', maxBytes: MAX_LEGISLATION_BYTES });
        const htmlMetadata = parseHtml(html, record);
        if (!htmlMetadata.xmlUrl) {
          errors.push(`${record.code}:missing_xml_link`);
          continue;
        }
        const xml = await fetchText(htmlMetadata.xmlUrl, context, { accept: 'application/xml,text/xml', maxBytes: MAX_LEGISLATION_BYTES });
        const xmlMetadata = parseXml(xml);
        const type = record.type === 'a' ? 'act' : 'regulation';
        const currentTo = htmlMetadata.currentTo ?? xmlMetadata.currentTo;
        candidates.push({
          sourceId: `justice-${type}-${record.code.replaceAll('/', '-')}`,
          sourceClass: 'canadian_law',
          title: htmlMetadata.title || xmlMetadata.title || record.title,
          url: htmlUrl,
          authority: 'primary',
          institution: 'Department of Justice Canada',
          publishedAt: xmlMetadata.currentTo,
          currentTo,
          identifiers: {
            uniqueId: xmlMetadata.uniqueId ?? record.code,
            catalogCode: record.code,
            instrumentType: type,
            versionStatus: 'current_consolidated',
            inForceStatus: xmlMetadata.inForce ?? 'source_defined',
            currentToDate: currentTo ?? 'not_reported',
            xmlUrl: htmlMetadata.xmlUrl,
            previousVersionsUrl: htmlMetadata.previousVersionsUrl ?? 'not_linked',
            relatedProvisionsUrl: htmlMetadata.relatedProvisionsUrl ?? 'not_linked',
            amendmentsNotInForce: htmlMetadata.hasNotInForceMarkers ? 'markers_present' : 'not_detected',
            lastAmendedDate: htmlMetadata.lastAmendedDate ?? 'not_reported',
            officialConsolidation: 'true',
          },
          discoveryMethod: 'justice_laws:lookup_e.xml+consolidated_html+canonical_xml',
          queryUsed: question,
          provenance: {
            provider: 'Justice Laws Website / Department of Justice Canada',
            retrievedAt: nowIso(context),
            endpoint: LOOKUP_ENDPOINT,
          },
        });
      } catch (error) {
        errors.push(`${record.code}:${errorMessage(error)}`);
      }
    }

    const status = candidates.length === 0 ? 'DISCOVERY_PARTIAL' : errors.length > 0 ? 'DISCOVERY_PARTIAL' : 'DISCOVERY_COMPLETE';
    return result(status, question, context, candidates, errors);
  },
};
