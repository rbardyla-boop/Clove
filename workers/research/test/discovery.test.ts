import { describe, expect, it } from 'vitest';
import { handleResearchRequest } from '../src/index';
import {
  discoverQuestion,
  evaluateSourceIndependence,
} from '../src/discovery/registry';
import type { DiscoveryCandidate } from '../src/discovery/types';
import { discoveryFixtureFetcher } from './discovery-fixtures';

const NOW = new Date('2026-08-08T12:00:00.000Z');

const populationQuestion = "What was Canada's population in the latest complete annual period?";
const lawQuestion = 'What federal law governs possession of cannabis by young persons in Canada?';
const scienceQuestion = 'Does creatine supplementation affect cognitive performance in healthy adults?';
const tradeQuestion = 'how many cubic metres of softwood did Canada export to the US in 2025';

function discoveryRequest(question: string): Request {
  return new Request('https://clovelearn.io/research/discover', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
  });
}

describe('Discovery Adapter Layer v1', () => {
  it('discovers the specialized GAC trade path, broader context, and conversion-relevant source metadata', async () => {
    const result = await discoverQuestion(tradeQuestion, { fetcher: discoveryFixtureFetcher, now: NOW });
    expect(result.status).toBe('DISCOVERY_COMPLETE');
    expect(result.recipeId).toBe('canadian_trade_statistic');
    expect(result.candidates.filter((candidate) => candidate.identifiers.role === 'monthly_primary_measurement')).toHaveLength(12);
    expect(result.candidates.some((candidate) => candidate.identifiers.role === 'annual_primary_measurement')).toBe(true);
    expect(result.candidates.some((candidate) => candidate.identifiers.role === 'scope_definition')).toBe(true);
    expect(result.candidates.some((candidate) => candidate.identifiers.role === 'broader_context')).toBe(true);
    expect(result.candidates.find((candidate) => candidate.identifiers.role === 'annual_primary_measurement')?.identifiers.originalUnit).toContain('board feet');
    expect(result.independence.groups.some((group) => group.candidateIds.includes('statcan-lumber-context-16100018'))).toBe(true);
  });

  it('discovers a Canadian population cube through StatCan metadata without returning an answer', async () => {
    const result = await discoverQuestion(populationQuestion, { fetcher: discoveryFixtureFetcher, now: NOW });
    expect(result.status).toBe('DISCOVERY_COMPLETE');
    expect(result.candidates.length).toBeGreaterThan(0);
    const candidate = result.candidates[0];
    expect(candidate.sourceClass).toBe('official_canadian_statistic');
    expect(candidate.authority).toBe('primary');
    expect(candidate.institution).toBe('Statistics Canada');
    expect(candidate.identifiers.geography).toBe('Canada');
    expect(candidate.measurementPeriod).toContain('Annual');
    expect(candidate.measurementPeriod).toContain('reference_period_rule=July 1');
    expect(candidate.provenance.endpoint).toContain('getCubeMetadata');
    expect((candidate as unknown as { answer?: unknown }).answer).toBeUndefined();
  });

  it('discovers the Cannabis Act and preserves Act-versus-regulation and current-law provenance', async () => {
    const result = await discoverQuestion(lawQuestion, { fetcher: discoveryFixtureFetcher, now: NOW });
    expect(result.status).toBe('DISCOVERY_COMPLETE');
    expect(result.candidates.some((candidate) => candidate.title === 'Cannabis Act')).toBe(true);
    expect(result.candidates.some((candidate) => candidate.identifiers.instrumentType === 'act')).toBe(true);
    expect(result.candidates.some((candidate) => candidate.identifiers.instrumentType === 'regulation')).toBe(true);
    const act = result.candidates.find((candidate) => candidate.title === 'Cannabis Act');
    expect(act?.authority).toBe('primary');
    expect(act?.currentTo).toBe('2026-06-17');
    expect(act?.identifiers.versionStatus).toBe('current_consolidated');
    expect(act?.identifiers.xmlUrl).toContain('/eng/XML/C-24.5.xml');
    expect(act?.identifiers.previousVersionsUrl).toContain('PITIndex.html');
    expect(act?.identifiers.relatedProvisionsUrl).toContain('rpdc.html');
    expect(act?.identifiers.amendmentsNotInForce).toBe('markers_present');
  });

  it('discovers multiple Crossref works, deduplicates DOI records, and remains research-required', async () => {
    const result = await discoverQuestion(scienceQuestion, { fetcher: discoveryFixtureFetcher, now: NOW });
    expect(result.status).toBe('RESEARCH_REQUIRED');
    expect(result.candidates.length).toBe(2);
    expect(new Set(result.candidates.map((candidate) => candidate.doi)).size).toBe(2);
    expect(result.candidates.every((candidate) => candidate.authority === 'metadata')).toBe(true);
    expect(result.candidates.some((candidate) => candidate.identifiers.publicationType === 'review_or_meta_analysis')).toBe(true);
    expect(result.candidates.some((candidate) => candidate.identifiers.publicationType === 'primary_study_or_trial')).toBe(true);
    expect(result.candidates.some((candidate) => candidate.identifiers.retractionOrCorrectionMetadata === 'present')).toBe(true);
    expect(result.candidates.every((candidate) => candidate.identifiers.evidenceStatus === 'RESEARCH_REQUIRED')).toBe(true);
  });

  it('counts repeated DOI metadata as one underlying source', () => {
    const candidate = (sourceId: string, doi: string): DiscoveryCandidate => ({
      sourceId,
      sourceClass: 'scientific_finding',
      title: sourceId,
      url: `https://doi.org/${doi}`,
      authority: 'metadata',
      doi,
      identifiers: { doi },
      discoveryMethod: 'fixture',
      queryUsed: scienceQuestion,
      provenance: { provider: 'Crossref REST API', retrievedAt: NOW.toISOString(), endpoint: 'fixture' },
    });
    const verdict = evaluateSourceIndependence([
      candidate('a', '10.1234/shared'),
      candidate('b', '10.1234/shared'),
      candidate('c', '10.1234/independent'),
    ]);
    expect(verdict.independentSupportCount).toBe(2);
    expect(verdict.totalCandidates).toBe(3);
    expect(verdict.verdict).toBe('multiple_underlying_sources');
  });

  it('returns explicit discovery status on source failure instead of claiming no evidence', async () => {
    const unavailable = await discoverQuestion(populationQuestion, {
      fetcher: async () => new Response('', { status: 503 }),
      now: NOW,
    });
    expect(unavailable.status).toBe('SOURCE_UNAVAILABLE');
    expect(unavailable.candidates).toHaveLength(0);

    const rateLimited = await discoverQuestion(scienceQuestion, {
      fetcher: async () => new Response('', { status: 429 }),
      now: NOW,
    });
    expect(rateLimited.status).toBe('RATE_LIMITED');
    expect(rateLimited.candidates).toHaveLength(0);
  });

  it('exposes discovery as a separate route and keeps unsupported questions at RECIPE_NOT_FOUND', async () => {
    const discovered = await handleResearchRequest(discoveryRequest(lawQuestion), {} as Env, {
      fetcher: discoveryFixtureFetcher,
      now: () => NOW,
    });
    expect(discovered.status).toBe(200);
    await expect(discovered.json()).resolves.toMatchObject({ ok: true, status: 'DISCOVERY_COMPLETE' });

    const unsupported = await handleResearchRequest(discoveryRequest('How many moons does Mars have?'), {} as Env, {
      fetcher: discoveryFixtureFetcher,
    });
    expect(unsupported.status).toBe(422);
    await expect(unsupported.json()).resolves.toEqual({ ok: false, code: 'RECIPE_NOT_FOUND' });
  });
});
