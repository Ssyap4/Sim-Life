import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as THREE from 'three';
import {initialState} from '../../src/shared/protocol';
import {STARTER_CAT_HOUSE,STARTER_CAT_SCRATCHER,FURNITURE_CATALOG,FURNITURE_BY_ID} from '../../src/shared/furniture';
import {DOG_TOYS,dogToyApproach} from '../../src/shared/pets';
import {catPerchCandidates,currentCatPerch} from '../../src/shared/CatPerches';
import {petScratchers,currentPetEquipment} from '../../src/shared/petFurniture';
import {grantStarterPetFurniture} from '../starterPets';
import {applyFurnishing} from '../furnishing';
import {runPetRoutines} from '../pets';
import {openServerFiles} from '../storage';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';
import {PetActor} from '../../src/game/PetActor';
import {placeObstacles} from '../../src/shared/locations';
import {HOME_FLOOR} from '../../src/shared/home';
import {petNavigationGeometry,planPetRoute} from '../../src/game/PetNavigation';
import {pointIsClear} from '../../src/game/navigation';
test('starter cat furniture is free, distinct from catalog, adjacent, sale persists and cannot be repurchased',()=>{
 const s=initialState(),money=s.money;
 assert.ok(grantStarterPetFurniture(s));assert.equal(s.money,money);
 assert.equal(s.furnishing.placed.length,2);
 const [house,post]=s.furnishing.placed;
 assert.equal(house.sku,STARTER_CAT_HOUSE);assert.equal(post.sku,STARTER_CAT_SCRATCHER);
 assert.ok(Math.hypot(house.x-post.x,house.z-post.z)<1.5);
 for(const item of [house,post]){
  assert.ok(!FURNITURE_CATALOG.some(v=>v.id===item.sku));
  const info=FURNITURE_BY_ID.get(item.sku)!;
  const size=new THREE.Box3().setFromObject(buildFurnishingModel(item.sku,item.finish)).getSize(new THREE.Vector3());
  assert.ok(size.x<=info.width+.02&&size.y<=info.height+.02&&size.z<=info.depth+.02);
  assert.equal(applyFurnishing(s,'vlad',{type:'furniture_order',sku:item.sku,finish:'oak',quantity:1,shipping:'regular'},480).ok,false);
 }
 assert.equal(grantStarterPetFurniture(s),false);
 const sale=applyFurnishing(s,'vlad',{type:'furniture_sell',id:house.id},480);assert.ok(sale.ok);
 const sale2=applyFurnishing(sale.state,'vlad',{type:'furniture_sell',id:post.id},480);assert.ok(sale2.ok);
 assert.ok(sale2.state.money>money);assert.equal(sale2.state.furnishing.placed.length,0);
 const dir=mkdtempSync(join(tmpdir(),'starter-pet-030-'));
 try{const files=openServerFiles(dir);files.save(sale2.state);const saved=files.load();assert.equal(grantStarterPetFurniture(saved),false);assert.equal(saved.furnishing.placed.length,0);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('Simba autonomously scratches and rests on the starter roof, invalidates sold references',()=>{
 const s=initialState();grantStarterPetFurniture(s);
 const house=s.furnishing.placed[0],post=petScratchers(s.furnishing)[0];
 runPetRoutines(s,0,480,new Set(['verdell']),()=>.05);
 assert.equal(s.pets.simba.routine?.kind,'scratch');
 assert.equal(s.pets.simba.routine?.equipment?.id,post.id);
 const routine=s.pets.simba.routine!,happy=s.pets.simba.happiness;
 const sold=applyFurnishing(s,'vlad',{type:'furniture_sell',id:post.id},480);assert.ok(sold.ok);
 assert.equal(currentPetEquipment(sold.state.furnishing,routine.equipment!),null);
 runPetRoutines(sold.state,0,routine.until,new Set(['verdell']),()=>.99);
 assert.equal(sold.state.pets.simba.happiness,happy);
 const rest=initialState();grantStarterPetFurniture(rest);rest.pets.simba.energy=50;
 runPetRoutines(rest,0,480,new Set(['verdell']),()=>.05);
 const perch=rest.pets.simba.routine?.perch;
 assert.ok(perch);assert.equal(perch.key,'placed:'+house.id+':jump');assert.ok(currentCatPerch(rest.furnishing,perch));
 assert.ok(catPerchCandidates(rest.furnishing).some(p=>p.key==='placed:'+house.id+':inside'));
});
test('each of the six real dog toys can be reached and used independently, urgent needs override play',()=>{
 const base=initialState();grantStarterPetFurniture(base);
 const geom=petNavigationGeometry(placeObstacles('home',base.furnishing),HOME_FLOOR);
 for(let i=0;i<DOG_TOYS.length;i++){
  const s=structuredClone(base),goal=dogToyApproach(i),toy=DOG_TOYS[i];
  assert.ok(pointIsClear(toy,geom.obstacles,geom.floor),toy.name);
  assert.ok(pointIsClear(goal,geom.obstacles,geom.floor));
  const route=planPetRoute(s.pets.verdell.position,goal,geom)!;
  assert.deepEqual(route.path.at(-1)??route.from,goal);
  const rolls=[.2,.2,.1,(i+.1)/6];
  runPetRoutines(s,0,480,new Set(['simba']),()=>rolls.shift()??.99);
  const routine=s.pets.verdell.routine!;
  assert.equal(routine.kind,'toy');assert.equal(routine.target,i);
  assert.deepEqual(routine.goal,goal);
  const dir=mkdtempSync(join(tmpdir(),'dog-toy-030-'));
  try{const files=openServerFiles(dir);files.save(s);assert.equal(files.load().pets.verdell.routine?.kind,'toy');}finally{rmSync(dir,{recursive:true,force:true});}
  s.pets.verdell.satiety=10;s.petBowls.verdell=1;
  runPetRoutines(s,0,481,new Set(['simba']),()=>.99);
  assert.equal(s.pets.verdell.routine?.kind,'eat');
 }
});
test('dog toy scene has six separate floor objects and distinct animation for every type',()=>{
 const dog=new PetActor('verdell');
 assert.equal(dog.homeToys.children.filter(c=>c.visible).length,6);
 for(let i=0;i<3;i++){
  const model=dog.homeToys.children[i],goal=dogToyApproach(i);
  dog.root.position.set(goal.x,0,goal.z);
  dog.followRoute([],'toy',0,undefined,undefined,false,undefined,undefined,0,i);
  const samples=new Set<string>();
  for(let frame=0;frame<120;frame++){dog.update(1/60);samples.add(model.position.toArray().map(v=>v.toFixed(3)).join(','));}
  assert.ok(samples.size>5,DOG_TOYS[i].kind);
  assert.ok(model.position.distanceTo(new THREE.Vector3(DOG_TOYS[i].x,.015,DOG_TOYS[i].z))<.8);
 }
 dog.stop();
 for(let i=0;i<6;i++)assert.ok(dog.homeToys.children[i].position.distanceTo(new THREE.Vector3(DOG_TOYS[i].x,.015,DOG_TOYS[i].z))<.001);
});
