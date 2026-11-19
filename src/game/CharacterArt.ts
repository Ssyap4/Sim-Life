import * as THREE from 'three';
import { batchRigidParts, colors, finish, orb, sculptedCurve } from './ArtKit';
import type { CharacterId } from '../shared/protocol';

/**
 * Sim-Life character art, stylized mobile LOD.
 * Shapes and materials are cached across both characters; no textures,
 * skeletal rigs or external assets are needed for this first art pass.
 * All body motion remains driven by Actor's pivot groups.
 */
const cylinderGeometries = new Map<string, THREE.CylinderGeometry>();

function oval(
  parent: THREE.Object3D, xyz: [number, number, number],
  scales: [number, number, number], color: number, shadow = false,
): THREE.Mesh {
  const mesh = new THREE.Mesh(orb, finish(color, 'skin'));
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
  const mesh = new THREE.Mesh(geometry, finish(color));
  mesh.position.set(...position);
  mesh.castShadow = top > 0.12 || base > 0.12;
  parent.add(mesh);
  return mesh;
}
/** Follow the torso volume so shirts and lapels read as cloth rather than badges. */
function shirtFront(parent: THREE.Object3D, halfWidth: number, color: number): void {
  const vertices: number[] = [];
  const indices: number[] = [];
  const rows = [[1.275, 0.58], [1.235, 0.94], [1.10, 1], [0.99, 1], [0.88, 0.90]];
  for (const [y, width] of rows) for (let i = 0; i < 5; i++) {
    const x = (i / 2 - 1) * halfWidth * width;
    const curve = 1 - (x / (halfWidth > 0.115 ? 0.325 : 0.286)) ** 2 - ((y - 1.028) / 0.35) ** 2;
    vertices.push(x, y, 0.006 + 0.22 * Math.sqrt(Math.max(0, curve)));
  }
  for (let row = 0; row < rows.length - 1; row++) for (let i = 0; i < 4; i++) {
    const a = row * 5 + i;
    indices.push(a, a + 5, a + 1, a + 1, a + 5, a + 6);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(vertices.length / 3 * 2), 2));
  geometry.computeVertexNormals();
  parent.add(new THREE.Mesh(geometry, finish(color)));
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
        top: colors.pine, topShade: 0x38574e, shirt: colors.paper,
        trouser: 0x596c75, shoe: 0x66584b, shoeLight: 0xf1e7d8, blush: 0xd59a8e }
    : { skin: 0xf0c6ab, skinShadow: 0xdcae96, hair: 0x604039, hairLit: 0x866052,
        top: 0xb77173, topShade: 0x8d4f62, shirt: 0xffefd8,
        trouser: 0xb18684, shoe: 0x8e6b67, shoeLight: 0xf4decb, blush: 0xdd9a9b };

  // Body construction is layered and tapered rather than two cylinder blocks.
  oval(figure, [0, 0.85, -0.015], [0.25, 0.22, 0.20], palette.topShade, true);
  oval(figure, [0, 1.028, -0.005],
    [vlad ? 0.325 : 0.286, 0.35, 0.22], palette.top, true);
  oval(figure, [0, 1.311, 0.015], [0.108, 0.125, 0.114], palette.skin, true);

  if (vlad) {
    // Sage casual overshirt with ivory tee, contrasting hem and collar.
    shirtFront(figure, 0.132, palette.shirt);
    for (const side of [-1, 1]) {
      sculptedCurve(figure, [[side * 0.103, 1.284, 0.141],
        [side * 0.149, 1.21, 0.169], [side * 0.141, 1.125, 0.199],
        [side * 0.130, 0.918, 0.198]],
      0.038, 0.011, palette.topShade, 0.43);
    }
    oval(figure, [0, 0.745, 0.03], [0.254, 0.048, 0.195], palette.topShade);
    oval(figure, [0.12, 0.99, 0.213], [0.064, 0.061, 0.018], 0x8fae98);
    for (const y of [0.89, 0.99, 1.09]) {
      oval(figure, [0.16, y, 0.213], [0.014, 0.014, 0.009], colors.oat);
    }
    oval(figure, [-0.18, 0.84, 0.163], [0.075, 0.045, 0.024], palette.topShade);
  } else {
    // Soft layered dress with cardigan and a wide fabric waistband.
    const skirt = cylinder(figure, [0, 0.705, -0.012], 0.255, 0.394, 0.38, palette.top, 22);
    skirt.rotation.z = -0.028;
    cylinder(figure, [0, 0.526, -0.011], 0.391, 0.407, 0.037, palette.topShade, 22);
    oval(figure, [0, 0.894, 0.02], [0.267, 0.053, 0.215], palette.topShade);
    shirtFront(figure, 0.105, palette.shirt);
    for (const side of [-1, 1]) {
      sculptedCurve(figure, [[side * 0.092, 1.285, 0.137],
        [side * 0.129, 1.203, 0.173], [side * 0.121, 1.09, 0.205],
        [side * 0.115, 0.913, 0.181]],
      0.034, 0.014, palette.topShade, 0.52);
    }
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
      legColor, true);
    if (vlad) {
      oval(pivot, [0, -0.443, 0.007], [0.143, 0.063, 0.146], 0x4d5f65);
      oval(pivot, [0, -0.485, 0.077], [0.160, 0.092, 0.24], palette.shoe, true);
      oval(pivot, [0, -0.536, 0.107], [0.162, 0.029, 0.225], palette.shoeLight);
    } else {
      oval(pivot, [0, -0.422, 0], [0.115, 0.068, 0.121], palette.skin);
      oval(pivot, [0, -0.468, 0.068], [0.15, 0.110, 0.200], palette.shoe, true);
      oval(pivot, [0, -0.532, 0.076], [0.15, 0.023, 0.201], palette.shoeLight);
    }
    figure.add(pivot);
  }
  // Upper-arm pivots; angled shoulder caps, cuffs, expressive hands.
  for (const [side, pivot] of [[-1, joints.leftArm], [1, joints.rightArm]] as const) {
    pivot.position.set(side * (vlad ? 0.328 : 0.29), 1.202, -0.008);
    oval(pivot, [0, -0.105, 0], [0.126, 0.198, 0.14], palette.top, true);
    oval(pivot, [0, -0.315, 0.02], [0.103, 0.182, 0.107], palette.topShade, true);
    oval(pivot, [0, -0.44, 0.018], [0.105, 0.051, 0.106], palette.shirt);
    oval(pivot, [0, -0.516, 0.028], [0.095, 0.103, 0.09], palette.skin, true);
    oval(pivot, [side * 0.07, -0.487, 0.083], [0.044, 0.068, 0.047], palette.skinShadow);
    figure.add(pivot);
  }

  // The head has a clear jaw and forehead, with a small but legible face.
  const head = oval(figure, [0, 1.535, 0.028], [0.302, 0.315, 0.283],
    palette.skin, true);
  head.rotation.z = vlad ? -0.032 : 0.035;
  // Keep a single head volume: the previous protruding chin read as a muzzle.
  for (const side of [-1, 1]) {
    oval(figure, [side * 0.294, 1.531, 0.018], [0.063, 0.10, 0.07], palette.skin);
    oval(figure, [side * 0.313, 1.525, 0.054], [0.024, 0.052, 0.029], palette.skinShadow);
  }

  // A fitted cap and tapered, curved locks create one silhouette from every angle.
  if (vlad) {
    oval(figure, [0, 1.741, -0.049], [0.304, 0.173, 0.282], palette.hair, true);
    for (const side of [-1, 1]) {
      oval(figure, [side * 0.251, 1.641, -0.035], [0.083, 0.163, 0.206], palette.hair);
    }
    for (let i = 0; i < 5; i++) {
      const x = -0.24 + i * 0.10;
      sculptedCurve(figure, [[x, 1.79, -0.13], [x + 0.035, 1.878 + i * 0.006, 0.035],
        [x - 0.02, 1.865, 0.18], [x - 0.06, 1.751 + i * 0.008, 0.264]],
      0.068, 0.009, i === 1 ? palette.hairLit : palette.hair, 0.75);
    }
  } else {
    oval(figure, [0, 1.735, -0.072], [0.331, 0.18, 0.304], palette.hair, true);
    oval(figure, [0, 1.378, -0.255], [0.31, 0.391, 0.151], palette.hair, true);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const x = side * (0.20 + i * 0.048);
        sculptedCurve(figure, [[x * 0.55, 1.854, -0.105], [x, 1.681, 0.052 - i * 0.055],
          [x + side * 0.048, 1.396, 0.08 - i * 0.087],
          [x + side * 0.068, 1.22, 0.035 - i * 0.079],
          [x * 0.85, 1.055 + i * 0.06, 0.105 - i * 0.06]],
        0.088, 0.013, i === 1 ? palette.hairLit : palette.hair, 0.81, i === 0);
      }
    }
    for (let i = 0; i < 3; i++) {
      const x = -0.14 + i * 0.086;
      sculptedCurve(figure, [[x, 1.858, 0.07], [x - 0.089, 1.833, 0.199],
        [x - 0.131, 1.758, 0.252], [x - 0.133, 1.72 - i * 0.015, 0.253]],
      0.066, 0.008, i === 0 ? palette.hairLit : palette.hair);
    }
    oval(figure, [0.266, 1.748, 0.20], [0.052, 0.017, 0.026], colors.brass).rotation.z = 0.32;
    oval(figure, [0.302, 1.754, 0.197], [0.018, 0.018, 0.022], colors.paper);
  }

  // Wide friendly eyes have separate whites, irises, tiny catchlights and brows.
  const blinkParts: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const x = side * 0.118;
    const eye = new THREE.Group();
    eye.position.set(x, 1.560, 0.287);
    eye.rotation.y = side * 0.21;
    oval(eye, [0, 0.008, 0], [0.078, 0.077, 0.018], palette.hair);
    oval(eye, [0, 0, 0.008], [0.073, 0.071, 0.019], 0xfffaf1);
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
  sculptedCurve(figure, [[-0.055, 1.421, 0.282], [-0.03, 1.406, 0.292],
    [0, 1.402, 0.297], [0.03, 1.407, 0.291], [0.055, 1.422, 0.283]],
  0.008, 0.006, vlad ? 0x975f58 : 0xaa6e6a, 1);
  for (const pivot of [figure, ...Object.values(joints), ...blinkParts]) batchRigidParts(pivot);
  return blinkParts;
}
