// Optional private clips: all traffic is from the local game server. No third-party
// requests, no new WebGL scene, one silent decoder, no assets in the repository.
const base='/media/ufc-private/';
const windows=[
 [0,2,'celebrate'],[8,12,'exchange'],[19,23,'exchange'],[30,34,'exchange'],
 [36,39,'celebrate'],[48,52,'exchange'],[59,63,'exchange'],[70,74,'exchange'],
 [75,78,'celebrate'],[86,90,'exchange'],[97,101,'exchange']
] as const;
export function highlightAt(t:number,seed:number,files:readonly string[]){
 const index=windows.findIndex(([start,end])=>t>=start&&t<end);
 if(index<0)return null;
 const [start,,kind]=windows[index],pool=files.filter(f=>f.startsWith(kind+'-'));
 if(!pool.length)return null;
 return {file:pool[(Math.abs(seed)+index)%pool.length],index,offset:t-start,kind};
}
let files:readonly string[]|undefined,loading=false;
let active:{c:CanvasRenderingContext2D;video:HTMLVideoElement;index:number;file:string;started:boolean;failed:boolean}|undefined;
export function stopUfcHighlight(c?:CanvasRenderingContext2D){
 if(!active||(c&&active.c!==c))return;
 const video=active.video;active=undefined;video.pause();video.removeAttribute('src');video.load();
}
function loadManifest(){
 if(loading||files!==undefined)return;
 loading=true;
 fetch(base+'manifest.json').then(r=>r.ok?r.json():[]).then((v:unknown)=>{
  files=Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'&&/^(exchange|celebrate)-[1-9][0-9]?\.mp4$/.test(x)):[];
 }).catch(()=>{files=[];}).finally(()=>{loading=false;});
}
export function drawUfcHighlight(c:CanvasRenderingContext2D,t:number,seed:number):boolean{
 if(typeof document==='undefined')return false;
 if(document.hidden){stopUfcHighlight(c);return false;}
 if(files===undefined){loadManifest();return false;}
 const clip=highlightAt(t,seed,files);
 if(!clip){stopUfcHighlight(c);return false;}
 if(!active||active.c!==c||active.index!==clip.index||active.file!==clip.file){
  stopUfcHighlight();
  const video=document.createElement('video');video.muted=true;video.defaultMuted=true;video.playsInline=true;video.setAttribute('playsinline','');
  video.loop=true;video.preload='auto';
  const state={c,video,index:clip.index,file:clip.file,started:false,failed:false};
  active=state;video.addEventListener('error',()=>{state.failed=true;},{once:true});video.src=base+clip.file;
 }
 const state=active,video=state.video;
 if(state.failed)return false;
 if(video.readyState<2||!video.videoWidth||!Number.isFinite(video.duration)||video.duration<=0)return false;
 const expected=clip.offset%video.duration,drift=Math.abs(video.currentTime-expected);
 if(!state.started||Math.min(drift,Math.abs(video.duration-drift))>.65){
  video.currentTime=expected;
 }
 if(!state.started){state.started=true;void video.play().catch(()=>{state.failed=true;});}
 if(video.seeking||state.failed)return false;
 const w=c.canvas.width,h=c.canvas.height,scale=Math.min(w/video.videoWidth,h/video.videoHeight);
 const dw=video.videoWidth*scale,dh=video.videoHeight*scale;
 c.save();
 try{
  c.fillStyle='#080b10';c.fillRect(0,0,w,h);c.drawImage(video,(w-dw)/2,(h-dh)/2,dw,dh);
  c.fillStyle='#101722dd';c.fillRect(0,0,w,13);c.fillStyle='#fff';c.font='bold 8px sans-serif';c.textAlign='left';c.fillText('UFC 6  |  HIGHLIGHTS',7,9);
  return true;
 }catch{state.failed=true;video.pause();return false;}finally{c.restore();}
}
if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(document.hidden)stopUfcHighlight();});
