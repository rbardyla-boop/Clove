import { DiscoveryAdapterError, type DiscoveryContext, type DiscoveryFetcher } from './types';

export const DEFAULT_DISCOVERY_TIMEOUT_MS = 8_000;
export const DEFAULT_DISCOVERY_MAX_BYTES = 1_048_576;

export function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9% ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)));
}

export function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function absoluteUrl(value: string, base: string): string {
  return new URL(value, base).toString();
}

export function dateParts(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const [year, month, day] = value.map(Number);
  if (!Number.isInteger(year)) return undefined;
  if (!Number.isInteger(month)) return String(year).padStart(4, '0');
  if (!Number.isInteger(day)) return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function nowIso(context?: DiscoveryContext): string {
  return (context?.now ?? new Date()).toISOString();
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new DiscoveryAdapterError('SOURCE_UNAVAILABLE', 'response_body_too_large');
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
  return new TextDecoder().decode(bytes);
}

async function requestText(
  fetcher: DiscoveryFetcher,
  url: string,
  init: RequestInit,
  context: DiscoveryContext | undefined,
  maxBytes: number,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('discovery_timeout'), context?.timeoutMs ?? DEFAULT_DISCOVERY_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetcher(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) throw new DiscoveryAdapterError('SOURCE_UNAVAILABLE', 'source_timeout');
      throw new DiscoveryAdapterError('SOURCE_UNAVAILABLE', error instanceof Error ? error.message : 'source_fetch_failed');
    }
    if (response.status === 429 || response.status === 420) {
      throw new DiscoveryAdapterError('RATE_LIMITED', `source_http_${response.status}`);
    }
    if (!response.ok) throw new DiscoveryAdapterError('SOURCE_UNAVAILABLE', `source_http_${response.status}`);
    return await readBoundedText(response, maxBytes);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJson<T>(
  url: string,
  context: DiscoveryContext | undefined,
  options: { method?: string; body?: string; maxBytes?: number } = {},
): Promise<T> {
  const fetcher = context?.fetcher ?? fetch;
  const body = await requestText(
    fetcher,
    url,
    {
      method: options.method ?? 'GET',
      body: options.body,
      headers: {
        accept: 'application/json',
        ...(options.body ? { 'content-type': 'application/json' } : {}),
      },
    },
    context,
    options.maxBytes ?? DEFAULT_DISCOVERY_MAX_BYTES,
  );
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new DiscoveryAdapterError('SOURCE_UNAVAILABLE', 'invalid_json');
  }
}

export async function fetchText(
  url: string,
  context: DiscoveryContext | undefined,
  options: { accept?: string; maxBytes?: number } = {},
): Promise<string> {
  const fetcher = context?.fetcher ?? fetch;
  return requestText(
    fetcher,
    url,
    { headers: { accept: options.accept ?? 'text/html,application/xml,text/xml' } },
    context,
    options.maxBytes ?? DEFAULT_DISCOVERY_MAX_BYTES,
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof DiscoveryAdapterError
    ? `${error.status}:${error.message}`
    : error instanceof Error
      ? error.message
      : 'discovery_failed';
}
