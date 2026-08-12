import test from 'node:test';
import assert from 'node:assert/strict';

const STAGES=['BOUNDARY','NORMAL_ACCESS','RECOVERY_SETTINGS','RECOGNIZABLE_METHOD','SECOND_ROUTE','DECISION','COMPLETE','STOPPED_SAFE'];
const ANSWERS=new Set(['yes','no','unsure',null]);
const DECISIONS=new Set(['ready_enough','update_later','official_help','need_help',null]);
const NEXT={
  BOUNDARY:new Set(['NORMAL_ACCESS','STOPPED_SAFE']),
  NORMAL_ACCESS:new Set(['RECOVERY_SETTINGS','DECISION','STOPPED_SAFE']),
  RECOVERY_SETTINGS:new Set(['RECOGNIZABLE_METHOD','DECISION','STOPPED_SAFE']),
  RECOGNIZABLE_METHOD:new Set(['SECOND_ROUTE','STOPPED_SAFE']),
  SECOND_ROUTE:new Set(['DECISION','STOPPED_SAFE']),
  DECISION:new Set(['COMPLETE','STOPPED_SAFE']),
  COMPLETE:new Set(),STOPPED_SAFE:new Set(),
};
const blank=()=>({stage:'BOUNDARY',normalAccess:null,settingsFound:null,recognizableMethod:null,secondRoute:null,decision:null});
const canTransition=(a,b)=>NEXT[a]?.has(b)===true;
function decisionReady(s){
  if(s.normalAccess===null)return false;
  if(s.normalAccess!=='yes')return s.settingsFound===null&&s.recognizableMethod===null&&s.secondRoute===null;
  if(s.settingsFound===null)return false;
  if(s.settingsFound!=='yes')return s.recognizableMethod===null&&s.secondRoute===null;
  return s.recognizableMethod!==null&&s.secondRoute!==null;
}
function validState(s){
  if(!s||!STAGES.includes(s.stage)||!ANSWERS.has(s.normalAccess??null)||!ANSWERS.has(s.settingsFound??null)||!ANSWERS.has(s.recognizableMethod??null)||!ANSWERS.has(s.secondRoute??null)||!DECISIONS.has(s.decision??null))return false;
  if(['BOUNDARY','NORMAL_ACCESS','STOPPED_SAFE'].includes(s.stage))return true;
  if(s.normalAccess===null)return false;
  if(s.stage==='RECOVERY_SETTINGS')return s.normalAccess==='yes';
  if(s.stage==='RECOGNIZABLE_METHOD')return s.normalAccess==='yes'&&s.settingsFound==='yes';
  if(s.stage==='SECOND_ROUTE')return s.normalAccess==='yes'&&s.settingsFound==='yes'&&s.recognizableMethod!==null;
  if(s.stage==='DECISION')return decisionReady(s);
  if(s.stage==='COMPLETE'){
    if(!decisionReady(s)||s.decision===null)return false;
    if(s.decision==='ready_enough')return s.normalAccess==='yes'&&s.settingsFound==='yes'&&s.recognizableMethod==='yes'&&s.secondRoute==='yes';
    return true;
  }
  return false;
}

test('ordered transitions and conservative short branches are bounded',()=>{
  assert.equal(canTransition('BOUNDARY','NORMAL_ACCESS'),true);
  assert.equal(canTransition('BOUNDARY','DECISION'),false);
  assert.equal(canTransition('NORMAL_ACCESS','DECISION'),true);
  assert.equal(canTransition('RECOVERY_SETTINGS','DECISION'),true);
  assert.equal(canTransition('RECOGNIZABLE_METHOD','DECISION'),false);
});

test('STOP is reachable from every nonterminal stage',()=>{
  for(const stage of ['BOUNDARY','NORMAL_ACCESS','RECOVERY_SETTINGS','RECOGNIZABLE_METHOD','SECOND_ROUTE','DECISION'])assert.equal(canTransition(stage,'STOPPED_SAFE'),true,stage);
});

test('full ready path and conservative outcomes validate',()=>{
  assert.equal(validState({...blank(),stage:'COMPLETE',normalAccess:'yes',settingsFound:'yes',recognizableMethod:'yes',secondRoute:'yes',decision:'ready_enough'}),true);
  assert.equal(validState({...blank(),stage:'COMPLETE',normalAccess:'no',decision:'official_help'}),true);
  assert.equal(validState({...blank(),stage:'COMPLETE',normalAccess:'yes',settingsFound:'no',decision:'need_help'}),true);
  assert.equal(validState({...blank(),stage:'COMPLETE',normalAccess:'yes',settingsFound:'yes',recognizableMethod:'unsure',secondRoute:'no',decision:'update_later'}),true);
});

test('ready-enough cannot be forged from incomplete or uncertain recovery evidence',()=>{
  assert.equal(validState({...blank(),stage:'COMPLETE',normalAccess:'yes',settingsFound:'yes',recognizableMethod:'yes',secondRoute:'no',decision:'ready_enough'}),false);
  assert.equal(validState({...blank(),stage:'COMPLETE',normalAccess:'yes',settingsFound:'yes',recognizableMethod:'unsure',secondRoute:'yes',decision:'ready_enough'}),false);
});

test('forged later-stage states are rejected',()=>{
  assert.equal(validState({...blank(),stage:'RECOVERY_SETTINGS'}),false);
  assert.equal(validState({...blank(),stage:'RECOGNIZABLE_METHOD',normalAccess:'yes'}),false);
  assert.equal(validState({...blank(),stage:'SECOND_ROUTE',normalAccess:'yes',settingsFound:'yes'}),false);
  assert.equal(validState({...blank(),stage:'DECISION',normalAccess:'yes',settingsFound:'yes'}),false);
});

test('credential, contact and provider-shaped enum values are rejected',()=>{
  assert.equal(validState({...blank(),stage:'RECOVERY_SETTINGS',normalAccess:'john@example.com'}),false);
  assert.equal(validState({...blank(),stage:'RECOGNIZABLE_METHOD',normalAccess:'yes',settingsFound:'Google'}),false);
  assert.equal(validState({...blank(),stage:'HACKED'}),false);
});
