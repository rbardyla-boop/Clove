import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js=await readFile(new URL('../../digital-stewardship-06.js',import.meta.url),'utf8');
const html=await readFile(new URL('../../digital-stewardship-06.html',import.meta.url),'utf8');
const all=`${html}\n${js}`;
const network=s=>/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/i.test(s);
const storage=s=>/localStorage|sessionStorage|indexedDB|document\.cookie|cookieStore/i.test(s);
const sensitive=s=>/\b(?:serviceName|providerName|accountName|userName|emailAddress|phoneNumber|passwordValue|passkeyValue|pinValue|twoFactorCode|recoveryCode|backupCode|recoveryEmail|recoveryPhone|securityAnswer|deviceId|supportTranscript|freeText|notes)\b/i.test(s);
function unsafe(s){
  return String(s).split(/[\n.!?]+/).some(part=>{
    const p=part.trim();if(!p)return false;
    if(/bypass (?:official )?(?:account )?recovery|use someone else's recovery (?:code|method)/i.test(p))return true;
    if(/\b(?:do not|don't|never|must not|will not|cannot|can't|does not|doesn't|is not|isn't)\b/i.test(p))return false;
    return /reset your password now|disable two-factor authentication|remove your recovery method|revoke all sessions|delete the account now|this account is secure|your account is compromised/i.test(p);
  });
}
const illegal=s=>/BOUNDARY:new Set\(\[[^\]]*DECISION/.test(s);

test('clean source triggers no negative-control detector',()=>{
  assert.equal(network(js),false);assert.equal(storage(js),false);assert.equal(sensitive(js),false);assert.equal(unsafe(all),false);assert.equal(illegal(js),false);
});
test('network mutation rejected',()=>assert.equal(network(`${js}\nfetch('/event',{method:'POST'})`),true));
test('persistence mutation rejected',()=>assert.equal(storage(`${js}\nlocalStorage.setItem('recovery','yes')`),true));
test('credential/code field mutation rejected',()=>assert.equal(sensitive(`${js}\nconst passwordValue='secret'; const recoveryCode='123';`),true));
test('destructive recovery mutations rejected',()=>{
  assert.equal(unsafe(`${all}\nReset your password now.`),true);
  assert.equal(unsafe(`${all}\nDisable two-factor authentication.`),true);
  assert.equal(unsafe(`${all}\nRevoke all sessions and delete the account now.`),true);
});
test('false security/compromise guarantees rejected',()=>{
  assert.equal(unsafe(`${all}\nThis account is secure.`),true);
  assert.equal(unsafe(`${all}\nYour account is compromised.`),true);
});
test('recovery bypass mutation rejected',()=>assert.equal(unsafe(`${all}\nBypass official account recovery.`),true));
test('illegal transition mutation rejected',()=>{
  const bad=js.replace("BOUNDARY:new Set(['NORMAL_ACCESS','STOPPED_SAFE'])","BOUNDARY:new Set(['NORMAL_ACCESS','DECISION','STOPPED_SAFE'])");
  assert.equal(illegal(bad),true);
});
