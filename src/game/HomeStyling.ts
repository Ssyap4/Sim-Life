import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PETS, PET_IDS } from '../shared/pets';
import { batchRigidParts, colors as C, cube, drum, finish, panel, plane, softCube, type XYZ } from './ArtKit';
import { COUNTER, HOME_DOORS, HOME_PLACEMENTS, HOME_WALLS, HOUSE, HOUSE_ENTRY, HOUSE_WING } from '../shared/home';
import { gardenView } from './ArtTextures';
import { cottageFloor,timberWall,kitchenAccent } from './CottageArt';

function shape(parent: THREE.Object3D, geometry: THREE.BufferGeometry, size: XYZ, position: XYZ,
  color: number, finishType: Parameters<typeof finish>[1] = 'fabric', caster = false): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, finish(color, finishType));
  mesh.scale.set(...size);
  mesh.position.set(...position);
  mesh.castShadow = caster;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function rearWall(home: THREE.Group): void {
  const z = HOUSE.minZ;
  const height = 3.16;
  const center = HOME_PLACEMENTS.bed.x;
  const left = center - 1.66;
  const right = center + 1.66;
  const bottom = 1.25;
  const top = 2.81;

  const kitchenLeft=-4.02,kitchenRight=-2.22,kitchenBottom=1.30,kitchenTop=2.78;
  for (const [x1, x2, y1, y2] of [
    [HOUSE.minX, left, 0, height], [right,kitchenLeft,0,height],[kitchenRight,HOUSE.maxX,0,height],[kitchenLeft,kitchenRight,0,kitchenBottom],[kitchenLeft,kitchenRight,kitchenTop,height],
    [left, right, 0, bottom], [left, right, top, height],
  ]) {
    timberWall(home,[x2-x1,y2-y1,.24],[(x1+x2)/2,(y1+y2)/2,z]);
  }
  panel(home, [center, 2.03, z - .12], [3.36, 1.60], gardenView(), C.sky, .20);
  // The sash sits in shadow behind the casing. The sill projects into the room.
  for (const x of [left, right]) {
    shape(home, softCube, [0.13, 1.70, 0.23], [x, 2.03, z + .14], C.paper, 'wood');
    shape(home, cube, [0.051, 1.57, 0.068], [x, 2.03, z + .015], C.walnut, 'wood');
  }
  shape(home, softCube, [0.093, 1.57, 0.092], [center, 2.03, z + .012], C.paper, 'wood');
  shape(home, softCube, [3.42, 0.074, 0.084], [center, 2.19, z + .010], C.paper, 'wood');
  for(const x of [left-.07,right+.07])shape(home,cube,[.055,1.77,.082],[x,2.03,z+.20],C.walnut,'wood');
  shape(home, softCube, [3.61, 0.105, 0.40], [center, bottom, z + .14], C.oat, 'wood');
  shape(home, softCube, [3.54, 0.092, 0.23], [center, top, z + .14], C.paper, 'wood');
  // A restrained shelf lip and small planters on the existing sill.
  for(const [x,color] of [[center-1.36,0xb87254],[center+1.36,0x718f75]]){
    shape(home,drum,[.09,.15,.09],[x,bottom+.115,z+.21],color,'ceramic');
    shape(home,softCube,[.19,.16,.16],[x,bottom+.255,z+.21],0x708e54);
  }
  const rod = shape(home, drum, [0.036, 3.84, 0.036], [center, 2.97, z + .29], C.brass, 'metal');
  rod.rotation.z = Math.PI / 2;

  // Pleats taper into the tieback so the curtains read as fabric from above.
  for (const side of [-1, 1]) {
    const x = center + side * 1.68;
    const vertices: number[] = [];
    const indices: number[] = [];
    const levels = [[3.0, 0.27, 0], [2.63, 0.28, 0.023], [1.88, 0.16, 0.095], [1.31, 0.25, 0.085]];
    for (const [y, width, inset] of levels) for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      vertices.push(x + side * inset + (t * 2 - 1) * width,
        y + (y < 1.4 ? Math.sin(t * Math.PI) * 0.10 : 0),
        z + .35 + Math.cos(t * Math.PI * 8) * 0.052);
    }
    for (let row = 0; row < levels.length - 1; row++) for (let i = 0; i < 18; i++) {
      const a = row * 19 + i;
      indices.push(a, a + 19, a + 1, a + 1, a + 19, a + 20);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const linen = finish(0xe0a975).clone();
    linen.side = THREE.DoubleSide;
    const curtain = new THREE.Mesh(geometry, linen);
    curtain.receiveShadow = true;
    home.add(curtain);
    shape(home, softCube, [0.31, 0.065, 0.12], [x + side * 0.095, 1.88, z + .40], C.rust);
  }
}

function roomPartitions(home: THREE.Group): void {
  for (const wall of HOME_WALLS) {
    const width = wall.maxX - wall.minX;
    const depth = wall.maxZ - wall.minZ;
    const x = (wall.minX + wall.maxX) / 2;
    const z = (wall.minZ + wall.maxZ) / 2;
    const height = z > HOUSE.maxZ - .10 ? .23 : .43;
    timberWall(home,[width,height,depth],[x,height/2,z]);
    shape(home, cube, [width + .028, .054, depth + .028], [x, height, z], C.walnut, 'wood');
    // Skirting remains inside the original wall volume plus its existing trim.
    shape(home,cube,[width+.018,.09,depth+.018],[x,.045,z],0x795638,'wood');
  }
  // Deep rear and far side walls establish the volume. The viewer-facing sides are cut away.
  for (const side of [-1, 1]) {
    const x = side * HOUSE.maxX;
    const height = side < 0 ? 1.22 : .54;
    const segments = side < 0 ? [[HOUSE.minZ, HOUSE.maxZ]] : [
      [HOUSE.minZ, HOUSE_WING.connector.z - HOUSE_WING.connector.width / 2],
      [HOUSE_WING.connector.z + HOUSE_WING.connector.width / 2, HOUSE.maxZ],
    ];
    for (const [minZ, maxZ] of segments) {
      const span = maxZ - minZ;
      const mid = (minZ + maxZ) / 2;
      timberWall(home,[.22,height,span],[x,height/2,mid]);
      shape(home, cube, [.27, .07, span], [x, height, mid], C.walnut, 'wood');
      shape(home,cube,[.25,.10,span],[x,.05,mid],C.walnut,'wood');
    }
  }
  for (const [key, { x, z, width }] of Object.entries(HOME_DOORS)) {
    shape(home, cube, [.40, .024, width], [x, .018, z], C.oat, 'wood');
    for (const side of [-1, 1]) {
      shape(home, softCube, [.25, .96, .103], [x, .48, z + side * width / 2], C.walnut, 'wood');
      shape(home,cube,[.265,.85,.026],[x,.48,z+side*(width/2+.048)],C.oat,'wood');
    }
    if (key === 'toilet') {
      // The open leaf is parked flush to the WC partition, beside the passage.
      shape(home, softCube, [.09, 1.91, .78], [x - .18, .97, z - width / 2 - .37], C.pine, 'wood');
      shape(home, drum, [.055, .14, .055], [x - .26, .91, z - width / 2 - .64], C.brass, 'metal');
    }
  }
  const width = HOUSE.maxX - HOUSE.minX;
  shape(home, cube, [width, .10, .30], [0, 3.16, HOUSE.minZ], C.paper, 'wood');
  shape(home, cube, [width - .22, .13, .079], [0, .085, HOUSE.minZ + .16], C.walnut, 'wood');
}

function entryDoor(home: THREE.Group) {
  const { x, z, width } = HOUSE_ENTRY;
  const frame = .10;
  for (const side of [-1, 1]) shape(home, cube, [frame, 2.38, .16],
    [x + side * (width / 2 + frame / 2), 1.20, z], C.walnut, 'wood');
  shape(home, cube, [width + 2 * frame + .07, .105, .19], [x, 2.40, z], C.walnut, 'wood');
  shape(home, cube, [width, .029, .34], [x, .018, z], C.oat, 'wood');
  shape(home, softCube, [1.54, .022, .52], [x, .016, z - .55], C.leaf);
  const door = new THREE.Group();
  door.position.set(x, 0, z + .07);
  const half = width / 2 - .035;
  for (const side of [-1, 1]) {
    shape(door, cube, [.054, 2.22, .067], [side * half, 1.14, 0], C.pine, 'wood');
    shape(door, cube, [width - .018, .067, .066], [0, 1.14 + side * 1.09, 0], C.pine, 'wood');
  }
  shape(door, cube, [.044, 2.15, .057], [0, 1.14, 0], C.pine, 'wood');
  shape(door, softCube, [.05, .26, .05], [half - .20, 1.04, .07], C.brass, 'metal');
  const glass = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({
    color: 0xafcfbf, transparent: true, opacity: .17, depthWrite: false, side: THREE.DoubleSide,
  }));
  glass.scale.set(width - .09, 2.13, 1);
  glass.position.y = 1.14;
  door.add(glass);
  batchRigidParts(door);
  home.add(door);
  return door;
}

function petNooks(home: THREE.Group): void {
  const bowls = PET_IDS.map(id => PETS[id].bowl);
  // Two distinct feeding stations provide ample separation when both eat.
  for (const bowl of bowls) shape(home, softCube, [.68, .026, .63], [bowl.x, .016, bowl.z], C.sage);
  const toilets = PET_IDS.map(id => PETS[id].toilet);
  const x = (toilets[0].x + toilets[1].x) / 2;
  shape(home, softCube, [2.09, .025, .93], [x, .015, toilets[0].z], C.oat);
  shape(home, softCube, [2.09, .35, .105], [x, .19, toilets[0].z + .45], C.walnut, 'wood');
  for (const id of PET_IDS) {
    const { home: { x, z }, toilet } = PETS[id];
    const dog = id === 'verdell';
    shape(home, softCube, [1.20, 0.065, 1.06], [x, 0.035, z], dog ? C.pine : C.rust);
    shape(home, softCube, [0.99, 0.046, 0.84], [x, 0.076, z], dog ? C.sage : C.oat);
    shape(home, softCube, [1.08, .16, .15], [x, .13, z - .43], dog ? C.sage : C.oat);

    shape(home, softCube, [.86, .052, .69], [toilet.x, .045, toilet.z], dog ? C.pine : C.clay);
    shape(home, softCube, [.70, .019, .52], [toilet.x, .079, toilet.z], dog ? C.paper : C.oat);
    for (const side of [-1, 1]) shape(home, softCube, [.07, .10, .65], [toilet.x + side * .39, .10, toilet.z],
      dog ? C.sage : C.coral);
    shape(home, softCube, [.78, .11, .07], [toilet.x, .10, toilet.z - .31], dog ? C.sage : C.coral);
  }
}

export function decorateHome(scene: THREE.Scene): THREE.Group {
  const home = new THREE.Group();

  const width = HOUSE.maxX - HOUSE.minX;
  const depth = HOUSE.maxZ - HOUSE.minZ;
  const z = (HOUSE.minZ + HOUSE.maxZ) / 2;
  for (const [margin, height, y, color, surface] of [
    [.49, .40, -.42, 0xa5725a, 'ceramic'],
    [.29, .20, -.17, 0x815841, 'wood'],
    [.16, .09, -.048, C.oat, 'wood'],
  ] as const) {
    const edge = new RoundedBoxGeometry(width + margin, height, depth + margin, 1, height * .42);
    shape(home, edge, [1, 1, 1], [0, y, z], color, surface, y < -.1);
  }
  cottageFloor(home);
  rearWall(home);
  roomPartitions(home);
  const entry = entryDoor(home);

  const wx=-3.12,wz=HOUSE.minZ;
  panel(home,[wx,2.04,wz-.12],[1.84,1.52],gardenView(),C.sky,.20);
  for(const x of [-4.02,-2.22,wx])shape(home,softCube,[.09,1.53,.15],[x,2.04,wz+.10],C.paper,'wood');
  shape(home,softCube,[1.88,.075,.15],[wx,2.13,wz+.10],C.paper,'wood');
  shape(home,softCube,[1.98,.10,.30],[wx,1.30,wz+.14],C.oat,'wood');
  shape(home,softCube,[1.95,.09,.20],[wx,2.78,wz+.14],C.paper,'wood');
  const curtains=new THREE.Group();curtains.name='KitchenWindowCurtains';
  for(const side of [-1,1]){
    const leaf=new THREE.Group();leaf.name=side===-1?'CurtainLeft':'CurtainRight';
    leaf.position.set(wx+side*.86,0,wz+.27);
    for(let i=0;i<8;i++)shape(leaf,softCube,[.125,1.46,.075],[-side*(i+.5)*.108,2.04,.026*Math.cos(i*Math.PI)],i%2?0xe7c5a1:0xd7ab80,'fabric');
    leaf.scale.x=.25;batchRigidParts(leaf,true);curtains.add(leaf);
  }
  const rod=shape(curtains,drum,[.032,2.05,.032],[wx,2.84,wz+.23],C.brass,'metal');rod.rotation.z=Math.PI/2;
  // Wide but invisible selection surface makes the window tappable on phones.
  // A hinged sash moves independently of the curtains. The garden view
  // remains behind it, so opening the window actually changes the geometry.
  const sash=new THREE.Group();sash.name='WindowSash';sash.position.set(wx+.90,2.04,wz+.16);
  for(const x of [-.84,-.04])shape(sash,softCube,[.052,1.34,.075],[x,0,0],C.paper,'wood');
  for(const y of [-.66,0,.66])shape(sash,softCube,[.84,.055,.075],[-.44,y,0],C.paper,'wood');
  shape(sash,softCube,[.038,.15,.055],[-.79,-.04,.06],C.brass,'metal');
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(.78,1.27),new THREE.MeshBasicMaterial({color:0xb3cfc4,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide}));
  glass.position.x=-.44;sash.add(glass);curtains.add(sash);
  const windowHit=new THREE.Mesh(new THREE.BoxGeometry(1.80,1.48,.025),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
  windowHit.position.set(wx,2.04,wz+.30);curtains.add(windowHit);
  home.add(curtains);
  // Separate washable sage tile cladding behind the cooking zone.
  panel(home,[COUNTER.x+.15,1.31,HOUSE.minZ+.137],[5.79,2.50],kitchenAccent(),0xa4bfb0);
  shape(home,cube,[5.87,.075,.052],[COUNTER.x+.15,2.58,HOUSE.minZ+.15],C.walnut,'wood');
  petNooks(home);
  batchRigidParts(home, true);
  scene.add(home);
  return entry;
}
