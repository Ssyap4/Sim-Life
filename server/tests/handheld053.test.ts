import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {Actor} from '../../src/game/Actor';
import {homeSeat} from '../../src/shared/home';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createBlenderCharacter} from '../../src/game/BlenderCharacter';
for(const role of ['vlad','alina'] as const)test(role+' phone and book contact on approved character rig',async()=>{
 const b=await readFile(new URL('../../src/assets/characters/'+role+'.glb',import.meta.url));
 const loader=new GLTFLoader().register(()=>({name:'HeadlessTexture',loadTexture:async()=>new THREE.Texture()}));
 const model=createBlenderCharacter(await loader.parseAsync(Uint8Array.from(b).buffer,''),role);
 const actor=new Actor(role,[0,0],model),seat=homeSeat('sofa',role);
 actor.setFurniturePose('sit',new THREE.Vector3().copy(seat.position),seat.yaw);
 const phone=actor.root.getObjectByName('Held phone')!,book=actor.root.getObjectByName('Held book')!;
 const right=actor.root.getObjectByName('WristR')!,left=actor.root.getObjectByName('WristL')!,head=actor.root.getObjectByName('Head')!;
 const cover=book.getObjectByName('Book left cover')!,page=book.getObjectByName('Turning page')!;
 for(const motion of ['phone','scrollPhone'] as const){
  actor.playDomesticActivity(motion);
  for(let f=0;f<120;f++){
   actor.update(1/30);
   assert.ok(phone.visible);
   const target=phone.localToWorld(new THREE.Vector3(.012,-.018,-.095));
   const error=right.getWorldPosition(new THREE.Vector3()).distanceTo(target);
   assert.ok(error<.035,motion+' grip '+error);
   if(motion==='phone'&&f>22){
    const screen=phone.localToWorld(new THREE.Vector3(0,.018,.055));
    const ear=head.localToWorld(new THREE.Vector3(.16,-.02,.008));
    assert.ok(screen.distanceTo(ear)<.04);
   }
  }
  actor.finishActivity();assert.equal(phone.visible,false);
 }
 actor.playDomesticActivity('read');
 let max=0,turned=false;
 for(let f=0;f<330;f++){
  actor.update(1/30);assert.ok(book.visible);
  const target=cover.localToWorld(new THREE.Vector3(-.105,-.017,-.052));
  max=Math.max(max,left.localToWorld(new THREE.Vector3(0,-.055,0)).distanceTo(target));
  if(page.visible&&page.rotation.z>.3&&page.rotation.z<2.8)turned=true;
 }
 assert.ok(turned);assert.ok(max<.035,'left book grip '+max);
 actor.finishActivity();for(let i=0;i<20;i++)actor.update(1/30);
 assert.equal(book.visible,false);
});
