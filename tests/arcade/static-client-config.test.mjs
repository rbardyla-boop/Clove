/**
 * Phase 3C — static client → Worker endpoint resolution.
 *
 * The Pages-served client must have an explicit, documented way to reach the Worker
 * WebSocket, with a safe same-origin fallback and NO hardcoded production hostname.
 * Verifies the pure resolver precedence and that the stale placeholder is gone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveWsUrl } from '../../arcade/neon-arcade-url.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('explicit wsUrl (e.g. ?ws= override) wins over everything', () => {
  assert.equal(
    resolveWsUrl({ explicit: 'ws://127.0.0.1:8787/arcade/ws', config: { wsUrl: 'wss://other/arcade/ws' }, location: { host: 'pages.app', protocol: 'https:' } }),
    'ws://127.0.0.1:8787/arcade/ws',
  );
});

test('config hook (window.__NEON_ARCADE_CONFIG__.wsUrl) is used when no explicit url', () => {
  assert.equal(
    resolveWsUrl({ config: { wsUrl: 'wss://neon-arcade-mesh.example.workers.dev/arcade/ws' }, location: { host: 'pages.app', protocol: 'https:' } }),
    'wss://neon-arcade-mesh.example.workers.dev/arcade/ws',
  );
});

test('same-origin fallback derives wss on https pages', () => {
  assert.equal(
    resolveWsUrl({ location: { host: 'arcade.example.com', protocol: 'https:' } }),
    'wss://arcade.example.com/arcade/ws',
  );
});

test('same-origin fallback derives ws on http (local dev)', () => {
  assert.equal(
    resolveWsUrl({ location: { host: 'localhost:8080', protocol: 'http:' } }),
    'ws://localhost:8080/arcade/ws',
  );
});

test('blank explicit / blank config are ignored (fall through to same-origin)', () => {
  assert.equal(
    resolveWsUrl({ explicit: '   ', config: { wsUrl: '' }, location: { host: 'z.app', protocol: 'https:' } }),
    'wss://z.app/arcade/ws',
  );
});

test('returns null when nothing is resolvable (caller fails loudly)', () => {
  assert.equal(resolveWsUrl({}), null);
  assert.equal(resolveWsUrl({ config: {}, location: null }), null);
});

test('no hardcoded/broken production hostname placeholder remains in the client', () => {
  const src = read('arcade/neon-circuit-room-client.js');
  assert.ok(!src.includes('<your-subdomain>'), 'stale <your-subdomain> placeholder must be removed');
  assert.match(src, /__NEON_ARCADE_CONFIG__/, 'client must read the documented config hook');
});

test('deploy-time config hook is documented (example file + index.html)', () => {
  const example = read('arcade/neon-arcade-config.example.js');
  assert.match(example, /window\.__NEON_ARCADE_CONFIG__/);
  assert.match(example, /wsUrl/);
  // The example is transport-only; it must not ASSIGN a secret/admin token value.
  // (Mentioning "secret"/"admin token" in the security warning prose is fine.)
  assert.ok(!/(admin[_-]?token|secret|password|api[_-]?key)\s*[:=]\s*["'`]/i.test(example),
    'example config must not assign a secret value');
  const html = read('arcade/index.html');
  assert.match(html, /__NEON_ARCADE_CONFIG__/, 'index.html should document the config hook');
});
