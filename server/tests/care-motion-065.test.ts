import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Actor} from '../../src/game/Actor';
import {careFrame} from '../../src/game/CareMotion';
import type {CareId} from '../../src/shared/vanity';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createBlenderCharacter} from '../../src/game/BlenderCharacter';
test('care choreography has distinct phases, fades, no repeated bomb or shaving during rest',()=>{
 assert.equal(careFrame('bathRitual',2).phase,'bomb');assert.equal(careFrame('bathRitual',10).phase,'relax');
 assert.equal(careFrame('bathRitual',22).phase,'shave');assert.equal(careFrame('bathRitual',40).phase,'bodyCream');
 assert.equal(careFrame('bathRitual',60).phase,'relax');assert.equal(careFrame('bathRose',22).phase,'relax');
 assert.equal(careFrame('hydrate',2.5).phase,'dispense');assert.equal(careFrame('hydrate',6).phase,'apply');
 assert.equal(careFrame('lipCare',6).phase,'lip');
 for(const id of ['bathRitual','hydrate','lipCare'] as const)for(let t=0;t<70;t+=.1){const f=careFrame(id,t);assert.ok(f.blend>=0&&f.blend<=1);}
});
test('joining an active bath resumes its actual care phase rather than dropping a second bomb',()=>{
 const actor=new Actor('alina',[0,0]);actor.playBathCare('bathRitual');actor.syncCareElapsed(22);actor.update(1/30);
 assert.equal(actor.careQA().phase,'shave');assert.deepEqual(actor.careQA().children,['razor']);
 actor.syncCareElapsed(65);actor.update(1/30);assert.equal(actor.careQA().phase,'relax');assert.equal(actor.careQA().prop,false);
 actor.finishActivity();assert.equal(actor.careQA().id,null);
});
test('approved Alina rig: stable cosmetic palm and tool targets plus release on cancel',async()=>{
 const b=await readFile(new URL('../../src/assets/characters/remake/alina.glb',import.meta.url));
 const loader=new GLTFLoader().register(()=>({name:'HeadlessTexture',loadTexture:async()=>new THREE.Texture()}));
 const model=createBlenderCharacter(await loader.parseAsync(Uint8Array.from(b).buffer,''),'alina');
 const actor=new Actor('alina',[0,0],model);
 const cases:[CareId,number,string][]=[['hydrate',8,'apply'],['serum',8,'apply'],['faceMask',8,'apply'],['handCream',8,'apply'],['lipCare',8,'lip'],['bathShave',26,'shave'],['bathRitual',43,'bodyCream']];
 for(const [id,duration,phase] of cases){
  actor.setFurniturePose('sit',new THREE.Vector3(0,id.startsWith('bath')?-.36:-.28,0),0);actor.snapFurnitureOffset();
  id.startsWith('bath')?actor.playBathCare(id):actor.playVanity(id);
  let count=0,max=0;
  for(let f=0;f<duration*30;f++){
   actor.update(1/30);const q=actor.careQA();
   if(q.phase===phase&&q.blend>.98&&q.error!==null){count++;max=Math.max(max,q.error);}
  }
  console.log(id,phase,count,'max',max.toFixed(4));
  assert.ok(count>10,id+' did not reach phase');assert.ok(max<.08,id+' stable contact '+max);
  if(['hydrate','serum','faceMask','handCream'].includes(id))assert.equal(actor.careQA().prop,false);
  actor.finishActivity();assert.equal(actor.careQA().id,null);assert.equal(actor.careQA().prop,false);
  id.startsWith('bath')?actor.playBathCare(id):actor.playVanity(id);actor.clearProps();actor.setPose('idle');
  assert.equal(actor.careQA().id,null);assert.equal(actor.root.getObjectByName('Held bath care'),undefined);assert.equal(actor.root.getObjectByName('Held vanity care'),undefined);
 }
});
