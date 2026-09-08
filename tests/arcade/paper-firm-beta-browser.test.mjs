import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = new URL('../../arcade/paper-firm/', import.meta.url);
const screenshotDir = process.env.PAPER_FIRM_SCREENSHOT_DIR
  || fileURLToPath(new URL('../../proof/screenshots/', import.meta.url));
mkdirSync(screenshotDir, { recursive: true });
const files = new Map();
const sourceRoot = fileURLToPath(root);
const collectFiles = (dir, prefix = '') => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = `${prefix}/${name}`;
    if (statSync(path).isDirectory()) collectFiles(path, rel);
    else files.set(rel, readFileSync(path));
  }
};
collectFiles(sourceRoot);

function contentType(pathname) {
  if (pathname.endsWith('.html')) return 'text/html';
  if (pathname.endsWith('.css')) return 'text/css';
  if (pathname.endsWith('.ttf')) return 'font/ttf';
  if (pathname.endsWith('.txt')) return 'text/plain';
  return 'application/javascript';
}

const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const body = files.get(pathname.replace('/arcade/paper-firm', '') || '/index.html');
  if (!body) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': contentType(pathname) }); res.end(body);
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(8084, '127.0.0.1', resolve);
});
after(() => server.close());

// Deterministic software GPU in QA; these timings are not Pixel GPU measurements.
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
after(() => browser.close());

const initialPaper = {
  packets: [], currentPacketId: '', currentPacketDelivered: false, builderOperated: false,
  observationId: '', sourceVerified: false, doctrineId: '', requirementRevision: 'R1',
  humanOffline: false, readyToSign: false, complete: false, harnessPassed: false,
  workerReplacements: 0, ancestryRetrieved: false, submittedFindings: [],
};
const field = {
  protocol: 'PF-FIELD/1', world: { w: 1000, h: 700 },
  zones: [
    { id: 'DESK', x: 70, y: 470, w: 240, h: 150, label: 'THE DESK' },
    { id: 'STAIN', x: 390, y: 70, w: 220, h: 220, label: 'THE STAIN' },
    { id: 'ARCHIVE', x: 690, y: 70, w: 230, h: 210, label: 'ARCHIVE' },
  ],
  relay: { id: 'RELAY', x: 715, y: 455, w: 160, h: 170 },
  players: [{ id: 'qa-human-a', x: 145, y: 390 }],
  scout: { phase: 'idle', x: 500, y: 170 },
  page: { id: 'PAGE-7', phase: 'in_stain', x: 500, y: 170 },
};

async function openPage(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack || String(error)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`${msg.text()} ${JSON.stringify(msg.location())}`); });
  await page.addInitScript(({ paper, fieldState }) => {
    const nativeFetch = window.fetch.bind(window);
    let role = 'lead';
    let ws;
    const requests = [];
    const snapshot = () => ({ ok: true, code: 'QA-BETA', role, me: 'qa-human-a', members: [], paper, whileYouWereGone: { relayRepair: 'OPEN', workerReplaced: 0, findingsRejected: 0, ready: 'OPEN' }, head: 'qa-head' });
    // Test-process-only fixtures. Never installed by the game or a live server.
    window.__qaFixture = {
      requests,
      update(next) { paper = { ...paper, ...next }; },
      role(next) { role = next; },
      field(next) { fieldState = { ...fieldState, ...next }; ws?.emit('message', { data: JSON.stringify({ t: 'pf_snapshot', ...fieldState }) }); },
    };
    window.fetch = async (input, init = {}) => {
      const requestUrl = typeof input === 'string' ? input : input?.url || '';
      if (!requestUrl.includes('/api/paper-firm')) return nativeFetch(input, init);
      const body = JSON.parse(init.body || '{}');
      const action = body.action;
      requests.push(body);
      const value = action === 'field_ticket' ? { ok: true, ticket: 'qa-ticket' } : snapshot();
      return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    class QAWebSocket {
      static OPEN = 1;
      constructor() { ws = this; this.readyState = QAWebSocket.OPEN; this.listeners = {}; setTimeout(() => this.emit('open', {}), 0); }
      addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
      emit(name, data) { for (const fn of this.listeners[name] || []) fn(data); }
      send(raw) { const msg = JSON.parse(raw); requests.push(msg); if (msg.t === 'pf_join' || msg.t === 'pf_snapshot_request') this.emit('message', { data: JSON.stringify({ t: 'pf_snapshot', ...fieldState }) }); }
      close() { this.readyState = 3; this.emit('close', {}); }
    }
    window.WebSocket = QAWebSocket;
  }, { paper: initialPaper, fieldState: field });
  await page.goto('http://127.0.0.1:8084/arcade/paper-firm/index.html?match=QA-BETA&rug=http://127.0.0.1:8084');
  await page.locator('#match-id').fill('QA-BETA');
  await page.locator('#paper-world').waitFor({ state: 'visible' });
  await page.waitForFunction(() => window.__paperFirmRenderer?.triangles > 0);
  return { context, page, errors };
}

test('beta page renders the dimensional ruled-paper world on desktop and mobile', async (t) => {
  for (const [label, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const { context, page, errors } = await openPage(viewport);
    t.after(() => context.close());
    assert.equal(await page.title(), 'Paper Firm — First Shift');
    assert.equal(await page.locator('#paper-objective h1').isVisible(), true);
    assert.equal(await page.locator('#paper-world').isVisible(), true, `${label} canvas visible`);
    const scene = await page.locator('#paper-world').evaluate((canvas) => {
      const gl = canvas.getContext('webgl2');
      if (!gl) return { supported: false };
      return { supported: true, width: canvas.width, height: canvas.height, version: gl.getParameter(gl.VERSION) };
    });
    assert.equal(scene.supported, true, `${label} has a WebGL context`);
    assert.ok(scene.width > 0 && scene.height > 0, `${label} canvas has backing pixels`);
    const metrics = await page.evaluate(() => ({ ...window.__paperFirmRenderer }));
    assert.ok(metrics.meshCount >= 10 && metrics.triangles > 100, 'actual scene geometry rendered');
    assert.equal(metrics.camera.mode, 'perspective-orbit');
    const rendered = await page.locator('#paper-world').screenshot();
    assert.ok(rendered.length > 2_000, `${label} produced a non-empty rendered canvas screenshot`);
    const beforeOrbit = await page.locator('#paper-world').screenshot();
    const beforeAngle = metrics.camera.angle;
    await page.locator('#paper-world').hover({ position: { x: Math.round(viewport.width * 0.45), y: Math.round(viewport.height * 0.45) } });
    await page.mouse.down();
    await page.mouse.move(Math.round(viewport.width * 0.65), Math.round(viewport.height * 0.45), { steps: 4 });
    await page.mouse.up();
    const afterOrbit = await page.locator('#paper-world').screenshot();
    assert.notDeepEqual(afterOrbit, beforeOrbit, `${label} camera orbit changes perspective`);
    assert.notEqual(await page.evaluate(() => window.__paperFirmRenderer.camera.angle), beforeAngle);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, `${label} no horizontal overflow`);
    await page.screenshot({ path: join(screenshotDir, `paper-firm-source-${label}-marks.png`), fullPage: true });
    assert.deepEqual(errors, [], `${label} browser console is clean`);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(50);
    await page.screenshot({ path: join(screenshotDir, `paper-firm-source-${label}-far.png`), fullPage: true });
    await page.mouse.wheel(0, -1400);
    await page.waitForTimeout(50);
    await page.screenshot({ path: join(screenshotDir, `paper-firm-source-${label}-near.png`), fullPage: true });
  }
});

test('QA fixture exposes the next-step gate and touch controls without asserting protocol proof', async (t) => {
  const { context, page, errors } = await openPage({ width: 390, height: 844 });
  t.after(() => context.close());
  await page.getByRole('button', { name: 'ENTER THE PAGE' }).click();
  await page.locator('#field-controls').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#primary-cta').isDisabled(), true);
  assert.match(await page.locator('#primary-cta').getAttribute('aria-label'), /Stain/i);
  await page.getByRole('button', { name: 'MORE', exact: true }).click();
  assert.equal(await page.locator('[data-touch-key="arrowup"]').isVisible(), true);
  assert.equal(await page.locator('#scout-find').isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  assert.deepEqual(errors, []);
});

test('isolated browser fixture exercises FIND and RETURN before SIGN, then real outcome UI', async (t) => {
  const { context, page, errors } = await openPage({ width: 390, height: 844 });
  t.after(() => context.close());
  await page.clock.install();
  await page.getByRole('button', { name: 'ENTER THE PAGE' }).click();
  await page.locator('#field-controls').waitFor({ state: 'visible' });
  await page.evaluate(() => window.__qaFixture.field({ players: [{ id: 'qa-human-a', x: 500, y: 170 }] }));
  await page.locator('#primary-cta').click();
  assert.ok(await page.evaluate(() => window.__qaFixture.requests.some((r) => r.t === 'pf_scout' && r.verb === 'find')));
  const ready = {
    requirementRevision: 'R2', readyToSign: true, harnessPassed: true, harnessBeforeMorning: true,
    relayHash: 'a'.repeat(64), relayRevision: 'R2', harnessProofId: '00000000-0000-4000-8000-000000000001',
    readyTuple: { artifactHash: 'a'.repeat(64), requirementRevision: 'R2', proofId: '00000000-0000-4000-8000-000000000001' },
    humanOffline: true, offlineAtSeq: 10, sourceVerified: true, builderOperated: true,
    ancestryRetrieved: true, submittedFindings: [{ status: 'rejected' }],
  };
  await page.evaluate((next) => window.__qaFixture.update(next), ready);
  await page.clock.fastForward(12_001);
  await page.waitForFunction(() => document.querySelector('#primary-cta').textContent.includes('RETURN'));
  await page.locator('#primary-cta').click();
  assert.ok(await page.evaluate(() => window.__qaFixture.requests.some((r) => r.action === 'rejoin')));
  assert.equal(await page.evaluate(() => window.__qaFixture.requests.some((r) => r.action === 'sign')), false);
  await page.evaluate(() => window.__qaFixture.update({ humanOffline: false, rejoinedAtSeq: 20 }));
  await page.clock.fastForward(12_001);
  await page.waitForFunction(() => document.querySelector('#primary-cta').textContent.includes('SIGN RELAY'));
  await page.locator('#toggle-desk').click();
  assert.equal(await page.locator('#paper-return').isVisible(), true);
  await page.clock.fastForward(12_001);
  assert.equal(await page.locator('#overnight').isVisible(), false);
  await page.locator('#toggle-desk').click();
  await page.locator('#primary-cta').click();
  assert.ok(await page.evaluate(() => window.__qaFixture.requests.some((r) => r.action === 'sign')));
  // Only the fixture supplies completion: clicking SIGN alone never awards it.
  assert.notEqual(await page.locator('#paper-endgame').getAttribute('data-state'), 'won');
  await page.evaluate(() => window.__qaFixture.update({ complete: true, signed: true }));
  await page.clock.fastForward(12_001);
  await page.waitForFunction(() => document.querySelector('#paper-endgame').dataset.state === 'won');
  assert.equal(await page.locator('#paper-endgame').evaluate((el) => el.scrollWidth <= el.clientWidth), true, 'full hash and proof ID fit mobile card');
  await page.clock.resume();
  await page.locator('#paper-world').dispatchEvent('wheel', { deltaY: -10 });
  assert.ok(await page.evaluate(() => window.__paperFirmRenderer.drawCalls > 0));
  await page.screenshot({ path: join(screenshotDir, 'paper-firm-mobile-endgame-fixture.png'), fullPage: true });
  assert.equal(await page.locator('#another-world').getAttribute('href'), './');
  await page.evaluate(() => window.__qaFixture.update({ signedLate: true }));
  await page.clock.fastForward(12_001);
  await page.waitForFunction(() => document.querySelector('#paper-endgame').dataset.state === 'late');
  await page.evaluate(() => window.__qaFixture.update({ complete: false, signed: false, readyToSign: false, deadlineAt: 1 }));
  await page.clock.fastForward(12_001);
  await page.waitForFunction(() => document.querySelector('#paper-endgame').dataset.state === 'expired');
  assert.deepEqual(errors, []);
});

test('Desk browser fixture requires R2 and a fresh replacement package before delivery', async (t) => {
  const { context, page, errors } = await openPage({ width: 1440, height: 900 });
  t.after(() => context.close());
  await page.clock.install();
  await page.evaluate(() => {
    window.__qaFixture.role('hand');
    window.__qaFixture.update({ observationId: 'qa-obs', sourceVerified: true, doctrineId: 'qa-doctrine',
      initialBuilderOperated: true, humanOffline: true,
      packets: [{ packetId: 'P1', requirementRevision: 'R1', delivered: true, packetCreatedSeq: 2 }] });
  });
  await page.getByRole('button', { name: 'ENTER THE PAGE' }).click();
  await page.waitForFunction(() => document.querySelector('#primary-cta').textContent.includes('CHANGE REQUIREMENT'));
  await page.locator('#primary-cta').click();
  assert.ok(await page.evaluate(() => window.__qaFixture.requests.some((r) => r.action === 'change_requirement' && r.revision === 'R2')));
  await page.evaluate(() => window.__qaFixture.update({ requirementRevision: 'R2', workerReplacements: 1,
    workerReplacementSeqs: [20], revisedBuilderOperated: true,
    packets: [{ packetId: 'P2', requirementRevision: 'R2', delivered: true, packetCreatedSeq: 10 }] }));
  await page.clock.fastForward(12_001);
  await page.waitForFunction(() => document.querySelector('#primary-cta').textContent.includes('PACKAGE REPLACEMENT'));
  await page.locator('#primary-cta').click();
  assert.ok(await page.evaluate(() => window.__qaFixture.requests.some((r) => r.action === 'package')));
  await page.evaluate(() => window.__qaFixture.update({ packets: [{ packetId: 'P3', requirementRevision: 'R2', delivered: false, packetCreatedSeq: 21 }] }));
  await page.clock.fastForward(12_001);
  await page.waitForFunction(() => document.querySelector('#primary-cta').textContent.includes('DELIVER'));
  await page.locator('#primary-cta').click();
  assert.ok(await page.evaluate(() => window.__qaFixture.requests.some((r) => r.action === 'deliver' && r.packetId === 'P3')));
  assert.deepEqual(errors, []);
});

test('3D art fixture shows evidence marks and reuses GPU resources across updates', async (t) => {
  const { context, page, errors } = await openPage({ width: 1440, height: 900 });
  t.after(() => context.close());
  const result = await page.evaluate(async (fieldState) => {
    const { createPaperRenderer } = await import('/arcade/paper-firm/paper-renderer.mjs');
    const canvas = document.createElement('canvas');
    canvas.id = 'qa-art-canvas';
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:100';
    document.body.append(canvas);
    const renderer = createPaperRenderer(canvas);
    const state = { field: fieldState, angle: -0.68, zoom: 1.25, paper: {
      sourceVerified: true, builderOperated: true, ancestryRetrieved: true, harnessPassed: true,
      rejectedFindings: [{ findingId: 'qa-rejected-online', reason: 'missing_ancestry' }],
    }, gone: { findingsRejected: 0 } };
    renderer.draw(state);
    const before = renderer.diagnostics.resources;
    for (let i = 0; i < 40; i++) renderer.draw({ ...state, angle: -0.68 + i * 0.0001,
      field: { ...fieldState, players: [{ id: `qa-rotating-${i}`, x: 145, y: 390 }] } });
    window.__qaArt = { renderer, state };
    return { before, after: renderer.diagnostics.resources, marks: renderer.diagnostics.marks };
  }, field);
  assert.deepEqual(result.before, result.after, 'no geometry/texture growth after forty departed player IDs');
  assert.equal(result.marks.check, true);
  assert.equal(result.marks.rejectX, true);
  assert.equal(result.marks.ancestry, true);
  assert.equal(result.marks.tape, true);
  await page.screenshot({ path: join(screenshotDir, 'paper-firm-art-evidence-fixture.png') });
  await page.evaluate(() => { window.__qaArt.renderer.dispose(); document.querySelector('#qa-art-canvas').remove(); });
  assert.deepEqual(errors, []);
});

test('idle world redraws after an actual WebGL context restoration without user input', async (t) => {
  const { context, page, errors } = await openPage({ width: 390, height: 844 });
  t.after(() => context.close());
  await page.evaluate(() => new Promise((resolve) => {
    const canvas = document.querySelector('#paper-world');
    const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('context-loss test extension unavailable');
    window.__qaRestoreContext = () => extension.restoreContext();
    canvas.addEventListener('webglcontextlost', resolve, { once: true });
    extension.loseContext();
  }));
  await page.waitForTimeout(100);
  await page.evaluate(() => new Promise((resolve) => {
    document.querySelector('#paper-world').addEventListener('webglcontextrestored', resolve, { once: true });
    window.__qaRestoreContext();
  }));
  await page.waitForFunction(() => window.__paperFirmRenderer.triangles > 100, null, { timeout: 2000 });
  assert.deepEqual(errors, []);
});

test('required renderer failure stays visible and prevents admission to a blank world', async (t) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  t.after(() => context.close());
  const page = await context.newPage();
  const apiRequests = [];
  page.on('request', (request) => { if (request.url().includes('/api/paper-firm')) apiRequests.push(request.url()); });
  await page.route('**/paper-renderer.mjs', (route) => route.fulfill({ contentType: 'application/javascript', body: 'throw new Error("QA renderer failure");' }));
  await page.goto('http://127.0.0.1:8084/arcade/paper-firm/index.html');
  await page.locator('#renderer-error').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#connect-btn').isDisabled(), true);
  await page.locator('#connect-btn').evaluate((button) => button.click());
  assert.equal(await page.locator('#renderer-error').isVisible(), true);
  assert.deepEqual(apiRequests, []);
});

test('production upload renders Paper Firm on desktop and mobile with no missing imports', async (t) => {
  const repo = fileURLToPath(new URL('../../', import.meta.url));
  const output = mkdtempSync(join(tmpdir(), 'paper-firm-upload-qa-'));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  let packagerError = '';
  try {
    execFileSync(process.execPath, ['scripts/build-production-upload.mjs', '--out', output], {
      cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    packagerError = `${error.stdout || ''}${error.stderr || ''}`;
  }
  assert.equal(packagerError, '', `production upload packaging failed:\n${packagerError}`);

  await new Promise((resolve) => server.close(resolve));
  const packagedFiles = new Map();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else packagedFiles.set(`/${relative(join(output, 'arcade/paper-firm'), path).replaceAll('\\', '/')}`, path);
    }
  };
  walk(join(output, 'arcade/paper-firm'));
  const packagedServer = createServer((req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    const file = packagedFiles.get(decodeURIComponent(pathname.replace('/arcade/paper-firm', '')));
    if (!file) { res.writeHead(404); res.end('not found'); return; }
    const type = pathname.endsWith('.html') ? 'text/html' : pathname.endsWith('.css') ? 'text/css'
      : pathname.endsWith('.ttf') ? 'font/ttf' : pathname.endsWith('.txt') ? 'text/plain'
      : 'application/javascript';
    res.writeHead(200, { 'content-type': type }); res.end(readFileSync(file));
  });
  await new Promise((resolve, reject) => {
    packagedServer.once('error', reject);
    packagedServer.listen(8084, '127.0.0.1', resolve);
  });
  t.after(() => packagedServer.close());

  for (const [label, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    const badResponses = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.pathname.includes('/arcade/paper-firm/')) {
        const type = response.headers()['content-type'] || '';
        const expected = contentType(url.pathname);
        if (response.status() >= 400 || !type.startsWith(expected)) badResponses.push(`${response.status()} ${url.pathname} content-type=${type} expected=${expected}`);
      }
    });
    await page.goto('http://127.0.0.1:8084/arcade/paper-firm/index.html');
    await page.locator('#paper-world').waitFor({ state: 'visible' });
    await page.waitForFunction(() => window.__paperFirmRenderer?.triangles > 0);
    const scene = await page.locator('#paper-world').evaluate((canvas) => {
      const gl = canvas.getContext('webgl2');
      if (!gl) return { webgl2: false };
      const before = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, before);
      return { webgl2: true, width: canvas.width, height: canvas.height, before: [...before] };
    });
    assert.equal(scene.webgl2, true, `${label} packaged page has WebGL2`);
    assert.ok(scene.width > 0 && scene.height > 0, `${label} packaged canvas has pixels`);
    assert.deepEqual(badResponses, [], `${label} packaged asset responses are clean`);
    assert.deepEqual(errors, [], `${label} packaged browser console is clean`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, `${label} no horizontal overflow`);
    await page.screenshot({ path: join(screenshotDir, `paper-firm-packaged-${label}-marks.png`), fullPage: true });
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(50);
    await page.screenshot({ path: join(screenshotDir, `paper-firm-packaged-${label}-far.png`), fullPage: true });
    await page.mouse.wheel(0, -1400);
    await page.waitForTimeout(50);
    await page.screenshot({ path: join(screenshotDir, `paper-firm-packaged-${label}-near.png`), fullPage: true });
    await context.close();
  }
});
