import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html=await readFile(new URL('../../digital-stewardship-04.html',import.meta.url),'utf8');
const js=await readFile(new URL('../../digital-stewardship-04.js',import.meta.url),'utf8');
const all=`${html}\n${js}`;

test('DS-I4 is first-party, structured-choice only and network silent',()=>{
  assert.match(html,/<script src="digital-stewardship-04\.js" defer><\/script>/);
  assert.doesNotMatch(all,/https?:\/\/|fonts\.google|jsdelivr|unpkg|\/\/cdn\./i);
  assert.doesNotMatch(html,/<textarea\b|contenteditable\s*=|<input\b/i);
  assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/i);
});

test('DS-I4 never stores merchant, exact-price, payment, URL or offer-copy fields',()=>{
  for(const field of ['merchantName','appName','serviceName','exactPrice','priceValue','currency','cardNumber','paymentMethod','accountId','receiptText','offerText','offerUrl','url','screenshot','emailAddress','phoneNumber','freeText','notes']) assert.doesNotMatch(js,new RegExp(`\\b${field}\\b`,'i'));
  assert.match(all,/Do not type the merchant, app, price, payment details, URL, receipt, or offer text into Clove/i);
});

test('evidence and decision boundaries are explicit',()=>{
  assert.match(all,/Clove does not decide whether an offer is legal, deceptive, fair, or personalized/i);
  assert.match(all,/A personalized offer is not proof of a personalized base price/i);
  assert.match(all,/No purchase or cancellation happens inside Clove/i);
  assert.doesNotMatch(all,/surveillance pricing is happening|this merchant is deceptive|illegal pricing/i);
});

test('only coarse local-state fields are named',()=>{
  for(const field of ['schemaVersion','stage','offerType','headlineClear','billingPattern','renewalShown','timingShown','conditionShown','addonsObserved','decision']) assert.match(js,new RegExp(`\\b${field}\\b`));
});

test('low-literacy primitives are present',()=>{
  assert.match(html,/min-height:\s*44px/i);
  assert.match(html,/prefers-reduced-motion:\s*reduce/i);
  assert.match(html,/role="status"/i);
  assert.match(html,/<noscript>/i);
  assert.match(all,/>STOP</i);
});
