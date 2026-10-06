// Inktober floor plan: one big hall and no side rooms. The renderer builds a "corridor" with no doors in it,
// so the corridor IS the room: 2600 x 8400 px (about 10 x 34 m) with the same 4.4 m ceiling as the print gallery.
// Days run down the left wall from the entrance (1 to 16) and back up the right wall (17 to 31), so the month is a loop.
import * as base from './gallery-world.js';
export {FLOOR,CEILING,DOOR_HEIGHT,DOOR_WIDTH,SCALE,MAX_H,MIN_GAP,PLINTH_H,hang,plinthSpots,roomWalls} from './gallery-world.js';
export const HALL=1300,ROOM_W=0,ROOM_D=0,START=1000,END=-7400,rooms=[],obstacles=[];
export const HALL_NAME='The ink room',HALL_TONE='#2c2f36';
export const SIGN={w:760,h:300,title:'INKTOBER 2026',sub:'31 days / one room',ink:true};
export function locationAt(){return 'corridor'}
export function canWalk(x,z){return !obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.r)&&Math.abs(x)<=HALL-25&&z>=END+25&&z<=START-25}
export const advance=(p,input,dt)=>base.advance(p,input,dt,canWalk);
export function destination(){return {x:0,z:START-200,yaw:0}}
// The two long walls, inset 300 at each end so no frame sits in a corner.
export function hallWalls(){const z=(START+END)/2,len=START-END-600;return [{id:'left',x:-HALL+14,z,len,angle:90},{id:'right',x:HALL-14,z,len,angle:-90}]}
// Days 1..ceil(n/2) on the left wall, the rest on the right. Along a wall local +x runs (cos a, -sin a), so the left wall
// counts away from the entrance and the right wall counts back towards it.
export function hangHall(works){const [l,r]=hallWalls(),half=Math.ceil(works.length/2);return [...base.hang(works.slice(0,half),[l]),...base.hang(works.slice(half),[r])]}
// Stand 1250 in front of a hung frame (just short of the hall centre), looking straight at it, so the days either side are in view.
export function viewing(h){const a=h.angle*Math.PI/180;return {x:h.x+Math.sin(a)*1250,z:h.z+Math.cos(a)*1250,yaw:-h.angle}}

// Day labels and status, from the date alone. `now` is passed in so the test can pin it.
const DAY=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export function prepare(prints,now=new Date()){
 const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 return prints.map(s=>{
  const d=new Date(s.date+'T12:00:00'),n=String(s.day).padStart(2,'0'),when=s.date===today?'today':s.date<today?'past':'ahead';
  const title=`Day ${n}`+(s.prompt?`: ${s.prompt}`:'');
  const reserved=when==='today'?[`DAY ${n} / TODAY`,'READY FOR INK']:when==='ahead'?[`DAY ${n}`,'NOT YET']:[`DAY ${n}`,'AWAITING INK'];
  const note=s.photo?`${DAY[d.getDay()]} ${s.day} October`:when==='today'?'Today. Space for today\'s ink':`${DAY[d.getDay()]} ${s.day} October`;
  const description=s.description||`${DAY[d.getDay()]} ${s.day} October 2026${s.prompt?`, prompt "${s.prompt}"`:''}. Space for a photograph of the day's ink.`;
  return {...s,title,reserved,note,description,mark:when==='today'?'today':null};
 });
}
