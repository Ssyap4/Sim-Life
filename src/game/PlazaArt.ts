import * as THREE from 'three';
import { batchRigidParts, colors as C, torus, type XYZ } from './ArtKit';
import { PLAZA_BEDS, PLAZA_FOUNTAIN, PLAZA_TREES } from '../shared/locationLayout';
import type { Station } from '../shared/locations';
import { bud, lettering, paintContactShade, part, paving, round, shortCylinder, smallOrb, trim, type LocationResources } from './LocationArt';

const paths = '#d6c5ab';
const warmStone = 0xe3d1aa;

function pavement(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#a6ad85';
  ctx.fillRect(-8, -8, 16, 15);
  ctx.fillStyle = paths;
  ctx.beginPath();
  ctx.roundRect(-6.62, -4.09, 13.24, 8.85, .62);
  ctx.fill();
  ctx.save();
  ctx.clip();
  const tones = ['#d1bfa5', '#dbcbb1', '#d6c4aa', '#deccb4', '#cbbca7'];
  for (let row = 0; row < 29; row++) for (let col = 0; col < 28; col++) {
    ctx.fillStyle = tones[(row * 13 + col * 7 + row * col) % tones.length];
    ctx.fillRect(-6.9 + .55 * col + row % 2 * .275, -4.2 + .32 * row, .534, .305);
  }
  ctx.strokeStyle = '#eee0c6';
  ctx.lineWidth = .065;
  ctx.strokeRect(-6.10, -3.67, 12.20, 7.94);
  ctx.strokeStyle = '#b38973';
  ctx.lineWidth = .025;
  ctx.strokeRect(-5.97, -3.53, 11.94, 7.66);
  ctx.restore();

  ctx.strokeStyle = '#c0aa90';
  ctx.lineWidth = .16;
  const routes = [[-3.88,-3.92,-3.88,-2.16],[.11,-3.92,.11,-2.16],[4.10,-3.92,4.10,-2.16],
    [-3.88,-2.16,4.10,-2.16],[4.55,-2.16,4.55,2.48],[-2.8,2.48,4.55,2.48],
    [-2.8,2.48,-2.8,-2.16],[.04,2.48,.04,4.50]];
  for (const [x,z,endX,endZ] of routes) {
    ctx.beginPath();
    ctx.moveTo(x,z);
    ctx.lineTo(endX,endZ);
    ctx.stroke();
  }
  const {x,z} = PLAZA_FOUNTAIN;
  ctx.fillStyle = '#ead7bb';
  ctx.beginPath();
  ctx.arc(x,z,2.13,0,Math.PI*2);
  ctx.fill();
  for (const [radius,width,color] of [[2.03,.045,'#b78975'],[1.86,.018,'#ba9d86'],[1.46,.035,'#c5a98d']] as const) {
    ctx.strokeStyle=color;
    ctx.lineWidth=width;
    ctx.beginPath();ctx.arc(x,z,radius,0,Math.PI*2);ctx.stroke();
  }
  for(let n=0;n<24;n++){
    const angle=n*Math.PI/12;
    ctx.beginPath();
    ctx.moveTo(x+Math.cos(angle)*1.86,z+Math.sin(angle)*1.86);
    ctx.lineTo(x+Math.cos(angle)*2.03,z+Math.sin(angle)*2.03);
    ctx.stroke();
  }
  paintContactShade(ctx, x+.07, z+.13, 1.68, 1.66);
  for (const bed of PLAZA_BEDS) paintContactShade(ctx, bed.x, bed.z+.10, bed.width*.70, bed.depth*.74);
  for (const tree of PLAZA_TREES) paintContactShade(ctx, tree.x, tree.z+.08, .69, .65);
}

function archWindow(group: THREE.Group, x: number, y: number, z: number, width: number, height: number, frame: number) {
  trim(group,[width+.11,height+.12,.085],[x,y,z],frame);
  part(group,[width,height,.050],[x,y,z+.054],0x587c82);
  for(const offset of [-.17,.17]) {
    part(group,[width*.28,height*.86,.013],[x+offset*width,y+.008,z+.085],offset<0 ? 0x9bb6ad : 0xaac2b2);
  }
  part(group,[width+.17,.071,.16],[x,y-height/2-.066,z+.063],frame);
}

function entrance(group: THREE.Group, color: number, height = 1.95, width = 1.06) {
  trim(group,[width+.21,height+.21,.28],[0,height*.51,0],0xf1ddba);
  trim(group,[width,height,.14],[0,height*.51,.095],color);
  const top = height*.66;
  for (const x of [-width*.23,width*.23]) part(group,[width*.37,height*.29,.026],[x,top,.176],0x95b7af);
  part(group,[.064,.16,.05],[width*.31,height*.41,.188],C.brass);
  part(group,[width+.25,.073,.49],[0,.043,.15],warmStone);
}

function gable(group: THREE.Group, w: number, h: number, y: number, front: number, depth: number, fill: number, tile: number) {
  const triangle = new THREE.Shape();
  triangle.moveTo(-w/2,0);triangle.lineTo(w/2,0);triangle.lineTo(0,h);triangle.closePath();
  const volume = new THREE.ExtrudeGeometry(triangle,{depth,bevelEnabled:false});
  part(group,[1,1,1],[0,y,front-depth],fill,volume);
  const slope = Math.atan2(h,w/2);
  const length = Math.hypot(w/2,h);
  for(const side of [-1,1]) {
    const roof=part(group,[length+.21,.12,depth+.24],[side*w/4,y+h/2+.065,front-depth/2],tile);
    roof.rotation.z=-side*slope;
    for(let n=1;n<5;n++){
      const seam=part(group,[.033,.014,depth+.26],
        [side*w/2*n/5,y+h*(1-n/5)+.137,front-depth/2],0xa46957);
      seam.rotation.z=-side*slope;
    }
  }
}

function townhouse(group: THREE.Group, resources: LocationResources) {
  const facade = 0xd5a488;
  trim(group,[3.15,2.60,1.72],[0,1.30,-.99],facade);
  part(group,[3.24,.28,1.76],[0,.17,-.96],0xb78471);
  gable(group,3.23,.88,2.56,-.08,1.86,0xeacbb0,0x9a5948);
  entrance(group,0x446d62,1.91,.92);
  for (const x of [-1.04,1.04]) {
    archWindow(group,x,1.42,-.104,.67,.98,0xf0d6b2);
    for(const side of [-1,1]) part(group,[.17,1.04,.06],[x+side*.45,1.42,-.01],0x70927c);
    trim(group,[.63,.20,.21],[x,.91,.085],0x9b654e);
    for(let i=0;i<3;i++) part(group,[.095,.12,.08],[x+(i-1)*.18,1.055,.11],i%2 ? 0xd58386 : 0xd8ae75, smallOrb);
  }
  part(group,[.43,.69,.44],[.86,2.92,-1.22],0xa97161);
  part(group,[.53,.09,.53],[.86,3.28,-1.22],0xe1b498);
  lettering(group,resources,[0,2.32,.027],1.36,.32,'Домой',['#f3dbad','#463d37']);
}

function storefront(group: THREE.Group, resources: LocationResources) {
  trim(group,[3.60,2.62,1.66],[0,1.31,-.97],0x69958a);
  part(group,[3.72,.25,1.76],[0,2.59,-.92],0x365f5b);
  part(group,[3.83,.075,1.81],[0,2.75,-.92],0xe0c6a1);
  part(group,[3.62,.23,1.68],[0,.16,-.93],0x365f5b);
  entrance(group,0x2d5655,1.80,1.01);
  for (const x of [-1.12,1.12]) {
    archWindow(group,x,1.25,-.129,.95,1.09,0xe2c7a1);
    for(let i=0;i<3;i++) part(group,[.21,.12+i*.06,.021],[x+(i-1)*.24,.82+i*.03,-.018],
      [0xd9a762,0xa76d54,0x6d9771][i]);
    part(group,[.94,.044,.026],[x,1.28,-.015],0x476f66);
  }
  trim(group,[3.34,.075,.57],[0,2.073,.045],0x416f63).rotation.x=.11;
  for(const x of [-1.43,1.43]) part(group,[.062,.19,.065],[x,1.99,-.065],C.brass);
  lettering(group,resources,[0,2.44,-.039],2.94,.43,'СУПЕРМАРКЕТ',['#244c45','#fff0cc']);
}

function cafeFront(group: THREE.Group, resources: LocationResources) {
  trim(group,[3.16,2.72,1.72],[0,1.36,-1.00],0xcaa09b);
  part(group,[3.40,.14,1.79],[0,2.71,-.98],0x795a64);
  part(group,[3.32,.13,1.73],[0,2.52,-.98],0xefd3b1);
  part(group,[3.18,.24,1.73],[0,.16,-.98],0xaa776f);
  entrance(group,0x78494e,1.83,.86);
  archWindow(group,-.98,1.31,-.115,.65,1.09,0xeecdae);
  archWindow(group,.99,1.31,-.115,.65,1.09,0xeecdae);
  for(let n=0;n<10;n++){
    const x=(n-4.5)*.247;
    const tint=n%2 ? 0xf1dcb6 : 0x997080;
    const canopy=part(group,[.249,.052,.54],[x,2.11,.14],tint);
    canopy.rotation.x=.24;
    trim(group,[.246,.15,.053],[x,1.989,.40],tint);
  }
  lettering(group,resources,[0,2.38,-.025],2.46,.32,'Кафе «Тёплый угол»',['#f5dfbf','#703e4b']);
}

function parkGate(group: THREE.Group, resources: LocationResources) {
  for(const x of [-1.08,1.08]) {
    trim(group,[.44,.21,.50],[x,.11,-.055],warmStone);
    part(group,[.17,2.43,.18],[x,1.24,-.052],0x654e39);
    part(group,[.27,.09,.26],[x,2.49,-.052],0xad8460);
    part(group,[.36,.32,.34],[x,.65,-.39],0x416b58,smallOrb);
  }
  part(group,[2.58,.15,.32],[0,2.32,-.041],0x654e39);
  for(let n=0;n<8;n++)
    part(group,[.17,.07,.64],[(n-3.5)*.32,2.48,-.066],0xa07857);
  lettering(group,resources,[0,2.09,.163],1.75,.37,'Сосновый парк',['#e4dfad','#335847']);
  part(group,[1.48,.07,.42],[0,.052,.13],warmStone);
}

export function plazaEntrance(station: Station, resources: LocationResources) {
  const group=new THREE.Group();
  group.position.set(station.center.x,0,station.center.z);
  if(station.id==='street-home') townhouse(group,resources);
  else if(station.id==='street-market') storefront(group,resources);
  else if(station.id==='street-cafe') cafeFront(group,resources);
  else if(station.id==='street-education') {
    group.rotation.y = Math.PI / 2;
    trim(group, [2.58, 2.51, .87], [0, 1.28, -.49], 0x9fb7b1);
    trim(group, [2.72, .18, 1.00], [0, 2.57, -.46], 0x527378);
    entrance(group, 0x496e68, 1.77, .91);
    for (const x of [-.85, .85]) archWindow(group, x, 1.29, .02, .40, .81, warmStone);
    lettering(group, resources, [0, 2.17, .057], 2.18, .36, 'ПОТЕНЦИАЛ', ['#365c5b','#f5e1b9']);
  }
  else parkGate(group,resources);
  batchRigidParts(group,true);
  return group;
}

function greenery(group: THREE.Group) {
  const flowers=[0xe6a989,0xbb8497,0xe7c273,0xf3dbaf];
  for(const [index,bed] of PLAZA_BEDS.entries()){
    const {x,z,width,depth}=bed;
    trim(group,[width,.19,depth],[x,.108,z],0xb88772);
    trim(group,[width-.14,.082,depth-.13],[x,.21,z],0x725543);
    const count = Math.round(width * 6);
    for(let i=0;i<count;i++) {
      const px=x+(i/(count-1)-.5)*(width-.37);
      const pz=z+Math.sin(i*7.2)*(.27*depth);
      const y=.33+.043*Math.sin(i*2.5);
      part(group,[.117,.14,.093],[px,y-.032,pz],i%2 ? 0x6f8a62 : 0x557c66,bud);
      const blossom=part(group,[.059,.036,.061],[px+.023,y+.098,pz],flowers[(i+index)%flowers.length],bud);
      blossom.rotation.z=Math.sin(i)*.55;
    }
  }
  for(const [index,tree] of PLAZA_TREES.entries()){
    const {x,z}=tree;
    round(group,.48,.19,[x,.101,z],0xae8673);
    round(group,.405,.04,[x,.206,z],0x79654a);
    part(group,[.082,1.90,.096],[x,1.04,z],0x7e5740,shortCylinder).rotation.z=.09;
    for (const [dx,y,dz,r] of [[0,2.08,0,.68],[-.34,1.95,.13,.44],[.36,2.16,-.15,.50],[.03,2.46,-.12,.52]]) {
      part(group,[r,r*.94,r*.82],[x+dx,y+index*.12,z+dz],dx<0 ? 0x668665 : dx>0 ? 0x85a074 : 0x719769,smallOrb);
    }
  }
  for(const [x,z] of [[-5.53,-.56],[4.41,3.83],[6.22,-.65]]){
    round(group,.127,.14,[x,.27,z],0x525d50);
    round(group,.031,1.21,[x,.93,z],0x485e57);
    trim(group,[.22,.25,.22],[x,1.63,z],0xf0daa2);
    trim(group,[.29,.081,.29],[x,1.79,z],0x485e57);
  }
}

function fountain(group: THREE.Group, resources: LocationResources) {
  const {x,z,radius}=PLAZA_FOUNTAIN;
  round(group,radius,.135,[x,.073,z],0xc6b190);
  round(group,radius-.075,.21,[x,.231,z],0xdfcaae);
  round(group,radius-.13,.042,[x,.354,z],0x76a8a2);
  const rim=part(group,[radius-.16, radius-.16, .72],[x,.376,z],0xeedac0,torus);
  rim.rotation.x=-Math.PI/2;
  for(let i=0;i<10;i++) {
    const angle=i*Math.PI/5;
    part(group,[.037,.15,.068],[x+Math.sin(angle)*(radius-.062),.24,z+Math.cos(angle)*(radius-.062)],0xe7d3b6).rotation.y=angle;
  }
  round(group,.32,.14,[x,.392,z],0xdcbe9c);
  round(group,.15,.55,[x,.64,z],0xe6c9a7);
  const bowl=new THREE.CylinderGeometry(.56,.25,.18,20);
  part(group,[1,1,1],[x,.84,z],0xf0d5b0,bowl);
  round(group,.52,.04,[x,.94,z],0x91b8ac);
  round(group,.136,.115,[x,1,z],0xc49e74);

  const lines: number[]=[];
  for (let i=0;i<7;i++) {
    const angle=i*2*Math.PI/7;
    for(let j=0;j<8;j++){
      for(const n of [j,j+1]) {
        const u=n/8,r=.056+u*.437;
        lines.push(Math.cos(angle)*r,1.01+Math.sin(Math.PI*u)*.34-u*.05,Math.sin(angle)*r);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
  const material = new THREE.LineBasicMaterial({color:0xc7e6dd,transparent:true,opacity:.78,depthWrite:false});
  resources.materials.push(material);
  const jets = new THREE.LineSegments(geometry,material);
  jets.name='Fountain streams';
  jets.position.set(x,0,z);
  group.add(jets);
  return (seconds: number) => {
    jets.rotation.y = seconds * .24;
    material.opacity = .76 + Math.sin(seconds * 3.2)*.12;
  };
}

export function buildPlaza(group: THREE.Group, resources: LocationResources) {
  trim(group,[14.75,.40,12.25],[0,-.222,-.53],0x776e59);
  paving(group,resources,14.51,12.06,-.53,pavement,0xcfbea4);
  greenery(group);
  const animate = fountain(group,resources);
  const boundary: XYZ[] = [[-6.65,0,3.3],[6.90,0,3.8],[-6.35,2.26,-3.95],[6.52,2.72,-3.90]];
  return { animate, boundary };
}
