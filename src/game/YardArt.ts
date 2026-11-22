import * as THREE from 'three';
import { GRILL_RECIPES, type RecipeId } from '../shared/food';
import { DINING_TOP, HOUSE_ENTRY, HOME_YARD, furniturePosition } from '../shared/home';
import { batchRigidParts, colors as C, cube, drum, finish, orb, paintedMap, panel, softCube, type XYZ } from './ArtKit';

const edging = 0xb29e83;
const flagstone = 0xc8b59b;
const lawn = 0x87995b;

function shape(parent: THREE.Object3D, size: XYZ, position: XYZ, color: number,
  geometry: THREE.BufferGeometry = softCube, shadow = false, surface: Parameters<typeof finish>[1] = 'fabric') {
  const mesh = new THREE.Mesh(geometry, finish(color, surface));
  mesh.scale.set(...size);
  mesh.position.set(...position);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function turf() {
  return paintedMap('home-yard-turf', 320, 192, ctx => {
    ctx.fillStyle = '#8a9c62';
    ctx.fillRect(0, 0, 320, 192);
    let seed = 5371;
    const scatter = (range: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32 * range;
    };
    for (let i = 0; i < 3900; i++) {
      const x = scatter(320);
      const y = scatter(192);
      ctx.fillStyle = i % 3 ? '#51683928' : '#e1d29255';
      ctx.fillRect(x, y, 1, 1 + i % 3);
    }
  });
}

function paving() {
  return paintedMap('home-yard-paving', 256, 384, ctx => {
    ctx.fillStyle = '#a4967e';
    ctx.fillRect(0, 0, 256, 384);
    const shades = ['#cabb9c', '#d2c0a4', '#c5b29b', '#bdab92', '#ccbea8'];
    for (let row = 0; row < 12; row++) for (let col = -1; col < 5; col++) {
      ctx.fillStyle = shades[((col + 1) * 3 + row * 7) % shades.length];
      ctx.fillRect(col * 64 + (row % 2) * 32 + 1, row * 32 + 1, 62, 30);
    }
  });
}

function flat(parent: THREE.Group, x: number, y: number, z: number, width: number, depth: number,
  map: THREE.Texture | null, color: number) {
  panel(parent, [x, y, z], [width, depth], map, color).rotation.x = -Math.PI / 2;
}

function skewerFood(recipe: RecipeId, food: THREE.Group) {
  const vegetables = recipe === 'grillVegetables';
  for (const [i, x] of [-.069, .036].entries()) {
    shape(food, [.014, .016, .276], [x, .016, 0], C.oat, cube, false, 'wood');
    for (const [j, z] of [-.078, -.026, .029, .082].entries()) {
      const colors = vegetables ? [0x9a9e58, 0xc57a3f, 0xb86448] : [0x945441, 0xd09459, 0xa88b50];
      shape(food, [.064, .048, .048], [x, .033, z], colors[(i + j) % colors.length], softCube, false, 'wood');
      if (!vegetables && j % 2 === 0) shape(food, [.045, .006, .010], [x, .058, z], 0x704832, cube, false, 'wood');
    }
  }
}

let foodModels: THREE.Group | undefined;
export function grilledFood(): THREE.Group {
  if (foodModels) return foodModels.clone();
  const food = new THREE.Group();
  food.name = 'Grilled serving';
  for (const recipe of GRILL_RECIPES) {
    const serving = new THREE.Group();
    serving.name = recipe;
    if (recipe === 'grillSteak') {
      shape(serving, [.138, .044, .218], [0, .031, 0], 0x995947, softCube, false, 'wood').rotation.y = .15;
      for (const z of [-.055, -.02, .02, .057])
        shape(serving, [.109, .008, .009], [0, .055, z], 0x694132, cube, false, 'wood').rotation.y = -.19;
    } else if (recipe === 'grillBurgers') {
      for (const [y, radius, h, color] of [[.027, .103, .035, 0xc88e55], [.052, .10, .024, 0x815345],
        [.067, .111, .012, 0x688253], [.085, .108, .031, 0xe0a761]]) {
        const bun = shape(serving, [radius, h, radius], [0, y, 0], color, drum, false, 'wood');
        bun.rotation.y = .12;
      }
    } else {
      skewerFood(recipe, serving);
    }
    batchRigidParts(serving, true);
    serving.visible = false;
    food.add(serving);
  }
  foodModels = food;
  return foodModels.clone();
}

export function selectGrilledFood(group: THREE.Object3D, recipe: RecipeId): void {
  for (const meal of group.children) meal.visible = meal.name === recipe;
}

function grillAndTable() {
  const grill = new THREE.Group();
  const grillPosition = furniturePosition('grill');
  grill.position.set(grillPosition.x, 0, grillPosition.z);
  for (const x of [-.39, .39]) for (const z of [-.24, .24]) {
    shape(grill, [.063, .68, .063], [x, .35, z], C.ink, cube);
  }
  shape(grill, [.89, .11, .50], [0, .22, 0], C.ink, softCube);
  shape(grill, [1.12, .27, .70], [0, .72, 0], 0x39474a, softCube, true, 'metal');
  for (let i = -4; i <= 4; i++)
    shape(grill, [.026, .023, .55], [.105 * i, .865, .016], 0x9b9b8a, cube, false, 'metal');
  const lid = new THREE.Group();
  lid.position.set(0, .87, -.33);
  shape(lid, [.52, .25, .31], [0, .04, .288], C.ink, orb, true, 'metal');
  shape(lid, [.37, .05, .076], [0, .09, .65], C.oak, softCube, false, 'wood');
  for (const x of [-.22, 0, .22]) {
    shape(grill, [.049, .043, .049], [x, .67, .368], C.oat, drum).rotation.x = Math.PI / 2;
  }
  batchRigidParts(lid, true);
  batchRigidParts(grill, true);
  const contents = grilledFood();
  contents.scale.setScalar(2);
  contents.position.set(.11, .867, .028);
  contents.visible = false;
  grill.add(lid, contents);
  // A few reusable ember glows and rising smoke puffs, visible ONLY while
  // grilling. No particles, dynamic geometry, or new textures per frame.
  const embers = new THREE.Group();
  for(let i=0;i<6;i++){
    const glow=new THREE.Mesh(orb,new THREE.MeshBasicMaterial({
      color:i%2?0xe88732:0xdf5b32,transparent:true,opacity:.88,depthWrite:false
    }));
    glow.position.set((i%3-1)*.23,.827,Math.floor(i/3)*.18-.10);
    glow.scale.set(.075,.035,.05);
    embers.add(glow);
  }
  embers.visible=false;
  const smoke = new THREE.Group();
  for(let i=0;i<5;i++){
    const puff=new THREE.Mesh(orb,new THREE.MeshBasicMaterial({
      color:0xd5d6cd,transparent:true,opacity:.12,depthWrite:false
    }));
    puff.scale.setScalar(.08);
    smoke.add(puff);
  }
  smoke.visible=false;
  grill.add(embers,smoke);

  const table = new THREE.Group();
  const { x, z } = furniturePosition('yardTable');
  table.position.set(x, 0, z);
  for (const dz of [-.30, -.10, .10, .30])
    shape(table, [1.91, .095, .193], [0, DINING_TOP - .047, dz], C.oak, softCube, true, 'wood');
  for (const dx of [-.76, .76]) {
    shape(table, [.13, .118, 1.15], [dx, .38, .24], C.walnut, cube, false, 'wood');
    for (const dz of [-.25, .30])
      shape(table, [.104, .74, .115], [dx, .391, dz], C.walnut, softCube, true, 'wood');
  }
  for (const dz of [.591, .718, .845])
    shape(table, [1.89, .087, .12], [0, .477, dz], C.oak, softCube, true, 'wood');
  for (const dx of [-.71, .71])
    shape(table, [.102, .433, .18], [dx, .225, .80], C.walnut, softCube, true, 'wood');
  batchRigidParts(table, true);

  const platter = new THREE.Group();
  platter.name = 'Grill platter';
  platter.position.set(x, DINING_TOP, z);
  const servings = new Map<RecipeId, THREE.Group>();
  for (const [i, recipe] of GRILL_RECIPES.entries()) {
    const plate = new THREE.Group();
    plate.position.set((i - 1.5) * .39, 0, -.14);
    shape(plate, [.175, .033, .15], [0, .021, 0], C.paper, drum, false, 'ceramic');
    const serving = grilledFood();
    serving.position.y = .039;
    serving.rotation.y = Math.PI / 2;
    selectGrilledFood(serving, recipe);
    plate.add(serving);
    plate.visible = false;
    platter.add(plate);
    servings.set(recipe, plate);
  }
  platter.visible = false;
  return { grill, table, lid, contents, platter, servings, embers, smoke };
}

function fence(yard: THREE.Group): void {
  const { gate, parking } = HOME_YARD;
  const left = gate.x - gate.width / 2;
  const right = gate.x + gate.width / 2;
  const drivewayEdge = parking.x - 1.38;
  for (const [start, end] of [[-6, left], [right, drivewayEdge], [drivewayEdge, 6]]) {
    const center = (start + end) / 2;
    const width = end - start - .04;
    shape(yard, [width, .21, .23], [center, .105, gate.z], edging, cube);
    shape(yard, [width, .30, .09], [center, .365, gate.z], C.oak, cube, false, 'wood');
    shape(yard, [width, .065, .13], [center, .54, gate.z], C.oat, softCube, false, 'wood');
  }
  for (const x of [-6, left, right, drivewayEdge, 6]) {
    shape(yard, [.18, .65, .22], [x, .33, gate.z], C.walnut, softCube, false, 'wood');
    shape(yard, [.23, .07, .26], [x, .66, gate.z], C.oat, softCube);
  }
  shape(yard, [1.30, .025, .43], [gate.x, .016, gate.z - .14], C.oat);
  for (const x of [-5.98, 5.98]) {
    shape(yard, [.28, .22, 6.81], [x, .095, 8.62], edging, cube);
    shape(yard, [.115, .37, 6.70], [x, .38, 8.62], C.oak, cube, false, 'wood');
    for (const z of [5.42, 7.55, 9.73]) {
      shape(yard, [.19, .64, .20], [x, .32, z], C.walnut, softCube, false, 'wood');
    }
  }
}

function garden(yard: THREE.Group): void {
  const { x, z: center } = HOME_YARD.planter;
  shape(yard, [.58, .22, 3.8], [x, .115, center], C.walnut, softCube, false, 'wood');
  for (const [i, z] of [-1.64, -1.09, -.46, .19, .79, 1.39].map(offset => center + offset).entries()) {
    shape(yard, [.33, .37, .38], [x + .03, .31, z], i % 2 ? C.pine : 0x6e8158, orb);
    shape(yard, [.24, .29, .26], [x - .12, .43, z + .18], C.leaf, orb);
    if (i % 2) {
      shape(yard, [.13, .11, .115], [x + .17, .58, z - .07], 0xe7bd86, orb);
      shape(yard, [.085, .079, .098], [x - .05, .68, z + .14], C.paper, orb);
    }
  }
}

export function buildYard(scene: THREE.Scene) {
  const yard = new THREE.Group();
  shape(yard, [12.52, .50, 6.66], [0, -.36, 8.91], 0x94775e, cube);
  shape(yard, [12.25, .11, 6.92], [0, -.071, 8.70], 0x69764f, softCube);
  // Leave a depth gap above the deck for the wider home's overview camera.
  flat(yard, 0, -.005, 8.73, 12.18, 6.80, turf(), lawn);

  const { x } = HOUSE_ENTRY;
  const { parking } = HOME_YARD;
  const stones = paving();
  flat(yard, x, .006, 8.58, 1.88, 6.83, stones, flagstone);
  flat(yard, -3.51, .004, 6.67, 4.24, 2.75, stones, flagstone);
  for (const dx of [-2.37, -1.92, -1.47]) {
    shape(yard, [.40, .045, .58], [x + dx, -.005, 7.16], flagstone, softCube);
  }
  flat(yard, parking.x, .004, parking.z, 2.84, 5.98, stones, flagstone);
  flat(yard, 1.96, .005, 11.27, 1.12, 1.17, stones, flagstone);
  for (const dx of [-1.23, 1.23]) {
    shape(yard, [.055, .012, 4.69], [parking.x + dx, .01, parking.z + .08], C.paper, cube);
  }
  shape(yard, [2.50, .012, .055], [parking.x, .01, 6.61], C.paper, cube);
  shape(yard, [1.59, .105, .14], [parking.x, .054, parking.z - 2.52], 0x8a7e6d, softCube);

  garden(yard);
  fence(yard);
  batchRigidParts(yard, true);
  scene.add(yard);
  const furniture = grillAndTable();
  // Smoke and ember FX are visual-only overlays. Detach them from the
  // clickable grill: this preserves the established static furniture mesh
  // budget and prevents a raycast against translucent puffs on low-end phones.
  for(const effect of [furniture.embers,furniture.smoke]){
    effect.removeFromParent();
    effect.position.copy(furniture.grill.position);
    scene.add(effect);
  }
  scene.add(furniture.platter);
  return furniture;
}
