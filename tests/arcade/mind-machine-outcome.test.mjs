import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../../game/theincrediblemindmachine/index.html',import.meta.url),'utf8');
const outcome=source.match(/function checkRunOutcome\([\s\S]*?\n}/)[0];
function setup() {
  let speed=1;
  const events=[];
  const context={Math, STATE:{running:true,runTime:0,runStallTime:0},
    ballBody:{position:{x:-7,y:5},velocity:{length:()=>speed}},
    goalMesh:{position:{x:7,y:-4}},
    onWin(){events.push('win');context.STATE.running=false;},
    showFailure(reason){events.push(reason);context.STATE.running=false;}};
  vm.runInNewContext(`${outcome};this.check=checkRunOutcome`,context);
  return {context,events,setSpeed(v){speed=v;},step(){context.STATE.runTime+=.05;context.check(.05);}};
}
test('moving constructions have no arbitrary run deadline',()=>{
  const run=setup();
  for(let i=0;i<1200;i++)run.step();
  assert.ok(run.context.STATE.runTime>59);
  assert.deepEqual(run.events,[]);
  assert.equal(run.context.STATE.running,true);
});
test('sustained stillness fails once; movement resets the grace period',()=>{
  const run=setup();run.setSpeed(0);
  for(let i=0;i<40;i++)run.step();
  assert.deepEqual(run.events,[]);
  run.setSpeed(1);run.step();assert.equal(run.context.STATE.runStallTime,0);
  run.setSpeed(0);for(let i=0;i<60;i++)run.step();
  assert.deepEqual(run.events,['The Ball is stalled before Insight.']);
});
test('goal and bounds are separate terminal outcomes',()=>{
  const win=setup();win.context.ballBody.position={x:7,y:-4};win.step();win.step();
  assert.deepEqual(win.events,['win']);
  const lost=setup();lost.context.ballBody.position.y=-15;lost.step();lost.step();
  assert.deepEqual(lost.events,['The Ball wandered off.']);
});
