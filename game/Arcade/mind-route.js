/* Pure routing rules. The 3D view cannot award a win independently. */
(function (root) {
  'use strict';
  const directions = Object.freeze([[1, 0], [0, 1], [-1, 0], [0, -1]]);
  const paths = [
    [[0,2],[1,2],[2,2],[3,2],[4,2]],
    [[0,2],[1,2],[1,1],[2,1],[3,1],[3,2],[4,2]],
    [[0,2],[1,2],[1,3],[2,3],[2,2],[3,2],[3,1],[4,1]],
    [[0,2],[1,2],[1,1],[1,0],[2,0],[3,0],[3,1],[3,2],[4,2]],
    [[0,2],[1,2],[1,3],[1,4],[2,4],[3,4],[3,3],[3,2],[2,2],[2,1],[3,1],[4,1]],
    [[0,2],[1,2],[1,1],[2,1],[2,2],[2,3],[3,3],[4,3],[4,2]],
    [[0,2],[1,2],[1,3],[2,3],[2,4],[3,4],[4,4],[4,3],[3,3],[3,2],[3,1],[4,1]],
    [[0,2],[1,2],[1,1],[2,1],[3,1],[3,0],[4,0],[4,1],[4,2],[3,2],[3,3],[4,3]],
  ];
  function makeBoard(level = 1, seed = 1) {
    level = Math.max(1, Math.min(20, Math.floor(level)));
    let value = (Number(seed) + level * 7919) >>> 0;
    const random = () => ((value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 4294967296);
    const path = paths[(level - 1) % paths.length].map(([x,y]) => [x, level > 8 ? 4-y : y]);
    const onPath = new Set(path.map(([x,y]) => y * 5 + x));
    const source = path[0][1]*5+path[0][0], goal = path.at(-1)[1]*5+path.at(-1)[0];
    const cells = Array.from({ length:25 }, (_,id) => ({
      id, x:id%5, y:Math.floor(id/5), direction:Math.floor(random()*4),
      kind:id===source?'source':id===goal?'goal':!onPath.has(id)&&random()<Math.min(.6,.12+level*.025)?'wall':'node',
    }));
    cells[source].direction=directions.findIndex(([dx,dy]) => path[1][0]-path[0][0]===dx && path[1][1]-path[0][1]===dy);
    const board = { level, size:5, source, goal, cells, moves:0 };
    // A reproducible unsolved start: the first relay sends the pulse back.
    const first = cells[path[1][1]*5+path[1][0]];
    first.direction=(cells[source].direction+2)%4;
    return board;
  }
  function rotateNode(board,id) {
    const node=board.cells[id];
    if(!node||node.kind!=='node')return false;
    node.direction=(node.direction+1)%4;
    board.moves++;
    return true;
  }
  function traceRoute(board) {
    let id=board.source;
    const visited=new Set(), path=[];
    while(path.length<=board.cells.length) {
      const cell=board.cells[id];
      if(!cell||cell.kind==='wall')return {won:false,path,reason:'The pulse hit a wall. Turn the last arrow toward an open node.'};
      if(visited.has(id))return {won:false,path,reason:'This route loops back. Turn the highlighted arrow to find a new way.'};
      visited.add(id);path.push(id);
      if(id===board.goal)return {won:true,path,reason:'Connected. The pulse reached the green goal.'};
      const [dx,dy]=directions[cell.direction];
      const x=cell.x+dx,y=cell.y+dy;
      if(x<0||x>=board.size||y<0||y>=board.size)return {won:false,path,reason:'The pulse left the board. Turn the last arrow back toward the goal.'};
      id=y*board.size+x;
    }
    return {won:false,path,reason:'Route interrupted. Try another connection.'};
  }
  const api=Object.freeze({makeBoard,rotateNode,traceRoute,directions});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.MindRoute=api;
})(typeof globalThis!=='undefined'?globalThis:this);
