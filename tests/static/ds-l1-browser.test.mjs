import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';

const files = {
  html: await readFile(new URL('../../digital-stewardship.html', import.meta.url), 'utf8'),
  content: await readFile(new URL('../../digital-stewardship-content.js', import.meta.url), 'utf8'),
  runtime: await readFile(new URL('../../digital-stewardship.js', import.meta.url), 'utf8'),
};
const engine = process.env.DS_BROWSER === 'firefox' ? 'firefox' : 'chromium';

function serverFor() {
  const server = createServer((req, res) => {
    const body = req.url === '/' || req.url === '/digital-stewardship.html' ? files.html
      : req.url === '/digital-stewardship-content.js' ? files.content
        : req.url === '/digital-stewardship.js' ? files.runtime : null;
    if (body !== null) { res.writeHead(200, { 'content-type': req.url.endsWith('.js') ? 'text/javascript' : 'text/html' }); res.end(body); return; }
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    res.writeHead(404); res.end();
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

async function launch() { return engine === 'firefox' ? firefox.launch({ headless: true }) : chromium.launch({ headless: true }); }
async function choose(page, name) { await page.getByRole('button', { name, exact: true }).click(); }

test(`Lighthouse home exposes five areas, incidents, guides, and mobile keyboard basics (${engine})`, { concurrency: false }, async (t) => {
  const browser = await launch(); t.after(() => browser.close());
  const { server, origin } = await serverFor(); t.after(() => new Promise((resolve) => server.close(resolve)));
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(`${origin}/digital-stewardship.html`);
  assert.equal(await page.locator('[data-area]').count(), 5);
  assert.equal(await page.locator('details.guide').count(), 18);
  assert.equal(await page.locator('#incidentActions button').count(), 8);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  await page.locator('#incidentActions button').first().focus();
  assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'I CLICKED SOMETHING');
  await page.keyboard.press('Enter');
  assert.match(await page.locator('#incidentPanel').innerText(), /Contain/);
});

test(`reported action and inspected state remain separate and local (${engine})`, { concurrency: false }, async (t) => {
  const browser = await launch(); t.after(() => browser.close());
  const { server, origin } = await serverFor(); t.after(() => new Promise((resolve) => server.close(resolve)));
  const context = await browser.newContext(); t.after(() => context.close());
  const page = await context.newPage(); await page.goto(`${origin}/digital-stewardship.html`);
  await page.locator('#guide-primary-email summary').click();
  await page.locator('#guide-primary-email .guide-action.attest').click();
  assert.match(await page.locator('#guide-primary-email .guide-status').innerText(), /ACTION REPORTED.*SELF-ATTESTED/);
  assert.doesNotMatch(await page.locator('#guide-primary-email .guide-status').innerText(), /INSPECTED/);
  await choose(page, 'I CHECKED THE SETTING');
  assert.match(await page.locator('#guide-primary-email .guide-status').innerText(), /INSPECTED.*USER-INSPECTED/);
  await page.locator('#guide-recovery-readiness summary').click();
  assert.match(await page.locator('#guide-recovery-readiness').innerText(), /Recovery state inspected/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('clove_ds_l1_v1')));
  assert.deepEqual(saved.guides['primary-email'], { state: 'INSPECTED', confirmation: 'USER_INSPECTED' });
  assert.doesNotMatch(JSON.stringify(saved), /@|https?:|passwordValue|recoveryCode|token|cookie/i);
});

test(`practice teaches without changing confirmation and incident path is immediate (${engine})`, { concurrency: false }, async (t) => {
  const browser = await launch(); t.after(() => browser.close());
  const { server, origin } = await serverFor(); t.after(() => new Promise((resolve) => server.close(resolve)));
  const context = await browser.newContext(); t.after(() => context.close());
  const page = await context.newPage(); await page.goto(`${origin}/digital-stewardship.html`);
  await page.getByRole('button', { name: 'I SENT MONEY', exact: true }).click();
  assert.match(await page.locator('#incidentPanel').innerText(), /CONTAIN|official route|report/i);
  const before = await page.evaluate(() => localStorage.getItem('clove_ds_l1_v1'));
  await page.locator('#guide-phishing-messages summary').click();
  await page.locator('#guide-phishing-messages .practice-choice').filter({ hasText: 'Open the bank through its known app or site' }).click();
  assert.match(await page.locator('#guide-phishing-messages .practice-result').innerText(), /BEST MOVE/);
  const after = JSON.parse(await page.evaluate(() => localStorage.getItem('clove_ds_l1_v1')));
  const beforeState = JSON.parse(before);
  assert.equal(after.guides['phishing-messages'].confirmation, beforeState.guides['phishing-messages']?.confirmation ?? 'NONE');
  assert.equal(after.guides['phishing-messages'].state, 'GUIDED');
});

test(`legacy DS-00 inspection migrates conservatively and malformed state resets (${engine})`, { concurrency: false }, async (t) => {
  const browser = await launch(); t.after(() => browser.close());
  const { server, origin } = await serverFor(); t.after(() => new Promise((resolve) => server.close(resolve)));
  const context = await browser.newContext(); t.after(() => context.close());
  await context.addInitScript(() => {
    localStorage.setItem('clove_ds_i0_v1', JSON.stringify({ schemaVersion: 1, stage: 'COMPLETE', recoveryCheckResult: 'current' }));
    localStorage.setItem('clove_ds_i4_v1', JSON.stringify({ schemaVersion: 1, stage: 'COMPLETE' }));
    localStorage.setItem('clove_ds_l1_v1', JSON.stringify({ schemaVersion: 99, guides: { 'primary-email': { state: 'INSPECTED', confirmation: 'USER_INSPECTED' } }, incident: null }));
  });
  const page = await context.newPage(); await page.goto(`${origin}/digital-stewardship.html`);
  assert.match(await page.locator('#guide-recovery-readiness .guide-status').innerText(), /INSPECTED.*USER-INSPECTED/);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('clove_ds_l1_v1')).guides['primary-email']), undefined);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('clove_ds_l1_v1')).guides['urgent-money']), undefined);
  assert.notEqual(await page.evaluate(() => localStorage.getItem('clove_ds_i4_v1')), null);
});
