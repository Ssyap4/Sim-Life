import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {Actor} from '../../src/game/Actor';
import {PetActor} from '../../src/game/PetActor';
import {conversationExpression} from '../../src/game/ContactMotion';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createBlenderCharacter} from '../../src/game/BlenderCharacter';

test('speaker and listener gesture beats are distinct, bounded and subdued during work',()=>{
 for(let i=0;i<180;i++){
  const t=i/60,s=conversationExpression(t,true,false,true),l=conversationExpression(t,false,false,true),f=conversationExpression(t,true,true,true);
  for(const x of [s,l,f]){assert.ok(x.nod>=0&&x.nod<=.065);assert.ok(x.focus>=.76&&x.focus<=1);assert.ok(x.smile>=0&&x.smile<=.33);}
  assert.ok(f.nod<=s.nod+1e-8);
 }
 assert.ok(conversationExpression(1,false,false,true).nod>.06);
 assert.equal(conversationExpression(2.6,false,false,false).nod,0);
 assert.equal(conversationExpression(0,true,false,false).smile,0);
});
for(const role of ['vlad','alina'] as const)test(role+' coat contact follows both animated pets and brush stays in palm',async()=>{
 const b=await readFile(new URL('../../src/assets/characters/remake/'+role+'.glb',import.meta.url));
 const loader=new GLTFLoader().register(()=>({name:'HeadlessTexture',loadTexture:async()=>new THREE.Texture()}));
 const actor=new Actor(role,[0,0],createBlenderCharacter(await loader.parseAsync(Uint8Array.from(b).buffer,''),role));
 const wrist=actor.root.getObjectByName('WristR')!,brush=actor.root.getObjectByName('Pet grooming brush')!;
 for(const id of ['verdell','simba'] as const){
  const pet=new PetActor(id);pet.root.position.set(0,0,.74);
  for(const yaw of [0,Math.PI/2,Math.PI]){
   pet.root.rotation.y=yaw;
   const body=(pet as unknown as {body:THREE.Object3D}).body;
   const p=body.worldToLocal(pet.coatContact(new THREE.Vector3(),-1));
   const q=body.worldToLocal(pet.coatContact(new THREE.Vector3(),1));
   assert.ok(Math.abs(q.z-p.z-.24)<1e-6&&Math.abs(q.x-p.x)<1e-6);
   for(const action of ['pet','brush'] as const){
    actor.faceTowards(pet.root.position);pet.react(action);
    let goal=new THREE.Vector3();
    actor.playPetActivity(action,(out,s)=>{pet.coatContact(out,s);goal.copy(out);return out;});
    let max=0;
    for(let f=0;f<90;f++){
     pet.update(1/30);actor.update(1/30);
     const tip=action==='brush'?brush.localToWorld(new THREE.Vector3(0,.048,.153)):wrist.localToWorld(new THREE.Vector3(0,-.055,0));
     if(f>35)max=Math.max(max,tip.distanceTo(goal));
     if(action==='brush'){
      assert.ok(brush.visible);
      assert.ok(brush.localToWorld(new THREE.Vector3(0,0,.045)).distanceTo(wrist.localToWorld(new THREE.Vector3(0,-.055,0)))<.001);
      assert.ok(brush.localToWorld(new THREE.Vector3(0,.048,.153)).y<brush.localToWorld(new THREE.Vector3(0,0,.153)).y);
     }
    }
    console.log(role,id,yaw,action,'max contact gap',max);
    assert.ok(max<.12,'coat contact gap '+max);
    actor.finishActivity();
   }
  }
 }
});
