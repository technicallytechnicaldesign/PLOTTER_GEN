import * as THREE from './three.module.min.js';

const loaded=new Map();
export function loadWheel(url){
  if(!loaded.has(url))loaded.set(url,fetch(url,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('The tolerance wheel could not load.');return r.json();}).catch(e=>{loaded.delete(url);throw e;}));
  return loaded.get(url);
}
export const wrapTurn=(turn,count)=>((turn%count)+count)%count;
export function cycleTurn(milliseconds){
  const t=Math.max(0,milliseconds)/3000,n=Math.floor(t),u=Math.min(1,Math.max(0,(t-n-.7)/.3));
  return n+u*u*(3-2*u);
}
export const callout=e=>e.t.split('|').join(' | ')+(e.s?' / '+e.s:'');

export function createWheel(data){
  const group=new THREE.Group(),textures=[],geometries=[],materials=[];
  const material=options=>{const m=new THREE.MeshBasicMaterial(options);materials.push(m);return m;};
  const makeMesh=(geometry,m,parent=group)=>{geometries.push(geometry);const mesh=new THREE.Mesh(geometry,m);parent.add(mesh);return mesh;};
  const side=material({color:'#b7aa94'});
  function piece(part,paper,pivot,z,parent=group){
    const [ox,oy]=pivot;
    const points=part.outline.map(([x,y])=>new THREE.Vector2(x-ox,oy-y));
    const shape=new THREE.Shape(points);
    for(const hole of part.holes)shape.holes.push(new THREE.Path(hole.map(([x,y])=>new THREE.Vector2(x-ox,oy-y))));
    const xs=part.outline.map(q=>q[0]),ys=part.outline.map(q=>q[1]);
    const x0=Math.min(...xs),y0=Math.min(...ys),w=Math.max(...xs)-x0,h=Math.max(...ys)-y0;
    const canvas=document.createElement('canvas'),res=Math.min(12,1536/Math.max(w,h));
    canvas.width=Math.ceil(w*res);canvas.height=Math.ceil(h*res);
    const c=canvas.getContext('2d');c.scale(canvas.width/w,canvas.height/h);c.translate(-x0,-y0);c.fillStyle=paper;c.fillRect(x0,y0,w,h);c.lineCap=c.lineJoin='round';
    for(const [pen,colour,width] of [['fine','#302b25',.28],['red','#b6332a',.35],['bold','#211e19',.45]]){
      c.strokeStyle=colour;c.lineWidth=width;c.beginPath();
      for(const [q,closed] of part.ink[pen]){q.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(closed)c.closePath();}
      c.stroke();
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;textures.push(texture);
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.45,bevelEnabled:false,curveSegments:1});
    const pos=geometry.attributes.position,uv=geometry.attributes.uv;
    for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)+ox-x0)/w,1-(oy-pos.getY(i)-y0)/h);
    uv.needsUpdate=true;
    const mesh=makeMesh(geometry,[material({map:texture}),side],parent);mesh.position.z=z;
    return mesh;
  }
  const pivot=[data.width/2,data.height+2];
  const back=piece(data.back,data.paper.back,pivot,-.8);
  const disk=new THREE.Group();disk.position.set(data.hub[0]-pivot[0],pivot[1]-data.hub[1],0);group.add(disk);
  piece(data.disc,data.paper.disc,data.hub,-.1,disk);
  const front=piece(data.front,data.paper.front,pivot,.65);
  const hub=new THREE.Vector3(disk.position.x,disk.position.y,1.9);
  const cap=makeMesh(new THREE.SphereGeometry(4.1,24,12),material({color:data.brad}));cap.position.copy(hub);cap.scale.z=.32;
  const rim=makeMesh(new THREE.CylinderGeometry(4.1,4.3,.4,24),material({color:'#8aafc7'}));rim.rotation.x=Math.PI/2;rim.position.copy(hub).z-=.5;
  const foot=makeMesh(new THREE.BoxGeometry(data.width*.8,1.6,25),material({color:'#d7cdbb'}));foot.position.set(0,.8,-8);
  const rest=makeMesh(new THREE.BoxGeometry(data.width*.65,9,1.3),material({color:'#c7baa2'}));rest.position.set(0,5,-1.8);
  let turn=data.initial||0;
  function setTurn(value){turn=value;disk.rotation.z=turn*data.step;group.userData.turn=wrapTurn(turn,data.entries.length);group.userData.index=Math.round(wrapTurn(turn,data.entries.length))%data.entries.length;}
  setTurn(turn);
  return {group,disk,front,back,hub,setTurn,get turn(){return turn;},dispose(){for(const t of textures)t.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
}

export function mountWheel(host,data,{turn=data.initial||0,onTurn=()=>{}}={}){
  const root=document.createElement('div');root.className='tolerance-exhibit';
  root.innerHTML='<div class="tolerance-stage" tabindex="0" role="img" aria-label="Tolerance card with a rotating disc. Drag to turn; left and right arrows choose a tolerance."></div><div class="tolerance-controls"><button type="button" data-action="previous" aria-label="Previous tolerance">← Previous</button><button type="button" data-action="play" aria-pressed="false">Spin</button><button type="button" data-action="next" aria-label="Next tolerance">Next →</button></div><label class="tolerance-position">Tolerance <input aria-label="Choose tolerance" type="range" min="0" max="'+(data.entries.length-1)+'" step="1" value="0"></label><output class="tolerance-readout" aria-live="polite" aria-atomic="true"></output><p class="tolerance-hint">Drag the wheel, use the arrow keys, or spin through every tolerance.</p>';
  host.replaceChildren(root);
  const stage=root.querySelector('.tolerance-stage'),slider=root.querySelector('input'),readout=root.querySelector('output'),play=root.querySelector('[data-action="play"]');
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.domElement.setAttribute('aria-hidden','true');stage.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,1000),wheel=createWheel(data);scene.add(wheel.group);
  let current=turn,target=turn,tween=null,playing=false,playStart=0,playBase=turn,drag=null,frame=0,disposed=false,lastIndex=-1;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const now=()=>performance.now();
  function update(value){current=value;wheel.setTurn(value);onTurn(value);const index=wheel.group.userData.index;stage.dataset.turn=String(wrapTurn(value,data.entries.length));stage.dataset.index=String(index);if(index!==lastIndex){lastIndex=index;slider.value=String(index);readout.textContent=(index+1)+' / '+data.entries.length+' · '+callout(data.entries[index]);}renderer.render(scene,camera);}
  function fit(){const w=stage.clientWidth||400,h=stage.clientHeight||420;renderer.setSize(w,h,false);camera.aspect=w/h;const cy=data.height/2+2;camera.position.set(0,cy,Math.max((data.height+9)/2,(data.width+10)/(2*camera.aspect))/Math.tan(16*Math.PI/180)*1.06);camera.lookAt(0,cy,0);camera.updateProjectionMatrix();renderer.render(scene,camera);}
  function pause(){playing=false;play.setAttribute('aria-pressed','false');play.textContent='Spin';}
  function choose(value){pause();target=value;if(reduced.matches){tween=null;update(value);}else tween={from:current,to:value,start:now()};}
  function step(by){choose(Math.round(current)+by);}
  root.querySelector('[data-action="previous"]').onclick=()=>step(-1);
  root.querySelector('[data-action="next"]').onclick=()=>step(1);
  slider.oninput=()=>{const normalized=wrapTurn(Math.round(current),data.entries.length);choose(Math.round(current)+Number(slider.value)-normalized);};
  play.onclick=()=>{if(playing){pause();choose(Math.round(current));}else{playing=true;tween=null;playBase=current;playStart=now();play.setAttribute('aria-pressed','true');play.textContent='Pause';}};
  function screenAngle(e){const p=wheel.hub.clone().project(camera),r=stage.getBoundingClientRect();return Math.atan2(r.top+(1-p.y)*r.height/2-e.clientY,e.clientX-(r.left+(p.x+1)*r.width/2));}
  stage.onpointerdown=e=>{if(e.button!==0)return;pause();tween=null;stage.focus({preventScroll:true});drag={id:e.pointerId,angle:screenAngle(e)};stage.setPointerCapture(e.pointerId);};
  stage.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;const a=screenAngle(e),d=Math.atan2(Math.sin(a-drag.angle),Math.cos(a-drag.angle));drag.angle=a;update(current+d/data.step);};
  const release=()=>{if(!drag)return;drag=null;choose(Math.round(current));};
  stage.onpointerup=stage.onpointercancel=stage.onlostpointercapture=release;
  stage.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End',' '].includes(e.key)){e.preventDefault();e.stopPropagation();if(e.key==='ArrowLeft')step(-1);else if(e.key==='ArrowRight')step(1);else if(e.key==='Home')choose(0);else if(e.key==='End')choose(data.entries.length-1);else play.click();}};
  const visibility=()=>{if(document.hidden){pause();tween=null;update(Math.round(current));}};document.addEventListener('visibilitychange',visibility);
  const motion=()=>{if(reduced.matches){pause();tween=null;update(Math.round(current));}};reduced.addEventListener('change',motion);
  const observer=new ResizeObserver(fit);observer.observe(stage);fit();update(current);
  function animate(time){if(disposed)return;if(playing&&!document.hidden){const elapsed=time-playStart;update(playBase+(reduced.matches?Math.floor(elapsed/3000):cycleTurn(elapsed)));}else if(tween){const u=Math.min(1,(time-tween.start)/280),v=u*u*(3-2*u);update(tween.from+(tween.to-tween.from)*v);if(u===1)tween=null;}frame=requestAnimationFrame(animate);}
  frame=requestAnimationFrame(animate);
  return {dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motion);wheel.dispose();renderer.dispose();renderer.forceContextLoss();root.remove();},get turn(){return current;}};
}
