import * as THREE from 'three';
import type { CharacterId, SocialKind } from '../shared/protocol';
import type { PetAction } from '../shared/pets';
import { buildCharacterArt, type CharacterRig } from './CharacterArt';
import { finish, orb } from './ArtKit';

type Pose = 'idle' | 'sit' | 'work' | 'sleep';
type Arrival = () => void;
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
  private readonly rig: CharacterRig;
  private readonly figureBase = new THREE.Vector3();
  private clock = 0;
  private gait = 0;
  private gaitBlend = 0;
  private crouchBlend = 0;
  private readonly spoon = new THREE.Group();
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

  constructor(readonly id: CharacterId, start: [number, number]) {
    this.root.position.set(start[0], 0, start[1]);
    this.root.add(this.figure);
    const vlad = id === 'vlad';
    this.rig = buildCharacterArt(this.figure, id, {
      leftLeg: this.leftLeg, rightLeg: this.rightLeg,
      leftArm: this.leftArm, rightArm: this.rightArm,
    });

    const utensil = finish(0xb68354, 'wood');
    const handle = new THREE.Mesh(orb, utensil);
    handle.scale.set(0.011, 0.014, 0.122);
    handle.position.z = 0.085;
    const bowl = new THREE.Mesh(orb, utensil);
    bowl.scale.set(0.032, 0.011, 0.067);
    bowl.position.z = 0.203;
    this.spoon.add(handle, bowl);
    this.spoon.position.set(-0.012, -this.rig.lowerArm - 0.031, 0.028);
    this.spoon.rotation.x = 0.31;
    this.spoon.visible = false;
    this.rig.elbows[1].add(this.spoon);

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
    this.heart.position.set(0, 2.17, 0.10);
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
    this.spoon.visible = false;
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
    // World has already placed the actor at the visual station.
    this.activity = kind;
    this.activityTime = 0;
  }

  finishActivity(): void {
    if (this.activity === 'cook') this.setPose('idle');
    else this.activity = null;
    this.spoon.visible = false;
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

  private advance(dt: number): number {
    let budget = dt * 1.8;
    let traveled = 0;
    let heading = this.root.rotation.y;
    while (budget > 0 && this.waypoints.length) {
      const target = this.waypoints[0];
      const dx = target.x - this.root.position.x, dz = target.z - this.root.position.z;
      const distance = Math.hypot(dx, dz);
      const travel = Math.min(distance, budget);
      if (distance > 0.001) heading = Math.atan2(dx, dz);
      budget -= travel;
      traveled += travel;
      if (travel < distance) {
        this.root.position.x += dx / distance * travel;
        this.root.position.z += dz / distance * travel;
        break;
      }
      this.root.position.copy(target);
      this.waypoints.shift();
    }
    if (traveled > 0) {
      const turn = THREE.MathUtils.euclideanModulo(heading - this.root.rotation.y + Math.PI, 2 * Math.PI) - Math.PI;
      this.root.rotation.y += THREE.MathUtils.clamp(turn, -dt * 8, dt * 8);
    }
    if (!this.waypoints.length && this.callback) {
      const arrive = this.callback;
      this.callback = null;
      arrive();
    }
    return traveled;
  }

  private bend(upper: THREE.Object3D, lower: THREE.Object3D, l1: number, l2: number,
    y: number, z: number, direction: number, alpha: number): void {
    const d = THREE.MathUtils.clamp(Math.hypot(y, z), Math.abs(l1 - l2) + 0.003, l1 + l2 - 0.001);
    const shoulder = Math.acos(THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const flex = Math.PI - Math.acos(THREE.MathUtils.clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
    upper.rotation.x = THREE.MathUtils.lerp(upper.rotation.x, Math.atan2(-z, -y) - direction * shoulder, alpha);
    lower.rotation.x = THREE.MathUtils.lerp(lower.rotation.x, direction * flex, alpha);
  }

  update(dt: number): void {
    this.clock += dt;
    this.gestureTime += dt;
    this.activityTime += dt;
    const traveled = this.advance(dt);
    const walking = traveled > 0 && this.waypoints.length > 0;
    const alpha = 1 - Math.exp(-dt * 11);
    this.gaitBlend = THREE.MathUtils.lerp(this.gaitBlend, walking ? 1 : 0, alpha);
    this.gait = (this.gait + traveled / 1.12) % 1;
    const t = this.clock + (this.id === 'vlad' ? 0 : 1.9);
    const seated = this.pose === 'sit' || this.pose === 'work';
    const asleep = this.pose === 'sleep';
    const care = this.activity === 'pet' || this.activity === 'brush' || this.activity === 'feed';
    const breath = Math.sin(t * (asleep ? 1.35 : 1.85));
    let lean = this.pose === 'work' ? 0.26 : this.activity === 'cook' ? 0.14 : care ? 0.48 : 0;
    let gaze = asleep ? 0.04 : this.pose === 'work' ? 0.16 : this.activity === 'cook' ? 0.22 : care ? 0.33 : 0;
    const stridePhase = this.gait * Math.PI * 2;
    const motion = this.gaitBlend;
    const speedBob = 0.017 * (1 - Math.cos(stridePhase * 2));
    const data = this.rig;
    const armA = this.leftArm, armB = this.rightArm;
    let leftY = -data.upperArm - data.lowerArm + 0.018;
    let rightY = leftY;
    let leftZ = -0.18 * Math.cos(stridePhase) * motion;
    let rightZ = -leftZ;
    let armSpread = -0.077;
    if (seated) {
      leftY = rightY = -0.44;
      leftZ = rightZ = 0.29;
    }
    if (this.pose === 'work') {
      leftY = 0.105 + Math.sin(t * 9.0) * 0.012;
      rightY = 0.105 + Math.sin(t * 11.4) * 0.013;
      leftZ = 0.50;
      rightZ = 0.52;
    }

    let crouch = 0;
    const a = this.activityTime;
    if (this.activity) {
      switch (this.activity) {
        case 'cook':
          leftY = -0.27;
          rightY = -0.152 + Math.sin(a * 5) * 0.040;
          leftZ = 0.40;
          rightZ = 0.49 + Math.cos(a * 5) * 0.055;
          break;
        case 'eat': {
          const bite = (0.5 - 0.5 * Math.cos(a * 3.2)) ** 2;
          rightY = THREE.MathUtils.lerp(-0.37, 0.14, bite);
          rightZ = THREE.MathUtils.lerp(0.41, 0.13, bite);
          gaze = 0.11 + bite * 0.15;
          break;
        }
        case 'play':
          leftY = -0.29 + Math.sin(a * 5) * 0.11;
          rightY = -0.29 - Math.sin(a * 5) * 0.11;
          leftZ = rightZ = 0.42;
          crouch = 0.14;
          gaze = 0.24;
          break;
        default:
          crouch = this.activity === 'feed' ? 0.28 : 0.21;
          leftY = -0.49;
          rightY = -0.42 + Math.sin(a * 4) * 0.045;
          leftZ = 0.20;
          rightZ = 0.40 + Math.sin(a * 4 + 1) * 0.07;
          break;
      }
    }
    const g = this.gestureTime;
    if (this.gesture) {
      const reach = Math.sin(Math.PI * Math.min(1, g / (this.gesture === 'hug' ? 2.45 : 1.4)));
      if (this.gesture === 'hug') {
        armSpread = -0.28 * (1 - reach) + 0.25 * reach;
        leftY = rightY = THREE.MathUtils.lerp(-0.56, -0.06, reach);
        leftZ = rightZ = reach * 0.53;
        lean = 0.13 * reach;
        this.heart.scale.setScalar(0.69 + reach * 0.26);
      } else {
        // Both face each other. Their raised hands meet on the same side of
        // the shared center line by using opposite shoulders.
        if (this.id === 'vlad') { rightY = -0.56 + 0.76 * reach; rightZ = 0.36 * reach; }
        else { leftY = -0.56 + 0.76 * reach; leftZ = 0.36 * reach; }
        lean = 0.07 * reach;
      }
      if (g >= 3.1) this.setPose('idle');
    }

    this.spoon.visible = this.activity === 'cook' || this.activity === 'eat';
    this.spoon.rotation.y = this.activity === 'cook' ? 0.25 * Math.sin(a * 5) : 0.02;
    this.crouchBlend = THREE.MathUtils.lerp(this.crouchBlend, crouch, alpha);
    const armZ = this.activity === 'cook' ? -0.11 + Math.sin(a * 5) * 0.15 : armSpread;
    this.bend(armA, data.elbows[0], data.upperArm, data.lowerArm, leftY, leftZ, -1, alpha);
    this.bend(armB, data.elbows[1], data.upperArm, data.lowerArm, rightY, rightZ, -1, alpha);
    armA.rotation.z = THREE.MathUtils.lerp(armA.rotation.z, armSpread, alpha);
    armB.rotation.z = THREE.MathUtils.lerp(armB.rotation.z, -armZ, alpha);

    for (let i = 0; i < 2; i++) {
      const upper = i === 0 ? this.leftLeg : this.rightLeg;
      const knee = data.knees[i];
      if (seated) {
        const thigh = this.pose === 'work' ? -1.18 : -1.37;
        upper.rotation.x = THREE.MathUtils.lerp(upper.rotation.x, thigh + i * 0.06, alpha);
        knee.rotation.x = THREE.MathUtils.lerp(knee.rotation.x, 0.16 - thigh - i * 0.065, alpha);
      } else {
        const phase = (this.gait + i * 0.5) % 1;
        const swing = phase > 0.60;
        const travel = swing ? (phase - 0.60) / 0.40 : phase / 0.60;
        const lift = swing ? Math.sin(travel * Math.PI) * 0.123 : 0;
        const step = swing ? THREE.MathUtils.smoothstep(travel, 0, 1) * 2 - 1 : 1 - 2 * travel;
        const y = -data.thighLength - data.shinLength + motion * (0.038 + lift) + this.crouchBlend;
        const z = step * motion * 0.24 + 0.08 * this.crouchBlend;
        this.bend(upper, knee, data.thighLength, data.shinLength, y, z, 1, alpha);
      }
    }

    const blinkTime = t % (this.id === 'vlad' ? 6.3 : 7.15);
    const blink = asleep ? 0.13 : blinkTime < 0.17 ? 1 - 0.89 * Math.sin(blinkTime / 0.17 * Math.PI) : 1;
    for (const eye of data.eyes) eye.scale.y = THREE.MathUtils.lerp(eye.scale.y, blink, alpha);
    const look = seated || asleep || this.activity || this.gesture ? 0 : 0.25 * Math.sin(t * 0.53) ** 7;
    data.head.rotation.y = THREE.MathUtils.lerp(data.head.rotation.y, look - motion * 0.07 * Math.sin(stridePhase), alpha);
    data.head.rotation.x = THREE.MathUtils.lerp(data.head.rotation.x, gaze + 0.024 * breath - lean * 0.55, alpha);
    data.head.rotation.z = THREE.MathUtils.lerp(data.head.rotation.z, 0.028 * Math.sin(t * 0.73), alpha);

    data.chest.rotation.x = THREE.MathUtils.lerp(data.chest.rotation.x, lean + motion * 0.076, alpha);
    data.chest.rotation.y = THREE.MathUtils.lerp(data.chest.rotation.y, motion * 0.092 * Math.cos(stridePhase), alpha);
    data.chest.rotation.z = THREE.MathUtils.lerp(data.chest.rotation.z, 0.016 * Math.sin(t * 0.71) + motion * 0.027 * Math.sin(stridePhase), alpha);
    data.chest.position.z = -Math.sin(data.chest.rotation.x) * data.waistY;
    data.chest.position.y = (1 - Math.cos(data.chest.rotation.x)) * data.waistY + 0.006 * breath;

    this.figureBase.lerp(this.poseOffset, 1 - Math.exp(-dt * 8));
    this.figure.position.copy(this.figureBase);
    this.figure.position.y += motion * (speedBob - 0.037) - this.crouchBlend;
    this.figure.rotation.x = THREE.MathUtils.lerp(this.figure.rotation.x, asleep ? -Math.PI / 2 : 0, alpha);
    this.selectionRing.position.x = this.figureBase.x;
    this.selectionRing.position.z = this.figureBase.z;
  }
}
