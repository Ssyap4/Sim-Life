import * as THREE from 'three';
import type { CharacterId, SocialKind } from '../shared/protocol';
import type { PetAction } from '../shared/pets';

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
  private activity: 'cook' | 'eat' | Exclude<PetAction, 'buyFood'> | null = null;
  private activityTime = 0;
  private readonly poseOffset = new THREE.Vector3();
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
    this.setPose('idle');
    this.waypoints = points.map((point) => point.clone());
    this.callback = onArrive;
  }

  setPose(pose: Pose): void {
    this.waypoints = [];
    this.callback = null;
    this.pose = pose;
    this.gesture = null;
    this.activity = null;
    this.poseOffset.set(0, pose === 'sit' || pose === 'work' ? -0.26 : 0, 0);
    this.heart.visible = false;
  }

  /** Pose the visible character on the furniture while the navigation root
   * stays in its safe, server-saved approach location. */
  setFurniturePose(pose: Pose, worldAnchor: THREE.Vector3, yaw: number): void {
    this.setPose(pose);
    this.root.rotation.y = yaw;
    const local = worldAnchor.clone().sub(this.root.position);
    local.applyAxisAngle(THREE.Object3D.DEFAULT_UP, -yaw);
    this.poseOffset.copy(local);
  }

  playActivity(kind: 'cook' | 'eat'): void {
    this.setPose(kind === 'eat' ? 'sit' : 'idle');
    this.activity = kind;
    this.activityTime = 0;
  }

  playPetActivity(kind: Exclude<PetAction, 'buyFood'>): void {
    this.setPose('idle');
    this.activity = kind;
    this.activityTime = 0;
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
    const seated = !walking && (this.pose === 'sit' || this.pose === 'work');
    const asleep = !walking && this.pose === 'sleep';
    this.leftLeg.rotation.x = seated ? 1.28 : stride;
    this.rightLeg.rotation.x = seated ? 1.28 : -stride;
    this.leftArm.rotation.x = asleep ? 0.15 : seated ? -0.26 : -stride * 0.80;
    this.rightArm.rotation.x = asleep ? 0.15 : seated ? -0.26 : stride * 0.80;
    this.leftArm.rotation.z = asleep ? -0.30 : -0.11;
    this.rightArm.rotation.z = asleep ? 0.30 : 0.11;
    if (this.pose === 'work' && !walking) {
      this.leftArm.rotation.x = -0.88 + Math.sin(this.clock * 6.1) * 0.17;
      this.rightArm.rotation.x = -0.88 + Math.cos(this.clock * 5.6) * 0.15;
    }
    if (this.activity) {
      this.activityTime += dt;
      if (this.activity === 'cook') {
        this.leftArm.rotation.x = -0.65 + Math.sin(this.activityTime * 6) * 0.25;
        this.rightArm.rotation.x = -0.68 - Math.sin(this.activityTime * 6) * 0.25;
        this.figure.rotation.z = Math.sin(this.activityTime * 4) * 0.045;
      } else if (this.activity === 'eat') {
        this.rightArm.rotation.x = -1.35 + Math.sin(this.activityTime * 5) * 0.13;
        this.leftArm.rotation.x = -0.18;
      } else if (this.activity === 'play') {
        this.leftArm.rotation.x = -1.1 + Math.sin(this.activityTime * 6) * 0.38;
        this.rightArm.rotation.x = -1.05 - Math.sin(this.activityTime * 6) * 0.38;
      } else {
        this.leftArm.rotation.x = -1.06;
        this.rightArm.rotation.x = -1.25 + Math.sin(this.activityTime * 7) * 0.24;
      }
      if (this.activityTime >= 3.4) this.activity = null;
    }
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
    const bob = walking ? 0.04 + Math.abs(Math.sin(this.clock * 11)) * 0.03
      : this.gesture ? Math.sin(this.clock * 4) * 0.023
      : seated || asleep ? 0
      : Math.sin(this.clock * 1.7) * 0.009;
    const alpha = Math.min(1, dt * 7.5);
    this.figure.position.lerp(this.poseOffset, alpha);
    this.figure.position.y += bob;
    const petting = this.activity === 'pet' || this.activity === 'brush' || this.activity === 'feed';
    const lean = asleep ? -Math.PI / 2 : petting ? 0.24 : 0;
    this.figure.rotation.x += (lean - this.figure.rotation.x) * alpha;
    if (this.activity !== 'cook') this.figure.rotation.z *= (1 - alpha);
    this.selectionRing.position.x += (this.poseOffset.x - this.selectionRing.position.x) * alpha;
    this.selectionRing.position.z += (this.poseOffset.z - this.selectionRing.position.z) * alpha;
  }
}
