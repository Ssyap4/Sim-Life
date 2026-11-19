import * as THREE from 'three';
import type { CharacterId, SocialKind } from '../shared/protocol';

type Pose = 'idle' | 'sit' | 'work' | 'sleep';
type Arrival = () => void;
const materials = new Map<number, THREE.MeshStandardMaterial>();
const spheres = new Map<number, THREE.SphereGeometry>();
const capsules = new Map<string, THREE.CapsuleGeometry>();

function mat(hex: number): THREE.MeshStandardMaterial {
  let result = materials.get(hex);
  if (!result) { result = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.89 }); materials.set(hex, result); }
  return result;
}
function sphere(parent: THREE.Object3D, r: number, x: number, y: number, z: number, hex: number): THREE.Mesh {
  let geometry = spheres.get(r);
  if (!geometry) { geometry = new THREE.SphereGeometry(r, 12, 9); spheres.set(r, geometry); }
  const mesh = new THREE.Mesh(geometry, mat(hex));
  mesh.position.set(x, y, z);
  mesh.castShadow = r > 0.09;
  parent.add(mesh);
  return mesh;
}
function capsule(parent: THREE.Object3D, radius: number, len: number, x: number, y: number, z: number, hex: number): THREE.Mesh {
  const key = radius + ':' + len;
  let geometry = capsules.get(key);
  if (!geometry) { geometry = new THREE.CapsuleGeometry(radius, len, 4, 9); capsules.set(key, geometry); }
  const mesh = new THREE.Mesh(geometry, mat(hex));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function heartShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.10);
  shape.bezierCurveTo(-0.19, 0.02, -0.24, 0.15, -0.11, 0.18);
  shape.bezierCurveTo(-0.04, 0.21, 0, 0.14, 0, 0.12);
  shape.bezierCurveTo(0, 0.14, 0.04, 0.21, 0.11, 0.18);
  shape.bezierCurveTo(0.24, 0.15, 0.19, 0.02, 0, -0.10);
  return shape;
}
const heartGeometry = new THREE.ShapeGeometry(heartShape());

export class Actor {
  readonly root = new THREE.Group();
  private readonly figure = new THREE.Group();
  private readonly leftLeg = new THREE.Group();
  private readonly rightLeg = new THREE.Group();
  private readonly leftArm = new THREE.Group();
  private readonly rightArm = new THREE.Group();
  private readonly selectionRing: THREE.Mesh;
  private readonly heart: THREE.Mesh;
  private waypoints: THREE.Vector3[] = [];
  private callback: Arrival | null = null;
  private pose: Pose = 'idle';
  private gesture: SocialKind | null = null;
  private gestureTime = 0;
  private clock = 0;

  constructor(readonly id: CharacterId, start: [number, number]) {
    this.root.position.set(start[0], 0, start[1]);
    this.root.add(this.figure);
    const vlad = id === 'vlad';
    const shirt = vlad ? 0x83a18f : 0xc98987;
    const pants = vlad ? 0x53616a : 0x8b6d6e;
    const skin = vlad ? 0xe7b891 : 0xf1c5a4;
    const hair = vlad ? 0x4b3731 : 0x674737;
    const highlight = vlad ? 0x695044 : 0x8a5a43;

    // Rounded torso, collar and natural shoulder/hip pivots.
    capsule(this.figure, vlad ? 0.285 : 0.270, 0.48, 0, 0.95, 0, shirt);
    sphere(this.figure, 0.14, 0, 1.25, 0, skin);
    if (!vlad) {
      const dress = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.37, 0.46, 12), mat(0xd5a39a));
      dress.position.y = 0.70;
      dress.castShadow = true;
      this.figure.add(dress);
    } else {
      const seam = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.055, 12), mat(0x708879));
      seam.position.y = 0.70;
      this.figure.add(seam);
    }

    for (const [side, group] of [[-1, this.leftLeg], [1, this.rightLeg]] as const) {
      group.position.set(side * 0.15, 0.59, 0);
      capsule(group, 0.115, 0.30, 0, -0.20, 0, pants);
      const shoe = sphere(group, 0.155, 0, -0.51, 0.075, vlad ? 0x775d53 : 0x9b7475);
      shoe.scale.set(1, 0.65, 1.32);
      this.figure.add(group);
    }
    for (const [side, group] of [[-1, this.leftArm], [1, this.rightArm]] as const) {
      group.position.set(side * 0.34, 1.16, 0);
      capsule(group, 0.095, 0.31, 0, -0.23, 0, shirt);
      sphere(group, 0.094, 0, -0.49, 0.02, skin);
      this.figure.add(group);
    }

    sphere(this.figure, 0.274, 0, 1.50, 0, skin);
    const top = sphere(this.figure, vlad ? 0.277 : 0.299, 0, 1.69, -0.055, hair);
    top.scale.y = vlad ? 0.72 : 0.85;
    if (vlad) {
      for (const [x, y, z] of [[-0.20, 1.68, 0.11], [0.02, 1.74, 0.15], [0.19, 1.68, 0.06]] as const) {
        const tuft = sphere(this.figure, 0.14, x, y, z, highlight);
        tuft.scale.set(1.1, 0.62, 0.65);
      }
    } else {
      for (const side of [-1, 1]) {
        const strand = capsule(this.figure, 0.14, 0.44, side * 0.25, 1.33, -0.085, hair);
        strand.rotation.z = side * 0.16;
        sphere(this.figure, 0.15, side * 0.155, 1.68, 0.15, highlight);
      }
    }

    // Expression readable even on phones: brows, pupils, nose, smile and subtle cheeks.
    for (const side of [-1, 1]) {
      sphere(this.figure, 0.050, side * 0.169, 1.42, 0.205, 0xd99a96).scale.set(1.3, 0.5, 0.3);
      sphere(this.figure, 0.038, side * 0.097, 1.505, 0.258, 0x2d3332);
      sphere(this.figure, 0.014, side * 0.090 - 0.009, 1.52, 0.288, 0xfff9ee);
      const brow = sphere(this.figure, 0.052, side * 0.10, 1.59, 0.235, hair);
      brow.scale.set(1.1, 0.19, 0.27);
    }
    sphere(this.figure, 0.032, 0, 1.445, 0.275, skin);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.057, 0.009, 3, 12, Math.PI), mat(0x9b6359));
    smile.position.set(0, 1.413, 0.264);
    smile.rotation.z = Math.PI;
    this.figure.add(smile);

    const ringMat = new THREE.MeshBasicMaterial({
      color: vlad ? 0x6da38c : 0xe2a188, transparent: true, opacity: 0.78, side: THREE.DoubleSide,
    });
    this.selectionRing = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.46, 28), ringMat);
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.position.y = 0.012;
    this.root.add(this.selectionRing);
    this.selectionRing.visible = false;

    this.heart = new THREE.Mesh(heartGeometry, new THREE.MeshBasicMaterial({
      color: vlad ? 0xefaa9c : 0xd88d8a, side: THREE.DoubleSide, depthWrite: false,
    }));
    this.heart.position.set(0, 2.04, 0.10);
    this.root.add(this.heart);
    this.heart.visible = false;
  }

  select(value: boolean): void { this.selectionRing.visible = value; }

  walkPath(points: readonly THREE.Vector3[], onArrive: Arrival): void {
    this.waypoints = points.map((point) => point.clone());
    this.callback = onArrive;
    this.pose = 'idle';
    this.gesture = null;
    this.heart.visible = false;
  }

  setPose(pose: Pose): void {
    this.waypoints = [];
    this.callback = null;
    this.pose = pose;
    this.gesture = null;
    this.heart.visible = false;
  }

  faceTowards(point: THREE.Vector3): void {
    const dx = point.x - this.root.position.x;
    const dz = point.z - this.root.position.z;
    this.root.rotation.y = Math.atan2(dx, dz);
  }

  playGesture(kind: SocialKind): void {
    this.setPose('idle');
    this.gesture = kind;
    this.gestureTime = 0;
    this.heart.visible = kind === 'hug';
  }

  update(dt: number): void {
    this.clock += dt;
    let walking = false;
    if (this.waypoints.length) {
      const target = this.waypoints[0];
      const delta = target.clone().sub(this.root.position);
      delta.y = 0;
      const distance = delta.length();
      const speed = 1.8;
      if (distance <= speed * dt + 0.03) {
        this.root.position.copy(target);
        this.waypoints.shift();
        if (!this.waypoints.length) {
          const callback = this.callback;
          this.callback = null;
          callback?.();
        }
        walking = this.waypoints.length > 0;
      } else {
        delta.normalize();
        this.root.position.addScaledVector(delta, speed * dt);
        const angle = Math.atan2(delta.x, delta.z);
        const turn = THREE.MathUtils.euclideanModulo(angle - this.root.rotation.y + Math.PI, 2 * Math.PI) - Math.PI;
        this.root.rotation.y += THREE.MathUtils.clamp(turn, -dt * 8, dt * 8);
        walking = true;
      }
    }

    const stride = walking ? Math.sin(this.clock * 11) * 0.39 : 0;
    this.leftLeg.rotation.x = stride;
    this.rightLeg.rotation.x = -stride;
    this.leftArm.rotation.x = -stride * 0.80;
    this.rightArm.rotation.x = stride * 0.80;
    this.leftArm.rotation.z = -0.11;
    this.rightArm.rotation.z = 0.11;
    if (this.gesture) {
      this.gestureTime += dt;
      if (this.gesture === 'hug') {
        this.leftArm.rotation.x = 1.10 + Math.sin(this.gestureTime * 3.8) * 0.09;
        this.rightArm.rotation.x = 1.10 + Math.sin(this.gestureTime * 3.8) * 0.09;
        this.leftArm.rotation.z = 0.40;
        this.rightArm.rotation.z = -0.40;
      } else {
        this.rightArm.rotation.x = 0.60;
        this.rightArm.rotation.z = -1.85 + Math.sin(this.gestureTime * 8) * 0.11;
        this.leftArm.rotation.x = 0.18;
        this.leftArm.rotation.z = 0.12;
      }
      this.heart.position.y = 2.03 + Math.sin(this.gestureTime * 3) * 0.10;
      this.heart.scale.setScalar(0.84 + Math.sin(this.gestureTime * 4) * 0.06);
      if (this.gestureTime >= 3.1) this.setPose('idle');
    }
    this.figure.position.y = walking ? 0.04 + Math.abs(Math.sin(this.clock * 11)) * 0.03
      : this.pose === 'sit' || this.pose === 'work' ? -0.26
      : this.pose === 'sleep' ? -0.37
      : this.gesture ? Math.sin(this.clock * 4) * 0.023
      : Math.sin(this.clock * 1.7) * 0.009;
    this.figure.rotation.z = this.pose === 'sleep' ? -0.13 : 0;
  }
}
