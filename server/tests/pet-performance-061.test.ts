import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PetActor} from '../../src/game/PetActor';
import {SimbaRig} from '../../src/game/SimbaRig';
import {PET_PERFORMANCES,newPetPerformance,samplePetPerformance} from '../../src/game/PetPerformance';
import {choosePetIdle,petIdleWeight} from '../../src/game/PetIdle';

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