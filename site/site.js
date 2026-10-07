import {createReveal,revealProgress,moveReveal} from './exhibit.js';
import {createDrawing,drawProgress} from './plot-animation.js?v=254b2f705023';
import {createWeeding,weedProgress,createPuppet,puppetProgress,createGarland,garlandProgress} from './hero-motion.js?v=f534904a14da';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalogue=[], all=[], expanded=null, selected=null, filter='all', heroId=null, userPaused=false, inView=true, drawing=null, frame=0, lastTime=0;
let mode=new URLSearchParams(location.search).get('gen')==='cutter'?'cutter':'plotter';
const workspace=c=>(c.mode||'plotter');
const activeCollections=()=>catalogue.filter(c=>workspace(c)===mode);
const activeSamples=()=>all.filter(s=>workspace(s.collection)===mode);
const atlasURL=()=>mode==='cutter'?'?gen=cutter#explore':'#explore';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const launch=s=>`site/launch.html?specimen=${encodeURIComponent(s.id)}&gen=${workspace(s.collection)}`;
function specimenById(id){return all.find(s=>s.id===id)}
function openSpecimen(s,updateURL=true){
  if(!s)return;if(workspace(s.collection)!==mode)setMode(workspace(s.collection),false);selected=s;
  $('make-specimen').textContent=mode==='cutter'?'Make this cut ↗':'Make this drawing ↗';
  document.querySelector('.small-note').textContent=mode==='cutter'?'Generated preview. Physical cut sizes are untested; make a small test cut.':'Generated preview. Physical results depend on paper, pen and machine setup.';
  $('specimen-title').textContent=s.title;$('specimen-studio').textContent=s.collection.name+' / '+s.preset;$('specimen-description').textContent=s.collection.description;
  $('specimen-image').src=s.image;$('specimen-image').alt=s.title+' — '+s.collection.name+(mode==='cutter'?' generated cut':' generated plot');
  $('specimen-meta').textContent=[s.page.replace('x',' × ')+' mm',s.seed===null?'':`SEED ${s.seed}`,'SAVED CONTROLS'].filter(Boolean).join(' / ');
  $('make-specimen').href=launch(s);$('download-svg').href=s.svg;$('download-settings').href=`site/art/${s.id}.json`;
  $('settings-list').innerHTML=Object.entries(s.settings).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  $('share-status').textContent='';$('specimen-dialog').querySelector('.settings').open=false;
  if(!$('specimen-dialog').open)$('specimen-dialog').showModal();
  if(updateURL)history.replaceState(null,'',`?gen=${mode}#specimen=${encodeURIComponent(s.id)}`);
}
function closeSpecimen(){ $('specimen-dialog').close(); if(location.hash.startsWith('#specimen='))history.replaceState(null,'',atlasURL()) }
$('close-dialog').onclick=closeSpecimen;
$('specimen-dialog').addEventListener('click',e=>{if(e.target===$('specimen-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeSpecimen()}});
$('specimen-dialog').addEventListener('cancel',e=>{e.preventDefault();closeSpecimen()});
$('share-specimen').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('share-status').textContent='Specimen link copied.'}catch{$('share-status').textContent='Copy this page’s address to share this specimen.'}};
let previewCleanups=[];
// Shelves and poles come from catalogue.mjs via site/taxonomy.json; the view choice is a per-browser convenience.
let taxonomy={shelves:[],poles:[],edges:{}},view='shelves',fieldSelected=null;
try{const v=new URLSearchParams(location.search).get('view')||localStorage.getItem('plg-pile-view');if(['shelves','az','thematic'].includes(v))view=v}catch{}
const shelfOf=c=>taxonomy.shelves.find(s=>s.id===c.shelf);
const label=c=>shelfOf(c)?.name||c.family;
const haystack=c=>`${c.name} ${c.tags} ${c.description} ${shelfOf(c)?.name||''} ${c.samples.map(s=>s.title+' '+s.preset).join(' ')}`.toLowerCase();
// A studio as one row inside an open shelf or the thematic field: name, line, and its sheets in miniature.
const minis=c=>c.samples.length?`<div class="mini-strip">${c.samples.map(s=>`<button class="mini" data-specimen="${esc(s.id)}" aria-label="View ${esc(s.title)} from ${esc(c.name)}"><img src="${s.image}" alt="" loading="lazy" width="760" height="880"><span>${esc(s.title)}</span></button>`).join('')}</div>`:'<p class="member-empty">No saved sheets yet. Open the studio to start one.</p>';
const memberRow=c=>`<div class="shelf-member" data-member="${esc(c.id)}"><div class="member-head"><a class="member-name" href="${esc(c.page)}"><h4>${esc(c.name)}</h4></a><p>${esc(c.subtitle)}</p><a class="studio-open" href="${esc(c.page)}">Open studio ↗</a></div>${minis(c)}</div>`;
const shelfCard=(s,members)=>{const key='shelf:'+s.id,open=expanded===key,id='detail-shelf-'+esc(s.id),sheets=members.reduce((n,c)=>n+c.samples.length,0);return `<article class="world shelf${open?' expanded':''}" data-key="${esc(key)}"><div class="world-heading"><button class="world-toggle" aria-label="Open the ${esc(s.name)} shelf" aria-expanded="${open}" aria-controls="${id}"><div class="world-cover shelf-cover n${Math.min(members.length,4)}">${members.slice(0,4).map(c=>c.samples[0]?`<img src="${c.samples[0].image}" alt="" loading="lazy" width="760" height="880">`:'<i></i>').join('')}<span class="world-number">SHELF / ${members.length} ${members.length===1?'STUDIO':'STUDIOS'}</span><span class="world-count">${sheets} sheets ↗</span></div></button><div class="world-label"><div><button class="world-name" aria-expanded="${open}" aria-controls="${id}"><h3>${esc(s.name)}</h3></button><p>${esc(s.blurb)}</p><p class="shelf-roll">${members.map(c=>esc(c.name)).join(' · ')}</p></div><span class="plus" aria-hidden="true">${open?'−':'+'}</span></div></div><div class="world-detail shelf-detail" id="${id}" ${open?'':'hidden'}>${members.map(memberRow).join('')}</div></article>`};
// One card for both shelves: the seasonal shelf and the pile.
const card=c=>{let s=c.samples[0];return `<article class="world${expanded===c.id?' expanded':''}" data-id="${esc(c.id)}" data-key="${esc(c.id)}"><div class="world-heading"><button class="world-toggle" aria-label="Explore ${esc(c.name)}" aria-expanded="${expanded===c.id}" aria-controls="detail-${esc(c.id)}"><div class="world-cover">${s?`<img src="${s.image}" alt="${esc(s.title)} generated by ${esc(c.name)}" loading="lazy" width="760" height="880"><img class="cover-next" alt="" aria-hidden="true" width="760" height="880">`:''}<span class="world-number">${String(activeCollections().indexOf(c)+1).padStart(2,'0')} / ${esc(label(c)).toUpperCase()}</span><span class="world-count">${c.samples.length} saved sheets ↗</span></div></button><div class="world-label"><div><button class="world-name" aria-expanded="${expanded===c.id}" aria-controls="detail-${esc(c.id)}"><h3>${esc(c.name)}</h3></button><p>${esc(c.subtitle)}</p></div><a class="studio-open" href="${esc(c.page)}">Open studio ↗</a>${c.presets?`<span class="preset-tag">${c.presets} presets</span>`:''}<span class="plus" aria-hidden="true">${expanded===c.id?'−':'+'}</span></div></div><div class="world-detail" id="detail-${esc(c.id)}" ${expanded===c.id?'':'hidden'}><div class="world-intro"><p>${esc(c.description)}</p></div><div class="sample-grid">${c.samples.map(s=>`<button class="sample" data-specimen="${esc(s.id)}" aria-label="View ${esc(s.title)} and its settings"><img src="${s.image}" alt="${esc(s.title)}" loading="lazy" width="760" height="880"><span class="sample-name">${esc(s.title)} ↗</span><span class="sample-method">${esc(s.preset||'default').toUpperCase()}${s.seed===null?'':` / SEED ${s.seed}`}</span></button>`).join('')}</div><details class="world-lesson"><summary>How it works</summary><p>${esc(c.lesson)}</p></details></div></article>`};
function render(){
 previewCleanups.forEach(f=>f());previewCleanups=[];
 const tokens=$('search').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const matches=c=>(filter==='all'||c.shelf===filter)&&tokens.every(t=>haystack(c).includes(t));
 // A seasonal studio with a shelf also sits in that shelf's drawer and under its filter, so Inktober 2026 holds every Inktober
 // studio even while one is on the seasonal shelf; searches and A-Z still list it once, in the seasonal section.
 const doubled=c=>c.season&&c.shelf&&((view==='shelves'&&filter==='all'&&!tokens.length)||filter===c.shelf);
 let visible=activeCollections().filter(c=>(!c.season||doubled(c))&&matches(c));
 if(view==='az')visible.sort((a,b)=>a.name.localeCompare(b.name));
 // Shelves fold together only while browsing everything; a search, a filter or A-Z lists studios one by one.
 const grouped=view==='shelves'&&filter==='all'&&!tokens.length,thematic=view==='thematic';
 const entries=grouped?[...taxonomy.shelves.map(s=>({s,members:visible.filter(c=>c.shelf===s.id)})).filter(e=>e.members.length).map(e=>({key:'shelf:'+e.s.id,html:()=>shelfCard(e.s,e.members)})),...visible.filter(c=>!shelfOf(c)).map(c=>({key:c.id,html:()=>card(c)}))]:visible.map(c=>({key:c.id,html:()=>card(c)}));
 const seasonal=activeCollections().filter(c=>c.season);
 if(!entries.some(e=>e.key===expanded)&&!seasonal.some(c=>c.id===expanded))expanded=null;
 const sheets=visible.reduce((n,c)=>n+c.samples.length,0),shelfCount=entries.filter(e=>e.key.startsWith('shelf:')).length;
 const placed=activeCollections().filter(c=>c.axes),lit=placed.filter(matches).length;
 $('result-count').textContent=thematic?(tokens.length||filter!=='all'?`${lit} OF ${placed.length} STUDIOS LIT`:`${placed.length} ${placed.length===1?'STUDIO':'STUDIOS'} / FOUR POLES`):grouped?`${visible.length} STUDIOS / ${shelfCount} SHELVES / ${sheets} SHEETS`:`${visible.length} ${visible.length===1?'STUDIO':'STUDIOS'} / ${sheets} SHEETS`;
 const inSeason=thematic?0:activeCollections().filter(c=>c.season&&tokens.length&&tokens.every(t=>haystack(c).includes(t))).length;
 if(inSeason)$('result-count').textContent+=` + ${inSeason} IN SEASONAL ABOVE`;
 $('empty').hidden=thematic?!!lit:!!visible.length||!!inSeason;
 $('atlas').hidden=thematic;$('field').hidden=!thematic;
 $('atlas').innerHTML=thematic?'':entries.map(e=>e.html()).join('');
 if(thematic)renderField(matches);
 $('seasonal-atlas').innerHTML=seasonal.map(card).join('');
 $('seasonal').hidden=!seasonal.length;document.querySelector('.rail a[href="#seasonal"]').hidden=!seasonal.length;
 if(seasonal.length)$('seasonal-title').textContent=seasonal[0].season+'.';
 for(const world of [...$('seasonal-atlas').children,...$('atlas').children])world.querySelectorAll('.world-toggle,.world-name').forEach(b=>b.onclick=()=>expand(world.dataset.key,true));
 hookSpecimens($('seasonal-atlas'));hookSpecimens($('atlas'));
 for(const world of [...$('seasonal-atlas').children,...$('atlas').children].filter(w=>w.dataset.id)){
  const c=activeCollections().find(c=>c.id===world.dataset.id),base=world.querySelector('.world-cover img'),next=world.querySelector('.cover-next');let timer=0,index=0,active=false;
  const stop=()=>{active=false;clearTimeout(timer);next?.classList.remove('visible')};
  const cycle=()=>{if(!active||reduced.matches||document.hidden)return;index=(index+1)%c.samples.length;next.onload=()=>{if(!active)return;next.classList.add('visible');timer=setTimeout(()=>{if(!active)return;base.src=next.src;base.alt=c.samples[index].title;next.classList.remove('visible');timer=setTimeout(cycle,1600)},2200)};next.src=c.samples[index].image};
  const begin=()=>{if(active||c.samples.length<2||reduced.matches)return;active=true;timer=setTimeout(cycle,750)};
  world.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')begin()});world.addEventListener('pointerleave',stop);
  world.addEventListener('focusin',begin);world.addEventListener('focusout',e=>{if(!world.contains(e.relatedTarget))stop()});previewCleanups.push(stop);
 }
}
function hookSpecimens(root){root.querySelectorAll('[data-specimen]').forEach(b=>b.onclick=()=>openSpecimen(specimenById(b.dataset.specimen)))}
// The thematic field: four poles on a diamond. Each studio sits at the weighted average of the poles it pulls toward,
// so one pole is a corner, two are an edge and more drift inward. Nodes are nudged apart to stay readable;
// a hairline runs back to the true spot. The ring round each sheet shows the mix.
const poleColour={material:'var(--accent)',machine:'var(--ink)',signal:'var(--pole-signal)',system:'var(--yellow)'};
let fieldMatches=()=>true,fieldWidth=0;
function mixOf(c){const total=Object.values(c.axes).reduce((a,b)=>a+b,0)||1;return taxonomy.poles.filter(p=>c.axes[p.id]).map(p=>({...p,share:c.axes[p.id]/total}))}
function ring(c){let at=0;return 'conic-gradient('+mixOf(c).map(m=>{const from=at;at+=m.share*360;return `${poleColour[m.id]||'var(--grid)'} ${from}deg ${at}deg`}).join(',')+')'}
function renderField(matches){
 fieldMatches=matches;const plane=$('field-plane'),placed=activeCollections().filter(c=>c.axes);
 const W=plane.clientWidth||900,narrow=W<620,H=narrow?Math.round(W*1.2):Math.round(Math.min(780,Math.max(560,W*.72)));
 plane.style.height=H+'px';fieldWidth=W;
 const pad=narrow?{x:34,y:58}:{x:178,y:84},cx=W/2,cy=H/2,rx=W/2-pad.x,ry=H/2-pad.y;
 const P={material:[cx,cy-ry],machine:[cx-rx,cy],signal:[cx,cy+ry],system:[cx+rx,cy]};
 const box=narrow?{w:44,h:44}:{w:104,h:84},disc=narrow?36:54;
 const nodes=placed.map(c=>{const mix=mixOf(c);let x=0,y=0;for(const m of mix){x+=m.share*P[m.id][0];y+=m.share*P[m.id][1]}return {c,tx:x,ty:y,x,y,top:mix.slice().sort((a,b)=>b.share-a.share)[0]?.id}});
 // Deterministic relaxation: push overlapping boxes apart, spring each back toward its true spot.
 for(let k=0;k<500;k++){
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j];let dx=b.x-a.x,dy=b.y-a.y;const ox=box.w-Math.abs(dx),oy=box.h-Math.abs(dy);if(ox<=0||oy<=0)continue;if(!dx&&!dy){dx=(j%2?1:-1);dy=(i%2?1:-1)}if(ox/box.w<oy/box.h){const s=Math.sign(dx)*ox/2;a.x-=s;b.x+=s}else{const s=Math.sign(dy)*oy/2;a.y-=s;b.y+=s}}
  for(const n of nodes){n.x+=(n.tx-n.x)*.02;n.y+=(n.ty-n.y)*.02;n.x=Math.max(box.w/2,Math.min(W-box.w/2,n.x));n.y=Math.max(pad.y,Math.min(H-box.h+disc/2,n.y))}
 }
 const corner=[[P.material,P.machine,'material|machine'],[P.machine,P.signal,'machine|signal'],[P.signal,P.system,'signal|system'],[P.system,P.material,'system|material']];
 const edgeText=corner.map(([a,b,k])=>{const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,ang=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI,up=ang>90||ang<-90?ang+180:ang,ox=mx-cx,oy=my-cy,len=Math.hypot(ox,oy)||1,off=narrow?12:30;return taxonomy.edges[k]?`<text x="${mx+ox/len*off}" y="${my+oy/len*off}" transform="rotate(${up} ${mx+ox/len*off} ${my+oy/len*off})" text-anchor="middle" dominant-baseline="middle">${esc(taxonomy.edges[k]).toUpperCase()}</text>`:''}).join('');
 const leaders=nodes.filter(n=>Math.hypot(n.x-n.tx,n.y-n.ty)>6).map(n=>`<line class="${fieldMatches(n.c)?'':'dim'}" x1="${n.tx}" y1="${n.ty}" x2="${n.x}" y2="${n.y}"/>`).join('');
 const dots=nodes.map(n=>`<circle class="${fieldMatches(n.c)?'':'dim'}" cx="${n.tx}" cy="${n.ty}" r="2.4"/>`).join('');
 const poleLabel=p=>{const [x,y]=P[p.id],side=p.id==='machine'?'left':p.id==='system'?'right':p.id==='material'?'top':'bottom';return `<div class="pole pole-${esc(p.id)} pole-${side}" style="left:${x}px;top:${y}px"><b>${esc(p.name).toUpperCase()}</b>${narrow?'':`<span>${esc(p.note)}</span>`}</div>`};
 plane.classList.toggle('narrow',narrow);
 plane.innerHTML=`<svg class="field-lines" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><path class="diamond" d="M${P.material} L${P.system} L${P.signal} L${P.machine} Z"/><line class="axis" x1="${P.material[0]}" y1="${P.material[1]}" x2="${P.signal[0]}" y2="${P.signal[1]}"/><line class="axis" x1="${P.machine[0]}" y1="${P.machine[1]}" x2="${P.system[0]}" y2="${P.system[1]}"/><circle class="boundary" cx="${cx}" cy="${cy}" r="${narrow?26:44}"/><text class="boundary-text" x="${cx}" y="${cy+(narrow?36:56)}" text-anchor="middle">THE BOUNDARY</text><g class="edge-words">${edgeText}</g><g class="leaders">${leaders}</g><g class="dots">${dots}</g></svg>${taxonomy.poles.map(poleLabel).join('')}${nodes.map(n=>`<button class="node${fieldMatches(n.c)?'':' dim'}${fieldSelected===n.c.id?' selected':''}" data-node="${esc(n.c.id)}" style="left:${n.x}px;top:${n.y-disc/2}px;width:${box.w}px;--disc:${disc}px" aria-pressed="${fieldSelected===n.c.id}" aria-label="${esc(n.c.name)}: ${mixOf(n.c).map(m=>Math.round(m.share*100)+'% '+m.name.toLowerCase()).join(', ')}"><span class="node-disc" style="background:${ring(n.c)}">${n.c.samples[0]?`<img src="${n.c.samples[0].image}" alt="" loading="lazy" width="760" height="880">`:''}</span><span class="node-name">${esc(n.c.name)}</span></button>`).join('')}`;
 plane.querySelectorAll('[data-node]').forEach(b=>b.onclick=()=>{fieldSelected=fieldSelected===b.dataset.node?null:b.dataset.node;plane.querySelectorAll('[data-node]').forEach(x=>{x.classList.toggle('selected',x.dataset.node===fieldSelected);x.setAttribute('aria-pressed',String(x.dataset.node===fieldSelected))});renderFieldDetail();if(fieldSelected&&narrow)$('field-detail').scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'nearest'})});
 renderFieldDetail();
}
function renderFieldDetail(){
 const c=activeCollections().find(c=>c.id===fieldSelected&&c.axes);
 $('field-detail').innerHTML=c?`<div class="mix" aria-label="Where ${esc(c.name)} sits">${mixOf(c).map(m=>`<span class="mix-part mix-${esc(m.id)}" style="flex:${m.share}">${esc(m.name).toUpperCase()} ${Math.round(m.share*100)}%</span>`).join('')}</div>${memberRow(c)}`
  :`<p class="field-legend"><b>How to read it.</b> Each studio sits where its pulls balance. A corner belongs to one pole, an edge mixes two, and toward the middle everything blurs together. The ring round each sheet shows the mix. Pick one to see what it makes.</p><dl class="pole-key">${taxonomy.poles.map(p=>`<div><dt class="pole-${esc(p.id)}">${esc(p.name)}</dt><dd>${esc(p.note)}</dd></div>`).join('')}</dl>`;
 hookSpecimens($('field-detail'));
}
// Lay the field out again whenever its width changes (window resize, rail pinning, rotation).
{const relayout=()=>{const w=$('field-plane').clientWidth;if(w&&w!==fieldWidth&&view==='thematic'&&!$('field').hidden)renderField(fieldMatches)};new ResizeObserver(relayout).observe($('field-plane'));addEventListener('resize',relayout)}
function setView(next){view=next;try{localStorage.setItem('plg-pile-view',next)}catch{}document.querySelectorAll('#views [data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));render()}
$('views').onclick=e=>{const b=e.target.closest('[data-view]');if(b)setView(b.dataset.view)};
function setMode(next,updateURL=true){
 mode=next;filter='all';expanded=null;fieldSelected=null;recent=[];nextPlot=null;$('search').value='';
 document.body.dataset.mode=mode;
 const cutting=mode==='cutter',name=cutting?'CUTTER GEN':'PLOTTER GEN';
 wholeSheet=cutting;$('fit').textContent=wholeSheet?'Back to detail ↗':'Show whole sheet ↗';$('fit').setAttribute('aria-pressed',String(wholeSheet));
 $('hero-art').setAttribute('aria-label',cutting?'Animated lino weeding preview':'Animated real generator output');
 document.querySelectorAll('#generator-tabs button[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
 document.querySelectorAll('.wordmark').forEach(a=>{a.innerHTML=(cutting?'C/G':'P/G')+'<span class="wordmark-full"> — '+name+'</span>';a.setAttribute('aria-label',name+' home')});
 $('hero-title').innerHTML=name.replace(' ','_')+' / <span>'+(cutting?'on the cutting mat':'on the bed')+'</span>';
 document.querySelector('.hero-minimized p').textContent=name;
 $('restore').textContent=cutting?'Unfold the cut +':'Unfold the drawing +';
 document.querySelector('.transport').hidden=false;
 $('replay').setAttribute('aria-label',cutting?'Replay weeding':'Replay drawing');document.querySelector('label[for="transport"]').textContent=cutting?'Weeding progress':'Drawing and assembly progress';
 $('learn-title').textContent=cutting?'Before you feed the cutter.':'Before you feed the plotter.';
 $('learn-title').closest('.section-heading').querySelector('p').textContent=cutting?'Vinyl, blades, and things worth checking.':'Paper, pens, and things worth checking.';
 $('plotter-notes').hidden=cutting;$('cutter-notes').hidden=!cutting;
 document.querySelector('footer p').textContent=cutting?'Cricut Explore 5 / SVG / vinyl cutting.':'Cricut Explore 5 / SVG / pen plotting.';
 document.querySelector('nav a[href="plot-decoder.html"]').hidden=cutting;
 $('search').placeholder=cutting?'Try ‘raven’, ‘bat’, ‘vinyl’…':'Try ‘woven’, ‘flags’, ‘maze’…';
 const shelfChips=taxonomy.shelves.filter(s=>activeCollections().some(c=>c.shelf===s.id)),themeButton=document.querySelector('#views [data-view="thematic"]');
 $('filters').innerHTML=[['all','Everything'],...shelfChips.map(s=>[s.id,s.name])].map(([f,n])=>'<button data-filter="'+esc(f)+'" aria-pressed="'+(f==='all')+'">'+esc(n)+'</button>').join('');
 $('filters').hidden=!shelfChips.length;
 themeButton.hidden=!taxonomy.poles.length||!activeCollections().some(c=>c.axes);if(view==='thematic'&&themeButton.hidden)view='shelves';
 document.querySelectorAll('#views [data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
 $('studio-links').innerHTML=activeCollections().map(c=>'<a class="studio-link" href="'+esc(c.page)+'">'+esc(c.name)+'<span>'+esc(label(c))+' ↗</span></a>').join('');
 document.title=name+' — '+(cutting?'blade, vinyl, machinery':'pen, paper, machinery');
 if(updateURL)history.pushState(null,'',cutting?'?gen=cutter#explore':'?gen=plotter#explore');
 render();
 const pool=activeSamples(),initial=pool.find(s=>s.id===new URLSearchParams(location.search).get('sheet'))||pool.find(s=>s.id===window.__plgHero)||pool[0];if(initial)showHero(initial);
}
$('generator-tabs').onclick=e=>{const b=e.target.closest('button[data-mode]');if(b)setMode(b.dataset.mode)};
function expand(id,focus){
 const old=document.querySelector('.world.expanded');
 if(old){old.classList.remove('expanded');old.querySelectorAll('.world-toggle,.world-name').forEach(b=>b.setAttribute('aria-expanded','false'));old.querySelector('.world-detail').hidden=true;old.querySelector('.plus').textContent='+'}
 if(expanded===id){expanded=null;return}
 expanded=id;const world=[...document.querySelectorAll('.world')].find(w=>w.dataset.key===id);if(!world)return;
 world.classList.add('expanded');world.querySelectorAll('.world-toggle,.world-name').forEach(b=>b.setAttribute('aria-expanded','true'));world.querySelector('.world-detail').hidden=false;world.querySelector('.plus').textContent='−';
 if(focus)world.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});
}
$('filters').onclick=e=>{const b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render()};
$('search').addEventListener('input',render);
$('reset').onclick=()=>{filter='all';$('search').value='';document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter==='all')));render()};
function surprise(){const pool=activeSamples();if(pool.length)openSpecimen(pool[Math.floor(Math.random()*pool.length)])}
$('surprise-nav').onclick=surprise;$('surprise-bottom').onclick=surprise;
function stopFrame(){cancelAnimationFrame(frame);frame=0;lastTime=0}
function syncAnimation(){stopFrame();if(drawing&&(drawing.loop||!drawing.complete)&&!userPaused&&inView&&!document.hidden&&!reduced.matches){lastTime=performance.now();frame=requestAnimationFrame(animate)}}
function setProgress(progress,elapsed){
 if(!drawing)return;progress=Math.max(0,Math.min(1,progress));const duration=drawing.duration||12000;
 drawing.elapsed=elapsed??progress*duration;
 if(drawing.kind==='weed')weedProgress(drawing,progress);
 else if(drawing.kind==='reveal')revealProgress(drawing,progress,drawing.elapsed,drawProgress);
 else if(drawing.kind==='puppet')puppetProgress(drawing,progress,drawing.elapsed,drawProgress);
 else if(drawing.kind==='garland')garlandProgress(drawing,progress,drawing.elapsed,drawProgress);
 else drawProgress(drawing,progress);
 $('transport').value=String(progress*100);$('progress').textContent=Math.round(progress*100)+'%';
}
function animate(t){if(!drawing)return;const elapsed=drawing.elapsed+(lastTime?Math.min(t-lastTime,60):0);lastTime=t;setProgress(elapsed/(drawing.duration||12000),elapsed);if(drawing.loop||!drawing.complete)frame=requestAnimationFrame(animate);else frame=0}
let heroRequest=0,wholeSheet=false,recent=[],nextPlot=null;
const plotCache=new Map();
function loadPlot(url){if(!plotCache.has(url))plotCache.set(url,fetch(url,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Preview unavailable');return r.text()}).catch(error=>{plotCache.delete(url);throw error}));return plotCache.get(url)}
// Start the first SVG request alongside the catalogue; cache upcoming sheets.
if(window.__plgHero)loadPlot(`site/art/${window.__plgHero}.svg`).catch(()=>{});
function warmNextPlots(){const candidates=activeSamples().filter(s=>s.id!==heroId);nextPlot=candidates[Math.floor(Math.random()*candidates.length)];if(nextPlot)loadPlot(nextPlot.svg).catch(()=>{});$('scrap-rack').querySelectorAll('[data-sheet]').forEach(b=>{const s=specimenById(b.dataset.sheet);if(s)loadPlot(s.svg).catch(()=>{})})}

function renderScraps(){const ids=[...new Set([...recent,...activeSamples().map(s=>s.id)])].filter(id=>id!==heroId&&activeSamples().some(s=>s.id===id)).slice(0,3);$('scrap-rack').innerHTML=ids.map(id=>{const s=specimenById(id);return s?`<button data-sheet="${esc(id)}" aria-label="Put ${esc(s.title)} on the ${mode==='cutter'?'cutting mat':'drawing bed'}"><img src="${s.image}" alt="" width="100" height="100"></button>`:''}).join('');$('scrap-rack').querySelectorAll('button').forEach(b=>b.onclick=()=>showHero(specimenById(b.dataset.sheet)))}
async function showHero(s){
 if(s.motion||s.reveal||s.garland){wholeSheet=true;$('fit').textContent='Back to detail ↗';$('fit').setAttribute('aria-pressed','true')}
 $('hero-reveal-controls').hidden=true;$('hero-reveal').value='0';
 const request=++heroRequest;if(heroId)recent=[heroId,...recent].slice(0,6);heroId=s.id;stopFrame();drawing=null;userPaused=false;updatePause();renderScraps();$('hero-name').textContent=s.title;$('hero-family').textContent=s.collection.name.toUpperCase();$('hero-meta').textContent=`${s.page.replace('x',' × ')} mm${s.seed===null?'':` / seed ${s.seed}`} / ${wholeSheet?'whole sheet':'cropped detail'}`;$('hero-make').href=launch(s);$('hero-make').setAttribute('aria-label',`Open ${s.title} in the studio`);$('hero-art').replaceChildren();$('transport').value='0';$('progress').textContent='0%';
 try{const [text,motion,weeding,reveal,garland]=await Promise.all([loadPlot(s.svg),s.motion?loadPlot(s.motion).then(JSON.parse):null,s.weeding?loadPlot(s.weeding).then(JSON.parse):null,s.reveal?loadPlot(s.reveal).then(JSON.parse):null,s.garland?loadPlot(s.garland).then(JSON.parse):null]);if(request!==heroRequest)return;
 const doc=new DOMParser().parseFromString(text,'image/svg+xml');const svg=doc.documentElement;if(svg.tagName!=='svg')throw Error('Invalid drawing');svg.querySelectorAll('script,foreignObject').forEach(n=>n.remove());
 svg.removeAttribute('width');svg.removeAttribute('height');svg.setAttribute('aria-hidden','true');svg.setAttribute('preserveAspectRatio',wholeSheet?'xMidYMid meet':'xMidYMid slice');$('hero-art').replaceChildren(document.importNode(svg,true));const mounted=$('hero-art').firstElementChild;
 drawing=mode==='cutter'?createWeeding(mounted,weeding):createDrawing(mounted);
 if(motion){mounted.setAttribute('preserveAspectRatio','xMidYMid meet');drawing=createPuppet(mounted,motion,drawing);}
 if(garland){mounted.setAttribute('preserveAspectRatio','xMidYMid meet');drawing=createGarland(mounted,garland,drawing);}
 if(reveal){drawing=createReveal(mounted,reveal,drawing);$('hero-reveal-controls').hidden=false;}
 setProgress(reduced.matches?1:0);syncAnimation();
 warmNextPlots();
 }catch{if(request===heroRequest){$('progress').textContent='—';$('hero-art').textContent='Drawing unavailable. Try another sheet.'}}
}
$('hero-reveal').oninput=()=>{if(drawing?.kind==='reveal'){userPaused=true;updatePause();stopFrame();drawProgress(drawing.plot,1);drawing.plot.marker.style.display='none';moveReveal(drawing,Number($('hero-reveal').value)/100)}};
function updatePause(){$('pause').setAttribute('aria-pressed',String(userPaused));$('pause').textContent=userPaused?'Resume ▷':'Pause Ⅱ'}
$('shuffle').onclick=()=>{const candidates=activeSamples().filter(s=>s.id!==heroId);if(candidates.length)showHero(nextPlot?.id!==heroId&&nextPlot?nextPlot:candidates[Math.floor(Math.random()*candidates.length)])};
$('pause').onclick=()=>{userPaused=!userPaused;updatePause();syncAnimation()};
$('replay').onclick=()=>{setProgress(reduced.matches?1:0);userPaused=false;updatePause();syncAnimation()};
$('transport').addEventListener('input',()=>{userPaused=true;updatePause();stopFrame();setProgress(Number($('transport').value)/100)});
$('fit').onclick=()=>{wholeSheet=!wholeSheet;$('fit').textContent=wholeSheet?'Back to detail ↗':'Show whole sheet ↗';$('fit').setAttribute('aria-pressed',String(wholeSheet));$('hero-art').querySelector('svg')?.setAttribute('preserveAspectRatio',wholeSheet?'xMidYMid meet':'xMidYMid slice');$('hero-meta').textContent=$('hero-meta').textContent.replace(/whole sheet|cropped detail/,wholeSheet?'whole sheet':'cropped detail')};
const hero=document.querySelector('.hero');
new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;document.body.classList.toggle('scrolled',!inView);syncAnimation()},{threshold:0}).observe(hero);
document.addEventListener('visibilitychange',syncAnimation);
$('minimize').onclick=()=>{hero.hidden=true;document.querySelector('.hero-minimized').hidden=false;inView=false;syncAnimation();$('restore').focus()};
$('restore').onclick=()=>{hero.hidden=false;document.querySelector('.hero-minimized').hidden=true;inView=true;syncAnimation();$('minimize').focus()};
reduced.addEventListener('change',()=>{if(reduced.matches)setProgress(1);syncAnimation()});

try{const [response,tax]=await Promise.all([fetch('site/catalogue.json',{cache:'no-cache'}),fetch('site/taxonomy.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null)]);if(!response.ok)throw Error('Catalogue unavailable');catalogue=await response.json();if(tax)taxonomy={shelves:tax.shelves||[],poles:tax.poles||[],edges:tax.edges||{}};all=catalogue.flatMap(c=>c.samples.map(s=>({...s,collection:c})));setMode(mode,false);
 const requested=location.hash.match(/^#specimen=(.+)$/);if(requested)openSpecimen(specimenById(decodeURIComponent(requested[1])),false);
 window.addEventListener('popstate',()=>{const next=new URLSearchParams(location.search).get('gen')==='cutter'?'cutter':'plotter';if(next!==mode)setMode(next,false)});
 window.addEventListener('hashchange',()=>{const m=location.hash.match(/^#specimen=(.+)$/);if(m)openSpecimen(specimenById(decodeURIComponent(m[1])),false)});
}catch(error){$('result-count').textContent='The drawings could not load.';$('atlas').innerHTML='<p class="error">Please reload, or <a href="cipher-garden-studio.html">open Cipher Garden directly</a>.</p>';console.error(error)}

// The section rail: pinned on the left once the page scrolls past it, lighting the section in view.
{const links=[...document.querySelectorAll('.rail a')];
 // The lit link is the last visible section whose heading has reached the pinned bars at the top of the window.
 const light=()=>{const live=links.filter(a=>!a.hidden),line=Math.min(innerHeight*.45,220);let on=live[0];for(const a of live){const t=document.getElementById(a.getAttribute('href').slice(1));if(t&&!t.hidden&&t.getBoundingClientRect().top<=line)on=a}links.forEach(a=>a.toggleAttribute('aria-current',a===on&&scrollY>0))};
 addEventListener('scroll',light,{passive:true});addEventListener('resize',light);light()}
