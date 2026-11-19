import * as THREE from 'three';
import type { CharacterId } from '../shared/protocol';

/**
 * Sim-Life character art, stylized mobile LOD.
 * Shapes and materials are cached across both characters; no textures,
 * skeletal rigs or external assets are needed for this first art pass.
 * All body motion remains driven by Actor's pivot groups.
 */
const ballGeometry = new THREE.SphereGeometry(1, 14, 10);
const facetedGeometry = new THREE.IcosahedronGeometry(1, 1);
const cylinderGeometries = new Map<string, THREE.CylinderGeometry>();
const materialCache = new Map<string, THREE.MeshStandardMaterial>();

function material(color: number, flat = false): THREE.MeshStandardMaterial {
  const id = color + ':' + flat;
  let result = materialCache.get(id);
  if (!result) {
    result = new THREE.MeshStandardMaterial({
      color, roughness: flat ? 0.91 : 0.79, metalness: 0,
      flatShading: flat,
    });
    materialCache.set(id, result);
  }
  return result;
}
function oval(
  parent: THREE.Object3D, xyz: [number, number, number],
  scales: [number, number, number], color: number,
  flat = false, shadow = false,
): THREE.Mesh {
  const mesh = new THREE.Mesh(flat ? facetedGeometry : ballGeometry, material(color, flat));
  mesh.position.set(...xyz);
  mesh.scale.set(...scales);
  mesh.castShadow = shadow;
  parent.add(mesh);
  return mesh;
}
function cylinder(
  parent: THREE.Object3D, position: [number, number, number],
  top: number, base: number, height: number,
  color: number, segments = 12,
): THREE.Mesh {
  const key = [top, base, height, segments].join(':');
  let geometry = cylinderGeometries.get(key);
  if (!geometry) {
    geometry = new THREE.CylinderGeometry(top, base, height, segments);
    cylinderGeometries.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.position.set(...position);
  mesh.castShadow = top > 0.12 || base > 0.12;
  parent.add(mesh);
  return mesh;
}
type Pivots = {
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
};

export function buildCharacterArt(
  figure: THREE.Group,
  id: CharacterId,
  joints: Pivots,
): THREE.Object3D[] {
  const vlad = id === 'vlad';
  const palette = vlad
    ? { skin: 0xe8bc9b, skinShadow: 0xdba588, hair: 0x413630, hairLit: 0x655045,
        top: 0x789681, topShade: 0x627c6c, shirt: 0xf2e7d4,
        trouser: 0x596c75, shoe: 0x66584b, shoeLight: 0xf1e7d8, blush: 0xd59a8e }
    : { skin: 0xf0c6ab, skinShadow: 0xdcae96, hair: 0x604039, hairLit: 0x866052,
        top: 0xc99192, topShade: 0xaa737d, shirt: 0xfff1df,
        trouser: 0xb18684, shoe: 0x8e6b67, shoeLight: 0xf4decb, blush: 0xdd9a9b };

  // Body construction is layered and tapered rather than two cylinder blocks.
  oval(figure, [0, 0.85, -0.015], [0.25, 0.22, 0.20], palette.topShade, false, true);
  const torso = oval(figure, [0, 1.028, -0.005],
    [vlad ? 0.325 : 0.286, 0.35, 0.22], palette.top, false, true);
  torso.rotation.z = vlad ? 0.018 : -0.028;
  oval(figure, [0, 1.311, 0.015], [0.108, 0.125, 0.114], palette.skin, false, true);

  if (vlad) {
    // Sage casual overshirt with ivory tee, contrasting hem and collar.
    oval(figure, [0, 1.10, 0.211], [0.158, 0.175, 0.023], palette.shirt);
    oval(figure, [-0.105, 1.235, 0.17], [0.098, 0.105, 0.04], palette.topShade);
    oval(figure, [0.105, 1.235, 0.17], [0.098, 0.105, 0.04], palette.topShade);
    oval(figure, [0, 0.745, 0.03], [0.254, 0.048, 0.195], palette.topShade);
    oval(figure, [0.12, 0.99, 0.213], [0.064, 0.061, 0.018], 0x8fae98);
    oval(figure, [0.12, 0.99, 0.229], [0.018, 0.018, 0.01], 0xdde5c8);
    oval(figure, [-0.18, 0.84, 0.163], [0.075, 0.045, 0.024], palette.topShade);
  } else {
    // Soft layered dress with cardigan and a wide fabric waistband.
    const skirt = cylinder(figure, [0, 0.705, -0.012], 0.255, 0.394, 0.38, palette.top, 15);
    skirt.rotation.z = -0.028;
    cylinder(figure, [0, 0.526, -0.011], 0.391, 0.407, 0.037, palette.topShade, 15);
    oval(figure, [0, 0.894, 0.02], [0.267, 0.053, 0.215], palette.topShade);
    oval(figure, [0, 1.085, 0.218], [0.144, 0.19, 0.028], palette.shirt);
    oval(figure, [-0.17, 1.16, 0.17], [0.072, 0.155, 0.052], palette.topShade).rotation.z = 0.12;
    oval(figure, [0.17, 1.16, 0.17], [0.072, 0.155, 0.052], palette.topShade).rotation.z = -0.12;
    oval(figure, [0, 1.255, 0.17], [0.07, 0.05, 0.022], 0xd9a985);
    oval(figure, [0, 1.267, 0.195], [0.022, 0.028, 0.013], 0xfff6e4);
    for (const x of [-0.18, 0.18]) {
      oval(figure, [x, 0.56, 0.25], [0.024, 0.022, 0.012], 0xe9bbb3);
    }
  }

  // Shin/pivot groups preserve sitting, working, walking and sleeping animations.
  for (const [side, pivot] of [[-1, joints.leftLeg], [1, joints.rightLeg]] as const) {
    pivot.position.set(side * 0.154, 0.606, -0.016);
    const legColor = vlad ? palette.trouser : 0xe4c3a9;
    oval(pivot, [0, -0.232, 0.007], [vlad ? 0.137 : 0.116, 0.29, 0.136],
      legColor, false, true);
    if (vlad) {
      oval(pivot, [0, -0.443, 0.007], [0.143, 0.063, 0.146], 0x4d5f65);
      oval(pivot, [0, -0.485, 0.077], [0.160, 0.092, 0.24], palette.shoe, false, true);
      oval(pivot, [0, -0.536, 0.107], [0.162, 0.029, 0.225], palette.shoeLight);
    } else {
      oval(pivot, [0, -0.422, 0], [0.115, 0.068, 0.121], palette.skin);
      oval(pivot, [0, -0.468, 0.068], [0.15, 0.110, 0.200], palette.shoe, false, true);
      oval(pivot, [0, -0.532, 0.076], [0.15, 0.023, 0.201], palette.shoeLight);
    }
    figure.add(pivot);
  }
  // Upper-arm pivots; angled shoulder caps, cuffs, expressive hands.
  for (const [side, pivot] of [[-1, joints.leftArm], [1, joints.rightArm]] as const) {
    pivot.position.set(side * (vlad ? 0.328 : 0.29), 1.202, -0.008);
    oval(pivot, [0, -0.105, 0], [0.126, 0.198, 0.14], palette.top, false, true);
    oval(pivot, [0, -0.315, 0.02], [0.103, 0.182, 0.107], palette.topShade, false, true);
    oval(pivot, [0, -0.44, 0.018], [0.105, 0.051, 0.106], palette.shirt);
    oval(pivot, [0, -0.516, 0.028], [0.095, 0.103, 0.09], palette.skin, false, true);
    oval(pivot, [side * 0.07, -0.487, 0.083], [0.044, 0.068, 0.047], palette.skinShadow);
    figure.add(pivot);
  }

  // The head has a clear jaw and forehead, with a small but legible face.
  const head = oval(figure, [0, 1.535, 0.028], [0.302, 0.315, 0.283],
    palette.skin, false, true);
  head.rotation.z = vlad ? -0.032 : 0.035;
  // Keep a single head volume: the previous protruding chin read as a muzzle.
  for (const side of [-1, 1]) {
    oval(figure, [side * 0.294, 1.531, 0.018], [0.063, 0.10, 0.07], palette.skin);
    oval(figure, [side * 0.313, 1.525, 0.054], [0.024, 0.052, 0.029], palette.skinShadow);
  }

  // Hair silhouette should be recognizable even from the game's high camera.
  if (vlad) {
    oval(figure, [0, 1.752, -0.039], [0.299, 0.15, 0.278], palette.hair, true, true);
    oval(figure, [-0.27, 1.632, -0.029], [0.071, 0.177, 0.226], palette.hair, true);
    oval(figure, [0.27, 1.633, -0.035], [0.073, 0.156, 0.225], palette.hair, true);
    oval(figure, [0, 1.657, -0.226], [0.271, 0.182, 0.081], palette.hair);
    for (const [x, y, z, rz, color] of [
      [-0.22, 1.777, 0.119, -0.34, palette.hair],
      [-0.090, 1.804, 0.18, -0.31, palette.hairLit],
      [0.068, 1.796, 0.183, -0.23, palette.hair],
      [0.207, 1.770, 0.107, -0.24, palette.hairLit],
    ] as const) {
      const fringe = oval(figure, [x, y, z], [0.13, 0.093, 0.117], color, true);
      fringe.rotation.z = rz;
    }
    oval(figure, [-0.16, 1.843, -0.055], [0.17, 0.06, 0.19], palette.hairLit, true);
  } else {
    // Long chestnut layers, side-swept bangs and face-framing curled locks.
    oval(figure, [0, 1.74, -0.073], [0.331, 0.169, 0.303], palette.hair, true, true);
    oval(figure, [0, 1.405, -0.260], [0.322, 0.371, 0.139], palette.hair, true, true);
    for (const side of [-1, 1]) {
      const strand = oval(figure, [side * 0.27, 1.365, -0.117],
        [0.130, 0.372, 0.164], side === 1 ? palette.hairLit : palette.hair, true, true);
      strand.rotation.z = side * 0.11;
      const curl = oval(figure, [side * 0.278, 1.085, -0.10],
        [0.136, 0.155, 0.154], palette.hair, true, true);
      curl.rotation.z = -side * 0.14;
      oval(figure, [side * 0.271, 1.567, 0.127], [0.087, 0.176, 0.124], palette.hair);
    }
    for (const [x, y, rz] of [
      [-0.19, 1.752, -0.30], [-0.056, 1.783, -0.29],
      [0.078, 1.779, -0.24], [0.217, 1.740, -0.22],
    ] as const) {
      const fringe = oval(figure, [x, y, 0.194],
        [0.141, 0.086, 0.115], x < 0 ? palette.hairLit : palette.hair, true);
      fringe.rotation.z = rz;
    }
    // Tiny warm pearl hair clip.
    oval(figure, [0.270, 1.739, 0.175], [0.047, 0.022, 0.027], 0xf3d7ba);
    oval(figure, [0.312, 1.746, 0.158], [0.017, 0.018, 0.02], 0xfff4e5);
  }

  // Wide friendly eyes have separate whites, irises, tiny catchlights and brows.
  const blinkParts: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const x = side * 0.114;
    const eye = new THREE.Group();
    eye.position.set(x, 1.555, 0.294);
    oval(eye, [0, 0, 0], [0.074, 0.083, 0.018], 0xfffaf1);
    oval(eye, [side * 0.006, -0.008, 0.019],
      [0.044, 0.055, 0.014], vlad ? 0x68564a : 0x756451);
    oval(eye, [side * 0.009, -0.013, 0.032], [0.025, 0.044, 0.012], 0x2b2d2a);
    oval(eye, [-0.013, 0.025, 0.047], [0.015, 0.017, 0.008], 0xffffff);
    oval(eye, [0.014, -0.027, 0.043], [0.007, 0.008, 0.004], 0xfff3e2);
    eye.scale.setScalar(0.90);
    figure.add(eye);
    blinkParts.push(eye);
    const brow = oval(figure, [x, 1.663, 0.279],
      [0.081, 0.021, 0.020], palette.hair);
    brow.rotation.z = -side * (vlad ? 0.10 : 0.17);
    oval(figure, [side * 0.206, 1.439, 0.227],
      [0.073, 0.023, 0.009], palette.blush);
  }
  oval(figure, [0, 1.479, 0.321], [0.034, 0.052, 0.04], palette.skinShadow);
  oval(figure, [0, 1.473, 0.343], [0.023, 0.030, 0.017], palette.skin);
  // A subtle smile fitted to the skin rather than a torus cutting through it.
  oval(figure, [0, 1.405, 0.301], [0.064, 0.012, 0.007],
    vlad ? 0x975f58 : 0xaa6e6a);
  for (const side of [-1, 1]) {
    oval(figure, [side * 0.052, 1.418, 0.296], [0.016, 0.011, 0.006],
      vlad ? 0x975f58 : 0xaa6e6a);
  }
  if (!vlad) {
    oval(figure, [0, 1.390, 0.295], [0.038, 0.007, 0.005], 0xda9c93);
  }
  return blinkParts;
}
