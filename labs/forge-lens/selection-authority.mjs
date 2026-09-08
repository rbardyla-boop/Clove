import {
  createHmac,
  createHash,
  timingSafeEqual,
} from 'node:crypto';

const TOKEN_VERSION = 1;
const TOKEN_KIND = 'FORGE_LENS_RETRIEVAL_GRANT';
const ALLOWED_DISCOVERY_STATUSES = new Set(['DISCOVERY_COMPLETE', 'RESEARCH_REQUIRED']);
export const RETRIEVAL_POLICIES = Object.freeze({
  canadian_law: Object.freeze({
    allowedOrigins: Object.freeze(['https://laws-lois.justice.gc.ca']),
    targetFields: Object.freeze(['xmlUrl', 'candidate.url']),
  }),
  official_canadian_statistic: Object.freeze({
    allowedOrigins: Object.freeze(['https://www150.statcan.gc.ca']),
    targetFields: Object.freeze(['candidate.url']),
  }),
  canadian_trade_statistic: Object.freeze({
    allowedOrigins: Object.freeze([
      'https://www.international.gc.ca',
      'https://international.canada.ca',
      'https://www150.statcan.gc.ca',
    ]),
    targetFields: Object.freeze(['dataEndpoint', 'candidate.url']),
  }),
  scientific_finding: Object.freeze({
    allowedOrigins: Object.freeze(['https://api.crossref.org']),
    targetFields: Object.freeze(['retrievalUrl']),
  }),
});
const EXACT_PAYLOAD_KEYS = Object.freeze([
  'candidateDigest',
  'discoveryDigest',
  'expiresAt',
  'issuedAt',
  'kind',
  'maxBytes',
  'nonce',
  'questionDigest',
  'redirectPolicy',
  'recipeId',
  'sourceId',
  'targetUrl',
  'version',
]);

export class ForgeLensAuthorityError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ForgeLensAuthorityError';
    this.code = code;
  }
}

function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : stable(value));
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function hmac(key, payloadText) {
  if (!Buffer.isBuffer(key) || key.length < 32) throw new ForgeLensAuthorityError('signing_key_too_short');
  return createHmac('sha256', key).update(payloadText).digest();
}

function canonicalCandidate(candidate) {
  return {
    sourceId: candidate.sourceId,
    sourceClass: candidate.sourceClass,
    title: candidate.title,
    url: candidate.url,
    authority: candidate.authority,
    institution: candidate.institution ?? null,
    publishedAt: candidate.publishedAt ?? null,
    measurementPeriod: candidate.measurementPeriod ?? null,
    currentTo: candidate.currentTo ?? null,
    doi: candidate.doi ?? null,
    identifiers: candidate.identifiers ?? {},
    discoveryMethod: candidate.discoveryMethod,
    queryUsed: candidate.queryUsed,
    provenance: candidate.provenance,
  };
}

function canonicalDiscovery(discovery) {
  return {
    recipeId: discovery.recipeId,
    sourceClass: discovery.sourceClass,
    status: discovery.status,
    queryUsed: discovery.queryUsed,
    endpoints: discovery.endpoints ?? [],
    retrievedAt: discovery.retrievedAt,
    candidates: discovery.candidates.map(canonicalCandidate),
  };
}

function uniqueCandidate(discovery, sourceId) {
  const matches = discovery.candidates.filter((candidate) => candidate.sourceId === sourceId);
  if (matches.length === 0) throw new ForgeLensAuthorityError('candidate_not_found');
  if (matches.length !== 1) throw new ForgeLensAuthorityError('candidate_id_ambiguous');
  return matches[0];
}

function targetFor(discovery, candidate) {
  const policy = RETRIEVAL_POLICIES[discovery.recipeId];
  if (!policy) throw new ForgeLensAuthorityError('retrieval_policy_not_registered');
  let rawTarget;
  for (const field of policy.targetFields) {
    if (field === 'candidate.url') {
      if (candidate.url) { rawTarget = candidate.url; break; }
    } else if (candidate.identifiers?.[field]) {
      rawTarget = candidate.identifiers[field];
      break;
    }
  }
  if (!rawTarget) throw new ForgeLensAuthorityError('direct_retrieval_target_not_discovered');
  let url;
  try {
    url = new URL(rawTarget);
  } catch {
    throw new ForgeLensAuthorityError('candidate_url_invalid');
  }
  if (url.protocol !== 'https:') throw new ForgeLensAuthorityError('candidate_url_not_https');
  if (url.username || url.password) throw new ForgeLensAuthorityError('candidate_url_has_credentials');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host === '::1' || host === '[::1]' || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new ForgeLensAuthorityError('candidate_url_private_network');
  }
  if (!policy.allowedOrigins.includes(url.origin)) throw new ForgeLensAuthorityError('candidate_origin_not_allowed');
  return url.toString();
}

function assertDiscoveryEligible(discovery) {
  if (!discovery || typeof discovery !== 'object' || !Array.isArray(discovery.candidates)) {
    throw new ForgeLensAuthorityError('discovery_invalid');
  }
  if (!ALLOWED_DISCOVERY_STATUSES.has(discovery.status)) {
    throw new ForgeLensAuthorityError('discovery_not_selection_eligible');
  }
  if (typeof discovery.queryUsed !== 'string' || discovery.queryUsed.length === 0) {
    throw new ForgeLensAuthorityError('discovery_question_missing');
  }
  if (typeof discovery.recipeId !== 'string' || discovery.recipeId.length === 0) {
    throw new ForgeLensAuthorityError('discovery_recipe_missing');
  }
}

function decodeToken(token) {
  if (typeof token !== 'string') throw new ForgeLensAuthorityError('grant_missing');
  const parts = token.split('.');
  if (parts.length !== 2) throw new ForgeLensAuthorityError('grant_malformed');
  let payloadText;
  let signature;
  try {
    payloadText = Buffer.from(parts[0], 'base64url').toString('utf8');
    signature = Buffer.from(parts[1], 'base64url');
  } catch {
    throw new ForgeLensAuthorityError('grant_malformed');
  }
  let payload;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    throw new ForgeLensAuthorityError('grant_payload_invalid');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ForgeLensAuthorityError('grant_payload_invalid');
  }
  const keys = Object.keys(payload).sort();
  if (stable(keys) !== stable([...EXACT_PAYLOAD_KEYS].sort())) {
    throw new ForgeLensAuthorityError('grant_payload_shape_invalid');
  }
  return { payload, payloadText, signature };
}

export function issueRetrievalGrant(discovery, sourceId, key, {
  nowMs,
  ttlMs = 5 * 60_000,
  nonce,
  maxBytes = 1_048_576,
} = {}) {
  assertDiscoveryEligible(discovery);
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new ForgeLensAuthorityError('issued_time_invalid');
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 15 * 60_000) throw new ForgeLensAuthorityError('ttl_invalid');
  if (typeof nonce !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(nonce)) throw new ForgeLensAuthorityError('nonce_invalid');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 8 * 1024 * 1024) throw new ForgeLensAuthorityError('max_bytes_invalid');

  const candidate = uniqueCandidate(discovery, sourceId);
  const targetUrl = targetFor(discovery, candidate);

  const payload = {
    version: TOKEN_VERSION,
    kind: TOKEN_KIND,
    questionDigest: sha256(discovery.queryUsed),
    recipeId: discovery.recipeId,
    discoveryDigest: sha256(canonicalDiscovery(discovery)),
    sourceId: candidate.sourceId,
    candidateDigest: sha256(canonicalCandidate(candidate)),
    targetUrl,
    redirectPolicy: 'DENY',
    issuedAt: nowMs,
    expiresAt: nowMs + ttlMs,
    nonce,
    maxBytes,
  };
  const payloadText = stable(payload);
  const signature = hmac(key, payloadText);
  return `${Buffer.from(payloadText).toString('base64url')}.${signature.toString('base64url')}`;
}

export function authorizeRetrieval(discovery, token, key, { nowMs } = {}) {
  assertDiscoveryEligible(discovery);
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new ForgeLensAuthorityError('validation_time_invalid');
  const { payload, payloadText, signature } = decodeToken(token);
  const expected = hmac(key, payloadText);
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    throw new ForgeLensAuthorityError('grant_signature_invalid');
  }
  if (payload.version !== TOKEN_VERSION || payload.kind !== TOKEN_KIND) throw new ForgeLensAuthorityError('grant_domain_invalid');
  if (!Number.isSafeInteger(payload.issuedAt) || !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= payload.issuedAt) {
    throw new ForgeLensAuthorityError('grant_time_invalid');
  }
  if (nowMs < payload.issuedAt) throw new ForgeLensAuthorityError('grant_not_yet_valid');
  if (nowMs > payload.expiresAt) throw new ForgeLensAuthorityError('grant_expired');
  if (payload.questionDigest !== sha256(discovery.queryUsed)) throw new ForgeLensAuthorityError('question_binding_mismatch');
  if (payload.recipeId !== discovery.recipeId) throw new ForgeLensAuthorityError('recipe_binding_mismatch');
  if (payload.discoveryDigest !== sha256(canonicalDiscovery(discovery))) throw new ForgeLensAuthorityError('discovery_binding_mismatch');

  const candidate = uniqueCandidate(discovery, payload.sourceId);
  if (payload.candidateDigest !== sha256(canonicalCandidate(candidate))) throw new ForgeLensAuthorityError('candidate_binding_mismatch');
  const targetUrl = targetFor(discovery, candidate);
  if (payload.targetUrl !== targetUrl) throw new ForgeLensAuthorityError('target_binding_mismatch');
  if (payload.redirectPolicy !== 'DENY') throw new ForgeLensAuthorityError('redirect_policy_invalid');

  return Object.freeze({
    state: 'RETRIEVAL_AUTHORIZED',
    sourceId: candidate.sourceId,
    targetUrl,
    maxBytes: payload.maxBytes,
    grantExpiresAt: payload.expiresAt,
    grantNonce: payload.nonce,
    redirectPolicy: 'DENY',
    provenance: Object.freeze({
      sourceClass: candidate.sourceClass,
      sourceAuthority: candidate.authority,
      provider: candidate.provenance.provider,
      discoveryEndpoint: candidate.provenance.endpoint,
      discoveryRetrievedAt: candidate.provenance.retrievedAt,
      contentTrust: 'UNTRUSTED_UNTIL_EXTRACTED_AND_VERIFIED',
    }),
  });
}

export function grantDebugDigest(token) {
  return sha256(token);
}

export function authorizeResponse(auth, response) {
  if (!auth || auth.state !== 'RETRIEVAL_AUTHORIZED') throw new ForgeLensAuthorityError('retrieval_not_authorized');
  if (!response || typeof response.status !== 'number') throw new ForgeLensAuthorityError('response_invalid');
  if (response.status >= 300 && response.status < 400) throw new ForgeLensAuthorityError('redirect_denied');
  if (response.redirected === true) throw new ForgeLensAuthorityError('redirect_followed');
  return true;
}
