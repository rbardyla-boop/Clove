import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js=await readFile(new URL('../../digital-stewardship-03.js',import.meta.url),'utf8');
const html=await readFile(new URL('../../digital-stewardship-03.html',import.meta.url),'utf8');
const all=`${html}\n${js}`;
const network=s=>/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/i.test(s);
const sensitive=s=>/\b(?:appName|providerName|serviceName|accountId|notificationText|senderName|emailAddress|phoneNumber|exactTime|scheduleTime|freeText|notes)\b/i.test(s);
function unsafe(s){
  return String(s).split(/[\n.!?]+/).some(part=>{
    const p=part.trim();if(!p)return false;
    if(/\b(?:do not|don't|never|must not|will not|cannot|can't)\b/i.test(p))return false;
    return /turn off all notifications|disable (?:your )?(?:security|two-factor|2fa|emergency|medical|fraud) alerts|dopamine detox|reset your brain|literally addicted/i.test(p);
  });
}
const illegal=s=>/BOUNDARY:new Set\(\[[^\]]*REAL_LIFE_CHECK/.test(s);

test('clean source triggers no mutation detector',()=>{
  assert.equal(network(js),false);assert.equal(sensitive(js),false);assert.equal(unsafe(all),false);assert.equal(illegal(js),false);
});
test('network mutation rejected',()=>assert.equal(network(`${js}\nfetch('/event',{method:'POST'})`),true));
test('sensitive field mutation rejected',()=>assert.equal(sensitive(js.replace('schemaVersion:1,stage:',"schemaVersion:1,appName:'x',stage:")),true));
test('turn-everything-off mutation rejected',()=>assert.equal(unsafe(`${all}\nTurn off all notifications.`),true));
test('critical-alert mutation rejected',()=>assert.equal(unsafe(`${all}\nDisable your security alerts.`),true));
test('dopamine-treatment mutation rejected',()=>assert.equal(unsafe(`${all}\nStart a dopamine detox to reset your brain.`),true));
test('illegal transition mutation rejected',()=>{
  const bad=js.replace("BOUNDARY:new Set(['INTERRUPTION_CLASS','STOPPED_SAFE'])","BOUNDARY:new Set(['INTERRUPTION_CLASS','REAL_LIFE_CHECK','STOPPED_SAFE'])");
  assert.equal(illegal(bad),true);
});
