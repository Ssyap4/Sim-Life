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
  ctx.fillStyle = style === 'meadow' ? '#8ca875' : '#91ad75';
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

  const wash: [number,number,number][] = [[104,153,96],[181,193,125],[108,125,77],[202,180,113]];
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
  const count = Math.round(width*height*.058);
  const size = Math.max(.54,Math.min(sx,sz)*.051);
  for (let i=0;i<count;i++) {
    const x=random()*width,z=random()*height;
    ctx.strokeStyle=green[i%green.length];
    ctx.globalAlpha=.13+random()*.28;
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
}
