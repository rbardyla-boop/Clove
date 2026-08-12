import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js=await readFile(new URL('../../digital-stewardship-00.js',import.meta.url),'utf8');
const html=await readFile(new URL('../../digital-stewardship-00.html',import.meta.url),'utf8');

function networkViolations(source){return /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/i.test(source)?['network']:[];}
function sensitiveFieldViolations(source){return /\b(?:providerName|serviceName|username|emailAddress|phoneNumber|passwordValue|passwordSecret|authToken|recoveryCode|freeText|notes)\b/i.test(source)?['sensitive-field']:[];}
function destructiveCopyViolations(source){return /log out now to prove|remove (?:your )?(?:mfa|multi-factor authentication) to test|use (?:a )?backup code to test/i.test(source)?['destructive-copy']:[];}
function boundaryTransitions(source){
  const match=source.match(/BOUNDARY:new Set\(\[([^\]]+)\]\)/);
  return match?match[1]:'';
}
function illegalTransitionViolations(source){return /SAFE_CHECK|COMPLETE|RECOVERY/.test(boundaryTransitions(source))?['illegal-boundary-transition']:[];}

test('clean DS-I0 source triggers no mutation detector',()=>{
  assert.deepEqual(networkViolations(js),[]);
  assert.deepEqual(sensitiveFieldViolations(js),[]);
  assert.deepEqual(destructiveCopyViolations(`${html}\n${js}`),[]);
  assert.deepEqual(illegalTransitionViolations(js),[]);
});

test('network mutation is rejected',()=>{
  const bad=`${js}\nfetch('/collect',{method:'POST'});`;
  assert.deepEqual(networkViolations(bad),['network']);
});

test('sensitive local-field mutation is rejected',()=>{
  const bad=js.replace('schemaVersion:1,stage:',"schemaVersion:1,providerName:'example',stage:");
  assert.deepEqual(sensitiveFieldViolations(bad),['sensitive-field']);
});

test('destructive recovery instruction mutation is rejected',()=>{
  const bad=`${html}\n<p>Log out now to prove your recovery works.</p>`;
  assert.deepEqual(destructiveCopyViolations(bad),['destructive-copy']);
});

test('illegal stage-transition mutation is rejected',()=>{
  const bad=js.replace("BOUNDARY:new Set(['DEVICE','STOPPED_SAFE'])","BOUNDARY:new Set(['DEVICE','SAFE_CHECK','STOPPED_SAFE'])");
  assert.deepEqual(illegalTransitionViolations(bad),['illegal-boundary-transition']);
});
