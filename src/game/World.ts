import { ingredientList, type RecipeId } from '../shared/food';
import { carryingBag, createLocation, homeExtensions } from './LocationScene';
import { WORLD_FLOOR, approachFor, clockMinutes, meeting, placeObstacles, stationById, type PlaceId, type Station } from '../shared/locations';
import { GROCERY_DETAILS } from '../shared/storageSpace';
import { cube, drum, finish, softCube } from './ArtKit';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Actor, type DomesticMotion } from './Actor';
import type { CharacterModel } from './CharacterArt';
import { PetActor } from './PetActor';
import { PETS, type PetId, type PetAction } from '../shared/pets';
import { findRoute, nearestClearPoint, pointIsClear, type FloorRect } from './navigation';
import { ACTIONS, points, type ActionId, type CharacterId, type SocialKind, type GameState, type TimedCommand } from '../shared/protocol';
import { decorObstacles, decorateHome } from './HomeStyling';
import { batchRigidParts } from './ArtKit';
import { inspectionFrame, type ViewBand } from './InspectionFrame';
import { portraitHomeFrame, renderProfile } from './HomeFrame';
import { furnitureContact, walkingContact } from './ContactShade';
import { buildFurniture, buildSoftRugs, furnitureFootprints } from './InteriorArt';
import { dayPhase } from '../shared/life';

type ItemId = 'sofa' | 'bed' | 'desk' | 'kitchen' | 'tv' | 'table';
type Point = { x: number; z: number };

// Coordinates of the visible keys and pan in InteriorArt. These are pose
// targets only: the server and route planner still use the approach tiles.
const deskKeys = [new THREE.Vector3(3.37, 1.116, 1.896), new THREE.Vector3(3.03, 1.116, 1.896)] as const;
const cookingPan = new THREE.Vector3(2.58, 1.169, -3.76);
// Reuse the existing light articulated rig instead of loading extra animations.
const DOMESTIC_MOTIONS: Partial<Record<ActionId, DomesticMotion>> = {
  sofaRead: 'read', sofaMusic: 'music', sofaCall: 'phone',
  bedMake: 'tidy', bedStretch: 'stretch',
  deskGames: 'games', deskJournal: 'journal',
  kitchenWash: 'wash', kitchenTidy: 'tidy', kitchenTea: 'tea',
  tvMusic: 'music', tableTalk: 'phone', tablePlan: 'journal',
};

const homePosition = new THREE.Vector3(15, 19, 22);
const homeTarget = new THREE.Vector3(0, 1.45, 0);
const portraitAspect = 390 / 844;
const compactPortraitQuery = '(max-width: 640px) and (orientation: portrait)';

type Frame = { position: THREE.Vector3; target: THREE.Vector3 };

export const objectNames: Record<ItemId, string> = {
  sofa: 'Уютный диван',
  bed: 'Двуспальная кровать',
  desk: 'Рабочее место',
  kitchen: 'Кухня',
  tv: 'Телевизор',
  table: 'Журнальный столик',
};

export class World {
  scene = new THREE.Scene();
  private readonly homeScene = this.scene;
  private readonly extensions = homeExtensions();
  private readonly subjectMeshes: THREE.Object3D[] = [];
  private readonly stationMeshes: THREE.Object3D[] = [];
  private readonly bags = { vlad: carryingBag(), alina: carryingBag() };
  private readonly preparations = new Map<CharacterId, { remaining: number; next: () => void }>();
  private served: THREE.Group | null = null;
  private readonly meals = new Map<CharacterId, THREE.Group>();
  private readonly vector = new THREE.Vector3();
  private remote: ReturnType<typeof createLocation> | null = null;
  private externalObstacles: FloorRect[] = [];
  private remoteMeshes: THREE.Object3D[] = [];
  private closedDoor: string | null = null;
  private household: GameState | null = null;
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
  private readonly obstacles: FloorRect[] = [];
  private lastFrame = performance.now();
  private downPoint: (Point & { id: number }) | null = null;
  private socialSequence = 0;
  private readonly taskSequence = { vlad: 0, alina: 0 };
  private inspected: CharacterId | PetId | null = null;
  private readonly contacts: { visual: THREE.Object3D; shade: ReturnType<typeof walkingContact>; pet: boolean }[] = [];
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
    private readonly onPick: (id: ItemId | CharacterId | PetId) => void,
    private readonly viewBand: (inspection: boolean) => ViewBand = () => ({ top: 0.16, bottom: 0.86 }),
    characters: Partial<Record<CharacterId, CharacterModel>> = {},
    private readonly onRenderedFrame?: (nowMs: number, drawCalls: number, triangles: number) => void,
    private readonly navigation?: { station(id: string): void; ground(x: number, z: number): void }) {
    this.scene.background = new THREE.Color(0xc0c7ad);
    this.scene.fog = new THREE.Fog(0xc0c7ad, 49, 75);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 90);
    this.camera.position.copy(homePosition);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(homeTarget);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = false;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 51;
    this.controls.minPolarAngle = 0.24;
    this.controls.maxPolarAngle = 1.25;
    this.controls.update();

    this.createLights();
    this.createHome();
    this.actors = {
      vlad: new Actor('vlad', [0.5, 3.5], characters.vlad),
      alina: new Actor('alina', [1.65, 3.2], characters.alina),
    };
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
      food.scale.set(.22,.072,.20);
      food.position.y = .042;
      plate.add(dish, food);
      plate.visible = false;
      this.scene.add(plate);
      this.meals.set(id, plate);
    }
    const serving = this.meals.get('vlad')!.clone();
    serving.position.set(-1.96, .586, -.23);
    serving.visible = false;
    this.homeScene.add(serving);
    this.served = serving;
    this.setActive('vlad');

    canvas.addEventListener('pointerdown', (ev) => {
      this.downPoint = ev.isPrimary && ev.button === 0 && !this.downPoint
        ? { x: ev.clientX, z: ev.clientY, id: ev.pointerId } : null;
    });
    canvas.addEventListener('pointerup', (ev) => {
      if (this.downPoint?.id === ev.pointerId &&
          Math.hypot(ev.clientX - this.downPoint.x, ev.clientY - this.downPoint.z) < 9) {
        this.pick(ev.clientX, ev.clientY);
      }
      this.downPoint = null;
    });
    canvas.addEventListener('pointercancel', () => { this.downPoint = null; });
    window.addEventListener('resize', () => this.refreshViewport());
    this.compactPortrait.addEventListener('change', () => this.refreshViewport());
    this.refreshViewport();
    this.animate();
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
    this.controls.maxDistance = 51;
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
    const safe = nearestClearPoint({ x, z }, this.currentObstacles(), WORLD_FLOOR);
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
    const anchors = {
      // A sofa and double bed have two visual positions, not two overlapping residents.
      sofa: { x: id === 'vlad' ? -3.60 : -2.60, y: id === 'vlad' ? 0.057 : 0.106, z: 1.43, yaw: Math.PI },
      bed: { x: id === 'vlad' ? -4.40 : -3.30, y: 1.055, z: -1.61, yaw: 0 },
      desk: { x: 3.2, y: id === 'vlad' ? -0.24 : -0.19, z: 2.47, yaw: Math.PI },
      table: { x: -0.84, y: id === 'vlad' ? -0.27 : -0.22, z: 0.05, yaw: -Math.PI / 2 },
    } as const;
    const anchor = anchors[itemId as keyof typeof anchors];
    if (!anchor || pose === 'idle') {
      actor.setPose(pose);
      return;
    }
    actor.setFurniturePose(pose, new THREE.Vector3(anchor.x, anchor.y, anchor.z), anchor.yaw,
      itemId === 'desk' ? deskKeys : undefined);
  }

  perform(id: CharacterId, itemId: string, pose: 'idle' | 'sit' | 'sleep' | 'work', onArrive: () => void): boolean {
    const location = this.itemPoints.get(itemId);
    if (!location) return false;
    const actor = this.actors[id];
    const route = findRoute(
      { x: actor.root.position.x, z: actor.root.position.z },
      { x: location.x, z: location.z },
      this.obstacles,
    );
    if (!route) return false;
    ++this.socialSequence;
    actor.walkPath(route.map((point) => new THREE.Vector3(point.x, 0, point.z)), () => {
      this.applyFurniturePose(id, itemId, pose);
      onArrive();
    });
    return true;
  }

  performFood(id: CharacterId, action: 'cook' | 'eat', current = () => true): boolean {
    return this.perform(id, action === 'cook' ? 'kitchen' : 'table',
      action === 'cook' ? 'idle' : 'sit', () => {
        if (!current()) return;
        const actor = this.actors[id];
        if (action === 'cook') {
          actor.setFurniturePose('idle', new THREE.Vector3(2.88, id === 'vlad' ? 0 : 0.025, -3.03), Math.PI);
        }
        if (action === 'eat') this.showMeal(id, -1.46, .585, .04);
        actor.playActivity(action, action === 'cook' ? cookingPan : undefined);
      });
  }

  startTimedAction(role: CharacterId, command: TimedCommand): boolean {
    if (this.household && this.household.world.places[role] !== this.place) return true;
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
    if (command.type === 'act') {
      const def = ACTIONS[command.actionId];
      return this.perform(role, def.item, def.pose, () => {
        if (!current()) return;
        const motion = DOMESTIC_MOTIONS[command.actionId];
        if (motion) this.actors[role].playDomesticActivity(motion);
      });
    }
    if (command.type === 'pet_action') return this.performPet(role, command.pet, command.action, current);
    if (command.type === 'eat_takeout') return this.performFood(role, 'eat', current);
    if (command.type === 'cook') return this.prepareFood(role, command.recipe, current);
    return this.performFood(role, command.type, current);
  }

  private prepareFood(role: CharacterId, recipe: RecipeId, current: () => boolean): boolean {
    const cold = ingredientList(recipe).some(([id]) => GROCERY_DETAILS[id].area === 'fridge');
    const station = stationById('home', cold ? 'fridge' : 'cupboard')!;
    const actor = this.actors[role];
    const approach = approachFor(station, role);
    const start = nearestClearPoint(actor.root.position, this.obstacles, WORLD_FLOOR);
    const towardStorage = start && findRoute(start, approach, this.obstacles, WORLD_FLOOR);
    const towardStove = findRoute(approach, points.kitchen, this.obstacles, WORLD_FLOOR);
    const length = (origin: Point, route: Point[]) => route.reduce((acc, next, index) => {
      const previous = route[index - 1] ?? origin;
      return acc + Math.hypot(next.x - previous.x, next.z - previous.z);
    }, 0);
    if (!start || !towardStorage || !towardStove ||
      length(start, towardStorage) + length(approach, towardStove) > 12) {
      return this.performFood(role, 'cook', current);
    }
    return this.walkTo(role, approach, () => {
      if (!current()) return;
      actor.faceTowards(this.vector.set(station.center.x, 0, station.center.z));
      this.openStorage(station.id);
      actor.playDomesticActivity('tidy');
      this.preparations.set(role, { remaining: .9, next: () => {
        if (!current()) return;
        this.closeStorage();
        this.performFood(role, 'cook', current);
      } });
    });
  }

  finishTimedAction(role: CharacterId): void {
    this.preparations.delete(role);
    if (this.household && this.household.world.places[role] !== this.place) return;
    this.meals.get(role)!.visible = false;
    this.closeStorage();
    ++this.taskSequence[role];
    this.actors[role].finishActivity();
  }

  cancelTimedAction(role: CharacterId): void {
    this.preparations.delete(role);
    if (this.household && this.household.world.places[role] !== this.place) return;
    this.meals.get(role)!.visible = false;
    this.closeStorage();
    ++this.taskSequence[role];
    ++this.socialSequence;
    this.actors[role].setPose('idle');
  }

  performPet(role: CharacterId, petId: PetId, action: PetAction, current = () => true): boolean {
    if (action === 'buyFood') return true;
    const actor = this.actors[role];
    const pet = this.pets[petId];
    const position = PETS[petId].home;
    const target = nearestClearPoint({ x: position.x, z: position.z + 0.78 }, this.obstacles);
    const start = nearestClearPoint(
      { x: actor.root.position.x, z: actor.root.position.z }, this.obstacles);
    const route = start && target ? findRoute(start, target, this.obstacles) : null;
    if (!route) { pet.react(action); return false; }
    ++this.socialSequence;
    actor.walkPath(route.map((point) => new THREE.Vector3(point.x, 0, point.z)), () => {
      if (!current()) return;
      actor.faceTowards(pet.root.position);
      actor.playPetActivity(action);
      pet.react(action);
    });
    return true;
  }

  playSocial(kind: SocialKind): boolean {
    const paths = (['vlad', 'alina'] as const).map((role) => {
      const actor = this.actors[role];
      const spot = meeting(this.place, role);
      return findRoute(
        { x: actor.root.position.x, z: actor.root.position.z }, spot, this.currentObstacles(), WORLD_FLOOR,
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
    sun.shadow.camera.left = -8.5;
    sun.shadow.camera.right = 8.5;
    sun.shadow.camera.top = 8.5;
    sun.shadow.camera.bottom = -8.5;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 22;
    sun.shadow.radius = 2.65;
    sun.shadow.intensity = 0.72;
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.025;
    this.scene.add(sun);
  }

  private register(id: ItemId, group: THREE.Group, point: Point): void {
    this.scene.add(group);
    this.itemPoints.set(id, new THREE.Vector3(point.x, 0, point.z));
    const bounds = furnitureFootprints[id];
    const clearance = 0.27;
    this.obstacles.push({
      minX: bounds.minX - clearance, maxX: bounds.maxX + clearance,
      minZ: bounds.minZ - clearance, maxZ: bounds.maxZ + clearance,
    });
    group.traverse((part) => {
      if (part instanceof THREE.Mesh) {
        part.userData.interactable = id;
        this.interactiveMeshes.push(part);
      }
    });
  }

  private createHome(): void {
    decorateHome(this.scene);
    buildSoftRugs(this.scene);
    this.scene.add(furnitureContact());
    buildFurniture((id, furniture, point) => {
      batchRigidParts(furniture);
      this.register(id, furniture, point);
    });
    this.obstacles.push(...decorObstacles, ...placeObstacles('home'));
    this.scene.add(this.extensions.group);
    for (const [id, group] of this.extensions.stations) this.trackStation(this.stationMeshes, id, group);
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

  private sitAt(role: CharacterId, station: Station): void {
    const actor = this.actors[role];
    const cafe = station.action.kind === 'dine';
    actor.setFurniturePose('sit', new THREE.Vector3(approachFor(station, role).x,
      role === 'vlad' ? -.24 : -.19, station.center.z + (cafe ? .51 : .12)), cafe ? Math.PI : 0);
  }

  private showMeal(role: CharacterId, x: number, y: number, z: number): void {
    const meal = this.meals.get(role)!;
    meal.position.set(x, y, z);
    meal.visible = true;
  }

  walkTo(role: CharacterId, target: { x: number; z: number }, onArrive = () => {}): boolean {
    const actor = this.actors[role];
    const obstacles = this.currentObstacles();
    const from = nearestClearPoint(actor.root.position, obstacles, WORLD_FLOOR);
    const to = nearestClearPoint(target, obstacles, WORLD_FLOOR);
    const path = from && to ? findRoute(from, to, obstacles, WORLD_FLOOR) : null;
    if (!path) return false;
    actor.walkPath(path.map(p => new THREE.Vector3(p.x, 0, p.z)), onArrive);
    return true;
  }

  runLocationPath(role: CharacterId, path: { x: number; z: number }[], station?: string, onArrive = () => {}): void {
    const target = path.at(-1);
    if (!target) { onArrive(); return; }
    this.closeStorage();
    this.preparations.delete(role);
    const arrival = () => {
      const site = stationById(this.place, station);
      if (site) this.actors[role].faceTowards(this.vector.set(site.center.x, 0, site.center.z));
      onArrive();
    };
    // Replan from the visible position if a walk interrupted a previous one.
    if (!this.walkTo(role, target, arrival)) {
      this.actors[role].walkPath(path.map(p => new THREE.Vector3(p.x, 0, p.z)), arrival);
    }
  }

  openStorage(id: string): void { this.closedDoor = id; }
  closeStorage(): void { this.closedDoor = null; }

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
    this.closeStorage();
    this.cameraMove = null;
    this.followSubject = null;
    this.inspected = null;
    this.defaultFrame = null;
    this.viewport = null;
    this.lastDayPhase = null;
    this.preparations.clear();
    this.dogTrail = [];
    this.lastDogPoint = null;
    this.remote?.root.removeFromParent();
    this.remote?.dispose();
    this.remoteMeshes = [];
    this.externalObstacles = placeObstacles(place);
    this.remote = place === 'home' ? null : createLocation(place);
    this.scene = place === 'home' ? this.homeScene : new THREE.Scene();
    this.scene.background = new THREE.Color(0xc0c7ad);
    this.scene.fog = new THREE.Fog(0xc0c7ad, 49, 75);
    if (this.remote) {
      this.scene.add(this.remote.root);
      for (const [id, group] of this.remote.stations) this.trackStation(this.remoteMeshes, id, group);
    }
    this.scene.add(this.ambient, this.sun,
      ...Object.values(this.actors).map(actor => actor.root), ...Object.values(this.pets).map(pet => pet.root),
      ...this.contacts.map(contact => contact.shade), ...Object.values(this.bags), ...this.meals.values());
    for (const meal of this.meals.values()) meal.visible = false;
    if (this.cart) { this.cart.visible = false; this.scene.add(this.cart); }
    this.place = place;
    this.controls.maxDistance = 51;
    this.controls.minDistance = 10;
    this.controls.maxPolarAngle = 1.25;
    this.refreshViewport();
    this.renderer.renderLists.dispose();
  }

  syncHousehold(state: GameState, role: CharacterId, reset = false): void {
    const previous = this.household;
    const place = state.world.places[role];
    const changed = place !== this.place;
    this.localRole = role;
    this.household = state;
    if (changed) this.switchPlace(place);
    this.setTimeOfDay(state.clock.minute);
    for (const id of ['vlad', 'alina'] as const) {
      const away = !!state.activeShifts[id] || state.world.places[id] !== place;
      const appeared = !away && (!!previous?.activeShifts[id] || previous?.world.places[id] !== place);
      this.setAway(id, away);
      if (!away && (reset || changed || appeared)) {
        const resident = state.characters[id];
        this.restoreCharacter(id, resident.x, resident.z, resident.pose);
      }
      this.bags[id].visible = !away && state.world.bags[id] > 0;
    }
    const dog = this.pets.verdell.root;
    const walker = state.world.dogWalker;
    dog.visible = walker ? place === 'park' && state.world.places[walker] === 'park' && !state.activeShifts[walker] : place === 'home';
    this.pets.simba.root.visible = place === 'home';
    if (!walker) dog.position.set(PETS.verdell.home.x, 0, PETS.verdell.home.z);
    else if (place === 'park' && (changed || previous?.world.dogWalker !== walker)) {
      dog.position.copy(this.actors[walker].root.position);
      dog.position.x -= .46;
      this.dogTrail = [];
      this.lastDogPoint = null;
    }
    for (const c of this.contacts) {
      if (c.pet) c.shade.visible = c.visual.parent?.visible === true;
    }
    if (place === 'home') {
      if (this.served) this.served.visible = Object.values(state.meals).some(quantity => quantity > 0);
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
    if (id === 'vlad' || id === 'alina' || id === 'verdell' || id === 'simba') this.onPick(id);
    else if (typeof id === 'string' && id in objectNames) this.onPick(id as ItemId);
    else if (this.place !== 'home') {
      const point = this.raycaster.ray.intersectPlane(new THREE.Plane(THREE.Object3D.DEFAULT_UP, 0), this.vector);
      if (point) this.navigation?.ground(point.x, point.z);
    }
  }

  private homeFrame(compact: boolean, band: ViewBand): Frame {
    if (compact) return portraitHomeFrame(this.camera.fov, this.camera.aspect, band, this.remote?.horizontal, this.remote?.vertical);
    // Keep the existing desktop composition.
    const fit = THREE.MathUtils.clamp((0.69 - this.camera.aspect) / (0.69 - portraitAspect), 0, 1);
    return { position: homePosition.clone().multiplyScalar(1 + fit * 0.35).add(homeTarget), target: homeTarget.clone() };
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
      actor.update(dt);
      if (this.bags[id].visible) this.followBag(this.bags[id], actor);
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
      const target = this.dogTrail[0] ?? actor.position;
      const dx = target.x - dog.root.position.x, dz = target.z - dog.root.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > .07) {
        const step = Math.min(1, dt * (this.dogTrail.length > 3 ? 10 : 5));
        dog.root.rotation.y = Math.atan2(dx, dz);
        const next = {x: dog.root.position.x + dx * step, z: dog.root.position.z + dz * step};
        if (pointIsClear(next, this.currentObstacles(), WORLD_FLOOR)) dog.root.position.set(next.x, 0, next.z);
        this.dogTravel += distance * step;
        pace = Math.min(1, distance * 2.3);
      }
    }
    if (dog.root.visible) dog.update(dt, this.dogTravel, pace);
    if (this.pets.simba.root.visible) this.pets.simba.update(dt);
    if (this.place === 'home') for (const [id, door] of this.extensions.doors) {
      door.rotation.y = THREE.MathUtils.damp(door.rotation.y, this.closedDoor === id ? -1.53 : 0, 11, dt);
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
    this.renderer.render(this.scene, this.camera);
    this.onRenderedFrame?.(now, this.renderer.info.render.calls, this.renderer.info.render.triangles);
  };
}
