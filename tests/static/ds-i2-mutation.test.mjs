import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js=await readFile(new URL('../../digital-stewardship-02.js',import.meta.url),'utf8');
const html=await readFile(new URL('../../digital-stewardship-02.html',import.meta.url),'utf8');
const all=`${html}\n${js}`;

const network=s=>/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/i.test(s);
const sensitive=s=>/\b(?:emailAddress|providerName|serviceName|username|phoneNumber|accountId|passwordValue|authToken|recoveryCode|messageSubject|messageBody|freeText|notes)\b/i.test(s);
function unsafe(s){
  return String(s).split(/[\n.!?]+/).some(part=>{
    const p=part.trim();if(!p)return false;
    if(/\b(?:do not|don't|never|must not|will not|cannot|can't)\b/i.test(p))return false;
    return /move (?:your )?(?:bank|banking|government|health|password-manager|critical) account|log out now to prove|reset (?:your )?password to test|use (?:a )?backup code to test|this makes you anonymous|use (?:a )?(?:burner|disposable) phone to evade/i.test(p);
  });
}
const illegal=s=>/BOUNDARY:new Set\(\[[^\]]*RECOVERY_AWARENESS/.test(s);

test('clean source triggers no negative-control detector',()=>{
  assert.equal(network(js),false);
  assert.equal(sensitive(js),false);
  assert.equal(unsafe(all),false);
  assert.equal(illegal(js),false);
});

test('network/mail-send mutation is rejected',()=>assert.equal(network(`${js}\nfetch('/mail',{method:'POST'})`),true));
test('sensitive email/provider field mutation is rejected',()=>assert.equal(sensitive(js.replace('schemaVersion:1,stage:',"schemaVersion:1,emailAddress:'x@example.com',stage:")),true));
test('critical migration instruction mutation is rejected',()=>assert.equal(unsafe(`${all}\nMove your bank account to the secondary email.`),true));
test('destructive recovery mutation is rejected',()=>assert.equal(unsafe(`${all}\nLog out now to prove recovery works.`),true));
test('anonymity mutation is rejected',()=>assert.equal(unsafe(`${all}\nThis makes you anonymous.`),true));
test('illegal stage mutation is rejected',()=>{
  const bad=js.replace("BOUNDARY:new Set(['CURRENT_PATTERN','STOPPED_SAFE'])","BOUNDARY:new Set(['CURRENT_PATTERN','RECOVERY_AWARENESS','STOPPED_SAFE'])");
  assert.equal(illegal(bad),true);
});
