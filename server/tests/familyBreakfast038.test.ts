import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {SOCIAL_BY_ID,activityItems} from '../../src/shared/socialLife';
import {addReadyFood} from '../../src/shared/readyFood';
import {RECIPES,ingredientList} from '../../src/shared/food';
import {pairScenes,completeTogether,cooperationDenial,socialResource} from '../society';
import {recordCompletedActivity,activeEmotions} from '../../src/shared/emotions';

test('breakfast invitation cooks one genuine batch, only cook gains cooking XP, partner waits seated',()=>{
 for(const from of ['vlad','alina'] as const){
  const to=from==='vlad'?'alina':'vlad',s=initialState();
  for(const [key,n] of ingredientList('omelette'))s.pantry[key]=n;
  s.characters[to].hunger=30;
  const a=SOCIAL_BY_ID.get('breakfastCare')!,command={type:'together' as const,action:a.id,item:'omelette'};
  assert.ok(activityItems(a,s,from).some(i=>i.id==='omelette'));
  assert.equal(socialResource(a),'kitchen');
  const homes=pairScenes(s,from,command);assert.ok(homes);
  assert.equal(homes[from].pair?.motion,'cook');assert.equal(homes[to].pair?.motion,'sitTalk');assert.equal(homes[to].pair?.seat,'table');
  const result=completeTogether(s,from,command,['vlad','alina'],0,homes);assert.ok(result.ok);
  for(const [key,n] of ingredientList('omelette')){assert.equal(result.state.pantry[key],0);assert.equal(s.pantry[key],n);}
  assert.equal(result.state.meals.omelette,s.meals.omelette+RECIPES.omelette.servings);
  assert.equal(result.state.characters[to].hunger,30);
  assert.equal(result.state.characters[to].pose,'sit');
  assert.equal(result.state.money,s.money);
  assert.ok(result.state.education.characters[from].xp.cooking>s.education.characters[from].xp.cooking);
  assert.equal(result.state.education.characters[to].xp.cooking,s.education.characters[to].xp.cooking);
  recordCompletedActivity(result.state,to,command);assert.ok(activeEmotions(result.state,to).some(e=>e.kind==='familyBreakfast'));
 }
});
test('breakfast checks actual ingredients and recipe eligibility again on completion',()=>{
 const s=initialState();for(const [key,n] of ingredientList('omelette'))s.pantry[key]=n;
 const c={type:'together' as const,action:'breakfastCare',item:'omelette'},homes=pairScenes(s,'vlad',c)!;
 assert.equal(cooperationDenial(s,'vlad',c),undefined);
 assert.ok(cooperationDenial(s,'vlad',{...c,item:'grillSteak'}));
 s.pantry.eggs=0;
 assert.equal(completeTogether(s,'vlad',c,['vlad','alina'],0,homes).ok,false);
 assert.equal(completeTogether(s,'vlad',c,['vlad'],0,homes).ok,false);
});
test('breakfast in bed has two distinct routes via stove, consumes one fresh portion and records care',()=>{
 for(const from of ['vlad','alina'] as const){const s=initialState(),to=from==='vlad'?'alina':'vlad';for(const [key,n] of ingredientList('omelette'))s.pantry[key]=n;s.characters[to].hunger=20;const c={type:'together' as const,action:'breakfastBed',item:'omelette'};assert.equal(cooperationDenial(s,from,c),undefined);const homes=pairScenes(s,from,c);assert.ok(homes);assert.equal(homes[from].pickupMs,25000);assert.equal(homes[from].pair?.motion,'breakfastServe');assert.equal(homes[to].pair?.motion,'breakfastReceive');assert.equal(homes[to].pair?.bed,'starter');assert.ok(homes[to].furnitureSeat);assert.ok(homes[from].route.path.length>0);const r=completeTogether(s,from,c,['vlad','alina'],0,homes);assert.ok(r.ok);assert.equal(r.state.meals.omelette,s.meals.omelette+RECIPES.omelette.servings-1);assert.ok(r.state.characters[to].hunger>20);assert.equal(r.state.money,s.money);assert.ok(r.state.relationship.memories.some(m=>m.action==='breakfastBed'));for(const [key] of ingredientList('omelette'))assert.equal(r.state.pantry[key],0);assert.equal(completeTogether(s,from,c,[from],0,homes).ok,false);s.pantry.eggs=0;assert.equal(completeTogether(s,from,c,['vlad','alina'],0,homes).ok,false);}
});

test('bed breakfast preserves the older meal instead of serving yesterday’s leftovers',()=>{
 const s=initialState();for(const [key,n] of ingredientList('omelette'))s.pantry[key]=n;s.meals.omelette=1;addReadyFood(s,'meal','omelette',1,'table',undefined,'bad');s.readyFood[0].expiresAt-=10;const old=structuredClone(s.readyFood[0]);const c={type:'together' as const,action:'breakfastBed',item:'omelette'};const homes=pairScenes(s,'vlad',c)!;const r=completeTogether(s,'vlad',c,['vlad','alina'],0,homes);assert.ok(r.ok);assert.deepEqual(r.state.readyFood.find(b=>b.expiresAt===old.expiresAt),old);assert.equal(r.state.meals.omelette,RECIPES.omelette.servings);
});
