// Gallery floor plan: one corridor (|x| < HALL), three rooms off each side. Units are CSS px; y grows downward.
export const FLOOR=400,CEILING=-400,DOOR_HEIGHT=480,DOOR_WIDTH=360;
export const HALL=330,ROOM_W=1500,ROOM_D=1100,ROW=1300,START=700,END=-4150;
export const rooms=[
 {id:'marks',name:'Marks & fields',side:-1,row:0,tone:'#8a8170'},
 {id:'scenes',name:'Scenes & places',side:1,row:0,tone:'#6c8a7c'},
 {id:'hidden',name:'Hidden messages',side:-1,row:1,tone:'#858094'},
 {id:'mechanical',name:'Mechanical studies',side:1,row:1,tone:'#838774'},
 {id:'paper',name:'Paper & creatures',side:-1,row:2,tone:'#998373'},
 {id:'collected',name:'Collected prints',side:1,row:2,tone:'#738995'}
].map(r=>({...r,cx:r.side*(HALL+ROOM_W/2),cz:-600-r.row*ROW}));
// Plinths and anything else standing on the floor: circles the walker cannot enter, filled by the page.
export const obstacles=[];
export function locationAt(x,z){return rooms.find(r=>r.side*x>HALL+10&&Math.abs(z-r.cz)<ROOM_D/2)?.id||'corridor'}
export function canWalk(x,z){
 if(obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.r))return false;
 if(Math.abs(x)<=HALL-25&&z>=END+25&&z<=START-25)return true;
 return rooms.some(r=>(r.side*x>=HALL-25&&r.side*x<=HALL+60&&Math.abs(z-r.cz)<=DOOR_WIDTH/2-40)||(r.side*x>=HALL+30&&r.side*x<=HALL+ROOM_W-30&&Math.abs(z-r.cz)<=ROOM_D/2-30));
}
export function advance(p,input,dt){
 dt=Math.min(.04,Math.max(0,dt));const ease=1-Math.exp(-12*dt),speed=input.fast?450:280;
 p.vf+=(input.forward*speed-p.vf)*ease;p.vs+=(input.strafe*speed-p.vs)*ease;p.vturn+=(input.turn*80-p.vturn)*ease;p.yaw+=p.vturn*dt;
 // Released input settles to an exact stop, so an idle view stops redrawing.
 if(!input.forward&&Math.abs(p.vf)<1)p.vf=0;if(!input.strafe&&Math.abs(p.vs)<1)p.vs=0;if(!input.turn&&Math.abs(p.vturn)<0.2)p.vturn=0;
 const a=p.yaw*Math.PI/180,dx=(Math.sin(a)*p.vf+Math.cos(a)*p.vs)*dt,dz=(-Math.cos(a)*p.vf+Math.sin(a)*p.vs)*dt;
 if(canWalk(p.x+dx,p.z))p.x+=dx;if(canWalk(p.x,p.z+dz))p.z+=dz;return p;
}
// Arrive just inside the door, facing the far wall, so the whole room is in view.
export function destination(id){const r=rooms.find(r=>r.id===id);return r?{x:r.side*(HALL+220),z:r.cz,yaw:r.side*90}:{x:0,z:START-150,yaw:0}}

// The walls of a room that take work: centre, length and the rotateY that faces them into the room.
// Along a wall, local +x runs (cos a, -sin a) in (x, z).
export function roomWalls(r){
 const s=r.side,far=s*(HALL+ROOM_W),face=s===-1?90:-90;
 return [
  {id:'far',x:far-s*14,z:r.cz,len:ROOM_D,angle:face},
  {id:'front',x:r.cx,z:r.cz-ROOM_D/2+14,len:ROOM_W,angle:0},
  {id:'back',x:r.cx,z:r.cz+ROOM_D/2-14,len:ROOM_W,angle:180}
 ];
}
// Hang frames: each goes on the wall with the most free length, then every wall is spaced evenly.
// Frames hang at SCALE times their listed size. A wall that cannot fit its frames with breathing room scales them down; none grows past MAX_H.
export const MAX_H=0.55*(FLOOR-CEILING),MIN_GAP=120,SCALE=1.5;
export function hang(works,walls){
 const load=new Map(walls.map(w=>[w.id,[]])),used=w=>load.get(w.id).reduce((t,s)=>t+s.frame.width*SCALE,0)+MIN_GAP*(load.get(w.id).length+1);
 for(const s of works)load.get(walls.reduce((b,w)=>w.len-used(w)>b.len-used(b)?w:b).id).push(s);
 const out=[];
 for(const w of walls){
  const set=load.get(w.id);if(!set.length)continue;
  const k=Math.min(SCALE,...set.map(s=>MAX_H/s.frame.height),(w.len-MIN_GAP*(set.length+1))/set.reduce((t,s)=>t+s.frame.width,0));
  const gap=(w.len-k*set.reduce((t,s)=>t+s.frame.width,0))/(set.length+1),a=w.angle*Math.PI/180;
  let u=-w.len/2+gap;
  for(const s of set){const fw=s.frame.width*k,c=u+fw/2;u+=fw+gap;out.push({s,w:fw,h:s.frame.height*k,x:w.x+Math.cos(a)*c,z:w.z-Math.sin(a)*c,angle:w.angle})}
 }
 return out;
}
// Plinths stand on the room's centre line, spread between the door and the far wall.
export const PLINTH_H=260;
export function plinthSpots(r,n){return Array.from({length:n},(_,i)=>({x:r.side*(HALL+ROOM_W*(n===1?0.5:0.3+0.45*i/(n-1))),z:r.cz,side:r.side}))}
