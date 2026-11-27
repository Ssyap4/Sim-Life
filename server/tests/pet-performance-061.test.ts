import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PetActor} from '../../src/game/PetActor';
import {SimbaRig} from '../../src/game/SimbaRig';
import {PET_PERFORMANCES,newPetPerformance,samplePetPerformance} from '../../src/game/PetPerformance';
import {choosePetIdle,petIdleWeight} from '../../src/game/PetIdle';
import {petTurnMotion,petDreamMotion} from '../../src/game/PetMotion';

test('new performances have different time-varying joint channels and neutral boundaries',()=>{
 const p=newPetPerformance(),flat=()=>Object.values(p).flat() as number[];
 const neutral=JSON.stringify(p);
 for(const id of ['verdell','simba'] as const){
  const signatures=new Set<string>();
  for(const name of PET_PERFORMANCES[id]){
   const frames=new Set<string>();
   for(let i=0;i<=204;i++){
    const t=i/60;
    samplePetPerformance(p,id,name,t,petIdleWeight(t));
    assert.ok(flat().every(Number.isFinite));
    frames.add(flat().map(v=>v.toFixed(3)).join(','));
   }
   assert.equal(JSON.stringify(p),neutral,name+' exit');
   assert.ok(frames.size>15,name+' static');
   signatures.add([...frames].slice(0,30).join('|'));
  }
  assert.equal(signatures.size,PET_PERFORMANCES[id].length);
  const observed=new Set(Array.from({length:400},(_,i)=>choosePetIdle(id,{satiety:90,energy:90,happiness:90,bond:80,bowl:1,personNearby:false},i)));
  for(const g of PET_PERFORMANCES[id])assert.ok(observed.has(g),id+' missing '+g);
 }
});
test('all new gestures animate actual rigs without moving the navigation root or accumulating rotations',async()=>{
 const b=readFileSync('src/assets/pets/simba.glb');
 const scene=(await new GLTFLoader().parseAsync(Uint8Array.from(b).buffer,'')).scene;
 for(const id of ['verdell','simba'] as const){
  const pet=new PetActor(id,id==='simba'?new SimbaRig(scene):undefined);
  pet.setAmbient({satiety:90,energy:90,happiness:90,bond:80,bowl:1,personNearby:false});
  pet.root.position.set(1,0,9);
  const root=pet.root.position.clone();
  for(const gesture of PET_PERFORMANCES[id]){
   assert.ok(pet.previewPerformanceQA(gesture));
   const signatures=new Set<string>();
   for(let i=0;i<204;i++){
    pet.update(1/60);
    if(i%6===0){
     const values:number[]=[];
     pet.root.traverse(o=>{if(o instanceof THREE.Bone||o instanceof THREE.Group)values.push(o.position.y,o.rotation.x,o.rotation.y,o.rotation.z);});
     assert.ok(values.every(Number.isFinite),gesture);
     assert.ok(values.every(v=>Math.abs(v)<12),gesture+' accumulating transform');
     signatures.add(values.map(v=>v.toFixed(3)).join(','));
    }
    assert.ok(pet.root.position.equals(root));
   }
   assert.ok(signatures.size>12,gesture);
  }
  pet.previewPerformanceQA('yawn');
  pet.followRoute([],'eat',Math.PI);pet.update(.05);
  assert.equal(pet.currentIdleGesture(),null);
  assert.equal(pet.previewPerformanceQA('yawn'),false);
 }
});
test('turn anticipation is bounded at 20, 30 and 60fps and sleeps have quiet intervals',()=>{
 for(const fps of [20,30,60]){
  let bank=0;
  for(let i=0;i<fps;i++)bank=petTurnMotion(bank,i*3/fps,(i+1)*3/fps,1/fps);
  assert.ok(bank>.59&&bank<.61);
  for(let i=0;i<fps;i++)bank=petTurnMotion(bank,0,0,1/fps);
  assert.ok(bank<.001);
 }
 assert.equal(petDreamMotion(5,1),0);
 assert.equal(petDreamMotion(1,0),0);
 const samples=Array.from({length:130},(_,i)=>petDreamMotion(i/10,1));
 assert.ok(samples.some(x=>x>.3)&&samples.some(x=>x<-.3));
 assert.ok(samples.filter(x=>x===0).length>90);
});
test('jumps include distinct anticipation, flight and landing phases',()=>{
 const p=newPetPerformance();
 for(const [id,g] of [['verdell','dogBounce'],['simba','catBound']] as const){
  assert.ok(samplePetPerformance(p,id,g,.3,1).y<-.04);
  const a=samplePetPerformance(p,id,g,.67,1);
  assert.ok(a.flight>.20&&a.knee.every(k=>k>.5)&&a.pawY.every(y=>y>.08));
  assert.ok(samplePetPerformance(p,id,g,1.08,1).y<-.04);
  assert.equal(samplePetPerformance(p,id,g,1.6,1).flight,0);
 }
});
test('companion invitation is a bounded visual exchange and yields to real actions',()=>{
 const dog=new PetActor('verdell'),cat=new PetActor('simba');
 dog.root.position.set(0,0,0);cat.root.position.set(1.2,0,0);
 const context={satiety:95,energy:95,happiness:90,bond:80,bowl:1,personNearby:false};
 dog.setAmbient(context);cat.setAmbient(context);
 assert.ok(dog.canGreetCompanion()&&cat.canGreetCompanion());
 dog.greetCompanion(cat.root.position);cat.greetCompanion(dog.root.position);
 for(let i=0;i<60;i++){dog.update(1/60);cat.update(1/60);}
 assert.equal(dog.currentIdleGesture(),'dogInvite');assert.equal(cat.currentIdleGesture(),'catInspect');
 assert.ok(Math.abs(dog.root.rotation.y-Math.PI/2)<.05);
 assert.ok(Math.abs(cat.root.rotation.y+Math.PI/2)<.05);
 assert.deepEqual(dog.root.position.toArray(),[0,0,0]);assert.deepEqual(cat.root.position.toArray(),[1.2,0,0]);
 dog.watchCompanion(cat.root.position,false);assert.equal(dog.currentIdleGesture(),null);
 assert.ok(!dog.canGreetCompanion());
 cat.followRoute([],'eat',0);cat.update(.05);
 assert.equal(cat.currentIdleGesture(),null);assert.ok(!cat.canGreetCompanion());
 const tired=new PetActor('simba');tired.setAmbient({...context,energy:20});assert.ok(!tired.canGreetCompanion());
});