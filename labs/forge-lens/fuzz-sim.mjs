import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { authorizeRetrieval, issueRetrievalGrant } from './selection-authority.mjs';

const KEY = Buffer.from('forge-lens-lab-host-key-32-bytes-minimum!!');
const NOW = 1_788_000_000_000;
const discovery = {
  recipeId: 'canadian_law', sourceClass: 'canadian_law', status: 'DISCOVERY_COMPLETE',
  queryUsed: 'Which selected law text should be retrieved?',
  endpoints: ['https://laws-lois.justice.gc.ca/js/lookup_e.xml'], retrievedAt: '2026-08-29T12:00:00.000Z', errors: [],
  candidates: [{
    sourceId: 'justice-act-c-24-5', sourceClass: 'canadian_law', title: 'Cannabis Act',
    url: 'https://laws-lois.justice.gc.ca/eng/acts/C-24.5/index.html', authority: 'primary', institution: 'Department of Justice Canada',
    identifiers: { instrumentType: 'act', xmlUrl: 'https://laws-lois.justice.gc.ca/eng/XML/C-24.5.xml' },
    discoveryMethod: 'fixture', queryUsed: 'Which selected law text should be retrieved?',
    provenance: { provider: 'Justice Laws Website / Department of Justice Canada', retrievedAt: '2026-08-29T12:00:00.000Z', endpoint: 'https://laws-lois.justice.gc.ca/js/lookup_e.xml' },
  }],
};
const grant = issueRetrievalGrant(discovery, 'justice-act-c-24-5', KEY, { nowMs: NOW, nonce: 'fuzz-base-0001' });
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function pick(seed, modulo) {
  const h = createHash('sha256').update(String(seed)).digest();
  return h.readUInt32BE(0) % modulo;
}
let rejected = 0;
for (let i = 0; i < 1000; i += 1) {
  const chars = [...grant];
  const idx = pick(`idx-${i}`, chars.length);
  const original = chars[idx];
  let replacement = alphabet[pick(`char-${i}`, alphabet.length)];
  if (replacement === original) replacement = alphabet[(alphabet.indexOf(replacement) + 1) % alphabet.length];
  chars[idx] = replacement;
  const mutated = chars.join('');
  try {
    authorizeRetrieval(discovery, mutated, KEY, { nowMs: NOW + 1 });
  } catch {
    rejected += 1;
  }
}
assert.equal(rejected, 1000);
console.log('FUZZ PASS 1000/1000 deterministic single-character grant mutations rejected');
