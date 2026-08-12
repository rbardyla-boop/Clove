import test from 'node:test';
import assert from 'node:assert/strict';

const STAGES=['BOUNDARY','COPYABILITY','AUDIENCE_WIDENING','FUTURE_CONTEXT','DECISION','COMPLETE','STOPPED_SAFE'];
const ANSWERS=new Set(['yes','no','unsure',null]);
const DECISIONS=new Set(['wait','share_less','do_not_share','share_outside','need_help',null]);
const NEXT={BOUNDARY:new Set(['COPYABILITY','STOPPED_SAFE']),COPYABILITY:new Set(['AUDIENCE_WIDENING','STOPPED_SAFE']),AUDIENCE_WIDENING:new Set(['FUTURE_CONTEXT','STOPPED_SAFE']),FUTURE_CONTEXT:new Set(['DECISION','STOPPED_SAFE']),DECISION:new Set(['COMPLETE','STOPPED_SAFE']),COMPLETE:new Set(),STOPPED_SAFE:new Set()};
const blank=()=>({stage:'BOUNDARY',copyability:null,audienceWidening:null,futureContext:null,decision:null});
const canTransition=(a,b)=>NEXT[a]?.has(b)===true;
function validState(s){
  if(!s||!STAGES.includes(s.stage)||!ANSWERS.has(s.copyability??null)||!ANSWERS.has(s.audienceWidening??null)||!ANSWERS.has(s.futureContext??null)||!DECISIONS.has(s.decision??null))return false;
  if(['BOUNDARY','COPYABILITY','STOPPED_SAFE'].includes(s.stage))return true;
  if(s.copyability===null)return false;
  if(s.stage==='AUDIENCE_WIDENING')return true;
  if(s.audienceWidening===null)return false;
  if(s.stage==='FUTURE_CONTEXT')return true;
  if(s.futureContext===null)return false;
  if(s.stage==='DECISION')return true;
  if(s.stage==='COMPLETE')return s.decision!==null;
  return false;
}

test('ordered transitions are bounded',()=>{
  assert.equal(canTransition('BOUNDARY','COPYABILITY'),true);
  assert.equal(canTransition('BOUNDARY','DECISION'),false);
  assert.equal(canTransition('COPYABILITY','FUTURE_CONTEXT'),false);
});

test('STOP is reachable from every nonterminal stage',()=>{
  for(const stage of ['BOUNDARY','COPYABILITY','AUDIENCE_WIDENING','FUTURE_CONTEXT','DECISION']) assert.equal(canTransition(stage,'STOPPED_SAFE'),true,stage);
});

test('all decision outcomes are valid after three coarse answers',()=>{
  for(const decision of ['wait','share_less','do_not_share','share_outside','need_help']) assert.equal(validState({...blank(),stage:'COMPLETE',copyability:'yes',audienceWidening:'unsure',futureContext:'yes',decision}),true,decision);
});

test('forged later-stage states are rejected',()=>{
  assert.equal(validState({...blank(),stage:'AUDIENCE_WIDENING'}),false);
  assert.equal(validState({...blank(),stage:'FUTURE_CONTEXT',copyability:'yes'}),false);
  assert.equal(validState({...blank(),stage:'DECISION',copyability:'yes',audienceWidening:'no'}),false);
  assert.equal(validState({...blank(),stage:'COMPLETE',copyability:'yes',audienceWidening:'no',futureContext:'unsure'}),false);
});

test('content, identity and URL-shaped values are rejected',()=>{
  assert.equal(validState({...blank(),stage:'AUDIENCE_WIDENING',copyability:'photo.jpg'}),false);
  assert.equal(validState({...blank(),stage:'FUTURE_CONTEXT',copyability:'yes',audienceWidening:'john@example.com'}),false);
  assert.equal(validState({...blank(),stage:'DECISION',copyability:'yes',audienceWidening:'no',futureContext:'https://example.com'}),false);
  assert.equal(validState({...blank(),stage:'HACKED'}),false);
});
