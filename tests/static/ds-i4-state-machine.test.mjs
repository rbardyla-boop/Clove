import test from 'node:test';
import assert from 'node:assert/strict';

const STAGES=['BOUNDARY','OFFER_TYPE','HEADLINE','COMMITMENT_CHECK','DECISION','COMPLETE','STOPPED_SAFE'];
const TYPES=new Set(['free_trial','subscription','intro_discount','bundle_addon','one_time','other_unknown']);
const ENUMS={
  offerType:new Set([...TYPES,null]),headlineClear:new Set(['yes','no','unknown',null]),billingPattern:new Set(['one_time','recurring','unclear','not_applicable',null]),
  renewalShown:new Set(['yes','no','unknown','not_applicable',null]),timingShown:new Set(['yes','no','unknown','not_applicable',null]),conditionShown:new Set(['yes','no','unknown','not_applicable',null]),
  addonsObserved:new Set(['yes','no','unknown','not_applicable',null]),decision:new Set(['clear_continue_outside','not_clear_wait','no_longer_want','need_help_leave',null]),
};
const NEXT={BOUNDARY:new Set(['OFFER_TYPE','STOPPED_SAFE']),OFFER_TYPE:new Set(['HEADLINE','STOPPED_SAFE']),HEADLINE:new Set(['COMMITMENT_CHECK','STOPPED_SAFE']),COMMITMENT_CHECK:new Set(['DECISION','STOPPED_SAFE']),DECISION:new Set(['COMPLETE','STOPPED_SAFE']),COMPLETE:new Set(),STOPPED_SAFE:new Set()};
const blank=()=>({schemaVersion:1,stage:'BOUNDARY',offerType:null,headlineClear:null,billingPattern:null,renewalShown:null,timingShown:null,conditionShown:null,addonsObserved:null,decision:null});
const canTransition=(a,b)=>NEXT[a]?.has(b)===true;
function validState(s){
  if(!s||s.schemaVersion!==1||!STAGES.includes(s.stage))return false;
  if(!Object.entries(ENUMS).every(([k,a])=>a.has(s[k]??null)))return false;
  if(['BOUNDARY','OFFER_TYPE','STOPPED_SAFE'].includes(s.stage))return true;
  if(!TYPES.has(s.offerType))return false;
  if(s.stage==='HEADLINE')return true;
  if(s.headlineClear===null)return false;
  if(s.stage==='COMMITMENT_CHECK')return true;
  const checked=[s.billingPattern,s.renewalShown,s.timingShown,s.conditionShown,s.addonsObserved].every(v=>v!==null);
  if(s.stage==='DECISION')return checked;
  if(s.stage==='COMPLETE')return checked&&s.decision!==null;
  return false;
}

test('ordered transitions are bounded',()=>{
  assert.equal(canTransition('BOUNDARY','OFFER_TYPE'),true);
  assert.equal(canTransition('BOUNDARY','DECISION'),false);
  assert.equal(canTransition('HEADLINE','DECISION'),false);
});

test('STOP is reachable from every nonterminal stage',()=>{
  for(const stage of ['BOUNDARY','OFFER_TYPE','HEADLINE','COMMITMENT_CHECK','DECISION'])assert.equal(canTransition(stage,'STOPPED_SAFE'),true,stage);
});

test('valid complete states require a full coarse commitment check',()=>{
  assert.equal(validState({...blank(),stage:'COMPLETE',offerType:'subscription',headlineClear:'yes',billingPattern:'recurring',renewalShown:'yes',timingShown:'yes',conditionShown:'yes',addonsObserved:'no',decision:'clear_continue_outside'}),true);
  assert.equal(validState({...blank(),stage:'COMPLETE',offerType:'free_trial',headlineClear:'no',billingPattern:'unclear',renewalShown:'unknown',timingShown:'unknown',conditionShown:'unknown',addonsObserved:'unknown',decision:'not_clear_wait'}),true);
});

test('forged later-stage states are rejected',()=>{
  assert.equal(validState({...blank(),stage:'COMMITMENT_CHECK',offerType:'subscription'}),false);
  assert.equal(validState({...blank(),stage:'DECISION',offerType:'subscription',headlineClear:'yes'}),false);
  assert.equal(validState({...blank(),stage:'COMPLETE',offerType:'one_time',headlineClear:'yes',billingPattern:'one_time',renewalShown:'not_applicable',timingShown:'not_applicable',conditionShown:'yes',addonsObserved:'no'}),false);
});

test('identity, price and URL-shaped enum values are rejected',()=>{
  assert.equal(validState({...blank(),stage:'HEADLINE',offerType:'Netflix'}),false);
  assert.equal(validState({...blank(),stage:'COMMITMENT_CHECK',offerType:'subscription',headlineClear:'$9.99'}),false);
  assert.equal(validState({...blank(),stage:'COMMITMENT_CHECK',offerType:'subscription',headlineClear:'https://offer.example'}),false);
  assert.equal(validState({...blank(),schemaVersion:99}),false);
  assert.equal(validState({...blank(),stage:'HACKED'}),false);
});
