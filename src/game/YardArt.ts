import * as THREE from 'three';
import { GRILL_RECIPES, type RecipeId } from '../shared/food';
import { DINING_TOP, HOUSE_ENTRY, HOME_YARD, HOME_FLOOR, furniturePosition } from '../shared/home';
import { batchRigidParts, colors as C, cube, drum, finish, orb, paintedMap, panel, plane, softCube, type XYZ } from './ArtKit';

import {seasonalMaterial} from './SeasonalPalette';
import { snowPreview } from './LandscapePalette';
import { growFlowers, growShrub, PlantBatch } from './LandscapePlants';
import { canopyShade, limestone, paintGround } from './LandscapeGround';

const edging = 0xb29e83;
const flagstone = 0xc8b59b;
const lawn = snowPreview()?0xf2f6ff:0xffffff;

function shape(parent: THREE.Object3D, size: XYZ, position: XYZ, color: number,
  geometry: THREE.BufferGeometry = softCube, shadow = false, surface: Parameters<typeof finish>[1] = 'fabric') {
  const mesh = new THREE.Mesh(geometry, finish(color, surface));
  mesh.scale.set(...size);
  mesh.position.set(...position);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function turf() {
  return paintedMap('home-yard-turf', 512, 320, ctx => {
    paintGround(ctx, {x:0,z:8.73,w:12.18,d:6.80}, [
      {x:-5.18,z:9.53,w:2.25,d:5.33,ink:[92,131,80],opacity:.47},
      {x:-2.8,z:9.51,w:4.62,d:2.79,ink:[181,196,123],opacity:.63},
      {x:3.5,z:10.5,w:2.8,d:3.6,ink:[165,185,116],opacity:.34},
    ], 5371, 'lawn');
    const area={x:0,z:8.73,w:12.18,d:6.8};
    for(let n=0;n<7;n++)canopyShade(ctx,area,-5.58,7.4+n*.65,.81,733+n);
    // Broad contact shade beneath the fixed fence, which follows the plot edge.
    for(const side of [-1,1]){
      const x=side<0?0:512;
      const shade=ctx.createLinearGradient(x,0,x-side*30,0);
      shade.addColorStop(0,'#38452f65');shade.addColorStop(1,'#38452f00');
      ctx.fillStyle=shade;ctx.fillRect(side<0?0:482,0,30,320);
    }
  });
}

function paving() {
  return paintedMap('home-yard-paving', 256, 384, ctx => {
    limestone(ctx,0,0,256,384,88,34,2357);
  });
}

function flat(parent: THREE.Group, x: number, y: number, z: number, width: number, depth: number,
  map: THREE.Texture | null, color: number) {
  const ground=panel(parent,[x,y,z],[width,depth],map,color);ground.rotation.x=-Math.PI/2;
  seasonalMaterial(ground.material as THREE.Material,'lawn');
}

function skewerFood(recipe: RecipeId, food: THREE.Group) {
  const vegetables = recipe === 'grillVegetables';
  for (const [i, x] of [-.069, .036].entries()) {
    shape(food, [.014, .016, .276], [x, .016, 0], C.oat, cube, false, 'wood');
    for (const [j, z] of [-.078, -.026, .029, .082].entries()) {
      const colors = vegetables ? [0x9a9e58, 0xc57a3f, 0xb86448] : [0x945441, 0xd09459, 0xa88b50];
      shape(food, [.064, .048, .048], [x, .033, z], colors[(i + j) % colors.length], softCube, false, 'wood');
      if (!vegetables && j % 2 === 0) shape(food, [.045, .006, .010], [x, .058, z], 0x704832, cube, false, 'wood');
    }
  }
}

let foodModels: THREE.Group | undefined;
export function grilledFood(): THREE.Group {
  if (foodModels) return foodModels.clone();
  const food = new THREE.Group();
  food.name = 'Grilled serving';
  for (const recipe of GRILL_RECIPES) {
    const serving = new THREE.Group();
    serving.name = recipe;
    if (recipe === 'grillSteak') {
      shape(serving, [.138, .044, .218], [0, .031, 0], 0x995947, softCube, false, 'wood').rotation.y = .15;
      for (const z of [-.055, -.02, .02, .057])
        shape(serving, [.109, .008, .009], [0, .055, z], 0x694132, cube, false, 'wood').rotation.y = -.19;
    } else if (recipe === 'grillBurgers') {
      for (const [y, radius, h, color] of [[.027, .103, .035, 0xc88e55], [.052, .10, .024, 0x815345],
        [.067, .111, .012, 0x688253], [.085, .108, .031, 0xe0a761]]) {
        const bun = shape(serving, [radius, h, radius], [0, y, 0], color, drum, false, 'wood');
        bun.rotation.y = .12;
      }
    } else {
      skewerFood(recipe, serving);
    }
    batchRigidParts(serving, true);
    serving.visible = false;
    food.add(serving);
  }
  foodModels = food;
  return foodModels.clone();
}

export function selectGrilledFood(group: THREE.Object3D, recipe: RecipeId): void {
  for (const meal of group.children) meal.visible = meal.name === recipe;
}

function grillAndTable() {
  const grill = new THREE.Group();
  const grillPosition = furniturePosition('grill');
  grill.position.set(grillPosition.x, 0, grillPosition.z);
  for (const x of [-.39, .39]) for (const z of [-.24, .24]) {
    shape(grill, [.063, .68, .063], [x, .35, z], C.ink, cube);
  }
  shape(grill, [.89, .11, .50], [0, .22, 0], C.ink, softCube);
  shape(grill, [1.12, .27, .70], [0, .72, 0], 0x39474a, softCube, true, 'metal');
  for (let i = -4; i <= 4; i++)
    shape(grill, [.026, .023, .55], [.105 * i, .865, .016], 0x9b9b8a, cube, false, 'metal');
  const lid = new THREE.Group();
  lid.position.set(0, .87, -.33);
  shape(lid, [.52, .25, .31], [0, .04, .288], C.ink, orb, true, 'metal');
  shape(lid, [.37, .05, .076], [0, .09, .65], C.oak, softCube, false, 'wood');
  for (const x of [-.22, 0, .22]) {
    shape(grill, [.049, .043, .049], [x, .67, .368], C.oat, drum).rotation.x = Math.PI / 2;
  }
  batchRigidParts(lid, true);
  batchRigidParts(grill, true);
  const contents = grilledFood();
  contents.scale.setScalar(2);
  contents.position.set(.11, .867, .028);
  contents.visible = false;
  grill.add(lid, contents);
  // A few reusable ember glows and rising smoke puffs, visible ONLY while
  // grilling. No particles, dynamic geometry, or new textures per frame.
  const embers = new THREE.Group();
  for(let i=0;i<6;i++){
    const glow=new THREE.Mesh(orb,new THREE.MeshBasicMaterial({
      color:i%2?0xe88732:0xdf5b32,transparent:true,opacity:.88,depthWrite:false
    }));
    glow.position.set((i%3-1)*.23,.827,Math.floor(i/3)*.18-.10);
    glow.scale.set(.075,.035,.05);
    embers.add(glow);
  }
  embers.visible=false;
  const smoke = new THREE.Group();
  for(let i=0;i<5;i++){
    const puff=new THREE.Mesh(orb,new THREE.MeshBasicMaterial({
      color:0xd5d6cd,transparent:true,opacity:.12,depthWrite:false
    }));
    puff.scale.setScalar(.08);
    smoke.add(puff);
  }
  smoke.visible=false;
  grill.add(embers,smoke);

  const table = new THREE.Group();
  const { x, z } = furniturePosition('yardTable');
  table.position.set(x, 0, z);
  for (const dz of [-.30, -.10, .10, .30])
    shape(table, [1.91, .095, .193], [0, DINING_TOP - .047, dz], C.oak, softCube, true, 'wood');
  for (const dx of [-.76, .76]) {
    shape(table, [.13, .118, 1.15], [dx, .38, .24], C.walnut, cube, false, 'wood');
    for (const dz of [-.25, .30])
      shape(table, [.104, .74, .115], [dx, .391, dz], C.walnut, softCube, true, 'wood');
  }
  // Two broad upholstered seats, keeping the original seat height/food anchors.
  shape(table,[1.94,.14,.53],[0,.415,.72],C.walnut,softCube,true,'wood');
  for(const dx of [-.47,.47]){
    shape(table,[.91,.09,.49],[dx,.476,.72],0x81978a,softCube,true,'fabric');
    shape(table,[.90,.42,.13],[dx,.73,.975],0x9caf9b,softCube,true,'fabric');
    shape(table,[.23,.25,.13],[dx+(dx<0?-.29:.29),.72,.88],0xd8b18d,softCube,false,'fabric');
  }
  for(const dx of [-.95,.95])shape(table,[.11,.16,.47],[dx,.64,.72],C.walnut,softCube,true,'wood');
  for (const dx of [-.71, .71])
    shape(table, [.102, .433, .18], [dx, .225, .80], C.walnut, softCube, true, 'wood');
  // The woven runner folds over both lips of the fixed picnic tabletop.
  shape(table,[.32,.007,.82],[-.53,DINING_TOP+.003,0],0xb96e58,cube);
  for(const dz of [-.409,.409]){
    shape(table,[.32,.13,.008],[-.53,DINING_TOP-.06,dz],0xb96e58,cube);
    for(const stripe of [-.106,.106]){
      shape(table,[.022,.12,.010],[-.53+stripe,DINING_TOP-.06,dz],C.oat,cube);
      if(dz>0)shape(table,[.022,.008,.82],[-.53+stripe,DINING_TOP+.004,0],C.oat,cube);
    }
  }
  // A small decorative hookah at the outer edge, clear of the meal plates.
  const hx=.80,hz=-.16;
  shape(table,[.20,.025,.20],[hx,DINING_TOP+.013,hz],C.ink,drum,false,'metal');
  shape(table,[.16,.22,.16],[hx,DINING_TOP+.12,hz],0x527f89,orb,false,'ceramic');
  shape(table,[.048,.25,.048],[hx,DINING_TOP+.31,hz],C.brass,drum,false,'metal');
  shape(table,[.14,.026,.14],[hx,DINING_TOP+.41,hz],C.ink,drum,false,'metal');
  shape(table,[.075,.065,.075],[hx,DINING_TOP+.455,hz],0x967c69,drum,false,'ceramic');
  batchRigidParts(table, true);

  const shadeMap=paintedMap('picnic-contact',64,48,ctx=>{
    ctx.scale(32,24);
    const shade=ctx.createRadialGradient(1,1,.26,1,1,1);
    shade.addColorStop(0,'#4036266b');shade.addColorStop(.56,'#40362640');shade.addColorStop(1,'#40362600');
    ctx.fillStyle=shade;ctx.fillRect(0,0,2,2);
  });
  if(shadeMap){
    const shadow=new THREE.Mesh(plane,new THREE.MeshBasicMaterial({map:shadeMap,transparent:true,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2;shadow.scale.set(2.18,1.54,1);shadow.position.set(0,.014,.19);
    shadow.raycast=()=>{};
    table.add(shadow);
  }

  const platter = new THREE.Group();
  platter.name = 'Grill platter';
  platter.position.set(x, DINING_TOP, z);
  const servings = new Map<RecipeId, THREE.Group>();
  for (const [i, recipe] of GRILL_RECIPES.entries()) {
    const plate = new THREE.Group();
    plate.position.set((i - 1.5) * .39, 0, -.14);
    shape(plate, [.175, .033, .15], [0, .021, 0], C.paper, drum, false, 'ceramic');
    const serving = grilledFood();
    serving.position.y = .039;
    serving.rotation.y = Math.PI / 2;
    selectGrilledFood(serving, recipe);
    plate.add(serving);
    plate.visible = false;
    platter.add(plate);
    servings.set(recipe, plate);
  }
  platter.visible = false;
  return { grill, table, lid, contents, platter, servings, embers, smoke };
}

function fence(yard: THREE.Group): void {
  const { gate, sideOpening } = HOME_YARD;
  const left = gate.x - gate.width / 2;
  const right = gate.x + gate.width / 2;
  const drivewayEdge = 3.1;
  for (const [start, end] of [[-6, left], [right, drivewayEdge], [drivewayEdge, 6]]) {
    const center = (start + end) / 2;
    const width = end - start - .04;
    shape(yard, [width, .21, .23], [center, .105, gate.z], edging, cube);
    shape(yard, [width, .57, .09], [center, .495, gate.z], C.oak, cube, false, 'wood');
    shape(yard, [width, .075, .15], [center, .815, gate.z], C.oat, softCube, false, 'wood');
  }
  for (const x of [-6, left, right, drivewayEdge, 6]) {
    shape(yard, [.18, .94, .22], [x, .47, gate.z], C.walnut, softCube, false, 'wood');
    shape(yard, [.23, .07, .26], [x, .95, gate.z], C.oat, softCube);
  }
  shape(yard, [1.30, .025, .43], [gate.x, .016, gate.z - .14], C.oat);
  for(const [x,a,b] of [[-5.98,5.22,10.12],[5.98,5.22,sideOpening.minZ],[5.98,sideOpening.maxZ,10.12]]){
    const d=b-a,z=(a+b)/2;
    shape(yard,[.23,.21,d],[x,.105,z],edging,cube);
    shape(yard,[.115,.58,d],[x,.50,z],C.oak,cube,false,'wood');
    shape(yard,[.16,.075,d],[x,.82,z],C.oat,cube,false,'wood');
    for(const at of [a+.10,b-.10]){shape(yard,[.19,.94,.20],[x,.47,at],C.walnut,softCube,false,'wood');shape(yard,[.25,.07,.25],[x,.95,at],C.oat,softCube);}
  }
}

function garden(yard: THREE.Group): void {
  const { x, z: center } = HOME_YARD.planter;
  shape(yard, [.58, .22, 3.8], [x, .115, center], C.walnut, softCube, false, 'wood');
  shape(yard, [.49,.031,3.69], [x,.219,center], 0x6d503b, softCube);
  const plants = new PlantBatch();
  for (const [i, dz] of [-1.58,-.89,-.19,.50,1.24].entries()) {
    growShrub(plants,x,.225,center+dz,.42,.43,.59,i%3,700+i*71);
    growFlowers(plants,x+.03,.255,center+dz+.18,.39,.50,i%4,8,737+i*88);
  }
  // Climbing roses on a timber espalier within the existing planter.
  for(const dz of [-1.66,0,1.66])
    shape(yard,[.045,1.37,.045],[x-.13,.90,center+dz],C.walnut,cube,false,'wood');
  for(const y of [.58,.89,1.20,1.50])
    shape(yard,[.036,.028,3.46],[x-.13,y,center],C.oak,cube,false,'wood');
  const blush=[0xc84c75,0xf293ab,0xffc4d3];
  for(let cane=0;cane<6;cane++){
    const z=center-1.43+cane*.55;
    const top=.89+.52*Math.abs(Math.sin(cane*1.80+.31));
    plants.stem(0x6b7154,[x,.25,z-.09],[x-.12,top,z+.12],.023);
    for(let j=0;j<6;j++){
      const y=.46+(top-.46)*j/5, angle=cane*2.4+j*1.86;
      const p:XYZ=[x-.07+Math.cos(angle)*.075,y,z+j*.036];
      plants.blade(j%2?0x708b60:0x48715c,p,[.098,.09,.16],angle,-.5);
      if(j>=2){plants.bloom(blush[(cane+j)%3],p,.115,angle,.75);if(j%2===0)plants.bloom(blush[(cane+j+1)%3],[p[0]+.08,p[1]-.06,p[2]+.08],.078,angle+.8,.5);}
    }
  }
  plants.attach(yard,'Flowers and shrubs in the family garden');
  // The mailbox and its light are fixed to the gate post, outside the
  // furniture placement surface and the open central lane.
  const { gate }=HOME_YARD;
  const post=gate.x-gate.width/2-.23;
  shape(yard,[.32,.24,.25],[post,.72,gate.z+.10],0x52766a,softCube,false,'metal');
  shape(yard,[.21,.023,.034],[post,.75,gate.z+.235],0xd6be95,cube,false,'metal');
  shape(yard,[.12,.057,.17],[post,.87,gate.z+.10],0xe4c9a0,softCube);
}

function eveningGarden(parent:THREE.Group){
  const glow=paintedMap('yard-lantern-pool',64,64,ctx=>{const g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,201,115,.58)');g.addColorStop(.45,'rgba(255,181,89,.24)');g.addColorStop(1,'rgba(255,181,89,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);});
  const night=new THREE.Group();night.name='Warm garden lantern pools';night.visible=false;
  if(glow){const material=new THREE.MeshBasicMaterial({map:glow,transparent:true,depthWrite:false});const positions:number[]=[],uvs:number[]=[],indices:number[]=[];for(const [x,z] of [[.48,6.15],[.48,10.95],[-4.95,8.15]]){const j=positions.length/3;positions.push(x-1.05,.017,z-1.05,x+1.05,.017,z-1.05,x+1.05,.017,z+1.05,x-1.05,.017,z+1.05);uvs.push(0,0,1,0,1,1,0,1);indices.push(j,j+2,j+1,j,j+3,j+2);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);const mesh=new THREE.Mesh(geo,material);mesh.raycast=()=>{};night.add(mesh);}
  parent.add(night);return night;
}

export function buildYard(scene: THREE.Scene) {
  const yard = new THREE.Group();
  const plot=HOME_FLOOR,w=plot.maxX-plot.minX+.5,d=plot.maxZ-plot.minZ+.9;
  const cx=(plot.maxX+plot.minX)/2,cz=(plot.maxZ+plot.minZ)/2;
  shape(yard,[w,.26,d],[cx,-.39,cz],0x94775e,cube);
  const base=shape(yard,[w,.10,d],[cx,-.079,cz],snowPreview()?0xe1e8ec:0x82965d,cube);
  base.material=seasonalMaterial(base.material.clone(),'lawn');
  for(const x of [plot.minX-.24,plot.maxX+.24]){
    shape(yard,[.14,.82,d],[x,.41,cz],C.oak,cube);
  }
  shape(yard,[w,.82,.14],[cx,.41,plot.minZ-.24],C.oak,cube);
  for(const [a,b] of [[plot.minX-.24,-6],[6,plot.maxX+.24]]){
    shape(yard,[b-a,.82,.14],[(a+b)/2,.41,HOME_YARD.gate.z],C.oak,cube);
  }
  shape(yard, [12.52, .50, 6.66], [0, -.36, 8.91], 0x94775e, cube);
  const turfBase=shape(yard,[12.25,.11,6.92],[0,-.071,8.70],0x69764f,softCube);
  turfBase.material=seasonalMaterial(turfBase.material.clone(),'lawn');
  // Leave a depth gap above the deck for the wider home's overview camera.
  flat(yard, 0, -.005, 8.73, 12.18, 6.80, turf(), lawn);

  // Painted lawn extension covers the formerly empty parking-side reserve.
  const extension=paintedMap('right-yard-v6',512,320,ctx=>paintGround(ctx,{x:12.05,z:8.63,w:12.1,d:6.35},[],9721,'lawn'));
  flat(yard,12.05,-.009,8.63,12.1,6.35,extension,lawn);
  const added=HOME_YARD.gate.z-12.06,newZ=12.06+added/2;
  for(const [a,b,seed] of [[plot.minX-.12,HOUSE_ENTRY.x,5301],[HOUSE_ENTRY.x,plot.maxX+.12,5302]]){
    const area={x:(a+b)/2,z:newZ,w:b-a,d:added};
    flat(yard,area.x,-.008,area.z,area.w,area.d,paintedMap('oasis-lawn-'+seed,512,256,ctx=>paintGround(ctx,area,[],seed,'lawn')),lawn);
  }
  const { x } = HOUSE_ENTRY;
  const { parking } = HOME_YARD;
  const stones=paving();
  const stoneFinish=new THREE.MeshStandardMaterial({map:stones,color:stones?0xffffff:flagstone,roughness:.93});
  for(const [px,y,z,width,depth] of [[x,.006,(HOUSE_ENTRY.z+HOME_YARD.gate.z)/2,1.88,HOME_YARD.gate.z-HOUSE_ENTRY.z],[-3.51,.004,6.67,4.24,2.75],
    [parking.x,.004,parking.z,2.84,5.98],[parking.x,.004,(parking.z+2.99+HOME_YARD.gate.z)/2,2.84,HOME_YARD.gate.z-parking.z-2.99],[1.96,.005,11.27,1.12,1.17],[7.40,.006,8.25,10.8,1.56]]){
    const strip=new THREE.Mesh(plane,stoneFinish);
    strip.rotation.x=-Math.PI/2;
    strip.position.set(px,y,z);strip.scale.set(width,depth,1);
    yard.add(strip);
  }
  for (const dx of [-2.37, -1.92, -1.47]) {
    shape(yard, [.40, .045, .58], [x + dx, -.005, 7.16], flagstone, softCube);
  }
  for (const dx of [-1.23, 1.23]) {
    shape(yard, [.055, .012, 4.69], [parking.x + dx, .01, parking.z + .08], C.paper, cube);
  }
  shape(yard, [2.50, .012, .055], [parking.x, .01, parking.z+2.26], C.paper, cube);
  shape(yard, [1.59, .105, .14], [parking.x, .054, parking.z + 2.52], 0x8a7e6d, softCube);

  // Built-in lounge: level timber deck and wall-mounted open pergola.
  // No ground posts in the existing grill, seating or pet routes.
  shape(yard,[4.78,.036,3.04],[-3.38,-.018,6.77],0xab8863,cube,false,'wood');
  for(let i=0;i<24;i++)shape(yard,[.188,.009,3.0],[-5.62+i*.19,.003,6.77],i%3===0?0xc0a17b:0xb69a78,cube,false,'wood');
  for(const x of [-5.62,-3.38,-1.14]){
    shape(yard,[.11,2.35,.10],[x,1.18,5.27],C.walnut,cube,false,'wood');
    shape(yard,[.10,.14,1.12],[x,2.31,5.79],C.oak,cube,false,'wood');
  }
  for(let i=0;i<5;i++)shape(yard,[4.62,.085,.075],[-3.38,2.38,5.3+i*.25],C.oak,cube,false,'wood');
  const lanterns=new THREE.Group();lanterns.name='Lounge warm lanterns';
  for(const x of [-5.35,-4.40,-3.38,-2.36,-1.41]){const bulb=new THREE.Mesh(orb,new THREE.MeshStandardMaterial({color:0xffe6b3,emissive:0xffb76b,emissiveIntensity:.75}));bulb.position.set(x,2.24,6.3);bulb.scale.set(.055,.078,.055);lanterns.add(bulb);}
  yard.add(lanterns);
  // Two compact planters beside the barbecue pad, outside the walking lane.
  const shrubs=new PlantBatch();
  for(const [x,z,i] of [[-5.65,7.85,0],[-5.82,5.58,1]]){growShrub(shrubs,x,0,z,.42,.34,.38,i,622+i);growFlowers(shrubs,x,0,z,.38,.36,i,5,999+i);}
  shrubs.attach(yard,'Barbecue garden accents');
  garden(yard);
  fence(yard);
  batchRigidParts(yard, true);
  const night=eveningGarden(yard);
  scene.add(yard);
  const furniture = grillAndTable();
  // Smoke and ember FX are visual-only overlays. Detach them from the
  // clickable grill: this preserves the established static furniture mesh
  // budget and prevents a raycast against translucent puffs on low-end phones.
  for(const effect of [furniture.embers,furniture.smoke]){
    effect.removeFromParent();
    effect.position.copy(furniture.grill.position);
    scene.add(effect);
  }
  scene.add(furniture.platter);
  return {...furniture,night};
}
