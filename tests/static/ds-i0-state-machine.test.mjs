import test from 'node:test';
import assert from 'node:assert/strict';

const stages = ['BOUNDARY','DEVICE','ACCESS_MODE','ACCOUNT','SERVICE_CLOUD','RECOVERY','SAFE_CHECK','COMPLETE','STOPPED_SAFE'];
const next = {
  BOUNDARY: new Set(['DEVICE','STOPPED_SAFE']),
  DEVICE: new Set(['ACCESS_MODE','STOPPED_SAFE']),
  ACCESS_MODE: new Set(['ACCOUNT','STOPPED_SAFE']),
  ACCOUNT: new Set(['SERVICE_CLOUD','STOPPED_SAFE']),
  SERVICE_CLOUD: new Set(['RECOVERY','STOPPED_SAFE']),
  RECOVERY: new Set(['SAFE_CHECK','STOPPED_SAFE']),
  SAFE_CHECK: new Set(['COMPLETE','STOPPED_SAFE']),
  COMPLETE: new Set(),
  STOPPED_SAFE: new Set(),
};

const enums = {
  deviceClass: new Set(['phone','tablet','computer','other','unknown',null]),
  accessMode: new Set(['app','browser','both','unknown',null]),
  hasAccount: new Set(['yes','no','unknown',null]),
  providerPersistenceBelief: new Set(['yes','no','unknown',null]),
  recoveryClass: new Set(['contact','auth','support','unknown',null]),
  recoveryCheckResult: new Set(['current','location','unknown',null]),
};
const requiredBefore = {
  BOUNDARY: [], DEVICE: [],
  ACCESS_MODE: ['deviceClass'],
  ACCOUNT: ['deviceClass','accessMode'],
  SERVICE_CLOUD: ['deviceClass','accessMode','hasAccount'],
  RECOVERY: ['deviceClass','accessMode','hasAccount','providerPersistenceBelief'],
  SAFE_CHECK: ['deviceClass','accessMode','hasAccount','providerPersistenceBelief','recoveryClass'],
  COMPLETE: ['deviceClass','accessMode','hasAccount','providerPersistenceBelief','recoveryClass','recoveryCheckResult'],
  STOPPED_SAFE: [],
};

function blank(){return {schemaVersion:1,stage:'BOUNDARY',deviceClass:null,accessMode:null,hasAccount:null,providerPersistenceBelief:null,recoveryClass:null,recoveryCheckResult:null};}
function canTransition(from,to){return next[from]?.has(to) === true;}
function validState(s){
  if (!s || s.schemaVersion !== 1 || !stages.includes(s.stage)) return false;
  if (!Object.entries(enums).every(([k,allowed]) => allowed.has(s[k] ?? null))) return false;
  return requiredBefore[s.stage].every(field => s[field] !== null && s[field] !== undefined);
}

function full(overrides={}){
  return {...blank(),deviceClass:'phone',accessMode:'browser',hasAccount:'yes',providerPersistenceBelief:'yes',recoveryClass:'contact',recoveryCheckResult:'current',...overrides};
}

test('oracle accepts the intended full path only in order', () => {
  const path = ['BOUNDARY','DEVICE','ACCESS_MODE','ACCOUNT','SERVICE_CLOUD','RECOVERY','SAFE_CHECK','COMPLETE'];
  for (let i=0;i<path.length-1;i++) assert.equal(canTransition(path[i],path[i+1]), true);
});

test('STOPPED_SAFE is reachable from every nonterminal user stage', () => {
  for (const stage of ['BOUNDARY','DEVICE','ACCESS_MODE','ACCOUNT','SERVICE_CLOUD','RECOVERY','SAFE_CHECK']) {
    assert.equal(canTransition(stage,'STOPPED_SAFE'), true, stage);
  }
});

test('illegal stage skips are rejected', () => {
  assert.equal(canTransition('BOUNDARY','SAFE_CHECK'), false);
  assert.equal(canTransition('DEVICE','RECOVERY'), false);
  assert.equal(canTransition('ACCOUNT','COMPLETE'), false);
  assert.equal(canTransition('COMPLETE','DEVICE'), false);
});

test('unknown schema, stage, and enum values are rejected', () => {
  const base = blank();
  assert.equal(validState(base), true);
  assert.equal(validState({...base,schemaVersion:99}), false);
  assert.equal(validState({...base,stage:'HACKED'}), false);
  assert.equal(validState({...base,deviceClass:'iphone-ryans-phone'}), false);
  assert.equal(validState({...base,recoveryClass:'john@example.com'}), false);
});

test('later stages require all prior coarse answers even when a forged state uses valid enums', () => {
  assert.equal(validState({...blank(),stage:'SAFE_CHECK',recoveryClass:'contact'}), false);
  assert.equal(validState(full({stage:'SAFE_CHECK',recoveryCheckResult:null})), true);
  assert.equal(validState(full({stage:'COMPLETE',recoveryCheckResult:null})), false);
  assert.equal(validState(full({stage:'COMPLETE'})), true);
});

test('privacy mutation controls reject identity-shaped values by enum design', () => {
  for (const [field,bad] of [
    ['deviceClass','Pixel 9 serial 123'],
    ['accessMode','Chrome user Ryan'],
    ['hasAccount','ryan@example.com'],
    ['recoveryClass','+1-902-555-1212'],
    ['recoveryCheckResult','backup-code-1234'],
  ]) assert.equal(validState({...blank(),[field]:bad}), false, field);
});
