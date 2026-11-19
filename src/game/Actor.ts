import * as THREE from 'three';
import type { CharacterId } from '../core/state';

type Pose = 'idle' | 'sit' | 'work' | 'sleep';
type Arrival = () => void;

function mat(hex: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85 });
}

function sphere(parent: THREE.Group, radius: number, x: number, y: number, z: number, color: number): THREE.Mesh {
  const object = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), mat(color));
  object.position.set(x, y, z);
  object.castShadow = true;
  parent.add(object);
  return object;
}

function capsule(parent: THREE.Group, r: number, len: number, x: number, y: number, z: number, color: number): THREE.Mesh {
  const object = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat(color));
  object.position.set(x, y, z);
  object.castShadow = true;
  parent.add(object);
  return object;
}

export class Actor {
  readonly root = new THREE.Group();
  private readonly figure = new THREE.Group();
  private readonly leftLeg: THREE.Mesh;
  private readonly rightLeg: THREE.Mesh;
  private readonly leftArm: THREE.Mesh;
  private readonly rightArm: THREE.Mesh;
  private readonly selectionRing: THREE.Mesh;
  private waypoints: THREE.Vector3[] = [];
  private callback: Arrival | null = null;
  private pose: Pose = 'idle';
  private clock = 0;

  constructor(readonly id: CharacterId, start: [number, number]) {
    this.root.position.set(start[0], 0, start[1]);
    this.root.add(this.figure);

    const vlad = id === 'vlad';
    const shirt = vlad ? 0x8aa393 : 0xc78b80;
    const pants = vlad ? 0x56606b : 0x907a73;
    const skin = vlad ? 0xe3af8b : 0xefc2a1;
    const hair = vlad ? 0x4d352f : 0x694836;

    capsule(this.figure, 0.29, 0.50, 0, 0.91, 0, shirt);
    this.leftLeg = capsule(this.figure, 0.115, 0.34, -0.15, 0.35, 0, pants);
    this.rightLeg = capsule(this.figure, 0.115, 0.34, 0.15, 0.35, 0, pants);
    this.leftArm = capsule(this.figure, 0.095, 0.32, -0.37, 0.93, 0, shirt);
    this.rightArm = capsule(this.figure, 0.095, 0.32, 0.37, 0.93, 0, shirt);

    sphere(this.figure, 0.27, 0, 1.50, 0, skin);
    sphere(this.figure, vlad ? 0.265 : 0.295, 0, 1.67, -0.055, hair);
    if (!vlad) {
      sphere(this.figure, 0.22, -0.19, 1.44, -0.12, hair);
      sphere(this.figure, 0.22, 0.19, 1.44, -0.12, hair);
    }
    sphere(this.figure, 0.028, -0.092, 1.50, 0.25, 0x302d2b);
    sphere(this.figure, 0.028, 0.092, 1.50, 0.25, 0x302d2b);

    const ringMat = new THREE.MeshBasicMaterial({ color: vlad ? 0x6da38c : 0xe2a188, transparent: true, opacity: 0.78, side: THREE.DoubleSide });
    this.selectionRing = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.46, 28), ringMat);
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.position.y = 0.012;
    this.root.add(this.selectionRing);
    this.selectionRing.visible = false;
  }

  select(value: boolean): void {
    this.selectionRing.visible = value;
  }

  walkPath(points: readonly THREE.Vector3[], onArrive: Arrival): void {
    this.waypoints = points.map((point) => point.clone());
    this.callback = onArrive;
    this.pose = 'idle';
  }

  setPose(pose: Pose): void {
    this.waypoints = [];
    this.callback = null;
    this.pose = pose;
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

    const stride = walking ? Math.sin(this.clock * 11) * 0.42 : 0;
    this.leftLeg.rotation.x = stride;
    this.rightLeg.rotation.x = -stride;
    this.leftArm.rotation.x = -stride * 0.85;
    this.rightArm.rotation.x = stride * 0.85;
    this.figure.position.y = walking ? 0.04 + Math.abs(Math.sin(this.clock * 11)) * 0.035
      : this.pose === 'sit' || this.pose === 'work' ? -0.27
      : this.pose === 'sleep' ? -0.39
      : Math.sin(this.clock * 1.7) * 0.008;
    this.figure.rotation.z = this.pose === 'sleep' ? -0.12 : 0;
  }
}
