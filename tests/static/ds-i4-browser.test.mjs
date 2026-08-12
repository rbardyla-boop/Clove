import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';

const html=await readFile(new URL('../../digital-stewardship-04.html',import.meta.url));
const js=await readFile(new URL('../../digital-stewardship-04.js',import.meta.url));
const KEY='clove_ds_i4_v1';
const engine=process.env.DS_BROWSER==='firefox'?'firefox':'chromium';

function startServer(){
  const requests=[];
  const server=createServer((req,res)=>{
    requests.push({method:req.method,url:req.url});
    if(req.url==='/before'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><title>Before</title>');return;}
    if(req.method==='GET'&&(req.url==='/'||req.url==='/digital-stewardship-04.html')){res.writeHead(200,{'content-type':'text/html'});res.end(html);return;}
    if(req.method==='GET'&&req.url==='/digital-stewardship-04.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(js);return;}
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
  const buttons=page.locator('button:visible');assert.ok(await buttons.count()<=6,`too many buttons: ${await buttons.count()}`);
  for(let i=0;i<await buttons.count();i++){const box=await buttons.nth(i).boundingBox();assert.ok(box&&box.height>=44);}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);
}
async function enter(page,type='SUBSCRIPTION / MEMBERSHIP'){await choose(page,'START CHECK');await choose(page,type);}
async function headline(page,value='YES — CLEAR'){await choose(page,value);}
async function recurringClear(page){
  await enter(page);await headline(page);await choose(page,'RECURRING');await choose(page,'YES — RENEWAL SHOWN');await choose(page,'YES — TIMING SHOWN');await choose(page,'YES — CONDITIONS SHOWN');await choose(page,'NO — NO OPTIONAL ADD-ONS SEEN');
}

test(`clear recurring offer reaches outside-only decision with coarse state and no network (${engine})`,async t=>{
  const {server,requests,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(`${origin}/digital-stewardship-04.html`);await recurringClear(page);await choose(page,'CLEAR ENOUGH — CONTINUE OUTSIDE CLOVE');
  assert.equal(await page.getByRole('heading',{name:'CHECK COMPLETE'}).isVisible(),true);
  const raw=await page.evaluate(k=>localStorage.getItem(k),KEY);assert.ok(raw);assert.doesNotMatch(raw,/@|https?:|\$|visa|mastercard|netflix|amazon/i);
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(),['schemaVersion','stage','offerType','headlineClear','billingPattern','renewalShown','timingShown','conditionShown','addonsObserved','decision'].sort());
  assert.equal(requests.some(r=>r.method!=='GET'),false);
});

test(`unclear commitment cannot be represented as clear enough (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(`${origin}/digital-stewardship-04.html`);await enter(page,'FREE TRIAL');await headline(page,"I'M NOT SURE");await choose(page,'UNCLEAR');await choose(page,"I'M NOT SURE");await choose(page,"I'M NOT SURE");await choose(page,"I'M NOT SURE");await choose(page,"I'M NOT SURE");
  assert.equal(await page.getByRole('button',{name:'CLEAR ENOUGH — CONTINUE OUTSIDE CLOVE'}).count(),0);
  assert.equal(await page.getByRole('button',{name:'NOT CLEAR — DO NOT COMMIT YET'}).isVisible(),true);
});

test(`one-time offer uses not-applicable renewal checks and can finish (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(`${origin}/digital-stewardship-04.html`);await enter(page,'ONE-TIME DIGITAL PURCHASE');await headline(page);await choose(page,'ONE-TIME');await choose(page,'NOT APPLICABLE');await choose(page,'NOT APPLICABLE');await choose(page,'YES — CONDITIONS SHOWN');await choose(page,'NO — NO OPTIONAL ADD-ONS SEEN');await choose(page,'CLEAR ENOUGH — CONTINUE OUTSIDE CLOVE');
  assert.equal(await page.getByRole('heading',{name:'CHECK COMPLETE'}).isVisible(),true);
});

test(`no-longer-want and need-help are valid nonpurchase outcomes (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  for(const decision of ['NO LONGER WANT IT','NEED HELP — LEAVE SAFELY']){const context=await browser.newContext();const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-04.html`);await recurringClear(page);await choose(page,decision);assert.equal(await page.getByRole('heading',{name:'CHECK COMPLETE'}).isVisible(),true);assert.doesNotMatch(await page.locator('#explain').innerText(),/purchase now|cancel now/i);await context.close();}
});

test(`malformed and forged states reset safely (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  const bad=['{"schemaVersion":1,',JSON.stringify({schemaVersion:1,stage:'DECISION',offerType:'subscription',headlineClear:'yes',billingPattern:null,renewalShown:null,timingShown:null,conditionShown:null,addonsObserved:null,decision:null})];
  for(const value of bad){const context=await browser.newContext();await context.addInitScript(({k,v})=>localStorage.setItem(k,v),{k:KEY,v:value});const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-04.html`);assert.equal(await page.getByRole('button',{name:'START CHECK'}).isVisible(),true);assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),null);await context.close();}
});

test(`storage read/write failures are explicit and remain usable in memory (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  for(const method of ['getItem','setItem']){const context=await browser.newContext();await context.addInitScript(({key,method})=>{const original=Storage.prototype[method];Storage.prototype[method]=function(k,...rest){if(k===key)throw new DOMException('blocked','SecurityError');return original.call(this,k,...rest);};},{key:KEY,method});const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-04.html`);if(method==='setItem')await choose(page,'START CHECK');assert.match(await page.locator('#storageStatus').innerText(),/not be saved|memory/i);if(method==='getItem')await choose(page,'START CHECK');assert.match(await page.locator('#question').innerText(),/kind of offer/i);await context.close();}
});

test(`reload, clear and back-forward preserve only coarse progress (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(`${origin}/before`);await page.goto(`${origin}/digital-stewardship-04.html`);await enter(page);await headline(page);await choose(page,'RECURRING');await page.goBack({waitUntil:'domcontentloaded'});await page.goForward({waitUntil:'domcontentloaded'});assert.match(await page.locator('#question').innerText(),/renewal/i);await page.reload();assert.match(await page.locator('#question').innerText(),/renewal/i);await page.evaluate(k=>localStorage.removeItem(k),KEY);await page.reload();assert.equal(await page.getByRole('button',{name:'START CHECK'}).isVisible(),true);
});

test(`STOP works from every nonterminal depth (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  const setups=[async p=>{},async p=>choose(p,'START CHECK'),async p=>enter(p),async p=>{await enter(p);await headline(p);},async p=>{await enter(p);await headline(p);await choose(p,'RECURRING');},async p=>recurringClear(p)];
  for(const setup of setups){const context=await browser.newContext();const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-04.html`);await setup(page);assert.equal(await page.getByRole('button',{name:'STOP',exact:true}).isVisible(),true);await choose(page,'STOP');assert.equal(await page.getByRole('heading',{name:'STOPPED SAFELY'}).isVisible(),true);await context.close();}
});

test(`mobile keyboard reduced-motion rapid activation and simplicity budget hold (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const browser=await launch();t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-04.html`);await budget(page);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.textContent?.trim()),'START CHECK');await page.keyboard.press('Enter');const b=page.getByRole('button',{name:'SUBSCRIPTION / MEMBERSHIP'});await b.evaluate(el=>{el.click();el.click();});assert.match(await page.locator('#question').innerText(),/headline/i);await budget(page);const s=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);assert.equal(s.stage,'HEADLINE');
});
