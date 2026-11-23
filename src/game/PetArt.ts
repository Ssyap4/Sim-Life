import * as THREE from 'three';
import { batchRigidParts, finish, orb, sculptedCurve } from './ArtKit';
import { makeEye } from './EyeArt';
import { loft, sculpt } from './SculptMesh';
import type { PetId } from '../shared/pets';

// Simba is a lean short-haired ginger tabby based on his real photographs.
const ginger = new THREE.Color(0xdd995d);
const honey = new THREE.Color(0xeab175);
const cream = new THREE.Color(0xedb576);
const amber = new THREE.Color(0xb77442);
const soot = new THREE.Color(0x28252b);
const silver = new THREE.Color(0x635d65);
const charcoal = 0x322d34;

export const verdellScale = .68;
export const simbaScale = .86;

type PetRig = {
  ears: THREE.Group[];
  eyes: THREE.Group[];
  jaw: THREE.Group;
  back?: THREE.Mesh;
};

function detail(parent: THREE.Group, color: number, position: THREE.Vector3Tuple,
  size: THREE.Vector3Tuple, gloss = false): THREE.Mesh {
  const mesh = new THREE.Mesh(orb, finish(color, gloss ? 'screen' : 'skin'));
  mesh.position.set(...position);
  mesh.scale.set(...size);
  parent.add(mesh);
  return mesh;
}

function paws(body: THREE.Group, dog: boolean): THREE.Group[] {
  const result: THREE.Group[] = [];
  for (const side of [-1, 1]) for (const back of [false, true]) {
    const pivot = new THREE.Group();
    const base = dog ? (back ? .268 : .225) : back ? .27 : .245;
    const end = dog ? 0.074 : 0.045;
    const toes = dog ? .102 : .082;
    const leg = loft([
      [-base, end, toes * .82, 0.043], [-base + 0.025, end * 1.11, toes, 0.044],
      [-base + 0.068, end, toes * .83, 0.025], [-0.085, end * 0.85, toes * .70, -0.017],
      [-0.027, back ? end * 1.37 : end, back ? 0.142 : 0.085], [0.14, end * 1.30, back ? 0.125 : 0.083],
    ], 12, 15, (x, y, z) => {
      const shoulder = dog ? 0 : THREE.MathUtils.smoothstep(y, -0.055, 0.13);
      const toe = Math.sin(x * (dog ? 96 : 122)) ** 2 *
        (1 - THREE.MathUtils.smoothstep(y, -base + 0.014, -base + 0.051));
      return [x * (1 - 0.20 * shoulder) - side * 0.043 * shoulder, y,
        z - Math.max(0, z - 0.057) * toe * 0.13];
    }, (color, a, y) => {
      if (dog) color.copy(soot).lerp(silver, 0.17 + 0.14 * Math.cos(a));
      else color.copy(ginger).lerp(cream, 0.5 * (1 - THREE.MathUtils.smoothstep(y, -0.22, -0.14)))
        .lerp(amber, (0.5 + 0.5 * Math.cos(y * 77)) ** 6 * THREE.MathUtils.smoothstep(y, -0.2, -0.09) * 0.42);
    });
    sculpt(pivot, leg, 0xffffff, 'fur', back);
    const spacing = dog ? .16 : back ? .109 : .094;
    const along = dog ? (back ? -.32 : .24) : (back ? -.395 : .285);
    pivot.position.set(side * spacing, base, along);
    body.add(pivot);
    result.push(pivot);
  }
  return result;
}

function ear(head: THREE.Group, side: number, dog: boolean): THREE.Group {
  const pivot = new THREE.Group();
  const height = dog ? 0.126 : 0.172;
  const width = dog ? 0.084 : 0.078;
  const outside = dog ? soot : ginger;
  const inner = new THREE.Color(dog ? 0x75636c : 0xd18974);
  const shape = loft([
    [-0.044, width * 0.91, 0.056, -0.023], [0.021, width, 0.053, -0.014],
    [height * 0.55, width * 0.59, 0.035, -0.008], [height * 0.91, 0.015, 0.013], [height, 0.002, 0.004],
  ], 14, 14, (x, y, z, a) => [x, y, z - Math.max(0, Math.cos(a)) ** 4 * 0.023 * Math.sin(Math.PI * Math.max(0, y / height))],
  (color, a, y) => color.copy(outside).lerp(inner,
    THREE.MathUtils.smoothstep(Math.cos(a), 0.43, 0.85) * THREE.MathUtils.smoothstep(y, -0.003, 0.045) *
    (1 - THREE.MathUtils.smoothstep(y, height * 0.76, height * 0.94))));
  sculpt(pivot, shape, 0xffffff, 'fabric', !dog);
  pivot.position.set(side * (dog ? 0.192 : 0.132), dog ? 0.187 : 0.148, -0.059);
  pivot.rotation.z = side * (dog ? -0.235 : -0.19);
  head.add(pivot);
  return pivot;
}

function petEyes(head: THREE.Group, dog: boolean): THREE.Group[] {
  return [-1, 1].map((side) => {
    const eye = new THREE.Group();
    eye.position.set(side * (dog ? 0.109 : 0.092), dog ? 0.034 : 0.026, dog ? 0.192 : 0.171);
    eye.rotation.set(0, side * (dog ? 0.47 : 0.48), side * (dog ? 0.10 : 0.16));
    makeEye(eye, dog ? 0.037 : 0.042, dog ? 0.027 : 0.027, dog ? 0.016 : 0.015,
      dog ? { iris: '#866747', edge: '#40343a', white: '#907c75', pupil: 0.60 }
        : { iris: '#8fa16c', edge: '#5b6b42', white: '#b1ab76', pupil: 0.27 });
    head.add(eye);
    return eye;
  });
}

function spitz(body: THREE.Group, head: THREE.Group, tail: THREE.Group, jaw: THREE.Group): void {
  // The low-cost coat has a clear waist and narrower shoulders. The previous
  // almost spherical 0.96-high ruff swallowed the paws/head in mobile shots.
  // Keep the fluffy chest, but leave a readable neck and four walking legs.
  const fur = loft([
    [0.123, 0.181, 0.278, -0.127], [0.179, 0.238, 0.344, -0.10],
    [0.33, 0.282, 0.406, -0.067], [0.48, 0.301, 0.422, -0.039],
    [0.62, 0.302, 0.395, 0.029], [0.74, 0.240, 0.297, 0.093],
    [0.835, 0.134, 0.154, 0.163], [0.876, 0.004, 0.004, 0.196],
  ], 36, 30, (x, y, z, a) => {
    const chest = Math.max(0, Math.cos(a));
    const taper = Math.sin(Math.PI * THREE.MathUtils.smoothstep(y, 0.14, 0.94));
    const ridge = (0.5 + 0.5 * Math.cos(a * 10 + y * 4 + Math.sin(a * 3) * 1.1)) ** 3;
    const fold = taper * (0.55 + 0.45 * chest) * (ridge * 0.030 + Math.sin(a * 17 - y * 29) * 0.008);
    const rump = THREE.MathUtils.smoothstep(-z, .04, .48) * .085;
    return [x + Math.sin(a) * fold, y + rump - ridge * taper * .024, z + Math.cos(a) * fold];
  }, (color, a, y) => {
    const ridge = (0.5 + 0.5 * Math.cos(a * 10 + y * 4 + Math.sin(a * 3) * 1.1)) ** 3;
    const front = Math.max(0, Math.cos(a));
    const ruff = (0.65 + 0.35 * front) * Math.sin(Math.PI * THREE.MathUtils.smoothstep(y, 0.18, 0.95));
    color.copy(soot).lerp(silver, 0.13 + 0.23 * ruff + ridge * ruff * 0.34);
  });
  sculpt(body, fur, 0xffffff, 'fur');
  // Keep the continuous low-cost coat, but restore a few swept guard-hair
  // silhouettes so the compact black Spitz reads as fluffy in close-ups.
  // The roots sit inside the coat; tips are narrow and never touch the tail.
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const x = side * (0.067 + i * 0.069);
    sculptedCurve(body, [
      [x * 0.76, 0.77 - i * 0.018, 0.32 - i * 0.026],
      [x * 0.95, 0.61 - i * 0.010, 0.45 - i * 0.044],
      [x * 1.08, 0.42 + i * 0.015, 0.44 - i * 0.044],
      [x * 1.18, 0.27 + i * 0.021, 0.325 - i * 0.037],
    ], 0.033, 0.004, i % 2 ? 0x554b55 : 0x48404a, 0.72, true, undefined, 'fur');
  }
  sculpt(head, loft([
    [-0.18, 0.109, 0.117, 0.049], [-0.125, 0.192, 0.173, 0.088],
    [-0.052, 0.225, 0.202, 0.043], [0.053, 0.238, 0.204, 0.011],
    [0.151, 0.202, 0.168, -0.016], [0.228, 0.122, 0.111, -0.039], [0.263, 0.002, 0.002, -0.036],
  ], 24, 22, (x, y, z, a) => {
    const rim = 1 + 0.032 * Math.cos(a * 13 + y * 38);
    const muzzle = Math.exp(-((x / 0.083) ** 2) - (((y + 0.087) / 0.043) ** 2));
    return [x * rim, y, z + Math.max(0, Math.cos(a)) ** 3 * muzzle * 0.086];
  }, (color, a, y) => color.copy(soot).lerp(silver,
    0.19 + 0.49 * Math.max(0, Math.cos(a)) * (1 - THREE.MathUtils.smoothstep(y, -0.12, 0.08)))), 0xffffff, 'fur');
  detail(head, 0x211d20, [0, -0.067, 0.314], [0.043, 0.025, 0.024], true);
  detail(head, 0x161417, [0, -0.103, 0.278], [0.054, 0.014, 0.036]);
  detail(jaw, 0x272128, [0, -0.124, 0.247], [0.078, 0.037, 0.055]);
  // Spitz's fluffy curled tail now rises above the rump instead of being
  // buried as a tiny dark stump behind the coat. Same cheap swept mesh.
  sculptedCurve(tail, [[0, 0.018, 0.045], [0.018, 0.155, -0.060],
    [0.056, 0.300, -0.132], [0.096, 0.366, -0.058],
    [0.066, 0.304, 0.045]], 0.065, 0.014, charcoal, 0.72, true, undefined, 'fur');
}

function tabby(body: THREE.Group, head: THREE.Group, tail: THREE.Group, jaw: THREE.Group): THREE.Mesh {
  const torso = loft([
    [-.72, .012, .025, -.465], [-.655, .082, .096, -.461],
    [-.508, .117, .145, -.486], [-.32, .094, .113, -.496],
    [-.04, .084, .118, -.488], [.214, .114, .155, -.468],
    [.39, .101, .132, -.491], [.55, .060, .091, -.526], [.64, .019, .031, -.541],
  ], 28, 37, (x, y, z, a) => {
    const shoulder = Math.exp(-(((y - .250) / .15) ** 2)) * Math.sin(a) ** 2;
    return [x * (1 + shoulder * .03), y, z - shoulder * .014];
  }, (color, a, z) => {
    const belly = Math.cos(a);
    // Thin, broken ginger-on-ginger stripes instead of bold black tabby rings.
    const wave = Math.sin((z + .72) * 37 + 1.9 * Math.sin(a * 3 + z * 5));
    const stripe = THREE.MathUtils.smoothstep(wave, .55, .88)
      * (1 - THREE.MathUtils.smoothstep(belly, .26, .94));
    color.copy(ginger).lerp(honey, .30)
      .lerp(cream, THREE.MathUtils.smoothstep(belly, .30, .97) * .52)
      .lerp(amber, stripe * .37);
  });
  torso.rotateX(Math.PI / 2);
  const positions = torso.getAttribute('position');
  const arch: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    arch.push(0, Math.exp(-((positions.getZ(i) / .34) ** 2)) * 0.041, 0);
  }
  torso.morphAttributes.position = [new THREE.Float32BufferAttribute(arch, 3)];
  torso.morphTargetsRelative = true;
  const back = sculpt(body, torso, 0xffffff, 'fur');
  const face = loft([
    [-0.169, 0.048, 0.064, 0.032], [-0.129, 0.108, 0.105, 0.071],
    [-0.074, 0.146, 0.143, 0.075], [0.004, 0.168, 0.161, 0.012],
    [0.095, 0.166, 0.154, 0.007], [0.178, 0.129, 0.114, -0.020], [0.212, 0.002, 0.002, -0.015],
  ], 30, 24, (x, y, z, a) => {
    const whiskerPad = Math.exp(-(((Math.abs(x) - 0.041) / 0.052) ** 2) - (((y + 0.084) / 0.038) ** 2));
    const socket = Math.exp(-(((Math.abs(x) - 0.114) / 0.056) ** 2) - (((y - 0.025) / 0.034) ** 2));
    return [x, y, z + Math.max(0, Math.cos(a)) * (0.022 * whiskerPad - 0.009 * socket)];
  }, (color, a, y) => {
    const front = Math.max(0, Math.cos(a));
    const faceStripe = 0.5 + 0.5 * Math.cos(a * 17 - Math.sin(y * 18) * 1.8);
    const cheekStripe = 0.5 + 0.5 * Math.sin(y * 89 + Math.abs(Math.sin(a)) * 7);
    color.copy(ginger).lerp(honey, 0.27)
      .lerp(amber, front * THREE.MathUtils.smoothstep(y, 0.038, 0.13) * faceStripe ** 4 * .38)
      .lerp(amber, (1 - front ** 2) * cheekStripe ** 5 * .22)
      .lerp(cream, (1 - THREE.MathUtils.smoothstep(y, -.132, -.065)) * front ** 2 * .53);
  });
  sculpt(head, face, 0xffffff, 'fur');
  // Simba's old 3D nose was an ellipsoid poking out of his fine muzzle.
  // Draw a flat, small cat-nose triangle against the head's surface instead:
  // zero spherical geometry, no ball silhouette at any viewing angle.
  const noseShape=new THREE.Shape();
  noseShape.moveTo(-.022,-.083);
  noseShape.lineTo(.022,-.083);
  noseShape.lineTo(0,-.102);
  noseShape.closePath();
  const nose=new THREE.Mesh(new THREE.ShapeGeometry(noseShape),
    new THREE.MeshBasicMaterial({color:0xb77769,side:THREE.DoubleSide}));
  nose.position.z=.220;
  head.add(nose);
  sculptedCurve(jaw, [[-.039,-.111,.208],[-.017,-.117,.216],[0,-.113,.218],
    [.017,-.117,.216],[.039,-.111,.208]], .0025,.0025,0x926c56,.84);

  const lines: number[] = [];
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const start: THREE.Vector3Tuple = [side * 0.062, -0.100 - i * 0.008, 0.236 - i * 0.009];
    const middle: THREE.Vector3Tuple = [side * 0.165, -0.092 - i * 0.020, 0.286 - i * 0.016];
    const end: THREE.Vector3Tuple = [side * (0.298 + i * 0.008), -0.068 - i * 0.042, 0.23 - i * 0.014];
    lines.push(...start, ...middle, ...middle, ...end);
  }
  const whiskers = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  head.add(new THREE.LineSegments(whiskers, new THREE.LineBasicMaterial({ color: 0xffe6c2 })));
  sculptedCurve(tail, [[0, 0.004, 0.065], [0.04, 0.14, -0.20], [0.13, 0.33, -0.34],
    [0.15, 0.52, -0.41], [0.11, 0.68, -0.40], [0.035, 0.75, -0.38]],
  .037, .008, 0xe6a26b, 0.94, true, 0xcd8853, 'fur');
  return back;
}

export function buildPetArt(body: THREE.Group, head: THREE.Group, tail: THREE.Group,
  feet: THREE.Group[], id: PetId): PetRig {
  const dog = id === 'verdell';
  const jaw = new THREE.Group();
  head.add(jaw);
  const back = dog ? undefined : tabby(body, head, tail, jaw);
  if (dog) spitz(body, head, tail, jaw);
  feet.push(...paws(body, dog));
  const ears = [-1, 1].map(side => ear(head, side, dog));
  const eyes = petEyes(head, dog);
  for (const part of [head, body, jaw]) batchRigidParts(part);
  return { ears, eyes, jaw, back };
}
