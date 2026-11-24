import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SimbaRig} from '../../src/game/SimbaRig';
import {PetActor} from '../../src/game/PetActor';
import {homeToysFor,homeToyApproach} from '../../src/shared/pets';
import {PET_TOYS,toyOwned,validToyExtras} from '../../src/shared/petToys';
import {initialState} from '../../src/shared/protocol';
import {grantStarterPetFurniture} from '../starterPets';
import {applyWorld} from '../locations';
import {stationById,approachFor,placeObstacles} from '../../src/shared/locations';
import {HOME_FLOOR} from '../../src/shared/home';
import {pointIsClear} from '../../src/game/navigation';
import {petNavigationGeometry,planPetRoute} from '../../src/game/PetNavigation';
import {runPetRoutines} from '../pets';
import {openServerFiles} from '../storage';
test('six distinct store toys require payment at the pet shop and persist as species-specific purchases',()=>{
 let s=initialState();s.money=100000;
 assert.equal(applyWorld(s,'vlad',{type:'pet_toy_buy',product:'dog-bone'}).ok,false);
 s.world.places.vlad='petshop';Object.assign(s.characters.vlad,approachFor(stationById('petshop','pet-cash')!,'vlad'));
 for(const toy of PET_TOYS){
  const money=s.money,buy=applyWorld(s,'vlad',{type:'pet_toy_buy',product:toy.id});
  assert.ok(buy.ok);s=buy.state;assert.equal(s.money,money-toy.price);
  assert.ok(toyOwned(s.pets[toy.pet],toy.id));assert.ok(validToyExtras(s.pets[toy.pet],toy.pet));
  assert.equal(applyWorld(s,'vlad',{type:'pet_toy_buy',product:toy.id}).ok,false);
 }
 assert.equal(s.pets.verdell.ownedToys?.length,3);assert.equal(s.pets.simba.ownedToys?.length,3);
 const dir=mkdtempSync(join(tmpdir(),'pet-toys-035-'));try{const f=openServerFiles(dir);f.save(s);assert.deepEqual(f.load().pets.simba.ownedToys,s.pets.simba.ownedToys);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('all six new toys are reachable, each can start and complete a real autonomous routine, preference is learned only after play',()=>{
 for(const toy of PET_TOYS){
  const s=initialState();grantStarterPetFurniture(s);
  const id=toy.pet,other=id==='simba'?'verdell':'simba',p=s.pets[id];p.ownedToys=[toy.id];p.happiness=50;
  const index=homeToysFor(id).findIndex(t=>'id' in t&&t.id===toy.id),goal=homeToyApproach(id,index);
  const geom=petNavigationGeometry(placeObstacles('home',s.furnishing),HOME_FLOOR);
  assert.ok(pointIsClear(toy,geom.obstacles,geom.floor),toy.id);assert.ok(pointIsClear(goal,geom.obstacles,geom.floor),toy.id);
  const route=planPetRoute(p.position,goal,geom)!;assert.deepEqual(route.path.at(-1)??route.from,goal);
  // skip scratching; prefer purchased toy over legacy toys
  const rolls=[.2,.2,.2,.2,.2,.2];
  runPetRoutines(s,0,480,new Set([other]),()=>rolls.shift()??.2);
  assert.equal(p.routine?.kind,'toy',toy.id);assert.equal(p.routine?.target,index,toy.id);
  assert.equal(p.toyPreferences,undefined);
  const dir=mkdtempSync(join(tmpdir(),'toy-routine-'));try{const f=openServerFiles(dir);f.save(s);assert.equal(f.load().pets[id].routine?.target,index);}finally{rmSync(dir,{recursive:true,force:true});}
  runPetRoutines(s,0,p.routine!.until,new Set([other]),()=>.99);
  assert.equal(p.toyPreferences?.[toy.id],3);assert.equal(p.happiness,50+toy.joy+6);
  assert.ok(p.energy< (id==='simba'?81:74));
 }
});
test('a forged unowned toy routine never earns joy or preference; hunger interrupts play',()=>{
 const s=initialState(),p=s.pets.simba,goal=homeToyApproach('simba',0);
 p.position=goal;p.routine={kind:'toy',target:0,goal,route:{from:goal,path:[]},startedAt:480,until:492};
 const joy=p.happiness;runPetRoutines(s,0,492,new Set(['verdell']),()=>.99);assert.equal(p.happiness,joy);assert.equal(p.toyPreferences,undefined);
 p.ownedToys=['cat-mouse'];p.routine={kind:'toy',target:0,goal,route:{from:goal,path:[]},startedAt:500,until:512};p.satiety=10;s.petBowls.simba=1;
 runPetRoutines(s,0,501,new Set(['verdell']),()=>.99);assert.equal(p.routine?.kind,'eat');assert.equal(p.toyPreferences,undefined);
});
test('every purchased toy moves or changes its mechanism during distinct real dog and skinned-cat animations',async()=>{
 const bytes=readFileSync('src/assets/pets/simba.glb');
 const scene=(await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'')).scene;
 const rig=new SimbaRig(scene),cat=new PetActor('simba',rig),dog=new PetActor('verdell');
 const state=initialState();grantStarterPetFurniture(state);
 const geom=petNavigationGeometry(placeObstacles('home',state.furnishing),HOME_FLOOR);
 const signatures=new Set<string>();
 for(const toy of PET_TOYS){
  const actor=toy.pet==='simba'?cat:dog,index=homeToysFor(toy.pet).findIndex(t=>'id' in t&&t.id===toy.id);
  const model=actor.homeToys.children[index],goal=homeToyApproach(toy.pet,index);
  assert.equal(model.visible,false);
  actor.setHomeToyAvailability(geom.obstacles,geom.floor,[toy.id]);assert.equal(model.visible,true);
  actor.root.position.set(goal.x,0,goal.z);actor.root.rotation.y=0;
  actor.followRoute([],'toy',0,undefined,undefined,false,undefined,undefined,0,index);
  const frames=new Set<string>(),poses=new Set<string>();
  for(let i=0;i<180;i++){
   actor.update(1/60);
   if(i%4===0){
    const parts=[...model.children.filter(x=>x.name==='Puzzle lid'||x.name==='Feather stalk'),model];
    frames.add(parts.flatMap(p=>[...p.position.toArray(),...p.rotation.toArray().slice(0,3),...p.scale.toArray()]).map(v=>Number(v).toFixed(3)).join(','));
    const values:number[]=[];actor.root.traverse(o=>{if(o instanceof THREE.Group||o instanceof THREE.Bone)values.push(o.rotation.x,o.rotation.y,o.position.y);});poses.add(values.map(v=>v.toFixed(3)).join(','));
   }
  }
  assert.ok(frames.size>10,toy.id+' prop does not animate');assert.ok(poses.size>10,toy.id+' pet does not animate');
  signatures.add([...frames].slice(0,8).join('|'));actor.stop();
  assert.ok(model.position.distanceTo(new THREE.Vector3(toy.x,.015,toy.z))<.001);
  actor.setHomeToyAvailability(geom.obstacles,geom.floor,[]);
 }
 assert.equal(signatures.size,6);
});
