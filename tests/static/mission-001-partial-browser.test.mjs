import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const missionHtml = await readFile(new URL('../../mission-001.html', import.meta.url));

function startServer() {
  const signals = [];
  const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/__clove/signal') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try { signals.push(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch {}
        res.writeHead(202, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
      });
      return;
    }
    if (req.method === 'GET' && (req.url === '/' || req.url === '/mission-001.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(missionHtml);
      return;
    }
    res.writeHead(404).end('not found');
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    resolve({ server, signals, url: `http://127.0.0.1:${port}/mission-001.html` });
  }));
}

test('PARTLY DONE remains a valid success-side debrief rather than failure or erasure', async t => {
  const { server, signals, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  t.after(() => browser.close());
  const page = await browser.newPage();

  await page.goto(url);
  await page.locator('[data-class="build"]').click();
  await page.locator('#missionAction').fill('Build a small usable checklist for a repeated task');
  await page.locator('#doneWhen').fill('A first working version exists and can be followed once');
  await page.locator('#duration').selectOption('30to60');
  await page.locator('#firstAction').fill('Write the first three required steps');
  await page.locator('#safetyCheck').check();
  await page.getByRole('button', { name: 'LOCK THE MISSION' }).click();
  await page.getByRole('button', { name: "I'M LEAVING TO DO IT" }).click();
  await page.reload();
  await page.locator('[data-outcome="partly"]').click();

  assert.equal(await page.locator('#debriefSuccess').isVisible(), true);
  await page.locator('#actualDid').fill('I built the first usable half and tested the first steps.');
  await page.locator('#classEvidence').fill('A partial checklist exists and the completed steps work.');
  await page.locator('#different').fill('The task needed more branches than expected.');
  await page.locator('#harder').fill('Deciding what to leave out was harder than writing it.');
  await page.locator('#learnedSuccess').fill('The smaller version is still useful enough to test.');
  await page.locator('#helpedOther').selectOption('unsure');
  await page.locator('#nextUseful').fill('Test the remaining steps before expanding it.');
  await page.getByRole('button', { name: 'SAVE DEBRIEF' }).click();

  assert.equal(await page.locator('#complete').isVisible(), true);
  await page.waitForTimeout(100);
  const names = signals.map(s => s.event);
  assert.ok(names.includes('mission_partly_done'));
  assert.ok(names.includes('mission_helped_other_unsure'));
  assert.ok(names.includes('mission_debrief_completed'));
  assert.equal(names.includes('mission_failed'), false);
});
