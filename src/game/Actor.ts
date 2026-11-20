import * as THREE from 'three';
import type { CharacterId, SocialKind } from '../shared/protocol';
import type { PetAction } from '../shared/pets';
import { buildCharacterArt, type CharacterModel, type CharacterRig } from './CharacterArt';
import { HOME_WALK_SPEED } from '../shared/home';
import { activityProps } from './ActivityProps';
import { drum, finish, orb } from './ArtKit';
import type { FloorPoint } from './navigation';
import { walkStrideLength, walkPelvisDrop, walkFootTarget } from './WalkingGait';
import { mealGesture } from './MealGesture';
import { NEED_REACTION_DURATION, needReactionWeight, pickNeedReaction, reactionAllowed,
  type NeedReaction, type ReactionNeeds } from './NeedReactions';
import { RESIDENT_IDLE_SECONDS, chooseResidentIdle, residentIdleAllowed, residentIdleWeight,
  residentIdleEase, residentIdleTouchWeight,
  type ResidentIdleContext, type ResidentIdleGesture } from './ResidentIdle';

type Pose = 'idle' | 'sit' | 'work' | 'sleep';
type Arrival = () => void;
type HandTargets = readonly [left: THREE.Vector3, right: THREE.Vector3];
type Steering = (from: FloorPoint, target: FloorPoint) => FloorPoint;
export type DomesticMotion = 'dishes' | 'wash' | 'tidy' | 'tea' | 'read' | 'phone' | 'stretch' | 'music' | 'journal' | 'games' | 'reach' | 'chat' | 'shower' | 'bath' | 'toilet' | 'teeth' | 'watch' | 'grill' | 'washHands' | 'coffee';
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
  private readonly dirtyPlate: THREE.Mesh;
  private readonly selectionRing: THREE.Mesh;
  private readonly heart: THREE.Mesh;
  private waypoints: THREE.Vector3[] = [];
  private callback: Arrival | null = null;
  private pose: Pose = 'idle';
  private gesture: SocialKind | null = null;
  private gestureTime = 0;
  private activity: 'cook' | 'eat' | Exclude<PetAction, 'buyFood'> | DomesticMotion | null = null;
  private activityTime = 0;
  private readonly props: ReturnType<typeof activityProps>;
  private carryingBook = false;
  private closingBook = 0;
  private reaction = 0;
  private needs: ReactionNeeds | null = null;
  private needReaction: NeedReaction | null = null;
  private needReactionTime = 0;
  private needReactionCooldown: number;
  private needReactionTurn = 0;
  private readonly idleContext: ResidentIdleContext = { petYaw: null, partnerYaw: null };
  private idleGesture: ResidentIdleGesture | null = null;
  private idleGestureTime = 0;
  private idleCooldown: number;
  private idleTurn = 0;

  /** Latest server-authoritative needs, used only to animate idle body language. */
  setNeeds(needs: ReactionNeeds): void { this.needs = needs; }
  /** Local visual awareness only: no game state or social actions are changed. */
  setIdleSurroundings(petYaw: number | null, partnerYaw: number | null): void {
    this.idleContext.petYaw = petYaw;
    this.idleContext.partnerYaw = partnerYaw;
  }
  currentIdleGesture(): ResidentIdleGesture | null { return this.idleGesture; }
  carryBook(color: string): void { this.carryingBook = true; this.props.color(color); }
  carryDirtyPlate(): void { this.dirtyPlate.visible = true; }
  hasDirtyPlate(): boolean { return this.dirtyPlate.visible; }
  clearProps(): void {
    this.carryingBook = false;
    this.closingBook = 0;
    this.props.hideBook();
    this.dirtyPlate.visible = false;
    this.props.brush.visible = this.props.tongs.visible = false;
  }
  watch(reaction: number): void { this.reaction = reaction; this.playDomesticActivity('watch'); }

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
  private readonly walkStep = new THREE.Vector3();
  bodyPosition(target: THREE.Vector3): THREE.Vector3 { return this.figure.getWorldPosition(target); }

  constructor(readonly id: CharacterId, start: [number, number], model?: CharacterModel) {
    this.root.position.set(start[0], 0, start[1]);
    this.needReactionCooldown = id === 'vlad' ? 5.5 : 8.0;
    this.idleCooldown = id === 'vlad' ? 4.8 : 6.3;
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

    this.props = activityProps(this.figure,this.rig.wrists);
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
    this.dirtyPlate = new THREE.Mesh(drum, finish(0xeee2ce, 'ceramic'));
    this.dirtyPlate.scale.set(.12, .013, .12);
    this.dirtyPlate.position.set(0, -.055, .02);
    this.dirtyPlate.visible = false;
    this.rig.wrists[1].add(this.dirtyPlate);

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
    const carryingDishes = this.dirtyPlate.visible;
    this.setPose('idle');
    if (carryingDishes) this.dirtyPlate.visible = true;
    // Furniture poses offset only the rendered body from its navigation root.
    // If that offset eases away *during* a new walk, the visible person can
    // pass straight through a neighbor although their navigation roots don't.
    // Reattach the body to the collision-aware root before taking a step.
    this.figureBase.set(0, 0, 0);
    this.figure.position.set(0, 0, 0);
    this.waypoints = points.map((point) => point.clone());
    this.callback = onArrive;
  }

  setPose(pose: Pose): void {
    this.waypoints = [];
    this.callback = null;
    this.pose = pose;
    this.gesture = null;
    this.activity = null;
    this.idleGesture = null;
    this.idleGestureTime = 0;
    this.idleCooldown = Math.max(this.idleCooldown, 4);
    this.keys = this.pan = this.gestureTarget = undefined;
    this.poseOffset.set(0, pose === 'sit' || pose === 'work' ? -0.26 : 0, 0);
    this.heart.visible = false;
    this.spoon.visible = false;
    this.dirtyPlate.visible = false;
    this.props.brush.visible = false;
    this.props.tongs.visible = false;
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

  eatingElapsed(): number | null { return this.activity === 'eat' ? this.activityTime : null; }

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
    this.closingBook = this.activity === 'read' && this.carryingBook ? .36 : 0;
    this.carryingBook = false;
    this.props.brush.visible = false;
    this.props.tongs.visible = false;
    if (this.activity === 'cook' || this.activity === 'bath' || this.activity === 'toilet') this.setPose('idle');
    else this.activity = null;
    this.spoon.visible = false;
    this.dirtyPlate.visible = false;
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

  private advance(dt: number, steer?: Steering): number {
    let budget = dt * HOME_WALK_SPEED;
    let traveled = 0;
    let heading = this.root.rotation.y;
    while (budget > 0 && this.waypoints.length) {
      const target = this.waypoints[0];
      const dx = target.x - this.root.position.x, dz = target.z - this.root.position.z;
      const distance = Math.hypot(dx, dz);
      const travel = Math.min(distance, budget);
      if (distance > .001) heading = Math.atan2(dx, dz);
      budget -= travel;
      const intended = travel === distance ? target : this.walkStep.copy(this.root.position).lerp(target, travel / distance);
      const next = steer ? steer(this.root.position, intended) : intended;
      if (next !== intended) {
        const sidestepX = next.x - this.root.position.x, sidestepZ = next.z - this.root.position.z;
        const sidestep = Math.hypot(sidestepX, sidestepZ);
        traveled += sidestep;
        if (sidestep > .001) heading = Math.atan2(sidestepX, sidestepZ);
        this.root.position.set(next.x, 0, next.z);
        break;
      }
      traveled += travel;
      this.root.position.copy(intended);
      if (travel < distance) break;
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

  update(dt: number, steer?: Steering): void {
    this.clock += dt;
    this.gestureTime += dt;
    this.activityTime += dt;
    const traveled = this.advance(dt, steer);
    const walking = this.waypoints.length > 0 && traveled > 0;
    const alpha = 1 - Math.exp(-dt * 11);
    this.gaitBlend = THREE.MathUtils.lerp(this.gaitBlend, walking ? 1 : 0, alpha);
    const strideLength = walkStrideLength(this.id);
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
    // Idle-only, cosmetic reactions. Never steal control, stop a route or move
    // the navigation root. Reset immediately for every gameplay animation.
    const canReact = this.pose === 'idle' && !this.activity && !this.gesture &&
      !this.carryingBook && this.closingBook <= 0 && !this.waypoints.length &&
      traveled < 0.0001 && motion < 0.08;
    if (!canReact) {
      this.needReaction = null;
      this.needReactionTime = 0;
      this.needReactionCooldown = Math.max(this.needReactionCooldown, 4);
    } else if (this.needReaction && !reactionAllowed(this.needs, this.needReaction)) {
      this.needReaction = null;
      this.needReactionTime = 0;
      this.needReactionCooldown = 2.5;
    } else if (this.needReaction) {
      this.needReactionTime += dt;
      if (this.needReactionTime >= NEED_REACTION_DURATION) {
        this.needReaction = null;
        this.needReactionCooldown = 15 + (this.needReactionTurn % 3) * 3.5 +
          (this.id === 'alina' ? 2.5 : 0);
      }
    } else {
      this.needReactionCooldown -= dt;
      if (this.needReactionCooldown <= 0) {
        this.needReaction = pickNeedReaction(this.needs, this.needReactionTurn++);
        this.needReactionTime = 0;
        if (!this.needReaction) this.needReactionCooldown = 2.5;
      }
    }
    // Natural habits fill quiet moments, but real need warnings take
    // precedence. In particular a yawn/urgent bladder gesture never gets
    // replaced by a cheery cosmetic action. Nothing here moves the root.
    const canIdle = canReact && !!this.needs && !this.needReaction &&
      !pickNeedReaction(this.needs, 0);
    if (!canIdle || (this.idleGesture && !residentIdleAllowed(this.idleGesture, this.idleContext))) {
      this.idleGesture = null;
      this.idleGestureTime = 0;
      this.idleCooldown = Math.max(this.idleCooldown, canReact ? 3 : 4);
    } else if (this.idleGesture) {
      this.idleGestureTime += dt;
      if (this.idleGestureTime >= RESIDENT_IDLE_SECONDS) {
        this.idleGesture = null;
        this.idleGestureTime = 0;
        this.idleCooldown = 7.5 + (this.idleTurn % 3) * 1.8 +
          (this.id === 'alina' ? 1.3 : 0);
      }
    } else {
      this.idleCooldown -= dt;
      if (this.idleCooldown <= 0) {
        this.idleGesture = chooseResidentIdle(this.id, this.idleContext, this.idleTurn++);
        this.idleGestureTime = 0;
      }
    }
    const next = this.waypoints[0];
    const turn = next ? THREE.MathUtils.euclideanModulo(
      Math.atan2(next.x - this.root.position.x, next.z - this.root.position.z) - this.root.rotation.y + Math.PI,
      2 * Math.PI,
    ) - Math.PI : 0;
    const lead = THREE.MathUtils.clamp(turn * 0.42, -0.19, 0.19) * motion;
    // Settle the arm swing near arrival without changing the stride or route.
    const settling = this.waypoints.length === 1 && next
      ? THREE.MathUtils.smoothstep(this.root.position.distanceTo(next), 0.02, 0.45) : 1;
    // Upright walking: very small, soft pelvis displacement instead of a
    // permanent 12 cm squat. Knee reach is solved with shorter foot arcs.
    const stanceDrop = walkPelvisDrop(this.gait, motion);
    const data = this.rig;
    const armA = this.leftArm, armB = this.rightArm;
    let leftY = -data.upperArm - data.lowerArm + 0.018;
    let rightY = leftY;
    let leftZ = -0.22 * Math.cos(stridePhase - 0.18) * motion * (0.38 + 0.62 * settling);
    let rightZ = -leftZ;
    let armSpread = -0.074 - motion * 0.009 * Math.sin(stridePhase);
    if (this.carryingBook && this.activity !== 'read') {
      rightY = -.38;
      rightZ = .23;
    }
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
          // Pick up a portion, bring it to the mouth, chew and rest between bites.
          // Each resident eats at a slightly different rhythm.
          const meal = mealGesture(a, this.id);
          bite = meal.lift;
          rightY = THREE.MathUtils.lerp(-0.40, 0.145, bite);
          rightZ = THREE.MathUtils.lerp(0.36, 0.12, bite);
          leftY = -0.43 + meal.settle * 0.025;
          leftZ = 0.30 + meal.settle * 0.018;
          gaze = .15 + .11 * bite - .035 * meal.chew + meal.glance;
          lean = .045 + .013 * meal.chew;
          expression = .065 + meal.chew * .095;
          break;
        }
        case 'dishes':
          // Both hands rinse the carried plate over the sink.
          leftY = -.11 + .04 * Math.sin(a * 4);
          rightY = -.09 - .04 * Math.sin(a * 4);
          leftZ = rightZ = .35;
          lean = .15;
          gaze = .22;
          break;
        case 'wash':
          leftY = -0.07 + 0.048 * Math.sin(a * 4.3);
          rightY = -0.08 - 0.048 * Math.sin(a * 4.3);
          leftZ = rightZ = 0.29;
          gaze = 0.10;
          break;
        case 'teeth': {
          const stroke = Math.sin(a*9.3);
          rightY = .295+stroke*.028;
          rightZ = .19+stroke*.042;
          leftY = -.31;
          gaze = .07;
          this.props.brush.visible = true;
          break;
        }
        case 'washHands':
          lean = .24;
          crouch = .08;
          gaze = .28;
          break;
        case 'grill':
          lean = .16;
          gaze = .18;
          break;
        case 'watch':
          gaze = -.05 + Math.sin(a*1.22)*.047;
          lean = -.07;
          expression = this.reaction > 0 ? .15+Math.max(0,Math.sin(a*.93))*.53 : .03;
          if (this.reaction < 0) gaze += Math.max(0,Math.sin(a*2.4))*.16;
          break;
        case 'shower':
          leftY = .20 + Math.sin(a * 4) * .13;
          rightY = .23 - Math.sin(a * 4) * .14;
          leftZ = rightZ = .24;
          armSpread = .15;
          gaze = .10 + Math.sin(a * 2.1) * .08;
          break;
        case 'bath':
          leftY = rightY = -.37;
          leftZ = .19;
          rightZ = .26;
          gaze = -.04 + Math.sin(a * 1.3) * .06;
          lean = -.13;
          break;
        case 'toilet':
          leftY = rightY = -.43;
          leftZ = rightZ = .24;
          gaze = .12;
          lean = .08;
          break;
        case 'tidy':
          leftY = -0.27 + 0.11 * Math.sin(a * 3);
          rightY = -0.21 - 0.11 * Math.sin(a * 3);
          leftZ = 0.36; rightZ = 0.43;
          crouch = 0.055;
          lean = 0.15;
          break;
        case 'coffee':
          leftY = -.32 + .045 * Math.sin(a * 2.8);
          rightY = -.15 + .085 * Math.sin(a * 3.4);
          leftZ = .31;
          rightZ = .29 + .045 * Math.cos(a * 3.4);
          gaze = .18;
          lean = .10;
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
          leftY = -.23;
          rightY = -.23 + .079*Math.sin(Math.PI*THREE.MathUtils.smoothstep(a%10.5,8.15,9.10));
          leftZ = rightZ = .36;
          armSpread = .31;
          gaze = .26+.034*Math.sin(a*1.3);
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

    // Reuse the exact same lightweight articulated rig used by cooking and
    // talking: a few soft arm/head targets, no new meshes or animation files.
    const needWeight = this.needReaction ? needReactionWeight(this.needReactionTime) : 0;
    let restlessSway = 0;
    if (needWeight > 0) {
      const w = needWeight;
      switch (this.needReaction) {
        case 'yawn': {
          // Vlad covers a yawn with his right hand; Alina with her left.
          if (this.id === 'vlad') {
            rightY = THREE.MathUtils.lerp(rightY, 0.24, w);
            rightZ = THREE.MathUtils.lerp(rightZ, 0.18, w);
          } else {
            leftY = THREE.MathUtils.lerp(leftY, 0.22, w);
            leftZ = THREE.MathUtils.lerp(leftZ, 0.19, w);
          }
          gaze = THREE.MathUtils.lerp(gaze, -0.11, w);
          lean -= 0.045 * w;
          expression = THREE.MathUtils.lerp(expression, 0.025, w);
          break;
        }
        case 'hunger':
          // One hand on the stomach, a brief forward glance.
          rightY = THREE.MathUtils.lerp(rightY, -0.47, w);
          rightZ = THREE.MathUtils.lerp(rightZ, 0.21, w);
          leftY = THREE.MathUtils.lerp(leftY, -0.55, w);
          gaze += 0.14 * w;
          lean += 0.055 * w;
          expression = THREE.MathUtils.lerp(expression, 0.018, w);
          break;
        case 'bladder':
          // Restless weight shifts, without crouching or shifting navigation.
          restlessSway = 0.034 * Math.sin(this.needReactionTime * 5.2) * w;
          leftY = THREE.MathUtils.lerp(leftY, -0.43, w);
          rightY = THREE.MathUtils.lerp(rightY, -0.40, w);
          leftZ = THREE.MathUtils.lerp(leftZ, 0.16, w);
          rightZ = THREE.MathUtils.lerp(rightZ, 0.19, w);
          gaze += 0.09 * w;
          break;
        case 'hygiene':
          // Brush an imaginary speck from a shoulder or sleeve.
          leftY = THREE.MathUtils.lerp(leftY, -0.06, w);
          leftZ = THREE.MathUtils.lerp(leftZ, 0.27, w);
          gaze += 0.12 * w;
          break;
        case 'lowMood':
          // Quiet sigh and drooping head; no gameplay penalties.
          gaze += 0.17 * w;
          lean += 0.065 * w;
          expression = THREE.MathUtils.lerp(expression, 0.01, w);
          break;
      }
    }

    // Every habit is a short choreographed sequence, not a frozen hand angle.
    // All rotations are additive to the existing articulated rig and leave
    // the foot contacts, navigation root, and server entirely untouched.
    const idleWeight = this.idleGesture ? residentIdleWeight(this.idleGestureTime) : 0;
    const idleTouch = this.idleGesture ? residentIdleTouchWeight(this.idleGestureTime) : 0;
    let idleHeadYaw = 0, idleHeadRoll = 0, idleChestRoll = 0;
    let idleChestYaw = 0, idleEyeYaw = 0, idleEyePitch = 0;
    if (idleWeight > 0) {
      const w = idleWeight;
      const phase = this.idleGestureTime;
      switch (this.idleGesture) {
        case 'think': {
          // Vlad studies something for a beat. The right hand rests on the
          // chin through a real wrist target; left hand relaxes near the waist.
          const thought = residentIdleEase(phase, 0.7, 1.55);
          leftY = THREE.MathUtils.lerp(leftY, -0.41, w);
          leftZ = THREE.MathUtils.lerp(leftZ, 0.16, w);
          rightY = THREE.MathUtils.lerp(rightY, 0.05, w);
          rightZ = THREE.MathUtils.lerp(rightZ, 0.20, w);
          gaze += (0.07 + 0.065 * thought) * w;
          idleHeadYaw = 0.07 * w;
          idleHeadRoll = 0.035 * w;
          idleChestYaw = -0.028 * w;
          lean += 0.024 * w;
          idleEyePitch += 0.055 * w;
          expression = THREE.MathUtils.lerp(expression, 0.025, w);
          break;
        }
        case 'fixHair': {
          // Alina brushes the side strands back from her temple. Separate
          // reaching and sweeping phases are handled by wrist IK below.
          const sweep = residentIdleEase(phase, 1.08, 2.68);
          leftY = THREE.MathUtils.lerp(leftY, 0.09 + 0.12 * sweep, w);
          leftZ = THREE.MathUtils.lerp(leftZ, 0.13, w);
          rightY = THREE.MathUtils.lerp(rightY, -0.50, w * .32);
          idleHeadRoll = -0.065 * w;
          idleHeadYaw = (-0.055 - 0.035 * sweep) * w;
          idleChestYaw = 0.029 * w;
          gaze -= 0.025 * w;
          expression += 0.065 * w;
          break;
        }
        case 'lookAround': {
          // Eyes lead, then head and shoulders follow. A genuine left-right
          // scan with two held glances rather than an endless sine loop.
          const scan = 0.39 * residentIdleEase(phase, 0.42, 1.35)
            - 0.71 * residentIdleEase(phase, 1.46, 2.57)
            + 0.32 * residentIdleEase(phase, 2.70, 3.44);
          const eyes = 0.43 * residentIdleEase(phase, 0.22, 1.09)
            - 0.76 * residentIdleEase(phase, 1.29, 2.32)
            + 0.33 * residentIdleEase(phase, 2.52, 3.26);
          idleHeadYaw = scan * w;
          idleEyeYaw = eyes * w * 0.32;
          idleChestYaw = scan * w * 0.22;
          idleHeadRoll = 0.035 * scan * w;
          gaze -= 0.018 * w;
          break;
        }
        case 'adjustSleeve': {
          // One forearm is lifted into view; the other reaches the actual
          // opposite sleeve for two small tugs. No large, waving motion.
          const tug = Math.sin(Math.PI * 2 * residentIdleEase(phase, 1.20, 2.68)) ** 2;
          leftY = THREE.MathUtils.lerp(leftY, -0.23, w);
          leftZ = THREE.MathUtils.lerp(leftZ, 0.37, w);
          rightY = THREE.MathUtils.lerp(rightY, -0.15 + 0.021 * tug, w);
          rightZ = THREE.MathUtils.lerp(rightZ, 0.33 + 0.018 * tug, w);
          armSpread = THREE.MathUtils.lerp(armSpread, 0.06, w);
          idleHeadYaw = -0.17 * w;
          gaze += 0.13 * w;
          idleEyePitch += 0.055 * w;
          idleChestYaw = -0.042 * w;
          break;
        }
        case 'shiftWeight': {
          // Feet remain planted. A relaxed hip/shoulder counterbalance makes
          // a living silhouette without the old squatting gait.
          const shift = Math.sin(Math.PI * residentIdleEase(phase, 0.35, 3.35));
          const side = this.id === 'vlad' ? 1 : -1;
          idleChestRoll = side * 0.072 * shift * w;
          idleHeadRoll = -idleChestRoll * 0.64;
          idleChestYaw = side * 0.041 * shift * w;
          idleHeadYaw = -side * 0.045 * shift * w;
          rightY = THREE.MathUtils.lerp(rightY, -0.45, w * .57);
          rightZ = THREE.MathUtils.lerp(rightZ, 0.14, w * .57);
          leftY = THREE.MathUtils.lerp(leftY, -0.50, w * .45);
          lean -= 0.013 * shift * w;
          break;
        }
        case 'stretchNeck': {
          // Slow neck release from one shoulder to the other. Open chest,
          // small shoulder movement, and a gentle exhale.
          const release = 0.17 * residentIdleEase(phase, 0.55, 1.34)
            - 0.34 * residentIdleEase(phase, 1.47, 2.48)
            + 0.17 * residentIdleEase(phase, 2.72, 3.45);
          idleHeadRoll = release * w;
          idleHeadYaw = release * w * 0.22;
          idleChestRoll = -release * w * 0.28;
          leftY = THREE.MathUtils.lerp(leftY, -0.42, w);
          rightY = THREE.MathUtils.lerp(rightY, -0.42, w);
          armSpread = THREE.MathUtils.lerp(armSpread, 0.068, w);
          gaze -= 0.075 * w;
          lean -= 0.045 * w;
          expression = THREE.MathUtils.lerp(expression, 0.12, w);
          break;
        }
        case 'noticePet': {
          // A real pet nearby catches the gaze. Mild head/chest rotation and
          // a fond downward glance, never a fake petting/feed action.
          const yaw = THREE.MathUtils.clamp(this.idleContext.petYaw ?? 0, -0.68, 0.68);
          idleHeadYaw = yaw * 0.79 * w;
          idleChestYaw = yaw * 0.21 * w;
          idleEyeYaw = yaw * 0.21 * w;
          idleEyePitch += 0.085 * w;
          gaze += 0.18 * w;
          lean += 0.026 * w;
          idleHeadRoll = (yaw >= 0 ? 1 : -1) * 0.027 * w;
          expression += 0.14 * w;
          break;
        }
        case 'noticePartner': {
          // A restrained friendly acknowledgement: eyes, half-smile and
          // slight hand movement. This is not a server social interaction.
          const yaw = THREE.MathUtils.clamp(this.idleContext.partnerYaw ?? 0, -0.65, 0.65);
          idleHeadYaw = yaw * 0.76 * w;
          idleChestYaw = yaw * 0.23 * w;
          idleEyeYaw = yaw * 0.22 * w;
          idleHeadRoll = -0.032 * w;
          expression += 0.21 * w;
          const nod = Math.sin(Math.PI * residentIdleEase(phase, 1.15, 2.52));
          gaze += 0.038 * nod * w;
          rightY = THREE.MathUtils.lerp(rightY, -0.43, w * 0.42);
          rightZ = THREE.MathUtils.lerp(rightZ, 0.18 + .017 * nod, w * 0.52);
          break;
        }
      }
    }

    this.spoon.visible = this.activity === 'cook' || this.activity === 'eat';
    this.props.tongs.visible = this.activity === 'grill';
    if (this.props.tongs.visible) this.props.grip(a);
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
        const foot = walkFootTarget(this.gait, i as 0 | 1,
          data.thighLength + data.shinLength, strideLength, motion, stanceDrop, this.crouchBlend);
        toePitch = foot.toePitch;
        // Frame-rate independent damping: do not snap legs between poses.
        const legBlend = 1 - Math.exp(-dt * (12 + 15 * motion));
        this.bend(upper, knee, data.thighLength, data.shinLength, foot.y, foot.z, 1, legBlend);
      }
      const ankle = data.ankles[i];
      ankle.rotation.x = THREE.MathUtils.lerp(ankle.rotation.x,
        asleep ? -0.10 : toePitch - upper.rotation.x - knee.rotation.x,
        1 - Math.exp(-dt * (12 + 15 * motion)));
    }

    const idleLook = seated || asleep || this.activity || this.gesture || this.idleGesture ? 0 : Math.sin(t * 0.53) ** 7;
    if (data.animateFace) {
      const eyeYaw = asleep ? 0 : this.pose === 'work' ? 0.046 * Math.sin(t * 1.53) :
        (0.10 * idleLook + lead * 0.44) * (1 - 0.4 * motion) + idleEyeYaw;
      const eyePitch = asleep ? 0 : this.activity === 'cook' ? 0.07 :
        this.pose === 'work' ? 0.030 + 0.046 * Math.sin(t * 1.18) :
        0.025 * Math.sin(t * 0.67) + idleEyePitch;
      data.animateFace(dt, asleep || (this.needReaction === 'yawn' && needWeight > 0.60),
        expression, eyeYaw, eyePitch);
    } else {
      const blinkTime = t % (this.id === 'vlad' ? 6.3 : 7.15);
      const blink = asleep ? 0.13 : blinkTime < 0.17 ? 1 - 0.89 * Math.sin(blinkTime / 0.17 * Math.PI) : 1;
      for (const eye of data.eyes) eye.scale.y = THREE.MathUtils.lerp(eye.scale.y, blink, alpha);
    }
    const look = 0.20 * idleLook + lead + idleHeadYaw;
    data.head.rotation.y = THREE.MathUtils.lerp(data.head.rotation.y, look - motion * 0.061 * Math.sin(stridePhase), alpha);
    data.head.rotation.x = THREE.MathUtils.lerp(data.head.rotation.x, gaze + 0.022 * breath - lean * 0.55, alpha);
    data.head.rotation.z = THREE.MathUtils.lerp(data.head.rotation.z,
      0.018 * Math.sin(t * 0.73) - restlessSway * 0.4 + idleHeadRoll, alpha);
    data.hair.rotation.y = -data.head.rotation.y * 0.16 + motion * Math.cos(stridePhase - 0.6) * 0.031 +
      (this.idleGesture === 'fixHair' ? 0.025 * idleTouch * Math.sin(this.idleGestureTime * 1.4) : 0);
    data.hair.rotation.x = -data.head.rotation.x * 0.05 + motion * Math.sin(stridePhase) * 0.031;

    data.chest.rotation.x = THREE.MathUtils.lerp(data.chest.rotation.x, lean + motion * 0.025, alpha);
    data.chest.rotation.y = THREE.MathUtils.lerp(data.chest.rotation.y,
      motion * 0.055 * Math.cos(stridePhase) + idleChestYaw, alpha);
    data.chest.rotation.z = THREE.MathUtils.lerp(data.chest.rotation.z,
      0.016 * Math.sin(t * 0.71) + motion * 0.027 * Math.sin(stridePhase) + restlessSway + idleChestRoll, alpha);
    data.chest.position.z = -Math.sin(data.chest.rotation.x) * data.waistY;
    data.chest.position.y = (1 - Math.cos(data.chest.rotation.x)) * data.waistY + 0.006 * breath;

    this.figureBase.lerp(this.poseOffset, 1 - Math.exp(-dt * 8));
    this.figure.position.copy(this.figureBase);
    // Close the visual gap during a hug while the path endpoints stay fixed.
    this.figure.position.z += embrace;
    this.figure.position.y -= stanceDrop + this.crouchBlend;
    this.figure.position.x += motion * 0.011 * Math.sin(stridePhase) + restlessSway * 0.15;
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
    // The old idle gestures only raised an elbow toward the face. Use
    // the existing two-bone IK solver to put the wrist at a meaningful
    // contact point, following the animated head/chest and their real scale.
    // The same code works with lightweight fallback and Blender skin rigs.
    if (idleTouch > 0.002 && this.idleGesture) {
      let contactHand: 0 | 1 | null = null;
      if (this.idleGesture === 'think') {
        // Right fingertips near chin, safely in front of the face.
        data.head.localToWorld(this.target.set(0.108, -0.151, 0.180));
        contactHand = 1;
      } else if (this.idleGesture === 'fixHair') {
        // Left fingertips travel from cheek-side hair to the temple/crown.
        const sweep = residentIdleEase(this.idleGestureTime, 1.1, 2.73);
        data.head.localToWorld(this.target.set(-0.184 + 0.028 * sweep,
          0.019 + 0.124 * sweep, 0.144 - 0.031 * sweep));
        contactHand = 0;
      } else if (this.idleGesture === 'adjustSleeve') {
        // Contact above left elbow, in the local chest frame. The left arm
        // was already brought forward by the pose pass above.
        const tug = Math.sin(this.idleGestureTime * 8.3) ** 2;
        data.chest.localToWorld(this.target.set(-0.183,
          1.170 + .013 * tug, .195));
        contactHand = 1;
      }
      if (contactHand !== null) {
        const reachBlend = Math.min(1, idleTouch * alpha * 7.4);
        this.reach(contactHand, this.target, reachBlend);
        this.aimHand(contactHand,
          this.handDirection.set(contactHand === 0 ? -0.18 : 0.11,
            -0.18, -1).applyAxisAngle(up, this.root.rotation.y),
          Math.min(1, idleTouch * alpha * 4.3));
      }
    }
    if (counter) {
      for (const i of [0, 1] as const) {
        this.target.copy(counter);
        if (this.activity === 'dishes') {
          this.target.x += (i ? -.07 : .07) + .035 * Math.sin(a * 4.5 + i * Math.PI);
          this.target.y += .02 * Math.cos(a * 5 + i * Math.PI);
          this.target.z += .045 * Math.sin(a * 3.4);
        } else if (this.activity === 'washHands') {
          this.target.x += (i ? -.044 : .044) + .025 * Math.sin(a * 7 + i * Math.PI);
          this.target.y += .019 * Math.cos(a * 7 + i * Math.PI);
          this.target.z += .038 * Math.sin(a * 5);
        } else if (this.activity === 'grill') {
          this.target.x += i ? .23 * Math.sin(a * 1.9) : -.23;
          this.target.y += i ? .07 + .08 * Math.max(0, Math.sin(a * 3.4)) : .04;
          this.target.z += i ? .08 : .22;
        } else {
          this.target.x += (i ? -.12 : .12) + .075 * Math.sin(a * (this.activity === 'tidy' ? 4 : 6) + i);
          this.target.y += .025 * Math.sin(a * 6 + i * 2);
          this.target.z += .045 * Math.cos(a * 4 + i);
        }
        this.reach(i, this.target, alpha);
      }
    }

    this.selectionRing.position.x = this.figureBase.x;
    this.selectionRing.position.z = this.figureBase.z;
    if (this.carryingBook || this.closingBook > 0) {
      this.props.book(this.activityTime,this.activity === 'read',this.closingBook/.36);
      this.closingBook = Math.max(0,this.closingBook-dt);
    } else this.props.hideBook();
  }
}
