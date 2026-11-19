import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Actor } from './Actor';
import { PetActor } from './PetActor';
import { PETS, type PetId, type PetAction } from '../shared/pets';
import { findRoute, nearestClearPoint, type FloorRect } from './navigation';
import { ACTIONS, SOCIAL_SPOTS, points, type CharacterId, type SocialKind, type TimedCommand } from '../shared/protocol';
import { decorObstacles, decorateHome } from './HomeStyling';
import { batchRigidParts } from './ArtKit';
import { inspectionFrame, type ViewBand } from './InspectionFrame';
import { portraitHomeFrame, renderProfile } from './HomeFrame';
import { furnitureContact, walkingContact } from './ContactShade';
import { buildFurniture, buildSoftRugs, furnitureFootprints } from './InteriorArt';

type ItemId = 'sofa' | 'bed' | 'desk' | 'kitchen' | 'tv' | 'table';
type Point = { x: number; z: number };

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
  private readonly sun = new THREE.DirectionalLight(0xffecd8, 2.38);

  constructor(private readonly canvas: HTMLCanvasElement,
    private readonly onPick: (id: ItemId | CharacterId | PetId) => void,
    private readonly viewBand: (inspection: boolean) => ViewBand = () => ({ top: 0.16, bottom: 0.86 })) {
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
      vlad: new Actor('vlad', [0.5, 3.5]),
      alina: new Actor('alina', [1.65, 3.2]),
    };
    this.pets = { verdell: new PetActor('verdell'), simba: new PetActor('simba') };
    for (const subject of [...Object.values(this.actors), ...Object.values(this.pets)]) {
      const visual = subject.root.children[0];
      this.scene.add(subject.root);
      visual.traverse((part) => {
        if (!(part instanceof THREE.Mesh)) return;
        part.userData.interactable = subject.id;
        this.interactiveMeshes.push(part);
      });
      const pet = subject instanceof PetActor;
      const shade = walkingContact(pet);
      this.contacts.push({ visual, shade, pet });
      this.scene.add(shade);
    }
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
      sofa: { x: -3.1, y: id === 'vlad' ? 0.057 : 0.106, z: 1.43, yaw: Math.PI },
      bed: { x: -3.85, y: 1.035, z: -1.53, yaw: 0 },
      desk: { x: 3.2, y: id === 'vlad' ? -0.24 : -0.19, z: 2.47, yaw: Math.PI },
      table: { x: -0.84, y: id === 'vlad' ? -0.27 : -0.22, z: 0.05, yaw: -Math.PI / 2 },
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

  performFood(id: CharacterId, action: 'cook' | 'eat', current = () => true): boolean {
    return this.perform(id, action === 'cook' ? 'kitchen' : 'table',
      action === 'cook' ? 'idle' : 'sit', () => {
        if (!current()) return;
        const actor = this.actors[id];
        if (action === 'cook') {
          actor.setFurniturePose('idle', new THREE.Vector3(2.88, id === 'vlad' ? 0 : 0.025, -3.03), Math.PI);
        }
        actor.playActivity(action);
      });
  }

  startTimedAction(role: CharacterId, command: TimedCommand): boolean {
    const sequence = ++this.taskSequence[role];
    const current = () => sequence === this.taskSequence[role];
    if (command.type === 'act') {
      const def = ACTIONS[command.actionId];
      return this.perform(role, def.item, def.pose, () => {});
    }
    if (command.type === 'pet_action') return this.performPet(role, command.pet, command.action, current);
    return this.performFood(role, command.type, current);
  }

  finishTimedAction(role: CharacterId): void {
    ++this.taskSequence[role];
    this.actors[role].finishActivity();
  }

  cancelTimedAction(role: CharacterId): void {
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
    this.scene.add(new THREE.HemisphereLight(0xfaf3e9, 0xb9c6be, 1.82));
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
    sun.shadow.intensity = 0.77;
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
    this.obstacles.push(...decorObstacles);
  }

  private pick(clientX: number, clientY: number): void {
    const bounds = this.canvas.getBoundingClientRect();
    const x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    const y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const hit = this.raycaster.intersectObjects(this.interactiveMeshes, false).find(entry => {
      for (let part: THREE.Object3D | null = entry.object; part; part = part.parent) {
        if (!part.visible) return false;
      }
      return true;
    });
    const id: unknown = hit?.object.userData.interactable;
    if (typeof id !== 'string') return;
    if (id === 'vlad' || id === 'alina' || id === 'verdell' || id === 'simba') {
      this.onPick(id);
    } else if (id in objectNames) this.onPick(id as ItemId);
  }

  private homeFrame(compact: boolean, band: ViewBand): Frame {
    if (compact) return portraitHomeFrame(this.camera.fov, this.camera.aspect, band);
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

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    const now = performance.now();
    // Keep paths in real time in a slow frame. A short cap still prevents a
    // jump when returning from a suspended tab.
    const dt = Math.min((now - this.lastFrame) / 1000, 0.20);
    this.lastFrame = now;
    this.actors.vlad.update(dt);
    this.actors.alina.update(dt);
    this.pets.verdell.update(dt);
    this.pets.simba.update(dt);
    for (const { visual, shade, pet } of this.contacts) {
      visual.getWorldPosition(this.contactPoint);
      shade.position.set(this.contactPoint.x, pet ? 0.098 : 0.029, this.contactPoint.z);
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
  };
}
