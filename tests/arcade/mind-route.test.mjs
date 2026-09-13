import test from 'node:test';
import assert from 'node:assert/strict';
import rules from '../../game/Arcade/mind-route.js';
const {makeBoard,rotateNode,traceRoute,directions}=rules;

// An independent flood search, not the generator's authored path.
export function solve(board) {
  const pending=[[board.source]],seen=new Set([board.source]);
  while(pending.length) {
    const path=pending.shift(),cell=board.cells[path.at(-1)];
    if(cell.id===board.goal)return path;
    for(const [i,[dx,dy]] of directions.entries()) {
      if(cell.kind==='source'&&i!==cell.direction)continue;
      const x=cell.x+dx,y=cell.y+dy,id=y*board.size+x;
      if(x<0||x>=board.size||y<0||y>=board.size||seen.has(id)||board.cells[id].kind==='wall')continue;
      seen.add(id);pending.push([...path,id]);
    }
  }
  return null;
}

test('all twenty circuits reject no-input wins across 40 seeds',()=>{
  for(let level=1;level<=20;level++)for(let seed=0;seed<40;seed++) {
    const board=makeBoard(level,seed),result=traceRoute(board);
    assert.equal(board.moves,0);
    assert.equal(result.won,false,`level ${level}, seed ${seed}`);
    assert.match(result.reason,/loop/);
    assert.deepEqual(board,makeBoard(level,seed));
  }
});
test('800 independently solved circuits win only after rotating actual relays',()=>{
  for(let level=1;level<=20;level++)for(let seed=0;seed<40;seed++) {
    const board=makeBoard(level,seed),path=solve(board);
    assert.ok(path,`level ${level}, seed ${seed} has a route`);
    for(let i=1;i<path.length-1;i++) {
      const a=board.cells[path[i]],b=board.cells[path[i+1]];
      const direction=directions.findIndex(([dx,dy])=>b.x-a.x===dx&&b.y-a.y===dy);
      while(a.direction!==direction)assert.ok(rotateNode(board,a.id));
    }
    const result=traceRoute(board);
    assert.ok(board.moves>0);
    assert.equal(result.won,true);
    assert.equal(result.path.at(-1),board.goal);
    assert.deepEqual(result.path,path);
  }
});
test('edge, wall and loop are failures; immutable landmarks cannot turn',()=>{
  const board=makeBoard(1,123),first=board.cells[11];
  assert.equal(rotateNode(board,board.source),false);
  assert.equal(rotateNode(board,board.goal),false);
  assert.equal(rotateNode(board,-1),false);
  assert.equal(rotateNode(board,100),false);
  assert.match(traceRoute(board).reason,/loop/);
  first.direction=0;board.cells[12].kind='wall';
  assert.equal(rotateNode(board,12),false);
  assert.match(traceRoute(board).reason,/wall/);
  first.direction=3;
  for(const id of [6,1]){board.cells[id].kind='node';board.cells[id].direction=3;}
  assert.match(traceRoute(board).reason,/left the board/);
  assert.equal(traceRoute(board).won,false);
});
