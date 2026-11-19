import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Actor } from './Actor';
import { PetActor } from './PetActor';
import { PETS, type PetId, type PetAction } from '../shared/pets';
import { findRoute, nearestClearPoint, type FloorRect } from './navigation';
import { ACTIONS, SOCIAL_SPOTS, points, type CharacterId, type SocialKind, type TimedCommand } from '../shared/protocol';
import { decorObstacles, decorateHome } from './HomeStyling';
import { batchRigidParts } from './ArtKit';
import { buildFurniture, buildSoftRugs } from './InteriorArt';

type ItemId = 'sofa' | 'bed' | 'desk' | 'kitchen' | 'tv' | 'table';
type Point = { x: number; z: number };

const homePosition = new THREE.Vector3(15, 19, 22);
const homeTarget = new THREE.Vector3(0, 1.45, 0);
const portraitAspect = 390 / 844;

export const objectNames: Record<ItemId, string> = {
  sofa: 'Уютный диван',
  bed: 'Двуспальная кровать',
  desk: 'Рабочее место',
  kitchen: 'Кухня',
  tv: 'Телевизор',
  table: 'Журнальный столик',
};

export class World {
  readonly scene = new THREE.Scene();
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
  private downPoint: Point | null = null;
  private socialSequence = 0;
  private cameraMove: { position: THREE.Vector3; target: THREE.Vector3 } | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly onPick: (id: ItemId | CharacterId | PetId) => void) {
    this.scene.background = new THREE.Color(0xc0c7ad);
    this.scene.fog = new THREE.Fog(0xc0c7ad, 49, 75);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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
      vlad: new Actor('vlad', [0.5, 3.5]),
      alina: new Actor('alina', [1.65, 3.2]),
    };
    this.scene.add(this.actors.vlad.root, this.actors.alina.root);
    this.pets = { verdell: new PetActor('verdell'), simba: new PetActor('simba') };
    for (const pet of Object.values(this.pets)) {
      this.scene.add(pet.root);
      pet.root.traverse((part) => {
        if (part instanceof THREE.Mesh) {
          part.userData.interactable = pet.id;
          this.interactiveMeshes.push(part);
        }
      });
    }
    for (const actor of Object.values(this.actors)) {
      actor.root.traverse((part) => {
        if (part instanceof THREE.Mesh && part !== actor.root.children[1]) {
          part.userData.interactable = actor.id;
          this.interactiveMeshes.push(part);
        }
      });
    }
    this.setActive('vlad');

    canvas.addEventListener('pointerdown', (ev) => {
      this.downPoint = { x: ev.clientX, z: ev.clientY };
    });
    canvas.addEventListener('pointerup', (ev) => {
      if (ev.button !== 0 || !this.downPoint) return;
      if (Math.hypot(ev.clientX - this.downPoint.x, ev.clientY - this.downPoint.z) < 9) {
        this.pick(ev.clientX, ev.clientY);
      }
      this.downPoint = null;
    });
    canvas.addEventListener('pointercancel', () => { this.downPoint = null; });
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.camera.position.copy(this.homeViewPosition());
    this.controls.update();
    this.animate();
  }

  setActive(id: CharacterId): void {
    for (const actor of Object.values(this.actors)) actor.select(actor.id === id);
  }

  /** Optional close-up for judging the actual 3D models on a phone.
   * No special render pass, textures or server state.
   */
  showcase(subject: CharacterId | PetId | null): void {
    const home = subject === null;
    this.controls.minDistance = home ? 10 : 1.5;
    this.controls.maxDistance = home ? 51 : 12;
    this.controls.maxPolarAngle = home ? 1.25 : 1.54;
    if (home) {
      this.cameraMove = {
        position: this.homeViewPosition(),
        target: homeTarget.clone(),
      };
      return;
    }
    const isPerson = subject === 'vlad' || subject === 'alina';
    const subjectPosition = isPerson
      ? this.actors[subject].root.position
      : this.pets[subject].root.position;
    const target = subjectPosition.clone().add(
      new THREE.Vector3(0, isPerson ? 0.99 : 0.54, 0));
    // Portrait phones reserve room for the header and bottom toolbar.
    // Full-body / full-pet framing is the default; pinch to inspect details.
    this.cameraMove = {
      position: target.clone().add(new THREE.Vector3(
        isPerson ? 2.12 : 1.62, isPerson ? 1.72 : 1.25,
        isPerson ? 4.85 : 3.58,
      )),
      target,
    };
  }

  restoreCharacter(id: CharacterId, x: number, z: number, pose: 'idle' | 'sit' | 'sleep' | 'work'): void {
    const safe = nearestClearPoint({ x, z }, this.obstacles);
    if (safe) this.actors[id].root.position.set(safe.x, 0, safe.z);
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
      sofa: { x: -3.1, y: -0.25, z: 1.69, yaw: Math.PI },
      bed: { x: -3.85, y: 0.91, z: -1.76, yaw: 0 },
      desk: { x: 3.2, y: -0.23, z: 2.53, yaw: Math.PI },
      table: { x: -0.84, y: -0.27, z: 0.05, yaw: -Math.PI / 2 },
    } as const;
    const anchor = anchors[itemId as keyof typeof anchors];
    if (!anchor || pose === 'idle') {
      actor.setPose(pose);
      return;
    }
    actor.setFurniturePose(pose, new THREE.Vector3(anchor.x, anchor.y, anchor.z), anchor.yaw);
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

  performFood(id: CharacterId, action: 'cook' | 'eat'): boolean {
    return this.perform(id, action === 'cook' ? 'kitchen' : 'table',
      action === 'cook' ? 'idle' : 'sit', () => this.actors[id].playActivity(action));
  }

  startTimedAction(role: CharacterId, command: TimedCommand): boolean {
    if (command.type === 'act') {
      const def = ACTIONS[command.actionId];
      return this.perform(role, def.item, def.pose, () => {});
    }
    if (command.type === 'pet_action') return this.performPet(role, command.pet, command.action);
    return this.performFood(role, command.type);
  }

  cancelTimedAction(role: CharacterId): void {
    ++this.socialSequence;
    this.actors[role].setPose('idle');
  }

  performPet(role: CharacterId, petId: PetId, action: PetAction): boolean {
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
      actor.faceTowards(pet.root.position);
      actor.playPetActivity(action);
      pet.react(action);
    });
    return true;
  }

  playSocial(kind: SocialKind): boolean {
    const paths = (['vlad', 'alina'] as const).map((role) => {
      const actor = this.actors[role];
      const spot = SOCIAL_SPOTS[role];
      return findRoute(
        { x: actor.root.position.x, z: actor.root.position.z }, spot, this.obstacles,
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
            this.actors.vlad.playGesture(kind);
            this.actors.alina.playGesture(kind);
          }
        },
      );
    });
    return true;
  }

  private createLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xfff1da, 0xa2b6af, 1.55));
    // Broad daylight illuminates faces from the open side facing the home camera.
    const sun = new THREE.DirectionalLight(0xffe3bd, 2.75);
    sun.position.set(1.8, 9, 5.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -8.5;
    sun.shadow.camera.right = 8.5;
    sun.shadow.camera.top = 8.5;
    sun.shadow.camera.bottom = -8.5;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 22;
    sun.shadow.radius = 2.25;
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.025;
    this.scene.add(sun);
  }

  private register(id: ItemId, group: THREE.Group, point: Point): void {
    this.scene.add(group);
    this.itemPoints.set(id, new THREE.Vector3(point.x, 0, point.z));
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group);
    const clearance = 0.27;
    this.obstacles.push({
      minX: bounds.min.x - clearance, maxX: bounds.max.x + clearance,
      minZ: bounds.min.z - clearance, maxZ: bounds.max.z + clearance,
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
    buildFurniture((id, furniture, point) => {
      batchRigidParts(furniture);
      this.register(id, furniture, point);
    });
    this.obstacles.push(...decorObstacles);
  }

  private pick(clientX: number, clientY: number): void {
    const bounds = this.canvas.getBoundingClientRect();
    const x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    const y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const hit = this.raycaster.intersectObjects(this.interactiveMeshes, false)[0];
    const id: unknown = hit?.object.userData.interactable;
    if (typeof id !== 'string') return;
    if (id === 'vlad' || id === 'alina' || id === 'verdell' || id === 'simba') {
      this.onPick(id);
    } else if (id in objectNames) this.onPick(id as ItemId);
  }

  private homeViewPosition(): THREE.Vector3 {
    const portraitFit = THREE.MathUtils.clamp((0.69 - this.camera.aspect) / (0.69 - portraitAspect), 0, 1);
    return homePosition.clone().multiplyScalar(1 + portraitFit * 0.35).add(homeTarget);
  }

  private resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.camera.aspect = width / height;
    // Fit the same horizontal framing on screens narrower than 390×844.
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(
      Math.tan(THREE.MathUtils.degToRad(23)) * Math.max(1, portraitAspect / this.camera.aspect),
    ));
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    const now = performance.now();
    const dt = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    this.actors.vlad.update(dt);
    this.actors.alina.update(dt);
    this.pets.verdell.update(dt);
    this.pets.simba.update(dt);
    if (this.cameraMove) {
      const fraction = Math.min(1, dt * 5.5);
      this.controls.target.lerp(this.cameraMove.target, fraction);
      this.camera.position.lerp(this.cameraMove.position, fraction);
      if (this.camera.position.distanceTo(this.cameraMove.position) < 0.025 &&
          this.controls.target.distanceTo(this.cameraMove.target) < 0.025) {
        this.cameraMove = null;
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}
