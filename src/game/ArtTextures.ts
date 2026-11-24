import { paintedMap } from './ArtKit';

/** Fumed oak parquet. The two slats interlock on a diagonal lattice.
 * Draw the grain in each slat's own axes so end grain never crosses a joint. */
export function oakFloor() {
  return paintedMap('oak-floor', 640, 512, ctx => {
    ctx.fillStyle = '#83644e';
    ctx.fillRect(0,0,640,512);
    const tones = ['#bc956b','#c9a47c','#aa815b','#d0ad83','#b88b61','#c6a077'];
    const length=72, width=16;
    function stave(x:number,y:number,angle:number,seed:number) {
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(angle);
      ctx.fillStyle=tones[seed%tones.length];
      ctx.fillRect(.45,.4,length-.9,width-.8);
      ctx.fillStyle='#f3dfbc54';
      ctx.fillRect(.6,.6,length-1.4,.75);
      for(let line=0;line<6;line++){
        const v=1.5+line*2.3, bend=Math.sin(seed+line)*2;
        ctx.beginPath();ctx.moveTo(1,v);
        ctx.bezierCurveTo(22,v+bend,49,v-bend,71,v+.5);
        ctx.strokeStyle=line%2?'#f3d6ad62':'#78523855';
        ctx.lineWidth=.65;ctx.stroke();
      }
      ctx.restore();
    }
    ctx.save();ctx.translate(320,256);ctx.rotate(-Math.PI/4);
    for(let i=-5;i<=5;i++)for(let j=-26;j<=26;j++) {
      const x=i*length-j*width, y=i*length+j*width;
      const seed=Math.abs(i*227+j*53+(j*i)%23);
      stave(x,y,0,seed);
      stave(x+length+width,y,Math.PI/2,seed+17);
    }
    ctx.restore();
    const bounce=ctx.createRadialGradient(145,55,4,145,55,260);
    bounce.addColorStop(0,'#ffe2ac43');bounce.addColorStop(1,'#ffe2ac00');
    ctx.fillStyle=bounce;ctx.fillRect(0,0,640,512);
  });
}

export function upholsteryWeave() {
  return paintedMap('upholstery-weave', 128, 128, (ctx) => {
    ctx.fillStyle = '#f5f2ea';
    ctx.fillRect(0, 0, 128, 128);
    // Broken twill: diagonal ribs reverse every eight yarns.
    for(let y=0;y<128;y+=2)for(let x=0;x<128;x+=2){
      const warp=Math.floor(x/16)%2===0?x+y:x-y;
      ctx.fillStyle=warp%8===0?'#a29a88':warp%4===0?'#d2cab8':'#fff8ec';
      ctx.fillRect(x,y,2,1.5);
    }
  });
}

export function gardenView() {
  return paintedMap('garden', 512, 256, (ctx) => {
    const sky = ctx.createLinearGradient(0, 0, 0, 220);
    sky.addColorStop(0, '#6d9ead');
    sky.addColorStop(0.44, '#a8c6c1');
    sky.addColorStop(1, '#eee1bd');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 512, 256);
    const haze = ctx.createRadialGradient(355, 69, 7, 355, 69, 131);
    haze.addColorStop(0, '#ffe6acbb');
    haze.addColorStop(1, '#ffe6ac00');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#fff1c8';
    ctx.beginPath();
    ctx.arc(355, 69, 22, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y, rx] of [[55, 67, 64], [188, 80, 47], [438, 105, 50]]) {
      const cloud = ctx.createLinearGradient(0, y - 10, 0, y + 9);
      cloud.addColorStop(0, '#fff1d563');
      cloud.addColorStop(1, '#e3ded50b');
      ctx.fillStyle = cloud;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, 11, -0.026, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [top, bottom, ridge, valley] of [
      ['#aeb7a3', '#bbc4b0', 47, 172], ['#729684', '#a2b294', 83, 210],
      ['#567e6d', '#8ba48a', 117, 238], ['#6c915f', '#a3ab71', 161, 278],
    ] as const) {
      const slope = ctx.createLinearGradient(0, ridge, 0, 256);
      slope.addColorStop(0, top);
      slope.addColorStop(1, bottom);
      ctx.fillStyle = slope;
      ctx.beginPath();
      ctx.moveTo(0, ridge + 63);
      ctx.bezierCurveTo(104, ridge - 12, 229, valley + 13, 318, (ridge + valley) / 2 + 31);
      ctx.bezierCurveTo(386, ridge + 26, 432, ridge + 38, 512, ridge + 71);
      ctx.lineTo(512, 256);
      ctx.lineTo(0, 256);
      ctx.fill();
    }
    for (let i = 0; i < 32; i++) {
      const x = (i * 97) % 512;
      const y = 226 + (i * 13) % 26;
      ctx.fillStyle = i % 2 ? '#69866350' : '#cfcb9160';
      ctx.beginPath();
      ctx.ellipse(x, y, 9 + i % 10, 2 + i % 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [x, y, size] of [[68, 231, 82], [119, 248, 51], [426, 262, 72], [491, 249, 118]]) {
      ctx.fillStyle = '#3d624f';
      ctx.fillRect(x - 2, y - size, 4, size);
      for (let layer = 0; layer < 3; layer++) {
        const top = y - size + layer * size * 0.15;
        const halfWidth = size * (0.16 + layer * 0.07);
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x + halfWidth, top + size * 0.47);
        ctx.lineTo(x - halfWidth, top + size * 0.47);
        ctx.fill();
      }
    }
  });
}

export function botanicalPrint() {
  return paintedMap('botanical', 128, 160, (ctx) => {
    ctx.fillStyle = '#f3dfbc';
    ctx.fillRect(0, 0, 128, 160);
    ctx.fillStyle = '#ca765c';
    ctx.beginPath();
    ctx.arc(89, 49, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#526f5c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(42, 130);
    ctx.quadraticCurveTo(72, 104, 57, 44);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    for (let i = 0; i < 5; i++) {
      const side = i % 2 ? 1 : -1;
      ctx.beginPath();
      ctx.ellipse(60 + side * 13, 54 + i * 13, 18, 6, -side * 0.58, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function wovenRug(style: 'living' | 'work' | 'sleep') {
  return paintedMap('rug-' + style, 256, 256, (ctx) => {
    const palette = {
      living: ['#a36963', '#bd8e79', '#e8bea0'],
      work: ['#638077', '#819b89', '#c5bd9f'],
      sleep: ['#bfaa91', '#d1b99e', '#e4d2b4'],
    }[style];
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, 256, 256);
    for (const width of [11, 20, 35]) {
      ctx.lineWidth = width === 20 ? 4 : 2;
      ctx.strokeStyle = width === 20 ? palette[2] : palette[1];
      ctx.strokeRect(width, width, 256 - width * 2, 256 - width * 2);
    }
    // Paired indigo/madder rosettes framed by a wandering woven vine.
    function rosette(x:number,y:number,r:number) {
      ctx.save();ctx.translate(x,y);
      for(let j=0;j<8;j++){
        ctx.rotate(Math.PI/4);
        ctx.fillStyle=palette[2];ctx.beginPath();ctx.ellipse(0,-r*.55,r*.17,r*.42,0,0,Math.PI*2);ctx.fill();
      }
      ctx.fillStyle=palette[0];ctx.beginPath();ctx.arc(0,0,r*.16,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    rosette(128,128,43);
    for(const x of [63,193])for(const y of [64,192])rosette(x,y,18);
    ctx.strokeStyle=palette[1];ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(128,44);
    for(const [cx,cy,x,y] of [[140,84,208,128],[159,145,128,212],[114,169,48,128],[99,100,128,44]])
      ctx.quadraticCurveTo(cx,cy,x,y);
    ctx.stroke();    ctx.fillStyle = '#fff2d214';
    for (let y = 1; y < 256; y += 4) ctx.fillRect(0, y, 256, 1);
  });
}

export function kitchenTiles() {
  return paintedMap('tile', 512, 96, (ctx) => {
    ctx.fillStyle='#cec0a0';ctx.fillRect(0,0,512,96);
    const glaze=['#6b9188','#89a69a','#73998f','#a2b4a2','#789b91'];
    // Overlapping fish-scale tiles. Two glaze bands follow each rounded edge.
    for(let row=6;row>=-2;row--)for(let col=-1;col<=17;col++){
      const x=col*32+(row%2)*16,y=row*17;
      ctx.beginPath();ctx.moveTo(x-16,y-9);ctx.lineTo(x-16,y);ctx.arc(x,y,16,Math.PI,0,true);ctx.lineTo(x+16,y-9);ctx.closePath();
      ctx.fillStyle=glaze[Math.abs(row*13+col*7+col*row)%5];ctx.fill();
      ctx.strokeStyle='#e3d3b1';ctx.lineWidth=1.4;ctx.stroke();
      ctx.beginPath();ctx.arc(x,y,12,.12,Math.PI-.12);ctx.lineWidth=.9;
      ctx.strokeStyle='#c7d6be';ctx.stroke();
    }
  });
}


export function tvStill() {
  return paintedMap('tv-still', 256, 144, (ctx) => {
    ctx.fillStyle = '#304e5a';
    ctx.fillRect(0, 0, 256, 144);
    ctx.fillStyle = '#edaf86';
    ctx.beginPath();
    ctx.arc(167, 57, 25, 0, Math.PI * 2);
    ctx.fill();
    for (const [color, edge] of [['#6c8c85', 91], ['#355e60', 115]] as const) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, edge);
      ctx.bezierCurveTo(72, edge - 72, 128, edge + 24, 256, edge - 37);
      ctx.lineTo(256, 144);
      ctx.lineTo(0, 144);
      ctx.fill();
    }
    ctx.fillStyle = '#f5d2a5';
    for (const [x, y] of [[32, 29], [51, 53], [111, 23], [222, 46], [232, 20]]) {
      ctx.fillRect(x, y, 2, 2);
    }
  });
}

export function deskDisplay() {
  return paintedMap('desk-display', 256, 160, (ctx) => {
    ctx.fillStyle = '#213c42';
    ctx.fillRect(0, 0, 256, 160);
    ctx.fillStyle = '#354f52';
    ctx.fillRect(0, 0, 256, 17);
    ctx.fillRect(0, 17, 49, 143);
    ctx.fillStyle = '#203339';
    ctx.fillRect(49, 127, 207, 33);
    for (let i = 0; i < 11; i++) {
      const x = 62 + [0, 10, 20, 20, 10][i % 5];
      const y = 28 + i * 8;
      ctx.fillStyle = ['#d6a17c', '#8dbba4', '#e1ce9a'][i % 3];
      ctx.fillRect(x, y, 23 - i % 4 * 3, 2);
      ctx.fillStyle = '#73969a';
      ctx.fillRect(x + 30, y, 56 + i % 5 * 12, 2);
    }
    ctx.fillStyle = '#a8c4a4';
    ctx.fillRect(60, 138, 48, 2);
    ctx.fillRect(65, 146, 76, 2);
  });
}

export function limewashWall(){
  return paintedMap('limewash-and-dado',256,256,ctx=>{
    const wash=ctx.createLinearGradient(0,0,0,256);
    wash.addColorStop(0,'#e5d5b9');wash.addColorStop(.56,'#decaad');wash.addColorStop(1,'#ceb796');
    ctx.fillStyle=wash;ctx.fillRect(0,0,256,256);
    // Soft brush marks visible only at close range.
    for(let n=0;n<96;n++){
      const x=(n*83)%256,y=(n*43)%256;
      ctx.strokeStyle=n%2?'#fff1d817':'#b59e8010';ctx.lineWidth=2+n%5;
      ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+10,y-2,x+21,y-8);ctx.stroke();
    }
    ctx.fillStyle='#8f9b83';ctx.fillRect(0,174,256,82);
    for(let x=0;x<256;x+=16){
      ctx.fillStyle='#72866e';ctx.fillRect(x,174,1.4,82);
      ctx.fillStyle='#b6bf9f';ctx.fillRect(x+1.4,174,1,82);
    }
    ctx.fillStyle='#af997d';ctx.fillRect(0,169,256,5);
    ctx.fillStyle='#f2dfc0';ctx.fillRect(0,169,256,1.5);
    ctx.fillStyle='#eeddc3';ctx.fillRect(0,5,256,2);
  });
}
