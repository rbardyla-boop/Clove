import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';

const html=await readFile(new URL('../../digital-stewardship-02.html',import.meta.url));
const js=await readFile(new URL('../../digital-stewardship-02.js',import.meta.url));
const KEY='clove_ds_i2_v1';
const engine=process.env.DS_BROWSER==='firefox'?'firefox':'chromium';

function startServer(){
  const requests=[];
  const server=createServer((req,res)=>{
    requests.push({method:req.method,url:req.url});
    if(req.url==='/before'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><title>Before</title>');return;}
    if(req.method==='GET'&&(req.url==='/'||req.url==='/digital-stewardship-02.html')){res.writeHead(200,{'content-type':'text/html'});res.end(html);return;}
    if(req.method==='GET'&&req.url==='/digital-stewardship-02.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(js);return;}
    if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
    res.writeHead(404);res.end('not found');
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve({server,requests,origin:`http://127.0.0.1:${server.address().port}`})));
}
async function launch(){return engine==='firefox'?firefox.launch({headless:true}):chromium.launch({headless:true,channel:'chrome'});}
async function choose(page,name){await page.getByRole('button',{name,exact:true}).click();}
const words=s=>s.trim()?s.trim().split(/\s+/).length:0;

async function assertBudget(page){
  assert.equal(await page.locator('#question').isVisible(),true);
  assert.ok(words(await page.locator('#explain').innerText())<=70,`explanation >70 words`);
  const buttons=page.locator('button:visible');
  assert.ok(await buttons.count()<=6,`too many buttons: ${await buttons.count()}`);
  for(let i=0;i<await buttons.count();i++){
    const b=buttons.nth(i),box=await b.boundingBox();
    assert.ok(box&&box.height>=44,`target under 44px: ${await b.innerText()}`);
    assert.ok((await b.getAttribute('aria-label'))||((await b.innerText()).trim().length>0));
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);
}
async function start(page,pattern='MOSTLY THE SAME EMAIL / LANE',lane='YES — SECONDARY EMAIL'){
  await choose(page,"I'M READY");await choose(page,pattern);await choose(page,lane);
}

test(`existing secondary receives test and recovery is recognizable (${engine})`,async t=>{
  const {server,requests,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(`${origin}/digital-stewardship-02.html`);
  await start(page);await choose(page,'TEST MESSAGE RECEIVED');await choose(page,'YES — RECOVERY LOOKS CURRENT / RECOGNIZABLE');await choose(page,'LOW-STAKES SIGN-UPS CAN USE A SECONDARY / ALIAS WHEN AVAILABLE');
  assert.equal(await page.getByRole('heading',{name:'MAP COMPLETE'}).isVisible(),true);
  const raw=await page.evaluate(k=>localStorage.getItem(k),KEY);assert.ok(raw);
  assert.doesNotMatch(raw,/@|https?:|gmail|outlook|icloud|provider|password|\+1[- (]/i);
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(),['schemaVersion','stage','currentPattern','laneType','receiveResult','recoveryAwareness','futureRule'].sort());
  assert.equal(requests.some(r=>r.method!=='GET'),false);
});

test(`alias receive failure plus uncertain recovery stays conservative (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(`${origin}/digital-stewardship-02.html`);
  await start(page,'ALREADY MOSTLY SEPARATE','YES — PROVIDER-SUPPORTED ALIAS');
  await choose(page,'TEST DID NOT ARRIVE');await choose(page,"I FOUND RECOVERY, BUT I'M NOT SURE IT IS CURRENT");await choose(page,'KEEP MY CURRENT SETUP FOR NOW');
  assert.equal(await page.getByRole('heading',{name:'MAP COMPLETE'}).isVisible(),true);
  assert.match(await page.locator('#explain').innerText(),/no critical account was moved|kept/i);
});

test(`existing lane can decline test and ask for help without pressure (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(`${origin}/digital-stewardship-02.html`);
  await start(page);await choose(page,"I DON'T WANT TO TEST THIS");await choose(page,"NO / I DON'T KNOW");await choose(page,'I NEED MORE HELP BEFORE CHANGING ANYTHING');
  assert.equal(await page.getByRole('heading',{name:'MAP COMPLETE'}).isVisible(),true);
  assert.match(await page.locator('#explain').innerText(),/No migration|nothing critical/i);
});

test(`no lane and unsure lane both use plan-only path (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  for(const lane of ['NO',"I'M NOT SURE"]){
    const context=await browser.newContext();const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-02.html`);
    await start(page,"I'M NOT SURE",lane);
    assert.match(await page.locator('#question').innerText(),/rule/i);
    assert.equal(await page.getByText('TEST MESSAGE RECEIVED').count(),0);
    await choose(page,'KEEP MY CURRENT SETUP FOR NOW');
    const s=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
    assert.equal(s.receiveResult,'not_run');assert.equal(s.recoveryAwareness,'not_run');
    await context.close();
  }
});

test(`malformed and forged saved states reset safely (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  const bad=[
    '{"schemaVersion":1,',
    JSON.stringify({schemaVersion:1,stage:'RECOVERY_AWARENESS',currentPattern:'mixed',laneType:'secondary',receiveResult:null,recoveryAwareness:null,futureRule:null}),
    JSON.stringify({schemaVersion:1,stage:'RECEIVE_CHECK',currentPattern:'mixed',laneType:'ryan@example.com',receiveResult:null,recoveryAwareness:null,futureRule:null}),
  ];
  for(const value of bad){
    const context=await browser.newContext();await context.addInitScript(({k,v})=>localStorage.setItem(k,v),{k:KEY,v:value});
    const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-02.html`);
    assert.equal(await page.getByRole('button',{name:"I'M READY"}).isVisible(),true);
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),null);
    await context.close();
  }
});

test(`storage read/write failures are explicit and flow remains in memory (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  for(const method of ['getItem','setItem']){
    const context=await browser.newContext();await context.addInitScript(({key,method})=>{
      const original=Storage.prototype[method];Storage.prototype[method]=function(k,...rest){if(k===key)throw new DOMException('blocked','SecurityError');return original.call(this,k,...rest);};
    },{key:KEY,method});
    const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-02.html`);
    if(method==='setItem')await choose(page,"I'M READY");
    assert.match(await page.locator('#storageStatus').innerText(),/not be saved|memory/i);
    if(method==='getItem')await choose(page,"I'M READY");
    assert.match(await page.locator('#question').innerText(),/mixed/i);
    await context.close();
  }
});

test(`clear/reload and back-forward preserve only coarse progress (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(`${origin}/before`);await page.goto(`${origin}/digital-stewardship-02.html`);
  await choose(page,"I'M READY");await choose(page,'MOSTLY THE SAME EMAIL / LANE');
  await page.goBack({waitUntil:'domcontentloaded'});await page.goForward({waitUntil:'domcontentloaded'});
  assert.match(await page.locator('#question').innerText(),/secondary email|alias/i);
  await page.evaluate(k=>localStorage.removeItem(k),KEY);await page.reload();
  assert.equal(await page.getByRole('button',{name:"I'M READY"}).isVisible(),true);
});

test(`STOP works from all nonterminal depths (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  const setups=[
    async p=>{},
    async p=>choose(p,"I'M READY"),
    async p=>{await choose(p,"I'M READY");await choose(p,'MOSTLY THE SAME EMAIL / LANE');},
    async p=>start(p),
    async p=>{await start(p);await choose(p,'TEST MESSAGE RECEIVED');},
    async p=>{await start(p);await choose(p,'TEST MESSAGE RECEIVED');await choose(p,'YES — RECOVERY LOOKS CURRENT / RECOGNIZABLE');},
  ];
  for(const setup of setups){
    const context=await browser.newContext();const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-02.html`);await setup(page);
    assert.equal(await page.getByRole('button',{name:'STOP',exact:true}).isVisible(),true);
    await choose(page,'STOP');assert.equal(await page.getByRole('heading',{name:'STOPPED SAFELY'}).isVisible(),true);
    await context.close();
  }
});

test(`mobile keyboard reduced-motion rapid activation and simplicity budget hold (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-02.html`);
  await assertBudget(page);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.textContent?.trim()),"I'M READY");await page.keyboard.press('Enter');
  const mixed=page.getByRole('button',{name:'MOSTLY THE SAME EMAIL / LANE'});await mixed.evaluate(el=>{el.click();el.click();});
  assert.match(await page.locator('#question').innerText(),/secondary email|alias/i);await assertBudget(page);
  const s=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);assert.equal(s.stage,'EXISTING_LANE');
});
