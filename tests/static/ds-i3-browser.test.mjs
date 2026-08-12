import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';

const html=await readFile(new URL('../../digital-stewardship-03.html',import.meta.url));
const js=await readFile(new URL('../../digital-stewardship-03.js',import.meta.url));
const KEY='clove_ds_i3_v1';
const engine=process.env.DS_BROWSER==='firefox'?'firefox':'chromium';

function startServer(){
  const requests=[];
  const server=createServer((req,res)=>{
    requests.push({method:req.method,url:req.url});
    if(req.url==='/before'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><title>Before</title>');return;}
    if(req.method==='GET'&&(req.url==='/'||req.url==='/digital-stewardship-03.html')){res.writeHead(200,{'content-type':'text/html'});res.end(html);return;}
    if(req.method==='GET'&&req.url==='/digital-stewardship-03.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(js);return;}
    if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
    res.writeHead(404);res.end('not found');
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve({server,requests,origin:`http://127.0.0.1:${server.address().port}`})));
}
async function launch(){return engine==='firefox'?firefox.launch({headless:true}):chromium.launch({headless:true,channel:'chrome'});}
async function choose(page,name){await page.getByRole('button',{name,exact:true}).click();}
const words=s=>s.trim()?s.trim().split(/\s+/).length:0;
async function budget(page){
  assert.equal(await page.locator('#question').isVisible(),true);
  assert.ok(words(await page.locator('#explain').innerText())<=70);
  const buttons=page.locator('button:visible');assert.ok(await buttons.count()<=7,`too many buttons: ${await buttons.count()}`);
  for(let i=0;i<await buttons.count();i++){const b=buttons.nth(i),box=await b.boundingBox();assert.ok(box&&box.height>=44);assert.ok((await b.getAttribute('aria-label'))||((await b.innerText()).trim().length>0));}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);
}
async function enter(page,kind='MARKETING / PROMOTIONAL'){await choose(page,'I HAVE ONE');await choose(page,kind);}
async function changed(page,kind='MARKETING / PROMOTIONAL'){await enter(page,kind);await choose(page,'NO — IT CAN WAIT');await choose(page,'I CHANGED THIS ONE STREAM');}

test(`can-wait change survives normal-use check with coarse state and no network (${engine})`,async t=>{
  const {server,requests,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(`${origin}/digital-stewardship-03.html`);await changed(page);await choose(page,'I MISSED NOTHING IMPORTANT');
  assert.equal(await page.getByRole('heading',{name:'CHECK COMPLETE'}).isVisible(),true);
  const raw=await page.evaluate(k=>localStorage.getItem(k),KEY);assert.ok(raw);assert.doesNotMatch(raw,/@|https?:|instagram|facebook|google|apple|password|\+1[- (]/i);
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(),['schemaVersion','stage','interruptionClass','intent','changeDecision','checkResult','recoveryResult'].sort());
  assert.equal(requests.some(r=>r.method!=='GET'),false);
});

test(`important miss restores previous setting (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(`${origin}/digital-stewardship-03.html`);await changed(page,'SOCIAL ACTIVITY');await choose(page,'I MISSED SOMETHING IMPORTANT');
  assert.match(await page.locator('#question').innerText(),/restore/i);await choose(page,'RESTORED PREVIOUS SETTING');
  assert.match(await page.locator('#explain').innerText(),/restored/i);
});

test(`uncertain check restores rather than escalating (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(`${origin}/digital-stewardship-03.html`);await changed(page,'NEWS / ENTERTAINMENT');await choose(page,"I'M NOT SURE");await choose(page,'RESTORED PREVIOUS SETTING');
  assert.equal(await page.getByRole('heading',{name:'CHECK COMPLETE'}).isVisible(),true);
});

test(`required, unclear, unknown class, and optional-no-change never force a change (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  const cases=[
    ['MARKETING / PROMOTIONAL','YES — I NEED IT NOW',null],
    ['SOCIAL ACTIVITY',"I'M NOT SURE",null],
    ['OTHER / NOT SURE','NO — IT CAN WAIT',null],
    ['NONURGENT SHOPPING','NO — IT CAN WAIT','I DECIDED NOT TO CHANGE IT'],
  ];
  for(const [kind,intent,noChange] of cases){
    const context=await browser.newContext();const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-03.html`);await enter(page,kind);await choose(page,intent);if(noChange)await choose(page,noChange);
    assert.equal(await page.getByRole('heading',{name:'CHECK COMPLETE'}).isVisible(),true);assert.equal(await page.getByRole('button',{name:'I CHANGED THIS ONE STREAM'}).count(),0);await context.close();
  }
});

test(`malformed and forged states reset safely (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  const bad=['{"schemaVersion":1,',JSON.stringify({schemaVersion:1,stage:'REAL_LIFE_CHECK',interruptionClass:'marketing',intent:'can_wait',changeDecision:null,checkResult:null,recoveryResult:null})];
  for(const value of bad){const context=await browser.newContext();await context.addInitScript(({k,v})=>localStorage.setItem(k,v),{k:KEY,v:value});const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-03.html`);assert.equal(await page.getByRole('button',{name:'I HAVE ONE'}).isVisible(),true);assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),null);await context.close();}
});

test(`storage read/write failures are explicit and remain usable in memory (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  for(const method of ['getItem','setItem']){const context=await browser.newContext();await context.addInitScript(({key,method})=>{const original=Storage.prototype[method];Storage.prototype[method]=function(k,...rest){if(k===key)throw new DOMException('blocked','SecurityError');return original.call(this,k,...rest);};},{key:KEY,method});const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-03.html`);if(method==='setItem')await choose(page,'I HAVE ONE');assert.match(await page.locator('#storageStatus').innerText(),/not be saved|memory/i);if(method==='getItem')await choose(page,'I HAVE ONE');assert.match(await page.locator('#question').innerText(),/kind of interruption/i);await context.close();}
});

test(`clear/reload and back-forward preserve only coarse progress (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(`${origin}/before`);await page.goto(`${origin}/digital-stewardship-03.html`);await choose(page,'I HAVE ONE');await choose(page,'MARKETING / PROMOTIONAL');await page.goBack({waitUntil:'domcontentloaded'});await page.goForward({waitUntil:'domcontentloaded'});assert.match(await page.locator('#question').innerText(),/interrupt/i);await page.evaluate(k=>localStorage.removeItem(k),KEY);await page.reload();assert.equal(await page.getByRole('button',{name:'I HAVE ONE'}).isVisible(),true);
});

test(`STOP works from all nonterminal depths (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  const setups=[async p=>{},async p=>choose(p,'I HAVE ONE'),async p=>enter(p),async p=>{await enter(p);await choose(p,'NO — IT CAN WAIT');},async p=>changed(p),async p=>{await changed(p);await choose(p,'I MISSED SOMETHING IMPORTANT');}];
  for(const setup of setups){const context=await browser.newContext();const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-03.html`);await setup(page);assert.equal(await page.getByRole('button',{name:'STOP',exact:true}).isVisible(),true);await choose(page,'STOP');assert.equal(await page.getByRole('heading',{name:'STOPPED SAFELY'}).isVisible(),true);await context.close();}
});

test(`mobile keyboard reduced-motion rapid activation and simplicity budget hold (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-03.html`);await budget(page);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.textContent?.trim()),'I HAVE ONE');await page.keyboard.press('Enter');const b=page.getByRole('button',{name:'MARKETING / PROMOTIONAL'});await b.evaluate(el=>{el.click();el.click();});assert.match(await page.locator('#question').innerText(),/interrupt/i);await budget(page);const s=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);assert.equal(s.stage,'INTENT');
});
