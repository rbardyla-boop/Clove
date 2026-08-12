import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../digital-stewardship-00.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../../digital-stewardship-00.js', import.meta.url), 'utf8');
const all = `${html}\n${js}`;

test('DS-I0 is first-party, structured-choice only, and network silent', () => {
  assert.match(html, /<script src="digital-stewardship-00\.js" defer><\/script>/);
  assert.doesNotMatch(all, /https?:\/\/|\/\/cdn\.|fonts\.google|jsdelivr|unpkg/i);
  assert.doesNotMatch(html, /<textarea\b|contenteditable\s*=|<input\b/i);
  assert.doesNotMatch(js, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/i);
});

test('DS-I0 never asks for sensitive account/provider content', () => {
  assert.doesNotMatch(all, /name=["'](?:email|phone|username|password|provider|serviceName|token|recoveryCode)/i);
  assert.doesNotMatch(all, /type=["'](?:email|tel|password|file)["']/i);
  assert.match(all, /Never type your password, email, phone number, recovery code, or provider name into Clove/i);
});

test('DS-I0 copy preserves evidence and destructive-action boundaries', () => {
  for (const forbidden of [
    /everything online is permanent/i,
    /the cloud never deletes anything/i,
    /apps spy on you/i,
    /if you are not paying[^.]{0,80}you are the product/i,
    /log out now to prove/i,
    /remove (?:your )?(?:mfa|multi-factor authentication) to test/i,
    /use (?:a )?backup code to test/i,
  ]) assert.doesNotMatch(all, forbidden);

  assert.match(all, /Do not log out/i);
  assert.match(all, /I DON'T KNOW/i);
  assert.match(all, />STOP</i);
});

test('DS-I0 exposes only coarse local state fields', () => {
  const required = ['schemaVersion','stage','deviceClass','accessMode','hasAccount','providerPersistenceBelief','recoveryClass','recoveryCheckResult'];
  for (const field of required) assert.match(js, new RegExp(`\\b${field}\\b`));

  // This checks storage/property identifiers, not safety prose. Words such as
  // “password” and “email” MUST remain allowed in copy that tells users not to
  // disclose or destructively test those secrets.
  for (const forbiddenField of [
    'providerName','serviceName','username','emailAddress','phoneNumber',
    'passwordValue','passwordSecret','authToken','recoveryCode','freeText','notes'
  ]) {
    assert.doesNotMatch(js, new RegExp(`\\b${forbiddenField}\\b`, 'i'));
  }
});

test('DS-I0 retains the low-literacy interaction budget in markup/styles', () => {
  assert.match(html, /min-height:\s*44px/i);
  assert.match(html, /prefers-reduced-motion:\s*reduce/i);
  assert.match(html, /role="status"/i);
  assert.match(html, /<noscript>/i);
});
