const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const origin=process.argv[2];
if(!origin) throw Error('Usage: node scripts/verify-arcade-care-campaign.cjs <origin> [evidence-directory]');
const output=process.argv[3];
(async()=>{
  if(output) await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  await context.addInitScript(()=>{localStorage.setItem('clove_signals_optout_v1','1');localStorage.setItem('deck_muted','true');});
  const page=await context.newPage(),errors=[],levels=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(origin+'/game/Arcade/');
    await page.waitForFunction(()=>document.querySelector('#imm-container').dataset.state==='ready');
    const seed=await page.evaluate(()=>currentSeed);
    for(let level=1;level<=20;level++) {
      const plan=await page.evaluate(()=>{
        const b=immBoard,dirs=[[1,0],[0,1],[-1,0],[0,-1]],q=[[b.source]],seen=new Set([b.source]);let path;
        while(q.length){const p=q.shift(),c=b.cells[p.at(-1)];if(c.id===b.goal){path=p;break;}for(let d=0;d<4;d++){if(c.kind==='source'&&d!==c.direction)continue;const x=c.x+dirs[d][0],y=c.y+dirs[d][1],id=y*5+x;if(x<0||x>4||y<0||y>4||seen.has(id)||b.cells[id].kind==='wall')continue;seen.add(id);q.push([...p,id]);}}
        if(!path)throw Error('No route');
        return path.slice(1,-1).map((id,i)=>{const c=b.cells[id],n=b.cells[path[i+2]],d=dirs.findIndex(([x,y])=>n.x-c.x===x&&n.y-c.y===y);return{id,turns:(d-c.direction+4)%4};});
      });
      for(const {id,turns} of plan)for(let j=0;j<turns;j++)await page.locator(`[data-node="${id}"]`).click();
      await page.locator('#imm-action-btn').click();
      await page.waitForFunction(()=>document.querySelector('#imm-container').dataset.state==='won');
      const record=await page.evaluate(()=>({level:immBoard.level,turns:immBoard.moves,streak:Number(document.querySelector('#global-streak').textContent),calls:immRenderer.info.render.calls,triangles:immRenderer.info.render.triangles,geometries:immRenderer.info.memory.geometries}));
      if(record.level!==level||record.streak!==level)throw Error('Wrong campaign progression: '+JSON.stringify(record));
      levels.push(record);console.log('CIRCUIT '+level+'/20 PASS');
      if(output && (level===1||level===20))await page.screenshot({path:`${output}/campaign-${level}.png`});
      if(level<20)await page.locator('#imm-next-btn').click();
    }
    const ending=await page.locator('#imm-status-title').innerText();
    const next=await page.locator('#imm-next-btn').innerText();
    if(!/20/.test(ending)||!/new set/i.test(next))throw Error('Missing distinct campaign ending');
    await page.locator('#imm-next-btn').click();
    await page.waitForFunction(()=>immBoard.level===1&&document.querySelector('#imm-container').dataset.state==='ready');
    if(errors.length)throw Error(errors.join('\n'));
    const result={verdict:'PASS',origin,seed,levels,ending,newSetStartsAtOne:true,errors};
    if(output) await fs.writeFile(`${output}/campaign-result.json`,JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
