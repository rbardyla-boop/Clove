import test from 'node:test';
import assert from 'node:assert/strict';

const STAGES=['BOUNDARY','CURRENT_PATTERN','EXISTING_LANE','RECEIVE_CHECK','RECOVERY_AWARENESS','FUTURE_RULE','COMPLETE','STOPPED_SAFE'];
const ENUMS={
  currentPattern:new Set(['mixed','separate','unknown',null]),
  laneType:new Set(['secondary','alias','none','unknown',null]),
  receiveResult:new Set(['received','failed','declined','not_run',null]),
  recoveryAwareness:new Set(['current','uncertain','unknown','not_run',null]),
  futureRule:new Set(['low_stakes_lane','keep_current','need_help',null]),
};
const NEXT={
  BOUNDARY:new Set(['CURRENT_PATTERN','STOPPED_SAFE']),
  CURRENT_PATTERN:new Set(['EXISTING_LANE','STOPPED_SAFE']),
  EXISTING_LANE:new Set(['RECEIVE_CHECK','FUTURE_RULE','STOPPED_SAFE']),
  RECEIVE_CHECK:new Set(['RECOVERY_AWARENESS','STOPPED_SAFE']),
  RECOVERY_AWARENESS:new Set(['FUTURE_RULE','STOPPED_SAFE']),
  FUTURE_RULE:new Set(['COMPLETE','STOPPED_SAFE']),
  COMPLETE:new Set(),STOPPED_SAFE:new Set(),
};
const blank=()=>({schemaVersion:1,stage:'BOUNDARY',currentPattern:null,laneType:null,receiveResult:null,recoveryAwareness:null,futureRule:null});
const canTransition=(from,to)=>NEXT[from]?.has(to)===true;

function validState(s){
  if(!s||s.schemaVersion!==1||!STAGES.includes(s.stage))return false;
  if(!Object.entries(ENUMS).every(([k,a])=>a.has(s[k]??null)))return false;
  if(['BOUNDARY','CURRENT_PATTERN','STOPPED_SAFE'].includes(s.stage))return true;
  if(s.currentPattern===null)return false;
  if(s.stage==='EXISTING_LANE')return true;
  if(s.laneType===null)return false;
  if(s.stage==='RECEIVE_CHECK')return ['secondary','alias'].includes(s.laneType);
  if(s.stage==='RECOVERY_AWARENESS')return ['secondary','alias'].includes(s.laneType)&&['received','failed','declined'].includes(s.receiveResult);
  if(s.stage==='FUTURE_RULE'){
    if(['none','unknown'].includes(s.laneType))return s.receiveResult==='not_run'&&s.recoveryAwareness==='not_run';
    return ['secondary','alias'].includes(s.laneType)&&['received','failed','declined'].includes(s.receiveResult)&&['current','uncertain','unknown'].includes(s.recoveryAwareness);
  }
  if(s.stage==='COMPLETE'){
    if(s.futureRule===null)return false;
    if(['none','unknown'].includes(s.laneType))return s.receiveResult==='not_run'&&s.recoveryAwareness==='not_run';
    return ['secondary','alias'].includes(s.laneType)&&['received','failed','declined'].includes(s.receiveResult)&&['current','uncertain','unknown'].includes(s.recoveryAwareness);
  }
  return false;
}

test('ordered transitions are bounded',()=>{
  assert.equal(canTransition('BOUNDARY','CURRENT_PATTERN'),true);
  assert.equal(canTransition('BOUNDARY','RECOVERY_AWARENESS'),false);
  assert.equal(canTransition('EXISTING_LANE','RECEIVE_CHECK'),true);
  assert.equal(canTransition('EXISTING_LANE','FUTURE_RULE'),true);
  assert.equal(canTransition('RECEIVE_CHECK','COMPLETE'),false);
});

test('STOP is reachable from every nonterminal stage',()=>{
  for(const stage of ['BOUNDARY','CURRENT_PATTERN','EXISTING_LANE','RECEIVE_CHECK','RECOVERY_AWARENESS','FUTURE_RULE'])assert.equal(canTransition(stage,'STOPPED_SAFE'),true,stage);
});

test('existing-lane and no-lane terminal branches are valid',()=>{
  assert.equal(validState({...blank(),stage:'COMPLETE',currentPattern:'mixed',laneType:'secondary',receiveResult:'received',recoveryAwareness:'current',futureRule:'low_stakes_lane'}),true);
  assert.equal(validState({...blank(),stage:'COMPLETE',currentPattern:'separate',laneType:'alias',receiveResult:'failed',recoveryAwareness:'uncertain',futureRule:'keep_current'}),true);
  assert.equal(validState({...blank(),stage:'COMPLETE',currentPattern:'unknown',laneType:'none',receiveResult:'not_run',recoveryAwareness:'not_run',futureRule:'keep_current'}),true);
  assert.equal(validState({...blank(),stage:'COMPLETE',currentPattern:'mixed',laneType:'unknown',receiveResult:'not_run',recoveryAwareness:'not_run',futureRule:'need_help'}),true);
});

test('forged later-stage states are rejected',()=>{
  assert.equal(validState({...blank(),stage:'RECOVERY_AWARENESS',currentPattern:'mixed',laneType:'secondary'}),false);
  assert.equal(validState({...blank(),stage:'FUTURE_RULE',currentPattern:'mixed',laneType:'secondary',receiveResult:null,recoveryAwareness:null}),false);
  assert.equal(validState({...blank(),stage:'COMPLETE',currentPattern:'mixed',laneType:'none',receiveResult:null,recoveryAwareness:null,futureRule:'keep_current'}),false);
});

test('address/provider-shaped enum mutations are rejected',()=>{
  assert.equal(validState({...blank(),stage:'EXISTING_LANE',currentPattern:'ryan@example.com'}),false);
  assert.equal(validState({...blank(),stage:'RECEIVE_CHECK',currentPattern:'mixed',laneType:'gmail'}),false);
  assert.equal(validState({...blank(),schemaVersion:99}),false);
  assert.equal(validState({...blank(),stage:'HACKED'}),false);
});
