import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js=await readFile(new URL('../../digital-stewardship-04.js',import.meta.url),'utf8');
const html=await readFile(new URL('../../digital-stewardship-04.html',import.meta.url),'utf8');
const all=`${html}\n${js}`;
const network=s=>/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/i.test(s);
const sensitive=s=>/\b(?:merchantName|appName|serviceName|exactPrice|priceValue|currency|cardNumber|paymentMethod|accountId|receiptText|offerText|offerUrl|freeText|notes)\b/i.test(s);
function unsafe(s){
  return String(s).split(/[\n.!?]+/).some(part=>{
    const p=part.trim();if(!p)return false;
    if(/\b(?:do not|don't|never|must not|will not|cannot|can't|does not|doesn't|is not|isn't|no proof|not proof)\b/i.test(p))return false;
    return /surveillance pricing is happening|this merchant is deceptive|illegal pricing|buy it now|complete the purchase|cancel the subscription now|you are entitled to a refund|file a chargeback/i.test(p);
  });
}
const illegal=s=>/BOUNDARY:new Set\(\[[^\]]*DECISION/.test(s);

test('clean source triggers no mutation detector',()=>{
  assert.equal(network(js),false);assert.equal(sensitive(js),false);assert.equal(unsafe(all),false);assert.equal(illegal(js),false);
});
test('network mutation rejected',()=>assert.equal(network(`${js}\nfetch('/event',{method:'POST'})`),true));
test('exact-price/payment field mutation rejected',()=>assert.equal(sensitive(js.replace('schemaVersion:1,stage:',"schemaVersion:1,exactPrice:'9.99',stage:")),true));
test('personalized-pricing accusation rejected',()=>assert.equal(unsafe(`${all}\nSurveillance pricing is happening.`),true));
test('merchant-deception verdict rejected',()=>assert.equal(unsafe(`${all}\nThis merchant is deceptive.`),true));
test('purchase pressure rejected',()=>assert.equal(unsafe(`${all}\nBuy it now and complete the purchase.`),true));
test('cancellation/legal advice rejected',()=>assert.equal(unsafe(`${all}\nCancel the subscription now. You are entitled to a refund.`),true));
test('illegal transition mutation rejected',()=>{
  const bad=js.replace("BOUNDARY:new Set(['OFFER_TYPE','STOPPED_SAFE'])","BOUNDARY:new Set(['OFFER_TYPE','DECISION','STOPPED_SAFE'])");
  assert.equal(illegal(bad),true);
});
