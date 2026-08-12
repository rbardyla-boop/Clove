import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html=await readFile(new URL('../../digital-stewardship-03.html',import.meta.url),'utf8');
const js=await readFile(new URL('../../digital-stewardship-03.js',import.meta.url),'utf8');
const all=`${html}\n${js}`;

test('DS-I3 is first-party, structured-choice only and network silent',()=>{
  assert.match(html,/<script src="digital-stewardship-03\.js" defer><\/script>/);
  assert.doesNotMatch(all,/https?:\/\/|fonts\.google|jsdelivr|unpkg|\/\/cdn\./i);
  assert.doesNotMatch(html,/<textarea\b|contenteditable\s*=|<input\b/i);
  assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/i);
});

test('DS-I3 never stores app/provider/content or exact schedule fields',()=>{
  for(const field of ['appName','providerName','serviceName','accountId','notificationText','senderName','emailAddress','phoneNumber','exactTime','scheduleTime','location','passwordValue','authToken','recoveryCode','freeText','notes']){
    assert.doesNotMatch(js,new RegExp(`\\b${field}\\b`,'i'));
  }
  assert.match(all,/Do not type the app, provider, account, sender, or notification content into Clove/i);
});

test('critical-alert and evidence boundaries are explicit',()=>{
  assert.match(all,/Do not change emergency, medical, caregiver, security, two-factor authentication, fraud, payment-verification, or required on-call alerts/i);
  assert.match(all,/This is not a dopamine detox, addiction diagnosis, or treatment/i);
  assert.doesNotMatch(all,/your phone is rewiring your brain/i);
  assert.doesNotMatch(all,/turn off all notifications/i);
});

test('DS-I3 exposes only coarse local-state fields',()=>{
  for(const field of ['schemaVersion','stage','interruptionClass','intent','changeDecision','checkResult','recoveryResult']) assert.match(js,new RegExp(`\\b${field}\\b`));
});

test('low-literacy primitives are present',()=>{
  assert.match(html,/min-height:\s*44px/i);
  assert.match(html,/prefers-reduced-motion:\s*reduce/i);
  assert.match(html,/role="status"/i);
  assert.match(html,/<noscript>/i);
  assert.match(all,/>STOP</i);
});
