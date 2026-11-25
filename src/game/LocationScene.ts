import * as THREE from 'three';
import { createShopToy } from './PetToys';
import { PET_TOYS } from '../shared/petToys';
import {FEEDING_MODELS} from '../shared/petFeeders';
import { PET_SHOP_FOOD } from '../shared/petShop';
import {buildConsoleModel} from './ConsoleArt';
import {CONSOLES} from '../shared/consoleCatalog';
import {buildSpeakerModel} from './SpeakerArt';
import {SPEAKER_MODELS,type SpeakerSku} from '../shared/speakerCatalog';
import {buildVacuumModel} from './VacuumArt';
import {VACUUM_MODELS,type VacuumSku} from '../shared/vacuumCatalog';
import { buildElectronicsModel } from './ElectronicsArt';
import { ELECTRONICS,electronicsFor } from '../shared/electronics';
import { PARK_TREES } from '../shared/park';
import { buildFurnishingModel } from './FurnishingArt';
import { batchRigidParts, colors as C, cube, drum, finish, orb, panel, plane, softCube, torus, type XYZ } from './ArtKit';
import { STATIONS, HOME_STATIONS, DISTRICT_STATIONS, type PlaceId, type Station } from '../shared/locations';
import { DISTRICT_OFFSET_Z } from '../shared/district';
import { locationGeometry, painted, lettering } from './LocationArt';
import { buildDistrict } from './DistrictArt';
import { addTufts, grassMaterial, growFlowers, growShrub, growTree, landscapeRandom, landscapeSharedGeometry, PlantBatch } from './LandscapePlants';
import {seasonalMaterial} from './SeasonalPalette';
import { canopyShade, limestone, paintGround, type GroundArea } from './LandscapeGround';
import { buildMarket, marketCashier, marketOutline, marketStation } from './MarketArt';
import { buildEducationCenter, educationStation } from './EducationArt';
import { buildCareerPlace, careerStation } from './CareerArt';
import { careerAt, isCareerPlace } from '../shared/careers';

const shared = new Set<THREE.BufferGeometry>([cube, softCube, drum, orb, plane, torus, ...locationGeometry, ...landscapeSharedGeometry]);
const accents = [0xc38367, 0xd4a560, 0x759785, 0x8e9eb5, 0xe1cc9d, 0x9b625a];
function shape(parent: THREE.Object3D, size: XYZ, pos: XYZ, color: number,
  geometry: THREE.BufferGeometry = softCube, shadow = false): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, finish(color, geometry === softCube ? 'wood' : 'fabric'));
  mesh.position.set(...pos);
  mesh.scale.set(...size);
  mesh.receiveShadow = true;
  mesh.castShadow = shadow;
  parent.add(mesh);
  return mesh;
}
const parkPaths = [
  {x:2.5,z:3.75,w:20,d:1.36},{x:2.5,z:.37,w:20,d:1.28},
  {x:-2.68,z:0,w:1.35,d:8.1},{x:2.52,z:0,w:1.30,d:8.1},
] as const;
const parkTrees=PARK_TREES;
const parkBeds = [[-4.90,-1.85,0],[4.85,-.78,2],[-5.05,3.05,1],[4.83,2.56,0],[-6.5,-3.8,2],[-6.6,1.2,0],[-4.8,5.15,1],[1.7,5.2,2],[5.5,-4.9,0],[7,-4.6,1],[10.6,-4.2,2],[11.45,1.15,0],[10.8,5.15,1],[6.2,5.1,2]] as const;

function parkLandscaping(parent: THREE.Group, resources: {textures:THREE.Texture[]; materials:THREE.Material[]}) {
  const area={x:2.5,z:0,w:21,d:14};
  const map=painted(resources,512,512,ctx=>{
    paintGround(ctx,area,[
    {x:-.08,z:-1.94,w:5.3,d:4.4,ink:[79,136,90],opacity:.54},
    {x:4.46,z:1.54,w:3.0,d:6.5,ink:[171,190,119],opacity:.67},
    ...parkTrees.map(([x,z])=>({x,z,w:2.62,d:2.5,ink:[59,98,66] as [number,number,number],opacity:.58,border:true})),
    ],90713);
    const sx=512/area.w,sz=512/area.d;
    for(const [i,path] of parkPaths.entries()){
      const x=(path.x-area.x+(area.w-path.w)/2)*sx, y=(path.z+(area.d-path.d)/2)*sz;
      limestone(ctx,x,y,path.w*sx,path.d*sz,.92*sx,.48*sz,931+i*37);
    }
    for(const [i,[x,z,,size]] of parkTrees.entries())canopyShade(ctx,area,x,z,size*1.52,817+i);
  });
  const material=new THREE.MeshStandardMaterial({color:map?0xffffff:0x8fab73,map,roughness:1});
  resources.materials.push(material);
  const ground=new THREE.Mesh(plane,seasonalMaterial(material,'ground'));
  ground.rotation.x=-Math.PI/2;
  ground.scale.set(21,14,1);ground.position.x=2.5;
  ground.position.y=.002;
  parent.add(ground);
  const plants=new PlantBatch();
  for (const [i,[x,z,kind,size]] of parkTrees.entries()) {
    growTree(plants,x,z,kind,size,639+i*31);
    growShrub(plants,x-Math.sign(x)*.48,0,z+.25,.62,.37,.63,i,109+i*221);
    shape(parent,[.78,.09,.72],[x,.035,z],0x867657,drum);
  }
  for (const [i,[x,z,hue]] of parkBeds.entries()) {
    const bed: GroundArea={x,z,w:1.14,d:.52};
    shape(parent,[bed.w+.08,.13,bed.d+.12],[x,.047,z],0xb49374,softCube);
    shape(parent,[bed.w,.036,bed.d],[x,.110,z],0x725b43,softCube);
    growFlowers(plants,x,.121,z,bed.w-.16,bed.d-.12,hue,22,975+i*442);
  }
  for(const [i,[x,z]] of [[-1.81,-2.95],[1.78,-2.77],[-1.73,-1.15],[1.68,-.93]].entries()){
    growShrub(plants,x,0,z,.63,.39,.67,i%4,957+i*82);
    growFlowers(plants,x+(i%2?.17:-.17),0,z-.23,.47,.52,i%3,5,465+i*84);
  }
  plants.attach(parent,'Park trees, flowers and pond planting');

  const random=landscapeRandom(1697);
  const tufts=[];
  for(let i=0;i<520;i++){
    const x=2.5+(random()-.5)*20.5,z=(random()-.5)*13.5;
    if((Math.abs(x-8.4)<2.4&&Math.abs(z-2.25)<2.6)||(Math.abs(x-8.45)<1.2&&Math.abs(z+2.4)<1.2)||(Math.abs(x+4.15)<1.15&&Math.abs(z-.98)<.85))continue;
    if (parkPaths.some(p=>Math.abs(x-p.x)<p.w/2+.18&&Math.abs(z-p.z)<p.d/2+.18)||
        (Math.abs(x+.08)<1.69&&Math.abs(z+1.94)<1.38)) continue;
    tufts.push({x,z,size:.46+random()*.72,yaw:random()*Math.PI*2,color:i%3?0x9ab96c:0x4d864d});
  }
  const grass=grassMaterial();
  resources.materials.push(grass.material);
  addTufts(parent,tufts,grass.material);
  return (seconds:number)=>{grass.wind.value=seconds;};
}

function bench(parent: THREE.Group, width: number) {
  shape(parent, [width, 0.12, 0.57], [0, 0.50, 0.055], C.oak, softCube, true);
  for (const x of [-width * 0.40, width * 0.40]) {
    shape(parent, [.09, .53, .44], [x, .26, .03], C.ink, cube);
    shape(parent, [.07, .73, .09], [x, .53, -.22], C.ink, cube);
  }
  for (const y of [.72, .92]) shape(parent, [width, .12, .075], [0, y, -.23], C.oak);
}
function facade(parent: THREE.Group, color: number) {
  shape(parent, [1.21, 2.24, .24], [0, 1.12, 0], C.walnut);
  shape(parent, [.97, 1.99, .14], [0, 1.04, .14], color);
  for (const x of [-.24, .24]) shape(parent, [.41, .71, .035], [x, 1.44, .216], 0x91afb3);
  shape(parent, [.07, .18, .07], [.34, .96, .244], C.brass, cube);
  shape(parent, [1.3, .07, .48], [0, .025, .19], C.oat);
}

function sign(group: THREE.Group, label: string, y: number, z: number, width: number, color: number,
  textures?: THREE.Texture[], materials?: THREE.Material[]): void {
  let map: THREE.Texture | null = null;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fff0d6';
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = '#405650';
      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 128, 33, 236);
      map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      textures?.push(map);
    }
  }
  const labelMesh = panel(group, [0, y, z], [width, 0.30], map, color, 0.13);
  if (!Array.isArray(labelMesh.material)) materials?.push(labelMesh.material);
}

function packageBox(group: THREE.Group, x: number, z: number, color: number): THREE.Group {
  const bag = new THREE.Group();
  bag.position.set(x, 0, z);
  shape(bag, [.37, .42, .22], [0, .24, 0], color, softCube, true);
  for (const px of [-.095, .095]) shape(bag, [.021, .135, .034], [px, .48, 0], C.walnut);
  shape(bag, [.21, .021, .036], [0, .546, 0], C.walnut);
  shape(bag, [.20, .10, .01], [0, .23, .114], C.paper, cube);
  group.add(bag);
  return bag;
}

function buildStation(station: Station, textures: THREE.Texture[], materials: THREE.Material[]) {
  const root = new THREE.Group();
  root.position.set(station.center.x, 0, station.center.z);
  const kind = station.action.kind;
  if(station.id==='street-industrial'||station.id==='industrial-exit'){
    const outward=station.id==='street-industrial';
    if(outward)root.rotation.y=Math.PI;
    for(const x of [-1.56,1.56]){
      shape(root,[.18,2.75,.22],[x,1.38,0],0x4a565c,cube);
      shape(root,[.30,.10,.34],[x,.07,0],0xb9b2a3,cube);
      shape(root,[.20,.13,.23],[x,2.76,0],0xe9c276);
    }
    shape(root,[3.35,.56,.18],[0,2.53,0],0x445963,cube);
    sign(root,outward?'ПРОМЗОНА →':'← РАЙОН',2.54,.11,3.18,C.paper,textures,materials);
  } else if(kind==='warehouse'){
    const oz=station.id==='warehouse-ozon';
    const brand=oz?0x2859b7:0x8b327b;
    const w=station.width,d=station.depth;
    shape(root,[w,3.10,d],[0,1.55,0],0xadb3b1,cube,true);
    shape(root,[w+.18,.18,d+.18],[0,3.19,0],0x4e565b,cube);
    shape(root,[w+.04,.56,.19],[0,2.65,d/2+.04],brand,cube);
    // Raised roof billboard, matching the commercial district's readable nameboards.
    const board=new THREE.Group();
    board.name='Roof sign: '+station.id;
    const width=w-.36,height=1.32,bottom=3.58,cy=bottom+height/2,z=d/2-.24;
    shape(board,[width+.18,height+.14,.18],[0,cy,z],0x36434a,cube);
    shape(board,[width+.08,height+.04,.06],[0,cy,z+.11],brand,cube);
    for(const side of [-1,1]){
      const x=side*width*.32;
      shape(board,[.12,.42,.16],[x,3.44,z-.09],0x4e565b,cube);
      shape(board,[.33,.08,.35],[x,3.31,z-.09],0x36434a,cube);
    }
    lettering(board,{textures,materials},[0,cy,z+.15],width-.12,height-.12,oz?'OZON':'WILDBERRIES',[oz?'#2058b9':'#902d85','#ffffff']);
    root.add(board);
    for(const x of [-1.94,1.94]){
      shape(root,[1.68,1.95,.09],[x,.99,d/2+.025],0x545d64,cube);
      for(let i=0;i<12;i++)shape(root,[1.61,.035,.03],[x,.15+i*.147,d/2+.08],0x929b9f,cube);
      shape(root,[1.76,.11,.28],[x,2.03,d/2+.10],brand,cube);
    }
    shape(root,[.88,1.95,.13],[0,1.0,d/2+.03],0x344a53,cube);
    shape(root,[.61,.48,.025],[0,1.51,d/2+.11],0x9cbcc5,cube);
    shape(root,[.06,.15,.06],[.30,.94,d/2+.14],0xd4d6c9,cube);
    for(const x of [-2.9,2.9]){
      shape(root,[.12,.56,.12],[x,.28,d/2+.19],0xe0b757,drum);
      shape(root,[.12,.10,.12],[x,.36,d/2+.19],0x55514e,drum);
    }
  } else if(station.action.kind==='barber'){
    const f=station.action.facility;if(f==='reception'){shape(root,[2.1,.94,.85],[0,.47,0],0x302d2a,softCube);shape(root,[2.16,.09,.91],[0,.97,0],0xa47c4f);shape(root,[.45,.32,.10],[-.48,1.19,-.12],0x242e35);sign(root,'BRO',1.24,.43,1.4,C.paper,textures,materials);}else{shape(root,[.82,.10,.82],[0,.07,0],0xadb3b4,drum);shape(root,[.20,.49,.20],[0,.30,0],0xadb3b4,drum);shape(root,[.73,.16,.65],[0,.62,0],0x332d29,softCube);shape(root,[.72,.71,.14],[0,1.01,.30],0x332d29,softCube);shape(root,[.38,.19,.16],[0,1.44,.30],0x332d29,softCube);for(const x of [-.42,.42]){shape(root,[.14,.10,.55],[x,.91,0],0x332d29,softCube);shape(root,[.065,.30,.065],[x,.78,0],0xb5bbbd);}shape(root,[.47,.09,.31],[0,.32,-.48],0xaeb5b5);}
  } else if(station.action.kind==='clinic'){
    const f=station.action.facility,w=station.width,d=station.depth;
    const white=0xf4f4ec,teal=0x438f91,metal=0xa5b7ba;
    if(f==='reception'||f==='pharmacy'){
      shape(root,[w,.92,d],[0,.46,0],teal,softCube);shape(root,[w+.06,.09,d+.06],[0,.96,0],white);
      if(f==='reception'){shape(root,[.46,.32,.09],[-.48,1.17,-.14],0x364f59);shape(root,[.35,.20,.02],[-.48,1.17,-.08],0xa0cad0);}
      else for(let i=0;i<8;i++){const x=(i%4-1.5)*.44,z=i<4?-.19:.16;shape(root,[.24,.27,.15],[x,1.15,z],i%2?white:0xd6e5e6);shape(root,[.22,.055,.015],[x,1.17,z+.085],i%2?teal:0xcf976e);}
    }else{
      for(const x of [-w*.37,w*.37])for(const z of [-d*.31,d*.31])shape(root,[.10,.68,.10],[x,.34,z],metal);
      shape(root,[w*.77,.13,d*.67],[0,.73,0],white,softCube);
      shape(root,[w*.72,.13,d*.61],[0,.84,0],f==='diagnostics'?0xc5d9df:0x9cc5c1,softCube);
      shape(root,[w*.22,.13,d*.53],[-w*.24,.96,0],white,softCube);
      if(f==='diagnostics'){shape(root,[.32,1.24,.30],[w*.39,.62,-d*.30],metal);shape(root,[.53,.35,.11],[w*.39,1.34,-d*.30],0x354952);shape(root,[.44,.26,.018],[w*.39,1.34,-d*.22],0x72b8b4);}
      if(f==='procedure'){shape(root,[.09,1.62,.09],[w*.40,.81,-d*.31],metal);shape(root,[.40,.10,.35],[w*.40,1.66,-d*.31],white);}
    }
    sign(root,station.name,1.75,-d*.48,w,white,textures,materials);
  } else if (kind === 'door') {
    if (station.center.z > 4) root.rotation.y = Math.PI;
    facade(root, C.pine);
    sign(root, station.name, 2.39, .20, 1.32, C.paper, textures, materials);
  } else if(station.action.kind==='pet-food-display'){
    const {pet,form}=station.action;
    shape(root,[2.35,.78,.95],[0,.39,0],0x669078);shape(root,[2.43,.08,1.01],[0,.82,0],0xf2e3c8);
    PET_SHOP_FOOD.filter(p=>p.pet===pet&&p.id.includes('-'+form+'-')).forEach((p,i)=>{const x=(i-1.5)*.55;
      shape(root,form==='dry'?[.40,.68,.27]:[.38,.34,.30],[x,form==='dry'?1.20:1.03,0],p.color,form==='dry'?softCube:drum);
      shape(root,[.31,.16,.035],[x,form==='dry'?1.25:1.02,.16],0xfff2d6,cube);
      sign(root,p.name.split(' · ')[0],.73,.49,.49,C.paper,textures,materials);const label=root.children.at(-1)!;label.position.x=x;label.scale.y=.095;
    });
    sign(root,station.name,2.12,.35,2.06,C.paper,textures,materials);
  } else if(kind==='pet-furniture-display'){
    shape(root,[2.35,.48,.95],[0,.24,0],0x669078);shape(root,[2.43,.08,1.01],[0,.52,0],0xf2e3c8);
    ['pet-bed-dog-nest','pet-house-igloo','pet-scratcher-palm','pet-bed-cat-shell','pet-house-loft','pet-bed-stairs'].forEach((id,i)=>{const m=buildFurnishingModel(id,i<3?'sage':'oak');m.scale.setScalar(.36);m.position.set((i%3-1)*.76,.565,i<3?.19:-.23);root.add(m);});
    PET_TOYS.forEach((p,i)=>{const m=createShopToy(p.kind);m.scale.setScalar(.67);m.position.set((i-2.5)*.35,.57,.40);root.add(m);});
    for(const [i,p] of FEEDING_MODELS.filter(m=>m.pet==='verdell').entries()){const m=buildFurnishingModel(p.id,'ivory');m.scale.setScalar(.48);m.position.set((i-1.5)*.46,.57,-.42);root.add(m);}
    sign(root,'ДЛЯ ЖИВОТНЫХ',1.75,.36,2.06,C.paper,textures,materials);
  } else if(station.action.kind==='console-display'){
    const sku=station.action.sku,ps=sku==='console-ps5',accent=ps?0x305895:0xc65d58;
    shape(root,[2.6,.78,1.02],[0,.39,0],0x394a5a);shape(root,[2.66,.08,1.07],[0,.82,0],0xe7edf1);
    const model=buildConsoleModel(sku);model.scale.setScalar(1.6);model.position.set(-.63,.865,.06);root.add(model);
    shape(root,[1.11,.69,.09],[.56,1.235,-.27],0x202b35);shape(root,[1.02,.60,.018],[.56,1.235,-.216],accent);
    for(let i=0;i<4;i++){shape(root,[.15,.25,.06],[.13+i*.25,.99,.31],0x26394c);shape(root,[.13,.19,.013],[.13+i*.25,1.01,.346],i%2?accent:0xe2cead);}
    sign(root,ps?'UFC 6 · PLAYSTATION':'NINTENDO SWITCH 2',1.94,-.14,2.37,C.paper,textures,materials);
    sign(root,CONSOLES[sku].name,.60,.55,1.75,C.paper,textures,materials);
  } else if(station.action.kind==='speaker-display'){
    shape(root,[2.15,.78,.78],[0,.39,0],0x405766);shape(root,[2.22,.08,.85],[0,.82,0],0xe6edf1);
    (Object.keys(SPEAKER_MODELS) as SpeakerSku[]).forEach((sku,i)=>{
      const model=buildSpeakerModel(sku);model.position.set((i-1)*.70,.865,0);root.add(model);
      sign(root,['Яндекс','Google','Apple'][i],.67,.48,.52,C.paper,textures,materials);root.children.at(-1)!.position.x=(i-1)*.70;
    });
    sign(root,station.name,2.10,.30,1.63,C.paper,textures,materials);
  } else if(station.action.kind==='vacuum-display'){
    shape(root,[2.15,.65,.78],[0,.325,0],0x405766);shape(root,[2.22,.08,.85],[0,.69,0],0xe6edf1);
    (Object.keys(VACUUM_MODELS) as VacuumSku[]).forEach((sku,i)=>{
      const model=buildVacuumModel(sku);model.position.set((i-1)*.70,.735,0);model.scale.setScalar(.84);root.add(model);
      sign(root,['Xiaomi','Roborock','Dreame'][i],.67,.48,.52,C.paper,textures,materials);root.children.at(-1)!.position.x=(i-1)*.70;
    });
    sign(root,station.name,2.10,.30,1.63,C.paper,textures,materials);
  } else if(station.action.kind==='electronics-display'){
    const category=station.action.category;
    shape(root,[2.35,.84,.95],[0,.42,0],0x405766);shape(root,[2.43,.08,1.01],[0,.88,0],0xe6edf1);
    electronicsFor(category).forEach((id,i)=>{
      const model=buildElectronicsModel(id),x=(i-1)*.74;
      const scale=category==='desktop'?.47:category==='tv'?.37:category==='laptop'?1:category==='coffee'?1.22:1.8;
      model.position.set(x,.924,-.075);model.scale.setScalar(scale);root.add(model);
      sign(root,ELECTRONICS[id].name,.79,.52,.69,C.paper,textures,materials);
      const label=root.children.at(-1)!;label.position.x=x;label.scale.y=.105;
    });
    sign(root,station.name,2.10,.30,1.83,C.paper,textures,materials);
  } else if(kind==='pet-checkout'){
    shape(root,[1.75,.94,.80],[0,.47,0],0x588e72);shape(root,[1.82,.10,.85],[0,.99,0],0xf2e3c8);shape(root,[.42,.27,.07],[-.4,1.18,-.12],0x263645);shape(root,[.33,.19,.02],[-.4,1.18,-.075],0x75a0b2);sign(root,'КАССА',.60,.45,1.30,C.paper,textures,materials);
  } else if(kind==='electronics-checkout'){
    shape(root,[1.75,.94,.80],[0,.47,0],0x456574);shape(root,[1.82,.10,.85],[0,.99,0],0xe0e9ee);shape(root,[.42,.27,.07],[-.4,1.18,-.12],0x263645);shape(root,[.33,.19,.02],[-.4,1.18,-.075],0x75a0b2);sign(root,'КАССА',.60,.45,1.30,C.paper,textures,materials);
  } else if(kind==='clothes-rack'){
    shape(root,[2.24,.08,.78],[0,.05,0],0x9f8069);
    for(const x of [-1.04,1.04])shape(root,[.055,1.8,.055],[x,.95,0],0x48474b,drum);
    shape(root,[2.13,.055,.055],[0,1.82,0],0x48474b,cube);
    const palette=station.id==='clothes-alina'?[0xe6a9a8,0xf0e8dc,0xb35672,0x8c9dba,0xc5b4d5]:[0x53665d,0xf2f0e9,0x30343b,0x667d91,0x202933];
    for(let i=0;i<5;i++){
      const x=(i-2)*.40,c=palette[i];
      shape(root,[.32,.025,.06],[x,1.68,0],0xc49e6c,cube);
      shape(root,[.235,.52,.08],[x,1.39,0],c);
      for(const side of [-1,1]){
        const sleeve=shape(root,[.12,.22,.08],[x+side*.14,1.53,0],c);
        sleeve.rotation.z=-side*.37;
      }
      for(const side of [-1,1])shape(root,[.12,.35,.10],[x+side*.067,.55,.07],i%2?0x6988a2:0x54515d);
    }
    sign(root,station.name,2.08,.11,2.06,C.paper,textures,materials);
  } else if(kind==='fitting'){
    for(const x of [-.80,.80])shape(root,[.10,2.20,1.48],[x,1.10,0],0xb2a297);
    shape(root,[1.72,2.20,.10],[0,1.10,-.70],0xb2a297);
    shape(root,[.69,1.72,.06],[0,1.12,-.61],0xbfd1d4,cube);
    for(let i=0;i<8;i++)shape(root,[.087,1.98,.07],[-.77+i*.075,1.10,.70],i%2?0x87728a:0x9a849d);
    shape(root,[1.61,.045,1.37],[0,.025,0],0xd5c3ae);
    sign(root,'ПРИМЕРОЧНАЯ',2.37,.68,1.65,C.paper,textures,materials);
  } else if(kind==='clothes-checkout'){
    shape(root,[1.65,.94,.76],[0,.47,0],0xa88978);
    shape(root,[1.72,.11,.81],[0,.99,0],0xe5ded1);
    shape(root,[.45,.28,.11],[-.43,1.18,-.16],0x44464c);
    shape(root,[.36,.21,.03],[-.43,1.18,-.08],0x98afb4,cube);
    packageBox(root,.48,-.08,0x967d99).scale.setScalar(.68);
    sign(root,'КАССА',.61,.40,1.30,C.paper,textures,materials);
  } else if(kind==='swing'){
    root.add(buildFurnishingModel('leisure-swing','oak'));
  } else if(kind==='picnic'){
    shape(root,[1.92,.035,1.24],[0,.023,0],0xb55c4a,cube);
    for(let i=0;i<10;i++)shape(root,[.078,.01,1.24],[-.855+i*.19,.046,0],0xf2dfbe,cube);
    for(let i=0;i<6;i++)shape(root,[1.92,.011,.065],[0,.05,-.50+i*.20],0xf2dfbe,cube);
    for(const x of [-.51,.51])shape(root,[.60,.095,.37],[x,.095,.36],0x73938a,softCube);
    shape(root,[.38,.26,.31],[0,.18,-.36],0xb58248,softCube);
    shape(root,[.42,.045,.35],[0,.322,-.36],0xd0a46e,softCube);
    const handle=shape(root,[.22,.19,.025],[0,.42,-.36],0x855b39,torus);handle.rotation.x=0;
    shape(root,[.98,.13,.40],[0,.13,-.09],0xb88a60,softCube);
  } else if(kind==='badminton'){
    shape(root,[4.45,.015,4.8],[0,.018,0],0x789563,cube);
    for(const z of [-2.36,2.36,0])shape(root,[4.4,.012,.035],[0,.03,z],0xf2e5cb,cube);
    for(const x of [-2.2,2.2])shape(root,[.035,.012,4.75],[x,.03,0],0xf2e5cb,cube);
    for(const x of [-1.9,1.9]){shape(root,[.085,1.58,.085],[x,.79,0],0x4a544b,drum);shape(root,[.28,.07,.24],[x,.035,0],0x525b53,softCube);}
    for(let i=0;i<23;i++)shape(root,[.016,.66,.016],[-1.87+i*.17,1.22,0],0xe2e2d4,cube);
    for(let i=0;i<6;i++)shape(root,[3.8,.018,.016],[0,.89+i*.13,0],0xe2e2d4,cube);
    const shuttle=new THREE.Group();shuttle.name='Park shuttlecock';shuttle.visible=false;
    shape(shuttle,[.075,.075,.075],[0,0,0],0xe6d5a0,orb);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;const feather=shape(shuttle,[.025,.115,.024],[Math.cos(a)*.032,.075,Math.sin(a)*.032],0xf6f3ea,softCube);feather.rotation.z=-Math.cos(a)*.3;feather.rotation.x=Math.sin(a)*.3;}
    root.add(shuttle);
  } else if(kind==='campfire'){
    shape(root,[1.45,.035,1.45],[0,.023,0],0x74664d,drum);
    for(let i=0;i<13;i++){const a=i*Math.PI*2/13;const stone=shape(root,[.25,.18,.23],[Math.cos(a)*.58,.105,Math.sin(a)*.58],i%2?0x8b8b7e:0xaaa18f,softCube,true);stone.rotation.y=a;}
    for(let i=0;i<5;i++){const log=shape(root,[.58,.13,.13],[0,.14+(i%2)*.09,0],0x5d4230,softCube);log.rotation.y=i*Math.PI/5;}
    const flames=new THREE.Group();flames.name='Park campfire flames';flames.visible=false;
    for(let i=0;i<5;i++){const a=i*2.4;shape(flames,[.23,.52-i*.047,.22],[Math.cos(a)*.15,.39,Math.sin(a)*.15],i%2?0xffad36:0xe95a2d,orb);}
    shape(flames,[.20,.32,.19],[0,.34,0],0xffe59a,orb);
    root.add(flames);
    for(const x of [-.49,.49])shape(root,[.045,.75,.045],[x,.39,0],0x444740,drum);
    shape(root,[1.08,.045,.045],[0,.77,0],0x444740,cube);
    shape(root,[.52,.045,.44],[0,.47,0],0x444740,cube);
  } else if (kind === 'dine') {
    shape(root, [1.38,.13,.78], [0,.93,-.27], C.oak,softCube,true);
    shape(root,[.13,.79,.13],[0,.46,-.27],C.walnut,drum);
    for(const x of [-.40,.40]){const chair=new THREE.Group();chair.position.set(x,0,.53);chair.rotation.y=Math.PI;bench(chair,.59);root.add(chair);}
    const vase=shape(root,[.084,.19,.084],[.11,1.09,-.29],C.leaf,drum);vase.rotation.z=.08;
    shape(root,[.072,.087,.059],[.13,1.22,-.29],0xd1a6a2,orb);
  } else if (kind === 'rest') {
    bench(root, station.width);
  } else if (kind === 'terminal' || kind === 'pickup') {
    shape(root, [station.width, .94, station.depth], [0, .47, 0], kind === 'pickup' ? C.clay : C.pine, softCube, true);
    shape(root, [station.width + .04, .10, station.depth + .03], [0, .98, 0], C.oat);
    shape(root, [.46, .29, .085], [-.24, 1.15, -.16], C.ink);
    shape(root, [.36, .19, .025], [-.24, 1.17, -.109], C.sky);
    shape(root, [.34, .03, .30], [.21, 1.047, .07], C.limestone);
    sign(root, station.name, .64, station.depth / 2 + .017, station.width - .11, C.paper, textures, materials);
    if (kind === 'pickup') {
      for (const x of [.29, .52]) shape(root, [.082, .13, .082], [x, 1.12, .13], C.coral, drum);
    }
  } else {
    shape(root, [.37, .045, .37], [0, .028, 0], C.oat, drum);
    shape(root, [.055, .69, .055], [0, .345, 0], C.walnut, drum);
    sign(root, station.name, .79, .053, 1.68, C.paper, textures, materials);
    shape(root, [1.68, .31, .09], [0, .79, 0], C.pine);
  }
  batchRigidParts(root);
  return root;
}

export function createHomeDistrict() {
  const root = new THREE.Group();
  root.name = 'Дворы и торговая улица';
  root.position.z = DISTRICT_OFFSET_Z;
  const resources = { textures: [] as THREE.Texture[], materials: [] as THREE.Material[] };
  const district = buildDistrict(root, resources);
  for (const station of DISTRICT_STATIONS) {
    if (district.entries.has(station.id)) continue;
    const object=station.id==='district-gate'?new THREE.Group():buildStation(station, resources.textures, resources.materials);
    if(station.id==='district-gate'){
      object.position.set(station.center.x,0,station.center.z);
      shape(object,[1.65,.08,.48],[0,.05,0],C.pine);
      for(const x of [-.83,.83])shape(object,[.19,.88,.21],[x,.44,0],C.walnut);
      sign(object,'ДОМ',.96,.06,1.30,C.paper,resources.textures,resources.materials);
    }
    object.position.z -= DISTRICT_OFFSET_Z;
    root.add(object);
    district.entries.set(station.id, object);
  }
  return {root,...district};
}

function fitnessStation(station:Station,textures:THREE.Texture[],materials:THREE.Material[]){
  if(station.action.kind!=='fitness')return null;
  const g=new THREE.Group();g.position.set(station.center.x,0,station.center.z);
  const f=station.action.facility,w=station.width,d=station.depth;
  const steel=0x48535c,black=0x263139,pad=0x167d78,wood=0xc69d6c,white=0xeee7db;
  const b=(size:XYZ,pos:XYZ,c=steel,geom:THREE.BufferGeometry=cube)=>shape(g,size,pos,c,geom);
  const rod=(a:XYZ,z:XYZ,r=.035,c=steel)=>{
    const from=new THREE.Vector3(...a),to=new THREE.Vector3(...z),delta=to.clone().sub(from);
    const mid=from.clone().add(to).multiplyScalar(.5);
    const m=b([r*2,delta.length(),r*2],[mid.x,mid.y,mid.z],c,drum);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;
  };
  const seat=(x=0,y=.65,z=.2)=>b([.46,.12,.45],[x,y,z],pad,softCube);
  const monitor=(y=1.27,z=-.54)=>{b([.43,.27,.10],[0,y,z],black);b([.33,.17,.025],[0,y,z+.064],0x83c4bd)};
  if(f==='treadmill'){
    b([w*.90,.19,d*.92],[0,.12,0],steel,softCube);
    b([w*.71,.055,d*.77],[0,.24,.04],black);
    for(const x of [-.48,.48]){b([.08,.065,d*.84],[x,.25,0],0xb8c0c2);rod([x,.23,-.76],[x,1.23,-.58]);rod([x,1.1,-.58],[x,1.1,.07],.045)}
    monitor(1.36,-.66);
  }else if(f==='bike'||f==='elliptical'||f==='stepper'){
    b([w*.83,.08,d*.86],[0,.06,0],steel);
    b([.42,.58,.64],[0,.38,-.12],black,softCube);
    rod([0,.3,-.32],[0,1.24,-.46],.055);monitor(1.37,-.46);
    if(f==='bike'){rod([0,.32,.34],[0,.86,.34],.05);seat(0,.88,.34);for(const x of [-.30,.30])b([.22,.055,.34],[x,.30,.05],black);}
    else for(const x of [-.29,.29]){b([.25,.075,.64],[x,.23,.30],black);rod([x,.26,.30],[x,1.38,-.43],.035);}
    rod([-.4,1.12,-.44],[.4,1.12,-.44],.045);
  }else if(f==='rower'){
    b([.18,.18,d*.92],[0,.12,0],steel);b([.65,.08,.25],[0,.10,.82]);
    b([.58,.56,.62],[0,.32,-.72],black,softCube);seat(0,.31,.26);monitor(.86,-.73);
    for(const x of [-.24,.24])b([.23,.09,.33],[x,.29,-.38],pad).rotation.x=-.28;
    rod([-.26,.65,-.42],[.26,.65,-.42],.035);
  }else if(f==='mat'){
    b([w,.035,d],[0,.023,0],pad,softCube);b([.10,.014,d*.76],[-.32,.048,0],0x55aaa0);
  }else if(f==='dumbbells'){
    b([w*.94,.10,d*.8],[0,.09,0],steel);
    for(const y of [.42,.83]){b([w*.92,.10,.49],[0,y,-.04],steel);for(let i=0;i<5;i++){const x=(i-2)*.29;rod([x-.11,y+.13,-.04],[x+.11,y+.13,-.04],.026,0xc1c6cb);for(const k of [-1,1])b([.105,.16+i*.016,.19],[x+k*.105,y+.13,-.04],black,softCube);}}
    for(const x of [-.65,.65])b([.08,.92,.43],[x,.47,-.04]);
  }else if(f==='rack'||f==='bench'||f==='crossover'){
    const h=f==='bench'?1.55:2.32;
    for(const x of [-w*.43,w*.43]){b([.10,h,.10],[x,h/2,-d*.34]);b([.16,.08,d*.88],[x,.06,0]);}
    b([w*.88,.10,.10],[0,h,-d*.34]);
    if(f==='crossover'){
      for(const x of [-w*.37,w*.37]){b([.42,1.35,.44],[x,.72,-.43],black);rod([x,1.8,-.39],[x*.65,1.05,.35],.018);b([.15,.16,.08],[x*.65,1.05,.35],pad);}
    }else{
      if(f==='bench'){b([.45,.13,1.24],[0,.55,.12],pad,softCube);b([.13,.48,.9],[0,.27,.12]);}
      rod([-w*.48,1.13,-.30],[w*.48,1.13,-.30],.035,0xb9c3cb);
      for(const x of [-w*.40,w*.40])b([.08,.44,.44],[x,1.13,-.30],black,drum).rotation.z=Math.PI/2;
    }
  }else if(f.startsWith('locker-')||f.startsWith('shower-')||f.startsWith('toilet-')){
    const shade=f.endsWith('-v')?0x65899b:0xb990a7;
    b([w,.055,d],[0,.028,0],0xd8e3df);
    b([w,2.1,.09],[0,1.05,-d*.47],shade);
    for(const x of [-w*.47,w*.47])b([.09,1.9,d*.92],[x,.95,0],shade);
    if(f.startsWith('locker-')){
      for(let i=0;i<4;i++){const x=(i-1.5)*.43;b([.40,1.67,.40],[x,.88,-.60],0xe0c49f,softCube);b([.035,.15,.035],[x+.13,.98,-.38],steel);for(let k=0;k<3;k++)b([.22,.024,.025],[x,1.45+k*.055,-.38],steel);}
      b([1.45,.13,.40],[0,.49,.31],wood);for(const x of [-.62,.62])b([.10,.43,.30],[x,.235,.31],steel);
    }else if(f.startsWith('shower-')){
      b([1.12,.08,1.16],[0,.075,-.20],0xf0f3ef,softCube);b([.12,.02,.12],[0,.13,-.15],steel,drum);
      rod([0,.9,-.71],[0,1.86,-.71],.025);rod([0,1.86,-.71],[0,1.86,-.32],.025);b([.23,.055,.23],[0,1.83,-.30],0xb7c4c7,drum);b([.17,.13,.07],[0,1.10,-.65],steel);
      for(const x of [-.60,.60])b([.04,1.78,1.05],[x,.96,-.18],0xb6d1d2);
    }else{
      b([.46,.36,.65],[-.38,.22,-.17],0xf7f5ee,softCube);b([.47,.10,.61],[-.38,.44,-.06],0xf7f5ee,softCube);b([.30,.027,.39],[-.38,.50,-.06],0x51676f,softCube);b([.48,.62,.23],[-.38,.64,-.56],0xf7f5ee,softCube);
      b([.58,.15,.42],[.47,.84,-.55],0xf5f3ee,softCube);b([.37,.06,.25],[.47,.89,-.55],0x91acb0,softCube);rod([.47,.9,-.72],[.47,1.06,-.72],.022);rod([.47,1.06,-.72],[.47,1.06,-.59],.022);b([.52,.60,.035],[.47,1.37,-.78],0xb6d0d5);
    }
    sign(g,f.startsWith('locker-')?(f.endsWith('-v')?'МУЖСКАЯ':'ЖЕНСКАЯ'):f.startsWith('shower-')?'ДУШ':'WC',1.98,-.76,1.5,white,textures,materials);
  }else if(f==='sauna'){
    b([w,.09,d],[0,.05,0],wood);b([w,2.20,.12],[0,1.10,-d*.47],wood);
    for(const x of [-w*.46,w*.46])b([.10,2.2,d*.92],[x,1.1,0],wood);
    for(let i=0;i<7;i++)b([w*.86,.045,.09],[0,.34+i*.24,-d*.40],0xa77c4e);
    b([w*.84,.12,.63],[0,.56,-.58],wood);b([w*.84,.12,.44],[0,.30,.02],wood);
    b([.38,.66,.40],[w*.31,.38,.53],steel,softCube);
    for(let i=0;i<4;i++)b([.12,.11,.14],[w*.31+(i%2-.5)*.13,.74,.53+(Math.floor(i/2)-.5)*.15],0x818986,orb);
    sign(g,'SAUNA',2.04,-.97,1.1,white,textures,materials);
  }else if(f==='reception'||f==='bar'){
    b([w,.93,d],[0,.47,0],f==='bar'?wood:pad,softCube);
    b([w,.085,d],[0,.98,0],white);b([.37,.29,.09],[-w*.25,1.19,-.04],black);
    if(f==='bar')for(let i=0;i<5;i++){b([.12,.25,.12],[(i-1)*.20,1.16,.05],i%2?0xc99670:0x78a29b,drum)}
    sign(g,f==='bar'?'PULSE BAR':'PULSE FITNESS',.55,d*.53,w*.85,white,textures,materials);
    g.rotation.y=Math.PI;
  }else{
    b([w*.85,.09,d*.90],[0,.06,0],steel);
    const high=f==='legpress'?1.35:2.06;
    for(const x of [-w*.38,w*.38]){b([.095,high,.10],[x,high/2,-d*.36]);b([.10,.08,d*.82],[x,.11,0]);}
    b([w*.78,.10,.12],[0,high,-d*.36]);b([.40,high*.60,.37],[-w*.25,high*.35,-d*.28],black);
    for(let i=0;i<5;i++)b([.34,.018,.40],[-w*.25,.18+i*.12,-d*.28],0x7d8a90);
    seat(0,f==='legpress'?.38:.62,.24);b([.45,.65,.12],[0,.95,.43],pad,softCube).rotation.x=f==='legpress'?-0.6:0;
    if(f==='legpress')b([.65,.13,.60],[0,.81,-.45],black).rotation.x=.65;
    else if(f==='latpull'){rod([0,high,-.24],[0,1.64,.04],.018);rod([-.49,1.64,.04],[.49,1.64,.04],.035);}
    else if(f==='legextension'||f==='legcurl'){rod([-.28,.34,.50],[.28,.34,.50],.075,pad);}
    else for(const x of [-.36,.36]){rod([x,1.38,-.42],[x,1.03,.20],.045);rod([x,1.03,.20],[x*.66,1.03,.43],.055,black);}
  }
  batchRigidParts(g,true);
  if(f==='treadmill'){
    const belt=new THREE.Group();belt.name='PULSE belt';
    for(let i=0;i<8;i++)shape(belt,[w*.69,.012,.018],[0,.277,-.66+i*.18],0x4a555b,cube);
    g.add(belt);
  }else if(f==='bike'){
    const crank=new THREE.Group();crank.name='PULSE crank';crank.position.set(0,.37,.05);
    for(const side of [-1,1]){shape(crank,[.32,.04,.04],[side*.20,side*.13,0],0xa4afb2,cube);shape(crank,[.18,.05,.24],[side*.36,side*.13,0],black,cube);}
    g.add(crank);
  }else if(['legpress','latpull','seatedrow','chestpress','legextension','legcurl','crossover'].includes(f)){
    const stack=new THREE.Group();stack.name='PULSE stack';
    for(let i=0;i<4;i++)shape(stack,[.33,.075,.34],[-w*.25,.20+i*.09,-d*.28],0x8d9a9e,cube);
    g.add(stack);
  }
  return g;
}

export function createLocation(place: Exclude<PlaceId, 'home'>) {
  const root = new THREE.Group();
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];
  const stations = new Map<string, THREE.Group>();
  const bulbs: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
  const outdoor = place === 'park';
  const floor = new THREE.Group();
  let animatePark: ((seconds:number)=>void)|undefined;
  let animateCafe: ((seconds:number)=>void)|undefined;
  root.add(floor);
  const resources = { textures, materials };
  const animateWork = isCareerPlace(place) ? buildCareerPlace(place,floor,root,resources) : undefined;
  if(place==='barber'){
    shape(floor,[12.3,.36,10.3],[0,-.20,0],0x514637,cube);shape(floor,[12,.06,10],[0,-.03,0],0x7e6550,cube);
    for(let x=-5.5;x<=5.5;x++)for(let z=-4.5;z<=4.5;z++)shape(floor,[.985,.012,.985],[x,.007,z],(Math.round(x+z)%2)?0x8b6e55:0x9b8065,cube);
    shape(floor,[12.15,2.85,.18],[0,1.42,-5.05],0x343535,cube);shape(floor,[.18,2.85,10.1],[-6.04,1.42,0],0x5c4f43,cube);sign(floor,'B R O · BARBERSHOP',2.52,-4.90,5.0,C.paper,textures,materials);
    for(const x of [-3,0,3]){shape(floor,[1.65,1.55,.09],[x,1.42,-4.89],0xa37c4f,cube);shape(floor,[1.49,1.39,.025],[x,1.42,-4.82],0xb2c2c3,cube);shape(floor,[1.72,.10,.45],[x,.83,-4.61],0x392e27,cube);for(let i=0;i<4;i++)shape(floor,[.10,.23,.10],[x-.55+i*.18,.99,-4.60],i%2?0xdecbb3:0x465759);}
    const npc=marketCashier(resources,{title:'Барбер',color:0x282b2d,shirt:0xddd7c7,animated:true});npc.position.set(0,0,-1.14);npc.rotation.y=Math.PI;root.add(npc);
    const motion=npc.userData.motion as {head:THREE.Group;arms:THREE.Group[]};const tools=new THREE.Group();tools.position.set(.172,-.236,.274);motion.arms[1].add(tools);
    const clipper=new THREE.Group(),scissors=new THREE.Group(),razor=new THREE.Group(),pad=new THREE.Group();tools.add(clipper,scissors,razor,pad);
    shape(clipper,[.045,.10,.033],[0,0,.04],0x263139);shape(clipper,[.055,.025,.039],[0,.055,.04],0xb9c0c3);
    for(const side of [-1,1]){shape(scissors,[.014,.12,.014],[side*.019,.055,.035],0xd3d8d8);shape(scissors,[.036,.04,.018],[side*.023,-.02,.035],0x3f4648);}
    shape(razor,[.021,.11,.022],[0,0,.04],0x5f4537);shape(razor,[.055,.021,.021],[0,.06,.04],0xc5cacc);shape(pad,[.07,.045,.06],[0,0,.05],0xe8dbca,softCube);
    animateCafe=(seconds)=>{const a=String(root.userData.barberAction??''),phase=a==='barberFull'?Math.floor(seconds/9)%4: a==='barberFade'?Math.floor(seconds/5)%2:a==='barberShave'?2:a==='barberFace'?3:1;const active=[clipper,scissors,razor,pad][phase];for(const tool of tools.children)tool.visible=!!a&&tool===active;motion.head.rotation.x=a?.12:0;motion.arms.forEach((arm,i)=>{arm.rotation.x=a?-.85+.15*Math.sin(seconds*(phase===2?4:6)+i):Math.sin(seconds*.7+i)*.04;arm.rotation.z=a?(i?-.32:.32):0;});};
  } else if(place==='clinic'){
    shape(floor,[12.3,.36,10.3],[0,-.20,0],0x829b98,cube);
    shape(floor,[12,.06,10],[0,-.031,0],0xe4ece8,cube);
    for(let x=-5.5;x<=5.5;x++)for(let z=-4.5;z<=4.5;z++)shape(floor,[.985,.012,.985],[x,.007,z],(Math.round(x+z)%2)?0xdde8e5:0xf2f3ed,cube);
    shape(floor,[12.15,2.85,.18],[0,1.42,-5.05],0xc5ded9,cube);
    shape(floor,[.18,2.85,10.1],[-6.04,1.42,0],0xe5eee7,cube);
    shape(floor,[11.9,.29,.025],[0,.48,-4.94],0x579a98,cube);
    sign(floor,'ДОБРЫЙ ДОКТОР',2.52,-4.90,4.4,C.paper,textures,materials);
    for(const x of [-3.7,0,3.7]){shape(floor,[2.3,1.25,.05],[x,1.14,-4.91],0x9fc6cb,cube);shape(floor,[.08,1.28,.065],[x,1.14,-4.87],0xf2f3ed,cube);}
    for(const [x,z,title] of [[-3.8,1.75,'Администратор'],[-3.7,-4.1,'Терапевт'],[0,-4.1,'Диагност'],[3.7,-4.1,'Медсестра'],[3.7,-.57,'Фармацевт']] as const){
      const npc=marketCashier(resources,{title,color:0x65a5a2,shirt:0xf3f4ee,animated:true});npc.position.set(x,0,z);root.add(npc);
    }
  } else if(place==='fitness'){
    shape(floor,[24.3,.36,14.3],[3,-.20,0],0x414e53,cube);
    shape(floor,[24,.06,14],[3,-.031,0],0xd5c4ab,cube);
    for(const z of [-4.7,-.7,3.05])shape(floor,[17.4,.025,z===3.05?2.65:2.7],[0,.012,z],z===3.05?0x718b85:0x56636a,cube);
    shape(floor,[24.15,2.85,.18],[3,1.42,-7.05],0x37474e,cube);
    shape(floor,[.18,2.85,14.1],[-9.04,1.42,0],0x52636a,cube);
    for(let i=0;i<6;i++){const x=-7.5+i*3;shape(floor,[2.54,1.72,.07],[x,1.29,-6.91],0xabc7c8,cube);shape(floor,[.08,1.72,.09],[x,1.29,-6.85],0x43555b,cube);}
    sign(floor,'PULSE FITNESS',2.52,-6.82,4.2,C.paper,textures,materials);
    shape(floor,[5.6,.026,13.5],[11.75,.012,0],0xb8c7c6,cube);
    shape(floor,[.16,2.65,13.8],[14.92,1.32,0],0x52636a,cube);
    sign(floor,'РАЗДЕВАЛКИ · ДУШ',2.45,-6.81,5.0,C.paper,textures,materials);floor.children.at(-1)!.position.x=11.75;
    for(const x of [-6,-2,2,6,10,14])for(const z of [-5.8,1.0,5.2]){
      shape(floor,[1.2,.08,.16],[x,2.68,z],0xf8e9ce,cube);
    }
    for(const x of [-8.1,8.0])shape(floor,[.14,1.65,.10],[x,.83,-6.76],0x17272d,cube);
    const clerk=marketCashier(resources,{title:'Администратор',color:0x167d78,shirt:0xeeeeee,animated:true});clerk.position.set(-6.7,0,6.37);clerk.rotation.y=Math.PI;root.add(clerk);
    animateCafe=(seconds)=>{const motion=clerk.userData.motion as {head:THREE.Group;arms:THREE.Group[]};motion.head.rotation.y=Math.sin(seconds*.48)*.10;motion.arms.forEach((a,i)=>a.rotation.x=Math.sin(seconds*.7+i)*.04);};
  } else if(place==='industrial'){
    shape(floor,[18.8,.35,13.5],[0,-.20,.25],0x646c63,cube);
    shape(floor,[18.5,.055,13.2],[0,-.026,.25],0xb9bcb2,cube);
    shape(floor,[18.3,.024,3.2],[0,.008,3.65],0x646e74,cube);
    for(let i=0;i<11;i++)shape(floor,[.85,.013,.055],[-8.2+i*1.64,.026,3.65],0xe2ddca,cube);
    shape(floor,[3.1,.023,3.4],[-2.75,.009,5.0],0x646e74,cube);
    for(const x of [-4.65,4.65]){
      shape(floor,[5.8,.02,1.2],[x,.013,.74],0xd7d5c8,cube);
      for(const side of [-1,1])shape(floor,[.065,.012,1.16],[x+side*2.77,.031,.74],0xe3c55e,cube);
    }
    for(const x of [-8.65,8.65])for(const z of [-5.5,-1.1,5.9]){
      shape(floor,[.10,2.6,.10],[x,1.30,z],0x555e63,drum);
      shape(floor,[.30,.09,.20],[x,2.61,z],0xe1d9b8,cube);
    }
    for(let i=0;i<11;i++){
      const x=-8.8+i*1.76;
      shape(floor,[.07,1.2,.07],[x,.60,-5.85],0x626e70,cube);
      if(i<10)shape(floor,[1.72,.75,.035],[x+.88,.65,-5.85],0xa5ada7,cube);
    }
  } else if(place==='electronics'){
    shape(floor,[17.3,.40,10.3],[2.5,-.23,0],0x526774,softCube,true);
    shape(floor,[17,.06,10],[2.5,-.031,0],0xc6d3d9,cube);
    for(let x=-5.5;x<11;x++)for(let z=-4.5;z<5;z++)shape(floor,[.98,.012,.98],[x,.003,z],Math.round(x+z)%2?0xc0cdd4:0xd7e1e5,cube);
    shape(floor,[17.2,2.91,.19],[2.5,1.46,-5.01],0xbbcec3,cube);
    shape(floor,[.19,2.91,10.1],[-6.05,1.46,0],0xa4b8b1,cube);
    shape(floor,[16.9,.49,.025],[2.5,.51,-4.895],0x536e80,cube);
    shape(floor,[4.15,.02,7.6],[8.2,.017,-.5],0xaebfce,cube);
    sign(floor,'ИГРОВОЙ ОТДЕЛ',2.5,-4.88,3.4,C.paper,textures,materials);floor.children.at(-1)!.position.x=8.15;
  } else if (place === 'market') {
    buildMarket(floor, resources);
    root.add(marketCashier(resources));
  } else if (place === 'education') buildEducationCenter(floor, resources);
  else if (!animateWork) {
    shape(floor, [outdoor?21.3:12.3, .40, outdoor?14.3:10.3], [outdoor?2.5:0, -.23, 0], outdoor ? 0x536649 : C.walnut, softCube, true);
    shape(floor, [outdoor?21:12, .06, outdoor?14:10], [outdoor?2.5:0, -.031, 0], outdoor ? 0xa7b586 : 0xc69b6c, cube);
    if (!outdoor) {
      const map=painted(resources,512,512,ctx=>{const colors=place==='cafe'?['#ad8259','#c39b70','#d0af87','#b88d60']:place==='petshop'?['#b5c7b1','#d3decd','#c2d0bf','#a9bda7']:['#c9b7b9','#e2d4cf','#d1c0c1','#bca6aa'];ctx.fillStyle='#8d8a80';ctx.fillRect(0,0,512,512);const tw=place==='cafe'?32:64,th=place==='cafe'?112:64;for(let j=0;j*th<512;j++)for(let i=-1;i*tw<512;i++){const x=i*tw+(j%2)*tw*.5,y=j*th;ctx.fillStyle=colors[((i+4)*3+j*5)%4];ctx.fillRect(x+1,y+1,tw-2,th-2);ctx.fillStyle='#ffffff36';ctx.fillRect(x+2,y+2,tw-4,1);if(place==='cafe')for(let k=0;k<4;k++){ctx.fillStyle='#714e3030';ctx.fillRect(x+4+k*6,y+3,1,th-6);}}});
      const surface=new THREE.MeshStandardMaterial({map,color:map?0xffffff:0xc5ae91,roughness:.88});materials.push(surface);const tile=new THREE.Mesh(plane,surface);tile.rotation.x=-Math.PI/2;tile.scale.set(12,10,1);tile.position.y=.003;floor.add(tile);
      shape(floor, [12.2, 2.91, .19], [0, 1.46, -5.01], place === 'cafe' ? 0xd3b89b : 0xbbcec3, cube);
      shape(floor, [.19, 2.91, 10.1], [-6.05, 1.46, 0], place === 'cafe' ? 0x9fac88 : 0xa4b8b1, cube);
      // Store-specific wall cladding in the existing rear wall footprint.
      const accent=place==='cafe'?0x627d68:place==='petshop'?0x82a28a:0xa88992;
      shape(floor,[11.9,.49,.025],[0,.51,-4.895],accent,cube);
      for (const y of [.25, .78, 2.86]) {
        shape(floor, [12.2, .13, .23], [0, y, -4.95], C.paper);
        shape(floor, [.23, .13, 10.1], [-5.99, y, 0], C.paper);
      }
    }
  }
  if(place==='petshop'){
    sign(floor,'ЛАПКИ · ЗООМАГАЗИН',2.55,-4.88,4.5,C.paper,textures,materials);
    shape(floor,[2.6,.025,3.3],[0,.016,.25],0xa9c5a6,cube);
    const cashier=marketCashier(resources,{title:'Продавец',color:0x588e72,shirt:0xf4e3c8,animated:true});cashier.position.set(3.65,0,.48);root.add(cashier);
    animateCafe=(seconds)=>{const motion=cashier.userData.motion as {head:THREE.Group;arms:THREE.Group[]};motion.head.rotation.y=Math.sin(seconds*.48)*.13;motion.arms.forEach((a,i)=>a.rotation.x=Math.sin(seconds*.7+i)*.055);};
  }
  if(place==='electronics'){
    sign(floor,'ИМПУЛЬС · ТЕХНИКА',2.55,-4.88,4.5,C.paper,textures,materials);
    shape(floor,[2.6,.025,3.3],[0,.016,.25],0xaebec8,cube);
    const cashier=marketCashier(resources,{title:'Продавец',color:0x396d8c,shirt:0xe2edf1,animated:true});cashier.position.set(3.65,0,.48);root.add(cashier);
    animateCafe=(seconds)=>{const motion=cashier.userData.motion as {head:THREE.Group;arms:THREE.Group[]};motion.head.rotation.y=Math.sin(seconds*.48)*.13;motion.arms.forEach((a,i)=>a.rotation.x=Math.sin(seconds*.7+i)*.055);};
  }
  if(place==='clothing'){
    sign(floor,'СТИЛЬ',2.55,-4.88,3.2,C.paper,textures,materials);
    shape(floor,[2.5,.025,3.1],[0,.016,-.28],0xc6b7c4,cube);
    for(const x of [-4.55,4.55]){
      shape(floor,[1.38,.08,.50],[x,.78,-4.32],0xded1be);
      for(let i=0;i<3;i++)shape(floor,[.35,.12,.35],[x+(i-1)*.39,.88,-4.32],accents[i]);
    }
  }
  if (place === 'park') {
    shape(floor, [3.12, .23, 2.53], [-.08, .13, -1.94], C.limestone, softCube, true);
    shape(floor, [2.88, .10, 2.28], [-.08, .25, -1.94], 0x79aeb4);
    for (const [x, z] of [[-1, -2.3], [.6, -2.5], [.93, -1.2]]) {
      shape(floor, [.15, .034, .125], [x, .313, z], C.leaf, drum);
      shape(floor, [.049, .06, .039], [x - .01, .344, z], 0xd1a6a2, orb);
    }
  }
  if (outdoor) {
    const greenery=new THREE.Group();
    greenery.name='Park landscaping';
    root.add(greenery);
    animatePark=parkLandscaping(greenery,resources);
    for (const [x, z] of [[-1.93, -3.84], [1.87, -3.84], [2.9, 4.77]]) {
      shape(floor, [.064, 1.89, .064], [x, .95, z], C.ink, drum);
      const bulb = shape(floor, [.13, .14, .13], [x, 1.98, z], C.paper, orb) as typeof bulbs[number];
      bulb.material = bulb.material.clone();
      bulb.material.emissive.setHex(0xffbc68);
      materials.push(bulb.material);
      bulbs.push(bulb);
    }
  } else if (place === 'cafe') {
    shape(floor, [4.6, .65, .54], [0, .37, -4.56], C.clay);
    shape(floor, [4.58, .55, .18], [0, .83, -4.73], C.coral);
    const coffee = new THREE.Group();
    coffee.position.set(1.1, 0, -4.2);
    shape(coffee, [1.36, 1.0, .67], [0, .51, 0], C.oak);
    shape(coffee, [.64, .54, .38], [-.21, 1.30, -.07], C.ink);
    shape(coffee, [.51, .085, .27], [-.21, 1.19, .15], C.brass);
    for (const x of [-.40, -.11, .40]) shape(coffee, [.087, .11, .087], [x, 1.105, .17], C.paper, drum);
    floor.add(coffee);
    batchRigidParts(coffee);
    const cashier=marketCashier(resources,{title:'Кассир',color:0x8b5142,shirt:0xf0d9b6,animated:true});
    cashier.position.set(-1.35,0,-3.92);
    cashier.rotation.y=0;
    root.add(cashier);
    animateCafe=(seconds)=>{const motion=cashier.userData.motion as {head:THREE.Group;arms:THREE.Group[]};motion.head.rotation.y=Math.sin(seconds*.48)*.13;motion.arms.forEach((a,i)=>a.rotation.x=Math.sin(seconds*.7+i)*.055);};
    shape(floor,[1.85,1.00,.56],[-1.35,.50,-3.36],C.walnut,softCube,true);
    shape(floor,[1.96,.10,.65],[-1.35,1.04,-3.36],C.oat);
    shape(floor,[.37,.27,.14],[-1.65,1.22,-3.39],C.ink);
    sign(floor, 'ТЁПЛЫЙ УГОЛ', 2.18, -4.89, 3.02, C.paper, textures, materials);
  }
  batchRigidParts(floor, place === 'market' || place === 'education' || Boolean(animateWork));
  for (const station of STATIONS[place]) {
    const custom = place === 'fitness' ? fitnessStation(station,textures,materials) : place === 'market' ? marketStation(station, resources)
        : place === 'education' ? educationStation(station, resources)
          : isCareerPlace(place)&&station.action.kind==='career' ? careerStation(station,careerAt(place),resources) : null;
    const group = custom ?? buildStation(station, textures, materials);
    stations.set(station.id, group);
    root.add(group);
  }
  root.updateMatrixWorld(true);
  const corners = ({ min, max }: THREE.Box3): XYZ[] => {
    const result: XYZ[] = [];
    for (const x of [min.x,max.x]) for (const y of [min.y,max.y]) for (const z of [min.z,max.z]) result.push([x,y,z]);
    return result;
  };
  const horizontal = (place==='fitness'||place==='clinic'||place==='barber'||place==='electronics')?corners(new THREE.Box3().setFromObject(root)):place === 'market' ? marketOutline
    : [...stations.values()].flatMap(station => corners(new THREE.Box3().setFromObject(station)));
  const vertical = corners(new THREE.Box3().setFromObject(root));
  return {
    root, stations, horizontal, vertical,
    animate: animateWork ?? animatePark ?? animateCafe,
    setNight(night: boolean) { for (const bulb of bulbs) bulb.material.emissiveIntensity = night ? 1.2 : .02; },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>();
      root.traverse(object => {
        if ((object instanceof THREE.Mesh || object instanceof THREE.LineSegments) && !shared.has(object.geometry))
          geometries.add(object.geometry);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const map of textures) map.dispose();
      for (const material of materials) material.dispose();
      root.clear();
    },
  };
}

export function homeExtensions() {
  const group = new THREE.Group();
  const stations = new Map<string, THREE.Group>();
  const doors = new Map<string, THREE.Group>();
  const stock = new Map<string, THREE.Group[]>();
  const parcel = new THREE.Group();
  let gateLeaf:THREE.Group|undefined;
  for (const station of HOME_STATIONS) {
    // World owns car geometry; never create a generic wall cupboard for it.
    if (station.action.kind === 'waypoint'||station.action.kind==='courier'||station.action.kind==='car') continue;
    if(station.action.kind==='wardrobe'){
      const cabinet=buildFurnishingModel('wardrobe-tall',station.id==='wardrobe-alina'?'ivory':'oak');
      cabinet.position.set(station.center.x,0,station.center.z);
      cabinet.rotation.y=Math.PI;
      group.add(cabinet);stations.set(station.id,cabinet);continue;
    }
    if (station.action.kind === 'career') {
      const laptop = careerStation(station,'marketing');
      group.add(laptop); stations.set(station.id,laptop); continue;
    }
    const root = new THREE.Group();
    root.position.set(station.center.x, 0, station.center.z);
    group.add(root);
    stations.set(station.id, root);
    if (station.action.kind === 'door') {
      root.rotation.y = Math.PI;
      shape(root, [1.15, .08, .36], [0, .06, 0], C.pine);
      shape(root, [.74, .07, .11], [0, .105, .09], C.brass);
      if(station.id==='home-gate'){
        gateLeaf=new THREE.Group();gateLeaf.position.set(-.67,.08,0);
        for(const y of [.17,.47])shape(gateLeaf,[1.34,.09,.09],[.67,y,0],C.oak);
        for(let i=0;i<6;i++)shape(gateLeaf,[.135,.55,.065],[.12+i*.22,.30,0],C.walnut);
        shape(gateLeaf,[.07,.10,.10],[1.17,.34,.065],C.brass);
        root.add(gateLeaf);
      }
    } else if (station.action.kind === 'parcel') {
      const marker = shape(root, [.55, .035, .31], [0, .028, 0], C.oat);
      marker.name = 'parcel-mat';
      packageBox(parcel, 0, 0, C.oat);
      packageBox(parcel, .34, -.07, C.coral).scale.setScalar(.71);
      root.add(parcel);
      parcel.visible = false;
    } else if (station.action.kind === 'unpack') {
      // The visible shopping bags are rendered by World only while purchases await unpacking.
    } else {
      const fridge = station.action.kind === 'fridge';
      const shelves = new THREE.Group();
      const h = fridge ? 2.10 : .81;
      const w = station.width;
      const d = station.depth;
      if (!fridge) root.position.y = 1.34;
      shape(root, [w, .10, d], [0, h, 0], C.limestone);
      shape(root, [w, .10, d], [0, .11, 0], C.limestone);
      shape(root, [w, h, .06], [0, h / 2, -d * .45], C.oat, cube);
      for (const x of [-w / 2, w / 2]) shape(root, [.075, h, d], [x, h / 2, 0], C.limestone);
      root.add(shelves);
      for (const y of [h * .18, h * .47, h * .74]) shape(shelves, [w - .10, .035, d - .07], [0, y, 0], 0xf3e6cc);
      const products: THREE.Group[] = [];
      for (let i = 0; i < 9; i++) {
        const p = new THREE.Group();
        const level = Math.floor(i / 3);
        p.position.set((i % 3 - 1) * w * .25, h * [.18, .47, .74][level] + .02, 0);
        if (!fridge) p.scale.setScalar(.77);
        shape(p, [.15, .19, .13], [0, .10, 0], accents[i % accents.length]);
        shape(p, [.11, .063, .015], [0, .108, .069], C.paper, cube);
        shelves.add(p); products.push(p);
      }
      stock.set(station.id, products);
      const door = new THREE.Group();
      door.position.set(-w / 2, 0, d / 2);
      if (fridge) {
        shape(door, [w, 1.39, .085], [w / 2, .74, 0], 0xd9e2db, softCube, true);
        shape(door, [w, .60, .085], [w / 2, 1.76, 0], 0xd9e2db, softCube, true);
        for (const y of [1.18, 1.67]) shape(door, [.055, .29, .08], [w * .82, y, .067], C.brass);
        shape(door, [.18, .13, .018], [.30, 1.94, .055], C.pine);
        shape(door, [.15, .17, .012], [.33, 1.03, .055], C.paper).rotation.z = -.13;
        shape(door, [.045, .045, .023], [.33, 1.105, .067], C.coral);
      } else {
        shape(door, [w, h - .07, .067], [w / 2, h / 2, 0], C.walnut, softCube, true);
        shape(door, [.039, .22, .057], [w * .85, h * .54, .065], C.brass);
      }
      root.add(door);
      doors.set(station.id, door);
    }
  }
  return { group, stations, doors, stock, parcel,gateLeaf };
}

export function carryingBag() {
  const root = new THREE.Group();
  const bag = packageBox(root, 0, 0, C.oat);
  bag.scale.setScalar(.74);
  return root;
}
