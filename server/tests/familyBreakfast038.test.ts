import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {SOCIAL_BY_ID,activityItems} from '../../src/shared/socialLife';
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