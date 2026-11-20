import * as THREE from 'three';
import { HOUSE_ENTRY, HOME_YARD } from '../shared/home';
import { batchRigidParts, colors as C, cube, drum, finish, orb, paintedMap, panel, softCube, type XYZ } from './ArtKit';

const edging = 0xb29e83;
const flagstone = 0xc8b59b;
const lawn = 0x87995b;

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
  return paintedMap('home-yard-turf', 320, 192, ctx => {
    ctx.fillStyle = '#8a9c62';
    ctx.fillRect(0, 0, 320, 192);
    let seed = 5371;
    const scatter = (range: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32 * range;
    };
    for (let i = 0; i < 3900; i++) {
      const x = scatter(320);
      const y = scatter(192);
      ctx.fillStyle = i % 3 ? '#51683928' : '#e1d29255';
      ctx.fillRect(x, y, 1, 1 + i % 3);
    }
  });
}

function paving() {
  return paintedMap('home-yard-paving', 256, 384, ctx => {
    ctx.fillStyle = '#a4967e';
    ctx.fillRect(0, 0, 256, 384);
    const shades = ['#cabb9c', '#d2c0a4', '#c5b29b', '#bdab92', '#ccbea8'];
    for (let row = 0; row < 12; row++) for (let col = -1; col < 5; col++) {
      ctx.fillStyle = shades[((col + 1) * 3 + row * 7) % shades.length];
      ctx.fillRect(col * 64 + (row % 2) * 32 + 1, row * 32 + 1, 62, 30);
    }
  });
}

function flat(parent: THREE.Group, x: number, y: number, z: number, width: number, depth: number,
  map: THREE.Texture | null, color: number) {
  panel(parent, [x, y, z], [width, depth], map, color).rotation.x = -Math.PI / 2;
}

function grillAndTable(yard: THREE.Group): void {
  const grill = new THREE.Group();
  grill.position.set(HOME_YARD.grill.x, 0, HOME_YARD.grill.z);
  for (const x of [-.39, .39]) for (const z of [-.24, .24]) {
    shape(grill, [.063, .68, .063], [x, .35, z], C.ink, cube);
  }
  shape(grill, [.89, .11, .50], [0, .22, 0], C.ink, softCube);
  shape(grill, [1.12, .27, .70], [0, .72, 0], 0x39474a, softCube, true, 'metal');
  shape(grill, [.52, .25, .31], [0, .91, -.042], C.ink, orb, true, 'metal');
  shape(grill, [.37, .05, .076], [0, .96, .32], C.oak, softCube, false, 'wood');
  for (const x of [-.22, 0, .22]) {
    shape(grill, [.049, .043, .049], [x, .67, .368], C.oat, drum).rotation.x = Math.PI / 2;
  }
  shape(grill, [.113, .015, .113], [.34, 1.04, .06], C.limestone, drum);
  batchRigidParts(grill, true);
  yard.add(grill);

  const { x, z } = HOME_YARD.sideTable;
  shape(yard, [.91, .073, .65], [x, .70, z], C.oak, softCube, true, 'wood');
  for (const dx of [-.34, .34]) for (const dz of [-.23, .23]) {
    shape(yard, [.06, .66, .065], [x + dx, .34, z + dz], C.walnut, cube, false, 'wood');
  }
  shape(yard, [.172, .034, .172], [x - .12, .756, z], C.paper, drum, false, 'ceramic');
  shape(yard, [.085, .16, .085], [x + .24, .81, z - .16], C.clay, drum, false, 'ceramic');
}

function fence(yard: THREE.Group): void {
  const { gate, parking } = HOME_YARD;
  const left = gate.x - gate.width / 2;
  const right = gate.x + gate.width / 2;
  const drivewayEdge = parking.x - 1.38;
  for (const [start, end] of [[-6, left], [right, drivewayEdge], [drivewayEdge, 6]]) {
    const center = (start + end) / 2;
    const width = end - start - .04;
    shape(yard, [width, .21, .23], [center, .105, gate.z], edging, cube);
    shape(yard, [width, .30, .09], [center, .365, gate.z], C.oak, cube, false, 'wood');
    shape(yard, [width, .065, .13], [center, .54, gate.z], C.oat, softCube, false, 'wood');
  }
  for (const x of [-6, left, right, drivewayEdge, 6]) {
    shape(yard, [.18, .65, .22], [x, .33, gate.z], C.walnut, softCube, false, 'wood');
    shape(yard, [.23, .07, .26], [x, .66, gate.z], C.oat, softCube);
  }
  shape(yard, [1.30, .025, .43], [gate.x, .016, gate.z - .14], C.oat);
  for (const x of [-5.98, 5.98]) {
    shape(yard, [.28, .22, 6.81], [x, .095, 8.62], edging, cube);
    shape(yard, [.115, .37, 6.70], [x, .38, 8.62], C.oak, cube, false, 'wood');
    for (const z of [5.42, 7.55, 9.73]) {
      shape(yard, [.19, .64, .20], [x, .32, z], C.walnut, softCube, false, 'wood');
    }
  }
}

function garden(yard: THREE.Group): void {
  const { x, z: center } = HOME_YARD.planter;
  shape(yard, [.58, .22, 3.8], [x, .115, center], C.walnut, softCube, false, 'wood');
  for (const [i, z] of [-1.64, -1.09, -.46, .19, .79, 1.39].map(offset => center + offset).entries()) {
    shape(yard, [.33, .37, .38], [x + .03, .31, z], i % 2 ? C.pine : 0x6e8158, orb);
    shape(yard, [.24, .29, .26], [x - .12, .43, z + .18], C.leaf, orb);
    if (i % 2) {
      shape(yard, [.13, .11, .115], [x + .17, .58, z - .07], 0xe7bd86, orb);
      shape(yard, [.085, .079, .098], [x - .05, .68, z + .14], C.paper, orb);
    }
  }
}

export function buildYard(scene: THREE.Scene): void {
  const yard = new THREE.Group();
  shape(yard, [12.52, .50, 6.66], [0, -.36, 8.91], 0x94775e, cube);
  shape(yard, [12.25, .11, 6.92], [0, -.071, 8.70], 0x69764f, softCube);
  flat(yard, 0, -.015, 8.73, 12.18, 6.80, turf(), lawn);

  const { x } = HOUSE_ENTRY;
  const { parking } = HOME_YARD;
  const stones = paving();
  flat(yard, x, .006, 8.58, 1.88, 6.83, stones, flagstone);
  flat(yard, -3.98, .004, 6.56, 3.40, 2.24, stones, flagstone);
  for (const dx of [-2.37, -1.92, -1.47]) {
    shape(yard, [.40, .045, .58], [x + dx, -.005, 7.16], flagstone, softCube);
  }
  flat(yard, parking.x, .004, parking.z, 2.84, 5.98, stones, flagstone);
  flat(yard, 1.96, .005, 11.27, 1.12, 1.17, stones, flagstone);
  for (const dx of [-1.23, 1.23]) {
    shape(yard, [.055, .012, 4.69], [parking.x + dx, .01, parking.z + .08], C.paper, cube);
  }
  shape(yard, [2.50, .012, .055], [parking.x, .01, 6.61], C.paper, cube);
  shape(yard, [1.59, .105, .14], [parking.x, .054, parking.z - 2.52], 0x8a7e6d, softCube);

  grillAndTable(yard);
  garden(yard);
  fence(yard);
  batchRigidParts(yard, true);
  scene.add(yard);
}
