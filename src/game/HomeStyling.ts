import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PETS, PET_IDS } from '../shared/pets';
import { batchRigidParts, colors as C, cube, drum, finish, orb, paintedMap, panel, plane, softCube, torus, type XYZ } from './ArtKit';
import { botanicalPrint, gardenView, oakFloor } from './ArtTextures';
import type { FloorRect } from './navigation';

export const decorObstacles: readonly FloorRect[] = [
  { minX: 4.70, maxX: 5.35, minZ: -0.26, maxZ: 0.38 },
  { minX: 4.47, maxX: 5.62, minZ: 2.77, maxZ: 4.05 },
];

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
  const wallFront = -4.87;
  const left = -3.36;
  const right = 0.06;
  const bottom = 1.25;
  const top = 2.81;
  const height = 3.29;
  // The opening has real plaster returns, a deep sill and layered glazing.
  for (const [x1, x2, y1, y2] of [
    [-6.12, left, 0, height], [right, 6.12, 0, height],
    [left, right, 0, bottom], [left, right, top, height],
  ]) {
    shape(home, cube, [x2 - x1, y2 - y1, 0.25], [(x1 + x2) / 2, (y1 + y2) / 2, -5],
      C.limestone);
  }
  panel(home, [-1.65, 2.03, -5.17], [3.48, 1.64], gardenView(), C.sky, 0.33);
  for (const x of [left, right, -2.22, -1.08]) {
    shape(home, softCube, [0.088, 1.66, 0.17], [x, 2.03, -4.93], C.paper, 'wood');
  }
  for (const [y, width] of [[bottom, 3.58], [2.20, 3.43], [top, 3.54]]) {
    shape(home, softCube, [width, 0.09, y === bottom ? 0.43 : 0.17],
      [-1.65, y, -4.87], C.paper, 'wood');
  }
  const rod = shape(home, drum, [0.036, 3.84, 0.036], [-1.65, 2.97, wallFront + 0.15], C.brass, 'metal');
  rod.rotation.z = Math.PI / 2;

  // Pleats taper into the tieback so the curtains read as fabric from above.
  for (const side of [-1, 1]) {
    const x = -1.65 + side * 1.68;
    const vertices: number[] = [];
    const indices: number[] = [];
    const levels = [[3.0, 0.27, 0], [2.63, 0.28, 0.023], [1.88, 0.16, 0.095], [1.31, 0.25, 0.085]];
    for (const [y, width, inset] of levels) for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      vertices.push(x + side * inset + (t * 2 - 1) * width,
        y + (y < 1.4 ? Math.sin(t * Math.PI) * 0.10 : 0),
        -4.65 + Math.cos(t * Math.PI * 8) * 0.052);
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
    shape(home, softCube, [0.31, 0.065, 0.12], [x + side * 0.095, 1.88, -4.60], C.rust);
  }
}

function leftWall(home: THREE.Group): void {
  shape(home, cube, [0.24, 3.29, 10.12], [-6, 1.645, 0], 0xc5c1a1);
  shape(home, cube, [0.07, 0.91, 9.94], [-5.85, 0.455, 0], C.sage);
  shape(home, softCube, [0.11, 0.072, 9.94], [-5.81, 0.92, 0], C.pine, 'wood');
  for (const z of [-4.55, -3.65, -2.75, -1.85, 0.01, 0.91, 1.81, 2.71, 3.61, 4.51]) {
    shape(home, cube, [0.024, 0.74, 0.036], [-5.805, 0.49, z], 0xb0b39a);
  }
  const door = new THREE.Group();
  door.rotation.y = Math.PI / 2;
  door.position.set(-5.83, 0, -0.92);
  shape(door, softCube, [1.65, 2.65, 0.16], [0, 1.325, 0], C.walnut, 'wood');
  shape(door, softCube, [1.46, 2.51, 0.12], [0, 1.285, 0.08], C.pine, 'wood');
  for (const [y, height] of [[0.60, 0.86], [1.75, 1.13]]) {
    shape(door, softCube, [1.10, height, 0.045], [0, y, 0.15], C.leaf, 'wood');
    shape(door, softCube, [0.93, height - 0.15, 0.026], [0, y, 0.177], C.pine, 'wood');
  }
  shape(door, orb, [0.06, 0.057, 0.05], [0.51, 1.17, 0.19], C.brass, 'metal');
  batchRigidParts(door);
  home.add(door);
}

function leafPlant(home: THREE.Group): void {
  shape(home, drum, [0.32, 0.49, 0.32], [5.1, 0.26, 3.4], C.clay, 'ceramic', true);
  shape(home, drum, [0.35, 0.10, 0.35], [5.1, 0.52, 3.4], C.coral, 'ceramic');
  shape(home, drum, [0.30, 0.023, 0.30], [5.1, 0.58, 3.4], C.darkWood);
  for (let i = 0; i < 9; i++) {
    const angle = i * 2.4;
    const radius = i % 2 ? 0.24 : 0.16;
    const leaf = shape(home, orb, [0.12, 0.34, 0.056],
      [5.1 + Math.cos(angle) * radius, 0.81 + i % 3 * 0.12, 3.4 + Math.sin(angle) * radius],
      i % 2 ? C.leaf : C.pine, 'ceramic', i === 2);
    leaf.rotation.set(0, -angle, 0.67);
  }
}

function practicalLights(home: THREE.Group): void {
  const x = 5.02;
  const z = 0.06;
  shape(home, drum, [0.25, 0.075, 0.25], [x, 0.045, z], C.walnut, 'wood');
  shape(home, drum, [0.031, 1.58, 0.031], [x, 0.82, z], C.brass, 'metal');
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.31, 0.35, 20, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xe7ad69, emissive: 0xffa452, emissiveIntensity: 0.35, roughness: 0.93,
      side: THREE.DoubleSide,
    }));
  shade.position.set(x, 1.66, z);
  home.add(shade);
  shape(home, orb, [0.087, 0.088, 0.087], [x, 1.53, z], C.paper, 'ceramic');
  const warm = new THREE.PointLight(0xffbb7c, 3.3, 4, 2);
  warm.position.set(x - 0.10, 1.48, z);
  home.add(warm);
}

function petNooks(home: THREE.Group): void {
  for (const id of PET_IDS) {
    const { x, z } = PETS[id].home;
    const dog = id === 'verdell';
    shape(home, softCube, [0.93, 0.058, 0.75], [x, 0.034, z], dog ? C.pine : C.rust);
    shape(home, softCube, [0.78, 0.038, 0.60], [x, 0.073, z], dog ? C.sage : C.oat);
    shape(home, drum, [0.18, 0.086, 0.18], [x + 0.59, 0.051, z + 0.18],
      dog ? C.leaf : C.clay, 'ceramic');
    const rim = shape(home, torus, [0.165, 0.165, 0.165],
      [x + 0.59, 0.104, z + 0.18], C.paper, 'ceramic');
    rim.rotation.x = -Math.PI / 2;
    shape(home, orb, [0.097, 0.09, 0.096], [x - 0.56, 0.1, z + 0.19],
      dog ? C.coral : C.leaf);
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
  shadow.position.set(-0.14, -0.634, -0.32);
  shadow.scale.set(18.5, 15, 1);
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
}

export function decorateHome(scene: THREE.Scene): void {
  const home = new THREE.Group();
  const stage = shape(scene, cube, [90, 0.06, 90], [0, -0.67, 0], 0xa5b8a5);
  stage.receiveShadow = true;
  platformShadow(scene);
  // World-unit bevels keep the square floor deck supported right to its corners.
  for (const [width, height, depth, y, color, surface] of [
    [12.52, 0.42, 10.48, -0.42, C.rust, 'ceramic'],
    [12.36, 0.20, 10.32, -0.17, C.walnut, 'wood'],
    [12.19, 0.09, 10.16, -0.048, C.oak, 'wood'],
  ] as const) {
    const edge = new RoundedBoxGeometry(width, height, depth, 1, height * 0.42);
    shape(home, edge, [1, 1, 1], [0, y, 0], color, surface, y < -0.1);
  }
  const floor = panel(home, [0, 0, 0], [12, 10], oakFloor(), C.oak);
  floor.rotation.x = -Math.PI / 2;
  shape(home, softCube, [2.04, 0.16, 0.42], [0.7, -0.46, 5.30], C.clay, 'ceramic', true);
  shape(home, softCube, [1.92, 0.10, 0.33], [0.7, -0.30, 5.27], C.oat, 'wood', true);
  shape(home, softCube, [1.60, 0.025, 0.62], [0.7, 0.015, 4.58], C.leaf);
  rearWall(home);
  leftWall(home);
  shape(home, softCube, [12.30, 0.13, 0.34], [0, 3.33, -5], C.paper, 'wood');
  shape(home, softCube, [0.34, 0.13, 10.15], [-6, 3.33, 0], C.paper, 'wood');
  shape(home, softCube, [11.84, 0.13, 0.08], [0.06, 0.085, -4.83], C.walnut, 'wood');
  shape(home, softCube, [0.09, 0.13, 9.94], [-5.82, 0.085, 0], C.walnut, 'wood');

  shape(home, softCube, [0.93, 1.21, 0.09], [-4.65, 2.22, -4.83], C.walnut, 'wood');
  panel(home, [-4.65, 2.22, -4.776], [0.80, 1.06], botanicalPrint(), C.paper);
  shape(home, softCube, [0.26, 0.075, 1.68], [-5.71, 1.63, 1.96], C.walnut, 'wood');
  for (let i = 0; i < 6; i++) {
    const height = 0.23 + i % 3 * 0.055;
    shape(home, softCube, [0.17, height, 0.12], [-5.67, 1.66 + height / 2, 1.40 + i * 0.14],
      [C.clay, C.sage, C.oat, C.ink][i % 4]);
  }
  shape(home, softCube, [0.67, 0.09, 0.62], [-0.84, 0.48, 0.05], C.sage);
  for (const dx of [-0.24, 0.24]) for (const dz of [-0.22, 0.22]) {
    shape(home, softCube, [0.071, 0.43, 0.071], [-0.84 + dx, 0.235, 0.05 + dz], C.walnut, 'wood');
  }
  leafPlant(home);
  practicalLights(home);
  petNooks(home);
  batchRigidParts(home);
  scene.add(home);
}
