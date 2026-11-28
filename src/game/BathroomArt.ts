import * as THREE from 'three';
import {coveringById} from '../shared/renovation';
import { BATH_FIXTURES, type BathFixture } from '../shared/home';
import { colors as C, cube, drum, finish, orb, paintedMap, panel, plane, softCube, batchRigidParts, finishSurface, type XYZ } from './ArtKit';

const porcelain = 0xf4ede2;
const glaze = 0xa5c6ba;
const chrome = 0x9caeac;

function part(root: THREE.Group, size: XYZ, position: XYZ, color: number,
  material: 'ceramic' | 'metal' | 'wood' | 'fabric' = 'ceramic',
  geometry: THREE.BufferGeometry = softCube) {
  const mesh = new THREE.Mesh(geometry, finish(color, material));
  mesh.position.set(...position);
  mesh.scale.set(...size);
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function tap(root: THREE.Group, x: number, y: number, z: number): void {
  part(root, [.042, .19, .042], [x, y + .09, z], chrome, 'metal', drum);
  part(root, [.047, .036, .16], [x, y + .17, z + .055], chrome, 'metal');
  part(root, [.14, .025, .036], [x, y + .15, z - .034], chrome, 'metal');
}

function toilet(root: THREE.Group,design=0,color=porcelain): void {
  root.rotation.y = Math.PI / 2;
  if(design===2){part(root,[.49,.18,.52],[0,.31,-.02],color);part(root,[.25,.12,.26],[0,.33,.14],color,'ceramic',orb);}
  else if(design===1||design===3)part(root,design===1?[.46,.38,.49]:[.23,.19,.245],[0,.20,.025],color,'ceramic',design===1?softCube:orb);
  else if(design===4){part(root,[.48,.31,.50],[0,.225,.07],color);part(root,[.52,.055,.55],[0,.037,.07],color);}
  else part(root, [.52, .37, .55], [0, .195, .07], color);
  part(root, [.33, .16, .46], [0, .332, .19], design===3?0x434a4b:porcelain, 'ceramic', orb);
  part(root, [.325, .068, .405], [0, .462, .176], design===3?0x555e60:porcelain, 'ceramic', orb);
  part(root, [.237, .016, .309], [0, .526, .19], design===3?0x778484:0xc9d9cb, 'ceramic', orb);
  part(root, [.21, .012, .26], [0, .539, .21], glaze, 'ceramic', orb);
  if(design===2){part(root,[.48,.46,.17],[0,.54,-.34],color);part(root,[.21,.085,.025],[0,.80,-.24],chrome,'metal');}
  else{part(root, [design===1?.49:.60, design===3?.48:.61, .23], [0, design===3?.51:.571, -.34], color);
  part(root, [design===1?.52:.63, .082, .28], [0, design===3?.77:.89, -.34], color);
  part(root, [.062, .018, .045], [.15, design===3?.819:.939, -.29], design===4?0xb39765:chrome, 'metal');}
  part(root, [.64, .016, .23], [0, .024, .57], 0xb38672, 'fabric');
}

function showerTileMap(){
 return paintedMap('bath-shower-tile-061',256,384,ctx=>{
  ctx.fillStyle='#809a90';ctx.fillRect(0,0,256,384);
  const tones=['#c9dbd1','#b9d1c5','#d6e0d3','#aac5b9'];
  for(let row=0;row<8;row++)for(let col=-1;col<5;col++){
   const x=col*64+(row%2)*32,y=row*48;
   const g=ctx.createLinearGradient(0,y+1,0,y+47);
   g.addColorStop(0,'#e1e9dc');g.addColorStop(.14,tones[(row*3+col+4)%4]);g.addColorStop(1,'#a8bfb2');
   ctx.fillStyle=g;ctx.fillRect(x+1,y+1,62,46);
   ctx.fillStyle='#f6f7ea55';ctx.fillRect(x+2,y+2,60,1);
  }
  ctx.fillStyle='#78998e';ctx.fillRect(0,142,256,5);
  ctx.fillStyle='#e3e7d5';ctx.fillRect(0,143,256,1);
 });
}
function shower(root: THREE.Group,design=0,color=0xacc4b7): void {
  const frame=design===1?0x353c3b:design===2?chrome:design===3?0xa78a60:design===4?0x718c8d:C.pine;
  part(root, [1.47, .078, 1.40], [0, .032, 0], porcelain);
  part(root, [1.32, .016, 1.23], [0, .074, 0], glaze, 'ceramic', cube);
  part(root, [.13, .010, .13], [.38, .083, .28], chrome, 'metal', drum);
  const glass = new THREE.MeshBasicMaterial({
    color: design===2?0xd9f3f5:0xb2d0c2, transparent: true, opacity: design===2?.11:.21, depthWrite: false, side: THREE.DoubleSide,
  });
  for (const z of [-.66, .66]) {
    const pane = new THREE.Mesh(plane, glass);
    pane.position.set(0, .99, z);
    pane.scale.set(1.41, 1.84, 1);
    root.add(pane);
    part(root, [1.43, design===2?.032:.076, .050], [0, 2.0, z], frame, 'metal');
    if(design!==2)part(root, [.052, 1.96, .051], [-.70, 1.03, z], frame, 'metal');
    part(root, [.052, 1.96, .051], [.70, 1.03, z], frame, 'metal');
    if(design===1)part(root,[1.38,.032,.038],[0,1.10,z],frame,'metal');
  }
  part(root, [.06, 2.02, 1.37], [.70, 1.05, 0], color, 'ceramic', cube);
  // One textured insert, inside the existing enclosure and behind the mixer.
  const tile=panel(root,[.666,1.05,0],[1.35,1.99],design===3?paintedMap('shower-travertine',128,128,ctx=>{ctx.fillStyle='#c9ae88';ctx.fillRect(0,0,128,128);for(let i=0;i<20;i++){ctx.strokeStyle=i%2?'#e7d7bb':'#a48c6a';ctx.beginPath();ctx.moveTo(0,i*7);ctx.bezierCurveTo(40,i*7-4,85,i*7+4,128,i*7);ctx.stroke();}}):design===4?null:showerTileMap(),design===3?0xd0b798:design===4?0x9caeac:0xb9d1c5);
  tile.rotation.y=-Math.PI/2;
  for(const z of [-.63,.63])part(root,[.015,2,.022],[.655,1.05,z],chrome,'metal',cube);
  part(root, [.031, 1.36, .031], [.62, 1.49, .16], chrome, 'metal', drum);
  part(root, [.29, .036, .034], [.50, 2.15, .16], chrome, 'metal');
  part(root, [design===4?.26:.14, .036, design===4?.26:.14], [.36, 2.12, .16], frame, 'metal', design===4?cube:drum);
  // Rain head: dark nozzle plate and shallow chrome rim, above the standing rig.
  part(root,design===4?[.248,.008,.248]:[.133,.008,.133],[.36,2.098,.16],0x526761,'metal',design===4?cube:drum);
  const nozzleGrid=design===4?[-.09,-.045,0,.045,.09]:[-.065,0,.065];
  for(const x of nozzleGrid)for(const z of nozzleGrid)
    part(root,[.011,.008,.011],[.36+x,2.092,.16+z],chrome,'metal',drum);
  part(root, [.043, .076, .076], [.596, 1.06, .16], C.pine, 'metal');
  part(root, [.18, design===3?.065:.047, .34], [.59, 1.26, -.34], design===3?0xd4c0a3:porcelain);
  part(root, [.085, .15, .085], [.57, 1.36, -.38], C.clay, 'ceramic', drum);
  part(root,[.065,.12,.065],[.57,1.34,-.23],0x88a7a1,'ceramic',drum);
}

function roundedRectangle(path: THREE.Path, w: number, d: number, radius: number): void {
  const x = w / 2, y = d / 2;
  path.moveTo(-x + radius, -y);
  path.lineTo(x - radius, -y);
  path.quadraticCurveTo(x, -y, x, -y + radius);
  path.lineTo(x, y - radius);
  path.quadraticCurveTo(x, y, x - radius, y);
  path.lineTo(-x + radius, y);
  path.quadraticCurveTo(-x, y, -x, y - radius);
  path.lineTo(-x, -y + radius);
  path.quadraticCurveTo(-x, -y, -x + radius, -y);
}

function bathtub(root: THREE.Group,design=0,color=porcelain): void {
  const shell = new THREE.Shape();
  roundedRectangle(shell, 1.28, 2.12, design===1?.38:design===3?.10:design===4?.35:.28);
  const inside = new THREE.Path();
  roundedRectangle(inside, 1.00, 1.78, .26); // identical interior clearance, water and dog bath anchors
  shell.holes.push(inside);
  const rim = new THREE.ExtrudeGeometry(shell, { depth: .55, bevelEnabled: true,
    bevelSize: .024, bevelThickness: .026, bevelSegments: 1, curveSegments: 4 });
  rim.rotateX(-Math.PI / 2);
  part(root, [1, 1, 1], [0, .09, 0], design===3?color:porcelain, 'ceramic', rim);
  if(design===2)for(const side of [-1,1])for(let i=0;i<9;i++)part(root,[.024,.36,.175],[side*.64,.30,(i-4)*.20],i%2?0x9c7655:color,'wood');
  if(design===4)for(const x of [-.46,.46])for(const z of [-.72,.72])part(root,[.075,.06,.085],[x,.10,z],0xb39765,'metal',orb);
  const waterOutline = new THREE.Shape();
  roundedRectangle(waterOutline, 1.015, 1.795, .25);
  const water = new THREE.ShapeGeometry(waterOutline, 4);
  water.rotateX(-Math.PI / 2);
  part(root, [1, 1, 1], [0, .41, 0], glaze, 'ceramic', water);
  tap(root, -.31, .66, -.87);
  part(root, [.31, .067, .25], [.54, .66, .80], 0xcba889, 'fabric');
  part(root, [.28, .059, .29], [.48, .72, .78], C.paper, 'fabric');
  part(root,[.23,.008,.027],[.48,.752,.86],0xc3a78c,'fabric',cube);
}

function basin(root: THREE.Group,design=0,color:number=C.pine): void {
  if(design===2){part(root,[1.17,.43,.61],[0,.53,0],color,'wood');}
  else if(design===4){part(root,[.30,.68,.27],[0,.398,-.04],color,'ceramic',drum);}
  else part(root, [1.17, .69, .61], [0, .398, 0], color, 'wood');
  if(design!==4)for (const x of [-.282, .282]) {
    part(root, [.54, design===2?.32:.49, .039], [x, design===2?.53:.416, .313], design===0?C.sage:color, 'wood');
    part(root, [.105, .026, .04], [x, .537, .351], design===3?chrome:C.brass, 'metal');
  }
  if(design===1)for(let i=0;i<9;i++)part(root,[.024,.44,.017],[(i-4)*.12,.41,.337],0x8c6b4c,'wood');
  if(design===3)for(const y of [.27,.43,.59])part(root,[1.07,.014,.025],[0,y,.345],0x303638,'metal');
  part(root, [1.23, .094, .67], [0, .785, .005], porcelain);
  part(root, [.335, .135, .238], [0, .843, .041], porcelain, 'ceramic', orb);
  part(root, [.258, .020, .169], [0, .971, .053], glaze, 'ceramic', orb);
  part(root, [.036, .011, .036], [0, .992, .052], chrome, 'metal', drum);
  tap(root, 0, .921, -.19);
  const reflection = paintedMap('bathroom-mirror', 64, 64, ctx => {
    const gradient = ctx.createLinearGradient(5, 4, 58, 64);
    gradient.addColorStop(0, '#f4f2dc');
    gradient.addColorStop(.44, '#b5cac2');
    gradient.addColorStop(.53, '#d5e1d5');
    gradient.addColorStop(1, '#a2bcb7');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  });
  part(root, [1.00, .89, .053], [0, 1.662, -.277], design===3?0x41494b:C.walnut, 'wood');
  panel(root, [0, 1.662, -.247], [.91, .80], reflection, glaze, .18);
  part(root, [.52, .043, .052], [0, 2.16, -.21], C.paper);
  // A slim brushed-metal mirror frame and folded towel on the existing vanity.
  for(const side of [-1,1])part(root,[.026,.80,.022],[side*.455,1.662,-.224],chrome,'metal',cube);
  part(root,[.20,.032,.15],[-.43,.85,.12],0xb4a191,'fabric');
  part(root, [.104, .154, .10], [.46, .906, -.12], C.clay);
  part(root,[.036,.04,.036],[.46,1.001,-.12],chrome,'metal',drum);
  part(root,[.072,.022,.028],[.478,1.026,-.12],chrome,'metal',cube);
  // Toothbrush cup stays at the back edge, clear of the shared wash target.
  part(root,[.073,.115,.073],[-.44,.89,-.13],0x88a7a1,'ceramic',drum);
  for(const [x,color] of [[-.467,C.paper],[-.414,C.pine]]){
    part(root,[.022,.18,.022],[x,1.02,-.13],color,'ceramic',cube);
    part(root,[.028,.051,.035],[x,1.095,-.112],porcelain,'ceramic',cube);
  }
}

function wcBasin(root: THREE.Group,design=0,color=0x819d92): void {
  if(design===1)part(root,[.54,.48,.36],[0,.51,-.08],color,'wood');
  else if(design===3)part(root,[.57,.35,.32],[0,.67,-.10],color,'ceramic');
  else if(design===4)part(root,[.22,.65,.22],[0,.36,-.04],color,'ceramic',drum);
  else part(root, [.65, design===2?.29:.34, design===2?.14:.12], [0, .73, -.206], color, 'wood');
  part(root, [.35, .13, .246], [0, .83, .017], 0xb1c7b9, 'ceramic', orb);
  part(root, [.355, .094, .243], [0, .886, .017], porcelain, 'ceramic', orb);
  part(root, [.254, .019, .170], [0, .966, .059], glaze, 'ceramic', orb);
  part(root, [.027, .009, .027], [0, .989, .058], chrome, 'metal', drum);
  tap(root, 0, .923, -.17);
  part(root, [.11, .04, .078], [.246, .958, -.056], 0xd3a07c);
  const mirror = part(root, [.242, .284, .046], [0, 1.52, -.237], C.oat, 'wood', orb);
  mirror.rotation.z = .035;
  part(root, [.208, .241, .019], [0, 1.52, -.199], 0xb1c8bf, 'metal', orb);
  part(root, [.056, .17, .038], [.273, .726, .04], C.paper);
}

const builders = { toilet, shower, bathtub, basin, wcBasin };

export function buildBathFixture(id: BathFixture,sku?:string): THREE.Group {
  const root = new THREE.Group();
  const { x, z } = BATH_FIXTURES[id].center;
  root.position.set(x, 0, z);
  const p=coveringById(sku);if(p?.fixture===id)builders[id](root,p.design,p.color);else builders[id](root);
  root.userData.fixture=id;root.userData.sku=p?.fixture===id?p.id:null;
  const owned=new Set<THREE.Material>();root.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material)&&!finishSurface(o.material))owned.add(o.material);});root.userData.ownedMaterials=[...owned];
  return root;
}
const sharedBathGeometry=new Set<THREE.BufferGeometry>([cube,drum,orb,plane,softCube]);
export function batchBathFixture(root:THREE.Group){const before=new Set<THREE.BufferGeometry>(),after=new Set<THREE.BufferGeometry>();root.traverse(o=>{if(o instanceof THREE.Mesh)before.add(o.geometry);});batchRigidParts(root,true);root.traverse(o=>{if(o instanceof THREE.Mesh)after.add(o.geometry);});for(const g of before)if(!sharedBathGeometry.has(g)&&!after.has(g))g.dispose();}
export function disposeBathMaterials(root:THREE.Group){for(const m of root.userData.ownedMaterials??[])m.dispose();}
