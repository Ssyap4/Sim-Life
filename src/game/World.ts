import { HomeEffects } from './HomeEffects';
import { buildHomeWing } from './HomeWing';
import { NeighborPeople } from './NeighborPeople';
import { NEIGHBORS, neighborPose } from '../shared/neighbors';
import { districtArrival, districtSite } from '../shared/district';
import { HomeComputerScreens } from './HomeComputerScreens';
import type { ComputerScene } from './ComputerScreenArt';
import type { ComputerDevice } from '../shared/computer';
import { GAME_BY_ID } from '../shared/computerGames';
import { isContact } from '../shared/socialLife';
import { BOOKS, HOME_SEATS, type HomePresentation } from '../shared/homeLife';
import { MATERIAL_BY_ID } from '../shared/educationCatalog';
import { isCareerPlace, type CareerShift } from '../shared/careers';
import { GRILL_RECIPES, ingredientList, isGrillRecipe, type RecipeId, type TakeoutId } from '../shared/food';
import { carryingBag, createLocation, homeExtensions } from './LocationScene';
import { floorFor, approachFor, clockMinutes, HOME_LAPTOP, meeting, placeObstacles, spawn, stationById, type PlaceId, type Station } from '../shared/locations';
import { GROCERY_DETAILS } from '../shared/storageSpace';
import { BATH_FIXTURES, DINING_TOP, GRILL_WORK, HOME_FLOOR, HOME_PLACEMENTS, HOUSE_ENTRY,
  KITCHEN_ACTIONS, KITCHEN_WORK, homeSeat, type BathFixture, type HomeLeisure } from '../shared/home';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CanvasGestureGate, type PointerContact } from './CanvasGestureGate';
import { subtleHaptic } from '../mobileHaptics';
import { Actor, type DomesticMotion } from './Actor';
import { dirtyDishStops, type DishStation } from '../shared/dirtyDishes';
import { diningSurface, tabletopPoint } from '../shared/diningSurface';
import { mealServingScale } from './MealGesture';
import { ceramicPlate, selectIndoorDish } from './MealArt';
import { servingOffset } from './CookingChoreography';
import { buildCookingStation } from './KitchenArt';
import type { CharacterModel } from './CharacterArt';
import { PetActor } from './PetActor';
import { PET_PERSON_CLEARANCE, separatePetBodies } from './PetTraffic';
import { petNavigationGeometry } from './PetNavigation';
import { PETS, PET_IDS, PET_SPEED, PET_BOWL_CAPACITY, petHungerLevel, petApproach, type PetId, type PetAction } from '../shared/pets';
import { findRoute, nearestClearPoint, pointIsClear, sampleWalk, type FloorRect, type WalkRoute } from './navigation';
import { ACTIONS, itemNames, points, type ItemId as SharedItemId, type ActionId, type CharacterId, type SocialKind, type GameState, type TimedCommand } from '../shared/protocol';
import { decorateHome } from './HomeStyling';
import { batchRigidParts, cube, softCube, orb, drum, finish } from './ArtKit';
import { inspectionFrame, type ViewBand } from './InspectionFrame';
import { portraitHomeFrame, renderProfile } from './HomeFrame';
import { buildFurniture, buildPersonalFurniture, buildSoftRugs } from './InteriorArt';
import { buildFurnishingModel, createPlacementGhost } from './FurnishingArt';
import { FURNITURE_BY_ID, isStaticFurnitureId, type StaticFurnitureId, type FurnitureFinish, type PlacedFurniture, type Rotation } from '../shared/furniture';
import { bedPose, selectSleepBed, type SleepBedId } from '../shared/bedSleep';
import { canFurniturePerform, diningLocation, furnitureUseLocation } from '../shared/furnitureUse';
import { buildYard, grilledFood, selectGrilledFood } from './YardArt';
import { dayPhase, gameMinutes, GAME_MINUTES_PER_REAL_SECOND } from '../shared/life';
import { RESIDENT_CLEARANCE, unoccupiedDestination } from './residentCollision';
import { residentTraffic, resetResidentTraffic, smoothResidentTrafficStep, type TrafficBody } from './ResidentFlow';

type ItemId = Exclude<SharedItemId, 'delivery'>;
type Point = { x: number; z: number };
type BowlPick = 'bowl:verdell' | 'bowl:simba';

// Reuse one helper, not a per-frame closure for each resident on mobile.
function relativeLookYaw(root: THREE.Object3D, target: THREE.Vector3): number {
  const dx = target.x - root.position.x, dz = target.z - root.position.z;
  return THREE.MathUtils.euclideanModulo(Math.atan2(dx, dz) - root.rotation.y + Math.PI,
    Math.PI * 2) - Math.PI;
}

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

type Frame = { position: THREE.Vector3; target: THREE.Vector3 };

export const objectNames = itemNames;

export class World {
  scene = new THREE.Scene();
  private readonly homeScene = this.scene;
  private readonly neighbors = new NeighborPeople();
  private neighborMinute = 0;
  private entryLeaf?: THREE.Group;
  private readonly extensions = homeExtensions();
  private readonly subjectMeshes: THREE.Object3D[] = [];
  private readonly stationMeshes: THREE.Object3D[] = [];
  private readonly bags = { vlad: carryingBag(), alina: carryingBag() };
  private readonly preparations = new Map<CharacterId, { remaining: number; next: () => void }>();
  private served: THREE.Group | null = null;
  private displayedMealRecipe: RecipeId | TakeoutId | undefined;
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
  private petGeometry = petNavigationGeometry(this.obstacles, HOME_FLOOR);
  private furnishedGeometryKey = '';
  private furnishingModels=new Map<number,THREE.Group>();
  private staticFixtureModels=new Map<StaticFurnitureId,THREE.Group>();
  private furnishingVisualKey='';
  private furnishingGhost:THREE.Group|null=null;
  private furnishingPlaceCallback:((x:number,z:number)=>{x:number;z:number}|null)|null=null;
  private furnishingFootprint:THREE.Mesh|null=null;
  private furnishingOutline:THREE.LineSegments|null=null;
  private furnishingGhostMaterials:THREE.MeshStandardMaterial[]=[];
  private lastFurnitureHover=0;
  private furnishingItemCallback:((id:number)=>void)|null=null;
  private furnishingParcels=new THREE.Group();
  private lastFrame = performance.now();
  private paused = false;
  private visualSeconds = 0;
  private quality: 'standard'|'high'|'low' = 'standard';
  private smoothedFrameMs = 16.7;
  private lastQualityUpdate = performance.now();
  private readonly roomGlow = new THREE.PointLight(0xffd5a5, 0, 19, 2);
  private socialSequence = 0;
  private readonly pairStages = new Map<CharacterId,{ arrived:boolean; active:boolean; playing:boolean; action:string }>();
  private readonly homeEffects = new HomeEffects(this.homeScene);
  private readonly kitchenEffects = buildCookingStation(this.homeScene);
  private kitchenCooking = false;
  private cookingClock = 0;
  private grillClock = 0;
  private activeGrillRecipe: RecipeId | undefined;
  private computerScreens!:HomeComputerScreens;
  private readonly homeTasks = new Map<CharacterId, HomePresentation>();
  private readonly dishTasks = new Set<CharacterId>();
  private readonly dirtyVisuals: Record<DishStation, THREE.Mesh[]> = { table: [], yardTable: [] };
  private readonly taskSequence = { vlad: 0, alina: 0 };
  private inspected: CharacterId | PetId | null = null;
  private yard!: ReturnType<typeof buildYard>;
  private grillCooking = false;
  private readonly otherBody = new THREE.Vector3();
  private readonly bowlFood: Record<PetId, THREE.Mesh[]> = { verdell: [], simba: [] };
  private readonly collisionFlow = { vlad: residentTraffic(), alina: residentTraffic() };
  private movementDt = 1 / 60;
  private readonly steering = {
    vlad: (from: Point, target: Point) => this.steerPast('vlad','alina', from, target),
    alina: (from: Point, target: Point) => this.steerPast('alina','vlad', from, target),
  };
  private followSubject: THREE.Object3D | null = null;
  private readonly followPoint = new THREE.Vector3();
  private readonly followDelta = new THREE.Vector3();
  private cameraMove: Frame | null = null;
  private neighborhoodView=false;
  private districtWide=false;
  private districtFocus: Point | null=null;
  private neighborBodies:TrafficBody[]=[];
  private readonly savedCameras=new Map<PlaceId,Frame>();
  private readonly tapLayer=document.createElement('div');
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
    private readonly navigation?: { station(id: string): void; ground(x: number, z: number): void;
      dismissTap?: () => boolean }) {
    this.scene.background = new THREE.Color(0xc0c7ad);
    this.scene.fog = new THREE.Fog(0xc0c7ad, 64, 97);

    this.tapLayer.className='world-tap-feedback';
    this.tapLayer.setAttribute('aria-hidden','true');
    this.canvas.parentElement?.append(this.tapLayer);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = false; // no shadow-map render passes

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 110);
    this.camera.position.copy(homePosition);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 1.0, 1.8);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.touches.ONE = THREE.TOUCH.PAN;
    // Pinch zoom + two-finger pan. Rotation comes only from the explicit
    // twist handler below, so a slightly uneven pinch cannot rotate twice.
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    this.controls.enablePan = true;
    // 0.18: allow pinch/pan to inspect neighbors and their wider gardens.
    this.controls.maxTargetRadius = 46;
    this.controls.minDistance = 10;
    this.controls.maxDistance = this.place === 'street' ? 96 : this.place === 'home' ? 74 : 51;
    this.controls.minPolarAngle = 0.24;
    this.controls.maxPolarAngle = 1.25;
    this.controls.update();

    this.createLights();
    this.createHome();
    // Grill portions are tappable just like the plates on the indoor table.
    // Invisible dishes are ignored by pick(), preventing ghost actions.
    for(const dish of [this.yard.platter,...this.yard.servings.values()])dish.traverse(part=>{
      if(part instanceof THREE.Mesh){
        part.userData.interactable='yardTable';
        this.interactiveMeshes.push(part);
      }
    });
    this.createDirtyDishes();
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
    }
    for (const id of ['vlad', 'alina'] as const) {
      this.bags[id].visible = false;
      this.scene.add(this.bags[id]);
      const plate = new THREE.Group();
      const dish = ceramicPlate();
      const food = new THREE.Group();
      food.name = 'Indoor serving';
      food.position.y = .035;
      selectIndoorDish(food,undefined);
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
    serving.traverse(object=>{
      if(object instanceof THREE.Mesh){
        object.userData.interactable='table';
        this.interactiveMeshes.push(object);
      }
    });
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
    const gate = new CanvasGestureGate();
    const contact = (event: PointerEvent): PointerContact => ({
      id: event.pointerId, x: event.clientX, y: event.clientY,
      type: event.pointerType === 'touch' ? 'touch' :
        event.pointerType === 'pen' ? 'pen' : 'mouse',
      primary: event.isPrimary, button: event.button, time: event.timeStamp,
    });

    this.canvas.addEventListener('pointerdown', event => {
      const touch = event.pointerType === 'touch';
      gate.down(contact(event));
      if (event.isPrimary) {
        this.controls.enablePan = touch || this.place === 'home';
        this.controls.dampingFactor = touch ? .22 : .065;
      }
    }, { capture: true });

    // IMPORTANT: capture before OrbitControls' document-level move handler.
    // stopPropagation on a bubble listener was too late: small finger tremors
    // already panned the camera while the touch still counted as a tap.
    this.canvas.addEventListener('pointermove', event => {
      const motion = gate.move(contact(event));
      if (motion.holdTap) {
        event.stopPropagation();
        return;
      }
      if (motion.twistRadians)
        this.controls.rotateLeft(-motion.twistRadians);
      if (event.pointerType === 'mouse' && this.furnishingGhost &&
          performance.now() - this.lastFurnitureHover > 125) {
        this.lastFurnitureHover = performance.now();
        this.previewFurnitureAt(event.clientX, event.clientY);
      }
    }, { capture: true });

    this.canvas.addEventListener('pointerup', event => {
      const picked = gate.up(contact(event));
      if (picked) {
        // Let OrbitControls finish releasing capture before opening an item
        // menu or sending a walking command. No visible tap delay.
        const { clientX, clientY } = event;
        const touch=event.pointerType==='touch';
        queueMicrotask(() => this.pick(clientX, clientY, touch));
      }
    }, { capture: true });

    const cancel = (event: PointerEvent) => gate.cancel(event.pointerId);
    this.canvas.addEventListener('pointercancel', cancel, { capture: true });
    this.canvas.addEventListener('lostpointercapture', cancel);
  }

  setActive(id: CharacterId): void {
    for (const actor of Object.values(this.actors)) actor.select(actor.id === id);
  }

  setAway(id:CharacterId,away:boolean):void {
    const resident=this.actors[id];
    if(resident.root.visible===!away)return;
    resident.root.visible=!away;
    if(away && this.inspected===id)this.showcase(null);
  }

  showcase(subject: CharacterId | PetId | null): void {
    this.neighborhoodView=false;
    this.inspected = subject;
    this.controls.minDistance = subject ? 1.10 : 10;
    // Keep the full transition in range before applying the inspection limit.
    this.controls.maxDistance = this.place === 'street' ? 96 : this.place === 'home' ? 74 : 51;
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

  private neighborCameraFrame():Frame {
    // Observe the active garden resident rather than showing tiny NPCs
    // behind the HUD. The camera affects only this player's viewport.
    const visiting=NEIGHBORS.map((_,i)=>neighborPose(i,this.neighborMinute))
      .find(p=>p.visible&&p.opacity>.30);
    const target=new THREE.Vector3(visiting?.x??-7.1,.65,visiting?.z??-20.3);
    const direction=new THREE.Vector3(.18,1.20,1.43).normalize();
    return {target,position:target.clone().addScaledVector(direction,21.5)};
  }
  focusNeighborhood():void {
    if(this.place!=='street')return;
    this.showcase(null);
    this.neighborhoodView=true;
    this.cameraMove=this.neighborCameraFrame();
  }
  focusDistrict(place:PlaceId):void {
    const site=districtSite(place);
    if(this.place!=='street'||!site)return;
    this.districtWide=false;
    this.districtFocus=districtArrival(place,this.localRole);
    this.showcase(null);
  }
  overviewDistrict():void {
    if(this.place!=='street')return;
    this.districtWide=true;
    this.showcase(null);
  }

  private frameDistrictResident():void {
    this.districtWide=false;
    this.districtFocus=null;
  }

  /** One deliberate, predictable camera reset at any location. */
  resetCamera():void {
    this.savedCameras.delete(this.place);
    if(this.place==='street')this.frameDistrictResident();
    this.inspected=null;
    this.neighborhoodView=false;
    this.followSubject=null;
    this.controls.minDistance=10;
    this.controls.maxDistance=this.place==='street'?96:this.place==='home'?74:51;
    this.controls.maxPolarAngle=1.25;
    this.defaultFrame=this.homeFrame(this.compactPortrait.matches,this.viewBand(false));
    this.cameraMove=this.defaultFrame;
  }

  restoreCharacter(id: CharacterId, x: number, z: number, pose: 'idle' | 'sit' | 'sleep' | 'work',
    selectedBed?:SleepBedId): void {
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
    if(pose==='sleep'&&this.household){
      const character=this.household.characters[id];
      const sleepingOn:SleepBedId=selectedBed??character.sleepingOn??'starter';
      const bed=bedPose(this.household,id,sleepingOn);
      if(bed){
        this.actors[id].setFurniturePose('sleep',
          new THREE.Vector3(bed.x,bed.y,bed.z),bed.yaw);
        return;
      }
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

  private laptopPose(role: CharacterId): void {
    const site = stationById('home', HOME_LAPTOP)!;
    const actor = this.actors[role];
    const { x, z } = site.center;
    const keys = [new THREE.Vector3(x+.16,.90,z+.07),new THREE.Vector3(x-.16,.90,z+.07)] as const;
    actor.setFurniturePose('work',new THREE.Vector3(x,role==='alina'?-.23:-.28,z+.64),Math.PI,keys);
    actor.playDomesticActivity('games');
  }

  private applyFurniturePose(id: CharacterId, itemId: string, pose: 'idle' | 'sit' | 'sleep' | 'work'): void {
    const actor = this.actors[id];
    const vlad = id === 'vlad';
    const anchors = {
      sofa: { x: vlad ? -.50 : .50, y: vlad ? .057 : .106, z: -.27, yaw: Math.PI },
      bed: { x: vlad ? -.55 : .55, y: 1.055, z: 1.01, yaw: 0 },
      desk: { x: 0, y: vlad ? -.24 : -.19, z: 1.01, yaw: Math.PI },
      table: { x: vlad ? .99 : -.99, y: vlad ? -.37 : -.32, z: 0, yaw: vlad ? -Math.PI / 2 : Math.PI / 2 },
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
    if(this.place!=='home'||!this.household)return;
    const resident=this.household.characters[id];
    if(sleeping){
      const bed=bedPose(this.household,id,resident.sleepingOn??'starter');
      if(!bed){this.actors[id].setPose('idle');return;}
      const arrived=()=>this.actors[id].setFurniturePose('sleep',
        new THREE.Vector3(bed.x,bed.y,bed.z),bed.yaw);
      if(!this.walkTo(id,{x:resident.x,z:resident.z},arrived))
        this.restoreCharacter(id,resident.x,resident.z,'sleep');
    }else{
      // The navigation root remains at the bed's accessible edge throughout sleep.
      const root=this.actors[id].root.position;
      this.restoreCharacter(id,root.x,root.z,'idle');
    }
  }

  performFood(id: CharacterId, action: 'cook' | 'eat', current = () => true,
    furnitureId?:number, dish?:RecipeId|TakeoutId): boolean {
    if (action === 'cook') {
      return this.perform(id, 'kitchen', 'idle', () => {
        if (!current()) return;
        const actor = this.actors[id];
        actor.faceTowards(cookingPan);
        actor.playActivity('cook', cookingPan, dish as RecipeId|undefined);
        if(dish){this.kitchenEffects.recipe(dish as RecipeId);this.cookingClock=0;}
        this.kitchenCooking=true;
      });
    }
    // Use each person's *own* seat and approach. The old shared table marker
    // placed two co-op players at the same navigation position.
    const bought=this.household&&diningLocation(this.household,id,furnitureId);
    if(bought){
      const place=bought.route.path.at(-1)??bought.route.from;
      return this.walkTo(id,place,()=>{
        if(!current())return;
        const actor=this.actors[id],pose=bought.pose;
        if(bought.seated)actor.setFurniturePose('sit',
          new THREE.Vector3(pose.x,pose.y,pose.z),pose.yaw);
        else {
          actor.setPose('idle');
          actor.faceTowards(new THREE.Vector3(bought.item.x,0,bought.item.z));
        }
        // Place a personal dish inside the actual rotated tabletop, near
        // this resident's visual seat. Never balance every plate at its center.
        const info=FURNITURE_BY_ID.get(bought.item.sku)!;
        const yaw=bought.item.rotation*Math.PI/2;
        const c=Math.cos(yaw),s=Math.sin(yaw);
        const dx=pose.x-bought.item.x,dz=pose.z-bought.item.z;
        const near=servingOffset(info.width,info.depth,dx*c-dz*s,dx*s+dz*c);
        const px=bought.item.x+near.x*c+near.z*s;
        const pz=bought.item.z-near.x*s+near.z*c;
        const serving=this.showMeal(id,px,info.height+.025,pz,dish);
        actor.playActivity('eat',serving,dish);
      });
    }
    if(furnitureId!==undefined||this.household?.furnishing.soldFixtures?.includes('table'))
      return false;
    const seat = homeSeat('table', id);
    return this.walkTo(id, seat.approach, () => {
      if (!current()) return;
      const actor = this.actors[id];
      actor.setFurniturePose('sit', new THREE.Vector3().copy(seat.position), seat.yaw);
      const plateX = seat.position.x + (id === 'vlad' ? -.59 : .59);
      const serving=this.showMeal(id, plateX, DINING_TOP + .014, seat.position.z,dish);
      actor.playActivity('eat',serving,dish);
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
    const inCenter = home.station === 'classroom' || home.station === 'lab' || home.station === 'workshop';
    if (this.place !== (inCenter ? 'education' : 'home')) return true;
    this.clearHomeTask(role);
    this.preparations.delete(role);
    this.homeTasks.set(role,home);
    const actor = this.actors[role];
    const {route,station,pickup,program} = home;
    const study = command.type === 'study' ? MATERIAL_BY_ID.get(command.material) : undefined;
    actor.root.position.set(route.from.x,0,route.from.z);
    const path = route.path.map(p => new THREE.Vector3(p.x,0,p.z));
    const current = () => this.homeTasks.get(role) === home;
    const arrive = () => {
      if (!current()) return;
      if (station === 'classroom' || station === 'lab' || station === 'workshop') {
        const { x, z } = stationById('education', station)!.center;
        const seatX = x + (role === 'vlad' ? -.63 : .63);
        const keys = station === 'lab' ? [new THREE.Vector3(seatX + .14, .91, z - .035),
          new THREE.Vector3(seatX - .14, .91, z - .035)] as const : undefined;
        actor.setFurniturePose(station === 'lab' ? 'work' : 'sit',
          new THREE.Vector3(seatX, role === 'vlad' ? -.28 : -.23, z + .64), Math.PI, keys);
        actor.playDomesticActivity(station === 'lab' ? 'games' : 'journal');
        return;
      }
      if (station === 'studyLaptop') { this.laptopPose(role); return; }
      if (station === 'studyDesk') {
        const target=home.furniturePose;
        if(target)actor.setFurniturePose('work',
          new THREE.Vector3(target.x,target.y,target.z),target.yaw);
        else this.applyFurniturePose(role,'desk','work');
        actor.playDomesticActivity('games');
        return;
      }
      if (station === 'studyPractice') { actor.playDomesticActivity('stretch'); return; }
      if (station === 'kitchenCook') {
        actor.faceTowards(cookingPan);
        actor.playActivity('cook',cookingPan,command.type==='cook'?command.recipe:undefined);
        if(command.type==='cook')this.kitchenEffects.recipe(command.recipe);
        this.kitchenCooking=true;
        this.cookingClock=0;
        return;
      }
      if (station === 'grill') {
        const target = new THREE.Vector3().copy(GRILL_WORK.target);
        actor.faceTowards(target);
        actor.playDomesticActivity('grill', target,command.type==='cook'?command.recipe:undefined);
        if (command.type === 'cook') {
          selectGrilledFood(this.yard.contents, command.recipe);
          this.activeGrillRecipe=command.recipe;
        }
        this.grillClock=0;
        this.grillCooking = true;
        return;
      }
      if (station === 'basin' || station === 'wcBasin' || station === 'shower' || station === 'toilet' || station === 'bathtub') {
        this.bathroomPose(role,station,command);
        return;
      }
      if(station==='furniture'){
        const pose=home.furniturePose;
        if(!pose)return;
        if(home.furnitureSeat){
          actor.setFurniturePose('sit',new THREE.Vector3(pose.x,pose.y,pose.z),pose.yaw);
        }else if(command.type==='furniture_use'&&
          ['deskJournal','deskGames','vladOrder','vladStudy','alinaStudy','alinaConsult'].includes(command.action)){
          actor.setFurniturePose('work',new THREE.Vector3(pose.x,pose.y,pose.z),pose.yaw);
        }else actor.faceTowards(new THREE.Vector3(pose.x,0,pose.z));
        if(command.type==='read_book'||study?.channel==='book')actor.playDomesticActivity('read');
        if(command.type==='furniture_use'){
          if(command.action==='read_book')actor.playDomesticActivity('read');
          else if(['deskJournal','tablePlan'].includes(command.action))actor.playDomesticActivity('journal');
          else if(['deskGames','vladOrder','vladStudy','alinaStudy','alinaConsult'].includes(command.action))
            actor.playDomesticActivity('games');
          else if(command.action==='tidy')actor.playDomesticActivity('tidy');
          else if(command.action==='sofaCall')actor.playDomesticActivity('phone');
          else if(command.action==='sofaMusic')actor.playDomesticActivity('watch');
        }
        if(program)actor.watch(program==='horror'?-1:program==='comedy'?1:0);
        return;
      }
      const seat = homeSeat(station,role);
      actor.setFurniturePose('sit',new THREE.Vector3().copy(seat.position),seat.yaw);
      if (program) {
        actor.watch(program === 'comedy' ? 1 : program === 'horror' ? -1 : 0);
      } else if (command.type === 'read_book' || study?.channel === 'book') actor.playDomesticActivity('read');
      else if (study?.channel === 'practice') actor.playDomesticActivity('journal');
      else if (station === 'yardTable' && command.type === 'eat') {
        const point=this.showMeal(role, seat.position.x, DINING_TOP, HOME_PLACEMENTS.yardTable.z + .22, command.recipe);
        actor.playActivity('eat',point,command.recipe);
      }
      else if (command.type === 'act') {
        const motion = DOMESTIC_MOTIONS[command.actionId];
        if (motion) actor.playDomesticActivity(motion);
      }
    };
    if(pickup!==undefined&&station==='kitchenCook'){
      actor.walkPath(path.slice(0,pickup),()=>{
        if(!current())return;
        const fridge=stationById('home','fridge')!;
        actor.faceTowards(new THREE.Vector3(fridge.center.x,0,fridge.center.z));
        this.openStorage('fridge',role);
        actor.playDomesticActivity('reach');
        this.preparations.set(role,{remaining:(home.pickupMs??0)/1000,next:()=>{
          this.closeStorage(role); if(current())actor.walkPath(path.slice(pickup),arrive);
        }});
      });
    }else if (pickup !== undefined && (command.type === 'read_book' || study?.channel === 'book')) {
      const takeBook = () => {
        if (!current()) return;
        actor.carryBook(command.type === 'read_book' ? BOOKS[command.book][4] : '#507e76');
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
    const pair=this.pairStages.get(role);
    if(pair) {
      pair.active=true;
      this.playPair(role);
      this.playPair(role==='vlad'?'alina':'vlad');
      return;
    }
    if (home?.program) this.homeEffects.television(role,home.program,home.lesson);
  }

  private startPair(role:CharacterId,action:string,home:HomePresentation):boolean {
    const pair=home.pair!;
    if(this.place!==pair.place)return true;
    this.clearHomeTask(role);
    this.preparations.delete(role);
    this.homeTasks.set(role,home);
    const stage={arrived:false,active:false,playing:false,action};
    this.pairStages.set(role,stage);
    const actor=this.actors[role];
    actor.root.position.set(home.route.from.x,0,home.route.from.z);
    const route=home.route.path.map(p=>new THREE.Vector3(p.x,0,p.z));
    const arrived=()=>{
      if(this.pairStages.get(role)!==stage)return;
      stage.arrived=true;
      this.playPair(role);
      this.playPair(role==='vlad'?'alina':'vlad');
    };
    const walk=()=>{
      if(home.pickup!==undefined) {
        actor.walkPath(route.slice(0,home.pickup),()=>{
          if(this.pairStages.get(role)!==stage)return;
          if(pair.carry==='book')actor.carryBook(BOOKS[pair.item as keyof typeof BOOKS]?.[4]??'#688e7c');
          if(pair.carry==='plate')actor.carryDirtyPlate();
          this.preparations.set(role,{remaining:(home.pickupMs??0)/1000,next:()=>actor.walkPath(route.slice(home.pickup),arrived)});
        });
      }else actor.walkPath(route,arrived);
    };
    actor.setPose('idle');
    if(pair.offsetMs) this.preparations.set(role,{remaining:pair.offsetMs/1000,next:walk});
    else walk();
    return true;
  }

  private playPair(role:CharacterId):void {
    const stage=this.pairStages.get(role), home=this.homeTasks.get(role), pair=home?.pair;
    if(!stage?.active||!stage.arrived||stage.playing||!pair)return;
    const other=role==='vlad'?'alina':'vlad', opposite=this.pairStages.get(other);
    if(isContact(pair.motion)&&opposite&&(!opposite.active||!opposite.arrived))return;
    stage.playing=true;
    const actor=this.actors[role], partner=this.actors[other];
    const focus=pair.target?new THREE.Vector3(pair.target.x,0,pair.target.z):undefined;
    if(pair.seat) {
      const seat=homeSeat(pair.seat,role);
      actor.setFurniturePose('sit',new THREE.Vector3().copy(seat.position),seat.yaw);
    }else if(pair.station){
      const station=stationById(this.place,pair.station);
      if(station)this.sitAt(role,station);
    }else if(focus)actor.faceTowards(focus);
    const leads=pair.from===role;
    switch(pair.motion){
      case 'stroll':
        actor.walkPath((pair.stroll??[]).map(p=>new THREE.Vector3(p.x,0,p.z)),()=>actor.playPartnerGesture('talk',leads));break;
      case 'watch':
        actor.watch(home?.program==='comedy'?1:home?.program==='horror'?-1:0);
        this.homeEffects.television(role,home?.program,home?.lesson);break;
      case 'read':actor.playDomesticActivity('read');break;
      case 'cook':
        actor.faceTowards(cookingPan);
        actor.playActivity('cook',cookingPan,pair.item as RecipeId|undefined);
        if(pair.item)this.kitchenEffects.recipe(pair.item as RecipeId);
        this.kitchenCooking=true;this.cookingClock=0;break;
      case 'grill':
        actor.playDomesticActivity('grill',new THREE.Vector3().copy(GRILL_WORK.target),pair.item as RecipeId|undefined);
        if(pair.item){
          selectGrilledFood(this.yard.contents,pair.item as RecipeId);
          this.activeGrillRecipe=pair.item as RecipeId;
        }
        this.grillClock=0;
        this.grillCooking=true;break;
      case 'prep': {
        // During cooperative cooking the helper prepares ingredients at a
        // separate counter (or the garden table), not in empty air beside
        // the cook. Keep both residents at their server-assigned stations.
        const prepTarget=pair.item&&isGrillRecipe(pair.item as RecipeId)
          ? new THREE.Vector3(HOME_PLACEMENTS.yardTable.x,DINING_TOP+.045,HOME_PLACEMENTS.yardTable.z)
          : new THREE.Vector3().copy(KITCHEN_WORK.wash.target);
        actor.faceTowards(prepTarget);
        actor.playDomesticActivity('prep',prepTarget,pair.item as RecipeId|undefined);
        break;
      }
      case 'wash':actor.playDomesticActivity('dishes',new THREE.Vector3().copy(KITCHEN_WORK.dishes.target));break;
      case 'serve':
        actor.carryDirtyPlate();
        actor.playDomesticActivity('reach',focus?.setY(.95));break;
      case 'unpack':actor.playDomesticActivity('tidy');break;
      case 'eat':{
        if(pair.seat){
          const seat=homeSeat(pair.seat,role).position;
          const x=pair.seat==='yardTable'?seat.x:seat.x+(role==='vlad'?-.56:.56);
          const plate=this.showMeal(role,x,DINING_TOP+.02,seat.z-.14,pair.item as RecipeId|undefined);
          actor.playActivity('eat',plate,pair.item as RecipeId|undefined);
        }else if(pair.station) {
          const site=stationById(this.place,pair.station)!;
          const plate=this.showMeal(role,site.center.x+(role==='vlad'?-.25:.25),1.02,site.center.z-.10,pair.item as RecipeId|undefined);
          actor.playActivity('eat',plate,pair.item as RecipeId|undefined);
        }break;
      }
      case 'feed':actor.playPetActivity('feed');break;
      case 'pet':{
        const action=stage.action==='petPlay'?'play':stage.action==='petBrush'?'brush':'pet';
        const pet=pair.pet&&pair.pet in this.pets?this.pets[pair.pet as PetId]:undefined;
        const petContact=pet?.root.position.clone().add(new THREE.Vector3(0,pair.pet==='verdell'?.49:.43,0));
        if(leads) {
          actor.playPetActivity(action,petContact);
          pet?.react(action);
        } else {
          // Two human players take turns; otherwise the helper stood motionless
          // throughout the entire "brush together" action.
          actor.playPartnerGesture('listen',false);
          this.preparations.set(role,{remaining:stage.action==='petBrush'?4.2:3.3,next:()=>{
            if(this.pairStages.get(role)!==stage)return;
            partner.finishActivity();
            if(stage.action==='petBrush')partner.playPartnerGesture('listen',true);
            actor.playPetActivity(action,petContact);
            pet?.react(action);
          }});
        }
        break;
      }
      case 'highFive':
        actor.playGesture('highFive',actor.root.position.clone().lerp(partner.root.position,.5).setY(1.59));break;
      case 'hands':case 'slowDance':
        actor.playPartnerGesture(pair.motion,leads,actor.root.position.clone().lerp(partner.root.position,.5).setY(pair.motion==='hands'?.99:1.20));break;
      case 'hair':case 'shoulder':
        actor.playPartnerGesture(pair.motion,leads,actor.root.position.clone().lerp(partner.root.position,.82).setY(pair.motion==='hair'?1.61:1.27));break;
      default:actor.playPartnerGesture(pair.motion,leads);
    }
  }

  private clearHomeTask(role: CharacterId): boolean {
    const home = this.homeTasks.get(role);
    if (!home) return false;
    this.homeTasks.delete(role);
    this.pairStages.delete(role);
    this.homeEffects.television(role);
    if (home.station === 'shower' || home.station === 'bathtub' || home.station === 'wcBasin')
      this.homeEffects.water(home.station,false);
    if (home.station === 'grill'||home.pair?.motion==='grill') this.grillCooking = false;
    if (home.station === 'kitchenCook'||home.pair?.motion==='cook'||home.pair?.motion==='prep')
      this.kitchenCooking = false;
    return true;
  }

  startTimedAction(role: CharacterId, command: TimedCommand, home?: HomePresentation): boolean {
    if (this.household && this.household.world.places[role] !== this.place) return true;
    this.closeStorage(role);
    if(command.type==='together')return home?.pair?this.startPair(role,command.action,home):false;
    if(home) {
      if(command.type==='furniture_use'&&
        ['deskGames','deskJournal','vladOrder','vladStudy','alinaStudy','alinaConsult'].includes(command.action)){
        const mode:ComputerScene['mode']=command.action==='deskGames'?'game':
          command.action==='deskJournal'?'notes':role==='vlad'?'code':'hair';
        this.computerScreens.task(role,'desktop',{mode,role});
      }
      if(command.type==='study' && (home.station==='studyDesk'||home.station==='studyLaptop')) {
        const device=home.station==='studyLaptop'?'laptop':'desktop';
        this.computerScreens.task(role,device,{mode:'study',role});
      }
      return this.startHomeTask(role,command,home);
    }
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
          const plate=this.showMeal(role, station.center.x + (role === 'vlad' ? -.25 : .25), 1.022, station.center.z - .10);
          actor.playActivity('eat',plate);
        }
      };
      return this.walkTo(role, approachFor(station, role), start);
    }
    const sequence = ++this.taskSequence[role];
    const current = () => sequence === this.taskSequence[role];
    if (command.type === 'play_game' || command.type === 'computer_video') {
      const device=command.device,scene:ComputerScene=command.type==='play_game'
        ? {mode:'game',role,game:command.game}
        : {mode:'video',role,clip:command.clip};
      this.computerScreens.task(role,device,scene);
      const begin=()=>{
        if(!current())return;
        if(device==='laptop')this.laptopPose(role);
        else this.applyFurniturePose(role,'desk','work');
        if(command.type==='play_game')this.actors[role].playDomesticActivity('games');
        else this.actors[role].playDomesticActivity('read');
      };
      if(device==='desktop'&&this.household&&
        (command.furnitureId!==undefined||this.household.furnishing.soldFixtures?.includes('desk'))){
        const deskId=command.furnitureId??this.household.furnishing.placed.find(item=>
          FURNITURE_BY_ID.get(item.sku)?.shape==='desk')?.id;
        const place=deskId!==undefined?furnitureUseLocation(this.household,role,deskId,'deskGames'):null;
        if(!place)return false;
        const destination=place.route.path.at(-1)??place.route.from;
        return this.walkTo(role,destination,()=>{
          if(!current())return;
          const pose=place.pose;
          this.actors[role].setFurniturePose('work',
            new THREE.Vector3(pose.x,pose.y,pose.z),pose.yaw);
          if(command.type==='play_game')this.actors[role].playDomesticActivity('games');
          else this.actors[role].playDomesticActivity('read');
        });
      }
      return device==='laptop'
        ? this.walkTo(role,stationById('home',HOME_LAPTOP)!.approach,begin)
        : this.perform(role,'desk','work',begin);
    }
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
      if (def.item==='desk') {
        const mode:ComputerScene['mode']=command.actionId==='deskGames'?'game':
          command.actionId==='deskJournal'?'notes':
          role==='vlad'?'code':'hair';
        this.computerScreens.task(role,command.computer??'desktop',{mode,role,...(mode==='game'?{game:GAME_BY_ID.keys().next().value}: {})});
      }
      if (command.actionId === 'kitchenDishes') {
        // One errand collects plates at the used tables, then brings them to
        // the kitchen sink. Both players see the same server-backed counters.
        const stops = this.household ? dirtyDishStops(this.household.dirtyDishes, role,this.household) : [];
        if (!stops.length) return false;
        const actor = this.actors[role];
        const sink = KITCHEN_WORK.dishes;
        const visit = (index: number): boolean => {
          if (!current()) return false;
          if (index >= stops.length) {
            return this.walkTo(role, sink.position, () => {
              if (!current()) return;
              const target = new THREE.Vector3().copy(sink.target);
              actor.faceTowards(target);
              actor.playDomesticActivity('dishes', target);
            });
          }
          return this.walkTo(role, stops[index], () => {
            if (!current()) return;
            actor.playDomesticActivity('reach');
            this.preparations.set(role, { remaining: .8, next: () => {
              if (!current()) return;
              actor.carryDirtyPlate();
              visit(index + 1);
            } });
          });
        };
        const started = visit(0);
        if (started) this.dishTasks.add(role);
        return started;
      }
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
      if (def.item === 'desk' && command.computer === 'laptop') {
        return this.walkTo(role,stationById('home',HOME_LAPTOP)!.approach,() => {
          if (!current()) return;
          this.laptopPose(role);
          const motion = DOMESTIC_MOTIONS[command.actionId];
          if (motion) this.actors[role].playDomesticActivity(motion);
        });
      }
      return this.perform(role, def.item, def.pose, () => {
        if (!current()) return;
        const motion = DOMESTIC_MOTIONS[command.actionId];
        if (motion) this.actors[role].playDomesticActivity(motion);
      });
    }
    if (command.type === 'pet_action') return this.performPet(role, command.pet, command.action, current);
    if (command.type === 'eat_takeout') return this.performFood(role, 'eat', current,command.furnitureId,command.item);
    if (command.type === 'cook') return this.prepareFood(role, command.recipe, current);
    return command.type === 'eat' && this.performFood(role, command.type, current,command.furnitureId,command.recipe);
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
      return this.performFood(role, 'cook', current,undefined,recipe);
    }
    return this.walkTo(role, approach, () => {
      if (!current()) return;
      actor.faceTowards(this.vector.set(station.center.x, 0, station.center.z));
      this.openStorage(station.id, role);
      actor.playDomesticActivity('reach');
      this.preparations.set(role, { remaining: 1.25, next: () => {
        if (!current()) return;
        this.closeStorage(role);
        this.performFood(role, 'cook', current,undefined,recipe);
      } });
    });
  }

  finishTimedAction(role: CharacterId): void {
    this.computerScreens.endTask(role);
    this.preparations.delete(role);
    const dishes = this.dishTasks.delete(role);
    if (this.household && this.household.world.places[role] !== this.place) return;
    this.meals.get(role)!.visible = false;
    this.closeStorage(role);
    ++this.taskSequence[role];
    const home = this.homeTasks.get(role);
    this.clearHomeTask(role);
    this.actors[role].finishActivity();
    if(home?.pair?.motion==='stroll')this.actors[role].setPose('idle');
    if (dishes) this.actors[role].setPose('idle');
    if (home && ['basin','wcBasin','bathtub','shower','toilet','officeChair','grill'].includes(home.station))
      this.actors[role].setPose('idle');
  }

  cancelTimedAction(role: CharacterId): void {
    this.computerScreens.endTask(role);
    this.preparations.delete(role);
    this.dishTasks.delete(role);
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
          const fixture=activity==='tv'?'sofa':'desk';
          const action=activity==='tv'?'free_tv':'deskGames';
          const pose=activity==='tv'?'sit':'work';
          const endpoint=routes?.[role]?.path.at(-1)??routes?.[role]?.from;
          let placed=false;
          // The shared household position advances while the actor walks.
          // Thus a freshly computed route may choose another approach side:
          // match the original destination to the nearest compatible real
          // furniture, not to an exact path endpoint that can change.
          if(this.household&&endpoint){
            let nearestUse:ReturnType<typeof furnitureUseLocation>=null;
            let nearestDistance=Infinity;
            for(const item of this.household.furnishing.placed){
              if(!canFurniturePerform(item,action))continue;
              const distance=Math.hypot(item.x-endpoint.x,item.z-endpoint.z);
              if(distance>3.2||distance>=nearestDistance)continue;
              const use=furnitureUseLocation(this.household,role,item.id,action);
              if(!use)continue;
              nearestUse=use;
              nearestDistance=distance;
            }
            if(nearestUse){
              this.actors[role].setFurniturePose(pose,
                new THREE.Vector3(nearestUse.pose.x,nearestUse.pose.y,nearestUse.pose.z),
                nearestUse.pose.yaw);
              placed=true;
            }
          }
          if(!placed){
            if(!this.household?.furnishing.soldFixtures?.includes(fixture))
              this.applyFurniturePose(role,fixture,pose);
            else this.actors[role].setPose('idle');
          }
          if(activity==='computer'&&
             (placed||!this.household?.furnishing.soldFixtures?.includes(fixture)))
            this.actors[role].playDomesticActivity('games');
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
    const hour = THREE.MathUtils.euclideanModulo(minute,1440);
    const phase = dayPhase({day:1,minute:hour});
    if(phase!==this.lastDayPhase) {
      this.lastDayPhase=phase;
      this.remote?.setNight(phase==='night'||phase==='evening');
    }
    // Smooth solar cycle: cool predawn, amber sunrise, clear midday, honeyed
    // golden hour and a blue twilight. No shadow maps or extra render passes.
    const keys = [
      {t:0,sky:0x566782,sun:.33,ambient:1.11,warm:0xadc9ee,glow:.86},
      {t:300,sky:0x65778a,sun:.37,ambient:1.12,warm:0xb7cbed,glow:.78},
      {t:365,sky:0xada5a3,sun:1.10,ambient:1.32,warm:0xffaf83,glow:.47},
      {t:445,sky:0xd9c5a2,sun:1.92,ambient:1.64,warm:0xffd0a3,glow:.15},
      {t:625,sky:0xc1d2c9,sun:2.35,ambient:1.80,warm:0xffecda,glow:0},
      {t:900,sky:0xbcd3d3,sun:2.46,ambient:1.86,warm:0xfff0df,glow:0},
      {t:1050,sky:0xd4c7b0,sun:1.90,ambient:1.67,warm:0xffd4a4,glow:.06},
      {t:1145,sky:0xc2988d,sun:1.15,ambient:1.46,warm:0xffad79,glow:.42},
      {t:1230,sky:0x78839a,sun:.59,ambient:1.20,warm:0xb5c2f1,glow:.76},
      {t:1320,sky:0x566782,sun:.33,ambient:1.11,warm:0xadc9ee,glow:.86},
      {t:1440,sky:0x566782,sun:.33,ambient:1.11,warm:0xadc9ee,glow:.86},
    ];
    const index = keys.findIndex(key=>key.t>=hour);
    const end = keys[Math.max(1,index)];
    const begin = keys[Math.max(0,Math.max(1,index)-1)];
    const progress=THREE.MathUtils.smoothstep(hour,begin.t,end.t);
    const mix=(a:number,b:number)=>THREE.MathUtils.lerp(a,b,progress);
    const mixed=(a:number,b:number)=>new THREE.Color(a).lerp(new THREE.Color(b),progress);
    this.sun.intensity=mix(begin.sun,end.sun);
    this.sun.color.copy(mixed(begin.warm,end.warm));
    this.ambient.intensity=mix(begin.ambient,end.ambient);
    this.ambient.color.copy(mixed(0xbdcee4,0xeef2fb))
      .lerpColors(new THREE.Color(0xbdcee4),new THREE.Color(0xeef2fb),
        THREE.MathUtils.smoothstep(this.sun.intensity,.33,1.7));
    const sky=mixed(begin.sky,end.sky);
    (this.scene.background as THREE.Color).copy(sky);
    if(this.scene.fog)this.scene.fog.color.copy(sky);
    this.roomGlow.intensity=mix(begin.glow,end.glow);
    const solarAngle=(hour-360)/720*Math.PI;
    this.sun.position.set(-2.6+Math.cos(solarAngle)*6,
      3+Math.max(0,Math.sin(solarAngle))*10,
      5.5+Math.cos(solarAngle)*3);
  }

  private createLights(): void {
    this.scene.add(this.ambient);
    // One inexpensive shadowless practical light for evening interiors.
    this.roomGlow.position.set(0, 2.55, -0.5);
    this.roomGlow.castShadow = false;
    this.scene.add(this.roomGlow);
    // Broad daylight illuminates faces from the open side facing the home camera.
    const sun = this.sun;
    sun.position.set(-2.6, 9, 5.5);
    sun.castShadow = false;
    this.scene.add(sun, sun.target);
  }

  private frameSun(home: boolean): void {
    const offset = home ? 1.8 : 0;
    this.sun.target.position.z = offset;
    this.sun.position.z = 5.5 + offset;

  }

  private register(id: ItemId, group: THREE.Group, point: Point): void {
    this.scene.add(group);
    if(isStaticFurnitureId(id))this.staticFixtureModels.set(id,group);
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
    buildHomeWing(this.scene);
    this.yard = buildYard(this.scene);
    this.register('grill', this.yard.grill, points.grill);
    this.register('yardTable', this.yard.table, points.yardTable);
    buildPersonalFurniture(this.scene, model => this.register('bookcase',model,
      new THREE.Vector3(points.bookcase.x,0,points.bookcase.z)),
      (id,model)=>this.staticFixtureModels.set(id,model));
    buildSoftRugs(this.scene,(id,model)=>this.staticFixtureModels.set(id,model));
    let desktop:THREE.Group|undefined;
    buildFurniture((id, furniture, point) => {
      batchRigidParts(furniture, true);
      if(id==='desk')desktop=furniture;
      this.register(id, furniture, point);
    });
    this.computerScreens=new HomeComputerScreens(desktop!,this.extensions.stations.get(HOME_LAPTOP)!);
    this.scene.add(this.extensions.group);
    for (const [id, group] of this.extensions.stations) this.trackStation(this.stationMeshes, id, group);
    this.createPetBowls();
    this.createFurnitureParcels();
  }

  /** Dirty plates are lightweight, shared visual props. The authoritative
   * counts live on the server and survive reloading the household. */
  updateFurnitureDeliveryTime(nowMinute:number):void {
    if(!this.household||this.place!=='home')return;
    const count=this.household.furnishing.orders.filter(item=>item.readyAt<=nowMinute).length;
    this.furnishingParcels.visible=count>0;
    this.furnishingParcels.children.forEach((model,index)=>{model.visible=index<count;});
  }

  private createFurnitureParcels():void {
    this.furnishingParcels.name='Доставленные коробки мебели';
    for(let i=0;i<4;i++){
      const box=new THREE.Mesh(cube,finish([0xc79a69,0xb99064,0xdeb88e,0xc49a6c][i],'wood'));
      box.scale.set(.65+i%2*.12,.38+i%3*.11,.58);
      box.position.set(3.40+(i%2)*.72,.21+i%3*.045,5.85+Math.floor(i/2)*.68);
      this.furnishingParcels.add(box);
      const tape=new THREE.Mesh(cube,finish(0xe9d5a9,'fabric'));
      tape.scale.set(.07,.012,.60);
      tape.position.set(0,.51,0);box.add(tape);
    }
    this.furnishingParcels.visible=false;
    this.homeScene.add(this.furnishingParcels);
  }

  private renderOwnedFurniture(placed:readonly PlacedFurniture[]):void {
    const signature=JSON.stringify([placed,this.household?.furnishing.soldFixtures?.includes('desk')??false]);
    if(signature===this.furnishingVisualKey)return;
    this.furnishingVisualKey=signature;
    this.computerScreens.hostDesktop(null);
    for(const model of this.furnishingModels.values()){
      model.traverse(part=>{
        const at=this.interactiveMeshes.indexOf(part);
        if(at!==-1)this.interactiveMeshes.splice(at,1);
      });
      model.removeFromParent();
      model.traverse(part=>{
        if(part instanceof THREE.Mesh&&!([cube,softCube,orb,drum] as THREE.BufferGeometry[]).includes(part.geometry))
          part.geometry.dispose();
      });
    }
    this.furnishingModels.clear();
    for(const item of placed){
      const model=buildFurnishingModel(item.sku,item.finish);
      model.position.set(item.x,.01,item.z);
      model.rotation.y=item.rotation*Math.PI/2;
      model.userData.furnitureId=item.id;
      model.traverse(part=>{
        if(part instanceof THREE.Mesh){
          part.userData.furnitureId=item.id;
          this.interactiveMeshes.push(part);
        }
      });
      this.homeScene.add(model);
      this.furnishingModels.set(item.id,model);
    }
    if(this.household?.furnishing.soldFixtures?.includes('desk')){
      const replacement=placed.find(item=>FURNITURE_BY_ID.get(item.sku)?.shape==='desk');
      if(replacement)this.computerScreens.hostDesktop(this.furnishingModels.get(replacement.id)!);
    }
  }

  focusDesktopFurniture(id:number):void{
    if(!this.household?.furnishing.soldFixtures?.includes('desk'))return;
    const item=this.household.furnishing.placed.find(entry=>entry.id===id);
    if(item&&FURNITURE_BY_ID.get(item.sku)?.shape==='desk'){
      const model=this.furnishingModels.get(id);
      if(model)this.computerScreens.hostDesktop(model);
    }
  }

  setFurnishingPick(onTarget:(x:number,z:number)=>{x:number;z:number}|null,onItem:(id:number)=>void):void {
    this.furnishingPlaceCallback=onTarget;
    this.furnishingItemCallback=onItem;
  }

  beginFurnishingPlacement(sku:string,finish:FurnitureFinish,rotation:Rotation):void {
    this.endFurnishingPlacement();
    this.furnishingGhost=createPlacementGhost(sku,finish);
    this.furnishingGhost.rotation.y=rotation*Math.PI/2;
    const info=FURNITURE_BY_ID.get(sku)!;
    const sizeW=info.width+.065,sizeD=info.depth+.065;
    this.furnishingFootprint=new THREE.Mesh(new THREE.PlaneGeometry(sizeW,sizeD),
      new THREE.MeshBasicMaterial({color:0x66ad78,transparent:true,opacity:.25,
        depthWrite:false,side:THREE.DoubleSide}));
    this.furnishingFootprint.rotation.x=-Math.PI/2;
    this.furnishingFootprint.position.y=.018;
    this.furnishingFootprint.renderOrder=2;
    this.furnishingGhost.add(this.furnishingFootprint);
    this.furnishingOutline=new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(sizeW,sizeD)),
      new THREE.LineBasicMaterial({color:0x268f51,transparent:true,opacity:.95}));
    this.furnishingOutline.rotation.x=-Math.PI/2;
    this.furnishingOutline.position.y=.023;
    this.furnishingGhost.add(this.furnishingOutline);
    this.furnishingGhostMaterials=[];
    this.furnishingGhost.traverse(obj=>{
      if(obj instanceof THREE.Mesh && obj!==this.furnishingFootprint)
        this.furnishingGhostMaterials.push(obj.material as THREE.MeshStandardMaterial);
    });
    this.homeScene.add(this.furnishingGhost);
    this.setFurnishingValidity(false);
    // Start with a meaningful home-room location instead of a ghost floating
    // above the center of the house. The same callback updates the UI.
    const target=this.furnishingPlaceCallback?.(13.45,-5.65);
    if(target)this.furnishingGhost.position.set(target.x,.04,target.z);
  }

  turnFurnishingPlacement(rotation:Rotation):void {
    const ghost=this.furnishingGhost;
    if(!ghost)return;
    ghost.rotation.y=rotation*Math.PI/2;
    const newTarget=this.furnishingPlaceCallback?.(ghost.position.x,ghost.position.z);
    if(newTarget)ghost.position.set(newTarget.x,.04,newTarget.z);
  }

  setFurnishingValidity(valid:boolean):void {
    const tint=valid?0x36be73:0xe45555;
    if(this.furnishingFootprint){
      (this.furnishingFootprint.material as THREE.MeshBasicMaterial).color.setHex(tint);
    }
    if(this.furnishingOutline){
      (this.furnishingOutline.material as THREE.LineBasicMaterial).color.setHex(tint);
    }
    for(const material of this.furnishingGhostMaterials)
      material.emissive.setHex(tint).multiplyScalar(.20);
  }

  private previewFurnitureAt(clientX:number,clientY:number):void {
    if(this.place!=='home'||!this.furnishingGhost)return;
    const bounds=this.canvas.getBoundingClientRect();
    const x=(clientX-bounds.left)/bounds.width*2-1;
    const y=-(clientY-bounds.top)/bounds.height*2+1;
    this.raycaster.setFromCamera(new THREE.Vector2(x,y),this.camera);
    const point=this.raycaster.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0,1,0),0),this.vector);
    if(!point)return;
    const selected=this.furnishingPlaceCallback?.(
      Math.round(point.x*100)/100,Math.round(point.z*100)/100);
    if(selected)this.furnishingGhost.position.set(selected.x,.04,selected.z);
  }

  endFurnishingPlacement():void {
    if(!this.furnishingGhost)return;
    const ghost=this.furnishingGhost;
    ghost.removeFromParent();
    ghost.traverse(part=>{
      if(part instanceof THREE.LineSegments){
        part.geometry.dispose();
        (part.material as THREE.Material).dispose();
      }
      if(part instanceof THREE.Mesh){
        if(!([cube,softCube,orb,drum] as THREE.BufferGeometry[]).includes(part.geometry))
          part.geometry.dispose();
        (part.material as THREE.Material).dispose();
      }
    });
    this.furnishingGhost=null;
    this.furnishingFootprint=null;
    this.furnishingOutline=null;
    this.furnishingGhostMaterials=[];
  }

  private createDirtyDishes(): void {
    const plateMaterial = finish(0xd6c4ac, 'ceramic');
    const crumbsMaterial = finish(0x8a664c, 'wood');
    for (const station of ['table', 'yardTable'] as const) {
      const place = HOME_PLACEMENTS[station];
      for (let index = 0; index < 6; index++) {
        // Three places along the far tabletop edge, then a little stack
        // directly above the first three. A meal can still use either seat.
        const mesh = new THREE.Mesh(drum, plateMaterial);
        mesh.scale.set(.132, .022, .132);
        mesh.position.set(place.x + (index % 3 - 1) * .34,
          DINING_TOP + .02 + Math.floor(index / 3) * .042,
          place.z + (station === 'table' ? -.37 : .36));
        // A tiny brown residue distinguishes these from ready-to-eat plates.
        const residue = new THREE.Mesh(softCube, crumbsMaterial);
        residue.scale.set(.26, .14, .19);
        residue.position.set(.12, .65, -.08);
        mesh.add(residue);
        mesh.visible = false;
        this.homeScene.add(mesh);
        this.dirtyVisuals[station].push(mesh);
      }
    }
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

  private steerPast(role:CharacterId,other: CharacterId, from: Point, target: Point): Point {
    const bodies: TrafficBody[] = [];
    const neighbor = this.actors[other];
    if (neighbor.root.visible && !this.sleepingOffline.has(other)) {
      const body = neighbor.bodyPosition(this.otherBody);
      bodies.push({ position: { x: body.x, z: body.z }, clearance: RESIDENT_CLEARANCE, person:true, moving:neighbor.isWalking() });
    }
    // People choose a side-step around a pet, never push the pet away.
    // Sweep against both animals and the other resident simultaneously, so
    // avoiding Simba cannot steer the player through Verdell (or Alina).
    if (this.place === 'home') for (const id of PET_IDS) {
      const pet = this.pets[id].root;
      if (pet.visible) bodies.push({
        position: { x: pet.position.x, z: pet.position.z },
        clearance: PET_PERSON_CLEARANCE,
      });
    }
    if(this.place==='street')for(const body of this.neighborBodies){
      if(Math.hypot(body.position.x-from.x,body.position.z-from.z)<2.8)bodies.push(body);
    }
    const actor = this.actors[role];
    const dx=target.x-from.x,dz=target.z-from.z;
    const otherDirection={x:Math.sin(neighbor.root.rotation.y),z:Math.cos(neighbor.root.rotation.y)};
    const dist=Math.hypot(neighbor.root.position.x-from.x,neighbor.root.position.z-from.z);
    const opposed=dx*otherDirection.x+dz*otherDirection.z < -.35*Math.hypot(dx,dz);
    const approaching=dx*(neighbor.root.position.x-from.x)+dz*(neighbor.root.position.z-from.z) > 0;
    const yieldToOncoming=role==='vlad'&&actor.isWalking()&&neighbor.isWalking()&&dist<1.15&&opposed&&approaching;
    return smoothResidentTrafficStep(from,target,bodies,this.currentObstacles(),floorFor(this.place),
      this.collisionFlow[role],this.movementDt,yieldToOncoming);
  }

  private sitAt(role: CharacterId, station: Station): void {
    const actor = this.actors[role];
    const cafe = station.action.kind === 'dine';
    actor.setFurniturePose('sit', new THREE.Vector3(approachFor(station, role).x,
      role === 'vlad' ? -.24 : -.19, station.center.z + (cafe ? .51 : .12)), cafe ? Math.PI : 0);
  }

  private showMeal(role: CharacterId, x: number, y: number, z: number,
    dish?:RecipeId|TakeoutId): THREE.Vector3 {
    const meal = this.meals.get(role)!;
    meal.position.set(x, y, z);
    const grilled = dish!==undefined && isGrillRecipe(dish as RecipeId);
    // Give each ordered/selected dish its own recognizable light 3D serving.
    // Reinitialize on task START only, never regenerate meshes every frame.
    const indoor = meal.getObjectByName('Indoor serving')! as THREE.Group;
    indoor.scale.setScalar(1);
    indoor.visible = !grilled;
    if(!grilled)selectIndoorDish(indoor,dish);
    const food = meal.getObjectByName('Grilled serving')!;
    food.scale.setScalar(1);
    food.visible = grilled;
    if(grilled)selectGrilledFood(food,dish as RecipeId);
    meal.visible = true;
    return new THREE.Vector3(x,y+.08,z);
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
    if (this.place==='street' && role===this.localRole) {
      this.neighborhoodView=false;
      this.frameDistrictResident();
      this.followSubject=this.actors[role].root;
      this.followPoint.copy(this.followSubject.position);
      if(this.controls.target.distanceTo(this.followPoint)>8)
        this.cameraMove=this.homeFrame(this.compactPortrait.matches,this.viewBand(false));
    }
    // Replan from the visible position if a walk interrupted a previous one.
    if (!this.walkTo(role, target, arrival)) {
      this.actors[role].walkPath(path.map(p => new THREE.Vector3(p.x, 0, p.z)), arrival);
    }
  }

  openStorage(id: string, role = this.localRole): void { this.openDoors.set(role, id); }
  closeStorage(role = this.localRole): void { this.openDoors.delete(role); }

  previewComputer(device:ComputerDevice,scene:ComputerScene|null):void {
    this.computerScreens.preview(device,scene);
  }

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
    if(!this.inspected&&!this.cameraMove&&!this.neighborhoodView){
      this.savedCameras.set(this.place,{
        position:this.camera.position.clone(),target:this.controls.target.clone(),
      });
    }
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
    this.scene.fog = place === 'home' ? new THREE.Fog(0xc0c7ad, 64, 97) : new THREE.Fog(0xc0c7ad, place==='street'?98:49, place==='street'?148:75);
    if (this.remote) {
      this.scene.add(this.remote.root);
      for (const [id, group] of this.remote.stations) this.trackStation(this.remoteMeshes, id, group);
    }
    this.scene.add(this.ambient, this.sun, this.sun.target,
      ...Object.values(this.actors).map(actor => actor.root), ...Object.values(this.pets).map(pet => pet.root),
      ...Object.values(this.bags), ...this.meals.values());
    for (const meal of this.meals.values()) meal.visible = false;
    if (this.cart) { this.cart.visible = false; this.scene.add(this.cart); }
    this.homeEffects.reset();
    this.grillCooking = false;
    this.kitchenCooking=false;
    this.kitchenEffects.root.visible=false;
    this.homeTasks.clear();
    this.neighborhoodView=false;
    this.frameDistrictResident();
    this.neighbors.group.removeFromParent();
    this.neighborBodies=[];
    if(place==='street'){
      this.neighbors.bindDoors(this.scene);
      this.scene.add(this.neighbors.group);
      this.neighbors.group.visible=true;
    }
    this.computerScreens.resetPreviews();
    this.pairStages.clear();
    this.dishTasks.clear();
    for (const actor of Object.values(this.actors)) actor.clearProps();
    this.place = place;
    this.camera.far=place==='street'?155:110;
    this.camera.updateProjectionMatrix();
    this.controls.maxTargetRadius = place === 'street' ? 44 : place === 'home' ? 36 : 18;
    this.controls.enablePan = place === 'home' || place === 'street' || place === 'market' || place === 'education' || isCareerPlace(place);
    this.frameSun(place === 'home');
    this.controls.maxDistance = this.place === 'street' ? 96 : this.place === 'home' ? 74 : 51;
    this.controls.minDistance = 10;
    this.controls.maxPolarAngle = 1.25;
    this.refreshViewport();
    const remembered=place==='street'?undefined:this.savedCameras.get(place);
    if(remembered){
      this.camera.position.copy(remembered.position);
      this.controls.target.copy(remembered.target);
      this.controls.update();
    }
    this.renderer.renderLists.dispose();
  }

  private showCareerStation(id: CharacterId, shift: CareerShift): void {
    if (shift.mode === 'remote' && shift.homeDevice === 'desktop') {
      if(this.household?.furnishing.soldFixtures?.includes('desk')){
        const desk=this.household.furnishing.placed.find(item=>
          FURNITURE_BY_ID.get(item.sku)?.shape==='desk');
        const target=desk&&furnitureUseLocation(this.household,id,desk.id,'deskJournal');
        if(!target)return;
        const pose=target.pose;
        this.actors[id].setFurniturePose('work',
          new THREE.Vector3(pose.x,pose.y,pose.z),pose.yaw);
      }else this.applyFurniturePose(id,'desk','work');
      this.actors[id].playDomesticActivity('games');
      return;
    }
    const key = shift.mode === 'remote' ? HOME_LAPTOP : shift.station;
    const site = stationById(this.place,key);
    if (!site || !shift.station) return;
    const actor = this.actors[id];
    const {x,z} = site.center;
    if (key === HOME_LAPTOP) this.laptopPose(id);
    else if (shift.station === 'desk') {
      const keyboard = [new THREE.Vector3(x+.16,.90,z+.07),new THREE.Vector3(x-.16,.90,z+.07)] as const;
      actor.setFurniturePose('work',new THREE.Vector3(x,id==='alina'?-.23:-.28,z+.64),Math.PI,keyboard);
      actor.playDomesticActivity('games');
    } else {
      actor.setPose('idle');
      actor.faceTowards(new THREE.Vector3(x,0,z));
      actor.playDomesticActivity(shift.station==='lead'?'phone':shift.station==='service'?'reach':'journal',
        shift.station==='service'?new THREE.Vector3(x,.91,z):undefined);
    }
  }

  syncHousehold(state: GameState, role: CharacterId, reset = false, online: CharacterId[] = [role]): void {
    const previous = this.household;
    const place = state.world.places[role];
    const changed = place !== this.place;
    this.localRole = role;
    this.household = state;
    const furnishingKey = JSON.stringify([state.furnishing?.placed ?? [],state.furnishing?.soldFixtures??[]]);
    if(furnishingKey!==this.furnishedGeometryKey){
      this.furnishedGeometryKey=furnishingKey;
      this.obstacles.splice(0,this.obstacles.length,...placeObstacles('home',state.furnishing));
      this.petGeometry=petNavigationGeometry(this.obstacles,HOME_FLOOR);
    }
    const minute = gameMinutes(state.clock);
    // House NPCs share the server clock, without persisting visual-only traffic.
    if (reset || Math.abs(minute - this.neighborMinute) > 1.25) this.neighborMinute = minute;
    if (changed) this.switchPlace(place);
    this.setTimeOfDay(state.clock.minute);
    for (const id of ['vlad', 'alina'] as const) {
      // Both clients animate from the same authoritative household needs.
      this.actors[id].setNeeds(state.characters[id]);
      const offline = id !== role && !online.includes(id);
      const wasSleeping = this.sleepingOffline.has(id);
      const work = state.careers.residents[id].shift;
      this.computerScreens.career(id,place==='home' && state.world.places[id]==='home' && work?.mode==='remote'
        ? work.homeDevice??'laptop':null);
      const previousWork = previous?.careers.residents[id].shift;
      const sleep = offline && place === 'home' && !state.activeShifts[id] && !work;
      const away = !!state.activeShifts[id] || (offline ? !sleep : state.world.places[id] !== place);
      const appeared = !away && (!!previous?.activeShifts[id] || previous?.world.places[id] !== place);
      this.setAway(id, away);
      if (away || sleep) this.closeStorage(id);
      if (sleep && (!wasSleeping || reset || changed)) {
        this.sleepingOffline.add(id);
        const resident=state.characters[id];
        const bed=selectSleepBed(state,id,typeof resident.sleepingOn==='number'?resident.sleepingOn:undefined);
        if(bed.ok)this.restoreCharacter(id,bed.bed.approach.x,bed.bed.approach.z,
          'sleep',bed.bed.id);
        else this.restoreCharacter(id,resident.x,resident.z,'idle');
      } else if (!away && !sleep && (reset || changed || appeared || wasSleeping)) {
        const resident = state.characters[id];
        this.restoreCharacter(id, resident.x, resident.z, resident.pose);
      }
      if (!sleep) this.sleepingOffline.delete(id);
      if (!away && !sleep && work?.station && (reset || changed || appeared || work.station !== previousWork?.station ||
          work.task?.phase !== previousWork?.task?.phase && work.task?.phase !== 'walking')) {
        this.showCareerStation(id,work);
      }
      if (!away && !work && previousWork?.mode === 'remote') this.actors[id].setPose('idle');
      this.bags[id].visible = !away && state.world.bags[id] > 0;
    }
    const partner=role==='vlad'?'alina':'vlad';
    if(previous&&place==='home'&&previous.world.places[role]==='home'&&online.includes(partner)&&
      state.world.places[partner]==='home'&&
      (previous.world.places[partner]!=='home'||previous.activeShifts[partner]&&!state.activeShifts[partner]))
      this.actors[role].noticePartnerArrival();
    const dog = this.pets.verdell.root;
    const walker = state.world.dogWalker;
    dog.visible = walker ? place === 'park' && state.world.places[walker] === 'park' && !state.activeShifts[walker] : place === 'home';
    this.pets.simba.root.visible = place === 'home';
    // Signals come from authoritative shared stats, so both players see the
    // same warnings as the pet roams, sleeps or accompanies a dog walker.
    for (const id of PET_IDS) this.pets[id].setHungerLevel(petHungerLevel(state.pets[id].satiety));
    if (!walker && previous?.world.dogWalker) this.petRoutines.delete('verdell');
    if (place === 'park' && walker && (changed || previous?.world.dogWalker !== walker)) {
      const point = state.pets.verdell.parkPosition ?? this.actors[walker].root.position;
      dog.position.set(point.x, 0, point.z);
      this.dogTrail = [];
      this.lastDogPoint = null;
    }
    if (place === 'home') {
      const top=diningSurface(state);
      for (const station of ['table','yardTable'] as const) {
        this.dirtyVisuals[station].forEach((plate,index)=>{
          if(station==='table'){
            const step=top.kind==='counter'?.18:Math.min(.34,top.width*.23);
            const point=tabletopPoint(top,(index%3-1)*step,
              top.kind==='counter'?0:-Math.min(.37,top.depth*.32));
            plate.position.set(point.x,top.height+.02+Math.floor(index/3)*.042,point.z);
          }
          plate.visible=index<state.dirtyDishes[station];
        });
      }
      const onTable=(kind:'meal'|'takeout',item:string)=>
        state.readyFood.some(batch=>batch.kind===kind&&batch.item===item&&
          batch.storage==='table'&&batch.portions>0&&batch.expiresAt>clockMinutes(state.clock));
      this.yard.platter.visible = GRILL_RECIPES.some(recipe => onTable('meal',recipe));
      for (const [recipe, serving] of this.yard.servings) serving.visible = onTable('meal',recipe);
      for(const [id,model] of this.staticFixtureModels)
        model.visible=!state.furnishing.soldFixtures?.includes(id);
      this.renderOwnedFurniture(state.furnishing.placed);
      this.updateFurnitureDeliveryTime(clockMinutes(state.clock));
      this.updateHomePets(state);
      if(this.served){
        const platePos=tabletopPoint(top,0,top.kind==='counter'?.08:-Math.min(.28,top.depth*.25));
        this.served.position.set(platePos.x,top.height+.014,platePos.z);
        // Totals include the fridge, but only food actually served on the
        // table is allowed to appear in the 3D scene.
        const recipe=state.readyFood.find(batch=>batch.storage==='table'&&
          batch.portions>0&&batch.expiresAt>clockMinutes(state.clock)&&
          (batch.kind==='takeout'||!isGrillRecipe(batch.item as RecipeId)))?.item as
            (RecipeId|TakeoutId|undefined);
        if(recipe!==this.displayedMealRecipe&&recipe){
          selectIndoorDish(this.served.getObjectByName('Indoor serving')! as THREE.Group,recipe);
        }
        this.displayedMealRecipe=recipe;
        this.served.visible=recipe!==undefined;
      }
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

  private touchPulse(clientX: number,clientY: number,kind:'select'|'walk'|'place'):void {
    const layerRect=this.tapLayer.getBoundingClientRect();
    const marker=document.createElement('span');
    marker.className='world-tap-pulse '+kind;
    marker.style.left=(clientX-layerRect.left)+'px';
    marker.style.top=(clientY-layerRect.top)+'px';
    this.tapLayer.append(marker);
    marker.addEventListener('animationend',()=>marker.remove(),{once:true});
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      window.setTimeout(()=>marker.remove(),350);
    subtleHaptic(kind==='place'?'place':'select');
  }

  private pick(clientX: number, clientY: number, touch = false): void {
    // Outside an open action menu, the first tap only dismisses the menu.
    // Never send an unexpected walk or open a different interaction behind it.
    if(this.navigation?.dismissTap?.())return;
    const bounds=this.canvas.getBoundingClientRect();
    const ndc=(px:number,py:number)=>new THREE.Vector2(
      ((px-bounds.left)/bounds.width)*2-1,
      -((py-bounds.top)/bounds.height)*2+1);
    const visible=(entry:THREE.Intersection)=>{
      for(let part:THREE.Object3D|null=entry.object;part;part=part.parent)
        if(!part.visible)return false;
      return true;
    };
    const meshes=this.place==='home'
      ? [...this.interactiveMeshes,...this.stationMeshes,...this.subjectMeshes]
      : [...this.remoteMeshes,...this.subjectMeshes];
    const intersections=(px:number,py:number)=>{
      this.raycaster.setFromCamera(ndc(px,py),this.camera);
      return this.raycaster.intersectObjects(meshes,false).find(visible);
    };
    let hit=intersections(clientX,clientY);
    // On phones the target's invisible hit zone is larger than its model.
    // Extra ray casts run only if the exact tap missed, never every frame.
    if(!hit&&touch&&!this.furnishingGhost){
      let nearest: { hit:THREE.Intersection;score:number }|null=null;
      for(const [ox,oy] of [[-9,0],[9,0],[0,-9],[0,9],
        [-13,-13],[13,-13],[-13,13],[13,13]]){
        const candidate=intersections(clientX+ox,clientY+oy);
        if(!candidate)continue;
        // Screen-space proximity first, with slight depth priority to avoid
        // selecting furniture behind a more obvious foreground object.
        const score=Math.hypot(ox,oy)+candidate.distance*.035;
        if(!nearest||score<nearest.score)nearest={hit:candidate,score};
      }
      hit=nearest?.hit;
      // Put the ray back on the actual finger location for walking.
      this.raycaster.setFromCamera(ndc(clientX,clientY),this.camera);
    }
    if(this.place==='home'&&this.furnishingGhost){
      this.previewFurnitureAt(clientX,clientY);
      this.touchPulse(clientX,clientY,'place');
      return;
    }
    const furnitureId:unknown=hit?.object.userData.furnitureId;
    if(this.place==='home'&&typeof furnitureId==='number'){
      this.touchPulse(clientX,clientY,'select');
      this.furnishingItemCallback?.(furnitureId);
      return;
    }
    const station:unknown=hit?.object.userData.station;
    if(typeof station==='string'){
      this.touchPulse(clientX,clientY,'select');
      this.navigation?.station(station);
      return;
    }
    const id:unknown=hit?.object.userData.interactable;
    if(id==='vlad'||id==='alina'||id==='verdell'||id==='simba'||
       id==='bowl:verdell'||id==='bowl:simba'){
      this.touchPulse(clientX,clientY,'select');
      this.onPick(id);
    } else if(typeof id==='string'&&id in objectNames){
      this.touchPulse(clientX,clientY,'select');
      this.onPick(id as ItemId);
    } else {
      this.raycaster.setFromCamera(ndc(clientX,clientY),this.camera);
      const point=this.raycaster.ray.intersectPlane(
        new THREE.Plane(THREE.Object3D.DEFAULT_UP,0),this.vector);
      if(point&&pointIsClear(point,this.currentObstacles(),floorFor(this.place))){
        this.touchPulse(clientX,clientY,'walk');
        this.navigation?.ground(point.x,point.z);
      }
    }
  }

  private homeFrame(compact: boolean, band: ViewBand): Frame {
    if (this.place === 'home') return portraitHomeFrame(this.camera.fov,this.camera.aspect,band);
    if(this.place==='street'){
      if(this.districtWide&&this.remote)return portraitHomeFrame(this.camera.fov,this.camera.aspect,band,this.remote.horizontal,this.remote.vertical,[.48,1.35,1.16]);
      const resident=this.districtFocus ?? this.household?.characters[this.localRole] ?? districtArrival('home',this.localRole);
      const target=new THREE.Vector3(resident.x,.46,resident.z);
      const reverse=this.districtFocus && this.districtFocus.z>8;
      const axis=new THREE.Vector3(.51,1.19,reverse ? -1.20 : 1.24).normalize();
      return {target,position:target.clone().addScaledVector(axis,compact?22:26)};
    }
    if (this.remote && this.place === 'market')
      return portraitHomeFrame(this.camera.fov,this.camera.aspect,band,this.remote.horizontal,this.remote.vertical,[.14,1.09,1.0]);
    if (compact && this.remote) return portraitHomeFrame(this.camera.fov, this.camera.aspect, band,
      this.remote.horizontal, this.remote.vertical, [.24, .98, 1.10]);
    const fit = THREE.MathUtils.clamp((0.69 - this.camera.aspect) / (0.69 - portraitAspect), 0, 1);
    return { position: homePosition.clone().multiplyScalar(1 + fit * .35).add(locationTarget), target: locationTarget.clone() };
  }

  setPaused(value: boolean): void {
    this.paused = value;
    this.lastFrame = performance.now();
  }

  refreshViewport(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const compact = this.compactPortrait.matches;
    const { pixelRatio: initialRatio } = renderProfile(compact, window.devicePixelRatio);
    const pixelRatio = compact
      ? Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 1.45
        : this.quality === 'low' ? 1.0 : initialRatio)
      : initialRatio;
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
    if (this.inspected) {
      this.showcase(this.inspected);
      return;
    }
    const current = this.defaultFrame;
    this.defaultFrame = this.homeFrame(compact, band);
    const nextFrame=this.neighborhoodView ? this.neighborCameraFrame() : this.defaultFrame;
    if (this.cameraMove) {
      this.cameraMove = nextFrame;
    } else if (this.neighborhoodView || !current ||
        (this.camera.position.distanceTo(current.position) < 0.07 &&
        this.controls.target.distanceTo(current.target) < 0.07)) {
      this.camera.position.copy(nextFrame.position);
      this.controls.target.copy(nextFrame.target);
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
    const frameMs = Math.max(1, now - this.lastFrame);
    const dt = this.paused ? 0 : Math.min(frameMs / 1000, 0.20);
    this.lastFrame = now;
    this.visualSeconds += dt;
    this.smoothedFrameMs = this.smoothedFrameMs * .97 + Math.min(frameMs, 150) * .03;
    if (!this.paused && this.viewport?.compact && now - this.lastQualityUpdate > 8000) {
      this.lastQualityUpdate = now;
      const nextQuality = this.smoothedFrameMs > 24 ? 'low'
        : this.smoothedFrameMs < 17.8 ? 'high' : 'standard';
      if (nextQuality !== this.quality) {
        this.quality = nextQuality;
        this.refreshViewport();
      }
    }
    this.movementDt=dt;
    if (this.place === 'street' && this.household) {
      this.neighborMinute += dt * GAME_MINUTES_PER_REAL_SECOND;
      this.neighborBodies=this.neighbors.update(this.neighborMinute,this.camera);
    }
    for (const id of ['vlad', 'alina'] as const) {
      const actor = this.actors[id];
      if (!actor.root.visible) continue;
      // Local, visual-only awareness for spontaneous glances. Never steer
      // people toward a pet/partner or change server gameplay state.
      const center = actor.root.position;
      const partnerId = id === 'vlad' ? 'alina' : 'vlad';
      const partner = this.actors[partnerId];
      const partnerYaw = partner.root.visible && !this.sleepingOffline.has(partnerId) &&
        Math.hypot(partner.root.position.x - center.x, partner.root.position.z - center.z) < 2.6
        ? relativeLookYaw(actor.root, partner.root.position) : null;
      let petYaw: number | null = null;
      let petDistance = 2.5;
      for (const pet of Object.values(this.pets)) {
        if (!pet.root.visible) continue;
        const distance = Math.hypot(pet.root.position.x - center.x, pet.root.position.z - center.z);
        if (distance < petDistance) {
          petDistance = distance;
          petYaw = relativeLookYaw(actor.root, pet.root.position);
        }
      }
      actor.setIdleSurroundings(petYaw, partnerYaw);
      if (!actor.isWalking()) resetResidentTraffic(this.collisionFlow[id]);
      actor.update(dt, this.steering[id]);
      // The ceramic plate stays while its food gets smaller with each bite.
      // Inventory is only consumed by the server after the timed task finishes.
      const elapsed = actor.eatingElapsed();
      const plate = this.meals.get(id)!;
      if (plate.visible && elapsed !== null) {
        const scale = mealServingScale(elapsed);
        plate.getObjectByName('Indoor serving')!.scale.setScalar(scale);
        plate.getObjectByName('Grilled serving')!.scale.setScalar(scale);
      }
      if (this.bags[id].visible) this.followBag(this.bags[id], actor);
    }
    if (this.place === 'home') {
      this.cookingClock += dt;
      this.grillClock += dt;
      this.kitchenEffects.root.visible=this.kitchenCooking;
      if(this.kitchenCooking)this.kitchenEffects.update(this.cookingClock);
      this.yard.lid.rotation.x = THREE.MathUtils.damp(this.yard.lid.rotation.x, this.grillCooking ? -1.22 : 0, 9, dt);
      this.yard.contents.visible = this.grillCooking;
      this.yard.embers.visible=this.grillCooking;
      this.yard.smoke.visible=this.grillCooking;
      if(this.grillCooking){
        for(let i=0;i<this.yard.smoke.children.length;i++){
          const puff=this.yard.smoke.children[i] as THREE.Mesh;
          const phase=(this.grillClock*.30+i/this.yard.smoke.children.length)%1;
          puff.position.set(Math.sin(this.grillClock*.9+i)*.12,
            .94+phase*.62,Math.cos(i*2+this.grillClock*.43)*.07);
          puff.scale.setScalar(.09+.16*phase);
          (puff.material as THREE.MeshBasicMaterial).opacity=.17*(1-phase);
        }
        for(let i=0;i<this.yard.embers.children.length;i++){
          const glow=this.yard.embers.children[i] as THREE.Mesh;
          glow.scale.y=.035+.014*Math.sin(this.grillClock*4.2+i);
        }
        const motion=this.activeGrillRecipe==='grillChicken'?.04:
          this.activeGrillRecipe==='grillVegetables'?.06:.027;
        this.yard.contents.rotation.z=Math.sin(this.grillClock*2.3)*motion;
      } else this.yard.contents.rotation.z=0;
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
    if (this.household) {
      for (const id of PET_IDS) {
        const pet = this.household.pets[id];
        const nearby = this.place === 'home' && (['vlad', 'alina'] as const).some(role => {
          const resident = this.actors[role];
          return resident.root.visible && !this.sleepingOffline.has(role) &&
            this.household?.world.places[role] === 'home' &&
            !this.household.activeShifts[role] && this.household.characters[role].pose !== 'sleep' &&
            Math.hypot(resident.root.position.x - this.pets[id].root.position.x,
              resident.root.position.z - this.pets[id].root.position.z) < 2.8;
        });
        this.pets[id].setAmbient({
          satiety: pet.satiety, energy: pet.energy, happiness: pet.happiness,
          bond: pet.bond, bowl: this.household.petBowls[id], personNearby: nearby,
        });
      }
    }
    const cat = this.pets.simba;
    const petTraffic = this.place === 'home' && dog.root.visible && cat.root.visible;
    if (petTraffic) {
      const people = (['vlad', 'alina'] as const).filter(role =>
        this.actors[role].root.visible && !this.sleepingOffline.has(role) &&
        this.household?.characters[role].pose !== 'sleep').map(role => {
        const body = this.actors[role].bodyPosition(this.otherBody);
        return { x: body.x, z: body.z };
      });
      const geometry = this.petGeometry;
      // The dog and cat use the *visible* coordinates of each other, plus
      // the people nearby, rather than waiting for the next server snapshot.
      dog.update(dt, this.dogTravel, pace, {
        ...geometry, blockers: [cat.root.position, ...people], otherPet: cat.root.position,
      });
      cat.update(dt, 0, 0, {
        ...geometry, blockers: [dog.root.position, ...people], otherPet: dog.root.position,
      });
      let dogPosition: Point = { x: dog.root.position.x, z: dog.root.position.z };
      let catPosition: Point = { x: cat.root.position.x, z: cat.root.position.z };
      // Pets separate from one another only. We intentionally do NOT move
      // an idle pet when a human comes near: the human's steering above
      // yields first. That prevents a running player from shoving animals
      // across the yard, away from bowls, or out of an intended routine.
      [dogPosition, catPosition] = separatePetBodies(
        dogPosition, catPosition, geometry.obstacles, geometry.floor);
      dog.root.position.set(dogPosition.x, 0, dogPosition.z);
      cat.root.position.set(catPosition.x, 0, catPosition.z);
    } else {
      if (dog.root.visible) dog.update(dt, this.dogTravel, pace);
      if (cat.root.visible) cat.update(dt);
    }
    if (this.place === 'home') for (const [id, door] of this.extensions.doors) {
      const open = this.openDoors.get('vlad') === id || this.openDoors.get('alina') === id;
      door.rotation.y = THREE.MathUtils.damp(door.rotation.y, open ? -1.53 : 0, 11, dt);
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
    if (this.place === 'home') {
      this.homeEffects.update(this.visualSeconds);
      this.computerScreens.update(this.visualSeconds);
    }
    this.remote?.animate?.(this.visualSeconds,this.camera);
    this.renderer.render(this.scene, this.camera);
    this.onRenderedFrame?.(now, this.renderer.info.render.calls, this.renderer.info.render.triangles);
  };
}
