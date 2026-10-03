import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {collections} from './catalogue.mjs';
import {bakePuppets} from './puppet-assets.mjs';
const require=createRequire(import.meta.url);
function dependency(name){try{return require(name)}catch{return require(path.join(process.env.PLG_NODE_MODULES || '', name))}}
function normalizeRange(value,markup){
  const attr=name=>markup.match(new RegExp(`${name}="([^"]*)"`))?.[1];
  const min=Number(attr('min')??0),max=Number(attr('max')??100),step=attr('step')??'1';
  let n=Math.min(max,Math.max(min,Number(value)));
  if(step!=='any'&&Number(step)>0)n=Math.min(max,Math.max(min,min+Math.floor((n-min)/Number(step)+0.500000001)*Number(step)));
  return String(Number(n.toFixed(10)));
}
export async function buildSite({repo,here,pages}) {
  const sharp=dependency('sharp'), {createCanvas,Path2D}=dependency('@napi-rs/canvas'), out=path.join(repo,'site'), assets=path.join(out,'art');
  fs.mkdirSync(assets,{recursive:true});
  const catalogue=[];
  for(const collection of collections){
    if(!pages.some(p=>p[0]===collection.page)) continue;
    const source=fs.readFileSync(path.join(repo,collection.page),'utf8');
    const sourceHash=crypto.createHash('sha256').update(source.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n')).digest('hex');
    const ranges=new Map([...source.matchAll(/<input[^>]*type="range"[^>]*id="([^"]+)"[^>]*>/g)].map(m=>[m[1],m[0]]));
    const specimens=[];
    for(const [preset,title,content={}] of collection.samples){
      const id=collection.id+'-'+(preset||'default'), record=path.join(assets,id+'.json');
      if(fs.existsSync(record)&&fs.existsSync(path.join(assets,id+'.svg'))&&fs.existsSync(path.join(assets,id+'.webp'))){
        const cached=JSON.parse(fs.readFileSync(record,'utf8'));
        const normalized=[...ranges].every(([key,markup])=>Number(cached.settings[key])===Number(normalizeRange(cached.settings[key],markup)));
        if(cached.sourceHash===sourceHash&&cached.title===title&&normalized){const {studio,...specimen}=cached;specimen.content=content;specimens.push(specimen);continue}
      }
      const els=new Map();
      const el=(id,type,value)=>els.set(id,{id,type,value:String(value??''),textContent:'',innerHTML:'',style:{},dataset:{},addEventListener(){},insertAdjacentHTML(){},scrollIntoView(){},parentElement:{clientWidth:800},getContext:()=>createCanvas(800,1000).getContext('2d')});
      for(const m of source.matchAll(/<input[^>]*type="(range|text)"[^>]*id="([^"]+)"[^>]*value="([^"]*)"/g))el(m[2],m[1],m[3]);
      for(const m of source.matchAll(/<select id="([^"]+)">\s*<option value="([^"]*)"/g))el(m[1],'select-one',m[2]);
      const document={getElementById:id=>els.get(id)||(el(id,'div',''),els.get(id)),querySelectorAll:()=>[],createElement:tag=>tag==='canvas'?createCanvas(800,1000):els.get('cv')};
      const ctx={Path2D,document,performance,console,Math,JSON,Map,Set,Float32Array,Float64Array,Int32Array,Uint8Array,Array,Object,Number,String,Blob:class{},URL:{},setTimeout:()=>0,clearTimeout(){},addEventListener(){},cancelAnimationFrame(){},requestAnimationFrame:()=>0,innerHeight:1000,devicePixelRatio:1};ctx.window=ctx;
      vm.runInNewContext(source.slice(source.lastIndexOf('<script>')+8,source.lastIndexOf('</script>')),ctx,{timeout:30000});
      const S=ctx.__studio;if(!S)throw Error(`No studio interface: ${collection.page}`);
      if(preset){if(!S.PRESETS?.[preset])throw Error(`Missing preset ${collection.id}/${preset}`);for(const [k,v] of Object.entries(S.PRESETS[preset])){if(!els.has(k))throw Error(`Missing control ${k}`);els.get(k).value=String(v)}}
      // HTML range inputs sanitize off-step preset values; mirror that before exporting.
      for(const [key,markup] of ranges)els.get(key).value=normalizeRange(els.get(key).value,markup);
      // Public built-in sample messages only; never reads user work or bench exports.
      const controls=S.read(), result=S.build(controls);
      if(result.error)throw Error(`${collection.id}/${preset}: ${result.error}`);
      if(result.gates?.some(g=>!g[1]))throw Error(`Studio gate failed: ${collection.id}/${preset}`);
      let svg=S.toSVG(result);
      if(!svg.includes('<svg')||/NaN|Infinity/.test(svg))throw Error(`Invalid SVG: ${collection.id}/${preset}`);
      fs.writeFileSync(path.join(assets,id+'.svg'),svg);
      await sharp(Buffer.from(svg),{density:96,limitInputPixels:50000000}).resize({width:760,height:880,fit:'inside'}).flatten({background:'#ffffff'}).webp({quality:86}).toFile(path.join(assets,id+'.webp'));
      const settings=Object.fromEntries([...els].filter(([,e])=>['range','text','select-one'].includes(e.type)).map(([id,e])=>[id,e.value]));
      const specimen={id,title,preset,content,settings,sourceHash,svg:`site/art/${id}.svg`,image:`site/art/${id}.webp`,page:controls.page||`${result.W}x${result.H}`,seed:controls.seed??null};
      fs.writeFileSync(path.join(assets,id+'.json'),JSON.stringify({studio:collection.page,...specimen},null,2));
      specimens.push(specimen);
    }
    // Built-in presets are the studio's own preset buttons.
    const presets=new Set([...source.matchAll(/data-preset="([^"]+)"/g)].map(m=>m[1]).filter(id=>!collection.hiddenPresets?.includes(id))).size;
    catalogue.push({...collection,presets,samples:specimens});
    console.log(`site: ${collection.name}, ${specimens.length} real specimens`);
  }
  // Preserve navigation for future published pages even before editorial specimens exist.
  for(const [page,family,name,description] of pages){if(page==='plot-decoder.html'||catalogue.some(c=>c.page===page))continue;const presets=new Set([...fs.readFileSync(path.join(repo,page),'utf8').matchAll(/data-preset="([^"]+)"/g)].map(m=>m[1])).size;catalogue.push({id:page.replace('.html',''),page,name,description,subtitle:description,family,tags:'',lesson:'Open the studio to explore its methods.',presets,samples:[]})}
  bakePuppets({catalogue,repo,here});
  fs.writeFileSync(path.join(out,'catalogue.json'),JSON.stringify(catalogue));
  for(const name of ['site.css','bench.css','plot-animation.js','hero-motion.js','site.js','exhibit.js','gallery.js','gallery-world.js','print-gallery.json','gallery.css','launch.html','launch.js'])fs.copyFileSync(path.join(here,'site',name),path.join(out,name));
  fs.copyFileSync(path.join(here,'site/gallery.html'),path.join(out,'gallery.html'));
  const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const fallback=pages.map(([p,,t,d])=>`<li><a href="${escape(p)}">${escape(t)}</a> — ${escape(d)}</li>`).join('\n');
  const revision=name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(out,name))).digest('hex').slice(0,12);
  const app=fs.readFileSync(path.join(out,'site.js'),'utf8').replace('./plot-animation.js', './plot-animation.js?v='+revision('plot-animation.js')).replace('./hero-motion.js','./hero-motion.js?v='+revision('hero-motion.js'));
  fs.writeFileSync(path.join(out,'site.js'),app);
  const launcher=fs.readFileSync(path.join(out,'launch.html'),'utf8').replace('src="launch.js"','src="launch.js?v='+revision('launch.js')+'"');
  fs.writeFileSync(path.join(out,'launch.html'),launcher);
  // The opening sheet is picked at random per visit; its SVG is preloaded before the catalogue arrives.
  const heroPools=Object.fromEntries(['plotter','cutter'].map(mode=>[mode,catalogue.filter(c=>(c.mode||'plotter')===mode).flatMap(c=>c.samples.map(s=>s.id))]));
  const heroScript=`<script>(()=>{const pools=${JSON.stringify(heroPools)},p=pools[new URLSearchParams(location.search).get('gen')==='cutter'?'cutter':'plotter'],id=p[Math.floor(Math.random()*p.length)],l=document.createElement('link');window.__plgHero=id;l.rel='preload';l.as='fetch';l.crossOrigin='anonymous';l.href='site/art/'+id+'.svg';document.head.appendChild(l)})()</script>`;
  const html=fs.readFileSync(path.join(here,'site-index.template.html'),'utf8').replace('<!--@@FALLBACK@@-->',fallback).replace('<!--@@HERO@@-->',heroScript).replace('src="site/site.js"','src="site/site.js?v='+revision('site.js')+'"');
  fs.writeFileSync(path.join(repo,'index.html'),html);
  console.log(`site: ${catalogue.length} studios, ${catalogue.reduce((n,c)=>n+c.samples.length,0)} specimens`);
}
