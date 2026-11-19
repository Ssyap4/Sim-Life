import * as THREE from 'three';
import { colors, cube, drum, finish as mat, orb, panel, softCube, torus, type XYZ } from './ArtKit';
import { kitchenTiles, tvStill, wovenRug } from './ArtTextures';

type FurnitureId = 'sofa' | 'bed' | 'kitchen' | 'desk' | 'tv' | 'table';
type Point = { x: number; z: number };
type Register = (id: FurnitureId, group: THREE.Group, point: Point) => void;

const C = {
  linen: colors.paper, cream: 0xfff3dd, oat: colors.oat,
  moss: colors.pine, mossDark: 0x31574c, paleSage: colors.sage,
  wood: colors.oak, woodLight: 0xc48c59, woodDark: colors.walnut,
  terracotta: colors.clay, blush: colors.coral, warmWhite: colors.limestone,
  stone: 0xe0c5a4, slate: 0x42595b, graphite: colors.ink,
  brass: colors.brass, glass: 0x8cb4ad, softBlue: 0x78ada8,
};

function part(parent: THREE.Object3D, size: XYZ, position: XYZ, color: number,
  style: 'soft' | 'square' = 'soft', shadow = false,
  finish: 'fabric' | 'wood' | 'metal' | 'screen' = 'fabric'): THREE.Mesh {
  const mesh = new THREE.Mesh(style === 'soft' ? softCube : cube, mat(color, finish));
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
  color: number, finish: 'fabric' | 'wood' | 'metal' | 'screen' = 'wood'): THREE.Mesh {
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
function pillow(parent: THREE.Object3D, position: XYZ, color: number, angle = 0): void {
  const cushion = oval(parent, [0.255, 0.215, 0.125], position, color, true);
  cushion.rotation.z = angle;
}

function makeSofa(): THREE.Group {
  const sofa = group(-3.1, 1.7);
  part(sofa, [2.60, 0.19, 1.02], [0, 0.24, 0], C.woodDark, 'soft', true, 'wood');
  for (const x of [-1.05, 1.05]) for (const z of [-0.36, 0.36]) {
    part(sofa, [0.12, 0.20, 0.12], [x, 0.11, z], C.woodDark, 'soft', false, 'wood');
  }
  part(sofa, [2.54, 0.37, 0.98], [0, 0.46, 0.00], C.moss, 'soft', true);
  part(sofa, [2.54, 0.77, 0.28], [0, 0.84, 0.46], C.mossDark, 'soft', true);
  for (const x of [-1.17, 1.17]) {
    oval(sofa, [0.17, 0.31, 0.55], [x, 0.70, 0], C.moss, true);
  }
  for (const x of [-0.76, 0, 0.76]) {
    part(sofa, [0.75, 0.22, 0.76], [x, 0.74, -0.12], 0x709683, 'soft', true);
    const back = part(sofa, [0.70, 0.51, 0.19], [x, 0.97, 0.24], C.moss, 'soft', true);
    back.rotation.x = -0.11;
    part(sofa, [0.62, 0.023, 0.027], [x, 0.75, -0.502], C.paleSage);
  }
  pillow(sofa, [-0.90, 0.99, -0.14], C.linen, -0.16);
  pillow(sofa, [0.90, 1.01, -0.15], C.terracotta, 0.13);
  // The throw rolls over the cushion edge, with a hanging hem and woven stripes.
  part(sofa, [0.53, 0.053, 0.60], [-0.51, 0.866, -0.185], C.blush);
  part(sofa, [0.53, 0.22, 0.054], [-0.51, 0.77, -0.484], C.blush);
  for (const x of [-0.69, -0.59, -0.49, -0.39, -0.29]) {
    part(sofa, [0.026, 0.035, 0.035], [x, 0.653, -0.497], C.oat);
  }
  return sofa;
}

function makeBed(): THREE.Group {
  const bed = group(-3.85, -2.62);
  part(bed, [2.68, 0.27, 2.70], [0, 0.33, 0], C.woodDark, 'soft', true, 'wood');
  for (const x of [-1.11, 1.11]) for (const z of [-1.05, 1.05]) {
    part(bed, [0.13, 0.22, 0.13], [x, 0.13, z], C.woodDark, 'soft', false, 'wood');
  }
  part(bed, [2.67, 1.13, 0.16], [0, 0.82, -1.30], C.woodDark, 'soft', true, 'wood');
  part(bed, [2.49, 0.87, 0.08], [0, 0.87, -1.184], C.oat);
  for (const x of [-0.98, -0.49, 0, 0.49, 0.98]) {
    part(bed, [0.42, 0.70, 0.075], [x, 0.87, -1.12], 0xba7b5a);
  }
  part(bed, [2.54, 0.34, 2.48], [0, 0.62, 0.04], C.warmWhite, 'soft', true);
  // Preserve sleeping character height: duvet stays around y=0.84.
  part(bed, [2.43, 0.14, 1.55], [0, 0.842, 0.46], C.terracotta, 'soft', true);
  part(bed, [2.45, 0.045, 0.24], [0, 0.925, -0.28], C.linen);
  part(bed, [2.46, 0.28, 0.09], [0, 0.755, 1.23], C.terracotta);
  for (const z of [0.06, 0.33, 0.60, 0.87, 1.11]) {
    part(bed, [2.26, 0.017, 0.026], [0, 0.914, z], 0xd88970);
  }
  for (const x of [-1.18, 1.18]) {
    part(bed, [0.085, 0.19, 1.50], [x, 0.78, 0.46], C.terracotta);
  }
  for (const x of [-0.61, 0.61]) {
    const p = part(bed, [1.03, 0.19, 0.62], [x, 0.86, -0.80], C.cream, 'soft', true);
    p.rotation.y = x < 0 ? 0.045 : -0.045;
    part(bed, [0.84, 0.014, 0.019], [x, 0.963, -0.54], C.oat);
  }
  for (const x of [-1.20, 1.20]) {
    part(bed, [0.065, 0.15, 2.50], [x, 0.73, 0.01], C.woodLight, 'soft', false, 'wood');
  }
  return bed;
}

function makeKitchen(): THREE.Group {
  const kitchen = group(3.45, -3.91);
  part(kitchen, [4.23, 0.87, 0.83], [0, 0.47, 0], C.mossDark, 'square', true);
  part(kitchen, [4.39, 0.12, 0.96], [0, 0.966, 0], C.stone, 'soft', true);
  part(kitchen, [4.19, 0.065, 0.083], [0, 0.115, 0.41], C.woodDark, 'square', false, 'wood');
  // Inset cabinet fronts and a dedicated oven.
  for (const x of [-1.56, -0.70, 0.78, 1.56]) {
    part(kitchen, [0.72, 0.68, 0.036], [x, 0.51, 0.431], C.moss, 'soft', false, 'wood');
    part(kitchen, [0.48, 0.45, 0.015], [x, 0.51, 0.453], 0x5e8271);
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
    round(kitchen, 0.105, 0.019, [x, 1.077, z], C.graphite);
  }
  round(kitchen, 0.235, 0.085, [-0.87, 1.14, 0.15], C.slate, 'metal');
  part(kitchen, [0.33, 0.053, 0.068], [-1.16, 1.16, 0.17], C.woodDark, 'soft', false, 'wood');
  round(kitchen, 0.17, 0.018, [-0.87, 1.195, 0.15], C.oat);
  part(kitchen, [4.12, 0.63, 0.065], [0, 1.34, -0.443], C.stone, 'square');
  panel(kitchen, [0, 1.34, -0.409], [4.10, 0.61], kitchenTiles(), C.linen);
  part(kitchen, [1.07, 0.033, 0.22], [-0.57, 1.657, -0.28], C.stone);
  part(kitchen, [1.18, 0.22, 0.53], [-0.57, 1.79, -0.31], C.paleSage, 'soft');
  part(kitchen, [1.06, 0.06, 0.10], [-0.57, 1.62, -0.08], C.brass, 'soft', false, 'metal');

  // Sink, tap, dish rack and open display shelves.
  part(kitchen, [0.91, 0.023, 0.56], [1.28, 1.039, -0.05], C.glass, 'soft', false, 'metal');
  part(kitchen, [0.68, 0.014, 0.36], [1.28, 1.054, -0.05], C.slate, 'soft', false, 'metal');
  round(kitchen, 0.043, 0.32, [1.55, 1.23, -0.29], C.brass, 'metal');
  const tap = ring(kitchen, 0.15, [1.40, 1.37, -0.29], C.brass);
  tap.scale.y *= 0.55;
  part(kitchen, [0.03, 0.16, 0.032], [1.25, 1.31, -0.29], C.brass, 'soft', false, 'metal');
  for (const x of [0.45, 1.20, 1.86]) {
    part(kitchen, [0.70, 0.35, 0.30], [x, 1.79, -0.28], C.linen, 'soft', false, 'wood');
    part(kitchen, [0.26, 0.025, 0.021], [x, 1.70, -0.105], C.brass, 'soft', false, 'metal');
  }
  part(kitchen, [1.24, 0.07, 0.39], [-1.49, 1.57, -0.30], C.woodLight, 'soft', false, 'wood');
  for (const x of [-1.82, -1.55, -1.25]) {
    round(kitchen, 0.095, 0.20, [x, 1.71, -0.27], x < -1.5 ? C.oat : C.glass);
    round(kitchen, 0.105, 0.025, [x, 1.83, -0.27], C.woodDark);
  }
  const kettle = oval(kitchen, [0.18, 0.195, 0.154], [-1.69, 1.19, 0.15], C.terracotta);
  kettle.castShadow = true;
  ring(kitchen, 0.085, [-1.68, 1.37, 0.14], C.woodDark);
  oval(kitchen, [0.135, 0.047, 0.065], [-1.53, 1.22, 0.17], C.terracotta).rotation.z = 0.43;
  return kitchen;
}

function makeDesk(): THREE.Group {
  const desk = group(3.2, 1.46);
  part(desk, [2.25, 0.12, 0.98], [0, 0.966, 0], C.woodLight, 'soft', true, 'wood');
  part(desk, [2.14, 0.028, 0.88], [0, 1.038, -0.01], C.wood, 'soft', false, 'wood');
  part(desk, [0.47, 0.42, 0.79], [-0.82, 0.72, -0.019], C.woodDark, 'soft', true, 'wood');
  for (const y of [0.64, 0.83]) {
    part(desk, [0.42, 0.15, 0.045], [-0.82, y, 0.39], C.wood, 'soft', false, 'wood');
    part(desk, [0.15, 0.025, 0.044], [-0.82, y, 0.42], C.brass, 'soft', false, 'metal');
  }
  for (const x of [-0.96, 0.96]) for (const z of [-0.37, 0.37]) {
    part(desk, [0.085, 0.83, 0.09], [x, 0.49, z], C.woodDark, 'soft', true, 'wood');
  }
  part(desk, [1.09, 0.74, 0.09], [0, 1.52, -0.28], C.graphite, 'soft', true, 'metal');
  part(desk, [0.98, 0.61, 0.016], [0, 1.52, -0.218], 0x233f48, 'soft', false, 'screen');
  // Coding desktop: two panes, editor lines and a terminal strip.
  part(desk, [0.22, 0.53, 0.006], [-0.33, 1.54, -0.204], 0x405e64, 'square', false, 'screen');
  for (let i = 0; i < 6; i++) {
    const x = i % 2 ? -0.015 : 0.045;
    part(desk, [0.34 + (i % 3) * 0.045, 0.018, 0.007],
      [x, 1.74 - i * 0.070, -0.202], [C.glass, C.oat, C.moss, C.softBlue][i % 4], 'soft', false, 'screen');
  }
  part(desk, [0.60, 0.06, 0.008], [0.15, 1.245, -0.198], C.slate, 'square', false, 'screen');
  part(desk, [0.08, 0.32, 0.08], [0, 1.12, -0.27], C.graphite, 'soft', false, 'metal');
  part(desk, [0.40, 0.045, 0.26], [0, 1.075, -0.26], C.graphite, 'soft', false, 'metal');
  part(desk, [0.93, 0.017, 0.41], [0, 1.052, 0.23], C.mossDark, 'soft');
  part(desk, [0.70, 0.035, 0.18], [0, 1.08, 0.34], C.linen, 'soft');
  for (let i = 0; i < 8; i++) {
    part(desk, [0.055, 0.008, 0.055], [-0.28 + i * 0.08, 1.103, 0.34], C.slate, 'soft');
  }
  oval(desk, [0.063, 0.035, 0.09], [0.55, 1.10, 0.34], C.cream);
  // Ergonomic upholstered chair, similar position to the original interaction pose.
  part(desk, [0.61, 0.14, 0.58], [0, 0.48, 1.06], C.terracotta, 'soft', true);
  const back = oval(desk, [0.315, 0.37, 0.097], [0, 0.84, 1.33], C.terracotta, true);
  back.rotation.x = -0.10;
  oval(desk, [0.235, 0.225, 0.055], [0, 0.84, 1.255], C.blush);
  part(desk, [0.08, 0.30, 0.09], [0, 0.24, 1.07], C.slate, 'soft', false, 'metal');
  for (const x of [-0.26, 0.26]) {
    part(desk, [0.28, 0.045, 0.075], [x, 0.135, 1.08], C.slate, 'soft', false, 'metal');
    round(desk, 0.065, 0.07, [x, 0.085, 1.08], C.graphite, 'metal');
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
  part(tv, [1.92, 0.48, 0.48], [0, 0.31, 0], C.woodLight, 'soft', true, 'wood');
  for (const x of [-0.59, 0.59]) {
    part(tv, [0.56, 0.30, 0.036], [x, 0.32, 0.246], C.wood, 'soft', false, 'wood');
    part(tv, [0.19, 0.018, 0.028], [x, 0.40, 0.270], C.brass, 'soft', false, 'metal');
  }
  part(tv, [1.88, 0.048, 0.55], [0, 0.58, 0], C.woodDark, 'soft', false, 'wood');
  part(tv, [0.12, 0.47, 0.095], [0, 0.81, -0.05], C.graphite, 'soft', false, 'metal');
  part(tv, [0.48, 0.035, 0.24], [0, 0.64, -0.05], C.graphite, 'soft', false, 'metal');
  part(tv, [1.82, 1.04, 0.09], [0, 1.25, -0.045], C.graphite, 'soft', true, 'metal');
  panel(tv, [0, 1.25, 0.007], [1.69, 0.91], tvStill(), C.softBlue, 0.42);
  part(tv, [0.064, 0.016, 0.014], [0.765, 0.754, 0.007], C.glass);
  part(tv, [0.28, 0.028, 0.025], [0, 0.68, 0.05], C.slate, 'soft', false, 'metal');
  return tv;
}

function makeCoffeeTable(): THREE.Group {
  const table = group(-1.88, 0.03);
  const top = round(table, 0.68, 0.11, [0, 0.49, 0], C.woodDark);
  top.castShadow = true;
  round(table, 0.645, 0.033, [0, 0.553, 0], C.woodLight);
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    const leg = group(Math.cos(angle) * 0.30, Math.sin(angle) * 0.30);
    leg.rotation.y = -angle;
    table.add(leg);
    part(leg, [0.115, 0.48, 0.12], [0, 0.24, 0], C.woodDark, 'soft', true, 'wood').rotation.z = 0.26;
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
  register('kitchen', makeKitchen(), { x: 3.10, z: -2.66 });
  register('desk', makeDesk(), { x: 3.17, z: 3.65 });
  register('tv', makeTv(), { x: -0.55, z: -2.58 });
  register('table', makeCoffeeTable(), { x: -0.80, z: 0.04 });
}

export function buildSoftRugs(scene: THREE.Scene): void {
  const rugs = [
    { style: 'living', x: -2.78, z: 1.22, width: 4.36, depth: 3.36, edge: C.terracotta },
    { style: 'work', x: 3.20, z: 1.83, width: 2.65, depth: 2.92, edge: C.moss },
    { style: 'sleep', x: -3.91, z: -2.56, width: 3.30, depth: 3.52, edge: C.oat },
  ] as const;
  for (const {style, x, z, width, depth, edge} of rugs) {
    part(scene, [width, 0.022, depth], [x, 0.011, z], edge);
    const textile = panel(scene, [x, 0.024, z], [width - 0.07, depth - 0.07], wovenRug(style), edge);
    textile.rotation.x = -Math.PI / 2;
  }
}
