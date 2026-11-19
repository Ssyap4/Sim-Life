import * as THREE from 'three';
import { batchRigidParts, colors, finish, orb, sculptedCurve } from './ArtKit';
import { makeEye } from './EyeArt';
import { hingedLimb, loft, sculpt } from './SculptMesh';
import type { CharacterId } from '../shared/protocol';

export type Pivots = {
  leftLeg: THREE.Object3D; rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D; rightArm: THREE.Object3D;
};

export type CharacterRig = {
  chest: THREE.Object3D;
  head: THREE.Object3D;
  eyes: readonly THREE.Object3D[];
  hair: THREE.Object3D;
  wrists: readonly THREE.Object3D[];
  elbows: readonly THREE.Object3D[];
  knees: readonly THREE.Object3D[];
  ankles: readonly THREE.Object3D[];
  waistY: number;
  thighLength: number;
  shinLength: number;
  upperArm: number;
  lowerArm: number;
  animateFace?: (dt: number, asleep: boolean) => void;
};

export type CharacterModel = (figure: THREE.Group) => { rig: CharacterRig; joints: Pivots };

type Palette = ReturnType<typeof paletteFor>;
function paletteFor(vlad: boolean) {
  return vlad ? {
    skin: 0xdca789, cheek: 0xc58776, lip: 0x95564d,
    hair: 0x291f20, highlight: 0x513d33, eyebrow: 0x47362f, iris: '#60736b',
    outer: 0x526b63, lining: 0x364f49, inner: 0xf0e9d8, pant: 0x444f5b,
    shoes: 0xa58a70, soles: 0xe9d7c1,
  } : {
    skin: 0xe9b79b, cheek: 0xcd907f, lip: 0x9f5855,
    hair: 0x987050, highlight: 0xddbc87, eyebrow: 0x7a5e49, iris: '#758263',
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

function makeHair(head: THREE.Group, vlad: boolean, p: Palette): THREE.Group {
  const ends = new THREE.Group();
  head.add(ends);
  const root = new THREE.Color(p.hair);
  const sunlit = new THREE.Color(p.highlight);
  const direction = (a: number, y: number) => a * 10 + y * (vlad ? 23 : 15) + Math.sin(a - y * 5) * 1.7;
  const crown = loft([
    [0, 0.178, 0.151, -0.007], [0.044, 0.198, 0.173, -0.011],
    [0.113, 0.191, 0.174, -0.013], [0.172, 0.158, 0.153, -0.012],
    [0.219, 0.100, 0.103, -0.020], [vlad ? 0.240 : 0.251, 0.003, 0.002, -0.027],
  ], 36, 19, (x, y, z, a) => {
    const front = THREE.MathUtils.smoothstep(Math.cos(a), -0.30, 0.48);
    const hairline = THREE.MathUtils.lerp(vlad ? -0.086 : -0.117, 0.069 + 0.026 * Math.sin(a * 2 + 0.7), front);
    const strand = Math.cos(direction(a, y));
    const taper = Math.sin(Math.PI * THREE.MathUtils.smoothstep(y, 0.01, 0.248));
    const ridge = 0.008 * taper * strand;
    return [x + Math.sin(a) * ridge + 0.009 * taper, y + hairline * (1 - y / 0.251) ** 1.9,
      z + Math.cos(a) * ridge];
  }, (color, a, y) => color.copy(root).lerp(sunlit,
    0.16 + (0.5 + 0.5 * Math.cos(direction(a, y))) ** 2 * (vlad ? 0.42 : 0.53) + 0.11 * y / 0.25));
  sculpt(head, crown, 0xffffff, 'hair');

  if (vlad) {
    // Two swept tips meet the scalp behind the side part.
    for (const x of [-0.041, 0.016]) {
      sculptedCurve(head, [[x + 0.037, 0.177, -0.076], [x + 0.047, 0.224, 0.022],
        [x + 0.011, 0.191, 0.115], [x - 0.069, 0.106, 0.154]],
      0.025, 0.0025, 0x3c2c29, 0.57, false, undefined, 'hair');
    }
  } else {
    const drape = loft([
      [-0.468, 0.105, 0.034, -0.139], [-0.404, 0.179, 0.059, -0.132],
      [-0.28, 0.217, 0.085, -0.127], [-0.107, 0.211, 0.121, -0.102],
      [0.084, 0.189, 0.130, -0.080], [0.188, 0.083, 0.084, -0.057],
    ], 32, 23, (x, y, z, a) => {
      const wave = Math.cos(a * 7 + Math.sin(y * 10) * 1.8);
      return [x + 0.021 * Math.sin(y * 9) + Math.sin(a) * 0.013 * wave,
        y + (0.017 + 0.015 * Math.max(0, -y * 2)) * Math.sin(a * 3), z + Math.cos(a) * 0.013 * wave];
    }, (color, a, y) => color.copy(root).lerp(sunlit,
      0.26 + 0.47 * (0.5 + 0.5 * Math.cos(a * 7 + Math.sin(y * 10) * 1.8)) ** 2));
    sculpt(ends, drape, 0xffffff, 'hair');
    for (const side of [-1, 1]) {
      const x = side * 0.166;
      sculptedCurve(ends, [[x * 0.43, 0.206, 0], [x * 0.94, 0.125, 0.094],
        [x * 1.11, -0.065, 0.079], [x * 1.21, -0.211, 0.097], [x * 1.13, -0.394, 0.004]],
      0.051, 0.006, 0xc8a16d, 0.70, false, undefined, 'hair');
    }
    sculptedCurve(head, [[0.063, 0.219, 0.045], [-0.034, 0.182, 0.140],
      [-0.119, 0.117, 0.153], [-0.166, 0.012, 0.108]], 0.040, 0.004, 0xb88d5f, 0.61, false, undefined, 'hair');
    batchRigidParts(ends);
  }
  return ends;
}

function makeFace(head: THREE.Group, vlad: boolean, p: Palette): THREE.Group[] {
  const cheeks = vlad ? 0.161 : 0.172;
  const skin = new THREE.Color(p.skin), warmth = new THREE.Color(p.cheek);
  const lip = new THREE.Color(p.lip);
  sculpt(head, loft([
    [-0.227, 0.047, 0.051, 0.033], [-0.184, vlad ? 0.089 : 0.096, 0.097, 0.021],
    [-0.134, vlad ? 0.131 : 0.126, 0.121, 0.013], [-0.066, cheeks, 0.143, 0.001],
    [0.010, cheeks, 0.146, 0], [0.100, 0.17, 0.140, -0.004],
    [0.175, 0.113, 0.105, -0.017], [0.207, 0.002, 0.002, -0.017],
  ], 36, 28, (x, y, z, a) => {
    const front = Math.max(0, Math.cos(a));
    const bridge = Math.exp(-((x / 0.029) ** 2) - (((y + 0.031) / 0.063) ** 2));
    const tip = Math.exp(-((x / 0.032) ** 2) - (((y + 0.068) / 0.020) ** 2));
    const wing = Math.exp(-(((Math.abs(x) - 0.025) / 0.015) ** 2) - (((y + 0.077) / 0.013) ** 2));
    const mouth = Math.exp(-((x / 0.059) ** 2) - (((y + 0.126) / 0.030) ** 2));
    const cheekbone = Math.exp(-(((Math.abs(x) - 0.099) / 0.035) ** 2) - (((y + 0.035) / 0.045) ** 2));
    const socket = Math.exp(-(((Math.abs(x) - 0.071) / 0.045) ** 2) - (((y - 0.014) / 0.031) ** 2));
    const jaw = Math.exp(-(((y + 0.181) / 0.043) ** 2)) * Math.sin(a) ** 2;
    return [x + (vlad ? 0.035 : 0.018) * x * jaw, y,
      z + front * ((vlad ? 0.048 : 0.034) * bridge + 0.022 * tip + 0.013 * wing
        + 0.014 * mouth + 0.012 * cheekbone - 0.021 * socket)];
  }, (color, a, y) => {
    const front = Math.max(0, Math.cos(a));
    const cheeks = Math.exp(-(((y + 0.067) / 0.043) ** 2)) * Math.sin(a * 2) ** 2;
    const lipTint = Math.exp(-((Math.sin(a) / 0.30) ** 2) - (((y + 0.132) / 0.020) ** 2)) * front;
    color.copy(skin).lerp(warmth, cheeks * front * (vlad ? 0.38 : 0.60))
      .lerp(lip, lipTint * (vlad ? 0.30 : 0.47));
  }), 0xffffff, 'skin');

  const eyes: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    oval(head, p.skin, [side * 0.163, -0.061, -0.001], [0.036, 0.055, 0.027]).rotation.z = -side * 0.21;
    oval(head, p.cheek, [side * 0.178, -0.063, 0.020], [0.015, 0.031, 0.010]);
    const x = side * (vlad ? 0.069 : 0.072);
    const eye = new THREE.Group();
    eye.position.set(x, vlad ? 0.012 : 0.008, 0.121);
    eye.rotation.set(0, side * 0.27, side * (vlad ? 0.06 : 0.10));
    makeEye(eye, vlad ? 0.038 : 0.040, vlad ? 0.016 : 0.019, 0.017, {
      iris: p.iris, edge: vlad ? '#503630' : '#63413a', white: '#eee1d4', pupil: 0.48, human: true,
    });
    head.add(eye);
    eyes.push(eye);
    sculptedCurve(head, [[x - side * 0.040, 0.055, 0.146], [x, vlad ? 0.060 : 0.067, 0.135],
      [x + side * 0.034, 0.050, 0.111]], vlad ? 0.008 : 0.006, 0.0018, p.eyebrow, 0.62);
    if (!vlad) oval(head, colors.brass, [side * 0.177, -0.111, 0.022], [0.010, 0.013, 0.010], 'metal');
  }

  const smile = vlad ? -0.127 : -0.119;
  sculptedCurve(head, [[-0.034, smile, 0.135], [-0.021, -0.133, 0.143],
    [0, -0.135, 0.151], [0.021, -0.132, 0.144], [0.034, smile + 0.002, 0.136]],
  0.0025, 0.0014, p.lip, 0.65);
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
  const jacket = new THREE.Color(p.outer), binding = new THREE.Color(p.lining);
  const shirt = new THREE.Color(p.inner), topstitch = new THREE.Color(vlad ? 0xa6b3a0 : 0xc48677);
  const opening = (y: number) => 0.061 + 0.49 * THREE.MathUtils.smoothstep(y, shoulderY - 0.26, neck);
  const torso = loft([
    [hip - 0.063, 0.192, 0.110], [hip - 0.016, 0.210, 0.130],
    [hip + 0.15, vlad ? 0.192 : 0.170, 0.114, -0.011],
    [shoulderY - 0.17, vlad ? 0.227 : 0.205, 0.137, 0.013],
    [shoulderY - 0.054, vlad ? 0.236 : 0.208, 0.126, 0.005],
    [shoulderY + 0.031, 0.175, 0.090], [neck, 0.088, 0.071],
  ], 36, 28, (x, y, z, a) => {
    const panel = Math.sin(a);
    const chest = Math.max(0, Math.cos(a));
    const foldedHem = Math.sin(a * 7 + y * 10) * 0.009 * (1 - THREE.MathUtils.smoothstep(y, hip, hip + 0.16));
    const shoulder = 0.010 * chest * Math.sin(a * 2) ** 2 * Math.exp(-(((y - shoulderY + 0.13) / 0.11) ** 2));
    return [x + panel * foldedHem, y, z + shoulder + Math.cos(a) * foldedHem];
  }, (color, a, y) => {
    const edge = Math.abs(a) - opening(y);
    const face = Math.cos(a) > 0;
    const waistband = 1 - THREE.MathUtils.smoothstep(y, hip - 0.049, hip - 0.013);
    const shoulderSeam = Math.exp(-(((Math.abs(Math.sin(a)) - 0.82) / 0.084) ** 2)
      - (((y - shoulderY + 0.061) / 0.085) ** 2));
    color.copy(jacket).lerp(binding, waistband * 0.73 + Math.max(0, -Math.cos(a)) * 0.11)
      .lerp(topstitch, shoulderSeam * 0.20);
    if (face) {
      color.lerp(binding, Math.exp(-((edge / 0.079) ** 2)) * 0.82);
      color.lerp(shirt, 1 - THREE.MathUtils.smoothstep(edge, -0.020, 0.012));
    }
  }, (a, y) => {
    // Place a column of vertices on the seam all the way from hem to collar.
    const signed = a > Math.PI ? a - Math.PI * 2 : a;
    const distance = Math.abs(signed);
    const seam = Math.PI / 6;
    const open = opening(y);
    return Math.sign(signed) * (distance <= seam ? distance / seam * open
      : open + (distance - seam) / (Math.PI - seam) * (Math.PI - open));
  });
  sculpt(chest, torso, 0xffffff, 'fabric');
  sculpt(chest, loft([[neck - 0.038, 0.089, 0.077, -0.008], [neck + 0.048, 0.064, 0.063, -0.009],
    [neck + 0.146, 0.079, 0.084, 0.013]], 16, 9), p.skin, 'skin');
  for (const side of [-1, 1]) {
    sculptedCurve(chest, [[side * 0.079, neck, 0.057], [side * 0.102, shoulderY - 0.031, 0.099],
      [side * 0.071, shoulderY - 0.137, 0.128], [side * 0.040, shoulderY - 0.203, 0.142]],
    0.019, 0.003, p.lining, 0.66);
    sculptedCurve(chest, [[side * 0.072, hip + 0.103, 0.120], [side * 0.120, hip + 0.130, 0.110],
      [side * 0.161, hip + 0.185, 0.095]], 0.006, 0.003, p.lining, 0.46);
  }
  batchRigidParts(chest);

  const head = new THREE.Group();
  head.position.set(0, neck + 0.260, 0.030);
  chest.add(head);
  const hair = makeHair(head, vlad, p);
  const eyes = makeFace(head, vlad, p);

  const thighLength = hip * 0.45;
  const shinLength = hip - thighLength - 0.084;
  const upperArm = vlad ? 0.296 : 0.270;
  const lowerArm = vlad ? 0.304 : 0.284;
  const knees: THREE.Bone[] = [], elbows: THREE.Bone[] = [];
  const ankles: THREE.Group[] = [], wrists: THREE.Group[] = [];
  const denim = new THREE.Color(p.pant);
  const denimLight = new THREE.Color(vlad ? 0x677986 : 0x7c6a75);
  sculpt(figure, loft([[hip - 0.075, 0.154, 0.087], [hip - 0.023, 0.186, 0.108, -0.013],
    [hip + 0.076, 0.170, 0.111, -0.006]], 20, 10), p.pant, 'fabric', false);
  const trousers = loft([
    [-thighLength - shinLength - 0.025, 0.061, 0.064], [-thighLength - shinLength + 0.031, 0.065, 0.067],
    [-thighLength - 0.16, 0.079, 0.084, -0.020], [-thighLength, 0.074, 0.078, 0.008],
    [-0.20, 0.095, 0.103, -0.010], [-0.050, 0.104, 0.106, -0.011],
    [0.041, 0.080, 0.086, -0.014], [0.091, 0.047, 0.058, -0.014],
  ], 16, 21, (x, y, z, a) => {
    const fold = 0.006 * Math.sin(y * 53 + Math.sin(a * 2)) * Math.exp(-(((y + thighLength) / 0.135) ** 2));
    return [x + Math.sin(a) * fold, y, z + Math.cos(a) * fold];
  }, (color, a) => color.copy(denim).lerp(denimLight, 0.28 * Math.max(0, Math.cos(a)) ** 2));
  const sole = new THREE.Color(p.soles), upperLeather = new THREE.Color(p.shoes);
  const heel = new THREE.Color(p.lining);
  const shoe = loft([
    [-0.083, 0.074, 0.137, 0.041], [-0.067, 0.083, 0.151, 0.046],
    [-0.048, 0.082, 0.145, 0.046], [-0.018, 0.077, 0.137, 0.042],
    [0.023, 0.068, 0.096, 0.014], [0.057, 0.059, 0.069, -0.001],
  ], 20, 14, (x, y, z, a) => [x * (0.90 + 0.10 * Math.cos(a)), y, z], (color, a, y) => {
    const rubber = 1 - THREE.MathUtils.smoothstep(y, -0.064, -0.052);
    const tongue = Math.max(0, Math.cos(a)) ** 8 * THREE.MathUtils.smoothstep(y, -0.043, 0.021);
    color.copy(upperLeather).lerp(heel, tongue * 0.41).lerp(sole, rubber);
  });

  const sleeve = loft([
    [-upperArm - lowerArm + 0.027, 0.041, 0.041], [-upperArm - lowerArm + 0.055, 0.044, 0.045],
    [-upperArm - 0.11, 0.058, 0.053, 0.006], [-upperArm, 0.058, 0.059, -0.001],
    [-0.127, 0.070, 0.071, 0.004], [-0.025, 0.083, 0.079, -0.005], [0.048, 0.069, 0.065],
    [0.102, 0.031, 0.033],
  ], 16, 21, (x, y, z, a) => {
    const crease = 0.005 * Math.sin(y * 69 + Math.cos(a)) * Math.exp(-(((y + upperArm + 0.028) / 0.105) ** 2));
    return [x + Math.sin(a) * crease, y, z + Math.cos(a) * crease];
  }, (color, a, y) => {
    const cuff = 1 - THREE.MathUtils.smoothstep(y, -upperArm - lowerArm + 0.061, -upperArm - lowerArm + 0.080);
    color.copy(jacket).lerp(binding, 0.74 * cuff + 0.10 * Math.max(0, -Math.cos(a)));
  });

  for (const [side, group] of [[-1, joints.leftLeg], [1, joints.rightLeg]] as const) {
    group.position.set(side * 0.111, hip, 0);
    figure.add(group);
    const knee = hingedLimb(group, trousers, -thighLength, 0xffffff, 'fabric');
    const ankle = new THREE.Group();
    ankle.name = side < 0 ? 'leftAnkle' : 'rightAnkle';
    ankle.position.y = -shinLength;
    knee.add(ankle);
    sculpt(ankle, shoe, 0xffffff, 'leather', false);
    knees.push(knee);
    ankles.push(ankle);
  }
  for (const [side, group] of [[-1, joints.leftArm], [1, joints.rightArm]] as const) {
    group.position.set(side * (vlad ? 0.220 : 0.193), shoulderY - 0.039, 0);
    chest.add(group);
    const elbow = hingedLimb(group, sleeve, -upperArm, 0xffffff, 'fabric');
    const wrist = new THREE.Group();
    wrist.name = side < 0 ? 'leftWrist' : 'rightWrist';
    wrist.position.y = -lowerArm;
    elbow.add(wrist);
    const hand = loft([
      [-0.104, 0.019, 0.012, 0.012], [-0.078, 0.034, 0.019, 0.012],
      [-0.046, 0.037, 0.024, 0.003], [-0.011, 0.031, 0.025],
      [0.033, 0.032, 0.029],
    ], 16, 12, (x, y, z) => {
      const thumb = Math.max(0, -side * x / 0.037) ** 2 * Math.exp(-(((y + 0.043) / 0.023) ** 2));
      return [x - side * 0.012 * thumb, y + side * x * 0.16, z + 0.019 * thumb];
    });
    sculpt(wrist, hand, p.skin, 'skin', false);
    wrists.push(wrist);
    elbows.push(elbow);
  }
  return { chest, head, eyes, hair, wrists, elbows, knees, ankles, waistY: hip - 0.061,
    thighLength, shinLength, upperArm, lowerArm };
}
