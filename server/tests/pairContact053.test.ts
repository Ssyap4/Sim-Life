import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {Actor} from '../../src/game/Actor';
import {RESIDENT_CLEARANCE} from '../../src/game/residentCollision';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createBlenderCharacter} from '../../src/game/BlenderCharacter';

async function residents(){
 return Promise.all((['vlad','alina'] as const).map(async role=>{
  const bytes=await readFile(new URL('../../src/assets/characters/remake/'+role+'.glb',import.meta.url));
  const loader=new GLTFLoader().register(()=>({name:'HeadlessTexture',loadTexture:async()=>new THREE.Texture()}));
  return new Actor(role,[0,0],createBlenderCharacter(await loader.parseAsync(Uint8Array.from(bytes).buffer,''),role));
 }));
}
const palm=(a:Actor,side:'R'|'L')=>a.root.getObjectByName('Wrist'+side)!.localToWorld(new THREE.Vector3(0,-.055,0));
test('standing hand hold and dance meet at palms while navigation roots stay fixed',async()=>{
 const [v,a]=await residents();
 for(const motion of ['hands','slowDance'] as const){
  v.setPose('idle');a.setPose('idle');
  v.root.position.set(0,0,0);a.root.position.set(0,0,RESIDENT_CLEARANCE+.05);
  v.faceTowards(a.root.position);a.faceTowards(v.root.position);
  const target=v.root.position.clone().lerp(a.root.position,.5).setY(motion==='hands'?.99:1.2);
  v.playPartnerGesture(motion,true,target);a.playPartnerGesture(motion,false,target);
  const roots=[v.root.position.clone(),a.root.position.clone()];
  for(let f=0;f<120;f++){v.update(1/30);a.update(1/30);}
  const gap=palm(v,'R').distanceTo(palm(a,'L'));
  console.log(motion,'palm gap',gap);
  assert.ok(gap<.065);assert.ok(v.root.position.equals(roots[0])&&a.root.position.equals(roots[1]));
  v.finishActivity();a.finishActivity();
 }
});
test('sofa hand hold meets on inner palms at both quarter-turn orientations',async()=>{
 const [v,a]=await residents();
 for(const yaw of [0,Math.PI/2]){
  for(const [actor,side] of [[v,-1],[a,1]] as const){
   const point=new THREE.Vector3(side*.5,.08,0).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
   actor.root.position.copy(point).setY(0);
   actor.setFurniturePose('sit',point,yaw);actor.snapFurnitureOffset();
  }
  v.playPartnerGesture('sofaHands',true,undefined,a);a.playPartnerGesture('sofaHands',false,undefined,v);
  for(let f=0;f<120;f++){v.update(1/30);a.update(1/30);}
  const gap=palm(v,'R').distanceTo(palm(a,'L'));
  console.log('sofa yaw',yaw,'palm gap',gap);
  assert.ok(gap<.085);
  v.finishActivity();a.finishActivity();
 }
});
