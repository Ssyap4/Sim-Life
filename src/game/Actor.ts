import * as THREE from 'three';
import type { CharacterId, SocialKind } from '../shared/protocol';
import type { PetAction } from '../shared/pets';
import { buildCharacterArt, type CharacterModel, type CharacterRig } from './CharacterArt';
import { finish, orb } from './ArtKit';

type Pose = 'idle' | 'sit' | 'work' | 'sleep';
type Arrival = () => void;
type HandTargets = readonly [left: THREE.Vector3, right: THREE.Vector3];
export type DomesticMotion = 'wash' | 'tidy' | 'tea' | 'read' | 'phone' | 'stretch' | 'music' | 'journal' | 'games' | 'reach' | 'chat';
const strideLength = 1.02;
const stancePortion = 0.54;
const handAxis = new THREE.Vector3(0, -1, 0);
const forwardAxis = new THREE.Vector3(0, 0, 1);
const up = THREE.Object3D.DEFAULT_UP;
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
  private readonly leftLeg: THREE.Object3D;
  private readonly rightLeg: THREE.Object3D;
  private readonly leftArm: THREE.Object3D;
  private readonly rightArm: THREE.Object3D;
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
  private activity: 'cook' | 'eat' | Exclude<PetAction, 'buyFood'> | DomesticMotion | null = null;
  private activityTime = 0;
  private readonly poseOffset = new THREE.Vector3();
  private keys: HandTargets | undefined;
  private pan: THREE.Vector3 | undefined;
  private gestureTarget: THREE.Vector3 | undefined;
  private readonly target = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly elbowAxis = new THREE.Vector3();
  private readonly upperAxis = new THREE.Vector3();
  private readonly basisX = new THREE.Vector3();
  private readonly basisZ = new THREE.Vector3();
  private readonly handDirection = new THREE.Vector3();
  private readonly rotationBasis = new THREE.Matrix4();
  private readonly aimRotation = new THREE.Quaternion();
  private readonly parentRotation = new THREE.Quaternion();

  constructor(readonly id: CharacterId, start: [number, number], model?: CharacterModel) {
    this.root.position.set(start[0], 0, start[1]);
    this.root.add(this.figure);
    const vlad = id === 'vlad';
    const asset = model?.(this.figure);
    this.leftLeg = asset?.joints.leftLeg ?? new THREE.Group();
    this.rightLeg = asset?.joints.rightLeg ?? new THREE.Group();
    this.leftArm = asset?.joints.leftArm ?? new THREE.Group();
    this.rightArm = asset?.joints.rightArm ?? new THREE.Group();
    this.rig = asset?.rig ?? buildCharacterArt(this.figure, id, {
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
    this.spoon.position.set(-0.012, -0.044, 0.024);
    this.spoon.rotation.x = 0.31;
    this.spoon.visible = false;
    this.rig.wrists[1].add(this.spoon);

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
    this.keys = this.pan = this.gestureTarget = undefined;
    this.poseOffset.set(0, pose === 'sit' || pose === 'work' ? -0.26 : 0, 0);
    this.heart.visible = false;
    this.spoon.visible = false;
  }

  /** Pose the visible character on the furniture while the navigation root
   * stays in its safe, server-saved approach location. */
  setFurniturePose(pose: Pose, worldAnchor: THREE.Vector3, yaw: number, keys?: HandTargets): void {
    this.setPose(pose);
    this.root.rotation.y = yaw;
    const local = worldAnchor.clone().sub(this.root.position);
    local.applyAxisAngle(THREE.Object3D.DEFAULT_UP, -yaw);
    this.poseOffset.copy(local);
    this.keys = keys;
  }

  playActivity(kind: 'cook' | 'eat', pan?: THREE.Vector3): void {
    // World has already placed the actor at the visual station.
    this.activity = kind;
    this.pan = pan;
    this.activityTime = 0;
  }

  playDomesticActivity(kind: DomesticMotion, target?: THREE.Vector3): void {
    this.activity = kind;
    this.pan = target;
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

  playGesture(kind: SocialKind, target?: THREE.Vector3): void {
    this.setPose('idle');
    this.gesture = kind;
    this.gestureTarget = target;
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

  /** Solve the shoulder and elbow in the plane through the wrist target.
   * The elbow points down and gently out, so it clears the torso and worktop. */
  private reach(index: 0 | 1, goal: THREE.Vector3, alpha: number): void {
    const arm = index === 0 ? this.leftArm : this.rightArm;
    const { chest, elbows, upperArm, lowerArm } = this.rig;
    const offset = chest.worldToLocal(this.direction.copy(goal)).sub(arm.position);
    const extent = offset.length();
    if (extent < 0.001) return;
    const distance = THREE.MathUtils.clamp(extent, Math.abs(upperArm - lowerArm) + 0.003, upperArm + lowerArm - 0.002);
    const direction = offset.divideScalar(extent);
    const bend = this.elbowAxis.set(index === 0 ? -0.44 : 0.44, -1, -0.16);
    bend.addScaledVector(direction, -bend.dot(direction)).normalize();
    const along = (upperArm * upperArm + distance * distance - lowerArm * lowerArm) / (2 * distance);
    const lift = Math.sqrt(Math.max(0, upperArm * upperArm - along * along));
    const joint = this.upperAxis.copy(direction).multiplyScalar(along).addScaledVector(bend, lift);
    const z = this.basisZ.copy(direction).multiplyScalar(distance).sub(joint);
    const y = joint.normalize().negate();
    z.addScaledVector(y, -z.dot(y)).normalize();
    this.basisX.crossVectors(y, z).normalize();
    this.rotationBasis.makeBasis(this.basisX, y, z);
    arm.quaternion.slerp(this.aimRotation.setFromRotationMatrix(this.rotationBasis), alpha);
    const flex = Math.PI - Math.acos(THREE.MathUtils.clamp(
      (upperArm * upperArm + lowerArm * lowerArm - distance * distance) / (2 * upperArm * lowerArm), -1, 1));
    elbows[index].rotation.x = THREE.MathUtils.lerp(elbows[index].rotation.x, -flex, alpha);
  }

  private aimHand(index: 0 | 1, direction: THREE.Vector3, alpha: number): void {
    const { elbows, wrists } = this.rig;
    elbows[index].getWorldQuaternion(this.parentRotation).invert();
    direction.applyQuaternion(this.parentRotation).normalize();
    wrists[index].quaternion.slerp(this.aimRotation.setFromUnitVectors(handAxis, direction), alpha);
  }

  private aimSpoon(point: THREE.Vector3, amount = 1): void {
    const direction = this.basisX.copy(point).sub(this.spoon.getWorldPosition(this.target)).normalize();
    this.rig.wrists[1].getWorldQuaternion(this.parentRotation).invert();
    const rotation = this.aimRotation.setFromUnitVectors(forwardAxis, direction.applyQuaternion(this.parentRotation));
    this.spoon.quaternion.slerp(rotation, amount);
  }

  update(dt: number): void {
    this.clock += dt;
    this.gestureTime += dt;
    this.activityTime += dt;
    const traveled = this.advance(dt);
    const walking = this.waypoints.length > 0 && traveled > 0;
    const alpha = 1 - Math.exp(-dt * 11);
    this.gaitBlend = THREE.MathUtils.lerp(this.gaitBlend, walking ? 1 : 0, alpha);
    this.gait = (this.gait + traveled / strideLength) % 1;
    const t = this.clock + (this.id === 'vlad' ? 0 : 1.9);
    const seated = this.pose === 'sit' || this.pose === 'work';
    const asleep = this.pose === 'sleep';
    const care = this.activity === 'pet' || this.activity === 'brush' || this.activity === 'feed';
    const breath = Math.sin(t * (asleep ? 1.35 : 1.85));
    let lean = this.pose === 'work' ? 0.26 : this.activity === 'cook' ? 0.14 : care ? 0.48 : 0;
    if (this.pose === 'sit' && !this.activity) lean = -0.08;
    let gaze = asleep ? 0.04 : this.pose === 'work' ? 0.16 : this.activity === 'cook' ? 0.22 : care ? 0.33 : 0;
    const stridePhase = this.gait * Math.PI * 2;
    const motion = this.gaitBlend;
    const next = this.waypoints[0];
    const turn = next ? THREE.MathUtils.euclideanModulo(
      Math.atan2(next.x - this.root.position.x, next.z - this.root.position.z) - this.root.rotation.y + Math.PI,
      2 * Math.PI,
    ) - Math.PI : 0;
    const lead = THREE.MathUtils.clamp(turn * 0.42, -0.19, 0.19) * motion;
    // Settle the arm swing near arrival without changing the stride or route.
    const settling = this.waypoints.length === 1 && next
      ? THREE.MathUtils.smoothstep(this.root.position.distanceTo(next), 0.02, 0.45) : 1;
    const speedBob = 0.010 * (1 - Math.cos(stridePhase * 2));
    const stanceDrop = motion * (0.066 - speedBob);
    const data = this.rig;
    const armA = this.leftArm, armB = this.rightArm;
    let leftY = -data.upperArm - data.lowerArm + 0.018;
    let rightY = leftY;
    let leftZ = -0.22 * Math.cos(stridePhase - 0.18) * motion * (0.38 + 0.62 * settling);
    let rightZ = -leftZ;
    let armSpread = -0.074 - motion * 0.009 * Math.sin(stridePhase);
    let expression = asleep ? 0.07 : 0.055 + 0.055 * Math.max(0, Math.sin(t * 0.39)) ** 5;
    if (asleep) {
      leftY = -0.51;
      rightY = -0.44;
      leftZ = 0.19;
      rightZ = 0.26;
      armSpread = -0.15;
    }
    if (seated) {
      leftY = rightY = -0.44;
      leftZ = rightZ = 0.29;
    }
    if (this.pose === 'work') {
      gaze += 0.032 * Math.sin(t * 1.18);
      const leftTap = Math.max(0, Math.sin(t * 9.0)) ** 2;
      const rightTap = Math.max(0, Math.sin(t * 11.4 + 1.3)) ** 2;
      leftY = 0.097 - leftTap * 0.022;
      rightY = 0.100 - rightTap * 0.022;
      leftZ = 0.48 + leftTap * 0.025;
      rightZ = 0.51 + rightTap * 0.027;
    }

    let crouch = 0;
    let bite = 0;
    const a = this.activityTime;
    if (this.activity) {
      switch (this.activity) {
        case 'cook':
          leftY = -0.24;
          rightY = -0.218 + Math.sin(a * 5) * 0.032;
          leftZ = 0.36;
          rightZ = 0.43 + Math.cos(a * 5) * 0.053;
          break;
        case 'eat': {
          const swallow = a % 2.21;
          bite = THREE.MathUtils.smoothstep(swallow, 0.19, 0.92) *
            (1 - THREE.MathUtils.smoothstep(swallow, 1.12, 1.70));
          rightY = THREE.MathUtils.lerp(-0.37, 0.14, bite);
          rightZ = THREE.MathUtils.lerp(0.41, 0.13, bite);
          gaze = 0.11 + bite * 0.15;
          break;
        }
        case 'wash':
          leftY = -0.07 + 0.048 * Math.sin(a * 4.3);
          rightY = -0.08 - 0.048 * Math.sin(a * 4.3);
          leftZ = rightZ = 0.29;
          gaze = 0.10;
          break;
        case 'tidy':
          leftY = -0.27 + 0.11 * Math.sin(a * 3);
          rightY = -0.21 - 0.11 * Math.sin(a * 3);
          leftZ = 0.36; rightZ = 0.43;
          crouch = 0.055;
          lean = 0.15;
          break;
        case 'tea':
          leftY = -0.34;
          rightY = -0.10 + 0.11 * Math.sin(a * 2.8);
          leftZ = 0.27; rightZ = 0.21;
          gaze = 0.16;
          break;
        case 'reach': {
          const reach = Math.sin(Math.PI * Math.min(1, a / 1.45));
          rightY = -.52 + .46 * reach;
          rightZ = .16 + .38 * reach;
          lean = .14 * reach;
          gaze = .17;
          break;
        }
        case 'chat': {
          const speaking = Math.sin(a * 1.52 + (this.id === 'alina' ? Math.PI : 0));
          const gesture = Math.max(0, speaking) * (.72 + .28 * Math.sin(a * 5));
          leftY = -.49 + .25 * gesture;
          rightY = -.48 + .34 * gesture;
          rightZ = .26 + .15 * gesture;
          gaze = .07 - .08 * Math.sin(a * 3.1);
          expression = .14 + .37 * gesture;
          break;
        }
        case 'stretch':
          leftY = rightY = 0.28 + 0.06 * Math.sin(a * 2);
          leftZ = rightZ = 0.11;
          armSpread = 0.28;
          expression = 0.15;
          break;
        case 'read':
          leftY = rightY = -0.24;
          leftZ = rightZ = 0.36;
          gaze = 0.26 + 0.025 * Math.sin(a * 1.3);
          break;
        case 'phone':
          rightY = 0.075 + 0.016 * Math.sin(a * 2.3);
          rightZ = 0.11;
          gaze = 0.04;
          expression = 0.16;
          break;
        case 'music':
          leftY = -0.36 + 0.045 * Math.sin(a * 2.5);
          rightY = -0.36 - 0.045 * Math.sin(a * 2.5);
          gaze = 0.065 * Math.sin(a * 1.4);
          expression = 0.12;
          break;
        case 'journal':
          leftY = -0.33;
          rightY = -0.31 + 0.025 * Math.sin(a * 7);
          leftZ = 0.35; rightZ = 0.37;
          gaze = 0.23;
          break;
        case 'games':
          // The existing reusable keyboard IK animates both hands.
          expression = 0.20;
          break;
        case 'play':
          expression = 0.42;
          leftY = -0.29 + Math.sin(a * 5) * 0.11;
          rightY = -0.29 - Math.sin(a * 5) * 0.11;
          leftZ = rightZ = 0.42;
          crouch = 0.14;
          gaze = 0.24;
          break;
        default:
          crouch = this.activity === 'feed' ? 0.28 : 0.21;
          leftY = -0.49;
          rightY = -0.455 + Math.sin(a * 4) * 0.034;
          leftZ = 0.20;
          rightZ = 0.40 + Math.sin(a * 4 + 1) * 0.07;
          break;
      }
    }
    let embrace = 0;
    let highFive = 0;
    const g = this.gestureTime;
    if (this.gesture) {
      const duration = this.gesture === 'hug' ? 2.45 : 1.4;
      const progress = g / duration;
      const reach = THREE.MathUtils.smoothstep(progress, 0, 0.31) *
        (1 - THREE.MathUtils.smoothstep(progress, this.gesture === 'hug' ? 0.63 : 0.44, 1));
      if (this.gesture === 'hug') {
        expression = 0.11 + 0.72 * reach;
        gaze = 0.030 * reach;
        armSpread = -0.28 * (1 - reach) + 0.25 * reach;
        leftY = rightY = THREE.MathUtils.lerp(-0.56, -0.06, reach);
        leftZ = rightZ = reach * 0.44;
        embrace = reach * 0.14;
        lean = 0.20 * reach;
        this.heart.scale.setScalar(0.69 + reach * 0.26);
      } else {
        highFive = reach;
        expression = 0.10 + 0.56 * reach;
        // Both face each other. Their raised hands meet on the same side of
        // the shared center line by using opposite shoulders.
        if (this.id === 'vlad') { rightY = -0.56 + 0.76 * reach; rightZ = 0.36 * reach; }
        else { leftY = -0.56 + 0.76 * reach; leftZ = 0.36 * reach; }
        lean = 0.07 * reach;
      }
      if (g >= 3.1) this.setPose('idle');
    }

    this.spoon.visible = this.activity === 'cook' || this.activity === 'eat';
    this.spoon.rotation.y = this.activity === 'cook' ? 0.31 * Math.sin(a * 5) : 0.02;
    this.spoon.rotation.x = this.activity === 'cook' ? 0.56 + 0.10 * Math.cos(a * 5) : 0.31;
    this.crouchBlend = THREE.MathUtils.lerp(this.crouchBlend, crouch, alpha);
    const armZ = this.activity === 'cook' ? -0.11 + Math.sin(a * 5) * 0.15 : armSpread;
    const typing = this.pose === 'work' && this.keys;
    const stirring = this.activity === 'cook' && this.pan;
    const counter = this.activity && this.activity !== 'cook' && this.pan;
    if (!typing && !stirring && !counter) {
      this.bend(armA, data.elbows[0], data.upperArm, data.lowerArm, leftY, leftZ, -1, alpha);
      this.bend(armB, data.elbows[1], data.upperArm, data.lowerArm, rightY, rightZ, -1, alpha);
      armA.rotation.y = THREE.MathUtils.lerp(armA.rotation.y, 0, alpha);
      armB.rotation.y = THREE.MathUtils.lerp(armB.rotation.y, 0, alpha);
      armA.rotation.z = THREE.MathUtils.lerp(armA.rotation.z, armSpread, alpha);
      armB.rotation.z = THREE.MathUtils.lerp(armB.rotation.z, -armZ, alpha);
    }
    if (!typing && !stirring && !counter) for (const wrist of data.wrists) {
      wrist.rotation.x = THREE.MathUtils.lerp(wrist.rotation.x, this.activity === 'eat' ? 0.12 : 0, alpha);
      wrist.rotation.y = THREE.MathUtils.lerp(wrist.rotation.y, 0, alpha);
      wrist.rotation.z = THREE.MathUtils.lerp(wrist.rotation.z, 0, alpha);
    }

    for (let i = 0; i < 2; i++) {
      const upper = i === 0 ? this.leftLeg : this.rightLeg;
      const knee = data.knees[i];
      let toePitch = 0;
      if (seated) {
        const thigh = this.pose === 'work' ? -1.34 : -1.37;
        upper.rotation.x = THREE.MathUtils.lerp(upper.rotation.x, thigh + i * 0.06, alpha);
        knee.rotation.x = THREE.MathUtils.lerp(knee.rotation.x, 0.16 - thigh - i * 0.065, alpha);
      } else {
        const phase = (this.gait + i * 0.5) % 1;
        const swing = phase > stancePortion;
        const travel = swing ? (phase - stancePortion) / (1 - stancePortion) : phase / stancePortion;
        const lift = swing ? Math.sin(travel * Math.PI) ** 1.6 * 0.113 : 0;
        const step = swing ? THREE.MathUtils.smoothstep(travel, 0, 1) * 2 - 1 : 1 - 2 * travel;
        // The stance ankle compensates for the body bob. Only the swing
        // phase lifts the sole off the floor and pitches it into the step.
        const y = -data.thighLength - data.shinLength + stanceDrop + motion * lift + this.crouchBlend;
        toePitch = swing ? -0.19 * motion * Math.sin(travel * Math.PI * 2) : 0;
        const z = step * motion * strideLength * stancePortion / 2 + 0.08 * this.crouchBlend;
        const legBlend = THREE.MathUtils.lerp(alpha, 1, motion);
        this.bend(upper, knee, data.thighLength, data.shinLength, y, z, 1, legBlend);
      }
      const ankle = data.ankles[i];
      ankle.rotation.x = THREE.MathUtils.lerp(ankle.rotation.x,
        asleep ? -0.10 : toePitch - upper.rotation.x - knee.rotation.x, THREE.MathUtils.lerp(alpha, 1, motion));
    }

    const idleLook = seated || asleep || this.activity || this.gesture ? 0 : Math.sin(t * 0.53) ** 7;
    if (data.animateFace) {
      const eyeYaw = asleep ? 0 : this.pose === 'work' ? 0.046 * Math.sin(t * 1.53) :
        (0.10 * idleLook + lead * 0.44) * (1 - 0.4 * motion);
      const eyePitch = asleep ? 0 : this.activity === 'cook' ? 0.07 :
        this.pose === 'work' ? 0.030 + 0.046 * Math.sin(t * 1.18) : 0.025 * Math.sin(t * 0.67);
      data.animateFace(dt, asleep, expression, eyeYaw, eyePitch);
    } else {
      const blinkTime = t % (this.id === 'vlad' ? 6.3 : 7.15);
      const blink = asleep ? 0.13 : blinkTime < 0.17 ? 1 - 0.89 * Math.sin(blinkTime / 0.17 * Math.PI) : 1;
      for (const eye of data.eyes) eye.scale.y = THREE.MathUtils.lerp(eye.scale.y, blink, alpha);
    }
    const look = 0.20 * idleLook + lead;
    data.head.rotation.y = THREE.MathUtils.lerp(data.head.rotation.y, look - motion * 0.061 * Math.sin(stridePhase), alpha);
    data.head.rotation.x = THREE.MathUtils.lerp(data.head.rotation.x, gaze + 0.022 * breath - lean * 0.55, alpha);
    data.head.rotation.z = THREE.MathUtils.lerp(data.head.rotation.z, 0.018 * Math.sin(t * 0.73), alpha);
    data.hair.rotation.y = -data.head.rotation.y * 0.16 + motion * Math.cos(stridePhase - 0.6) * 0.031;
    data.hair.rotation.x = -data.head.rotation.x * 0.05 + motion * Math.sin(stridePhase) * 0.031;

    data.chest.rotation.x = THREE.MathUtils.lerp(data.chest.rotation.x, lean + motion * 0.076, alpha);
    data.chest.rotation.y = THREE.MathUtils.lerp(data.chest.rotation.y, motion * 0.092 * Math.cos(stridePhase), alpha);
    data.chest.rotation.z = THREE.MathUtils.lerp(data.chest.rotation.z, 0.016 * Math.sin(t * 0.71) + motion * 0.027 * Math.sin(stridePhase), alpha);
    data.chest.position.z = -Math.sin(data.chest.rotation.x) * data.waistY;
    data.chest.position.y = (1 - Math.cos(data.chest.rotation.x)) * data.waistY + 0.006 * breath;

    this.figureBase.lerp(this.poseOffset, 1 - Math.exp(-dt * 8));
    this.figure.position.copy(this.figureBase);
    // Close the visual gap during a hug while the path endpoints stay fixed.
    this.figure.position.z += embrace;
    this.figure.position.y -= stanceDrop + this.crouchBlend;
    this.figure.position.x += motion * 0.011 * Math.sin(stridePhase);
    this.figure.rotation.x = THREE.MathUtils.lerp(this.figure.rotation.x, asleep ? -Math.PI / 2 : 0, alpha);
    if (typing) {
      const beats = 0.52 + 0.48 * Math.max(0, Math.sin(t * 0.85));
      for (const i of [0, 1] as const) {
        const tap = beats * Math.max(0, Math.sin(t * (i === 0 ? 8.5 : 10.2) + i * 1.3)) ** 2;
        this.target.copy(typing[i]);
        this.target.y += 0.028 - 0.018 * tap;
        this.target.z += 0.026 * Math.sin(t * 1.82 + i) - 0.008 * tap;
        this.reach(i, this.target, alpha);
        this.aimHand(i, this.handDirection.set(0, -0.27, -1), alpha);
      }
    } else if (stirring) {
      this.target.copy(stirring).add(this.handDirection.set(0.35, 0.007, 0.19));
      this.reach(0, this.target, alpha);
      this.aimHand(0, this.handDirection.set(0, -0.37, -1), alpha);
      this.target.copy(stirring).add(this.handDirection.set(0.056 * Math.sin(a * 4.4), 0.084, 0.205 + 0.046 * Math.cos(a * 4.4)));
      this.reach(1, this.target, alpha);
      this.aimHand(1, this.handDirection.set(0, -0.25, -1), alpha);
      this.aimSpoon(this.handDirection.copy(stirring).add(this.target.set(
        Math.sin(a * 4.4) * 0.061, 0.004 + 0.008 * Math.sin(a * 8.8) ** 2,
        Math.cos(a * 4.4) * 0.054)));
    } else if (bite > 0) {
      data.head.localToWorld(this.target.set(0.022, -0.133, 0.151));
      this.handDirection.set(0.066, -0.114, 0.175).applyAxisAngle(up, this.root.rotation.y);
      this.target.add(this.handDirection);
      this.reach(1, this.target, bite);
      this.aimHand(1, this.handDirection.set(0, -0.21, 1).applyAxisAngle(up, this.root.rotation.y), bite);
      this.aimSpoon(data.head.localToWorld(this.target.set(0, -0.134, 0.158)), bite);
    } else if (this.gestureTarget && highFive > 0) {
      const hand = this.id === 'vlad' ? 1 : 0;
      this.target.copy(this.gestureTarget).addScaledVector(up, -0.069);
      this.reach(hand, this.target, highFive);
      this.aimHand(hand, this.handDirection.copy(up), highFive);
    }
    if (counter) {
      for (const i of [0, 1] as const) {
        this.target.copy(counter);
        this.target.x += (i ? -.12 : .12) + .075 * Math.sin(a * (this.activity === 'tidy' ? 4 : 6) + i);
        this.target.y += .025 * Math.sin(a * 6 + i * 2);
        this.target.z += .045 * Math.cos(a * 4 + i);
        this.reach(i, this.target, alpha);
      }
    }

    this.selectionRing.position.x = this.figureBase.x;
    this.selectionRing.position.z = this.figureBase.z;
  }
}
