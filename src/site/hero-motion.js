// Visual presentation only: downloads retain the studio's exact SVG.
const NS='http://www.w3.org/2000/svg';
const node=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n};
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
function inside([x,y],points){let odd=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])odd=!odd}return odd}
export function createWeeding(svg,data){
 svg.querySelector('#weed-box')?.remove();
 const decal=svg.querySelector('#decal path');if(!decal)throw Error('Missing lino shape');
 // The studio emits closed M/L/Z polygons. Ring nesting identifies removed vinyl.
 const polygons=data?data.loops.map(points=>({points,d:'M'+points.map(p=>p.map(v=>Number(v.toFixed(2))).join(',')).join(' L')+' Z'})):[...decal.getAttribute('d').matchAll(/M([^M]*?)Z/gi)].map(m=>{const numbers=m[1].match(/-?\d+(?:\.\d+)?/g).map(Number),points=[];for(let i=0;i<numbers.length;i+=2)points.push([numbers[i],numbers[i+1]]);return {d:m[0],points}});
 const rings=polygons.map(p=>{let area=0;for(let i=0,j=p.points.length-1;i<p.points.length;j=i++)area+=p.points[j][0]*p.points[i][1]-p.points[i][0]*p.points[j][1];return {...p,area:Math.abs(area)/2}});
 for(const r of rings)r.depth=rings.filter(other=>other!==r&&other.area>r.area&&inside(r.points[0],other.points)).length;
 const holes=data?rings.filter(r=>r.depth===0).map(r=>({...r,d:r.d+' '+rings.filter(q=>q!==r&&inside(q.points[0],r.points)).map(q=>q.d).join(' ')})).sort((a,b)=>b.area-a.area):rings.filter(r=>r.depth%2).sort((a,b)=>a.depth-b.depth||b.area-a.area);
 const waste=node('g',{'data-weeding':'waste',fill:decal.getAttribute('fill')||'#000','fill-rule':'evenodd'});svg.append(waste);
 let total=0;const patches=holes.map(r=>{const patch=node('path',{d:r.d,stroke:decal.getAttribute('fill')||'#000','stroke-width':.08,'stroke-linejoin':'round'}),weight=Math.sqrt(r.area),start=total;total+=weight;waste.append(patch);return {patch,start,weight}});
 // One exact silhouette covers raster contour seams at zero; the cut patches take over immediately.
 const cover=data?.solid?node('path',{d:data.solid.map(points=>'M'+points.map(p=>p.map(v=>Number(v.toFixed(2))).join(',')).join(' L')+' Z').join(' '),fill:decal.getAttribute('fill')||'#000','fill-rule':'evenodd','data-weeding':'solid'}):null;
 if(cover)svg.append(cover);
 svg.dataset.animation='weeding';
 return {kind:'weed',svg,patches,total,cover,elapsed:0,complete:false,duration:12000};
}
export function weedProgress(d,progress){
 progress=clamp(progress);const position=progress*d.total;
 if(d.cover){d.cover.style.visibility=progress>=.025?'hidden':'visible';d.cover.style.opacity=String(1-ease(progress/.025));}
 for(const {patch,start,weight} of d.patches){const p=ease((position-start)/weight);patch.style.visibility=p>=1?'hidden':'visible';patch.style.opacity=String(1-p);patch.setAttribute('transform',p?`translate(${p*2} ${-p*3})`:'');}
 d.svg.dataset.stage=progress===0?'solid':progress===1?'weeded':'weeding';d.complete=progress===1;
}
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
export function puppetPose(data,seconds){
 if(data.animal){const phase=seconds*4.2,w=Math.sin(phase),b=25*data.joints.length/5;return {fn:24*w,ff:-24*w,bn:-22*w,bf:22*w,fnk:b*Math.max(0,-w),ffk:b*Math.max(0,w),bnk:b*Math.max(0,w),bfk:b*Math.max(0,-w),head:6*Math.sin(2*phase),tail:25*Math.sin(3*phase)}}
 const phase=seconds*3.6,s=(1-Math.cos(phase))/2;
 return data.jack?{arm:12+135*s,leg:5+45*s,elbow:0,knee:0,tilt:0}:{arm:20+120*s,leg:5+30*(1-s),elbow:10+70*s,knee:10+40*(1-s),tilt:15*Math.sin(phase*.5)};
}
export function poseMatrices(data,pose){
 const matrices=[];
 function matrix(i){if(matrices[i])return matrices[i];const p=data.parts[i];if(p.parent<0)return matrices[i]=[1,0,0,1,0,0];const angle=(pose[p.key]||0)*Math.PI/180*p.sign,c=Math.cos(angle),s=Math.sin(angle),[x,y]=p.pivot;return matrices[i]=multiply(matrix(p.parent),[c,s,-s,c,x-c*x+s*y,y-s*x-c*y])}
 return data.parts.map((_,i)=>matrix(i));
}
export function createPuppet(svg,data,drawing){
 const sheet=node('g',{'data-puppet':'sheet'});for(const child of [...svg.children])if(!['title','desc'].includes(child.tagName)&&!child.classList.contains('pen-marker'))sheet.append(child);svg.prepend(sheet);
 const puppet=node('g',{'data-puppet':'parts',visibility:'hidden'}),groups=[];
 for(const i of data.order){const p=data.parts[i],g=node('g',{'data-part':p.name});
  const outline=node('path',{d:p.outline,fill:'#fcfdfe',stroke:'#26200f','stroke-width':.35,'stroke-linejoin':'round'});g.append(outline);
  for(const [key,col] of [['shade','#6b6356'],['colour','#b0126b'],['line','#26200f']])if(p.ink[key])g.append(node('path',{d:p.ink[key],fill:'none',stroke:col,'stroke-width':key==='shade'?.25:.35,'stroke-linecap':'round','stroke-linejoin':'round'}));
  for(const h of p.holes)g.append(node('circle',{cx:h.center[0],cy:h.center[1],r:h.pin?1.6:h.radius,fill:h.pin?'#b8902f':'#d9cdb0','data-pin':h.pin?'true':'false'}));
  groups[i]=g;puppet.append(g);
 }
 svg.append(puppet);svg.dataset.animation='puppet';
 return {kind:'puppet',svg,data,sheet,puppet,groups,outlineGroups:groups.map(g=>g.firstElementChild),plot:drawing,elapsed:0,complete:false,duration:16000,loop:true};
}
export function puppetProgress(d,progress,elapsed,drawProgress){
 const {svg,data,sheet,puppet}=d,drawEnd=.75,assembly=clamp((progress-drawEnd)/(1-drawEnd)),amount=ease(assembly);
 if(progress<drawEnd){sheet.style.display='';puppet.style.visibility='hidden';drawProgress(d.plot,progress/drawEnd);svg.dataset.stage='drawing';return}
 drawProgress(d.plot,1);d.plot.marker.style.display='none';sheet.style.display='none';puppet.style.visibility='visible';
 const seconds=Math.max(0,(elapsed-d.duration)/1000),blend=ease(seconds/.6),pose=puppetPose(data,seconds);for(const k of Object.keys(pose))pose[k]*=blend;
 const matrices=poseMatrices(data,pose),target=[data.scale,0,0,data.scale,...data.origin];
 for(let i=0;i<data.parts.length;i++){const p=data.parts[i],assembled=multiply(target,matrices[i]),laid=[1,0,0,1,...p.at],m=laid.map((v,k)=>v+(assembled[k]-v)*amount);d.groups[i].setAttribute('transform',`matrix(${m.join(' ')})`);d.outlineGroups[i].setAttribute('fill-opacity',String(amount));}
 svg.dataset.stage=assembly<1?'assembling':'wiggling';
}
