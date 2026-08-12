import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../mission-001.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../../mission-001-app.js', import.meta.url), 'utf8');
const privateStore = await readFile(new URL('../../mission-private-store.js', import.meta.url), 'utf8');
const contracts = await readFile(new URL('../../workers/insights/src/contracts.ts', import.meta.url), 'utf8');

const MISSION_EVENTS = [
  'mission_viewed',
  'mission_class_selected',
  'mission_committed',
  'mission_exit_prompt_seen',
  'mission_returned',
  'mission_done',
  'mission_partly_done',
  'mission_failed',
  'mission_not_started',
  'mission_debrief_completed',
  'mission_helped_other_yes',
  'mission_helped_other_no',
  'mission_helped_other_unsure',
  'mission_retry_selected',
  'mission_smaller_selected',
  'mission_help_requested',
  'mission_abandoned_reasoned',
];

test('ten-second proposition stays action-first', () => {
  assert.match(html, /MAKE YOURSELF USEFUL\./);
  assert.match(html, /Pick one thing that leaves the world slightly better because you showed up\./);
  assert.match(html, /Pick something real, define what done means, close Clove, do it, then come back/i);
});

test('all four bounded mission classes exist', () => {
  for (const cls of ['fix', 'serve', 'learn', 'build']) {
    assert.match(html, new RegExp(`data-class="${cls}"`));
  }
});

test('offline-action gate is explicit and does not offer a feed after commitment', () => {
  assert.match(html, /CLOSE CLOVE[\s\S]*GO DO IT/);
  assert.match(html, /The website is not the mission\./);
  assert.doesNotMatch(html + app, /JoyMesh|leaderboard|followers|social feed|mentor marketplace|AI companion/i);
});

test('return path includes success, partial, failure, and did-not-start states', () => {
  for (const outcome of ['done', 'partly', 'failed', 'not_started']) {
    assert.match(html, new RegExp(`data-outcome="${outcome}"`));
  }
  assert.match(html, /Failure stays inside the loop\./);
  assert.match(html, /RETRY SMALLER/);
  assert.match(html, /GET HELP/);
  assert.match(html, /LEARN FIRST/);
  assert.match(html, /ABANDON FOR A REASON/);
  assert.match(html, /SHRINK/);
  assert.match(html, /REPLACE/);
  assert.match(html, /SCHEDULE/);
  assert.match(html, /DROP FOR A REASON/);
});

test('private evidence is encrypted locally and public proof is not required', () => {
  assert.match(html, /mission-private-store\.js/);
  assert.match(html, /mission-001-app\.js/);
  assert.match(html, /encrypted locally in this browser before storage/i);
  assert.match(app, /clove_v2_mission_001/);
  assert.match(app, /ClovePrivateStore\.set/);
  assert.match(privateStore, /AES-GCM/);
  assert.match(privateStore, /localStorage\.setItem/);
  assert.match(privateStore, /cloveenc:v1:/);
  assert.match(html, /does not send your mission text, debrief, location, contacts, or photos/i);
  assert.doesNotMatch(html, /type="file"/i);
  assert.doesNotMatch(html + app, /navigator\.geolocation/i);
});

test('encrypted integration has a structurally valid page tail', () => {
  assert.match(html, /<footer class="footer">[\s\S]*?<\/footer>\s*<\/main>\s*<script src="mission-private-store\.js"><\/script>\s*<script src="mission-001-app\.js"><\/script>\s*<\/body>\s*<\/html>\s*$/);
  assert.doesNotMatch(html, /<\/f<script|\}\)\(\);\s*<\/script>/);
});

test('safety boundary rejects courage framing and names high-risk categories', () => {
  for (const phrase of ['illegal activity', 'weapons', 'electrical', 'gas', 'structural', 'automotive', 'heights', 'confined spaces', 'chemicals', 'power tools', 'trespassing', 'minors']) {
    assert.match(html.toLowerCase(), new RegExp(phrase));
  }
  assert.doesNotMatch(html + app, /prove yourself|be a man|man up|coward/i);
});

test('Mission 001 aggregate vocabulary is server-enumerated', () => {
  for (const event of MISSION_EVENTS) {
    assert.match(contracts, new RegExp(`'${event}'`));
  }
  assert.match(contracts, /'mission'/);
  for (const detail of ['fix', 'serve', 'learn', 'build']) {
    assert.match(contracts, new RegExp(`'${detail}'`));
  }
});

test('client signal payload is coarse and does not serialize mission state', () => {
  const signalStart = app.indexOf('function signal(event');
  const signalEnd = app.indexOf('function summary(', signalStart);
  assert.ok(signalStart > 0 && signalEnd > signalStart);
  const signalCode = app.slice(signalStart, signalEnd);
  for (const allowed of ['event', "surface:'mission'", 'device:device()', 'returnBucket', 'referrerGroup', "build:'v2'", 'variant', 'detail', 'diagnostic']) {
    assert.match(signalCode, new RegExp(allowed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const forbidden of ['missionAction', 'doneWhen', 'firstAction', 'debrief', 'latitude', 'longitude', 'photo', 'contact', 'identifier']) {
    assert.doesNotMatch(signalCode, new RegExp(forbidden, 'i'));
  }
});

test('page contains basic mobile and accessibility affordances', () => {
  assert.match(html, /name="viewport"/);
  assert.match(html, /aria-label="Mission class"/);
  assert.match(html, /aria-label="Mission outcome"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /prefers-reduced-motion/);
});
