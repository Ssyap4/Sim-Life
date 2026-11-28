import {HOME_DRINK_COLORS} from '../shared/food';
import {isHomeDrink} from '../shared/food';
import {interiorLighting} from './InteriorAtmosphere';
import {updateWater} from './WaterArt';
import {isLakeMealAction,LAKE_MEAL_ACTIONS,isLakeFishAction,FISH_ACTIONS,isLakeRestAction,isLakeCareAction,isLakeLeisureAction,lakeSwimFrame,LAKE_FIRE_SEAT_OFFSET,lakeCampFor,lakeSleepAnchor} from '../shared/lake';
import {syncLakeTents,syncLakeCutaway} from './LakeArt';
import {WORK_COFFEE_DROP} from '../shared/workCoffee';
import {isVenueGame,venueStation} from '../shared/venue';
import {fitnessExercise,fitnessBarItem} from '../shared/fitness';
import {speakerSurfaces,speakerHeight} from '../shared/speakerPlacement';
import {isSurfaceDevice} from '../shared/consoleCatalog';
import {VACUUM_MODELS,type VacuumSku} from '../shared/vacuumCatalog';
import {vacuumItem,vacuumState} from '../shared/vacuum';
import {DustArt} from './DustArt';
import {dustRoute} from '../shared/dustRoute';
import { residentEmotion } from '../shared/emotions';
import { LandscapeHorizon } from './LandscapeHorizon';
import {weatherAt} from '../shared/weather';
import {applySeason} from './SeasonalPalette';
import { WeatherArt } from './WeatherArt';
import {isNotebookDesk,workstationLayout} from '../shared/furniture';
import { installedElectronics } from '../shared/electronics';
import { gameAudio } from './GameAudio';
import { cafeSeatAt } from '../shared/locations';
import { HomeEffects } from './HomeEffects';
import { buildFamilyCar } from './FamilyCarArt';
import {CarRideScene} from './CarRideScene';
import type {CarRide} from '../shared/carRide';
import { buildHomeWing } from './HomeWing';
import { NeighborPeople } from './NeighborPeople';
import { courierVisit, COURIER_INDEX } from '../shared/courier';
import { NEIGHBORS, neighborPose } from '../shared/neighbors';
import { DISTRICT_OFFSET_Z, districtArrival, districtPoint, districtSite, inDistrictPond, inHomeGrounds } from '../shared/district';
import { HomeComputerScreens } from './HomeComputerScreens';
import type { ComputerScene } from './ComputerScreenArt';
import type { ComputerDevice } from '../shared/computer';
import { GAME_BY_ID } from '../shared/computerGames';
import { tennisPlayer,tennisBall } from '../shared/tableTennis';
import { badmintonPlayer,badmintonShuttle } from '../shared/badminton';
import {DOG_AGILITY,isDogAgility,agilityPath} from '../shared/dogAgility';
import { PICNIC_SECONDS,isCampRecipe,isParkDogAction,type CampRecipe } from '../shared/park';
import { isLeisureAction } from '../shared/leisure';
import {floatBob,poolSwimFrame,poolEntryFrame,POOL_ENTRY_SECONDS,POOL_MOUNT_SECONDS} from '../shared/oasisPool';
import { picnicPortions } from '../shared/picnic';
import { isContact } from '../shared/socialLife';
import { BOOKS, HOME_SEATS, type HomePresentation } from '../shared/homeLife';
import { MATERIAL_BY_ID } from '../shared/educationCatalog';
import { isCareerPlace, type CareerShift } from '../shared/careers';
import { GRILL_RECIPES, ingredientList, isGrillRecipe, type RecipeId, type TakeoutId } from '../shared/food';
import { carryingBag, createHomeDistrict, createLocation, homeExtensions } from './LocationScene';
import { floorFor, approachFor, clockMinutes, HOME_LAPTOP, meeting, placeObstacles, spawn, stationById, type PlaceId, type Station, type CafeItem } from '../shared/locations';
import { GROCERY_DETAILS } from '../shared/storageSpace';
import {feedingStation,feedingOwnerPoint} from '../shared/petFeeders';
import {DOG_BATH_OWNER,DOG_BATH_APPROACH,DOG_BATH_SURFACE} from '../shared/dogBath';
import { BATH_FIXTURES, DINING_TOP, GRILL_WORK, LOUNGE_HOOKAH, HOME_FLOOR, HOME_PLACEMENTS, HOUSE_ENTRY,
  KITCHEN_ACTIONS, KITCHEN_WORK, HOME_YARD, homeSeat, type BathFixture, type HomeLeisure } from '../shared/home';
import * as THREE from 'three';
import {stopUfcHighlight} from './UfcHighlights';
import {spaSwimFrame} from '../shared/spa';
import { graphicsProfile, showGraphicsProblem, clearGraphicsProblem, isBlankGraphicsFrame, chooseGraphicsQuality, worldPixelRatio } from './GraphicsCompatibility';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { steadyPanSpeed, TOUCH_CAMERA_DAMPING } from './CameraPan';
import { adjustHeight, protectCameraFloor, HEIGHT_MAX_POLAR } from './CameraHeight';
import { CanvasGestureGate, type PointerContact } from './CanvasGestureGate';
import { frameTiming } from './FrameTiming';
import { StableModelParts } from './StableModelParts';
import { petStepPace } from './PetMotion';
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
import type { SimbaRig } from './SimbaRig';
import { currentCatPerch } from '../shared/CatPerches';
import {dogBedSites,currentDogBed} from '../shared/dogBed';
import {currentPetEquipment,petScratchPoint} from '../shared/petFurniture';
import { PET_PERSON_CLEARANCE, separatePetBodies } from './PetTraffic';
import { petNavigationGeometry } from './PetNavigation';
import { PETS, PET_IDS, PET_SPEED, PET_BOWL_CAPACITY, petHungerLevel, petApproach, type PetId, type PetAction } from '../shared/pets';
import { findRoute, nearestClearPoint, pointIsClear, sampleWalk, segmentIsClear, type FloorRect, type WalkRoute } from './navigation';
import { ACTIONS, itemNames, points, type ItemId as SharedItemId, type ActionId, type CharacterId, type SocialKind, type GameState, type TimedCommand } from '../shared/protocol';
import { decorateHome } from './HomeStyling';
import {buildHomeSideWalls} from './HomeSideWalls';
import { batchRigidParts, cube, softCube, drum, finish } from './ArtKit';
import { FittingStage } from './FittingStage';
import { inspectionFrame, type ViewBand } from './InspectionFrame';
import { portraitHomeFrame, renderProfile } from './HomeFrame';
import { buildFurniture, buildPersonalFurniture, buildSoftRugs } from './InteriorArt';
import { buildFurnishingModel, createPlacementGhost } from './FurnishingArt';
import {reconcileFurnitureModels,disposeFurnitureModel,preferredFurniture} from './FurnitureModels';
import { FURNITURE_BY_ID, lampLevel, isStaticFurnitureId, type StaticFurnitureId, type FurnitureFinish, type PlacedFurniture, type Rotation } from '../shared/furniture';
import { bedPose, selectSleepBed, type SleepBedId } from '../shared/bedSleep';
import { canFurniturePerform, diningLocation, furnitureUseLocation,laptopWorkplace,laptopApproach } from '../shared/furnitureUse';
import { buildCottageLights } from './CottageLights';
import { polishFurniture } from './FurnitureSurfaceArt';
import { buildYard, grilledFood, selectGrilledFood } from './YardArt';
import {buildHolidayTree,buildHolidayGarlands} from './HolidayArt';
import { clockAt, dayPhase, gameMinutes, GAME_MINUTES_PER_REAL_SECOND } from '../shared/life';
import { RESIDENT_CLEARANCE, unoccupiedDestination } from './residentCollision';
import { residentTraffic, resetResidentTraffic, smoothResidentTrafficStep, type TrafficBody } from './ResidentFlow';

type ItemId = Exclude<SharedItemId, 'delivery'>;
type Point = { x: number; z: number };
type BowlPick = 'bowl:verdell' | 'bowl:simba' | 'dirtyDishes';

// Reuse one helper, not a per-frame closure for each resident on mobile.
function relativeLookYaw(root: THREE.Object3D, target: THREE.Vector3): number {
  const dx = target.x - root.position.x, dz = target.z - root.position.z;
  return THREE.MathUtils.euclideanModulo(Math.atan2(dx, dz) - root.rotation.y + Math.PI,
    Math.PI * 2) - Math.PI;
}

// Coordinates of the visible keys and pan in InteriorArt. These are pose
// targets only: the server and route planner still use the approach tiles.
const deskKeys = [
  new THREE.Vector3(HOME_PLACEMENTS.desk.x + .17, 1.116, HOME_PLACEMENTS.desk.z + .388),
  new THREE.Vector3(HOME_PLACEMENTS.desk.x - .17, 1.116, HOME_PLACEMENTS.desk.z + .388),
  new THREE.Vector3(HOME_PLACEMENTS.desk.x - .47, 1.100, HOME_PLACEMENTS.desk.z + .34),
] as const;
const cookingPan = new THREE.Vector3().copy(KITCHEN_WORK.stove.target);
// Reuse the existing light articulated rig instead of loading extra animations.
const DOMESTIC_MOTIONS: Partial<Record<ActionId, DomesticMotion>> = {
  sofaRead: 'read', sofaMusic: 'music', sofaCall: 'phone', sofaScroll:'scrollPhone',
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
  private sideWalls!:ReturnType<typeof buildHomeSideWalls>;
  private readonly neighbors = new NeighborPeople();
  private district: ReturnType<typeof createHomeDistrict>|null=null;
  private neighborMinute = 0;
  private entryLeaf?: THREE.Group;
  private readonly extensions = homeExtensions();
  private readonly subjectMeshes: THREE.Object3D[] = [];
  private readonly homeViewOccluders: THREE.Object3D[];
  private readonly stationMeshes: THREE.Object3D[] = [];
  private readonly bags = { vlad: carryingBag(), alina: carryingBag() };
  private bathingRole:CharacterId|undefined;
  private bathWashing=false;
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
  private roadScene?:CarRideScene;
  private carRide?:CarRide;
  setCarRide(ride?:CarRide):void{this.carRide=ride;}
  private nearbyChat:{from:CharacterId;until:number;started:number}|null=null;
  nearbyConversation(from:CharacterId,remainingMs:number):void{
    this.nearbyChat=remainingMs>0?{from,started:this.visualSeconds,until:this.visualSeconds+remainingMs/1000}:null;
  }
  private readonly sleepingOffline = new Set<CharacterId>();
  private familyCar!: THREE.Group;
  private readonly rememberedBeds=new Map<CharacterId,SleepBedId>();
  private readonly homeLeisure = new Set<CharacterId>();
  private readonly petRoutines = new Map<PetId, string>();
  private localRole: CharacterId = 'vlad';
  private cart: THREE.Group | null = null;
  private cartSize = 0;
  private dogTravel = 0;
  private parkDogUntil=0;
  private agilityOwner?:CharacterId;
  private agilityAction?:import('../shared/dogAgility').DogAgilityAction;
  private agilityWaiting?:{entry:Point;releaseAt:number};
  private agilityCueOwner?:CharacterId;
  private agilityQAExit?:import('../shared/dogAgility').DogAgilityAction;
  releaseAgility(role:CharacterId){this.agilityCueOwner=role;}
  private lakeDogMode="";
  private parkDogToiletStamp=0;
  private dogTrail: Point[] = [];
  private lastDogPoint: Point | null = null;
  place: PlaceId = 'home';
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly actors: Record<CharacterId, Actor>;
  readonly pets: Record<PetId, PetActor>;
  private readonly raycaster = new THREE.Raycaster();
  private coffeeModels?:THREE.Group;
  private workCoffeeCup?:THREE.Group;
  private kitchenCurtains?:THREE.Group;
  private readonly interactiveMeshes: THREE.Object3D[] = [];
  private readonly itemPoints = new Map<string, THREE.Vector3>();
  private readonly obstacles = placeObstacles('home');
  private petGeometry = petNavigationGeometry(this.obstacles, HOME_FLOOR);
  private furnishedGeometryKey = '';
  private furnishingModels=new Map<number,THREE.Group>();
  private readonly stableParts=new StableModelParts();
  private readonly framePartPosition=new THREE.Vector3();
  private readonly frameShuttleDirection=new THREE.Vector3();
  private readonly frameDown=new THREE.Vector3(0,-1,0);
  private staticFixtureModels=new Map<StaticFurnitureId,THREE.Group>();
  private furnishingVisualKey='';
  private furnishingGhost:THREE.Group|null=null;
  private speakerGhost=false;
  private speakerSurfaceGuides:THREE.Group|null=null;
  private furnishingPlaceCallback:((x:number,z:number)=>{x:number;z:number;y?:number}|null)|null=null;
  private furnishingFootprint:THREE.Mesh|null=null;
  private furnishingOutline:THREE.LineSegments|null=null;
  private furnishingGhostMaterials:THREE.MeshStandardMaterial[]=[];
  private lastFurnitureHover=0;
  private furnishingItemCallback:((id:number)=>void)|null=null;
  private furnishingParcels=new THREE.Group();
  private lastFrame = performance.now();
  private paused = false;
  private visualSeconds = 0;
  private yardSnow=0;
  private vacuumStamp=0;
  private quality: 'standard'|'high'|'low' = 'standard';
  private readonly graphics = graphicsProfile(navigator.userAgent, window.location.search);
  private readonly horizon = new LandscapeHorizon();
  private readonly weather = new WeatherArt(window.location.search,
    window.matchMedia('(prefers-reduced-motion: reduce)').matches, this.graphics.safe);
  private graphicsLost = false;
  private graphicsChecked = false;
  private graphicsStartedAt = performance.now();
  private smoothedFrameMs = 16.7;
  private lastQualityUpdate = performance.now();
  private readonly ownedLampGlow=new THREE.PointLight(0xffc98d,0,5.2,2);
  private lampNight=0;
  private lampStamp=-1;
  private readonly roomGlow = new THREE.PointLight(0xffd5a5, 0, 14, 2);
  private cottageLamps?:ReturnType<typeof buildCottageLights>;
  private socialSequence = 0;
  private badmintonStarted:number|null=null;
  private tennisStarted:number|null=null;
  private readonly pairStages = new Map<CharacterId,{ arrived:boolean; active:boolean; playing:boolean; action:string }>();
  private readonly dustArt = new DustArt(this.homeScene);
  private readonly homeEffects = new HomeEffects(this.homeScene);
  private readonly kitchenEffects = buildCookingStation(this.homeScene);
  private kitchenCooking = false;
  private cookingClock = 0;
  private grillClock = 0;
  private activeGrillRecipe: RecipeId | undefined;
  private computerScreens!:HomeComputerScreens;
  private readonly homeTasks = new Map<CharacterId, HomePresentation>();
  private readonly mediaFoodArrived = new Set<CharacterId>();
  private readonly mediaFoodStarted = new Map<CharacterId,number>();
  private readonly hobbyWorks=new Map<CharacterId,{id:number;action:string;start:number}>();
  private readonly poolMotions=new Map<CharacterId,{mode:'poolFloat'|'poolSwim';started:number;wet:boolean}>();
  private readonly dishTasks = new Set<CharacterId>();
  private readonly dirtyVisuals: Record<DishStation, THREE.Mesh[]> = { table: [], yardTable: [] };
  private readonly taskSequence = { vlad: 0, alina: 0 };
  private inspected: CharacterId | PetId | null = null;
  private careReframe:CharacterId|null=null;
  private readonly careElapsed=new Map<CharacterId,number>();
  private yard!: ReturnType<typeof buildYard>;
  private readonly festiveTree=buildHolidayTree();
  private readonly festiveGarlands=buildHolidayGarlands();
  private festiveKey='';
  private grillCooking = false;
  private readonly otherBody = new THREE.Vector3();
  private readonly feederVisual:Partial<Record<PetId,{reserve:number;servings:number;id?:number;started?:number}>>={};
  private readonly starterBowls:Partial<Record<PetId,THREE.Group>>={};
  private readonly bowlHits:Partial<Record<PetId,THREE.Mesh>>={};
  private readonly bowlFood: Record<PetId, THREE.Mesh[]> = { verdell: [], simba: [] };
  private readonly collisionFlow = { vlad: residentTraffic(), alina: residentTraffic() };
  private movementDt = 1 / 60;
  private readonly steering = {
    vlad: (from: Point, target: Point) => this.steerPast('vlad','alina', from, target),
    alina: (from: Point, target: Point) => this.steerPast('alina','vlad', from, target),
  };
  private followSubject: THREE.Object3D | null = null;
  private followingPlayer = false;
  private followingPair = false;
  private manualCameraHeight = false;
  private readonly cameraQA = new URLSearchParams(location.search).get('cameraQA')==='1';
  private readonly perfQA = new URLSearchParams(location.search).get('perfQA')==='1';
  private lastPerfReport=0;
  private lastSceneSwitchMs=0;
  private sceneSwitches=0;
  private readonly manualPairAnchor = new THREE.Vector3();
  private readonly pairCameraTarget = new THREE.Vector3();
  private readonly pairCameraEye = new THREE.Vector3();
  private readonly pairCameraDirection = new THREE.Vector3(.46,.76,1).normalize();
  private readonly followPoint = new THREE.Vector3();
  private readonly followDelta = new THREE.Vector3();
  private cameraMove: Frame | null = null;
  private neighborhoodView=false;
  private districtWide=false;
  private districtFocus: Point | null=null;
  private neighborBodies:TrafficBody[]=[];
  private readonly savedCameras=new Map<PlaceId,Frame & {manualHeight:boolean}>();
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
    private readonly onRenderedFrame?: (nowMs: number, drawCalls: number, triangles: number, scope: string) => void,
    private readonly navigation?: { station(id: string): void; ground(x: number, z: number): void;
      dismissTap?: () => boolean; pondTap?: () => void; toyTap?: (x:number,z:number)=>boolean; toyDragActive?:()=>boolean }, simbaRig?: SimbaRig) {
    this.scene.background = new THREE.Color(0xc0c7ad);
    this.scene.fog = new THREE.Fog(0xc0c7ad, 125, 171);

    this.tapLayer.className='world-tap-feedback';
    this.tapLayer.setAttribute('aria-hidden','true');
    this.canvas.parentElement?.append(this.tapLayer);
    // Android WebViews are especially vulnerable to framebuffer/context loss.
    // Disable costly MSAA and cap resolution there; retain the iPhone path.
    this.quality = this.graphics.safe ? 'low' : this.graphics.full ? 'high' : 'standard';
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas,
        antialias: this.graphics.antialias,
        powerPreference: this.graphics.powerPreference,
        stencil: false,
      });
    } catch (error) {
      showGraphicsProblem(canvas, 'Браузер не смог создать WebGL-контекст.');
      throw error;
    }
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); // permit the browser to restore the context
      this.graphicsLost = true;
      showGraphicsProblem(canvas, 'Графический контекст был потерян.');
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.graphicsLost = false;
      this.graphicsChecked = false;
      this.graphicsStartedAt = performance.now();
      clearGraphicsProblem(canvas);
      this.refreshViewport();
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = false; // no shadow-map render passes

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 180);
    this.camera.position.copy(homePosition);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 1.0, 1.8);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = TOUCH_CAMERA_DAMPING;
    this.controls.touches.ONE = THREE.TOUCH.PAN;
    // Pinch zoom + two-finger pan. Rotation comes only from the explicit
    // twist handler below, so a slightly uneven pinch cannot rotate twice.
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    this.controls.enablePan = true;
    // 0.18: allow pinch/pan to inspect neighbors and their wider gardens.
    this.controls.maxTargetRadius = 23;
    this.controls.minDistance = 10;
    this.controls.maxDistance = this.place === 'district' ? (this.districtWide ? 132 : 96) : this.place==='home'?120:(this.place==='fitness'||this.place==='venue'||this.place==='lake')?88:51;
    this.controls.minPolarAngle = 0.24;
    this.controls.maxPolarAngle = 1.25;
    this.updatePanFeel();
    this.controls.update();

    this.createLights();
    this.createHome();
    this.homeViewOccluders = this.scene.children.filter(object => !(object instanceof THREE.Light));
    // District geometry is created only on the first actual trip outside.
    // No district meshes or animated neighborhood rigs belong to homeScene.
    this.homeScene.add(this.neighbors.group);
    this.weather.enter(this.scene,this.place);
    this.horizon.enter(this.scene,this.place);
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
    this.pets = { verdell: new PetActor('verdell'), simba: new PetActor('simba',simbaRig) };
    this.homeScene.add(this.pets.verdell.homeToys,this.pets.simba.homeToys);
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
      const tray=new THREE.Group();tray.name='Breakfast tray';tray.visible=false;const wood=new THREE.MeshStandardMaterial({color:0xb68b5b,roughness:.72}),edge=new THREE.MeshStandardMaterial({color:0x725336,roughness:.72});
      const part=(x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);tray.add(mesh);};
      part(0,-.035,0,.62,.045,.44,wood);for(const x of [-.30,.30]){part(x,-.002,0,.025,.035,.44,edge);for(const z of [-.15,.15])part(x,-.115,z,.035,.14,.035,edge);}for(const z of [-.21,.21])part(0,-.002,z,.60,.035,.025,edge);
      plate.add(dish, food, grilled,tray);
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

  /** Consistent ground travel per drag pixel regardless of zoom or scene edge. */
  private updatePanFeel():void {
    this.controls.panSpeed=steadyPanSpeed(this.camera.position.distanceTo(this.controls.target));
  }

  private bindCanvasInput(): void {
    const gate = new CanvasGestureGate();
    const contact = (event: PointerEvent): PointerContact => ({
      id: event.pointerId, x: event.clientX, y: event.clientY,
      type: event.pointerType === 'touch' ? 'touch' :
        event.pointerType === 'pen' ? 'pen' : 'mouse',
      primary: event.isPrimary, button: event.button, time: event.timeStamp,
    });

    let toyPointer:number|null=null;
    const toyPoint=(e:PointerEvent)=>{const b=this.canvas.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,-((e.clientY-b.top)/b.height)*2+1),this.camera);const p=this.raycaster.ray.intersectPlane(new THREE.Plane(THREE.Object3D.DEFAULT_UP,0),this.vector);if(p)this.navigation?.toyTap?.(p.x,p.z);};
    const releaseToy=(id:number)=>{if(toyPointer!==id)return false;toyPointer=null;if(this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);return true;};
    this.canvas.addEventListener('pointerdown', event => {
      if(this.place==='home'&&!this.furnishingGhost&&this.navigation?.toyDragActive?.()&&event.isPrimary&&event.button===0){toyPointer=event.pointerId;this.canvas.setPointerCapture(event.pointerId);toyPoint(event);event.stopImmediatePropagation();event.preventDefault();return;}
      const touch = event.pointerType === 'touch';
      gate.down(contact(event));
      if (event.isPrimary) {
        this.controls.enablePan = touch || this.place==='home' || this.place==='district' || this.place==='park'||this.place==='lake';
        this.controls.dampingFactor = TOUCH_CAMERA_DAMPING;
        this.updatePanFeel();
      }
    }, { capture: true });

    // IMPORTANT: capture before OrbitControls' document-level move handler.
    // stopPropagation on a bubble listener was too late: small finger tremors
    // already panned the camera while the touch still counted as a tap.
    this.canvas.addEventListener('pointermove', event => {
      if(toyPointer===event.pointerId){if(this.navigation?.toyDragActive?.())toyPoint(event);event.stopImmediatePropagation();event.preventDefault();return;}
      const motion = gate.move(contact(event));
      if (motion.holdTap) {
        event.stopPropagation();
        return;
      }
      if ((this.followingPlayer || this.followingPair) && (event.buttons || event.pointerType === 'touch')) this.setFollowPlayer(false);
      if (motion.twistRadians)
        this.controls.rotateLeft(-motion.twistRadians);
      if (event.pointerType === 'mouse' && this.furnishingGhost &&
          performance.now() - this.lastFurnitureHover > 125) {
        this.lastFurnitureHover = performance.now();
        this.previewFurnitureAt(event.clientX, event.clientY);
      }
    }, { capture: true });

    this.canvas.addEventListener('pointerup', event => {
      if(toyPointer===event.pointerId){if(this.navigation?.toyDragActive?.())toyPoint(event);releaseToy(event.pointerId);event.stopImmediatePropagation();event.preventDefault();return;}
      const picked = gate.up(contact(event));
      if (picked) {
        // Let OrbitControls finish releasing capture before opening an item
        // menu or sending a walking command. No visible tap delay.
        const { clientX, clientY } = event;
        const touch=event.pointerType==='touch';
        queueMicrotask(() => this.pick(clientX, clientY, touch));
      }
    }, { capture: true });

    const cancel = (event: PointerEvent) => {releaseToy(event.pointerId);gate.cancel(event.pointerId);};
    this.canvas.addEventListener('pointercancel', cancel, { capture: true });
    this.canvas.addEventListener('wheel', () => {
      if (this.followingPlayer || this.followingPair) this.setFollowPlayer(false);
    }, { passive: true });
    this.canvas.addEventListener('lostpointercapture', cancel);
    window.addEventListener('blur', () => gate.reset());
    document.addEventListener('visibilitychange', () => {
      gate.reset();
      this.lastFrame = performance.now();
      this.lastQualityUpdate = this.lastFrame;
    });
  }

  adjustCameraHeight(direction: 1|-1, seconds: number): void {
    if(this.fittingStage)return;
    if(!this.manualCameraHeight && this.followingPair)this.manualPairAnchor.copy(this.pairCameraTarget);
    this.manualCameraHeight=true;
    this.cameraMove=null;
    this.neighborhoodView=false;
    this.controls.maxPolarAngle=HEIGHT_MAX_POLAR;
    adjustHeight(this.camera.position,this.controls.target,direction,seconds,this.controls.minPolarAngle);
    this.controls.update();
    protectCameraFloor(this.camera.position,this.controls.target);
  }

  setFollowPlayer(enabled: boolean): void {
    if(enabled)this.manualCameraHeight=false;
    this.followingPair = false;
    this.followingPlayer = enabled;
    const button = document.querySelector<HTMLButtonElement>('#camera-follow');
    button?.setAttribute('aria-pressed', String(enabled));
    if (!enabled) {
      this.followSubject = null;
      this.cameraMove = null;
      return;
    }
    this.inspected = null;
    this.followSubject = this.actors[this.localRole].root;
    this.followSubject.getWorldPosition(this.followPoint);
    this.cameraMove = this.residentDistrictFrame(this.followPoint, this.compactPortrait.matches);
  }

  toggleFollowPlayer(): void { this.setFollowPlayer(!this.followingPlayer); }

  /** Explicit, one-tap close-up for shared actions. Never steals the free camera automatically. */
  focusSharedActivity(): boolean {
    if(this.place==='venue'){
      const p=this.homeTasks.get(this.localRole)?.pair;
      if(!p||!isVenueGame(p.item))return false;
      const station=stationById('venue',venueStation(p.item))!;
      return this.focusVenueStation(station);
    }
    if(this.place!=='home'||!this.actors.vlad.root.visible||!this.actors.alina.root.visible)return false;
    if(this.followingPlayer)this.setFollowPlayer(false);
    this.inspected=null;
    this.followSubject=null;
    this.neighborhoodView=false;
    this.updateViewLens();
    const v=this.actors.vlad.root.position,a=this.actors.alina.root.position;
    const gap=Math.hypot(v.x-a.x,v.z-a.z);
    const target=new THREE.Vector3((v.x+a.x)/2,1.06,(v.z+a.z)/2);
    // A portrait display needs extra framing width to keep both residents visible.
    const distance=THREE.MathUtils.clamp(8.3+gap*1.3,9.1,17.5);
    this.controls.minDistance=3.4;
    this.controls.maxDistance=96;
    this.controls.maxPolarAngle=1.4;
    this.manualCameraHeight=false;
    this.pairCameraTarget.copy(target);
    this.followingPair=true;
    this.cameraMove={target,position:target.clone().addScaledVector(this.pairCameraDirection,distance)};
    return true;
  }

  focusSoloLounge():boolean{if(this.place!=='home'||this.homeTasks.get(this.localRole)?.station!=='yardTable')return false;this.showcase(this.localRole);return true;}
  focusSpaActivity(id:string):boolean{const station=stationById('spa',id);return this.place==='spa'&&!!station&&this.focusVenueStation(station);}
  focusVenueStation(station:Station):boolean{
    this.manualCameraHeight=false;
    if(this.place!=='venue'&&this.place!=='spa')return false;
    this.setFollowPlayer(false);this.inspected=null;this.neighborhoodView=false;
    const target=new THREE.Vector3(station.center.x,.85,station.center.z);
    const ufc=station.id==='venue-ufc',bowling=station.id==='venue-bowling';
    const direction=new THREE.Vector3(ufc?.16:bowling?.18:.75,ufc?.62:bowling?1.22:1.04,1).normalize();
    if(bowling)target.z+=1.0;
    const distance=ufc?12.4:bowling?18.0:station.id.startsWith('spa-massage')?12.6:station.id==='spa-pool'?18.2:station.id==='spa-jacuzzi'?10.5:9.6;
    this.controls.minDistance=3.4;this.controls.maxDistance=88;this.controls.maxPolarAngle=1.4;
    this.cameraMove={target,position:target.clone().addScaledVector(direction,distance)};
    return true;
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

  private fittingStage:FittingStage|null=null;
  fittingCamera(role:CharacterId|null,angle=0,look?:string):void{
    if(role===null){this.fittingStage?.dispose();this.fittingStage=null;return;}
    if(!this.fittingStage)this.fittingStage=new FittingStage(this.actors[role].root.children[0],role);
    if(look)this.fittingStage.wear(look);
    this.fittingStage.rotate(angle);
  }
  showcase(subject: CharacterId | PetId | null): void {
    this.manualCameraHeight=false;
    this.followingPair=false;
    if (this.followingPlayer) this.setFollowPlayer(false);
    this.neighborhoodView=false;
    this.inspected = subject;
    this.updateViewLens();
    this.controls.minDistance = subject ? 1.10 : 10;
    // Keep the full transition in range before applying the inspection limit.
    this.controls.maxDistance = this.place === 'district' ? (this.districtWide ? 132 : 96) : this.place==='home'?120:(this.place==='fitness'||this.place==='venue'||this.place==='lake')?88:51;
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
    // When Simba perches on a real sofa/bed, the old inspection angle can
    // sit behind the tall backrest: only the tip of his tail is visible.
    // Favor a view from the validated FLOOR approach (the open seat/front).
    // The automatic camera is still optional; normal touch gestures work.
    const candidate = subject==='simba' && this.place==='home'
      ? this.household?.pets.simba.routine?.perch : undefined;
    const perch = candidate && this.household &&
      currentCatPerch(this.household.furnishing,candidate) ? candidate : null;
    const resting=person&&this.actors[subject].isSleeping();
    // A low standing-portrait camera hides the sleeping body behind the bed.
    // Inspect from above and from the foot, respecting a rotated mattress.
    const pairMotion=person?this.homeTasks.get(subject)?.pair?.motion:undefined;
    const romanticSeat=pairMotion&&['sofaLean','sofaHands','sofaKiss','sofaHug','cuddle','musicTogether'].includes(pairMotion);
    const standingPair=pairMotion&&['hug','closeHug','kiss','cheek','hands','slowDance'].includes(pairMotion);
    const partner=person?this.actors[subject==='vlad'?'alina':'vlad']:null;
    const pairClose=!!partner&&(romanticSeat||standingPair)&&
      partner.root.position.distanceTo(subjectRoot.position)<2.1;
    if(pairClose&&partner)bounds.union(new THREE.Box3().setFromObject(partner.root.children[0],true));
    const coupleAngle=pairClose&&standingPair?new THREE.Vector3(.98,.30,.15)
      .applyAxisAngle(THREE.Object3D.DEFAULT_UP,subjectRoot.rotation.y):null;
    // During care, include the nearby animal instead of cropping the coat
    // out of the resident portrait. This remains an optional inspection.
    const care=person&&['pet','brush','play','treat'].includes(this.actors[subject].audioMotion().activity??'');
    let careAngle:THREE.Vector3|null=null;
    if(care){
      let nearest:PetActor|null=null,distance=1.6;
      for(const id of PET_IDS){const pet=this.pets[id],d=pet.root.position.distanceTo(subjectRoot.position);if(d<distance){nearest=pet;distance=d;}}
      if(nearest){
        bounds.union(new THREE.Box3().setFromObject(nearest.root.children[0],true));
        careAngle=new THREE.Vector3(.98,.70,.28).applyAxisAngle(THREE.Object3D.DEFAULT_UP,subjectRoot.rotation.y);
      }
    }
    const bedAngle=resting||pairMotion==='bedRest'?new THREE.Vector3(.72,1.15,1).applyAxisAngle(new THREE.Vector3(0,1,0),subjectRoot.rotation.y):
      romanticSeat?new THREE.Vector3(.18,.55,1).applyAxisAngle(new THREE.Vector3(0,1,0),subjectRoot.rotation.y):null;
    const station=person?this.homeTasks.get(subject)?.station:undefined;
    const careView=person&&this.homeTasks.get(subject)?.vanityCare;
    const bathView=person&&station==='bathtub';
    // Aim above the tub rim and desk top. A low portrait can look straight
    // through the mirror, bed or bathtub shell after the seat transfer.
    if(bathView||careView)bounds.min.y=Math.min(bounds.max.y-.15,Math.max(bounds.min.y,bathView?.63:.60));
    const vanityAngle=bathView?new THREE.Vector3(-.95,1.12,-.38):careView?new THREE.Vector3(-.12,.85,1):null;
    const loungeAngle=person&&this.homeTasks.get(subject)?.station==='yardTable'?new THREE.Vector3(.65,.48,1).applyAxisAngle(THREE.Object3D.DEFAULT_UP,subjectRoot.rotation.y):null;
    const catalogSeat=person&&this.homeTasks.get(subject)?.station==='furniture'&&this.homeTasks.get(subject)?.furnitureSeat;
    const catalogAngle=catalogSeat?new THREE.Vector3(.38,.48,1).applyAxisAngle(THREE.Object3D.DEFAULT_UP,subjectRoot.rotation.y):null;
    const handheld=person&&['read','phone','scrollPhone'].includes(this.actors[subject].audioMotion().activity??'');
    const handheldAngle=handheld?new THREE.Vector3(.40,.48,1).applyAxisAngle(THREE.Object3D.DEFAULT_UP,subjectRoot.rotation.y):null;
    const angle = loungeAngle??vanityAngle??bedAngle??coupleAngle??careAngle??handheldAngle??catalogAngle??(perch
      ? new THREE.Vector3(
          perch.approach.x-perch.surface.x,.65,
          perch.approach.z-perch.surface.z)
      : subject === 'simba' ? new THREE.Vector3(-0.46, 0.29, 1)
        : new THREE.Vector3(person?0.29:0.93, person ? 0.11 : 0.32, person?1:.60));
    const band = this.viewBand(true);
    const frame = (direction: THREE.Vector3) => inspectionFrame(bounds,direction,this.camera.fov,this.camera.aspect,band);
    this.cameraMove = frame(angle);
    if (this.place === 'home' && !perch && !this.canSeeCharacter(bounds,this.cameraMove)) {
      // Both humans AND small pets need a clear line of sight. In particular,
      // a low Spitz behind the dining table otherwise shows just two ears.
      // Try alternate azimuths before a mildly raised view of the same model.
      const directions = bathView ? [[-1,1.4,-.16],[-.65,1.4,-.8],[.35,1.5,-1],[-1,1.8,.15]] : careView ? [[.32,1.05,1],[.25,1.2,-1],[-.15,1.3,-1],[.9,1.5,.4]] : person
        ? [[-.66,.20,1],[.98,.30,.50],[-1,.38,.31],[.50,.55,-1]]
        : [[-.92,.43,.24],[.90,.55,.35],[-.8,.65,-.7],[.7,.85,-.6],
          [-.68,1.15,.3],[.45,1.30,1]];
      for (const direction of directions) {
        const alternative=frame(new THREE.Vector3(...direction));
        if (!this.canSeeCharacter(bounds,alternative)) continue;
        this.cameraMove=alternative;
        break;
      }
    }
  }

  private canSeeCharacter(bounds: THREE.Box3, frame: Frame): boolean {
    const point = bounds.getCenter(new THREE.Vector3());
    const eye = point.clone();
    eye.y = THREE.MathUtils.lerp(bounds.min.y,bounds.max.y,.82);
    const side = new THREE.Vector3().subVectors(frame.position,frame.target)
      .cross(THREE.Object3D.DEFAULT_UP).normalize().multiplyScalar(.16);
    const direction = new THREE.Vector3();
    for (const target of [eye, point.clone().add(side), point.sub(side)]) {
      const distance = direction.subVectors(target,frame.position).length();
      this.raycaster.set(frame.position,direction.normalize());
      this.raycaster.far = distance;
      const blocked = this.raycaster.intersectObjects(this.homeViewOccluders,true)
        .some(hit => {
          for (let object: THREE.Object3D | null = hit.object; object; object = object.parent)
            if (!object.visible) return false;
          return true;
        });
      this.raycaster.far = Infinity;
      if (blocked) return false;
    }
    return true;
  }

  private neighborCameraFrame():Frame {
    // Observe the active garden resident rather than showing tiny NPCs
    // behind the HUD. The camera affects only this player's viewport.
    const visiting=NEIGHBORS.map((_,i)=>neighborPose(i,this.neighborMinute))
      .find(p=>p.visible&&p.opacity>.30);
    const point=districtPoint(visiting??{x:-7.1,z:-20.3});
    const target=new THREE.Vector3(point.x,.65,point.z);
    const direction=new THREE.Vector3(.18,1.20,1.43).normalize();
    return {target,position:target.clone().addScaledVector(direction,21.5)};
  }
  focusNeighborhood():void {
    if(this.place!=='district')return;
    this.showcase(null);
    this.neighborhoodView=true;
    this.cameraMove=this.neighborCameraFrame();
  }
  focusDistrict(place:PlaceId):void {
    const site=districtSite(place);
    if(this.place!=='district'||place!=='home'&&!site)return;
    this.districtWide=false;
    this.districtFocus=districtArrival(place,this.localRole);
    this.showcase(null);
    if(site) {
      const target=new THREE.Vector3(site.x,2.05,site.z+DISTRICT_OFFSET_Z);
      const direction=new THREE.Vector3(1,.45,.02).normalize();
      this.cameraMove={target,position:target.clone().addScaledVector(direction,15)};
    }
  }
  overviewDistrict():void {
    if(this.place!=='district')return;
    this.districtWide=true;
    this.showcase(null);
  }

  private frameDistrictResident():void {
    this.districtWide=false;
    this.districtFocus=null;
    this.updateViewLens();
  }

  /** One deliberate, predictable camera reset at any location. */
  resetCamera():void {
    this.manualCameraHeight=false;
    this.followingPair=false;
    if (this.followingPlayer) this.setFollowPlayer(false);
    this.savedCameras.delete(this.place);
    if(this.place==='home'||this.place==='district')this.frameDistrictResident();
    this.inspected=null;
    this.neighborhoodView=false;
    this.followSubject=null;
    this.controls.minDistance=10;
    this.controls.maxDistance=this.place==='district'?96:this.place==='home'?120:(this.place==='fitness'||this.place==='venue'||this.place==='lake')?88:51;
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
      const seat = [...(this.place==='district'?this.district?.entries.keys()??[]:this.remote?.stations.keys()??[])].map(key => stationById(this.place, key)!)
        .find(s => {
          const point = approachFor(s, id);
          return (s.action.kind === 'rest' || s.action.kind === 'dine' || s.action.kind === 'swing' || s.action.kind === 'picnic') && Math.hypot(x - point.x, z - point.z) < .22;
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
        this.actors[id].snapFurnitureOffset();
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

  private placedDeskKeys(id:number|undefined):readonly [THREE.Vector3,THREE.Vector3,THREE.Vector3?]|undefined{
    if(id===undefined)return undefined;const model=this.furnishingModels.get(id);if(!model)return undefined;
    const layout=workstationLayout(String(model.userData.sku));
    if(!layout)return [model.localToWorld(new THREE.Vector3(.14,.80,.29)),model.localToWorld(new THREE.Vector3(-.14,.80,.29))];
    const input=(x:number,y:number,z:number)=>model.localToWorld(new THREE.Vector3(x*layout.scale,layout.top+y*layout.scale,layout.z+z*layout.scale));
    return [input(.17,.063,.388),input(-.17,.063,.388),input(-.47,.047,.34)];
  }
  private laptopPose(role: CharacterId): void {
    const site = stationById('home', HOME_LAPTOP)!;
    const actor = this.actors[role];
    const replacement=this.household&&laptopWorkplace(this.household,role);
    if(replacement){const p=replacement.pose;const model=this.furnishingModels.get(replacement.item.id);const keys=model&&[new THREE.Vector3(.16,.81,-.175),new THREE.Vector3(-.16,.81,-.175)].map(v=>model.localToWorld(v)) as [THREE.Vector3,THREE.Vector3]|undefined;actor.setFurniturePose('work',new THREE.Vector3(p.x,p.y,p.z),p.yaw,keys);actor.playDomesticActivity('games');return;}
    const { x, z } = site.center;
    const keys = [new THREE.Vector3(x+.16,.90,z-.025),new THREE.Vector3(x-.16,.90,z-.025)] as const;
    actor.setFurniturePose('work',new THREE.Vector3(x,role==='alina'?-.23:-.28,z+.64),Math.PI,keys);
    actor.playDomesticActivity('games');
  }

  private applyFurniturePose(id: CharacterId, itemId: string, pose: 'idle' | 'sit' | 'sleep' | 'work'): void {
    const actor = this.actors[id];
    const vlad = id === 'vlad';
    if(itemId==='yardTable'&&pose==='sit'){
      const seat=homeSeat('yardTable',id);actor.setFurniturePose('sit',new THREE.Vector3().copy(seat.position),seat.yaw);return;
    }
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
    if(this.place!=='home'||!this.household||this.household.world.places[id]!=='home')return;
    if(!sleeping&&this.sleepingOffline.has(id))return;
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
      if(command.type==='vanity_care'){const color=command.care==='bathLavender'?0xd7c8f1:command.care==='bathRose'?0xf5c9d9:command.care==='bathMilk'?0xfff0d7:0xeaf8ee;if(command.care.startsWith('bathHair'))this.homeEffects.water('bathtub',true,0xf5f4ec);else this.homeEffects.beginBathCare(color,command.care==='bathLavender'?0xc2a5ed:command.care==='bathRose'?0xe8a3c2:0xf0dfc3);actor.playBathCare(command.care);}
      else if (action === 'bathFoam') this.homeEffects.water('bathtub',true);
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

  finishSofaFood(role:CharacterId):void {
    const home=this.homeTasks.get(role);
    if(!home?.food)return;
    delete home.food;delete home.foodMs;
    this.mediaFoodStarted.delete(role);
    this.meals.get(role)!.visible=false;
    if(this.mediaFoodArrived.has(role))this.actors[role].watch(home.program==='comedy'?1:home.program==='horror'?-1:0);
  }
  private playSofaFood(role:CharacterId,home:HomePresentation):boolean {
    const started=this.mediaFoodStarted.get(role);
    if(!home.food||started===undefined||!this.mediaFoodArrived.has(role)||this.visualSeconds-started>=(home.foodMs??0)/1000)return false;
    if(this.actors[role].eatingElapsed()!==null)return true;
    const actor=this.actors[role];
    const pose=home.furniturePose??homeSeat('sofa',role).position;
    const yaw=home.furniturePose?.yaw??homeSeat('sofa',role).yaw;
    const offset=new THREE.Vector3(0,0,.40).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
    const plate=this.showMeal(role,pose.x+offset.x,pose.y+.83,pose.z+offset.z,home.food);
    const serving=this.meals.get(role)!;serving.rotation.y=yaw;
    serving.getObjectByName('Breakfast tray')!.visible=!isHomeDrink(home.food);
    actor.playActivity('eat',plate,home.food,true);
    return true;
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
      if(home.food)actor.hideFoodContainer();
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
          new THREE.Vector3(target.x,target.y,target.z),target.yaw,this.placedDeskKeys(home.furnitureId));
        else this.applyFurniturePose(role,'desk','work');
        actor.playDomesticActivity('games');
        return;
      }
      if(station==='workCoffee'){
        const target=new THREE.Vector3().copy(WORK_COFFEE_DROP);
        actor.faceTowards(target);actor.playDomesticActivity('reach',target);
        if(command.type==='serve_work_drink')actor.carryHomeDrink(command.recipe,target);else actor.carryWorkCoffee(target);return;
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
        if(command.type==='vanity_care'&&station!=='bathtub')actor.playVanity(command.care);
        if(command.type==='vanity_care'){const started=this.careElapsed.get(role);if(started!==undefined)actor.syncCareElapsed(started);if(station==='bathtub'&&this.inspected===role)this.careReframe=role;}
        return;
      }
      if(station==='furniture'){
        const pose=home.furniturePose;
        if(!pose)return;
        if(command.type==='furniture_use'&&(command.action==='poolFloat'||command.action==='poolSwim')){
          this.startPoolMotion(role,command.action,home);return;
        }
        if(home.furnitureSeat){
          actor.setFurniturePose('sit',new THREE.Vector3(pose.x,pose.y,pose.z),pose.yaw);
        }else if(command.type==='furniture_use'&&
          ['deskJournal','deskGames','vladOrder','vladStudy','alinaStudy','alinaConsult'].includes(command.action)){
          actor.setFurniturePose('work',new THREE.Vector3(pose.x,pose.y,pose.z),pose.yaw,this.placedDeskKeys(home.furnitureId));
        }else actor.faceTowards(new THREE.Vector3(pose.x,0,pose.z));
        if(command.type==='eat'&&command.drinkSeat){actor.playActivity('eat',undefined,command.recipe);return;}
        if(command.type==='vanity_care'){actor.playVanity(command.care);const started=this.careElapsed.get(role);if(started!==undefined)actor.syncCareElapsed(started);if(this.inspected===role)this.careReframe=role;return;}
        if(command.type==='read_book'||study?.channel==='book')actor.playDomesticActivity('read');
        if(command.type==='furniture_use'){
          if(command.action==='read_book'){actor.carryBook(BOOKS[command.book!][4]);actor.playDomesticActivity('read');}
          else if(['deskJournal','tablePlan'].includes(command.action))actor.playDomesticActivity('journal');
          else if(['deskGames','vladOrder','vladStudy','alinaStudy','alinaConsult'].includes(command.action))
            actor.playDomesticActivity('games');
          else if(isLeisureAction(command.action)){
            if(['buildCottage','buildCar'].includes(command.action)){
              const model=this.furnishingModels.get(command.furnitureId);
              if(model){this.hobbyWorks.set(role,{id:command.furnitureId,action:command.action,start:this.visualSeconds});actor.faceTowards(model.localToWorld(new THREE.Vector3(0,0,0)));actor.playDomesticActivity('modeling',model.localToWorld(new THREE.Vector3(.07,1.04,.04)));}
            }
            else if(command.action==='boardGame'||command.action==='chessGame')actor.playDomesticActivity('chess');
            else if(command.action==='dartsGame')actor.playDomesticActivity('darts');
            else if(command.action==='pingPong')actor.playDomesticActivity('pingPong');
            else if(command.action==='billiards')actor.playDomesticActivity('billiards');
          }
          else if(command.action==='tidy')actor.playDomesticActivity('tidy');
          else if(command.action==='sofaScroll')actor.playDomesticActivity('scrollPhone');
          else if(command.action==='sofaCall')actor.playDomesticActivity('phone');
          else if(command.action==='sofaMusic')actor.playDomesticActivity('watch');
        }
        if(program){this.mediaFoodArrived.add(role);if(!this.playSofaFood(role,home))actor.watch(program==='horror'?-1:program==='comedy'?1:0);}
        return;
      }
      const seat = homeSeat(station,role);
      actor.setFurniturePose('sit',new THREE.Vector3().copy(seat.position),seat.yaw);
      if(home.consoleGame)actor.playConsole(home.consoleGame);
      else if (program) {
        this.mediaFoodArrived.add(role);if(!this.playSofaFood(role,home))actor.watch(program === 'comedy' ? 1 : program === 'horror' ? -1 : 0);
      } else if (command.type === 'read_book' || study?.channel === 'book') actor.playDomesticActivity('read');
      else if (study?.channel === 'practice') actor.playDomesticActivity('journal');
      else if(command.type==='eat'&&command.drinkSeat){actor.playActivity('eat',undefined,command.recipe);}
      else if (station === 'yardTable' && command.type === 'eat') {
        const point=this.showMeal(role, seat.position.x, DINING_TOP, HOME_PLACEMENTS.yardTable.z + .22, command.recipe);
        actor.playActivity('eat',point,command.recipe);
      }
      else if (command.type === 'act') {
        if(command.actionId==='yardHookahSolo'){actor.playPartnerGesture('yardHookah',true,new THREE.Vector3().copy(LOUNGE_HOOKAH));return;}
        const motion = DOMESTIC_MOTIONS[command.actionId];
        if (motion) actor.playDomesticActivity(motion);
      }
    };
    if((command.type==='movie'||command.type==='youtube')&&home.food&&pickup!==undefined){
      const food=home.food;const carry=()=>{if(!current())return;actor.walkPath(path.slice(pickup),arrive);if(isHomeDrink(food))actor.carryHomeDrink(food as RecipeId);else actor.carryFoodContainer();};
      const take=()=>{if(!current())return;const top=this.household?diningSurface(this.household):undefined;if(top){const target=new THREE.Vector3(top.x,top.height+.12,top.z);actor.faceTowards(target);actor.playDomesticActivity('reach',target);}else actor.playDomesticActivity('reach');this.preparations.set(role,{remaining:(home.pickupMs??650)/1000,next:carry});};
      if(pickup>0)actor.walkPath(path.slice(0,pickup),take);else take();
    }else if(command.type==='eat'&&command.drinkSeat&&pickup!==undefined){
      const carry=()=>{if(!current())return;actor.walkPath(path.slice(pickup),arrive);actor.carryHomeDrink(command.recipe);};
      const take=()=>{if(!current())return;const top=this.household?diningSurface(this.household):undefined;if(top){const target=new THREE.Vector3(top.x,top.height+.12,top.z);actor.faceTowards(target);actor.playDomesticActivity('reach',target);}else actor.playDomesticActivity('reach');this.preparations.set(role,{remaining:(home.pickupMs??650)/1000,next:carry});};
      if(pickup>0)actor.walkPath(path.slice(0,pickup),take);else take();
    }else if(station==='workCoffee'&&pickup!==undefined){
      const carry=()=>{if(!current())return;actor.walkPath(path.slice(pickup),arrive);if(command.type==='serve_work_drink')actor.carryHomeDrink(command.recipe);else actor.carryWorkCoffee();};
      const prepare=()=>{
        if(!current())return;
        if(!home.pickupMs){carry();return;}
        const top=command.type==='serve_work_drink'&&this.household?diningSurface(this.household):undefined;
        const target=top?new THREE.Vector3(top.x,top.height+.12,top.z):new THREE.Vector3().copy(KITCHEN_WORK.coffee.target);
        actor.faceTowards(target);actor.playDomesticActivity(top?'reach':'coffee',target);
        this.preparations.set(role,{remaining:home.pickupMs/1000,next:carry});
      };
      if(pickup>0)actor.walkPath(path.slice(0,pickup),prepare);else prepare();
    }else if(pickup!==undefined&&station==='kitchenCook'){
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

  activateHomeTask(role: CharacterId,elapsedMs=0): void {
    const home = this.homeTasks.get(role);
    if(home?.vanityCare||home?.station==='bathtub'){const elapsed=Math.max(0,elapsedMs/1000);this.careElapsed.set(role,elapsed);this.actors[role].syncCareElapsed(elapsed);}
    const pair=this.pairStages.get(role);
    if(pair) {
      pair.active=true;
      if(home?.pair?.motion==='venue'&&isVenueGame(home.pair.item)&&home.consoleMatch&&this.remote)this.remote.root.userData.venuePlay={game:home.pair.item,match:home.consoleMatch,started:this.visualSeconds-elapsedMs/1000};
      else if(home?.consoleGame)this.homeEffects.console(role,home.consoleGame,this.visualSeconds-elapsedMs/1000,home.consoleMatch);
      if(home?.pair?.item==='pingPong'&&this.tennisStarted===null)this.tennisStarted=this.visualSeconds-elapsedMs/1000;
      if(pair.action==='parkBadminton'&&this.badmintonStarted===null)this.badmintonStarted=this.visualSeconds-elapsedMs/1000;
      this.playPair(role);
      this.playPair(role==='vlad'?'alina':'vlad');
      return;
    }
    if(home?.consoleGame)this.homeEffects.console(role,home.consoleGame,this.visualSeconds-elapsedMs/1000,home.consoleMatch);
    if(home?.food){this.mediaFoodStarted.set(role,this.visualSeconds-elapsedMs/1000);this.playSofaFood(role,home);}
    if (home?.program) this.homeEffects.television(role,home.program,home.lesson,home.mediaSelection,this.visualSeconds-elapsedMs/1000-(home.mediaOffset??0));
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
      if(pair.motion==='breakfastReceive'&&home.furniturePose){const p=home.furniturePose;actor.setFurniturePose('sit',new THREE.Vector3(p.x,p.y,p.z),p.yaw);}
      this.playPair(role);
      this.playPair(role==='vlad'?'alina':'vlad');
    };
    const walk=()=>{
      if(home.pickup!==undefined) {
        actor.walkPath(route.slice(0,home.pickup),()=>{
          if(this.pairStages.get(role)!==stage)return;
          if(pair.motion==='breakfastServe'){actor.faceTowards(cookingPan);actor.playActivity('cook',cookingPan,pair.item as RecipeId);this.kitchenEffects.recipe(pair.item as RecipeId);this.kitchenCooking=true;this.cookingClock=0;this.preparations.set(role,{remaining:(home.pickupMs??0)/1000,next:()=>{if(this.pairStages.get(role)!==stage)return;actor.finishActivity();this.kitchenCooking=false;actor.carryFoodContainer();actor.walkPath(route.slice(home.pickup),arrived);}});return;}
          if(pair.carry==='book')actor.carryBook(BOOKS[pair.item as keyof typeof BOOKS]?.[4]??'#688e7c');
          if(pair.carry==='plate')actor.carryDirtyPlate();
          this.preparations.set(role,{remaining:(home.pickupMs??0)/1000,next:()=>actor.walkPath(route.slice(home.pickup),arrived)});
        });
      }else actor.walkPath(route,arrived);
    };
    const seated=this.household&&pair.place==='cafe'&&pair.station&&cafeSeatAt(this.household,role)?.id===pair.station;
    if(seated||this.household?.characters[role].pose==='sit'&&home.route.path.length===0&&(pair.seat==='sofa'||home.furnitureSeat)) {arrived();return true;}
    actor.setPose('idle');
    if(pair.offsetMs) this.preparations.set(role,{remaining:pair.offsetMs/1000,next:walk});
    else walk();
    return true;
  }

  private playPair(role:CharacterId):void {
    const stage=this.pairStages.get(role), home=this.homeTasks.get(role), pair=home?.pair;
    if(!stage?.active||!stage.arrived||stage.playing||!pair)return;
    const other=role==='vlad'?'alina':'vlad', opposite=this.pairStages.get(other);
    if((isContact(pair.motion)||pair.motion==='console'||pair.motion==='venue'||pair.motion==='badminton'||pair.item==='pingPong')&&opposite&&(!opposite.active||!opposite.arrived))return;
    stage.playing=true;
    const actor=this.actors[role], partner=this.actors[other];
    const focus=pair.target?new THREE.Vector3(pair.target.x,0,pair.target.z):undefined;
    if(pair.motion==='bedRest'&&home.furniturePose){const p=home.furniturePose;actor.setFurniturePose('idle',new THREE.Vector3(p.x,p.y,p.z),p.yaw);}
    else if(home.furniturePose&&home.furnitureSeat){const p=home.furniturePose;actor.setFurniturePose('sit',new THREE.Vector3(p.x,p.y,p.z),p.yaw);}
    else if(pair.seat) {
      const seat=homeSeat(pair.seat,role);
      actor.setFurniturePose('sit',new THREE.Vector3().copy(seat.position),seat.yaw);
    }else if(pair.station){
      const station=stationById(this.place,pair.station);
      if(station&&station.action.kind!=='badminton')this.sitAt(role,station);
      else if(focus)actor.faceTowards(focus);
    }else if(focus)actor.faceTowards(focus);
    const leads=pair.from===role;
    switch(pair.motion){
      case 'breakfastServe':actor.hideFoodContainer();actor.playPartnerGesture('talk',true);break;
      case 'breakfastReceive':{if(!home.furniturePose)break;const p=home.furniturePose;const tray=new THREE.Vector3(0,0,.40).applyAxisAngle(new THREE.Vector3(0,1,0),p.yaw);const plate=this.showMeal(role,p.x+tray.x,p.y+.83,p.z+tray.z,pair.item as RecipeId);const serving=this.meals.get(role)!;serving.rotation.y=p.yaw;serving.getObjectByName('Breakfast tray')!.visible=!isHomeDrink(home.food);actor.playActivity('eat',plate,pair.item as RecipeId);break;}
      case 'venueManual':actor.setPose('idle');if(focus)actor.faceTowards(focus);break;
      case 'venue':{
        if(pair.item==='venueUfc')actor.playConsole('ufc6');
        else if(pair.item==='venueBowling')actor.playDomesticActivity('venueBowl');
        else if(pair.item==='venueHockey'){const s=stationById('venue','venue-hockey')!,side=role==='vlad'?-1:1;actor.setFurniturePose('idle',new THREE.Vector3(s.center.x,0,s.center.z+side*1.57),side<0?0:Math.PI);actor.playDomesticActivity('venueHockey');}
        else if(pair.item==='venueBilliards'){const s=stationById('venue','venue-billiards')!,side=role==='vlad'?-1:1;actor.setFurniturePose('idle',new THREE.Vector3(s.center.x,0,s.center.z+side*1.15),side<0?0:Math.PI);actor.playDomesticActivity('venueCue');}
        else if(pair.item==='venueJenga')actor.playDomesticActivity('venueJenga');
        else if(pair.item==='venueUno')actor.playDomesticActivity('venueCards');
        break;
      }
      case 'leisure':{
        if(pair.item==='poolFloat'||pair.item==='poolSwim'){this.startPoolMotion(role,pair.item,home);break;}
        if(pair.item==='boardGame'||pair.item==='chessGame')actor.playDomesticActivity('chess');
        else if(pair.item==='dartsGame')actor.playDomesticActivity('darts');
        else if(pair.item==='pingPong'){
          const model=home.furnitureId===undefined?undefined:this.furnishingModels.get(home.furnitureId);
          if(model){const side=role==='vlad'?-1:1;actor.root.rotation.y=model.rotation.y+(side>0?Math.PI:0);}
          actor.playDomesticActivity('pingPong');
        }
        else if(pair.item==='billiards')actor.playDomesticActivity('billiards');
        break;
      }
      case 'badminton':if(focus)actor.faceTowards(new THREE.Vector3(actor.root.position.x,0,focus.z));actor.playDomesticActivity('badminton');break;
      case 'chess':actor.playDomesticActivity('chess');break;
      case 'stroll':
        actor.walkPath((pair.stroll??[]).map(p=>new THREE.Vector3(p.x,0,p.z)),()=>actor.playPartnerGesture('talk',leads));break;
      case 'console':if(home.consoleGame)actor.playConsole(home.consoleGame);break;
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
          actor.playActivity('eat',plate,pair.item as RecipeId|undefined,this.place==='park');
        }else if(pair.station) {
          const site=stationById(this.place,pair.station)!;
          const plate=this.showMeal(role,site.center.x+(role==='vlad'?-.40:.40),site.action.kind==='picnic'?.21:1.01,site.center.z-.10,pair.item as CafeItem|RecipeId|TakeoutId|undefined);
          actor.playActivity('eat',plate,pair.item as RecipeId|undefined,this.place==='park');
        }break;
      }
      case 'feed': {
        const bowl=pair.pet&&pair.pet in PETS?(this.household?feedingStation(this.household.furnishing,pair.pet as PetId).point:PETS[pair.pet as PetId].bowl):undefined;
        if(leads&&bowl)actor.playPetActivity('feed',new THREE.Vector3(bowl.x,.28,bowl.z));
        else actor.playPartnerGesture('listen',false);
        break;
      }
      case 'pet':{
        const action=stage.action==='petPlay'?'play':stage.action==='petBrush'?'brush':'pet';
        const pet=pair.pet&&pair.pet in this.pets?this.pets[pair.pet as PetId]:undefined;
        const petContact=pet ? (target:THREE.Vector3,stroke?:number)=>pet.coatContact(target,stroke) : undefined;
        if(leads) {
          actor.playPetActivity(action,petContact);
          pet?.react(action,role);
        } else {
          // Two human players take turns; otherwise the helper stood motionless
          // throughout the entire "brush together" action.
          actor.playPartnerGesture('listen',false);
          this.preparations.set(role,{remaining:stage.action==='petBrush'?4.2:3.3,next:()=>{
            if(this.pairStages.get(role)!==stage)return;
            partner.finishActivity();
            if(stage.action==='petBrush')partner.playPartnerGesture('listen',true);
            actor.playPetActivity(action,petContact);
            pet?.react(action,role);
          }});
        }
        break;
      }
      case 'highFive':
        actor.playGesture('highFive',actor.root.position.clone().lerp(partner.root.position,.5).setY(1.59));break;
      case 'gift':actor.playGift(stage.action,leads,actor.root.position.clone().lerp(partner.root.position,.5).setY(1.06));break;
      case 'sofaMassage':actor.playPartnerGesture('sofaMassage',leads,undefined,partner);break;
      case 'hands':case 'slowDance':
        actor.playPartnerGesture(pair.motion,leads,actor.root.position.clone().lerp(partner.root.position,.5).setY(pair.motion==='hands'?.99:1.20));break;
      case 'hair':case 'shoulder':
        actor.playPartnerGesture(pair.motion,leads,actor.root.position.clone().lerp(partner.root.position,.82).setY(pair.motion==='hair'?1.61:1.27));break;
      case 'yardHookah':actor.playPartnerGesture('yardHookah',leads,new THREE.Vector3().copy(LOUNGE_HOOKAH),partner);break;
      case 'teaTogether':case 'sofaLean':case 'sofaHands':case 'sofaKiss':case 'sofaHug':case 'bedRest':case 'cuddle':
        actor.playPartnerGesture(pair.motion,leads,undefined,partner);break;
      case 'hug':case 'closeHug':
        actor.playPartnerGesture(pair.motion,leads,undefined,partner);break;
      default:actor.playPartnerGesture(pair.motion,leads);
    }
  }

  private startPoolMotion(role:CharacterId,mode:'poolFloat'|'poolSwim',home:HomePresentation):void{
    const p=home.furniturePose;if(!p)return;
    const actor=this.actors[role];
    actor.setPose('idle');
    this.poolMotions.set(role,{mode,started:this.visualSeconds+(role==='alina'&&home.pair?1.6:0),wet:false});
  }
  private clearHomeTask(role: CharacterId): boolean {
    const home = this.homeTasks.get(role);
    if (!home) return false;
    this.homeTasks.delete(role);this.careElapsed.delete(role);this.hobbyWorks.delete(role);this.mediaFoodArrived.delete(role);this.mediaFoodStarted.delete(role);
    this.poolMotions.delete(role);
    if(home.pair?.motion==='venue'&&this.remote){delete this.remote.root.userData.venuePlay;this.actors[role].setPose('idle');}
    this.pairStages.delete(role);
    if(![...this.homeTasks.values()].some(h=>h.pair?.item==='pingPong'))this.tennisStarted=null;
    if(![...this.pairStages.values()].some(p=>p.action==='parkBadminton'))this.badmintonStarted=null;
    // Hold the last framing when the shared action ends, then return to free camera.
    if(this.pairStages.size===0)this.followingPair=false;
    this.homeEffects.television(role);this.homeEffects.console(role);
    if (home.station === 'shower' || home.station === 'bathtub' || home.station === 'wcBasin')
      this.homeEffects.water(home.station,false);
    if (home.station === 'grill'||home.pair?.motion==='grill') this.grillCooking = false;
    if (home.station === 'kitchenCook'||home.pair?.motion==='cook'||home.pair?.motion==='prep'||home.pair?.motion==='breakfastServe')
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
      // Agility is server-authorized at a nearby station. Do not let a short
      // resident steering delay consume the dog's entire exercise timer.
      if(isDogAgility(command.action))this.playParkDog(command.action,role);
      const start = () => {
        if(station.action.kind==='spa'){
 const a=station.action.facility,x=station.center.x,z=station.center.z,offset=role==='vlad'?-.44:.44;
 if(a==='spaLocker'){actor.faceTowards(new THREE.Vector3(x,0,z));actor.playDomesticActivity('tidy');}
 else if(a==='spaShower'){actor.setFurniturePose('idle',new THREE.Vector3(x,.12,z),Math.PI);actor.playDomesticActivity('shower');if(this.remote)(this.remote.root.userData.spaShowers??={})[role]=station.id;}
 else if(a==='spaPool'){actor.setFurniturePose('idle',new THREE.Vector3(x+(role==='vlad'?-1.35:1.35),.20,z+.45),0);actor.playDomesticActivity('spaSwim');if(this.remote)(this.remote.root.userData.spaWaterUsers??={})[role]=station.id;}
 else if(a==='spaJacuzzi'){actor.setSpaSeat(x+(role==='vlad'?-.70:.70),z-.60,.37,0);if(this.remote)(this.remote.root.userData.spaWaterUsers??={})[role]=station.id;}
 else if(a==='spaSauna')actor.setFurniturePose('sit',new THREE.Vector3(x+offset,-.10,z-.28),0);
 else if(a==='spaLounge'||a==='spaMassage'){actor.setFurniturePose('idle',new THREE.Vector3(x,a==='spaMassage'?1.06:.71,z+.98),a==='spaMassage'?Math.PI:0);actor.playDomesticActivity(a==='spaMassage'?'spaMassage':'spaRecline');if(a==='spaMassage'&&this.remote)(this.remote.root.userData.spaMassages??={})[role]=station.id;}
 }
        if(station.action.kind==='barber'&&station.action.facility==='chair'){actor.setFurniturePose('sit',new THREE.Vector3(station.center.x,-.15,station.center.z),Math.PI);if(this.remote)this.remote.root.userData.barberAction=command.action;}
        if (command.action === 'rest' || command.action === 'dine' || command.action === 'swing' || command.action === 'picnic') this.sitAt(role, station);
        if(command.action==='badminton'){actor.faceTowards(new THREE.Vector3(station.center.x,0,station.center.z));actor.playDomesticActivity('badminton');}
        if(isLakeLeisureAction(command.action)){
          if(command.action==='lakeSwim'){const f=lakeSwimFrame(0,role);actor.setFurniturePose('idle',new THREE.Vector3(f.x,f.y,f.z),f.yaw);actor.playDomesticActivity('spaSwim');}
          else if(command.action==='lakeView')actor.setFurniturePose('sit',new THREE.Vector3(station.center.x,-.16,station.center.z+(role==='vlad'?-.43:.43)),Math.PI/2);
          else {this.lakeDogMode='';this.playParkDog(command.action==='lakeDogFetch'?'dogFetch':'dogRoll',role);this.parkDogUntil=this.visualSeconds+25;}
        }
        if(isLakeCareAction(command.action)){if(command.action==='lakeWash'){const target=new THREE.Vector3(station.center.x,1.06,station.center.z);actor.faceTowards(target);actor.playDomesticActivity('washHands',target);}else{actor.setFurniturePose('sit',new THREE.Vector3(station.center.x,role==='vlad'?-.29:-.24,station.center.z-.18),0);actor.playDomesticActivity('toilet');}}
        if(isLakeRestAction(command.action)&&this.household){
          if(command.action==='lakeFireRest'){const side=role==='vlad'?-1:1;actor.setFurniturePose('sit',new THREE.Vector3(station.center.x+side*LAKE_FIRE_SEAT_OFFSET,-.09,station.center.z),side<0?Math.PI/2:-Math.PI/2);}
          else {const tent=lakeCampFor(this.household,station.id)?.tent;if(tent){const p=lakeSleepAnchor(tent,role);actor.setFurniturePose('sleep',new THREE.Vector3(station.center.x+p.x,p.y,station.center.z+p.z),p.yaw);}}
        }
        if(isLakeFishAction(command.action)){actor.faceTowards(new THREE.Vector3(station.center.x+5,0,station.center.z));actor.playFishing(FISH_ACTIONS[command.action]);}
        if(isLakeMealAction(command.action)){const p=LAKE_MEAL_ACTIONS[command.action],fire=this.remote?.stations.get(station.id)?.userData.fire;if(p.cook){const target=new THREE.Vector3(station.center.x,.60,station.center.z);actor.faceTowards(target);actor.playDomesticActivity('grill',target);if(fire){fire.userData.cookRole=role;fire.userData.setFood(p.meal);}}else{const side=role==='vlad'?-1:1,x=station.center.x+side*LAKE_FIRE_SEAT_OFFSET,z=station.center.z;actor.setFurniturePose('sit',new THREE.Vector3(x,-.09,z),side<0?Math.PI/2:-Math.PI/2);const dish=p.meal==='sausages'?'campSkewers':p.meal==='marshmallow'?'campMarshmallow':p.meal==='fish'||p.meal==='foil'?'lakeFish':p.meal==='potato'?'campPotato':p.meal==='skewers'?'campSkewers':'lakeSoup';const plate=this.showMeal(role,x-side*.25,.62,z,dish);actor.playActivity('eat',plate,(p.meal==='soup'?'chickenSoup':p.meal==='fish'?'salmonLemon':dish) as RecipeId,true);}}
        if(command.action==='campIgnite'||isCampRecipe(command.action)){const target=new THREE.Vector3(station.center.x,.60,station.center.z);actor.faceTowards(target);actor.playDomesticActivity('grill',target);}
        if(command.action==='picnic'&&this.household){
          const dish=picnicPortions(this.household,role)[0];
          if(dish){const plate=this.showMeal(role,station.center.x+(role==='vlad'?-.40:.40),.21,station.center.z-.10,dish.item as RecipeId|TakeoutId);actor.playActivity('eat',plate,dish.item as RecipeId|TakeoutId,true);}
        }
        if(command.action==='fitnessTrain'&&station.action.kind==='fitness'){
          const e=fitnessExercise(station.action.facility);if(!e)return;
          const f=station.action.facility, x=station.center.x,z=station.center.z;
          if(['bike','rower','legpress','latpull','seatedrow','chestpress','legextension','legcurl'].includes(f)){
            const height=f==='bike'?.16:f==='rower'?-.40:f==='legpress'?-.32:-.12;
            actor.setFurniturePose('sit',new THREE.Vector3(x,height+(role==='alina'?.05:0),z+(f==='bike'?.34:.24)),Math.PI);
          }else if(f==='treadmill')actor.setFurniturePose('idle',new THREE.Vector3(x,.26,z+.1),Math.PI);
          else if(f==='mat')actor.setFurniturePose('idle',new THREE.Vector3(x,.04,z),0);
          else if(f==='stepper'||f==='elliptical')actor.setFurniturePose('idle',new THREE.Vector3(x,.28,z+.25),Math.PI);
          else actor.faceTowards(new THREE.Vector3(x,0,z));
          actor.playDomesticActivity(e.motion);
        }
        if(command.action==='fitnessLocker')actor.setFurniturePose('sit',new THREE.Vector3(station.center.x,role==='vlad'?-.25:-.20,station.center.z+.31),0);
        if(command.action==='fitnessShower'){actor.setFurniturePose('idle',new THREE.Vector3(station.center.x,.10,station.center.z-.2),Math.PI);actor.playDomesticActivity('shower');}
        if(command.action==='fitnessToilet'){actor.setFurniturePose('sit',new THREE.Vector3(station.center.x-.38,role==='vlad'?-.29:-.24,station.center.z-.06),0);actor.playDomesticActivity('toilet');}
        if(fitnessBarItem(command.action)){actor.faceTowards(new THREE.Vector3(station.center.x,0,station.center.z));actor.playDomesticActivity('tea');}
        if(command.action==='fitnessSauna')actor.setFurniturePose('sit',new THREE.Vector3(station.center.x+(role==='vlad'?-.43:.43),role==='vlad'?-.15:-.10,station.center.z-.52),0);
        if (command.action === 'exercise') actor.playDomesticActivity('stretch');
        if (command.action === 'unpack') actor.playDomesticActivity('tidy');
        if(isParkDogAction(command.action)){
          actor.faceTowards(isDogAgility(command.action)?new THREE.Vector3(DOG_AGILITY[command.action].x,0,DOG_AGILITY[command.action].z):this.pets.verdell.root.position);
          if(command.action!=='dogToilet')actor.playPetActivity('play');
          if(!isDogAgility(command.action))this.playParkDog(command.action,role);
        }
        if (command.action === 'dine' && (this.household?.world.cafe[role]?.pickedUp || this.household?.world.cafe[role]?.table===station.id)) {
          const plate=this.showMeal(role, station.center.x + (role === 'vlad' ? -.40 : .40), 1.01, station.center.z - .10,this.household?.world.cafe[role]?.item);
          actor.playActivity('eat',plate);
        }
      };
      if(isDogAgility(command.action)&&Math.hypot(actor.root.position.x-station.center.x,actor.root.position.z-station.center.z)<1.9){start();return true;}
      if(this.household&&command.action==='dine'&&cafeSeatAt(this.household,role)?.id===station.id){start();return true;}
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
          FURNITURE_BY_ID.get(item.sku)?.shape==='desk'&&!isNotebookDesk(item.sku))?.id;
        const place=deskId!==undefined?furnitureUseLocation(this.household,role,deskId,'deskGames'):null;
        if(!place)return false;
        const destination=place.route.path.at(-1)??place.route.from;
        return this.walkTo(role,destination,()=>{
          if(!current())return;
          const pose=place.pose;
          this.actors[role].setFurniturePose('work',
            new THREE.Vector3(pose.x,pose.y,pose.z),pose.yaw,this.placedDeskKeys(place.item.id));
          if(command.type==='play_game')this.actors[role].playDomesticActivity('games');
          else this.actors[role].playDomesticActivity('read');
        });
      }
      return device==='laptop'
        ? this.walkTo(role,(this.household?laptopApproach(this.household,role):stationById('home',HOME_LAPTOP)!.approach),begin)
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
    if(command.type==='clean_room'){
      const route=this.household&&dustRoute(this.household,role,command.room);
      const point=route&&(route.path.at(-1)??route.from);if(!point)return false;
      return this.walkTo(role,point,()=>{if(!current())return;this.actors[role].playDomesticActivity('tidy',new THREE.Vector3(point.x+.4,.35,point.z));});
    }
    if (command.type === 'act') {
      const def = ACTIONS[command.actionId];
      if (def.item==='desk') {
        const mode:ComputerScene['mode']=command.actionId==='deskGames'?'game':
          command.actionId==='deskJournal'?'notes':
          role==='vlad'?'code':'hair';
        this.computerScreens.task(role,command.computer??'desktop',{mode,role,...(mode==='game'?{game:GAME_BY_ID.keys().next().value}: {})});
      }
      if(command.actionId==='curtainsOpen'||command.actionId==='curtainsClose'||command.actionId==='windowOpen'||command.actionId==='windowClose'){
        return this.walkTo(role,points.kitchenWindow,()=>{if(!current())return;const target=new THREE.Vector3(-3.12,1.67,-7.28);this.actors[role].faceTowards(target);this.actors[role].playDomesticActivity('reach',target);});
      }
      if (command.actionId === 'kitchenServe') {
        if (!this.household?.readyFood.some(batch=>batch.storage==='fridge' &&
            batch.portions>0 && batch.expiresAt>gameMinutes(this.household!.clock))) return false;
        const actor=this.actors[role];
        const fridge=stationById('home','fridge')!;
        return this.walkTo(role,fridge.approach,()=>{
          if(!current())return;
          actor.faceTowards(new THREE.Vector3(fridge.center.x,.93,fridge.center.z));
          actor.playDomesticActivity('reach');
          this.preparations.set(role,{remaining:.7,next:()=>{
            if(!current())return;
            actor.carryFoodContainer();
            void this.walkTo(role,homeSeat('table',role).approach,()=>{
              if(!current())return;
              actor.hideFoodContainer();
              actor.faceTowards(new THREE.Vector3(HOME_PLACEMENTS.table.x,.9,HOME_PLACEMENTS.table.z));
              actor.playDomesticActivity('tidy');
            });
          }});
        });
      }
      if (command.actionId === 'kitchenLeftovers') {
        // Pick up REAL table portions, walk them to the fridge, and only
        // register the move when the authoritative server finishes the task.
        if (!this.household?.readyFood.some(batch=>batch.storage==='table' &&
            batch.portions>0 && batch.expiresAt>gameMinutes(this.household!.clock))) return false;
        const actor=this.actors[role];
        const fridge=stationById('home','fridge')!;
        return this.walkTo(role,homeSeat('table',role).approach,()=>{
          if(!current())return;
          actor.playDomesticActivity('reach');
          this.preparations.set(role,{remaining:.75,next:()=>{
            if(!current())return;
            actor.carryFoodContainer();
            void this.walkTo(role,fridge.approach,()=>{
              if(!current())return;
              actor.hideFoodContainer();
              actor.faceTowards(new THREE.Vector3(fridge.center.x,.93,fridge.center.z));
              actor.playDomesticActivity('tidy');
            });
          }});
        });
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
        return this.walkTo(role,(this.household?laptopApproach(this.household,role):stationById('home',HOME_LAPTOP)!.approach),() => {
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
    const start = nearestClearPoint(actor.root.position, this.obstacles, floorFor('home'));
    const towardStorage = start && findRoute(start, approach, this.obstacles, floorFor('home'));
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

  private clearLakeFood(role:CharacterId){if(this.place==='lake'&&this.remote)for(const g of this.remote.stations.values()){const f=g.userData.fire;if(f?.userData.cookRole===role){delete f.userData.cookRole;f.userData.setFood();}}}
  private endAgility(role:CharacterId){if(this.agilityOwner!==role){if(this.agilityCueOwner===role)this.agilityCueOwner=undefined;return;}const action=this.agilityAction;this.agilityOwner=undefined;this.agilityAction=undefined;this.agilityWaiting=undefined;this.agilityCueOwner=undefined;const dog=this.pets.verdell;dog.stop();this.parkDogUntil=0;this.dogTrail=[];this.lastDogPoint=null;const walker=this.household?.world.dogWalker;if(this.place==='park'&&walker&&dog.root.visible){const blocks=placeObstacles('park'),floor=floorFor('park'),position={x:dog.root.position.x,z:dog.root.position.z};let start=nearestClearPoint(position,blocks,floor),exit:Point[]=[];if(action&&!pointIsClear(position,blocks,floor)){const course=agilityPath(action),open=placeObstacles('park',undefined,action),ends=[course[0],course.at(-1)!].filter(p=>pointIsClear(p,blocks,floor)).sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z));for(const e of ends){const p=findRoute(position,e,open,floor);if(p){exit=p;start=e;break;}}}const goal=nearestClearPoint(this.household?.pets.verdell.parkPosition??this.actors[walker].root.position,blocks,floor),tail=start&&goal&&findRoute(start,goal,blocks,floor),route=tail?[...exit,...tail]:null;if(route?.length){dog.followRoute(route.map(p=>new THREE.Vector3(p.x,0,p.z)),'wander');if(exit.length&&action)dog.setAgility(action);this.parkDogUntil=this.visualSeconds+Math.min(16,route.reduce((n,p,i)=>n+Math.hypot(p.x-(route[i-1]?.x??start!.x),p.z-(route[i-1]?.z??start!.z)),0)/PET_SPEED.verdell+1);}}}
  finishTimedAction(role: CharacterId): void {
    this.endAgility(role);
    for(const id of PET_IDS)this.pets[id].endOwnerReaction(role);
    this.clearLakeFood(role);
    if(this.place==='spa'){this.actors[role].setPose('idle');if(this.remote?.root.userData.spaMassages)delete this.remote.root.userData.spaMassages[role];if(this.remote?.root.userData.spaShowers)delete this.remote.root.userData.spaShowers[role];if(this.remote?.root.userData.spaWaterUsers)delete this.remote.root.userData.spaWaterUsers[role];}
    if(this.place==='barber'&&role==='vlad'){if(this.remote)delete this.remote.root.userData.barberAction;this.actors[role].setPose('idle');}
    this.computerScreens.endTask(role);
    this.preparations.delete(role);
    this.endDogBath(role);
    const dishes = this.dishTasks.delete(role);
    if (this.household && this.household.world.places[role] !== this.place) return;
    this.meals.get(role)!.visible = false;
    this.closeStorage(role);
    ++this.taskSequence[role];
    const home = this.homeTasks.get(role);
    this.clearHomeTask(role);
    this.actors[role].finishActivity();
    if(this.place==='lake')this.actors[role].setPose('idle');
    if(home?.furnitureId!==undefined&&this.household?.furnishing.placed.some(i=>i.id===home.furnitureId&&['oasis-pool','oasis-terrace'].includes(i.sku)))this.actors[role].setPose('idle');
    if(home?.station==='yardTable'&&this.household?.characters[role].pose==='idle')this.actors[role].setPose('idle');
    if(home?.pair?.motion==='stroll'||home?.pair?.motion==='bedRest'||home?.pair?.motion==='breakfastReceive')this.actors[role].setPose('idle');
    if (dishes||home?.vanityCare) this.actors[role].setPose('idle');
    if (home && ['basin','wcBasin','bathtub','shower','toilet','officeChair','grill'].includes(home.station))
      this.actors[role].setPose('idle');
  }

  cancelTimedAction(role: CharacterId): void {
    this.endAgility(role);
    for(const id of PET_IDS)this.pets[id].endOwnerReaction(role);
    this.clearLakeFood(role);
    if(this.place==='spa'){this.actors[role].setPose('idle');if(this.remote?.root.userData.spaMassages)delete this.remote.root.userData.spaMassages[role];if(this.remote?.root.userData.spaShowers)delete this.remote.root.userData.spaShowers[role];if(this.remote?.root.userData.spaWaterUsers)delete this.remote.root.userData.spaWaterUsers[role];}
    if(this.place==='barber'&&role==='vlad'){if(this.remote)delete this.remote.root.userData.barberAction;this.actors[role].setPose('idle');}
    this.computerScreens.endTask(role);
    this.preparations.delete(role);
    this.endDogBath(role);
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

  private endDogBath(role:CharacterId){if(this.bathingRole!==role)return;this.bathingRole=undefined;this.bathWashing=false;this.pets.verdell.setBath(false);this.homeEffects.dogBath(null);}
  showPetTreat(id:PetId):void{if(this.place==='home')this.pets[id].react('treat');}

  performPet(role: CharacterId, petId: PetId, action: PetAction, current = () => true): boolean {
    if(action==='bathe'){
      if(petId!=='verdell')return false;this.bathingRole=role;this.bathWashing=false;const actor=this.actors[role],dog=this.pets.verdell;
      const wait=()=>{if(!current()||this.bathingRole!==role)return;if(Math.hypot(dog.root.position.x-DOG_BATH_APPROACH.x,dog.root.position.z-DOG_BATH_APPROACH.z)>.15){this.preparations.set(role,{remaining:.25,next:wait});return;}
        actor.faceTowards(new THREE.Vector3(DOG_BATH_SURFACE.x,0,DOG_BATH_SURFACE.z));dog.setBath(true);this.bathWashing=true;
        actor.playPetActivity('bathe',(target:THREE.Vector3)=>dog.coatContact(target));};
      const walking=this.walkTo(role,DOG_BATH_OWNER,wait);if(!walking)this.endDogBath(role);return walking;
    }
    if (action === 'buyFood') return true;
    const actor = this.actors[role];
    const pet = this.pets[petId];
    const filling = action === 'feed'||action==='loadFeeder';
    const station=this.household?feedingStation(this.household.furnishing,petId):undefined;
    const position = filling ? station?.point??PETS[petId].bowl : pet.root.position;
    if (!filling) pet.stop();
    const target = filling&&station?.item?feedingOwnerPoint(station,{x:actor.root.position.x,z:actor.root.position.z},this.obstacles,HOME_FLOOR):petApproach(position, this.obstacles, HOME_FLOOR);
    const walking = target && this.walkTo(role, target, () => {
      if (!current()) return;
      actor.faceTowards(new THREE.Vector3(position.x,0,position.z));
      actor.playPetActivity(action==='loadFeeder'?'feed':action==='fishTreat'?'treat':action,filling
        ? new THREE.Vector3(position.x,action==='loadFeeder'?(station?.model?.height??.28)+.10:.28,position.z)
        : (hand:THREE.Vector3,stroke?:number)=>action==='treat'||action==='fishTreat'?pet.muzzleContact(hand):pet.coatContact(hand,stroke));
      // The animal eats during its own routine, not when the player pours food.
      if (!filling) pet.react(action==='fishTreat'?'treat':action,role);
    });
    if (!walking) return false;
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
        if(activity==='stroll'){this.actors[role].setPose('idle');return;}
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
    const clock=clockAt(Math.max(0,minute));
    const current=weatherAt(clock);
    const festiveKey=clock.day+':'+JSON.stringify(this.household?.familyLife?.dates??{});
    if(this.yard&&festiveKey!==this.festiveKey){this.festiveKey=festiveKey;const theme=this.festiveGarlands.update(clock.day,this.household??undefined);this.festiveTree.visible=theme==='winter';this.yard.gardenPlants.visible=theme!=='winter';}
    this.weather.setWeather(current.kind,this.scene,this.place);
    applySeason(current,this.weather.visualKind);
    this.yardSnow=this.weather.visualKind==='snow'?Math.max(.75,current.snow):current.snow;
    const hour = THREE.MathUtils.euclideanModulo(minute,1440);
    const phase = dayPhase({day:1,minute:hour});
    if(phase!==this.lastDayPhase) {
      this.lastDayPhase=phase;
      const night=phase==='night'||phase==='evening';
      this.remote?.setNight(night);
      if(this.place==='district')this.district?.setNight(night);
    }
    // Smooth solar cycle: cool predawn, amber sunrise, clear midday, honeyed
    // golden hour and a blue twilight. No shadow maps or extra render passes.
    const keys = [
      {t:0,sky:0x344461,sun:.25,ambient:.94,warm:0x9fb9ef,glow:1.36},
      {t:300,sky:0x55657f,sun:.30,ambient:1.02,warm:0xb7cbed,glow:1.18},
      {t:365,sky:0xd29b8c,sun:1.24,ambient:1.12,warm:0xffa36b,glow:.55},
      {t:445,sky:0xeac6a0,sun:2.05,ambient:1.46,warm:0xffc28c,glow:.15},
      {t:625,sky:0xb1d2e2,sun:2.42,ambient:1.57,warm:0xffeed8,glow:0},
      {t:900,sky:0xaacfe1,sun:2.46,ambient:1.63,warm:0xfff0df,glow:0},
      {t:1050,sky:0xeac39d,sun:2.02,ambient:1.36,warm:0xffbd76,glow:.12},
      {t:1145,sky:0xd38c86,sun:1.28,ambient:1.13,warm:0xffa36b,glow:.74},
      {t:1230,sky:0x566382,sun:.42,ambient:1.04,warm:0x9eb7ef,glow:1.20},
      {t:1320,sky:0x344461,sun:.25,ambient:.94,warm:0x9fb9ef,glow:1.36},
      {t:1440,sky:0x344461,sun:.25,ambient:.94,warm:0x9fb9ef,glow:1.36},
    ];
    const index = keys.findIndex(key=>key.t>=hour);
    const end = keys[Math.max(1,index)];
    const begin = keys[Math.max(0,Math.max(1,index)-1)];
    const progress=THREE.MathUtils.smoothstep(hour,begin.t,end.t);
    const mix=(a:number,b:number)=>THREE.MathUtils.lerp(a,b,progress);
    const mixed=(a:number,b:number)=>new THREE.Color(a).lerp(new THREE.Color(b),progress);
    this.sun.intensity=mix(begin.sun,end.sun)*1.07;
    this.sun.color.copy(mixed(begin.warm,end.warm));
    this.ambient.intensity=mix(begin.ambient,end.ambient)*.90;
    if(this.place==='home'){
      // Slightly stronger key/fill separation in daylight; no extra lights.
      const daylight=THREE.MathUtils.smoothstep(this.sun.intensity,.8,2.1);
      this.ambient.intensity*=1-.065*daylight;
      this.sun.intensity*=1+.035*daylight;
    }
    this.ambient.color.copy(mixed(0xbdcee4,0xeef2fb))
      .lerpColors(new THREE.Color(0xbdcee4),new THREE.Color(0xeef2fb),
        THREE.MathUtils.smoothstep(this.sun.intensity,.33,1.7));
    this.ambient.groundColor.setHex(0xbca58b).lerp(new THREE.Color(0x687a86),
      1-THREE.MathUtils.smoothstep(this.sun.intensity,.40,1.70));
    const sky=mixed(begin.sky,end.sky);
    (this.scene.background as THREE.Color).copy(sky);
    if(this.scene.fog)this.scene.fog.color.copy(sky);
    const lampLevel=this.place==='home'?THREE.MathUtils.clamp(mix(begin.glow,end.glow)/1.36,0,1):0;
    this.lampNight=lampLevel;
    this.roomGlow.intensity=lampLevel*12;
    this.roomGlow.visible=lampLevel>.04;
    this.cottageLamps?.setLevel(lampLevel);
    if(this.yard?.night)this.yard.night.visible=this.place==='home'&&(hour>=1135||hour<375);
    const solarAngle=(hour-360)/720*Math.PI;
    this.sun.position.set(-2.6+Math.cos(solarAngle)*6,
      1.8+Math.max(0,Math.sin(solarAngle))*11,
      4.2+Math.cos(solarAngle)*3);
    this.weather.light(this.scene,this.place,this.sun,this.ambient);
    if(this.place==='venue'||this.place==='spa'){
      (this.scene.background as THREE.Color).setHex(this.place==='venue'?0x899aa4:0xb8cdc8);
      this.sun.color.setHex(0xfff1de);this.sun.intensity=1.7;this.sun.position.set(-5,11,7);
      this.ambient.color.setHex(0xe4f0ff);this.ambient.groundColor.setHex(0x9ba9a6);this.ambient.intensity=1.45;
    }
    const indoor=interiorLighting(this.place);
    if(indoor){
      this.sun.color.setHex(indoor.warm);this.sun.intensity=indoor.key;this.sun.position.set(-4,10,7);
      this.ambient.color.setHex(0xe4edf4);this.ambient.groundColor.setHex(indoor.floor);this.ambient.intensity=indoor.fill;
    }
    this.horizon.tint(this.scene.background as THREE.Color,this.weather.haze,current.snow);
  }

  private createLights(): void {
    this.scene.add(this.ambient);
    // One inexpensive shadowless practical light for evening interiors.
    this.roomGlow.position.set(1.2, 2.65, -2.0);
    this.roomGlow.castShadow = false;
    this.scene.add(this.roomGlow,this.ownedLampGlow);
    this.ownedLampGlow.castShadow=false;
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
    this.kitchenCurtains=this.scene.getObjectByName('KitchenWindowCurtains') as THREE.Group;
    if(this.kitchenCurtains)this.register('kitchenWindow',this.kitchenCurtains,points.kitchenWindow);
    this.cottageLamps=buildCottageLights(this.scene);
    buildHomeWing(this.scene);
    this.sideWalls=buildHomeSideWalls(this.scene);
    this.yard = buildYard(this.scene);
    this.homeScene.add(this.festiveTree,this.festiveGarlands.root);
    this.familyCar=buildFamilyCar();
    this.scene.add(this.familyCar);
    this.trackStation(this.stationMeshes,'family-car',this.familyCar);
    this.register('grill', this.yard.grill, points.grill);
    polishFurniture(this.yard.table,false);
    this.register('yardTable', this.yard.table, points.yardTable);
    buildPersonalFurniture(this.scene, model => this.register('bookcase',model,
      new THREE.Vector3(points.bookcase.x,0,points.bookcase.z)),
      (id,model)=>this.staticFixtureModels.set(id,model),model=>this.register('vanity',model,points.vanity));
    buildSoftRugs(this.scene,(id,model)=>this.staticFixtureModels.set(id,model));
    let desktop:THREE.Group|undefined;
    buildFurniture((id, furniture, point) => {
      batchRigidParts(furniture, true);
      polishFurniture(furniture,false);
      if(id==='desk')desktop=furniture;
      if(id==='coffeeMaker')this.coffeeModels=furniture;
      if(id==='tv')this.homeEffects.mountTv(furniture);
      this.register(id, furniture, point);
    });
    this.computerScreens=new HomeComputerScreens(desktop!,this.extensions.stations.get(HOME_LAPTOP)!);
    this.computerScreens.hardwareGroup('desktop').traverse(part=>{if(part instanceof THREE.Mesh){part.userData.interactable='desk';this.interactiveMeshes.push(part);}});
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
    const signature=JSON.stringify([placed,this.household?.furnishing.soldFixtures?.includes('desk')??false,this.household?.furnishing.soldFixtures?.includes('bed')??false]);
    if(signature===this.furnishingVisualKey)return;
    this.furnishingVisualKey=signature;
    const desktop=this.computerScreens.hardwareGroup('desktop');
    const laptop=this.computerScreens.hardwareGroup('laptop');
    const desktopId=desktop.parent?.userData.furnitureId as number|undefined;
    const laptopId=laptop.parent?.userData.furnitureId as number|undefined;
    reconcileFurnitureModels(this.furnishingModels,placed,item=>{
      const model=buildFurnishingModel(item.sku,item.finish);
      model.traverse(part=>{
        if(part instanceof THREE.Mesh){
          part.userData.furnitureId=item.id;
          this.interactiveMeshes.push(part);
        }
      });
      this.homeScene.add(model);
      return model;
    },model=>{
      // Shared hardware must be detached before model-owned buffers are freed.
      if(desktop.parent===model)this.computerScreens.hostDesktop(null);
      if(laptop.parent===model)this.computerScreens.hostLaptop(null);
      const removed=new Set<THREE.Object3D>();
      model.traverse(part=>removed.add(part));
      for(let i=this.interactiveMeshes.length-1;i>=0;i--)
        if(removed.has(this.interactiveMeshes[i]))this.interactiveMeshes.splice(i,1);
      model.removeFromParent();
      disposeFurnitureModel(model);
    },(model,item)=>{
      model.position.set(item.x,isSurfaceDevice(item.sku)&&this.household?(speakerHeight(this.household.furnishing,item)??.01):.01,item.z);
      model.rotation.y=item.rotation*Math.PI/2;
      if(item.sku==='pet-bed-stairs'&&this.household){
        const site=dogBedSites(this.household,item)[0];
        model.scale.y=site?site.height/.76:model.userData.originalScaleY;
      }
    });
    const notebook=preferredFurniture(placed,laptopId,item=>isNotebookDesk(item.sku));
    const notebookModel=notebook?this.furnishingModels.get(notebook.id)!:null;
    this.computerScreens.hostLaptop(notebookModel);
    const replacement=this.household?.furnishing.soldFixtures?.includes('desk')
      ?preferredFurniture(placed,desktopId,item=>FURNITURE_BY_ID.get(item.sku)?.shape==='desk'&&!isNotebookDesk(item.sku)):undefined;
    this.computerScreens.hostDesktop(replacement?this.furnishingModels.get(replacement.id)!:null);
  }

  focusDesktopFurniture(id:number):void{
    if(!this.household?.furnishing.soldFixtures?.includes('desk'))return;
    const item=this.household.furnishing.placed.find(entry=>entry.id===id);
    if(item&&FURNITURE_BY_ID.get(item.sku)?.shape==='desk'&&!isNotebookDesk(item.sku)){
      const model=this.furnishingModels.get(id);
      if(model)this.computerScreens.hostDesktop(model);
    }
  }

  setFurnishingPick(onTarget:(x:number,z:number)=>{x:number;z:number;y?:number}|null,onItem:(id:number)=>void):void {
    this.furnishingPlaceCallback=onTarget;
    this.furnishingItemCallback=onItem;
  }

  beginFurnishingPlacement(sku:string,finish:FurnitureFinish,rotation:Rotation):void {
    this.endFurnishingPlacement();
    this.speakerGhost=isSurfaceDevice(sku);
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
    if(this.speakerGhost&&this.household){const guides=new THREE.Group();for(const s of speakerSurfaces(this.household.furnishing)){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(s.w,s.d),new THREE.MeshBasicMaterial({color:0x38b875,transparent:true,opacity:.20,depthWrite:false,side:THREE.DoubleSide}));const a=s.rotation*Math.PI/2;mesh.rotation.set(-Math.PI/2,0,a);mesh.position.set(s.x+s.u*Math.cos(a)+s.v*Math.sin(a),s.y+.005,s.z-s.u*Math.sin(a)+s.v*Math.cos(a));guides.add(mesh);}this.homeScene.add(guides);this.speakerSurfaceGuides=guides;}
    this.setFurnishingValidity(false);
    // Start with a meaningful home-room location instead of a ghost floating
    // above the center of the house. The same callback updates the UI.
    const first=this.speakerGhost&&this.household?speakerSurfaces(this.household.furnishing)[0]:undefined;
    const a=(first?.rotation??0)*Math.PI/2;
    const target=first?this.furnishingPlaceCallback?.(first.x+first.u*Math.cos(a)+first.v*Math.sin(a),first.z-first.u*Math.sin(a)+first.v*Math.cos(a)):this.furnishingPlaceCallback?.(13.45,-5.65);
    if(target)this.furnishingGhost.position.set(target.x,target.y??.04,target.z);
  }

  turnFurnishingPlacement(rotation:Rotation):void {
    const ghost=this.furnishingGhost;
    if(!ghost)return;
    ghost.rotation.y=rotation*Math.PI/2;
    const newTarget=this.furnishingPlaceCallback?.(ghost.position.x,ghost.position.z);
    if(newTarget)ghost.position.set(newTarget.x,newTarget.y??.04,newTarget.z);
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
    let surfacePoint:THREE.Vector3|undefined;
    if(this.speakerGhost&&this.household){let distance=Infinity;for(const s of speakerSurfaces(this.household.furnishing)){
      const hit=this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-s.y),new THREE.Vector3());if(!hit)continue;
      const a=s.rotation*Math.PI/2,dx=hit.x-s.x,dz=hit.z-s.z,u=dx*Math.cos(a)-dz*Math.sin(a),v=dx*Math.sin(a)+dz*Math.cos(a);
      const dist=hit.distanceTo(this.raycaster.ray.origin);if(Math.abs(u-s.u)<=s.w/2+.12&&Math.abs(v-s.v)<=s.d/2+.12&&dist<distance){distance=dist;surfacePoint=hit;}
    }}
    const point=surfacePoint??this.raycaster.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0,1,0),0),this.vector);
    if(!point)return;
    const selected=this.furnishingPlaceCallback?.(
      Math.round(point.x*100)/100,Math.round(point.z*100)/100);
    if(selected)this.furnishingGhost.position.set(selected.x,selected.y??.04,selected.z);
  }

  endFurnishingPlacement():void {
    if(this.speakerSurfaceGuides){this.speakerSurfaceGuides.removeFromParent();this.speakerSurfaceGuides.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.geometry.dispose();(obj.material as THREE.Material).dispose();}});this.speakerSurfaceGuides=null;}
    if(!this.furnishingGhost)return;
    const ghost=this.furnishingGhost;
    ghost.removeFromParent();
    disposeFurnitureModel(ghost,true);
    this.furnishingGhost=null;this.speakerGhost=false;
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
        mesh.userData.interactable='dirtyDishes';
        this.interactiveMeshes.push(mesh);
        residue.userData.interactable='dirtyDishes';this.interactiveMeshes.push(residue);
        const touch=new THREE.Mesh(new THREE.CylinderGeometry(1.55,1.55,1,12),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
        touch.position.y=.55;touch.userData.interactable='dirtyDishes';mesh.add(touch);this.interactiveMeshes.push(touch);
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
      const base=buildFurnishingModel('pet-feed-'+id+'-ceramic',id==='verdell'?'sage':'terracotta');base.position.set(x,0,z);this.homeScene.add(base);this.starterBowls[id]=base;
      const hit = new THREE.Mesh(hitGeometry, hitMaterial);
      this.bowlHits[id]=hit;hit.position.set(x, .145, z);
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
    if(this.place==='home'||this.place==='district'||this.place==='park')for(const body of this.neighborBodies){
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

  parkConversation():void{if(this.place==='park')for(const role of ['vlad','alina'] as const)this.actors[role].parkConversation();}
  private playParkDog(action:string,role:CharacterId):void{
    const dog=this.pets.verdell,actor=this.actors[role],obstacles=this.place==='park'&&isDogAgility(action)?placeObstacles('park',undefined,action):this.currentObstacles(),floor=floorFor(this.place);
    const start=nearestClearPoint(dog.root.position,obstacles,floor);if(!start)return;
    if(this.place==='park'&&isDogAgility(action)){const course=agilityPath(action),entry=course[0],route=findRoute(start,entry,obstacles,floor);if(route&&course.slice(1).every((p,i)=>segmentIsClear(course[i],p,obstacles,floor))){this.parkDogUntil=this.visualSeconds+30;this.dogTrail=[];this.lastDogPoint=null;dog.followRoute(route.map(p=>new THREE.Vector3(p.x,0,p.z)),'wander');this.agilityOwner=role;this.agilityAction=action;this.agilityWaiting={entry,releaseAt:this.visualSeconds+8};this.agilityQAExit=undefined;}return;}
    const owner=nearestClearPoint({x:actor.root.position.x-.55,z:actor.root.position.z+.35},obstacles,floor);if(!owner)return;
    const goal=nearestClearPoint({x:owner.x-2.0,z:owner.z+1.3},obstacles,floor);if(!goal)return;
    this.parkDogUntil=this.visualSeconds+(isDogAgility(action)?23:action==='dogToilet'?6:15);
    this.dogTrail=[];this.lastDogPoint=null;
    if(action==='dogRoll'){dog.parkRoll();return;}
    if(action==='dogToilet'){
      const route=findRoute(start,goal,obstacles,floor);if(route)dog.followRoute(route.map(p=>new THREE.Vector3(p.x,0,p.z)),'toilet');return;
    }
    if(action==='dogFetch'||action==='dogChase'){
      const first=findRoute(start,goal,obstacles,floor),second=findRoute(goal,owner,obstacles,floor);if(first&&second){
        const points=[...first,...second].map(p=>new THREE.Vector3(p.x,0,p.z));
        if(action==='dogFetch'){dog.followRoute(points,'fetch',undefined,undefined,{point:goal,pickupRemaining:1});dog.setParkStick();}
        else{const loop=findRoute(owner,goal,obstacles,floor);dog.followRoute([...points,...(loop??[]).map(p=>new THREE.Vector3(p.x,0,p.z)),...second.map(p=>new THREE.Vector3(p.x,0,p.z))],'wander');}
        return;
      }
    }
    dog.react('play');
  }

  private sitAt(role: CharacterId, station: Station): void {
    const actor = this.actors[role];
    if(station.action.kind==='lake'&&station.action.facility==='fire'){const side=role==='vlad'?-1:1;actor.setFurniturePose('sit',new THREE.Vector3(station.center.x+side*LAKE_FIRE_SEAT_OFFSET,-.09,station.center.z),side<0?Math.PI/2:-Math.PI/2);return;}
    if(station.action.kind==='picnic'){
      actor.setFurniturePose('sit',new THREE.Vector3(station.center.x+(role==='vlad'?-.50:.50),role==='vlad'?-.76:-.71,station.center.z+.39),Math.PI);return;
    }
    if(station.action.kind==='swing'){
      actor.setFurniturePose('sit',new THREE.Vector3(station.center.x+(role==='vlad'?-.47:.47),0,station.center.z-.035),0);
      const pivot=this.remote?.stations.get(station.id)?.getObjectByName('Leisure swing pivot');
      if(pivot)actor.markParkSwing(pivot.getWorldPosition(new THREE.Vector3()),.6075);
      return;
    }
    const cafe = station.action.kind === 'dine';
    actor.setFurniturePose('sit', new THREE.Vector3(approachFor(station, role).x,
      role === 'vlad' ? -.24 : -.19, station.center.z + (cafe ? .51 : .12)), cafe ? Math.PI : 0);
  }

  private showMeal(role: CharacterId, x: number, y: number, z: number,
    dish?:RecipeId|TakeoutId|CafeItem|CampRecipe|'lakeFish'|'lakeSoup'): THREE.Vector3 {
    const meal = this.meals.get(role)!;
    meal.position.set(x, y, z);meal.rotation.y=0;const tray=meal.getObjectByName('Breakfast tray');if(tray)tray.visible=false;
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
    meal.visible = !isHomeDrink(dish);
    return new THREE.Vector3(x,y+.08,z);
  }

  walkTo(role: CharacterId, target: { x: number; z: number }, onArrive = () => {}): boolean {
    const actor = this.actors[role];
    const obstacles = this.currentObstacles();
    const from = nearestClearPoint(actor.root.position, obstacles, floorFor(this.place));
    const to = nearestClearPoint(target, obstacles, floorFor(this.place));
    let path = from && to ? findRoute(from, to, obstacles, floorFor(this.place)) : null;
    if(this.place==='spa'&&from&&to){
      const peer=this.actors[role==='vlad'?'alina':'vlad'];
      if(peer.root.visible&&!peer.isWalking()){
        const body=peer.bodyPosition(this.otherBody),r=RESIDENT_CLEARANCE+.04;
        const occupied=[...obstacles,{minX:body.x-r,maxX:body.x+r,minZ:body.z-r,maxZ:body.z+r}];
        path=findRoute(from,to,occupied,floorFor(this.place))??path;
      }
    }
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
    const actor=this.actors[role];
    if (this.followingPlayer && this.place==='district' && role===this.localRole) {
      this.neighborhoodView=false;
      this.inspected=null;
      this.frameDistrictResident();
      this.controls.minDistance=10;
      this.controls.maxDistance=96;
      this.followSubject=actor.root;
      this.followPoint.copy(actor.root.position);
      this.cameraMove=this.residentDistrictFrame(actor.root.position,this.compactPortrait.matches);
    }
    // Use the server's route directly. A moving body can briefly lag or steer
    // aside, so replan only if the visible avatar cannot join the first leg.
    if (segmentIsClear(actor.root.position,path[0],this.currentObstacles(),floorFor(this.place)) ||
        !this.walkTo(role,target,arrival)) actor.walkPath(path.map(p=>new THREE.Vector3(p.x,0,p.z)),arrival);
  }

  openStorage(id: string, role = this.localRole): void {this.openDoors.set(role,id);}
  closeStorage(role = this.localRole): void {this.openDoors.delete(role);}

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
    const switchStarted=performance.now();
    this.followingPair=false;
    this.fittingCamera(null);
    if(!this.inspected&&!this.cameraMove&&!this.neighborhoodView){
      this.savedCameras.set(this.place,{
        position:this.camera.position.clone(),target:this.controls.target.clone(),manualHeight:this.manualCameraHeight,
      });
    }
    this.manualCameraHeight=false;
    this.openDoors.clear();
    this.cameraMove = null;
    this.followSubject = null;
    this.inspected = null;
    this.defaultFrame = null;
    this.viewport = null;
    this.lastDayPhase = null;
    this.preparations.clear();
    if(this.bathingRole)this.endDogBath(this.bathingRole);
    this.petRoutines.clear();
    this.homeLeisure.clear();
    this.sleepingOffline.clear();
    for (const pet of Object.values(this.pets)) pet.stop();
    this.dogTrail = [];
    this.lastDogPoint = null;this.agilityOwner=undefined;this.agilityAction=undefined;this.agilityWaiting=undefined;this.agilityCueOwner=undefined;this.parkDogUntil=0;this.parkDogToiletStamp=0;this.lakeDogMode='';
    this.remote?.root.removeFromParent();
    this.remote?.dispose();
    this.remoteMeshes = [];
    this.externalObstacles = placeObstacles(place);
    this.district?.root.removeFromParent();
    this.remote = place === 'home'||place==='district' ? null : createLocation(place);
    this.scene = place === 'home' ? this.homeScene : new THREE.Scene();
    if(place==='district'){
      this.district??=createHomeDistrict();
      this.scene.add(this.district.root);
      this.neighbors.bindDoors(this.district.root);
      for(const [id,group] of this.district.entries)this.trackStation(this.remoteMeshes,id,group);
    }
    // The same rigs are reparented; they never render in two scenes on one device.
    if(place==='district'||place==='home')this.scene.add(this.neighbors.group);
    else this.neighbors.group.removeFromParent();
    this.neighbors.group.visible=false;
    this.scene.background = new THREE.Color(0xc0c7ad);
    this.scene.fog = place==='venue'||place==='spa'?null:place === 'district' ? new THREE.Fog(0xc0c7ad, 125, 171) : new THREE.Fog(0xc0c7ad, place==='home'?125:place==='lake'?85:place==='fitness'?85:49, place==='home'?185:place==='lake'?115:place==='fitness'?115:75);
    if (this.remote) {
      this.scene.add(this.remote.root);
      for (const [id, group] of this.remote.stations) this.trackStation(this.remoteMeshes, id, group);
    }
    this.scene.add(this.ambient, this.sun, this.sun.target,
      ...Object.values(this.actors).map(actor => actor.root), ...Object.values(this.pets).map(pet => pet.root),
      ...Object.values(this.bags), ...this.meals.values());
    for (const meal of this.meals.values()) {meal.visible=false;delete meal.userData.cafeKey;}
    if (this.cart) { this.cart.visible = false; this.scene.add(this.cart); }
    this.homeEffects.reset();
    this.grillCooking = false;
    this.kitchenCooking=false;
    this.kitchenEffects.root.visible=false;
    this.homeTasks.clear();this.hobbyWorks.clear();this.poolMotions.clear();this.mediaFoodArrived.clear();this.mediaFoodStarted.clear();
    this.neighborhoodView=false;
    this.frameDistrictResident();
    this.neighborBodies=[];
    this.computerScreens.resetPreviews();
    for(const role of ['vlad','alina'] as const)this.computerScreens.endTask(role);
    this.pairStages.clear();this.badmintonStarted=null;this.tennisStarted=null;
    this.dishTasks.clear();
    for (const actor of Object.values(this.actors)) actor.clearProps();
    stopUfcHighlight();
    this.place = place;
    this.weather.enter(this.scene,place);
    this.horizon.enter(this.scene,place);
    this.camera.far=place==='district'||place==='home'?180:110;
    this.camera.updateProjectionMatrix();
    this.controls.maxTargetRadius = place === 'district' ? 110 : place==='home'?23:place==='lake'?40:18;
    this.controls.enablePan = place === 'home' || place==='district' || place === 'park' || place === 'industrial' || place === 'market' || place === 'education' || place==='venue'||place==='spa'||place==='lake'|| isCareerPlace(place);
    this.frameSun(place === 'home');
    this.controls.maxDistance = this.place === 'district' ? (this.districtWide ? 132 : 96) : this.place==='home'?120:(this.place==='fitness'||this.place==='venue'||this.place==='lake')?88:51;
    this.controls.minDistance = 10;
    this.controls.maxPolarAngle = 1.25;
    this.refreshViewport();
    const remembered=place==='district'?undefined:this.savedCameras.get(place);
    if(remembered){
      this.manualCameraHeight=remembered.manualHeight;
      if(remembered.manualHeight)this.controls.maxPolarAngle=HEIGHT_MAX_POLAR;
      this.camera.position.copy(remembered.position);
      this.controls.target.copy(remembered.target);
      this.controls.update();
    }
    if(this.followingPlayer)this.setFollowPlayer(true);
    this.renderer.renderLists.dispose();
    this.lastSceneSwitchMs=performance.now()-switchStarted;
    this.sceneSwitches++;
  }

  private showCareerStation(id: CharacterId, shift: CareerShift): void {
    if (shift.mode === 'remote' && shift.homeDevice === 'desktop') {
      if(this.household?.furnishing.soldFixtures?.includes('desk')){
        const desk=this.household.furnishing.placed.find(item=>
          FURNITURE_BY_ID.get(item.sku)?.shape==='desk'&&!isNotebookDesk(item.sku));
        const target=desk&&furnitureUseLocation(this.household,id,desk.id,'deskJournal');
        if(!target)return;
        const pose=target.pose;
        this.actors[id].setFurniturePose('work',
          new THREE.Vector3(pose.x,pose.y,pose.z),pose.yaw,this.placedDeskKeys(target.item.id));
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
      const keyboard = [new THREE.Vector3(x+.16,.90,z-.025),new THREE.Vector3(x-.16,.90,z-.025)] as const;
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
    // One delivered cup lives on the actual desk while that same order is active.
    const worker=(['vlad','alina'] as const).find(id=>state.activeShifts[id]?.homeDevice==='desktop'&&state.activeShifts[id]?.coffeeServed);
    if(worker&&!state.furnishing.soldFixtures?.includes('desk')){
      if(!this.workCoffeeCup){this.workCoffeeCup=this.actors[worker==='vlad'?'alina':'vlad'].workCoffeeModel();this.homeScene.add(this.workCoffeeCup);}
      const recipe=state.activeShifts[worker]?.servedDrink,cold=!!recipe&&['bananaShake','berrySmoothie','orangeJuice','mintLemonade'].includes(recipe);const cup=this.workCoffeeCup;cup.getObjectByName('Cold glass')!.visible=cold;cup.getObjectByName('Drink handle')!.visible=!cold;cup.getObjectByName('Drink vessel')!.visible=!cold;const liquid=cup.getObjectByName('Drink liquid') as THREE.Mesh<THREE.CircleGeometry,THREE.MeshStandardMaterial>;liquid.material.color.setHex(recipe?HOME_DRINK_COLORS[recipe]??0x9b6332:0x9b6332);liquid.position.y=cold?.062:.0415;
      this.workCoffeeCup.position.set(WORK_COFFEE_DROP.x,WORK_COFFEE_DROP.y+(cold?.062:.0415),WORK_COFFEE_DROP.z);
      this.workCoffeeCup.visible=true;
    }else if(this.workCoffeeCup)this.workCoffeeCup.visible=false;
    if(!previous||previous.clock.day!==state.clock.day||previous.clock.minute!==state.clock.minute||JSON.stringify(previous.vacuum)!==JSON.stringify(state.vacuum))this.vacuumStamp=this.visualSeconds;
    this.dustArt.sync(state.homeDust);
    this.computerScreens.setHardware(installedElectronics(state,role,'desktop'),installedElectronics(state,role,'laptop'));
    this.homeEffects.setTv(installedElectronics(state,role,'tv'));
    for(const leaf of this.kitchenCurtains?.children??[]){
      if(leaf.name.startsWith('Curtain'))leaf.scale.x=state.kitchenCurtainsClosed?1:.25;
      if(leaf.name==='WindowSash')leaf.rotation.y=state.kitchenWindowOpen?1.05:0;
    }
    const coffee=installedElectronics(state,role,'coffee');
    for(const model of this.coffeeModels?.children[0]?.children??[])model.visible=model.userData.electronicsId===coffee;
    const furnishingKey = JSON.stringify([state.furnishing?.placed ?? [],state.furnishing?.soldFixtures??[]]);
    if(furnishingKey!==this.furnishedGeometryKey){
      const previousObstacles=[...this.obstacles];
      this.furnishedGeometryKey=furnishingKey;
      this.obstacles.splice(0,this.obstacles.length,...placeObstacles('home',state.furnishing));
      this.petGeometry=petNavigationGeometry(this.obstacles,HOME_FLOOR);
      for(const id of PET_IDS)this.pets[id].setHomeToyAvailability(this.petGeometry.obstacles,this.petGeometry.floor,state.pets[id].ownedToys);
      if(place==='home'&&!changed)for(const actor of Object.values(this.actors)){
        const pos=actor.root.position;
        if(pointIsClear(pos,previousObstacles,HOME_FLOOR)&&!pointIsClear(pos,this.obstacles,HOME_FLOOR)){
          const safe=nearestClearPoint(pos,this.obstacles,HOME_FLOOR);
          if(safe)pos.set(safe.x,0,safe.z);
        }
      }
    }
    const minute = gameMinutes(state.clock);
    // House NPCs share the server clock, without persisting visual-only traffic.
    if (reset || Math.abs(minute - this.neighborMinute) > 1.25) this.neighborMinute = minute;
    if (changed) this.switchPlace(place);
    if(place==='lake'&&this.remote)syncLakeTents(this.remote.stations,state.world.lake,gameMinutes(state.clock));
    this.setTimeOfDay(gameMinutes(state.clock));
    for (const id of ['vlad', 'alina'] as const) {
      // Both clients animate from the same authoritative household needs.
      this.actors[id].showLakeCatch(place==='lake'&&state.world.places[id]==='lake'?state.world.lake?.[id]?.catch:undefined);
      this.actors[id].setNeeds(state.characters[id],residentEmotion(state,id).id);
      if(id==='alina'){const v=state.vanity;this.actors[id].setCareAppearance(v?.hair&&v.hair.until>minute?v.hair.appearance??v.hair.id:'',v?.makeup&&v.makeup.until>minute?v.makeup.id:'');}
      this.actors[id].setPhoneModel(installedElectronics(state,id,'phone'));
      const offline = id !== role && !online.includes(id);
      const wasSleeping = this.sleepingOffline.has(id);
      if(state.characters[id].pose==='sleep')this.rememberedBeds.set(id,state.characters[id].sleepingOn??'starter');
      const work = state.careers.residents[id].shift;
      this.computerScreens.career(id,place==='home' && state.world.places[id]==='home'
        ? (work?.mode==='remote'?work.homeDevice??'laptop':state.activeShifts[id]?.homeDevice??null):null,state.activeShifts[id]?.homeDevice?state.activeShifts[id]?.job:undefined);
      const homeOrder=state.activeShifts[id]?.homeDevice?state.activeShifts[id]:undefined;
      const priorOrder=previous?.activeShifts[id]?.homeDevice?previous.activeShifts[id]:undefined;
      const previousWork = previous?.careers.residents[id].shift;
      const sleep = offline && place === 'home' && state.world.places[id]==='home' && !state.activeShifts[id] && !work;
      const away = (!!state.activeShifts[id]&&!homeOrder) || (offline&&!homeOrder ? !sleep : state.world.places[id] !== place);
      const appeared = !away && (!!previous?.activeShifts[id] || previous?.world.places[id] !== place);
      this.setAway(id, away);
      if (away || sleep) this.closeStorage(id);
      if (sleep && (!wasSleeping || reset || changed || !this.actors[id].isSleeping())) {
        this.sleepingOffline.add(id);
        const resident=state.characters[id];
        // A resident already in bed must not have their bed reassigned or be sent
        // to the gate just because a different player reentered the scene.
        const savedBed=resident.sleepingOn??this.rememberedBeds.get(id)??'starter';
        if(resident.pose==='sleep'&&bedPose(state,id,savedBed)) {
          this.restoreCharacter(id,resident.x,resident.z,'sleep',savedBed);
        }else{
          let bed=selectSleepBed(state,id,typeof savedBed==='number'?savedBed:undefined);
          if(!bed.ok&&typeof savedBed==='number')bed=selectSleepBed(state,id);
          if(bed.ok){
            this.rememberedBeds.set(id,bed.bed.id);
            this.restoreCharacter(id,bed.bed.approach.x,bed.bed.approach.z,'sleep',bed.bed.id);
          }else this.restoreCharacter(id,resident.x,resident.z,'idle');
        }
      } else if (!away && !sleep && (reset || changed || appeared || wasSleeping || (place==='cafe'&&state.characters[id].pose==='sit'&&previous?.characters[id].pose!=='sit')||(place==='home'&&previous?.characters[id].pose==='sleep'&&state.characters[id].pose!=='sleep'))) {
        const resident = state.characters[id];
        this.restoreCharacter(id, resident.x, resident.z, resident.pose);
      }
      if (!sleep) this.sleepingOffline.delete(id);
      if (!away && !sleep && work?.station && (reset || changed || appeared || work.station !== previousWork?.station ||
          work.task?.phase !== previousWork?.task?.phase && work.task?.phase !== 'walking')) {
        this.showCareerStation(id,work);
      }
      if(!away&&homeOrder&&place==='home'&&minute>=homeOrder.startedAt){
        this.computerScreens.career(id,homeOrder.homeDevice!,homeOrder.job);
        if(reset||changed||homeOrder.startedAt!==priorOrder?.startedAt||previous?.characters[id].pose!=='work'){
          this.actors[id].root.position.set(state.characters[id].x,0,state.characters[id].z);
          if(homeOrder.homeDevice==='laptop')this.laptopPose(id);
          else if(state.furnishing.soldFixtures?.includes('desk')){
            const desk=state.furnishing.placed.find(item=>FURNITURE_BY_ID.get(item.sku)?.shape==='desk'&&!isNotebookDesk(item.sku));
            const target=desk&&furnitureUseLocation(state,id,desk.id,'deskJournal');
            if(target){const p=target.pose;this.actors[id].setFurniturePose('work',new THREE.Vector3(p.x,p.y,p.z),p.yaw,this.placedDeskKeys(target.item.id));}
          }else this.applyFurniturePose(id,'desk','work');
          this.actors[id].setHomeWorkStyle(homeOrder.job);
        }
      }
      if(!away&&!homeOrder&&priorOrder){this.actors[id].setPose('idle');}
      if (!away && !work && previousWork?.mode === 'remote') this.actors[id].setPose('idle');
      if(place==='cafe'){
        const order=state.world.cafe[id], plate=this.meals.get(id)!;
        const station=stationById('cafe',order?.table);
        const visible=!!station&&!!order&&order.readyAt<=minute;
        if(visible){
          const key=order!.item+':'+order!.readyAt+':'+station!.id;
          if(!plate.visible||plate.userData.cafeKey!==key){
            this.showMeal(id,station!.center.x+(id==='vlad'?-.40:.40),1.01,station!.center.z-.10,order!.item);
            plate.userData.cafeKey=key;
          }
        }else if(plate.userData.cafeKey){plate.visible=false;delete plate.userData.cafeKey;}
      }
      const carryingThroughGate = !changed && place==='home' && this.bags[id].visible &&
        !inHomeGrounds(this.actors[id].root.position);
      this.bags[id].visible = !away && (state.world.bags[id] > 0 || carryingThroughGate);
    }
    const partner=role==='vlad'?'alina':'vlad';
    if(previous&&place==='home'&&previous.world.places[role]==='home'&&online.includes(partner)&&
      state.world.places[partner]==='home'&&
      (previous.world.places[partner]!=='home'||previous.activeShifts[partner]&&!previous.activeShifts[partner]?.homeDevice&&!state.activeShifts[partner]))
      this.actors[role].noticePartnerArrival();
    const dog = this.pets.verdell.root;
    const walker = state.world.dogWalker;
    dog.visible = walker ? (place === 'park'||place==='district'||place==='lake') && state.world.places[walker] === place && !state.activeShifts[walker] : place === 'home';
    this.pets.simba.root.visible = place === 'home';
    const vet=state.world.vetVisit;
    if(vet){const pet=this.pets[vet.pet];pet.root.visible=place==='work-clinic';if(place==='work-clinic'&&(changed||previous?.world.vetVisit?.pet!==vet.pet)){const c=state.characters[vet.owner],p=nearestClearPoint({x:c.x+.65,z:c.z-.3},this.currentObstacles(),floorFor(place));if(p){pet.stop();pet.syncGround(p.x,p.z);}}}
    // Signals come from authoritative shared stats, so both players see the
    // same warnings as the pet roams, sleeps or accompanies a dog walker.
    for (const id of PET_IDS) this.pets[id].setHungerLevel(petHungerLevel(state.pets[id].satiety));
    if (!walker && previous?.world.dogWalker) this.petRoutines.delete('verdell');
    if ((place === 'park'||place==='district'||place==='lake') && walker && (changed || previous?.world.dogWalker !== walker)) {
      const point = state.pets.verdell.parkPosition ?? this.actors[walker].root.position;
      dog.position.set(point.x, 0, point.z);
      this.dogTrail = [];
      this.lastDogPoint = null;
    }
    if(place==='lake'&&dog.visible&&previous&&((state.pets.verdell.treats?.used??0)>(previous.pets.verdell.treats?.used??0))){this.pets.verdell.react('treat');this.parkDogUntil=this.visualSeconds+5;this.lakeDogMode='';}
    if (place === 'home') {
      this.familyCar.visible=!state.world.carDriver;
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
      this.extensions.parcel.visible = state.world.deliveries.some(d => d.handedAt!==undefined);
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
      const station=feedingStation(state.furnishing,id),base=this.starterBowls[id],hit=this.bowlHits[id];
      const previous=this.feederVisual[id],reserve=state.pets[id].feederReserve?.length??0,servings=state.petBowls[id];
      const dropped=!!station.model?.capacity&&previous?.id===station.item?.id&&previous!==undefined&&reserve<previous.reserve&&servings>previous.servings;
      this.feederVisual[id]={reserve,servings,id:station.item?.id,started:dropped?this.visualSeconds:previous?.id===station.item?.id?previous?.started:undefined};
      if(base)base.visible=!station.item;if(hit){hit.visible=!station.item;hit.position.set(station.point.x,.145,station.point.z);}
      this.bowlFood[id].forEach((piece,index) => {const angle=index/PET_BOWL_CAPACITY*Math.PI*2;piece.position.set(station.point.x+Math.cos(angle)*.075,station.foodY,station.point.z+Math.sin(angle)*.075);piece.visible = index < state.petBowls[id]; });
      const pet = this.pets[id];
      pet.setHomeToyAvailability(this.petGeometry.obstacles,this.petGeometry.floor,state.pets[id].ownedToys);
      const candidate = state.pets[id].routine;
      const dogSite=candidate?.kind==='bedTogether'&&candidate.dogBed&&candidate.equipment?currentDogBed(state,candidate.equipment.id,candidate.dogBed.bed):undefined;
      const routine = candidate && (candidate.kind==='perch' &&
        (!candidate.perch||!currentCatPerch(state.furnishing,candidate.perch)) ||
        candidate.equipment&&!currentPetEquipment(state.furnishing,candidate.equipment)||candidate.kind==='bedTogether'&&!dogSite)
        ? undefined : candidate;
      if (!pet.root.visible || !routine) {
        this.petRoutines.delete(id);
        if (pet.root.visible&&!pet.audioMotion().reaction) {
          pet.stop();
          const position = state.pets[id].position;
          pet.syncGround(position.x,position.z);
        }
        continue;
      }
      const routineKey=routine.kind+':'+routine.startedAt+':'+routine.until+':' +
        (routine.perch?.key??'')+':'+(routine.goal?.x??'')+':'+(routine.goal?.z??'')+
        ':'+(routine.equipment?.id??'')+':'+(routine.manualToy?.owner??'')+':'+routine.target+
        (routine.kind==='eat'?':'+station.point.x+':'+station.point.z+':'+station.yaw:'');
      if (this.petRoutines.get(id) === routineKey) continue;
      this.petRoutines.set(id, routineKey);
      const distance = Math.max(0, clockMinutes(state.clock) - routine.startedAt) * PET_SPEED[id] / GAME_MINUTES_PER_REAL_SECOND;
      const route = sampleWalk(routine.route, distance);
      pet.syncGround(route.from.x,route.from.z);
      const scratchPoint=routine.kind==='scratch'&&routine.equipment?petScratchPoint(routine.equipment):undefined;
      const scratchFace=scratchPoint&&routine.goal
        ? Math.atan2(scratchPoint.x-routine.goal.x,scratchPoint.z-routine.goal.z):undefined;
      // Read support height once per route from the rotated physical model.
      // The server's X/Z, floor approach and attachment key still apply.
      const perch=routine.perch?currentCatPerch(state.furnishing,routine.perch):null;
      const bed=routine.kind==='sleep'?routine.equipment:undefined;
      let supportHeight: number | undefined;
      let support:THREE.Object3D|undefined;
      if(perch){
        const [scope,id]=perch.key.split(':');
        support=scope==='starter'&&(id==='sofa'||id==='bed')?this.staticFixtureModels.get(id)
          :this.furnishingModels.get(Number(id));
      }else if(bed) {
        support=this.furnishingModels.get(bed.id);
      }
      if(support){
        support.updateWorldMatrix(true,true);
        const at=perch?.surface??bed!;
        const origin=new THREE.Vector3(at.x,perch?perch.surface.y+.11:.25,at.z);
        const ray=new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0),0,.42);
        // Probe the seat itself, not a nearby tall armrest or back. The old
        // maximum-of-three could raise Simba onto a piece of the backrest.
        const side=perch?.yaw??0;
        const sideways=new THREE.Vector3(Math.cos(side),0,-Math.sin(side));
        const expected=perch?perch.surface.y-.085:0.16;
        const heights:number[]=[];
        for(const offset of [0,-.13,.13,-.23,.23]){
          ray.ray.origin.copy(origin).addScaledVector(sideways,offset);
          const y=ray.intersectObject(support,true).find(hit=>{
            for(let part:THREE.Object3D|null=hit.object;part;part=part.parent){
              if(!part.visible)return false;
              if(part===support)break;
            }
            return true;
          })?.point.y;
          if(y!==undefined&&(!perch||Math.abs(y-expected)<.21))
            heights.push(y);
        }
        // Median support resists cushion seams and decorative raised details.
        if(heights.length){
          heights.sort((a,b)=>a-b);
          supportHeight=heights[Math.floor(heights.length/2)];
        }
      }
      pet.followRoute(route.path.map(p => new THREE.Vector3(p.x, 0, p.z)), routine.kind,
        scratchFace??routine.training?.yaw??((routine.kind==='beg'||routine.kind==='event'&&(routine.event==='welcome'||routine.event==='blink'))&&routine.goal?Math.atan2(state.characters[routine.target===0?'vlad':'alina'].x-routine.goal.x,state.characters[routine.target===0?'vlad':'alina'].z-routine.goal.z):routine.kind==='toy'?0:routine.kind === 'eat' ? station.yaw : routine.kind === 'sleep' ? Math.PI / 2 : undefined),
        perch??undefined,
        routine.kind==='fetch'&&routine.fetchPoint?{
          point:routine.fetchPoint,
          pickupRemaining:Math.max(0,(routine.fetchPickupDistance??0)-distance),
        }:undefined,!!bed,supportHeight,scratchPoint,
        routine.startedAt,routine.kind==='toy'?routine.target:undefined,routine.training,routine.event,dogSite,routine.manualToy?.point);
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
    if(this.place==='home'&&!this.furnishingGhost&&this.navigation?.toyTap){this.raycaster.setFromCamera(ndc(clientX,clientY),this.camera);const target=this.raycaster.ray.intersectPlane(new THREE.Plane(THREE.Object3D.DEFAULT_UP,0),this.vector);if(target&&this.navigation.toyTap(target.x,target.z)){this.touchPulse(clientX,clientY,'select');return;}}
    const visible=(entry:THREE.Intersection)=>{
      for(let part:THREE.Object3D|null=entry.object;part;part=part.parent)
        if(!part.visible)return false;
      return true;
    };
    const meshes=this.place==='home'
      ? [...this.interactiveMeshes,...this.stationMeshes,...this.subjectMeshes,...(this.household&&courierVisit(this.household.world,this.neighborMinute)?.waiting?this.neighbors.courierMeshes():[])]
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
        // Do not search a wider ring once the nearer ring hit a target.
        if(nearest&&Math.abs(ox)===13)break;
        const px=clientX+ox,py=clientY+oy;
        if(px<bounds.left||px>=bounds.right||py<bounds.top||py>=bounds.bottom||document.elementFromPoint(px,py)!==this.canvas)continue;
        const candidate=intersections(px,py);
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
       id==='bowl:verdell'||id==='bowl:simba'||id==='dirtyDishes'){
      this.touchPulse(clientX,clientY,'select');
      this.onPick(id);
    } else if(typeof id==='string'&&id in objectNames){
      this.touchPulse(clientX,clientY,'select');
      this.onPick(id as ItemId);
    } else {
      this.raycaster.setFromCamera(ndc(clientX,clientY),this.camera);
      let surfacePoint:THREE.Vector3|undefined;
    if(this.speakerGhost&&this.household){let distance=Infinity;for(const s of speakerSurfaces(this.household.furnishing)){
      const hit=this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-s.y),new THREE.Vector3());if(!hit)continue;
      const a=s.rotation*Math.PI/2,dx=hit.x-s.x,dz=hit.z-s.z,u=dx*Math.cos(a)-dz*Math.sin(a),v=dx*Math.sin(a)+dz*Math.cos(a);
      const dist=hit.distanceTo(this.raycaster.ray.origin);if(Math.abs(u-s.u)<=s.w/2+.12&&Math.abs(v-s.v)<=s.d/2+.12&&dist<distance){distance=dist;surfacePoint=hit;}
    }}
    const point=surfacePoint??this.raycaster.ray.intersectPlane(
        new THREE.Plane(THREE.Object3D.DEFAULT_UP,0),this.vector);
      if(point&&pointIsClear(point,this.currentObstacles(),floorFor(this.place))){
        this.touchPulse(clientX,clientY,'walk');
        this.navigation?.ground(point.x,point.z);
      } else if(point&&this.place==='district'&&inDistrictPond(point)) {
        this.navigation?.pondTap?.();
      }
    }
  }

  private residentDistrictFrame(point:Point,compact:boolean):Frame {
    const target=new THREE.Vector3(point.x,.58,point.z);
    const axis=new THREE.Vector3(.38,1.17,1.14).normalize();
    return {target,position:target.clone().addScaledVector(axis,compact?18:22)};
  }

  private homeFrame(compact: boolean, band: ViewBand): Frame {
    if(this.place==='home')return portraitHomeFrame(this.camera.fov,this.camera.aspect,band);
    if(this.place==='district'){
      if(this.districtWide&&this.district)return portraitHomeFrame(this.camera.fov,this.camera.aspect,band,
        this.district.bounds,this.district.bounds,[.25,1.65,1.02],130);
      const resident=this.districtFocus ?? this.household?.characters[this.localRole] ?? districtArrival('home',this.localRole);
      const siteView=this.residentDistrictFrame(resident,compact);
      if(this.districtFocus&&resident.z>49){
        siteView.position.z=2*siteView.target.z-siteView.position.z;
      }
      return siteView;
    }
    if(this.place==='lake'){const p=this.household?.characters[this.localRole]??{x:-5,z:7};const target=new THREE.Vector3(p.x+2,.45,p.z-3);return {target,position:target.clone().add(new THREE.Vector3(-12,19,21))};}
    if(this.remote&&(this.place==='fitness'||this.place==='venue'))return portraitHomeFrame(this.camera.fov,this.camera.aspect,band,this.remote.horizontal,this.remote.vertical,[.12,1.12,1.0],88);
    if (this.remote && this.place === 'market')
      return portraitHomeFrame(this.camera.fov,this.camera.aspect,band,this.remote.horizontal,this.remote.vertical,[.14,1.09,1.0],88);
    if (compact && this.remote) return portraitHomeFrame(this.camera.fov, this.camera.aspect, band,
      this.remote.horizontal, this.remote.vertical, [.24, .98, 1.10],88);
    const fit = THREE.MathUtils.clamp((0.69 - this.camera.aspect) / (0.69 - portraitAspect), 0, 1);
    return { position: homePosition.clone().multiplyScalar(1 + fit * .35).add(locationTarget), target: locationTarget.clone() };
  }

  setPaused(value: boolean): void {
    if(value)stopUfcHighlight();
    this.paused = value;
    gameAudio.setPaused(value);
    this.lastFrame = performance.now();
  }

  private updateViewLens():void {
    const reference=this.place==='district' && this.districtWide && !this.inspected ? 34 : 23;
    this.camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(
      Math.tan(THREE.MathUtils.degToRad(reference))*Math.max(1,portraitAspect/this.camera.aspect)));
    this.camera.updateProjectionMatrix();
  }

  refreshViewport(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const compact = this.compactPortrait.matches;
    const { pixelRatio: initialRatio } = renderProfile(compact, window.devicePixelRatio);
    const pixelRatio = worldPixelRatio(compact, window.devicePixelRatio, initialRatio,
      this.place === 'home', this.quality, this.graphics);
    const band = this.viewBand(this.inspected !== null);
    const previous = this.viewport;
    const sizeChanged = !previous || previous.width !== width || previous.height !== height;
    const scaleChanged = !previous || previous.pixelRatio !== pixelRatio;
    if (!sizeChanged && !scaleChanged && previous.compact === compact &&
        previous.band.top === band.top && previous.band.bottom === band.bottom) return;
    this.viewport = { width, height, pixelRatio, compact, band };
    this.camera.userData.compactLow=compact&&this.quality==='low';

    if (sizeChanged) {
      this.camera.aspect = width / height;
      this.updateViewLens();
    }
    if (scaleChanged) this.renderer.setPixelRatio(pixelRatio);
    if (sizeChanged) this.renderer.setSize(width, height, false);
    if(this.manualCameraHeight)return;
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

  private photoRequest?:{resolve:(jpeg:string|null)=>void;timer:number};
  capturePhoto():Promise<string|null>{
    if(this.graphicsLost||document.hidden||this.fittingStage||this.carRide||this.photoRequest)return Promise.resolve(null);
    return new Promise(resolve=>{const timer=window.setTimeout(()=>{if(this.photoRequest){this.photoRequest=undefined;resolve(null);}},1500);this.photoRequest={resolve,timer};});
  }
  private finishPhoto(){
    const request=this.photoRequest;if(!request)return;this.photoRequest=undefined;window.clearTimeout(request.timer);
    try{
      const out=document.createElement('canvas'),scale=Math.min(1,640/Math.max(this.canvas.width,this.canvas.height));
      out.width=Math.max(1,Math.round(this.canvas.width*scale));out.height=Math.max(1,Math.round(this.canvas.height*scale));
      const ctx=out.getContext('2d');if(!ctx){request.resolve(null);return;}
      ctx.drawImage(this.canvas,0,0,out.width,out.height);
      for(const q of [.78,.62,.46,.32]){const data=out.toDataURL('image/jpeg',q),jpeg=data.split(',')[1];if(jpeg&&jpeg.length<=120000){request.resolve(jpeg);return;}}
      request.resolve(null);
    }catch{request.resolve(null);}
  }
  private animate = (): void => {
    requestAnimationFrame(this.animate);
    if (this.graphicsLost) return;
    const now = performance.now();
    // Keep paths in real time in a slow frame. A short cap still prevents a
    // jump when returning from a suspended tab.
    const elapsedMs=now-this.lastFrame;
    const {dt, qualitySample} = frameTiming(elapsedMs, this.paused, document.hidden);
    // Keep timed coffee choreography in step with the server even when a
    // mobile GPU drops frames. Paused/hidden/interrupted frames still freeze.
    const coffeeDt=dt>0?Math.min(elapsedMs/1000,1):0;
    this.lastFrame = now;
    if (document.hidden) return;
    if(this.carRide&&Date.now()<this.carRide.endsAt&&this.household){
      try{
        this.roadScene??=new CarRideScene();
        this.roadScene.frame(this.carRide,this.household.clock,this.canvas.width/Math.max(1,this.canvas.height));
        this.renderer.render(this.roadScene.scene,this.roadScene.camera);
        this.onRenderedFrame?.(now,this.renderer.info.render.calls,this.renderer.info.render.triangles,'car-ride');
        return;
      }catch(error){console.warn('Car ride scene fallback',error);this.carRide=undefined;}
    }
    this.visualSeconds += dt;
    if (qualitySample !== null) this.smoothedFrameMs = this.smoothedFrameMs * .97 + qualitySample * .03;
    if (qualitySample !== null && this.viewport?.compact && now - this.lastQualityUpdate > 8000) {
      this.lastQualityUpdate = now;
      const nextQuality = chooseGraphicsQuality(this.smoothedFrameMs, this.graphics, this.quality);
      if (nextQuality !== this.quality) {
        this.quality = nextQuality;
        this.refreshViewport();
      }
    }
    this.movementDt=dt;
    if(this.household){
      this.neighborMinute+=dt*GAME_MINUTES_PER_REAL_SECOND;
      const visit=courierVisit(this.household.world,this.neighborMinute);
      if(this.place==='home')this.neighborBodies=this.neighbors.updateCourier(this.neighborMinute,visit);
      else if(this.place==='district')this.neighborBodies=this.neighbors.update(this.neighborMinute,this.camera,visit?COURIER_INDEX:-1,visit??undefined);
      else if(this.place==='park')this.neighborBodies=[];
    }
    for (const id of ['vlad', 'alina'] as const) {
      const actor = this.actors[id];
      if (!actor.root.visible) continue;
      const venuePlay=this.place==='venue'?this.remote?.root.userData.venuePlay:undefined;
      if(venuePlay&&this.pairStages.get(id)?.playing){const game=venuePlay.game;const station=stationById('venue',venueStation(game))!;actor.setVenueFrame(game,station.center,Math.max(0,this.visualSeconds-venuePlay.started),venuePlay.match);}
      // Local, visual-only awareness for spontaneous glances. Never steer
      // people toward a pet/partner or change server gameplay state.
      const center = actor.root.position;
      const partnerId = id === 'vlad' ? 'alina' : 'vlad';
      const partner = this.actors[partnerId];
      const floatSelf=this.poolMotions.get(id)?.mode==='poolFloat'?this.homeTasks.get(id)?.furniturePose:undefined;
      const floatPartner=this.poolMotions.get(partnerId)?.mode==='poolFloat'?this.homeTasks.get(partnerId)?.furniturePose:undefined;
      const partnerYaw = floatSelf&&floatPartner?THREE.MathUtils.euclideanModulo(Math.atan2(floatPartner.x-floatSelf.x,floatPartner.z-floatSelf.z)-actor.root.rotation.y+Math.PI,Math.PI*2)-Math.PI:partner.root.visible && !this.sleepingOffline.has(partnerId) &&
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
      const chat=this.nearbyChat;
      const phase=chat?Math.floor((this.visualSeconds-chat.started)/3)%2:0;
      actor.setConversation(chat&&chat.until>this.visualSeconds&&partnerYaw!==null?partnerYaw:null,!!chat&&(phase===0?id===chat.from:id!==chat.from));
      if (!actor.isWalking()) resetResidentTraffic(this.collisionFlow[id]);
      if(this.place==='park'&&actor.isParkSwing())actor.parkSwing(Math.sin(this.visualSeconds*1.7)*.15);
      if(this.place==='park'&&this.badmintonStarted!==null&&this.pairStages.get(id)?.action==='parkBadminton'&&this.pairStages.get(id)?.playing){
        const s=stationById('park','park-badminton')!,f=badmintonPlayer(id,this.visualSeconds-this.badmintonStarted,this.homeTasks.get(id)?.pair?.badmintonWinner);
        actor.setBadmintonFrame(s.center.x+f.x,s.center.z+f.z,f.hit,f.height,f.aim);
      }
      if(this.place==='home'&&this.tennisStarted!==null&&this.pairStages.get(id)?.playing){
        const h=this.homeTasks.get(id),model=h?.furnitureId!==undefined?this.furnishingModels.get(h.furnitureId):undefined;
        if(model&&h?.pair?.item==='pingPong'){
          const f=tennisPlayer(id,this.visualSeconds-this.tennisStarted,h.pair.tennisWinner);
          const end=h.route.path.at(-1)??h.route.from,base=model.worldToLocal(new THREE.Vector3(end.x,0,end.z));
          let p=model.localToWorld(new THREE.Vector3(base.x+f.x,0,base.z));
          if(!pointIsClear(p,this.currentObstacles(),floorFor('home')))p=new THREE.Vector3(end.x,0,end.z);
          const target=f.strike?model.localToWorld(new THREE.Vector3(f.strike.x,f.strike.y,f.strike.z)):undefined;
          actor.setTennisFrame(p.x,p.z,f.hit,target);
        }
      }
      if(this.place==='lake'&&actor.audioMotion().activity==='spaSwim'){const f=lakeSwimFrame(actor.audioMotion().activityTime,id);actor.updateWaterAnchor(this.framePartPosition.set(f.x,f.y,f.z),f.yaw);}
      if(this.place==='spa'&&actor.audioMotion().activity==='spaSwim'&&this.remote?.root.userData.spaWaterUsers?.[id]==='spa-pool'){
        const s=stationById('spa','spa-pool')!,f=spaSwimFrame(actor.audioMotion().activityTime,id);
        actor.updateWaterAnchor(this.framePartPosition.set(s.center.x+f.x,f.y,s.center.z+f.z),f.yaw);
      }
      const pool=this.poolMotions.get(id),poolHome=this.homeTasks.get(id);
      if(this.place==='home'&&pool&&poolHome?.furniturePose){
        const p=poolHome.furniturePose;
        const model=poolHome.furnitureId!==undefined?this.furnishingModels.get(poolHome.furnitureId):undefined;
        const t=this.visualSeconds-pool.started;
        if(t<0){actor.update(dt,this.steering[id]);continue;}
        if(model&&t<POOL_ENTRY_SECONDS){
          const f=poolEntryFrame(t,id),n=poolEntryFrame(t+.04,id);
          const yaw=Math.atan2(n.x-f.x,n.z-f.z)+model.rotation.y;
          const anchor=model.localToWorld(this.framePartPosition.set(f.x,f.y,f.z));
          actor.updateWaterAnchor(anchor,yaw,true);
        }else{
          if(!pool.wet){pool.wet=true;actor.playDomesticActivity(pool.mode==='poolFloat'?'spaRecline':'spaSwim');}
          let yaw=p.yaw;
          const elapsed=Math.max(0,t-POOL_ENTRY_SECONDS-POOL_MOUNT_SECONDS);
          const anchor=this.framePartPosition.set(p.x,p.y+floatBob(this.visualSeconds,id),p.z);
          if(pool.mode==='poolSwim'&&model){const f=poolSwimFrame(elapsed,id);model.localToWorld(anchor.set(f.x,f.y,f.z));yaw=model.rotation.y+f.yaw;}
          if(model&&t<POOL_ENTRY_SECONDS+POOL_MOUNT_SECONDS){
            const entry=poolEntryFrame(POOL_ENTRY_SECONDS,id),start=model.localToWorld(this.frameShuttleDirection.set(entry.x,entry.y,entry.z));
            anchor.lerpVectors(start,anchor,THREE.MathUtils.smoothstep(t,POOL_ENTRY_SECONDS,POOL_ENTRY_SECONDS+POOL_MOUNT_SECONDS));
          }
          actor.updateWaterAnchor(anchor,yaw);
        }
      }
      const careTime=this.careElapsed.get(id);
      if(careTime!==undefined){const elapsed=careTime+coffeeDt;this.careElapsed.set(id,elapsed);actor.syncCareElapsed(Math.max(0,elapsed-dt));}
      actor.update(dt,this.steering[id],this.homeTasks.get(id)?.station==='workCoffee'?coffeeDt:dt);
      // The ceramic plate stays while its food gets smaller with each bite.
      // Inventory is only consumed by the server after the timed task finishes.
      const elapsed = actor.eatingElapsed();
      const plate = this.meals.get(id)!;
      if (plate.visible && elapsed !== null) {
        const media=this.homeTasks.get(id);
        const foodSeconds=media?.foodMs===undefined?undefined:media.foodMs/1000;
        const started=this.mediaFoodStarted.get(id);
        const mealElapsed=started===undefined?elapsed:Math.max(0,this.visualSeconds-started);
        const scale = mealServingScale(mealElapsed,foodSeconds??(this.place==='park'?PICNIC_SECONDS:undefined));

        plate.getObjectByName('Indoor serving')!.scale.setScalar(scale);
        plate.getObjectByName('Grilled serving')!.scale.setScalar(scale);
      }
      if (this.bags[id].visible) {
        if(this.place==='home'&&this.household?.world.bags[id]===0&&inHomeGrounds(actor.root.position))
          this.bags[id].visible=false;
        else this.followBag(this.bags[id], actor);
      }
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
    if(this.place==='home'&&this.extensions.gateLeaf){
      const gate=HOME_YARD.gate;
      const near=(p:Point)=>Math.hypot(p.x-gate.x,p.z-gate.z)<1.65;
      const courier=this.household?courierVisit(this.household.world,this.neighborMinute):null;
      const open=Object.values(this.actors).some(a=>a.root.visible&&near(a.root.position))||Boolean(courier?.place==='home'&&near(courier));
      this.extensions.gateLeaf.rotation.y=THREE.MathUtils.damp(this.extensions.gateLeaf.rotation.y,open?1.43:0,9,dt);
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
      prep.remaining -= this.homeTasks.get(role)?.station==='workCoffee'?coffeeDt:dt;
      if (prep.remaining <= 0) { this.preparations.delete(role); prep.next(); }
    }
    if (this.cart?.visible) this.followBag(this.cart, this.actors[this.localRole]);
    const walker = this.household?.world.dogWalker;
    const dog = this.pets.verdell;
    let pace = 0;
    if((this.place==='park'||this.place==='lake')&&walker&&dog.root.visible){
      const stamp=this.household?.world.parkDog?.toiletUntil??0;
      if(stamp&&stamp!==this.parkDogToiletStamp&&this.household&&stamp>clockMinutes(this.household.clock)){
        this.parkDogToiletStamp=stamp;this.lakeDogMode='';this.playParkDog('dogToilet',walker);
      }
      if(this.parkDogUntil&&this.visualSeconds>=this.parkDogUntil){dog.stop();this.parkDogUntil=0;this.dogTrail=[];this.lastDogPoint=null;}
    }
    if(this.place==='lake'&&walker&&dog.root.visible&&this.household&&this.parkDogUntil<=this.visualSeconds){
      const state=this.household,roles=['vlad','alina'] as const;
      const sleeper=roles.find(r=>this.actors[r].root.visible&&this.actors[r].audioMotion().pose==='sleep');
      const camp=Object.values(state.world.lake??{}).find(v=>v.pitch&&v.tent&&sleeper&&Math.hypot(this.actors[sleeper].root.position.x-stationById('lake',v.pitch)!.center.x,this.actors[sleeper].root.position.z-stationById('lake',v.pitch)!.center.z)<4);
      const eater=roles.find(r=>this.actors[r].root.visible&&this.actors[r].audioMotion().activity==='eat');
      const mode=camp&&sleeper?'sleep:'+camp.pitch:eater?'beg:'+eater:'';
      if(mode!==this.lakeDogMode){
        const prior=this.lakeDogMode;
        if(this.lakeDogMode){dog.stop();this.dogTrail=[];this.lastDogPoint=null;}
        this.lakeDogMode=mode;
        if(camp?.tent&&camp.pitch&&sleeper){const station=stationById('lake',camp.pitch)!,p=lakeSleepAnchor(camp.tent,sleeper);
          const start=nearestClearPoint(dog.root.position,this.currentObstacles(),floorFor('lake'));
          const end=approachFor(station,sleeper);
          const route=start&&findRoute(start,end,this.currentObstacles(),floorFor('lake'));
          if(route){dog.followRoute([...route.map(q=>new THREE.Vector3(q.x,0,q.z)),new THREE.Vector3(station.center.x,0,end.z),new THREE.Vector3(station.center.x,0,station.center.z+p.z+.13)],'sleep',Math.PI/2,undefined,undefined,true,.07);}
        }else if(prior.startsWith('sleep:')){const station=stationById('lake',prior.slice(6));if(station){const end=approachFor(station,walker);dog.followRoute([new THREE.Vector3(station.center.x,0,end.z),new THREE.Vector3(end.x,0,end.z)],'wander');this.parkDogUntil=this.visualSeconds+5;this.lakeDogMode='';}}else if(eater){const actor=this.actors[eater],body=actor.bodyPosition(new THREE.Vector3());
          const goal=nearestClearPoint({x:body.x,z:body.z+.9},this.currentObstacles(),floorFor('lake'));
          const start=nearestClearPoint(dog.root.position,this.currentObstacles(),floorFor('lake'));
          const route=start&&goal&&findRoute(start,goal,this.currentObstacles(),floorFor('lake'));
          if(route&&goal)dog.followRoute(route.map(q=>new THREE.Vector3(q.x,0,q.z)),'beg',Math.atan2(body.x-goal.x,body.z-goal.z));
        }
      }
    }
    if(this.place==='park'&&this.agilityOwner&&this.agilityAction&&this.agilityWaiting&&dog.root.visible){const wait=this.agilityWaiting;if(Math.hypot(dog.root.position.x-wait.entry.x,dog.root.position.z-wait.entry.z)<.045&&(this.agilityCueOwner===this.agilityOwner||this.visualSeconds>=wait.releaseAt)){const action=this.agilityAction;this.agilityWaiting=undefined;dog.followRoute(agilityPath(action).slice(1).map(p=>new THREE.Vector3(p.x,0,p.z)),'wander');dog.setAgility(action);}}
    if (walker && dog.root.visible && (this.place === 'park'||this.place==='district'||this.place==='lake') && !((this.place==='park'||this.place==='lake')&&this.parkDogUntil>this.visualSeconds) && !(this.place==='lake'&&this.lakeDogMode)) {
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
        const next = {x: dog.root.position.x + dx * step, z: dog.root.position.z + dz * step};
        if (pointIsClear(next, this.currentObstacles(), floorFor(this.place))) {
          const moved=Math.hypot(next.x-dog.root.position.x,next.z-dog.root.position.z);
          const yaw=Math.atan2(dx,dz);
          const turn=Math.atan2(Math.sin(yaw-dog.root.rotation.y),Math.cos(yaw-dog.root.rotation.y));
          dog.root.rotation.y+=turn*(1-Math.exp(-dt*13));
          dog.root.position.set(next.x, 0, next.z);
          this.dogTravel += moved;
          pace=petStepPace(moved,dt,1.8,1);
        }
      }
    }
    const vet=this.household?.world.vetVisit;
    if(vet&&this.place==='work-clinic'){
      const pet=this.pets[vet.pet],c=this.actors[vet.owner].root.position,p=pet.root.position;
      const target={x:c.x+.55,z:c.z-.22};const distance=Math.hypot(target.x-p.x,target.z-p.z);
      if(distance>.18){const step=Math.min(1,dt*2.5),next={x:p.x+(target.x-p.x)*step,z:p.z+(target.z-p.z)*step};if(pointIsClear(next,this.currentObstacles(),floorFor(this.place))){pet.root.rotation.y=Math.atan2(target.x-p.x,target.z-p.z);pet.root.position.set(next.x,0,next.z);}}
    }
    if (this.household) {
      for (const id of PET_IDS) {
        const pet = this.household.pets[id];
        let owner:THREE.Vector3|undefined,ownerGap=2.8;
        const assigned=pet.routine&&(pet.routine.kind==='beg'||pet.routine.kind==='event'&&(pet.routine.event==='welcome'||pet.routine.event==='blink'))
          ?pet.routine.target===0?'vlad':'alina':undefined;
        if(this.place==='home')for(const role of ['vlad','alina'] as const){
          if(assigned&&assigned!==role)continue;
          const resident=this.actors[role],point=resident.root.position;
          if(!resident.root.visible||this.sleepingOffline.has(role)||this.household.world.places[role]!=='home'||
            this.household.activeShifts[role]||this.household.characters[role].pose==='sleep')continue;
          const gap=Math.hypot(point.x-this.pets[id].root.position.x,point.z-this.pets[id].root.position.z);
          if(gap<ownerGap){owner=point;ownerGap=gap;}
        }
        // Keep seated diners eligible, but do not greet somebody behind a wall.
        const nearby=!!owner&&(!!assigned||segmentIsClear(this.pets[id].root.position,owner,this.petGeometry.obstacles,this.petGeometry.floor));
        this.pets[id].lookAtOwner(nearby?owner:undefined);
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
      // A rare mutual acknowledgment, only if both are free and have a
      // clear line between them. Never invent social navigation or rewards.
      const petGap=Math.hypot(cat.root.position.x-dog.root.position.x,cat.root.position.z-dog.root.position.z);
      const near=petGap>=.85&&petGap<=1.55;
      const clear=petGap<=2&&segmentIsClear(dog.root.position,cat.root.position,geometry.obstacles,geometry.floor);
      dog.watchCompanion(cat.root.position,clear);cat.watchCompanion(dog.root.position,clear);
      if(near&&clear&&dog.canGreetCompanion()&&cat.canGreetCompanion()){
        dog.greetCompanion(cat.root.position);cat.greetCompanion(dog.root.position);
      }
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
    if(this.cameraQA&&this.agilityAction&&!this.agilityWaiting&&this.agilityQAExit!==this.agilityAction){const end=agilityPath(this.agilityAction).at(-1)!;if(Math.hypot(dog.root.position.x-end.x,dog.root.position.z-end.z)<.10)this.agilityQAExit=this.agilityAction;}
    const manualCat=this.place==='home'?this.household?.pets.simba.routine?.manualToy:undefined;
    for(const role of ['vlad','alina'] as const){const actor=this.actors[role];if(manualCat?.owner===role&&actor.root.visible){const p=this.framePartPosition,kind=cat.manualToyContact(p);if(kind){actor.manualCatToy(kind,p,segmentIsClear(actor.root.position,p,this.petGeometry.obstacles,this.petGeometry.floor));continue;}}actor.manualCatToy();}
    if (this.place === 'home') for (const [id, door] of this.extensions.doors) {
      const open = this.openDoors.get('vlad') === id || this.openDoors.get('alina') === id;
      door.rotation.y = THREE.MathUtils.damp(door.rotation.y, open ? -1.53 : 0, 11, dt);
    }
    if(this.careReframe){const role=this.careReframe,actor=this.actors[role],motion=actor.audioMotion();if(this.inspected!==role||!this.homeTasks.has(role)||!['vanity','bath'].includes(motion.activity??''))this.careReframe=null;else if(motion.activityTime>=1.15){this.careReframe=null;this.showcase(role);}}
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
    if(this.followingPair){
      // Actors may move several metres between the opt-in tap and reaching
      // their station. Follow their midpoint rather than a frozen click position.
      if(this.place!=='home'||!this.actors.vlad.root.visible||!this.actors.alina.root.visible){
        this.followingPair=false;
      }else{
        const v=this.actors.vlad.root.position,a=this.actors.alina.root.position;
        const gap=Math.hypot(v.x-a.x,v.z-a.z);
        this.pairCameraTarget.set((v.x+a.x)/2,1.06,(v.z+a.z)/2);
        this.pairCameraEye.copy(this.pairCameraTarget).addScaledVector(
          this.pairCameraDirection,THREE.MathUtils.clamp(8.3+gap*1.3,9.1,17.5));
        const poolHome=this.homeTasks.get(this.localRole),poolModel=poolHome?.furnitureId!==undefined?this.furnishingModels.get(poolHome.furnitureId):undefined;
        if(poolModel&&this.stableParts.get(poolModel,'Oasis water surface')){
          // Frame the entire pool, not the two invisible floor approach roots.
          this.pairCameraTarget.copy(poolModel.position);this.pairCameraTarget.y=.72;
          this.pairCameraEye.set(.24,1.10,1).normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP,poolModel.rotation.y)
            .multiplyScalar(this.compactPortrait.matches?20:14).add(this.pairCameraTarget);
        }
        if(poolHome?.station==='yardTable'||poolHome?.pair?.seat==='yardTable'){
          this.pairCameraTarget.set(HOME_PLACEMENTS.yardTable.x-.48,.95,HOME_PLACEMENTS.yardTable.z+.18);
          this.pairCameraEye.set(.95,.83,-.85).normalize().multiplyScalar(this.compactPortrait.matches?12.4:10.4).add(this.pairCameraTarget);
        }
        const fraction=1-Math.exp(-dt*5.5);
        if(this.manualCameraHeight){
          this.followDelta.copy(this.manualPairAnchor);
          this.manualPairAnchor.lerp(this.pairCameraTarget,fraction);
          this.followDelta.subVectors(this.manualPairAnchor,this.followDelta);
          this.controls.target.add(this.followDelta);
          this.camera.position.add(this.followDelta);
        }else{
          this.controls.target.lerp(this.pairCameraTarget,fraction);
          this.camera.position.lerp(this.pairCameraEye,fraction);
        }
        this.cameraMove=null;
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
    this.updatePanFeel();
    this.controls.update();
    if(this.manualCameraHeight)protectCameraFloor(this.camera.position,this.controls.target);
    if(this.cameraQA&&this.place==='home'&&new URLSearchParams(location.search).get('needMotionQA')==='1'){
      this.canvas.dataset.needMotionState=JSON.stringify({vlad:this.actors.vlad.needReactionQA(),alina:this.actors.alina.needReactionQA()});
    }
    if(this.cameraQA&&this.place==='home'&&new URLSearchParams(location.search).get('petMotionQA')==='1'){
      const command=this.canvas.dataset.petMotion;
      if(command){
        delete this.canvas.dataset.petMotion;
        const [id,gesture]=command.split(':');
        if(id==='verdell'||id==='simba')this.pets[id].previewPerformanceQA(gesture);
      }
      this.canvas.dataset.petMotionState=JSON.stringify({verdell:this.pets.verdell.performanceQA(),simba:this.pets.simba.performanceQA()});
    }
    if(this.cameraQA&&this.place==='home'&&new URLSearchParams(location.search).get('cozyQA')==='1'){
      const model=this.furnishingModels.get(Number(this.canvas.dataset.cozyView));
      if(model){const def=FURNITURE_BY_ID.get(model.userData.sku);const center=model.localToWorld(new THREE.Vector3(0,(def?.height??1)*.5,0));this.controls.target.copy(center);this.camera.position.copy(center).add(new THREE.Vector3(1.7,1.9,3.2));this.camera.lookAt(center);}
    }
    if(this.cameraQA&&this.place==='home'&&new URLSearchParams(location.search).get('hobbyQA')==='1'){
      const id=Number(this.canvas.dataset.hobbyView),model=this.furnishingModels.get(id);
      if(model){const target=model.localToWorld(new THREE.Vector3(0,.95,.25));this.controls.target.copy(target);this.camera.position.copy(model.localToWorld(new THREE.Vector3(2.4,2.6,3.8)));this.camera.lookAt(target);}
    }
    if(this.cameraQA&&this.place==='home'&&new URLSearchParams(location.search).get('holidayQA')==='1'){
      const v=this.canvas.dataset.holidayView;
      if(v==='tree'){this.controls.target.set(-4.9,1.15,8.05);this.camera.position.set(.9,5.7,13.3);this.camera.lookAt(this.controls.target);}
      this.canvas.dataset.holidayTree=String(this.festiveTree.visible);
    }
    if(this.cameraQA&&new URLSearchParams(location.search).get('shopDetailQA')==='1'){
      const v=this.canvas.dataset.shopDetailView;
      const views:Partial<Record<PlaceId,Record<string,{target:[number,number,number];eye:[number,number,number]}>>>={
        cafe:{rear:{target:[0,1.3,-4.05],eye:[.2,4.0,5.1]},fixture:{target:[3.5,1.05,-2.5],eye:[5.05,2.9,1.1]}},
        petshop:{rear:{target:[0,1.25,-2.85],eye:[.2,4.2,4.8]},fixture:{target:[-3.75,1.22,-2.65],eye:[-2.8,2.8,.65]}},
        clothing:{rear:{target:[0,1.15,-3.65],eye:[.5,4.1,5.3]},fixture:{target:[-3.75,.95,-2.55],eye:[-2.75,3.0,1.25]}},
        electronics:{rear:{target:[0,1.15,-3.2],eye:[.1,4.1,5.8]},fixture:{target:[0,1.0,-2.65],eye:[1.05,3.0,.95]}},
        venue:{rear:{target:[-.7,1.0,-3.8],eye:[.2,6.6,9.3]},fixture:{target:[6.9,1.05,-1.8],eye:[9.3,4.4,4.6]}},
        fitness:{rear:{target:[-2,.85,-4.45],eye:[-1,5.7,6.5]},fixture:{target:[5.05,.95,5.65],eye:[3.0,3.5,1.9]}},
        spa:{rear:{target:[-.8,.75,-3.5],eye:[.1,6.8,7.5]},fixture:{target:[7.4,.95,-3.3],eye:[8.9,3.5,1.6]}},
        barber:{rear:{target:[0,1.1,-3.4],eye:[.3,4.2,5.0]},fixture:{target:[-5.3,1.25,0],eye:[.4,3.7,2.8]}},
        clinic:{rear:{target:[0,1.0,-3.4],eye:[.25,4.2,5.2]},fixture:{target:[3.7,.95,-2.9],eye:[5.15,3.5,1.7]}},
        education:{rear:{target:[0,1,-3.4],eye:[.2,4.2,5.3]},fixture:{target:[-4.25,1.05,-4.7],eye:[-2.95,2.7,-.6]}},
        'work-it':{rear:{target:[0,1,-3.4],eye:[.2,4.2,5.3]},fixture:{target:[-3.9,1,-4.7],eye:[-2.6,2.8,-.4]}},
        'work-detail':{rear:{target:[0,1,-3.4],eye:[.2,4.2,5.3]},fixture:{target:[2.9,.65,-1.38],eye:[4.5,3.8,3.9]}},
        'work-marketing':{rear:{target:[0,1,-3.4],eye:[.2,4.2,5.3]},fixture:{target:[3.88,1.0,-4.7],eye:[4.85,2.9,-.3]}},
        'work-clinic':{rear:{target:[0,1,-3.4],eye:[.2,4.2,5.3]},fixture:{target:[-3.9,1,-4.7],eye:[-2.7,2.8,-.4]}},
        industrial:{rear:{target:[0,1.6,-2.6],eye:[.2,7.5,12]},fixture:{target:[-4.65,1.3,-.4],eye:[-2.9,3.9,5.2]}},
        market:{rear:{target:[-5.8,1.4,-1.5],eye:[1.2,3.9,2.1]},fixture:{target:[0,.9,1.85],eye:[1.3,3.1,5.2]}},
        park:{rear:{target:[2.52,.1,3.75],eye:[4.5,6.1,8.5]},fixture:{target:[-2.68,.1,.37],eye:[-.5,4.8,5.0]}},
        lake:{rear:{target:[-10,.3,-8],eye:[-6.9,5.2,-2.4]},fixture:{target:[3.3,.15,4],eye:[.5,4.3,8.2]}},
      };
      const view=v?views[this.place]?.[v]:undefined;
      if(view){this.controls.target.set(...view.target);this.camera.position.set(...view.eye);this.camera.lookAt(this.controls.target);}
    }
    if(this.cameraQA&&this.place==='home'&&this.canvas.dataset.catHandView==='wide'){const owner=this.household?.pets.simba.routine?.manualToy?.owner??'vlad',p=this.actors[owner].root.position,point=this.household?.pets.simba.routine?.manualToy?.point??p;const x=(p.x+point.x)/2,z=(p.z+point.z)/2;this.controls.target.set(x,.45,z);this.camera.position.set(x+2.3,3.8,z+4.4);this.camera.lookAt(this.controls.target);}
    if(this.cameraQA&&this.place==='park'&&new URLSearchParams(location.search).get('agilityQA')==='1'){const action=this.canvas.dataset.agilityView;if(action==='overview'){this.controls.target.set(4.9,.12,4.0);this.camera.position.set(4.9,13.4,1.3);this.camera.lookAt(this.controls.target);}else if(isDogAgility(action)){const d=DOG_AGILITY[action];this.controls.target.set(d.x,.28,d.z);this.camera.position.set(d.x+1.4,3.8,d.z-2.7);this.camera.lookAt(this.controls.target);}}
    if(this.cameraQA&&new URLSearchParams(location.search).get('worldArtQA')==='1'){
      const view=this.place==='home'?{target:[3,.1,1],eye:[13,22,22]}:this.place==='district'?{target:[21.38,.1,21.05+DISTRICT_OFFSET_Z],eye:[26,8,29+DISTRICT_OFFSET_Z]}:this.place==='park'?{target:[1.6,.1,-.8],eye:[7.7,10.6,12]}:this.place==='electronics'?{target:[2.5,0,-.7],eye:[8.2,12,16]}:['market','cafe','petshop','clothing','education'].includes(this.place)?{target:[0,.1,-.5],eye:[6.5,11,14]}:undefined;
      if(view){this.controls.target.set(...view.target as [number,number,number]);this.camera.position.set(...view.eye as [number,number,number]);this.camera.lookAt(this.controls.target);}
    }

    if(this.cameraQA&&new URLSearchParams(location.search).get('waterFireQA')==='1'){
      const view=this.place==='home'?{target:[-9.95,.5,8.1],eye:[-6.0,5.6,15.2]}:this.place==='spa'?{target:[-3.8,.22,-2.8],eye:[1.2,6.6,4.7]}:this.place==='park'?{target:[8.45,.42,-2.4],eye:[10.8,2.4,1.3]}:this.place==='district'?{target:[21.38,.12,21.05+DISTRICT_OFFSET_Z],eye:[24.3,4.4,25.9+DISTRICT_OFFSET_Z]}:undefined;
      if(view){this.controls.target.set(...view.target as [number,number,number]);this.camera.position.set(...view.eye as [number,number,number]);this.camera.lookAt(this.controls.target);}
    }

    if(this.cameraQA&&this.place==='home'&&new URLSearchParams(location.search).get('sideWallsQA')==='1'){
      const v=this.canvas.dataset.wallView;
      const view=v==='yard-close'?{target:[-4.1,.55,7.8],eye:[-2.4,3.8,12.9]}:v==='yard-parking'?{target:[13.6,.5,9.3],eye:[16.9,5.1,15.2]}:v==='yard-lawn'?{target:[-9.4,.15,9.2],eye:[-7.9,2.1,12.6]}:v==='yard-wide'?{target:[4,.15,9],eye:[4,21,30]}:v==='west'?{target:[-5,1,-1],eye:[-21,8,7]}:v==='east'?{target:[11,1,-1],eye:[26,8,7]}:v==='front'?{target:[3,0,-1],eye:[3,21,24]}:v==='bedroom'?{target:[-7,1,-4],eye:[-13,3,-.4]}:v==='study'?{target:[7.2,1.1,-5.5],eye:[4.8,4.7,.0]}:v==='wing'?{target:[12.6,1,-1.7],eye:[19,7,5.4]}:v==='passages'?{target:[-4.35,1,.2],eye:[.2,3.8,5.8]}:v==='kitchen'?{target:[2.04,1.47,-6.8],eye:[2.0,2.7,-2.8]}:v==='bath'?{target:[8.25,1.10,.5],eye:[5.5,2.9,2.8]}:v==='basin'?{target:[5.98,1.30,-.44],eye:[6.05,2.55,2.2]}:v==='wc'?{target:[-8.3,.6,3.6],eye:[-5.8,2.3,4.3]}:v==='living'?{target:[-2.36,.70,1.65],eye:[.6,3.2,-2.8]}:v==='bed-detail'?{target:[-6.97,.80,-5.7],eye:[-4.9,3.0,-2.6]}:undefined;
      if(view){this.controls.target.set(...view.target as [number,number,number]);this.camera.position.set(...view.eye as [number,number,number]);this.camera.lookAt(this.controls.target);}
    }
    if(this.cameraQA&&this.place==='lake'&&new URLSearchParams(location.search).get('lakeQA')==='1'){
      const v=this.canvas.dataset.lakeView;
      const view=v==='rental'?{target:[-10,1.2,9],eye:[-8.8,3.1,13.4]}:v==='swim'?{target:[7.8,.10,10],eye:[2.4,5.1,13.3]}:v==='dog'?{target:[-2.7,.45,8.6],eye:[-6.2,5.4,14.4]}:v==='sleep'?{target:[-4,.30,-7.7],eye:[-1.1,9.7,-2.1]}:v==='fishing'?{target:[4.45,.65,-6],eye:[.35,2.4,-2.85]}:v==='catch'?{target:[3.35,1.05,-6],eye:[5.55,1.9,-3.15]}:v==='camp'?{target:[-4,.65,-6],eye:[-1.6,3.8,.7]}:v==='fire'?{target:[-4,.72,-4],eye:[-4.2,3.8,2.6]}:v==='shore'?{target:[8.4,.10,-3],eye:[1.1,5.3,3.1]}:v==='water'?{target:[13,.04,1.5],eye:[3.8,6.1,9.2]}:undefined;
      if(view){this.controls.target.set(...view.target as [number,number,number]);this.camera.position.set(...view.eye as [number,number,number]);this.camera.lookAt(this.controls.target);}
    }
    if(this.place==='lake'&&this.remote){const occupied=new Set<string>();for(const r of ['vlad','alina'] as const){const actor=this.actors[r];if(!actor.root.visible||actor.audioMotion().pose!=='sleep')continue;for(const [id,g] of this.remote.stations)if(g.userData.tents&&Math.hypot(actor.root.position.x-g.position.x,actor.root.position.z-g.position.z)<2.5)occupied.add(id);}syncLakeCutaway(this.remote.stations,occupied);}
        if(this.place==='home'){
      this.sideWalls.update(this.camera.position.x,this.controls.target.x);
      if(this.cameraQA){
        this.canvas.dataset.sideWalls=JSON.stringify(this.sideWalls.walls.map(w=>[w.side,w.upper.visible,w.cutCap.visible]));
        this.canvas.dataset.cottageLampLevel=String((this.cottageLamps?.bedroom.intensity??0)/10);
        this.canvas.dataset.yardLamps=this.yard.night.visible?'on':'off';
      }
      this.yard.landscape.detail(this.camera,this.quality==='low');
      this.yard.landscape.animate(this.visualSeconds,this.yardSnow,this.weather.visualKind==='storm'?2.4:this.weather.visualKind==='rain'?1.5:1);
    }
    if(this.cameraQA){this.canvas.dataset.cameraPose=JSON.stringify({eye:this.camera.position.toArray(),target:this.controls.target.toArray(),fov:this.camera.fov,aspect:this.camera.aspect,quaternion:this.camera.quaternion.toArray(),follow:this.followingPlayer,pair:this.followingPair,place:this.place});this.canvas.dataset.yardQA=JSON.stringify({lakeDog:{mode:this.lakeDogMode,agility:this.agilityAction,waiting:!!this.agilityWaiting,entered:this.agilityAction!==undefined&&!this.agilityWaiting,exit:this.agilityQAExit,visible:this.pets.verdell.root.visible,position:this.pets.verdell.root.position.toArray(),gesture:this.pets.verdell.currentIdleGesture()},actors:Object.fromEntries((['vlad','alina'] as const).map(r=>[r,{look:this.actors[r].root.userData.wornLook,body:this.actors[r].bodyPosition(new THREE.Vector3()).toArray(),yaw:this.actors[r].root.rotation.y,pose:this.actors[r].audioMotion().pose,activity:this.actors[r].audioMotion().activity,spaWater:this.remote?.root.userData.spaWaterUsers?.[r],spaMassage:this.remote?.root.userData.spaMassages?.[r],spaShower:this.remote?.root.userData.spaShowers?.[r],station:this.homeTasks.get(r)?.station,hookah:this.actors[r].hookahQA(),coffee:this.actors[r].workCoffeeQA(),handheld:this.actors[r].handheldQA(),catToy:this.actors[r].catToyQA(),kitchen:this.actors[r].kitchenQA(),care:this.actors[r].careQA(),drink:this.actors[r].drinkQA()}])),workCoffeeDesk:!!this.workCoffeeCup?.visible,grass:this.yard.landscape.sectors.reduce((n,m)=>n+(m.visible?m.count:0),0)});}
    if(this.visualSeconds-this.lampStamp>.25||this.place!=='home'){
      this.lampStamp=this.visualSeconds;
      this.ownedLampGlow.intensity=0;this.ownedLampGlow.userData.id=null;
      if(this.place==='home'&&this.household){
        let nearest=Infinity;
        for(const p of this.household.furnishing.placed){
          const def=FURNITURE_BY_ID.get(p.sku);
          if(def?.shape!=='lamp'||p.lightMode==='off')continue;
          const level=lampLevel(p.lightMode,this.lampNight);
          if(level<=.04)continue;
          const distance=Math.hypot(p.x-this.controls.target.x,p.z-this.controls.target.z);
          if(distance>=nearest)continue;nearest=distance;
          this.ownedLampGlow.position.set(p.x,(this.furnishingModels.get(p.id)?.position.y??0)+def.height*.80,p.z);
          this.ownedLampGlow.intensity=level*9;this.ownedLampGlow.userData.id=p.id;
        }
      }
    }
    if(this.cameraQA)this.canvas.dataset.ownedLamp=JSON.stringify({id:this.ownedLampGlow.userData.id,level:this.ownedLampGlow.intensity/9});
    if (this.place === 'home') {
      if(this.household){
        const item=vacuumItem(this.household),v=item&&vacuumState(this.household,item);
        const model=item&&this.furnishingModels.get(item.id),body=this.stableParts.get(model,'Vacuum moving body');
        if(v&&body&&model){
          const active=v.mode==='cleaning'||v.mode==='returning';
          const sampled=active?sampleWalk({from:v.position,path:v.route},Math.min(4,Math.max(0,this.visualSeconds-this.vacuumStamp))*GAME_MINUTES_PER_REAL_SECOND*VACUUM_MODELS[item.sku as VacuumSku].speed):{from:v.position,path:[]};
          const target=model.worldToLocal(this.framePartPosition.set(sampled.from.x,.01,sampled.from.z));
          target.y=0;body.position.copy(target);
          if(sampled.path.length){const next=sampled.path[0];body.rotation.y=Math.atan2(next.x-sampled.from.x,next.z-sampled.from.z)-model.rotation.y;}
          else if(v.mode==='docked')body.rotation.y=0;
        }
      }
      for(const [id,model] of this.furnishingModels){
        const sku=model.userData.sku;
        if(sku==='hobby-workbench'){
          const keys=['buildCottage','buildCar'];
          const active=[...this.hobbyWorks.values()].find(w=>w.id===id);
          const previous=this.household?.familyLife?.displayWorks?.[String(id)];
          const elapsed=active?this.visualSeconds-active.start:Infinity;
          const shown=active?(elapsed>=.35?active.action:undefined):previous;
          for(const key of keys){const result=this.stableParts.get(model,'Hobby result '+key);if(result){result.visible=key===shown;if(result.visible)for(let stage=0;stage<3;stage++){const part=this.stableParts.get(result,'Hobby stage '+stage);if(part)part.visible=elapsed>=[.35,7,17][stage];}}}
          if(this.cameraQA&&Number(this.canvas.dataset.hobbyView)===id)this.canvas.dataset.hobbyResult=shown??'';
        }
        const water=this.stableParts.get(model,'Oasis water surface');
        if(water instanceof THREE.Mesh&&water.material instanceof THREE.ShaderMaterial)updateWater(water.material,this.visualSeconds,1-THREE.MathUtils.smoothstep(this.sun.intensity,.35,1.9));
        const raftV=this.stableParts.get(model,'Oasis float vlad');
        if(raftV){const swim=[...this.poolMotions.entries()].some(([r,p])=>p.mode==='poolSwim'&&this.homeTasks.get(r)?.furnitureId===id);
          for(const r of ['vlad','alina'] as const){const raft=this.stableParts.get(model,'Oasis float '+r);if(raft){raft.position.y=floatBob(this.visualSeconds,r);raft.visible=!swim;}}}
        const ball=this.stableParts.get(model,'Table tennis live ball');if(!ball)continue;
        const h=[...this.homeTasks.values()].find(h=>h.furnitureId===id&&h.pair?.item==='pingPong');
        const playing=this.tennisStarted!==null&&!!h&&[...this.pairStages.values()].some(p=>p.playing&&p.action==='leisureTogether');
        ball.visible=playing;const resting=this.stableParts.get(model,'Table tennis resting equipment');if(resting)resting.visible=!playing;
        if(playing){const f=tennisBall(this.visualSeconds-this.tennisStarted!,h!.pair!.tennisWinner);ball.position.set(f.x,f.y,f.z);}
      }
      for(const id of PET_IDS){const visual=this.feederVisual[id];if(visual?.started===undefined||!this.household)continue;const station=feedingStation(this.household.furnishing,id);const elapsed=this.visualSeconds-visual.started;if(elapsed>=.8||visual.id!==station.item?.id)delete visual.started;
        this.bowlFood[id].forEach((piece,index)=>{const angle=index/PET_BOWL_CAPACITY*Math.PI*2,t=THREE.MathUtils.clamp((elapsed-index*.10)/.42,0,1),arc=1-t*t;piece.position.set(station.point.x+Math.cos(angle)*.075*t+Math.sin(station.yaw)*.12*(1-t),station.foodY+.14*arc,station.point.z+Math.sin(angle)*.075*t+Math.cos(station.yaw)*.12*(1-t));});}
      if(this.bathWashing)this.homeEffects.dogBath(this.pets.verdell.bathPhase);
      const bathElapsed=this.actors.alina.bathBombSample(this.framePartPosition);if(bathElapsed!==null)this.homeEffects.updateBathCare(bathElapsed,this.framePartPosition);
      this.homeEffects.update(this.visualSeconds);
      this.computerScreens.update(this.visualSeconds);
    }
    this.weather.frame(this.visualSeconds,this.controls.target,this.renderer.getPixelRatio());
    if(this.place==='district')this.district?.animate(this.visualSeconds,this.camera);
    if(this.place==='spa'&&this.remote){
      const guests:{x:number;z:number;yaw:number;station:string}[]=[];
      for(const id of ['vlad','alina'] as const){
        const station=this.remote.root.userData.spaWaterUsers?.[id],actor=this.actors[id];
        if(!station||!actor.root.visible)continue;
        const body=actor.bodyPosition(this.framePartPosition);
        guests.push({x:body.x,z:body.z,yaw:actor.root.rotation.y,station});
      }
      this.remote.root.userData.spaGuests=guests;
    }
    this.remote?.animate?.(this.visualSeconds);
    if(this.place==='fitness'&&this.remote){
      const roles=['vlad','alina'] as const;
      for(const [id,group] of this.remote.stations){
        const belt=this.stableParts.get(group,'PULSE belt'),crank=this.stableParts.get(group,'PULSE crank'),stack=this.stableParts.get(group,'PULSE stack');
        if(!belt&&!crank&&!stack)continue;
        const station=stationById('fitness',id)!;
        const role=roles.find(r=>{const actor=this.actors[r],pos=approachFor(station,r);return actor.root.visible&&actor.audioMotion().activity?.startsWith('gym')&&Math.hypot(actor.root.position.x-pos.x,actor.root.position.z-pos.z)<.75;});
        const t=role?this.actors[role].audioMotion().activityTime:0;
        if(belt)belt.position.z=-(t*.52%.18);
        if(crank)crank.rotation.x=t*5;
        if(stack)stack.position.y=role?(.5+.5*Math.sin(t*2.8))*.20:0;
      }
    }
    if(this.place==='park'&&this.remote){
      const pivot=this.stableParts.get(this.remote.stations.get('park-swing'),'Leisure swing pivot');
      if(pivot)pivot.rotation.x=(['vlad','alina'] as const).some(r=>this.actors[r].root.visible&&this.actors[r].isParkSwing())?Math.sin(this.visualSeconds*1.7)*.15:0;
      const fire=this.remote.stations.get('park-fire')?.userData.fire;
      if(fire){fire.userData.setLit(!!this.household&&(this.household.world.campLitUntil??0)>clockMinutes(this.household.clock));fire.userData.animate(this.visualSeconds);}
      const shuttle=this.stableParts.get(this.remote.stations.get('park-badminton'),'Park shuttlecock');
      if(shuttle){shuttle.visible=this.badmintonStarted!==null&&[...this.pairStages.values()].some(p=>p.action==='parkBadminton'&&p.playing);if(shuttle.visible){const f=badmintonShuttle(this.visualSeconds-this.badmintonStarted!,this.homeTasks.get('vlad')?.pair?.badmintonWinner??this.homeTasks.get('alina')?.pair?.badmintonWinner);shuttle.position.set(f.x,f.y,f.z);shuttle.quaternion.setFromUnitVectors(this.frameDown,this.frameShuttleDirection.set(f.dx,f.dy,f.dz).normalize());}}
    }
    try {
      if(this.fittingStage){
        const canvas=this.canvas.getBoundingClientRect();
        const panel=document.querySelector('.clothes-fitting-panel')?.getBoundingClientRect();
        this.fittingStage.frame(canvas.width,canvas.height,panel?(panel.top-canvas.top)/canvas.height:.64);
        this.renderer.render(this.fittingStage.scene,this.fittingStage.camera);
      }else {this.renderer.render(this.scene, this.camera);this.finishPhoto();}
      if(this.graphics.android && !this.graphicsChecked && now - this.graphicsStartedAt > 4000){
        const gl=this.renderer.getContext();
        const actual=gl.getContextAttributes();
        const css=this.canvas.getBoundingClientRect();
        this.canvas.dataset.gpuReport=JSON.stringify({
          browser:this.graphics.firefox?'Firefox':'Chromium',safe:this.graphics.safe,full:this.graphics.full,
          dpr:window.devicePixelRatio,css:[Math.round(css.width),Math.round(css.height)],
          canvas:[this.canvas.width,this.canvas.height],buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],
          aa:actual?.antialias,ratio:this.renderer.getPixelRatio(),quality:this.quality
        });
      }
      if (this.graphics.android && !this.graphicsChecked && now - this.graphicsStartedAt > 4000) {
        this.graphicsChecked = true;
        const gl = this.renderer.getContext();
        if (gl.isContextLost()) {
          this.graphicsLost = true;
          showGraphicsProblem(this.canvas, 'Android потерял графический контекст.');
        } else if (!this.renderer.info.render.calls ||
            isBlankGraphicsFrame(gl, this.canvas.width, this.canvas.height)) {
          showGraphicsProblem(this.canvas, 'Браузер не выводит кадры 3D-сцены.');
        }
      }
    } catch (error) {
      this.graphicsLost = true;
      console.error('WebGL rendering failed', error);
      showGraphicsProblem(this.canvas, 'Видеодрайвер прервал отрисовку.');
    }
    if(this.perfQA&&now-this.lastPerfReport>=500){
      this.lastPerfReport=now;
      const info=this.renderer.info;
      this.canvas.dataset.resourceReport=JSON.stringify({place:this.place,revision:this.household?.revision,geometries:info.memory.geometries,textures:info.memory.textures,
        calls:info.render.calls,triangles:info.render.triangles,sceneSwitchMs:this.lastSceneSwitchMs,sceneSwitches:this.sceneSwitches,programs:info.programs?.length??0,models:[...this.furnishingModels].map(([id,m])=>[id,m.uuid])});
    }
    if(!this.graphicsLost)this.onRenderedFrame?.(now, this.renderer.info.render.calls, this.renderer.info.render.triangles,this.fittingStage?'fitting':this.place);
  };
}
