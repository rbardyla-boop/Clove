import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../tests/static/mission-001-interaction-adversarial-browser.test.mjs', import.meta.url);
let text = await readFile(path, 'utf8');
const anchor = `test('double leave cannot create duplicate mission_exit_prompt_seen telemetry', async t => {`;
const testBlock = `test('same-turn duplicate commit activation cannot create parallel accepted writes', async t => {
  const { server, signals, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();

  await page.goto(url);
  await fillCommit(page);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(node => /LOCK THE MISSION/.test(node.textContent || ''));
    button.click();
    button.click();
  });
  await page.locator('#locked').waitFor({ state: 'visible' });
  await page.waitForTimeout(250);

  assert.equal(signals.filter(s => s.event === 'mission_committed').length, 1);
  assert.equal(await page.locator('#storageFailure').count(), 0);
});

`;
if (!text.includes("same-turn duplicate commit activation cannot create parallel accepted writes")) {
  if (!text.includes(anchor)) throw new Error('patch_anchor_missing:double_leave');
  text = text.replace(anchor, testBlock + anchor);
  await writeFile(path, text, 'utf8');
  console.log('added same-turn concurrent write test');
} else {
  console.log('concurrent write test already present');
}
