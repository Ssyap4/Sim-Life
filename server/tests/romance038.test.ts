import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Actor} from '../../src/game/Actor';
import {initialState} from '../../src/shared/protocol';
import {SOCIAL_BY_ID,socialRestriction,type PairMotion} from '../../src/shared/socialLife';
import {pairScenes,completeTogether} from '../society';
import {catPerchCandidates} from '../../src/shared/CatPerches';
import {gameMinutes} from '../../src/shared/life';
import {catHomeSeatError} from '../../src/shared/catOccupancy';
const roles=['vlad','alina'] as const;
const sofaActions=['sofaLean','sofaHands','sofaKiss','sofaHug'] as const;
test('sofa romance uses real distinct seats and existing rewards, not inventory',()=>{
 const s=initialState();
 for(const action of sofaActions){
  const cmd={type:'together' as const,action};
  const homes=pairScenes(s,'vlad',cmd);assert.ok(homes);
  assert.equal(homes.vlad.pair?.seat,'sofa');assert.equal(homes.alina.pair?.seat,'sofa');
  const v=homes.vlad.route.path.at(-1)??homes.vlad.route.from,a=homes.alina.route.path.at(-1)??homes.alina.route.from;
  assert.notDeepEqual(v,a);
  const result=completeTogether(s,'vlad',cmd,[...roles],0,homes);assert.ok(result.ok);
  assert.equal(result.state.money,s.money);assert.deepEqual(result.state.pantry,s.pantry);
  assert.equal(result.state.characters.vlad.pose,'sit');assert.equal(result.state.characters.alina.pose,'sit');
 }
 s.furnishing.soldFixtures=['sofa'];
 assert.ok(socialRestriction(SOCIAL_BY_ID.get('sofaLean')!,s,'vlad'));
 s.furnishing.placed=[{id:1,sku:'sofa-micro',finish:'sage',x:-2.36,z:2.02,rotation:0}];
 assert.ok(socialRestriction(SOCIAL_BY_ID.get('sofaLean')!,s,'vlad'));
 s.furnishing.placed=[{id:1,sku:'sofa-luna',finish:'sage',x:-2.36,z:2.02,rotation:0}];
 assert.equal(socialRestriction(SOCIAL_BY_ID.get('sofaLean')!,s,'vlad'),undefined);
 const homes=pairScenes(s,'vlad',{type:'together',action:'sofaLean'});assert.ok(homes);
 assert.equal(homes.vlad.furnitureId,1);assert.equal(homes.alina.furnitureId,1);
 assert.notDeepEqual(homes.vlad.furniturePose,homes.alina.furniturePose);
});
test('awake bed rest uses two mattress lanes, never sets sleep or activates sleep mode',()=>{
 const s=initialState(),cmd={type:'together' as const,action:'bedRest'};
 const homes=pairScenes(s,'vlad',cmd);assert.ok(homes);
 assert.equal(homes.vlad.pair?.bed,'starter');assert.equal(homes.alina.pair?.bed,'starter');
 assert.notDeepEqual(homes.vlad.furniturePose,homes.alina.furniturePose);
 const result=completeTogether(s,'vlad',cmd,[...roles],0,homes);assert.ok(result.ok);
 for(const r of roles){assert.equal(result.state.characters[r].pose,'idle');assert.equal(result.state.characters[r].sleepMode,undefined);}
 const site=catPerchCandidates(s.furnishing).find(p=>p.key==='starter:bed')!;
 const now=gameMinutes(s.clock);
 s.pets.simba.routine={kind:'perch',target:0,startedAt:now,until:now+40,route:{from:site.approach,path:[]},perch:site};
 assert.ok(catHomeSeatError(s,'vlad',homes.vlad)||catHomeSeatError(s,'alina',homes.alina));
 assert.equal(pairScenes(s,'vlad',cmd),null);
});
test('new couple poses remain finite without moving navigation roots',()=>{
 for(const motion of [...sofaActions,'bedRest','cuddle'] as PairMotion[]){
  const a=new Actor('vlad',[0,0]),b=new Actor('alina',[1,0]);
  a.setFurniturePose(motion==='bedRest'?'idle':'sit',new THREE.Vector3(0,.05,0),0);
  b.setFurniturePose(motion==='bedRest'?'idle':'sit',new THREE.Vector3(1,.05,0),0);
  a.playPartnerGesture(motion,true,undefined,b);b.playPartnerGesture(motion,false,undefined,a);
  const va=a.root.position.clone(),vb=b.root.position.clone();
  for(let i=0;i<400;i++){a.update(.05);b.update(.05);assert.ok(a.root.position.equals(va)&&b.root.position.equals(vb));for(const actor of [a,b])actor.root.traverse(n=>assert.ok(n.quaternion.toArray().every(Number.isFinite)&&n.position.toArray().every(Number.isFinite)));}
  a.finishActivity();b.finishActivity();
  assert.equal(a.isSleeping(),false);assert.equal(b.isSleeping(),false);
 }
});