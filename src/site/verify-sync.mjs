import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {PAGES,SOURCES} from '../publish-site.mjs';
import {stripLocal} from './local-only.mjs';
const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),project=path.dirname(here),repo=path.join(project,'LOCAL_PLOTTER_GEN_CLAUDE');
// the published copy has its local-only fences stripped, so both sides are compared stripped
const normalize=file=>stripLocal(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n'));
const hash=file=>crypto.createHash('sha256').update(normalize(file)).digest('hex');
const rows=[...PAGES.map(([p])=>['04_DOCS/'+p,p]),...SOURCES.map(p=>['02_WORK/'+p,'src/'+p]),['02_WORK/site-public-readme.md','README.md']];
const result=rows.map(([desktop,published])=>({desktop,published,match:fs.existsSync(path.join(project,desktop))&&fs.existsSync(path.join(repo,published))&&hash(path.join(project,desktop))===hash(path.join(repo,published))}));
const missing=result.filter(r=>!r.match);
console.log(`${missing.length?'FAIL':'PASS'} desktop/public parity: ${result.length-missing.length}/${result.length} mapped files (BOM and line endings normalized).`);
missing.forEach(r=>console.log('DIFF '+r.desktop+' -> '+r.published));
// Runtime imports and page templates must be present in the mirrored source tree.
for(const file of SOURCES.filter(p=>p.endsWith('.js'))){const source=normalize(path.join(here,file));for(const m of source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.\.?\/[^'"]+)['"]/g)){const dependency=path.resolve(repo,'src',path.dirname(file),m[1].split('?')[0]);if(!fs.existsSync(dependency)){console.log('MISSING IMPORT '+file+' -> '+m[1]);missing.push({file,dependency})}}}
if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2));
process.exitCode=missing.length?1:0;
