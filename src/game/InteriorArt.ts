import * as THREE from 'three';
import { colors, cube, drum, finish as mat, orb, panel, softCube, torus, type XYZ } from './ArtKit';
import { deskDisplay, kitchenTiles, tvStill, upholsteryWeave, wovenRug } from './ArtTextures';
import { cushionGeometry, tabletopGeometry } from './FurnitureGeometry';
import { COUNTER } from '../shared/home';
import { points } from '../shared/protocol';

type FurnitureId = 'sofa' | 'bed' | 'kitchen' | 'desk' | 'tv' | 'table';
type Point = { x: number; z: number };
type Register = (id: FurnitureId, group: THREE.Group, point: Point) => void;

const C = {
  linen: colors.paper, cream: 0xfff3dd, oat: colors.oat,
  moss: colors.pine, mossDark: 0x31574c, paleSage: colors.sage,
  wood: colors.oak, woodLight: 0xc1926d, woodDark: colors.walnut,
  terracotta: colors.clay, blush: colors.coral, warmWhite: colors.limestone,
  stone: 0xd8cbb8, slate: 0x42595b, graphite: colors.ink,
  brass: colors.brass, glass: 0x8cb4ad, softBlue: 0x78ada8,
};

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
  const geometry = style === 'soft' ? softCube : style === 'square' ? cube : style;
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
  const sofa = group(-3.1, 1.7);
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
  pillow(sofa, [-0.83, 0.96, -0.08], C.linen, -0.30);
  pillow(sofa, [0.84, 0.98, -0.085], C.terracotta, 0.27);
  return sofa;
}

function makeBed(): THREE.Group {
  const bed = group(-3.85, -2.62);
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
  // Inset cabinet fronts and a dedicated oven.
  for (const x of [-1.56, -0.70, 0.78, 1.56]) {
    part(kitchen, [0.72, 0.68, 0.036], [x, 0.51, 0.431], C.moss, 'soft', false, 'wood');
    part(kitchen, [0.53, 0.48, 0.017], [x, 0.49, 0.451], 0x5e8271, 'soft', false, 'wood');
    part(kitchen, [0.30, 0.025, 0.038], [x, 0.74, 0.480], C.brass, 'soft', false, 'metal');
  }
  part(kitchen, [0.83, 0.65, 0.055], [0.05, 0.52, 0.449], C.graphite);
  part(kitchen, [0.67, 0.45, 0.012], [0.05, 0.50, 0.485], C.slate, 'soft', false, 'screen');
  part(kitchen, [0.37, 0.025, 0.025], [0.05, 0.79, 0.497], C.brass, 'soft', false, 'metal');
  for (const x of [-0.17, 0.05, 0.27]) round(kitchen, 0.027, 0.017, [x, 0.84, 0.493], C.brass, 'metal');

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
  }
  const kettle = oval(kitchen, [0.18, 0.195, 0.154], [-1.69, 1.19, 0.15], C.terracotta);
  kettle.castShadow = true;
  ring(kitchen, 0.085, [-1.68, 1.37, 0.14], C.woodDark);
  oval(kitchen, [0.135, 0.047, 0.065], [-1.53, 1.22, 0.17], C.terracotta).rotation.z = 0.43;
  return kitchen;
}

function makeDesk(): THREE.Group {
  const desk = group(2.68, 1.73);
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
  part(desk, [1.09, 0.74, 0.09], [0, 1.52, -0.28], C.graphite, 'soft', true, 'metal');
  panel(desk, [0, 1.52, -0.228], [1.00, 0.64], deskDisplay(), C.slate, 0.25);
  part(desk, [0.08, 0.32, 0.08], [0, 1.12, -0.27], C.graphite, 'soft', false, 'metal');
  part(desk, [0.40, 0.045, 0.26], [0, 1.075, -0.26], C.graphite, 'soft', false, 'metal');
  part(desk, [0.93, 0.017, 0.41], [0, 1.052, 0.23], C.mossDark, 'soft');
  part(desk, [0.70, 0.035, 0.18], [0, 1.08, 0.34], C.linen, 'soft');
  for (const z of [0.298, 0.342, 0.386]) {
    part(desk, [0.6, 0.009, 0.019], [0, 1.104, z], C.slate, 'square');
  }
  oval(desk, [0.063, 0.035, 0.09], [0.55, 1.10, 0.34], C.cream);
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
  return desk;
}

function makeTv(): THREE.Group {
  const tv = group(-0.6, -3.63);
  part(tv, [1.92, 0.36, 0.50], [0, 0.37, 0], C.woodLight, 'soft', true, 'wood');
  part(tv, [1.79, 0.12, 0.39], [0, 0.147, -0.01], C.woodDark, 'soft', true, 'wood');
  for (const x of [-0.60, 0, 0.60]) {
    part(tv, [0.575, 0.28, 0.027], [x, 0.367, 0.248], C.wood, 'soft', false, 'wood');
    part(tv, [0.15, 0.018, 0.021], [x, 0.442, 0.271], C.brass, 'soft', false, 'metal');
  }
  part(tv, [1.88, 0.048, 0.55], [0, 0.55, 0], C.woodDark, 'soft', false, 'wood');
  for (const x of [-0.65, 0.65]) {
    part(tv, [0.06, 0.20, 0.21], [x, 0.632, -0.03], C.graphite, 'square', false, 'metal');
  }
  part(tv, [1.82, 1.04, 0.068], [0, 1.25, -0.045], C.graphite, 'soft', true, 'metal');
  panel(tv, [0, 1.26, -0.010], [1.744, 0.938], tvStill(), C.softBlue, 0.28);
  part(tv, [0.043, 0.012, 0.010], [0.80, 0.756, -0.009], C.glass);
  return tv;
}

function makeCoffeeTable(): THREE.Group {
  const table = group(-1.88, 0.03);
  part(table, [1, 1, 1], [0, 0.49, 0], C.woodLight, tabletopGeometry, true, 'wood');
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    const leg = part(table, [0.103, 0.46, 0.105], [Math.cos(angle) * 0.285, 0.24, Math.sin(angle) * 0.285],
      C.woodDark, 'soft', true, 'wood');
    leg.rotation.order = 'YXZ';
    leg.rotation.set(0, -angle, 0.29);
  }
  round(table, 0.25, 0.038, [0.13, 0.59, -0.12], C.oat);
  round(table, 0.114, 0.12, [-0.22, 0.638, 0.02], C.moss);
  round(table, 0.087, 0.015, [-0.22, 0.699, 0.02], C.woodDark);
  ring(table, 0.07, [-0.075, 0.65, 0.02], C.moss);
  part(table, [0.32, 0.038, 0.22], [0.15, 0.59, 0.24], C.terracotta).rotation.y = 0.27;
  return table;
}

export function buildFurniture(register: Register): void {
  register('sofa', makeSofa(), { x: -3.0, z: 0.6 });
  register('bed', makeBed(), { x: -3.85, z: -0.76 });
  register('kitchen', makeKitchen(), points.kitchen);
  register('desk', makeDesk(), points.desk);
  register('tv', makeTv(), { x: -0.55, z: -2.58 });
  register('table', makeCoffeeTable(), { x: -0.80, z: 0.04 });
}

export function buildSoftRugs(scene: THREE.Scene): void {
  const rugs = [
    { style: 'living', x: -2.78, z: 1.22, width: 4.36, depth: 3.36, edge: C.terracotta },
    { style: 'work', x: 2.68, z: 2.10, width: 2.60, depth: 2.82, edge: C.moss },
    { style: 'sleep', x: -3.91, z: -2.56, width: 3.30, depth: 3.52, edge: C.oat },
  ] as const;
  for (const {style, x, z, width, depth, edge} of rugs) {
    part(scene, [width, 0.022, depth], [x, 0.011, z], edge);
    const textile = panel(scene, [x, 0.024, z], [width - 0.07, depth - 0.07], wovenRug(style), edge);
    textile.rotation.x = -Math.PI / 2;
  }
}
