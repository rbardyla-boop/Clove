import type { DiscoveryCandidate, IndependenceGroup, IndependenceVerdict } from './types';

function underlyingSourceKey(candidate: DiscoveryCandidate): string {
  const doi = candidate.doi ?? candidate.identifiers.doi;
  if (doi) return `doi:${doi.toLowerCase().replace(/^https?:\/\/doi.org\//, '')}`;

  const dataSource = candidate.identifiers.dataSourceId
    ?? candidate.identifiers.productId
    ?? candidate.identifiers.vectorId;
  if (dataSource) return `data:${candidate.sourceClass}:${dataSource}`;

  try {
    const url = new URL(candidate.url);
    return `url:${candidate.sourceClass}:${url.origin}${url.pathname}`;
  } catch {
    return `candidate:${candidate.sourceId}`;
  }
}

export function evaluateSourceIndependence(candidates: DiscoveryCandidate[]): IndependenceVerdict {
  const groupsByKey = new Map<string, IndependenceGroup>();
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
      verdict: 'no_candidates',
      explanation: 'No candidates were discovered, so no independent support exists.',
    };
  }
  if (groups.length === 1) {
    return {
      independentSupportCount: 1,
      totalCandidates: candidates.length,
      groups,
      verdict: 'single_underlying_source',
      explanation: 'The candidates collapse to one DOI, data product, vector, or canonical source URL.',
    };
  }
  return {
    independentSupportCount: groups.length,
    totalCandidates: candidates.length,
    groups,
    verdict: 'multiple_underlying_sources',
    explanation: `${groups.length} distinct underlying sources were discovered; repeated metadata records do not increase this count.`,
  };
}
