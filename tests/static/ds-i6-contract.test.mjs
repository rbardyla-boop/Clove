import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html=await readFile(new URL('../../digital-stewardship-06.html',import.meta.url),'utf8');
const js=await readFile(new URL('../../digital-stewardship-06.js',import.meta.url),'utf8');
const all=`${html}\n${js}`;

test('DS-I6 is first-party, input-free, storage-free and network silent',()=>{
  assert.match(html,/<script src="digital-stewardship-06\.js" defer><\/script>/);
  assert.doesNotMatch(all,/https?:\/\/|fonts\.google|jsdelivr|unpkg|\/\/cdn\./i);
  assert.doesNotMatch(html,/<textarea\b|contenteditable\s*=|<input\b|type\s*=\s*["']file/i);
  assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/i);
  assert.doesNotMatch(js,/localStorage|sessionStorage|indexedDB|document\.cookie|cookieStore/i);
});

test('DS-I6 never defines sensitive credential, code, contact or provider fields',()=>{
  for(const field of ['serviceName','providerName','accountName','userName','emailAddress','phoneNumber','passwordValue','passkeyValue','pinValue','twoFactorCode','recoveryCode','backupCode','recoveryEmail','recoveryPhone','securityAnswer','deviceId','screenshotData','supportTranscript','freeText','notes']) assert.doesNotMatch(js,new RegExp(`\\b${field}\\b`,'i'));
  assert.match(all,/Do not enter the service, username, contact details, password, passkey, PIN, authentication code, recovery code, or backup code into Clove/i);
});

test('inspection-only and evidence boundaries are explicit',()=>{
  assert.match(all,/Inspect only\. Change nothing/i);
  assert.match(all,/Do not log out, start a password reset, remove or replace a recovery method, disable two-factor authentication, rotate codes, revoke sessions, or delete the account/i);
  assert.match(all,/No answer proves that this account is secure or compromised/i);
  assert.match(all,/official help or recovery route outside Clove/i);
});

test('only coarse in-memory state fields are named',()=>{
  for(const field of ['stage','normalAccess','settingsFound','recognizableMethod','secondRoute','decision']) assert.match(js,new RegExp(`\\b${field}\\b`));
});

test('low-literacy primitives are present',()=>{
  assert.match(html,/min-height:\s*44px/i);
  assert.match(html,/prefers-reduced-motion:\s*reduce/i);
  assert.match(html,/role="status"/i);
  assert.match(html,/<noscript>/i);
  assert.match(all,/>STOP</i);
});
