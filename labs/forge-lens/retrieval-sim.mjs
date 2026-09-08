import assert from 'node:assert/strict';
import { authorizeRetrieval, issueRetrievalGrant } from './selection-authority.mjs';
import { createMemoryReplayGuard, ForgeLensRetrievalError, retrieveAuthorized } from './bounded-retrieval.mjs';

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

function authFor(nonce = 'retrieval-sim-0001') {
  const token = issueRetrievalGrant(discovery, 'justice-act-c-24-5', KEY, { nowMs: NOW, nonce, maxBytes: 64 });
  return authorizeRetrieval(discovery, token, KEY, { nowMs: NOW + 1 });
}

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
    const auth = authFor('retrieval-sim-0000');
    let observed;
    const result = await retrieveAuthorized(auth, { replayGuard: createMemoryReplayGuard(), fetcher: async (url, init) => {
      observed = { url, init };
      return new Response('<law>ok</law>', { status: 200, headers: { 'content-type': 'application/xml', 'content-length': '13' } });
    }});
    assert.equal(observed.url, auth.targetUrl);
    assert.equal(observed.init.method, 'GET');
    assert.equal(observed.init.redirect, 'manual');
    assert.equal(result.state, 'RETRIEVAL_COMPLETE');
    assert.equal(result.provenance.contentTrust, 'UNTRUSTED_UNTIL_EXTRACTED_AND_VERIFIED');
    assert.match(result.bodySha256, /^sha256:[0-9a-f]{64}$/);
  }],
  ['R01 caller cannot provide an alternate URL because executor accepts authority only', async () => {
    const auth = authFor('retrieval-sim-0001');
    let observed;
    const attackerUrl = 'https://attacker.example/collect';
    await retrieveAuthorized(auth, { replayGuard: createMemoryReplayGuard(), fetcher: async (url) => {
      observed = url;
      return new Response('safe', { status: 200, headers: { 'content-type': 'text/plain' } });
    }});
    assert.equal(observed, auth.targetUrl);
    assert.notEqual(observed, attackerUrl);
  }],
  ['R02 redirect response is denied before body use', async () => {
    const auth = authFor('retrieval-sim-0002');
    await expectCode('redirect_denied', () => retrieveAuthorized(auth, { replayGuard: createMemoryReplayGuard(), fetcher: async () => new Response('', { status: 302, headers: { location: 'https://attacker.example' } }) }));
  }],
  ['R03 already-followed redirect marker is denied', async () => {
    const auth = authFor('retrieval-sim-0003');
    const response = new Response('safe', { status: 200, headers: { 'content-type': 'text/plain' } });
    Object.defineProperty(response, 'redirected', { value: true });
    await expectCode('redirect_followed', () => retrieveAuthorized(auth, { replayGuard: createMemoryReplayGuard(), fetcher: async () => response }));
  }],
  ['R04 unexpected content type is denied', async () => {
    const auth = authFor('retrieval-sim-0004');
    await expectCode('content_type_denied', () => retrieveAuthorized(auth, { replayGuard: createMemoryReplayGuard(), fetcher: async () => new Response('binary', { status: 200, headers: { 'content-type': 'application/octet-stream' } }) }));
  }],
  ['R05 declared oversized response is denied', async () => {
    const auth = authFor('retrieval-sim-0005');
    await expectCode('response_body_too_large', () => retrieveAuthorized(auth, { replayGuard: createMemoryReplayGuard(), fetcher: async () => new Response('x', { status: 200, headers: { 'content-type': 'text/plain', 'content-length': '65' } }) }));
  }],
  ['R06 streaming response that exceeds the grant byte ceiling is denied', async () => {
    const auth = authFor('retrieval-sim-0006');
    await expectCode('response_body_too_large', () => retrieveAuthorized(auth, { replayGuard: createMemoryReplayGuard(), fetcher: async () => new Response('x'.repeat(65), { status: 200, headers: { 'content-type': 'text/plain' } }) }));
  }],
  ['R07 non-success source status is explicit failure', async () => {
    const auth = authFor('retrieval-sim-0007');
    await expectCode('source_http_503', () => retrieveAuthorized(auth, { replayGuard: createMemoryReplayGuard(), fetcher: async () => new Response('down', { status: 503, headers: { 'content-type': 'text/plain' } }) }));
  }],
  ['R08 timeout aborts the injected fetcher', async () => {
    const auth = authFor('retrieval-sim-0008');
    await expectCode('retrieval_timeout', () => retrieveAuthorized(auth, {
      replayGuard: createMemoryReplayGuard(),
      timeoutMs: 2,
      fetcher: async (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }),
    }));
  }],
  ['R09 exact grant is single-acquisition inside one trusted replay ledger', async () => {
    const auth = authFor('retrieval-sim-0009');
    const replayGuard = createMemoryReplayGuard();
    await retrieveAuthorized(auth, { replayGuard, fetcher: async () => new Response('first', { status: 200, headers: { 'content-type': 'text/plain' } }) });
    await expectCode('grant_replay_denied', () => retrieveAuthorized(auth, { replayGuard, fetcher: async () => new Response('second', { status: 200, headers: { 'content-type': 'text/plain' } }) }));
  }],
  ['R10 failed acquisition still consumes the one-shot grant', async () => {
    const auth = authFor('retrieval-sim-0010');
    const replayGuard = createMemoryReplayGuard();
    await expectCode('source_http_503', () => retrieveAuthorized(auth, { replayGuard, fetcher: async () => new Response('down', { status: 503, headers: { 'content-type': 'text/plain' } }) }));
    await expectCode('grant_replay_denied', () => retrieveAuthorized(auth, { replayGuard, fetcher: async () => new Response('later', { status: 200, headers: { 'content-type': 'text/plain' } }) }));
  }],
];

let passed = 0;
console.log('FORGE × Clove Lens bounded retrieval simulation');
for (const [name, fn] of tests) {
  await fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

// Negative control: an in-memory replay guard does not survive process loss. A new ledger accepts the
// same signed read grant. Production must choose durable replay state or explicitly accept retry semantics.
const restartAuth = authFor('retrieval-restart-boundary');
await retrieveAuthorized(restartAuth, { replayGuard: createMemoryReplayGuard(), fetcher: async () => new Response('first', { status: 200, headers: { 'content-type': 'text/plain' } }) });
const afterRestart = await retrieveAuthorized(restartAuth, { replayGuard: createMemoryReplayGuard(), fetcher: async () => new Response('second', { status: 200, headers: { 'content-type': 'text/plain' } }) });
assert.equal(afterRestart.state, 'RETRIEVAL_COMPLETE');
console.log('BOUNDARY R11 replay ledger lost on restart => signed read grant can be reused (EXPECTED NEGATIVE CONTROL)');

console.log(`RETRIEVAL SIMULATION PASS ${passed}/${tests.length}; 1 expected durability negative control preserved.`);
