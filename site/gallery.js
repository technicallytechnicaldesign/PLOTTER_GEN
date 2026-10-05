import {rooms,FLOOR,CEILING,DOOR_WIDTH,DOOR_HEIGHT,HALL,ROOM_W,ROOM_D,START,END,SCALE,PLINTH_H,obstacles,plinthSpots,locationAt,advance,destination,roomWalls,hang} from './gallery-world.js?v=20261005-plinth';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let prints=[],simple=reduced.matches,p={...destination('corridor'),vf:0,vs:0,vturn:0},keys=new Set(),pulses=new Map(),drag=null,last=0,frame=0;
const dims=s=>s.frame||{width:s.box.width,height:s.box.height};
const placeholder=()=>'<span class="photo-space"><span class="empty-mark">＋</span><span>PRINT PHOTO</span><small>SPACE RESERVED</small></span>';
function safeURL(value){if(!value)return null;try{const u=new URL(value,location.href);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}}
export function contentFlags(s){return {nsfw:!!s.content?.nsfw,swearing:!!s.content?.swearing||/\b(fuck\w*|shit\w*|cunt\w*|bitch\w*)\b/i.test(s.title||'')}}
function admitted(s){const f=contentFlags(s);return (!f.nsfw||$('nsfw').checked)&&(!f.swearing||$('swearing').checked)}
function surface(cls,w,h,x,y,z,angle=0,tone=''){return `<div class="room-surface ${cls}" style="width:${w}px;height:${h}px;left:${-w/2}px;top:${-h/2}px;transform:translate3d(${x}px,${y}px,${z}px) rotateY(${angle}deg);${tone?'--room-ink:'+tone:''}"></div>`}
function horizontal(cls,w,depth,x,z,y,angle){return `<div class="room-surface ${cls}" style="width:${w}px;height:${depth}px;left:${-w/2}px;top:${-depth/2}px;transform:translate3d(${x}px,${y}px,${z}px) rotateX(${angle}deg)"></div>`}
function work(s,w,h,x,y,z,angle){return `<button class="wall-work" data-print="${esc(s.id)}" aria-label="Look closer at ${esc(s.title)}" style="width:${w}px;height:${h}px;left:${-w/2}px;top:${-h/2}px;transform:translate3d(${x}px,${y}px,${z}px) rotateY(${angle}deg)">${s.photo?`<img src="${esc(safeURL(s.photo))}" alt="${esc(s.title)}">`:placeholder()}<span class="plaque">${esc(s.title)}<br><small>${s.photo?'Physical print photograph':'Awaiting a print photograph'}</small></span></button>`}
// A peg garland: a sagging string across a wall, each piece clipped to it by a peg instead of framed.
function garland(set,wall){
 const L=wall.len*0.9,gap=40,k=Math.min(SCALE,(L-gap*(set.length+1))/set.reduce((t,s)=>t+s.frame.width,0));
 set=set.map(s=>({...s,frame:{width:s.frame.width*k,height:s.frame.height*k}}));
 const sag=70,H=sag+Math.max(...set.map(s=>s.frame.height))+70,yAt=u=>sag*(1-(2*u/L-1)**2)+20,free=(L-set.reduce((t,s)=>t+s.frame.width,0))/(set.length+1);
 let d=`M0 20`;for(let u=10;u<=L;u+=10)d+=` L${u} ${yAt(u).toFixed(1)}`;
 let x=free;
 const items=set.map((s,i)=>{const u=x+s.frame.width/2,y=yAt(u),tilt=((i*37)%7-3)*0.8;x+=s.frame.width+free;return `<span class="peg" style="left:${u-5}px;top:${y-12}px"></span><button class="peg-work" data-print="${esc(s.id)}" aria-label="Look closer at ${esc(s.title)}" style="left:${u-s.frame.width/2}px;top:${y+4}px;width:${s.frame.width}px;height:${s.frame.height}px;--tilt:${tilt}deg;animation-delay:${-i*1.3}s">${s.photo?`<img src="${esc(safeURL(s.photo))}" alt="${esc(s.title)}">`:placeholder()}</button>`}).join('');
 return `<div class="peg-line" style="width:${L}px;height:${H}px;left:${-L/2}px;top:${-H/2}px;transform:translate3d(${wall.x}px,${CEILING+H/2+150}px,${wall.z}px) rotateY(${wall.angle}deg)"><svg width="${L}" height="${H}" aria-hidden="true"><path d="${d}"/></svg>${items}</div>`;
}
// A cuboid centred on its own origin. Faces are flat leaves inside one preserve-3d group; the bottom is never drawn,
// so a box resting on a plinth shares no plane with it.
const FACES=[['front',0,0,1],['back',180,0,1],['right',90,0,0],['left',-90,0,0],['top',0,90,2]];
function cuboid(w,h,d,face){return FACES.map(([n,ry,rx,k])=>{const fw=k===1||k===2?w:d,fh=k===2?d:h,t=k===1?d/2:k===2?h/2:w/2;return `<span class="cube-face face-${n}" style="width:${fw}px;height:${fh}px;left:${-fw/2}px;top:${-fh/2}px;transform:rotateY(${ry}deg) rotateX(${rx}deg) translateZ(${t}px)">${face(n)}</span>`}).join('')}
const boxFace=s=>n=>{const url=safeURL(s.faces?.[n]);return url?`<img src="${esc(url)}" alt="">`:`<span class="photo-space"><span class="empty-mark">＋</span><span>${n.toUpperCase()}</span><small>FACE PHOTO</small></span>`};
const boxSize=s=>({w:s.box.width*SCALE,h:s.box.height*SCALE,d:s.box.depth*SCALE});
// A 3D piece on a plinth: the label faces the door, the box turns slowly on top; the whole stand is one clickable piece.
function plinth(s,at){
 const {w,h,d}=boxSize(s),pw=Math.max(w,d)+90,top=FLOOR-PLINTH_H;
 obstacles.push({x:at.x,z:at.z,r:pw*0.75+40});
 return `<div class="plinth" role="button" tabindex="0" data-print="${esc(s.id)}" aria-label="Look closer at ${esc(s.title)}" style="transform:translate3d(${at.x}px,0px,${at.z}px) rotateY(${-at.side*90}deg)"><span class="plinth-base" style="transform:translateY(${FLOOR-PLINTH_H/2}px)">${cuboid(pw,PLINTH_H,pw,n=>n==='front'?`<span class="plinth-label">${esc(s.title)}</span>`:'')}</span><span class="box-at" style="transform:translateY(${top-h/2-1}px)"><span class="box-spin">${cuboid(w,h,d,boxFace(s))}</span></span></div>`;
}
function buildWorld(){
 const tall=FLOOR-CEILING,face=side=>side===-1?90:-90;
 let html=horizontal('room-floor',2*HALL,START-END,0,(START+END)/2,FLOOR,90)+horizontal('room-ceiling',2*HALL,START-END,0,(START+END)/2,CEILING,-90);
 html+=surface('',2*HALL,tall,0,0,END)+surface('',2*HALL,tall,0,0,START,180);
 html+=`<div class="corridor-sign" style="transform:translate3d(0px,-90px,${END+20}px)">THE PRINT GALLERY<br><small>Six rooms / real prints</small></div>`;
 for(const side of [-1,1]){
  const sideRooms=rooms.filter(r=>r.side===side).sort((a,b)=>b.cz-a.cz);let start=START;
  for(const r of sideRooms){const end=r.cz+DOOR_WIDTH/2;html+=surface('',start-end,tall,side*HALL,0,(start+end)/2,face(side));start=r.cz-DOOR_WIDTH/2;
   const top=FLOOR-DOOR_HEIGHT;
   html+=surface('',DOOR_WIDTH,top-CEILING,side*HALL,(top+CEILING)/2,r.cz,face(side));
   // Door reveals: the wall's thickness, square to it, so nothing sits a hair in front of another surface.
   for(const dz of [-DOOR_WIDTH/2,DOOR_WIDTH/2])html+=surface('door-reveal',30,DOOR_HEIGHT,side*(HALL+15),FLOOR-DOOR_HEIGHT/2,r.cz+dz,0,'#727b80');
   html+=`<div class="door-label" style="transform:translate3d(${side*(HALL-18)}px,${top-60}px,${r.cz}px) rotateY(${face(side)}deg)">${esc(r.name)}</div>`;
   html+=`<button class="door-portal" data-room="${r.id}" aria-label="Enter ${esc(r.name)}" style="width:${DOOR_WIDTH}px;height:${DOOR_HEIGHT}px;left:${-DOOR_WIDTH/2}px;top:${-DOOR_HEIGHT/2}px;transform:translate3d(${side*(HALL-20)}px,${FLOOR-DOOR_HEIGHT/2}px,${r.cz}px) rotateY(${face(side)}deg)"></button>`;
   html+=horizontal('room-floor',ROOM_W,ROOM_D,r.cx,r.cz,FLOOR,90)+horizontal('room-ceiling',ROOM_W,ROOM_D,r.cx,r.cz,CEILING,-90);
   html+=surface('',ROOM_D,tall,side*(HALL+ROOM_W),0,r.cz,face(side),r.tone);
   html+=surface('',ROOM_W,tall,r.cx,0,r.cz-ROOM_D/2,0,r.tone)+surface('',ROOM_W,tall,r.cx,0,r.cz+ROOM_D/2,180,r.tone);
  }
  html+=surface('',start-END,tall,side*HALL,0,(start+END)/2,face(side));
 }
 for(const r of rooms){
  const works=prints.filter(s=>s.room===r.id),pegged=works.filter(s=>s.hang==='peg');let walls=roomWalls(r);
  if(pegged.length){html+=garland(pegged,walls.find(w=>w.id==='far'));walls=walls.filter(w=>w.id!=='far')}
  const stands=works.filter(s=>s.hang==='plinth');plinthSpots(r,stands.length).forEach((at,i)=>html+=plinth(stands[i],at));
  for(const h of hang(works.filter(s=>!s.hang),walls))html+=work(h.s,h.w,h.h,h.x,-40,h.z,h.angle);
 }
 $('scene').innerHTML=html;
 $('scene').querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>jump(b.dataset.room));
 $('scene').querySelectorAll('[data-print]').forEach(b=>{b.onclick=()=>inspect(prints.find(s=>s.id===b.dataset.print));if(b.matches('[role=button]'))b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();b.click()}}});
 // Architecture is built once: walking, looking, filters and the map never replace a wall or a print.
}
function buildMap(){
 const X=HALL+ROOM_W+80;$('map').setAttribute('viewBox',`${-X} ${END-80} ${2*X} ${START-END+160}`);
 $('map').innerHTML=`<rect x="${-HALL}" y="${END}" width="${2*HALL}" height="${START-END}" fill="white" stroke="#888" stroke-width="14"/>`+rooms.map(r=>`<g role="button" tabindex="0" aria-label="Go to ${esc(r.name)}" data-room="${r.id}" aria-current="false"><rect x="${r.cx-ROOM_W/2}" y="${r.cz-ROOM_D/2}" width="${ROOM_W}" height="${ROOM_D}" rx="50" fill="white" stroke="#888" stroke-width="14"/><text x="${r.cx}" y="${r.cz+50}" text-anchor="middle">${esc(r.name.split(' & ')[0])}</text></g>`).join('')+`<g role="button" tabindex="0" data-room="corridor" aria-label="Go to entrance corridor"><text x="0" y="${START-90}" text-anchor="middle" style="font-size:110px">IN</text></g><line id="map-heading" stroke="#c33325" stroke-width="30"/><circle id="map-player" r="75" fill="#c33325" stroke="white" stroke-width="24"/>`;
 $('map').querySelectorAll('[data-room]').forEach(b=>{b.onclick=()=>jump(b.dataset.room);b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();jump(b.dataset.room)}}});
 for(const r of rooms)$('wing').add(new Option(r.name,r.id));
}
// Field of view follows the viewport: about 70 degrees across, so a phone sees a room, not a wall at arm's length.
let lens=800;
function fit(){const v=$('viewport'),w=v.clientWidth||800,h=v.clientHeight||600;lens=Math.round(Math.max((w/2)/Math.tan(35*Math.PI/180),(h/2)/Math.tan(56*Math.PI/180)));v.style.perspective=lens+'px';camera()}
function camera(){
 $('scene').style.transform=`translateZ(${lens}px) rotateY(${p.yaw}deg) translate3d(${-p.x}px,0px,${-p.z}px)`;
 const where=locationAt(p.x,p.z),r=rooms.find(r=>r.id===where);$('room-caption').textContent=r?r.name:'Entrance corridor';$('wing').value=where;
 $('map-player')?.setAttribute('cx',p.x);$('map-player')?.setAttribute('cy',p.z);const a=p.yaw*Math.PI/180;
 if($('map-heading'))for(const [k,v] of Object.entries({x1:p.x,y1:p.z,x2:p.x+Math.sin(a)*260,y2:p.z-Math.cos(a)*260}))$('map-heading').setAttribute(k,v);
 $('map').querySelectorAll('[data-room]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.room===where)));
}
function engage(action){if(!keys.has(action))pulses.set(action,performance.now()+100);keys.add(action)}
function stop(){keys.clear();pulses.clear();p.vf=p.vs=p.vturn=0;drag=null}
function jump(id){stop();Object.assign(p,destination(id));camera();$('viewport').focus({preventScroll:true})}
function applyFilters(){
 const visible=prints.filter(admitted),real=visible.filter(s=>s.photo);
 $('count').textContent=`${real.length} print photographs / ${visible.filter(s=>!s.photo).length} reserved spaces`;
 $('scene').querySelectorAll('[data-print]').forEach(b=>b.hidden=!admitted(prints.find(s=>s.id===b.dataset.print)));
 $('flat').innerHTML=visible.map(s=>`<button data-print="${esc(s.id)}" aria-label="Look closer at ${esc(s.title)}"><span class="flat-photo">${s.photo?`<img src="${esc(safeURL(s.photo))}" alt="${esc(s.title)}">`:`<span class="flat-reserved" style="width:${dims(s).width*Math.min(1,250/dims(s).width,250/dims(s).height)}px;aspect-ratio:${dims(s).width}/${dims(s).height}">${placeholder()}</span>`}</span><span class="flat-title">${esc(s.title)}<br>${esc(rooms.find(r=>r.id===s.room)?.name)}</span></button>`).join('');
 $('flat').querySelectorAll('[data-print]').forEach(b=>b.onclick=()=>inspect(prints.find(s=>s.id===b.dataset.print)));
 $('gallery-note').textContent=real.length?'Photographs of physical prints. Empty frames are reserved spaces.':'Reserved spaces for photographs of real, physical prints. No print photographs have been added yet.';
}
function setSimple(){stop();$('simplify').setAttribute('aria-pressed',String(simple));document.querySelector('.gallery-stage').hidden=simple;document.querySelector('.walk-controls').hidden=simple;$('flat').hidden=!simple;$('map-toggle').hidden=simple;$('hint').textContent=simple?'Select a photograph or a reserved space to look closer.':'Hold W/A/S/D to walk. Hold arrow keys to turn. Drag to look. Rooms stay where they are.'}
const bindings={w:'forward',s:'back',a:'strafe-left',d:'strafe-right',arrowup:'forward',arrowdown:'back',arrowleft:'left',arrowright:'right'};
window.addEventListener('keydown',e=>{if(simple||$('closer').open||e.target.matches('input,select,textarea')||e.ctrlKey||e.altKey||e.metaKey)return;const action=bindings[e.key.toLowerCase()];if(action){e.preventDefault();engage(action);$('viewport').focus({preventScroll:true})}});
window.addEventListener('keyup',e=>{const action=bindings[e.key.toLowerCase()];if(action)keys.delete(action)});
window.addEventListener('blur',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
function animate(time){const dt=last?(time-last)/1000:0;last=time;if(!simple&&!document.hidden&&!$('closer').open){const held=action=>keys.has(action)||(pulses.get(action)||0)>time;const forward=Number(held('forward'))-Number(held('back')),strafe=Number(held('strafe-right'))-Number(held('strafe-left')),length=Math.max(1,Math.hypot(forward,strafe));advance(p,{forward:forward/length,strafe:strafe/length,turn:Number(held('right'))-Number(held('left'))},dt);camera()}frame=requestAnimationFrame(animate)}
document.querySelectorAll('[data-walk]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);engage(b.dataset.walk)};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.walk);b.onlostpointercapture=()=>keys.delete(b.dataset.walk);b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();engage(b.dataset.walk)}};b.onkeyup=()=>keys.delete(b.dataset.walk)});
const viewport=$('viewport');viewport.onpointerdown=e=>{if(e.button!==0)return;drag={id:e.pointerId,start:e.clientX,last:e.clientX,moved:false}};
viewport.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;if(Math.abs(e.clientX-drag.start)>5){drag.moved=true;viewport.setPointerCapture(e.pointerId)}if(drag.moved){p.yaw+=(e.clientX-drag.last)*.18;camera()}drag.last=e.clientX};
window.addEventListener('pointerup',()=>{if(drag?.moved)viewport.focus({preventScroll:true});setTimeout(()=>drag=null,0)});viewport.onpointercancel=()=>drag=null;viewport.addEventListener('click',e=>{if(drag?.moved){e.preventDefault();e.stopImmediatePropagation()}},true);
$('reset-view').onclick=()=>jump('corridor');$('wing').onchange=()=>jump($('wing').value);
for(const id of ['nsfw','swearing'])$(id).onchange=()=>{if($('closer').open)$('closer').close();applyFilters()};
function mapToggle(){const hidden=!$('map-panel').hidden;$('map-panel').hidden=hidden;$('map-toggle').setAttribute('aria-expanded',String(!hidden))}$('map-toggle').onclick=mapToggle;if(matchMedia('(max-width:700px)').matches)mapToggle();$('map-close').onclick=mapToggle;
try{simple=JSON.parse(localStorage.getItem('plg-gallery-simple')??String(simple))}catch{}
$('simplify').onclick=()=>{simple=!simple;try{localStorage.setItem('plg-gallery-simple',String(simple))}catch{}setSimple()};
function turntable(s){
 const {w,h,d}=boxSize(s),k=Math.min(1.4,260/Math.max(w,h,d));let ry=-30,rx=-18,from=null;
 $('piece').innerHTML=`<div class="cube-stage" aria-label="Drag to turn ${esc(s.title)}"><div class="cube">${cuboid(w*k,h*k,d*k,boxFace(s))}</div></div>`;
 const stage=$('piece').firstChild,cube=stage.firstChild,pose=()=>cube.style.transform=`rotateX(${rx}deg) rotateY(${ry}deg)`;pose();
 stage.onpointerdown=e=>{from=[e.clientX,e.clientY,ry,rx];stage.setPointerCapture(e.pointerId)};
 stage.onpointermove=e=>{if(!from)return;ry=from[2]+(e.clientX-from[0])*0.5;rx=Math.max(-80,Math.min(80,from[3]-(e.clientY-from[1])*0.5));pose()};
 stage.onpointerup=stage.onpointercancel=()=>from=null;
}
function inspect(s){stop();$('piece-title').textContent=s.title;if(s.hang==='plinth')turntable(s);else $('piece').innerHTML=s.photo?`<img src="${esc(safeURL(s.photo))}" alt="${esc(s.title)}">`:placeholder();$('piece-description').textContent=s.description||(s.hang==='plinth'?'Space reserved for photographs of each face of a 3D piece. Drag to turn it.':'Space reserved for a photograph of a physical print.');$('piece-status').textContent='';for(const [id,url] of [['studio',s.studio],['decoder',s.decoder]]){const link=safeURL(url);$(id).hidden=!s.photo||!link;if(link)$(id).href=link}$('closer').showModal()}
async function close(){if(document.fullscreenElement)await document.exitFullscreen();$('closer').close();viewport.focus({preventScroll:true})}$('close').onclick=close;$('closer').addEventListener('cancel',e=>{e.preventDefault();close()});
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('closer').requestFullscreen()}catch{$('piece-status').textContent='Fullscreen is unavailable here; the large inspection view is still open.'}};
try{const response=await fetch('print-gallery.json',{cache:'no-cache'});if(!response.ok)throw Error();const data=await response.json();prints=data.prints;buildWorld();buildMap();applyFilters();setSimple();fit();new ResizeObserver(fit).observe($('viewport'));frame=requestAnimationFrame(animate)}catch(error){$('status').textContent='The print gallery could not load. Reload or return to Studios.';console.error(error)}
