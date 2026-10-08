import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HALL,START,END,MAX_H,advance,canWalk,destination,hallWalls,hangHall,viewing,prepare} from './inktober-world.js';
const data=JSON.parse(fs.readFileSync(new URL('./inktober.json',import.meta.url)));
assert.equal(data.prints.length,31,'Inktober needs 31 days');
data.prints.forEach((s,i)=>{assert.equal(s.day,i+1);assert.equal(s.date,`2026-10-${String(i+1).padStart(2,'0')}`);assert.equal(s.room,'hall')});
// Hanging: days in order, 16 down the left wall away from the door, 15 back up the right, all inside their wall.
const hung=hangHall(data.prints),[L,R]=hallWalls();
assert.equal(hung.length,31);
const left=hung.filter(h=>h.angle===90),right=hung.filter(h=>h.angle===-90);
assert.equal(left.length,16);assert.equal(right.length,15);
for(let i=1;i<16;i++)assert(left[i].z<left[i-1].z,'Left wall days do not run away from the entrance');
for(let i=1;i<15;i++)assert(right[i].z>right[i-1].z,'Right wall days do not run back towards the entrance');
for(const [w,set] of [[L,left],[R,right]])set.forEach((h,i)=>{assert(Math.abs(h.z-w.z)+h.w/2<=w.len/2-60,'A frame overflows its wall');if(i)assert(Math.abs(h.z-set[i-1].z)-h.w>=60,'Frames crowd')});
assert(hung.every(h=>h.h<=MAX_H+1e-9),'A frame is taller than the hanging limit');
// Standing spots are walkable and face the frame.
for(const h of hung){const v=viewing(h);assert(canWalk(v.x,v.z),'A day cannot be reached');const a=v.yaw*Math.PI/180;assert(Math.sign(Math.sin(a))===Math.sign(h.x-v.x),'Viewer faces away from the frame')}
// One room: no way out through the walls, and walking works at the shared speed.
assert(!canWalk(HALL+10,0)&&!canWalk(0,END-10)&&!canWalk(0,START+10),'The hall is open');
const p={...destination(),vf:0,vs:0,vturn:0};for(let i=0;i<60;i++)advance(p,{forward:1,strafe:0,turn:0},1/60);assert(START-200-p.z>460,'Walking does not move');
// Day status comes from the date: 6 October is today, the 5th is past, the 7th is ahead. Checked on blank days, so inking more of the month keeps it true.
const days=prepare(data.prints.map(s=>({...s,prompt:null,photo:null,render:false})),new Date(2026,9,6,15));
assert.equal(days.filter(s=>s.mark==='today').length,1);assert.equal(days[5].mark,'today');
assert.equal(days[4].reserved[1],'AWAITING INK');assert.equal(days[6].reserved[1],'NOT YET');assert.equal(days[0].title,'Day 01');
assert.equal(prepare([{...data.prints[0],prompt:'Crow'}],new Date(2026,9,6))[0].title,'Day 01: Crow');
console.log('PASS 31 days, hung in order (16 left, 15 right) inside their walls, every day reachable and faced, a closed hall, today/past/ahead labels.');
