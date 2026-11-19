import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Shared, inexpensive stylized furniture kit. Existing gameplay anchors and
 * walkable floor space are intentionally owned by World, not by this artwork.
 * The unit geometries are reused and scaled rather than allocating one per part.
 */
type FurnitureId = 'sofa' | 'bed' | 'kitchen' | 'desk' | 'tv' | 'table';
type Point = { x: number; z: number };
type Register = (id: FurnitureId, group: THREE.Group, point: Point) => void;
type XYZ = [number, number, number];

const cube = new THREE.BoxGeometry(1, 1, 1);
const softCube = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
const orb = new THREE.SphereGeometry(1, 14, 10);
const drum = new THREE.CylinderGeometry(1, 1, 1, 16);
const torus = new THREE.TorusGeometry(1, 0.10, 6, 18);
const cache = new Map<string, THREE.MeshStandardMaterial>();

const C = {
  linen: 0xf8eddf, cream: 0xfff8ed, oat: 0xe5d7bd,
  moss: 0x879b87, mossDark: 0x657c72, paleSage: 0xb7c6b0,
  wood: 0xb98d66, woodLight: 0xd0ab82, woodDark: 0x755c47,
  terracotta: 0xc69286, blush: 0xe2b8ab, warmWhite: 0xf1e8d9,
  stone: 0xe9e4d9, slate: 0x45565b, graphite: 0x303a3b,
  brass: 0xbca078, glass: 0x9fc0bd, softBlue: 0x7ca2a6,
};

function mat(hex: number, finish: 'fabric' | 'wood' | 'metal' | 'screen' = 'fabric'): THREE.MeshStandardMaterial {
  const key = hex + '/' + finish;
  let value = cache.get(key);
  if (!value) {
    value = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: finish === 'screen' ? 0.28 : finish === 'metal' ? 0.42 : finish === 'wood' ? 0.68 : 0.92,
      metalness: finish === 'metal' ? 0.32 : 0,
    });
    cache.set(key, value);
  }
  return value;
}
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
  const cushion = part(parent, [0.43, 0.37, 0.16], position, color, 'soft', true);
  cushion.rotation.z = angle;
  part(parent, [0.20, 0.025, 0.012], [position[0], position[1] + 0.035, position[2] + 0.086], 0xe6d2be);
}

function makeSofa(): THREE.Group {
  const sofa = group(-3.1, 1.7);
  part(sofa, [2.60, 0.19, 1.02], [0, 0.24, 0], C.woodDark, 'soft', true, 'wood');
  for (const x of [-1.05, 1.05]) for (const z of [-0.36, 0.36]) {
    part(sofa, [0.12, 0.20, 0.12], [x, 0.11, z], C.woodDark, 'soft', false, 'wood');
  }
  part(sofa, [2.54, 0.45, 0.98], [0, 0.49, 0.00], C.moss, 'soft', true);
  part(sofa, [2.54, 0.78, 0.28], [0, 0.84, 0.46], C.mossDark, 'soft', true);
  for (const x of [-1.17, 1.17]) {
    part(sofa, [0.28, 0.58, 1.09], [x, 0.68, 0], C.mossDark, 'soft', true);
    part(sofa, [0.23, 0.085, 0.72], [x, 0.998, -0.06], C.paleSage);
  }
  for (const x of [-0.76, 0, 0.76]) {
    part(sofa, [0.73, 0.20, 0.73], [x, 0.75, -0.14], C.paleSage, 'soft', true);
    const back = part(sofa, [0.70, 0.51, 0.19], [x, 0.97, 0.24], C.moss, 'soft', true);
    back.rotation.x = -0.11;
    part(sofa, [0.012, 0.10, 0.42], [x + 0.345, 0.75, -0.15], C.moss);
  }
  pillow(sofa, [-0.90, 0.99, -0.14], C.linen, -0.16);
  pillow(sofa, [0.90, 1.01, -0.15], C.terracotta, 0.13);
  // Draped throw; soft-edged separate folds and tassels.
  const throwBlanket = part(sofa, [0.54, 0.042, 0.83], [-0.47, 0.865, -0.14], C.blush);
  throwBlanket.rotation.z = -0.03;
  for (const z of [-0.43, -0.29, -0.15, -0.01]) {
    part(sofa, [0.52, 0.014, 0.013], [-0.47, 0.896, z], C.linen);
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
  for (const x of [-0.79, 0, 0.79]) {
    part(bed, [0.72, 0.72, 0.055], [x, 0.85, -1.184], C.oat, 'soft');
    part(bed, [0.57, 0.07, 0.022], [x, 1.10, -1.15], C.linen);
  }
  part(bed, [2.54, 0.34, 2.48], [0, 0.62, 0.04], C.warmWhite, 'soft', true);
  // Preserve sleeping character height: duvet stays around y=0.84.
  part(bed, [2.43, 0.14, 1.55], [0, 0.842, 0.46], C.terracotta, 'soft', true);
  part(bed, [2.45, 0.045, 0.24], [0, 0.925, -0.28], C.linen);
  part(bed, [2.43, 0.027, 0.10], [0, 0.923, 1.13], C.oat);
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
  part(kitchen, [4.23, 0.87, 0.83], [0, 0.47, 0], C.paleSage, 'square', true);
  part(kitchen, [4.39, 0.12, 0.96], [0, 0.966, 0], C.stone, 'soft', true);
  part(kitchen, [4.19, 0.065, 0.083], [0, 0.115, 0.41], C.woodDark, 'square', false, 'wood');
  // Inset cabinet fronts and a dedicated oven.
  for (const x of [-1.56, -0.70, 0.78, 1.56]) {
    part(kitchen, [0.72, 0.68, 0.036], [x, 0.51, 0.431], C.linen, 'soft', false, 'wood');
    part(kitchen, [0.48, 0.45, 0.015], [x, 0.51, 0.453], C.paleSage);
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
  round(kitchen, 0.235, 0.085, [-0.87, 1.14, -0.25], C.slate, 'metal');
  part(kitchen, [0.33, 0.053, 0.068], [-1.16, 1.16, -0.08], C.woodDark, 'soft', false, 'wood');
  round(kitchen, 0.17, 0.018, [-0.87, 1.195, -0.25], C.oat);
  part(kitchen, [3.99, 0.56, 0.07], [0, 1.43, -0.43], 0xe8e2d7, 'square');
  part(kitchen, [1.18, 0.22, 0.53], [-0.57, 1.79, -0.31], C.paleSage, 'soft');
  part(kitchen, [1.06, 0.06, 0.10], [-0.57, 1.62, -0.08], C.brass, 'soft', false, 'metal');

  // Sink, tap, dish rack and open display shelves.
  part(kitchen, [0.91, 0.023, 0.56], [1.28, 1.039, -0.05], C.glass, 'soft', false, 'metal');
  part(kitchen, [0.68, 0.014, 0.36], [1.28, 1.054, -0.05], C.slate, 'soft', false, 'metal');
  round(kitchen, 0.043, 0.32, [1.55, 1.23, -0.29], C.brass, 'metal');
  const tap = ring(kitchen, 0.16, [1.40, 1.38, -0.29], C.brass);
  tap.rotation.z = Math.PI / 2;
  part(kitchen, [0.03, 0.16, 0.032], [1.25, 1.31, -0.29], C.brass, 'soft', false, 'metal');
  for (const x of [0.45, 1.26, 1.86]) {
    part(kitchen, [0.70, 0.35, 0.30], [x, 1.79, -0.28], C.linen, 'soft', false, 'wood');
    part(kitchen, [0.26, 0.025, 0.021], [x, 1.70, -0.105], C.brass, 'soft', false, 'metal');
  }
  part(kitchen, [1.24, 0.07, 0.39], [-1.49, 1.57, -0.30], C.woodLight, 'soft', false, 'wood');
  for (const x of [-1.82, -1.55, -1.25]) {
    round(kitchen, 0.095, 0.20, [x, 1.71, -0.27], x < -1.5 ? C.oat : C.glass);
    round(kitchen, 0.105, 0.025, [x, 1.83, -0.27], C.woodDark);
  }
  return kitchen;
}

function makeDesk(): THREE.Group {
  const desk = group(3.2, 1.46);
  part(desk, [2.25, 0.12, 0.98], [0, 0.966, 0], C.woodLight, 'soft', true, 'wood');
  part(desk, [2.14, 0.028, 0.88], [0, 1.038, -0.01], C.wood, 'soft', false, 'wood');
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
  part(desk, [0.70, 0.035, 0.18], [0, 1.08, 0.20], C.linen, 'soft');
  for (let i = 0; i < 8; i++) {
    part(desk, [0.055, 0.008, 0.055], [-0.28 + i * 0.08, 1.103, 0.20], C.slate, 'soft');
  }
  oval(desk, [0.063, 0.035, 0.09], [0.55, 1.10, 0.27], C.cream);
  // Ergonomic upholstered chair, similar position to the original interaction pose.
  part(desk, [0.61, 0.14, 0.58], [0, 0.48, 1.06], C.terracotta, 'soft', true);
  const back = part(desk, [0.63, 0.74, 0.15], [0, 0.84, 1.35], C.terracotta, 'soft', true);
  back.rotation.x = -0.10;
  part(desk, [0.47, 0.45, 0.055], [0, 0.84, 1.255], C.blush);
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
  part(tv, [1.69, 0.91, 0.013], [0, 1.25, 0.011], 0x688e92, 'square', false, 'screen');
  // Still-image landscape avoids a flat black rectangle without a video texture.
  part(tv, [1.60, 0.25, 0.014], [0, 0.95, 0.024], C.mossDark, 'square', false, 'screen');
  oval(tv, [0.16, 0.16, 0.008], [0.43, 1.46, 0.029], 0xf1d7a8);
  const hill = oval(tv, [0.78, 0.24, 0.014], [-0.45, 1.11, 0.033], C.paleSage);
  hill.rotation.z = -0.16;
  oval(tv, [0.72, 0.20, 0.014], [0.55, 1.07, 0.035], C.moss);
  part(tv, [0.28, 0.028, 0.025], [0, 0.68, 0.05], C.slate, 'soft', false, 'metal');
  return tv;
}

function makeCoffeeTable(): THREE.Group {
  const table = group(-1.88, 0.03);
  round(table, 0.68, 0.10, [0, 0.49, 0], C.woodLight);
  round(table, 0.61, 0.027, [0, 0.557, 0], C.wood);
  round(table, 0.11, 0.39, [0, 0.24, 0], C.woodDark);
  round(table, 0.42, 0.065, [0, 0.065, 0], C.woodDark);
  round(table, 0.30, 0.018, [0.10, 0.588, -0.13], C.oat);
  round(table, 0.11, 0.14, [-0.20, 0.655, 0.13], C.linen);
  ring(table, 0.073, [-0.05, 0.66, 0.13], C.brass);
  part(table, [0.29, 0.022, 0.19], [0.19, 0.614, 0.23], C.terracotta);
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
  // Irregular overlapping low-profile rugs read as textile and never block walking.
  const rugs: Array<{ x: number; z: number; sx: number; sz: number; color: number }> = [
    { x: -2.45, z: 1.32, sx: 2.40, sz: 1.88, color: 0xe5d9c5 },
    { x: -2.44, z: 1.26, sx: 2.02, sz: 1.55, color: 0xf1e9db },
    { x: 2.83, z: 1.25, sx: 1.43, sz: 1.78, color: 0xdcd6c8 },
    { x: 2.85, z: 1.26, sx: 1.23, sz: 1.56, color: 0xece5d9 },
  ];
  for (const rug of rugs) {
    const disc = new THREE.Mesh(drum, mat(rug.color));
    disc.scale.set(rug.sx, 0.024, rug.sz);
    disc.position.set(rug.x, 0.030, rug.z);
    disc.receiveShadow = true;
    scene.add(disc);
  }
}
