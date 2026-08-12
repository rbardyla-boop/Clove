(() => {
'use strict';

const KEY='clove_ds_i2_v1';
const STAGES=['BOUNDARY','CURRENT_PATTERN','EXISTING_LANE','RECEIVE_CHECK','RECOVERY_AWARENESS','FUTURE_RULE','COMPLETE','STOPPED_SAFE'];
const NEXT={
  BOUNDARY:new Set(['CURRENT_PATTERN','STOPPED_SAFE']),
  CURRENT_PATTERN:new Set(['EXISTING_LANE','STOPPED_SAFE']),
  EXISTING_LANE:new Set(['RECEIVE_CHECK','FUTURE_RULE','STOPPED_SAFE']),
  RECEIVE_CHECK:new Set(['RECOVERY_AWARENESS','STOPPED_SAFE']),
  RECOVERY_AWARENESS:new Set(['FUTURE_RULE','STOPPED_SAFE']),
  FUTURE_RULE:new Set(['COMPLETE','STOPPED_SAFE']),
  COMPLETE:new Set(),STOPPED_SAFE:new Set(),
};
const ALLOWED={
  currentPattern:new Set(['mixed','separate','unknown',null]),
  laneType:new Set(['secondary','alias','none','unknown',null]),
  receiveResult:new Set(['received','failed','declined','not_run',null]),
  recoveryAwareness:new Set(['current','uncertain','unknown','not_run',null]),
  futureRule:new Set(['low_stakes_lane','keep_current','need_help',null]),
};
const blank=()=>({schemaVersion:1,stage:'BOUNDARY',currentPattern:null,laneType:null,receiveResult:null,recoveryAwareness:null,futureRule:null});

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
  if(!s||s.schemaVersion!==1||!STAGES.includes(s.stage))return false;
  if(!Object.entries(ALLOWED).every(([field,allowed])=>allowed.has(s[field]??null)))return false;
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

function discard(){try{localStorage.removeItem(KEY);return true;}catch{storageAvailable=false;return false;}}
function load(){
  let raw;try{raw=localStorage.getItem(KEY);}catch{storageAvailable=false;state=blank();return;}
  if(!raw)return;
  let parsed;try{parsed=JSON.parse(raw);}catch{state=blank();discard();return;}
  if(validState(parsed)){state=parsed;return;}
  state=blank();discard();
}
function persist(){if(!storageAvailable)return false;try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{storageAvailable=false;return false;}}
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
  stepLabel.textContent='0 / Start';question.textContent='Ready to map your account lanes?';
  explain.textContent='Keep every address and provider private. Critical accounts are things like banking, government, primary work, health, or account recovery. Low-stakes accounts are things like newsletters, shopping, trials, forums, promotions, and non-critical downloads.';
  button("I'M READY",()=>transition('BOUNDARY','CURRENT_PATTERN'),true);
  button("I DON'T KNOW WHAT THIS MEANS",()=>{helperOpen=!helperOpen;helper.hidden=!helperOpen;helper.textContent='Think of two buckets: CRITICAL if losing access would seriously disrupt money, identity, health, work, or recovery; LOW-STAKES if losing the account would mostly be an inconvenience.';});
}
function renderPattern(){
  stepLabel.textContent='1 / Current pattern';question.textContent='Right now, how mixed are your critical and low-stakes accounts?';
  explain.textContent='You are only noticing the pattern. Do not move an account, change an address, or expose the address to Clove.';
  button('MOSTLY THE SAME EMAIL / LANE',()=>transition('CURRENT_PATTERN','EXISTING_LANE',{currentPattern:'mixed'}),true);
  button('ALREADY MOSTLY SEPARATE',()=>transition('CURRENT_PATTERN','EXISTING_LANE',{currentPattern:'separate'}));
  button("I'M NOT SURE",()=>transition('CURRENT_PATTERN','EXISTING_LANE',{currentPattern:'unknown'}));
}
function chooseLane(value){
  if(['none','unknown'].includes(value))return transition('EXISTING_LANE','FUTURE_RULE',{laneType:value,receiveResult:'not_run',recoveryAwareness:'not_run'});
  return transition('EXISTING_LANE','RECEIVE_CHECK',{laneType:value});
}
function renderLane(){
  stepLabel.textContent='2 / Existing lane';question.textContent='Do you already have a secondary email or alias you can access?';
  explain.textContent='Use only something that already exists. This drill does not require you to create an account or alias.';
  button('YES — SECONDARY EMAIL',()=>chooseLane('secondary'),true);
  button('YES — PROVIDER-SUPPORTED ALIAS',()=>chooseLane('alias'));
  button('NO',()=>chooseLane('none'));
  button("I'M NOT SURE",()=>chooseLane('unknown'));
}
function renderReceive(){
  stepLabel.textContent='3 / Receive check';question.textContent='Can the existing lane receive a harmless test message?';
  explain.textContent='Use your own mail app outside Clove. Send a simple test message to the existing secondary or alias. Do not include private information. Clove does not send, read, or record either address or the message.';
  button('TEST MESSAGE RECEIVED',()=>transition('RECEIVE_CHECK','RECOVERY_AWARENESS',{receiveResult:'received'}),true);
  button('TEST DID NOT ARRIVE',()=>transition('RECEIVE_CHECK','RECOVERY_AWARENESS',{receiveResult:'failed'}));
  button("I DON'T WANT TO TEST THIS",()=>transition('RECEIVE_CHECK','RECOVERY_AWARENESS',{receiveResult:'declined'}));
}
function renderRecovery(){
  stepLabel.textContent='4 / Recovery awareness';question.textContent='Without changing anything, can you identify how this secondary or alias is recovered?';
  explain.textContent='Inspect only. Do not log out, reset a password, change recovery email or phone, remove multi-factor authentication, or use a backup code just to test this drill.';
  button('YES — RECOVERY LOOKS CURRENT / RECOGNIZABLE',()=>transition('RECOVERY_AWARENESS','FUTURE_RULE',{recoveryAwareness:'current'}),true);
  button("I FOUND RECOVERY, BUT I'M NOT SURE IT IS CURRENT",()=>transition('RECOVERY_AWARENESS','FUTURE_RULE',{recoveryAwareness:'uncertain'}));
  button("NO / I DON'T KNOW",()=>transition('RECOVERY_AWARENESS','FUTURE_RULE',{recoveryAwareness:'unknown'}));
}
function renderRule(){
  stepLabel.textContent='5 / Future rule';question.textContent='What rule will you use after this drill?';
  const noLane=['none','unknown'].includes(state.laneType);
  const recoveryUnclear=['uncertain','unknown'].includes(state.recoveryAwareness);
  if(noLane)explain.textContent='You do not need to create anything now. The useful result is knowing whether your current setup is mixed and deciding what you will do later.';
  else if(recoveryUnclear)explain.textContent='Recovery is not clear enough to treat this lane as dependable. Do not move a critical account. A future low-stakes rule can wait until you understand the lane better.';
  else explain.textContent='Keep the rule narrow: future low-stakes sign-ups can use an existing secondary or alias when that is useful. Do not migrate critical accounts in this drill.';
  button('LOW-STAKES SIGN-UPS CAN USE A SECONDARY / ALIAS WHEN AVAILABLE',()=>transition('FUTURE_RULE','COMPLETE',{futureRule:'low_stakes_lane'}),true);
  button('KEEP MY CURRENT SETUP FOR NOW',()=>transition('FUTURE_RULE','COMPLETE',{futureRule:'keep_current'}));
  button('I NEED MORE HELP BEFORE CHANGING ANYTHING',()=>transition('FUTURE_RULE','COMPLETE',{futureRule:'need_help'}));
}
function resultText(){
  if(['none','unknown'].includes(state.laneType))return 'You mapped the current pattern. No new account was required, and no critical account was moved.';
  if(state.recoveryAwareness!=='current')return 'You inspected an existing lane, but recovery is not fully clear. No migration happened and nothing critical was moved.';
  if(state.receiveResult==='failed')return 'The test message did not arrive. You kept the result bounded and did not move a critical account.';
  if(state.receiveResult==='declined')return 'You chose not to run the receive test. That is a valid stop point; no critical account was moved.';
  return 'You confirmed an existing low-stakes lane can receive mail and found a recognizable recovery path. No critical account was moved.';
}
function renderComplete(){
  stepLabel.textContent='Complete';question.textContent='MAP COMPLETE';explain.textContent=resultText();
  const summary=document.createElement('div');summary.className='summary';
  for(const [label,value] of [['CURRENT PATTERN',(state.currentPattern||'unknown').toUpperCase()],['EXISTING LANE',(state.laneType||'unknown').toUpperCase()],['RECEIVE CHECK',(state.receiveResult||'not_run').replaceAll('_',' ').toUpperCase()],['RECOVERY',(state.recoveryAwareness||'not_run').replaceAll('_',' ').toUpperCase()],['FUTURE RULE',(state.futureRule||'none').replaceAll('_',' ').toUpperCase()]]){const row=document.createElement('div');row.className='row';const b=document.createElement('b');b.textContent=label;const span=document.createElement('span');span.textContent=value;row.append(b,span);summary.append(row);}choices.append(summary);
  button('START OVER SAFELY',()=>{discard();state=blank();helperOpen=false;render();});
}
function renderStopped(){stepLabel.textContent='Stopped';question.textContent='STOPPED SAFELY';explain.textContent='You can leave here. Nothing is scored, no account needs to be created, and no critical account needs to be moved.';button('START OVER',()=>{discard();state=blank();helperOpen=false;render();});}
function render(){clearStage();switch(state.stage){case'BOUNDARY':renderBoundary();break;case'CURRENT_PATTERN':renderPattern();break;case'EXISTING_LANE':renderLane();break;case'RECEIVE_CHECK':renderReceive();break;case'RECOVERY_AWARENESS':renderRecovery();break;case'FUTURE_RULE':renderRule();break;case'COMPLETE':renderComplete();break;case'STOPPED_SAFE':renderStopped();break;default:state=blank();renderBoundary();}storageNote();}

stopButton.addEventListener('click',()=>{const current=state.stage;if(NEXT[current]?.has('STOPPED_SAFE'))transition(current,'STOPPED_SAFE');});
load();render();
})();
