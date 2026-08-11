import { evaluateSourceIndependence } from './independence';
import {
  absoluteUrl,
  errorMessage,
  fetchText,
  nowIso,
  stripTags,
} from './normalize';
import { isSupportedSoftwoodTrade, tradeSpecificationFor } from '../trade';
import type {
  DiscoveryAdapter,
  DiscoveryCandidate,
  DiscoveryContext,
  DiscoveryResult,
} from './types';

export const GAC_SOFTWOOD_INDEX_URL = 'https://www.international.gc.ca/controls-controles/softwood-bois_oeuvre/index.aspx?lang=eng';
export const GAC_SOFTWOOD_SCOPE_URL = 'https://www.international.gc.ca/controls-controles/report-rapports/list_liste/handbook-manuel/H1-Mon.aspx?lang=eng';
export const GAC_ANNUAL_REPORT_2025_URL = 'https://international.canada.ca/en/global-affairs/corporate/reports/export-import-controls/administration-2025';
export const STATCAN_LUMBER_CONTEXT_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1610001801';
export const STATCAN_LUMBER_CONTEXT_WDS_URL = 'https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorByReferencePeriodRange?vectorIds=%221066366737%22&startRefPeriod=2025-01-01&endReferencePeriod=2025-12-31';

const GAC_MONTHLY_LINK = /href=["']([^"']*SWL\s+monthly\s+Exports\s+Report_(\d{4})(\d{2})\.htm)["']/gi;
const GAC_ANNUAL_LINK = /href=["']([^"']*(?:eipa|annual|administration)[^"']*2025[^"']*)["']/gi;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function result(
  status: DiscoveryResult['status'],
  question: string,
  context: DiscoveryContext | undefined,
  candidates: DiscoveryCandidate[],
  errors: string[],
  endpoints: string[] = [GAC_SOFTWOOD_INDEX_URL, GAC_SOFTWOOD_SCOPE_URL, STATCAN_LUMBER_CONTEXT_URL],
): DiscoveryResult {
  return {
    recipeId: 'canadian_trade_statistic',
    sourceClass: 'canadian_trade_statistic',
    status,
    candidates,
    queryUsed: question,
    endpoints,
    independence: evaluateSourceIndependence(candidates),
    retrievedAt: nowIso(context),
    errors,
  };
}

function candidate(
  sourceId: string,
  title: string,
  url: string,
  question: string,
  retrievedAt: string,
  identifiers: Record<string, string>,
  measurementPeriod?: string,
): DiscoveryCandidate {
  return {
    sourceId,
    sourceClass: 'canadian_trade_statistic',
    title,
    url,
    authority: 'primary',
    institution: identifiers.institution ?? 'Government of Canada',
    measurementPeriod,
    identifiers,
    discoveryMethod: 'gac_softwood_index+official_trade_context',
    queryUsed: question,
    provenance: {
      provider: identifiers.institution ?? 'Government of Canada',
      retrievedAt,
      endpoint: GAC_SOFTWOOD_INDEX_URL,
    },
  };
}

function linksFor(index: string, question: string, retrievedAt: string, year: string): DiscoveryCandidate[] {
  const candidates: DiscoveryCandidate[] = [];
  const seen = new Set<string>();
  for (const match of index.matchAll(GAC_MONTHLY_LINK)) {
    const href = match[1];
    const linkYear = match[2];
    const month = match[3];
    if (linkYear !== year || seen.has(href)) continue;
    seen.add(href);
    const url = absoluteUrl(href, GAC_SOFTWOOD_INDEX_URL);
    candidates.push(candidate(
      `gac-softwood-${year}-${month}`,
      `Canada–U.S. Softwood Lumber Exports Report — ${MONTHS[Number(month) - 1] ?? month} ${year}`,
      url,
      question,
      retrievedAt,
      {
        institution: 'Global Affairs Canada',
        role: 'monthly_primary_measurement',
        dataSourceId: `gac-softwood-monitoring-${year}`,
        commodity: 'defined softwood lumber products',
        direction: 'export',
        partner: 'United States',
        originalUnit: 'FBM / board feet',
        month,
      },
      `${year}-${month}`,
    ));
  }
  return candidates.sort((left, right) => String(left.measurementPeriod).localeCompare(String(right.measurementPeriod)));
}

function annualCandidates(index: string, question: string, retrievedAt: string, year: string): DiscoveryCandidate[] {
  const candidates: DiscoveryCandidate[] = [];
  const seen = new Set<string>();
  for (const match of index.matchAll(GAC_ANNUAL_LINK)) {
    const href = match[1];
    if (seen.has(href)) continue;
    seen.add(href);
    candidates.push(candidate(
      `gac-softwood-${year}-annual`,
      `Global Affairs Canada annual softwood-lumber export report — ${year}`,
      absoluteUrl(href, GAC_SOFTWOOD_INDEX_URL),
      question,
      retrievedAt,
      {
        institution: 'Global Affairs Canada',
        role: 'annual_primary_measurement',
        dataSourceId: `gac-softwood-monitoring-${year}`,
        commodity: 'defined softwood lumber products',
        direction: 'export',
        partner: 'United States',
        originalUnit: 'FBM / board feet',
        reportType: 'annual',
      },
      year,
    ));
  }
  if (candidates.length === 0 && year === '2025') {
    candidates.push(candidate(
      `gac-softwood-${year}-annual`,
      `Global Affairs Canada annual softwood-lumber export report — ${year}`,
      GAC_ANNUAL_REPORT_2025_URL,
      question,
      retrievedAt,
      {
        institution: 'Global Affairs Canada',
        role: 'annual_primary_measurement',
        dataSourceId: `gac-softwood-monitoring-${year}`,
        commodity: 'defined softwood lumber products',
        direction: 'export',
        partner: 'United States',
        originalUnit: 'FBM / board feet',
        reportType: 'annual',
      },
      year,
    ));
  }
  return candidates;
}

export const canadianTradeAdapter: DiscoveryAdapter = {
  recipeId: 'canadian_trade_statistic',
  sourceClass: 'canadian_trade_statistic',
  async discover(question, context = {}) {
    const specification = tradeSpecificationFor(question);
    if (!isSupportedSoftwoodTrade(specification)) {
      return result('RESEARCH_REQUIRED', question, context, [], ['trade_specification_not_supported']);
    }

    let index: string;
    try {
      index = await fetchText(GAC_SOFTWOOD_INDEX_URL, context, { maxBytes: 512 * 1024 });
    } catch (error) {
      return result(
        error instanceof Error && 'status' in error ? (error as { status: DiscoveryResult['status'] }).status : 'SOURCE_UNAVAILABLE',
        question,
        context,
        [],
        [errorMessage(error)],
      );
    }

    const retrievedAt = nowIso(context);
    const monthly = linksFor(index, question, retrievedAt, specification.period);
    const annual = annualCandidates(index, question, retrievedAt, specification.period);
    const scope = candidate(
      'gac-softwood-scope-h1',
      'H-1: Monitoring Softwood Lumber Exports to the United States — scope definition',
      GAC_SOFTWOOD_SCOPE_URL,
      question,
      retrievedAt,
      {
        institution: 'Global Affairs Canada',
        role: 'scope_definition',
        commodity: 'defined softwood lumber products',
        partner: 'United States',
        scopeCode: 'ECL Item 5105 / source-defined tariff lines',
      },
      'source-defined',
    );
    const contextSource = candidate(
      'statcan-lumber-context-16100018',
      'Canadian lumber exports by mode of transportation — broader context',
      STATCAN_LUMBER_CONTEXT_URL,
      question,
      retrievedAt,
      {
        institution: 'Statistics Canada',
        role: 'broader_context',
        productId: '1610001801',
        commodity: 'total lumber exports; softwood and hardwood',
        destination: 'all destinations',
        originalUnit: 'thousand cubic metres',
        period: specification.period,
        vectorId: '1066366737',
        dataEndpoint: STATCAN_LUMBER_CONTEXT_WDS_URL,
      },
      specification.period,
    );
    const aggregate = candidate(
      `gac-softwood-${specification.period}-monthly-aggregate`,
      `Global Affairs Canada 2025 monthly softwood-lumber reports — annual sum`,
      GAC_SOFTWOOD_INDEX_URL,
      question,
      retrievedAt,
      {
        institution: 'Global Affairs Canada',
        role: 'monthly_aggregate',
        dataSourceId: `gac-softwood-monitoring-${specification.period}`,
        commodity: 'defined softwood lumber products',
        direction: 'export',
        partner: 'United States',
        originalUnit: 'FBM / board feet',
        aggregation: 'sum of twelve monthly reports',
      },
      specification.period,
    );
    const candidates = [...annual, ...monthly, aggregate, scope, contextSource];
    const errors = monthly.length === 12 ? [] : [`expected_12_monthly_reports_found_${monthly.length}`];
    return result(
      monthly.length === 0 && annual.length === 0 ? 'DISCOVERY_PARTIAL' : errors.length > 0 ? 'DISCOVERY_PARTIAL' : 'DISCOVERY_COMPLETE',
      question,
      context,
      candidates,
      errors,
      [GAC_SOFTWOOD_INDEX_URL, ...annual.map((item) => item.url), ...monthly.map((item) => item.url), GAC_SOFTWOOD_SCOPE_URL, STATCAN_LUMBER_CONTEXT_URL],
    );
  },
};

export function parseSoftwoodBoardFeet(report: string): number | null {
  const text = stripTags(report);
  const tableText = text.match(/Region\s+Exports\s*\(FBM\)([\s\S]{0,1600})/i)?.[1] ?? text;
  const match = tableText.match(/\bTotal\b\s*([\d,]+(?:\.\d+)?)/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

export function parseAnnualSoftwoodBoardFeet(report: string): number | null {
  const text = stripTags(report);
  const match = text.match(/softwood\s+lumber(?:\s+products)?[\s\S]{0,400}?total(?:led)?\s*([\d,]+)\s*board\s+feet/i)
    ?? text.match(/\bTotal\b\s*([\d,]+)\s*(?:board\s+feet|FBM)/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

export function parseStatsCanLumberContext(report: string): number | null {
  const text = stripTags(report);
  const match = text.match(/2025[\s\S]{0,500}?([\d,]+(?:\.\d+)?)\s*(?:thousand\s+)?cubic\s+met(?:re|er)s?/i)
    ?? text.match(/([\d,]+(?:\.\d+)?)\s*thousand\s+cubic\s+met(?:re|er)s?/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}
