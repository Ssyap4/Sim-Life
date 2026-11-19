import * as THREE from 'three';
import { PETS, type PetAction, type PetId } from '../shared/pets';

const unitBall = new THREE.SphereGeometry(1, 12, 9);
const unitTuft = new THREE.IcosahedronGeometry(1, 1);
const unitCone = new THREE.ConeGeometry(1, 1, 7);
const materialCache = new Map<number, THREE.MeshStandardMaterial>();
function material(color: number): THREE.MeshStandardMaterial {
  let mat = materialCache.get(color);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
    materialCache.set(color, mat);
  }
  return mat;
}
function ball(
  parent: THREE.Object3D, position: [number, number, number],
  scale: [number, number, number], color: number, fluffy = false,
): THREE.Mesh {
  const mesh = new THREE.Mesh(fluffy ? unitTuft : unitBall, material(color));
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = Math.max(...scale) >= 0.28;
  parent.add(mesh);
  return mesh;
}
function cone(
  parent: THREE.Object3D, pos: [number, number, number], radius: number,
  height: number, color: number, tilt = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(unitCone, material(color));
  mesh.position.set(...pos);
  mesh.scale.set(radius, height, radius);
  mesh.rotation.z = tilt;
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export class PetActor {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly tail = new THREE.Group();
  private readonly paws: THREE.Group[] = [];
  private readonly home: THREE.Vector3;
  private clock = 0;
  private reaction: PetAction | null = null;
  private reactionTime = 0;

  constructor(readonly id: PetId) {
    this.home = new THREE.Vector3(PETS[id].home.x, 0, PETS[id].home.z);
    this.root.position.copy(this.home);
    this.root.add(this.body);
    const dog = id === 'verdell';
    if (dog) this.createSpitz();
    else this.createCat();

    // Both models face the viewer/front of the room by default.
    this.body.add(this.head, this.tail);
    this.head.position.set(0, dog ? 0.69 : 0.60, dog ? 0.30 : 0.34);
    this.tail.position.set(0, dog ? 0.55 : 0.42, dog ? -0.39 : -0.43);
    this.root.scale.setScalar(dog ? 1 : 0.95);
  }

  private leg(x: number, z: number, fur: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0.29, z);
    ball(group, [0, -0.11, 0], [0.115, 0.19, 0.115], fur);
    ball(group, [0, -0.245, 0.06], [0.14, 0.095, 0.17], fur);
    this.body.add(group);
    this.paws.push(group);
  }

  private createSpitz(): void {
    const fur = 0x303633;
    const sheen = 0x48524b;
    const ruff = 0x5b6259;
    ball(this.body, [0, 0.45, -0.05], [0.43, 0.38, 0.50], fur, true);
    ball(this.body, [0, 0.47, 0.24], [0.37, 0.39, 0.32], sheen, true);
    for (let i = 0; i < 14; i++) {
      const angle = i * Math.PI * 2 / 14;
      ball(this.body, [Math.cos(angle) * 0.32, 0.51 + Math.sin(angle) * 0.22, 0.1],
        [0.13, 0.16, 0.14], i % 3 === 0 ? sheen : fur, true);
    }
    for (const x of [-0.27, 0.27]) for (const z of [-0.34, 0.29]) this.leg(x, z, fur);
    // Pomeranian's distinctive full cheeks and short muzzle.
    ball(this.head, [0, 0.01, 0.02], [0.38, 0.35, 0.30], fur, true);
    ball(this.head, [-0.25, -0.095, 0.19], [0.22, 0.24, 0.19], sheen, true);
    ball(this.head, [0.25, -0.095, 0.19], [0.22, 0.24, 0.19], sheen, true);
    cone(this.head, [-0.26, 0.29, -0.055], 0.17, 0.42, fur, 0.22);
    cone(this.head, [0.26, 0.29, -0.055], 0.17, 0.42, fur, -0.22);
    cone(this.head, [-0.26, 0.30, 0.015], 0.075, 0.23, 0x957a76, 0.22);
    cone(this.head, [0.26, 0.30, 0.015], 0.075, 0.23, 0x957a76, -0.22);
    ball(this.head, [0, -0.15, 0.28], [0.19, 0.14, 0.17], ruff);
    ball(this.head, [0, -0.087, 0.446], [0.098, 0.068, 0.067], 0x1d2221);
    for (const x of [-0.17, 0.17]) {
      ball(this.head, [x, 0.07, 0.284], [0.064, 0.073, 0.035], 0x1a2420);
      ball(this.head, [x - 0.017, 0.097, 0.32], [0.018, 0.023, 0.016], 0xfff4df);
    }
    // Signature fluffy curled tail.
    ball(this.tail, [0, 0.11, -0.20], [0.22, 0.25, 0.25], fur, true);
    ball(this.tail, [0, 0.36, -0.30], [0.29, 0.28, 0.25], sheen, true);
    ball(this.tail, [0, 0.42, -0.16], [0.20, 0.24, 0.22], fur, true);
  }

  private createCat(): void {
    const ginger = 0xdb8d45;
    const highlight = 0xf0ad63;
    const stripe = 0xa95e36;
    const cream = 0xf7d3a0;
    ball(this.body, [0, 0.42, -0.075], [0.31, 0.29, 0.46], ginger);
    ball(this.body, [0, 0.43, 0.22], [0.25, 0.27, 0.25], highlight);
    for (const x of [-0.20, 0.20]) for (const z of [-0.34, 0.26]) this.leg(x, z, ginger);
    ball(this.body, [0, 0.31, 0.39], [0.16, 0.23, 0.045], cream);
    // Tabby stripes, not a uniform orange cat.
    for (const z of [-0.36, -0.18, 0.03]) {
      for (const x of [-0.25, 0.25]) {
        const mark = ball(this.body, [x, 0.59, z], [0.045, 0.084, 0.094], stripe);
        mark.rotation.z = x < 0 ? -0.45 : 0.45;
      }
    }
    ball(this.head, [0, 0.02, 0.07], [0.315, 0.285, 0.29], ginger);
    for (const side of [-1, 1]) {
      cone(this.head, [side * 0.235, 0.285, 0.02], 0.18, 0.36, ginger, -side * 0.13);
      cone(this.head, [side * 0.235, 0.30, 0.115], 0.095, 0.19, 0xd7827b, -side * 0.13);
      ball(this.head, [side * 0.15, -0.015, 0.327], [0.065, 0.079, 0.028], 0x4b5e39);
      ball(this.head, [side * 0.15, -0.017, 0.351], [0.019, 0.064, 0.014], 0x222926);
      ball(this.head, [side * 0.16, 0.007, 0.365], [0.012, 0.016, 0.008], 0xfff8e8);
      ball(this.head, [side * 0.085, -0.17, 0.309], [0.115, 0.095, 0.064], cream);
      ball(this.head, [side * 0.17, 0.125, 0.304], [0.036, 0.090, 0.025], stripe);
    }
    for (const x of [-0.16, 0, 0.16]) {
      const line = ball(this.head, [x, 0.215 - Math.abs(x) * 0.24, 0.275], [0.036, 0.086, 0.03], stripe);
      line.rotation.z = -x * 1.3;
    }
    ball(this.head, [0, -0.125, 0.376], [0.067, 0.042, 0.036], 0xd98a83);
    // Lightweight stylized whiskers: one line geometry for all six.
    const whiskers: number[] = [];
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      whiskers.push(side * 0.11, -0.17 + i * 0.017, 0.367,
        side * (0.39 + i * 0.022), -0.25 + i * 0.085, 0.40);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(whiskers, 3));
    this.head.add(new THREE.LineSegments(geo,
      new THREE.LineBasicMaterial({ color: 0xffe5c2 })));

    // Orange, upward-curving striped tail.
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      ball(this.tail,
        [Math.sin(t * 1.2) * 0.18, t * 0.62, -0.13 - t * 0.24],
        [0.09 - t * 0.022, 0.12, 0.10 - t * 0.022],
        i % 2 ? stripe : ginger);
    }
  }

  react(action: PetAction): void {
    this.reaction = action;
    this.reactionTime = 0;
  }

  update(dt: number): void {
    this.clock += dt;
    if (this.reaction) {
      this.reactionTime += dt;
      if (this.reactionTime > 2.8) this.reaction = null;
    }
    const t = this.clock;
    // Idle wandering is a small cosmetic loop around the shared home marker,
    // without autonomous spending or server-side gameplay decisions.
    const motion = this.reaction === 'play' ? 0.28 : 0.12;
    this.root.position.x = this.home.x + Math.sin(t * 0.7) * motion;
    this.root.position.z = this.home.z + Math.cos(t * 0.56) * motion;
    this.root.rotation.y = Math.sin(t * 0.43) * 0.20;
    this.body.position.y = Math.sin(t * 2.5) * 0.018;
    if (this.reaction === 'play') {
      this.body.position.y += Math.abs(Math.sin(this.reactionTime * 9)) * 0.23;
      this.body.rotation.z = Math.sin(this.reactionTime * 9) * 0.075;
    } else this.body.rotation.z *= 0.86;
    this.head.rotation.z = this.reaction === 'pet' || this.reaction === 'brush'
      ? Math.sin(this.reactionTime * 4) * 0.20
      : Math.sin(t * 1.1) * 0.06;
    this.head.rotation.x = this.reaction === 'feed'
      ? 0.32 + Math.sin(this.reactionTime * 7) * 0.20 : Math.sin(t * 0.84) * 0.035;
    this.tail.rotation.y = Math.sin(t * (this.id === 'verdell' ? 8 : 3.8)) *
      (this.reaction ? 0.53 : 0.24);
    for (let i = 0; i < this.paws.length; i++) {
      this.paws[i].rotation.x = this.reaction === 'play'
        ? Math.sin(this.reactionTime * 9 + (i % 2) * Math.PI) * 0.30 : 0;
    }
  }
}
