export type TradeDirection = 'export' | 'import';
export type TradeMeasure = 'physical_quantity' | 'value' | 'unknown';

export interface CanadianTradeSpecification {
  commodity: string;
  direction: TradeDirection;
  partner: string;
  period: string;
  measure: TradeMeasure;
  requestedUnit?: string;
  ambiguities: string[];
}

export const BOARD_FEET_TO_CUBIC_METRES = 0.002359737216;

function normalizeQuestion(question: string): string {
  return question
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9% ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tradeSpecificationFor(question: string): CanadianTradeSpecification | null {
  const normalized = normalizeQuestion(question);
  const direction = /\bexport(?:s|ed)?\b/.test(normalized)
    ? 'export'
    : /\bimport(?:s|ed)?\b/.test(normalized)
      ? 'import'
      : undefined;
  const hasTradeSignal = Boolean(direction) || /\btrade\b|\bshipment|\bcommodity\b/.test(normalized);
  const hasCommoditySignal = /\bsoftwood\b|\blumber\b/.test(normalized);
  if (!hasTradeSignal || !hasCommoditySignal) return null;

  const partner = /\bunited states\b|\bu s\b|\busa\b|\bus\b/.test(normalized)
    ? 'United States'
    : '';
  const period = normalized.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? '';
  const explicitUnit = /\bcubic metre?s?\b|\bcubic meter?s?\b|\bm3\b/.test(normalized)
    ? 'cubic metres'
    : /\bboard feet?\b|\bfbm\b/.test(normalized)
      ? 'board feet'
      : undefined;
  const canonicalSoftwoodLumberQuantity = /\bhow much\b/.test(normalized)
    && /\bsoftwood\b/.test(normalized)
    && /\blumber\b/.test(normalized);
  const requestedUnit = explicitUnit ?? (canonicalSoftwoodLumberQuantity ? 'cubic metres' : undefined);
  const measure: TradeMeasure = requestedUnit
    ? 'physical_quantity'
    : /\b(?:dollar|dollars|value|worth|cad|usd)\b|\$/.test(normalized)
      ? 'value'
      : 'unknown';
  const ambiguities: string[] = [];
  if (!direction) ambiguities.push('The trade direction is not specified as export or import.');
  if (!partner) ambiguities.push('The partner country is not a configured Canadian trade partner for this bounded path.');
  if (!period) ambiguities.push('The reference year is not specified.');
  if (!requestedUnit && measure !== 'value') ambiguities.push('The requested trade measure or unit is not specified.');

  return {
    commodity: 'softwood lumber',
    direction: direction ?? 'export',
    partner,
    period,
    measure,
    requestedUnit,
    ambiguities,
  };
}

export function isSupportedSoftwoodTrade(specification: CanadianTradeSpecification | null): specification is CanadianTradeSpecification {
  return Boolean(
    specification
    && specification.commodity === 'softwood lumber'
    && specification.direction === 'export'
    && specification.partner === 'United States'
    && specification.period === '2025'
    && specification.measure === 'physical_quantity'
    && specification.requestedUnit === 'cubic metres',
  );
}
