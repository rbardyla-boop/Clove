import { describe, expect, it, vi } from 'vitest';
import {
  CANADA_NUCLEAR_QUESTION,
  classifyDisagreement,
  investigate,
  type EvidenceDatum,
} from '../src/research';
import { handleResearchRequest } from '../src/index';
import {
  recipeHasStoredAnswer,
  selectSourceRecipe,
  SOURCE_RECIPES,
} from '../src/source-recipes';
import { fixtureFetcher } from './fixtures';

const NOW = new Date('2026-08-08T12:00:00.000Z');

function request(question: string): Request {
  return new Request('https://clovelearn.io/research/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
  });
}

describe('Clove Research nucleus', () => {
  it('runs the question through specification, ranked sources, provenance, challenge, graph, and Markdown export', async () => {
    const response = await handleResearchRequest(request(CANADA_NUCLEAR_QUESTION), {} as Env, {
      fetcher: fixtureFetcher,
      now: () => NOW,
    });
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      investigation: Awaited<ReturnType<typeof investigate>>;
    };
    const result = payload.investigation;

    expect(payload.ok).toBe(true);
    expect(result.status).toBe('supported');
    expect(result.spec.targetYear).toBe(2024);
    expect(result.spec.distinctionChecks).toEqual(expect.arrayContaining([
      'generation rather than installed capacity',
      'latest complete annual data rather than the latest month or forecast',
    ]));
    expect(result.sources.map((source) => source.id)).toEqual(['statcan-2024', 'cer-2021']);
    expect(result.sources.every((source) => source.status === 'available')).toBe(true);
    expect(result.strongestDatapoint.value).toBe(13);
    expect(result.answer.text).toContain('80.7 of 622.2 million MWh');
    expect(result.answer.claims[0].evidenceIds).toContain('statcan-nuclear-generation-2024');
    expect(result.independentSourceCheck.status).toBe('pass');
    expect(result.contradictions).toHaveLength(1);
    expect(result.contradictions[0].status).toBe('period_mismatch');
    expect(result.unresolvedDisagreements).toHaveLength(0);
    expect(result.evidenceGraph.nodes.some((node) => node.type === 'answer')).toBe(true);
    expect(result.evidenceGraph.edges.some((edge) => edge.relation === 'challenges')).toBe(true);
    expect(result.evidenceGraph.mermaid).toContain('graph TD');
    expect(result.markdown).toContain('## Evidence graph');
    expect(result.markdown).toContain('```mermaid');
    expect(result.markdown).toContain('https://www150.statcan.gc.ca/');
    expect(result.markdown).toContain('This Markdown contains the answer');
  });

  it('returns RECIPE_NOT_FOUND for questions with no deterministic evidence class', async () => {
    const fetcher = vi.fn(fixtureFetcher);
    const response = await handleResearchRequest(request('How many moons does Mars have?'), {} as Env, { fetcher });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ ok: false, code: 'RECIPE_NOT_FOUND' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('routes unseen questions to inspectable recipes without encoding an answer', async () => {
    const cases = [
      [
        "What was Canada's population in the latest complete year?",
        'official_canadian_statistic',
      ],
      [
        "What is the current federal minimum age for cannabis possession in Canada?",
        'canadian_law',
      ],
      [
        'Does creatine supplementation improve cognitive performance in healthy adults?',
        'scientific_finding',
      ],
    ] as const;

    for (const [question, recipeId] of cases) {
      const selection = selectSourceRecipe(question);
      expect(selection?.recipe.id).toBe(recipeId);
      expect(selection?.trace).toHaveLength(SOURCE_RECIPES.length);
      expect(selection?.matchedSignals.length).toBeGreaterThan(0);
      expect(selection && recipeHasStoredAnswer(selection.recipe)).toBe(false);

      const response = await handleResearchRequest(request(question), {} as Env);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        status: 'recipe_selected',
        researchPlan: {
          recipe: { id: recipeId },
          answerStatus: 'not_run',
        },
      });
    }
  });

  it('requires every recipe to declare retrieval, validation, freshness, challenge, and weaker-source rules', () => {
    for (const recipe of SOURCE_RECIPES) {
      expect(recipe.source_priority.length).toBeGreaterThan(0);
      expect(recipe.preferred_access.length).toBeGreaterThan(0);
      expect(recipe.mandatory_checks.length).toBeGreaterThan(0);
      expect(recipe.freshness.rule.length).toBeGreaterThan(0);
      expect(recipe.challenge.strategy.length).toBeGreaterThan(0);
      expect(recipe.prohibited_source_roles.length).toBeGreaterThan(0);
      expect(recipeHasStoredAnswer(recipe)).toBe(false);
    }
  });

  it('preserves a same-period disagreement instead of silently selecting a winner', () => {
    const primary: Pick<EvidenceDatum, 'value' | 'period' | 'sourceId'> = {
      value: 13,
      period: '2024',
      sourceId: 'primary',
    };
    const challenger: Pick<EvidenceDatum, 'value' | 'period' | 'sourceId'> = {
      value: 14,
      period: '2024',
      sourceId: 'challenger',
    };
    const contradiction = classifyDisagreement(primary, challenger);
    expect(contradiction?.status).toBe('unresolved');
    expect(contradiction?.explanation).toContain('remains unresolved');
  });

  it('keeps the route narrow and rejects malformed requests', async () => {
    const wrongPath = await handleResearchRequest(
      new Request('https://clovelearn.io/other', { method: 'POST' }),
      {} as Env,
    );
    expect(wrongPath.status).toBe(404);

    const malformed = await handleResearchRequest(
      new Request('https://clovelearn.io/research/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      {} as Env,
    );
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toEqual({ ok: false, code: 'question_required' });
  });

  it('serves the static research workspace through the Worker route without changing POST semantics', async () => {
    let requestedPath = '';
    const response = await handleResearchRequest(
      new Request('https://clovelearn.io/research/', { method: 'GET' }),
      { ASSETS: { fetch: async (assetRequest: Request) => { requestedPath = new URL(assetRequest.url).pathname; return new Response('<!doctype html><title>Research</title>', { headers: { 'content-type': 'text/html' } }); } } } as unknown as Env,
    );
    expect(response.status).toBe(200);
    expect(requestedPath).toBe('/');
    await expect(response.text()).resolves.toContain('<title>Research</title>');

    const assetResponse = await handleResearchRequest(
      new Request('https://clovelearn.io/research/research.css', { method: 'GET' }),
      { ASSETS: { fetch: async (assetRequest: Request) => { requestedPath = new URL(assetRequest.url).pathname; return new Response('body {}', { headers: { 'content-type': 'text/css' } }); } } } as unknown as Env,
    );
    expect(assetResponse.status).toBe(200);
    expect(requestedPath).toBe('/research.css');
  });
});
