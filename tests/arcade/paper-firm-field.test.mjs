import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PF_ZONES,
  addFieldPlayer,
  advanceScout,
  canExtract,
  createFieldState,
  extractPage,
  publicFieldSnapshot,
  removeFieldPlayer,
} from '../../arcade/paper-firm/field-core.mjs';

const LEAD = 'human:ada';

test('the field does not become a RUG observation during scout movement', () => {
  let state = createFieldState();
  const joined = addFieldPlayer(state, LEAD, 1_000);
  assert.equal(joined.ok, true);
  state = joined.state;
  const stain = PF_ZONES.find((zone) => zone.id === 'STAIN');
  state = { ...state, players: { ...state.players, [LEAD]: { ...state.players[LEAD], x: stain.x + 20, y: stain.y + 20 } } };
  state = advanceScout(state, 'find', { playerId: LEAD, role: 'lead' }).state;
  state = advanceScout(state, 'carry', { playerId: LEAD, role: 'lead' }).state;

  assert.equal(state.page.phase, 'at_archive');
  assert.equal(state.page.pendingReceipt, null);
  assert.equal(state.sequence, 0);
  assert.equal(publicFieldSnapshot(state, 'RUG001').page.pendingReceipt, null);
});

test('extraction is a real archive position gate and creates a field sequence', () => {
  let state = createFieldState();
  state = addFieldPlayer(state, LEAD, 1_000).state;
  const stain = PF_ZONES.find((zone) => zone.id === 'STAIN');
  state = { ...state, players: { ...state.players, [LEAD]: { ...state.players[LEAD], x: stain.x + 20, y: stain.y + 20 } } };
  state = advanceScout(advanceScout(state, 'find', { playerId: LEAD, role: 'lead' }).state, 'carry', { playerId: LEAD, role: 'lead' }).state;

  assert.equal(canExtract(state, LEAD).reason, 'not_in_archive');
  const archive = PF_ZONES.find((zone) => zone.id === 'ARCHIVE');
  state = { ...state, players: { ...state.players, [LEAD]: { ...state.players[LEAD], x: archive.x + 20, y: archive.y + 20 } } };
  const extracted = extractPage(state, LEAD);

  assert.equal(extracted.ok, true);
  assert.equal(extracted.sequence, 1);
  assert.equal(extracted.state.page.phase, 'extracted');
  assert.equal(extracted.state.page.extractedBy, LEAD);
  assert.equal(extracted.state.page.pendingReceipt, null, 'RUG intake must provide the receipt');
});

test('Scout authority is role- and position-bound', () => {
  let state = addFieldPlayer(createFieldState(), LEAD, 1_000).state;
  assert.equal(advanceScout(state, 'find', { playerId: LEAD, role: 'hand' }).reason, 'field_lead_required');
  assert.equal(advanceScout(state, 'find', { playerId: LEAD, role: 'lead' }).reason, 'scout_requires_stain_position');
});

test('disconnect/rejoin preserves the field player while hiding offline presence', () => {
  let state = addFieldPlayer(createFieldState(), LEAD, 1_000).state;
  state = { ...state, players: { ...state.players, [LEAD]: { ...state.players[LEAD], x: 812, y: 208 } } };
  state = removeFieldPlayer(state, LEAD);
  assert.equal(publicFieldSnapshot(state, 'RUG001').players.some((player) => player.id === LEAD), false);

  const rejoined = addFieldPlayer(state, LEAD, 2_000);
  assert.equal(rejoined.reason, 'rejoined');
  assert.deepEqual(
    { x: rejoined.state.players[LEAD].x, y: rejoined.state.players[LEAD].y },
    { x: 812, y: 208 },
  );
  assert.equal(publicFieldSnapshot(rejoined.state, 'RUG001').players.length, 1);
});

test('the Paper Firm renderer contains the frozen visual language and no autonomous worker loop', () => {
  const source = fs.readFileSync(new URL('../../arcade/paper-firm/paper-firm.js', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../../arcade/paper-firm/index.html', import.meta.url), 'utf8');
  const room = fs.readFileSync(new URL('../../workers/arcade/src/paper-firm-room.ts', import.meta.url), 'utf8');
  const headers = fs.readFileSync(new URL('../../_headers', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../../arcade/paper-firm/paper-firm.css', import.meta.url), 'utf8');
  for (const marker of ['paperBackground', 'drawBox', 'hatchFace', 'drawZone', 'redCheck', 'redX', 'tapeMark', 'ancestryThread']) {
    assert.match(source, new RegExp(`function ${marker}\\b`), marker);
  }
  assert.match(source, /const RULE\s*=/, 'RULE');
  for (const marker of ['DESK', 'STAIN', 'ARCHIVE', 'RELAY', 'PAGE-7']) {
    assert.match(source + html, new RegExp(marker), marker);
  }
  assert.match(source, /rgba\(36,93,160,/);
  assert.match(source, /ctx\.globalAlpha|alpha/);
  assert.doesNotMatch(source, /deskWorkerTick|workerTimer|setInterval\(\(\) => deskWorkerTick/);
  assert.doesNotMatch(source, /MeshStandardMaterial|MeshPhysicalMaterial|postprocess|beige/i);
  assert.match(html, /data-touch-key="arrowup"/);
  assert.match(css, /\.touch-pad/);
  assert.match(room, /PF-JOIN\/2/);
  assert.match(room, /verifyReceiptAck/);
  assert.match(room, /meta\.role !== "lead"/);
  assert.match(room, /advanceScout\(this\.state, String\(data\.verb \|\| ""\), \{ playerId: meta\.playerId, role: meta\.role \}\)/);
  assert.match(room, /this\.pending/);
  assert.match(source, /location\.hostname === 'clovelearn\.io'.*wss:\/\/clovelearn\.io/);
  assert.match(source, /change-requirement/);
  assert.match(headers, /http:\/\/localhost:8080/);
});
