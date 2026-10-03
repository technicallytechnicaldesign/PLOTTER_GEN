export const FLOOR=325,CEILING=-325,DOOR_HEIGHT=440,DOOR_WIDTH=340;
export const rooms=[
 {id:'marks',name:'Marks & fields',side:-1,row:0,tone:'#8a8170'},
 {id:'scenes',name:'Scenes & places',side:1,row:0,tone:'#6c8a7c'},
 {id:'hidden',name:'Hidden messages',side:-1,row:1,tone:'#858094'},
 {id:'mechanical',name:'Mechanical studies',side:1,row:1,tone:'#838774'},
 {id:'paper',name:'Paper & creatures',side:-1,row:2,tone:'#998373'},
 {id:'collected',name:'Collected prints',side:1,row:2,tone:'#738995'}
].map(r=>({...r,cx:r.side*870,cz:-450-r.row*900}));
export function locationAt(x,z){return rooms.find(r=>r.side*x>270&&Math.abs(z-r.cz)<350)?.id||'corridor'}
export function canWalk(x,z){
 if(Math.abs(x)<=235&&z>=-2800&&z<=600)return true;
 return rooms.some(r=>(r.side*x>=235&&r.side*x<=310&&Math.abs(z-r.cz)<=140)||(r.side*x>=290&&r.side*x<=1420&&Math.abs(z-r.cz)<=320));
}
export function advance(p,input,dt){
 dt=Math.min(.04,Math.max(0,dt));const ease=1-Math.exp(-12*dt),speed=input.fast?450:280;
 p.vf+=(input.forward*speed-p.vf)*ease;p.vs+=(input.strafe*speed-p.vs)*ease;p.vturn+=(input.turn*80-p.vturn)*ease;p.yaw+=p.vturn*dt;
 const a=p.yaw*Math.PI/180,dx=(Math.sin(a)*p.vf+Math.cos(a)*p.vs)*dt,dz=(-Math.cos(a)*p.vf+Math.sin(a)*p.vs)*dt;
 if(canWalk(p.x+dx,p.z))p.x+=dx;if(canWalk(p.x,p.z+dz))p.z+=dz;return p;
}
export function destination(id){const r=rooms.find(r=>r.id===id);return r?{x:r.side*700,z:r.cz,yaw:r.side*90}:{x:0,z:550,yaw:0}}
