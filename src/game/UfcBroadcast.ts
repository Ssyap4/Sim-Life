import type {ConsoleMatch} from '../shared/consoleCatalog';
import {ufcBroadcastFrame} from './UfcChoreography';
// Original animated sports broadcast inspired by reference poses. No commercial footage or secondary WebGL scene.
const W=256,H=144;
type P=[number,number];

const colors=['#d44e48','#4a83d1'];
export function drawUfc(c:CanvasRenderingContext2D,t:number,match?:ConsoleMatch){
 const f=ufcBroadcastFrame(t,match),winner=match?.winner??'red',seed=match?.seed??0,time=f.sceneTime,result=f.celebrate,round=f.round,rt=f.rt,breakTime=f.roundBreak;
 const fill=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
 const poly=(pts:P[],color:string,stroke?:string)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.7;c.stroke();}};
 const path=(pts:P[],color:string,width:number)=>{c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();};
 const oval=(x:number,y:number,rx:number,ry:number,color:string,angle=0)=>{c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fillStyle=color;c.fill();};
 const label=(text:string,x:number,y:number,size=8,color='#f3f5f7',align:CanvasTextAlign='left')=>{c.font='bold '+size+'px sans-serif';c.fillStyle=color;c.textAlign=align;c.fillText(text,x,y);};
 c.save();c.clearRect(0,0,W,H);
 const bg=c.createLinearGradient(0,0,0,95);bg.addColorStop(0,'#080d16');bg.addColorStop(1,'#324051');c.fillStyle=bg;c.fillRect(0,0,W,H);
 for(let row=0;row<4;row++)for(let i=0;i<34;i++){const x=i*8+(row%2)*4,y=23+row*8;oval(x,y,2.2,2.5,((i+row*7)%5===0)?'#a19d97':'#415061');fill(x-3,y+2,6,4,((i*7+row)%3===0)?'#53616c':'#273241');}
 for(const x of [30,90,166,226]){const g=c.createRadialGradient(x,18,1,x,18,19);g.addColorStop(0,'#e6eeffb0');g.addColorStop(1,'#e6eeff00');c.fillStyle=g;c.fillRect(x-20,0,40,40);fill(x-7,14,14,3,'#f5f6ff');}
 // Scene camera changes only inside the broadcast. The score overlay is fixed.
 c.save();c.translate(128,85);c.scale(f.zoom,f.zoom);c.translate(-f.cameraX,-f.cameraY);
 const cage:P[]=[[16,89],[44,58],[99,49],[157,49],[212,58],[240,89],[220,125],[36,125]];
 const mat=c.createLinearGradient(0,58,0,130);mat.addColorStop(0,'#a8b0b8');mat.addColorStop(1,'#d4d8dc');
 c.beginPath();cage.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=mat;c.fill();c.strokeStyle='#222b36';c.lineWidth=3;c.stroke();
 path([[16,89],[44,58],[99,49],[157,49],[212,58],[240,89]],'#1b2330',3);
 for(const [x,y] of cage.slice(0,6)){path([[x,y],[x,y-22]],'#222c3a',4);path([[x,y-22],[x+2,y-22]],'#8794a2',1);}
 for(let x=20;x<240;x+=7){const y=x<44?88-(x-16):x>212?58+x-212:54;path([[x,y],[x+4,y-17]],'#4f5c69',.5);}
 oval(128,98,31,10,'#b7bdc3');label('SIM FIGHT',128,101,8,'#667480','center');
 const kind=f.kind,active=f.active,hit=f.strike,impact=hit>.76;
 const gap=breakTime?45:kind==='clinch'?21:kind==='kick'?38:32;
 const approach=breakTime?0:hit*(kind==='clinch'?12:8);
 // A referee in the rear lane, behind the two combatants.
 oval(128,82,9,2,'#30384466');path([[124,67],[123,79],[120,83]],'#171b23',5);
 path([[132,67],[133,79],[136,83]],'#171b23',5);path([[128,54],[128,68]],'#20262e',12);
 path([[123,56],[117,65],[117,71]],'#22282e',4);path([[133,56],[139,65],[139,71]],'#22282e',4);
 oval(128,48,4.2,5.5,'#aa8064');oval(128,45,4.2,2.4,'#363031');
 function fighter(i:number){
  const side=i===0?1:-1,attack=i===active?hit:0,react=i!==active?hit:0,skin=i===0?'#c68f6c':'#9a654a',light=i===0?'#e9b697':'#c18b68',shade=i===0?'#88583e':'#674232',color=colors[i];
  const wins=i===f.winner,fall=wins?0:f.fall,slip=i!==active?f.dodge:0;
  const x=128-side*(gap-approach)+Math.sin(time*1.8+i*2+seed)*2-side*fall*14,base=116+i*1.8;
  const bob=breakTime?0:Math.sin(time*5.1+i*1.7)*1.2;
  const down=slip*9+(kind==='clinch'?hit*5:0)+fall*15;
  const hip:P=[x-side*react*3,base-24+down],chest:P=[x+side*(attack*4-react*7-slip*7),base-45+bob+down],head:P=[chest[0]+side*1,chest[1]-10];
  const step=Math.sin(time*5.4+i*2.7)*(breakTime?0:3);
  const nearKnee:P=[hip[0]+side*(9+attack*3),base-12+down*.4],farKnee:P=[hip[0]-side*10,base-12],nearFoot:P=[x+side*(13+step),base],farFoot:P=[x-side*(13-step),base+1];
  if(kind==='kick'&&attack>0){nearKnee[0]=hip[0]+side*(9+attack*10);nearKnee[1]-=attack*8;nearFoot[0]+=side*attack*29;nearFoot[1]-=attack*28;}
  c.save();
  // Knocked-down opponent rotates about their lowered pelvis, then lies on the mat.
  if(fall>0){c.translate(x,base-9);c.rotate(-side*fall*1.35);c.translate(-x,-(base-9));}
  oval(x,base+1,18,4,'#38465355');
  path([hip,farKnee,farFoot],shade,6);path([farKnee,farFoot],skin,4);oval(farFoot[0]+side*2,farFoot[1],5,2,shade);
  path([hip,nearKnee,nearFoot],skin,7);path([nearKnee,nearFoot],light,4.5);oval(nearFoot[0]+side*2,nearFoot[1],5,2,skin);
  poly([[hip[0]-8,hip[1]-6],[hip[0]+8,hip[1]-6],[hip[0]+9,hip[1]+6],[hip[0]+1,hip[1]+8],[hip[0]-1,hip[1]+3],[hip[0]-8,hip[1]+8]],color,'#26313c');
  const torso=c.createLinearGradient(chest[0]-9,0,chest[0]+9,0);torso.addColorStop(0,shade);torso.addColorStop(.45,light);torso.addColorStop(1,skin);
  c.beginPath();c.moveTo(chest[0]-8,chest[1]-4);c.quadraticCurveTo(chest[0]-12,chest[1]+8,hip[0]-6,hip[1]-5);c.lineTo(hip[0]+6,hip[1]-5);c.quadraticCurveTo(chest[0]+12,chest[1]+8,chest[0]+8,chest[1]-4);c.closePath();c.fillStyle=torso;c.fill();
  path([[chest[0]-5,chest[1]+5],[chest[0]+5,chest[1]+5]],shade,.8);path([[chest[0],chest[1]+7],[hip[0],hip[1]-7]],shade,.6);
  oval(head[0],head[1]+1,5.9,7.5,skin);oval(head[0]-side,head[1]-4,5.7,3.4,'#25272b');oval(head[0]+side*3,head[1]-1,1.3,.7,'#292b30');path([[head[0]+side*3,head[1]+3],[head[0]+side*5,head[1]+3]],shade,.7);
  let e1:P=[chest[0]-side*7,chest[1]+9],g1:P=[chest[0]+side*4,chest[1]-5-react*2],e2:P=[chest[0]+side*11,chest[1]+9],g2:P=[chest[0]+side*14,chest[1]-5];
  if(kind==='jab'||kind==='cross'||kind==='knockdown'){
   e2=[chest[0]+side*(11+attack*10),chest[1]+9-attack*9];
   g2=[chest[0]+side*(14+attack*(kind==='knockdown'?25:22)),chest[1]-5+attack*(kind==='cross'?3:0)];
  }
  if(kind==='hook'){e2=[chest[0]+side*(11+attack*16),chest[1]+8-attack*11];g2=[chest[0]+side*(14+attack*20),chest[1]-5-attack*4];}
  if(kind==='clinch'){e2=[chest[0]+side*(11+attack*8),chest[1]+3];g2=[chest[0]+side*(14+attack*13),chest[1]-6];}
  if(slip>0){g1[1]-=slip*5;g2[1]-=slip*5;}
  if(result&&wins){const lift=Math.min(1,(f.time-115)*2),wave=Math.sin(f.time*8)*2;
   e1=[chest[0]-12,chest[1]+9-23*lift];g1=[chest[0]-13,chest[1]-4-17*lift+wave];
   e2=[chest[0]+12,chest[1]+9-23*lift];g2=[chest[0]+13,chest[1]-4-17*lift-wave];
  }
  if(fall>.5){e1=[chest[0]-10,chest[1]+12];g1=[chest[0]-18,chest[1]+16];e2=[chest[0]+10,chest[1]+9];g2=[chest[0]+19,chest[1]+15];}
  path([[chest[0]-side*5,chest[1]],e1,g1],shade,6);oval(g1[0],g1[1],4,3.5,'#22262d');oval(g1[0],g1[1]-1,3.3,2.7,color);
  path([[chest[0]+side*6,chest[1]],e2,g2],skin,6);path([e2,g2],light,4.5);oval(g2[0],g2[1],4.4,3.7,'#22262d');oval(g2[0],g2[1]-1,3.5,2.7,color);
  c.restore();
 }
 fighter(1);fighter(0);
 // Referee stays behind fighters, not a third combatant; octagon foreground framing.
 path([[36,125],[16,89]],'#202a35',2);path([[220,125],[240,89]],'#202a35',2);
 if(impact&&!breakTime&&!result){oval(128,62,3,1.8,'#f4e7c090');}
 c.restore();
 fill(0,0,W,14,'#0c111c');label('UFC 6',8,10,9);label('LIVE  •  OCTAGON',248,10,7,'#c6d3de','right');
 fill(9,17,94,5,'#18212d');fill(153,17,94,5,'#18212d');
 const progress=time/120,red=1-progress*(winner==='red'?.33:.57),blue=1-progress*(winner==='blue'?.33:.57);
 fill(9,17,94*Math.max(.2,red),5,colors[0]);fill(247-94*Math.max(.2,blue),17,94*Math.max(.2,blue),5,colors[1]);
 label(match?.redLabel??'PLAYER 1',10,30,7);label(match?.blueLabel??'PLAYER 2',246,30,7,'#fff','right');
 fill(92,125,72,16,'#111825');label('R'+round+'  '+String(Math.max(0,Math.ceil(36-rt))).padStart(2,'0')+'s',128,136,9,'#fff','center');
 if(breakTime){fill(85,41,86,15,'#111827dc');label('ROUND BREAK',128,51,9,'#fff','center');}
 if(f.replay){fill(6,36,105,14,'#b52e35');label('SLOW MOTION REPLAY',12,46,7);}
 else if(kind==='knockdown'&&f.fall>.8){fill(97,36,62,16,'#111827df');label('KNOCKDOWN',128,47,8,'#f5cb83','center');}
 if(result){fill(53,105,150,23,'#101723ee');label('WINNER',128,114,7,'#e5bd72','center');label(winner==='red'?(match?.redLabel??'PLAYER 1'):(match?.blueLabel??'PLAYER 2'),128,125,10,'#fff','center');}
 c.restore();
}