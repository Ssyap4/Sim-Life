import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Actor } from './Actor';
import { PetActor } from './PetActor';
import { PETS, type PetId, type PetAction } from '../shared/pets';
import { findRoute, nearestClearPoint, type FloorRect } from './navigation';
import { ACTIONS, SOCIAL_SPOTS, points, type CharacterId, type SocialKind, type TimedCommand } from '../shared/protocol';
import { decorateHome } from './HomeStyling';
import { buildFurniture, buildSoftRugs } from './InteriorArt';

type ItemId = 'sofa' | 'bed' | 'desk' | 'kitchen' | 'tv' | 'table';
type Point = { x: number; z: number };

const PALETTE = {
  cream: 0xf2e9d9,
  wall: 0xf6eee0,
  floor: 0xbfa181,
  wood: 0xb48a63,
  woodDark: 0x755940,
  olive: 0x91a08a,
  sage: 0xb6c1a6,
  rose: 0xd5aba0,
  ivory: 0xfff8ed,
  charcoal: 0x454c4a,
};

function material(color: number, roughness = 0.83): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

function block(parent: THREE.Object3D, size: [number, number, number], pos: [number, number, number], color: number, options?: { shadow?: boolean }): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color));
  mesh.position.set(...pos);
  mesh.castShadow = options?.shadow !== false;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function ball(parent: THREE.Object3D, radius: number, pos: [number, number, number], color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), material(color));
  mesh.position.set(...pos);
  mesh.castShadow = radius > 0.18;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent: THREE.Object3D, radius: number, height: number, pos: [number, number, number], color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 12), material(color));
  mesh.position.set(...pos);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

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
    this.scene.background = new THREE.Color(0xe9e9d9);
    this.scene.fog = new THREE.Fog(0xe9e9d9, 26, 58);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.17;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 90);
    this.camera.position.set(15, 19, 22);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = false;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 43;
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
    this.controls.maxDistance = home ? 43 : 12;
    this.controls.maxPolarAngle = home ? 1.25 : 1.54;
    if (home) {
      this.cameraMove = {
        position: new THREE.Vector3(15, 19, 22),
        target: new THREE.Vector3(0, 0, 0),
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
    this.scene.add(new THREE.HemisphereLight(0xfff4dd, 0xb7b9a7, 1.75));
    const sun = new THREE.DirectionalLight(0xffefdf, 2.35);
    sun.position.set(-2, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -13;
    sun.shadow.camera.right = 13;
    sun.shadow.camera.top = 13;
    sun.shadow.camera.bottom = -13;
    sun.shadow.bias = -0.001;
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
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), material(PALETTE.floor));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    block(this.scene, [12.3, 3.15, 0.19], [0, 1.55, -5.0], PALETTE.wall, { shadow: false });
    block(this.scene, [0.19, 3.15, 10.2], [-6.0, 1.55, 0], PALETTE.wall, { shadow: false });
    block(this.scene, [12.3, 0.13, 0.16], [0, 0.09, -4.89], 0xd8c7ab);
    block(this.scene, [0.16, 0.13, 10.2], [-5.9, 0.09, 0], 0xd8c7ab);

    // Decorative window and curtains.
    block(this.scene, [2.6, 1.6, 0.07], [-1.65, 2.04, -4.85], 0xadc7ba, { shadow: false });
    block(this.scene, [2.65, 0.1, 0.12], [-1.65, 2.84, -4.77], 0xfaf4e9);
    block(this.scene, [0.1, 1.65, 0.13], [-2.97, 2.03, -4.76], 0xfaf4e9);
    block(this.scene, [0.1, 1.65, 0.13], [-0.33, 2.03, -4.76], 0xfaf4e9);
    block(this.scene, [0.07, 1.55, 0.13], [-1.65, 2.05, -4.75], 0xfaf4e9);
    block(this.scene, [2.55, 0.07, 0.13], [-1.65, 2.04, -4.75], 0xfaf4e9);
    block(this.scene, [0.38, 1.84, 0.1], [-3.18, 1.95, -4.70], 0xcdbb9e);
    block(this.scene, [0.38, 1.84, 0.1], [-0.12, 1.95, -4.70], 0xcdbb9e);

    // Warm framed artwork above the kitchen, all inexpensive simple shapes.
    block(this.scene, [1.65, 1.18, 0.09], [2.85, 2.12, -4.76], 0x947863, { shadow: false });
    block(this.scene, [1.47, 1.02, 0.11], [2.85, 2.12, -4.67], 0xf0e8d9, { shadow: false });
    ball(this.scene, 0.31, [2.55, 2.29, -4.57], 0xa5b39b);
    ball(this.scene, 0.25, [3.01, 2.03, -4.55], 0xd3a38e);
    ball(this.scene, 0.16, [2.77, 1.86, -4.50], 0xe9c7a6);
    buildSoftRugs(this.scene);

    // Reusable soft-edge furniture, with unchanged interaction positions.
    buildFurniture((id, furniture, point) => this.register(id, furniture, point));

    // Decorative plant.
    cylinder(this.scene, 0.35, 0.55, [5.1, 0.3, 3.4], 0xcba68c);
    for (const [x, z] of [[5.08, 3.4], [4.85, 3.40], [5.32, 3.30], [5.05, 3.15]] as const) {
      ball(this.scene, 0.39, [x, 0.90, z], 0x769780);
    }
    // Soft standing lamp beside the living-room walkway.
    cylinder(this.scene, 0.24, 0.10, [5.02, 0.09, 0.06], 0x9b806c);
    cylinder(this.scene, 0.06, 1.50, [5.02, 0.84, 0.06], 0xae977f);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.40, 0.47, 14), material(0xffefd1));
    shade.position.set(5.02, 1.67, 0.06);
    shade.castShadow = false;
    this.scene.add(shade);
    ball(this.scene, 0.15, [5.02, 1.40, 0.06], 0xffeac1);
    // Non-interactive decorations have their own small footprints.
    this.obstacles.push({ minX: 4.70, maxX: 5.35, minZ: -0.26, maxZ: 0.38 });
    this.obstacles.push({ minX: 4.47, maxX: 5.62, minZ: 2.77, maxZ: 4.05 });
    // Front doorstep and an intentional layer of reusable visual detail.
    block(this.scene, [2.0, 0.035, 0.76], [0.7, 0.035, 4.65], 0xc7b59f, { shadow: false });
    decorateHome(this.scene);
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

  private resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.camera.aspect = width / height;
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
