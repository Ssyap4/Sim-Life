import * as THREE from 'three';
import { batchRigidParts, colors as C, cube, drum, finish, orb, panel, plane, softCube, torus, type XYZ } from './ArtKit';
import { STATIONS, HOME_STATIONS, DISTRICT_STATIONS, type PlaceId, type Station } from '../shared/locations';
import { DISTRICT_OFFSET_Z } from '../shared/district';
import { locationGeometry, painted } from './LocationArt';
import { buildDistrict } from './DistrictArt';
import { addTufts, grassMaterial, growFlowers, growShrub, growTree, landscapeRandom, landscapeSharedGeometry, PlantBatch } from './LandscapePlants';
import { paintGround, type GroundArea } from './LandscapeGround';
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
  {x:0,z:3.75,w:12,d:1.36},{x:0,z:.37,w:12,d:1.28},
  {x:-2.68,z:0,w:1.35,d:8.1},{x:2.52,z:0,w:1.30,d:8.1},
] as const;
const parkTrees = [[-5.65,-2.5,'spruce',.75],[5.58,-2.4,'birch',.78],
  [-5.60,2.7,'linden',.67],[5.69,3.08,'spruce',.71]] as const;
const parkBeds = [[-4.90,-1.85,0],[4.85,-.78,2],[-4.45,2.56,1],[4.83,2.56,0]] as const;

function parkLandscaping(parent: THREE.Group, resources: {textures:THREE.Texture[]; materials:THREE.Material[]}) {
  const map=painted(resources,512,512,ctx=>paintGround(ctx,{x:0,z:0,w:12,d:10},[
    {x:-.08,z:-1.94,w:5.3,d:4.4,ink:[79,136,90],opacity:.54},
    {x:4.46,z:1.54,w:3.0,d:6.5,ink:[171,190,119],opacity:.67},
    ...parkTrees.map(([x,z])=>({x,z,w:2.62,d:2.5,ink:[59,98,66] as [number,number,number],opacity:.58,border:true})),
  ],90713));
  const material=new THREE.MeshStandardMaterial({color:map?0xffffff:0x8fab73,map,roughness:1});
  resources.materials.push(material);
  const ground=new THREE.Mesh(plane,material);
  ground.rotation.x=-Math.PI/2;
  ground.scale.set(12,10,1);
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
    growFlowers(plants,x,.121,z,bed.w-.16,bed.d-.12,hue,9,975+i*442);
  }
  for(const [i,[x,z]] of [[-1.81,-2.95],[1.78,-2.77],[-1.73,-1.15],[1.68,-.93]].entries()){
    growShrub(plants,x,0,z,.63,.39,.67,i%4,957+i*82);
    growFlowers(plants,x+(i%2?.17:-.17),0,z-.23,.47,.52,i%3,5,465+i*84);
  }
  plants.attach(parent,'Park trees, flowers and pond planting');

  const random=landscapeRandom(1697);
  const tufts=[];
  for(let i=0;i<125;i++){
    const x=(random()-.5)*11.6,z=(random()-.5)*9.7;
    if (parkPaths.some(p=>Math.abs(x-p.x)<p.w/2+.18&&Math.abs(z-p.z)<p.d/2+.18)||
        (Math.abs(x+.08)<1.69&&Math.abs(z+1.94)<1.38)) continue;
    tufts.push({x,z,size:.46+random()*.72,yaw:random()*Math.PI*2,color:i%3?0x87a962:0x648f59});
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
  if (kind === 'door') {
    if (station.center.z > 4) root.rotation.y = Math.PI;
    facade(root, C.pine);
    sign(root, station.name, 2.39, .20, 1.32, C.paper, textures, materials);
  } else if (kind === 'dine') {
    shape(root, [.61, .13, .61], [0, .93, -.27], C.oak, drum, true);
    shape(root, [.13, .79, .13], [0, .46, -.27], C.walnut, drum);
    bench(root, 1.47);
    // Rotate the seats towards the table and align them with the role anchors.
    for (const child of root.children.slice(2)) {
      child.position.z = .53 - child.position.z;
    }
    const vase = shape(root, [.084, .19, .084], [.11, 1.09, -.29], C.leaf, drum);
    vase.rotation.z = .08;
    shape(root, [.072, .087, .059], [.13, 1.22, -.29], C.coral, orb);
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
    const object = buildStation(station, resources.textures, resources.materials);
    object.position.z -= DISTRICT_OFFSET_Z;
    root.add(object);
    district.entries.set(station.id, object);
  }
  return {root,...district};
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
  root.add(floor);
  const resources = { textures, materials };
  const animateWork = isCareerPlace(place) ? buildCareerPlace(place,floor,root,resources) : undefined;
  if (place === 'market') {
    buildMarket(floor, resources);
    root.add(marketCashier(resources));
  } else if (place === 'education') buildEducationCenter(floor, resources);
  else if (!animateWork) {
    shape(floor, [12.3, .40, 10.3], [0, -.23, 0], outdoor ? 0x536649 : C.walnut, softCube, true);
    shape(floor, [12, .06, 10], [0, -.031, 0], outdoor ? 0xa7b586 : 0xc69b6c, cube);
    if (outdoor) {
      for (const {x,z,w,d} of parkPaths)
        shape(floor, [w,.026,d],[x,.014,z],0xd6c1a0,cube);
    } else {
      const seamColor = 0xaf8257;
      for (let i = -5; i <= 5; i++) shape(floor, [.018, .006, 10], [i, .005, 0], seamColor, cube);
      for (let i = -4; i <= 4; i++) shape(floor, [12, .006, .017], [0, .005, i], seamColor, cube);
      shape(floor, [12.2, 2.91, .19], [0, 1.46, -5.01], place === 'cafe' ? 0xd3b89b : 0xbbcec3, cube);
      shape(floor, [.19, 2.91, 10.1], [-6.05, 1.46, 0], place === 'cafe' ? 0x9fac88 : 0xa4b8b1, cube);
      for (const y of [.25, .78, 2.86]) {
        shape(floor, [12.2, .13, .23], [0, y, -4.95], C.paper);
        shape(floor, [.23, .13, 10.1], [-5.99, y, 0], C.paper);
      }
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
    sign(floor, 'ТЁПЛЫЙ УГОЛ', 2.18, -4.89, 3.02, C.paper, textures, materials);
  }
  batchRigidParts(floor, place === 'market' || place === 'education' || Boolean(animateWork));
  for (const station of STATIONS[place]) {
    const custom = place === 'market' ? marketStation(station, resources)
        : place === 'education' ? educationStation(station, resources)
          : isCareerPlace(place) ? careerStation(station,careerAt(place),resources) : null;
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
  const horizontal = place === 'market' ? marketOutline
    : [...stations.values()].flatMap(station => corners(new THREE.Box3().setFromObject(station)));
  const vertical = corners(new THREE.Box3().setFromObject(root));
  return {
    root, stations, horizontal, vertical,
    animate: animateWork ?? animatePark,
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
  for (const station of HOME_STATIONS) {
    if (station.action.kind === 'waypoint') continue;
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
  return { group, stations, doors, stock, parcel };
}

export function carryingBag() {
  const root = new THREE.Group();
  const bag = packageBox(root, 0, 0, C.oat);
  bag.scale.setScalar(.74);
  return root;
}
