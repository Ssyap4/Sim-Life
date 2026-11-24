import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Actor } from '../../src/game/Actor';
import { expressiveDemeanor } from '../../src/game/CharacterDemeanor';
import { initialState } from '../../src/shared/protocol';
import { residentEmotion, recordEmotion, type EmotionId } from '../../src/shared/emotions';
import { fullLeisureCandidates } from '../../src/shared/autonomy';
const healthy={...initialState().characters.vlad,hunger:90,energy:90,mood:90,bladder:90,hygiene:90,social:90,fun:90,comfort:90};
const ids:EmotionId[]=['happy','inspired','calm','tired','hungry','uncomfortable','lonely','bored','sad','tense'];
test('all ten profiles are distinct, bounded and disabled for contact, seats and sleep',()=>{
 const poses=ids.map(e=>expressiveDemeanor(healthy,'idle',e));
 assert.equal(new Set(poses.map(p=>JSON.stringify(p))).size,10);
 for(const e of ids){
  const p=expressiveDemeanor(healthy,'walking',e);
  assert.ok(Math.abs(p.shoulders)<=.05&&Math.abs(p.gaze)<=.083&&p.lids>=0&&p.lids<=.35&&p.swing>=.6&&p.swing<=1.2);
  for(const mode of ['busy','sleep'] as const)
   assert.deepEqual(expressiveDemeanor(healthy,mode,e),{smile:0,shoulders:0,gaze:0,friendly:false,lids:0,swing:1,tilt:0});
 }
 assert.ok(poses[0].smile>poses[8].smile);
 assert.ok(poses[3].lids>poses[2].lids);
});
test('temporary emotional events and critical needs drive the same visual profile as UI',()=>{
 const s=initialState();Object.assign(s.characters.vlad,healthy);
 recordEmotion(s,'vlad','mealBad');let e=residentEmotion(s,'vlad').id;
 assert.equal(e,'sad');assert.ok(expressiveDemeanor(healthy,'idle',e).smile<0);
 s.characters.vlad.energy=10;e=residentEmotion(s,'vlad').id;
 assert.equal(e,'tired');assert.ok(expressiveDemeanor(healthy,'idle',e).lids>.25);
 s.characters.vlad.energy=90;s.clock.day+=1;
 assert.equal(residentEmotion(s,'vlad').id,'happy');
});
test('emotional walking preserves actual root position on every frame',()=>{
 const a=new Actor('vlad',[0,0]),b=new Actor('vlad',[0,0]);
 a.setNeeds(healthy,'happy');b.setNeeds(healthy,'sad');
 const path=[new THREE.Vector3(1,0,0),new THREE.Vector3(1,0,1)];
 let arrivedA=0,arrivedB=0;
 a.walkPath(path,()=>arrivedA++);b.walkPath(path,()=>arrivedB++);
 for(let i=0;i<180;i++){
  a.update(.05);b.update(.05);
  assert.ok(a.root.position.distanceTo(b.root.position)<1e-8);
  for(const actor of [a,b])actor.root.traverse(n=>assert.ok(n.quaternion.toArray().every(Number.isFinite)));
 }
 assert.equal(arrivedA,1);assert.equal(arrivedB,1);
});
test('full autonomy offers both pets, social and home actions, without removing variety',()=>{
 const s=initialState();Object.assign(s.characters.alina,healthy,{social:35});
 s.autonomy.alina='full';
 const a=fullLeisureCandidates(s,'alina',0);
 assert.ok(a.some(c=>c.type==='pet_action'&&c.pet==='simba'));
 assert.ok(a.some(c=>c.type==='pet_action'&&c.pet==='verdell'));
 assert.ok(a.some(c=>c.type==='act'&&c.actionId==='tableTalk'));
 assert.ok(a.some(c=>c.type==='act'&&c.actionId==='kitchenTidy'));
 assert.ok(a[0].type==='pet_action'||a[0].type==='act'&&['sofaCall','tableTalk'].includes(a[0].actionId));
 assert.notDeepEqual(fullLeisureCandidates(s,'alina',2),a);
});