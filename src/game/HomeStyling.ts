import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PETS, PET_IDS } from '../shared/pets';
import { batchRigidParts, colors as C, cube, drum, finish, orb, paintedMap, panel, plane, softCube, torus, type XYZ } from './ArtKit';
import { HOUSE_ENTRY, HOME_PLACEMENTS } from '../shared/home';
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
  panel(home, [-1.65, 2.03, -5.17], [3.48, 1.64], gardenView(), C.sky, 0.20);
  // The sash sits in shadow behind the casing. The sill projects into the room.
  for (const x of [left, right]) {
    shape(home, softCube, [0.13, 1.70, 0.23], [x, 2.03, -4.89], C.paper, 'wood');
    shape(home, cube, [0.051, 1.57, 0.068], [x, 2.03, -5.05], C.walnut, 'wood');
  }
  shape(home, softCube, [0.093, 1.57, 0.092], [-1.65, 2.03, -5.055], C.paper, 'wood');
  shape(home, softCube, [3.42, 0.074, 0.084], [-1.65, 2.19, -5.064], C.paper, 'wood');
  shape(home, softCube, [3.61, 0.105, 0.40], [-1.65, bottom, -4.89], C.oat, 'wood');
  shape(home, softCube, [3.54, 0.092, 0.23], [-1.65, top, -4.89], C.paper, 'wood');
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
  shape(home, cube, [0.24, 3.29, 10.12], [-6, 1.645, 0], 0xd7c9ae);
  shape(home, cube, [0.07, 0.91, 9.94], [-5.85, 0.455, 0], C.sage);
  shape(home, softCube, [0.11, 0.072, 9.94], [-5.81, 0.92, 0], C.pine, 'wood');
  for (const [first, last] of [[-4.91, -1.84], [0.0, 4.88]]) {
    for (let z = first + 0.49; z < last - 0.40; z += 0.79) {
      shape(home, cube, [0.017, 0.71, 0.045], [-5.808, 0.50, z], 0x829278, 'wood');
    }
  }
  const door = new THREE.Group();
  door.rotation.y = Math.PI / 2;
  door.position.set(-5.83, 0, -0.92);
  shape(door, cube, [1.51, 2.51, 0.141], [0, 1.255, 0.025], C.walnut, 'wood');
  shape(door, softCube, [1.38, 2.45, 0.092], [0, 1.246, 0.069], C.pine, 'wood');
  for (const x of [-0.76, 0.76]) {
    shape(door, softCube, [0.14, 2.60, 0.16], [x, 1.3, 0.058], C.paper, 'wood');
    shape(door, cube, [0.058, 2.49, 0.06], [x * 0.93, 1.25, 0.122], C.oat, 'wood');
  }
  shape(door, softCube, [1.66, 0.155, 0.17], [0, 2.54, 0.058], C.paper, 'wood');
  shape(door, softCube, [1.50, 0.055, 0.24], [0, 0.034, 0.07], C.oat, 'wood');
  for (const [y, height] of [[0.56, 0.74], [1.70, 1.12]]) {
    shape(door, softCube, [1.06, height, 0.039], [0, y, 0.105], C.walnut, 'wood');
    shape(door, softCube, [0.99, height - 0.07, 0.038], [0, y, 0.127], C.leaf, 'wood');
  }
  shape(door, softCube, [0.075, 0.13, 0.036], [0.51, 1.13, 0.129], C.brass, 'metal');
  shape(door, softCube, [0.14, 0.038, 0.063], [0.47, 1.16, 0.158], C.brass, 'metal');
  batchRigidParts(door);
  home.add(door);
}

function practicalLights(home: THREE.Group): void {
  const { x, z } = HOME_PLACEMENTS.lamp;
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
  const bowls = PET_IDS.map(id => PETS[id].bowl);
  shape(home, softCube, [1.34, .026, .55], [(bowls[0].x + bowls[1].x) / 2, .016, bowls[0].z], C.sage);
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
  shadow.position.set(-0.14, -0.634, 3.03);
  shadow.scale.set(18.5, 23, 1);
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
    [12.52, 0.40, 10.88, -0.42, 0xa5725a, 'ceramic'],
    [12.36, 0.20, 10.72, -0.17, 0x815841, 'wood'],
    [12.19, 0.09, 10.56, -0.048, C.oat, 'wood'],
  ] as const) {
    const edge = new RoundedBoxGeometry(width, height, depth, 1, height * 0.42);
    shape(home, edge, [1, 1, 1], [0, y, .20], color, surface, y < -0.1);
  }
  const floor = panel(home, [0, 0, .20], [12, 10.40], oakFloor(), C.oak);
  floor.rotation.x = -Math.PI / 2;
  const { x, z, width } = HOUSE_ENTRY;
  for (const [start, end] of [[-6, x - width / 2], [x + width / 2, 6]]) {
    shape(home, softCube, [end - start, .20, .24], [(start + end) / 2, .102, z], C.walnut, 'wood');
  }
  shape(home, softCube, [width, .026, .30], [x, .016, z], C.oat, 'wood');
  shape(home, softCube, [1.54, .023, .54], [x, .015, z - .51], C.leaf);
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
  practicalLights(home);
  petNooks(home);
  batchRigidParts(home);
  scene.add(home);
}
