// Homepage-owned adapter: loads saved public example controls into an UNMODIFIED studio.
// Fail visibly if a concurrent generator update changes its source or control schema.
const $=id=>document.getElementById(id);
try{
 const id=new URLSearchParams(location.search).get('specimen');
 const response=await fetch('catalogue.json',{cache:'no-cache'});if(!response.ok)throw Error('The catalogue could not be loaded.');
 const catalogue=await response.json();const collection=catalogue.find(c=>c.samples.some(s=>s.id===id));if(!collection)throw Error('This specimen is not in the current catalogue.');
 const specimen=collection.samples.find(s=>s.id===id),url='../'+collection.page;
 $('launch-title').textContent=specimen.title;$('standalone').href=url;$('standalone').hidden=false;
 const source=await fetch(url,{cache:'no-cache'});if(!source.ok)throw Error('The studio is unavailable.');
 const text=(await source.text()).replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(hash!==specimen.sourceHash)throw Error('This studio has been updated since the specimen was made. Open the standalone studio to explore the new version, or return to the atlas after its previews are refreshed.');
 const frame=$('studio-frame');
 frame.onload=()=>{try{
   const doc=frame.contentDocument,win=frame.contentWindow;
   if(!win.__studio)throw Error('The studio did not expose its controls.');
   const controls=[];
   // Validate everything before changing anything; then verify the browser accepted every value.
   for(const [key,value] of Object.entries(specimen.settings)){
    const input=doc.getElementById(key);if(!input||!['INPUT','SELECT'].includes(input.tagName))throw Error(`The ${key} control has changed.`);
    if(input.tagName==='SELECT'&&![...input.options].some(o=>o.value===String(value)))throw Error(`The ${key} options have changed.`);
    if(input.type==='range'&&((input.min!==''&&Number(value)<Number(input.min))||(input.max!==''&&Number(value)>Number(input.max))))throw Error(`The ${key} range has changed.`);
    controls.push([input,String(value)]);
   }
   for(const [input,value] of controls){input.value=value;if(input.value!==value&&Number(input.value)!==Number(value))throw Error(`Could not apply ${input.id}.`)}
   for(const [input] of controls)input.dispatchEvent(new win.Event('input',{bubbles:true}));
   frame.hidden=false;$('launch-status').textContent='Saved starting point loaded. Change the controls to make it yours.';
 }catch(error){fail(error)}};
 frame.src=url;
 setTimeout(()=>{if(frame.hidden&&$('launch-error').hidden)fail(Error('The studio is taking too long to load. Try opening it directly.'))},20000);
}catch(error){fail(error)}
function fail(error){$('studio-frame').hidden=true;$('launch-status').textContent='The saved starting point could not be loaded.';const box=$('launch-error');box.hidden=false;box.textContent=error.message;const back=document.createElement('p');const a=document.createElement('a');a.href='../index.html#explore';a.textContent='Return to the atlas';back.append(a);box.append(back)}
