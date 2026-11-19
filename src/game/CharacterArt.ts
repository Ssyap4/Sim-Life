import * as THREE from 'three';
import { batchRigidParts, colors, finish, orb, sculptedCurve } from './ArtKit';
import { hingedLimb, loft, sculpt } from './SculptMesh';
import type { CharacterId } from '../shared/protocol';

type Pivots = {
  leftLeg: THREE.Group; rightLeg: THREE.Group;
  leftArm: THREE.Group; rightArm: THREE.Group;
};

export type CharacterRig = {
  chest: THREE.Group;
  head: THREE.Group;
  eyes: readonly THREE.Group[];
  elbows: readonly THREE.Bone[];
  knees: readonly THREE.Bone[];
  waistY: number;
  thighLength: number;
  shinLength: number;
  shoulderY: number;
  upperArm: number;
  lowerArm: number;
};

type Palette = ReturnType<typeof paletteFor>;
function paletteFor(vlad: boolean) {
  return vlad ? {
    skin: 0xdca789, cheek: 0xc58776, lip: 0x95564d,
    hair: 0x362a26, highlight: 0x543d30, eyebrow: 0x47362f, iris: 0x53655b,
    outer: 0x526b63, lining: 0x364f49, inner: 0xf0e9d8, pant: 0x444f5b,
    shoes: 0xa58a70, soles: 0xe9d7c1,
  } : {
    skin: 0xe9b79b, cheek: 0xcd907f, lip: 0x9f5855,
    hair: 0xa58158, highlight: 0xd5b17c, eyebrow: 0x7a5e49, iris: 0x63705e,
    outer: 0xa26257, lining: 0x754641, inner: 0xf7e6ce, pant: 0x514854,
    shoes: 0x866257, soles: 0xe0c0a8,
  };
}

function oval(parent: THREE.Object3D, color: number, position: THREE.Vector3Tuple,
  size: THREE.Vector3Tuple, surface: Parameters<typeof finish>[1] = 'skin'): THREE.Mesh {
  const mesh = new THREE.Mesh(orb, finish(color, surface));
  mesh.position.set(...position);
  mesh.scale.set(...size);
  parent.add(mesh);
  return mesh;
}

function makeHair(head: THREE.Group, vlad: boolean, p: Palette): void {
  // One scalp volume with a shaped hairline. Swept locks follow that surface.
  const crown = loft([
    [0, 0.17, 0.147, -0.005], [0.04, 0.191, 0.166, -0.01],
    [0.10, 0.185, 0.174, -0.011], [0.16, 0.156, 0.157, -0.016],
    [0.207, 0.093, 0.113, -0.025], [0.224, 0.002, 0.002, -0.031],
  ], 24, 15, (x, y, z, a) => {
    const front = Math.cos(a);
    const line = front > 0 ? 0.077 + 0.020 * Math.sin(a * 2) : vlad ? -0.075 : -0.11;
    const strength = (1 - y / 0.224) ** 1.7;
    return [x, y + line * strength, z];
  });
  sculpt(head, crown, p.hair, 'wood');

  if (vlad) {
    for (let i = 0; i < 5; i++) {
      const x = -0.144 + i * 0.058;
      sculptedCurve(head, [[x + 0.02, 0.133, -0.099], [x * 0.75 + 0.028, 0.208, 0.000],
        [x * 0.77 - 0.022, 0.191, 0.106], [x - 0.034, 0.115 + i * 0.002, 0.155]],
      0.042, 0.008, i === 2 ? p.highlight : p.hair, 0.62);
    }
  } else {
    const drape = loft([
      [-0.47, 0.063, 0.036, -0.143], [-0.40, 0.169, 0.073, -0.141],
      [-0.29, 0.209, 0.080, -0.133], [-0.10, 0.201, 0.109, -0.099],
      [0.09, 0.173, 0.119, -0.067], [0.177, 0.082, 0.052, -0.048],
    ], 22, 21, (x, y, z, a) => [x, y + 0.021 * Math.sin(a * 3), z]);
    sculpt(head, drape, p.hair, 'wood');
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      const x = side * (0.122 + i * 0.028);
      sculptedCurve(head, [[x * 0.48, 0.207, -0.025], [x * 0.84, 0.116, 0.095 - i * 0.053],
        [x + side * 0.018, -0.06, 0.067 - i * 0.063],
        [x + side * 0.013, -0.231, 0.091 - i * 0.05],
        [x + side * 0.014, -0.394 + i * 0.029, -0.015 - i * 0.039]],
      0.046, 0.009, i % 3 === 0 ? p.highlight : p.hair, 0.81);
    }
    for (let i = 0; i < 3; i++) {
      sculptedCurve(head, [[0.045 + i * 0.019, 0.212, 0.001], [-0.047 + i * 0.009, 0.181, 0.127],
        [-0.133 + i * 0.010, 0.103, 0.145], [-0.169 + i * 0.009, -0.019 + i * 0.018, 0.107]],
      0.031, 0.007, i === 1 ? p.highlight : p.hair, 0.6);
    }
  }
}

function makeFace(head: THREE.Group, vlad: boolean, p: Palette): THREE.Group[] {
  const cheeks = vlad ? 0.167 : 0.173;
  sculpt(head, loft([
    [-0.227, 0.049, 0.051, 0.035], [-0.184, vlad ? 0.100 : 0.096, 0.103, 0.021],
    [-0.128, vlad ? 0.137 : 0.131, 0.128, 0.008], [-0.064, cheeks, 0.145, 0.003],
    [0.010, cheeks, 0.146, 0], [0.100, 0.17, 0.140, -0.004],
    [0.175, 0.113, 0.105, -0.017], [0.207, 0.002, 0.002, -0.017],
  ], 28, 25, (x, y, z, a) => {
    const front = Math.max(0, Math.cos(a));
    const bridge = Math.exp(-((x / 0.033) ** 2) - (((y + 0.043) / 0.072) ** 2));
    const tip = Math.exp(-((x / 0.041) ** 2) - (((y + 0.066) / 0.024) ** 2));
    const mouth = Math.exp(-((x / 0.072) ** 2) - (((y + 0.128) / 0.027) ** 2));
    return [x, y, z + front * ((vlad ? 0.044 : 0.033) * bridge + 0.021 * tip + 0.012 * mouth)];
  }), p.skin, 'skin');
  makeHair(head, vlad, p);

  const eyes: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    oval(head, p.skin, [side * 0.163, -0.061, -0.001], [0.036, 0.055, 0.027]).rotation.z = -side * 0.21;
    oval(head, p.cheek, [side * 0.178, -0.063, 0.020], [0.015, 0.031, 0.010]);
    const x = side * (vlad ? 0.069 : 0.072);
    const eye = new THREE.Group();
    eye.position.set(x, vlad ? 0.010 : 0.006, 0.132);
    eye.rotation.set(0, side * 0.27, side * (vlad ? 0.06 : 0.10));
    const width = vlad ? 0.039 : 0.043;
    const height = vlad ? 0.018 : 0.023;
    oval(eye, p.cheek, [0, 0.001, -0.002], [width + 0.006, height + 0.007, 0.010]);
    oval(eye, 0xf1e8dc, [0, 0, 0.004], [width, height, 0.011]);
    oval(eye, p.iris, [0.002, 0, 0.014], [height * 0.80, height * 0.87, 0.007]);
    oval(eye, 0x282623, [0.003, 0, 0.020], [height * 0.40, height * 0.59, 0.004]);
    oval(eye, 0xffece0, [-0.003, 0.005, 0.023], [0.004, 0.004, 0.002]);
    sculptedCurve(eye, [[-width, -0.003, 0.006], [-width * 0.53, height * 0.72, 0.014],
      [0.003, height, 0.017], [width * 0.62, height * 0.57, 0.014], [width, -0.004, 0.006]],
    vlad ? 0.005 : 0.007, 0.004, p.eyebrow, 0.83);
    batchRigidParts(eye);
    head.add(eye);
    eyes.push(eye);
    sculptedCurve(head, [[x - side * 0.040, 0.056, 0.142], [x, vlad ? 0.061 : 0.069, 0.136],
      [x + side * 0.035, 0.051, 0.107]], vlad ? 0.011 : 0.008, 0.004, p.eyebrow, 0.7);
    if (!vlad) oval(head, colors.brass, [side * 0.177, -0.111, 0.022], [0.010, 0.013, 0.010], 'metal');
  }

  const smile = vlad ? -0.127 : -0.119;
  sculptedCurve(head, [[-0.041, smile, 0.132], [-0.024, -0.136, 0.144],
    [0, -0.138, 0.148], [0.024, -0.134, 0.144], [0.040, smile + 0.003, 0.131]],
  0.0035, 0.0035, p.lip, 0.9);
  oval(head, p.cheek, [0, -0.150, 0.145], [0.024, 0.006, 0.005]);
  batchRigidParts(head);
  return eyes;
}

export function buildCharacterArt(figure: THREE.Group, id: CharacterId, joints: Pivots): CharacterRig {
  const vlad = id === 'vlad';
  const p = paletteFor(vlad);
  const shoulderY = vlad ? 1.428 : 1.367;
  const hip = vlad ? 0.905 : 0.852;
  const neck = vlad ? 1.503 : 1.454;
  const chest = new THREE.Group();
  figure.add(chest);
  const jacket = new THREE.Color(p.outer), shirt = new THREE.Color(p.inner);
  const torso = loft([
    [hip - 0.061, 0.168, 0.107], [hip + 0.015, 0.200, 0.133],
    [hip + 0.17, vlad ? 0.209 : 0.181, 0.121, -0.013],
    [shoulderY - 0.14, vlad ? 0.233 : 0.205, 0.141, 0.010],
    [shoulderY - 0.025, vlad ? 0.239 : 0.208, 0.119, 0.004],
    [shoulderY + 0.042, 0.160, 0.091], [neck, 0.090, 0.071],
  ], 24, 22, undefined, (color, a, y) => {
    // The narrow T-shirt opening is dyed into the continuous garment surface.
    const open = 0.28 + 0.58 * THREE.MathUtils.smoothstep(y, shoulderY - 0.07, neck);
    const seam = 1 - THREE.MathUtils.smoothstep(Math.abs(Math.sin(a)), open - 0.085, open + 0.018);
    color.copy(jacket).lerp(shirt, Math.cos(a) > 0 ? seam : 0);
  });
  sculpt(chest, torso, 0xffffff, 'fabric');
  sculpt(chest, loft([[neck - 0.022, 0.080, 0.073], [neck + 0.045, 0.068, 0.064],
    [neck + 0.131, 0.086, 0.083]], 16, 9), p.skin, 'skin');
  for (const side of [-1, 1]) {
    sculptedCurve(chest, [[side * 0.086, neck, 0.054], [side * 0.142, shoulderY - 0.021, 0.098],
      [side * 0.107, shoulderY - 0.167, 0.132], [side * 0.063, hip + 0.029, 0.13]],
    0.019, 0.012, p.lining, 0.48);
    if (vlad) {
      sculptedCurve(chest, [[side * 0.069, hip + 0.13, 0.133], [side * 0.125, hip + 0.143, 0.125],
        [side * 0.174, hip + 0.17, 0.091]], 0.010, 0.008, p.lining, 0.63);
    }
  }
  batchRigidParts(chest);

  const head = new THREE.Group();
  head.position.set(0, neck + 0.260, 0.030);
  chest.add(head);
  const eyes = makeFace(head, vlad, p);

  const thighLength = hip * 0.45;
  const shinLength = hip - thighLength - 0.084;
  const upperArm = vlad ? 0.296 : 0.270;
  const lowerArm = vlad ? 0.304 : 0.284;
  const knees: THREE.Bone[] = [], elbows: THREE.Bone[] = [];
  sculpt(figure, loft([[hip - 0.105, 0.161, 0.094], [hip - 0.045, 0.195, 0.122],
    [hip + 0.093, 0.176, 0.110]], 18, 10), p.pant, 'fabric');
  const leg = loft([
    [-thighLength - shinLength - 0.014, 0.065, 0.067],
    [-thighLength - shinLength + 0.038, 0.072, 0.071],
    [-thighLength - 0.14, 0.083, 0.090, -0.017],
    [-thighLength, 0.081, 0.083, 0.006],
    [-0.21, 0.100, 0.107, -0.005], [-0.045, 0.107, 0.113, -0.007],
    [0.043, 0.101, 0.102, -0.009], [0.081, 0.068, 0.075],
  ], 14, 20);
  const shoe = loft([
    [-shinLength - 0.084, 0.077, 0.130, 0.044], [-shinLength - 0.055, 0.088, 0.150, 0.050],
    [-shinLength + 0.004, 0.082, 0.145, 0.045], [-shinLength + 0.06, 0.065, 0.076],
  ], 18, 13, undefined, (color, _a, y) => color.set(y < -shinLength - 0.053 ? p.soles : p.shoes));

  const sleeve = loft([
    [-upperArm - lowerArm + 0.036, 0.041, 0.042],
    [-upperArm - lowerArm + 0.074, 0.048, 0.047],
    [-upperArm - 0.11, 0.063, 0.058, 0.006], [-upperArm, 0.061, 0.064],
    [-0.127, 0.074, 0.075], [-0.025, 0.091, 0.089], [0.064, 0.077, 0.071],
    [0.104, 0.036, 0.038],
  ], 14, 20);
  const hand = loft([
    [-lowerArm - 0.097, 0.027, 0.017, 0.011], [-lowerArm - 0.065, 0.042, 0.027, 0.006],
    [-lowerArm - 0.012, 0.045, 0.032], [-lowerArm + 0.040, 0.039, 0.035],
  ], 14, 12);

  for (const [side, group] of [[-1, joints.leftLeg], [1, joints.rightLeg]] as const) {
    group.position.set(side * 0.111, hip, 0);
    figure.add(group);
    const knee = hingedLimb(group, leg, -thighLength, p.pant, 'fabric');
    sculpt(knee, shoe, 0xffffff, 'ceramic');
    knees.push(knee);
  }
  for (const [side, group] of [[-1, joints.leftArm], [1, joints.rightArm]] as const) {
    group.position.set(side * (vlad ? 0.233 : 0.204), shoulderY - 0.039, 0);
    chest.add(group);
    const elbow = hingedLimb(group, sleeve, -upperArm, p.outer, 'fabric');
    sculpt(elbow, hand, p.skin, 'skin');
    oval(elbow, p.skin, [-side * 0.035, -lowerArm - 0.026, 0.027],
      [0.018, 0.041, 0.021]).rotation.z = side * 0.31;
    elbows.push(elbow);
  }
  return { chest, head, eyes, elbows, knees, waistY: hip - 0.061,
    thighLength, shinLength, shoulderY: shoulderY - 0.039, upperArm, lowerArm };
}
