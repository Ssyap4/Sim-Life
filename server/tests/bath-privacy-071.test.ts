import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Actor} from '../../src/game/Actor';
import {createBlenderCharacter} from '../../src/game/BlenderCharacter';
import {fitWardrobe,fitSpaWardrobe,outfitChoices} from '../../src/game/Wardrobe';

function clothing(actor:Actor){
 const result=new Map<THREE.Object3D,boolean>();
 actor.root.traverse(o=>{if(o.userData.garmentId||o.userData.spaFoot||o.userData.bathAccessory)result.set(o,o.visible);});
 return result;
}
function assertPrivate(actor:Actor){
 const q=actor.bathPrivacyQA();assert.equal(q.active,true);assert.equal(q.covered,3);assert.equal(q.garments,0);
 actor.root.traverse(o=>{
  if(o.userData.garmentId||o.userData.spaFoot||o.userData.bathAccessory)assert.equal(o.visible,false,o.name);
  if(o instanceof THREE.Mesh&&o.userData.bathPrivacy&&o.name.startsWith('Bath mosaic')){
   assert.equal(o.visible,true);assert.equal((o.material as THREE.Material).transparent,false);
   assert.equal((o.material as THREE.Material).opacity,1);
   assert.equal((o.material as THREE.Material).depthWrite,true);
  }
 });
}
function assertRestored(actor:Actor,before:Map<THREE.Object3D,boolean>){
 assert.equal(actor.bathPrivacyQA().active,false);assert.equal(actor.bathPrivacyQA().covered,0);
 for(const [o,visible] of before)assert.equal(o.visible,visible,o.name);
}
for(const role of ['vlad','alina'] as const)for(const variant of ['remake','legacy'] as const){
 test(role+' '+variant+' bathing conceals clothes from all sides and restores the exact outfit',async()=>{
  const path='../../src/assets/characters/'+(variant==='remake'?'remake/':'')+role+'.glb';
  const bytes=await readFile(new URL(path,import.meta.url));
  const loader=new GLTFLoader().register(()=>({name:'HeadlessTexture',loadTexture:async()=>new THREE.Texture()}));
  const actor=new Actor(role,[0,0],createBlenderCharacter(await loader.parseAsync(Uint8Array.from(bytes).buffer,''),role));
  const before=clothing(actor);assert.ok([...before.values()].some(Boolean));
  actor.playDomesticActivity('shower');assertPrivate(actor);
  for(let i=0;i<60;i++)actor.update(1/30);
  assertPrivate(actor);const count=actor.bathPrivacyQA().parts;
  actor.finishActivity();assertRestored(actor,before);
  actor.setFurniturePose('sit',new THREE.Vector3(0,-.36,0),Math.PI);
  actor.playDomesticActivity('bath');assertPrivate(actor);
  if(role==='alina'){actor.playBathCare('bathRitual');actor.syncCareElapsed(24);}
  actor.update(1/30);assertPrivate(actor);assert.equal(actor.bathPrivacyQA().parts,count);
  actor.suspendBathPrivacy();fitSpaWardrobe(actor.root,role);const spa=clothing(actor);
  actor.syncBathPrivacy();assertPrivate(actor);
  actor.setPose('idle');assertRestored(actor,spa);
  fitWardrobe(actor.root,role,outfitChoices('home'));const home=clothing(actor);
  actor.playDomesticActivity('shower');assertPrivate(actor);
  actor.walkPath([new THREE.Vector3(1,0,0)],()=>{});assertRestored(actor,home);
  actor.playDomesticActivity('washHands');assertRestored(actor,home);
 });
}
test('fallback rig uses the same opaque bath privacy and exits without orphaned geometry',()=>{
 for(const role of ['vlad','alina'] as const){
  const actor=new Actor(role,[0,0]);actor.playDomesticActivity('shower');assertPrivate(actor);
  const count=actor.bathPrivacyQA().parts;
  actor.setPose('idle');assert.equal(actor.bathPrivacyQA().active,false);
  actor.playDomesticActivity('bath');assertPrivate(actor);
  actor.finishActivity();assert.equal(actor.bathPrivacyQA().active,false);
  assert.equal(actor.bathPrivacyQA().parts,count);
 }
});
