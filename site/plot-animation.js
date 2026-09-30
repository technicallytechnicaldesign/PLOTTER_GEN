// Homepage playback only; exported SVG geometry and generator order stay intact.
export function createDrawing(svg){
 const paths=[...svg.querySelectorAll('path')].filter(p=>p.getTotalLength()>0);
 const box=svg.getBoundingClientRect(),cx=box.left+box.width/2,cy=box.top+box.height/2;
 // Begin near the centre so cropped previews don't spend their first seconds
 // drawing registration marks beyond the visible paper.
 const distance=p=>{const point=p.getPointAtLength(0).matrixTransform(p.getScreenCTM());return Math.hypot(point.x-cx,point.y-cy)};
 const distances=new Map(paths.map(p=>[p,distance(p)]));
 paths.sort((a,b)=>distances.get(a)-distances.get(b));
 const lengths=paths.map(p=>p.getTotalLength()),ends=[];let total=0;
 lengths.forEach(n=>ends.push(total+=n));
 paths.forEach(p=>{p.setAttribute('pathLength','1');p.style.strokeDasharray='1';p.style.strokeDashoffset='1';p.style.visibility='hidden'});
 const marker=document.createElementNS('http://www.w3.org/2000/svg','circle');marker.setAttribute('r','1.3');marker.classList.add('pen-marker');marker.style.display='none';svg.append(marker);
 return {svg,paths,lengths,ends,total,marker,elapsed:0,finished:0,complete:false};
}
export function drawProgress(d,progress){
 progress=Math.max(0,Math.min(1,progress));d.elapsed=progress*12000;
 const distance=progress*d.total;let low=0,high=d.ends.length-1;
 while(low<high){const mid=(low+high)>>1;if(d.ends[mid]<distance)low=mid+1;else high=mid}
 const index=low;
 if(index<d.finished)d.paths.slice(index).forEach(p=>{p.style.strokeDashoffset='1';p.style.visibility='hidden'});
 for(let i=Math.min(d.finished,index);i<index;i++){d.paths[i].style.strokeDashoffset='0';d.paths[i].style.visibility='visible'}
 d.finished=index;const p=d.paths[index];
 if(p){const fraction=progress===1?1:(distance-(index?d.ends[index-1]:0))/d.lengths[index];p.style.strokeDashoffset=String(1-fraction);p.style.visibility=fraction>0?'visible':'hidden';
 const point=p.getPointAtLength(d.lengths[index]*fraction).matrixTransform(p.getCTM()).matrixTransform(d.svg.getCTM().inverse());d.marker.setAttribute('cx',point.x);d.marker.setAttribute('cy',point.y)}
 d.marker.style.display=progress===0||progress===1?'none':'';d.complete=progress===1;
}
