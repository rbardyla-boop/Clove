import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../../',import.meta.url));
let browser,server,origin=process.env.ARCADE_CARE_ORIGIN;
before(async()=>{
  if(!origin) {
    server=createServer(async(req,res)=>{
      try {
        const path=decodeURIComponent(new URL(req.url,'http://test').pathname);
        if(path==='/favicon.ico'||path.startsWith('/__clove')){res.writeHead(204);res.end();return;}
        let file=resolve(root,'.'+path);
        if(!file.startsWith(root)||(!path.startsWith('/game/')&&path!=='/clove-signals.js'))throw Error('outside game assets');
        if((await stat(file)).isDirectory())file+='/index.html';
        res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(file)]||'application/octet-stream');
        res.end(await readFile(file));
      }catch{res.writeHead(404);res.end();}
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    origin=`http://127.0.0.1:${server.address().port}`;
  }
  browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
async function open(t,viewport={width:1280,height:900},path='/game/Arcade/') {
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  t.after(()=>context.close());
  await context.addInitScript(()=>{localStorage.setItem('deck_muted','true');localStorage.setItem('clove_signals_optout_v1','1');});
  // Font availability and analytics are not game dependencies; do not submit QA telemetry.
  await context.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({status:204,body:''}));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin===origin)errors.push(`${r.status()} ${r.url()}`);});
  t.after(()=>assert.deepEqual(errors,[],'no runtime errors or failed game assets'));
  await page.goto(origin+path);
  return page;
}
const state=(page,value)=>page.waitForFunction(v=>document.querySelector('#imm-container').dataset.state===v,value);
async function solveThroughButtons(page) {
  // Read the rendered game's board, search independently, then use only its public buttons.
  const board=await page.evaluate(()=>structuredClone(immBoard));
  const directions=[[1,0],[0,1],[-1,0],[0,-1]],queue=[[board.source]],seen=new Set([board.source]);
  let solution;
  while(queue.length) {
    const path=queue.shift(),cell=board.cells[path.at(-1)];
    if(cell.id===board.goal){solution=path;break;}
    for(const [direction,[dx,dy]] of directions.entries()) {
      if(cell.kind==='source'&&cell.direction!==direction)continue;
      const x=cell.x+dx,y=cell.y+dy,id=y*5+x;
      if(x<0||x>4||y<0||y>4||seen.has(id)||board.cells[id].kind==='wall')continue;
      seen.add(id);queue.push([...path,id]);
    }
  }
  assert.ok(solution);
  for(let i=1;i<solution.length-1;i++) {
    const cell=board.cells[solution[i]],next=board.cells[solution[i+1]];
    const target=directions.findIndex(([dx,dy])=>next.x-cell.x===dx&&next.y-cell.y===dy);
    for(let turn=cell.direction;turn!==target;turn=(turn+1)%4)await page.locator(`[data-node="${cell.id}"]`).click();
  }
}

test('3D circuit: no-input failure, input-earned win, next circuit and cancelled trace',async t=>{
  const page=await open(t);await state(page,'ready');
  assert.equal(await page.locator('#imm-canvas canvas').isVisible(),true);
  await page.locator('#imm-action-btn').click();await state(page,'failed');
  assert.equal(await page.locator('#global-streak').innerText(),'0');
  assert.match(await page.locator('#imm-help').innerText(),/loops back/);
  assert.equal(await page.locator('#imm-overlay').isVisible(),false);
  await solveThroughButtons(page);
  await page.locator('#imm-action-btn').click();await state(page,'won');
  assert.equal(await page.locator('#global-streak').innerText(),'1');
  assert.equal(await page.locator('.celebration-particle').count(),0,'reduced motion preserves win without particles');
  await page.locator('#imm-next-btn').click();await state(page,'ready');
  assert.equal(await page.locator('#imm-level-num').innerText(),'2 / 20');
  await solveThroughButtons(page);
  await page.locator('#imm-action-btn').click();
  await page.locator('[data-target="unblock"]').click();
  await page.locator('[data-target="imm"]').click();
  await state(page,'ready');await page.waitForTimeout(2200);
  assert.equal(await page.locator('#global-streak').innerText(),'1','leaving cancels delayed rewards');
  await page.locator('#imm-action-btn').click();await state(page,'won');
  assert.equal(await page.locator('#global-streak').innerText(),'2');
  await page.locator('#imm-next-btn').click();await page.locator('#imm-reset-btn').click();
  await page.locator('#imm-action-btn').click();await state(page,'failed');
});

test('phone: readable header, usable 3D nodes, touch direction and released controls, all 15 briefs',async t=>{
  const page=await open(t,{width:390,height:844});await state(page,'ready');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  for(const selector of ['#btn-theme','#btn-sound','#btn-fx','#btn-sync']) {
    const box=await page.locator(selector).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390&&box.height>=44);
  }
  await page.locator('[data-node="11"]').click();
  assert.equal(await page.locator('#imm-timer').innerText(),'1');
  await solveThroughButtons(page);await page.locator('#imm-action-btn').click();await state(page,'won');
  const tabs=await page.locator('[data-target]').evaluateAll(els=>els.map(el=>el.dataset.target));
  assert.equal(tabs.length,15);
  for(const id of tabs) {
    await page.locator(`[data-target="${id}"]`).click();
    assert.equal(await page.locator(`#panel-${id} .deck-care-goal`).isVisible(),true,id);
    assert.ok((await page.locator(`#panel-${id} .deck-care-controls`).innerText()).length>20,id);
    assert.equal(await page.locator(`#panel-${id} canvas`).isVisible(),true,id);
  }
  await page.locator('[data-target="rally"]').click();
  const y=await page.evaluate(()=>rallyPaddleY);
  const up=page.locator('#panel-rally [data-key="ArrowUp"]');
  await up.scrollIntoViewIfNeeded();const b=await up.boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(100);
  const afterUp=await page.evaluate(()=>rallyPaddleY);assert.ok(afterUp<y,'up actually moves paddle upward');
  await page.mouse.up();
  assert.equal(await up.evaluate(el=>el.classList.contains('is-held')),false);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  assert.equal(await page.locator('.deck-care-key.is-held').count(),0);
  await page.locator('#btn-fx').click();assert.equal(await page.locator('html').getAttribute('data-effects'),'full');
  await page.reload();assert.equal(await page.locator('html').getAttribute('data-effects'),'full');
});

test('standalone phone and desktop render with reachable run controls and visible instructions',async t=>{
  for(const viewport of [{width:390,height:844},{width:360,height:800},{width:1280,height:900}]) {
    const page=await open(t,viewport,'/game/theincrediblemindmachine/');
    await page.waitForFunction(()=>Boolean(window.__mm));
    assert.equal(await page.locator('#game-canvas').isVisible(),true);
    assert.equal(await page.locator('.helper').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const run=page.locator('#run-btn');assert.equal(await run.isVisible(),true);
    await run.click();
    assert.ok(await page.locator('body').innerText());
  }
});

test('small phone keeps route controls clear of the real site feedback launcher',async t=>{
  const page=await open(t,{width:360,height:800});await state(page,'ready');
  await page.waitForSelector('#clove-feedback',{state:'attached'});
  await page.locator('#imm-action-btn').click();await state(page,'failed');
  assert.equal(await page.locator('#global-streak').innerText(),'0');
  const box=await page.locator('#imm-action-btn').boundingBox();
  assert.ok(box.y+box.height<750,'action stays above reserved feedback strip');
});
