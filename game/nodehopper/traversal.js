/* Shared, deterministic room mechanics. Presentation never owns these rules. */
(function(root) {
  const climbDirection=(type,up,down)=> {
    const direction=Number(Boolean(up))-Number(Boolean(down));
    return (type==='U'&&direction<0)||(type==='V'&&direction>0)?0:direction;
  };
  function advanceDart(dart,player,dt) {
    if(dart.phase==='warning') {
      dart.timer+=dt;
      if(dart.timer>=.65){dart.phase='charge';dart.timer=0;}
    } else if(dart.phase==='charge') {
      dart.x+=dart.dir*12*dt;
      if(dart.x<1||dart.x>31){dart.x=dart.spawnX;dart.phase='cooldown';dart.timer=0;}
    } else if(dart.phase==='cooldown') {
      dart.timer+=dt;if(dart.timer>=1.2){dart.phase='patrol';dart.timer=0;}
    } else {
      dart.x+=dart.dir*.8*dt;
      if(dart.x<1.5||dart.x>30.5)dart.dir*=-1;
      if(Math.abs(player.y-dart.y)<.55&&Math.abs(player.x-dart.x)>2) {
        dart.dir=Math.sign(player.x-dart.x);dart.phase='warning';dart.timer=0;
      }
    }
    return dart;
  }
  const api={climbDirection,advanceDart};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.NHTraversal=api;
})(typeof window!=='undefined'?window:globalThis);
