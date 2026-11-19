import * as THREE from 'three';
import { batchRigidParts, colors as C, cube, drum, finish, orb, panel, plane, softCube, type XYZ } from './ArtKit';
import { STATIONS, type PlaceId, type Station } from '../shared/locations';
import { MARKET_PRODUCTS } from '../shared/market';

const shared = new Set<THREE.BufferGeometry>([cube, softCube, drum, orb, plane]);
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
function tree(parent: THREE.Group, x: number, z: number, variation: number) {
  const tall = 0.96 + variation * 0.13;
  shape(parent, [0.085, tall * 1.5, 0.086], [x, tall * 0.75, z], C.walnut, drum);
  for (let i = 0; i < 3; i++) {
    const angle = i * 2.3;
    shape(parent, [0.48 - i * 0.055, 0.67, 0.45], [x + Math.cos(angle) * 0.17, tall * (1.24 + i * 0.23), z + Math.sin(angle) * 0.17],
      [0x728d68, 0x587a61, 0x91a579][i], orb, i === 0);
  }
}
function bench(parent: THREE.Group, width: number) {
  shape(parent, [width, 0.12, 0.57], [0, 0.50, 0.055], C.oak, softCube, true);
  for (const x of [-width * 0.40, width * 0.40]) {
    shape(parent, [.09, .53, .44], [x, .26, .03], C.ink, cube);
    shape(parent, [.07, .73, .09], [x, .53, -.22], C.ink, cube);
  }
  for (const y of [.72, .92]) shape(parent, [width, .12, .075], [0, y, -.23], C.oak);
}
function rack(parent: THREE.Group, station: Station) {
  if (station.action.kind !== 'shelf') return;
  const isCold = station.id === 'dairy' || station.id === 'meat';
  const color = isCold ? 0x75a3a5 : 0xc29365;
  const depth = station.depth;
  shape(parent, [station.width, .14, depth], [0, .12, 0], C.darkWood);
  shape(parent, [station.width, 1.58, .12], [0, .92, -.26], isCold ? 0xc2d3c8 : 0xb88a68, cube);
  for (const x of [-.89, .89]) shape(parent, [.075, 1.6, depth], [x, .91, 0], color);
  const products = MARKET_PRODUCTS.filter(p => station.id === 'drinks'
    ? p.stockKey === 'tea' || p.stockKey === 'coffee' : station.action.kind === 'shelf' && station.action.categories.includes(p.category));
  for (let row = 0; row < 3; row++) {
    const y = .34 + row * .49;
    shape(parent, [station.width, .073, depth], [0, y, 0], color);
    for (let i = 0; i < 7; i++) {
      const product = products[(row * 7 + i) % products.length];
      const height = product?.category === 'meat' ? .096 : [.27, .19, .22][(row + i) % 3];
      const x = -.72 + i * .237;
      const useOrb = product?.category === 'fruit' || product?.category === 'vegetables';
      shape(parent, useOrb ? [.086, .095, .08] : [.175, height, .22],
        [x, y + .050 + (useOrb ? .09 : height / 2), .079],
        accents[(i + row * 3) % accents.length], useOrb ? orb : softCube);
      if (!useOrb) shape(parent, [.121, height * .44, .012], [x, y + .056 + height / 2, .196], C.paper, cube);
    }
  }
  shape(parent, [station.width, .12, depth], [0, 1.68, 0], color, softCube, true);
}
function facade(parent: THREE.Group, color: number, open: boolean) {
  shape(parent, [1.21, 2.24, .24], [0, 1.12, 0], C.walnut);
  shape(parent, [.97, 1.99, .14], [0, 1.04, .14], open ? 0x536d65 : color);
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

function buildStation(station: Station, place: PlaceId, textures: THREE.Texture[], materials: THREE.Material[]) {
  const root = new THREE.Group();
  root.position.set(station.center.x, 0, station.center.z);
  const kind = station.action.kind;
  if (kind === 'shelf') {
    rack(root, station);
    sign(root, station.name, 1.84, .33, 1.65, C.paper, textures, materials);
  } else if (kind === 'door') {
    if (station.center.z > 4) root.rotation.y = Math.PI;
    facade(root, C.pine, place === 'street');
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
  } else if (kind === 'terminal' || kind === 'pickup' || kind === 'checkout') {
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

export function createLocation(place: Exclude<PlaceId, 'home'>) {
  const root = new THREE.Group();
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];
  const stations = new Map<string, THREE.Group>();
  const bulbs: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
  const outdoor = place === 'street' || place === 'park';
  const floor = new THREE.Group();
  root.add(floor);
  shape(floor, [12.3, .40, 10.3], [0, -.23, 0], outdoor ? 0x536649 : C.walnut, softCube, true);
  shape(floor, [12, .06, 10], [0, -.031, 0], outdoor ? 0xa7b586 : place === 'market' ? 0xcacac0 : 0xc69b6c, cube);
  if (outdoor) {
    for (const [x, z, w, d] of [
      [0, 3.75, 12, 1.36], [0, 0.37, 12, 1.28], [-2.68, 0, 1.35, 8.1], [2.52, 0, 1.30, 8.1],
    ]) shape(floor, [w, .026, d], [x, .014, z], place === 'park' ? 0xd6c1a0 : 0xc6beb0, cube);
  } else {
    const seamColor = place === 'market' ? 0xb2afa2 : 0xaf8257;
    for (let i = -5; i <= 5; i++) shape(floor, [.018, .006, 10], [i, .005, 0], seamColor, cube);
    for (let i = -4; i <= 4; i++) shape(floor, [12, .006, .017], [0, .005, i], seamColor, cube);
    shape(floor, [12.2, 2.91, .19], [0, 1.46, -5.01], place === 'cafe' ? 0xd3b89b : 0xbbcec3, cube);
    shape(floor, [.19, 2.91, 10.1], [-6.05, 1.46, 0], place === 'cafe' ? 0x9fac88 : 0xa4b8b1, cube);
    for (const y of [.25, .78, 2.86]) {
      shape(floor, [12.2, .13, .23], [0, y, -4.95], C.paper);
      shape(floor, [.23, .13, 10.1], [-5.99, y, 0], C.paper);
    }
  }
  if (place === 'street') {
    for (let i = 0; i < 3; i++) {
      const x = [-3.88, .11, 4.10][i];
      shape(floor, [3.4, 2.85, .81], [x, 1.43, -4.66], [0xdaaf84, 0xa6baa3, 0xd8b5a8][i], softCube, true);
      shape(floor, [3.67, .28, 1.03], [x, 2.96, -4.62], [0x9a6155, 0x537b66, 0x9b6957][i]);
      if (i > 0) {
        for (let stripe = 0; stripe < 8; stripe++) {
          const awning = shape(floor, [.27, .065, .49], [x - .945 + stripe * .27, 2.29, -3.95],
            stripe % 2 ? C.paper : i === 1 ? C.pine : C.coral);
          awning.rotation.x = .22;
        }
      }
      for (const dx of [-1.16, 1.16]) {
        shape(floor, [.59, 1.1, .08], [x + dx, 1.75, -4.21], C.paper);
        shape(floor, [.48, .92, .055], [x + dx, 1.75, -4.15], C.sky);
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
    for (const [x, z, k] of [[-5.65, -2.5, 0], [5.58, -2.4, 2], [-5.60, 2.7, 1], [5.69, 3.08, 0]]) {
      tree(floor, x, z, k);
      shape(floor, [.64, .20, .59], [x, .11, z], C.rust, drum);
    }
    for (const [x, z] of [[-4.90, -1.85], [4.85, -.58], [-3.93, 3.13], [4.31, 3.18]]) {
      shape(floor, [.58, .12, .30], [x, .062, z], C.clay);
      for (let i = 0; i < 4; i++) {
        shape(floor, [.073, .12, .073], [x + (i - 1.5) * .13, .16, z], C.leaf, orb);
        shape(floor, [.042, .054, .041], [x + (i - 1.5) * .13, .26 + i%2 * .035, z], i % 2 ? 0xe0b87a : 0xd89d9d, orb);
      }
    }
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
  batchRigidParts(floor);
  for (const station of STATIONS[place]) {
    const group = buildStation(station, place, textures, materials);
    stations.set(station.id, group);
    root.add(group);
  }
  root.updateMatrixWorld(true);
  const corners = ({ min, max }: THREE.Box3): XYZ[] => {
    const result: XYZ[] = [];
    for (const x of [min.x,max.x]) for (const y of [min.y,max.y]) for (const z of [min.z,max.z]) result.push([x,y,z]);
    return result;
  };
  const horizontal = [...stations.values()].flatMap(station => corners(new THREE.Box3().setFromObject(station)));
  const vertical = corners(new THREE.Box3().setFromObject(root));
  return {
    root, stations, horizontal, vertical,
    setNight(night: boolean) { for (const bulb of bulbs) bulb.material.emissiveIntensity = night ? 1.2 : .02; },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>();
      root.traverse(mesh => { if (mesh instanceof THREE.Mesh && !shared.has(mesh.geometry)) geometries.add(mesh.geometry); });
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
  for (const station of STATIONS.home) {
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
