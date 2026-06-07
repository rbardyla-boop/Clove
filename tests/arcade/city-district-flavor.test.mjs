/**
 * Phase 8C-3 — district VOICE flavor unit tests (city-district-flavor.mjs).
 * Proves: every block has clean, bounded voice copy; the event-card voice resolves type-specific →
 * default → ''; Garden/Nexus carry corridor-specific tone; all copy passes the canonical FORBIDDEN_RE +
 * the panel guard. DISPLAY-ONLY client overlay; grants nothing economic; never alters server event copy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { blockVoice, eventVoiceLine, voiceBlockIds, voiceIsClean, VOICE_LINE_MAX } from '../../arcade/city/city-district-flavor.mjs';
import { CITY_IDS } from '../../arcade/city/city-block.mjs';
import { FORBIDDEN_RE } from '../../arcade/city/city-interactions.mjs';

const PANEL_FORBIDDEN = /\$|\bcash\b|\bpayout\b|\bbuy\b|\bsell\b|\brent\b|\bown\b|\bowner\b|\bclaim\b|\bprice\b|\bmarket\b|\bstake\b|\bprofit\b|\bincome\b|\breward\b|\btoken\b|\bunlock\b|\bearn\b|\bprize\b|\bbonus\b/i;

test('every live block has standing board voice + an event voice (default)', () => {
  for (const id of CITY_IDS) {
    assert.ok(blockVoice(id).length > 0, `${id} has board voice`);
    assert.ok(eventVoiceLine(id, 'district_block_focus').length > 0, `${id} has an event voice`);
    assert.ok(eventVoiceLine(id, 'some_unknown_type').length > 0, `${id} falls back to a default voice`);
  }
  assert.deepEqual(voiceBlockIds().slice().sort(), [...CITY_IDS].sort());
});

test('all voice copy is clean of forbidden vocabulary and within bounds', () => {
  const all = [];
  for (const id of voiceBlockIds()) {
    all.push(blockVoice(id));
    for (const t of ['district_signal_surge', 'district_quiet_window', 'district_route_warmup', 'district_arcade_hour', 'district_block_focus', '_default_']) {
      const v = eventVoiceLine(id, t); if (v) all.push(v);
    }
  }
  for (const s of all) {
    assert.ok(voiceIsClean(s), `clean+bounded: "${s}"`);
    assert.equal(FORBIDDEN_RE.test(s), false, `passes FORBIDDEN_RE: "${s}"`);
    assert.equal(PANEL_FORBIDDEN.test(s), false, `passes panel guard: "${s}"`);
    assert.ok(s.length <= VOICE_LINE_MAX, `within ${VOICE_LINE_MAX}: "${s}" (${s.length})`);
  }
});

test('eventVoiceLine resolves type-specific override before the block default', () => {
  // garden has a quiet-window specific line distinct from its default
  const def = eventVoiceLine('garden-06', 'some_unknown_type');
  const quiet = eventVoiceLine('garden-06', 'district_quiet_window');
  assert.notEqual(quiet, def);
  assert.match(quiet, /hush|slow|calm|green/i);
  // nexus surge is its own line
  assert.match(eventVoiceLine('nexus-05', 'district_signal_surge'), /surg|pulse|cross/i);
});

test('Garden and Nexus voice is corridor-specific (teaches the new path)', () => {
  assert.match(blockVoice('garden-06') + ' ' + eventVoiceLine('garden-06', 'district_block_focus'), /green|calm|corridor|across|on-ramp/i);
  assert.match(blockVoice('nexus-05') + ' ' + eventVoiceLine('nexus-05', 'district_block_focus'), /cross|pulse|pivot|corridor/i);
});

test('voice is fallback-safe — unknown block/type returns empty, never throws', () => {
  assert.equal(blockVoice('nope-99'), '');
  assert.equal(blockVoice(null), '');
  assert.equal(eventVoiceLine('nope-99', 'district_block_focus'), '');
  assert.equal(eventVoiceLine(null, null), '');
  assert.equal(voiceIsClean(''), false);
  assert.equal(voiceIsClean('earn a reward'), false);
});
