import * as THREE from 'three';
import { HOUSE, HOUSE_WING } from '../shared/home';
import { NEIGHBOR_PATH } from '../shared/neighbors';
import { batchRigidParts, cube, drum, finish, orb, paintedMap, plane, softCube } from './ArtKit';

/** Four spaced-out *background* properties, never gameplay destinations.
 * North/south here refer to the garden's visible front/rear, not map coordinates.
 * The side cottages face the footpaths rather than forming one rear-facing row. */
export const NEIGHBOR_HOMES = [
  { id: 'west-garden', side: 'west', x: -30.5, z: 7.8, yaw: Math.PI / 2,
    width: 6.0, depth: 4.2, plaster: 0xe3d4b8, roof: 0x856651, trim: 0xf4e6cd, shutters: 0x71866b },
  { id: 'west-orchard', side: 'west', x: -30.8, z: -15.7, yaw: Math.PI / 2,
    width: 6.9, depth: 4.6, plaster: 0xc5cba9, roof: 0x765c51, trim: 0xf1e5ca, shutters: 0xa7785a },
  { id: 'rear-cottage', side: 'rear', x: 3.8, z: -27.5, yaw: 0,
    width: 7.4, depth: 4.8, plaster: 0xe7c9ae, roof: 0x8d5e4c, trim: 0xffecd2, shutters: 0x668479 },
  { id: 'east-cottage', side: 'east', x: 35.1, z: -1.4, yaw: -Math.PI / 2,
    width: 7.0, depth: 4.6, plaster: 0xd1c6ae, roof: 0x657066, trim: 0xf5e8cf, shutters: 0xa47659 },
] as const;

type Root = THREE.Group;
type Surface = Parameters<typeof finish>[1];

function part(parent: Root, geometry: THREE.BufferGeometry, size: readonly [number, number, number],
  at: readonly [number, number, number], color: number, surface: Surface = 'wood'): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, finish(color, surface));
  mesh.scale.set(...size);
  mesh.position.set(...at);
  mesh.receiveShadow = true;
  // All houses and vegetation are deliberately unshadowed background art.
  parent.add(mesh);
  return mesh;
}

function pavingTexture(): THREE.Texture | null {
  return paintedMap('neighborhood-country-stone-018', 256, 256, ctx => {
    ctx.fillStyle = '#a99981';
    ctx.fillRect(0, 0, 256, 256);
    const shades = ['#cdbb9d', '#d9c7ab', '#c4b398', '#e1ccb0', '#bfb19b', '#d0bba3'];
    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < 5; col++) {
        const x = col * 65 + (row % 2 ? 32 : 0);
        const y = row * 32;
        ctx.fillStyle = shades[((row * 3 + col * 5) % shades.length + shades.length) % shades.length];
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, 61, 28, 3);
        ctx.fill();
        ctx.fillStyle = '#f1e0c32a';
        ctx.fillRect(x + 6, y + 4, 47, 1);
      }
    }
  });
}

function turfTexture(): THREE.Texture | null {
  return paintedMap('neighborhood-grass-018', 256, 256, ctx => {
    ctx.fillStyle = '#91a37a';
    ctx.fillRect(0, 0, 256, 256);
    let seed = 40513;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    // Fine, low-contrast variation; one tiny shared texture, no 3D grass blades.
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = i % 4 ? 'rgba(72,97,54,.13)' : 'rgba(240,223,177,.15)';
      ctx.fillRect(rand() * 256, rand() * 256, 1 + rand() * 1.5, 1 + rand() * 2.5);
    }
  });
}

function footpath(root: Root, x: number, z: number, width: number, length: number,
  map: THREE.Texture | null, material: THREE.Material): void {
  // Warm stone with a narrow inset edge: no floating slabs, no new walk obstacles.
  part(root, softCube, [width + .28, .12, length + .28], [x, -.10, z], 0x998e76, 'ceramic');
  part(root, cube, [width + .09, .037, length + .09], [x, -.019, z], 0xb7ab91, 'ceramic');
  const geometry = plane.clone();
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * width / 2.05, uv.getY(i) * length / 2.05);
  }
  const surface = new THREE.Mesh(geometry, material);
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(x, .004, z);
  surface.scale.set(width, length, 1);
  surface.receiveShadow = true;
  root.add(surface);
  // Low borders remain outside the 1.8 m pedestrian corridor.
  for (const offset of [-1, 1]) {
    const alongX = width > length;
    part(root, cube, alongX ? [width - .04, .025, .052] : [.052, .025, length - .04],
      alongX ? [x, .015, z + offset * (length + .12) / 2] : [x + offset * (width + .12) / 2, .015, z],
      0xe2d2b5, 'ceramic');
  }
  if (!map) surface.material = finish(0xcdbd9f, 'ceramic');
}

function planting(root: Root, x: number, z: number, seed: number, large = false): void {
  if (large) {
    part(root, drum, [.16, 1.50, .16], [x, .62, z], 0x806750);
    for (let i = 0; i < 3; i++) {
      part(root, orb, [.70 - i * .09, .61, .64], [x + (i - 1) * .32, 1.51 + i * .22, z + (i % 2 ? .16 : -.13)],
        [0x6c8662, 0x81966a, 0x75916b, 0x9aa476][(seed + i) % 4]);
    }
  } else {
    part(root, orb, [.43, .28, .38], [x, .20, z],
      [0x708b62, 0x809465, 0x96a078, 0x68825e][seed % 4]);
    part(root, orb, [.29, .21, .33], [x + .23, .22, z - .13], seed % 2 ? 0x859b6e : 0x66835d);
  }
}

function flowerbed(root: Root, x: number, z: number, seed: number): void {
  part(root, softCube, [1.35, .11, .53], [x, -.025, z], 0x836b53);
  for (let i = 0; i < 5; i++) {
    const px = x - .51 + i * .255;
    part(root, orb, [.22, .20, .21], [px, .18, z + (i % 2 ? -.09 : .075)], 0x658663);
    part(root, orb, [.075, .065, .075], [px, .37, z + (i % 2 ? -.09 : .075)],
      [0xeab99b, 0xe6cf99, 0xc7a5ac, 0xf1e3c4][(seed + i) % 4]);
  }
}

type Home = typeof NEIGHBOR_HOMES[number];
function cottage(root: Root, home: Home, index: number): void {
  const house = new THREE.Group();
  house.name = 'Фоновый дом · ' + home.id;
  house.position.set(home.x, 0, home.z);
  house.rotation.y = home.yaw;
  const w = home.width, d = home.depth, face = d / 2;
  const eave = 2.64, rise = index % 2 ? .88 : 1.06;
  const roofPitch = Math.atan2(rise, w / 2);
  const slopeLength = Math.hypot(w / 2, rise) + .33;

  // A complete detached home: foundation, varied gabled roof and its front
  // end, not the old rectangular 2D storefronts.
  part(house, softCube, [w + .32, .24, d + .25], [0, -.025, 0], 0xbba991, 'ceramic');
  part(house, cube, [w, eave, d], [0, eave / 2, 0], home.plaster, 'ceramic');
  part(house, cube, [w + .13, .10, d + .13], [0, .12, 0], home.trim, 'ceramic');

  for (const side of [-1, 1]) {
    const roof = part(house, cube, [slopeLength, .17, d + .82],
      [side * w / 4, eave + rise / 2, -.06], home.roof, 'ceramic');
    roof.rotation.z = -side * roofPitch;
    part(house, cube, [.085, .11, d + .79],
      [side * (w / 2 + .19), eave + .005, -.06], home.trim, 'ceramic');
  }
  // The gable closes the visible triangle between the two roof planes.
  for (const front of [-1, 1]) {
    const z = front * (d / 2 + .018);
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position', new THREE.Float32BufferAttribute([
      -w / 2, eave, z, w / 2, eave, z, 0, eave + rise, z,
    ], 3));
    shape.setIndex([0, 1, 2]);
    shape.computeVertexNormals();
    const material = finish(home.plaster, 'ceramic').clone();
    material.side = THREE.DoubleSide;
    const triangle = new THREE.Mesh(shape, material);
    triangle.receiveShadow = true;
    house.add(triangle);
  }

  // Timber door with porch canopy, shallow stair and real divided windows.
  part(house, softCube, [2.46, .14, 1.12], [0, .01, face + .38], 0xaf9e86, 'ceramic');
  part(house, cube, [1.48, .11, .50], [0, -.02, face + 1.05], 0xddd1b9, 'ceramic');
  part(house, cube, [1.10, 1.85, .12], [0, 1.03, face + .068], home.trim, 'wood');
  part(house, softCube, [.91, 1.67, .14], [0, .98, face + .15], index % 2 ? 0x795944 : 0x718075);
  part(house, orb, [.05, .05, .055], [.30, 1.0, face + .24], 0xd0aa6c, 'metal');
  part(house, cube, [2.58, .15, 1.06], [0, 2.19, face + .35], home.roof, 'wood');
  for (const x of [-1.14, 1.14]) {
    part(house, softCube, [.095, 2.12, .105], [x, 1.05, face + .81], home.trim, 'wood');
  }

  for (const x of [-w * .30, w * .30]) {
    part(house, softCube, [1.17, 1.12, .105], [x, 1.59, face + .07], home.trim, 'wood');
    part(house, cube, [.98, .91, .11], [x, 1.59, face + .13], 0xaac3bd, 'ceramic');
    part(house, cube, [.065, .97, .14], [x, 1.59, face + .195], home.trim);
    part(house, cube, [1.04, .061, .14], [x, 1.59, face + .197], home.trim);
    for (const shift of [-.72, .72]) {
      part(house, cube, [.20, 1.05, .10], [x + shift, 1.59, face + .075], home.shutters, 'wood');
    }
    part(house, softCube, [1.28, .15, .26], [x, 1.03, face + .24], home.trim, 'wood');
    part(house, orb, [.29, .19, .21], [x, 1.13, face + .37], 0x6f8964);
    part(house, orb, [.17, .12, .15], [x + .20, 1.18, face + .40], index % 2 ? 0xd3a4a4 : 0xd3bd8a);
  }

  // A side window and chimney keep the four silhouettes readable from
  // oblique mobile camera angles, especially at the left and right boundaries.
  for (const side of [-1, 1]) {
    part(house, softCube, [.10, .91, 1.12], [side * (w / 2 + .055), 1.67, -.54], home.trim);
    part(house, cube, [.11, .75, .93], [side * (w / 2 + .11), 1.67, -.54], 0xb3c9c1, 'ceramic');
  }
  part(house, cube, [.58, 1.04, .62], [w * .25, eave + .48, -d * .17], 0xa36d59, 'ceramic');
  part(house, softCube, [.73, .14, .76], [w * .25, eave + 1.02, -d * .17], home.trim, 'ceramic');

  // A small front garden with a central open gate and private stepping stones.
  const fenceZ = face + 2.66;
  for (const side of [-1, 1]) {
    for (const y of [.34, .67]) {
      part(house, cube, [w / 2 - .67, .07, .10],
        [side * (w / 4 + .65), y, fenceZ], index % 2 ? 0xbba88d : 0xe0d4bb);
    }
    for (let i = 0; i < 7; i++) {
      const x = side * (1.15 + i * ((w / 2 - .23) / 7));
      part(house, softCube, [.09, .87, .13], [x, .43, fenceZ], index % 2 ? 0xb9aa90 : 0xf1dfc0);
    }
  }
  for (let i = 0; i < 5; i++) {
    const z = face + .86 + i * .37;
    part(house, softCube, [1.02, .065, .33], [((i % 2) - .5) * .045, .02, z],
      [0xc9b69c, 0xd9c7a9, 0xbca98e][i % 3], 'ceramic');
  }
  for (const side of [-1, 1]) {
    flowerbed(house, side * (w / 2 - .74), face + 1.47, index + (side + 1) / 2);
    planting(house, side * (w / 2 + .62), face + 1.94, index + 1);
  }
  if (index === 1 || index === 2) {
    // A modest secondary volume gives the orchard and rear home different
    // silhouettes without introducing heavy unique meshes.
    part(house, cube, [1.85, 1.76, 2.03], [w / 2 + .61, .89, -d * .18], home.plaster, 'ceramic');
    part(house, cube, [2.18, .19, 2.42], [w / 2 + .61, 1.88, -d * .18], home.roof, 'ceramic');
  }
  batchRigidParts(house, true);
  root.add(house);
}

export function buildNeighborhood(scene: THREE.Scene): void {
  const root = new THREE.Group();
  root.name = '0.18 · уютный пригород · четыре разнесённых соседских дома';
  const [west, rearWest, rearEast, east] = NEIGHBOR_PATH;
  const midZ = (west.z + rearWest.z) / 2;
  const depth = west.z - rearWest.z;
  const middleX = (west.x + east.x) / 2;
  const width = 1.80;

  // One continuous, very cheap terrain layer replaces the old patchwork
  // platforms. Its distant edges dissolve in existing atmospheric fog, and
  // the home floor/yard remain visibly higher than the surrounding lawn.
  part(root, cube, [140, .515, 140], [0, -.395, 0], 0x94a780);
  const grassMap = turfTexture();
  if (grassMap) {
    grassMap.wrapS = THREE.RepeatWrapping;
    grassMap.wrapT = THREE.RepeatWrapping;
    const geometry = plane.clone();
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 17.5, uv.getY(i) * 17.5);
    const lawn = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      map: grassMap, roughness: 1, color: 0xffffff,
    }));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(0, -.134, 0);
    lawn.scale.set(140, 140, 1);
    lawn.receiveShadow = true;
    root.add(lawn);
  }

  const stone = pavingTexture();
  if (stone) {
    stone.wrapS = THREE.RepeatWrapping;
    stone.wrapT = THREE.RepeatWrapping;
  }
  const pavingMaterial = new THREE.MeshStandardMaterial({
    map: stone, color: stone ? 0xffffff : 0xcab99d, roughness: .96,
  });
  footpath(root, west.x, midZ, width, depth + width, stone, pavingMaterial);
  footpath(root, east.x, midZ, width, depth + width, stone, pavingMaterial);
  footpath(root, middleX, rearWest.z, east.x - west.x + width, width, stone, pavingMaterial);

  // Subtle corner cobbles make the two bends read as connected public space.
  for (const x of [rearWest.x, rearEast.x]) {
    part(root, drum, [1.01, .045, 1.01], [x, -.004, rearWest.z], 0xd8c4a6, 'ceramic');
  }

  // Planting is *outside* the path strip, not in the existing navigation lane.
  for (const [side, x] of [[0, west.x - 2.55], [1, east.x + 2.55]] as const) {
    for (const [i, z] of [rearWest.z + 3.5, rearWest.z + 9.8, rearWest.z + 17.2, west.z - 1.9].entries()) {
      planting(root, x, z, i + side * 2, i % 2 === 0);
      if (i !== 2) flowerbed(root, x + (side ? -.30 : .30), z + 1.45, i + side);
    }
  }
  for (let i = 0; i < 6; i++) {
    const x = rearWest.x + 4.8 + i * (rearEast.x - rearWest.x - 9.6) / 5;
    planting(root, x, rearWest.z - 3.45 - (i % 2) * .45, i + 3, i % 2 === 0);
    if (i % 2) planting(root, x + .9, rearWest.z - 2.3, i);
  }

  // Farm-style posts with painted caps, no real point lights or per-frame work.
  for (const [x, z] of [
    [west.x - 1.48, rearWest.z + 5.2], [west.x - 1.48, west.z - 4.2],
    [east.x + 1.48, rearWest.z + 5.2], [east.x + 1.48, west.z - 4.2],
    [middleX - 9.8, rearWest.z - 1.64], [middleX + 9.8, rearWest.z - 1.64],
  ]) {
    part(root, drum, [.078, 2.15, .078], [x, .94, z], 0x4d5a51, 'metal');
    part(root, softCube, [.31, .13, .31], [x, 2.02, z], 0x6e7868, 'metal');
    part(root, orb, [.17, .16, .17], [x, 1.91, z], 0xffdfac, 'ceramic');
    part(root, softCube, [.38, .068, .38], [x, 2.13, z], 0x4a594f, 'metal');
  }

  for (const [i, home] of NEIGHBOR_HOMES.entries()) cottage(root, home, i);

  // The separate homes always sit beyond the public pedestrian network.
  const reserve = Math.min(HOUSE.minX - west.x, east.x - HOUSE_WING.maxX, HOUSE.minZ - rearWest.z);
  if (reserve < 7.5) throw new Error('Keep the future house extension reserve and pedestrian ring');
  batchRigidParts(root, true);
  scene.add(root);
}
