import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html=await readFile(new URL('../../digital-stewardship-05.html',import.meta.url),'utf8');
const js=await readFile(new URL('../../digital-stewardship-05.js',import.meta.url),'utf8');
const all=`${html}\n${js}`;

test('DS-I5 is first-party, input-free, storage-free and network silent',()=>{
  assert.match(html,/<script src="digital-stewardship-05\.js" defer><\/script>/);
  assert.doesNotMatch(all,/https?:\/\/|fonts\.google|jsdelivr|unpkg|\/\/cdn\./i);
  assert.doesNotMatch(html,/<textarea\b|contenteditable\s*=|<input\b|type\s*=\s*["']file/i);
  assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/i);
  assert.doesNotMatch(js,/localStorage|sessionStorage|indexedDB|document\.cookie|cookieStore/i);
});

test('DS-I5 never names sensitive collection fields',()=>{
  for(const field of ['contentText','contentDescription','sexualHistory','sexualOrientation','recipientName','recipientId','username','platformName','accountId','employerName','schoolName','relationshipName','exactLocation','emailAddress','phoneNumber','imageData','videoData','audioData','fileUpload','freeText','notes']) assert.doesNotMatch(js,new RegExp(`\\b${field}\\b`,'i'));
  assert.match(all,/Keep the content, identity, recipient, account, and platform outside Clove/i);
});

test('adult, consent and evidence boundaries are explicit',()=>{
  assert.match(all,/Adults only/i);
  assert.match(all,/anyone under 18/i);
  assert.match(all,/non-consensual intimate material/i);
  assert.match(all,/does not guarantee every copy is gone/i);
  assert.match(all,/context-dependent/i);
  assert.match(all,/not inevitable/i);
});

test('absolute permanence and shame language are absent',()=>{
  assert.doesNotMatch(all,/everything (?:online|on the internet) is permanent forever|ruin your career|no one will respect you|damaged goods|purity|slut|whore/i);
});

test('low-literacy primitives are present',()=>{
  assert.match(html,/min-height:\s*44px/i);
  assert.match(html,/prefers-reduced-motion:\s*reduce/i);
  assert.match(html,/role="status"/i);
  assert.match(html,/<noscript>/i);
  assert.match(all,/>STOP</i);
});
