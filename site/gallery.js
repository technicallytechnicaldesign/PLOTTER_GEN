// One script, two floor plans: <body data-world="inktober"> walks the single Inktober hall instead of the six rooms.
const ink=document.body.dataset.world==='inktober';
const world=await import(ink?'./inktober-world.js?v=20261007-ogre2':'./gallery-world.js?v=20261007-ogre2');
const {createGallery}=await import('./gallery-gl.js?v=20261007-ogre2');
const HALL_NAME=world.HALL_NAME||'Entrance corridor';
const {rooms,HALL,ROOM_W,ROOM_D,START,END,SCALE,locationAt,advance,destination}=world;
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let prints=[],simple=reduced.matches,p={...destination('corridor'),vf:0,vs:0,vturn:0},keys=new Set(),pulses=new Map(),drag=null,last=0,frame=0;
const dims=s=>s.frame||{width:s.box.width,height:s.box.height};
const placeholder=()=>'<span class="photo-space"><span class="empty-mark">＋</span><span>PRINT PHOTO</span><small>SPACE RESERVED</small></span>';
function safeURL(value){if(!value)return null;try{const u=new URL(value,location.href);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}}
export function contentFlags(s){return {nsfw:!!s.content?.nsfw,swearing:!!s.content?.swearing||/\b(fuck\w*|shit\w*|cunt\w*|bitch\w*)\b/i.test(s.title||'')}}
function admitted(s){const f=contentFlags(s);return (!f.nsfw||$('nsfw').checked)&&(!f.swearing||$('swearing').checked)}
// A cuboid centred on its own origin. Faces are flat leaves inside one preserve-3d group; the bottom is never drawn,
// so a box resting on a plinth shares no plane with it.
const FACES=[['front',0,0,1],['back',180,0,1],['right',90,0,0],['left',-90,0,0],['top',0,90,2]];
function cuboid(w,h,d,face){return FACES.map(([n,ry,rx,k])=>{const fw=k===1||k===2?w:d,fh=k===2?d:h,t=k===1?d/2:k===2?h/2:w/2;return `<span class="cube-face face-${n}" style="width:${fw}px;height:${fh}px;left:${-fw/2}px;top:${-fh/2}px;transform:rotateY(${ry}deg) rotateX(${rx}deg) translateZ(${t}px)">${face(n)}</span>`}).join('')}
const boxFace=s=>n=>{const url=safeURL(s.faces?.[n]);return url?`<img src="${esc(url)}" alt="">`:`<span class="photo-space"><span class="empty-mark">＋</span><span>${n.toUpperCase()}</span><small>FACE PHOTO</small></span>`};
const boxSize=s=>({w:s.box.width*SCALE,h:s.box.height*SCALE,d:s.box.depth*SCALE});
// The walkable view is drawn by WebGL (gallery-gl.js). #scene keeps a keyboard and screen-reader index of
// every door and print in the same order, so the 3D view never has to be clicked to be used.
let gl=null,dirty=true;
function buildWorld(){
 gl=createGallery($('viewport'),world,()=>dirty=true);gl.hangAll(prints);
 $('scene').innerHTML='<ul>'+rooms.map(r=>`<li><button data-room="${r.id}">Enter ${esc(r.name)}</button><ul>${prints.filter(s=>s.room===r.id).map(s=>`<li><button data-print="${esc(s.id)}">Look closer at ${esc(s.title)}</button></li>`).join('')}</ul></li>`).join('')+prints.filter(s=>s.room==='hall').map(s=>`<li><button data-print="${esc(s.id)}">Look closer at ${esc(s.title)}</button></li>`).join('')+'</ul>';
 $('scene').querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>jump(b.dataset.room));
 $('scene').querySelectorAll('[data-print]').forEach(b=>b.onclick=()=>inspect(prints.find(s=>s.id===b.dataset.print)));
 // Architecture is built once: walking, looking, filters and the map never rebuild a wall or a print.
}
function buildMap(){
 const X=HALL+ROOM_W+80;$('map').setAttribute('viewBox',`${-X} ${END-80} ${2*X} ${START-END+160}`);
 $('map').innerHTML=`<rect x="${-HALL}" y="${END}" width="${2*HALL}" height="${START-END}" fill="white" stroke="#888" stroke-width="14"/>`+rooms.map(r=>`<g role="button" tabindex="0" aria-label="Go to ${esc(r.name)}" data-room="${r.id}" aria-current="false"><rect x="${r.cx-ROOM_W/2}" y="${r.cz-ROOM_D/2}" width="${ROOM_W}" height="${ROOM_D}" rx="50" fill="white" stroke="#888" stroke-width="14"/><text x="${r.cx}" y="${r.cz+50}" text-anchor="middle">${esc(r.name.split(' & ')[0])}</text></g>`).join('')+`<g role="button" tabindex="0" data-room="corridor" aria-label="Go to entrance corridor"><text x="0" y="${START-90}" text-anchor="middle" style="font-size:110px">IN</text></g><line id="map-heading" stroke="#c33325" stroke-width="30"/><circle id="map-player" r="75" fill="#c33325" stroke="white" stroke-width="24"/>`;
 $('map').querySelectorAll('[data-room]').forEach(b=>{b.onclick=()=>jump(b.dataset.room);b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();jump(b.dataset.room)}}});
 for(const r of rooms)$('wing').add(new Option(r.name,r.id));
 // A hall world: every hung frame is a dot on the plan and a stop in "Go to". Today's dot is red.
 for(const s of prints.filter(s=>s.room==='hall')){const h=gl.spot(s.id);if(!h)continue;$('wing').add(new Option(s.title,s.id));
  $('map').insertAdjacentHTML('beforeend',`<circle role="button" tabindex="0" data-room="${esc(s.id)}" aria-label="Go to ${esc(s.title)}" cx="${h.x}" cy="${h.z}" r="${s.mark?150:95}" fill="${s.mark?'#c33325':s.photo?'#20252a':'white'}" stroke="#20252a" stroke-width="24"/>`)}
 $('map').querySelectorAll('circle[data-room]').forEach(b=>{b.onclick=()=>jump(b.dataset.room);b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();jump(b.dataset.room)}}});
 $('map').append($('map-heading'),$('map-player'));
}
// Field of view follows the viewport: about 70 degrees across, so a phone sees a room, not a wall at arm's length.
function fit(){const v=$('viewport'),w=v.clientWidth||800,h=v.clientHeight||600;gl.resize(w,h,Math.max((w/2)/Math.tan(35*Math.PI/180),(h/2)/Math.tan(56*Math.PI/180)));camera()}
function camera(){
 dirty=true;
 const where=locationAt(p.x,p.z),r=rooms.find(r=>r.id===where);$('room-caption').textContent=r?r.name:HALL_NAME;if(!ink)$('wing').value=where;
 $('map-player')?.setAttribute('cx',p.x);$('map-player')?.setAttribute('cy',p.z);const a=p.yaw*Math.PI/180;
 if($('map-heading'))for(const [k,v] of Object.entries({x1:p.x,y1:p.z,x2:p.x+Math.sin(a)*260,y2:p.z-Math.cos(a)*260}))$('map-heading').setAttribute(k,v);
 $('map').querySelectorAll('[data-room]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.room===where)));
}
function engage(action){if(!keys.has(action))pulses.set(action,performance.now()+100);keys.add(action)}
function stop(){keys.clear();pulses.clear();p.vf=p.vs=p.vturn=0;drag=null}
function jump(id){stop();const h=gl?.spot?.(id);Object.assign(p,h?world.viewing(h):destination(id));camera();$('viewport').focus({preventScroll:true})}
function applyFilters(){
 const visible=prints.filter(admitted),real=visible.filter(s=>s.photo&&!s.render);
 $('count').textContent=ink?`${real.length} of ${visible.length} days inked`:`${real.length} print photographs / ${visible.filter(s=>!s.photo).length} reserved spaces`;
 for(const s of prints){const on=admitted(s);gl.show(s.id,on);const b=$('scene').querySelector(`[data-print="${CSS.escape(s.id)}"]`);if(b)b.closest('li').hidden=!on}dirty=true;
 $('flat').innerHTML=visible.map(s=>`<button data-print="${esc(s.id)}" aria-label="Look closer at ${esc(s.title)}"><span class="flat-photo">${s.photo?`<img src="${esc(safeURL(s.photo))}" alt="${esc(s.title)}">`:`<span class="flat-reserved" style="width:${dims(s).width*Math.min(1,250/dims(s).width,250/dims(s).height)}px;aspect-ratio:${dims(s).width}/${dims(s).height}">${placeholder()}</span>`}</span><span class="flat-title">${esc(s.title)}<br>${esc(ink?s.note:rooms.find(r=>r.id===s.room)?.name)}</span></button>`).join('');
 $('flat').querySelectorAll('[data-print]').forEach(b=>b.onclick=()=>inspect(prints.find(s=>s.id===b.dataset.print)));
 if(ink){$('gallery-note').textContent=real.length?'One photograph of each day\'s ink. Empty frames are days still to come or still to be photographed.':'One frame for each day of Inktober. Photographs of the day\'s ink go in as they are made.';return}
 $('gallery-note').textContent=real.length?'Photographs of physical prints. Empty frames are reserved spaces.':'Reserved spaces for photographs of real, physical prints. No print photographs have been added yet.';
}
function setSimple(){stop();$('simplify').setAttribute('aria-pressed',String(simple));document.querySelector('.gallery-stage').hidden=simple;document.querySelector('.walk-controls').hidden=simple;$('flat').hidden=!simple;$('map-toggle').hidden=simple||!$('map-panel').hidden;$('hint').textContent=simple?'Select a photograph or a reserved space to look closer.':walkHint}
const walkHint=$('hint').textContent;
const bindings={w:'forward',s:'back',a:'strafe-left',d:'strafe-right',arrowup:'forward',arrowdown:'back',arrowleft:'left',arrowright:'right'};
window.addEventListener('keydown',e=>{if(simple||$('closer').open||e.target.matches('input,select,textarea')||e.ctrlKey||e.altKey||e.metaKey)return;const action=bindings[e.key.toLowerCase()];if(action){e.preventDefault();engage(action);$('viewport').focus({preventScroll:true})}});
window.addEventListener('keyup',e=>{const action=bindings[e.key.toLowerCase()];if(action)keys.delete(action)});
window.addEventListener('blur',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
function animate(time){const dt=last?(time-last)/1000:0;last=time;if(!simple&&!document.hidden&&!$('closer').open){const held=action=>keys.has(action)||(pulses.get(action)||0)>time;const forward=Number(held('forward'))-Number(held('back')),strafe=Number(held('strafe-right'))-Number(held('strafe-left')),length=Math.max(1,Math.hypot(forward,strafe));const was=p.x+','+p.z+','+p.yaw;advance(p,{forward:forward/length,strafe:strafe/length,turn:Number(held('right'))-Number(held('left'))},dt);if(p.x+','+p.z+','+p.yaw!==was)camera();if(dirty||gl.animating(p)){gl.render(p,time);dirty=false}}frame=requestAnimationFrame(animate)}
document.querySelectorAll('[data-walk]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);engage(b.dataset.walk)};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.walk);b.onlostpointercapture=()=>keys.delete(b.dataset.walk);b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();engage(b.dataset.walk)}};b.onkeyup=()=>keys.delete(b.dataset.walk)});
const viewport=$('viewport');viewport.onpointerdown=e=>{if(e.button!==0)return;drag={id:e.pointerId,start:e.clientX,last:e.clientX,moved:false}};
viewport.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;if(Math.abs(e.clientX-drag.start)>5){drag.moved=true;viewport.setPointerCapture(e.pointerId)}if(drag.moved){p.yaw+=(e.clientX-drag.last)*.18;camera()}drag.last=e.clientX};
window.addEventListener('pointerup',()=>{if(drag?.moved)viewport.focus({preventScroll:true});setTimeout(()=>drag=null,0)});viewport.onpointercancel=()=>drag=null;viewport.addEventListener('click',e=>{if(drag?.moved){e.preventDefault();e.stopImmediatePropagation()}},true);
// A tap or click picks whatever is drawn under it: a print to look at, or a doorway to walk through. Walls block.
viewport.addEventListener('click',e=>{if(e.target.closest('#scene'))return;const hit=gl?.pick(e.clientX,e.clientY);if(hit?.room)jump(hit.room);else if(hit?.print)inspect(prints.find(s=>s.id===hit.print))});
viewport.addEventListener('pointermove',e=>{if(drag||e.pointerType!=='mouse'||!gl)return;viewport.style.cursor=gl.pick(e.clientX,e.clientY)?'pointer':''});
$('reset-view').onclick=()=>jump('corridor');$('wing').onchange=()=>jump($('wing').value);
for(const id of ['nsfw','swearing'])$(id).onchange=()=>{if($('closer').open)$('closer').close();applyFilters()};
// The map docks in the stage's top-right corner: open it is the panel, folded it is a small Map button in the same corner.
function mapToggle(){const hidden=!$('map-panel').hidden;$('map-panel').hidden=hidden;$('map-toggle').hidden=!hidden||simple;$('map-toggle').setAttribute('aria-expanded',String(!hidden));(hidden?$('map-toggle'):$('map-close')).focus({preventScroll:true})}$('map-toggle').onclick=mapToggle;if(matchMedia('(max-width:700px)').matches){$('map-panel').hidden=true;$('map-toggle').hidden=simple;$('map-toggle').setAttribute('aria-expanded','false')}$('map-close').onclick=mapToggle;
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
try{const response=await fetch(ink?'inktober.json':'print-gallery.json',{cache:'no-cache'});if(!response.ok)throw Error();const data=await response.json();prints=world.prepare?world.prepare(data.prints):data.prints;buildWorld();buildMap();applyFilters();setSimple();fit();new ResizeObserver(fit).observe($('viewport'));frame=requestAnimationFrame(animate)}catch(error){$('status').textContent='The print gallery could not load. Reload or return to Studios.';console.error(error)}

// A held finger on a walk button or the view must not start text selection or the copy/share menu.
for(const el of [document.querySelector('.walk-controls'),document.querySelector('.gallery-stage')])el.addEventListener('contextmenu',e=>e.preventDefault());
