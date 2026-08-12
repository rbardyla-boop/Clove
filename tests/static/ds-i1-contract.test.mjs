import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html=await readFile(new URL('../../digital-stewardship-01.html',import.meta.url),'utf8');
const js=await readFile(new URL('../../digital-stewardship-01.js',import.meta.url),'utf8');
const all=`${html}\n${js}`;

test('DS-I1 is first-party, structured-choice only and network silent',()=>{
  assert.match(html,/<script src="digital-stewardship-01\.js" defer><\/script>/);
  assert.doesNotMatch(all,/https?:\/\/|fonts\.google|jsdelivr|unpkg|\/\/cdn\./i);
  assert.doesNotMatch(html,/<textarea\b|contenteditable\s*=|<input\b/i);
  assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/i);
});

test('DS-I1 never requests provider/account or content details',()=>{
  for(const field of ['providerName','appName','serviceName','username','emailAddress','phoneNumber','accountId','exactLocation','contactName','fileName','photoMetadata','passwordValue','authToken','recoveryCode','freeText','notes']){
    assert.doesNotMatch(js,new RegExp(`\\b${field}\\b`,'i'));
  }
  assert.match(all,/Do not type the service name, account name, email, phone number, password, or other account details into Clove/i);
});

test('safety copy forbids high-consequence and evasion experiments',()=>{
  assert.match(all,/Do not use banking, government identity, critical health/i);
  assert.match(all,/Do not disable emergency, medical, security, two-factor authentication, fraud, payment-verification, recovery, caregiver, or on-call controls/i);
  assert.match(all,/Do not spoof your location, use a false identity, bypass an age gate, or defeat an access or fraud control/i);
  assert.match(all,/Sign-in and account-linking changes are outside this first run/i);
  assert.doesNotMatch(js,/SIGN-IN \/ ACCOUNT LINKING|account_linking/);
});

test('DS-I1 exposes only the coarse local-state allowlist',()=>{
  for(const field of ['schemaVersion','stage','settingClass','classification','changeDecision','taskResult','recoveryResult']) assert.match(js,new RegExp(`\\b${field}\\b`));
});

test('low-literacy interaction primitives are present',()=>{
  assert.match(html,/min-height:\s*44px/i);
  assert.match(html,/prefers-reduced-motion:\s*reduce/i);
  assert.match(html,/role="status"/i);
  assert.match(html,/<noscript>/i);
  assert.match(all,/>STOP</i);
});
