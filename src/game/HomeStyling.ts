import * as THREE from 'three';
import { PETS, PET_IDS } from '../shared/pets';

// Lightweight visual-only layer: reusable materials and geometry, no navigation
// obstacles or gameplay state. Safe to replace with higher-quality assets later.
const cube = new THREE.BoxGeometry(1, 1, 1);
const materials = new Map<number, THREE.MeshStandardMaterial>();
function mat(color: number): THREE.MeshStandardMaterial {
  let material = materials.get(color);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, roughness: 0.88 });
    materials.set(color, material);
  }
  return material;
}
function box(scene: THREE.Object3D, size: [number, number, number], pos: [number, number, number], color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(cube, mat(color));
  mesh.scale.set(...size);
  mesh.position.set(...pos);
  scene.add(mesh);
  mesh.receiveShadow = true;
  return mesh;
}
function blob(scene: THREE.Object3D, r: number, pos: [number, number, number], color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat(color));
  mesh.position.set(...pos);
  scene.add(mesh);
  return mesh;
}
function plate(scene: THREE.Object3D, r: number, height: number, pos: [number, number, number], color: number): void {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, height, 12), mat(color));
  mesh.position.set(...pos);
  scene.add(mesh);
}

export function decorateHome(scene: THREE.Scene): void {
  // Subtle staggered wooden floor seams (one draw call, not hundreds of planks).
  const strokes: number[] = [];
  const segment = (x1: number, z1: number, x2: number, z2: number): void => {
    strokes.push(x1, 0.009, z1, x2, 0.009, z2);
  };
  for (let x = -5.9; x < 6; x += 0.68) segment(x, -4.92, x, 4.92);
  for (let z = -4.9, row = 0; z < 4.95; z += 2.15, row++) {
    const shift = row % 2 ? 0.34 : 0;
    for (let x = -5.95 + shift; x < 6; x += 0.68) segment(x, z, x + 0.68, z);
  }
  const lines = new THREE.BufferGeometry();
  lines.setAttribute('position', new THREE.Float32BufferAttribute(strokes, 3));
  scene.add(new THREE.LineSegments(lines, new THREE.LineBasicMaterial({
    color: 0x816c55, transparent: true, opacity: 0.15, depthWrite: false,
  })));

  // Cream wainscoting, wood trim and panel rhythm in the two visible walls.
  box(scene, [11.8, 0.83, 0.035], [0.04, 0.47, -4.876], 0xeee4d4);
  box(scene, [0.035, 0.83, 9.8], [-5.885, 0.47, 0], 0xeee4d4);
  box(scene, [11.9, 0.06, 0.08], [0.02, 0.93, -4.83], 0xc8b29b);
  box(scene, [0.08, 0.06, 9.8], [-5.85, 0.93, 0], 0xc8b29b);
  for (let x = -5.55; x < 5.6; x += 1.1) {
    box(scene, [0.035, 0.68, 0.045], [x, 0.48, -4.845], 0xd7c7b5);
  }
  for (let z = -4.46; z < 4.5; z += 1.08) {
    box(scene, [0.044, 0.68, 0.033], [-5.84, 0.48, z], 0xd7c7b5);
  }

  // A layered watercolor-like garden outside the existing framed window.
  box(scene, [2.38, 1.42, 0.025], [-1.65, 2.04, -4.804], 0xbfd5cc);
  box(scene, [2.38, 0.43, 0.028], [-1.65, 1.47, -4.788], 0x88a88f);
  blob(scene, 0.29, [-2.45, 1.91, -4.767], 0x7ea488);
  blob(scene, 0.40, [-1.07, 1.59, -4.767], 0x6c957b);
  blob(scene, 0.28, [-0.75, 1.71, -4.762], 0x82a98a);
  blob(scene, 0.17, [-2.05, 2.37, -4.779], 0xffe0a9);
  // Make the mullions appear in front of scenery.
  box(scene, [0.065, 1.47, 0.06], [-1.65, 2.04, -4.712], 0xfffaf0);
  box(scene, [2.43, 0.065, 0.06], [-1.65, 2.06, -4.708], 0xfffaf0);
  // Curtain tiebacks and gently folded fabric.
  for (const x of [-3.13, -0.17]) {
    box(scene, [0.13, 0.38, 0.08], [x, 1.38, -4.61], 0xbfac91);
    blob(scene, 0.09, [x, 1.44, -4.54], 0xe5d1b4);
  }

  // Bed linen: stripe, soft blanket and bedside wall artworks.
  box(scene, [2.42, 0.065, 0.16], [-3.85, 0.94, -1.48], 0xb18883);
  box(scene, [2.34, 0.065, 0.20], [-3.85, 0.94, -1.68], 0xe5d5ba);
  box(scene, [1.00, 0.045, 0.09], [-4.44, 0.95, -3.07], 0xe6ddc8);
  box(scene, [1.00, 0.045, 0.09], [-3.26, 0.95, -3.07], 0xe6ddc8);
  box(scene, [0.95, 1.14, 0.08], [-4.77, 2.18, -4.78], 0x997a65);
  box(scene, [0.81, 1.00, 0.09], [-4.77, 2.18, -4.716], 0xf0dfc7);
  blob(scene, 0.21, [-4.86, 2.19, -4.64], 0x9aab8a);
  blob(scene, 0.14, [-4.56, 2.01, -4.63], 0xcfa28b);

  // Lived-in sofa: knitted throw and a low side table for a cup.
  box(scene, [0.69, 0.055, 0.70], [-3.87, 0.73, 1.34], 0xd7bbab);
  for (const z of [1.03, 1.13, 1.23]) {
    box(scene, [0.62, 0.015, 0.015], [-3.87, 0.768, z], 0xeedacb);
  }
  plate(scene, 0.23, 0.07, [-1.78, 0.065, 2.38], 0x947a62);
  box(scene, [0.08, 0.36, 0.08], [-1.78, 0.24, 2.38], 0x8c7563);
  plate(scene, 0.21, 0.04, [-1.78, 0.44, 2.38], 0xc9ae94);
  plate(scene, 0.09, 0.09, [-1.78, 0.53, 2.38], 0xfff2d9);

  // Small, purposeful stool at the eating spot; it is an interaction seat.
  box(scene, [0.66, 0.10, 0.64], [-0.84, 0.48, 0.05], 0xa68b75);
  for (const dx of [-0.24, 0.24]) for (const dz of [-0.22, 0.22]) {
    box(scene, [0.065, 0.43, 0.065], [-0.84 + dx, 0.24, 0.05 + dz], 0x8d755e);
  }

  // Two floating book shelves on the side wall. The books share one cube geometry.
  for (const y of [1.49, 2.22]) {
    box(scene, [0.39, 0.085, 2.18], [-5.64, y, 1.34], 0xb09275);
    for (let i = 0; i < 12; i++) {
      const shade = [0x91a88b, 0xd1a998, 0xc5b197, 0x899e9a, 0xdbc7a1][i % 5];
      const height = 0.28 + (i % 3) * 0.075;
      box(scene, [0.16, height, 0.11], [-5.58, y + 0.04 + height / 2, 0.44 + i * 0.148], shade);
    }
  }

  // Desk accessories: warm mug, notebook, pinned notes over the workplace.
  box(scene, [0.42, 0.018, 0.34], [2.52, 1.065, 1.54], 0xf1d9b8);
  box(scene, [0.02, 0.021, 0.32], [2.52, 1.079, 1.54], 0xa99b84);
  plate(scene, 0.11, 0.18, [4.03, 1.17, 1.45], 0xd3b6a3);
  box(scene, [0.92, 0.67, 0.08], [4.38, 2.04, -4.77], 0xb4977b);
  box(scene, [0.80, 0.54, 0.08], [4.38, 2.04, -4.695], 0xdccbb2);
  for (const [x, y, color] of [[4.17, 2.18, 0xe5b3a1], [4.57, 2.04, 0xa8bcad], [4.3, 1.87, 0xe5d3aa]] as const) {
    box(scene, [0.20, 0.19, 0.09], [x, y, -4.64], color);
  }

  // Kitchen jars, herbs and a narrow rack. No extra shadow-casting lights.
  for (const x of [2.68, 3.07, 3.46]) {
    plate(scene, 0.12, 0.22, [x, 1.19, -3.62], x < 3 ? 0xd6c6a8 : 0xb3c3a3);
    plate(scene, 0.125, 0.04, [x, 1.32, -3.62], 0x9f907f);
  }
  plate(scene, 0.13, 0.21, [4.75, 1.19, -3.65], 0xe6d8bb);
  for (const pos of [[4.72, 1.44, -3.64], [4.81, 1.49, -3.68], [4.65, 1.48, -3.70]] as const) {
    blob(scene, 0.13, [...pos], 0x849d78);
  }

  // Warm pendant and a tiny practical light; only one shadow-free point lamp.
  plate(scene, 0.026, 0.34, [0.42, 2.94, 0.89], 0x9c8877);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.46, 0.28, 14), mat(0xf3dcc0));
  shade.position.set(0.42, 2.62, 0.89);
  scene.add(shade);
  blob(scene, 0.11, [0.42, 2.41, 0.89], 0xffe2a4);
  const warm = new THREE.PointLight(0xffdcaa, 0.67, 6.8, 2);
  warm.position.set(0.42, 2.43, 0.89);
  scene.add(warm);

  // Personal floor cushions, dishes and toys for our two resident pets.
  for (const id of PET_IDS) {
    const home = PETS[id].home;
    const dog = id === 'verdell';
    const edge = dog ? 0x7d997f : 0xc5a17b;
    const centre = dog ? 0xb8c4ab : 0xe5c49d;
    box(scene, [0.87, 0.045, 0.70], [home.x, 0.031, home.z], edge);
    box(scene, [0.67, 0.05, 0.50], [home.x, 0.080, home.z], centre);
    plate(scene, 0.20, 0.10, [home.x + 0.61, 0.065, home.z + 0.16], dog ? 0x75988a : 0xc59779);
    plate(scene, 0.14, 0.025, [home.x + 0.61, 0.128, home.z + 0.16], 0xe6c7a0);
    blob(scene, 0.125, [home.x - 0.58, 0.13, home.z + 0.28], dog ? 0xc98c74 : 0xd7af84);
  }
}
