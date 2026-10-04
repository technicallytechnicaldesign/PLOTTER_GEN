// Homepage assets derived from the public studio's own rig and saved controls.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const VERSION=3;
const pathData=(points,closed=false)=>'M'+points.map(p=>p.map(v=>Number(v.toFixed(3))).join(',')).join(' L')+(closed?' Z':'');
export function bakePuppets({catalogue,repo,here}){
 const require=createRequire(path.join(here,'site/package.json')), {createCanvas,Path2D}=require('@napi-rs/canvas');
 for(const collection of catalogue.filter(c=>['figure','animals','lino','overlay'].includes(c.id))){
  const source=fs.readFileSync(path.join(repo,collection.page),'utf8');
  for(const s of collection.samples){
   const lino=collection.id==='lino',property=collection.id==='overlay'?'reveal':lino?'weeding':'motion',url=`site/art/${s.id}-${property}.json`,file=path.join(repo,url);
   const key=crypto.createHash('sha256').update(JSON.stringify([VERSION,s.sourceHash,s.settings])).digest('hex');
   if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file,'utf8')).key===key){s[property]=url;continue}
   const els=new Map();
   const el=(id,type,value)=>{const e={id,type,value:String(value??''),textContent:'',innerHTML:'',style:{},dataset:{},addEventListener(){},parentElement:{clientWidth:800},getContext:()=>createCanvas(800,1000).getContext('2d')};els.set(id,e);return e};
   for(const m of source.matchAll(/<input[^>]*type="(range|text)"[^>]*id="([^"]+)"[^>]*value="([^"]*)"/g))el(m[2],m[1],m[3]);
   for(const m of source.matchAll(/<select id="([^"]+)">\s*<option value="([^"]*)"/g))el(m[1],'select-one',m[2]);
   const document={getElementById:id=>els.get(id)||el(id,'div',''),querySelectorAll:()=>[]};
   const ctx={Path2D,document,performance,console,Math,JSON,Map,Set,Float32Array,Float64Array,Int32Array,Uint8Array,Array,Object,Number,String,Blob:class{},URL:{},setTimeout:()=>0,clearTimeout(){},addEventListener(){},cancelAnimationFrame(){},requestAnimationFrame:()=>0,innerHeight:1000,devicePixelRatio:1};ctx.window=ctx;
   let script=source.slice(source.lastIndexOf('<script>')+8,source.lastIndexOf('</script>'));
   if(lino){
    const anchor='return { w, h, loops, G, mask: m, stats:';
    if(!script.includes(anchor))throw Error('Lino raw-shape interface changed');
    // Instrument the build-only VM, never the public studio: retain its true uncarved silhouette.
    script=script.replace(anchor,`const solid = new Uint8Array(N); paint(solid, neg ? [block] : frameInk.map(p => wob(p, wa * 1.4, ws + 9)), 1); for (const it of its) paint(solid, it.sil, 1); for (let i=0;i<N;i++) solid[i] |= m[i]; const waste = new Uint8Array(N); for(let i=0;i<N;i++) waste[i]=solid[i]&&!m[i]?1:0;
    return { solidLoops: trace(solid,G), wasteLoops: trace(waste,G), w, h, loops, G, mask: m, stats:`);
   }
   vm.runInNewContext(script,ctx,{timeout:30000});
   for(const [id,value] of Object.entries(s.settings)){if(!els.has(id))throw Error('Unknown puppet control '+id);els.get(id).value=value}
   const r=ctx.__studio.build(ctx.__studio.read());
   if(r.error||r.gates.some(g=>!g[1]))throw Error('Puppet build gate failed: '+s.id);
   if(collection.id==='overlay'){
    const data={key,sourceHash:s.sourceHash,method:r.o.method,pitch:r.o.pitch,cell:r.o.cell,pivot:r.res.pivot,cut:r.res.cut,positions:r.res.positions||4,reads:r.res.reads};
    fs.writeFileSync(file,JSON.stringify(data));s.reveal=url;console.log('reveal: '+s.id);continue;
   }
   if(lino){
    const X=x=>r.mirrored?r.W-x:x;
    const loops=r.decals.flatMap(d=>d.wasteLoops.map(q=>q.map(([x,y])=>[X(x+d.x),y+d.y])));
    const solid=r.decals.flatMap(d=>d.solidLoops.map(q=>q.map(([x,y])=>[X(x+d.x),y+d.y])));
    fs.writeFileSync(file,JSON.stringify({key,sourceHash:s.sourceHash,loops,solid}));s.weeding=url;console.log(`weeding: ${s.id}, ${loops.length} waste contours`);continue;
   }
   const P=r.R.parts,animal=collection.id==='animals',outline=P.flatMap(p=>p.outline),xs=outline.map(q=>q[0]),ys=outline.map(q=>q[1]);
   const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys),margin=r.o.margin;
   const scale=animal?Math.min(1,(r.H-2*margin)/(bottom-top)*.85,(r.W-2*margin)/(right-left)*.85):Math.min(1,(r.H-2*margin)/(bottom-top)*.82);
   const origin=[r.W/2-(animal?scale*(left+right)/2:0),r.H/2-scale*(top+bottom)/2];
   const leg=(far,lower)=>P.filter(p=>p.kind==='limb'&&!!p.far===far&&!!p.lower===lower);
   const back=P.filter(p=>p.kind==='limb'&&r.R.jack),front=P.filter(p=>!(p.kind==='limb'&&r.R.jack));
   const ordered=animal?[...leg(true,false),...leg(true,true),...P.filter(p=>p.kind==='tail'),...P.filter(p=>p.kind==='torso'),...leg(false,false),...leg(false,true),...P.filter(p=>p.kind==='head')]:[...back,...front.filter(p=>p.kind==='torso'),...front.filter(p=>p.kind==='head'),...front.filter(p=>p.kind==='limb'&&/upper|thigh/.test(p.name)),...front.filter(p=>p.kind==='limb'&&!/upper|thigh/.test(p.name))];
   if(new Set(ordered).size!==P.length)throw Error('Missing puppet part: '+s.id);
   const parts=P.map(p=>({name:p.name,parent:p.parent?P.indexOf(p.parent):-1,pivot:p.pivot||[0,0],key:p.key||'',sign:p.sign??1,at:p.at,outline:pathData(p.outline,true),ink:Object.fromEntries(['line','shade','colour'].map(k=>[k,p.ink[k].map(q=>pathData(q)).join(' ')])),holes:p.holes.map(h=>({center:h.c,radius:h.r,pin:h.kind==='pin'}))}));
   const data={key,sourceHash:s.sourceHash,width:r.W,height:r.H,animal,jack:!!r.R.jack,joints:r.o.joints,scale,origin,order:ordered.map(p=>P.indexOf(p)),parts};
   if(/NaN|Infinity/.test(JSON.stringify(data)))throw Error('Invalid puppet geometry '+s.id);
   fs.writeFileSync(file,JSON.stringify(data));s.motion=url;
   console.log(`motion: ${s.id}, ${parts.length} original rig parts`);
  }
 }
}
