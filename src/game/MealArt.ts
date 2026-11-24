import * as THREE from 'three';
import { drum, orb, softCube, batchRigidParts } from './ArtKit';
import type { RecipeId, TakeoutId } from '../shared/food';

import type { CafeItem } from '../shared/locations';
import type { CampRecipe } from '../shared/park';
export type ServedDish = RecipeId | TakeoutId | CafeItem | CampRecipe;

// One lathed, gently curved glazed ceramic plate, shared by every portion.
// This replaces the flat cylinder without introducing another draw call.
const plateGeometry = new THREE.LatheGeometry([
  new THREE.Vector2(0, .006), new THREE.Vector2(.092,.006),
  new THREE.Vector2(.128,.009),new THREE.Vector2(.155,.017),
  new THREE.Vector2(.169,.029),new THREE.Vector2(.182,.032),
  new THREE.Vector2(.191,.039),new THREE.Vector2(.190,.045),
],32);
const plateFinish = new THREE.MeshStandardMaterial({
  color:0xf3e6d5,roughness:.29,metalness:.02,
});
export function ceramicPlate(): THREE.Mesh {
  return new THREE.Mesh(plateGeometry,plateFinish);
}
const materials = new Map<number, THREE.MeshStandardMaterial>();
const prototypes = new Map<string, THREE.Group>();
const palette = {
  bread: 0xd6a46a, crust: 0x9d6643, cheese: 0xf0c76b,
  meat: 0xa35b42, char: 0x623b30, tomato: 0xd6553e,
  leaf: 0x6c9259, rice: 0xede0b5, sauce: 0xa9653d,
  veg: 0xd99a49, cream: 0xf1e9cf, pasta: 0xe4bb72,
  apple: 0xc45a48, potato: 0xe0ae62, olive: 0x78854c,
  salmon:0xe78963, berry:0xaa3f60, duck:0x85453f, chocolate:0x482923,
  pastry:0xe0ad67, saffron:0xf3c44b, lemon:0xf7d968, mushroom:0xa58b73,
  fish:0xf1ead7, caramel:0xb86e33, bone:0xf4e7ca, violet:0x6e4e79,
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

/** Lightweight hand-shaped restaurant plates. Shapes remain distinct even at
 * iPhone 11 table-view distance. Shared primitive geometry and cached prototypes
 * keep them much cheaper than importing individual heavy 3D meshes. */
const RESTAURANT_DISHES = new Set<string>([
  'lasagna','mushroomRisotto','beefStroganoff','salmonLemon','creamyChicken',
  'shrimpLinguine','duckOrange','pepperMedallions','pannaCotta','cremeBrulee',
  'lambRosemary','beefWellington','seaBassRisotto','chocolateFondant',
]);
function restaurantDish(g: THREE.Group, id: ServedDish): void {
  if(id==='lasagna') {
    // Golden baked layers with tomato ragù visible between pasta sheets.
    for(let i=0;i<4;i++){
      bit(g,i%2?palette.tomato:palette.pastry,0,.015+i*.018,0,.141,.014,.100,softCube);
      bit(g,i%2?palette.meat:palette.cream,.008,.022+i*.018,-.003,.124,.011,.087,softCube);
    }
    for(let i=0;i<6;i++)bit(g,i%3?palette.cheese:palette.caramel,
      -.052+(i%3)*.049,.096,-.027+Math.floor(i/3)*.053,.035,.006,.028,softCube);
  } else if(id==='mushroomRisotto') {
    bit(g,palette.rice,0,.019,0,.131,.042,.112,orb);
    grains(g,palette.rice,10,.047);
    for(let i=0;i<5;i++){
      const a=i*2.5;
      bit(g,palette.mushroom,Math.cos(a)*.058,.066,Math.sin(a)*.058,.046,.019,.031,softCube).rotation.y=a;
    }
    bit(g,palette.leaf,.025,.078,0,.017,.006,.021);
  } else if(id==='beefStroganoff') {
    bit(g,palette.cream,0,.014,0,.137,.030,.113,orb);
    for(let i=0;i<6;i++) {
      const a=i*2.2;
      slice(g,i%3===0?palette.mushroom:palette.meat,Math.cos(a)*.052,Math.sin(a)*.055,a);
    }
    for(let i=0;i<4;i++)bit(g,palette.cream,Math.sin(i*2.4)*.059,.059,
      Math.cos(i*2.4)*.052,.032,.008,.014,orb);
  } else if(id==='salmonLemon') {
    const fillet=bit(g,palette.salmon,-.017,.037,0,.130,.044,.085,softCube);fillet.rotation.y=.22;
    for(let i=0;i<4;i++) {
      const stripe=bit(g,palette.cream,-.060+i*.027,.062,.012,.008,.004,.067,softCube);
      stripe.rotation.y=.22;
    }
    bit(g,palette.lemon,.077,.031,.026,.049,.015,.048,drum);
    bit(g,palette.cream,.077,.041,.026,.030,.003,.030,drum);
    for(let i=0;i<4;i++)bit(g,palette.leaf,.035+i*.012,.071,-.050+i*.012,.006,.007,.038,softCube).rotation.y=-.4;
  } else if(id==='creamyChicken') {
    bit(g,palette.cream,0,.020,0,.135,.031,.104,orb);
    for(let i=0;i<3;i++) {
      const a=i*2.1;
      const piece=bit(g,palette.pastry,Math.cos(a)*.050,.044,Math.sin(a)*.043,.068,.037,.046,softCube);
      piece.rotation.y=a;
    }
    for(let i=0;i<5;i++)bit(g,palette.mushroom,Math.sin(i*2.4)*.061,.061,
      Math.cos(i*2.4)*.055,.030,.015,.025,softCube);
    bit(g,palette.leaf,0,.074,.016,.014,.009,.026);
  } else if(id==='shrimpLinguine') {
    grains(g,palette.pasta,14,.025);
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2+.25, x=Math.cos(a)*.065, z=Math.sin(a)*.063;
      bit(g,palette.salmon,x,.058,z,.045,.023,.026,orb).rotation.y=a;
      bit(g,palette.salmon,x+.012,.062,z+.015,.027,.022,.025,orb);
      bit(g,palette.cream,x+.021,.069,z+.025,.012,.009,.010,orb);
    }
    for(let i=0;i<3;i++)bit(g,palette.tomato,Math.sin(i*2)*.045,.055,
      Math.cos(i*2)*.047,.025,.016,.023);
  } else if(id==='duckOrange') {
    for(let i=0;i<4;i++){
      const piece=bit(g,i%2?palette.duck:palette.meat,-.065+i*.043,.035,
        -.013+i*.007,.049,.039,.083,softCube);
      piece.rotation.y=.14+i*.1;
      bit(g,palette.crust,-.065+i*.043,.056,-.012+i*.007,.039,.009,.071,softCube);
    }
    for(let i=0;i<3;i++){
      const a=i*.6;
      bit(g,palette.veg,.049+i*.016,.021,.070-i*.036,.038,.014,.036,drum).rotation.y=a;
      bit(g,palette.caramel,.049+i*.016,.031,.070-i*.036,.030,.005,.028,drum);
    }
    sauce(g,palette.caramel,.070);
  } else if(id==='pepperMedallions') {
    bit(g,palette.cream,0,.013,0,.136,.019,.110,orb);
    for(let i=0;i<2;i++){
      const x=-.049+i*.092;
      bit(g,palette.char,x,.038,-.023,.063,.047,.063,drum);
      bit(g,palette.meat,x,.064,-.023,.050,.010,.049,drum);
      for(let j=0;j<4;j++)bit(g,palette.char,x+Math.sin(j*2)*.018,.072,
        -.023+Math.cos(j*2)*.016,.010,.005,.010,orb);
    }
    for(let i=0;i<4;i++)bit(g,palette.potato,-.043+i*.026,.031,.084,.032,.026,.030,softCube);
  } else if(id==='pannaCotta') {
    // Cream dome unmoulded over a berry coulis.
    bit(g,palette.berry,0,.009,0,.147,.011,.127,orb);
    bit(g,palette.cream,0,.056,0,.094,.088,.094,drum);
    bit(g,palette.cream,0,.105,0,.081,.015,.082,orb);
    for(let i=0;i<4;i++){
      const a=i*2.6;
      bit(g,i%2?palette.violet:palette.berry,Math.cos(a)*.051,.114,
        Math.sin(a)*.041,.023,.018,.021,orb);
    }
    bit(g,palette.leaf,.016,.132,-.002,.017,.005,.014,softCube);
  } else if(id==='cremeBrulee') {
    // Low filled ramekin and contrasting burnt caramel glass.
    bit(g,palette.cream,0,.029,0,.126,.055,.125,drum);
    bit(g,palette.caramel,0,.058,0,.120,.010,.118,drum);
    for(let i=0;i<6;i++) {
      const a=i*2.5;
      bit(g,i%2?palette.pastry:palette.char,Math.cos(a)*.048,.065,
        Math.sin(a)*.048,.032,.004,.020,softCube).rotation.y=a;
    }
  } else if(id==='lambRosemary') {
    for(let i=0;i<3;i++){
      const a=i*.5-.45, x=-.057+i*.048;
      bit(g,palette.meat,x,.037,-.016,.056,.047,.068,orb).rotation.y=a;
      const bone=bit(g,palette.bone,x+.018,.070,-.058,.012,.062,.013,softCube);bone.rotation.z=-.28;
      bit(g,palette.char,x,.049,-.012,.029,.018,.049,orb);
    }
    for(let i=0;i<5;i++){
      const herb=bit(g,palette.leaf,-.06+i*.029,.074,.059-i*.007,.007,.009,.031,softCube);
      herb.rotation.y=.5;
    }
  } else if(id==='beefWellington') {
    // Cut-end pink beef visible in a golden pastry shell and mushroom duxelles.
    const loaf=bit(g,palette.pastry,-.017,.041,0,.145,.076,.110,softCube);loaf.rotation.y=.2;
    bit(g,palette.mushroom,.057,.043,.008,.010,.059,.082,orb);
    bit(g,palette.meat,.065,.044,.009,.012,.045,.060,orb);
    for(let i=0;i<5;i++){
      const score=bit(g,palette.caramel,-.073+i*.024,.083,-.005,.008,.005,.102,softCube);
      score.rotation.y=.45;
    }
    bit(g,palette.leaf,.068,.012,.077,.041,.010,.017,softCube);
  } else if(id==='seaBassRisotto') {
    bit(g,palette.saffron,-.041,.018,0,.119,.036,.109,orb);
    for(let i=0;i<9;i++) {
      const a=i*2.39;
      bit(g,palette.rice,-.041+Math.cos(a)*.050,.049+(i%2)*.006,
        Math.sin(a)*.046,.023,.013,.023,softCube);
    }
    const filet=bit(g,palette.fish,.059,.040,.011,.091,.043,.116,softCube);filet.rotation.y=-.26;
    for(let i=0;i<3;i++){
      const line=bit(g,palette.pastry,.028+i*.022,.065,.008,.006,.005,.085,softCube);
      line.rotation.y=-.26;
    }
    bit(g,palette.leaf,.092,.076,.046,.027,.006,.023,softCube);
  } else if(id==='chocolateFondant') {
    bit(g,palette.chocolate,0,.041,0,.103,.080,.103,drum);
    bit(g,palette.char,0,.084,0,.087,.009,.085,drum);
    bit(g,palette.chocolate,.020,.086,.004,.050,.014,.052,orb);
    bit(g,palette.chocolate,.048,.056,.009,.027,.047,.020,orb);
    for(let i=0;i<3;i++)bit(g,palette.berry,-.080+i*.022,.029,.070-i*.016,
      .026,.026,.025,orb);
    bit(g,palette.cream,-.055,.024,-.061,.039,.031,.038,orb);
  }
}

function makeDish(id: ServedDish | 'default'): THREE.Group {
  const g=new THREE.Group();
  if(id==='campPotato'){
    for(const x of [-.065,.065]){bit(g,0xada9a3,x,.045,0,.12,.063,.10,orb);bit(g,0xd4a961,x,.074,0,.089,.035,.076,orb);bit(g,0xe8d3a0,x,.091,.01,.038,.015,.035,softCube);}
  }else if(id==='campBread'){
    for(const x of [-.06,.06]){bit(g,0x9d6737,x,.038,0,.099,.045,.14,softCube);bit(g,0xe5b95f,x,.065,0,.082,.012,.119,softCube);for(let j=0;j<3;j++)bit(g,0x69452b,x,.074,-.035+j*.035,.075,.005,.008,softCube);}
  }else if(id==='campSkewers'){
    for(const x of [-.06,.06]){bit(g,0xa7774c,x,.033,0,.012,.014,.29,softCube);for(let j=0;j<5;j++)bit(g,j%2?0xd85e43:0xa65b3a,x,.048,-.09+j*.042,.047,.038,.040,softCube);}
  }else if (id==='cappuccino'||id==='tea'){
    bit(g,0xf5e8d6,0,.045,0,.135,.090,.135,drum);
    bit(g,id==='tea'?0xaa6c36:0xb28150,0,.092,0,.115,.007,.115,drum);
    bit(g,0xf5e8d6,.072,.054,0,.056,.046,.027,softCube);
    if(id==='cappuccino'){
      for(let i=0;i<5;i++)bit(g,0xf0dbc0,-.035+i*.016,.098,.013*Math.sin(i),.023,.004,.020,orb);
    }else{
      bit(g,palette.berry,-.026,.098,.016,.024,.008,.023,orb);
      bit(g,palette.leaf,.021,.100,-.013,.033,.004,.018,softCube);
    }
  }else if(id==='brioche'){
    bit(g,palette.crust,0,.024,0,.146,.046,.087,softCube).rotation.y=.16;
    bit(g,palette.cheese,0,.054,0,.134,.012,.080,softCube).rotation.y=.16;
    bit(g,palette.bread,0,.080,0,.145,.042,.085,orb).rotation.y=.16;
    for(let i=0;i<3;i++)bit(g,0xf3d8a0,-.036+i*.036,.102,0,.015,.004,.008);
  }else if(id==='pastry'){
    bit(g,palette.crust,0,.028,0,.145,.052,.145,drum);
    bit(g,palette.cream,0,.056,0,.130,.015,.130,drum);
    for(let i=0;i<9;i++){
      const a=i*2.4,r=.018+(i%3)*.014;
      bit(g,i%2?palette.berry:palette.violet,Math.cos(a)*r,.075,Math.sin(a)*r,.024,.024,.024);
    }
  }else if(id==='caesar'){
    for(let i=0;i<15;i++){
      const a=i*2.4,r=.025+(i%5)*.016;
      bit(g,i%2?0x81a85b:0x50783b,Math.sin(a)*r,.024+(i%3)*.009,Math.cos(a)*r,.065,.018,.039,softCube).rotation.y=a;
    }
    for(let i=0;i<5;i++){
      const a=i*1.4;
      bit(g,0xe6bf8a,Math.sin(a)*.068,.054,Math.cos(a)*.068,.055,.023,.026,softCube).rotation.y=a;
      bit(g,palette.crust,Math.cos(a)*.081,.056,Math.sin(a)*.081,.026,.023,.025,softCube);
    }
    for(let i=0;i<4;i++)bit(g,palette.cream,-.052+i*.032,.069,.008,.041,.005,.012,softCube).rotation.y=i*.8;
  }else if(id==='tomYum'){
    bit(g,0xe7e1cc,-.035,.044,-.005,.218,.088,.218,drum);
    bit(g,0xd66d31,-.035,.089,-.005,.195,.013,.195,drum);
    for(let i=0;i<5;i++){
      const a=i*1.25;
      const x=-.035+Math.cos(a)*.064,z=-.005+Math.sin(a)*.064;
      bit(g,0xf3a07b,x,.106,z,.044,.022,.028,orb).rotation.y=a;
      bit(g,palette.cream,x+.012,.108,z+.012,.027,.011,.019,orb);
      bit(g,0x548a42,-.035+Math.cos(a+.6)*.05,.10,-.005+Math.sin(a+.6)*.05,.028,.007,.018,softCube);
    }
    bit(g,palette.rice,.105,.034,.035,.085,.055,.091,orb);
    bit(g,palette.leaf,.042,.101,-.04,.025,.007,.016,softCube);
  }else if(id==='tunaPoke'){
    bit(g,0x516b75,0,.039,0,.247,.079,.247,drum);
    bit(g,palette.rice,0,.081,0,.221,.025,.221,drum);
    for(let i=0;i<7;i++){
      bit(g,0xa54250,-.061+(i%3)*.034,.105,-.063+Math.floor(i/3)*.034,.031,.027,.031,softCube);
      bit(g,0x9dbd58,.026+(i%3)*.024,.102,-.055+Math.floor(i/3)*.035,.027,.021,.027,softCube);
      bit(g,i%2?0x83a543:0xd89550,-.058+(i%4)*.038,.103,.03+Math.floor(i/4)*.03,.025,.021,.026,softCube);
    }
  }else if(id==='bbqRibs'){
    for(let i=0;i<4;i++){
      const z=-.064+i*.039;
      bit(g,palette.bone,-.02,.035,z,.17,.026,.022,softCube).rotation.y=.11;
      bit(g,0x7e3725,-.046,.058,z,.135,.047,.039,softCube).rotation.y=.11;
      bit(g,0xad562e,-.05,.081,z,.106,.009,.031,softCube);
    }
    for(let i=0;i<8;i++){
      const a=i*2.4;
      bit(g,i%3===0?0xdc9852:0xdce2ac,.104+Math.cos(a)*.032,.034+(i%2)*.012,.04+Math.sin(a)*.032,.027,.011,.015,softCube).rotation.y=a;
    }
  }else if (RESTAURANT_DISHES.has(id)) restaurantDish(g,id as RecipeId|TakeoutId);
  else if (id==='omelette') {
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
  // Distinct garnishes / finishing touches, merged into the same cached
  // geometry batch; the plate never acquires per-frame draw calls.
  if (id==='homemadePizza'||id==='pizzaCheese'||id==='pizzaPepperoni'||id==='pizzaBig') {
    for (let i=0;i<5;i++) {
      const angle=i*2.4;
      bit(g,id==='pizzaPepperoni'?palette.meat:palette.olive,
        Math.cos(angle)*.080,.057,Math.sin(angle)*.080,.022,.011,.023,drum);
    }
  } else if (id==='pancakes') {
    for(let i=0;i<3;i++)bit(g,palette.cream,
      -.03+i*.024,.085,-.018+i*.015,.018,.014,.015);
  } else if (id==='porridge'||id==='chickenSoup'||id==='beefStew') {
    for(let i=0;i<5;i++) {
      const a=i*2.4;
      bit(g,i%2?palette.leaf:palette.cream,
        Math.sin(a)*.068,.055,Math.cos(a)*.067,.012,.009,.013);
    }
  } else if (id==='salad'||id==='fruitSalad'||id==='pastaBolognese'||id==='pastaCheese') {
    for(let i=0;i<4;i++) {
      const a=i*2.1;
      bit(g,id==='fruitSalad'?palette.apple:palette.leaf,
        Math.sin(a)*.081,.057,Math.cos(a)*.070,.015,.008,.012);
    }
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
