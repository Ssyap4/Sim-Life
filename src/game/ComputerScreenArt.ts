import { GAME_BY_ID, type ComputerGame, type VideoClipId } from '../shared/computerGames';
import type { CharacterId } from '../shared/protocol';

export type ComputerScene = {
  mode: 'idle'|'game'|'video'|'code'|'hair'|'study'|'browser'|'mail'|'notes';
  role: CharacterId;
  game?: string;
  clip?: VideoClipId;
};
const W=256,H=144;
const paint=(c:CanvasRenderingContext2D,color:string,x:number,y:number,w:number,h:number)=>{
  c.fillStyle=color;c.fillRect(x,y,w,h);
};
const rounded=(c:CanvasRenderingContext2D,color:string,x:number,y:number,w:number,h:number,r=5)=>{
  c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();
};
const label=(c:CanvasRenderingContext2D,text:string,x:number,y:number,color='#e8f2fc',size=10,bold=false)=>{
  c.fillStyle=color;c.font=(bold?'700 ':'500 ')+size+'px system-ui, sans-serif';
  c.fillText(text,x,y,W-x-5);
};
const dot=(c:CanvasRenderingContext2D,x:number,y:number,r:number,color:string)=>{
  c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
};
const bar=(c:CanvasRenderingContext2D,x:number,y:number,w:number,value:number,color:string)=>{
  rounded(c,'#ffffff26',x,y,w,4,2);
  rounded(c,color,x,y,Math.max(3,w*Math.max(0,Math.min(1,value))),4,2);
};
const clipTitles:Record<VideoClipId,string>={pets:'Питомцы',travel:'Путешествия',tech:'Гаджеты'};

function gamePicture(c:CanvasRenderingContext2D,game:ComputerGame,t:number){
  const variant=game.scene;
  if(game.genre==='sim') {
    paint(c,variant===1?'#94bed5':'#9dc79b',8,24,240,91);
    if(variant===0){
      paint(c,'#70a674',8,77,240,38);
      for(let i=0;i<7;i++){
        const x=17+i*34,y=85+(i%2)*14;
        rounded(c,'#79654a',x,y,23,12,2);
        for(let j=0;j<3;j++)dot(c,x+4+j*8,y+4-Math.sin(t*1.5+i+j)*2,3,'#e9c67e');
      }
      paint(c,'#f0dfb3',13,43,60,31);paint(c,'#b56852',9,37,68,11);
      for(let i=0;i<3;i++)dot(c,146+i*30,67+Math.sin(t+i)*2,8,'#4c9166');
      dot(c,209,40,10,'#ffe7ad');
    }else if(variant===1){
      for(let i=0;i<10;i++){
        const x=16+i*24,y=56+(i*9%36);
        paint(c,i%2?'#527c91':'#6e8f92',x,y-20,19,120-y);
        for(let k=0;k<3;k++)paint(c,'#ffda9d',x+4+(k%2)*8,y-14+(k%3)*9,4,5);
      }
      paint(c,'#577e66',8,110,240,10);
      paint(c,'#d9d3ad',9,103,238,4);
      dot(c,215,39,11,'#fff0b9');
    }else{
      rounded(c,'#eac9ae',20,35,216,76,9);
      rounded(c,'#fcdfbf',35,53,68,44,8);rounded(c,'#fcdfbf',144,53,68,44,8);
      for(let i=0;i<2;i++){
        const x=68+i*109+Math.sin(t*1.9+i)*4;
        dot(c,x,73,18,i===0?'#bd9374':'#a1a9a4');
        dot(c,x-13,57,8,'#c49b77');dot(c,x+13,57,8,'#c49b77');
        dot(c,x-7,72,2,'#28313a');dot(c,x+7,72,2,'#28313a');
      }
      for(let i=0;i<4;i++)dot(c,115+i*8,103-Math.sin(t+i)*4,2,'#eaaeb0');
    }
  }else if(game.genre==='strategy'){
    paint(c,variant===1?'#172847':'#334b52',8,24,240,91);
    for(let i=0;i<10;i++)for(let j=0;j<4;j++){
      c.strokeStyle='#b6d2c12a';c.strokeRect(10+i*23+(j%2)*10,25+j*23,23,21);
    }
    for(let i=0;i<9;i++){
      const x=33+(i*59)%181, y=39+(i*19)%65;
      const pulse=(Math.sin(t*2+i*1.3)+1)*2;
      dot(c,x,y,6+pulse,i%3===0?'#f2b86f':variant===1?'#7cc5eb':'#96c69c');
      if(i>0){c.strokeStyle='#b8dbcc77';c.beginPath();c.moveTo(x,y);c.lineTo(33+((i-1)*59)%181,39+((i-1)*19)%65);c.stroke();}
    }
    rounded(c,'#1d3447dd',17,88,80,22,3);
    bar(c,26,100,57,(Math.sin(t*.5)+1)/2,'#f5d195');
    label(c,variant===1?'ОРБИТА':variant===2?'ТАКТИКА':'ИМПЕРИЯ',19,40,'#ecf4ee',8,true);
  }else if(game.genre==='racing'){
    paint(c,variant===2?'#abc9da':'#343b5e',8,24,240,91);
    if(variant!==2) {
      for(let i=0;i<6;i++){
        const x=8+i*44;
        paint(c,i%2?'#5e6f95':'#43527b',x,42,32,72);
      }
      paint(c,'#f5bb82',8,66,240,2);
    }
    c.fillStyle=variant===2?'#c8d6e1':'#3b3e50';c.beginPath();
    c.moveTo(82,48);c.lineTo(174,48);c.lineTo(248,115);c.lineTo(8,115);c.fill();
    for(let i=0;i<7;i++){
      const y=(t*40+i*31)%83+30, width=1+(y-25)/16;
      paint(c,'#ffefc7',127-width/2,y,width,Math.min(12,width*2));
    }
    const carX=128+Math.sin(t*1.8+variant)*27;
    rounded(c,variant===1?'#ee87d1':'#dce9ef',carX-21,87,42,17,6);
    rounded(c,'#4e698b',carX-13,82,26,12,4);
    for(let i=0;i<2;i++)rounded(c,'#161b2a',carX-16+i*26,99,7,6,2);
    rounded(c,'#102131b9',14,30,66,24,3);
    label(c,String(98+Math.round(Math.sin(t*3)*18+variant*28))+' KM/H',21,46,'#f5eee4',12,true);
  }else{
    paint(c,'#152536',8,24,240,91);
    for(let i=0;i<12;i++){
      const x=12+i*22,y=53+(i*31%27);
      paint(c,'#1c3f40',x,y,5,58);
      c.fillStyle='#24504e';c.beginPath();c.moveTo(x-10,y+12);c.lineTo(x+3,y-26);c.lineTo(x+17,y+12);c.fill();
    }
    const x=128+Math.sin(t*.8+variant)*40;
    const lantern=c.createRadialGradient(x,78,3,x,78,55);
    lantern.addColorStop(0,'#fff2bcaa');lantern.addColorStop(1,'#fff2bc00');
    paint(c,lantern as unknown as string,8,24,240,91);
    rounded(c,'#788c8a',x-15,91,28,14,2);
    dot(c,x,81,5,'#eef6da');
    if(Math.sin(t*2.7+variant)>.97)paint(c,'#cedbe038',8,24,240,91);
    label(c,'СИГНАЛ '+(Math.floor(t*2)%2?'…':'?'),20,42,'#d3e7d9',9,true);
  }
  paint(c,'#112538e8',8,115,240,14);
  label(c,game.icon+'  '+game.title,16,125,'#f0f6ff',10,true);
}

function workPicture(c:CanvasRenderingContext2D,scene:ComputerScene,t:number){
  if(scene.mode==='code'){
    paint(c,'#13243a',10,23,236,101);
    paint(c,'#233850',10,23,47,101);
    for(let i=0;i<6;i++)paint(c,i===Math.floor(t*.75)%6?'#60c7bb':'#597089',20,34+i*14,22,3);
    for(let j=0;j<8;j++){
      const y=32+j*11;
      label(c,String(j+1).padStart(2,'0'),62,y+1,'#6f94a8',7);
      paint(c,j%2?'#8fbddb':'#91d4bc',80,y-4,50+(j*23%68),4);
      paint(c,j%3?'#e4bf80':'#b8acd9',99,y+1,26+(j*19%49),3);
    }
    if(Math.floor(t*2)%3)paint(c,'#e8f6d0',90+(Math.floor(t*3)%12)*8,112,2,9);
    rounded(c,'#275951',166,102,69,16,3);
    label(c,'BUILD  ✓',176,113,'#c9f6df',9,true);
  }else if(scene.mode==='hair'){
    paint(c,'#f1e1d7',9,25,238,96);
    rounded(c,'#c98e9e',18,34,96,78,6);rounded(c,'#edd0c8',124,34,108,78,6);
    for(let i=0;i<8;i++){
      const x=43+i*6;
      c.strokeStyle=i%2?'#6d4c47':'#b77669';c.lineWidth=3;
      c.beginPath();c.moveTo(x,48);c.bezierCurveTo(x-6,67+Math.sin(t+i)*2,x+6,82,x,97);c.stroke();
    }
    label(c,'ДО / ПОСЛЕ',132,47,'#79556c',9,true);
    for(let i=0;i<4;i++)bar(c,131,58+i*11,83,(Math.sin(t*.9+i)+2)/3,'#af849b');
  }else if(scene.mode==='study'){
    paint(c,'#2c5c5b',10,23,236,101);
    for(let i=0;i<4;i++){
      rounded(c,'#f2e8c9',19+i*56,40,47,57,5);
      paint(c,i%2?'#89aa9b':'#bc8a8e',27+i*56,53,32,8);
      paint(c,'#c5c3af',26+i*56,69,29,4);
      paint(c,'#c5c3af',26+i*56,78,20,4);
    }
    bar(c,22,110,203,(Math.sin(t*.6)+1.8)/3,'#a8dfc3');
  }else if(scene.mode==='browser'){
    paint(c,'#edf4ed',9,24,238,101);rounded(c,'#b6cec9',18,33,218,15,5);
    label(c,'simlife.local / интернет',30,44,'#37586a',8);
    for(let i=0;i<3;i++){
      rounded(c,['#81acaa','#d5b296','#a2bdd5'][i],20+i*74,58,67,54,4);
      label(c,['ПОКУПКИ','ФИНАНСЫ','НОВОСТИ'][i],24+i*74,89,'#fff9df',8,true);
    }
  }else if(scene.mode==='mail'){
    paint(c,'#eaf1f2',9,23,238,100);label(c,'ВХОДЯЩИЕ • '+(2+Math.floor(t/3)%3),19,41,'#406778',11,true);
    for(let i=0;i<4;i++){
      rounded(c,i===Math.floor(t/4)%4?'#c1d6d8':'#dfe7e4',18,50+i*16,217,14,3);
      dot(c,28,57+i*16,3,i===0?'#b8788f':'#7aa1a3');
      paint(c,'#53747b',39,55+i*16,48+(i*17%27),3);
      paint(c,'#95abae',118,55+i*16,79-(i*13%33),3);
    }
  }else if(scene.mode==='notes'){
    paint(c,'#fff1d9',9,23,238,101);
    label(c,scene.role==='vlad'?'ПЛАН ПРОЕКТА':'ПЛАН НА ДЕНЬ',20,43,'#576d66',11,true);
    for(let i=0;i<5;i++){
      paint(c,'#c6bba3',37,56+i*13,177-(i*17%74),2);
      c.strokeStyle='#658874';c.lineWidth=1.5;
      c.strokeRect(19,52+i*13,9,9);
      if(i<=Math.floor(t/2)%5)label(c,'✓',19,60+i*13,'#628f78',9,true);
    }
  }else if(scene.mode==='video'){
    const clip=scene.clip??'pets';
    const dark=clip==='tech'?'#254b60':clip==='travel'?'#427b87':'#6b927d';
    paint(c,dark,9,23,238,101);
    dot(c,183,45,19,'#f0d6a9');
    for(let i=0;i<9;i++){
      const x=i*32,y=90+Math.sin(t*.6+i)*9;
      dot(c,x,y,20,clip==='pets'?'#315a46':clip==='travel'?'#86bdb4':'#294a67');
    }
    if(clip==='pets'){
      dot(c,115+Math.sin(t)*15,78,18,'#dab79d');
      dot(c,102+Math.sin(t)*15,61,7,'#dab79d');dot(c,126+Math.sin(t)*15,61,7,'#dab79d');
    }else if(clip==='tech'){
      rounded(c,'#152a3f',77,45,106,53,4);
      for(let i=0;i<4;i++)paint(c,'#90d4c0',85,55+i*9,65+(i*17%26),4);
    }
    rounded(c,'#132c39d9',10,104,236,23,2);
    label(c,clipTitles[clip],18,117,'#f1ece0',10,true);
    bar(c,87,115,144,(t%18)/18,'#d9b88e');
  }
}

export function drawComputerScene(c:CanvasRenderingContext2D,scene:ComputerScene,t:number):void {
  const realW=c.canvas.width,realH=c.canvas.height;
  c.save();c.setTransform(realW/W,0,0,realH/H,0,0);
  const dark=scene.role==='alina'?'#352d4e':'#17304a';
  const bg=c.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,dark);bg.addColorStop(1,scene.role==='alina'?'#745a79':'#2f5b70');
  paint(c,bg as unknown as string,0,0,W,H);
  const game=scene.mode==='game' && scene.game ? GAME_BY_ID.get(scene.game) : undefined;
  if(game)gamePicture(c,game,t);
  else if(scene.mode!=='idle')workPicture(c,scene,t);
  else{
    for(let i=0;i<7;i++){
      dot(c,33+i*37,42+Math.sin(t*.43+i)*6,12+(i%2)*3,scene.role==='alina'?'#a781b251':'#66b5c13a');
    }
    label(c,'Sim-Life OS',35,86,'#e4f3fa',19,true);
    label(c,scene.role==='vlad'?'Рабочий стол Влада':'Рабочий стол Алины',36,105,'#c5dbe6',9);
  }
  paint(c,'#0b1c2bd9',0,0,256,21);
  dot(c,12,11,4,scene.role==='alina'?'#e9aabc':'#8de1de');
  label(c,'Sim-Life OS',22,14,'#f3f6fa',9,true);
  const modeLabel=scene.mode==='game'?'ИГРЫ':scene.mode==='video'?'ВИДЕО':scene.mode==='code'?'РАЗРАБОТКА':
    scene.mode==='hair'?'КЛИЕНТЫ':scene.mode==='study'?'ОБУЧЕНИЕ':scene.mode==='browser'?'ИНТЕРНЕТ':
    scene.mode==='mail'?'ПОЧТА':scene.mode==='notes'?'ЗАМЕТКИ':'РАБОЧИЙ СТОЛ';
  label(c,modeLabel,175,14,'#c0d4dc',8);
  paint(c,'#122638ec',0,133,256,11);
  label(c,'✦',11,142,'#a4d4d1',9,true);
  label(c,scene.role==='vlad'?'Влад':'Алина',199,142,'#e4e8ee',8,true);
  c.restore();
}
