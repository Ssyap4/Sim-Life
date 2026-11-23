import * as THREE from 'three';
import type { CharacterId, SocialKind } from '../shared/protocol';
import type { PairMotion } from '../shared/socialLife';
import type { PetAction } from '../shared/pets';
import type { RecipeId, TakeoutId } from '../shared/food';
import { kitchenMove, grillMove, helperChop, mealUtensil } from './CookingChoreography';
import { buildCharacterArt, type CharacterModel, type CharacterRig } from './CharacterArt';
import { HOME_WALK_SPEED } from '../shared/home';
import { activityProps } from './ActivityProps';
import { drum, finish, orb } from './ArtKit';
import type { FloorPoint } from './navigation';
import { walkStrideLength, walkPelvisDrop, walkFootTarget } from './WalkingGait';
import { mealGesture } from './MealGesture';
import { NEED_REACTION_DURATION, needReactionWeight, pickNeedReaction, reactionAllowed,
  type NeedReaction, type ReactionNeeds } from './NeedReactions';
import { characterDemeanor } from './CharacterDemeanor';
import { RESIDENT_IDLE_SECONDS, chooseResidentIdle, residentIdleAllowed, residentIdleWeight,
  residentIdleEase, residentIdleTouchWeight,
  type ResidentIdleContext, type ResidentIdleGesture } from './ResidentIdle';

type Pose = 'idle' | 'sit' | 'work' | 'sleep';
type Arrival = () => void;
type HandTargets = readonly [left: THREE.Vector3, right: THREE.Vector3];
type Steering = (from: FloorPoint, target: FloorPoint) => FloorPoint;
export type DomesticMotion = 'dishes' | 'wash' | 'tidy' | 'tea' | 'read' | 'phone' | 'stretch' | 'music' | 'journal' | 'games' | 'reach' | 'chat' | 'shower' | 'bath' | 'toilet' | 'teeth' | 'watch' | 'grill' | 'washHands' | 'coffee' | 'prep';
const COUNTER_ACTIONS: ReadonlySet<DomesticMotion> = new Set([
  'dishes', 'wash', 'washHands', 'grill', 'tidy', 'coffee', 'tea', 'prep',
]);
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
  private readonly foodContainer = new THREE.Group();
  private readonly selectionRing: THREE.Mesh;
  private readonly heart: THREE.Mesh;
  private waypoints: THREE.Vector3[] = [];
  private callback: Arrival | null = null;
  private pose: Pose = 'idle';
  private gesture: SocialKind | null = null;
  private gestureTime = 0;
  private partnerGesture: { motion:PairMotion; leads:boolean; target?:THREE.Vector3; time:number }|null=null;
  private activity: 'cook' | 'eat' | Exclude<PetAction, 'buyFood'> | DomesticMotion | null = null;
  private activityTime = 0;
  private cookingRecipe: RecipeId | undefined;
  private diningDish: RecipeId | TakeoutId | undefined;
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
  private arrivalUntil = -1;
  private greeting = false;
  private nextGreeting = 0;

  /** Latest server-authoritative needs, used only to animate idle body language. */
  setNeeds(needs: ReactionNeeds): void { this.needs = needs; }
  /** Local visual awareness only: no game state or social actions are changed. */
  setIdleSurroundings(petYaw: number | null, partnerYaw: number | null): void {
    // An approaching partner gets one friendly acknowledgement after a
    // genuine gap in proximity, never an automatic social task or kiss.
    if (partnerYaw !== null && this.idleContext.partnerYaw === null)
      this.noticePartnerArrival();
    this.idleContext.petYaw = petYaw;
    this.idleContext.partnerYaw = partnerYaw;
  }
  currentIdleGesture(): ResidentIdleGesture | null { return this.idleGesture; }
  noticePartnerArrival():void {
    if(this.clock<this.nextGreeting)return;
    // A meeting may supersede an existing purely decorative hair/idle gesture,
    // otherwise its next 8-second cooldown can swallow the entire hello.
    // Never interrupt a real action, route, need warning, or paired animation.
    this.arrivalUntil=this.clock+6;
    if(this.pose==='idle' && !this.activity && !this.waypoints.length &&
      !this.gesture && !this.partnerGesture && !this.needReaction &&
      !this.carryingBook && this.closingBook<=0){
      this.idleGesture=null;
      this.idleGestureTime=0;
      this.idleCooldown=0;
    }
  }
  carryBook(color: string): void { this.carryingBook = true; this.props.color(color); }
  carryDirtyPlate(): void { this.dirtyPlate.visible = true; }
  carryFoodContainer(): void { this.foodContainer.visible = true; }
  hideFoodContainer(): void { this.foodContainer.visible = false; }
  hasFoodContainer(): boolean { return this.foodContainer.visible; }
  hasDirtyPlate(): boolean { return this.dirtyPlate.visible; }
  clearProps(): void {
    this.carryingBook = false;
    this.closingBook = 0;
    this.props.hideBook();
    this.dirtyPlate.visible = false;
    this.foodContainer.visible = false;
    this.props.brush.visible = this.props.tongs.visible = this.props.groomingBrush.visible = this.props.knife.visible = this.props.fork.visible = false;
    this.cookingRecipe = undefined;
    this.diningDish = undefined;
    this.petContact = undefined;
  }
  watch(reaction: number): void { this.reaction = reaction; this.playDomesticActivity('watch'); }

  private readonly poseOffset = new THREE.Vector3();
  private keys: HandTargets | undefined;
  private pan: THREE.Vector3 | undefined;
  private gestureTarget: THREE.Vector3 | undefined;
  private petContact: THREE.Vector3 | undefined;
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
    // Small covered box, only displayed when a real leftover transfer runs.
    const tray=new THREE.Mesh(drum,finish(0xece5d9,'ceramic'));
    tray.scale.set(.13,.020,.098);
    const food=new THREE.Mesh(orb,finish(0xbd8051,'ceramic'));
    food.scale.set(.085,.023,.063);food.position.y=.023;
    const lid=new THREE.Mesh(drum,finish(0xc3d6d0,'ceramic'));
    lid.scale.set(.133,.012,.103);lid.position.y=.054;
    this.foodContainer.add(tray,food,lid);
    this.foodContainer.position.set(0,-.056,.020);
    this.foodContainer.visible=false;
    this.rig.wrists[1].add(this.foodContainer);

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
    const carryingFood = this.foodContainer.visible;
    this.setPose('idle');
    if (carryingDishes) this.dirtyPlate.visible = true;
    if (carryingFood) this.foodContainer.visible = true;
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
    this.partnerGesture = null;
    this.activity = null;
    this.cookingRecipe = undefined;
    this.diningDish = undefined;
    this.idleGesture = null;
    this.idleGestureTime = 0;
    this.idleCooldown = Math.max(this.idleCooldown, 4);
    this.keys = this.pan = this.gestureTarget = this.petContact = undefined;
    this.poseOffset.set(0, pose === 'sit' || pose === 'work' ? -0.26 : 0, 0);
    this.heart.visible = false;
    this.spoon.visible = false;
    this.dirtyPlate.visible = false;
    this.foodContainer.visible = false;
    this.props.brush.visible = false;
    this.props.groomingBrush.visible = false;
    this.props.tongs.visible = false;
    this.props.knife.visible = false;
    this.props.fork.visible = false;
  }

  /** Pose the visible character on the furniture while the navigation root
   * stays in its safe, server-saved approach location. */
  setFurniturePose(pose: Pose, worldAnchor: THREE.Vector3, yaw: number, keys?: HandTargets): void {
    this.setPose(pose);
    this.root.rotation.y = yaw;
    const local = worldAnchor.clone().sub(this.root.position);
    local.applyAxisAngle(THREE.Object3D.DEFAULT_UP, -yaw);
    this.poseOffset.copy(local);
    // Newly purchased desks do not supply explicit keyboard anchors. Generate
    // them from the actual chair and its yaw, rather than typing in mid-air.
    // The keyboard is at absolute desk height; the chair's negative Y is only
    // a visual sitting offset and must not be added to the key positions.
    if (pose === 'work' && !keys) {
      const keyAt = (x: number) => new THREE.Vector3(x, .80, .47)
        .applyAxisAngle(up, yaw)
        .add(new THREE.Vector3(worldAnchor.x, 0, worldAnchor.z));
      this.keys = [keyAt(-.15), keyAt(.15)];
    } else this.keys = keys;
  }

  isWalking(): boolean { return this.waypoints.length > 0; }
  eatingElapsed(): number | null { return this.activity === 'eat' ? this.activityTime : null; }

  playActivity(kind: 'cook' | 'eat', pan?: THREE.Vector3, recipe?: RecipeId|TakeoutId): void {
    // World has already placed the actor at the visual station.
    this.activity = kind;
    this.pan = pan?.clone();
    this.cookingRecipe = kind === 'cook' ? recipe as RecipeId : undefined;
    this.diningDish = kind === 'eat' ? recipe : undefined;
    this.activityTime = 0;
  }

  playDomesticActivity(kind: DomesticMotion, target?: THREE.Vector3, recipe?: RecipeId): void {
    this.activity = kind;
    this.pan = target?.clone();
    this.cookingRecipe = kind === 'grill' || kind === 'prep' ? recipe : undefined;
    this.diningDish = undefined;
    this.activityTime = 0;
  }

  finishActivity(): void {
    this.partnerGesture=null;
    this.gesture=null;
    this.heart.visible=false;
    this.closingBook = this.activity === 'read' && this.carryingBook ? .36 : 0;
    this.carryingBook = false;
    this.props.brush.visible = false;
    this.props.groomingBrush.visible = false;
    this.props.tongs.visible = false;
    this.props.knife.visible = false;
    this.props.fork.visible = false;
    this.cookingRecipe = undefined;
    this.diningDish = undefined;
    this.petContact = undefined;
    if (this.activity === 'cook' || this.activity === 'bath' || this.activity === 'toilet') this.setPose('idle');
    else this.activity = null;
    this.spoon.visible = false;
    this.dirtyPlate.visible = false;
    this.foodContainer.visible = false;
  }

  playPetActivity(kind: Exclude<PetAction, 'buyFood'>, petContact?: THREE.Vector3): void {
    this.setPose('idle');
    this.activity = kind;
    this.petContact = petContact?.clone();
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

  playPartnerGesture(motion:PairMotion,leads:boolean,target?:THREE.Vector3):void {
    this.partnerGesture={motion,leads,target,time:0};
    this.idleGesture=null;
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

  /** World-space station target with offsets in the actor's facing direction.
   * Reusing the scratch vectors avoids per-frame garbage on mobile. */
  private stationTarget(surface: THREE.Vector3, sideways: number, height: number, forward: number): THREE.Vector3 {
    return this.target.copy(surface).add(
      this.handDirection.set(sideways, height, forward).applyAxisAngle(up, this.root.rotation.y));
  }

  update(dt: number, steer?: Steering): void {
    this.clock += dt;
    this.gestureTime += dt;
    this.activityTime += dt;
    if(this.partnerGesture)this.partnerGesture.time+=dt;
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
    const canReact = this.pose === 'idle' && !this.activity && !this.gesture && !this.partnerGesture &&
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
      this.greeting=false;
      this.idleGestureTime = 0;
      this.idleCooldown = Math.max(this.idleCooldown, canReact ? 3 : 4);
    } else if (this.idleGesture) {
      this.idleGestureTime += dt;
      if (this.idleGestureTime >= RESIDENT_IDLE_SECONDS) {
        this.idleGesture = null;
        this.greeting=false;
        this.idleGestureTime = 0;
        this.idleCooldown = 7.5 + (this.idleTurn % 3) * 1.8 +
          (this.id === 'alina' ? 1.3 : 0);
      }
    } else {
      this.idleCooldown -= dt;
      if(this.clock<=this.arrivalUntil&&residentIdleAllowed('noticePartner',this.idleContext)&&
        characterDemeanor(this.needs,'idle').friendly){
        this.idleGesture='noticePartner';
        this.idleGestureTime=0;
        this.greeting=true;
        this.arrivalUntil=-1;
        this.nextGreeting=this.clock+80;
      }else if (this.idleCooldown <= 0) {
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
    if (this.foodContainer.visible) {
      rightY = -.32;
      rightZ = .30;
    }
    let expression = asleep ? 0.07 : 0.055 + 0.055 * Math.max(0, Math.sin(t * 0.39)) ** 5;
    if (asleep) {
      // Relax the arms beside the torso. The old bent-chest pose rotated the
      // hands straight up into the air when the whole rig reclined in bed.
      leftY = -data.upperArm - data.lowerArm + 0.11;
      rightY = -data.upperArm - data.lowerArm + 0.13;
      leftZ = 0.04;
      rightZ = 0.06;
      armSpread = -0.11;
    }
    if (seated) {
      leftY = rightY = -0.44;
      leftZ = rightZ = 0.29;
    }
    if (this.pose === 'work') {
      // Existing keyboard placement is untouched. Add believable cycles:
      // bursts of typing, a short pause to check the monitor, then typing.
      const cycle=(t + (this.id==='vlad'?0:2.8))%11.6;
      const pause=THREE.MathUtils.smoothstep(cycle,4.8,5.5) *
        (1-THREE.MathUtils.smoothstep(cycle,6.6,7.15));
      gaze += 0.032*Math.sin(t*1.18) - .10*pause;
      lean+=.035*pause;
      const beats=1-pause;
      const leftTap = beats * Math.max(0, Math.sin(t * 9.0)) ** 2;
      const rightTap = beats * Math.max(0, Math.sin(t * 11.4 + 1.3)) ** 2;
      leftY = 0.097 - leftTap * 0.022;
      rightY = 0.100 - rightTap * 0.022;
      leftZ = 0.48 + leftTap * 0.025;
      rightZ = 0.51 + rightTap * 0.027;
    }

    let crouch = 0;
    let bite = 0;
    const a = this.activityTime;
    const kitchenStep = this.activity === 'cook' ? kitchenMove(this.cookingRecipe,a) : undefined;
    const barbecueStep = this.activity === 'grill' ? grillMove(this.cookingRecipe,a) : undefined;
    if (this.activity) {
      switch (this.activity) {
        case 'cook':
          leftY = -.24;
          rightY = -.218 + Math.sin(a * (kitchenStep==='chop'?7:4.2))*.032;
          leftZ = .36;
          rightZ = .43 + Math.cos(a*4.2)*.053;
          lean = kitchenStep==='knead'?.17:.13;
          gaze = .20;
          break;
        case 'prep':
          leftY = -.24;
          rightY = -.19 + Math.sin(a*6.0)*.045;
          leftZ=.33; rightZ=.41;
          lean=.14; gaze=.20;
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
          // Keep the brush near the mouth, not above the eye/temple. Tiny
          // strokes are enough; the head should not intersect the forearm.
          const stroke = Math.sin(a*8.0);
          rightY = .075 + stroke*.018;
          rightZ = .19 + stroke*.020;
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
        case 'watch': {
          // Keep the established sofa pose. React with small gestures to the
          // genre, without popping up or resetting another character's seat.
          const beat=Math.max(0,Math.sin(a*.93));
          const laugh=this.reaction>0?beat*beat:0;
          const tense=this.reaction<0?Math.max(0,Math.sin(a*2.4)):0;
          const relax=.5+.5*Math.sin(a*.46+(this.id==='vlad'?0:1.4));
          gaze=-.05+Math.sin(a*1.22)*.047+.16*tense-.035*laugh;
          lean=-.07 + tense*.048 - laugh*.038;
          leftY=-.43 + laugh*.09 - tense*.04;
          rightY=-.40 + laugh*.19 - tense*.06;
          leftZ=.26 + laugh*.035;rightZ=.26 + laugh*.11;
          armSpread=-.06+relax*.025;
          expression=this.reaction>0?.15+laugh*.5:this.reaction<0?.035:.08;
          break;
        }
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
        case 'brush': {
          // Short, repeatable strokes, with the body leaning toward the pet.
          // No navigation or physics movement: only bones and a held prop.
          const stroke = Math.sin(a * 6.2);
          crouch = .20;
          lean = .38 + .016 * stroke;
          gaze = .29;
          leftY = -.31;
          leftZ = .31;
          rightY = -.19 + .045 * stroke;
          rightZ = .40 + .055 * stroke;
          expression = .17;
          break;
        }
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
      // A high-five must remain visible long enough for both people to meet palms.
      // The earlier 1.4s envelope ended before much of the 5s co-op action.
      const duration = 5; // matched to the full cooperative server action
      // The high-five reaches full palm contact in the first half second,
      // then holds it for the joint action; normalizing across five seconds
      // used to delay the touch until after the other arm had already passed.
      const reach = this.gesture === 'hug'
        ? THREE.MathUtils.smoothstep(g,.12,.65) * (1-THREE.MathUtils.smoothstep(g,3.35,4.35))
        : THREE.MathUtils.smoothstep(g,.07,.28) * (1-THREE.MathUtils.smoothstep(g,4.05,4.75));
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
      if (g >= duration + .05) this.setPose('idle');
    }

    const pair=this.partnerGesture;
    let partnerRoll=0, partnerHead=0, partnerReach=0, partnerForward=0;
    if(pair){
      const sec=pair.time;
      const rise=THREE.MathUtils.smoothstep(sec,.12,.78);
      // Contact is sustained for the server action's real duration (5 / 8 /
      // 13 seconds), then released gradually instead of freezing halfway.
      const longDance = pair.motion==='slowDance'||pair.motion==='dance';
      const shortContact = pair.motion==='hug'||pair.motion==='closeHug'||
        pair.motion==='kiss'||pair.motion==='cheek'||pair.motion==='highFive';
      const duration = longDance ? 13 : shortContact ? 5 : 8;
      const contact=rise*(1-THREE.MathUtils.smoothstep(sec,duration-1.45,duration-.40));
      switch(pair.motion){
        case 'hug':case 'closeHug': {
          const weight=contact;
          leftY=rightY=-.54+.47*weight; leftZ=rightZ=.39*weight;
          armSpread+=.39*weight; embrace=weight*.12; lean=.18*weight;
          partnerForward=.085*weight;
          expression=.13+.45*weight; partnerHead=(pair.leads?-.11:.14)*weight;
          break;
        }
        case 'kiss':case 'cheek':
          lean+=(pair.motion==='kiss'?.23:pair.leads?.19:.045)*contact;
          partnerForward=(pair.motion==='kiss'?.128:pair.leads?.154:.055)*contact;
          partnerHead=(pair.motion==='cheek'?.21:.17)*(pair.leads?-1:1)*contact;
          gaze+=(pair.leads?-.075:.055)*contact; expression+=.28*rise;
          leftY+=.07*contact; rightY+=.11*contact;
          break;
        case 'hands':case 'slowDance':
          partnerReach=contact; rightY+=.18*contact; leftY+=.12*contact; expression+=.24*contact;
          partnerRoll=pair.motion==='slowDance'?Math.sin(sec*1.6)*.095*contact:.03*contact; gaze-=.025*contact;
          break;
        case 'hair':case 'shoulder':
          partnerReach=pair.leads?contact:0;
          if(pair.leads) { rightY+=.43*contact; rightZ+=.22*contact; lean+=.06*contact; }
          else partnerHead=.10*contact;
          expression+=.20*rise; break;
        case 'cuddle':
          partnerRoll=(this.id==='vlad'?.15:-.15)*contact;
          partnerHead=partnerRoll*.5;
          lean-=.055*contact; expression+=.29*contact; break;
        case 'dance':
          partnerRoll=Math.sin(sec*3.6)*.16*contact; crouch+=.055*(1+Math.cos(sec*4.2))*contact;
          leftY+=.36*(.60+.4*Math.sin(sec*3.6))*contact; rightY+=.36*(.60-.4*Math.sin(sec*3.6))*contact;
          leftZ+=.20*contact;rightZ+=.22*contact;expression+=.45*contact;break;
        case 'laugh':
          lean+=.11*Math.max(0,Math.sin(sec*5))*contact; partnerRoll=.06*Math.sin(sec*4)*contact;
          rightY+=.20*contact; expression+=.64*contact; break;
        default: {
          const speaking=pair.leads?sec%8<3.4:sec%8>=3.4;
          const breadth=pair.motion==='explain'?.28:pair.motion==='listen'?.10:.18;
          if(speaking){
            rightY+=breadth*(.55+.45*Math.sin(sec*3.4))*contact;
            rightZ+=breadth*contact;leftY+=breadth*.48*Math.sin(sec*2.47)*contact;
          }else gaze+=.07*Math.max(0,Math.sin(sec*2.4))*contact;
          partnerHead=.048*Math.sin(sec*1.72)*contact;expression+=.17*contact;
        }
      }
    }

    // Continuous, small expressions across ordinary idle and walking.
    // Active cooking, seats, hugs and sleep keep their original authored poses.
    const demeanor=characterDemeanor(this.needs,asleep?'sleep':
      this.activity||this.gesture||this.partnerGesture||seated?'busy':motion>.08?'walking':'idle');
    lean+=demeanor.shoulders;
    gaze+=demeanor.gaze;
    expression=Math.min(.78,expression+demeanor.smile);

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
        case 'studyPalm': {
          const examine=residentIdleEase(phase,.67,1.5)*(1-residentIdleEase(phase,2.5,3.42));
          rightY=THREE.MathUtils.lerp(rightY,-.10,w);
          rightZ=THREE.MathUtils.lerp(rightZ,.26,w);
          leftY=THREE.MathUtils.lerp(leftY,-.37,w*.6);
          idleHeadYaw=.10*w;
          gaze+=.18*w;
          idleEyePitch+=.08*examine;
          expression+=.025*w;
          break;
        }
        case 'rubShoulder': {
          const press=residentIdleEase(phase,.54,1.14)*(1-residentIdleEase(phase,2.85,3.45));
          rightY=THREE.MathUtils.lerp(rightY,-.01,w);
          rightZ=THREE.MathUtils.lerp(rightZ,.23,w);
          idleHeadRoll=.055*w;
          idleHeadYaw=-.07*w;
          idleChestRoll=-.025*press;
          gaze+=.05*press;
          break;
        }
        case 'easeWrists': {
          const movement=Math.sin(phase*4.1)*w;
          leftY=THREE.MathUtils.lerp(leftY,-.18,w);
          rightY=THREE.MathUtils.lerp(rightY,-.19+.024*movement,w);
          leftZ=THREE.MathUtils.lerp(leftZ,.32,w);
          rightZ=THREE.MathUtils.lerp(rightZ,.34,w);
          idleHeadYaw=-.12*w;
          gaze+=.12*w;
          expression+=.042*w;
          break;
        }
        case 'steadyBreath': {
          const inhale=Math.sin(Math.PI*residentIdleEase(phase,.45,3.2))*w;
          idleChestRoll=(this.id==='vlad'?.035:-.035)*inhale;
          idleHeadRoll=-idleChestRoll*.55;
          idleChestYaw=.016*inhale;
          lean-=.052*inhale;
          leftY=THREE.MathUtils.lerp(leftY,-.45,w*.45);
          rightY=THREE.MathUtils.lerp(rightY,-.45,w*.45);
          armSpread=THREE.MathUtils.lerp(armSpread,.065,w);
          expression=THREE.MathUtils.lerp(expression,.17,w);
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
          if(this.greeting){
            // A single calm hello, readable even at a normal phone camera
            // distance. Arm rises beside the shoulder, then settles.
            // No extra social action, root displacement or forced embrace.
            const wave=residentIdleEase(phase,.32,.86)*
              (1-residentIdleEase(phase,2.12,2.96));
            // The raised hand is solved at the wrist below, not by a
            // shoulder-only twist (which could flip the arm behind the body).
            idleChestYaw+=yaw*.18*wave;
            idleHeadYaw+=yaw*.08*wave;
            expression+=.10*wave;
          }
          break;
        }
      }
    }

    const eatingWith = mealUtensil(this.diningDish);
    this.spoon.visible = (this.activity === 'cook' &&
      (kitchenStep === 'whisk' || kitchenStep === 'stir')) ||
      (this.activity === 'eat' && eatingWith === 'spoon');
    this.props.fork.visible = this.activity === 'eat' && eatingWith === 'fork';
    this.props.knife.visible = (this.activity === 'cook' && kitchenStep === 'chop') ||
      (this.activity === 'prep' && helperChop(a));
    this.props.groomingBrush.visible = this.activity === 'brush';
    this.props.tongs.visible = this.activity === 'grill';
    if (this.props.tongs.visible) this.props.grip(a);
    // Do not overwrite the spoon quaternion immediately before aimSpoon():
    // that used to reset its orientation every frame, so the tip could never
    // settle at the pan even though the wrist was correctly positioned.
    if (this.activity !== 'cook' || !this.pan) {
      this.spoon.rotation.y = .02;
      this.spoon.rotation.x = this.activity === 'cook' ? .56 : .31;
    }
    this.crouchBlend = THREE.MathUtils.lerp(this.crouchBlend, crouch, alpha);
    const armZ = this.activity === 'cook' ? -0.11 + Math.sin(a * 5) * 0.15 : armSpread;
    // Keep keyboard IK in the base work pose (including remote career rigs),
    // but do not type while explicitly reading or writing a paper journal.
    const typing = this.pose === 'work' && (this.activity === 'games' || this.activity === null) && this.keys;
    const stirring = this.activity === 'cook' && this.pan;
    // Face-level actions (teeth, phone, reach) must not be mistaken for
    // two-handed counter work just because World supplied a focus point.
    const counter = this.pan && this.activity && COUNTER_ACTIONS.has(this.activity as DomesticMotion)
      ? this.pan : undefined;
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
      0.018 * Math.sin(t * 0.73) - restlessSway * 0.4 + idleHeadRoll + partnerHead, alpha);
    data.hair.rotation.y = -data.head.rotation.y * 0.16 + motion * Math.cos(stridePhase - 0.6) * 0.031 +
      (this.idleGesture === 'fixHair' ? 0.025 * idleTouch * Math.sin(this.idleGestureTime * 1.4) : 0);
    data.hair.rotation.x = -data.head.rotation.x * 0.05 + motion * Math.sin(stridePhase) * 0.031;

    data.chest.rotation.x = THREE.MathUtils.lerp(data.chest.rotation.x, lean + motion * 0.025, alpha);
    data.chest.rotation.y = THREE.MathUtils.lerp(data.chest.rotation.y,
      motion * 0.055 * Math.cos(stridePhase) + idleChestYaw, alpha);
    data.chest.rotation.z = THREE.MathUtils.lerp(data.chest.rotation.z,
      0.016 * Math.sin(t * 0.71) + motion * 0.027 * Math.sin(stridePhase) + restlessSway + idleChestRoll + partnerRoll, alpha);
    data.chest.position.z = -Math.sin(data.chest.rotation.x) * data.waistY;
    data.chest.position.y = (1 - Math.cos(data.chest.rotation.x)) * data.waistY + 0.006 * breath;

    this.figureBase.lerp(this.poseOffset, 1 - Math.exp(-dt * 8));
    this.figure.position.copy(this.figureBase);
    // Close the visual gap during a hug while the path endpoints stay fixed.
    this.figure.position.z += embrace;
    this.figure.position.y -= stanceDrop + this.crouchBlend;
    this.figure.position.x += motion * 0.011 * Math.sin(stridePhase) + restlessSway * 0.15;
    this.figure.position.z += partnerForward;
    this.figure.rotation.x = THREE.MathUtils.lerp(this.figure.rotation.x, asleep ? -Math.PI / 2 : 0, alpha);
    if (typing) {
      const cycle=(t + (this.id==='vlad'?0:2.8))%11.6;
      const pause=THREE.MathUtils.smoothstep(cycle,4.8,5.5) *
        (1-THREE.MathUtils.smoothstep(cycle,6.6,7.15));
      const beats = (0.52 + 0.48 * Math.max(0, Math.sin(t * 0.85)))*(1-pause);
      for (const i of [0, 1] as const) {
        const tap = beats * Math.max(0, Math.sin(t * (i === 0 ? 8.5 : 10.2) + i * 1.3)) ** 2;
        this.target.copy(typing[i]);
        this.target.y += 0.028 - 0.018 * tap;
        this.target.add(this.handDirection.set(0, 0,
          0.018 * Math.sin(t * 1.82 + i) - 0.008 * tap)
          .applyAxisAngle(up, this.root.rotation.y));
        this.reach(i, this.target, alpha);
        this.aimHand(i, this.handDirection.set(0, -0.27, -1)
          .applyAxisAngle(up, this.root.rotation.y), alpha);
      }
    } else if (stirring) {
      // Alternate preparation, pan work and plating by recipe rather than
      // endlessly stirring. Motions use the same two-bone IK and light props.
      const phase = a*(kitchenStep==='chop'?7.4:kitchenStep==='whisk'?7:3.6);
      if (kitchenStep==='chop') {
        this.reach(0,this.stationTarget(stirring,.20,.115,-.09),alpha);
        this.reach(1,this.stationTarget(stirring,
          .23,.15+.045*(1+Math.sin(phase)),-.08+.020*Math.cos(phase)),alpha);
      } else if(kitchenStep==='knead') {
        this.reach(0,this.stationTarget(stirring,-.085+.055*Math.sin(phase),.13,-.11+.038*Math.cos(phase)),alpha);
        this.reach(1,this.stationTarget(stirring,.085-.055*Math.sin(phase),.13,-.11-.038*Math.cos(phase)),alpha);
      } else if(kitchenStep==='flip') {
        const lift=Math.max(0,Math.sin(phase*1.8));
        this.reach(0,this.stationTarget(stirring,-.18,.12,-.11),alpha);
        this.reach(1,this.stationTarget(stirring,.035+.048*Math.sin(phase),.16+.11*lift,-.13+.055*Math.cos(phase)),alpha);
      } else if(kitchenStep==='plate') {
        const serve=Math.sin(Math.min(1,Math.max(0,(a-9.6)/2.4))*Math.PI);
        this.reach(0,this.stationTarget(stirring,-.17,.13,-.12),alpha);
        this.reach(1,this.stationTarget(stirring,.17+.14*serve,.14+.07*serve,-.1),alpha);
      } else {
        this.reach(0,this.stationTarget(stirring,-.19,.105,-.13),alpha);
        this.reach(1,this.stationTarget(stirring,
          .055*Math.cos(phase),.135+.013*Math.sin(phase*2),-.12+.045*Math.sin(phase)),alpha);
      }
      for(const i of [0,1] as const)
        this.aimHand(i,this.handDirection.set(0,-.48,-1)
          .applyAxisAngle(up,this.root.rotation.y),alpha);
      if(this.spoon.visible)
        this.aimSpoon(this.stationTarget(stirring,
          .060*Math.cos(phase),.030,.046*Math.sin(phase)),alpha);
    } else if (bite > 0) {
      data.head.localToWorld(this.target.set(0.022, -0.133, 0.151));
      this.handDirection.set(0.066, -0.114, 0.175).applyAxisAngle(up, this.root.rotation.y);
      this.target.add(this.handDirection);
      this.reach(1, this.target, bite);
      this.aimHand(1, this.handDirection.set(0, -0.21, 1).applyAxisAngle(up, this.root.rotation.y), bite);
      if(this.spoon.visible)this.aimSpoon(data.head.localToWorld(this.target.set(0, -0.134, 0.158)), bite);
    } else if (this.activity==='eat' && this.pan) {
      // Between mouthfuls, the right hand actually collects the next bite
      // from the resident's own plate; the left hand rests near its rim.
      this.reach(0,this.stationTarget(this.pan,-.11,.09,-.035),alpha);
      this.reach(1,this.stationTarget(this.pan,
        .015+.035*Math.sin(a*2.5),.10+.012*Math.sin(a*5.2),-.03),alpha);
      this.aimHand(1,this.handDirection.set(0,-.5,-1)
        .applyAxisAngle(up,this.root.rotation.y),alpha);
    } else if (this.petContact && (this.activity === 'brush' || this.activity === 'pet')) {
      // Follow the actual animal's saved position; strokes travel across the
      // coat rather than moving a hand in place beside the standing resident.
      const brushing = this.activity === 'brush';
      const stroke = Math.sin(a * (brushing ? 6.2 : 3.7));
      const lateral = brushing ? .065 : .023;
      this.target.copy(this.petContact);
      this.target.x += lateral * stroke * Math.cos(this.root.rotation.y);
      this.target.z -= lateral * stroke * Math.sin(this.root.rotation.y);
      this.target.y += .018 * Math.sin(a * (brushing ? 4.3 : 2.9));
      this.reach(1,this.target,Math.min(1,alpha * 2.8));
      this.aimHand(1,this.handDirection.set(0,-1,-.25).applyAxisAngle(up,this.root.rotation.y),alpha);
    } else if (this.gestureTarget && highFive > 0) {
      const hand = this.id === 'vlad' ? 1 : 0;
      this.target.copy(this.gestureTarget).addScaledVector(up, -0.069);
      this.reach(hand, this.target, highFive);
      this.aimHand(hand, this.handDirection.copy(up), highFive);
    } else if(pair?.target&&partnerReach>0.002) {
      const hand=pair.motion==='hands'||pair.motion==='slowDance'?(this.id==='vlad'?1:0):1;
      this.reach(hand,this.target.copy(pair.target),Math.min(1,alpha*4*partnerReach));
      this.aimHand(hand,this.handDirection.set(0,-.55,-.3)
        .applyAxisAngle(up,this.root.rotation.y),alpha*partnerReach);
    }
    // The old idle gestures only raised an elbow toward the face. Use
    // the existing two-bone IK solver to put the wrist at a meaningful
    // contact point, following the animated head/chest and their real scale.
    // The same code works with lightweight fallback and Blender skin rigs.
    if (idleTouch > 0.002 && this.idleGesture) {
      const reachBlend = Math.min(1, idleTouch * alpha * 7.4);
      const handBlend = Math.min(1, idleTouch * alpha * 4.3);
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
      } else if (this.idleGesture === 'studyPalm') {
        data.chest.localToWorld(this.target.set(0.17,1.22,0.37));
        contactHand=1;
      } else if (this.idleGesture === 'rubShoulder') {
        data.chest.localToWorld(this.target.set(-0.19,1.40,0.21));
        contactHand=1;
      } else if (this.idleGesture === 'easeWrists') {
        data.chest.localToWorld(this.target.set(-0.07,1.20,0.37));
        this.reach(0,this.target,reachBlend);
        data.chest.localToWorld(this.target.set(-0.045,1.205,0.39));
        contactHand=1;
      } else if (this.idleGesture === 'adjustSleeve') {
        // Present the left cuff in front of the chest, then briefly tug it
        // with the other hand. Both targets are within reachable distance
        // of the shoulders on both Blender and fallback models.
        const tug = Math.sin(this.idleGestureTime * 8.3) ** 2;
        data.chest.localToWorld(this.target.set(-0.13, 1.21, 0.29));
        this.reach(0, this.target, reachBlend);
        this.aimHand(0, this.handDirection.set(0, 0.20, -1)
          .applyAxisAngle(up, this.root.rotation.y), handBlend);
        data.chest.localToWorld(this.target.set(-0.085, 1.225 + .017 * tug, 0.337));
        this.reach(1, this.target, reachBlend);
        this.aimHand(1, this.handDirection.set(-0.15, 0.0, -1)
          .applyAxisAngle(up, this.root.rotation.y), handBlend);
      }
      if (contactHand !== null) {
        this.reach(contactHand, this.target, reachBlend);
        this.aimHand(contactHand,
          this.handDirection.set(contactHand === 0 ? -0.18 : 0.11,
            -0.18, -1).applyAxisAngle(up, this.root.rotation.y),
          handBlend);
      }
    }
    // A readable little hello needs the *hand* beside the face, with an
    // elbow that bends correctly. Shoulder angles alone once sent the whole
    // arm behind Vlad on actual 390x844 WebGL frames. Reuse the existing
    // two-bone IK and hand orientation; no extra bone, mesh or server action.
    if (this.idleGesture === 'noticePartner' && this.greeting) {
      const phase = this.idleGestureTime;
      const wave = residentIdleEase(phase, .32, .91) *
        (1 - residentIdleEase(phase, 2.13, 3.07));
      if (wave > .004) {
        const flutter = Math.sin(phase * 8.6);
        data.head.localToWorld(this.target.set(
          .28 + .024 * flutter, -.016 + .024 * Math.sin(phase * 8.6), .205));
        this.reach(1, this.target, Math.min(1, wave * alpha * 8.0));
        this.aimHand(1, this.handDirection.set(.13, .90, .22)
          .applyAxisAngle(up, this.root.rotation.y), Math.min(1, wave * alpha * 6.1));
      }
    }
    if (this.activity === 'reach' && this.pan) {
      // Taking an item from a shelf uses one hand; the other stays at rest.
      // Previously any supplied target forced BOTH hands into the furniture.
      this.reach(1, this.target.copy(this.pan), alpha);
      this.aimHand(1, this.handDirection.set(0, -.25, -1)
        .applyAxisAngle(up, this.root.rotation.y), alpha);
    }
    if (counter) {
      for (const i of [0, 1] as const) {
        const side = i === 0 ? -1 : 1;
        let x = side * .12, y = .13, z = -.13;
        switch (this.activity) {
          case 'dishes':
            x = side * .095 + .025 * Math.sin(a * 4.3 + i * Math.PI);
            y = .115 + .016 * Math.sin(a * 3.9 + i * Math.PI);
            z = -.12 + .021 * Math.cos(a * 3.4);
            break;
          case 'wash':
          case 'washHands':
            x = side * .05 + .020 * Math.sin(a * 6 + i * Math.PI);
            y = .14 + .012 * Math.cos(a * 6 + i * Math.PI);
            z = -.12 + .018 * Math.sin(a * 4);
            break;
          case 'grill': {
            const turn = barbecueStep==='turn';
            const toss = barbecueStep==='toss';
            const assembling = barbecueStep==='assemble';
            const plating = barbecueStep==='plate';
            const swing = a*(turn?2.7:toss?3.8:2.3);
            x = i ? (assembling?.04:plating?.26:.08)+
              (turn?.07:toss?.13:.09)*Math.sin(swing) : -.18;
            y = i ? .14+(plating?.09:assembling?.04:.075)*Math.max(0,Math.sin(swing*1.5)) : .11;
            z = i ? -.09+(turn?.08:.025)*Math.cos(swing) : -.18;
            break;
          }
          case 'prep': {
            const chop=helperChop(a);
            x=i?.13+.028*Math.sin(a*4):-.11;
            y=i?(chop?.135+.05*(1+Math.sin(a*7)):.13):.115;
            z=i?-.09+.016*Math.cos(a*4):-.10;
            break;
          }
          case 'coffee':
            x = i ? .04 + .034 * Math.sin(a * 3.1) : -.18;
            y = i ? .11 + .035 * Math.max(0, Math.sin(a * 3.1)) : .16;
            z = i ? -.10 : -.21;
            break;
          case 'tea':
            x = i ? .055 + .040 * Math.sin(a * 2.6) : -.17;
            y = i ? .12 + .022 * Math.sin(a * 2.6) : .15;
            z = i ? -.11 : -.20;
            break;
          default: // tidying a worktop: two staggered, short wiping strokes
            x = side * .13 + .060 * Math.sin(a * 3.5 + i * Math.PI);
            y = .095 + .010 * Math.sin(a * 3.5 + i);
            z = -.12 + .044 * Math.cos(a * 3.5 + i * Math.PI);
        }
        this.reach(i, this.stationTarget(counter, x, y, z), alpha);
        this.aimHand(i, this.handDirection.set(0, -.72, -.4)
          .applyAxisAngle(up, this.root.rotation.y), alpha);
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
