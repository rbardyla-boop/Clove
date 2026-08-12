import test from 'node:test';
import assert from 'node:assert/strict';

const STAGES=['BOUNDARY','SETTING_CLASS','CLASSIFY','CHANGE_DECISION','TASK_CHECK','RECOVER','COMPLETE','STOPPED_SAFE'];
const ELIGIBLE=new Set(['location','contacts','photos_files','ordinary_notifications','marketing_messages']);
const ENUMS={
  settingClass:new Set([...ELIGIBLE,'unknown',null]),
  classification:new Set(['required','optional','unclear',null]),
  changeDecision:new Set(['changed','no_change',null]),
  taskResult:new Set(['works','fails','unsure',null]),
  recoveryResult:new Set(['restored_works','restored_still_broken',null]),
};
const NEXT={
  BOUNDARY:new Set(['SETTING_CLASS','STOPPED_SAFE']),
  SETTING_CLASS:new Set(['CLASSIFY','STOPPED_SAFE']),
  CLASSIFY:new Set(['CHANGE_DECISION','COMPLETE','STOPPED_SAFE']),
  CHANGE_DECISION:new Set(['TASK_CHECK','COMPLETE','STOPPED_SAFE']),
  TASK_CHECK:new Set(['RECOVER','COMPLETE','STOPPED_SAFE']),
  RECOVER:new Set(['COMPLETE','STOPPED_SAFE']),
  COMPLETE:new Set(),STOPPED_SAFE:new Set(),
};
const blank=()=>({schemaVersion:1,stage:'BOUNDARY',settingClass:null,classification:null,changeDecision:null,taskResult:null,recoveryResult:null});
const canTransition=(from,to)=>NEXT[from]?.has(to)===true;

function validState(s){
  if(!s||s.schemaVersion!==1||!STAGES.includes(s.stage)) return false;
  if(!Object.entries(ENUMS).every(([k,a])=>a.has(s[k]??null))) return false;
  if(s.stage==='BOUNDARY'||s.stage==='SETTING_CLASS'||s.stage==='STOPPED_SAFE') return true;
  if(s.settingClass===null) return false;
  if(s.stage==='CLASSIFY') return true;
  if(s.classification===null) return false;
  if(s.stage==='CHANGE_DECISION') return s.classification==='optional'&&ELIGIBLE.has(s.settingClass);
  if(s.stage==='TASK_CHECK') return s.classification==='optional'&&ELIGIBLE.has(s.settingClass)&&s.changeDecision==='changed';
  if(s.stage==='RECOVER') return s.classification==='optional'&&ELIGIBLE.has(s.settingClass)&&s.changeDecision==='changed'&&['fails','unsure'].includes(s.taskResult);
  if(s.stage==='COMPLETE'){
    if(s.settingClass==='unknown') return true;
    if(['required','unclear'].includes(s.classification)) return true;
    if(s.classification==='optional'&&ELIGIBLE.has(s.settingClass)&&s.changeDecision==='no_change') return true;
    if(s.classification==='optional'&&ELIGIBLE.has(s.settingClass)&&s.changeDecision==='changed'&&s.taskResult==='works') return true;
    if(s.classification==='optional'&&ELIGIBLE.has(s.settingClass)&&s.changeDecision==='changed'&&['fails','unsure'].includes(s.taskResult)&&['restored_works','restored_still_broken'].includes(s.recoveryResult)) return true;
    return false;
  }
  return false;
}

test('allowed transitions are bounded',()=>{
  assert.equal(canTransition('BOUNDARY','SETTING_CLASS'),true);
  assert.equal(canTransition('BOUNDARY','TASK_CHECK'),false);
  assert.equal(canTransition('CLASSIFY','TASK_CHECK'),false);
  assert.equal(canTransition('RECOVER','CHANGE_DECISION'),false);
});

test('STOPPED_SAFE is reachable from every nonterminal stage',()=>{
  for(const stage of ['BOUNDARY','SETTING_CLASS','CLASSIFY','CHANGE_DECISION','TASK_CHECK','RECOVER']) assert.equal(canTransition(stage,'STOPPED_SAFE'),true,stage);
});

test('branch-specific valid terminal states are accepted',()=>{
  assert.equal(validState({...blank(),stage:'COMPLETE',settingClass:'location',classification:'required'}),true);
  assert.equal(validState({...blank(),stage:'COMPLETE',settingClass:'contacts',classification:'unclear'}),true);
  assert.equal(validState({...blank(),stage:'COMPLETE',settingClass:'location',classification:'optional',changeDecision:'no_change'}),true);
  assert.equal(validState({...blank(),stage:'COMPLETE',settingClass:'location',classification:'optional',changeDecision:'changed',taskResult:'works'}),true);
  assert.equal(validState({...blank(),stage:'COMPLETE',settingClass:'location',classification:'optional',changeDecision:'changed',taskResult:'fails',recoveryResult:'restored_works'}),true);
  assert.equal(validState({...blank(),stage:'COMPLETE',settingClass:'unknown',classification:'optional'}),true);
});

test('forged later-stage states are rejected',()=>{
  assert.equal(validState({...blank(),stage:'TASK_CHECK',settingClass:'location',classification:'optional'}),false);
  assert.equal(validState({...blank(),stage:'RECOVER',settingClass:'location',classification:'optional',changeDecision:'changed',taskResult:null}),false);
  assert.equal(validState({...blank(),stage:'COMPLETE',settingClass:'location',classification:'optional',changeDecision:'changed',taskResult:'fails'}),false);
});

test('unknown setting remains inspection-only and cannot enter change stage',()=>{
  assert.equal(validState({...blank(),stage:'CHANGE_DECISION',settingClass:'unknown',classification:'optional'}),false);
  assert.equal(validState({...blank(),stage:'TASK_CHECK',settingClass:'unknown',classification:'optional',changeDecision:'changed'}),false);
});

test('deferred sign-in class and identity-shaped values are rejected',()=>{
  assert.equal(validState({...blank(),stage:'CLASSIFY',settingClass:'account_linking'}),false);
  assert.equal(validState({...blank(),stage:'CLASSIFY',settingClass:'Google'}),false);
  assert.equal(validState({...blank(),stage:'CLASSIFY',settingClass:'location',classification:'ryan@example.com'}),false);
  assert.equal(validState({...blank(),schemaVersion:99}),false);
  assert.equal(validState({...blank(),stage:'HACKED'}),false);
});
