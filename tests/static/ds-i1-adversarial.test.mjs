import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';

const html=await readFile(new URL('../../digital-stewardship-01.html',import.meta.url));
const js=await readFile(new URL('../../digital-stewardship-01.js',import.meta.url));
const engine=process.env.DS_BROWSER==='firefox'?'firefox':'chromium';

function startServer(){
  const server=createServer((req,res)=>{
    if(req.method==='GET'&&(req.url==='/'||req.url==='/digital-stewardship-01.html')){res.writeHead(200,{'content-type':'text/html'});res.end(html);return;}
    if(req.method==='GET'&&req.url==='/digital-stewardship-01.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(js);return;}
    if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
    res.writeHead(404);res.end('not found');
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve({server,url:`http://127.0.0.1:${server.address().port}/digital-stewardship-01.html`})));
}
async function launch(){return engine==='firefox'?firefox.launch({headless:true}):chromium.launch({headless:true,channel:'chrome'});}
async function choose(page,name){await page.getByRole('button',{name,exact:true}).click();}

async function toClassify(page,setting='LOCATION'){await choose(page,'I HAVE ONE');await choose(page,setting);}
async function toChange(page){await toClassify(page);await choose(page,'OPTIONAL');}
async function toTask(page){await toChange(page);await choose(page,'I CHANGED ONE OPTIONAL SETTING');}
async function toRecover(page){await toTask(page);await choose(page,'THE TASK DOES NOT WORK');}

test(`OTHER / NOT SURE remains inspection-only (${engine})`,async t=>{
  const {server,url}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(url);
  await toClassify(page,'OTHER / NOT SURE');await choose(page,'OPTIONAL');
  assert.equal(await page.getByRole('heading',{name:'CHECK COMPLETE'}).isVisible(),true);
  assert.match(await page.locator('#explain').innerText(),/not clear enough|left it alone/i);
  assert.equal(await page.getByRole('button',{name:'I CHANGED ONE OPTIONAL SETTING'}).count(),0);
});

test(`restored-but-still-broken ends change attempts instead of escalating (${engine})`,async t=>{
  const {server,url}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(url);
  await toRecover(page);await choose(page,'RESTORED — STILL NOT WORKING');
  assert.equal(await page.getByRole('heading',{name:'CHECK COMPLETE'}).isVisible(),true);
  assert.match(await page.locator('#explain').innerText(),/Stop changing settings.*official help/i);
});

test(`STOP works from every deeper nonterminal stage (${engine})`,async t=>{
  const {server,url}=await startServer();t.after(()=>new Promise(r=>server.close(r)));
  const browser=await launch();t.after(()=>browser.close());
  const setups=[
    async page=>toClassify(page),
    async page=>toChange(page),
    async page=>toTask(page),
    async page=>toRecover(page),
  ];
  for(const setup of setups){
    const context=await browser.newContext();const page=await context.newPage();await page.goto(url);await setup(page);
    assert.equal(await page.getByRole('button',{name:'STOP',exact:true}).isVisible(),true);
    await choose(page,'STOP');
    assert.equal(await page.getByRole('heading',{name:'STOPPED SAFELY'}).isVisible(),true);
    await context.close();
  }
});
