import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js=await readFile(new URL('../../digital-stewardship-01.js',import.meta.url),'utf8');
const html=await readFile(new URL('../../digital-stewardship-01.html',import.meta.url),'utf8');
const all=`${html}\n${js}`;

const network=s=>/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/i.test(s);
const sensitive=s=>/\b(?:providerName|appName|serviceName|username|emailAddress|phoneNumber|accountId|exactLocation|contactName|fileName|passwordValue|authToken|recoveryCode|freeText|notes)\b/i.test(s);
function destructive(s){
  return String(s).split(/[\n.!?]+/).some(part=>{
    const p=part.trim();
    if(!p)return false;
    if(/\b(?:do not|don't|never|must not|will not|cannot|can't)\b/i.test(p))return false;
    return /disable (?:mfa|multi-factor authentication|two-factor authentication)|disable security alerts|spoof (?:your )?location|use a false identity|unlink (?:your )?(?:sign-in|account)|delete (?:your )?account to test/i.test(p);
  });
}
const illegal=s=>/BOUNDARY:new Set\(\[[^\]]*TASK_CHECK/.test(s);

test('clean source triggers no negative-control detector',()=>{
  assert.equal(network(js),false);
  assert.equal(sensitive(js),false);
  assert.equal(destructive(all),false);
  assert.equal(illegal(js),false);
});

test('network mutation is rejected',()=>assert.equal(network(`${js}\nfetch('/collect',{method:'POST'})`),true));
test('sensitive-field mutation is rejected',()=>assert.equal(sensitive(js.replace('schemaVersion:1,stage:',"schemaVersion:1,providerName:'x',stage:")),true));
test('destructive MFA mutation is rejected',()=>assert.equal(destructive(`${all}\nDisable MFA to see if the service still works.`),true));
test('location-spoof mutation is rejected',()=>assert.equal(destructive(`${all}\nSpoof your location to compare access.`),true));
test('sign-in unlink mutation is rejected',()=>assert.equal(destructive(`${all}\nUnlink your sign-in account to test it.`),true));
test('illegal boundary transition mutation is rejected',()=>{
  const bad=js.replace("BOUNDARY:new Set(['SETTING_CLASS','STOPPED_SAFE'])","BOUNDARY:new Set(['SETTING_CLASS','TASK_CHECK','STOPPED_SAFE'])");
  assert.equal(illegal(bad),true);
});
