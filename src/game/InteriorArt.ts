import * as THREE from 'three';
import { batchRigidParts, colors, cube, drum, finish as mat, orb, panel, softCube, torus, type XYZ } from './ArtKit';
import { PlantBatch } from './LandscapePlants';
import { kitchenTiles, upholsteryWeave, wovenRug } from './ArtTextures';
import { polishFurniture } from './FurnitureSurfaceArt';
import { cushionGeometry } from './FurnitureGeometry';
import {electronicsVariants} from './ElectronicsArt';
import { buildBathFixture } from './BathroomArt';
import { BATH_FIXTURES, COUNTER, DINING_TOP, HOME_PLACEMENTS } from '../shared/home';
import { points, type ItemId } from '../shared/protocol';

type Point = { x: number; z: number };
type Register = (id: Exclude<ItemId, 'delivery'>, group: THREE.Group, point: Point) => void;

const C = {
  linen: colors.paper, cream: 0xfff3dd, oat: colors.oat,
  moss: colors.pine, mossDark: 0x31574c, paleSage: colors.sage,
  wood: colors.oak, woodLight: 0xc1926d, woodDark: colors.walnut,
  terracotta: colors.clay, blush: colors.coral, warmWhite: colors.limestone,
  stone: 0xd8cbb8, slate: 0x42595b, graphite: colors.ink,
  brass: colors.brass, glass: 0x8cb4ad, softBlue: 0x78ada8,
};

const bedsideShade = new THREE.CylinderGeometry(.13, .23, .24, 12);

const officeLamp = new THREE.MeshStandardMaterial({
  color: 0xe7c58f, emissive: 0xffb968, emissiveIntensity: .33, roughness: .9,
});

const wovenFinishes = new WeakMap<THREE.MeshStandardMaterial, THREE.MeshStandardMaterial>();

function wovenFinish(material: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const map = upholsteryWeave();
  if (!map) return material;
  let woven = wovenFinishes.get(material);
  if (!woven) {
    woven = material.clone();
    woven.map = map;
    wovenFinishes.set(material, woven);
  }
  return woven;
}

function part(parent: THREE.Object3D, size: XYZ, position: XYZ, color: number,
  style: 'soft' | 'square' | THREE.BufferGeometry = 'soft', shadow = false,
  finish: Parameters<typeof mat>[1] = 'fabric'): THREE.Mesh {
  // Small cabinet pulls and trim have sub-pixel bevels in portrait.
  const geometry = style === 'soft' ? (Math.min(...size)<.054 ? cube : softCube)
    : style === 'square' ? cube : style;
  const material = mat(color, finish);
  const mesh = new THREE.Mesh(geometry, geometry === cushionGeometry ? wovenFinish(material) : material);
  mesh.scale.set(...size);
  mesh.position.set(...position);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function oval(parent: THREE.Object3D, size: XYZ, position: XYZ, color: number, shadow = false): THREE.Mesh {
  const mesh = new THREE.Mesh(orb, mat(color));
  mesh.scale.set(...size);
  mesh.position.set(...position);
  mesh.castShadow = shadow;
  parent.add(mesh);
  return mesh;
}
function round(parent: THREE.Object3D, radius: number, height: number, position: XYZ,
  color: number, finish: Parameters<typeof mat>[1] = 'wood'): THREE.Mesh {
  const mesh = new THREE.Mesh(drum, mat(color, finish));
  mesh.scale.set(radius, height, radius);
  mesh.position.set(...position);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function ring(parent: THREE.Object3D, radius: number, position: XYZ, color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(torus, mat(color, 'metal'));
  mesh.position.set(...position);
  mesh.scale.setScalar(radius);
  parent.add(mesh);
  return mesh;
}
function group(x: number, z: number): THREE.Group {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  return root;
}
function pillow(parent: THREE.Group, position: XYZ, color: number, angle: number): void {
  const cushion = part(parent, [0.50, 0.20, 0.41], position, color, cushionGeometry, true);
  cushion.rotation.set(0.72, 0, angle);
}

function makeSofa(): THREE.Group {
  const sofa = group(HOME_PLACEMENTS.sofa.x, HOME_PLACEMENTS.sofa.z);
  // A recessed timber plinth makes the upholstery read as one suspended frame.
  part(sofa, [2.36, 0.23, 0.87], [0, 0.155, 0.02], C.woodDark, 'soft', true, 'wood');
  part(sofa, [2.64, 0.35, 1.08], [0, 0.42, 0.024], C.mossDark, cushionGeometry, true);
  const back = part(sofa, [2.58, 0.29, 0.83], [0, 0.87, 0.407], C.moss, cushionGeometry, true);
  back.rotation.x = Math.PI / 2 + 0.10;
  for (const x of [-1.15, 1.15]) {
    part(sofa, [0.37, 0.52, 1.08], [x, 0.61, 0.01], C.moss, cushionGeometry, true);
  }
  for (const x of [-0.498, 0.498]) {
    part(sofa, [0.984, 0.25, 0.82], [x, 0.724, -0.105], 0x709181, cushionGeometry, true);
    const pad = part(sofa, [0.99, 0.22, 0.53], [x, 0.96, 0.274], 0x5c8274, cushionGeometry, true);
    pad.rotation.x = Math.PI / 2 + 0.16;
  }
  // Recessed front upholstery piping; no seat height or footprint change.
  for(const x of [-.498,.498])part(sofa,[.84,.018,.022],[x,.685,-.487],0x41665a,'square');
  // Tailored arm-front inset and restrained welt seam; no changes to seats.
  for(const x of [-1.15,1.15]){
    part(sofa,[.27,.27,.012],[x,.63,-.523],0x63877a,'soft',false,'fabric');
    for(const edge of [-.119,.119])
      part(sofa,[.014,.23,.010],[x+edge,.63,-.533],0x41665a,'square');
  }
  pillow(sofa, [-0.83, 0.96, -0.08], C.linen, -0.30);
  pillow(sofa, [0.84, 0.98, -0.085], C.terracotta, 0.27);
  return sofa;
}

function makeOfficeChair(): THREE.Group {
  const chair = group(HOME_PLACEMENTS.officeChair.x, HOME_PLACEMENTS.officeChair.z);
  chair.rotation.y = Math.PI / 2;
  const fabric = 0xb8735d;
  for (const x of [-.43, .43]) for (const z of [-.34, .34]) {
    const leg = part(chair, [.075, .26, .078], [x, .136, z], C.woodDark, 'soft', true, 'wood');
    leg.rotation.z = Math.sign(x) * .12;
  }
  part(chair, [1.12, .115, .83], [0, .278, -.031], C.woodDark, 'soft', true, 'wood');
  part(chair, [1.20, .225, .86], [0, .405, -.035], 0x935947, cushionGeometry, true);
  part(chair, [.87, .154, .73], [0, .527, .030], fabric, cushionGeometry, true);
  const back = part(chair, [1.14, .82, .246], [0, .88, -.374], fabric, cushionGeometry, true);
  back.rotation.x = -.11;
  const padding = part(chair, [.83, .61, .156], [0, .92, -.259], 0xc5886d, cushionGeometry, true);
  padding.rotation.x = -.11;
  for (const x of [-.51, .51]) {
    part(chair, [.20, .335, .89], [x, .619, .048], fabric, cushionGeometry, true);
    part(chair, [.153, .058, .79], [x, .782, .060], 0xc88a70, cushionGeometry, true);
  }
  return chair;
}

function makeBed(): THREE.Group {
  const bed = group(HOME_PLACEMENTS.bed.x, HOME_PLACEMENTS.bed.z);
  part(bed, [2.48, 0.32, 2.49], [0, 0.19, 0.015], C.woodDark, 'soft', true, 'wood');
  part(bed, [2.68, 0.22, 2.68], [0, 0.365, 0.01], C.woodLight, 'soft', true, 'wood');
  part(bed, [2.67, 1.14, 0.16], [0, 0.815, -1.30], C.woodDark, 'soft', true, 'wood');
  const headrest = part(bed, [2.47, 0.21, 0.90], [0, 0.88, -1.195], C.oat, cushionGeometry);
  headrest.rotation.x = Math.PI / 2;
  part(bed, [2.54, 0.34, 2.55], [0, 0.615, 0.025], C.warmWhite, cushionGeometry, true);
  // Broad quilt with a rolled top edge. Keep the sleeping surface below the pose anchor.
  part(bed, [2.51, 0.165, 1.57], [0, 0.826, 0.49], C.terracotta, cushionGeometry, true);
  part(bed, [2.51, 0.115, 0.28], [0, 0.872, -0.23], C.linen, cushionGeometry);
  part(bed, [2.38, 0.055, 0.43], [0, 0.909, 0.917], 0x914d47, cushionGeometry);
  for (const x of [-0.62, 0.62]) {
    const p = part(bed, [1.08, 0.21, 0.60], [x, 0.852, -0.80], C.cream, cushionGeometry, true);
    p.rotation.y = x < 0 ? 0.045 : -0.045;
  }
  // A recessed wooden footboard panel and contrasting edge are below the
  // mattress and sleep anchors. Quilt piping is only on the vertical edge.
  part(bed,[2.42,.13,.024],[0,.36,1.341],C.wood,'square',false,'wood');
  for(const y of [.304,.416])part(bed,[2.30,.012,.014],[0,y,1.358],C.woodDark,'square',false,'wood');
  part(bed,[2.38,.014,.014],[0,.819,1.275],0xa95a50,'square');
  // Shallow decorative headboard upholstery buttons, behind the pillow zone.
  for(const x of [-.92,-.46,0,.46,.92])part(bed,[.045,.045,.014],[x,1.10,-1.084],0x9b7753,'soft');
  return bed;
}

function makeKitchen(): THREE.Group {
  const kitchen = group(COUNTER.x, COUNTER.z);
  part(kitchen, [4.23, 0.77, 0.83], [0, 0.525, 0], C.mossDark, 'square', true);
  part(kitchen, [4.13, 0.12, 0.74], [0, 0.078, -0.015], C.woodDark, 'square', false, 'wood');
  // Four adjoining pieces leave an actual opening for the recessed basin.
  for (const [x1, x2, z1, z2] of [
    [-2.195, 2.195, -0.48, -0.28], [-2.195, 2.195, 0.18, 0.48],
    [-2.195, 0.86, -0.28, 0.18], [1.70, 2.195, -0.28, 0.18],
  ]) {
    part(kitchen, [x2 - x1, 0.126, z2 - z1], [(x1 + x2) / 2, 0.966, (z1 + z2) / 2],
      C.stone, cube, true, 'ceramic');
  }
  // Brushed front edge highlights the worktop without obstructing appliances.
  part(kitchen,[4.18,.025,.019],[0,1.012,.476],0xa6a89e,'square',false,'metal');
  // Thin plinth and continuous lower moulding improve depth without
  // changing the counter's footprint or any work target.
  part(kitchen,[4.09,.085,.043],[0,.16,.435],0x29463e,'soft',false,'wood');
  part(kitchen,[4.09,.022,.035],[0,.85,.443],0xb39a73,'soft',false,'wood');
  // Inset cabinet fronts and a dedicated oven.
  for (const x of [-1.56, -0.70, 0.78, 1.56]) {
    part(kitchen, [0.72, 0.68, 0.036], [x, 0.51, 0.431], C.moss, 'soft', false, 'wood');
    part(kitchen, [0.53, 0.48, 0.017], [x, 0.49, 0.451], 0x5e8271, 'soft', false, 'wood');
    part(kitchen, [0.30, 0.025, 0.038], [x, 0.74, 0.480], C.brass, 'soft', false, 'metal');
    for (const edge of [-.28,.28])
      part(kitchen,[.020,.43,.016],[x+edge,.49,.467],0x93ad96,'soft',false,'wood');
    for (const y of [.295,.68])
      part(kitchen,[.55,.018,.016],[x,y,.467],0x93ad96,'soft',false,'wood');
    // Reeded inset panels, picked out by the grazing kitchen light.
    for(let flute=-3;flute<=3;flute++)
      part(kitchen,[.019,.32,.016],[x+flute*.059,.49,.464],0x779781,'square',false,'wood');
  }
  part(kitchen, [0.83, 0.65, 0.055], [0.05, 0.52, 0.449], C.graphite);
  part(kitchen, [0.67, 0.45, 0.012], [0.05, 0.50, 0.485], C.slate, 'soft', false, 'screen');
  part(kitchen, [0.37, 0.025, 0.025], [0.05, 0.79, 0.497], C.brass, 'soft', false, 'metal');
  for (const x of [-0.17, 0.05, 0.27]) round(kitchen, 0.027, 0.017, [x, 0.84, 0.493], C.brass, 'metal');
  // Oven rack edges behind tinted glass and discrete temperature icons.
  for (const y of [.39,.49,.59])
    part(kitchen,[.53,.012,.006],[.05,y,.496],0xa6b9b2,'square',false,'metal');
  part(kitchen,[.54,.014,.011],[.05,.28,.492],0x9cb4ac,'soft',false,'metal');

  // Hob, cooker hood and a shallow backsplash, all contained in old footprint.
  part(kitchen, [1.23, 0.025, 0.64], [-0.57, 1.041, -0.06], C.graphite, 'soft', false, 'screen');
  for (const x of [-0.87, -0.27]) for (const z of [-0.25, 0.15]) {
    round(kitchen, 0.17, 0.016, [x, 1.063, z], C.slate);
    const burner = ring(kitchen, 0.101, [x, 1.079, z], C.graphite);
    burner.rotation.x = -Math.PI / 2;
  }
  round(kitchen, 0.235, 0.085, [-0.87, 1.14, 0.15], C.slate, 'metal');
  part(kitchen, [0.33, 0.053, 0.068], [-1.16, 1.16, 0.17], C.woodDark, 'soft', false, 'wood');
  round(kitchen, 0.17, 0.018, [-0.87, 1.195, 0.15], C.oat);
  part(kitchen, [4.12, 0.63, 0.065], [0, 1.34, -0.443], C.stone, 'square');
  panel(kitchen, [0, 1.34, -0.409], [4.10, 0.61], kitchenTiles(), C.linen);
  part(kitchen, [1.07, 0.033, 0.22], [-0.57, 1.657, -0.28], C.stone);
  part(kitchen, [1.18, 0.22, 0.53], [-0.57, 1.79, -0.31], C.paleSage, 'soft');
  part(kitchen, [1.06, 0.06, 0.10], [-0.57, 1.62, -0.08], C.brass, 'soft', false, 'metal');
  // Sculpted limewash chimney rises from the brass hood lip.
  const surround = new THREE.LatheGeometry([
    new THREE.Vector2(.52,0),new THREE.Vector2(.51,.10),new THREE.Vector2(.42,.23),
    new THREE.Vector2(.26,.46),new THREE.Vector2(.24,.69),new THREE.Vector2(.21,.72),new THREE.Vector2(0,.72),
  ],12);
  part(kitchen,[1.06,1,.53],[-.57,1.85,-.32],0xc58065,surround,false,'ceramic');
  // A shallow hanging shelf sits above the cupboards, out of the work area.
  part(kitchen,[1.80,.067,.27],[1.14,2.17,-.31],C.woodDark,'square',false,'wood');
  for(const x of [.46,1.81])part(kitchen,[.034,.21,.16],[x,2.08,-.36],C.brass,'square',false,'metal');
  const crock=new THREE.LatheGeometry([
    new THREE.Vector2(.065,0),new THREE.Vector2(.103,.032),new THREE.Vector2(.116,.17),
    new THREE.Vector2(.078,.23),new THREE.Vector2(.062,.27),new THREE.Vector2(.072,.275),
  ],12);
  for(const [x,size,color] of [[.62,1,0xb26d51],[.82,.80,0xdab991],[1.64,1.1,0x779685]])
    part(kitchen,[size,size,size],[x,2.20,-.29],color,crock,false,'ceramic');
  const herb=new PlantBatch();
  for(let i=0;i<8;i++){
    const a=i*2.4,h=2.54+.12*Math.cos(i);
    const tip:XYZ=[1.64+Math.sin(a)*.14,h,-.29+Math.cos(a)*.095];
    herb.stem(0x678362,[1.64,2.47,-.29],tip,.007);
    herb.blade(i%2?0x668c70:0x93a676,tip,[.043,.065,.097],a,.28);
  }
  herb.attach(kitchen,'Shelf herbs');
  // Stacked ceramic saucers and two cups on the upper shelf, never on a work target.
  for(let i=0;i<4;i++)round(kitchen,.104,.022,[1.15,2.216+i*.027,-.29],i%2?C.linen:C.stone,'ceramic');
  round(kitchen,.059,.095,[1.10,2.366,-.30],0xc1926d,'ceramic');
  const cupHandle=ring(kitchen,.039,[1.17,2.366,-.30],C.brass);
  cupHandle.rotation.y=Math.PI/2;
  round(kitchen,.052,.082,[1.37,2.248,-.30],C.paleSage,'ceramic');
  ring(kitchen,.033,[1.43,2.248,-.30],C.brass).rotation.y=Math.PI/2;
  // Recessed range-hood filter, small steel rails and control lights.
  part(kitchen,[.83,.010,.19],[-.57,1.636,-.27],0x72817a,'soft',false,'metal');
  for(const x of [-.83,-.57,-.31])
    part(kitchen,[.014,.011,.17],[x,1.645,-.27],0x3e4c47,'soft',false,'metal');

  // A steel liner sits below the stone lip, with tapered walls and a drain.
  for (const x of [0.881, 1.679]) {
    part(kitchen, [0.082, 0.111, 0.46], [x, 0.97, -0.05], C.glass, 'square', false, 'metal')
      .rotation.z = (x < 1 ? -1 : 1) * 0.29;
  }
  for (const z of [-0.257, 0.157]) {
    part(kitchen, [0.76, 0.11, 0.082], [1.28, 0.97, z], C.glass, 'square', false, 'metal')
      .rotation.x = (z < 0 ? 1 : -1) * 0.29;
  }
  part(kitchen, [0.76, 0.018, 0.39], [1.28, 0.913, -0.05], C.slate, 'square', false, 'metal');
  round(kitchen, 0.049, 0.013, [1.37, 0.926, -0.06], C.graphite, 'metal');
  const tap = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.56, 1.03, -0.34), new THREE.Vector3(1.56, 1.32, -0.34),
    new THREE.Vector3(1.47, 1.40, -0.29), new THREE.Vector3(1.34, 1.35, -0.19),
    new THREE.Vector3(1.34, 1.28, -0.18),
  ]);
  kitchen.add(new THREE.Mesh(new THREE.TubeGeometry(tap, 10, 0.032, 6, false), mat(C.brass, 'metal')));
  for (const x of [0.45, 1.20, 1.86]) {
    part(kitchen, [0.70, 0.35, 0.30], [x, 1.79, -0.28], C.linen, 'soft', false, 'wood');
    part(kitchen, [0.26, 0.025, 0.021], [x, 1.70, -0.105], C.brass, 'soft', false, 'metal');
    part(kitchen,[.53,.20,.012],[x,1.80,-.117],0xdce1d0,'soft',false,'ceramic');
    for (const edge of [-.28,.28]) part(kitchen,[.018,.30,.025],
      [x+edge,1.79,-.11],0xc2ad89,'soft',false,'wood');
  }
  // An orderly, genuinely three-dimensional cluster of countertop details.
  // These are fixed to the existing kitchen and carry no gameplay inventory.
  for (let i=0;i<4;i++) {
    const x=-1.92+i*.15;
    round(kitchen,.043,.095,[x,1.112,-.30],i%2?0x876a46:0xa5b18a,'ceramic');
    round(kitchen,.045,.014,[x,1.178,-.30],C.brass,'metal');
  }
  part(kitchen,[.31,.065,.18],[1.87,1.099,-.23],C.woodDark,'soft',false,'wood');
  for (const x of [1.79,1.87,1.95])
    part(kitchen,[.022,.15,.012],[x,1.20,-.23],C.slate,'soft',false,'metal');
  // End cabinet extends left toward the new feeding window without moving
  // the hob, sink, coffee, kettle or their established interaction anchors.
  const endX=-2.39;
  part(kitchen,[.52,.77,.83],[endX,.525,0],C.mossDark,'square',true);
  part(kitchen,[.52,.126,.96],[endX,.966,0],C.stone,'soft',false,'ceramic');
  part(kitchen,[.48,.12,.74],[endX,.078,-.015],C.woodDark,'square',false,'wood');
  part(kitchen,[.45,.67,.038],[endX,.51,.431],C.moss,'soft',false,'wood');
  part(kitchen,[.34,.46,.018],[endX,.49,.453],0x5e8271,'soft',false,'wood');
  for(let i=-2;i<=2;i++)part(kitchen,[.018,.30,.016],[endX+i*.056,.49,.466],0x779781,'square',false,'wood');
  part(kitchen,[.24,.025,.038],[endX,.74,.480],C.brass,'soft',false,'metal');
  // Baking material colors into the static cabinet pieces keeps their new
  // ornamentation without a draw call for every handle and trim.
  batchRigidParts(kitchen, true);
  return kitchen;
}

// A separate pickable model, instead of the former kettle geometry buried
// inside the shared kitchen raycast target.
function makeKettle(): THREE.Group {
  const { x, z } = HOME_PLACEMENTS.kettle;
  const kettle = group(x, z);
  oval(kettle, [.18,.195,.154], [0,1.19,0], C.terracotta).castShadow = true;
  ring(kettle, .085, [0,1.37,0], C.woodDark);
  oval(kettle, [.135,.047,.065], [.16,1.22,.02], C.terracotta).rotation.z = .43;
  // Transparent oversized fingertip target, separated from the coffee brewer.
  const hit = new THREE.Mesh(drum,
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.007,depthWrite:false}));
  hit.scale.set(.30,.37,.30);
  hit.position.set(0,1.26,0);
  kettle.add(hit);
  return kettle;
}

function makeDesk(): THREE.Group {
  const desk = group(HOME_PLACEMENTS.desk.x, HOME_PLACEMENTS.desk.z);
  part(desk, [2.25, 0.126, 0.98], [0, 0.99, 0], C.woodLight, 'soft', true, 'wood');
  part(desk, [0.47, 0.42, 0.79], [-0.82, 0.72, -0.019], C.woodDark, 'soft', true, 'wood');
  for (const y of [0.64, 0.83]) {
    part(desk, [0.42, 0.15, 0.045], [-0.82, y, 0.39], C.wood, 'soft', false, 'wood');
    part(desk, [0.15, 0.025, 0.044], [-0.82, y, 0.42], C.brass, 'soft', false, 'metal');
  }
  for (const x of [-0.94, 0.94]) {
    for (const z of [-0.36, 0.36]) {
      const leg = part(desk, [0.088, 0.89, 0.091], [x, 0.478, z], C.woodDark, 'square', true, 'wood');
      leg.rotation.x = Math.sign(z) * 0.095;
    }
    part(desk, [0.09, 0.072, 0.72], [x, 0.12, 0], C.woodDark, 'square', false, 'wood');
  }
  // Curved back and padded seat leave the rig's shoulder and knee space clear.
  part(desk, [0.61, 0.15, 0.56], [0, 0.48, 1.06], C.terracotta, cushionGeometry, true);
  const back = part(desk, [0.65, 0.16, 0.61], [0, 0.88, 1.34], C.terracotta, cushionGeometry, true);
  back.rotation.x = Math.PI / 2 + 0.10;
  round(desk, 0.050, 0.35, [0, 0.247, 1.07], C.slate, 'metal');
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5;
    const x = Math.cos(angle), z = Math.sin(angle);
    part(desk, [0.23, 0.045, 0.056], [x * 0.126, 0.123, 1.07 + z * 0.126],
      C.slate, 'square', false, 'metal').rotation.y = -angle;
    round(desk, 0.034, 0.074, [x * 0.233, 0.067, 1.07 + z * 0.233], C.graphite, 'metal');
  }
  // A notebook and a cup are kept on the tabletop (the existing home decor adds more).
  part(desk, [0.35, 0.020, 0.29], [-0.82, 1.065, 0.12], C.linen);
  part(desk, [0.025, 0.025, 0.27], [-0.94, 1.076, 0.12], C.brass);
  round(desk, 0.105, 0.14, [0.86, 1.15, 0.12], C.terracotta);
  ring(desk, 0.07, [0.99, 1.17, 0.12], C.brass);
  round(desk, .10, .041, [-.85, 1.075, -.28], C.brass, 'metal');
  round(desk, .018, .34, [-.85, 1.23, -.28], C.brass, 'metal');
  const light = part(desk, [.64, .70, .64], [-.85, 1.42, -.28], C.linen, bedsideShade);
  light.material = officeLamp;
  return desk;
}

function makeTv(): THREE.Group {
  const tv = group(HOME_PLACEMENTS.tv.x, HOME_PLACEMENTS.tv.z);
  // Open bays beside the central storage drawer.
  part(tv,[.61,.36,.50],[0,.37,0],C.woodLight,'soft',true,'wood');
  for(const x of [-.90,.90])part(tv,[.10,.36,.50],[x,.37,0],C.woodLight,'soft',true,'wood');
  part(tv,[1.84,.05,.50],[0,.222,0],C.woodLight,'soft',true,'wood');
  part(tv,[1.84,.31,.045],[0,.391,-.235],C.woodDark,'soft',true,'wood');
  part(tv, [1.79, 0.12, 0.39], [0, 0.147, -0.01], C.woodDark, 'soft', true, 'wood');
  for (const x of [0]) {
    part(tv, [0.575, 0.28, 0.027], [x, 0.367, 0.248], C.wood, 'soft', false, 'wood');
    part(tv,[.48,.016,.010],[x,.27,.265],C.woodDark,'square',false,'wood');
    part(tv, [0.15, 0.018, 0.021], [x, 0.442, 0.271], C.brass, 'soft', false, 'metal');
  }
  part(tv, [1.88, 0.048, 0.55], [0, 0.55, 0], C.woodDark, 'soft', false, 'wood');
  return tv;
}

function makeDiningTable(): THREE.Group {
  const table = group(HOME_PLACEMENTS.table.x, HOME_PLACEMENTS.table.z);
  // Smoked tempered glass: inexpensive glossy dark glass, no transmission pass.
  const glass=part(table,[1.40,.075,1.14],[0,DINING_TOP-.0375,0],0x25383c,'soft',true,'ceramic');
  glass.material=new THREE.MeshPhysicalMaterial({color:0x25383c,roughness:.19,metalness:.06,clearcoat:.78,clearcoatRoughness:.19,transparent:true,opacity:.89,depthWrite:true});
  part(table,[1.18,.070,.91],[0,DINING_TOP-.109,0],0x343f40,'soft',false,'metal');
  for(const side of [-1,1])part(table,[1.26,.012,.018],[0,DINING_TOP-.034,side*.555],0x607779,'square',false,'metal');
  for (const x of [-.55, .55]) for (const z of [-.41, .41]) {
    part(table, [.085, .70, .085], [x, .36, z], 0x30383b, 'soft', true, 'metal');
  }
  for (const side of [-1, 1]) {
    const x = side * .99;
    const back = x + side * .28;
    part(table, [.60, .10, .63], [x, .45, 0], C.wood, 'soft', true, 'wood');
    part(table, [.53, .075, .55], [x - side * .015, .52, 0], C.paleSage, cushionGeometry);
    for (const z of [-.235, .235]) {
      part(table, [.066, .43, .066], [x - side * .23, .22, z], C.woodDark, 'soft', false, 'wood');
      part(table, [.07, .91, .07], [back, .46, z], C.woodDark, 'soft', false, 'wood');
    }
    part(table, [.08, .23, .57], [back, .83, 0], C.wood, 'soft', true, 'wood');
  }
  // Bare glass surface keeps the existing plate and food anchors unobstructed.
  return table;
}

function makeCoffeeMaker(): THREE.Group {
  const { x, z } = HOME_PLACEMENTS.coffeeMaker;
  const maker = group(x, z);
  const variants=electronicsVariants('coffee');
  variants.group.position.y=1.03;
  variants.select('coffeeStart');
  maker.add(variants.group);
    return maker;
}

export function buildFurniture(register: Register): void {
  register('sofa', makeSofa(), points.sofa);
  register('officeChair', makeOfficeChair(), points.officeChair);
  register('bed', makeBed(), points.bed);
  register('kitchen', makeKitchen(), points.kitchen);
  register('kettle', makeKettle(), points.kettle);
  register('coffeeMaker', makeCoffeeMaker(), points.coffeeMaker);
  register('desk', makeDesk(), points.desk);
  register('tv', makeTv(), points.tv);
  register('table', makeDiningTable(), points.table);
  for (const id of Object.keys(BATH_FIXTURES) as (keyof typeof BATH_FIXTURES)[]) {
    register(id, buildBathFixture(id), points[id]);
  }
}

export function buildPersonalFurniture(scene: THREE.Scene,
  registerLibrary: (model: THREE.Group) => void,
  registerFixture?: (id:'nightstandLeft'|'nightstandRight',model:THREE.Group)=>void,registerVanity?: (model:THREE.Group)=>void): void {
  const vanity = group(HOME_PLACEMENTS.vanity.x, HOME_PLACEMENTS.vanity.z);
  vanity.rotation.y = Math.PI / 2;
  part(vanity, [1.33, .11, .63], [0, .86, 0], C.woodLight, 'soft', true, 'wood');
  part(vanity, [1.19, .18, .54], [0, .72, 0], C.wood, 'soft', false, 'wood');
  part(vanity, [.20, .025, .031], [0, .72, .28], C.brass, 'soft', false, 'metal');
  for (const x of [-.54, .54]) for (const z of [-.21, .21]) {
    part(vanity, [.069, .64, .07], [x, .33, z], C.woodDark, 'soft', false, 'wood');
  }
  part(vanity, [.09, .45, .075], [0, 1.03, -.19], C.woodDark, 'soft', false, 'wood');
  oval(vanity, [.40, .46, .053], [0, 1.48, -.19], C.woodDark);
  oval(vanity, [.352, .407, .046], [0, 1.48, -.15], 0xa9c5bc);
  oval(vanity, [.216, .285, .014], [-.09, 1.55, -.11], 0xcdd9c9);
  round(vanity, .078, .142, [-.44, .986, .015], C.terracotta, 'ceramic');
  round(vanity, .052, .08, [-.44, 1.08, .015], C.brass, 'metal');
  round(vanity,.042,.12,[.42,.98,.06],0xd9a8b4,'ceramic');
  round(vanity,.026,.045,[.42,1.065,.06],C.brass,'metal');
  part(vanity,[.23,.045,.14],[.24,.94,.08],0x8a555e);
  part(vanity,[.15,.025,.065],[-.21,.94,.10],C.woodDark);
  part(vanity, [.50, .40, .44], [0, .20, .67], C.wood, 'soft', false, 'wood');
  part(vanity, [.55, .13, .49], [0, .46, .67], C.blush, cushionGeometry);
  const bookcase = group(HOME_PLACEMENTS.bookcase.x, HOME_PLACEMENTS.bookcase.z);
  bookcase.rotation.y = -Math.PI / 2;
  part(bookcase, [1.86, 1.67, .066], [0, .88, -.272], C.woodDark, 'square', false, 'wood');
  for (const x of [-.875, .875]) {
    part(bookcase, [.10, 1.74, .55], [x, .88, 0], C.wood, 'soft', false, 'wood');
  }
  for (const y of [.15, .63, 1.12, 1.73]) {
    part(bookcase, [1.80, .085, .57], [0, y, 0], C.woodLight, 'soft', false, 'wood');
  }
  const bindings = [C.moss, C.terracotta, C.oat, C.softBlue, C.woodDark];
  for (const [row, y] of [.19, .675, 1.16].entries()) {
    const length = 6 + row % 2;
    for (let i = 0; i < length; i++) {
      const h = .23 + ((i + row * 2) % 4) * .053;
      const x = (row % 2 ? -.39 : -.71) + i * .187;
      part(bookcase, [.136, h, .30], [x, y + h / 2, .035], bindings[(i + row * 3) % bindings.length], 'square');
      part(bookcase, [.090, .025, .009], [x, y + h * .73, .19], C.oat, 'square');
    }
  }

  part(bookcase, [.14, .27, .16], [-.57, 1.91, .01], C.terracotta, 'soft', false, 'ceramic');
  part(bookcase, [.26, .21, .22], [-.57, 2.10, .01], C.moss, orb);
  part(bookcase, [.32, .046, .20], [.44, 1.81, 0], C.linen);
  part(bookcase, [.24, .037, .14], [.44, 1.85, 0], C.paleSage);

  for (const [index, { x, z }] of [HOME_PLACEMENTS.bedroomLampLeft, HOME_PLACEMENTS.bedroomLampRight].entries()) {
    const nightstand = group(x, z);
    part(nightstand, [.63, .53, .59], [0, .325, 0], C.woodLight, 'soft', false, 'wood');
    part(nightstand, [.56, .22, .03], [0, .415, .294], C.wood, 'soft', false, 'wood');
    part(nightstand, [.11, .028, .025], [0, .414, .32], C.brass, 'soft', false, 'metal');
    const lamp = index === 0 ? C.terracotta : C.moss;
    round(nightstand, .11, .31, [0, .735, -.065], lamp, 'ceramic');
    part(nightstand, [1, 1, 1], [0, .99, -.065], C.linen, bedsideShade);
    batchRigidParts(nightstand, true);
    polishFurniture(nightstand,false);
    scene.add(nightstand);
    registerFixture?.(index===0?'nightstandLeft':'nightstandRight',nightstand);
  }
  for (const furniture of [vanity, bookcase]) {
    batchRigidParts(furniture, true);
    polishFurniture(furniture,false);
    if (furniture === bookcase) registerLibrary(bookcase); else if(registerVanity)registerVanity(vanity);else scene.add(furniture);
  }
}

export function buildSoftRugs(scene: THREE.Scene,
  registerFixture:(id:'rugLiving'|'rugWork'|'rugSleep',model:THREE.Group)=>void): void {
  const rugs = [
    { style: 'living', x: HOME_PLACEMENTS.sofa.x, z: .98, width: 3.72, depth: 3.39, edge: C.terracotta },
    { style: 'work', x: HOME_PLACEMENTS.desk.x, z: -5.83, width: 2.68, depth: 2.79, edge: C.moss },
    { style: 'sleep', x: HOME_PLACEMENTS.bed.x, z: -5.27, width: 4.15, depth: 3.31, edge: C.oat },
  ] as const;
  for (const {style, x, z, width, depth, edge} of rugs) {
    const model=new THREE.Group();
    part(model, [width, 0.022, depth], [x, 0.011, z], edge);
    const textile = panel(model, [x, 0.024, z], [width - 0.07, depth - 0.07], wovenRug(style), edge);
    textile.rotation.x = -Math.PI / 2;
    scene.add(model);
    registerFixture(style==='living'?'rugLiving':style==='work'?'rugWork':'rugSleep',model);
  }
}
