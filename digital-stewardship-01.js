(() => {
'use strict';

const KEY='clove_ds_i1_v1';
const STAGES=['BOUNDARY','SETTING_CLASS','CLASSIFY','CHANGE_DECISION','TASK_CHECK','RECOVER','COMPLETE','STOPPED_SAFE'];
const ELIGIBLE=new Set(['location','contacts','photos_files','ordinary_notifications','marketing_messages']);
const NEXT={
  BOUNDARY:new Set(['SETTING_CLASS','STOPPED_SAFE']),
  SETTING_CLASS:new Set(['CLASSIFY','STOPPED_SAFE']),
  CLASSIFY:new Set(['CHANGE_DECISION','COMPLETE','STOPPED_SAFE']),
  CHANGE_DECISION:new Set(['TASK_CHECK','COMPLETE','STOPPED_SAFE']),
  TASK_CHECK:new Set(['RECOVER','COMPLETE','STOPPED_SAFE']),
  RECOVER:new Set(['COMPLETE','STOPPED_SAFE']),
  COMPLETE:new Set(),STOPPED_SAFE:new Set(),
};
const ALLOWED={
  settingClass:new Set([...ELIGIBLE,'unknown',null]),
  classification:new Set(['required','optional','unclear',null]),
  changeDecision:new Set(['changed','no_change',null]),
  taskResult:new Set(['works','fails','unsure',null]),
  recoveryResult:new Set(['restored_works','restored_still_broken',null]),
};
const blank=()=>({schemaVersion:1,stage:'BOUNDARY',settingClass:null,classification:null,changeDecision:null,taskResult:null,recoveryResult:null});

const stepLabel=document.querySelector('#stepLabel');
const question=document.querySelector('#question');
const explain=document.querySelector('#explain');
const choices=document.querySelector('#choices');
const stopButton=document.querySelector('#stopButton');
const storageStatus=document.querySelector('#storageStatus');
const helper=document.querySelector('#helper');

let state=blank();
let storageAvailable=true;
let helperOpen=false;
let transitionLock=false;

function validState(s){
  if(!s||s.schemaVersion!==1||!STAGES.includes(s.stage)) return false;
  if(!Object.entries(ALLOWED).every(([field,allowed])=>allowed.has(s[field]??null))) return false;
  if(['BOUNDARY','SETTING_CLASS','STOPPED_SAFE'].includes(s.stage)) return true;
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
  }
  return false;
}

function discard(){try{localStorage.removeItem(KEY);return true;}catch{storageAvailable=false;return false;}}
function load(){
  let raw;try{raw=localStorage.getItem(KEY);}catch{storageAvailable=false;state=blank();return;}
  if(!raw)return;
  let parsed;try{parsed=JSON.parse(raw);}catch{state=blank();discard();return;}
  if(validState(parsed)){state=parsed;return;}
  state=blank();discard();
}
function persist(){
  if(!storageAvailable)return false;
  try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{storageAvailable=false;return false;}
}
function storageNote(){storageStatus.textContent=storageAvailable?'':'Progress will not be saved on this browser. You can continue in memory, but a reload will reset the drill.';}
function transition(expected,next,patch={}){
  if(transitionLock||state.stage!==expected||!NEXT[expected]?.has(next))return false;
  transitionLock=true;
  const candidate={...state,...patch,stage:next};
  if(!validState(candidate)){transitionLock=false;return false;}
  state=candidate;persist();render();transitionLock=false;return true;
}
function button(label,action,primary=false){const b=document.createElement('button');b.type='button';b.className=`choice${primary?' primary':''}`;b.textContent=label;b.addEventListener('click',action);choices.appendChild(b);}
function clearStage(){choices.replaceChildren();helper.hidden=true;helper.textContent='';stopButton.hidden=['COMPLETE','STOPPED_SAFE'].includes(state.stage);storageNote();}

function renderBoundary(){
  stepLabel.textContent='0 / Start';question.textContent='Pick one low-risk service.';
  explain.textContent='Use a service you genuinely use for a real task. Keep the service name private. For the first run, avoid anything where a mistake could affect money, identity, health, safety, work administration, or account recovery.';
  button('I HAVE ONE',()=>transition('BOUNDARY','SETTING_CLASS'),true);
  button("I DON'T KNOW WHAT TO PICK",()=>{helperOpen=!helperOpen;helper.hidden=!helperOpen;helper.textContent='Try a weather app, streaming service, shopping app, game, newsletter, or another low-consequence service you can safely test without spending money.';});
}
function renderSetting(){
  stepLabel.textContent='1 / Setting';question.textContent='Which one setting are you inspecting?';
  explain.textContent='Choose the type only. Do not enter the service name, account, location, contacts, files, or message content. Sign-in and account-linking changes are outside this first run.';
  for(const [label,value] of [['LOCATION','location'],['CONTACTS','contacts'],['PHOTOS / FILES','photos_files'],['ORDINARY APP NOTIFICATIONS','ordinary_notifications'],['MARKETING EMAIL / SMS','marketing_messages'],['OTHER / NOT SURE','unknown']]) button(label,()=>transition('SETTING_CLASS','CLASSIFY',{settingClass:value}));
}
function finishClassification(value){
  if(state.settingClass==='unknown') return transition('CLASSIFY','COMPLETE',{classification:value});
  if(value==='optional') return transition('CLASSIFY','CHANGE_DECISION',{classification:value});
  return transition('CLASSIFY','COMPLETE',{classification:value});
}
function renderClassify(){
  stepLabel.textContent='2 / Classify';question.textContent='For the real task, is this setting required?';
  if(state.settingClass==='unknown') explain.textContent='If you cannot clearly identify the setting type, this first run is inspection only. Classify what you know, but Clove will not ask you to change it.';
  else explain.textContent='Required means the real task depends on it. Optional means you have a clear reason to think the task can work with less access. Unclear is a valid answer.';
  button('REQUIRED',()=>finishClassification('required'));
  button('OPTIONAL',()=>finishClassification('optional'),true);
  button('UNCLEAR',()=>finishClassification('unclear'));
}
function renderChange(){
  stepLabel.textContent='3 / One change';question.textContent='Change only one clearly optional setting.';
  explain.textContent='Use the normal app, service, or device settings. Reduce only the setting you just classified as optional. Do not change security, recovery, identity, payment, emergency, medical, caregiver, or on-call controls.';
  button('I CHANGED ONE OPTIONAL SETTING',()=>transition('CHANGE_DECISION','TASK_CHECK',{changeDecision:'changed'}),true);
  button('I DECIDED NOT TO CHANGE IT',()=>transition('CHANGE_DECISION','COMPLETE',{changeDecision:'no_change'}));
}
function renderTask(){
  stepLabel.textContent='4 / Real task';question.textContent='Now do the legitimate task you came here to do.';
  explain.textContent='Use the service normally. Do not create a fake identity, spoof location, bypass controls, buy something, or deliberately trigger a failure. We are testing whether the ordinary task still works after one optional change.';
  button('THE TASK STILL WORKS',()=>transition('TASK_CHECK','COMPLETE',{taskResult:'works'}),true);
  button('THE TASK DOES NOT WORK',()=>transition('TASK_CHECK','RECOVER',{taskResult:'fails'}));
  button("I'M NOT SURE",()=>transition('TASK_CHECK','RECOVER',{taskResult:'unsure'}));
}
function renderRecover(){
  stepLabel.textContent='5 / Restore';question.textContent='Restore the setting to its previous state.';
  explain.textContent='Use the same normal settings control to put back what you changed. Make no additional changes. If you cannot restore it confidently, stop and use the provider’s official help or a trusted person rather than experimenting further.';
  button('RESTORED — TASK WORKS AGAIN',()=>transition('RECOVER','COMPLETE',{recoveryResult:'restored_works'}),true);
  button('RESTORED — STILL NOT WORKING',()=>transition('RECOVER','COMPLETE',{recoveryResult:'restored_still_broken'}));
  button('I NEED HELP / STOP',()=>transition('RECOVER','STOPPED_SAFE'));
}
function resultText(){
  if(state.settingClass==='unknown') return 'The setting was not clear enough for a safe first-run change, so you left it alone.';
  if(state.classification==='required') return 'You classified the setting as required for this task and made no change.';
  if(state.classification==='unclear') return 'The setting remained unclear, so you made no change.';
  if(state.changeDecision==='no_change') return 'You classified the setting as optional but chose not to change it.';
  if(state.taskResult==='works') return 'You reduced one optional setting and the real task still worked.';
  if(state.recoveryResult==='restored_works') return 'The task stopped working, so you restored the setting and the task worked again.';
  if(state.recoveryResult==='restored_still_broken') return 'You restored the setting but the task still did not work. Stop changing settings and use official help if needed.';
  return 'You completed the check without making another change.';
}
function renderComplete(){
  stepLabel.textContent='Complete';question.textContent='CHECK COMPLETE';explain.textContent=resultText();
  const summary=document.createElement('div');summary.className='summary';
  for(const [label,value] of [['SETTING',state.settingClass==='unknown'?'NOT SURE':state.settingClass.replaceAll('_',' ').toUpperCase()],['CLASSIFICATION',(state.classification||'NONE').toUpperCase()],['CHANGE',state.changeDecision==='changed'?'ONE CHANGE':state.changeDecision==='no_change'?'NO CHANGE':'NONE'],['TASK',state.taskResult?state.taskResult.toUpperCase():'NOT RUN'],['RECOVERY',state.recoveryResult?state.recoveryResult.replaceAll('_',' ').toUpperCase():'NOT NEEDED']]){const row=document.createElement('div');row.className='row';const b=document.createElement('b');b.textContent=label;const span=document.createElement('span');span.textContent=value;row.append(b,span);summary.append(row);}choices.append(summary);
  button('START OVER SAFELY',()=>{discard();state=blank();helperOpen=false;render();});
}
function renderStopped(){stepLabel.textContent='Stopped';question.textContent='STOPPED SAFELY';explain.textContent='You can leave here. Nothing is scored, and Clove will not pressure you to change a setting you are unsure about.';button('START OVER',()=>{discard();state=blank();helperOpen=false;render();});}
function render(){clearStage();switch(state.stage){case'BOUNDARY':renderBoundary();break;case'SETTING_CLASS':renderSetting();break;case'CLASSIFY':renderClassify();break;case'CHANGE_DECISION':renderChange();break;case'TASK_CHECK':renderTask();break;case'RECOVER':renderRecover();break;case'COMPLETE':renderComplete();break;case'STOPPED_SAFE':renderStopped();break;default:state=blank();renderBoundary();}storageNote();}

stopButton.addEventListener('click',()=>{const current=state.stage;if(NEXT[current]?.has('STOPPED_SAFE'))transition(current,'STOPPED_SAFE');});
load();render();
})();
