import { HomeEffects, homeBench } from './HomeEffects';
import { BOOKS, HOME_SEATS, type HomePresentation } from '../shared/homeLife';
import { GRILL_RECIPES, ingredientList, isGrillRecipe, type RecipeId } from '../shared/food';
import { carryingBag, createLocation, homeExtensions } from './LocationScene';
import { floorFor, approachFor, clockMinutes, meeting, placeObstacles, spawn, stationById, type PlaceId, type Station } from '../shared/locations';
import { GROCERY_DETAILS } from '../shared/storageSpace';
import { BATH_FIXTURES, DINING_TOP, GRILL_WORK, HOME_FLOOR, HOME_PLACEMENTS, HOUSE_ENTRY,
  KITCHEN_ACTIONS, KITCHEN_WORK, homeSeat, type BathFixture, type HomeLeisure } from '../shared/home';
import { cube, drum, finish, softCube } from './ArtKit';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Actor, type DomesticMotion } from './Actor';
import type { CharacterModel } from './CharacterArt';
import { PetActor } from './PetActor';
import { PETS, PET_IDS, PET_SPEED, PET_BOWL_CAPACITY, petApproach, type PetId, type PetAction } from '../shared/pets';
import { findRoute, nearestClearPoint, pointIsClear, sampleWalk, type FloorRect, type WalkRoute } from './navigation';
import { ACTIONS, itemNames, points, type ItemId as SharedItemId, type ActionId, type CharacterId, type SocialKind, type GameState, type TimedCommand } from '../shared/protocol';
import { decorateHome } from './HomeStyling';
import { batchRigidParts } from './ArtKit';
import { inspectionFrame, type ViewBand } from './InspectionFrame';
import { portraitHomeFrame, renderProfile } from './HomeFrame';
import { furnitureContact, walkingContact } from './ContactShade';
import { buildFurniture, buildPersonalFurniture, buildSoftRugs } from './InteriorArt';
import { buildYard, grilledFood, selectGrilledFood } from './YardArt';
import { dayPhase, GAME_MINUTES_PER_REAL_SECOND } from '../shared/life';
import { residentStep, unoccupiedDestination } from './residentCollision';

type ItemId = Exclude<SharedItemId, 'delivery'>;
type Point = { x: number; z: number };
type BowlPick = 'bowl:verdell' | 'bowl:simba';

// Coordinates of the visible keys and pan in InteriorArt. These are pose
// targets only: the server and route planner still use the approach tiles.
const deskKeys = [
  new THREE.Vector3(HOME_PLACEMENTS.desk.x + .17, 1.116, HOME_PLACEMENTS.desk.z + .436),
  new THREE.Vector3(HOME_PLACEMENTS.desk.x - .17, 1.116, HOME_PLACEMENTS.desk.z + .436),
] as const;
const cookingPan = new THREE.Vector3().copy(KITCHEN_WORK.stove.target);
// Reuse the existing light articulated rig instead of loading extra animations.
const DOMESTIC_MOTIONS: Partial<Record<ActionId, DomesticMotion>> = {
  sofaRead: 'read', sofaMusic: 'music', sofaCall: 'phone',
  bedMake: 'tidy', bedStretch: 'stretch',
  deskGames: 'games', deskJournal: 'journal',
  kitchenWash: 'wash', kitchenTidy: 'tidy', kitchenTea: 'tea',
  tvMusic: 'music', tableTalk: 'phone', tablePlan: 'journal',
};

const homePosition = new THREE.Vector3(15, 19, 22);
const locationTarget = new THREE.Vector3(0, 1.45, 0);
const portraitAspect = 390 / 844;
const compactPortraitQuery = '(max-width: 640px) and (orientation: portrait)';
const tapSlop = 9;
const minTwistSpanSquared = 16 ** 2;

type Frame = { position: THREE.Vector3; target: THREE.Vector3 };

export const objectNames = itemNames;

export class World {
  scene = new THREE.Scene();
  private readonly homeScene = this.scene;
  private entryLeaf?: THREE.Group;
  private readonly extensions = homeExtensions();
  private readonly subjectMeshes: THREE.Object3D[] = [];
  private readonly stationMeshes: THREE.Object3D[] = [];
  private readonly bags = { vlad: carryingBag(), alina: carryingBag() };
  private readonly shoppingBags = [carryingBag(), carryingBag(), carryingBag()];
  private readonly preparations = new Map<CharacterId, { remaining: number; next: () => void }>();
  private served: THREE.Group | null = null;
  private readonly meals = new Map<CharacterId, THREE.Group>();
  private readonly vector = new THREE.Vector3();
  private remote: ReturnType<typeof createLocation> | null = null;
  private externalObstacles: FloorRect[] = [];
  private remoteMeshes: THREE.Object3D[] = [];
  private readonly openDoors = new Map<CharacterId, string>();
  private household: GameState | null = null;
  private readonly sleepingOffline = new Set<CharacterId>();
  private readonly homeLeisure = new Set<CharacterId>();
  private readonly petRoutines = new Map<PetId, number>();
  private localRole: CharacterId = 'vlad';
  private cart: THREE.Group | null = null;
  private cartSize = 0;
  private dogTravel = 0;
  private dogTrail: Point[] = [];
  private lastDogPoint: Point | null = null;
  place: PlaceId = 'home';
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly actors: Record<CharacterId, Actor>;
  readonly pets: Record<PetId, PetActor>;
  private readonly raycaster = new THREE.Raycaster();
  private readonly interactiveMeshes: THREE.Object3D[] = [];
  private readonly itemPoints = new Map<string, THREE.Vector3>();
  private readonly obstacles = placeObstacles('home');
  private lastFrame = performance.now();
  private socialSequence = 0;
  private readonly homeEffects = new HomeEffects(this.homeScene);
  private readonly homeTasks = new Map<CharacterId, HomePresentation>();
  private readonly taskSequence = { vlad: 0, alina: 0 };
  private inspected: CharacterId | PetId | null = null;
  private readonly contacts: { visual: THREE.Object3D; shade: ReturnType<typeof walkingContact>; pet: boolean }[] = [];
  private yard!: ReturnType<typeof buildYard>;
  private grillCooking = false;
  private readonly otherBody = new THREE.Vector3();
  private readonly bowlFood: Record<PetId, THREE.Mesh[]> = { verdell: [], simba: [] };
  private readonly steering = {
    vlad: (from: Point, target: Point) => this.steerPast('alina', from, target),
    alina: (from: Point, target: Point) => this.steerPast('vlad', from, target),
  };
  private followSubject: THREE.Object3D | null = null;
  private readonly followPoint = new THREE.Vector3();
  private readonly followDelta = new THREE.Vector3();
  private readonly contactPoint = new THREE.Vector3();
  private cameraMove: Frame | null = null;
  private defaultFrame: Frame | null = null;
  private viewport: { width: number; height: number; pixelRatio: number; compact: boolean; band: ViewBand } | null = null;
  private readonly compactPortrait = window.matchMedia(compactPortraitQuery);
  private readonly sun = new THREE.DirectionalLight(0xffe5ce, 2.48);
  private readonly ambient = new THREE.HemisphereLight(0xeef2fb, 0xc6b39e, 1.87);
  private lastDayPhase: ReturnType<typeof dayPhase> | null = null;

  constructor(private readonly canvas: HTMLCanvasElement,
    private readonly onPick: (id: ItemId | CharacterId | PetId | BowlPick) => void,
    private readonly viewBand: (inspection: boolean) => ViewBand = () => ({ top: 0.16, bottom: 0.86 }),
    characters: Partial<Record<CharacterId, CharacterModel>> = {},
    private readonly onRenderedFrame?: (nowMs: number, drawCalls: number, triangles: number) => void,
    private readonly navigation?: { station(id: string): void; ground(x: number, z: number): void }) {
    this.scene.background = new THREE.Color(0xc0c7ad);
    this.scene.fog = new THREE.Fog(0xc0c7ad, 64, 97);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 110);
    this.camera.position.copy(homePosition);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 1.0, 1.8);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.touches.ONE = THREE.TOUCH.PAN;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    this.controls.enablePan = true;
    this.controls.maxTargetRadius = 13;
    this.controls.minDistance = 10;
    this.controls.maxDistance = this.place === 'home' ? 74 : 51;
    this.controls.minPolarAngle = 0.24;
    this.controls.maxPolarAngle = 1.25;
    this.controls.update();

    this.createLights();
    this.createHome();
    // Reuse the existing low-poly bags on the dining table, not in the hands at home.
    for (const [index, bag] of this.shoppingBags.entries()) {
      const offsets = [[-.39, .15], [.39, .15], [0, -.20]];
      const [x, z] = offsets[index];
      bag.position.set(HOME_PLACEMENTS.table.x + x, DINING_TOP + .015, HOME_PLACEMENTS.table.z + z);
      bag.scale.setScalar(.92);
      bag.visible = false;
      this.homeScene.add(bag);
      this.trackStation(this.stationMeshes, 'shopping-table', bag);
    }
    const vlad = spawn('home', 'vlad'), alina = spawn('home', 'alina');
    this.actors = { vlad: new Actor('vlad', [vlad.x, vlad.z], characters.vlad), alina: new Actor('alina', [alina.x, alina.z], characters.alina) };
    this.pets = { verdell: new PetActor('verdell'), simba: new PetActor('simba') };
    for (const subject of [...Object.values(this.actors), ...Object.values(this.pets)]) {
      const visual = subject.root.children[0];
      this.scene.add(subject.root);
      visual.traverse((part) => {
        if (!(part instanceof THREE.Mesh)) return;
        part.userData.interactable = subject.id;
        this.subjectMeshes.push(part);
      });
      const pet = subject instanceof PetActor;
      const shade = walkingContact(pet);
      if (subject instanceof PetActor) {
        shade.scale.multiplyScalar(subject.root.scale.x);
        if (subject.id === 'simba') { shade.scale.x *= .79; shade.scale.y *= 1.14; }
      }
      this.contacts.push({ visual, shade, pet });
      this.scene.add(shade);
    }
    for (const id of ['vlad', 'alina'] as const) {
      this.bags[id].visible = false;
      this.scene.add(this.bags[id]);
      const plate = new THREE.Group();
      const dish = new THREE.Mesh(drum, finish(0xf2dfc3, 'ceramic'));
      dish.scale.set(.19,.032,.19);
      const food = new THREE.Mesh(softCube, finish(0xc88850, 'ceramic'));
      food.name = 'Indoor serving';
      food.scale.set(.22,.072,.20);
      food.position.y = .042;
      const grilled = grilledFood();
      grilled.position.y = .016;
      grilled.visible = false;
      plate.add(dish, food, grilled);
      plate.visible = false;
      this.scene.add(plate);
      this.meals.set(id, plate);
    }
    const serving = this.meals.get('vlad')!.clone();
    serving.position.set(HOME_PLACEMENTS.table.x, DINING_TOP + .014, HOME_PLACEMENTS.table.z - .28);
    serving.visible = false;
    this.homeScene.add(serving);
    this.served = serving;
    this.setActive('vlad');

    this.bindCanvasInput();
    window.addEventListener('resize', () => this.refreshViewport());
    this.compactPortrait.addEventListener('change', () => this.refreshViewport());
    this.refreshViewport();
    this.animate();
  }

  private bindCanvasInput(): void {
    const touches = new Map<number, { x: number; y: number }>();
    let tap: { id: number; x: number; y: number } | null = null;
    const tapDistance = (event: PointerEvent, start: { x: number; y: number }) =>
      Math.hypot(event.clientX - start.x, event.clientY - start.y);

    this.canvas.addEventListener('pointerdown', event => {
      const touch = event.pointerType === 'touch';
      if (touch) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (event.isPrimary) {
        // Enable touch panning in every location while keeping the mouse controls for the current scene.
        this.controls.enablePan = touch || this.place === 'home';
        this.controls.dampingFactor = touch ? .22 : .065;
      }
      tap = event.isPrimary && event.button === 0 && touches.size === (touch ? 1 : 0)
        ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    }, { capture: true });

    this.canvas.addEventListener('pointermove', event => {
      const point = touches.get(event.pointerId);
      if (tap?.id === event.pointerId) {
        if (tapDistance(event, tap) >= tapSlop) tap = null;
        else if (point) {
          // Let a tap absorb small finger movements before OrbitControls starts panning.
          event.stopPropagation();
          return;
        }
      }
      if (!point) return;
      if (touches.size === 2) {
        const [first, second] = touches.values();
        const other = first === point ? second : first;
        const ax = point.x - other.x, ay = point.y - other.y;
        const bx = event.clientX - other.x, by = event.clientY - other.y;
        // OrbitControls handles the two-finger drag and pinch. Also honor a twist in place.
        if (ax * ax + ay * ay >= minTwistSpanSquared && bx * bx + by * by >= minTwistSpanSquared) {
          const angle = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
          if (angle) this.controls.rotateLeft(-angle);
        }
      }
      point.x = event.clientX;
      point.y = event.clientY;
    });

    const clearPointer = (event: PointerEvent) => {
      touches.delete(event.pointerId);
      if (tap?.id === event.pointerId) tap = null;
    };
    this.canvas.addEventListener('pointerup', event => {
      const picked = tap?.id === event.pointerId && tapDistance(event, tap) < tapSlop;
      clearPointer(event);
      if (picked) this.pick(event.clientX, event.clientY);
    });
    this.canvas.addEventListener('pointercancel', clearPointer);
    this.canvas.addEventListener('lostpointercapture', clearPointer);
  }

  setActive(id: CharacterId): void {
    for (const actor of Object.values(this.actors)) actor.select(actor.id === id);
  }

  setAway(id:CharacterId,away:boolean):void {
    const resident=this.actors[id];
    if(resident.root.visible===!away)return;
    resident.root.visible=!away;
    const body=resident.root.children[0];
    for(const item of this.contacts) {
      if(item.visual===body)item.shade.visible=!away;
    }
    if(away && this.inspected===id)this.showcase(null);
  }

  showcase(subject: CharacterId | PetId | null): void {
    this.inspected = subject;
    this.controls.minDistance = subject ? 1.10 : 10;
    // Keep the full transition in range before applying the inspection limit.
    this.controls.maxDistance = this.place === 'home' ? 74 : 51;
    this.controls.maxPolarAngle = subject ? 1.52 : 1.25;
    if (!subject) {
      this.followSubject = null;
      const band = this.viewBand(false);
      this.defaultFrame = this.homeFrame(this.compactPortrait.matches, band);
      this.cameraMove = this.defaultFrame;
      return;
    }
    const person = subject === 'vlad' || subject === 'alina';
    const subjectRoot = person ? this.actors[subject].root : this.pets[subject].root;
    subjectRoot.updateWorldMatrix(true, true);
    this.followSubject = subjectRoot.children[0];
    this.followSubject.getWorldPosition(this.followPoint);
    const bounds = new THREE.Box3().setFromObject(this.followSubject, true);
    // Simba's right-hand approach to the inspection view had the desk in front.
    const angle = subject === 'simba' ? new THREE.Vector3(-0.46, 0.29, 1)
      : new THREE.Vector3(0.29, person ? 0.11 : 0.22, 1);
    this.cameraMove = inspectionFrame(bounds, angle, this.camera.fov, this.camera.aspect, this.viewBand(true));
  }

  restoreCharacter(id: CharacterId, x: number, z: number, pose: 'idle' | 'sit' | 'sleep' | 'work'): void {
    const obstacles = this.currentObstacles(), floor = floorFor(this.place);
    let safe = nearestClearPoint({ x, z }, obstacles, floor);
    const other = this.actors[id === 'vlad' ? 'alina' : 'vlad'];
    if (safe && pose === 'idle' && other.root.visible) {
      safe = unoccupiedDestination(safe, other.bodyPosition(this.otherBody), obstacles, floor) ?? safe;
    }
    if (safe) this.actors[id].root.position.set(safe.x, 0, safe.z);
    if (this.place !== 'home') {
      const seat = [...(this.remote?.stations.keys() ?? [])].map(key => stationById(this.place, key)!)
        .find(s => {
          const point = approachFor(s, id);
          return (s.action.kind === 'rest' || s.action.kind === 'dine') && Math.hypot(x - point.x, z - point.z) < .22;
        });
      if (pose === 'sit' && seat) this.sitAt(id, seat);
      else this.actors[id].setPose('idle');
      return;
    }
    const seat = pose === 'sit' && HOME_SEATS.map(seatId => homeSeat(seatId,id))
      .find(({approach}) => Math.hypot(approach.x-x,approach.z-z)<.20);
    if(seat) {
      this.actors[id].setFurniturePose('sit',new THREE.Vector3().copy(seat.position),seat.yaw);
      return;
    }
    const item = (['bed', 'sofa', 'desk', 'table'] as const).find((candidate) => {
      const location = points[candidate];
      return Math.hypot(location.x - x, location.z - z) < 0.5;
    });
    if (item && ((pose === 'sleep' && item === 'bed') ||
        (pose === 'work' && item === 'desk') ||
        (pose === 'sit' && (item === 'sofa' || item === 'table')))) {
      this.applyFurniturePose(id, item, pose);
    } else {
      // Avoid sinking below the floor when an older save has no matching chair/bed.
      this.actors[id].setPose('idle');
    }
  }

  private applyFurniturePose(id: CharacterId, itemId: string, pose: 'idle' | 'sit' | 'sleep' | 'work'): void {
    const actor = this.actors[id];
    const vlad = id === 'vlad';
    const anchors = {
      sofa: { x: vlad ? -.50 : .50, y: vlad ? .057 : .106, z: -.27, yaw: Math.PI },
      bed: { x: vlad ? -.55 : .55, y: 1.055, z: 1.01, yaw: 0 },
      desk: { x: 0, y: vlad ? -.24 : -.19, z: 1.01, yaw: Math.PI },
      table: { x: vlad ? .99 : -.99, y: vlad ? -.27 : -.22, z: 0, yaw: vlad ? -Math.PI / 2 : Math.PI / 2 },
    } as const;
    const item = itemId as keyof typeof anchors;
    const anchor = anchors[item];
    if (!anchor || pose === 'idle') {
      actor.setPose(pose);
      return;
    }
    const placement = HOME_PLACEMENTS[item];
    actor.setFurniturePose(pose, new THREE.Vector3(placement.x + anchor.x, anchor.y, placement.z + anchor.z), anchor.yaw,
      itemId === 'desk' ? deskKeys : undefined);
  }

  perform(id: CharacterId, itemId: string, pose: 'idle' | 'sit' | 'sleep' | 'work', onArrive: () => void): boolean {
    const location = this.itemPoints.get(itemId);
    if (!location) return false;
    ++this.socialSequence;
    return this.walkTo(id, location, () => {
      this.applyFurniturePose(id, itemId, pose);
      onArrive();
    });
  }

  /** Client-only presentation. Sleep ownership and recovery remain server-authoritative. */
  showSleep(id: CharacterId, sleeping: boolean): void {
    if (this.place !== 'home') return;
    if (sleeping) {
      if (!this.perform(id, 'bed', 'sleep', () => {}))
        this.restoreCharacter(id, points.bed.x, points.bed.z, 'sleep');
    } else {
      this.restoreCharacter(id, points.bed.x, points.bed.z, 'idle');
    }
  }

  performFood(id: CharacterId, action: 'cook' | 'eat', current = () => true): boolean {
    return this.perform(id, action === 'cook' ? 'kitchen' : 'table',
      action === 'cook' ? 'idle' : 'sit', () => {
        if (!current()) return;
        const actor = this.actors[id];
        if (action === 'cook') {
          actor.faceTowards(cookingPan);
        }
        if (action === 'eat') this.showMeal(id, HOME_PLACEMENTS.table.x + (id === 'vlad' ? .40 : -.40),
          DINING_TOP + .014, HOME_PLACEMENTS.table.z);
        actor.playActivity(action, action === 'cook' ? cookingPan : undefined);
      });
  }

  private bathroomPose(role: CharacterId, item: BathFixture, command: TimedCommand): void {
    const { center } = BATH_FIXTURES[item];
    const actor = this.actors[role];
    const action = command.type === 'act' ? command.actionId : undefined;
    if (item === 'toilet' || item === 'bathtub') {
      const toilet = item === 'toilet';
      actor.setFurniturePose('sit',
        new THREE.Vector3(center.x + (toilet ? .18 : 0), toilet ? -.22 : -.36, center.z + (toilet ? 0 : .25)),
        toilet ? Math.PI / 2 : Math.PI);
      actor.playDomesticActivity(toilet ? 'toilet' : 'bath');
      if (action === 'bathFoam') this.homeEffects.water('bathtub',true);
    } else {
      const shower = item === 'shower';
      const hands = item === 'wcBasin';
      const target = new THREE.Vector3(center.x + (shower ? .62 : 0), 1.03, center.z + (shower ? 0 : hands ? .13 : .09));
      actor.faceTowards(target);
      if (shower) actor.setFurniturePose('idle',actor.root.position.clone().setY(.083),actor.root.rotation.y);
      actor.playDomesticActivity(shower ? 'shower' : hands ? 'washHands' : action === 'bathTeeth' ? 'teeth' : 'wash',
        shower ? undefined : target);
      if (shower) this.homeEffects.water('shower',true);
      if (hands) this.homeEffects.water('wcBasin', true);
    }
  }

  private startHomeTask(role: CharacterId, command: TimedCommand, home: HomePresentation): boolean {
    if (this.place !== 'home') return true;
    this.clearHomeTask(role);
    this.preparations.delete(role);
    this.homeTasks.set(role,home);
    const actor = this.actors[role];
    const {route,station,pickup,program} = home;
    actor.root.position.set(route.from.x,0,route.from.z);
    const path = route.path.map(p => new THREE.Vector3(p.x,0,p.z));
    const current = () => this.homeTasks.get(role) === home;
    const arrive = () => {
      if (!current()) return;
      if (station === 'grill') {
        const target = new THREE.Vector3().copy(GRILL_WORK.target);
        actor.faceTowards(target);
        actor.playDomesticActivity('grill', target);
        if (command.type === 'cook') selectGrilledFood(this.yard.contents, command.recipe);
        this.grillCooking = true;
        return;
      }
      if (station === 'basin' || station === 'wcBasin' || station === 'shower' || station === 'toilet' || station === 'bathtub') {
        this.bathroomPose(role,station,command);
        return;
      }
      const seat = homeSeat(station,role);
      actor.setFurniturePose('sit',new THREE.Vector3().copy(seat.position),seat.yaw);
      if (program) {
        actor.watch(program === 'comedy' ? 1 : program === 'horror' ? -1 : 0);
      } else if (command.type === 'read_book') actor.playDomesticActivity('read');
      else if (station === 'yardTable' && command.type === 'eat') {
        this.showMeal(role, seat.position.x, DINING_TOP, HOME_PLACEMENTS.yardTable.z + .22, command.recipe);
        actor.playActivity('eat');
      }
      else if (command.type === 'act') {
        const motion = DOMESTIC_MOTIONS[command.actionId];
        if (motion) actor.playDomesticActivity(motion);
      }
    };
    if (pickup !== undefined && command.type === 'read_book') {
      const takeBook = () => {
        if (!current()) return;
        actor.carryBook(BOOKS[command.book][4]);
        actor.walkPath(path.slice(pickup),arrive);
      };
      const reach = () => {
        if (!current()) return;
        if (!home.pickupMs) { takeBook(); return; }
        const shelf = HOME_PLACEMENTS.bookcase;
        const target = new THREE.Vector3(shelf.x-.29,1.23,shelf.z);
        actor.faceTowards(target);
        actor.playDomesticActivity('reach',target);
        this.preparations.set(role,{remaining:home.pickupMs/1000,next:takeBook});
      };
      if (pickup) actor.walkPath(path.slice(0,pickup),reach);
      else reach();
    } else actor.walkPath(path,arrive);
    return true;
  }

  activateHomeTask(role: CharacterId): void {
    const home = this.homeTasks.get(role);
    if (home?.program) this.homeEffects.television(role,home.program);
  }

  private clearHomeTask(role: CharacterId): boolean {
    const home = this.homeTasks.get(role);
    if (!home) return false;
    this.homeTasks.delete(role);
    this.homeEffects.television(role);
    if (home.station === 'shower' || home.station === 'bathtub' || home.station === 'wcBasin')
      this.homeEffects.water(home.station,false);
    if (home.station === 'grill') this.grillCooking = false;
    return true;
  }

  startTimedAction(role: CharacterId, command: TimedCommand, home?: HomePresentation): boolean {
    if (this.household && this.household.world.places[role] !== this.place) return true;
    this.closeStorage(role);
    if (home) return this.startHomeTask(role,command,home);
    if (command.type === 'local_activity') {
      const station = stationById(this.place, command.station);
      if (!station) return false;
      const actor = this.actors[role];
      const start = () => {
        if (command.action === 'rest' || command.action === 'dine') this.sitAt(role, station);
        if (command.action === 'exercise') actor.playDomesticActivity('stretch');
        if (command.action === 'unpack') actor.playDomesticActivity('tidy');
        if (command.action === 'dog') {
          actor.faceTowards(this.pets.verdell.root.position);
          actor.playPetActivity('play');
          this.pets.verdell.react('play');
        }
        if (command.action === 'dine' && this.household?.world.cafe[role]?.pickedUp) {
          this.showMeal(role, station.center.x + (role === 'vlad' ? -.25 : .25), 1.022, station.center.z - .10);
          actor.playActivity('eat');
        }
      };
      return this.walkTo(role, approachFor(station, role), start);
    }
    const sequence = ++this.taskSequence[role];
    const current = () => sequence === this.taskSequence[role];
    if (command.type === 'brew_coffee') {
      const work = KITCHEN_WORK.coffee;
      return this.walkTo(role, work.position, () => {
        if (!current()) return;
        const target = new THREE.Vector3().copy(work.target);
        this.actors[role].faceTowards(target);
        this.actors[role].playDomesticActivity('coffee', target);
      });
    }
    if (command.type === 'act') {
      const def = ACTIONS[command.actionId];
      if (command.actionId in KITCHEN_ACTIONS) {
        const motion = KITCHEN_ACTIONS[command.actionId as keyof typeof KITCHEN_ACTIONS];
        const work = KITCHEN_WORK[motion];
        return this.walkTo(role, work.position, () => {
          if (!current()) return;
          const target = new THREE.Vector3().copy(work.target);
          this.actors[role].faceTowards(target);
          this.actors[role].playDomesticActivity(motion, target);
        });
      }
      return this.perform(role, def.item, def.pose, () => {
        if (!current()) return;
        const motion = DOMESTIC_MOTIONS[command.actionId];
        if (motion) this.actors[role].playDomesticActivity(motion);
      });
    }
    if (command.type === 'pet_action') return this.performPet(role, command.pet, command.action, current);
    if (command.type === 'eat_takeout') return this.performFood(role, 'eat', current);
    if (command.type === 'cook') return this.prepareFood(role, command.recipe, current);
    return command.type === 'eat' && this.performFood(role, command.type, current);
  }

  private prepareFood(role: CharacterId, recipe: RecipeId, current: () => boolean): boolean {
    const cold = ingredientList(recipe).some(([id]) => GROCERY_DETAILS[id].area === 'fridge');
    const station = stationById('home', cold ? 'fridge' : 'cupboard')!;
    const actor = this.actors[role];
    const approach = approachFor(station, role);
    const start = nearestClearPoint(actor.root.position, this.obstacles, HOME_FLOOR);
    const towardStorage = start && findRoute(start, approach, this.obstacles, HOME_FLOOR);
    const towardStove = findRoute(approach, points.kitchen, this.obstacles, HOME_FLOOR);
    const length = (origin: Point, route: Point[]) => route.reduce((acc, next, index) => {
      const previous = route[index - 1] ?? origin;
      return acc + Math.hypot(next.x - previous.x, next.z - previous.z);
    }, 0);
    if (!start || !towardStorage || !towardStove ||
      length(start, towardStorage) + length(approach, towardStove) > 22) {
      return this.performFood(role, 'cook', current);
    }
    return this.walkTo(role, approach, () => {
      if (!current()) return;
      actor.faceTowards(this.vector.set(station.center.x, 0, station.center.z));
      this.openStorage(station.id, role);
      actor.playDomesticActivity('reach');
      this.preparations.set(role, { remaining: 1.25, next: () => {
        if (!current()) return;
        this.closeStorage(role);
        this.performFood(role, 'cook', current);
      } });
    });
  }

  finishTimedAction(role: CharacterId): void {
    this.preparations.delete(role);
    if (this.household && this.household.world.places[role] !== this.place) return;
    this.meals.get(role)!.visible = false;
    this.closeStorage(role);
    ++this.taskSequence[role];
    const home = this.homeTasks.get(role);
    this.clearHomeTask(role);
    this.actors[role].finishActivity();
    if (home && ['basin','wcBasin','bathtub','shower','toilet','officeChair','grill'].includes(home.station))
      this.actors[role].setPose('idle');
  }

  cancelTimedAction(role: CharacterId): void {
    this.preparations.delete(role);
    if (this.household && this.household.world.places[role] !== this.place) return;
    this.meals.get(role)!.visible = false;
    this.closeStorage(role);
    ++this.taskSequence[role];
    ++this.socialSequence;
    this.clearHomeTask(role);
    this.actors[role].clearProps();
    this.actors[role].setPose('idle');
  }

  performPet(role: CharacterId, petId: PetId, action: PetAction, current = () => true): boolean {
    if (action === 'buyFood') return true;
    const actor = this.actors[role];
    const pet = this.pets[petId];
    const filling = action === 'feed';
    const position = filling ? PETS[petId].bowl : pet.root.position;
    if (!filling) pet.stop();
    const target = petApproach(position, this.obstacles, HOME_FLOOR);
    const walking = target && this.walkTo(role, target, () => {
      if (!current()) return;
      actor.faceTowards(new THREE.Vector3(position.x,0,position.z));
      actor.playPetActivity(action);
      // The animal eats during its own routine, not when the player pours food.
      if (!filling) pet.react(action);
    });
    if (!walking) { pet.react(action); return false; }
    ++this.socialSequence;
    return true;
  }

  setHomeLeisure(roles: CharacterId[], activity: HomeLeisure | null, routes?: Partial<Record<CharacterId, WalkRoute>>): void {
    if (this.place !== 'home') return;
    if (!activity) {
      for (const role of roles) if (this.homeLeisure.delete(role)) {
        ++this.taskSequence[role];
        const actor = this.actors[role];
        const point = routes?.[role]?.from;
        if (point) actor.root.position.set(point.x, 0, point.z);
        actor.setPose('idle');
      }
      return;
    }
    if (roles.some(role => !this.actors[role].root.visible || this.sleepingOffline.has(role))) return;
    const follow = (role: CharacterId, arrive: () => void) => {
      const route = routes?.[role];
      if (!route) return;
      const actor = this.actors[role];
      actor.root.position.set(route.from.x, 0, route.from.z);
      actor.walkPath(route.path.map(p => new THREE.Vector3(p.x, 0, p.z)), arrive);
    };
    for (const role of roles) this.homeLeisure.add(role);
    if (activity === 'chat') {
      let arrived = 0;
      for (const role of roles) follow(role, () => {
        if (++arrived !== roles.length || roles.some(id => !this.homeLeisure.has(id))) return;
        const vlad = this.actors.vlad, alina = this.actors.alina;
        vlad.faceTowards(alina.root.position);
        alina.faceTowards(vlad.root.position);
        vlad.playDomesticActivity('chat');
        alina.playDomesticActivity('chat');
      });
      return;
    }
    for (const role of roles) {
      follow(role, () => {
        if (activity === 'tv' || activity === 'computer') {
          this.applyFurniturePose(role, activity === 'tv' ? 'sofa' : 'desk', activity === 'tv' ? 'sit' : 'work');
          if (activity === 'computer') this.actors[role].playDomesticActivity('games');
        } else {
          const pet = this.pets[activity];
          this.actors[role].faceTowards(pet.root.position);
          this.actors[role].playPetActivity('play');
          pet.react('play');
        }
      });
    }
  }

  playSocial(kind: SocialKind): boolean {
    const paths = (['vlad', 'alina'] as const).map((role) => {
      const actor = this.actors[role];
      const spot = meeting(this.place, role);
      return findRoute(
        { x: actor.root.position.x, z: actor.root.position.z }, spot, this.currentObstacles(), floorFor(this.place),
      );
    });
    if (!paths[0] || !paths[1]) return false;
    const sequence = ++this.socialSequence;
    let arrived = 0;
    (['vlad', 'alina'] as const).forEach((role, index) => {
      const route = paths[index]!;
      this.actors[role].walkPath(
        route.map((point) => new THREE.Vector3(point.x, 0, point.z)),
        () => {
          if (sequence !== this.socialSequence) return;
          arrived++;
          if (arrived === 2) {
            this.actors.vlad.faceTowards(this.actors.alina.root.position);
            this.actors.alina.faceTowards(this.actors.vlad.root.position);
            const target = kind === 'highFive' ? new THREE.Vector3(0, 1.64, meeting(this.place, 'vlad').z - 0.16) : undefined;
            this.actors.vlad.playGesture(kind, target);
            this.actors.alina.playGesture(kind, target);
          }
        },
      );
    });
    return true;
  }

  setTimeOfDay(minute: number): void {
    const phase = dayPhase({ day: 1, minute });
    if (phase === this.lastDayPhase) return;
    this.lastDayPhase = phase;
    this.remote?.setNight(phase === 'night' || phase === 'evening');
    // Reuse existing lights: no new meshes, draw calls or shadow maps.
    const settings = {
      morning: { sun: 1.95, ambient: 1.76, sky: 0xc6c3ad, warmth: 0xffd8b9 },
      day: { sun: 2.48, ambient: 1.87, sky: 0xc0c7ad, warmth: 0xffe5ce },
      evening: { sun: 1.55, ambient: 1.60, sky: 0xb8adae, warmth: 0xffc8a9 },
      night: { sun: 0.75, ambient: 1.32, sky: 0x85929c, warmth: 0xc5d1e8 },
    }[phase];
    this.sun.intensity = settings.sun;
    this.sun.color.setHex(settings.warmth);
    this.ambient.intensity = settings.ambient;
    this.ambient.color.setHex(phase === 'night' ? 0xc7d7ee : 0xeef2fb);
    (this.scene.background as THREE.Color).setHex(settings.sky);
    if (this.scene.fog) this.scene.fog.color.setHex(settings.sky);
  }

  private createLights(): void {
    this.scene.add(this.ambient);
    // Broad daylight illuminates faces from the open side facing the home camera.
    const sun = this.sun;
    sun.position.set(-2.6, 9, 5.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 22;
    sun.shadow.radius = 2.65;
    sun.shadow.intensity = 0.72;
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.025;
    this.scene.add(sun, sun.target);
    this.frameShadows(true);
  }

  private frameShadows(home: boolean): void {
    const offset = home ? 1.8 : 0;
    const bounds = home ? 12.3 : 8.5;
    this.sun.target.position.z = offset;
    this.sun.position.z = 5.5 + offset;
    const camera = this.sun.shadow.camera;
    camera.left = camera.bottom = -bounds;
    camera.right = camera.top = bounds;
    camera.updateProjectionMatrix();
  }

  private register(id: ItemId, group: THREE.Group, point: Point): void {
    this.scene.add(group);
    this.itemPoints.set(id, new THREE.Vector3(point.x, 0, point.z));
    group.traverse((part) => {
      if (part instanceof THREE.Mesh) {
        part.userData.interactable = id;
        this.interactiveMeshes.push(part);
      }
    });
  }

  private createHome(): void {
    this.entryLeaf = decorateHome(this.scene);
    this.yard = buildYard(this.scene);
    this.register('grill', this.yard.grill, points.grill);
    this.register('yardTable', this.yard.table, points.yardTable);
    buildPersonalFurniture(this.scene, model => this.register('bookcase',model,
      new THREE.Vector3(points.bookcase.x,0,points.bookcase.z)));
    const bench = homeBench();
    batchRigidParts(bench,true);
    this.scene.add(bench);
    buildSoftRugs(this.scene);
    this.scene.add(furnitureContact());
    buildFurniture((id, furniture, point) => {
      batchRigidParts(furniture, true);
      this.register(id, furniture, point);
    });
    this.scene.add(this.extensions.group);
    for (const [id, group] of this.extensions.stations) this.trackStation(this.stationMeshes, id, group);
    this.createPetBowls();
  }

  /** The original ceramic bowls remain in the batched room geometry. Add only
   * two generous touch targets and six tiny food pieces that reflect server state. */
  private createPetBowls(): void {
    const hitGeometry = new THREE.CylinderGeometry(.255, .255, .09, 16);
    const hitMaterial = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true,
      opacity:.008, depthWrite:false });
    for (const id of PET_IDS) {
      const { x, z } = PETS[id].bowl;
      const hit = new THREE.Mesh(hitGeometry, hitMaterial);
      hit.position.set(x, .145, z);
      hit.userData.interactable = 'bowl:' + id;
      this.scene.add(hit);
      this.interactiveMeshes.push(hit);
      for (let i = 0; i < PET_BOWL_CAPACITY; i++) {
        const pellet = new THREE.Mesh(drum, finish(id==='verdell' ? 0x945c31 : 0xb78551, 'wood'));
        const angle = (i / PET_BOWL_CAPACITY) * Math.PI * 2;
        pellet.scale.set(.052,.026,.052);
        pellet.position.set(x + Math.cos(angle)*.075,.118,z + Math.sin(angle)*.075);
        pellet.visible=false;
        this.scene.add(pellet);
        this.bowlFood[id].push(pellet);
      }
    }
  }

  private trackStation(target: THREE.Object3D[], id: string, object: THREE.Group): void {
    object.traverse(part => {
      if (part instanceof THREE.Mesh) {
        part.userData.station = id;
        target.push(part);
      }
    });
  }

  private currentObstacles() {
    return this.place === 'home' ? this.obstacles : this.externalObstacles;
  }

  private steerPast(other: CharacterId, from: Point, target: Point): Point {
    const neighbor = this.actors[other];
    if (!neighbor.root.visible) return target;
    const body = neighbor.bodyPosition(this.otherBody);
    return residentStep(from, target, body, this.currentObstacles(), floorFor(this.place));
  }

  private sitAt(role: CharacterId, station: Station): void {
    const actor = this.actors[role];
    const cafe = station.action.kind === 'dine';
    actor.setFurniturePose('sit', new THREE.Vector3(approachFor(station, role).x,
      role === 'vlad' ? -.24 : -.19, station.center.z + (cafe ? .51 : .12)), cafe ? Math.PI : 0);
  }

  private showMeal(role: CharacterId, x: number, y: number, z: number, grilled?: RecipeId): void {
    const meal = this.meals.get(role)!;
    meal.position.set(x, y, z);
    meal.getObjectByName('Indoor serving')!.visible = !grilled;
    const food = meal.getObjectByName('Grilled serving')!;
    food.visible = grilled !== undefined;
    if (grilled) selectGrilledFood(food, grilled);
    meal.visible = true;
  }

  walkTo(role: CharacterId, target: { x: number; z: number }, onArrive = () => {}): boolean {
    const actor = this.actors[role];
    const obstacles = this.currentObstacles();
    const from = nearestClearPoint(actor.root.position, obstacles, floorFor(this.place));
    const to = nearestClearPoint(target, obstacles, floorFor(this.place));
    const path = from && to ? findRoute(from, to, obstacles, floorFor(this.place)) : null;
    if (!path) return false;
    actor.walkPath(path.map(p => new THREE.Vector3(p.x, 0, p.z)), onArrive);
    return true;
  }

  runLocationPath(role: CharacterId, path: { x: number; z: number }[], station?: string, onArrive = () => {}): void {
    const target = path.at(-1);
    if (!target) { onArrive(); return; }
    this.closeStorage(role);
    this.preparations.delete(role);
    const arrival = () => {
      const site = stationById(this.place, station);
      if (site) {
        const actor = this.actors[role];
        actor.faceTowards(this.vector.set(site.center.x, 0, site.center.z));
        if (site.action.kind === 'fridge' || site.action.kind === 'cupboard') {
          this.openStorage(site.id, role);
          actor.playDomesticActivity('reach');
          this.preparations.set(role, { remaining: 1.5, next: () => actor.finishActivity() });
        }
      }
      onArrive();
    };
    // Replan from the visible position if a walk interrupted a previous one.
    if (!this.walkTo(role, target, arrival)) {
      this.actors[role].walkPath(path.map(p => new THREE.Vector3(p.x, 0, p.z)), arrival);
    }
  }

  openStorage(id: string, role = this.localRole): void { this.openDoors.set(role, id); }
  closeStorage(role = this.localRole): void { this.openDoors.delete(role); }

  setCart(count: number): void {
    if (!this.cart) {
      this.cart = carryingBag();
      const basket = this.cart.children[0] as THREE.Group;
      for (let i = 0; i < 4; i++) {
        const item = new THREE.Mesh(cube, finish([0xe4c58e, 0x829e87, 0xc88368, 0x9ba6b5][i]));
        item.position.set((i % 2 - .5) * .14, .34 + i * .017, i > 1 ? -.051 : .063);
        item.scale.set(.115, .17, .11);
        basket.add(item);
      }
      this.scene.add(this.cart);
    }
    if (count > this.cartSize && this.place === 'market') {
      const actor = this.actors[this.localRole];
      actor.playDomesticActivity('tidy');
      this.preparations.set(this.localRole, { remaining: .85, next: () => actor.finishActivity() });
    }
    this.cartSize = count;
    this.cart.visible = count > 0 && this.place === 'market';
    const products = this.cart.children[0].children.slice(-4);
    products.forEach((object, i) => { object.visible = i < count; });
  }

  private switchPlace(place: PlaceId): void {
    this.openDoors.clear();
    this.cameraMove = null;
    this.followSubject = null;
    this.inspected = null;
    this.defaultFrame = null;
    this.viewport = null;
    this.lastDayPhase = null;
    this.preparations.clear();
    this.petRoutines.clear();
    this.homeLeisure.clear();
    this.sleepingOffline.clear();
    for (const pet of Object.values(this.pets)) pet.stop();
    this.dogTrail = [];
    this.lastDogPoint = null;
    this.remote?.root.removeFromParent();
    this.remote?.dispose();
    this.remoteMeshes = [];
    this.externalObstacles = placeObstacles(place);
    this.remote = place === 'home' ? null : createLocation(place);
    this.scene = place === 'home' ? this.homeScene : new THREE.Scene();
    this.scene.background = new THREE.Color(0xc0c7ad);
    this.scene.fog = place === 'home' ? new THREE.Fog(0xc0c7ad, 64, 97) : new THREE.Fog(0xc0c7ad, 49, 75);
    if (this.remote) {
      this.scene.add(this.remote.root);
      for (const [id, group] of this.remote.stations) this.trackStation(this.remoteMeshes, id, group);
    }
    this.scene.add(this.ambient, this.sun, this.sun.target,
      ...Object.values(this.actors).map(actor => actor.root), ...Object.values(this.pets).map(pet => pet.root),
      ...this.contacts.map(contact => contact.shade), ...Object.values(this.bags), ...this.meals.values());
    for (const meal of this.meals.values()) meal.visible = false;
    if (this.cart) { this.cart.visible = false; this.scene.add(this.cart); }
    this.homeEffects.reset();
    this.grillCooking = false;
    this.homeTasks.clear();
    for (const actor of Object.values(this.actors)) actor.clearProps();
    this.place = place;
    this.controls.enablePan = place === 'home' || place === 'street' || place === 'market';
    this.frameShadows(place === 'home');
    this.controls.maxDistance = this.place === 'home' ? 74 : 51;
    this.controls.minDistance = 10;
    this.controls.maxPolarAngle = 1.25;
    this.refreshViewport();
    this.renderer.renderLists.dispose();
  }

  syncHousehold(state: GameState, role: CharacterId, reset = false, online: CharacterId[] = [role]): void {
    const previous = this.household;
    const place = state.world.places[role];
    const changed = place !== this.place;
    this.localRole = role;
    this.household = state;
    if (changed) this.switchPlace(place);
    this.setTimeOfDay(state.clock.minute);
    for (const id of ['vlad', 'alina'] as const) {
      const offline = id !== role && !online.includes(id);
      const wasSleeping = this.sleepingOffline.has(id);
      const sleep = offline && place === 'home' && !state.activeShifts[id];
      const away = !!state.activeShifts[id] || (offline ? !sleep : state.world.places[id] !== place);
      const appeared = !away && (!!previous?.activeShifts[id] || previous?.world.places[id] !== place);
      this.setAway(id, away);
      if (away || sleep) this.closeStorage(id);
      if (sleep && (!wasSleeping || reset || changed)) {
        this.sleepingOffline.add(id);
        this.restoreCharacter(id, points.bed.x, points.bed.z, 'sleep');
      } else if (!away && !sleep && (reset || changed || appeared || wasSleeping)) {
        const resident = state.characters[id];
        this.restoreCharacter(id, resident.x, resident.z, resident.pose);
      }
      if (!sleep) this.sleepingOffline.delete(id);
      this.bags[id].visible = !away && state.world.bags[id] > 0;
    }
    const dog = this.pets.verdell.root;
    const walker = state.world.dogWalker;
    dog.visible = walker ? place === 'park' && state.world.places[walker] === 'park' && !state.activeShifts[walker] : place === 'home';
    this.pets.simba.root.visible = place === 'home';
    if (!walker && previous?.world.dogWalker) this.petRoutines.delete('verdell');
    if (place === 'park' && walker && (changed || previous?.world.dogWalker !== walker)) {
      const point = state.pets.verdell.parkPosition ?? this.actors[walker].root.position;
      dog.position.set(point.x, 0, point.z);
      this.dogTrail = [];
      this.lastDogPoint = null;
    }
    for (const c of this.contacts) {
      if (c.pet) c.shade.visible = c.visual.parent?.visible === true;
    }
    if (place === 'home') {
      this.yard.platter.visible = GRILL_RECIPES.some(recipe => state.meals[recipe] > 0);
      for (const [recipe, serving] of this.yard.servings) serving.visible = state.meals[recipe] > 0;
      this.shoppingBags.forEach((bag, index) => { bag.visible = index < state.world.tableBags; });
      this.updateHomePets(state);
      if (this.served) this.served.visible = (Object.keys(state.meals) as RecipeId[])
        .some(recipe => !isGrillRecipe(recipe) && state.meals[recipe] > 0);
      this.extensions.parcel.visible = state.world.deliveries.some(d => d.readyAt <= clockMinutes(state.clock));
      const counts = { fridge: 0, cupboard: 0 };
      for (const [name, amount] of Object.entries(state.pantry)) {
        if (amount > 0) counts[GROCERY_DETAILS[name as keyof typeof GROCERY_DETAILS].area]++;
      }
      for (const [key, models] of this.extensions.stock) {
        models.forEach((model, index) => { model.visible = index < counts[key as keyof typeof counts]; });
      }
    }
  }

  private updateHomePets(state: GameState): void {
    for (const id of PET_IDS) {
      this.bowlFood[id].forEach((piece,index) => { piece.visible = index < state.petBowls[id]; });
      const pet = this.pets[id];
      const routine = state.pets[id].routine;
      if (!pet.root.visible || !routine) {
        this.petRoutines.delete(id);
        if (pet.root.visible) {
          pet.stop();
          const position = state.pets[id].position;
          pet.root.position.set(position.x, 0, position.z);
        }
        continue;
      }
      if (this.petRoutines.get(id) === routine.until) continue;
      this.petRoutines.set(id, routine.until);
      const distance = Math.max(0, clockMinutes(state.clock) - routine.startedAt) * PET_SPEED[id] / GAME_MINUTES_PER_REAL_SECOND;
      const route = sampleWalk(routine.route, distance);
      pet.root.position.set(route.from.x, 0, route.from.z);
      pet.followRoute(route.path.map(p => new THREE.Vector3(p.x, 0, p.z)), routine.kind,
        routine.kind === 'eat' ? Math.PI : routine.kind === 'sleep' ? Math.PI / 2 : undefined);
    }
  }

  private pick(clientX: number, clientY: number): void {
    const bounds = this.canvas.getBoundingClientRect();
    const x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    const y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const sceneMeshes = this.place === 'home' ? [...this.interactiveMeshes, ...this.stationMeshes] : this.remoteMeshes;
    const hit = this.raycaster.intersectObjects([...sceneMeshes, ...this.subjectMeshes], false).find(entry => {
      for (let part: THREE.Object3D | null = entry.object; part; part = part.parent) {
        if (!part.visible) return false;
      }
      return true;
    });
    const station: unknown = hit?.object.userData.station;
    if (typeof station === 'string') { this.navigation?.station(station); return; }
    const id: unknown = hit?.object.userData.interactable;
    if (id === 'vlad' || id === 'alina' || id === 'verdell' || id === 'simba' ||
        id === 'bowl:verdell' || id === 'bowl:simba') this.onPick(id);
    else if (typeof id === 'string' && id in objectNames) this.onPick(id as ItemId);
    else {
      const point = this.raycaster.ray.intersectPlane(new THREE.Plane(THREE.Object3D.DEFAULT_UP, 0), this.vector);
      if (point && pointIsClear(point, this.currentObstacles(), floorFor(this.place))) this.navigation?.ground(point.x, point.z);
    }
  }

  private homeFrame(compact: boolean, band: ViewBand): Frame {
    if (this.place === 'home') return portraitHomeFrame(this.camera.fov, this.camera.aspect, band,
      undefined, undefined, compact ? undefined : [.49, 1.28, 1.37]);
    if (this.remote && (this.place === 'market' || this.place === 'street'))
      return portraitHomeFrame(this.camera.fov, this.camera.aspect, band,
        this.remote.horizontal, this.remote.vertical, this.place === 'street' ? [.13,.89,1.0] : [.14,1.09,1.0]);
    if (compact && this.remote) return portraitHomeFrame(this.camera.fov, this.camera.aspect, band,
      this.remote.horizontal, this.remote.vertical, [.24, .98, 1.10]);
    const fit = THREE.MathUtils.clamp((0.69 - this.camera.aspect) / (0.69 - portraitAspect), 0, 1);
    return { position: homePosition.clone().multiplyScalar(1 + fit * .35).add(locationTarget), target: locationTarget.clone() };
  }

  refreshViewport(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const compact = this.compactPortrait.matches;
    const { pixelRatio, shadowSize } = renderProfile(compact, window.devicePixelRatio);
    const band = this.viewBand(this.inspected !== null);
    const previous = this.viewport;
    const sizeChanged = !previous || previous.width !== width || previous.height !== height;
    const scaleChanged = !previous || previous.pixelRatio !== pixelRatio;
    if (!sizeChanged && !scaleChanged && previous.compact === compact &&
        previous.band.top === band.top && previous.band.bottom === band.bottom) return;
    this.viewport = { width, height, pixelRatio, compact, band };

    if (sizeChanged) {
      this.camera.aspect = width / height;
      this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(
        Math.tan(THREE.MathUtils.degToRad(23)) * Math.max(1, portraitAspect / this.camera.aspect),
      ));
      this.camera.updateProjectionMatrix();
    }
    if (scaleChanged) this.renderer.setPixelRatio(pixelRatio);
    if (sizeChanged) this.renderer.setSize(width, height, false);
    if (this.sun.shadow.mapSize.x !== shadowSize) {
      this.sun.shadow.mapSize.setScalar(shadowSize);
      this.sun.shadow.map?.setSize(shadowSize, shadowSize);
      this.sun.shadow.radius = 2.65 * shadowSize / 1024;
    }

    if (this.inspected) {
      this.showcase(this.inspected);
      return;
    }
    const current = this.defaultFrame;
    this.defaultFrame = this.homeFrame(compact, band);
    if (this.cameraMove) {
      this.cameraMove = this.defaultFrame;
    } else if (!current || (this.camera.position.distanceTo(current.position) < 0.07 &&
        this.controls.target.distanceTo(current.target) < 0.07)) {
      this.camera.position.copy(this.defaultFrame.position);
      this.controls.target.copy(this.defaultFrame.target);
      this.controls.update();
    }
  }

  private followBag(bag: THREE.Group, actor: Actor): void {
    const { position, rotation } = actor.root;
    bag.position.set(position.x + Math.cos(rotation.y) * .37, .20, position.z - Math.sin(rotation.y) * .37);
    bag.rotation.y = rotation.y;
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    const now = performance.now();
    // Keep paths in real time in a slow frame. A short cap still prevents a
    // jump when returning from a suspended tab.
    const dt = Math.min((now - this.lastFrame) / 1000, 0.20);
    this.lastFrame = now;
    for (const id of ['vlad', 'alina'] as const) {
      const actor = this.actors[id];
      if (!actor.root.visible) continue;
      actor.update(dt, this.steering[id]);
      if (this.bags[id].visible) this.followBag(this.bags[id], actor);
    }
    if (this.place === 'home') {
      this.yard.lid.rotation.x = THREE.MathUtils.damp(this.yard.lid.rotation.x, this.grillCooking ? -1.22 : 0, 9, dt);
      this.yard.contents.visible = this.grillCooking;
    }
    if (this.place === 'home' && this.entryLeaf) {
      const { x, z, width } = HOUSE_ENTRY;
      const nearEntrance = (object: THREE.Object3D) => object.visible &&
        Math.abs(object.position.x - x) < width / 2 + .25 && Math.abs(object.position.z - z) < 1.82;
      const open = nearEntrance(this.actors.vlad.root) || nearEntrance(this.actors.alina.root) ||
        nearEntrance(this.pets.verdell.root) || nearEntrance(this.pets.simba.root);
      this.entryLeaf.position.x = THREE.MathUtils.damp(this.entryLeaf.position.x, x - (open ? width + .07 : 0), 14, dt);
    }
    for (const [role, prep] of this.preparations) {
      prep.remaining -= dt;
      if (prep.remaining <= 0) { this.preparations.delete(role); prep.next(); }
    }
    if (this.cart?.visible) this.followBag(this.cart, this.actors[this.localRole]);
    const walker = this.household?.world.dogWalker;
    const dog = this.pets.verdell;
    let pace = 0;
    if (walker && dog.root.visible && this.place === 'park') {
      const actor = this.actors[walker].root;
      const { x, z } = actor.position;
      const previous = this.lastDogPoint;
      if (!previous || Math.hypot(x - previous.x, z - previous.z) >= .28) {
        this.lastDogPoint = { x, z };
        this.dogTrail.push(this.lastDogPoint);
        if (this.dogTrail.length > 32) this.dogTrail.shift();
      }
      if (this.dogTrail.length > 2 && this.dogTrail[0] &&
        Math.hypot(dog.root.position.x - this.dogTrail[0].x, dog.root.position.z - this.dogTrail[0].z) < .11) this.dogTrail.shift();
      const endpoint = this.household?.pets.verdell.parkPosition;
      const atEnd = endpoint && Math.hypot(x - this.household!.characters[walker].x,
        z - this.household!.characters[walker].z) < .08;
      const target = atEnd && this.dogTrail.length <= 2 ? endpoint : (this.dogTrail[0] ?? actor.position);
      const dx = target.x - dog.root.position.x, dz = target.z - dog.root.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > .07) {
        const step = Math.min(1, dt * (this.dogTrail.length > 3 ? 10 : 5));
        dog.root.rotation.y = Math.atan2(dx, dz);
        const next = {x: dog.root.position.x + dx * step, z: dog.root.position.z + dz * step};
        if (pointIsClear(next, this.currentObstacles(), floorFor(this.place))) dog.root.position.set(next.x, 0, next.z);
        this.dogTravel += distance * step;
        pace = Math.min(1, distance * 2.3);
      }
    }
    if (dog.root.visible) dog.update(dt, this.dogTravel, pace);
    if (this.pets.simba.root.visible) this.pets.simba.update(dt);
    if (this.place === 'home') for (const [id, door] of this.extensions.doors) {
      const open = this.openDoors.get('vlad') === id || this.openDoors.get('alina') === id;
      door.rotation.y = THREE.MathUtils.damp(door.rotation.y, open ? -1.53 : 0, 11, dt);
    }
    for (const { visual, shade, pet } of this.contacts) {
      visual.getWorldPosition(this.contactPoint);
      shade.position.set(this.contactPoint.x, pet && this.place === 'home' ? 0.098 : 0.029, this.contactPoint.z);
      shade.material.opacity = pet ? 0.53 : 0.49 * (1 - THREE.MathUtils.smoothstep(this.contactPoint.y, 0.07, 0.52));
    }
    if (this.followSubject) {
      this.followSubject.getWorldPosition(this.followDelta);
      this.followDelta.sub(this.followPoint).multiplyScalar(1 - Math.exp(-dt * 10));
      this.followPoint.add(this.followDelta);
      this.controls.target.add(this.followDelta);
      this.camera.position.add(this.followDelta);
      if (this.cameraMove) {
        this.cameraMove.target.add(this.followDelta);
        this.cameraMove.position.add(this.followDelta);
      }
    }
    if (this.cameraMove) {
      const fraction = 1 - Math.exp(-dt * 5.5);
      this.controls.target.lerp(this.cameraMove.target, fraction);
      this.camera.position.lerp(this.cameraMove.position, fraction);
      if (this.camera.position.distanceTo(this.cameraMove.position) < 0.025 &&
          this.controls.target.distanceTo(this.cameraMove.target) < 0.025) {
        this.cameraMove = null;
        if (this.inspected) this.controls.maxDistance = 12;
      }
    }
    this.controls.update();
    if (this.place === 'home') this.homeEffects.update(now/1000);
    this.remote?.animate?.(now / 1000);
    this.renderer.render(this.scene, this.camera);
    this.onRenderedFrame?.(now, this.renderer.info.render.calls, this.renderer.info.render.triangles);
  };
}
