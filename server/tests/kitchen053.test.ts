import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {Actor} from '../../src/game/Actor';
import {homeSeat,KITCHEN_WORK,GRILL_WORK,DINING_TOP} from '../../src/shared/home';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createBlenderCharacter} from '../../src/game/BlenderCharacter';
import {mealGesture} from '../../src/game/MealGesture';
import {buildCookingStation} from '../../src/game/KitchenArt';
for(const role of ['vlad','alina'] as const)test(role+' utensils retain palm grip and reach cooking and meal targets',async()=>{
 const b=await readFile(new URL('../../src/assets/characters/'+role+'.glb',import.meta.url));
 const loader=new GLTFLoader().register(()=>({name:'HeadlessTexture',loadTexture:async()=>new THREE.Texture()}));
 const model=createBlenderCharacter(await loader.parseAsync(Uint8Array.from(b).buffer,''),role);
 const actor=new Actor(role,[KITCHEN_WORK.stove.position.x,KITCHEN_WORK.stove.position.z],model);
 const pan=new THREE.Vector3().copy(KITCHEN_WORK.stove.target);
 const right=actor.root.getObjectByName('WristR')!;
 const tools={spoon:'Held spoon',knife:'Cooking knife',fork:'Dining fork',spatula:'Cooking spatula'} as const;
 let max=0;
 function check(){
  const q=actor.kitchenQA();if(q.error!==null)max=Math.max(max,q.error);
  if(q.tool&&q.tool!=='tongs'){
   const tool=actor.root.getObjectByName(tools[q.tool as keyof typeof tools])!;
   assert.ok(tool.localToWorld(new THREE.Vector3(0,0,.045)).distanceTo(right.localToWorld(new THREE.Vector3(0,-.055,0)))<.001);
  }
  return q;
 }
 for(const recipe of ['omelette','pastaBolognese'] as const){
  actor.setPose('idle');actor.faceTowards(pan);actor.playActivity('cook',pan,recipe);
  const seen=new Set<string>();
  for(let f=0;f<360;f++){actor.update(1/30);const q=check();if(q.tool)seen.add(q.tool);}
  assert.ok(seen.has('spoon')&&seen.has('spatula'));if(recipe==='pastaBolognese')assert.ok(seen.has('knife'));
  actor.finishActivity();
 }
 console.log(role,'cook max',max);assert.ok(max<.08,'cooking reach '+max);
 actor.root.position.set(GRILL_WORK.position.x,0,GRILL_WORK.position.z);
 const grill=new THREE.Vector3().copy(GRILL_WORK.target);actor.faceTowards(grill);
 actor.playDomesticActivity('grill',grill,'grillSteak');max=0;
 for(let f=0;f<120;f++){actor.update(1/30);check();}
 console.log(role,'grill max',max);assert.ok(max<.09,'grill reach '+max);
 actor.finishActivity();
 const seat=homeSeat('table',role);actor.root.position.set(seat.approach.x,0,seat.approach.z);
 actor.setFurniturePose('sit',new THREE.Vector3().copy(seat.position),seat.yaw);actor.snapFurnitureOffset();
 const plate=new THREE.Vector3(seat.position.x+(role==='vlad'?-.59:.59),DINING_TOP+.094,seat.position.z);
 for(const recipe of ['porridge','chickenRice','sandwich'] as const){
  actor.playActivity('eat',plate,recipe);max=0;let portion=false;
  for(let f=0;f<270;f++){actor.update(1/30);const q=check();portion||=q.portion;}
  console.log(role,recipe,'max',max);assert.ok(max<.09,'meal reach '+max);assert.ok(portion);
  actor.finishActivity();actor.update(1/30);assert.equal(actor.kitchenQA().portion,false);
 }
});
test('loaded mouthful disappears before return and fourth cycle is a rest',()=>{
 assert.ok(mealGesture(.6,'vlad').loaded>.9);assert.equal(mealGesture(1.3,'vlad').loaded,0);assert.equal(mealGesture(8.1,'vlad').loaded,0);
});
test('kitchen board tracks preparation and duplicate decorative spoon never renders',()=>{
 const s=buildCookingStation(new THREE.Scene());
 s.recipe('pastaBolognese');s.update(1);assert.equal(s.board.visible,true);assert.equal(s.steam.visible,false);
 s.update(5);assert.equal(s.board.visible,false);assert.equal(s.steam.visible,true);
});
