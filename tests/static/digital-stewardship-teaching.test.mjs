import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = ['digital-stewardship.html', ...Array.from({ length: 7 }, (_, index) => `digital-stewardship-0${index}.html`)];

test('Digital Stewardship teaches the reason and the safe stopping point in plain language', async () => {
  const html = await Promise.all(files.map((file) => readFile(new URL(`../../${file}`, import.meta.url), 'utf8')));
  const overview = html[0];
  assert.match(overview, /LEARN\.<br>DO\.<br>CHECK/);
  assert.match(overview, /No account\. No secrets/);
  assert.match(overview, /Honest progress/);
  assert.match(overview, /These guides teach choices/);
  for (const [index, page] of html.slice(1).entries()) {
    assert.match(page, /Why this helps:/, `DS-0${index} needs a reason for the lesson`);
    assert.match(page, /Avoid:/, `DS-0${index} needs a clear avoid instruction`);
    assert.match(page, /Do not|Never/, `DS-0${index} needs a safety boundary`);
  }
  const ds00 = `${html[1]}\n${await readFile(new URL('../../digital-stewardship-00.js', import.meta.url), 'utf8')}`;
  assert.match(ds00, /Recovery state inspected/);
  assert.doesNotMatch(ds00, /Recovery verified/);
});
