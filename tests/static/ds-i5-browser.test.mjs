import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';

const html=await readFile(new URL('../../digital-stewardship-05.html',import.meta.url));
const js=await readFile(new URL('../../digital-stewardship-05.js',import.meta.url));
const engine=process.env.DS_BROWSER==='firefox'?'firefox':'chromium';
let browser;

function startServer(){
  const requests=[];
  const server=createServer((req,res)=>{
    requests.push({method:req.method,url:req.url});
    if(req.url==='/before'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><title>Before</title>');return;}
    if(req.method==='GET'&&(req.url==='/'||req.url==='/digital-stewardship-05.html')){res.writeHead(200,{'content-type':'text/html'});res.end(html);return;}
    if(req.method==='GET'&&req.url==='/digital-stewardship-05.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(js);return;}
    if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
    res.writeHead(404);res.end('not found');
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve({server,requests,origin:`http://127.0.0.1:${server.address().port}`})));
}
async function launch(){return engine==='firefox'?firefox.launch({headless:true}):chromium.launch({headless:true,channel:'chrome'});}
async function choose(page,name){await page.getByRole('button',{name,exact:true}).click();}
const words=s=>s.trim()?s.trim().split(/\s+/).length:0;

before(async()=>{browser=await launch();});
after(async()=>{if(browser)await browser.close();});
async function isolatedPage(t,options={}){const context=await browser.newContext(options);t.after(()=>context.close());return context.newPage();}

async function budget(page){
  assert.equal(await page.locator('#question').isVisible(),true);
  assert.ok(words(await page.locator('#explain').innerText())<=70);
  const buttons=page.locator('button:visible');assert.ok(await buttons.count()<=6,`too many buttons: ${await buttons.count()}`);
  for(let i=0;i<await buttons.count();i++){const box=await buttons.nth(i).boundingBox();assert.ok(box&&box.height>=44);}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);
}
async function answers(page,a='YES',b='YES',c='YES'){await choose(page,'START CHECK');await choose(page,a);await choose(page,b);await choose(page,c);}
async function noPersistence(page){
  assert.equal(await page.evaluate(()=>localStorage.length),0);
  assert.equal(await page.evaluate(()=>sessionStorage.length),0);
  assert.equal(await page.context().cookies().then(c=>c.length),0);
  assert.equal(new URL(page.url()).search,'');assert.equal(new URL(page.url()).hash,'');
}

test(`high-risk answers can end in WAIT without content collection or network (${engine})`,async t=>{
  const {server,requests,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const page=await isolatedPage(t);await page.goto(`${origin}/digital-stewardship-05.html`);
  await answers(page);await choose(page,'WAIT');
  assert.equal(await page.getByRole('heading',{name:'CHECK COMPLETE'}).isVisible(),true);await noPersistence(page);assert.equal(requests.some(r=>r.method!=='GET'),false);
});

test(`all-no answers still preserve user agency rather than promising safety (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const page=await isolatedPage(t);await page.goto(`${origin}/digital-stewardship-05.html`);
  await answers(page,'NO','NO','NO');assert.equal(await page.getByRole('button',{name:'SHARE OUTSIDE CLOVE — MY DECISION'}).isVisible(),true);await choose(page,'SHARE OUTSIDE CLOVE — MY DECISION');
  assert.match(await page.locator('#explain').innerText(),/your decision|does not guarantee/i);assert.doesNotMatch(await page.locator('#explain').innerText(),/safe to share|no risk/i);
});

test(`uncertainty remains uncertainty and all conservative exits stay available (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const page=await isolatedPage(t);await page.goto(`${origin}/digital-stewardship-05.html`);
  await answers(page,"I'M NOT SURE","I'M NOT SURE","I'M NOT SURE");assert.match(await page.locator('#explain').innerText(),/uncertain|does not prove/i);
  for(const name of ['WAIT','SHARE LESS OUTSIDE CLOVE','DO NOT SHARE','NEED HELP — LEAVE SAFELY']) assert.equal(await page.getByRole('button',{name}).isVisible(),true,name);
});

test(`share-less, do-not-share and need-help are valid complete outcomes (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  for(const decision of ['SHARE LESS OUTSIDE CLOVE','DO NOT SHARE','NEED HELP — LEAVE SAFELY']){const context=await browser.newContext();const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-05.html`);await answers(page,'YES','YES','YES');await choose(page,decision);assert.equal(await page.getByRole('heading',{name:'CHECK COMPLETE'}).isVisible(),true);await context.close();}
});

test(`reload and navigation reset the ephemeral drill (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const page=await isolatedPage(t);await page.goto(`${origin}/digital-stewardship-05.html`);
  await choose(page,'START CHECK');await choose(page,'YES');assert.match(await page.locator('#question').innerText(),/audience/i);await page.reload();assert.equal(await page.getByRole('button',{name:'START CHECK'}).isVisible(),true);await noPersistence(page);
  await page.goto(`${origin}/before`);await page.goBack({waitUntil:'domcontentloaded',timeout:10000});assert.equal(await page.getByRole('button',{name:'START CHECK'}).isVisible(),true);
});

test(`STOP works from every nonterminal stage (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const setups=[async p=>{},async p=>choose(p,'START CHECK'),async p=>{await choose(p,'START CHECK');await choose(p,'YES');},async p=>{await choose(p,'START CHECK');await choose(p,'YES');await choose(p,'NO');},async p=>answers(p,'YES','NO',"I'M NOT SURE")];
  for(const setup of setups){const context=await browser.newContext();const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-05.html`);await setup(page);assert.equal(await page.getByRole('button',{name:'STOP',exact:true}).isVisible(),true);await choose(page,'STOP');assert.equal(await page.getByRole('heading',{name:'STOPPED SAFELY'}).isVisible(),true);await context.close();}
});

test(`mobile keyboard reduced-motion rapid activation and simplicity budget hold (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const page=await isolatedPage(t,{viewport:{width:390,height:844},reducedMotion:'reduce'});await page.goto(`${origin}/digital-stewardship-05.html`);
  await budget(page);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.textContent?.trim()),'START CHECK');await page.keyboard.press('Enter');const yes=page.getByRole('button',{name:'YES',exact:true});await yes.evaluate(el=>{el.click();el.click();});assert.match(await page.locator('#question').innerText(),/audience/i);await budget(page);await noPersistence(page);
});
