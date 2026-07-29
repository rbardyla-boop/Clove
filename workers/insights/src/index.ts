import { validateFeedback, validateSignal } from './contracts';

const ALLOWED_ORIGIN = 'https://clovelearn.io';
const MAX_BODY_BYTES = 4096;

const RESPONSE_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
});

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: RESPONSE_HEADERS });
}

function fail(code: string, status: number): Response {
  if (status >= 500) console.error(JSON.stringify({ code, status }));
  return json({ ok: false, code }, status);
}

async function readSmallJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) throw new Error('body_too_large');
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

function requestAllowed(request: Request): boolean {
  return request.method === 'POST'
    && request.headers.get('origin') === ALLOWED_ORIGIN
    && (request.headers.get('content-type') || '').toLowerCase().startsWith('application/json');
}

async function recordSignal(request: Request, env: Env): Promise<Response> {
  if (!requestAllowed(request)) return fail('request_not_allowed', 403);
  try {
    const signal = validateSignal(await readSmallJson(request));
    const day = new Date().toISOString().slice(0, 10);
    await env.INSIGHTS_DB.prepare(`
      INSERT INTO aggregate_daily (
        day, event, surface, device, return_bucket,
        referrer_group, build, variant, detail, diagnostic, count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT (
        day, event, surface, device, return_bucket,
        referrer_group, build, variant, detail, diagnostic
      ) DO UPDATE SET count = count + 1
    `).bind(
      day,
      signal.event,
      signal.surface,
      signal.device,
      signal.returnBucket,
      signal.referrerGroup,
      signal.build,
      signal.variant,
      signal.detail,
      signal.diagnostic,
    ).run();
    return json({ ok: true }, 202);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invalid_request';
    if (code === 'body_too_large') return fail(code, 413);
    if (code.startsWith('invalid_') || code === 'note_too_long' || code === 'note_required') {
      return fail(code, 400);
    }
    return fail('write_failed', 503);
  }
}

async function recordFeedback(request: Request, env: Env): Promise<Response> {
  if (!requestAllowed(request)) return fail('request_not_allowed', 403);
  try {
    const feedback = validateFeedback(await readSmallJson(request));
    if (feedback.company) return json({ ok: true }, 202);
    const day = new Date().toISOString().slice(0, 10);
    await env.INSIGHTS_DB.prepare(`
      INSERT INTO feedback_notes (
        day, category, surface, device, note, diagnostic
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      day,
      feedback.category,
      feedback.surface,
      feedback.device,
      feedback.note,
      feedback.diagnostic,
    ).run();
    return json({ ok: true }, 202);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invalid_request';
    if (code === 'body_too_large') return fail(code, 413);
    if (code.startsWith('invalid_') || code === 'note_too_long' || code === 'note_required') {
      return fail(code, 400);
    }
    return fail('write_failed', 503);
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/__clove/health' && request.method === 'GET') {
      try {
        await env.INSIGHTS_DB.prepare('SELECT 1 AS ok').first();
        return json({ ok: true, service: 'clove-insights', privacy: 'aggregate-only' });
      } catch {
        return fail('database_unavailable', 503);
      }
    }
    if (path === '/__clove/signal') return recordSignal(request, env);
    if (path === '/__clove/feedback') return recordFeedback(request, env);
    return fail('not_found', 404);
  },

  async scheduled(_controller, env): Promise<void> {
    try {
      await env.INSIGHTS_DB.batch([
        env.INSIGHTS_DB.prepare("DELETE FROM feedback_notes WHERE day < date('now', '-90 days')"),
        env.INSIGHTS_DB.prepare("DELETE FROM aggregate_daily WHERE day < date('now', '-400 days')"),
      ]);
    } catch {
      console.error(JSON.stringify({ code: 'retention_cleanup_failed', status: 500 }));
      throw new Error('retention_cleanup_failed');
    }
  },
} satisfies ExportedHandler<Env>;
