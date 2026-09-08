import { createHash } from 'node:crypto';
import { authorizeResponse, ForgeLensAuthorityError } from './selection-authority.mjs';

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_TIMEOUT_MS = 30_000;
const DEFAULT_CONTENT_TYPES = Object.freeze([
  'application/json',
  'application/xml',
  'application/xhtml+xml',
  'text/html',
  'text/plain',
  'text/xml',
]);

export function createMemoryReplayGuard() {
  const consumed = new Set();
  return Object.freeze({
    consume(nonce) {
      if (typeof nonce !== 'string' || nonce.length === 0) return false;
      if (consumed.has(nonce)) return false;
      consumed.add(nonce);
      return true;
    },
    has(nonce) { return consumed.has(nonce); },
  });
}

export class ForgeLensRetrievalError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ForgeLensRetrievalError';
    this.code = code;
  }
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function mediaType(value) {
  return String(value ?? '').split(';', 1)[0].trim().toLowerCase();
}

async function readBounded(response, maxBytes) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel('forge_lens_body_too_large');
        throw new ForgeLensRetrievalError('response_body_too_large');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

export async function retrieveAuthorized(auth, {
  fetcher = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  acceptedContentTypes = DEFAULT_CONTENT_TYPES,
  replayGuard,
} = {}) {
  if (!auth || auth.state !== 'RETRIEVAL_AUTHORIZED') {
    throw new ForgeLensRetrievalError('retrieval_not_authorized');
  }
  if (typeof auth.targetUrl !== 'string' || typeof auth.grantNonce !== 'string' || !Number.isSafeInteger(auth.maxBytes) || auth.maxBytes < 1) {
    throw new ForgeLensRetrievalError('retrieval_authority_invalid');
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new ForgeLensRetrievalError('timeout_invalid');
  }
  if (!Array.isArray(acceptedContentTypes) || acceptedContentTypes.length === 0) {
    throw new ForgeLensRetrievalError('content_type_policy_invalid');
  }
  if (!replayGuard || typeof replayGuard.consume !== 'function') {
    throw new ForgeLensRetrievalError('replay_guard_required');
  }
  // Consume before the network attempt so concurrent/replayed use fails closed.
  // Production needs a durable trusted implementation if this property must survive process loss.
  if (replayGuard.consume(auth.grantNonce) !== true) {
    throw new ForgeLensRetrievalError('grant_replay_denied');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('forge_lens_timeout'), timeoutMs);
  let response;
  try {
    try {
      response = await fetcher(auth.targetUrl, {
        method: 'GET',
        headers: { accept: acceptedContentTypes.join(',') },
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new ForgeLensRetrievalError('retrieval_timeout');
      throw new ForgeLensRetrievalError(error instanceof Error ? `retrieval_fetch_failed:${error.name}` : 'retrieval_fetch_failed');
    }

    try {
      authorizeResponse(auth, response);
    } catch (error) {
      if (error instanceof ForgeLensAuthorityError) throw new ForgeLensRetrievalError(error.code);
      throw error;
    }
    if (!response.ok) throw new ForgeLensRetrievalError(`source_http_${response.status}`);
    if (response.url && response.url !== auth.targetUrl) throw new ForgeLensRetrievalError('response_url_mismatch');

    const declared = response.headers.get('content-length');
    if (declared !== null) {
      const length = Number(declared);
      if (!Number.isSafeInteger(length) || length < 0) throw new ForgeLensRetrievalError('content_length_invalid');
      if (length > auth.maxBytes) throw new ForgeLensRetrievalError('response_body_too_large');
    }

    const contentType = mediaType(response.headers.get('content-type'));
    if (!contentType || !acceptedContentTypes.includes(contentType)) {
      throw new ForgeLensRetrievalError('content_type_denied');
    }

    const body = await readBounded(response, auth.maxBytes);
    return Object.freeze({
      state: 'RETRIEVAL_COMPLETE',
      sourceId: auth.sourceId,
      targetUrl: auth.targetUrl,
      contentType,
      bytes: body.length,
      bodySha256: sha256(body),
      body,
      provenance: Object.freeze({
        ...auth.provenance,
        contentTrust: 'UNTRUSTED_UNTIL_EXTRACTED_AND_VERIFIED',
      }),
    });
  } finally {
    clearTimeout(timer);
  }
}
