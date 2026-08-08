import { describe, expect, it } from 'vitest';
import {
  CANADA_NUCLEAR_QUESTION,
} from '../src/research';
import {
  runResearchExperience,
  type ResearchExperience,
} from '../src/evidence';
import { handleResearchRequest } from '../src/index';
import { discoveryFixtureFetcher } from './discovery-fixtures';

const NOW = new Date('2026-08-08T12:00:00.000Z');
const populationQuestion = "What was Canada's population in the latest complete annual period?";
const lawQuestion = 'What federal law governs possession of cannabis by young persons in Canada?';
const scienceQuestion = 'Does creatine supplementation affect cognitive performance in healthy adults?';

function investigateRequest(question: string): Request {
  return new Request('https://clovelearn.io/research/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question, mode: 'investigate' }),
  });
}

function exportedPaths(result: ResearchExperience): string[] {
  return result.export.files.map((file) => file.path);
}

describe('Evidence extraction and research experience v1', () => {
  it('retrieves the exact latest annual StatCan population datapoint', async () => {
    const result = await runResearchExperience(populationQuestion, { fetcher: discoveryFixtureFetcher, now: NOW });

    expect(result.status).toBe('QUALIFIED');
    expect(result.strongestDatapoint?.value).toBe(41651653);
    expect(result.strongestDatapoint?.measurementPeriod).toBe('2025-07-01');
    expect(result.strongestDatapoint?.sourceLocation).toMatchObject({
      table: '17100005',
      row: 'Canada · Total - gender · All ages',
      column: '2025-07-01',
    });
    expect(result.strongestDatapoint?.sourceFragment).toContain('vectorId=466668');
    expect(result.answer.text).toContain('latest complete annual period');
    expect(result.unknowns.length).toBeGreaterThan(0);
    expect(exportedPaths(result)).toEqual(expect.arrayContaining([
      'Research/Investigation.md',
      'Research/Claims/statcan-population-2025.md',
      'Research/Sources/statcan-cube-17100005.md',
    ]));
  });

  it('extracts official Cannabis Act text and keeps interpretation visibly separate', async () => {
    const result = await runResearchExperience(lawQuestion, { fetcher: discoveryFixtureFetcher, now: NOW });

    expect(result.status).toBe('QUALIFIED');
    expect(result.legal?.officialText).toContain('more than 5 g of dried cannabis');
    expect(result.legal?.officialText).toContain('12 years of age or older but under 18');
    expect(result.legal?.interpretation).toContain('bounded textual reading');
    expect(result.legal?.officialText).not.toContain('legal advice');
    expect(result.claims.find((claim) => claim.id === 'cannabis-act-section-8-possession')).toMatchObject({
      sourceLocation: { statuteSection: '8(1)(c)' },
      extractionMethod: 'deterministic_parser',
      status: 'ESTABLISHED',
    });
    expect(result.claims.find((claim) => claim.id === 'clove-interpretation-cannabis-possession')?.sourceType).toBe('Clove interpretation');
    expect(exportedPaths(result)).toEqual(expect.arrayContaining([
      'Research/Contradictions/clove-interpretation-cannabis-possession.md',
    ]));
  });

  it('stops with INTERPRETATION_REQUIRES_FURTHER_RESEARCH when official law matches are ambiguous', async () => {
    const ambiguousFetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      const response = await discoveryFixtureFetcher(input, init);
      if (!input.endsWith('/eng/XML/C-24.5.xml')) return response;
      const xml = await response.text();
      return new Response(xml.replace('</Body>', '<Paragraph><Label>(z)</Label><Text>for a young person to possess cannabis of one or more classes of cannabis the total amount of which, as determined in accordance with Schedule 3, is equivalent to more than 5 g of dried cannabis;</Text></Paragraph></Body>'), { headers: { 'content-type': 'application/xml' } });
    };
    const result = await runResearchExperience(lawQuestion, { fetcher: ambiguousFetcher, now: NOW });

    expect(result.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.legal?.interpretationStatus).toBe('INTERPRETATION_REQUIRES_FURTHER_RESEARCH');
    expect(result.answer.claimIds).toEqual(['cannabis-act-interpretation-ambiguous']);
  });

  it('does not turn Crossref bibliographic metadata into a scientific yes/no result', async () => {
    const result = await runResearchExperience(scienceQuestion, { fetcher: discoveryFixtureFetcher, now: NOW });

    expect(result.status).toBe('RESEARCH_REQUIRED');
    expect(result.science).toMatchObject({ evidenceLevel: 'METADATA_ONLY', worksFound: 2 });
    expect(result.answer.text).toContain('does not establish');
    expect(result.claims.some((claim) => claim.status === 'METADATA_ONLY')).toBe(true);
    expect(result.claims.at(-1)?.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.unknowns.some((unknown) => unknown.includes('metadata record'))).toBe(true);
  });

  it('routes the product result through EvidenceClaim[] and exposes a challenge action', async () => {
    const response = await handleResearchRequest(investigateRequest(CANADA_NUCLEAR_QUESTION), {} as Env, {
      fetcher: async (input, init) => {
        if (input.includes('statcan') || input.includes('cer-rec')) return (await import('./fixtures')).fixtureFetcher(input);
        return discoveryFixtureFetcher(input, init);
      },
      now: () => NOW,
    });
    const payload = await response.json() as { ok: boolean; status: string; research: ResearchExperience };
    expect(response.status).toBe(200);
    expect(payload.status).toBe('research_complete');
    expect(payload.research.claims.every((claim) => claim.sourceId && claim.sourceLocation)).toBe(true);
    expect(payload.research.challenge.status).toBe('executed');
    expect(payload.research.graph.edges.some((edge) => edge.relation === 'derived_from')).toBe(true);
    expect(exportedPaths(payload.research)).toEqual(expect.arrayContaining(['Research/Data/canada-nuclear-share-2024.md']));
  });
});
