import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {addReadyFood,tableShelfMinutes} from '../../src/shared/readyFood';
import {storageUsage,FRIDGE_CAPACITY} from '../../src/shared/storageSpace';
import {applyAction} from '../logic';
import {choosePetIdle} from '../../src/game/PetIdle';
import {PetActor} from '../../src/game/PetActor';
import {Actor} from '../../src/game/Actor';
import {Vector3} from 'three';

function stocked(portions:number){
  const state=initialState();
  state.meals.omelette=portions;
  addReadyFood(state,'meal','omelette',portions,'table');
  return state;
}
test('storing real leftovers has no free inventory, time skip or duplicate food',()=>{
  const state=stocked(6);
  const before=state.readyFood.reduce((n,b)=>n+b.portions,0);
  const originalExpiry=state.readyFood[0].expiresAt;
  const res=applyAction(state,'vlad','kitchenLeftovers');
  assert.equal(res.ok,true);
  if(!res.ok)return;
  assert.equal(res.state.meals.omelette,6);
  assert.equal(state.readyFood[0].storage,'table','source save unchanged');
  assert.equal(res.state.readyFood.filter(b=>b.storage==='fridge').reduce((n,b)=>n+b.portions,0),4);
  assert.equal(res.state.readyFood.filter(b=>b.storage==='table').reduce((n,b)=>n+b.portions,0),2);
  assert.equal(res.state.readyFood.reduce((n,b)=>n+b.portions,0),before);
  assert.equal(res.state.money,state.money);
  assert.ok(res.state.readyFood.some(b=>b.storage==='table'&&b.expiresAt===originalExpiry));
  assert.ok(res.state.readyFood.every(b=>b.expiresAt>0));
  assert.match(res.message,/4 порц/);
});
test('new chore denies empty table and full fridge rather than faking rewards',()=>{
  const empty=initialState();
  const none=applyAction(empty,'alina','kitchenLeftovers');
  assert.equal(none.ok,false);
  if(!none.ok)assert.match(none.reason,/нет свежих/i);
  const full=stocked(2);
  // Overfill via existing, physically stored stock so another portion will not fit.
  full.pantry.chicken=200;
  assert.ok(storageUsage(full).fridge>=FRIDGE_CAPACITY);
  const denied=applyAction(full,'vlad','kitchenLeftovers');
  assert.equal(denied.ok,false);
  if(!denied.ok)assert.match(denied.reason,/нет места/);
  assert.equal(full.meals.omelette,2);
});
test('oldest table batch is refrigerated first without reviving expired portions',()=>{
  const state=initialState();
  state.meals.omelette=3;
  addReadyFood(state,'meal','omelette',1,'table');
  state.clock.minute+=15;
  addReadyFood(state,'meal','omelette',2,'table');
  const old=state.readyFood[0].expiresAt;
  const result=applyAction(state,'alina','kitchenLeftovers');
  assert.equal(result.ok,true);
  if(!result.ok)return;
  assert.equal(result.state.meals.omelette,3);
  assert.equal(result.state.readyFood.filter(b=>b.storage==='table').length,0);
  assert.ok(result.state.readyFood.some(b=>b.storage==='fridge'&&b.expiresAt>old));
  assert.ok(result.state.readyFood.every(b=>b.expiresAt<=
    (state.clock.day*1440+state.clock.minute)+3*1440));
  assert.equal(tableShelfMinutes('omelette'),480);
});
test('Verdell asks with BOTH front paws and his back feet stay at the same location',()=>{
  const state={satiety:71,energy:85,happiness:81,bond:72,bowl:2,personNearby:true};
  assert.equal(choosePetIdle('verdell',state,0),'greet');
  assert.equal(choosePetIdle('verdell',state,2),'beg');
  assert.notEqual(choosePetIdle('verdell',{...state,personNearby:false},2),'beg');
  assert.notEqual(choosePetIdle('verdell',{...state,satiety:8,bowl:0},2),'beg');
  const dog=new PetActor('verdell');
  dog.setAmbient(state);
  const root={x:dog.root.position.x,z:dog.root.position.z};
  for(let i=0;i<1200&&dog.currentIdleGesture()!=='beg';i++)dog.update(1/30);
  assert.equal(dog.currentIdleGesture(),'beg');
  for(let i=0;i<25;i++)dog.update(1/30);
  const rig=dog as unknown as {
    body:{rotation:{x:number}};paws:{position:{y:number};rotation:{x:number}}[]
  };
  assert.ok(rig.body.rotation.x<-.15,'body sits upright on rear paws');
  assert.ok(rig.paws[0].position.y>.59 && rig.paws[2].position.y>.59,'two front paws clearly raised');
  assert.equal(dog.root.position.x,root.x);
  assert.equal(dog.root.position.z,root.z);
  dog.followRoute([], 'eat');
  assert.equal(dog.currentIdleGesture(),null);
});
test('Simba head is slimmer than before, without affecting Verdell scale',()=>{
  const cat=new PetActor('simba');
  const dog=new PetActor('verdell');
  const head=(cat as unknown as {head:{scale:{x:number;y:number;z:number}}}).head;
  assert.ok(head.scale.x<=.82 && head.scale.y<=.87 && head.scale.z<=.9);
  assert.ok(cat.root.scale.x>dog.root.scale.x);
});

test('serving two refrigerated portions is a real transfer; serving again respects limits',()=>{
  const source=initialState();
  source.meals.omelette=4;
  addReadyFood(source,'meal','omelette',4,'fridge');
  const served=applyAction(source,'alina','kitchenServe');
  assert.equal(served.ok,true);
  if(!served.ok)return;
  assert.equal(served.state.meals.omelette,4,'household count unchanged');
  assert.equal(served.state.readyFood.filter(b=>b.storage==='table')
    .reduce((total,b)=>total+b.portions,0),2);
  assert.equal(served.state.readyFood.filter(b=>b.storage==='fridge')
    .reduce((total,b)=>total+b.portions,0),2);
  assert.equal(served.state.money,source.money);
  assert.ok(served.state.readyFood.every(b=>b.expiresAt>0));
  assert.equal(source.readyFood.length,1,'original save was not mutated');
  assert.match(served.message,/2 порц/);
  const again=applyAction(served.state,'vlad','kitchenServe');
  assert.equal(again.ok,true);
  if(again.ok)assert.equal(again.state.readyFood.filter(b=>b.storage==='table')
    .reduce((total,b)=>total+b.portions,0),4);
});
test('serving and storage forbid fake food when surfaces are empty or full',()=>{
  const empty=applyAction(initialState(),'vlad','kitchenServe');
  assert.equal(empty.ok,false);
  const full=initialState();
  full.meals.omelette=14;
  addReadyFood(full,'meal','omelette',12,'table');
  addReadyFood(full,'meal','omelette',2,'fridge');
  const denied=applyAction(full,'vlad','kitchenServe');
  assert.equal(denied.ok,false);
  if(!denied.ok)assert.match(denied.reason,/столе недостаточно места/);
  assert.equal(full.readyFood[1].storage,'fridge');
});
test('covered food box is visible while carrying and clears after action cancellation',()=>{
  const actor=new Actor('vlad',[0,0]);
  assert.equal(actor.hasFoodContainer(),false);
  actor.carryFoodContainer();
  assert.equal(actor.hasFoodContainer(),true);
  actor.walkPath([new Vector3(1,0,1)],()=>{});
  assert.equal(actor.hasFoodContainer(),true,'walking keeps existing physical prop');
  actor.hideFoodContainer();
  assert.equal(actor.hasFoodContainer(),false);
  actor.carryFoodContainer();
  actor.setPose('idle');
  assert.equal(actor.hasFoodContainer(),false,'cancelling action hides prop');
});
