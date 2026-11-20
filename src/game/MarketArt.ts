import * as THREE from 'three';
import { batchRigidParts, colors as C, type XYZ } from './ArtKit';
import { CASHIER_SPOT } from '../shared/locationLayout';
import { STATIONS, type Station } from '../shared/locations';
import { bud, lettering, paintContactShade, part, paving, round, shortCylinder, smallOrb, trim, type LocationResources } from './LocationArt';

type Display = 'cold' | 'baked' | 'produce' | 'packages' | 'bottles' | 'meat' | 'ready' | 'pet';
const displays: Record<string, { kind: Display; palette: number[]; frame: number; sign: [string,string] }> = {
  dairy: {kind:'cold',palette:[0xe5cfaa,0x9cbbad,0xa6b8b7,0x9a908b],frame:0x659188,sign:['#deebe1','#3f645e']},
  bakery: {kind:'baked',palette:[0xd7a362,0xc5864d,0xd9ac6c,0xbe8356],frame:0xae7953,sign:['#f6e0b6','#764b33']},
  meat: {kind:'meat',palette:[0xb9726b,0xaa615e,0xc18a75,0xc27974],frame:0x956a6a,sign:['#efdbd3','#6e4648']},
  produce: {kind:'produce',palette:[0xbda75c,0xc97859,0xd79a58,0x709572],frame:0x678571,sign:['#e4ead0','#44604c']},
  pantry: {kind:'packages',palette:[0xc29969,0x7f9a89,0xa8746e,0xceac69],frame:0x9f8869,sign:['#f0e3c6','#68583f']},
  drinks: {kind:'bottles',palette:[0x819f9f,0xc6a168,0xb47d76,0x7a9e8a],frame:0x6c8c91,sign:['#d9e8e5','#376168']},
  ready: {kind:'ready',palette:[0xd7ad82,0xa49777,0x9bada1,0xc3836b],frame:0xc0876d,sign:['#f1dbc4','#754a41']},
  'pet-shelf': {kind:'pet',palette:[0x98a387,0xc2a16c,0xa4899d,0x81a3a5],frame:0x8c8095,sign:['#ece2e8','#68566d']},
};

function labelOnBox(root: THREE.Group, x: number, y: number, z: number, w: number, h: number, ink: number) {
  part(root,[w,h,.008],[x,y,z],0xf1dec0);
  part(root,[w*.53,h*.20,.009],[x,y+.002,z+.004],ink);
}

function groceries(root: THREE.Group, kind: Display, row: number, tones: number[], base: number) {
  for(let i=0;i<5;i++) {
    const x=(i-2)*.294;
    const color=tones[(i+row)%tones.length];
    if (kind==='baked' || kind==='produce') {
      for(const z of [-.065,.134]) {
        const loaf=kind==='baked';
        const y=base+(loaf ? .077 : .082);
        const item=part(root,loaf ? [.120,.071,.085] : [.080,.078,.073],
          [x,y,z],color,loaf ? smallOrb : bud);
        item.rotation.y=i*.53;
        if (loaf) {
          for(const offset of [-.042,.026]) {
            const score=part(root,[.014,.008,.088],[x+offset,y+.058,z],0xe9b874);
            score.rotation.y=.44;
          }
        } else {
          part(root,[.014,.043,.018],[x+.009,y+.079,z],0x557562);
        }
      }
    } else if (kind==='cold' || kind==='bottles') {
      const bottle=kind==='bottles' || row===2;
      const height=kind==='cold' && row===0 ? .14 : .24+(i%2)*.045;
      const y=base+height/2;
      part(root,bottle ? [.075,height,.075] : [.148,height,.157],[x,y,.075],color,bottle ? shortCylinder : undefined);
      if (bottle) {
        part(root,[.041,.07,.041],[x,base+height+.018,.075],color,shortCylinder);
        part(root,[.048,.034,.048],[x,base+height+.055,.075],i%2 ? 0x4b7661 : C.paper,shortCylinder);
      } else {
        part(root,[.13,.04,.15],[x,base+height+.012,.075],0xf0ddbb);
      }
      labelOnBox(root,x,y,.155,.099,.071,kind==='cold' ? 0x72998f : color);
    } else if (kind==='meat' || kind==='ready') {
      const takeout=kind==='ready';
      trim(root,[.253,.07,.214],[x,base+.046,.081],takeout ? color : 0x614f51);
      if(takeout) {
        part(root,[.243,.054,.20],[x,base+.106,.081],0xe9d5b3);
        part(root,[.064,.010,.213],[x-.033,base+.136,.082],color);
      } else {
        part(root,[.093,.047,.078],[x-.011,base+.097,.083],color,smallOrb);
        part(root,[.135,.011,.034],[x+.012,base+.137,.13],0xf4e4c8);
      }
    } else {
      const bag=kind==='pet' || (row+i)%3!==1;
      const height=.18+(i%2)*.08;
      const z=.089;
      if (bag) {
        trim(root,[.172,height,.151],[x,base+height/2,z],color);
        part(root,[.157,.019,.114],[x,base+height+.011,z],0xdac29d);
      } else {
        part(root,[.075,height,.075],[x,base+height/2,z],color,shortCylinder);
        part(root,[.077,.018,.077],[x,base+height+.006,z],0xe5cda6,shortCylinder);
      }
      labelOnBox(root,x,base+height*.53,.168,.113,.072,color);
    }
  }
}

function shelf(station: Station, resources: LocationResources): THREE.Group {
  const root = new THREE.Group();
  root.position.set(station.center.x,0,station.center.z);
  const {kind,palette,frame,sign}=displays[station.id];
  const w=station.width,d=station.depth;
  const wall=station.center.z< -3;
  const tall=wall ? 1.64 : 1.37;
  const back=kind==='cold'||kind==='meat' ? 0x91aca0 : 0xb59b7a;
  const levels=wall ? [.27,.66,1.07] : kind==='produce' ? [.35,.76] : [.29,.68];
  trim(root,[w,.15,d],[0,.098,0],0x596f62);
  part(root,[w-.034,tall-.19,.058],[0,tall/2+.015,-d*.40],back);
  for (const x of [-w/2+.043,w/2-.043]) {
    trim(root,[.071,tall-.13,d],[x,tall/2+.031,0],frame);
    part(root,[.031,tall-.13,.024],[x,tall/2+.031,d*.502],0xd9c4a1);
  }
  for(const [row,base] of levels.entries()){
    trim(root,[w-.095,.072,d-.046],[0,base,0],kind==='produce' ? 0xa08061 : frame);
    part(root,[w-.067,.061,.036],[0,base+.018,d*.489],0xd1b788);
    for(let i=0;i<5;i++) {
      const x=(i-2)*.294;
      part(root,[.141,.031,.008],[x,base+.019,d*.52],C.paper);
      part(root,[.035,.011,.008],[x+.023,base+.019,d*.528],0x89947c);
    }
    groceries(root,kind,row,palette,base+.047);
  }
  trim(root,[w,.12,d],[0,tall-.013,-.003],frame);
  part(root,[w-.095,.035,.025],[0,tall-.036,d*.51],0xe4c79b);
  const signWidth=station.id==='produce'?1.79:1.66;
  const title=lettering(root,resources,[0,tall+.128,.32],signWidth,.29,station.name,sign);
  title.rotation.x=-.24;
  batchRigidParts(root,true);
  return root;
}

function checkout(station: Station, resources: LocationResources): THREE.Group {
  const group=new THREE.Group();
  group.position.set(station.center.x,0,station.center.z);
  trim(group,[1.60,.85,.74],[0,.45,0],0x536f64);
  trim(group,[1.73,.11,.82],[0,.921,0],0xe0c29b);
  trim(group,[1.19,.10,.33],[.16,.986,.13],0x3d5051);
  part(group,[1.14,.016,.25],[.158,1.036,.122],0x526461);
  for(let i=0;i<8;i++) part(group,[.012,.009,.245],[i*.145-.34,1.047,.122],0x62746d);
  for(const x of [-.67,.67]) trim(group,[.087,.68,.024],[x,.46,.384],0x8ca292);
  part(group,[1.45,.082,.057],[0,.159,.379],0x374d46);

  round(group,.057,.15,[-.51,1.03,-.121],0x3c5150);
  const monitor=trim(group,[.53,.30,.086],[-.511,1.23,-.15],0x364b4c);
  monitor.rotation.x=-.19;
  part(group,[.454,.231,.014],[-.511,1.233,-.102],0x83a9a4).rotation.x=-.19;
  const terminal=trim(group,[.18,.071,.214],[.57,1.06,.287],0x445b58);
  terminal.rotation.x=-.12;
  part(group,[.124,.021,.063],[.57,1.098,.239],0xa2c3aa);
  for(const x of [.533,.581,.625]) part(group,[.023,.011,.027],[x,1.10,.307],x>.62 ? 0xbb9468 : 0xc1c6a9);
  const tag=lettering(group,resources,[0,.563,.417],1.01,.267,'КАССА',['#ead5ad','#3c5a4c']);
  tag.rotation.x=-.12;
  batchRigidParts(group,true);
  return group;
}

function sculptFace(group: THREE.Group, skin = 0xbd896d) {
  // A tapered jaw, hair cap and separate lids make the face readable at shop scale.
  const outline = [[.004,-.239],[.074,-.226],[.121,-.178],[.163,-.115],[.185,-.029],
    [.183,.087],[.159,.164],[.114,.216],[.037,.237],[.004,.241]];
  const head = new THREE.LatheGeometry(outline.map(([radius,y])=>new THREE.Vector2(radius,y)),22);
  part(group,[1,1,.93],[0,1.595,.049],skin,head);
  for(const side of [-1,1]){
    const x = side*.080;
    part(group,[.031,.060,.028],[side*.180,1.571,.063],skin,smallOrb);
    part(group,[.014,.019,.012],[side*.188,1.537,.081],0xd2ac74,smallOrb);
    part(group,[.047,.023,.019],[x,1.603,.192],0xf4e2c8,smallOrb).rotation.y=side*.22;
    part(group,[.019,.0195,.010],[x+.005,1.604,.208],0x526c60,smallOrb);
    part(group,[.0085,.014,.004],[x+.007,1.604,.217],0x382c29,smallOrb);
    part(group,[.0047,.0054,.003],[x+.003,1.611,.218],0xffedd4,smallOrb);
    part(group,[.041,.009,.013],[x,1.651,.197],0x513731,smallOrb).rotation.z=side*-.14;
    part(group,[.038,.026,.023],[side*.122,1.553,.176],0xc38572,smallOrb).rotation.y=side*.26;
  }
  part(group,[.027,.037,.038],[0,1.570,.217],skin,smallOrb);
  const middle=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.042,1.506,.192),
    new THREE.Vector3(.006,1.484,.25),new THREE.Vector3(.047,1.509,.190));
  part(group,[1,1,1],[0,0,0],0x86554d,new THREE.TubeGeometry(middle,8,.0055,5,false));

  const points: number[]=[];
  const faces: number[]=[];
  const ribs = 24, rings=9;
  for(let row=0;row<=rings;row++) for(let side=0;side<=ribs;side++){
    const angle=side*Math.PI*2/ribs;
    const edge=1.47-.49*Math.cos(angle)+.12*Math.sin(angle);
    const phase=.013+(edge-.013)*row/rings;
    const r=Math.sin(phase);
    points.push(r*Math.sin(angle)*.213, 1.622+Math.cos(phase)*.254, .049+r*Math.cos(angle)*.209);
    if(row<rings && side<ribs){
      const a=row*(ribs+1)+side, b=a+ribs+1;
      faces.push(a,b,a+1,b,b+1,a+1);
    }
  }
  const hair=new THREE.BufferGeometry();
  hair.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  hair.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(points.length/3*2),2));
  hair.setIndex(faces);
  hair.computeVertexNormals();
  part(group,[1,1,1],[0,0,0],0x49322d,hair);
  const sweep=part(group,[.117,.042,.106],[-.055,1.817,.130],0x563930,smallOrb);
  sweep.rotation.z=-.37;
  part(group,[.104,.18,.107],[.022,1.574,-.099],0x52372c,smallOrb);
  part(group,[.116,.044,.091],[0,1.485,-.096],0x7a8873,smallOrb);
}

export function marketCashier(resources: LocationResources, costume?: { title: string; color: number; animated?: boolean; skin?: number; shirt?: number }) {
  const group=new THREE.Group();
  group.name=costume?.title ?? 'Cashier';
  group.position.set(CASHIER_SPOT.x,0,CASHIER_SPOT.z);
  group.rotation.y=-.13;
  const shirt=costume?.shirt ?? 0xd7c9a8, apron=costume?.color ?? 0x496e61, skin=costume?.skin ?? 0xbd896d;
  for(const x of [-.098,.098]){
    trim(group,[.151,.72,.162],[x,.404,.010],0x424d4b);
    trim(group,[.179,.106,.239],[x,.071,.046],0x33443d);
  }
  trim(group,[.347,.475,.236],[0,1.068,0],shirt);
  part(group,[.069,.177,.061],[0,1.321,.029],skin,shortCylinder);
  trim(group,[.289,.42,.075],[0,1.02,.129],apron);
  for(const x of [-.119,.119]) {
    const strap=trim(group,[.044,.211,.030],[x,1.208,.115],apron);
    strap.rotation.z=x*.44;
  }
  trim(group,[.120,.066,.018],[.077,1.16,.174],0xe7cfac);
  part(group,[.016,.026,.008],[.040,1.163,.184],0xb39362);
  part(group,[.069,.010,.008],[.078,1.164,.185],0x799584);
  const arms: THREE.Group[] = [];
  for(const side of [-1,1]){
    const arm = costume?.animated ? new THREE.Group() : group;
    const pivot = costume?.animated ? 1.17 : 0;
    part(arm,[.102,.122,.095],[side*.182,1.171-pivot,.001],shirt,smallOrb).rotation.z=side*.24;
    part(arm,[.060,.115,.055],[side*.239,1.046-pivot,.057],skin,smallOrb).rotation.x=-.38;
    part(arm,[.059,.065,.138],[side*.208,.958-pivot,.158],skin,smallOrb).rotation.y=side*-.46;
    part(arm,[.049,.039,.068],[side*.172,.934-pivot,.274],skin,smallOrb).rotation.y=side*-.58;
    if (costume?.animated) { arm.position.y = pivot; arms.push(arm); }
  }
  if (costume?.animated) {
    const head = new THREE.Group();
    const face = new THREE.Group();
    sculptFace(face,skin);
    batchRigidParts(face,true);
    face.position.y=-1.51;
    head.position.y=1.51;
    head.add(face);
    batchRigidParts(group,true);
    for (const arm of arms) batchRigidParts(arm,true);
    group.add(head,...arms);
    group.userData.motion = { head, arms };
  } else {
    sculptFace(group);
    batchRigidParts(group,true);
  }
  lettering(group,resources,[0,2.017,.055],costume ? 1.29 : .69,.186,costume?.title ?? 'Кассир',['#fcf0d6','#3d594c'],undefined,true);
  return group;
}

function tileGrid(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle='#d7cbb6';
  ctx.fillRect(-7,-6,14,12);
  const tones=['#e2d8c4','#e9dfc8','#dfd4c0','#e5dac5'];
  for(let row=0;row<18;row++) for(let col=0;col<22;col++){
    const x=-6.5+.60*col,z=-5.4+.60*row;
    ctx.fillStyle=tones[(col*17+row*11+col*row)%tones.length];
    ctx.fillRect(x+.012,z+.012,.576,.576);
  }
  ctx.fillStyle='#96a89b';
  ctx.fillRect(-5.98,-4.86,11.94,.14);
  ctx.fillRect(-5.97,-4.84,.13,9.73);
  ctx.fillRect(5.85,-4.84,.13,9.73);
  ctx.fillStyle='#d1d8be';
  ctx.fillRect(-1.03,2.34,2.06,1.24);
  ctx.strokeStyle='#839482';
  ctx.lineWidth=.041;
  ctx.strokeRect(-1.03,2.34,2.06,1.24);
  ctx.fillStyle='#7e9383';
  for(const z of [2.77,3.15]){
    ctx.beginPath();ctx.moveTo(-.125,z);ctx.lineTo(0,z-.09);ctx.lineTo(.125,z);ctx.lineTo(0,z+.09);ctx.fill();
  }
  for (const {center, width, depth} of STATIONS.market) {
    paintContactShade(ctx,center.x,center.z+.06,width*.72,depth*.87);
  }
}

export function buildMarket(floor: THREE.Group, resources: LocationResources) {
  trim(floor,[12.3,.40,10.3],[0,-.223,0],0x746b58);
  paving(floor,resources,12.08,10.04,0,tileGrid,0xe5d8c2);
  part(floor,[12.16,2.92,.18],[0,1.46,-5.002],0xc4d3bb);
  part(floor,[.18,2.92,10.10],[-6.04,1.46,0],0xc5cdb5);
  part(floor,[12.16,.62,.038],[0,.41,-4.899],0x91a997);
  part(floor,[.046,.62,10.12],[-5.935,.41,0],0x90a696);
  for(const y of [.115,.75,2.56,2.89]){
    part(floor,[12.15,.074,.12],[0,y,-4.89],0xd8bc94);
    part(floor,[.12,.074,10.10],[-5.93,y,0],0xd8bc94);
  }
  for(const x of [-4.14,4.14]){
    trim(floor,[2.37,.62,.11],[x,2.213,-4.871],0x8da998);
    part(floor,[2.20,.48,.027],[x,2.22,-4.803],0xb4cfbe);
    for(const dx of [-.37,.37]) part(floor,[.041,.48,.035],[x+dx,2.22,-4.786],0xe8d4ac);
    part(floor,[2.34,.057,.15],[x,1.916,-4.847],0xe8d4ac);
  }
  lettering(floor,resources,[0,2.26,-4.868],2.79,.52,'Лавка у площади',['#335f52','#fff0cd'],'Продукты и свежая выпечка');
}

function marketExit(station: Station, resources: LocationResources): THREE.Group {
  const group = new THREE.Group();
  group.position.set(station.center.x,0,station.center.z);
  trim(group,[1.21,2.21,.23],[0,1.105,0],0xd4ba92);
  trim(group,[.99,1.98,.14],[0,1.02,-.072],0x557669);
  for (const x of [-.238,.238]) {
    trim(group,[.383,.59,.038],[x,1.43,-.151],0xacbeb0);
    part(group,[.386,.045,.026],[x,1.16,-.177],0xd4ba92);
  }
  part(group,[.65,.044,.055],[0,.934,-.164],0xceaa78);
  trim(group,[1.27,.079,.48],[0,.051,-.11],0xc7ba9f);
  lettering(group,resources,[0,2.31,-.123],1.15,.25,'ВЫХОД',['#406557','#f4e5c7']).rotation.y = Math.PI;
  batchRigidParts(group,true);
  return group;
}

export function marketStation(station: Station, resources: LocationResources): THREE.Group | null {
  if (station.action.kind==='shelf') return shelf(station,resources);
  if (station.action.kind==='checkout') return checkout(station,resources);
  if (station.action.kind==='door') return marketExit(station,resources);
  return null;
}

export const marketOutline: XYZ[] = [[-5.37,1.58,-3.62],[5.37,1.58,-3.62],[-5.54,0,3.61],[5.54,0,3.61]];
