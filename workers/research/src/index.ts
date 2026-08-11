import {
  CANADA_NUCLEAR_QUESTION,
  investigate,
  researchSpecFor,
  ResearchSourceError,
  UnsupportedQuestionError,
  type Fetcher,
} from './research';
import { discoverQuestion } from './discovery/registry';
import { buildResearchPlan, selectSourceRecipe } from './source-recipes';
import { researchIntentFor } from './alignment';
import {
  experienceErrorStatus,
  isEvidenceExtractionError,
  runResearchExperience,
} from './evidence';

const MAX_BODY_BYTES = 16_384;
const JSON_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
});

export interface ResearchRequestDependencies {
  fetcher?: Fetcher;
  now?: () => Date;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readSmallJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) throw new Error('body_too_large');
  if (!request.body) throw new Error('invalid_body');

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error('body_too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function handleResearchRequest(
  request: Request,
  env: Env,
  dependencies: ResearchRequestDependencies = {},
): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  const isResearchRoute = pathname === '/research' || pathname === '/research/';
  const isDiscoveryRoute = pathname === '/research/discover' || pathname === '/research/discover/';
  const isChallengeRoute = pathname === '/research/challenge' || pathname === '/research/challenge/';
  const isResearchAssetRoute = pathname.startsWith('/research/') && !isDiscoveryRoute && !isChallengeRoute;
  if (!isResearchRoute && !isDiscoveryRoute && !isChallengeRoute && !isResearchAssetRoute) return json({ ok: false, code: 'not_found' }, 404);
  if (request.method === 'GET' && (isResearchRoute || isResearchAssetRoute)) {
    if (!env.ASSETS) return json({ ok: false, code: 'research_ui_not_configured' }, 503);
    const assetUrl = new URL(request.url);
    assetUrl.pathname = isResearchRoute ? '/' : pathname.slice('/research'.length);
    return env.ASSETS.fetch(new Request(assetUrl, request));
  }
  if (request.method !== 'POST') return json({ ok: false, code: 'method_not_allowed' }, 405);
  if ((request.headers.get('content-type') || '').toLowerCase().startsWith('application/json') === false) {
    return json({ ok: false, code: 'content_type_required' }, 415);
  }

  try {
    const body = await readSmallJson(request);
    if (!isRecord(body) || typeof body.question !== 'string' || body.question.trim().length === 0) {
      return json({ ok: false, code: 'question_required' }, 400);
    }
    const intent = researchIntentFor(body.question);
    const selection = selectSourceRecipe(body.question);
    if (!selection) {
      if (intent.kind !== 'unknown' && (isChallengeRoute || body.mode === 'investigate')) {
        const research = await runResearchExperience(body.question, {
          fetcher: dependencies.fetcher,
          now: dependencies.now?.(),
        });
        if (isChallengeRoute) {
          return json({ ok: true, status: 'challenge_executed', challenge: research.challenge, claims: research.claims });
        }
        return json({ ok: true, status: 'research_complete', research });
      }
      return json({ ok: false, code: 'RECIPE_NOT_FOUND' }, 422);
    }
    if (isDiscoveryRoute) {
      const discovery = await discoverQuestion(body.question, {
        fetcher: dependencies.fetcher,
        now: dependencies.now?.(),
      });
      if (discovery.status === 'RECIPE_NOT_FOUND') return json({ ok: false, code: 'RECIPE_NOT_FOUND' }, 422);
      return json({ ok: true, status: discovery.status, discovery });
    }
    if (isChallengeRoute || body.mode === 'investigate') {
      const research = await runResearchExperience(body.question, {
        fetcher: dependencies.fetcher,
        now: dependencies.now?.(),
      });
      if (isChallengeRoute) {
        return json({ ok: true, status: 'challenge_executed', challenge: research.challenge, claims: research.claims });
      }
      return json({ ok: true, status: 'research_complete', research });
    }
    if (!researchSpecFor(body.question)) {
      return json({
        ok: true,
        status: 'recipe_selected',
        researchPlan: buildResearchPlan(body.question, selection),
      });
    }
    const investigation = await investigate(body.question, {
      fetcher: dependencies.fetcher,
      now: dependencies.now?.(),
    });
    return json({ ok: true, investigation });
  } catch (error) {
    if (isEvidenceExtractionError(error)) {
      return json({
        ok: true,
        status: experienceErrorStatus(error),
        code: error.message,
        error: error.message,
      });
    }
    if (error instanceof UnsupportedQuestionError) {
      return json({
        ok: false,
        code: 'unsupported_question',
        supported_questions: [CANADA_NUCLEAR_QUESTION],
      }, 422);
    }
    if (error instanceof ResearchSourceError) {
      return json({ ok: false, code: error.message }, 502);
    }
    const code = error instanceof Error ? error.message : 'research_failed';
    if (code === 'body_too_large') return json({ ok: false, code }, 413);
    if (code === 'invalid_body' || code === 'Unexpected end of JSON input') {
      return json({ ok: false, code: 'invalid_body' }, 400);
    }
    console.error(JSON.stringify({ code }));
    return json({ ok: false, code: 'research_failed' }, 500);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleResearchRequest(request, env);
  },
};
