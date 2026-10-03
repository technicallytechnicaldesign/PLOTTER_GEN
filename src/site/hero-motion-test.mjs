import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {poseMatrices,puppetPose,createWeeding,weedProgress} from './hero-motion.js';
const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../../PLOTTER_GEN');
const catalogue=JSON.parse(fs.readFileSync(path.join(repo,'site/catalogue.json'),'utf8'));
const {createCanvas,Path2D}=createRequire(import.meta.url)('@napi-rs/canvas');
let poses=0,puppets=0,weeded=0;
for(const c of catalogue)for(const s of c.samples.filter(s=>s.motion)){
 const data=JSON.parse(fs.readFileSync(path.join(repo,s.motion),'utf8'));
 assert.equal(data.sourceHash,s.sourceHash);assert.equal(new Set(data.order).size,data.parts.length);
 const source=fs.readFileSync(path.join(repo,c.page),'utf8'),els=new Map();
 const el=(id,type,value)=>{const e={id,type,value:String(value??''),textContent:'',innerHTML:'',style:{},dataset:{},addEventListener(){},parentElement:{clientWidth:800}};els.set(id,e);return e};
 for(const m of source.matchAll(/<input[^>]*type="(range|text)"[^>]*id="([^"]+)"[^>]*value="([^"]*)"/g))el(m[2],m[1],m[3]);
 for(const m of source.matchAll(/<select id="([^"]+)">\s*<option value="([^"]*)"/g))el(m[1],'select-one',m[2]);
 const document={getElementById:id=>els.get(id)||el(id,'div',''),querySelectorAll:()=>[]};
 const ctx={document,performance,console,Math,JSON,Map,Set,Float32Array,Float64Array,Int32Array,Uint8Array,Array,Object,Number,String,Blob:class{},URL:{},setTimeout:()=>0,clearTimeout(){},addEventListener(){},cancelAnimationFrame(){},requestAnimationFrame:()=>0,innerHeight:1000,devicePixelRatio:1};ctx.window=ctx;
 vm.runInNewContext(source.slice(source.lastIndexOf('<script>')+8,source.lastIndexOf('</script>')),ctx,{timeout:30000});
 for(const [key,value] of Object.entries(s.settings))els.get(key).value=value;
 const r=ctx.__studio.build(ctx.__studio.read());assert(r.gates.every(g=>g[1]),'Original studio gate '+s.id);
 assert.equal(r.R.parts.length,data.parts.length);
 for(const seconds of [0,.25,.75,1.5,3,5]){
  const pose=puppetPose(data,seconds),matrices=poseMatrices(data,pose);
  for(let i=0;i<data.parts.length;i++){
   const m=matrices[i],part=r.R.parts[i],f=ctx.poseXf(part,pose);
   for(const q of [part.outline[0],part.outline[Math.floor(part.outline.length/2)],part.pivot||[0,0]]){
    const actual=[m[0]*q[0]+m[2]*q[1]+m[4],m[1]*q[0]+m[3]*q[1]+m[5]],expected=f(q);
    assert(Math.hypot(actual[0]-expected[0],actual[1]-expected[1])<1e-8,'Rig pose drift '+s.id+'/'+part.name);poses++;
   }
  }
 }
 puppets++;
}
class Element{constructor(tag,attrs={}){this.tag=tag;this.attrs=attrs;this.style={};this.children=[];this.dataset={}}setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]}append(n){this.children.push(n)}}
globalThis.document={createElementNS:(_,tag)=>new Element(tag)};
for(const c of catalogue.filter(c=>c.mode==='cutter'))for(const s of c.samples){
 const source=fs.readFileSync(path.join(repo,s.svg),'utf8'),d=source.match(/<g id="decal"><path d="([^"]+)"/)[1],decal=new Element('path',{d,fill:'#000'}),svg=new Element('svg');
 svg.querySelector=q=>q==='#decal path'?decal:null;
 const raw=JSON.parse(fs.readFileSync(path.join(repo,s.weeding),'utf8'));assert.equal(raw.sourceHash,s.sourceHash);
 const w=createWeeding(svg,raw);assert(w.patches.length>0,'No removable cuts '+s.id);
 const cv=createCanvas(560,560),ctx=cv.getContext('2d');
 const raster=p=>{weedProgress(w,p);ctx.clearRect(0,0,560,560);ctx.setTransform(2,0,0,2,0,0);ctx.fillStyle='#000';ctx.fill(new Path2D(d),'evenodd');for(const {patch} of w.patches){if(patch.style.visibility==='hidden')continue;ctx.save();ctx.globalAlpha=Number(patch.style.opacity);const shift=patch.attrs.transform.match(/translate\(([^ ]+) ([^)]+)\)/);if(shift)ctx.translate(+shift[1],+shift[2]);const p=new Path2D(patch.attrs.d);ctx.fill(p,'evenodd');ctx.strokeStyle='#000';ctx.lineWidth=.08;ctx.stroke(p);ctx.restore()}if(w.cover&&w.cover.style.visibility!=='hidden'){ctx.save();ctx.globalAlpha=Number(w.cover.style.opacity);ctx.fill(new Path2D(w.cover.attrs.d),'evenodd');ctx.restore()}return cv.toBuffer('image/png')};
 const start=raster(0),mid=raster(.5),finish=raster(1);
 ctx.clearRect(0,0,560,560);ctx.setTransform(2,0,0,2,0,0);ctx.fill(new Path2D(d),'evenodd');
 assert.deepEqual(finish,cv.toBuffer('image/png'),'Weeding endpoint differs from original geometry '+s.id);
 assert.notDeepEqual(start,finish,'Solid start already shows all detail '+s.id);assert.notDeepEqual(mid,start,'No midpoint reveal '+s.id);
 raster(0);assert(w.patches.every(p=>p.patch.style.visibility==='visible'),'Replay did not restore waste '+s.id);
 weeded++;
}
console.log(`PASS ${puppets} puppet rigs / ${poses} point poses agree with original studio functions; ${weeded} lino reveals end at exact exported geometry and replay correctly.`);
