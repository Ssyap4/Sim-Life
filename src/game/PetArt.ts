import * as THREE from 'three';
import { batchRigidParts, colors as C, sculptedCurve } from './ArtKit';
import type { PetId } from '../shared/pets';

/**
 * Two separate pet silhouettes sharing simple low-poly geometries/materials.
 * Reuses the PetActor head/tail/foot pivots to preserve gameplay animations.
 */
const rounded = new THREE.SphereGeometry(1, 12, 9);
const lowPoly = new THREE.IcosahedronGeometry(1, 1);
const cones = new Map<string, THREE.ConeGeometry>();
const colors = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: number, faceted = false): THREE.MeshStandardMaterial {
  const key = color + ':' + faceted;
  let value = colors.get(key);
  if (!value) {
    value = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: faceted });
    colors.set(key, value);
  }
  return value;
}
function ellipsoid(
  group: THREE.Object3D, position: [number, number, number],
  scale: [number, number, number], color: number,
  facet = false,
): THREE.Mesh {
  const mesh = new THREE.Mesh(facet ? lowPoly : rounded, mat(color, facet));
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = Math.max(...scale) > 0.2;
  group.add(mesh);
  return mesh;
}
function pointed(
  group: THREE.Object3D, position: [number, number, number],
  width: number, height: number, color: number,
  tilt = 0,
): THREE.Mesh {
  const key = width + ':' + height;
  let geometry = cones.get(key);
  if (!geometry) {
    geometry = new THREE.ConeGeometry(width, height, 7);
    cones.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, mat(color, true));
  mesh.position.set(...position);
  mesh.rotation.z = tilt;
  mesh.castShadow = height > 0.19;
  group.add(mesh);
  return mesh;
}

function paw(
  body: THREE.Group, joints: THREE.Group[],
  x: number, z: number, dog: boolean,
): void {
  const limb = new THREE.Group();
  limb.position.set(x, 0.32, z);
  const coat = dog ? 0x3b3a41 : 0xdb934f;
  ellipsoid(limb, [0, -0.13, 0], [dog ? 0.13 : 0.098, 0.18, 0.125], coat);
  ellipsoid(limb, [0, -0.258, 0.073], [0.148, 0.081, 0.173], coat);
  for (const toe of [-0.062, 0, 0.062]) {
    ellipsoid(limb, [toe, -0.277, 0.2], [0.052, 0.042, 0.068],
      dog ? 0x4f4950 : 0xedaf6c);
  }
  body.add(limb);
  joints.push(limb);
}
function features(
  head: THREE.Group, dog: boolean,
): void {
  const eyeColor = dog ? 0x6e4c36 : 0x70925b;
  const dark = 0x262824;
  // Big clear eyes with eyelids and multiple catchlights.
  for (const side of [-1, 1]) {
    const x = side * (dog ? 0.164 : 0.153);
    const z = dog ? 0.323 : 0.307;
    ellipsoid(head, [x, 0.042, z], [0.098, 0.116, 0.026],
      dog ? 0x4c4749 : 0xe9a85d);
    ellipsoid(head, [x, 0.029, z + 0.021], [0.075, 0.092, 0.025], dog ? 0x6b5b4c : 0xf2d4a3);
    ellipsoid(head, [x + side * 0.008, 0.019, z + 0.044],
      [dog ? 0.068 : 0.058, 0.077, 0.017], eyeColor);
    ellipsoid(head, [x + side * 0.012, 0.019, z + 0.059],
      [dog ? 0.043 : 0.025, 0.067, 0.011], dark);
    ellipsoid(head, [x - 0.022, 0.058, z + 0.071],
      [0.021, 0.023, 0.006], 0xffffff);
    const brow = ellipsoid(head, [x, 0.167, z - 0.008],
      [0.107, 0.025, 0.035], dog ? 0x635853 : 0xba713f);
    brow.rotation.z = side * 0.10;
  }
}
function spitz(
  body: THREE.Group, head: THREE.Group, tail: THREE.Group, paws: THREE.Group[],
): void {
  const black = 0x303339;
  const dark = 0x24242b;
  const lights = 0x494a51;
  const chest = 0x535058;
  ellipsoid(body, [0, 0.47, -0.08], [0.39, 0.36, 0.53], dark);
  ellipsoid(body, [0, 0.51, 0.13], [0.38, 0.39, 0.39], black);
  ellipsoid(body, [0, 0.42, 0.29], [0.32, 0.33, 0.23], lights);
  // Broad overlapping sweeps form a layered mane without a ring of beads.
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const x = side * (0.12 + i * 0.052);
    sculptedCurve(body, [[x * 0.73, 0.73 - i * 0.042, 0.33],
      [x, 0.51 - i * 0.044, 0.45 - i * 0.03],
      [x + side * 0.08, 0.32 - i * 0.028, 0.38 - i * 0.052]],
    0.084, 0.012, i % 2 ? lights : chest, 0.83);
  }
  for (const x of [-0.245, 0.245]) for (const z of [-0.325, 0.315]) paw(body, paws, x, z, true);

  // Face is spherical with prominent plush cheeks and short cream snout.
  ellipsoid(head, [0, 0.045, 0], [0.365, 0.35, 0.315], black);
  for (const side of [-1, 1]) {
    ellipsoid(head, [side * 0.249, -0.123, 0.195],
      [0.177, 0.20, 0.163], lights);
    pointed(head, [side * 0.253, 0.321, -0.036],
      0.157, 0.34, black, -side * 0.18);
    pointed(head, [side * 0.253, 0.326, 0.027],
      0.073, 0.185, 0x947979, -side * 0.18);
  }
  ellipsoid(head, [0, -0.17, 0.284], [0.188, 0.128, 0.159], chest);
  ellipsoid(head, [0, -0.105, 0.422], [0.085, 0.068, 0.048], dark);
  features(head, true);
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.077, 0.008, 3, 12, Math.PI),
    mat(0x393c35),
  );
  mouth.position.set(0, -0.221, 0.412);
  mouth.rotation.z = Math.PI;
  head.add(mouth);
  ellipsoid(head, [0, -0.255, 0.411], [0.056, 0.034, 0.015], 0xcc8a84);
  // Quiet collar/tag, deliberately subtle over charcoal fur.
  ellipsoid(body, [0, 0.33, 0.4], [0.065, 0.064, 0.021], 0xe1c09a);
  ellipsoid(body, [0, 0.344, 0.419], [0.024, 0.022, 0.01], 0xf3dec6);

  sculptedCurve(tail, [[0, 0.025, -0.06], [0.05, 0.26, -0.36], [0.09, 0.49, -0.28],
    [0.09, 0.54, -0.03], [0.06, 0.40, 0.13]], 0.16, 0.016, black, 0.91, true);
  sculptedCurve(tail, [[0.05, 0.25, -0.42], [0.10, 0.49, -0.40],
    [0.11, 0.59, -0.14], [0.085, 0.45, 0.15]], 0.10, 0.008, lights, 0.87);

}
function cat(
  body: THREE.Group, head: THREE.Group, tail: THREE.Group, paws: THREE.Group[],
): void {
  const ginger = 0xd8904a;
  const bright = 0xf1b36e;
  const darkStripe = 0x995a34;
  const cream = 0xf6d5aa;
  // Long oval back and narrow chest distinguish the cat from the spitz.
  ellipsoid(body, [0, 0.432, -0.11], [0.31, 0.275, 0.48], ginger);
  ellipsoid(body, [0, 0.45, 0.215], [0.248, 0.263, 0.243], bright);
  ellipsoid(body, [0, 0.345, 0.38], [0.150, 0.226, 0.058], cream);
  for (const x of [-0.212, 0.212]) for (const z of [-0.34, 0.273]) paw(body, paws, x, z, false);
  // Curved back stripes that remain legible from above.
  for (const z of [-0.40, -0.20, 0.0, 0.18]) {
    for (const side of [-1, 1]) {
      const stripe = ellipsoid(body, [side * 0.19, 0.654 - Math.abs(z) * 0.12, z],
        [0.053, 0.025, 0.145], darkStripe);
      stripe.rotation.y = side * 0.51;
      stripe.rotation.z = side * 0.39;
    }
  }
  ellipsoid(body, [0, 0.698, -0.20], [0.055, 0.017, 0.26], darkStripe);

  // Cat cheeks and white muzzle with triangular orange ears.
  ellipsoid(head, [0, 0.03, 0.05], [0.306, 0.286, 0.295], ginger);
  for (const side of [-1, 1]) {
    pointed(head, [side * 0.235, 0.324, 0.005],
      0.18, 0.42, ginger, -side * 0.15);
    pointed(head, [side * 0.235, 0.331, 0.077],
      0.096, 0.243, 0xd7837c, -side * 0.15);
    ellipsoid(head, [side * 0.075, -0.158, 0.306],
      [0.124, 0.096, 0.083], cream);
    ellipsoid(head, [side * 0.229, 0.152, 0.175],
      [0.051, 0.137, 0.047], darkStripe).rotation.z = side * 0.26;
  }
  features(head, false);
  for (const x of [-0.145, 0, 0.145]) {
    const mark = ellipsoid(head,
      [x, 0.242 - Math.abs(x) * 0.31, 0.238],
      [0.041, 0.079, 0.035], darkStripe);
    mark.rotation.z = -x * 1.2;
  }
  ellipsoid(head, [0, -0.12, 0.393], [0.069, 0.046, 0.028], 0xc67a72);
  ellipsoid(head, [0, -0.207, 0.35], [0.035, 0.016, 0.015], 0x976d5c);
  // Low-cost grouped whisker line drawing.
  const whiskers: number[] = [];
  for (const side of [-1, 1]) {
    for (let index = 0; index < 3; index++) {
      whiskers.push(side * 0.11, -0.163 + index * 0.015, 0.377,
        side * (0.42 + index * 0.03), -0.235 + index * 0.093, 0.403);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(whiskers, 3));
  head.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xffe3bd })));

  sculptedCurve(tail, [[0, 0.02, -0.08], [0.16, 0.23, -0.27],
    [0.29, 0.47, -0.36], [0.30, 0.73, -0.38], [0.19, 0.90, -0.35]],
  0.101, 0.012, ginger, 0.94, true, 0xcea787);

  // Collar detail: soft sage green clasp behind the chin.
  ellipsoid(body, [0, 0.346, 0.422], [0.05, 0.053, 0.027], C.pine);
  ellipsoid(body, [0, 0.358, 0.443], [0.019, 0.022, 0.013], 0xf8e5be);
}

export function buildPetArt(
  body: THREE.Group, head: THREE.Group, tail: THREE.Group,
  paws: THREE.Group[], id: PetId,
): void {
  if (id === 'verdell') spitz(body, head, tail, paws);
  else cat(body, head, tail, paws);
  for (const pivot of [body, head, tail, ...paws]) batchRigidParts(pivot);
}
