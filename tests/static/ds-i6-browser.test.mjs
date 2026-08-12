import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';

const html=await readFile(new URL('../../digital-stewardship-06.html',import.meta.url));
const js=await readFile(new URL('../../digital-stewardship-06.js',import.meta.url));
const engine=process.env.DS_BROWSER==='firefox'?'firefox':'chromium';
let browser;

function startServer(){
  const requests=[];
  const server=createServer((req,res)=>{
    requests.push({method:req.method,url:req.url});
    if(req.method==='GET'&&(req.url==='/'||req.url==='/digital-stewardship-06.html')){res.writeHead(200,{'content-type':'text/html'});res.end(html);return;}
    if(req.method==='GET'&&req.url==='/digital-stewardship-06.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(js);return;}
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
async function noPersistence(page){
  assert.equal(await page.evaluate(()=>localStorage.length),0);
  assert.equal(await page.evaluate(()=>sessionStorage.length),0);
  assert.equal((await page.context().cookies()).length,0);
  assert.equal(new URL(page.url()).search,'');assert.equal(new URL(page.url()).hash,'');
}
async function fullYes(page){await choose(page,'START INSPECTION');await choose(page,'YES');await choose(page,'YES');await choose(page,'YES');await choose(page,'YES');}

test(`full yes path reaches ready-enough without storage or network (${engine})`,async t=>{
  const {server,requests,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const page=await isolatedPage(t);await page.goto(`${origin}/digital-stewardship-06.html`);
  await fullYes(page);assert.equal(await page.getByRole('button',{name:'READY ENOUGH FOR NOW'}).isVisible(),true);await choose(page,'READY ENOUGH FOR NOW');
  assert.equal(await page.getByRole('heading',{name:'INSPECTION COMPLETE'}).isVisible(),true);assert.match(await page.locator('#explain').innerText(),/not a security guarantee/i);await noPersistence(page);assert.equal(requests.some(r=>r.method!=='GET'),false);
});

test(`no normal access routes only to official help or conservative help (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const page=await isolatedPage(t);await page.goto(`${origin}/digital-stewardship-06.html`);
  await choose(page,'START INSPECTION');await choose(page,'NO');assert.equal(await page.getByRole('button',{name:'READY ENOUGH FOR NOW'}).count(),0);assert.equal(await page.getByRole('button',{name:'USE OFFICIAL HELP / RECOVERY OUTSIDE CLOVE'}).isVisible(),true);assert.equal(await page.getByRole('button',{name:'NEED HELP BEFORE CHANGING ANYTHING'}).isVisible(),true);assert.doesNotMatch(await page.locator('#explain').innerText(),/bypass|reset it here/i);
});

test(`uncertain normal access is not treated as compromise (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const page=await isolatedPage(t);await page.goto(`${origin}/digital-stewardship-06.html`);
  await choose(page,'START INSPECTION');await choose(page,"I'M NOT SURE");assert.equal(await page.getByRole('button',{name:'READY ENOUGH FOR NOW'}).count(),0);assert.doesNotMatch(await page.locator('body').innerText(),/your account is compromised/i);
});

test(`missing or uncertain settings access stays conservative (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  for(const answer of ['NO',"I'M NOT SURE"]){const context=await browser.newContext();const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-06.html`);await choose(page,'START INSPECTION');await choose(page,'YES');await choose(page,answer);assert.equal(await page.getByRole('button',{name:'READY ENOUGH FOR NOW'}).count(),0);assert.equal(await page.getByRole('button',{name:'NEEDS A RECOVERY UPDATE LATER'}).isVisible(),true);await context.close();}
});

test(`uncertain method or missing second route cannot claim ready-enough (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  for(const [method,second] of [["I'M NOT SURE",'YES'],['YES','NO'],['NO',"I'M NOT SURE"]]){const context=await browser.newContext();const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-06.html`);await choose(page,'START INSPECTION');await choose(page,'YES');await choose(page,'YES');await choose(page,method);await choose(page,second);assert.equal(await page.getByRole('button',{name:'READY ENOUGH FOR NOW'}).count(),0);assert.equal(await page.getByRole('button',{name:'NEEDS A RECOVERY UPDATE LATER'}).isVisible(),true);await context.close();}
});

test(`reload resets the ephemeral drill and leaves no answer state (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const page=await isolatedPage(t);await page.goto(`${origin}/digital-stewardship-06.html`);await choose(page,'START INSPECTION');await choose(page,'YES');await choose(page,'YES');assert.match(await page.locator('#question').innerText(),/recovery method/i);await page.reload();assert.equal(await page.getByRole('button',{name:'START INSPECTION'}).isVisible(),true);await noPersistence(page);
});

test(`STOP works from every nonterminal stage (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const setups=[async p=>{},async p=>choose(p,'START INSPECTION'),async p=>{await choose(p,'START INSPECTION');await choose(p,'YES');},async p=>{await choose(p,'START INSPECTION');await choose(p,'YES');await choose(p,'YES');},async p=>{await choose(p,'START INSPECTION');await choose(p,'YES');await choose(p,'YES');await choose(p,'YES');},async p=>fullYes(p)];
  for(const setup of setups){const context=await browser.newContext();const page=await context.newPage();await page.goto(`${origin}/digital-stewardship-06.html`);await setup(page);assert.equal(await page.getByRole('button',{name:'STOP',exact:true}).isVisible(),true);await choose(page,'STOP');assert.equal(await page.getByRole('heading',{name:'STOPPED SAFELY'}).isVisible(),true);await context.close();}
});

test(`mobile keyboard reduced-motion rapid activation and simplicity budget hold (${engine})`,async t=>{
  const {server,origin}=await startServer();t.after(()=>new Promise(r=>server.close(r)));const page=await isolatedPage(t,{viewport:{width:390,height:844},reducedMotion:'reduce'});await page.goto(`${origin}/digital-stewardship-06.html`);await budget(page);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.textContent?.trim()),'START INSPECTION');await page.keyboard.press('Enter');const yes=page.getByRole('button',{name:'YES',exact:true});await yes.evaluate(el=>{el.click();el.click();});assert.match(await page.locator('#question').innerText(),/recovery|security settings/i);await budget(page);await noPersistence(page);
});
