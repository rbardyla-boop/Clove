import test from 'node:test';
import assert from 'node:assert/strict';

const STAGES=['BOUNDARY','INTERRUPTION_CLASS','INTENT','CHANGE_DECISION','REAL_LIFE_CHECK','RECOVER','COMPLETE','STOPPED_SAFE'];
const ELIGIBLE=new Set(['marketing','social','news_entertainment','game','shopping']);
const ENUMS={
  interruptionClass:new Set([...ELIGIBLE,'unknown',null]),
  intent:new Set(['required_now','can_wait','unclear',null]),
  changeDecision:new Set(['changed','no_change',null]),
  checkResult:new Set(['nothing_important','missed_important','unsure',null]),
  recoveryResult:new Set(['restored',null]),
};
const NEXT={
  BOUNDARY:new Set(['INTERRUPTION_CLASS','STOPPED_SAFE']),
  INTERRUPTION_CLASS:new Set(['INTENT','STOPPED_SAFE']),
  INTENT:new Set(['CHANGE_DECISION','COMPLETE','STOPPED_SAFE']),
  CHANGE_DECISION:new Set(['REAL_LIFE_CHECK','COMPLETE','STOPPED_SAFE']),
  REAL_LIFE_CHECK:new Set(['RECOVER','COMPLETE','STOPPED_SAFE']),
  RECOVER:new Set(['COMPLETE','STOPPED_SAFE']),
  COMPLETE:new Set(),STOPPED_SAFE:new Set(),
};
const blank=()=>({schemaVersion:1,stage:'BOUNDARY',interruptionClass:null,intent:null,changeDecision:null,checkResult:null,recoveryResult:null});
const canTransition=(a,b)=>NEXT[a]?.has(b)===true;
function validState(s){
  if(!s||s.schemaVersion!==1||!STAGES.includes(s.stage))return false;
  if(!Object.entries(ENUMS).every(([k,a])=>a.has(s[k]??null)))return false;
  if(['BOUNDARY','INTERRUPTION_CLASS','STOPPED_SAFE'].includes(s.stage))return true;
  if(s.interruptionClass===null)return false;
  if(s.stage==='INTENT')return true;
  if(s.intent===null)return false;
  if(s.stage==='CHANGE_DECISION')return s.intent==='can_wait'&&ELIGIBLE.has(s.interruptionClass);
  if(s.stage==='REAL_LIFE_CHECK')return s.intent==='can_wait'&&ELIGIBLE.has(s.interruptionClass)&&s.changeDecision==='changed';
  if(s.stage==='RECOVER')return s.intent==='can_wait'&&ELIGIBLE.has(s.interruptionClass)&&s.changeDecision==='changed'&&['missed_important','unsure'].includes(s.checkResult);
  if(s.stage==='COMPLETE'){
    if(s.interruptionClass==='unknown')return true;
    if(['required_now','unclear'].includes(s.intent))return true;
    if(s.intent==='can_wait'&&ELIGIBLE.has(s.interruptionClass)&&s.changeDecision==='no_change')return true;
    if(s.intent==='can_wait'&&ELIGIBLE.has(s.interruptionClass)&&s.changeDecision==='changed'&&s.checkResult==='nothing_important')return true;
    if(s.intent==='can_wait'&&ELIGIBLE.has(s.interruptionClass)&&s.changeDecision==='changed'&&['missed_important','unsure'].includes(s.checkResult)&&s.recoveryResult==='restored')return true;
  }
  return false;
}

test('ordered transitions are bounded',()=>{
  assert.equal(canTransition('BOUNDARY','INTERRUPTION_CLASS'),true);
  assert.equal(canTransition('BOUNDARY','REAL_LIFE_CHECK'),false);
  assert.equal(canTransition('INTENT','REAL_LIFE_CHECK'),false);
});

test('STOP is reachable from every nonterminal stage',()=>{
  for(const stage of ['BOUNDARY','INTERRUPTION_CLASS','INTENT','CHANGE_DECISION','REAL_LIFE_CHECK','RECOVER'])assert.equal(canTransition(stage,'STOPPED_SAFE'),true,stage);
});

test('terminal branches validate',()=>{
  assert.equal(validState({...blank(),stage:'COMPLETE',interruptionClass:'marketing',intent:'required_now'}),true);
  assert.equal(validState({...blank(),stage:'COMPLETE',interruptionClass:'social',intent:'unclear'}),true);
  assert.equal(validState({...blank(),stage:'COMPLETE',interruptionClass:'unknown',intent:'can_wait'}),true);
  assert.equal(validState({...blank(),stage:'COMPLETE',interruptionClass:'marketing',intent:'can_wait',changeDecision:'no_change'}),true);
  assert.equal(validState({...blank(),stage:'COMPLETE',interruptionClass:'marketing',intent:'can_wait',changeDecision:'changed',checkResult:'nothing_important'}),true);
  assert.equal(validState({...blank(),stage:'COMPLETE',interruptionClass:'social',intent:'can_wait',changeDecision:'changed',checkResult:'missed_important',recoveryResult:'restored'}),true);
});

test('forged later-stage states are rejected',()=>{
  assert.equal(validState({...blank(),stage:'REAL_LIFE_CHECK',interruptionClass:'marketing',intent:'can_wait'}),false);
  assert.equal(validState({...blank(),stage:'RECOVER',interruptionClass:'social',intent:'can_wait',changeDecision:'changed'}),false);
  assert.equal(validState({...blank(),stage:'COMPLETE',interruptionClass:'social',intent:'can_wait',changeDecision:'changed',checkResult:'missed_important'}),false);
});

test('unknown class is inspection-only and cannot enter change stage',()=>{
  assert.equal(validState({...blank(),stage:'CHANGE_DECISION',interruptionClass:'unknown',intent:'can_wait'}),false);
  assert.equal(validState({...blank(),stage:'REAL_LIFE_CHECK',interruptionClass:'unknown',intent:'can_wait',changeDecision:'changed'}),false);
});

test('identity/content-shaped enum values are rejected',()=>{
  assert.equal(validState({...blank(),stage:'INTENT',interruptionClass:'Instagram'}),false);
  assert.equal(validState({...blank(),stage:'INTENT',interruptionClass:'marketing',intent:'john@example.com'}),false);
  assert.equal(validState({...blank(),schemaVersion:99}),false);
  assert.equal(validState({...blank(),stage:'HACKED'}),false);
});
