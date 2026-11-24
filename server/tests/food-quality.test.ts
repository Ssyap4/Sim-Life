
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {levelXP} from '../../src/shared/education';
import {foodQualityChances,rollFoodQuality,foodQualityEffect,FOOD_QUALITIES} from '../../src/shared/foodQuality';
import {applyFoodAction} from '../food';
import {RECIPES} from '../../src/shared/food';
import {addReadyFood,moveReadyFoodToFridge,moveReadyFoodToTable,isReadyFoodBatch,consumeReadyPortion} from '../../src/shared/readyFood';
test('Quality probabilities sum to 100, lower grades decline monotonically; advanced cooks rarely fail',()=>{
 let previous=[100,100,0,0];
 for(let level=0;level<=20;level++){
  const c=foodQualityChances(level);assert.equal(c.reduce((a,b)=>a+b,0),100);assert.ok(c.every(n=>n>=0));
  assert.ok(c[0]<=previous[0]&&c[1]<=previous[1]&&c[3]>=previous[3]);previous=c;
  let start=0;for(let i=0;i<4;i++){if(c[i])assert.equal(rollFoodQuality(level,()=>(start+c[i]/2)/100),FOOD_QUALITIES[i]);start+=c[i];}
  if(level>=10)assert.ok(c[2]+c[3]>=93);
 }
 assert.deepEqual(foodQualityChances(20),[0,0,20,80]);
});
test('Cooking quality is rolled from actual cook skill once per batch; both portions retain it',()=>{
 for(const [roll,quality] of [[.1,'bad'],[.4,'average'],[.8,'good'],[.99,'perfect']] as const){
  const state=initialState();state.pantry.milk=2;let calls=0;
  const cooked=applyFoodAction(state,'vlad',{type:'cook',recipe:'omelette'},()=>{calls++;return roll;});assert.ok(cooked.ok);
  assert.equal(calls,1);assert.equal(cooked.state.readyFood[0].quality,quality);
  assert.equal(cooked.state.readyFood[0].portions,2);
  const next=cooked.state;assert.ok(moveReadyFoodToFridge(next,'meal','omelette'));assert.ok(moveReadyFoodToTable(next,'meal','omelette'));
  assert.ok(next.readyFood.every(b=>b.quality===quality));
  for(const role of ['vlad','alina'] as const){
   const actor=next.characters[role];actor.hunger=0;actor.mood=60;actor.fun=60;
   const ate=applyFoodAction(next,role,{type:'eat',recipe:'omelette'});assert.ok(ate.ok);
   const effect=foodQualityEffect(quality,RECIPES.omelette.mood);
   assert.equal(ate.state.characters[role].hunger,RECIPES.omelette.hunger);
   assert.equal(ate.state.characters[role].mood,Math.min(100,60+effect.mood));
   assert.equal(ate.state.characters[role].fun,60+effect.fun);
   Object.assign(next,ate.state);
  }
  assert.equal(next.meals.omelette,0);
 }
});
test('Oldest batch is consumed without merging qualities; old saves default to good; needs clamp at zero',()=>{
 const state=initialState();state.meals.toast=2;
 addReadyFood(state,'meal','toast',1,'table',undefined,'bad');addReadyFood(state,'meal','toast',1,'table',undefined,'perfect');
 assert.equal(consumeReadyPortion(state,'meal','toast','table')?.quality,'bad');
 assert.equal(consumeReadyPortion(state,'meal','toast','table')?.quality,'perfect');
 state.meals.toast=1;addReadyFood(state,'meal','toast',1,'table');
 assert.ok(isReadyFoodBatch(state.readyFood[0]));assert.ok(!isReadyFoodBatch({...state.readyFood[0],quality:'invalid'}));
 assert.deepEqual(foodQualityEffect(undefined,5),{mood:5,fun:0});
 state.readyFood[0].quality='bad';state.characters.vlad.mood=10;state.characters.vlad.fun=5;
 const ate=applyFoodAction(state,'vlad',{type:'eat',recipe:'toast'});assert.ok(ate.ok);assert.equal(ate.state.characters.vlad.mood,0);assert.equal(ate.state.characters.vlad.fun,0);
});
test('Skill 20 cannot produce bad or average quality',()=>{
 const state=initialState();state.education.characters.alina.xp.cooking=levelXP(20);state.pantry.milk=2;
 const cooked=applyFoodAction(state,'alina',{type:'cook',recipe:'omelette'},()=>0);assert.ok(cooked.ok);assert.equal(cooked.state.readyFood[0].quality,'good');
});

import {applyWorld,localActivity} from '../locations';
import {approachFor,stationById} from '../../src/shared/locations';
import {validPicnicBasket} from '../../src/shared/picnic';
test('Packed food keeps quality through round trip and picnic eating applies the same penalties',()=>{
 let state=initialState();state.world.picnic={portions:{vlad:[],alina:[]}};
 state.meals.toast=1;addReadyFood(state,'meal','toast',1,'fridge',undefined,'bad');
 Object.assign(state.characters.vlad,approachFor(stationById('home','fridge')!,'vlad'));
 const pack=()=>applyWorld(state,'vlad',{type:'picnic_pack',kind:'meal',item:'toast'});
 const packed=pack();assert.ok(packed.ok);state=packed.state;
 assert.equal(state.world.picnic!.portions.vlad[0].quality,'bad');assert.ok(validPicnicBasket(state.world.picnic));
 const unpacked=applyWorld(state,'vlad',{type:'picnic_unpack',kind:'meal',item:'toast'});assert.ok(unpacked.ok);state=unpacked.state;
 assert.equal(state.readyFood[0].quality,'bad');
 const repacked=pack();assert.ok(repacked.ok);state=repacked.state;
 state.world.places.vlad='park';Object.assign(state.characters.vlad,approachFor(stationById('park','park-picnic')!,'vlad'));
 Object.assign(state.characters.vlad,{hunger:0,mood:60,fun:60});
 const ate=localActivity(state,'vlad','picnic','park-picnic');assert.ok(ate.ok);
 assert.equal(ate.state.characters.vlad.hunger,RECIPES.toast.hunger);
 assert.equal(ate.state.characters.vlad.mood,30);assert.equal(ate.state.characters.vlad.fun,30);
});
