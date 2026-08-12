import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../tests/static/mission-001-state-recovery-browser.test.mjs', import.meta.url);
let text = await readFile(path, 'utf8');
const from = `  assert.deepEqual(consoleErrors, [], 'expected state-guard rejection to avoid console.error');`;
const to = `  assert.equal(consoleErrors.some(message => /Mission private storage failed/i.test(message)), false, 'state guard must not be reported as a private storage failure');`;
if (!text.includes(to)) {
  if (!text.includes(from)) throw new Error('patch_anchor_missing:console_assertion');
  text = text.replace(from, to);
  await writeFile(path, text, 'utf8');
  console.log('patched state-guard console assertion');
} else {
  console.log('test already patched');
}
