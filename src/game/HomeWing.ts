import * as THREE from 'three';
import { HOUSE_WING, HOUSE } from '../shared/home';
import { batchRigidParts, colors as C, cube, finish } from './ArtKit';

// A future-ready three-room wing. The established rooms, props, action anchors,
// and old wall coordinates are deliberately left alone.
export function buildHomeWing(scene: THREE.Scene): void {
  const wing = new THREE.Group();
  const add = (w: number, h: number, d: number, x: number, y: number, z: number,
    color: number, material: Parameters<typeof finish>[1] = 'wood') => {
    const part = new THREE.Mesh(cube, finish(color, material));
    part.scale.set(w, h, d);
    part.position.set(x, y, z);
    part.receiveShadow = true;
    wing.add(part);
  };
  const { minX, maxX, minZ, maxZ } = HOUSE_WING;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const width = maxX - minX;
  const depth = maxZ - minZ;

  // Continuation of the home's foundation and a flush, navigable wooden floor.
  add(width + .32, .39, depth + .31, centerX, -.42, centerZ, 0xa5725a, 'ceramic');
  add(width + .10, .15, depth + .08, centerX, -.16, centerZ, 0x815841);
  for (const [i, [z0, z1]] of [
    [minZ, HOUSE_WING.crossWalls[0]],
    [HOUSE_WING.crossWalls[0], HOUSE_WING.crossWalls[1]],
    [HOUSE_WING.crossWalls[1], maxZ],
  ].entries()) {
    const z = (z0 + z1) / 2;
    add(width - .25, .065, z1 - z0 - .14, centerX, -.013, z,
      [0xc39f78, 0xd7b68e, 0xbfa083][i]);
    // Restrained parquet strips give the empty rooms scale without clutter.
    for (let x = minX + .45; x < maxX - .18; x += .62) {
      add(.018, .008, z1 - z0 - .17, x, .024, z, 0x886c53);
    }
    // A low door-side marker reserved for a future room label or furniture edit.
    add(.68, .025, .085, maxX - .58, .033, z0 + .46, C.oat);
  }
  // Rear exterior behind the new rooms, with a tall window and a light sill.
  add(width, 2.84, .19, centerX, 1.42, minZ, C.limestone, 'ceramic');
  for (const x of [11.28, 13.72]) {
    add(1.36, 1.13, .024, x, 1.85, minZ + .11, 0x8cabb0, 'ceramic');
    add(1.48, .065, .20, x, 1.20, minZ + .23, C.oat);
    add(.042, 1.14, .065, x, 1.85, minZ + .15, C.paper);
  }
  // Exterior posts hint at future windows but don't enclose the cutaway camera.
  for (const z of [-6.75, -3.05, .50, 4.18]) {
    add(.24, .95, .21, maxX, .47, z, C.limestone, 'ceramic');
    add(.31, .058, .27, maxX, .97, z, C.walnut);
  }
  // Three open passageways are readable as doorframes from the overhead view.
  for (const z of HOUSE_WING.crossWalls) {
    const left = HOUSE_WING.crossDoor.x - HOUSE_WING.crossDoor.width / 2;
    const right = HOUSE_WING.crossDoor.x + HOUSE_WING.crossDoor.width / 2;
    for (const x of [left, right]) add(.10, 1.11, .15, x, .555, z, C.paper);
    add(HOUSE_WING.crossDoor.width, .065, .16, HOUSE_WING.crossDoor.x, 1.12, z, C.walnut);
  }
  const { z, width: doorWidth } = HOUSE_WING.connector;
  for (const side of [-1, 1]) {
    add(.12, 1.13, .15, HOUSE.maxX, .565, z + side * doorWidth / 2, C.paper);
  }
  add(.21, .06, doorWidth, HOUSE.maxX, .025, z, C.oat);
  batchRigidParts(wing, true);
  scene.add(wing);
}
