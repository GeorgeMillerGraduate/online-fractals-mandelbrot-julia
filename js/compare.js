'use strict';
function escapeValue(re,im,type,cr,ci,maxIterations){
 let zr=type==='julia'?re:0,zi=type==='julia'?im:0;
 if(type!=='julia'){
  cr=re;ci=im;
  // Exact analytic membership tests for the main cardioid and period-two bulb.
  const x=cr-.25,q=x*x+ci*ci;
  if(q*(q+x)<=.25*ci*ci||(cr+1)*(cr+1)+ci*ci<=.0625)return null;
 }
 const radius=Math.max(256,type==='julia'?Math.hypot(cr,ci)+1:256),limit=radius*radius;let n=0;
 while(n<maxIterations&&zr*zr+zi*zi<=limit){const nr=zr*zr-zi*zi+cr;zi=2*zr*zi+ci;zr=nr;n++;}
 if(zr*zr+zi*zi<=limit)return null;
 const escapedAt=n;
 // Extra escaped iterations stabilise log-log colouring across bailout levels.
 for(let k=0;k<2;k++){const nr=zr*zr-zi*zi+cr,ni=2*zr*zi+ci;if(!Number.isFinite(nr)||!Number.isFinite(ni))break;zr=nr;zi=ni;n++;}
 const magnitude=Math.hypot(zr,zi),smooth=n+1-Math.log(Math.log(magnitude))/Math.LN2;
 return{n:escapedAt,smooth:Number.isFinite(smooth)?smooth:escapedAt};
}
function compareStrip(j){
 const data=new Uint8ClampedArray(j.width*j.height*4),span=j.type==='julia'?3.4*Math.max(1,j.width/j.fullHeight):j.span,cx=j.type==='julia'?0:j.cx,cy=j.type==='julia'?0:j.cy,stride=j.stride||1;
 for(let y=0;y<j.height;y+=stride)for(let x=0;x<j.width;x+=stride){
  const re=cx+((x+Math.min(stride,j.width-x)/2)/j.width-.5)*span,im=cy+(.5-(j.y+y+Math.min(stride,j.height-y)/2)/j.fullHeight)*span*j.fullHeight/j.width,r=escapeValue(re,im,j.type,j.cx,j.cy,j.iterations);
  let colour=[0,0,0];
  if(r){const t=(((j.smooth?r.smooth:r.n)*j.cycles/52)%1+1)%1,f=t*(j.palette.length-1),k=Math.min(j.palette.length-2,Math.floor(f)),a=f-k;colour=j.palette[k].map((v,c)=>Math.round(v*(1-a)+j.palette[k+1][c]*a));}
  for(let by=y;by<Math.min(y+stride,j.height);by++)for(let bx=x;bx<Math.min(x+stride,j.width);bx++){const p=(by*j.width+bx)*4;data[p]=colour[0];data[p+1]=colour[1];data[p+2]=colour[2];data[p+3]=255;}
 }
 return data;
}
if(typeof module!=='undefined'&&module.exports)module.exports={escapeValue,compareStrip};
if(typeof document!=='undefined')(()=>{
const $=id=>document.getElementById(id),top=$('mandelbrot'),bottom=$('julia'),contexts={mandelbrot:top.getContext('2d',{alpha:false}),julia:bottom.getContext('2d',{alpha:false})};
const palettes={classic:[[0,7,50],[0,55,160],[37,152,214],[209,241,240],[255,221,113],[212,79,10],[57,7,37],[0,7,50]],spectrum:[[0,3,45],[0,70,200],[0,225,240],[255,245,70],[255,90,0],[145,0,50],[0,3,45]],copper:[[20,29,36],[62,86,98],[163,124,75],[245,232,197],[160,69,30],[20,29,36]]};
const workerSource=`const escapeValue=${escapeValue.toString()};const compareStrip=${compareStrip.toString()};onmessage=e=>{const j=e.data,pixels=compareStrip(j);postMessage({type:j.type,y:j.y,width:j.width,height:j.height,pixels},[pixels.buffer]);};`,url=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));
const initialRect=top.getBoundingClientRect(),baseSpan=Math.max(3.5,2.8*initialRect.width/initialRect.height);let view={cx:-.5,cy:0,span:baseSpan},config,workers=[],generation=0,jobs=[],nextJob=0,done=0,started=0,drag=null,wheelTimer,pass=0;
function fmt(x){return Number(x.toPrecision(8)).toString();}function complex(x,y){return fmt(x)+(y<0?' − ':' + ')+fmt(Math.abs(y))+'i';}
function sync(){ $('centerX').value=Number(view.cx.toPrecision(14));$('centerY').value=Number(view.cy.toPrecision(14));$('span').value=Number(view.span.toPrecision(14));$('parameter').textContent='c = '+complex(view.cx,view.cy);$('zoomReadout').textContent=(baseSpan/view.span).toLocaleString('en-GB',{maximumFractionDigits:2})+'×';}
function stop(){generation++;workers.forEach(w=>w.terminate());workers=[];$('stop').disabled=true;}
function render(){if(!$('settings').reportValidity())return;const v={cx:Number($('centerX').value),cy:Number($('centerY').value),span:Number($('span').value)};if(!Object.values(v).every(Number.isFinite)||Math.abs(v.cx)>1e6||Math.abs(v.cy)>1e6||v.span<1e-11||v.span>100){$('error').textContent='Use finite coordinates within ±1,000,000 and span between 10⁻¹¹ and 100.';return;}stop();view=v;config={...view,iterations:Number($('iterations').value),palette:palettes[$('palette').value],cycles:Number($('cycles').value),smooth:$('smooth').checked};$('error').textContent='';const r=top.getBoundingClientRect(),scale=Number($('resolution').value);for(const c of[top,bottom]){c.width=Math.max(1,Math.round(Math.min(1600,r.width)*scale));c.height=Math.max(1,Math.round(Math.min(800,r.height)*scale));const ctx=c.getContext('2d');ctx.fillStyle='#000816';ctx.fillRect(0,0,c.width,c.height);}sync();jobs=[];for(let y=0;y<top.height;y+=16)for(const type of['mandelbrot','julia'])jobs.push({type,y,height:Math.min(16,top.height-y)});done=nextJob=0;pass=0;started=performance.now();$('timeReadout').textContent='—';setProgress(0);$('state').textContent='Rendering both planes…';$('stop').disabled=false;const gen=generation;
for(let i=0;i<Math.min(4,Math.max(1,(navigator.hardwareConcurrency||2)-1));i++){const w=new Worker(url);workers.push(w);w.onmessage=e=>{if(gen!==generation)return;const j=e.data;contexts[j.type].putImageData(new ImageData(j.pixels,j.width,j.height),0,j.y);done+=j.height;const percent=(pass+done/(top.height+bottom.height))*50;setProgress(percent);$('state').textContent=`${pass===0?'Preview':'Fine pass'}: ${Math.round(percent)}%`;if(done===top.height+bottom.height&&pass===0){pass=1;done=nextJob=0;workers.forEach(dispatch);}else if(done===top.height+bottom.height){$('timeReadout').textContent=((performance.now()-started)/1000).toFixed(2)+' s';$('state').textContent='Both views complete';stop();}else dispatch(w);};w.onerror=()=>{stop();$('error').textContent='Rendering needs Web Workers. Serve this folder through HTTP(S) and allow blob: in worker-src.';$('state').textContent='Renderer unavailable';};dispatch(w);}}
function dispatch(w){if(nextJob>=jobs.length)return;w.postMessage({...config,...jobs[nextJob++],width:top.width,fullHeight:top.height,stride:pass===0?4:1});}
function setProgress(p){$('progress').setAttribute('aria-valuenow',Math.round(p));$('progress').firstElementChild.style.width=p+'%';}
function zoom(f,u=.5,v=.5){const old=view.span,span=old/f;if(span<1e-11||span>100){$('state').textContent='Zoom limit reached';return;}view.cx+=(u-.5)*(old-span);view.cy+=(.5-v)*(old-span)*top.height/top.width;view.span=span;sync();render();}
$('settings').onsubmit=e=>{e.preventDefault();render();};$('cycles').oninput=()=>{$('cycleValue').value=$('cycles').value;};$('marker').onchange=()=>{$('centreMarker').hidden=!$('marker').checked;};$('preset').onchange=()=>{const presets={overview:{cx:-.5,cy:0,span:baseSpan},seahorse:{cx:-.74543,cy:.11301,span:.012},rabbit:{cx:-.123,cy:.745,span:.3},dust:{cx:.32,cy:.55,span:.6},zero:{cx:0,cy:0,span:baseSpan}};view={...presets[$('preset').value]};sync();render();};$('zoomIn').onclick=()=>zoom(2);$('zoomOut').onclick=()=>zoom(.5);$('reset').onclick=()=>{view={cx:-.5,cy:0,span:baseSpan};$('preset').value='overview';sync();render();};$('stop').onclick=()=>{stop();$('state').textContent='Stopped — partial views retained';};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.workspace').requestFullscreen();}catch(e){$('state').textContent='Fullscreen unavailable';}};
$('save').onclick=()=>{const out=document.createElement('canvas'),pad=30,label=45;out.width=top.width+pad*2;out.height=top.height+bottom.height+label*2+pad*3;const c=out.getContext('2d');c.fillStyle='#f6f0e3';c.fillRect(0,0,out.width,out.height);c.fillStyle='#633a24';c.font='20px Georgia';c.fillText('Mandelbrot — centre c = '+complex(view.cx,view.cy),pad,pad+25);c.drawImage(top,pad,pad+label);c.fillText('Julia — fixed z-plane scale',pad,pad*2+label+top.height+25);c.drawImage(bottom,pad,pad*2+label*2+top.height);out.toBlob(blob=>{if(!blob)return;const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='jenga-mandelbrot-julia-pair.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);});};
function pos(e){const r=top.getBoundingClientRect();return{u:(e.clientX-r.left)/r.width,v:(e.clientY-r.top)/r.height};}top.addEventListener('wheel',e=>{e.preventDefault();const{u,v}=pos(e);clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>zoom(e.deltaY<0?1.5:1/1.5,u,v),140);},{passive:false});top.addEventListener('pointerdown',e=>{if(e.button!==0)return;top.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY};});top.addEventListener('pointermove',()=>{if(drag)top.style.cursor='grabbing';});top.addEventListener('pointerup',e=>{if(!drag)return;const d=drag;drag=null;top.style.cursor='crosshair';const r=top.getBoundingClientRect();if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>5){view.cx-=(e.clientX-d.x)/r.width*view.span;view.cy+=(e.clientY-d.y)/r.height*view.span*top.height/top.width;}else{const{u,v}=pos(e);view.cx+=(u-.5)*view.span;view.cy+=(.5-v)*view.span*top.height/top.width;}sync();render();});top.addEventListener('pointercancel',()=>{drag=null;top.style.cursor='crosshair';});top.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='='){e.preventDefault();zoom(2);}else if(e.key==='-'){e.preventDefault();zoom(.5);}else if(e.key==='Escape')$('reset').click();else{const dirs={ArrowLeft:[-.15,0],ArrowRight:[.15,0],ArrowUp:[0,.15],ArrowDown:[0,-.15]};if(dirs[e.key]){e.preventDefault();view.cx+=dirs[e.key][0]*view.span;view.cy+=dirs[e.key][1]*view.span*top.height/top.width;sync();render();}}});
window.addEventListener('pagehide',()=>{stop();URL.revokeObjectURL(url);});
sync();render();
})();
