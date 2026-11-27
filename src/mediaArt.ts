import {mediaTitle,type MediaTitle,type MediaSelection} from './shared/mediaCatalog';
const palettes:Record<string,[string,string,string]>={
 space:['#0d2136','#365975','#e4c49b'],desert:['#4b2b30','#d49c60','#ffe2a2'],sea:['#153d51','#467a85','#e1bf8a'],city:['#202c3b','#596777','#eebc79'],forest:['#183b39','#50775b','#d5d9a1'],romance:['#553449','#ad777b','#f4cba3'],comedy:['#355c66','#7ca2a2','#f7d68c'],horror:['#1b2431','#55515e','#c5cecb'],stage:['#322941','#866080','#f7cf8e'],history:['#352c2a','#9a7958','#ead3a5']};
const groups:Record<string,string[]>={
 space:['hail-mary','interstellar','star-city','mario-galaxy','mandalorian','disclosure-day'],
 desert:['dune','dune2','breaking-bad','sunrise-reaping'],
 sea:['odyssey','titanic','widows-bay','shutter-island'],
 forest:['wild-robot','quiet-place','knight','dark','wuthering'],
 stage:['michael','prestige','lalaland','prada-2','barbie'],
 history:['gladiator','oppenheimer','peaky-film','chernobyl','green-mile','shawshank','pride','queen'],
};
function seed(id:string){let n=2166136261;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
export function motif(t:MediaTitle){return Object.keys(groups).find(k=>groups[k].includes(t.id))??(t.genre==='romance'?'romance':t.genre==='comedy'?'comedy':t.genre==='horror'?'horror':'city');}
export function paintMedia(c:CanvasRenderingContext2D,t:MediaTitle,w:number,h:number,time=0){
 const k=motif(t),[dark,mid,light]=palettes[k],n=seed(t.id),r=(i:number)=>((Math.imul(n^(i+1),1597334677)>>>0)%1000)/1000;
 c.save();c.scale(w/256,h/144);
 const grad=c.createLinearGradient(0,0,180,144);grad.addColorStop(0,dark);grad.addColorStop(1,mid);c.fillStyle=grad;c.fillRect(0,0,256,144);
 const disk=(x:number,y:number,rad:number,color:string)=>{c.fillStyle=color;c.beginPath();c.arc(x,y,rad,0,Math.PI*2);c.fill();};
 const poly=(points:number[][],color:string)=>{c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
 const px=45+r(2)*160+Math.sin(time*.23)*7,py=22+r(3)*35;
 disk(px,py,15+r(4)*17,light);
 if(k==='space'){for(let i=0;i<38;i++)disk(r(i+6)*256,r(i+77)*92,.4+r(i+21)*1.3,'#ffffffaa');disk(40+r(8)*130,126,56,dark);c.strokeStyle=light;c.lineWidth=1.5;c.beginPath();c.ellipse(110,90,74,14,-.38,0,Math.PI*2);c.stroke();poly([[105+time%12,80],[128+time%12,73],[119+time%12,88]],light);}
 else if(k==='sea'){for(let i=0;i<5;i++){const y=65+i*16;c.fillStyle=i%2?dark:mid;c.beginPath();c.moveTo(0,y);for(let x=0;x<=256;x+=8)c.lineTo(x,y+Math.sin(x*.045+time*.9+i)*4);c.lineTo(256,144);c.lineTo(0,144);c.fill();}poly([[96,90],[154,90],[143,101],[109,101]],light);poly([[125,52],[125,89],[151,84]],'#e9d8bd');}
 else if(k==='desert'){for(let i=0;i<3;i++){const y=84+i*18;poly([[0,y],[r(i+8)*100,y-25],[160,y+4],[256,y-12],[256,144],[0,144]],i%2?mid:dark);}}
 else if(k==='forest'||k==='horror'){for(let i=0;i<13;i++){const x=i*22+r(i+8)*8,y=35+r(i+12)*46;poly([[x,y],[x-19,120],[x+19,120]],i%2?dark:'#263e3c');}poly([[0,119],[256,106],[256,144],[0,144]],dark);}
 else if(k==='stage'){for(let i=0;i<3;i++)poly([[40+i*85,0],[20+i*75,126],[100+i*70,126]],'#ffe0a51c');c.fillStyle=dark;c.fillRect(0,120,256,24);}
 else if(k==='romance'||k==='comedy'){for(let i=0;i<8;i++)disk(r(i+8)*256,15+r(i+22)*75,2+r(i+5)*5,'#fff0c055');poly([[0,113],[256,97],[256,144],[0,144]],dark);}
 else {for(let i=0;i<12;i++){const x=i*23,y=45+r(i+7)*47;c.fillStyle=i%2?dark:mid;c.fillRect(x,y,21,144-y);for(let j=0;j<4;j++){c.fillStyle='#ffe2a45c';c.fillRect(x+4,y+9+j*12,4,5);}}}
 // Distinct motifs for the newest titles, deliberately original illustrations rather than studio posters.
 const icon=(x:number,y:number)=>{c.save();c.translate(x,y);c.strokeStyle=light;c.fillStyle=light;c.lineWidth=2;const line=(pts:number[][])=>{c.beginPath();pts.forEach(([a,b],i)=>i?c.lineTo(a,b):c.moveTo(a,b));c.stroke();};
 switch(t.id){
 case 'hail-mary':poly([[0,-24],[-8,4],[-20,18],[0,13],[20,18],[8,4]],light);disk(0,-5,4,dark);break;
 case 'star-city':poly([[0,-29],[-8,-10],[-8,19],[8,19],[8,-10]],light);line([[-12,23],[0,31],[12,23]]);break;
 case 'spider-new-day':for(let i=0;i<8;i++){const a=i*Math.PI/4;line([[0,0],[Math.cos(a)*39,Math.sin(a)*39]]);}for(const rr of [12,25,38]){const p=Array.from({length:9},(_,i)=>[Math.cos(i*Math.PI/4)*rr,Math.sin(i*Math.PI/4)*rr]);line(p);}break;
 case 'sunrise-reaping':c.beginPath();c.arc(-6,0,24,-1.15,1.15);c.stroke();line([[4,-22],[4,22],[-10,0],[28,0],[20,-6]]);break;
 case 'prada-2':poly([[-8,-25],[8,-25],[6,-4],[23,28],[-23,28],[-6,-4]],light);break;
 case 'michael':c.beginPath();c.ellipse(0,-12,8,14,-.3,0,Math.PI*2);c.fill();line([[-3,1],[9,27],[2,31]]);break;
 case 'scream-7':c.beginPath();c.ellipse(0,0,17,26,0,0,Math.PI*2);c.fill();disk(-6,-6,4,dark);disk(6,-6,4,dark);c.fillStyle=dark;c.beginPath();c.ellipse(0,12,4,9,0,0,Math.PI*2);c.fill();break;
 case 'toy-story-5':for(let i=0;i<3;i++){c.fillStyle=i%2?mid:light;c.fillRect(-28+i*20,-8-i*8,18,24+i*8);c.fillStyle=dark;c.fillRect(-25+i*20,-5-i*8,12,4);}break;
 case 'mario-galaxy':for(let i=0;i<5;i++){const x=Math.cos(i*Math.PI*2/5-Math.PI/2)*24,y=Math.sin(i*Math.PI*2/5-Math.PI/2)*24;const a=(i+.5)*Math.PI*2/5-Math.PI/2;poly([[0,0],[x,y],[Math.cos(a)*10,Math.sin(a)*10]],light);}break;
 case 'mandalorian':poly([[-20,-21],[20,-21],[23,6],[12,23],[-12,23],[-23,6]],light);poly([[-15,-4],[15,-4],[15,1],[5,1],[5,21],[-5,21],[-5,1],[-15,1]],dark);break;
 case 'rip':case 'steal':c.strokeRect(-23,-16,46,32);disk(0,0,10,light);disk(0,0,6,dark);line([[0,-7],[0,7]]);break;
 case 'peaky-film':poly([[-24,0],[-13,-18],[11,-20],[23,-7],[23,3],[-24,3]],light);line([[-26,4],[32,4]]);break;
 case 'knight':line([[0,-28],[0,26],[-8,18]]);line([[-12,-11],[12,-11]]);c.strokeRect(-3,-28,6,16);break;
 case 'widows-bay':poly([[-9,-25],[9,-25],[13,28],[-13,28]],light);poly([[-16,-25],[0,-35],[16,-25]],dark);c.fillStyle=dark;c.fillRect(-5,-19,10,9);break;
 case 'disclosure-day':c.strokeStyle=light;c.beginPath();c.ellipse(0,0,32,12,0,0,Math.PI*2);c.stroke();disk(0,0,9,light);break;
 case 'ready-or-not-2':case 'run-away':line([[-24,22],[-3,-12],[10,1],[24,-22]]);line([[10,-22],[24,-22],[24,-8]]);break;
 case 'wuthering':c.beginPath();c.moveTo(0,24);c.bezierCurveTo(-40,-8,-17,-30,0,-12);c.bezierCurveTo(17,-30,40,-8,0,24);c.stroke();break;
 case 'odyssey':line([[0,-30],[0,18]]);poly([[0,-25],[24,4],[0,4]],light);poly([[-28,14],[28,14],[14,27],[-14,27]],light);break;
 }c.restore();};if(t.year===2026)icon(128,70);
 const person=(x:number,y:number,size:number)=>{disk(x,y-size*.72,size*.18,dark);poly([[x-size*.22,y-size*.5],[x+size*.22,y-size*.5],[x+size*.31,y],[x-size*.31,y]],dark);};
 if(k!=='space'){person(120+Math.sin(time*.5)*7,137,35+r(2)*12);if(t.genre==='romance'||t.genre==='comedy')person(155,137,33);}
 c.restore();
}
const coverCache=new Map<string,string>();
export function mediaCover(t:MediaTitle){const cover=document.createElement('div');cover.className='media-cover media-illustrated';let src=coverCache.get(t.id);if(!src){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=144;const c=canvas.getContext('2d');if(c)paintMedia(c,t,256,144);src=canvas.toDataURL('image/webp',.82);coverCache.set(t.id,src);}const img=document.createElement('img');img.src=src;img.alt='';img.loading='lazy';img.decoding='async';const label=document.createElement('span');label.textContent=t.year===2026?'НОВИНКА 2026':t.seasons?'СЕРИАЛ':'КИНО';cover.append(img,label);return cover;}
export function drawNamedMedia(c:CanvasRenderingContext2D,s:MediaSelection,time:number){const t=mediaTitle(s.id);if(!t)return false;const cut=Math.floor(time/16)%3;c.save();if(cut===1){c.translate(-12,-7);c.scale(1.09,1.10);}else if(cut===2){c.translate(256,0);c.scale(-1,1);}paintMedia(c,t,256,144,time);c.restore();c.fillStyle='#14212bdb';c.fillRect(0,112,256,32);c.fillStyle='#fff3db';c.font='bold 11px sans-serif';c.fillText(t.title,9,126,238);c.font='9px sans-serif';c.fillText(s.season?'Сезон '+s.season+' · серия '+s.episode:'Фильм · '+t.year,9,137,238);c.fillStyle='#edc58a';c.fillRect(0,142,256*Math.min(1,Math.max(0,time/120)),2);return true;}
