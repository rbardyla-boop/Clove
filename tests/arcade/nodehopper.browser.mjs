import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const base=process.env.NH_BASE||'http://127.0.0.1:8766';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader'],
  ...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const evidence=process.env.NH_EVIDENCE||'/tmp/nodehopper-evidence';
await mkdir(evidence,{recursive:true});
try {
  await test('actual physics: all 12 rooms, 48 nodes, bridges, earned finish',async()=>{
    const page=await browser.newPage({viewport:{width:1365,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>localStorage.setItem('clove_signals_optout_v1','1'));
    await page.goto(`${base}/game/nodehopper/Node%20Hopper.html?qa=1&manual=1`);
    await page.locator('#title-start').click();
    const results=await page.evaluate(()=>{
      const nh=window.__nh,results=[];
      const step=(a={},n=1)=>nh.qa.step(a,n,false);
      const ensure=ok=>{if(!ok)throw Error(JSON.stringify({room:nh.game.chamberIdx,state:nh.game.state,x:nh.player.x,y:nh.player.y,lives:nh.game.lives}));};
      const move=x=>{
        for(let i=0;i<500&&Math.abs(nh.player.x-x)>.12;i++) {
          if(nh.game.state==='clear'&&Math.abs(nh.player.x-x)<.7)return;
          ensure(nh.game.state==='playing');step({left:nh.player.x>x,right:nh.player.x<x});
        }
        ensure(Math.abs(nh.player.x-x)<.15);
      };
      const climb=(x,y)=>{
        move(x);
        for(let i=0;i<240&&Math.abs(nh.player.y-y)>.07;i++)step({up:nh.player.y<y,down:nh.player.y>y});
        ensure(Math.abs(nh.player.y-y)<.1);
      };
      const ladders=[[6,6,6],[6,6,6],[5,26,7],[5,25,8],[5,26,7],[5,5,5],
        [6,6,6],[5,5,5],[5,5,5],[5,24,7],[5,24,7],[5,24,7]];
      for(let room=0;room<12;room++) {
        step({},110);ensure(nh.game.state==='playing');
        const nodes=[...nh.chamberState.nodes].sort((a,b)=>a.y-b.y||a.x-b.x);
        let level=0;
        for(const node of nodes) {
          const next=Math.round((node.y-1.5)/4);
          for(;level<next;level++)climb(ladders[room][level]+.5,5.4+4*level);
          move(node.x);
          ensure(node.collected);
        }
        ensure(nh.game.state==='clear');
        results.push({room:room+1,name:nh.chamberState.name,nodes:nodes.filter(n=>n.collected).length,
          bridges:nh.chamberState.bridges.filter(b=>b.active).length,lives:nh.game.lives});
        step({},68);
      }
      ensure(nh.game.state==='complete');nh.qa.step({},0);
      return{rooms:results,state:nh.game.state,cleared:nh.game.chambersCleared,lives:nh.game.lives};
    });
    console.log(JSON.stringify(results));
    assert.equal(results.cleared,12);assert.equal(results.lives,7);
    assert.equal(results.rooms.reduce((n,r)=>n+r.nodes,0),48);
    assert.equal(results.rooms.reduce((n,r)=>n+r.bridges,0),4);
    assert.match(await page.locator('#go-title').innerText(),/NETWORK RESTORED/);
    assert.match(await page.locator('#go-kicker').innerText(),/ALL ROUTES RECOVERED/);
    await page.screenshot({path:`${evidence}/finish-desktop.png`});
    assert.deepEqual(errors,[]);await page.close();
  });
  await test('phone portrait and landscape: controls, idle cannot win, pause and resume',async()=>{
    for(const viewport of [{width:412,height:915},{width:915,height:412}]) {
      const page=await browser.newPage({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:1});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(()=>localStorage.setItem('clove_signals_optout_v1','1'));
      await page.goto(`${base}/game/nodehopper/Node%20Hopper.html?qa=1&manual=1`);
      await page.locator('#title-start').click();
      await page.evaluate(()=>window.__nh.qa.step({},600));
      assert.equal(await page.evaluate(()=>window.__nh.game.chambersCleared),0);
      for(const id of ['btn-left','btn-right','btn-up','btn-down','btn-jump','btn-pause']) {
        const box=await page.locator(`#${id}`).boundingBox();
        assert.ok(box&&box.width>=44&&box.height>=44,`${id} tap size`);
        assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,`${id} bounds`);
      }
      const y=await page.evaluate(()=>window.__nh.player.y);
      await page.locator('#btn-pause').click();
      await page.evaluate(()=>window.__nh.qa.step({right:true,jump:true},120));
      assert.equal(await page.evaluate(()=>window.__nh.player.y),y);
      await page.locator('#btn-pause').click();
      await page.evaluate(()=>window.__nh.qa.step({right:true},20));
      assert.ok(await page.evaluate(()=>window.__nh.player.x>4));
      await page.evaluate(()=>window.__nh.qa.step({},20));
      await page.screenshot({path:`${evidence}/phone-${viewport.width}.png`});
      assert.deepEqual(errors,[]);await page.close();
    }
  });
  await test('real button input: jump, right, climb up/down, left, seven deaths and restart',async()=>{
    const page=await browser.newPage({viewport:{width:412,height:915},hasTouch:true});
    await page.addInitScript(()=>localStorage.setItem('clove_signals_optout_v1','1'));
    await page.goto(`${base}/game/nodehopper/Node%20Hopper.html?qa=1&manual=1`);
    await page.locator('#title-start').click();
    const tick=n=>page.evaluate(n=>window.__nh.qa.tick(n),n);
    const pos=()=>page.evaluate(()=>({x:window.__nh.player.x,y:window.__nh.player.y}));
    const hold=async(id,frames)=>{
      const box=await page.locator(`#${id}`).boundingBox();
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
      await page.mouse.down();await tick(frames);await page.mouse.up();
    };
    await tick(110);
    const start=await pos();await hold('btn-jump',12);
    assert.ok((await pos()).y>start.y+1);await tick(100);
    await hold('btn-right',28);assert.ok((await pos()).x>start.x+2);
    await hold('btn-up',90);const high=await pos();assert.ok(high.y>8);
    await hold('btn-down',30);assert.ok((await pos()).y<high.y-2);
    const before=await pos();await hold('btn-left',20);assert.ok((await pos()).x<before.x-1);
    for(let i=0;i<7;i++){await page.locator('#btn-respawn').click();await tick(65);}
    assert.equal(await page.evaluate(()=>window.__nh.game.state),'gameover');
    await page.locator('#go-restart').click();await tick(110);
    assert.equal(await page.evaluate(()=>window.__nh.game.state),'playing');
    assert.equal(await page.evaluate(()=>window.__nh.game.lives),7);
    await page.close();
  });
} finally {await browser.close();}
