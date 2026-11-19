import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Actor } from './Actor';
import { findRoute, nearestClearPoint, type FloorRect } from './navigation';
import { SOCIAL_SPOTS, points, type CharacterId, type SocialKind } from '../shared/protocol';
import { decorateHome } from './HomeStyling';

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
  private readonly raycaster = new THREE.Raycaster();
  private readonly interactiveMeshes: THREE.Object3D[] = [];
  private readonly itemPoints = new Map<string, THREE.Vector3>();
  private readonly obstacles: FloorRect[] = [];
  private lastFrame = performance.now();
  private downPoint: Point | null = null;
  private socialSequence = 0;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly onPick: (id: ItemId | CharacterId) => void) {
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
    // Rugs.
    block(this.scene, [4.1, 0.045, 3.2], [-2.6, 0.04, 1.35], 0xe3d8c3, { shadow: false });
    block(this.scene, [2.4, 0.045, 2.8], [2.8, 0.04, 1.3], 0xe3dccd, { shadow: false });

    // Sofa and pillows.
    const sofa = new THREE.Group();
    sofa.position.set(-3.1, 0, 1.7);
    block(sofa, [2.6, 0.39, 1.08], [0, 0.43, 0], PALETTE.olive);
    block(sofa, [2.6, 0.85, 0.30], [0, 0.78, 0.44], 0x7b917f);
    block(sofa, [0.30, 0.59, 1.12], [-1.22, 0.66, 0], 0x819684);
    block(sofa, [0.30, 0.59, 1.12], [1.22, 0.66, 0], 0x819684);
    for (const x of [-0.75, 0, 0.75]) block(sofa, [0.69, 0.13, 0.78], [x, 0.67, -0.07], 0xa4b4a0);
    ball(sofa, 0.23, [-0.86, 0.85, 0.05], PALETTE.ivory);
    ball(sofa, 0.20, [0.89, 0.85, 0.11], PALETTE.rose);
    this.register('sofa', sofa, { x: -3.0, z: 0.6 });

    // Bed and pillows.
    const bed = new THREE.Group();
    bed.position.set(-3.85, 0, -2.62);
    block(bed, [2.7, 0.35, 2.7], [0, 0.35, 0], PALETTE.woodDark);
    block(bed, [2.6, 0.34, 2.55], [0, 0.64, 0.02], 0xf5eade);
    block(bed, [2.68, 1.10, 0.20], [0, 0.81, -1.30], 0xaf9881);
    block(bed, [2.34, 0.13, 1.50], [0, 0.84, 0.45], 0xc8bcb1);
    block(bed, [0.98, 0.15, 0.58], [-0.59, 0.86, -0.84], PALETTE.ivory);
    block(bed, [0.98, 0.15, 0.58], [0.59, 0.86, -0.84], PALETTE.ivory);
    this.register('bed', bed, { x: -3.85, z: -0.76 });

    // Kitchen counter, cupboards and stove.
    const kitchen = new THREE.Group();
    kitchen.position.set(3.45, 0, -3.91);
    block(kitchen, [4.25, 0.91, 0.88], [0, 0.47, 0], PALETTE.sage);
    block(kitchen, [4.40, 0.14, 0.97], [0, 0.98, 0], 0xe9e3d5);
    for (const x of [-1.45, -0.45, 0.55, 1.55]) {
      block(kitchen, [0.05, 0.45, 0.06], [x, 0.52, 0.46], 0xf1e9dd);
    }
    for (const x of [-0.33, 0.33]) for (const z of [-0.21, 0.20]) {
      const burner = cylinder(kitchen, 0.16, 0.024, [x, 1.065, z], PALETTE.charcoal);
      burner.scale.z = 0.9;
    }
    block(kitchen, [0.79, 0.045, 0.52], [1.38, 1.072, -0.03], 0x9cb1ad);
    block(kitchen, [0.43, 0.31, 0.15], [1.44, 1.30, -0.31], 0xbeb7a5);
    // A small pan, handle, food and backsplash make cooking visibly different.
    cylinder(kitchen, 0.27, 0.09, [-0.33, 1.14, -0.11], 0x52615b);
    cylinder(kitchen, 0.215, 0.022, [-0.33, 1.20, -0.11], 0xf0d49b);
    ball(kitchen, 0.08, [-0.33, 1.22, -0.11], 0xf2ba57);
    block(kitchen, [0.45, 0.065, 0.09], [-0.68, 1.15, 0.04], 0x636c64);
    block(kitchen, [4.0, 0.50, 0.12], [0, 1.52, -0.44], 0xe7dcd2, { shadow: false });
    for (const x of [-1.28, -0.25, 0.75]) {
      block(kitchen, [0.62, 0.38, 0.09], [x, 1.54, -0.37], 0xc9d5c0, { shadow: false });
    }
    this.register('kitchen', kitchen, { x: 3.10, z: -2.66 });

    // Working desk and computer.
    const desk = new THREE.Group();
    desk.position.set(3.2, 0, 1.46);
    block(desk, [2.25, 0.15, 1.0], [0, 0.97, 0], PALETTE.wood);
    for (const x of [-0.95, 0.95]) for (const z of [-0.37, 0.37]) {
      block(desk, [0.10, 0.87, 0.10], [x, 0.47, z], PALETTE.woodDark);
    }
    block(desk, [1.06, 0.72, 0.075], [0, 1.51, -0.25], PALETTE.charcoal);
    block(desk, [0.91, 0.58, 0.014], [0, 1.51, -0.204], 0x789da2);
    block(desk, [0.09, 0.37, 0.09], [0, 1.10, -0.25], PALETTE.charcoal);
    block(desk, [0.36, 0.05, 0.25], [0, 0.98, -0.25], PALETTE.charcoal);
    block(desk, [0.77, 0.035, 0.21], [0, 1.07, 0.24], 0xc2bfb6);
    block(desk, [0.58, 0.12, 0.60], [0.0, 0.50, 1.07], PALETTE.rose);
    block(desk, [0.58, 0.77, 0.13], [0.0, 0.82, 1.35], 0xb99186);
    // Stand behind the chair rather than walking through it.
    this.register('desk', desk, { x: 3.17, z: 3.65 });

    // Television stand and screen.
    const tv = new THREE.Group();
    tv.position.set(-0.6, 0, -3.63);
    block(tv, [1.92, 0.56, 0.50], [0, 0.28, 0], PALETTE.wood);
    block(tv, [1.82, 1.05, 0.10], [0, 1.23, 0], PALETTE.charcoal);
    block(tv, [1.65, 0.88, 0.015], [0, 1.24, 0.065], 0x748f87);
    block(tv, [0.45, 0.06, 0.25], [0, 0.65, 0], PALETTE.charcoal);
    this.register('tv', tv, { x: -0.55, z: -2.58 });

    // Coffee table: room for future combined interactions.
    const table = new THREE.Group();
    table.position.set(-1.88, 0, 0.03);
    cylinder(table, 0.68, 0.12, [0, 0.48, 0], PALETTE.wood);
    cylinder(table, 0.12, 0.41, [0, 0.23, 0], PALETTE.woodDark);
    cylinder(table, 0.40, 0.07, [0, 0.055, 0], PALETTE.woodDark);
    ball(table, 0.10, [0.27, 0.61, -0.04], 0xdcb99c);
    cylinder(table, 0.09, 0.20, [-0.24, 0.63, -0.12], 0xe8c8af);
    cylinder(table, 0.025, 0.25, [-0.23, 0.82, -0.13], 0x718e71);
    ball(table, 0.11, [-0.23, 0.96, -0.13], 0xc68f87);
    this.register('table', table, { x: -0.80, z: 0.04 });

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
    if (id === 'vlad' || id === 'alina') this.onPick(id);
    else if (id in objectNames) this.onPick(id as ItemId);
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
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}
