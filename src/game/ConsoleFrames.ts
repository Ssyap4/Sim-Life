import {drawUfc} from './UfcBroadcast';
import {CONSOLE_GAMES,type ConsoleMatch,type ConsoleGameId} from '../shared/consoleCatalog';
// Original miniature game-like animation, not captured or executable commercial gameplay.
export function drawConsoleFrame(c:CanvasRenderingContext2D,id:ConsoleGameId,t:number,match?:ConsoleMatch){
 if(id==='ufc6'){drawUfc(c,t,match);return;}
 const w=256,h=144,phase=t%12; c.clearRect(0,0,w,h);
 const rect=(x:number,y:number,a:number,b:number,color:string)=>{c.fillStyle=color;c.fillRect(x,y,a,b);};
 const line=(pts:number[],color:string,width=2)=>{c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.beginPath();c.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)c.lineTo(pts[i],pts[i+1]);c.stroke();};
 const circle=(x:number,y:number,r:number,color:string)=>{c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
 const text=(s:string,x:number,y:number,size=9)=>{c.font='bold '+size+'px sans-serif';c.fillStyle='#fff';c.fillText(s,x,y);};
 if(['ufc6','mk1','smash'].includes(id)){
  rect(0,0,w,h,'#192335');for(let i=0;i<12;i++){const x=i*23;rect(x,30,12,56,i%2?'#29374a':'#35465c');circle(x+6,26,3,'#dbe1d5');}
  c.fillStyle='#808b91';c.beginPath();c.ellipse(128,103,105,37,0,0,Math.PI*2);c.fill();
  c.strokeStyle='#e1e2df';c.lineWidth=1.5;c.beginPath();c.ellipse(128,103,91,29,0,0,Math.PI*2);c.stroke();
  const fighter=(x:number,side:number,color:string,beat:number)=>{
   const strike=Math.max(0,Math.sin(t*3.1+beat))**6, bob=Math.sin(t*5+beat)*1.8,y=69+bob;
   c.fillStyle='#303942';c.beginPath();c.ellipse(x,118,15,4,0,0,Math.PI*2);c.fill();
   line([x-5,y+28,x-9,y+42,x-15,115],'#bc8d72',5);line([x+5,y+28,x+9,y+41,x+16,115],'#b88569',5);
   line([x,y+2,x-side*2,y+22],'#c69b80',13);rect(x-8,y+17,16,12,color);
   circle(x,y-7,7,'#ccaa90');line([x-side*5,y+3,x-side*12,y+12,x-side*7,y-1],'#bb8a72',5);
   line([x+side*5,y+4,x+side*(11+strike*10),y+10-strike*5,x+side*(15+strike*19),y-1-strike*4],'#d2a38b',5);
   circle(x+side*(15+strike*19),y-1-strike*4,4,color);circle(x-side*7,y-1,4,color);
  };
  fighter(96+Math.sin(t*1.1)*8,1,'#e15954',0);fighter(160+Math.sin(t*1.1+1.2)*8,-1,'#5589db',2.2);
  rect(12,19,94,5,'#3d4651');rect(150,19,94,5,'#3d4651');rect(12,19,94*(1-phase/20),5,'#d95659');rect(150,19,94*(.9-phase/25),5,'#548fda');text('ROUND '+(1+Math.floor(t/40)%3),107,25,7);
 }else if(id==='forza6'||id==='marioKart'||id==='gta6'){
  const sky=c.createLinearGradient(0,0,0,90);sky.addColorStop(0,'#3e6b9b');sky.addColorStop(1,'#e9c9a2');c.fillStyle=sky;c.fillRect(0,0,w,90);
  rect(0,74,w,70,id==='gta6'?'#4d5b61':'#5c8f69');
  for(let i=0;i<14;i++){const x=(i*23+Math.sin(t*.3)*12)%280-12,hh=15+(i*17)%32;rect(x,80-hh,15,hh,id==='gta6'?'#667483':'#456b59');}
  c.fillStyle='#41474e';c.beginPath();c.moveTo(111+Math.sin(t*.5)*12,68);c.lineTo(145+Math.sin(t*.5)*12,68);c.lineTo(246,144);c.lineTo(10,144);c.fill();
  for(let i=0;i<6;i++){const z=((i/6+t*.7)%1)**2;rect(127-z*2,72+z*72,2+z*4,2+z*9,'#f1e3be');}
  const x=128+Math.sin(t*1.4)*22;rect(x-20,111,40,17,'#263242');rect(x-15,105,30,19,id==='marioKart'?'#edbd37':'#d45949');rect(x-12,108,24,7,'#8bb8cd');rect(x-18,123,8,3,'#ffdf8d');rect(x+10,123,8,3,'#ffdf8d');text(Math.floor(110+40*Math.sin(t*.7))+' KM/H',184,132);
 }else{
  rect(0,0,w,h,'#77a8c7');circle(203,41,16,'#f8e0a0');rect(0,102,w,42,'#60875f');
  for(let i=0;i<8;i++){const x=(i*37-t*13%37);rect(x,94-(i%3)*10,29,10,'#6b7854');rect(x,91-(i%3)*10,29,4,'#c5d38a');}
  for(let i=0;i<2;i++){const x=87+i*66+Math.sin(t*1.6+i)*20,y=86-Math.max(0,Math.sin(t*2.2+i*1.8))*20;circle(x,y-11,7,i?'#e0c083':'#d6a68b');rect(x-6,y-5,12,15,i?'#4c87c7':'#c95659');line([x-3,y+9,x-6,y+17], '#344154',4);line([x+3,y+9,x+7,y+17], '#344154',4);}
  for(let i=0;i<5;i++)circle(20+i*43,51+Math.sin(i+t*2)*3,4,'#f8df82');
  text('★ '+(Math.floor(t*3)%100),210,132);
 }
 rect(0,0,w,15,'#111827');text(CONSOLE_GAMES[id].name,8,11,9);
 if(match&&t>=CONSOLE_GAMES[id].seconds-5){rect(55,48,146,36,'#111827');text('WINNER: '+(match.winner==='red'?match.redLabel:match.blueLabel),68,69,12);}
}
