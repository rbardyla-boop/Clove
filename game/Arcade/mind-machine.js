/* Operator's Deck: an input-dependent, deterministic circuit in a 3D tray. */
'use strict';
let immScene, immCamera, immRenderer;
let immLevel=1, immBoard, immGroup, immPulse, immRun=null, immLastFrame=0, immSet=0;
const immContainer=document.getElementById('imm-container');
const immButtons=document.getElementById('imm-nodes');
const immHelp=document.getElementById('imm-help');
const immAction=document.getElementById('imm-action-btn');
const immTiles=new Map();
const immAt=cell=>new THREE.Vector3((cell.x-2)*2.2,0.4,(cell.y-2)*2.2);
const immNames=['right','down','left','up'];
function immState(state,message) {
  immContainer.dataset.state=state;
  if(message)immHelp.textContent=message;
  immAction.disabled=state==='running'||state==='won';
  immAction.textContent=state==='running'?'FOLLOW THE PULSE…':state==='won'?'CONNECTED':'TEST ROUTE';
  for(const b of immButtons.querySelectorAll('button'))b.disabled=state==='running'||state==='won';
}
function initIMM() {
  try {
    immScene=new THREE.Scene();
    immScene.background=new THREE.Color(currentTheme==='light'?0xecebe5:0x0a0a12);
    immCamera=new THREE.PerspectiveCamera(40,1,.1,150);
    immRenderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    immRenderer.setPixelRatio(Math.min(devicePixelRatio,2));
    document.getElementById('imm-canvas').appendChild(immRenderer.domElement);
    immScene.add(new THREE.AmbientLight(0xffffff,1.0));
    const light=new THREE.DirectionalLight(0xffffff,1.8);light.position.set(2,14,8);immScene.add(light);
    buildIMMLevel();
    new ResizeObserver(resizeIMM).observe(immContainer);
    requestAnimationFrame(animateIMM);
  } catch(error) {
    immAction.disabled=true;
    immHelp.textContent='The 3D circuit could not start. Other arcade tabs are still available.';
    console.error('Mind Machine initialization:',error);
  }
}
function buildIMMLevel() {
  immRun=null;
  if(immGroup) {
    immScene.remove(immGroup);
    immGroup.traverse(object=>{object.geometry?.dispose();if(object.material)for(const m of [].concat(object.material))m.dispose();});
  }
  immGroup=new THREE.Group();immScene.add(immGroup);immTiles.clear();immButtons.replaceChildren();
  immBoard=MindRoute.makeBoard(immLevel,currentSeed+immSet*113);
  const tray=new THREE.Mesh(new THREE.BoxGeometry(12,.4,12),new THREE.MeshStandardMaterial({color:0x242635,roughness:.8}));
  tray.position.y=-.45;immGroup.add(tray);
  for(const cell of immBoard.cells) {
    const pos=immAt(cell);
    const group=new THREE.Group();group.position.copy(pos);immGroup.add(group);
    const color=cell.kind==='source'?0xd4a843:cell.kind==='goal'?0x38ce80:cell.kind==='wall'?0x393b4a:0x596174;
    const tile=new THREE.Mesh(new THREE.BoxGeometry(1.8,cell.kind==='wall'?1.2:.25,1.8),new THREE.MeshStandardMaterial({color,roughness:.65,emissive:0x000000}));
    group.add(tile);
    let arrow=null;
    if(cell.kind==='node'||cell.kind==='source') {
      arrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(-.6,.24,0),1.2,cell.kind==='source'?0xffe09a:0xe7edf9,.38,.34);
      const pivot=new THREE.Group();pivot.add(arrow);group.add(pivot);arrow=pivot;
      arrow.rotation.y=-cell.direction*Math.PI/2;
    }
    if(cell.kind==='goal') {
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.53,.1,8,32),new THREE.MeshBasicMaterial({color:0xb6ffd1}));
      ring.rotation.x=Math.PI/2;ring.position.y=.22;group.add(ring);
    }
    const button=cell.kind==='node'?document.createElement('button'):cell.kind!=='wall'?document.createElement('span'):null;
    if(button) {
      button.className=cell.kind==='node'?'imm-node':`imm-landmark ${cell.kind}`;
      button.textContent=cell.kind==='node'?`${String.fromCharCode(65+cell.x)}${cell.y+1}`:cell.kind==='source'?'SOURCE':'GOAL';
      if(cell.kind==='node') {
        button.type='button';button.dataset.node=cell.id;
        button.addEventListener('click',()=>rotateIMM(cell.id));
      }
      immButtons.appendChild(button);
    }
    immTiles.set(cell.id,{tile,arrow,button});
  }
  immPulse=new THREE.Mesh(new THREE.SphereGeometry(.24,16,12),new THREE.MeshBasicMaterial({color:0xffdc7f}));
  immGroup.add(immPulse);immPulse.position.copy(immAt(immBoard.cells[immBoard.source])).y=.85;
  document.getElementById('imm-overlay').classList.remove('active');
  document.getElementById('imm-level-num').textContent=`${immLevel} / 20`;
  document.getElementById('imm-energy').textContent='0';
  document.getElementById('imm-timer').textContent='0';
  document.getElementById('imm-status-title').textContent='CIRCUIT HELD';
  document.getElementById('imm-next-btn').textContent='NEXT CIRCUIT';
  immState('ready','Turn the arrows from the amber source toward the green goal. Then test your route.');
  updateIMMLabels();resizeIMM();
}
function updateIMMLabels() {
  for(const cell of immBoard.cells) {
    const {arrow,button}=immTiles.get(cell.id);
    if(arrow)arrow.rotation.y=-cell.direction*Math.PI/2;
    if(cell.kind==='node')button.setAttribute('aria-label',`Node ${String.fromCharCode(65+cell.x)}${cell.y+1}, points ${immNames[cell.direction]}. Rotate clockwise.`);
  }
}
function rotateIMM(id) {
  if(immRun||immContainer.dataset.state==='won')return;
  if(!MindRoute.rotateNode(immBoard,id))return;
  for(const {tile} of immTiles.values())tile.material.emissive.setHex(0x000000);
  document.getElementById('imm-timer').textContent=immBoard.moves;
  immState('ready','Arrow turned. Follow the arrows from SOURCE to GOAL, then test.');
  updateIMMLabels();soundClick();
}
function resizeIMM() {
  if(!immRenderer||!immContainer.clientWidth)return;
  const w=immContainer.clientWidth,h=immContainer.clientHeight;
  immCamera.aspect=w/h;
  const distance=Math.max(17,9/immCamera.aspect);
  immCamera.position.set(0,distance,distance*.65);immCamera.lookAt(0,0,0);immCamera.updateProjectionMatrix();
  immCamera.updateMatrixWorld();immRenderer.setSize(w,h);
  for(const cell of immBoard.cells) {
    const el=immTiles.get(cell.id).button;if(!el)continue;
    const p=immAt(cell).project(immCamera);
    el.style.left=`${(p.x+1)*w/2}px`;el.style.top=`${(1-p.y)*h/2}px`;
  }
}
function finishIMM() {
  if(!immRun)return;
  const result=immRun.result;immRun=null;
  if(result.won&&result.path.at(-1)===immBoard.goal&&MindRoute.traceRoute(immBoard).won) {
    immState('won',result.reason);
    document.getElementById('imm-status-desc').textContent=`${result.path.length} nodes connected in ${immBoard.moves} turns. You built that route.`;
    if(immLevel===20) {
      document.getElementById('imm-status-title').textContent='ALL 20 CIRCUITS CONNECTED';
      document.getElementById('imm-next-btn').textContent='PLAY A NEW SET';
    }
    document.getElementById('imm-overlay').classList.add('active');
    triggerWinCelebration(immContainer);
  } else {
    immState('failed',result.reason);
    immTiles.get(result.path.at(-1))?.tile.material.emissive.setHex(0x75180d);
    soundFail();
  }
}
function animateIMM(time) {
  requestAnimationFrame(animateIMM);
  const dt=Math.min(.05,Math.max(0,(time-(immLastFrame||time))/1000));immLastFrame=time;
  if(document.hidden||!document.getElementById('panel-imm').classList.contains('active'))return;
  if(immRun) {
    immRun.progress+=dt*3;
    const path=immRun.result.path;
    const i=Math.min(path.length-1,Math.floor(immRun.progress));
    const a=immAt(immBoard.cells[path[i]]),b=immAt(immBoard.cells[path[Math.min(i+1,path.length-1)]]);
    immPulse.position.copy(a).lerp(b,immRun.progress%1);immPulse.position.y=.85;
    immTiles.get(path[i]).tile.material.emissive.setHex(0x174b35);
    document.getElementById('imm-energy').textContent=String(i+1);
    if(immRun.progress>=path.length)finishIMM();
  }
  immRenderer.render(immScene,immCamera);
}
function suspendIMM() {
  if(!immRun)return;
  immRun=null;immState('ready','Test paused when you left. Your arrows are saved here; test again when ready.');
}
immAction.addEventListener('click',()=>{
  if(!immBoard||immRun||immContainer.dataset.state==='won')return;
  soundClick();
  for(const {tile} of immTiles.values())tile.material.emissive.setHex(0x000000);
  immRun={result:MindRoute.traceRoute(immBoard),progress:0};
  immState('running','Follow the pulse. A stopped route shows the arrow to adjust.');
});
document.getElementById('imm-reset-btn').addEventListener('click',()=>{if(immScene)buildIMMLevel();});
document.getElementById('imm-next-btn').addEventListener('click',()=>{
  if(immContainer.dataset.state!=='won')return;
  if(immLevel===20){immSet++;immLevel=1;}else immLevel++;
  buildIMMLevel();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendIMM();});
initIMM();
