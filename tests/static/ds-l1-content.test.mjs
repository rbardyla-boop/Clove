import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../digital-stewardship.html', import.meta.url), 'utf8');
const content = await readFile(new URL('../../digital-stewardship-content.js', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../../digital-stewardship.js', import.meta.url), 'utf8');
const context = { window: {} };
vm.runInNewContext(content, context);
const guides = context.window.CLOVE_STEWARDSHIP_GUIDES;
const all = `${html}\n${content}\n${runtime}`;

const required = ['why', 'action', 'inspection', 'good', 'practice', 'recovery', 'avoid', 'confirmation', 'sources'];

test('DS-L1 has the five areas and required first Lighthouse guide set', () => {
  assert.equal(guides.length, 18);
  assert.deepEqual([...new Set(guides.map((guide) => guide.category))].sort(), ['devices', 'foundations', 'helpers', 'privacy', 'recovery', 'scams'].sort());
  for (const guide of guides) {
    for (const field of required) assert.ok(guide[field], `${guide.id} missing ${field}`);
    assert.ok(guide.sources.length > 0, `${guide.id} missing source`);
    for (const source of guide.sources) {
      for (const field of ['sourceId', 'authority', 'url', 'topic', 'reviewedAt']) {
        assert.ok(source[field], `${guide.id} source missing ${field}`);
      }
      assert.match(source.url, /^https:\/\//, `${guide.id} source must be HTTPS`);
    }
    assert.ok(guide.confirmation.allowedMethods.includes('SELF_ATTESTED'), `${guide.id} missing self-attestation option`);
    assert.ok(guide.confirmation.allowedMethods.includes('USER_INSPECTED'), `${guide.id} missing inspection option`);
  }
});

test('DS-L1 content uses plain delivery sections and official source links', () => {
  for (const label of ['Why this matters', 'Do this', 'Check it', 'What good looks like', 'Practice', 'If it goes wrong', 'Avoid', 'Sources']) assert.match(html + runtime, new RegExp(label, 'i'));
  assert.match(all, /cisa\.gov\/secure-our-world/);
  assert.match(all, /pages\.nist\.gov\/800-63-4\/sp800-63b\/authenticators/);
  assert.match(all, /getcybersafe\.gc\.ca\/en\/csam-themes/);
  assert.match(all, /reset your password/i);
  assert.match(all, /QR code/i);
  assert.match(all, /bank account is locked/i);
  assert.match(all, /six-digit code/i);
  assert.match(all, /urgent money/i);
  assert.match(all, /remote-control tool/i);
});

test('DS-L1 has no input, network, tracking, secret collection, or overclaim surface', () => {
  assert.doesNotMatch(html, /<input\b|<textarea\b|contenteditable\s*=/i);
  assert.doesNotMatch(runtime, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/i);
  assert.doesNotMatch(runtime, /document\.cookie|sessionStorage|indexedDB/i);
  for (const field of ['passwordValue', 'passphraseValue', 'recoveryCode', 'totpSeed', 'privateKey', 'authToken', 'sessionCookie', 'securityAnswer', 'cardNumber']) {
    assert.doesNotMatch(runtime, new RegExp(`\\b${field}\\b`, 'i'));
  }
  for (const phrase of [/Recovery verified/i, /fully secure/i, /100% secure/i, /security verified/i, /YOU ARE SECURE/i, /100% PROTECTED/i, /SAFE ONLINE/i]) assert.doesNotMatch(all, phrase);
  assert.match(all, /Recovery state inspected/);
});

test('DS-L1 confirmation vocabulary is explicit and conservative', () => {
  assert.match(runtime, /NOT_STARTED/);
  assert.match(runtime, /GUIDED/);
  assert.match(runtime, /ACTION_REPORTED/);
  assert.match(runtime, /INSPECTED/);
  assert.match(runtime, /NEEDS_ATTENTION/);
  assert.match(runtime, /NOT_APPLICABLE/);
  assert.match(runtime, /NONE/);
  assert.match(runtime, /SELF_ATTESTED/);
  assert.match(runtime, /USER_INSPECTED/);
  assert.doesNotMatch(runtime, /DETERMINISTIC_CHECK.*=.*(?:true|enabled)/i);
});
