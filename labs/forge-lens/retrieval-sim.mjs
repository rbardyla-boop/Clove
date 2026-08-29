import assert from 'node:assert/strict';
import { authorizeRetrieval, issueRetrievalGrant } from './selection-authority.mjs';
import { ForgeLensRetrievalError, retrieveAuthorized } from './bounded-retrieval.mjs';

const KEY = Buffer.from('forge-lens-lab-host-key-32-bytes-minimum!!');
const NOW = 1_788_000_000_000;
const question = 'Which selected law text should be retrieved?';
const discovery = {
  recipeId: 'canadian_law', sourceClass: 'canadian_law', status: 'DISCOVERY_COMPLETE',
  queryUsed: question,
  endpoints: ['https://laws-lois.justice.gc.ca/js/lookup_e.xml'], retrievedAt: '2026-08-29T12:00:00.000Z', errors: [],
  candidates: [{
    sourceId: 'justice-act-c-24-5', sourceClass: 'canadian_law', title: 'Cannabis Act',
    url: 'https://laws-lois.justice.gc.ca/eng/acts/C-24.5/index.html', authority: 'primary', institution: 'Department of Justice Canada',
    identifiers: { instrumentType: 'act', xmlUrl: 'https://laws-lois.justice.gc.ca/eng/XML/C-24.5.xml' },
    discoveryMethod: 'fixture', queryUsed: question,
    provenance: { provider: 'Justice Laws Website / Department of Justice Canada', retrievedAt: '2026-08-29T12:00:00.000Z', endpoint: 'https://laws-lois.justice.gc.ca/js/lookup_e.xml' },
  }],
};
const token = issueRetrievalGrant(discovery, 'justice-act-c-24-5', KEY, { nowMs: NOW, nonce: 'retrieval-sim-0001', maxBytes: 64 });
const auth = authorizeRetrieval(discovery, token, KEY, { nowMs: NOW + 1 });

async function expectCode(code, fn) {
  try {
    await fn();
  } catch (error) {
    assert(error instanceof ForgeLensRetrievalError, `expected ForgeLensRetrievalError, got ${error}`);
    assert.equal(error.code, code);
    return;
  }
  assert.fail(`expected ${code}`);
}

const tests = [
  ['R00 exact authorized target is the only fetch target', async () => {
    let observed;
    const result = await retrieveAuthorized(auth, { fetcher: async (url, init) => {
      observed = { url, init };
      return new Response('<law>ok</law>', { status: 200, headers: { 'content-type': 'application/xml', 'content-length': '13' } });
    }});
    assert.equal(observed.url, auth.targetUrl);
    assert.equal(observed.init.method, 'GET');
    assert.equal(observed.init.redirect, 'manual');
    assert.equal(result.state, 'RETRIEVAL_COMPLETE');
    assert.equal(result.provenance.contentTrust, 'UNTRUSTED_UNTIL_EXTRACTED_AND_VERIFIED');
  }],
  ['R01 caller cannot provide an alternate URL because executor accepts authority only', async () => {
    let observed;
    const attackerUrl = 'https://attacker.example/collect';
    await retrieveAuthorized(auth, { fetcher: async (url) => {
      observed = url;
      return new Response('safe', { status: 200, headers: { 'content-type': 'text/plain' } });
    }});
    assert.equal(observed, auth.targetUrl);
    assert.notEqual(observed, attackerUrl);
  }],
  ['R02 redirect response is denied before body use', async () => {
    await expectCode('redirect_denied', () => retrieveAuthorized(auth, { fetcher: async () => new Response('', { status: 302, headers: { location: 'https://attacker.example' } }) }));
  }],
  ['R03 already-followed redirect marker is denied', async () => {
    const response = new Response('safe', { status: 200, headers: { 'content-type': 'text/plain' } });
    Object.defineProperty(response, 'redirected', { value: true });
    await expectCode('redirect_followed', () => retrieveAuthorized(auth, { fetcher: async () => response }));
  }],
  ['R04 unexpected content type is denied', async () => {
    await expectCode('content_type_denied', () => retrieveAuthorized(auth, { fetcher: async () => new Response('binary', { status: 200, headers: { 'content-type': 'application/octet-stream' } }) }));
  }],
  ['R05 declared oversized response is denied', async () => {
    await expectCode('response_body_too_large', () => retrieveAuthorized(auth, { fetcher: async () => new Response('x', { status: 200, headers: { 'content-type': 'text/plain', 'content-length': '65' } }) }));
  }],
  ['R06 streaming response that exceeds the grant byte ceiling is denied', async () => {
    await expectCode('response_body_too_large', () => retrieveAuthorized(auth, { fetcher: async () => new Response('x'.repeat(65), { status: 200, headers: { 'content-type': 'text/plain' } }) }));
  }],
  ['R07 non-success source status is explicit failure', async () => {
    await expectCode('source_http_503', () => retrieveAuthorized(auth, { fetcher: async () => new Response('down', { status: 503, headers: { 'content-type': 'text/plain' } }) }));
  }],
  ['R08 timeout aborts the injected fetcher', async () => {
    await expectCode('retrieval_timeout', () => retrieveAuthorized(auth, {
      timeoutMs: 2,
      fetcher: async (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }),
    }));
  }],
];

let passed = 0;
console.log('FORGE × Clove Lens bounded retrieval simulation');
for (const [name, fn] of tests) {
  await fn();
  passed += 1;
  console.log(`PASS ${name}`);
}
console.log(`RETRIEVAL SIMULATION PASS ${passed}/${tests.length}`);
