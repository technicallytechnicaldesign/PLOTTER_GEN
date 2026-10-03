const NS='http://www.w3.org/2000/svg';
export function createReveal(svg,data,plot){
 const overlay=svg.querySelector('#pen-overlay,#pen-grille-cut');
 if(!overlay)throw Error('The moving sheet is missing');
 if(data.cut){const p=document.createElementNS(NS,'path'),polys=[data.cut.outline,...data.cut.holes,...(data.cut.pin?[data.cut.pin]:[])];p.setAttribute('d',polys.map(q=>'M'+q.map(p=>p.join(',')).join('L')+'Z').join(' '));p.setAttribute('fill','#e9dcc6');p.setAttribute('fill-rule','evenodd');p.setAttribute('stroke','none');overlay.prepend(p)}
 const boxes=[...svg.querySelectorAll('#pen-base,#pen-overlay,#pen-grille-cut')].map(g=>g.getBBox()),left=Math.min(...boxes.map(b=>b.x)),top=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.x+b.width)),bottom=Math.max(...boxes.map(b=>b.y+b.height));
 svg.setAttribute('viewBox',`${left-8} ${top-8} ${right-left+16} ${bottom-top+16}`);
 svg.dataset.animation='reveal';return {kind:'reveal',svg,data,overlay,plot,duration:16000,elapsed:0,loop:true,complete:false};
}
export function moveReveal(d,amount){
 const {data,overlay}=d;let pose;
 if(['fleissner','dial'].includes(data.method)){const [x,y]=data.pivot;pose=`rotate(${amount*360} ${x} ${y})`}
 else if(data.method==='moire')pose=`translate(0 ${amount*Number(data.pitch)/2})`;
 else pose=`translate(${amount*Number(data.cell||5)*3} 0)`;
 overlay.setAttribute('transform',pose);d.svg.dataset.stage=amount===0?'revealed':'concealing';
}
export function revealProgress(d,progress,elapsed,drawProgress){
 const drawing=progress<.75;drawProgress(d.plot,drawing?progress/.75:1);
 if(drawing){moveReveal(d,0);d.svg.dataset.stage='drawing';return}
 d.plot.marker.style.display='none';
 const seconds=Math.max(0,(elapsed-12000)/1000);
 moveReveal(d,d.data.method==='fleissner'||d.data.method==='dial'?(seconds/8)%1:(1-Math.cos(seconds*Math.PI/2))/2);
}
