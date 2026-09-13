// Original fixed-screen routes, not reproductions of Jumpman maps.
// Coordinates: 32 columns × 18 rows, row 0 at the top.
const CHAMBER_W=32, CHAMBER_H=18;
function room(name,hint,shelves,climbs,nodes,extras={}) {
  const cells=Array.from({length:18},(_,r)=>Array.from({length:32},(_,c)=>
    r===0||r===17||c===0||c===31?'#':'.'));
  const underlays=[];
  for(const [row,left,right] of shelves)for(let c=left;c<=right;c++)cells[row][c]='=';
  for(const [col,top,bottom,type='L'] of climbs)for(let r=top;r<=bottom;r++) {
    if(cells[r][col]==='=')underlays.push([col,r]);
    cells[r][col]=type;
  }
  for(const [col,row] of nodes) {
    if(cells[row][col]!=='.')throw Error(`${name}: node overlaps route at ${col},${row}`);
    cells[row][col]='N';
  }
  for(const [col,row,tile] of extras.tiles||[])cells[row][col]=tile;
  cells[16][3]='P';
  return{name,hint,grid:cells.map(r=>r.join('')),underlays,bridges:extras.bridges||[]};
}
const CHAMBERS=[
  room('FIRST LADDER','Gold diamonds are nodes. Collect all four. Cyan ladders: ↑ / ↓. Space: jump.',
    [[13,2,28],[9,2,28],[5,2,28]],[[6,4,16]],
    [[11,16],[22,12],[12,8],[25,4]]),
  room('ROPE PRACTICE','Pink arrows are one-way ropes. Climb the left rope; descend on the right.',
    [[13,2,28],[9,2,28],[5,2,28]],[[6,4,16,'U'],[26,4,16,'V']],
    [[12,16],[20,12],[12,8],[21,4]]),
  room('LOOPBACK ARRAY','Follow the switchback: lower left → middle right → upper left.',
    [[13,2,28],[9,2,28],[5,2,28]],[[5,12,16],[26,8,12],[7,4,8]],
    [[11,16],[20,12],[12,8],[24,4]]),
  room('DRAWBRIDGE ROOM','The lower-left node opens the broken girder. Collect it before crossing.',
    [[13,2,12],[13,17,28],[9,2,28],[5,2,28]],[[5,12,16],[25,8,12],[8,4,8]],
    [[10,12],[22,12],[12,8],[24,4]],
    {bridges:[{trigger:[10,12],cells:[[13,13],[14,13],[15,13],[16,13]]}]}),
  room('VANISHING SWITCHBACK','Amber shelves crumble. Keep moving, or drop to the safe floor and retry.',
    [[13,2,28],[9,2,28],[5,2,28]],[[5,12,16],[26,8,12],[7,4,8]],
    [[11,16],[21,12],[12,8],[24,4]],
    {tiles:[[14,13,'D'],[15,13,'D'],[16,13,'D']]}),
  room('HORSESHOE HARBOR','The open middle is a drop, not a dead end. Climb the outer routes.',
    [[13,2,28],[9,2,12],[9,19,28],[5,2,28]],[[5,4,16],[26,4,12]],
    [[11,16],[22,12],[9,8],[22,4]],{tiles:[[15,16,'^'],[16,16,'^']]}),
  room('POCKET CIRCUIT','The first node repairs the pocket. Up on the left; down on the far rope.',
    [[13,2,12],[13,17,28],[9,2,28],[5,2,28]],[[6,4,16,'U'],[26,4,16,'V']],
    [[10,12],[22,12],[12,8],[22,4]],
    {bridges:[{trigger:[10,12],cells:[[13,13],[14,13],[15,13],[16,13]]}]}),
  room('DART GALLERY','Red dart → amber warning → locked charge. Change floors before it fires.',
    [[13,2,28],[9,2,28],[5,2,28]],[[5,4,16],[26,4,16]],
    [[11,16],[20,12],[12,8],[22,4]],{tiles:[[28,10,'T']]}),
  room('UPDRAFT EXCHANGE','Far-right chevrons flip gravity. Use the ladder route or try the return shaft.',
    [[13,2,26],[9,2,26],[5,2,26]],[[5,4,16],[24,4,12]],
    [[11,16],[20,12],[12,8],[22,4]],{tiles:[[29,16,'G'],[29,1,'G']]}),
  room('TWIN GRAVITY','Climb the alternating ladders. The two chevrons reverse the right-hand shaft.',
    [[13,2,26],[9,2,26],[5,2,26]],[[5,12,16],[24,8,12],[7,4,8]],
    [[11,16],[20,12],[12,8],[22,4]],{tiles:[[29,16,'G'],[29,1,'G'],[28,6,'T']]}),
  room('FLIP-SIDE LEDGER','Two nodes rebuild two broken girders. Make the route, then take it.',
    [[13,2,12],[13,17,26],[9,2,12],[9,17,26],[5,2,26]],
    [[5,12,16],[24,8,12],[7,4,8]],[[10,12],[20,12],[20,8],[22,4]],
    {tiles:[[29,16,'G'],[29,1,'G']],bridges:[
      {trigger:[10,12],cells:[[13,13],[14,13],[15,13],[16,13]]},
      {trigger:[20,8],cells:[[13,9],[14,9],[15,9],[16,9]]}]}),
  room('NODE HOPPER FINALE','One last switchback. Read the warning, keep your route, recover every node.',
    [[13,2,26],[9,2,26],[5,2,26]],[[5,12,16,'U'],[24,8,12],[7,4,8],[26,4,16,'V']],
    [[11,16],[20,12],[12,8],[22,4]],
    {tiles:[[29,16,'G'],[29,1,'G'],[28,6,'T'],[14,13,'D'],[15,13,'D']]}),
];
for(const c of CHAMBERS)for(const b of c.bridges) {
  if(c.grid[b.trigger[1]][b.trigger[0]]!=='N')throw Error(`${c.name}: bridge needs a node`);
  for(const [x,y] of b.cells)if(c.grid[y][x]!=='.')throw Error(`${c.name}: bridge overlaps a route`);
}
Object.assign(window,{CHAMBERS,CHAMBER_W,CHAMBER_H});
