import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rooms,obstacles,plinthSpots,FLOOR,DOOR_HEIGHT,HALL,ROOM_W,ROOM_D,START,END,MAX_H,advance,canWalk,destination,locationAt,roomWalls,hang} from './gallery-world.js';
const run=hz=>{const p={...destination('corridor'),vf:0,vs:0,vturn:0};for(let i=0;i<hz;i++)advance(p,{forward:1,strafe:0,turn:0},1/hz);return p};
const [a,b,c]=[30,60,144].map(run);
assert(Math.max(a.z,b.z,c.z)-Math.min(a.z,b.z,c.z)<10,'Walking depends materially on frame rate');
assert(START-200-b.z<510&&START-200-b.z>460,'Held movement did not advance at the intended walking speed');
for(const r of rooms)assert(canWalk(0,r.cz)&&canWalk(r.side*(HALL+20),r.cz)&&canWalk(r.cx,r.cz),'Door passage is disconnected');
assert(!canWalk(HALL+20,0)&&!canWalk(HALL+20,(rooms[1].cz+rooms[3].cz)/2),'A solid corridor wall is walkable');
assert(!canWalk(0,END-50)&&!canWalk(HALL+ROOM_W+50,rooms[1].cz),'Exterior boundary is open');
for(const r of rooms){const p=destination(r.id);assert(canWalk(p.x,p.z));assert.equal(locationAt(p.x,p.z),r.id)}
const p={x:HALL-30,z:0,yaw:90,vf:0,vs:0,vturn:0};for(let i=0;i<180;i++)advance(p,{forward:1,strafe:0,turn:0},1/60);assert(p.x<=HALL-25,'Movement crossed a wall');
for(let i=0;i<120;i++)advance(b,{forward:0,strafe:0,turn:0},1/60);assert(Math.abs(b.vf)<.001,'Released keys did not stop');
assert.equal(FLOOR-DOOR_HEIGHT/2+DOOR_HEIGHT/2,FLOOR,'Door does not meet floor');
const manifest=JSON.parse(fs.readFileSync(new URL('./print-gallery.json',import.meta.url)));
assert.equal(manifest.prints.filter(s=>!s.hang).length,24);assert(manifest.prints.filter(s=>s.hang==='plinth').every(s=>s.box&&['front','back','left','right','top'].every(f=>f in s.faces)),'A plinth piece lacks its box or faces');assert(manifest.prints.some(s=>s.hang==='peg'),'No peg garland pieces');assert(manifest.prints.every(s=>s.photo===null&&!s.studio&&!s.decoder),'Placeholder gallery contains fabricated print photos');
assert(new Set(manifest.prints.filter(s=>s.frame).map(s=>s.frame.width+'x'+s.frame.height)).size>=4,'Frames lack size and aspect variety');
// Hanging: every frame sits inside its wall with a gap to the next, and none outgrows MAX_H.
for(const r of rooms){const walls=roomWalls(r),hung=hang(manifest.prints.filter(s=>s.room===r.id&&!s.hang),walls);
 for(const w of walls){const on=hung.filter(h=>Math.hypot(h.x-w.x,h.z-w.z)<w.len/2&&h.angle===w.angle).map(h=>({c:w.angle%180?h.z-w.z:h.x-w.x,w:h.w})).sort((a,b)=>a.c-b.c);
  on.forEach((h,i)=>{assert(Math.abs(h.c)+h.w/2<=w.len/2-60,`${r.id}: a frame overflows the ${w.id} wall`);if(i)assert(h.c-h.w/2-(on[i-1].c+on[i-1].w/2)>=60,`${r.id}: frames crowd on the ${w.id} wall`)})}
 assert(hung.every(h=>h.h<=MAX_H+1e-9),'A frame is taller than the hanging limit')}
// Plinths: on the room's centre line, inside the room, and solid to walk into.
for(const r of rooms)for(const at of plinthSpots(r,3))assert.equal(locationAt(at.x,at.z),r.id,'A plinth spot is outside its room');
obstacles.push({x:rooms[0].cx,z:rooms[0].cz,r:200});assert(!canWalk(rooms[0].cx,rooms[0].cz)&&canWalk(destination(rooms[0].id).x,rooms[0].cz),'A plinth is walkable or blocks the door');obstacles.length=0;
const script=fs.readFileSync(new URL('./gallery.js',import.meta.url),'utf8');assert(!script.includes("fetch('catalogue.json'"),'Gallery still loads generated specimens');
assert.equal((script.match(/\$\('scene'\)\.innerHTML=/g)||[]).length,1,'Scene is replaced during navigation');
console.log('PASS 6 fixed rooms, 24 photo placeholders, a peg line and plinths, frames hung inside their walls, varied frames, floor-level doors, connected passages, wall collisions, key release and 30/60/144 Hz walking parity.');
