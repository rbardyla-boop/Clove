(() => {
'use strict';

const KEY='clove_ds_i0_v1';
const STAGES=['BOUNDARY','DEVICE','ACCESS_MODE','ACCOUNT','SERVICE_CLOUD','RECOVERY','SAFE_CHECK','COMPLETE','STOPPED_SAFE'];
const NEXT={
  BOUNDARY:new Set(['DEVICE','STOPPED_SAFE']),
  DEVICE:new Set(['ACCESS_MODE','STOPPED_SAFE']),
  ACCESS_MODE:new Set(['ACCOUNT','STOPPED_SAFE']),
  ACCOUNT:new Set(['SERVICE_CLOUD','STOPPED_SAFE']),
  SERVICE_CLOUD:new Set(['RECOVERY','STOPPED_SAFE']),
  RECOVERY:new Set(['SAFE_CHECK','STOPPED_SAFE']),
  SAFE_CHECK:new Set(['COMPLETE','STOPPED_SAFE']),
  COMPLETE:new Set(),STOPPED_SAFE:new Set(),
};
const ALLOWED={
  deviceClass:new Set(['phone','tablet','computer','other','unknown',null]),
  accessMode:new Set(['app','browser','both','unknown',null]),
  hasAccount:new Set(['yes','no','unknown',null]),
  providerPersistenceBelief:new Set(['yes','no','unknown',null]),
  recoveryClass:new Set(['contact','auth','support','unknown',null]),
  recoveryCheckResult:new Set(['current','location','unknown',null]),
};
const REQUIRED_BEFORE={
  BOUNDARY:[],DEVICE:[],
  ACCESS_MODE:['deviceClass'],
  ACCOUNT:['deviceClass','accessMode'],
  SERVICE_CLOUD:['deviceClass','accessMode','hasAccount'],
  RECOVERY:['deviceClass','accessMode','hasAccount','providerPersistenceBelief'],
  SAFE_CHECK:['deviceClass','accessMode','hasAccount','providerPersistenceBelief','recoveryClass'],
  COMPLETE:['deviceClass','accessMode','hasAccount','providerPersistenceBelief','recoveryClass','recoveryCheckResult'],
  STOPPED_SAFE:[],
};
const blank=()=>({schemaVersion:1,stage:'BOUNDARY',deviceClass:null,accessMode:null,hasAccount:null,providerPersistenceBelief:null,recoveryClass:null,recoveryCheckResult:null});

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

function validState(candidate){
  if(!candidate || candidate.schemaVersion!==1 || !STAGES.includes(candidate.stage)) return false;
  if(!Object.entries(ALLOWED).every(([field,allowed])=>allowed.has(candidate[field] ?? null))) return false;
  return REQUIRED_BEFORE[candidate.stage].every(field=>candidate[field]!==null && candidate[field]!==undefined);
}

function load(){
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw) return;
    const parsed=JSON.parse(raw);
    if(validState(parsed)){state=parsed;return;}
    localStorage.removeItem(KEY);
  }catch{
    storageAvailable=false;
    state=blank();
  }
}

function persist(){
  if(!storageAvailable) return false;
  try{
    localStorage.setItem(KEY,JSON.stringify(state));
    return true;
  }catch{
    storageAvailable=false;
    return false;
  }
}

function storageNote(){
  storageStatus.textContent=storageAvailable ? '' : 'Progress will not be saved on this browser. You can continue in memory, but a reload will reset the drill.';
}

function transition(expectedStage,nextStage,patch={}){
  if(transitionLock || state.stage!==expectedStage || !NEXT[expectedStage]?.has(nextStage)) return false;
  transitionLock=true;
  const candidate={...state,...patch,stage:nextStage};
  if(!validState(candidate)){transitionLock=false;return false;}
  state=candidate;
  persist();
  render();
  transitionLock=false;
  return true;
}

function button(label,onClick,primary=false){
  const b=document.createElement('button');
  b.type='button';
  b.className=`choice${primary?' primary':''}`;
  b.textContent=label;
  b.addEventListener('click',onClick);
  choices.appendChild(b);
}

function clearStage(){
  choices.replaceChildren();
  helper.hidden=true;
  helper.textContent='';
  stopButton.hidden=['BOUNDARY','COMPLETE','STOPPED_SAFE'].includes(state.stage);
  storageNote();
}

function renderBoundary(){
  stepLabel.textContent='0 / Start';
  question.textContent='Pick one low-stakes service.';
  explain.textContent='Use something you already understand a little. Do not start with banking, government identity, or a critical health account.';
  button('I HAVE ONE',()=>transition('BOUNDARY','DEVICE'),true);
  button("I DON'T KNOW WHAT TO PICK",()=>{
    helperOpen=!helperOpen;
    helper.hidden=!helperOpen;
    helper.textContent='Try a weather app, streaming service, shopping account, game, newsletter, or another service where a mistake would not lock you out of something critical.';
  });
}

function renderDevice(){
  stepLabel.textContent='1 / Device';
  question.textContent='What physical thing are you using right now?';
  explain.textContent='A device is the physical object in your hand or on your desk. We do not need its brand, model, or serial number.';
  for(const [label,value] of [['PHONE','phone'],['TABLET','tablet'],['COMPUTER','computer'],['OTHER','other'],["I DON'T KNOW",'unknown']]) button(label,()=>transition('DEVICE','ACCESS_MODE',{deviceClass:value}),label==='PHONE');
}

function renderAccess(){
  stepLabel.textContent='2 / App or browser';
  question.textContent='Are you using an app or a browser?';
  explain.textContent='An app is an installed program. A browser is the program you use to open websites. Some services use both.';
  for(const [label,value] of [['APP','app'],['BROWSER','browser'],['BOTH','both'],["I DON'T KNOW",'unknown']]) button(label,()=>transition('ACCESS_MODE','ACCOUNT',{accessMode:value}));
}

function renderAccount(){
  stepLabel.textContent='3 / Account';
  question.textContent='Does this service have a sign-in or account?';
  explain.textContent='Do not enter the sign-in here. Just identify whether an account exists.';
  for(const [label,value] of [['YES','yes'],['NO','no'],['NOT SURE','unknown']]) button(label,()=>transition('ACCOUNT','SERVICE_CLOUD',{hasAccount:value}));
}

function renderService(){
  stepLabel.textContent='4 / Service or cloud';
  question.textContent='If this device disappeared, would the service or account still exist?';
  explain.textContent='Deleting something from a device is not automatically the same as deleting an account or a copy held by a service provider. If you are unsure, say so.';
  for(const [label,value] of [['YES — IT WOULD STILL EXIST','yes'],['NO — I THINK IT IS ONLY HERE','no'],['NOT SURE','unknown']]) button(label,()=>transition('SERVICE_CLOUD','RECOVERY',{providerPersistenceBelief:value}));
}

function renderRecovery(){
  stepLabel.textContent='5 / Recovery';
  question.textContent='Can you identify at least one recovery path without showing it to Clove?';
  explain.textContent='You are identifying the kind of recovery path, not the address, number, code, secret, or provider.';
  for(const [label,value] of [
    ['YES — RECOVERY EMAIL / PHONE','contact'],
    ['YES — AUTHENTICATOR / BACKUP METHOD','auth'],
    ['YES — PROVIDER SUPPORT / RECOVERY PAGE','support'],
    ['NO / NOT SURE','unknown'],
  ]) button(label,()=>transition('RECOVERY','SAFE_CHECK',{recoveryClass:value}));
}

function renderSafeCheck(){
  stepLabel.textContent='6 / Safe check';
  if(state.recoveryClass==='unknown'){
    question.textContent='Can you find the official recovery or help location?';
    explain.textContent='Use the service itself or its official help/settings. Do not log out, reset a password, remove multi-factor authentication, or consume a backup code just to test this drill.';
    button('I FOUND THE OFFICIAL RECOVERY LOCATION',()=>transition('SAFE_CHECK','COMPLETE',{recoveryCheckResult:'location'}),true);
    button('I STILL DO NOT KNOW',()=>transition('SAFE_CHECK','COMPLETE',{recoveryCheckResult:'unknown'}));
  }else{
    question.textContent='Safely check the recovery path.';
    explain.textContent='In the service’s own settings or official help, verify only that the recovery method looks current or that an official recovery location exists. Do not log out, reset a password, remove multi-factor authentication, or consume a backup code just to test this drill.';
    button('I CHECKED — IT LOOKS CURRENT',()=>transition('SAFE_CHECK','COMPLETE',{recoveryCheckResult:'current'}),true);
    button('I FOUND THE OFFICIAL RECOVERY LOCATION',()=>transition('SAFE_CHECK','COMPLETE',{recoveryCheckResult:'location'}));
    button('I STILL DO NOT KNOW',()=>transition('SAFE_CHECK','COMPLETE',{recoveryCheckResult:'unknown'}));
  }
}

function understood(value){return value && value!=='unknown' ? 'YES' : 'NOT YET';}
function renderComplete(){
  stepLabel.textContent='7 / Complete';
  question.textContent='MAP COMPLETE';
  const recoveryText=state.recoveryCheckResult==='current'?'Recovery verified':state.recoveryCheckResult==='location'?'Recovery location found':'Recovery still unknown';
  explain.textContent=`${recoveryText}. You now have a five-part map without giving Clove the service name or account details.`;
  const rows=[
    ['DEVICE',understood(state.deviceClass)],
    ['APP / BROWSER',understood(state.accessMode)],
    ['ACCOUNT',understood(state.hasAccount)],
    ['SERVICE / CLOUD',understood(state.providerPersistenceBelief)],
    ['RECOVERY',state.recoveryCheckResult==='current'?'VERIFIED':state.recoveryCheckResult==='location'?'LOCATION FOUND':'UNKNOWN'],
  ];
  const summary=document.createElement('div');summary.className='summary';
  for(const [label,value] of rows){const row=document.createElement('div');row.className='row';const b=document.createElement('b');b.textContent=label;const span=document.createElement('span');span.textContent=value;row.append(b,span);summary.append(row);}
  choices.append(summary);
  button('START OVER SAFELY',()=>{try{localStorage.removeItem(KEY);}catch{} state=blank();helperOpen=false;render();});
}

function renderStopped(){
  stepLabel.textContent='Stopped';
  question.textContent='STOPPED SAFELY';
  explain.textContent='You can leave here. Nothing is scored, and you do not need to finish this drill today.';
  button('START OVER',()=>{try{localStorage.removeItem(KEY);}catch{} state=blank();helperOpen=false;render();});
}

function render(){
  clearStage();
  switch(state.stage){
    case 'BOUNDARY':renderBoundary();break;
    case 'DEVICE':renderDevice();break;
    case 'ACCESS_MODE':renderAccess();break;
    case 'ACCOUNT':renderAccount();break;
    case 'SERVICE_CLOUD':renderService();break;
    case 'RECOVERY':renderRecovery();break;
    case 'SAFE_CHECK':renderSafeCheck();break;
    case 'COMPLETE':renderComplete();break;
    case 'STOPPED_SAFE':renderStopped();break;
    default:state=blank();renderBoundary();
  }
  storageNote();
}

stopButton.addEventListener('click',()=>{
  const current=state.stage;
  if(NEXT[current]?.has('STOPPED_SAFE')) transition(current,'STOPPED_SAFE');
});

load();
render();
})();
