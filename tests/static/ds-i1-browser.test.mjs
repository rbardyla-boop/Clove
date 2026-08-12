import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';

const html=await readFile(new URL('../../digital-stewardship-01.html',import.meta.url));
const js=await readFile(new URL('../../digital-stewardship-01.js',import.meta.url));
const KEY='clove_ds_i1_v1';
const engine=process.env.DS_BROWSER==='firefox'?'firefox':'chromium';

function startServer(){
  const requests=[];
  const server=createServer((req,res)=>{
    requests.push({method:req.method,url:req.url});
    if(req.url==='/before'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><title>Before</title>');return;}
    if(req.method==='GET'&&(req.url==='/'||req.url==='/digital-stewardship-01.html')){res.writeHead(200,{'content-type':'text/html'});res.end(html);return;}
    if(req.method==='GET'&&req.url==='/digital-stewardship-01.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(js);return;}
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
  assert.ok(words(await page.locator('#explain').innerText())<=70);
  const buttons=page.locator('button:visible');
  assert.ok(await buttons.count()<=7,`too many visible buttons: ${await buttons.count()}`);
  for(let i=0;i<await buttons.count();i++){
    const b=buttons.nth(i), box=await b.boundingBox();
    assert.ok(box&&box.height>=44,`target under 44px: ${await b.innerText()}`);
    assert.ok((await b.getAttribute('aria-label'))||((await b.innerText()).trim().length>0));
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);
}

async function enter(page,setting='LOCATION'){
  await choose(page,'I HAVE ONE');
  await choose(page,setting);
}

test(`OPTIONAL change succeeds with coarse local state and no network (${engine})`,async t=>{
  const {server,requests,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(`${origin}/digital-stewardship-01.html`);
  await enter(page);await choose(page,'OPTIONAL');await choose(page,'I CHANGED ONE OPTIONAL SETTING');await choose(page,'THE TASK STILL WORKS');
  assert.equal(await page.getByRole('heading',{name:'CHECK COMPLETE'}).isVisible(),true);
  assert.match(await page.locator('#explain').innerText(),/optional.*task still worked/i);
  const raw=await page.evaluate(k=>localStorage.getItem(k),KEY);assert.ok(raw);
  assert.doesNotMatch(raw,/@|https?:|gmail|google|apple|microsoft|password|\+1[- (]/i);
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(),['schemaVersion','stage','settingClass','classification','changeDecision','taskResult','recoveryResult'].sort());
  assert.equal(requests.some(r=>r.method!=='GET'),false);
});

test(`OPTIONAL task failure requires restore path (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(`${origin}/digital-stewardship-01.html`);
  await enter(page,'CONTACTS');await choose(page,'OPTIONAL');await choose(page,'I CHANGED ONE OPTIONAL SETTING');await choose(page,'THE TASK DOES NOT WORK');
  assert.match(await page.locator('#question').innerText(),/restore/i);
  await choose(page,'RESTORED — TASK WORKS AGAIN');
  assert.match(await page.locator('#explain').innerText(),/restored/i);
  const s=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
  assert.equal(s.recoveryResult,'restored_works');
});

test(`REQUIRED and UNCLEAR never enter change stage (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  for(const classification of ['REQUIRED','UNCLEAR']){
    const context=await browser.newContext();const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-01.html`);
    await enter(page,'PHOTOS / FILES');await choose(page,classification);
    assert.equal(await page.getByRole('heading',{name:'CHECK COMPLETE'}).isVisible(),true);
    assert.equal(await page.getByRole('button',{name:'I CHANGED ONE OPTIONAL SETTING'}).count(),0);
    await context.close();
  }
});

test(`sign-in/account linking is absent from first-run chooser (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(`${origin}/digital-stewardship-01.html`);
  await choose(page,'I HAVE ONE');
  assert.equal(await page.getByRole('button',{name:'SIGN-IN / ACCOUNT LINKING'}).count(),0);
  await assertBudget(page);
});

test(`STOP is safe at boundary and after entry (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  for(const afterEntry of [false,true]){
    const context=await browser.newContext();const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-01.html`);
    if(afterEntry) await choose(page,'I HAVE ONE');
    await choose(page,'STOP');
    assert.equal(await page.getByRole('heading',{name:'STOPPED SAFELY'}).isVisible(),true);
    assert.doesNotMatch(await page.locator('body').innerText(),/you failed|failure penalty|score:\s*\d|streak loss/i);
    await context.close();
  }
});

test(`malformed and forged saved states reset safely (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  for(const value of ['{"schemaVersion":1,',JSON.stringify({schemaVersion:1,stage:'TASK_CHECK',settingClass:'location',classification:'optional',changeDecision:null,taskResult:null,recoveryResult:null})]){
    const context=await browser.newContext();await context.addInitScript(({k,v})=>localStorage.setItem(k,v),{k:KEY,v:value});
    const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-01.html`);
    assert.equal(await page.getByRole('button',{name:'I HAVE ONE'}).isVisible(),true);
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),null);
    await context.close();
  }
});

test(`storage failures are explicit and in-memory flow remains safe (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  for(const method of ['getItem','setItem']){
    const context=await browser.newContext();
    await context.addInitScript(({key,method})=>{
      const original=Storage.prototype[method];
      Storage.prototype[method]=function(k,...rest){if(k===key)throw new DOMException('blocked','SecurityError');return original.call(this,k,...rest);};
    },{key:KEY,method});
    const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-01.html`);
    if(method==='setItem') await choose(page,'I HAVE ONE');
    assert.match(await page.locator('#storageStatus').innerText(),/not be saved|memory/i);
    if(method==='getItem') await choose(page,'I HAVE ONE');
    assert.equal(await page.getByRole('button',{name:'LOCATION'}).isVisible(),true);
    await context.close();
  }
});

test(`clear/reload and browser back/forward preserve safe coarse behavior (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(`${origin}/before`);await page.goto(`${origin}/digital-stewardship-01.html`);
  await choose(page,'I HAVE ONE');await choose(page,'LOCATION');
  await page.goBack({waitUntil:'domcontentloaded'});await page.goForward({waitUntil:'domcontentloaded'});
  assert.match(await page.locator('#question').innerText(),/required/i);
  await page.evaluate(k=>localStorage.removeItem(k),KEY);await page.reload();
  assert.equal(await page.getByRole('button',{name:'I HAVE ONE'}).isVisible(),true);
});

test(`mobile keyboard reduced-motion rapid activation and simplicity budget hold (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const page=await context.newPage();
  await page.goto(`${origin}/digital-stewardship-01.html`);await assertBudget(page);
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.textContent?.trim()),'I HAVE ONE');await page.keyboard.press('Enter');
  const location=page.getByRole('button',{name:'LOCATION'});await location.evaluate(el=>{el.click();el.click();});
  assert.match(await page.locator('#question').innerText(),/required/i);
  await assertBudget(page);
  const state=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);assert.equal(state.stage,'CLASSIFY');
});
