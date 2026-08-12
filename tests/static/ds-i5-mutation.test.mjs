import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js=await readFile(new URL('../../digital-stewardship-05.js',import.meta.url),'utf8');
const html=await readFile(new URL('../../digital-stewardship-05.html',import.meta.url),'utf8');
const all=`${html}\n${js}`;
const network=s=>/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/i.test(s);
const storage=s=>/localStorage|sessionStorage|indexedDB|document\.cookie|cookieStore/i.test(s);
const collection=s=>/<input\b|<textarea\b|type\s*=\s*["']file|upload (?:the|your) (?:photo|image|video)|enter (?:the|your) (?:content|username|recipient)/i.test(s);
function unsafe(s){
  return String(s).split(/[\n.!?]+/).some(part=>{
    const p=part.trim();if(!p)return false;
    if(/hide your identity from police|remove metadata so (?:police|law enforcement) cannot identify you/i.test(p))return true;
    if(/\b(?:do not|don't|never|must not|will not|cannot|can't|does not|doesn't|is not|isn't|not inevitable|does not guarantee)\b/i.test(p))return false;
    return /everything (?:online|on the internet) is permanent forever|ruin your career|no one will respect you|damaged goods|purity test|send the intimate image now/i.test(p);
  });
}
const illegal=s=>/BOUNDARY:new Set\(\[[^\]]*DECISION/.test(s);

test('clean source triggers no negative-control detector',()=>{
  assert.equal(network(js),false);assert.equal(storage(js),false);assert.equal(collection(all),false);assert.equal(unsafe(all),false);assert.equal(illegal(js),false);
});
test('network mutation rejected',()=>assert.equal(network(`${js}\nfetch('/event',{method:'POST'})`),true));
test('persistence mutation rejected',()=>assert.equal(storage(`${js}\nlocalStorage.setItem('answer','yes')`),true));
test('content-upload mutation rejected',()=>assert.equal(collection(`${all}\nUpload your photo here.`),true));
test('absolute permanence mutation rejected',()=>assert.equal(unsafe(`${all}\nEverything online is permanent forever.`),true));
test('career inevitability and shame mutations rejected',()=>{
  assert.equal(unsafe(`${all}\nThis will ruin your career.`),true);
  assert.equal(unsafe(`${all}\nThis is a purity test and you are damaged goods.`),true);
});
test('evasion mutation rejected',()=>assert.equal(unsafe(`${all}\nRemove metadata so law enforcement cannot identify you.`),true));
test('illegal transition mutation rejected',()=>{
  const bad=js.replace("BOUNDARY:new Set(['COPYABILITY','STOPPED_SAFE'])","BOUNDARY:new Set(['COPYABILITY','DECISION','STOPPED_SAFE'])");
  assert.equal(illegal(bad),true);
});
