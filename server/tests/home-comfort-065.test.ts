import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {RECIPES,TAKEOUT,HOME_DRINK_COLORS,HOME_DESSERTS,isShopSnack,ingredientList,type RecipeId} from '../../src/shared/food';
import {maximumXP} from '../../src/shared/education';
import {applyFoodAction,applyTvFood} from '../food';
import {checkout} from '../market';
import {MARKET_BY_ID} from '../../src/shared/market';
import {addReadyFood,tableShelfMinutes} from '../../src/shared/readyFood';
import {autonomyCandidates} from '../../src/shared/autonomy';
import {CARE,careStation,careEffects,careScore,finishCare,validVanity} from '../../src/shared/vanity';
import {planTask,evaluateTask} from '../tasks';
import {careFrame} from '../../src/game/CareMotion';
test('every new recipe consumes actual ingredients, creates servings and uses normal stock',()=>{
 for(const id of [...Object.keys(HOME_DRINK_COLORS),...HOME_DESSERTS] as RecipeId[]){
  const s=initialState();s.education.characters.alina.xp.cooking=maximumXP;
  for(const [item,count] of ingredientList(id))s.pantry[item]=count;
  const r=applyFoodAction(s,'alina',{type:'cook',recipe:id},()=>0);
  assert.ok(r.ok,id);assert.equal(r.state.meals[id],RECIPES[id].servings);
  for(const [item] of ingredientList(id))assert.equal(r.state.pantry[item],0,id);
  const ate=applyFoodAction(r.state,'alina',{type:'eat',recipe:id});assert.ok(ate.ok,id);assert.equal(ate.state.meals[id],RECIPES[id].servings-1);
  assert.equal(applyFoodAction(r.state,'alina',{type:'cook',recipe:id}).ok,false);
  if(Object.hasOwn(HOME_DRINK_COLORS,id)){assert.equal(r.state.readyFood[0].quality,'perfect');assert.equal(tableShelfMinutes(id),120);}
 }
});
test('snacks use a real paid basket and exact portions on the sofa',()=>{
 for(const item of Object.keys(TAKEOUT).filter(isShopSnack) as (keyof typeof TAKEOUT)[]){
  const s=initialState(),p=MARKET_BY_ID.get('takeout:'+item)!;assert.equal(p.category,'sweets');
  const r=checkout(s,'vlad',[{id:p.id,quantity:1}]);assert.ok(r.ok);assert.equal(r.state.money,s.money-p.price);
  assert.equal(r.state.takeout[item],p.quantity);
  const ate=applyTvFood(r.state,'vlad',item);assert.ok(ate.ok);assert.equal(ate.state.takeout[item],p.quantity-1);
  assert.equal(planTask({type:'movie',genre:'comedy',food:item})?.durationMs,120000);
 }
});
test('hunger AI chooses real meal before tea and sweet snacks',()=>{
 const s=initialState();s.autonomy.vlad='needs';s.characters.vlad.hunger=30;
 s.meals.blackTeaCup=1;addReadyFood(s,'meal','blackTeaCup',1,'table');
 s.takeout.pizzaCheese=1;addReadyFood(s,'takeout','pizzaCheese',1,'table');
 assert.deepEqual(autonomyCandidates(s,'vlad').find(c=>c.need==='hunger')?.command,{type:'eat_takeout',item:'pizzaCheese'});
});
test('all hair care uses correct room, independent effect, bounded mood and deliberate style switch',()=>{
 const s=initialState();
 for(const id of ['bathHairWash','bathHairMask','bathHairRitual','hairDry','hairStraight','hairCurl'] as const){
  const cmd={type:'vanity_care' as const,care:id},plan=planTask(cmd)!;assert.equal(plan.resource,careStation(id));assert.equal(plan.durationMs,CARE[id].seconds*1000);
  assert.equal(evaluateTask(s,'vlad',cmd).ok,false);const r=evaluateTask(s,'alina',cmd);assert.ok(r.ok);assert.ok(validVanity(r.state.vanity));
 }
 finishCare(s,'bathHairRitual');finishCare(s,'hairCurl');const before=careScore(s),mood=s.characters.alina.mood;finishCare(s,'hairStraight');assert.equal(s.vanity?.hair?.appearance,'hairStraight');assert.equal(careScore(s),before);assert.equal(s.characters.alina.mood,mood);
 assert.equal(careEffects(s).length,2);assert.equal(careFrame('bathHairRitual',12).phase,'shampoo');assert.equal(careFrame('bathHairRitual',30).phase,'hairMask');assert.equal(careFrame('bathHairRitual',80).phase,'relax');assert.equal(careFrame('bathHairRitual',172).phase,'rinse');
});
