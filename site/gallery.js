import {rooms,FLOOR,CEILING,DOOR_WIDTH,DOOR_HEIGHT,locationAt,advance,destination} from './gallery-world.js?v=20261003-paper';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let prints=[],simple=reduced.matches,p={...destination('corridor'),vf:0,vs:0,vturn:0},keys=new Set(),pulses=new Map(),drag=null,last=0,frame=0;
const placeholder=()=>'<span class="photo-space"><span class="empty-mark">＋</span><span>PRINT PHOTO</span><small>SPACE RESERVED</small></span>';
function safeURL(value){if(!value)return null;try{const u=new URL(value,location.href);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}}
export function contentFlags(s){return {nsfw:!!s.content?.nsfw,swearing:!!s.content?.swearing||/\b(fuck\w*|shit\w*|cunt\w*|bitch\w*)\b/i.test(s.title||'')}}
function admitted(s){const f=contentFlags(s);return (!f.nsfw||$('nsfw').checked)&&(!f.swearing||$('swearing').checked)}
function surface(cls,w,h,x,y,z,angle=0,tone=''){return `<div class="room-surface ${cls}" style="width:${w}px;height:${h}px;left:${-w/2}px;top:${-h/2}px;transform:translate3d(${x}px,${y}px,${z}px) rotateY(${angle}deg);${tone?'--room-ink:'+tone:''}"></div>`}
function horizontal(cls,w,depth,x,z,y,angle){return `<div class="room-surface ${cls}" style="width:${w}px;height:${depth}px;left:${-w/2}px;top:${-depth/2}px;transform:translate3d(${x}px,${y}px,${z}px) rotateX(${angle}deg)"></div>`}
function buildWorld(){
 let html=horizontal('room-floor',520,3550,0,-1125,FLOOR,90)+horizontal('room-ceiling',520,3550,0,-1125,CEILING,-90);
 html+=surface('',520,650,0,0,-2900)+surface('',520,650,0,0,650,180);
 html+='<div class="corridor-sign" style="transform:translate3d(0px,-70px,-2880px)">THE PRINT GALLERY<br><small>Six rooms / real prints</small></div>';
 for(const side of [-1,1]){
  const sideRooms=rooms.filter(r=>r.side===side).sort((a,b)=>b.cz-a.cz);let start=650;
  for(const r of sideRooms){const end=r.cz+DOOR_WIDTH/2;html+=surface('',start-end,650,side*260,0,(start+end)/2,side===-1?90:-90);start=r.cz-DOOR_WIDTH/2;
   const top=FLOOR-DOOR_HEIGHT;
   html+=surface('',DOOR_WIDTH,top-CEILING,side*260,(top+CEILING)/2,r.cz,side===-1?90:-90);
   // Open jambs and lintel, from the floor up, with no painted door concealing the room.
   for(const dz of [-DOOR_WIDTH/2,DOOR_WIDTH/2])html+=surface('',16,DOOR_HEIGHT,side*256,FLOOR-DOOR_HEIGHT/2,r.cz+dz,side===-1?90:-90,'#727b80');
   html+=`<div class="door-label" style="transform:translate3d(${side*255}px,${top-55}px,${r.cz}px) rotateY(${side===-1?90:-90}deg)">${esc(r.name)}</div>`;
   html+=`<button class="door-portal" data-room="${r.id}" aria-label="Enter ${esc(r.name)}" style="width:${DOOR_WIDTH}px;height:${DOOR_HEIGHT}px;left:${-DOOR_WIDTH/2}px;top:${-DOOR_HEIGHT/2}px;transform:translate3d(${side*255}px,${FLOOR-DOOR_HEIGHT/2}px,${r.cz}px) rotateY(${side===-1?90:-90}deg)"></button>`;
   html+=horizontal('room-floor',1200,700,r.cx,r.cz,FLOOR,90)+horizontal('room-ceiling',1200,700,r.cx,r.cz,CEILING,-90);
   html+=surface('',700,650,side*1470,0,r.cz,side===-1?90:-90,r.tone);
   html+=surface('',1200,650,r.cx,0,r.cz-350,0,r.tone)+surface('',1200,650,r.cx,0,r.cz+350,180,r.tone);
  }
  html+=surface('',start+2900,650,side*260,0,(start-2900)/2,side===-1?90:-90);
 }
 for(const r of rooms){
  const works=prints.filter(s=>s.room===r.id);
  const positions=[[r.side*1450,r.cz-190,r.side===-1?90:-90],[r.side*1450,r.cz+190,r.side===-1?90:-90],[r.cx,r.cz-332,0],[r.cx,r.cz+332,180]];
  works.forEach((s,i)=>{const [x,z,angle]=positions[i%4],w=s.frame.width,h=s.frame.height;
   html+=`<button class="wall-work" data-print="${esc(s.id)}" aria-label="Look closer at ${esc(s.title)}" style="width:${w}px;height:${h}px;left:${-w/2}px;top:${-h/2}px;transform:translate3d(${x}px,${i%2?-15:20}px,${z}px) rotateY(${angle}deg)">${s.photo?`<img src="${esc(safeURL(s.photo))}" alt="${esc(s.title)}">`:placeholder()}<span class="plaque">${esc(s.title)}<br><small>${s.photo?'Physical print photograph':'Awaiting a print photograph'}</small></span></button>`;
  });
 }
 $('scene').innerHTML=html;
 $('scene').querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>jump(b.dataset.room));
 $('scene').querySelectorAll('[data-print]').forEach(b=>b.onclick=()=>inspect(prints.find(s=>s.id===b.dataset.print)));
 // Architecture is built once: walking, looking, filters and the map never replace a wall or a print.
}
function buildMap(){
 $('map').innerHTML='<rect x="-260" y="-2900" width="520" height="3550" fill="white" stroke="#888" stroke-width="12"/>'+rooms.map(r=>`<g role="button" tabindex="0" aria-label="Go to ${esc(r.name)}" data-room="${r.id}" aria-current="false"><rect x="${r.cx-600}" y="${r.cz-350}" width="1200" height="700" rx="40" fill="white" stroke="#888" stroke-width="12"/><text x="${r.cx}" y="${r.cz+30}" text-anchor="middle">${esc(r.name.split(' & ')[0])}</text></g>`).join('')+'<g role="button" tabindex="0" data-room="corridor" aria-label="Go to entrance corridor"><text x="0" y="520" text-anchor="middle" style="font-size:100px">ENTRANCE</text></g><line id="map-heading" stroke="#c33325" stroke-width="25"/><circle id="map-player" r="50" fill="#c33325" stroke="white" stroke-width="20"/>';
 $('map').querySelectorAll('[data-room]').forEach(b=>{b.onclick=()=>jump(b.dataset.room);b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();jump(b.dataset.room)}}});
 for(const r of rooms)$('wing').add(new Option(r.name,r.id));
}
function camera(){
 $('scene').style.transform=`translateZ(800px) rotateY(${p.yaw}deg) translate3d(${-p.x}px,0px,${-p.z}px)`;
 const where=locationAt(p.x,p.z),r=rooms.find(r=>r.id===where);$('room-caption').textContent=r?r.name:'Entrance corridor';$('wing').value=where;
 $('map-player')?.setAttribute('cx',p.x);$('map-player')?.setAttribute('cy',p.z);const a=p.yaw*Math.PI/180;
 if($('map-heading'))for(const [k,v] of Object.entries({x1:p.x,y1:p.z,x2:p.x+Math.sin(a)*170,y2:p.z-Math.cos(a)*170}))$('map-heading').setAttribute(k,v);
 $('map').querySelectorAll('[data-room]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.room===where)));
}
function engage(action){if(!keys.has(action))pulses.set(action,performance.now()+100);keys.add(action)}
function stop(){keys.clear();pulses.clear();p.vf=p.vs=p.vturn=0;drag=null}
function jump(id){stop();Object.assign(p,destination(id));camera();$('viewport').focus({preventScroll:true})}
function applyFilters(){
 const visible=prints.filter(admitted),real=visible.filter(s=>s.photo);
 $('count').textContent=`${real.length} print photographs / ${visible.filter(s=>!s.photo).length} reserved spaces`;
 $('scene').querySelectorAll('[data-print]').forEach(b=>b.hidden=!admitted(prints.find(s=>s.id===b.dataset.print)));
 $('flat').innerHTML=visible.map(s=>`<button data-print="${esc(s.id)}" aria-label="Look closer at ${esc(s.title)}"><span class="flat-photo">${s.photo?`<img src="${esc(safeURL(s.photo))}" alt="${esc(s.title)}">`:`<span class="flat-reserved" style="width:${s.frame.width*Math.min(1,250/s.frame.width,250/s.frame.height)}px;aspect-ratio:${s.frame.width}/${s.frame.height}">${placeholder()}</span>`}</span><span class="flat-title">${esc(s.title)}<br>${esc(rooms.find(r=>r.id===s.room)?.name)}</span></button>`).join('');
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
function mapToggle(){const hidden=!$('map-panel').hidden;$('map-panel').hidden=hidden;$('map-toggle').setAttribute('aria-expanded',String(!hidden))}$('map-toggle').onclick=mapToggle;$('map-close').onclick=mapToggle;
try{simple=JSON.parse(localStorage.getItem('plg-gallery-simple')??String(simple))}catch{}
$('simplify').onclick=()=>{simple=!simple;try{localStorage.setItem('plg-gallery-simple',String(simple))}catch{}setSimple()};
function inspect(s){stop();$('piece-title').textContent=s.title;$('piece').innerHTML=s.photo?`<img src="${esc(safeURL(s.photo))}" alt="${esc(s.title)}">`:placeholder();$('piece-description').textContent=s.description||'Space reserved for a photograph of a physical print.';$('piece-status').textContent='';for(const [id,url] of [['studio',s.studio],['decoder',s.decoder]]){const link=safeURL(url);$(id).hidden=!s.photo||!link;if(link)$(id).href=link}$('closer').showModal()}
async function close(){if(document.fullscreenElement)await document.exitFullscreen();$('closer').close();viewport.focus({preventScroll:true})}$('close').onclick=close;$('closer').addEventListener('cancel',e=>{e.preventDefault();close()});
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('closer').requestFullscreen()}catch{$('piece-status').textContent='Fullscreen is unavailable here; the large inspection view is still open.'}};
try{const response=await fetch('print-gallery.json',{cache:'no-cache'});if(!response.ok)throw Error();const data=await response.json();prints=data.prints;buildWorld();buildMap();applyFilters();setSimple();camera();frame=requestAnimationFrame(animate)}catch(error){$('status').textContent='The print gallery could not load. Reload or return to Studios.';console.error(error)}
