import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const {climbDirection,advanceDart}=createRequire(import.meta.url)('../../game/nodehopper/traversal.js');
const sandbox={window:{}};
vm.runInNewContext(readFileSync(new URL('../../game/nodehopper/chambers.js',import.meta.url),'utf8'),sandbox);
test('twelve original rooms: supported spawn, valid nodes, bridge origins and empty destinations',()=>{
  assert.equal(sandbox.window.CHAMBERS.length,12);
  for(const room of sandbox.window.CHAMBERS) {
    assert.equal(room.grid.length,18);
    assert.ok(room.grid.every(r=>r.length===32&&/^[.#=^DGNMPLUVT]+$/.test(r)));
    assert.equal(room.grid.join('').split('P').length-1,1);
    assert.equal(room.grid[17][3],'#');
    assert.equal(room.grid.join('').split('N').length-1,4);
    for(const bridge of room.bridges) {
      assert.equal(room.grid[bridge.trigger[1]][bridge.trigger[0]],'N');
      for(const [x,y] of bridge.cells)assert.equal(room.grid[y][x],'.');
    }
  }
});
test('one-way ropes cannot be climbed against their arrows',()=>{
  assert.equal(climbDirection('U',false,true),0);assert.equal(climbDirection('V',true,false),0);
  assert.equal(climbDirection('L',true,false),1);assert.equal(climbDirection('L',false,true),-1);
  assert.equal(climbDirection('U',true,false),1);assert.equal(climbDirection('V',false,true),-1);
  assert.equal(climbDirection('L',true,true),0);
});
test('dart warns before charging, locks aim and resets after leaving the room',()=>{
  const dart={x:5,y:5,spawnX:5,dir:1,phase:'patrol',timer:0};
  advanceDart(dart,{x:20,y:5},1/60);assert.equal(dart.phase,'warning');
  const x=dart.x;
  for(let i=0;i<30;i++)advanceDart(dart,{x:1,y:5},1/60);
  assert.equal(dart.phase,'warning');assert.equal(dart.x,x);assert.equal(dart.dir,1);
  for(let i=0;i<11;i++)advanceDart(dart,{x:1,y:8},1/60);
  assert.equal(dart.phase,'charge');
  for(let i=0;i<150&&dart.phase==='charge';i++)advanceDart(dart,{x:1,y:8},1/60);
  assert.equal(dart.phase,'cooldown');assert.equal(dart.x,5);
});
