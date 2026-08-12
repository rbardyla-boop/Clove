import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';

const html = await readFile(new URL('../../digital-stewardship-00.html', import.meta.url));
const js = await readFile(new URL('../../digital-stewardship-00.js', import.meta.url));
const KEY = 'clove_ds_i0_v1';
const engine = process.env.DS_BROWSER === 'firefox' ? 'firefox' : 'chromium';

function startServer(){
  const requests=[];
  const server=createServer((req,res)=>{
    requests.push({method:req.method,url:req.url});
    if(req.method==='GET' && (req.url==='/' || req.url==='/digital-stewardship-00.html')){res.writeHead(200,{'content-type':'text/html'});res.end(html);return;}
    if(req.method==='GET' && req.url==='/digital-stewardship-00.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(js);return;}
    if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
    res.writeHead(404);res.end('not found');
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve({server,requests,url:`http://127.0.0.1:${server.address().port}/digital-stewardship-00.html`})));
}

async function launch(){return engine==='firefox' ? firefox.launch({headless:true}) : chromium.launch({headless:true,channel:'chrome'});}
async function choose(page,name){await page.getByRole('button',{name,exact:true}).click();}

async function fullKnownPath(page){
  await choose(page,'I HAVE ONE');
  await choose(page,'PHONE');
  await choose(page,'BROWSER');
  await choose(page,'YES');
  await choose(page,'YES — IT WOULD STILL EXIST');
  await choose(page,'YES — RECOVERY EMAIL / PHONE');
  await choose(page,'I CHECKED — IT LOOKS CURRENT');
}

test(`DS-I0 full known path persists coarse state only (${engine})`, async t=>{
  const {server,requests,url}=await startServer(); t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch(); t.after(()=>browser.close());
  const page=await browser.newPage(); await page.goto(url);
  assert.equal(await page.getByRole('heading',{name:'KNOW THE MACHINE.'}).isVisible(),true);
  await fullKnownPath(page);
  assert.match(await page.getByRole('heading',{name:'MAP COMPLETE'}).innerText(),/MAP COMPLETE/);
  const raw=await page.evaluate(k=>localStorage.getItem(k),KEY);
  assert.ok(raw);
  assert.doesNotMatch(raw,/@|https?:|provider|gmail|google|apple|microsoft|phone number|password|backup-code/i);
  const parsed=JSON.parse(raw);
  assert.deepEqual(Object.keys(parsed).sort(),['accessMode','deviceClass','hasAccount','providerPersistenceBelief','recoveryCheckResult','recoveryClass','schemaVersion','stage'].sort());
  assert.equal(parsed.stage,'COMPLETE');
  assert.equal(requests.some(r=>r.method!=='GET'),false);
});

test(`reload resumes without URL state and unknown answers remain valid (${engine})`, async t=>{
  const {server,url}=await startServer(); t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch(); t.after(()=>browser.close());
  const page=await browser.newPage(); await page.goto(url);
  await choose(page,'I HAVE ONE'); await choose(page,"I DON'T KNOW");
  await page.reload();
  assert.equal(new URL(page.url()).search,'');
  assert.match(await page.locator('#question').innerText(),/app or a browser/i);
  await choose(page,"I DON'T KNOW"); await choose(page,'NOT SURE'); await choose(page,'NOT SURE'); await choose(page,'NO / NOT SURE'); await choose(page,'I STILL DO NOT KNOW');
  assert.equal(await page.getByText('Recovery still unknown', {exact:false}).isVisible(),true);
});

test(`STOP is a safe terminal path and not scored as failure (${engine})`, async t=>{
  const {server,url}=await startServer(); t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch(); t.after(()=>browser.close());
  const page=await browser.newPage(); await page.goto(url);
  await choose(page,'I HAVE ONE'); await choose(page,'COMPUTER'); await choose(page,'STOP');
  assert.equal(await page.getByRole('heading',{name:'STOPPED SAFELY'}).isVisible(),true);
  assert.doesNotMatch(await page.locator('body').innerText(),/failed|failure|streak|score/i);
});

test(`malformed saved state resets safely (${engine})`, async t=>{
  const {server,url}=await startServer(); t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch(); t.after(()=>browser.close());
  const context=await browser.newContext();
  await context.addInitScript(k=>localStorage.setItem(k,'{"schemaVersion":99,"stage":"HACKED","recoveryClass":"john@example.com"}'),KEY);
  const page=await context.newPage(); await page.goto(url);
  assert.equal(await page.getByRole('button',{name:'I HAVE ONE'}).isVisible(),true);
  const raw=await page.evaluate(k=>localStorage.getItem(k),KEY);
  assert.equal(raw,null);
});

test(`forged later-stage state without prerequisite answers resets safely (${engine})`, async t=>{
  const {server,url}=await startServer(); t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch(); t.after(()=>browser.close());
  const context=await browser.newContext();
  const forged={schemaVersion:1,stage:'SAFE_CHECK',deviceClass:null,accessMode:null,hasAccount:null,providerPersistenceBelief:null,recoveryClass:'contact',recoveryCheckResult:null};
  await context.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:KEY,value:forged});
  const page=await context.newPage(); await page.goto(url);
  assert.equal(await page.getByRole('button',{name:'I HAVE ONE'}).isVisible(),true);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),null);
});

test(`storage write failure is explicit and flow remains usable in memory (${engine})`, async t=>{
  const {server,url}=await startServer(); t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch(); t.after(()=>browser.close());
  const context=await browser.newContext();
  await context.addInitScript(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){if(k==='clove_ds_i0_v1') throw new DOMException('blocked','SecurityError'); return original.call(this,k,v);};
  });
  const page=await context.newPage(); await page.goto(url);
  await choose(page,'I HAVE ONE');
  assert.match(await page.locator('#storageStatus').innerText(),/not be saved|memory/i);
  await choose(page,'TABLET');
  assert.match(await page.locator('#question').innerText(),/app or a browser/i);
});

test(`mobile, keyboard, reduced-motion and rapid activation remain safe (${engine})`, async t=>{
  const {server,url}=await startServer(); t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch(); t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage(); await page.goto(url);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);
  await page.keyboard.press('Tab');
  const first=await page.evaluate(()=>document.activeElement?.textContent?.trim());
  assert.equal(first,'I HAVE ONE');
  await page.keyboard.press('Enter');
  const button=page.getByRole('button',{name:'PHONE'});
  await button.evaluate(el=>{el.click();el.click();});
  assert.match(await page.locator('#question').innerText(),/app or a browser/i);
  const state=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
  assert.equal(state.stage,'ACCESS_MODE');
});
