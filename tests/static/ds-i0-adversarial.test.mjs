import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';

const html=await readFile(new URL('../../digital-stewardship-00.html',import.meta.url));
const js=await readFile(new URL('../../digital-stewardship-00.js',import.meta.url));
const KEY='clove_ds_i0_v1';
const engine=process.env.DS_BROWSER==='firefox'?'firefox':'chromium';
let browser;

function startServer(){
  const server=createServer((req,res)=>{
    if(req.url==='/before'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><title>Before</title><a href="/digital-stewardship-00.html">open</a>');return;}
    if(req.method==='GET'&&(req.url==='/'||req.url==='/digital-stewardship-00.html')){res.writeHead(200,{'content-type':'text/html'});res.end(html);return;}
    if(req.method==='GET'&&req.url==='/digital-stewardship-00.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(js);return;}
    if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
    res.writeHead(404);res.end('not found');
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve({server,origin:`http://127.0.0.1:${server.address().port}`})));
}
async function launch(){return engine==='firefox'?firefox.launch({headless:true}):chromium.launch({headless:true,channel:'chrome'});}
async function choose(page,name){await page.getByRole('button',{name,exact:true}).click();}
const words=s=>s.trim()?s.trim().split(/\s+/).length:0;

before(async()=>{browser=await launch();});
after(async()=>{if(browser)await browser.close();});

async function isolatedPage(t,options={}){
  const context=await browser.newContext(options);t.after(()=>context.close());
  return context.newPage();
}

async function assertStageBudget(page){
  const q=page.locator('#question');
  assert.equal(await q.isVisible(),true);
  const explanation=await page.locator('#explain').innerText();
  assert.ok(words(explanation)<=70,`explanation exceeded 70 words: ${words(explanation)}`);
  const visible=page.locator('button:visible');
  assert.ok(await visible.count()<=6,`too many visible buttons: ${await visible.count()}`);
  for(let i=0;i<await visible.count();i++){
    const b=visible.nth(i);
    const box=await b.boundingBox();
    assert.ok(box && box.height>=44,`button below 44px: ${await b.innerText()}`);
    assert.ok((await b.getAttribute('aria-label'))||((await b.innerText()).trim().length>0),'button missing accessible name');
  }
}

test(`start boundary exposes a no-pressure STOP and remains within simplicity budget (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const page=await isolatedPage(t);await page.goto(`${origin}/digital-stewardship-00.html`);
  await assertStageBudget(page);
  assert.equal(await page.getByRole('button',{name:'STOP',exact:true}).isVisible(),true);
  await choose(page,'STOP');
  assert.equal(await page.getByRole('heading',{name:'STOPPED SAFELY'}).isVisible(),true);
});

test(`malformed JSON is discarded without falsely disabling healthy storage (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const context=await browser.newContext();t.after(()=>context.close());
  await context.addInitScript(k=>localStorage.setItem(k,'{"schemaVersion":1,'),KEY);
  const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-00.html`);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),null);
  assert.equal((await page.locator('#storageStatus').innerText()).trim(),'');
  await choose(page,'I HAVE ONE');
  const saved=await page.evaluate(k=>localStorage.getItem(k),KEY);
  assert.ok(saved);
  assert.equal(JSON.parse(saved).stage,'DEVICE');
});

test(`storage read failure is explicit but does not trap the in-memory flow (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const context=await browser.newContext();t.after(()=>context.close());
  await context.addInitScript(()=>{
    const get=Storage.prototype.getItem;
    Storage.prototype.getItem=function(k){if(k==='clove_ds_i0_v1')throw new DOMException('blocked','SecurityError');return get.call(this,k);};
  });
  const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-00.html`);
  assert.match(await page.locator('#storageStatus').innerText(),/not be saved|memory/i);
  await choose(page,'I HAVE ONE');await choose(page,'PHONE');
  assert.match(await page.locator('#question').innerText(),/app or a browser/i);
});

test(`clearing local state and reloading returns to a safe start (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const page=await isolatedPage(t);await page.goto(`${origin}/digital-stewardship-00.html`);
  await choose(page,'I HAVE ONE');await choose(page,'PHONE');
  await page.evaluate(k=>localStorage.removeItem(k),KEY);
  await page.reload();
  assert.equal(await page.getByRole('button',{name:'I HAVE ONE'}).isVisible(),true);
});

test(`browser back and forward resume only coarse local progress (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const page=await isolatedPage(t);
  await page.goto(`${origin}/before`);
  await page.goto(`${origin}/digital-stewardship-00.html`);
  await choose(page,'I HAVE ONE');await choose(page,'PHONE');
  assert.match(await page.locator('#question').innerText(),/app or a browser/i);
  await page.evaluate(()=>history.back());
  await page.waitForURL(/\/before$/, {timeout:10000});
  await page.evaluate(()=>history.forward());
  await page.waitForURL(/\/digital-stewardship-00\.html$/, {timeout:10000});
  assert.match(await page.locator('#question').innerText(),/app or a browser/i);
  const raw=await page.evaluate(k=>localStorage.getItem(k),KEY);
  assert.equal(JSON.parse(raw).stage,'ACCESS_MODE');
});

test(`every knowledge screen stays within the one-question action budget (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const page=await isolatedPage(t);await page.goto(`${origin}/digital-stewardship-00.html`);
  await assertStageBudget(page);
  for(const choice of ['I HAVE ONE','PHONE','BROWSER','YES','YES — IT WOULD STILL EXIST','YES — RECOVERY EMAIL / PHONE']){
    await choose(page,choice);
    await assertStageBudget(page);
    if(!['COMPLETE','STOPPED_SAFE'].includes(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).stage,KEY))){
      assert.equal(await page.getByRole('button',{name:'STOP',exact:true}).isVisible(),true);
    }
  }
  await choose(page,'I CHECKED — IT LOOKS CURRENT');
  await assertStageBudget(page);
});
