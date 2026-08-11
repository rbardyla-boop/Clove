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
const tradeQuestion = 'how many cubic metres of softwood did Canada export to the US in 2025';

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
  it('answers the bounded Canadian softwood trade question with preserved source units and explicit conversion', async () => {
    const result = await runResearchExperience(tradeQuestion, { fetcher: discoveryFixtureFetcher, now: NOW });

    expect(result.status).toBe('QUALIFIED');
    expect(result.recipeId).toBe('canadian_trade_statistic');
    expect(result.strongestDatapoint?.value).toBe(25086702);
    expect(result.strongestDatapoint?.unit).toBe('cubic metres');
    expect(result.claims.find((claim) => claim.id === 'gac-softwood-2025-board-feet')).toMatchObject({
      value: 10631142309,
      unit: 'board feet',
      sourceType: 'Global Affairs Canada softwood-lumber export monitoring',
    });
    expect(result.claims.find((claim) => claim.id === 'gac-softwood-2025-cubic-metres')?.conversion).toMatchObject({
      originalValue: 10631142309,
      originalUnit: 'board feet',
      convertedValue: 25086702,
      toUnit: 'cubic metres',
    });
    expect(result.answer.text).toContain('25,086,702 cubic metres');
    expect(result.answer.text).toContain('10,631,142,309 board feet');
    expect(result.challenge.status).toBe('executed');
    expect(result.claims.some((claim) => claim.id === 'gac-softwood-scope-definition')).toBe(true);
    expect(result.claims.some((claim) => claim.id === 'statcan-lumber-context-2025')).toBe(true);
    expect(result.graph.edges.some((edge) => edge.relation === 'derived_from')).toBe(true);
    expect(exportedPaths(result)).toEqual(expect.arrayContaining([
      'Research/Data/gac-softwood-2025-cubic-metres.md',
      'Research/Claims/gac-softwood-2025-board-feet.md',
      'Research/Sources/gac-softwood-2025-annual.md',
    ]));
    expect(result.export.files.find((file) => file.path === 'Research/Claims/gac-softwood-2025-cubic-metres.md')?.content).toContain('Original value: 10631142309 board feet');
  });

  it('fails closed for a trade question outside the bounded softwood quantity path', async () => {
    const result = await runResearchExperience('What was the value of Canadian lumber exports to the United States in 2025?', {
      fetcher: async () => { throw new Error('unsupported_trade_should_stop_before_discovery'); },
      now: NOW,
    });

    expect(result.status).toBe('RESEARCH_REQUIRED');
    expect(result.recipeId).toBe('question_evidence_alignment_firewall');
    expect(result.alignment?.intent.kind).toBe('canadian_trade_statistic');
    expect(result.claims).toHaveLength(0);
  });

  it.each([
    ['how much softwood lumber did Canada export to the United States in 2025', 'QUALIFIED', 'canadian_trade_statistic'],
    ['what was the value of Canadian softwood exports to the US in 2025', 'RESEARCH_REQUIRED', 'question_evidence_alignment_firewall'],
    ['how much softwood did Canada export to the US in 2025', 'RESEARCH_REQUIRED', 'question_evidence_alignment_firewall'],
    ['how many cubic metres of wheat did Canada export to the US in 2025', 'RESEARCH_REQUIRED', 'question_evidence_alignment_firewall'],
    ['how many cubic metres of softwood did Canada export to the US in 2024', 'RESEARCH_REQUIRED', 'question_evidence_alignment_firewall'],
  ])('holds the trade alignment boundary for %s', async (question, expectedStatus, expectedRecipeId) => {
    const result = await runResearchExperience(question, { fetcher: discoveryFixtureFetcher, now: NOW });

    expect(result.status).toBe(expectedStatus);
    expect(result.recipeId).toBe(expectedRecipeId);
    if (expectedStatus === 'QUALIFIED') {
      expect(result.answer.text).toContain('25,086,702 cubic metres');
    } else {
      expect(result.answer.text).not.toContain('25,086,702');
      expect(result.answer.text).not.toContain('10,631,142,309');
    }
  });

  it('labels the public monthly-report fallback instead of silently presenting it as an annual reconciliation', async () => {
    const monthlyOnlyFetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      if (input === 'https://international.canada.ca/en/global-affairs/corporate/reports/export-import-controls/administration-2025') {
        return new Response('annual report unavailable in fallback fixture', { status: 404 });
      }
      const response = await discoveryFixtureFetcher(input, init);
      if (input === 'https://www.international.gc.ca/controls-controles/softwood-bois_oeuvre/index.aspx?lang=eng') {
        const index = await response.text();
        return new Response(index.replace(/<a href="[^"]*administration-2025">Annual report<\/a>/, ''), { headers: { 'content-type': 'text/html' } });
      }
      return response;
    };
    const result = await runResearchExperience(tradeQuestion, { fetcher: monthlyOnlyFetcher, now: NOW });

    expect(result.status).toBe('QUALIFIED');
    expect(result.claims.find((claim) => claim.id === 'gac-softwood-2025-board-feet')?.value).toBe(10262763669);
    expect(result.answer.text).toContain('24,217,425 cubic metres');
    expect(result.unknowns.some((unknown) => unknown.includes('annual reconciliation'))).toBe(true);
  });

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

  it('fails closed when an election question is routed toward the population recipe', async () => {
    const electionQuestion = 'how many people did not vote in the last election in Canada';
    const fetcher = async (): Promise<Response> => {
      throw new Error('alignment_firewall_should_precede_discovery');
    };
    const response = await handleResearchRequest(investigateRequest(electionQuestion), {} as Env, {
      fetcher,
      now: () => NOW,
    });
    const payload = await response.json() as { ok: boolean; status: string; research: ResearchExperience };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.research.status).toBe('RESEARCH_REQUIRED');
    expect(payload.research.recipeId).toBe('question_evidence_alignment_firewall');
    expect(payload.research.alignment?.intent.kind).toBe('electoral_participation');
    expect(payload.research.claims).toHaveLength(0);
    expect(payload.research.answer.text).not.toContain('41,651,653');
    expect(payload.research.answer.text).not.toContain('population');
    expect(payload.research.export.files[0]?.content).toContain('Question–evidence alignment');
  });

  it('does not let recipe-token strictness bypass the firewall for Canadian adjective wording', async () => {
    const response = await handleResearchRequest(investigateRequest('How many Canadians were unemployed last year?'), {} as Env, {
      fetcher: async () => { throw new Error('alignment_firewall_should_precede_discovery'); },
      now: () => NOW,
    });
    const payload = await response.json() as { ok: boolean; status: string; research: ResearchExperience };

    expect(response.status).toBe(200);
    expect(payload.status).toBe('research_complete');
    expect(payload.research.status).toBe('RESEARCH_REQUIRED');
    expect(payload.research.alignment?.intent.kind).toBe('unemployment');
    expect(payload.research.claims).toHaveLength(0);
  });

  it.each([
    'How many Canadians were unemployed last year?',
    'How many Canadians died from cancer last year?',
    'How many people immigrated to Canada last year?',
    'How many Canadians voted in 2025?',
    'How many Canadian homeowners are there?',
    'How many convictions were under the Cannabis Act?',
    'How many studies were published about this question?',
  ])('does not substitute population evidence for unsupported measure: %s', async (question) => {
    const result = await runResearchExperience(question, {
      fetcher: async () => { throw new Error('alignment_firewall_should_precede_discovery'); },
      now: NOW,
    });

    expect(result.status).toBe('RESEARCH_REQUIRED');
    expect(result.alignment?.status).toBe('RESEARCH_REQUIRED');
    expect(result.claims).toHaveLength(0);
    expect(result.answer.text).not.toContain('41,651,653');
    expect(result.answer.text).not.toContain("Canada's population");
  });
});
