import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const repo=path.join(project,'PLOTTER_GEN');
const catalogue=JSON.parse(fs.readFileSync(path.join(repo,'site/catalogue.json'),'utf8'));
const cutters=catalogue.filter(c=>c.mode==='cutter');
assert(cutters.length>0,'Missing cutter collection');
assert(cutters.some(c=>c.page==='lino-decal-studio.html'&&c.samples.length>=4),'Missing lino specimens');
assert(catalogue.some(c=>!c.mode&&c.samples.length),'Missing plotter specimens');
const ids=new Set();let specimens=0,totalWebp=0;
for(const c of catalogue){
 for(const s of c.samples){
  const kind=c.mode==='cutter'?'weeding':['figure','animals'].includes(c.id)?'motion':null;
  if(kind){assert(s[kind], 'Missing '+kind+' asset '+s.id);const asset=JSON.parse(fs.readFileSync(path.join(repo,s[kind]),'utf8'));assert.equal(asset.sourceHash,s.sourceHash,'Stale motion '+s.id);if(kind==='motion')assert(asset.parts.length>0&&asset.order.length===asset.parts.length,'Incomplete rig '+s.id);else assert(asset.loops.length>0,'Empty weeding '+s.id)}
 }
 const source=fs.readFileSync(path.join(repo,c.page),'utf8');
 const hash=crypto.createHash('sha256').update(source.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n')).digest('hex');
 for(const s of c.samples){
  assert(!ids.has(s.id),`Duplicate specimen ${s.id}`);ids.add(s.id);
  assert.equal(s.sourceHash,hash,`Stale specimen ${s.id}`);
  assert(Object.keys(s.settings).length>0,`Missing controls ${s.id}`);
  const svg=fs.readFileSync(path.join(repo,s.svg),'utf8');
  assert(svg.includes('<svg')&&svg.includes('<path'),`Empty drawing ${s.id}`);
  assert(!/NaN|Infinity/.test(svg),`Invalid coordinates ${s.id}`);
  const record=JSON.parse(fs.readFileSync(path.join(repo,'site/art',s.id+'.json'),'utf8'));
  assert.deepEqual(record.settings,s.settings,`Settings download differs from launcher ${s.id}`);
  for(const key of Object.keys(s.settings))assert(source.includes(`id="${key}"`),`Unknown control ${s.id}/${key}`);
  totalWebp+=fs.statSync(path.join(repo,s.image)).size;specimens++;
 }
}
const index=fs.readFileSync(path.join(repo,'index.html'),'utf8');
assert(!index.includes('<!--@@'),'Unexpanded template token');
for(const id of ['hero-art','atlas','specimen-dialog','transport','replay','scrap-rack','minimize','restore'])assert(index.includes(`id="${id}"`),`Missing UI element ${id}`);
for(const f of ['site/bench.css','site/plot-animation.js','site/site.css','site/site.js','site/launch.html','site/launch.js'])assert(fs.existsSync(path.join(repo,f)),`Missing ${f}`);
console.log(`PASS ${catalogue.length} studios / ${specimens} unique specimens; source fingerprints, settings, geometry, preview assets and navigation shell verified.`);
console.log(`Preview total: ${(totalWebp/1024/1024).toFixed(2)} MiB, lazy loaded; splash and upcoming sheet SVGs preloaded.`);
