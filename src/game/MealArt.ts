import * as THREE from 'three';
import { drum, orb, softCube, batchRigidParts } from './ArtKit';
import type { RecipeId, TakeoutId } from '../shared/food';

export type ServedDish = RecipeId | TakeoutId;
const materials = new Map<number, THREE.MeshStandardMaterial>();
const prototypes = new Map<string, THREE.Group>();
const palette = {
  bread: 0xd6a46a, crust: 0x9d6643, cheese: 0xf0c76b,
  meat: 0xa35b42, char: 0x623b30, tomato: 0xd6553e,
  leaf: 0x6c9259, rice: 0xede0b5, sauce: 0xa9653d,
  veg: 0xd99a49, cream: 0xf1e9cf, pasta: 0xe4bb72,
  apple: 0xc45a48, potato: 0xe0ae62, olive: 0x78854c,
};
function material(color: number): THREE.MeshStandardMaterial {
  let mat = materials.get(color);
  if (!mat) { mat = new THREE.MeshStandardMaterial({color, roughness:.86}); materials.set(color, mat); }
  return mat;
}
function bit(group: THREE.Group, color: number, x: number, y: number, z: number,
  w: number, h: number, d: number, geometry: THREE.BufferGeometry = orb): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.scale.set(w,h,d);
  mesh.position.set(x,y,z);
  group.add(mesh);
  return mesh;
}
function grains(group: THREE.Group, color: number, count: number, y = .020): void {
  for (let i = 0; i < count; i++) {
    const angle = i * 2.39996;
    const radius = .020 + Math.sqrt((i+.5)/count) * .088;
    bit(group, color, Math.cos(angle)*radius, y + (i%3)*.004,
      Math.sin(angle)*radius, .030,.017,.024, softCube).rotation.y = angle;
  }
}
function sauce(group: THREE.Group, color: number, size = .096): void {
  bit(group,color,0,.017,0,size,.030,size,orb);
}
function slice(group: THREE.Group, color: number, x: number, z: number, yaw = 0): void {
  const mesh = bit(group,color,x,.035,z,.115,.035,.068,softCube);
  mesh.rotation.y = yaw;
}
function salad(group: THREE.Group, fruit = false): void {
  const colors = fruit
    ? [palette.apple,palette.cheese,palette.cream,palette.veg]
    : [palette.leaf,palette.tomato,palette.veg,palette.olive];
  for (let i = 0; i < 9; i++) {
    const angle = i*2.4;
    const r = .025+(i%4)*.019;
    bit(group,colors[i%colors.length],Math.cos(angle)*r,.024+(i%3)*.013,
      Math.sin(angle)*r,.049,.030,.039,softCube).rotation.y=angle;
  }
}
function roll(group: THREE.Group): void {
  for (let i=0;i<6;i++) {
    const x=(i%3-1)*.077,z=(Math.floor(i/3)-.5)*.083;
    bit(group,palette.rice,x,.033,z,.065,.046,.062,drum);
    bit(group,palette.tomato,x,.059,z,.034,.012,.032,drum);
    bit(group,palette.olive,x,.063,z,.018,.009,.018,drum);
  }
}
function burger(group: THREE.Group): void {
  bit(group,palette.bread,0,.019,0,.121,.033,.115,drum);
  bit(group,palette.meat,0,.045,0,.119,.031,.112,drum);
  bit(group,palette.leaf,0,.060,0,.126,.010,.118,softCube);
  bit(group,palette.cheese,0,.070,0,.117,.009,.117,softCube);
  bit(group,palette.bread,0,.086,0,.115,.037,.114,orb);
}
function pizza(group: THREE.Group): void {
  bit(group,palette.crust,0,.015,0,.145,.026,.145,drum);
  bit(group,palette.cheese,0,.034,0,.132,.018,.132,drum);
  for(let i=0;i<6;i++) {
    const angle=i*Math.PI/3;
    bit(group,palette.tomato,Math.cos(angle)*.078,.047,Math.sin(angle)*.078,
      .027,.012,.028,drum);
  }
  for(let i=0;i<4;i++) {
    const angle=i*Math.PI/2+.35;
    bit(group,palette.leaf,Math.cos(angle)*.064,.059,Math.sin(angle)*.064,.021,.009,.016,softCube);
  }
}
function makeDish(id: ServedDish | 'default'): THREE.Group {
  const g=new THREE.Group();
  if (id==='omelette') {
    bit(g,palette.cheese,0,.023,0,.123,.035,.099,orb);
    for(let i=0;i<5;i++)bit(g,palette.leaf,Math.sin(i*2.5)*.070,.050,
      Math.cos(i*2.5)*.057,.016,.010,.017);
  } else if (id==='toast'||id==='sandwich') {
    slice(g,palette.bread,-.045,-.014,-.22);
    slice(g,palette.bread,.044,.026,.26);
    bit(g,palette.cheese,-.034,.060,.017,.088,.012,.059,softCube);
    bit(g,palette.tomato,.038,.064,.041,.047,.011,.036,softCube);
  } else if (id==='salad'||id==='fruitSalad') salad(g,id==='fruitSalad');
  else if (id==='porridge'||id==='chickenSoup'||id==='beefStew') {
    bit(g,id==='porridge'?palette.rice:palette.sauce,0,.022,0,.124,.044,.114,orb);
    grains(g,id==='porridge'?palette.cream:id==='chickenSoup'?palette.veg:palette.meat,7,.047);
  } else if (id==='pancakes') {
    for(let i=0;i<4;i++)bit(g,palette.bread,0,.018+i*.013,0,.115,.013,.105,drum);
    bit(g,palette.sauce,.020,.077,-.010,.043,.010,.038,orb);
  } else if (id==='homemadePizza'||id==='pizzaCheese'||id==='pizzaPepperoni'||id==='pizzaBig') pizza(g);
  else if (id==='pastaBolognese'||id==='pastaCheese') {
    grains(g,palette.pasta,11);
    if(id==='pastaBolognese')sauce(g,palette.tomato,.062);
    else grains(g,palette.cheese,5,.046);
  } else if (id==='friedPotatoes') {
    grains(g,palette.potato,11);
    grains(g,palette.crust,4,.040);
  } else if (id==='buckwheatChicken'||id==='chickenRice') {
    grains(g,id==='buckwheatChicken'?palette.crust:palette.rice,13);
    slice(g,palette.meat,.035,.011,.28);
    slice(g,palette.veg,-.050,.033,-.18);
  } else if (id==='grillChicken'||id==='grillSteak'||id==='grillVegetables'||id==='grillBurgers') {
    // Outdoor portions use grilledFood() instead; this fallback is for old saves.
    slice(g,palette.meat,-.035,0,.2);slice(g,palette.veg,.045,.028,-.2);
  } else if (id==='shawarma') {
    const wrap=bit(g,palette.bread,0,.032,0,.112,.057,.062,softCube);
    wrap.rotation.y=.28;
    slice(g,palette.meat,.037,.025,.30);
  } else if (id==='burgerCombo') {
    burger(g);
    grains(g,palette.potato,5,.018);
  } else if (id==='rollsSmall'||id==='rollsSet'||id==='rollsPremium')roll(g);
  else {
    slice(g,palette.meat,-.035,0,.2);
    grains(g,palette.rice,5);
  }
  batchRigidParts(g,true);
  return g;
}

/** Change a plate's contents only on task start, not every frame. Reuse all
 * geometry and material instances so separate dishes remain cheap on mobile. */
export function selectIndoorDish(container: THREE.Group, id: ServedDish | undefined): void {
  const key=id??'default';
  let prototype=prototypes.get(key);
  if(!prototype){prototype=makeDish(key);prototypes.set(key,prototype);}
  container.clear();
  container.add(prototype.clone());
}
