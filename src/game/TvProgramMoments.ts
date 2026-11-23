import type { Program } from '../shared/homeLife';

/** Extra story beats inside the EXISTING animated television.
 * A tiny 2D scene, never video streams or extra WebGL objects. All values are
 * deterministic from elapsed visual time so viewers see the same action.
 */
export function drawTvProgramMoment(
  c: CanvasRenderingContext2D, program: Program, seconds: number,
): void {
  const t=Math.max(0,seconds);
  const segment=Math.floor(t/8)%3;
  const dots=(x:number,y:number,r:number,color:string)=>{
    c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,2*Math.PI);c.fill();
  };
  const panel=(x:number,y:number,w:number,h:number,color:string)=>{
    c.fillStyle=color;c.fillRect(x,y,w,h);
  };
  c.save();
  if(program==='cooking'){
    // Three consecutive shots: vegetables -> pan -> plated dish.
    panel(34,85,188,8,'#d4ae89');
    panel(36,93,6,18,'#4b3435');panel(213,93,6,18,'#4b3435');
    if(segment===0){
      panel(70,78,112,8,'#694846');
      for(let i=0;i<7;i++)dots(84+i*14,75+Math.sin(t*2+i)*3,6,
        i%3?'#e39a51':'#7ba76b');
      const knifeX=91+Math.sin(t*4)*20;
      panel(knifeX,52,3,24,'#e2e5df');
    }else if(segment===1){
      c.fillStyle='#29353b';c.beginPath();c.ellipse(130,78,53,14,0,0,2*Math.PI);c.fill();
      panel(168,76,54,5,'#4a3435');
      for(let i=0;i<5;i++)dots(99+i*15,76+Math.sin(t*4+i)*3,7,i%2?'#e5b16c':'#91b76c');
      for(let i=0;i<3;i++){
        c.strokeStyle='#f9ecc180';c.lineWidth=2;c.beginPath();
        const x=108+i*23;c.moveTo(x,69);c.quadraticCurveTo(x+Math.sin(t+i)*5,54,x+5,47);c.stroke();
      }
    }else{
      dots(130,74,41,'#f9ecde');dots(130,74,30,'#d5ad78');
      for(let i=0;i<9;i++){
        const a=i*2.4;dots(130+Math.sin(a)*24,74+Math.cos(a)*19,4,i%2?'#b7614e':'#64875c');
      }
    }
    panel(12,27,105,12,'#fbebdccc');
    c.font='bold 9px system-ui';c.fillStyle='#574040';
    c.fillText(['Нарезка','На сковороде','Подача'][segment],20,36);
  }else if(program==='pets'){
    const x=91+Math.sin(t*1.3)*12,y=82+Math.sin(t*5)*2;
    // Ginger cat: ears and tail. Small Spitz: two bright eyes and wagging tail.
    dots(x,y,19,'#d58b51');dots(x-10,y-14,8,'#d58b51');dots(x+11,y-14,8,'#d58b51');
    dots(x-6,y-3,2,'#2f302f');dots(x+6,y-3,2,'#2f302f');
    dots(x,y+4,3,'#e7b898');
    c.strokeStyle='#dc9b5f';c.lineWidth=5;c.beginPath();
    c.moveTo(x+11,y+13);c.quadraticCurveTo(x+43,y-7,x+34,y-22+Math.sin(t*3)*4);c.stroke();
    const dogX=168+Math.sin(t*.9)*5;
    dots(dogX,83,21,'#47434b');dots(dogX-9,66,9,'#47434b');dots(dogX+10,66,9,'#47434b');
    dots(dogX-7,80,3,'#e4c996');dots(dogX+7,80,3,'#e4c996');
    dots(dogX,93,4,'#25232a');
    c.strokeStyle='#6b6269';c.lineWidth=6;c.beginPath();c.moveTo(dogX+15,99);
    c.quadraticCurveTo(dogX+28+Math.sin(t*9)*9,90,dogX+20,77);c.stroke();
  }else if(program==='tech'){
    panel(77,48,105,51,'#142838');
    const y=50+(Math.floor(t*4)%6)*6;
    for(let i=0;i<5;i++)panel(83,53+i*8,45+(i*23)%46,2,i%2?'#9addba':'#f0bd83');
    panel(81,y,3,6,'#f8e9b0');
    panel(95,95,8,4,'#54776c');
    panel(107,95,62*((t%10)/10),3,'#8fc9b5');
  }else if(program==='travel'){
    // Animated sea and a boat that glides rather than an unmoving wallpaper.
    panel(0,91,256,21,'#477e96');
    for(let i=0;i<8;i++){
      c.strokeStyle='#c2e6db77';c.lineWidth=2;c.beginPath();
      const x=(i*45+(t*13)%45)-25;
      c.moveTo(x,98+i%2*8);c.lineTo(x+21,98+i%2*8);c.stroke();
    }
    const x=75+(t*14)%130;
    panel(x,83,35,4,'#e4e1ce');panel(x+5,78,20,6,'#8f684e');
    panel(x+17,59,2,19,'#efdcb7');
    c.fillStyle='#fbdfb9';c.beginPath();c.moveTo(x+19,60);c.lineTo(x+19,77);c.lineTo(x+36,77);c.fill();
  }else if(program==='concert'){
    panel(26,83,206,26,'#2c263a');
    for(let i=0;i<4;i++){
      const x=45+i*55;
      c.strokeStyle=['#e8b0b5','#a6bfe9','#cba2e4','#efbd8e'][i];
      c.lineWidth=7;c.beginPath();c.moveTo(x,10);
      c.lineTo(x+Math.sin(t*1.6+i)*31,96);c.stroke();
    }
    const singerX=127+Math.sin(t*.7)*17;
    dots(singerX,58,11,'#d3a183');
    panel(singerX-11,68,22,33,'#51465d');
    panel(singerX+10,68,2,36,'#c8d1ce');
    dots(singerX+11,73,3,'#d5d7d3');
    for(let i=0;i<18;i++)dots(14+i*14,106+Math.sin(i+t*3)*2,3,i%3?'#b4a2d7':'#d6ab8f');
  }else if(program==='vlog'){
    panel(55,24,150,78,'#735e8d');
    panel(63,32,134,65,'#d9c2a9');
    const x=130+Math.sin(t*.52)*4;
    dots(x,53,18,'#e1ab88');panel(x-18,70,36,26,'#846889');
    dots(x-8,53,2,'#47383e');dots(x+8,53,2,'#47383e');
    panel(70,36,12,3,'#df727f');
    c.fillStyle='#fce6e4';c.font='bold 9px system-ui';c.fillText('REC',85,40);
    panel(80,91,95,3,'#f7eddc');
  }else if(program==='comedy'){
    // Spoken punchline: brief comic reaction is synchronized to the shot.
    if(segment===2){
      for(let i=0;i<4;i++)dots(164+i*13,39+Math.sin(t*2+i)*3,3,'#ffe2a3');
      panel(98,23,91,13,'#fff3d2bb');
      c.fillStyle='#58454a';c.font='bold 9px system-ui';c.fillText('Ну вот опять!',104,33);
    }
  }else if(program==='romance'){
    for(let i=0;i<4;i++){
      const x=94+i*15;
      dots(x,28+Math.sin(t*1.4+i)*4,2.5,'#f4d9c0');
    }
  }else if(program==='crime'){
    panel(122,32,91,55,'#d5cdaf');
    for(let i=0;i<5;i++){
      dots(141+i*12,46+(i*11)%29,4,i%2?'#a34b43':'#536778');
      if(i>0){c.strokeStyle='#a45858';c.lineWidth=1;c.beginPath();
      c.moveTo(141+(i-1)*12,46+((i-1)*11)%29);
      c.lineTo(141+i*12,46+(i*11)%29);c.stroke();}
    }
  }else if(program==='action'){
    // Headlights on a moving car rather than perpetual horizontal streaks only.
    const x=(t*53)%300-35;
    panel(x,87,57,12,'#202a32');panel(x+9,81,32,9,'#4c6e78');
    dots(x+11,99,6,'#191c23');dots(x+44,99,6,'#191c23');
    panel(x+51,87,7,3,'#f9e6a4');
  }
  c.restore();
}
