import { snowPreview } from './LandscapePalette';
import { landscapeRandom } from './LandscapePlants';

export type GroundArea = {x:number;z:number;w:number;d:number};
export type GroundPatch = GroundArea & { ink:[number,number,number]; opacity:number; border?:boolean; flecks?:[number,number,number] };

const green = ['#bfce8c', '#91b172', '#5d925e', '#e1cf8c', '#4b7955'];
const straw = ['#9da56d', '#758758', '#536f4d'];

export function paintGround(ctx: CanvasRenderingContext2D, area: GroundArea, patches: readonly GroundPatch[],
  seed: number, style: 'lawn' | 'meadow' = 'meadow') {
  const {width, height} = ctx.canvas;
  const random = landscapeRandom(seed);
  const [sx, sz] = [width / area.w,height / area.d];
  const px = (x:number) => (x - area.x + area.w / 2) * sx;
  const pz = (z:number) => (z - area.z + area.d / 2) * sz;
  ctx.fillStyle = style === 'meadow' ? '#80a566' : '#86a65e';
  ctx.fillRect(0,0,width,height);

  function field(x:number,z:number,w:number,d:number,ink:[number,number,number],opacity:number,edge=.22) {
    ctx.save();
    ctx.translate(x,z);
    ctx.scale(w,d);
    const fill = ctx.createRadialGradient(0,0,edge,0,0,1);
    fill.addColorStop(0,`rgba(${ink.join(',')},${opacity})`);
    fill.addColorStop(.68,`rgba(${ink.join(',')},${opacity * .68})`);
    fill.addColorStop(1,`rgba(${ink.join(',')},0)`);
    ctx.fillStyle=fill;
    ctx.fillRect(-1,-1,2,2);
    ctx.restore();
  }

  const wash: [number,number,number][] = [[67,126,71],[182,201,119],[84,121,59],[213,193,123]];
  for (let i=0;i<120;i++) {
    field(random()*width,random()*height,width*(.026+random()*.11),height*(.028+random()*.09),wash[i%4],.12+random()*.29);
  }
  for (const patch of patches) {
    const x=px(patch.x),z=pz(patch.z),w=patch.w*sx/2,d=patch.d*sz/2;
    field(x,z,w,d,patch.ink,patch.opacity,patch.border?.70:.08);
    if(patch.flecks){
      ctx.fillStyle=`rgb(${patch.flecks.join(',')})`;
      for(let i=0;i<24;i++){
        const angle=i*2.39996,radius=.9*Math.sqrt(random()),s=.65+random()*.85;
        ctx.globalAlpha=.24+random()*.28;
        ctx.fillRect(x+Math.sin(angle)*radius*w,z+Math.cos(angle)*radius*d,s*1.15,s);
      }
      ctx.globalAlpha=1;
    }
  }
  if (style === 'lawn') {
    ctx.save();
    ctx.globalAlpha=.07;
    for (let x=0;x<width;x+=Math.max(6,sx*.52)) {
      ctx.fillStyle='#e4d6a2';
      ctx.fillRect(x,0,sx*.26,height);
    }
    ctx.restore();
  }

  // Brush marks are baked into the ground; 3D blades are reserved for the foreground.
  // Extra tonal brush variation replaces the repeated smooth lawn look
  // without spending any additional per-frame WebGL work.
  const count = Math.round(width*height*.075);
  const size = Math.max(.54,Math.min(sx,sz)*.051);
  for (let i=0;i<count;i++) {
    const x=random()*width,z=random()*height;
    ctx.strokeStyle=green[i%green.length];
    ctx.globalAlpha=.20+random()*.32;
    ctx.lineWidth=.53+size*.42;
    ctx.beginPath();
    ctx.moveTo(x-size*.56,z+size*.67);
    ctx.quadraticCurveTo(x-size*.41,z-size*.29,x+size*(random()-.36),z-size*(.31+random()*1.31));
    ctx.stroke();
  }
  for (let i=0;i<count*.23;i++) {
    ctx.fillStyle=straw[i%3];
    ctx.globalAlpha=.12+random()*.12;
    ctx.fillRect(random()*width,random()*height,size*(.50+random()),size*.60);
  }
  ctx.globalAlpha=1;
  if(snowPreview()){
    ctx.fillStyle='#e0eaf1db';ctx.fillRect(0,0,width,height);
    for(let i=0;i<72;i++)field(random()*width,random()*height,width*(.025+random()*.11),height*(.03+random()*.1),i%3?[249,250,248]:[158,181,196],.20+random()*.33);
  }
}

/** Dust and sunken joints are painted once. Coordinates refer to the ground
 * canvas, allowing a crossing to share the same surface as its paths. */
export function limestone(ctx:CanvasRenderingContext2D, x:number, y:number, width:number, height:number,
  stoneWidth:number, stoneHeight:number, seed:number) {
  const random=landscapeRandom(seed);
  const tones=['#c4ae94','#d1bda2','#c6b298','#d6c3a7','#beab93','#cebaa0'];
  ctx.save();ctx.beginPath();ctx.rect(x,y,width,height);ctx.clip();
  ctx.fillStyle='#9f927d';ctx.fillRect(x,y,width,height);
  for(let row=0;row*stoneHeight<height;row++){
    let left=x-(row%2)*stoneWidth*.57;
    const top=y+row*stoneHeight, bottom=top+stoneHeight-.8;
    while(left<x+width){
      const span=stoneWidth*(.68+random()*.62);
      const chip=.5+random()*1.8;
      ctx.beginPath();ctx.moveTo(left+chip,top+.55);
      ctx.lineTo(left+span-1.4,top+.8);ctx.lineTo(left+span-.6,top+chip+.7);
      ctx.lineTo(left+span-1,bottom-.3);ctx.lineTo(left+1.4,bottom);
      ctx.lineTo(left+.65,bottom-chip);ctx.closePath();
      ctx.fillStyle=tones[Math.floor(random()*tones.length)];ctx.fill();
      ctx.strokeStyle='#f4e3c763';ctx.lineWidth=.75;
      ctx.beginPath();ctx.moveTo(left+1,top+chip);ctx.lineTo(left+chip,top+1);
      ctx.lineTo(left+span-2,top+1.2);ctx.stroke();
      for(let grain=0;grain<8;grain++){
        ctx.fillStyle=grain%2?'#8f786a22':'#fff2d438';
        ctx.fillRect(left+random()*span,top+random()*stoneHeight,1+random()*2,.7);
      }
      left+=span;
    }
  }
  if(snowPreview()){const frost=ctx.createLinearGradient(x,y,x+width,y+height);frost.addColorStop(0,'#e3edf4a0');frost.addColorStop(.5,'#eff4f52e');frost.addColorStop(1,'#c9dbe5a0');ctx.fillStyle=frost;ctx.fillRect(x,y,width,height);}
  ctx.restore();
}

/** Several broad penumbras build one broken pool of shade, fixed to the plant's base. */
export function canopyShade(ctx:CanvasRenderingContext2D, area:GroundArea,x:number,z:number,radius:number,seed:number) {
  const rng=landscapeRandom(seed), sx=ctx.canvas.width/area.w, sz=ctx.canvas.height/area.d;
  ctx.save();
  ctx.translate((x-area.x+area.w/2)*sx,(z-area.z+area.d/2)*sz);
  ctx.scale(sx*radius,sz*radius);
  for(let i=0;i<14;i++){
    const a=rng()*Math.PI*2, r=Math.sqrt(rng())*.80;
    const dx=.20+Math.cos(a)*r, dz=-.10+Math.sin(a)*r*.70, size=.28+rng()*.39;
    const gradient=ctx.createRadialGradient(dx,dz,0,dx,dz,size);
    gradient.addColorStop(0,'rgba(32,49,39,.25)');
    gradient.addColorStop(.58,'rgba(41,58,45,.15)');
    gradient.addColorStop(1,'rgba(55,70,54,0)');
    ctx.fillStyle=gradient;ctx.fillRect(dx-size,dz-size,size*2,size*2);
  }
  ctx.restore();
}
