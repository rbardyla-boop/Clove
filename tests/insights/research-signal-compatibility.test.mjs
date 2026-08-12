import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const LIVE = process.env.LIVE_INSIGHTS_RESEARCH === '1';
const BASE_URL = process.env.CLOVE_BASE_URL || 'https://clovelearn.io';
const RESEARCH_EVENTS = [
  'research_opened',
  'research_submitted',
  'research_completed',
  'research_insufficient',
  'source_inspected',
  'challenge_opened',
  'research_exported',
];
const POPULATION_QUESTION = "What was Canada's population in the latest complete annual period?";

function coarseSignal(event) {
  return {
    event,
    surface: 'research',
    device: 'desktop',
    returnBucket: 'new',
    referrerGroup: 'direct',
    build: 'current',
    variant: 'none',
    detail: 'none',
    diagnostic: 'none',
  };
}

async function postSignal(body, origin = BASE_URL) {
  const response = await fetch(`${BASE_URL}/__clove/signal`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

async function waitForCount(values, count) {
  const started = Date.now();
  while (values.length < count && Date.now() - started < 90_000) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(values.length >= count, `expected ${count} signal responses, saw ${values.length}`);
}

test('production Insights accepts only the bounded research signal contract', { skip: !LIVE, timeout: 180_000 }, async () => {
  for (const event of RESEARCH_EVENTS) {
    const result = await postSignal(coarseSignal(event));
    assert.equal(result.response.status, 202, `${event} should be accepted`);
    assert.deepEqual(result.body, { ok: true });
  }

  for (const event of ['site_opened', 'game_completed']) {
    const result = await postSignal({ ...coarseSignal(event), surface: event === 'site_opened' ? 'home' : 'echo_bloom' });
    assert.equal(result.response.status, 202, `${event} should remain accepted`);
  }

  const unknown = await postSignal({ ...coarseSignal('research_topic_viewed'), question: 'sentinel question' });
  assert.equal(unknown.response.status, 400);

  const privateFields = await postSignal({
    ...coarseSignal('research_completed'),
    question: 'SENTINEL_QUESTION_MUST_NOT_PERSIST',
    answer: 'SENTINEL_ANSWER_MUST_NOT_PERSIST',
    sourceUrl: 'https://example.invalid/sentinel-source',
    claim: 'SENTINEL_CLAIM_MUST_NOT_PERSIST',
    topic: 'sentinel-topic',
    obsidianContents: '# SENTINEL_EXPORT_MUST_NOT_PERSIST',
    identifier: 'sentinel-user-id',
    ip: '192.0.2.1',
    fullReferrer: 'https://example.invalid/private-referrer',
  });
  assert.equal(privateFields.response.status, 202);
  assert.deepEqual(privateFields.body, { ok: true });

  const badOrigin = await postSignal(coarseSignal('research_completed'), 'https://example.invalid');
  assert.equal(badOrigin.response.status, 403);
});

test('production research browser emits accepted coarse events on desktop and honors GPC/DNT', { skip: !LIVE, timeout: 180_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const signalStatuses = [];
    const externalHosts = [];
    page.on('response', (response) => {
      if (new URL(response.url()).pathname === '/__clove/signal') signalStatuses.push(response.status());
    });
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.hostname !== 'clovelearn.io' && !url.hostname.endsWith('.clovelearn.io') && url.hostname !== 'static.cloudflareinsights.com') {
        externalHosts.push(url.hostname);
      }
    });

    const pageResponse = await page.goto(`${BASE_URL}/research/`, { waitUntil: 'domcontentloaded' });
    assert.equal(pageResponse?.status(), 200);
    await page.locator('#question').fill(POPULATION_QUESTION);
    await page.locator('#investigate').click();
    await page.locator('[data-testid="research-status"]').waitFor({ state: 'visible', timeout: 90_000 });
    assert.equal(await page.locator('[data-testid="research-status"]').innerText(), 'QUALIFIED');
    await waitForCount(signalStatuses, 4);

    await page.getByRole('button', { name: 'SHOW ME THE SOURCE' }).click();
    await page.getByRole('button', { name: 'CHALLENGE THIS' }).click();
    await page.locator('#action-note').filter({ hasText: /Independent population challenger/ }).waitFor({ timeout: 90_000 });
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'EXPORT RESEARCH' }).click();
    assert.equal((await downloadPromise).suggestedFilename(), 'clove-research-export.md');
    await waitForCount(signalStatuses, 7);
    assert.deepEqual(signalStatuses, signalStatuses.map(() => 202));
    assert.deepEqual(externalHosts, []);
    await context.close();

    const privacyContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await privacyContext.addInitScript(() => {
      Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, get: () => true });
      Object.defineProperty(navigator, 'doNotTrack', { configurable: true, get: () => '1' });
    });
    const privacyPage = await privacyContext.newPage();
    const privacySignals = [];
    privacyPage.on('response', (response) => {
      if (new URL(response.url()).pathname === '/__clove/signal') privacySignals.push(response.status());
    });
    await privacyPage.goto(`${BASE_URL}/research/`, { waitUntil: 'domcontentloaded' });
    await new Promise((resolve) => setTimeout(resolve, 800));
    assert.deepEqual(privacySignals, []);
    await privacyContext.close();
  } finally {
    await browser.close();
  }
});
