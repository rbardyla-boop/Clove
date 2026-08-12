import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const missionHtml = await readFile(new URL('../../mission-001.html', import.meta.url));
const appJs = await readFile(new URL('../../mission-001-app.js', import.meta.url));
const privateStoreJs = await readFile(new URL('../../mission-private-store.js', import.meta.url));
const STORAGE_KEY = 'clove_v2_mission_001';

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
    if (req.method === 'GET' && req.url === '/mission-private-store.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(privateStoreJs);
      return;
    }
    if (req.method === 'GET' && req.url === '/mission-001-app.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(appJs);
      return;
    }
    if (req.method === 'GET' && (req.url === '/' || req.url === '/mission-001.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(missionHtml);
      return;
    }
    res.writeHead(404).end('not found');
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, signals, url: `http://127.0.0.1:${port}/mission-001.html` });
    });
  });
}

async function commit(page, cls, marker = '') {
  await page.locator(`[data-class="${cls}"]`).click();
  await page.locator('#missionAction').fill(`Do one bounded ${cls} mission ${marker}`);
  await page.locator('#doneWhen').fill(`An observable ${cls} result exists ${marker}`);
  await page.locator('#duration').selectOption('30to60');
  await page.locator('#firstAction').fill(`Take the first physical ${cls} action ${marker}`);
  await page.locator('#safetyCheck').check();
  await page.getByRole('button', { name: 'LOCK THE MISSION' }).click();
  assert.equal(await page.locator('#locked').isVisible(), true);
  assert.match(await page.locator('#locked').innerText(), /CLOSE CLOVE[\s\S]*GO DO IT/);
}

async function leaveAndReturn(page) {
  await page.getByRole('button', { name: "I'M LEAVING TO DO IT" }).click();
  assert.equal(await page.locator('#away').isVisible(), true);
  await page.reload();
  assert.equal(await page.locator('#return').isVisible(), true);
}

async function launchBrowser() {
  return chromium.launch({ headless: true, channel: 'chrome' });
}

test('DONE path survives encrypted leave/reload and aggregate signals leak no mission text', async t => {
  const { server, signals, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext();
  const page = await context.newPage();

  const secretMarker = 'PRIVATE-JOHN-SMITH-14-KING-ST';
  await page.goto(url);
  assert.equal(await page.getByText('MAKE YOURSELF USEFUL.', { exact: true }).isVisible(), true);
  await commit(page, 'fix', secretMarker);

  const committedRaw = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  assert.match(committedRaw, /^cloveenc:v1:/);
  assert.doesNotMatch(committedRaw, /PRIVATE-JOHN-SMITH|KING-ST|bounded fix mission/i);

  await leaveAndReturn(page);

  await page.locator('[data-outcome="done"]').click();
  await page.locator('#actualDid').fill(`I completed the work ${secretMarker}`);
  await page.locator('#classEvidence').fill(`The object is functional ${secretMarker}`);
  await page.locator('#different').fill('One adjustment changed from the plan.');
  await page.locator('#harder').fill('Diagnosis took longer than expected.');
  await page.locator('#learnedSuccess').fill('I learned how to isolate the fault.');
  await page.locator('#helpedOther').selectOption('yes');
  await page.locator('#nextUseful').fill('Put the tool away and write down the setting.');
  await page.getByRole('button', { name: 'SAVE DEBRIEF' }).click();
  assert.equal(await page.locator('#complete').isVisible(), true);
  await page.waitForTimeout(150);

  const completeRaw = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  assert.match(completeRaw, /^cloveenc:v1:/);
  assert.doesNotMatch(completeRaw, /PRIVATE-JOHN-SMITH|KING-ST|completed the work|functional/i);

  const names = signals.map(s => s.event);
  for (const required of ['mission_viewed','mission_class_selected','mission_committed','mission_exit_prompt_seen','mission_returned','mission_done','mission_helped_other_yes','mission_debrief_completed']) {
    assert.ok(names.includes(required), `missing ${required}`);
  }

  const wire = JSON.stringify(signals);
  assert.doesNotMatch(wire, /PRIVATE-JOHN-SMITH|KING-ST|completed the work|functional/i);
  for (const s of signals) {
    assert.deepEqual(Object.keys(s).sort(), ['build','detail','device','diagnostic','event','referrerGroup','returnBucket','surface','variant'].sort());
    assert.equal(s.surface, 'mission');
    assert.ok(['none','fix','serve','learn','build'].includes(s.detail));
  }
});

test('FAILED path returns the user to a legitimate smaller next state', async t => {
  const { server, signals, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const page = await browser.newPage();

  await page.goto(url);
  await commit(page, 'learn');
  await leaveAndReturn(page);
  await page.locator('[data-outcome="failed"]').click();
  await page.locator('#failedAttempt').fill('I attempted the demonstration.');
  await page.locator('#failedWhere').fill('The final step did not work.');
  await page.locator('#failedCause').selectOption({ label: 'Knowledge' });
  await page.locator('#failedLearn').fill('I am missing one prerequisite skill.');
  await page.locator('#failedNext').selectOption('smaller');
  await page.getByRole('button', { name: 'SAVE FAILURE DEBRIEF' }).click();
  assert.equal(await page.locator('#complete').isVisible(), true);
  await page.waitForTimeout(100);
  const names = signals.map(s => s.event);
  assert.ok(names.includes('mission_failed'));
  assert.ok(names.includes('mission_smaller_selected'));
  assert.ok(names.includes('mission_debrief_completed'));
});

test('DID NOT START path preserves participation and supports shrink', async t => {
  const { server, signals, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const page = await browser.newPage();

  await page.goto(url);
  await commit(page, 'serve');
  await leaveAndReturn(page);
  await page.locator('[data-outcome="not_started"]').click();
  await page.locator('#stoppedFirst').fill('The first action was too large and vague.');
  await page.locator('#notStartedCause').selectOption({ label: 'Too large' });
  await page.locator('#notStartedNext').selectOption('shrink');
  await page.getByRole('button', { name: 'SAVE START DEBRIEF' }).click();
  assert.equal(await page.locator('#complete').isVisible(), true);
  await page.waitForTimeout(100);
  const names = signals.map(s => s.event);
  assert.ok(names.includes('mission_not_started'));
  assert.ok(names.includes('mission_smaller_selected'));
  assert.ok(names.includes('mission_debrief_completed'));
});

test('safety confirmation is a hard commit gate', async t => {
  const { server, signals, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const page = await browser.newPage();

  await page.goto(url);
  await page.locator('[data-class="fix"]').click();
  await page.locator('#missionAction').fill('Work on a live electrical service panel');
  await page.locator('#doneWhen').fill('The energized panel has been altered');
  await page.locator('#duration').selectOption('30to60');
  await page.locator('#firstAction').fill('Remove the live panel cover');
  await page.getByRole('button', { name: 'LOCK THE MISSION' }).click();
  assert.equal(await page.locator('#commit').isVisible(), true);
  assert.match(await page.locator('#commitError').innerText(), /safety confirmation/i);
  assert.equal(await page.locator('#locked').isVisible(), false);
  await page.waitForTimeout(80);
  assert.equal(signals.some(s => s.event === 'mission_committed'), false);
});

test('mobile width has no horizontal document overflow at the entry and return states', async t => {
  const { server, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.goto(url);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflow, false);
  await commit(page, 'build');
  await leaveAndReturn(page);
  const returnOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(returnOverflow, false);
});

test('core choose and commit path is operable with keyboard alone', async t => {
  const { server, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(url);

  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-class')), 'fix');
  await page.keyboard.press('Enter');
  await page.locator('#commit').waitFor({ state: 'visible' });

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'missionAction');
  await page.keyboard.type('Repair one loose drawer handle');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'doneWhen');
  await page.keyboard.type('The handle is secure and the drawer opens normally');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'duration');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'firstAction');
  await page.keyboard.type('Get the correct screwdriver');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'startNote');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'safetyCheck');
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  assert.match(await page.evaluate(() => document.activeElement?.textContent || ''), /LOCK THE MISSION/);
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#locked').isVisible(), true);

  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'leaveButton');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#away').isVisible(), true);
});
