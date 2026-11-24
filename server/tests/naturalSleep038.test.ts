import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Actor} from '../../src/game/Actor';
import {createBlenderCharacter} from '../../src/game/BlenderCharacter';
import {sleepPosture} from '../../src/game/SleepPosture';
import {bedPose} from '../../src/shared/bedSleep';
import {initialState} from '../../src/shared/protocol';

test('sleep poses change gently over long quiet holds and stay on their own side',()=>{
 for(const id of ['vlad','alina'] as const){
  const a=sleepPosture(id,0),b=sleepPosture(id,46);
  assert.ok(Math.abs(a.roll-b.roll)>.5);
  for(let t=0;t<184;t+=.2){
   const p=sleepPosture(id,t),q=sleepPosture(id,t+.2);
   assert.ok(Math.abs(p.roll)<=1.04&&Math.abs(p.roll-q.roll)<.1);
   assert.ok(id==='vlad'?p.roll<=0:p.roll>=0);
   assert.ok(p.legs.some(leg=>leg.bend>.4)&&p.arms.some(arm=>arm.bend<-1));
  }
 }
});
for(const id of ['vlad','alina'] as const)test(id+': shipped rig rests on mattress, bends limbs, closes eyes, and resets on waking',async()=>{
 const bytes=await readFile(new URL('../../src/assets/characters/'+id+'.glb',import.meta.url));
 const gltf=await new GLTFLoader().register(()=>({name:'HeadlessTexture',loadTexture:async()=>new THREE.Texture()})).parseAsync(Uint8Array.from(bytes).buffer,'');
 const a=new Actor(id,[0,0],createBlenderCharacter(gltf,id));
 const s=initialState();
 const bed=bedPose(s,id,'starter')!;
 a.setFurniturePose('sleep',new THREE.Vector3(bed.x,bed.y,bed.z),bed.yaw);
 a.snapFurnitureOffset();
 const root=a.root.position.clone();
 let time=0;
 for(const end of [2,20,40,60,85]){
  while(time<end){a.update(.2);time+=.2;}
  a.root.updateMatrixWorld(true);
  assert.ok(a.root.position.equals(root));
  const head=a.root.getObjectByName('Head')!.getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(head.x-bed.x)<.35&&Math.abs(head.z-(bed.z-1.7))<.38,'head near pillow '+head.toArray());
  for(const bone of ['WristL','WristR','KneeL','KneeR','AnkleL','AnkleR']){
   const p=a.root.getObjectByName(bone)!.getWorldPosition(new THREE.Vector3());
   assert.ok(p.y>.79&&p.y<1.62,bone+' height '+p.toArray());
   assert.ok(Math.abs(p.x-bed.x)<.60,bone+' remains in lane '+p.toArray());
  }
  const skin=a.root.getObjectsByProperty('isSkinnedMesh',true) as THREE.SkinnedMesh[];
  const face=skin.find(m=>m.morphTargetDictionary?.CloseLids!==undefined)!;
  assert.ok(face.morphTargetInfluences![face.morphTargetDictionary!.CloseLids]>.99);
 }
 a.setPose('idle');a.walkPath([new THREE.Vector3(2,0,0)],()=>{});
 for(let i=0;i<90;i++)a.update(.05);
 assert.ok(a.root.position.distanceTo(new THREE.Vector3(2,0,0))<.01);
 assert.ok(Math.abs(a.root.children[0].rotation.x)<.01&&Math.abs(a.root.children[0].rotation.y)<.01);
});