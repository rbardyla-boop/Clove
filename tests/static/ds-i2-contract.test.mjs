import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html=await readFile(new URL('../../digital-stewardship-02.html',import.meta.url),'utf8');
const js=await readFile(new URL('../../digital-stewardship-02.js',import.meta.url),'utf8');
const all=`${html}\n${js}`;

test('DS-I2 is first-party, structured-choice only and network silent',()=>{
  assert.match(html,/<script src="digital-stewardship-02\.js" defer><\/script>/);
  assert.doesNotMatch(all,/https?:\/\/|fonts\.google|jsdelivr|unpkg|\/\/cdn\./i);
  assert.doesNotMatch(html,/<textarea\b|contenteditable\s*=|<input\b/i);
  assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/i);
});

test('DS-I2 never asks for addresses, providers, account identifiers or message content',()=>{
  for(const field of ['emailAddress','providerName','serviceName','username','phoneNumber','accountId','passwordValue','authToken','recoveryCode','messageSubject','messageBody','freeText','notes']){
    assert.doesNotMatch(js,new RegExp(`\\b${field}\\b`,'i'));
  }
  assert.match(all,/Never type an email address, provider name, username, phone number, password, recovery code, or account identifier into Clove/i);
});

test('DS-I2 copy preserves migration and anonymity boundaries',()=>{
  assert.match(all,/Do not move or change the sign-in or recovery route for banking, government, health, password-manager recovery, primary work, or another high-consequence account during this drill/i);
  assert.match(all,/A secondary email or alias does not make you anonymous/i);
  assert.match(all,/Do not log out, reset a password, change recovery email or phone, remove multi-factor authentication, or use a backup code just to test this drill/i);
  assert.doesNotMatch(all,/create a new (?:email|account) now to continue/i);
});

test('DS-I2 exposes only coarse local-state fields',()=>{
  for(const field of ['schemaVersion','stage','currentPattern','laneType','receiveResult','recoveryAwareness','futureRule']) assert.match(js,new RegExp(`\\b${field}\\b`));
});

test('low-literacy interaction primitives are present',()=>{
  assert.match(html,/min-height:\s*44px/i);
  assert.match(html,/prefers-reduced-motion:\s*reduce/i);
  assert.match(html,/role="status"/i);
  assert.match(html,/<noscript>/i);
  assert.match(all,/>STOP</i);
});
