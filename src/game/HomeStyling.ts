import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PETS, PET_IDS } from '../shared/pets';
import { batchRigidParts, colors as C, cube, drum, finish, paintedMap, panel, plane, softCube, torus, type XYZ } from './ArtKit';
import { COUNTER, EAST_WALL, HOME_DOORS, HOME_PLACEMENTS, HOME_WALLS, HOUSE, HOUSE_ENTRY, OFFICE_END, WC_START, WEST_WALL } from '../shared/home';
import { botanicalPrint, gardenView, oakFloor } from './ArtTextures';

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
  for (const [x1, x2, y1, y2] of [
    [HOUSE.minX, left, 0, height], [right, HOUSE.maxX, 0, height],
    [left, right, 0, bottom], [left, right, top, height],
  ]) {
    shape(home, cube, [x2 - x1, y2 - y1, .24], [(x1 + x2) / 2, (y1 + y2) / 2, z], C.limestone);
  }
  panel(home, [center, 2.03, z - .12], [3.36, 1.60], gardenView(), C.sky, .20);
  // The sash sits in shadow behind the casing. The sill projects into the room.
  for (const x of [left, right]) {
    shape(home, softCube, [0.13, 1.70, 0.23], [x, 2.03, z + .14], C.paper, 'wood');
    shape(home, cube, [0.051, 1.57, 0.068], [x, 2.03, z + .015], C.walnut, 'wood');
  }
  shape(home, softCube, [0.093, 1.57, 0.092], [center, 2.03, z + .012], C.paper, 'wood');
  shape(home, softCube, [3.42, 0.074, 0.084], [center, 2.19, z + .010], C.paper, 'wood');
  shape(home, softCube, [3.61, 0.105, 0.40], [center, bottom, z + .14], C.oat, 'wood');
  shape(home, softCube, [3.54, 0.092, 0.23], [center, top, z + .14], C.paper, 'wood');
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
    const color = x > EAST_WALL - .15 && z > OFFICE_END - .15 ? C.sage : C.limestone;
    shape(home, cube, [width, height, depth], [x, height / 2, z], color);
    shape(home, cube, [width + .028, .054, depth + .028], [x, height, z], C.walnut, 'wood');
  }
  // Deep rear and far side walls establish the volume. The viewer-facing sides are cut away.
  for (const side of [-1, 1]) {
    const x = side * HOUSE.maxX;
    const height = side < 0 ? 1.22 : .54;
    const depth = HOUSE.maxZ - HOUSE.minZ;
    const z = (HOUSE.minZ + HOUSE.maxZ) / 2;
    shape(home, cube, [.22, height, depth], [x, height / 2, z], C.limestone);
    shape(home, cube, [.052, height * .53, depth - .20], [x - side * .126, height * .265, z], C.sage);
    shape(home, cube, [.27, .07, depth], [x, height, z], C.walnut, 'wood');
  }
  for (const [key, { x, z, width }] of Object.entries(HOME_DOORS)) {
    shape(home, cube, [.40, .024, width], [x, .018, z], C.oat, 'wood');
    for (const side of [-1, 1]) {
      shape(home, softCube, [.25, .96, .103], [x, .48, z + side * width / 2], C.walnut, 'wood');
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

function tileFloor(home: THREE.Group, x1: number, x2: number, z1: number, z2: number, bathroom: boolean): void {
  const seam = bathroom ? '#a5b8ac' : '#bcaa96';
  const shades = bathroom ? ['#c8d8ca', '#d3dccb', '#bad0c2', '#dbe3d4'] : ['#dfcbb3', '#ead7c1', '#e3d1bb', '#d5bfa8'];
  const map = paintedMap(bathroom ? 'bathroom-floor' : 'wc-floor', 256, 256, ctx => {
    ctx.fillStyle = seam;
    ctx.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 6; col++) {
      ctx.fillStyle = shades[(row * 5 + col * 3 + (row + col) % 3) % shades.length];
      ctx.fillRect(col * 43 + 1, row * 32 + 1, 41, 30);
    }
  });
  const tile = panel(home, [(x1 + x2) / 2, .009, (z1 + z2) / 2], [x2 - x1, z2 - z1], map, C.sage);
  tile.rotation.x = -Math.PI / 2;
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
    const { home: { x, z }, bowl, toilet } = PETS[id];
    const dog = id === 'verdell';
    shape(home, softCube, [1.20, 0.065, 1.06], [x, 0.035, z], dog ? C.pine : C.rust);
    shape(home, softCube, [0.99, 0.046, 0.84], [x, 0.076, z], dog ? C.sage : C.oat);
    shape(home, softCube, [1.08, .16, .15], [x, .13, z - .43], dog ? C.sage : C.oat);
    shape(home, drum, [0.18, 0.086, 0.18], [bowl.x, 0.051, bowl.z],
      dog ? C.leaf : C.clay, 'ceramic');
    const rim = shape(home, torus, [0.165, 0.165, 0.165],
      [bowl.x, 0.104, bowl.z], C.paper, 'ceramic');
    rim.rotation.x = -Math.PI / 2;
    shape(home, drum, [.119, .035, .119], [bowl.x, .078, bowl.z], C.walnut);
    shape(home, softCube, [.86, .052, .69], [toilet.x, .045, toilet.z], dog ? C.pine : C.clay);
    shape(home, softCube, [.70, .019, .52], [toilet.x, .079, toilet.z], dog ? C.paper : C.oat);
    for (const side of [-1, 1]) shape(home, softCube, [.07, .10, .65], [toilet.x + side * .39, .10, toilet.z],
      dog ? C.sage : C.coral);
    shape(home, softCube, [.78, .11, .07], [toilet.x, .10, toilet.z - .31], dog ? C.sage : C.coral);
  }
}

function platformShadow(scene: THREE.Scene): void {
  const map = paintedMap('platform-shadow', 128, 128, (ctx) => {
    const ink = ctx.createRadialGradient(64, 64, 15, 64, 64, 64);
    ink.addColorStop(0, '#3e302c66');
    ink.addColorStop(0.72, '#3e302c3b');
    ink.addColorStop(1, '#3e302c00');
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, 128, 128);
  });
  if (!map) return;
  const shadow = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({
    map, transparent: true, depthWrite: false, toneMapped: false,
  }));
  shadow.position.set(-0.14, -0.634, 1.9);
  shadow.scale.set(25.5, 26, 1);
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
}

export function decorateHome(scene: THREE.Scene): THREE.Group {
  const home = new THREE.Group();
  shape(scene, cube, [90, .06, 90], [0, -.67, 0], 0xa5b8a5);
  platformShadow(scene);

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
  const floor = panel(home, [0, 0, z], [width, depth], oakFloor(), C.oak);
  floor.rotation.x = -Math.PI / 2;
  tileFloor(home, HOUSE.minX, WEST_WALL, WC_START, HOUSE.maxZ, false);
  tileFloor(home, EAST_WALL, HOUSE.maxX, OFFICE_END, HOUSE.maxZ, true);
  rearWall(home);
  roomPartitions(home);
  const entry = entryDoor(home);

  const pictureX = -3.11;
  shape(home, softCube, [1.16, 1.28, .065], [pictureX, 2.07, HOUSE.minZ + .14], C.walnut, 'wood');
  panel(home, [pictureX, 2.07, HOUSE.minZ + .177], [1.02, 1.13], botanicalPrint(), C.paper);
  shape(home, cube, [4.92, 1.25, .021], [COUNTER.x + .27, .71, HOUSE.minZ + .136], 0xe3cfb2);
  petNooks(home);
  batchRigidParts(home, true);
  scene.add(home);
  return entry;
}
